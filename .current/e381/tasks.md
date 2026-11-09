<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E381-01 [P1] sr (E381): ownedPathTokens in tools/fanout-manifest.ts — drop globs inside a paren or a prose-led item of the 擁有 cell; parseManifest ownedTokens only; rebuild dist (spec D-E381, AC-E381-1..3,5,6) | depends_on: none
- [x] T-E381-02 [P1] sr (E390): check --base default = manifest 目標分支 (接手步驟) else main; baseSource-specific REF_NOT_FOUND copy; USAGE + scripts/fanout.mjs usage line; rebuild dist (spec D-E390, AC-E390-1..7) | depends_on: T-E381-01
- [x] T-E381-03 [P1] sr (E388): resolveTasksLedgerPath skips git-tracked legacy candidates in linked lane worktrees (tools/tasks-lane-migrate.ts); config.ts untouched; rebuild dist (spec D-E388, AC-E388-1..6) | depends_on: none
- [x] T-E381-04 [P1] qa (E381): new test/e381-owned-clause-tokens.test.mjs (AC-E381-1..3,5,6); re-pin test/e177a-manifest.test.mjs AC1 .current/e177a/ token | depends_on: T-E381-01
- [x] T-E381-05 [P1] qa (E390): new test/e390-check-recorded-base.test.mjs (AC-E390-1..6) | depends_on: T-E381-02
- [x] T-E381-06 [P1] qa (E388): new test/e388-tracked-legacy-ledger.test.mjs (AC-E388-1..5) | depends_on: T-E381-03
- [x] T-E381-07 [P1] qa (lane verification): AC-E381-4, AC-E390-7, AC-E388-6, AC-L1..L3 on final committed HEAD, full suite under test-lock; PASS lists T-E381-01..07 | depends_on: T-E381-04, T-E381-05, T-E381-06
