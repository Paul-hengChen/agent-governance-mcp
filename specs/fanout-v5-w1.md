# Fan-out: v5.0.0 里程碑第 1 波（E422 ∥ E419）
base: c16fe90    integration branch: integ/v5-w1
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-19。** 兩條 lane 都已合併進 `integ/v5-w1`（e419 merge `3b32939`、e422 merge `7c019aa`，零衝突）、finish、拆除；派工 base `c29f100`（清單 PR #150 merge）；整合 branch 自 v4.22.0 發版後的 `main` `15474c2` 開；本波以一個 PR 合進 `main`，不發版（16.1 裁定 18）。

範圍由人類指定（integrator prompt「fan-out E422」，再於同一 session「fan-out E419」，2026-11-19）。兩張都是 v5.0.0 里程碑的票（`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 裁定 17 的順序）；依裁定 18，合進 `main` 但不單獨發版，與 E435 一起發 v5.0.0。E419 原排在 E423 之後，人類裁定提前與 E422 並行（見 Decisions）。

## 派工前核對（整合者，2026-11-19，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `c16fe90`、工作樹乾淨；primary handoff 停在 `release-cd-v4.22.0`（PASS），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（預設門檻 2 檔／P3；E422 為 P2 約 5 檔、E419 約 14 檔 → 兩條 lane 的 cut 都在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`、`artifacts` = `repo`。
- **相依**：兩張都只依賴 E418，已 DONE（`main` 2026-11-16，PR #123，v4.21.0）。E419 與 E422 之間沒有相依。
- **兩條 lane 的檔案不相交**：E422 只動 `tools/config.ts`、`docs/config.md`、`package.json` 與四個新檔；E419 的面（下列）全不含這些。`dist/` 各自不同檔：e422 → `dist/tools/{config,ticket-file}.*`；e419 → `dist/gates/{registry,stamp-provenance}.*`、`dist/tools/{handoff-orchestrator,handoff-parse,handoff-write,registry,drift}.*`。
- **共享生成物全歸 e419**：E419 改 `content/**`（`const-08-chain-31-mid.md`、`skill-sr-engineer.md`、`skill-qa-engineer.md`、`skill-release-engineer.md`）→ 6 份 golden（build-full ×4、constitution-monolith、hook-full）與 `test/context-budget.test.mjs`。E422 票面要求不進 `content/**`。
- **E422 的面**：新建 `docs/ticket-format.md`、`templates/ticket.md`、`tools/ticket-file.ts`、`scripts/check-tickets.mjs`（四個都不存在）；`tools/config.ts`（typed loader 逐鍵挑出已知 key，未知 key 被丟掉 → 新 key 必須加在這裡）；`docs/config.md`。`templates/ticket.md` 放 `templates/` 頂層：`bin/agc-init.mjs` 與 `test/e108-eject.test.mjs`、`test/e250-eject-path-escape.test.mjs` 只列舉 `templates/agent-adapters/`、`templates/claude-code-agents/`，不受影響。讀 config 的測試（`test/config-cache.test.mjs`、`test/config-versioning.test.mjs`、`test/e31-config-nonfatal.test.mjs`、`test/e289-config-key.test.mjs`、`test/e292-config-sister-repos.test.mjs` 等）都不在 e419 的面；新增選用 key 預期不打紅，以 PM probe 實跑為準。
- **E419 的面**（literal grep，排除 `dist/`、歷史 spec、CHANGELOG、retro、audit、backlog 與佇列）：原始碼 `gates/registry.ts`、`gates/stamp-provenance.ts`（刪）、`tools/handoff-orchestrator.ts`、`tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/drift.ts`；文件 `README.md`（第 69、230 行）、`CLAUDE.md`（第 48、62、107 行）、`docs/architecture.md`（第 37、47、67–79 行一帶）。**票面檔案清單以外新增兩處**：`CONTRIBUTING.md` 第 68 行（gate 模組清單點名 `stamp-provenance`）、`test/e441-tool-description-contracts.test.mjs` 第 46 行（釘 `tw_detect_drift` description 裡的 `stampAdvisory`，隨 cut 對 `DriftReport.stampAdvisory` 的取捨而定）。
- **E419 的測試面**：直接點名兩個機制的有 `test/ac-execution.test.mjs`、`test/dispatch-pins.test.mjs`、`test/drift-stamp-advisory.test.mjs`、`test/e148-seed-stamp.mjs`（helper，29 個測試檔 import）、`test/e148-stamp-provenance-seed.test.mjs`、`test/e18-write-provenance.test.mjs`（混合，QAEV 部分保留）、`test/e20-e21-crash-resilience.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/e28-shrink-warning.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/e38-next-role-lookahead.test.mjs`、`test/e394-release-sop.test.mjs`、`test/e437-repo-only-paths.test.mjs`、`test/e441-tool-description-contracts.test.mjs`、`test/error-code-contract.test.mjs`、`test/feature-lease.test.mjs`、`test/qa-flow.test.mjs`、`test/release-staging.test.mjs`、`test/success-metrics.test.mjs`；另有票面點名的計數釘 `test/e26-gate-stats.test.mjs`、`test/e308-single-source-tier-enum.test.mjs`。
- **不改的歷史檔**：`specs/` 既有 spec、`CHANGELOG.md` 既有段、`docs/retro-*`、`docs/prompt-audit-*`、`research/**` 裡的舊名稱是歷史紀錄，兩條 lane 都不改。

