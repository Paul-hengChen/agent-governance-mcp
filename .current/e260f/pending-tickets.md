# Pending tickets — lane e260f

```pending-ticket
lane_local_id: E260F-NEW-1
title: Name git stash drop as forbidden in the sanctioned-git list, and warn that a judge's stash sweeps up its own uncommitted handoff write
priority: P3
depends_on: [E260]
source: coordinator, lane e260f code review round 2 (2026-10-01); integrator suggestion (mailbox to-lane#6)
body: |
  Constitution section 6 (sanctioned git operations) allows git stash and git stash pop but does not
  name git stash drop, which irreversibly discards the set-aside state. In lane e260f the round-2
  code-reviewer planted lines in a test file to prove the comment-only proof script catches them,
  ran git stash, then git stash drop. The stash also held the reviewer's own uncommitted handoff entry
  write and its dispatch-log line, so the drop discarded a governance write; the state on disk fell
  back one hop and the lane-status watch saw it as a regression. Nothing in test/ or the review report
  was lost. Proposal: (a) list git stash drop (and git stash clear) as forbidden next to the other
  irreversible operations; (b) in the code-reviewer and qa-engineer SOPs, say that a negative control
  runs on a copy of the file outside the worktree, not via stash, because tw_update_state writes stay
  uncommitted until the role commits them.
```

## Applied
