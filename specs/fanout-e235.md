# Fan-out: E235 協定產物不再寫入本機絕對路徑（e235a ∥ e235b）
base: ac502d4    integration branch: 每條 lane 各一條 integ/<lane>

**狀態：人類核准 2026-09-28；已結案（兩條 lane 皆合併進 main）。** 接續 `specs/fanout-feedback-leftovers-wave2.md`（R2：協定產物整類歸 E235）。PM 預切（2026-09-28，派工前、不寫狀態）見下方「切票依據」。

## 派工前核對（整合者，2026-09-28）
- `git worktree list` 只有 primary；main `ac502d4` = origin/main；工作樹乾淨；`tw_detect_drift` 無 drift。primary handoff 停在 `release-v4.0.0`。
- 外洩面（整合者以自己的關鍵字 grep，關鍵字不寫入本檔）：**協定產物 32 檔** —— `.current/_primary/handoff.md`、18 個 `.current/history/2026-09/*/handoff.md`（`prd_path:`；e178b 另有兩個 `external_refs` 的 `ref:`）、`.current/history/2026-09/e125c/compaction-procedure.md`（散文）、8 個 `specs/fanout-*.md`（worktree 欄，另 `fanout-wave7.md` 7.0 列與 `fanout-wave7.2.md` 第 14 行為散文）、`test/fixtures/e177a/{fanout-wave5.1,fanout-wave6,fanout-wave7}.md`、`test/fixtures/e177a/render-e177a.golden.txt`、`test/fixtures/e178b/fanout-wave7-e177a.md`。比 E232 結案時的 31 多 1 個：今天結案的 e108 handoff。
- **E232 漏網 5 檔**（角色撰寫、非協定產物；本機路徑以 session 目錄的連字號編碼形式或暫存目錄形式出現，一般路徑樣式掃不到）：`docs/agc-feedback-2026-09-08.md`、`qa_reports/archive/d7-qa-reports-archive/review_T-D7-02.md`、`qa_reports/archive/e123b9-lane-flip/review_T-E123B9-05.md`、`review_reports/archive/e123b9-lane-flip/review_T-E123B9-01.md`、`qa_reports/review_T-E229-03.md`。整合者裁量併入 E235（把發現併入既有票），歸 e235b。
- 來源：`prd_path` 由 zod 要求絕對路徑（`tools/registry.ts` 的 `UpdateStateArgs` 與 `IndexPrdArgs`，後者另有「必須在 workspace 內」的防穿越檢查），由 `tools/handoff-write.ts`、`tools/storage-sqlite.ts` 寫入，`tools/rag.ts`、`prompts/build.ts` 直接讀檔、不與 `workspace_path` 組合 → 改成相對路徑是行為變更。清單 worktree 欄由 `tools/fanout-manifest.ts` 原樣填入派工 prompt（lane 要 `cd` 進去）。
- **本檔自身**：worktree 欄寫相對於 primary 的路徑（`../agent-governance-mcp-lanes/<lane>`），不新增外洩；派工時整合者在 scratchpad 副本換成絕對路徑再 render（render 出的 prompt 不 commit）。e235b 定新格式後把本檔一併改寫。
- 共享生成物（`content/**` ＋ `test/fixtures/compose-golden/**` ＋ `test/context-budget.test.mjs`）本波只屬 e235b（若 `content/skill-integrator.md` 或其他 SOP 散文要跟著新格式改）。e235a 不得改變任何組合出的 prompt 內容；若發現必須改，停下來寄信給整合者。
- 兩條都有 architect hop（PM 判定：跨 ≥3 模組的 API／欄位語意變更＋schema_version 升版；清單格式變更）→ 整合者預審兩次（PM cut、architect Open Questions）。
- `qa_reports/`、`review_reports/`、`specs/` tracked。task id 帶票號：`T-E235A-NN`、`T-E235B-NN`。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e235a | E235（handoff 那一半） | feat/e235a-relative-prd-path | ../agent-governance-mcp-lanes/e235a | `tools/registry.ts`、`tools/handoff-write.ts`、`tools/handoff-parse.ts`、`tools/handoff-types.ts`、`tools/handoff-orchestrator.ts`、`tools/storage-sqlite.ts`、`tools/rag.ts`、`prompts/build.ts`、`schema/**`、`docs/schema-versions.md`、上列檔案對應的 `dist/**`、`.current/_primary/handoff.md`（只限 `prd_path:` 一行）、`.current/history/2026-09/**`（只限含本機路徑的欄位與散文行）、`test/cut-approval-gate.test.mjs`、`test/handoff-migration.test.mjs`、`test/handoff-versioning.test.mjs`、`test/handoff-write-arg-guard.test.mjs`、`test/prompt-state-footer.test.mjs`、`test/rag-lifecycle.test.mjs`、`test/rag.test.mjs`、`test/visual-gate-e2e.test.mjs`、`test/visual-round-sqlite.test.mjs`、`test/writestate-options-object.test.mjs`、`test/schema-versions.test.mjs`、`test/e235a-*.test.mjs`、`specs/e235a-*`、`qa_reports/*E235A*`、`review_reports/*E235A*`、`.current/e235a/**` | `content/**`、goldens、budget、`bin/**`、`scripts/**`、`templates/**`、`gates/**`、其他 `tools/**`（只能 import）、其他 `prompts/**`、其他 `dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、`docs/**`（`docs/schema-versions.md` 除外，含 `docs/backlog.md`）、`specs/fanout-*.md`、`research/**`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、e235b 的檔案 | 做：handoff 的 `prd_path`（及任何會寫進 tracked handoff 的絕對路徑欄位）改存相對於 `workspace_path` 的路徑，讀取時解析回絕對路徑；舊的絕對值照樣可讀（向後相容）；`IndexPrdArgs` 的防穿越檢查改對「解析後」的路徑驗證，不得放寬；需要時升 handoff（與 sqlite）schema_version 並補 migration 與 `docs/schema-versions.md`；一次性改寫現存 19 個 handoff／history 檔的本機路徑（只動該欄位或散文行，其他欄位不碰）；最後重掃擁有範圍零命中。不做：清單格式、SOP 散文、任何 `content/**` | E231 ✓、E232 ✓ |
| e235b | E235（fan-out 清單那一半）＋ E232 漏網 5 檔 | feat/e235b-relative-manifest-worktree | ../agent-governance-mcp-lanes/e235b | `tools/fanout-manifest.ts`、`scripts/fanout.mjs`、`tools/lane-status.ts`、`scripts/lane-status.mjs`、上列檔案對應的 `dist/**`、`docs/lane-protocol.md`、`specs/fanout-*.md`（含本檔）、`test/fixtures/e177a/**`、`test/fixtures/e178b/**`、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e177b-lane-status.test.mjs`、`test/e178b-cut-prereview.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e178b-lane-watch.test.mjs`、`test/e223-watch-rearm-gone.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e130-lane-default.test.mjs`、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/agc-feedback-2026-09-08.md`、`qa_reports/archive/d7-qa-reports-archive/review_T-D7-02.md`、`qa_reports/archive/e123b9-lane-flip/review_T-E123B9-05.md`、`review_reports/archive/e123b9-lane-flip/review_T-E123B9-01.md`、`qa_reports/review_T-E229-03.md`、`test/e235b-*.test.mjs`、（E240 加項，人類核准）`tools/transitions.ts`（只改註解）、`CHANGELOG.md`、`NEW-TICKETS.md`、`docs/backlog.md`、`docs/v4.0.0-execution-plan.md`（都只限清除外洩字串）、`research/*-button-realign-qa-blocked-dead-end.md`（改名，含舊路徑）、`specs/e106-init-artifacts-flag.md`、`specs/e109-workspace-feature-anchoring.md`、`specs/e110-pm-parallel-lane-template.md`、`specs/e114-cut-approval-inheritance.md`、`specs/e180-abandoned-harvest.md`、`specs/e213-shipped-ignored-shape.md`、`specs/e73-adopter-acceptance-*.md`、`qa_reports/**`、`review_reports/**`（都只限散文行）、`test/e180-abandoned-harvest.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/p0-onboarding-lite-default.test.mjs`、`test/qa-flow.test.mjs`、`specs/e235b-*`、`qa_reports/*E235B*`、`review_reports/*E235B*`、`.current/e235b/**` | `bin/**`、`schema/**`、`gates/**`、`prompts/**`、`templates/**`、其他 `tools/**`（只能 import）、其他 `scripts/**`、其他 `dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`.current/**`（`.current/e235b/**` 除外）、其他 `qa_reports/**`／`review_reports/**`、`research/**`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、e235a 的檔案 | 做：fan-out 清單的 worktree 欄不再要求絕對路徑（例如新增 `lanes-root:` 標頭或由 lane 名推導，architect 定）；`render` 仍輸出 lane 能直接 `cd` 的絕對路徑（render 結果不 commit）；`validate`／`check`／`lane-status` 跟著新語意；`docs/lane-protocol.md` 與必要的 SOP 散文同步（動到 `content/**` 就重生 goldens／budget）；一次性改寫 8 個 `specs/fanout-*.md`＋本檔＋`test/fixtures/e177a/**`、`test/fixtures/e178b/**`；E232 漏網 5 檔以類別描述取代（證據檔只改散文行，不碰標題、verdict 行、`covers:` 行）；最後重掃擁有範圍零命中（含連字號編碼與暫存目錄兩種形式）。不做：handoff 欄位、schema、`bin/**` | E231 ✓、E232 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/lane-protocol.md`、`content/**`＋goldens＋budget → e235b（本波唯一的共享生成物持有者）。
- `docs/agc-feedback-2026-09-08.md` 與 4 個證據檔 → e235b：只限清除外洩字串。
- `.current/_primary/handoff.md`、`.current/history/2026-09/**` → e235a：只限含本機路徑的欄位／散文行；不改任何其他欄位（同 E232 的單欄紀律）。
- PM 原提議的第三條 lane（只清 5 檔）併入 e235b：1 個 task，不值得多開一個 session。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 新寫入的 handoff 不再含本機絕對路徑，舊值仍可讀 | E235（e235a） | ✓ |
| 現存 tracked handoff／history 檔零命中 | E235（e235a） | ✓ |
| fan-out 清單格式不再要求絕對路徑，render 仍可派工 | E235（e235b） | ✓ |
| 現存 `specs/fanout-*.md` 與 fixture 零命中 | E235（e235b） | ✓ |
| E232 漏網 5 檔零命中 | E235（e235b，整合者併入） | ✓ |
| 整個 tracked tree 以整合者三類關鍵字重掃零命中 | 整合者（合併後） | ✓ |
| adopter 專案名稱的處置 | E240（人類裁決；若判定敏感，清理面依擁有權分給 e235a／e235b 或另開票） | 待裁決 |

## 整合後（整合者自己的 commit／接線）
- 兩條合併後：重建 `dist/`、全套測試；backlog E235 done-mark；`finish --shipped` 配號。
- 以整合者關鍵字（三類）重掃整個 tracked tree，零命中＋E240 裁決 → 才向人類報告「可轉 public」。

## 合併順序
e235a ∥ e235b（檔案互斥，誰先 PASS 誰先合；e235b 持有共享生成物，若兩條同時就緒則 e235b 先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/<lane>` → ff `main`

## Dispatch pins
- e235a：`sr-engineer=fable`（人類長期偏好）。
- e235b：`sr-engineer=fable`（同上）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | 要求 fan-out E235，之後處理 E240 | 整合者 session |
| 2026-09-28 | 整合者 | E232 漏網 5 檔併入 E235（歸 e235b）；PM 提議的第三條 lane 併入 e235b | 本檔 |
| 2026-09-28 | 人類 | 核准本清單（含第三條 lane 併入 e235b、共享生成物只歸 e235b），開始派工。E240、git 歷史處置、歷史檔改寫留痕與否、已結案證據檔散文改寫 —— 仍待裁決，由各 lane 的 cut 呈給人類 | 整合者 session |
| 2026-09-28 | 人類 | 四項裁決：E240＝A（adopter 專案名稱與以人名命名的個人 config 目錄都算敏感資訊）；E235 合併後由人類重置一次 git 歷史，作者改用中性身分；已結案的歷史 handoff 與清單直接改寫、不在檔內加註；已結案票的證據檔只改散文行，verdict 行與 `covers:` 行不動 | 整合者 session |
| 2026-09-28 | 整合者 | E240 清理面依擁有權分配：`tools/handoff-orchestrator.ts` 與兩個 history `tasks.md` 歸 e235a，其餘歸 e235b（本列擁有欄於整合時補上，避免與 e235b 改寫同一列的 worktree 欄衝突）；更正派工前核對的計數：17 個 history handoff 加 `_primary`，總數 19 不變 | 信箱 e235a／e235b to-lane#1 |
| 2026-09-28 | 人類 | e235a 核准 cut；e235b 核准 cut 加 architecture（A＋B，含 E240 加項） | 各 lane session |
| 2026-09-28 | 整合者 | e235a 驗證通過並合併（`5659a6e`，12 commits，59 檔皆在範圍內；review 第 2 輪 APPROVED、qa 第 1 輪 PASS，hop 7/10；lane 層與整合層全套皆 2896/2899 0 fail）；無衝突 → 無合併審查；ff main `31941cc`，`finish --shipped` `52a39b5`；primary MCP 重連後確認寫入存相對值 | 信箱 e235a to-integrator#5 |
| 2026-09-28 | 整合者 | e235b 驗證通過並合併（`77f2cbd`，9 commits；越界的 35 檔全屬人類核准的 E240 加項；review 第 1 輪 APPROVED、qa PASS，補勾架構 task 多用 2 hop，hop 7/10 → 開 E247；lane 層全套 2899/2902 0 fail）；無衝突 → 無合併審查 | 信箱 e235b to-integrator#7 |
