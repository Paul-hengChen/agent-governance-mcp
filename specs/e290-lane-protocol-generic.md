# e290-lane-protocol-generic

Ticket E290 (lane e290, fan-out wave 8, plan `specs/fanout-post-v4-w8.md`, dispatch base `a67d799`). Line numbers below refer to `docs/lane-protocol.md` at the dispatch base.

## Problem Statement

`docs/lane-protocol.md` is agc's lane rulebook. agc ships the whole repo, and since E289 `fanout.mjs render` points every adopter's lanes at `<agc install>/docs/lane-protocol.md`. The file still mixes rules that hold for any adopter with facts about this repo when it runs fan-out on itself: the `node bin/agc-init.mjs` call, `npm run build`, the shared-artifact list, the `test/` folder, `dist/`, the tasks-index receipt, `check-md-tables`, the `test/e130-lane-default.test.mjs` example, `NEW-TICKETS.md`, the `node scripts/fanout.mjs` call and the comment-only proof. So an adopter's lanes get told to run commands that don't exist in their repo, and this repo has no separate place for its own rules. E289 added the config key `laneProtocolAddendum` and the two-file pointer in `render`, but no addendum exists yet and the key is unset here. E290 makes the generic file true for any adopter, moves this repo's facts into `docs/lane-protocol-addendum.md`, and sets the key. The file the lane reads, the test pins and the render leak checks all stay intact.

## User Stories

- As an adopter's lane session, I want `docs/lane-protocol.md` to contain only rules that hold in my repo, so that I never run a command or follow a path that exists only in agent-governance-mcp.
- As this repo's lane session, I want the rendered prompt to point me at both the generic rules and this repo's addendum, so that I still get the `node bin/agc-init.mjs`, `npm run build`, `dist/` and shared-artifact rules I need.
- As the integrator, I want the generic file's headings, the sentences other tests pin and the prompt-leak guarantees to stay unchanged, so that the other lane in this wave (e292) and the integration CI stay green.

## Acceptance Criteria

- **AC-E290-1** — Given the lane HEAD, when the two files are checked, then `docs/lane-protocol.md` still exists at that path (E289 D2), `docs/lane-protocol-addendum.md` exists, and the addendum path does not contain the word `approval` (e296 AC10).
  proof: `test -f docs/lane-protocol.md && test -f docs/lane-protocol-addendum.md && echo docs/lane-protocol-addendum.md | grep -c approval` prints `0`.
- **AC-E290-2** — Given `docs/lane-protocol.md`, when its lines starting with `## ` are listed in order, then they are byte-identical to the dispatch base's eight: `## 1. 開工`, `## 2. 檔案邊界`, `## 3. 執行與驗證`, `## 4. 新發現`, `## 5. 信箱（lane ↔ 整合者）`, `## 6. 收工回報格式`, `## Lane report: <lane> / <票>` (inside the §6 code fence), `## 7. 中途修 base（整合者把目標分支 merge 進 lane）`. No section is added, removed or renumbered, and §7 stays the last one.
  proof: `grep '^## ' docs/lane-protocol.md` prints exactly those eight lines in that order; also test `AC-E290-2` in `test/e290-lane-protocol-generic.test.mjs`.
