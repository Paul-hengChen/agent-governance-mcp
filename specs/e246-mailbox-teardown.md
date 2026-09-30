# e246-mailbox-teardown

## Problem Statement
The integrator creates `<lanes-root>/_mailbox/<lane>/` (`to-integrator.md`, `to-lane.md`, plus `.<file>.watch-lock` sidecars while `scripts/mailbox-watch.mjs` runs) at dispatch, but nothing removes it at teardown. A later lane reusing the name inherits stale messages, and a `mkdir -p`-only re-dispatch lets the watch baseline count old mail. `agc feature finish` (both `--shipped` and `--abandoned`) tears down the worktree but leaves the mailbox. Scope is fixed (backlog option iii): the tool removes the mailbox in the default location, and the integrator SOP states the matching rules.

## User Stories
- As an integrator, I want `agc feature finish` to delete the lane's default-location mailbox, so that a later lane with the same name starts clean without a manual step.
- As an integrator, I want finish to refuse to delete anything it does not recognise or that a live watch still holds, so that no unrelated file or active watch is destroyed.
- As an integrator, I want the SOP to say what finish cleans and what I must delete by hand, so that non-default mailboxes are not forgotten.

## Acceptance Criteria
Default mailbox = `<dirname(lane worktree)>/_mailbox/<lane>/` (lane = the lowercase ticket id finish resolved).

- **AC1** — Given a lane whose default mailbox holds only `to-integrator.md` and `to-lane.md`, when `finish --shipped` succeeds, then the mailbox folder no longer exists and the worktree is removed.
  proof: `node --test test/e246-mailbox-teardown.test.mjs` (case `shipped removes clean mailbox`).
- **AC2** — Same as AC1 with `finish --abandoned` (branch kept).
  proof: same file, case `abandoned removes clean mailbox`.
- **AC3** — Given the mailbox also holds `.to-integrator.md.watch-lock` / `.to-lane.md.watch-lock` sidecars whose JSON `{pid,startedAt,file}` holder pid is not alive, when finish runs, then the whole folder is removed.
  proof: case `dead watch-lock sidecars are removed`.
- **AC4** — Given any entry that is not one of the two message files or a `.*.watch-lock` file (an unknown file, a subdirectory, or a symlink), when finish runs, then the folder and all its contents are kept, exactly one warning line naming the lane's mailbox path and the offending entry is written to stderr, and finish exits 0 with its normal worktree/branch outcome.
  proof: case `unknown entry keeps folder and warns` (asserts contents intact, one stderr line matching `agc feature finish — kept mailbox`, exit 0).
- **AC5** — Given a `.*.watch-lock` whose holder pid is alive (test uses `process.pid`), when finish runs, then the folder is kept, one warning line is written, exit 0. A watch-lock that cannot be parsed as JSON with an integer `pid` counts as an unknown entry (AC4).
  proof: cases `live watch-lock keeps folder and warns` and `unparseable watch-lock keeps folder and warns`.
- **AC6** — Given no `_mailbox/<lane>/` exists, when finish runs, then nothing about the mailbox is printed to stdout or stderr and exit is 0. A `_mailbox/<other-lane>/` sibling is never touched.
  proof: cases `absent mailbox is a silent no-op` and `sibling mailbox untouched`.
- **AC7** — Ordering: in both paths the mailbox step runs immediately after `removeWorktreeNoForce` succeeds; in `--shipped` it runs BEFORE `git branch -d`, so a `branch -d` refusal (existing error, exit code unchanged) still leaves the mailbox removed. If the worktree removal itself refuses, the mailbox is not touched (lane still live). A mailbox problem never turns a successful finish into a failure.
  proof: case `shipped mailbox removed even when branch -d refuses` (branch made unmerged-by-`-d` but passing the merge guard, e.g. branch deleted-protected fixture copied from `test/agc-feature-finish-history.test.mjs` patterns) and case `refused worktree removal leaves mailbox` (this one stays). The `shipped mailbox removed even when branch -d refuses` case may be dropped by qa if a temp-repo fixture cannot build a real `branch -d` refusal; ordering is then verified by code-review reading the diff and disclosed in qa evidence.
- **AC8** — Success line: one stdout line `agc feature finish — removed mailbox <path>` on deletion (path printed in the same form as the worktree line).
  proof: asserted in AC1 case.
- **AC9** — `STR_USAGE_FEATURE` finish paragraph states that finish also deletes `<worktree-parent>/_mailbox/<lane>/` when it holds only the two message files and watch-lock sidecars, otherwise keeps it with a warning.
  proof: case `usage text mentions mailbox` (`agc feature` usage output contains `_mailbox/<lane>/`).
- **AC10** — `content/skill-integrator.md` stage 3 point 3 gains a sentence: a pre-existing mailbox for the same lane name is reset (emptied and recreated), never reused. Stage 6 step 3 gains sentences: finish also removes the default-location mailbox (`<lanes-root>/_mailbox/<lane>/`); a mailbox outside the default location (`--mailbox-root`, or the manifest `mailbox:` header pointing elsewhere) is deleted by hand by the integrator. Stage 6 step 3 also gains: stop the mailbox watch (TaskStop, or let it expire) before running finish for the lanes, since every lane report is already closed by then; a kept-mailbox warning naming a live watch-lock means a watch is still running — stop it and delete the folder by hand. Existing text is unchanged (sentences added only, e178a pins verbatim); `node --test test/e178a-integrator-role.test.mjs test/skill-frontmatter.test.mjs` stays green.
  proof: `node --test test/e178a-integrator-role.test.mjs test/skill-frontmatter.test.mjs` plus case `integrator SOP names mailbox reset and finish cleanup` in the e246 test file (asserts the fragments `reset`, `never reused`, `by hand`, `stop the mailbox watch`).
