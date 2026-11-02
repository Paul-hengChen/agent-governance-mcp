# QA review — T-RELPA1-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-02T07:08:38.048Z — PASS — by qa-engineer

suite-result: 3851/3853 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All of AC1-AC13 hold on main 8a79731 (Node 22.22.3, current version 4.16.0). Full suite 3851/3853 (2 skipped, same as lane), build clean with dist zero diff, check-version/bookkeeping/md-tables/agc check/transitions-sync green, npm audit high exit 0 (1 low, 6 moderate), eight CI runs success on Node 20+22, 47-path diff classified 34 e391 + 13 bookkeeping with untouched set empty, text-only claim holds (registries 35/18/13/12, schema versions, HOP_CAP 14, agc --help identical), AC10 old-vs-new probe matched exactly, AC11 literals old-vs-new confirmed, AC12 numstat and golden string classes exact. Baseline for release-engineer: CLAUDE.md '221 test files' x2 (lines 126, 158) vs 222 tracked at HEAD; per human ruling (a) release-engineer corrects at release time. Evidence: qa_reports/review_T-RELPA1-01.md (covers all five).

