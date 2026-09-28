<!-- @architect | feature_id: code-reviewer-role-extraction | created_at: 2026-05-28 | spec_basis: specs/code-reviewer-role-extraction.md -->

# Code-Reviewer Role Extraction — Architecture (v3.9.0)

> **PARTIALLY SUPERSEDED (2026-07-16, E32 c16 amendment):** this document describes the
> APPROVED handoff persisting review-scope ids into `completed_tasks` (the original manifest
> shape). That contract was amended by backlog E32 — review scope now travels ONLY in the
> transient `review_task_ids` field, and any `agent_id=qa-engineer` write growing
> `completed_tasks` without per-id QA evidence is rejected. Authoritative text:
> `specs/c16-c10-role-boundary.md` (Amendment section) + `content/skill-code-reviewer.md`.

Blueprint for sr-engineer. Maps the 12 ACs in `specs/code-reviewer-role-extraction.md` onto exact files, function signatures, and migration semantics.

## Affected Files

### Create
- `content/skill-code-reviewer.md` — role SOP (T58).
- `prompts/code-reviewer.ts` — prompt builder mirroring `prompts/qa-engineer.ts` (T59).
- `schema/migrations-handoff-v1-v2.ts` — new v1→v2 step. (Alternative: inline registration inside existing `schema/migrations-handoff.ts` — see Decision A below.)

### Modify
- `tools/transitions.ts` — extend `AgentName` union, add edges, add `REVIEW_ROUND_CAP` + `REVIEW_ROUND_EXCEEDED` + `prev_review_round`, extend `computeNewRound` (T56).
- `tools/evidence-file.ts` — add `recordCodeReviewInFile` + `hasCodeReviewEvidenceInFile` (T64).
- `tools/storage.ts` — extend `HandoffStorage` interface with `recordCodeReview` + `hasCodeReviewEvidence`; extend `HandoffState` with `review_round: number`; thread `reviewRound` through `writeState` (T57, T64).
- `tools/storage-sqlite.ts` — `SCHEMA` constant gains `code_review_reports` table; constructor adds idempotent `ALTER TABLE handoff_state ADD COLUMN review_round`; new prepared statements; `parse`/`writeState`/`recordReview`/`hasEvidence` parallels for code-review (T57, T64).
- `tools/handoff.ts` — `HandoffState` interface adds `review_round: number`; `parseHandoff` reads it (default 0); `writeHandoffState` writes it to frontmatter; stderr warning emitted from `readAndMigrate` when v1→v2 ran AND `last_agent=sr-engineer, status=In_Progress` (T57).
- `schema/versions.ts` — `CURRENT_VERSIONS.handoff: 1 → 2`; `CURRENT_VERSIONS.sqlite: 1 → 2` (T57).
- `schema/migrations-handoff.ts` — register v1→v2 (Decision A inline).
- `schema/migrations-sqlite.ts` — add v1→v2 step adding `review_round` column + creating `code_review_reports` table (T57).
- `tools/role.ts` — `ROLE_SKILL_MAP` gains `"code-reviewer": "skill-code-reviewer.md"`; `RoleName` union widens automatically (T59).
- `index.ts` — register `code-reviewer` prompt; widen `tw_switch_role` zod enum; widen `agent_id` validation (currently any string — no change needed but verify); add new evidence-gate block after the existing PASS evidence gate (T56, T59, T64).
- `content/constitution.md` — bump v3.8.3 → v3.9.0; §3.1 + §4 amendments (T60).
- `content/skill-sr-engineer.md` — handoff line `next_role: qa-engineer` → `next_role: code-reviewer` (T61).
- `content/skill-qa-engineer.md` — add Scope clause (T62).
- `content/skill-coordinator.md` — Routing Table row + chain diagram refresh (T63).
- `content/skill-coordinator-lite.md` — exclusion note (T63).
- `package.json` — `version: 3.8.3 → 3.9.0` (T66).
- `CHANGELOG.md` — `[3.9.0]` entry (T66).
- `README.md` — v3.9.0 section after existing v3.8.3 block (T66).
- `bin/agent-governance-context.mjs` — **NO CHANGE.** The hook already embeds `handoff.md` verbatim (line 82, `readSafe(handoffPath)`); once `writeHandoffState` emits `review_round: N` to frontmatter, the injected YAML carries it automatically. T65 collapses to a verification step (boot with a v2 handoff fixture, grep `review_round` from emitted additionalContext payload). **See Decision D.**

## Data Structures

### `HandoffState` (TypeScript, `tools/handoff.ts:17`)

