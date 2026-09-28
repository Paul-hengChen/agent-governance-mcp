# Pending tickets — lane e180

## Applied

```pending-ticket
lane_local_id: E180-NEW-1
title: finish --abandoned (tracked shape) also drops git-ignored sibling files under a partly-tracked .current/<lane>/ — same gap as E196 on --shipped
priority: P3
depends_on: [E196]
source: coordinator, e180 cut pre-review (integrator to-lane.md#1 point (a))
body: |
  E180/E194 AC7–AC8 harvest .current/<ticket>/ on --abandoned only when it
  has NO tracked content; a partly-tracked lane dir is treated as tracked and
  left to the kept branch, so any git-ignored files inside it (other than
  base-sha) are lost when removeWorktreeNoForce runs. This is the --abandoned
  twin of E196 (--shipped, tracked shape). Per-file harvest was rejected in
  the e180 cut: in a tracked-shape repo it would copy ignored files such as
  base-sha into primary's tracked .current/history/, leaving untracked noise
  on every abandon. Integrator intends to fold this into E196 at finish time,
  not open a separate ticket.
```

```pending-ticket
lane_local_id: E180-NEW-2
title: finish --abandoned .current/<ticket>/ harvest copies inner symlinks as links into the removed worktree (cpSync without dereference)
priority: P3
depends_on: [E180]
source: code-reviewer, e180 review round 1 (review_reports/review_T-E180-01.md, recommended R1; bin/agc-init.mjs ~1614)
body: |
  The E194 harvest realpaths the .current/<ticket> root but calls fs.cpSync
  without dereference: true, so a symlink INSIDE the lane dir is copied as an
  absolute link pointing back into the lane worktree; once
  removeWorktreeNoForce runs, that history entry dangles. Rare in practice
  (agc itself writes no symlinks under .current/<lane>/). Non-blocking in
  review; kept out of the e180 cut. Check whether --shipped's AC9 harvest
  (executeLaneClose cpSync) has the same shape.
```
