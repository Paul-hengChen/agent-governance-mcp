# e427-ci-scenario-tests

Ticket: E427 core (backlog row E427 with its 2026-11-19 audit amendment, parts (1), (3) and (4)). Fan-out lane `e427` of
`specs/fanout-post-v5-w1.md`. Amendment part (2) (the qa-engineer / code-reviewer SOP sentences) is wave 2, out of scope here.

## Problem Statement

E424 checks the judge's (code-reviewer's) own record that each ticket scenario was executed, so a misreported result
still passes. Nothing independent of the agents confirms that the test a finished ticket names actually exists and
passed. This feature adds a CI step that, on every push and pull request, reads every ticket file whose status is
`done`, collects each scenario verified by a named automated test (`Verification: test <file> — <title>`), and checks
it against the test runner's own machine-readable result: the step fails, naming ticket id, scenario id and test, when
the named test is absent, skipped or failed. The result comes from CI, not from any agent's report.

## User Stories

- As a maintainer, I want CI to fail when a `done` ticket names a test that is missing, skipped or failing, so that a
  ticket cannot be marked done on a test that does not exist or does not pass.
- As a maintainer renaming a test, I want CI to tell me which `done` ticket still names the old title, so that I update
  the ticket in the same change.
- As an adopter on another test runner, I want the one function I must supply documented, so that I can reuse the
  checker with my own runner's result format.

## Decisions (settled by this cut)

- **D1 — how the result file is produced.** Node's `--test-reporter` options are only read when they come BEFORE the
  test file arguments (probed on Node 22.23: `node --test a.test.mjs --test-reporter=junit …` silently ignores the
  reporter options), so `npm test -- <reporter args>` cannot work: npm appends after `test/*.test.mjs`. The CI `Test`
  step therefore runs the suite through `test-lock` with the reporter options placed before the glob:
  `node scripts/test-lock.mjs -- node --test --test-reporter=tap --test-reporter-destination=stdout --test-reporter=./scripts/scenario-results-node.mjs --test-reporter-destination="$RUNNER_TEMP/test-results.xml" test/*.test.mjs`.
  `tap` to stdout is what the current `npm test` step already prints on both CI Node versions (non-TTY default; the
  baseline log is TAP), so the human-readable CI log keeps its format. The second reporter writes the JUnit XML to the
  runner's temp directory (Node does not create missing parent directories, probed: exit 7), outside the checkout.
  `package.json` is NOT changed (local `npm test` is unchanged); the glob is duplicated in `ci.yml` and a test pins
  that it equals the `test` script's glob. The `Build` step already runs before `Test`, so skipping npm's `pretest`
  build in CI loses nothing.
- **D2 — ownership note for pre-review.** D1 edits the `run:` line of the existing `Test` step (name unchanged, job
  name and matrix unchanged, required checks `test (20)` / `test (22)` unchanged) and adds one new step. The lane's
  owned-files cell says "only new step(s) in the `test` job", while the fan-out spec's file-face note names the
  `npm test` step (lines 33–34) as the touch point; the integrator confirms in pre-review that editing that one
  `run:` line is in scope. The alternative that adds only new steps (a pre-step exporting reporter options through
  `$GITHUB_ENV` into a changed `test` script) hides the coupling and breaks the `test` script outside `sh`; rejected.
- **D3 — the runner adapter, `scripts/scenario-results-node.mjs`.** Node's built-in JUnit reporter writes
  `classname="test"` on every test case and records no test file (read from Node's `junit` reporter source, probed),
  so the file half of `test <file> — <title>` cannot be matched from plain JUnit, and same-titled tests in two files
  would be indistinguishable. The adapter module has two exports:
  - default export: a Node test reporter (async generator) that passes every event to Node's own `junit` reporter
    from `node:test/reporters` unchanged, except that on `test:pass` / `test:fail` events carrying `data.file` it sets
    `data.classname` to that file's path relative to the working directory with `/` separators. Output is ordinary
    JUnit XML; only the standard `classname` attribute is filled in (probed on Node 22.23).
  - `readResults(resultsPath)` → `Array<{ file: string | null, title: string, status: "passed" | "failed" | "skipped" }>`,
    one entry per `<testcase>` and per `<testsuite>` element, read with no third-party dependency. This is the one
    function another project supplies for its own runner.
- **D4 — full nested title rule.** A test's full nested title is the names of its enclosing suites (`describe` blocks,
  or parent tests with subtests) from the file's top level down to the test itself, joined by ` > ` (space, `>`,
  space). A top-level test's full nested title is its own name. The ticket's `<test title>` must equal it exactly
  (case and spaces significant); the ticket's `<test file path>` must equal `file` exactly after stripping a leading
  `./`. A name that resolves to a suite element matches that suite.
