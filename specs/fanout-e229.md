# Fan-out: E229（history-independent scope tests — E104 option iii 前置）
base: 942f994    integration branch: integ/e229

**狀態：人類核准 2026-09-27。** 單一 lane。目的：人類裁決以單一 commit 快照刪除並重建 repo（E104 option iii）之前，讓全套測試不依賴 git 歷史。

## 派工前核對（整合者，2026-09-27）
- `git worktree list`：primary（main `942f994`）＋ lane `e229`（`feat/e229-history-independent-scope-tests` @ `942f994`，已由 `agc feature start` 建立）；main = origin/main。
- 整合者演練（`git archive HEAD` → 單一 commit repo → `npm test`）：2811/2817，只有 6 個失敗，全部是釘歷史 SHA 的：`test/e130-lane-default.test.mjs` AC4（#777）、AC14（#787）；`test/e178a-integrator-role.test.mjs` AC3／AC4／AC6／AC15（#931／#932／#934／#943）。其他提到歷史 SHA 的測試（例如 render-structure 的 `ffa4082`）在無歷史時已經通過，不在範圍內。
- 三個擁有的既有檔案都 tracked：`test/e130-lane-default.test.mjs`、`test/e178a-integrator-role.test.mjs`、`docs/lane-protocol.md`。
- **lane 已有未 commit 的 PM cut 草稿**（`specs/e229-history-independent-scope-tests.md`、`.current/e229/tasks.md` T-E229-01..04）：由本 session 在 coordinator 身分下派的 PM 產生，尚未經人類核准、未寫任何 handoff state。lane session 接手時先審閱並 commit 這份草稿，送信箱預審。
- **§3.2 揭露**：本 session 只做過該 lane 的 PM 派工（非 builder、非 judge），之後不再在該 lane 內派任何角色；lane 由獨立 session 執行，本 session 只整合。
- 不碰 `content/**`、goldens、budget → 無共享生成物。`qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。
- task id：`T-E229-NN`。

## Lanes（E229，單一 lane）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e229 | E229 | feat/e229-history-independent-scope-tests | ../agm-lanes/e229 | `test/e130-lane-default.test.mjs`、`test/e178a-integrator-role.test.mjs`、`docs/lane-protocol.md`、`specs/e229-*`、`qa_reports/*E229*`、`review_reports/*E229*`、`.current/e229/**` | `content/**`、goldens、budget、`bin/**`、`tools/**`、`scripts/**`、`prompts/**`、`gates/**`、`templates/**`、`dist/**`、其他 `test/**`、其他 `docs/**`、`package.json`、`.github/**`、`CLAUDE.md`、`AGENTS.md`、`specs/fanout-*.md` | 做：上述 6 個測試改成不依賴 git 歷史 —— 能改成檢查目前 tree 的就改（registry 前 11 筆、`role.ts`／`transitions.ts` 無 `integrator`、§6 內容、template bytes）；本質上是歷史 diff 的（e130 AC4／AC14、§6「新增行數」）先 `git rev-parse --verify`，物件不存在時大聲 skip（印 `HISTORY-DEPENDENT AC SKIPPED`），不得靜默通過；`docs/lane-protocol.md` 加一句「永久測試不要釘 commit SHA」；全套在 lane 與單一 commit 快照裡都綠（歷史檢查只能 skipped 不能 failed）。只由 qa-engineer 執行（§2），單角色判定派工。不做：其他提到 SHA 的測試、任何 production code、`docs/install.md` 的 pin（整合者在 main 上另外處理）、repo 重建本身（人類） | 無 |

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/lane-protocol.md` → e229：只加一句守則；本波沒有其他 lane。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 單一 commit 快照裡全套測試綠（E104 option iii 的前置） | E229（T-E229-01／02／03） | ✓ |
| 永久測試不釘 SHA 的守則寫進 lane protocol | E229（T-E229-04） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：`docs/install.md` 的 `#v3.94.0` pin 改成 `#v4.0.0`（整合者，main 上的文件修正）；backlog E229 done-mark；E104 row 記錄 option iii 的執行計劃與人類裁決（留備份）。
- 之後進入 E104 option iii 第 1 階段（整合者／coordinator 在新目錄建單一 commit 快照並驗證），第 2 階段由人類親手刪除並重建 repo。

## 合併順序
e229 → `integ/e229` → ff `main`

## Dispatch pins
- e229：無 pin（qa-engineer 用 frontmatter 預設）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-27 | 人類 | E104 走 option iii：以單一 commit 快照、刪除舊 repo 後用同名重建；刪除前留本機 mirror 備份；先做第 0 階段（E229） | 整合者 session |
| 2026-09-27 | 人類 | E229 改由 `integrator fan-out` 派給獨立 lane session 執行 | 整合者 session |
| 2026-09-27 | 人類 | 核准本清單（`docs/lane-protocol.md` 劃給 e229；lane 內既有 PM 草稿由 lane session 接手），開始派工 | 整合者 session |
