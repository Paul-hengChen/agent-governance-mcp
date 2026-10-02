<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E260I-01 [P0] qa-engineer: write .current/e260i/proof.mjs per specs/e260i-budget-render-comment-trim.md (emit, leaves, scope incl. goldens, >20, 8-20, bare-id incl. range forms, directives, form, hygiene, pinned NUMHEADER_RE/BULLET_RE lines, width, reflow) | depends_on: none
- [ ] T-E260I-02 [P0] qa-engineer: create specs/e260i-comment-rationale.md skeleton (intro, Retained blocks table, one section per test file) | depends_on: none
- [ ] T-E260I-03 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 1-720 (13 blocks, ~293 counted); numbers/ceilings/assertions untouched | depends_on: T-E260I-01, T-E260I-02
- [ ] T-E260I-04 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 721-942 (3 blocks, ~156 counted) | depends_on: T-E260I-03
- [ ] T-E260I-05 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 943-1174 (2 blocks, ~222 counted) | depends_on: T-E260I-04
- [ ] T-E260I-06 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 1175-1430 (1 block of 250 counted) | depends_on: T-E260I-05
- [ ] T-E260I-07 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 1431-1696 (1 block of 249 counted) | depends_on: T-E260I-06
- [ ] T-E260I-08 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 1697-2216 (7 blocks, ~253 counted) | depends_on: T-E260I-07
- [ ] T-E260I-09 [P1] qa-engineer: trim comments in test/context-budget.test.mjs lines 2217-end (4 blocks, ~67) and test/render-structure.test.mjs lines 1-269 (4 blocks, ~135); NUMHEADER_RE/BULLET_RE code lines byte-identical | depends_on: T-E260I-08
- [ ] T-E260I-10 [P1] qa-engineer: trim comments in test/render-structure.test.mjs lines 270-end (5 blocks, ~104 counted) | depends_on: T-E260I-09
- [ ] T-E260I-11 [P1] qa-engineer (last author): lane-wide proof.mjs, then node scripts/test-lock.mjs -- npm test on clean committed HEAD (AC9, AC10), then write qa-engineer:Blocked next_role pm | depends_on: T-E260I-10
- [ ] T-E260I-12 [P1] qa-engineer (fresh verifier, Task dispatch, after code-reviewer APPROVED): re-run AC1-AC13 at final HEAD on clean tree, record evidence, write PASS | depends_on: T-E260I-11
