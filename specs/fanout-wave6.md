# Fan-out: v4.0.0 Wave 6 (E125 → E126 — 回寫與守門)
base: 0d07e0f (to be re-stamped with the sha of the pre-dispatch commit below before prompts go out)    integration branch: integ/wave6-<lane> (one per serial lane)

**狀態：人類核准 2026-09-25（D1=A、D2=同意、D3=同意、D4=序列）。** 本波是序列波次（`docs/v4.0.0-execution-plan.md` Wave 6）：沒有可並行的 lane。
這份清單的作用是拆票、完成定義對照、派工前的前提修正，**不是**檔案切分。每條 lane 在前一條 merge 進 `main` 之後才派工；
因為同一時間只有一條 lane，那條 lane 可以動 `content/**`（§2.1 自然成立）。

## 為什麼要拆 E125（需人類裁決 D1）

E125 票面估 `~3` 個檔（7a + 回寫 + docs），但 2026-09-23 / 09-25 又併入五個 cut 輸入：(a) 壓縮、(b) `tasks.md`／`specs/<feature>.md`
搬進 `.current/<lane>/`、(c) 指標格式、J2-NEW-4 原地換 feature、S1 孤兒掃描要不要掃 `history/`。實際會碰到的檔案面：

| 面 | 檔案 | 預設 lane |
|---|---|---|
| lane-local 帳本 | `tools/lane-paths.ts`（`LANE_FILES`）、`tools/lane-migrate.ts`、`schema/versions.ts`、`schema/migrations-*.ts`、`tools/config.ts`（`taskPaths` 預設）、`tools/tasks-file.ts`、`tools/drift.ts`、`tools/sync.ts`；另有 8 個 `tools/*.ts` 提到 `tasks.md` | L-STATE + L-SCHEMA + L-GATE |
| lane 收尾／回寫 | `bin/agc-init.mjs`（`feature finish` 搬去 `history/<YYYY-MM>/<lane>/`、寫索引列、孤兒掃描 `:825`）、`tools/lane-registry.ts`／`tools/feature-rollup.ts`（`featureHistory`）、`tools/lane-ticket-allocation.ts` | L-INIT + L-LANEREG |
| SOP 與索引宣告 | `content/skill-release-engineer.md` 7a、`content/coord-03-core-fallback.md`、8 個提到 `specs/<feature>` 的 `content/*.md`、goldens、budget；一次性壓縮既有的 `tasks.md`（545KB／1111 行）與 `docs/backlog.md`（704KB） | L-CONTENT |

一條 lane 做完三面遠超 `task_size` 預算（≤ 5 檔／300 行），而 Wave 5.1 的 E179 光一張票就走到 hop 10/10。**建議拆成三段序列**：

| 選項 | 內容 | 風險 |
|---|---|---|
| **A（建議）** | E125 拆成 E125a／E125b／E125c 三條序列 lane，再接 E126 | 共 4 次派工、4 次 cut 核准；每段都能在 hop 預算內完成 |
| B | E125 維持一條 lane，由 lane 的 PM 在 cut 內部切 task | 一個 feature 只有一份 `hop_count`，極可能撞 hop cap；而且 PM 會在同一次 cut 裡同時做 (a)(b)(c) 三個設計決定 |

拆法要改票面，照整合者 SOP 由人類決定；選 A 的話，子票由整合者在派工前的 commit 寫進 `docs/backlog.md` 的 E125 row（沿用 E123a/b/c 的先例，不另配新 E 號）。

