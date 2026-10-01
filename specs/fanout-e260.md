# Fan-out: E260 縮減本 repo 既有的長註解
base: e9a19f2    integration branch: integ/e260（第一波）；integ/e260-w2（第二波）；integ/e260i（第三波）

**狀態：人類核准 2026-10-01；第一波派工中。** 佇列 #81。人類已核准的切法：依目錄切 8 條只改註解的 lane，分兩波各 4 條（第一波原始碼、第二波測試），最後第三波 e260i 單獨做兩個 budget／結構測試檔。各波之間沒有檔案重疊，分波只為了控制同時進行的 lane 數，以及讓原始碼的 `dist/` 先穩定。

## 派工前核對（整合者，2026-10-01）
- `git worktree list` 只有 primary；main = origin/main = `e9a19f2`（v4.4.0 已發版，`8ec02d2` 記帳，`e9a19f2` 開 E262）；工作樹乾淨；沒有殘留的 `feat/*`／`integ/*` branch。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。
- 派工 base：本檔的 commit 落在 `e9a19f2` 之上，第一波從那個 commit 開（render 時以 `--base` 傳入）。第二波、第三波的 base 在前一波合併後重新核對、改用當時的 main。
- `<lanes-root>/_mailbox/` 是空的，`e260a`–`e260i` 不重名。
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。
- **量測**（2026-10-01，main `e9a19f2`，用本 repo 自己的掃描器 `dist/tools/comment-scan.js` 的 `analyzeText`，與 `agc check` 同一套計數：JSDoc 標記行與只有分隔符號的行不計；`git ls-files` 的 JS/TS，排除 `dist/`、`.d.ts`、`test/fixtures/`）：

| lane | 檔案數 | 有長區塊的檔 | 8–20 行區塊 | >20 行區塊 | 最長 |
|---|---|---|---|---|---|
| e260a | 25 | 15 | 82 | 14 | 52 |
| e260b | 23 | 20 | 60 | 23 | 68 |
| e260c | 19 | 17 | 58 | 17 | 81 |
| e260d | 43 | 25 | 50 | 16 | 87 |
| e260e | 22 | 21 | 41 | 13 | 53 |
| e260f | 60 | 53 | 60 | 51 | 72 |
| e260g | 28 | 25 | 71 | 21 | 42 |
| e260h | 53 | 43 | 121 | 31 | 134 |
| e260i | 2 | 2 | 24 | 16 | 250 |

- **`dist/` 會跟著變**：`tsconfig.json` 沒設 `removeComments`，且開了 `declaration`、`declarationMap`、`sourceMap` → 改 `.ts` 註解會改到 `.js`、`.d.ts`（JSDoc 會帶進去）與 `.map`。e260a／e260b／e260d 各自重建並 commit 自己那一份 `dist/`；整合時再完整重建一次，不手動解衝突。e260c 的 `bin/`、`scripts/` 是 `.mjs`，不經編譯。
- task id：`T-E260A-NN` … `T-E260I-NN`。

### 測試釘住原始碼註解的地方（寫進對應 lane 的 prompt）
- `test/e178b-lane-watch.test.mjs:572` 用 `src.indexOf("// Watch mode (E178b")` 在 `tools/lane-status.ts` 定位 watch 區塊 → **e260b 保留這一行的開頭 `// Watch mode (E178b` 一字不變**（後面的文字可以改）。
- `test/e177b-lane-status.test.mjs:165`、`test/e235b-relative-worktree.test.mjs:296` 把 `tools/lane-status.ts` 以 `//` 開頭的行當註解濾掉；`test/dispatch-log.test.mjs:73` 對 `tools/dispatch-log.ts` 做同樣的事 → **e260a／e260b 不得把這兩個檔的 `//` 註解改成 `/* */` 區塊註解**。所有 lane 一律維持原本的註解樣式（`//` 還是 `//`，JSDoc 還是 JSDoc）。
- `test/e122-state-render-injection.test.mjs` 讀 `test/render-structure.test.mjs` 的 regex 字面值；`test/e178a-integrator-role.test.mjs` 讀 `test/skill-frontmatter.test.mjs` 的斷言 —— 都是程式碼，不是註解；e260f／e260h／e260i 仍須跑全套確認。
- 其他讀原始碼文字的測試比對的都是程式碼或字串；全套綠是最後的判準。

