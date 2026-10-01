<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E260F-01 [P0] qa-engineer: author .current/e260f/proof.mjs (scope, emit via removeComments transpile with allowJs, AST leaf compare excl. JSDoc, directives, >20, bare-id, form, paths; flags --base/--changed-only/--list-mid), adapted from the e260d proof script; spec AC1-AC9, AC12 | depends_on: none
- [ ] T-E260F-02 [P1] qa-engineer: trim comments in test/e106..e120 (9 files, weight 449: e106 e108 e112 e114 e115 e116 e117 e118 e120) per spec disposition; append rationale/retained rows | depends_on: T-E260F-01
- [ ] T-E260F-03 [P1] qa-engineer: trim comments in test/e121..e125c (6 files, weight 436: e121 e122 e123b2 e123b9 e125a e125c) | depends_on: T-E260F-01
- [ ] T-E260F-04 [P1] qa-engineer: trim comments in test/e126..e137 (7 files, weight 425: e126 e128-blocked-self-loop-repro e128-orchestrator-blocked-repair e130 e132 e137-rag-render e137-render-sanitise) | depends_on: T-E260F-01
- [ ] T-E260F-05 [P1] qa-engineer: trim comments in test/e148..e177b (10 files, weight 411: e148-seed-stamp.mjs e148-stamp-provenance-seed e16 e164-e167 e166 e177a-check-cli e177a-manifest e177b-lane-status e177b-mailbox-watch e177b-test-lock) | depends_on: T-E260F-01
- [ ] T-E260F-06 [P1] qa-engineer: trim comments in test/e178a..e223 (10 files, weight 410: e178a e178b-cut-prereview e178b-fanout-unmatched e178b-lane-watch e18 e180 e20-e21 e213 e22 e223) | depends_on: T-E260F-01
- [ ] T-E260F-07 [P1] qa-engineer: trim comments in test/e23..e28 (18 files, weight 410: e23 e231 e234 e235a e235b e239 e24 e246 e248 e250 e258a e258b e259-brace e259-hash e259-limits e259-lib.mjs e26 e28) plus e24-exemptions.test.mjs:9 bare-id fix and e246 setupLane comment fix (AC10) | depends_on: T-E260F-01
