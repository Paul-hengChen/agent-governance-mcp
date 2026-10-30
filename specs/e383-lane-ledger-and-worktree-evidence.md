# e383-lane-ledger-and-worktree-evidence

Fan-out wave 13 (`specs/fanout-post-v4-w13.md`), lane e383. Tickets: **E383** (lane task ledger lost at teardown in a workspace that git-ignores agc files) and **E385** (an `EnterWorktree`-isolated lane cannot write symlinked evidence dirs). Branch `feat/e383-lane-ledger-and-worktree-evidence`, worktree `../agent-governance-mcp-lanes/e383`, base `35f20e2`.

## Problem Statement

Both tickets come from an adopter repo that keeps agc files out of git (`artifacts: "local"`), and both sit on the lane open/close path.

- **E383.** `resolveTasksLedgerPath` (`tools/tasks-lane-migrate.ts`) falls back to a legacy task file whenever the lane ledger `.current/<lane>/tasks.md` is absent and its path is git-ignored. When no legacy file exists, it falls back to the first `taskPaths` candidate (`.current/tasks.md` by default). A fresh lane worktree in such a repo has no legacy file, because ignored files are not checked out. So the first `tw_add_task` creates `<worktree>/.current/tasks.md`, while the handoff lives in `.current/<lane>/`. `agc feature finish` harvests only `.current/<lane>/`, so the ledger is deleted with the worktree.
- **E385.** The Worktree bootstrap obligation (`content/coord-03-core-fallback.md`, E111) tells the coordinator to symlink each untracked `qa_reports/`, `review_reports/` and `specs/` back to primary. `agc check` warns when a linked worktree holds a real untracked evidence dir instead. A lane session isolated by Claude Code's `EnterWorktree` (which `docs/lane-protocol.md` §1 and `PROMPT_TEMPLATE_3B` tell lanes to use, since E294) cannot write through a link that resolves outside the worktree. Code-review and QA evidence then cannot land, and `MISSING_REVIEW_EVIDENCE` / `AC_EXECUTION_LOG_MISSING` block APPROVED/PASS. Since E214 (`--shipped`) and E180/E217 (`--abandoned`), `agc feature finish` already harvests unlinked, git-ignored evidence into primary before removing the worktree, so the symlink no longer protects anything that finish does not already protect. In the same class of problem, the worktree git guard refused a lane's git command that had a `PATH=` assignment prefix, and nothing in lane-protocol tells the lane about it.

## User Stories

- As an integrator running a lane wave in a repo that git-ignores agc files, I want the lane's task ledger to survive `agc feature finish`, so that I do not have to rescue ledgers by hand.
- As a lane session isolated by `EnterWorktree`, I want my code-reviewer and qa-engineer to be able to write their evidence, so that APPROVED/PASS are not blocked by our own bootstrap rule.
- As a lane session, I want lane-protocol to tell me that the worktree git guard also refuses an env-assignment prefix, so that I do not lose a hop finding it out.

## Design decisions

