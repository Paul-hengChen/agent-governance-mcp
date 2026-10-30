# Pending tickets — lane e383

```pending-ticket
lane_local_id: E383-NEW-1
title: specs/e260c-bin-scripts.md still describes the pre-E385 agc check worktree evidence advisory
priority: P3
depends_on: none
source: pm, e383 cut (specs/e383-lane-ledger-and-worktree-evidence.md D-E385-check)
body: |
  E385 flips the agc check linked-worktree evidence advisory: a real evidence directory
  is now silent (finish harvests it), and a symlink resolving outside the worktree now
  warns. specs/e260c-bin-scripts.md keeps the old trigger details and known false
  positives for this advisory, and bin/agc-init.mjs no longer points at it. Bring that
  section in line with the new table, or mark it as superseded. Lane e383 may not edit
  other specs/**.
```

```pending-ticket
lane_local_id: E383-NEW-2
title: In a workspace whose lane path is git-ignored, a tracked TODO.md or root tasks.md in a lane worktree becomes that lane's tw_* ledger
priority: P3
depends_on: none
source: pm, e383 cut investigation (tools/tasks-lane-migrate.ts resolveTasksLedgerPath, tools/config.ts DEFAULT_TASK_PATHS)
body: |
  E125a option A keeps any existing legacy task file as the ledger when the lane ledger
  path is git-ignored. In a linked lane worktree of a repo that tracks a TODO.md (or a
  root tasks.md) while ignoring .current/, findLegacyTasksFile returns that tracked file,
  so tw_add_task writes the lane's task rows into it and the lane commits them into a
  team file. E383 deliberately leaves this unchanged (legacy-file presence keeps AC4b
  semantics). A follow-up could exclude tracked non-agc files from the legacy lookup in
  lane worktrees, or require taskPaths to opt into TODO.md.
```

## Applied
