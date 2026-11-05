# Fan-out: prompt-audit-w5（一 lane：E408＋稽核 G2-19＋G2-23，合一張票）
base: e1b9a11    integration branch: integ/prompt-audit-w5
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-05。** lane e408 已合併（`integ/prompt-audit-w5` ← e408 `6ac6a80` merge `f30a713`，零衝突）、finish、拆除；派工 base `c337d5b`（本清單的 PR #83 merge）。

範圍由人類指定（整合者 prompt：「fan-out E408 + G2-19 + G2-23 合一張票」，2026-11-05）：`docs/prompt-audit-2026-11-02.md` 在 E391（v4.16.1）、E393（v4.17.0）、E392／E394（v4.18.0）、E395／E403／E404／E407（v4.19.1）之後，報告裡剩下三個不需人類取捨、純文字／註解的尾巴。E408（佇列 #223）已開票；G2-19 與 G2-23 無票，整合者依決定權「把發現併入既有票」併進 **E408**（人類在整合者 session 裁定合一張票，見 Decisions），票面擴充寫在 `docs/backlog.md` E408 列。一條 lane、mini-chain（PM cut → sr-engineer → code-reviewer → qa-engineer，無 architect）：字句、一行模板說明、一段原始碼註解、golden／budget 重釘，沒有介面契約要定。本波不改 gate 程式、routing 表、schema、錯誤碼、`prompts/**`、`scripts/**`；`tools/**` 與 `dist/**` 只開 `tools/role.ts` 的註解行與它的編譯產物（見所有權重劃）。