## Lanes（選項 A）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e125a | E125a lane-local 帳本 | feat/e125a-lane-local-ledgers | ../agm-lanes/e125a | `tools/lane-paths.ts`、`tools/lane-migrate.ts`、`schema/**`、`tools/config.ts`、`tools/tasks-file.ts`、`tools/tasks.ts`、`tools/drift.ts`、`tools/sync.ts`、其他解析 `tasks.md` 路徑的 `tools/*.ts`（以 grep 結果為準）、`dist/**`、`specs/e125a-*.md`、自己的證據檔、`.current/e125a/`、qa 自己的測試檔 | `content/**`、goldens、budget、`bin/**`、`docs/**`、`gates/**`（有需要就回報）、`.claude/commands/integrator.md` | 做：cut 輸入 (b) —— `LANE_FILES` 加上 `tasks.md`（以及 `specs/<feature>.md` 的去留，**cut 要決定**）、schema bump 與可逆的 migration、`tw_*` 讀寫 lane-local `tasks.md`、外層 `tasks.md` 對 `tw_*` 改成唯讀索引。不做：lane 收尾搬移、壓縮、SOP 散文 | Wave 5 ✓ |
| e125b | E125b lane 收尾與回寫 | feat/e125b-lane-close-writeback | ../agm-lanes/e125b | `bin/agc-init.mjs`、`tools/lane-registry.ts`、`tools/feature-rollup.ts`、`tools/lane-ticket-allocation.ts`、`tools/lane-paths.ts`（history 解析器）、`dist/**`、自己的 spec／證據／`.current/e125b/`／測試 | `content/**`、goldens、budget、`schema/**`（除非 cut 明確需要）、`docs/**` | 做：`feature finish --shipped` 把 `.current/<lane>/` 搬到 `history/<YYYY-MM>/<lane>/`，外層索引寫摘要列加指標（cut 輸入 (c)，見 D2）；J2-NEW-4 原地換 feature；S1 孤兒掃描要不要掃 `history/`（cut 決定，完成定義不放寬）。不做：7a 散文、壓縮既有檔案 | e125a merged |
| e125c | E125c SOP 與壓縮 | feat/e125c-index-compaction | ../agm-lanes/e125c | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`tasks.md`（一次性壓縮）、`.current/_primary/tasks.md`（一次性壓縮 + 清 X7 舊副本，6.1c 擴充）、`.current/tasks-index-receipt.json`（壓縮後重蓋，6.1c 擴充）、`tools/tasks-lane-migrate.ts`（僅反向 migration 與 receipt，E195，2026-09-26 擴充）、`dist/**`、自己的 spec／證據／`.current/e125c/`／測試 | `tools/**`、`bin/**`、`schema/**`、`docs/backlog.md`（見 D3） | 做：**E195**（人類裁決 D5）—— `_primary` 反向 migration 在 root `tasks.md` 被改過之後仍可用，涵蓋兩個寫入者：`finish --shipped` 的 `## Closed Lanes` 附加，以及本 lane 自己的壓縮；release SOP 7a **擴充**（不另造第二條歸檔路徑）、外層宣告為歷史索引、票號寫進 commit message 的慣例（讓 `git log --grep` 當通用後備）、cut 輸入 (a) 壓縮 `tasks.md`。不做：搬證據目錄（E168，v4 之後）；壓縮 `docs/backlog.md`（D3） | e125b merged |
| e126 | E126 合併後不變量檢查 | feat/e126-merge-invariants | ../agm-lanes/e126 | 新檔 `tools/merge-invariants.ts`＋新檔 `scripts/merge-invariants.mjs`（6.2 修正）、`scripts/verify-release.mjs`（僅 `BOOKKEEPING_PATH_RES`，X5／E198(a)）、`tools/join-precondition.ts`（僅在 cut 決定共用 hook 時加呼叫）、`scripts/join-precondition.mjs` 的 hook 點（E115）、`dist/**`、自己的 spec／證據／`.current/e126/`／測試（`test/e126-merge-invariants.test.mjs`、`test/verify-release.test.mjs`） | `content/**`、goldens、budget、其餘 `tools/**`（只能 import）、`bin/**`、`.claude/commands/integrator.md` | 做：三條不變量 —— 任一 parent 出現過的 ticket row 都在、`[x]` 保留、append-only sidecar 的筆數 ≥ 兩 parent 之和減共同祖先；失敗要大聲（非零 exit 加訊息）；與 E115 的 join 自檢接在同一個時點；**E198(a)**（2026-09-26 人類決定放進 v4）：`scripts/verify-release.mjs` 把 `.current/_primary/tasks.md` 納入（跟 X5 同一處）。不做：解衝突的 agent（§3.2、server charter） | e125a + e125b merged（見 D4） |