- **D5 — status.** Test case: `failed` when it has a `<failure>` child; else `skipped` when it has a `<skipped>` child
  (Node writes this for both `skip` and `todo`; both count as not passed); else `passed`. Suite: `failed` if any
  descendant test case failed, else `skipped` if any descendant was skipped, else `passed`. A suite's `file` is the
  `file` of its first descendant test case (null if none). When one ticket test matches several entries (same file
  and full title twice), the worst status wins: `failed` > `skipped` > `passed`.
- **D6 — rename detection.** No git diff is read. A renamed test no longer produces the old full title, so the `done`
  ticket that still names it gets "test not found", and that line prints the ticket's (old) name plus the instruction
  to update the ticket's verification line in the same change. This suffices for amendment (1)'s rename acceptance.
- **D7 — which tickets.** Every `.md` file directly inside the ticket directory except `README.md` (the same listing
  as `check-tickets`), directory = `--tickets <dir>` or else the configured `ticketDir` (default `docs/tickets`, via
  `resolveTicketDir` from `dist/tools/config.js`, read-only import). A file is considered when `parseTicketFile`
  (from `dist/tools/ticket-file.js`, read-only import) yields `fields.status === "done"`. `not started` and
  `stopped — …` are skipped. Within a `done` ticket only scenarios whose verification kind is `test` count;
  `automated test` (unnamed), `command` and `device-or-person` are out of scope. A missing ticket directory counts as
  zero tickets. A `done` ticket that has format problems (`parseTicketFile(...).problems` non-empty) is reported as a
  problem (exit 1), since `check-tickets` does not run in CI and a malformed file could hide scenarios.
- **D8 — results file missing.** When there is at least one named test in a `done` ticket and the results file cannot
  be read or parsed, the checker cannot run: exit 2 with the reason. When there is no named test in any `done`
  ticket, the results file is never opened (it may not exist) and the checker exits 0.
- **D9 — exit codes.** 0 = every named test of every `done` ticket passed, or there is none; 1 = at least one problem
  (absent / skipped / failed / `done` ticket with format problems); 2 = cannot run (usage error, unreadable ticket
  directory, unreadable or unparseable results, adapter without `readResults`). Problem lines go to stdout, cannot-run
  lines to stderr (the `check-tickets` convention).
- **D10 — CLI.** `node scripts/check-scenario-tests.mjs --results <file> [--tickets <dir>] [--adapter <module>]`.
  `--results` is required (usage error otherwise) even though it is not opened when there is nothing to check.
  `--adapter` loads another module exporting `readResults` (resolved from the working directory); default is this
  repo's `scripts/scenario-results-node.mjs`.
- **D11 — CI step.** A new step `Check ticket scenario tests` directly after `Test`, with `if: ${{ !cancelled() }}`
  (it still reports which ticket scenarios are affected when `Test` failed), running
  `node scripts/check-scenario-tests.mjs --results "$RUNNER_TEMP/test-results.xml"`.
- **D12 — current repo reality.** `.current/.config.json` sets no `ticketDir`; the default `docs/tickets` does not
  exist at base `d239895`, so there is no `done` ticket. The expected real-world CI result on the lane push (both
  Node 20 and 22) is: the new step passes and prints `check-scenario-tests: no named test in a done ticket; results not read`.
  Every other scenario is tested with fixtures. Node 20 behaviour of the adapter (D3) is covered by the qa tests that
  run `node --test` with the adapter reporter on a fixture file: CI runs them on both matrix versions (only Node 22
  and an old 20.0.0 without the junit reporter are installed locally).

## Acceptance Criteria

All fixture scenarios run `scripts/check-scenario-tests.mjs` as a child process from a temporary directory holding a
fixture ticket directory and a results file, unless stated otherwise. Test names are fixed by qa-engineer; the
`proof:` lines name the test file, and the expected-red manifest maps each AC to its test titles.

- **AC1 (passed)** — Given a `done` ticket whose scenario names a test that the results record as passed, when the
  checker runs, then it exits 0 and prints the ok summary line.
  proof: `node --test test/e427-check-scenario-tests.test.mjs` (the AC1 test) passes.
- **AC2 (absent)** — Given a `done` ticket naming a test absent from the results, when the checker runs, then it exits
  1 and prints the `notFound` line with ticket id, scenario id, file and title, and the problem summary line.
  proof: the AC2 test in `test/e427-check-scenario-tests.test.mjs` passes.
