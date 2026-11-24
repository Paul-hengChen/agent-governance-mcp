# Tests — e450-release-window-agc-check (T-E450-01)

Spec: the `| E450 |` row of `docs/backlog.md`. Test-file placement (dispatch brief): modify the two existing files only; no new test file. Branch acted on: test-file discovery found existing coverage (step 4a), so I modified the existing tests.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| S1: in a bumped tree (package.json ahead of adapter stamps), these two tests do not fail | test/e433-test-first-rules.test.mjs | AC12 (E435): counts and hygiene — 33 gates, 17 pipeline steps, untouched server files, CLAUDE.md, dist diff |
| S1 (same) | test/e434-reviewer-visual.test.mjs | AC13: 33 gates (E435), 17 steps, CURRENT_VERSIONS = E435's (handoff 17); transitions / schema / prompts / CLAUDE.md byte-identical to base; dist outside the four rebuilt groups unchanged |
| S2: every other assertion in the two tests kept | same two tests (diff removes only the `agc-init.mjs check` spawnSync and its exit-0 assert, plus the title fragment) | — |
| S3: plain suite green | full suite (`node scripts/test-lock.mjs -- npm test`) | — |

Change: in each test I removed the live `spawnSync(process.execPath, [.../bin/agc-init.mjs, "check"])` call and its `assert.equal(agc.status, 0, ...)`, dropped "agc check" / "agc check exits 0" from the title, and added a one-line WHY comment at the head of the test. I kept the `spawnSync` import in both files because other helpers still use it.

## Open Interface Details

- None. The change is test-only and touches no interface.
- Record type: I wrote `qa_reports/no-new-test_e450-release-window-agc-check.txt` rather than an expected-red manifest, because no test can be red: the change removes an assertion and adds nothing that the current code fails.

## Red Reasons

- None. Both updated tests are green against current code and cannot go red: removing an assertion adds no requirement. This is disclosed under SOP step 5 ("a scenario test that is already green means the behaviour exists").

## Verification run (qa-engineer, 2026-11-25)

- Two files, current tree: 28/28 pass.
- S1 simulation: `package.json` version temporarily set to 9.9.9 (`agc check` then exits 1 on the stale stamps). Two files: 28/28 pass. `package.json` restored afterwards; `git status` shows only the two test files changed.
- Full suite (`node scripts/test-lock.mjs -- npm test`): tests 4579, pass 4576, fail 0, skipped 3, exit 0.
- The judge should run the full suite in a bumped tree, as the backlog row asks under "Verify by".

## CI Runnability

Headless; no human interaction.
