# Pending tickets — lane e260b

```pending-ticket
lane_local_id: E260B-NEW-1
title: Comment accuracy fixes in tools/i-z left after the E260 trim (one over-broad summary, one padded line, three comments stale since before E260)
priority: P3
depends_on: [E260]
source: code-reviewer, e260b review round 1 (review_reports/review_T-E260B-01.md, findings R1, O1, O3)
body: |
  Comment-only, non-blocking at review. R1: the trimmed JSDoc on enumerateLaneSidecarSources
  (tools/lane-paths.ts) says any copy that is a byte prefix of a counted copy is skipped; the code is
  narrower (empty files are never skipped; a history copy is compared only with its own lane's live
  copy). The exact rules are in specs/e260b-rationale.md; reword the summary to match. O1: the
  tools/lane-paths.ts header line "(resolveCurrentLane too)" reads as padding; naming the three fs
  helpers keeps the grep-pinned token count and says more. O3, stale at base b37178a:
  tools/merge-invariants.ts cites tasks-file.ts line numbers that were already wrong;
  tools/telemetry.ts says usage lives in .current/usage.jsonl (it is per-lane now);
  tools/lane-migrate.ts names readHandoffState as a wrapper caller (it calls the core directly).
  Each fix must keep the grep-pinned token counts (test/lane-paths, test/lane-migrate allow-lists)
  and stay comment-only.
```

## Applied
