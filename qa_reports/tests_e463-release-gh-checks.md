# Test report: e463-release-gh-checks (T-E463-01, T-E463-02)

Author: qa-engineer (test author only; no verdict). Spec: `specs/e463-release-gh-checks.md`.

## Placement decision (Constitution section 2, Conditional test writing)

The dispatch brief's `Test-file placement` line pre-authorized a new `test/e463-*.test.mjs` for T-E463-01 (fixtures under
`test/fixtures/e463/**`) and re-pins in the three named existing files for T-E463-02. Acted on that branch: new file
`test/e463-release-gh-checks.test.mjs`, fixture `test/fixtures/e463/doc-paragraphs.json` (the two `doc.*` paragraphs,
extracted verbatim from the spec's Copy / Strings fenced blocks so the doc tests do not depend on the spec file at run time).
No forbidden test file was touched.

## Scenario -> Test Map

All tests are in `test/e463-release-gh-checks.test.mjs`; run one AC with
`node --test --test-name-pattern "<AC id>" test/e463-release-gh-checks.test.mjs`.

| AC | test title (starts with) |
|---|---|
| E463-AC1 | `E463-AC1 a pr view that says \`no pull requests found\` is one call, no retry, ...` (publish, two stderr shapes); `E463-AC1 not found at close-out goes on to open the bookkeeping pull request (unchanged)` |
| E463-AC2 | `E463-AC2 every lookup fails: publish makes 3 pr view calls, ...`; same with `publish --dry-run` |
| E463-AC3 | `E463-AC3 1 failed lookup(s) then success: ...`; `E463-AC3 2 failed lookup(s) then success: ...` |
| E463-AC4 | one test per site: `close-out pre-check`, `prepare step 8a-6 lookup before gh pr create`, `prepare step 8a-6 lookup after gh pr create`, `close-out step 13a-5 lookup after gh pr create`, `publish merge wait (8c-2)`, `close-out merge wait (13a-6)`; plus `a deferred lookup under --dry-run is still not run and still returns not observed` |
| E463-AC5 | `E463-AC5 the wait between attempts is AGC_RELEASE_GH_RETRY_SECONDS ...` (unset, 0, abc, empty, -1, 2); `E463-AC5 the helper exports GH_LOOKUP_ATTEMPTS (3) and GH_LOOKUP_RETRY_SECONDS (10)` |
| E463-AC6 | `E463-AC6 docs/release-cd.md Manual fallback states doc.lookup_retry verbatim, after doc.gh_min` |
| E464-AC1 | `E464-AC1 docs/release-cd.md Manual fallback states doc.gh_min verbatim and its version equals MIN_GH_VERSION` |
| E464-AC2 | `E464-AC2 each of start, prepare, publish, close-out runs gh --version first and once, ...; record makes no gh call` |
| E464-AC3 | `E464-AC3 gh 2.39.2 stops every phase 14 stop.gh_too_old with no child call after gh --version` |
| E464-AC4 | `E464-AC4 gh --version failing, unspawnable, or printing no version stops 14 with its own string` (exit 1, spawn error, exit 1 empty stderr, `gh version DEV`, empty stdout; all four phases) |
| E464-AC5 | `E464-AC5 versions compare numerically per component; the first gh version X.Y.Z on the output is the one parsed` |
| E464-AC6 | `E464-AC6 scripts/gh-compat.mjs exports the constants and pure functions, imports no child_process; gh --version is an allowed read; verify-release.mjs does not import the helper` |
| X-AC1 (static half) | `X-AC1 no exit class is added or changed: ...` (EXIT_CLASSES, GH_UNAVAILABLE phases, viewPr argv literal). The `git diff --name-only` half and the three forbidden-file runs are command proofs the judge runs. |
| X-AC2 | command proof: `node scripts/test-lock.mjs -- npm test` on a clean worktree (run by qa at hand-off, again by sr and the judge) |

Command-only scenarios (no test): the E464-AC6 byte-identity clause of `scripts/verify-release.mjs`, the X-AC1 `git diff --name-only e3a3db6...HEAD -- <forbidden paths>` proof and the X-AC2 suite proof.

## Re-pins done (T-E463-02), no assertion loosened

| file | change |
|---|---|
| `test/e394-release-script.test.mjs` | `GH_SHIM` answers `gh --version` with `gh version 2.40.0 (2023-12-07)` (no log entry); AC-S3 `ALLOW` gains `/^gh --version$/` (the verb set stays closed: the entry is exact, so `gh --version x` is still unlisted by the static regexes). |
| `test/e405-release-runner.test.mjs` | `mkSpawn` answers `gh --version` before the `fx.ghLog.push(...)` fall-through, so the dry-run `snapshot` (which compares `ghLog`) is unchanged. |
| `test/e432-judge-report-checks.test.mjs` | `runRelease` stub answers `gh --version` with the same line; every other `gh` call keeps its exit 0 / empty stdout. |

Verified green before the sr change: the three files, 122/122 tests.

## Open Interface Details

- The spec names only the helper's constants, not its function names, so every version-check, parse and not-found
  assertion drives the public `main(argv, deps)` seam (and `isAllowed` / `createRunner`); AC6 only requires the helper to
  export at least two functions. Reason: tests stay on the public interface and sr-engineer is free to name the functions.
- `stop.lookup_failed` last-line expectation uses the full literal text of the Copy table with `exit 1` and the failing
  stderr's last line; `log.lookup_retry` lines are matched exactly, with the step label of each call site (`pre-3`, `8a-6`,
  `13a-5`, `8c-2`, `13a-6`).
