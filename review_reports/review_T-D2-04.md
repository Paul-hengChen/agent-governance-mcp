# Review — T-D2-04

covers: T-D2-04

## Summary
- Adversarial review of the full uncommitted D2 diff (`d2-server-brake-accounting`), built across T-D2-01A/01B/02/03: server-computed persisted `hop_count` + `HOP_CAP_EXCEEDED` gate (mirror of the three round caps), handoff v8→v9 migration, SQLite idempotent ALTER, a new durable `.current/usage.jsonl` sidecar (`tools/usage-accounting.ts` + PostToolUse hook), and coordinator/lite skill + README/config/docs rewiring.
- 20 source files (10 modified, 2 new: `tools/usage-accounting.ts`, `bin/agent-governance-usage-hook.mjs`); `dist/` regenerated in step.
- Cross-checked against `specs/d2-server-brake-accounting.md` (AC-1..AC-10) and the binding Decision Records DR-1..DR-9 in the architecture blueprint. `npx tsc --noEmit` clean (exit 0).
- Verdict: APPROVED — implementation is a faithful sibling of the round-cap machinery with the documented durability/opt-in discipline; no blocking finding in any category. Two immaterial best-effort observations noted under Quality.
- Same-model bias note: this review ran on opus; sr-engineer was pinned to fable (different model) — the recommended cross-model independence holds.

## Correctness
No blocking findings.

- Hop gate — cap boundary (`tools/transitions.ts:376-398`): gate fires when `prev_hop_count >= HOP_CAP (10)`. Counting from a fresh feature, writes 1..10 are accepted (prev 0..9), the 11th (prev=10) is rejected — exactly "max 10 auto-routing role transitions" (const-01). Correct.
- DR-9 increment rule: both the gate (`req.next.agent !== req.prev.agent`) and `computeNewRound` (`isRoleTransition = !!next.agent && next.agent !== (prev?.agent ?? null)`) count only genuine role transitions; self-loops and same-agent status changes fall through and are never counted or blocked (`transitions.ts:394,522-524`). The gate's missing `!!next.agent` guard is unreachable — a null `next.agent` with a non-null status is already rejected upstream by the precedence-1 AGENT_ID_REQUIRED check, and `tw_update_state` always carries a status.
- DR-6 feature-scoped reset / no PM-re-entry reset: `feature_changed` resets the base to 0 (AC-3); the `(pm, In_Progress)` landing at cap is accepted by the gate's `!(next.agent==="pm" && next.status==="In_Progress")` clause and `computeNewRound` increments it (10→11) WITHOUT resetting — only an `active_feature` change resets. Verified a post-landing `pm → other-role` write re-fires the gate, so autonomous dispatch stays frozen at PM. Matches DR-6 exactly.
- AC-8 (round caps unchanged): the hop override is inserted at precedence 2.5 — AFTER the qa/review/visual round-cap override (step 2) and BEFORE the self-loop fast path (step 3). It is dormant for any transition where `hop_count < 10` (i.e. all pre-existing behavior). `computeNewRound` is additive — the returned object gains `hop_count` while the three round fields are computed identically; existing 3-field destructures are unaffected. Round behavior is byte-identical.
- Migration v8→v9 (`schema/migrations-handoff.ts:105-116`) seeds `hop_count: 0` (DR-3, the review_round/visual_round counter precedent). The read-path heal-write now threads `state.hop_count` as the 12th positional arg (`handoff.ts:433-440`), closing the "stamp v9 but drop the seeded counter" gap; the always-emit block normalises it. Positional 12th-param overload matches the options-object branch (`handoff.ts:582,596,637`).
- SQLite: `hop_count` added via idempotent `addColumnIfMissing` ALTER with no `schema_meta` bump (DR-2), wired through `HandoffRow`, the widened `upsertStmt` tuple/`INSERT OR REPLACE` lists, `txUpsert`, write normalisation, and row parse (null/malformed → 0). Persisting the column (not file-mode-only) correctly avoids the "gate silently inert in HTTP mode" footgun. Sole handoff writers (orchestrator options-object write + read-path heal-write) both thread the counter; no path zeroes it.
- Token accounting durability & never-block: `appendUsageRecord` wraps its fs work in try/catch and swallows (`usage-accounting.ts:47-54`); `sumUsageForFeature` returns 0 on absent/empty/unparseable input and skips torn lines; the hook always `process.exit(0)` on both resolve and reject (`agent-governance-usage-hook.mjs:162-165`), so even an `await import(...)` failure of `dist/tools/usage-accounting.js` cannot block or alter the `Task` result.
- Expected-Red Sampling (SOP 4a): the review context documents 49 intentional reds. `qa_reports/expected-red_d2-server-brake-accounting.txt` exists and is sr-engineer-authored machine data. Sampled 5 of the structured `file | test` pairs — all resolve to real, locatable tests: `qa-flow.test.mjs:373`, `error-code-contract.test.mjs:161`, `dispatch-pins.test.mjs:134`, `context-budget.test.mjs:207`, `error-code-contract.test.mjs:576`. Manifest is legitimate; fixture updates are qa-owned (T-D2-05).

