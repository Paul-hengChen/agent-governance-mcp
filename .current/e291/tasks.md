<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E291-01 [P1] sr: tools/config.ts parseNodeModulesLinks (D2) + WorkspaceConfig.nodeModulesLinks, no schema bump (D3); docs/config.md section; rebuild dist (AC-E291-11, AC-E291-13; specs/e291-start-link-locations.md) | depends_on: none
- [ ] T-E291-02 [P1] sr: bin/agc-init.mjs feature start — raw-read nodeModulesLinks from primary config (D4), per-location exclude rules (D5) + links (D6), root rendering byte-identical, usage text (AC-E291-1..10, AC-E291-12) | depends_on: T-E291-01
- [ ] T-E335-01 [P1] sr: bin/agc-init.mjs executeFindingsPreserve — replace a harvest-placed symlink destination with a regular file of the detector's bytes via temp+rename, covered destinations only (D7) (AC-E335-1..5) | depends_on: T-E291-02
- [ ] T-E291-03 [P1] qa: E291 tests in test/e291-*.test.mjs; re-pin owned lifecycle/config tests only if needed (AC-E291-1..13) | depends_on: T-E291-02
- [ ] T-E335-02 [P1] qa: E335 regression tests in test/e335-*.test.mjs (incl. abandoned re-run convergence a/b); regular-file finish tests + test/e246-mailbox-teardown.test.mjs green unmodified; lane-wide full suite on final HEAD, clean tree (AC-E335-1..6, AC-LANE-1..3) | depends_on: T-E335-03, T-E291-03
- [ ] T-E335-03 [P1] sr: bin/agc-init.mjs executeAbandonCurrentHarvest — --abandoned re-run converges when the lane pending-tickets.md is a symlink and the history copy already exists (regular file or link); history copy ends a regular file of the detector's bytes via the shared D7 helper; other lane files keep today's copy semantics (AC-E335-6; specs/e291-start-link-locations.md) | depends_on: T-E335-01
