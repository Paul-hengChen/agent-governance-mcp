<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E425-01 [P0] qa-engineer: write AC1-AC14 scenario tests in test/e425-*.test.mjs (summary fixtures in temp dirs) + qa_reports/expected-red_e425-stop-ticket-batch.txt + test report | depends_on: none
- [x] T-E425-02 [P0] sr-engineer: docs/lane-protocol.md + docs/ticket-format.md text C-LP1, C-LP2, C-TF1, C-TF2, C-TF3 (AC1, AC5, AC6, AC8, AC10 text) | depends_on: T-E425-01
- [x] T-E425-03 [P0] sr-engineer: const-08, coord-03, coord-07, skill-integrator text C-C08, C-CO3, C-CO7, C-IN1..C-IN3 (AC2, AC3, AC4, AC14) | depends_on: T-E425-01
- [x] T-E425-04 [P1] sr-engineer: E427 amendment (2) SOP sentences C-QA (skill-qa-engineer step 6) and C-CR (skill-code-reviewer step 4a) (AC13, AC14) | depends_on: T-E425-01
- [x] T-E425-05 [P0] sr-engineer: scripts/batch-summary.mjs per C-BS / C-TF3, importing parseTicketFile + resolveTicketDir from dist (AC7-AC12); + docs/lane-protocol-addendum.md §5 bullet 2 one entry node scripts/batch-summary.mjs (integrator grant to-lane#5/#6); then planned return to qa-engineer | depends_on: T-E425-01
- [x] T-E425-06 [P1] qa-engineer (planned return): re-capture the 7 chain/coordinator compose goldens, re-set the 3 context-budget caps to measured values with per-hunk comments + delta vs E418 saving (AC15); + integrator-assigned re-pins: e118 AC7 size cap, e410 AC2 line pins, e349 TOOLS literal | depends_on: T-E425-02, T-E425-03, T-E425-04, T-E425-05
- [x] T-E425-07 [P0] qa-engineer (rework): AC16 test in test/e425-stop-ticket-batch.test.mjs; R2 trim comment blocks to <=7 lines (test/e425-stop-ticket-batch.test.mjs:1, test/context-budget.test.mjs:594/624/957, test/e118-reviewer-ac-completeness.test.mjs:223), comments only; update expected-red manifest | depends_on: none
- [x] T-E425-08 [P0] sr-engineer (rework): R1 replace docs/ticket-format.md Status values example reason with C-TF4 `stopped — vendor firmware not available yet` (example text only) (AC16) | depends_on: T-E425-07
