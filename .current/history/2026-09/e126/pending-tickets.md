# Pending tickets — lane e126

## Applied

```pending-ticket
lane_local_id: E126-NEW-1
title: No legal edge from qa-engineer:In_Progress (post-APPROVED) back to pm:In_Progress for a spec amendment
priority: P3
depends_on: [E126]
source: coordinator, e126 code-review round 1 (R-1 spec amendment; integrator to-lane#4)
body: |
  After code-reviewer APPROVED, the handoff sits at qa-engineer:In_Progress, whose only
  outbound edges are qa PASS/FAIL/Blocked. A spec defect found in review (e126 R-1) cannot
  route back to PM directly: the PM amendment write is rejected TRANSITION_REJECTED, so the
  chain must detour through a qa FAIL (burns a qa_round) or qa Blocked -> pm (E45 escape,
  +1 hop), and the PM amendment leaves no state write of its own. Same family as E45.
  Recommend post-v4.
```

```pending-ticket
lane_local_id: E126-NEW-2
title: merge-invariants compaction (c) union counts rows still present at the merge -> false MISSING (loud false positive)
priority: P3
depends_on: [E126]
source: code-reviewer, e126 round 2 (R2-1); integrator to-lane#5 chose post-v4 (human decision A)
body: |
  Direction: false positive, LOUD (exit 1 lists every task_id) - never a silent pass.
  Repro (cr, throwaway repo): lane compacts `## Wave` (3 [x] rows T-A-01..03) into a manifest
  "3 done"; main concurrently adds `- [x] T-D-01` under `## Wave`; the merge keeps T-D-01.
  U (spec condition (c), union across parents) = {T-A-01..03, T-D-01} = 4 done > 3 ->
  T-A-01..03 reported MISSING + LOST_DONE, exit 1, although nothing was lost.
  Fix (spec change first): U collects only closed task_ids NOT found at the merge. Rows present
  at the merge are already proven present by task_id; counting them adds no detection, only
  false failures. Verification points:
    1. the AC11 #4 5-vs-4 counter-example still FAILs;
    2. if the merge drops T-D-01, U = {T-A-01..03, T-D-01} = 4 > 3 still FAILs;
    3. only genuinely compacted rows are exempted.
  Pre-existing in the round-1 per-parent version too. Trigger needs compaction on one side of a
  merge plus a new row under the same section on the other; only e125c has compacted so far.
```
