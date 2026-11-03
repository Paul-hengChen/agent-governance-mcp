# QA review — T-RELPA3-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-03T11:08:22.844Z — PASS — by qa-engineer

suite-result: 3956/3958 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

AC1-AC15 all hold against 4.17.0 at main=origin/main=463f81a. Full suite under test lock, Node 22.22.3: 3958 tests, 3956 pass, 0 fail, 2 skipped (pre-existing), exit 0. 82-path classification exact (67 lane + 15 bookkeeping, untouched set empty); lane evidence and ancestry as specified; fresh build == committed dist (8 dist/tools files changed); check-version 4.17.0, bookkeeping 449/237/376, md-tables 701 OK; audit exit 0 (1 low, 6 moderate); agc check OK; 9 CI runs success on Node 20+22. AC10/AC11 old-vs-new probes printed exactly the expected lines (enum 9->10, coordinator loads in both host settings, release-engineer SOP 14434 bytes with 31 exit rows == EXIT_CLASSES, budget 21479->21515 under 21715); temp dirs cleaned. AC12 dry-run on main: prepare exit 10 WRONG_BRANCH, publish exit 42 PR_CANNOT_MERGE, close-out exit 50 CLOSING_WRITE_ABSENT; status unchanged, no release/* branch local or on origin; no real release.mjs phase run. Human rulings observed: (1a) CLAUDE.md says 223 test files at lines 126 and 158, actual 226 -> release-engineer fixes in the release commit; (2A) draft file now ignored (check-ignore exit 0, git add -n -- docs/ lists nothing, file present and untracked, not touched); AC15 (b) spec check: with-spec pass, without-spec SPEC_REQUIRE, so specs/release-prompt-audit-w3.md must be in the release commit. Report: qa_reports/review_T-RELPA3-01.md (covers all six).

