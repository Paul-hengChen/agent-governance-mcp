# QA Review — T-CCL-01 (constitution-conditional-load)

**Verdict: PASS**
**Feature:** constitution-conditional-load — feature-conditional `design-only` load axis in `prompts/build.ts`
**Date:** 2026-06-11

## Authorship / provenance disclosure

The substantive QA work — authoring acceptance assertions AC1–AC8 in
`test/context-budget.test.mjs` and running them green in an independent
qa-engineer subagent context (fresh context, builder≠judge preserved: sr-engineer
built, code-reviewer approved, qa-engineer authored + ran tests) — was completed by
the dispatched qa-engineer subagent. That subagent hit the account session limit
*after* the test work was authored and green but *before* it could write this
evidence file, add the ledger task, and issue the PASS. The coordinator (main
`/teamwork` context) finalized the three remaining bookkeeping artifacts (this file,
`tw_add_task`/`tw_complete_task`, `tw_update_state` PASS), independently
re-running the full suite to confirm the verdict is reproducible. No verdict was
invented — the independent qa context reached it; this records it.

## Gates (re-run by coordinator at close-out)

- `npm test` → **623 pass / 0 fail** (was 608 before this feature; +15 new design-only/AC assertions).
- `npm run build` → zero tsc errors.
- `npm audit --audit-level=high` → only the pre-existing MODERATE hono advisory (does not gate per §6).
- `node scripts/check-version.mjs` → OK (3.32.0). package.json NOT bumped (release is human-owned).

## Acceptance Criteria

- **AC1 (non-design strips):** chain-role dispatch with no armed design file omits the §3.2 body + the four §3.1 visual bullets. ✅
- **AC2 (design loads full):** a `design/<active_feature>.md` with `## Mode` ≠ no-design keeps the full §3.2 + visual §3.1 text byte-equal to source. ✅
- **AC3 (safe default):** no state / no design file → behaves as non-design (strips). ✅
- **AC4 (semantics byte-unchanged):** every surviving rule is byte-identical to `content/constitution.md` source for its span; the gate only deletes a fenced span. ✅
- **AC5 / HC5 (composition):** all strip-axis permutations (lite/chain × design/non-design × fullDetail) are byte-clean with zero orphan `design-only` / `chain-only` / `rationale` markers. ✅
- **AC6 (anti-sweep — non-visual survives BOTH arms):** §3.1 scope-decision gate (`SCOPE_DECISION_REQUIRED`), §3.2 R10 (`tw_sync`/reconcile), and the §4 routing diagram survive on both the design and non-design arms. ✅
- **AC7 (lite interaction):** lite already strips chain-only (which contains §3.2); the design-only axis does not reintroduce it; lite + non-design is consistent. ✅
- **AC8 (floor rebaseline, independently measured):** rationale-stripped / design-path constitution 4161 → **4200 ~tok** (+39 from the 6 marker lines on the kept path); teamwork bundle → **7665 ~tok**; non-design design-stripped constitution pinned at **~3013 ~tok** (the budget win, regression-guarded). ✅

## Mechanism correctness (load-bearing)

- The arm probe in `build.ts` reuses `hasDesignModeRequiringVisual()` (`tools/evidence-file.ts:155`) — the **same** helper the server PASS gates call (`index.ts:747/816`). Agreement is identity-by-construction: the constitution text is present exactly when the server visual gates can fire, and stripped exactly when they are inert. No drift path exists. (Verified by code-reviewer; see `review_reports/review_constitution-conditional-load.md`.)
- HC2 byte-unchanged: `git diff content/constitution.md` is only 6 inserted marker-comment lines; R10 not relocated.

## Measured impact

- **−1,187 ~tok / dispatch** on non-design chain-role dispatches (4200 → 3013).
- **+39 ~tok / dispatch** on design-armed / rationale-only path (marker-line cost).
- Net win scales with the non-design share of the workload × chain hops.
## 2026-06-11T05:42:05.116Z — PASS — by qa-engineer

PASS — constitution-conditional-load. AC1–AC8 authored in test/context-budget.test.mjs by independent qa-engineer subagent, all green; full suite 623/0, build clean, audit only pre-existing MODERATE hono (does not gate), check-version OK 3.32.0. Arm probe reuses hasDesignModeRequiringVisual (tools/evidence-file.ts:155) = same signal as server PASS gates (index.ts:747/816) → strip/keep cannot drift from gate arming (HC1 identity-by-construction). HC2 byte-unchanged (only 6 marker lines added; R10 not relocated). HC4 anti-sweep verified both arms (L49 scope-gate, R10, §4 diagram survive). Impact: −1187 ~tok/dispatch non-design (4200→3013); +39 design path. Evidence: qa_reports/review_T-CCL-01.md.

