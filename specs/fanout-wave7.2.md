# Fan-out: v4.0.0 Wave 7.2（翻開關 + integrator 正式化）
base: 94e75f3（派工前的 main；lane 實際從派工 commit 121ddc8 分出）    integration branch: 每條 lane 各一條 integ/wave7-<lane>

**狀態：人類核准 2026-09-27（D6=A、D7=同意）。** 接續 `specs/fanout-wave7.md` 的「Lanes（7.2，序列，暫定）」段；那一段由本檔取代。

## 派工前核對（整合者，2026-09-27）
- `git worktree list` 只有 primary；main = origin/main = `94e75f3`；工作樹乾淨。primary handoff 停在 `release-v4-wave6`（v3.119.0 已發版），drift 無。
- 前置全到齊：E73、E113、E115、E116、E123–E126、E110 DONE；E127 已處置（D2）；7.0 重跑 PASS；E204、E212、E213 已合併。
- E130 票面的錨點都在 base 上：`content/coord-03-core-fallback.md:4`（pre-v3.20.0 那句）、`:12` Feature-Scope Gate、`:14` Worktree bootstrap obligation、`:34` Escalation Routes 的 feature-lease 列；`content/coord-01-core-head.md:26` Complexity Scope Gate、`:55` Split Table 的 `order` 欄；`content/const-05-core-standards.md:17`（PM bootstrapping 例外）；`content/const-15-core-tail.md:23-26` Document Priority；`content/skill-release-engineer.md:42`／`:205`／`:210`（8a 的 `tasks.md` staging）。
- `dist/` 不含 `content/`（composer 執行期讀 `content/`）→ 純 content 的 e130 不需要重建 `dist/`。
- 釘住上述散文的既有測試：`test/feature-scope-gate.test.mjs`、`test/feature-lease.test.mjs`、`test/feature-split-lifecycle.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/release-staging.test.mjs`、`test/render-structure.test.mjs`、`test/skill-manifest.test.mjs`、`test/context-budget.test.mjs`、goldens。
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。root `NEW-TICKETS.md` 已退役。
- `scripts/fanout.mjs render`／`check`、`scripts/lane-status.mjs`、`scripts/mailbox-watch.mjs` 在 base 上存在。
- **監看兩層**（前一個整合者 session 交接）：`scripts/mailbox-watch.mjs` 看信箱，另掛 `node ../agm-lanes/lane-state-watch.mjs <lane…>` 看 handoff 狀態轉換（29 分鐘到期、重掛）—— 補 lane 跳過協議步驟時信箱不會觸發的缺口，直到 e178b 正式工具化。
- **task id 必須帶票號**（人類裁決 2026-09-27）：本波每條 lane 的 task id 用 `T-<票號>-NN`（e130：`T-E130-NN`）。

## 為什麼要拆 E178（需人類裁決 D6）
E178 票面現在是十件交付物：(1) `content/skill-integrator.md`、(2) `integrator` MCP prompt 註冊、(3) §6 修憲（merge／`branch -d`／`worktree remove`／`update-ref -d`）、(4) 合併解法的 code-review 義務、(5) 信箱協定＋cut 預審正式化、(6) 決策權表、(7) E192 驗證 subagent、(8) task id 帶票號寫進 `docs/lane-protocol.md`、(9) lane 沉默缺口 —— `lane-status` 的監看模式＋fan-in 檢查「有 cut 的 lane 先送預審」、(10) E208 —— `fanout check` 對「擁有」裡比對不到任何路徑的 token 發警告。
其中 (9)(10) 是**程式**（`tools/lane-status.ts`、`tools/fanout-manifest.ts`），不碰 `content/`，與 e130 檔案互斥、互不依賴；其餘是 content／prompt，必須排在 e130 之後（§2.1 content 只能一條 lane）。

