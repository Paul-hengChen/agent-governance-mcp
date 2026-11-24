<!-- @architect | feature_id: qa-flow-enforcement | created_at: 2026-05-18 -->

# Architecture: QA-Flow Enforcement (v3.2.0)

Implementation blueprint for `specs/qa-flow-enforcement.md`. Sr-engineer
encodes this verbatim; no judgement calls left open.

> **Status since E435 (handoff schema v17).** The server runs one chain:
> pm → (architect) → qa-engineer (tests) → sr-engineer (build) →
> code-reviewer (judge: PASS / FAIL, `completed_tasks`, `tw_complete_task`).
> The sections *ALLOWED_TRANSITIONS Matrix*, *One Chain (E435)*, *Round
> Counter Semantics* and *Interface Contracts → `tools/transitions.ts`* state
> the current contract. The other v3.2.0 sections below (handler pseudocode,
> sequence diagram, test surface) and the dated amendments are kept as the
> record of how the enforcement was first built; where they show qa-engineer
> judging or a qa round counter, the current-contract sections win, and
> `tools/transitions.ts` / `tools/handoff-orchestrator.ts` are authoritative
> over both.

## Affected Files

**New (2):**
- `tools/transitions.ts` — pure state-machine logic. No I/O.
- `tools/evidence-file.ts` — file-mode evidence read/write. Parallel pattern to `tasks-file.ts`.

**Modified (8):**
- `index.ts` — schema refinement, qa_review arg, handler wiring (transition + evidence + round).
- `tools/handoff.ts` — HandoffState gains a round counter; YAML serializer/parser updated (the counter became `review_round` / `visual_round`; E435 dropped the qa round).
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
storage.ts ──> handoff.ts (round counter fields)
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
  review_round: number; // reader defaults missing frontmatter to 0 (the v3.2.0 qa round was dropped in schema v17, E435)
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
  prev_review_round: number;
}

