# Fan-out: 調節器（E465 → E466，兩個波次）
base: b90c7e9    integration branch: integ/conductor
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：第 1 波已合併（2026-11-28），第 2 波待開始。** e465 以 `--no-ff` 合進 `integ/conductor`（merge `9d2e940`，零衝突），merge-invariants PASS；派工 base `b90c7e9`（清單 PR #215，範圍切線修正 PR #216）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0。lane 層 CI：e465 run 46038044739 @ `c7a4cd9` 綠。Roll-up 第 1 波：e465 7 個 task、hop 4/14、review 退回 0 次、證據 7/7。E465 done-mark（not yet released）。

範圍由人類指定（integrator prompt「fan-out docs/discussions/2026-11-27-integrator-session-rotation.md」，2026-11-28）。票面以討論紀錄的裁定 R1–R18 與票檔 `docs/tickets/E465.md`、`docs/tickets/E466.md` 為準，不重開；波次表在 spec-workshop 核准（討論紀錄 *Approval* 兩列，2026-11-27）。兩個 `波次`，各一條 lane：第 1 波 e465（E465），第 2 波 e466（E466，依賴 e465）。每個波次各以一個 PR 合進 `main`（`integ/conductor` 在第 1 波合併、刪除後，第 2 波自當時的 `main` 重開同名分支）。本清單不發版。

