# e351-lane-protocol-gaps

Tickets: E351 (lane-protocol commit rules assume `artifacts: repo`), E352 (no generic fallback when `agc` is not on PATH and no addendum exists). Fan-out plan: `specs/fanout-post-v4-w9.md`, lane `e351`. Human ruling D2 = option (i) (Decisions table, 人類 row, 2026-10-19): the generic file states what the tool does today under `artifacts: local`, names E196 and E217 as known gaps, and changes no tool.

## Problem Statement

`docs/lane-protocol.md` is the generic agc lane rulebook every adopter's lanes read. Two of its rules only work in this repo's own setup. (1) §3 tells the lane to commit `.current/<lane>/`, `qa_reports/` and `review_reports/`, and §4 says `pending-tickets.md` must be committed to get ids. Under `artifacts: local` (E73: agc artifacts stay out of a team repo's history), `agc init --artifacts=local` git-excludes `.current/`, `tasks.md`, `qa_reports/` and `review_reports/`. The lane cannot follow those rules, and it is not told how its evidence and findings reach primary. (2) §1 sends the "agc not on PATH" call form to the repo addendum. An adopter with no addendum and no `agc` on PATH gets no command it can run. This feature adds the local-mode behaviour to §3 and §4, matching `bin/agc-init.mjs` as it stands, and gives §1 a generic fallback written the same way §5 names the fan-out tool. It is text only.

## User Stories

- As a lane session in a repo with `artifacts: local`, I want the generic lane rules to say which paths I must not commit and how my evidence and findings reach primary, so that I neither force-add excluded files nor lose my findings.
- As an integrator in such a repo, I want the generic rules to say that finish leaves findings unnumbered and keeps a history copy for me to file by hand, so that I know where to look before the push.
- As an adopter with no addendum and no `agc` on PATH, I want §1 to give a runnable call form, so that I can start a lane without guessing.
- As a maintainer, I want the two known tool gaps (E196, E217) named with what they lose, so that nobody reads the local-mode rule as lossless where it is not.

## Acceptance Criteria

Every AC below asserts on `docs/lane-protocol.md` (the generic file) unless it names another file. QA's placement for every new assertion is one new file, `test/e351-lane-protocol-gaps.test.mjs`. It covers both tickets, because both edit the same file and share one fixture read. No `test/e352-*.test.mjs` is needed. `test/e294-lane-enterworktree.test.mjs` §1 assertions need no change: the changed §1 line still holds every §1 string e294 pins, and it is not a substring of `PROMPT_TEMPLATE_3B`. `test/e290-lane-protocol-generic.test.mjs` needs no re-pin.

### E352 — §1 generic fallback

- **AC-E352-1** — Given §1 step 1, when the lane reads what to do when `agc` is not on PATH, then exactly one §1 line is `copy.s1-fallback` (Copy / Strings) byte for byte. That line names the generic form `node <agc 安裝位置>/bin/agc-init.mjs`, says the addendum may set this repo's own call form, and still sends the build command to the addendum (`見補充規則`). The old line `copy.s1-old` is gone.
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E352-1" — `sec1` lines include `copy.s1-fallback`; `GENERIC.includes(copy.s1-old)` is false.
- **AC-E352-2** — Given the fallback and §5's fan-out tool sentence, when both are read, then both use the same form `node <agc 安裝位置>/<path>`: §1 holds `node <agc 安裝位置>/bin/agc-init.mjs` and §5 still holds `node <agc 安裝位置>/scripts/fanout.mjs`.
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E352-2" — `count(S1, "node <agc 安裝位置>/bin/agc-init.mjs") >= 1` and `count(S5, "node <agc 安裝位置>/scripts/fanout.mjs") >= 1`.
- **AC-E352-3** — Given the fallback line, when it is checked against AC-E290-3's forbidden-string list, then it holds none of them. Notably `node bin/agc-init.mjs` does not appear: the placeholder `<agc 安裝位置>/` always sits between `node ` and `bin/`.
  proof: `test/e290-lane-protocol-generic.test.mjs` "AC-E290-3", unchanged and green.

### E351 — `artifacts: local` in §3 and §4

- **AC-E351-1** — Given §3, when the lane reads the commit rule, then the existing commit bullet `copy.s3-commit-kept` is unchanged. Directly after it comes `copy.s3-local`, which names `artifacts: local` and its config key, lists the four excluded paths (`.current/`, root `tasks.md`, `qa_reports/`, `review_reports/`), says the lane does not commit them (no force-add), and says `specs/` stays tracked and is committed as before.
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-1" — in `sec("## 3. ")`, the line after `copy.s3-commit-kept` equals `copy.s3-local`.
- **AC-E351-2** — Given §3, when the lane reads how evidence reaches primary under local mode, then the sub-bullet directly after `copy.s3-local` equals `copy.s3-harvest`. It says evidence arrives through the integrator's `agc feature finish` harvest. `--shipped` copies git-ignored, untracked files under `qa_reports/`, `review_reports/` and `specs/` into primary's `<目錄>/archive/<lane>/`, and copies the whole `.current/<lane>/` into primary's `.current/history/<YYYY-MM>/<lane>/`. `--abandoned` moves files directly under `qa_reports/` and `review_reports/` whose names carry the lane name into `<目錄>/abandoned/<lane>/`, keeps a primary copy of the ignored ones, and also copies `.current/<lane>/` into primary's history.
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-2" — the line after `copy.s3-local` equals `copy.s3-harvest`.
- **AC-E351-3** — Given §3, when the lane reads the known gaps, then the next sub-bullet equals `copy.s3-gaps`. It names E196 with its plain-language clause (when `.current/<lane>/` is only partly tracked, the first `--shipped` run does not carry its git-ignored files into history) and E217 with its clause (`--abandoned` does not harvest `specs/`, so a git-ignored spec is deleted with the worktree). Each ticket id appears in the generic file exactly once and is paired with that clause (§6 generic-citation rule).
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-3" — the line after `copy.s3-harvest` equals `copy.s3-gaps`; `count(GENERIC, "E196") === 1`, `count(GENERIC, "E217") === 1`.
- **AC-E351-4** — Given §4, when the lane reads the commit-or-not-numbered rule, then `copy.s4-commit-kept` (the line e329 pins as `LP_COMMIT`) is byte-identical and appears once. The line directly after it equals `copy.s4-local`, which says that under local mode `pending-tickets.md` cannot be committed, so finish always takes the "never committed" path (no ids, a warning, the findings listed, a copy kept under primary's `.current/history/<YYYY-MM>/<lane>/`), the integrator files tickets by hand from that copy, and the lane still writes findings to `.current/<lane>/pending-tickets.md` in the same block format.
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-4" — in `sec("## 4. ")`, `count(S4, copy.s4-commit-kept) === 1` and the next line equals `copy.s4-local`.
- **AC-E351-5** — Given the tool, when the new §3 and §4 claims are compared with `bin/agc-init.mjs` (read-only), then every named path list matches the tool's constants. `ARTIFACT_EXCLUDE_RULES` is `["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"]`. `SHIPPED_EVIDENCE_DIRS` is `["qa_reports", "review_reports", "specs"]`. `ABANDON_EVIDENCE_DIRS` is `["qa_reports", "review_reports"]`, with `specs` absent: that absence is the E217 gap. `STR_USAGE_FEATURE` still says a pending-tickets.md found only in the worktree "is not numbered — finish warns, lists its findings and keeps a copy under .current/history/<YYYY-MM>/<lane>/".
  proof: `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-5" — reads `bin/agc-init.mjs` as text and asserts the three `const … = [...]` literal lines plus the quoted `STR_USAGE_FEATURE` fragments. If the tool changes, the doc and the test fail together.
- **AC-E351-6** — Given the whole edit, when the hard conditions are checked, then all of them hold:
  (a) the file path is unchanged, and the `## ` heading list is exactly AC-E290-2's eight entries in order. `## 1.`, `## 3. ` and `## 4. ` keep their positions and §7 is still the last `## ` heading;
  (b) no trimmed line of the file equals a `PROMPT_TEMPLATE_3B` line (AC-E290-9), and no §1 line over 20 chars is a substring of it (AC-E294-5);
  (c) none of AC-E290-3's strings appear (`node bin/agc-init.mjs`, `npm run build`, `rm node_modules`, `dist/`, `tasks-index-receipt.json`, `check-md-tables`, `test/e130-lane-default.test.mjs`, `NEW-TICKETS.md`, `node scripts/fanout.mjs`, `註解 proof`, `compose-golden`, `context-budget`, `content/**`, `test/`);
  (d) no absolute local path appears (no line matches `/(^|[\s(（`])\/(Users|home|private|tmp|var)\//`);
  (e) the edit adds only the lines in Copy / Strings and removes only `copy.s1-old`.
  proof: `test/e290-lane-protocol-generic.test.mjs` (AC-E290-2/3/8/9) and `test/e294-lane-enterworktree.test.mjs` unchanged and green, plus `test/e351-lane-protocol-gaps.test.mjs` "AC-E351-6" for (d). For (e): `git diff main...HEAD -- docs/lane-protocol.md` shows exactly 1 removed and 5 added lines.
- **AC-E351-7** — Given the pinned strings other tests hold in the generic file, when the full suite runs, then every test listed under *Pinned strings* passes with its file unchanged.
  proof: `node scripts/test-lock.mjs -- npm test` after the last commit, with a clean tree (`git status --porcelain` empty); `git diff --stat main...HEAD -- test/` lists only `test/e351-lane-protocol-gaps.test.mjs`.
- **AC-E351-8** — Given lane scope, when the branch diff is listed, then it touches only owned paths: `docs/lane-protocol.md`, `test/e351-lane-protocol-gaps.test.mjs`, `specs/e351-lane-protocol-gaps.md`, `.current/e351/**`, `qa_reports/*E351*`, `review_reports/*E351*`. Nothing under `bin/**`, `tools/**`, `dist/**`, `content/**` or `docs/lane-protocol-addendum.md` changes.
  proof: `git diff --name-only main...HEAD` lists only those paths.

### Pinned strings (must stay byte-identical; the edit does not touch any of these lines)

| test | AC | pinned in `docs/lane-protocol.md` |
|---|---|---|
| e178a | AC11 | `每一次等人類核准的停頓，等待都要保持掛著`; `有 architect hop 的票，預審兩次`; `即使 PM 接著只派單一角色的 judge（例如只派 qa）也一樣`; `（qa 直派的 mini-chain，不寫 spec）不送 cut` |
| e178a | AC14 | ``lane 的 task id 一律是 `T-<ticket>-NN` ``; ``（票號大寫、兩位數序號，例如 `T-E178A-01`）``; `不帶票號的 id 會在 lane 之間撞名、互相覆蓋` |
| e178a | AC15 | first 400 chars contain `content/skill-integrator.md`; no `commands/integrator` (edits start at line 17, past char 400) |
| e246 | lane-protocol names mailbox lifecycle | `agc feature finish`; ``信箱在 `agc feature finish` 拆除 lane 時才會刪除`` |
| e295 | AC5 | `例如 7/14` ×1; `7/10` ×0; `-r<n>-fix` ≥1; `不要 push、不要 merge、不要發版、不要刪 worktree` ×1 |
| e296 | AC4 | `check --cut` ≥1; `信箱**永遠不傳核准**` ×1; the no-push line ×1 |
| e296 | AC10 | none in this file (render of a frozen in-test manifest); listed because the plan names it |
| e286 | AC5 | `## 7. 中途修 base（整合者把目標分支 merge 進 lane）` is the last `## ` heading and appears once; §7 needles `type: proposal`, `base-fix`, `type: ack`, `HEAD sha`, `type: close`, `git stash`, `status --porcelain`, `rev-parse HEAD`, `tw_*`, `§5 規則 3`, `§5 規則 6`, `30 分鐘`, `§3`, `建置產物`, `不開新的`, `不自己 merge`, `不改檔、不 commit` |
| e286 | AC6 | §7 `merge-base`, `...HEAD`, `不對固定的派工 base sha 算` |
| e329 | AC-E334-1/2/3, AC-E327-2 | `LP_TEMPLATE` (the `target_repo:` template line); `LP_TARGET` (the 選填 `target_repo` bullet, after `- **不要自己配 E 號**`); `LP_COMMIT` = `copy.s4-commit-kept` (×1 in §4, after `LP_TARGET`); the e246 mailbox sentence; §3 bullet starting `- **常駐測試不要釘死歷史 commit SHA**` with `git rev-parse --verify <sha>^{commit}` and no e130 path |
| e177a | AC7 | no non-blank line over 20 chars appears in the rendered prompt (new lines are new prose, not in `PROMPT_TEMPLATE_3B`) |
| e289 | AC-E289-6 | same leak rule, key unset and key set |
| e290 | AC-E290-2/3/8/9 | heading skeleton; forbidden strings; no long line in the prompt; no line equal to a template line |
| e294 | AC-E294-1..5 | §1 holds `EnterWorktree`, `path`, `feature start` (before `EnterWorktree`), `pwd`, `git branch --show-current`, `cd <worktree> &&`, `$TMPDIR`, `git -C <primary>`, `一條一條`; §1 `EnterWorktree` lines ≥60 chars |

Also read (they must stay green, but they pin no string this edit touches): e130, e177b, e342, e343, e292, e289-config-key.

## Copy / Strings

Each line is shown as it appears in the file, with its leading indentation; the indent is part of the line.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| copy.s1-old (removed) | ``   `agc` 不在 PATH 上時的呼叫方式、worktree 建好之後要先跑的建置指令（若有），見補充規則；建置指令在 worktree 裡跑。`` | current file, line 17 |
| copy.s1-fallback (replaces it, same position) | ``   `agc` 不在 PATH 上時，改用 agc 安裝位置下的 `bin/agc-init.mjs`，即 `node <agc 安裝位置>/bin/agc-init.mjs`，後面接同樣的子指令與參數；補充規則可指定本 repo 的呼叫方式。worktree 建好之後要先跑的建置指令（若有）見補充規則；建置指令在 worktree 裡跑。`` | specs/fanout-post-v4-w9.md 派工前核對 「E352 的落點」; form copied from §5 (`agc 安裝位置下的 `scripts/fanout.mjs`，即 `node <agc 安裝位置>/scripts/fanout.mjs`；補充規則可指定本 repo 的呼叫方式`) |
| copy.s3-commit-kept (unchanged) | ``- 在自己的 branch 上 commit：`.current/<lane>/` 整個目錄（E125a 之後，task 帳本 `.current/<lane>/tasks.md` 也在裡面）、`qa_reports/`、`review_reports/`、`specs/`，以及補充規則列出的 tracked 建置產物。不 commit `.current/` 頂層的工作檔，補充規則列出的例外除外。`` | current file, line 41 |
| copy.s3-local (new, directly after) | ``- **`artifacts: local` 的 repo**（`.current/.config.json` 的 `artifacts` 是 `local`：agc 的工作檔不進 repo 歷史）：`.current/`、root `tasks.md`、`qa_reports/`、`review_reports/` 被 git exclude，lane **不 commit 這些路徑**（也不要用 `git add -f` 硬加）；`specs/` 照樣 tracked，照上一條 commit。`` | Decisions D2 (i), human row 2026-10-19; `ARTIFACT_EXCLUDE_RULES` in bin/agc-init.mjs |
| copy.s3-harvest (new) | ``  - 證據不靠 commit 進到 primary，靠整合者跑 `agc feature finish` 時的收割：`--shipped` 把 worktree 裡被 ignore 又沒 tracked 的 `qa_reports/`、`review_reports/`、`specs/` 檔案複製到 primary 的 `<目錄>/archive/<lane>/`，並把 `.current/<lane>/` 整個複製到 primary 的 `.current/history/<YYYY-MM>/<lane>/`；`--abandoned` 把 `qa_reports/`、`review_reports/` 第一層檔名帶 lane 名（不分大小寫）的檔案搬進 `<目錄>/abandoned/<lane>/`（被 ignore 的在 primary 的同一路徑留一份），`.current/<lane>/` 一樣複製進 primary 的 history。`` | Decisions D2 (i); `SHIPPED_EVIDENCE_DIRS` + `planShippedEvidenceHarvest`, `planLaneClose` (`harvestSrc`), `ABANDON_EVIDENCE_DIRS` + `planAbandonEvidence` / `planAbandonEvidenceHarvest`, `planAbandonCurrentHarvest` in bin/agc-init.mjs |
| copy.s3-gaps (new) | ``  - 已知缺口：E196（`.current/<lane>/` 只有一部分 tracked 時，`--shipped` 第一次跑不會把其中被 ignore 的檔案搬進 history）；E217（`--abandoned` 不收割 `specs/`：被 ignore 的 spec 會隨 worktree 一起刪掉）。`` | Decisions D2 (i); backlog rows E196, E217 |
| copy.s4-commit-kept (unchanged) | ``- **`pending-tickets.md` 一定要 commit 進你的 branch**：只存在 worktree、從未 commit 的檔案不會配號 —— finish 警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份（不 commit），由整合者手動建票。`` | current file, line 67 (e329 `LP_COMMIT`) |
| copy.s4-local (new, directly after) | ``- **`artifacts: local` 的 repo**：`.current/` 被 git exclude，`pending-tickets.md` 進不了 branch，所以 finish 一律走上一條「從未 commit」的路徑 —— 不配號，警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份，由整合者從那份手動建票。新發現照樣寫進 `.current/<lane>/pending-tickets.md`、照同樣的 block 格式，不要改寫到別處。`` | Decisions D2 (i); `readUnallocatedFindings` (E287 O6 block) + `STR_USAGE_FEATURE` in bin/agc-init.mjs |

Tool-claim check (PM, against `bin/agc-init.mjs` at base `125b552`, read-only):
- Exclude list: `ARTIFACT_EXCLUDE_RULES = ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"]`. Its comment reads "specs/, design/ and research/ stay tracked".
- `--shipped` evidence: `planShippedEvidenceHarvest` walks each of `SHIPPED_EVIDENCE_DIRS`, recursing. A file is at risk when it is untracked and `git check-ignore` does not return 1. Each at-risk file is copied to `<dir>/archive/<ticketId>/<sub>` in the primary checkout. A plain untracked file that is not ignored is left alone (worktree remove refuses).
- `--shipped` lane dir: `planLaneClose` sets `harvestSrc` when `.current/<lane>/` has no tracked content. The apply step does `fs.cpSync(harvestSrc, histAbs, { recursive: true })` into `.current/history/<YYYY-MM>/<lane>/` (`resolveHistoryBucket` = UTC `YYYY-MM`).
- `--abandoned` evidence: `planAbandonEvidence` matches the ticket id as a bounded token, case-insensitive, on files directly under `qa_reports/` and `review_reports/`, and moves each match to `<dir>/abandoned/<ticketId>/`. `planAbandonEvidenceHarvest` sets a primary copy target at the same relative path for an untracked, at-risk file.
- `--abandoned` lane dir: `planAbandonCurrentHarvest` copies `.current/<lane>/` into the primary history dir when it has no tracked content (E194).
- Findings: `readUnallocatedFindings` returns the worktree file's findings only when the file is not at the revision finish reads. They are reported on stderr and a verified copy is kept in the lane's history dir. `STR_USAGE_FEATURE` documents the same.
- E196: `laneIgnoredStateFiles` is consulted only on the `alreadyClosed` re-run path, so on the first run a tracked lane dir is `git mv`'d and ignored siblings are not carried. That is the backlog row's gap. It does not hit a fully excluded `.current/`, which takes the `harvestSrc` copy path.
- E217: `ABANDON_EVIDENCE_DIRS` has no `specs`. Its comment cites the D2 design-record rationale; backlog E217 is the open gap.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any tool change (`bin/**`, `tools/**`, `scripts/**`, `dist/**`). E196 and E217 stay their own tickets.
- `docs/lane-protocol-addendum.md` (lane e226). Its §1 `node bin/agc-init.mjs` line already fills the slot `copy.s1-fallback` says the addendum may set. It needs no edit.
- `content/**` and SOPs, including integrator SOP 5a's local-mode reading of evidence and findings (lane e226, worded from the same D2 row).
- Declaring fan-out repo-mode only (option (ii), rejected by the human).
- The package-runner form (`npx …`) as a second fallback. One generic form matches §5. A repo whose runner differs sets it in the addendum.
- `tools/fanout-handoff.ts` generated text (not in this wave per the plan).

## Dependencies / Prerequisites

- Human ruling D2 = (i), `specs/fanout-post-v4-w9.md` Decisions, 2026-10-19. No other open question: the scope is fixed by the integrator and the human, so the Question Batch Gate is a no-op.
- Resource Audit: the inputs (backlog rows E351, E352, E196, E217, E287; the fan-out plan; the generic and addendum files; `bin/agc-init.mjs`) contain no external URLs, design links or third-party ticket references. Zero hits, so `external_refs` is omitted.
- Not a design feature: no `design/` file, mode = no-design, so the Scope Decision Gate is not armed. `scope_decision: single-feature` is still recorded on the routing write.
- Architect hop skipped: one docs file, no module, data model or API change. Route pm → sr-engineer → code-reviewer → qa-engineer.
- `dist/` unchanged, no rebuild: no TypeScript source is touched. The tests import the committed `dist/tools/fanout-manifest.js`.
- Task ids: both tickets edit the same five lines of one file in one sr session, so one build task carries both (`T-E351-01`, commit titles name `E351 E352`). QA is a separate task, because only qa-engineer writes `test/**`.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E351-01 | sr: edit `docs/lane-protocol.md` per Copy / Strings. In §1, replace `copy.s1-old` with `copy.s1-fallback` (E352). In §3, insert `copy.s3-local`, `copy.s3-harvest` and `copy.s3-gaps` directly after `copy.s3-commit-kept`. In §4, insert `copy.s4-local` directly after `copy.s4-commit-kept` (E351). No other line changes (~1 removed, 5 added). No `dist/` rebuild. Commit title carries `E351 E352` | none | 1 | `docs/lane-protocol.md` | — |
| T-E351-02 | qa: new `test/e351-lane-protocol-gaps.test.mjs` (AC-E352-1/2, AC-E351-1..6(d); ~120 lines). Verify AC-E352-3, AC-E351-6(a–c,e) through the unchanged e290/e294 tests and the diff count. Run the full suite after commit on a clean tree (AC-E351-7). Check scope (AC-E351-8). e290 and e294 are expected green unmodified; touch them only if red | T-E351-01 | 1 | `test/e351-lane-protocol-gaps.test.mjs` | — |

## Findings filed

- `E351-NEW-1` (in `.current/e351/pending-tickets.md`): under `artifacts: local`, §3's fallback for recovering a closed lane's task rows (`git log -i --grep <票號>`, release SOP 7a) finds the commits but not the rows. The lane ledger `.current/<lane>/tasks.md` is never committed and survives only in the history copy finish keeps. Out of this cut's fixed scope (D2 covers the commit and findings rules only).
