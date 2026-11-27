<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E446-01 [P0] qa-engineer: write AC1-AC8 as tests in test/e446-doc-writer-close.test.mjs (Copy constants, base SOP frozen for AC5), list reds in qa_reports/expected-red_e446-doc-writer-close.txt; re-pin test/e408-core-task-alias-tail.test.mjs AC6 to the six C-RT1 lines (red until T-E446-03); test report with Scenario -> Test Map | depends_on: none (note: PASS — review_reports/review_T-E446-01.md)
- [x] T-E446-02 [P0] sr-engineer: apply C-DW1 (line 15), C-DW2 (line 32), C-DW3 (line 36) in content/skill-doc-writer.md byte-exact; file stays 36 lines (AC1, AC2, AC3, AC4, AC5, AC8) | depends_on: T-E446-01 (note: PASS — review_reports/review_T-E446-02.md)
- [x] T-E446-03 [P0] sr-engineer: C-RT1 in tools/role.ts (comment only), npm run build, commit rebuilt dist/tools/role.js, role.js.map, role.d.ts.map; confirm tools/transitions.ts untouched, full suite green, every expected-red entry green, diff vs 07a6d47 inside owned set; hand to code-reviewer (AC6, AC7, AC9) | depends_on: T-E446-02 (note: PASS — review_reports/review_T-E446-03.md)
