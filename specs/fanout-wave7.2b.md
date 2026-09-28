# Fan-out: v4.0.0 Wave 7.2b（integrator 正式化 ∥ E223）
base: 67f4cee    integration branch: 每條 lane 各一條 integ/wave7-<lane>

**狀態：人類核准 2026-09-27（D8–D11 與本清單）。** 取代 `specs/fanout-wave7.2.md` 的「7.2b（暫定）」段。

## 派工前核對（整合者，2026-09-27）
- `git worktree list` 只有 primary；main = origin/main = `67f4cee`；工作樹乾淨；primary handoff 停在 `release-v4-wave6`（v3.119.0 已發版，lease 已過期），drift 無。
- 前置全到齊：e130 `5f9a21c`、e178b `fcfef80` 已合併；E222 把 `test/e130-lane-default.test.mjs` 的 AC4／AC14 釘在 `121ddc8..5896bdd`，本波動 `.claude/commands/integrator.md`／`CLAUDE.md` 不會讓它紅。
- `content/skill-integrator.md`、`prompts/integrator.ts` 不存在（新建）；`docs/lane-protocol.md`、`.claude/commands/integrator.md` 存在（`.claude/` 底下只有後者 tracked）。
- §6 在 `content/const-15-core-tail.md:12`（core 片段，lite 與 chain 都組進 → 兩種模式的 golden／budget 都動）；目前無 `update-ref`、無 `commit --amend` 的字樣。
- 會被牽動的既有測試：`test/release-staging.test.mjs:99`（`NON_SOURCE_DIRS` 的 `.claude/`，註解寫明「interim until E178」）、`test/skill-evolution-v3.11.test.mjs`、`test/render-structure.test.mjs`、`test/skill-manifest.test.mjs`、`test/context-budget.test.mjs`、goldens；E223：`test/e178b-lane-watch.test.mjs:432`（unknown key → 64 的 AC）。
- 指向暫行檔的引用：`docs/lane-protocol.md:5`、`tools/fanout-manifest.ts:67`（註解，內建模板的出處）。
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。`scripts/fanout.mjs`、`scripts/lane-status.mjs --watch`、`scripts/mailbox-watch.mjs` 在 base 上存在。
- **監看**：`scripts/mailbox-watch.mjs`（信箱）＋ `scripts/lane-status.mjs --watch --lanes e178a,e223`（handoff 狀態轉換，E178b 已工具化；原型 `agm-lanes/lane-state-watch.mjs` 退役）。
- task id 帶票號：`T-E178A-NN`、`T-E223-NN`。

