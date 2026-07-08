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
| qa-engineer | PASS | (pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress) |
| release-engineer | In_Progress | (pm, In_Progress) |
| release-engineer | PASS | (pm, In_Progress), (researcher, In_Progress) |

**Self-loops on `In_Progress`** for the *same* agent (e.g. sr-engineer doing a multi-step task) are allowed implicitly: if `prev.agent === next.agent && prev.status === "In_Progress" && next.status === "In_Progress"`, skip the table lookup and accept. This avoids forcing agents to ping-pong through other roles for internal progress writes.

**Round-cap override** (highest precedence): if `prev_qa_round >= 4`, the only allowed transition is `(pm, In_Progress)`. All other entries (including the self-loop fast path) are denied with `error: "QA_ROUND_EXCEEDED"`. PM's `(pm, In_Progress)` write must reset `qa_round` to 0 (handled by `computeNewRound`).

**Amend-Resume Edge** (conditional precedence rule, v3.47.0 — backlog C1, `specs/pm-repair-resume-routing-architecture.md`): `(pm, In_Progress) → (code-reviewer, In_Progress)` and `(pm, In_Progress) → (qa-engineer, In_Progress)` are accepted ONLY when the incoming write's `pending_notes` contains an entry that, trimmed, exactly equals `resume_of: <that exact target role>` (literal single space after the colon). These are NOT rows in the static table above — they are evaluated as step 3.5 in `validateTransition`, after the round-cap overrides and the self-loop fast path, before the static-table lookup; the round caps therefore outrank the resume edge. An absent, malformed, or wrong-role marker opens no edge and falls through to the unchanged `TRANSITION_REJECTED` (the `allowed` list remains the static `pm:In_Progress` set — no new error code). The marker is self-attested (trust class `scope_decision_why`): the server checks only marker⟺target consistency; "the role was genuinely stranded" is a PM SOP attestation. Single-use by construction — `pending_notes` are replaced on every write, so no stored flag and no re-arm logic. Mode-agnostic (pure in-memory inputs; identical in file and SQLite/HTTP mode). The Scope Decision Gate and Cut-Approval Gate do not fire on these edges (their predicates require `next.agent ∈ {architect, sr-engineer}`).

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

## v3.16.0 Amendment — Visual Gate Self-Arming + Tiers (visual-fidelity-gate-hardening)

v3.16.0 moves the visual-gate arming signal off "`## Visual Baselines` H2 present" and onto
"design file exists AND `## Mode` ≠ `no-design`", and adds the `VISUAL_BASELINES_REQUIRED` block
for the armed-but-baseline-less case. The PASS-gate ordering becomes a strict two-step
arm-then-evidence sequence: the missing-baselines block (`VISUAL_BASELINES_REQUIRED`) fires FIRST
and is mutually exclusive with `VISUAL_EVIDENCE_MISSING` (reached only when `## Visual Baselines`
is present). Arming is encoded as the exclusion `mode !== "no-design"` (no allow-list), so future
modes auto-arm. A design file with an unparseable `## Mode` fails open (`required:false`).

### Visual Gate Tiers (v3.16.0)

- **Tier A — Geometry assertion (cheap, upstream).** Owner: sr-engineer, screen 1, once. Method:
  number-vs-number compare of `## Layout / Canvas` declared dimensions against the implementation's
  CSS/SCSS/Tailwind literals. No vision model, no headless render, near-free. Build-gate only —
  does NOT touch `visual_round`. Skips silently when no design file or no `## Layout / Canvas`.
- **Tier B — Pixel / fidelity diff (expensive, end-of-cycle).** Owner: qa-visual Phase 1.5, once at
  the end. Method: screenshot + vision-model reasoning per baseline. Drives `visual_round`.
  Unchanged by this feature; now actually fires because the gate self-arms (AC-1).
- **Rationale:** mirrors Figma's `get_metadata` → `get_design_context` two-tier guidance. The early
  cheap check is one-time insurance against the most expensive failure (foundational rework across
  all screens); the expensive diff stays once-at-the-end, preserving the original token-saving
  intent.

