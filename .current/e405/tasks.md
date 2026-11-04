<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E405-01 [P0] architect: workflow-script contract in specs/e405-release-cd-architecture.md (job/step split + state continuity, runner phase/flags, new exit-class codes runner-only, ALLOWED npm/npx shapes, orchestrator seam, dry-run + E401, summary rule, advisory match, stop-line hand-off, budgets, docs outline, SOP byte budget) | depends_on: none
- [ ] T-E405-02 [P0] sr: release.mjs runner-path skeleton - CLI, new EXIT_CLASSES rows, orchestrator import seam, main-handoff precondition + --state copy, opening write (AC-R1, R2, R10, R13) | depends_on: T-E405-01
- [ ] T-E405-03 [P0] sr: release.mjs pre-flight CI, version derivation, release-branch stop + switch -c, bumps incl. CHANGELOG Unreleased move and lockfile refresh (AC-R3, R4, R5) | depends_on: T-E405-02
- [ ] T-E405-04 [P0] sr: release.mjs build/test/audit with ALLOWED extension, automatic done-mark, commit message file, hand-off into prepare (AC-R6, R7, R8, R11) | depends_on: T-E405-03
- [ ] T-E405-05 [P0] sr: release.mjs closing write + read-back before close-out, E401 dry-run CI gate without waiting, whole-path dry run (AC-R9, R14, E1) | depends_on: T-E405-04
- [ ] T-E405-06 [P1] sr: new .github/workflows/release.yml (AC-W1..W9) | depends_on: T-E405-05
- [ ] T-E405-07 [P1] sr: docs/release-cd.md (AC-D1, D2), the two SOP edits in content/skill-release-engineer.md (AC-E2, D3), CONTRIBUTING.md pointer (AC-D4) | depends_on: T-E405-06
- [ ] T-E405-08 [P1] qa: new test/e405-release-workflow.test.mjs - workflow structure (AC-W1..W10) | depends_on: T-E405-07
- [ ] T-E405-09 [P1] qa: new test/e405-release-runner.test.mjs - runner path with injected spawn + orchestrator (AC-R1..R9, R11, R13, R14, E1) | depends_on: T-E405-07
- [ ] T-E405-10 [P1] qa: re-pin test/e394-release-script.test.mjs - exit table union, allow-list shapes, dry-run CI gate; edited titles name their AC (AC-R10, R11, R12, E1) | depends_on: T-E405-07
- [ ] T-E405-11 [P1] qa: re-pin test/e394-release-sop.test.mjs (AC-P4 filter, AC-E2, AC-D3) + new test/e405-release-docs.test.mjs (AC-D1, D2, D4) | depends_on: T-E405-07
- [ ] T-E405-12 [P1] qa: hard conditions AC-H1..H9, full suite via node scripts/test-lock.mjs -- npm test on final HEAD, evidence | depends_on: T-E405-08, T-E405-09, T-E405-10, T-E405-11
