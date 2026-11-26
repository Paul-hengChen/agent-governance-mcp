# Fan-out: post-v5.0.0 第 5 波（E428）
base: 11a35b2    integration branch: integ/post-v5-w5
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准（2026-11-26），派工中。**

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-26；候選 E428、E443、E420 照佇列順序，整合者提五題，人類答「照建議，這波做 E428」）：一條 lane 只做 E428，一次 cut；E443 的 Phase 0 由一個非 lane 的 session 同時進行；E420 不列。票面以 `docs/backlog.md` 的 E428 列為準（含 2026-11-18 的補充與 2026-11-19 的審查修訂，修訂優先）；佇列 `docs/v4.0.0-new-tickets.md` 第 254 號列。E428 屬 v5.0.0 里程碑，依排定順序在 v5.0.0 之後以 v5.x 發出。本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `11a35b2`（PR #200 合併後），工作樹乾淨；`feat/e428-*`、`integ/post-v5-w5` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w4.md` exit 0（5 項事實、0 DIFF、3 MOVED，皆為 PR #200 合併所致）。
- 相依：E422（`7c019aa`）、E423（`3f2d1e7`）、E425（`9a13186`）都已 done-mark 並在 `main` 上。

### 為什麼只開一條 lane、只做 E428
E428 與 E443 同改 `content/skill-integrator.md`、compose golden 與 `test/context-budget.test.mjs`，共用生成物一波只能歸一條 lane；15.2 裁定 8 把 E443 排在 E428 之後（人類 Q1）。E443 的 Phase 0 只確認到 CLI 能力層（互動模式帶入 prompt、`--permission-mode`、`osascript` 與 iTerm／Terminal 都在、tmux 未安裝），用量上限四項未驗證；Phase 0 若失敗票即以不可建置結案，所以 Phase 1 不開 lane（人類 Q2 (a)）。E420 的前提不成立：設計來源 adopter 仍是 agc 4.3.0（舊鏈），最後一份設計檔 2026-10-19，2026-11-23 後所有分支無 commit；另一個 adopter 沒有 `design/`；本 repo 沒有 `design/`——新鏈上結案的 design-armed feature 為 0。

### 檔案面（在 `11a35b2` 核對）
- **`content/skill-spec-workshop.md`**（40 行）：第 8、15、17 行已收 tracker item 為輸入；第 26 行 Short form；第 31 行 Outputs 的 ticket file 規則（一張票檔最多對一個 tracker item、`source` 只記編號、公開 repo 留空）。票面：人類要求時每張票檔建一個 tracker item；匯入的票不建第二個；子項目只在要求時建。`test/context-budget.test.mjs` 第 505–518 行 AC21 上限 ≤ 1415，零餘裕。
- **`content/skill-integrator.md`**（260 行）：第 120 行 Batch lane、第 184 行 stopped batch lane。票面：整合者隨票移動更新 tracker item 的狀態、停票理由與 PR 參照；停票的問題**起草給人類**、不張貼。本 SOP 不在任何 compose golden 內，`test/context-budget.test.mjs` 沒有它的上限；有 SOP 文字釘的測試由 PM probe 列出。
- **`content/coord-01-core-head.md`**（85 行）：第 78 行「tracker 編號沒有票檔 → 先跑 spec-workshop」。票面修訂 (5)：lane 的 coordinator 在開工時把 tracker 編號解析到票檔、照票檔做，與 tracker 內容不同時回報差異；驗收前（code-reviewer PASS 之前）比對來源 revision。這是票面要加的「`content/coord-*.md` 解析 tracker 編號的 fragment」。在 `test/fixtures/compose-golden/skill-coordinator-monolith.txt` 內。
- **`docs/ticket-format.md`**（292 行）：第 50 行 `source` 欄（`<item number> rev <revision>`、只記編號、公開 repo 留空）；第 60–67 行 `stopped — <reason>` 與兩種固定寫法。票面的記錄規則與本機對照檔寫在這裡。隨套件發出。
- **人類 Q3 = (B)**：回寫開關放在既有的 untracked 本機對照檔（公開 repo 本來就把 tracker 編號放那裡），不加 `.current/.config.json` key、不改 `tools/config.ts`——E428 維持純 SOP。對照檔的路徑與格式由 cut 定，必須 untracked。
- **不動**：`templates/ticket.md`（第 20 行 `source` 已在）、`tools/ticket-file.ts`、`tools/config.ts`、`docs/config.md`、`docs/lane-protocol.md`（E443 下一波會改）。
- **共用生成物**：`test/fixtures/compose-golden/skill-coordinator-monolith.txt` 含 coord-01；spec-workshop 與 integrator 不在任何 compose golden 內。預算上限至少動 spec-workshop 那一條；其他條由 PM probe 列出。