## 所有權重劃（相對於預設 lane 表）
- 每條 lane 各自橫跨多條預設 lane（e125a：L-STATE + L-SCHEMA + L-GATE；e125b：L-INIT + L-LANEREG；e125c：L-CONTENT 加上根目錄 `tasks.md`；e126：L-RELTOOL）。**序列波次，同時只有一條 lane**，所以沒有交集問題。

## 人類裁決（2026-09-25 已決）
- **D1 — E125 怎麼拆**：✅ **A** —— 三段序列 E125a／b／c。
- **D2 — 指標裡的 `base_sha` 和 E104 衝突**：cut 輸入 (c) 要求一律記錄 `branch` + `base_sha` + 票號。但 E104 還沒執行的 `git-filter-repo` 歷史重寫會讓**所有** sha 失效，merge-base 也一樣 —— 原票拒用 commit sha 正是為了這個理由。建議：指標以 `ticket id` + `branch` 為主鍵（`pr` 選填），`base_sha` 只是輔助、明寫「歷史重寫後會失效」，`git log --grep <ticket>` 當通用後備。✅ **同意**：e125b 的 cut 照此實作，派工 prompt 點名。
- **D3 — 壓縮 `docs/backlog.md` 放不放進 v4**：`docs/backlog.md` 是整合者／`agc feature finish` 的寫入目標，lane 碰不得（lane-protocol §2）。建議：v4 只壓縮 `tasks.md`（e125c），`docs/backlog.md` 的壓縮開成 v4 之後的新票；E125 完成定義寫的「宣告為歷史索引」照做，不受影響。✅ **同意**。
- **D5 — E125b-NEW-3（→ E195）放哪裡**（2026-09-26 已決）：`migratePrimaryReverse` 要求 root body 的 sha256 等於 receipt（`tools/tasks-lane-migrate.ts:467-469`），`## Closed Lanes` 附加與 e125c 的壓縮都會打破它，而 Wave 8 要求 migration 可逆。✅ **併進 e125c**，e125c 擁有 `tools/tasks-lane-migrate.ts` 的反向路徑。
- **D4 — E126 能不能跟 e125c 並行**：E126 依賴的是回寫**結構**（e125a/b），不依賴 7a 散文或壓縮（e125c）；兩者的檔案也不重疊（`scripts/` 對 `content/`）。並行可以少一輪等待，但違反計劃「E125 先於 E126」的字面規定。✅ **序列**。

## 完成定義 → 票
| 完成定義條目（Wave 6 派工卡） | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 回寫接進 release SOP 7a（擴充它，不另造歸檔路徑） | e125b（機制）＋ e125c（7a 散文） | ✅ |
| 外層 `tasks.md`／`docs/backlog.md` 正式宣告為歷史索引，`tw_*` 只讀 lane 內那份 | e125a（`tw_*` 讀 lane-local）＋ e125c（宣告） | ✅ |
| post-merge 不變量檢查會「大聲」失敗 | e126 | ✅ |
| （E125 cut 輸入 a）壓縮 | e125c（`tasks.md`）；`docs/backlog.md` 看 D3 | ✅／D3 |
| （E125 cut 輸入 b）`tasks.md`／spec 搬進 lane | e125a | ✅ |
| （E125 cut 輸入 c）指標格式 | e125b（看 D2） | ✅ |
| （J2-NEW-4）原地換 feature 不遺失 `featureHistory` | e125b | ✅ |
| （S1）孤兒掃描要不要掃 `history/` | e125b | ✅ |

