# Fan-out: agc-feedback-2026-09-08 未完成票 第二波（E239→E108 ∥ E232）
base: 6164f06    integration branch: 每條 lane 各一條 integ/<lane>

**狀態：人類核准 2026-09-28。** 接續 `specs/fanout-feedback-leftovers.md`（第一波 e231、e106 已合併）。

## 派工前核對（整合者，2026-09-28）
- `git worktree list` 只有 primary（main `6164f06` = origin/main；該 commit 曾在測試未綠時被推上，重跑 2838/2841 全綠 —— 首跑的 1 個失敗是與 MCP 重連同時發生的暫時性干擾，併入 E238）；第一波兩條 lane 已 `finish --shipped`。primary handoff 停在 `release-v4.0.0`（lease 過期）；MCP server 已重連，讀得到 config schema 2。
- 佇列順序（人類 2026-09-28）：E239 → E108 → E232 → E235。E239 與 E108 都改 `bin/agc-init.mjs`（E239 修 E106 剛出貨的子目錄錨點；E108 的 local 模式移除集合依賴正確的 exclude 規則）→ **不能並行，排成同一條 lane 內的兩個循序 feature**（R1）。
- E232 的檔案面（grep `本機絕對路徑｜內部網址｜客戶代號` 三類，共 135 個 tracked 檔）：`specs/` 45、`qa_reports/` 23、`.current/` 18、`test/` 12（含 fixture）、`review_reports/` 12、`research/` 7、`docs/` 4、`dist/` 4、`tools/` 3、`multi-agent-scripts/` 2、`content/` 2、root 2（`CHANGELOG.md`、`NEW-TICKETS.md`）、`gates/` 1。另有一個檔名本身含客戶代號（`research/` 下的視覺保真回顧）→ 要改名並更新引用。
- **E232 與 E235 的界線（R2）**：135 檔中有一類是**協定產生的**而非角色撰寫的 —— `.current/**` 的 handoff（`prd_path` 等欄位）、`specs/fanout-*.md` 的 worktree 欄（8 檔）、以及以它們為來源的 `test/fixtures/e177a/**`、`test/fixtures/e178b/**`。手動改掉之後工具下一次寫入又會產生，應由 E235 先改格式（例如相對於 primary／lanes-root 的路徑）再一次回溯清理。建議 E232 只清**角色撰寫的內容**，協定產物整類歸 E235。
- 與 e108 的交集：e108 會碰的檔案（`bin/agc-init.mjs`、`test/agc-adapters.test.mjs`、`test/e106-init-artifacts-flag.test.mjs`、`docs/install.md`、`README.md`、`docs/config.md`）經 grep **不含**任何外洩類別 → 兩條 lane 擁有集合互斥。
- 共享生成物：`content/skill-design-auditor.md` 會組進 prompt → golden／budget 會動 → 本波 `content/**` ＋ goldens ＋ `test/context-budget.test.mjs` 只屬 e232。e108 不碰 `content/**`。
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。task id 帶票號：`T-E239-NN`、`T-E108-NN`、`T-E232-NN`。

