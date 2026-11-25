# Judge report — T-E427-01

covers: T-E427-01, T-E427-02, T-E427-03, T-E427-04, T-E427-05

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e427-ci-scenario-tests.txt`, 15 entries. Suite run: `node scripts/test-lock.mjs -- npm test`
on a clean tree (Node 22.23): 4719 pass / 4722, 3 skipped, 0 fail, exit 0; actual reds: none.

- test/e427-check-scenario-tests.test.mjs | AC1 … AC13 (12 entries) — scenario tests, now green — built (T-E427-03, adapter T-E427-02).
- test/e427-scenario-results-node.test.mjs | AC10 — scenario test, now green — built (T-E427-02).
- test/e427-ci-wiring.test.mjs | AC14 — scenario test, now green — built (T-E427-04).
- test/e427-ticket-format-doc.test.mjs | AC16 — scenario test, now green — built (T-E427-05).
- Reds off the manifest: none. The 3 skipped tests are pre-existing (e130 x2, e417 F6), identical to the base count.

## AC Execution Log

- AC1 — `node --test test/e427-check-scenario-tests.test.mjs` (AC1 test, within the full suite) — ok — pass.
- AC2 — same file, AC2 test — ok — pass.
- AC3 — same file, AC3 test — ok — pass.
- AC4 — same file, AC4 test — ok — pass.
- AC5 — same file, AC5 test — ok — pass.
- AC6 — same file, AC6 test — ok on Node 22.23 and Node 20.20.2 — pass.
- AC7 — same file, AC7 test — ok — pass.
- AC8 — same file, AC8 test — ok — pass.
- AC9 — same file, AC9 test — ok — pass.
- AC10 — `node --test test/e427-scenario-results-node.test.mjs` — ok on Node 22.23 and Node 20.20.2 (13/13 with the checker file under Node 20) — pass.
- AC11 — same checker file, AC11 test — ok — pass.
- AC12 — same file, AC12 test — ok — pass.
- AC13 — same file, AC13 test — ok — pass.
- AC14 — `node --test test/e427-ci-wiring.test.mjs` (in the full suite) — ok — pass.
- AC15 — `node scripts/check-scenario-tests.mjs --results /nonexistent/test-results.xml; echo "exit=$?"` from the repo root — printed `check-scenario-tests: no named test in a done ticket; results not read` then `exit=0` — pass.
- AC16 — AC16 test plus `node --test test/e422-ticket-format-doc.test.mjs test/e455-ticket-checker-strict.test.mjs` — 51 pass, 0 fail — pass.
- AC17 — `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` — `# fail 0`, 4719/4722 pass, 3 skipped, `exit=0` — pass locally (Node 22.23). The lane push's CI `test (20)` / `test (22)` cannot run here (not pushed): verified only by CI after push.
- D1 real CI command — `node scripts/test-lock.mjs -- node --test --test-reporter=tap --test-reporter-destination=stdout --test-reporter=./scripts/scenario-results-node.mjs --test-reporter-destination=<tmp>/test-results.xml test/*.test.mjs` — exit 0, stdout starts `TAP version 13`, 4719 pass / 4722, results file 873 KB; then `node scripts/check-scenario-tests.mjs --results <tmp>/test-results.xml` — `none` line, exit 0 (D12).
- `npm audit --audit-level=high` — exit 0 (1 low, 6 moderate).
## 2026-11-25T15:53:11.294Z — PASS — by code-reviewer

suite-result: 4719/4722 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED T-E427-01..05 (round 1). All 17 ACs executed: AC1-AC14, AC16 tests green (15/15 expected-red entries now green, no reds off the manifest); AC15 command prints the none line, exit 0; AC17 suite 4719/4722, 3 skipped, 0 fail, exit 0 on Node 22.23. AC6/AC10 (plus the whole checker test file) also green on Node 20.20.2. Real D1 CI command run locally: exit 0, TAP on stdout, 873 KB results XML read as 4723 entries with repo-relative files; checker on it prints the none line, exit 0. Negative control (copy outside the worktree) turned AC3/AC7/AC10 red as expected. Scope and hygiene clean; npm audit --audit-level=high exit 0. Not verified here: full suite under Node 20 and the lane push's CI test (20)/(22) - CI after push. Recommended (report-only): trim two long file-header comments (agc check comments warnings), surface the import error reason under adapterInvalid. Report: review_reports/review_T-E427-01.md