## Lanes（7.2b，並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e178a | E178a（E178 的 (1)–(8)，含 E192） | feat/e178a-integrator-role | ../agm-lanes/e178a | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`prompts/integrator.ts`、`tools/registry.ts`、`tools/fanout-manifest.ts`、`dist/prompts/**`、`dist/tools/registry.*`、`dist/tools/fanout-manifest.*`、`docs/lane-protocol.md`、`.claude/commands/integrator.md`、`CLAUDE.md`、`AGENTS.md`、`test/release-staging.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/render-structure.test.mjs`、`test/skill-manifest.test.mjs`、`test/e178a-*.test.mjs`、`specs/e178a-*`、`qa_reports/*E178A*`、`review_reports/*E178A*`、`.current/e178a/**` | `bin/**`、`gates/**`、`templates/**`、`scripts/**`、其他 `prompts/**`、其他 `tools/**`（只能 import）、其他 `dist/**`、`package.json`、`docs/backlog.md`、`docs/v4.0.0-*.md`、`specs/fanout-*.md`、e223 的檔案 | 做：(1) `content/skill-integrator.md`（帶過暫行 SOP 的原意段、工作總覽與權限表）；(2) `integrator` MCP prompt（`prompts/integrator.ts` ＋ `PROMPT_REGISTRY` 一筆），prompt 數 11→12 的敘述同步（`CLAUDE.md`／`AGENTS.md`）；(3) §6 修憲：merge（`--no-ff`／`--ff-only`）、`switch -c`、`worktree remove`（無 `--force`）、`branch -d`、`update-ref -d <ref> <expected-sha>` **只授權給 integrator**，並明寫 `commit --amend` 的處置（Wave 7.2 觀察）；(4) 合併解法有實質內容 → 派 code-reviewer 審 merge commit；(5) 信箱協定＋cut 預審正式化（close／reopen、close 前每條 AC 都有實作任務、architect 兩段預審、訊息帶 `hop:`、lane 監看涵蓋人類核准期間、單角色 qa lane 是否送 cut）；(6) 決策權表；(7) E192 驗證 subagent —— **通用只讀 agent（D10）**，五條約束引用 E192 row；(8) `T-<票號>-NN` 寫進 `docs/lane-protocol.md`；退役 `.claude/commands/integrator.md`（刪除或只指向正式角色），`docs/lane-protocol.md:5`、`tools/fanout-manifest.ts:67` 的出處改指正式 SOP，`.claude/` 在 `NON_SOURCE_DIRS` 的分類隨之調整；goldens 與 budget floor 同一次重蓋。**引用** E124／E125／E126／E177a／E177b／E178b 的機制，不重述。不做：`integrator` 進 `tw_switch_role`／`agent_id` enum（D11：只是 prompt，不寫狀態）；專用驗證者模板（D10）；E223（另一條 lane）；E205、E133、E209、E224 | e130 ✓、e178b ✓ |
| e223 | E223 | feat/e223-watch-rearm-gone | ../agm-lanes/e223 | `tools/lane-status.ts`、`scripts/lane-status.mjs`、`dist/tools/lane-status.*`、`test/e178b-lane-watch.test.mjs`、`test/e223-*.test.mjs`、`specs/e223-*`、`qa_reports/*E223*`、`review_reports/*E223*`、`.current/e223/**` | `content/**`、goldens、budget、`bin/**`、`prompts/**`、`tools/registry.ts`、其他 `tools/**`（只能 import）、其他 `scripts/**`、其他 `dist/**`、`docs/**`、`package.json`、`.claude/**`、`CLAUDE.md`、`AGENTS.md`、`specs/fanout-*.md`、e178a 的檔案 | 做：預設 watch 集合（每個 worktree）下，重掛時 `--baseline` 裡的 key 指向已不存在的 lane → 印 `[<lane>] gone`（視為上次監看後關閉），不再 exit 64；`--lanes` 集合維持現狀（缺席的 lane 本來就持續監看，那裡 unknown key 只防打錯字）；更新 e178b AC5 對應的測試。不做：改監看的其他語意、`mailbox-watch.mjs`、任何 SOP 散文 | e178b ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- `prompts/integrator.ts`（L-RENDER）、`tools/registry.ts`（L-STATE）、`tools/fanout-manifest.ts`（E177a 新建，只改出處註解）→ e178a：本波沒有其他 lane 碰它們。
- `tools/lane-status.ts`、`scripts/lane-status.mjs`、`test/e178b-lane-watch.test.mjs` → e223（D9：E223 從 E178a 拆出成獨立 lane；原 7.2b 暫定段把它們劃給 e178a）。
- `dist/**` 按**檔案**切給兩條 lane（各自只 commit 自己原始碼對應的產物）；兩邊對 `dist/` 其他檔案的重建應為零差異，有差異 → 信箱回報。整合後照例重建一次。
- 四個既有測試檔（release-staging、skill-evolution-v3.11、render-structure、skill-manifest）→ e178a：只有 qa 能改（§2）。

