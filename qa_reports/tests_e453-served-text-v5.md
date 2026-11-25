# Test report — e453-served-text-v5 (qa-engineer, phase 1: T-E453-01..04)

Spec: `specs/e453-served-text-v5.md` (cut v1; no ticket file, so its Acceptance Criteria are the scenarios).
Mode: test-first, feature (no `dispatch_mode: "bugfix"`), non-design.

## Test-file placement

Branch acted on: the dispatch brief's `Test-file placement` line (Constitution §2 *Conditional test writing*),
which pre-authorised the two new files and named the re-pin files.

| file | kind | tasks |
|---|---|---|
| `test/e453-served-text-v5.test.mjs` | new | T-E453-01 (AC1–AC3, AC5–AC12, AC16–AC27) |
| `test/e457-doc-numbers.test.mjs` | new | T-E453-02 (AC13–AC15) |
| `test/e433-test-first-rules.test.mjs` | re-pin | T-E453-03 (AC4, AC11, AC16, AC23) |
| `test/e393-builder-judge-core.test.mjs` | re-pin | T-E453-03 (AC11, AC23) |
| `test/e408-core-task-alias-tail.test.mjs` | re-pin (line 35 only) | T-E453-04 (AC18) |
| `test/e412-qa-visual-template.test.mjs` | re-pin (line 58 only) | T-E453-04 (AC18) |
| `test/e434-reviewer-visual.test.mjs` | re-pin (line 61 `COPY.coord05Dispatch` only) | T-E453-04 (AC18) |

T-E453-04 ran because the owned-set amendment (manifest `specs/fanout-pre-v5-w1.md` Decisions, human Q7,
2026-11-25) is merged into the lane (base-fix merge `934a0d2`).

## Scenario → Test Map

