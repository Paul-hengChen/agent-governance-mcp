# Fan-out: v4.0.0 Wave 7（翻開關）
base: 98052c6（派工前 commit；本行在派工後由整合者重蓋 —— 原寫 3f648bd，是派工前 commit 的 parent）    integration branch: integ/wave7.1（7.1 的並行 lane 共用一條）；7.2 每條序列 lane 各一條 integ/wave7-<lane>

**狀態：人類核准 2026-09-27（D1=A、D2=同意、D3=一個 adopter 驗收專案、D4=同意；D5 延到 7.2b 派工前）。** 本波分兩段：**7.1 並行**（四條 lane ＋ 兩件 coordinator 直接做的事），**7.2 序列**（L-CONTENT：E130 → E178）。
7.2 的兩列是暫定的，派工前會照 Wave 6 的先例重做一次前提核對（6.1c／6.2 格式），不在這次派工。

## 派工前核對（整合者，2026-09-27）
- `git worktree list` 只有 primary；沒有殘留的 `feat/*`／`integ/*` branch；main = origin/main = `3f648bd`。
- `agc feature start` 在 base 上存在（`bin/agc-init.mjs:920`）；primary 有 `node_modules`。
- `qa_reports/`、`review_reports/`、`specs/` 都 tracked → 不需要 symlink。`NEW-TICKETS.md` tracked 但已退役，lane 不碰。
- **primary 有一行未 commit 的改動**：`.current/_primary/tasks.md` 的 `T-RELV4W6-01` row。依 E204 row，它**留在工作樹直到 E204 合併**；在那之前 primary 上的全套會紅 2 個（AC10/AC11）。整合者自己的 commit 跑全套時先 `git stash push .current/_primary/tasks.md`，跑完再 `stash pop`。lane 從 committed base 分出，不受影響。
- primary 的 handoff 還停在 `release-v4-wave6`（In_Progress、`next_role: pm`）。lease 是 per-workspace，擋不到 lane；但 7.0 如果在 primary 做，先由 coordinator 收掉（整合者不能 `tw_update_state`）。
- macOS 上**沒有 `flock`**（`which flock` → not found）—— E177 的「機器層級測試鎖」不能照票面例子用 `flock`（見 e177b 的 cut 輸入）。
- E197 的字串在 `bin/agc-init.mjs:1731`（`closedLanePointerLine`，唯一的 composer）；`content/skill-release-engineer.md:198` 的 7a 散文已經寫 `-i`（E125c X8），所以 E197 不需要動 `content/`。

## 為什麼要拆 E177（需人類裁決 D1）
E177 票面估 `~5` 檔，但內容是七件交付物：(1) manifest 格式、(2) 由清單渲染派工 prompt、(3) fan-in 越界檢查、(6) `## Decisions` 區、(8) lane 狀態腳本、(9) 跨 lane roll-up 與證據交叉比對、(11) 機器層級測試鎖，外加 2026-09-25 的信箱監看腳本，以及「`agc feature start <lane>` 讀清單那一列」。
一條 lane 做完遠超 `task_size` 預算（≤ 5 檔／300 行）；E179 一張票就走到 hop 10/10。這些交付物自然分成兩群，**檔案不重疊、彼此不依賴**：

| 群 | 交付物 | 檔案 | 依賴 |
|---|---|---|---|
| **E177a** 清單 | (1)(2)(3)(6) | 新 `tools/fanout-manifest.ts` + 新 `scripts/fanout.mjs` | 無 |
| **E177b** 觀測 | (8)(9)(11) + 信箱監看 | 新 `tools/lane-status.ts` + 新 `scripts/lane-status.mjs`、新 `scripts/mailbox-watch.mjs`、測試鎖、`package.json` 的 `test` 一行 | 無（lane 清單取自 `git worktree list` + 既有 `tools/lane-registry.ts`，不讀 manifest，所以可與 E177a 並行） |
| **E177c** start 接線 | `agc feature start <lane>` 讀清單那一列 | `bin/agc-init.mjs` | E177a + E180（同檔） |

