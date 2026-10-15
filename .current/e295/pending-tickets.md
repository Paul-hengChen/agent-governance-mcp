<!-- pending-tickets for lane e295 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E295-NEW-1
title: skill-integrator Stage 6-4 BEHIND remedy still names a local full suite before the push
priority: P3
depends_on: [E298]
source: qa-engineer, E295 QA round (code-reviewer R3 note)
body: |
  After E298's SOP half the layers verify by CI on the pushed branch, but the Stage 6-4 BEHIND remedy
  still says to run the full suite locally before pushing. Outside E295 AC7 scope and harmless; align it
  with the CI-first rule (local suite only under the CI fallback).
```

```pending-ticket
lane_local_id: E295-NEW-2
title: release 7a archive-folder basename collision (review_T-E298-01 / review_T-E300-01) at the next release
priority: P3
depends_on: [E301]
source: qa-engineer, E295 QA round (code-reviewer qa R2)
body: |
  Task ids T-E298-01 and T-E300-01 were reused by wave 2; wave-1 evidence files with the same basenames
  sit at the roots of qa_reports/ and review_reports/ and this lane adds batched files under other names
  but the review_reports files carry the same ids. When release 7a archives both waves, the same basename
  lands in one archive tree twice. check:bookkeeping resolves a root citation of such a basename to >1
  directories as a NOTE (E301 option ii, by design), not a failure, but the release-engineer should expect it.
  Candidate fix: lane-protocol section 3 task-id rule gains a wave suffix or a check that refuses a reused id.
```

```pending-ticket
lane_local_id: E295-NEW-3
title: spec/manifest citation counts for E301 are off (27 tolerated citations, 19 predicted-archive, not 22 / 14)
priority: P3
depends_on: [E301]
source: qa-engineer, E295 QA round (code-reviewer measurement on base 25bc84c)
body: |
  specs/e295-hop-cap-and-sop-halves.md and the E301 backlog row say 22 tolerated citations (14 predicted
  archive + 8 root). Measured on base: 27 (8 root + 19 predicted-archive). The integrator's one-time 5c
  rewrite to root form therefore covers 19 rows, not 14. Correct the counts in the backlog row / manifest
  before the 5c rewrite so the rewrite checklist is complete.
```

## Applied
