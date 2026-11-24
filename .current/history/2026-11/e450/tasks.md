<!-- schema_version: 2 -->
# Tasks

## e450-release-window-agc-check

- [x] T-E450-01 [P1] qa-engineer: per docs/backlog.md E450, remove the live `node bin/agc-init.mjs check` exit-0 assertion from test/e433-test-first-rules.test.mjs (AC12) and test/e434-reviewer-visual.test.mjs (AC13); keep every other assertion; drop "agc check" from the two test titles; record the change in qa_reports/tests_e450-release-window-agc-check.md and the hand-off record the gate requires; hand off to sr-engineer | depends_on: none
- [x] T-E450-02 [P1] sr-engineer: confirm nothing to build (test-only ticket), `npx tsc --noEmit` clean, hand off to code-reviewer | depends_on: T-E450-01
- [x] T-E450-03 [P1] code-reviewer: judge the test diff against the E450 backlog row; full suite on the lane tree green; full suite in a temporary copy bumped to 5.0.0 (package.json + index.ts Server literal, npx tsc, shared node_modules) has 0 failures; PASS over T-E450-01..03 | depends_on: T-E450-02
