<!-- schema_version: 2 -->
# Tasks

## e383-lane-ledger-and-worktree-evidence

- [ ] T-E383-01 [P1] sr (E383, D-E383): resolveTasksLedgerPath in tools/tasks-lane-migrate.ts returns the lane ledger when the path is ignored AND no legacy file exists AND lane is not _primary AND <ws>/.git is a file (linked worktree); else unchanged; rebuild dist | depends_on: none
- [ ] T-E385-01 [P1] sr (E385, D-E385-check): rework checkWorktreeEvidence in bin/agc-init.mjs — real dirs and inside links silent, outside links warn worktree-evidence.outside-link, dangling warns worktree-evidence.dangling-link; drop now-unused helpers; self-contained comment; no other region changes | depends_on: none
- [ ] T-E385-02 [P1] sr (E385, D-E385): replace the Worktree bootstrap obligation paragraph (content/coord-03-core-fallback.md line 17) with Copy coord.bootstrap-obligation verbatim | depends_on: none
- [ ] T-E385-03 [P2] sr (E383+E385 docs): docs/lane-protocol.md — replace the §1 git-command bullet with doc.s1-git; insert doc.s3-ledger then doc.s3-evidence directly after the §3 E196 known-gaps line; no other line changes | depends_on: T-E383-01, T-E385-01, T-E385-02
- [ ] T-E383-02 [P1] qa (E383): new test/e383-lane-ledger-worktree.test.mjs covering AC-E383-1..5 and AC-E383-7 with real git init + git worktree add fixtures (ignored agc paths); run AC-E383-6 suites unedited | depends_on: T-E383-01, T-E385-03
- [ ] T-E385-04 [P1] qa (E385): new test/e385-worktree-evidence.test.mjs (AC-E385-1..5, AC-E385-8); re-pin test/agc-adapters.test.mjs E111 worktree-advisory cases and test/e130-lane-default.test.mjs AC6; re-capture test/fixtures/compose-golden/skill-coordinator-monolith.txt; re-pin test/context-budget.test.mjs only if a pinned number moves | depends_on: T-E385-01, T-E385-02, T-E385-03
- [ ] T-E385-05 [P1] qa (lane verification): on the final committed HEAD with a clean tree run AC-L1..L5 and every proof; full suite via node scripts/test-lock.mjs -- npm test; the unedited-suite list in the spec Cut row must stay green | depends_on: T-E383-02, T-E385-04
