# Ticket cut — E443 (integrator Stage 0, 2026-11-27)

Input: `docs/backlog.md` row E443 (Phase 0/Phase 1 items (1)–(10), audit amendment items (1)–(6), the ruling 16 and ruling 19 amendments, the acceptance list); `specs/e443-phase0-host-check.md` (Phase 0 results, its 結論 section and the scheme A prerequisites); `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 15.2 ruling 8, 15.4, 16.1 rulings 6, 9, 13, 14, 16, 19. Read at `main` @ `46e974d`.

Human rulings applied as given (integrator session, 2026-11-27), not reopened here: **R1** split into NEW-1 then NEW-2 in two sequential waves; **R2** amends item (4); **R3** amends item (6); **R4** `"knowledge": "local"` dependency rule, the launcher never writes the manifest, launch state in its own local file; **R5** the re-dispatch-after-automatic-continue observation is post-ship, not acceptance.

Proposed backlog ids: NEW-1 = E443a, NEW-2 = E443b. Both ship in a v5.x release; version bump, CHANGELOG and backlog done-marks belong to release-engineer, not to either ticket.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| NEW-1 | Fan-out manifest waves and batch render: the Lanes table gets a `波次` column and a restricted `相依` column, both checked by `fanout.mjs`; a mechanical comparison of the approved compact wave table with the manifest (ruling 16) and its rule in the integrator SOP; `render` batch mode (stop-the-ticket closing line, summary and reading list from the ticket file, "worktree already created" first step). Hand-started render output stays the same as before this ticket. | none | ~7 (+4 if the comparison gets its own module) plus new tests and fixtures | `tools/fanout-manifest.ts`, `dist/tools/fanout-manifest.js`, `dist/tools/fanout-manifest.js.map`, `dist/tools/fanout-manifest.d.ts`, `dist/tools/fanout-manifest.d.ts.map`, `tools/fanout-waves.ts`, `dist/tools/fanout-waves.js`, `dist/tools/fanout-waves.js.map`, `dist/tools/fanout-waves.d.ts`, `dist/tools/fanout-waves.d.ts.map`, `scripts/fanout.mjs`, `content/skill-integrator.md`, `test/e443a-*.test.mjs`, `test/fixtures/e443a/**` | — |
| NEW-2 | Lane launcher: `scripts/lane-launch.mjs` and `tools/lane-launch.ts` start the lanes of one wave in visible iTerm2 windows (scheme A) under a parallel limit (config key, default 3), with wave and dependency scheduling, `agc feature start` run by the launcher, a local launch-state file, paused-lane detection per R3, "window gone, lane not finished" resume, item (7) refusal, the Phase 0 prerequisites as pre-checks; the coord-03 usage-limit line per R2; the integrator SOP's two re-run moments; `docs/lane-protocol.md` and `docs/config.md`. | NEW-1 | ~14 (+4 if `tools/join-precondition.ts` needs a ref parameter) plus new tests, fixtures, a golden and a budget cap | `scripts/lane-launch.mjs`, `tools/lane-launch.ts`, `dist/tools/lane-launch.js`, `dist/tools/lane-launch.js.map`, `dist/tools/lane-launch.d.ts`, `dist/tools/lane-launch.d.ts.map`, `tools/config.ts`, `dist/tools/config.js`, `dist/tools/config.js.map`, `dist/tools/config.d.ts`, `dist/tools/config.d.ts.map`, `tools/join-precondition.ts`, `dist/tools/join-precondition.js`, `dist/tools/join-precondition.js.map`, `dist/tools/join-precondition.d.ts`, `dist/tools/join-precondition.d.ts.map`, `content/skill-integrator.md`, `content/coord-03-core-fallback.md`, `docs/lane-protocol.md`, `docs/config.md`, `CLAUDE.md`, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, `test/context-budget.test.mjs`, `test/e395-claude-md-tail.test.mjs`, `test/e436-stale-handoff-paths.test.mjs`, `test/e443b-*.test.mjs`, `test/fixtures/e443b/**` | — |

Both tickets write `content/skill-integrator.md`. They run in sequential waves (R1), so the two `touches` sets do not have to be disjoint.

## NEW-1 (proposed E443a) — manifest waves, wave-table comparison, batch render

**Scope**
1. *Wave column.* The Lanes table gets a `波次` column whose cell is a positive integer. The header name comes from ruling 13. Where it sits in the table is an interface detail for qa. Older manifests are not migrated. A table without the column parses exactly as it does today, both the 8-column table and the 9-column table with `approval`.
2. *Dependency column, restricted only when `波次` is present.* Every `相依` cell is `無` or a comma-separated list of lane names from the same manifest. Notes go in `範圍切線`. `fanout.mjs` reports an error naming the lane and the cell when any of these holds: a `波次` cell is not an integer; a `相依` cell holds prose or an unknown lane name; a lane lists itself; or a lane depends on a lane in a later wave. That last case can never be met. It is derived here from ruling 13 ("check validates the format"). On a manifest without `波次`, `相依` stays free text, because the 56 manifests under `specs/` have no `波次` column and must still validate.
3. *Wave-table comparison (ruling 16).* A `fanout.mjs` check compares an approved compact wave table (`| wave | ticket | depends on |`, the `spec-workshop` discussion record) and the lanes' ticket files with a manifest that has the `波次` column. The command form is for qa to decide. The check passes only when all three hold:
   - **Same ticket set.** The tickets in the manifest's `票` cells are exactly the wave table's tickets: none added, none removed, and no ticket in two lanes.
   - **Every approved dependency kept.** For "X depends on Y", either X and Y are in the same lane with Y listed before X in its `票` cell, or Y's lane is reachable from X's lane through `相依`. Added dependencies are allowed.
   - **Owned files inside allowed paths.** Each lane `擁有` token is inside the `allowed paths` of that lane's ticket files. Governance bookkeeping is left out first: the same set the cut table's `touches` excludes, plus the lane's own implicit bookkeeping. "Inside" means the token is byte-identical to an allowed-path entry, or it is a literal path that an allowed-path glob matches. A glob token is never inside a different glob. This follows the `check --cut` precedent, and an unclear case fails, which is the safe direction.

   On a pass the check prints the reason line for the Decisions row. On a failure it exits non-zero and names each broken condition.
4. *Integrator SOP text* (`content/skill-integrator.md`):
   - Stage 1: the integrator fills `波次` and `相依` from `spec-workshop`'s compact wave table.
   - Stage 2: the *Wave table approved in `spec-workshop`* paragraph is rewritten per ruling 16. When the comparison passes, the manifest is dispatched without a human stop, and the integrator adds a Decisions row with `裁決者` = `整合者` (the only values `validate` accepts are `人類` and `整合者`) and `內容` starting `自動：只改順序或分組 — ` followed by the reason. When it fails, the integrator halts for human approval. Until this ticket lands, ruling 9's "any change halts" applies.
   - The text adds no backtick-quoted gate error code (e453 AC25) and cites no repo-only path and no bare ticket id (`content/**` ships to adopters).
5. *Batch render* (items (8), (9), amendment (1)). A batch switch on `render` (qa names it) changes three things, and only these:
   - **First step.** The `feature start` / `EnterWorktree` line becomes a line saying the worktree is already created and the session must confirm location and branch first. Proposed text: `worktree 已建好，這個 session 就開在裡面；先用兩次各自獨立的 Bash 呼叫跑 \`pwd\` 與 \`git branch --show-current\`，確認前者是 <worktree>、後者是 <branch>，不符就停下來回報。`
   - **Closing line.** `需要我核准的事，等我在這裡親手打字。` is replaced. Proposed text: `需要人類裁定的事一律停票：照 lane 規則的「批次 lane」把問題寫進票檔的 \`## Open question\`、回報整合者，不等打字核准。`
   - **Summary and reading list** come from the lane's ticket files. This mapping is defined at this cut (amendment (6)):
     - `<一句話>` is the ticket file's `title`; for several tickets in one lane, the titles are joined by `；`.
     - `<計劃的必讀章節> + <票面 row>` gets one entry per ticket: the ticket file's repository-relative path, followed by `的 ## Scenarios（` + its scenario ids joined by `、` + `）`.
     - The ticket file is found under `ticketDir` by its `id` field. The lookup form is for qa to decide.
     - A ticket with no ticket file, or one that does not parse, is an error naming the ticket. No fallback text is used, which matches `renderPrompt`'s existing "absent source is an error" rule.

   Final wording goes in the lane spec's Copy / Strings.
6. *Hand-started output unchanged* (amendment (6)). Without the batch switch, `render` prints exactly what it printed before this ticket, with and without `laneProtocolAddendum`.

**Out of scope**
- The launcher, starting sessions, the config key, launch state and dependency-met evaluation: all NEW-2.
- `docs/lane-protocol.md` (NEW-2), `content/coord-03-core-fallback.md` (NEW-2), the compose goldens and `test/context-budget.test.mjs`. `content/skill-integrator.md` is in no compose golden and has no budget cap (grep at `46e974d`).
- Migrating existing `specs/fanout-*.md`.
- `scripts/batch-summary.mjs` and the stop rule (E425). See needs-human-ruling Q4.
- Any server, gate or `GATE_REGISTRY` change.
- `PROMPT_TEMPLATE_3B`'s hand-started bytes.

**Allowed paths**: the NEW-1 `touches` cell. `tools/fanout-waves.ts` and its `dist/` files are only for the case where the comparison is split out; the `tools/fanout-*.ts` Layout glob row in `CLAUDE.md` already covers it, so `CLAUDE.md` is not touched. Re-pinned existing tests are added to the lane's owned set at the lane cut (see Test impact).

**Acceptance** (each automated; the fixtures are synthetic manifests, wave tables and ticket files)
- **A1-1** — Given a manifest with `波次` integers and `相依` cells that are `無` or names of the manifest's lanes in the same or an earlier wave, when `fanout.mjs validate` and `check` run, then neither reports a format error.
- **A1-2** — Given such a manifest with a non-integer `波次` cell, or a `相依` cell holding prose, an unknown lane name, the lane itself, or a lane in a later wave, when `fanout.mjs validate` runs, then it exits 2 and names the lane and the cell.
- **A1-3** — Given every `specs/fanout-*.md` at the dispatch base (none has `波次`), when `fanout.mjs validate` runs on each, then each exit code is the same as at the dispatch base.
- **A1-4** — Given an approved wave table and a manifest that only serialises two lanes the table approved as parallel (an added `相依` or a later `波次`), when the comparison runs, then it exits 0 and prints the Decisions reason line.
- **A1-5** — Given a manifest that drops an approved dependency, when the comparison runs, then it exits non-zero and names the dependency.
- **A1-6** — Given a manifest that adds a ticket, removes a ticket, or puts one ticket in two lanes, when the comparison runs, then it exits non-zero and names the ticket.
- **A1-7** — Given a lane whose `擁有` holds a file outside its tickets' `allowed paths`, when the comparison runs, then it exits non-zero and names the lane and the path.
- **A1-8** — Given `content/skill-integrator.md`, when it is read, then:
  - it says Stage 1 fills `波次`/`相依` from the compact wave table;
  - it says that a passing comparison dispatches without a stop and records a `整合者` Decisions row starting `自動：只改順序或分組`;
  - it says that a failing comparison halts for human approval;
  - its backtick-quoted gate codes are unchanged.
- **A1-9** — Given batch use, when `render` runs, then the prompt ends with the stop-the-ticket line and does not contain `需要我核准的事，等我在這裡親手打字。`.
- **A1-10** — Given batch use and a lane whose ticket file has a `title` and scenarios, when `render` runs with no `--summary` and no `--reading`, then `<一句話>` is the title and the reading list is the ticket file path with its scenario ids. Given a lane ticket with no ticket file, then `render` exits 2 and names the ticket.
- **A1-11** — Given batch use, when `render` runs, then the first step is the "worktree already created; confirm location and branch" line, and no `feature start` / `EnterWorktree` line is printed.
- **A1-12** — Given the existing arguments with no batch switch, when `render` runs, then the output is byte-identical to the output before this ticket.
  proof: the existing E177a render golden (`test/fixtures/e177a/render-e177a.golden.txt`) passes unmodified, and so do the addendum and two-layer pointer cases (`test/e289-render-addendum.test.mjs`, `test/e343-render-pointer-guard.test.mjs`).

**depends_on**: none. E422 (ticket files) and E425 (batch lane) are done.

**Test impact.** Not run: there is no diff. Candidate files come from a literal grep at `46e974d`; which of them fail is settled by the lane PM's full-suite probe.
- **Render / template readers** (must stay green unmodified for A1-12): `test/fixtures/e177a/render-e177a.golden.txt` (not re-pinned), `test/e177a-manifest.test.mjs`, `test/e177a-check-cli.test.mjs`, `test/render-structure.test.mjs`, `test/e289-render-addendum.test.mjs`, `test/e289-config-key.test.mjs`, `test/e343-render-pointer-guard.test.mjs`, `test/e376-render-omits-tier.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e248-relative-mailbox-header.test.mjs`, `test/e294-lane-enterworktree.test.mjs`.
- **Lanes-table parse readers** (24 files match `LANES_HEADER`, `parseManifest`, `validateManifest` or `相依`), including `test/e296-manifest-tier.test.mjs`, `test/e425-stop-ticket-batch.test.mjs`, `test/e447-cut-reseed.test.mjs`, `test/e447-mode-off.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e283-validate-handoff.test.mjs`, `test/e284-fanout-handoff.test.mjs`, `test/e316-cut-heading-variants.test.mjs`, `test/e322-owners.test.mjs`, `test/e381-owned-clause-tokens.test.mjs`, `test/e390-check-recorded-base.test.mjs`.
- **`content/skill-integrator.md` readers (29 files):**
  - `test/e178a-integrator-role.test.mjs`
  - `test/e226-integrator-sop-portable.test.mjs`
  - `test/e246-mailbox-teardown.test.mjs`
  - `test/e262-architect-hop-order.test.mjs`
  - `test/e285-integrator-session-handoff.test.mjs`
  - `test/e286-integrator-trust-and-git.test.mjs`
  - `test/e288-integrator-stage0.test.mjs`
  - `test/e292-integrator-sop.test.mjs`
  - `test/e295-hop-cap-and-sop-halves.test.mjs`
  - `test/e296-manifest-tier.test.mjs`
  - `test/e297-main-protected-sop.test.mjs`
  - `test/e329-integrator-sop-followups.test.mjs`
  - `test/e336-portable-pull.test.mjs`
  - `test/e349-integrator-repo-facts.test.mjs`
  - `test/e355-integrator-generic-wording.test.mjs`
  - `test/e391-prompt-audit-stale-facts.test.mjs`
  - `test/e393-builder-judge-core.test.mjs`
  - `test/e407-restatement-citations.test.mjs`
  - `test/e410-task-alias-content-tail.test.mjs`
  - `test/e416-filing-bar.test.mjs`
  - `test/e423-spec-workshop.test.mjs`
  - `test/e425-stop-ticket-batch.test.mjs`
  - `test/e428-tracker-mirror.test.mjs`
  - `test/e430-mailbox-outside-lane.test.mjs`
  - `test/e433-test-first-rules.test.mjs`
  - `test/e438-origin-fenced-labels.test.mjs`
  - `test/e447-served-text.test.mjs`
  - `test/e453-served-text-v5.test.mjs`
  - `test/skill-frontmatter.test.mjs`
- **New:** `test/e443a-*.test.mjs` and `test/fixtures/e443a/**`.
- **Plan:** no architect hop expected (one module plus SOP text). qa writes the A1-* tests first.

## NEW-2 (proposed E443b) — the launcher, usage limits, SOP and docs

**Scope**
1. *Launcher.* `scripts/lane-launch.mjs` is a thin CLI; the logic lives in `tools/lane-launch.ts`. It reads a manifest that has the `波次` column (NEW-1) and starts the lanes of one wave.
   - Wave choice: it picks the lowest wave that has a lane not yet started. A later wave's lanes start only after every lane of earlier waves is finished. This is derived from "starts the lanes of one wave" and item (10).
   - The session opener can be swapped. The real one drives iTerm2; tests use a stand-in command and a stand-in for window contents.
2. *Parallel limit* (item (2)). A `.current/.config.json` key with default 3. The key name is decided at the lane cut and documented in `docs/config.md`; there is no config schema bump, because optional keys have been added at config schema 2 before (`knowledge`). Lanes over the limit queue and start as others finish.
3. *Dependencies* (item (3), amendment (2), R4).
   - A lane whose depended-on lane is not met is not started. It is listed as waiting, with the lane it waits on named.
   - "Met" is the depended-on lane's branch being an ancestor of the integration branch, reusing `checkLaneAncestry` from `tools/join-precondition.ts`; a ref parameter is added only if the lane needs one. Under `"knowledge": "local"`, `agc feature finish --shipped` must also have run for that lane.
   - The integration branch is gone by the time a later wave starts, so the exact test is needs-human-ruling Q1.
   - The launcher refuses a manifest with no `波次` column and says why.
4. *Worktree* (amendment (1)). The launcher runs `agc feature start` for a new lane and opens the session inside the new worktree. When the worktree already exists (a resume), it skips creating it.
5. *One prompt source* (item (1), as relaxed by amendment (1)). The text sent is exactly `fanout.mjs render`'s batch output (NEW-1), never a second wording. It is sent after the slash-command line, per the Phase 0 send method in Scope 9.
6. *Launch state* (item (5), R4).
   - It is kept in its own local file in the directory `git rev-parse --git-common-dir` prints, so it is never tracked and is shared by all worktrees. This is the same convention as the tracker map.
   - A second run never starts a lane that is running or finished.
   - The launcher never writes the fan-out manifest; E447's `check --cut` byte comparison would stop the lane if it did.
7. *Paused lanes* (item (6) as amended by R3). The session never ends on a usage limit: it waits in its window. The launcher reads the window contents and matches line prefixes from the Phase 0 §4 table, kept in one constant to be re-checked on a CLI upgrade:
   - **Weekly limit with a reset more than 24 hours away** (the `You've hit your weekly limit` line with no `Continuing automatically at` line): the lane is marked paused, with no automatic wake.
   - **`Automatic continue stopped after repeated usage-limit hits`**: the lane is marked paused. When the integrator re-runs the launcher, the launcher wakes it by sending a new prompt in the same window. The wake text is needs-human-ruling Q3.
   - **The after-sleep `Press enter to continue`**: the launcher sends Enter itself (`write text ""`), and the lane stays running.
   - Any other usage-limit line leaves the lane running; this includes `Automatic continue cancelled`, which only a person in the window can cause.
   - Other lanes continue throughout.
8. *Window gone, lane not finished* (ruling 19 amendment).
   - Detection: the window id no longer exists and there is no finish signal. Phase 0 §5: `exists` = false and no exit marker.
   - The lane is never counted as finished. On the next run it is resumed in the same worktree under the crash-resume rules, in a new window with the same dispatch prompt, and with its model pins unchanged, because they live in the lane's handoff `dispatch_pins`.
   - What marks a lane "finished" is needs-human-ruling Q2.
9. *Phase 0 prerequisites and 結論 items as pre-checks.* Each is a refusal with a reason and a non-zero exit, unless it says otherwise:
   - **Trust.** The primary checkout must have its own trust entry in the host's trusted-folder list. Trust inherited from a parent folder does not reach worktrees.
   - **Host.** iTerm2 must be present. Only scheme A is supported; tmux (scheme B) was untested, and Phase 0 chose A.
   - **`autoContinueAtUsageLimit`.** It must not be set in the project or local settings of the primary checkout or the worktree. A project or local file that sets it turns the feature off.
   - **Fallback model chain.** No fallback model chain may be configured for the lane session. A configured chain conflicts with "never switch the role's model". The lane cites the host documentation for the setting name.
   - **Send method** (not a refusal). The slash command is never put in the CLI initial prompt. The launcher waits for readiness, then sends with iTerm2 `write text "<text>" newline NO` followed by `write text ""`.
   - **`Unknown command` retry** (not a refusal). When the window shows `Unknown command` after a send, the launcher resends; the bound on retries is decided at the lane cut.
   - **Permission mode** (not a refusal). Sessions start with the permission mode Phase 0 verified.
10. *Item (7) refusal.* The launcher refuses, names the reason and exits non-zero when the manifest has no `人類` Decisions row or `cutApprovalAutoTier.manifest` is not `true`. A lane that is not a batch lane under `docs/lane-protocol.md` §3 (its `approval` is `human`, or one of its tickets has no ticket file) is not started, and is listed with the reason. This is derived from item (7) and the batch-lane definition.
11. *`content/coord-03-core-fallback.md`* (amendment (4) as amended by R2). One line:
    - A usage-limit or rate-limit error is not tool unavailability, so the `tw_switch_role` fallback is not taken.
    - Do not end the session. Do not switch the role's model or run the role in-context.
    - After the session's automatic continue picks the task up, re-dispatch the cut-off subagent once with the same pin, through the Crash-Resume Protocol.
    - On a second failure: checkpoint, record the pause reason, stop.
    - A model change comes only from a human `dispatch_pins`.
    - The line adds no backtick-quoted gate code. It must not change the four `Task` alias sentences that `test/e408-core-task-alias-tail.test.mjs` pins.
12. *`content/skill-integrator.md`.*
    - Item (10): the integrator session owns re-running the launcher at two named moments. One is after each wave merges, to start the next wave. The other is after a usage limit resets, to resume paused lanes.
    - The Lifecycle and Stage 3/4 text say a launcher-started wave replaces the human opening sessions. A wave the launcher refuses stays hand-started exactly as today.
13. *`docs/lane-protocol.md`.* A launcher-started batch lane skips §1 step 1's worktree creation: the worktree exists, and it confirms location and branch, matching NEW-1's batch first step. §3 *批次 lane* names the launcher as how a batch lane is started.
14. *`CLAUDE.md`.* A Layout row for `tools/lane-launch.ts`; `test/e395-claude-md-tail.test.mjs` and `test/e436-stale-handoff-paths.test.mjs` pin `CLAUDE.md` rows and line numbers.

**Out of scope**
- The stop rule and the batch summary (E425).
- Any server change: the server runs no command (ruling 6 of section 11).
- The mailbox, merging, and tracker write-back.
- The per-lane account mapping (item (4), dropped by amendment (5)).
- tmux (scheme B).
- The statusline/`CronCreate` wake fallback of amendment (3). It is not needed: scheme A and automatic continue are confirmed by Phase 0.
- Background or `-p` sessions.
- Writing the fan-out manifest (R4).
- R5's observation of whether the main session re-dispatches after automatic continue with pins kept: it is recorded post-ship and is not acceptance.
- A real unattended start in tests. It was verified by hand in Phase 0; tests use the stand-in.

**Allowed paths**: the NEW-2 `touches` cell. `tools/join-precondition.ts` and its `dist/` files are only for the case where a ref parameter is needed. Re-pinned existing tests are added at the lane cut.

**Acceptance** (each automated with a stand-in session opener and stand-in window contents in place of a real session, unless it reads text)
- **A2-1** — Given a wave of four lanes and a limit of two, when the launcher runs, then at most two run at once and all four are started. *(original acceptance 1, item (2))*
- **A2-2** — Given no parallel-limit key and a wave of five lanes, when the launcher runs, then at most three run at once. *(item (2) default)*
- **A2-3** — Given a lane that depends on an unmerged lane, when the launcher runs, then it is not started and is listed as waiting with the lane it waits on. *(original 2, item (3))*
- **A2-4** — Given `"knowledge": "local"` and a depended-on lane that is merged but has not been through `agc feature finish --shipped`, when the launcher runs, then the dependent lane is listed as waiting and the reason names the missing finish. *(R4)*
- **A2-5** — Given lanes running or finished, when the launcher runs again, then none is started twice, and the launch-state file is untracked (`git status --porcelain` shows no new path). *(original 3, item (5), R4)*
- **A2-6** — Given any launcher run, when it ends, then the manifest's bytes are unchanged. *(R4)*
- **A2-7** — Given a lane whose window shows the weekly-limit signal with a reset more than 24 hours away, when the launcher polls, then that lane is marked paused, no wake is scheduled, and the other lanes continue. *(original 4 first half, R3)*
- **A2-8** — Given a lane whose window shows `Automatic continue stopped after repeated usage-limit hits`, when the launcher polls, then it is marked paused. When the launcher runs again, it sends a new prompt into the same window: no new session, and the pins are unchanged. *(original 4 second half, R3)*
- **A2-9** — Given a lane whose window shows `Press enter to continue`, when the launcher polls, then it sends Enter itself and the lane stays running. *(R3)*
- **A2-10** — Given a lane whose window was closed before it finished, when the launcher runs again, then that lane is resumed in the same worktree (no `agc feature start`, a new window, the same dispatch prompt and pins) and is not reported as finished. *(ruling 19 acceptance)*
- **A2-11** — Given a plan with no human Decisions row, or `cutApprovalAutoTier.manifest` not `true`, when the launcher runs, then it refuses, names the reason, exits non-zero and starts nothing. *(original 5, item (7), amendment (6))*
- **A2-12** — Given a manifest with no `波次` column, when the launcher runs, then it refuses, says why and exits non-zero. *(amendment (2))*
- **A2-13** — Given a lane whose `approval` is `human`, or whose ticket has no ticket file, when the launcher runs, then it is not started and is listed with the reason. *(derived: item (7) and the lane-protocol §3 batch-lane definition)*
- **A2-14** — Given a plan whose first wave is merged, when the launcher runs again, then the lanes of the next wave whose depended-on lanes are met are started. *(original 8; the meaning of "met" after branch deletion is Q1)*
- **A2-15** — Given a new lane, when the launcher starts it, then `agc feature start` runs once and the session opens in the new worktree. Given an existing worktree, then creation is skipped. *(amendment (1))*
- **A2-16** — Given a lane start, when the launcher sends text, then:
  - the CLI is launched with no initial prompt;
  - the slash-command line is followed by `render`'s batch output, byte-identical;
  - each send ends with an empty `write text`.

  *(item (1), Phase 0 send method)*
- **A2-17** — Given a window that shows `Unknown command` after a send, when the launcher checks, then it resends, up to the cut's bound. *(Phase 0 prerequisite)*
- **A2-18** — Given a primary checkout with no trust entry of its own (a stand-in host config), or no iTerm2 (a stand-in host probe), or project/local settings that set `autoContinueAtUsageLimit`, or a configured fallback model chain, when the launcher runs, then it refuses, names the cause (and the file or setting where one applies), exits non-zero and starts nothing. *(Phase 0 結論 items 4–5 and prerequisites)*
- **A2-19** — Given `content/skill-integrator.md`, when it is read, then it names the two moments the launcher is re-run. *(original 9, item (10))*
- **A2-20** — Given the composed coordinator SOP, when it is read, then the coord-03 line says a usage-limit or rate-limit dispatch error does not take the `tw_switch_role` fallback, does not end the session and does not switch the model. It also says the subagent is re-dispatched once with the same pin after automatic continue, and that a second failure checkpoints, records the pause reason and stops. *(amendment (4) acceptance as amended by R2)*
- **A2-21** — Given `docs/lane-protocol.md`, when it is read, then §1 says a launcher-started lane's worktree already exists (confirm location and branch), and §3 names the launcher. *(derived: amendment (1) consistency)*

**depends_on**: NEW-1. It needs the `波次`/`相依` columns and batch `render`.

**Test impact.** Not run: there is no diff. Candidates come from a literal grep at `46e974d`.
- **`content/coord-03-core-fallback.md` readers (25 files):**
  - `test/cut-approval-gate.test.mjs`
  - `test/e130-lane-default.test.mjs`
  - `test/e16-judge-dispatch-charter.test.mjs`
  - `test/e295-hop-cap-and-sop-halves.test.mjs`
  - `test/e296-manifest-tier.test.mjs`
  - `test/e297-main-protected-sop.test.mjs`
  - `test/e336-portable-pull.test.mjs`
  - `test/e350-fanout-call-form.test.mjs`
  - `test/e385-worktree-evidence.test.mjs`
  - `test/e391-prompt-audit-stale-facts.test.mjs`
  - `test/e393-builder-judge-core.test.mjs`
  - `test/e408-core-task-alias-tail.test.mjs`
  - `test/e416-filing-bar.test.mjs`
  - `test/e425-stop-ticket-batch.test.mjs`
  - `test/e438-origin-fenced-labels.test.mjs`
  - `test/e440-current-rule-wording.test.mjs`
  - `test/e447-served-text.test.mjs`
  - `test/e453-served-text-v5.test.mjs`
  - `test/e462-stale-comments-wording.test.mjs`
  - `test/e5-intake-tiering.test.mjs`
  - `test/e96-dispatch-preference.test.mjs`
  - `test/feature-lease.test.mjs`
  - `test/release-staging.test.mjs`
  - `test/skill-manifest.test.mjs`
  - `test/source-credibility-gate.test.mjs`
- **Golden and budget.** coord-03 is composed into `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, the only golden that holds it, and into the teamwork coordinator bundle cap in `test/context-budget.test.mjs`, which has zero headroom per its history comments. Both are re-captured after the last implementing task, the same way as the earlier waves.
- **`content/skill-integrator.md` readers:** the same 29 files as NEW-1.
- **`docs/lane-protocol.md` readers (30 files):**
  - `test/e130-lane-default.test.mjs`
  - `test/e177a-manifest.test.mjs`
  - `test/e177b-mailbox-watch.test.mjs`
  - `test/e178a-integrator-role.test.mjs`
  - `test/e226-integrator-sop-portable.test.mjs`
  - `test/e246-mailbox-teardown.test.mjs`
  - `test/e262-architect-hop-order.test.mjs`
  - `test/e286-integrator-trust-and-git.test.mjs`
  - `test/e289-config-key.test.mjs`
  - `test/e289-render-addendum.test.mjs`
  - `test/e290-lane-protocol-generic.test.mjs`
  - `test/e292-integrator-sop.test.mjs`
  - `test/e294-lane-enterworktree.test.mjs`
  - `test/e295-hop-cap-and-sop-halves.test.mjs`
  - `test/e296-manifest-tier.test.mjs`
  - `test/e329-integrator-sop-followups.test.mjs`
  - `test/e342-config-doc-wording.test.mjs`
  - `test/e343-render-pointer-guard.test.mjs`
  - `test/e349-integrator-repo-facts.test.mjs`
  - `test/e351-lane-protocol-gaps.test.mjs`
  - `test/e355-integrator-generic-wording.test.mjs`
  - `test/e383-lane-ledger-worktree.test.mjs`
  - `test/e385-worktree-evidence.test.mjs`
  - `test/e416-filing-bar.test.mjs`
  - `test/e425-stop-ticket-batch.test.mjs`
  - `test/e430-mailbox-outside-lane.test.mjs`
  - `test/e433-test-first-rules.test.mjs`
  - `test/e447-cut-reseed.test.mjs`
  - `test/e447-served-text.test.mjs`
  - `test/e453-served-text-v5.test.mjs`

  `test/e433-test-first-rules.test.mjs` pins line 37 by index.
- **`tools/config.ts` and `docs/config.md` readers:** 59 files match `tools/config` or `config.js`; 15 match `docs/config.md`, including `test/e289-config-key.test.mjs` and `test/e342-config-doc-wording.test.mjs`.
- **`tools/join-precondition.ts` readers:** `test/e115-join-precondition.test.mjs`, `test/e123b9-lane-flip.test.mjs`, `test/e132-lane-registry.test.mjs` and `test/e395-claude-md-tail.test.mjs`.
- **`CLAUDE.md` pins:** `test/e395-claude-md-tail.test.mjs` (AC-E395-4 pins the 11 contiguous rows after `tools/fanout-*.ts`) and `test/e436-stale-handoff-paths.test.mjs`.
- **New:** `test/e443b-*.test.mjs` and `test/fixtures/e443b/**`.
- **Plan:** architect hop expected (≥ 3 modules, new config key, a new cross-cutting script). Pre-split the sr work into at least 3 tasks: scheduling and state; window driving and pause detection; SOP and docs text.

## Where each E443 item went

| E443 item | Goes to | Acceptance |
|---|---|---|
| Phase 0 (four checks, host, usage limit) | done — `specs/e443-phase0-host-check.md` | — |
| Item (1) one prompt source | NEW-2 (relaxed by amendment (1)) | A2-16 |
| Item (2) parallel limit, default 3 | NEW-2 | A2-1, A2-2 |
| Item (3) unmerged dependency waits | NEW-2 (+ R4) | A2-3, A2-4, A2-14 |
| Item (4) per-lane account mapping | dropped by amendment (5) | original acceptance 6 dropped |
| Item (5) launch state | NEW-2 (+ R4 own local file) | A2-5, A2-6 |
| Item (6) paused on usage limit, resume | NEW-2 as amended by R3 | A2-7, A2-8, A2-9 |
| Item (7) refuse without approval basis | NEW-2 | A2-11, A2-13 |
| Item (8) stop-the-ticket closing line | NEW-1 | A1-9 |
| Item (9) summary and reading list from the ticket file | NEW-1 (mapping defined in NEW-1 scope 5) | A1-10 |
| Item (10) integrator re-runs the launcher | NEW-2 | A2-19 |
| Amendment (1) launcher runs `feature start`; batch first step | split: `feature start`/skip → NEW-2; render first step → NEW-1 | A2-15; A1-11 |
| Amendment (2) `波次`/`相依` columns, check, ancestry rule, refuse without `波次`, Stage 1 fill | split: columns, check and Stage 1 text → NEW-1; ancestry rule and refusal → NEW-2 | A1-1..A1-3, A1-8; A2-3, A2-12, A2-14 |
| Amendment (3) usage-limit Phase 0 and statusline/`CronCreate` fallback | Phase 0 done (2026-11-26, documented answers); fallback not built (out of scope, NEW-2); remaining re-dispatch observation → R5 post-ship | — |
| Amendment (4) coord-03 line | NEW-2 as amended by R2 | A2-20 |
| Amendment (5) drop item (4) | applied | — |
| Amendment (6) "identical to the output before this ticket"; batch approval = `cutApprovalAutoTier.manifest`; item (9) mapping at the cut | NEW-1; NEW-2; NEW-1 | A1-12; A2-11; A1-10 |
| Amendment test impact (render pins, counts) | split per ticket's Test impact | — |
| Ruling 16 amendment (comparison, Decisions row, SOP rule) | NEW-1 | A1-4..A1-8 |
| Ruling 19 amendment (scheme A, window gone) | NEW-2; scheme B not built (Phase 0 chose A) | A2-10, A2-18 (iTerm2) |
| Phase 0 結論: weekly limit does not wait | NEW-2 (R3) | A2-7 |
| Phase 0 結論: stop after three continuations, detection and wake | NEW-2 (R3) | A2-8 |
| Phase 0 結論: sleep over 30 min needs Enter | NEW-2 (R3) | A2-9 |
| Phase 0 結論: no fallback model chain | NEW-2 pre-check | A2-18 |
| Phase 0 結論: no `autoContinueAtUsageLimit` in project/local settings | NEW-2 pre-check | A2-18 |
| Prerequisite: primary's own trust entry | NEW-2 pre-check | A2-18 |
| Prerequisite: no slash command in the CLI initial prompt; `write text` then `write text ""` | NEW-2 | A2-16 |
| Prerequisite: retry on `Unknown command` | NEW-2 | A2-17 |
| Prerequisite: iTerm2 only, tmux untested | NEW-2 | A2-18 |
| Original acceptance 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 | A2-1 / A2-3 / A2-5 / A2-7+A2-8 (+A2-10) / A2-11 / dropped / A1-9+A1-10+A1-12 / A2-14 / A2-19 | — |

## Corrections to the E443 row found at the cut
- The row says a paragraph in `content/skill-integrator.md` "moves its compose golden and the `test/context-budget.test.mjs` cap". At `46e974d` that file is in no compose golden and has no cap. The golden and cap that move belong to `content/coord-03-core-fallback.md` (NEW-2).
- The recounts at `46e974d` are higher than the row's figures:
  - `content/skill-integrator.md` readers: 29 (the row says 22);
  - `docs/lane-protocol.md` readers: 30 (the row says 24);
  - fan-out manifests under `specs/`: 56 (the row says 41).
- Two new paths that the row's file list lacks:
  - `docs/config.md`, which needs the new key;
  - `CLAUDE.md`, which needs the `tools/lane-launch.ts` Layout row.

## needs human ruling

**Q1 — What "dependency met" means once the depended-on lane's branch is gone (NEW-2).** Ruling 13 tests "the depended-on lane's branch is an ancestor of the integration branch". But Stage 6 `agc feature finish` deletes the lane branch, and the integration branch is deleted after its pull request merges. Under `"knowledge": "local"`, R4 also requires finish (and so the deletion) before a dependent lane may start.

*Example:* wave 1 lane `e900`, and wave 2 lane `e901` with `相依` = `e900`.
1. The integrator merges `e900` into `integ/x`.
2. It runs finish, which deletes `feat/e900-…`.
3. The pull request merges and `integ/x` is deleted.
4. It re-runs the launcher.
5. `checkLaneAncestry` gets an unknown ref and returns `error`, so `e901` waits forever.

*Options:*
- **(a)** Re-run the launcher between Stage 5b and Stage 6, so the branch and `integ/x` still exist and wave 2 starts from `integ/x`. This cannot work under `"knowledge": "local"`, because R4 needs finish first.
- **(b)** "Met" when **either** the branch exists and is an ancestor of the ref the dependent lane starts from, **or** the branch is gone and the primary checkout holds finish's record `.current/history/<YYYY-MM>/<lane>/` (finish runs only after the merge into its `--base`). Under `"knowledge": "local"`, only the second test counts. A lane of wave > 1 starts from `main` after the wave's pull request merged, and wave 1 from the manifest's `base:`.

*Recommended:* **(b)**.

**Q2 — What marks a lane "finished", and how long the launcher runs (NEW-2).** Item (2) says queued lanes "start as others end", and item (5) says a finished lane is never restarted. Phase 0 found that a lane session never exits by itself, so the launcher needs an end signal.

*Example:* limit 2, lanes `e1`..`e4`. `e1` sends its final `type: report` at 14:00.
- With **(a)**, the launcher stays running (started by the integrator as a watched background process) and polls until every lane of the wave is finished or paused, then exits. It sees `e1`'s report and starts `e3` at 14:00.
- With **(b)**, each run makes a single pass. `e3` waits until the integrator re-runs the launcher.

For the signal itself: the lane's `type: report` in its mailbox ends the lane for slot accounting, both for a finished lane (§6 report) and for a stopped lane (§3 batch stop report). The launcher leaves the window open and sends no `/exit`, so the integrator can still send work back.

*Recommended:* **(a)**, with the mailbox `type: report` as the finished signal.

**Q3 — What text wakes a paused live session (NEW-2, R3 "sending a new prompt in the same window").**

*Example:* `e2` shows `Automatic continue stopped after repeated usage-limit hits` at 03:00, and the integrator re-runs the launcher at 09:00.

*Options:*
- **(a)** Resend `render`'s full batch output. That literally keeps item (1)'s single wording, but it re-briefs a session that already holds the brief.
- **(b)** Send one fixed line, defined once in `tools/lane-launch.ts`. Proposed: `額度已恢復：先 tw_get_state，照 Crash-Resume 流程核對後從中斷處接續。` Item (1) governs the dispatch prompt, not a wake line. A new window (window gone) still gets the full `render` output, as A2-10 says.

*Recommended:* **(b)**.

**Q4 — Where the auto Decisions row is "listed in the batch summary" (NEW-1).** Ruling 16 says the `整合者` `自動：只改順序或分組` row is listed in the batch summary. The E443 row puts the batch summary (E425's `scripts/batch-summary.mjs`, which reads only ticket files) out of scope.

*Example:* a wave's manifest moves lane `e902` from wave 1 to wave 2 and gets the auto row. With **(a)**, the integrator's final report prints that row beside the `batch-summary.mjs` output: SOP text only, in NEW-1, with no script change. With **(b)**, `batch-summary.mjs` learns to read the manifest's Decisions table and prints the row itself: a script change that NEW-1's allowed paths would gain.

*Recommended:* **(a)**.
