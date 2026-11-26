# Judge report — T-E425-07

covers: T-E425-07, T-E425-08

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff
Manifest: qa_reports/expected-red_e425-stop-ticket-batch.txt. Full suite (`node scripts/test-lock.mjs -- npm test`): 4758 pass / 0 fail / 3 skipped of 4761. Actual reds: none.
- test/e425-stop-ticket-batch.test.mjs | AC16: the Status values example reason for 'stopped — <reason>' is C-TF4, not a 'waiting on' form — scenario test, now green — built (T-E425-08).
- Earlier manifest entries (AC1–AC14) — scenario tests, green — built in T-E425-02..05 (unchanged this round).
- No red off the manifest.

## AC Execution Log
- AC16 (doc half) — `node --test test/e425-*.test.mjs` (AC16 test) — exit 0, 15/15 pass — pass
- AC16 (agc check half) — `node bin/agc-init.mjs check` — exit 0, zero `comments` warnings for any file (none for test/e425-stop-ticket-batch.test.mjs, test/context-budget.test.mjs, test/e118-reviewer-ac-completeness.test.mjs) — pass
- AC1–AC15 (regression) — `node scripts/test-lock.mjs -- npm test` — exit 0, 4758/4761 pass, 0 fail, 3 skipped — pass
- build — `npm run build` — exit 0, dist unchanged (clean tree after) — pass
- audit — `npm audit --audit-level=high` — exit 0 (1 low, 6 moderate; no high) — pass
## 2026-11-26T00:59:41.367Z — PASS — by code-reviewer

suite-result: 4758/4761 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Rework round (AC16, C-TF4; R1+R2) APPROVED. R1: docs/ticket-format.md Status values example is C-TF4 verbatim. R2: comment-only trims in e425/context-budget/e118 tests, no assertion/cap/expected value changed. AC16 test tight (one row, one example, not 'waiting on', equals C-TF4); agc check exit 0 with zero comments warnings. Build exit 0 (dist unchanged), npm audit --audit-level=high exit 0, e425 tests 15/15, full suite 4758/4761 pass 0 fail 3 skipped. Expected-red: AC16 now green, no red off manifest. review_report: review_reports/review_T-E425-07.md

