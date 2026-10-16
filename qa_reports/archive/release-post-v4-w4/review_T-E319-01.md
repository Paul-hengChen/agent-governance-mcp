# QA review — T-E319-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-16T07:32:11.476Z — PASS — by qa-engineer

PASS. E320/E319/E317 verified by 28 new tests (15 in new test/e320-ci-check-sha.test.mjs, +5 source-credibility, +5 visual-evidence, +3 e303), covering AC-E320-1..9, AC-E319-1..5, AC-E317-1..2 plus the reviewer must-tests (--sha "" and -x exit 1 without git/gh, non-array WARN, strict FAIL, resolved sha12 in stdout, full-sha argv with no --branch, poll-then-success, poll-exhausted FAIL, detached HEAD, no-sha path unchanged, multi-mode leftmost, E317 bare and trailing slash). Negative control on a cac3036 scratch copy: 18 new tests fail on base, both E317 .current tests fail on base. test/verify-release.test.mjs untouched (empty diff vs cac3036). Full suite via test-lock on clean tree at HEAD a08049c: 3213 tests, 3210 pass, 0 fail, 3 skipped. T-E321-01 audit: 4 of 4 files no change needed; hazards found in 2 non-owned files (e178a:283, e296:290), listed and filed as E321-NEW-1; E317-NEW-1 filed (lane-dir workspace_path still emits, confirmed by probe). Evidence: qa_reports/review_T-E320-02.md, qa_reports/review_T-E321-01.md.

