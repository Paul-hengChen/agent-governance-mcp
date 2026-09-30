# Fan-out: E246 信箱收尾 ∥ E259 註解掃描擴大到其他語言
base: 7746626    integration branch: integ/e246-e259

**狀態：人類核准 2026-09-30；派工中。** 佇列 #80（E259）與 E246（P3）。兩條並行 lane，檔案互不重疊，沒有共享生成物（兩條都不動 `content/` 的組合片段、goldens、budget）。E260（佇列 #81）不在這一波：它會改到兩條 lane 的檔案，等本波合併後另開清單。

## 派工前核對（整合者，2026-09-30）
- `git worktree list` 只有 primary；main = origin/main = `7746626`（v4.3.0 已發版，`3c3e649` 為發版後記帳，`7746626` 為 E260 開票）；工作樹乾淨；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.3.0`。
- 派工 base：本檔的 commit 落在 `7746626` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入）。
- 既有信箱沒有 `e246`／`e259`（E246 未修，14 個舊信箱留在原處），不重名。
- **E246 的落點**：`bin/agc-init.mjs` 的 `runFeatureFinish()`（約 3049 行）；兩條拆除路徑都經過 `removeWorktreeNoForce(repoRoot, lanePath, …)`（約 2169 行，呼叫點約 3153、3196 行）。`agc feature start` 的預設 worktree 是 `<parent>/<repo>-lanes/<ticket-id>`，整合者的信箱在 `<lanes-root>/_mailbox/<lane>/`，所以預設配置下 lanes-root = worktree 的上層目錄。信箱內容：`to-integrator.md`、`to-lane.md`，watch 期間另有 `.<name>.watch-lock` sidecar（`scripts/mailbox-watch.mjs` 約 289 行）。
- **E246 的 SOP 面**：`content/skill-integrator.md` 第 3 階段第 3 點（約 88 行，建立信箱）與第 6 階段第 3 步（約 161 行，`finish --shipped`）。`content/skill-integrator.md` 不在任何 compose golden 或 `test/context-budget.test.mjs` 裡；釘住它原文的測試是 `test/e178a-integrator-role.test.mjs`（字串斷言）與 `test/skill-frontmatter.test.mjs`。
- **E259 的落點**：`tools/comment-scan.ts`（416 行；`lexLines` 約 91 行只懂 JS 語法，`isScannablePath` 約 303 行寫死 `.ts/.tsx/.js/.jsx/.mjs`，摘要行文字在 `commentCopy` 約 53–64 行）。`bin/agc-init.mjs` 的 `checkComments()`（約 1231 行）只呼叫 `runCommentScan`，不看副檔名 → E259 不需要改 `bin/`。
- **釘住掃描行為的測試**：`test/e258b-comment-scan.test.mjs` 的 AC8（約 233–247 行，`w.py`、`a.cjs`、`a.mts` 目前斷言為不掃）與摘要行斷言（約 356 行，`only .ts/.tsx/.js/.jsx/.mjs are scanned`）→ 事先重劃給 e259（見所有權重劃）。
- **兩條 lane 唯一的共同檔案**：`docs/install.md`（E259 改 161 行的掃描段落；E246 需要在 186–200 行的 `agc feature finish` 段落加一句）→ 整份給 e259，E246 那一句列入「整合後」由整合者補。
- 量測數據、門檻、範圍：`docs/backlog.md` E246、E259 列（引用，不在此重述）；人類裁決見下方 Decisions。
- task id：`T-E246-NN`／`T-E259-NN`。`qa_reports/`、`review_reports/`、`specs/` tracked。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e246 | E246 | feat/e246-mailbox-teardown | ../agent-governance-mcp-lanes/e246 | `bin/agc-init.mjs`、`content/skill-integrator.md`、`docs/lane-protocol.md`（只限信箱生命週期的說明）、`test/e246-*.test.mjs`、`test/fixtures/e246/**`、`specs/e246-*`、`qa_reports/*E246*`、`review_reports/*E246*`、`.current/e246/**` | 其他 `content/**`、goldens、budget、`tools/**`、`dist/**`、`scripts/**`（含 `scripts/mailbox-watch.mjs`）、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、`docs/install.md`、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：`agc feature finish`（`--shipped` 與 `--abandoned` 兩條路徑）在拆掉 worktree 之後刪除 `<worktree 的上層目錄>/_mailbox/<lane>/`；只在資料夾裡只有 `to-integrator.md`、`to-lane.md` 與 `.*.watch-lock` sidecar 時才刪；有不認得的檔案或 watch-lock 的持有行程還活著 → 印一行警告、不刪，finish 照常成功；資料夾不存在 → 靜默不做事；finish 的 usage 文字同步。integrator SOP：第 3 階段寫明同名的既有信箱要清空重建、不沿用；第 6 階段寫明 finish 會一併清掉預設位置的信箱，信箱不在預設位置（`--mailbox-root` 或清單的 `mailbox:` 標頭指向別處）時由整合者手動刪。不做：`scripts/mailbox-watch.mjs`、清單格式、刪除現存的 14 個舊信箱（整合者合併後處理）、`docs/install.md` | E73 ✓、E177b ✓ |
| e259 | E259 | feat/e259-comment-scan-languages | ../agent-governance-mcp-lanes/e259 | `tools/comment-scan.ts`、`tools/comment-*.ts`（新建，拆出語言表時；名稱由 PM／sr 定）、上列模組對應的 `dist/tools/**`、`docs/install.md`（只限 `agc check` 註解掃描那一段）、`docs/config.md`（只限 comment-length scan 那一列）、`test/e259-*.test.mjs`、`test/fixtures/e259/**`、`specs/e259-*`、`qa_reports/*E259*`、`review_reports/*E259*`、`.current/e259/**` | `content/**`、goldens、budget、`bin/**`、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`scripts/**`、其他 `tools/**`（只能 import）、其他 `dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：註解掃描改成每種語言一張語法表；新增 `//`＋`/* */` 語言 `.java .kt .kts .swift .go .rs .c .h .cc .cpp .cxx .hpp .cs` 與 JS 的 `.cjs .mts .cts`，`#` 語言 `.py .sh .bash .zsh .rb`（Ruby `=begin/=end` 算註解；shebang 不算）；Python docstring 算註解；各語言的字串寫法絕不能被當成註解，每一種都有測試固定：Rust `r#"…"#`、C++ `R"(…)"`、C# `@"…"` 與 `"""…"""`、Go 反引號、Kotlin／Swift 多行字串、Python 三引號（非 docstring 位置）；Rust／Swift／Kotlin 的巢狀區塊註解正確收尾；不認得的副檔名照樣跳過；摘要行改列實際掃描的副檔名；門檻、diff 範圍與 JSDoc 標記排除規則不變（其他語言的文件註解標記是否排除由 PM 定，須寫明）；文件同步。不做：YAML／TOML 等設定檔、阻擋、自動修正、整個 repo 掃描、改寫規則散文或 reviewer SOP | E258 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- 事先追加給 e259（只限 qa 改斷言）：`test/e258b-comment-scan.test.mjs` 的 AC8（`isScannablePath` 的正反例清單）與摘要行斷言（`only .ts/.tsx/.js/.jsx/.mjs are scanned`）。其餘斷言不變。`fanout check` 會把這個檔列為越界，屬已記錄的重劃。
- 事先追加給 e246（只限 qa 改斷言，且只在 SOP 修改確實讓既有斷言失效時）：`test/e178a-integrator-role.test.mjs`。優先做法是保留被釘住的原文一字不差、只新增句子。
- `docs/install.md` 整份 → e259；E246 在 `agc feature finish` 段落需要的那一句由整合者在整合後補（見「整合後」）。
- 新模組 `tools/comment-*.ts` 與其 `dist/` → e259（新建檔；若邏輯留在 `tools/comment-scan.ts`，這兩項就不存在）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `agc feature finish` 拆除 lane 時刪掉預設位置的信箱，且不刪不認得的內容 | e246 | ✓ |
| integrator SOP 寫明同名信箱清空重建，以及非預設位置信箱由整合者手動刪 | e246 | ✓ |
| 使用者文件說明 finish 會清信箱 | 整合者（整合後，`docs/install.md` 一句） | ✓ |
| 註解掃描涵蓋上列語言，字串寫法不被誤判、巢狀註解正確收尾 | e259 | ✓ |
| 摘要行與使用者文件列出實際掃描的副檔名 | e259 | ✓ |
| 合併後全套測試綠 | 整合者（合併後） | ✓ |
| 現存 14 個舊信箱清除 | 整合者（合併後，人類已同意） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試；`docs/install.md` 的 `agc feature finish` 段落補一句「也會刪除預設位置的整合者信箱」（依 e246 實際行為用字）；backlog E246、E259 done-mark、佇列 #80 勾 DONE；`lane-status --lanes e246,e259 --rollup` 後依序 `finish --shipped`（此時 e246 的新 finish 已在 main 上，會順手清掉這兩條 lane 的信箱，當作實測）。
- 確認每個舊信箱資料夾只有 `to-integrator.md`／`to-lane.md` 後刪除（e233a–f、e234、e235a、e235b、e243、e248、e250、e258a、e258b）。
- 在 primary 做一次 diff 實測：刻意在暫存的 `.py` 與 `.rs` 檔各加一段 8 行註解，跑 `agc check`，確認各出現一行 `agc check — comments` 警告，再刪除。