## 派工前修正（整合者自己的 commit，派工前完成並跑全套）
- `docs/v4.0.0-execution-plan.md` Wave 6 派工卡的「禁止」欄：「指標必須用 PR number」已被 cut 輸入 (c) 修正，而票面寫明「這條禁止要在 cut 時跟著改」。改成指向 D2 的結論，避免 lane 讀到兩條互相矛盾的規則。
- 選 A 的話：`docs/backlog.md` E125 row 加上 E125a/b/c 的拆法說明。
- 本檔一起 commit，base 重蓋成該 commit 的 sha（每條 lane 派工時再用當下的 `main` sha 重蓋）。

## 整合後（接線票／補刀）
- 整合者：e125a merge 之後，`docs/lane-protocol.md` §3 的「在自己的 branch 上 commit … `tasks.md` 裡本票的列」改成 lane-local `tasks.md`；`.claude/commands/integrator.md` 5b-4 的 `tasks.md` 衝突規則同步修改。
- 整合者：e125b merge 之後，階段 6 的拆除步驟改寫成引用 `finish --shipped` 的 `history/` 搬移，不重述機制（為 E178 預先整理）。
- 看 D3：開 `docs/backlog.md` 壓縮票（post-v4）。
- done-mark：E125、E126；計劃文件 Wave 6 三條完成定義打勾。

## 執行期間的跨 lane 項目（由 e125a cut 提出，2026-09-25）
- **X1** → 整合者：e125a 合併後改 `docs/lane-protocol.md` §3（含新的 tracked 例外 `.current/tasks-index-receipt.json` —— §3「不 commit `.current/` 頂層工作檔」的例外）；SOP 散文改到 `.current/<lane>/tasks.md` → e125c。
- **X2** → e125b（選做）：`agc init` 直接建出 `.current/_primary/tasks.md`。
- **X3** → e125b cut 輸入：root 索引是 v2 檔；摘要列不得是 checkbox；要不要取代 e125a 的 feat marker。
- **X4** → e125c cut 輸入：壓縮時保留 v2 sentinel 與 index notice；root 和 `.current/_primary/tasks.md` 兩份都要處理。
- **X8** → e125c cut 輸入（e125b 整合時觀察）：指標寫的是小寫 lane 名（`ticket=e125b`），而 commit 訊息多寫 `E125b` —— 「票號寫進 commit message」的慣例與 `git log --grep` 後備要寫明大小寫（`-i`），否則後備會漏。
- **X4b** → e125c cut 輸入 + Wave 8 CHANGELOG：Q1=L 的副作用 —— adopter 手改 root `tasks.md`，升級後 tools 不再讀。SOP 要宣告，CHANGELOG 的 MAJOR 條目要寫進升級路徑。
- **e125a Q1 修正（整合者 2026-09-25 異議，待人類裁決）**：adopter 普遍 gitignore `.current/`，但 root `tasks.md` 是 tracked → L 會讓 ledger 只存在本機，clone 之後 AC6b(a) 就是永久的 `TASKS_LEDGER_ABSENT`。建議：lane 路徑被 git ignore 時不遷移（走 R 行為）。
- **X5** → e126：`scripts/verify-release.mjs:256` 的 `tasks.md` 容忍規則要涵蓋 `.current/_primary/tasks.md`。
- **X6** → e126：「任一 parent 出現過的 ticket row 必須存在」要把 lane-local ledger 算進去，被 migration 搬走的 section 不算遺失。
- **X7** → e125b cut 輸入：e125a 的 D12 歸屬過濾只看活的 `.current/<lane>/tasks.md`；lane 搬進 `history/` 之後，過濾也要查 history bucket，否則 `_primary` 裡的舊副本會重新浮現。e125c 壓縮時同時清掉這些舊副本。
- **所有權擴充（e125a，已接受）**：`guards/file-lock.ts` 純抽出 `isLockPayloadStale`，`withFileLock` 行為零改變；code-reviewer T-05 重點。
- **整合者派工注意（e125a 合併之後）**：(1) 從 v2 root 分出去的 lane（e125b／c／e126）起始帳本是空的，task 列在自己的 worktree 用 `tw_add_task` 建；(2) 重建 `dist/` 之後，**primary 的 MCP server 要重啟**才會載入新碼，否則 lane 的 `tw_*` 還是舊碼、寫 root；(3) primary 第一次 task 存取會觸發 `_primary` 的 forward migration（root 改成 v2 index，並多出 `.current/_primary/tasks.md`）—— 由整合者刻意 commit，不要當成 drift。
- e125a 的 D-A（`specs/<feature>.md` 不搬）：待人類在 lane 確認；若確認，整合時在 E125 row 記錄 cut 輸入 (b) 的 specs 那一半依 D-A 不做。

