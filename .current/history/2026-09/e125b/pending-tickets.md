# Pending tickets — lane e125b

## Applied

```pending-ticket
lane_local_id: E125b-NEW-1
title: agc init scaffold .current/_primary/tasks.md directly at init time (X2)
priority: P3
depends_on: []
source: PM cut, specs/e125b-lane-close-writeback.md Out of Scope (X2)
body: |
  Recommended out of this ticket. The lazy forward-migration-on-first-write path
  (ensureTasksMigrated) already produces the identical end state on first
  tw_add_task, so this is a minor first-touch ergonomics gain, not a defect. Doing
  it well risks touching schema/** seeding parity with migratePrimaryForward's
  exact byte shape — worth a dedicated look, not a drive-by.
```

```pending-ticket
lane_local_id: E125b-NEW-2
title: agc feature finish --abandoned does not harvest a gitignored .current/<lane>/ before worktree removal
priority: P3
depends_on: []
source: integrator pre-review (agm-lanes/_mailbox/e125b/to-lane.md seq 1, REQUIRED-4), kept out for hop budget
body: |
  Today --abandoned moves only qa_reports/ and review_reports/ evidence into
  abandoned/ and keeps the branch (so a git-tracked .current/<lane>/ survives on
  the kept branch's own history). It never touches .current/<lane>/ itself. In a
  workspace where .current/ is git-ignored (the same adopter shape
  specs/e125b-lane-close-writeback.md AC9 harvests for --shipped),
  removeWorktreeNoForce deletes an abandoned lane's untracked .current/<lane>/ for
  good, with no harvest and no warning. Extending the AC9 fs-copy harvest (or an
  explicit refusal) to the --abandoned path is future work, not built in E125b.
```

```pending-ticket
lane_local_id: E125b-NEW-3
title: _primary tasks reverse migration refuses once finish --shipped has appended a ## Closed Lanes pointer to the root index
priority: P3
depends_on: []
source: sr-engineer, T-E125B-02 implementation review of tools/tasks-lane-migrate.ts migratePrimaryReverse
body: |
  migratePrimaryReverse (tools/tasks-lane-migrate.ts) refuses unless
  sha256(root index body after TASKS_INDEX_NOTICE) equals the forward-migration
  receipt's bodySha256. E125b's finish --shipped appends a ## Closed Lanes
  pointer line to that same root tasks.md index (and removes e125a feat
  markers), so after the first lane close the _primary reverse runner refuses
  with "body changed since the forward migration". Refusal is loud and loses no
  data, but the reverse escape hatch is effectively closed for any workspace
  that has closed a lane. Options: exclude the ## Closed Lanes section from the
  receipt hash, or have the reverse runner carry the section across.
  tools/tasks-lane-migrate.ts is not an e125b-owned file, so this is not fixed here.
```

```pending-ticket
lane_local_id: E125b-NEW-4
title: feature finish --shipped (tracked shape) drops git-ignored non-base-sha files under .current/<lane>/ on the first run
priority: P3
depends_on: [E125]
source: code-reviewer round 2 (review_reports/review_T-E125B-01.md), flagged by sr-engineer round 1
body: |
  In the tracked shape, the first --shipped run moves .current/<ticket>/ with git mv, which carries only
  tracked files; any git-ignored file under the lane dir other than base-sha (whose value is already in the
  pointer line) is deleted with the worktree. Predates E125b (AC1 covers tracked content only). Only hits an
  adopter that ignores individual governance files while committing the lane dir. Fix: apply the same
  laneIgnoredStateFiles copy the alreadyClosed re-run path uses on the first tracked run too.
```
