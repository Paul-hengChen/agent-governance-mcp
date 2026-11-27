# Fan-out: post-v5.0.0 第 8 波（E443b）
base: e3a3db6    integration branch: integ/post-v5-w8
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-27。** e443b 以 `--no-ff` 合進 `integ/post-v5-w8`（merge `7ba1cd8`，零衝突），merge-invariants PASS；派工 base `a06cc92`（清單 PR #210）；E463 波（PR #211）先合進 `main`，整合分支自 `df48c92` 開。merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17（`gates/`、`tools/handoff-orchestrator.ts` 無差異）、`CLAUDE.md` 250 行、`check:bookkeeping` exit 0。lane 層 CI：e443b run 45980942656 @ `d05b68b` 綠。Roll-up：e443b 9 個 task（T-E443B-01、07..14；02..06 因 `task_size` 重切而 void）、hop 12/14、review 退回 1 次（cap 4）、證據 9/9。E443b done-mark（not yet released）。例外：teamwork bundle 上限實測 +100 tok（人類核准「約 +92」）；`test/lane-paths.test.mjs` 以常設規則劃入。本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-27；候選照佇列順序 E443b（第 255b 號列）、E420（第 256 號列）；整合者提五題，人類答「approve」）：本波只有一條 lane e443b 做 E443b；E420 不列。票面以 `specs/ticket-cut-e443.md` 的 NEW-2（A2-1..A2-21）與 `docs/backlog.md` 的 E443b 列（R1–R5、切票檔 Q1–Q3 的裁定）為準，不重開；本清單 Decisions 記下的人類裁定 G1 與 allowed paths 增補優先於票面。與另一個 session 的 E463+E464 波（`specs/fanout-post-v5-e463.md`，lane e463）並行，兩邊擁有欄不重疊。本波不發版。

## 派工前核對（整合者，2026-11-27，規劃時；派工時在派工 base 重做一次）
- 上一波交接：`node scripts/fanout.mjs handoff --check specs/fanout-post-v5-w7.md` exit 0（5 項事實、0 DIFF、3 MOVED，皆為 PR #207 合併所致）。
- `main` = `origin/main` = `e3a3db6`（PR #209，E463 波的清單）；`git worktree list` 有 primary 與 e463 lane（`feat/e463-release-gh-checks`，另一個 session 的波）；primary 工作樹除本清單外只有 `specs/fanout-post-v5-e463.md` 一行未 commit 的修改，屬 E463 波的整合者，本波不動。`feat/e443b-*`、`integ/post-v5-w8` 本機與 `origin` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 只有 `e463/`。primary handoff 停在 `release-cd-v5.0.0-r2`（v5.0.0 已發版）；drift 檢查沒有偏差（舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- 相依：E443a 已合進 `main`（PR #207，merge `a2f1062`）。

### 為什麼 E420 不列
- 新鏈上結案的 design-armed feature 仍為 0：2026-11-20 之後各 adopter workspace 與 lane worktree 都沒有新的 `design/*.md`；11-23 之後有更新 handoff 的只有一個 adopter 結案的 7 個 feature，皆無 design 檔（與第 7 波查到的同一批）；其餘 adopter 的 stamp 停在 v3.48、v4.2.0、v4.3.0（舊鏈）；本 repo 沒有 `design/`。

