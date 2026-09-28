# Fan-out: E250 `agc eject` 的路徑顯示跳脫 ＋ E251 環境變數表補列（單一 lane）
base: 3c20ed1    integration branch: integ/e250

**狀態：人類已核准（2026-09-28）。** 佇列 0k（人類裁決 2026-09-28：緊接 E234 之後）。E251（佇列 #72）依人類裁決（2026-09-28）併入本 lane，同一條 lane 做完兩張票。發版等本 lane 合併後再做。

## 派工前核對（整合者，2026-09-28）
- `git worktree list` 只有 primary；main 和 origin/main 都在 `3c20ed1`（E234 已合併，E251 已配號並排進佇列）；工作樹乾淨。
- 派工 base：本檔與佇列檔的 commit 落在 `3c20ed1` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入）。
- 既有信箱：`_mailbox/e234`、`_mailbox/e235a`、`_mailbox/e235b`、`_mailbox/e243`、`_mailbox/e248`（E246 留下），與 `e250` 不重名。
- E250 的程式面：`bin/agc-init.mjs` 的 `runEject()`（約 3440–3555 行），計畫標頭（`agc eject — plan for <cwd> …`／`applying to <cwd>:`）直接插入 `cwd`；每一行 entry 的 `display`（例如約 3316 行的 `(iii) host traces — <display>`）、`will change tracked file(s)` 清單，以及 stderr 的 tracked 清單都直接插入路徑。E243 的 `escapeSegmentForDisplay()` 在約 1336 行，只處理單一 segment；`tools/hygiene-scan.ts` 另有 `escapeForDisplay()`（可 import，不可改）。
- stderr 的 `git rm -r <targets>` 是讓使用者貼上執行的指令：跳脫後的路徑貼上去不會指到原本的檔案，所以這一行怎麼處理（例如加引號，或路徑含控制字元時不印指令、改印說明）由 PM 在 cut 裡決定。
- 既有 eject 測試 `test/e108-eject.test.mjs` 用 regex 比對輸出（`plan for .*`、`host traces — CLAUDE\.md…`），一般路徑的輸出不變就不會壞；若 lane 發現要改它，先寄信請整合者重劃。
- E251 的文件面：`docs/config.md` 的「Env-var overrides」表（約 195–203 行），缺一列關鍵字清單的環境變數；E234 已在 `docs/install.md` 寫好那一段，新列連過去即可。
- 使用者文件中描述 eject 的地方：`docs/install.md` 的「Leaving agc」一節（約 202 行起）。
- 不碰共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- task id：`T-E250-NN`（E251 的 task 也用這個前綴，task 描述裡寫明 E251）。`qa_reports/`、`review_reports/`、`specs/` tracked。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e250 | E250, E251 | feat/e250-eject-path-escape | ../agent-governance-mcp-lanes/e250 | `bin/agc-init.mjs`、`docs/config.md`（只限 Env-var overrides 表）、`docs/install.md`（只限「Leaving agc」一節）、`test/e250-*.test.mjs`、`test/fixtures/e250/**`、`specs/e250-*`、`qa_reports/*E250*`、`review_reports/*E250*`、`.current/e250/**` | `content/**`、goldens、budget、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`scripts/**`、`tools/**`（只能 import）、`dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：E250 —— `agc eject` 輸出的所有路徑顯示（計畫標頭的 workspace 路徑、每一行 entry 的路徑、tracked 變更清單、stderr 的 tracked 清單）改用可見跳脫，讓 CR／LF／ESC 等控制字元不能拆行或注入終端；一般路徑的輸出一字不變；`git rm` 指令行的處理由 PM 定；只改顯示用的副本，實際操作的路徑不變。E251 —— `docs/config.md` 的 Env-var overrides 表補一列關鍵字清單的環境變數，說明它指向 `agc check` 資訊衛生掃描的關鍵字檔，並連到 `docs/install.md` 的那一段。不做：`agc init`／`agc check`／`agc feature` 其他回顯路徑的訊息（發現就寫進 `pending-tickets.md`）、改 eject 的行為或計畫內容、改 `tools/**` | E243 ✓、E234 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/config.md`（只限 Env-var overrides 表）→ e250，給 E251 用。
- `docs/install.md`（只限「Leaving agc」一節）→ e250，eject 文件若需要提到跳脫時用；不需要就不改。
- 本波只有一條 lane，沒有共享生成物持有者：不得改變任何組合出的 prompt 內容。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `agc eject` 的輸出中，workspace 路徑或檔案路徑裡的控制字元不能拆行或到達終端 | E250 | ✓ |
| 一般路徑下 `agc eject` 的輸出不變、實際操作不變 | E250 | ✓ |
| `git rm` 指令行在含控制字元的路徑下不會讓使用者貼上錯的指令 | E250 | ✓ |
| `docs/config.md` 的環境變數表列出關鍵字清單的環境變數 | E251 | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試；backlog E250／E251 done-mark、佇列 0k 與 #72 勾 DONE；`lane-status --rollup` 後 `finish --shipped`。
- 以整合者本機關鍵字源跑 `agc check`，零實際命中。
- 之後回報人類：可發版（v4.2.0：E234 ＋ E250 ＋ E251），由人類決定。

## 合併順序
e250（單一 lane；merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e250` → ff `main`

## Dispatch pins
- e250：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | E250 開始 fan-out；E251 併入同一條 lane；發版等 E250 合併後 | 整合者 session |
| 2026-09-28 | 整合者 | 範圍只限 `agc eject` 的輸出；票面提到的「其他 init／check 回顯路徑的訊息」不在本 lane，發現就寫進 `pending-tickets.md`（細切票優先）；`git rm` 指令行的處理交給 PM | 本檔 |
| 2026-09-28 | 人類 | 核准本清單，開始派工 | 整合者 session |
