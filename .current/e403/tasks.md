<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E403-01 [P1] sr-engineer: coord-03 line 1 Fallback disjuncts -> string coord03.fallback (host-neutral "subagent-dispatch tool"), rest of line unchanged (AC1, AC2) | depends_on: none
- [x] T-E407-01 [P1] sr-engineer: coord-05 Drift Reconcile body lines 18-29 -> string coord05.drift (trigger + named citation of Constitution §3 R10); heading + Visual Verdict Boundary unchanged (AC4) | depends_on: none
- [x] T-E407-02 [P1] sr-engineer: skill-coordinator-lite line 20 Hop cap-exempt bullet -> string lite.hopcap (pointer to Limits / §5) (AC5) | depends_on: none
- [x] T-E407-03 [P1] sr-engineer: skill-qa-engineer line 13 ownership bullet -> string qa.ownership (pointer to §3 tw_complete_task ownership) (AC6) | depends_on: none
- [x] T-E407-04 [P1] sr-engineer: skill-integrator line 38 Permissions first row -> strings integrator.row1.can + integrator.row1.cannot (ruling 2, report hunk) (AC7) | depends_on: none
- [x] T-E403-02 [P1] qa-engineer: re-pin e96 t-fallback-genuine-unavailability regex + message to the new disjuncts; new test/e403-*.test.mjs for AC1/AC2 (AC1-AC3) | depends_on: T-E403-01
- [x] T-E407-05 [P1] qa-engineer: new test/e407-*.test.mjs for AC4-AC7 (site text + citation resolves per composition); re-pin test/e336-portable-pull.test.mjs AC-E336-1 grant-name line-70 assertion to the §6 citation — ownership grant pending integrator pre-review (AC8) | depends_on: T-E407-01, T-E407-02, T-E407-03, T-E407-04
- [x] T-E407-06 [P1] qa-engineer: npm run build && node scripts/capture-constitution-golden.mjs (only skill-coordinator-monolith.txt may differ, hunks explained); re-measure lean/teamwork budgets, record before/after, no cap raised; final node scripts/test-lock.mjs -- npm test on last HEAD, dist/ clean (AC9-AC12) | depends_on: T-E403-02, T-E407-05
