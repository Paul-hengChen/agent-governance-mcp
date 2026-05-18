<!-- @pm | feature_id: qa-flow-enforcement | created_at: 2026-05-18 | supersedes: qa-gate-enforcement -->

# QA-Flow Enforcement (v3.2.0)

## Problem Statement

The server today loads the constitution into agent context but does not
*enforce* the routing chain `pm → (architect) → sr-engineer → qa-engineer →
PASS`. Audit shows seven of eight chain steps are bypassable: any caller can
skip PM, skip sr-engineer, skip the QA round, or self-declare `agent_id`. The
already-merged PASS guard (A) and the planned zod refinement (B) only close
the very last step (finalisation) and still trust a client-declared string.

This spec promotes the work from "gate the last write" to "enforce the whole
chain". Three new layers stack on top of A+B:

- **D — Evidence-of-QA**: PASS requires `qa_reports/review_<task-id>.md` to
  exist (file mode) or a corresponding row in a `reports` table (SQLite mode).
- **E — Transition state machine**: every `tw_update_state` /
  `tw_complete_task` call validates the (previous `last_agent`, previous
  `status`) → (new `last_agent`, new `status`) tuple against an allowed
  transition table. Illegal transitions reject with a structured error.
- **Round counter**: handoff carries `qa_round: N`. FAIL increments, PASS
  resets. `N > 3` forces rollback to PM and rejects further PASS attempts.

Option C (server-side session role snapshot from `tw_switch_role`) is
**explicitly out of scope** — without true client-identity binding it only
relocates the self-declaration. Revisit if/when MCP gains caller identity.

Dogfooding evidence: phase7 closed with `status=PASS, last_agent=sr-engineer`
— exactly the bypass this feature eliminates.

## User Stories

- As a teamwork-mcp-server maintainer, I want the server to reject any
  state transition that skips a required chain step, so that an automated
  pipeline cannot silently shortcut from sr-engineer to PASS.
- As a QA author, I want PASS to require a review artifact on disk, so that
  "QA ran" becomes filesystem-verifiable instead of self-attested.
- As a PM, I want the >3-round circuit breaker enforced server-side, so that
  endless QA ping-pong cannot drain the loop budget — the chain force-rolls
  back to me for re-scoping.
- As an MCP client author, I want the rules visible in tool schemas (zod
  refinements + structured error envelopes) so that my client surfaces
  validation errors before sending the call.

## Acceptance Criteria

### A+B — Agent-ID Gate (already partially landed)

- **Given** `tw_update_state(status="PASS")` and `agent_id ≠ "qa-engineer"`,
  **When** the call hits the server,
  **Then** zod rejects via `.refine()` (not a handler `if`) with a message
  naming the failing rule, and no write happens.

- **Given** `tw_complete_task` and `agent_id ≠ "qa-engineer"`,
  **When** the call hits the server,
  **Then** the handler returns `⛔ BLOCKED: tw_complete_task is reserved for
  qa-engineer`, and storage is untouched.

### D — Evidence-of-QA

- **Given** PASS path, file mode,
  **When** `qa_reports/review_<task-id>.md` does not exist for every task in
  `completed_tasks` of this call,
  **Then** the call rejects with `⛔ BLOCKED: missing QA evidence for <ids>`.

- **Given** PASS path, SQLite mode,
  **When** the `reports` table has no row matching `(workspace_id, task_id,
  status='PASS')` for each completed task,
  **Then** the call rejects equivalently.

- **Given** sr-engineer's implementation phase,
  **When** sr-engineer attempts to write `qa_reports/review_<task-id>.md`,
  **Then** this is allowed at the filesystem layer but flagged in
  `tw_detect_drift` (provenance: author should be qa-engineer). Hard
  enforcement is out of scope — drift surface is sufficient.

### E — Transition State Machine

- **Given** a fresh workspace (`handoff.md` absent or `last_agent` empty),
  **When** any role calls `tw_update_state(status="In_Progress")`,
  **Then** only `agent_id ∈ {"pm", "researcher"}` is accepted as the new
  `last_agent`. Other agent_ids reject.

