# Fan-out: agc-feedback-2026-09-08 未完成票（E231＋E107、E106；第二波 E108、E232）
base: 50c25e8    integration branch: 每條 lane 各一條 integ/<lane>

**狀態：人類核准 2026-09-28。** 範圍是人類 2026-09-28 排定的「先把 `docs/agc-feedback-2026-09-08.md` 的未完成票做完，再接 post-v4 佇列」，加上同日開的 E231／E232。

## 派工前核對（整合者，2026-09-28）
- `git worktree list`：primary（main `50c25e8`）＋ lane `e231`（`feat/e231-info-hygiene-rule` @ `93eab3f`，已由 `agc feature start` 建立）。main 在 `93eab3f` 之後只多了 `50c25e8`，只改 `docs/v4.0.0-new-tickets.md`，與兩條 lane 都無交集。
- primary handoff 停在 `release-v4.0.0`（已發版，lease 早已過期），drift 無（T-REL4-02 的已知 advisory，不 `tw_sync`）。
- **e231 lane 已有未 commit 的 PM cut 草稿**：`specs/e231-info-hygiene-rule.md`、`.current/e231/tasks.md`（T-E231-01..04）、`.current/e231/pending-tickets.md`（E231-NEW-1：機械掃描，另開），以及 `docs/backlog.md` E107 列的「提議合併」註記；handoff 為 `pm:In_Progress`、`next_role: sr-engineer`、**未設 `cut_approved`**。lane session 接手時依下方 Decisions 的兩項人類裁決修訂草稿、commit、送信箱預審，再向人類呈現。
- **§3.2 揭露**：本 session 在 coordinator 身分下為 e231 派過 PM，並做過兩項簿記修正（把 lane 內自配的 E234 移成 `pending-tickets.md` 的 lane-local 條目、spec 內引用跟著改）。非 builder、非 judge；之後不再在任何 lane 內派角色，lane 由獨立 session 執行，本 session 只整合。
- E106 的檔案面（grep 過）：`bin/agc-init.mjs`（`init`／`check`，已有 `.git/info/exclude` 寫入邏輯供 `agc feature start` 用）、`schema/versions.ts`（`config: 1`）、`schema/migrations-config.ts`、`tools/config.ts`、`bin/agent-governance-usage-hook.mjs`（讀 config）；釘 config schema 1 的測試：`test/agc-adapters.test.mjs`（約 15 處）、`test/config-versioning.test.mjs`、`test/config-cache.test.mjs`、`test/p0-onboarding-lite-default.test.mjs`。以上都存在、都 tracked。
- 兩條 lane 的擁有集合互斥：e231 只動 `content/**`、goldens、budget、`CONTRIBUTING.md`、backlog E107 列；e106 只動 `bin/`、`schema/`、`tools/config.ts`、config 相關測試與文件。**共享生成物（`content/**` ＋ goldens ＋ `test/context-budget.test.mjs`）本波只屬 e231。**
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。`scripts/fanout.mjs`、`scripts/mailbox-watch.mjs`、`scripts/lane-status.mjs` 在 base 上存在。
- task id 帶票號：`T-E231-NN`、`T-E106-NN`。