### E443a 交出的介面（對切票檔 NEW-2）
| 介面 | 實作 | 夠用？ |
|---|---|---|
| `parseManifest` → `DispatchableLane.wave`／`depLanes`／`approval` | `tools/fanout-manifest.ts` | ✓（排程、A2-12、A2-13） |
| `ticketIds`、`lookupTicketFiles(primary, ids)` | `tools/fanout-manifest.ts`（由 `tools/fanout-waves.ts` import） | ✓（A2-13 的「沒有票檔」） |
| `renderPrompt(m, lane, { batch: true })`／`render --batch` | `tools/fanout-manifest.ts`，第一步與結尾句是常數 | ✓（A2-16 可在程序內呼叫，輸出逐 byte 相同） |
| `runWaves`／`compareWaves` | `tools/fanout-waves.ts`（Stage 2 的 CLI） | 啟動器用不到 |
| `checkLaneAncestry(branches, repoRoot)` | `tools/join-precondition.ts`，固定比對 `HEAD` | ✗：Q1 裁定比對「依賴方 lane 起點的 ref」，ref 參數是必要的（人類裁定，見 Decisions） |
- 切票檔沒寫到的缺口 G1：E443a 的 `validate` 允許 `相依` 指向同一波的 lane，Q1 裁定卻只定義第 1 波從 `base:` 開。人類裁定 G1 (b)：啟動器拒絕同一波內的相依並點名（見 Decisions）。