### 人類裁定（Stage 2，2026-11-19）
1. **E422「backlog 檔成為指向票檔的索引」怎麼落地**：(a) lane 不改 `docs/backlog.md`；`docs/ticket-format.md` 寫明「backlog 列以路徑指向票檔」的慣例；第一筆指向等第一份票檔出現時（E423 的 `spec-workshop`）再寫。—— 已裁 a。

### 交給各 lane 的 PM 在 cut 裡決定（隨 cut 在 lane session 呈人類核准）
- e422：票檔目錄的預設值與 config key 名稱（票面：「choosing the default is part of the cut」）；是否在 `package.json` 加 `check:tickets`（只加 `scripts` 一行）；是否需要 architect。
- e419（票面已寫明由 cut 決定的）：`DriftReport.stampAdvisory` 移除或固定回傳 null；`test/e148-seed-stamp.mjs` 保留或遷移；migration heal 用的 writer option 是否改名（只限內部）；golden 重抓與預算重量（縮字只會讓上限有餘量；若有下限受影響，照 E336／E365 慣例重定到實測值、零餘量，cut 附數字）；是否需要 architect。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e419 | E419 | feat/e419-retire-bookkeeping-stamp | ../agent-governance-mcp-lanes/e419 | `gates/registry.ts`、`gates/stamp-provenance.ts`（刪）、`tools/handoff-orchestrator.ts`、`tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/drift.ts`、`dist/gates/**`、`dist/tools/{handoff-orchestrator,handoff-parse,handoff-write,registry,drift}.*`、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`README.md`（只限 gate pipeline 步數與兩個機制）、`CLAUDE.md`（只限第 48、62、107 行一帶；`agc-version` stamp 不動）、`docs/architecture.md`、`CONTRIBUTING.md`（只限 gate 模組清單）、派工前核對列出的 E419 測試面全部、其他只因本票而紅的測試（PM probe 逐檔列出，整合者預審時確認）、`test/e419-*.test.mjs`（新，qa 定名）、`specs/e419-*.md`、`.current/e419/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；e422 擁有的全部（`tools/config.ts`、`docs/config.md`、`package.json`、`docs/ticket-format.md`、`templates/ticket.md`、`tools/ticket-file.ts`、`scripts/check-tickets.mjs`、`dist/tools/{config,ticket-file}.*`、讀 config 的測試）；`tools/handoff-types.ts`（票面已移出）；其他 `tools/**`、`gates/**`；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md`；Manifest-tier 與 Token Budget Brake（2026-11-13 裁定保留） | 做：(1) 退役 Bookkeeping-Write——移除 tool 邊界的 `bookkeeping_write` 欄位（`tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`）、orchestrator 分支、registry 條目與錯誤碼 `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`；migration heal 的不更新時間戳 writer option 保留為內部選項（可改名）；E21 crash checkpoint 保留、改為一般寫入（照常延長租約），改 `content/skill-sr-engineer.md`、`content/skill-qa-engineer.md` 各一行與 `test/e20-e21-crash-resilience.test.mjs` 的釘點。(2) 退役 Stamp-Provenance——刪 `gates/stamp-provenance.ts`、pipeline 步驟、registry 條目、`stamp-remediation:` 慣例、`content/skill-release-engineer.md` 的提及與 `tools/drift.ts` 的 read 端 advisory（`stampAdvisory` 移除或回 null 由 cut 決定並記錄）。GATE_REGISTRY 36→34、pipeline 19→17 步，文件同步。不預期 handoff schema 升版（qa 確認）。golden 與預算重抓一次。不做：Manifest-tier、Token Budget Brake、`tools/handoff-types.ts`、新流程（E431 起）、E422 的任何檔 | — |
| e422 | E422 | feat/e422-ticket-file-format | ../agent-governance-mcp-lanes/e422 | `docs/ticket-format.md`（新）、`templates/ticket.md`（新）、`tools/ticket-file.ts`（新）、`scripts/check-tickets.mjs`（新）、`tools/config.ts`（只限新增票檔目錄 key 與其預設值）、`docs/config.md`（只限新 key 的說明）、`package.json`（只限 `scripts` 加一行，cut 決定）、`dist/tools/ticket-file.*`、`dist/tools/config.*`、`test/e422-*.test.mjs`（新，qa 定名）、只因新 config key 而紅的既有 config 測試（PM probe 逐檔列出，整合者預審時確認）、`specs/e422-*.md`、`.current/e422/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；e419 擁有的全部（含 `content/**`、golden、預算、`README.md`、`CLAUDE.md`、`CONTRIBUTING.md`、`docs/architecture.md`、`tools/registry.ts`）；`docs/backlog.md`（裁定 1）；`tools/config.ts` 新 key 以外的行為；其他 `tools/**`、`dist/**`；`templates/agent-adapters/**`、`templates/claude-code-agents/**`；`package.json` 的 `version` 與相依 | 做：票檔格式——Markdown，開頭欄位區加 Given/When/Then 情境本文；欄位：id、標題、優先度、相依的票、可改的路徑、是否有情境需裝置或人驗證、狀態（恰為 `not started`／`done`／`stopped`，停止原因寫成 `stopped — <reason>`）、選用的來源欄位（追蹤系統的項目編號與匯入時的修訂版，只寫編號；可空、checker 不因缺少而失敗）。每個情境有 id 與恰一個驗證（自動測試名稱、指令、或 `device-or-person`）。驗證欄可回填（`spec-workshop` 寫 `automated test`，qa 寫完測試後回填「測試檔路徑＋測試標題」，不算改情境）；建置中追加的情境寫在檔尾，標明新增者、日期、理由與驗證——格式文件寫明兩者。禁用欄位名清單至少 `next_role`、`agent_id`、`handoff`、`lane`、`round`、`evidence`、`dispatch`，列在格式文件。parser `tools/ticket-file.ts`、範本、checker `scripts/check-tickets.mjs`（缺欄位、情境無驗證、未知狀態、禁用欄位名 → 非零並點名；合格 → exit 0 並印情境數）。票檔目錄是 `.current/.config.json` 的 key，有預設值。格式文件寫明 backlog 列以路徑指向票檔（裁定 1）。格式文件自足：沒有本工具的讀者只讀範本與一份範例票就懂每個欄位。不做：遷移既有 backlog 列；`.feature` 檔；任何追蹤系統 URL；`content/**`；`CLAUDE.md` 的 layout 段（新檔的 layout 列留給之後的文件更新）；`spec-workshop`（E423）；CI 檢查票上測試（E427）；逐情境驗收紀錄（E424） | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共享生成物**（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部 → e419。e422 不進任何 compose bundle。
- **`CLAUDE.md`、`README.md`、`CONTRIBUTING.md`、`docs/architecture.md`、`tools/**`、`gates/**`** 在 lane-protocol 預設的共同禁止外另行劃出：上表各 lane 擁有欄所列範圍。
- **`CONTRIBUTING.md`、`test/e441-tool-description-contracts.test.mjs`** 不在 E419 票面清單，整合者核對時找到、劃給 e419（移除 gate 模組與 `stampAdvisory` 的必然連動）。
- **打紅規則**：任一 lane 在對方擁有的測試打紅 → 寄信給整合者，不自己改。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `bookkeeping_write` 欄位、orchestrator 分支、registry 條目、錯誤碼移除；migration heal 仍不更新時間戳 | e419（E419） | ✓ |
| E21 crash checkpoint 改一般寫入（延長租約），sr／qa SOP 各一行與 crash-resilience 釘點同步 | e419（E419） | ✓ |
| Stamp-Provenance gate、pipeline 步驟、registry 條目、`stamp-remediation:` 慣例、release SOP 提及移除；`stampAdvisory` 照 cut 決定 | e419（E419） | ✓ |
| GATE_REGISTRY 36→34、pipeline 19→17 步；`README.md`、`CLAUDE.md`、`docs/architecture.md`、`CONTRIBUTING.md` 同步；專屬測試刪除、混合測試保留 kept 部分 | e419（E419） | ✓ |
| 無 handoff schema 升版（qa 確認）；golden 重抓逐 hunk 說明、預算在上限內 | e419（qa） | ✓ |
| 合格票檔：checker exit 0 並印出情境數 | e422（E422） | ✓ |
| 情境沒有驗證：checker 非零並點名情境 id | e422（E422） | ✓ |
| 欄位區用了禁用欄位名：checker 非零並點名欄位；禁用清單（至少七個）列在格式文件 | e422（E422） | ✓ |
| 缺必填欄位、未知狀態：checker 非零；來源欄位缺少不失敗；`stopped — <reason>` 被接受 | e422（E422） | ✓ |
| 格式文件自足、說明每個欄位，含驗證回填、檔尾追加情境、backlog 索引慣例（裁定 1） | e422（E422） | ✓ |
| 票檔目錄 config key 有預設值、typed loader 保留它、`docs/config.md` 有說明 | e422（E422） | ✓ |
| 每條 lane `dist/` 只含自己原始碼的產物、`npm audit --audit-level=high` exit 0 | 全部 lane（qa 核對） | ✓ |
| E419、E422 done-mark（not yet released：裁定 18，與 E435 一起發 v5.0.0）；`check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 每次 merge 後 `node scripts/merge-invariants.mjs`；合併後 `npm run build`、`dist/` 無差異；golden capture 無差異（只有 e419 動 golden）；預算在上限內。
- 記帳：兩列 done-mark（not yet released）；`npm run check:bookkeeping` exit 0。
- 接線票：無。
- 不發版（裁定 18）：從本波合併到 E435 發版之間不從 `main` 發版。

## 合併順序
1. `integ/v5-w1` 自派工 base 開。
2. ← `--no-ff` e419（共享生成物 lane 先）→ merge-invariants。
3. ← `--no-ff` e422 → merge-invariants。
4. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish <lane> --shipped --base integ/v5-w1`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w1`。不發版。

## 結案
- 日期 2026-11-19。`integ/v5-w1` 自 `main` `15474c2`（v4.22.0 發版後）開；← `--no-ff` e419 `1ee184f`（merge `3b32939`）、e422 `fec8353`（merge `7c019aa`），兩次零衝突 → 無合併審查；merge-invariants 兩次 PASS；合併樹 `npm run build` 後 `dist/` 無差異、`capture-constitution-golden.mjs` 無差異、`CLAUDE.md` 250 行、context-budget 與 e395／e436／compose-equivalence／e419／e422 測試 169/169、`npm audit --audit-level=high` exit 0、`agc check` OK（4.22.0）。
- 彙總（上限按 lane 計，全部在上限內、證據與帳本一致）：e419 7 task／hop 4/14／review 0 退回／qa 0；e422 3 task／hop 8/14／review 2 退回（第 3 輪核准）／qa 0。合計 10 task、12 hop。
- 完成定義：表中「同一波 ✓」的列全部成立。
- 記帳：`docs/backlog.md` 兩列 done-mark（not yet released，隨 v5.0.0 發出）；佇列 `docs/v4.0.0-new-tickets.md` 兩列 DONE；`check:bookkeeping` OK。新票：無（兩條 lane 都沒有 pending-tickets）。接線票：無。
- 不開票的觀察（reviewer／qa 的 recommended、optional）：e422——parser 不檢查情境標題形狀與 id 規則（`### S1 - x` 用連字號會通過、id 變成 `S1 - x`；E424 以情境 id 當 key 前宜補上）；`ticketDir` 接受 `.` 與全空白；`tools/config.ts` 的 `isRejectedSisterPath` 名稱已不只用於 sister repo（改名超出本波範圍，未做）；其餘 parser 小項見 lane 報告。e419——`agc check` 註解比例 advisory 7 則（多為既有比例）。流程觀察：`test/e436-stale-handoff-paths.test.mjs` 以固定行號釘 `CLAUDE.md`，任何增減行都會打紅；規劃時未把新 `tools/*.ts` 的 Layout 列劃給 lane，e422 因此兩度 Blocked、人類在 lane 補核准兩次。
- 給 v5.0.0 CHANGELOG 的提示：breaking——`tw_update_state` 移除 `bookkeeping_write` 參數（舊呼叫被忽略、照常延長租約）、移除錯誤碼 `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` 與 `STAMP_PROVENANCE_SUSPECT`、`tw_detect_drift` 回傳移除 `stampAdvisory`；gate registry 34、寫入 pipeline 17 步；context-budget 四個上限調降（6937／8840／18465／2805）。新增——票檔格式 `docs/ticket-format.md`、範本 `templates/ticket.md`、`scripts/check-tickets.mjs`（`npm run check:tickets`）、config key `ticketDir`（預設 `docs/tickets`）。

## Dispatch pins
- e419：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e422：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-19 | 人類 | 本波範圍起於 E422 一張；v5.0.0 里程碑第一張，合進 `main` 不單獨發版（16.1 裁定 18） | integrator prompt「fan-out E422」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 |
| 2026-11-19 | 整合者 | Stage 1 核對（E422）：相依 E418 已 DONE；四個新檔都不存在；不動共享生成物；`templates/ticket.md` 放頂層不影響既有列舉；config 測試以 PM probe 實跑為準 | 本檔 |
| 2026-11-19 | 人類 | 核准 E422 單 lane 清單；裁定 1 = a（lane 不改 `docs/backlog.md`，格式文件寫明 backlog 列以路徑指向票檔，第一筆指向等第一份票檔出現時再寫）；寫進 lane 的 spec，lane 不再問 | 整合者 session |
| 2026-11-19 | 人類 | E419 提前、與 E422 並行（同一波、一個 PR）；合併順序因此為 E422、E419 之後才 E423，修訂 16.1 裁定 17 中 E419 排在 E423 之後的位置；其餘順序不變 | 整合者 session（「fan-out E419」，回應整合者的並行建議 (a)） |
| 2026-11-19 | 整合者 | Stage 1 核對（E419）：與 E422 檔案不相交、`dist/` 各自不同檔；共享生成物全歸 e419；票面清單外新增 `CONTRIBUTING.md` 第 68 行與 `test/e441-tool-description-contracts.test.mjs` 第 46 行，劃給 e419；合併順序 e419 先 | 本檔 |
| 2026-11-19 | 人類 | 核准兩條 lane 的清單（e419 ∥ e422），含本檔所有權重劃與合併順序；寫進各 lane 的 spec，lane 不再問 | 整合者 session（回覆「approve」） |
| 2026-11-19 | 整合者 | 清單 PR #150 merge `c29f100` = 派工 base（CI run 44496507899 綠）；派工前核對在 `c29f100` 重做：既有檔都 tracked、新建檔都不存在、兩條 branch 與 `.current/<lane>/` 與 worktree 都不存在；`npm run build` 後工作樹乾淨、`agc check` OK、audit exit 0；信箱 `_mailbox/{e419,e422}/` 建為空、watch armed baseline 全 0、`lane-status --watch` 已掛；兩份 prompt 由 `fanout.mjs render --base c29f100` 產生 | 整合者 session |
| 2026-11-19 | 人類 | v4.22.0 已過發版驗證卻未發版：選 (a) 先發 v4.22.0，本波 PR 等 tag 存在才開；兩條 lane 與發版同時進行。v4.22.0 由另一個 coordinator session 以 CD workflow 發出（release PR #154、bookkeeping PR #155，`main` `15474c2`） | 整合者 session |
| 2026-11-19 | 整合者 | e422 cut 預審 close（spec `bff6184`，to-integrator#1）：check --cut 10 token、0 越界、每個 AC 有實作 task；D1（`ticketDir`，預設 `docs/tickets`，只在有設時回傳、resolver 套預設）與 E423／E424／E425／E427／E428 相容；D5 拆字比對不誤殺；非阻擋提醒 T-E422-01 約 306 行略超 task_size | 信箱 e422 to-lane#2 |
| 2026-11-19 | 人類 | 在 e422 lane session 核准 cut（D1–D7 照原樣）；lane 採整合者提醒把 config.ts 與 package.json 移到 T-E422-02（D8，task 分配就地改，範圍不變，`bed4bf8`）。只影響 e422、寫在核准的 spec 裡 | e422 lane session；信箱 e422 to-integrator#2 |
| 2026-11-19 | 整合者 | e419 cut 預審 close（spec `ef543dd`，to-integrator#2）：check --cut 31 token、14 OUT 全是測試檔，13 檔在本檔測試面內；改劃 `test/e410-task-alias-content-tail.test.mjs`（釘 const-08 行數，PM probe 找到）→ e419；每個 AC 有實作 task；D1–D6 同意（D6 核對過 `tw_update_state` 頂層 inputSchema 不擋額外參數） | 信箱 e419 to-lane#3 |
| 2026-11-19 | 人類 | 在 e419 lane session 核准 cut（spec `ef543dd`，含 D1 移除 `stampAdvisory` 為 breaking、D4 四個上限調降數字） | e419 lane session；信箱 e419 to-integrator#3 |
| 2026-11-19 | 人類 | 改劃 `CLAUDE.md` 一列給 e422：`tools/config.ts` 列之後新增 `tools/ticket-file.ts` Layout 列（`test/e395-claude-md-tail.test.mjs` AC-E395-5 要求；不放在 AC-E395-4 釘死的 11 列區段）。整合者提，人類在 e422 lane session 核准；`b647540` | e422 lane session；信箱 e422 to-lane#4、#5，to-integrator#5 |
| 2026-11-19 | 人類 | 改劃 `CLAUDE.md` 第二處給 e422：`tools/transitions.ts` 兩行列接成一行（文字不變），讓總行數維持 250，`test/e436-stale-handoff-paths.test.mjs` 的固定行號不移位；e419 已 ack 不增減行數。整合者建議，人類在 e422 lane session 核准；`9f9da82` | e422 lane session；信箱 e422 to-lane#7、#8，to-integrator#7 |
| 2026-11-19 | 整合者 | e419 lane 層驗證 close（to-integrator#8）：HEAD `1ee184f`，10 commits，hop 4/14，review 1 輪核准、qa 0 輪；fanout check 77 檔、14 OUT 全是預審已確認的測試檔；證據 `qa_reports/review_T-E419-01..07.md` PASS（suite-result 4310/4312，`review_T-E419-05.md` covers 七個 id）、`review_reports/review_T-E419-01..04.md` Round 1 APPROVED；ledger 7/7；worktree porcelain 空；無 pending-tickets；整合者 push 後 CI run 44512068943 在 `1ee184f` 綠 | 信箱 e419 to-lane#9 |
| 2026-11-19 | 整合者 | e422 lane 層驗證 close（to-integrator#16）：HEAD `fec8353`，20 commits，hop 8/14，review 3 輪（r1、r2 CHANGES_REQUESTED：格式文件的引號規則；r3 APPROVED）、qa 0 輪；fanout check 29 檔、唯一 OUT 是 `CLAUDE.md`（上兩列人類核准的改劃）；證據 `qa_reports/review_T-E422-01..03.md` PASS（suite-result 4407/4409）、`review_reports/review_T-E422-01..02.md` Round 3 APPROVED；ledger 3/3；content、golden、預算、backlog 未動；無 pending-tickets；整合者 push 後 CI run 44515756265 在 `fec8353` 綠。r2 期間 sr 在 review 報告內寫了標明的回覆段，r3 報告已註明非審查內容 | 信箱 e422 to-lane#15 |
| 2026-11-19 | 整合者 | 合併：`integ/v5-w1` 自 `main` `15474c2` 開，← `--no-ff` e419（merge `3b32939`）、e422（merge `7c019aa`），兩次零衝突 → 無合併審查；merge-invariants 兩次 PASS；合併樹 build 後 `dist/` 無差異、golden capture 無差異、`CLAUDE.md` 250 行、相關測試 169/169、audit exit 0、`agc check` OK（4.22.0） | 本檔 |
| 2026-11-19 | 整合者 | 記帳：`docs/backlog.md` E419、E422 兩列 done-mark（not yet released）；`docs/v4.0.0-new-tickets.md` 佇列兩列 DONE；兩條 lane 無 pending-tickets、不開新票；`check:bookkeeping` OK；彙總 10 task、12 hop、review 2 次退回（e422）、qa 0 | 本檔 |
