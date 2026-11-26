<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E426-01 [P0] qa-engineer: write AC1-AC10 scenario tests in test/e426-ticket-scenarios-fixed.test.mjs (red at base except AC2/AC10, recorded as already green), qa_reports/expected-red_e426-ticket-scenarios-fixed.txt, test report; if ruling (5) is (a)/(b) re-pin test/e422-ticket-format-doc.test.mjs line 160 to `the test author` (integrator-assigned) | depends_on: none
- [x] T-E426-02 [P0] sr-engineer: content/skill-pm.md — C-PM1 and C-PM2, both on the Acceptance Criteria line, no new line (AC1, AC2, AC3) | depends_on: T-E426-01
- [x] T-E426-03 [P0] sr-engineer: content/skill-qa-engineer.md — C-QA1 (step 3), C-QA2 (step 4 sub-step h), C-QA3 (step 8 sr-engineer return) (AC4, AC10) | depends_on: T-E426-01
- [x] T-E426-04 [P0] sr-engineer: content/skill-sr-engineer.md C-SR1 (step 4c) and content/skill-code-reviewer.md C-CR1 (Clean context), C-CR2 (step 4) (AC5, AC6) | depends_on: T-E426-01
- [x] T-E426-05 [P1] sr-engineer: the ruled options — content/coord-07-core-sop.md (ii) per ruling (4) (C-CO7a/b/c or none) and docs/ticket-format.md per ruling (5) (C-TF1+C-TF2, C-TF2 only, or none) (AC7, AC8); last implementation task, then the planned return to qa-engineer | depends_on: T-E426-01
- [x] T-E426-06 [P1] qa-engineer (planned return, R3(b)): re-capture test/fixtures/compose-golden/skill-coordinator-monolith.txt if coord-07 changed; set each moved cap in test/context-budget.test.mjs to its measured value with a one-line comment (Copy ids, delta); move the content/skill-code-reviewer.md byte cap in test/e118-reviewer-ac-completeness.test.mjs AC7 to the measured size (integrator-assigned) (AC11) | depends_on: T-E426-02, T-E426-03, T-E426-04, T-E426-05
