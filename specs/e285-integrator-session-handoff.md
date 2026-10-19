# e285-integrator-session-handoff

Lane e285 of the post-v4 wave 7 fan-out (`specs/fanout-post-v4-w7.md`). Tickets E285 (integrator revision wave 3: §3.1 Q1, Q2, Q4, Q6; §3.2; §4 P1, P3, P4, O9, O11 of `docs/integrator-revision-2026-10-08.md`), E294 (the lane-protocol §1 half of §4 O12; the spike is done) and E336 (portable `git pull --ff-only`, human ruling (a) in the manifest Decisions, 2026-10-19). Scope is the manifest's e285 row; it is not widened or narrowed here.

## Problem Statement

Three gaps, one content lane. (1) E285: the integrator SOP (`content/skill-integrator.md`) has no session rhythm. At wave close the handoff (`## 接手步驟`) is only a validate-time format rule, not a step that always runs; the final report (Stage 6 step 7) ends with a "next-step recommendation" that invites proposing the next wave in the same, already long session; there is no way for a fresh session to take over a wave from its handoff; the mailbox watch re-arms forever while every lane waits on an absent human (one wave re-armed about 25 times in 16 hours); a full suite may still run in the integrator's own context (one wave ran 10 there); and nothing tells the human that a session already holding another role's work is a poor host for the integrator. (2) E294: `docs/lane-protocol.md` §1 makes every lane prefix each command with `cd <worktree> &&` because the harness resets the shell to primary after every call; one miss runs on primary. The 2026-10-14 spike proved `EnterWorktree(path=<worktree>)` switches a lane session into a worktree outside the repo directory, after which resets return to the worktree, and found that the isolated session's git guard refuses `git -C <primary> …` and any compound command containing git. (3) E336: with `pull.rebase=true` in a user-level git config, `git pull --ff-only` refuses to run while `.current/` has uncommitted files (the normal state after a release); the SOPs name the plain form at 12 sites across four content files.

## User Stories

- As the human, I want the integrator to always write the handoff at wave close and then hand me a list of decisions plus a recommendation to start a new session, so that the next wave starts in a clean context and nothing depends on the old conversation.
- As a new integrator session, I want a `接手 <manifest>` mode that checks the handoff against the repo before I act, so that I never continue from a stale or wrong handoff.
- As the human who stepped away, I want the watch to stop after two idle hours with its re-arm baseline recorded, so that no session spins for hours and no mail is missed when the watch resumes.
- As the integrator, I want every local full suite to run in a read-only verifier, and repeated tables shown as differences, so that my context stays available for coordination.
- As a lane session, I want §1 to tell me to switch into my worktree with `EnterWorktree`, confirm where I am, and issue git one plain command per call, so that a forgotten `cd` can no longer run a command on primary.
- As any role syncing `main`, I want a pull command that works regardless of my user-level `pull.rebase` setting, so that the SOP step does not refuse after a release.

## Acceptance Criteria

Section extracts below use `sec() { awk -v h="$1" 'index($0,h)==1{f=1;print;next} f&&/^##/{exit} f' "$2"; }` (prints from the heading line up to the next heading of any level) and `need() { s=$(sec "$1" "$2"); shift 2; for p in "$@"; do printf '%s' "$s" | grep -qF -- "$p" || echo "missing: $p"; done; }` (prints one line per fixed string absent from the extract). `B` = `$(cat .current/e285/base-sha)` (the dispatch base). Proofs that diff against `B` are qa review-time commands, never resident test assertions (lane-protocol §3; manifest common scope).

### E285 — integrator SOP (`content/skill-integrator.md`)

- **AC-E285-1 (P1, the close handoff is always written)** — Given Stage 6 step 1, when it is read, then a new sub-bullet directly after the *Close the manifest* sub-bullet (which stays byte-identical) says: at every wave close the integrator writes the manifest's `## 接手步驟` — `node scripts/fanout.mjs handoff <manifest> --closing` on the integration branch prints the section with every fact filled; the integrator fills each `<待填：…>` (the `### 待人類決定` items are the pending human decisions, never a next-wave plan) and commits it in the bookkeeping commit; this step is not overridable — it runs even when the human asks to skip it or to go straight to the next wave.
  proof: `need '## Stage 6' content/skill-integrator.md 'handoff <manifest> --closing' '待人類決定' 'not overridable'` prints nothing.
