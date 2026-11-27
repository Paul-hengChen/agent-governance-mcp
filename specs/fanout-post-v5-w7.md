# Fan-out: post-v5.0.0 第 7 波（E443a）
base: 46e974d    integration branch: integ/post-v5-w7
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-27。** e443a 以 `--no-ff` 合進 `integ/post-v5-w7`（merge `755c08c`，零衝突），merge-invariants PASS；派工 base `990084f`（清單 PR #206）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17（`gates/`、`tools/handoff-orchestrator.ts` 無差異，`test/e35-pipeline-order.test.mjs` 8/8）、`check:bookkeeping` exit 0。lane 層 CI：e443a run 45952928486 @ `0b72c81` 綠。Roll-up：e443a 5 個 task、hop 4/14、review 退回 0、證據 5/5。E443a done-mark（not yet released）；E443b 留待下一波。例外：無。本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-27；候選照佇列順序 E443（第 255 號列）、E420（第 256 號列），整合者提五題，人類答「approve」）：E443 拆成 E443a、E443b 兩張、分兩波；本波只有一條 lane e443a 做 E443a；E443b 下一波；E420 本波不列。票面以 `specs/ticket-cut-e443.md`（Stage 0 切票檔，與本清單一起核准）的 NEW-1（E443a）為準，`docs/backlog.md` 的 E443a 列由整合者照切票檔寫入。本波不發版。

## 派工前核對（整合者，2026-11-27，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `46e974d`（PR #205 合併後），工作樹除本清單與切票檔外乾淨；`feat/e443a-*`、`integ/post-v5-w7` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的；`agc check` exit 0。primary handoff 停在 `release-cd-v5.0.0-r2`（v5.0.0 已發版）；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w6.md` exit 0（5 項事實、0 DIFF、3 MOVED，皆為 PR #205 合併所致）。
- 相依：E443a 不依賴其他票；E443 的相依 E422（票檔）、E425（批次 lane）、排序前一張 E428 都已 DONE。

### 為什麼 E420 不列
- 新鏈上結案的 design-armed feature 仍為 0：E434 於 2026-11-23 合進後，各 adopter workspace 都沒有新的 design 檔；唯一有新結案的 adopter 在 11-23 到 11-25 結了 7 個 feature，皆無 design 檔；這段期間唯一一次視覺族錯誤碼（11-23 的 `VISUAL_EVIDENCE_MISSING`，`agent_id` = qa-engineer）是舊鏈的寫法、該 feature 也沒有 design 檔；其餘 adopter 的 stamp 停在 v3.48、v3.93、v4.2.0（舊鏈）；本 repo 沒有 `design/`。

### 為什麼 E443 的補驗項不擋切票
- Phase 0 的關卡是四項可行性，四項都有結論（`specs/e443-phase0-host-check.md`）。剩下的「主 session 接續後是否照 Crash-Resume 重派中斷的 subagent、pin 是否保留」，官方文件寫明由 SOP 決定，而那條 SOP 正是 E443b 要寫的 coord-03 句——它是上線後的觀察項（人類裁定 R5），不是驗收條件，列在「整合後」段。

### 為什麼拆兩張、分兩波
- 人類裁定 R1（本 session）。兩張都要改 `content/skill-integrator.md`，E443b 又要讀 E443a 的 `波次`／`相依` 欄與批次 `render`，本來就無法平行；只用一個帳號，平行也省不了額度。拆開後各有自己的 hop 上限與審查輪數。

### 和 E447（第 6 波）交集的核對
- 沒有 git 衝突（E447 已在 `main`，lane 從派工 base 開）。E447 動過的 `tools/fanout-manifest.ts`（`check --cut` 的 MANIFEST_CHANGED 逐 byte 比對）、`content/skill-integrator.md`（Stage 1 第 3 步 `knowledge: local` 規則）在本 lane 的擁有欄內；cut 以 E447 之後的文字為準。
- `content/skill-integrator.md` 不在任何 compose golden 內（goldens 只出現 `skill-integrator` 這個名稱，不含該 SOP 內文），`test/context-budget.test.mjs` 沒有它的上限——兩項都 grep 查過。本 lane 不動共用生成物；會動 coord-03 golden 與預算的是 E443b。
- E447 剛重釘過的 `test/e178a-integrator-role.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e447-served-text.test.mjs` 讀 skill-integrator 的 Stage 1／Stage 2 段，列進擁有欄。

