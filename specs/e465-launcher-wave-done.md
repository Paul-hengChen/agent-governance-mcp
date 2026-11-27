# e465-launcher-wave-done

Ticket E465, lane e465, wave 1 of `specs/fanout-conductor.md`. Scope and acceptance: the ticket file below (S1–S7) and the manifest's e465 row (擁有 / 禁止 / 範圍切線) with its Probe table and "交給 lane 的 PM" section. The discussion record's rulings R5, R6, R11, R13 and the manifest's Decisions are not reopened here.

## Problem Statement

The lane launcher (`scripts/lane-launch.mjs`) starts the lanes of one wave and treats a depended-on lane whose branch is gone and that has a finish record as merged. That is right only when a wave counts as done after its pull request has merged. A repo whose pull requests wait for a human needs the next wave to start while the previous pull request is still open, and then a deleted branch plus a finish record no longer means the code is in the ref the next wave starts from. The planned conductor also needs the launcher to wake lanes paused on the weekly usage limit when a human asks, and to close the windows of lanes that have finished while keeping those stopped for a human.

## User Stories

- As a repo owner whose pull requests need a human review, I want to set `waveDoneAt` to `pr-open`, so that the next wave can start before the previous pull request merges.
- As an integrator in `pr-open` mode, I want a lane that depends on unmerged work listed as waiting with the reason, and started on a re-run after the merge, so that no lane starts from code that lacks what it depends on.
- As an integrator in the default mode, I want the dependency rule unchanged, so that existing manifests behave as before.
- As a conductor, I want to wake `paused-weekly` lanes only when asked, and to close the windows of finished lanes while keeping stopped ones, so that a reset weekly limit and a finished wave each need one launcher run.

## Acceptance Criteria

Ticket: docs/tickets/E465.md

Scenarios: S1, S2, S3, S4, S5, S6, S7 (no `## Added during build` scenario at cut time). Each scenario's own verification line applies (all seven: automated test). qa-engineer names the test files `test/e465-*.test.mjs`; every test title starts with its scenario id and a colon (for example `S2: …`), so each scenario is selected by `node --test --test-name-pattern "^S<n>:" test/e465-*.test.mjs`.

