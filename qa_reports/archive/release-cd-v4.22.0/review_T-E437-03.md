covers: T-E437-01, T-E437-02, T-E438-01, T-E438-02, T-E438-03, T-E439-01, T-E439-02, T-E440-01, T-E437-03, T-E438-04, T-E439-03, T-E440-02, T-E440-03

# QA review — e437-prompt-content-hygiene（E437 → E438 → E439 → E440，單一 lane、單一 cut）

Base `41c301e`；code-reviewer round 1 APPROVED（`review_reports/review_T-E437-01.md`）。QA 五個任務依序完成：T-E437-03 → T-E438-04 → T-E439-03 → T-E440-02 → T-E440-03。八個 build 任務由 code review 加上本次逐站驗證覆蓋。

## Expected-Red Diff

Phase 0.5：manifest `qa_reports/expected-red_e437-prompt-content-hygiene.txt` 存在。於任何 re-baseline 編輯之前，在 `0ceb255` 之後的樹（HEAD `15e1079`）跑完整套件：`node scripts/test-lock.mjs -- npm test` → 4228 tests / 4194 pass / 32 fail / 2 skipped。實際紅燈集合與 manifest 的 32 筆逐筆比對。

Phase 0.5: clean (32/32 manifest entries confirmed red, 0 unexplained reds)

- 12 筆 golden byte-identity（compose-equivalence 11 + skill-manifest 1）：確認為紅，T-E440-03 以 golden 重新擷取轉綠（兩個測試檔均未編輯）。
- 4 筆 context-budget（AC2 lean、AC8 non-design floor、AC-P2-2、AC-P2-3）：確認為紅，T-E440-03 re-baseline / re-pin 後轉綠；AC7 x2 與 AC2/AC4（design-arm §3.2 span）依 R1 = b 未紅、未動。
- E437 re-pin 2 筆（e408 AC5、qa-visual-skill-split AC-2）、E438 re-pin 12 筆、E440 re-pin 2 筆：全部確認為紅並已於對應 QA 任務 re-pin 後轉綠。
- 無任何未列入 manifest 的紅燈；環境專用的 8 筆（agc-adapters、check-md-tables、e234、e258b、e295、e299、release-staging）在此 worktree 為綠，不需處置。
- e436 擁有的測試（feature-lease S4 / E9A-S4 / E9A-S5 / E17-S3 / E17-S4、subagent-templates e9a AC2）全綠，未編輯。

## AC → 測試對照

| AC | 測試 |
|---|---|
| AC-E437-1 | `test/e437-repo-only-paths.test.mjs`（13 站逐站 + bundle 層 buildPromptForRole） |
| AC-E437-2 | 同檔 lite.md 測試 + 重新釘選的 `e408 AC5`；`e409`、`teamwork-lite`、`subagent-templates` lite 釘選維持綠 |
| AC-E437-3 | 同檔 qa-visual FAIL note 測試 |
| AC-E438-1/2 | `test/e438-origin-fenced-labels.test.mjs`（45 站：wrap 站驗 fence 與 dispatch 行無 label；刪除站 36、45；改名站 17/39/40/42） |
| AC-E438-3 | 同檔 rename 測試 + bundle 標題存在測試 + grep |
| AC-E439-1/2 | `test/e439-rationale-fenced-stories.test.mjs`（10 站 x 3：story 在 fence 內、dispatch 無 story、規則原文仍在、full-detail 仍含 story；site 5 標點例外；site 1 R1 = b 刪除） |
| AC-E439-3 | `test/render-structure.test.mjs` 15/15 綠且該檔無變更；e439 檔另釘 site 3 / 8 的 fence 形狀 |
| AC-E440-1/2 | `test/e440-current-rule-wording.test.mjs`（6 站 + 舊用語全域 grep + legacy-inert 原文） |
| AC-ALL-1..5 | 見下方 AC Execution Log |

## 重新釘選清單（只改被釘的字串，保留原本斷言的性質）

- E437：`e408 AC5`、`qa-visual-skill-split AC-2`。
- E438：`widget-shape-spec`（AC-1、AC-2、R5，R5 另加 stripped 標題斷言）、`phase-0-5-sop AC-4`、`qa-visual-skill-split AC-3`、`design-auditor-volume-guard AC-1`、`feature-lease S5`（僅 S5）、`e178a AC9`、`e226 AC-E226-2`、`e288 AC-E288-1`、`e355 AC-E355-2`、`e407 AC4`。
- E440：`e130-lane-default AC7`、`subagent-templates AC4`（e9a AC2 未動）。
- 預算：`context-budget` AC2 lean、AC1/AC2 pm 與 sr、AC8 design-arm、AC8 teamwork、AC8 non-design、design-only saving floor、AC-P2-2、AC-P2-3。AC7 x2 與 AC2/AC4 依 R1 = b 未動。

## Golden 重新擷取（一次，T-E440-03）

