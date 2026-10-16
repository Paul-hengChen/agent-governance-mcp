# Pending tickets — lane e312

## Applied

```pending-ticket
lane_local_id: E312-NEW-1
title: tools/drift.ts reads the handoff with the same pick-then-read window E312 closed in readAndMigrate
priority: P3
depends_on: [E312]
source: code-reviewer, E312 T-E312-01 review round 1 (review_reports/review_T-E312-01.md, optional note)
body: |
  tools/drift.ts picks the lane or flat handoff path with existsSync and then reads it, without the
  lock. A concurrent flat<->lane migration rename between the two calls makes that read miss the
  file. Worst case seen in review: one schema-version drift advisory dropped for a single call.
  Fix shape: route the read through the same one-retry helper as tools/handoff-parse.ts, or call
  parseHandoff. Out of E312's cut (tools/drift.ts is not lane e312's file).
```
