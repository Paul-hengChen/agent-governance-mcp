# Fan-out: post-v5.0.0 第 6 波（E446、E447）
base: 991c84f    integration branch: integ/post-v5-w6
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准，派工中（2026-11-26）。**

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-26；候選照佇列順序 E443、E420、E446、E447，整合者提五題，人類答「照建議，Q1–Q5 都同意」）：兩條 lane，e446 做 E446、e447 做 E447，各一次 cut；E443 與 E420 本波不列。票面以 `docs/backlog.md` 的 E446、E447 列為準；佇列 `docs/v4.0.0-new-tickets.md` 第 257、258 號列。兩張票都不屬 v5.0.0 里程碑。本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `991c84f`（PR #202 合併後），工作樹乾淨；`feat/e446-*`、`feat/e447-*`、`integ/post-v5-w6` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的；`agc check` exit 0。primary handoff 停在 `release-cd-v5.0.0-r2`（v5.0.0 已發版）；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w5.md` exit 0（5 項事實、0 DIFF、3 MOVED，皆為 PR #202 合併所致）。
- 相依：E446、E447 都不依賴其他票；E447 排在 v5.0.0 里程碑之後，v5.0.0 已發版。

### 為什麼 E443、E420 不列
- **E443**：`specs/e443-phase0-host-check.md` 的「待觀察」四項（重置後自己接續、subagent 撞到上限、第三次接續之後、可辨識的訊號）仍是原文，repo 內沒有其他用量上限的觀察紀錄；上一波接手步驟寫明四項有結論前 Phase 1 不開 lane。
- **E420**：新鏈上結案的 design-armed feature 仍為 0——唯一有 `design/` 的 adopter 仍是 agc 4.3.0（舊鏈），最後一份設計檔 2026-10-20，2026-11-23 後所有分支無 commit；另一個近期有 commit 的 adopter 是 4.22.0（舊鏈）、沒有 `design/`；本 repo 沒有 `design/`。

### 為什麼兩條 lane、不併
- 兩張票的擁有檔沒有交集；共用生成物只有 e447 會動（`content/skill-doc-writer.md` 不在任何 compose golden 內，`test/context-budget.test.mjs` 沒有它的上限——兩項都 grep 查過）。
- E447 約 12 個檔、要拆 A、B 兩個 sr task、可能走 architect hop；E446 併進去會排在它後面並共用 14 個 hop 上限。分開跑，e446 約 5 個 hop 就能合進來。

### 檔案面（在 `991c84f` 核對）
- **`content/skill-doc-writer.md`**（36 行）：第 15 行 Side-channel constraint（`agent_id` 設成上游角色呼叫 `tw_update_state`），第 36 行 SOP 第 6 步 `tw_update_state(status=In_Progress, agent_id="<upstream-caller>", …)`——即 `(code-reviewer, PASS) → (code-reviewer, In_Progress)`，`tools/transitions.ts` 的 `code-reviewer:PASS` 列只開 pm、researcher、release-engineer、design-auditor 四條邊，沒有這條，也沒有同組 PASS → PASS。人類 Q3 = (a)：doc-writer 收尾不寫 state。
- **`tools/role.ts`** 第 36–40 行註解說 doc-writer 的呼叫者「在它名下呼叫 `tw_update_state`」（引 Side-channel constraint 條款）；(a) 之後這段註解失真，由 e446 一併改（`test/e408-core-task-alias-tail.test.mjs` 釘這五行）。只改註解，`dist/tools/role.*` 重建。
- **`templates/claude-code-agents/doc-writer.md`**：只說照 SOP 走，沒有 state 寫入文字——不動。
- **E447**：`bin/agc-init.mjs`（4416 行，`ARTIFACT_EXCLUDE_RULES`、`agc feature start` 的複製、`finish --shipped` 的 `SHIPPED_EVIDENCE_DIRS`）、`tools/lane-ticket-allocation.ts`（finish 配號，從 base 的物件庫讀 `pending-tickets.md` 與 `docs/backlog.md`）、`tools/lane-paths.ts`、`tools/config.ts`、`tools/fanout-manifest.ts` 與 `scripts/fanout.mjs`（`check --cut`）、`content/const-08-chain-31-mid.md`（11 行，Manifest tier 條件 (2)）、`content/coord-03-core-fallback.md`（103 行，記帳段）、`content/skill-integrator.md`（269 行，R4）、`docs/install.md`、`docs/config.md`、`docs/lane-protocol.md`（170 行）。config key 若要升 config schema，連帶 `schema/versions.ts` 與 `schema/migrations-config.ts`。新增 `tools/*.ts` 要在 `CLAUDE.md` Layout 補一列（`test/e395-claude-md-tail.test.mjs`、`test/e436-stale-handoff-paths.test.mjs` 釘 `CLAUDE.md` 行號）。