### Probe（整合者派的唯讀 probe，2026-11-27：在 scratch clone 套用代表性改動 a–h 後跑完整套件；基準 `a2f1062` 4905 pass／0 fail，改動後 14 個測試、12 個檔紅；`a2f1062..e3a3db6` 只動 `docs/backlog.md` 與 E463 清單，結果仍適用）
| 測試檔 | 釘什麼 | 能否用寫法避開 | 歸屬 |
|---|---|---|---|
| `test/context-budget.test.mjs`、`test/fixtures/compose-golden/skill-coordinator-monolith.txt` | teamwork bundle ≤ 19905（零餘裕，coord-03 加一句約 +92 tok）；coord-03 golden | 不能：re-baseline 上限、重擷取 golden | 擁有 |
| `test/e115-join-precondition.test.mjs` | regex 釘 `checkLaneAncestry` 的兩參數簽名 | 不能 | 擁有 |
| `test/e349-integrator-repo-facts.test.mjs` | SOP 出現的工具都要在 addendum 有 repo 內呼叫形式；addendum §5 工具行逐字 | 不能：`docs/lane-protocol-addendum.md` 也要改 | 擁有 |
| `test/e428-tracker-mirror.test.mjs` | skill-integrator 整檔 sha256 | 不能 | 擁有 |
| `test/e425-stop-ticket-batch.test.mjs` | lane-protocol §3 批次 lane 段逐字（C-LP2）；coord-03 Escalation Routes 列與 skill-integrator C-IN1..3 凍結 | §3 那句不能 | 擁有 |
| `test/e410-task-alias-content-tail.test.mjs`、`test/e430-mailbox-outside-lane.test.mjs` | skill-integrator 行號與行數 | 能：只改既有行、不加行 | 擁有 |
| `test/e130-lane-default.test.mjs`、`test/e440-current-rule-wording.test.mjs` | coord-03 Fallback 段以 fallback 規則句結尾 | 能：句子放在 Crash-Resume 段開頭 | 擁有 |
| `test/e290-lane-protocol-generic.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、`test/e383-lane-ledger-worktree.test.mjs`、`test/e385-worktree-evidence.test.mjs` | lane-protocol 不得含 repo 內路徑；§1／§3 鄰行文字 | 換寫法可能紅 | 擁有 |
| `test/e289-config-key.test.mjs`、`test/e447-served-text.test.mjs`、`test/e292-config-sister-repos.test.mjs`、`test/e422-ticket-dir-config.test.mjs`、`test/e457-doc-numbers.test.mjs` | `docs/config.md` 各節位置、數字 | 換寫法可能紅 | 擁有 |
| `test/e438-origin-fenced-labels.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs` | served 文字不得有裸票號；Stage 3 Render 行與 Stage 4 第一段；Mid-wave base fix 的位置 | 換寫法可能紅 | 擁有 |
| `test/e408-core-task-alias-tail.test.mjs`、`test/e403-lean-dispatch-alias.test.mjs` | coord-03 四句 Task alias；coord-03 不得出現 "Task" | 必須保持綠 | **禁止** |
| `test/e443a-integrator-sop.test.mjs` | skill-integrator Stage 1 第 6 步與 Stage 2 例外句逐字 | 必須保持綠（不動那兩處） | **禁止** |
| `test/e433-test-first-rules.test.mjs` | lane-protocol 第 37 行 | 必須保持綠：§1 第 1 步原地改，§1 不加行 | **禁止** |
| `test/e436-stale-handoff-paths.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e432-judge-report-checks.test.mjs` | `CLAUDE.md` 行號、250 行、Layout 列順序與 11 列區塊（e432 由 e463 擁有） | 必須保持綠：新列放在 `tools/config.ts` 之後，同時把兩行的 `prompts/{pm,…}.ts` 列合成一行，淨行數 0（probe 驗過 652 測試全綠） | **禁止** |
| `test/config-cache.test.mjs`、`test/drift-baseline.test.mjs`、`test/config-versioning.test.mjs` | `loadConfig` 不補預設值；不升 config schema | 必須保持綠 | **禁止** |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e443b | E443b | feat/e443b-lane-launcher | ../agent-governance-mcp-lanes/e443b | `scripts/lane-launch.mjs`（新）、`tools/lane-launch.ts`（新）、`dist/tools/lane-launch.js`、`dist/tools/lane-launch.js.map`、`dist/tools/lane-launch.d.ts`、`dist/tools/lane-launch.d.ts.map`（新）、`tools/config.ts`、`dist/tools/config.js`、`dist/tools/config.js.map`、`dist/tools/config.d.ts`、`dist/tools/config.d.ts.map`、`tools/join-precondition.ts`、`dist/tools/join-precondition.js`、`dist/tools/join-precondition.js.map`、`dist/tools/join-precondition.d.ts`、`dist/tools/join-precondition.d.ts.map`、`content/skill-integrator.md`、`content/coord-03-core-fallback.md`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/config.md`、`CLAUDE.md`、`test/fixtures/compose-golden/skill-coordinator-monolith.txt`、`test/context-budget.test.mjs`、`test/e115-join-precondition.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e428-tracker-mirror.test.mjs`、`test/e425-stop-ticket-batch.test.mjs`、`test/e410-task-alias-content-tail.test.mjs`、`test/e430-mailbox-outside-lane.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e440-current-rule-wording.test.mjs`、`test/e290-lane-protocol-generic.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、`test/e383-lane-ledger-worktree.test.mjs`、`test/e385-worktree-evidence.test.mjs`、`test/e289-config-key.test.mjs`、`test/e447-served-text.test.mjs`、`test/e292-config-sister-repos.test.mjs`、`test/e422-ticket-dir-config.test.mjs`、`test/e457-doc-numbers.test.mjs`、`test/e438-origin-fenced-labels.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e443b-*.test.mjs`（新，qa 定名）、`test/fixtures/e443b/**`（新）、其他只因本 lane 而紅且不在禁止欄的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e443b-*.md`、`.current/e443b/**`、`qa_reports/`、`review_reports/` | 不變式測試：`test/e408-core-task-alias-tail.test.mjs`、`test/e403-lean-dispatch-alias.test.mjs`、`test/e443a-integrator-sop.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e436-stale-handoff-paths.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/config-cache.test.mjs`、`test/drift-baseline.test.mjs`、`test/config-versioning.test.mjs`；E463 波（跨波不得同改）：`test/e432-judge-report-checks.test.mjs`、`test/release-staging.test.mjs`、`test/feature-lease.test.mjs`、`scripts/release.mjs`、`scripts/verify-release.mjs`、`scripts/gh-*.mjs`、`docs/release-cd.md`、`test/e463-*.test.mjs`、`test/fixtures/e463/**`、`specs/e463-*.md`、`.current/e463/**`；其他 `content/**`（含 `content/const-*.md`）；其他 `test/fixtures/compose-golden/**`；`tools/fanout-manifest.ts`、`tools/fanout-waves.ts`、`scripts/fanout.mjs` 與其他 `.ts` 原始碼（`tools/**` 除上列、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；其他 `dist/**`；`scripts/**` 除 `scripts/lane-launch.mjs`（含 `scripts/batch-summary.mjs`）；其他 `docs/**`（含 `docs/backlog.md`）；`specs/fanout-*.md`、`specs/ticket-cut-e443.md`、`specs/e443-*.md`；`templates/**`；`.github/**`；`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：`specs/ticket-cut-e443.md` NEW-2 範圍 1–14 與驗收 A2-1..A2-21，照 `docs/backlog.md` E443b 列的 R1–R5 與 Q1–Q3 裁定，加上本清單 Decisions 的人類裁定：G1 (b) 啟動器拒絕同一波內的相依（點名依賴方與被依賴方，請改到較後的波），`checkLaneAncestry` 的 ref 參數為必要，`docs/lane-protocol-addendum.md` 列入 allowed paths（補 `node scripts/lane-launch.mjs` 的呼叫形式），teamwork 預算上限 re-baseline（約 +92 tok，歷史註解照前例）。設定 key 名、`Unknown command` 重送次數上限、fallback model chain 的設定名在 cut 寫定。`tools/config.ts` 不補預設值、不升 schema；`CLAUDE.md` 淨行數 0；lane-protocol §1 不加行；skill-integrator 只改既有行、不動 Stage 1 第 6 步與 Stage 2；coord-03 不動四句 Task alias、不加 Escalation Routes 列、不加反引號錯誤碼；served 文字不得有裸票號或只在本 repo 存在的路徑。不做：tmux、背景或 `-p` session、每 lane 帳號對應、statusline 叫醒、任何 server 變動、寫 fan-out 清單、`scripts/batch-summary.mjs`；任何 gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動 | 無 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共用生成物**：本波只有 e443b 動 `test/fixtures/compose-golden/skill-coordinator-monolith.txt` 與 `test/context-budget.test.mjs`；並行的 e463 把兩者列在禁止欄，不會同時改。
- **跨波**：e463 擁有的檔與它列為「跨波不得同改」的檔列在本 lane 禁止欄；`CLAUDE.md` 在 e463 的禁止欄內，由本 lane 擁有，但必須淨行數 0（`test/e432-judge-report-checks.test.mjs` 屬 e463，釘 250 行）。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。禁止欄點名的檔不適用這條。注意：本 lane 的 approval 走 manifest tier，擁有欄改動要新的 `人類` Decisions 列並合進 lane；PM 的完整套件 probe 若找出擁有欄外的紅檔，預審時回整合者，優先改寫法避開。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈，預期有 architect hop——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **approval 留空（manifest tier，人類 2026-11-27）**：cut 經整合者信箱預審 `close` 後，coordinator 照憲法 §3.1 manifest tier 寫 `cut_approved: true` 與 `pending_notes` 行 `cut-approved: manifest-tier (specs/fanout-post-v5-w8.md, Decisions <最新人類列的日期>)`。Gate Summary 必須沒有選項、沒有 needs human ruling 項；有的話就停下來呈人類。architect 的 Open Questions 回整合者第二次預審，`close` 且沒有 needs human ruling 項時 sr-engineer 直接開工。
- **一個 feature、一次 cut**：寫在一份 `specs/e443b-*.md`，範圍與驗收照切票檔 NEW-2 與本清單範圍切線，不重開 R1–R5、Q1–Q3、G1。
- **sr 至少拆 4 個 task**（每個在 `task_size` 內）：①設定 key、啟動狀態檔、波次與相依排程（含 `checkLaneAncestry` ref 參數、G1 拒絕、`knowledge: local` 的 finish 紀錄）②視窗驅動、paused 偵測、叫醒句、Enter、`Unknown command` 重送與各項前置檢查 ③`scripts/lane-launch.mjs` CLI、`CLAUDE.md` Layout 列、addendum 工具行 ④coord-03、skill-integrator、lane-protocol、config.md 的文字。golden 與預算上限在最後一個實作 task 之後由 qa 重擷取。每個 AC 都要有實作 task，不只 qa task。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者；禁止欄的檔紅了 → 是寫法問題，回整合者。
- 新的 SOP、coord-03、lane-protocol、config.md 文字與叫醒句寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e443b`）；每一跳都在信箱回報進度。
- 禁止 `git commit --amend`（憲法 §6）；收工前 grep 證據檔有沒有絕對路徑。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 啟動器：並行上限與預設、波次與相依排程、G1 拒絕、`knowledge: local` 規則、`agc feature start`／resume、啟動狀態檔不追蹤、不寫清單（A2-1..A2-6、A2-14、A2-15） | e443b（E443b） | ✓ |
| 用量上限：週上限 paused、三次後 paused 與叫醒、Enter、視窗消失時 resume（A2-7..A2-10） | e443b（E443b） | ✓ |
| 拒絕條件與前置檢查（A2-11..A2-13、A2-16..A2-18） | e443b（E443b） | ✓ |
| skill-integrator 兩個重跑時機、coord-03 usage-limit 句、lane-protocol §1／§3（A2-19..A2-21）；`docs/config.md`、`CLAUDE.md` Layout 列 | e443b（E443b） | ✓ |
| 合併後 `npm run build` 無多餘 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E443b done-mark（not yet released）；佇列 E443b 列打勾；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 只有本 lane 擁有的輸出；本 lane 改 `.ts`，merge 後重啟 primary 的 MCP server（補充規則的 post-merge restart）。
- 與 E463 波誰先合進 `main` 都可以；後合的 PR 出現 `BEHIND` 時照 Stage 6 第 4 步把 `main` merge 進整合分支。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 上線後觀察（人類 R5，非驗收）：第一次真的 lane 撞到用量上限時，記錄主 session 自動接續後是否照 Crash-Resume 重派中斷的 subagent、pin 是否保留，寫回 `specs/e443-phase0-host-check.md`。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w8` 自當時的 `main` 開。
2. ← `--no-ff` e443b → merge-invariants。
3. `npm run build`、`check:bookkeeping`、audit；記帳 commit。
4. `finish e443b`（`--shipped --base integ/post-v5-w8`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w8`。不發版。

## Dispatch pins
- e443b：`pm=opus`、`architect=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-27 Q5）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | 第 8 波範圍：只列 E443b，一條 lane e443b，wave id `post-v5-w8`，與 E463 波並行；E420 不列（新鏈上沒有結案的 design-armed feature）（Q1）；G1 (b)：啟動器拒絕同一波內的相依並點名，由整合者在 Stage 1 移到較後的波（Q2）；E443b allowed paths 增補 `docs/lane-protocol-addendum.md`，`tools/join-precondition.ts` 的 ref 參數由條件式改為必要，teamwork 預算上限 re-baseline 約 +92 tok（Q3）；`approval` 留空走 manifest tier（Q4）；pins 全 opus（Q5） | 整合者 session（「approve」） |
| 2026-11-27 | 整合者 | Stage 1：一條 lane e443b；派唯讀 probe 在 scratch clone 套代表性改動跑完整套件（基準 4905/0 fail，改動後 14 測試 12 檔紅），必紅與換寫法可能紅的 21 個測試檔逐檔進擁有欄，必須保持綠的 10 個不變式測試與 E463 波的擁有檔列禁止；`CLAUDE.md` 淨行數 0 的寫法（合併 `prompts/{pm,…}.ts` 兩行）經 probe 驗證 | 本檔 |
| 2026-11-27 | 人類 | 核准本清單：一條 lane e443b（E443b，`approval` 留空走 manifest tier，pins 全 opus）；wave id `post-v5-w8`；21 個 re-pin 測試逐檔進擁有欄；10 個不變式測試與 E463 波擁有檔列禁止；`CLAUDE.md` 淨行數 0、lane-protocol §1 不加行、skill-integrator 只改既有行；G1 (b)、allowed paths 增補 `docs/lane-protocol-addendum.md`、ref 參數必要、預算上限 re-baseline 約 +92 tok；sr 至少拆 4 個 task | 整合者 session（「approve」） |
| 2026-11-27 | 整合者 | 清單 PR #210 合進 `main`（merge `a06cc92`，PR 必要檢查綠），派工 base = `a06cc92`；派工前核對在該 sha 重做通過（`agc check` exit 0、worktree 只有 primary 與 E463 波的 e463、`feat/e443b-*` 與 `integ/post-v5-w8` 都不存在、`_mailbox/` 原本只有 `e463/`、擁有欄點名的既有路徑都在、新檔路徑都還不存在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e443b/`，開信箱監看（只點名 e443b，baseline e443b=0）與 lane-status 監看，render e443b 的 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-27 | 整合者 | e443b cut 預審 `close`（to-lane#2）：spec @ `cbae086`。一次來回：to-lane#1 要求收窄 finished 訊號——進度信也是 `type: report`，改成 §6 `## Lane report:` 開頭，或批次停票時該 lane 票檔全為 `done` 或 `stopped — …`（至少一張 stopped），新增 A2-26、A2-27。接受：`test/skill-manifest.test.mjs` 不劃入擁有欄（只讀擁有的 golden，重擷取後就綠）；coord-03 實測 +100 tok，算在人類核准的「約 +92」re-baseline 內；`checkLaneAncestry` 的 TS 簽名 ref 必要、`scripts/join-precondition.mjs` 的 JS 兩參數呼叫在執行期退回 `HEAD`（A2-23），符合「ref 參數必要」；鎖檔 `agc-lane-launch.lock`。整合者在 lane 重跑 `check --cut` exit 0（31 token、0 越界）；A2-1..A2-27 皆有實作 task（T-E443B-02..05），qa T-01、T-06 | e443b 信箱 to-integrator#2、#3，to-lane#1、#2 |
| 2026-11-27 | 整合者 | e443b architect Open Questions 第二次預審 `close`（to-lane#3）：architecture @ `8dc1ea8`，6 項都照建議、沒有 needs human ruling——CLAUDE.md Layout 列移到 T-E443B-02（e395 須保持綠，淨行數 0，coordinator 代 PM 原地改 tasks.md 並在 pending_notes 揭露）；批次停票的 finished 訊號用 `reportFloor`，只認啟動後才到的回報；architect 自訂的 CLI 字串（啟動狀態檔無法解析時拒絕、exit 1）；history 紀錄同時查 lane id 與票號名；「第 1 波」＝最小 `波次`；`--abandoned` 留下的 history 紀錄會放行依賴方，列為已知限制，只能附加在擁有檔的既有行或 config.md 節內 | e443b 信箱 to-integrator#5、to-lane#3 |
| 2026-11-27 | 整合者 | e443b 重切 task 後再預審 `close`（to-lane#4）：T-E443B-02 實測約 509 行，超過 `task_size` 300 行，sr Blocked → PM 重入（hop 5）；spec 與架構 @ `8f30894` 只改 task map——void 02–06，新增 07–14（sr 07–13，各估 ≤ 300 行；qa 14 收尾），範圍、檔案、Copy、驗收不變；整合者在 lane 重跑 `check --cut` exit 0、0 越界，A2-1..A2-27 皆有實作 task | e443b 信箱 to-integrator#8、#9，to-lane#4 |
| 2026-11-27 | 整合者 | 照常設規則把無主紅檔 `test/lane-paths.test.mjs` 劃給 e443b（to-lane#5）：只有 CALLERS2 allow-list 紅，原因是新的 `tools/lane-launch.ts` 唯讀 import `lane-paths`；base 上全套 0 fail，lane @ `356a008` 實跑這一項紅；不在禁止欄；落在擁有欄「其他只因本 lane 而紅的測試」那一格；cut 已核准、PM 不重入，不另起 manifest tier 核准。qa 在 allow-list 加一列並附群組註解 | e443b 信箱 to-integrator#18、to-lane#5 |
| 2026-11-27 | 整合者 | e443b 收工回報（to-integrator#22）核對通過並 `close`（to-lane#6）：`feat/e443b-lane-launcher` @ `d05b68b`（41 commit），`fanout check --base main` 58 檔，唯一不在擁有欄的 `test/lane-paths.test.mjs` 已由 to-lane#5 劃入；證據 `review_reports/review_T-E443B-01.md` 第 2 輪 APPROVED（covers T-E443B-01、07..14），`qa_reports/review_T-E443B-01.md`、`-07..-14.md` 最新皆 PASS；worktree 乾淨；無 pending-tickets；共用生成物（coord-03 golden、teamwork 上限 20005）屬本 lane；lane 層 CI run 45980942656 @ `d05b68b` 綠。裁判 recommended 一項（`fill()` 的 doc comment 與啟動前未再檢查已結束 lane 不一致）、optional 兩項（叫醒時 iTerm2 失敗終止整輪、鎖檔微秒級讀到空檔）列在結案報告，不開票。round 1 退件的錯誤字串，源於 lane 在 to-integrator#5 摘要多列了一句、架構原文沒有；整合者 close 時依原文，未察覺摘要差異 | e443b 信箱 to-integrator#22、to-lane#6；`review_reports/review_T-E443B-01.md` |
| 2026-11-27 | 整合者 | 5b：`integ/post-v5-w8` 自 `main` @ `df48c92`（含 E463 波 PR #211）開，`--no-ff` 合進 e443b（merge `7ba1cd8`，零衝突、沒有需審的解衝突），merge-invariants PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0；5c：E443b done-mark（backlog 列與佇列 255b 列），`check:bookkeeping` exit 0；roll-up e443b 9 task、hop 12/14、review_round 0（退回 1 次）、證據 9/9 | 本檔 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ df48c92
- 目標分支對 origin：一致
- git status：1 項：?? docs/discussions/
- worktree：primary（main ← integ/post-v5-w8 @ 741f18d）
- lane-status：primary（main ← integ/post-v5-w8 @ 741f18d）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，dirty
### 已結案
- e443b（E443b）PASS，merge `7ba1cd8`；以本波 PR 合進 `main`。lane 紀錄在 `.current/history/2026-11/e443b/`；沒有未配號的新發現。裁判的 recommended 一項（`fill()` 的 doc comment）與 optional 兩項（叫醒時 iTerm2 失敗終止整輪、鎖檔讀到空檔的微秒級競態）記在 Decisions 表，不開票。
- 上線後觀察（人類 R5，非驗收）：第一次真的 lane 撞到用量上限時，記錄主 session 自動接續後是否照 Crash-Resume 重派中斷的 subagent、pin 是否保留，寫回 `specs/e443-phase0-host-check.md`；第一次實際啟動時由整合者看著多行 prompt 送出（spec 的 *Known unverified*）。
### 待人類決定
- 要不要發 v5.x：E424、E425、E427、E430、E449、E426、E428、E446、E447、E443a、E463、E464、E443b 都已完成，合進 `main` 後尚未發版。
- 下一波要不要開：佇列上唯一未完成的是 E420（新鏈上仍沒有結案的 design-armed feature）。
- primary 上未追蹤的 `docs/discussions/2026-11-27-integrator-session-rotation.md` 不是本波產生的（`agc feature finish` 也提出警告），本波沒有動它；它的去留由人類決定。
### 進行中的背景工作
無