### Error-code row (v3.16.0)

| Error code | Trigger | Resolution |
|---|---|---|
| `VISUAL_BASELINES_REQUIRED` (v3.16.0) | `design/<feature>.md` exists with `## Mode` ≠ `no-design` AND `## Visual Baselines` H2 is absent, at `tw_update_state(status=PASS)`. | design-auditor adds the `## Visual Baselines` section (design-auditor SOP §Artifact Schema) before PASS is retried. |

## Scope Decision Gate

> Feature: `server-scope-decision-gate` (v3.30.0 proposed). Spec: `specs/server-scope-decision-gate.md`.
> Closes CDE-OOBE retro finding A0 (the "entered build via the routing chain with no recorded
> scope decision" half only — see Out of Scope below). Adds a server-side transition reject
> `SCOPE_DECISION_REQUIRED` at the `pm → {architect, sr-engineer}` edge, structurally analogous to
> `VISUAL_BASELINES_REQUIRED` but firing at a **different point in the handler** (transition-in, not
> PASS) and on a **different trigger** (entry into build, not exit to PASS). The two gates are
> independent and never interact.

### Affected Files

| File | Change |
|---|---|
| `tools/transitions.ts` | Add `SCOPE_DECISION_REQUIRED` to the `TransitionRejection["error"]` union (handler-side-only, commented like `VISUAL_BASELINES_REQUIRED`). No matrix change. |
| `tools/evidence-file.ts` | New exported `hasScopeDecision(workspacePath, handoffState)`; reuse existing `hasDesignModeRequiringVisual` for arming. |
| `index.ts` | New guard block in the `tw_update_state` handler, placed immediately after the `validateTransition` rejection block (≈ line 711) and before the evidence-record block (≈ line 713). Import `hasScopeDecision`. Extend the `UpdateStateArgs` zod schema with optional `scope_decision` + `scope_decision_why`; thread both into the `storage.writeState({...})` call. |
| `schema/versions.ts` | Bump `CURRENT_VERSIONS.handoff` 3 → 4. |
| `schema/migrations-handoff.ts` | Register handoff v3 → v4 additive no-op migration. |
| `tools/handoff.ts` | Add optional `scope_decision` + `scope_decision_why` to `HandoffState` and `WriteHandoffStateOptions`; parse from frontmatter in `readAndMigrate`; emit into `frontmatterData` in `writeHandoffState` (round-trip through js-yaml). |
| `tools/storage-sqlite.ts` | SQLite parity: `ALTER TABLE handoff_state ADD COLUMN scope_decision TEXT` + `scope_decision_why TEXT` via the existing `addColumnIfMissing` idempotent-migrate pattern; read in `parse()`, write in `writeState`. (HTTP mode only; file mode is the primary target.) |
| `content/constitution.md`, `content/skill-pm.md` | Doc-writer / PM-owned (AC-9), out of architecture scope — listed for the impl touchpoint manifest only. |

### Arming condition and placement (Decision 1)

The gate fires on `tw_update_state` when **all** of the following hold, evaluated against the
**prev** (on-disk) tuple and the **next** (incoming) tuple:

1. `next.agent ∈ {architect, sr-engineer}` AND `next.status === "In_Progress"` (the build-entry edge).
2. `prev.agent === "pm"` AND `prev.status === "In_Progress"` (the only predecessor the matrix routes
   into build from — see the `pm:In_Progress` row, which lists both `architect:In_Progress` and
   `sr-engineer:In_Progress`). Pinning the predecessor is what makes **re-entry/resume safe** (see
   Edge Cases): `architect:In_Progress → sr-engineer:In_Progress` and the self-loop
   `sr-engineer:In_Progress → sr-engineer:In_Progress` both have a non-`pm` predecessor and are
   therefore never gated.
3. `hasDesignModeRequiringVisual(workspace, active_feature).required === true` (design file exists
   AND `## Mode` ≠ `no-design` — identical arm signal to the visual gate; no new scanner).
4. `hasScopeDecision(workspace, prevState) === false` (neither satisfying artifact present).

When all four are true the handler returns the `SCOPE_DECISION_REQUIRED` envelope with
`isError: true` and does **not** write state.

**Decision: the guard lives in `index.ts`, NOT in `transitions.ts`. Recommended and justified.**

| Context | Decision | Consequences |
|---|---|---|
| The gate must read the filesystem (`design/<feature>.md`, `.current/feature-split.md`) and the parsed handoff field `scope_decision`. `validateTransition` in `tools/transitions.ts` is a **pure** function over tuples + round counters (file header: "Pure state-machine logic"; no `fs` import). | Implement as a handler-side guard in `index.ts`, placed after `validateTransition` returns accepted and before the evidence-record block. Add the error code to the `TransitionRejection` union for envelope/type-narrowing consistency, but do **not** call it from `validateTransition`. | Keeps `transitions.ts` pure and unit-testable without fs mocks. Exactly mirrors the precedent set by `VISUAL_BASELINES_REQUIRED`, `VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_REPORT_INCOMPLETE`, `VISUAL_ASSERTIONS_REQUIRED` — all union members emitted handler-side, none produced by `validateTransition` (see the inline comments at transitions.ts L48–67). The matrix stays a clean reachability table; "did the human record a decision" is a side-condition, not a reachability edge. |

The placement is **before** the evidence-record / PASS-evidence blocks because those only fire on a
QA `PASS`/`FAIL` write; the scope gate fires on a build-entry `In_Progress` write, so the two regions
are mutually exclusive at runtime and ordering between them is moot — but putting it directly after
`validateTransition` keeps the "all transition-shaped rejects first, then evidence rejects" reading
order the handler already follows.

### `hasScopeDecision` contract (Decision 2)

```ts
// tools/evidence-file.ts — new exported helper.
// Returns true when EITHER satisfying artifact is present:
//   (a) .current/feature-split.md exists (multi-feature split recorded), OR
//   (b) handoff field scope_decision === "single-feature" (attestation recorded).
// Existence/equality only — never parses file content (mirrors hasEvidenceInFile
// and the "existence is sufficient" convention). Never throws.
export function hasScopeDecision(
  workspacePath: string,
  handoffState: { scope_decision?: string } | null | undefined,
): boolean {
  const splitPath = path.join(workspacePath, ".current", "feature-split.md");
  if (fs.existsSync(splitPath)) return true;
  return handoffState?.scope_decision === "single-feature";
}
```

Note the signature takes the already-parsed `handoffState` (the `prevState` the handler reads at
≈ line 685) rather than re-reading handoff.md — the field is read off the `prev` state because the
attestation must have been recorded by the **preceding** `pm:In_Progress` write. (The PM sets
`scope_decision: single-feature` on its own `tw_update_state` write; that persists to handoff.md;
the build-entry write then reads it back as `prevState.scope_decision`.) This differs deliberately
from `hasDesignModeRequiringVisual`, which re-reads the design file by `(workspacePath, activeFeature)`
because the design file is not part of handoff state.

### Handoff v3 → v4 migration (Decision 3)

Per `docs/schema-versions.md`, exactly two source edits ship the bump:

1. **`schema/versions.ts`** — `CURRENT_VERSIONS.handoff: 3 → 4`.
2. **`schema/migrations-handoff.ts`** — register the adjacent step (the registry enforces
   `to === from + 1`):

```ts
// v3 → v4: add optional scope_decision attestation field (server-scope-decision-gate).
// Additive NO-OP: stamps the version but adds NO default value for scope_decision.
// Absence is meaningful — undefined === "no attestation recorded" === gate may fire.
// Mirrors the v1→v2 / v2→v3 pattern EXCEPT it seeds no field default (those seeded a
// 0 counter; here a defaulted value would be a false attestation, so we add nothing).
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 3,
  to: 4,
  up: (input) => ({ ...input, schema_version: 4 }),
});
```

**Read semantics of absence.** In `tools/handoff.ts:readAndMigrate`, parse with the existing
`asString(...) || undefined` idiom (same as `prd_path`, `blocking_reason`):

```ts
const scopeDecision = asString(frontmatter.scope_decision) || undefined;       // undefined when absent
const scopeDecisionWhy = asString(frontmatter.scope_decision_why) || undefined;
// ...spread conditionally into the state object so the field stays absent when unset:
...(scopeDecision && { scope_decision: scopeDecision }),
...(scopeDecisionWhy && { scope_decision_why: scopeDecisionWhy }),
```

`undefined` flows to `hasScopeDecision`, where `undefined === "single-feature"` is `false` → the
gate is free to fire. No v3 file gains a synthetic attestation on migrate-on-read. The future-version
refuse-loud path (v5 read against a v4 server) is already handled by `runMigrations` throwing on
`current > target` — AC-10(g) is satisfied with no new code.

`tools/handoff.ts:writeHandoffState` emits the fields only when set (the round counters are always
emitted even at 0, but `scope_decision` is a string attestation — emitting an empty string would be
indistinguishable from "not set", so guard the write):

```ts
if (scopeDecision) frontmatterData.scope_decision = scopeDecision;
if (scopeDecisionWhy) frontmatterData.scope_decision_why = scopeDecisionWhy;
```

### Error code wiring + envelope (Decision 4)

`tools/transitions.ts` — extend the union, handler-side-only, commented in the established style:

```ts
| "SCOPE_DECISION_REQUIRED"     // v3.30.0 — emitted by the index.ts tw_update_state guard at the
                                // pm → {architect,sr-engineer}:In_Progress edge when the design is
                                // armed (mode != no-design) but neither .current/feature-split.md
                                // nor handoff scope_decision === "single-feature" is present. NOT
                                // produced by validateTransition (it reads fs + handoff state);
                                // union extension is for handler-side narrowing + envelope
                                // consistency (mirrors VISUAL_BASELINES_REQUIRED).
```

The handler builds the standard `{ error, attempted, allowed, hint }` envelope. Because the
transition itself is *valid* (the matrix would accept it), `allowed` echoes the matrix's allowed-next
set for `pm:In_Progress` so the caller still sees the legal edges; `attempted` carries the build-entry
tuple. The handler emits it the same way the visual gate does — `isError: true`, text
`⛔ SCOPE_DECISION_REQUIRED\n<JSON envelope>`:

```ts
// after the validateTransition rejection block, before the evidence-record block:
if (
  (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
  nextTuple.status === "In_Progress" &&
  prevTuple.agent === "pm" &&
  prevTuple.status === "In_Progress"
) {
  const arm = hasDesignModeRequiringVisual(parsed.workspace_path, parsed.active_feature);
  if (arm.required && !hasScopeDecision(parsed.workspace_path, prevState)) {
    const hint =
      "Scope decision missing. Either: (a) create .current/feature-split.md documenting the " +
      "multi-feature split decision, or (b) set scope_decision: single-feature in this " +
      "tw_update_state call with a why field explaining why this feature is appropriately " +
      "scoped. Gate only fires when design/<feature>.md declares mode != no-design. " +
      "See specs/server-scope-decision-gate.md.";
    const envelope = {
      error: "SCOPE_DECISION_REQUIRED",
      attempted: {
        prev_agent: prevTuple.agent, prev_status: prevTuple.status,
        new_agent: nextTuple.agent, new_status: nextTuple.status,
      },
      allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? [])
        .map((c) => ({ new_agent: c.agent, new_status: c.status })),
      hint,
    };
    return {
      content: [{ type: "text" as const, text: `⛔ SCOPE_DECISION_REQUIRED\n${JSON.stringify(envelope, null, 2)}` }],
      isError: true,
    };
  }
}
```

The `hint` string is the **verbatim** value from the spec's Copy / Strings table (AC-4) — sr-engineer
must copy it character-for-character, including the `(a)`/`(b)` enumeration and the trailing spec
reference. A subtlety the impl must honor: the PM's `scope_decision: single-feature` attestation and
the build-entry write that the gate inspects are **two separate `tw_update_state` calls**. The hint's
phrase "set scope_decision: single-feature in this tw_update_state call" is from the PM's POV — i.e.
the PM records it on the `pm:In_Progress` write; by the time the *build* write is evaluated, the value
is read off `prevState`. The hint text stays verbatim regardless; this note is for the impl's mental
model, not a copy change.

### Edge Cases (Decision 5)

| Case | Behavior | Mechanism |
|---|---|---|
| **Re-entry / resume into build after a decision was recorded** | Never re-blocks. | (a) Once recorded, `scope_decision: single-feature` persists in handoff.md and is read on every subsequent `prevState`, so `hasScopeDecision` stays true. (b) The `architect → sr-engineer` and `sr-engineer → sr-engineer` (self-loop) edges have a non-`pm` predecessor, so condition 2 of the arm check is false — the gate is structurally skipped on every build-internal hop. A FAIL→pm→build re-route re-arms (predecessor is `pm` again), which is correct: a fresh `pm:In_Progress` had the chance to re-attest or split, and the persisted attestation still satisfies the gate. |
| **Non-design workspaces** (`design/<feature>.md` absent OR `## Mode` = `no-design`) | Gate silent, pass-through (AC-5). | `hasDesignModeRequiringVisual().required === false` short-circuits before `hasScopeDecision` is even consulted. Identical fail-open semantics to the visual gate (unparseable Mode → `required:false`). |
| **Non-build transition target** (any `next` other than `{architect,sr-engineer}:In_Progress`) | Gate silent (AC-6). | Condition 1 false; the whole guard block is skipped regardless of design-file presence. |
| **Lite-mode / researcher-direct / in-context paths** | No effect. | These paths emit no `tw_update_state` call into a build role via the routing chain, so the handler hook never runs (documented Out of Scope; not an architectural gap to close here). |
| **Interaction with the visual gate** | Fully independent. | Different trigger (build-entry `In_Progress` vs `PASS`), different handler region (post-`validateTransition` vs PASS-evidence block), different artifact (`feature-split.md`/`scope_decision` vs `## Visual Baselines`/`visual_<id>.md`). They share only the `hasDesignModeRequiringVisual` arm helper. No ordering dependency; both can be armed in the same feature without coupling. |

### Out of Scope (carried from spec, architecturally relevant)

- Does **not** close all of A0 — only the routing-chain-entry half. In-context / lite paths emit no
  transition and are structurally unreachable by a `tw_update_state` guard.
- Does **not** judge size — enforces that a decision was *recorded*, not that it was *correct*.
- Does **not** add a `multi-feature` field — `.current/feature-split.md` existence is the
  multi-feature signal.
- Does **not** validate `feature-split.md` content — existence only (mirrors the visual-baselines
  existence check).

### Error-code row (v3.30.0)

| Error code | Trigger | Resolution |
|---|---|---|
| `SCOPE_DECISION_REQUIRED` (v3.30.0) | `tw_update_state` at the `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge when `design/<feature>.md` declares `## Mode` ≠ `no-design` AND neither `.current/feature-split.md` exists nor handoff `scope_decision === "single-feature"`. | PM creates `.current/feature-split.md` (multi-feature split) OR sets `scope_decision: single-feature` (+ optional `scope_decision_why`) on its `pm:In_Progress` write, then re-hands off to build. |

## v3.40.0 Amendment — Baseline Manifest Gate

v3.40.0 adds the sixth and final visual sub-gate, enforcing that design-backed baseline work has an observable frozen baseline manifest with auditable selection provenance.

### Affected Files

| File | Change |
|---|---|
| `tools/evidence-file.ts` | New exported `checkBaselineManifest()` gate function; reads `design/<sanitised(active_feature)>.md` for `## Source` manifest and `## Baseline Selection Provenance` section. |
| `index.ts` | New guard block in the `tw_update_state` handler after all prior visual gates (provenance, assertions, report schema); wired as the 6th visual sub-gate. Calls `checkBaselineManifest()` before PASS is written. |
| `content/constitution.md` | Version bump 3.39.0 → 3.40.0; §3.1 visual evidence gate documentation updated to list the baseline-manifest gate and both error codes. |
| `content/skill-design-auditor.md` | Step 2c updated to reference mechanical baseline selection (v3.39.0 SOP) and the freeze of node-id list into the Source manifest. |
| `content/skill-qa-visual.md` | Step A.0 updated to reference carrying the frozen manifest verbatim without re-deriving node ids. |

### Gate Logic (v3.40.0)

The gate arms when **both** of the following hold:
1. `design/<active_feature>.md` exists with `## Mode` ≠ `no-design` (identical arm signal to other visual gates).
2. A `## Source` section is present in the design file (indicates baseline-backed work).

When armed:
- **Audited baseline required** — PASS requires ≥1 row in the Source manifest with `status: audited`. If zero audited rows, gate returns error `BASELINE_MANIFEST_MISSING`. The requirement enforces that a real baseline was frozen (not a placeholder or WIP manifest).
- **Multi-surface provenance required** — if ≥2 audited rows exist, gate requires a `## Baseline Selection Provenance` section carrying both a `filter-conditions:` line and an `exclusion-reasons:` line. Missing either line → error `BASELINE_PROVENANCE_INCOMPLETE`. Single-surface (exactly 1 audited row) is exempt from the provenance requirement.

When dormant (no `## Source`, or design file absent, or `## Mode` = `no-design`):
- Gate is silent; PASS proceeds without baseline-manifest validation.

### Error-code row (v3.40.0)

| Error code | Trigger | Resolution |
|---|---|---|
| `BASELINE_MANIFEST_MISSING` (v3.40.0) | `tw_update_state(status=PASS)` when `design/<feature>.md` has `## Mode` ≠ `no-design` AND a `## Source` manifest, but zero rows carry `status: audited`. | design-auditor freezes the baseline node-id list into the manifest via the mechanical-selection process (SOP step 2c), ensuring ≥1 audited row is present before qa-engineer retries PASS. |
| `BASELINE_PROVENANCE_INCOMPLETE` (v3.40.0) | `tw_update_state(status=PASS)` when the design file has ≥2 audited rows but the `## Baseline Selection Provenance` section is missing, incomplete (lacks `filter-conditions:` or `exclusion-reasons:`), or malformed. | design-auditor adds/completes the provenance section with both required fields, documenting the structural filter and exclusion rationale; qa-engineer retries PASS. |

### Design Intent (v3.40.0)

Baseline selection must be deterministic and auditable:
- **Eyeball-picking is forbidden** — the mechanical-filter process is the only valid selection method (SOP step 2c, v3.39.0).
- **Retroactive manifest derivation is forbidden** — the frozen node-id list must not be re-derived or post-hoc-modified by qa-visual; it is copied verbatim from the auditor's freeze step.
- **Multi-surface rationale must be recorded** — when multiple surfaces are chosen, the *why* (filter criteria + exceptions) is as important as the *what* (node ids); single-surface choices are self-evident and exempt.

This gate complements v3.38.0 provenance gate — provenance validates *how* the baseline was captured (Figma export fingerprint + diff metrics); manifest gate validates *that* a baseline was captured and frozen (non-zero audited rows + documented selection rationale).

### Deferred Resources

| Reference | Classification | Reason (PM Resource Audit, spec §Dependencies) |
|---|---|---|
| `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md` (finding A0) | **ignore** | Already in-repo; no fetch needed. Content consumed directly in the spec. |

No HTTP / Figma / Azure DevOps / Jira URLs present in the requirement documents. No `## Visual Baselines`
in this feature's design (mode = `no-design`), so no Visual Harness section applies. No Open Questions.
