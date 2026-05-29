<!-- @architect | feature_id: qa-flow-enforcement | created_at: 2026-05-18 -->

# Architecture: QA-Flow Enforcement (v3.2.0)

Implementation blueprint for `specs/qa-flow-enforcement.md`. Sr-engineer
encodes this verbatim; no judgement calls left open.

## Affected Files

**New (2):**
- `tools/transitions.ts` — pure state-machine logic. No I/O.
- `tools/evidence-file.ts` — file-mode evidence read/write. Parallel pattern to `tasks-file.ts`.

**Modified (8):**
- `index.ts` — schema refinement, qa_review arg, handler wiring (transition + evidence + round).
- `tools/handoff.ts` — HandoffState gains `qa_round`; YAML serializer/parser updated.
- `tools/storage.ts` — `HandoffStorage` interface extended: `writeState` gains `qaRound`; new methods `recordReview`, `hasEvidence`. `FileHandoffStorage` delegates.
- `tools/storage-sqlite.ts` — schema migration (column + new table), new prepared stmts.
- `content/skill-qa-engineer.md` — Phase-3 qa_review param, round-counter awareness, tw_complete_task agent_id.
- `content/constitution.md` — version bump v3.2.0; new §3 sub-section "Server-enforced chain".
- `package.json` — version 3.2.0.
- `README.md` — Enforcement section (A/B/D/E summary).

**Module dependency graph (new):**

```
index.ts ──> transitions.ts (pure)
        \──> storage.ts ──> evidence-file.ts (file mode)
                       \──> storage-sqlite.ts (SQLite mode, self-contained)
storage.ts ──> handoff.ts (qa_round field)
```

## Data Structures

### TypeScript types (new + extended)

```ts
// tools/handoff.ts — extended
export interface HandoffState {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason?: string;
  last_agent?: string;
  completed_tasks: string[];
  pending_notes: string[];
  qa_round: number; // NEW — non-optional; reader defaults missing frontmatter to 0
}

// tools/transitions.ts — new
export type AgentName = "pm" | "researcher" | "architect" | "sr-engineer" | "qa-engineer";
export type StatusName = "In_Progress" | "PASS" | "FAIL" | "Blocked";

export interface TransitionTuple {
  agent: AgentName | null; // null = fresh workspace
  status: StatusName | null;
}

export interface TransitionRequest {
  prev: TransitionTuple;
  next: TransitionTuple;
  prev_qa_round: number;
}

export interface TransitionRejection {
  error: "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "AGENT_ID_REQUIRED";
  attempted: { prev_agent: string | null; prev_status: string | null; new_agent: string; new_status: string; qa_round: number };
  allowed: Array<{ new_agent: AgentName; new_status: StatusName }>;
  hint: string;
}

// tools/storage.ts — extended interface (additions only shown)
export interface HandoffStorage {
  // existing methods unchanged…
  writeState(
    workspacePath: string,
    activeFeature: string,
    status: string,
    completedTasks: string[],
    pendingNotes: string[],
    blockingReason?: string,
    lastAgent?: string,
    qaRound?: number, // NEW — default 0 if omitted (backward-compat for unrelated callers)
  ): Promise<string>;
  recordReview(workspacePath: string, taskIds: string[], status: "PASS" | "FAIL", reviewer: string, notes: string): Promise<void>;
  hasEvidence(workspacePath: string, taskIds: string[]): Promise<{ present: string[]; missing: string[] }>;
}
```

### YAML frontmatter (file mode)

```yaml
---
active_feature: "qa-flow-enforcement"
status: "In_Progress"
last_updated: "2026-05-18T..."
last_agent: "qa-engineer"
qa_round: 2          # NEW. Defaults to 0 when missing.
---
```

Reader: `qa_round = Number(frontmatter.qa_round ?? 0)`. Non-finite → 0.
Writer: always emit `qa_round` (even if 0). Existing handoff files without the field continue to load (default 0).

### SQLite migrations

`tools/storage-sqlite.ts` constructor runs `db.exec(SCHEMA)` then attempts an additive migration wrapped in try/catch (idempotent — sqlite errors if column already present):

```sql
-- migration: handoff_state.qa_round
ALTER TABLE handoff_state ADD COLUMN qa_round INTEGER NOT NULL DEFAULT 0;
```

