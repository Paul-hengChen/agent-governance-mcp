covers: T-E258B-01, T-E258B-02, T-E258B-03, T-E258B-04, T-E258B-05

# QA review — e258b-comment-scan (T-E258B-01..05)

Code review: APPROVED (review_reports/review_T-E258B-01.md). Tests authored: test/e258b-comment-scan.test.mjs (24 tests), fixtures test/fixtures/e258b/{lexer-mix,jsdoc-tags}.fixture.txt. Test-file placement: brief pre-authorized the new test file and fixtures; acted on that branch.

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Copy audit: the comments.* strings in tools/comment-scan.ts match the spec table; observed live output for block, ratio, more, summary and error.

## AC -> test map
AC1 AC1 test; AC2 AC2; AC3 AC3; AC4 AC4 x2 (scan, formatPct); AC5 AC5; AC6 AC6 (+ fixture); AC7 AC7 (+ fixture, pure lexer kinds and end-to-end); AC8 AC8 x2; AC9 AC9 x4 (branch/staged/unstaged/untracked/deleted, upstream, no-ref, hunk parser); AC10 AC10; AC11 AC11 x3; AC12 AC12; AC13 AC13 + the two existing suites; AC14 AC14; AC14b AC14b x2 (module source and this test file); AC15 AC15 test + git diff proof; AC16 git diff proof.

## AC Execution Log
- AC1..AC12, AC14, AC14b, AC15 (named-test proofs): `node --test --test-name-pattern "ACn" test/e258b-comment-scan.test.mjs` for each n; every run exit 0, fail 0 (AC1 pattern also selects AC10-AC15, 11 pass; AC14 selects AC14b, 3 pass). Whole file: 24 pass, 0 fail.
- AC13: `node --test test/agc-adapters.test.mjs test/e106-init-artifacts-flag.test.mjs` -> tests 57, pass 57, fail 0. The scan prints no line in those cases; the two files are untouched.
- AC15 diff proof: `git diff 2484ede...HEAD --stat -- docs/install.md docs/config.md` -> docs/config.md 1 insertion, docs/install.md 2 insertions; 2 added lines contain `agc check — comments`; no other section changed.
- AC16: `git diff --name-only 2484ede...HEAD` lists only .current/e258b/*, bin/agc-init.mjs, dist/tools/comment-scan.{js,js.map,d.ts,d.ts.map}, docs/config.md, docs/install.md, review_reports/review_T-E258B-01.md, specs/e258b-*, test/e258b-comment-scan.test.mjs, test/fixtures/e258b/*, tools/comment-scan.ts (this file adds qa_reports/review_T-E258B-05.md, inside `qa_reports/*E258B*`). Nothing under content/**; the two helper tests are not touched.

## Lane-diff evidence
`node bin/agc-init.mjs check` in the worktree after the test commit, exit 0:
agc check — comments: bin/agc-init.mjs high-ratio 30.5% of 3452 non-blank lines are comments (limit 30%)
agc check — comments: 1 warning(s) in 1 file(s) ... (summary line)
My test file and fixtures add no `agc check — comments` line (AC14b also asserts it). The review report quotes the same output and keeps the bin/ warning with a reason. Gap: the T-E258B-03 handoff text is not recoverable from the tree (only the final handoff exists in git), so that half was not independently checked; the live re-run above and the review report cover the content.

## Suite
`npm test` with a clean tree: tests 2982, pass 2979, fail 0, skipped 3.

## Verdict
PASS. Advisory notes carried from code review (D6 separator-deletion silence, unquoteGitPath astral characters) are not QA-blocking. Discovery while testing: a 100%-similar rename of a file with a long block produces no hunk and is silent (documented architecture behaviour); AC9 fixtures use distinct block text to avoid rename detection.
## 2026-09-30T08:46:43.822Z — PASS — by qa-engineer

PASS. 24 tests in test/e258b-comment-scan.test.mjs cover AC1-AC15 + AC14b; AC16 and AC15 diff proofs verified. npm test 2982 total, 2979 pass, 0 fail, 3 skipped (clean tree). agc-adapters + e106 suites 57/57, untouched. agc check after commit: only bin/agc-init.mjs high-ratio 30.5% (kept by code-reviewer); test file adds no comments line. Gap: T-E258B-03 handoff quote not recoverable from tree; review report and my live re-run cover it.