| 選項 | 內容 | 風險 |
|---|---|---|
| **A（建議）** | 拆成 **E178a**（(1)–(8)，content／prompt，e130 之後）與 **E178b**（(9)(10)，工具，**現在就與 e130 並行**）。E178a 的 SOP 引用 E178b 的工具，所以 E178b 先合 | 多一條 lane、一次 cut 核准；但 7.2 的牆鐘時間縮短，E178a 的單票範圍變小（E179 單票撞過 hop 10/10） |
| B | E178 維持一張，e130 之後單條序列 | E178 一條 lane 同時做 SOP、修憲與兩個工具，極可能撞 hop cap 或 task_size |

子票沿用 E177a/b 的先例，由整合者在派工前的 commit 寫進 `docs/backlog.md` 的 E178 row，不另配新 E 號。E178a 的前提核對到派工前再做一次（它依賴 e130 合併後的 content）。

## Lanes（7.2，假設 D6=A）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e130 | E130 + E199 + E198(b) | feat/e130-lane-default | ../agm-lanes/e130 | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/feature-scope-gate.test.mjs`、`test/feature-lease.test.mjs`、`test/feature-split-lifecycle.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/release-staging.test.mjs`、`test/render-structure.test.mjs`、`test/skill-manifest.test.mjs`、`test/e130-*.test.mjs`、`specs/e130-*`、`qa_reports/*E130*`、`review_reports/*E130*`、`.current/e130/**` | `bin/**`、`tools/**`、`scripts/**`、`prompts/**`、`gates/**`、`templates/**`、`dist/**`、`docs/**`、`package.json`、`.claude/commands/integrator.md`、`CLAUDE.md`、`AGENTS.md`、其他測試檔、e178b 的檔案 | 做：(i) coord-03 Feature-Scope Gate 改成 lane 是票的起點，觸發條件接既有 Complexity Scope Gate（coord-01:26），三條觸發線照計劃 §8 待決 B（簡單任務原地做／Complexity Gate 觸發開 lane／feature lease 被佔用開 lane，最後一條是今天已有的行為），E111 bootstrap obligation 保持掛在上面；(ii) 預設路徑呼叫 `agc feature start`，不自己造 bootstrap；(iii) 宣告適用範圍；E127 處置散文（lane 起點段寫 harness cwd 重置規則）；ride-along (a) bootstrap obligation 寫明前提（證據目錄 untracked 才需要）、(b) coord-03:4 那句移回 Fallback 段、(c) const-15 Document Priority 加「自動注入的資料區塊不是文件」一段；E110 ride-along：Split Table 標出同一並行階段的列；E199 刪 const-05 的 PM bootstrapping 例外；E198(b) release 8a stage `.current/_primary/tasks.md` 並改 artifact allowlist 散文；goldens 與 budget floor 同一次重蓋。不做：改 `bin/agc-init.mjs`（E73 的機制已存在）；改 `docs/lane-protocol.md` 或整合者 SOP（E178a）；同一票兩個 session（E133）；cwd 偵測器（E205） | 7.1 全部合併 ✓、7.0 PASS ✓、D2 ✓ |
| e178b | E178b（E178 的 (9)(10)） | feat/e178b-lane-watch-tooling | ../agm-lanes/e178b | `tools/lane-status.ts`、`scripts/lane-status.mjs`、`tools/fanout-manifest.ts`、`scripts/fanout.mjs`、`dist/**`、`test/e178b-*.test.mjs`、`test/fixtures/e178b/**`、`test/e177a-*.test.mjs`、`test/e177b-*.test.mjs`、`specs/e178b-*`、`qa_reports/*E178B*`、`review_reports/*E178B*`、`.current/e178b/**` | `content/**`、goldens、budget、`bin/**`、`prompts/**`、`tools/registry.ts`、其他 `tools/**`（只能 import）、`scripts/mailbox-watch.mjs`、`docs/**`、`package.json`、`.claude/commands/integrator.md`、`specs/fanout-*.md`（歷史產物；要當 fixture 就複製）、e130 的檔案 | 做：(9a) `lane-status` 監看模式 —— 定期讀各 lane handoff，狀態轉換（status／last_agent／next_role／hop／rounds）時印一行，不必等信箱；啟動印 baseline、到期前印 `expiring — re-arm`（同 `mailbox-watch.mjs` 的慣例；原型見整合者的 `agm-lanes/lane-state-watch.mjs`）；(9b) fan-in 檢查「lane 有 cut（PM spec 已寫）時，信箱裡先有一則 cut 預審訊息」，缺了明印；(10) `fanout check` 對「擁有」裡比對不到任何 base 路徑、也不是新建 glob 的 token 發警告（E208，不改 exit code 語意，或由 cut 決定）。不做：寫 SOP／lane-protocol 散文（E178a 引用）；單角色 qa lane 要不要送 cut 的政策（E178a 的散文決定） | 無 |