```sql
-- new table: reports (created via CREATE TABLE IF NOT EXISTS in SCHEMA)
CREATE TABLE IF NOT EXISTS reports (
  workspace_path TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  reviewer       TEXT NOT NULL,
  notes          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (workspace_path, task_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_reports_ws_task
  ON reports (workspace_path, task_id, status);
```

### File-mode evidence on disk

```
<workspace>/qa_reports/review_<task_id>.md
```

Each file: free-form markdown. Server only checks **existence** (file mode) — content is QA's domain. Multiple rounds append timestamped sections; `recordReview` for file mode performs append-or-create, not overwrite. Format:

```md
## Round <N> — <ISO timestamp> — <PASS|FAIL>
<notes>
```

`hasEvidence(taskIds)` returns `present`/`missing` purely by `fs.existsSync` per id.

## ALLOWED_TRANSITIONS Matrix

Authoritative source. Key: `(prev_agent, prev_status)` → set of allowed `(new_agent, new_status)`. `null` denotes fresh workspace. `*` denotes "no constraint on status field for that side".

| prev_agent | prev_status | allowed new (agent, status) |
|---|---|---|
| null | null | (pm, In_Progress), (pm, Blocked), (researcher, In_Progress), (researcher, Blocked) |
| researcher | In_Progress | (pm, In_Progress), (pm, Blocked), (researcher, Blocked) |
| researcher | Blocked | (researcher, In_Progress), (pm, In_Progress) |
| pm | In_Progress | (architect, In_Progress), (sr-engineer, In_Progress), (researcher, In_Progress), (pm, Blocked), (pm, In_Progress) |
| pm | Blocked | (pm, In_Progress), (pm, Blocked) |
| architect | In_Progress | (sr-engineer, In_Progress), (architect, Blocked), (pm, In_Progress) |
| architect | Blocked | (pm, In_Progress), (architect, In_Progress) |
| sr-engineer | In_Progress | (qa-engineer, In_Progress), (sr-engineer, Blocked), (pm, In_Progress) |
| sr-engineer | Blocked | (sr-engineer, In_Progress), (pm, In_Progress) |
| qa-engineer | In_Progress | (qa-engineer, PASS), (qa-engineer, FAIL), (qa-engineer, Blocked) |
| qa-engineer | Blocked | (sr-engineer, In_Progress), (qa-engineer, In_Progress) |
| qa-engineer | FAIL | (sr-engineer, In_Progress), (pm, In_Progress) |
| qa-engineer | PASS | (pm, In_Progress), (researcher, In_Progress) |

**Self-loops on `In_Progress`** for the *same* agent (e.g. sr-engineer doing a multi-step task) are allowed implicitly: if `prev.agent === next.agent && prev.status === "In_Progress" && next.status === "In_Progress"`, skip the table lookup and accept. This avoids forcing agents to ping-pong through other roles for internal progress writes.

**Round-cap override** (highest precedence): if `prev_qa_round >= 4`, the only allowed transition is `(pm, In_Progress)`. All other entries (including the self-loop fast path) are denied with `error: "QA_ROUND_EXCEEDED"`. PM's `(pm, In_Progress)` write must reset `qa_round` to 0 (handled by `computeNewRound`).

## Round Counter Semantics

```ts
// tools/transitions.ts
export function computeNewRound(prev_qa_round: number, next: TransitionTuple): number {
  if (next.agent === "qa-engineer" && next.status === "FAIL") return prev_qa_round + 1;
  if (next.agent === "qa-engineer" && next.status === "PASS") return 0;
  if (next.agent === "pm" && next.status === "In_Progress") return 0; // reset on PM re-entry
  return prev_qa_round; // hold steady on all other writes
}
```

Round 4 (FAIL when prev_qa_round === 3): write succeeds (qa_round becomes 4) **but** server prepends a synthetic note to `pending_notes`: `"⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets."`. Subsequent calls are gated by the round-cap override above.

## Interface Contracts

### `tools/transitions.ts`

```ts
export const ALLOWED_TRANSITIONS: Map<string, ReadonlyArray<{ agent: AgentName; status: StatusName }>>;
// keyed by `${prev_agent ?? "null"}:${prev_status ?? "null"}`

export function validateTransition(req: TransitionRequest): TransitionRejection | null;
// returns null on accept; rejection envelope otherwise.

export function computeNewRound(prev_qa_round: number, next: TransitionTuple): number;

export function requireQaEngineer(agentId: string | undefined, toolName: string): { ok: true } | { ok: false; message: string };
// used as defense-in-depth alongside zod refinement.
```

