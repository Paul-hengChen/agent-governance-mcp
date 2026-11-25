# Tests — e427-ci-scenario-tests (T-E427-01, qa-engineer)

No ticket file (no ticket directory in this repo); the Acceptance Criteria of `specs/e427-ci-scenario-tests.md`
stand in as the scenarios. Test-file placement: the dispatch brief's `Test-file placement` line (four new files,
fixtures only under `test/fixtures/e427/`, creation pre-authorized) — that branch was acted on; no existing test file
covers this scope.

## Scenario → Test Map

| AC | test file | exact test name |
|---|---|---|
| AC1 | `test/e427-check-scenario-tests.test.mjs` | AC1 a done ticket whose named test passed exits 0 and prints the ok summary |
| AC2 | `test/e427-check-scenario-tests.test.mjs` | AC2 a done ticket naming a test absent from the results exits 1 with the notFound line and the problem summary |
| AC3 | `test/e427-check-scenario-tests.test.mjs` | AC3 a named test recorded as skipped, and one recorded as todo, each fail with the skipped line |
| AC4 | `test/e427-check-scenario-tests.test.mjs` | AC4 a named test recorded as failed exits 1 with the failed line |
| AC5 | `test/e427-check-scenario-tests.test.mjs` | AC5 with no done ticket (not started / stopped, or no ticket directory) the checker exits 0 with the none line and never opens the results |
| AC6 | `test/e427-check-scenario-tests.test.mjs` | AC6 a done ticket still naming a renamed test fails with the notFound line naming the old title and the rename instruction |
| AC7 | `test/e427-check-scenario-tests.test.mjs` | AC7 the ticket must name the full nested title and the exact file; a leading ./ on the file is accepted |
| AC8 | `test/e427-check-scenario-tests.test.mjs` | AC8 only `test` verifications are checked; automated test, command and device-or-person scenarios are not |
| AC9 | `test/e427-check-scenario-tests.test.mjs` | AC9 a missing results file exits 2 with cannotReadResults, a non-JUnit file exits 2 with cannotParseResults (stderr) |
| AC10 | `test/e427-scenario-results-node.test.mjs` | AC10 the adapter reporter writes JUnit with the repo-relative file, and readResults returns full nested titles and D5 statuses |
| AC11 | `test/e427-check-scenario-tests.test.mjs` | AC11 --adapter uses another module's readResults; a module without readResults exits 2 with adapterInvalid |
| AC12 | `test/e427-check-scenario-tests.test.mjs` | AC12 a done ticket with format problems exits 1 with the ticketProblems line |
| AC13 | `test/e427-check-scenario-tests.test.mjs` | AC13 a missing --results or an unknown option exits 2 with the usage line on stderr |
| AC14 | `test/e427-ci-wiring.test.mjs` | AC14 ci.yml keeps job test on [20, 22], runs Test with reporters before the package.json glob, then the Check ticket scenario tests step |
| AC15 | — (command scenario; judge runs it) | `node scripts/check-scenario-tests.mjs --results /nonexistent/test-results.xml; echo "exit=$?"` → `none` line, `exit=0` |
| AC16 | `test/e427-ticket-format-doc.test.mjs` | AC16 the format doc explains the CI check of named tests in the general part and names the tooling in the closing section (plus existing `test/e422-ticket-format-doc.test.mjs`, `test/e455-ticket-checker-strict.test.mjs` stay green) |
| AC17 | — (command scenario; judge runs it) | `node scripts/test-lock.mjs -- npm test` exit 0, `# fail 0`; CI `test (20)` / `test (22)` green |
| AC18 | `test/e427-check-scenario-tests.test.mjs` | AC18 an adapter that cannot be imported prints adapterInvalid then adapterLoadError with the reason; a module without readResults prints no adapterLoadError |
| AC19 | — (command scenario; judge runs it) | `node bin/agc-init.mjs check 2>&1 \| grep -E "comments: scripts/(check-scenario-tests\|scenario-results-node)\.mjs" ; echo "matches-exit=$?"` → only `matches-exit=1` |

Fixtures (`test/fixtures/e427/`, never matched by the suite glob `test/*.test.mjs`): `results-basic.xml` (frozen
Node-junit-shaped results with `classname` = file, per D3), `not-junit.txt`, `fixed-adapter.mjs`,
`no-read-adapter.mjs`, `rename-target.mjs` (AC6 real test file), `adapter-e2e.mjs` (AC10 real test file with nested,
skipped, todo, failing and parent/subtest cases). Ticket files are generated per test into a temp directory and
asserted valid with `parseTicketFile` before use (except the deliberately malformed AC12 one).

## Open Interface Details

