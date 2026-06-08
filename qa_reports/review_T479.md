# QA review — T479

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-02T10:46:52.202Z — PASS — by qa-engineer

T478 (transport/ HTTP staging): code-reviewer APPROVED; AC-B5.5 gatekeeper now covers transport/ — ok 279 PASS. T479 (test/release-staging.test.mjs): removed transport from EXCLUDED_DIRS, added transport/ to FEATURE_DIRS — AC-B5.5 test (ok 279) now detects transport/http.ts. T480 (test/subagent-templates.test.mjs): upgraded version regex escape from dots-only to full escapeRegExp idiom — AC8 version test (ok 360) PASS. Full suite: 499 tests, 0 fail, 0 skip. npm run build ZERO errors, check-version OK (3.23.1), npm audit 0 high vulns. QA report: qa_reports/review_T478-T480.md.

## 2026-06-08T07:55:23.888Z — FAIL — by qa-engineer

FAIL — 2 test failures: (1) context-budget.test.mjs:59 cap 2300 exceeded (2348 stripped tokens, +250 from constitution additions); (2) skill-evolution-v3.11.test.mjs:50 asserts release-engineer must NOT be in transitions.ts, but A5 deliberately adds it. Both are caused by this PR. Fixes: raise context-budget cap to 2500; narrow v3.11 doesNotMatch to doc-writer only + add positive release-engineer match. T-MATRIX-A5-TEST new tests are correct and pass in isolation. .antigravityrules lines 1-4 must be excluded from PR staging (out-of-scope dirty-tree noise). npm audit: 1 pre-existing MODERATE hono — below HIGH threshold, acceptable."

