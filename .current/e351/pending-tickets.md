<!-- pending-tickets for lane e351 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E351-NEW-1
title: lane-protocol §3 task-row recovery fallback (git log --grep) finds no rows under artifacts local
priority: P3
depends_on: [E351]
source: pm, e351 cut (specs/e351-lane-protocol-gaps.md, Findings filed)
body: |
  docs/lane-protocol.md §3 says the generic fallback for finding a closed lane's task rows is
  `git log -i --grep <ticket>` (release SOP 7a, E125c). Under `artifacts: local` the lane ledger
  .current/<lane>/tasks.md is git-excluded and never committed, so the commits are found but the rows
  are not; the rows survive only in the .current/history/<YYYY-MM>/<lane>/ copy finish keeps in primary.
  State the local-mode recovery path (read the history copy) in the generic file and, if needed, in the
  release SOP. Out of E351's fixed scope (D2 covers the commit and findings rules only).
```

## Applied
