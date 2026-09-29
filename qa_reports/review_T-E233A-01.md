covers: T-E233A-01, T-E233A-02, T-E233A-03, T-E233A-04, T-E233A-05, T-E233A-06, T-E233A-07, T-E233A-08, T-E233A-09

# QA review, e233a-tools-comments (round 1): FAIL

Phase 0.5: skipped (no expected-red manifest). Phase 1.5: skipped (no Visual Baselines). Phase 3: no test changes (lane may not touch test/**).

## Spot checks (independent)
- AC1: comment-stripped transpile, base 6c61864 vs HEAD, 33 changed tools/*.ts files: 0 differ. PASS.
- AC3: exactly 1 line starting with the pinned watch-block prefix in tools/lane-status.ts. PASS.
- AC4: 0 added block-comment openers in tools/lane-status.ts. PASS.

## AC7 (suite unchanged): FAIL
Ran on a clean committed tree via the shared lock: 2958 tests, 2954 pass, 1 fail, 3 skipped.
Failing test: test/e234-hygiene-scan.test.mjs "AC16: an isolated copy of committed HEAD lists zero hits".
It reports two home-path hits, both in this lane's own committed prose:
- specs/e233a-tools-comments.md:28 (the AC8 proof line quotes the literal home-directory prefix inside a grep pattern)
- review_reports/review_T-E233A-01.md:82 (the AC8 note quotes the same pattern)
Base check: the same test file run at base 6c61864: 20 pass, 0 fail. The two files do not exist at base, so this is a regression introduced by the lane, not pre-existing.

## Fix requested (sr-engineer)
Reword both lines so the literal home-directory prefix does not appear (describe it in words, or split the pattern, e.g. build it as two fragments), keeping the AC8 meaning. Doc-only edits; no tools/ or dist/ change. Then re-run the suite on a clean tree.
## 2026-09-29T12:26:18.021Z — FAIL — by qa-engineer

AC1 (33 files, 0 differ), AC3, AC4 spot-checks PASS. Suite on clean tree: 2958 tests, 1 fail. The failing test is the e234 hygiene AC16 isolated-HEAD scan; it flags two home-path literals in this lane's own spec and review report (prose quoting the AC8 grep pattern). Same test file is 20/20 green at base, so this is a lane regression. Fix is doc-only: reword those two lines so the literal home-directory prefix does not appear, then re-run. Evidence: qa_reports/review_T-E233A-01.md.

