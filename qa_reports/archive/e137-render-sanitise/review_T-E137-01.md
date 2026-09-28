# QA review — T-E137-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-24T08:51:21.374Z — FAIL — by qa-engineer

FAIL (copy coverage gap, routed to pm). Every AC1-AC12 proof was executed and passes; full log in qa_reports/review_T-E137-05.md (covers T-E137-05, T-E137-06). AC3: e122 test unmodified, 7/7. AC8: context-budget unmodified, 54/54. AC-9 moved from full/omitted/saving 4525/1255/3270 to 4567/1296/3271 (floor 1200, headroom 2071). AC9: git diff --stat main/HEAD -- test/fixtures/compose-golden is empty, and compose-equivalence + e90-golden-capture-completeness + skill-manifest + render-structure are 60/60, exit 0. AC10: rag + rag-lifecycle unmodified, 61/61. AC12: npm test 2433/2433, exit 0 on run 3. Runs 1-2 hit a load flake in usage-accounting.test.mjs (5000ms spawn timeout, different test each run, 35/35 in isolation, untouched by this lane), filed as L-RENDER-NEW-3. New tests: test/e137-render-sanitise.test.mjs 13/13 and test/e137-rag-render.test.mjs 3/3, both mutation-verified (fixed fence, pre-E137 hook, pre-E137 appendSpecContext all go red). test/prompt-state-footer.test.mjs 24/24, with footer.bothpaths asserted in S01a/S01b. render-boundary coverage is 100%. The only FAIL ground is the Copy/Strings gap for STATE_LOOKUP_ERROR_ENVELOPE plus the S02 notice rewording.

## 2026-09-24T08:55:35.495Z — PASS — by qa-engineer

PASS (round 2, after the PM's Amend-Resume). Copy audit is byte-exact against the amended spec: state.lookup.envelope and state.lookup.notice match the live renderStateLookupFailedBlock output, state.envelope and spec.envelope match build.ts, and nothing is unsourced. Proofs re-run: AC3 e122 unmodified, 7/7. AC8 context-budget unmodified, 54/54; AC-9 full/omitted/saving moved from 4525/1255/3270 to 4567/1296/3271 (floor 1200, headroom 2071). AC9 golden fixtures show empty diffs vs main, vs HEAD and in status; the four golden-consuming suites pass 60/60, exit 0. AC10 rag suites unmodified, 61/61. The new and edited E137 tests pass 40/40, mutation-verified in round 1. AC12 npm test 2433/2433, exit 0. Full log is in qa_reports/review_T-E137-05.md (covers T-E137-05, T-E137-06; implementation T-E137-01..03).

