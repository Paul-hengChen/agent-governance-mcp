# Fan-out: post-v5.0.0 第 2 波（E425，加上 E427 修正條款 (2) 的 SOP 文字）
base: 3b695e2    integration branch: integ/post-v5-w2
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准，派工中。**

範圍由人類指定（integrator prompt「fan-out E425 E427」，2026-11-26）。分波與分組沿用第 1 波清單 `specs/fanout-post-v5-w1.md` 已核准的切法 A（人類 2026-11-25）：第 2 波 = E425 全部，加上 E427 修正條款 (2) 的兩句 SOP。票面以 `docs/backlog.md` 的 E425、E427 列為準，含 2026-11-19 的修正條款；佇列 `docs/v4.0.0-new-tickets.md` 第 250、253 號列。兩張都屬 v5.0.0 里程碑，以 v5.x 發出；本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `3b695e2`（PR #194 合併後），工作樹乾淨；`feat/e425-*`、`integ/post-v5-w2` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- `scripts/batch-summary.mjs` 還不存在；`scripts/check-scenario-tests.mjs` 已在（第 1 波 e427）。
- `tsconfig.json` 沒有 `removeComments`；E425 改 `tools/ticket-file.ts`，所以 `dist/**` 歸本 lane。

### 檔案面（在 `3b695e2` 核對）
- **E425**：`content/coord-03-core-fallback.md`、`content/coord-07-core-sop.md`（coordinator 的 Escalation Routes 列與協定指標）；`content/skill-integrator.md`（修正條款 (3)：integrator SOP 沒有 Escalation Routes，規則寫進既有的 stage 文字）；`content/const-08-chain-31-mid.md`（第 4 行 Manifest tier 與同段 Cut-Approval Gate 的「HALT exactly as today」——修正條款 (5) 指名覆寫）；`docs/lane-protocol.md`（§3 第 40 行「cut 核准……一律等人類在你這個 session 親手打字」，修正條款 (5) 指名覆寫；機制只寫在這份）；`docs/ticket-format.md`（`### Status values` 第 54 行起：`stopped — waiting on <id>`、`stopped — awaiting manual verification`；`### Scenarios added during the work` 第 120 行起；摘要各項的記錄位置）；`tools/ticket-file.ts`（330 行；`TICKET_STATUSES`、`STOPPED_RE` 已接受 `stopped — <reason>`，`depends_on` 讀取若要新增 export 只能新增、不改既有簽章）；`scripts/batch-summary.mjs`（新）。
- **E427 修正條款 (2)**：`content/skill-qa-engineer.md`（第 23 行 `## Scenario → Test Map` 已記測試名稱，但沒有要求回填票檔的驗證欄）；`content/skill-code-reviewer.md`（沒有「確認點名的測試真的在驗那條情境」）。`docs/ticket-format.md` 第 114 行 *Filling in the test name later* 已有格式（第 1 波 e427），本波只補 SOP 那一端。
- 摘要要讀的既有記錄（修正條款 (4)）：qa 的介面決定在 `qa_reports/tests_<feature>.md` 的 `## Open Interface Details`（`content/skill-qa-engineer.md` 第 23、38 行）；視覺允許差異在 `qa_reports/visual_<task-id>.md` 的 `## Allowed Differences`（`content/const-11-design-chain-32.md`）；追加情境在票檔末尾（`docs/ticket-format.md` 第 120 行）。agent 自行決定的事項目前沒有固定位置，由 cut 在 `docs/ticket-format.md` 定義。

### 讀這些檔文字的測試（literal 搜尋，沒跑）
| 被讀的檔 | 讀它的測試檔數 |
|---|---|
| `content/coord-03-core-fallback.md` | 23 |
| `content/coord-07-core-sop.md` | 6 |
| `content/skill-integrator.md` | 25 |
| `content/const-08-chain-31-mid.md` | 18 |
| `content/skill-qa-engineer.md` | 27 |
| `content/skill-code-reviewer.md` | 17 |
| `docs/lane-protocol.md` | 24 |
| `docs/ticket-format.md` | 8 |
| `tools/ticket-file`（含 `dist/`） | 7 |