- **AC3 (skipped)** — Given a named test recorded as skipped, and separately one recorded as todo, when the checker
  runs, then it exits 1 and prints the `skipped` line for each.
  proof: the AC3 test(s) pass.
- **AC4 (failed)** — Given a named test recorded as failed, when the checker runs, then it exits 1 and prints the
  `failed` line.
  proof: the AC4 test passes.
- **AC5 (no done ticket)** — Given a ticket directory holding only `not started` and `stopped — …` tickets that name
  missing tests, and separately a missing ticket directory, when the checker runs with `--results` pointing at a file
  that does not exist, then it exits 0 and prints the `none` line (results not read).
  proof: the AC5 test(s) pass.
- **AC6 (rename)** — Given a `done` ticket naming `<old title>` and a real fixture test file whose test is now titled
  `<new title>`, run through `node --test` with the adapter reporter, when the checker runs, then it exits 1 and its
  `notFound` line contains the ticket id, the scenario id and `<old title>` and the rename instruction.
  proof: the AC6 test passes.
- **AC7 (full nested title + file)** — Given results where `outer > inner > leaf` passed in file A, when a `done`
  ticket names `A — outer > inner > leaf` the checker exits 0; when it names `A — leaf` or `A — inner > leaf` it exits
  1 (not found); when it names `B — outer > inner > leaf` (same title, other file not in results) it exits 1; a
  leading `./` on the ticket's file path is accepted.
  proof: the AC7 test(s) pass.
- **AC8 (scope of verification kinds)** — Given a `done` ticket whose other scenarios use `automated test`,
  `command …` and `device-or-person: …`, when the checker runs, then those scenarios are not checked (only `test`
  scenarios count in the summary), and a `done` ticket with only such scenarios yields the `none` line and exit 0.
  proof: the AC8 test passes.
- **AC9 (results missing / unparseable)** — Given a `done` ticket naming a test, when `--results` points at a missing
  file, then the checker exits 2 and prints `cannotReadResults` on stderr; when it points at a file that is not
  JUnit XML, it exits 2 and prints `cannotParseResults`.
  proof: the AC9 test(s) pass.
- **AC10 (adapter end to end)** — Given a fixture test file with a nested passing test, a skipped test, a todo test, a
  failing test and a parent test with a subtest, when `node --test` runs it with `--test-reporter=tap
  --test-reporter-destination=stdout --test-reporter=./scripts/scenario-results-node.mjs
  --test-reporter-destination=<tmp>/r.xml`, then stdout is TAP, and `readResults(<tmp>/r.xml)` returns entries with
  the fixture's repo-relative file path, full nested titles joined by ` > `, and statuses per D5 (suite entries
  included). This runs under whichever Node CI's matrix provides (20 and 22).
  proof: the AC10 test in `test/e427-scenario-results-node.test.mjs` passes.
- **AC11 (adapter option)** — Given `--adapter <module>` exporting `readResults` that returns a fixed list, when the
  checker runs on a `done` ticket naming a listed passing test, then it exits 0 without parsing XML; given an adapter
  module with no `readResults` export, it exits 2 with `adapterInvalid`.
  proof: the AC11 test(s) pass.
- **AC12 (done ticket with format problems)** — Given a file with `status: done` that has a format problem, when the
  checker runs, then it exits 1 and prints the `ticketProblems` line for that file.
  proof: the AC12 test passes.
- **AC13 (usage)** — Given no `--results`, or an unknown option, when the checker runs, then it exits 2 and prints the
  `usage` line on stderr.
  proof: the AC13 test passes.
- **AC14 (CI wiring)** — Given `.github/workflows/ci.yml`, then: the job key is still `test` with matrix
  `node-version: [20, 22]`; the step named `Test` runs `node scripts/test-lock.mjs -- node --test` with
  `--test-reporter=tap --test-reporter-destination=stdout` and
  `--test-reporter=./scripts/scenario-results-node.mjs --test-reporter-destination="$RUNNER_TEMP/test-results.xml"`
  before the file glob; that glob equals the glob of `package.json`'s `test` script; the next step is named
  `Check ticket scenario tests`, has `if: ${{ !cancelled() }}`, and runs
  `node scripts/check-scenario-tests.mjs --results "$RUNNER_TEMP/test-results.xml"`; no other step changed.
  proof: the AC14 test in `test/e427-ci-wiring.test.mjs` passes.
- **AC15 (real repo reality)** — Given this repository at the lane head (no ticket directory, so no `done` ticket),
  when `node scripts/check-scenario-tests.mjs --results <a path that does not exist>` runs from the repo root, then it
  exits 0 and prints the `none` line.
  proof: `node scripts/check-scenario-tests.mjs --results /nonexistent/test-results.xml; echo "exit=$?"` prints the `none` line then `exit=0`.
