# Review — e461-mutation-test-gaps (T-E461-01 … T-E461-08)

covers: T-E461-01, T-E461-02, T-E461-03, T-E461-04, T-E461-05, T-E461-06, T-E461-07, T-E461-08

Batched round: one review for the whole lane. Judge report (Expected-Red Diff, AC Execution Log): `qa_reports/review_T-E461-01.md`.

## Round 1 — APPROVED — by code-reviewer

## Summary

- 純測試 lane：五個既有測試檔收緊/新增斷言、一個新檔 `test/e461-sr-return-rag-cleanup.test.mjs`、`scripts/smoke-qa-flow.mjs` 兩處修改（qa PASS probe 只認 tool-boundary 的 judge 拒絕；最後一個 probe 前 seed `review_reports/review_X1.md`）。
- 無 source / content / dist / docs / CLAUDE.md 變更；`git diff --name-only 83ca8c0..HEAD` 全部落在 manifest e461 owned set（tests、smoke script、`specs/e461-*`、`qa_reports/`、`.current/e461/**`）。
- 每個具名突變（M1a–M1d、M2a–M2d、M4、M5、M6a、M6b、M7a、M7b、M7b′、M9a）都在拋棄式複本中由 judge 親自重跑：分支測試在突變下紅、還原後綠；舊（base）測試在同一突變下多數仍綠，證明缺口確實被補上。
- 全套件（clean tree，`node scripts/test-lock.mjs -- npm test`）：4676 tests、4674 pass、0 fail、2 skipped（base 既有的 history-dependent e130 檢查），exit 0。
- Verdict: **APPROVED**。

## AC Completeness

- AC1 — implemented — `test/e433-test-first-rules.test.mjs` 的 `judgePairing` / `clauses`（AC1 五個 role 測試）；M1a 下 5/5 紅，舊測試 5/5 綠。
- AC2 — implemented — 同檔 AC3 測試尾段（raw qa SOP 配對 + step 7 `next_role` 唯一值）；M1b、M1c 各紅，舊測試皆綠。
- AC3 — implemented — 同檔 AC4 測試 `row1.split("|")…[2] === "In_Progress"`；M1d 紅，舊測試綠。
- AC4 — implemented — `test/e461-sr-return-rag-cleanup.test.mjs` AC4；M2a 紅（count 3）。
- AC5 — implemented — 同檔 AC5；M2b 紅（`SR_RETURN_CAP_EXCEEDED`）。
- AC6 — implemented — 同檔 AC6（輪詢 v17 heal 後讀盤）；M2c 紅。
- AC7 — implemented — 同檔 AC7（count 2 有註記、count 1 控制組無）；M2d 紅。
- AC8 — implemented — 同檔 AC8（SQLite，含 non-PASS 控制組，無 binding 時 `t.skip` 帶理由）；M4 紅。
- AC9 — implemented — `test/e435-remove-old-path.test.mjs` AC4 新增 `runMigrations("handoff", v16)` 檢查；M5 紅，舊測試綠。
- AC10 — implemented — 以拋錯模組取代 `dist/tools/storage-sqlite.js`：exit 0，e435 AC9 與 e461 AC8 皆 `# SKIP` 並帶理由。
- AC11 — implemented — `test/e419-retired-write-mechanisms.test.mjs` 新的完整 drift 報告案例；M6a 紅，舊測試綠。
- AC12 — implemented — 同檔 boundary 測試只認 `ZodError` / path `["active_feature"]` / `too_small`；M6b 紅，舊測試綠。
- AC13 — implemented — `test/e422-ticket-file.test.mjs` ReadMe.md 案例；M7a 只紅這一個，舊檔 53/53 綠。
- AC14 — implemented — 同檔 rounding 案例；M7b 紅（另有既有 `Review Round…` 測試也紅），M7b′ 只紅新測試、舊檔全綠。
- AC15 — implemented — AC12 移除 `CLAUDE.md is 250 lines`；在有完整歷史的 clone 中於 `CLAUDE.md` 加一行，分支 AC12 pass（含 closed-range 檢查）、舊 AC12 紅。
- AC16 — implemented — `scripts/smoke-qa-flow.mjs` qa PASS probe；分支 `[PASS]`，M9a 下 `[FAIL]`（文字為 orchestrator 的 `BLOCKED … reserved for code-reviewer`），舊 smoke 同突變下仍 `[PASS]`。
- AC17 — implemented — 全套件 0 fail；scope 檢查見 Architecture。
- AC18 — implemented — 分支 smoke `12/12 smoke tests passed.` exit 0；舊 smoke `11/12`（`MISSING_REVIEW_EVIDENCE`）。

## Correctness

No required findings.