### 所有 lane 共通的範圍（寫進每條 lane 的 prompt）
- **只改註解**（`//`、`/* */`、JSDoc）。字串字面值、斷言訊息、錯誤訊息、tool description、測試名稱、檔名一律不動。每檔開頭的 `// Coded by @<role>` 標記行保留。`/*!` 與 `/// <reference` 不動。
- **縮減門檻**：超過 20 行的區塊一律縮減；8–20 行的區塊要嘛縮到 7 行內，要嘛在 review 報告逐一寫一行保留理由。計數以 `dist/tools/comment-scan.js` 的 `analyzeText`（與 `agc check` 同一套）為準。仍值得保留的理由先搬到 tracked 的 `specs/e260<x>-*.md`，註解只留最多一行指標；只縮減，不改寫邏輯。
- 同一輪順手修掉該範圍內剩下的 *Generic citation*（註解只寫票號、沒有白話）。
- **行為不變的證明**（人類已定）：改動前後每個改過的檔都用 TypeScript `transpileModule`（`removeComments: true`）轉譯，輸出一個 byte 都不差；全套測試維持綠。腳本放 `.current/e260<x>/`，寫法由 PM 定。
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。測試 lane 的交接照 E233 前例：qa 作者改完寫 `qa-engineer:Blocked`（撰寫完成，不是失敗）→ pm → code-reviewer（`resume_of`）→ 全新 Task 派出的 qa 驗證者寫 PASS。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值（e234 AC16 會抓）。
- 共同禁止：`content/**`、`test/fixtures/**`（含 goldens）、`test/context-budget.test.mjs`（e260i 以外）、`templates/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、非 JS/TS 檔（E259 範圍）、`.current/history/**`。

## Lanes（第一波，並行：原始碼）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e260a | E260 | feat/e260a-tools-a-h | ../agent-governance-mcp-lanes/e260a | `tools/{a,b,c,d,e,f,g,h}*`、`dist/tools/{a,b,c,d,e,f,g,h}*`、`specs/e260a-*`、`qa_reports/*E260A*`、`review_reports/*E260A*`、`.current/e260a/**` | 其他 `tools/**` 與 `dist/**`、`test/**`、`bin/**`、`scripts/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、`guards/**`、`transport/**`、`index.ts`、共同禁止 | 做：`tools/` 開頭 a–h 的 25 檔（82 個 8–20 行、14 個 >20 行區塊）照共通門檻縮減；重建並 commit 自己那一份 `dist/`。`tools/dispatch-log.ts` 的 `//` 樣式不變。不做：字串、錯誤訊息、tool description；需要改測試 → 先寄信給整合者 | E258 ✓ |
| e260b | E260 | feat/e260b-tools-i-z | ../agent-governance-mcp-lanes/e260b | `tools/{i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}*`、`dist/tools/{i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}*`、`specs/e260b-*`、`qa_reports/*E260B*`、`review_reports/*E260B*`、`.current/e260b/**` | 其他 `tools/**` 與 `dist/**`、`test/**`、`bin/**`、`scripts/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、`guards/**`、`transport/**`、`index.ts`、共同禁止 | 做：`tools/` 開頭 i–z 的 23 檔（60 個 8–20 行、23 個 >20 行區塊）照共通門檻縮減；重建並 commit 自己那一份 `dist/`。`tools/lane-status.ts` 保留 `// Watch mode (E178b` 行首、`//` 樣式不變（見上）。不做：同 e260a | E258 ✓ |
| e260c | E260 | feat/e260c-bin-scripts | ../agent-governance-mcp-lanes/e260c | `bin/**`、`scripts/**`、`specs/e260c-*`、`qa_reports/*E260C*`、`review_reports/*E260C*`、`.current/e260c/**` | `tools/**`、`dist/**`、`test/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、`guards/**`、`transport/**`、`index.ts`、共同禁止 | 做：`bin/`、`scripts/` 的 19 檔（58 個 8–20 行、17 個 >20 行區塊，最長 81 行）照共通門檻縮減；只改 JS/TS 檔。`.mjs` 不經編譯，行為證明一樣用 `transpileModule`。不做：CLI 輸出、usage 文字（是字串） | E258 ✓ |
| e260d | E260 | feat/e260d-core-dirs | ../agent-governance-mcp-lanes/e260d | `gates/**`、`prompts/**`、`schema/**`、`lib/**`、`guards/**`、`transport/**`、`index.ts`、`dist/{gates,prompts,schema,lib,guards,transport}/**`、`dist/index.*`、`specs/e260d-*`、`qa_reports/*E260D*`、`review_reports/*E260D*`、`.current/e260d/**` | `tools/**`、`dist/tools/**`、`test/**`、`bin/**`、`scripts/**`、共同禁止 | 做：上列目錄 43 檔（50 個 8–20 行、16 個 >20 行區塊，最長 87 行；含票面點名的 `gates/lease-override.ts`、`gates/stamp-provenance.ts`、`gates/feature-lease.ts`）照共通門檻縮減；重建並 commit 自己那一份 `dist/`。不做：`prompts/` 組出的文字（字串，會動到 goldens） | E258 ✓ |

## Lanes（第二波，並行：測試，第一波合併後派工）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e260e | E260 | feat/e260e-test-a-d | ../agent-governance-mcp-lanes/e260e | `test/_*`、`test/{a,b,d}*.test.mjs`、`test/{ch,com,conf,cons,cov,cu}*.test.mjs`、`specs/e260e-*`、`qa_reports/*E260E*`、`review_reports/*E260E*`、`.current/e260e/**` | 其他 `test/**`、所有原始碼目錄、`dist/**`、共同禁止 | 做：`test/` 開頭 a–d 的測試檔，加上 `test/_*` 的 6 個 worker／shim 輔助檔，共 22 檔（41 個 8–20 行、13 個 >20 行區塊）照共通門檻縮減。只改註解。不做：斷言、測試名稱、斷言訊息、`test/fixtures/**` | 第一波合併 |
| e260f | E260 | feat/e260f-test-e1-e2 | ../agent-governance-mcp-lanes/e260f | `test/e1*`、`test/e2*`、`specs/e260f-*`、`qa_reports/*E260F*`、`review_reports/*E260F*`、`.current/e260f/**` | 其他 `test/**`、所有原始碼目錄、`dist/**`、共同禁止 | 做：`test/e1*`、`test/e2*` 共 60 檔（含 `test/e148-seed-stamp.mjs`、`test/e259-lib.mjs`；60 個 8–20 行、51 個 >20 行區塊）照共通門檻縮減；另修 `test/e246-mailbox-teardown.test.mjs:57` `setupLane` 的註解：列出的回傳欄位多了 helper 沒回傳的 `lane`，改成實際回傳的 `{ repo, ticket, branch, lanePath, mailboxRoot, mailbox }`。不做：斷言、測試名稱、斷言訊息 | 第一波合併 |
| e260g | E260 | feat/e260g-test-e3-l | ../agent-governance-mcp-lanes/e260g | `test/e{3,4,5,6,7,8,9}*`、`test/error-*`、`test/eval-*`、`test/evidence-*`、`test/{f,g,h,i,j,k,l}*.test.mjs`、`specs/e260g-*`、`qa_reports/*E260G*`、`review_reports/*E260G*`、`.current/e260g/**` | `test/eval/**`、`test/fixtures/**`、其他 `test/**`、所有原始碼目錄、`dist/**`、共同禁止 | 做：`test/e*` 後半（e3–e9、`error-*`、`eval-*`、`evidence-*`，13 檔）加上 `test/` 開頭 f–l（15 檔），共 28 檔（71 個 8–20 行、21 個 >20 行區塊）照共通門檻縮減。不做：`test/eval/**`（歸 e260h）、斷言與測試名稱 | 第一波合併 |
| e260h | E260 | feat/e260h-test-m-z-eval | ../agent-governance-mcp-lanes/e260h | `test/{m,n,o,p,q,s,t,u,v,w,x,y,z}*.test.mjs`、`test/{ra,rel,rep,res,rev}*.test.mjs`、`test/eval/**`（不含 `test/eval/fixtures/**`）、`specs/e260h-*`、`qa_reports/*E260H*`、`review_reports/*E260H*`、`.current/e260h/**` | `test/render-structure.test.mjs`、`test/eval/fixtures/**`、其他 `test/**`、所有原始碼目錄、`dist/**`、共同禁止 | 做：`test/` 開頭 m–z（`render-structure` 除外）加上 `test/eval/` 的 4 個 `.mjs`，共 53 檔（121 個 8–20 行、31 個 >20 行區塊，最長 134 行）照共通門檻縮減。本波最重，PM 切 task 時請照檔案分批。不做：`test/render-structure.test.mjs`（歸 e260i）、`test/eval/fixtures/**`、斷言與測試名稱 | 第一波合併 |

## Lanes（第三波：budget／結構測試，第二波合併後派工）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e260i | E260 | feat/e260i-budget-render | ../agent-governance-mcp-lanes/e260i | `test/context-budget.test.mjs`、`test/render-structure.test.mjs`、`specs/e260i-*`、`qa_reports/*E260I*`、`review_reports/*E260I*`、`.current/e260i/**` | 其他 `test/**`、`test/fixtures/**`（含 goldens）、所有原始碼目錄、`dist/**`、共同禁止 | 做：兩個檔共 24 個 8–20 行、16 個 >20 行區塊（最長 250 行，`test/context-budget.test.mjs`）照共通門檻縮減。budget 數值、上限、斷言一律不動 —— 改的是測試檔的註解，不是組出來的 prompt，goldens 不應有任何差異。不做：budget 數值與上限、goldens、`content/**` | 第二波合併 |

## 所有權重劃與邊界（相對於人類核准的切法）
- **`test/e*` 的前後半**：依區塊數平衡，而不是依檔案數。`test/e1*`＋`test/e2*` → e260f（111 個長區塊）；e3–e9＋`error-*`／`eval-*`／`evidence-*` → e260g，加上 f–l 共 92 個長區塊。若照檔案數對半切（e1* 一組），e260f 87、e260g 116，比較不平均。
- `test/_*` 的 6 個 worker／shim 輔助檔（底線開頭，排序在 a 之前）→ e260e。
- `test/eval/**` → e260h（「eval」）；`test/eval-assertions.test.mjs`、`test/evidence-provenance.test.mjs`、`test/error-code-contract.test.mjs` 是 `test/e*`，歸 e260g。
- `test/context-budget.test.mjs`（c）與 `test/render-structure.test.mjs`（r）從 e260e／e260h 拿出來 → e260i；擁有清單用細一層的前綴避開它們（照 E233 的 e233c 寫法）。
- `dist/**`：e260a、e260b 依 `tools/` 檔名首字母切自己那一份 `dist/tools/`；e260d 拿其他編譯目錄與 `dist/index.*`。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `tools/` 沒有超過 20 行的區塊；8–20 行的區塊都縮到 7 行內或有一行保留理由 | E260（e260a、e260b） | 第一波 |
| `bin/`、`scripts/` 同上 | E260（e260c） | 第一波 |
| `gates/`、`prompts/`、`schema/`、`lib/`、`guards/`、`transport/`、`index.ts` 同上 | E260（e260d） | 第一波 |
| `test/`（`test/fixtures/` 除外）同上 | E260（e260e、e260f、e260g、e260h、e260i） | 第二、三波 |
| 行為不變：每條 lane 改前改後 `removeComments` 轉譯輸出 byte 一致，全套綠 | E260（每條 lane） | ✓ |
| 範圍內剩下的 *Generic citation* 修掉 | E260（每條 lane） | ✓ |
| 仍值得保留的理由搬進 tracked spec，註解只留一行指標 | E260（每條 lane，`specs/e260<x>-*`） | ✓ |
| `test/e246-mailbox-teardown.test.mjs:57` 的 `setupLane` 註解與實際回傳一致 | E260（e260f） | 第二波 |
| 合併後 `dist/` 重建一致、全套綠 | 整合者（每波合併後） | ✓ |
| 結案時以同一套掃描器重新量測，前後數字寫進結案欄 | 整合者（第三波合併後） | 第三波 |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 每波合併後：重建 `dist/`、全套測試；`lane-status --lanes … --rollup` 後逐條 `finish --shipped`；重新核對下一波的前提（base、量測、釘住的註解）後再派工。
- 第三波合併後：用本檔的量測方式重新量測，前後數字寫進結案欄；backlog E260 done-mark、佇列 #81 勾 DONE。
- 之後回報人類：是否發版由人類決定。

## 合併順序
第一波：e260a → e260b → e260c → e260d（四條檔案互斥，順序只為了讓 `dist/tools/` 兩半先進；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e260` 重建 `dist/`、全套 → ff `main`
第二波：e260e → e260f → e260g → e260h → `integ/e260-w2` → ff `main`
第三波：e260i → `integ/e260i` → ff `main`

## Dispatch pins
- e260a：`sr-engineer=fable`（人類長期偏好）。
- e260b：`sr-engineer=fable`（人類長期偏好）。
- e260c：`sr-engineer=fable`（人類長期偏好）。
- e260d：`sr-engineer=fable`（人類長期偏好）。
- e260e：`sr-engineer=fable`（人類長期偏好；測試 lane 的作者是 qa，此 pin 只在 PM 排了 sr 時生效）。
- e260f：`sr-engineer=fable`（同上）。
- e260g：`sr-engineer=fable`（同上）。
- e260h：`sr-engineer=fable`（同上）。
- e260i：`sr-engineer=fable`（同上）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-01 | 人類 | E260 切法：依目錄 8 條只改註解的 lane、兩波各 4 條，最後 e260i；行為證明用 `removeComments` 轉譯 byte 一致＋全套綠；>20 行一律縮、8–20 行縮到 7 行內或寫一行保留理由；測試檔由 qa 改、交接照 E233；e246 第 57 行 `setupLane` 註解一併修 | coordinator session |
| 2026-10-01 | 整合者 | `test/e*` 前後半依長區塊數平衡（e1*＋e2* ／ e3–e9＋er/ev），`test/_*` 歸 e260e，`test/eval/**` 歸 e260h；分三個整合 branch，每波合併後重新核對下一波前提 | 本檔 |
| 2026-10-01 | 人類 | 核准本清單（含 `test/e*` 依長區塊數切、`test/_*` 歸 e260e、`test/eval/**` 歸 e260h、三條整合 branch），開始第一波派工 | 整合者 session |
