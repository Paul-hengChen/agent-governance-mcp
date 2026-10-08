# Fan-out: E260 後續票（規則文字＋註解準確度）
base: f3ffb97    integration branch: integ/e260-followups
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類核准 2026-10-07；已派工。2026-10-07 追加第四條 lane e275（E275，人類裁決）：三條 lane 的 build 都被 §6 dependency audit 擋住，e275 先修、先合進 main，再由整合者把 main merge 進三條 lane。** E260 結案時留下 12 張後續票（佇列 #84–#95，E263–E274）；人類 2026-10-07 裁決：E263 排除（需要先裁決 Comment discipline 是否涵蓋 `//` 檔頭與 30% 比例要不要再縮）、E269 納入、E266 延後（資料形狀需要設計，chain 最長）。E256（佇列 #77）與 E265 同檔同類，一起納入。E267 只改一份 spec，不開 lane，由整合者在整合後處理。三條並行 lane，檔案互不重疊；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）只歸 e269。

## 派工前核對（整合者，2026-10-07）
- `git worktree list` 只有 primary；main = origin/main = `f3ffb97`（v4.4.1 已發版，`8359f1a` 記帳，`f3ffb97` 佇列 #81 改成已發版）；工作樹只有一個未追蹤的討論稿 `docs/integrator-session-per-wave-2026-10-07.md`（不屬於本波，不動）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.4.1`。
- 派工 base：本檔的 commit 落在 `f3ffb97` 之上，lane 從那個 commit 開（render 時以 `--base` 傳入）。
- `<lanes-root>/_mailbox/` 是空的，`e269`／`e264`／`e268` 不重名。`qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。
- **E256 的落點**：`content/skill-release-engineer.md` 第 249 行（step 13a）引用同檔 `:143`、`:196`；第 26 行的 Reason 段以 E104 為唯一指標（E104 已是無關的票）。
- **E265 的落點**：同檔第 265 行引用 `scripts/verify-release.mjs:113-125`。
- **E269 的落點**：`content/const-15-core-tail.md` 第 12 行（§6 *Sanctioned git operations*）；code-reviewer、qa-engineer 的 SOP 目前都沒有提到 stash 或負向對照。`const-15` 會組進全部 11 個 compose golden，也計入 `test/context-budget.test.mjs` 的憲法上限（stripped ≤ 10057 ~tok，第 554–562 行）。`test/e178a-integrator-role.test.mjs:249` 一字不差地釘住 §6 的第一句（`the only sanctioned git mutations are … and \`git stash\` / \`git stash pop\``），之後逐項檢查 FORBIDDEN 清單。三份 role SOP（release-engineer、code-reviewer、qa-engineer）不在任何 compose golden 裡。
- **E274 的落點**：`test/context-budget.test.mjs` 第 475 行（標題 4376、斷言 4401）、第 490 行（標題 2642、斷言 2852）。
- **E264 的落點**：`tools/lane-paths.ts:6`（`(resolveCurrentLane too)`）、`tools/merge-invariants.ts:158–159`（`tasks-file.ts:216/703`）、`tools/telemetry.ts:6`（`.current/usage.jsonl`）、`tools/lane-migrate.ts:320`（`readHandoffState`）。`test/lane-paths.test.mjs`、`test/lane-migrate.test.mjs` 的 allow-list 用 grep 數這些檔的 token；只改註解，token 數必須不變。`tsconfig.json` 沒設 `removeComments` → 改註解會改到 `dist/`。
- **E268／E270／E271／E273／E272 的落點**（全部仍在 main 上）：`test/drift-skew.test.mjs:37`、`:172`；`specs/e260e-comment-rationale.md:50`；`test/agc-adapters.test.mjs:5`；`test/e22-stale-notify.test.mjs:3`（另有 `:398`、`:494` 也寫 `tools/handoff.ts`，PM 判定是否同類）；`test/gates-expected-red.test.mjs:3`（U1-U12，U13 在 `:153`）；`specs/e260g-comment-rationale.md`；`test/e92-e86-handoff-write-boundary.test.mjs`；`test/lane-ticket-allocation.test.mjs:4`（133 欄）；`test/pixel-gate-attestation.test.mjs:5`；`test/qa-flow.test.mjs`（沒有指向 `specs/e260h-comment-rationale.md:79` 的指標）；`test/subagent-templates.test.mjs:20–72`（`teamwork` 對到 `skill-coordinator.md`）。
- task id：`T-E269-NN`／`T-E264-NN`／`T-E268-NN`。