| 選項 | 內容 | 風險 |
|---|---|---|
| **A（建議）** | E177a ∥ E177b 兩條並行 lane；**E177c 排到 v4 之後**（§2.4 判準：剩下的波次沒有依賴它 —— E178 引用的是 E124／E125／E126，Wave 7 完成定義也只要求「派工 prompt 由清單渲染、越界被機器標出」） | 7.2b 之前少一個 L-INIT 序列步驟；計劃 7.1b 的散文要改一句 |
| B | 同 A，但 E177c 留在 v4，排成 L-INIT 在 e180 與 e177a 合併後的小步驟（7.1e） | 多一次派工、一次 cut 核准，排在 E178 之前 |
| C | E177 維持一條 lane | 極可能撞 hop cap；PM 要在同一次 cut 裡同時做清單格式和觀測腳本兩組設計 |

子票沿用 E123a/b/c、E125a/b/c 的先例，由整合者在派工前的 commit 寫進 `docs/backlog.md` 的 E177 row，不另配新 E 號。

## Lanes（7.1，並行；假設 D1=A）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e204 | E204 | feat/e204-pin-e125c-fixture | ../agm-lanes/e204 | `test/e125c-index-compaction.test.mjs`；如果 cut 選「存一份凍結副本」，新檔 `test/fixtures/e125c-frozen/**`；自己的證據與 `.current/e204/` | 其他一切 —— 特別是 `.current/_primary/**`、root `tasks.md`、`.current/tasks-index-receipt.json`、`tools/**`、`content/**` | 做：AC10／AC11 的 fixture 釘在固定 revision（`git show ed7432f:<path>` 或 checked-in 副本），round-trip／parity 斷言改對凍結快照；**要證明修好**：在測試自己的暫存 repo（不是 primary）對 ledger 多 commit 一列之後仍然綠。不做：改 `tools/tasks-lane-migrate.ts`（那是 code，不是本票）。**單角色 qa 派工**（Constitution §3.1，test-only）—— 不走 sr／code-reviewer | E125c ✓ |
| e180 | E180 + E194 + E197 | feat/e180-abandoned-harvest | ../agm-lanes/e180 | `bin/agc-init.mjs`（只限 `finish --abandoned` 路徑，`:1371-1471` 一帶，與 `closedLanePointerLine` `:1727`）；qa：`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`（或新檔 `test/e180-*.test.mjs`，建立已預先授權）；自己的 spec／證據／`.current/e180/` | `content/**`、goldens、budget、`tools/**`（只能 import）、`scripts/**`、`templates/**`、`docs/**`、`package.json`、`bin/` 的 `feature start` 路徑 | 做：**E180** —— `--abandoned` 遇到「符合的證據檔被 ignore、而所在目錄不是連到 worktree 外的 link」時，**先搬回 primary 或大聲拒絕**（cut 決定，但不能靜默成功）；**E194** —— `--abandoned` 在 `removeWorktreeNoForce` 之前收割被 ignore 的 `.current/<lane>/`（沿用 `--shipped` 的 AC9 fs-copy 進 `.current/history/<YYYY-MM>/<lane>/`，或大聲拒絕；設計見 E194 row）；**E197** —— 指標文字改成 `git log -i --grep`。不做：改寫已 commit 的指標（append-only）；`feature start` 讀清單（E177c） | E73 ✓ |
| e177a | E177a | feat/e177a-fanout-manifest | ../agm-lanes/e177a | 新檔 `tools/fanout-manifest.ts`、新檔 `scripts/fanout.mjs`（薄殼，吃 `dist/tools/*.js`，同 `feature-rollup.mjs` 模式）、`dist/**`；qa：新檔 `test/e177a-*.test.mjs` 與 `test/fixtures/e177a/**`（建立已預先授權）；自己的 spec／證據／`.current/e177a/` | `bin/**`、`content/**`、goldens、budget、`package.json`、`docs/**`（含 `docs/lane-protocol.md`）、`.claude/commands/integrator.md`、既有的 `specs/fanout-*.md`（歷史產物；要當 fixture 就複製進 `test/fixtures/e177a/`）、e177b 的新檔 | 做：(1) manifest 格式 —— 以 `specs/fanout-wave7.md` 的 `## Lanes` 表為基準，寫出欄位定義；(2) `fanout render <manifest> <lane>` 由那一列 + 3b 模板輸出派工 prompt（共同規則仍指向 `docs/lane-protocol.md`，不複製進 prompt）；(3) `fanout check <manifest> <lane> [--base main]` 用 `git diff --name-only <base>...<branch>` 比對「擁有」glob，**逐一列出越界檔案、非零 exit**；(6) `## Decisions` 區的格式（每一筆：日期、誰裁決、內容、出處）。不做：lane 狀態／roll-up、信箱、`feature start` 接線、改整合者 SOP 或 lane-protocol（E178 會改成引用本工具） | 無 |
| e177b | E177b | feat/e177b-lane-status-tooling | ../agm-lanes/e177b | 新檔 `tools/lane-status.ts` + 新檔 `scripts/lane-status.mjs`、新檔 `scripts/mailbox-watch.mjs`、新檔 `scripts/test-lock.mjs`（名稱 cut 決定）、`package.json`（**只限** `scripts.test` 那一行）、`dist/**`；qa：新檔 `test/e177b-*.test.mjs`（建立已預先授權）；自己的 spec／證據／`.current/e177b/` | `bin/**`、`content/**`、goldens、budget、`tools/lane-registry.ts`／`tools/feature-rollup.ts`／`guards/file-lock.ts`（只能 import）、`docs/**`、`.claude/commands/integrator.md`、e177a 的新檔、`package.json` 其他欄位 | 做：(8) lane 狀態 —— 讀每個 worktree 的 `.current/<lane>/handoff.md` + `git log main..<branch>` + `git status --porcelain`；(9) 加總各 lane 票數／hop／review＋qa 輪數對照 cap，並把 completed 數與磁碟上的 qa 證據交叉比對（E175(d) 同類缺口）；(11) 測試鎖 —— 並行的全套排隊而不是互搶（E182）；信箱監看 —— 計數寫死在程式、啟動印 `armed: baseline N, current N`、baseline 當參數（重掛接續）、到期前印 `expiring — re-arm`、同一檔拒絕第二個監看、寫訊息時由程式蓋 `time`／`re:<檔名>#n`／`hop`。不做：manifest 解析（e177a）；改 SOP／lane-protocol 散文（E178 引用） | 無 |
| e212 | E212 | feat/e212-deflake-ac13b | ../agm-lanes/e212 | `test/e177b-test-lock.test.mjs`（只限 AC13b 那個測試與它用到的 helper）；自己的證據與 `.current/e212/` | 其他一切 —— 特別是 `scripts/test-lock.mjs`、`tools/**`、`package.json`、`content/**`、其他測試檔 | 做：讓 AC13b 的子程序壽命由測試控制（例如子程序一直等到測試在 probe 回來之後寫入 release 檔才結束），不再用固定 700ms 的忙等；AC13b 的斷言不變；要證明不再 flake —— 在負載下重複跑（例如同時跑全套時連跑 AC13b 多次）全部通過，並記進證據。不做：改 `scripts/test-lock.mjs`（鎖的行為是對的）、改其他 AC。**單角色 qa 派工**（Constitution §3.1，test-only），不走 sr／code-reviewer | E177b ✓ |
| e213 | E213 + E214 + E216 | feat/e213-shipped-ignored-shape | ../agm-lanes/e213 | `bin/agc-init.mjs`（只限 `finish --shipped` 路徑：`planLaneClose`／`executeLaneClose`／`executeHarvestRefresh` 一帶；`--abandoned` 的證據收割 helper 與它印的訊息（E216，並供 `--shipped` 重用）；`feature start` 的 `bootstrapLaneEnv`，只在 cut 選「start 時建 bootstrap link」時）；qa：`test/agc-feature-finish-history.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e180-abandoned-harvest.test.mjs`（或新檔 `test/e213-*.test.mjs`，建立已預先授權）；自己的 spec／證據／`.current/e213/` | `content/**`、goldens、budget、`tools/**`（只能 import）、`scripts/**`、`templates/**`、`docs/**`、`package.json`、`test/e177b-test-lock.test.mjs`（e212）、其他測試檔 | 做：**E213** —— root `tasks.md` 被 ignore 時 `--shipped` 能完成（fs-only 寫指標＋advisory，或在任何變動前大聲拒絕 —— cut 決定），並修掉 rollback 前先印的「harvested」行；**E214** —— `--shipped` 遇到被 ignore、未連回 primary 的證據時先收進 primary（例如 `<dir>/archive/<lane>/`）或在任何變動前大聲拒絕，**絕不能靜默成功**（E180 的標準），和／或 `feature start` 建 bootstrap link；**E216** —— `--abandoned` 對已收割的 ignore 檔不再印誤導的 `moved` 行。驗收形狀以 `specs/e73-adopter-acceptance-2026-09-27.md` 的 Run A／A′／B 為準（測試要重現「`.current/`、`tasks.md`、`qa_reports/`、`review_reports/` 全部被 ignore」）。不做：E215（hook／巢狀 node_modules，v4 之後）、E196／E207（佇列中的收割邊角）、E177c、coord-03 散文（若需要，隨 E130） | E73 ✓、E180 ✓ |

