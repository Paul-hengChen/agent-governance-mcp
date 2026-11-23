<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E445-01 [P0] qa-engineer: new test/e445-spec-workshop-questioning.test.mjs, one test per AC1-AC10 (titles start with AC id; base text frozen in-test; Copy / Strings pinned verbatim); qa_reports/expected-red_e445-spec-workshop-questioning.txt; qa_reports/tests_e445-spec-workshop-questioning.md | AC1-AC10 | depends_on: none
- [ ] T-E445-02 [P0] sr-engineer, last implementation task: edit content/skill-spec-workshop.md steps 2, 3, 4, 5 per spec Copy / Strings (exact text and order, nothing else); npm run build (no dist/ diff); full suite; append the AC21 red to the expected-red manifest; then the planned R3 return to qa-engineer | AC1-AC10 | depends_on: T-E445-01
- [ ] T-E445-03 [P0] qa-engineer, R3 return: measure the AC21 stripped token count on sr's SOP, set test/context-budget.test.mjs AC21 cap to it (zero headroom, one re-baseline comment, AC21 block only); record delta in the test report; hygiene run (AC12) | AC11, AC12 | depends_on: T-E445-02
- [ ] T-E445-04 [P1] sr-engineer: post-return confirmation - full suite on a clean tree, npm run build leaves dist/ unchanged, goldens byte-identical; no code change; hand to code-reviewer | AC1, AC11, AC12 | depends_on: T-E445-03