## 完成定義 → 票
| 完成定義條目（計劃 Wave 7 派工卡／§9） | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator 是正式角色 —— SOP 在 `content/` | E178a (1) | ✓ 7.2b |
| git 權限寫進 §6 且只授權給它 | E178a (3) | ✓ 7.2b |
| `.claude/commands/integrator.md` 已刪除或改成只指向正式角色 | E178a 退役項 | ✓ 7.2b |
| 驗證 subagent（E192）寫進正式 SOP | E178a (7) | ✓ 7.2b |
| 任何 workspace 都能呼叫（PACKAGING，`PROMPT_REGISTRY`） | E178a (2) | ✓ 7.2b |
| task id 帶票號寫進 lane-protocol | E178a (8) | ✓ 7.2b |
| E223 re-arm 不再 exit 64（人類裁決放進 v4） | E223 | ✓ 7.2b |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 兩條都合併後：重建 `dist/`、重啟 primary MCP server（`integrator` prompt 才叫得到）；計劃文件勾 Wave 7 最後一格並寫 7.2b 結案方框；backlog E178／E192／E223 row done-mark；Wave 7 結案 → Wave 8 前置是 §9 全部核取。
- e178a 合併後，之後的波次改呼叫 `integrator` prompt；本檔以前的清單仍引用暫行檔路徑，屬歷史產物，不改。

## 合併順序
e178a ∥ e223（檔案互斥，誰先 PASS 誰先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/wave7-<lane>` → ff `main` → Wave 7 結案

## Dispatch pins
- e178a：`sr-engineer=fable`（D8）。
- e223：`sr-engineer=fable`（D8）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-27 | 人類 | **D8** `sr-engineer=fable`；**D9** E223 拆成獨立 lane 與 e178a 並行（仍在 v4）；**D10** E192 用通用只讀 agent，不做專用模板；**D11** `integrator` 不進 `tw_switch_role`／`agent_id` enum | 整合者 session |
| 2026-09-27 | 整合者 | 本清單取代 `specs/fanout-wave7.2.md` 的 7.2b 暫定段；`dist/**` 按檔案切給兩條 lane | 本檔 |
| 2026-09-27 | 人類 | 核准本清單（含 `dist/**` 按檔案切分、e223 擁有 lane-status 三檔、e178a 擁有四個既有測試檔），開始派工 | 整合者 session |
| 2026-09-27 | 整合者 | e223 cut 預審原樣通過（`c25b317`）；驗證通過並合併（`749f68f`；lane 層 2800/2800、整合層 2800/2800），`finish --shipped` 無新票；觀察：code-reviewer 派 sonnet、自述 opus（只是自述，無法驗證） | 信箱 e223 to-lane#1／#2 |
| 2026-09-27 | 整合者 | e178a cut 預審要求四項＋一項修正（watermark 無 tier、`recommended_model: sonnet`、AC6／AC7 措辭、先 commit cut、Copy row watermark），`5911943` 談定；**Q6**：`test/skill-frontmatter.test.mjs` 以機械性越界劃給 e178a（只限 qa、11→12） | 信箱 e178a to-lane#1–#3 |
| 2026-09-27 | 人類 | e178a：核准 cut `5911943`；**Q1=A**（`commit --amend` 全角色禁止）；**E178A-NEW-1** 排 v4 之後；**R2=a′**（`git fetch` 進全角色唯讀清單、`git switch <既有 branch>` 只授權 integrator） | e178a lane session（R2 同時在整合者 session 打字） |
| 2026-09-27 | 整合者 | e178a 驗證通過並合併（`81056a6`；lane 層 2812/2812、整合層 2817/2817、fanout check 唯一越界＝Q6 授權檔）；README／`docs/install.md`／`docs/architecture.md` 的 prompt 數量由整合者同步（E178A-NEW-3 因此不配號：lane 在 `d4387d9` 刪除該 block，整合者以 `7a2625a` 合併） | 本檔 |
| 2026-09-27 | 人類 | 整合者開 **E225**：畸形 `pending-ticket` block 到 `finish` 才被解析、孤兒偵測器對它靜默（本波 E178A-NEW-3 實例）；排佇列 #22（緊接 E205；E226 插入後） | 整合者 session |
| 2026-09-27 | 整合者 | e178a `finish --shipped` 配號 E226（NEW-1 adopter 可攜性，P2，人類裁決 v4 之後）→ 佇列 #18；E227（NEW-2 `RAG_SKIP_ROLES`，P3）→ 佇列 #55；lane 拆除（`7198889`） | 佇列檔 |
