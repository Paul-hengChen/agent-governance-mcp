# QA review — T-E177B-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-26T21:02:46.739Z — PASS — by qa-engineer

PASS — T-E177B-05/04/06 (lane-status + roll-up, test lock, mailbox watcher). Added qa-owned test/lane-paths.test.mjs CALLERS2 allow-list entry for tools/lane-status.ts + qa_reports/expected-red_e177b-lane-status-tooling.txt per the spec's ownership extension. Wrote 3 new test files (test/e177b-lane-status.test.mjs 20 tests, test/e177b-test-lock.test.mjs 19 tests, test/e177b-mailbox-watch.test.mjs 22 tests) covering AC1-AC20 + AC5a-d + AC13a-b via real git worktrees, real spawned child processes, and real filesystem locks. Full investigation of two full-suite-load findings, both resolved as test-quality fixes (not product defects): (1) a hang in the mailbox AC17 test caused by racing a real subprocess spawn against a real self-expiring deadline — fixed with a non-racing teardown-kill design, defensive --deadline/--max-wait safety nets on every spawned child, and per-test node:test timeouts across all three e177b test files; (2) one too-tight timing assertion (AC10, elapsedMs<2000 measured at 2407ms under full-suite CPU contention) — widened to a behaviorally-meaningful bound. Final official npm test (real lock-wrapped, clean committed tree): 2709/2709 pass, 0 fail. Details, AC Execution Log, and Expected-Red Diff in qa_reports/review_T-E177B-05.md.

