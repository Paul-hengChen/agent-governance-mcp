# Fan-out: v5.0.0 里程碑第 7 波（E435）
base: 244f2f4    integration branch: integ/v5-w7
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-24。** e435 已合併進 `integ/v5-w7`（merge `f808b6e`，零衝突、無實質解衝突）、finish、拆除；派工 base `a1a36b2`（清單 PR #172 merge），integ 自 `main` @ `a1a36b2` 開出；merge-invariants PASS；merge 後 build 無 `dist/` 差異、audit exit 0、`agc check` exit 0、`CLAUDE.md` 250 行；`GATE_REGISTRY` 33、pipeline 17 步、handoff schema 17（`dist/` 實測）。lane 層 CI：run 45418530806 @ `91a46a2` 綠（Node 20、22）。Roll-up：e435 tickets 1（50 個 task，cut 42 + 拆分與退回修正 8）、hop 7/14、review 退回 0、sr 退回 1/2（R3 (b) 計畫性退回）；證據 50/50。預算（~tok）：skill-pm 4999→4942、design-arm constitution 9219→9187、teamwork bundle 19108→19063、non-design constitution 7301→7275、AC8 strip-saving floor 1918→1912；lean、skill-sr、spec-workshop 不變。golden 12 個重擷取（7 個變）。本波以一個 PR 合進 `main`，不發版（v5.0.0 由人類另下指令）。