### Probe（整合者，literal 與 regex grep `test/`，沒跑——沒有 diff；完整清單由 lane 的 PM 用完整套件列出）
| 被讀的檔 | 讀它的測試檔數 | 歸屬 |
|---|---|---|
| `content/skill-integrator.md` | 29 | e443a；下表「可能 re-pin」逐檔進擁有欄 |
| `scripts/fanout.mjs`／`tools/fanout-manifest.ts` | 38 | e443a；Lanes 表讀者逐檔進擁有欄；手動 render 讀者進禁止欄 |

| 測試檔 | 釘什麼 | 本 lane 改動下會紅？ | 歸屬 |
|---|---|---|---|
| `test/e423-spec-workshop.test.mjs` | Stage 2 *Wave table approved in `spec-workshop`* 段（裁定 16 要改寫） | 很可能 | 擁有 |
| `test/e178a-integrator-role.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e428-tracker-mirror.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/skill-frontmatter.test.mjs` | 讀 Stage 2 段／spec-workshop 字樣、反引號錯誤碼集合、行數或計數 | 可能 | 擁有 |
| `test/e447-served-text.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e410-task-alias-content-tail.test.mjs` | Stage 1 各步原文（本 lane 在 Stage 1 加「從波次表填 `波次`／`相依`」） | 可能 | 擁有 |
| `test/e246-mailbox-teardown.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs` | skill-integrator 行號或計數 | 可能 | 擁有 |
| `test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e284-fanout-handoff.test.mjs`、`test/e292-external-deps-validate.test.mjs`、`test/e316-cut-heading-variants.test.mjs`、`test/e322-owners.test.mjs`、`test/e337-subitem-order.test.mjs`、`test/e338-backtick-glob.test.mjs`、`test/e381-owned-clause-tokens.test.mjs`、`test/e390-check-recorded-base.test.mjs`、`test/e425-stop-ticket-batch.test.mjs`、`test/e447-cut-reseed.test.mjs`、`test/e447-mode-off.test.mjs` | Lanes 表 parse／validate 的欄位與錯誤訊息 | 不應該（沒有 `波次` 欄時照舊 parse，A1-3）；紅了先查是否違反 A1-3 | 擁有 |
| `test/fixtures/e177a/render-e177a.golden.txt`、`test/e289-render-addendum.test.mjs`、`test/e343-render-pointer-guard.test.mjs`、`test/render-structure.test.mjs`、`test/e376-render-omits-tier.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e294-lane-enterworktree.test.mjs` | 手動 render 的輸出 | 不得紅（A1-12：手動 render 與本票之前逐 byte 相同） | **禁止** |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e443a | E443a | feat/e443a-manifest-waves | ../agent-governance-mcp-lanes/e443a | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.js`、`dist/tools/fanout-manifest.js.map`、`dist/tools/fanout-manifest.d.ts`、`dist/tools/fanout-manifest.d.ts.map`、`tools/fanout-waves.ts`（新，只在比對拆成獨立模組時）與其 `dist/tools/fanout-waves.*`、`scripts/fanout.mjs`、`content/skill-integrator.md`、`test/e443a-*.test.mjs`（新，qa 定名）、`test/fixtures/e443a/**`（新）、`test/e423-spec-workshop.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e428-tracker-mirror.test.mjs`、`test/e453-served-text-v5.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/e447-served-text.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e410-task-alias-content-tail.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e284-fanout-handoff.test.mjs`、`test/e292-external-deps-validate.test.mjs`、`test/e316-cut-heading-variants.test.mjs`、`test/e322-owners.test.mjs`、`test/e337-subitem-order.test.mjs`、`test/e338-backtick-glob.test.mjs`、`test/e381-owned-clause-tokens.test.mjs`、`test/e390-check-recorded-base.test.mjs`、`test/e425-stop-ticket-batch.test.mjs`、`test/e447-cut-reseed.test.mjs`、`test/e447-mode-off.test.mjs`、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e443a-*.md`、`.current/e443a/**`、`qa_reports/`、`review_reports/` | 手動 render 讀者（`test/fixtures/e177a/render-e177a.golden.txt`、`test/e289-render-addendum.test.mjs`、`test/e343-render-pointer-guard.test.mjs`、`test/render-structure.test.mjs`、`test/e376-render-omits-tier.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e294-lane-enterworktree.test.mjs`）；其他 `content/**`（含 `content/coord-03-core-fallback.md`、`content/const-*.md`）；`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；`tools/config.ts`、`tools/join-precondition.ts`、`tools/ticket-file.ts` 與其他 `.ts` 原始碼（`tools/**` 除上列、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；其他 `dist/**`；`scripts/**` 除 `scripts/fanout.mjs`（含 `scripts/batch-summary.mjs`）；`docs/**`（含 `docs/lane-protocol.md`、`docs/config.md`、`docs/backlog.md`）；`specs/fanout-*.md`、`specs/ticket-cut-e443.md`、`specs/e443-*.md`；`templates/**`；`.github/**`；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：`specs/ticket-cut-e443.md` 的 NEW-1 範圍 1–6 與驗收 A1-1..A1-12，加上本清單 Decisions 記下的人類對切票檔 Q4 的裁定——Lanes 表的 `波次` 欄與只在有 `波次` 時才限制格式的 `相依` 欄，由 `fanout.mjs` 檢查；核准的精簡波次表與清單的比對（裁定 16）及其在 skill-integrator Stage 1／Stage 2 的文字；`render` 的批次模式（第一步改「worktree 已建好，確認位置與 branch」、結尾改停票句、摘要與必讀清單取自票檔）。沒有批次開關時 `render` 輸出與本票之前逐 byte 相同（A1-12，render golden 不重擷取）。既有 56 份 `specs/fanout-*.md` 不遷移、`validate` 結果不變（A1-3）。skill-integrator 不新增反引號錯誤碼、不引用只在本 repo 存在的路徑或裸票號。不做：E443b 的啟動器、設定 key、相依是否滿足的判斷、coord-03、`docs/lane-protocol.md`、`docs/config.md`；`scripts/batch-summary.mjs`；任何 gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- 本波只有一條 lane，不必劃分共用生成物：本 lane 不動 `test/fixtures/compose-golden/**` 與 `test/context-budget.test.mjs`（skill-integrator 不在 golden 內、沒有預算上限），兩者列在禁止欄。
- **手動 render 的讀者列在禁止欄**：A1-12 要求手動 render 與本票之前逐 byte 相同，所以這些測試必須原封不動地綠；任何一個紅了就是違反 A1-12，不是 re-pin 的理由。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。禁止欄點名的檔不適用這條。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **approval** = `human`（人類 Q4）：cut 在 lane session 由人類核准。切票檔預估不走 architect；若 PM 判定要走，Open Questions 先回整合者第二次預審，再呈人類裁定，然後 sr-engineer 才開工。cut 估 hop 數。
- **一個 feature、一次 cut**：寫在一份 `specs/e443a-*.md`，範圍與驗收照 `specs/ticket-cut-e443.md` NEW-1，不重開人類裁定 R1–R5 與切票檔 Q4。
- 切票檔留給 qa 決定的介面細節（`波次` 欄的位置、比對指令的形式、批次開關名稱、票檔查找方式）在 cut 寫定。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者；禁止欄的檔紅了 → 是設計問題，回整合者。
- 新的 SOP 文字與兩句批次 render 文字寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e443a`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內（建議至少拆：欄位與檢查、波次表比對、批次 render、SOP 文字）。
- 禁止 `git commit --amend`（憲法 §6）；收工前 grep 證據檔有沒有絕對路徑。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| Lanes 表 `波次` 欄與受限的 `相依` 欄由 `fanout.mjs` 檢查；既有清單 `validate` 結果不變（A1-1..A1-3） | e443a（E443a） | ✓ |
| 核准波次表與清單的比對：同一組票、核准的相依都保留、擁有檔在票的允許路徑內；通過印 Decisions 理由行、失敗點名原因（A1-4..A1-7） | e443a（E443a） | ✓ |
| skill-integrator Stage 1 從波次表填欄、Stage 2 依比對結果決定是否停（A1-8） | e443a（E443a） | ✓ |
| `render` 批次模式：停票結尾句、摘要與必讀取自票檔、第一步改確認 worktree；手動 render 逐 byte 不變（A1-9..A1-12） | e443a（E443a） | ✓ |
| 合併後 `npm run build` 無多餘 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E443a done-mark（not yet released）；佇列 E443a 列打勾；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 啟動器、設定 key、usage-limit 的 coord-03 句、lane-protocol 與 config 文件 | E443b | ✗（下一波，人類 R1） |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 只有本 lane 擁有的輸出；本 lane 改 `.ts`，merge 後重啟 primary 的 MCP server（補充規則的 post-merge restart）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 上線後觀察（人類 R5，非驗收）：E443b 上線後第一次真的 lane 撞到用量上限時，記錄主 session 自動接續後是否照 Crash-Resume 重派中斷的 subagent、pin 是否保留，寫回 `specs/e443-phase0-host-check.md`。
- 沒有接線票（E443b 是下一波的正式票，不是本波的接線）。不發版。

## 合併順序
1. `integ/post-v5-w7` 自當時的 `main` 開。
2. ← `--no-ff` e443a → merge-invariants。
3. `npm run build`、`check:bookkeeping`、audit；記帳 commit。
4. `finish e443a`（`--shipped --base integ/post-v5-w7`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w7`。不發版。

## Dispatch pins
- e443a：`pm=opus`、`architect=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-27 Q5）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | 第 7 波範圍：只列 E443，E420 不列（新鏈上沒有結案的 design-armed feature）（Q1）；E443 票面兩處改：第 (4) 項 usage-limit 不結束 session、不換模型，自動接續後用同一個 pin 重派一次、再失敗才 checkpoint 停下（R2），第 (6) 項 session 不會因上限結束，依視窗內容標 paused——週上限只標不叫醒、三次後停住等整合者重跑時送新 prompt 叫醒、睡眠後的 Enter 由啟動器自己送（R3）（Q2）；E443 拆成 E443a、E443b 兩張分兩波，本波只做 E443a，由 Stage 0 PM 寫切票檔（R1）（Q3）；`approval` = `human`，Stage 1 仍先 probe 並把可能 re-pin 的測試逐檔寫進擁有欄（Q4）；pm／architect／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q5）。另：`knowledge: local` 下相依須 finish 過、啟動器不寫清單、啟動狀態另存（R4）；Phase 0 剩下的重派補驗是上線後觀察、不擋切票（R5） | 整合者 session（integrator prompt「fan-out 下一波」；答「approve」） |
| 2026-11-27 | 整合者 | Stage 0：派 PM（opus）寫 `specs/ticket-cut-e443.md`——NEW-1（E443a，A1-1..A1-12）、NEW-2（E443b，A2-1..A2-21，依賴 NEW-1）、原票每一項的去向表、票面更正（skill-integrator 不在 golden 內；讀者數 29／30；清單 56 份；E443b 要加 `docs/config.md` 與 `CLAUDE.md`），及 needs human ruling Q1–Q4（Q4 屬 E443a，Q1–Q3 屬 E443b） | `specs/ticket-cut-e443.md` |
| 2026-11-27 | 整合者 | Stage 1：一條 lane e443a；共用生成物本 lane 不動、列禁止；手動 render 讀者 8 檔列禁止（A1-12）；skill-integrator 與 Lanes 表讀者 30 檔逐檔進擁有欄；比對模組 `tools/fanout-waves.ts` 條件式歸 e443a（`CLAUDE.md` 已有 `tools/fanout-*.ts` 的 Layout 列，不動） | 本檔 |
| 2026-11-27 | 人類 | 核准本清單與切票檔 `specs/ticket-cut-e443.md`：一條 lane e443a（E443a，`approval` = `human`，pins 全 opus）；手動 render 讀者 8 檔列禁止；skill-integrator 與 Lanes 表讀者 30 檔逐檔進擁有欄；共用生成物不動；`tools/fanout-waves.ts` 條件式歸 e443a。切票檔 needs human ruling 照建議：Q1 (b) 相依滿足＝branch 在且為起點 ref 的祖先，或 branch 已刪且 primary 有該 lane 的 finish 歷史紀錄（`knowledge: local` 只看後者）；Q2 (a) 啟動器常駐輪詢、lane 信箱的 `type: report` 算完成、不送 `/exit`；Q3 (b) 叫醒用固定一行、開新視窗才送完整 render；Q4 (a) 自動 Decisions 列由整合者在最終報告列在批次摘要旁、不改 `batch-summary.mjs`（Q1–Q3 屬 E443b、寫進其 backlog 列；Q4 屬 E443a） | 整合者 session（「approve」） |
| 2026-11-27 | 整合者 | 清單 PR #206 合進 `main`（merge `990084f`，PR 必要檢查綠），派工 base = `990084f`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e443a-*` 與 `integ/post-v5-w7` 都不存在、`_mailbox/` 原為空、擁有欄點名的既有路徑都在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e443a/`，開信箱監看（baseline e443a=0）與 lane-status 監看，render e443a 的 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-27 | 整合者 | e443a cut 預審（to-integrator#1，spec @ `3021407`）`close`（to-lane#1）：範圍＝切票檔 NEW-1 範圍 1–6 加切票檔 Q4 (a)；5 個 task（qa T-E443A-01；sr 02 波次欄、03 render --batch、04 `waves` 比對與新模組 `tools/fanout-waves.ts`、05 SOP 兩段），A1-1..A1-12 皆有實作 task，每個 sr task 在 `task_size` 內；整合者在 lane 重跑 `check --cut`：18 token、0 越界，唯一 FAIL 為 APPROVAL_HUMAN（預期）；PM probe（base 全套 4842/4844、0 fail）re-pin 4 檔 e423、e428、e292、e296 皆在擁有欄，擁有欄外的 e285、e430 預期原封不動綠；不走 architect、hop 估 4–5；cut 由 lane 呈人類核准 | e443a 信箱 to-integrator#1、to-lane#1 |
| 2026-11-27 | 人類 | 在 e443a 的 session 親手核准 cut（spec @ `3021407`，無選項、無 needs human ruling 項）；coordinator 在 pm tuple 寫入 `cut_approved: true`，派 qa-engineer（opus）做 T-E443A-01。只影響本 lane，寫在核准的 cut 裡 | e443a lane session；`specs/e443a-manifest-waves.md` @ `3021407`、`.current/e443a/handoff.md`（`cut_approved: true`）；e443a 信箱 to-integrator#2 |
| 2026-11-27 | 整合者 | e443a 收工報告（to-integrator#6）核對通過並 `close`（to-lane#2）：`feat/e443a-manifest-waves` @ `0b72c81`（8 commit），`fanout check --base main` 46 檔 0 越界，證據 `review_reports/review_T-E443A-01.md` APPROVED（covers T-E443A-01..05）與 `qa_reports/review_T-E443A-01..05.md` PASS，worktree 重 build 後乾淨，無 pending-tickets，共用生成物未動；lane 層 CI run 45952928486 @ `0b72c81` 綠。sr 的判斷點（非批次 render 用法錯誤訊息隨 USAGE_LINES 換新行）裁判接受；reviewer recommended 兩項（`WAVE_RE`／`LIST_SEPARATOR_RE` 重複定義可改共用；7 個 comment-length advisory）列入結案報告、不開票 | e443a 信箱 to-integrator#6、to-lane#2；CI run 45952928486 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 990084f
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v5-w7 @ 289cb65）
- lane-status：primary（main ← integ/post-v5-w7 @ 289cb65）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，clean
### 已結案
- e443a（E443a）PASS，merge `755c08c`；以本波 PR 合進 `main`。lane 紀錄在 `.current/history/2026-11/e443a/`；沒有未配號的新發現。裁判的 recommended 兩項（`WAVE_RE`／`LIST_SEPARATOR_RE` 重複定義可改共用、7 個 comment-length advisory）記在 Decisions 表，optional 兩項（`fanout-waves.ts` 用字面 `MANIFEST_UNREADABLE`、`--batch` 接受的位置比 spec 寬）列在結案報告，都不開票。
- 上線後觀察（人類 R5，非驗收）：E443b 上線後第一次真的 lane 撞到用量上限時，記錄主 session 自動接續後是否照 Crash-Resume 重派中斷的 subagent、pin 是否保留，寫回 `specs/e443-phase0-host-check.md`。
### 待人類決定
- 要不要發 v5.x：E424、E425、E427、E430、E449、E426、E428、E446、E447、E443a 都已完成，合進 `main` 後尚未發版。
- 下一波要不要開：佇列尚未完成的是 E443b（依賴 E443a，合進 `main` 後即滿足；範圍與切票檔 Q1–Q3 的裁定在 `specs/ticket-cut-e443.md` 與 `docs/backlog.md` 的 E443b 列）與 E420（新鏈上仍沒有結案的 design-armed feature）。
### 進行中的背景工作
無
