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
| 2026-11-26 | 整合者 | 清單 PR #201 合進 `main`（merge `32e7f7e`，CI run 45776323401 綠），派工 base = `32e7f7e`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e428-*` 與 `integ/post-v5-w5` 都不存在、擁有欄點名的既有路徑與 prompt 引用的閱讀路徑都在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e428/`、開信箱監看（baseline 0）與 lane-status 監看、render prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-26 | 整合者 | 非 lane session `p0host`（E443 Phase 0 第一段）：信箱 `../agent-governance-mcp-lanes/_mailbox/p0host/`，與 e428 同一個信箱監看（baseline 0）；prompt 由整合者手寫，指向 `docs/lane-protocol.md` §5「非 lane 的 session」 | 本檔 |
| 2026-11-26 | 整合者 | p0host 收工回報（to-integrator#1）`close`（to-lane#1）：E443 Phase 0 第一段 1–5 項完成，方案 A 第一段可行，前提兩項（啟動目錄在已信任資料夾底下；slash 指令不放命令列初始 prompt，就緒後以 terminal 的送字功能送出）；未驗證：全新機器的 bypass 確認畫面、lane worktree 的信任判定、跑到一半直接關窗；用量上限四項待觀察。未改任何 repo 檔案（primary 只有本清單未 commit）。紀錄全文於記帳時寫入 `specs/e443-phase0-host-check.md`。新發現（原始碼核對屬實）：`scripts/mailbox-watch.mjs` 的 `--send` 只有 `--from integrator` 寫 `hop: —`，非 lane session 帶 `--hop —` 被拒、不帶則讀主 repo handoff 的 hop 數，與 `docs/lane-protocol.md` §5 的非 lane session 規則不符。第 3 波（`specs/fanout-post-v5-w3.md` Decisions，e430 收工核對）已就同一點決定列波次報告、不開票（協定訊息可手寫）；本次 p0host 正是手寫成功，維持該決定，列本波報告，人類要求才開票。p0host 已移出信箱監看 | p0host 信箱 to-integrator#1、to-lane#1 |
| 2026-11-26 | 整合者 | e428 cut 預審（to-integrator#2，spec @ `23e5e6d`）`close`（to-lane#1）：範圍、檔案界線、完成定義對照相符，AC1–AC13 每條有實作 task；Copy 無 URL、repo-only 路徑、廠商名，只用既有範例 id；四項 cut decisions 在清單範圍內（對照檔 `agc-tracker-map.md` 放 `git rev-parse --git-common-dir`，有 `docs/install.md` hygiene 關鍵字清單的先例；revision 比對在 coord-01）。清單不在 lane branch 上中途修改（憲法 §3.1 要新的人類 Decisions 列並 merge 進 lane），所以 `check --cut` 因下列四檔 exit 1、manifest tier 不成立，lane 照 `docs/lane-protocol.md` §5 呈人類核准 | e428 信箱 to-integrator#2、to-lane#1 |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/e445-spec-workshop-questioning.test.mjs`（AC10 凍結 `BASE_SOP`）、`test/e462-stale-comments-wording.test.mjs`（AC6 凍結 `FROZEN_SW_SOP`）、`test/e410-task-alias-content-tail.test.mjs`（AC2 釘 `content/skill-integrator.md` 第 260 行與行數 261）、`test/e430-mailbox-outside-lane.test.mjs`（AC8 釘行數 260）劃給 e428——四檔在 base `32e7f7e` 上 53/53 綠；lane 的 Copy 尚未 commit，紅的一側由整合者讀 pin 內容核對（C-SW1、C-SW2、C-IN1 會改動被凍結的文字與行號）並採 PM probe 的全套結果；qa 在 T-E428-01 只做 re-pin | e428 信箱 to-integrator#2；整合者在 base 跑四檔 |
| 2026-11-26 | 人類 | 在 e428 的 session 核准 cut（spec @ `23e5e6d`），manifest tier 未使用（`check --cut` 因四個已劃歸的測試檔 exit 1）；cut 沒有需要人類裁定的選項 | e428 lane session；`.current/e428/handoff.md`（`cut_approved: true`）；e428 信箱 to-integrator#3 |
| 2026-11-26 | 整合者 | p0host 補測（人類轉達；p0host 信箱已在 close 後刪除，故由人類轉貼）：lane worktree 的信任判定已實測——主 repo 有明確信任項目時 lane worktree 不跳信任畫面；主 repo 的信任只從上層資料夾繼承時，worktree 會跳。原「未驗證」改為已實測，寫入 `specs/e443-phase0-host-check.md` 第 3 項；對啟動器的前提（主 repo 在根目錄被明確信任過）列為前置檢查。補測只在 e428 worktree 啟動後立即 `/exit`，未送 prompt、未呼叫工具，不影響該 lane | 人類轉達的 p0host 補充 |
| 2026-11-26 | 整合者 | e428 code-reviewer round 1 CHANGES_REQUESTED → pm（`review_reports/review_T-E428-01.md` @ lane，HEAD `697bef8`）：F1 required——已核准的 Copy 在私有 repo 讓 `write-back: on` 無效（source item 只在票檔 `source` 欄、不在對照檔，而 C-IN1「No row, no write」），整合者 cut 預審也漏看了這一點。整合者建議（to-lane#2，非核准）採 reviewer 選項 (a)：只改 C-IN1、讓整合者也認票檔 `source` 欄，行數不變，免去計畫性退回（預估到 hop 10）；(b) 改 C-TF1／C-SW2 預估到 hop 12。選項由 lane 呈人類裁定 | e428 信箱 to-lane#2；lane `review_reports/review_T-E428-01.md` |
| 2026-11-26 | 整合者 | e428 修訂 cut 預審（to-integrator#9 reopen、#10，spec @ `dede8b2`）`close`（to-lane#3）：F1 以 (a) 修——C-IN1 在原有行內改寫、認票檔 `source` 欄，檔案行數 269 不變，golden、預算上限、行號 pin 都不動；reviewer nit 只修 C-TF1 bullet 2（原三行內），C-SW2 同句列收工報告；新增 T-E428-06（qa）、T-E428-07（sr），檔案都在擁有欄；預估 hop 10–11。選項題，由 lane 呈人類裁定並核准 | e428 信箱 to-integrator#9、#10、to-lane#3 |
| 2026-11-26 | 人類 | 在 e428 的 session 核准修訂 cut（spec @ `dede8b2`）並選 (a)（「approve (a)」）：整合者也認票檔 `source` 欄；只影響本 lane 的交付內容，spec 本身即照 (a) 撰寫 | e428 lane session；`specs/e428-tracker-mirror.md`「Amendment after review round 1」段 @ `dede8b2`、`.current/e428/handoff.md`（`cut_approved: true`）；e428 信箱 to-integrator#11 |
| 2026-11-26 | 整合者 | e428 收工報告（to-integrator#14，HEAD `16d9be7`）驗證通過、`close`（to-lane#4）：14 commits、乾淨樹；`check` 越界只有已劃歸的 e410、e430、e445、e462；證據 7/7（`review_reports/review_T-E428-01.md` Round 2 APPROVED、covers T-E428-01..07；`qa_reports/review_T-E428-01..07.md`）；無新發現；無 `.ts`／`dist/`／`scripts/`／`templates/` 變動；lane 層 CI run 45795128772 @ `16d9be7` 綠；review 退回 1（F1，情境缺陷，人類選 (a) 後修正）、hop 10/14。波次報告不開票的意見：(O) C-SW2 與 C-TF1 對照檔 bullet 的「under that/its source item」在 `source` 有多個 item 時仍有歧義（改會動 spec-workshop 預算上限與凍結文字）；(O) C-TF1 bullet 6 沒說開 `write-back` 是否算鏡射要求（C-IN1 已講清開關規則）；(A) `agc check` 註解 advisory：`test/e428-tracker-mirror.test.mjs` 開頭與 `test/e410-task-alias-content-tail.test.mjs` 第 45 行的區塊 9 行，超過本 lane spec 自訂的 7 行——不退回（約 3 hop，exit 0）；(O) `test/context-budget.test.mjs` 註解比例 advisory（lane 前即偏高） | e428 信箱 to-integrator#14、to-lane#4 |
| 2026-11-26 | 整合者 | 整合：`integ/post-v5-w5` 自 `main` @ `32e7f7e` 開出，`--no-ff` 合 e428（merge `4e12d01`），零衝突、無實質解衝突，merge-invariants PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17；E428 done-mark（`docs/backlog.md`、佇列第 254 號列），`check:bookkeeping` exit 0；E443 Phase 0 第一段紀錄寫入 `specs/e443-phase0-host-check.md`。Roll-up：e428 7 個 task、hop 10/14、review 退回 1（PM 重入後 `review_round` 歸零）、證據 7/7 | 本清單；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/e443-phase0-host-check.md` |
