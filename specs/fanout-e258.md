# Fan-out: E258 註解篇幅規則（規則散文 ∥ `agc check` 建議性掃描）
base: 64fccf5    integration branch: integ/e258

**狀態：人類核准 2026-09-30；已結案（兩條 lane 皆合併進 main）。** 佇列 #79。把 backlog E258 拆成兩條並行 lane：e258a 寫規則散文與 reviewer 檢查項（持有全部共享生成物），e258b 做 `agc check` 的註解篇幅掃描。兩條 lane 的檔案互不重疊；唯一的交界是掃描輸出的行首字串，由本檔固定（見「交界契約」）。

## 派工前核對（整合者，2026-09-30）
- `git worktree list` 只有 primary；main = origin/main = `64fccf5`（v4.2.1 已發版並打 tag，`ff6f111` 為發版後記帳）；工作樹乾淨；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.2.1`。
- 派工 base：本檔的 commit 落在 `64fccf5` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入）。
- 既有信箱沒有 `e258a`／`e258b`（E246 仍未修，舊信箱留在原處），不重名。
- **規則出處**：`content/const-15-core-tail.md` §6 的 Information hygiene（16–22 行）與 Generic citation（23–28 行）；新條文放在 Generic citation 之後。const-15 是 core 片段，每一種組合模式都會帶到，所以 `test/context-budget.test.mjs` 的每一個 floor 都會受影響；該檔上限是零餘裕的實測值。
- **reviewer SOP**：`content/skill-code-reviewer.md`（95 行）。
- **掃描的落點**：`agc check` 的進入點是 `bin/agc-init.mjs` 的 `runCheck()`（約 1223 行），現有五個建議性檢查；E234 的前例是把邏輯放在 `tools/hygiene-scan.ts`，由 `bin/agc-init.mjs` 以動態 import 讀 `dist/tools/hygiene-scan.js`（約 1195–1212 行）。`bin/**` 沒有對應的 `dist/`。
- **釘住 `agc check` 輸出的測試**：`test/agc-adapters.test.mjs:225–230`、`test/e106-init-artifacts-flag.test.mjs:338–343` 已用 helper 濾掉 `agc check — hygiene` 開頭的行；新掃描若在這些案例印出任何行，同一個 helper 要多濾一個行首字串 → 事先重劃給 e258b（見所有權重劃）。
- 使用者文件中描述 `agc check` 建議項的地方：`docs/install.md:152–154`、`docs/config.md:47–48`。
- 量測數據、門檻、範圍：`docs/backlog.md` E258 列（引用，不在此重述）。
- task id：`T-E258A-NN`／`T-E258B-NN`。`qa_reports/`、`review_reports/`、`specs/` tracked。

## 交界契約（兩條 lane 都照這裡，不各自發明）
- 掃描輸出每一行以 `agc check — comments` 開頭；exit code 不變。
- e258a 的 reviewer 檢查項以這個行首字串指稱掃描結果；e258b 的輸出與文件用同一個字串。其餘細節（類別名稱、訊息格式）由 e258b 的 PM／architect 定，e258a 不引用。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e258a | E258（規則散文） | feat/e258a-comment-rule | ../agent-governance-mcp-lanes/e258a | `content/const-15-core-tail.md`、`content/skill-code-reviewer.md`、`content/skill-sr-engineer.md`（只限 PM 決定把文件註解格式放在這裡時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e258a-*.test.mjs`、`specs/e258a-*`、`qa_reports/*E258A*`、`review_reports/*E258A*`、`.current/e258a/**` | 其他 `content/**`、`bin/**`、`tools/**`、`dist/**`、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`scripts/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、`docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：constitution §6 新增一條註解規則（WHAT／WHY、不寫 HOW、函式內部少寫、長篇 rationale 放 tracked spec 或 commit message 並只留一行指標；文件註解第一行一句話摘要 ≤ 80 欄、只寫呼叫端需要的、註解內出現 `##` 標題視為貼上 spec）；`skill-code-reviewer.md` 新增檢查項：diff 裡每一個 `agc check — comments` 警告，要嘛在 review 報告寫一行理由保留，要嘛退回刪減；重新產生 compose goldens；依 R2 裁決調整 `context-budget` 上限（允許提高，幅度以 qa 實測為準，不預留餘裕）。不做：掃描程式、使用者文件、改寫既有註解 | E231 ✓ |
| e258b | E258（掃描） | feat/e258b-comment-scan | ../agent-governance-mcp-lanes/e258b | `bin/agc-init.mjs`、`tools/comment-scan.ts`（新建，名稱由 architect 定）、上列新模組對應的 `dist/tools/**`、`docs/install.md`（只限 `agc check` 建議項那一段）、`docs/config.md`（只限 `agc check` 相關列）、`test/e258b-*.test.mjs`、`test/fixtures/e258b/**`、`specs/e258b-*`、`qa_reports/*E258B*`、`review_reports/*E258B*`、`.current/e258b/**` | `content/**`、goldens、budget、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`scripts/**`、其他 `tools/**`（只能 import）、其他 `dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：`agc check` 新增一個只警告、永不影響 exit code 的註解篇幅掃描，只掃 diff（檔案註解比例 > 30%、單一註解區塊 > 7 行）；輸出行首為 `agc check — comments`；三點補充照 R1 裁決做：(a) 檔案比例只在 diff 對該檔新增註解行時才警告、區塊只在 diff 新增或拉長時才警告，(b) 非空白行 < 50 的檔案不檢查比例、區塊長度照常檢查，(c) JSDoc 標記行（`@param`、`@returns`、`@throws`、`@example` 及其內容）不計入 7 行；diff 的基準、支援的語言與註解語法由 PM／architect 定；文件同步。不做：阻擋、自動修正、整個 repo 掃描、函式內部註解偵測（需要語法樹，留給後續票）、改寫規則散文 | E234 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- 共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）→ 只給 e258a。e258b 不得改變任何組合出的 prompt 內容。
- 事先追加給 e258b（只限 qa 改斷言）：`test/agc-adapters.test.mjs` 與 `test/e106-init-artifacts-flag.test.mjs` 裡濾掉 `agc check — hygiene` 行的那兩個 helper，多濾 `agc check — comments` 開頭的行；原斷言不變。`fanout check` 會把這兩檔列為越界，屬已記錄的重劃。只有在新掃描確實會在這些案例印出行時才改。
- 新模組 `tools/comment-scan.ts` 與其 `dist/` → e258b（新建檔；若 architect 決定邏輯直接寫在 `bin/agc-init.mjs`，這兩項就不存在）。
- `content/skill-sr-engineer.md` → e258a：只在 PM 決定把文件註解格式的細節放在建造者 SOP 時才改；否則不動。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 每個載入角色 prompt 的 agent 讀得到註解規則（WHAT／WHY、不寫 HOW、長篇 rationale 放別處） | e258a | ✓ |
| 文件註解格式（一行摘要、只寫呼叫端需要的、`##` 標題退回）有明文 | e258a | ✓ |
| code-reviewer 對每一個 `agc check — comments` 警告逐項判斷並留紀錄 | e258a | ✓ |
| `agc check` 對 diff 裡超過門檻的檔案與區塊發出警告，exit code 不變 | e258b | ✓ |
| 輸出行首與 reviewer 檢查項引用的字串一致 | e258a ＋ e258b（交界契約） | ✓ |
| 使用者文件說明新掃描 | e258b | ✓ |
| 合併後全套測試綠、組合出的 prompt 在預算內 | 整合者（合併後） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試；確認 reviewer 檢查項引用的行首字串與 e258b 實際輸出一致（`grep` 兩邊）；backlog E258 done-mark、佇列 #79 勾 DONE；`lane-status --rollup e258` 後依序 `finish --shipped`。
- 在 primary 做一次 diff 實測：刻意加一段 8 行註解，跑新的 `agc check`，確認出現一行 `agc check — comments` 警告，再還原。

## 合併順序
e258a（持有共享生成物，先合）→ e258b（每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e258` → ff `main`

## Dispatch pins
- e258a：`sr-engineer=fable`（人類長期偏好）。
- e258b：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-30 | 人類 | 註解規則照 Linux kernel coding style §8 的精神；門檻：檔案比例 30%、區塊 7 行、只掃 diff；只約束在 agc 管理的 workspace 裡工作的 agent | coordinator session；`docs/backlog.md` E258 |
| 2026-09-30 | 整合者 | 拆成 e258a（規則散文＋共享生成物）∥ e258b（掃描），以 `agc check — comments` 行首字串為交界契約；兩個釘住 `agc check` 輸出的測試 helper 事先重劃給 e258b （整合者建議） | 本檔 |
| 2026-09-30 | 人類 | 核准本清單（含拆票與重劃）；R1：三點掃描補充全部照做；R2：(i) 允許 `context-budget` 上限提高，幅度以 qa 實測為準 | 整合者 session |
| 2026-09-30 | 整合者 | e258a 預審：reviewer 檢查項改為對 diff 新增的每則註解套用規則，警告只是觸發（採納）；e258b 兩段預審：摘要行指名 Comment discipline、只掃 JS/TS 須寫明並另開其他語言票、OQ1 照 architect 提案（AC14b 自檢＋lane diff 證據須貼輸出）、不得以行尾註解承載說明（皆採納） | 信箱 e258a to-lane#1–#2；e258b to-lane#1–#3 |
| 2026-09-30 | 整合者 | 兩條 lane 驗證通過（e258a `1ae5753`、e258b `0499095`，皆 0 越界，review 與 qa 皆第一輪通過）；合併無衝突 → 無合併審查。合併後 `agc check` 標出 e258a 的註解（當時掃描不存在，lane review 看不到）→ 派 code-reviewer 在 integ 上審：5 保留、1 退回（e258a 測試檔頭 16 行、對應表列出不存在的測試名稱）→ 退回 e258a，qa 以 T-E258A-03 縮為 3 行並刪一行重複說明（`a00926a`），重新合併後該警告消失 | 信箱 e258a to-lane#4–#7；`review_reports/review_integ-e258-comments.md` |
| 2026-09-30 | 整合者 | 例外紀錄：e258a 的 qa 在 T-E258A-03 對自己未發佈的 commit 用了一次 `git commit --amend`（constitution §6 對所有角色禁止）；被改寫的 sha 沒有被任何證據、信箱或狀態檔引用，lane 自行申報；不再改寫歷史，只在此記錄 | 信箱 e258a to-integrator#5 |

## 結案
- 日期 2026-09-30；合併 commit 見 `integ/e258` 的 merge；整合層全套 2998 / 2995 pass / 0 fail / 3 skipped；roll-up：e258a hop 6/10、e258b hop 5/10，review／qa 皆第一輪通過（e258a 另有一次整合後退回）。
- 例外：上列 `--amend` 一次；`lane-status --rollup e258` 因 lane 的 active_feature 名稱不同而判定 undetermined，改以 `--lanes e258a,e258b` 取得數字。
- 完成定義七項全部成立（「輸出行首一致」已在 integ 上以 grep 兩邊確認；diff 實測以 8 行暫存檔觸發 `long-block 8 lines` 後刪除）。
