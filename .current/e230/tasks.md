<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E230-01 [P0] sr-engineer: E230 same-tuple PM amendment carries cut_approved in tools/handoff-write.ts (spec Decisions 1-2; explicit false clears), update resolution comment + e260a field-lifetime bullet, rebuild dist, write qa_reports/expected-red_e230-pm-amend-and-resume-hint.txt (Site Map rows 9, 11) | depends_on: none
- [ ] T-E151-01 [P0] sr-engineer: E151 rejection envelope in tools/transitions.ts step 4 — append two conditional allowed entries with requires.resume_of + hint suffix S1, for pm:In_Progress -> code-reviewer/qa-engineer:In_Progress only (spec Decision 5); no registry/table/orchestrator change; rebuild dist (check:transitions-sync exit 0) | depends_on: none
- [ ] T-E230-02 [P0] qa-engineer: rewrite red R2 in test/cut-approval-gate.test.mjs as amendment-carry pin; new test/e230-*.test.mjs covering AC1, AC2, AC4, AC5, AC6 | depends_on: T-E230-01
- [ ] T-E151-02 [P0] qa-engineer: rewrite red C1-07/AC-3 allowed assertion in test/qa-flow.test.mjs; new test/e151-*.test.mjs covering AC9-AC13 | depends_on: T-E151-01