## 派工前核對（整合者，2026-11-28，規劃時；派工時在派工 base 重做一次）
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w8.md` exit 1：2 DIFF、2 MOVED。兩個 DIFF 都是討論紀錄已由 PR #213／#214 commit 所致（`git status` 由「?? docs/discussions/」變乾淨、primary 由 dirty 變 clean），MOVED 為 PR 合併；上一波已結案，不影響本清單。
- `main` = `origin/main` = `f46ae65`（PR #214）；`git worktree list` 只有 primary；`feat/e465-*`、`feat/e466-*`、`integ/conductor` 本機與 `origin` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`（v5.0.0 已發版）；drift 檢查無偏差（舊 feature 的 evidence-backed 標記，照訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`，沒有 `knowledge` 與 `laneLaunchLimit`（啟動器預設 3）。
- 相依：E443b 已合進 `main`（PR #212，merge `7ba1cd8`），符合 R3。

### Probe（整合者派的唯讀 probe，2026-11-28：在 scratch clone 套用 E465、再疊上 E466 的代表性改動，各跑完整套件；基準 `f46ae65` 約 4990 pass／0 fail／3 skipped）
E465：照下表寫法，0 個既有測試紅（另有 `test/e326-empty-branch-run-poll.test.mjs` AC-E326-3 一次負載 flake，單獨跑 7/7 綠，不歸屬）。E466：7 個測試紅，全在 E466 allowed paths 內；`CLAUDE.md` 維持 250 行。
| 測試檔 | 釘什麼 | 能否用寫法避開 | 歸屬 |
|---|---|---|---|
| `test/e443b-config-ancestry.test.mjs`（A2-24） | `docs/config.md` 的 `laneLaunchLimit` 節緊接 `knowledge` 節、到下一個 `---` 前沒有別的標題 | 能：`waveDoneAt` 節放在那個 `---` 之後，自帶結尾 `---` | e465 擁有（`test/e443b-*`） |
| `test/e425-stop-ticket-batch.test.mjs`（AC1） | `docs/lane-protocol.md` 的 `### 批次 lane` 整塊逐字 | 能：新句子不放進該塊 | **e465 禁止**（不在 E465 allowed paths） |
| `test/e443b-served-text.test.mjs`（A2-21） | `什麼是批次 lane` 項以啟動器句結尾 | 同上 | e465 擁有 |
| `test/config-cache.test.mjs` | 沒有 config 檔時 `loadConfig` 回 `{}`、不補預設值 | 能：`merged` 預設由另一個解析函式套用，`loadConfig` 只在值有效時照抄 | 兩條 lane **禁止** |
| `test/e178a-integrator-role.test.mjs`（AC3、AC5） | registry 13 個 prompt；`CLAUDE.md` 的「13 registered role prompts」「Thirteen prompts」「the other eleven」「the other 12 role SOPs」 | 不能 | e466 擁有 |
| `test/e423-spec-workshop.test.mjs`（AC1） | registry 長度 13、spec-workshop 在最後 | 不能（R17） | e466 擁有 |
| `test/e428-tracker-mirror.test.mjs`（AC6、AC12） | `content/skill-integrator.md` 整檔 sha256 | 不能（R17） | e466 擁有 |
| `test/e443b-served-text.test.mjs`（A2-19） | integrator SOP 啟動器段的「兩個重跑時機」 | 不能：S8 要拿掉「用量重置後」 | e466 擁有（`test/e443b-*`） |
| `test/skill-frontmatter.test.mjs` | 13 個 `content/skill-*.md` | 不能 | e466 擁有 |
| `test/e436-stale-handoff-paths.test.mjs` | `CLAUDE.md` 固定行號（13、44、64、195、220/221），不只總行數 | 能：只合併第 64–195 行之間的續行——`gates/*.ts` 的三行續行（106–108）併進第 105 行，抵銷同一區間新增的三列（`tools/conductor.ts`、`prompts/conductor.ts`、`content/skill-conductor.md`）；合併 `index.ts`／`handoff-orchestrator.ts` 續行會紅（probe 實測） | e466 **禁止**（R18） |
| `test/e443b-served-text.test.mjs`（A2-25）、`docs/lane-protocol-addendum.md` | addendum §5 工具行以 `lane-launch` 結尾；`prompts/{pm,…}.ts` 列 | 能：`conductor` 另起一列，不併進 `prompts/{pm,…}.ts` 列 | e466 擁有測試；addendum **禁止** |
| `test/e349-integrator-repo-facts.test.mjs` | integrator SOP 以 `node <agc install>/scripts/X.mjs` 呼叫的每個工具都要在 addendum 有 repo 內形式 | 能：integrator SOP 不以這個形式寫 `conductor.mjs`（只有 conductor SOP 可以寫） | e466 **禁止** |
| `test/e432-judge-report-checks.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs` | `CLAUDE.md` 250 行、尾段、Layout 列 | 必須保持綠 | e466 **禁止** |
| compose goldens、`test/context-budget.test.mjs` | constitution 與 coordinator 文字；integrator SOP 沒有上限 | 兩張票都不動 | e466 擁有（只在 E466 選擇加 conductor 上限時才動）；e465 禁止 |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | 波次 | approval |
|---|---|---|---|---|---|---|---|---|---|
| e465 | E465 | feat/e465-launcher-wave-done | ../agent-governance-mcp-lanes/e465 | `tools/lane-launch.ts`、`dist/tools/lane-launch.js`、`dist/tools/lane-launch.js.map`、`dist/tools/lane-launch.d.ts`、`dist/tools/lane-launch.d.ts.map`、`tools/config.ts`、`dist/tools/config.js`、`dist/tools/config.js.map`、`dist/tools/config.d.ts`、`dist/tools/config.d.ts.map`、`scripts/lane-launch.mjs`、`docs/config.md`、`docs/lane-protocol.md`、`test/e443b-*.test.mjs`、`test/e465-*.test.mjs`（新，qa 定名）、`test/fixtures/e465/**`（新）、`specs/e465-*.md`、`.current/e465/**`、`qa_reports/`、`review_reports/` | `test/e425-stop-ticket-batch.test.mjs`、`test/config-cache.test.mjs`、`test/drift-baseline.test.mjs`、`test/config-versioning.test.mjs`；`content/**`；`CLAUDE.md`、`README.md`、`docs/install.md`、`docs/lane-protocol-addendum.md`、`docs/backlog.md`、`docs/tickets/**`、`docs/discussions/**`；`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；其他 `.ts` 原始碼（`tools/**` 除上列、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；其他 `dist/**`；`scripts/**` 除 `scripts/lane-launch.mjs`；`specs/fanout-*.md`；`templates/**`；`.github/**`；`AGENTS.md`、`.antigravityrules`、`CHANGELOG.md`、`package.json`、`package-lock.json` | 做：E465 的 S1–S7（R5、R6、R11、R13）——`waveDoneAt`（`merged` 預設／`pr-open`，其他值點名後當 `merged`）、`pr-open` 下相依要等被依賴的工作合進依賴方起點的 ref（等待中的 lane 列出原因，合併後重跑才開始、已開始的不重開）、`merged` 下相依規則與現行測試結果相同、叫醒 `paused-weekly` 的選項、對已收工 lane 視窗送 `/exit`（`stopped — …` 的保留）、`docs/config.md` 與用法文字。寫法照 `specs/fanout-conductor.md` 的 Probe 表：`loadConfig` 不補預設值、不升 config schema；`waveDoneAt` 節放在 `laneLaunchLimit` 節的 `---` 之後；lane-protocol 新句子不放進 `### 批次 lane` 塊，也不改 `什麼是批次 lane` 項的結尾；served 文字不得有裸票號或只在本 repo 存在的路徑。不做：調節器本身、狀態檔、信箱、integrator SOP（E466）；任何 server、gate、錯誤碼變動 | 無 | 1 | — |
| e466 | E466 | feat/e466-conductor | ../agent-governance-mcp-lanes/e466 | `content/skill-conductor.md`（新）、`prompts/conductor.ts`（新）、`tools/conductor.ts`（新）、`scripts/conductor.mjs`（新）、`tools/registry.ts`、`dist/prompts/conductor.js`、`dist/prompts/conductor.js.map`、`dist/prompts/conductor.d.ts`、`dist/prompts/conductor.d.ts.map`、`dist/tools/conductor.js`、`dist/tools/conductor.js.map`、`dist/tools/conductor.d.ts`、`dist/tools/conductor.d.ts.map`、`dist/tools/registry.js`、`dist/tools/registry.js.map`、`dist/tools/registry.d.ts`、`dist/tools/registry.d.ts.map`、`content/skill-integrator.md`、`docs/lane-protocol.md`、`docs/config.md`、`CLAUDE.md`、`README.md`、`docs/install.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e423-spec-workshop.test.mjs`、`test/e428-tracker-mirror.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/e443b-*.test.mjs`、`test/e466-*.test.mjs`（新，qa 定名）、`test/fixtures/e466/**`（新）、`specs/e466-*.md`、`.current/e466/**`、`qa_reports/`、`review_reports/` | `test/e436-stale-handoff-paths.test.mjs`、`test/e432-judge-report-checks.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e425-stop-ticket-batch.test.mjs`、`test/e443a-integrator-sop.test.mjs`、`test/config-cache.test.mjs`、`test/drift-baseline.test.mjs`、`test/config-versioning.test.mjs`；`docs/lane-protocol-addendum.md`、`docs/backlog.md`、`docs/tickets/**`、`docs/discussions/**`；其他 `content/**`（含 `content/const-*.md`、`content/coord-*.md`）；`tools/lane-launch.ts`、`tools/config.ts`、`scripts/lane-launch.mjs` 與其他 `.ts` 原始碼（`tools/**` 除上列、`gates/**`、`schema/**`、`guards/**`、`prompts/**` 除上列、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；其他 `dist/**`；`scripts/**` 除 `scripts/conductor.mjs`；`specs/fanout-*.md`；`templates/**`；`.github/**`；`AGENTS.md`、`.antigravityrules`、`CHANGELOG.md`、`package.json`、`package-lock.json` | 做：E466 的 S1–S9（R1、R2、R4、R7–R14、R16–R18）——第 14 個 prompt `conductor`（`tw_switch_role` 拒絕它）；conductor SOP（從討論紀錄開第一個 integrator 送 `fan-out <紀錄>`、之後送 `接手 <manifest>` 與波次編號、最後一波後通知人類並停、不開下一份 manifest、沒有 `tw_update_state`）；開關 integrator 視窗的腳本（送字方法沿用啟動器，只 import、不改 `tools/lane-launch.ts`）；狀態檔放在 `git rev-parse --git-common-dir` 目錄、不追蹤；wave-done 回報照 `waveDoneAt` 核對 PR 與 `handoff --check` 後才關，並用 E465 的 close-finished 選項關 lane 視窗；integrator 消失只通知人類；用量上限的兩個叫醒時機；integrator SOP 的配合修改（S8）。寫法照 `specs/fanout-conductor.md` 的 Probe 表：`CLAUDE.md` 淨行數 0 且只合併 `gates/*.ts` 三行續行；`conductor` 另起 Layout 列；integrator SOP 不以 `node <agc install>/scripts/conductor.mjs` 形式寫；served 文字不得有裸票號或只在本 repo 存在的路徑。S9 是 `device-or-person`：票跑到 PASS 後停在 `stopped — awaiting manual verification`（R16）。不做：E465 的啟動器功能；跨 manifest；任何 server、gate、錯誤碼變動；tmux 或背景 session | e465 | 2 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **跨波共有**：`docs/lane-protocol.md`、`docs/config.md`、`test/e443b-*.test.mjs` 同時列在 e465 與 e466 的擁有欄（兩張票的 allowed paths 都有）。兩條 lane 在不同 `波次`，e466 從合進 e465 之後的 `main` 開始，時間上不重疊；同一時間只有一條 lane 擁有它們。
- **收窄**：`test/e425-stop-ticket-batch.test.mjs` 不在 E465 allowed paths 內，列在 e465 禁止欄（probe：寫法可避開）。`test/e349-integrator-repo-facts.test.mjs`、`docs/lane-protocol-addendum.md` 不在 E466 allowed paths 內，列在 e466 禁止欄（probe：寫法可避開）。
- **共用生成物**：compose goldens 與 `test/context-budget.test.mjs` 只在 e466 擁有欄（probe：兩張票都不會動它們）。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、不在任何擁有欄、也不在禁止欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`）。但該檔不在票的 allowed paths 內時，批次 lane 會停票——遇到時以寫法避開為先。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈。qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`；sr-engineer 照測試實作、不改 qa 的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。e466 預期有 architect hop。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **approval 留空（manifest tier）**：cut 經整合者信箱預審 `close` 後，coordinator 照憲法 §3.1 manifest tier 寫 `cut_approved: true` 與 `pending_notes` 行 `cut-approved: manifest-tier (specs/fanout-conductor.md, Decisions <最新人類列的日期>)`。Gate Summary 不得有選項或 needs human ruling 項；有就停票。e466 的 architect Open Questions 回整合者第二次預審。
- **一個 feature、一次 cut**：寫在 `specs/<lane>-*.md`，範圍與驗收照票檔情境與本清單範圍切線，不重開討論紀錄的裁定。每個 AC 都要有實作 task，不只 qa task；每個 task 在 `task_size` 內。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；禁止欄的檔紅了是寫法問題。
- 新的 SOP、lane-protocol、config.md 文字寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e465`）；每一跳都在信箱回報進度。
- 禁止 `git commit --amend`（憲法 §6）；收工前 grep 證據檔有沒有絕對路徑。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `waveDoneAt` 設定、`pr-open` 相依規則、`merged` 不變、`paused-weekly` 叫醒選項、close-finished 選項、文件（E465 S1–S7） | e465（E465） | ✓（第 1 波） |
| `conductor` prompt 與 SOP、視窗開關、狀態檔、wave-done 核對、integrator 消失通知、叫醒時機（E466 S1–S7） | e466（E466） | ✓（第 2 波） |
| integrator SOP 配合修改（E466 S8） | e466（E466） | ✓（第 2 波） |
| 真機兩波驗收（E466 S9，`device-or-person`） | e466（E466）跑到 PASS；人類親眼驗收 | 第 2 波；e466 停在 `awaiting manual verification`，人驗收完才合併（R16） |
| 每波合併後 `npm run build` 無多餘 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E465、E466 done-mark（not yet released）；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 每波 merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 只有該 lane 擁有的輸出；兩條 lane 都改 `.ts`，merge 後重啟 primary 的 MCP server。
- 第 1 波 PR 合併、本機 `main` pull 之後，重跑 `node scripts/lane-launch.mjs specs/fanout-conductor.md` 開始第 2 波。
- 第 2 波：e466 停在 `stopped — awaiting manual verification` 時不合併、保留 worktree（Stage 5b-3）；人類驗收 S9 之後，由人類說繼續，整合者再合併、收尾。
- 沒有接線票。不發版。

## 合併順序
1. 第 1 波：`integ/conductor` 自當時的 `main` 開 ← `--no-ff` e465 → merge-invariants → build、audit、`check:bookkeeping`、記帳 commit → `finish e465`（`--shipped --base integ/conductor`）→ push、CI、`gh pr create`、`gh pr merge --auto --merge` → merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/conductor`。
2. 第 2 波：重跑啟動器開始 e466；S9 驗收後，`integ/conductor` 自當時的 `main` 重開 ← `--no-ff` e466 → 同上 → `fanout.mjs handoff --closing`、結案。不發版。

## Dispatch pins
- e465、e466：`pm=opus`、`architect=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-28）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | 波次表：第 1 波 E465；第 2 波 E466，依賴 E465；票檔 E465、E466 與裁定 R1–R18 | `docs/discussions/2026-11-27-integrator-session-rotation.md`（*Approval*），commit `f46ae65` |
| 2026-11-28 | 整合者 | Stage 1：兩條 lane、兩個波次；派唯讀 probe 在 scratch clone 套代表性改動跑完整套件（基準約 4990 pass／0 fail；E465 0 個既有測試紅，E466 7 個紅、全在 allowed paths 內）；e425 列 e465 禁止、e349 與 addendum 列 e466 禁止（寫法可避開）；`CLAUDE.md` 只合併 `gates/*.ts` 三行續行（e436 固定行號，probe 驗過）；`docs/lane-protocol.md`、`docs/config.md`、`test/e443b-*` 跨波共有 | 本檔 |
| 2026-11-28 | 人類 | 核准本清單：兩條 lane、兩個波次（e465 第 1 波；e466 第 2 波，依賴 e465）；`docs/lane-protocol.md`、`docs/config.md`、`test/e443b-*` 跨波共有；e425 列 e465 禁止，e349 與 `docs/lane-protocol-addendum.md` 列 e466 禁止；`CLAUDE.md` 只合併 `gates/*.ts` 三行續行；e466 停在 S9 人工驗收後才合併；兩條 lane `approval` 留空走 manifest tier；pins 全 opus | 整合者 session（AskUserQuestion：Approve／Manifest tier／All opus） |
| 2026-11-28 | 整合者 | 派工前核對（§8b）：render 預覽發現範圍切線「照上方 probe 表」在 lane prompt 裡沒有對象，且 `base: f46ae65` 的 worktree 沒有本清單；改寫成「照 `specs/fanout-conductor.md` 的 Probe 表」、`base:` 改為清單 PR #215 的 merge `b90c7e9`。其餘派工前核對在 `b90c7e9` 重做通過：`agc check` exit 0、worktree 只有 primary、`feat/e465-*`、`feat/e466-*`、`integ/conductor` 都不存在、擁有欄點名的既有路徑都在、新檔路徑都不存在、`validate`／`waves` exit 0 | 本檔 |
| 2026-11-28 | 整合者 | 清單 PR #215（merge `b90c7e9`）與修正 PR #216（merge `812f63e`）合進 `main`；派工 base = `b90c7e9`；建 `_mailbox/e465/`，開信箱監看（baseline e465=0）與 lane-status 監看，以 `node scripts/lane-launch.mjs specs/fanout-conductor.md` 開始第 1 波（`started e465 — window 2832`） | 本檔 |
| 2026-11-28 | 整合者 | e465 cut 預審 `close`（to-lane#2）：spec @ `ffcc10be`。一次來回：to-lane#1 要求補兩項機制——已收工且 worktree 已拆的 lane 視為沒有 `stopped — …` 票、照樣送 `/exit`；`--close-finished` 是只做關閉的一輪（exit 0，不開始 lane、不叫醒、不輪詢），兩個選項同時給時以它為準，因為調節器在下一個 integrator 開監看之前呼叫它。整合者在 lane 重跑 `check --cut` exit 0（14 token、0 越界）；S1–S7 皆有實作 task（T-E465-04..07），qa T-01..03 | e465 信箱 to-integrator#1、#2，to-lane#1、#2 |
| 2026-11-28 | 整合者 | 接受機械性越界：qa 照 qa SOP 與 `docs/ticket-format.md`（*Filling in the test name later*）把 `docs/tickets/E465.md` 7 行 `Verification: automated test` 改成具名測試（@ `45ba4e0c`），只限原地改那 7 行；第 2 波 e466 同樣適用於 `docs/tickets/E466.md` 的 Verification 行 | e465 信箱 to-integrator#4、to-lane#3 |
| 2026-11-28 | 整合者 | e465 收工回報（to-integrator#5）核對通過並 `close`（to-lane#4）：`feat/e465-launcher-wave-done` @ `c7a4cd9`（5 commit）；`fanout check --base main` 31 檔、唯一越界為上一列接受的票檔 Verification 行；證據 `review_reports/review_T-E465-01.md` APPROVED（covers T-E465-01..07），`qa_reports/review_T-E465-01..07.md` 最新皆 PASS；worktree 乾淨；無 pending-tickets；lane 層 CI run 46038044739 @ `c7a4cd9` 綠。裁判 optional 三項（送 `/exit` 失敗時無提示；選項重複給是用法錯誤；branch tip 只在 finished 轉換與相依檢查時記錄，fail-safe 且已寫進 `docs/config.md`）列在結案報告，不開票 | e465 信箱 to-integrator#5、to-lane#4；`review_reports/review_T-E465-01.md` |
| 2026-11-28 | 整合者 | 5b：`integ/conductor` 自 `main` @ `812f63e` 開，`--no-ff` 合進 e465（merge `9d2e940`，零衝突、沒有需審的解衝突），merge-invariants PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0；5c：E465 done-mark（`docs/backlog.md` E465 列） | 本檔 |
