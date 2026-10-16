# Pending tickets — lane e286

```pending-ticket
lane_local_id: E286-NEW-1
title: fanout check cannot check an arbitrary ref, so the mid-wave base-fix condition 2 (fix touches no lane-owned file) is compared by hand
priority: P3
depends_on: [E286]
source: pm cut, specs/e286-integrator-trust-and-git.md ruling R2
body: |
  `node scripts/fanout.mjs check <manifest> <lane>` diffs a manifest lane's branch
  against that lane's own owned set. The integrator SOP's mid-wave base-fix step needs
  the opposite question: does `git diff --name-only <lane branch>...origin/<target>`
  hit any lane's owned set. A mode taking a ref (or a path list) and checking it
  against every lane's owned set would make condition 2 mechanical.
```

## Applied