`npm run build && node scripts/capture-constitution-golden.mjs` 一次，12 個 `test/fixtures/compose-golden/*.txt` 同一個 commit（`697a88b`）。共 12 檔、20 個相異 hunk（字詞級 diff 去重），每個都對得到表格中的 ticket + site，沒有無法歸屬的 hunk：

| hunk | 出現在 | 歸屬 |
|---|---|---|
| `exception (v3.14.0)**:` → `exception**:`（dispatch / design 4 檔）；→ `exception<!-- origin -->(v3.14.0)<!-- origin -->**:`（monolith、hook-full、hook-lite） | 4 + 3 | E438 site 1 |
| `(the v3.16.0` → 移除 / 包 origin fence | 2 + 2 | E438 site 2 |
| `tool; E25).` → `tool).` / 包 origin fence | 8 + 3 | E438 site 3 |
| `rationale), with no remaining routing convention.` → `rationale) and carries no routing.` | 11 | E440 site 6 |
| 刪除 `; the exact predicate lives in gates/stamp-provenance.ts, …` | 6 | E437 site 2 |
| 刪除 `Full matrix: specs/qa-flow-enforcement-architecture.md.` | 6 | E437 site 1 |
| 刪除 §3.2 前言段（5 行） | 4（design、design-fd、monolith、hook-full） | E439 site 1（R1 = b：刪除，非 fence） |
| coord-02：`templates/claude-code-agents/` → `<agc install>/templates/claude-code-agents/`；刪 `in tools/transitions.ts` | skill-coordinator-monolith | E437 sites 3、4 |
| coord-02：刪 `(the pending_notes pin convention is retired, C14)` | 同上 | E440 site 5 |
| coord-02：`read (E300).` 包 fence | 同上 | E438 site 4 |
| coord-03：刪 `This is the pre-v3.20.0 behavior…`；`signal (E99):` 包 fence | 同上 | E440 site 2；E438 site 5 |
| coord-03：刪 `— the old in-memory counter is retired` | 同上 | E440 site 3 |
| coord-03：`Gate** (E1):` 包 fence | 同上 | E438 site 6 |
| coord-03：`time** (E179):` 包 fence；`The root NEW-TICKETS.md convention is retired` → `A root NEW-TICKETS.md is not a channel` | 同上 | E438 site 7；E440 site 4 |
| coord-03：`main** (E297):` 包 fence；`tree (E301).` 包 fence | 同上 | E438 sites 8、9 |
| coord-05：`reconcile* (R10):` 包 fence | 同上 | E438 site 10 |

關於 reviewer 備註的 E439 site 8（skill-design-auditor:59-60 block-style fence）：12 個 golden 都只含 constitution 與 coordinator 內容，沒有 design-auditor / sr-engineer 技能本文，因此該站在任何 golden 裡都沒有 hunk（「一個空格變換行」並未出現在 golden）。AC-E439-2 的 golden 面只剩 site 1（R1 = b 刪除）；site 2-11 的 full-detail 行為由 `test/e439-rationale-fenced-stories.test.mjs` 直接對 skill 檔的 full-detail 輸出驗證（story 仍在 marker 之間），site 3 / 8 的 fence 形狀另有專門斷言。

## 預算重新量測（chars/4，與 context-budget 測試完全相同的算法）

| cap / floor | 舊值 | 量測值 | 新值 | 依據 |
|---|---|---|---|---|
| AC2 lean always-on（cap） | 5731 | 5761 | 5761 | ruling 2 = a，零 headroom（lean 為 raw 組合，新 fence marker 計入位元組） |
| skill-pm stripped（cap） | 4849 | 4791 | 4791 | 收緊至量測值（檔內規則） |
| skill-sr-engineer stripped（cap） | 2852 | 2816 | 2816 | 收緊 |
| stripped constitution, design arm（cap） | 9533 | 9387 | 9387 | 收緊 |
| teamwork bundle（cap） | 19225 | 19012 | 19012 | 收緊 |
| non-design constitution（cap） | 7533 | 7484 | 7484 | 收緊 |
| design-only strip saving（floor） | 1999 | 1903 | 1903 | R2 = a（2026-11-18），重新基線 |
| constitution rationale+origin saving（floor） | 240 | 442 | 240 | 不動 |
| design − non-design sr bundle（floor） | 1830 | 2066 | 1830 | 不動 |
| dual-injection saving（floor） | 1200 | 4171 | 1200 | 不動 |

與 spec 試算相比只有 lean 與 pm 差 1~2 tok（cut 時加入的 site 11 定義、sites 42-45）。每個改動的值都附 `E437-E440 re-baseline` 註解並引用 ruling 2 = a / R2 = a。

## AC Execution Log

