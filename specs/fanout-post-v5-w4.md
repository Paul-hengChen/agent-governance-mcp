# Fan-out: post-v5.0.0 第 4 波（E426）
base: 2d6e2be    integration branch: integ/post-v5-w4
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准（人類 2026-11-26），派工中。**

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-26；候選 E426、E428、E443、E420 照佇列順序，整合者提四題，人類答「照建議」）：一條 lane 只做 E426，一次 cut。票面以 `docs/backlog.md` 的 E426 列為準（含 2026-11-17 的重排註記與 2026-11-19 的審查修訂，修訂優先）；佇列 `docs/v4.0.0-new-tickets.md` 第 252 號列。E426 屬 v5.0.0 里程碑，依排定順序在 v5.0.0 之後以 v5.x 發出。本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `2d6e2be`（PR #198 合併後），工作樹乾淨；`feat/e426-*`、`integ/post-v5-w4` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w3.md` exit 0（5 項事實、0 DIFF、3 MOVED，皆為 PR #198 合併所致）。
- `dist/` 實測：`GATE_REGISTRY` 33、`UPDATE_STATE_GATE_PIPELINE` 17 步。
- 本票只改 SOP 與文件，不改 `.ts`：`## Added during build` 段的格式、`Added:` 行的解析與日期檢查已在 `docs/ticket-format.md` 第 126 行起與 `tools/ticket-file.ts`（第 70、75 行）存在，所以 `dist/**` 列為禁止。

### 為什麼只開一條 lane、只做 E426
剩下的 v5.x 票（E426、E428、E443、E420）都改 `content/**`，共用生成物一波只能歸一條 lane；E428 與 E443 另外同改 `content/skill-integrator.md`。E428 的 cut 有一題要人類裁定（回寫的 config key 放哪裡、是否連帶改 `tools/config.ts`），併進來會讓兩張票共用一個 `hop` 上限、一起卡住（人類選 Q1 建議）。E443 的 Phase 0 尚未驗證，且 15.2 裁定 8 把它排在 E428 之後。E420 的前提「至少一個 design-armed feature 在新鏈上結案」未查證——E434 於 2026-11-25 才隨 v5.0.0 發出——本波不列（Q2）。

### 檔案面（在 `2d6e2be` 核對）
- **`content/skill-pm.md`**（119 行）：寫 spec 的規則；第 93 行 Bugfix mode。票面 (1)：有票檔時 spec 引用票檔 scenario，不複製；每個 scenario 都要有驗證方式，`where feasible` 只適用沒有票檔的 spec。`test/context-budget.test.mjs` 第 484 行 skill-pm stripped 上限 ≤ 4942，零餘裕。
- **`content/skill-qa-engineer.md`**（71 行）：第 33 行讀票檔 `## Scenarios`；第 56 行 Ticket verification field 只改驗證行。目前沒有任何 SOP 提到 `## Added during build`（全 `content/` 只有第 37 行一處 scenario 用語相關）——票面 (5)「qa 部分可能已由 E433 做掉」在 `2d6e2be` 核對為**未做**，cut 再確認一次。
- **`content/coord-07-core-sop.md`**（16 行）：第 9 行 mini-chain「backlog row itself as the spec」。票面 (4)：「小票跳過 PM」在 cut 重新推導——server 從空狀態只接受 pm、researcher、design-auditor 進場，mini-chain 也已用 pm 戳記的寫入開場。
- **`content/skill-code-reviewer.md`**（105 行）：第 14 行 *Clean context* 只讀票檔的 `## Scenarios`，沒讀 `## Added during build`——補加的 scenario 審不到；票面 (2)「code-reviewer 以退件提出」也在這份。
- **`content/skill-sr-engineer.md`**（65 行）：第 33 行 4c Return routes、第 52 行 Escalation 列；票面 (2)「sr-engineer 退回 qa-engineer」。現行的「test contradicts a scenario」是否已涵蓋「要補 scenario」由 cut 判斷，需要時才改。
- **`docs/ticket-format.md`**（284 行）：第 126–140 行「Scenarios added during the work」；第 254 行範例寫 `Added: the implementer`，與票面 (2)「只有 pm（cut 時）與 qa-engineer（寫測試時）可以附加」牴觸。這份隨套件發出（spec-workshop 以 `<agc install>/docs/ticket-format.md` 引用）。
- **不動**：`templates/ticket.md`（第 37 行只有空的 `## Added during build` 標題，沒有 who 範例）、`tools/ticket-file.ts`。
- **共用生成物**：`test/fixtures/compose-golden/skill-coordinator-monolith.txt` 含 coord-07 的 Cheapest-Compliant-Path Intake；skill-pm、qa、sr、code-reviewer 不在任何 compose golden 內（以第 9 行與 Bugfix mode、Ticket verification field 字串搜尋）。預算上限至少動 skill-pm 那一條；其他條由 PM probe 列出。

### 讀這些檔文字的測試（literal 搜尋，沒跑）
| 被讀的檔 | 讀它的測試檔數 |
|---|---|
| `content/skill-pm.md` | 28 |
| `content/skill-qa-engineer.md` | 23 |
| `content/skill-sr-engineer.md` | 23 |
| `content/skill-code-reviewer.md` | 18 |
| `docs/ticket-format.md` | 9 |
| `content/coord-07-core-sop.md` | 7 |

