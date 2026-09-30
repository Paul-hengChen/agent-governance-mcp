# Fan-out: E233 註解只寫票號 → 改寫成白話（＋ E241 併入）
base: 276d574    integration branch: integ/e233a（第一段五條並行 lane 共用一條）；第二段 integ/e233f

**狀態：第一段已合併（2026-09-30，`integ/e233a`）；第二段 e233f 待重新核對後派工。** 票面自己寫了切法：「按目錄切（`tools/`、`gates/`、`bin/`+`scripts/`、`test/` 分幾批、`content/` 因為 budget 放最後），每一片一條小 mini-chain」。本檔照這個切法分成 6 條 lane：**第一段 5 條並行**（原始碼 2 條、測試 3 條），**第二段 1 條**（`content/`，第一段合併後再派工）。E241（佇列 #64，已註明「併入 E233 一起做」）放進 e233b。

## 派工前核對（整合者，2026-09-29）
- `git worktree list` 只有 primary；main = origin/main = `276d574`；沒有殘留的 `feat/*`／`integ/*` branch。
- **primary 工作樹不乾淨**：`dist/index.js` 的檔案權限 100644 → 100755（內容沒變），在這次 session 之前就有，不是整合者改的。`agc feature start` 會因為工作樹不乾淨而拒絕開 lane，所以派工前要先處理（整合者不能 `checkout -- <file>`）→ 人類裁決：由人類 `chmod 644` 還原（2026-09-29）。
- 既有信箱：`_mailbox/e234`、`e235a`、`e235b`、`e243`、`e248`、`e250`，與 `e233a`–`e233f` 不重名。
- `qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。
- E233 排進佇列 `0l`（緊接 E250），與本檔同一個 commit。
- 量測（2026-09-29，git ls-files，排除 `dist/`、fixtures、docs）：含票號的註解行 —— `tools/` 32 檔 315 行；`gates/` 9 檔 37 行；`bin/` 3 檔 55 行；`scripts/` 13 檔 93 行；`prompts/` 3 檔 16 行；`schema/`＋`guards/`＋`lib/` 4 檔 5 行；`test/` 96 檔 1096 行；`content/` 13 檔 99 行。與票面數字（64 個原始碼檔約 660 行、test 約 1030 行、content 約 97 處）一致。
- `tsconfig.json` 沒設 `removeComments`，所以改 `.ts` 註解會改到 `dist/`：e233a／e233b 各自重建並 commit 自己那一份 `dist/`，整合時再重建一次。

### 測試釘住原始碼註解的地方（跨 lane 耦合，派工時寫進 prompt）
- `test/e178b-lane-watch.test.mjs:571` 用 `src.indexOf("// Watch mode (E178b")` 在 `tools/lane-status.ts:1264` 定位 watch 區塊。**e233a 必須保留這一行開頭的 `// Watch mode (E178b` 一字不變**（後面的文字可以改）。
- `test/e235b-relative-worktree.test.mjs:285` 與 `test/e177b-lane-status.test.mjs:165` 把 `tools/lane-status.ts` 裡以 `//` 開頭的行當註解濾掉，再斷言剩下的程式碼不含 `fanout`。**e233a 不得把 `tools/lane-status.ts` 的 `//` 註解改成 `/* */` 區塊註解**，否則註解文字會被當成程式碼。
- 其他讀原始碼文字的測試（`ac-execution`、`gates-expected-red`、`qa-flow`、`e114`、`e23`、`e26`、`e132`、`e137`、`e177a`、`lane-ticket-allocation`、`release-staging`）比對的都是程式碼或字串，不是註解；但 lane 仍須跑全套確認。
- `test/e122-state-render-injection.test.mjs` 讀 `test/render-structure.test.mjs` 的 regex 字面值；`test/e178a-integrator-role.test.mjs` 讀 `test/skill-frontmatter.test.mjs` 的斷言。兩者比對的都是程式碼，不是註解。

