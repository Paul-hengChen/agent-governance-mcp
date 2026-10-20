<!-- pending-tickets for lane e209 (E179). New blocks go ABOVE ```pending-ticket
title: usage-accounting hook tests still take up to ~11.5 s per spawn under 8 concurrent copies on 8 cores, so the 20 s ceiling is only ~1.7x headroom
priority: P3
depends_on: [E182]
source: qa-engineer round 1, e209 lane (qa_reports/review_T-E182-01.md, load evidence)
body: |
  After E182's runHook ceiling was raised from 5000 ms to 20000 ms (env override AGC_USAGE_HOOK_TEST_TIMEOUT_MS),
  3 rounds of 8 concurrent copies of test/usage-accounting.test.mjs on an 8-core host were all 35/35, but the
  slowest single hook-test spawn observed was 11.5 s (10.3 s second). That is more than 2x the old ceiling and
  only ~1.7x under the new one. Heavier multi-lane load (the e73/e124/e137 reports were at load ~7+ with other
  suites running) could still cross 20 s. Candidate follow-up: investigate why a no-op hook spawn (node cold start +
  dist import) takes >10 s under CPU saturation, or run the hook in-process for the pure cases, instead of only
  raising ceilings. Not a failure today; recorded as a data point.
```

## Applied. -->

```pending-ticket
lane_local_id: E209-NEW-1
title: test-lock reclaimStale guard file is created empty then written, so a stalled live reclaimer can still delete a live lock
priority: P2
depends_on: [E209]
source: code-reviewer round 1, e209 lane (review_reports/review_T-E209-01.md, AC-E209-6 ruling)
body: |
  E209 publishes the lock file itself via temp file + linkSync, so it is never observable empty.
  The reclaim guard (`<target>.reclaim-<digest>`) in scripts/test-lock.mjs still uses
  openSync("wx") followed by a separate write. If a live reclaimer stalls for CORRUPT_GRACE_MS or
  longer between creating its guard and writing it, a second reclaimer treats the empty guard as
  corrupt, removes it, takes its own guard, and reclaims the stale lock; a new acquirer then
  publishes a live lock, and the stalled reclaimer wakes, re-checks against its old observation
  and can remove that live lock. Reproduced deterministically in a scratch script by the reviewer.
  Same create-empty-then-write pattern E209 removed one level up. Suggested fix: publish the guard
  with the same temp file + linkSync approach. Pre-existing; out of E209's fixed scope (spec AC-E209-6).
```

## Applied
