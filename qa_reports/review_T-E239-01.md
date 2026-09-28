# QA review — T-E239-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-27T19:55:42.730Z — PASS — by qa-engineer

PASS T-E239-01 + T-E239-02. New test/e239-init-subdir-exclude.test.mjs (14 cases) covers AC1-AC13; AC14 verified by grep proof (docs/install.md:150). Additive AC3-regression case appended to test/e106-init-artifacts-flag.test.mjs (existing 17 assertions unmodified, 55/55 green with agc-adapters). Red-against-base repro run against lane base d0c66f0 confirmed AC1/AC2 fail pre-fix (root-anchored rules written regardless of cwd=sub; neither sub/.current/anything nor sub/tasks.md ignored); both green against the fix. Copy Audit Gate: all 3 spec Copy/Strings entries verified verbatim by exact-regex assertions. Full npm test on a clean, committed tree: 2853/2856 pass, 3 skipped, 0 fail (stable across 2 consecutive clean-tree runs; one earlier run showed a single transient failure that did not reproduce — consistent with this repo's known pre-existing flake class, not caused by this change). Backslash/control-char gap (code-reviewer F1) filed as lane finding E239-NEW-2, out of scope. Evidence: qa_reports/review_T-E239-02.md.

