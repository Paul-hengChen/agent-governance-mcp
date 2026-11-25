# Review — T-E427-06

covers: T-E427-06, T-E427-07, T-E427-08

## Round 1 — APPROVED — by code-reviewer

Feature `e427-ci-scenario-tests` (lane `e427`), amendment 2026-11-25 (integrator R1 / R2), reviewed against
`specs/e427-ci-scenario-tests.md` `## Amendment 2026-11-25`, AC18, AC19 and Copy / Strings `adapterLoadError`.
Diff `2070c0fd...HEAD` (the previous PASS head). T-E427-01..05 are not re-gated; the amendment was checked for
regressions against them.

## Summary
- T-E427-06 (qa): one new AC18 test in `test/e427-check-scenario-tests.test.mjs` and the AC18 line in the expected-red manifest.
- T-E427-07 (sr, R2): `loadReadResults` now adds an `adapterLoadError` line directly after the unchanged `adapterInvalid` line, only when the import throws; exit stays 2.
- T-E427-08 (sr, R1): both script head comments trimmed to 7 lines with a spec pointer; the change touches comments only.
- Files touched: the test file, the two scripts, the spec, `.current/e427/`, `qa_reports/`. Nothing outside the allowed set.
- Verdict: APPROVED.

## AC Completeness
AC1–AC17 — implemented — unchanged by this diff; every e427 test is green in the full suite (4720/4723, 0 fail).
AC18 — implemented — scripts/check-scenario-tests.mjs:66-78; test test/e427-check-scenario-tests.test.mjs:325-354.
AC19 — implemented — scripts/check-scenario-tests.mjs:1-8, scripts/scenario-results-node.mjs:1-7; the AC19 command prints only `matches-exit=1`.

## Correctness
No required findings.

- AC18 test strength: I ran 8 mutants of `loadReadResults` against the AC18 test, using a copy outside the worktree. The test failed on all 8 and passes on the original:
  no second line; the two lines swapped; an extra line between them; an empty reason; an `adapterLoadError` line added for the no-readResults module; a plain `Error` (exit 1 plus stack); a reworded `adapterInvalid`; the module name dropped from the load-error line.
- The test covers both import-failure kinds: a missing path and an unparseable module, which it writes at run time and does not track. It asserts exit 2, that `adapterInvalid` is unchanged, that the load-error line is at index i+1, and that the reason is non-empty. It also asserts there is no load-error line for the AC11 module. The AC9, AC11 and AC13 tests are unchanged and green.
- R2 matches Copy / Strings verbatim: `check-scenario-tests: cannot load adapter <module>: <reason>`, with `<module>` the same `shown` value as `adapterInvalid` (scripts/check-scenario-tests.mjs:68-69,75). `<reason>` is `reason(err)` cut to its first line, falling back to `err.name`. That is the spec's "first clause of the import error's message, cut as `reason()` cuts it", and the first-line cut keeps the output to two lines.
- Observed output, run by hand: `./missing.mjs` gives `... cannot load adapter ./missing.mjs: Cannot find module '<abs>/missing.mjs' imported from <abs>/scripts/check-scenario-tests.mjs`. `./broken.mjs` gives `... : Unexpected end of input`. Both exit 2. The no-readResults module prints only `adapterInvalid` and exits 2.
- **recommended** — The missing-module reason includes absolute paths: the resolved adapter path and the checker's own install path. Node's `ERR_MODULE_NOT_FOUND` message contains no `", "`, so `reason()` keeps all of it. This follows the spec, which defines `<reason>` as the `reason()` cut. The paths are on the invoking user's own filesystem (a CI runner checkout), and the line goes to the local stderr with no secret in it, so this is not a defect. If the integrator wants only the module-argument path printed, a later spec change can define a narrower `<reason>` for `ERR_MODULE_NOT_FOUND`, such as `Cannot find module`.

## Quality
- R1 changes only comments. `git diff abcb9721 0364418c -U0` with every `//` line filtered out leaves no changed lines (grep exit 1).
- Head comments follow Constitution §6 Comment discipline. Each is 7 lines after the shebang, with a one-sentence summary of 73 / 72 columns (both ≤80) and caller essentials (usage, exit codes, the `readResults` contract). Each ends with a one-line pointer to the spec. `agc check` prints no `comments:` warning for either script or for the test file.
- **optional** — The AC18 test has three short in-body comments (test/e427-check-scenario-tests.test.mjs:331,338,349) besides its WHY header. Each one explains a non-obvious fixture choice, and `agc check` does not flag them. I am keeping them: they are WHY comments and match the style of the surrounding test file.
- **optional** — `invalid` is now built eagerly and is used for its `.message` on the import-failure path (scripts/check-scenario-tests.mjs:69,75). This is fine and clear. A tiny helper would be the only alternative, and it is not worth the change.

## Architecture
No architecture spec exists for this feature. The change is inside `loadReadResults`, keeps the `CannotRun` → stderr → exit 2 path (scripts/check-scenario-tests.mjs:152), and changes no interface or default.

## Security
No new input crosses a trust boundary. `--adapter` was already a cwd-relative module path imported by design (D10). The new line only echoes the user's own argument and Node's error text. See the recommended path note under Correctness. No secrets. `npm audit --audit-level=high` exits 0.

## Performance
No findings. The only new work is a string split on the failure path.

## Verdict
APPROVED. The AC18 test kills every wrong-implementation mutant I tried, R2 prints the Copy / Strings line exactly where the spec says, R1 changes comments only and clears AC19, and the full suite is 4720/4723 with 0 fail.
