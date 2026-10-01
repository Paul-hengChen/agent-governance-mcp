<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E260C-01 [P0] sr-engineer: write .current/e260c/check-invariance.mjs and measure.mjs per specs/e260c-bin-scripts.md "Verification approach"; run measure.mjs at base to confirm 58 mid / 17 large / max 81; no edits to bin/ or scripts/ | depends_on: none
- [x] T-E260C-02 [P1] sr-engineer: trim comments in bin/agc-init.mjs lines 1-900 at base (14 blocks: starts 2,153,263,315,340,361,395,671,722,738,751,784,855,873); move kept rationale to the spec's Kept rationale section; fix generic citations in range; check-invariance passes | depends_on: T-E260C-01
- [x] T-E260C-03 [P1] sr-engineer: trim comments in bin/agc-init.mjs base lines 901-2200 (15 blocks: starts 910,945,1043,1114,1288,1328,1342,1353,1363,1380,1400,1683,1898,1963,2089); same rules | depends_on: T-E260C-02
- [x] T-E260C-04 [P1] sr-engineer: trim bin/agc-init.mjs base lines 2201-end (8 blocks: 2257,2479,2848,2877,2892,2961,3303,3393) plus bin/agent-governance-context.mjs (5) and bin/agent-governance-usage-hook.mjs (1); same rules | depends_on: T-E260C-03
- [x] T-E260C-05 [P1] sr-engineer: trim scripts/capture-constitution-golden.mjs (2), check-md-tables.mjs (9), check-transitions-sync.mjs (1), check-version.mjs (2); same rules | depends_on: T-E260C-01
- [-] T-E260C-06 [P1] sr-engineer: trim scripts/fanout.mjs, feature-rollup.mjs, join-precondition.mjs, lane-status.mjs, mailbox-watch.mjs, measure-context-cost.mjs (2), merge-invariants.mjs, summarize-metrics.mjs (9 blocks total); same rules | depends_on: T-E260C-01 (voided: Re-cut: split into two 4-file tasks per integrator pre-review (task_size budget 5 files).)
- [x] T-E260C-07 [P1] sr-engineer: trim scripts/verify-release.mjs (7 blocks, longest 81) and scripts/test-lock.mjs (2); same rules | depends_on: T-E260C-01
- [-] T-E260C-08 [P1] sr-engineer: closing pass: run measure.mjs (no block over 20; list remaining 8-20 blocks for the review's keep reasons), check-invariance across all changed files, AC4/AC5/AC7/AC8 greps, record before/after counts in the spec; no further comment edits except leftovers | depends_on: T-E260C-02,T-E260C-03,T-E260C-04,T-E260C-05,T-E260C-06,T-E260C-07 (voided: Re-cut: depends_on must now include T-E260C-09.)
- [x] T-E260C-09 [P1] sr-engineer: trim scripts/mailbox-watch.mjs (1), measure-context-cost.mjs (2), merge-invariants.mjs (1), summarize-metrics.mjs (1) (5 blocks total); same rules | depends_on: T-E260C-01
- [x] T-E260C-10 [P1] sr-engineer: trim scripts/fanout.mjs, feature-rollup.mjs, join-precondition.mjs, lane-status.mjs (4 blocks total); same rules (replaces voided T-E260C-06) | depends_on: T-E260C-01
- [x] T-E260C-11 [P1] sr-engineer: closing pass: run measure.mjs (no block over 20; list remaining 8-20 blocks for the review's keep reasons), check-invariance across all changed files, AC4/AC5/AC7/AC8 greps, record before/after counts in the spec; no further comment edits except leftovers (replaces voided T-E260C-08) | depends_on: T-E260C-02,T-E260C-03,T-E260C-04,T-E260C-05,T-E260C-07,T-E260C-09,T-E260C-10
