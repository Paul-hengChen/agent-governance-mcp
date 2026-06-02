# QA review — T464

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-02T06:17:42.116Z — FAIL — by qa-engineer

T469 FAIL: npm test produced 2 failures. (1) context-budget.test.mjs:59 — lean always-on bundle is 2403 tokens, exceeds 2100 cap; constitution §1 Watermark expansion added ~76 tokens. (2) subagent-templates.test.mjs:368 — hardcoded version assertion '3.22.1' fails against bumped 3.23.0. All content ACs pass. Evidence: qa_reports/review_T469.md

## 2026-06-02T06:39:31.803Z — PASS — by qa-engineer

Round 2 PASS. 488/488 tests pass (0 fail). Build clean. check-version OK (3.23.0). Failure 1 resolved: constitution §1 compressed to 2098 tokens (<=2100 cap); context-budget #14 passes. Failure 2 resolved: test/subagent-templates.test.mjs:368 version pin updated 3.22.1→3.23.0 by qa-engineer. All 10 ACs verified. watermark-check.test.mjs 15/15 unchanged. Templates unchanged. Non-blocking: AC1 self-detection is semantics-equivalent paraphrase (budget-forced); 2-token margin fragility logged as future headroom ticket. Evidence: qa_reports/review_T469_round2.md