本波只有一條 lane，這些讀者測試裡因本 lane 而紅的全歸 e426；完整清單由 PM probe 用完整套件列出。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e426 | E426 | feat/e426-ticket-scenarios-fixed | ../agent-governance-mcp-lanes/e426 | `content/skill-pm.md`、`content/skill-qa-engineer.md`、`content/coord-07-core-sop.md`、`content/skill-code-reviewer.md`、`content/skill-sr-engineer.md`、`docs/ticket-format.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e426-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e426-*.md`、`.current/e426/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`（含 `content/skill-integrator.md`、`content/skill-spec-workshop.md`、`content/coord-01-core-head.md`、`content/coord-03-core-fallback.md`、`content/const-*.md`）；其他 `docs/**`（含 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`）；`specs/fanout-*.md`；`templates/**`；`scripts/**`、`.github/**`；`dist/**` 與所有 `.ts` 原始碼（`tools/**`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E426 審查修訂版 (1) pm 在有票檔時 spec 引用票檔 scenario、不複製；每個 scenario 都有驗證方式，`where feasible` 只留給沒有票檔的 spec；(2) 建置中出現的情況：延伸票或既有程式已決定的行為 → 以 scenario 附加到票檔 `## Added during build`，標明誰、日期、理由與驗證方式；會決定新行為 → 停票；介面細節是 qa 的決定、寫進摘要；只有 pm（cut 時）與 qa-engineer（寫測試時）附加，sr-engineer 退回 qa-engineer，code-reviewer 以退件提出；code-reviewer 的 *Clean context* 也讀 `## Added during build`；(3) 驗收照修訂版：有票檔的 pm spec 引用 scenario 且不含複本；qa 附加的 scenario 帶標記並受逐條核對檢查；沒有票檔時現行規則不變；(4) 「小票跳過 PM」在 cut 依現行 server 進場規則與 mini-chain 形狀重新推導，結論標 needs human ruling；(5) `docs/ticket-format.md` 第 254 行範例的 `Added:` 作者與 (2) 對齊，是否修、怎麼修標 needs human ruling。golden 與預算以本 lane 為準。不做：E428 的 tracker 鏡射、E443 的啟動器與 coord-03 那一行、E420 的視覺錯誤碼；任何 server、gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動；`tools/ticket-file.ts` 與 `templates/ticket.md` | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **`content/skill-code-reviewer.md`、`content/skill-sr-engineer.md`、`docs/ticket-format.md` 加入擁有欄**（票面估計只列 pm、coord-07、qa 三檔）：票面 (2) 點名 sr 退回與 code-reviewer 退件，code-reviewer *Clean context* 目前讀不到 `## Added during build`；`docs/ticket-format.md` 第 254 行範例與票面牴觸（人類 Q3 選 approval = human，由 lane 呈人類決定修不修）。sr SOP 只在 cut 判定現行 return route 不涵蓋時才改。
- **共用生成物整組歸 e426**：本波唯一一條 lane。
- **`dist/**`、`templates/**` 禁止**：本票不改 `.ts`；若 cut 判斷需要改，先送預審。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給 e426，記一列 Decisions（裁決者 `整合者`），不問人類。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **不走 architect**：沒有 gate 或 pipeline 變動。Lanes 表 `approval` = `human`：cut 先經整合者預審收斂，再由 lane 在自己的 session 呈人類核准（含 (4) 跳過 PM、(5) ticket-format 範例兩題）。
- **一個 feature、一次 cut**：寫在一份 `specs/e426-*.md`；cut 先估 hop 數。
- **只有實作完才擷取得到的快照**（golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP 與文件文字寫進 cut 的 Copy / Strings。`content/**` 與 `docs/ticket-format.md` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e426`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| pm SOP：有票檔時 spec 引用 scenario、不複製；每個 scenario 有驗證方式，`where feasible` 只留給沒有票檔的 spec | e426（E426） | ✓ |
| 建置中補加 scenario 的規則：延伸行為附加到 `## Added during build` 並帶標記，新行為停票；只有 pm 與 qa 附加，sr 退回 qa，code-reviewer 退件；code-reviewer 讀得到補加段 | e426（E426） | ✓ |
| 「小票跳過 PM」依現行進場規則重新推導並寫入 coordinator intake（或依人類裁定不寫） | e426（E426） | ✓ |
| `docs/ticket-format.md` 補加 scenario 的範例與規則一致（或依人類裁定不改） | e426（E426） | ✓ |
| golden 與預算重擷取並逐 hunk 說明 | e426 | ✓ |
| 合併後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E426 done-mark（not yet released）；佇列第 252 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 無差異；本 lane 不改 `.ts`，不需重啟 primary 的 MCP server。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w4` 自當時的 `main` 開。
2. ← `--no-ff` e426 → merge-invariants。
3. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e426`（`--shipped --base integ/post-v5-w4`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w4`。不發版。

## Dispatch pins
- e426：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 Q4）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-26 | 人類 | 第 4 波範圍：一條 lane 只做 E426、一次 cut（Q1）；E420 本波不列，等新鏈上結一個 design-armed feature（Q2）；`approval` = `human`（Q3）；pm／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q4） | 整合者 session（integrator prompt「fan-out 下一波」；四題答「照建議」） |
| 2026-11-26 | 整合者 | Stage 1：一條 lane e426，因剩下的 v5.x 票都改 `content/**`、一波只能一條 lane 擁有共用生成物；擁有欄比票面多 `content/skill-code-reviewer.md`、`content/skill-sr-engineer.md`、`docs/ticket-format.md`（理由見所有權重劃）；不走 architect；不改 `.ts`，`dist/**` 與 `templates/**` 禁止；E428、E443、E420 留待後續波次 | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：一條 lane e426（E426）、擁有欄加入 `content/skill-code-reviewer.md`、`content/skill-sr-engineer.md`、`docs/ticket-format.md`、共用生成物歸 e426、`dist/**`、`templates/**` 與 `scripts/**` 禁止、沿用無主紅檔常設規則、`approval` = `human`、四個角色 pin opus，其餘照清單 | 整合者 session（「approve」） |
