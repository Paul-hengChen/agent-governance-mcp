<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E233F-01 [P1] sr-engineer: rewrite sole-explanation ticket-id references in content/skill-release-engineer.md to plain words (id kept only as trailing pointer); grep test/ before each edit and hold every pinned substring byte-identical; line-for-line, fences/code spans/normative keywords unchanged (specs/e233f-content-ids.md AC1-AC4, AC6-AC8) | depends_on: none
- [x] T-E233F-02 [P1] sr-engineer: same rewrite in the budget-capped content files: content/const-*.md, content/coord-*.md, content/skill-pm.md, content/skill-sr-engineer.md — net length-neutral or shorter after strip passes; Blocked + escalate if a rewrite cannot fit (AC1-AC8, esp. AC5) | depends_on: none
- [x] T-E233F-03 [P2] sr-engineer: same rewrite in the remaining content files: content/skill-integrator.md, skill-qa-engineer.md, skill-code-reviewer.md, skill-design-auditor.md, skill-qa-visual.md, constitution-rationale.md; record qa_reports/expected-red_e233f-content-ids.txt for golden/equivalence tests left red until T-E233F-04 (AC1-AC8) | depends_on: T-E233F-01, T-E233F-02
- [x] T-E233F-04 [P1] qa-engineer (author): rewrite id-only comments in test/context-budget.test.mjs and test/render-structure.test.mjs (comments only, ceilings/messages/names untouched); regenerate test/fixtures/compose-golden/** via scripts/capture-constitution-golden.mjs and explain each changed section in the authoring report; write qa-engineer:Blocked (authoring done) (AC5, AC9, AC10) | depends_on: T-E233F-03
