<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E408-01 [P1] sr-engineer: replace the six core-fragment Task spans (coord-03:31/77/88/95, coord-05:5, coord-07:14) with Copy/Strings c03.31..c07.14 verbatim, rest of each line unchanged (AC1-AC4; specs/e408-core-task-alias-tail.md) | depends_on: none
- [x] T-E408-02 [P1] sr-engineer: templates/claude-code-agents/lite.md line 9, replace "(server rejects lite-mode writes)." with strings lite.forbid + lite.tier; lines 1-8, 10, 11 unchanged (AC5; G2-19) | depends_on: none
- [x] T-E408-03 [P1] sr-engineer: tools/role.ts lines 36-40 -> string role.comment (exactly five comment lines), npm run build, commit dist/tools/role.js + role.js.map; role.d.ts(.map) unchanged (AC6, AC7; G2-23) | depends_on: none
- [x] T-E408-04 [P1] qa-engineer: new test/e408-*.test.mjs (AC1, AC2, AC3 resident, AC5, AC6); re-capture goldens (only skill-coordinator-monolith may differ); re-measure budgets, no cap raised; review-time AC3/AC4/AC6/AC7; final test-lock npm test + check:bookkeeping + npm audit on last HEAD (AC8-AC10) | depends_on: T-E408-01, T-E408-02, T-E408-03