- **D-E383 — option (b): in a linked lane worktree, the lane ledger is used even when its path is git-ignored, provided no legacy task file exists.** `resolveTasksLedgerPath` gains one branch, evaluated only after the existing checks fail (lane ledger absent, path ignored). If `findLegacyTasksFile` finds nothing, the current lane is not `_primary`, and `<workspace>/.git` is a file (a linked worktree, the same test `tools/drift.ts` and `bin/agc-init.mjs` `isLinkedWorktree` use), the function returns the lane ledger path. Otherwise behaviour is unchanged. Why (b) and not (a):
  - It fixes the cause. The ledger lands in `.current/<lane>/`, and both `finish --shipped` (`planLaneClose`) and `finish --abandoned` (`planAbandonCurrentHarvest`) already harvest that directory. Option (a) would need a new harvest source in both finish paths, plus the alreadyClosed refresh path and the rollback path, inside the "refusal leaves no half state" guarantee.
  - The ledger and the handoff live in one place while the lane is live, so `tw_get_next_task` gives no ignored-lane advisory and the lane reads one directory.
  - The legacy primary fallback (E125a option A, AC4b) cannot change. A primary checkout never has a `.git` file, so `_primary`, and a feat branch checked out in primary, keep today's resolution. When any legacy file exists, even in a linked worktree, the legacy file stays the ledger. That keeps AC4b's semantics, and it keeps a lane opened before this fix on the ledger it already has, instead of switching it to an empty one mid-lane.
  - `tools/tasks-file.ts` needs no change, because every reader and writer already goes through `resolveTasksLedgerPath`. Under this option the lane's grant on `tools/tasks-file.ts` and `dist/tools/tasks-file.*` goes unused. `bin/agc-init.mjs` `feature finish` also needs no change.
  - Residual risk, documented in §3 rather than coded: a lane whose worktree already has an ignored legacy ledger, such as a lane opened before this fix, still loses that file at finish. lane-protocol §3 tells the lane to move it to `.current/<lane>/tasks.md` before its final report.
- **D-E385 — option (b): evidence directories are never symlinked out of a lane worktree. They stay real directories, and finish harvests them.** The bootstrap obligation no longer asks for a symlink. The `agc check` worktree advisory flips to match: a real directory is the expected shape and stays silent, and a link that resolves outside the worktree or does not resolve at all warns. Why (b) and not (a) (docs + dispatch prompt only, e.g. "do not use `EnterWorktree`"):
  - (a) would roll back E294, whose whole point is that `EnterWorktree` stops the harness resetting cwd to primary.
  - Under (a), the coordinator SOP (symlink) and `agc check` (warn on a real dir) would still contradict lane-protocol. The wave's acceptance row requires lane-protocol, the dispatch prompt and the coordinator SOP to say the same thing.
  - Since E214/E180/E217 the symlink duplicates what finish already does, so removing it costs nothing for a lane torn down by finish. lane-protocol already forbids lanes from removing worktrees, and `docs/install.md` already calls a hand-run `git worktree remove` undefined behaviour.
  - `PROMPT_TEMPLATE_3B` is **not changed**. Its `EnterWorktree` line stays correct under (b), and its bytes are pinned by `test/fixtures/e177a/render-e177a.golden.txt`, which is outside this lane's owned set. Consistency comes from the prompt's existing pointer to lane-protocol, which now carries the rule. The lane's grant on `tools/fanout-manifest.ts` and `dist/tools/fanout-manifest.*` goes unused.
- **D-E385-check — the new `agc check` advisory table** (linked worktree only; a primary checkout stays a no-op; advisory only, the exit code is never affected):

  | evidence dir shape (`qa_reports/`, `review_reports/`, `specs/`) | before | after |
  |---|---|---|
  | absent | silent | silent |
  | real dir, empty or holding untracked/ignored content | warn "symlink it back" | **silent** (harvested by finish) |
  | real dir, tracked (W5/W6/W7 shapes) | silent | silent |
  | symlink resolving outside the worktree | silent | **warn** `worktree-evidence.outside-link` |
  | symlink resolving inside the worktree | warn "point it outside" | **silent** (finish dereferences and harvests it, E207/AC17a) |
  | dangling symlink | warn "point it outside" | warn `worktree-evidence.dangling-link` (new advice) |

  Helpers left with no caller (`isEmptyDir`, `hasUntrackedContent`, `hasIgnoredUntrackedContent`, but not `hasTrackedContent` or `isSafelyLinkedOutside`, which finish uses) are removed. The comment block above the advisory is rewritten to be self-contained, because its pointer to `specs/e260c-bin-scripts.md` (forbidden here) goes stale. That is filed as a finding.
- **PATH= prefix.** The finding is recorded only in lane-protocol §1's git-command paragraph. The guard is host behaviour and is not changed.

