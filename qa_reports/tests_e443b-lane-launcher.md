# Tests — e443b-lane-launcher (T-E443B-01, qa-engineer)

Scenarios: `specs/e443b-lane-launcher.md` A2-1..A2-27 (no ticket file; the spec's Acceptance Criteria stand in).
Interfaces followed exactly: `specs/e443b-lane-launcher-architecture.md` *Interface Contracts* (`LaunchDeps`,
`resolveLaunchContext`, `runLaneLaunch`, `runLaneLaunchCli`, `featureStartArgv`, `launchCommand`, `shellQuote`,
launch-state schema, CLI contract) and the cut's Copy / Strings (byte-exact).

Test-file placement: the dispatch brief's `Test-file placement` line (new `test/e443b-*.test.mjs`, fixtures under
`test/fixtures/e443b/**`, pre-authorized) — Constitution §2 *Conditional test writing* branch: brief-authorized new
files. No existing test file covered the launcher.

## Scenario → Test Map

| AC | file | test name (top level; variants are subtests) |
|---|---|---|
| A2-1 | `test/e443b-scheduling.test.mjs` | `A2-1: a wave of four lanes under laneLaunchLimit 2 never has more than two running and starts all four` |
| A2-2 | `test/e443b-scheduling.test.mjs` | `A2-2: with no laneLaunchLimit key a wave of five lanes runs at most three at once` |
| A2-3 | `test/e443b-scheduling.test.mjs` | `A2-3: a lane whose depended-on lane is not merged is not started and is listed as waiting on it` |
| A2-4 | `test/e443b-scheduling.test.mjs` | `A2-4: with knowledge local a merged depended-on lane without a finish record keeps its dependent waiting` |
| A2-5 | `test/e443b-scheduling.test.mjs` | `A2-5: a second run starts no running or finished lane again and the launch-state file stays untracked` |
| A2-6 | `test/e443b-scheduling.test.mjs` | `A2-6: no launcher run, a refusal included, changes the manifest's bytes` |
| A2-7 | `test/e443b-window.test.mjs` | `A2-7: a weekly-limit line with no Continuing automatically at after it pauses the lane as paused-weekly, never woken; others continue` |
| A2-8 | `test/e443b-window.test.mjs` | `A2-8: Automatic continue stopped marks paused-stopped; the next run sends the wake line into the same window only` |
| A2-9 | `test/e443b-window.test.mjs` | `A2-9: Press enter to continue gets one empty write text from the launcher and the lane stays running` |
| A2-10 | `test/e443b-window.test.mjs` | `A2-10: a lane whose window closed is not finished and is resumed in a new window in the same worktree` |
| A2-11 | `test/e443b-scheduling.test.mjs` | `A2-11: no 人類 Decisions row, or cutApprovalAutoTier.manifest not true, refuses, names the reason, exits non-zero and starts nothing` |
| A2-12 | `test/e443b-scheduling.test.mjs` | `A2-12: a manifest with no 波次 column is refused with the reason and a non-zero exit` |
| A2-13 | `test/e443b-scheduling.test.mjs` | `A2-13: a lane with approval human or a ticket without a ticket file is not started and listed; the others start` |
| A2-14 | `test/e443b-scheduling.test.mjs` | `A2-14: after wave 1 finished and merged, wave 2 lanes whose depended-on lanes are met start from main; an unmet one waits` |
| A2-15 | `test/e443b-window.test.mjs` | `A2-15: a new lane gets one agc feature start and its session opens in the new worktree; an existing worktree is reused` |
| A2-16 | `test/e443b-window.test.mjs` | `A2-16: the CLI starts with no prompt; the slash line, then the render --batch output in one write text, each followed by an empty write text` |
| A2-17 | `test/e443b-window.test.mjs` | `A2-17: Unknown command after the slash line is resent at most 3 times, then the lane is start-failed and frees its slot` |
| A2-18 | `test/e443b-window.test.mjs` | `A2-18: no trust entry, no iTerm2, autoContinueAtUsageLimit in project/local settings, or fallbackModel anywhere refuses, naming the cause` |
| A2-19 | `test/e443b-served-text.test.mjs` | `A2-19: content/skill-integrator.md names the launcher's two re-run moments; Work overview, Lifecycle and Stage 3 say it replaces hand-opened sessions and a refused wave stays hand-started` |
| A2-20 | `test/e443b-served-text.test.mjs` | `A2-20: the composed coordinator SOP opens the Crash-Resume Protocol with the usage-limit line (no fallback, no model switch, one re-dispatch, then checkpoint and stop)` |
| A2-21 | `test/e443b-served-text.test.mjs` | `A2-21: docs/lane-protocol.md §1 step 1 exempts a launcher-started lane (confirm location only), §1 keeps its line count, §3 批次 lane names the launcher` |
| A2-22 | `test/e443b-scheduling.test.mjs` | `A2-22: a 相依 cell naming a lane of the same 波次 refuses the run, naming both lanes and the wave` |
| A2-23 | `test/e443b-config-ancestry.test.mjs` | `A2-23: checkLaneAncestry takes (branches, repoRoot, ref): compares with ref; a two-argument caller still compares with HEAD` |
| A2-24 | `test/e443b-config-ancestry.test.mjs` | `A2-24: loadConfig surfaces laneLaunchLimit only as a positive integer, no default, schema 2; docs/config.md has its one section` |
| A2-25 | `test/e443b-served-text.test.mjs` | `A2-25: CLAUDE.md keeps 250 lines with the lane-launch Layout row after tools/config.ts and a one-line prompts row; the addendum §5 tool line ends with lane-launch` |
| A2-26 | `test/e443b-scheduling.test.mjs` | `A2-26: progress reports never finish a lane: it stays running, keeps its slot and the queued lane waits` |
| A2-27 | `test/e443b-scheduling.test.mjs` | `A2-27: a lane report, or a report while every ticket is done or stopped (one stopped), finishes the lane and frees its slot` |