- **AC11** — `docs/lane-protocol.md` §5 gets one line: the mailbox lives until `agc feature finish` tears the lane down, which deletes the default-location folder (lanes do nothing).
  proof: case `lane-protocol names mailbox lifecycle` (grep for the added line).
- **AC12** — Out-of-scope files are byte-identical: `scripts/mailbox-watch.mjs`, `docs/install.md`, all other `content/**`, `tools/**`, `dist/**`.
  proof: `git diff --stat main...HEAD` lists only owned paths (`bin/agc-init.mjs`, `content/skill-integrator.md`, `docs/lane-protocol.md`, `test/e246-*`, `test/fixtures/e246/**`, `specs/`, `qa_reports/`, `review_reports/`, `.current/e246/`).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| mailbox.removed | `agc feature finish — removed mailbox <path>` | authored-here — mirrors the adjacent `removed worktree` line |
| mailbox.kept | `agc feature finish — kept mailbox <path>: <reason>` (reason: `unknown entry <name>`, `unparseable watch-lock <name>`, or `watch-lock <name> held by live pid <pid>`) | authored-here — one line, same prefix convention |
| usage.finish-mailbox | `Also deletes <worktree-parent>/_mailbox/<lane>/ when it holds only to-integrator.md, to-lane.md and watch-lock sidecars; otherwise keeps it with a warning.` (wrapped in the existing usage layout) | authored-here — usage sync required by the ticket |
| sop.stage3 | `A pre-existing mailbox for the same lane name is reset (emptied and recreated), never reused.` | authored-here — backlog E246 |
| sop.stage6 | `finish also removes the default-location mailbox (<lanes-root>/_mailbox/<lane>/); a mailbox outside the default location (--mailbox-root, or the manifest mailbox: header pointing elsewhere) is deleted by hand by the integrator.` | authored-here — fanout-e246-e259 Decisions |
| sop.stage6-watch | `stop the mailbox watch (TaskStop, or let it expire) before running finish for the lanes, since every lane report is already closed by then; a kept-mailbox warning naming a live watch-lock means a watch is still running — stop it and delete the folder by hand.` | authored-here — integrator pre-review R1 (to-lane#1) |
| lane-protocol.mailbox | `信箱在 agc feature finish 拆除 lane 時才會刪除（預設位置由 finish 處理），lane 自己不用清。` | authored-here — §5 is Chinese prose |

(sr-engineer may adjust wording; the fixed fragments the tests assert on are `removed mailbox`, `kept mailbox`, `_mailbox/<lane>/`, `reset`, `never reused`, `by hand`.)

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design Decisions (PM)
- Mailbox path is derived from the lane worktree path captured before removal: `path.join(path.dirname(lanePath), "_mailbox", ticketId)`. finish does not read the fan-out manifest (per fanout Decisions).
- Inspect entries with `lstat`; only regular files named exactly `to-integrator.md`, `to-lane.md`, or matching `^\..+\.watch-lock$` are recognised. If `_mailbox/<lane>` itself is a symlink or not a directory: keep, warn.
- Liveness: same semantics as `scripts/mailbox-watch.mjs` (`process.kill(pid, 0)`; `EPERM` = alive). Duplicate the few lines in `bin/agc-init.mjs`; do NOT import from `scripts/` (forbidden, and `bin/` ships standalone).
- Ordering (AC7): mailbox step directly after the worktree removal line, before `branch -d`, in `--shipped`; directly after the worktree removal in `--abandoned`. Rationale: the worktree is gone at that point so the lane is dead, and the `branch -d` refusal must not skip cleanup.
- Deletion uses `fs.rmSync(dir, {recursive:true})` only after all entries pass the check; any fs error during deletion is downgraded to the `kept mailbox` warning (exit 0).
- Parent `_mailbox/` root is never removed, even if empty.

## Test Placement (qa-owned, §2)
- New `test/e246-mailbox-teardown.test.mjs` (node --test), qa-authored. Reuse the real-git fixture pattern of `test/agc-feature-finish-history.test.mjs` (temp primary repo + `feature start` + finish); do not edit that file. Fixtures, if any beyond generated temp dirs: `test/fixtures/e246/**`.
- `test/e178a-integrator-role.test.mjs` is edited only if an added sentence breaks an existing pin (pre-assigned to e246 by the fanout manifest; the plan is to keep pins verbatim, so expected: no edit).

## Out of Scope
- `scripts/mailbox-watch.mjs`, the fan-out manifest format, `docs/install.md` (integrator adds the sentence after merge), other `docs/**`, `CHANGELOG.md`, version bump, `dist/**`.
- Deleting the 14 existing old mailboxes (integrator, post-merge).
- Custom mailbox locations (`--mailbox-root`, manifest `mailbox:` header): SOP manual step only.
- Changing `feature start`.

## Dependencies / Prerequisites
E73 (feature finish) and E177b (mailbox-watch) are done. No design file (mode = no-design), so Visual Structural Assertions are omitted. No external references. Shared generated artifacts untouched: the `content/skill-integrator.md` edit is not in any compose golden or `test/context-budget.test.mjs` (verified by the integrator in the fanout manifest).