### 讀這些檔文字的測試（literal 搜尋檔名，沒跑）
| 被讀的檔 | 讀它的測試檔數 |
|---|---|
| `content/skill-integrator.md` | 27 |
| `docs/ticket-format.md` | 10 |
| `content/coord-01-core-head.md` | 8 |
| `content/skill-spec-workshop.md` | 6 |

本波只有一條 lane，這些讀者測試裡因本 lane 而紅的全歸 e428；完整清單由 PM probe 用完整套件列出。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e428 | E428 | feat/e428-tracker-mirror | ../agent-governance-mcp-lanes/e428 | `content/skill-spec-workshop.md`、`content/skill-integrator.md`、`content/coord-01-core-head.md`、`docs/ticket-format.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e428-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e428-*.md`、`.current/e428/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`（含 `content/coord-02..07-*.md`、`content/skill-code-reviewer.md`、`content/skill-pm.md`、`content/const-*.md`）；其他 `docs/**`（含 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/config.md`）；`specs/fanout-*.md`、`specs/e443-*.md`；`templates/**`；`scripts/**`、`.github/**`；`dist/**` 與所有 `.ts` 原始碼（`tools/**`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E428 審查修訂版——人類要求時 spec-workshop 用 host 自己的 tracker 工具每張票檔建一個 tracker item，整合者隨票移動更新狀態、停票理由與 PR 參照；方向固定 repo → tracker，tracker 上的內容不讀回、不一致以 repo 為準；人類可用 tracker 編號開工，lane 的 coordinator 解析到票檔照票檔做並回報差異；驗收前（code-reviewer PASS 之前）比對來源 revision、有變只回報；停票的問題起草給人類、不張貼（鏡射與匯入的 item 都一樣）；「no tracker call」讀作「no tracker write」（讀取匯入 item 與比對 revision 照常）；一張票檔最多一個「鏡射建立」的 item（不含切票來源 item）；匯入的票不建第二個 item，子項目只在要求時建；回寫到來源 item 預設關、逐 workspace 開，開關放在 untracked 本機對照檔（人類 Q3 (B)）；記錄規則：票檔只記編號、不記網址，公開 repo 連編號都不記、放對照檔；沒要求就不鏡射；以工具能力（建 item、更新狀態、加留言）撰寫，不寫廠商名。golden 與預算以本 lane 為準。不做：`.current/.config.json` key 與 `tools/config.ts`（Q3 (B)）；E443 的啟動器與 coord-03 那一行；E420 的視覺錯誤碼；任何 server、gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動；`tools/ticket-file.ts` 與 `templates/ticket.md` | 無 | |

## 非 lane 的 session
| session | 做什麼 | 信箱 | 產出 |
|---|---|---|---|
| p0host | E443 Phase 0 第一段（coordinator 直接做）：在本機用 `osascript` 開看得到的 terminal 視窗，在一個 repo 以外的暫存目錄啟動互動 session、帶入初始 prompt，確認 (1) 不用人就能啟動並直接進入 coordinator 流程，(2) 不被權限提示卡住，(3) 一條 lane 一個視窗可行（至少兩個視窗）；記錄 CLI 版本、用的指令與結果。用量上限四項（重置後自己接續、subagent 撞到上限、第三次接續之後、可辨識的訊號）列為待觀察，第二段在本波 lane 自然撞到上限時由人類回報、整合者補記。不碰任何 repo、不建 worktree、不寫 governance 狀態 | `../agent-governance-mcp-lanes/_mailbox/p0host/` | `specs/e443-phase0-host-check.md` 的內容（以 `type: report` 交給整合者，由整合者在 `integ/post-v5-w5` commit；不寫絕對路徑） |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **`content/coord-01-core-head.md` 是票面「解析 tracker 編號的 `content/coord-*.md` fragment」**：第 78 行已處理「tracker 編號沒有票檔」，有票檔的解析放在同一處。若 cut 判斷驗收前的 revision 比對要放在別的檔（例如 `content/skill-code-reviewer.md` 或 `content/coord-07-core-sop.md`），先送預審再劃給 e428。
- **`tools/config.ts`、`docs/config.md` 禁止**：人類 Q3 (B)，回寫開關不進 config。
- **共用生成物整組歸 e428**：本波唯一一條 lane。
- **`dist/**`、`templates/**`、`docs/lane-protocol.md` 禁止**：本票不改 `.ts`；`docs/lane-protocol.md` 留給下一波的 E443。若 cut 判斷需要改，先送預審。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給 e428，記一列 Decisions（裁決者 `整合者`），不問人類。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **不走 architect**：沒有 gate 或 pipeline 變動。Lanes 表 `approval` 留空（人類 Q4）：整合者 cut 預審回 `close`、cut 沒有 needs human ruling 項目時，照憲法 §3.1 manifest tier 自動核准；cut 若出現選項或 needs human ruling，照常停下呈人類。
- **已裁定、cut 不再開題**：回寫開關放在 untracked 本機對照檔、不加 config key（人類 Q3 (B)）。對照檔的路徑與格式是 cut 的實作決定，寫進 Copy / Strings。
- **一個 feature、一次 cut**：寫在一份 `specs/e428-*.md`；cut 先估 hop 數。
- **只有實作完才擷取得到的快照**（golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP 與文件文字寫進 cut 的 Copy / Strings。`content/**` 與 `docs/ticket-format.md` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號，不寫 tracker 廠商名、網址或內部專案名。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e428`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| spec-workshop：人類要求時每張票檔建一個 tracker item，記錄規則照票面；匯入的票不建第二個、子項目只在要求時建；沒要求不寫 tracker | e428（E428） | ✓ |
| integrator：隨票移動更新 tracker item 的狀態、停票理由、PR 參照；停票問題起草給人類、不張貼；回寫來源 item 預設關、照本機對照檔開關 | e428（E428） | ✓ |
| coordinator：tracker 編號解析到票檔、照票檔做並回報差異；驗收前比對來源 revision、有變只回報 | e428（E428） | ✓ |
| `docs/ticket-format.md`：記錄規則與 untracked 本機對照檔（含回寫開關）寫清楚 | e428（E428） | ✓ |
| golden 與預算重擷取並逐 hunk 說明 | e428 | ✓ |
| E443 Phase 0 第一段結果寫進 `specs/e443-phase0-host-check.md`；用量上限四項列為待觀察 | p0host session（整合者 commit） | ✓ |
| 合併後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E428 done-mark（not yet released）；佇列第 254 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 無差異；本 lane 不改 `.ts`，不需重啟 primary 的 MCP server。
- 記帳：見完成定義；`specs/e443-phase0-host-check.md` 隨記帳 commit；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w5` 自當時的 `main` 開。
2. ← `--no-ff` e428 → merge-invariants。
3. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit（含 Phase 0 紀錄）。
4. `finish e428`（`--shipped --base integ/post-v5-w5`）；刪 p0host 信箱；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w5`。不發版。

## Dispatch pins
- e428：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 Q5）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-26 | 人類 | 第 5 波範圍：一條 lane 只做 E428、一次 cut；E443 Phase 1 與 E420 本波不列（Q1）；E443 Phase 0 分兩段，第一段由非 lane 的 session 現在跑、用量上限四項趁本波 lane 自然撞到上限時觀察（Q2 (a)）；E428 回寫開關放 untracked 本機對照檔、不加 config key、不改 `tools/config.ts`（Q3 (B)）；`approval` 留空、走 manifest tier（Q4）；pm／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q5） | 整合者 session（integrator prompt「fan-out 下一波」；答「照建議，這波做 E428」） |
| 2026-11-26 | 整合者 | Stage 1：一條 lane e428；票面「解析 tracker 編號的 coord fragment」定為 `content/coord-01-core-head.md`（第 78 行已處理沒有票檔的情況）；`tools/config.ts`、`docs/config.md`、`docs/lane-protocol.md`、`templates/**`、`dist/**` 禁止；非 lane session p0host 負責 E443 Phase 0 第一段；E420 前提查證不成立（新鏈上結案的 design-armed feature 為 0） | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：一條 lane e428（E428）、擁有欄 `content/skill-spec-workshop.md`、`content/skill-integrator.md`、`content/coord-01-core-head.md`、`docs/ticket-format.md` 與共用生成物、coord fragment 定為 coord-01、`tools/config.ts`、`docs/config.md`、`docs/lane-protocol.md`、`templates/**`、`dist/**` 禁止、沿用無主紅檔常設規則、`approval` 留空、四個角色 pin opus、非 lane session p0host 跑 E443 Phase 0 第一段，其餘照清單 | 整合者 session（「approve」） |