## Acceptance Criteria

Fixtures are built in temp dirs with real `git init` and, where a linked worktree is needed, real `git worktree add`. They ignore agc paths through `.gitignore` or `.git/info/exclude`. This repo's own `artifacts: "repo"` state never reproduces either ticket.

**E383**

- **AC-E383-1 (lane worktree, ignored, no legacy file → lane ledger)**: Given a repo that ignores `/.current/` and `/tasks.md`, with a linked worktree on `feat/e999-x` holding no legacy task file, when `addTaskInFile(worktree, "T-E999-01", …)` and then `getNextTaskFromFile(worktree)` run, then the add result's `path` is `<worktree>/.current/e999/tasks.md`, that file holds the row, `<worktree>/.current/tasks.md` and `<worktree>/tasks.md` do not exist, the read returns `T-E999-01`, and the read result has no `advisory` key.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` case `AC-E383-1`.
- **AC-E383-2 (finish carries the ledger)**: Given the lane from AC-E383-1 with its ledger written and its branch merged into the base, when `agc feature finish e999 --shipped` runs from primary, then primary's `.current/history/<YYYY-MM>/e999/tasks.md` exists byte-identical to the lane ledger. Given a second such lane, when `agc feature finish <id> --abandoned` runs instead, then the same holds.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` cases `AC-E383-2-shipped` and `AC-E383-2-abandoned`.
- **AC-E383-3 (legacy primary fallback unchanged)**: Given an ignored repo checked out in primary (`.git` is a directory) with no legacy task file, when `addTaskInFile` runs in one such fresh fixture on `main` and in another on a `feat/e998-y` branch, then both write the first `taskPaths` candidate (`.current/tasks.md`), no `.current/<lane>/tasks.md` is created, and the read carries the ignored-lane advisory. `test/e125a-lane-local-ledgers.test.mjs` passes **unedited**, AC4b included.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` case `AC-E383-3`; `node --test test/e125a-lane-local-ledgers.test.mjs` green with `git diff --stat 35f20e2 -- test/e125a-lane-local-ledgers.test.mjs` empty.
- **AC-E383-4 (lane worktree with a legacy file keeps the legacy ledger)**: Given an ignored repo whose linked worktree on `feat/e997-z` holds `.current/tasks.md` with a row, when `getNextTaskFromFile` and `addTaskInFile` run, then the legacy file is read and written, no lane ledger is created, and the advisory is present.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` case `AC-E383-4`.
- **AC-E383-5 (non-feat linked worktree unchanged)**: Given an ignored repo with a linked worktree on a non-`feat/` branch (`_primary` lane) and no legacy file, when `addTaskInFile` runs, then it writes `.current/tasks.md` as before.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` case `AC-E383-5`.
- **AC-E383-6 (not-ignored behaviour unchanged)**: the existing lane-ledger, migration and finish suites pass unedited: `test/e125a-lane-local-ledgers.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs`.
  proof: `node --test test/e125a-lane-local-ledgers.test.mjs test/agc-feature-finish-history.test.mjs test/agc-feature-lifecycle.test.mjs test/e213-shipped-ignored-shape.test.mjs test/e180-abandoned-harvest.test.mjs` all pass.
- **AC-E383-7 (lane-protocol §3)**: `docs/lane-protocol.md` §3 holds the line `doc.s3-ledger` (Copy) exactly once, as the line directly after the E196 known-gaps line.
  proof: `node --test test/e383-lane-ledger-worktree.test.mjs` case `AC-E383-7`.

**E385**

- **AC-E385-1 (bootstrap obligation)**: `content/coord-03-core-fallback.md` holds `coord.bootstrap-obligation` (Copy) in place of the old paragraph, still between `**Lane-start default**` and `## Escalation Routes`. The strings `symlink back to primary each of` and `needed ONLY when untracked` appear nowhere under `content/`. The composed `teamwork` coordinator prompt carries the new paragraph with origin tags stripped. `test/fixtures/compose-golden/skill-coordinator-monolith.txt` is re-captured, and `test/context-budget.test.mjs` passes (re-pinned only if a pinned number moves).
  proof: `grep -rn "symlink back to primary each of\|needed ONLY when untracked" content/` prints nothing; `node --test test/e385-worktree-evidence.test.mjs test/e130-lane-default.test.mjs test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs` all pass.
