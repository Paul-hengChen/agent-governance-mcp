<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E430-01 [P0] qa-engineer: write AC1-AC4 scenario tests in test/e430-*.test.mjs (red at base), list them in qa_reports/expected-red_e430-mailbox-and-verify-rule.txt; test report with Scenario -> Test Map | depends_on: none
- [x] T-E449-01 [P0] qa-engineer: write AC5-AC6 scenario tests in test/e449-*.test.mjs (every dispatch mode incl. both hook outputs; red at base), add them to the same expected-red manifest | depends_on: none
- [x] T-E430-02 [P1] sr-engineer: content/skill-integrator.md - C-IN1 (Stage 4 relay bullet), C-IN4 (Stage 4 Watch bullet sentence, in place), C-IN2 (### Sessions outside a lane), C-IN3 (Take-over step 5) (AC1, AC3, AC4) | depends_on: T-E430-01
- [x] T-E430-03 [P1] sr-engineer: docs/lane-protocol.md §5 - C-LP1 (### 非 lane 的 session) (AC2) | depends_on: T-E430-01
- [x] T-E449-02 [P1] sr-engineer: content/const-15-core-tail.md §7 bullet C-E449 after Fail loud (AC5, AC6, AC7 content hunk); last implementation task, then the planned return to qa-engineer | depends_on: T-E449-01
- [x] T-E449-03 [P1] qa-engineer (planned return): re-capture the eleven §7 compose goldens; set the four context-budget caps to measured values (one-line comment each); re-pin skill-integrator.md rows and line count in test/e410-task-alias-content-tail.test.mjs (integrator-assigned) (AC7) | depends_on: T-E430-02, T-E430-03, T-E449-02
- [x] T-E430-04 [P0] qa-engineer (revision 2): write the AC8 scenario test pinning C-IN5 in test/e430-mailbox-outside-lane.test.mjs (red before sr), add it to qa_reports/expected-red_e430-mailbox-and-verify-rule.txt; update the test report's Scenario -> Test Map (AC8) | depends_on: none
- [x] T-E430-05 [P0] sr-engineer (revision 2): content/skill-integrator.md - C-IN5 into the Stage 4 Two-hour idle stop sub-bullet, same line, between "Then tell the human the watch stopped and why." and the byte-unchanged "Resuming - ..." sentence (AC8) | depends_on: T-E430-04
