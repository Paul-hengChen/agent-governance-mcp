# Fan-out: post-v5.0.0 第 3 波（E430，加上 E449）
base: ca6dade    integration branch: integ/post-v5-w3
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：規劃中 2026-11-26。**

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-26；整合者提三題，人類答「照建議」）：一條 lane 做 E430 與 E449，一次 cut。票面以 `docs/backlog.md` 的 E430、E449 列為準（E430 含 2026-11-19 的里程碑註記）；佇列 `docs/v4.0.0-new-tickets.md` 第 251、260 號列。E430 屬 v5.0.0 里程碑、依排定順序在 v5.0.0 之後以 v5.x 發出；E449 不屬里程碑，人類 2026-11-24 裁定以 v5.x 發出。本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `ca6dade`（PR #196 合併後），工作樹乾淨；`feat/e430-*`、`integ/post-v5-w3` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- `dist/` 實測：`GATE_REGISTRY` 33、`UPDATE_STATE_GATE_PIPELINE` 17 步。
- 兩張票都不改 `.ts`（E430 票面「prose and docs only」；E449 只改 `content/const-15-core-tail.md`），所以 `dist/**` 列為禁止。

### 為什麼只開一條 lane
剩下的 v5.x 票（E430、E426、E428、E443、E420、E449）都改 `content/**`，共用生成物一波只能歸一條 lane；E443 另外與 E430 同改 `content/skill-integrator.md`、`docs/lane-protocol.md`。E449 若單獨做，只為 golden 就要再開一波，所以併進本 lane（人類 2026-11-26 選 (a)）。

### 檔案面（在 `ca6dade` 核對）
- **E430**：`content/skill-integrator.md`（251 行；Stage 3 第 100 行起只為 lane 建信箱並掛監看；Stage 4 第 125 行「Mailbox unavailable → fall back to the human relaying text」；Take-over 第 233 行起，第 240 行 step 4 的重掛監看是一句話，不是核對項）；`docs/lane-protocol.md`（154 行；§5 信箱第 88 行起，只寫 lane ↔ 整合者，第 91 行「信箱在 `agc feature finish` 拆除 lane 時才會刪除」——非 lane session 沒有 finish）。票面「Out of scope unless the cut decides otherwise」：fan-out 工具的非 lane prompt 範本、任何 server 或 gate 變動——本清單不劃 `scripts/**`、`tools/**`，cut 若要做需先送預審、由人類裁定是否擴範圍。
- **E449**：`content/const-15-core-tail.md`（55 行；§7 在第 37 行，*Read before write* 第 42 行、*Fail loud* 第 43 行）。`prompts/constitution-manifest.ts` 第 33 行把它標為 `core`，所以每個派工模式都會帶到。
- **共用生成物**：11 個 compose golden 含 §7 *Fail loud*（`build-{full,lite}-{design,nondesign}{,-fd}.txt`、`constitution-monolith.txt`、`hook-full.txt`、`hook-lite.txt`），E449 會全部動到；integrator SOP 不在任何 compose golden 內。`test/context-budget.test.mjs` 的 lite 憲法上限目前零餘裕（第 204 行註解：measured 6003）。

### 讀這些檔文字的測試（literal 搜尋，沒跑）
| 被讀的檔 | 讀它的測試檔數 |
|---|---|
| `content/skill-integrator.md` | 38 |
| `docs/lane-protocol.md` | 42 |
| `content/const-15-core-tail.md` | 12 |