- **AC-E385-2 (real evidence dirs are silent)**: Given a linked worktree where each of `qa_reports/`, `review_reports/` and `specs/` is in turn an empty real dir, a real dir of ignored untracked files, and the W3 shape (a force-added tracked `.gitkeep` beside ignored untracked evidence), when `agc check` runs there, then stderr has no line naming that dir, and the exit code is the same as with the dir absent.
  proof: `node --test test/agc-adapters.test.mjs` (re-pinned E111/E385 cases) and `test/e385-worktree-evidence.test.mjs` case `AC-E385-2`.
- **AC-E385-3 (outside link warns)**: Given a linked worktree whose `qa_reports` is a symlink resolving into the primary checkout, when `agc check` runs, then stderr holds `worktree-evidence.outside-link` with `<rel>` = `qa_reports` exactly once, and the exit code is 0 (with no other condition firing).
  proof: `node --test test/e385-worktree-evidence.test.mjs` case `AC-E385-3`.
- **AC-E385-4 (dangling link warns)**: Given a dangling `review_reports` symlink in a linked worktree, when `agc check` runs, then stderr holds `worktree-evidence.dangling-link` with `<rel>` = `review_reports` exactly once, and the exit code is 0.
  proof: `node --test test/e385-worktree-evidence.test.mjs` case `AC-E385-4`.
- **AC-E385-5 (inside link silent)**: Given `qa_reports -> ./local-evidence` (resolving inside the worktree), when `agc check` runs, then stderr has no line naming `qa_reports/`.
  proof: `node --test test/e385-worktree-evidence.test.mjs` case `AC-E385-5`.
- **AC-E385-6 (unchanged shapes)**: tracked shapes W5, W6 and W7 stay silent. A primary checkout produces zero worktree-evidence lines. The stale-adapter exit-1 path still fires alongside a worktree-evidence warning (re-pinned to the outside-link shape). No string of the two removed warnings (`is a real, untracked directory in a linked git worktree`, `resolves INSIDE this worktree`) remains in `bin/agc-init.mjs`.
  proof: `node --test test/agc-adapters.test.mjs`; `grep -n "is a real, untracked directory in a linked git worktree\|resolves INSIDE this worktree" bin/agc-init.mjs` prints nothing.