- **AC16 (format doc)** — Given `docs/ticket-format.md`, then: a new section in the general part (before
  `## Example ticket`) states that the check applies only to `done` tickets and only to `Verification: test …`
  scenarios (`automated test` unnamed, `command` and `device-or-person` out of scope), the full nested title rule with
  ` > `, the one function another project supplies (`readResults(resultsPath)` returning
  `{ file, title, status }` entries, status one of `passed`, `failed`, `skipped`), and that a change renaming such a
  test updates the ticket's verification line in the same change; the closing `## Checking with this repository's
  tooling` section names the checker, the adapter, the CI step and the exit codes. The general part still holds no
  link, no repo path and no ticket id other than the example's (the existing `test/e422-ticket-format-doc.test.mjs`
  and `test/e455-ticket-checker-strict.test.mjs` stay green).
  proof: the AC16 test in `test/e427-ticket-format-doc.test.mjs` passes, plus `node --test test/e422-ticket-format-doc.test.mjs test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC17 (suite)** — Given the lane head committed with a clean tree, when `node scripts/test-lock.mjs -- npm test`
  runs, then it exits 0 with 0 failures (baseline at `d239895`: 4704 pass / 4707 tests, 3 skipped, 0 fail), and the
  lane push's CI `test (20)` and `test (22)` are green.
  proof: `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` ends with `# fail 0` and `exit=0`.

## Copy / Strings

All lines are printed by `scripts/check-scenario-tests.mjs`. `<ticket>` = the ticket's `id` field (the file path
when `id` is missing); `<scenario>` = scenario id; `<file>` / `<title>` = the ticket's verification as written.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| notFound | `check-scenario-tests: <ticket> <scenario>: test not found: <file> — <title> (if it was renamed, update this ticket's Verification line in the same change)` | authored-here — amendment (1): name ticket, scenario and the (old) test name; the rename instruction is the amendment's "renaming pull request updates the ticket" rule |
| skipped | `check-scenario-tests: <ticket> <scenario>: test was skipped: <file> — <title>` | authored-here — backlog E427 acceptance "skipped … fails" |
| failed | `check-scenario-tests: <ticket> <scenario>: test failed: <file> — <title>` | authored-here — backlog E427 "absent, skipped or failed" |
| ticketProblems | `check-scenario-tests: <ticket file>: done ticket has format problems; run check-tickets on it` | authored-here — D7 |
| okSummary | `check-scenario-tests: ok — <n> named test(s) in <m> done ticket(s) passed` | authored-here — one summary line like `check-tickets` |
| problemSummary | `check-scenario-tests: <k> problem(s) in <n> named test(s) from <m> done ticket(s)` | authored-here — one summary line like `check-tickets` |
| none | `check-scenario-tests: no named test in a done ticket; results not read` | authored-here — amendment (1) "passes without reading results" |
| usage | `check-scenario-tests: usage: node scripts/check-scenario-tests.mjs --results <file> [--tickets <dir>] [--adapter <module>]` | authored-here — D10 |
| unknownOption | `check-scenario-tests: unknown option <option>` (followed by the `usage` line) | authored-here — D10, wording as `check-tickets: unknown option` |
| cannotReadResults | `check-scenario-tests: cannot read results <path>: <reason>` | authored-here — D8 |
| cannotParseResults | `check-scenario-tests: cannot parse results <path>: <reason>` | authored-here — D8 |
| cannotReadTickets | `check-scenario-tests: cannot read tickets <dir>: <reason>` | authored-here — D9 |
| adapterInvalid | `check-scenario-tests: adapter <module> has no readResults function` | authored-here — D10 |
| ciStepName | `Check ticket scenario tests` | authored-here — D11, CI step name |
| doc section heading | `## Named tests checked in CI` | authored-here — AC16, general-part heading in `docs/ticket-format.md` |

`<reason>` is the first clause of the error message (as `check-tickets` prints it). The `docs/ticket-format.md` prose
itself is authored by sr-engineer within AC16's required content.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Amendment (2): qa-engineer backfilling the test name and code-reviewer confirming the named test checks the
  scenario, written into `content/skill-qa-engineer.md` / `content/skill-code-reviewer.md` — wave 2 (E425 lane).
- Any `.ts` change (including `tools/ticket-file.ts`, `tools/config.ts`), `dist/**`, `content/**`, compose goldens,
  `test/context-budget.test.mjs`.