Every `proof:` line (`node --test --test-name-pattern "^A2-N:" test/e443b-*.test.mjs`) selects exactly one top-level
test; its subtests run with it (checked on Node 22).

Shared stand-ins: `test/fixtures/e443b/harness.mjs` (fake window driver, fake clock with 15 s poll hooks, temp git
primary with `main`, ticket files, manifest builder, temp host settings paths, a feature-start runner that only runs
`git worktree add` in the temp repo, mailbox / ticket-status writers). Ticket fixtures: `test/fixtures/e443b/tickets/*.md`.
No test opens a real window, runs a real session or a real `agc feature start`. The real `scripts/lane-launch.mjs` is
spawned only in the A2-11 / A2-12 refusal and usage-error subtests (they end before any host seam), with `HOME`
pointed at an empty temp dir so even a faulty build could only refuse on the trust check.

## Re-pins done (owned tests, spec Probe table)

| test | change | turns green with |
|---|---|---|
| `test/e115-join-precondition.test.mjs` AC5 | `.d.ts` regex now `checkLaneAncestry(branches: string[], repoRoot: string, ref: string)` | T-E443B-07 |
| `test/e349-integrator-repo-facts.test.mjs` AC-E349-2 | `TOOLS` literal = Copy `add.tools` | T-E443B-12 |
| `test/e425-stop-ticket-batch.test.mjs` AC1 | frozen C-LP2: first bullet ends with Copy `lp.s3-launcher` (appended, no space) | T-E443B-13 |

## Deferred to T-E443B-14

- `test/e428-tracker-mirror.test.mjs` AC6 / AC12 sha256 of `content/skill-integrator.md` (re-pin after the last text edit).
- `test/fixtures/compose-golden/skill-coordinator-monolith.txt` re-capture (turns `test/skill-manifest.test.mjs` t-golden-byte-identity green).
- `test/context-budget.test.mjs` teamwork coordinator bundle cap re-baseline (+~100 tok, with a history comment).
These are green today (no served text changed yet) and go red only when T-E443B-13 lands; not in the manifest now.

## Open Interface Details

- **Driver / clock stand-in protocol.** A poll is a `clock.sleep(15000)` call (Decision 12, `POLL_INTERVAL_MS`); the
  tests' hooks run inside it. Other sleeps (1 s ready polls, 6 s settle, 0.5 s send gap, 5 s / 10 s resend timing) are
  only timed, never hooked. A run whose lanes never end is stopped by the fake clock throwing after N polls; the tests
  require that error to propagate out of `runLaneLaunch` / `runLaneLaunchCli` (architecture: "does not swallow").
- **The empty `write text`** is `writeText(id, "", true)` (default newline); a send's text is `writeText(id, text, false)`.
- **Window ids** are whatever `driver.open` returns; tests read them back from the stand-in for `started` / `resumed` /
  `woken` lines.