- **AC-E285-2 (P1, final report and "continue")** — Given Stage 6 step 7, when it is read, then it no longer says "next-step recommendation"; it lists the merge commit sha and pull request number, lanes torn down, tickets opened, roll-up numbers, that the handoff is written, the pending human decisions (the handoff's `### 待人類決定` items, including whether to release and whether to open another wave) and a recommendation to start a new session; it says the integrator never proposes the next wave (no next-wave plan, no offer to start one); and it says the human may instead say continue in this same session, in which case the integrator first runs `node scripts/fanout.mjs handoff --check <manifest>` and continues only on exit 0 — exit 1 or 2 means list the mismatches and stop.
  proof: `grep -c 'next-step recommendation' content/skill-integrator.md` prints `0`; `need '## Stage 6' content/skill-integrator.md 'new session' 'handoff --check <manifest>' 'never proposes the next wave' 'continue'` prints nothing.
- **AC-E285-3 (P3, fourth chat mode `接手 <manifest>`)** — Given the *Lifecycle* section's `Invocation:` paragraph, when it is read, then it names four modes — `fan-out <feature or wave>` (stages 0–3), `fan-in` (stages 4–6), `status` (read-only) and `接手 <manifest>` (take over a wave from its handoff); and a new section `## Take-over (\`接手 <manifest>\`)`, placed directly before `## Status (any time)`, says in order: (1) read the manifest's `## 接手步驟` section and its Decisions table; (2) run `node scripts/fanout.mjs handoff --check <manifest>` (`MOVED` lines are expected after a merged pull request and still exit 0); (3) exit 1 (any `DIFF`) or exit 2 (no section, unreadable manifest, git error) → list every mismatching fact and stop, report to the human, never edit the handoff to make it match and never act on it; (4) only on exit 0 continue from the handoff — when lanes are still open, re-arm the mailbox watch from the handoff's `watch baseline` line, never from the current count. The *Work overview* table gains one row for the mode. Mail that arrived after a watch-stop handoff shows as a `DIFF` and still stops the take-over; the human then says continue (manifest ruling: stop on any mismatch).
  proof: `grep -c '`接手 <manifest>`' content/skill-integrator.md` prints at least `3`; `need '## Take-over' content/skill-integrator.md '## 接手步驟' 'Decisions' 'handoff --check <manifest>' 'MOVED' 'DIFF' 'watch baseline' 'stop'` prints nothing; `grep -n '^## Take-over\|^## Status (any time)' content/skill-integrator.md` prints the Take-over line immediately before the Status line (no other `## ` heading between).
- **AC-E285-4 (O9, two-hour idle stop)** — Given the Stage 4 *Watch* bullet (or a sub-bullet under it), when it is read, then it says: at an `expiring — re-arm` line, when both the last new mail and the last lane state change (a `lane-status.mjs --watch` transition) are 2 hours old or more, do not re-arm — stop both watches; the exception is a lane still working without needing the human (keep watching). Before stopping: handle all mail, run `node scripts/fanout.mjs handoff <manifest>`, and write the printed section into the manifest as its only `## 接手步驟` section (replace an earlier one, never add a second), left uncommitted on primary (the tool already leaves the manifest out of its `git status` fact; the close handoff replaces it in the bookkeeping commit); tell the human the watch stopped and why. Resuming — the human says so in this session, or a `接手 <manifest>` session takes over — re-arms from that section's `watch baseline` line, never the current count. The pinned `re-arm from the printed baseline, always` stays.
  proof: `need '## Stage 4' content/skill-integrator.md '2 hours' 'expiring — re-arm' 'lane-status.mjs --watch' 'handoff <manifest>' 'watch baseline' 'without needing the human'` prints nothing; `grep -c 're-arm from the printed baseline, always' content/skill-integrator.md` prints `1`.
- **AC-E285-5 (P4, every local full suite in the verifier; repeated tables as differences)** — Given Stage 5a *Verifier dispatch* and the *Your own commits* paragraph, when they are read, then they say every local full-suite run — the lane layer or the integration layer under the *CI fallback*, and the integrator's own pre-push runs — MUST run inside the fresh-context generic read-only verifier, never in the integrator's own context (the per-report claim checks may still be done by the verifier optionally); and the *Output* section gains one bullet, above the final watermark bullet, saying a table already shown in this session (roll-up, lane status, verification) is shown again only as its differences from the earlier copy.
  proof: `need '### 5a' content/skill-integrator.md 'MUST' 'pre-push' 'never in your own context'` prints nothing; `need '## Output' content/skill-integrator.md 'differences'` prints nothing; `tail -n 1 content/skill-integrator.md` still ends with `(no tier: an MCP-prompt invocation is not Task-spawned, Constitution §1).`
- **AC-E285-6 (O11, advisory new-session check)** — Given the `Invocation:` paragraph, when it is read, then it says that before any stage, if this conversation already holds another role's work (a coordinator chain, a lane hop, a release), the integrator recommends the human open a new session for it — advisory only; it continues when the human says so.
  proof: `need '## Lifecycle' content/skill-integrator.md "another role's work" 'new session' 'advisory'` prints nothing.
- **AC-E285-7 (command shapes match the shipped script)** — Given the whole SOP, when every `fanout.mjs handoff` mention is listed, then each one matches the dispatch-base usage `handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]`, and `--closing` never appears together with `--check`.
  proof: `grep -o 'fanout.mjs handoff[^`]*' content/skill-integrator.md | sort -u` prints only lines among `fanout.mjs handoff <manifest>`, `fanout.mjs handoff <manifest> --closing`, `fanout.mjs handoff --check <manifest>`; `node scripts/fanout.mjs 2>&1 | grep -c 'handoff \[--check\] <manifest>'` prints `1`.

