# Pending tickets — lane e269

## Applied

```pending-ticket
lane_local_id: E269-NEW-1
title: skill-qa-engineer.md has 27 bytes left under its 17900-byte cap in qa-visual-skill-split; the next qa SOP edit will trip it
priority: P3
depends_on: [E269]
source: lane e269 coordinator, after the post-merge full suite (sr-engineer had to shorten the E269 negative-control sentence to fit), 2026-10-08
body: |
  test/qa-visual-skill-split.test.mjs (AC-5) caps content/skill-qa-engineer.md at 17900 bytes. After
  lane e269 the file is 17873 bytes. The E269 negative-control sentence had to be cut from 252 to about
  190 bytes to fit, and the reviewer noted its reason is terser than ideal because of the cap. Decide
  whether to re-baseline the cap (it dates from the v3.14.0 relaxation) or trim other qa SOP text, before
  the next ticket that adds a qa SOP rule hits it mid-chain.
```

```pending-ticket
lane_local_id: E269-NEW-2
title: feature-lease E10-AC2b test flaked once in a full-suite run
priority: P3
depends_on: none
source: code-reviewer, lane e269 review round 2 (review_reports/review_T-E269-01.md), 2026-10-08
body: |
  test/feature-lease.test.mjs around line 1008 (E10-AC2b) failed once in a full `npm test` run during
  lane e269's code review, then passed in the next full run and 5 of 5 isolated runs. The lane touched no
  tools, gates, dist or that test. Likely timing-dependent (lease TTL / last_updated). Investigate and
  make it deterministic.
```

```pending-ticket
lane_local_id: E269-NEW-3
title: Two nits in the new budget title-sync test — 8-line header comment over the 7-line advisory limit, and a cap on the line after test( is not checked
priority: P3
depends_on: [E269]
source: code-reviewer, lane e269 review of T-E269-05 (review_reports/review_T-E269-06.md, recommended/optional notes), 2026-10-08
body: |
  test/e269-budget-title-sync.test.mjs: `agc check` warns its header comment is 8 lines against a
  7-line limit (kept because it explains the override used for out-of-worktree negative controls); and
  the checker only reads a cap number from a title on the same line as `test(`, so a title wrapped onto
  the next line would be skipped (the found-count floor catches it only if the count drops). Trim the
  header and handle wrapped titles next time the file is touched (qa-engineer edit).
```
