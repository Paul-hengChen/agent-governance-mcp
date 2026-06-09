# QA review — T470

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-02T07:13:22.950Z — PASS — by qa-engineer

T470 (drift.ts archived-task filter), T471 (v3.23.1 bump), T472 (test/drift-archived-tasks.test.mjs): all 11 AC-1..AC-7 tests PASS; npm run build ZERO errors; check:version OK (3.23.1); npm audit 0 vulns; existing drift-skew 7/7 unaffected. Pre-existing SQLite/RAG failures are not regressions from this diff. Report: qa_reports/review_T470-T472.md.

## 2026-06-02T07:45:44.769Z — PASS — by qa-engineer

v3.23.1 FINAL PASS — Node v22.22.3 confirmed. npm test: 498/498 pass, 0 fail. Build: ZERO tsc errors. check:version OK (3.23.1). npm audit: 0 high/critical vulnerabilities. Drift smoke tests: (1) ## Completed archived tasks T470+T460 produce zero drift when handoff.completed_tasks=[] — driftDetected=false; (2) Active [x] T999 absent from handoff correctly fires vibe-coding drift. B4 payload: .nvmrc=22, engines.node=>=20 (Option Y no upper bound), version triple consistent at 3.23.1, test pin updated 4 sites, CHANGELOG [3.23.1] complete covering B3+B4. backlog.md B4 row marked done. Evidence: qa_reports/review_v3.23.1-final.md"

## 2026-06-02T08:09:20.822Z — PASS — by qa-engineer

PASS: 499/499 tests green. All B5/B2/B3/B1 ACs verified. See qa_reports/review_T473-T477.md.

## 2026-06-08T07:55:23.888Z — FAIL — by qa-engineer

FAIL — 2 test failures: (1) context-budget.test.mjs:59 cap 2300 exceeded (2348 stripped tokens, +250 from constitution additions); (2) skill-evolution-v3.11.test.mjs:50 asserts release-engineer must NOT be in transitions.ts, but A5 deliberately adds it. Both are caused by this PR. Fixes: raise context-budget cap to 2500; narrow v3.11 doesNotMatch to doc-writer only + add positive release-engineer match. T-MATRIX-A5-TEST new tests are correct and pass in isolation. .antigravityrules lines 1-4 must be excluded from PR staging (out-of-scope dirty-tree noise). npm audit: 1 pre-existing MODERATE hono — below HIGH threshold, acceptable."

## 2026-06-09T06:59:19.713Z — PASS — by qa-engineer

PASS — 595/595 green (was 572 with 13 stale v3→v4 version-pin failures, fixed as test-owner). +23 net tests. All AC-1..AC-10(a-g) + 5 arch edge cases mapped: gate fires on pm→{architect,sr-engineer}:In_Progress build-entry when design armed + no scope decision; cleared by scope_decision:single-feature or .current/feature-split.md; silent for no-design/non-build/non-In_Progress; re-entry (architect→sr-engineer, sr-engineer self-loop) not blocked; v3→v4 no-seed migrate-on-read, v5 refuse-loud; scope_decision + prd_path round-trip and survive omitting writes; transitions.ts pure; verbatim hint pinned both directions. npm audit: 0 high/critical (1 moderate hono, pre-existing/unrelated). Tests in test/visual-evidence-gate.test.mjs + test/handoff-migration.test.mjs.

