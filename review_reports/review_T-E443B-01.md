# Review — T-E443B-01 (lane e443b, e443b-lane-launcher)

covers: T-E443B-01, T-E443B-07, T-E443B-08, T-E443B-09, T-E443B-10, T-E443B-11, T-E443B-12, T-E443B-13, T-E443B-14

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `git diff a06cc92...HEAD` at `308c071`. Contract: `specs/e443b-lane-launcher.md` (A2-1..A2-27, Decisions 1–15, Copy / Strings), `specs/e443b-lane-launcher-architecture.md` (Open Questions 1–6 closed as recommended), the manifest `specs/fanout-post-v5-w8.md` e443b row, integrator rulings to-lane#1..#5. T-E443B-02..06 are voided and not reviewed. Model note: sr and this review both ran on opus (pinned), so they may share blind spots; the mutation runs below are the independent check.

Independent verification (stand-ins only; scratch copy of the tree outside the worktree for the negative controls):
- `npm run build` exit 0, then `git status --porcelain` shows only this hop's `.current/e443b/` state writes: `dist/` matches a fresh build.
- `npm audit --audit-level=high` exit 0. `node bin/agc-init.mjs check` exit 0 (8 advisory comment warnings, dispositioned under Quality).
- `CLAUDE.md` is 250 lines.
- Full suite `node scripts/test-lock.mjs -- npm test` at `308c071` (working tree differs only by this hop's `.current/e443b/` state writes), Node 22: 4970 tests, 4968 pass, 0 fail, 2 skipped, exit 0.
- Each spec `proof:` command (`node --test --test-name-pattern "^A2-N:" test/e443b-*.test.mjs`, N = 1..27) exits 0 and selects exactly its own top-level test.
- `git diff --stat a06cc92...HEAD`: 48 files, every one in the e443b owned cell (`test/lane-paths.test.mjs` assigned by integrator ruling to-lane#5). No forbidden-column path, no other `dist/**`, no `tools/fanout-manifest.ts` / `tools/ticket-file.ts` / `tools/lane-paths.ts` / `tools/lane-status.ts` edit, no gate, error code, `GATE_REGISTRY` or pipeline change.
- Information hygiene: grep of every changed tracked file outside `dist/` (specs, qa reports, tests, fixtures, `.current/e443b/**`, docs, content, source) for absolute home and temp-directory prefixes (macOS and Linux), the local username and `http(s)://`: no hit except the six public settings/docs references in the spec and handoff `external_refs`.
- Mutation runs against the real `dist/` in a scratch copy, one seeded defect each, `node --test` over the e443b files: any `type: report` finishes → A2-26, A2-27 red; resend bound 2 → A2-17; weekly ignores `Continuing automatically at` → A2-7; default limit 5 → A2-2; later wave from `base:` → A2-3, A2-4, A2-14; report floor never raised → A2-26, A2-27; managed drop-ins ignored → A2-18; `feature start` for an existing worktree → A2-15; `paused-weekly` woken → A2-7; Enter baseline not reset → A2-9; `approval: human` lane started → A2-13; no same-wave refusal → A2-22; config accepts 0 → A2-24. Every seeded defect turned its scenario red.

## Summary
- Adds the lane launcher: `tools/lane-launch.ts` (§A–§L, ~800 lines: launch state + lock in the git common dir, manifest and host refusals, finished signals with the report floor, Q1 (b) dependency check, wave plan, parallel limit and queue, iTerm2 driver over osascript argv, ready wait, Unknown command retry, pause / Enter / wake / resume, CLI) and the thin `scripts/lane-launch.mjs`.
- `tools/config.ts` gains `laneLaunchLimit` (positive integer only, no default, no schema bump); `checkLaneAncestry` gains the required `ref` with the run-time `HEAD` fallback for two-argument JS callers (Decision 14, to-lane#1 point 3).
- Served / doc text: coord-03 usage-limit paragraph, four existing lines of `content/skill-integrator.md`, lane-protocol §1 step 1 in place and the §3 batch-lane bullet, addendum §5 tool line, `docs/config.md` section with the Open Question 6 limitation, `CLAUDE.md` Layout row (net 0 lines). All verbatim against Copy.
- Tests: 27 scenario tests in four `test/e443b-*.test.mjs` files over a hermetic harness; re-pins of e115, e349, e425, e428, the golden, the budget cap (19905 → 20005) and the lane-paths allow-list.
- Verdict: CHANGES_REQUESTED — one required finding: `scripts/lane-launch.mjs` prints an unlisted user-facing string and departs from the architecture's script without a recorded reason. Everything else is clean.

## AC Completeness
- A2-1 — implemented — `tools/lane-launch.ts:424` (`slotsOpen`), `:499` (`fill`), `:520-528` (queue + poll loop)
- A2-2 — implemented — `tools/lane-launch.ts:24` (`DEFAULT_LANE_LAUNCH_LIMIT = 3`), `:142` (`launchLimit`)
- A2-3 — implemented — `tools/lane-launch.ts:314-327` (`dependencyMet`), `:435-441` (`waiting` line)
- A2-4 — implemented — `tools/lane-launch.ts:319` (`knowledge: local` → finish record)
- A2-5 — implemented — `tools/lane-launch.ts:165` (state + lock in the git common dir), `:433` (a recorded lane is never planned again)
- A2-6 — implemented — the manifest is only read (`tools/lane-launch.ts:536`); no write path names it
- A2-7 — implemented — `tools/lane-launch.ts:589-598` (`newSignals` weekly rule), `:406-408`, `:418` (only `paused-stopped` is woken)
- A2-8 — implemented — `tools/lane-launch.ts:403-405`, `:416-422` (`wake`: same window, no open, no feature start)
- A2-9 — implemented — `tools/lane-launch.ts:409-411`, `:610-614` (`sendEnter`)
- A2-10 — implemented — `tools/lane-launch.ts:395-398` (window-gone, not finished), `:475-480` (`resume`: recorded `baseSha`, no feature start)
- A2-11 — implemented — `tools/lane-launch.ts:236-237`, `:547-550`
- A2-12 — implemented — `tools/lane-launch.ts:233`; CLI exit 2 at `:769-786`
- A2-13 — implemented — `tools/lane-launch.ts:442-447`
- A2-14 — implemented — `tools/lane-launch.ts:330-333` (`startRefFor`), `:512-518` (current wave)
- A2-15 — implemented — `tools/lane-launch.ts:467-470`, `:638-640` (`featureStartArgv`)
- A2-16 — implemented — `tools/lane-launch.ts:340-342` (`launchCommand`), `:601-607` (`sendText`), `:618-635` (`startSession`)
- A2-17 — implemented — `tools/lane-launch.ts:627-633`, `:490-493` (start-failed frees the slot)
- A2-18 — implemented — `tools/lane-launch.ts:672-687` (`hostRefusals`), run before the lock at `:540-546`
- A2-19 — implemented — `content/skill-integrator.md` Work overview row 3, Lifecycle row 4, Stage 3 Render line, Stage 6 step 7
- A2-20 — implemented — `content/coord-03-core-fallback.md:70`
- A2-21 — implemented — `docs/lane-protocol.md:13` (in place), §3 batch-lane bullet
- A2-22 — implemented — `tools/lane-launch.ts:223-228`, `:238`
- A2-23 — implemented — `tools/join-precondition.ts:33-34`; `dist/tools/join-precondition.d.ts` three-parameter line
- A2-24 — implemented — `tools/config.ts:104`, `:467-469`; `docs/config.md` `laneLaunchLimit` section
- A2-25 — implemented — `CLAUDE.md:77`, `CLAUDE.md:122`; `docs/lane-protocol-addendum.md:31`
- A2-26 — implemented — `tools/lane-launch.ts:262-265` (`isLaneReport`), `:392` (report floor raised while unsettled)
- A2-27 — implemented — `tools/lane-launch.ts:305-307`, `:280-284` (`ticketsSettled`)

## Correctness

Tests (T-E443B-01, T-E443B-14):
- Every A2 scenario has one top-level test whose title starts with its AC id, on the public interface (`runLaneLaunch`, `runLaneLaunchCli`, the spawned script, `loadConfig`, `checkLaneAncestry`, the composed SOP), with byte-exact Copy assertions. The mutation runs above show each assertion fails on a wrong result. No real iTerm2, session or `agc feature start`: the driver, clock, host paths and feature-start runner are stand-ins; the spawned script runs only refusal / usage paths with `HOME` pointed at an empty temp dir.
- The open interface details in `qa_reports/tests_e443b-lane-launcher.md` contradict no scenario or existing interface; accepted.
- Coverage: no line-coverage tooling runs in this suite; not measured. The mutation set above stands in for it.
- The re-pins (e115 AC5, e349 AC-E349-2, e425 AC1, e428 `BASE[IN_FILE].sha`, the golden, the 20005 cap with its history comment, the CALLERS2 allow-list entry) each change only the pinned value plus a one-line re-pin comment.

Implementation:
- No correctness finding blocks. The run order, the report-floor rule, signal baselines, the Unknown command bound (3 resends, 10 s apart) and the pre-check order match Decisions 4, 9–13 and the architecture.
- `recommended` — `tools/lane-launch.ts:498` the `fill` doc comment says "a lane finished while queued is dropped", but a queued lane with no record is started without a fresh `isFinished` check (`:503`). It only matters for a lane someone started by hand while it was queued; the comment overstates what the code does.
- `optional` — `tools/lane-launch.ts:486` and `:419`: a throw from `driver.open` or from `driver.contents` inside `wake` (window closed between `observe` and `wake`) ends the whole run; the lock is released in `finally` and the next run reconciles, so nothing is lost.
- `optional` — `tools/lane-launch.ts:209-215`: a run that reads the lock file between another run's `wx` create and its write sees empty content and treats the lock as stale. The window is microseconds and the architecture accepted pid-only staleness.

## Quality
- **required** — `scripts/lane-launch.mjs:6-7`, `:10-16`: the script wraps the call in `try/catch` and prints `lane-launch: error — <first line>` with exit 1 on any unexpected error, and its header says `1 = refused (stderr) or an unexpected error`. That line is a user-facing string that neither the cut's Copy / Strings nor the architecture's closed Open Question 3 lists. The architecture gives this script's body verbatim (`process.exitCode = await runLaneLaunchCli(...)`, header `1 = refused (stderr), 2 = usage`), and commit `c61ac9b` records no reason for the change. Fix within sr's remit: restore the architecture's script as written. If the catch-all line is wanted, it is a Copy addition for PM to source, not something to ratify after the fact.
- `agc check — comments` warnings touching the diff, all kept:
  - `test/e443b-*.test.mjs:1`, `test/fixtures/e443b/harness.mjs:1` (long-block, 8–13 lines): kept. Each is the file's header stating WHY the scenarios matter and which seams are stand-ins (the hermeticity contract), the same convention as the suite's other scenario files.
  - `tools/join-precondition.ts` high-ratio 32.3%: the file was already above 30% at base (74 comment lines); the diff adds 3 lines, which state the run-time `HEAD` fallback that Decision 14 requires in the doc comment. Kept.
  - `tools/config.ts` high-ratio 40.6%: already above the limit at base; the diff adds 5 comment lines, matching the neighbouring field comments. Kept.
  - `test/context-budget.test.mjs` high-ratio: one history comment line, in the file's re-baseline convention. Kept.
- `tools/lane-launch.ts`: 57 comment lines out of about 700 non-blank, each a WHAT/WHY line; no commented-out code, no ticket chatter. Names follow the architecture's interface contracts.

## Architecture
- Matches `specs/e443b-lane-launcher-architecture.md`: one module with the sections the per-task table names, `LaunchDeps` seams as specified, refusal order manifest → host → lock → state read, state written atomically (tmp + rename) only in the git common dir, pid-only lock staleness, `reportFloor`, history-record lookup under both names (Open Question 4), lowest `波次` as "wave 1" (Open Question 5), the Open Question 3 strings, and the Open Question 6 limitation in `docs/config.md` only.
- `tools/fanout-manifest.ts`, `tools/ticket-file.ts`, `tools/lane-paths.ts` are imported read-only.
- The one departure is `scripts/lane-launch.mjs` (see the required Quality finding).

## Security
- osascript: four fixed AppleScript programs (`tools/lane-launch.ts:695-706`); every untrusted value (launch command, prompt text, window id) goes in argv (`on run argv`), never into a script line. Window ids are checked against `^\d+$` before they reach osascript (`:709-712`). The window id is always the first argument, so a text starting with `-` is never parsed as an osascript option.
- The typed launch command single-quotes the worktree (`shellQuote`, `'` → `'\''`); the lane name is limited to `[A-Za-z0-9_.-]` by `LANE_ID_RE` in manifest validation, which runs before any start.
- `featureStart` and `git` use `spawnSync` with argument arrays, no shell. No secrets, no network. Host settings files are read-only; an unparseable one is "not set", as the architecture says.
- Strict TypeScript (`"strict": true`); no `any`, no `@ts-ignore`; JSON reads are `unknown` and narrowed (`isObj`, `isRecord`).

## Performance
- No regression vs base: the only changes to existing code are one config filter and one extra argument in `checkLaneAncestry`.
- The launcher polls every 15 s and per poll reads each current-wave lane's mailbox file and ticket directory once; lanes per wave are few, so this linear work is fine. `plan()` runs `lookupTicketFiles` once per ticket id per run. No listeners or caches are left behind: the SIGINT / SIGTERM handlers are removed in `finally` (`:798-801`).

## Verdict
CHANGES_REQUESTED — the implementation and tests meet A2-1..A2-27, but `scripts/lane-launch.mjs` adds an unlisted user-facing error line and departs from the architecture's verbatim script with no recorded reason. Route: sr-engineer (implementation only; the tests are sound).

### sr-engineer reply — Round 1

- required (`scripts/lane-launch.mjs`): restored to the architecture §L script as written: no `try/catch`, no `lane-launch: error` line, header `1 = refused (stderr), 2 = usage`. `cmp` against the §L code block: byte-identical. `npm run build` exit 0; `npm audit --audit-level=high` exit 0; `node --test test/e443b-*.test.mjs test/lane-paths.test.mjs`: 123/123 pass. The three non-blocking notes are left as they are.

## Round 2 — APPROVED — by code-reviewer

Diff since round 1: `git diff 308c071..HEAD` at `19611b7`, outside `.current/e443b/` and the round-1 report files, is `scripts/lane-launch.mjs` alone (`git diff 25ee478..HEAD --stat`: `scripts/lane-launch.mjs`, the sr reply in this file, `.current/e443b/` state). Every round-1 finding outside that file stands as written above.

Independent verification at `19611b7` (working tree differs only by this hop's `.current/e443b/` state writes), Node 22:
- `scripts/lane-launch.mjs` vs the `specs/e443b-lane-launcher-architecture.md` §L `js` block, extracted to a scratch file: `cmp` byte-identical (516 bytes). `lane-launch: error` appears nowhere in `tools/`, `dist/`, `scripts/`, `content/`, `docs/`, `test/` or `specs/`.
- Spawned script: no argument and `--help` print `LANE_LAUNCH_USAGE`, exit 2; a missing manifest prints `lane-launch: cannot read <manifest>: <first line>` then usage, exit 2 (the §L CLI contract rows).
- A2-11 / A2-12 (`--test-name-pattern "^A2-1[12]:"`): 10/10 pass, including "the real script: exit 1, refusal on stderr, nothing started", "the real script" and "the real script: a usage error (no manifest argument, unreadable manifest) exits 2".
- `node --test test/e443b-*.test.mjs test/lane-paths.test.mjs`: 123/123 pass.
- `npm run build` exit 0; `git status --porcelain` afterwards lists only `.current/e443b/` state: no `dist/` diff.
- `npm audit --audit-level=high` exit 0 (moderate advisories only, unchanged from base). `node bin/agc-init.mjs check` exit 0 with the same 8 comment warnings as round 1; none names `scripts/lane-launch.mjs`.
- Full suite `node scripts/test-lock.mjs -- npm test`: 4970 tests, 4968 pass, 0 fail, 2 skipped, exit 0.
- Information hygiene: the changed files (`scripts/lane-launch.mjs`, this report, `.current/e443b/handoff.md`, `.current/e443b/dispatch.jsonl`) hold no absolute home or temp-directory path and no local username.

## Summary
- The one change since round 1 restores `scripts/lane-launch.mjs` to the architecture §L script: no `try/catch`, no unlisted `lane-launch: error` line, header `1 = refused (stderr), 2 = usage`.
- Nothing else in source, tests, served text or `dist/` changed.
- The round-1 required finding is resolved; the round-1 non-blocking notes are unchanged and listed once below.
- Verdict: APPROVED.

## AC Completeness
A2-1..A2-27 — implemented — unchanged from Round 1 (the evidence lines above still hold at `19611b7`); A2-11 / A2-12 real-script paths re-run green against the restored script.

## Correctness
No new findings. The restored script awaits `runLaneLaunchCli` and sets `process.exitCode` from its return. An unexpected throw now surfaces as Node's default unhandled-rejection output with a non-zero exit, as the architecture intends. Tests (T-E443B-01, T-E443B-14) unchanged and sound.

## Quality
The round-1 required finding is resolved (byte-identical to §L). Comment warnings: the same 8 as round 1, all kept with the reasons given there.

## Architecture
`scripts/lane-launch.mjs` now matches §L exactly; the round-1 departure is gone. No other departure.

## Security
No change since round 1; the script adds no input handling.

## Performance
No change since round 1.

## Non-blocking notes (carried from Round 1, not required)
- `recommended` — `tools/lane-launch.ts:498`: the `fill` doc comment says a lane finished while queued is dropped, but a queued lane with no record starts without a fresh `isFinished` check (`:503`).
- `optional` — `tools/lane-launch.ts:486`, `:419`: a throw from `driver.open` or from `driver.contents` inside `wake` ends the whole run; the lock is released in `finally` and the next run reconciles.
- `optional` — `tools/lane-launch.ts:209-215`: a lock read between another run's `wx` create and its write sees empty content and is treated as stale (microsecond window; pid-only staleness accepted by the architecture).

## Verdict
APPROVED — the only change since round 1 restores `scripts/lane-launch.mjs` byte-for-byte to architecture §L; A2-1..A2-27 pass and the full suite is green with no off-manifest red.