- **AC-E385-7 (finish already harvests real evidence dirs — no finish change)**: the E213/E214 `--shipped` harvest cases and the E180/E217 `--abandoned` cases pass unedited, and `bin/agc-init.mjs` has no diff outside the worktree-advisory region (the `WORKTREE_EVIDENCE_DIRS` block through `checkWorktreeEvidence`).
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs test/e180-abandoned-harvest.test.mjs` pass; reviewer checks `git diff 35f20e2 -- bin/agc-init.mjs` hunks.
- **AC-E385-8 (lane-protocol)**: `docs/lane-protocol.md` §1's git-command bullet is exactly `doc.s1-git` (it replaces the current `**git 一條一條下**` bullet). §3 holds `doc.s3-evidence` exactly once, directly after `doc.s3-ledger`. `test/e294-lane-enterworktree.test.mjs` and `test/e351-lane-protocol-gaps.test.mjs` pass **unedited**. No new §1 line is a substring of the rendered dispatch prompt, so `test/e177a-manifest.test.mjs` AC7 stays green.
  proof: `node --test test/e385-worktree-evidence.test.mjs test/e294-lane-enterworktree.test.mjs test/e351-lane-protocol-gaps.test.mjs test/e177a-manifest.test.mjs` pass.

**Lane-wide (hard conditions)**

- **AC-L1**: no error code, refusal condition or exit-code semantics changes. `TASKS_LEDGER_ABSENT`, `TASKS_MIGRATION_BUSY` and every `agc feature finish` refusal are untouched, and `test/error-code-contract.test.mjs` passes unedited.
- **AC-L2**: no `schema_version` constant changes (`schema/versions.ts` untouched).
- **AC-L3**: in an `artifacts: "repo"` repo (tracked `.current/`, tracked evidence), behaviour is unchanged: the full suite passes with only the re-pins named in the Cut.
- **AC-L4**: `PROMPT_TEMPLATE_3B`, `tools/tasks-file.ts` and the `feature finish` code paths are byte-unchanged (`git diff 35f20e2 -- tools/fanout-manifest.ts tools/tasks-file.ts` empty).
- **AC-L5**: the full suite, `node scripts/test-lock.mjs -- npm test`, is green on the final committed HEAD with a clean tree. `dist/` is rebuilt and committed.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| worktree-evidence.outside-link | `agc check — warning: ${rel}/ is a symlink that resolves outside this linked git worktree — a session isolated to the worktree (e.g. Claude Code EnterWorktree) cannot write through it, so code-review/QA evidence cannot land; replace it with a real directory in the worktree: \`agc feature finish\` harvests git-ignored evidence into the primary checkout before it removes the worktree\n` | authored-here — E385 D-E385-check; names the failure and the remedy, reuses the existing `agc check — warning:` prefix |
| worktree-evidence.dangling-link | `agc check — warning: ${rel}/ is a symlink that does not resolve to anything (dangling) in a linked git worktree — evidence writes into it fail; replace it with a real directory in the worktree: \`agc feature finish\` harvests git-ignored evidence into the primary checkout before it removes the worktree\n` | authored-here — E385; keeps the current dangling diagnosis, swaps the "point it outside" advice |
| coord.bootstrap-obligation | `**Worktree bootstrap obligation**<!-- origin:start --> (E111, E385)<!-- origin:end -->: when the separate-worktree route is taken, do NOT symlink \`qa_reports/\`, \`review_reports/\` or \`specs/\` back to primary — a session the host isolates to its worktree (e.g. Claude Code \`EnterWorktree\`) cannot write through such a link, so code-review and QA evidence could not land. An untracked (gitignored) one stays a real directory in the worktree (\`mkdir -p\` it there when absent); \`agc feature finish\` harvests git-ignored evidence into primary before it removes the worktree, so a lane worktree is torn down only by \`agc feature finish\`, never by a hand-run \`git worktree remove\`. A tracked-evidence repo carries evidence to the lane via the lane branch's own commits instead, no symlink needed. \`agc check\` warns (advisory only) when an evidence dir in a linked worktree is a symlink that resolves outside the worktree or does not resolve.` | authored-here — E385 D-E385; replaces the E111 paragraph (one line, `content/coord-03-core-fallback.md` line 17) |
| doc.s1-git | `   - **git 一條一條下**：切進 worktree 的 session 有 git 防護，會拒絕 \`git -C <primary> …\`，也會拒絕任何含 git 的複合指令（例如 \`a && git b\`、\`git a; b\`）；前面帶環境變數指派的 git 指令（例如 \`PATH=<dir>:$PATH git commit …\`）屬於同一類，一樣會被拒絕。所以 git 指令一條一條下，每次 Bash 呼叫只放一條單純的 git 指令，前面不加任何 \`NAME=value\` 指派；git hook 因此找不到工具時，停下來寫信箱回報，不要繞過防護。` | authored-here — E385 same-class finding (PATH= prefix); keeps the E294-pinned tokens `git -C <primary>` and `一條一條` |
| doc.s3-ledger | `  - task 帳本（E383）：\`.current/<lane>/\` 被 ignore 時，linked worktree 裡的 lane 只要 worktree 裡沒有舊帳本檔（\`.current/tasks.md\`、root \`tasks.md\`、\`TODO.md\`，或 \`taskPaths\` 指定的檔），帳本照樣是 \`.current/<lane>/tasks.md\`，finish 收割 \`.current/<lane>/\` 時一併帶走。worktree 裡已有舊帳本檔時，\`tw_*\` 仍把它當帳本（\`tw_get_next_task\` 的 advisory 會點名它），finish 不會收割它：它若被 ignore，lane 在收工回報前把它移到 \`.current/<lane>/tasks.md\`。` | authored-here — E383 D-E383; the §3 statement the ticket requires |
| doc.s3-evidence | `  - 證據目錄不 symlink（E385）：沒有 tracked 的 \`qa_reports/\`、\`review_reports/\`、\`specs/\` 在 worktree 裡一律是真目錄，**不要** symlink 回 primary —— 用 \`EnterWorktree\` 隔離的 session 不能寫到 worktree 外，code-reviewer 與 qa-engineer 的證據寫不進連回 primary 的 symlink，APPROVED／PASS 就會卡住。證據留在 worktree，由上面的 finish 收割帶進 primary；所以 lane 的 worktree 只能由 \`agc feature finish\` 拆掉，不要手動 \`git worktree remove\`。\`agc check\` 看到連到 worktree 外、或解析不到的證據目錄 symlink 會警告。` | authored-here — E385 D-E385; lane-protocol side of the consistency requirement |