- **AC-E290-3** — Given `docs/lane-protocol.md`, when it is searched for each of the strings `node bin/agc-init.mjs`, `npm run build`, `rm node_modules`, `dist/`, `tasks-index-receipt.json`, `check-md-tables`, `test/e130-lane-default.test.mjs`, `NEW-TICKETS.md`, `node scripts/fanout.mjs`, `註解 proof`, `compose-golden`, `context-budget`, `content/**`, `test/`, then none is found. Given `docs/lane-protocol-addendum.md`, when it is searched for each of `node bin/agc-init.mjs`, `npm run build`, `rm node_modules`, `dist/`, `.current/tasks-index-receipt.json`, `check-md-tables`, `test/e130-lane-default.test.mjs`, `NEW-TICKETS.md`, `node scripts/fanout.mjs check --cut`, `註解 proof`, `每一行改動都是註解`, `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, then each is found.
  proof: test `AC-E290-3` in `test/e290-lane-protocol-generic.test.mjs`.
- **AC-E290-4** — Given the disposition table (Dependencies / Prerequisites, *Line disposition*), when `docs/lane-protocol.md` is diffed against the dispatch base, then every line marked `rewrite` equals its Copy string byte for byte, every line marked `delete` is gone, the `insert` lines appear right after base line 7, and every other line is unchanged. `docs/lane-protocol-addendum.md` is byte-identical to the `addendum.file` block plus one trailing newline.
  proof: code-review diff `git diff origin/main...HEAD -- docs/lane-protocol.md docs/lane-protocol-addendum.md` checked against the Copy / Strings section.
- **AC-E290-5** — Given `.current/.config.json`, when it is diffed against the merge-base, then exactly one line is added and none removed. The added line is `  "laneProtocolAddendum": "docs/lane-protocol-addendum.md",`, placed right after the `"cutApprovalAutoTier": {},` line. `loadConfig(<repo root>).laneProtocolAddendum` returns `docs/lane-protocol-addendum.md`, `getConfigError(<repo root>)` is `null`, and `schema_version` stays `2`.
  proof: `git diff --numstat origin/main...HEAD -- .current/.config.json` prints `1	0	.current/.config.json`; test `AC-E290-5` in `test/e290-lane-protocol-generic.test.mjs`.
- **AC-E290-6** (E289 D6) — Given the lane's commits, when the commit that adds `docs/lane-protocol-addendum.md` and the commit that adds the `laneProtocolAddendum` key are looked up, then they are the same single commit.
  proof: `git log --diff-filter=A --format=%h origin/main..HEAD -- docs/lane-protocol-addendum.md` and `git log -G laneProtocolAddendum --format=%h origin/main..HEAD -- .current/.config.json` each print the same one sha.
- **AC-E290-7** — Given this repo's own config (primary = repo root, default install root = repo root), when `renderPrompt` renders a frozen manifest (an in-test literal or an existing `test/fixtures/**` manifest, never a real `specs/fanout-*.md`), then the result is `ok`. The prompt contains the line built from copy `render.two-layer` (E289) with `<generic>` = `docs/lane-protocol.md` and `<addendum>` = `docs/lane-protocol-addendum.md`, namely `先完整讀 docs/lane-protocol.md（agc 通用規則，包括信箱與回報格式）和 docs/lane-protocol-addendum.md（本 repo 的補充規則），再讀 <reading> + <row>。`, and it does not contain the key-unset pointer `先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），`.
  proof: test `AC-E290-7` in `test/e290-lane-protocol-generic.test.mjs`; CLI cross-check `node scripts/fanout.mjs render test/fixtures/e177a/fanout-wave7.md e177a --summary S --reading R --primary "$PWD" --mailbox-root "$TMPDIR" --base abc1234 | grep -c '和 docs/lane-protocol-addendum.md（本 repo 的補充規則）'` prints `1`.
- **AC-E290-8** — Given the AC-E290-7 prompt, when every non-blank line of `docs/lane-protocol.md` and of `docs/lane-protocol-addendum.md` that is longer than 20 characters after trimming is searched for in the prompt, then none is found.
  proof: test `AC-E290-8` in `test/e290-lane-protocol-generic.test.mjs`.
- **AC-E290-9** — Given `PROMPT_TEMPLATE_3B`, when its non-blank lines are trimmed, then no trimmed line of either file equals any of them.
  proof: test `AC-E290-9` in `test/e290-lane-protocol-generic.test.mjs`.
- **AC-E290-10** (hard conditions, unmodified) — Given the lane HEAD, when these tests run, then all pass, and none of their files differ from the merge-base: `test/e178a-integrator-role.test.mjs` (AC11, AC14, AC15 included), `test/e246-mailbox-teardown.test.mjs`, `test/e295-hop-cap-and-sop-halves.test.mjs` (AC5), `test/e296-manifest-tier.test.mjs` (AC4, AC10), `test/e177a-manifest.test.mjs` (AC7), `test/e289-render-addendum.test.mjs` (AC-E289-6).
  proof: `git diff --quiet origin/main...HEAD -- test/e178a-integrator-role.test.mjs test/e246-mailbox-teardown.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs test/e289-render-addendum.test.mjs; echo "diff=$?"` prints `diff=0`, and `node --test` on those six files exits 0.
- **AC-E290-11** (re-pins) — Given the split, when `test/e286-integrator-trust-and-git.test.mjs` and `test/e329-integrator-sop-followups.test.mjs` run, then they pass, with only their lane-protocol assertions changed:
  - **e286 AC5**: the §7 needle `dist/` becomes `建置產物`, and the addendum's `## §7` section holds `dist/`. The last-`## `-heading and single-heading checks are unchanged.
  - **e286 AC6**: generic §7 holds `merge-base`, `...HEAD` and `不對固定的派工 base sha 算`. The addendum holds `註解 proof` and `每一行改動都是註解`.
  - **e329 AC-E327-2**: the generic §3 `- **常駐測試不要釘死歷史 commit SHA**` bullet holds `git rev-parse --verify <sha>^{commit}` and not `test/e130-lane-default.test.mjs`, and the addendum holds `test/e130-lane-default.test.mjs`. The qa SOP byte-cap half is unchanged.
  - **e294**: `test/e294-lane-enterworktree.test.mjs` passes unmodified. The new §1 keeps every needle it uses, and a pre-cut simulation showed all its assertions green. qa touches it only if it goes red.
  - **Untouched**: no SOP-side assertion (`content/skill-integrator.md`, `content/skill-qa-engineer.md`) in these files changes.
  proof: `node --test test/e286-integrator-trust-and-git.test.mjs test/e329-integrator-sop-followups.test.mjs test/e294-lane-enterworktree.test.mjs` exits 0; code review of `git diff origin/main...HEAD -- test/e286-integrator-trust-and-git.test.mjs test/e329-integrator-sop-followups.test.mjs` shows only the assertions named above changed.
- **AC-E290-12** — Given the lane's commits, when `dist/` is diffed against the merge-base, then nothing changed. E290 is docs + config + tests only, so no rebuild is committed.
  proof: `git diff --stat origin/main...HEAD -- dist/` prints nothing; after `npm run build`, `git status --porcelain dist/` prints nothing.
- **AC-E290-13** — Given the final lane HEAD with a clean working tree, when the full suite runs, then it is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 (run after commit, per lane-protocol §3).
- **AC-E290-14** — Given the lane's diff, when it is searched for machine-local absolute paths, then none is found.
  proof: `git diff origin/main...HEAD | grep -nE '^\+.*(/Users/|/home/|/private/tmp/)'` prints nothing.

## Copy / Strings

Generic-file lines (`docs/lane-protocol.md`). Leading spaces are significant: list items under `1.` keep their three-space indent, shown as `␣␣␣` and written as three spaces.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| lp.hdr-4 | `` > （票、branch、worktree、擁有／禁止的檔案、範圍切線、信箱路徑），**其餘規則都在這份文件與 repo 的補充規則（見下）**，開工前兩份都完整讀一次。 `` | authored-here — line 4 must name the second layer; `content/skill-integrator.md` stays within the first 400 chars (e178a AC15; offset 203 after the change) |
| lp.hdr-insert-a | `` > `` | authored-here — blank blockquote separator inserted after line 7 |
| lp.hdr-insert-b | `` > **repo 補充規則**：repo 可以在 `.current/.config.json` 用 `laneProtocolAddendum` 指定一份補充檔，有設時派工 prompt 會要你一起讀。補充檔只寫該 repo 的呼叫方式、指令與清單，填進本文件寫「見補充規則」的地方，不改寫本文件的規則；兩者看起來衝突時停下來，寫信箱問整合者。repo 沒有補充檔時，照本文件的通用說法做。 `` | authored-here — integrator revision §6.3 (generic + repo layers); Gate G4 (fill, never override) |
| lp.s1-13 | `` ␣␣␣cd <primary> && agc feature start <ticket-slug> --base <base> --path <worktree> `` | authored-here — generic invocation; keeps `feature start` before `EnterWorktree` (e294 AC-E294-1) |
| lp.s1-16 | `` ␣␣␣`agc` 不在 PATH 上時的呼叫方式、worktree 建好之後要先跑的建置指令（若有），見補充規則；建置指令在 worktree 裡跑。 `` | authored-here — replaces line 16 and the deleted line 14 |
| lp.s1-18 | `` ␣␣␣- **不要在 lane 裡跑會重建 `node_modules` 的安裝指令**（例如 `npm ci`）：`node_modules` 是連回 primary 的 symlink，這類指令會先刪掉整個目錄，連 primary 的一起刪。要改相依套件，先只刪掉 symlink 本身，再安裝（指令見補充規則）。 `` | authored-here — Gate G2 |
| lp.s2-34 | `` - 共享生成物（由很多來源組成、改任何一個來源都會跟著變的檔案，例如 golden 檔與 context 預算測試；清單見補充規則）同時只能有一條 lane 修改。你不是那條 lane 而它們變紅 → 停下來回報，不要 re-baseline。 `` | authored-here — list moves to the addendum |
| lp.s2-35 | `` - 只有 qa-engineer 能碰測試檔（憲法 §2；測試目錄見補充規則），跨所有 lane、無例外。 `` | authored-here — Gate G9 |
| lp.s3-40 | `` - 在自己的 branch 上 commit：`.current/<lane>/` 整個目錄（E125a 之後，task 帳本 `.current/<lane>/tasks.md` 也在裡面）、`qa_reports/`、`review_reports/`、`specs/`，以及補充規則列出的 tracked 建置產物。不 commit `.current/` 頂層的工作檔，補充規則列出的例外除外。 `` | authored-here — `dist/` and the receipt move to the addendum |
| lp.s3-44 | `` - **qa 的全套測試必須在 commit 之後、工作區沒有未追蹤檔案時跑。** 有些檢查只看已追蹤的檔案，未 commit 的檔案會被靜默跳過，結果看起來全綠（實例見補充規則）。 `` | authored-here — Gate G3 |
| lp.s3-45 | line 45 with its final sentence `` 範例見 `test/e130-lane-default.test.mjs`（E229）。 `` removed; the remaining text, up to and including `` 絕不能靜默通過。 ``, is unchanged | authored-here — Gate G3 |
| lp.s5-93 | in line 93, the substring `` lane 跑 `node scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` `` is replaced by `` lane 用 agc 的 fan-out 清單工具（`scripts/fanout.mjs`，呼叫方式見補充規則）跑 `check --cut specs/fanout-<id>.md <lane> specs/<feature>.md` ``; the rest of the line is unchanged | authored-here — keeps `check --cut` (e296 AC4) and the e178a AC11 substrings |
| lp.s7-132 | `` 3. **恢復通知**是整合者在同一議題上的 `type: close`，帶 merge sha。先確認 `git rev-parse HEAD` 等於它，再 commit 通知點名要重建的建置產物（補充規則列出的 tracked 建置產物），然後繼續。 `` | authored-here — `dist/` moves to the addendum |
| lp.s7-133 | `` 4. 目標分支（或 `main`）merge 進來之後，任何 scope 檢查一律對 merge-base 算（`git diff origin/<目標分支>...HEAD`，三個點，即整合者 merge 的 ref，不用本地分支），不對固定的派工 base sha 算，否則 merge 帶進來的檔案會被當成你越界；補充規則可能列出還要對 merge-base 算的 repo 專屬檢查。 `` | authored-here — the comment-only proof moves to the addendum |
| addendum.file | the whole fenced block below, byte-verbatim (the file ends with one newline after the last line) | authored-here — every bullet is text moved out of the generic file (dispositions below); lines 1–4 are the pointer intro |

`addendum.file`:

```markdown
# Lane protocol 補充規則（agent-governance-mcp）

> 本 repo 對 `docs/lane-protocol.md`（agc 通用規則）的補充：只填通用規則寫「見補充規則」的地方，不改寫通用規則。
> `.current/.config.json` 的 `laneProtocolAddendum` 指向本檔，`fanout.mjs render` 產生的派工 prompt 會要 lane 兩份都讀。

## §1 開工

- `agc` 在本 repo 不在 PATH 上，一律用 `node bin/agc-init.mjs` 呼叫（adopter 裝了套件後才有 `agc`），例如 `cd <primary> && node bin/agc-init.mjs feature start <ticket-slug> --base <base> --path <worktree>`。
- worktree 建好之後，先在 worktree 裡跑 `npm run build`。
- 要改相依套件：先 `rm node_modules`（只刪 symlink），再 `npm ci`；不要直接在 lane 裡跑 `npm ci` / `npm install`。

## §2 檔案邊界

- 共享生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`。
- 測試目錄是 `test/`（含 `test/fixtures/**`），只有 qa-engineer 能碰。

## §3 執行與驗證

- tracked 建置產物是 `dist/`（`npm run build` 產生，`npx` 使用者直接執行它），在自己的 branch 上和原始碼一起 commit。
- `.current/` 頂層唯一要 commit 的例外是 `.current/tasks-index-receipt.json`（E125a 的反向遷移 receipt，tracked）。
- 只看已追蹤檔案的檢查：`check-md-tables` 等只看 `git ls-files`（Wave 5 的 E174：commit 前 2417/2417，commit 後 2415/2417）。
- 常駐測試釘歷史 SHA 的例外，範例見 `test/e130-lane-default.test.mjs`（E229）。

## §4 新發現

- root 的 `NEW-TICKETS.md` 已退役，**不要再寫**；新發現只寫 `.current/<lane>/pending-tickets.md`。

## §5 信箱

- `fanout.mjs` 在本 repo 用 `node scripts/fanout.mjs …` 呼叫，例如 cut 預審之後跑 `node scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md`。

## §7 中途修 base

- 恢復通知點名要重建的建置產物就是 `dist/`：確認 HEAD 之後把它 commit 掉。
- merge-base 規則也適用註解 proof 腳本：它一樣對 merge-base 算，另外斷言每一行改動都是註解（只比對去掉註解後的編譯產物，連只改型別註記的改動也會過）。
```

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The integrator SOP's lane-protocol wording (`content/skill-integrator.md` lines 101, 105, 109: the two-layer phrasing). Lane e292 owns it.
- `docs/config.md`, including the `laneProtocolAddendum` section wording (E342, lane e292).
- Any other repo-specific sentence in an SOP: the integrator's Stage 1 shared-artifact list, Stage 4 `npm run build` / `npm audit`, Stage 6 `node bin/agc-init.mjs`, the `node scripts/*.mjs` calls, and the PM SOP's `node scripts/fanout.mjs check --cut`. These are filed as findings (below), not fixed here.
- New rules. The addendum holds only text moved out of the generic file plus its intro. For example, the `test-lock` wrapper and the Node 20 / 22 CI note are not added.
- Re-opening E327. It is DONE: the qa SOP names the historical-sha exception, and the meaning of lane-protocol §3 stays as it is. E290 only moves the §3 example into the addendum.
- `render` / `tools/**` changes (E343 is lane e292), and any `dist/` rebuild.
- Renaming `docs/lane-protocol.md` (it must stay, E289 D2), and adding, removing or renumbering any `##` section.

## Dependencies / Prerequisites

- **E289 shipped**: `laneProtocolAddendum` in `tools/config.ts`, plus the two-layer pointer and the install-root resolution in `tools/fanout-manifest.ts` (`LANE_PROTOCOL_POINTER_TWO_LAYER`). Confirmed in `dist/` at base `a67d799`.
- **E294 shipped** (the EnterWorktree wording in §1, pinned by e294).
- **D6 (E289)**: the key and the addendum file land in the same commit, or e296 AC10 (render with `--primary <repo root>`) exits 2 with `ADDENDUM_ABSENT`.
- **Expected red between the two tasks**: after T-E290-01 and before T-E290-02, `test/e286-integrator-trust-and-git.test.mjs` AC5 / AC6 and `test/e329-integrator-sop-followups.test.mjs` AC-E327-2 fail by design: they pin text that moved. Every other test stays green, including e296 AC10 and e177a AC7.
- **Pre-cut simulation (PM, scratch copies only)**: the proposed generic file and addendum were checked against the e178a AC11 / AC14 / AC15, e246, e295 AC5, e296 AC4, e294 needles, the AC-E290-3 needles, the template-line rule and the two-file leak check with a two-layer render. All passed.
- **Cross-lane**: e292 rewrites the integrator SOP's two-layer sentences using the shipped key name, independent of this file's content. e296 AC10 is first verified with both lanes merged by the integration CI.
- **No `dist/` change**: docs + config + tests only.
- **Resource audit**: no external references. Every reference is a repo path read at the dispatch base, so `external_refs` is omitted.

### Line disposition (base `a67d799`)

Classification rule (Gate G1): **agc fact** means it holds in every agc install. The agc install ships the whole repo, so `content/skill-integrator.md`, the constitution, the release SOP and the `docs/backlog.md` written by `agc feature finish` exist in every install, and E-number provenance tags point at agc's own backlog. Agc facts stay in the generic file. **Repo fact** means it is true only when this repo runs fan-out on itself. Repo facts move to the addendum, and the generic file keeps a generic rule pointing at 補充規則.

| line | content (short) | class | disposition | string id / addendum line |
|---|---|---|---|---|
| 4 | `其餘規則都在這份文件` | agc fact, incomplete once a second layer exists | rewrite | lp.hdr-4 |
| 5 | integrator SOP `content/skill-integrator.md`, constitution §6 | agc fact (ships in every install; e178a AC15) | keep | — |
| 7 (after) | — | new: what the second layer is | insert 2 lines | lp.hdr-insert-a, lp.hdr-insert-b |
| 13 | `node bin/agc-init.mjs feature start …` | repo fact (agc not on PATH here) | rewrite to `agc feature start …`; repo call → addendum | lp.s1-13; addendum §1 bullet 1 |
| 14 | `cd <worktree> && npm run build` | repo fact | delete; → addendum | addendum §1 bullet 2 |
| 16 | `agc` not on PATH in this repo | repo fact | rewrite to generic pointer | lp.s1-16; addendum §1 bullet 1 |
| 17 | what `feature start` does (node_modules link, `.env`, exclude) | agc fact (tool behaviour) | keep | — |
| 18 | don't run `npm ci` / `npm install` | hazard = agc fact (feature start's symlink); exact commands = repo fact | rewrite (G2); recovery commands → addendum | lp.s1-18; addendum §1 bullet 3 |
| 19–27 | worktree path rule, EnterWorktree, git guard, lane name, `workspace_path`, fallback, `HANDOFF_LAYOUT_CONFLICT` | agc fact (e294-pinned) | keep | — |
| 33 | `docs/backlog.md` never touched | agc fact (finish writes it) | keep | — |
| 34 | shared artifacts (`content/**`, compose-golden, context-budget) | repo fact | rewrite to generic definition; list → addendum | lp.s2-34; addendum §2 bullet 1 |
| 35 | only qa touches `test/` | rule = agc fact (constitution §2); `test/` = repo fact | rewrite (G9); folder → addendum | lp.s2-35; addendum §2 bullet 2 |
| 39 | `/teamwork` chain, human approval typed in lane | agc fact | keep | — |
| 40 | commit list incl. `dist/` + `.current/tasks-index-receipt.json` | `dist/` and receipt = repo fact; the rest = agc fact | rewrite; `dist/`, receipt → addendum | lp.s3-40; addendum §3 bullets 1–2 |
| 41 | task id `T-<ticket>-NN` | agc fact (e178a AC14) | keep | — |
| 42 | commit title carries ticket; `git log -i --grep`; release SOP 7a, E125c | agc fact (E-tag = agc provenance) | keep | — |
| 43 | root `tasks.md` is a history index (E125a) | agc fact | keep | — |
| 44 | full suite after commit; `check-md-tables`; Wave 5 E174 numbers | rule = agc fact; instance = repo fact | rewrite (G3); instance → addendum | lp.s3-44; addendum §3 bullet 3 |
| 45 | historical-SHA exception; example `test/e130-lane-default.test.mjs` (E229) | rule = agc fact (matches qa SOP item f, E327); example = repo fact | rewrite (drop last sentence); example → addendum | lp.s3-45; addendum §3 bullet 4 |
| 46 | hop cap / same-lane continuation (E295) | agc fact | keep | — |
| 47 | no push / merge / release / worktree delete | agc fact (e295 AC5, e296 AC4) | keep | — |
| 51–66 | `pending-tickets.md`, E179, `target_repo`, finish allocation, `.current/history/…` | agc fact (lines 65–66 pinned by e329) | keep | — |
| 67 | root `NEW-TICKETS.md` retired | repo fact (legacy file of this repo) | delete; → addendum | addendum §4 bullet 1 |
| 71–92, 94–105 | mailbox format and rules | agc fact (e178a AC11, e246, e296 AC4) | keep | — |
| 93 | `node scripts/fanout.mjs check --cut …` | the call path is repo fact; `check --cut` + manifest tier = agc fact | rewrite substring | lp.s5-93; addendum §5 bullet 1 |
| 109–124 | report format | agc fact | keep | — |
| 128–131 | base-fix pause / ack | agc fact (e286 AC5) | keep | — |
| 132 | commit the rebuilt `dist/` | repo fact (`dist/`) | rewrite to 建置產物; `dist/` → addendum | lp.s7-132; addendum §7 bullet 1 |
| 133 | merge-base scope rule + comment-only proof | merge-base rule = agc fact; comment-only proof = repo fact | rewrite; comment-only proof → addendum | lp.s7-133; addendum §7 bullet 2 |

All other lines (blank, headings, code fences, §1 items 2–6 not listed) are kept byte-identical.

### Findings filed (`.current/e290/pending-tickets.md`)

- `E290-NEW-1`: integrator SOP repo-specific sentences outside the e292 two-layer lines.
- `E290-NEW-2`: the PM SOP's Manifest-Tier row calls `node scripts/fanout.mjs` repo-relative.
- `E290-NEW-3`: the lane-protocol commit rules assume `artifacts: repo`.

## Gate Summary (option choices)

| # | choice | decision | why |
|---|---|---|---|
| G1 | which facts are "repo-specific" | **Two roles.** Facts about agc (the integrator SOP path, the constitution, the release SOP, `docs/backlog.md` written by finish, E-number provenance tags) stay generic. Facts about this repo running fan-out on itself (calls, build, shared artifacts, test folder, `dist/`, receipt, `check-md-tables`, the e130 example, `NEW-TICKETS.md`, the fanout call, the comment-only proof) move | agc ships the whole repo, so the first group is true in every install. The second group is wrong in an adopter's worktree |
| G2 | line 18 (`npm ci`) | **Split**: the hazard stays generic, the exact recovery commands go to the addendum | `agc feature start` symlinks `node_modules` in every adopter that has one, so the hazard is agc behaviour. `rm node_modules` then `npm ci` is this repo's recipe |
| G3 | lines 44 / 45 (rule + instance) | the rule stays generic, the instance/example moves; E327 is not re-opened | E327 is DONE (qa SOP item f names the exception, §3 meaning unchanged). E290 only removes the repo example from the generic text |
| G4 | addendum vs generic precedence | **The addendum fills in, never overrides.** On an apparent conflict, stop and use the mailbox. The prompt's lane fields still win (line 7 unchanged) | avoids a third precedence tier, and keeps the generic rules authoritative for every adopter |
| G5 | addendum layout | sections `## §1 開工` … `## §7 中途修 base`, keyed to the generic section numbers, only where content exists (§1–5, §7) | a lane reads the matching section next to the generic one; no test pins the addendum's headings |
| G6 | new content in the addendum | **None** beyond moved text and the 2-line intro | keeps E290 a move, not a rule change; anything new goes to its own ticket |
| G7 | e294 | expected green unmodified. Owned, but touched only if red | simulation: every §1 needle (`feature start`, `EnterWorktree`, `cd <worktree> &&`, `$TMPDIR`, `git -C <primary>`, `一條一條`, the ≥60-char rule) survives |
| G8 | config edit shape | one inserted line after `"cutApprovalAutoTier": {},`; no reformatting, no schema bump | E289 G1 (no bump); "only that one key" is provable by `--numstat` `1 0` |
| G9 | line 35 `test/` | generic says 測試檔, addendum names `test/` | adopters use `tests/`, `__tests__`, etc.; the rule (constitution §2) is generic |
| G10 | architect hop | **skipped** | docs + one config line + tests; no module, data model or API change |
| G11 | `dist/` | **no change, no rebuild** | no TypeScript source is touched |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E290-01 | sr: rewrite `docs/lane-protocol.md` per the Line disposition table (Copy strings verbatim); create `docs/lane-protocol-addendum.md` byte-verbatim from `addendum.file`; insert the single `laneProtocolAddendum` line into `.current/.config.json`. All three in ONE commit (E289 D6). No `dist/` change. Expected red until T-E290-02: e286 AC5/AC6, e329 AC-E327-2 | none | 3 | `docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`.current/.config.json` | — |
| T-E290-02 | qa: new `test/e290-lane-protocol-generic.test.mjs` (AC-E290-2, 3, 5, 7, 8, 9); re-pin only the lane-protocol assertions of e286 AC5/AC6 and e329 AC-E327-2 (AC-E290-11); e294 untouched unless red; verify AC-E290-1, 4, 6, 10, 12, 14; full suite after commit (AC-E290-13) | T-E290-01 | 3 | `test/e290-lane-protocol-generic.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e329-integrator-sop-followups.test.mjs` | — |
