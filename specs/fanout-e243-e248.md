# Fan-out: E243 ∥ E248（local 模式拒絕反斜線／控制字元 ∥ 清單 mailbox 標頭接受相對路徑）
base: c29b4a4    integration branch: 每條 lane 各一條 integ/<lane>

**狀態：人類核准 2026-09-28；已結案（兩條 lane 皆合併進 main）。** 佇列 0h（E243）＋ 0i（E248，人類裁決 2026-09-28 從 #69 提前、與 E243 並行）。E234（0j）與 E243 同改 `bin/agc-init.mjs`，排在 E243 合併之後，不在本波。

## 派工前核對（整合者，2026-09-28）
- `git worktree list` 只有 primary；main = origin/main = `c29b4a4`；工作樹乾淨；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.0.0`。
- 派工 base：本檔與佇列檔的 commit 落在 `c29b4a4` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入），`fanout check --base main` 不受影響。
- 既有信箱只有 `_mailbox/e235a`、`_mailbox/e235b`（E246 留下），與 `e243`／`e248` 不重名。
- **E243 面**（`bin/agc-init.mjs`）：拒絕集合是 `GITIGNORE_WILDCARD_RE = /[*?[\]]/`（約 1293 行），由 `repoRelativeWorkspacePrefix()` 算出 `unsafeSegment`；使用者可見的固定訊息兩處 —— `init` 拒絕 local（約 520–523 行）、`agc check` 無法驗證 artifacts drift（約 1164–1167 行）；`eject` 的 exclude 移除（`planExcludeEntry`，約 3349 行）同樣以 `unsafeSegment` 跳過；`docs/install.md:150` 以散文列出四個字元。票面說「三處訊息」，實際兩處訊息＋一處使用者文件＋一處 eject 行為 —— 由 lane 的 PM 確認。釘住訊息字面的測試：`test/e239-init-subdir-exclude.test.mjs`（273、385 行）。
- **E248 面**（`tools/fanout-manifest.ts`）：`MAILBOX_RE`（67 行）原樣取值（369–370 行），render 在 812–855 行把它接成 `<root>/<lane>/`；worktree 欄的相對值已由 E235b 的 `resolveWorktree(…, primary)` 解析，primary 在同一個函式裡已算好。格式規格 `specs/e177a-fanout-manifest.md`（23、50 行）描述 `mailbox:`；測試 `test/e177a-manifest.test.mjs:342–343`。目前沒有任何 tracked 清單設 `mailbox:`。
- 兩條都**不碰**共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）；`content/skill-integrator.md` 只提 `--mailbox-root`，不必改。
- `bin/**` 沒有對應的 `dist/`（直接執行）；E248 只有 `dist/tools/fanout-manifest.*`。
- `scripts/fanout.mjs`、`scripts/mailbox-watch.mjs`、`scripts/lane-status.mjs`、`scripts/test-lock.mjs`、`scripts/merge-invariants.mjs` 在 base 上存在。`qa_reports/`、`review_reports/`、`specs/` tracked。task id：`T-E243-NN`、`T-E248-NN`。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e243 | E243 | feat/e243-init-path-escape-refusal | ../agent-governance-mcp-lanes/e243 | `bin/agc-init.mjs`、`docs/install.md`（只限 local 模式拒絕字元的那一條）、`test/e239-init-subdir-exclude.test.mjs`、`test/e108-eject.test.mjs`、`test/e106-init-artifacts-flag.test.mjs`、`test/e243-*.test.mjs`、`specs/e243-*`、`qa_reports/*E243*`、`review_reports/*E243*`、`.current/e243/**` | `content/**`、goldens、budget、`tools/**`、`scripts/**`、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、e248 的檔案 | 做：local 模式的拒絕集合在 `* ? [ ]` 之外加上反斜線與控制字元（至少 CR／LF；是否涵蓋全部 C0 控制字元由 PM 定）；`init` 拒絕、`agc check` 無法驗證、`eject` 跳過三條路徑行為一致；兩處使用者可見訊息與 `docs/install.md` 那一條同步改寫（不再只列四個字元）；`--artifacts=repo` 在這類路徑下照常可用；Windows（反斜線是路徑分隔符）行為不變或明確跳過。不做：escape 而非拒絕、E234 的掃描、任何 `agc check` 的其他檢查 | E239 ✓ |
| e248 | E248 | feat/e248-relative-mailbox-header | ../agent-governance-mcp-lanes/e248 | `tools/fanout-manifest.ts`、`dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`（只限 usage 文字）、`specs/e177a-fanout-manifest.md`（只限 `mailbox:` 的兩列）、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e248-*.test.mjs`、`specs/e248-*`、`qa_reports/*E248*`、`review_reports/*E248*`、`.current/e248/**` | `content/**`、goldens、budget、`bin/**`、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、其他 `tools/**`（只能 import）、其他 `scripts/**`、其他 `dist/**`、其他 `test/**`（含 `test/fixtures/e177a/**`；需要改 → 先寄信請整合者重劃）、`docs/**`（含 `docs/backlog.md`、`docs/lane-protocol.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、e243 的檔案 | 做：清單的 `mailbox:` 標頭接受相對於 primary 的值，render 時以已算好的 primary 解析成絕對路徑（與 E235b 的 worktree 欄同一套解析）；絕對值照樣可用；`--mailbox-root` 仍優先於標頭；`validate` 對標頭的檢查跟著新語意；格式規格的兩列同步。不做：`--mailbox-root` 旗標的語意、worktree 欄、`docs/lane-protocol.md`／SOP 散文、改寫任何既有清單（目前沒有清單設 `mailbox:`） | E235 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- `docs/install.md` → e243：只限 local 模式拒絕字元的那一條散文。
- `specs/e177a-fanout-manifest.md` → e248：只限描述 `mailbox:` 的兩列。
- `test/e106-init-artifacts-flag.test.mjs`、`test/e108-eject.test.mjs` → e243：預先劃入，只在訊息或 eject 行為變更讓它們變紅時才改（只有 qa，§2）。
- 本波沒有共享生成物持有者：兩條都不得改變任何組合出的 prompt 內容；若發現必須改，停下來寄信給整合者。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 含反斜線或 CR／LF 的 workspace 路徑，local 模式拒絕且什麼都不寫 | E243 | ✓ |
| `agc check`／`eject` 對同類路徑的處置與 `init` 一致 | E243 | ✓ |
| 使用者可見的訊息與 `docs/install.md` 不再只列四個字元 | E243 | ✓ |
| 清單 `mailbox:` 標頭可寫相對於 primary 的值，render 出絕對路徑 | E248 | ✓ |
| 絕對值與 `--mailbox-root` 的現有行為不變 | E248 | ✓ |
| 合併後整個 tracked tree 與未追蹤新檔、檔名以整合者關鍵字重掃零命中 | 整合者（合併後） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 兩條合併後：重建 `dist/`、全套測試；backlog E243／E248 done-mark、佇列 0h／0i 勾 DONE；`finish --shipped` 配號（finish 前先跑 `lane-status --rollup`）。
- 外洩重掃（關鍵字不寫入任何 tracked 檔）：完整與部分用戶名、連字號編碼的 session 目錄、暫存目錄、adopter 名稱的完整與短形式、個人 config 目錄名；範圍含 tracked 內容、未追蹤新檔、檔名，以及 qa／review 證據檔。
- 之後派 E234（0j），E243 合併後的 `bin/agc-init.mjs` 為其 base。

## 合併順序
e243 ∥ e248（檔案互斥，誰先 PASS 誰先合；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ 各自 `integ/<lane>` → ff `main`

## Dispatch pins
- e243：`sr-engineer=fable`（人類長期偏好）。
- e248：`sr-engineer=fable`（同上）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | E248 從 #69 提前、與 E243 並行；E234 從 #61 提前、排在 E243 合併之後，掃描關鍵字不得寫進 tracked 檔 | 整合者 session |
| 2026-09-28 | 整合者 | `docs/install.md`（一條）歸 e243、`specs/e177a-fanout-manifest.md`（兩列）歸 e248；e106／e108 兩個既有測試預先劃給 e243 | 本檔 |
| 2026-09-28 | 人類 | 核准本清單（含三項重劃與 E243 票面「三處訊息」實為兩處訊息＋一處文件＋eject 一處行為的更正），開始派工 | 整合者 session |
| 2026-09-28 | 整合者 | e248 cut 預審原樣通過（`6770283`）；驗證通過並合併（`70fc318`，5 commits，14 檔皆在範圍內；review 第 1 輪 APPROVED、qa 第 1 輪 PASS，hop 4/10；lane 層全套 2916/2919 0 fail）；無衝突 → 無合併審查；無新票 | 信箱 e248 to-integrator#2 |
| 2026-09-28 | 整合者 | e243 cut 預審要求三項（訊息回顯的控制字元要跳脫 → 新 AC14；AC6／AC7／AC13 補進 sr task；cut 先 commit），`9a07f6b` 談定；人類核准時未採用「反斜線也跳脫」的非必要建議 | 信箱 e243 to-lane#1／#2 |
| 2026-09-28 | 整合者 | e243 驗證通過並合併（`1b8dcb8`，8 commits，13 檔皆在範圍內 —— lane 自報的 expected-red 檔屬 lane 證據，`fanout check` 不判越界；review 第 1 輪 APPROVED、qa 第 1 輪 PASS，hop 4/10；lane 層全套 2914/2917 0 fail）；無衝突 → 無合併審查；roll-up 的證據不符（handoff 只記 1 個完成）併入 E247 作第二個實例 | 信箱 e243 to-integrator#3 |
