## Applied

```pending-ticket
lane_local_id: E287-NEW-1
title: Document the pending-ticket target_repo field and finish's unallocated-findings warning in docs/lane-protocol.md §4 and the integrator SOP Stage 6
priority: P3
depends_on: [E287]
source: e287 architect hop (spec AC-E287-10; both files are forbidden to lane e287)
body: |
  lane-protocol §4: optional `target_repo: <repo>` marks a finding for another repo (no local id; archived and listed on stderr for a human ruling); a pending-tickets.md never committed to the branch is not numbered — finish warns and keeps a copy under .current/history/<YYYY-MM>/<lane>/. Integrator SOP Stage 6: rule on each listed target_repo finding and hand-file any warned unallocated finding.
```

```pending-ticket
lane_local_id: E287-NEW-2
title: Make agc feature finish converge when a lane's pending-tickets.md is a symlink (unallocated-findings preserve)
priority: P3
depends_on: [E287]
source: code-reviewer E287 review round 2 (round-1 finding R3, deferred)
body: |
  The O6 detector follows a symlinked lane pending-tickets.md (statSync), but the lane-close / abandon harvest copies the link as a link (cpSync), so the preserve post-check (lstat, regular file) fails with "a different file is already there" and every re-run refreshes the link again — finish never converges. Fail-closed is accepted today; decide between dereferencing in the harvest or a plan-time refusal with its own Copy string, then pin a regression test.
```