### `tools/storage.ts` additions

```ts
recordReview(
  workspacePath: string,
  taskIds: string[],   // each gets its own evidence record
  status: "PASS" | "FAIL",
  reviewer: string,    // always "qa-engineer" today; param for future flexibility
  notes: string,
): Promise<void>;

hasEvidence(
  workspacePath: string,
  taskIds: string[],
): Promise<{ present: string[]; missing: string[] }>;
```

`FileHandoffStorage`:
- `recordReview` → for each `taskId`, append `## Round <N> — <ISO> — <status>\n<notes>\n` to `qa_reports/review_<id>.md` (mkdir-p `qa_reports/`).
- `hasEvidence` → for each id, `fs.existsSync('<ws>/qa_reports/review_<id>.md')`. Sufficient — content not inspected.

`SqliteHandoffStorage`:
- `recordReview` → one prepared INSERT per id into `reports`.
- `hasEvidence` → SELECT task_id FROM reports WHERE workspace_path=? AND task_id IN (...) AND status='PASS'. Note: SQLite mode requires a **PASS-status** report for the evidence check, not just any report. File mode is laxer (existence only) because PASS/FAIL semantics live in commit history / filename suffixes outside our control.

### `index.ts` — UpdateStateArgs extension

```ts
const UpdateStateArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  active_feature: z.string().min(1).max(500),
  status: z.enum(["In_Progress", "PASS", "FAIL", "Blocked"]),
  completed_tasks: z.array(z.string().max(500)).max(200).optional().default([]),
  pending_notes: z.array(z.string().max(1000)).max(50).optional().default([]),
  blocking_reason: z.string().max(2000).optional(),
  agent_id: z.string().max(200).optional(),
  qa_review: z.string().max(10000).optional(), // NEW — notes attached when status in {PASS,FAIL} and agent=qa-engineer
})
.refine((d) => !(d.status === "PASS") || d.agent_id === "qa-engineer", {
  message: "status=PASS requires agent_id=\"qa-engineer\"",
  path: ["agent_id"],
});
```

`CompleteTaskArgs` likewise gains `agent_id` (handler enforces, not schema, for symmetric error UX):

```ts
const CompleteTaskArgs = z.object({
  workspace_path: absoluteWorkspacePath,
  task_id: z.string().min(1),
  note: z.string().optional(),
  agent_id: z.string().max(200).optional(),
});
```

### Handler flow — tw_update_state (post-change)

Pseudocode for sr-engineer to mirror exactly:

```ts
case "tw_update_state": {
  const parsed = UpdateStateArgs.parse(args);                       // 1. schema (incl. PASS refine)
  enforcePreFlight(parsed.workspace_path, "tw_update_state");       // 2. pre-flight
  const qa = requireQaEngineer(parsed.agent_id, "tw_update_state"); // 3. defense in depth — only triggers on PASS path
  if (parsed.status === "PASS" && !qa.ok) return errorContent(qa.message);

  const prevState = getActiveStorage().parse(parsed.workspace_path);
  const prev_qa_round = prevState?.qa_round ?? 0;
  const prevTuple = { agent: prevState?.last_agent ?? null, status: prevState?.status ?? null };
  const nextTuple = { agent: parsed.agent_id ?? null, status: parsed.status };

  const rej = validateTransition({ prev: prevTuple, next: nextTuple, prev_qa_round });
  if (rej) return errorContent(JSON.stringify(rej, null, 2));        // 4. transition gate

  // 5. evidence record (write-first, so assertEvidence can see it)
  if (parsed.qa_review && parsed.agent_id === "qa-engineer" && (parsed.status === "PASS" || parsed.status === "FAIL")) {
    const ids = parsed.completed_tasks.length ? parsed.completed_tasks : await deriveTaskIdsFromContext(parsed);
    await getActiveStorage().recordReview(parsed.workspace_path, ids, parsed.status, "qa-engineer", parsed.qa_review);
  }

  // 6. PASS evidence gate
  if (parsed.status === "PASS") {
    const ev = await getActiveStorage().hasEvidence(parsed.workspace_path, parsed.completed_tasks);
    if (ev.missing.length) return errorContent(`⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. Provide qa_review or write qa_reports/review_<id>.md before PASS.`);
  }

  // 7. compute new round + synthesize force-rollback note if entering Round 4
  const new_qa_round = computeNewRound(prev_qa_round, nextTuple);
  const pending = [...parsed.pending_notes];
  if (new_qa_round === 4 && prev_qa_round === 3) {
    pending.unshift("⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets.");
  }

  // 8. persist
  const result = await getActiveStorage().writeState(
    parsed.workspace_path, parsed.active_feature, parsed.status,
    parsed.completed_tasks, pending, parsed.blocking_reason, parsed.agent_id, new_qa_round,
  );
  return { content: [{ type: "text" as const, text: result }] };
}
```

