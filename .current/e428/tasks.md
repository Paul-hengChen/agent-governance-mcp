<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E428-01 [P0] qa-engineer: AC1–AC12 tests in test/e428-tracker-mirror.test.mjs + qa_reports/expected-red_e428-tracker-mirror.txt; re-pin e445 AC10 BASE_SOP, e462 AC6 FROZEN_SW_SOP, e410 AC2 (integrator line 260→269, count 261→270), e430 AC8 (260→269) to the Copy (spec specs/e428-tracker-mirror.md) | depends_on: none
- [ ] T-E428-02 [P0] sr-engineer: C-SW1 + C-SW2 in content/skill-spec-workshop.md; C-TF1 in docs/ticket-format.md (AC1–AC5, AC7, AC8, AC10–AC12) | depends_on: T-E428-01
- [ ] T-E428-03 [P0] sr-engineer: C-IN1 in content/skill-integrator.md; C-CO1 in content/coord-01-core-head.md (AC3, AC6–AC12); last implementation task → planned return to qa-engineer (sr_return 1) | depends_on: T-E428-01
- [ ] T-E428-04 [P1] qa-engineer (planned return): re-capture test/fixtures/compose-golden/skill-coordinator-monolith.txt; set AC21 spec-workshop cap and teamwork bundle cap in test/context-budget.test.mjs to measured values (expected 1663 / 19699), one comment line each; explain every golden hunk (AC13) | depends_on: T-E428-02, T-E428-03
- [ ] T-E428-05 [P1] sr-engineer: confirm nothing left to build — full suite green, every expected-red entry green, diff vs 32e7f7e inside the owned set, no *.ts/dist/templates/tools change; hand to code-reviewer (AC13) | depends_on: T-E428-04
- [ ] T-E428-06 [P0] qa-engineer (amendment after review round 1, F1): update test/e428-tracker-mirror.test.mjs to the amended C-IN1 and C-TF1 (Copy constants IN_INTRO, IN_B, C_TF1; AC2, AC3 `No item, no write.`, AC7 "whatever the item", AC8 assertions; add the AC8 private-repository case: source [1234 rev 7], no map row, write-back on -> update, off/missing -> no write); refresh qa_reports/expected-red_e428-tracker-mirror.txt (probe reds AC2, AC3, AC5, AC6, AC7, AC8, AC12); update the Scenario -> Test Map; no other test file moves (spec specs/e428-tracker-mirror.md, Amendment after review round 1) | depends_on: T-E428-05
- [ ] T-E428-07 [P0] sr-engineer (amendment after review round 1, F1): apply the amended C-IN1 in content/skill-integrator.md (same 9 lines, file stays 269 lines) and C-TF1 bullet 2 in docs/ticket-format.md (same 3 lines) byte-exact; full suite green, every expected-red entry green, diff vs 32e7f7e inside the owned set; hand to code-reviewer (AC2, AC3, AC7, AC8, AC12, AC13) | depends_on: T-E428-06
