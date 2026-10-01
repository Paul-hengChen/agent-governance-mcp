<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E260E-01 [P1] qa-engineer: trim comments in test/_e123b9-{crash-worker,fault-fs-loader,fault-fs-shim,migration-worker,round2-migrate}.mjs, test/{compose-equivalence,config-cache,dependency-overrides,drift-stamp-advisory}.test.mjs (9 files, 9 long blocks, 4 over 20); create sections in specs/e260e-comment-rationale.md as needed; run proof.mjs --changed-only; commit | depends_on: none
- [ ] T-E260E-02 [P1] qa-engineer: trim comments in test/{ac-execution,agc-feature-finish-history,agc-feature-lifecycle,baseline-manifest-gate}.test.mjs (4 files, 10 long blocks, 3 over 20 incl. the 53-line max); rationale to spec; proof --changed-only; commit | depends_on: T-E260E-01
- [ ] T-E260E-03 [P1] qa-engineer: trim comments in test/agc-adapters.test.mjs (1 file, 11 long blocks, 2 over 20); rationale to spec; proof --changed-only; commit | depends_on: T-E260E-01
- [ ] T-E260E-04 [P1] qa-engineer: trim comments in test/{check-md-tables,check-version}.test.mjs (2 files, 9 long blocks, 3 over 20); rationale to spec; proof --changed-only; commit | depends_on: T-E260E-01
- [ ] T-E260E-05 [P1] qa-engineer: trim comments in test/{constitution-deliverable-guard,covering-evidence,cut-approval-gate}.test.mjs (3 files, 11 long blocks, 1 over 20); rationale to spec; proof --changed-only; commit | depends_on: T-E260E-01
- [ ] T-E260E-06 [P1] qa-engineer: trim comments in test/{design-auditor-volume-guard,dispatch-log,dispatch-mechanism,dispatch-pins,drift-archived-tasks,drift-baseline,drift-skew}.test.mjs (7 files, 9 long blocks, none over 20); then run the whole-lane proof.mjs against base on all changed files (expect proof: PASS); commit | depends_on: T-E260E-01
