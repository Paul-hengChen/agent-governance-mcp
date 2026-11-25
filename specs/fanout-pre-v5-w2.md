# Fan-out: pre-v5.0.0 修正第 2 波（E461、E462）
base: 166a460    integration branch: integ/pre-v5-w2
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准（人類 2026-11-25），待派工。**

範圍由人類指定（integrator prompt「fan-out pre-v5.0.0 第 2 波：E461、E462」，2026-11-25）：兩張都要在 v5.0.0 tag 之前落地（人類 2026-11-25 裁定）。票面以 `docs/backlog.md` 的 E461、E462 列為準，含 2026-11-25 複核更正，以及整合者在第 1 波併進 E462 的 (6)(7)；佇列 `docs/v4.0.0-new-tickets.md` 第 272、273 號列。第 1 波（`specs/fanout-pre-v5-w1.md`，PR #185，merge `166a460`）已合進 `main`，`fanout.mjs handoff --check` exit 0（0 DIFF、3 MOVED）。

## 派工前核對（整合者，2026-11-25，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `166a460`、工作樹乾淨；`feat/e461-*`、`feat/e462-*`、`integ/pre-v5-w2` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0`（PASS，code-reviewer），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`（`allowSchemaChange`、`allowDesignArmed` 預設 false）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- `tsconfig.json` 沒有 `removeComments`：只改註解也會改到 tracked 的 `dist/`，所以 `dist/**` 列進改原始碼那條 lane 的擁有欄（第 1 波三條 lane 都因漏列 `dist/` 而越界）。
- 行號一律在 `166a460` 重新核對過；票面行號因第 1 波漂移，下面寫的是 `166a460` 的位置（約略，lane PM 以實際內容為準）。

### 兩張票的檔案面（在 `166a460` 核對）
- **E462（原始碼註解、措辭、一處報告字串與一處報告標題）**：
  - (1) `gates/registry.ts` 第 303–304 行（「code-reviewer on a test-first feature」「qa-engineer write」）、約第 594 行；`tools/transitions.ts` 第 93、106、113 行（「pm → {architect,sr-engineer}」）、第 401 行（「either chain path」）；`gates/expected-red.ts` 第 38 行（「test-first ticket」）；漏列處 `tools/registry.ts` 第 358 行、`schema/migrations-handoff.ts` 第 202 行。
  - (2) `tools/handoff-orchestrator.ts` 第 238、1433 行的 `parsed.resume_of === "code-reviewer" ? …` 三元式（`handleUpdateState` 有 export，直接呼叫可略過 zod——拿掉前要顧到）。
  - (3) `tools/handoff-orchestrator.ts` 第 766 行寫死 `qa_reports/`；`gates/qa-review.ts` 第 169 行伺服器寫入的報告標題 `# QA review — <id>`（code-reviewer 報告也用它；改標題不得讓舊報告讀不到——`tools/`、`gates/` 目前沒有任何程式讀這個標題，只有這一處寫）。
  - (4) `gates/visual.ts` 第 118–165 行 `parseDesignMode`：`mode: N/A` 回報 `n`（token regex 在 `/` 停）；改成回報原始宣告並加提示「沒有設計來源就寫 `no-design`」。人類裁定：`none`、`n/a`、`tbd` 不算 no-design，照舊啟動視覺檢查。訊息出口在 `tools/handoff-orchestrator.ts` 第 866、930 行（`mode=${armCheck.mode}`），提示文字若放 `gates/registry.ts` 的 hint 也在本 lane。
  - (5) `content/skill-spec-workshop.md` 第 20 行（step 4）重複的 supersede 規則、step 5 完成條件沒排除未解的 `needs prototype` 問題。
  - (6) `tools/handoff-orchestrator.ts` 約第 1044 行、`tools/handoff-types.ts` 約第 160 行、`gates/expected-red.ts` 約第 13 行的舊 build-entry 註解。
  - (7) `docs/migration-v5.md` 補兩句：`MISSING_REVIEW_EVIDENCE` 只在 file mode 檢查；舊伺服器把判決標題黏在行尾（報告沒有結尾換行）的報告，升級後不再被當成判決，drift 與 lane-status 不再承認那些 id，直到標題自成一行。
