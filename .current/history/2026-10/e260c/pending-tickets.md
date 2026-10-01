# Pending tickets — lane e260c

## Applied

```pending-ticket
lane_local_id: E260-NEW-1
title: skill-release-engineer cites a stale line range for the verify-release --close-out check
priority: P3
depends_on: [E260]
source: e260c sr-engineer, T-E260C-07 closing pass
body: |
  content/skill-release-engineer.md (step 13 reason paragraph) points at
  scripts/verify-release.mjs:113-125 for the --close-out rev-list assertion.
  The range was already wrong at base (the block sat around lines 153-193)
  and moved again when e260c trimmed comments. Line-number pointers into a
  script rot on every edit; cite the function or flag name instead.
  content/ is a shared generated input owned outside this lane.
```