## 7.2b（暫定，派工前重新核對；不在上表，所以 `fanout render` 不會渲染它）
| lane | 票 | branch | 擁有（暫定） | 範圍（暫定） | 相依 |
|---|---|---|---|---|---|
| e178a | E178a（E178 的 (1)–(8)，含 E192） | feat/e178a-integrator-role | `content/**`（新 `content/skill-integrator.md`、§6 修憲）、goldens、budget、新 `prompts/integrator.ts`、`tools/registry.ts`（只限 `PROMPT_REGISTRY`）、`templates/claude-code-agents/`（若 cut 選專用驗證者模板）、`docs/lane-protocol.md`、`.claude/commands/integrator.md`、`CLAUDE.md`／`AGENTS.md` 的 prompt 數量敘述、對應測試 | 正式角色與 prompt 註冊；§6 授權只給這個角色；合併解法的 code-review 義務；信箱協定＋cut 預審（含 architect 兩段預審、close／reopen、human-approval 期間持續監看）；決策權表；E192 驗證 subagent；`T-<票號>-NN` 寫進 lane-protocol；單角色 qa lane 是否送 cut；**引用** E124／E125／E126／E177a／E177b／E178b，不重述；退役 `.claude/commands/integrator.md`；**E223**（重掛時未知 baseline key 不再 exit 64，擁有範圍因此加上 `tools/lane-status.ts`、`scripts/lane-status.mjs`、`dist/**`） | e130 合併、e178b 合併 |

## 所有權重劃（相對於 §3 預設 lane 表）
- `tools/lane-status.ts`、`tools/fanout-manifest.ts`、`scripts/{lane-status,fanout}.mjs`（E177 新建，§3 表無 owner）→ e178b。
- e130 **不擁有** `dist/**`、`bin/**`：純 content，composer 執行期讀 `content/`。cut 若發現非改不可 → 信箱提出，整合者重劃。
- 7.2b 的 `prompts/`（L-RENDER）、`tools/registry.ts`（L-STATE）、`templates/`（L-INIT）劃給 e178a：那時沒有並行 lane。

## 完成定義 → 票
| 完成定義條目（計劃 Wave 7 派工卡） | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `coord-03` Feature-Scope Gate 改寫，lane 是票的起點 | E130 | ✓ 7.2 |
| 觸發條件接既有 Complexity Scope Gate | E130 | ✓ 7.2 |
| 適用範圍已宣告（待決 B） | E130 | ✓ 7.2 |
| E130 三項 ride-along ＋ E199 ＋ E198(b) | E130 | ✓ 7.2 |
| E127 處置散文（D2 的「寫明」那一半） | E130 | ✓ 7.2 |
| integrator 是正式角色（SOP 在 `content/`、§6 授權只給它、暫行檔退役、E192） | E178a | ✓ 7.2b |
| lane 沉默缺口、E208（E178 票面 scope add） | E178b | ✓ 7.2（與 e130 並行） |
| task id 帶票號寫進 lane-protocol | E178a（本波由派工 prompt 帶） | ✓ 7.2b |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- e130 合併後：計劃文件勾 Wave 7 完成定義的四格、§9 對應三格；backlog E130／E199／E198 row done-mark；primary MCP server 重啟（新 content 才生效）。
- e178b 合併後：暫行 SOP 的 `/integrator status` 與 fan-in 檢查改用 `lane-status` 監看模式（過渡；E178a 正式化時改成引用）。
- e178a 派工前：重做前提核對，寫 e178a 的正式列；`.claude/commands/integrator.md` 退役後，本檔之後的波次改呼叫 `integrator` prompt。

