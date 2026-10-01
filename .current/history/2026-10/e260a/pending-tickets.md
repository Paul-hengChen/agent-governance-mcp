# Pending tickets — lane e260a

## Applied

```pending-ticket
lane_local_id: E260A-NEW-1
title: Comment trims leave tools/ files over agc check's 30% comment ratio, and some // file headers open with a first sentence over 80 columns
priority: P3
depends_on: [E260]
source: e260a code review (finding Q1) and QA (agc check advisory), 2026-10-01
body: |
  E260 caps comment block length. It sets no limit on a file's comment ratio and says nothing about // module-header summaries.
  After the e260a trim, agc check still warns that six files are over the 30% comment ratio: tools/config.ts, dispatch-log.ts,
  evidence-lookup.ts, handoff-parse.ts, handoff-types.ts and handoff-write.ts. Every one is lower than at base.
  Separately, several // file-header comments open with a first sentence over 80 columns, for example tools/fanout-manifest.ts,
  gate-stats.ts, dispatch-log.ts, exemptions.ts, handoff-types.ts and handoff.ts.
  Decide whether the Comment discipline summary rule covers // module headers and whether the ratio warning needs a follow-up trim.
  If both answers are yes, do it in one pass across all lanes' files after the E260 wave closes.
```
