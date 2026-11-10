<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E196-01 [P1] sr (E196+E206; AC-E196-1..7): bin/agc-init.mjs — first-run tracked-shape finish (--shipped after the close commit, --abandoned partly-tracked) copies laneIgnoredStateFiles into .current/history/<bucket>/<lane>/ via a copy loop shared with executeHarvestRefresh; findings-target covered flags follow; strings e196.* (spec specs/e196-agc-init-lane-checks.md) | depends_on: none
- [ ] T-E196-02 [P2] sr (E225+E353; AC-E225-1..6): bin/agc-init.mjs — agc check lane-side pending-tickets advisory (same parse options as planPendingApply, prints every errors entry, exit code unchanged) + orphan detector treats errors.length>0 as unapplied (warn, never silent); docs/lane-protocol.md §6 one line doc.s6-agc-check | depends_on: T-E196-01
- [ ] T-E196-03 [P2] sr (E205; AC-E205-1..7): bin/agc-init.mjs — feature start saves primary's git status --porcelain -z --untracked-files=all to `git rev-parse --git-path agc-primary-status` in the lane worktree; feature finish (both dispositions) compares path sets before any check/mutation and warns naming every new path (finish's own output prefixes and the lane path excluded); exit code unchanged | depends_on: T-E196-02
- [ ] T-E196-04 [P1] qa (E196 tests): new test/e196-ignored-lane-state.test.mjs covering AC-E196-1..6 in temporary fixture repos; no real specs/fanout-*.md, no fixed base sha | depends_on: T-E196-01
- [ ] T-E196-05 [P2] qa (E225 tests): new test/e225-pending-tickets-check.test.mjs covering AC-E225-1..4 (lane-side advisory, silent cases, exit code, orphan branch with malformed-only file); AC-E225-5/6 by diff commands | depends_on: T-E196-02
- [ ] T-E196-06 [P2] qa (E205 tests): new test/e205-primary-side-effects.test.mjs covering AC-E205-1..5 and 7 (snapshot location, new paths named for both dispositions, pre-existing dirty paths not named, re-run names no history path, absent snapshot silent, snapshot gone after teardown) | depends_on: T-E196-03
- [ ] T-E196-07 [P1] qa (lane verification): no planned re-pins; on the final committed HEAD with a clean tree run AC-L1..L7 incl. the Node 20 fnm command in the spec and the full suite under node scripts/test-lock.mjs -- npm test (record qa_suite_result); non-owned red test -> stop and mail | depends_on: T-E196-04, T-E196-05, T-E196-06