## 7.1 的非 lane 工作（coordinator 直接做）
| 項目 | 票 | 誰 | 產出 | 相依 |
|---|---|---|---|---|
| 7.1 | **E127 處置** | 人類裁決（D2），整合者給建議 | 一筆 `## Decisions`；backlog E127 row 標處置；如果處置需要散文，併進 e130 的範圍 | Wave 6 ✓ |
| 7.0 | **E73 adopter 驗收** | 獨立驗收 session（信箱 `accept70`），repo：一個 adopter 驗收專案（D3）的**拋棄式本機 clone**（放在 `../agm-lanes/_accept70/` 之下）（移除 origin；`cp -R` 本體被 ignore 的 `.current/`、`tasks.md` 以保留形狀）；本體只讀（clone＋cp），不碰其真實工作（2026-09-27 裁決，見 Decisions） | 驗收紀錄：`feature start`、`finish --shipped`、`finish --abandoned` 各跑一次的輸出與結果；發現的缺陷記成新票 | E73 ✓ **＋ e180 已合併**（該 repo 全部 gitignore，正是 E180／E194 會靜默丟證據的形狀；計劃 §9 也要求「且 E180 已修」） |

## Lanes（7.2，序列，暫定 —— 派工前重新核對）
| lane | 票 | branch | 擁有（暫定） | 範圍 | 相依 |
|---|---|---|---|---|---|
| e130 | E130 + E199 + E198(b)（＋ D2 若需要的 E127 散文） | feat/e130-lane-default | `content/**`、goldens、budget、`test/release-staging.test.mjs`、`test/render-structure.test.mjs`、`dist/**` | coord-03 Feature-Scope Gate 改成 lane 是票的起點、呼叫 `agc feature start`、宣告範圍（待決 B：一體適用但條件觸發，接既有 Complexity Scope Gate `content/coord-01-core-head.md:26`）；三項 ride-along；E199 刪 const-05 例外；E198(b) 8a stage `.current/_primary/tasks.md` | 7.1 全部合併（**E204 必須先合**）、7.0 通過、D2 已決 |
| e178 | E178 + E192 | feat/e178-integrator-role | `content/**`（新 `content/skill-integrator.md`、§6 修憲）、goldens、budget、新 `prompts/integrator.ts`、`tools/registry.ts`（只限 `PROMPT_REGISTRY`）、`templates/claude-code-agents/`（若 cut 選專用驗證者模板）、`docs/lane-protocol.md`、`.claude/commands/integrator.md`（刪除或改成只指向正式角色）、`CLAUDE.md`／`AGENTS.md` 的 prompt 數量敘述、對應測試 | 正式角色；§6 授權 merge／`branch -d`／`worktree remove`／`update-ref -d <ref> <sha>`；合併解法的 code-review 義務；信箱協定＋cut 預審；決策權表；E192 驗證 subagent。**引用** E124／E125／E126／E177a／E177b，不重述 | e130 合併、e177a + e177b 合併 |

