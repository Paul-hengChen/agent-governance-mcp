# Fan-out: post-v5.0.0 第 6 波（E446、E447）
base: 991c84f    integration branch: integ/post-v5-w6
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-27。** e447 與 e446 依序 `--no-ff` 合進 `integ/post-v5-w6`（merge `9393830`、`8106e92`，皆零衝突），merge-invariants 兩次 PASS；派工 base `07a6d47`（清單 PR #203），開整合分支時 `main` 已前進到 `842c874`（PR #204，關 E177c，與兩條 lane 無交集）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、`check:bookkeeping` exit 0。lane 層 CI：e446 run 45810071302 @ `71c57f1`、e447 run 45932710279 @ `4dcbbec`，皆綠。Roll-up：e446 3 個 task、hop 4/14、review 退回 0、證據 3/3；e447 10 個 task、hop 10/14、review 退回 1、證據 10/10。E446、E447 done-mark；E443 Phase 0 第二段（人類裁定 (a)）寫入 `specs/e443-phase0-host-check.md`。例外：e447 sr 用了一次 `git commit --amend`（未 push、已記）；e447 收工時一份證據檔含暫存目錄絕對路徑，CI 紅後以新 commit 修正。本波以一個 PR 合進 `main`，不發版。

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
| `specs/e443-phase0-host-check.md` 的 Phase 0 第二段（人類裁定 (a)）隨記帳 commit 進 `integ/post-v5-w6` | 整合者（5c） | ✓ |
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
| 2026-11-26 | 整合者 | 清單 PR #203 合進 `main`（merge `07a6d47`，CI run 45798870973 綠），派工 base = `07a6d47`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e446-*`、`feat/e447-*` 與 `integ/post-v5-w6` 都不存在、擁有欄點名的既有路徑都在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e446/`、`_mailbox/e447/`，開信箱監看（baseline e446=0、e447=0）與 lane-status 監看，render 兩份 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-26 | 整合者 | e447 to-integrator#1（轉述人類在 lane session 打字，請記帳時 commit `specs/e443-phase0-host-check.md` 並補人類 Decisions 列）回 to-lane#1：影響 E443 而非 e447，須在整合者 session 確認；隨即 to-integrator#2 撤回（人類表示貼錯 session），to-lane#2 `close`，未據此做任何事 | e447 信箱 to-integrator#1、#2，to-lane#1、#2 |
| 2026-11-26 | 人類 | E443 Phase 0 第二段改採裁定 (a)：以 Claude Code 官方文件作為用量上限四項的結論（取代第 5 波 Q2 (a)「等真的 lane 撞到上限時回報」）；補驗只剩一項——撞到上限、主 session 接續之後，是否照崩潰恢復流程重派中斷的 subagent；Phase 1 的 cut 要處理的五項列在 `specs/e443-phase0-host-check.md` 的「結論」段。primary 上該檔的未 commit 改動（「## 第二段」段）於第 6 波記帳時一併 commit 進 `integ/post-v5-w6` | 整合者 session（人類親手打字） |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/lane-paths.test.mjs`（REG1 釘 `LANE_FILES` 恰 8 條，e447 新增 `knowledgeSeed` 變 9）、`test/e410-task-alias-content-tail.test.mjs`（釘 `content/const-08-chain-31-mid.md` 行數 12 與列位置，e447 新增一行）劃給 e447——兩檔在 base 上 66/66 綠，紅的一側由 pin 內容核對；e446 不讀這兩檔。e447 cut 預審（to-integrator#4，spec @ `ac29038`）回 reply（to-lane#4）：T-E447-04 共 7 檔超過 `task_size`，請拆兩個 sr task；T-E447-03 補行數估算，超過 300 行一併拆 | e447 信箱 to-integrator#4、to-lane#4 |
| 2026-11-26 | 整合者 | e447 修訂 cut 預審（to-integrator#5，spec @ `c4a5b91`）`close`（to-lane#5）：T-E447-03 拆成 A2a（03，約 185 行）與 A2b（06，約 220 行），T-E447-04 拆成 B1（04，4 檔）與 B2（07，3 檔，最後實作 task），每個 sr task 在 `task_size` 內；AC1–AC12 皆有實作 task；hop 估算改為 6/14（同角色寫入不加 hop，與 live state 相符）。O1–O3（PM 建議皆 (a)）與 D1–D10 由 lane 呈人類核准 | e447 信箱 to-integrator#5、to-lane#5 |
| 2026-11-26 | 整合者 | e446 cut 預審（to-integrator#1，spec @ `267b0f3`）`close`（to-lane#1）：照人類 Q3 (a)，SOP 改第 15、32、36 行（C-DW2 把 CHANGELOG 缺口改寫進最後回覆，是 (a) 的直接後果、非選項）、`tools/role.ts` 註解 5 → 6 行、`dist/tools/role.*` 重建；AC1–AC9 皆有實作 task；整合者在 lane 重跑 `check --cut` exit 0（0 out of bounds）；PM probe 唯一紅檔 `test/e408-core-task-alias-tail.test.mjs` 在擁有欄內；cut 無選項、無 needs human ruling——可走 manifest tier 自動核准；hop 估 4–5 | e446 信箱 to-integrator#1、to-lane#1 |
| 2026-11-26 | 整合者 | e446 cut 依憲法 §3.1 manifest tier 自動核准（lane 的 pm:In_Progress 寫入帶 `cut-approved: manifest-tier (specs/fanout-post-v5-w6.md, Decisions 2026-11-26)`，`cut_approved: true`），已派 qa-engineer 做 T-E446-01 | e446 信箱 to-integrator#2；`.current/e446/handoff.md` |
| 2026-11-26 | 人類 | 在 e447 的 session 核准 cut（spec @ `c4a5b91`）並裁定 O1、O2、O3 皆 (a)：`agc init --knowledge=local\|repo` 與 config key `"knowledge": "local"`（純新增 key、config schema 不升、`schema/**` 不動）；re-seed 用 `agc feature reseed <path>...`；finish 把新寫或改過的知識檔放回 primary 同一路徑、兩邊都改則拒絕。D1–D10 照 spec。只影響本 lane，寫在核准的 cut 裡 | e447 lane session；`specs/e447-local-knowledge-files.md` Options 段 @ `a5628ff`、`.current/e447/handoff.md`（`cut_approved: true`）；e447 信箱 to-integrator#6 |
| 2026-11-26 | 整合者 | e447 自報違規（to-integrator#8）：sr-engineer 在 T-E447-02 用了 `git commit --amend`（憲法 §6 禁止），把 `.current/e447/` 併進同一 commit，`3461754` → `18ffb6f`；未 push，branch 上只有 `18ffb6f`，舊 sha 只出現在 `.current/e447/handoff.md` 一行。處理（to-lane#6）：不做任何 reset 或再次 amend，維持現狀；下一次 state 寫入更正該行；報告與 commit 訊息不得引用舊 sha；之後每個 brief 明寫禁止 amend。qa 未覆蓋的 ticketDir 不安全字元 guard 交 code-reviewer 判斷 | e447 信箱 to-integrator#8、to-lane#6 |
| 2026-11-26 | 整合者 | e446 收工報告（to-integrator#5，HEAD `71c57f1`）驗證通過、`close`（to-lane#2）：8 commits、乾淨樹；`check` 19 檔 0 越界；證據 3/3（`review_reports/review_T-E446-01..03.md` Round 1 APPROVED；`qa_reports/review_T-E446-01.md` covers T-E446-01..03）；無新發現；lane 層 CI run 45810071302 @ `71c57f1` 綠；review 退回 0、hop 4/14。波次報告不開票的意見：(O) AC6 只直測 `validateTransition`，可加經 `tw_update_state` handler 的端到端 replay；(O) SOP 第 1 步仍接受 workspace owner 變體的 PASS tuple，C-DW3 字面寫 `(code-reviewer, PASS)`；(A) `agc check` 註解 advisory：`test/e446-doc-writer-close.test.mjs` 檔頭 9 行、`tools/role.ts` 註解比例 32.6%（base 32.0%） | e446 信箱 to-integrator#5、to-lane#2 |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/e428-tracker-mirror.test.mjs` 劃給 e447——AC6、AC12 兩個測試凍結 `content/skill-integrator.md` 整檔（去掉 E428 文字後）的 sha256，e447 依票面改該檔（C-IN-R4）後必紅；base（primary @ `07a6d47`）13/13 綠，lane @ `91b8603` 只這兩個紅、失敗斷言都是雜湊；e446 不讀此檔。T-E447-05 由 qa 只更新雜湊值。另記：e447 T-E447-03 首次全套在 `test/lane-migrate.test.mjs` 卡 52 分鐘（高負載），單跑 10 秒、重跑正常（to-integrator#9），列波次報告 | e447 信箱 to-integrator#9、#11、to-lane#7 |
| 2026-11-26 | 整合者 | e447 T-E447-07 完成（to-integrator#12，`6534c9e`）；lane coordinator 在核准後改了 spec Copy DOC-INST-5（開頭加句點，修正既有格無句點造成的連句，spec @ `0c62a05`）。回 to-lane#8：標點修正不值得 PM 重入，但核准過的 Copy 不得無聲改——請在 lane session 呈人類看前後差異、取得親手打字同意並記進 spec，code-reviewer 報告一併列出；人類不同意則照原 Copy、列收工報告已知瑕疵 | e447 信箱 to-integrator#12、to-lane#8；lane spec @ `0c62a05` |
| 2026-11-27 | 人類 | 在 e447 的 session 同意 DOC-INST-5 的核准後標點修訂（開頭改為「. With」，修正連句）；只影響本 lane，已寫進 spec 的 Human ruling 段 | e447 lane session（「ok, 同意」）；`specs/e447-local-knowledge-files.md` @ `b14d68e`；e447 信箱 to-integrator#14 |
| 2026-11-27 | 整合者 | e447 code-reviewer 第 1 輪 CHANGES_REQUESTED → pm（`review_reports/review_T-E447-01.md` @ `1b33af3`）：R1 12 則訊息沒有 Copy 列、R2 sr 自加的行為沒有情境與測試（情境缺陷）；R3 `docs/install.md` 一處路徑寫錯、R4 `finish --shipped` 晚段失敗後重跑需手改（實作缺陷）。PM 修訂 A1 預審：第一版（to-integrator#16，`43eefbe`）回 reply（to-lane#9），請模式開啟時改正 pending-tickets 格式錯誤訊息的「fix on the lane branch」（模式關閉輸出不變）；第二版（to-integrator#17，`f3ad05b`）`close`（to-lane#10）：AC13–AC20、D11、新 Copy 列，T-E447-08 qa、T-E447-09 sr（約 45 行 2 檔）、T-E447-10 code-reviewer，content/** 與共用生成物不動，hop 預計 10/14。A1 同意與 O4（check --cut 讀 lane 自己的 config 快照短路；PM 建議 (a) 不加，整合者同意）由 lane 呈人類 | e447 信箱 to-integrator#15–#17、to-lane#9、#10 |
| 2026-11-27 | 人類 | 在 e447 的 session 核准 cut 修訂 A1（spec @ `f3ad05b`，含 R1 補列的 Copy 與 `e447.finish-pending-malformed` 新字）並裁定 O4 照 (a)：`check --cut` 不加讀 lane config 快照的短路。只影響本 lane，寫在核准的 cut 裡 | e447 lane session（「同意 A1，O4 照 (a)」）；`specs/e447-local-knowledge-files.md` Human ruling 段 @ `b85461c`、`.current/e447/handoff.md`（`cut_approved: true`）；e447 信箱 to-integrator#18 |
| 2026-11-27 | 整合者 | e447 收工報告（to-integrator#21，HEAD `8a2acc3`）退回（to-lane#11）：lane 層 CI run 45932200487 紅——`test/e234-hygiene-scan.test.mjs` AC16 把 `qa_reports/review_T-E447-10.md` 第 45 行的暫存目錄絕對路徑列為 temp-path（本 lane 證據檔的資訊衛生缺陷，非 flake，不屬負載敏感清單）。其餘核對通過：33 commits、乾淨樹；`check` 15 個越界皆為已記錄的機械性項目（12 個 `dist/tools/{config,fanout-manifest,lane-paths}.*` 由 Lanes 列「上列 .ts 對應的 dist/** 輸出」涵蓋、3 個已劃歸測試）；證據 T-E447-01..10 最新一輪 APPROVED（`review_reports/review_T-E447-10.md` covers 01..10）；無新發現 | e447 信箱 to-integrator#21、to-lane#11 |
| 2026-11-27 | 整合者 | e447 修正（to-integrator#22，HEAD `4dcbbec`，新 commit、只改 `qa_reports/review_T-E447-10.md` 一行，lane 全部報告掃過無其他絕對路徑）驗證通過、`close`（to-lane#12）：lane 層 CI run 45932710279 @ `4dcbbec` 綠；review 退回 1（第 1 輪 CHANGES_REQUESTED → pm，A1 修訂後第 2 輪 APPROVED）、hop 10/14。波次報告不開票的意見：(O) `e447.finish-harvest-failed` 在 lane 複本寫入失敗時仍說 into the primary checkout；(O) `writeViaRename` 在 rename 失敗時留下暫存檔，需手刪；(O) D9：模式關閉的 lane 內 `check --cut` 仍跑一次 `git worktree list`（人類裁定 O4 (a) 不改）；(A) `agc check` 註解長度 advisory 15 則。疑慮：amend 違規一次（已記）；高負載時 `test/lane-migrate.test.mjs` 曾卡 52 分鐘；尚未在真實 adopter repo 試跑本模式 | e447 信箱 to-integrator#21、#22，to-lane#12 |
| 2026-11-27 | 整合者 | 整合：`main` 派工後前進一個 PR（#204，關 E177c，只改 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md` 各一行，與兩條 lane 無交集）；`integ/post-v5-w6` 自 `main` @ `842c874` 開出，`--no-ff` 先合 e447（merge `9393830`）、再合 e446（merge `8106e92`），皆零衝突、無實質解衝突，merge-invariants 兩次 PASS；build 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17。E446、E447 done-mark（`docs/backlog.md`、佇列第 257、258 號列），`check:bookkeeping` exit 0；E443 Phase 0 第二段寫入 `specs/e443-phase0-host-check.md`。Roll-up：e446 3 個 task、hop 4/14、review 退回 0、證據 3/3；e447 10 個 task、hop 10/14、review 退回 1、證據 10/10；合計 13 個 task（不設上限） | 本清單；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/e443-phase0-host-check.md` |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 842c874
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v5-w6 @ d72d406）
- lane-status：primary（main ← integ/post-v5-w6 @ d72d406）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，clean
### 已結案
- e446（E446）PASS，merge `8106e92`；e447（E447）PASS，merge `9393830`；以本波 PR 合進 `main`。lane 紀錄在 `.current/history/2026-11/e446/`、`.current/history/2026-11/e447/`；兩條 lane 都沒有未配號的新發現。波次報告不開票的意見（e446 三則、e447 四則）與疑慮記在 Decisions 表。
- E443 Phase 0 第二段以官方文件結案（人類裁定 (a)），只剩「撞到上限、主 session 接續後是否重派中斷的 subagent」一項，待第一次真的撞到上限時補驗；紀錄 `specs/e443-phase0-host-check.md`。
### 待人類決定
- 要不要發 v5.x：E424、E425、E427、E430、E449、E426、E428、E446、E447 都已完成，合進 `main` 後尚未發版。
- 下一波要不要開、開哪些票：佇列尚未完成的是 E443（前提已成立，Phase 1 可以開 lane）與 E420（新鏈上仍沒有結案的 design-armed feature）。
### 進行中的背景工作
無