- **`out.exit` wave number**: the current wave (the one whose lanes just stopped running), e.g. `wave 2` when wave 1 is
  finished and wave 2's only lane is waiting (A2-3); the last stdout line of a normal run (A2-1).
- **`featureStart` request**: `{ primary, slug, base, worktree }` with `slug` = branch without `feat/`, `base` = the
  start ref as such (`main` in a later wave, the manifest's `base:` sha in the first), `worktree` = the resolved
  absolute worktree (A2-14, A2-15).
- **Host refusal `<file>`**: the absolute path checked (`<primary>/.claude/settings.json`, the stand-in user settings
  path, a drop-in under the stand-in managed-settings dir, a lane worktree's `.claude/settings.local.json`).
- **Trust entry key**: `projects[<primary as git worktree list prints it>]` in the stand-in `~/.claude.json`; an entry
  only for a parent directory does not count.
- **A2-17 resend spacing**: asserted as at least 10 s of fake time between consecutive slash sends (Decision 10).
- **A2-24 doc section**: Copy `config.section` verbatim and contiguous; extra lines after it inside the same section
  (the T-E443B-13 known-limitation sentence) are allowed, no other heading, no bare ticket id.
- **Usage error spawn case** lives under A2-12 (exit 2: no argument, unreadable manifest path); the stderr must carry
  `usage: node scripts/lane-launch.mjs <manifest>` (architecture Open Question 3, closed as written).

## Red Reasons

All 27 scenario tests are red now; see `qa_reports/expected-red_e443b-lane-launcher.txt` for the list.

- A2-1..A2-18, A2-22, A2-26, A2-27: `Cannot find module …/dist/tools/lane-launch.js` (module not built). Green with:
  A2-22 T-E443B-07; A2-1..A2-4, A2-13, A2-14, A2-26, A2-27 T-E443B-08; A2-15..A2-17 T-E443B-09; A2-7..A2-10
  T-E443B-10; A2-18 T-E443B-11; A2-5, A2-6 T-E443B-12; A2-11, A2-12 core subtests T-E443B-07, CLI-level and
  real-script subtests T-E443B-12 (the test is green after T-E443B-12).
- A2-23: the emitted `.d.ts` still has the two-parameter `checkLaneAncestry` (T-E443B-07).
- A2-24: `loadConfig` drops `laneLaunchLimit` (`undefined !== 2`) (T-E443B-07); the docs part waits for T-E443B-13.
- A2-19, A2-20, A2-21: served text not edited yet (T-E443B-13).
- A2-25: `CLAUDE.md` row / prompts row (T-E443B-07) and the addendum tool line (T-E443B-12) not edited yet.
- e115 AC5, e349 AC-E349-2, e425 AC1: re-pinned to text the implementing tasks have not written yet (T-E443B-07,
  T-E443B-12, T-E443B-13 respectively).

## Oracle check (not committed)

To make sure the tests are satisfiable and discriminating, they were run once against a throwaway reference
implementation written to the architecture's contracts in a scratch directory (copied into `dist/` only for the run,
then removed; never committed): 57/57 tests and subtests green. Text tests were checked the same way with the cut's
Copy blocks applied to scratch edits (reverted): A2-19..A2-21, A2-25 and the three re-pins green, A2-23 / A2-24 green
with a patched `dist/` (reverted). Mutation runs against the reference (each a single seeded defect) turned the
expected tests red — see `## Mutation check`.

## Mutation check

| seeded defect in the reference | tests that went red |
|---|---|
| any `type: report` counts as a lane report | A2-26, A2-27 |
| parallel limit ignored | A2-1, A2-2, A2-26, A2-27 |
| default limit 5 instead of 3 | A2-2 |
| weekly line paused even with `Continuing automatically at` after it | A2-7 |
| `paused-weekly` woken like `paused-stopped` | A2-7 |
| signal baseline not reset after Enter | A2-9 |
| resume runs `agc feature start` | A2-10 |
| two resends instead of three | A2-17 |
| no same-wave refusal | A2-22 |
| ancestry compared with `HEAD` instead of the start ref | A2-3, A2-14 |
| `knowledge: local` ignored | A2-4 |
| `approval: human` lane started | A2-13 |
| no report floor (stateless finished check) | A2-26, A2-27 |
| window gone treated as finished | A2-10 |
| `autoContinueAtUsageLimit` also refused in user settings | A2-18 |
| later wave starts from `base:` instead of `main` | A2-3, A2-4, A2-14 |

## CI Runnability

Headless: no prompt, no network, no real terminal; temp dirs under `os.tmpdir()`, removed in `after`. Needs `git` on
PATH (as the existing e115 / e443a suites do).

## Full suite

`node scripts/test-lock.mjs -- npm test` on a clean tree at `b4f2885` (tests committed; Node 22):
4934 tests, **4902 pass, 30 fail**, 2 skipped, 0 cancelled (exit 1).

The 30 failures are exactly the 30 entries of `qa_reports/expected-red_e443b-lane-launcher.txt` and nothing else:
the 27 scenario tests (A2-1..A2-27) and the three re-pins (e115 AC5, e349 AC-E349-2, e425 AC1). Every other test
is as it was before this change; no forbidden-column test went red (`test/e408-*`, `e403`, `e443a-integrator-sop`,
`e433`, `e436`, `e395`, `e391`, `e432`, `config-cache`, `drift-baseline`, `config-versioning` are all green).

## Re-split re-entry (2026-11-27)

The PM re-split voided T-E443B-02..06 and cut T-E443B-07..14 (`.current/e443b/tasks.md`). Task-id attributions in
this report and in `qa_reports/expected-red_e443b-lane-launcher.txt` now name the new ids (the manifest is grouped
by the task that turns each test green); no test, test name or manifest entry changed. Red set re-checked by
running the four `test/e443b-*.test.mjs` files plus `test/e115-join-precondition.test.mjs`,
`test/e349-integrator-repo-facts.test.mjs` and `test/e425-stop-ticket-batch.test.mjs` (no full suite this pass;
T-E443B-14 runs it): `node --test` on Node 22 at `8f30894` (tests and dist unchanged since
`b4f2885`): 67 tests, 37 pass, **30 fail**, exit 1. The 30 failing top-level tests are exactly the 30 manifest entries
(name-for-name), and every other test in those seven files is green.

## T-E443B-14 qa close (2026-11-27)

The three re-pins deferred above, done after T-E443B-13 landed the served text (in-place edits only, no new test file):

| file | change | why |
|---|---|---|
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | re-captured with `npm run build && node scripts/capture-constitution-golden.mjs` | coord-03 gains the usage-limit paragraph under `## Crash-Resume Protocol`; the diff is that one paragraph (+2 lines) and nothing else; the other 11 goldens came out byte-identical |
| `test/context-budget.test.mjs` AC8/AC-P2-7 | teamwork bundle cap 19905 -> 20005 (title, assert, message), one E443b history comment | measured 20005 ~tok, +100 for the usage-limit sentence, within the human-approved re-baseline; no constitution change |
| `test/e428-tracker-mirror.test.mjs` `BASE[IN_FILE].sha` | `81ea9cf3...` -> `908fa6a0938ed5bb4eb38ea4b74285b1a5306a996f6d1e450be05f199a5d917f`, with a re-pin comment naming the previous value | the four edited lines of `content/skill-integrator.md` are now part of the base (AC6, AC12) |

`test/skill-manifest.test.mjs` is not edited: t-golden-byte-identity goes green from the re-capture alone.
Targeted check: `context-budget`, `e428-tracker-mirror`, `skill-manifest`, `e90-golden-capture-completeness`,
`compose-equivalence`: 113 tests, 113 pass. `qa_reports/expected-red_e443b-lane-launcher.txt` is marked fully resolved.

### T-E443B-14 full suite

`node scripts/test-lock.mjs -- npm test` on a clean tree at `e1e51d5` (Node 22): 4970 tests, **4967 pass, 1 fail**,
2 skipped, 0 cancelled (exit 1).

The one red is `test/lane-paths.test.mjs` "CALLERS2 (allow-list): …". Its `SANCTIONED_LANE_PATHS_IMPORTERS` list
does not name `tools/lane-launch.ts`, the new module that imports `./lane-paths.js`. Classification: **test defect**
(a stale allow-list pin), not an implementation defect. `specs/e443b-lane-launcher-architecture.md` says
`tools/lane-paths.ts` is "imported read-only, never edited", so the import is sanctioned. The PM probe table did not
list this test, and the earlier full suite ran before `tools/lane-launch.ts` existed, so nobody caught it until now.
The fix is one allow-list entry plus a group comment citing the e443b architecture spec. It is not applied here.
`test/lane-paths.test.mjs` is not in the lane's owned cell by name, and the manifest's catch-all ("other tests red
only because of this lane, listed by the PM probe, confirmed by the integrator") needs integrator confirmation
first. Every other test is green, including all forbidden-column invariants.
