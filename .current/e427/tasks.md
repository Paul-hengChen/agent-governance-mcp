<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E427-01 [P0] qa-engineer: one test per AC (AC1–AC14, AC16) in test/e427-check-scenario-tests.test.mjs, test/e427-scenario-results-node.test.mjs, test/e427-ci-wiring.test.mjs, test/e427-ticket-format-doc.test.mjs; new fixtures only under test/fixtures/e427/; write qa_reports/expected-red_e427-ci-scenario-tests.txt (spec specs/e427-ci-scenario-tests.md) | depends_on: none
- [x] T-E427-02 [P0] sr-engineer: runner adapter scripts/scenario-results-node.mjs — default-export reporter (Node junit + classname = repo-relative file) and readResults(path) → [{file,title,status}] per D3–D5 (AC10) | depends_on: T-E427-01
- [x] T-E427-03 [P0] sr-engineer: checker CLI scripts/check-scenario-tests.mjs — args, done-ticket selection (D7), matching (D4–D6), Copy/Strings messages, exit codes (D8–D10), --adapter (AC1–AC9, AC11–AC13, AC15) | depends_on: T-E427-02
- [x] T-E427-04 [P1] sr-engineer: CI wiring in .github/workflows/ci.yml — Test step run: per D1 (reporters before the glob, via test-lock), new step "Check ticket scenario tests" per D11; job name and matrix unchanged (AC14, AC17) | depends_on: T-E427-03
- [x] T-E427-05 [P1] sr-engineer: docs/ticket-format.md — general section "## Named tests checked in CI" (scope limit, done-only, full nested title with " > ", readResults contract, rename rule; no repo paths/ids) + tooling-section additions (checker, adapter, CI step, exit codes) (AC16) | depends_on: T-E427-03
