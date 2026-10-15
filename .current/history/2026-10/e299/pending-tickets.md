# Pending tickets — lane e299

New findings from this lane. Ids are assigned by the integrator at `agc feature finish`; blocks
above `## Applied` are pending.

## Applied

```pending-ticket
lane_local_id: E299-NEW-2
title: Evidence-Citation Convention asks for an archive folder name that does not exist at write time — 14 live done-marks predicted the wrong folder, 8 cite the root; the release that archives them will now fail check:bookkeeping
priority: P2
depends_on: [E299]
source: e299 PM prototype of check (2) on base 6b8a195
body: |
  coord-03's Evidence-Citation Convention (E87) requires a done-mark to cite
  <tree>/archive/<feature>/<file> before release-engineer 7a has created <feature>/; the folder
  is named at release time (observed: release-v4.0.0/, release-v4.1.0/, release-v4.2.0/,
  release-v4-wave6/ instead of the lane name the rows predicted). Measured on base: 46 dead
  citations (fixed mechanically in this lane), 14 predicted-archive citations whose file is
  still at the root, 8 root citations still at the root. The check tolerates the 22 with a
  note; the next release's 7a move turns each into a failure whose message names the resolved
  path. Options: (i) release-engineer 7a rewrites citations as part of the archive move
  (SOP line in content/skill-release-engineer.md, run check:bookkeeping before the release
  bookkeeping commit); (ii) change the convention to cite the basename only and let the
  check resolve it; (iii) make 7a's folder name predictable (the lane/feature name) so the
  convention's prediction is right. Belongs with the wave-2 content lane (E299 5c line).
```

```pending-ticket
lane_local_id: E299-NEW-3
title: specs/e260c-bin-scripts.md "why advisory, not fatal" rationale for the E88 rule is stale after E299 promotes it
priority: P3
depends_on: [E299]
source: e299 PM reading specs/e260c-bin-scripts.md lines 246–250
body: |
  The rationale section still explains why the done-mark position rule never affected the
  exit code (five shipped rows predating the check; Wave 1 lanes sharing docs/backlog.md).
  After E299 the rule is fatal and those rows are fixed. One paragraph to add (not rewrite):
  promoted by E299 on <date>, after the five rows were normalized. specs/e260c-* is outside
  this lane's ownership; doc-writer or the wave-2 content lane.
```
