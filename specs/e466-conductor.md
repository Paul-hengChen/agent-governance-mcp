# e466-conductor

Ticket E466, lane e466, wave 2 of `specs/fanout-conductor.md`. Scope and acceptance: the ticket file below (S1–S9) and the manifest's e466 row (擁有 / 禁止 / 範圍切線) with its Probe table and "交給 lane 的 PM" section. The discussion record's rulings (R1, R2, R4, R7–R14, R16–R18) and the manifest's Decisions are not reopened here.

## Problem Statement

One integrator session has to stay open from the first wave of a fan-out manifest to the last, because only it starts the next wave; its context keeps growing across waves, against the operator's rule that each wave gets a fresh session. A long-lived, prompt-only conductor session takes that job: it opens an integrator for a wave, waits for that integrator's wave-done report, checks the facts the repo's `waveDoneAt` setting names, closes the integrator and the finished lane windows, and opens a fresh integrator for the next wave. Window actions are a script the conductor calls; judgment and notices to the human stay in the conductor session. The conductor never starts another manifest and writes no handoff state.

## User Stories

- As an operator, I want a fresh integrator session for every wave of an approved manifest, so that no integrator's context grows across waves.
- As an operator, I want the conductor to close an integrator only after the wave's pull request and handoff facts check out, so that a half-finished wave is never abandoned.
- As an operator, I want a vanished integrator reported to me, not silently reopened, so that I decide how to recover.
- As an operator, I want a lost conductor to be resumable from a state file, so that a new conductor session continues where the old one stopped.
- As an operator, I want the conductor to wake the paused integrator and lanes after a usage limit resets, so that one session handles every wake.

## Acceptance Criteria

Ticket: docs/tickets/E466.md

Scenarios: S1, S2, S3, S4, S5, S6, S7, S8, S9 (no `## Added during build` scenario at cut time). Each scenario's own verification line applies: S1–S8 automated test; S9 `device-or-person`. qa-engineer names the test files `test/e466-*.test.mjs` and puts fixtures under `test/fixtures/e466/**`; every test title starts with its scenario id and a colon (for example `S3: …`), so each scenario is selected by `node --test --test-name-pattern "^S<n>:" test/e466-*.test.mjs`. Per the manifest's Decisions row of 2026-11-28 (wave 2 applies), qa-engineer may replace the ticket's `Verification: automated test` lines with the named tests, in place, those lines only.

Build contract (the mechanism this cut fixes for the scenarios; names of functions, fields and flags beyond the Copy / Strings table are the architect's and qa-engineer's choice):

