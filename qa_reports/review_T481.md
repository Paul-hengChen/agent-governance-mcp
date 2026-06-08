# QA review — T481

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-08T07:55:23.888Z — FAIL — by qa-engineer

FAIL — 2 test failures: (1) context-budget.test.mjs:59 cap 2300 exceeded (2348 stripped tokens, +250 from constitution additions); (2) skill-evolution-v3.11.test.mjs:50 asserts release-engineer must NOT be in transitions.ts, but A5 deliberately adds it. Both are caused by this PR. Fixes: raise context-budget cap to 2500; narrow v3.11 doesNotMatch to doc-writer only + add positive release-engineer match. T-MATRIX-A5-TEST new tests are correct and pass in isolation. .antigravityrules lines 1-4 must be excluded from PR staging (out-of-scope dirty-tree noise). npm audit: 1 pre-existing MODERATE hono — below HIGH threshold, acceptable."