E178 的範圍同樣很大（技能檔＋修憲＋prompt 註冊＋信箱協定＋決策權表＋E192），**到 7.2b 派工前再判斷要不要拆**（D5，現在只標記）。

## 所有權重劃（相對於 §3 預設 lane 表）
- `tools/fanout-manifest.ts`、`tools/lane-status.ts`、`scripts/{fanout,lane-status,mailbox-watch,test-lock}.mjs`：新檔，§3 表沒有對應 lane → 分別歸 e177a／e177b。
- `package.json` 的 `scripts.test` 一行：§3 表沒有 owner（平常是 release 的版號欄位）→ 劃給 e177b，只限那一行。
- `bin/agc-init.mjs`（L-INIT）：本段只有 e180 能動；E177c 的 `feature start` 接線因此不能與 e180 並行（D1）。
- `bin/agc-init.mjs`（L-INIT）：e180 已合併；7.1f 只有 e213 能動（e212 只動一個測試檔，與它不重疊）。
- 7.2 的 `prompts/`（L-RENDER）、`tools/registry.ts`（L-STATE）、`templates/`（L-INIT）劃給 e178：7.2 是序列段，不會有並行 lane 撞到。

## 完成定義 → 票
| 完成定義條目（計劃 Wave 7 派工卡） | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| E127 已有明確處置 | E127 處置（D2） | ✓ 7.1 |
| `coord-03` Feature-Scope Gate 改寫，lane 是票的起點 | E130 | ✓ 7.2 |
| 觸發條件接既有 Complexity Scope Gate | E130 | ✓ 7.2 |
| 適用範圍已宣告 | E130 | ✓ 7.2 |
| E73 adopter 驗收通過（E130 之前） | 7.0（D3）—— 第一次 FAIL，**e213（E213＋E214）合併後重跑** | ✓ 7.1 |
| E213＋E214（＋E216）修好（E130 之前） | e213 | ✓ 7.1f |
| E212 修好（E130 之前） | e212 | ✓ 7.1e |
| E180 修好（含 E194、E197） | e180 | ✓ 7.1 |
| E204 修好（E130 之前） | e204 | ✓ 7.1 |
| E130 三項 ride-along ＋ E199 ＋ E198(b) | E130 | ✓ 7.2 |
| lane 清單可用：派工 prompt 由清單渲染、越界被機器標出 | **E177a**（render ＋ check） | ✓ 7.1 |
| integrator 是正式角色（SOP 在 `content/`、§6 授權、`.claude/commands/integrator.md` 退役、E192） | E178 | ✓ 7.2 |

