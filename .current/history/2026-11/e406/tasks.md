<!-- schema_version: 2 -->
# Tasks

## e406-release-and-merge-scripts

- [x] T-E406-01 [P0] sr-engineer: scripts/release.mjs explicit-path staging per specs/e406-release-and-merge-scripts.md (Cut Sites rows for scripts/release.mjs; AC-E406-1..7) + expected-red manifest qa_reports/expected-red_e406-release-and-merge-scripts.txt | depends_on: none
- [x] T-E406-02 [P1] qa-engineer: E406 tests and re-pins in test/e394-release-script.test.mjs (fixture commits content/foo.md, AC-S3 ALLOW + AC-R11 shapes, new E406 cases) and test/release-staging.test.mjs AC2 (E94) Shape 2 (AC-E406-1..6) | depends_on: T-E406-01
- [x] T-E203-01 [P0] sr-engineer: tools/merge-invariants.ts unionReconciliationFailures counts only closed task_ids not found at the merge (amended spec e126 (c)); reason text per merge.c.reason; rebuild + commit dist/tools/merge-invariants.* (AC-E203-1..5) | depends_on: none
- [x] T-E203-02 [P1] qa-engineer: E203 tests in test/e126-merge-invariants.test.mjs — repro passes (T-D-01 kept), dropped T-D-01 fails, under-count with kept T-D-01 fails; existing AC11 (iv) 5-vs-4 unchanged (AC-E203-1..5) | depends_on: T-E203-01
