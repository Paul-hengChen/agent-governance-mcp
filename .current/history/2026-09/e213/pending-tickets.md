## Applied

```pending-ticket
lane_local_id: E213-NEW-1
title: finish --abandoned has no specs/ evidence harvest (--shipped gains one via this ticket's AC16)
priority: P2
depends_on: [E213, E180]
source: integrator pre-review ruling, 2026-09-27 (Q1) — coordinator message to lane e213 PM session
body: |
  This ticket (E213/E214/E216, lane e213) adds a git-ignored/unlinked evidence
  harvest for `specs/` to `--shipped` only (AC16: `specs/archive/<ticket>/`,
  same refuse/idempotent rules as `qa_reports/`/`review_reports/`). The
  integrator's pre-review ruling was explicit that `--abandoned`'s own
  `planAbandonEvidence`/`ABANDON_EVIDENCE_DIRS` (currently `["qa_reports",
  "review_reports"]` only) is NOT touched by this lane, so the identical loss
  shape — a git-ignored, unlinked `specs/<file>` deleted silently by
  `git worktree remove` — remains open for `finish --abandoned`. Fix shape:
  extend `ABANDON_EVIDENCE_DIRS` to include `specs`, deciding first whether
  `--abandoned`'s existing token-filtered, non-recursive move-into-
  `abandoned/<ticket>/` semantics apply unchanged to `specs/`, or whether
  `specs/` should get the same recursive/no-token-filter treatment E214/AC17
  established for `--shipped` (arguably `specs/` behaves more like a spec
  document tree than a flat evidence-report directory, so recursion may
  matter more here than it does for `qa_reports/`/`review_reports/`).
```

```pending-ticket
lane_local_id: E213-NEW-2
title: finish --shipped evidence harvest follows directory symlinks anywhere — a link like qa_reports/up -> .. copies lane tracked files and the worktree .git file into primary archive/
priority: P3
depends_on: [E214]
source: e213 code-reviewer round 1, recommendation R1 (review_reports/review_T01.md)
body: |
  AC17 dereferences resolvable symlinks, including directory links, and walks into them
  (loop-guarded). The walk has no containment check, so a directory link that points
  outside the evidence dir (up the tree, or at a large unrelated tree) makes the harvest
  copy everything it reaches into <primary>/<dir>/archive/<ticket>/. No data is lost; the
  harm is over-copying, plus possible pollution of primary. Fix shape: refuse loudly, or
  skip with an advisory, any directory link whose realpath is not under the lane's evidence
  dir, and keep dereferencing file links.
```

```pending-ticket
lane_local_id: E213-NEW-3
title: finish --shipped re-run refusal after a partial run (harvested, then worktree removal refused, then evidence edited) gives no recovery hint
priority: P3
depends_on: [E214]
source: e213 code-reviewer round 1, recommendation R2 (review_reports/review_T01.md)
body: |
  Run 1 copies the evidence into <dir>/archive/<ticket>/, then git refuses the worktree
  removal. The lane evidence is edited. Run 2 refuses because the destination differs
  (correct per AC8), but the message does not say that the differing copy came from this
  command's own earlier run, or how to proceed (remove the stale archive copy, or keep it
  and restore the lane file). Fix shape: extend the refuse line with a one-line hint.
```