`deriveTaskIdsFromContext` fallback (when caller omits `completed_tasks` on a FAIL): re-use the in-progress task ids from `listTasks(...).filter(t => !t.completed)`. If still empty, skip evidence write silently (no harm — FAIL without ids is just a state nudge).

### Handler flow — tw_complete_task (post-change)

```ts
case "tw_complete_task": {
  const parsed = CompleteTaskArgs.parse(args);
  enforcePreFlight(parsed.workspace_path, "tw_complete_task");
  const qa = requireQaEngineer(parsed.agent_id, "tw_complete_task");
  if (!qa.ok) return errorContent(qa.message);  // ALL completes gated, not just PASS-time
  const result = await completeTask(parsed.workspace_path, parsed.task_id, parsed.note);
  return { content: [{ type: "text" as const, text: result }] };
}
```

## Sequence Diagram

```mermaid
sequenceDiagram
  actor H as Human
  participant PM
  participant Arch as Architect
  participant SR as Sr-engineer
  participant QA as Qa-engineer
  participant S as Server

  H->>PM: requirement
  PM->>S: tw_update_state(In_Progress, agent_id=pm)
  S->>S: validateTransition(null→pm,In_Progress) ✓ ; qa_round=0
  S-->>PM: ok

  PM->>Arch: handoff (complex)
  Arch->>S: tw_update_state(In_Progress, agent_id=architect)
  S->>S: validateTransition(pm,In_Progress→architect,In_Progress) ✓
  S-->>Arch: ok

  Arch->>SR: design ready
  SR->>S: tw_update_state(In_Progress, agent_id=sr-engineer)
  S->>S: validateTransition(architect,In_Progress→sr-engineer,In_Progress) ✓
  S-->>SR: ok

  SR->>QA: ready for QA
  QA->>S: tw_update_state(In_Progress, agent_id=qa-engineer)
  S->>S: validateTransition(sr-engineer,In_Progress→qa-engineer,In_Progress) ✓
  S-->>QA: ok

  alt PASS (Round N)
    QA->>S: tw_update_state(PASS, agent_id=qa-engineer, completed_tasks=[...], qa_review="...")
    S->>S: refine + transition ✓
    S->>S: recordReview(PASS) ; hasEvidence([...]) ✓
    S->>S: qa_round = 0
    S-->>QA: ok
    QA->>S: tw_complete_task(<id>, agent_id=qa-engineer)
    S-->>QA: ok
  else FAIL (qa_round < 3)
    QA->>S: tw_update_state(FAIL, agent_id=qa-engineer, qa_review="...")
    S->>S: validateTransition ✓ ; recordReview(FAIL) ; qa_round++
    S-->>QA: ok
    QA->>SR: rollback round N+1
    SR->>S: tw_update_state(In_Progress, agent_id=sr-engineer)
    S->>S: validateTransition(qa-engineer,FAIL→sr-engineer,In_Progress) ✓
  else FAIL (qa_round == 3) → Round 4
    QA->>S: tw_update_state(FAIL, agent_id=qa-engineer, qa_review="...")
    S->>S: qa_round = 4 ; prepend "⛔ Round 4: forced rollback to pm"
    S-->>QA: ok
    Note over QA,PM: only (pm, In_Progress) accepted next
    PM->>S: tw_update_state(In_Progress, agent_id=pm)
    S->>S: round-cap override allows ; qa_round = 0
  else MISSING evidence on PASS
    QA->>S: tw_update_state(PASS, agent_id=qa-engineer, completed_tasks=[X])
    S->>S: hasEvidence([X]) → missing=[X]
    S-->>QA: ⛔ MISSING_EVIDENCE: X
  end
```