## 進度
- ✅ e125a：2026-09-25 合併（lane HEAD `b5c2831`，hop 8/10）。lane 在等人類核准期間沒有監看信箱，`to-lane#4` 的異議由人類轉達 —— 記給 E178（信箱協定：等人類期間也必須監看）。

- ✅ e125b：2026-09-26 合併（lane HEAD `59b5b80`，merge `9ca1f9b`，hop 6/10，review 2 輪，qa 首輪 PASS）。預審兩輪（X7 所有權、gitignore 形狀、`base_sha` 定義、`base-sha` 須進 `LANE_FILES`），人類核准一次、跳過 architect。`finish --shipped` 首次實戰：搬進 `.current/history/2026-09/e125b/`、寫入 Closed Lanes 指標、配出 E193–E196。

- ✅ e126：2026-09-27 合併（lane HEAD `bbd4c04`，merge `dae3566`，hop 7/10，review 2 輪，qa 2 輪，2648/2648）。預審兩輪（R1 條件 (d)、R2、R3 覆蓋表；cr R-1 聯集的 spec 修正），R2-1 選 A 留作已知殘留（E126-NEW-2）。派工 base 實際是 `fe2d688`（6.2 核對節寫的 `b5ebcfe` 是 push 之前的值）。

- ✅ e125c：2026-09-26 合併（lane HEAD `6ca2e0e`，merge `ed7432f`，hop 4/10，review 1 輪，qa 首輪 PASS，2630/2630）。只預審一輪（沒有 architect）；執行期間兩題（F1 receipt 值、F2 偽造 marker）都接受，沒有另開修正輪。

