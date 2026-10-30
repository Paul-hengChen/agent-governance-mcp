<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E384-01 [P1] sr (E384): parseDesignMode reads the declared token per candidate line (known -> return; unknown -> candidate yields nothing; no token -> pre-E384 earliest-known scan); doc comment; rebuild dist. touches gates/visual.ts, dist/gates/visual.* | depends_on: none
- [x] T-E386-01 [P1] sr (E386): handoff --check without --target uses the recorded 目標分支 (### 核對 primary), else main; REF_NOT_FOUND copy by target source (flag copy byte-identical); rebuild dist. touches tools/fanout-handoff.ts, dist/tools/fanout-handoff.* | depends_on: none
- [x] T-E346-01 [P1] sr (E346): compareExternalDeps accepts a sister root only when realpath(rev-parse --show-toplevel) equals realpath(declared root); --show-toplevel failure falls back to --git-dir; mismatch -> existing SISTER_REPO_NOT_GIT; rebuild dist. touches tools/fanout-handoff.ts, dist/tools/fanout-handoff.* | depends_on: T-E386-01
- [x] T-E384-02 [P1] qa (E384): new test/e384-design-mode-declared.test.mjs — AC-E384-1..3,5,6 incl. declared `code` with Figma in the explanation | depends_on: T-E384-01
- [x] T-E386-02 [P1] qa (E386): new test/e386-handoff-recorded-target.test.mjs — AC-E386-1..6, temp primary without main | depends_on: T-E386-01
- [x] T-E346-02 [P1] qa (E346): new test/e346-sister-nested-dir.test.mjs — AC-E346-1..3, nested plain-directory fixture + sister-subdir + symlink/linked-worktree acceptance | depends_on: T-E346-01
- [x] T-E384-03 [P1] qa (lane verification, E384+E386+E346): AC-E384-4/7, AC-E386-7, AC-E346-4, AC-L1..L3 on final committed HEAD; full suite under node scripts/test-lock.mjs -- npm test; no re-pins expected | depends_on: T-E384-02, T-E386-02, T-E346-02