export interface TransitionRejection {
  error: "TRANSITION_REJECTED" | "REVIEW_ROUND_EXCEEDED" | "AGENT_ID_REQUIRED"; // full union: tools/transitions.ts
  attempted: { prev_agent: string | null; prev_status: string | null; new_agent: string; new_status: string };
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
    _qaRound?: number, // ignored since E435; the slot stays so later positionals do not shift
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
review_round: 2      # Defaults to 0 when missing.
---
```

Reader: `review_round = Number(frontmatter.review_round ?? 0)`. Non-finite → 0.
Writer: always emit the counter (even if 0). Existing handoff files without the field continue to load (default 0). A `qa_round` / `qa_rounds_total` left by a pre-v17 file is dropped by the v16 → v17 migration on first read.

### SQLite migrations

`tools/storage-sqlite.ts` constructor runs `db.exec(SCHEMA)` then attempts an additive migration wrapped in try/catch (idempotent — sqlite errors if column already present):

```sql
-- migration: handoff_state.qa_round (column kept in the DDL; since E435 the
-- server neither reads it nor names it in the upsert, NOT NULL DEFAULT 0 fills it)
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

Derived mirror (see the footnote below) — the authoritative source is `ALLOWED_TRANSITIONS` in `tools/transitions.ts`. Key: `(prev_agent, prev_status)` → set of allowed `(new_agent, new_status)`. `null` denotes fresh workspace. `*` denotes "no constraint on status field for that side".

| prev_agent | prev_status | allowed new (agent, status) |
|---|---|---|
| null | null | (pm, In_Progress), (pm, Blocked), (researcher, In_Progress), (researcher, Blocked), (design-auditor, In_Progress), (design-auditor, Blocked) |
| researcher | In_Progress | (pm, In_Progress), (pm, Blocked), (researcher, Blocked), (design-auditor, In_Progress) |
| researcher | Blocked | (researcher, In_Progress), (pm, In_Progress) |
| design-auditor | In_Progress | (pm, In_Progress), (design-auditor, Blocked) |
| design-auditor | Blocked | (design-auditor, In_Progress), (pm, In_Progress) |
| pm | In_Progress | (architect, In_Progress), (researcher, In_Progress), (design-auditor, In_Progress), (pm, Blocked), (pm, In_Progress), (qa-engineer, In_Progress) |
| pm | Blocked | (pm, In_Progress), (pm, Blocked), (design-auditor, In_Progress) |
| architect | In_Progress | (architect, Blocked), (pm, In_Progress), (qa-engineer, In_Progress) |
| architect | Blocked | (pm, In_Progress), (architect, In_Progress) |
| sr-engineer | In_Progress | (code-reviewer, In_Progress), (sr-engineer, Blocked), (pm, In_Progress), (qa-engineer, In_Progress) |
| sr-engineer | Blocked | (sr-engineer, In_Progress), (pm, In_Progress), (design-auditor, In_Progress) |
| code-reviewer | In_Progress | (code-reviewer, FAIL), (code-reviewer, Blocked), (code-reviewer, PASS) |
| code-reviewer | FAIL | (sr-engineer, In_Progress), (pm, In_Progress), (qa-engineer, In_Progress) |
| code-reviewer | Blocked | (code-reviewer, In_Progress), (pm, In_Progress) |
| code-reviewer | PASS | (pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress), (design-auditor, In_Progress) |
| qa-engineer | In_Progress | (qa-engineer, Blocked), (sr-engineer, In_Progress) |
| qa-engineer | Blocked | (sr-engineer, In_Progress), (qa-engineer, In_Progress), (pm, In_Progress) |
| qa-engineer | FAIL | (sr-engineer, In_Progress), (pm, In_Progress) |
| qa-engineer | PASS | (pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress), (design-auditor, In_Progress) |
| release-engineer | In_Progress | (pm, In_Progress), (release-engineer, Blocked) |
| release-engineer | Blocked | (release-engineer, In_Progress), (pm, In_Progress), (qa-engineer, In_Progress) |
| release-engineer | PASS | (pm, In_Progress), (researcher, In_Progress) |

*(22 keys since E435, which folded the old matrix and the second, opt-in edge table into this one table: `code-reviewer:PASS` added, `qa-engineer:FAIL` / `qa-engineer:PASS` kept as legacy exit keys. Earlier: 21 keys — mechanically re-derived from `ALLOWED_TRANSITIONS` in `tools/transitions.ts`/`dist/tools/transitions.js`, E39+E58. Previously this table carried 16 rows — 12 correct, 4 wrong (`null:null` missing both `design-auditor` entries; `researcher:In_Progress` and `pm:In_Progress` each missing exactly `(design-auditor, In_Progress)`; `sr-engineer:In_Progress` naming `(qa-engineer, In_Progress)` — correct when the table was authored, but silently invalidated at v3.9.0 (`7e81cf7`), which extracted the code-reviewer role and changed the source to `(code-reviewer, In_Progress)` without updating this mirror), and 5 missing entirely (`design-auditor:{In_Progress,Blocked}`, `code-reviewer:{In_Progress,FAIL,Blocked}`) — found by code-reviewer during E37 round 1, 2026-07-27. `scripts/check-transitions-sync.mjs` now pins this table against the compiled source so it cannot silently re-drift.)*

**Self-loops** for the *same* agent are allowed implicitly via two explicit named `(prev, next)` status pairs — NOT a `prev.status === next.status` wildcard: `In_Progress→In_Progress` (e.g. sr-engineer doing a multi-step task; `prev.agent === next.agent && prev.status === "In_Progress" && next.status === "In_Progress"`) and, since E128, `Blocked→Blocked` (`prev.agent === next.agent && prev.status === "Blocked" && next.status === "Blocked"`), letting a role in `Blocked` correct its own malformed record — the gap that stranded release-engineer's self-correcting write during the 2026-09-15 E111 release (`TRANSITION_REJECTED — No edge release-engineer:Blocked -> release-engineer:Blocked`). Either pair matching skips the table lookup and accepts. `PASS→PASS` and `FAIL→FAIL` are deliberately excluded: PASS is terminal by design (a `qa-engineer:PASS→PASS` correction is correctly rejected — see E86), and naming the two pairs explicitly keeps that terminality structurally unreachable by this fast path rather than merely untested. This avoids forcing agents to ping-pong through other roles for internal progress writes.

**Round-cap override** (highest precedence): if `prev_review_round >= 4` (`REVIEW_ROUND_CAP`) or `prev_visual_round >= 6` (`VISUAL_ROUND_CAP`), the only allowed transition is `(pm, In_Progress)`. All other entries (including the self-loop fast path) are denied with `REVIEW_ROUND_EXCEEDED` / `VISUAL_ROUND_EXCEEDED`. PM's `(pm, In_Progress)` write resets both counters to 0 (handled by `computeNewRound`). There is no qa round cap since E435: qa-engineer writes tests and never writes FAIL, so there is nothing for such a cap to count.

**Amend-Resume Edge** (conditional precedence rule, originated v3.47.0 — backlog C1, `specs/pm-repair-resume-routing-architecture.md`; mechanism superseded v3.55.0 — backlog C9, `specs/c9-protocol-fields.md`/`specs/c9-protocol-fields-architecture.md`, AC-4; narrowed E435): `(pm, In_Progress) → (code-reviewer, In_Progress)` is accepted ONLY when the incoming `tw_update_state` write carries the **structured** top-level `resume_of` field (`z.enum(["code-reviewer"]).optional()` in `tools/registry.ts`) naming code-reviewer. The orchestrator threads it into `validateTransition` as `TransitionRequest.next_resume_of`. This field is write-scoped: it is emitted to `handoff.md` only on the write that sets it and is never carried forward — `writeHandoffState` deliberately does not join it to the existing-state preserve read, so a later write that omits it drops it. SQLite mode never persists it at all (DR-5). Nothing reads it back off state; `validateTransition` sees only the incoming write's value. There is therefore nothing to re-arm or clear between writes. `(pm, In_Progress) → (qa-engineer, In_Progress)` is an ordinary table edge since E435 (qa-engineer is the build entry), so it needs no `resume_of`; a `resume_of` value naming qa-engineer is rejected at the tool boundary, and an on-disk one is dropped by the parser.

This **replaces** the original v3.47.0 mechanism, which gated the resume edges on a `pending_notes` entry that, trimmed, exactly equalled `resume_of: <role>` (a literal string-grep convention). The former `next_pending_notes` substring grep was removed with no fallback — legacy pending_notes tokens are inert (DR-2/DR-6). A `pending_notes` line reading `resume_of: code-reviewer` today opens no edge; only the structured field does.

The resume edge is NOT a row in the static table above — it is evaluated as step 3.5 in `validateTransition`, after the round-cap overrides, the hop-cap override (`HOP_CAP_EXCEEDED`), the sr-return cap and the self-loop fast path, before the static-table lookup; the round caps and the hop cap therefore both outrank the resume edge. An absent or wrong field value opens no edge and falls through to `TRANSITION_REJECTED`, whose envelope appends the conditional entry `{ new_agent: "code-reviewer", new_status: "In_Progress", requires: { resume_of: "code-reviewer" } }` to the static `pm:In_Progress` set and names the field in `hint` (no new error code). The field is self-attested (trust class `scope_decision_why`): the server checks only field⟺target consistency; "the role was genuinely stranded" is a PM SOP attestation. Mode-agnostic (pure in-memory inputs; identical in file and SQLite/HTTP mode). The build-entry gates (Scope Decision, Cut-Approval, External-Refs, Source-Credibility) arm on `(pm, In_Progress) → {architect, qa-engineer}:In_Progress`, so every pm → qa-engineer write needs an approved cut, including a qa-engineer resume after a pm amendment (human ruling, open question 1 of the E431 blueprint); the code-reviewer resume edge stays exempt.

## One Chain (E435)

Until E435 the server ran two chains: the matrix above (pm → sr-engineer → code-reviewer → qa-engineer, qa-engineer judging) and a second table of opened and closed edges for features that opted into the test-first chain. E435 folded the two into the one 22-key table above, which equals, entry for entry, the effective successor set the test-first chain had. Every feature now runs pm → (architect) → qa-engineer (writes the scenario tests, or records that none are needed) → sr-engineer (builds until they pass) → code-reviewer (judges and writes PASS or FAIL). There is no per-feature path field: handoff schema v17 drops it on first read (`schema/migrations-handoff.ts`, step v16 → v17), and `tw_update_state` no longer accepts it. `qa-engineer:In_Progress` has no edge to code-reviewer, so the tests qa-engineer writes always reach code-reviewer through sr-engineer.

`qa-engineer:FAIL` and `qa-engineer:PASS` stay as table keys only so a handoff written before E435 can still leave them; no edge reaches either since E435.

**Removed steps and the in-flight hint.** Five steps the earlier chain allowed are rejected with `TRANSITION_REJECTED`; the rejection's top-level `hint` carries a step-specific sentence followed by `MIGRATION_HINT` (` If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.`). The steps are `REMOVED_OLD_PATH_STEPS` in `tools/transitions.ts`, looked up by `oldPathStepHint(prev, next)`:

| step | hint (before `MIGRATION_HINT`) |
|---|---|
| `(pm, In_Progress) → (sr-engineer, In_Progress)` | the build entry is qa-engineer |
| `(architect, In_Progress) → (sr-engineer, In_Progress)` | the build entry is qa-engineer |
| `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` | code-reviewer closes the feature with PASS or FAIL |
| any → `(qa-engineer, PASS)` | qa-engineer never writes PASS or FAIL; code-reviewer is the judge |
| any → `(qa-engineer, FAIL)` | qa-engineer never writes PASS or FAIL; code-reviewer is the judge |

No new envelope field carries the hint: it is part of `hint`.

### sr-return cap

`(sr-engineer, In_Progress) → (qa-engineer, In_Progress)` is the sr-engineer return: a test contradicts a scenario or collides with existing code, and qa-engineer revisits it. `sr_return_count` counts these returns per feature (see *Round Counter Semantics*). When the persisted `sr_return_count ≥ 2` (`SR_RETURN_CAP`), the third return is rejected with `SR_RETURN_CAP_EXCEEDED`, `allowed: [(pm, In_Progress)]`, and a hint that names the count and routes to pm for a human ruling on the scenario. The cap is edge-specific: unlike the round caps it does not collapse the matrix, and every other write on the feature (for example sr-engineer → code-reviewer) is evaluated normally. It runs after the round caps and the hop cap, so a feature that has also reached one of those reports that code first. An `active_feature` change bypasses it. No cap-crossing pending note is added. In SQLite/HTTP mode `sr_return_count` is not persisted, so the cap never fires there.

### Judge rule

code-reviewer is the judge on every feature (`JUDGE_ROLE = "code-reviewer"` in `tools/transitions.ts`).

- **PASS**: only `agent_id: "code-reviewer"` may write `status: "PASS"` (from `code-reviewer:In_Progress`). Any other role's PASS is rejected at the tool boundary with `PASS_IDENTITY_REFINE_MESSAGE` (`status="PASS" requires agent_id="code-reviewer"`); a qa-engineer PASS gets `QA_PASS_REFINE_MESSAGE`, which adds that qa-engineer writes tests and never writes PASS, plus `MIGRATION_HINT`. `review_verdict: "APPROVED"` is consistent with a code-reviewer PASS.
- **completed_tasks**: only code-reviewer may grow it. A non-empty `completed_tasks` from any other role, qa-engineer included, is rejected with `NON_JUDGE_COMPLETED_TASKS_REJECTED`. A code-reviewer FAIL with `review_task_ids` removes those ids from `completed_tasks`.
- **tw_complete_task**: reserved for code-reviewer (`requireJudge(agent_id, "tw_complete_task")`); a qa-engineer call gets `MIGRATION_HINT` appended to the rejection.
- **Evidence**: the judge's PASS/FAIL `qa_review` is recorded to `qa_reports/review_<id>.md` (file mode) or `reports` rows (SQLite); the `PASS_MISSING_EVIDENCE` step rejects a PASS whose `completed_tasks` lack that evidence with `MISSING_EVIDENCE`. Report sections signed by qa-engineer before E435 still count as evidence (`REPORT_SIGNERS` in `tools/evidence-file.ts`).

## Round Counter Semantics

Since E435 there is no qa round: qa-engineer never writes FAIL, so handoff schema v17 drops `qa_round` and `qa_rounds_total`, `computeNewRound` neither takes nor returns them, and no Round-4 qa sentinel is synthesised. The counters that remain:

| event | counter | effect |
|---|---|---|
| next = `(code-reviewer, FAIL)` | `review_round`, `review_rounds_total` | + 1 |
| next = `(code-reviewer, PASS)` | `review_round` | → 0 (the judge's PASS closes the review cycle) |
| next = `(pm, In_Progress)` | `review_round`, `visual_round`, `sr_return_count` | → 0 |
| prev `(sr-engineer, In_Progress)` → next `(qa-engineer, In_Progress)` | `sr_return_count` | + 1 (`computeSrReturnCount`); the third return is rejected by the sr-return cap |
| role change (`next.agent !== prev.agent`) | `hop_count` | + 1 |
| `active_feature` change | `hop_count`, `*_rounds_total`, `sr_return_count` | 0 base |
| any other write | all | carried |

`review_round` therefore counts every code-reviewer FAIL until pm re-entry or the code-reviewer PASS. The `visual_round` branches (see the v3.14.0 amendment below) still key on a `(qa-engineer, FAIL)` write that no edge reaches since E435; they are dormant, and the visual family is owned by E420. `sr_return_count` is persisted in the handoff (file mode only; absence reads as 0) and has no `*_total` mirror.

## Interface Contracts

### `tools/transitions.ts`

```ts
export const ALLOWED_TRANSITIONS: Map<string, ReadonlyArray<{ agent: AgentName; status: StatusName }>>;
// keyed by `${prev_agent ?? "null"}:${prev_status ?? "null"}`

export function validateTransition(req: TransitionRequest): TransitionRejection | null;
// returns null on accept; rejection envelope otherwise.

export function computeNewRound(
  prev_review_round: number,
  prev_visual_round: number,
  next: TransitionTuple,
  prev?: TransitionTuple,
  next_pending_notes?: ReadonlyArray<string>,
  prev_hop_count?: number,
  feature_changed?: boolean,
  prev_review_rounds_total?: number,
  prev_visual_rounds_total?: number,
): { review_round: number; visual_round: number; hop_count: number;
     review_rounds_total: number; visual_rounds_total: number };

export const JUDGE_ROLE = "code-reviewer";
export function requireJudge(agentId: string | undefined, toolName: string): { ok: true } | { ok: false; message: string };
// used as defense-in-depth alongside the zod refinement and by tw_complete_task.
```

### `tools/storage.ts` additions

```ts
recordReview(
  workspacePath: string,
  taskIds: string[],   // each gets its own evidence record
  status: "PASS" | "FAIL",
  reviewer: string,    // the judge, "code-reviewer" since E435
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

### `tw_update_state` arguments (`tools/registry.ts`)

The v3.2.0 `UpdateStateArgs` grew into the zod schema in `tools/registry.ts`; the parts this doc governs:

- `status: z.enum(["In_Progress", "PASS", "FAIL", "Blocked"])`, `agent_id` optional (validated against `ALLOWED_TRANSITIONS` by the handler, not by zod).
- `qa_review`: review notes, recorded as evidence when `agent_id` is the judge (`"code-reviewer"`) and `status ∈ {PASS, FAIL}`.
- `resume_of: z.enum(["code-reviewer"])` (see *Amend-Resume Edge*).
- PASS refine: `status === "PASS"` requires `agent_id === "code-reviewer"`; the message is `QA_PASS_REFINE_MESSAGE` for a qa-engineer PASS, `PASS_IDENTITY_REFINE_MESSAGE` otherwise.

`tw_complete_task` takes `agent_id` too; the handler, not the schema, enforces it (symmetric error UX).

### Handler flow — tw_update_state

`handleUpdateState` in `tools/handoff-orchestrator.ts`: schema parse (including the PASS refine) → pre-flight guard → `requireJudge` defence in depth on a PASS write → the 17-step `UPDATE_STATE_GATE_PIPELINE`. Step 1 (`TRANSITION_VALIDATION`) calls `validateTransition` with the persisted `review_round`, `visual_round`, `hop_count` and `sr_return_count`; the evidence steps (`QA_REVIEW_RECORD` before `PASS_MISSING_EVIDENCE`) record the judge's `qa_review` first so the PASS gate sees it. After the pipeline, `computeNewRound` and `computeSrReturnCount` produce the next counters, a `review_round` / `visual_round` cap-crossing write gets its Round sentinel prepended to `pending_notes`, and the state is published atomically. Step order is asserted by `test/e35-pipeline-order.test.mjs`; gate metadata lives in `gates/registry.ts`.

### Handler flow — tw_complete_task

```ts
// tools/tasks.ts — handleCompleteTask
const parsed = CompleteTaskArgs.parse(args);
enforcePreFlight(parsed.workspace_path, "tw_complete_task");
const judge = requireJudge(parsed.agent_id, "tw_complete_task");
if (!judge.ok) return errorContent(judge.message);  // ALL completes gated, not just PASS-time
```

## Sequence Diagram

```mermaid
sequenceDiagram
  actor H as Human
  participant PM
  participant QA as Qa-engineer
  participant SR as Sr-engineer
  participant CR as Code-reviewer
  participant S as Server

  H->>PM: requirement
  PM->>S: tw_update_state(In_Progress, agent_id=pm, cut_approved, scope_decision)
  S->>S: validateTransition(null→pm,In_Progress) ✓
  S-->>PM: ok

  PM->>QA: cut approved (via architect when complex)
  QA->>S: tw_update_state(In_Progress, agent_id=qa-engineer)
  S->>S: validateTransition(pm,In_Progress→qa-engineer,In_Progress) ✓ ; build-entry gates
  S-->>QA: ok

  QA->>SR: scenario tests written (red)
  SR->>S: tw_update_state(In_Progress, agent_id=sr-engineer)
  S->>S: validateTransition(qa-engineer,In_Progress→sr-engineer,In_Progress) ✓
  S-->>SR: ok

  opt a test contradicts a scenario (sr_return_count < 2)
    SR->>S: tw_update_state(In_Progress, agent_id=qa-engineer)
    S->>S: sr_return_count++
  end

  SR->>CR: ready for review
  CR->>S: tw_update_state(In_Progress, agent_id=code-reviewer)
  S->>S: validateTransition(sr-engineer,In_Progress→code-reviewer,In_Progress) ✓
  S-->>CR: ok

  alt PASS
    CR->>S: tw_update_state(PASS, agent_id=code-reviewer, completed_tasks=[...], qa_review="...")
    S->>S: refine + transition ✓ ; recordReview(PASS) ; hasEvidence([...]) ✓ ; review_round = 0
    S-->>CR: ok
  else FAIL (review_round < 3)
    CR->>S: tw_update_state(FAIL, agent_id=code-reviewer, review_task_ids=[...], qa_review="...")
    S->>S: recordReview(FAIL) ; review_round++
    S-->>CR: ok
    SR->>S: tw_update_state(In_Progress, agent_id=sr-engineer)
    S->>S: validateTransition(code-reviewer,FAIL→sr-engineer,In_Progress) ✓
  else FAIL (review_round == 3) → Round 4
    CR->>S: tw_update_state(FAIL, agent_id=code-reviewer, ...)
    S->>S: review_round = 4 ; prepend the Round 4 sentinel
    Note over CR,PM: only (pm, In_Progress) accepted next
    PM->>S: tw_update_state(In_Progress, agent_id=pm)
    S->>S: round-cap override allows ; review_round = 0
  else MISSING evidence on PASS
    CR->>S: tw_update_state(PASS, agent_id=code-reviewer, completed_tasks=[X])
    S->>S: hasEvidence([X]) → missing=[X]
    S-->>CR: ⛔ MISSING_EVIDENCE: X
  end
```

## Test Surface

The v3.2.0 list handed to qa-engineer (T18) grew with every amendment; the current suites are `test/qa-flow.test.mjs` (matrix, round counters, judge rule, evidence), `test/e431-test-first-server-path.test.mjs` (one 22-key table and its doc mirror), `test/e151-resume-of-rejection-hint.test.mjs` (Amend-Resume envelope) and `scripts/check-transitions-sync.mjs` (the matrix mirror, run on `postbuild`). What they cover:

- `validateTransition`: accept and reject per matrix cell; rejection envelope shape (`attempted`, `allowed`, `hint`).
- Self-loop fast path: `In_Progress→In_Progress` and `Blocked→Blocked` accept; `PASS→PASS`, `FAIL→FAIL` reject.
- Round-cap and hop-cap overrides: only `(pm, In_Progress)` accepted past the cap; sr-return cap on the return edge only.
- Removed old-path steps: `TRANSITION_REJECTED` with the step hint plus `MIGRATION_HINT`.
- `computeNewRound`: code-reviewer FAIL increments `review_round`, code-reviewer PASS and pm re-entry reset it, others hold.
- PASS refine: a non-code-reviewer PASS is rejected by zod before the handler.
- `tw_complete_task`: missing or non-judge `agent_id` → blocked.
- `hasEvidence` / `recordReview` in file and SQLite mode.
- Backward-compat: a pre-v17 handoff loads, and the v16 → v17 migration drops its retired fields.

## Open Questions

*(none — all design decisions resolved above. Architecture is ready to encode.)*

---

## v3.14.0 Amendment — `visual_round` Sub-Loop + Visual Evidence Gate

*E435 note: the qa round this amendment builds on was removed in E435 (see
Round Counter Semantics above); the snippets below keep their v3.14.0 shape as a
record. Its `(qa-engineer, FAIL)` / `(qa-engineer, PASS)` visual branches are
dormant since no edge reaches those states.* v3.2.0 introduced the first round
counter; v3.9.0 added `review_round` along the same pattern. v3.14.0 adds a third counter,
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

Symmetric to the `review_round === 4` synthesis line from v3.9.0 (the
v3.2.0 qa-round line was removed in E435).

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
> Closes the prior visual rollout retro finding A0 (the "entered build via the routing chain with no recorded
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
| `BASELINE_MANIFEST_MISSING` (v3.40.0) | `tw_update_state(status=PASS)` when `design/<feature>.md` has `## Mode` ≠ `no-design` AND a `## Source` manifest, but zero rows carry `status: audited`. | design-auditor freezes the baseline node-id list into the manifest via the mechanical-selection process (SOP step 2c), ensuring ≥1 audited row is present before code-reviewer retries PASS. |
| `BASELINE_PROVENANCE_INCOMPLETE` (v3.40.0) | `tw_update_state(status=PASS)` when the design file has ≥2 audited rows but the `## Baseline Selection Provenance` section is missing, incomplete (lacks `filter-conditions:` or `exclusion-reasons:`), or malformed. | design-auditor adds/completes the provenance section with both required fields, documenting the structural filter and exclusion rationale; code-reviewer retries PASS. |

### Design Intent (v3.40.0)

Baseline selection must be deterministic and auditable:
- **Eyeball-picking is forbidden** — the mechanical-filter process is the only valid selection method (SOP step 2c, v3.39.0).
- **Retroactive manifest derivation is forbidden** — the frozen node-id list must not be re-derived or post-hoc-modified by qa-visual; it is copied verbatim from the auditor's freeze step.
- **Multi-surface rationale must be recorded** — when multiple surfaces are chosen, the *why* (filter criteria + exceptions) is as important as the *what* (node ids); single-surface choices are self-evident and exempt.

This gate complements v3.38.0 provenance gate — provenance validates *how* the baseline was captured (Figma export fingerprint + diff metrics); manifest gate validates *that* a baseline was captured and frozen (non-zero audited rows + documented selection rationale).

### Deferred Resources

| Reference | Classification | Reason (PM Resource Audit, spec §Dependencies) |
|---|---|---|
| `research/visual-fidelity-retrospective-2026-06-05.md` (finding A0) | **ignore** | Already in-repo; no fetch needed. Content consumed directly in the spec. |

No HTTP / Figma / Azure DevOps / Jira URLs present in the requirement documents. No `## Visual Baselines`
in this feature's design (mode = `no-design`), so no Visual Harness section applies. No Open Questions.
