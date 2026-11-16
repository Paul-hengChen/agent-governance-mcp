<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E417-01 architect: in specs/e126-merge-invariants.md define the new condition (c) rule — which history between the merge-base and a parent is read, how each of the two E417 cases is decided, the fallback-with-warning when history is unreadable, and whether case two is closed or stays an accepted limit (note: Spec AC12/AC13 and architecture file verified against implementation and tests; evidence qa_reports/review_T-E417-03.md (0a1aa93))
- [x] T-E417-02 sr-engineer: repro-first — add failing reproduction tests to test/e203-merge-invariants-union.test.mjs and record them in the expected-red manifest; then change tools/merge-invariants.ts per the spec so they pass; rebuild dist (depends_on: T-E417-01) (note: Fix verified: R1,R4-R8 red on main dist, green on lane build; zero other reds; evidence qa_reports/review_T-E417-03.md and review_reports/review_T-E417-02.md)
- [x] T-E417-03 qa-engineer: verify the repro tests turned green, the existing merge-invariants suites do not regress, and add a test for the unreadable-history fallback and warning (depends_on: T-E417-02) (note: AC12 guards (7) + AC13 (21 tests) added and green on Node 22 and 20; commit 0a1aa93)
