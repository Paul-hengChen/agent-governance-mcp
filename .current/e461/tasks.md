<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E461-01 [P0] qa-engineer: test/e433-test-first-rules.test.mjs — pairing rule in AC1 (replaces keyword filter), qa SOP pairing + step 7 next_role in AC3, return-route 1 status in AC4, remove CLAUDE.md 250-line assertion in AC12; base green, M1a–M1d red (spec AC1, AC2, AC3, AC15) | depends_on: none
- [x] T-E461-02 [P0] qa-engineer: new test/e461-*.test.mjs — sr_return AC4–AC7 (one test per mutation M2a–M2d, behavioural) and SQLite RAG judge-PASS cleanup AC8 (skip with reason without binding) (spec AC4–AC8, AC10) | depends_on: none
- [x] T-E461-03 [P0] qa-engineer: test/e435-remove-old-path.test.mjs AC4 migration drop (M5); test/e419-retired-write-mechanisms.test.mjs full drift report + exact boundary rejection (M6a, M6b); test/e422-ticket-file.test.mjs README case + word boundary (M7a, M7b) (spec AC9–AC14) | depends_on: none
- [x] T-E461-04 [P0] qa-engineer: scripts/smoke-qa-flow.mjs qa PASS probe accepts only the tool-boundary judge rejection (M9a) and seeds review_reports/review_X1.md before the last probe (12/12, exit 0); qa_reports/expected-red_e461-mutation-test-gaps.txt with zero entries; qa_reports/tests_e461-mutation-test-gaps.md listing every mutation and observed result (spec AC16, AC17, AC18) | depends_on: T-E461-01, T-E461-02, T-E461-03
- [x] T-E461-05 [P0] sr-engineer: confirm nothing to build for AC1–AC3, AC15 (no source/content change; qa tests green on unchanged source); run test/e433-test-first-rules.test.mjs | depends_on: T-E461-04
- [x] T-E461-06 [P0] sr-engineer: confirm nothing to build for AC4–AC8, AC10; run the new test/e461-*.test.mjs file | depends_on: T-E461-04
- [x] T-E461-07 [P0] sr-engineer: confirm nothing to build for AC9–AC14; run the e435, e419, e422-ticket-file test files | depends_on: T-E461-04
- [x] T-E461-08 [P0] sr-engineer, last: run scripts/smoke-qa-flow.mjs (AC16 line; AC18 12/12 exit 0) and the full suite on a clean tree; confirm manifest still zero reds and git diff --name-only 83ca8c0..HEAD stays inside the Cut touches; hand off to code-reviewer (spec AC16, AC17, AC18) | depends_on: T-E461-05, T-E461-06, T-E461-07