沒有空格。E177b 不對應任何一條完成定義 —— 它是票面 scope add，但 E178 的 `/integrator status` 與 E192 的驗證者會引用它，所以留在 v4。

## 整合後（整合者自己的 commit／接線）
- **E204 合併之後立刻**：commit primary 工作樹那一列 `T-RELV4W6-01`，跑全套 —— 這就是 E204 的實際驗收（票面：「committed 之後 AC10+AC11 會紅」）。
- e177a／e177b 合併後：整合者 SOP 3b／5a／`status` 改成呼叫 `scripts/fanout.mjs`／`scripts/lane-status.mjs`、信箱監看改用 `scripts/mailbox-watch.mjs`（暫行 SOP 的過渡；E178 正式化時改成引用）。7.2 的派工就用 `fanout render` 渲染，當成 E177a 的第一次實戰。
- 計劃文件：7.1b 的散文依 D1 改寫；勾完成定義；補 7.1 結案方框。
- done-mark E204、E180、E194、E197、E177a、E177b（D1=A 時，E177 row 註明 c 排到 v4 之後）。
- 跨 lane roll-up（e204／e180／e177a／e177b，票號各異 → 手動加總並註明，E175(d)）。

- **7.0 重跑（e213 合併後）**：沿用第一次的 prompt（`specs/e73-adopter-acceptance-2026-09-27.md` 的做法），並把第一次的兩個 clone 偏差寫進 prompt 當必要步驟 —— (1) 從本體複製被 ignore、由 husky 生成的 `.husky/_`，否則 clone 的 primary 完全不跑 hook；(2) clone 的 primary 以唯讀 symlink 連本體的 `app/web/node_modules`，否則 main 上每個 commit 都過不了 pre-commit。刪 clone 之前先拿掉所有指向本體的 symlink。重跑必做 Run A（不再需要 A′），B／C 當回歸。

