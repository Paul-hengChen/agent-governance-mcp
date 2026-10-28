<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E217-01 [P0] sr: bin/agc-init.mjs — extract the --shipped ignored-evidence harvest (walk, at-risk, dangling/differs refusals, copy-apply) into one helper parameterised by dirs/bucket/verb/display; --shipped byte-identical, pure refactor (spec specs/e217-lane-lifecycle-gaps.md D-E217-3; AC-E217-10) | depends_on: none
- [ ] T-E217-02 [P0] sr: bin/agc-init.mjs --abandoned — copy-only, recursive, no-token-filter harvest of git-ignored unlinked specs/ into primary specs/abandoned/<ticket>/<relpath>; planned before first mutation, applied after evidence move and before .current harvest/worktree removal; escaped echoes; ABANDON_EVIDENCE_DIRS + tracked specs untouched; e217.usage-abandoned (D-E217-1..5; AC-E217-1..9, 11, 12) | depends_on: T-E217-01
- [ ] T-E215-01 [P1] sr: bin/agc-init.mjs feature start — after bootstrapLaneEnv, gitTry core.hooksPath in the lane; relative + missing dir in lane + present dir in primary -> one escaped e215.hooks-missing stderr warning; never throws, creates nothing, refusals/rollback unchanged, no nested node_modules hint (D-E215-1..4; AC-E215-1..8) | depends_on: T-E217-02
- [ ] T-E217-03 [P1] qa: test/e217-abandoned-specs-harvest.test.mjs (AC-E217-1..9, 12); test/e213-shipped-ignored-shape.test.mjs and test/e180-abandoned-harvest.test.mjs pass unmodified (AC-E217-10, 11) | depends_on: T-E217-02
- [ ] T-E215-02 [P1] qa: test/e215-start-hooks-path.test.mjs (AC-E215-1..6); test/e291-start-link-locations.test.mjs unmodified (AC-E215-7); AC-E215-8 grep; lane-wide full suite via node scripts/test-lock.mjs -- npm test on final HEAD, clean tree, listed existing tests unmodified (AC-LANE-1..3) | depends_on: T-E215-01, T-E217-03
