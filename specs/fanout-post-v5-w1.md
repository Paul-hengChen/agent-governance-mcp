# Fan-out: post-v5.0.0 第 1 波（E424、E427 核心）
base: 17dcb8e    integration branch: integ/post-v5-w1
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-26。** e424、e427 依序 `--no-ff` 合進 `integ/post-v5-w1`（merge `f7a49dc`、`d134a99`，零衝突、無實質解衝突），merge-invariants 每次 PASS；派工 base `d239895`（清單 PR #193）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33、pipeline 17 步，golden 與 context-budget 測試綠。lane 層 CI：e424 run 45653315807 @ `25caae9`、e427 run 45654701270 @ `7031ef8`；整合層 CI run 45655514072 @ `d134a99`，皆綠（Node 20、22）。Roll-up：e424 7 個 task、hop 11/14、review 退回 0；e427 8 個 task、hop 8/14、review 退回 0；證據 15/15。E424 done-mark；E427 核心已合併、修正條款 (2) 在第 2 波。本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out E424 E425 E427」，2026-11-25）。三張票都屬 v5.0.0 里程碑、依排定順序在 v5.0.0 之後以 v5.x 發出。票面以 `docs/backlog.md` 的 E424、E425、E427 列為準，含 2026-11-19 的修正條款；佇列 `docs/v4.0.0-new-tickets.md` 第 249、250、253 號列。人類 2026-11-25 選了切法 A：拆成兩波。本清單只涵蓋第 1 波；E425 與 E427 的 SOP 文字在第 2 波，另開清單。

## 派工前核對（整合者，2026-11-25，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `17dcb8e`、工作樹乾淨；`feat/e424-*`、`feat/e427-*`、`integ/post-v5-w1` 都不存在。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- `scripts/check-scenario-tests.mjs`、`scripts/batch-summary.mjs` 都還不存在。
- `tsconfig.json` 沒有 `removeComments`，只改註解也會改到 tracked 的 `dist/`，所以 `dist/**` 列進改 `.ts` 那條 lane 的擁有欄。

### 三張票的檔案面（在 `17dcb8e` 核對）
- **E424**：`gates/ac-execution.ts`（108 行；`hasProofAnnotatedAC`、`hasAcExecutionLogDisposition`）、`tools/handoff-orchestrator.ts`（第 42 行 import 這兩個函式）、`gates/registry.ts`（`AC_EXECUTION_LOG_MISSING` 的 hint／sub-reason，不新增錯誤碼）；靠 `tools/ticket-file.ts` 的 `parseTicketFile`（E422）讀情境 id 與驗證方式，靠 E432 的 `resolveJudgeReport`（`tools/evidence-file.ts`）找裁判報告；驗收紀錄的格式在 `content/skill-code-reviewer.md` 第 88 行（step 8 *AC Execution*）。spec 透過引用票檔對應到票（修正條款 (1)），`ticketDir` 由 `tools/config.ts` 解析。
- **E425**（第 2 波）：`content/coord-03-core-fallback.md`、`content/coord-07-core-sop.md`、`content/skill-integrator.md`、`content/const-08-chain-31-mid.md`（或負責的那段）、`docs/lane-protocol.md`、`docs/ticket-format.md`、`tools/ticket-file.ts`、`scripts/batch-summary.mjs`（新），外加測試與 golden。
- **E427**：`scripts/check-scenario-tests.mjs`（新）、這個 repo 的 runner adapter（新）、`.github/workflows/ci.yml`（`test` job 第 33–34 行 `npm test` 那一步）、`docs/ticket-format.md`（第 114 行起 *Filling in the test name later*、驗證方式表）。`npm test` = `node scripts/test-lock.mjs -- node --test test/*.test.mjs`；`test-lock` 用 `spawn(command[0], command.slice(1))` 原樣轉送參數。修正條款 (2) 要求「qa 回填測試名稱、code-reviewer 確認」，現行 `content/skill-qa-engineer.md`、`content/skill-code-reviewer.md` 都沒寫，所以這部分要改 `content/**`。