## 合併順序
e130 ∥ e178b（檔案互斥，誰先 PASS 誰先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/wave7-<lane>` → ff `main` → 派工 e178a → `integ/wave7-e178a` → ff `main` → Wave 7 結案

## Dispatch pins（✅ D7 已確認）
- e130：`sr-engineer=fable`。
- e178b：`sr-engineer=fable`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-27 | 整合者 | 7.2 改用獨立清單（本檔），取代 `specs/fanout-wave7.md` 的 7.2 暫定段；該段欄位不符 `fanout render` 的 lane 表格式 | 本檔 |
| 2026-09-27 | 人類 | **D6=A**：E178 拆成 E178b（工具：lane-status 監看模式、cut 預審 fan-in 檢查、E208 警告；與 e130 並行）與 E178a（content／prompt，e130 與 e178b 合併後）；**D7**：e130、e178b `sr-engineer=fable` | 整合者 session |
| 2026-09-27 | 整合者 | e130 cut 預審要求四項修正（adopter 可用的引用、chain 在 lane 內繼續、`agc feature start` 拒絕路徑、點名原地做的情況），T-E130-01 作廢由 T-E130-09 取代；e178b cut 原樣通過，5 題 Open Questions 照 cut 立場 | 信箱 e130 to-lane#1／#2、e178b to-lane#1 |
| 2026-09-27 | 整合者 | e130 R1（qa-only 票同時落在 (a) 與 (b)）：**(a) 先判斷**，在已核准的 AC1(a) 範圍內，不需人類裁決或重新核准；review 後、qa 重蓋 golden 前先跑一次 sr 修正 | 信箱 e130 to-lane#3 |
| 2026-09-27 | 整合者 | 觀察（不退回）：e130 的 code-reviewer 對自己未 push 的 commit 做 `commit --amend`（ecb35eb→d0d3db4），不在 §6 sanctioned 清單內，無資料遺失；E178a 修 §6 時一併處理 | 信箱 e130 to-integrator#4／to-lane#4 |
| 2026-09-27 | 整合者 | e130 驗證通過並合併（`5f9a21c`；lane 層 2771/2771、整合層 2771/2771），`finish --shipped` 配號 E221 並拆除 | 信箱 e130 to-lane#4 |
| 2026-09-27 | 整合者 | e178b 驗證通過（lane 層 2778/2778），整合層第一次 2793/2795：e130 的 AC4／AC14 以 `121ddc8...HEAD` 比對 → 開 E222，停下來請人類裁決；main 上沒有紅燈被 push | 本檔；整合者 session |
| 2026-09-27 | 人類 | **E222 選 A**：放進 v4，由 Task 派的 qa-engineer 在 `integ/wave7-e178b` 修（`aafa0d2`），整合者重跑 2795/2795 後合併（`fcfef80`）；`finish --shipped` 配號 E223、E224 | 整合者 session |
| 2026-09-27 | 整合者 | E221 併入 E224（同類：e177b 鎖／信箱測試在並行全套下逾時；整合者序列重跑 5 次未重現）；E224 排佇列 #14（緊接 E209）、E223 排 #49（緊接 E210）。**E223 的 lane 建議提升進 v4 —— 需人類裁決** | 佇列檔；backlog E221／E223／E224 row |
| 2026-09-27 | 整合者 | roll-up：e130 8 task 完成、1 void、hop 7、review 0、qa 0；e178b 5 task、hop 6、review 1、qa 0（per-lane cap 10） | 計劃 Wave 7.2 結案方框 |
| 2026-09-27 | 人類 | **E223 併進 E178a**（放進 v4 Wave 7.2b）；從佇列移除 | 整合者 session |