```ts
export interface HandoffState {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason?: string;
  last_agent?: string;
  completed_tasks: string[];
  pending_notes: string[];
  qa_round: number;
  // NEW: incremented on (code-reviewer, FAIL), reset on PM re-entry or on
  // handoff (code-reviewer, In_Progress) → (qa-engineer, In_Progress).
  // Round-cap override (>= 4) blocks all transitions except (pm, In_Progress).
  // Backward-compat: parser defaults missing field to 0.
  review_round: number;
  prd_path?: string;
}
```

### `AgentName` union (`tools/transitions.ts:6`)

```ts
export type AgentName =
  | "pm"
  | "researcher"
  | "design-auditor"
  | "architect"
  | "sr-engineer"
  | "code-reviewer"
  | "qa-engineer";
```

Ordering chosen to mirror the routing chain reading left-to-right.

### `TransitionRequest` (`tools/transitions.ts:26`)

Extend with `prev_review_round: number`. The existing `prev_qa_round` stays; both are checked independently against their respective caps.

```ts
export interface TransitionRequest {
  prev: TransitionTuple;
  next: TransitionTuple;
  prev_qa_round: number;
  prev_review_round: number;  // NEW
}
```

### `TransitionRejection.error` (`tools/transitions.ts:33`)

Widen the union:

```ts
error: "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "REVIEW_ROUND_EXCEEDED" | "AGENT_ID_REQUIRED";
```

### Allowed-transitions table additions (`tools/transitions.ts:69`)

The table mutates exactly as PM spec AC-2 mandates. Concrete keys:

| key (prev) | new allowed-next set |
|---|---|
| `sr-engineer:In_Progress` | `[{code-reviewer, In_Progress}, {sr-engineer, Blocked}, {pm, In_Progress}]` (remove the old `{qa-engineer, In_Progress}` entry) |
| `code-reviewer:In_Progress` (NEW) | `[{code-reviewer, FAIL}, {code-reviewer, Blocked}, {qa-engineer, In_Progress}]` |
| `code-reviewer:FAIL` (NEW) | `[{sr-engineer, In_Progress}, {pm, In_Progress}]` |
| `code-reviewer:Blocked` (NEW) | `[{code-reviewer, In_Progress}, {pm, In_Progress}]` |

The self-loop fast path (`code-reviewer:In_Progress → code-reviewer:In_Progress`) is covered by the generic same-agent shortcut at `tools/transitions.ts:213-221` — no extra row needed.

### `REVIEW_ROUND_CAP` constant (`tools/transitions.ts`)

```ts
const REVIEW_ROUND_CAP = 4;  // same as ROUND_CAP; first 3 FAILs allowed, Round 4 forces PM
```

Exported alongside `ROUND_CAP_EXPORTED` for tests.

### SQLite schema delta (`tools/storage-sqlite.ts`)

```sql
CREATE TABLE IF NOT EXISTS code_review_reports (
  workspace_path TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  verdict        TEXT NOT NULL CHECK (verdict IN ('APPROVED', 'CHANGES_REQUESTED')),
  reviewer       TEXT NOT NULL,
  notes          TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (workspace_path, task_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_code_review_reports_ws_task
  ON code_review_reports (workspace_path, task_id, verdict);
```

Verdict-column values use the PM-spec authored strings (`APPROVED` / `CHANGES_REQUESTED`) rather than reusing the qa table's `PASS` / `FAIL` — the qa CHECK constraint would have made re-use awkward and the field semantic is genuinely different (qa.PASS gates task completion; code-review.APPROVED gates handoff). Separate table also keeps the qa evidence gate (`index.ts:619-627`) functionally unchanged.

Also: `handoff_state` gains a `review_round INTEGER NOT NULL DEFAULT 0` column via the migration step.

### `completed_tasks` semantic overload (deliberate)

PM spec AC-8 mandates `review_reports/review_<task-id>.md` per-task granularity. The architecture re-uses the existing `completed_tasks` field on `tw_update_state` calls as the "review-scope manifest" — i.e. code-reviewer passes `completed_tasks: ["T56", "T57"]` on its handoff to qa-engineer, declaring which task ids it just reviewed. The evidence gate iterates this list checking per-id files exist. This is coherent with how qa-engineer already uses the same field (qa passes `completed_tasks` on PASS to declare which tasks the verdict applies to). The field does NOT autonomously trigger `tw_complete_task`; that flip stays qa-engineer-exclusive per constitution §3.1.

## Interface Contracts

### `tools/transitions.ts` — exported additions

```ts
// NEW exports
export const REVIEW_ROUND_CAP_EXPORTED: number; // = 4

// CHANGED signature
export function computeNewRound(
  prev_qa_round: number,
  prev_review_round: number,  // NEW
  next: TransitionTuple,
): { qa_round: number; review_round: number };  // return shape now an object

export function validateTransition(req: TransitionRequest): TransitionRejection | null;
// (signature unchanged; TransitionRequest body widened)
```

Semantics for `computeNewRound`:

