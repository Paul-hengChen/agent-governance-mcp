# Fan-out: v4.0.0 Wave 5.1 (E179 — E124b wiring)
base: 771a4fd (to be re-stamped with the sha of the pre-dispatch commit below before prompts go out)    integration branch: integ/wave5.1

Single serial lane — no parallelism is available: E179 crosses L-INIT + L-STATE + L-CONTENT
(`docs/v4.0.0-execution-plan.md` Wave 5.1). This manifest exists for the DoD map, the scope
cuts, and the pre-dispatch premise fixes, not for file partitioning.

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e179 | E179 | feat/e179-ticket-allocation-wiring | ../agm-lanes/e179 | `bin/agc-init.mjs`, `tools/lane-ticket-allocation.ts`, `tools/lane-paths.ts`, `tools/lane-migrate.ts` (only if the LANE_FILES entry needs rollback handling), `content/coord-03-core-fallback.md`, `content/skill-release-engineer.md`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `dist/**`, this ticket's `tasks.md` rows, `specs/e179-*.md`, its `qa_reports/` + `review_reports/`, `.current/e179/`, qa-owned tests (`test/lane-ticket-allocation.test.mjs`, `test/agc-feature-lifecycle.test.mjs`, `test/lane-paths.test.mjs`, `test/lane-migrate.test.mjs`, new E179 test files) | `docs/backlog.md`, `docs/v4.0.0-*.md`, `docs/lane-protocol.md`, `.claude/commands/integrator.md`, root `NEW-TICKETS.md` (append-only, never commit), `tools/handoff-*.ts`, `tools/registry.ts`, `schema/**`, `gates/**`, `prompts/**`, `lib/**`, other `content/**` fragments | 做：票面 (1)–(7) 全部；(1) 的 apply commit 落在 **primary 的 `--base`**（finish 從 primary 執行，是唯一寫入者）；`--abandoned` 從 branch 讀待開票檔（`git show <branch>:…`），因為它不在 base 上；(2) 孤兒偵測只掃活 branch，advisory、不影響 exit code（與既有 `checkWorktreeEvidence` 同級）。不做：`history/` 掃描（→ E125 的 AC，見整合後）；E125 回寫；刪除 root `NEW-TICKETS.md` 檔案本身；改 `docs/lane-protocol.md`／integrator SOP（整合者在合併後改） | E73 ✓、E124 ✓、E174 ✓（皆已在 base） |

## 所有權重劃（相對於預設 lane 表）
- `bin/agc-init.mjs`（L-INIT）、`tools/lane-ticket-allocation.ts` + `tools/lane-paths.ts`（Wave 5 視為 L-STATE）、`content/**` + goldens + budget（L-CONTENT）**全部劃給 e179 單一 lane** —— 計劃已定不拆；Wave 5.1 期間沒有其他 lane 在跑，§2.1 單一 content lane 自然成立。

## 範圍決定（整合者決定，呈人類時點名）
- **S1 — orphan 不掃 `history/`**：`history/<YYYY-MM>/<lane>/` 要到 E125 才存在；現在掃描是對不存在的路徑寫碼（§8b）。轉成 E125 的 AC。完成定義「孤兒偵測器可用」不因此放寬。
- **S2 — `NEW-TICKETS.md` 退役 = 慣例退役，不刪檔**：SOP 散文改指 `pending-tickets.md`；root 檔（tracked，~1500 行歷史）的去留在整合時由整合者處理。
- **S3 — 本 lane 自己的新發現仍寫 root `NEW-TICKETS.md`**（append-only）：E179 的機制在它自己的 base 上還不存在。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| Wave 5：孤兒偵測器可用（branch 帶未套用待開票檔、worktree 已消失） | E179 (2) + (3)(4)(5) | ✅ |
| Wave 5：票號在平行 lane 下結構上不可能相撞 | E179 (1) + (6) | ✅ |
| Wave 5.1：Wave 5 剩下兩條打勾 | 上兩列 | ✅ |
| Wave 5.1：E179 qa PASS，全套在已 commit 的樹上綠 | E179 + 整合者 5a/5b 兩層重跑 | ✅ |

## 派工前修正（整合者自己的 commit，派工前完成並跑全套）
- `docs/lane-protocol.md` §1：`agc` 不在 PATH（`which agc` → not found）→ 指令改為 `node <primary>/bin/agc-init.mjs feature start <ticket-slug> --base <base> --path <worktree>`。
- `specs/fanout-wave5.1.md`（本檔）一起 commit；base 重蓋成該 commit 的 sha。

## 整合後（接線票／補刀）
- 整合者：`docs/lane-protocol.md` §4 + `.claude/commands/integrator.md` 5c/6 改成以 `pending-tickets.md` 收新票（取代 NEW-TICKETS harvest）。
- 整合者：決定 root `NEW-TICKETS.md` 的去留（S2）。
- 整合者：拆除 e179 時**用 E179 自己的 `agc feature finish --shipped`** 做 dogfood（它若有 pending-tickets 會真的配號）；失敗就退回手動拆除並開票。
- E125 票面加 AC：orphan 檢查是否掃 `history/`（S1）。
- done-mark：E124（接線完成）、E179；計劃文件 Wave 5 兩條 + Wave 5.1 兩條打勾。

## 合併順序
e179（唯一）→ `integ/wave5.1` → rebuild `dist/` → 全套 → ff `main`