### E294 — lane protocol §1 (`docs/lane-protocol.md`)

- **AC-E294-1 (switch in and confirm)** — Given §1, when it is read, then after `feature start` succeeds the lane calls `EnterWorktree` with `path` set to its worktree to switch the session into it, then confirms — each as its own plain call — that `pwd` prints the worktree and `git branch --show-current` prints the dispatched branch, before any other step; a mismatch → stop and report (no `tw_*` call yet). It also says that after the switch the harness resets return to the worktree, so the per-command `cd` is no longer needed.
  proof: `need '## 1.' docs/lane-protocol.md 'EnterWorktree' 'path' 'feature start' 'pwd' 'git branch --show-current'` prints nothing.
- **AC-E294-2 (fallback)** — Given §1, when it is read, then it says that when `EnterWorktree` is unavailable (the host is not Claude Code, or the tool refuses), the existing rule applies: every file-creating or file-changing bash call carries `cd <worktree> &&` or uses absolute paths; the temp-file rule (`$TMPDIR` or scratchpad, never the repo root) and the mailbox-by-absolute-path rule stand either way.
  proof: `need '## 1.' docs/lane-protocol.md 'cd <worktree> &&' '$TMPDIR'` prints nothing, and `sec '## 1.' docs/lane-protocol.md | grep 'EnterWorktree' | grep -c 'cd <worktree>'` prints at least `1` (the fallback is tied to the tool by name).
- **AC-E294-3 (spike finding: git guard)** — Given §1, when it is read, then it says the worktree-isolated session's git guard refuses `git -C <primary> …` and any compound command containing git (for example `a && git b`, `git a; b`), so git is issued one plain command per call.
  proof: `need '## 1.' docs/lane-protocol.md 'git -C <primary>' '一條一條'` prints nothing.
- **AC-E294-4 (§1 only)** — Given the lane branch, when `docs/lane-protocol.md` is compared with the dispatch base, then everything from the `## 2.` heading to the end of the file, and everything above the `## 1.` heading, is byte-identical.
  proof: `diff <(git show "$B":docs/lane-protocol.md | sed -n '/^## 2\./,$p') <(sed -n '/^## 2\./,$p' docs/lane-protocol.md)` and `diff <(git show "$B":docs/lane-protocol.md | sed -n '1,/^## 1\./p') <(sed -n '1,/^## 1\./p' docs/lane-protocol.md)` both print nothing.