### 所有 lane 共通的範圍（寫進每條 lane 的 prompt）
- 註解修正一律只改註解；字串字面值、斷言訊息、錯誤訊息、檔名不動。E274 與 E272 例外（測試名稱與期望表是程式碼，票面本來就要改）。
- 只改註解的檔案，行為不變的證明照 E260 前例：改動前後用 TypeScript `transpileModule`（`removeComments: true`）轉譯，輸出一個 byte 都不差。腳本放 `.current/<lane>/`。
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。純測試 lane 的交接照 E233／E260 前例：qa 作者改完寫 `qa-engineer:Blocked`（撰寫完成，不是失敗）→ pm → code-reviewer（`resume_of`）→ 全新 Task 派出的 qa 驗證者寫 PASS。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 負向對照（例如故意改壞再確認測試會抓）在 worktree 外的複本上做，不要用 `git stash`（E269 本身就是這個問題）。
- 共同禁止（e275 例外：它擁有 `package.json`、`package-lock.json`、`docs/dependency-advisories.md`）：`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.current/history/**`、`gates/registry.ts` 與 `test/error-code-contract.test.mjs`（E266，延後）。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e269 | E269、E256、E265、E274 | feat/e269-rule-text-budget | ../agent-governance-mcp-lanes/e269 | `content/const-15-core-tail.md`、`content/skill-code-reviewer.md`、`content/skill-qa-engineer.md`、`content/skill-release-engineer.md`、`content/constitution-rationale.md`（只在 §6 的理由需要搬過去時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e269-*.test.mjs`、`specs/e269-*`、`qa_reports/*E269*`、`review_reports/*E269*`、`.current/e269/**` | 其他 `content/**`、其他 `test/**`（需要改 → 先寄信請整合者重劃）、`tools/**`、`dist/**`、`bin/**`、`scripts/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、共同禁止 | 做：(E269a) §6 把 `git stash drop` 與 `git stash clear` 列為 FORBIDDEN（不可逆地丟掉 stash 內容），`git stash` / `git stash pop` 照舊允許；(E269b) code-reviewer 與 qa-engineer 的 SOP 寫明負向對照在 worktree 外的複本上做、不用 stash，並說明原因：`tw_update_state` 的寫入在角色 commit 前都是未提交的，stash 會把它一起帶走；(E256) step 13a 的 `:143`／`:196` 改成引用步驟或標題名稱，第 26 行的 E104 指標改寫成它原本要說的行為；(E265) `scripts/verify-release.mjs:113-125` 改成引用 `--close-out` 旗標或函式名稱；(E274) 兩個測試標題改成和斷言一致，是否加「標題的 ≤ N 等於斷言的 N」檢查由 PM 定；qa 重產 compose goldens 並逐一解釋每個 hunk。不做：§6 其他句子的改寫、其他 role SOP、E263 的規則問題。若憲法 stripped 上限（≤ 10057）需要調高，lane 在 cut 裡寫明量測值，由人類在核准 cut 時一起決定 | E258 ✓、E260 ✓ |
| e264 | E264 | feat/e264-tools-comment-accuracy | ../agent-governance-mcp-lanes/e264 | `tools/lane-paths.ts`、`tools/merge-invariants.ts`、`tools/telemetry.ts`、`tools/lane-migrate.ts`、上列四檔的 `dist/tools/**`（`.js`、`.d.ts`、`.map`）、`specs/e264-*`、`qa_reports/*E264*`、`review_reports/*E264*`、`.current/e264/**` | 其他 `tools/**` 與 `dist/**`、`test/**`、`content/**`、`bin/**`、`scripts/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、共同禁止 | 做：E264 的四處註解（O1 `lane-paths.ts` 檔頭改成點名三個 fs helper；O3 `merge-invariants.ts` 的 `tasks-file.ts` 行號改成引用函式名稱、`telemetry.ts` 的 usage 路徑改成 per-lane、`lane-migrate.ts` 不再把 `readHandoffState` 寫成 wrapper 的呼叫者）；`test/lane-paths.test.mjs`、`test/lane-migrate.test.mjs` 的 grep token 數必須不變；重建並 commit 這四檔的 `dist/`。不做：程式碼、其他註解 | E260 ✓ |
| e268 | E268、E270、E271、E273、E272 | feat/e268-test-comment-accuracy | ../agent-governance-mcp-lanes/e268 | `test/drift-skew.test.mjs`、`test/agc-adapters.test.mjs`、`test/e22-stale-notify.test.mjs`、`test/gates-expected-red.test.mjs`、`test/e92-e86-handoff-write-boundary.test.mjs`、`test/lane-ticket-allocation.test.mjs`、`test/pixel-gate-attestation.test.mjs`、`test/qa-flow.test.mjs`、`test/subagent-templates.test.mjs`、`specs/e260e-comment-rationale.md`、`specs/e260g-comment-rationale.md`、`specs/e260h-comment-rationale.md`、`specs/e268-*`、`qa_reports/*E268*`、`review_reports/*E268*`、`.current/e268/**` | 其他 `test/**`（含 `test/context-budget.test.mjs`、`test/fixtures/**`）、所有原始碼目錄、`dist/**`、`content/**`、`scripts/**`、其他 `specs/**`、共同禁止 | 做：E268（`drift-skew` 兩處「沒有 flat fallback」改成實際的 lane→flat fallback；`specs/e260e-comment-rationale.md` 的 e73 報告指標改成 archive 路徑；`agc-adapters` 第 5 行指向不存在的報告，改指或刪除）、E270（`e22-stale-notify` 的接線指標改成 `tools/handoff-parse.ts`）、E271（`gates-expected-red` 檔頭 U1-U13、`specs/e260g-comment-rationale.md` e5 段的數目、`e92-e86` 的分隔線、`lane-ticket-allocation` 第 4 行換行）、E273（`pixel-gate-attestation` 檔頭的 dist 檔名、`qa-flow` 加一行指向 `specs/e260h-comment-rationale.md`）；E272 決定 teamwork 範本現在應該對照什麼，期望表與它的註解一起改。不做：E271 的 proof 腳本缺口（票面註明留給未來的註解整理腳本）、斷言邏輯（E272 除外） | E260 ✓ |
| e275 | E275 | feat/e275-advisory-upgrades | ../agent-governance-mcp-lanes/e275 | `package.json`、`package-lock.json`、`docs/dependency-advisories.md`、`specs/e275-*`、`qa_reports/*E275*`、`review_reports/*E275*`、`.current/e275/**` | `content/**`、`test/**`、`tools/**`、`dist/**`、`bin/**`、`scripts/**`、`gates/**`、`prompts/**`、`schema/**`、`lib/**`、其他 `docs/**`、共同禁止的其餘項目 | 做：人類已裁決三則都 upgrade —— `@modelcontextprotocol/sdk` 下限提到已修正版（GHSA-6qxp-vccf-f47h）；更新 lockfile 讓 `proxy-addr` 解析到 `>=2.0.8`（GHSA-jqcg-44mw-7w3h，只有 lockfile 做不到時才加 override）；`sharp` override 提到 `^0.35.5`（GHSA-wq5f-xc86-pv6w）；三則處分（upgrade＋各自的 re-review trigger）寫進 `docs/dependency-advisories.md`，格式照該檔既有各節；`npm audit --audit-level=high` exit 0；全套綠。**worktree 的 `node_modules` 是指向 primary 的 symlink**：其他三條 lane 也共用它，所以先移除這個 symlink、在 worktree 裡自己 `npm ci`／`npm install`，不要經由 symlink 改到 primary 的安裝。不做：moderate／low advisory、其他相依套件的升級、程式碼修改（sdk 升級若讓測試變紅 → 停下寄信給整合者，不要改程式碼或測試） | 無 |

## 所有權重劃（相對於預設）
- 事先追加給 e269（只限 qa 改，且只在 §6 的修改確實讓既有斷言失效時）：`test/e178a-integrator-role.test.mjs`。優先做法是第 249 行釘住的那一句一字不改，`git stash drop`／`git stash clear` 加在 FORBIDDEN 清單裡；這樣這個測試檔就不用動。
- 共享生成物（`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）整份 → e269。e268 不碰它們。
- E267（`specs/d6-host-capability-compose-axis-architecture.md` 的檔名修正）不開 lane → 整合者在整合後以帶日期的修正段落處理（該檔是設計紀錄，不改原文）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| §6 把 `git stash drop`／`git stash clear` 列為禁止 | e269（E269a） | ✓ |
| code-reviewer、qa-engineer SOP 寫明負向對照在 worktree 外的複本上做 | e269（E269b） | ✓ |
| `skill-release-engineer.md` 不再用行號引用同檔或 `scripts/verify-release.mjs`；E104 指標改成行為描述 | e269（E256、E265） | ✓ |
| compose goldens 重產、budget 測試綠 | e269 | ✓ |
| `context-budget` 兩個測試標題與斷言一致 | e269（E274） | ✓ |
| `tools/` 四處註解準確、grep token 數不變、`dist/` 已重建 | e264 | ✓ |
| e260e／f／g／h 範圍留下的測試註解與 rationale 指標修正 | e268（E268、E270、E271、E273） | ✓ |
| `subagent-templates` 的期望表與註解寫明 `skill-coordinator.md` 是 `skill-manifest` 的邏輯 key；範本裡過時的 Read 路徑另開票（E268-NEW-1）（人類 2026-10-07 改寫；原文「期望表不再對到退役檔」的前提不成立） | e268（E272） | ✓ |
| d6 架構 spec 的片段檔名修正 | 整合者（整合後，E267） | ✓ |
| `npm audit --audit-level=high` exit 0，三則處分寫進 `docs/dependency-advisories.md` | e275（E275） | ✓ |
| e275 合進 main 後，primary 重新安裝相依套件，main 再 merge 進 e269、e264、e268 | 整合者（e275 合併後） | ✓ |
| 合併後全套測試綠 | 整合者（合併後） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試；E267 在 `specs/d6-host-capability-compose-axis-architecture.md` 加一段帶日期的修正（`content/coord-NN-*.md` 才是出貨檔名）。
- backlog done-mark：E256、E264、E265、E267、E268、E269、E270、E271、E272、E273、E274、E275；佇列 #77、#85、#86、#88–#96 勾 DONE。E263（#84）、E266（#87）維持開啟。
- `lane-status --lanes e275,e269,e264,e268 --rollup` 後依序 `finish --shipped`。

## 合併順序
**先做 e275（單獨）**：核對 e275 回報 → `integ/e275` 合併、全套 → ff `main` → push → `finish e275 --shipped` → primary `npm ci`（三條 lane 的 `node_modules` symlink 指向這裡）→ 對 e269、e264、e268 各做一次 `git -C <worktree> merge --no-ff main`（人類 2026-10-07 同意；三條 lane 都不碰 `package.json`／lockfile／`docs/dependency-advisories.md`，不會衝突；merge 前確認該 lane 已 commit 它的 `.current/<lane>/` 狀態）→ 通知三條 lane 恢復。

**其餘三條**：e269 → e264 → e268（共享生成物的 lane 先；三條檔案互斥；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/e260-followups` 重建 `dist/`、全套 → ff `main`

## Dispatch pins
- e269：`sr-engineer=fable`（人類長期偏好）。
- e264：`sr-engineer=fable`（人類長期偏好）。
- e268：無 pin（純測試 lane，沒有 sr-engineer）。
- e275：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-07 | 人類 | fan-out E260 的後續票：E263 排除、E269 納入、E266 延後 | 整合者 session |
| 2026-10-07 | 整合者 | 拆成 e269 ∥ e264 ∥ e268；E256 與 E265 同檔，併進 e269；E274 動 budget 測試，歸擁有共享生成物的 e269；E272 併進 e268；E267 不開 lane，整合後處理；`test/e178a-integrator-role.test.mjs` 條件式重劃給 e269 | 本檔 |
| 2026-10-07 | 人類 | 核准本清單（含六項重劃／切分），開始派工 | 整合者 session |
| 2026-10-07 | 整合者 | e269 預審通過：7 個 task（T-E269-01..07），新增 `test/e269-budget-title-sync.test.mjs`（在擁有範圍內）；四個 budget 上限（5548／10057／20434／7959）都在 `test/context-budget.test.mjs`，不需重劃；上限調高交人類在核准 cut 時決定，整合者建議照 qa 實測值一次調高 | 信箱 e269 to-integrator#1、to-lane#1 |
| 2026-10-07 | 整合者 | e264 預審通過；更正派工前核對：E264 的 `lane-migrate.ts` 落點是約 330 行 `migrateFlatToLane` wrapper 文件的 `(e.g. readHandoffState)`，不是 320 行（`hasFlatLaneFiles` 的文件正確，不動） | 信箱 e264 to-integrator#1、to-lane#1 |
| 2026-10-07 | 整合者 | e268 預審通過（6 個 task，T-E268-01..06）：01 併入 `drift-skew` 同檔同類的 :35（不存在的 `readOnDiskVersion`）與 :40（退役的 `NEW-TICKETS.md`）；02 的 `e22-stale-notify` 三處（:3、:398、:494）全改。E272 前提部分不成立：`skill-coordinator.md` 仍是 `prompts/skill-manifest.ts` 的邏輯 key，真正過時的是 `templates/claude-code-agents/teamwork.md:9` 的 Read 路徑。整合者建議選項 (1)，完成定義改寫為「期望表與註解寫明邏輯 key；範本過時路徑另開票（E268-NEW-1，照常走 pending-tickets）」；選項與完成定義改寫交人類在核准 cut 時決定 | 信箱 e268 to-integrator#1、to-lane#1 |
| 2026-10-07 | 人類 | 確認在 e268 session 的核准：E272 選方案 (1)，完成定義改寫為「期望表與註解寫明 `skill-coordinator.md` 是 `skill-manifest` 的邏輯 key；範本裡過時的 Read 路徑另開票」 | 整合者 session |
| 2026-10-07 | 整合者 | e269 escalate：§6 dependency audit 擋住 build；整合者在 primary `f1e6eb1` 重現三則沒有處分的 advisory（sdk high、proxy-addr critical、sharp high），三條 lane 都受影響；三條 lane 改為不 build 的工作照做、碰到 build 停下 | 信箱 e269 to-integrator#2、三條 lane to-lane#2 |
| 2026-10-07 | 人類 | 三則 advisory 處分為 upgrade；開 E275（P1）放進本波，以第四條 lane e275 執行、先合進 main；同意整合者把 main merge 進 e269、e264、e268 | 整合者 session |
| 2026-10-07 | 整合者 | E275 配號（`docs/backlog.md`、佇列 #96，插隊）；e275 擁有 `package.json`、`package-lock.json`、`docs/dependency-advisories.md`（從共同禁止中除外）；e275 用自己的 `node_modules`，不經 symlink 改 primary | 本檔 |
