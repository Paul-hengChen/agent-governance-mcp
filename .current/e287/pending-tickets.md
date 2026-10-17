```pending-ticket
lane_local_id: E287-NEW-1
title: Document the pending-ticket target_repo field and finish's unallocated-findings warning in docs/lane-protocol.md §4 and the integrator SOP Stage 6
priority: P3
depends_on: [E287]
source: e287 architect hop (spec AC-E287-10; both files are forbidden to lane e287)
body: |
  lane-protocol §4: optional `target_repo: <repo>` marks a finding for another repo (no local id; archived and listed on stderr for a human ruling); a pending-tickets.md never committed to the branch is not numbered — finish warns and keeps a copy under .current/history/<YYYY-MM>/<lane>/. Integrator SOP Stage 6: rule on each listed target_repo finding and hand-file any warned unallocated finding.
```
