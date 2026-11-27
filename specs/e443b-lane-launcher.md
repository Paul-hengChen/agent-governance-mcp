# e443b-lane-launcher

Ticket E443b, lane e443b, wave `post-v5-w8` (`specs/fanout-post-v5-w8.md`). Scope and acceptance: `specs/ticket-cut-e443.md` section `## NEW-2` (scope 1–14, A2-1..A2-21) as ruled in `docs/backlog.md` row E443b (R1–R5; cut questions Q1 (b), Q2 (a), Q3 (b)), plus the manifest's scope cut and its Decisions (G1 (b); `checkLaneAncestry` ref parameter required; `docs/lane-protocol-addendum.md` added to the allowed paths; teamwork budget cap re-baseline). None of those rulings is reopened here.

## Problem Statement

Today the integrator prints one dispatch prompt per lane with `fanout.mjs render`, and the human opens one interactive session per lane, in its worktree, and pastes the prompt, once per lane per wave. E443a gave the manifest a `波次` column, checked `相依` cells and a batch `render`; Phase 0 (`specs/e443-phase0-host-check.md`) showed that a script can open a visible iTerm2 window per lane, start an interactive session in it with no person at the keyboard, send it the prompt, and read the usage-limit signals from the window. Nothing yet does that, so batch lanes still need a person to open every session, a lane cut off by a usage limit needs a person to notice it, and the coordinator SOP has no rule for a usage-limit error from a subagent dispatch (it could take the `tw_switch_role` fallback and run the role in-context on another model).

## User Stories

- As an integrator, I want one command that starts the batch lanes of the current wave of an approved manifest, each in its own visible window, under a parallel limit, so that no person has to open sessions and paste prompts.
- As an integrator, I want the launcher to wait for dependencies, skip lanes that need a typed approval, and refuse a manifest it cannot run safely, naming the reason, so that it never starts a lane the rules do not allow.
- As an integrator, I want lanes stopped by a usage limit marked paused and woken on a later run, and a lane whose window was closed resumed in its worktree, so that a limit or a stray click does not lose a lane.
- As a coordinator in a lane, I want a written rule for a usage-limit or rate-limit error from a subagent dispatch, so that I neither switch the role's model nor run the role in-context.

## Acceptance Criteria

No ticket file: this repo's tickets are `docs/backlog.md` rows. Every automated AC runs the launcher with a stand-in session opener and stand-in window contents (and stand-ins for the host config, the iTerm2 probe, `agc feature start` and the clock where the AC needs one), never a real session. Every qa test name starts with its AC id and a colon (for example `A2-1: …`), so each `proof:` below selects it by name.

- **A2-1** — Given a wave of four lanes and a limit of two, when the launcher runs, then at most two run at once and all four are started.
  proof: `node --test --test-name-pattern "^A2-1:" test/e443b-*.test.mjs`
- **A2-2** — Given no `laneLaunchLimit` key and a wave of five lanes, when the launcher runs, then at most three run at once.
  proof: `node --test --test-name-pattern "^A2-2:" test/e443b-*.test.mjs`
- **A2-3** — Given a lane that depends on an unmerged lane, when the launcher runs, then it is not started and is listed as `waiting` with the lane it waits on.
  proof: `node --test --test-name-pattern "^A2-3:" test/e443b-*.test.mjs`
- **A2-4** — Given `"knowledge": "local"` and a depended-on lane that is merged but has no finish record (`agc feature finish --shipped` has not run for it), when the launcher runs, then the dependent lane is listed as `waiting` and the reason names the missing finish.
  proof: `node --test --test-name-pattern "^A2-4:" test/e443b-*.test.mjs`
- **A2-5** — Given lanes running or finished, when the launcher runs again, then none is started twice, and the launch-state file is untracked (`git status --porcelain` shows no new path).
  proof: `node --test --test-name-pattern "^A2-5:" test/e443b-*.test.mjs`
- **A2-6** — Given any launcher run (a refusal included), when it ends, then the manifest's bytes are unchanged.
  proof: `node --test --test-name-pattern "^A2-6:" test/e443b-*.test.mjs`
- **A2-7** — Given a lane whose window shows `You've hit your weekly limit` with no `Continuing automatically at` line after it, when the launcher polls, then that lane is marked `paused-weekly`, no wake is sent on this or a later run, and the other lanes continue.
  proof: `node --test --test-name-pattern "^A2-7:" test/e443b-*.test.mjs`
- **A2-8** — Given a lane whose window shows `Automatic continue stopped after repeated usage-limit hits`, when the launcher polls, then it is marked `paused-stopped`. When the launcher runs again, it sends the wake line into the same window: no new window, no `agc feature start`, and nothing is written under the lane worktree's `.current/` (its `dispatch_pins` are unchanged).
  proof: `node --test --test-name-pattern "^A2-8:" test/e443b-*.test.mjs`
- **A2-9** — Given a lane whose window shows `Press enter to continue`, when the launcher polls, then it sends Enter itself (one empty `write text`) and the lane stays `running`.
  proof: `node --test --test-name-pattern "^A2-9:" test/e443b-*.test.mjs`
- **A2-10** — Given a lane whose window was closed before it finished, when the launcher runs again, then that lane is resumed in the same worktree (no `agc feature start`, a new window, the same slash-command line and the same `render --batch` output, nothing written under its `.current/`) and is not reported as finished.
  proof: `node --test --test-name-pattern "^A2-10:" test/e443b-*.test.mjs`
