# Tests — e465-launcher-wave-done (T-E465-01..03)

Ticket `docs/tickets/E465.md` S1–S7; spec `specs/e465-launcher-wave-done.md` (Build contract, Copy / Strings). No architecture doc (no architect hop).

Placement branch acted on: dispatch brief `Test-file placement` — new files pre-authorized (`test/e465-*.test.mjs`, `test/fixtures/e465/**`). No existing `test/e443b-*.test.mjs` edited; `test/fixtures/e443b/harness.mjs` is imported read-only.

Seams: all runs use the E443b stand-ins (`test/fixtures/e443b/harness.mjs`: scripted `WindowDriver`, fake clock, temp git primary, feature-start runner that only runs `git worktree add`). No iTerm2, no real window. S5/S6 go through `runLaneLaunchCli(argv, deps)` (the argv the real script passes); S7 also spawns the real `node scripts/lane-launch.mjs` once (HOME = temp dir). Headless; CI-runnable.

Select a scenario: `node --test --test-name-pattern "^S<n>:" test/e465-*.test.mjs`.

## Scenario → Test Map

| scenario | file | test |
|---|---|---|
| S1 | test/e465-config.test.mjs | S1: loadConfig surfaces waveDoneAt only as merged or pr-open and fills no default; the resolver defaults to merged |
| S1 | test/e465-config.test.mjs | S1: any other waveDoneAt value is reported by name and resolves to merged, never a config error (ticket Verification line) |
| S1 | test/e465-config.test.mjs | S1: the launcher names an unusable waveDoneAt once on standard error and runs on with merged, exit code unaffected |
| S2 | test/e465-dependency.test.mjs | S2: pr-open, A shipped but its pull request not merged — D starts, C waits naming A's work as not merged into main (ticket Verification line) |
| S2 | test/e465-dependency.test.mjs | S2: pr-open, A's branch still exists but is not merged — C waits with the not-merged reason |
| S2 | test/e465-dependency.test.mjs | S2: pr-open, A's branch is gone and the launcher never recorded a tip — a finish record alone does not meet the dependency |
| S2 | test/e465-dependency.test.mjs | S2: pr-open with knowledge local — the finish record is still required, and the merged check applies too |
| S3 | test/e465-dependency.test.mjs | S3: after the pull request carrying A merges into main, a re-run starts C from main and does not start D again |
| S4 | test/e465-dependency.test.mjs | S4: merged mode — a shipped lane with a finish record meets the dependency even though its recorded tip is not in main |
| S4 | test/e465-dependency.test.mjs | S4: merged mode — the E443b dependency reasons are unchanged (not an ancestor; gone without finish record; knowledge local) (ticket Verification line) |
| S5 | test/e465-window.test.mjs | S5: without --wake-weekly a paused-weekly lane is not woken; with it the wake line goes into the same window and the lane is running |
| S6 | test/e465-window.test.mjs | S6: --close-finished sends /exit to the finished lane's window only, keeps stopped lanes' windows, records it closed (ticket Verification line) |
| S6 (amendment: worktree gone) | test/e465-window.test.mjs | S6: a finished lane whose worktree is gone (agc feature finish --shipped ran) gets /exit; a stopped lane keeps its window |
| S6 (amendment: close-only run) | test/e465-window.test.mjs | S6: a --close-finished run starts nothing even when a lane of the next wave is startable, and exits 0 |
| S6 (contract: both options) | test/e465-window.test.mjs | S6: given --wake-weekly and --close-finished together, the close-only rule wins — nothing is woken or started |
| S7 | test/e465-config.test.mjs | S7: docs/config.md documents waveDoneAt with both values and the default, right after the laneLaunchLimit section (ticket Verification line) |
| S7 | test/e465-config.test.mjs | S7: the launcher's usage line and script header name --wake-weekly and --close-finished |
| S7 | test/e465-config.test.mjs | S7: an unknown option, a missing manifest or two manifests still print the usage line and exit 2 |

S4 is also held by the unedited E443b suite (A2-3, A2-4, A2-14; A2-7 for S5's no-option half; A2-12 for the usage prefix).

## Open Interface Details

- **Resolver**: `resolveWaveDoneAt(workspacePath: string)` exported from `tools/config.ts` (mirrors `resolveTicketDir(workspacePath)`). Returns `{ waveDoneAt: "merged" | "pr-open" }`, plus an own property `rejected` (the configured value verbatim, any JSON type incl. `null`) only when the key is present and unusable. Absent key / no config file → exactly `{ waveDoneAt: "merged" }` (deepEqual, no `rejected` key).
- **Usable values**: exactly `"merged"` / `"pr-open"`; `" merged"`, `"PR-OPEN"`, `""`, `null`, numbers, booleans, arrays, objects, oversized strings are unusable.
- **wavedone.invalid**: emitted through `deps.err` (standard error) exactly once per `runLaneLaunch`, `<value>` = `JSON.stringify(value)`; also emitted when nothing is left to start.
- **Option argv**: `--wake-weekly` and `--close-finished` are accepted after the manifest, in either order, each at most as given; exactly one non-`-` argument (the manifest). Any other `-` argument, no manifest, or two manifests → usage line on stderr, exit 2.
- **Closed-window record**: the lane's launch record gets `windowClosed: true` (an optional field; launch state stays version 1). The lane's `status` stays `finished`.
- **`/exit` send**: through the existing send method (`sendText`): `writeText(id, "/exit", false)`, then `writeText(id, "", true)`.
- **Recorded tip**: field name left to sr-engineer (not asserted). Tested behaviourally: wave 1 runs through the launcher, the lane commits and posts its lane report (launcher records it `finished` while the branch exists), then worktree + branch are removed and a finish record is written.
- **Close-only run**: no poll sleep (`POLL_INTERVAL_MS`) at all, no `driver.open`, no `featureStart`, no `started`/`queued`/`woken` line, exit 0.
- **S5 `running`**: asserted via the launch state read at the first poll of the `--wake-weekly` run (the run then polls as usual).

## Red Reasons

- S1 resolver tests (2): `resolveWaveDoneAt` not exported from `dist/tools/config.js` yet.
- S1 launcher line: no `wavedone.invalid` line on stderr yet.
- S7 docs: no `waveDoneAt` section in `docs/config.md` yet.
- S7 usage/header: `LANE_LAUNCH_USAGE` and the script header carry the old usage text.
- S7 argv: exit 2 already holds; red because the printed usage line is the old one.
- S2 (4): `waveDoneAt` not read; a branch gone + finish record meets the dependency, and an existing unmerged branch gets the old `is not an ancestor` reason.
- S3: red at its S2 precondition (C starts on the first run).
- S5, S6 (4): `runLaneLaunchCli` treats `--wake-weekly` / `--close-finished` as usage errors (exit 2).
- **Green now**: both S4 tests (today's merged rule exists) — kept as regression guards, not in the manifest.
