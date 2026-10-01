# Pending tickets — lane e260g

## Applied

```pending-ticket
lane_local_id: E260G-NEW-1
title: Small comment and proof-script nits left in lane e260g's test files after the E260 trim
priority: P3
depends_on: [E260]
source: code-reviewer rounds 2-3 and the qa verifier, lane e260g (review_reports/review_T-E260G-09.md, review_reports/review_T-E260G-17.md, qa_reports/review_T-E260G-09.md)
body: |
  Non-blocking at review and QA; comment-only except the last item.
  test/gates-expected-red.test.mjs header says "U1-U12" but a U13 test exists.
  specs/e260g-comment-rationale.md (e5 section) says five tests but quotes only four phrases;
  the defaults test is not quoted.
  test/e92-e86-handoff-write-boundary.test.mjs has a ruler comment one "=" off its neighbour.
  test/lane-ticket-allocation.test.mjs line 4 is 133 columns in a file that wraps near 118.
  The lane's proof script (.current/e260g/proof.mjs, archived with the lane) has a widened
  bare-id check that misses range forms such as "E1A-1..7", and does not detect a
  whitespace-only reflow. Worth carrying into any future comment-trim proof script, not this one.
  Test-file edits are qa-engineer-only.
```