### 三張票的耦合（決定分組的事實）
- E424 × E425：兩張都改 `content/**`，而它一波只能歸一條 lane；人類也裁定過 E425 排在 E424 之後（討論檔 14.2 裁定 19）。→ 不同波。
- E425 × E427：兩張都改 `docs/ticket-format.md`。→ 不同波，除非拆票。
- E424 × E427：檔案不重疊。E427 依賴欄寫 E424，但只是交代動機（E424 查裁判自己的紀錄，E427 改由 CI 查）；E427 只讀票檔與 runner 的機器可讀結果，用 E422 已有的 `parseTicketFile`，不用 E424 的程式。唯一重疊是修正條款 (2) 的 SOP 文字（`content/**`）。→ 把 SOP 文字拆到第 2 波，核心就能和 E424 並行。

### 讀對方檔案文字的測試（跨 lane 的部分）
| 被讀的檔 | 讀它的測試 | 檢查什麼 | 歸誰、怎麼保持綠 |
|---|---|---|---|
| `docs/ticket-format.md` | `test/e422-ticket-format-doc.test.mjs`、`test/e455-ticket-checker-strict.test.mjs`、`test/e423-spec-workshop.test.mjs`、`test/e445-spec-workshop-questioning.test.mjs`、`test/e462-stale-comments-wording.test.mjs` | 格式文件段落與用語 | e427 只新增段落、不改既有的驗證方式表語意；紅了的由 e427 PM probe 列出，照常設規則劃給 e427 |
| `.github/workflows/*.yml` | `test/e405-release-workflow.test.mjs`、`test/e298-*`、`test/e296-*`、`test/e349-*`、`test/e355-*`（引用 `ci.yml` 或 workflow 字樣） | workflow 內容 | e427 只在 `test` job 加一步，不改 job 名稱與 matrix（必要檢查 `test (20)`、`test (22)` 不變）；紅了照常設規則劃給 e427 |
| `content/skill-code-reviewer.md`、`gates/ac-execution.ts` | `test/ac-execution.test.mjs`、`test/e433-*`、`test/e448-*`、`test/e432-*`、`test/e453-*`、`test/e462-*`、`test/e118-*`、`test/render-structure.test.mjs`、`test/subagent-templates.test.mjs`、`test/skill-evolution-v3.11.test.mjs` 等 | SOP 用語、gate 行為 | 全歸 e424；e427 不改這些檔 |
| `dist/tools/ticket-file.js` | e427 的新腳本（import，不改） | 解析器 API | e424 若要改 `tools/ticket-file.ts`，只能新增 export、不改既有簽章；cut 寫明 |