- **E461（只改測試）**：
  - (1)(8) `test/e433-test-first-rules.test.mjs`：AC1/AC3/AC4 改成抓「肯定句把 `qa-engineer` 和 PASS／`tw_complete_task`／`completed_tasks` 配在一起」，並涵蓋 qa SOP step 7 `next_role`、sr 退回列的 status；拿掉第 561 行 `CLAUDE.md` 250 行的常駐釘點。
  - (2) `sr_return` 計數（`computeSrReturnCount`、`tools/handoff-parse.ts` 約第 692 行的 heal write-back、`tools/handoff-orchestrator.ts` 的 next_role lookahead）：新測試。
  - (3) 設計 mode（`gates/visual.ts` 的 `KNOWN_MODES` 含 `prototype`、多個未知 token 時回報第一個）：新測試——**與 E462 (4) 同一個函式、同一個測試檔，見下方改劃**。
  - (4) SQLite RAG 在 judge PASS 時清 chunk：新測試（要 SQLite binding）。
  - (5)(9b) `test/e435-remove-old-path.test.mjs`：AC4 要在 v16→v17 只改版本號時失敗；第 293 行一帶 AC9 沒 binding 時的 skip。
  - (6) `test/e419-retired-write-mechanisms.test.mjs` 第 117–141 行：走到完整 drift 報告、邊界測試不把任何 throw 都算拒絕。
  - (7) `test/e422-ticket-file.test.mjs`：README 大小寫用 `.md` 過濾器不會先丟掉的名字；禁用欄位名的單字邊界（`rounding` → unknown）。
  - (9a) `scripts/smoke-qa-flow.mjs` 第 112–113 行：只接受 code-reviewer 才是 judge 的那個拒絕，不接受任何提到 code-reviewer 的失敗。

### 兩張票的耦合（決定分組的事實）
- **E461 (3) 與 E462 (4) 改的是同一件事**：E462 (4) 改 `parseDesignMode` 對未知 token 的回報；E461 (3) 要釘的正是「多個未知 token 時回報哪一個」以及 `prototype` 只在前綴／混合輸入時才看得出差別的回報字串。現有的 `test/e423-spec-workshop.test.mjs` AC16（`mockup`、`code`、40 字截斷）、AC17（`mode=mockup`）也釘這些回報字串，E462 (4) 必定打紅它們。E461 (3) 若留在 E461 那條 lane，會照舊回報格式寫測試，合併時和 E462 (4) 互相打紅。結論：**E461 (3) 改劃給 e462**（拆票，需人類核准）。
- 其餘沒有重疊：E461 只改 `test/` 與 `scripts/smoke-qa-flow.mjs`，E462 只改原始碼、`content/skill-spec-workshop.md`、`docs/migration-v5.md` 與它打紅的測試。

