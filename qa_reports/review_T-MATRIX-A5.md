# QA review — T-MATRIX-A5

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-08T07:55:23.888Z — FAIL — by qa-engineer

FAIL — 2 test failures: (1) context-budget.test.mjs:59 cap 2300 exceeded (2348 stripped tokens, +250 from constitution additions); (2) skill-evolution-v3.11.test.mjs:50 asserts release-engineer must NOT be in transitions.ts, but A5 deliberately adds it. Both are caused by this PR. Fixes: raise context-budget cap to 2500; narrow v3.11 doesNotMatch to doc-writer only + add positive release-engineer match. T-MATRIX-A5-TEST new tests are correct and pass in isolation. .antigravityrules lines 1-4 must be excluded from PR staging (out-of-scope dirty-tree noise). npm audit: 1 pre-existing MODERATE hono — below HIGH threshold, acceptable."

## 2026-06-08T08:00:33.181Z — PASS — by qa-engineer

QA PASS — round 2. Two stale test-constraint files updated (qa-owned per §2): (1) test/context-budget.test.mjs:59 — cap raised 2300→2500 with rationale comment citing v3.27.0 governance-sync +250 token delta from 7 reviewed constitution edits; (2) test/skill-evolution-v3.11.test.mjs:50 — doesNotMatch(/release-engineer/) narrowed to doc-writer only; positive assert.match for release-engineer added documenting v3.28.0 A5 matrix promotion. Full suite: 544/544 PASS, 0 fail. npm run build: exit 0. node scripts/check-version.mjs: OK (3.28.0). npm audit --audit-level=high: 0 high (1 pre-existing MODERATE hono — below threshold, acceptable). Visual gate: design/constitution-v3.27-sync-consistency.md absent — silent pass-through. All ACs A1-A4, B1-B3, SKILLS, T-MATRIX-A5 confirmed green. STAGING NOTE: .antigravityrules lines 1-4 must NOT be staged — out-of-scope Boot Sequence insertion flagged LOW by code-reviewer and confirmed by prior QA round.