- AC4 "after gh pr create" cases use a gh shim whose `pr create` prints no pull-request URL (`createNoUrl`) for the prepare
  site; for close-out 13a-5 the lookup after create is unconditional, so the URL is printed as usual.
- Harness B is a copy of the e394 real-repository fixture plus failure injection in the `gh` shim (`viewFail`, `armAfterCreate`,
  `armAfterMerge`, `versionOut`, `createNoUrl`). Harness A (empty root, fake spawn) drives the phase-start checks.
- AC5 runs the failing-lookup publish case once per env value; it asserts both the sleep list and the `retrying in <n>s` text.

## Red Reasons

19 tests red now, listed with reasons in `qa_reports/expected-red_e463-release-gh-checks.txt`:

- E463-AC2 (2), E463-AC3 (2), E463-AC4 (6 call-site tests), E463-AC5 wait test: a failed `gh pr view` is still read as "no pull request" (`viewPr` returns null) — the run stops 42/43 or goes on to `gh pr create` instead of exit 14.
- E463-AC5 helper-exports test, E464-AC6: module not found, `scripts/gh-compat.mjs` is not built yet.
- E463-AC6, E464-AC1: `docs/release-cd.md` lacks both `doc.*` paragraphs.
- E464-AC2..AC5: `preGh` makes no `gh --version` call and `ALLOWED` has no such rule.

Green now (behaviour exists, kept as regression pins): E463-AC1 (2 tests), E463-AC4 dry-run deferred lookup, X-AC1.

## CI Runnability

Headless; no network, no real `gh`. No test reads repository history (`test/render-structure.test.mjs` forbids it), so the E464-AC6 clause
"`scripts/verify-release.mjs` is byte-identical to the base" is a command proof for the judge (the X-AC1 `git diff` line);
the test asserts only that `verify-release.mjs` does not import the helper.

## Re-pin of test/e394-release-script.test.mjs (sr return 1/2, T-E463-02)

Cause: spec Decision 2 has `scripts/release.mjs` import `./gh-compat.mjs`; three e394 tests collided with that import.
No assertion was loosened.

- Fixture template (`mkFixture`): also copies `scripts/gh-compat.mjs` beside `release.mjs`, so the two AC-S2 real-child tests
  ("the stop record is the last stderr line through a real child with piped stderr (R2)", "every non-zero path through a real child prints the stop record last")
  load the script.
- AC-S9 "absorbed checks are delegated": the relative-import check now collects every top-level relative import and requires each to be exactly
  `./gh-compat.mjs`; dynamic relative imports and `./check*` / `./verify*` imports stay refused.

Runs: against HEAD without the sr build, e394 is 66/66 green (no pre-patch reds in e394; the re-pin needs no sr build).
With the sr build patch applied temporarily (then reverted), e394 + e463 together: 89/89 pass.
The e463 reds listed in `expected-red_e463-release-gh-checks.txt` are unchanged and unaffected by this re-pin.
