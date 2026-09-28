# Fan-out: E234 資訊衛生規則的機械檢查（`agc check` 建議性掃描，單一 lane）
base: b2dd238    integration branch: integ/e234

**狀態：已合併（2026-09-28，`integ/e234`）。** 佇列 0j（人類裁決 2026-09-28：從 #61 提前，排在 E243 合併之後）。0k 的 E250 同改 `bin/agc-init.mjs`，排在本 lane 合併之後，不並行。

## 派工前核對（整合者，2026-09-28）
- `git worktree list` 只有 primary；main = origin/main = `b2dd238`（v4.1.0 已發版並打 tag）；工作樹乾淨。
- 派工 base：本檔與佇列檔的 commit 落在 `b2dd238` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入）。
- 既有信箱：`_mailbox/e235a`、`_mailbox/e235b`、`_mailbox/e243`、`_mailbox/e248`（E246 留下），與 `e234` 不重名。
- 規則出處：`content/const-15-core-tail.md` 的 Information hygiene 條（第 16–22 行）列出五類 —— 雇主內部網址或工作項連結、第三方客戶／專案代號、設計工具檔案 key、憑證、本機絕對路徑／用戶名；E240 裁決 A 另把 adopter 專案資料夾名稱與以人名命名的個人 config 目錄列為敏感。
- `agc check` 的進入點是 `bin/agc-init.mjs` 的 `runCheck()`（約 1192 行），現有四個建議性檢查（`checkResearchBinaries`、`checkWorktreeEvidence`、`checkOrphanLanes`、`checkArtifactsDrift`）都不影響 exit code。`bin/**` 沒有對應的 `dist/`；`bin/agc-init.mjs` 已有以動態 import 讀 `dist/tools/*.js` 的前例（`lane-paths`、`lane-ticket-allocation`）。
- 使用者文件中描述 `agc check` 建議項的地方：`docs/install.md:152`、`docs/config.md:41–47`。
- **關鍵字來源的限制（人類裁決）**：掃描用的具體關鍵字（人名、公司、客戶代號、adopter 名稱等）不得寫進任何 tracked 檔 —— 包括程式碼、測試、fixture、spec、證據檔、commit 訊息。本 repo 的 `.current/` 是 tracked（repo 模式），所以關鍵字檔**不能**放在 `.current/` 底下；人類裁決：預設放在 `$(git rev-parse --git-common-dir)` 底下的一個檔案（永遠不會被 track，且所有 worktree 共用），另以環境變數覆寫路徑；無 git 的 workspace 只走環境變數。檔名、變數名與格式由 PM／architect 定；關鍵字比對加字詞邊界。測試只能用合成的假關鍵字。
- 不碰共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）：規則散文不改。若 lane 判斷 SOP 散文必須提到這個檢查，停下來寄信給整合者。
- 現存 tracked tree 以整合者關鍵字掃描零實際命中（E243 ∥ E248 結案重掃，26 處皆為泛用佔位字）→ 形狀類檢查（例如泛用的家目錄路徑樣式）在本 repo 會有已知誤報，人類裁決：內建泛用佔位用戶名清單，家目錄路徑的用戶名段落命中該清單時不列為命中，只印一行略過計數；不用行內標記（會碰範圍外的檔案）。細節由 PM 在 cut 裡定。
- task id：`T-E234-NN`。`qa_reports/`、`review_reports/`、`specs/` tracked。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e234 | E234 | feat/e234-hygiene-scan | ../agent-governance-mcp-lanes/e234 | `bin/agc-init.mjs`、`tools/hygiene-scan.ts`（新建，名稱由 architect 定）、上列新模組對應的 `dist/tools/**`、`docs/install.md`（只限 `agc check` 建議項那一段）、`docs/config.md`（只限 `agc check` 相關列）、`test/e234-*.test.mjs`、`test/fixtures/e234/**`、`specs/e234-*`、`qa_reports/*E234*`、`review_reports/*E234*`、`.current/e234/**` | `content/**`、goldens、budget、`prompts/**`、`gates/**`、`schema/**`、`templates/**`、`scripts/**`、其他 `tools/**`（只能 import）、其他 `dist/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、其他 `docs/**`（含 `docs/backlog.md`）、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：`agc check` 新增一個只警告、永不影響 exit code 的資訊衛生掃描；分兩層 —— (a) 內建的**形狀**樣式（本機絕對家目錄路徑、連字號編碼的家目錄路徑、系統暫存目錄路徑等，樣式本身是泛用的、不含任何具體名稱），(b) 從本機**不追蹤**來源讀取的**關鍵字**清單（位置與格式由 PM／architect 定，不得在 `.current/` 底下）；沒有關鍵字來源時只跑 (a) 並印一行說明；命中輸出只報檔案、行號與類別，**不回顯命中的字串**；掃描範圍涵蓋 tracked 檔內容、未追蹤且未被 ignore 的新檔內容，以及兩者的檔名；誤報以內建泛用佔位用戶名清單處理（見 Decisions）；文件同步。不做：阻擋（exit code 不變）、自動修正、git 歷史掃描、pre-commit hook、改寫規則散文、E250 | E231 ✓、E232 ✓、E240 ✓ |

## 所有權重劃（相對於 §3 預設 lane 表）
- 執行中追加（整合者，信箱 e234 to-lane#4）：`test/agc-adapters.test.mjs` 的 AC-6／AC-7／E111(iv) 與 `test/e106-init-artifacts-flag.test.mjs` 的 AC12 → e234，只限 qa 改斷言（先濾掉 `agc check — hygiene` 開頭的行，原斷言不變，每檔一個 helper）。`fanout check` 會把這兩檔列為越界，屬已記錄的重劃。
- 新模組 `tools/hygiene-scan.ts` 與其 `dist/` → e234（新建檔；若 architect 決定邏輯直接寫在 `bin/agc-init.mjs`，這兩項就不存在）。
- `docs/install.md`、`docs/config.md` → e234：只限描述 `agc check` 建議項的段落／列。
- 本波只有一條 lane，沒有共享生成物持有者：不得改變任何組合出的 prompt 內容。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `agc check` 對規則列出的類別發出建議性警告，exit code 不變 | E234 | ✓ |
| 具體關鍵字只從本機不追蹤的來源讀取；repo 裡沒有任何真實關鍵字 | E234 | ✓ |
| 命中輸出不回顯命中的字串 | E234 | ✓ |
| 掃描涵蓋未追蹤新檔與檔名 | E234 | ✓ |
| 在本 repo 跑 `agc check` 不被已知的泛用佔位字洗版 | E234 | ✓ |
| 合併後以整合者關鍵字重掃零實際命中 | 整合者（合併後） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試；backlog E234 done-mark、佇列 0j 勾 DONE；`lane-status --rollup` 後 `finish --shipped`。
- 以整合者七種形式重掃（tracked、未追蹤、檔名、證據檔、commit 訊息）；另外在 primary 設好整合者自己的本機關鍵字來源，跑一次新的 `agc check` 作為實測。
- 之後派 E250（0k），E234 合併後的 `bin/agc-init.mjs` 為其 base。

## 合併順序
e234（單一 lane；merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e234` → ff `main`

## Dispatch pins
- e234：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-28 | 人類 | E234 從 #61 提前到 0j、排在 E243 合併之後；掃描關鍵字不得寫進 tracked 檔，只能從本機不追蹤的來源讀取；E250 從 #71 提前到 0k、緊接 E234 | 整合者 session |
| 2026-09-28 | 整合者 | 關鍵字來源不得在 `.current/` 底下（本 repo 為 repo 模式，`.current/` tracked）；建議拆成泛用形狀樣式＋本機關鍵字兩層；範圍擴大到未追蹤新檔與檔名 （整合者建議） | 本檔 |
| 2026-09-28 | 人類 | 核准本清單；(1) 掃描範圍擴大到未追蹤且未被 ignore 的新檔內容與檔名；(2) 關鍵字檔預設在 git-common-dir 底下，環境變數可覆寫，不在 `.current/`；(3) 誤報以內建泛用佔位用戶名清單處理、只印略過計數 | 整合者 session |
| 2026-09-28 | 整合者 | e234 cut 預審兩輪：PM cut 要求三項（裸暫存根目錄不算命中、AC16 在 HEAD 的獨立副本上跑且所有 AC 清除關鍵字環境變數、AC→task 對照表）；architect 七個 Open Questions 照建議全收 | 信箱 e234 to-lane#1–#3 |
| 2026-09-28 | 整合者 | 範圍外 4 個 exact-stderr 測試重劃給 e234（見所有權重劃）；code review 第 1 輪發現檔名中緊貼底線的關鍵字會未遮罩印出 → D5 修訂為印出路徑一律以子字串遮罩關鍵字（新 AC18），落實既有完成定義「不回顯命中字串」，人類於 lane session 追認 | 信箱 e234 to-lane#4／#5 |
| 2026-09-28 | 整合者 | 驗證通過並合併（`8ababee`，16 commits，23 檔；越界僅上述重劃 2 檔；review 第 3 輪 APPROVED、qa 第 1 輪 PASS，hop 9/10；lane 層與整合層全套皆 2943/2946 0 fail）；無衝突 → 無合併審查；合併後以整合者本機關鍵字源重掃（tracked、未追蹤、檔名、證據檔、commit 訊息）零實際命中 —— 首次試跑的命中全是 repo 公開 GitHub 擁有者帳號（安裝網址、作者欄），屬公開身分而非外洩，已自本機關鍵字源移除；新票 E234-NEW-1 由 `finish --shipped` 配號 | 信箱 e234 to-integrator#6 |

## 結案
- 日期 2026-09-28；合併 commit 見 `integ/e234` 的 merge；例外：範圍外 2 個測試檔（已記錄的重劃）。