本波只有一條 lane，這些讀者測試裡因本 lane 而紅的全歸 e430；完整清單由 PM probe 用完整套件列出。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e430 | E430、E449 | feat/e430-mailbox-and-verify-rule | ../agent-governance-mcp-lanes/e430 | `content/skill-integrator.md`、`docs/lane-protocol.md`、`content/const-15-core-tail.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e430-*.test.mjs`（新，qa 定名）、`test/e449-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e430-*.md`、`.current/e430/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`；其他 `docs/**`（含 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol-addendum.md`）；`specs/fanout-*.md`；`scripts/**`、`.github/**`；`dist/**` 與所有 `.ts` 原始碼（`tools/**`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E430 (1) integrator SOP——WHEN 整合者把 prompt 交給任何會回報給它的 session（lane 或非 lane，例如實機驗收、對照實驗）→ DO 交出 prompt 前建該 session 的信箱對並加入監看 → ELSE（信箱不可用）由人類轉達，並在 Decisions 表記一列；(2) `docs/lane-protocol.md` §5 寫明哪些信箱規則適用於非 lane session（訊息是資料、永不傳核准；回報格式），以及沒有 `agc feature finish` 時誰刪它的信箱；(3) Take-over 的重掛信箱監看改成核對項，不再只是一句話；cut 註記：同一帳號下宿主的 session 清單與直接傳訊可達同機器的其他 session，檔案信箱仍是可攜的機制。E449：`content/const-15-core-tail.md` §7 加一條「先查證再斷言」——說明工具、指令、腳本或流程怎麼運作，或把指令寫進計畫與完成定義，要以讀過的檔或跑過的指令為據，否則標明未查證；每個派工模式組出的憲法裡 §7 下恰好出現一次；通過 content 全域的用字與引用 pin（無 repo 專屬路徑、無裸票號、不重述數值上限）。最終用字、以及要不要有角色 SOP 指向這條，cut 標 needs human ruling。golden 與預算以本 lane 為準。不做：fan-out 工具的非 lane prompt 範本；任何 server、gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動；E443 的啟動器與 `content/coord-03-core-fallback.md` 那一行；E426、E428 的 SOP 文字 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **E449 併進 e430（人類 2026-11-26 選 (a)）**：`content/**` 一波只能歸一條 lane；E449 的佇列備註「與其他 content 票撞共用生成物，不能同波」指的是分兩條 lane 同波，同一條 lane 不受影響。兩張票共用一個 feature 的 `hop` 上限。
- **共用生成物整組歸 e430**：本波唯一一條 lane。
- **`dist/**` 禁止**：本 lane 不改 `.ts`；若 cut 判斷需要改，先送預審。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給 e430，記一列 Decisions（裁決者 `整合者`），不問人類。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **不走 architect**：沒有 gate 或 pipeline 變動。Lanes 表 `approval` = `human`：本 lane 改憲法 §7 與 integrator 自己的規則，cut 先經整合者預審收斂，再由 lane 在自己的 session 呈人類核准（含 E449 用字、是否加 SOP 指標兩題）。
- **一個 feature、一次 cut**：E430 與 E449 寫在同一份 `specs/e430-*.md`，task id 分票標明；兩張票共用 `hop` 上限，cut 先估 hop 數。
- **只有實作完才擷取得到的快照**（golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP、協定與憲法文字寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e430`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator SOP：交 prompt 給任何會回報的 session 前先建信箱對並加入監看；信箱不可用時人類轉達並記 Decisions 列 | e430（E430） | ✓ |
| `docs/lane-protocol.md` §5：非 lane session 適用的信箱規則與其信箱由誰刪除 | e430（E430） | ✓ |
| Take-over 的重掛信箱監看是核對項 | e430（E430） | ✓ |
| 每個派工模式組出的憲法 §7 下恰好一條「先查證再斷言」，通過 content 用字與引用 pin | e430（E449） | ✓ |
| golden 與預算重擷取並逐 hunk 說明 | e430 | ✓ |
| 合併後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E430、E449 done-mark（not yet released）；佇列第 251、260 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 無差異；本 lane 不改 `.ts`，不需重啟 primary 的 MCP server。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w3` 自當時的 `main` 開。
2. ← `--no-ff` e430 → merge-invariants。
3. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e430`（`--shipped --base integ/post-v5-w3`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w3`。不發版。

## Dispatch pins
- e430：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 核准）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-26 | 人類 | 第 3 波範圍：一條 lane 做 E430 與 E449、一次 cut（Q1 (a)）；`approval` = `human`（Q2）；pm／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q3） | 整合者 session（integrator prompt「fan-out 下一波」；三題答「照建議」） |
| 2026-11-26 | 整合者 | Stage 1：一條 lane e430（E430 + E449），因剩下的 v5.x 票都改 `content/**`、一波只能一條 lane 擁有共用生成物；不走 architect；不改 `.ts`，`dist/**` 禁止；E443、E426、E428、E420 留待後續波次（E420 另需設計稿 adopter 在新流程結案一個 feature） | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：一條 lane e430（E430 + E449）、E449 併入、共用生成物歸 e430、`dist/**` 與 `scripts/**` 禁止、沿用無主紅檔常設規則、`approval` = `human`、四個角色 pin opus，其餘照清單 | 整合者 session（「核准」） |