| next tuple | qa_round | review_round |
|---|---|---|
| `(qa-engineer, FAIL)` | prev_qa + 1 | unchanged |
| `(qa-engineer, PASS)` | 0 | 0 |
| `(code-reviewer, FAIL)` | unchanged | prev_review + 1 |
| `(qa-engineer, In_Progress)` from prev `(code-reviewer, In_Progress)` | unchanged | 0 |
| `(pm, In_Progress)` | 0 | 0 |
| anything else | unchanged | unchanged |

Caller in `index.ts` updates from `const new_qa_round = computeNewRound(...)` to destructuring `const { qa_round, review_round } = computeNewRound(...)`.

### `tools/evidence-file.ts` — new exports

```ts
export async function recordCodeReviewInFile(
  workspacePath: string,
  taskIds: string[],
  verdict: "APPROVED" | "CHANGES_REQUESTED",
  reviewer: string,
  notes: string,
): Promise<void>;

export function hasCodeReviewEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] };
```

Directory: `<workspace>/review_reports/`. File: `review_<safe-task-id>.md`. Same sanitisation regex (`[^A-Za-z0-9._-]`) as the qa path.

### `tools/storage.ts` — `HandoffStorage` interface additions

```ts
export interface HandoffStorage {
  // ... existing members unchanged except:
  writeState(
    workspacePath: string,
    activeFeature: string,
    status: string,
    completedTasks: string[],
    pendingNotes: string[],
    blockingReason?: string,
    lastAgent?: string,
    qaRound?: number,
    prdPath?: string,
    reviewRound?: number,  // NEW — trailing optional, no caller break
  ): Promise<string>;

  // NEW members
  recordCodeReview(
    workspacePath: string,
    taskIds: string[],
    verdict: "APPROVED" | "CHANGES_REQUESTED",
    reviewer: string,
    notes: string,
  ): Promise<void>;
  hasCodeReviewEvidence(
    workspacePath: string,
    taskIds: string[],
  ): Promise<EvidenceCheck>;
}
```

`FileHandoffStorage` delegates the new methods to the file-mode helpers. `SqliteHandoffStorage` delegates to a new prepared statement set on `code_review_reports` mirroring the qa pair.

### `tools/handoff.ts` — signature delta

```ts
export async function writeHandoffState(
  workspacePath: string,
  activeFeature: string,
  status: string,
  completedTasks: string[],
  pendingNotes: string[],
  blockingReason?: string,
  lastAgent?: string,
  qaRound?: number,
  prdPath?: string,
  reviewRound?: number,  // NEW — trailing optional
): Promise<string>;
```

Frontmatter emission gains:

```ts
const normalisedReviewRound =
  Number.isFinite(reviewRound) && (reviewRound as number) >= 0
    ? Math.floor(reviewRound as number)
    : 0;
frontmatterData.review_round = normalisedReviewRound;
```

`parseHandoff` adds:

```ts
const reviewRoundRaw = Number(frontmatter.review_round);
const review_round =
  Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0 ? Math.floor(reviewRoundRaw) : 0;
```

Stderr warning emission (one-shot, gated on `migration.applied.includes(2)` AND `state.last_agent === "sr-engineer" && state.status === "In_Progress"`):

```ts
if (migration.applied.includes(2) && state.last_agent === "sr-engineer" && state.status === "In_Progress") {
  process.stderr.write(
    "[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — " +
      "next transition to qa-engineer will be rejected. " +
      "Manually re-route to code-reviewer or roll back to pm.\n",
  );
}
```

Placement: inside `readAndMigrate`, after the state object is fully assembled, before `return { state, migrationApplied }`. Pure-function discipline preserved by keeping the migration `up()` callback itself side-effect-free; the I/O lives in the caller.

### `index.ts` — new evidence gate block

Inserted **immediately after** the existing PASS evidence gate at L619-627, **before** the `computeNewRound` call at L633. The block fires on the specific transition `(code-reviewer:In_Progress) → (qa-engineer:In_Progress)`. Code shape:

```ts
// Code-reviewer evidence gate. Mirrors the PASS gate above for the
// sr ↔ code-reviewer → qa handoff. Only fires when the previous tuple
// is (code-reviewer, In_Progress) AND the next tuple hands off to qa.
if (
  prevTuple.agent === "code-reviewer" &&
  prevTuple.status === "In_Progress" &&
  nextTuple.agent === "qa-engineer" &&
  nextTuple.status === "In_Progress" &&
  parsed.completed_tasks.length > 0
) {
  const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, parsed.completed_tasks);
  if (ev.missing.length > 0) {
    return {
      content: [{
        type: "text",
        text:
          `⛔ MISSING_REVIEW_EVIDENCE: ${ev.missing.join(", ")}. ` +
          `Code-reviewer evidence missing: write review_reports/review_<task-id>.md ` +
          `before handing off to qa-engineer.`,
      }],
      isError: true,
    };
  }
}
```