- **AC-E294-5 (cross-lane AC7 safety with E289's template line)** — Given the new or changed §1 lines, when each is trimmed, then every one longer than 20 characters is at least 60 characters long and carries a lane-protocol-only clause (the confirmation, the fallback or the guard finding), no added code-fence line is longer than 20 characters (so no stand-alone `EnterWorktree(path=<worktree>)` line), and none is a substring of the current `PROMPT_TEMPLATE_3B`; `test/e177a-manifest.test.mjs` passes unchanged. The lane report quotes the added §1 lines so the integrator can check them against E289's new template line before the integration-layer CI re-runs AC7.
  proof: `node --test --test-name-pattern 'AC7' test/e177a-manifest.test.mjs` passes; `git diff "$B" -- docs/lane-protocol.md | grep '^+[^+]' | sed 's/^+//; s/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'length($0)>20 && length($0)<60'` prints nothing (awk counts bytes; every CJK character is 3 bytes, so the bound is conservative).

### E336 — portable pull (four content files)

- **AC-E336-1 (every command site)** — Given `content/const-15-core-tail.md`, `content/coord-03-core-fallback.md`, `content/skill-integrator.md` and `content/skill-release-engineer.md`, when they are read, then the string `git pull --ff-only` occurs 0 times in each, and `git -c pull.rebase=false pull --ff-only` occurs 1, 1, 4 and 6 times respectively (the 12 sites at the dispatch base). The two bare grant-name mentions in `content/skill-integrator.md` (the *Permissions* row "`pull --ff-only` on `main`" and *Git operations* "followed by `pull --ff-only` (6-5)") name the granted operation, not a command to type, and stay as they are (ruling R3).
  proof: `grep -c 'git pull --ff-only' content/const-15-core-tail.md content/coord-03-core-fallback.md content/skill-integrator.md content/skill-release-engineer.md` prints `:0` for all four; `grep -o 'git -c pull.rebase=false pull --ff-only' <file> | wc -l` prints `1`, `1`, `4`, `6`.
- **AC-E336-2 (nothing else changes in the three borrowed files)** — Given the lane branch, when `content/const-15-core-tail.md`, `content/coord-03-core-fallback.md` and `content/skill-release-engineer.md` are compared with the dispatch base after applying the substitution to the base, then they are byte-identical — the §6 grant list wording, its namespaces and its FORBIDDEN list change only in the command form.
  proof: for each `F` of the three, `diff <(git show "$B":"$F" | sed 's/git pull --ff-only/git -c pull.rebase=false pull --ff-only/g') "$F"` prints nothing.
- **AC-E336-3 (the reason is written once, in the integrator SOP)** — Given the *Git operations* section of `content/skill-integrator.md`, when it is read, then one clause says why the `-c pull.rebase=false` override is there: a user-level `pull.rebase` setting otherwise makes `pull --ff-only` refuse while `.current/` has uncommitted files. No reason clause is added to the three borrowed files (ownership "只限 E336 那一句"; budgets).
  proof: `need '## Git operations' content/skill-integrator.md 'pull.rebase' '.current/'` prints nothing.
- **AC-E336-4 (re-pins and generated artifacts; qa-owned)** — Given AC-E336-1, when qa runs the suite, then `test/e297-main-protected-sop.test.mjs` AC1 (Stage 6 pattern) and AC7 (the const-15 pinned sentence) are re-pinned to the new command form with unchanged meaning; the compose goldens under `test/fixtures/compose-golden/` are regenerated (each hunk is exactly the command-form substitution); and every `test/context-budget.test.mjs` cap the added characters push over is re-measured to its exact new size (zero headroom, the file's cap rule), each change explained in the evidence file.
  proof: `node --test test/e297-main-protected-sop.test.mjs test/context-budget.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/skill-manifest.test.mjs` passes; `git diff "$B" -- test/fixtures/compose-golden | grep '^[-+][^-+]' | sed 's/git -c pull.rebase=false pull --ff-only/git pull --ff-only/' | sort | uniq -u` prints nothing.

### Hard constraints (whole lane)

- **AC-HC-1 (not-owned tests stay green unchanged)** — `test/e296-manifest-tier.test.mjs` and `test/e177a-manifest.test.mjs` pass and are unchanged on the lane branch: the lane-protocol §5-2 sentences e296 pins (`check --cut`, `信箱**永遠不傳核准**` once, the no-push line once) and the skill-integrator Stage 2 sentence (`approval`, `human`) are untouched; Stage 6 step 4 keeps one `verify-release.mjs --ci-check --sha <HEAD>` line, `cannot reach \`main\`` stays exactly once in the file, and step 5 still starts `5. \`git switch main\``.
  proof: `git diff --quiet "$B" -- test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs; echo "exit=$?"` prints `exit=0`; `node --test test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs` passes.
- **AC-HC-2 (pinned sentences)** — Sentences pinned by `test/e246-mailbox-teardown.test.mjs` (`stop the mailbox watch`, mailbox reset / finish fragments, lane-protocol mailbox lifecycle) are kept, or re-pinned in the same change with unchanged meaning; `test/e178a-integrator-role.test.mjs` AC15 (the provenance comment above `PROMPT_TEMPLATE_3B`) is not touched; `test/e288-integrator-stage0.test.mjs`'s `` `fan-out <feature or wave>` (stages 0–3) `` and the `Invocation:` line start are kept; `test/e329-integrator-sop-followups.test.mjs`'s *Close the manifest* literal stays byte-identical.
  proof: `node --test test/e178a-integrator-role.test.mjs test/e246-mailbox-teardown.test.mjs test/e288-integrator-stage0.test.mjs test/e329-integrator-sop-followups.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs` passes; `git diff "$B" -- test/e178a-integrator-role.test.mjs | grep -c 'AC15'` prints `0`.
- **AC-HC-3 (owned files only)** — Every changed path is in the manifest's e285 `擁有` cell.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e285 --base main` exits 0.
- **AC-HC-4 (full suite; qa-owned)** — Given all ACs above, when qa writes the new tests (Test placement below), re-pins every owned test the new wording turns red (each explained), and runs the full suite, then it is green on the final committed HEAD with a clean tree.
  proof: `node scripts/test-lock.mjs -- npm test` passes at the final HEAD with `git status --porcelain` empty.

## Rulings (PM, recorded for pre-review and cut approval)

### R1 — the watch-stop handoff is written into the manifest and left uncommitted on primary
O9 says to record the re-arm baselines "in the handoff". The revision (§8) writes a handoff at exactly two moments: wave close and watch stop. Writing it is cheap: `node scripts/fanout.mjs handoff <manifest>` already emits a `watch baseline` fact in the exact re-arm command shape, and its `git status` fact deliberately excludes the manifest file ("pasting the section always dirties it", E284 spec), so `handoff --check` stays meaningful with the section uncommitted on primary. Committing it mid-wave would mean a `docs/` branch, a pull request and a CI wait per watch stop, which is the cost §8 cited for deferring mid-wave handoffs (E293). The closing handoff replaces it in the bookkeeping commit (validate allows exactly one section). Alternative, if pre-review prefers: commit each watch-stop handoff under *Your own commits* — a wording change in AC-E285-4 only, same files.

### R2 — `接手` stops on any mismatch, including mail that arrived after a watch stop
The revision rules "全部一致才回答" and "列出不一致的項目，停下來回報". After a watch stop, new lane mail changes the `信箱` / `watch baseline` facts, so a take-over stops even in that expected case. The SOP keeps the strict rule (one human "continue" is cheap; a silent exception is not) and says that case is expected, so the human is not alarmed.

### R3 — E336 site set
"Every `git pull --ff-only` site" = every occurrence of that command literal: 1 in const-15, 1 in coord-03, 4 in skill-integrator, 6 in skill-release-engineer (5 lines; line 268 has two, one a back-reference "after 13a's `git pull --ff-only`"). The two bare `pull --ff-only` mentions in skill-integrator name the granted operation (as §6's grant sentences name `merge --no-ff` without a full command) and stay. For skill-release-engineer, whose ownership reads "只限 E336 那一句", this cut reads "E336 那一句" as every sentence carrying the command — the backlog row says "apply it at every site", and changing 1 of 6 would leave the release SOP with two forms of one step. Flagged for pre-review (Gate Summary G1); AC-E336-2 bounds the change to the substitution alone.

### R4 — keep pinned sentences where cheap
P4 adds a MUST sentence for full suites rather than rewriting the pinned E192 sentence `you MAY dispatch a fresh-context **generic read-only** subagent (no dedicated template)` (still true for the per-report claim checks), and P1 adds a sub-bullet after the e329-pinned *Close the manifest* literal instead of editing it. sr may still reword a pinned sentence when the result reads better; qa then re-pins with the reason in evidence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e336.pull | `git -c pull.rebase=false pull --ff-only` | manifest Decisions 2026-10-19, human ruling (a) |
| e285.mode | `接手 <manifest>` | revision §3.1 Q4 / §4 P3 |
| e285.section | `## Take-over (\`接手 <manifest>\`)` | authored-here — English section heading matching the SOP's other headings, carrying the mode name the human types |
| e285.idle | `2 hours` | revision §3.1 Q6 |
| e285.handoff-closing | `node scripts/fanout.mjs handoff <manifest> --closing` | `scripts/fanout.mjs` usage at the dispatch base |
| e285.handoff-check | `node scripts/fanout.mjs handoff --check <manifest>` | `scripts/fanout.mjs` usage at the dispatch base |
| e285.handoff | `node scripts/fanout.mjs handoff <manifest>` | `scripts/fanout.mjs` usage at the dispatch base |
| e294.tool | `EnterWorktree` (parameter `path`) | backlog E294 spike; revision §4 O12 |
| e294.confirm | `pwd`, `git branch --show-current` | authored-here — the two plain read-only commands that show directory and branch, each a single call the git guard accepts |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The prompt-template `EnterWorktree` line and any `tools/**` / `scripts/**` change (E289, lane e289); the E289 handoff placeholder wording in `tools/fanout-handoff.ts`.
- Generic lane-protocol rewrite and the repo addendum (E290); sister repos (E292); mid-wave handoffs at milestones other than a watch stop (E293, deferred).
- lane-protocol §2–§7, and the coordinator's own *Lane-start default* paragraph in `content/coord-03-core-fallback.md` (still the `cd <worktree> &&` rule; only the E336 sentence of that file is owned here).
- The spike's second finding (a plain `cd <primary>` followed by a non-git command still runs on primary; E205's detector stays relevant) — not required by the manifest row.
- Reason clauses for E336 in the three borrowed files (AC-E336-3); any change to the §6 base list or grant beyond the command form.
- Release bookkeeping (backlog done-marks for E285, E294, E336; queue DONE): the integrator at 5c.

## Dependencies / Prerequisites

- Inputs read in full: `docs/lane-protocol.md`; the manifest's 派工前核對, 所有 lane 共通的範圍, the e285 Lanes row and Decisions; backlog rows E285, E294, E336; revision §2, §3.1, §3.2, §4 (P1, P3, P4, O9, O11, O12), §5, §7.2, §8; `content/skill-integrator.md`; the E336 sites in the four content files; `scripts/fanout.mjs` usage and `tools/fanout-handoff.ts` (flags; `--closing` invalid with `--check`; exit 0/1/2; `MOVED` vs `DIFF`; the manifest left out of the `git status` fact; the `watch baseline` fact shape); `PROMPT_TEMPLATE_3B`; the owned and not-owned tests listed below.
- Resource Audit Gate: zero external references (inputs cite only tracked repo paths and backlog ids); `external_refs` omitted.
- Question Batch Gate: zero clarifications to the human beyond the pre-review items in the Gate Summary; PM rulings R1–R4 above.
- `.current/.config.json` `cutApprovalAutoTier` is `{}` (no manifest tier): the cut is approved by the human in this lane session after the integrator's pre-review.
- No design file; visual arm inactive; Visual Structural Assertions omitted (mode = no-design).
- Dispatch pin in effect: `sr-engineer=opus` (manifest *Dispatch pins*).
- Context budget: `content/skill-integrator.md` has no cap. `content/const-15-core-tail.md` sits in the composed constitution, whose caps in `test/context-budget.test.mjs` are zero-headroom (lean always-on 5717, stripped 10518, non-design 8420 ~tok); `content/coord-03-core-fallback.md` sits in the teamwork bundle (21623 ~tok, zero headroom). E336 adds 22 characters per site (about 6 ~tok in each affected bundle), so those caps re-baseline (AC-E336-4). `content/skill-release-engineer.md` has no cap test. Goldens touched: the constitution and coordinator compose outputs.

### Owned tests that read the changed text (grep at cut time)

| test | what it reads | expected effect |
|---|---|---|
| `test/e297-main-protected-sop.test.mjs` | AC1 Stage 6 includes `git pull --ff-only`; AC7 const-15 pinned sentence `` `git pull --ff-only` on `main` is on the base list as read-plus-ff `` | red → re-pin both to the new form (AC-E336-4) |
| `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**` | composed constitution and coordinator bundle | re-baseline / regenerate (AC-E336-4) |
| `test/e178a-integrator-role.test.mjs` | SOP pins incl. AC13 `you MAY dispatch …`, `re-arm from the printed baseline, always`, the final watermark line; const-15 grant sentences (AC6) | green if R4 holds; AC15 untouched |
| `test/e329-integrator-sop-followups.test.mjs` | Stage 6 *Close the manifest* literal (whole line), handoff sub-item names | green if the new P1 text is a separate sub-bullet (R4) |
| `test/e288-integrator-stage0.test.mjs` | Lifecycle up to `Invocation:`, `` `fan-out <feature or wave>` (stages 0–3) `` | green if kept |
| `test/e246-mailbox-teardown.test.mjs` | `stop the mailbox watch`, reset / finish fragments, lane-protocol mailbox lifecycle | green (untouched) |
| `test/e295-hop-cap-and-sop-halves.test.mjs`, `test/e286-integrator-trust-and-git.test.mjs` | 5a verifier brief and five constraints; `cannot reach \`main\`` once; Mid-wave base fix; lane-protocol §7 | green if kept |
| `test/e130-lane-default.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/render-structure.test.mjs` | coord-03 *Lane-start default* (not edited); skill count; release-engineer render | no effect expected; re-pin only if red |
| not owned: `test/e296-manifest-tier.test.mjs`, `test/e177a-manifest.test.mjs` | lane-protocol §5-2, Stage 2, Stage 6 step 4 range; AC7 lane-protocol lines vs rendered prompt | must stay green unchanged (AC-HC-1) |

### Test placement (qa)

- New `test/e285-integrator-session-handoff.test.mjs`: AC-E285-1 … AC-E285-7 as section-scoped content assertions (no line numbers, no historical sha, no assertion on real `specs/fanout-*.md` content); AC-E285-7 may read `scripts/fanout.mjs` usage text.
- New `test/e294-lane-enterworktree.test.mjs`: AC-E294-1 … AC-E294-3 on the `## 1.` slice, and AC-E294-5's structural half (every §1 line naming `EnterWorktree` is at least 60 characters and is not a substring of `PROMPT_TEMPLATE_3B`). AC-E294-4 stays a review-time command.
- New `test/e336-portable-pull.test.mjs`: AC-E336-1 counts and AC-E336-3. AC-E336-2 stays a review-time command.
- Re-pins: `test/e297-main-protected-sop.test.mjs` (AC1, AC7), `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`; any other owned test only if it turns red.

### AC → implementing task

AC-E285-1 … AC-E285-7 → T-E285-01; AC-E294-1 … AC-E294-5 → T-E294-01; AC-E336-1, AC-E336-2, AC-E336-3 → T-E336-01; AC-HC-1, AC-HC-2, AC-HC-3 → wording constraints on T-E336-01, T-E294-01, T-E285-01, verified by the qa tasks; AC-E336-4 → T-E336-02 (qa-only by nature: re-pins and generated artifacts); AC-HC-4 → T-E285-02 (the last qa task runs the single final full suite, cited by all three qa evidence files).

## Gate Summary

| item | kind | detail |
|---|---|---|
| G1 | scope-boundary question for integrator pre-review | `content/skill-release-engineer.md` ownership reads "只限 E336 那一句" but the file carries 6 occurrences on 5 lines. PM reads "那一句" as every sentence carrying the command (R3; backlog "apply it at every site"); AC-E336-2 proves nothing else changes. If the integrator reads it as a single sentence, the manifest row needs a ruling, not this cut. |
| G2 | PM option choice (R1) | watch-stop handoff left uncommitted on primary vs committed under *Your own commits*; PM picks uncommitted. |
| G3 | PM option choice (R3) | the two bare grant-name `pull --ff-only` mentions in the integrator SOP stay. |
| G4 | cross-lane note for the integrator | §1's new lines are quoted in the lane report so E289's template line can be checked against them (AC-E294-5); the integration-layer CI re-runs e177a AC7. |
| — | needs human ruling | none beyond the cut approval itself |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E336-01 | sr: replace every `git pull --ff-only` command literal with `git -c pull.rebase=false pull --ff-only` (12 sites: const-15 1, coord-03 1, integrator 4, release-engineer 6); nothing else in the three borrowed files; one reason clause in the integrator *Git operations* section (AC-E336-1, AC-E336-2, AC-E336-3; AC-HC-1 step 4 / step 5 shape) | none | 4 | `content/const-15-core-tail.md`, `content/coord-03-core-fallback.md`, `content/skill-integrator.md`, `content/skill-release-engineer.md` | — |
| T-E294-01 | sr: lane-protocol §1 only — `EnterWorktree(path=<worktree>)` after `feature start`, confirm `pwd` and `git branch --show-current` as separate calls, the cd fallback when the tool is unavailable, the git-guard finding (one plain git command per call); no line between 21 and 59 characters, no long code-fence line (AC-E294-1 … AC-E294-5) | none | 1 | `docs/lane-protocol.md` | — |
| T-E285-01 | sr: integrator SOP — P1 close handoff sub-bullet and Stage 6 step 7 rewrite with the same-session continue rule (AC-E285-1, AC-E285-2); `接手 <manifest>` mode, Work overview row and `## Take-over` section (AC-E285-3); O9 two-hour idle stop with the watch-stop handoff (AC-E285-4, R1); P4 MUST-verifier for every local full suite plus the Output differences bullet (AC-E285-5); O11 advisory in the Invocation paragraph (AC-E285-6); command shapes per the script (AC-E285-7); keep pinned sentences (AC-HC-2, R4) | T-E336-01 | 1 | `content/skill-integrator.md` | — |
| T-E336-02 | qa: re-pin `test/e297-main-protected-sop.test.mjs` AC1 and AC7; regenerate compose goldens; re-measure the context-budget caps the change pushes over (exact size, zero headroom), each explained; new `test/e336-portable-pull.test.mjs`; run AC-E336-2 at review time (AC-E336-4) | T-E336-01 | 3–14 | `test/e297-main-protected-sop.test.mjs`, `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`, `test/e336-*.test.mjs` | — |
| T-E294-02 | qa: new `test/e294-lane-enterworktree.test.mjs` (AC-E294-1 … AC-E294-3, AC-E294-5 structural half); run AC-E294-4 at review time; confirm e177a AC7 green unchanged (AC-HC-1) | T-E294-01 | 1 | `test/e294-*.test.mjs` | — |
| T-E285-02 | qa: new `test/e285-integrator-session-handoff.test.mjs` (AC-E285-1 … AC-E285-7); re-pin any owned SOP test the wording turns red, each explained (AC-HC-2); confirm owned-files-only (AC-HC-3); the single final full suite via `node scripts/test-lock.mjs -- npm test` on the final committed HEAD with a clean tree (AC-HC-4) | T-E285-01, T-E336-02, T-E294-02 | 1–5 | `test/e285-*.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e329-integrator-sop-followups.test.mjs`, `test/e288-integrator-stage0.test.mjs`, `test/e246-mailbox-teardown.test.mjs`, `test/e286-integrator-trust-and-git.test.mjs`, `test/e295-hop-cap-and-sop-halves.test.mjs` | — |