範圍由人類指定（integrator prompt「fan-out v5.0.0 里程碑的下一波（第 7 波）：E435」，2026-11-24）：本波只有 E435；先確認第 6 波交接；依 `docs/backlog.md` 的相依判斷剩下的里程碑票能否與 E435 並行；E435 票面以 Audit amendment（`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 裁定 8）為準；改寫測試排成獨立的 qa 任務並照 `task_size` 預算拆；列出讀原始碼文字的測試、受影響的 golden 與預算上限。順序依 17.1 裁定 4（E422 → E423 → E419 → E431 → E432 → E433 → E434 → E445 → E435 → 其餘照 16.1 裁定 17）。依 16.1 裁定 18 與 17.1 裁定 4，E435 負責發 v5.0.0，發版驗證涵蓋九張（E422、E423、E419、E431–E434、E445、E435）；**本波合進 `main` 後結束，發版不在本波範圍**，release-engineer 由人類另外下指令。

## 派工前核對（整合者，2026-11-24，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `244f2f4`（PR #171 merge，第 6 波）、工作樹乾淨；沒有 open 的 pull request；`feat/e435-*`、`integ/v5-w7` 都不存在；`../agent-governance-mcp-lanes/` 不存在（第 6 波 finish 已清掉，派工時建 `_mailbox/e435/`，`agc feature start` 建 worktree）。primary handoff 停在 `release-cd-v4.22.0`（schema 16），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（manifest tier 未開 → cut 在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）、`artifacts` = `repo`。
- **第 6 波交接**：`node scripts/fanout.mjs handoff --check specs/fanout-v5-w6.md` exit 0，5 項事實、0 `DIFF`、3 `MOVED`（目標分支 `b3ac374` → `244f2f4`、worktree、primary `lane-status`，都是 PR #171 合併後的預期結果）。
- **相依（`docs/backlog.md` depends_on 欄，2026-11-24 讀）**：剩下 10 張里程碑票（E435、E424、E425、E430、E426、E427、E428、E443、E420，及里程碑外的 E446、E447）。E435←E434 ✓，且 17.1 裁定 4 排在 E445（✓）之後，可以開。其餘：E424←E422、E435；E425←E422、E424、E435；E430←E425；E426←E422、E435；E427←E424；E428←E422、E423、E425；E443←E422、E425——全部直接或間接等 E435。E420←E419 ✓、E434 ✓，相依已滿足，但 16.1 裁定 17 排最後（E443 之後），票面要等新鏈上有 design-armed feature 結案後重新量測，且動 `content/const-07-design-chain-gates.md`、`content/const-13-design-chain-s4.md`、`content/skill-reviewer-visual.md`、`gates/registry.ts`、`tools/transitions.ts`、golden 與預算，與 E435 撞共用生成物與同批原始碼。E446（相依無）、E447（「ordered after E435」）排在里程碑之後，各自改 `content/**` 與 `test/context-budget.test.mjs`。
- **沒有票能與 E435 並行**（與人類預期相同）：其餘里程碑票都相依 E435；E420 排最後且撞共用生成物；E446、E447 在里程碑之後且撞共用生成物。本波單一 lane e435；共用生成物全部歸 e435。
- **E435 的程式面（`main` @ `244f2f4` 實讀）**：
  - 路徑標記 `chain_path`：`tools/{transitions,handoff-orchestrator,handoff-types,handoff-parse,handoff-write,registry,evidence-file}.ts`、`gates/registry.ts`、`schema/migrations-handoff.ts`、`scripts/release.mjs`；`content/` 6 檔（`const-06-chain-31-head`、`coord-07-core-sop`、`skill-architect`、`skill-code-reviewer`、`skill-pm`、`skill-qa-engineer`）。handoff schema 目前 16（`schema/versions.ts:8`）→ 17，lazy migration 丟掉 `chain_path`。
  - `resume_of`：enum 在 `tools/{registry,handoff-types,handoff-parse,handoff-write,transitions,handoff-orchestrator}.ts`；`content/` 5 檔（`const-05-core-standards`、`const-08-chain-31-mid`、`coord-03-core-fallback`、`skill-code-reviewer`、`skill-pm`）；去掉 `qa-engineer` 值。
  - 三個錯誤碼：`QA_ROUND_EXCEEDED`（`tools/transitions.ts:66,542`、`gates/registry.ts:12,80,142,693`、`content/skill-qa-engineer.md`）；`REVIEWER_COMPLETED_TASKS_REJECTED`（`gates/registry.ts:38,106,529`、`tools/handoff-orchestrator.ts:742–782`、`content/skill-code-reviewer.md`）；`NON_QA_COMPLETED_TASKS_REJECTED`（`gates/registry.ts:39,107,545`、`tools/handoff-orchestrator.ts:743–806`、`content/const-08-chain-31-mid.md`）。後兩個同屬 pipeline 第 `REVIEWER_COMPLETED_TASKS_REJECTED` 步。`GATE_REGISTRY` 目前 35 條、pipeline 17 步（`dist/` 實測）。
  - qa 輪數上限：`tools/transitions.ts:431`（`ROUND_CAP = 4`）、`:536`；`qa_round`／`qa_rounds_total` 欄位在 `tools/{handoff-orchestrator,handoff-types,handoff-parse,handoff-write,storage-sqlite,metrics,gate-stats,lane-status}.ts`、`gates/{pipeline,registry}.ts`、`schema/migrations-handoff.ts`、`scripts/summarize-metrics.mjs`、`content/{coord-03-core-fallback,skill-qa-engineer}.md`、`README.md`、`docs/{architecture,schema-versions,lane-protocol}.md`。**欄位本身要不要一起拆**（只拆上限、留一個永遠為 0 的計數，或升 schema 時一起丟掉）票面沒寫，交 lane 的 architect 裁定；測試影響差很多（見測試計數）。
  - tool description：`tools/registry.ts:712`（status PASS）、`:719`（`completed_tasks`）、`:901`（`tw_complete_task`）——票面寫的 `:692,712,883,901` 是 2026-11-19 的行號，現在位置已移動，cut 照內容重新定位。
  - 錯誤碼對照：`gates/registry.ts:80,106,107` 的對照註解由 `test/e434-reviewer-visual.test.mjs`（第 689–695 行）比對 content；`documentedInProse` 由 `test/error-code-contract.test.mjs` 比對。registry 與 content 同一個 commit 改。
  - 遷移說明（新檔，建議 `docs/migration-v5.md`）：涵蓋舊路中途的 handoff 怎麼收尾或重開、重新複製 `~/.claude/agents/`（qa 改 opus、`qa-visual.md` 已移除）、`.current/skill-qa-visual.md` 覆寫檔、`templates/agent-adapters/claude.md:12` 的「judging in-context」用語、重新蓋版本戳記。in-flight 提示（票面驗收第 3 條）指向這份檔。`CHANGELOG.md` 的遷移段由 release-engineer 在發版時寫，不在本波。
  - `CLAUDE.md`（250 行）：第 78 行 Layout 列寫 `ROUND_CAP=4`；若 pipeline 步數變了，第 48、62 行的「17-step」也要改；Execution Profile 的「judging in-context」段與 `templates/agent-adapters/claude.md` 同源。`agc-version` 戳記（`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`）由 release-engineer 在發版 commit 蓋，lane 不動。
  - SQLite：`chain_path` 與 `sr_return_count` 自 E431 起只在 file mode（`tools/transitions.ts:55–57`）；拆掉標記後新路就是唯一的路，但 SQLite 模式的 `sr_return` 上限仍不生效。見待人類決定 2。
- **compose golden**：12 個全部會動——7 個 full／monolith／hook-full 收 `const-06`／`const-08`（`chain_path`、`NON_QA_COMPLETED_TASKS_REJECTED`、`resume_of`），4 個 lite 與 `hook-lite` 收 `const-05`（`resume_of`），`skill-coordinator-monolith` 收 `coord-03`／`coord-07`。實作完才擷取得到，見待人類決定 1。
- **預算上限（`test/context-budget.test.mjs`，零餘裕）**：第 204 行 lean always-on ≤ 5969、第 497 行 skill-pm ≤ 4999、第 530 行 skill-sr ≤ 3285、第 599 行 design-arm constitution ≤ 9219、第 630 行 teamwork bundle ≤ 19108、第 958 行 non-design constitution ≤ 7301 預期會動（拆文字通常變小，上限照實測值下調）；第 513 行 spec-workshop ≤ 1415 不動。
- **測試計數（派工 base `244f2f4`，literal grep，未跑）**：`test/*.test.mjs` 275 檔；267 檔提到 `qa-engineer`，其中 256 檔只有作者行 `// Coded by @qa-engineer`（保留）；**127 檔** 在作者行以外提到 `qa-engineer`，或提到 `chain_path`／`qa_round`／`resume_of`／三個錯誤碼（上限）。其中 **93 檔** 是核心：提到被拆的識別字，或同一行出現 `qa-engineer` 與 PASS／complete／code-reviewer（舊路行為）；另 **34 檔** 只是文字釘點（讀 content／template／SOP 措辭）。票面的「約 114」落在兩者之間。若 architect 決定保留 `qa_round` 欄位（只拆上限），只在狀態 fixture 裡帶 `qa_round: 0` 的 30 餘檔多半不紅，實際範圍接近 93；一起拆則接近 127。大檔：`test/qa-flow.test.mjs`（2565 行、366 處）、`test/e431-test-first-server-path.test.mjs`（816 行、110 處）單檔就超過一個任務的 300 行。計數腳本與逐檔排序在整合者 scratch，不進 repo；lane 的 PM probe 只能證明 base 綠，紅檔清單要由 qa 讀新契約逐檔判定（expected-red 檔）。
- **E435 在佇列檔**：`docs/v4.0.0-new-tickets.md` 第 291 行（第 248 號列），結案記帳加 done-mark（尚未發版，隨 v5.0.0 發出）。backlog 第 558 行。

### 讀原始碼文字的測試（literal 與 regex 寫法一起搜：`qa-engineer`、`chain_path`、`qa_round`、`resume_of`、三個錯誤碼、`compose-golden`、`CLAUDE.md`、`GATE_REGISTRY.length`；本波只有一條 lane，下列全部歸 e435）
測試檔名省略 `test/` 與 `.test.mjs`：

| 被讀的檔 | 讀它的測試 | 檢查什麼 | 本票會不會打紅 |
|---|---|---|---|
| `gates/registry.ts` 與 `content/*.md` | `error-code-contract` | registry ⊆ 錯誤碼宣告；`documentedInProse` 的碼在 content 以反引號出現；content 引用的碼在 registry | **會紅**：三個碼拆掉（或改名）時 registry 與 content 同 commit；測試改寫 |
| `gates/registry.ts` 對照註解 × `content/*.md` | `e434-reviewer-visual`（第 689–695 行） | 註解每列 = 實際引用該碼的 content 檔 | **會紅**：第 80、106、107 行三列移除 |
| `GATE_REGISTRY.length` | `e26-gate-stats`（第 78、80、91、214、329、343、656 行）、`e308-single-source-tier-enum`（第 96 行） | 35 條 | **會紅**：拆幾條就改成幾條 |
| `UPDATE_STATE_GATE_PIPELINE` 步序 | `e35-pipeline-order` | 17 步與順序 | **會紅**（若整步拆掉或改名）；`CLAUDE.md` 第 48、62 行同步 |
| `tools/transitions.ts` 交接表 | `qa-flow`、`hop-count-transitions`、`e38-next-role-lookahead`、`e151-resume-of-rejection-hint`、`visual-round-transitions`、`e128-blocked-self-loop-repro` | 舊路邊（pm→sr、sr→code-reviewer→qa、qa PASS）、`QA_ROUND_EXCEEDED`、`resume_of: qa-engineer` | **會紅**：改寫成新鏈；舊路改測拒絕與 in-flight 提示 |
| 新路標記 | `e431-test-first-server-path`、`e432-judge-report-checks`、`e433-test-first-rules`、`gates-expected-red`、`e396-covers-expected-red` | `chain_path` 設定點、依標記判斷裁判 | **會紅**：標記拆掉，判斷改為無條件新鏈 |
| completed_tasks 兩道 gate | `reviewer-completed-tasks-gate`、`e150-completed-tasks-carry-forward`、`e181-pending-notes-roundtrip`、`e139-non-reviewer-verdict`、`e247-pass-tasks-incomplete` | 兩個碼與 qa 能寫 ledger | **會紅** |
| handoff schema 與 migration | `handoff-migration`、`schema-versions`、`handoff-versioning`、`handoff-write-arg-guard`、`writestate-options-object`、`e18-write-provenance`、`e20-e21-crash-resilience`、`drift-skew`、`e325-drift-version-peek-race`、`e312-read-path-race` | schema 16、欄位集合、migration 鏈 | **會紅**：16 → 17，丟 `chain_path`（與 `qa_round`，看 architect） |
| `content/*.md` 全部 | `e92-e86-handoff-write-boundary` 語料掃描 | 每個非空行能當 `qa_review` 值寫入 | 不該紅；結案記帳的 backlog 列同樣受檢 |
| `content/*.md` 全部 | `e410-task-alias-content-tail`、`e408-core-task-alias-tail` | 不得用 `Task` 當子 agent 代稱；AC2 行號釘 const-01、const-05、const-08、const-12、skill-coordinator-lite、skill-integrator、skill-pm | **可能紅**：const-05、const-08、skill-pm 行號會移；只改行號釘點 |
| `content/*.md` 全部 | `e440-current-rule-wording`、`e438-origin-fenced-labels`、`e43-test-file-ask-at-dispatch` | 舊句、舊名不得出現（e440 還釘 `resume_of` 用語） | **可能紅**（e440）；新增文字不得寫「is REMOVED」「is retired」類句型 |
| `content/{skill-,const-,coord-}*.md` | `render-structure` | rationale 區段成對 | 不該紅 |
| `content/skill-*.md` 檔數 | `skill-frontmatter`（第 99–106 行） | 13 個 skill 檔 | 不該紅：不新增、不刪 skill 檔 |
| SOP 與 constitution 措辭 | `e16-judge-dispatch-charter`、`e295-hop-cap-and-sop-halves`、`e393-builder-judge-core`、`e380-qa-suite-result-sop`、`skill-evolution-v3.11`、`e5-intake-tiering`、`e407-restatement-citations`、`e391-prompt-audit-stale-facts`、`qa-visual-skill-split`、`e360-qa-visual-review-task-ids`、`phase-0-5-sop`、`constitution-deliverable-guard`、`token-efficiency` | qa 收尾、qa PASS、qa 輪數的措辭 | **會紅**的部分由 qa 判定逐檔改寫 |
| `templates/agent-adapters/claude.md`、`CLAUDE.md` | `agc-adapters`、`e395-claude-md-tail`、`e444-claude-local-adapter`、`e178a-integrator-role`、`e436-stale-handoff-paths` | adapter 樣板文字、`CLAUDE.md` 尾段 | **會紅**（「judging in-context」改寫時） |
| `templates/claude-code-agents/*.md` | `subagent-templates`、`e412-qa-visual-template` | 12 個樣板、模型 pin | 視改寫範圍 |
| 發版腳本與文件 | `e394-release-script`、`e394-release-sop`、`e405-release-runner`、`e405-release-docs`、`verify-release`、`release-staging` | `scripts/release.mjs` 讀 `chain_path` 判斷裁判 | **會紅**：改無條件 code-reviewer；`verify-release` 有 flake 清單項，紅了先看是不是 VR-20 |
| 12 個 compose golden | `compose-equivalence`、`e90-golden-capture-completeness`、`skill-manifest`、`e433-test-first-rules`、`e434-reviewer-visual` | byte-identical | **會紅**：實作後由 qa 重擷取並逐 hunk 說明 |
| `test/context-budget.test.mjs` 上限 | 本檔 | 上列六個上限 | **會紅**（變小不紅；若有增加就紅）：實作後 qa 量測、照實測值調 |
| 其餘狀態 fixture 帶 `qa_round`／`qa-engineer` 的 60 餘檔（metrics、telemetry、lane-status、rag、drift、lease、cut-approval、dispatch-pins、visual 等） | 見 qa 任務 Q8–Q12 | 欄位值或角色名 | 看 architect 對 `qa_round` 欄位的裁定 |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e435 | E435 | feat/e435-remove-old-path | ../agent-governance-mcp-lanes/e435 | `tools/**`、`gates/**`、`schema/**`、`prompts/**`、`scripts/release.mjs`、`scripts/summarize-metrics.mjs`、`scripts/smoke-qa-flow.mjs`、`bin/agent-governance-context.mjs`、`content/**`、`templates/**`、`test/**`、`dist/**`、`CLAUDE.md`、`README.md`、`docs/architecture.md`、`docs/schema-versions.md`、`docs/release-cd.md`、`docs/lane-protocol.md`、`docs/migration-v5.md`、`specs/qa-flow-enforcement-architecture.md`、`specs/e435-*.md`、`.current/e435/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`CHANGELOG.md`、`package.json`、`package-lock.json`、`index.ts`（版號 literal，發版時改）、`AGENTS.md`、`.antigravityrules`（戳記，發版時蓋）、`docs/lane-protocol-addendum.md`、`docs/ticket-format.md`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/discussion-2026-11-10-gate-retro-and-full-auto.md`、`docs/retro-*.md`、`docs/prompt-audit-*`、`NEW-TICKETS.md`、`multi-agent-scripts/**`、`.current/_primary/**` | 做：Audit amendment（1）–（4）——拆 `chain_path` 並升 handoff schema 16 → 17、lazy migration 丟欄位；`resume_of` 去掉 `qa-engineer`；in-flight 提示依「是否為已拆的舊步驟」（pm 直交 sr、code-reviewer APPROVED 交 qa、qa 寫 PASS）判斷，指向遷移說明；pm → sr 一律拒絕；qa 輪數上限與 `QA_ROUND_EXCEEDED`、`REVIEWER_COMPLETED_TASKS_REJECTED`、`NON_QA_COMPLETED_TASKS_REJECTED` 拆除或重新定義，content 與 registry 同 commit、遵守 error-code contract；改寫 `tools/registry.ts` 的 PASS、`completed_tasks`、`tw_complete_task` 描述；qa 的 PASS 與完成權限移除；composed prompt 與 template 不再把 qa 寫成收尾角色；`docs/migration-v5.md`；`CLAUDE.md` Layout 列與 Execution Profile 同步；測試改寫（獨立 qa 任務）；golden 與預算重擷取。不做：發版（`CHANGELOG.md`、版號、戳記、tag、GitHub release）；`VISUAL_ROUND_EXCEEDED` 與視覺 gate 家族（E420）；E424 以後的任何票；使用者家目錄的檔案 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共用生成物**：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` 全部歸 e435（本波沒有別的 lane）。
- **`CLAUDE.md`**：預設禁止，本波劃進，只限 Layout 列（第 48、62、78 行一帶）與 Execution Profile 中與 `templates/agent-adapters/claude.md` 同源的句子；`agc-version` 戳記不動；行數照舊受 `e395-claude-md-tail` 等測試約束。
- **`docs/lane-protocol.md`**：預設禁止，本波劃進，只限提到 `qa_round`／qa 收尾的句子（若 cut 確認有）。
- **`scripts/`**：只限上列三支；其他 `scripts/*.mjs` 不動。
- **`prompts/**`**：`prompts/qa-engineer.ts`、`prompts/code-reviewer.ts`、`prompts/build.ts` 有相關字樣；cut 確認需改才改。
- **`index.ts`**：禁止（版號 literal 是發版的事）；若 cut 發現非版號的必要改動，寄信給整合者。
- **測試檔**：`test/**` 全部劃進，但只有 qa-engineer 改（憲法 §2）；sr 只能做 import 路徑的機械改寫。

### 交給 lane 的 PM（寫進 cut，隨 cut 在 lane session 呈人類核准）
- **實際走法**：完整新鏈，走 architect（約 12 支原始碼、schema 升版、錯誤碼拆除與重新定義、in-flight 提示的判斷方式）：pm → architect → qa-engineer → sr-engineer → code-reviewer。architect 的 Open Questions 回整合者第二次預審。本 lane 的 `approval` 欄為 `human`：cut 與 Open Questions 都在 lane session 呈人類。注意：本票正是拆 `chain_path` 的票，lane 自己的 handoff 仍跑在 `244f2f4` 之後重建的 server 上——lane 開工時 primary 與 lane 的 MCP server 都跑舊程式（有標記），pm 寫入照常設 `chain_path: "test-first"`；sr 改完 `dist/` 後，lane 的 server 要不要重啟、重啟後舊 handoff 經 migration 丟欄位是否仍能走完 sr → code-reviewer，cut 要寫明（建議：lane 內不重啟 server，以 `dist/` 測試驗證，code-reviewer 的 PASS 仍寫在舊 server 上）。
- **architect 要裁的項目（Open Questions，至少這些）**：（a）`qa_round`／`qa_rounds_total` 欄位要不要隨上限一起丟（建議一起丟，同一次 schema 升版；不留永遠為 0 的欄位）；（b）`REVIEWER_COMPLETED_TASKS_REJECTED`／`NON_QA_COMPLETED_TASKS_REJECTED` 是拆除還是改名重定義（新鏈上「非裁判不能寫 ledger」仍有意義，可能改成新碼；pipeline 步數因此不變或少一步，`e35-pipeline-order` 與 `CLAUDE.md` 第 48、62 行跟著）；（c）in-flight 提示的判斷點與文字；（d）SQLite 模式的處理（待人類決定 2 的結果）。
- **測試改寫是獨立的 qa 任務**，照 `task_size` 預算（≤ 5 檔、≤ 300 行），一個任務一個 qa 子 agent。qa 在 `In_Progress` 下連續派多個子 agent 是自我迴圈，不計 hop（`tools/transitions.ts:780`）。整合者建議的拆法（PM 依 architect 的裁定與 probe 結果定稿，任務數會變）：

  | 任務 | 主題 | 檔案（省略 `test/` 與 `.test.mjs`） | 備註 |
  |---|---|---|---|
  | Q1–Q4 | 交接表主檔 | `qa-flow`（2565 行，依 describe 區塊切四段，每段 ≤ 300 行改動） | 同一檔分四個任務，依序做 |
  | Q5 | 交接表其餘 | `hop-count-transitions`、`e38-next-role-lookahead`、`e151-resume-of-rejection-hint`、`visual-round-transitions`、`e128-blocked-self-loop-repro` | |
  | Q6–Q7 | 新路標記 | Q6：`e431-test-first-server-path`（拆兩段之一）、`gates-expected-red`；Q7：`e431` 另一段、`e396-covers-expected-red` | |
  | Q8 | 新路標記（續） | `e432-judge-report-checks`、`e433-test-first-rules` | 兩檔都大，若超過 300 行再拆 |
  | Q9 | ledger gate | `reviewer-completed-tasks-gate`、`e150-completed-tasks-carry-forward`、`e181-pending-notes-roundtrip`、`e139-non-reviewer-verdict`、`e247-pass-tasks-incomplete` | |
  | Q10 | 錯誤碼與 registry 計數 | `error-code-contract`、`e26-gate-stats`、`e308-single-source-tier-enum`、`e35-pipeline-order`、`e434-reviewer-visual`（只限第 689–695 行對照） | |
  | Q11–Q12 | schema 與 migration | Q11：`handoff-migration`、`schema-versions`、`handoff-versioning`、`handoff-write-arg-guard`、`writestate-options-object`；Q12：`e18-write-provenance`、`e20-e21-crash-resilience`、`drift-skew`、`e325-drift-version-peek-race`、`e312-read-path-race` | |
  | Q13–Q14 | 證據與 qa_review | `qa-review-scoped-append`、`e23-evidence-schema`、`e161-qa-suite-result`、`e236-rejected-write-evidence`、`e366-sqlite-rejected-write-evidence`；`e154-multi-covers`、`e136-evidence-path-injective`、`e32-e33-gate-hardening`、`ac-execution`、`repro-first-gate` | |
  | Q15–Q19 | 狀態 fixture（`qa_round`／角色名） | metrics、telemetry、lane-status、lease、cut-approval、dispatch-pins、rag、drift、stale-dispatch 等約 25 檔，每任務 5 檔 | 若 architect 保留 `qa_round` 欄位，多數不紅，任務數減少 |
  | Q20–Q22 | 視覺 | `visual-gate-e2e`、`visual-round-sqlite`、`visual-evidence-gate`、`pixel-gate-attestation`、`baseline-manifest-gate`；`pixel-perfect-*` 兩檔、`qa-visual-skill-split`、`e412-qa-visual-template`、`e360-qa-visual-review-task-ids` | 只改 qa 收尾與 qa PASS 相關，不碰視覺計數（E420） |
  | Q23–Q26 | 文字釘點 | 上表「SOP 與 constitution 措辭」、adapter／template、發版腳本列的約 25 檔 | 依 sr 的 content 改寫，qa 先寫新措辭的釘點 |
  | Q27 | 快照（實作後） | 12 個 golden、`context-budget` 六個上限 | 待人類決定 1 |

  估計 25–28 個 qa 任務、約 100–127 個測試檔；sr 的實作任務另計（原始碼約 15 檔、`content/` 約 13 檔、template、`docs/migration-v5.md`、`CLAUDE.md`、`README.md`、`docs/*`，同樣照 ≤ 5 檔拆，約 7–9 個任務）。每個 AC 都要有實作 task，不只 qa task。
- **expected-red 檔**：`qa_reports/expected-red_<feature>.txt` 會很長（每個預期紅的測試一列、附原因）；qa 每個任務結束追加，sr 實作後逐列清空。
- **快照（golden、預算）**：實作完才擷取得到。人類 2026-11-24 裁定照第 5 波 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用 1 次 `sr_return`，上限 2），qa 重擷取 12 個 golden（逐 hunk 說明）並把預算上限調到實測值（零餘裕），再經 sr（確認無需實作）交 code-reviewer。cut 照此寫明，lane 不再問。
- **SQLite／HTTP 模式**：人類 2026-11-24 裁定：cut 寫明 SQLite 模式也走新鏈（交接表共用）、`sr_return` 上限在 SQLite 模式不生效並寫進 `docs/migration-v5.md`，加一條驗收；不在本票補 SQLite 欄位。architect 的 OQ (d) 因此已有答案。
- **`review_round` 風險**：單一 feature 上百個檔交 code-reviewer 一次判，`review_round` 上限 3。建議 code-reviewer 依 task 分批讀（同一個 `In_Progress`），報告逐 task 列；cut 寫明。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），在 base 上應全綠；cut 寫明 base 的 pass/total。紅檔清單由 qa 逐檔讀新契約判定，不是 probe 產生。
- qa 寫的測試若要比對 base 樹原文，在擷取當下讀進記憶體（Node 20 暫存目錄事後再讀會 ENOENT）；不能用 `git show` 讀 base 樹（T-E77-02 的 meta-test 會擋）。CI 跑 Node 20 與 22。
- `test/eval/` 的情境檔要改寫（改路由）；live `npm run eval` 經人類 2026-11-24 裁定不在本波跑（需要 API key），由 `npm test` 內的 `eval-assertions` 把關。
- cut 預審的信用 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e435`）；architect 的 Open Questions 用 `re: oq e435`。
- 新發現只寫 `.current/e435/pending-tickets.md`。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| pm → sr-engineer 一律拒絕（不論有無不需新測試紀錄） | e435（E435） | ✓ |
| qa-engineer 寫 PASS 被拒，提示點名裁判 code-reviewer；qa 不能 `tw_complete_task`、不能改 ledger | e435（E435） | ✓ |
| 舊路中途的 handoff：升級後第一筆舊步驟寫入（pm 直交 sr、code-reviewer APPROVED 交 qa、qa 寫 PASS）的提示指向遷移說明 | e435（E435） | ✓ |
| `chain_path` 移除；handoff schema 16 → 17、lazy migration 丟欄位；`resume_of` 無 `qa-engineer` 值 | e435（E435） | ✓ |
| qa 輪數上限與 `QA_ROUND_EXCEEDED`、`REVIEWER_COMPLETED_TASKS_REJECTED`、`NON_QA_COMPLETED_TASKS_REJECTED` 拆除或重定義；registry 與 content 一致（`error-code-contract`、`e434` 對照綠） | e435（E435） | ✓ |
| `tools/registry.ts` 的 PASS、`completed_tasks`、`tw_complete_task` 描述改寫 | e435（E435） | ✓ |
| 組合後的 prompt 與出貨 template 不再把 qa-engineer 寫成收尾角色 | e435（E435） | ✓ |
| `docs/migration-v5.md`：舊路中途怎麼收尾或重開、重新複製 `~/.claude/agents/`、`.current/skill-qa-visual.md` 覆寫檔、「judging in-context」用語、重新蓋戳記 | e435（E435） | ✓ |
| SQLite 模式的處理照人類裁定寫進 cut 與驗收 | e435（E435） | ✓ |
| 測試改寫完成；12 個 golden 重擷取、逐 hunk 說明；預算上限照實測值 | e435（qa） | ✓ |
| `CLAUDE.md` Layout 列同步、`agc check` exit 0；build 後 `dist/` 與原始碼一致；`npm audit --audit-level=high` exit 0（`npm run eval` 經人類 2026-11-24 裁定拿掉，見 Decisions） | e435（qa 核對） | ✓ |
| E435 done-mark（尚未發版，由人類另下 release-engineer 指令發 v5.0.0）：backlog 第 558 行、佇列第 248 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build`；golden 與預算綠；`CLAUDE.md` 行數照測試；`agc check` exit 0。
- 合併並建置後重啟 primary 的 MCP server（本票改 server 程式與 handoff schema）；重啟後 `tw_get_state` 讀 primary 的 schema 16 handoff 應 lazy migrate 到 17。
- 記帳：E435 done-mark（尚未發版）；`npm run check:bookkeeping` 直接跑、exit 0；表格儲存格裡的 `|` 跳脫成 `\|`。
- 接線票：無。
- 不發版：合進 `main` 後本波結束；v5.0.0 由人類另外指派 release-engineer（發版驗證涵蓋九張，`CHANGELOG.md` 遷移段、版號、戳記在那裡做）。

## 合併順序
1. `integ/v5-w7` 自當時的 `main` 開。
2. ← `--no-ff` e435 → merge-invariants。
3. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；重啟 server；記帳 commit。
4. `finish e435 --shipped --base integ/v5-w7`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w7`。不發版。

## Dispatch pins
- e435：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=opus`（人類 2026-11-24 裁定，沿用第 5、6 波）。本 lane 不載入 `reviewer-visual`（沒有 design 來源）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-24 | 人類 | 開 v5.0.0 里程碑第 7 波：E435；先確認第 6 波交接；依 backlog 相依判斷能否並行；票面以 Audit amendment（16.1 裁定 8）為準；改寫測試排成獨立 qa 任務、照 `task_size` 預算拆；多 lane 須寫理由並交人類裁定；本波合進 `main` 後結束，發版另下指令 | integrator prompt「fan-out v5.0.0 里程碑的下一波（第 7 波）：E435」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1、17.1 |
| 2026-11-24 | 整合者 | Stage 1 核對：第 6 波交接 `handoff --check` exit 0（只有 `MOVED`）；其餘里程碑票都相依 E435，E420 排最後且撞共用生成物，E446、E447 在里程碑之後且撞共用生成物——沒有票能與 E435 並行。建議單一 lane e435，共用生成物全歸 e435；不拆多條 lane（理由見下方「為什麼不拆 lane」）。測試在 `244f2f4` 重新計數：核心 93 檔、上限 127 檔 | 本檔 |
| 2026-11-24 | 人類 | 核准本清單（回覆「approve」，針對整合者列出的五項建議）：單一 lane e435、`approval` = `human`；擁有欄放寬 `CLAUDE.md`（只限 Layout 列與 Execution Profile 同源句）與 `docs/lane-protocol.md`（只限 `qa_round` 相關句）；快照照 R3 (b)；SQLite 模式走新鏈、`sr_return` 上限不生效並寫進遷移說明、加一條驗收、不補欄位；Dispatch pins 五個角色全部 opus；qa 任務拆法照建議表由 PM 定稿；本波結束不發版。寫進 lane 的 spec，lane 不再問。「另開票把快照規則寫進 sr／qa SOP」的建議不在本次核准內，仍待人類決定 | 整合者 session（回覆「approve」） |
| 2026-11-24 | 整合者 | 清單 PR #172 合進 `main`（merge `a1a36b2`，PR head CI run 45354023509 綠），派工 base = `a1a36b2`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、prompt 點名的路徑都存在，`docs/migration-v5.md` 標為新檔）；建 `_mailbox/e435/`、開信箱與 lane-status 監看、render e435 prompt | 本檔 |
| 2026-11-24 | 整合者 | e435 cut 預審（to-integrator#1，spec @ `d34bc91`）：退回四點（const-11 與 rationale 的條件式舊措辭、`docs/release-cd.md` 沒有 task、expected-red 檔建立順序、`review_round` 上限措辭）（to-lane#1）；修正版（to-integrator#2，spec @ `204ecf9`，42 task，`check --cut` 0 越界，只剩 `APPROVAL_HUMAN`）回 close（to-lane#2） | 本檔；e435 信箱 to-integrator#1、#2 |
| 2026-11-24 | 人類 | e435 cut 核准，在 lane session 親手打字；只影響 e435、內容寫在人類核准的 cut（`specs/e435-remove-old-path.md` @ `204ecf9`）、lane 分支 commit `c83ba83` 的 handoff 可見 `cut_approved: true` | lane session（e435），spec @ `204ecf9`、handoff @ `c83ba83` |
| 2026-11-24 | 整合者 | architect Open Questions 第二次預審（to-integrator#3，architecture @ `f47dbde`）：同意 (a) drop、(b) 新碼、(c)(e)(f) 架構決定；task 調整（T-30、T-31→T-42、T-41）在擁有欄內、每任務 ≤ 5 檔；編譯單元 T-29→T-35（含 T-42）中間 commit 不編譯，交 code-reviewer 時須 0 錯誤；`MISSING_REVIEW_EVIDENCE` 在新鏈上自 E431 起已休眠，不是本 lane 造成，寫進 `pending-tickets.md`（E435-NEW-1）；回 close（to-lane#3） | 本檔；e435 信箱 to-integrator#3 |
| 2026-11-24 | 人類 | OQ 裁定，在 lane session 親手打字（「Q1 yes, Q2 yes」）：(a) `qa_round`／`qa_rounds_total` 隨 schema 16 → 17 丟掉（含 metrics、`tw_gate_stats`、lane-status、拒絕信封；SQLite 欄留在 DDL 不讀不寫）；(b) 拆 `REVIEWER_COMPLETED_TASKS_REJECTED`、`NON_QA_COMPLETED_TASKS_REJECTED`，新增 `NON_JUDGE_COMPLETED_TASKS_REJECTED`（registry 33、pipeline 17 步）；只影響 e435、寫在 architecture 的 Rulings 段、lane 分支可見 | lane session（e435），`specs/e435-remove-old-path-architecture.md` @ `9e9a01f`；e435 信箱 to-integrator#4 |
| 2026-11-24 | 人類 | 本機環境：npm 12 的 `allowScripts` 擋掉 `better-sqlite3` 的安裝腳本（`npm rebuild` 無效），primary 的 `node_modules` 沒有 native binding，lane 連過來的 69 個 SQLite 測試本機紅（CI 綠）。人類在整合者 session 同意做法 A：只在 primary 的 `node_modules/better-sqlite3` 手動跑一次它自己的 `prebuild-install`，不改 `package.json`；改 `allowScripts` 政策（做法 B）不在本波。整合者執行後 binding 可載入，SQLite 測試抽查 8/8 過；通知 lane（to-lane#4） | 整合者 session（回覆「可以，跑 npm rebuild better-sqlite3」「可以，用 A」） |
| 2026-11-24 | 人類 | 完成定義放寬：AC11 與完成定義中的「`npm run eval` 通過」拿掉。`npm run eval` 是 live API 行為測試（需要 `ANTHROPIC_API_KEY`、會花費用、CI 不跑），清單規劃時沒有先查證，lane 跑不了；改由 `npm test` 內的 `eval-assertions` 把關，live eval 要不要在發 v5.0.0 前跑留給人類另外決定。code-reviewer 已判 APPROVED（`a2b4a2f`）並停在 PASS 前等這項裁定；通知 lane（to-lane#6） | 整合者 session（回覆「用 A」）；e435 信箱 to-integrator#6 |
| 2026-11-24 | 整合者 | e435 lane 報告（to-integrator#7）驗證通過：HEAD `91a46a2`（`main..branch` 73 commits）、265 檔 0 越界、禁止檔未動、證據 `review_reports/review_T-E435-01.md` covers T-E435-01..50 且 handoff 為 code-reviewer PASS、工作樹乾淨、新發現 E435-NEW-1；lane 層 CI run 45418530806 @ `91a46a2` 綠（Node 20、22）；回 close（to-lane#7）。lane 自述的憲法 §6 違規（T-E435-34 的 sr 用 `git checkout` 丟棄未 commit 的 `dist/`，code-reviewer 核過無追蹤內容遺失）與 T-30、T-31 超出 `task_size` 行數預算，列給人類 | 本檔；e435 信箱 to-integrator#7 |
| 2026-11-24 | 整合者 | `integ/v5-w7` 自 `main` @ `a1a36b2` 開出；← `--no-ff` e435（merge `f808b6e`），零衝突、無實質解衝突；merge-invariants PASS；build 後 `dist/` 無差異、audit exit 0、`agc check` exit 0、`CLAUDE.md` 250 行；finish 配號 E448、拆除 worktree、信箱、分支；E435 done-mark（backlog 列與佇列第 248 號列）、E448 排進佇列第 259 號列、`check:bookkeeping` exit 0 | 本檔 |

### 為什麼不拆 lane（整合者建議，交人類裁定）
- **錯誤碼 contract 綁住 registry 與 content**：`error-code-contract` 與 `e434` 對照要求兩者同 commit；拆成「server lane」與「content lane」，兩條 branch 各自都是紅的，lane 層 CI 無法各自綠。
- **測試先寫**：qa 改寫的測試要對著同一份新契約；放到別條 lane，該 lane 的 sr 沒有實作可以讓它轉綠。
- **共用生成物一波只能歸一條 lane**：golden 與預算同時受 content 與原始碼影響，只能在一條 lane 擷取。
- **hop 不是瓶頸**：多個 qa／sr 子 agent 在同一角色下連續派是自我迴圈，不計 hop；預估轉移 pm → architect → qa → sr →（快照退回 qa → sr）→ code-reviewer，5–7 次，在 `hop` 上限 14 內。
- 若人類仍要拆，唯一可行的切法是**依序**而非並行：先由 PM 把 E435 拆成兩張（伺服器與 schema 一張、content／template／遷移說明一張），分兩波；這會改票，須先回 PM 再交人類核准，且不會縮短總時間。

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ a1a36b2
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/v5-w7 @ 80d3fcc）
- lane-status：primary（main ← integ/v5-w7 @ 80d3fcc）release-cd-v4.22.0／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 本波 1 條 lane、1 張票（E435）code-reviewer PASS、合併、finish、拆除；尚未發版——v5.0.0 由人類另下指令交 release-engineer 發，發版驗證涵蓋九張（E422、E423、E419、E431–E434、E445、E435）。lane 紀錄在 `.current/history/2026-11/e435/`；裁定與驗證細節在本檔 Decisions 與狀態行。新發現：E448（`MISSING_REVIEW_EVIDENCE` 在新鏈上從未觸發），finish 配號，排在佇列第 259 號列（里程碑之後）。
- 結果：舊路、路徑標記、qa 的 PASS 與完成權限、qa 輪數上限都已拆除；handoff schema 16 → 17（lazy migration 丟 `chain_path`、`qa_round`、`qa_rounds_total`）；`GATE_REGISTRY` 35 → 33（`NON_JUDGE_COMPLETED_TASKS_REJECTED` 取代兩個 ledger 碼）；pipeline 17 步；交接表 22 個 key（`qa-engineer:PASS`／`FAIL` 只出不進）；SQLite 不讀 `qa_round`、`sr_return` 上限在 SQLite 不生效；遷移說明 `docs/migration-v5.md`。
- lane 自述、code-reviewer 已核：sr 在 T-E435-34 用 `git checkout` 丟掉未 commit 的 `dist/` 建置輸出（憲法 §6 禁止），重建後與 commit 一致、無追蹤內容遺失；T-30、T-31 超過 300 行預算，多出的是刪除的舊程式。
- code-reviewer 的 recommended／optional（不開票）：`gates/registry.ts:300-305` 註解仍描述舊鏈；`gates/registry.ts:67-68` 註解措辭；`e435` AC3 的 S3 步驟沒帶 `review_verdict: "APPROVED"`（結果相同）；architect → sr 只在提示函式層測；`visual-evidence-gate` 三個 scope-decision 測試測的是測試內複製的邏輯（E435 前就有）。
- 環境：primary 的 `node_modules/better-sqlite3` 以做法 A 手動補了 native binding；重裝 `node_modules` 後要再跑一次。
### 待人類決定
- 是否發 v5.0.0：本波合進 `main` 後由人類另下 release-engineer 指令。注意 release gate 拆舊路後只認 `(code-reviewer, PASS)`。
- primary 的 MCP server 要在本 PR 合進 `main` 並建置後重啟（`/mcp` 重新連線），primary 的 schema 16 handoff 才會在下一次讀取時遷移到 17。
- 發 v5.0.0 前要不要跑一次 live `npm run eval`（需要 `ANTHROPIC_API_KEY`、會花費用；本波經裁定不跑）。
- E448 要不要進 v5.0.0 里程碑（預設排在里程碑之後）。
- sr 違反憲法 §6 一次（`git checkout` 丟棄建置輸出）：要不要另外開票強化 sr SOP 或派工 brief。
- 要不要另開票處理 npm 12 `allowScripts`（本 repo 是否在 `package.json` 放行 `better-sqlite3`，adopter 以 npm 12 安裝時是否也會缺 binding）。
- 要不要另開票，把「只有實作完才擷取得到的快照」規則寫進 sr／qa SOP（第 5、6、7 波都靠 R3 (b)）。
- 第 6 波留下的事項照舊：使用者層級 subagent 範本重裝（`docs/migration-v5.md` 已寫）、遠端分支 `origin/docs/2026-11-20-file-e445`、E447 排序寫法。
### 進行中的背景工作
無