## Test Surface (handed to qa-engineer T18)

Each row → one `node --test` case:

- `validateTransition`: one accept-case + one reject-case per cell of the matrix (≈ 25 tests). Snapshot the rejection envelope shape.
- Fresh-workspace transitions: `null:null` → each of {pm, researcher} accept; → sr-engineer/architect/qa-engineer reject.
- Self-loop fast path: `(sr-engineer, In_Progress) → (sr-engineer, In_Progress)` accept.
- Round-cap override: `prev_qa_round=4` rejects everything except `(pm, In_Progress)`.
- `computeNewRound`: FAIL increments, PASS resets, PM-entry resets, others hold.
- Round-4 synthesis: enter Round 4 from `qa_round=3` + FAIL → next state's `pending_notes[0]` matches the sentinel string.
- Schema refine (B): `tw_update_state(status=PASS, agent_id="sr-engineer")` rejected by zod before handler.
- `tw_complete_task` (A): missing/wrong agent_id → blocked.
- `hasEvidence` file mode: missing `qa_reports/review_<id>.md` → in missing array.
- `hasEvidence` SQLite mode: no PASS row in reports → in missing array; PASS row present → in present array.
- `recordReview` file mode: appends `## Round N` section, does not truncate prior content.
- `recordReview` SQLite mode: inserts row, unique by (workspace, task_id, created_at).
- Backward-compat: handoff file without `qa_round` field loads as `qa_round=0`.
- 39 existing tests pass unmodified.

## Open Questions

*(none — all design decisions resolved above. Architecture is ready to encode.)*

---

## v3.14.0 Amendment — `visual_round` Sub-Loop + Visual Evidence Gate

This v3.2.0 doc remains authoritative for `qa_round` semantics. v3.9.0 added
`review_round` along the same pattern. v3.14.0 adds a third counter,
`visual_round`, with its own evidence gate. The amendments below extend
(not replace) the v3.2.0 matrix.

### New TypeScript types (v3.14.0)

```ts
// tools/transitions.ts — TransitionRequest gains two optional fields
export interface TransitionRequest {
  prev: TransitionTuple;
  next: TransitionTuple;
  prev_qa_round: number;
  prev_review_round: number;
  prev_visual_round?: number;      // NEW — defaults to 0 (backwards-compat with pre-v3.14 callers)
  next_pending_notes?: ReadonlyArray<string>;  // NEW — inspected for `visual_fail:` token
}

// TransitionRejection.error union extended
type RejectionError =
  | "TRANSITION_REJECTED"
  | "QA_ROUND_EXCEEDED"
  | "REVIEW_ROUND_EXCEEDED"
  | "VISUAL_ROUND_EXCEEDED"   // NEW
  | "AGENT_ID_REQUIRED";

// HandoffState gains visual_round (handoff schema v2 → v3)
export interface HandoffState {
  // ... fields unchanged ...
  qa_round: number;
  review_round: number;
  visual_round: number;  // NEW — defaults to 0; v2→v3 migration stamps the field
}
```

### Round-counter logic (v3.14.0 — `computeNewRound`)

Signature widens to include `prev_visual_round` + `next_pending_notes`:

```ts
export function computeNewRound(
  prev_qa_round: number,
  prev_review_round: number,
  prev_visual_round: number,
  next: TransitionTuple,
  prev?: TransitionTuple,
  next_pending_notes?: ReadonlyArray<string>,
): { qa_round: number; review_round: number; visual_round: number };
```

| Incoming tuple | `pending_notes` carries `visual_fail:` | `visual_round` result |
|---|---|---|
| `(qa-engineer, FAIL)` | yes | `prev + 1` |
| `(qa-engineer, FAIL)` | no (plain test-logic FAIL) | `prev` (unchanged) |
| `(qa-engineer, PASS)` | — | `0` |
| `(pm, In_Progress)` | — | `0` |
| any other | — | `prev` (unchanged) |

Detection: `pending_notes.some(n => n.trim().startsWith("visual_fail:"))`.
Trim-then-startsWith (not substring) so a freeform note "no visual_fail
observed" does NOT trigger the bump.

### Round-cap override (v3.14.0 — `validateTransition`)

