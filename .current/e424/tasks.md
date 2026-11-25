<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E424-01 [P0] architect: specs/e424-per-scenario-acceptance-architecture.md — answer OQ-1..OQ-8 of specs/e424-per-scenario-acceptance.md, name the new predicate(s)/result shape in gates/ac-execution.ts, the orchestrator emit-site change and the test seams | depends_on: none
- [ ] T-E424-02 [P0] qa-engineer: write AC1-AC12 as tests in test/e424-*.test.mjs (fixtures under test/fixtures/ if needed) through tw_update_state; record reds (incl. test/e118 AC7 until T-E424-06) in qa_reports/expected-red_e424-per-scenario-acceptance.txt and interface details in qa_reports/tests_e424-per-scenario-acceptance.md | depends_on: T-E424-01
- [ ] T-E424-03 [P0] sr-engineer: gates/ac-execution.ts — ticket-citation reader (OQ-1/OQ-5), ticket read via parseTicketFile + resolveTicketDir (OQ-2/OQ-4), acceptance-record entry parser over the chosen section (OQ-3/OQ-6), per-scenario evaluation returning missing / not-passed / manual ids, ac.ticket.hint constant; new exports only, reads files only (AC1-AC7, AC9) | depends_on: T-E424-02
- [ ] T-E424-04 [P0] sr-engineer: tools/handoff-orchestrator.ts PASS_AC_EXECUTION_LOG step — proof: block runs first unedited and returns early on reject; ticket block runs after it on citation; ticket path emits Copy ac.ticket.order text; no-ticket path byte-identical; inside the file-mode branch; gates/registry.ts comment sentence only; npm run build (AC1-AC8, AC10, AC11, AC14) | depends_on: T-E424-03
- [ ] T-E424-05 [P1] sr-engineer: content/skill-code-reviewer.md step 8 per Copy sop.step8 (record format + ticket-path rule; keep the e433 AC5 pinned substrings); npm run build (AC12) | depends_on: T-E424-04
- [ ] T-E424-06 [P1] qa-engineer (planned single sr->qa return, uses 1 sr_return): move the test/e118-reviewer-ac-completeness.test.mjs size cap to measured + ~100 bytes with a re-baseline comment; re-check test/fixtures/compose-golden/** and test/context-budget.test.mjs caps against the final text (probe predicts unchanged), recapture only if moved, per-hunk explanation; then back through sr-engineer to code-reviewer (AC13) | depends_on: T-E424-05