Build contract (the mechanism this cut fixes for the scenarios; names of functions, fields and flags beyond the Copy / Strings table are qa-engineer's interface choice):

- **S1** — `loadConfig` surfaces `WorkspaceConfig.waveDoneAt` only when the value is exactly `"merged"` or `"pr-open"` and fills no default (with no config file it still returns `{}`; `test/config-cache.test.mjs` stays green unedited). A separate exported resolver in `tools/config.ts` returns the effective value — `merged` when the key is absent or unusable — and, when the key is present but unusable, the rejected value, so the caller can name it. `getConfigError` stays `null` for an unusable value. No config `schema_version` change, no migration. The launcher prints the `wavedone.invalid` line (Copy / Strings) on standard error once per run when the resolver reports a rejected value; the run continues with `merged`, exit code unaffected.
- **S2, S3** — Under `pr-open`, a depended-on lane D is met only when D's work is an ancestor of the dependent lane's start ref (`startRefFor`, unchanged): D's branch exists and is an ancestor of the start ref; or D's branch is gone and the tip of D's branch that the launcher recorded in D's launch record while the branch existed is an ancestor of the start ref. The launcher records that tip (an optional field of the lane's launch record; launch state stays version 1, and a record without the field still parses) at least when it records the lane `finished` and whenever it checks D as a dependency while D's branch exists. A finish record alone never satisfies a dependency under `pr-open`. Under `"knowledge": "local"` with `pr-open`, the finish record is required as today (`agc feature finish --shipped has not run for <D>`) and the merged test above also applies. Unmet → `out.waiting` with the `dep.not-merged` or `dep.no-tip` reason. A lane already recorded is never started again (today's rule).
- **S4** — Under `merged` (absent, `"merged"`, or an unusable value), `dependencyMet` returns the same result as before this ticket for every case; every existing `test/e443b-*.test.mjs` test passes without edit (A2-3, A2-4, A2-14 in particular).
- **S5** — A new weekly-wake option. Without it, a `paused-weekly` lane is neither woken nor changed (A2-7 stays green unedited). With it, in the run's wake pass, each `paused-weekly` lane whose window `exists` gets `WAKE_LINE` through the launcher's existing send method into its recorded window, is recorded `running` (report floor reset as for a woken `paused-stopped` lane), and prints `out.woken`; no `driver.open`, no `featureStart`.
- **S6** — A new close-finished option. In the run's first pass, after observation, for each lane of the manifest whose launch record is `finished`, whose window is not already recorded closed, and none of whose tickets (read in the lane worktree as `ticketsSettled` does) has a `stopped — …` status: send `/exit` into the recorded `windowId` through the existing send method, record the window as closed in the lane's launch record, and print `close.done`. A lane with any `stopped — …` ticket keeps its window and gets no send. A window recorded closed is never sent `/exit` again. **Worktree gone:** by the time a close-finished run happens, `agc feature finish --shipped` has removed a finished lane's worktree, so there is no ticket to read; a lane whose launch record is `finished` and whose worktree no longer exists is treated as having no `stopped — …` ticket, so its window gets `/exit` (a batch-stopped lane is never finished and keeps its worktree). **Close-only run:** a run with the close-finished option runs only this close pass, prints its `close.done` lines and exits 0 — it starts no lane (even a startable lane of the next wave), wakes nothing, opens no window and does not poll. The weekly-wake option keeps its own semantics (wake pass, then a normal run); given together with close-finished, the close-only rule wins. qa-engineer adds two cases under S6: a finished lane with no worktree gets `/exit`; a close-finished run with a startable lane of the next wave starts nothing and exits 0.
- **S7** — `docs/config.md` carries the `config.wavedone` section (Copy / Strings) after the `---` that ends the `laneLaunchLimit` section, with its own closing `---`; `LANE_LAUNCH_USAGE` becomes `usage.line`, and the `scripts/lane-launch.mjs` header comment names both options. Unknown `-`-prefixed arguments, a missing manifest or two manifests still print the usage line and exit 2.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| wavedone.invalid | `lane-launch: waveDoneAt <value> is neither "merged" nor "pr-open"; using "merged"` (`<value>` = `JSON.stringify` of the configured value) | authored-here — S1 "reported by name"; names the key and the rejected value in the launcher's `lane-launch:` prefix |
| dep.not-merged | `<dep>'s work has not merged into <startRef>` (the `why` of `out.waiting`, so the full line is `waiting <lane> — depends on <dep>: <dep>'s work has not merged into <startRef>`) | authored-here — S2 "a reason naming A's work as not yet merged" |
| dep.no-tip | `branch <branch> is gone and the launcher recorded no tip for <dep>, so it cannot tell whether <dep>'s work has merged into <startRef>` (the `why` of `out.waiting`) | authored-here — a gone branch never seen by the launcher; tells the integrator why the lane waits |
| close.done | `closed <lane> — window <id>` | authored-here — mirrors `started` / `woken` line shape |
| usage.line | `usage: node scripts/lane-launch.mjs <manifest> [--wake-weekly] [--close-finished]` | authored-here — S7; keeps the existing prefix that `test/e443b-scheduling.test.mjs` A2-12 matches |
| script.header | `// Usage: node scripts/lane-launch.mjs <manifest> [--wake-weekly] [--close-finished]` and the added comment line `// --wake-weekly wakes paused-weekly lanes, then runs as usual; --close-finished only sends /exit to finished lanes' windows (stopped ones are kept) and starts nothing.` | authored-here — the wrapper's header comment names the options |
| config.wavedone | the block below, verbatim | authored-here — S7; follows the `laneLaunchLimit` section's shape |

`config.wavedone` (inserted after the `---` line that ends the `laneLaunchLimit` section, followed by a blank line and its own `---`):

````markdown
### `waveDoneAt` — when a wave counts as done (optional)

Says when a wave of a fan-out manifest counts as done: once its pull request has merged, or as soon as it is open. A repo whose pull requests wait for a human review or a manual merge sets `"pr-open"`, so the next wave does not wait for the merge.

```json
{
  "waveDoneAt": "pr-open"
}
```

| Value | A wave is done when |
|---|---|
| absent (or not usable) | its pull request has merged (the default, `"merged"`) |
| `"merged"` | its pull request has merged |
| `"pr-open"` | its pull request is open |

Semantics:

- **Optional.** `"merged"` or `"pr-open"`. The lane launcher names any other value in a line on its standard error and uses `"merged"`; it is never an error.
- **Dependencies under `"pr-open"`.** The next wave can start while the previous wave's pull request is still open, so the lane launcher starts a lane that depends on a lane of an earlier wave only once that lane's work has merged into the ref the dependent lane starts from (the manifest's `base:` for the first wave, `main` for a later one). Until then it lists the lane as waiting and names the work not yet merged; re-run it after the merge to start the lane. A lane that depends on nothing starts at once, and a lane already started is never started again.
- **A deleted branch under `"pr-open"`.** Once `agc feature finish --shipped` has deleted the depended-on lane's branch, the launcher checks the branch tip it recorded while the branch existed; a finish record alone does not count. A lane the launcher never saw (started by hand) has no recorded tip, so its dependents keep waiting: start them by hand once the work has merged.
- **Dependencies under `"merged"`.** Unchanged: the next wave starts only after the previous wave's pull request has merged, so a deleted branch with a finish record counts as merged.
- **Where the default is applied.** `loadConfig` surfaces the value verbatim as `WorkspaceConfig.waveDoneAt` only when it is `"merged"` or `"pr-open"`; a separate resolver applies the default.
- **Who reads it.** The lane launcher, from the primary checkout's `.current/.config.json`.
- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.
````

`docs/lane-protocol.md`: no new text in this cut (S7's Then names only `docs/config.md` and the usage text; leaving the file untouched keeps `### 批次 lane` and the `什麼是批次 lane` bullet byte-identical).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The conductor role, its prompt, SOP, state file and mailbox; any integrator SOP change (E466 in the manifest's wave 2).
- Any server, gate, `GATE_REGISTRY`, pipeline or error-code change; any config `schema_version` bump or migration.
- Closing or waking lanes during the poll loop (weekly wake acts in the run's first pass only; a close-finished run is the close pass alone and never polls); closing a window that the launcher did not open.
- Changing the current-wave rule (a wave is current while it holds a lane not finished) or `startRefFor`.
- A fallback that reads a depended-on lane's merge state from anything other than its branch or recorded tip (for example the start ref's `tasks.md` Closed Lanes pointer).
- Release bookkeeping (version, CHANGELOG, backlog done-mark): integrator / release-engineer after PASS.

## Dependencies / Prerequisites

- E443b (the launcher) is on `main` (PR #212); this lane starts from the manifest base.
- Writing constraints from the manifest's Probe table (decided, not reopened): `loadConfig` fills no default (forbidden `test/config-cache.test.mjs` pins `{}` with no file); no config schema bump (forbidden `test/config-versioning.test.mjs`); the `waveDoneAt` section goes after the `---` ending the `laneLaunchLimit` section with its own closing `---` (`test/e443b-config-ancestry.test.mjs` A2-24); no sentence inside `### 批次 lane` and no change to the end of the `什麼是批次 lane` bullet (forbidden `test/e425-stop-ticket-batch.test.mjs`, owned `test/e443b-served-text.test.mjs` A2-21); served text has no bare ticket id and no repo-only path.
- Chain: v5 — qa-engineer writes the scenario tests and `qa_reports/expected-red_e465-launcher-wave-done.txt` first; sr-engineer builds to them without editing them; code-reviewer judges and completes the tasks. No architect hop (two source files, no new data model beyond one optional launch-record field, no cross-cutting API).
- Probe (PM, 2026-11-28, `node scripts/test-lock.mjs -- npm test` on the lane base after `npm run build`): see `## Probe` below.
- Resource audit: the ticket and manifest reference only repo paths and the discussion record; no external URL, design file or tracker link. No `external_refs`.

## Probe

`npm run build` (exit 0, no `dist/` diff), then `node scripts/test-lock.mjs -- npm test` on the lane base `b90c7e9f`: exit 0 — 4993 tests, 4990 pass, 0 fail, 3 skipped (matches the manifest's base of about 4990 / 0 / 3).

Red test files: none. No Probe-table reader is red and there is no new finding. The Probe-table readers this lane's writing must keep green, each held by a Build-contract line above: `test/e443b-config-ancestry.test.mjs` (A2-24, owned), `test/e443b-served-text.test.mjs` (A2-21, owned), `test/e425-stop-ticket-batch.test.mjs` (AC1, forbidden), `test/config-cache.test.mjs` (forbidden). Also kept green unedited: `test/e443b-scheduling.test.mjs` (A2-3, A2-4, A2-12 usage prefix, A2-14) and `test/e443b-window.test.mjs` (A2-7).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E465 | Lane launcher: `waveDoneAt` (`merged` default / `pr-open`, unusable value named then `merged`); `pr-open` dependency waits for the depended-on lane's work to merge into the start ref (recorded branch tip once the branch is gone); `merged` rule unchanged; weekly-wake and close-finished options; `docs/config.md` section and usage text (S1–S7) | none | 16 | `tools/config.ts`, `dist/tools/config.js`, `dist/tools/config.js.map`, `dist/tools/config.d.ts`, `dist/tools/config.d.ts.map`, `tools/lane-launch.ts`, `dist/tools/lane-launch.js`, `dist/tools/lane-launch.js.map`, `dist/tools/lane-launch.d.ts`, `dist/tools/lane-launch.d.ts.map`, `scripts/lane-launch.mjs`, `docs/config.md`, `test/e465-*.test.mjs`, `test/fixtures/e465/**` | — |

## Tasks

| id | role | scenarios | files |
|---|---|---|---|
| T-E465-01 | qa-engineer | S1, S7 | `test/e465-*.test.mjs` (config + docs + usage), `qa_reports/expected-red_e465-launcher-wave-done.txt` |
| T-E465-02 | qa-engineer | S2, S3, S4 | `test/e465-*.test.mjs` (dependency), `test/fixtures/e465/**` |
| T-E465-03 | qa-engineer | S5, S6 (incl. worktree-gone and close-only cases) | `test/e465-*.test.mjs` (window options) |
| T-E465-04 | sr-engineer | S1 | `tools/config.ts` + `dist/tools/config.*` |
| T-E465-05 | sr-engineer | S1 (launcher line), S2, S3, S4 | `tools/lane-launch.ts` + `dist/tools/lane-launch.*` |
| T-E465-06 | sr-engineer | S5, S6, S7 (usage constant, argv parsing) | `tools/lane-launch.ts` + `dist/tools/lane-launch.*` |
| T-E465-07 | sr-engineer | S7 | `docs/config.md`, `scripts/lane-launch.mjs` |

## Gate Summary (this cut)

- Visual State-Count / Geometric-Density Split: not triggered (no design file, no visual surface).
- Parallel-Lane Cut: not triggered — the lane is one ticket in one worktree; T-E465-05 and T-E465-06 share `tools/lane-launch.ts`, so they run serially.
- Scope Decision: `single-feature` (one ticket, two source files and their outputs, one docs section).
- Resource Audit: zero external references.
- Question Batch / Ambiguity: none. The mechanism choices above (recorded branch tip for a gone branch, weekly wake in the first pass, the close-only close-finished run, a finished lane with no worktree treated as not stopped, the strings) are authored inside the ruled behaviour (R5, R6, R11, R13) and the manifest's scope cut; none is offered to the human as an option.
- Cut-Approval: batch lane, manifest tier — no option choice, no `needs human ruling` item. Not set by PM (Task-dispatched); the coordinator attests after the integrator's pre-review.