- E425 ticket status changes; a `## Added during build` or status-vocabulary change in the format doc.
- `command` and `device-or-person` verifications (not run, not checked); unnamed `automated test` lines.
- Reading git history to detect renames (D6).
- Repository rulesets / required-check names (unchanged); `release.yml`; `package.json` (unchanged, D1).
- Adapters for other runners (only documented).

## Dependencies / Prerequisites

- Reads, never changes: `dist/tools/ticket-file.js` (`parseTicketFile`) and `dist/tools/config.js`
  (`resolveTicketDir`), built from base. e424 may add exports to `tools/ticket-file.ts` but does not change existing
  signatures (fan-out spec).
- `node:test/reporters` `junit` export and `data.file` on test events: present on Node 22 (probed); Node 20 is covered
  by AC10 running in CI's `test (20)`.
- Probe at base `d239895` (Node 22.23, `node scripts/test-lock.mjs -- npm test`): 4704 pass / 4707 tests, 3 skipped,
  0 fail, exit 0; no pre-existing red.
- Existing tests that read the files this lane edits (plausibly red; kept green by construction, re-checked by the
  full suite):
  - `test/e422-ticket-format-doc.test.mjs` — general part of `docs/ticket-format.md` must hold no link, no
    `docs/ scripts/ templates/ specs/ tools/ content/` path, no `.current` / `.config.json` / `backlog.md`; headings
    `## Field block`, `## Scenarios`, `## Example ticket`, `## Checking with this repository's tooling` kept; the
    tooling section stays LAST (everything after its heading is excluded from the general part).
  - `test/e455-ticket-checker-strict.test.mjs` — same general-part rules plus no `test/` / `dist/` path and no
    `[A-Z]\d{2,}` id other than `E900` / `E899`; the example still passes the checker.
  - `test/check-md-tables.test.mjs` / `npm run check:md-tables` — tables in the doc stay well-formed.
  - `test/e298-finish-remote-delete.test.mjs` (AC1/AC2: `ci.yml` triggers and `jobs` present) and
    `test/e405-release-workflow.test.mjs` (AC-W10: `ci.yml` parses, `name: CI`) — unaffected by a step edit.
  - Not affected: `test/e423-spec-workshop.test.mjs`, `test/e445-spec-workshop-questioning.test.mjs`,
    `test/e462-stale-comments-wording.test.mjs` (they match SOP text that names the doc path, not the doc's content);
    `test/e296-*`, `test/e349-*`, `test/e355-*` (mention `ci.yml` in other files' text).
  No existing test is expected to go red; any that does is reported to the integrator before re-pinning.
- Chain: v5 without architect — qa-engineer (tests + `qa_reports/expected-red_e427-ci-scenario-tests.txt`) →
  sr-engineer → code-reviewer. Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.
- Fixture test files (AC6, AC10) live under `test/fixtures/e427/`, never directly in `test/`, so the suite glob
  `test/*.test.mjs` never runs their deliberately failing / skipped tests.
- External references: none (the backlog row and discussion sections are in-repo).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E427-01 | qa-engineer: one test per AC (AC1–AC14, AC16) with new fixtures only under `test/fixtures/e427/` (ticket dirs, results XML, a real fixture test file for AC6/AC10, an adapter module for AC11); write `qa_reports/expected-red_e427-ci-scenario-tests.txt` | none | 6 | `test/e427-check-scenario-tests.test.mjs`, `test/e427-scenario-results-node.test.mjs`, `test/e427-ci-wiring.test.mjs`, `test/e427-ticket-format-doc.test.mjs`, `test/fixtures/` | — |
| T-E427-02 | sr-engineer: runner adapter — reporter default export (Node junit + `classname` = repo-relative file) and `readResults` (dependency-free JUnit read, full nested titles, statuses per D5) (AC10; ~120 lines) | T-E427-01 | 1 | `scripts/scenario-results-node.mjs` | — |
| T-E427-03 | sr-engineer: checker CLI — args, ticket selection (D7), matching (D4–D6), messages per Copy / Strings, exit codes (D8–D10), `--adapter` (AC1–AC9, AC11–AC13, AC15; ~180 lines) | T-E427-02 | 1 | `scripts/check-scenario-tests.mjs` | — |
| T-E427-04 | sr-engineer: CI wiring — `Test` step `run:` per D1, new `Check ticket scenario tests` step per D11 (AC14, AC17) | T-E427-03 | 1 | `.github/workflows/ci.yml` | — |
| T-E427-05 | sr-engineer: format doc — general section `## Named tests checked in CI` (scope limit, done-only, full nested title, `readResults`, rename rule) and tooling-section additions (checker, adapter, CI step, exit codes) (AC16) | T-E427-03 | 1 | `docs/ticket-format.md` | — |
