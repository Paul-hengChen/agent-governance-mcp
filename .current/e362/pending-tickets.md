<!-- pending-tickets for lane e362 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E362-NEW-1
title: test-lock acquireLock busy-spins (no sleep, no --max-wait check) while a dead-pid lock is blocked by a live or in-grace reclaim guard
priority: P3
depends_on: [E362]
source: pm, e362 lane cut (specs/e362-test-lock-guard.md, AC-E362-1 constraint)
body: |
  In scripts/test-lock.mjs acquireLock, the dead-holder branch and the corrupt-past-grace branch
  call reclaimStale(lockPath, lock.raw) and then `continue` straight back to the publish attempt.
  They skip both the poll sleep and the maxWaitMs check. When reclaimStale returns without
  reclaiming, the loop retries with no delay and never times out. That happens when the guard for
  that content is held by a live reclaimer, or is a corrupt guard still inside CORRUPT_GRACE_MS, or
  is unreadable. Normally a guard is held for microseconds, so this goes unnoticed. If a reclaimer
  stalls while it holds its guard (the E362 scenario), every acquirer burns a CPU core on fs
  syscalls for the whole stall, and --max-wait is not honored. Pre-existing; out of E362's fixed
  scope (the manifest says not to widen it). Suggested fix: when reclaimStale did not remove the
  target, fall through to the normal wait/notify/max-wait path instead of `continue`. This could
  be signalled by a boolean return value, or by re-reading the lock and comparing it with the raw
  content observed before the call.
```

```pending-ticket
lane_local_id: E362-NEW-2
title: e177b-test-lock AC9 and AC13a go red under multi-lane load on fixed wall-clock / timeout budgets (same class as E224)
priority: P3
depends_on: [E224]
source: qa, e362 lane (T-E224-01 load runs)
body: |
  While loading the E224 files with 8 concurrent copies of test/e177b-test-lock.test.mjs and
  test/e177b-mailbox-watch.test.mjs on an 8-core host (load average about 25), three rounds showed
  AC9 ("a nested test-lock under the SAME --lock-path returns promptly") red 3 times with
  "took 10140ms", "took 10000ms" and "took 18377ms" against its fixed elapsed < 10_000 bound, and
  AC13a ("5 processes racing to reclaim ONE dead-pid lock") red once on the 20000 ms node:test
  timeout. With 16 copies (2x cores) AC13a, AC7, AC13 (queues) and the corrupt-payload security
  case also timed out. All pass alone. Same cause as AC10: the elapsed bound includes node spawn
  latency. Suggested fix for AC9: judge the nested run by the wrapper's own clock rather than the
  outer wall clock. Out of E362 scope: the lane may touch only AC10/AC13b in
  test/e177b-test-lock.test.mjs.
```

## Applied