- **A2-11** — Given a manifest with no `人類` Decisions row, or `cutApprovalAutoTier.manifest` not `true`, when the launcher runs, then it refuses, names the reason, exits non-zero and starts nothing.
  proof: `node --test --test-name-pattern "^A2-11:" test/e443b-*.test.mjs`
- **A2-12** — Given a manifest with no `波次` column, when the launcher runs, then it refuses, says why and exits non-zero.
  proof: `node --test --test-name-pattern "^A2-12:" test/e443b-*.test.mjs`
- **A2-13** — Given a lane whose `approval` is `human`, or one of whose tickets has no ticket file, when the launcher runs, then it is not started and is listed with the reason; the other lanes of the wave are started.
  proof: `node --test --test-name-pattern "^A2-13:" test/e443b-*.test.mjs`
- **A2-14** — Given a plan whose first wave is finished and merged, when the launcher runs again, then the lanes of the next wave whose depended-on lanes are met (Q1 (b), Dependencies below) are started from `main`, and a lane whose depended-on lane is not met is listed as `waiting`.
  proof: `node --test --test-name-pattern "^A2-14:" test/e443b-*.test.mjs`
- **A2-15** — Given a new lane, when the launcher starts it, then `agc feature start <slug> --base <start ref> --path <worktree>` runs once and the session opens in the new worktree. Given an existing worktree, then creation is skipped.
  proof: `node --test --test-name-pattern "^A2-15:" test/e443b-*.test.mjs`
- **A2-16** — Given a lane start, when the launcher sends text, then:
  - the CLI is launched with no initial prompt (the typed command is exactly the *launch command* string below);
  - the slash-command line is sent first, then `renderPrompt(…, { batch: true })`'s output for that lane, byte-identical to `fanout.mjs render <manifest> <lane> --batch --base <start sha>`, in one `write text` call;
  - each send is a `write text "<text>" newline NO` followed by an empty `write text`.
  proof: `node --test --test-name-pattern "^A2-16:" test/e443b-*.test.mjs`
- **A2-17** — Given a window that shows `Unknown command` after a send, when the launcher checks, then it resends, at most 3 times; after the third resend still answered with `Unknown command`, the lane is marked `start-failed` with that reason and frees its slot.
  proof: `node --test --test-name-pattern "^A2-17:" test/e443b-*.test.mjs`
- **A2-18** — Given a primary checkout with no trust entry of its own (a stand-in host config), or no iTerm2 (a stand-in host probe), or a project or local settings file that sets `autoContinueAtUsageLimit`, or a settings file that sets `fallbackModel`, when the launcher runs, then it refuses, names the cause (and the file or setting where one applies), exits non-zero and starts nothing.
  proof: `node --test --test-name-pattern "^A2-18:" test/e443b-*.test.mjs`