### 預估只因本 lane 而紅的測試（literal 搜尋，沒跑；完整清單由各 lane PM probe 用完整套件列出）
- **e424 確定會紅或要重釘**：`test/ac-execution.test.mjs`；票面列出的 `test/e23-evidence-schema.test.mjs`、`test/e136-evidence-path-injective.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`（若 hint 改字或 pipeline 步驟有變）。
- **e424 可能會紅**：`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`（改 `content/skill-code-reviewer.md` 一定會動 golden）；`test/e448-*`、`test/e432-*`、`test/e433-*`、`test/e453-*`、`test/e462-*`、`test/e118-*`。
- **e427 可能會紅**：上表 `docs/ticket-format.md` 與 workflow 的讀者。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e424 | E424 | feat/e424-per-scenario-acceptance | ../agent-governance-mcp-lanes/e424 | `gates/ac-execution.ts`、`gates/registry.ts`（只限 `AC_EXECUTION_LOG_MISSING` 那一筆的 hint 與註解）、`tools/handoff-orchestrator.ts`、`tools/ticket-file.ts`（只限新增 export，cut 寫明時）、本 lane 新增的 `tools/*.ts`（cut 寫明時）、`CLAUDE.md`（只限 Layout 新增一行，有新 `tools/*.ts` 時）、`content/skill-code-reviewer.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`dist/**`、`test/ac-execution.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/e136-evidence-path-injective.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`、`test/e118-reviewer-ac-completeness.test.mjs`、`test/e424-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e424-*.md`、`.current/e424/**`、`qa_reports/`、`review_reports/` | e427 擁有的全部；其他 `content/**`；`docs/**`；`scripts/**`、`.github/**`；`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`guards/**`、`schema/**`；`tools/**`、`gates/**` 除上列各檔；`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json`；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md` | 做：E424 依 2026-11-19 修正條款——判決者是 code-reviewer、報告經 E432 的 resolver 找到；spec 引用票檔時，檢查讀票上每個驗證方式為 test 或 command 的情境 id（含建置中追加的情境），裁判報告的驗收紀錄要有該 id 且記為通過；缺 id 或非通過時，以既有的 `AC_EXECUTION_LOG_MISSING` 拒絕 PASS，sub-reason 列出 id；`device-or-person` 情境只在 hint 列為 `awaiting manual verification`、不擋；伺服器只讀檔、不執行；沒有票檔的 feature 行為逐位元組不變；只限 file mode；`content/skill-code-reviewer.md` step 8 寫明驗收紀錄格式；golden 與預算以本 lane 為準。不做：新錯誤碼；`GATE_REGISTRY` 數量與 pipeline 17 步的變動；E425 的停票狀態與批次摘要；`tools/ticket-file.ts` 既有 export 的簽章 | 無 | human |
| e427 | E427 核心（SOP 文字除外） | feat/e427-ci-scenario-tests | ../agent-governance-mcp-lanes/e427 | `scripts/check-scenario-tests.mjs`（新）、`scripts/scenario-results-node.mjs`（新，runner adapter）、`.github/workflows/ci.yml`（只限 `test` job：新增步驟，以及 `Test` 步驟的 `run:` 那一行）、`docs/ticket-format.md`、`package.json`（只限 `scripts` 欄，cut 寫明時）、`test/e427-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e427-*.md`、`.current/e427/**`、`qa_reports/`、`review_reports/` | e424 擁有的全部；`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；`dist/**`；所有 `.ts` 原始碼（`tools/**`、`gates/**`、`schema/**`、`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`guards/**`、`index.ts`）；`scripts/**` 除上列；`.github/workflows/release.yml`；`ci.yml` 的 job 名稱與 matrix；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package-lock.json`；其他 `docs/**`；`specs/fanout-*.md` | 做：E427 依 2026-11-19 修正條款 (1)(3)(4)——每個 PR 檢查所有狀態為 `done` 的票檔（`not started`、`stopped` 略過），收集驗證方式為 `test <file> — <title>` 的情境，比對 runner 的機器可讀結果（Node 的 junit reporter，以完整巢狀標題比對），測試不存在、被 skip 或失敗時 exit 非 0 並印出票 id、情境 id 與測試名稱；沒有 `done` 票時不讀結果直接通過；PR 把 `done` 票點名的測試改名時失敗並印出舊名稱；接在既有 `test` job 裡，必要檢查 `test (20)`、`test (22)` 不變、不動 ruleset；reporter 參數經 `test-lock` 轉送；附這個 repo 的 runner adapter，並在 `docs/ticket-format.md` 寫明其他專案要提供的那一個函式、範圍只限自動化測試的情境（`command` 與 `device-or-person` 不在範圍內），以及改名的 PR 要在同一個變更裡更新票檔。不做：修正條款 (2) 的 SOP 文字（qa 回填測試名稱、code-reviewer 確認測試真的在驗那個情境）——歸第 2 波；任何 `.ts` 與 `content/**`；E425 的票檔狀態變動 | 無 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **E427 拆成兩半（人類 2026-11-25 選切法 A）**：核心（腳本、adapter、CI 步驟、`docs/ticket-format.md`、測試）歸本波 e427；修正條款 (2) 寫進 `content/skill-qa-engineer.md`、`content/skill-code-reviewer.md` 的兩句 SOP 文字，併進第 2 波的 E425 lane（那一波 `content/**` 歸它）。E427 的 done-mark 等第 2 波合併後由整合者寫（第 1 波 E458、E461 的前例）。
- **E427 對 E424 的依賴拿掉（人類 2026-11-25 選切法 A）**：兩張並行；E427 也因此排到 E426 前面（佇列原本把 E427 排在 E426 之後）。
- **共用生成物整組歸 e424**：`content/skill-code-reviewer.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`。e427 不碰 compose bundle；若必須改 content → 寄信給整合者。
- **`dist/**` 整組歸 e424**：本波只有 e424 改 `.ts`；e427 的腳本是 `.mjs`（不經 `tsc`），只 import `dist/tools/ticket-file.js`，不改它。
- **`CLAUDE.md`**：只在 e424 新增 `tools/*.ts` 時，於 Layout 加一行。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因某條 lane 的改動而紅、且沒有其他 lane 擁有的測試檔，整合者在 cut 預審時核對（在 base 上綠、在該 lane 的改動下紅、不在任何 lane 的擁有欄）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。跨 lane 的改劃仍由人類在整合者 session 裁定。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **e424 走 architect（gate 行為變更）**，Lanes 表 `approval` = `human`：PM 的 cut 先經整合者預審收斂，再由 lane 在自己的 session 呈人類核准；architect 的 Open Questions（`specs/e424-architecture.md`）回信箱做第二次預審，收斂後再呈人類裁定，之後 sr-engineer 才開工。
- **e427 不走 architect**，cut 在整合者預審 `close` 後依憲法 §3.1 manifest tier 自動核准；條件不成立時照舊停下來呈人類。
- **只有實作完才擷取得到的快照**（e424 的 golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表已列的還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新訊息、新 hint、新 sub-reason 都寫進 cut 的 Copy / Strings。hint 與 SOP 文字不得引用只在本 repo 存在的路徑或裸票號（`content/**` 隨套件發給每個 adopter）。
- e427 的 CI 步驟在 lane 分支 push 後就會跑；這個 repo 目前沒有狀態為 `done` 的票檔時，步驟應通過且不讀結果——cut 寫明這是預期的實測結果，其他情境用 fixture 測。
- `dist/` 是 tracked 建置產物：改 `.ts` 的 commit 一併 commit `npm run build` 的輸出。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e424`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 有票檔時，裁判驗收紀錄缺少某個 test／command 情境 id、或該筆非通過，PASS 以 `AC_EXECUTION_LOG_MISSING` 被拒並列出 id；三筆全通過時接受；建置中追加的情境一樣檢查 | e424（E424） | ✓ |
| `device-or-person` 情境在 hint 列為 `awaiting manual verification`、不擋 PASS | e424（E424） | ✓ |
| 沒有票檔、spec 有 `proof:` 的 feature 行為逐位元組不變；不新增錯誤碼；`GATE_REGISTRY` 33、pipeline 17 步 | e424（E424） | ✓ |
| `content/skill-code-reviewer.md` step 8 寫明驗收紀錄格式；golden 與預算重擷取並逐 hunk 說明 | e424（E424） | ✓ |
| CI 的 `test` job 對每個 `done` 票的 test 情境核對 junit 結果：存在且通過才過，不存在、skip、失敗時印出票 id、情境 id、測試名稱並失敗；沒有 `done` 票時直接通過；改名打斷點名時失敗；Node 20、22 都綠 | e427（E427 核心） | ✓ |
| `docs/ticket-format.md` 寫明範圍限制、其他專案要提供的 adapter 函式、改名的 PR 要同時更新票檔 | e427（E427 核心） | ✓ |
| qa 回填測試名稱、code-reviewer 確認測試真的在驗那個情境（E427 修正條款 (2)）寫進兩個 SOP | 第 2 波 E425 lane | ✗（第 2 波，見「整合後」） |
| 合併後 `npm run build` 的 `dist/` commit、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠（含 e427 的新步驟） | 整合者（5b） | ✓ |
| E424 done-mark（not yet released）；E427 標為「核心已合併、SOP 文字在第 2 波」；佇列第 249、253 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 commit `dist/`；golden 與預算以 e424 為準，合併後重跑確認。
- 合併並建置後重啟 primary 的 MCP server（e424 改了 server 程式）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 接線票（第 2 波）：E425 全部，加上 E427 修正條款 (2) 的 SOP 文字（`content/skill-qa-engineer.md`：寫完測試後把 `Verification: automated test` 回填成 `test <檔案> — <標題>`；`content/skill-code-reviewer.md`：確認點名的測試真的在驗那個情境）。第 2 波另開清單 `specs/fanout-post-v5-w2.md`。
- 不發版。

## 合併順序
1. `integ/post-v5-w1` 自當時的 `main` 開。
2. ← `--no-ff` e424（共用生成物與 `dist/` lane 先）→ merge-invariants。
3. ← `--no-ff` e427 → merge-invariants。
4. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish e424`、`finish e427`（`--shipped --base integ/post-v5-w1`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w1`。不發版。

## Dispatch pins
- e424：`pm=opus`、`architect=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-25 核准）。
- e427：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-25 核准）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-25 | 人類 | fan-out E424、E425、E427；切法 A：兩波，第 1 波 E424 ∥ E427 核心，第 2 波 E425 加上 E427 修正條款 (2) 的 SOP 文字；拆 E427 並拿掉它對 E424 的依賴；E424 的 cut 要在 lane 的 session 由人類核准（`approval` = `human`） | 整合者 session（integrator prompt「fan-out E424 E425 E427」；切法題答「A：兩波」、E424 核准題答「要，我親自看」）；`docs/backlog.md` E424、E425、E427 列 |
| 2026-11-25 | 整合者 | Stage 1：兩條 lane——e424（E424，含共用生成物與 `dist/**`，走 architect）、e427（E427 核心，只改 `.mjs`、CI、`docs/ticket-format.md` 與測試）；合併順序 e424 → e427 | 本檔 |
| 2026-11-25 | 人類 | 核准本清單：Q1 兩條 lane、E427 拆半、拿掉 E427 對 E424 的依賴、共用生成物與 `dist/**` 歸 e424、沿用無主紅檔常設規則，其餘照清單；Q2 e424 的 pm、architect、qa-engineer、sr-engineer、code-reviewer 與 e427 的 pm、qa-engineer、sr-engineer、code-reviewer 全部 pin opus | 整合者 session（「核准，Q1–Q2 照建議」） |
| 2026-11-25 | 整合者 | 清單 PR #193 合進 `main`（merge `d239895`，CI run 45642905179 綠），派工 base = `d239895`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、兩條 lane 的 branch 都不存在、擁有欄點名的既有路徑都在、`scripts/check-scenario-tests.mjs` 尚不存在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/{e424,e427}/`、開信箱監看（baseline 全 0）與 lane-status 監看、render 兩段 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-25 | 整合者 | e427 cut 預審（to-integrator#1，spec @ `db5af58`）`close`（to-lane#1）：接受改既有 `Test` 步驟的 `run:` 那一行（Node 只認放在測試檔前面的 reporter 參數，lane 實測過；機械性且必要）；adapter 定名 `scripts/scenario-results-node.mjs`，補記進本檔 e427 擁有欄。lane branch 上的清單（base `d239895`）沒有這個路徑，`check --cut` exit 1，manifest tier 條件 (3) 不成立，所以 e427 的 cut 改由人類在 lane 的 session 核准 | e427 信箱 to-integrator#1、to-lane#1 |
| 2026-11-25 | 整合者 | e424 cut 預審（to-integrator#1，spec @ `790ce83`）`close`（to-lane#1）：`test/e118-reviewer-ac-completeness.test.mjs` 依常設無主紅檔規則劃給 e424（不在任何擁有欄、base 綠、只因 e424 改 SOP 而紅）；OQ-6 的 helper 留在 `gates/ac-execution.ts`，`tools/evidence-file.ts` 不劃入；OQ-1、OQ-3 標 needs human ruling，連同 cut 在 lane 的 session 呈人類（approval = human），整合者建議照 PM 建議。lane 自報 PM probe 用了 `git checkout` 還原試改（§6 禁止；檔案已回到 base、無損失），已提醒改用 `git stash` | e424 信箱 to-integrator#1、to-lane#1 |
| 2026-11-25 | 整合者 | e424 架構 Open Questions 第二次預審（to-integrator#2，architecture @ `ae11f4a`）回 `reply`（to-lane#2）：不接受 OQ-8 的唯一放寬（spec 有 `proof:`、沒有紀錄段、引用一張全部是 device-or-person 的票，今天被拒、改後會過），改為票檔檢查疊加在舊的 `proof:` 標題檢查上；接受 fence 外以情境 id 開頭的行一律算紀錄、非 pass 就擋。其餘 OQ 照 architect 定案 | e424 信箱 to-integrator#2、to-lane#2 |
| 2026-11-25 | 整合者 | e424 架構修訂（to-integrator#3，@ `195c454`）：接受疊加設計（DR-1、orchestrator 合約 7、AC6 拆 (a)(b)、新 AC14）；回 `reply`（to-lane#3）要求 AC14 補上實作 task（T-E424-04） | e424 信箱 to-integrator#3、to-lane#3 |
| 2026-11-25 | 整合者 | e424 架構 Open Questions 第二次預審收斂（to-integrator#4，@ `8c4b7b5`，T-E424-04 補上 AC14）`close`（to-lane#4）；沒有 needs human ruling 項，sr-engineer 可在 qa 之後開工 | e424 信箱 to-integrator#4、to-lane#4 |
| 2026-11-25 | 整合者 | e427 lane 報告（to-integrator#2，HEAD `2070c0f`）核對相符（11 commits、乾淨樹、0 越界、證據 5/5、無新發現），但送回修 R1（兩個新腳本檔頭註解 13、15 行，超過 agc check 上限 7 行，違反憲法 §6 Comment discipline）與 R2（adapter import 錯誤原因被吞）（to-lane#2）；O1、O2 列入波次報告。推 lane branch 被 GitHub 拒絕：本機 OAuth 憑證沒有 `workflow` scope，不能推改到 `.github/workflows/ci.yml` 的 branch | e427 信箱 to-integrator#2、to-lane#2 |
| 2026-11-25 | 整合者 | e427 修正 cut（to-integrator#3，@ `2f4307b`：AC18 adapterLoadError、AC19 檔頭註解，T-E427-06..08）`close`（to-lane#3）；PASS 後重新進 PM，cut 核准重新上膛，`check --cut` 仍 exit 1，由人類在 lane 的 session 核准 | e427 信箱 to-integrator#3、to-lane#3 |
| 2026-11-25 | 整合者 | e424 lane 報告（to-integrator#5，HEAD `d10a921`）核對相符（14 commits、乾淨樹、0 越界、證據 6/6、無新發現、`dist/` 無差異、golden／預算未動），branch 已推（lane 層 CI run 45650617953）；送回修兩個新測試檔開頭註解超過 7 行（與 e427 R1 同標準）（to-lane#5）；fence 內 `## ` 截斷與 `..` 開頭檔名列入波次報告 | e424 信箱 to-integrator#5、to-lane#5 |
| 2026-11-26 | 整合者 | e424 修訂 cut（to-integrator#6，@ `759ef10`，新增 T-E424-07：兩個新測試檔開頭註解縮到 7 行以內，只改註解）`close`（to-lane#6）；cut 核准重新上膛，由人類在 lane 的 session 核准（approval = human） | e424 信箱 to-integrator#6、to-lane#6 |
| 2026-11-26 | 整合者 | e424 lane 報告（to-integrator#7，取代 #5，HEAD `25caae9`）驗證通過：19 commits、乾淨樹、`check --base main` 33 檔 0 越界、證據 7/7（`review_reports/review_T-E424-01.md` covers 01..06、`review_reports/review_T-E424-07.md`，皆 APPROVED；`qa_reports/review_T-E424-01..07.md` 最後一筆伺服器 PASS）、無新發現、`dist/` 無差異；lane 層 CI run 45653315807 @ `25caae9` 綠（Node 20、22）；review 退回 0、hop 11/14；`close`（to-lane#7） | e424 信箱 to-integrator#7、to-lane#7 |
| 2026-11-26 | 整合者 | e427 lane 報告（to-integrator#4，取代 #2，HEAD `7031ef8`）驗證通過：19 commits、乾淨樹、`check --base main` 30 檔 0 越界、證據 8/8（`review_reports/review_T-E427-01.md` covers 01..05、`review_reports/review_T-E427-06.md` covers 06..08，皆 APPROVED；`qa_reports/review_T-E427-01..08.md` 最後一筆伺服器 PASS）、無新發現；人類補上 gh 的 `workflow` scope 後推上 branch（GitHub 當時部分停擺），lane 層 CI run 45654701270 @ `7031ef8` 綠（Node 20、22），新步驟在兩個版本都印 `no named test in a done ticket; results not read`；review 退回 0、hop 8/14；`close`（to-lane#4） | e427 信箱 to-integrator#4、to-lane#4 |
| 2026-11-26 | 整合者 | 整合：`integ/post-v5-w1` 自 `main` @ `d239895` 開出，依序 `--no-ff` 合 e424（merge `f7a49dc`）、e427（merge `d134a99`），零衝突，merge-invariants 每次 PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0、`GATE_REGISTRY` 33、pipeline 17 步；整合層 CI run 45655514072 @ `d134a99` 綠；`check:bookkeeping`、`check:md-tables` exit 0；依序 `finish e424`、`finish e427`，無新發現。波次報告不開票的意見：e424 的 fence 內 `## ` 會截斷紀錄段（fail-safe）、以 `..` 開頭的票檔名不算引用；e427 的 adapter 路徑不存在時錯誤原因帶本機絕對路徑（只印在 stderr）、O1 預設 adapter 壞掉時印絕對路徑、O2 AC6 不單獨保證 file 有記錄（AC10 涵蓋） | 本檔 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ d239895
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v5-w1 @ 043f7bc）
- lane-status：primary（main ← integ/post-v5-w1 @ 043f7bc）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，clean
### 已結案
- e424（E424）、e427（E427 核心）依序 `--no-ff` 合進 `integ/post-v5-w1`（merge `f7a49dc`、`d134a99`），零衝突、無實質解衝突；整合層 CI run 45655514072 @ `d134a99` 綠（Node 20、22）。
- lane 紀錄：`.current/history/2026-11/e424/`、`.current/history/2026-11/e427/`。
- 新發現：無，兩條 lane 都沒有 `pending-tickets.md`，finish 沒有配號。
- 記帳：E424 done-mark；E427 標「核心已合併、尚未完成」，修正條款 (2) 的兩句 SOP 移到第 2 波，與 E425 一起做。
### 待人類決定
- 要不要開第 2 波（E425，加上 E427 修正條款 (2) 的兩句 SOP）；切法已在本清單核准，開波仍要人類下指令。
- 要不要發 v5.x：E424 與 E427 核心已在 `main`，但 E427 還沒完成。
- E463、E464（發版腳本）還沒排進佇列，要插在第 2 波前面還是排在里程碑之後。
### 進行中的背景工作
無