## Lanes（第一波，並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e231 | E231（併 E107） | feat/e231-info-hygiene-rule | ../agent-governance-mcp-lanes/e231 | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e231-*.test.mjs`、`CONTRIBUTING.md`、`docs/backlog.md`（只限 E107 列的合併註記）、`specs/e231-*`、`qa_reports/*E231*`、`review_reports/*E231*`、`.current/e231/**` | `bin/**`、`tools/**`、`schema/**`、`gates/**`、`prompts/**`、`scripts/**`、`templates/**`、`dist/**`、其他 `test/**`、其他 `docs/**`、`package.json`、`CLAUDE.md`、`AGENTS.md`、`specs/fanout-*.md`、e106 的檔案 | 做：constitution §6（`content/const-15-core-tail.md`，core 片段，四種組合都載入）加兩條 —— Information hygiene（所有持久產出不得含敏感資訊，一律適用、無例外）與 Generic citation（不用治理術語、票號不得單獨當說明、只引用 tracked 路徑；機器協定欄位豁免；**治理內部產物 —— qa/review 報告、`pending_notes`、handoff —— 豁免本條**）；本 repo 的票號豁免**撤銷**（Decisions D1）；`CONTRIBUTING.md` 加一行指引；golden／budget 重建與四種組合的釘選測試由 qa 做；E107 由本票結掉。不做：清理既有外洩（E232）、改寫既有票號註解（E233）、機械掃描（E231-NEW-1）、adapter 範本 | 無 |
| e106 | E106 | feat/e106-init-artifacts-flag | ../agent-governance-mcp-lanes/e106 | `bin/agc-init.mjs`、`bin/agent-governance-usage-hook.mjs`、`schema/versions.ts`、`schema/migrations-config.ts`、`tools/config.ts`、`dist/schema/**`、`dist/tools/config.*`、`docs/config.md`、`docs/schema-versions.md`、`docs/install.md`、`README.md`、`test/agc-adapters.test.mjs`、`test/config-versioning.test.mjs`、`test/config-cache.test.mjs`、`test/p0-onboarding-lite-default.test.mjs`、`test/e106-*.test.mjs`、`specs/e106-*`、`qa_reports/*E106*`、`review_reports/*E106*`、`.current/e106/**` | `content/**`、goldens、budget、`prompts/**`、`gates/**`、`scripts/**`、`templates/**`、其他 `tools/**`（只能 import）、其他 `dist/**`、其他 `test/**`、其他 `docs/**`（含 `docs/backlog.md`）、`package.json`、`CLAUDE.md`、`AGENTS.md`、`CONTRIBUTING.md`、`specs/fanout-*.md`、e231 的檔案 | 做：`agc init --artifacts=local\|repo`（旗標，非互動；預設 `local`；`local` 寫 `.git/info/exclude` 不寫 `.gitignore`；已 tracked 的路徑只偵測並印出 `git rm -r --cached …` 指令與「歷史仍含這些檔案」的說明，絕不自己執行）；選擇存進 `.current/.config.json` 的 `artifacts`（config schema 1 → 2，只蓋章不播種，**不存在 === 未宣告，不是 local**）；`agc check` 比對意圖（key）與狀態（exclude 檔）並回報漂移。四項決定 2026-09-14 已定，本票是 cut 不是設計題。不做：`agc eject`（E108）、任何 SOP 散文、本 repo 自己的 `.current/.config.json` 內容變更 | 無 |

## Lanes（第二波，暫定 —— 第一波合併後另行核准、另行派工）
| lane | 票 | 範圍 | 相依 | 為什麼不在第一波 |
|---|---|---|---|---|
| e108 | E108（`agc eject`） | `bin/agc-init.mjs` 新子命令＋`test/agc-adapters.test.mjs` | E106 ✓、E231 ✓ | 與 e106 同檔（`bin/agc-init.mjs`、`test/agc-adapters.test.mjs`）；且 eject 在 `local`／`repo` 兩種模式下行為不同，要等 `artifacts` key 定案；保留 `specs/`／`design/` 的前提是 E107（E231） |
| e232 | E232（清理既有外洩） | `content/constitution-rationale.md`、CHANGELOG、`specs/`、`research/`、`docs/`、含代號或本機路徑的測試與 fixture | E231 ✓ | 要照 E231 定案的措辭改；且碰 `content/**` 與 `test/context-budget.test.mjs`（共享生成物，第一波屬 e231） |

