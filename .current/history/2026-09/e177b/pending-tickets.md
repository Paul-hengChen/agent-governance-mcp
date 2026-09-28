# Pending tickets — lane e177b

## Applied

```pending-ticket
lane_local_id: E177B-NEW-1
title: test-lock reclaimStale can delete a live lock when the stale lock file is empty (creator crashed before writing payload)
priority: P2
depends_on: [E177]
source: code-reviewer round 2 (review_reports/review_T-E177B-05.md, R2-2), reproduced deterministically via exported reclaimStale
body: |
  scripts/test-lock.mjs:201-207. The content-hash guard treats an empty lock as the same
  identity as a newer, still-empty lock (a new holder between openSync 'wx' and the payload
  write), so a late reclaimer deletes a live lock and two suites run at once.
  Fix: write the payload to a temp file and linkSync it into place, so a lock file is never
  observable empty. Rare, but it is exactly the E182 failure the lock exists to prevent.
```

```pending-ticket
lane_local_id: E177B-NEW-2
title: mailbox-watch second-watch refusal races with ≥3 concurrent watchers (rename-restore reclaim of the sidecar)
priority: P3
depends_on: [E177]
source: code-reviewer rounds 1-2 (review_reports/review_T-E177B-05.md)
body: |
  scripts/mailbox-watch.mjs still uses the rename-and-restore sidecar reclaim that
  T-E177B-04 replaced in test-lock (AC13a was scoped to test-lock only). Worst case is a
  duplicate watch on one file, i.e. the double-wake E177 set out to prevent. Port the
  test-lock guard-file reclaim (and the E177B-NEW-1 fix) to the watcher's sidecar.
```

```pending-ticket
lane_local_id: E177B-NEW-3
title: lane-status builds the lane .current/<lane> path by hand instead of lane-paths resolveLaneDir
priority: P3
depends_on: [E177]
source: code-reviewer round 2 (R2-1)
body: |
  tools/lane-status.ts:316-317 (voidedTaskIds) joins .current/<lane> manually; resolveLaneDir
  is on neither CALLERS allow-list (precedent tools/tasks-lane-migrate.ts:496-498). The file
  header comment also wrongly implies every lane-paths resolver has a caller allow-list.
  Behaviour is identical today; this is a drift risk only.
```
