# Review — T-E427-01

covers: T-E427-01, T-E427-02, T-E427-03, T-E427-04, T-E427-05

## Round 1 — APPROVED — by code-reviewer

Feature `e427-ci-scenario-tests` (lane `e427`), reviewed against `specs/e427-ci-scenario-tests.md`
(D1–D12, AC1–AC17, Copy / Strings) and `qa_reports/tests_e427-ci-scenario-tests.md`. Diff `d239895...HEAD`.

## Summary

- Adds a CI check that every `done` ticket's `Verification: test <file> — <title>` names a test that exists and
  passed in the runner's own JUnit output: `scripts/check-scenario-tests.mjs` (CLI) and
  `scripts/scenario-results-node.mjs` (Node reporter that records the test file as `classname`, plus a
  dependency-free `readResults`).
- `.github/workflows/ci.yml`: the `Test` step `run:` line moves the reporter options before the glob (D1); a new
  `Check ticket scenario tests` step follows with `if: ${{ !cancelled() }}` (D11). Job key, matrix and the other
  steps are unchanged.
- `docs/ticket-format.md`: new general-part section `## Named tests checked in CI` plus a tooling-section paragraph.
- Scope: every changed path is in the lane's owned list; no `.ts`, `dist/**`, `content/**` or `package.json` change.
- Verdict: APPROVED.

## AC Completeness

- AC1 — implemented — scripts/check-scenario-tests.mjs:144-145 (okSummary); test AC1 green.
- AC2 — implemented — scripts/check-scenario-tests.mjs:134-135, 147; test AC2 green.
- AC3 — implemented — scripts/scenario-results-node.mjs:108 (`<skipped>`, both skip and todo), check-scenario-tests.mjs:136-137.
- AC4 — implemented — scripts/scenario-results-node.mjs:108 (`<failure>` wins), check-scenario-tests.mjs:138-139.
- AC5 — implemented — scripts/check-scenario-tests.mjs:56 (missing dir = no tickets), 125-126 (results never opened).
- AC6 — implemented — notFound line with rename instruction, check-scenario-tests.mjs:135; test AC6 runs the real runner.
- AC7 — implemented — full nested title built at scenario-results-node.mjs:110/115-118; exact file + `./` strip at check-scenario-tests.mjs:100-103.
- AC8 — implemented — only `kind === "test"` is collected, check-scenario-tests.mjs:122.
- AC9 — implemented — check-scenario-tests.mjs:85-96 (fs error -> cannot read, any other throw -> cannot parse), stderr.
- AC10 — implemented — scenario-results-node.mjs:21-32 (reporter), 132-143 (readResults); green on Node 22.23 and Node 20.20.2.
- AC11 — implemented — check-scenario-tests.mjs:72-83.
- AC12 — implemented — check-scenario-tests.mjs:116-119.
- AC13 — implemented — check-scenario-tests.mjs:39-51.
- AC14 — implemented — .github/workflows/ci.yml:33-38.
- AC15 — implemented — command run from repo root: `none` line, exit 0.
- AC16 — implemented — docs/ticket-format.md new section before `## Example ticket`, tooling paragraph at the end; e422 / e455 suites green.
- AC17 — implemented — full suite 4719/4722 pass, 3 skipped, 0 fail, exit 0 (Node 22.23). CI `test (20)` / `test (22)` on the lane push are not run (not pushed); see Correctness.

## Correctness

Tests (qa-engineer, T-E427-01):
- Each AC1–AC14 and AC16 has one test on the public interface (the CLI as a child process, the real `node --test`
  runner with the adapter, the parsed `ci.yml`, the doc text), asserting exact Copy / Strings lines and exit codes.
- Negative control (copy of the tree outside the worktree): treating `<skipped>` as passed, dropping the `classname`
  assignment and dropping the `./` strip turned AC3, AC10 and AC7 red (3 of 13 tests, the expected ones). The tests
  would fail on these plausible wrong implementations.
- AC5 and AC8 point `--results` at a file that does not exist, so a checker that opens the results when nothing is
  to check would exit 2 and fail; AC11 passes a non-XML results file, so exit 0 proves the custom adapter was used.
- No `required` test findings.

Implementation:
- Exit-code / stream contract holds: problems and summaries on stdout (exit 1), cannot-run lines on stderr (exit 2),
  verified also by probes: `--tickets package.json` -> `cannot read tickets package.json: ENOTDIR: not a directory`,
  exit 2; `--results` with no value -> usage, exit 2; a missing `--adapter` module -> adapterInvalid, exit 2.
- XML reader on the real 873 KB CI result file: 4723 entries (4720 passed, 3 skipped), no entry with file `null`,
  `test` or an absolute path, 290 distinct files; titles containing `##`, `->`, `&`, `<`, `"` decode correctly.
  Comments, processing instructions, CDATA and declarations are skipped; mismatched or unclosed tags throw (parse error).