| AC | 指令 | 結果 |
|---|---|---|
| AC-E437-1..3 | `node --test test/e437-repo-only-paths.test.mjs` | 15/15 pass，exit 0 |
| AC-E438-1..3 | `node --test test/e438-origin-fenced-labels.test.mjs` | 45/45 pass，exit 0 |
| AC-E438-3 grep | `grep -rn "§1 v3.14.0 exception\|§1 v3.28.0\|sr-engineer R5" content templates` | 無輸出，exit 1（即無命中） |
| AC-E439-1/2 | `node --test test/e439-rationale-fenced-stories.test.mjs` | 23/23 pass，exit 0 |
| AC-E439-3 | `node --test test/render-structure.test.mjs`；`git diff 41c301e...HEAD --stat -- test/render-structure.test.mjs` | 15/15 pass；該檔無 diff（debt list 未動） |
| AC-E440-1/2 | `node --test test/e440-current-rule-wording.test.mjs` | 9/9 pass，exit 0 |
| AC-E440-1 grep | `grep -n "pre-v3.20.0\|is REMOVED\|is retired\|no remaining routing convention" content/*.md` | 無輸出，exit 1 |
| AC-ALL-1 | `npm run build`；`git status --porcelain dist` | 無輸出（dist 零 diff） |
| AC-ALL-2 | 一次 `node scripts/capture-constitution-golden.mjs` 後 commit；compose-equivalence 與 skill-manifest 的 golden byte-identity 測試在 commit 後的完整套件中全綠（不重複擷取，遵守「僅一次」） | pass |
| AC-ALL-3 | `node --test test/context-budget.test.mjs` | 54/54 pass，exit 0 |
| AC-ALL-4 | `node scripts/test-lock.mjs -- npm test`（commit 後乾淨樹，數字見 evidence 首行）；`npm audit --audit-level=high` → exit 0；`npm run check:bookkeeping` → OK，exit 0 | 見上 |
| AC-ALL-5 | `node scripts/fanout.mjs check --cut specs/fanout-prompt-audit-fixes.md e437 specs/e437-prompt-content-hygiene.md` → 4 ticket(s), 53 token(s), 0 out of bounds，exit 0；`git diff 41c301e...HEAD --name-only` 對禁止清單的 grep 僅命中 `templates/claude-code-agents/lite.md`（允許） | pass |

## Phase 1.5 / 3.5 / Copy-Visual 稽核

- Phase 1.5：skipped (no Visual Baselines declared)。
- Copy Audit：spec Copy / Strings 六列（lite SOP 路徑、lite watermark 路徑、qa-visual FAIL note、三個 rename、e440 六句）逐字比對實作，均一致；沒有 spec 未列的新使用者可見字串。Visual Tokens / Widgets：N/A。
- Phase 3：新增 4 個測試檔（`test/e437-repo-only-paths.test.mjs`、`test/e438-origin-fenced-labels.test.mjs`、`test/e439-rationale-fenced-stories.test.mjs`、`test/e440-current-rule-wording.test.mjs`）共 92 個測試；本 lane 無 TypeScript 變更，行覆蓋率不適用。
- 邊界測試：bundle 層以 `buildPromptForRole` 與 `applyTextTransforms` 驗證 dispatch / full-detail 雙路徑；移除型編輯另驗證刪除後句子仍完整（無孤兒片段）。

## 觀察（不構成 FAIL）

- `content/skill-sr-engineer.md:29` 的 `**AC6 escape**` 是既有的 AC id 當名稱使用，位於 45 個 cut 站之外（與 pending_notes 一致，僅報告、不開票）。
- 第一個 QA commit（`bb11826`）順帶包含 `qa-visual-skill-split AC-3` 的 re-pin（屬 E438，commit 標題僅寫 E437）；內容正確，只是分組歸屬略有出入。
## 2026-11-18T07:10:28.410Z — PASS — by qa-engineer

suite-result: 4318/4320 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

QA PASS for e437-prompt-content-hygiene (E437-E440, base 41c301e). Full detail: qa_reports/review_T-E437-03.md (covers all 13 tasks; includes ## Expected-Red Diff and ## AC Execution Log). Phase 0.5: clean (32/32 manifest entries confirmed red before any edit, 0 unexplained reds). New tests: e437 (15), e438 (45), e439 (23), e440 (9). 17 test files re-pinned; context-budget re-baselined per ruling 2 = a / R2 = a (lean 5731->5761, pm 4849->4791, sr 2852->2816, design const 9533->9387, teamwork 19225->19012, non-design 7533->7484, design-only floor 1999->1903; AC7 x2 and AC2/AC4 untouched per R1 = b). 12 goldens re-captured once; all 20 distinct hunks attributed to E437 s1-s4, E438 s1-s10, E439 s1 (R1 = b deletion), E440 s2-s6; no unattributable hunk; E439 site 8 has no golden hunk (goldens carry no design-auditor/sr skill text). AC-ALL: dist zero diff, npm audit exit 0, check:bookkeeping exit 0, fanout check --cut exit 0, scope diff only lite.md from templates. Final suite on clean committed tree: 4320 tests, 4318 pass, 0 fail, 2 skipped.

