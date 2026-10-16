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

## Applied