## 6.1c 派工前核對（整合者，2026-09-26；**人類核准 2026-09-26，三處擴充全部同意**）
- **所有權擴充（需人類核准）**：e125c 加上 `.current/_primary/tasks.md` 與 `.current/tasks-index-receipt.json`。理由：E125a 之後 root `tasks.md`（548KB）只是 v2 index，活帳本是 `.current/_primary/tasks.md`（548KB，兩份都 tracked）。X4 要兩份都壓；root body 一改，receipt 的 `bodySha256` 就對不上，E195 本來就要處理這個比對，所以 receipt 必須歸同一條 lane。
- **E195 留在 `tools/tasks-lane-migrate.ts` 裡**：`migratePrimaryReverse`（`:460-477`）還原時只用 lane ledger 的 body，root body 只拿來比 sha。因此修法（hash 排除 `## Closed Lanes`，或壓縮後重蓋 receipt）都不需要動 `bin/agc-init.mjs`。cut 如果需要 `finish` 配合，就停下來回報，不越界。
- **壓縮手段**：不新建 `tools/`／`scripts/` 檔（E126 接著要用 `scripts/`）。一次性壓縮的做法由 cut 決定，但必須做到：保留 v2 sentinel 和 index notice（X4）；保留 `## Closed Lanes` 指標；壓完以後正向和反向 migration 都要能 round-trip（這是 Wave 8「migration 可逆」的閘門）。
- **前提核對**：`qa_reports/`、`review_reports/`、`specs/` 都 tracked，所以不用做 symlink；`NEW-TICKETS.md` 雖然 tracked 但已退役，lane 不碰；`agc feature start` 在 base 上存在（`bin/agc-init.mjs:920`）；`content/` 有 11 個檔提到 `tasks.md`，8 個提到 `specs/<feature>`（D-A 決定不搬，所以 specs 的散文不動）。
- **預審（to-integrator#1，hop 1/10）**：接受所有權擴充 —— `tasks-lane-migrate.ts` 的 forward runner 剝除 `## Closed Lanes`（R1 選項 A，~5 行，為了 byte-exact 雙向 round trip）。條件：沒有 CL 的 v1 root 做 forward，輸出必須和改動前 byte 相同；T04 要審 forward 的 diff。不改 const（R2）。lane 的 NEW-1 到 NEW-4 由整合者在 fan-in 處理：NEW-2（8a 沒有 stage `_primary`）跟 X5 一樣是 verify-release 的問題，會建議排進 v4（需人類裁決）；NEW-3 建議併進 Wave 7 的 L-CONTENT。
- **cut 輸入**：X1 SOP 散文（改指 `.current/<lane>/tasks.md`）、X4、X4b（SOP 宣告；CHANGELOG 留到 Wave 8）、X7 清除、X8（`git log --grep -i`）、D2 指標格式寫進 7a 散文。

## 合併順序
e125a → `integ/wave6-e125a` → ff `main` → 派工 e125b → … → e125c → e126（每段合併後都重建 `dist/`、跑全套）

## 6.2 派工前核對（整合者，2026-09-27；**人類核准 2026-09-27，三項全部同意：所有權修正、X10 時點解讀、`sr-engineer=fable`**）
base: `b5ebcfe`（main；比 `origin/main` 多 1 個尚未 push 的 commit —— 派工前 commit 跑全套之後一起 push，再用那個 sha 重蓋）

**前提核對（逐項用指令確認）**
- `agc feature start` 在 base 上存在（`bin/agc-init.mjs:920`）；primary 有 `node_modules`；沒有殘留的 `feat/e126*`／`integ/*` branch，`git worktree list` 只剩 primary。
- `qa_reports/`、`review_reports/`、`specs/` 都 tracked → 不用 symlink。`NEW-TICKETS.md` tracked 但已退役，lane 不碰。
- lane 從 v2 root 分出去，帳本起始為空 → task 列用 `tw_add_task` 建在自己的 worktree（lane-protocol §3，已寫明）。
- `scripts/join-precondition.mjs` 是**薄殼**：邏輯全在 `tools/join-precondition.ts`（314 行），腳本只 import `dist/tools/*.js`（同 `feature-rollup.mjs` 模式）。
- X5 的位置已移動：現在是 `scripts/verify-release.mjs:256` 的 `BOOKKEEPING_PATH_RES` 裡的 `/^tasks\.md$/`，還沒涵蓋 `.current/_primary/tasks.md`（也沒涵蓋 `.current/<lane>/tasks.md`）。該 regex 表有 drift-guard 測試釘住 `tools/lane-paths.ts` 的鏡像（`test/verify-release.test.mjs`）。
- 可追加的 sidecar 實際存在且 tracked：`.current/<lane>/{dispatch,telemetry,metrics}.jsonl`（`usage.jsonl` 視 hook 是否接上），也存在於 `.current/history/<YYYY-MM>/<lane>/`。

