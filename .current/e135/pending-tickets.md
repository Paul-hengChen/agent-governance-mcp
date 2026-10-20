# Pending tickets — lane e135

```pending-ticket
lane_local_id: E181-NEW-1
title: completed_tasks ids containing a line break are serialised raw into handoff.md (same family as E181)
priority: P3
depends_on: [E181]
source: e135 PM, cut-time repro (spec open item O2)
body: |
  tools/handoff-write.ts writes each completed_tasks id as one "- [x] <id>" line and
  tools/handoff-parse.ts reads "- \[x\] (.+)" back, so an id carrying a line break
  splits on read-back and a continuation shaped "- [x] <other id>" would read as an
  extra completed id. The boundary (tools/registry.ts) accepts such an id today
  (z.string().max(500)). Exposure is narrow: only qa-engineer may grow the ledger and
  the QA Completion-Evidence gate checks per-id evidence for the literal id string.
  Fix shape: the same zod line-break rejection E181 adds for pending_notes.
```

## Applied
