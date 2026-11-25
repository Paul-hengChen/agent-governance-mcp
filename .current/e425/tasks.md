<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E425-01 [P0] qa-engineer: write AC1-AC14 scenario tests in test/e425-*.test.mjs (summary fixtures in temp dirs) + qa_reports/expected-red_e425-stop-ticket-batch.txt + test report | depends_on: none
- [ ] T-E425-02 [P0] sr-engineer: docs/lane-protocol.md + docs/ticket-format.md text C-LP1, C-LP2, C-TF1, C-TF2, C-TF3 (AC1, AC5, AC6, AC8, AC10 text) | depends_on: T-E425-01
- [ ] T-E425-03 [P0] sr-engineer: const-08, coord-03, coord-07, skill-integrator text C-C08, C-CO3, C-CO7, C-IN1..C-IN3 (AC2, AC3, AC4, AC14) | depends_on: T-E425-01
- [ ] T-E425-04 [P1] sr-engineer: E427 amendment (2) SOP sentences C-QA (skill-qa-engineer step 6) and C-CR (skill-code-reviewer step 4a) (AC13, AC14) | depends_on: T-E425-01
- [ ] T-E425-05 [P0] sr-engineer: scripts/batch-summary.mjs per C-BS / C-TF3, importing parseTicketFile + resolveTicketDir from dist (AC7-AC12); then planned return to qa-engineer | depends_on: T-E425-01
- [ ] T-E425-06 [P1] qa-engineer (planned return): re-capture the 7 chain/coordinator compose goldens, re-set the 3 context-budget caps to measured values with per-hunk comments + delta vs E418 saving (AC15) | depends_on: T-E425-02, T-E425-03, T-E425-04, T-E425-05