**所有權修正（✅ 已核准）** —— manifest 原本寫「`scripts/`（新腳本）＋ `scripts/join-precondition.mjs` 的 hook 點；禁止 `tools/**`（除非只是 import）」，但 repo 的慣例是「邏輯在 `tools/`、`scripts/` 只做薄殼」，而 E115 的 hook 點本身就在 `tools/join-precondition.ts`。照原清單做，lane 只能把不變量邏輯全部寫進 `.mjs`（沒有型別、沒有進 `dist/`），不然就得越界。建議改成：
- 擁有（新增）：**新檔** `tools/merge-invariants.ts`（邏輯）＋**新檔** `scripts/merge-invariants.mjs`（薄殼）；`scripts/verify-release.mjs`（只改 `BOOKKEEPING_PATH_RES`，E198(a)／X5）；`tools/join-precondition.ts` **只在 cut 決定要共用 hook 時**才能動，而且只能加呼叫、不能改既有的兩個檢查。
- 其餘 `tools/**` 維持禁止（只能 import，例如 `tools/lane-paths.ts` 的 `NON_LANE_DIRS`／`isSafeLaneName`、`tools/tasks-file.ts` 的解析器）。
- 測試（qa 擁有，建立已預先授權）：新檔 `test/e126-merge-invariants.test.mjs`；`test/verify-release.test.mjs`（X5 的 regex 新增要補 case；drift-guard 如果需要就更新）。

**cut 輸入（整合者提給 PM／architect，預審時核對）**
- **X5／E198(a)**：`BOOKKEEPING_PATH_RES` 要涵蓋 `.current/_primary/tasks.md`；`.current/<lane>/tasks.md` 要不要一起放寬由 cut 決定（理由要寫；E198(b) 的 8a staging 散文**不在**本 lane，屬於 Wave 7 E130）。
- **X6**：「任一 parent 出現過的 ticket row 都在」—— 被 migration 從 root 搬到 `.current/_primary/tasks.md`／`.current/<lane>/tasks.md` 的 row 不算遺失；**X9（新增）**：被 `feature finish --shipped` 從 `.current/<lane>/` 搬進 `.current/history/<YYYY-MM>/<lane>/` 的 row 與 sidecar 也不算遺失（比對要看 row 的身分，不看它的路徑），e125c 壓縮後的 root 索引同理。
- **X10（新增）時點**：E115 的 join 自檢是「join 票開工前」手動執行，**不是合併後**。票面寫的「跟 E115 批次」建議解讀為：**共用模組與 CLI 的模式**（`tools/` 邏輯＋`scripts/` 薄殼，吃 repo-root），但 E126 自己有入口，對一個 merge commit（預設 `HEAD`，看 `^1`／`^2`／merge-base）斷言。真正的呼叫點是整合者 SOP 5b 每次 `git merge --no-ff` 之後 —— 那一段由整合者在整合後自己接上（見下），lane 不改 `.claude/commands/integrator.md`。cut 如果要接 git hook，要先回報（它會動到 `agc init` 或 adopter 設定，越界）。
- **大聲失敗**：違反任一條 → 非零 exit，並列出每一筆遺失的 row／`[x]`／sidecar 差額（檔案＋身分），不是只印一行 FAIL。非 merge commit、沒有共同祖先等情況要明確 exit，不能靜默通過。
- 不做：解衝突的 agent（§3.2、server charter）；`content/**`（E198(b) 歸 Wave 7）。

**dispatch pins**：`sr-engineer=fable`（✅ 人類確認）。

**整合後（整合者自己的 commit）**
- `.claude/commands/integrator.md` 5b：每次 merge 之後、第 5 步全套之前，執行 `node scripts/merge-invariants.mjs`（名稱以 lane 交付為準），紅燈就停。E178 正式化時改成引用，不重述。
- done-mark E126、E198(a)（E198 row 註明 (b) 仍待 Wave 7）；計劃 Wave 6 第三條完成定義打勾；補 6.2 結案方框；跑 Wave 6 的跨 lane roll-up（e125a／b／c／e126）。
