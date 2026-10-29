# Fan-out: post-v4 佇列第 12 波（文字同步 lane：E152 + E365 + E371 + E372 ∥ scripts lane：E158 + E369 + E370 ∥ 狀態與 qa 宣稱 lane：E161 + E184 + E366 ∥ 路徑編碼 lane：E367 + E368）
base: b8aaf7d    integration branch: integ/post-v4-w12
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-29。** 四條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w12` merge `3b09c59`（e152）、`eb7e146`（e158）、`2223697`（e161）、`7b06d46`（e367）→ finish 四條（E373–E379 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。E368 依人類裁決 B 延後，由 E379 取代。 `base:` 是規劃基準（第 11 波交接更新 PR #48 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

範圍由人類指定（第 11 波交接「待人類決定」的選項 b）：佇列 P2 段剩下的 E152、E158、E161、E184，加上第 11 波 finish 配號的 E365–E372，共 12 張。依檔案範圍分成四組，四組的擁有集合互不相交：
- (1) 文字同步：E152、E365、E371、E372。都是散文或文件改動，加上釘住那些文字的測試。E152、E365 都改 `content/**`，所以共享生成物只歸這條 lane。
- (2) scripts：E158、E369、E370。E158 稽核 `scripts/` 裡用 commit 範圍推導檢查對象的地方；E369、E370 在 `scripts/test-lock.mjs` 和它的測試上。
- (3) 狀態與 qa 宣稱：E161、E184、E366。三張都在 handoff 的讀寫路徑上（`tools/handoff-orchestrator.ts`、`tools/storage-sqlite.ts`、`tools/handoff-*.ts`）。
- (4) 路徑編碼：E367、E368。都是 E136 單射編碼的後續（`tools/evidence-file.ts`、`tools/lane-status.ts`、三個 gate 的 `active_feature` 路徑）。

## 派工前核對（整合者，2026-10-29，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `b8aaf7d`；工作區乾淨。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`fanout.mjs handoff --check specs/fanout-post-v4-w11.md` exit 0（只有 `main` 前進的 MOVED）。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ 每條 lane 的 cut 都由人類在該 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **不在本波的 P3 票**：E359、E360、E361、E363 不在人類指定的範圍內，留在佇列。
- **E152 的修法只在 SOP**：AC4 是 `content/skill-release-engineer.md` 第 8 步的 shell 檢查，不在 `scripts/verify-release.mjs`。`scripts/verify-release.mjs` 本波歸 e158（E158 的稽核對象），所以 e152 的 cut 若認定修法必須進 `verify-release.mjs`，先停下來寄信，不自己改。票面的三個候選修法裡，「從發版範圍推導 feature 集合」和「範圍內有多個 `specs/` 路徑卻沒有對應分類就大聲拒絕」都可以只寫在 SOP 步驟裡。測試面是 `test/release-staging.test.mjs` 的 AC4 斷言。
- **E365 的範圍**：在 `content/const-08-chain-31-mid.md`（§3.1 的 review_verdict 句）或 `content/const-05-core-standards.md`（Escalation call format）寫出 `NON_REVIEWER_VERDICT_REJECTED`，把 `gates/registry.ts` 該條目的 `documentedInProse` 改成 true，並移除 `(none)` 對照列與相關註解。會被擊中：`test/e308-single-source-tier-enum.test.mjs`（E303-AC11a／AC12，第 11 波 re-pin 過的 `(none)` 次數）、`test/e295-hop-cap-and-sop-halves.test.mjs`（AC11 的 `(none)` 次數）、`test/error-code-contract.test.mjs`、`test/e139-non-reviewer-verdict.test.mjs`，另外 golden 與 context budget 要重新固定。
- **E371、E372 是純文件**：E371 剩下 `docs/lane-protocol.md` §3 的「已知缺口：…E217…」那一句（`docs/install.md` 那半已在第 11 波修好），釘它的是 `test/e351-lane-protocol-gaps.test.mjs`。E372 是 `specs/e260c-bin-scripts.md`（約第 208 行）與 `specs/e351-lane-protocol-gaps.md`（約第 84、91 行）的舊函式名；`specs/e213-*`、`specs/e287-*` 是出貨當時的紀錄，照票面保留舊名。`test/e351-lane-protocol-gaps.test.mjs` 若也釘了 `specs/e351-*` 的字句，一起由 qa 重新固定。
- **E158 的稽核站點（規劃時清點，lane 的 cut 逐一判定）**：
  - `scripts/verify-release.mjs`：`rev-list <tag>..<head>` 與逐 commit 的 `diff-tree`（範圍為空時的行為要看）。
  - `scripts/check-bookkeeping.mjs`：`merge-base HEAD <ref>`，再讀 base 的 `docs/backlog.md`。
  - `scripts/check-version.mjs`：`rev-list -n 1 <tag>`。
  - `tools/fanout-manifest.ts`（`scripts/fanout.mjs check`／`owners` 的實作）：`git diff <base>...<branch>`，只看已 commit 的改動，目前只印一行 note。
  - `tools/lane-status.ts` 的 `log <base>..<branch>`：本波歸 e367，e158 不改；稽核認定要改就記成新發現。
  - `tools/comment-scan.ts`：對工作樹 diff 並另讀 untracked，看起來已是誠實的對象；在 `bin/` 那側，不在本波範圍，稽核只記錄。
  - 判定方式照票面：每個站點決定誠實的對象是範圍、工作樹還是兩者聯集，空對象一律大聲失敗，不得安靜通過。
- **E369、E370 與 e362 同形**：E369 改 `scripts/test-lock.mjs` 的 `acquireLock`，並把 e362 review 的兩條註解建議一起做掉（已併入票面）；E370 是 qa-only，只改 `test/e177b-test-lock.test.mjs` 的 AC9、AC13a 的預算（第 11 波已加 `AGC_E177B_WAIT_MS` 覆寫）。
- **E161 先做設計決定（見 D1）**：票面寫明「結構化欄位或解析散文」是第一個 task，不是 cut 本身。預期有 architect 那一跳。如果選結構化欄位，會動到 `tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/registry.ts`（input schema）、`tools/storage-sqlite.ts`，可能還有 `schema/**`；這些本波都歸 e161。但「qa 要填這個欄位」的 SOP 句子在 `content/**`，本波歸 e152，所以 D1 要決定這半邊怎麼處理。
- **E184 的站點**：`tools/handoff-orchestrator.ts` 的 `handleGetState`。決定是把暫態的 `dispatch_mechanism_tier` 從讀取視圖拿掉，還是標成「上一跳的值」。會被擊中：`test/dispatch-mechanism.test.mjs`、`test/dispatch-log.test.mjs`。
- **E366 的站點**：`tools/handoff-orchestrator.ts` 的 `QA_REVIEW_RECORD` 步驟（SQLite 分支呼叫 `storage.recordReview`）與 `tools/storage-sqlite.ts` 的 `recordReview`。修法比照 E236 的 file 模式回滾（`recordReviewInFileUndoable`），或用 transaction，由 cut 擇一。會被擊中：`test/e236-rejected-write-evidence.test.mjs`、`test/sqlite-versioning.test.mjs`、`test/qa-flow.test.mjs`。
- **E367 的站點**：`tools/lane-status.ts` 的 `passEvidenceIdsIn`（`REVIEW_FILE_RE`）；在 `tools/evidence-file.ts` 的 `encodeEvidenceId` 旁加反函式。測試：`test/e177b-lane-status.test.mjs`、`test/e136-evidence-path-injective.test.mjs`。
- **E368 的站點**：`gates/ac-execution.ts` 的 `specFilePath`、`gates/expected-red.ts` 的 `expectedRedManifestPath`、`gates/visual.ts` 的 `designFilePath`。正規的 feature 名稱（小寫 slug）路徑必須不變，已出貨的 spec／design／manifest 不必搬。`tools/handoff-write.ts` 的歸檔名消毒不在票面，不動。測試：`test/ac-execution.test.mjs`、`test/gates-expected-red.test.mjs`、`test/baseline-manifest-gate.test.mjs`、`test/repro-first-gate.test.mjs`，加上讀 design 檔的 visual 測試。
- **共享生成物**：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` 全部歸 e152。
- **`gates/registry.ts` 歸 e152**（E365 的 `documentedInProse`）。e161 若因 E161 需要新閘門條目，先停下來寄信（見 D1）。
- **schema**：e161 只在 E161 的 cut 選了新的 handoff 欄位、而且依 `docs/schema-versions.md` 需要升版時，才能改 `schema/**`；其他 lane 一律不升版。
- task id：
  - e152 用 `T-E152-NN`／`T-E365-NN`／`T-E371-NN`／`T-E372-NN`。
  - e158 用 `T-E158-NN`／`T-E369-NN`／`T-E370-NN`。
  - e161 用 `T-E161-NN`／`T-E184-NN`／`T-E366-NN`。
  - e367 用 `T-E367-NN`／`T-E368-NN`。
  - 不重用前波 id（E310 的 basename 撞名）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要的話，在測試裡自己建固定清單或 fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。有 architect 那一跳的 lane，architect 的 Open Questions 也要預審。PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`bin/**`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`、`docs/dependency-advisories.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e152 | E152、E365、E371、E372 | feat/e152-release-ac4-and-prose-sync | ../agent-governance-mcp-lanes/e152 | `content/**`、`gates/registry.ts`（只限 `NON_REVIEWER_VERDICT_REJECTED` 條目的 `documentedInProse` 與 `(none)` 對照列及其註解）、`dist/gates/registry.*`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/lane-protocol.md`（只限 §3 的 E217 已知缺口句與 `--abandoned` 收割描述）、`specs/e260c-bin-scripts.md`（只限函式名）、`specs/e351-lane-protocol-gaps.md`（只限函式名）、`test/release-staging.test.mjs`（只限 AC4 斷言）、`test/e308-single-source-tier-enum.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`（只限 `(none)` 次數斷言）、`test/error-code-contract.test.mjs`、`test/e139-non-reviewer-verdict.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、其他釘 `content/**` 字句的 `test/**`（只限被本 lane 改變的字句，cut 裡逐一列名，預審核對）、`test/e152-*.test.mjs`、`test/e365-*.test.mjs`、`test/e371-*.test.mjs`、`test/e372-*.test.mjs`、`specs/e152-*`、`qa_reports/*E152*`、`qa_reports/*E365*`、`qa_reports/*E371*`、`qa_reports/*E372*`、`review_reports/*E152*`、`review_reports/*E365*`、`review_reports/*E371*`、`review_reports/*E372*`、`.current/e152/**` | `scripts/**`（特別是 `scripts/verify-release.mjs`）、`tools/**`、其他 `gates/**`、其他 `dist/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`（特別是 `specs/e213-*`、`specs/e287-*`）、e158、e161、e367 擁有的測試、共同禁止的全部項目 | 做：(1) E152：AC4 判斷多 feature 發版時不再依賴 `pending_notes` 裡的散文約定；沒有那一行的多 feature 發版不得安靜地只驗一個 spec。修法只寫在 `content/skill-release-engineer.md`（從發版範圍推導，或範圍內有多個 spec 卻沒有分類時大聲停下，cut 擇一並寫明理由）。(2) E365：`NON_REVIEWER_VERDICT_REJECTED` 寫進憲法散文（站點由 cut 決定），`documentedInProse` 改 true，移除 `(none)` 對照列；golden 與 context budget 重新固定。(3) E371：`docs/lane-protocol.md` §3 不再把 E217 列為已知缺口，`--abandoned` 的收割描述符合 E217 之後的行為；`test/e351-lane-protocol-gaps.test.mjs` 一起重新固定。(4) E372：`specs/e260c-bin-scripts.md`、`specs/e351-lane-protocol-gaps.md` 改用現行的 `planIgnoredEvidenceHarvest`／`applyIgnoredEvidenceHarvest`，e260c 註明同一 helper 也服務 `--abandoned` 的 `specs/` 複製。硬條件：既有錯誤碼與拒絕條件不變；`gates/registry.ts` 除了該條目之外一行都不改；不升 `schema_version`；`docs/lane-protocol.md` 除了 §3 那兩處之外不改。　不做：E161 的 SOP 句子（見 D1）；`specs/e213-*`、`specs/e287-*`。 | 無 |
| e158 | E158、E369、E370 | feat/e158-range-subject-audit | ../agent-governance-mcp-lanes/e158 | `scripts/**`、`tools/fanout-manifest.ts`（只在 E158 的稽核判定 `fanout check`／`owners` 要改時）、`dist/tools/fanout-manifest.*`（同上）、`test/verify-release.test.mjs`、`test/e299-check-bookkeeping.test.mjs`、`test/check-version.test.mjs`、`test/e331-git-diff-failure.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e177b-test-lock.test.mjs`、`test/e209-test-lock-publish.test.mjs`、`test/e362-reclaim-guard-publish.test.mjs`、其他跑 `scripts/**` 的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）、`test/e158-*.test.mjs`、`test/e369-*.test.mjs`、`test/e370-*.test.mjs`、`specs/e158-*`、`qa_reports/*E158*`、`qa_reports/*E369*`、`qa_reports/*E370*`、`review_reports/*E158*`、`review_reports/*E369*`、`review_reports/*E370*`、`.current/e158/**` | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `tools/**`（特別是 `tools/lane-status.ts`、`tools/comment-scan.ts`）、其他 `dist/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`docs/**`、其他 `.current/**`、其他 `specs/**`、e152、e161、e367 擁有的測試、共同禁止的全部項目 | 做：(1) E158：稽核上面列出的站點與 `scripts/` 裡其他用 commit 範圍推導檢查對象的地方，cut 裡逐站寫明誠實的對象（範圍、工作樹或聯集）；每個保留範圍的站點，在對象為空時大聲失敗，不得安靜通過；qa 為空對象寫測試。(2) E369：`acquireLock` 在 `reclaimStale` 沒有移除目標時，走正常的等待、通知、`--max-wait` 路徑，不再忙轉；同時做掉票面併入的兩條註解建議；qa 寫確定性重現。(3) E370（qa-only）：AC9、AC13a 在全套負載下不再因固定牆鐘或逾時預算而紅；票面建議 AC9 改用 wrapper 自己的時鐘，qa 決定並把理由寫進 qa 報告。硬條件：`test-lock` 的命令列介面與 `-- npm test` 用法不變；E209、E362 的鎖檔與 guard 發佈方式不變；`scripts/verify-release.mjs --ci-check` 的介面與 exit code 語意不變（只能讓空對象從通過變成失敗）；`scripts/mailbox-watch.mjs` 一行都不改。　不做：E363、E238／E254／E278 的其他偶發測試、`tools/lane-status.ts` 與 `tools/comment-scan.ts`（稽核認定要改就記成新發現）。 | 無 |
| e161 | E161、E184、E366 | feat/e161-qa-claim-and-state-reads | ../agent-governance-mcp-lanes/e161 | `tools/handoff-orchestrator.ts`、`tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/registry.ts`（只在 E161 的 cut 需要新欄位時）、`tools/storage.ts`、`tools/storage-sqlite.ts`、`gates/qa-review.ts`（只在 E161 需要時）、`schema/**`（只在 E161 的新欄位依 `docs/schema-versions.md` 需要升版時）、`docs/schema-versions.md`（同上）、`dist/tools/handoff-orchestrator.*`、`dist/tools/handoff-types.*`、`dist/tools/handoff-parse.*`、`dist/tools/handoff-write.*`、`dist/tools/registry.*`、`dist/tools/storage.*`、`dist/tools/storage-sqlite.*`、`dist/gates/qa-review.*`、`dist/schema/**`（同 `schema/**`）、`test/dispatch-mechanism.test.mjs`、`test/dispatch-log.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/sqlite-versioning.test.mjs`、`test/qa-flow.test.mjs`、`test/handoff-versioning.test.mjs`、`test/handoff-migration.test.mjs`（後兩個只在升版時）、其他讀寫 handoff 或 SQLite reports 的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）、`test/e161-*.test.mjs`、`test/e184-*.test.mjs`、`test/e366-*.test.mjs`、`specs/e161-*`、`qa_reports/*E161*`、`qa_reports/*E184*`、`qa_reports/*E366*`、`review_reports/*E161*`、`review_reports/*E184*`、`review_reports/*E366*`、`.current/e161/**` | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`gates/registry.ts`、其他 `gates/**`、`tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/lane-status.ts`、`tools/fanout-manifest.ts`、其他 `tools/**`、其他 `dist/**`、`scripts/**`、`guards/**`、`prompts/**`、`lib/**`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`、e152、e158、e367 擁有的測試、共同禁止的全部項目 | 做：(1) E161：第一個 task 是設計決定（結構化欄位，或解析證據檔裡的宣稱），寫進 spec 並經 architect；決定之後，qa PASS 宣稱的套件數字由伺服器記錄或對照，不再只是散文。依 D1 的裁決處理 SOP 那半。(2) E184：`tw_get_state` 不再把上一跳的 `dispatch_mechanism_tier` 以可照抄的形式呈現（拿掉或明確標成上一跳的值，cut 擇一並寫明理由）。(3) E366：SQLite／HTTP 模式下被拒絕的 qa PASS／FAIL 寫入不留下 reports 列（比照 E236 的回滾，或 transaction，cut 擇一）。硬條件：file 模式 E236 的回滾行為不變；既有錯誤碼與拒絕條件不變，只新增；若需要新閘門條目或改 `content/**`，先停下來寄信（`gates/registry.ts`、共享生成物本波歸 e152）；升版只在 E161 確實需要時，並依 `docs/schema-versions.md` 做 lazy migration。　不做：E359、E361；`tools/evidence-file.ts` 的解析（歸 e367）。 | 無 |
| e367 | E367、E368 | feat/e367-evidence-and-feature-path-encoding | ../agent-governance-mcp-lanes/e367 | `tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/lane-status.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/visual.ts`（只限 `active_feature` 路徑推導）、`dist/tools/evidence-file.*`、`dist/tools/evidence-lookup.*`、`dist/tools/lane-status.*`、`dist/gates/ac-execution.*`、`dist/gates/expected-red.*`、`dist/gates/visual.*`、`test/e177b-lane-status.test.mjs`、`test/e136-evidence-path-injective.test.mjs`、`test/ac-execution.test.mjs`、`test/gates-expected-red.test.mjs`、`test/baseline-manifest-gate.test.mjs`、`test/repro-first-gate.test.mjs`、其他讀 spec／design／expected-red 路徑的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）、`test/e367-*.test.mjs`、`test/e368-*.test.mjs`、`specs/e367-*`、`qa_reports/*E367*`、`qa_reports/*E368*`、`review_reports/*E367*`、`review_reports/*E368*`、`.current/e367/**` | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`gates/registry.ts`、`gates/qa-review.ts`、`gates/code-review.ts`、其他 `gates/**`、`tools/handoff-*.ts`、`tools/storage*.ts`、`tools/fanout-manifest.ts`、其他 `tools/**`、其他 `dist/**`、`scripts/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`docs/**`、其他 `.current/**`、其他 `specs/**`、e152、e158、e161 擁有的測試、共同禁止的全部項目 | 做：(1) E367：在 `tools/evidence-file.ts` 加 `encodeEvidenceId` 的反函式，`tools/lane-status.ts` 讀回 task id 時解碼；非正規 id 的 PASS 證據能被 lane-status 認出。(2) E368：`specFilePath`、`expectedRedManifestPath`、`designFilePath` 對 `active_feature` 是單射，只有大小寫或被消毒字元不同的兩個 feature 名稱不會落到同一個檔案；三處共用一個 helper（可沿用 E136 的編碼）。硬條件：正規 task id（`T-<票>-NN`）與正規 feature 名稱（小寫 slug）的路徑逐字不變，已出貨的檔案不必搬；`..` 的防護不變；SQLite／HTTP 模式行為不變；不升 `schema_version`。　不做：`tools/handoff-write.ts` 的歸檔名消毒；E184。 | 無 |

## 所有權重劃（相對於預設）
- 四條 lane 的擁有集合不相交。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部歸 e152。
- **`gates/registry.ts` 劃給 e152，只限 `NON_REVIEWER_VERDICT_REJECTED` 條目**（E365）。e161 不得改；E161 若需要新閘門，先停下來寄信。
- **`docs/lane-protocol.md` 從共同禁止移出，劃給 e152，只限 §3 的兩處**（E371）。第 11 波它在共同禁止裡。lane 開工時讀的是派工 base 上的版本，lane 內改動不影響其他 lane。
- **`specs/e260c-bin-scripts.md`、`specs/e351-lane-protocol-gaps.md` 劃給 e152，只限函式名**（E372）。
- **`scripts/**` 整個劃給 e158**（E158 稽核、E369）。`scripts/verify-release.mjs` 是整合者的 CI 檢查工具；整合者在 primary 上跑的是 `main` 上的版本，lane 內改動不影響。
- **`tools/fanout-manifest.ts` 劃給 e158，只在 E158 的稽核判定要改時**。
- **`tools/lane-status.ts` 劃給 e367**（E367）。E158 的稽核碰到它的 `log <base>..<branch>` 時只記錄，不改。
- **`tools/evidence-file.ts`、`tools/evidence-lookup.ts` 劃給 e367**；e161 不得改。
- **`schema/**`、`docs/schema-versions.md`、`tools/registry.ts` 只在 E161 需要時劃給 e161**；其他 lane 一律不升版。
- **`bin/**` 回到共同禁止**（第 11 波劃給 e217）。
- **`docs/dependency-advisories.md` 在共同禁止**：本波沒有相依套件的改動。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 多 feature 發版在 `pending_notes` 沒有約定行時，AC4 不會安靜地只驗一個 spec；SOP 的修法有 qa 的測試 | e152（E152） | ✓ |
| `NON_REVIEWER_VERDICT_REJECTED` 寫進憲法散文，`documentedInProse` 為 true，`(none)` 對照列移除；golden 與 context budget 重新固定 | e152（E365） | ✓ |
| `docs/lane-protocol.md` §3 不再把 E217 列為已知缺口，`--abandoned` 描述符合現行行為，釘它的測試一起更新 | e152（E371） | ✓ |
| `specs/e260c-bin-scripts.md`、`specs/e351-lane-protocol-gaps.md` 寫的是現行收割函式名 | e152（E372） | ✓ |
| `scripts/` 裡每個用範圍推導檢查對象的站點都有判定紀錄；保留範圍的站點在對象為空時大聲失敗，有 qa 的空對象測試 | e158（E158） | ✓ |
| `acquireLock` 被 reclaim guard 擋住時不忙轉，`--max-wait` 有效，有 qa 的確定性重現；e362 review 的兩條註解建議做掉 | e158（E369） | ✓ |
| e177b-test-lock 的 AC9、AC13a 在全套負載下不再撞固定預算 | e158（E370） | ✓ |
| E161 的設計決定寫進 spec；qa PASS 的套件數字由伺服器記錄或對照 | e161（E161） | ✓ |
| qa SOP 告訴 qa 怎麼填 E161 的結構化結果（只在 E161 選了結構化欄位時才需要） | 整合者在 5c 立新票（D1 A），排到下一個能動 `content/**` 的波次 | ✗（D1 A，人類同意延後） |
| `tw_get_state` 不再以可照抄的形式呈現上一跳的 `dispatch_mechanism_tier` | e161（E184） | ✓ |
| SQLite／HTTP 模式下被拒絕的 qa 寫入不留下 reports 列，有 qa 的測試 | e161（E366） | ✓ |
| lane-status 認得出非正規 task id 的 PASS 證據 | e367（E367） | ✓ |
| 只有大小寫或被消毒字元不同的兩個 feature 名稱不會解析到同一個 spec／design／manifest；正規名稱路徑不變 | 延後（人類裁決 NHR-1 = B）：與 E368-NEW-1 的寫入端合成一張票，由 finish 配號，排到能動 `content/**` 的波次 | ✗（人類同意延後） |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e152、e158、e161、e367（各自的 qa） | ✓ |
| 12 張票 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e152 → e158 → e161 → e367。每次 merge 後跑 `merge-invariants`；全部合併後重建 `dist/`、跑 `check:bookkeeping`、`npm audit --audit-level=high`，push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback 時跑）。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。
- D1 若裁決為「SOP 那半開新票」，整合者在 5c 立票（完整 backlog 列），排在佇列下一個可動 `content/**` 的波次。

## 合併順序
1. `integ/post-v4-w12` ← `--no-ff` e152（共享生成物 lane 先），再跑 merge-invariants。
2. ← `--no-ff` e158，再跑 merge-invariants。
3. ← `--no-ff` e161，再跑 merge-invariants。
4. ← `--no-ff` e367，再跑 merge-invariants。
5. 重建 `dist/`，跑 `check:bookkeeping`。
6. 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w12`。
7. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
8. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/post-v4-w12`。

預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，一律重建。

## 結案
- 日期 2026-10-29。`integ/post-v4-w12` ← e152 `13a75be`（merge `3b09c59`）← e158 `d794fce`（`eb7e146`）← e161 `6f040e1`（`2223697`）← e367 `4017a3e`（`7b06d46`），皆 `--no-ff`、零衝突 → 無合併審查；每次合併後 merge-invariants PASS；重建 `dist/` 無差異；`check:bookkeeping` OK；`npm audit --audit-level=high` exit 0；整合層 CI run 40845607789 在 `7b06d46` 綠。
- 彙總（上限按 lane 計，合計僅供參考）：e152 7 張 task／hop 6/14／review 退回 1 輪（缺 expected-red 清單）／qa 0 輪；e158 6 張／hop 4/14；e161 8 張（handoff 的 `completed_tasks` 記 4 個，其餘 4 個由 `tw_complete_task` 加 covers 證據完成，lane 已揭露）／hop 5/14；e367 3 張（另 void 3 張 E368 task）／hop 4/14。合計 24 張 task、hop 19；除 e152 的一輪 review 退回外都是 0 輪退回；每條 lane 都在自己的上限內。
- 完成定義：16 項中 14 項成立；兩項依人類裁決延後 —— E161 的 qa SOP 句子（D1 A → E380）、E368（NHR-1 B → E379）。
- 例外：(1) e367 依人類裁決 B 縮小 cut，E368 由 E379 取代。(2) e158 的 sr 在 cut 核准後加了一個大聲失敗（`--base` 無 merge-base 時 exit 2），code review 保留、qa 有 fixture、spec 已寫明。(3) e161 第一次回報的 CI 在 Node 20 紅（`test/e177b-mailbox-watch.test.mjs` AC19/AC15，不在負載敏感清單），依規則不 rerun 而退回；lane 確認無關、記成 E378 後以新 sha 的 CI 綠放行。(4) e161 的 qa 寫 PASS 時預設 `next_role=release-engineer`，整合者去信，lane 沒有派。(5) 四條 lane 的 sr 與 code-reviewer 都是 opus（同模型疑慮，比照第 11 波）。(6) lane 本機全套多次撞到計時偶發（VR-21、VR-22、E254 的 gap-6），CI 都綠。
- 新票：E373–E379 由 `finish --shipped` 配號；E380（D1 A 的 qa SOP 句子）、E381（`check --cut` 把擁有欄說明文字解析成 glob）、E382（test-lock 的 dangling symlink 鎖路徑仍空轉）由整合者立票；E373–E382 排在佇列 #188–#197。
- 發版：`main` 帶 E152／E365／E371／E372（`content/skill-release-engineer.md` AC4、`content/const-08-chain-31-mid.md`、`gates/registry.ts` 的 `documentedInProse`、golden 與 context budget、`docs/lane-protocol.md` §3）、E158／E369／E370（`scripts/verify-release.mjs`、`scripts/check-bookkeeping.mjs`、`scripts/test-lock.mjs`、`tools/fanout-manifest.ts` 的 `RANGE_EMPTY`）、E161／E184／E366（`tw_update_state` 新選填參數 `qa_suite_result`、`tw_get_state` 不再回 `dispatch_mechanism_tier`、SQLite 回滾）、E367（`decodeEvidenceId`）。給發版的注意：`tw_get_state` 少一個鍵與 `check-bookkeeping` 找不到 base 時 exit 2 屬 adopter 可見的行為改動；`GATE_REGISTRY` 仍是 35；不升 schema。是否發版與版號由人類決定。

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ f5485a7
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v4-w12 @ 67192ff）
- lane-status：primary（main ← integ/post-v4-w12 @ 67192ff）release-post-v4-w11／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 第 12 波四條 lane（e152、e158、e161、e367）都已合併、finish、拆除；lane 紀錄在 `.current/history/2026-10/`。記帳與本清單在同一個 wave PR。佇列 E152、E158、E161、E184、E365、E366、E367、E369、E370、E371、E372 至此完成；E368 作廢，由 E379 取代（人類裁決 B）。
- 未配號的新發現：無（E373–E379 由 finish 配號，E380–E382 由整合者立票，排在佇列 #188–#197）。
### 待人類決定
- 是否發版、版號（本波動到 `tools/`、`gates/registry.ts`、`scripts/`、`content/`、`dist/`；`tw_get_state` 少回一個鍵、`check-bookkeeping` 找不到 base 時改 exit 2，屬 adopter 可見的行為改動）。
- 是否開下一波。
- 是否把 `test/e177b-mailbox-watch.test.mjs` 的 AC19/AC15（E378）列入負載敏感清單：列入後，它在 CI 紅時整合者可以 rerun 一次；目前只能退回 lane。
### 進行中的背景工作
無

## Dispatch pins
- e152：`pm=opus`、`sr-engineer=opus`。
- e158：`pm=opus`、`sr-engineer=opus`。
- e161：`pm=opus`、`sr-engineer=opus`。
- e367：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-29 | 人類 | 第 12 波範圍：佇列 P2 段剩下的 E152、E158、E161、E184，加上 E365–E372（第 11 波交接「待人類決定」的選項 b）。人類回覆「option b」 | 整合者 session |
| 2026-10-29 | 整合者 | 草案：e152（E152＋E365＋E371＋E372，文字同步，唯一碰共享生成物的 lane）∥ e158（E158＋E369＋E370，`scripts/`）∥ e161（E161＋E184＋E366，handoff 讀寫路徑）∥ e367（E367＋E368，E136 編碼的後續）。重劃：`docs/lane-protocol.md` §3 與兩份 spec 的函式名劃給 e152；`gates/registry.ts` 只限 E365 的條目劃給 e152；`scripts/**` 與（條件式）`tools/fanout-manifest.ts` 劃給 e158；`tools/lane-status.ts`、`tools/evidence-*.ts` 劃給 e367；`schema/**`、`tools/registry.ts` 條件式劃給 e161；`bin/**` 回到共同禁止。E152 的修法限在 SOP。E359、E360、E361、E363 不在範圍內。待人類裁決：D1（E161 的 SOP 那半） | 本檔 |
| 2026-10-29 | 人類 | 核准本清單（全部）：四條 lane（e152、e158、e161、e367）與所有重劃；D1 照草案建議 A —— e161 只做設計決定與伺服器端，E161 若選結構化欄位，qa SOP 那半由整合者在 5c 立新票、排到下一個能動 `content/**` 的波次（完成定義該列延後）；Lanes 表不加 `approval` 欄。人類回覆「approve」 | 整合者 session |
| 2026-10-29 | 整合者 | 清單 PR #49 merge `f5485a7` = 派工 base（PR 的 CI run 40832968597 綠）；派工前核對：四條 lane 點名的擁有／禁止路徑在 base 都存在，沒有殘留 branch／worktree；信箱 e152／e158／e161／e367 已建空檔，mailbox-watch 與 lane-status watch 都已 armed；四份 prompt 以 `fanout.mjs render --base f5485a7` 產生。此列隨記帳 commit 進 integ | 本檔 |
| 2026-10-29 | 整合者 | e161 cut 預審 close（`4358674`，to-lane#1）：check --cut exit 0（8 tasks）；每條 AC 都有實作 task；同意 D-E161（選填 `qa_suite_result`，伺服器寫進證據，不升版、不加閘門）、D-E184（從 `tw_get_state` 拿掉 tier；`content/` 沒有 SOP 從讀取視圖讀它）、D-E366（undo handle）。新發現 E161-NEW-1（suite result 的閘門）、E184-NEW-1（`prompts/build.ts` 狀態區塊仍呈現 tier）等 finish 配號。architect 的 Open Questions 還要再預審一次 | 信箱 e161 |
| 2026-10-29 | 整合者 | e158 cut 預審 close（`a4a0ccc`，to-lane#1）：check --cut exit 0；17 列稽核表逐列核對，`tag-at-HEAD` 的改動不碰 tag 等於 HEAD 的正常路徑；`fanout check`／`owners --range` 空範圍改 exit 2（新碼 `RANGE_EMPTY`），整合者 SOP 不改。給人類的建議（needs human ruling，由 lane 呈）：R1 選 A（找不到 base 時 exit 2，推翻 E299 AC4 的 note；CI 是 `fetch-depth: 0`，正常路徑不受影響）。整合者自己的新發現：`check --cut` 把擁有欄的說明文字解析成 glob token，範圍外的測試檔在機器層擋不住（5c 立票）。新發現 E158-NEW-1 等 finish 配號 | 信箱 e158 |
| 2026-10-29 | 整合者 | e152 cut 預審 close（`2d03c50`，to-lane#1）：check --cut exit 0（7 tasks）；同意 E152 選項 A（從發版範圍推導 feature spec，那一行改為可選；只因範圍觸發時 active 的判定不放寬），要求 lane 向人類講明 A 對範圍內 sibling spec 的檢查必然通過、spec 不在範圍內的 feature 仍看不到；E365 寫在 const-08 §3.1；`(none)` 對照列解讀為把 `(none)` 換成檔名、保留整列 | 信箱 e152 |
| 2026-10-29 | 整合者 | e367 cut 預審 close（`28dee4a`，to-lane#1）：check --cut exit 0；`encodeFeatureStem` 技術上成立（已出貨的 380 個名稱 0 搬動）。給人類的建議（needs human ruling，由 lane 呈）：NHR-1 選 B —— 本波只出 E367，E368 延後並與 E368-NEW-1（寫入端）合成一張票，排到能動 `content/**` 的波次；理由：A 會讓用大寫或底線命名 feature 的 adopter，其 AC-execution／visual 閘門安靜地不武裝（fail-open），比 A 修掉的 P4 碰撞更糟。選 B 時 lane 寄新 sha，整合者只核對它是原 cut 的子集。R2 同意 `test/visual-evidence-gate.test.mjs` 的 re-pin | 信箱 e367 |
| 2026-10-29 | 人類 | 在 e152 lane session 核准 cut（`2d03c50`）。人類回覆「approve」 | e152 lane session；`specs/e152-release-ac4-and-prose-sync.md`，commit `2d03c50` |
| 2026-10-29 | 人類 | 在 e158 lane session 核准 cut（`a4a0ccc`）；R1 裁決選 A（找不到 base 時 `check-bookkeeping` exit 2，推翻 E299 AC4 的 note，`ID-MONO-NO-BASE-NOTE` 重新固定）。人類回覆「approve cut, R1=A」 | e158 lane session；`specs/e158-range-subject-audit.md`，commit `10e024f` |
| 2026-10-29 | 人類 | e367 NHR-1 裁決選 B：本波只出 E367，E368 延後，與 E368-NEW-1（寫入端）合成一張票；清單完成定義的 E368 列延後；核准縮小後的 cut。人類回覆「approve, B」 | e367 lane session；`specs/e367-evidence-and-feature-path-encoding.md`，commit `b2233d5` |
| 2026-10-29 | 整合者 | e367 縮小後的 cut 預審 close（`b2233d5`，to-lane#2）：Cut 只剩 T-E367-01／T-E367-02，加上只做 lane 層驗證的 T-E367-03，是 `28dee4a` 的子集；check --cut exit 0；E368 的 re-pin 全部取消 | 信箱 e367 |
| 2026-10-29 | 人類 | 在 e161 lane session 核准 cut（`4358674`），三個 PM 選項照建議（D-E161 結構化欄位、D-E184 拿掉 tier、D-E366 undo handle）。人類回覆「approve」 | e161 lane session；`specs/e161-qa-claim-and-state-reads.md`，commit `4358674`（`cut_approved` 見 `97f8a7b`） |
| 2026-10-29 | 整合者 | e161 architect Open Questions 預審 close（`87f1531`，to-lane#2）：D-E161 確認、檔案集合不變；OQ-1（`command` 另拒 C0、DEL、U+0085、U+2028、U+2029，防止偽造 `covers:` 行與 verdict 標題）等七題全部同意，0 項需人類裁決；OQ-6（SQLite 模式重複的 `review_task_ids` 撞主鍵，現有行為）由 lane 記成新發現 | 信箱 e161 |
| 2026-10-29 | 人類 | 在 e161 lane session 核准 architect 的 Open Questions（OQ-1..OQ-7 照 architect 裁定）；OQ-6 記成 E366-NEW-1（P4） | e161 lane session；`specs/e161-qa-claim-and-state-reads-architecture.md`，commit `87f1531` |
| 2026-10-29 | 整合者 | 5a：e367 `4017a3e`（CI run 40840673883）close —— review、qa 都一輪通過；19 檔都在擁有範圍內；E368 依人類裁決 B 的三張 task 已 void；lane 本機兩次全套各有一個不同的計時紅燈（`test/verify-release.test.mjs` VR-22、`test/e132-lane-registry.test.mjs` gap-6，四條 lane 同時跑全套的負載），CI 綠；新發現 E368-NEW-1（E368 讀寫兩半）等 finish 配號 | 本檔 |
| 2026-10-29 | 整合者 | 5a：e152 `13a75be`（CI run 40841507117）close —— review 第 1 輪 CHANGES_REQUESTED（缺 expected-red 清單）、第 2 輪 APPROVED，qa 一輪通過；35 檔都在擁有範圍內；`gates/registry.ts` 只動 E365 的條目、對照列與兩段註解；`docs/lane-protocol.md` 只動 §3 兩行；6 個 full 模式 golden 與 context budget 三個上限重新固定（lite golden 不變）；沒有新發現。lane 本機一次全套撞到 E254（`test/e132-lane-registry.test.mjs` gap-6），重跑全綠，CI 綠 | 本檔 |
| 2026-10-29 | 整合者 | 5a：e158 `d794fce`（CI run 40843087004）close —— review、qa 都一輪通過；25 檔都在擁有範圍內；`fanout check`／`owners --range` 空範圍改 exit 2（`RANGE_EMPTY`）；`check-bookkeeping` 在 `--base` 解析不到、無 merge-base（核准後新增，reviewer 保留、qa 有 fixture、spec 已寫明）、完全找不到 base（R1=A）時都 exit 2；E370 的 AC9 改看巢狀 wrapper 自己的行為、AC13a 預算由 `AGC_E177B_WAIT_MS` 推算。新發現 E158-NEW-1、E158-NEW-2 等 finish 配號；整合者另立一張（test-lock 的鎖路徑是斷掉的 symlink 時仍空轉，既有問題） | 本檔 |
| 2026-10-29 | 整合者 | 5a：e161 第一次回報 `1faf645` 的 CI run 40844508566 紅（Node 20 job，`test/e177b-mailbox-watch.test.mjs` AC19/AC15 的固定時間預算；不在負載敏感清單，依規則不 rerun，退回 lane）。lane 以 Node 20／22 各跑 5 次確認與本 lane 改動無關，補新發現 E161-NEW-2 → `6f040e1`（CI run 40845142058 綠）close —— review、qa 都一輪通過；31 檔都在擁有範圍內；`schema/`、`gates/`、`content/` 未動；新發現 E161-NEW-1、E161-NEW-2、E184-NEW-1、E366-NEW-1 等 finish 配號 | 本檔 |
| 2026-10-29 | 整合者 | 5b：`integ/post-v4-w12` ← e152 `3b09c59` ← e158 `eb7e146` ← e161 `2223697` ← e367 `7b06d46`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 四次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 40845607789 綠 | 本檔 |
| 2026-10-29 | 整合者 | 5c／6：finish e152（無新發現）、finish e158 配號 E373–E374、finish e161 配號 E375–E378、finish e367 配號 E379；整合者立 E380（D1 A 的 qa SOP 句子）、E381（`check --cut` 把擁有欄說明文字解析成 glob）、E382（test-lock 的 dangling symlink 鎖路徑）；E373–E382 排在佇列 #188–#197（本波之後的 P2／P3 段尾）；E368 標 VOID、由 E379 取代；12 張票 done-mark 與佇列 DONE | 本檔 |
