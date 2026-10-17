<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E331-01 [P1] sr: wrap git diff in rangePaths + checkLane → exit 2 GIT_DIFF_FAILED, no stack trace (spec D3); rebuild dist. qa: test/e331-git-diff-failure.test.mjs (AC-E331-1..3) | depends_on: none
- [ ] T-E332-01 [P1] sr: widen handoff absolute-path boundaries/forms, narrow tilde form to exclude ~10/17 dates (spec D5); rebuild dist. qa: test/e332-absolute-path-boundaries.test.mjs + validate sweep (AC-E332-1..3) | depends_on: T-E331-01
- [ ] T-E330-01 [P2] sr: USAGE gains owners + handoff continuation lines, wrapper header updated (spec D4); rebuild dist. qa: re-pin e296 AC12 (3→5, AC12 only) + AC-E322-9 (AC-E330-1) | depends_on: T-E332-01
- [ ] T-E284-01 [P0] sr: new tools/fanout-handoff.ts — fact collection + D2 section rendering, --closing, flags, generate exit codes; handoff route in scripts/fanout.mjs; build dist. qa: test/e284-fanout-handoff.test.mjs (AC-E284-1..5, 10, 11) | depends_on: T-E330-01
- [ ] T-E284-02 [P0] sr: handoff --check — parse fact lines, background-無 rule, compare, DIFF/MOVED lines, summary, exit 0/1/2, HANDOFF_FACT_DUPLICATE (spec D1, D2, R1); rebuild dist. qa: AC-E284-6..9 + lane-wide AC-HC-1..3 | depends_on: T-E284-01
- [ ] T-E333-01 [P2] qa: test/e283-validate-handoff.test.mjs grammar cases → in-process validateManifest, ≤6 CLI cases, record before/after timing (spec D6, AC-E333-1) | depends_on: T-E332-01