### Probe（整合者，literal 與 regex grep `test/`，沒跑；完整清單由各 lane 的 PM 用完整套件列出）
| 被讀的檔 | 讀它的測試檔數 | 歸屬 |
|---|---|---|
| `content/skill-doc-writer.md` | 10 | 見下表 |
| `content/skill-integrator.md` | 28 | e447 |
| `bin/agc-init.mjs` | 38 | e447 |
| `scripts/fanout.mjs`／`tools/fanout-manifest.ts` | 35 | e447 |
| `docs/lane-protocol.md` | 26 | e447 |
| `content/coord-03-core-fallback.md` | 24 | e447（`test/e408-core-task-alias-tail.test.mjs` 除外，見下表） |
| `content/const-08-chain-31-mid.md` | 19 | e447 |
| `tools/config.ts` | 19 | e447 |
| `docs/config.md` | 15 | e447 |
| `docs/install.md` | 5 | e447 |

E447 的讀者測試合計 111 個檔。

讀 `content/skill-doc-writer.md` 或 `tools/role.ts` 的測試，逐檔歸屬：
| 測試檔 | 釘什麼 | e446 改動下會紅？ | 歸屬 |
|---|---|---|---|
| `test/e437-repo-only-paths.test.mjs` | site 9 以「doc-writer is NOT in `ALLOWED_TRANSITIONS`」定位第 15 行 | 會（該句改寫或刪除後找不到錨點） | **e446** |
| `test/e408-core-task-alias-tail.test.mjs` | `tools/role.ts` 第 36–40 行五行註解原文 | 會（註解改寫） | **e446**；e447 不得改 coord-03 被它釘住的四句（Task 別名那四處） |
| `test/render-structure.test.mjs` | doc-writer 的 render glue 數為 0 | 可能（改寫若產生斷行黏接） | **e446** |
| `test/e433-test-first-rules.test.mjs` | AC7 要 doc-writer 有「(code-reviewer, PASS)」（第 28 行保留）；AC13 用索引釘 `docs/lane-protocol.md` 第 37 行 | e446 不會；e447 可能 | e447 |
| `test/e453-served-text-v5.test.mjs` | AC25 每個 `content/*.md` 反引號錯誤碼集合等於 base | e446 不會（cut 限制：不新增、不刪除反引號錯誤碼）；e447 可能（AC21 `docs/config.md`、AC22 `docs/lane-protocol.md`） | e447 |
| `test/e391-prompt-audit-stale-facts.test.mjs` | doc-writer 一句計數；另讀 const-08、coord-03、skill-integrator | e446 不會 | e447 |
| `test/e178a-integrator-role.test.mjs` | doc-writer 只出現在名稱與描述表 | e446 不會 | e447 |
| `test/skill-evolution-v3.11.test.mjs` | doc-writer 五個 `##` 標題 | e446 不會（cut 限制：標題不動） | e447 |
| `test/subagent-templates.test.mjs` | 模板與 SOP 的對照 | 都不會（模板不動） | 無主 |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e446 | E446 | feat/e446-doc-writer-close | ../agent-governance-mcp-lanes/e446 | `content/skill-doc-writer.md`、`tools/role.ts`、`dist/tools/role.js`、`dist/tools/role.js.map`、`dist/tools/role.d.ts`、`dist/tools/role.d.ts.map`、`test/e446-*.test.mjs`（新，qa 定名）、`test/e437-repo-only-paths.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/render-structure.test.mjs`、`specs/e446-*.md`、`.current/e446/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`（含 `content/const-*.md`、`content/coord-*.md`、`content/skill-integrator.md`）；`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；e447 擁有的測試（`test/e433-test-first-rules.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-evolution-v3.11.test.mjs`）；`test/subagent-templates.test.mjs`；`templates/**`；`tools/transitions.ts` 與其他 `.ts` 原始碼（`tools/**` 除 `tools/role.ts`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；其他 `dist/**`；`docs/**`；`specs/fanout-*.md`；`scripts/**`、`.github/**`；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E446 以人類 Q3 (a) 修——doc-writer 在 `(code-reviewer, PASS)` 之後收尾不呼叫 `tw_update_state`，改以 commit 與最後一行回覆交代改了哪些檔；改寫 Side-channel constraint 與 SOP 第 6 步，其餘步驟的 `tw_get_state`／`tw_detect_drift` 前置照舊；`tools/role.ts` 第 36–40 行註解改成與新 SOP 一致；新測試釘住「SOP 不再指示 PASS 之後的 state 寫入」以及「server 仍拒絕 `(code-reviewer, PASS) → (code-reviewer, In_Progress)`」。SOP 不新增、不刪除反引號錯誤碼；`##` 標題不動；不引用只在本 repo 存在的路徑或裸票號。不做：server 改動（`tools/transitions.ts` 不加邊，Q3 否決 (b)）；`templates/**`；其他角色 SOP | 無 | |
| e447 | E447 | feat/e447-local-knowledge-files | ../agent-governance-mcp-lanes/e447 | `bin/agc-init.mjs`、`tools/config.ts`、`tools/lane-ticket-allocation.ts`、`tools/lane-paths.ts`、`tools/fanout-manifest.ts`、`scripts/fanout.mjs`、本 lane 新增的 `tools/*.ts`（cut 定名）與 `CLAUDE.md` 的 Layout 列、`schema/versions.ts` 與 `schema/migrations-config.ts`（只在 cut 判定要升 config schema 時）、上列 `.ts` 對應的 `dist/**` 輸出、`content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`content/skill-integrator.md`、`docs/install.md`、`docs/config.md`、`docs/lane-protocol.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e447-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、`test/e106-init-artifacts-flag.test.mjs`、`test/e239-init-subdir-exclude.test.mjs`、`test/e108-eject.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、`test/e429-lane-config-copy.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/e217-abandoned-specs-harvest.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e335-symlinked-pending-harvest.test.mjs`、`test/e385-worktree-evidence.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/agc-adapters.test.mjs`、`test/e444-claude-local-adapter.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e350-fanout-call-form.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e436-stale-handoff-paths.test.mjs`、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e447-*.md`、`.current/e447/**`、`qa_reports/`、`review_reports/` | e446 擁有的檔（`content/skill-doc-writer.md`、`tools/role.ts`、`dist/tools/role.*`、`test/e437-repo-only-paths.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/render-structure.test.mjs`）；其他 `content/**`；`tools/transitions.ts`、`tools/handoff-orchestrator.ts`、`gates/**`、`prompts/**`；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol-addendum.md` 與其他 `docs/**`；`specs/fanout-*.md`、`specs/e443-*.md`；`templates/**`；`.github/**`；`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E447 票面 Fix (1)–(6) 與驗收 (a)–(f)，人類裁定 R1–R4 照票面——可選的「知識檔也留本機」模式：`agc init` 寫 root-anchored exclude（`specs/`、`design/`、`research/`、`ticketDir`、`docs/backlog.md`，以及 agc 自己建立的 `AGENTS.md`／`.antigravityrules`）到共用 `.git/info/exclude`；`agc feature start` 從 primary 複製並記內容雜湊；`finish --shipped` 只搬回 lane 新寫或改過的檔；配號改讀 worktree 的 `pending-tickets.md`、附加到 primary 未追蹤的 `docs/backlog.md`；`check --cut` 逐 byte 比對 lane 複本與 primary 的 manifest，不同時 exit 非 0 並印 `manifest changed since lane start — re-seed`；三段 SOP 文字（const-08 條件 (2)、coord-03 記帳段、skill-integrator R4）。模式關閉時一切行為與測試不變。flag／config key 名稱與 re-seed 的做法在 cut 決定（approval 欄 `human`）。golden 與預算以本 lane 為準。coord-03 被 `test/e408-core-task-alias-tail.test.mjs` 釘住的四句（Task 別名那四處）不改；`docs/config.md` 的 skill-override caveat 與 `docs/lane-protocol.md` 的 hop-continuation (b) 句若要改，cut 先列出。不做：E446（doc-writer）；E443 的啟動器；E420 的視覺錯誤碼；任何 gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共用生成物整組歸 e447**：`test/fixtures/compose-golden/**` 與 `test/context-budget.test.mjs`。e446 改的 `content/skill-doc-writer.md` 不在任何 golden 內、沒有預算上限。
- **兩條 lane 都會讀的測試逐檔歸一條**（見 Probe 第二表）：`test/e437-repo-only-paths.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/render-structure.test.mjs` 歸 e446；`test/e433-test-first-rules.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-evolution-v3.11.test.mjs` 歸 e447。各 lane 的範圍切線寫明不去動對方釘住的文字。
- **`tools/role.ts` 與 `dist/tools/role.*` 歸 e446**：只改註解（Q3 (a) 之後原註解失真）。
- **`CLAUDE.md` 歸 e447**：只限新 `tools/*.ts` 的 Layout 列；連帶 `test/e395-claude-md-tail.test.mjs`、`test/e436-stale-handoff-paths.test.mjs`。
- **`schema/versions.ts`、`schema/migrations-config.ts` 條件式歸 e447**：只在 cut 判定 config key 要升 config schema 時才動，cut 寫明。
- **`templates/**` 兩條都禁止**：doc-writer 模板沒有 state 寫入文字。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。對 e446：劃歸會改動擁有欄，而 manifest tier 要求 cut 點名的每個檔都在擁有欄——所以整合者已在本表逐檔列出 e446 可能 re-pin 的測試；PM probe 若再找到無主紅檔，e446 改呈人類核准（同第 5 波 e428 的情形）。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **e446**：不走 architect。`approval` 留空（人類 Q4）：整合者 cut 預審回 `close`、cut 沒有選項或 needs human ruling 項目、`check --cut` exit 0 時，照憲法 §3.1 manifest tier 自動核准；否則照常停下呈人類。修法已裁定（人類 Q3 (a)：收尾不寫 state），cut 不再開題。
- **e447**：`approval` = `human`（人類 Q4）：cut 在 lane session 由人類核准；若走 architect，Open Questions 先回整合者第二次預審，再呈人類裁定，然後 sr-engineer 才開工。票面寫明 flag／config key 名稱與 re-seed 做法「在 cut 決定」——寫成 cut 的選項，交人類裁定。cut 估 hop 數（含 architect 與計畫性退回）。
- **一個 feature、一次 cut**：各寫在一份 `specs/e446-*.md`、`specs/e447-*.md`。
- **只有實作完才擷取得到的快照**（golden 與預算上限，僅 e447）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP 與文件文字寫進 cut 的 Copy / Strings。`content/**` 與 `docs/{install,config,lane-protocol}.md` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e446`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內（e447 照票面建議至少拆 A：init + start seed + finish harvest + 配號，B：`check --cut` 比對 + 三段 SOP 文字）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| doc-writer SOP 在 PASS 之後不再指示 server 會拒絕的 state 寫入；`tools/role.ts` 註解一致；有測試釘住 | e446（E446） | ✓ |
| 「知識檔也留本機」模式：init exclude、start 複製與雜湊紀錄、finish 只搬回 lane 寫過的檔、配號寫進 primary 未追蹤的 backlog、`check --cut` 比對 manifest；模式關閉時行為不變（驗收 (a)–(f)） | e447（E447） | ✓ |
| 三段 SOP 文字：const-08 條件 (2) 的 seeded-copy 替代、coord-03 記帳段、skill-integrator R4 | e447（E447） | ✓ |
| `docs/install.md`、`docs/config.md`、`docs/lane-protocol.md` 寫清楚新模式 | e447（E447） | ✓ |
| golden 與預算重擷取並逐 hunk 說明 | e447 | ✓ |
| 合併後 `npm run build` 無多餘 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E446、E447 done-mark（not yet released）；佇列第 257、258 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 只有兩條 lane 擁有的輸出；兩條 lane 都改 `.ts`，merge 後重啟 primary 的 MCP server（補充規則的 post-merge restart）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w6` 自當時的 `main` 開。
2. ← `--no-ff` e447（共用生成物的 lane 先）→ merge-invariants。
3. ← `--no-ff` e446 → merge-invariants。
4. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
5. `finish e447`、`finish e446`（`--shipped --base integ/post-v5-w6`，一次一條）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w6`。不發版。

## Dispatch pins
- e446：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 Q5）。
- e447：`pm=opus`、`architect=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 Q5）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-26 | 人類 | 第 6 波範圍：E446、E447 各一條 lane，不併（Q1、Q2）；E443（Phase 0 第二段無紀錄）與 E420（新鏈上沒有結案的 design-armed feature）本波不列（Q1）；E446 以 (a) 修——doc-writer 在 PASS 之後收尾不寫 state，不在 server 加 `code-reviewer:PASS → code-reviewer:PASS` 邊（Q3）；e446 `approval` 留空走 manifest tier、Stage 1 先 probe 並把可能 re-pin 的測試逐檔寫進擁有欄，e447 `approval` = `human`（Q4）；pm／architect／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q5） | 整合者 session（integrator prompt「fan-out 下一波」；答「照建議，Q1–Q5 都同意，進 Stage 1」） |
| 2026-11-26 | 整合者 | Stage 1：兩條 lane e446、e447；共用生成物整組歸 e447；兩邊都讀的測試逐檔歸屬（e437、e408、render-structure 歸 e446；e433、e453、e391、e178a、skill-evolution-v3.11 歸 e447）；`tools/role.ts` 註解與 `dist/tools/role.*` 歸 e446；`CLAUDE.md` Layout 列與 config schema 檔條件式歸 e447；`templates/**` 兩條都禁止 | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：兩條 lane e446（E446，`approval` 留空走 manifest tier）、e447（E447，`approval` = `human`）；共用生成物整組歸 e447；兩邊都讀的測試逐檔歸屬照 Probe 第二表；`tools/role.ts` 註解與 `dist/tools/role.*` 歸 e446；`CLAUDE.md` Layout 列與 config schema 檔條件式歸 e447；`templates/**` 兩條都禁止；E447 在 lane 內至少拆 A、B 兩個 sr task；沿用無主紅檔常設規則（e446 再出現無主紅檔則改呈人類核准）；pins 全 opus，其餘照清單 | 整合者 session（「approve」） |