第二波兩條彼此預計互斥（e108 的兩個檔案經 grep 不含代號或本機路徑），合併第一波後重新 grep 確認再出清單。

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/backlog.md` E107 列 → e231：只限「提議合併」註記（PM 已寫在 lane 內）；其他 backlog 變更（done-mark、新票配號）屬整合者。
- `CONTRIBUTING.md` → e231：只加一行指引。
- `docs/install.md`、`README.md`、`docs/config.md`、`docs/schema-versions.md` → e106：記載新旗標與 config schema 2。
- 四個 config／init 既有測試檔 → e106：只有 qa 能改（§2）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| constitution 規定所有角色的持久產出不含敏感資訊 | E231（T-E231-01） | ✓ 第一波 |
| constitution 規定引用要讓非 agc 讀者看得懂（H6／H7／H9，E107 結案） | E231（T-E231-01） | ✓ 第一波 |
| 規則在 lite／chain × design／non-design 四種組合都被載入（釘選） | E231（T-E231-04） | ✓ 第一波 |
| `agc init` 裝機時決定產物上不上 repo（H5／H8） | E106 | ✓ 第一波 |
| `agc eject` 可退場（H4(b)） | E108 | 第二波 |
| repo 追蹤的檔案不含外洩內容（轉 public 前提） | E232 | 第二波 |

第一波沒有空格；第二波兩格由第二波清單負責。

## 整合後（整合者自己的 commit／接線）
- 第一波合併後：重建 `dist/`、重啟 primary MCP server；backlog E231／E107／E106 done-mark；`docs/agc-feedback-2026-09-08.md` 的 H5／H6／H7／H8／H9 狀態行與「懸而未決確認事項表」補上結論（#11 的本 repo 豁免改記為 2026-09-28 撤銷）；E231-NEW-1 由 `agc feature finish e231 --shipped` 配號，排進 post-v4 佇列。
- 之後出第二波清單（e108 ∥ e232）。

## 合併順序
e231 ∥ e106（檔案互斥，誰先 PASS 誰先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/<lane>` → ff `main` → 第二波

## Dispatch pins
- e231：`sr-engineer=fable`（人類長期偏好）。
- e106：`sr-engineer=fable`（同上）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | 順序：先做完 `agc-feedback-2026-09-08.md` 的未完成票（E231＋E107、E106、E108），E232 在其後，再接 post-v4 佇列 | coordinator session |
| 2026-09-28 | 人類 | **D1** 撤銷 2026-09-14「本 repo 豁免票號規則」的決定 —— repo 將轉 public，讀者不再都是 agc 使用者；E233 因此成立 | coordinator session（「照 coordinator 的建議 ok」） |
| 2026-09-28 | 人類 | **D2** Information hygiene 一律適用、無例外；Generic citation 豁免治理內部產物（qa/review 報告、`pending_notes`、handoff） | 同上 |
| 2026-09-28 | 人類 | 以 `integrator fan-out` 派給獨立 lane session 執行 | 整合者 session |
| 2026-09-28 | 人類 | 核准本清單（第一波 e231 ∥ e106；所有權重劃如上；e231 lane 既有 PM 草稿由 lane session 依 D1／D2 修訂後接手），開始派工 | 整合者 session |
| 2026-09-28 | 整合者 | 機械性越界：`test/drift-baseline.test.mjs`、`test/drift-skew.test.mjs`、`test/e22-stale-notify.test.mjs`、`test/schema-versions.test.mjs`、`test/agc-feature-lifecycle.test.mjs` 劃給 e106，只限 qa 重新釘 config schema 版本與行號視窗（T-E106-06）；皆不在 e231 擁有集合內 | 信箱 e106 to-integrator#2 |
| 2026-09-28 | 整合者 | e231 驗證通過並合併（`f95e4ae`；lane 層 2819/2822、整合層 2819/2822，0 fail／3 skipped）；無衝突 → 無合併審查；4 張 lane 新發現由 `finish --shipped` 配號（其中 NEW-2 絕對路徑、NEW-3 被拒 PASS 仍寫入證據檔 排 P2）；已知 drift（T-E231-01/02 ledger，E150 類）有證據、接受 | 信箱 e231 to-integrator#2 |
| 2026-09-28 | 整合者 | e106 驗證通過並合併（lane 層 2834/2837、整合層 2838/2841，0 fail／3 skipped；整合層首跑有 1 個負載型計時失敗，單獨 5/5 通過、重跑全綠，併入 E238）；無衝突 → 無合併審查；越界僅限已核准的 5 個測試檔；合併後 primary `.current/.config.json` 由 schema 遷移蓋成 v2，依 spec 一併 commit；E106-NEW-1 由 `finish --shipped` 配號 | 信箱 e106 to-integrator#3 |
| 2026-09-28 | 人類 | E239 提前到 E108 之前；本 repo 宣告 `artifacts: repo`（以 `agc init --artifacts=repo` 寫入） | 整合者 session |
