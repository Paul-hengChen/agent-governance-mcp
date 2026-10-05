# Pending tickets — lane e260i

## Applied

```pending-ticket
lane_local_id: E260I-NEW-1
title: Two context-budget test titles state a cap that lags the asserted cap (pm says 4376, asserts 4401; sr-engineer says 2642, asserts 2852)
priority: P3
depends_on: [E260]
source: code-reviewer, e260i review round 1 (review_reports/review_T-E260I-11.md, non-blocking follow-up)
body: |
  In test/context-budget.test.mjs the skill-pm token-cap test is titled "meets ≤ 4376 cap"
  while its assert and message use 4401, and the skill-sr-engineer test is titled
  "meets ≤ 2642 cap" while its assert uses 2852. Earlier cap bumps fixed the same drift
  class twice (the lean bundle title and an older pm title). Test names are code, so the
  comment-only E260 lane could not touch them. Re-sync both titles to the asserted caps,
  and consider a small check that a "≤ N" in a budget test title equals the N in its
  assert (qa-engineer owns test/).
```