## 合併順序
7.1：e204 → e180 → e177a → e177b（四條檔案互斥，順序只為了讓 E204 最先進 main；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/wave7.1` 重建 `dist/`、全套 → ff `main`
7.1e／7.1f：e212、e213 逐條合併（檔案互斥，誰先 PASS 誰先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ e213 合併後重跑 7.0 → 通過才開 7.2
7.2：e130 → `integ/wave7-e130` → ff `main` → 派工 e178 → `integ/wave7-e178` → ff `main`

## Dispatch pins（✅ D4 已確認）
- e180、e177a、e177b：`sr-engineer=fable`（沿用 Wave 6）。
- e204：單角色 qa，無 pin。
- e212：單角色 qa，無 pin。
- e213：`sr-engineer=fable`（沿用 e180，人類裁決 2026-09-27）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-27 | 人類 | **D1=A**：E177 拆成 E177a ∥ E177b（7.1 並行）；E177c（`feature start` 讀清單）排到 v4 之後（佇列 #40） | 整合者 session；backlog E177 row |
| 2026-09-27 | 人類 | **D2**：E127 接受並寫明 —— coord-03 lane 起點散文寫 cwd 重置規則（隨 E130）；機械偵測器開成 **E205**（佇列 #16） | 整合者 session；backlog E127／E130／E205 row |
| 2026-09-27 | 人類 | **D3**：7.0 adopter repo = 一個 adopter 驗收專案；整合者修正相依為「e180 合併之後」 | 整合者 session；計劃 7.0 row |
| 2026-09-27 | 人類 | **D4**：e180／e177a／e177b `sr-engineer=fable`；e204 單角色 qa、無 pin | 整合者 session |
| 2026-09-27 | 整合者 | D5（E178 要不要拆）延到 7.2b 派工前判斷 | 本檔 7.2 段 |
| 2026-09-27 | 整合者 | e177a：CLI error code 改名避開 `test/error-code-contract.test.mjs` 的 SUFFIX_RE（選 C，拒絕執行期拼字串與改測試範圍）；spec 只改名，人類在 lane session 已被告知 | 信箱 e177a to-lane#2 |
| 2026-09-27 | 人類 | （整合者建議，人類在 e177b 的 session 親手核准）e177b：所有權擴充 `test/lane-paths.test.mjs` 的 `SANCTIONED_LANE_PATHS_IMPORTERS` 加一行 `tools/lane-status.ts`；AC5 證據比對收窄（archive 同範圍規則、只算 PASS、排除 void、推不出票號時明印） | 信箱 e177b to-lane#5 |
| 2026-09-27 | 整合者 | e204 先行合併並拆除（`75cdfd6`、`85bcf6d`），不等整批 —— 讓 primary 的 `T-RELV4W6-01` 能 commit；e180 同樣逐條合併（`18c625f`） | 本檔合併順序 |
| 2026-09-27 | 整合者 | E206（e180 NEW-1）併進 E196；E207（NEW-2）範圍擴到 `--shipped` 的同形 `cpSync`，排佇列 #35 | backlog E196／E206／E207 row |
| 2026-09-27 | 整合者 | e177a、e177b 逐條合併（`9425ea6`、`acfdc09`）；7.1 結案，整合後全套 2737/2737 | 計劃 Wave 7.1 結案方框 |
| 2026-09-27 | 整合者 | E209（e177b NEW-1，test-lock 空鎖檔 ABA）接受為殘留、不退回 lane：最壞情況是兩套測試同時跑，也就是鎖出現前的現況；排佇列緊接 E182。E210、E211 照一般流程排佇列 | 信箱 e177b to-lane#7 |
| 2026-09-27 | 整合者 | E208（e177a NEW-1）**建議**併進 E178 的格式段 —— 會讓新票進 v4，待人類裁決 | 本檔；整合者 session |
| 2026-09-27 | 人類 | **E208 併進 E178**（整合者建議）；**E212 放進 v4 Wave 7、E130 之前**，開單角色 qa lane e212 | 整合者 session |
| 2026-09-27 | 整合者 | 開 **E212**（AC13b 在全套負載下的計時 flake，1/3）；**建議**排進 Wave 7、E130 之前，以單角色 qa lane 修（同 E204）—— 會讓新票進 v4，待人類裁決。另記：整合者在 `d9dd04d` 用 `grep … && git push` 串接，全套有 1 個失敗仍被 push 出去；重跑 2737/2737。之後一律以 `npm test` 的 exit code 當閘門 | 本檔；整合者 session |
| 2026-09-27 | 人類 | （整合者建議）**7.0 改在拋棄式本機 clone 上跑**：`finish --shipped` 要求 branch 已合進 main 並在 main 上 commit，在本體上做不到唯讀，且本體有兩條進行中的 `.claude/worktrees/*`；clone 移除 origin、複製被 ignore 的治理狀態以保留 E180／E194 的形狀；由獨立 session 執行，經 `accept70` 信箱回報，新發現以 `pending-ticket` block 附在回報、由整合者配號 | 整合者 session（接手前一個已關閉的整合者 session） |
| 2026-09-27 | 整合者 | **7.0 第一次驗收 FAIL**（回報已對照 clone 與原始紀錄核對屬實）：`--shipped` 在 root `tasks.md` 被 ignore 時永遠 exit 1；強制 track 後 exit 0 但默默刪掉被 ignore 的證據。`--abandoned`（B）與衝突拒絕（C）PASS；本體前後相同。四筆發現配號 E213–E216；驗收紀錄存進 `specs/e73-adopter-acceptance-2026-09-27.md` | 信箱 accept70 to-integrator#1／to-lane#1 |
| 2026-09-27 | 人類 | （整合者建議）**E213＋E214 進 v4、E130 之前**，開 L-INIT lane **e213**（7.1f，與 e212 並行，`sr-engineer=fable`）；**E216 併進 e213**；**E215 排 v4 之後**（佇列 #14）；e213 合併後重跑 7.0 | 整合者 session |
| 2026-09-27 | 整合者 | e213 cut 預審：五個設計選擇都同意（fs-only＋advisory、同一個 tasks.md 寫指標、`archive/<lane>/`、不做檔名過濾、start 時的 bootstrap link 延後、E216 qualify）；**範圍擴充**：`--shipped` 的收割納入 `specs/`（同一類靜默遺失；`--abandoned` 的對稱缺口由 lane 記成 pending-ticket）；遞迴收割，symlink 不可複製成斷鏈（E207 形狀），要嘛 dereference，要嘛大聲列出 | 信箱 e213 to-integrator#1／to-lane#1 |
| 2026-09-27 | 人類 | （整合者建議）**lane 沉默缺口併進 E178**：信箱監看只在有訊息時觸發，e212 跳過 cut 預審直接進 qa，整合者到人類問起才發現。E178 加：`lane-status` 監看模式（偵測狀態轉換）、fan-in 檢查「有 cut 的 lane 是否先送預審」、`lane-protocol` 寫明單角色 qa lane 要不要送 cut。本波暫以整合者 scratchpad 的狀態監看補位 | 整合者 session |
| 2026-09-27 | 整合者 | e212 驗證通過並合併（`663d50d`，整合 branch `integ/wave7-e212`；lane 層與整合層全套都是 2737/2737），`finish --shipped` 拆除（`eafbd88`），無新發現。roll-up：1 task、hop 2、review 0、qa 0。備註：lane 沒有先把 cut 送信箱預審（單角色 qa，唯一 task 照抄 manifest 範圍），缺口已併進 E178 | 信箱 e212 to-integrator#1／to-lane#1 |
| 2026-09-27 | 整合者 | e213 驗證通過並合併（`96c4123`，整合 branch `integ/wave7-e213`；lane 層與整合層全套都是 2754/2754），`finish --shipped` 配號 E217–E219（`68082d4`）並拆除（`1d0d453`）。越界 7 檔全是裸 task id 的證據檔（`review_T0x.md`），main 上無同名檔 → 接受為機械性越界；碰撞風險記進 E136，7.2 起的派工 prompt 要求 `T-<票號>-NN`。roll-up：6 task 完成、3 void（cut 修訂）、hop 4、review 0、qa 0。E218 部分源自整合者預審只要求 dereference、沒要求目錄連結的 containment | 信箱 e213 to-integrator#2／to-lane#2 |
| 2026-09-27 | 人類 | （整合者建議）**E217 不進 v4**（留在佇列 #14）；**task id 帶票號兩者都做**：7.2 起的派工 prompt 範圍欄要求 `T-<票號>-NN`（e130、e178 與 7.0 以後的任何 lane），並併進 E178 正式寫進 `docs/lane-protocol.md` | 整合者 session |
| 2026-09-27 | 整合者 | **7.0 重跑 PASS**（回報已對照 clone 與原始紀錄核對屬實：Run A 的 5 個假檔都在 `archive/zz911/`、`tasks.md` 仍未 track 且無 close commit、A2 前後指紋相同、B 的 moved 行帶 E216 說明、C 大聲拒絕、本體前後相同）。發現 1 筆配號 **E220**（P3，排佇列）。紀錄存進 `specs/e73-adopter-acceptance-rerun-2026-09-27.md`。**7.2 的前置全部到齊** | 信箱 accept70r to-integrator#1／to-lane#1 |
