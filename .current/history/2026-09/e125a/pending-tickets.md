# Pending tickets — lane e125a

## Applied

```pending-ticket
lane_local_id: E125a-NEW-1
title: tasks-file mutators resolve lock/target path before taking the lock — divergent per-process check-ignore caches can re-stamp a v2 index as v1
priority: P3
depends_on: [E125]
source: code-reviewer round 2 (O2-1), review_reports/review_T-E125A-05.md
body: |
  tools/tasks-file.ts:373-375, :452-454, :586-588, :767-771. Only reachable when two
  server processes hold different cached git check-ignore answers (e.g. .gitignore edited
  while both run): an ignored-mode add can append to a root another process just turned
  into the v2 index. Fix: re-resolve inside the lock and retry/refuse on path change.
```

```pending-ticket
lane_local_id: E125a-NEW-2
title: prompts/build.ts appendSpecContext listTasks call is unguarded against TASKS_LEDGER_ABSENT / TASKS_MIGRATION_BUSY
priority: P3
depends_on: [E125]
source: sr-engineer round 2 + code-reviewer round 2
body: |
  build.ts:401 is currently unreachable in file mode (early return at :375 without
  queryPrdSpec), so no crash today. If file storage ever gains RAG, wrap the call.
  prompts/** was off-limits to e125a.
```

```pending-ticket
lane_local_id: E125a-NEW-3
title: feat-lane first-match task rewrite can hit a duplicated task id in another lane's section
priority: P3
depends_on: [E125]
source: code-reviewer round 1 (O-2), still open after round 2
body: |
  Fix needs a line index on the public TaskRecord shape. Also minor: lane-ledger
  detection keys on a grandparent dir named `.current` (O2-2); zero-section feat lane
  still reads the whole root per call for the AC6b marker scan (O2-3).
```