Removed strings: the two `agc check` warnings `… is a real, untracked directory in a linked git worktree — symlink it back …` and `… is a symlink that resolves INSIDE this worktree instead of outside it …`.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E381 (`check --cut` parses prose in the 擁有 cell as a glob).
- `docs/lane-protocol-addendum.md`, `docs/install.md`, `docs/config.md` (none needs a change; any later need is filed as a finding).
- Changing `PROMPT_TEMPLATE_3B` (see D-E385) and the worktree git guard itself (host behaviour).
- Automatic migration of an existing ignored legacy ledger in a lane worktree. It is documented in §3 instead.
- A tracked `TODO.md`/root `tasks.md` becoming a lane's ledger in an ignored workspace (existing E125a option-A behaviour; filed as finding E383-NEW-2).
- Any change to `agc feature finish` code paths, `tools/tasks-file.ts`, `gates/**`, `schema/**`.

## Dependencies / Prerequisites

- E125 ✓, E111 ✓, E214 ✓ (E180/E217 for `--abandoned`) are all on base `35f20e2`.
- Resource Audit: the E383/E385 rows and the wave manifest contain no URL, Figma, mockup or external-ticket reference ("an adopter repo" is a description, not a link). Zero external refs, so `external_refs` is omitted.
- No architect hop. Scope is one branch in one function (`tools/tasks-lane-migrate.ts`), one advisory function (`bin/agc-init.mjs`) and three prose sites, with no new data model and no cross-cutting API.
- Human ruling requested at cut approval (R1): the outside-link warning flips E111(ii) from silent to warning. A lane that symlinked before this change will see the advisory on its next `agc check`. That is intended, because it is the exact E385 failure shape. The alternative is to keep it silent and warn only on dangling links.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E383-01 | sr (E383, D-E383): in `tools/tasks-lane-migrate.ts` `resolveTasksLedgerPath`, after the existing early return, return `laneTasksPath` when `findLegacyTasksFile(ws)` is null AND the lane (basename of `laneTasksPath`'s dir) is not `_primary` AND `<ws>/.git` is a file (linked worktree, a module-private helper mirroring `tools/drift.ts`'s); else unchanged. Update the doc comment and the `tools/tasks-file.ts`-facing contract comment in this file only. Rebuild `dist/`. ~20 lines | none | 1 (+dist) | `tools/tasks-lane-migrate.ts`、`dist/tools/tasks-lane-migrate.*` | — |
| T-E385-01 | sr (E385, D-E385-check): rework `checkWorktreeEvidence` in `bin/agc-init.mjs` per the D-E385-check table: real dirs silent, inside links silent, outside links warn `worktree-evidence.outside-link`, dangling warns `worktree-evidence.dangling-link`; remove the now-unused `isEmptyDir` / `hasUntrackedContent` / `hasIgnoredUntrackedContent`; rewrite the region's comment block self-contained. No other region of the file changes | none | 1 | `bin/agc-init.mjs` | — |
| T-E385-02 | sr (E385, D-E385): replace line 17 of `content/coord-03-core-fallback.md` with `coord.bootstrap-obligation` verbatim | none | 1 | `content/coord-03-core-fallback.md` | — |
| T-E385-03 | sr (E383 + E385 docs): in `docs/lane-protocol.md`, replace the §1 `**git 一條一條下**` bullet with `doc.s1-git`; in §3 insert `doc.s3-ledger` then `doc.s3-evidence` directly after the E196 known-gaps line. No other line changes | T-E383-01, T-E385-01, T-E385-02 | 1 | `docs/lane-protocol.md` | — |
| T-E383-02 | qa (E383): new `test/e383-lane-ledger-worktree.test.mjs` covering AC-E383-1..5 and AC-E383-7 with real `git init` + `git worktree add` fixtures in temp dirs (ignore via `.gitignore` / `info/exclude`); run AC-E383-6 suites unedited | T-E383-01, T-E385-03 | 1 | `test/e383-lane-ledger-worktree.test.mjs` | — |
| T-E385-04 | qa (E385): new `test/e385-worktree-evidence.test.mjs` (AC-E385-1..5, AC-E385-8); re-pin `test/agc-adapters.test.mjs` E111 worktree-advisory cases (W1/W3/W4 now silent, S1 now warns, exit-code co-fire case on the outside-link shape); re-pin `test/e130-lane-default.test.mjs` AC6; re-capture `test/fixtures/compose-golden/skill-coordinator-monolith.txt`; re-pin `test/context-budget.test.mjs` only if a pinned number moves | T-E385-01, T-E385-02, T-E385-03 | 5 | `test/e385-worktree-evidence.test.mjs`、`test/agc-adapters.test.mjs`、`test/e130-lane-default.test.mjs`、`test/fixtures/compose-golden/skill-coordinator-monolith.txt`、`test/context-budget.test.mjs` | — |
| T-E385-05 | qa (lane verification): on the final committed HEAD with a clean tree, run AC-L1..L5 and every `proof:` above; the full suite under `node scripts/test-lock.mjs -- npm test`. Must stay green **unedited**: `test/e125a-lane-local-ledgers.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e294-lane-enterworktree.test.mjs`, `test/e351-lane-protocol-gaps.test.mjs`, `test/e289-render-addendum.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e177a-manifest.test.mjs`, `test/skill-manifest.test.mjs`, `test/compose-equivalence.test.mjs`, `test/e90-golden-capture-completeness.test.mjs`, `test/error-code-contract.test.mjs` | T-E383-02, T-E385-04 | 0 | — | — |

## Findings filed

Recorded in `.current/e383/pending-tickets.md`:

- `E383-NEW-1`: `specs/e260c-bin-scripts.md`'s E111 worktree-advisory section (trigger details, known false positives) describes the pre-E385 advisory and goes stale. That file is forbidden to this lane.
- `E383-NEW-2`: in a workspace whose lane path is git-ignored, a tracked `TODO.md` or root `tasks.md` in a lane worktree becomes that lane's `tw_*` ledger (E125a option A), so lane task rows get committed into a team file.