- **Given** previous `(last_agent=pm, status=In_Progress)`,
  **When** the next `tw_update_state` arrives,
  **Then** allowed new `last_agent ∈ {"architect", "sr-engineer"}` with
  `status=In_Progress`; or `pm` itself with `status=Blocked`. Anything else
  rejects with `⛔ TRANSITION: pm→<x> not allowed`.

- The full allowed transition matrix (`prev_agent, prev_status → new_agent,
  new_status`) is the architect's deliverable in
  `design/qa-flow-enforcement.md` §Transition Matrix. Sr-engineer encodes it
  verbatim.

- **Given** any rejected transition,
  **When** the server replies,
  **Then** the error envelope contains both the *attempted* tuple and the
  *allowed* set, so the calling agent can self-correct without re-reading
  the constitution.

### Round Counter

- **Given** `tw_update_state(status="FAIL", agent_id="qa-engineer")`,
  **When** the write executes,
  **Then** `qa_round` increments by 1 in the persisted state.

- **Given** `tw_update_state(status="PASS", agent_id="qa-engineer")`,
  **When** the write executes,
  **Then** `qa_round` resets to 0.

- **Given** `qa_round === 3` and `status="FAIL"` arriving,
  **When** the call is validated,
  **Then** server rewrites `status=FAIL`, appends `pending_notes: ["⛔
  Round 4: forced rollback to pm"]`, sets `next_role=pm` implicitly, and
  rejects any subsequent `status=PASS` until PM resets the feature.

### Schema Visibility

- **Given** an MCP client introspects tool schemas,
  **When** it reads `tw_update_state` and `tw_complete_task`,
  **Then** the `agent_id` field documents the qa-engineer constraint, and
  the description references the transition rule by name (e.g.
  `"Subject to ALLOWED_TRANSITIONS — see design doc"`).

### Regression Safety

- **Given** the merged change,
  **When** `npm test` runs,
  **Then** all existing 39 tests stay green AND new tests cover: schema
  reject (B), handler reject (A), each legal/illegal transition (E), round
  increment/reset, Round-4 force-rollback, missing-evidence reject (D —
  both modes).

- **Given** the merge,
  **When** `npm run build` runs,
  **Then** `tsc` is clean and `dist/` is updated and committed.

## Out of Scope

- **Option C — server-side session role snapshot**: deferred. Without MCP
  caller identity binding it only adds a step, no real lock.
- **Evidence authorship enforcement**: `qa_reports/review_<id>.md` content
  is not validated for author. Drift surface is enough.
- **Cross-machine enforcement**: file lock remains local-fs.
- **Git history rewrite**: stale phase7 PASS row stays as-is; it is the
  motivating evidence.
- **Existing handoff files without `qa_round`**: backward compatibility —
  reader defaults `qa_round` to 0 when frontmatter omits it. No migration
  script.

## Dependencies / Prerequisites

- Architect (T01) must land first — defines the transition matrix,
  qa_round persistence shape (file frontmatter + SQLite column), evidence
  schema, error envelope format, and module split (whether transitions live
  in `tools/transitions.ts` or inline in `index.ts`).
- `tools/handoff.ts` HandoffState interface needs a new `qa_round?: number`
  field (default 0).
- `tools/storage.ts` HandoffStorage interface needs writeState signature
  extension (or pass HandoffState whole — architect's call).
- `tools/storage-sqlite.ts` requires a schema migration (new column or new
  reports table — architect's call).
- `scripts/check-version.mjs` must pass after constitution + package.json
  version bump to v3.2.0.

## Routing Decision

Architect IS required. Triggers:
- ≥ 3 modules touched (`index.ts`, `tools/handoff.ts`, `tools/storage.ts`,
  `tools/storage-sqlite.ts`, possibly new `tools/transitions.ts`,
  `content/skill-*.md`).
- New data model (`qa_round` field; evidence file/row convention).
- Cross-cutting API (every state-modifying tw_* tool gains a transition
  check).

Routing chain for this feature: `pm → architect → sr-engineer → qa-engineer`.