## 合併順序
e246 → e259（兩條檔案互斥，順序無依賴；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e246-e259` 重建 `dist/`、全套 → ff `main`

## Dispatch pins
- e246：`sr-engineer=fable`（人類長期偏好）。
- e259：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-30 | 人類 | 核准 coordinator 的切法：E246 ∥ E259 先做，E260 延後；E246 採選項 (iii)（工具刪信箱、SOP 寫明）；E259 語言清單照 coordinator 提案，Python docstring 算註解，YAML／TOML 不掃；通過後合併進 main 並 push；E246 合併後刪除 14 個舊信箱 | coordinator session |
| 2026-09-30 | 整合者 | 拆成 e246 ∥ e259；`docs/install.md` 整份給 e259，E246 的文件句子列入整合後；`test/e258b-comment-scan.test.mjs` 兩處斷言事先重劃給 e259；`test/e178a-integrator-role.test.mjs` 條件式重劃給 e246 | 本檔 |
| 2026-09-30 | 整合者 | e246 只處理預設位置（worktree 上層目錄的 `_mailbox/`）：finish 不讀 fan-out 清單，無從得知 `--mailbox-root` 或 `mailbox:` 標頭的自訂位置；自訂位置交給 SOP 的手動步驟 | 本檔 |
| 2026-09-30 | 人類 | 核准本清單（含四項重劃／切分），開始派工 | 整合者 session |
