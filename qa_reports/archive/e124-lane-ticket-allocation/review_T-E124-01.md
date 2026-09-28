# QA review — T-E124-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-24T08:37:45.704Z — FAIL — by qa-engineer

test/lane-ticket-allocation.test.mjs authored (18 tests, AC1-AC8 proof: names verbatim, all PASS standalone and in full suite). Full npm test: 2433 tests, 2431 pass, 2 fail — both in test/check-md-tables.test.mjs (real-corpus check), root cause specs/e124-lane-ticket-allocation.md:204 malformed table (Visual Tokens N/A row has 3 cells, header declares 4), introduced in commit 5fd09da (T-E124-01), reproducible across 3 independent runs. Not golden, not context-budget, not caused by this round's test file. Fix: add missing — cell to match repo convention (see specs/watermark-hide-model-tier.md). See qa_reports/review_T-E124-02.md.

## 2026-09-24T08:53:40.865Z — PASS — by qa-engineer

Round 2 PASS. Re-review after sr-engineer's e2bc7db (spec-table-only fix: Visual Tokens N/A row 3→4 cells) and code-reviewer's Round 2 re-APPROVED (code unchanged since Round 1 APPROVED). Full npm test: 2433 tests, 2433 pass, 0 fail, 0 '^not ok' in the untruncated log ($TMPDIR/qa-e124/npm-test-round2.log). test/check-md-tables.test.mjs now clean (49/49). test/lane-ticket-allocation.test.mjs's 18 tests all pass standalone and in-suite. No flake encountered this run. AC1-AC9 all covered (see qa_reports/review_T-E124-02.md Round 2).

