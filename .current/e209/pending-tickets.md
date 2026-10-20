<!-- pending-tickets for lane e209 (E179). New blocks go ABOVE ## Applied. -->

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