## Lanes（第二波，並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e108 | E239 → E108（同一 lane 內循序：E239 PASS 後才開 E108 的 cut） | feat/e108-init-subdir-and-eject | ../agent-governance-mcp-lanes/e108 | `bin/agc-init.mjs`、`test/agc-adapters.test.mjs`、`test/e106-init-artifacts-flag.test.mjs`、`test/e239-*.test.mjs`、`test/e108-*.test.mjs`、`docs/install.md`、`docs/config.md`、`README.md`、`specs/e239-*`、`specs/e108-*`、`qa_reports/*E239*`、`qa_reports/*E108*`、`review_reports/*E239*`、`review_reports/*E108*`、`.current/e108/**` | `content/**`、goldens、budget、`tools/**`（只能 import）、`schema/**`、`gates/**`、`prompts/**`、`scripts/**`、`templates/**`、`dist/**`、其他 `test/**`、其他 `docs/**`（含 `docs/backlog.md`）、`research/**`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、`specs/fanout-*.md`、e232 的檔案 | 做：**E239** —— 從 repo 子目錄跑 `agc init` 時，exclude 規則要能排除它實際建立的檔案（錨點跟著 scaffold 位置走，或拒絕在子目錄以 local 模式執行並說明）；**E108** —— `agc eject`：預設 dry-run 印出計畫、`--yes` 執行、`--purge-knowledge` 另外刪 `design/`／`specs/`（永不預設）；四類處置照 backlog 列（機器狀態刪、領域知識留、流程證據刪、宿主痕跡刪）；local／repo 兩種模式的差異照 E106 的 `artifacts` key；明說三件做不到的事（不改寫 git 歷史、不動程式碼註解、不改 `.mcp.json`／`settings.json`，只印指令）。每張票各自 PM cut、各自人類核准。不做：config schema 變更、任何 SOP 散文 | E106 ✓、E231 ✓ |
| e232 | E232（只清角色撰寫的內容，R2） | feat/e232-leak-cleanup | ../agent-governance-mcp-lanes/e232 | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`CHANGELOG.md`、`NEW-TICKETS.md`、`docs/backlog.md`、`docs/agc-feedback-2026-09-08.md`、`docs/postmortem-visual-fidelity-gate.md`、`docs/v4.0.0-execution-plan.md`、`research/**`、`multi-agent-scripts/**`、`tools/handoff-orchestrator.ts`、`tools/sync.ts`、`tools/tasks-file.ts`、`gates/visual.ts`、`dist/tools/handoff-orchestrator.*`、`dist/tools/sync.*`、`dist/tools/tasks-file.*`、`dist/gates/visual.*`、`specs/**`（`specs/fanout-*.md` 除外）、`qa_reports/**`、`review_reports/**`、`test/e117-void-task.test.mjs`、`test/e123b9-lane-flip.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/visual-gate-e2e.test.mjs`、`test/visual-report-schema-validation.test.mjs`、`test/widget-shape-spec.test.mjs`、`test/e232-*.test.mjs`、`.current/e232/**` | `bin/**`、`prompts/**`、`scripts/**`、`templates/**`、`schema/**`、其他 `tools/**`、其他 `gates/**`、其他 `dist/**`、其他 `test/**`（含 `test/fixtures/e177a/**`、`test/fixtures/e178b/**`）、其他 `docs/**`、`.current/**`（`.current/e232/**` 除外）、`specs/fanout-*.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、`CONTRIBUTING.md`、e108 的檔案 | 做：把角色撰寫的內容裡三類外洩（公司內部網址／工作項目連結、第三方客戶代號、本機絕對路徑）改成中性描述或刪除，照 constitution §6 *Information hygiene* 的措辭；含代號的 research 檔改名並更新所有引用；`tools/`、`gates/` 只改註解（改完重建對應 `dist/`）；`content/constitution-rationale.md` 順手補上 e231 review 指出漏列的 `pending_notes` 豁免；測試檔只由 qa 改（§2）；最後以同一組 grep 重掃，證明擁有範圍內零命中。不做：`.current/**` 的 handoff、`specs/fanout-*.md`、fanout fixture（協定產物，歸 E235，R2）、改寫既有票號註解（E233）、機械掃描（E234） | E231 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/backlog.md`、`docs/v4.0.0-execution-plan.md`、`docs/agc-feedback-2026-09-08.md`、`docs/postmortem-visual-fidelity-gate.md` → e232：只限清除外洩內容；backlog 的 done-mark 與配號仍屬整合者（整合 branch 上）。
- `tools/handoff-orchestrator.ts`、`tools/sync.ts`、`tools/tasks-file.ts`、`gates/visual.ts` 及對應 `dist/` → e232：只限註解，不得改任何程式行為。
- `qa_reports/**`、`review_reports/**` → e232：只限在既有證據檔裡清除外洩字串，不得改 verdict 行、`covers:` 行或任何被閘門解析的欄位。
- `test/e106-init-artifacts-flag.test.mjs` → e108：E239 的回歸案例可延伸它（只限 qa）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 子目錄執行 `agc init` 的 exclude 規則能排除它建立的檔案 | E239 | ✓ 第二波 |
| `agc eject` 可退場（H4(b)），誠實列出做不到的三件事 | E108 | ✓ 第二波 |
| 角色撰寫的 tracked 內容三類外洩零命中（grep 重掃為證） | E232 | ✓ 第二波 |
| 協定產物（handoff、fan-out 清單與其 fixture）不再寫入、也不再殘留本機絕對路徑 | E235 | ✗ 下一波（R2：需先定格式，且可能動 `content/**`，本波該共享生成物屬 e232） |

「repo 可以轉 public」要等 E235 完成後才成立 —— 不列為本波完成定義，下一波處理。

## 整合後（整合者自己的 commit／接線）
- 兩條合併後：重建 `dist/`；backlog E239／E108／E232 done-mark；`docs/agc-feedback-2026-09-08.md` H4 狀態行補上結論；lane 新發現由 `finish --shipped` 配號。
- 之後出 E235 的清單（格式變更＋回溯清理協定產物），完成後重掃全 repo，才向人類報告「可轉 public」。

## 合併順序
e232 ∥ e108（檔案互斥，誰先 PASS 誰先合；e108 內部 E239 先於 E108，兩個 feature 可分兩次合併；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/<lane>` → ff `main` → E235 清單

## Dispatch pins
- e108：`sr-engineer=fable`（人類長期偏好）。
- e232：`sr-engineer=fable`（同上）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | E239 提前到 E108 之前；本 repo 宣告 `artifacts: repo` | 整合者 session |
| 2026-09-28 | 人類 | 要求出第二波清單（「fan-out 第二波」） | 整合者 session |
| 2026-09-28 | 整合者 | **R1（提議，待人類核准）** E239 與 E108 同一條 lane 循序執行；**R2（提議，待人類核准）** E232 只清角色撰寫的內容，協定產物（`.current/**` handoff、`specs/fanout-*.md`、fanout fixture）整類歸 E235 | 本檔 |
| 2026-09-28 | 人類 | 核准本清單，含 R1（E239→E108 同一 lane 循序）與 R2（E232 只清角色撰寫的內容，協定產物歸 E235），開始派工 | 整合者 session |
| 2026-09-28 | 整合者 | E239 先行整合：驗證 lane e108 @ `5b39d9f`（7 commits、12 檔皆在擁有範圍、review／qa 第 1 輪通過、快照全套 2853/2856 0 fail），以 commit 而非 branch 頭合併進 `integ/e239`；lane 繼續在同一 branch 做 E108，`finish` 待 E108 PASS 後 | 信箱 e108 to-integrator#4 |
| 2026-09-28 | 整合者 | e232 驗證通過並合併（lane 層 2838/2841 0 fail，首跑 1 個負載型 lane-registry 失敗、單獨 3/3 通過、重跑全綠，併入 E238）；`docs/backlog.md` 自動合併無衝突 → 無合併審查；整合者以自己的關鍵字重掃：R2 排除範圍外 0 命中，剩 31 個協定產物歸 E235；qa 派工 pin 與自述等級不一致，僅記錄 | 信箱 e232 to-integrator#2 |
| 2026-09-28 | 整合者 | e108 的 E108 驗證通過並合併（lane 層 2888/2891 0 fail；13 檔皆在範圍內；review 兩輪 APPROVED、qa 第 1 輪 FAIL 第 2 輪 PASS，hop 7/10）；無衝突；合併後以整合者關鍵字重掃，R2 排除範圍外 0 命中。**第二波結案**：E239、E108、E232 全部進 main；4 張 e108 新發現與 2 張 e232 新發現由 `finish` 配號 | 信箱 e108 to-integrator#9 |
