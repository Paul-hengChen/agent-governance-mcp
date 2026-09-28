# Review — T-E1-04 (batched adversarial review)

covers: T-E1-01, T-E1-02, T-E1-03

Feature: e1-feature-scoped-state-design. Base: uncommitted working tree vs HEAD.
Contract: specs/e1-feature-scoped-state-design.md (no `-architecture.md` — the spec
IS the design deliverable). Ratified calibrations honored: LEASE_TTL_MIN=30;
Blocked counts as lease-held=YES.

## Summary
- T-E1-01: new pure predicate `gates/feature-lease.ts::isFeatureLeaseHeld`, `FEATURE_LEASE_HELD` registry entry (catalog 24→25), orchestrator lease-gate block + `LEASE_TTL_MIN=30` const (both storage modes), `transitions.ts` union extension (14→15, handler-side only).
- T-E1-02: `content/skill-release-engineer.md` SOP step 3a (re-baseline-off-HEAD) + 2-sentence template mirror.
- T-E1-03: `content/coord-03-core-fallback.md` Feature-Scope Gate note + FEATURE_LEASE_HELD Escalation-Routes row (spec named the since-split `skill-coordinator.md`).
- Every a-min invariant holds: zero changes to `tools/handoff.ts` / `tools/storage*.ts` / `schema/*` (independently verified); predicate reads only the three universal fields; `tsc --noEmit` exit 0.
- Verdict: APPROVED.

## Correctness
No blocking findings.

- `isFeatureLeaseHeld` (gates/feature-lease.ts:44-56) implements the ratified predicate exactly: `!prevState → false` (fresh workspace), `active_feature === incoming → false` (same feature never gates), `status === "PASS" → false` (terminal releases), else `ageMs < ttlMin*60_000`. Strict `<` matches the spec's `(now − last_updated) < LEASE_TTL_MIN` (feature-lease.ts:14) — at exactly TTL the lease is released. Correct.
- Blocked-counts-as-held is satisfied structurally: Blocked ≠ PASS, so line 52 does not short-circuit and a fresh Blocked incumbent holds the lease. Matches ratified Open Question. Correct.
- NaN fail-open: `Date.parse(bad) → NaN`, and `NaN < x → false` (feature-lease.ts:53-55), so an unparseable `last_updated` yields lease-NOT-held. This is a deliberate, spec-documented fail-open mirroring the lock's stale-self-heal (feature-lease.ts:24-27) — safe (never falsely blocks), and it is the only reasonable posture since NaN cannot prove freshness.
- Orchestrator placement (tools/handoff-orchestrator.ts:159) is correct and frozen-order-conformant: it runs after `validateTransition` accepts (line 135-140) and before the scope-decision gate (line 191), exactly as the AC-5/AC-8 check-order comment (line 10) now states. `prevState`, `prevTuple`, `nextTuple`, `parsed.active_feature` are all in scope. The `prevState &&` guard makes the fresh-workspace case a no-op even though the predicate already handles null — harmless belt-and-suspenders.
- No `gate` name-shadowing bug: the block-scoped `const gate = requireQaEngineer(...)` at line 89 is confined to the `status === "PASS"` if-block; at line 164 `gate("FEATURE_LEASE_HELD")` correctly resolves to the module-level registry import.
- Expected-red manifest (SOP 4a): `qa_reports/expected-red_e1-feature-scoped-state-design.txt` present; sampled 4 of 9 entries across all 4 named files — each is a real, locatable test:
  - error-code-contract.test.mjs:167 ("exactly 24 entries") and :307 (union "byte-identical at 14 members") — count pins that MUST go red given catalog 24→25 and union 14→15.
  - hop-count-transitions.test.mjs:395 (t-e2e-feature-reset) — the fixture writes a new active_feature over a fresh incumbent, which the lease now rejects by design.
  - context-budget.test.mjs:924 (coordinator bundle ≤9545) and skill-manifest.test.mjs (t-golden-byte-identity) — coord-03 prose growth.
  Each red traces to a documented diff consequence (+1 gate, +1 union member, coord-03 growth); none indicates a logic regression. All are genuine qa-owned re-baselines (T-E1-05). The manifest's SUFFIX_RE claim is verified: error-code-contract.test.mjs:73 lacks `HELD`, so the QA-side fix is adding `HELD` to the vocabulary, NOT renaming the spec-mandated code — correct call.

## Quality
No findings. The predicate is a clean runtime leaf (zero import edges, structural `FeatureLeaseFields` param) matching the sibling `gates/scope-decision.ts` / `gates/cut-approval.ts` convention. Registry entry, orchestrator comment, and both skill edits are consistent in terminology. Doc-file mapping comment (gates/registry.ts) correctly adds `FEATURE_LEASE_HELD → coord-03-core-fallback.md`, and the code IS backtick-quoted there, satisfying `documentedInProse: true`.

## Architecture
Conforms to the spec's Decision Records. (a-min) honored: derive-only, no schema bump, gate in the orchestrator (not the pure `transitions.ts`, which takes a union-only extension), uniform across file + SQLite mode (the gate is unconditional, not behind a `FileHandoffStorage instanceof` guard, because the three fields exist in the SQLite row). T-E1-03 spec-deviation adjudicated SOUND: `skill-coordinator.md` was split into `coord-0*.md` fragments; `coord-03-core-fallback.md` is the correct successor — it already houses the Escalation-Routes table and the sibling Cut-approval / External-refs / Hop-counter-scope gate content, so the new note and row land adjacent to their exact analogues, and doc-parity is preserved.

## Security
No findings. No new trust boundary; the predicate consumes already-parsed handoff fields and the envelope echoes only server-derived state. No secrets, no injection surface.

## Performance
No findings. The gate is one O(1) predicate over three fields per write, on an already-loaded `prevState`; no new I/O, loops, or allocations of concern.

## Verdict
APPROVED — the implementation faithfully realizes the ratified (a-min) contract across T-E1-01/02/03 with zero findings in any category; the 9 expected reds are all genuine qa-owned re-baselines. See the flag adjudication below (non-blocking).

## Flag adjudication (sr-engineer → code-reviewer/PM)
Flag: post-release handback lands `(pm, In_Progress)`, not PASS, so starting a next feature within 30 min of a release trips `FEATURE_LEASE_HELD` until TTL expiry — although the spec sequence diagram (lines 255-256) shows "X reaches terminal PASS → lease released" immediately after handback.

Adjudication — ACCEPTABLE-AS-BOUNDED; code is correct, spec doc is the inconsistency.
- The predicate implements the PM-ratified formula (`status ∉ {PASS}`) exactly. sr-engineer correctly did NOT unilaterally alter the ratified clause. Since the post-release state is `pm:In_Progress` (non-terminal) and qa cannot re-issue PASS on an already-shipped feature, the lease is genuinely held for up to 30 min post-release.
- This is bounded and self-healing per the spec's own escape hatches: loud rejection, ≤30-min TTL auto-expiry, and the worktree route (distinct workspace_path). It does NOT corrupt state — it is the intended safety-over-parallelism posture.
- The defect is in the SPEC's illustration, not the code: the sequence diagram (line 256) and the prose calling `pm:In_Progress` "landing at terminal state" (lines 220-221) are inconsistent with the ratified `status !== "PASS"` predicate. Recommend a PM spec amendment to (1) correct the sequence diagram to show the lease persisting until TTL/PASS after handback, and (2) document the ≤30-min post-release cooldown as expected behavior (or scope a follow-on terminal-marker on release handback).
- This is a PM/spec-documentation concern surfaced upward — NOT a code defect, so it does not block this review.