### 讀對方檔案文字的測試（跨 lane 的部分）
| 被讀的檔 | 讀它的測試 | 檢查什麼 | 歸誰、怎麼保持綠 |
|---|---|---|---|
| `gates/registry.ts` 的 errorCode → doc-file 對照註解（第 75 行起） | `test/e433-test-first-rules.test.mjs` 第 480 行起（e461）、`test/e431-*` 第 800 行起、`test/e434-*`、`test/error-code-contract.test.mjs` | 對照列 = content 裡反引號引用該錯誤碼的檔 | e462 不動對照註解；`content/skill-spec-workshop.md` 不新增、不刪除反引號引用的錯誤碼 |
| `tools/transitions.ts` 第 397–405 行 HOP_CAP 註解 | `test/e431-test-first-server-path.test.mjs` 第 816–823 行（e462） | 含 `independent brake`、`before or after any round cap`，不含「round caps always」 | e462 改第 401 行時保留這兩個片語；紅了自己修（e431 歸 e462） |
| `tools/transitions.ts` 第 393 行註解 | `test/e453-served-text-v5.test.mjs` 第 318 行 `tr.comment394`（e462） | 逐字 | e462 不改第 393 行 |
| `tools/transitions.ts` 第 158 行遷移提示字串 | `test/e435-*`（e461）、`test/e431-*`、`test/qa-flow.test.mjs`、`test/e151-*`、`test/e32-e33-*` | 逐字 | 本波沒有 lane 改這行 |
| `tools/`、`gates/`、`schema/`、`content/` 全部原始碼 | `test/e435-remove-old-path.test.mjs` AC4（e461） | 除 `schema/migrations-handoff.ts` 外不得出現 `chain_path` | e462 改寫註解時不寫 `chain_path` |
| `docs/migration-v5.md` | `test/e435-*` AC8（e461）、`test/e453-served-text-v5.test.mjs` 第 267–361 行（e462）、`test/e431-*`、`test/qa-flow.test.mjs` | AC8 覆蓋面；e453 逐段比對 | e462 只新增兩句、不刪既有段落；e453 那幾段紅了 e462 自己重釘 |
| `content/const-06-chain-31-head.md`、`content/skill-qa-engineer.md`、`content/skill-sr-engineer.md` | E461 (1) 的新斷言（e461） | 肯定句配對 | e462 不改這三檔；E461 (1) 若在現行文字上找到真的違規句 → 寄信給整合者（content 歸 e462，或排新票） |
| `tools/handoff-orchestrator.ts`、`tools/handoff-parse.ts` | E461 (2) 的新測試（e461） | 行為 | E461 測行為、不讀 e462 擁有檔的原始碼文字；e462 不改行為 |