- **A2-19** — Given `content/skill-integrator.md`, when it is read, then it names the two moments the launcher is re-run (after each `波次`'s pull request merged, to start the next one; after a usage limit resets, to wake paused lanes), and the Lifecycle and Stage 3 text say a launcher-started wave replaces the human opening sessions while a refused wave stays hand-started.
  proof: `node --test --test-name-pattern "^A2-19:" test/e443b-*.test.mjs`
- **A2-20** — Given the composed coordinator SOP, when it is read, then the coord-03 line (Copy `coord03.usage-limit`, at the head of the Crash-Resume Protocol section) says a usage-limit or rate-limit dispatch error does not take the `tw_switch_role` fallback, does not end the session and does not switch the model, that the subagent is re-dispatched once with the same pin after automatic continue, and that a second failure checkpoints, records the pause reason and stops.
  proof: `node --test --test-name-pattern "^A2-20:" test/e443b-*.test.mjs`
- **A2-21** — Given `docs/lane-protocol.md`, when it is read, then §1 step 1 says a launcher-started lane's worktree already exists (confirm location and branch), §1 has the same line count as before, and §3 *批次 lane* names the launcher.
  proof: `node --test --test-name-pattern "^A2-21:" test/e443b-*.test.mjs`

Added from the manifest's scope cut (human Decisions 2026-11-27):

- **A2-22** (G1 (b)) — Given a manifest whose `相依` cell names a lane of the same `波次`, when the launcher runs, then it refuses, names the dependent lane, the depended-on lane and the wave, says to move the dependent lane to a later wave, exits non-zero and starts nothing.
  proof: `node --test --test-name-pattern "^A2-22:" test/e443b-*.test.mjs`
- **A2-23** (ref parameter required) — Given `dist/tools/join-precondition.d.ts`, when it is read, then `checkLaneAncestry` takes `(branches: string[], repoRoot: string, ref: string)`; given a branch merged into ref R but not into `HEAD`, `checkLaneAncestry([b], repo, R)` reports it as an ancestor and `checkLaneAncestry([b], repo, "HEAD")` does not; a call with two arguments (a JavaScript caller written before the parameter) still compares with `HEAD`.
  proof: `node --test --test-name-pattern "^A2-23:" test/e443b-*.test.mjs`
- **A2-24** (config key) — Given `.current/.config.json` with `laneLaunchLimit` 2, `loadConfig` returns `laneLaunchLimit: 2`; given 0, -1, 1.5, `"2"` or no key, it returns no `laneLaunchLimit` (no default filled in); config `schema_version` stays 2; `docs/config.md` has exactly one `laneLaunchLimit` section, after the `knowledge` section and before the next `---`, carrying Copy `config.section` verbatim.
  proof: `node --test --test-name-pattern "^A2-24:" test/e443b-*.test.mjs`
- **A2-25** (repo facts) — Given `CLAUDE.md`, it has 250 lines, one Layout row for `tools/lane-launch.ts` directly after the `tools/config.ts` row, and the `prompts/{pm,…}.ts` row on one line; given `docs/lane-protocol-addendum.md`, its §5 tool line names `node scripts/lane-launch.mjs` last.
  proof: `node --test --test-name-pattern "^A2-25:" test/e443b-*.test.mjs`

Added at the integrator's cut pre-review (2026-11-27), implementing Q2 (a)'s finished signal (lanes also send progress messages as `type: report`):

- **A2-26** (progress report is not finished) — Given a limit of one, a started lane whose mailbox `to-integrator.md` holds only `type: report` messages whose body does not start with `## Lane report:` (progress reports), and whose tickets in its worktree have no `stopped — …` status, and a second lane queued behind it, when the launcher polls, then the first lane stays `running`, its slot is not freed and the queued lane is not started.
  proof: `node --test --test-name-pattern "^A2-26:" test/e443b-*.test.mjs`
- **A2-27** (the two finished signals) — Given a limit of one and a queued second lane, when the first lane's mailbox gets a `type: report` whose body starts with `## Lane report:` (the lane-protocol §6 final report), then the first lane is marked `finished` and the queued lane is started; and given instead a `type: report` with any body while every ticket of the first lane in its worktree has status `done` or `stopped — …`, at least one of them `stopped — …` (a lane-protocol §3 (e) batch stop), then the same happens.
  proof: `node --test --test-name-pattern "^A2-27:" test/e443b-*.test.mjs`

## Copy / Strings

### Fixed at this cut (values NEW-2 left to the lane cut)

| string id | exact text (quote verbatim) | source |
|---|---|---|
| cfg.key | `laneLaunchLimit` | authored-here — NEW-2 scope 2 leaves the key name to the lane cut; named after the tool (`lane-launch`) and what it caps |
| cfg.default | `3` | `docs/backlog.md` E443b row / NEW-2 scope 2 |
| launch.resend-bound | `3` | authored-here — NEW-2 scope 9 leaves the bound to the lane cut; 3 resends 10 s apart give the MCP server about 40 s after readiness, well over Phase 0's observed 6 s |
| host.fallback-setting | `fallbackModel` | settings reference, `fallbackModel` entry (external ref 1); per-session flag `--fallback-model`, which the launcher never passes |
| host.autocontinue-setting | `autoContinueAtUsageLimit` | settings reference, `autoContinueAtUsageLimit` entry (external ref 2) |
| launch.state-file | `agc-lane-launch.json` | authored-here — NEW-2 scope 6: its own file in the directory `git rev-parse --git-common-dir` prints, named like `agc-tracker-map.md` and `agc-test.lock` there |
| launch.lock-file | `agc-lane-launch.lock` | authored-here — same directory; held for the length of one run so two runs never start the same lane |
| launch.wake | `額度已恢復：先 tw_get_state，照 Crash-Resume 流程核對後從中斷處接續。` | `specs/ticket-cut-e443.md` Q3 (b) proposal, ruled (b) 2026-11-27 |

### Host strings the launcher sends or matches (one constant each in `tools/lane-launch.ts`, re-checked on a CLI upgrade)

| string id | exact text (quote verbatim) | source |
|---|---|---|
| launch.slash | `/mcp__agent-governance-mcp__teamwork` | `specs/e443-phase0-host-check.md` 共用做法; `docs/install.md` prompt list |
| launch.command | `claude --permission-mode bypassPermissions -n <lane>` | Phase 0 §2 (2g), the permission mode Phase 0 verified; typed after `cd <shell-quoted worktree> && ` |
| launch.ready-marker | `permissions on` | Phase 0 共用做法 (status line), then a 6 s wait |
| sig.weekly | `You've hit your weekly limit` | Phase 0 §4; host errors page (external ref 4) |
| sig.continuing | `Continuing automatically at` | Phase 0 §4; host interactive-mode page (external ref 3) |
| sig.stopped | `Automatic continue stopped after repeated usage-limit hits` | Phase 0 §4; external ref 3 |
| sig.enter | `Press enter to continue` | Phase 0 §4; external ref 3 |
| sig.unknown | `Unknown command` | Phase 0 §2 (2b) |
| host.trust-key | `hasTrustDialogAccepted` (under `projects["<primary absolute path>"]` in `~/.claude.json`) | authored-here — observed on the Phase 0 host (CLI 2.1.332); not in the settings reference, so it is one constant re-checked with the signal table |
| host.managed-settings | `/Library/Application Support/ClaudeCode/managed-settings.json` and `managed-settings.d/*.json` beside it | host managed-settings page (external ref 5), macOS file-based location |

### Launcher output (all authored-here — no canonical source; one line per event, lane name second so `grep <lane>` finds every line)

| string id | exact text (quote verbatim) | source |
|---|---|---|
| out.refused | `lane-launch: refused — <reason>` (stderr, exit 1, nothing started) | authored-here |
| out.refused.no-wave | `the manifest has no 波次 column; add it at Stage 1 or start the lanes by hand` | authored-here (A2-12) |
| out.refused.no-human | `the manifest has no 人類 Decisions row` | authored-here (A2-11) |
| out.refused.tier | `cutApprovalAutoTier.manifest is not true in .current/.config.json` | authored-here (A2-11) |
| out.refused.same-wave | `lane <dependent> depends on <depended-on> in the same wave <n>; move <dependent> to a later wave` | authored-here (A2-22, G1 (b)) |
| out.refused.invalid | `the manifest does not validate: <code> <message>` | authored-here |
| out.refused.busy | `another lane-launch run is active (pid <pid>); stop it first` | authored-here |
| out.refused.iterm | `iTerm2 is not installed; only iTerm2 is supported` | authored-here (A2-18) |
| out.refused.trust | `the primary checkout has no trust entry of its own in ~/.claude.json; run claude once in the primary checkout and choose "Yes, I trust this folder"` | authored-here (A2-18; Phase 0 §3) |
| out.refused.autocontinue | `<file> sets autoContinueAtUsageLimit; remove it (a project or local settings file that sets it turns automatic continue off)` | authored-here (A2-18) |
| out.refused.fallback | `<file> sets fallbackModel; remove it (a lane never switches its role's model)` | authored-here (A2-18) |
| out.started | `started <lane> — window <id>` | authored-here |
| out.resumed | `resumed <lane> — window <id> (its window was gone)` | authored-here (A2-10) |
| out.woken | `woken <lane> — window <id>` | authored-here (A2-8) |
| out.entered | `entered <lane> — Press enter to continue` | authored-here (A2-9) |
| out.queued | `queued <lane> — parallel limit <n>` | authored-here (A2-1) |
| out.waiting | `waiting <lane> — depends on <dep>: <why>`, `<why>` one of `branch <branch> is not an ancestor of <ref>`, `branch <branch> is gone and <dep> has no finish record`, `agc feature finish --shipped has not run for <dep>`, `git: <first error line>` | authored-here (A2-3, A2-4, A2-14) |
| out.not-started | `not started <lane> — <why>`, `<why>` one of `approval is human`, `no ticket file for <id>`, `render failed: <code>`, `agc feature start failed: <first line>` | authored-here (A2-13) |
| out.paused-weekly | `paused <lane> — weekly limit, no automatic wake` | authored-here (A2-7) |
| out.paused-stopped | `paused <lane> — automatic continue stopped; re-run the launcher after the limit resets` | authored-here (A2-8) |
| out.finished | `finished <lane> — lane report` or `finished <lane> — batch stop` | authored-here (A2-27) |
| out.window-gone | `window gone <lane> — not finished; the next run resumes it` | authored-here (A2-10) |
| out.start-failed | `start failed <lane> — <why>`, `<why>` one of `Unknown command after 3 resends`, `not ready after 120 s` | authored-here (A2-17) |
| out.later-wave | `wave <n> waits until every lane of wave <m> is finished` | authored-here |
| out.exit | `lane-launch: no lane of wave <n> is running — exiting` | authored-here |
| state.status | `running`, `paused-weekly`, `paused-stopped`, `finished`, `window-gone`, `start-failed` | authored-here — the launch-state status values |

### Served text (`content/**`, `docs/lane-protocol.md`) and repo docs

Every served string below carries no bare ticket id and no path that exists only in this repo.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| coord03.usage-limit | block `coord03.usage-limit` below — a new paragraph (one line plus one blank line) directly under the `## Crash-Resume Protocol…` heading and its blank line, before the line starting `Constitution §3 requires` | `docs/backlog.md` E443b row (R2) / NEW-2 scope 11 |
| sop.overview-3 | block `sop.overview-3` below — replaces the Work overview row starting `\| 3. Dispatch \|` | NEW-2 scope 12 |
| sop.lifecycle-4 | block `sop.lifecycle-4` below — replaces the Lifecycle row starting `\| 4 \|` | NEW-2 scope 12 |
| sop.launcher | block `sop.launcher` below — appended, after one space, to the end of the Stage 3 line starting `**Render**` | NEW-2 scope 12 (item (10)) |
| sop.next-wave | block `sop.next-wave` below — replaces the sentence `The integrator never proposes the next wave — no next-wave plan, no offer to start one.` in Stage 6 step 7 | NEW-2 scope 12 (keeps step 7 consistent with sop.launcher) |
| lp.s1-step1 | block `lp.s1-step1` below — replaces the §1 line starting `1. **建 worktree` | NEW-2 scope 13 |
| lp.s3-launcher | block `lp.s3-launcher` below — appended (no space) to the end of the §3 *批次 lane* bullet starting `- **什麼是批次 lane**` | NEW-2 scope 13 |
| add.tools | block `add.tools` below — replaces the addendum §5 line starting `- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具` (one more item at its end) | manifest Decisions 2026-11-27 (Q3: addendum in allowed paths, `node scripts/lane-launch.mjs` call form) |
| claude.row | block `claude.row` below — a new Layout row directly after the `tools/config.ts` row | NEW-2 scope 14 |
| claude.prompts-row | block `claude.prompts-row` below — replaces the two-line `prompts/{pm,…}.ts` row with one line, so `CLAUDE.md` stays 250 lines | manifest Probe table (net line count 0, probe-verified) |
| config.section | block `config.section` below — inserted after the `knowledge` section's last bullet and its blank line, before `---` | NEW-2 scope 2 |

Each block below is the exact text, one line unless shown otherwise.

`coord03.usage-limit`:

```text
**Usage limit**: a usage-limit or rate-limit error is not tool unavailability: never take the `tw_switch_role` Fallback, end the session, switch the model or run the role in-context. After automatic continue, re-dispatch the cut-off subagent once with the same pin via this protocol; on a second failure, checkpoint, record the pause reason and stop. Only a human `dispatch_pins` changes a model.
```

`sop.overview-3`:

```text
| 3. Dispatch | Check every premise the prompts rely on; create and watch the mailbox; render one prompt per lane, or start the wave's lanes with the lane launcher |
```

`sop.lifecycle-4`:

```text
| 4 | the lane launcher opens one session per lane (a wave it refuses: the human opens N sessions and pastes the prompts); integrator talks to each lane over the mailbox | each lane runs its own `/teamwork` chain to the judge's `(code-reviewer, PASS)` |
```

`sop.launcher`:

```text
**Lane launcher**: when the manifest has the `波次` column and checks 1–3 hold, run `node <agc install>/scripts/lane-launch.mjs <manifest>` as a background process instead of handing out prompts: it starts each batch lane of the current wave in its own terminal window with `render --batch`'s output, at most `laneLaunchLimit` (a `.current/.config.json` key) open at once, lists every lane it leaves unstarted with the reason, and polls until each started lane has sent its final report (a lane report, or the report after a batch stop) or is paused. Re-run it at two moments: after each `波次`'s pull request has merged and local `main` is pulled (Stage 6 step 5), to start the next `波次`; and after a usage limit resets, to wake the paused lanes. A wave it refuses stays hand-started: render and hand out the prompts as above.
```

`sop.next-wave`:

```text
The integrator never proposes the next wave — no next-wave plan, no offer to start one; a later `波次` of this approved manifest is not a next wave: re-run the lane launcher for it (Stage 3).
```

`lp.s1-step1`:

```text
1. **建 worktree —— 在任何 `tw_*` 呼叫之前**（由啟動器開出的批次 lane 例外：worktree 已建好、session 就開在裡面，跳過建立與切換，只做本步的 *確認位置*；啟動器見 §3 *批次 lane*）：
```

`lp.s3-launcher`:

```text
批次 lane 由整合者跑 agc 的啟動器（`node <agc 安裝位置>/scripts/lane-launch.mjs <清單>`）開出 session，不由人類貼派工 prompt；啟動器拒絕的波次照舊由人類開。
```

`add.tools`:

```text
- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具，在本 repo 一樣用 repo 相對路徑：`node scripts/mailbox-watch.mjs`、`node scripts/lane-status.mjs`、`node scripts/merge-invariants.mjs`、`node scripts/test-lock.mjs`（全套一律 `node scripts/test-lock.mjs -- npm test`）、`node scripts/feature-rollup.mjs`、`node scripts/batch-summary.mjs`、`node scripts/lane-launch.mjs`。
```

`claude.row`:

```text
tools/lane-launch.ts      lane launcher core: waves, parallel limit, iTerm2 windows, usage-limit pauses (scripts/lane-launch.mjs)
```

`claude.prompts-row`:

```text
prompts/{pm,architect,researcher,design-auditor,sr-engineer,code-reviewer,qa-engineer,doc-writer,release-engineer,integrator,spec-workshop}.ts   the other eleven role prompts
```

`config.section`, verbatim:

````markdown
### `laneLaunchLimit` — lane launcher parallel limit (optional)

The lane launcher (`node <agc install>/scripts/lane-launch.mjs <manifest>`) starts the lanes of one wave of a fan-out manifest, each in its own terminal window. This key caps how many of its lanes are open at once; lanes over the limit queue and start as others finish.

```json
{
  "laneLaunchLimit": 2
}
```

| Value | Lanes open at once |
|---|---|
| absent (or not usable) | `3` (the default) |
| `2` | `2` |

Semantics:

- **Optional.** A positive integer. Any other value (zero, negative, fractional, not a number) is dropped silently and the default applies; it is never an error.
- **What counts as open.** A lane counts from the moment the launcher starts it until its final report reaches the mailbox (its lane report, or the report it sends after a batch stop; a progress report does not count) or its window is gone; a paused lane still counts.
- **Where the default is applied.** `loadConfig` surfaces the value verbatim as `WorkspaceConfig.laneLaunchLimit` only when it is usable; the launcher applies the default of 3 itself.
- **Who reads it.** Only the lane launcher, from the primary checkout's `.current/.config.json`.
- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.
````

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- tmux (scheme B); background or `-p` sessions; the per-lane account mapping (item (4), dropped); the statusline/`CronCreate` wake fallback.
- Any server change (the server runs no command): no `tw_*` tool, gate, error code, `GATE_REGISTRY` entry (stays 33) or `UPDATE_STATE_GATE_PIPELINE` step (stays 17) changes.
- Writing the fan-out manifest (R4) — the launcher only reads it; `scripts/batch-summary.mjs` (E425); the stop rule; the mailbox, merging and tracker write-back.
- Editing `scripts/join-precondition.mjs` (outside this lane's paths); it keeps its two-argument call (see Dependencies, *Ref parameter*).
- R5's observation (does the main session re-dispatch after automatic continue, with pins kept): recorded post-ship by the integrator, not acceptance.
- A real unattended start in tests (Phase 0 verified it by hand), and a by-hand check of a multi-line send (see Dependencies, *Known unverified*).
- Settings the launcher cannot read: server-managed settings, MDM policies, a `--settings` file a person passes by hand; `autoContinueAtUsageLimit: false` in user or managed settings (NEW-2 checks project and local settings only).
- A session that ended inside a still-open window (a person typed `/exit`): the launcher keeps it `running` until its report or a closed window.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark): integrator / release-engineer, not this lane.

## Dependencies / Prerequisites

**Depends on** E443a (merged, PR #207): `parseManifest` (`DispatchableLane.wave`, `.depLanes`, `.approval`), `lanesSectionsWithoutWave`, `ticketIds`, `lookupTicketFiles`, `resolvePrimary`, `resolveWorktree`, `resolveMailboxHeader` and `renderPrompt(…, { batch: true })` in `tools/fanout-manifest.ts` — read, never edited (forbidden for this lane).

**Decisions fixed by this cut** (implementation detail the rulings imply; none is an option for the human):

1. *Config key.* `laneLaunchLimit`, a positive integer; `tools/config.ts` surfaces it only when usable and fills no default; the launcher's own constant `DEFAULT_LANE_LAUNCH_LIMIT = 3` applies otherwise. No config schema bump (`test/config-cache.test.mjs`, `test/drift-baseline.test.mjs`, `test/config-versioning.test.mjs` stay green untouched).
2. *Launch state.* `<git-common-dir>/agc-lane-launch.json`, never tracked, shared by every worktree. Keyed by the manifest path relative to primary, then lane; per lane it holds the status (`state.status`), the window id and the wave. Written atomically (tmp file + rename). The launcher never writes the manifest, any tracked path, or anything under a lane worktree.
3. *One run at a time.* `<git-common-dir>/agc-lane-launch.lock`, created with O_EXCL holding the run's pid, removed on exit; a lock whose pid is not alive is stale and is replaced. A live lock → `out.refused.busy`. (The integrator stops a still-polling run before re-running to wake paused lanes.)
4. *Current wave.* The lowest `波次` that holds a lane not finished. A lane is **finished** when the launch state says `finished`, when its mailbox shows a final report (below), or when the primary checkout holds `.current/history/<any month>/<lane>/` (finish ran). The mailbox is `to-integrator.md` under the manifest's `mailbox:` header, resolved against primary. Lanes also send progress messages as `type: report` (one at every hop), so a `type: report` alone never finishes a lane (A2-26). A final report is a `--- msg` block whose `type:` is `report` and either (a) whose body, the text after the block's closing `---`, starts with `## Lane report:` (the lane-protocol §6 final report, whatever the outcome), or (b) which arrives while every ticket of the lane (the ids in its `票` cell, read from the ticket files in the lane worktree with the ticket-file parser in `tools/ticket-file.ts`) has status `done` or `stopped — …`, at least one of them `stopped — …` (a lane-protocol §3 (e) batch stop, which writes the ticket status and commits before it reports). A progress message cannot produce (b): it changes no ticket status. Both implement Q2 (a); lane-protocol text does not change. Lanes of later waves are not considered (`out.later-wave`).
5. *Dependency met* (Q1 (b)). For dependent lane L and depended-on lane D (branch from D's manifest row): the start ref of L is the manifest's `base:` sha in wave 1 and `main` in a later wave. With `"knowledge": "local"` (primary `.current/.config.json`), met iff the primary holds `.current/history/<any month>/<D>/`. Otherwise met iff D's branch exists and `checkLaneAncestry([D's branch], primary, <L's start ref>)` reports an ancestor, or D's branch is gone and that history record exists. An ancestry `error` is "not met" with `git: …`.
6. *G1 (b).* Any `相依` entry naming a lane of the same `波次`, anywhere in the manifest, refuses the whole run (`out.refused.same-wave`, one line per pair).
7. *Batch-lane filter* (NEW-2 scope 10). A lane with `approval` `human`, or with a ticket id that `lookupTicketFiles` finds no file for, is `not started` and listed; it still counts as not finished, so it holds back later waves until its own report or finish.
8. *Start.* New lane: `node <this agc install>/bin/agc-init.mjs feature start <branch without feat/> --base <start ref> --path <resolved worktree>` from primary (no `agc` on PATH needed). Existing worktree (listed by `git worktree list --porcelain`): skip. Render with `base` = the start ref's sha. The iTerm2 window gets `cd <shell-quoted worktree> && claude --permission-mode bypassPermissions -n <lane>`; no initial prompt.
9. *Send method* (Phase 0 §2 (2g)). Wait for `permissions on` in the window, then 6 s; each send is `write text "<text>" newline NO`, 0.5 s, then `write text ""`. Text reaches `osascript` as an argument (`on run argv`), never spliced into script source. Send 1 = `launch.slash`; send 2 = the whole `render --batch` output in one `write text`.
10. *`Unknown command` retry.* 5 s after send 1, a new `Unknown command` (see 11) → resend send 1, 10 s apart, at most 3 resends; then `start-failed`. No ready marker within 120 s → `start-failed`. A `start-failed` lane frees its slot and is resumed like a `window-gone` lane on the next run.
11. *Signal matching.* A signal counts only when it appears after the launcher's last send to that window: the launcher records, at each send, how many times each signal line already appears in the window contents, and a poll matches only a higher count. Prefix match, as Phase 0 §4 says. `paused-weekly`: a new `sig.weekly` with no `sig.continuing` after it. `paused-stopped`: a new `sig.stopped`. `sig.enter`: send one empty `write text`, stay `running`. Any other usage-limit line (including `Automatic continue cancelled`) leaves the lane `running`.
12. *Run order.* Refusal pre-checks (all of them, before anything is started) → lock → reconcile each recorded lane (finished? window exists? new signals?) → wake every `paused-stopped` lane whose window exists (`launch.wake`, same send method, status back to `running`; `paused-weekly` is never woken) → resume `window-gone` and `start-failed` lanes in a new window (no `feature start`, same two sends) → start new lanes of the current wave → poll every 15 s, starting queued lanes as slots free → exit 0 when no lane of the current wave is `running` (`out.exit`). Open slots = limit minus lanes `running`, `paused-weekly` or `paused-stopped`. Usage error (no manifest argument, unreadable file) exits 2; a refusal exits 1.
13. *Pre-checks* (NEW-2 scope 9–10, A2-11, A2-12, A2-18, A2-22): no `波次` column; manifest validation errors; no `人類` Decisions row; `cutApprovalAutoTier.manifest` not `true`; a same-wave dependency; a live lock; iTerm2 absent; `~/.claude.json` `projects["<primary>"].hasTrustDialogAccepted` not `true`; `autoContinueAtUsageLimit` present in `.claude/settings.json` or `.claude/settings.local.json` of the primary or of any existing lane worktree of the manifest; `fallbackModel` set (non-empty) in `~/.claude/settings.json`, the managed-settings file or drop-ins, or the project or local settings of the primary or of any existing lane worktree. Every host path is a parameter so tests pass stand-ins.
14. *Ref parameter* (manifest Decisions: required). `checkLaneAncestry(branches: string[], repoRoot: string, ref: string)`; `ref` is required in the TypeScript signature, so every TypeScript caller (the launcher) must pass it. `scripts/join-precondition.mjs` is outside this lane's paths and calls it with two arguments; so that its output does not change, a missing `ref` at run time compares with `HEAD`, stated in the function's doc comment. Integrator pre-review: if this run-time fallback is not acceptable, the alternative is adding `scripts/join-precondition.mjs` to the owned column (a new `人類` Decisions row).
15. *Seams.* `tools/lane-launch.ts` takes the session opener (open window, read contents, write text, window exists), the iTerm2 probe, the host paths, the `feature start` runner, the clock/sleep and the git/mailbox roots as injected parameters; `scripts/lane-launch.mjs` wires the real ones. How the CLI-level tests inject stand-ins is the architect's call.

**Known unverified** (honest note, not a blocker): Phase 0 sent a one-line prompt; Decision 9 sends the multi-line `render --batch` output in one `write text`, relying on the same behaviour Phase 0 observed (Enter inside a text chunk does not submit; the separate empty `write text` does). The automated tests use the stand-in; the integrator checks the first real launch by eye.

**External references** (Resource Audit; each recorded as an `external_refs` entry, all `fetched` 2026-11-27):
1. https://code.claude.com/docs/en/settings-reference.md#fallbackmodel — `fallbackModel`, scope any file, `--fallback-model` per-session override.
2. https://code.claude.com/docs/en/settings-reference.md#autocontinueatusagelimit — read from user, `--settings` and managed only; a project or local file that sets it turns the feature off.
3. https://code.claude.com/docs/en/interactive-mode.md#wait-for-a-usage-limit-to-reset — `Continuing automatically at`, `Press enter to continue`, `Automatic continue stopped after repeated usage-limit hits`, `Automatic continue cancelled`.
4. https://code.claude.com/docs/en/errors.md#youve-hit-your-session-limit — `You've hit your weekly limit · resets …`.
5. https://code.claude.com/docs/en/managed-settings.md — macOS file-based location `/Library/Application Support/ClaudeCode/`.
6. https://code.claude.com/docs/en/sub-agents.md — "API errors in subagents" (a cut-off subagent returns partial output or an error; the fallback-model notice).

**Shared artifacts re-captured by qa after the last implementing task** (manifest Probe table): `test/fixtures/compose-golden/skill-coordinator-monolith.txt` (coord-03 grows by one paragraph) and the teamwork coordinator bundle cap in `test/context-budget.test.mjs` (zero headroom today; re-baseline by the measured growth — the probe measured +100 ~tok (20005), the manifest estimated about +92 — with a history comment in the style of the earlier re-baselines).

**Probe** (full suite, scratch clone under `$TMPDIR` of this lane's base with the Copy texts above applied, `tools/lane-launch.ts` and `scripts/lane-launch.mjs` as stubs, the `checkLaneAncestry` and `laneLaunchLimit` changes, `dist/` rebuilt and everything committed; command `node scripts/test-lock.mjs -- npm test`): 4907 tests, 4898 pass, 7 fail, 2 skipped (exit 1), in 6 files:

| test file | failing test | Probe-table reader or new | why | fix |
|---|---|---|---|---|
| `test/context-budget.test.mjs` | AC8/AC-P2-7 teamwork coordinator bundle | reader (owned) | measured 20005 ~tok against the 19905 cap: +100 ~tok for `coord03.usage-limit` (a first, longer draft measured +124 and was cut down) | T-E443B-06 re-baselines to the measured value with a history comment |
| `test/e115-join-precondition.test.mjs` | AC5 exported signatures | reader (owned) | pins the two-parameter `checkLaneAncestry` `.d.ts` line; every other e115 test (two-argument calls) stays green, which shows the run-time `HEAD` fallback works | T-E443B-01 re-pins to the three-parameter line |
| `test/e349-integrator-repo-facts.test.mjs` | AC-E349-2 | reader (owned) | pins the addendum §5 tool line verbatim | T-E443B-01 re-pins to `add.tools` |
| `test/e425-stop-ticket-batch.test.mjs` | AC1 (C-LP2 verbatim) | reader (owned) | pins the whole §3 *批次 lane* subsection; `lp.s3-launcher` extends its first bullet | T-E443B-01 re-pins C-LP2 |
| `test/e428-tracker-mirror.test.mjs` | AC6, AC12 | reader (owned) | sha256 of `content/skill-integrator.md` with the E428 Copy taken out | T-E443B-06 re-pins the sha after the last text edit |
| `test/skill-manifest.test.mjs` | t-golden-byte-identity | **new — not in the Probe table, not in the owned column** | compares the composed coordinator SOP with `test/fixtures/compose-golden/skill-coordinator-monolith.txt` (owned) | no edit: it turns green when T-E443B-06 re-captures the golden |

No forbidden-column file went red (`test/e408-core-task-alias-tail.test.mjs`, `test/e403-lean-dispatch-alias.test.mjs`, `test/e443a-integrator-sop.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e436-stale-handoff-paths.test.mjs`, `test/e395-claude-md-tail.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e432-judge-report-checks.test.mjs`, `test/config-cache.test.mjs`, `test/drift-baseline.test.mjs`, `test/config-versioning.test.mjs` all green). The other Probe-table readers (`e410`, `e430`, `e130`, `e440`, `e290`, `e294`, `e351`, `e383`, `e385`, `e289-config-key`, `e447-served-text`, `e292-config-sister-repos`, `e422`, `e457`, `e438`, `e292-integrator-sop`, `e286`) stayed green with this wording. One wording change came from the probe: the first draft of `sop.launcher` cited `docs/config.md`, which `test/e425-stop-ticket-batch.test.mjs` AC14 flags as a repo-only path in served text; the final text says "a `.current/.config.json` key" instead.

**Integrator pre-review list**: (1) `test/skill-manifest.test.mjs` goes red until the golden is re-captured and is outside the owned column; it needs no edit (it only reads the owned golden), so no `擁有` change is asked for. (2) The coord-03 paragraph costs +100 ~tok against the manifest's estimate of about +92; it already carries only what NEW-2 scope 11 requires. (3) Decision 14: `ref` is required in the signature, and a two-argument JavaScript caller still compares with `HEAD` so the out-of-lane `scripts/join-precondition.mjs` keeps its output; the alternative would add that script to the owned column through a new `人類` row. (4) Decision 3 adds a lock file beside the launch-state file, so a re-run while a run is still polling is refused rather than double-starting a lane.

**Routing**: architect hop (≥ 3 modules, a new config key, a new cross-cutting script): pm → architect → qa-engineer → sr-engineer → code-reviewer. Dispatch pins: all five roles `opus`. Task ids `T-E443B-NN`. Every AC has an implementing sr task: A2-1..A2-6, A2-11..A2-14, A2-22..A2-24, A2-26, A2-27 → T-E443B-02; A2-7..A2-10, A2-15..A2-18 → T-E443B-03; A2-5, A2-6, A2-11, A2-12 at the CLI level and A2-25 → T-E443B-04; A2-19..A2-21 and the `docs/config.md` part of A2-24 → T-E443B-05.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E443b | Lane launcher: `scripts/lane-launch.mjs` + `tools/lane-launch.ts` start the batch lanes of the current wave of a manifest with the `波次` column in visible iTerm2 windows under the `laneLaunchLimit` parallel limit (default 3), with wave and dependency scheduling (Q1 (b), G1 (b) refusal), `agc feature start` run by the launcher, the local launch-state file, paused-lane detection and the wake line (R3, Q3 (b)), final-report finish (Q2 (a): the §6 lane report, or a report after a §3 batch stop; never a progress report), window-gone resume, the item (7) refusals and the Phase 0 pre-checks; `checkLaneAncestry` gains a required ref parameter; the coord-03 usage-limit line (R2); the integrator SOP's two re-run moments; `docs/lane-protocol.md` §1/§3, the addendum tool line, `docs/config.md` and the `CLAUDE.md` Layout row. | E443a | ~14 source/doc + `dist/` output, plus new tests, fixtures, the coordinator golden, the budget cap and the re-pinned tests listed under Probe | `scripts/lane-launch.mjs`, `tools/lane-launch.ts`, `dist/tools/lane-launch.js`, `dist/tools/lane-launch.js.map`, `dist/tools/lane-launch.d.ts`, `dist/tools/lane-launch.d.ts.map`, `tools/config.ts`, `dist/tools/config.js`, `dist/tools/config.js.map`, `dist/tools/config.d.ts`, `dist/tools/config.d.ts.map`, `tools/join-precondition.ts`, `dist/tools/join-precondition.js`, `dist/tools/join-precondition.js.map`, `dist/tools/join-precondition.d.ts`, `dist/tools/join-precondition.d.ts.map`, `content/skill-integrator.md`, `content/coord-03-core-fallback.md`, `docs/lane-protocol.md`, `docs/lane-protocol-addendum.md`, `docs/config.md`, `CLAUDE.md`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, `test/context-budget.test.mjs`, `test/e115-join-precondition.test.mjs`, `test/e349-integrator-repo-facts.test.mjs`, `test/e425-stop-ticket-batch.test.mjs`, `test/e428-tracker-mirror.test.mjs`, `test/e443b-*.test.mjs`, `test/fixtures/e443b/**`, `specs/e443b-lane-launcher.md` | — |