## Quality
No blocking findings. Two immaterial, best-effort observations (do not gate approval):

- `bin/agent-governance-usage-hook.mjs:147` records `feature` by reading `handoff.md` at PostToolUse time (post-dispatch), whereas the `UsageRecord.feature` comment says "active_feature at dispatch time". A dispatch that itself changes `active_feature` could attribute its one usage line to the new feature. Immaterial to the feature-scoped brake and consistent with best-effort accounting; noted only for the record.
- `extractUsage` (`agent-governance-usage-hook.mjs:71-97`) reads the `agent-*.jsonl` fallback from the workspace root; if the host stores those elsewhere the fallback yields all-zeros (a safe under-count). The primary source is `tool_response.usage`; the fallback is defensive. Non-blocking.
- Convention adherence is clean: the new hook reuses the existing SessionStart hook's `import.meta.url` / `AGC_SERVER_ROOT` / `pathToFileURL(dist/...)` pattern verbatim; origin-tag and Limits-by-name conventions preserved in skill prose.

## Architecture
Conforms to the blueprint. DR-1 (hop = server field, option a), DR-2 (no SQLite bump), DR-3 (seed 0), DR-4 (separate `usage.jsonl` file + sibling `tools/usage-accounting.ts` module, telemetry.ts header pointer only), DR-5 (feature-scoped token sum), DR-6/DR-9 (hop semantics), DR-7 (`documentedInProse: true`), DR-8 (01A/01B split) are all implemented as pinned. `tools/transitions.ts` stays pure/fs-free — the orchestrator derives `prev_hop_count`/`feature_changed` from `prevState` and threads them in. Gate registry gains the 23rd entry, `TRANSITION_GATE_CODES`, the union member, and the single-site doc-mapping comment.

## Security
No findings. No new trust boundary is crossed unsafely: the hook parses untrusted stdin/config defensively (all `JSON.parse` in try/catch, numeric fields validated via `typeof === "number" && Number.isFinite`), writes only to `.current/usage.jsonl` inside the workspace, and introduces no secrets, no shell-out, and no injection vector. The opt-in gate reads `tokenBudgetPerFeature` via a raw parse (deliberately not `loadConfig`, to avoid the refuse-loud / schema-heal side effects in a best-effort observer) — correct posture.

## Performance
No findings. `sumUsageForFeature` is a single O(lines) file scan performed only when the brake is enabled and only at coordinator decision points — not a hot path. The SQLite ALTER is one-time and idempotent. The hop gate/`computeNewRound` additions are O(1). No new loops-that-should-be-batched, no unbounded caches, no listener leaks, no algorithmic regression vs base.

## Verdict
APPROVED — the hop-cap gate is a genuine sibling of the three round caps with zero behavior change to them (AC-8), the token-usage record is durable and never masks/blocks the coordinator (AC-5), the two telemetry streams stay distinguishable by separate file + disjoint keys (AC-7), the brake stays opt-in with zero-config behavior unchanged (AC-9), and all binding Decision Records (DR-1..DR-9) are faithfully implemented. tsc clean; the 49 reds are documented, qa-owned re-baselines (T-D2-05).