- Real-repo probe: a scratch `done` ticket naming a real passing test (with `./` prefix), a real skipped test and a
  real title under the wrong file printed one `skipped` and one `notFound` line and the summary `2 problem(s) in 3
  named test(s) from 1 done ticket(s)`, exit 1 — the check works on the real CI output, not only on fixtures.
- Node 20: obtained a Node 20.20.2 binary (npm package `node-bin-darwin-arm64@20`); `test/e427-scenario-results-node.test.mjs`
  and `test/e427-check-scenario-tests.test.mjs` pass under it (13/13), so Node 20's `junit` reporter honours
  `data.classname` and test events carry `data.file`. The full suite under Node 20 and the lane push's CI are not
  verified here; they are verified only by CI after push.

sr-engineer's four open design choices (from the dispatch brief):
- (a) adapter import failure reported with the `adapterInvalid` line — accepted: the spec gives no separate copy and
  exit 2 is right. See recommended R2 on the lost error reason.
- (b) fs error (`code` + `syscall`) -> cannotReadResults, any other throw or non-array return -> cannotParseResults —
  accepted; matches D8 for the default adapter and is a reasonable rule for third-party adapters.
- (c) malformed `done` ticket reported via ticketProblems, its scenarios not checked, counted in `<m>`; with only
  malformed done tickets the results are not read and exit is 1 — accepted; matches D7 (exit 1) and D8 (results read
  only when there is a named test).
- (d) unexpected internal error -> exit 2 on stderr, never 1 — accepted; an internal fault is "cannot run" (D9) and
  must not blame tickets or pass silently.

## Quality

- Naming and structure follow `scripts/check-tickets.mjs` (prefix constant, stdout/stderr split, `process.exitCode`).
- Comment check (`agc check — comments`, the only two warnings in the repo):
  - scripts/check-scenario-tests.mjs:2 long-block 13 lines — kept: it carries the CLI usage and exit-code contract, as
    `check-tickets.mjs` carries its usage. Recommended R1.
  - scripts/scenario-results-node.mjs:1 long-block 15 lines — kept: it states the adopter-facing `readResults`
    contract at the reference implementation and the WHY of the reporter (Node writes `classname="test"`).
    Recommended R1.
- No dead code; `RANK` is duplicated in both scripts (3 entries each) — acceptable, the adapter is meant to stand alone.

## Architecture

No architecture spec (v5 chain without architect). The split matches D3/D10: the checker depends only on a
`readResults` function; the default adapter is located relative to the checker script, `--adapter` relative to the
working directory. `dist/tools/ticket-file.js` and `dist/tools/config.js` are imported read-only, as D7 requires.

## Security

- No new input crosses a trust boundary beyond local files named by the CI step; `--adapter` imports a module the
  caller names, which is the documented contract (D10), not reachable from ticket content.
- No secrets, no network, no shell invocation. Results path is written to `$RUNNER_TEMP`, outside the checkout.
- Information hygiene: no absolute path, no internal link, no URL in any tracked file of the diff (grep over the diff).
- `npm audit --audit-level=high`: exit 0 (7 vulnerabilities: 1 low, 6 moderate, none high or critical; no dependency change in this diff).

## Performance

- `readResults` on the real 873 KB result file: 14 ms; on a 10x (8.7 MB, 47 230 entries) synthetic file: 93 ms —
  linear in practice. `entries.splice` per suite is O(entries) but suites are few.
- The checker is a linear scan of entries per named test (O(named x entries)); fine at ticket scale.
- The CI `Test` step's duration is unchanged (same suite, one extra reporter): 106.7 s locally vs 112.6 s for `npm test`.

## Verdict

APPROVED — every AC is implemented and executed, the tests fail on plausible wrong implementations, scope and
hygiene are clean, and the only Node 20 gap (full suite and the lane push's CI) is a CI-after-push check.

### Recommended / optional (report-only, not tickets)

- R1 (recommended): trim the two file-header comments to 7 lines or fewer (move the D3/D5/D9 restatement to the spec,
  which already holds it), so `agc check — comments` returns to zero warnings.
- R2 (recommended): scripts/check-scenario-tests.mjs:78 swallows the import error; when the module exists but fails
  to load (syntax error, missing dependency) the `adapterInvalid` line hides the cause. A second stderr line with
  `reason(err)` would keep the specified copy and aid debugging.
- O1 (optional): scripts/check-scenario-tests.mjs:74 prints `DEFAULT_ADAPTER.pathname` (absolute, URL-encoded) for
  the default adapter; reachable only if the repo's own adapter breaks.
- O2 (optional): AC6 would also pass if the reporter recorded no file (the old title is absent either way); AC10 covers
  the file. Asserting that the new title is found under the fixture's file would make AC6 self-sufficient.
