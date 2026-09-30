<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E258B-01 [P0] sr-engineer: tools/comment-scan.ts pure layer — comment lexer (// and block comments, string/template/regex literals), comment lines and blocks, JSDoc tag exclusion, D1 thresholds, hunk-range parser; no I/O | depends_on: none
- [ ] T-E258B-02 [P0] sr-engineer: comment-scan I/O layer — base resolution, git diff -U0 added lines plus untracked files, D3 file filter, finding rules D6, output/cap/summary D7, runCommentScan(cwd, {write}) that never throws | depends_on: T-E258B-01
- [ ] T-E258B-03 [P0] sr-engineer: wire loadCommentScan/checkComments into bin/agc-init.mjs runCheck() after the hygiene scan (exit code untouched, fixed-text comments.error), npm run build to emit dist/tools/comment-scan.js | depends_on: T-E258B-02
- [ ] T-E258B-04 [P2] sr-engineer: docs sync — docs/install.md agc check advisory paragraph and docs/config.md agc check rows only, describe the comment scan (AC15) | depends_on: T-E258B-03
- [ ] T-E258B-05 [P0] qa-engineer: author test/e258b-comment-scan.test.mjs and test/fixtures/e258b/** for AC1-AC16 (runtime temp git repos), add agc check — comments filter to the two pinned-output helper tests only if AC13 shows the scan printing there, run full suite after commit | depends_on: T-E258B-03