(The error text matches PM spec AC-8 verbatim for the hint portion.)

### `index.ts` — prompt registration

Add to `ListPromptsRequestSchema` handler:

```ts
{ name: "code-reviewer", description: "Code review role — clean-context diff judge between sr-engineer and qa-engineer." },
```

Add dispatcher case in `GetPromptRequestSchema`:

```ts
case "code-reviewer":
  return buildCodeReviewerPrompt(/* args identical to qa-engineer */);
```

Widen `tw_switch_role` zod enum (currently restricted in `index.ts` to the existing six values — confirm during T59 via grep; if it's free-form `z.string()`, no widening needed).

## Sequence Diagram

```mermaid
sequenceDiagram
  participant SR as sr-engineer
  participant CR as code-reviewer
  participant QA as qa-engineer
  participant PM as pm
  participant Server as MCP server

  Note over SR: implements task
  SR->>Server: tw_update_state(agent=sr-engineer, status=In_Progress, pending_notes=["next_role: code-reviewer"])
  Server-->>SR: ok (transition sr:In_Progress→sr:In_Progress self-loop, or sr→cr if next call)
  SR->>Server: tw_update_state(agent=code-reviewer, status=In_Progress, ...) [handoff]
  Server-->>SR: validateTransition(sr→cr) ok, review_round unchanged

  Note over CR: clean context: read diff + spec
  CR->>CR: write review_reports/review_T56.md

  alt APPROVED
    CR->>Server: tw_update_state(agent=code-reviewer, status=In_Progress[loop], ...) <br/> then tw_update_state(agent=qa-engineer, status=In_Progress, completed_tasks=[T56], pending_notes=["review: APPROVED", "review_report: review_reports/review_T56.md", "next_role: qa-engineer"])
    Server->>Server: validateTransition(cr:IP → qa:IP) ok
    Server->>Server: hasCodeReviewEvidence(T56) → present
    Server->>Server: computeNewRound → review_round=0
    Server-->>CR: ok
    Note over QA: writes tests
    QA->>Server: tw_update_state(agent=qa-engineer, status=PASS, completed_tasks=[T56], qa_review="...")
    Server->>Server: hasEvidence(T56) → present (qa_reports/review_T56.md)
    Server->>Server: tw_complete_task(T56) by qa
    Server-->>QA: ok
  else CHANGES_REQUESTED
    CR->>Server: tw_update_state(agent=code-reviewer, status=FAIL, completed_tasks=[T56], blocking_reason="...", pending_notes=["review: CHANGES_REQUESTED", "review_report: ...", "next_role: sr-engineer"])
    Server->>Server: validateTransition(cr:IP → cr:FAIL) ok
    Server->>Server: computeNewRound → review_round=N+1
    alt review_round < 4
      Server-->>CR: ok; SR loops back
      SR->>Server: tw_update_state(agent=sr-engineer, status=In_Progress, ...)
    else review_round == 4
      Server-->>CR: REVIEW_ROUND_EXCEEDED; only (pm, In_Progress) accepted
      PM->>Server: tw_update_state(agent=pm, status=In_Progress, ...)
      Server->>Server: computeNewRound → qa_round=0, review_round=0
    end
  end
```

## Deferred Resources

None. PM spec's *Dependencies / Prerequisites* enumerates the research artifact (fetched), the existing schema/transition/evidence infrastructure (in-tree), and explicitly states "no external URLs, Figma files, tickets, or design references in the source material. **No deferred references.**" Confirmed by re-reading `specs/code-reviewer-role-extraction.md` — no `http://`, no design hostnames, no ticket IDs.

## Open Questions

None. Four candidate ambiguities were considered and resolved within architect scope:

- **A. v1→v2 migration location** — register inline in existing `schema/migrations-handoff.ts` (resolved: no new file, mirrors v0→v1 pattern).
- **B. Code-review evidence granularity (per-task vs per-feature)** — resolved: per-task per PM spec AC-8 verbatim; scope manifest carried via re-used `completed_tasks` field (documented as deliberate overload in Data Structures).
- **C. SQLite evidence table — reuse `reports` or new table** — resolved: new `code_review_reports` table with distinct `verdict` enum (`APPROVED`/`CHANGES_REQUESTED`), keeping the qa PASS gate at L619-627 functionally untouched.
- **D. SessionStart hook code change** — resolved: NO change needed. The hook embeds `handoff.md` verbatim; `review_round` flows through automatically once `writeHandoffState` emits it. T65 collapses to a verification step (boot + grep). Surface this to PM/sr-engineer so T65 isn't accidentally scoped as a code task.
