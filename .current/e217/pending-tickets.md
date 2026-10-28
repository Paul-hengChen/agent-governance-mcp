<!-- pending-tickets for lane e217 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E217-NEW-1
title: docs still describe pre-E217 --abandoned (specs/ never touched; E217 listed as a known gap)
priority: P3
depends_on: [E217]
source: pm, e217 cut (specs/e217-lane-lifecycle-gaps.md, Findings filed)
body: |
  After E217, `agc feature finish --abandoned` copies git-ignored, unlinked specs/ files into the
  primary checkout's specs/abandoned/<ticket>/<relpath> (fs copy, not committed; tracked specs stay in
  place on the kept branch). Two docs still describe the old behaviour: docs/install.md, the
  --abandoned step 2 sentence "`specs/` is never touched", and docs/lane-protocol.md §3, the
  artifacts-local bullet that lists E217 as a known gap and describes the --abandoned harvest as
  qa_reports/ + review_reports/ only. Both are outside lane e217's owned set (lane-protocol is
  common-forbidden in wave 11, and its §3 text is pinned by test/e351-lane-protocol-gaps.test.mjs,
  so the doc change and that test's pin move together).
```

## Applied
