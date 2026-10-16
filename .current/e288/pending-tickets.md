# Pending tickets — lane e288

```pending-ticket
lane_local_id: E323-NEW-1
title: align docs/lane-protocol.md §3 historical-SHA allowance with the E323 "never diff against a fixed lane base sha" convention
priority: P3
depends_on: [E323]
source: pm, e288 cut (specs/e288-integrator-stage0-and-test-hygiene.md, Dependencies / Findings filed)
body: |
  docs/lane-protocol.md §3 still allows a resident test to pin a historical commit SHA when the assertion is
  inherently a historical diff, as long as it is guarded and loud-skipped (example: test/e130-lane-default.test.mjs).
  The E323 convention line in content/skill-qa-engineer.md says resident tests never diff against a fixed lane
  base sha. Make the two say the same thing: either narrow the §3 allowance or name it in the qa line as the
  one exception. Candidate vehicle: E290 (lane-protocol rewritten generically). Lane e288 does not own docs/**.
```

```pending-ticket
lane_local_id: E288-NEW-1
title: skill-integrator Stage 0 — name the 裁決者 value for the hand-off note Decisions row, and state that re-dispatching PM to revise the cut file is covered by the Stage 0 permission row
priority: P3
depends_on: [E288]
source: code-reviewer, T-E288-01 review (review_reports/review_T-E288-01.md, optional findings 2 and 3); integrator asked to file it (mailbox to-lane#2)
body: |
  Two wording gaps in the Stage 0 section of content/skill-integrator.md:
  (a) The cross-repo hand-off note becomes the manifest's first Decisions row, but the section does not say
      whether 裁決者 is 人類 or 整合者; validate accepts only those two values, so a wrong value fails loudly,
      but the SOP should name the expected one.
  (b) Stage 1 says to send a changed ticket back to PM. When the cut came from Stage 0, the SOP does not say
      that re-dispatching PM to revise the ticket-cut file falls under the "Stage 0 only" permission row.
  Write both explicitly.
```

## Applied