本波只有一條 lane，這些讀者測試裡因本 lane 而紅的全歸 e425；完整清單由 PM probe 用完整套件列出。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e425 | E425、E427 修正條款 (2) | feat/e425-stop-ticket-batch | ../agent-governance-mcp-lanes/e425 | `content/coord-03-core-fallback.md`、`content/coord-07-core-sop.md`、`content/skill-integrator.md`、`content/const-08-chain-31-mid.md`、`content/skill-qa-engineer.md`、`content/skill-code-reviewer.md`、`docs/lane-protocol.md`、`docs/ticket-format.md`、`tools/ticket-file.ts`（只限新增 export，cut 寫明時）、`scripts/batch-summary.mjs`（新）、`package.json`（只限 `scripts` 欄，cut 寫明時）、`CLAUDE.md`（只限 Layout 新增一行，cut 寫明時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`dist/**`、`test/e425-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e425-*.md`、`.current/e425/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`；其他 `docs/**`（含 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol-addendum.md`）；`specs/fanout-*.md`；`scripts/**` 除上列；`.github/**`；`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`；`tools/**` 除上列；`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package-lock.json` | 做：E425 依 2026-11-19 修正條款 (1)–(5) 與 15.2 裁定 8——批次中的票只在兩種情況停（情境錯、或需要票沒授權的東西），其餘由 agent 決定並記錄；情境只能追加、不能改或刪；停票寫 `stopped — <理由>` 與待決問題，直接或間接相依的票寫 `stopped — waiting on <id>`，無關的票繼續；含 `device-or-person` 情境的票跑到 code-reviewer PASS、merge 前停在 `stopped — awaiting manual verification`；`scripts/batch-summary.mjs` 只從票檔與報告印一頁摘要（完成、停票與問題、等待中的票與等誰、待人工驗收、追加情境、qa 介面決定、允許的視覺差異、agent 決定）；從已核准波次表啟動的批次 lane 不等打字核准，需要人類的事一律停票——在 `docs/lane-protocol.md`、憲法 Cut-Approval Gate 與 Manifest tier 的「HALT exactly as today」指名覆寫；機制只寫在 `docs/lane-protocol.md`，coordinator SOP 加一列 Escalation Routes 與指標，integrator SOP 寫進既有 stage 文字；`docs/ticket-format.md` 定義摘要各項的記錄位置。E427 (2)：`content/skill-qa-engineer.md` 寫完測試後把票檔驗證欄回填成 `test <檔案> — <完整巢狀標題>`（只動驗證欄，不動 Given/When/Then）；`content/skill-code-reviewer.md` 確認點名的測試真的在驗那條情境。golden 與預算以本 lane 為準，cut 寫明相對 E418 節省量的差額。不做：伺服器 gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）的變動；E430 的信箱規則；E426 的 PM 規則；E443 的啟動器；`scripts/check-scenario-tests.mjs` 的行為 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **E427 修正條款 (2) 併進 e425（人類 2026-11-25 選切法 A，第 1 波清單已記）**：`content/**` 一波只能歸一條 lane，兩句 SOP 因此和 E425 同 lane。E427 的 done-mark 在本波合併後由整合者寫。
- **共用生成物與 `dist/**` 整組歸 e425**：本波唯一一條 lane。
- **`CLAUDE.md`**：只在 cut 寫明時於 Layout 加一行（例如新腳本）。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給 e425，記一列 Decisions（裁決者 `整合者`），不問人類。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **不走 architect**：沒有 gate 或 pipeline 變動。Lanes 表 `approval` = `human`：本 lane 改憲法 §3.1 的核准規則，cut 先經整合者預審收斂，再由 lane 在自己的 session 呈人類核准。
- **只有實作完才擷取得到的快照**（golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP 與協定文字寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- `dist/` 是 tracked 建置產物：改 `.ts` 的 commit 一併 commit `npm run build` 的輸出。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e425`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 票 A、B（相依 A）、C（獨立）：A 停時 B 記為 `stopped — waiting on A`、C 照跑 | e425（E425） | ✓ |
| 需要允許路徑以外的檔案時停票，理由點名該路徑 | e425（E425） | ✓ |
| 建置中追加的情境出現在摘要該票底下；qa 介面決定、允許的視覺差異、agent 決定也出現在摘要 | e425（E425） | ✓ |
| 含 `device-or-person` 情境的票在 code-reviewer PASS 後、merge 前停在 `stopped — awaiting manual verification`，摘要列出 | e425（E425） | ✓ |
| 從已核准波次表啟動的批次 lane 不等打字核准；`docs/lane-protocol.md` 與憲法兩處指名覆寫；coordinator SOP 一列 Escalation Routes 加指標，integrator SOP 寫進 stage 文字 | e425（E425） | ✓ |
| `content/skill-qa-engineer.md` 寫明回填票檔驗證欄；`content/skill-code-reviewer.md` 寫明確認點名的測試在驗那條情境 | e425（E427 (2)） | ✓ |
| golden 與預算重擷取並逐 hunk 說明；cut 寫明相對 E418 節省量的差額 | e425 | ✓ |
| 合併後 `npm run build` 的 `dist/` commit、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E425、E427 done-mark（not yet released）；佇列第 250、253 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 commit `dist/`；合併並建置後重啟 primary 的 MCP server（e425 改了 `tools/ticket-file.ts` 時）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w2` 自當時的 `main` 開。
2. ← `--no-ff` e425 → merge-invariants。
3. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e425`（`--shipped --base integ/post-v5-w2`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w2`。不發版。

## Dispatch pins
- e425：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 核准）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-25 | 人類 | 第 2 波範圍：E425 全部，加上 E427 修正條款 (2) 的 SOP 文字（切法 A） | `specs/fanout-post-v5-w1.md` Decisions 第 1 列 |
| 2026-11-26 | 整合者 | Stage 1：一條 lane e425（E425 + E427 (2)），因兩者都改 `content/**`、一波只能一條 lane 擁有；不走 architect；建議 `approval` = `human`（改憲法 §3.1 核准規則） | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：一條 lane e425、不走 architect、`approval` = `human`（e425 的 cut 由人類在 lane 的 session 核准）、pm／qa-engineer／sr-engineer／code-reviewer 全部 pin opus，其餘照清單 | 整合者 session（三題都選建議選項） |
| 2026-11-26 | 整合者 | 清單 PR #195 合進 `main`（merge `976a789`，CI run 45660230309 綠），派工 base = `976a789`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e425-*` 與 `integ/post-v5-w2` 都不存在、擁有欄點名的既有路徑都在、`scripts/batch-summary.mjs` 尚不存在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e425/`、開信箱監看（baseline 0）與 lane-status 監看、render prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-26 | 整合者 | e425 cut 預審（to-integrator#1，spec @ `e3978485`）回 `reply`（to-lane#1）：範圍、檔案界線、DoD 對照相符，每個 AC 有實作 task；不動 `tools/ticket-file.ts` 成立（現有 `check-tickets` 接受 AC5 的票形，整合者實測 exit 0）；要求把 `docs/lane-protocol.md` §5 cut 預審子項「才把 cut 呈給人類」列為 C-LP2 的第四處覆寫並加指標。Q1–Q3 同意 PM 建議（needs human ruling，由 lane 呈人類，附 Q1 (a) 對 adopter 的後果） | e425 信箱 to-integrator#1、to-lane#1 |
| 2026-11-26 | 整合者 | e425 修訂 cut（to-integrator#2，spec @ `25aabf19`：新增 C-LP3、C-LP2 改為四處覆寫、AC1 釘 C-LP3、Q1 (a) 後果句）`close`（to-lane#2）；approval = human，由人類在 lane 的 session 核准 cut 並裁定 Q1–Q3 | e425 信箱 to-integrator#2、to-lane#2 |
| 2026-11-26 | 人類 | 在 e425 的 session 核准 cut（spec @ `25aabf19`）並裁定 Q1 = (a)（由既有事實判定批次 lane：清單有 `人類` Decisions 列、lane 每張票都是票檔、`approval` 不是 `human`）、Q2 = agent 決定記在票檔 `## Decisions made during the work`、Q3 = 摘要多印 `not started`、`unreadable tickets` 兩組；三題都寫在已核准的 spec 裡，只影響本 lane 的交付內容 | e425 lane session；`.current/e425/handoff.md` @ `3de5b143`（`cut_approved: true` 與裁定紀錄）、`specs/e425-stop-ticket-batch.md` @ `25aabf19`；e425 信箱 to-integrator#3 |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/e118-reviewer-ac-completeness.test.mjs` 劃給 e425——在 base `976a789` 上 7/7 綠、在 lane `66a3d0f` 上 AC7 紅（`content/skill-code-reviewer.md` 13991 bytes 超過上限 13760，因 C-CR），不在任何擁有欄；由 qa 在 T-E425-06 調上限並逐 hunk 說明（同第 1 波 e424 的劃法） | e425 信箱 to-integrator#4；整合者在兩個 sha 各跑該檔 |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/e410-task-alias-content-tail.test.mjs` 劃給 e425——base `976a789` 上 6/6 綠、lane `9b95417` 上 AC2 兩筆紅（釘死 `content/const-08-chain-31-mid.md`、`content/skill-integrator.md` 的行號與行數），不在任何擁有欄；qa 在 T-E425-06 只改行號與行數 | e425 信箱 to-integrator#5；整合者在兩個 sha 各跑該檔 |
| 2026-11-26 | 整合者 | 機械性越界核准：`test/e349-integrator-repo-facts.test.mjs` AC-E349-2 要求 integrator SOP 從 agc 安裝位置呼叫的每支腳本在 `docs/lane-protocol-addendum.md` §5 列出 repo 相對呼叫；C-IN3 新增 batch summary，所以把 addendum §5 第二條清單新增一個 `node scripts/batch-summary.mjs` 劃給 e425（只限這一處，不改其他行）。不採 lane 提的 (a)「整合者在整合 commit 補」：lane 分支會帶著一個紅燈測試交給裁判與 CI，lane 層驗證過不了。e349 劃給 e425（base 2/2 綠、lane AC-E349-2 紅） | e425 信箱 to-integrator#5 |
| 2026-11-26 | 整合者 | e425 lane 報告（to-integrator#6，HEAD `24570d9`）核對：21 commits、乾淨樹、證據 7/7、無新發現；越界 4 檔都在既有核准範圍內。送回兩項（to-lane#7）：R1 `docs/ticket-format.md` Status values 表的範例理由以 `waiting on` 開頭，與新定的 `stopped — waiting on <id>` 固定寫法衝突，是本 lane 造成的缺陷，依 filing bar 退回 lane 修，不另開票；R2 本 lane 改到的三個測試檔有 6 條註解長度 advisory（main 上沒有），依憲法 §6 縮到 7 行以內（與第 1 波同一標準）。optional：同一張票同時以資料夾與檔案傳入時會算兩次，列入波次報告 | e425 信箱 to-integrator#6、to-lane#7 |
| 2026-11-26 | 整合者 | e425 rework cut（to-integrator#7，spec @ `7c20a10a`：AC16、T-E425-07 qa、T-E425-08 sr）`close`（to-lane#8）；`check --cut` 把 `test/e118-reviewer-ac-completeness.test.mjs` 判為越界，屬本表第 8 列已劃給 e425 的檔，確認有效；approval = human，由人類在 lane 的 session 核准 | e425 信箱 to-integrator#7、to-lane#8 |
| 2026-11-26 | 整合者 | e425 rework 後報告（to-integrator#8，取代 #6，HEAD `5b581db`）驗證通過：29 commits、標題都帶 E425、乾淨樹、`check` 38 檔，越界 4 檔（addendum、e118、e349、e410）都在本表第 8–10 列核准範圍內；證據 8/8（`review_reports/review_T-E425-01.md` covers 01..06、`review_reports/review_T-E425-07.md` covers 07、08，皆 APPROVED；`qa_reports/review_T-E425-01..08.md`）；R1、R2 都已修，`agc check` 無本 lane 加的註解 advisory；lane 層 CI run 45733593344 @ `5b581db` 綠（Node 20、22）；review 退回 0、hop 10/14；`close`（to-lane#9） | e425 信箱 to-integrator#8、to-lane#9 |
| 2026-11-26 | 整合者 | 整合：`integ/post-v5-w2` 自 `main` @ `976a789` 開出，`--no-ff` 合 e425（merge `9a13186`），零衝突，merge-invariants PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0；`check:bookkeeping` exit 0；E425、E427 done-mark。波次報告不開票的意見：`batch-summary.mjs` 同時收到資料夾與其中的票檔時，同一張票會算兩次（optional，非本波缺陷）。 | 本清單；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md` |