### 所有 lane 共通的範圍（寫進每條 lane 的 prompt）
- **只改註解**（`//`、`/* */`、JSDoc、`#`、markdown 內文）。字串字面值、斷言訊息、錯誤訊息、tool description、測試名稱、檔名一律不動 —— 那些是行為或被釘住的輸出，不在本票。
- 改寫規則：用白話寫出行為和理由；票號只能留在句尾當指標（例如 `… (E31)`），不能是唯一的解釋。規則全文見 `specs/e231-info-hygiene-rule.md` 的可讀性那一條（E107 併入 E231 的部分）。
- 行為不變：建議 PM 在 cut 裡放一條機械檢查 —— 去掉註解之後的輸出，改前改後一字不差（例如 TypeScript `transpileModule` 設 `removeComments: true`，`.mjs` 也能用）。怎麼驗由 PM 定。
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2），測試 lane 的鏈怎麼排由 PM 在 cut 裡定，但必須維持 builder ≠ judge（§3.2）。

## Lanes（第一段，並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e233a | E233 | feat/e233a-tools-comments | ../agent-governance-mcp-lanes/e233a | `tools/**`、`dist/tools/**`、`specs/e233a-*`、`qa_reports/*E233A*`、`review_reports/*E233A*`、`.current/e233a/**` | `content/**`、goldens、budget、`test/**`、`gates/**`、`bin/**`、`scripts/**`、`prompts/**`、`schema/**`、`guards/**`、`lib/**`、`transport/**`、`index.ts`、其他 `dist/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：`tools/` 下 32 檔約 315 行的票號註解改寫成白話，票號只留句尾指標；重建並 commit `dist/tools/**`。保留 `tools/lane-status.ts` 的 `// Watch mode (E178b` 行首，且該檔的 `//` 註解不改成區塊註解（見上）。不做：字串、錯誤訊息、tool description；需要改測試 → 先寄信給整合者 | E231 ✓ |
| e233b | E233, E241 | feat/e233b-core-comments | ../agent-governance-mcp-lanes/e233b | `gates/**`、`bin/**`、`scripts/**`、`prompts/**`、`schema/**`、`guards/**`、`lib/**`、`transport/**`、`index.ts`、`dist/{gates,prompts,schema,guards,lib,transport}/**`、`dist/index.*`、`CHANGELOG.md`（只限 E241 指出的那幾處引用）、`research/**`（只限 E241 指出的那幾處引用）、`specs/e233b-*`、`qa_reports/*E233B*`、`review_reports/*E233B*`、`.current/e233b/**` | `content/**`、goldens、budget、`test/**`、`tools/**`、`dist/tools/**`、`templates/**`、`docs/**`、`specs/fanout-*.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：E233 —— `gates/`、`bin/`、`scripts/`、`prompts/`、`schema/`、`guards/`、`lib/` 共 32 檔約 206 行的票號註解改寫成白話；重建並 commit 自己那一份 `dist/`。E241 —— `CHANGELOG.md`（約 2859 行）與 `research/visual-fidelity.md`（約 6 行）引用了一個新舊名字下都不存在的 recommendations 檔，另有幾個相對連結指向從未存在的檔案：改成文字描述或拿掉連結。不做：`CHANGELOG.md` 其他內容、字串／錯誤訊息／CLI 輸出 | E231 ✓、E232 ✓ |
| e233c | E233 | feat/e233c-test-comments-a | ../agent-governance-mcp-lanes/e233c | `test/{a,b,d}*.test.mjs`、`test/{ch,com,conf,cons,cov,cu}*.test.mjs`、`test/e1*.mjs`、`specs/e233c-*`、`qa_reports/*E233C*`、`review_reports/*E233C*`、`.current/e233c/**` | `content/**`、goldens、budget（含 `test/context-budget.test.mjs`）、`test/render-structure.test.mjs`、其他 `test/**`、`test/fixtures/**`、所有原始碼目錄、`dist/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json` | 做：所擁有的測試檔（約 46 檔、約 300 行；含非 `.test.mjs` 的 `test/e148-seed-stamp.mjs`）裡的票號註解改寫成白話。只改註解，不改斷言、測試名稱、斷言訊息。不做：fixtures | E231 ✓ |
| e233d | E233 | feat/e233d-test-comments-b | ../agent-governance-mcp-lanes/e233d | `test/e{2,3,4,5,6,7,8,9}*.test.mjs`、`test/er*.test.mjs`、`test/{f,g,h,i,j,k,l,m,n,o,p,q}*.test.mjs`、`specs/e233d-*`、`qa_reports/*E233D*`、`review_reports/*E233D*`、`.current/e233d/**` | `content/**`、goldens、budget、`test/render-structure.test.mjs`、其他 `test/**`、`test/fixtures/**`、所有原始碼目錄、`dist/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json` | 做：所擁有的測試檔（約 37 檔、約 360 行；含 `test/error-code-contract.test.mjs`）裡的票號註解改寫成白話。只改註解。不做：fixtures | E231 ✓ |
| e233e | E233 | feat/e233e-test-comments-c | ../agent-governance-mcp-lanes/e233e | `test/r{a,el,ep,es,ev}*.test.mjs`、`test/{s,t,u,v,w}*.test.mjs`、`test/eval/**`、`specs/e233e-*`、`qa_reports/*E233E*`、`review_reports/*E233E*`、`.current/e233e/**` | `content/**`、goldens、budget、`test/render-structure.test.mjs`、其他 `test/**`、`test/fixtures/**`、所有原始碼目錄、`dist/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json` | 做：所擁有的測試檔（約 11 檔、約 306 行；`release-staging` 140 行、`verify-release` 105 行佔大宗）裡的票號註解改寫成白話。只改註解。不做：fixtures | E231 ✓ |

## Lanes（第二段，序列，暫定 —— 第一段合併後重新核對再派工）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e233f | E233 | feat/e233f-content-ids | ../agent-governance-mcp-lanes/e233f | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/render-structure.test.mjs`、`dist/**`（只限重建）、`specs/e233f-*`、`qa_reports/*E233F*`、`review_reports/*E233F*`、`.current/e233f/**` | 其他 `test/**`、所有原始碼目錄、`templates/**`、`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`CLAUDE.md`、`AGENTS.md` | 做：`content/` 13 檔約 99 處票號引用改寫成白話（票號只留句尾指標），以及 `test/context-budget.test.mjs`（79 行）、`test/render-structure.test.mjs`（42 行）的票號註解；goldens／budget 由 qa 重新產生並逐段說明。組合出的 prompt 會變，所以要守住 budget floor。不做：`content/` 的規則內容本身 | e233a、e233b、e233c、e233d、e233e 合併 |

## 所有權重劃（相對於 §3 預設 lane 表）
- `tools/**` 整個 → e233a（打破 L-STATE／L-TRANS／L-GATE 把 `tools/` 分給多條 lane 的預設；本票只改註解，一條 lane 就裝得下）。
- `gates/`、`bin/`、`scripts/`、`prompts/`、`schema/`、`guards/`、`lib/`、`transport/`、`index.ts` → e233b（合併 L-GATE 的 gates 半邊、L-INIT、L-RELTOOL、L-MDTOOL、L-RENDER、L-SCHEMA）。
- `CHANGELOG.md`、`research/**`（只限 E241 的引用）→ e233b。`CHANGELOG.md` 通常只有 release-engineer 會動，這裡只改舊條目裡指向不存在檔案的那幾處。
- `test/**` 依檔名首字切成三批（e233c／e233d／e233e），彼此不重疊；共用測試檔 `test/context-budget.test.mjs`、`test/render-structure.test.mjs` 照 §3 歸內容 lane（e233f）。
- `dist/**`：e233a 只重建 `dist/tools/**`，e233b 只重建其他目錄；整合時再完整重建一次，不手動解衝突。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `tools/` 的註解不再只靠票號解釋 | E233（e233a） | ✓ |
| `gates/`、`bin/`、`scripts/`、`prompts/`、`schema/`、`guards/`、`lib/` 的註解不再只靠票號解釋 | E233（e233b） | ✓ |
| `test/` 的註解不再只靠票號解釋 | E233（e233c、e233d、e233e、e233f） | ✓（e233f 在第二段） |
| `content/` 的票號引用改成白話，票號只留句尾指標 | E233（e233f） | 第二段 |
| 行為不變：只動註解，全套測試與改前一致 | E233（每條 lane） | ✓ |
| CHANGELOG 與 research 不再引用不存在的檔案 | E241（e233b） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 第一段合併後：重建 `dist/`、全套測試；backlog E241 done-mark、佇列 #64 勾 DONE；`lane-status --rollup` 後逐條 `finish --shipped`。
- 重新核對第二段（e233f）的前提後再派工；e233f 合併後 E233 done-mark、佇列勾 DONE。
- 之後回報人類：是否發版由人類決定。

## 合併順序
第一段：e233a → e233b → e233c → e233d → e233e（五條檔案互斥，順序只為了讓原始碼先進；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e233a` 重建 `dist/`、全套 → ff `main`
第二段：e233f → `integ/e233f` → ff `main`

## Dispatch pins
- e233a：`sr-engineer=fable`（人類長期偏好）。
- e233b：`sr-engineer=fable`（人類長期偏好）。
- e233c：`sr-engineer=fable`（人類長期偏好）。
- e233d：`sr-engineer=fable`（人類長期偏好）。
- e233e：`sr-engineer=fable`（人類長期偏好）。
- e233f：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-09-29 | 人類 | E233 開始 fan-out | 整合者 session |
| 2026-09-29 | 整合者 | 照票面切法分成 6 條 lane（原始碼 2、測試 3、content 1）；E241 照佇列 #64 的註記併入 e233b；content 照票面放第二段 | 本檔 |
| 2026-09-29 | 人類 | 核准本清單（5 條並行 ＋ content 殿後），開始派工；`dist/index.js` 權限由人類 `chmod 644` 還原 | 整合者 session |
| 2026-09-29 | 整合者 | e233b 的 E241 範圍不放寬：只改清理後新舊名字都不存在的那一個 recommendations 檔；其他 CHANGELOG 引用已合併掉的 research 檔屬於照實的歷史，不動 | 信箱 e233b to-lane#2 |
| 2026-09-29 | 整合者 | 三條測試 lane 統一交接路徑：qa 作者寫 `qa-engineer:Blocked`（撰寫完成，不是失敗）→ pm → code-reviewer（resume_of）→ 全新 Task 派出的 qa 驗證者寫 PASS；作者不寫 state 不符合 const-05 | 信箱 e233c／e233d／e233e |
| 2026-09-29 | 整合者 | 跨 lane 通知三則：全套一律包 test-lock；證據與 spec 不寫本機路徑字面值（e234 AC16 會抓）；票號偵測要涵蓋小寫與帶字母段的 id；最後的全套在最後的 HEAD 上跑 | 信箱各 lane |
| 2026-09-30 | 整合者 | e233a 第一次收工退回：報告寫全套綠，但 3573a23 上 e234 AC16 紅（qa 證據檔寫了暫存目錄路徑，且全套在該 commit 之前跑）；修正後 fdc7bcb 重跑綠 | 信箱 e233a to-lane#3 |
| 2026-09-30 | 整合者 | 五條逐條核對通過（各自在回報 HEAD 乾淨樹重跑全套 2958/2955/0/3）；依序 merge 進 integ/e233a，零衝突 → 無合併審查；每次 merge 後 merge-invariants PASS；重建 dist/ 無差異；整合層全套 2958/2955/0/3 | 本檔 |
| 2026-09-30 | 整合者 | lane-status 彙總的 EVIDENCE MISMATCH：e233e 的驗證報告以 `covers:` 涵蓋 T-13..24 但沒有 PASS 標頭（格式差異，實質證據齊全）；e233c 為 covers 行解析誤判。接受，不退回 | 本檔 |
| 2026-09-30 | 整合者 | e233d 回報的 e132 gap-6 偶發失敗不屬任何 lane 範圍，由整合者配號 E254，佇列 #75 | 本檔 |

## 結案（第一段）
- 日期 2026-09-30；合併 branch `integ/e233a`（e233a→e233b→e233c→e233d→e233e，皆 `--no-ff`）；例外：無衝突、無合併審查。
- 彙總（每條 lane 各自對照上限，合計僅供參考）：e233a 9 張 task／hop 9；e233b 6／6；e233c 2／9；e233d 13／5；e233e 12／9；合計 42 張 task、38 hop。三條 lane 用到 hop 9/10，主要成本是作者第一輪改寫標準太窄與證據檔的路徑問題。
- 新票：E254（整合者）；E233B-NEW-1 由 `finish --shipped` 配號。
