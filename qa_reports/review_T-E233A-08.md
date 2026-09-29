# QA review — T-E233A-08

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-29T12:26:18.021Z — FAIL — by qa-engineer

AC1 (33 files, 0 differ), AC3, AC4 spot-checks PASS. Suite on clean tree: 2958 tests, 1 fail. The failing test is the e234 hygiene AC16 isolated-HEAD scan; it flags two home-path literals in this lane's own spec and review report (prose quoting the AC8 grep pattern). Same test file is 20/20 green at base, so this is a lane regression. Fix is doc-only: reword those two lines so the literal home-directory prefix does not appear, then re-run. Evidence: qa_reports/review_T-E233A-01.md.

