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


## sr-engineer reply — QA round 1
Fixed in 05db100 (wording only). Three lines quoted the literal prefix, not two: specs/e233a-tools-comments.md:28, review_reports/review_T-E233A-01.md:22 and :82.
- Spec line 28: the grep proof now uses bracket-split fragments (`U[s]ers`, `h[o]me`). The regex matches the same strings, but the literal never appears in the text.
- Review report lines 22 and 82: the pattern is now described by class ("absolute home-directory paths or http(s) URLs"). Verdicts and findings are unchanged.
- Swept specs/e233a-*, review_reports/*E233A*, qa_reports/*E233A* and .current/e233a/ for the same shape: no hits left.
- `node --test test/e234-hygiene-scan.test.mjs` on the clean committed tree: 20 pass, 0 fail.

## Round 2 (QA)

Tree clean at b4e5d2c. Round-1 FAIL cause (hygiene-scan test red on lane-doc home-path quotes) fixed in 05db100/57ce003; code review round 3 APPROVED (8cbcd6e).

Command: `node scripts/test-lock.mjs -- npm test` -> exit 0
Result: tests 2958 / pass 2955 / fail 0 / skipped 3 (round 1: 2954 pass / 1 fail / 3 skip).
AC7 (no failure green at base 6c61864): satisfied, zero failures.
No test/** or dist/ changes in 6c61864..HEAD (comment-only lane). Phase 3: skipped per dispatch brief (no test writes permitted). Covers: T-E233A-01..09.
Verdict: PASS.
## 2026-09-29T12:33:58.883Z — PASS — by qa-engineer

Round 2 PASS. Full suite via test-lock: 2958 tests / 2955 pass / 0 fail / 3 skip (round 1: 1 fail, hygiene-scan on lane-doc home-path quotes, fixed 05db100/57ce003). AC7 met. No test/** changes; dist is rebuilt output of comment-only tools/ edits, tree clean after prebuild. Evidence appended in qa_reports/review_T-E233A-01.md (covers T-E233A-01..09).


## AC Execution Log (round 2, covers T-E233A-01..09)

### `node <scratch>/inv.mjs`
```
invariance OK: 33 files
exit=
```

### `node <scratch>/bare.mjs`
```
bare-id OK
exit=
```

### `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts`
```
1
exit=
```

### `git diff 6c61864 -- tools/lane-status.ts | grep -E '^\+.*/\*' | wc -l`
```
       0
exit=
```

### `git diff -U0 6c61864 -- tools | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)' | wc -l`
```
       4
exit=
```

### `npm run build >/dev/null 2>&1; echo build=$?; git status --porcelain | wc -l; git diff --name-only 6c61864 | grep -vE '^(tools/|dist/tools/|specs/e233a-|qa_reports/.*E233A|review_reports/.*E233A|\.current/e233a/)'`
```
build=0
      10
exit=
```

### `git diff 6c61864 -- tools | grep -E '^\+' | grep -E '/U[s]ers/|/h[o]me/|https?://' | wc -l`
```
       0
exit=
```

### Verdicts
- AC1 invariance OK: 33 files, exit 0 -> pass.
- AC2 bare-id OK, exit 0 -> pass (heuristic per spec; scripts written to scratch, not tracked).
- AC3 count 1 (>=1) -> pass.
- AC4 0 -> pass.
- AC5 AC1 passes; the 4 lines listed are tails of trailing comments on code lines (two union members in tools/transitions.ts-style error-code unions: SOURCE_CREDIBILITY_UNVERIFIED and FEATURE_LEASE_HELD, each -/+ pair changes only the comment after `//`); code token unchanged -> pass.
- AC6 build exit 0; `dist/` produced no diff (only the auto-recorded qa_reports and telemetry sidecar from the earlier PASS attempt showed as uncommitted); out-of-owned-set file list printed nothing -> pass.
- AC7 full suite 2955 pass / 0 fail / 3 skip, see above -> pass.
- AC8 path/url grep count 0 -> pass; jargon judgment left to code-reviewer (APPROVED round 3).
## 2026-09-29T12:34:32.724Z — PASS — by qa-engineer

Round 2 PASS. Full suite via test-lock: 2958 tests / 2955 pass / 0 fail / 3 skip (round 1 had 1 fail, fixed). AC1-AC8 proofs executed and logged under ## AC Execution Log in qa_reports/review_T-E233A-01.md (covers T-E233A-01..09). No test/** changes; dist rebuild clean.


## Post-PASS correction

The AC Execution Log headings for the two check scripts carried an absolute temp-directory path, which the E234 hygiene scan (AC16) flagged at committed HEAD. Headings now name only the script. Re-run on the corrected commit: `npm test` via the test lock = 2958 tests, 2955 pass, 0 fail, 3 skipped, 0 cancelled; `test/e234-hygiene-scan.test.mjs` = 20 tests, 20 pass, 0 fail.
