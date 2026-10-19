<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E226-01 [P1] sr-engineer: integrator SOP generic tool calls — add Tool calls paragraph (sop.tool-calls), every node scripts/<tool>.mjs -> node <agc install>/scripts/<tool>.mjs except verify-release, every verify-release call -> the repo's CI check (sop.ci-call, sop.ci-6-2), Stage 6 step 1 (sop.stage6-finish); content/skill-integrator.md (AC-E226-1..3, AC-E226-5) | depends_on: none
- [x] T-E226-02 [P1] sr-engineer: 5a evidence + new findings rows gain artifacts: "local" reading (sop.5a-evidence, sop.5a-findings); Stage 6 findings bullet untouched; content/skill-integrator.md (AC-E226-4) | depends_on: T-E226-01
- [x] T-E349-01 [P1] sr-engineer: integrator SOP repo facts point at the addendum or Constitution §6 (sop.stage1-shared, sop.basefix-5, sop.verifier-build, sop.5b-4/5/6, sop.5c-3); addendum §5 add.5-tools + add.5-ci + add.5-bookkeeping; §7, existing lines/headings untouched; content/skill-integrator.md, docs/lane-protocol-addendum.md (AC-E349-1..3) | depends_on: T-E226-01
- [x] T-E350-01 [P1] sr-engineer: node <agc install>/scripts/fanout.mjs in skill-pm Manifest-Tier row (pm.manifest-row), const-08 cond 3 (const08.cond3), coord-03 writer action (coord03.writer); coord-03 roll-up feature-rollup.mjs (coord03.rollup) (AC-E350-1, AC-E350-2 source side) | depends_on: none
- [x] T-E226-03 [P1] qa-engineer: re-pin call-form and CI-check pins in owned SOP tests (e178a :103/:349, e285 :113, e292 :46/:73/:81, e295 AC6/AC7, e296 AC6, e329 STAGE6_CLOSE/COND2; STAGE6_FINDINGS unchanged) | depends_on: T-E226-01, T-E226-02, T-E349-01
- [x] T-E226-04 [P1] qa-engineer: new test/e226-integrator-sop-portable.test.mjs for AC-E226-1..5 | depends_on: T-E226-01, T-E226-02
- [x] T-E349-02 [P1] qa-engineer: re-pin build/audit/bookkeeping pins (e178a :348, e286 base-fix SOP assertions to the §6 dependency-audit wording, e295 AC8 + AC10) + new test/e349-integrator-repo-facts.test.mjs (AC-E349-1..2); run AC-E349-3 hard-condition set | depends_on: T-E349-01, T-E226-03
- [x] T-E350-02 [P1] qa-engineer: new test/e350-fanout-call-form.test.mjs for AC-E350-1 | depends_on: T-E350-01
- [x] T-E350-03 [P1] qa-engineer: regenerate compose goldens (node scripts/capture-constitution-golden.mjs) + re-baseline test/context-budget.test.mjs to measured values, explain every hunk (AC-E350-2) | depends_on: T-E350-01
- [x] T-E226-05 [P0] qa-engineer: final gate — after commit on clean tree, node scripts/test-lock.mjs -- npm test; npm run build leaves git status --porcelain empty (no dist diff, flag if any); re-pin remaining owned-test reds within SOP-assertion limits; verdict evidence (AC-X-1, AC-E349-3) | depends_on: T-E226-03, T-E226-04, T-E349-02, T-E350-02, T-E350-03