| AC | test file | exact test name |
|---|---|---|
| AC1 | test/e453-served-text-v5.test.mjs | AC1: code-reviewer Rejection rows bullet starts with the FAIL write and rolls back only an id the task list already shows [x] |
| AC2 | test/e453-served-text-v5.test.mjs | AC2: code-reviewer step 1 accepts sr-engineer In_Progress, the pm resume_of write, its own Blocked, claim and checkpoint, and STOPs otherwise |
| AC3 | test/e453-served-text-v5.test.mjs | AC3: reviewer-visual rejection rows carry no tw_rollback_task; widget, drift and check-defect rows are the FAIL write alone |
| AC4 | test/e433-test-first-rules.test.mjs | AC5 (E435): skill-code-reviewer.md is the chain's judge (tests vs scenarios, full suite, Expected-Red Diff, AC Execution, audits, PASS and rejection rows, clean-context carve-outs) |
| AC5 | test/e453-served-text-v5.test.mjs | AC5: migration guide re-stamp section is mig.restamp, and following it on a 4.0.0-stamped workspace ends with agc check exit 0 |
| AC6 | test/e453-served-text-v5.test.mjs | AC6: migration guide splits the sr-engineer row into In_Progress and Blocked, and validateTransition agrees |
| AC7 | test/e453-served-text-v5.test.mjs | AC7: migration guide SQLite / HTTP section names the file-mode-only checks (mig.sqlite_checks) and not the old/new server mix |
| AC8 | test/e453-served-text-v5.test.mjs | AC8: migration guide What changed has the schema 15 → 17 bullet and the mixed-servers bullet, outside the SQLite section |
| AC9 | test/e453-served-text-v5.test.mjs | AC9: review_round cap row says 4 (equal to the server cap) with limits.review_round.meaning; architecture row and transitions comment agree; check-only sites unchanged |
| AC10 | test/e453-served-text-v5.test.mjs | AC10: hop cap is stated per feature (reset only by an active_feature change) in Limits, const-15 and the architecture auto-routing paragraph |
| AC11 | test/e453-served-text-v5.test.mjs | AC11: sr_return cap is stated as closing only the sr-engineer → qa-engineer return until the next pm In_Progress write, at every site |
| AC11 (re-pins) | test/e433-test-first-rules.test.mjs; test/e393-builder-judge-core.test.mjs | AC2 (E435): … Limits (d) …; AC4: skill-sr-engineer.md builds to pre-written tests, …; AC-C (E435): named sites restate no bare round number |
| AC12 | test/e453-served-text-v5.test.mjs | AC12: the sr_return Limits row and sr-engineer step 4c say SQLite/HTTP mode counts no returns |
| AC13 | test/e457-doc-numbers.test.mjs | AC13: CONTRIBUTING, architecture and config state 17 steps and 33 gates, and CONTRIBUTING carries no test-file count |
| AC14 | test/e457-doc-numbers.test.mjs | AC14: architecture step 1 box lists four cap overrides, HOP_CAP_EXCEEDED after the SR_RETURN_CAP line, every box line 67 characters wide |
| AC15 | test/e457-doc-numbers.test.mjs | AC15: every pipeline-length and gate-count statement in the five docs equals the live counts; the checker reports mutated numbers |
| AC16 | test/e453-served-text-v5.test.mjs | AC16: coordinator routing-table rows for implement / review / test name the pm-stamped entry and the judge dispatch |
| AC16 (re-pin) | test/e433-test-first-rules.test.mjs | AC6 (E435): pm routes architect or qa-engineer with no marker, bugfix mode, amend path and counters; architect routes to qa-engineer |
| AC17 | test/e453-served-text-v5.test.mjs | AC17: integrator 'a builder' item is integ.builder (both §2 carve-outs by reference) |
| AC18 | test/e453-served-text-v5.test.mjs | AC18: coord-05 dispatch parenthetical is coord05.dispatch and the void sentence is coord05.void |
| AC18 (re-pins) | test/e408-core-task-alias-tail.test.mjs; test/e412-qa-visual-template.test.mjs; test/e434-reviewer-visual.test.mjs | e408 AC2 + AC3 (claude-code composition) via the `SITES` row; e412 AC3; e434 AC2 via `COPY.coord05Dispatch` |
| AC19 | test/e453-served-text-v5.test.mjs | AC19: sr-engineer step 3b infeasible-repro escape routes per Escalation Routes: scenario cannot be built |
| AC20 | test/e453-served-text-v5.test.mjs | AC20: tw_update_state descriptions of cut_approved, external_refs and dispatch_mode name the v5 build entry and the judge; no tw_* description names the old entry or Phase 0.5 |
| AC21 | test/e453-served-text-v5.test.mjs | AC21: docs/config.md skill-override caveat names the code-reviewer PASS evidence (config.caveat_skill) |
| AC22 | test/e453-served-text-v5.test.mjs | AC22: lane-protocol hop-continuation (b) and the report's tasks line name the code-reviewer verdict only |
| AC23 | test/e453-served-text-v5.test.mjs | AC23: served content names no qa verdict and no awaiting independent QA; Builder ≠ judge bullet, coord-03 row 39 note and rationale line are rewritten |
| AC23 (re-pins) | test/e433-test-first-rules.test.mjs; test/e393-builder-judge-core.test.mjs | AC2 (E435): … builder ≠ judge unchanged (c) …; AC-A1: builder ≠ judge rule is in const-05 §3 and in all four compositions |
| AC24 | test/e453-served-text-v5.test.mjs | AC24: design-auditor build-entry edge reads pm:In_Progress → {architect,qa-engineer}:In_Progress; no served file names {architect,sr-engineer} |
| AC25 | test/e453-served-text-v5.test.mjs | AC25: each content/*.md quotes the same set of GateErrorCode names in backticks as at base |
| AC26 | test/e453-served-text-v5.test.mjs | AC26: the content lines this feature changes cite no repo-only path and no bare ticket id |
| AC27 | test/e453-served-text-v5.test.mjs | AC27: TOOL_REGISTRY names, input-schema property keys and enums equal base (descriptions are the only registry change) |
| AC28 | — (phase 2, T-E453-10) | goldens and context-budget caps are re-captured after sr's planned return; the full suite is the proof |

`command` parts the judge runs (no test of mine): AC25 and AC26's second halves (`node --test test/error-code-contract.test.mjs`,
`node --test test/e437-repo-only-paths.test.mjs`, both green now and on the probe), AC27's two `git diff 70d34c6` commands,
AC28's full suite.

### Re-pins, line by line (literal switched to the Copy text, nothing else changed)

| file | line (base) | old pin | new pin |
|---|---|---|---|
| e433 | 86 | `BUILDER_NE_JUDGE` old bullet | `c05.builder_judge` |
| e433 | 223 | `…before routing locks to pm` | `limits.sr_return.meaning` |
| e433 | 307 | `…and only pm may take the feature` | `sr.cap_tail` |
| e433 | 346 | FAIL-write prefix | `cr.reject_head` (the bullet now opens with the FAIL write) |
| e433 | 347 | bare `` `tw_rollback_task(<task-id>, <reason>)` `` | `cr.reject_rollback` |
| e433 | new line after the AC5 must loop | — | `assert.ok(!cr.includes("per rejected id, then"), …)` (AC4 negative check) |
| e433 | 392 / 393 | bare `` `qa-engineer` `` / `` `code-reviewer` `` intent rows | `coord01.row_test` / `coord01.row_review` rows |
| e393 | 24 | `BULLET` old bullet | `c05.builder_judge` |
| e393 | 129 | `…past which only pm may take the feature` | `c12.sr_return` |
| e408 | 35 | `(subagent-dispatch tool or `tw_switch_role`)` | the `coord05.dispatch` parenthetical |
| e412 | 58 | same parenthetical | `When dispatching `reviewer-visual` (` + the new parenthetical |
| e434 | 61 | `COPY.coord05Dispatch` old line | the new line (`coord05.dispatch` + unchanged rest) |

The e433 AC9 test (the `AC_EXECUTION_LOG_MISSING` hint) is not touched: a human ruling in the integrator session
moved that one test to another lane (coordinator message, this hop).

## Open Interface Details

- **AC15 checker** is an in-test function `checkDocNumbers(text, {steps, gates})`: it normalises whitespace, matches
  `(?<![§.\d])(\d+)(-step| steps| entries| gate definitions| gates)` with a word boundary after the noun, and returns one
  finding per number that differs from the live count. Not exported (a test file is not an import surface).
  Mutation cases run first (the spec's four strings, plus "correct" and `§`-prefixed numbers that must not be reported).
- **AC14 box bounds**: the box is the last `┌` line above the step 1 row through the first `└` line below step 2;
  every line in it must be 67 code points (`[...line].length`, so `≥`, `→`, `│` count as one).
- **AC25 code list and file list** are frozen literals (33 `GateErrorCode` names, 37 `content/*.md` files, per-file sets
  at base). A content file added later is not checked; a base file that disappears fails the test.
- **AC26 "changed lines"** are located by their Copy text (each must land on exactly one line, after origin-tag
  stripping, which every served mode applies). On those lines: no path under a repo-only top directory
  (`specs/ research/ tools/ gates/ test/ docs/ scripts/ prompts/ schema/ bin/ dist/ templates/ lib/`, unless
  `<agc install>/`-prefixed) and no `E\d+` at all. This is stricter than "bare ticket id with no explanation"; no
  Copy line carries a ticket id, so the stricter rule costs nothing and needs no judgement call.
- **AC27 enum paths**: nested enums keyed by dotted path (`dispatch_pins.pm`, `external_refs[].state`).
- **AC5** runs `bin/agc-init.mjs init` / `check` in an `os.tmpdir()` temp workspace (not a git repo) whose three adapters
  carry `agc-version: 4.0.0`; the hand bump uses the installed version from `package.json`.
- **AC6** calls `validateTransition` with `prev_review_round: 0` and no other counters (a fresh feature).
- **AC9** finds the check-only sites by frozen literal line text, not by line number.
- **Text checks** read `content/**` with origin tags removed (`<!-- origin:start -->…<!-- origin:end -->`), the text every
  served mode carries; docs are read raw with whitespace normalised.

## Probe — are the tests satisfiable?

A throwaway copy of the worktree (scratchpad, no `.git`) had every Copy / Strings edit of the spec applied by script,
then `tsc` and the new + re-pinned test files plus `test/error-code-contract.test.mjs` and `test/e437-repo-only-paths.test.mjs`:
114 tests, 107 pass, 0 fail, 6 skipped (closed-range checks that need `.git`), after one fix to my own AC14 box-bounds
lookup. So every red test here turns green on the spec's text, and AC25 holds on that text.

## Red Reasons

34 red tests, one line each in `qa_reports/expected-red_e453-served-text-v5.txt` (`<test file> | <exact test name> | <reason>`):

- `test/e453-served-text-v5.test.mjs`: 21 red (AC1–AC3, AC5–AC12, AC16–AC24, AC26). Each: the Copy text it pins is not
  in the file yet (T-E453-05..09). Partial behaviour already holds: AC5's `agc init` / `check` run and AC6's
  `validateTransition` checks pass on the base tree; only the doc assertions are red.
- `test/e457-doc-numbers.test.mjs`: 3 red (AC13–AC15): the docs still say 18-step / 35 gates / 87 test files; AC15's
  mutation cases already pass, only the five-doc scan is red (CONTRIBUTING `18-step` x2 and `35 gate definitions`,
  architecture `35 entries`, config `18 gates`).
- Re-pins: 10 red — e433 AC2, AC4, AC5, AC6; e393 AC-A1, AC-C; e408 AC2, AC3 (claude-code composition); e412 AC3;
  e434 AC2. Each pins Copy text that is not built yet.

Already green (kept): `AC25` (code sets unchanged at base) and `AC27` (registry shape unchanged at base). They are
guards: sr's edits must keep them green.

## Build gate / CI runnability

No compile errors: all files are plain `.mjs` and import only existing `dist/` exports. All tests run headless
under `npm test` (temp dirs under `os.tmpdir()`, removed in `after`).

## Suite result

Run on a clean tree (`git status --porcelain` empty) at commit `94b3111`:
`node scripts/test-lock.mjs -- npm test` → **4605 tests, 4569 pass, 34 fail, 2 skipped, 0 cancelled** (exit 1).

- 4605 = the 4579-test baseline + 26 new tests (23 in `test/e453-served-text-v5.test.mjs`, 3 in `test/e457-doc-numbers.test.mjs`).
- The 34 failing test names equal the 34 manifest entries exactly (sorted set diff empty): no red off the manifest,
  and every pre-existing test that is not a re-pin stayed as it was.
- `test/e433-test-first-rules.test.mjs` AC9 (moved to another lane by a human ruling) is green and untouched.