- `test/e433-test-first-rules.test.mjs` `clauses()`：句切 `(?<=[.;!?])\s+|\n+`、子句切 `, | — |: |(?= then )` 與 spec 規則一致；`JUDGE_TERM` 的 `\bPASS\b(?!_)` 正確排除 `PASS_TASKS_INCOMPLETE`；vacuity guard 存在（五個 prompt 與 raw SOP 都斷言 `judgeClauses.length > 0`）。
- AC3 status cell：row 以 `|` 起首，`split("|")[2]` 正是 status 欄，精確比對 `In_Progress`。
- e461 AC4–AC7 經真實 `tw_update_state` `.run`（zod + orchestrator），以 `writeHandoffState` + `forceSeedStamp` seed，並在暫存 ws 放 `no-new-test_<feature>.txt`，被測對象確實是 sr_return 路徑而非交接 gate。AC6 依 e435 AC4 的輪詢模式等 fire-and-forget heal。
- AC8 有 non-PASS 控制組，且 `finally` 還原 active storage 並關 DB，不會污染同檔後續測試。
- e419 boundary：`result === null` + `ZodError` + 單一 issue 精確比對，任何其他 throw 或 error result 都會紅（M6b 實證）。
- smoke：比對字串是 tool-boundary refine 訊息前綴（runtime 文字，不是讀原始碼），並同時要求無 `"success":true`。

`recommended`:
- R1 — `test/e433-test-first-rules.test.mjs` `NEGATED` 含裸字 `no` / `not`：同一子句若出現無關的否定詞（例如 "qa-engineer writes PASS with no further check"）會遮蔽違規。此為 spec 接受的已知限制，未來若要收緊可改成要求否定詞修飾 judge term。
- R2 — M7b 照 spec 寫法也會打紅既有的 `AC3 Review Round, lane, dispatch mechanism and Review-Round are all refused as forbidden`，所以 M7b 本身不是 base 套件的 survivor；新 rounding 測試的獨有價值由 qa 的 M7b′ 證明（judge 重跑：只紅新測試、舊 e422 檔 53/53 綠）。AC14 的 proof（新測試在 M7b 下紅）照字面成立，判定 AC14 已證明。

`optional`:
- O1 — e419 AC8 完整報告案例的 `earlyReturns` 是硬編字串；若 drift 文字改寫，該斷言會變成恆真，但「seeded task 出現在 tasks 清單」那條仍守住完整報告路徑。
- O2 — e419 boundary 的 `caught.issues.length === 1` 綁定 zod 的 issue 數；zod 升級若多報一個 issue 會誤紅（偏嚴方向，可接受）。

## Quality

No findings. 新註解皆為短 WHAT/WHY，無絕對路徑、無歷史 SHA、無以裸 ticket id 作為唯一說明（ticket id 只出現在沿用的測試標題與 `T-E419-1` 測試資料中）。新檔標題以 AC id 開頭，符合 spec 的 Test placement。`agc check — comments` 無觸及本 diff 的新警告需要處理（新增註解皆短）。

## Architecture

- Scope：`git diff --name-only 83ca8c0..HEAD` = `.current/e461/{dispatch.jsonl,handoff.md,tasks.md}`、`qa_reports/{expected-red,tests}_e461-mutation-test-gaps.*`、`scripts/smoke-qa-flow.mjs`、`specs/e461-mutation-test-gaps.md`、`test/{e419,e422-ticket-file,e433,e435}*.test.mjs`、`test/e461-sr-return-rag-cleanup.test.mjs`——全在 manifest e461 owned set 內；forbidden 清單（`content/**`、goldens、`test/context-budget.test.mjs`、`dist/**`、所有 source 目錄、其他 `scripts/**`、`docs/**`、`CLAUDE.md`）零觸碰。
- 跨 lane 文字讀取：新斷言不讀任何 e462 擁有檔的原始碼文字。e433 讀的 `content/const-06-chain-31-head.md`、`skill-qa-engineer.md`、`skill-sr-engineer.md` 依 manifest「讀對方檔案文字的測試」表屬 E461 (1) 的配對讀取，e462 不改這三檔。smoke 比對的是 runtime 回傳文字（`tools/transitions.ts` refine 訊息為 code，非註解）。
- Node 20：無 `git show`、無對暫存目錄的事後重讀；新測試只讀 live `dist/`、暫存 ws 與測試內 fixture。SQLite 案例在本機 Node 20 因 binding ABI 無法跑（環境限制，CI 依版本安裝 binding），judge 未另行驗證 Node 20。

## Security

No findings. 測試只寫入 `os.tmpdir()` 下的暫存目錄；smoke 的 seed 寫在其自建暫存 ws。無密鑰、無外部輸入。

## Performance

No findings. 新增 8 個測試皆為小型暫存 ws／記憶體操作；AC6 輪詢上限 100 × 10 ms。套件時間無可見回歸。

## Verdict

APPROVED — 每個 AC 都有在分支上綠、在其具名突變下紅的測試（judge 親自重跑全部突變），scope 與註解紀律符合 manifest 與 Constitution §6，全套件 0 fail。