```ts
const VISUAL_ROUND_CAP = 6;  // 5 fails then Round 6 lock — off-by-one symmetric to ROUND_CAP=4

if (req.prev_visual_round ?? 0) >= VISUAL_ROUND_CAP) {
  // Only (pm, In_Progress) is accepted
  if (!(req.next.agent === "pm" && req.next.status === "In_Progress")) {
    return rejection(req, "VISUAL_ROUND_EXCEEDED", [{ agent: "pm", status: "In_Progress" }], ...);
  }
}
```

### Visual evidence gate (v3.14.0 — index.ts handler)

Mirrors the existing `MISSING_EVIDENCE` PASS gate. Fires only when
`design/<active_feature>.md` declares `## Visual Baselines`:

```mermaid
sequenceDiagram
    participant QA as qa-engineer
    participant H as index.ts handler
    participant FS as filesystem
    QA->>H: tw_update_state(status=PASS, completed_tasks=[T1, T2])
    H->>FS: hasVisualBaselinesInDesign(ws, active_feature)
    alt design file absent OR no ## Visual Baselines H2
        H->>H: gate dormant; proceed to writeState
        H-->>QA: success (backwards-compat AC-13)
    else baselines declared
        H->>FS: hasVisualEvidenceInFile(ws, [T1, T2])
        alt all tasks have qa_reports/visual_<id>.md
            H-->>QA: success
        else any missing
            H-->>QA: ⛔ VISUAL_EVIDENCE_MISSING: <missing_ids>
        end
    end
```

`hasVisualBaselinesInDesign` runs the regex `/^##\s+Visual\s+Baselines\b/im`
against `design/<sanitised(active_feature)>.md`. Permissive multiline
case-insensitive match; no content parsing of baseline rows.

### Split escalation (v3.14.0, R4a)

At `visual_round >= 3`, sr-engineer may transition
`(sr-engineer, In_Progress) → (pm, In_Progress)` with `pending_notes`
containing the literal token `visual_split_requested:`. This is
*allowed by the standard ALLOWED_TRANSITIONS matrix* — no special
case in `validateTransition`. The convention is operator-side: skill
SOPs name the token; the server treats it like any other pending note.
Round 6+ is mandatory PM-route per `VISUAL_ROUND_EXCEEDED`.

### Pending-notes synthesis (v3.14.0)

`index.ts` injects a sentinel when `visual_round` crosses cap:

```ts
if (new_visual_round === 6 && prev_visual_round === 5) {
  pending.unshift("⛔ Visual Round 6: forced rollback to pm — no further pixel iteration allowed until PM rebudgets scope or threshold.");
}
```

Symmetric to the `qa_round === 4` and `review_round === 4` synthesis lines
from v3.2.0 / v3.9.0 respectively.

### Test surface delta (v3.14.0)

Added in T109:
- `test/visual-evidence-gate.test.mjs` — 13 tests covering AC-5 (gate trigger) + AC-10 (evidence file lookup).
- `test/visual-round-transitions.test.mjs` — 13 tests covering AC-8 (counter semantics + cap) + AC-9 (split escalation) + AC-11 (backwards-compat + token-detection edge cases).
- `test/widget-shape-spec.test.mjs` — 12 tests linting the SOP markdown for AC-1, AC-2, R5, R6 contracts.
- `test/phase-0-5-sop.test.mjs` — 10 tests linting AC-3 (Visual Harness in skill-architect) + AC-4 (Phase 0.5 in skill-sr-engineer).

Existing test files migrated:
- `test/handoff-versioning.test.mjs` — schema_version 2 → 3 assertions.
- `test/handoff-migration.test.mjs` — v0→v3 chain + visual_round=0 defaults.
- `test/schema-versions.test.mjs` — `CURRENT_VERSIONS.handoff: 3`.
- `test/drift-skew.test.mjs` — drift skew sentinel raised to v3.
- `test/qa-flow.test.mjs` — `computeNewRound` 6-arg signature + visual_round in expected returns.
- `test/qa-visual-skill-split.test.mjs` — v3.14.0 contract migrations.
- `test/pixel-perfect-visual-compare.test.mjs` — v3.14.0 4-route + Pixel Diff + multimodal-vision wording migrations.
- `test/skill-evolution-v3.11.test.mjs` — `versions.ts` handoff value updated to 3.

Total: 353 tests, 0 failures (was 303/275 pre-migration).
