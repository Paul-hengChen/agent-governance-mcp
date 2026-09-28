# d2-server-brake-accounting — architecture

Blueprint for the two cost-side circuit-breaker fixes: (1) a **server-computed,
persisted hop counter** with a server-enforced cap gate, and (2) a **durable,
hook-appended token-usage sidecar** the coordinator reads instead of
hand-summing `agent-*.jsonl`. Pins the PM's non-binding hybrid recommendation
with the concrete field/gate names, `schema_version` impact, AC-7 resolution,
and a task-budget-sized, split diff plan.

## Decision Summary (AC-10)

| # | Decision | Value |
|---|---|---|
| 1 | Hop-counter mechanism | Option (a): persisted `handoff.md` field, computed in `tools/transitions.ts`, gated in `validateTransition` — a genuine sibling of `qa_round`/`review_round`/`visual_round`. |
| 2 | Hop field name | **`hop_count`** (a monotonic transition counter, not a fail-retry "round" — named for what it is). |
| 3 | Hop gate error code | **`HOP_CAP_EXCEEDED`** (sibling of `QA_ROUND_EXCEEDED`/`REVIEW_ROUND_EXCEEDED`/`VISUAL_ROUND_EXCEEDED`; `HOP_CAP = 10` from const-01 Limits). |
| 4 | Hop increment rule | +1 on each accepted **role-transition** write (`next.agent !== prev.agent`) for the current feature; same-agent self-loops and same-agent status changes do NOT count. |
| 5 | Hop reset semantics | **Feature-scoped**: resets on `active_feature` change ONLY (the `dispatch_pins`/`external_refs` precedent). Does NOT reset on PM re-entry — unlike the round caps. Persists across `/teamwork` invocations of the same feature (intentional; see DR-6). |
| 6 | Token-usage mechanism | Option (b): a **PostToolUse hook on `Task`** appends per-dispatch `usage.*` to a durable sidecar; the coordinator reads/sums the sidecar. |
| 7 | Token sidecar file | **Separate file** `.current/usage.jsonl` (NOT merged into D3's `telemetry.jsonl`) — resolves AC-7 by full file separation (DR-4). |
| 8 | Token accounting module | New sibling module **`tools/usage-accounting.ts`** (append + sum), alongside D3's `tools/telemetry.ts` — same best-effort/never-throw discipline, distinct concern (DR-4). |
| 9 | `schema_version` impact | **handoff v8 → v9** (new persisted `hop_count`). **tasks v1**, **sqlite v2**, **config v1** all UNCHANGED (see §schema_version Impact). |
| 10 | Token brake scope | **Feature-scoped** (sum `usage.jsonl` lines where `feature === active_feature`), refining B9's per-invocation scope — the only shape that satisfies the durability user story (DR-5). |

## Affected Files

### T-D2-01A — schema + pure logic (5 files)
- `schema/versions.ts` — modify: bump `CURRENT_VERSIONS.handoff` `8 → 9`.
- `schema/migrations-handoff.ts` — modify: register v8→v9 migration seeding `hop_count: 0` (the review_round/visual_round precedent, NOT the stamp-only attestation precedent — DR-3).
- `tools/transitions.ts` — modify: add `HOP_CAP = 10`; extend `TransitionRequest` with `prev_hop_count?`/`feature_changed?`; add `"HOP_CAP_EXCEEDED"` to the `TransitionRejection["error"]` union; add the hop-cap override in `validateTransition`; extend `computeNewRound` to also return `hop_count`.
- `gates/registry.ts` — modify: add `"HOP_CAP_EXCEEDED"` to `GateErrorCode`, a `GateDefinition` entry (transition-json group), the `TRANSITION_GATE_CODES` list, and the errorCode→doc-file mapping comment (`skill-coordinator.md`).
- `docs/schema-versions.md` — modify: add the handoff v9 row; note `hop_count` is added to SQLite via idempotent ALTER (no sqlite version bump), mirroring `visual_round`.

### T-D2-01B — persistence + orchestration (3 files) — depends_on T-D2-01A
- `tools/handoff.ts` — modify: add `hop_count: number` to `HandoffState`; parse it (default 0); always-emit in frontmatter; add `hopCount?` to `WriteHandoffStateOptions` + the positional overload (12th param) + the migration-heal write call.
- `tools/handoff-orchestrator.ts` — modify: compute `prev_hop_count` + `feature_changed` from `prevState`; thread into `validateTransition` and `computeNewRound`; pass `hopCount` into `storage.writeState`; add the hop-cap-cross pending-note sentinel.
- `tools/storage-sqlite.ts` — modify: add `hop_count` column (bootstrap `CREATE TABLE` + idempotent `addColumnIfMissing` ALTER); add to `HandoffRow`, the `INSERT OR REPLACE` column/value lists, `writeState` normalization, and row parse. No sqlite version bump.

### T-D2-02 — durable token-usage accounting (3 files) — depends_on T-D2-01B
- `tools/usage-accounting.ts` — **create**: `UsageRecord`/`UsageTotals` types, `usagePath()`, `appendUsageRecord()` (best-effort, never throws), `sumUsageForFeature()`.
- `bin/agent-governance-usage-hook.mjs` — **create**: PostToolUse hook on `Task`; opt-in-gated on `tokenBudgetPerFeature`; extracts `usage.*`, appends a record; always exits 0.
- `tools/telemetry.ts` — modify: header-comment pointer to the sibling `usage-accounting` module + `usage.jsonl` (documents the AC-7 stream split; no code change to `emitGateTelemetry`).

### T-D2-03 — coordinator skill + config docs + hook wiring (≤4 files) — depends_on T-D2-02
- `content/skill-coordinator.md` — modify: §Auto-Routing (hop counter now server-tracked — read `hop_count` from `tw_get_state`, stop maintaining the in-memory counter, server enforces `HOP_CAP_EXCEEDED`); §Token Budget Brake (read/sum `.current/usage.jsonl` by feature, fall back to the B9 `agent-*.jsonl` hand-sum only when the sidecar is absent); Escalation Routes hop + token rows; add the backtick-quoted `HOP_CAP_EXCEEDED` literal (required by the C12 error-code-contract parity test — DR-7).
- `content/skill-coordinator-lite.md` — modify (one line): note lite mode is `hop` cap-exempt (const-01) and server-read-only — no `hop_count` enforcement applies.
- `tools/config.ts` — modify: header-doc note that `tokenBudgetPerFeature` is now backed by the durable `.current/usage.jsonl` sidecar (populated by the PostToolUse hook) rather than model arithmetic.
- `README.md` — modify: add the PostToolUse hook wiring example for `settings.json` (`Task` matcher → `bin/agent-governance-usage-hook.mjs`), flagged opt-in.

Test deliverables (`test/hop-count-transitions.test.mjs`, `test/usage-accounting.test.mjs`, extensions to existing round-cap/handoff fixtures) are **qa-owned** under T-D2-05 — listed here so the ordering rule is explicit, not built by sr-engineer.

## Data Structures

### Handoff — new persisted counter (`tools/handoff.ts`)
```ts
export interface HandoffState {
  // ...existing...
  qa_round: number;
  review_round: number;
  visual_round: number;
  // v9 (d2-server-brake-accounting) — feature-scoped role-transition counter.
  // Computed server-side by computeNewRound; enforced by the HOP_CAP_EXCEEDED
  // override in validateTransition. Always emitted (even 0), parser defaults
  // missing to 0 — identical treatment to qa_round/review_round/visual_round.
  // Feature-scoped: resets ONLY on active_feature change (NOT on PM re-entry).
  hop_count: number;
}
```

### Transitions — request/compute extensions (`tools/transitions.ts`)
```ts
export interface TransitionRequest {
  // ...existing...
  prev_visual_round?: number;
  next_resume_of?: "code-reviewer" | "qa-engineer";
  // v9 — hop-cap inputs. Opt-in (mirrors prev_visual_round): a caller that
  // omits them defaults prev_hop_count=0 → the gate stays dormant. The
  // orchestrator derives both from prevState + the incoming active_feature
  // (transitions.ts stays pure / fs-free — it never reads active_feature
  // itself, only the boolean the orchestrator computes).
  prev_hop_count?: number;
  feature_changed?: boolean;
}

export type /* TransitionRejection["error"] gains */ "HOP_CAP_EXCEEDED";

const HOP_CAP = 10; // const-01 Limits: `hop` cap — max auto-routing role transitions.
```

### Usage accounting (`tools/usage-accounting.ts`, NEW)
```ts
export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}
export interface UsageRecord {
  ts: string;              // ISO-8601
  feature: string | null;  // active_feature at dispatch time
  dispatch: string | null; // subagent_type / role dispatched to
  usage: UsageTotals;
}
```
`usage.jsonl` line vs D3 `telemetry.jsonl` line — unambiguously distinguishable by disjoint key sets (AC-7):

| file | keys |
|---|---|
| `.current/usage.jsonl` | `ts`, `feature`, `dispatch`, `usage{…}` |
| `.current/telemetry.jsonl` | `ts`, `gate`, `error_code`, `agent_id`, `feature` |

## Interface Contracts

### `tools/transitions.ts`
```ts
// Gate: fires when the feature's persisted hop_count is already at/over cap and
// the incoming write is a counted role transition that is not the pm landing.
// Placed as the FOURTH round-style override — AFTER the qa/review/visual
// overrides (so their outputs stay byte-identical, AC-8) and BEFORE the
// self-loop fast path. Self-loops and same-agent status changes are NOT role
// transitions, so they fall through and are never hop-blocked.
validateTransition(req: TransitionRequest): TransitionRejection | null
//   if (!feature_changed && (prev_hop_count ?? 0) >= HOP_CAP
//       && next.agent !== prev.agent
//       && !(next.agent === "pm" && next.status === "In_Progress"))
//     → rejection("HOP_CAP_EXCEEDED", [{pm,In_Progress}], `hop_count=${n}` + hintStatic)

// Extended return (additive — existing 3-field destructures are unaffected):
computeNewRound(
  prev_qa_round, prev_review_round, prev_visual_round,
  next, prev?, next_pending_notes?,
  prev_hop_count = 0, feature_changed = false,
): { qa_round: number; review_round: number; visual_round: number; hop_count: number }
//   isRoleTransition = !!next.agent && next.agent !== (prev?.agent ?? null)
//   base = feature_changed ? 0 : prev_hop_count
//   hop_count = isRoleTransition ? base + 1 : base
```

### `tools/handoff-orchestrator.ts` (in `handleUpdateStateCore`)
```ts
const prev_hop_count = prevState?.hop_count ?? 0;
const feature_changed = prevState ? prevState.active_feature !== parsed.active_feature : true;
// → thread prev_hop_count + feature_changed into validateTransition(...)
// → thread into computeNewRound(...); destructure hop_count: new_hop_count
// → storage.writeState({ ..., hopCount: new_hop_count })
// → sentinel: if (new_hop_count >= HOP_CAP && prev_hop_count < HOP_CAP)
//      pending.unshift("⛔ Hop cap reached: next role transition halts to human …")
// HOP_CAP_EXCEEDED telemetry is captured automatically — the existing D3
// wrapper handleUpdateState extracts the "⛔ HOP_CAP_EXCEEDED" prefix and calls
// emitGateTelemetry; no change to telemetry.ts is needed for that path.
```

### `tools/usage-accounting.ts` (NEW)
```ts
export function usagePath(workspacePath: string): string; // <ws>/.current/usage.jsonl
export function appendUsageRecord(workspacePath: string, record: UsageRecord): void; // best-effort, never throws
export function sumUsageForFeature(workspacePath: string, feature: string): number;   // Σ of the 4 usage.* fields over lines where line.feature === feature; 0 when file absent/empty/unparseable
```

### `bin/agent-governance-usage-hook.mjs` (NEW — PostToolUse hook contract)
- Reads the PostToolUse JSON payload from stdin (`tool_name`, `tool_input`, `tool_response`, `cwd`).
- No-op (exit 0) unless: `tool_name === "Task"` AND `<ws>/.current/` exists AND `.current/.config.json` sets a positive finite `tokenBudgetPerFeature` (opt-in — AC-9: absent config ⇒ no file, no accounting).
- Extracts the four `usage.*` numbers from `tool_response.usage` when present; otherwise best-effort from the newest `agent-*.jsonl` entry (the same source B9 reads today). Missing numbers default to 0.
- Reads `active_feature` from `.current/handoff.md` frontmatter for the `feature` field; `tool_input.subagent_type` for `dispatch`.
- Appends one `UsageRecord` via `dist/tools/usage-accounting.js`'s `appendUsageRecord` (the SessionStart hook's `dist/`-import pattern).
- Best-effort throughout: any failure is swallowed, the hook always exits 0 and never blocks or alters the `Task` result (D3's `emitGateTelemetry` discipline).

### Coordinator read path (skill-procedure, `content/skill-coordinator.md`)
- Hop cap: read `hop_count` from `tw_get_state`; the server enforces the cap. Stop maintaining an in-memory hop counter.
- Token brake: `running_total = Σ usage.* over .current/usage.jsonl lines where feature === active_feature`; halt at ≥ 80% of `tokenBudgetPerFeature` (unchanged threshold/semantics — B9 AC-3). When `usage.jsonl` is absent (hook not wired), fall back to B9's `agent-*.jsonl` hand-sum so B9 behavior is preserved for un-wired users.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Human
    participant Coord as /teamwork Coordinator
    participant Task as Task tool
    participant Hook as PostToolUse hook
    participant Role as Dispatched role
    participant MCP as tw_update_state (orchestrator)
    participant HO as handoff.md
    participant UJ as .current/usage.jsonl

    Coord->>Task: dispatch(subagent_type=role)
    Task->>Role: run role SOP
    Role->>MCP: tw_update_state(agent_id, status, active_feature)
    MCP->>HO: read prevState (prev_hop_count, active_feature)
    MCP->>MCP: feature_changed?; validateTransition (HOP_CAP_EXCEEDED?)
    alt hop_count >= HOP_CAP and counted role transition (not pm landing)
        MCP-->>Role: ⛔ HOP_CAP_EXCEEDED (telemetry.jsonl logs it)
        Role-->>Coord: blocked
        Coord->>Human: surface hop cap — halt
    else accepted
        MCP->>MCP: computeNewRound → new_hop_count
        MCP->>HO: writeState(hop_count=new_hop_count)
        MCP-->>Role: ok
    end
    Task-->>Hook: PostToolUse(tool_response.usage)
    Hook->>UJ: appendUsageRecord({ts,feature,dispatch,usage}) (opt-in, best-effort)
    Role-->>Coord: handoff (next_role)
    Coord->>UJ: sumUsageForFeature(active_feature)
    Coord->>HO: tw_get_state (hop_count)
    alt running_total >= 80% budget
        Coord->>Human: token budget brake — halt
    else under budget and under hop cap
        Coord->>Task: next dispatch
    end
```

## schema_version Impact (AC-10)

| Artifact | Where version lives | Before | After | Migration |
|---|---|---|---|---|
| `handoff.md` | YAML `schema_version` | 8 | **9** | v8→v9 stamps version **and seeds `hop_count: 0`** — the review_round(v1→v2)/visual_round(v2→v3) counter precedent, NOT the stamp-only attestation precedent (a 0 count is the true value, not a fabricated attestation — DR-3). |
| `tasks.md` | `<!-- schema_version -->` | 1 | **1** (unchanged) | none — no task-schema change. |
| SQLite DB | `schema_meta(sqlite)` | 2 | **2** (unchanged) | `hop_count` column added via the idempotent `addColumnIfMissing` ALTER in the storage-sqlite constructor — the exact mechanism that added `visual_round` without a versioned step. Additive column with `DEFAULT 0` is backward/forward-compatible, so no `schema_meta` bump (DR-2). |
| `.config.json` | JSON `schema_version` | 1 | **1** (unchanged) | none — `tokenBudgetPerFeature` already exists (B9); no new config field. `usage.jsonl` is an append-only sidecar, not config, and (like `telemetry.jsonl`) carries no `schema_version`. |

## AC-7 Resolution — no duplicate/conflated telemetry streams

**Decision: two separate files, two sibling modules.** D3 ships gate-fire events
to `.current/telemetry.jsonl` via `tools/telemetry.ts`; D2 ships per-dispatch
cost records to `.current/usage.jsonl` via a new sibling `tools/usage-accounting.ts`.
The two streams are distinguishable by full file separation AND by disjoint key
sets. This is the stronger of the two options AC-7 offers ("distinct file, or an
additive field set on the same event shape with a discriminator"): a reader never
has to filter one file by a discriminator to tell a gate-rejection line from a
dispatch-accounting line. `tools/telemetry.ts` gets a one-line header pointer to
the sibling module so the "D2 is D3's named consumer" relationship (D3 spec AC-9)
is documented in-code (DR-4). The hop cap's own gate-fire events (`HOP_CAP_EXCEEDED`)
flow through D3's existing `telemetry.jsonl` for free — no new stream for those.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| DR-1: Hop counter — server field (a) vs. hook (b) | Adopt PM's hybrid: option (a) for hop. The server already sees every transition; a persisted field computed in `transitions.ts` is a verbatim sibling of the three round caps. | Zero new data source; AC-1/AC-2 satisfied by the existing round-cap machinery. Rejects a hook for hop (a hook would relocate the same model-arithmetic failure). |
| DR-2: SQLite version bump for `hop_count`? | No bump. Add the column via the idempotent `addColumnIfMissing` ALTER, exactly as `visual_round` was added at v3.14.0 (which also did NOT bump sqlite past v2). | Keeps the diff small and forward/backward-compatible; closes the "gate silently inert in HTTP mode" footgun by still persisting the column. Rejects a v2→v3 STEPS entry as unnecessary ceremony for a `DEFAULT 0` additive column. |
| DR-3: Migration seeds `0` vs. stamp-only | Seed `hop_count: 0` in v8→v9. | `hop_count` is a counter whose true pre-feature value is 0 (like review_round/visual_round), not an attestation whose absence is meaningful (like scope_decision/cut_approved/external_refs). Seeding 0 is correct, not a fabricated directive. |
| DR-4: `usage.jsonl` — separate file vs. extend `telemetry.jsonl` | Separate file + sibling module. | Maximally satisfies AC-7 distinguishability; decouples two independent lifecycles (always-on gate telemetry vs. opt-in cost accounting) and two writers (orchestrator vs. host hook). Deviates from a literal "extend `tools/telemetry.ts`" reading of D3 AC-9 — justified because conflating the streams is exactly what AC-7 warns against; the module pointer preserves the documented linkage. |
| DR-5: Token brake scope — per-invocation (B9) vs. per-feature | Per-feature (sum `usage.jsonl` where `feature === active_feature`). | The only scope that satisfies the durability user story — a per-invocation total cannot by definition survive into a new invocation. Aligns both brakes on one feature-scoped model; strictly more conservative (catches more spend). Threshold (80%) and halt semantics stay byte-identical (AC-6). Uses the Out-of-Scope clause that delegates cross-invocation to the architect. |
| DR-6: Hop cap escape does NOT reset on PM re-entry | `HOP_CAP_EXCEEDED` allows only `(pm, In_Progress)` as a landing edge but that write does NOT reset `hop_count` (only `active_feature` change resets, AC-3). | The hop cap is a session-length circuit breaker, harder to clear than the per-task round caps by design: after it fires, autonomous dispatch is frozen at PM until a human re-scopes into a new feature or overrides. The `(pm, In_Progress)` landing lets the coordinator record the halt without hand-editing `handoff.md`. |
| DR-7: `HOP_CAP_EXCEEDED` `documentedInProse: true` | Registry entry marks it documented; T-D2-03 MUST add the backtick-quoted literal to `skill-coordinator.md`. | The C12 error-code-contract parity test asserts every `documentedInProse` code appears backtick-quoted in its mapped `content/*.md`. The registry change (01A) and the prose literal (03) must both land before QA (05) runs, or the parity test fails. Cross-task dependency flagged in the diff plan. |
| DR-8: T-D2-01 split into 01A + 01B | The hop-counter footprint is 6+ files; split into 01A (schema + pure logic, 5 files) → 01B (persistence + orchestration, 3 files), 01B depends_on 01A. | Honors the `task_size` budget (≤5 files/300 lines per sr-engineer session) without merging/dropping. T-D2-02 now depends_on T-D2-01B. Ordering + depends_on chain preserved (AC-10). |
| DR-9: Hop increment counts role transitions, not every write | `hop_count` increments only when `next.agent !== prev.agent`. | Faithful to const-01's "max auto-routing role transitions" and the coordinator's "per successful dispatch"; a per-write count would blow through cap=10 in a single qa cycle (~4–5 writes) and misrepresent the metric. |

## Deferred Resources
_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred external refs (Resource Audit Gate found zero; `external_refs` omitted from state)._

## Open Questions
None.