- **E408 的內容**（`docs/backlog.md` E408 列）：E403 把 coord-03 第 1 行改成 host 中性之後，core 片段還有六處 `Task` 字樣在每個 profile 都組進去：`content/coord-03-core-fallback.md` 第 31 行（Crash detection 列「a dispatched `Task(subagent_type=<role>, …)` call」）、第 77 行（「the `Task(...)` fail this session」）、第 88 行（「`Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback」）、第 95 行（「the resume `Task(...)` call」）；`content/coord-05-core-visual-drift.md` 第 5 行（「(Task or `tw_switch_role`)」）；`content/coord-07-core-sop.md` 第 14 行（「Task-tool subagent if available」）。lean／非 Claude Code 宿主的組合沒有 coord-02 的別名定義，這六處點名未定義工具。做法同 E403 裁定 (a)：逐站 host 中性字句（沿用 coord-02 已定義的名詞「subagent-dispatch tool」／「dispatched subagent call」），不搬別名定義進 core。規劃時核對：六處行號與 E408 票面一致，core 片段裡沒有第七處（`grep -n Task` 排除 `tasks.md`／`_task`／`completed_tasks` 後恰為六處）。
- **G2-19 的內容**（報告 §3.3，Low／flag）：`templates/claude-code-agents/lite.md` 第 3 行 `model: haiku`、`content/skill-coordinator-lite.md` 第 2 行 `recommended_model: sonnet`，是刻意分歧（`specs/d8-lite-recommended-model.md` Amendment、AC8：Task 派工面有 coordinator 的 `validateWatermark` 修正層，直接面沒有），但模板本身沒寫原因，每位讀者都會再報一次。做法：模板第 9 行段落加**一句**說明分歧原因與出處；不動 `model:`、不動第 7 行 CRITICAL、不動 `content/skill-coordinator-lite.md` 字串、第 11 行範例尾綴維持檔尾且前一行空白（`test/subagent-templates.test.mjs` v3.21.2 AC2、FILE_PATH_DELEGATES 釘住）。順手修正同段「server rejects lite-mode writes」的說法與 E391 G2-11 對齊（伺服器拒絕的是四個寫入工具，不是全部 `tw_*`）—— 這點 lane 的 PM 在 cut 裡決定要不要做，整合者不強制。
- **G2-23 的內容**（報告 §3.3，Low／flag，範圍外僅標示）：`tools/role.ts` 第 36–40 行註解說 doc-writer 與 release-engineer「intentionally absent from tools/transitions.ts AgentName + ALLOWED_TRANSITIONS」並指向兩個 skill 的「Side-channel constraint」條款；實況是 `tools/transitions.ts` 第 16 行 `AgentName` 已含 `release-engineer`，第 267–270 行有它的合法開場邊（v3.49.0，C13），`content/skill-release-engineer.md` 已無 Side-channel constraint 條款（E394 重寫後），只有 `content/skill-doc-writer.md` 第 15 行還有。做法：**只改註解行**，讓它對 doc-writer 為真、對 release-engineer 指向 transitions.ts 的邊；`npm run build` 後 `dist/tools/role.js`（`tsconfig` 沒有 `removeComments`，第 28 行帶同一段註解）與 `dist/tools/role.js.map` 一起 commit。不改任何可執行行；`test/e178a-integrator-role.test.mjs` AC4（role.ts 不得提到 integrator）與 `test/skill-evolution-v3.11.test.mjs` AC-10（ROLE_SKILL_MAP 兩個 key）照舊綠。
- **同時進行**：無其他 lane。本波中途若發版（人類觸發 Release workflow），runner 動 `package.json`、`CHANGELOG.md`、adapter 戳記、`docs/backlog.md`、`qa_reports/archive/**`、`.current/_primary/**`；與本 lane 的檔案不相交。

## 派工前核對（整合者，2026-11-05，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`git status` 乾淨；`git fetch` 後 `main` = `origin/main` = `e1b9a11`（PR #82，v4.19.1 post-release bookkeeping）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示，已知、不處理）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary 狀態：`active_feature` release-cd-v4.19.1、`last_agent` release-engineer、`next_role` pm（v4.19.1 發版後收尾狀態；整合者不寫狀態）。遠端沒有任何 `feat/*`、`integ/*`、`docs/*` branch（上波待決的 `feat/e403-lean-dispatch-alias` 遠端刪除已經生效，不必再處理）。
- `.current/.config.json`：`artifacts: "repo"`、`host: "claude-code"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。`agc check` OK（4.19.1）。
- **共享生成物全在 e408**（addendum §2：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）—— 單 lane，無衝突。
- **預算**：`node scripts/measure-context-cost.mjs` 今日 lean 5682 ~tok（AC2 上限 5723，餘 41）；但 coord-* 不在 lean bundle 裡（lean = lite 憲法 + `skill-coordinator-lite.md`），本波六處改字只動 teamwork bundle（AC8 上限 21715 ~tok，上波 lane 量得 21401，餘約 314）與 `skill-coordinator-monolith.txt` golden。G2-19 的一句話只進模板，不進任何 bundle。上限不提高（E397 的題目）。
- **釘住 e408 站點的測試**（規劃時 grep）：六處 `Task` 字樣本身**無逐字 pin**（`test/e403-lean-dispatch-alias.test.mjs` AC1 只取 Fallback 段落、`test/e96-dispatch-preference.test.mjs` 不釘這六行）；會隨之變的是 golden（`skill-coordinator-monolith.txt`、`hook-full.txt`、`build-full-*.txt` 四檔，看 `scripts/capture-constitution-golden.mjs` 的 CHAIN_SKILL 組合）、`test/skill-manifest.test.mjs`、`test/compose-equivalence.test.mjs`、`test/render-structure.test.mjs`（結構 ratchet）、`test/context-budget.test.mjs` AC8。模板：`test/subagent-templates.test.mjs`（第一行 CRITICAL、lite 的 `content/skill-coordinator-lite.md` regex、HAIKU_ROLES 範例尾綴行與其前一行空白）、`test/e392-subagent-templates.test.mjs`（只釘 coord-04 第 5 行與 teamwork 模板，不釘 lite）。`tools/role.ts`：`test/e178a-integrator-role.test.mjs` AC4、`test/skill-evolution-v3.11.test.mjs` AC-10；`scripts/check-version.mjs` 的 dist parity（lane commit 重建後的 `dist/`）。
- **工具**：`scripts/fanout.mjs`、`mailbox-watch.mjs`、`lane-status.mjs`、`merge-invariants.mjs`、`test-lock.mjs`、`verify-release.mjs --ci-check`、`capture-constitution-golden.mjs`、`measure-context-cost.mjs` 都在 base 上；`docs/lane-protocol.md` 與 addendum 都已追蹤。
- **schema**：不升版。憲法標頭（`const-01` 第 1 行 `v3.41.0`）不動：本波不加規則、不動 `const-*.md`（G2-14 的 bump 規則不在本波）。task id：`T-E408-NN`。不重用前波 id。

### 待人類裁定（Stage 2，2026-11-05）
整合者建議在前；每項都影響 lane 的 cut，派工前問一次，之後 lane 不再問。

1. **票的形狀**：G2-19、G2-23 併入 E408（整合者依「併入既有列」決定權，依人類「合一張票」裁定），不另開兩張票。建議 **併入**：三項都是純字句／註解、同一輪 review＋QA 就能收，另開票只是多兩列記帳。
2. **E408 做法**：(a) 六站逐處 host 中性字句，沿用 coord-02 的名詞；(b) 別名定義搬進 core。建議 **(a)**：與 E403 同一裁定、零 lean 成本、不把只對 Claude Code 成立的 `Agent` 名字塞進所有宿主。
3. **G2-19 的改法**：只加一句說明分歧原因（指向 `specs/d8-lite-recommended-model.md` Amendment／AC8），`model: haiku` 不動。建議 **照此**；是否順手把「server rejects lite-mode writes」改準確，交 lane 的 PM 在 cut 決定。
4. **G2-23 的邊界**：`tools/role.ts` 只改第 36–40 行註解，`dist/tools/role.js`／`.js.map` 重建後一起 commit；`tools/**`、`dist/**` 其餘仍禁止。建議 **照此**；這是本波唯一的 `.ts` 觸碰，下次發版 CHANGELOG 要寫「註解 only」。
5. **Dispatch pins**：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（與 e391／e403／e395 同）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值；文件、spec 裡不得出現個人路徑、內部連結。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task。mini-chain：PM 以 backlog E408 列（含 2026-11-05 擴充）＋報告 §3.1 G2-16／§3.3 G2-19／G2-23 為 spec 來源寫 cut，不經 architect；PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 報告第 5 節的 diff 沒有這三項的 hunk（G2-19／G2-23 是 flag-only，E408 是上波新發現）；字句由 lane 定，每一站改前對現行檔案重新核對行號。
- 不 push、不 merge、不發版、不刪 worktree、不跑 Release workflow；hop 用完 → `type: escalate`。
- 共同禁止：`.github/**`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/prompt-audit-2026-11-02.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`README.md`、`AGENTS.md`、`.antigravityrules`、`CLAUDE.md`、`qa_reports/archive/**`、`review_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`.current/_primary/**`、`index.ts`、`tools/**`（`tools/role.ts` 註解行除外）、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`bin/**`、`dist/**`（`dist/tools/role.js`、`dist/tools/role.js.map` 除外）、`scripts/**`、`templates/agent-adapters/**`、`templates/claude-code-agents/**` 其他 11 份、`content/**` 點名三檔六行以外、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/dependency-advisories.md`。需要動禁止檔 → 寄信，整合者裁或轉人類。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e408 | E408（含併入的 G2-19、G2-23） | feat/e408-core-task-alias-tail | ../agent-governance-mcp-lanes/e408 | `content/coord-03-core-fallback.md`（只限第 31、77、88、95 行）、`content/coord-05-core-visual-drift.md`（只限第 5 行）、`content/coord-07-core-sop.md`（只限第 14 行）、`templates/claude-code-agents/lite.md`、`tools/role.ts`（只限第 36–40 行註解）、`dist/tools/role.js`、`dist/tools/role.js.map`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e403-lean-dispatch-alias.test.mjs`、`test/e96-dispatch-preference.test.mjs`、`test/skill-manifest.test.mjs`、`test/render-structure.test.mjs`、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、`test/subagent-templates.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/e408-*.test.mjs`（新，qa 定名）、`specs/e408-*.md`、`.current/e408/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**` 其他檔與點名站點以外的行；`tools/role.ts` 的非註解行；`dist/**` 其他檔 | 做：六站 host 中性字句、lite 模板一句說明、role.ts 註解重寫＋dist 重建、golden 重抓、teamwork 預算重量、需要時重釘。不做：提高 budget 上限（E397）、憲法標頭 bump（G2-14）、qa-visual 模板存廢（G4-01）、pm 的 AskUserQuestion（G2-20）、G1-* | 無 |

## 所有權重劃（相對於預設）
- **`content/**` 從共同禁止移出，劃給 e408，只限三檔六行**：addendum §2 的共享生成物（`content/**`、golden、budget 測試）本波只有這一條 lane。
- **`templates/claude-code-agents/lite.md` 從共同禁止移出，劃給 e408**：其他 11 份模板與 `templates/agent-adapters/**` 仍禁止。
- **`tools/role.ts` 的第 36–40 行註解與 `dist/tools/role.js`、`dist/tools/role.js.map` 從共同禁止移出，劃給 e408**：`tools/**`、`dist/**` 其餘仍禁止；lane 的 sr 在 commit 前 `npm run build`，qa 核對 `git status --porcelain` 的 `dist/` 差異只有這兩檔。
- `test/subagent-templates.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-evolution-v3.11.test.mjs` 劃給 e408（預期不用改，釘住的行本波都不動；若紅，qa 重釘）。
- **`scripts/**`、`.github/**`、`CLAUDE.md` 在共同禁止**（本波不動 CLAUDE.md 正文，E395 已處理）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| lean／非 Claude Code 宿主的 coordinator 組合裡 `grep Task`（排除 `tasks.md`／`_task`／`completed_tasks`）為 0；claude-code 組合語意不變、coord-02 別名定義仍唯一 | e408（E408） | ✓ |
| golden 重抓（CHAIN_SKILL 四檔、hook-full、coordinator monolith）；teamwork 預算 AC8 綠、上限不提高；`e403`、`e96`、`skill-manifest`、`compose-equivalence`、`render-structure` 綠 | e408（E408，qa） | ✓ |
| `templates/claude-code-agents/lite.md` 寫明 `model: haiku` 與 skill `recommended_model: sonnet` 分歧的原因與出處；CRITICAL 第一行、skill 路徑字串、檔尾範例尾綴與前一行空白不變 | e408（G2-19） | ✓ |
| `tools/role.ts` 第 36–40 行註解對 doc-writer 為真、對 release-engineer 指向 `tools/transitions.ts` 的邊；可執行行零差異；`dist/tools/role.js`／`.js.map` 重建並 commit；`check-version` dist parity 綠 | e408（G2-23） | ✓ |
| `subagent-templates`、`e392`、`e178a`、`skill-evolution` 綠（必要時重釘） | e408（qa） | ✓ |
| `check:bookkeeping` 在 lane HEAD exit 0；`npm audit --audit-level=high` exit 0 | e408（qa 核對） | ✓ |
| E408 done-mark（含 G2-19、G2-23 字樣）；佇列 #223 勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- `integ/prompt-audit-w5` ← `--no-ff` e408 → merge-invariants。單 lane，預期零衝突。
- `npm run build` 確認 `dist/` 與 lane commit 一致（只有 `dist/tools/role.js`、`.js.map` 相對 base 有差）；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- backlog done-mark（E408）與佇列 DONE（#223）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- 給下次發版的 CHANGELOG 提示：core coordinator 片段六處 `Task` 字樣改 host 中性（lean／非 Claude Code 組合不再點名未定義工具）；lite 模板一句分歧說明；`tools/role.ts` 註解修正（dist 只有註解差）；無行為變更，建議 PATCH。

## 合併順序
1. `integ/prompt-audit-w5` ← `--no-ff` e408，跑 merge-invariants。
2. `npm run build`（`dist/` 只有 role.js 兩檔差異，與 lane commit 一致），跑 `check:bookkeeping`。
3. 在 integ 上 `finish e408 --shipped --base integ/prompt-audit-w5`。
4. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
5. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/prompt-audit-w5`。

## 結案
- 日期 2026-11-05。`integ/prompt-audit-w5` 自 `main` `c337d5b` 開；← `--no-ff` e408 `6ac6a80`（merge `f30a713`），零衝突，無實質合併解決 → 無合併審查；merge-invariants PASS（772 task id 全在、0 lost [x]、137 sidecar）；重建 `dist/` 相對 `main` 只差 `dist/tools/role.js`、`.js.map`（註解 only，與 lane commit 一致，樹仍乾淨）；`npm audit --audit-level=high` exit 0；`check:bookkeeping` OK；`agc check` OK（4.19.1）；整合層 CI 見 Decisions。`finish e408 --shipped --base integ/prompt-audit-w5` 一次成功：配號 E409（commit `49e0906`）、`.current/e408/` → `.current/history/2026-11/e408/`（`e221e5a`）；worktree、信箱、本地與遠端 lane branch 都已移除。
- 彙總（上限按 lane 計）：e408 4 task／hop 4/14／review 0 輪退回／qa 0 輪；證據與 `completed_tasks` 一致；lane 全套 4030/4032（2 skipped）。
- 完成定義：表中「同一波 ✓」的列全部成立（六站 host 中性、claude-code 別名唯一、golden monolith 重抓、AC8 21408/21715 上限不動、lite 一句分歧說明、role.ts 註解零非註解行、dist parity、重釘全綠、done-mark 與佇列、本段）。
- 記帳：`docs/backlog.md` E408 done-mark（not yet released，註明含 G2-19、G2-23）；佇列 #223 DONE；E409（E408-NEW-1，lite SOP 第 16 行過度陳述）配號、佇列 #224。接線票：無。reviewer 選修 O1、建議 R1 不開票。
- 給下次發版的 CHANGELOG 提示：core coordinator 片段六處 `Task` 字樣改 host 中性（lean／非 Claude Code 組合 `Task` 為 0，claude-code 組合語意不變）；lite 模板一句分歧說明並改引用 SOP 禁令；`tools/role.ts` 註解修正（dist 只有註解差，這是本波唯一的 `.ts` 觸碰）；無行為變更，建議 PATCH。

## Dispatch pins
- e408：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-05 | 人類 | 本波範圍：E408＋稽核 G2-19＋G2-23 合一張票（整合者 prompt「fan-out E408 + G2-19 + G2-23 合一張票」）；G2-19、G2-23 進本里程碑由此裁定 | 整合者 session |
| 2026-11-05 | 整合者 | G2-19、G2-23 併入 E408 列（「併入既有列」決定權；票面擴充寫在 `docs/backlog.md` E408 列、佇列 #223 加註），不另開票。草案：一 lane mini-chain，e408 = E408＋G2-19＋G2-23；`tools/role.ts` 註解行與 `dist/tools/role.js`／`.js.map` 開給 lane；待人類裁定 1–5 見上 | 本檔 |
| 2026-11-05 | 人類 | 核准清單與待人類裁定 1–5 全部照整合者建議（「approve」）：G2-19、G2-23 併入 E408；E408 取 (a)；G2-19 只加一句、`model: haiku` 不動；G2-23 只改註解行＋dist 兩檔；pins 如 Dispatch pins。這五項寫進 lane 的 spec，lane 不再問 | 整合者 session |
| 2026-11-05 | 整合者 | 清單 PR #83 merge `c337d5b` = 派工 base（docs branch `docs/2026-11-05-fanout-prompt-audit-w5` 已刪）；派工前核對在 `c337d5b` 重做：擁有／讀取的 26 個已追蹤檔都在、golden 12 檔、六處 `Task` 站點行號未變、role.ts 第 36–40 行註解在、lite.md 11 行、`cutApprovalAutoTier` `{}`、`agc check` OK（4.19.1）、遠端無 `feat/*`／`integ/*`；信箱 `_mailbox/e408/` 建為空、watch armed baseline 0；prompt 由 `fanout.mjs render --base c337d5b` 產生 | 整合者 session |
| 2026-11-05 | 整合者 | e408 cut 預審 close（spec `114f71c`，to-integrator#1）：4 task（3 sr、1 qa）、check --cut 9 token 0 越界、每個 AC 有實作 task；六站字句照裁定 2 (a) 用 coord-02 名詞；lite 第 9 行括號改為「that SOP's Hard rules forbid them」而非 G2-11 的「伺服器拒絕四個寫入工具」—— 整合者核對 `tools/tasks.ts`：`handleAddTask`／`handleRollbackTask` 只跑 `enforcePreFlight`，lite 呼叫過 `tw_get_state` 後伺服器會接受，所以 lane 的說法對、E391 G2-11 寫進 lite 第 16 行的「四個都 server-rejected」過度陳述 → lane 開 `E408-NEW-1`（P3，finish 配號），不在本波修；role.ts 新註解引用的 `qa-engineer:PASS → release-engineer:In_Progress` 邊核對屬實；PM 試套 teamwork 21401→21408（上限 21715）、lean 5682 不變、golden 只有 coordinator monolith 變。無要求修改 | 信箱 e408 to-lane#1 |
| 2026-11-05 | 人類 | 在 e408 lane session 核准 cut（spec `specs/e408-core-task-alias-tail.md` @ `114f71c`，含 lite 括號措辭決定與 E408-NEW-1 pending ticket）；coordinator 寫 cut_approved；sr（opus）已派 T-E408-01..03，hop 2/14。只影響 e408、已寫在核准的 spec 裡 | e408 lane session；信箱 e408 to-integrator#2 |
| 2026-11-05 | 整合者 | lane e408 進度（to-integrator#3，不需回覆）：sr 完成 `ce172a6`（六站）、`02c6d05`（lite.md 第 9 行）、`52a3e7a`（role.ts 註解＋dist role.js／.js.map，role.d.ts 不變）、`c090555`（state）；build、tsc、audit high exit 0；預期紅只有 skill-manifest golden，留給 qa；code-reviewer（opus）已派，hop 2/14 | 信箱 e408 to-integrator#3 |
| 2026-11-05 | 整合者 | lane e408 進度（to-integrator#4，不需回覆）：code-reviewer（opus）round 1 APPROVED T-E408-01..03（`review_reports/review_T-E408-01.md`，commit `a5c99df`）；0 必修、R1 建議（預期紅沒記 expected-red manifest，feature mode 不 load-bearing）、O1 選修（lite.tier 的「it」指涉，spec 核准文字不動）；16 個釘住測試檔 245/246，紅的是已知 golden；qa（sonnet）已派 T-E408-04；hop 4/14 | 信箱 e408 to-integrator#4 |
| 2026-11-05 | 整合者 | e408 lane 層驗證 close（to-integrator#5）：HEAD `6ac6a80`，8 commits，hop 4/14，review 0 輪退回、qa 0 輪；fanout check 20 檔 0 越界；worktree porcelain 空，重建 `dist/` 後仍空、相對 base 只差 `role.js`／`.js.map`；證據 `qa_reports/review_T-E408-01.md`（PASS，covers 4 id，suite-result 4030/4032）＋伺服器記錄的 02..04、`review_reports/review_T-E408-01.md`（APPROVED，covers 01..03）；handoff PASS、ledger 4 id；role.ts hunk 零非註解行；golden 只有 monolith；九行改動逐行符合 Copy/Strings；pending-tickets E408-NEW-1 一筆；整合者 push 後 CI run 41964621766 在 `6ac6a80` 綠。lane 疑慮 (1) reviewer O1 lite.tier「it」指涉不開票（spec 核准文字）；(2) R1 expected-red 未記（feature mode）；(3) qa 第一次 PASS 被 `AC_EXECUTION_LOG_MISSING` 擋、補 AC Execution Log 後過；worktree 守衛拒 per-file `git diff --exit-code`，以 numstat 代替；(4) sr／reviewer 同 opus，reviewer 檢查為 byte-level 腳本；(5) hop 4/14 —— 記錄不處理 | 信箱 e408 to-lane#2 |
| 2026-11-05 | 整合者 | 整合層 CI：run 41965099063 在 merge HEAD `f30a713` 綠；記帳 HEAD 的 run 見下一列 | 整合者 session |
| 2026-11-05 | 整合者 | 整合：`integ/prompt-audit-w5` 自 `c337d5b` 開，← e408 `6ac6a80`（merge `f30a713`），零衝突，merge-invariants PASS；`dist/` 只差 role.js 兩檔、audit 0、`check:bookkeeping` OK、`agc check` OK；finish e408（E409 配號 `49e0906`、history `e221e5a`，worktree／信箱／本地與遠端 branch 都已移除，無未配號發現、無 target_repo 發現）；記帳 commit `25fe063`（E408 done-mark、佇列 #223 DONE、E409 佇列 #224）；信箱 watch 已停 | 整合者 session |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ c337d5b
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/prompt-audit-w5 @ 25fe063）
- lane-status：primary（main ← integ/prompt-audit-w5 @ 25fe063）release-cd-v4.19.1／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 一 lane（e408 = E408＋稽核 G2-19＋G2-23）已合併、finish、拆除；lane 紀錄在 `.current/history/2026-11/e408/`。記帳與本清單在同一個 wave PR。佇列 #223 至此完成。
- 未配號的新發現：無（e408 的 E408-NEW-1 已由 finish 配為 E409，佇列 #224；reviewer O1／R1 不開票）。
- 本波交付：`content/coord-03-core-fallback.md` 第 31／77／88／95 行、`coord-05` 第 5 行、`coord-07` 第 14 行 host 中性（lean／非 Claude Code 組合 `Task` 為 0）；`templates/claude-code-agents/lite.md` 第 9 行改引用 SOP 禁令並加一句 haiku／sonnet 分歧說明；`tools/role.ts` 第 36–40 行註解修正、`dist/tools/role.js`／`.js.map` 重建；golden `skill-coordinator-monolith.txt` 重抓、預算上限不動；新測試 `test/e408-core-task-alias-tail.test.mjs`。
### 待人類決定
- 是否發版、版號（三檔六行 content 字句、lite 模板、role.ts 註解；無行為變更：建議 PATCH → v4.19.2，走 Release workflow `dry_run=true` 再真跑；E408 列帶 `not yet released` 預標）。
- E409（lite SOP 第 16 行過度陳述，P3，佇列 #224）排進哪一波，以及取 (a) 字句或 (b) handler gate。
- 稽核報告剩下的 flag-only 項：G2-14（憲法標頭版本）、G4-01（qa-visual 模板存廢）、G2-20（pm 的 AskUserQuestion）、G1-01／02／03，都要人類取捨後才能開票。
- `.current/_primary/` 的 primary 狀態仍是 release-cd-v4.19.1／release-engineer／next_role pm（v4.19.1 發版後收尾狀態），由下一個 role 的寫入推進。
### 進行中的背景工作
無