- **Checker cwd and paths.** Each checker run uses a fresh temp dir as cwd with `--tickets tickets` (relative) and
  `--results results.xml` (relative); the default adapter must therefore be located relative to the checker script,
  not the cwd (D10 "default is this repo's"). `--adapter` is passed as `./<name>.mjs` relative to cwd (D10 "resolved
  from the working directory").
- **Streams.** ok / problem / none / notFound / skipped / failed / ticketProblems lines are asserted on stdout;
  usage / unknownOption / cannotReadResults / cannotParseResults / adapterInvalid on stderr (D9).
- **`<path>` in cannotRead/cannotParse.** The tests pass an absolute `--results` path, so "as given" and "resolved"
  coincide; `<reason>` is asserted non-empty only.
- **`<ticket file>` in ticketProblems and `<module>` in adapterInvalid.** Asserted by regex allowing any non-space
  path prefix before the file name (`\S*bad-done\.md`, `\S*no-read-adapter\.mjs`): the spec does not fix whether the
  path is printed as given, relative or absolute.
- **Summary counts.** `<m>` is only ever exercised with one done ticket that names tests, so "done tickets" vs "done
  tickets with a named test" is not pinned. The AC12 problem summary is not asserted (its k/n counting for a
  malformed ticket is not fixed by the spec).
- **AC3 "separately".** Skipped and todo are two scenarios of one done ticket in one run → two `skipped` lines and
  `2 problem(s) in 2 named test(s) from 1 done ticket(s)`.
- **unknownOption ordering.** The `usage` line is asserted to be the stderr line immediately after
  `check-scenario-tests: unknown option --bogus`.
- **AC10 entries.** Compared as a sorted set over `{ file, title, status }` only (extra properties and order are
  free); suite entries `outer`, `outer > inner`, `parent` are expected with status `passed`.
- **AC10 / AC6 runs** spawn `node --test` from the repo root with the exact D1 reporter options and
  `NODE_TEST_CONTEXT` removed from the env (a nested runner otherwise reports to the parent runner).
- **AC14 "no other step changed".** The four steps before `Test` are frozen in-test (checkout with fetch-depth 0,
  setup-node with npm cache, `npm ci`, `npm run build`); `Test` has only `name` and `run`; the new step is last.
  The Test `run:` is compared whitespace-normalized to the exact D1 string with the glob taken from
  `package.json`'s `test` script.
- **AC16 content checks** are word-level (sr-engineer authors the prose): `done` in backticks, `Verification: test`,
  the three out-of-scope kinds, a literal ` > `, the word "nested", `readResults(resultsPath)`, the words file /
  title / status / passed / failed / skipped, "renam…", "same change"; plus the e422/e455 hygiene rules applied to
  the new section itself. Tooling section: both script paths, the CI step name, and 0 / 1 / 2 after the checker's
  first mention; it stays the last `## ` section.

- **AC18 (amendment, T-E427-06).** Two import failures are exercised: a path that does not exist
  (`./missing-adapter.mjs`, the spec's example) and a module that exists but does not parse (`broken-adapter.mjs`,
  the brief's example). The broken module is written into the per-test temp dir at run time, not tracked under
  `test/fixtures/e427/`, so no deliberately unparseable file sits in the repo for other tooling to trip on. The
  `adapterLoadError` `<module>` is matched like `adapterInvalid`'s (`\S*` prefix + file name); `<reason>` is asserted
  non-empty only (the spec ties it to `reason()`'s cut, which is an implementation detail). "Directly after" is
  asserted as the next non-empty stderr line after the `adapterInvalid` line. The AC11 no-readResults case is
  re-run inside AC18 to assert no line starting `check-scenario-tests: cannot load adapter `. AC9/AC11/AC13 tests
  are unchanged.

## Red Reasons

### Amendment 2026-11-25 (T-E427-06) — current

- AC18: `scripts/check-scenario-tests.mjs` prints only the `adapterInvalid` line when the adapter import throws; no
  `adapterLoadError` line follows it — T-E427-07.

### T-E427-01 — resolved (history; green since T-E427-02..05)

- AC1–AC9, AC11–AC13: `scripts/check-scenario-tests.mjs` not built (child process: Cannot find module) — T-E427-03.
- AC6 additionally: `scripts/scenario-results-node.mjs` not built (ERR_MODULE_NOT_FOUND for the reporter) — T-E427-02.
- AC10: `scripts/scenario-results-node.mjs` not built; `node --test` writes no TAP and no results file — T-E427-02.
- AC14: `ci.yml` Test step still `npm test`, no `Check ticket scenario tests` step — T-E427-04.
- AC16: `docs/ticket-format.md` has no `## Named tests checked in CI` section — T-E427-05.

## CI Runnability

All four files run headlessly under `npm test`. AC10 and AC6 run the real Node runner, so they exercise Node 20 and
22 in CI's matrix; locally only Node 22.23 was available for this run.