### 預估只因本 lane 而紅的測試（literal 與 regex 寫法都搜過；完整清單由各 lane PM probe 用完整套件列出）
- **e462 確定會紅**：`test/e161-qa-suite-result.test.mjs` 第 136 行、`test/e236-rejected-write-evidence.test.mjs` 第 232 行、`test/qa-flow.test.mjs` 第 645 行（報告標題 regex）；`test/e423-spec-workshop.test.mjs` AC16、AC17（mode 回報）；`test/e453-served-text-v5.test.mjs`（若 (7) 落在它逐段比對的段落）。
- **e462 可能會紅**（probe 確認）：`test/context-budget.test.mjs`、`test/e445-spec-workshop-questioning.test.mjs`、`test/skill-frontmatter.test.mjs`（spec-workshop SOP）；`test/visual-gate-e2e.test.mjs`、`test/source-credibility-gate.test.mjs`、`test/baseline-manifest-gate.test.mjs`、`test/pixel-gate-attestation.test.mjs`、`test/pixel-perfect-visual-compare.test.mjs`、`test/repro-first-gate.test.mjs`、`test/agc-adapters.test.mjs`（`mode=` 訊息）；`test/e154-multi-covers.test.mjs`、`test/e150-*`、`test/e18-write-provenance.test.mjs`、`test/e247-*`、`test/e32-e33-*`、`test/e35-pipeline-order.test.mjs`、`test/e380-*`、`test/e432-*`、`test/e448-*`、`test/error-code-contract.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`（第 766 行訊息若改字）；`test/e431-*`（HOP_CAP 註解）；以標題字串當 fixture 的 `test/covering-evidence.test.mjs`、`test/e108-eject.test.mjs`、`test/e177b-*`、`test/e250-*`、`test/e434-*`、`test/e451-*`、`test/e452-*`、`test/e459-*`、`test/qa-review-scoped-append.test.mjs`（只有斷言輸出標題的才會紅）。
- **e461**：預期 0 個（只加強測試；新測試在 base 上必須是綠的，在對應突變下必須紅）。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e462 | E462＋E461 (3) | feat/e462-stale-comments-wording | ../agent-governance-mcp-lanes/e462 | `gates/registry.ts`（只限註解與 hint 文字）、`gates/expected-red.ts`（只限註解）、`gates/qa-review.ts`、`gates/visual.ts`、`tools/transitions.ts`（只限註解，第 158 行提示字串與第 393 行除外）、`tools/handoff-orchestrator.ts`、`tools/handoff-types.ts`（只限註解）、`tools/registry.ts`（只限註解）、`schema/migrations-handoff.ts`（只限註解）、`content/skill-spec-workshop.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/migration-v5.md`、`dist/**`、`test/e423-spec-workshop.test.mjs`、`test/e161-qa-suite-result.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/qa-flow.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/e445-spec-workshop-questioning.test.mjs`、`test/e431-test-first-server-path.test.mjs`、`test/e462-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e462-*.md`、`.current/e462/**`、`qa_reports/`、`review_reports/` | e461 擁有的全部；其他 `content/**`；`prompts/**`、`templates/**`、`bin/**`、`scripts/**`、`lib/**`、`guards/**`；`tools/**`、`gates/**`、`schema/**` 除上列各檔；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json`、其他 `docs/**`；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md` | 做：E462 (1)–(7) 依複核更正（(1) 含漏列的 `tools/registry.ts`、`gates/registry.ts`、`schema/migrations-handoff.ts` 三處；(2) 拿掉三元式但顧到不經 zod 的直接呼叫；(3) 訊息改用 `resolveJudgeReport().dir`、報告標題改成不只屬 QA 的說法且舊標題的報告照舊可讀；(4) 回報原始宣告加 `no-design` 提示，`none`／`n/a`／`tbd` 照舊啟動視覺檢查；(5) step 4 去重、step 5 排除未解的 `needs prototype`；(6) 三處舊 build-entry 註解；(7) 遷移指南兩句）；E461 (3)：`prototype` 在 `KNOWN_MODES` 裡（用前綴或混合候選的輸入才看得出來）、多個未知 token 時回報第一個——照 E462 (4) 改後的回報格式寫；打紅的測試重釘；golden 與預算以本 lane 為準。不做：任何判定行為（啟動條件、gate 數 33、pipeline 17 步、錯誤碼）；`gates/registry.ts` 的 errorCode → doc-file 對照註解；HOP_CAP 註解的 `independent brake`／`before or after any round cap` 片語；`chain_path` 字樣；E461 其他各項 | 無 |
| e461 | E461（(3) 除外） | feat/e461-mutation-test-gaps | ../agent-governance-mcp-lanes/e461 | `test/e433-test-first-rules.test.mjs`、`test/e435-remove-old-path.test.mjs`、`test/e419-retired-write-mechanisms.test.mjs`、`test/e422-*.test.mjs`、`test/handoff-migration.test.mjs`（只在 cut 寫明時）、`test/rag-lifecycle.test.mjs`（只在 cut 寫明時）、`scripts/smoke-qa-flow.mjs`、`test/e461-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e461-*.md`、`.current/e461/**`、`qa_reports/`、`review_reports/` | e462 擁有的全部；`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；`dist/**`；所有原始碼（`tools/**`、`gates/**`、`schema/**`、`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`guards/**`、`index.ts`）；`scripts/**` 除 `scripts/smoke-qa-flow.mjs`；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json`、`docs/**`；`specs/fanout-*.md` | 做：E461 (1)(2)(4)–(9) 依複核更正（(1) 肯定句配對規則，涵蓋 qa SOP step 7 `next_role` 與 sr 退回列 status，前半「const-06 插句沒人抓」已被 golden 抓到、真正的缺口是 AC1 關鍵字過濾；(2) 四個突變各一個測試；(4) 觸發改回 qa-engineer 要紅；(5) v16→v17 只改版本號要紅；(6) 走完整 drift 報告、邊界測試只認那個拒絕；(7) 兩項；(8) 拿掉 `CLAUDE.md` 行數釘點；(9) smoke 只認 judge 拒絕、AC9 skip 帶理由維持可見）；每個新測試在 base 上綠、在票面突變下紅，qa 報告逐項記下突變與結果。不做：E461 (3)（歸 e462）；任何原始碼、content、文件；讀 e462 擁有檔原始碼文字的斷言 | 無 |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **E461 拆成兩半（人類 2026-11-25 核准）**：(3) 歸 e462，因為它釘的回報字串正是 E462 (4) 要改的；其餘歸 e461。E461 的 done-mark 在兩條 lane 都合併後由整合者寫（第 1 波 E458 的前例）。
- **共用生成物整組歸 e462**：`content/skill-spec-workshop.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`。e461 不碰 compose bundle；E461 (1) 若必須改 content → 寄信給整合者。
- **`dist/**` 整組歸 e462**：本波只有 e462 改 `.ts`；e461 只改測試與 `scripts/smoke-qa-flow.mjs`（不經 `tsc`）。
- **`test/e431-test-first-server-path.test.mjs` 歸 e462**：它讀 e462 要改的 HOP_CAP 註解；E461 (2) 的 `sr_return` 新測試寫在 `test/e461-*.test.mjs`，不寫進 e431。
- **`test/e433-*`、`test/e435-*` 歸 e461**：e462 不改它們讀的東西（對照註解、第 158 行提示字串、`chain_path` 禁令、遷移指南既有段落）；e462 PM probe 若打紅它們 → 寄信給整合者。
- **`CLAUDE.md` 不動**：沒有 lane 新增 `tools/*.ts`；E461 (8) 只拿掉測試裡的行數釘點。
- **常設規則：無主紅檔直接劃給該 lane（人類 2026-11-25 採用）**：只因某條 lane 的改動而紅、且沒有其他 lane 擁有的測試檔，整合者在 cut 預審時核對（在 base 上綠、在該 lane 的改動下紅、不在任何 lane 的擁有欄）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。跨 lane 的改劃（紅檔已有別條 lane 擁有）仍由人類在整合者 session 裁定。

### 交給 lane 的 PM（寫進 cut；整合者預審 `close` 後依 manifest tier 自動核准）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。兩條 lane 都不走 architect。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **e461 是純測試票**：sr-engineer 確認沒有要實作的東西即交給 code-reviewer。新測試在 base 上就是綠的，所以 expected-red manifest 列零項（交接檢查只看檔案存在）；cut 寫明這一點。每個 AC 的證明 = 在暫存複本套用票面突變後該測試紅、還原後綠；code-reviewer 的 AC Execution Log 至少重跑每項一次突變。突變只在暫存複本做，不得 commit。
- **e462 有四項行為面的小改（(2)(3)(4) 與 E461 (3) 的測試）**：其餘是註解與措辭。(3) 的報告標題若 PM 判為 evidence schema 變更（要升 `evidence_schema`），cut 停下來在 lane session 呈人類（`allowSchemaChange` 為 false），這是預期結果；預設做法是只改新寫入的標題、讀取端本來就不讀標題，不升 schema。
- **只有實作完才擷取得到的快照**（e462 的 golden 與預算上限，若 `content/skill-spec-workshop.md` 的改動打紅它們）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表已列的還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新訊息、新 hint、新報告標題都寫進 cut 的 Copy / Strings。hint 與 SOP 文字不得引用只在本 repo 存在的路徑或裸票號（`content/**` 隨套件發給每個 adopter）。
- qa 寫的測試要讀 base 樹原始碼比對時，擷取當下就讀進記憶體（Node 20 上暫存目錄事後再讀會 ENOENT）；不能用 `git show` 讀 base 樹（T-E77-02 的 meta-test 會擋）。CI 跑 Node 20 與 22；E461 (4) 要 SQLite binding，沒有 binding 時 skip 要帶理由。
- `dist/` 是 tracked 建置產物：改 `.ts` 的 commit 一併 commit `npm run build` 的輸出。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e462`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 舊鏈註解（E462 (1)、(6) 共十一處）改成現行 v5 鏈的說法；errorCode 對照註解、第 158 行提示字串、HOP_CAP 片語不變 | e462（E462 (1)(6)） | ✓ |
| `resume_of` 三元式拿掉，直接呼叫 `handleUpdateState` 時行為不變 | e462（E462 (2)） | ✓ |
| 完成證據訊息用 judge 報告目錄；伺服器寫入的報告標題不再只說 QA，舊標題報告照舊可讀；e161、e236、qa-flow 重釘 | e462（E462 (3)） | ✓ |
| `mode: N/A` 回報原始宣告並提示 `no-design`；`none`／`n/a`／`tbd` 照舊啟動視覺檢查；e423 AC16/AC17 重釘 | e462（E462 (4)） | ✓ |
| `skill-spec-workshop` step 4 不重複、step 5 排除未解的 `needs prototype`；golden／預算若變則重擷取 | e462（E462 (5)） | ✓ |
| `docs/migration-v5.md` 兩句（file-mode only 的 `MISSING_REVIEW_EVIDENCE`；黏在行尾的舊判決標題升級後不被承認） | e462（E462 (7)） | ✓ |
| `prototype` 移出 `KNOWN_MODES`、改成回報最後一個未知 token，各有測試會紅 | e462（E461 (3)） | ✓ |
| E461 (1)(2)(4)–(9) 每個突變都有測試會紅；`CLAUDE.md` 行數釘點拿掉；smoke 只認 judge 拒絕 | e461（E461） | ✓ |
| 合併後 `npm run build` 的 `dist/` commit、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E461、E462 done-mark（not yet released：隨 v5.0.0 發出）；佇列第 272、273 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 commit `dist/`；golden 與預算以 e462 為準，合併後重跑確認。
- 合併並建置後重啟 primary 的 MCP server（e462 改了 server 程式）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 接線票：無。
- 不發版。13 張 pre-v5 票至此全部落地；`release-cd-v5.0.0` 的發版驗證（PASS @ `bb28ef6`，只涵蓋九張）要重做並更新 CHANGELOG——列進待人類決定。

## 合併順序
1. `integ/pre-v5-w2` 自當時的 `main` 開。
2. ← `--no-ff` e462（共用生成物與 `dist/` lane 先）→ merge-invariants。
3. ← `--no-ff` e461 → merge-invariants。
4. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish e462`、`finish e461`（`--shipped --base integ/pre-v5-w2`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/pre-v5-w2`。不發版。

## Dispatch pins
- e462：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-25 核准）。
- e461：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-25 核准）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-25 | 人類 | fan-out pre-v5.0.0 第 2 波：E461、E462，兩張都要在 v5.0.0 tag 之前落地 | 整合者 session（integrator prompt「fan-out pre-v5.0.0 第 2 波：E461、E462」）；`docs/backlog.md` E461、E462 列 |
| 2026-11-25 | 整合者 | Stage 1：兩條 lane——e462（E462 全部＋E461 (3)，含共用生成物與 `dist/**`）、e461（E461 其餘，只改測試與 `scripts/smoke-qa-flow.mjs`）；E461 (3) 改劃待人類核准；合併順序 e462 → e461 | 本檔 |
| 2026-11-25 | 人類 | 核准本清單：Q1 E461 (3) 改劃給 e462、其餘照清單；Q2 兩條 lane 的 pm、qa-engineer、sr-engineer、code-reviewer 全部 pin opus，不走 architect；Q3 保留 `cutApprovalAutoTier.manifest: true`，沒有 lane 要在 lane session 看 cut（Lanes 表不設 `approval` 欄），cut 在整合者預審 `close` 後依憲法 §3.1 manifest tier 自動核准，條件不成立時照舊停下來呈人類；Q4 採用常設規則「只因本 lane 而紅、無主的測試檔由整合者核對後直接劃給該 lane」 | 整合者 session（「核准，Q1–Q4 都照建議」） |
| 2026-11-25 | 整合者 | 清單 PR #186 合進 `main`（merge `83ca8c0`，CI run 45586604759 綠），派工 base = `83ca8c0`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、兩條 lane 的 branch 都不存在、prompt 點名的路徑都在、`cutApprovalAutoTier.manifest` 為 true）；建 `_mailbox/{e462,e461}/`、開信箱監看（baseline 全 0）與 lane-status 監看、render 兩段 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-25 | 整合者 | e461 cut 預審（to-integrator#1，spec @ `773c366`）：PM 發現 `scripts/smoke-qa-flow.mjs` 在 base 上就失敗（最後一項被 `MISSING_REVIEW_EVIDENCE` 擋下，11/12、exit 1；第 1 波 e448 重新啟動審查證據檢查後留下的缺口）。整合者決定併進 E461、在 e461 修（同一檔、不另開票），加 AC18（to-lane#1）；修訂 cut（to-integrator#2，spec @ `d44ea3a`）`close`（to-lane#2），依 manifest tier 自動核准 | e461 信箱 to-integrator#1–#2、to-lane#1–#2 |
| 2026-11-25 | 整合者 | e462 cut 預審（to-integrator#1，spec @ `e8736ba`）：要求拆開碰 7 個檔的 T-E462-03（`task_size` 上限 5 檔）並把 Gate Summary 與 manifest-tier 那一行寫進 spec（to-lane#1）；修訂 cut（to-integrator#2，spec @ `b7acb44`，新增 T-E462-09）`close`（to-lane#2），依 manifest tier 自動核准。報告標題改字判為非 evidence schema 變更（沒有程式讀 H1，`EVIDENCE_SCHEMA_CURRENT` 維持 3） | e462 信箱 to-integrator#1–#2、to-lane#1–#2 |
| 2026-11-25 | 整合者 | e461 lane 報告（to-integrator#6）驗證通過：HEAD `8c1f14e`（7 commits）、worktree 乾淨、`check --base main` 21 檔 0 越界（無 `dist/`、無原始碼）、證據 8/8（`review_reports/review_T-E461-01.md` APPROVED covers T-E461-01..08；`qa_reports/review_T-E461-01..08.md` 最後一筆伺服器 PASS）、無新發現；lane 層 CI run 45597945540 @ `8c1f14e` 綠（Node 20、22；lane 本機 Node 20 的 SQLite binding 失敗確認是環境）；review 退回 0、hop 4/14；`close`（to-lane#3） | e461 信箱 to-integrator#6 |
| 2026-11-25 | 人類 | e462 第一次 lane 報告（to-integrator#6，HEAD `4620ebc`，lane 層 CI run 45600784645 綠）之後，reviewer 列為 optional／recommended 的三項也要在 e462 修：`tools/handoff-orchestrator.ts` completion-evidence 註解的 QA 說法、`gates/visual.ts` source-credibility 註解的舊 build-entry 邊、`gates/expected-red.ts` 標頭註解換行（`agc check` 註解長度提醒）。整合者轉成 AC9 送回 e462（to-lane#3、#4），只限註解 | 整合者 session（「那兩處舊註解也順手修掉」「expected-red 那項也一起修」） |
| 2026-11-25 | 整合者 | e462 AC9 修訂 cut（to-integrator#7，spec @ `db08c85`，T-E462-10 qa、T-E462-11 sr）`close`（to-lane#5），依 manifest tier 自動核准。e462 lane 報告（to-integrator#8，取代 #6）驗證通過：HEAD `2c469cf`（22 commits）、worktree 乾淨、build 後 `dist/` 無差異、`check --base main` 56 檔 0 越界、證據 11/11（`review_reports/review_T-E462-01.md` covers 01..09、`review_reports/review_T-E462-10.md` covers 10..11，皆 APPROVED；`qa_reports/review_T-E462-01..11.md` 最後一筆伺服器 PASS）、共用生成物（golden、context-budget）未動、無新發現；lane 層 CI run 45605086872 @ `2c469cf` 綠；review 退回 0、hop 8/14；`close`（to-lane#6） | e462 信箱 to-integrator#8 |
| 2026-11-25 | 整合者 | 整合：`integ/pre-v5-w2` 自 `main` @ `83ca8c0` 開出，依序 `--no-ff` 合 e462（merge `80e5ec5`）、e461（merge `fc9bd93`），兩次皆零衝突、無實質解衝突，merge-invariants 每次 PASS；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33、pipeline 17 步、`EVIDENCE_SCHEMA_CURRENT` 3、`CLAUDE.md` 250 行；整合層 CI run 45605774377 @ `fc9bd93` 綠（Node 20、22） | 本檔 |
