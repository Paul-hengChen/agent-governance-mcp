# Pending tickets — lane e406

## Applied

```pending-ticket
lane_local_id: E203-NEW-1
title: merge-invariants (c) passes silently when the compacting side summarized a row it added after the merge-base and the merge drops a row from the other side
priority: P3
depends_on: [E203]
source: pm, e406 review round 1 re-amendment (limit case found while re-deriving the (c) rule)
body: |
  Direction: false negative, SILENT (exit 0) — a real lost row is reported COMPACTED.
  Shape: one side adds a closed row (e.g. T-A-04) under section S after the merge-base,
  then compacts S into a manifest that counts it ("4 done"); the other side adds a
  closed row (T-D-01) under S; the merge drops T-D-01. T-A-04 is in neither parent's
  tree, so it never enters the union U of condition (c); the manifest's extra slot is
  taken by the dropped T-D-01, which is then reported COMPACTED.
  Present in every version of (c) since the R-1 union fix, not introduced by E203.
  The four snapshots the check reads (both parents, merge-base, merge) cannot tell this
  apart from a legitimately kept post-base row; closing it needs the compacting side's
  pre-compaction rows under S, which exist only in history between the merge-base and
  that parent. Recorded as an accepted limit in specs/e126-merge-invariants.md (c).
  Same family (code-reviewer, e406 review round 2): the NON-compacting side moves a base
  row out of S and adds T-D-01 under S; the merge keeps the moved row in its new section
  and drops T-D-01 -> PASS with T-D-01 reported COMPACTED. Also pre-existing (same result
  before E203).
```