- **S1** — `PROMPT_REGISTRY` in `tools/registry.ts` gains one entry, appended last: `name: "conductor"`, `description` = `prompt.description`, `arguments: [PROMPT_WORKSPACE_ARG]`, `skillFile: "skill-conductor.md"`. The list then holds fourteen prompts. `prompts/conductor.ts` exports a builder shaped like `prompts/integrator.ts` (header comment `// MCP Prompt: conductor role. Prompt only — not a tw_switch_role /` + `// agent_id role.`). The `tw_switch_role` role enum is unchanged, so it already rejects `conductor` (no server change, no new error code).
- **S2, S7** — `content/skill-conductor.md` is `sop.conductor` verbatim (frontmatter `recommended_model: opus`). The composed `conductor` prompt (`buildPromptForRole("skill-conductor.md", …)`) carries the loop, the limits and the usage-limit wakes; the SOP contains no `tw_update_state` string at all.
- **S3** — `tools/conductor.ts` (logic) and `scripts/conductor.mjs` (thin CLI wrapper, shaped like `scripts/lane-launch.mjs`). It imports from `tools/lane-launch.ts` and does not modify it: the `WindowDriver` seam, `sendText` (the launcher's send method), `READY_MARKER` / ready-wait constants, `EXIT_LINE`, `WAKE_LINE`, `launchCommand`, `createItermDriver`. `open --manifest <m> --wave <n>` opens exactly one window (`driver.open(launchCommand(<primary>, "integrator"))`), waits for the ready marker as the launcher does, sends `integrator.slash` and then `takeover.line` each with `sendText`, and records the window id in the state file. `open --record <record>` does the same with `fanout.line` (first wave). `close` sends `EXIT_LINE` with `sendText` to the recorded window id only. `wake` sends `WAKE_LINE` with `sendText` to the recorded window id only.
- **S4** — The state file is `agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints (resolved from primary, as `resolveLaunchContext` does), so it is never in a working tree and never tracked. It records at least the discussion record (first wave), the manifest (once known), the current wave, the integrator's window id and the current step; a fresh process reading it reports the same values (`state` prints `state.line`). Its version field starts at 1; an unparseable file is refused with a message, never overwritten. The conductor mailbox is the folder `agc-conductor/` beside it: `to-lane.md` (only the integrator writes: the wave-done report) and `to-integrator.md` (only the conductor writes: replies) — this direction follows `scripts/mailbox-watch.mjs`'s writer rules (only `--from integrator` may write `to-lane.md`; any other sender, here `conductor`, writes `to-integrator.md`), so mailbox-watch sends and watches it unchanged. It is the reverse of `docs/lane-protocol.md` §5's session-outside-a-lane layout (where the session writes `to-integrator.md`); only the report's format comes from §5 (integrator pre-review, mailbox to-lane#1). `open` creates the folder and both files when absent.
- **S5** — `wave-done` reads the newest `type: report` in `agc-conductor/to-lane.md` whose `re:` starts `wave-done`, and parses `wave <n> of <manifest>, pull request #<number>` from it (`report.first-item`). It resolves `waveDoneAt` with the existing resolver in `tools/config.ts` (imported, not modified) against primary. Facts: (a) the pull request's state via a `gh pr view <number> --json state` runner seam — `MERGED` under `merged`; `OPEN` or `MERGED` under `pr-open`; (b) `node <agc install>/scripts/fanout.mjs handoff --check <manifest>` via a runner seam, exit 0. Any fact unmet → no `/exit`, no launcher call, no window opened; one reply appended to `agc-conductor/to-integrator.md` (`from: conductor`, `type: reply`, `hop: —`, body `reply.unmet` naming each unmet fact), output `out.unmet`, exit code 1. All met → in this order: `EXIT_LINE` to the integrator's window (`out.closed`); the launcher's close-finished run for the manifest (`runLaneLaunch(ctx, deps, { closeFinished: true })` through an injectable seam — finished lanes' windows get `/exit`, `stopped — …` lanes keep theirs); then, when the manifest (parsed with `parseManifest` from `tools/fanout-manifest.ts`, imported) has a later `波次`, `open --manifest <manifest> --wave <n+1>` (`out.opened`) and the state records wave `n+1`; when wave `n` is the manifest's last, no window opens, the state's step becomes `done` and the output is `out.all-done`. Exit 0.
- **S6** — `check`: when the state's step is the open-integrator step, the recorded window does not `exists`, and no wave-done report for the current wave is in the mailbox → output `out.gone` naming the wave and the manifest (or record), state step `integrator-gone`, exit 1, and `driver.open` is never called. A window that exists → `out.ok`, exit 0.
- **S8** — `content/skill-integrator.md`: inside the Stage 3 **Lane launcher** paragraph, the sentence `Re-run it at two moments: …` is replaced by `integrator.relaunch` (the launcher re-run after the merge, then the conductor rules: detection, opening line, wave-done report at the `waveDoneAt` moment, the reply watch, the `pr-open` watch and re-run). No line is added or removed — the file stays 269 lines and every other line is byte-identical (unowned `test/e410-task-alias-content-tail.test.mjs` pins rows 40/41/78/81/187/191/269 and unowned `test/e430-mailbox-outside-lane.test.mjs` AC8 pins the line count; a new `## Conductor` section reds both, probe round 2). The integrator SOP never writes `node <agc install>/scripts/conductor.mjs` (it reads the state file and writes the conductor mailbox with `mailbox-watch.mjs` only).
- **S9** — after code-reviewer PASS, the ticket's frontmatter `status:` line becomes `stopped — awaiting manual verification` per `docs/lane-protocol.md` §3 *批次 lane* (the lane-protocol stop procedure, done by the role holding the PASS context; committed); the lane is not merged until a person watches one real two-wave run (`qa_reports/manual-verification_e466-conductor.md` is the checklist). `docs/tickets/**` is in this lane's forbidden column: the integrator extends the mechanical out-of-bounds acceptance of the manifest's Decisions row of 2026-11-28 to exactly two changes in `docs/tickets/E466.md` — the in-place `Verification:` lines, and that frontmatter `status:` line set to `stopped — awaiting manual verification` — and nothing else in that file (integrator pre-review, mailbox to-lane#1).
- **Docs** — `CLAUDE.md` (net line count 0: `claude.lines`), `README.md` (`readme.*`), `docs/install.md` (`install.line`), `docs/config.md` (`config.conductor`). `docs/lane-protocol.md`: no new text — lanes never read or write the conductor mailbox, and `test/e430-mailbox-outside-lane.test.mjs` (no column, outside the allowed paths) pins §5's *非 lane 的 session* block through `## 6.` and the file's `##` list; the integrator SOP points at that §5 block for the report format, unchanged.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| prompt.description | `Conductor — open a fresh integrator session for each wave of an approved fan-out manifest, check its wave-done report, close it. Human-started; writes no handoff state.` | authored-here — mirrors the integrator / spec-workshop description shape (R1, R2) |
| integrator.slash | `/mcp__agent-governance-mcp__integrator` | authored-here — the integrator prompt's slash line, as `SLASH_LINE` is the teamwork one |
| fanout.line | `fan-out <record>` | ticket S2 / R8 |
| takeover.line | `接手 <manifest>，開始第 <n> 波次` | authored-here — S2/S3 "`接手 <manifest>` and the wave number" (R8); uses the manifest's `波次` word |
| state.line | `conductor: manifest <manifest or —> record <record or —> wave <n> window <id or —> step <step> mailbox <dir>` | authored-here — S4 "reports the same manifest, wave, window id and step" in one greppable line |
| out.opened | `opened integrator — wave <n>, window <id>` | authored-here — mirrors the launcher's `started <lane> — window <id>` |
| out.closed | `closed integrator — window <id>` | authored-here — mirrors the launcher's `closed <lane> — window <id>` |
| out.woken | `woken integrator — window <id>` | authored-here — mirrors the launcher's `woken <lane> — window <id>` |
| out.unmet | `wave <n> not done — <fact>; integrator kept open` (one line per unmet fact) | authored-here — S5 "names the unmet fact" |
| fact.pr | `pull request #<number> is <state>, waveDoneAt <value> needs <MERGED or OPEN/MERGED>` | authored-here — S5 pull-request fact |
| fact.handoff | `fanout.mjs handoff --check <manifest> exited <code>` | authored-here — S5 handoff fact |
| fact.report | `the wave-done report does not read "wave <n> of <manifest>, pull request #<number>"` | authored-here — an unparseable report is an unmet fact, never a guess |
| reply.unmet | `Wave <n> is not done yet: <fact>[; <fact>…]. Fix it and send the wave-done report again.` | authored-here — S5 "replies naming the unmet fact" |
| out.all-done | `all waves done — <manifest>` | authored-here — R8 "全部波次做完後通知人類" |
| out.gone | `integrator gone — wave <n> of <manifest or record>, window <id>; no new window opened` | authored-here — S6 / R4 |
| out.ok | `integrator alive — wave <n>, window <id>` | authored-here — S6 the window-exists case |
| usage.line | `usage: node scripts/conductor.mjs state \| open (--record <record> \| --manifest <manifest> --wave <n>) \| close \| wake \| wave-done \| check` | authored-here — mirrors `LANE_LAUNCH_USAGE`; exit 2 on bad argv |
| script.header | `// Usage: node scripts/conductor.mjs state \| open (--record <record> \| --manifest <manifest> --wave <n>) \| close \| wake \| wave-done \| check` and `// Exit: 0 = done, 1 = a fact unmet / integrator gone / refused (stderr), 2 = usage.` | authored-here — the wrapper's header comment, shaped like `scripts/lane-launch.mjs` |
| report.first-item | `- 做了什麼：wave <n> of <manifest>, pull request #<number>` | authored-here — the one machine-read line of the R9 session report |
| sop.conductor | the block `sop.conductor` below, verbatim | authored-here — S2, S7, R1, R2, R4, R7–R14 |
| integrator.relaunch | the block `integrator.relaunch` below, verbatim | authored-here — S8, R9, R10, R14 (drops the usage-limit moment; adds the conductor rules in place) |
| config.conductor | the block `config.conductor` below, verbatim | authored-here — who reads `waveDoneAt`, the state file and mailbox (no config key) |
| readme.count | `in \`content/skill-<role>.md\` for the fourteen single-file roles` (replaces `… for the thirteen single-file roles`) | authored-here — count follows S1 |
| readme.row | `\| conductor        \| high   \| \`opus\`            \| Opens a fresh integrator per wave; prompt-only.                      \|` (inserted after the `spec-workshop` row) | authored-here — frontmatter `recommended_model: opus` |
| install.line | ``- `/mcp__agent-governance-mcp__conductor` — opens a fresh integrator session for each wave of an approved manifest (prompt-only)`` (inserted after the `spec-workshop` line) | authored-here — mirrors the integrator / spec-workshop lines |
| claude.lines | the block `claude.lines` below | authored-here — S1 counts; R18 net line count 0 |

### `sop.conductor` (the whole of `content/skill-conductor.md`)

````markdown
---
recommended_model: opus
---
# Skill: conductor

## Purpose

The conductor is the only session that stays open across the waves of one approved fan-out manifest. For each wave it opens an integrator session, waits for that integrator's wave-done report, checks the facts, closes the session and opens a fresh integrator for the next wave, so no integrator's context grows across waves. Window actions are done by the conductor script; judgment and notices to the human stay in this session. The human starts it in the primary checkout and gives it the path of an approved discussion record (its wave table approved and committed).

**Tool calls**: `node <agc install>/scripts/conductor.mjs <command>`, where `<agc install>` is the directory agc is installed in; when `.current/.config.json` sets `laneProtocolAddendum`, the addendum may give the repo's own call form. The same holds for `mailbox-watch.mjs`, `lane-launch.mjs` and `fanout.mjs`.

## Loop

1. **Start**: `conductor.mjs state`. No run recorded → `conductor.mjs open --record <discussion record>`: it opens the first integrator window and sends the integrator prompt line followed by `fan-out <record>`. A run recorded → continue from its step (*Resume*).
2. **Watch** the conductor mailbox (`state` prints its folder): arm `node <agc install>/scripts/mailbox-watch.mjs <mailbox>/to-lane.md --baseline <n>` as the Monitor command, `<n>` = the messages already read. On `expiring — re-arm`, first run `conductor.mjs check` (*The integrator gone*), then re-arm from the printed baseline.
3. **Wave-done report** (a `type: report` whose `re:` starts `wave-done`): run `conductor.mjs wave-done`. It checks the facts `waveDoneAt` in `.current/.config.json` names — the wave's pull request has merged (`merged`, the default) or is open (`pr-open`) — and that `fanout.mjs handoff --check <manifest>` exits 0.
   - A fact unmet: the integrator stays open and the script replies to it naming the unmet fact; keep watching.
   - Every fact met: the script sends `/exit` to the integrator's window, closes the finished lane windows with the lane launcher's close-finished option (a lane with a `stopped — …` ticket keeps its window), and opens the next wave's integrator with the integrator prompt line followed by `接手 <manifest>，開始第 <n> 波次`.
   - Under `pr-open`, when the next integrator opens while the earlier wave's pull request has not merged, tell the human which pull request its waiting lanes wait on.
4. **Last wave**: when `wave-done` prints `all waves done`, notify the human that every wave of the manifest is done, and stop. Never start another manifest: a new manifest always needs the human.

## The integrator gone

`conductor.mjs check` prints `integrator gone` when the integrator's window no longer exists and no wave-done report has arrived. Notify the human that the integrator is gone and which wave it held, and open no new integrator window. Only a person closing the window, a crashed host or a restarted computer does this; lane recovery stays with the lane launcher. Continue only when the human says so.

## Usage limits

All sessions share one account. After the conductor's own automatic continue following a session-limit reset, wake the paused integrator (`conductor.mjs wake`) and re-run the launcher (`node <agc install>/scripts/lane-launch.mjs <manifest>`) to wake `paused-stopped` lanes. After the human says the weekly limit has reset, also wake `paused-weekly` lanes with the launcher's weekly-wake option (`lane-launch.mjs <manifest> --wake-weekly`). A launcher refused because another run is active is re-run at the next watch expiry.

## Resume

The state file, `agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints (never tracked), records the manifest, the current wave, the integrator's window id and the current step. A lost conductor is not restarted automatically: the human opens a new conductor session, which runs `conductor.mjs state` and continues from the recorded step.

## Limits

`conductor` is a prompt only — not a `tw_switch_role` or `agent_id` role. It writes no handoff state and no lane's `.current/<lane>/`; read-only `tw_get_state` / `tw_detect_drift` are allowed. It never merges, pushes, approves a cut or answers a lane: those stay with the integrator and the human. Its mailbox carries data, never approval.

## Output

Constitution §1 brevity. End every reply with the watermark `— @conductor` (no tier: an MCP-prompt invocation is not a subagent, Constitution §1).
````

### `integrator.relaunch` (replaces, inside the Stage 3 **Lane launcher** paragraph, the sentence starting `Re-run it at two moments:` through `to wake the paused lanes.`; the paragraph stays one line)

````markdown
Re-run it after each `波次`'s pull request has merged and local `main` is pulled (Stage 6 step 5), to start the next `波次`. **Under a conductor** — `agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints exists, its `step` is not `done`, and it names this manifest or, for the first wave, the discussion record of your `fan-out` line; its mailbox is the folder `agc-conductor/` beside that file — the conductor opens you with `fan-out <record>` (first wave) or `接手 <manifest>，開始第 <n> 波次` (after *Take-over* passes, run Stage 3 checks 1–3, then start wave `<n>` with the launcher), and you carry the wave through Stage 6 in this session (no `fan-in` line comes). At the moment `waveDoneAt` (`.current/.config.json`) names — the wave's pull request merged (`merged`, the default: after Stage 6 step 6) or opened (`pr-open`: after Stage 6 step 3) — report wave-done to the conductor's mailbox: one `type: report` sent with `node <agc install>/scripts/mailbox-watch.mjs <mailbox>/to-lane.md --send --from integrator --type report --re "wave-done <n>" --body …` in the session-report format of agc's generic `docs/lane-protocol.md` §5, its first item reading `- 做了什麼：wave <n> of <manifest>, pull request #<number>`; it replaces the re-run above and Stage 6 step 7's (the next integrator starts the next `波次`). Then watch `<mailbox>/to-integrator.md`: a reply names an unmet fact — fix it and report again; the conductor closes this session once every fact holds. Under `pr-open`, when your launcher run lists lanes waiting on the earlier wave's pull request, watch that pull request (`gh pr view <number> --json state`); when it merges, run Stage 6 steps 5–6 for it and re-run the launcher — your own wave is not done until those waiting lanes finish.
````

### `config.conductor` (in `docs/config.md`, inserted after the `---` that closes the `waveDoneAt` section, followed by one blank line and its own `---`; the `waveDoneAt` section itself is not changed)

````markdown
### Conductor — what it reads (no key of its own)

The conductor (the `conductor` MCP prompt and `scripts/conductor.mjs`) reads `waveDoneAt` from the primary checkout's `.current/.config.json` with the same resolver as the lane launcher: before it closes an integrator, the wave's pull request must have merged (`"merged"`, the default) or be open or merged (`"pr-open"`). It keeps its own state in `agc-conductor.json` and its mailbox in the folder `agc-conductor/`, both in the directory `git rev-parse --git-common-dir` prints, so neither is ever tracked. It adds no config key and no schema version change.
````

### `claude.lines` (`CLAUDE.md`; every edit keeps each line one line, net line count 0 — 250 lines before and after)

- line 7: `13 registered role prompts` → `14 registered role prompts`.
- line 10: ``(`release-engineer`, `integrator`, `spec-workshop`) or, …`` → ``(`release-engineer`, `integrator`, `spec-workshop`, `conductor`) or, …`` (rest of the line unchanged).
- line 33: `Thirteen prompts are registered.` → `Fourteen prompts are registered.`
- line 38: `the other eleven` → `the other twelve`.
- line 41: ``(`integrator`, `spec-workshop`) use matching`` → ``(`integrator`, `spec-workshop`, `conductor`) use matching``.
- line 42: ``(`integrator` and `spec-workshop` are prompt-only — …`` → ``(`integrator`, `spec-workshop` and `conductor` are prompt-only — …``.
- lines 105–108: the `gates/*.ts` row's three continuation lines joined onto line 105 with single spaces: `gates/*.ts                one module per gate predicate (cut-approval, scope-decision, feature-lease, external-refs, code-review, qa-review, evidence-schema, visual, expected-red, ac-execution, lease-override, open-tasks)`.
- new row directly after the `tools/lane-launch.ts` row (not inside the `tools/fanout-*.ts` … `gates/registry.ts` block that `test/e395-claude-md-tail.test.mjs` AC-E395-4 pins; the row also keeps AC-E395-5's every-`tools/*.ts`-covered check green): `tools/conductor.ts        conductor window script core (scripts/conductor.mjs): opens / closes integrator windows, state file and mailbox in the git common dir, wave-done check`.
- new row directly after the `prompts/{pm,…,spec-workshop}.ts` row (that row unchanged): `prompts/conductor.ts      conductor role (prompt id "conductor", prompt only — not a tw_switch_role / agent_id role)`.
- line `content/skill-*.md        the other 12 role SOPs, one file per role` → `content/skill-*.md        the other 13 role SOPs, one file per role`, and a new row directly before it: `content/skill-conductor.md  conductor SOP (prompt only; opens a fresh integrator per wave)`.

Net: −3 (joined continuation lines) +3 (three new rows) = 0; all edits fall between lines 64 and 195 or keep their line, so the line numbers `test/e436-stale-handoff-paths.test.mjs` pins (13, 44, 64, 195, 220/221) do not move.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The launcher's own features (`waveDoneAt`, the `pr-open` dependency rule, weekly wake, close-finished): shipped in wave 1, used here, `tools/lane-launch.ts` and `scripts/lane-launch.mjs` not modified.
- Moving across manifests; tmux or background sessions; automatic reopening of a vanished integrator or a lost conductor.
- Any server, gate, `GATE_REGISTRY`, pipeline, `tw_switch_role` enum or error-code change; any handoff / config schema change.
- `docs/lane-protocol-addendum.md` (forbidden): this repo's call form `node scripts/conductor.mjs` is not added there; the conductor SOP's generic `<agc install>` form plus the addendum's existing rule cover it.
- Integrator SOP text beyond `integrator.relaunch` (no new section or line; Stage 1 step 6, Stage 2, Stage 6 step 7 unchanged — `integrator.relaunch` states that the wave-done report replaces step 7's re-run).
- A scenario for R10's "tell the human which pull request blocks" notice: it is in `sop.conductor` step 3, but `docs/tickets/**` is in this lane's forbidden column, so no scenario is appended; code-reviewer reads it as SOP text.
- Release bookkeeping (version, CHANGELOG, backlog done-mark): integrator / release-engineer after PASS.

## Dependencies / Prerequisites

- Wave 1 (launcher setting, dependency rule, weekly wake, close-finished) is on `main` (merge `9d2e940`, PR #217); this lane starts from base `e3a5f63b`.
- Writing constraints from the manifest's Probe table and this cut's probe (decided, not reopened): `CLAUDE.md` 250 lines, only the `gates/*.ts` continuation lines joined, `conductor` rows of its own, the `prompts/{pm,…}.ts` row unchanged (forbidden `test/e436-*`, `test/e432-*`, `test/e395-*`, `test/e391-*`; owned `test/e443b-served-text.test.mjs` A2-25); the integrator SOP never writes `node <agc install>/scripts/conductor.mjs` (forbidden `test/e349-*`) and keeps 269 lines with no row moving (unowned `test/e410-*`, `test/e430-*`); Stage 1 step 6 and Stage 2 untouched (forbidden `test/e443a-integrator-sop.test.mjs`); `docs/lane-protocol.md` unchanged (forbidden `test/e425-*`, owned `test/e443b-*` A2-21, unowned `test/e430-mailbox-outside-lane.test.mjs`); the `waveDoneAt` section of `docs/config.md` byte-identical (unowned `test/e465-config.test.mjs` S7 pins it and the `---` after it — see Probe); served text has no bare ticket id and no repo-only path.
- Chain: v5 with an architect hop (manifest) — architect writes `specs/e466-conductor-architecture.md` (seams, state-file shape and steps, report parser, runner seams for `gh` / `fanout.mjs` / launcher), its Open Questions go to the integrator's second pre-review; qa-engineer then writes the scenario tests and `qa_reports/expected-red_e466-conductor.txt` first and re-pins the owned tests listed under Probe; sr-engineer builds to them without editing them; code-reviewer judges and completes the tasks.
- Resource audit: the ticket and manifest reference only repo paths and the discussion record; no external URL, design file or tracker link. No `external_refs`.

## Probe

Base: `e3a5f63b` (lane base); the manifest's base run is about 4990 pass / 0 fail / 3 skipped. Method: a scratch clone of the lane branch with representative E466 edits applied and committed (registry entry, `prompts/conductor.ts`, stub `tools/conductor.ts` importing `tools/lane-launch.ts`, stub `scripts/conductor.mjs`, `sop.conductor` verbatim, the integrator edit, `claude.lines`, `readme.*`, `install.line`, `config.conductor`), `npm run build`, then `node scripts/test-lock.mjs -- npm test`, three rounds.

Round 3 (this cut's writing method): 5011 tests, 5001 pass, 7 fail, 3 skipped. Red files, all owned, all Probe-table known:

| test file | red tests | column | Probe table | who fixes |
|---|---|---|---|---|
| `test/e178a-integrator-role.test.mjs` | AC3 (registry 13), AC5 (CLAUDE.md "13 registered", "Thirteen", "the other eleven", "the other 12") | owned | known | qa re-pin (T-E466-02) |
| `test/e423-spec-workshop.test.mjs` | AC1 (registry length 13, spec-workshop last) | owned | known (R17) | qa re-pin |
| `test/e428-tracker-mirror.test.mjs` | AC6, AC12 (integrator SOP base sha256) | owned | known (R17) | qa re-pin |
| `test/e443b-served-text.test.mjs` | A2-19 (the launcher's two re-run moments) | owned | known | qa re-pin |
| `test/skill-frontmatter.test.mjs` | 13 `content/skill-*.md` files | owned | known | qa re-pin |

Newly found in rounds 1–2, each avoided by the writing method above (round 3 green):

| test file | red when | column | avoided by |
|---|---|---|---|
| `test/e395-claude-md-tail.test.mjs` AC-E395-4 | the `tools/conductor.ts` row sits inside the `tools/fanout-*.ts` … `gates/registry.ts` block | forbidden | the row goes after `tools/lane-launch.ts` |
| `test/e430-mailbox-outside-lane.test.mjs` AC2 | any text added between §5's *非 lane 的 session* block and `## 6.` of `docs/lane-protocol.md` | none (not in the allowed paths) | `docs/lane-protocol.md` unchanged |
| `test/e430-mailbox-outside-lane.test.mjs` AC8, `test/e410-task-alias-content-tail.test.mjs` AC2 (two tests) | a new `## Conductor` section grows the integrator SOP past 269 lines and moves pinned rows | none (not in the allowed paths) | the conductor rules replace one sentence in place (`integrator.relaunch`) |
| `test/e465-config.test.mjs` S7 | any edit inside the `waveDoneAt` section of `docs/config.md` | none (not in the allowed paths) | `config.conductor` is a separate section after that section's closing `---` |

Kept green and to stay green: `test/e436-stale-handoff-paths.test.mjs`, `test/e432-judge-report-checks.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e349-integrator-repo-facts.test.mjs`, `test/e443a-integrator-sop.test.mjs`, `test/e425-stop-ticket-batch.test.mjs`, `test/config-cache.test.mjs` (forbidden); compose goldens and `test/context-budget.test.mjs` (owned, untouched — no conductor cap is added); `CLAUDE.md` 250 lines; integrator SOP 269 lines.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E466 | Conductor: 14th prompt `conductor` (prompt-only; `tw_switch_role` still rejects it) and its SOP (loop from an approved discussion record, `接手 <manifest>` + wave per later integrator, stop after the last wave, never another manifest, usage-limit wakes, no handoff writes); conductor script (opens / closes / wakes integrator windows with the launcher's send method, state file and mailbox in the git common dir, wave-done fact check per `waveDoneAt` + `handoff --check`, close-finished, vanished-integrator notice); integrator SOP conductor section; docs (S1–S9) | E465 | 29 | `content/skill-conductor.md`, `prompts/conductor.ts`, `tools/conductor.ts`, `scripts/conductor.mjs`, `tools/registry.ts`, `dist/prompts/conductor.js`, `dist/prompts/conductor.js.map`, `dist/prompts/conductor.d.ts`, `dist/prompts/conductor.d.ts.map`, `dist/tools/conductor.js`, `dist/tools/conductor.js.map`, `dist/tools/conductor.d.ts`, `dist/tools/conductor.d.ts.map`, `dist/tools/registry.js`, `dist/tools/registry.js.map`, `dist/tools/registry.d.ts`, `dist/tools/registry.d.ts.map`, `content/skill-integrator.md`, `docs/config.md`, `CLAUDE.md`, `README.md`, `docs/install.md`, `test/e178a-integrator-role.test.mjs`, `test/e423-spec-workshop.test.mjs`, `test/e428-tracker-mirror.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/e443b-*.test.mjs`, `test/e466-*.test.mjs`, `test/fixtures/e466/**` | — |

## Tasks

| id | role | scenarios | files |
|---|---|---|---|
| T-E466-01 | qa-engineer | S1, S2, S7 | `test/e466-*.test.mjs` (registry, `tw_switch_role`, composed SOP text), `qa_reports/expected-red_e466-conductor.txt` |
| T-E466-02 | qa-engineer | S8 + re-pins | `test/e466-*.test.mjs` (integrator SOP); re-pin owned tests the Probe lists red |
| T-E466-03 | qa-engineer | S3, S4 | `test/e466-*.test.mjs` (window open / close / wake, state file), `test/fixtures/e466/**` |
| T-E466-04 | qa-engineer | S5, S6 | `test/e466-*.test.mjs` (wave-done check, vanished integrator), `test/fixtures/e466/**` |
| T-E466-05 | qa-engineer | S9 | `qa_reports/manual-verification_e466-conductor.md` (person's checklist) |
| T-E466-06 | sr-engineer | S1, S2, S7 | `content/skill-conductor.md`, `prompts/conductor.ts`, `tools/registry.ts` + `dist/` |
| T-E466-07 | sr-engineer | S3, S4 | `tools/conductor.ts` + `dist/tools/conductor.*` |
| T-E466-08 | sr-engineer | S5, S6 | `tools/conductor.ts` + `dist/tools/conductor.*` |
| T-E466-09 | sr-engineer | S3–S6 CLI, S9 | `scripts/conductor.mjs`, host deps in `tools/conductor.ts` + `dist/` |
| T-E466-10 | sr-engineer | S8 | `content/skill-integrator.md` (one sentence replaced in place) |
| T-E466-11 | sr-engineer | S1 (docs counts), S5 (config.md reader) | `CLAUDE.md`, `README.md`, `docs/install.md`, `docs/config.md` |

## Gate Summary (this cut)

- Visual State-Count / Geometric-Density Split: not triggered (no design file, no visual surface).
- Parallel-Lane Cut: not triggered — one ticket in one worktree; T-E466-07..09 share `tools/conductor.ts` and run serially.
- Scope Decision: `single-feature` (one ticket; one new module + script, one prompt, two SOPs, docs).
- Resource Audit: zero external references.
- Question Batch / Ambiguity: none. The mechanism choices above (mailbox folder `agc-conductor/` beside the state file in the git common dir, file writers per `scripts/mailbox-watch.mjs`'s rules, the report's first item as the machine-read line, script commands and output lines, the integrator's conductor-detection rule and its in-place placement, the wave-done moments (after Stage 6 step 6 under `merged`; Stage 3 checks 1–3 before the launcher after a take-over), the docs/config.md section outside the `waveDoneAt` section) are authored inside the ruled behaviour (R1, R2, R4, R7–R14, R16–R18) and the manifest's scope cut; none is offered to the human as an option.
- Cut-Approval: batch lane, manifest tier — no option choice, no `needs human ruling` item. Not set by PM (Task-dispatched); the coordinator attests after the integrator's pre-review.

manifest-tier: no option choice, no needs-human-ruling item
