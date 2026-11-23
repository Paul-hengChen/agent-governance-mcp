# Fan-out: v5.0.0 里程碑第 4 波（E433）
base: 6264f31    integration branch: integ/v5-w4
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類已核准 2026-11-23（Stage 2，單一 lane e433）；待派工。**

範圍由人類指定（integrator prompt「fan-out v5.0.0 里程碑的下一波（第 4 波）」，2026-11-23）：下一張是 E433，並依 `docs/backlog.md` 的相依找出剩下的票裡能與它同時跑的。順序依 `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 17.1 裁定 4 修訂後的版本（E422 → E423 → E419 → E431 → E432 → E433 → E434 → E445 → E435 → 其餘照 16.1 裁定 17）。依 16.1 裁定 18，合進 `main` 但不發版，與 E435 一起發 v5.0.0。本波結束時不發版。

## 派工前核對（整合者，2026-11-23，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `6264f31`（PR #164 merge：primary handoff 的 schema 16 lazy migration 提交）、工作樹乾淨；沒有 open 的 pull request；`feat/e433-*` branch 不存在；`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary handoff 停在 `release-cd-v4.22.0`（schema 16），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（預設門檻 2 檔／P3；E433 是 P2、約 22 檔 → cut 在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）、`artifacts` = `repo`。
- **primary 的 MCP server 已重啟、跑第 3 波合併後的程式**：本 session 的 server 行程啟動於 2026-11-23 11:18，晚於 `dist/index.js` 的建置時間（同日 11:06）與 E432 的合併（`dbca708`，2026-11-20）；`tw_get_state` 讀 schema 16 的 handoff 沒有報「newer server」錯誤。
- **第 3 波交接**：`node scripts/fanout.mjs handoff --check specs/fanout-v5-w3.md` exit 1：兩個 `MOVED`（目標分支 `d7d917c` → `6264f31`、worktree，合併後的預期結果）和兩個 `DIFF`（`git status` 由「1 項： M .current/_primary/handoff.md」變乾淨；primary `lane-status` 由 dirty 變 clean）。兩個 `DIFF` 同一個原因：第 3 波交接「待人類決定」第 3 項的那個 lazy migration 改動，已由 PR #164（`dbe062f`，只改 `.current/_primary/handoff.md` 一檔）提交進 `main`，不是本波範圍的變動。
- **相依（`docs/backlog.md` 的 depends_on 欄，2026-11-23 讀）**：剩下 12 張票中，相依全部已 DONE 的有 E433（相依 E432，第 3 波已合併）與 E445（相依 E423 ✓）。其餘都等未完成的票：E434←E433；E435←E434；E424←E422、E435；E425←E422、E424、E435；E430←E425；E426←E422、E435；E427←E424；E428←E422、E423、E425；E443←E422、E425；E420←E419、E434。
- **E445 相依已滿足，但不能與 E433 同時跑**：（1）E445 改 `content/skill-spec-workshop.md`，票面寫明 `test/context-budget.test.mjs` AC21（stripped SOP 上限 1092 token、零餘裕）會紅、要把上限調到實測值；E433 改十幾個 `content/**` 檔、重新擷取 12 個 compose golden 與 `test/context-budget.test.mjs` 的上限。`content/**` 與 `test/context-budget.test.mjs` 都是共用生成物，一波只能歸一條 lane。（2）E433 列的 intake 寫明「shared goldens with every `content/**` ticket: series, not parallel」。（3）17.1 裁定 4 把 E445 排在 E434 之後。因此本波只有 E433 一條 lane。
- **E433 的程式面**（票面 + 16.1 審查修正 (2)–(5) + 第 3 波整合者備註）：
  - `content/**`（逐檔列在 Lanes 表）：憲法 `const-01`、`const-05`、`const-06`、`const-08`、`const-12` 與 `constitution-rationale.md`；SOP `skill-qa-engineer`、`skill-sr-engineer`、`skill-code-reviewer`、`skill-pm`、`skill-release-engineer`、`skill-doc-writer`、`skill-integrator`；有提到主鏈的 coordinator 片段 `coord-01`（意圖表第 23 行、第 31 行「only qa-engineer may author tests」）、`coord-02`（第 17 行）、`coord-03`（第 38–41 行）、`coord-07`（第 9 行 mini-chain、step 4a 的 hard floor）；`skill-architect.md` 只在 cut 決定改「architect 在 qa 之前」的位置描述時才動。
  - `templates/claude-code-agents/qa-engineer.md`（`model: sonnet` → `opus`、第 4 行 description）、`templates/claude-code-agents/code-reviewer.md`（第 4 行 description「between sr-engineer and qa-engineer」）。
  - `tools/registry.ts`：prompt 描述**現在在第 1161 行**（qa-engineer，「QA role. Verify code, write tests, rollback bugs.」）與**第 1191 行**（code-reviewer，「clean-context diff judge between sr-engineer and qa-engineer」）；票面的 1148、1179 是審查當時的行號。
  - `tools/fanout-manifest.ts`：`PROMPT_TEMPLATE_3B` 第 86 行「你只負責這張票走到 qa PASS」（16.1 裁定 6）。
  - `gates/registry.ts`：`MISSING_EVIDENCE`（第 304 行起）、`EXPECTED_RED_DIFF_MISSING`（第 357 行起，指向「Phase 0.5 (skill-qa-engineer)」）、`AC_EXECUTION_LOG_MISSING`（第 606 行起，指向「Phase 3.5 (skill-qa-engineer)」）的 `hintStatic`。第 3 波 e432 架構 OQ4 留下、E433 列的整合者備註：cut 要嘛把這三段改成在新路徑上指向 code-reviewer，要嘛寫明不改與理由。只改文字，不加錯誤碼、不改 `GATE_REGISTRY` 條數。
  - `README.md`：第 71 行主鏈、第 106 行 qa-engineer 的 tier `sonnet`、第 125 行「`model: sonnet` for pm / qa-engineer / coordinator」（裁定 17：qa-engineer 改 opus）。第 107 行 qa-visual 是 E434 的，不動。
  - `CLAUDE.md`：票面列了這檔，但目前沒有一行描述主鏈；唯一提到 qa 裁判的是第 247 行 Execution Profile，它在 `agc init` 產生的 adapter 區塊裡（來源 `templates/agent-adapters/claude.md`）。整合者建議不改（qa 改當測試作者後，「code-reviewer、qa-engineer 用 `Task` 派、in-context 會違反 builder ≠ judge」這句仍成立）；cut 若要改第 247 行，連帶 adapter 範本與 adopter 的 `agc check`，先寄信給整合者。
- **票面清單外新增的地方**（literal 與 regex 寫法一起搜，例如 `qa-engineer → PASS`、`\(qa-engineer, PASS\)`、`走到 qa`、`qa PASS`；排除 `dist/`、歷史 spec、CHANGELOG、retro、audit、backlog、佇列、討論檔）：`docs/architecture.md:131`（主鏈）；`docs/release-cd.md:63,69,95`（發版前置條件寫 `(qa-engineer, PASS)`，`test/e405-release-docs.test.mjs:59` 釘）——E432 起 `scripts/release.mjs` 已接受新路徑的 code-reviewer PASS，E433 之後本 repo 的發版 feature 走新鏈，這三處會過時。兩檔都由 cut 決定改不改，不改就寫明理由。`docs/architecture.md:100,245,247` 寫的是伺服器的轉移表，E435 之前兩條路都在，不改。`docs/config.md:275` 是舊路徑的例子，不改。`docs/lane-protocol.md:46` 只說「code-reviewer 與 qa-engineer 的證據」，不改。
- **版本號與條數**：E433 不升 handoff／SQLite schema、不加錯誤碼、不加 pipeline 步驟、不新增 `tools/*.ts` 或 `gates/*.ts`；`content/**` 沒有憲法版本號（`Constitution\s+v[0-9]` 在 `content/`、`README.md`、`CLAUDE.md`、`test/` 都零筆）。cut 若需要其中任何一項 → 先寄信給整合者，由整合者補列釘點測試（第 3 波清單的三張釘點清單可沿用），在整合者 session 由人類核准改劃。
- **本 lane 自己跑的 prompt 不受影響**：MCP server 從 primary 的 checkout 讀 `content/**`，lane worktree 裡改的規則合併前不會服務給任何 session；本 lane 照舊鏈跑（qa-engineer 寫 PASS）。

### 讀原始碼文字的測試（每個會改的檔都查了讀它原始碼的測試；本波只有一條 lane，下列測試全部歸 e433）
`content/**` 的讀者共 85 個測試檔（`grep -l 'content/'`），加上透過 `buildPromptForRole()` 讀組合後 prompt 的測試與 12 個 compose golden。逐檔對應（測試檔名省略 `test/` 與 `.test.mjs`）：

| 被讀的檔 | 讀它的測試 |
|---|---|
| `content/const-01-core-head.md` | `design-auditor-volume-guard`、`e393-builder-judge-core`、`pixel-perfect-design-coverage`、`e295-hop-cap-and-sop-halves`、`e391-prompt-audit-stale-facts`、`e410-task-alias-content-tail` |
| `content/const-05-core-standards.md` | `e130-lane-default`、`e340-task-list-exception`、`e410-task-alias-content-tail`、`e24-exemptions`、`e440-current-rule-wording`、`e393-builder-judge-core`、`e43-test-file-ask-at-dispatch`、`skill-evolution-v3.11` |
| `content/const-06-chain-31-head.md` | `e393-builder-judge-core` |
| `content/const-08-chain-31-mid.md` | `compose-equivalence`、`cut-approval-gate`、`e16-judge-dispatch-charter`、`e18-write-provenance`、`e410-task-alias-content-tail`、`e350-fanout-call-form`、`e296-manifest-tier`、`e391-prompt-audit-stale-facts`、`e393-builder-judge-core`、`e440-current-rule-wording`、`e5-intake-tiering`、`feature-lease`、`skill-evolution-v3.11` |
| `content/const-12-chain-r10-s4.md` | `context-budget`、`e393-builder-judge-core`、`e410-task-alias-content-tail`、`skill-evolution-v3.11` |
| `content/constitution-rationale.md` | `compose-equivalence`、`e438-origin-fenced-labels`、`e391-prompt-audit-stale-facts`、`e439-rationale-fenced-stories` |
| `content/coord-01-core-head.md` | `e130-lane-default`、`e392-subagent-templates`、`e408-core-task-alias-tail`、`e423-spec-workshop`、`e92-e86-handoff-write-boundary`、`skill-manifest` |
| `content/coord-02-host-dispatch.md` | `e308-single-source-tier-enum`、`e403-lean-dispatch-alias`、`e410-task-alias-content-tail`、`e440-current-rule-wording`、`e295-hop-cap-and-sop-halves`、`e393-builder-judge-core`、`e438-origin-fenced-labels`、`e96-dispatch-preference`、`e392-subagent-templates`、`e408-core-task-alias-tail`、`e43-test-file-ask-at-dispatch`、`e437-repo-only-paths` |
| `content/coord-03-core-fallback.md` | `e130-lane-default`、`cut-approval-gate`、`e16-judge-dispatch-charter`、`e296-manifest-tier`、`e350-fanout-call-form`、`e393-builder-judge-core`、`e385-worktree-evidence`、`e391-prompt-audit-stale-facts`、`e416-filing-bar`、`e5-intake-tiering`、`feature-lease`、`e96-dispatch-preference`、`release-staging`、`e297-main-protected-sop`、`e295-hop-cap-and-sop-halves`、`e336-portable-pull`、`e408-core-task-alias-tail`、`e438-origin-fenced-labels`、`e440-current-rule-wording`、`skill-manifest` |
| `content/coord-07-core-sop.md` | `e393-builder-judge-core`、`e408-core-task-alias-tail`、`e5-intake-tiering`、`skill-manifest` |
| `content/skill-qa-engineer.md` | `ac-execution`、`e122-state-render-injection`、`e20-e21-crash-resilience`、`e329-integrator-sop-followups`、`e438-origin-fenced-labels`、`pixel-perfect-visual-compare`、`qa-visual-skill-split`、`render-structure`、`subagent-templates`、`e178a-integrator-role`、`e440-current-rule-wording`、`e376-render-omits-tier`、`e380-qa-suite-result-sop`、`e391-prompt-audit-stale-facts`、`e393-builder-judge-core`、`e407-restatement-citations`、`e43-test-file-ask-at-dispatch`、`e5-intake-tiering`、`repro-first-gate` |
| `content/skill-sr-engineer.md` | `e439-rationale-fenced-stories`、`compose-equivalence`、`context-budget`、`phase-0-5-sop`、`prompt-state-footer`、`repro-first-gate`、`e20-e21-crash-resilience`、`e178a-integrator-role`、`e393-builder-judge-core`、`e438-origin-fenced-labels`、`render-structure`、`subagent-templates`、`skill-evolution-v3.11` |
| `content/skill-code-reviewer.md` | `e118-reviewer-ac-completeness`、`e178a-integrator-role`、`e258a-comment-rule`、`e416-filing-bar`、`skill-evolution-v3.11`、`render-structure`、`subagent-templates` |
| `content/skill-pm.md` | `ac-execution`、`cut-approval-gate`、`context-budget`、`e164-e167-content`、`e410-task-alias-content-tail`、`e438-origin-fenced-labels`、`render-structure`、`skill-manifest`、`subagent-templates`、`e178a-integrator-role`、`e288-integrator-stage0`、`e296-manifest-tier`、`e437-repo-only-paths`、`pixel-perfect-design-coverage`、`e350-fanout-call-form`、`skill-frontmatter`、`e413-pm-question-batch-inline`、`e391-prompt-audit-stale-facts`、`e440-current-rule-wording`、`e439-rationale-fenced-stories`、`skill-evolution-v3.11`、`repro-first-gate`、`widget-shape-spec` |
| `content/skill-architect.md`（cut 決定改才動） | `e438-origin-fenced-labels`、`render-structure`、`context-budget`、`subagent-templates`、`e178a-integrator-role`、`e439-rationale-fenced-stories`、`phase-0-5-sop`、`skill-evolution-v3.11` |
| `content/skill-release-engineer.md` | `e130-lane-default`、`e166-template-defers-staging`、`e295-hop-cap-and-sop-halves`、`e164-e167-content`、`e178a-integrator-role`、`e18-write-provenance`、`e405-release-docs`、`e297-main-protected-sop`、`e336-portable-pull`、`e391-prompt-audit-stale-facts`、`e394-release-sop`、`render-structure`、`feature-lease`、`skill-evolution-v3.11`、`release-staging`、`subagent-templates`、`verify-release` |
| `content/skill-doc-writer.md` | `e178a-integrator-role`、`skill-evolution-v3.11`、`e391-prompt-audit-stale-facts`、`e437-repo-only-paths`、`render-structure`、`subagent-templates` |
| `content/skill-integrator.md` | `e178a-integrator-role`、`e246-mailbox-teardown`、`e286-integrator-trust-and-git`、`e226-integrator-sop-portable`、`e295-hop-cap-and-sop-halves`、`e262-architect-hop-order`、`e296-manifest-tier`、`e329-integrator-sop-followups`、`e288-integrator-stage0`、`e336-portable-pull`、`e292-integrator-sop`、`e349-integrator-repo-facts`、`e355-integrator-generic-wording`、`e297-main-protected-sop`、`e285-integrator-session-handoff`、`e410-task-alias-content-tail`、`e407-restatement-citations`、`e423-spec-workshop`、`e438-origin-fenced-labels`、`e393-builder-judge-core`、`e416-filing-bar` |
| `templates/claude-code-agents/*.md` | `e108-eject`、`e166-template-defers-staging`、`e250-eject-path-escape`、`e392-subagent-templates`、`e408-core-task-alias-tail`、`e404-release-engineer-template`、`e437-repo-only-paths`、`e412-qa-visual-template`、`e423-spec-workshop`、`e436-stale-handoff-paths`、`e438-origin-fenced-labels`、`feature-lease`、`release-staging`、`subagent-templates` |
| `tools/registry.ts` | `dispatch-pins`、`e114-cut-approval-inheritance`、`e116-archive-on-feature-change`、`e178a-integrator-role`、`e150-completed-tasks-carry-forward`、`e23-evidence-schema`、`e296-manifest-tier`、`e35-pipeline-order`、`e26-gate-stats`、`e308-single-source-tier-enum`、`e391-prompt-audit-stale-facts`、`error-code-contract`、`handoff-write-arg-guard`、`e92-e86-handoff-write-boundary`、`skill-evolution-v3.11`、`repro-first-gate` |
| `gates/registry.ts` | `cut-approval-gate`、`e295-hop-cap-and-sop-halves`、`e296-manifest-tier`、`e35-pipeline-order`、`e391-prompt-audit-stale-facts`、`e394-release-sop`、`e431-test-first-server-path`、`e308-single-source-tier-enum`、`error-code-contract`、`e381-owned-clause-tokens`、`e395-claude-md-tail`、`repro-first-gate`、`pixel-gate-attestation`、`reviewer-completed-tasks-gate`、`qa-flow`、`release-staging`、`visual-evidence-gate` |
| `tools/fanout-manifest.ts` | `e177a-manifest`、`e177a-check-cli`、`e178a-integrator-role`、`e178b-fanout-unmatched`、`e296-manifest-tier`、`e343-render-pointer-guard`、`e316-cut-heading-variants`、`e337-subitem-order`；匯入 `PROMPT_TEMPLATE_3B` 的 `e289-render-addendum`、`e290-lane-protocol-generic`、`e294-lane-enterworktree` |
| `README.md`（repo 根目錄） | `subagent-templates`（AC5 第 285–305 行：subagent 安裝小節標題；v3.21.0 AC4：`@teamwork`、`@lite`）；其餘列出 `README.md` 的測試多半在暫存 repo 寫假檔，PM probe 確認 |
| `CLAUDE.md`（repo 根目錄） | `e178a-integrator-role`、`e395-claude-md-tail`、`e436-stale-handoff-paths`、`e432-judge-report-checks`、`e391-prompt-audit-stale-facts` |
| `docs/release-cd.md`（cut 決定改才動） | `e405-release-docs` |

**已知會被 E433 的改動直接打紅的釘點**（literal grep，未試跑；PM probe 用完整套件確認）：

| 測試（行） | 檢查什麼 | 為什麼會紅 |
|---|---|---|
| `test/context-budget.test.mjs:1051` | `const-12` 主鏈圖逐字「… → sr-engineer ↔ code-reviewer → qa-engineer」（票面寫的 1031 是舊行號） | 主鏈改序 |
| `test/context-budget.test.mjs`（各角色上限，含第 586、614、940 行的 E418 re-baseline 註解） | 組合後 prompt 的 token 上限，多數零餘裕 | 文字增減；票面要求回報相對 E418 節省量的差 |
| `test/fixtures/compose-golden/*.txt`（12 檔，`compose-equivalence` 等比對） | 組合後 bundle 逐位元 | 任何 `content/**` 改動 |
| `test/e393-builder-judge-core.test.mjs:21-24,115-127` | builder ≠ judge 條文逐字（票面要求不變）；`const-12` 含「(up to the `qa_round` cap)」；qa SOP 的 `qa_round` 升級路由三段原文 | qa 不再裁判、`qa_round` 的位置與名稱 |
| `test/e5-intake-tiering.test.mjs:382-386` | `coord-07` step 4a「§2 test ownership (only qa-engineer authors tests) and §3 builder ≠ judge」 | 測試歸屬加 bugfix 例外 |
| `test/subagent-templates.test.mjs:160-175`（AC1） | 每個範本的 `model:` 等於對應 SOP 的 `recommended_model` | qa 範本與 `skill-qa-engineer.md` 必須一起改 opus（16.1 審查修正 (6)） |
| `test/qa-visual-skill-split.test.mjs:56-90`（AC-2） | qa SOP 的 Phase 1.5 Absent 分支禁止讀 `skill-qa-visual.md`、Present 分支用 Read 讀它 | 16.1 審查修正 (5)：qa SOP 的 Phase 1.5 載入在本票移除 |
| `test/pixel-perfect-visual-compare.test.mjs:45-52,152-166` | qa SOP 有「Phase 1.5 — Visual Compare」步驟；步驟編號 1..7 | 同上 |
| `test/e438-origin-fenced-labels.test.mjs:63,92-94`（site 35） | qa SOP 的 Phase 1.5 行在 strip 後保留「(lazy-load + PASS-gated when Visual Baselines present)」 | 同上 |
| `test/e440-current-rule-wording.test.mjs:23-27`（site 1） | qa SOP Phase 1.5 的「No `pending_notes` deferral substitutes for it」 | 同上 |
| `test/e391-prompt-audit-stale-facts.test.mjs:82-83` | qa SOP 含 `<agc install>/content/skill-qa-visual.md` 恰好 4 次 | 同上 |
| `test/e178a-integrator-role.test.mjs:133` | `tools/registry.ts` qa-engineer prompt 描述原文 | 描述改寫 |
| `test/e178a-integrator-role.test.mjs:386-408`（AC15） | `PROMPT_TEMPLATE_3B` 宣告上方有 provenance doc comment 區塊 | 改模板時不能動這段註解的位置 |
| `test/e289-render-addendum.test.mjs:83-88` | 模板讀取行之後第二行以「你只負責這張票走到 qa PASS；」開頭 | 16.1 裁定 6 |
| `test/e343-render-pointer-guard.test.mjs:34`、`test/e290-lane-protocol-generic.test.mjs:89-90`、`test/e294-lane-enterworktree.test.mjs:60-64` | 模板恰好含一次 lane-rules 指標；模板沒有一行與 lane-protocol 重複 | 改模板時要維持 |
| `test/e405-release-docs.test.mjs:59` | `docs/release-cd.md` 前置條件第一項含 `(qa-engineer, PASS)` | 只在 cut 決定改 `docs/release-cd.md` 時 |
| `test/error-code-contract.test.mjs:208-212`、`test/e308-single-source-tier-enum.test.mjs:76` | 每條 `hintStatic` 非空；某一條 tier 提示恰好出現一次 | 三段 `hintStatic` 改寫時維持；沒有測試逐字釘這三段文字（`Phase 0.5 (skill-qa`、`Phase 3.5 (skill-qa`、`Provide qa_review or write` 在 `test/` 零筆） |
| `test/e436-stale-handoff-paths.test.mjs:21-59`、`test/e395-claude-md-tail.test.mjs:37-80`、`test/e391-prompt-audit-stale-facts.test.mjs:138-142` | `CLAUDE.md` 第 7、9、11、13、44、64、195、220、221 行原文；Layout 列與錨點順序；不寫測試檔數或 gate 數 | 只在 cut 改 `CLAUDE.md` 時；總行數必須仍是 250 |

另外 `test/eval/`（`npm run eval`，不在 `npm test` 裡）的情境也讀 qa／code-reviewer 範本與 SOP；cut 寫明跑不跑、結果如何。

### 交給 lane 的 PM（寫進 cut，隨 cut 在 lane session 呈人類核准）
- PM probe 用完整測試套件試跑（`node scripts/test-lock.mjs -- npm test`），不只跑相關測試檔；cut 逐檔列出紅的測試，標明是上表已知的還是新發現的。本波只有一條 lane，紅的測試都歸 e433；但若紅的檔不在 Lanes 表擁有欄逐檔列出的名單裡，cut 預審時一併列給整合者，由整合者補進清單並記一列 Decisions（改劃仍需人類在整合者 session 核准）。
- qa 寫的測試若要讀 base 樹的原始碼來比對（例如「改動前的組合結果」），在擷取當下就把內容讀進記憶體；Node 20 上暫存目錄事後再讀會 ENOENT（第 3 波 e432 AC12 的教訓）。不能用 `git show` 讀 base 樹（T-E77-02 的 meta-test 會擋）。CI 跑 Node 20 與 22 兩版。
- cut 預審的信用 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e433`），`lane-status --mailbox-root` 才偵測得到。若走 architect，Open Questions 回來做第二次預審時也一樣。
- 票面約 22 檔，超過單一 sr task 的檔數預算；16.1 審查修正 (6) 要求 cut 先拆成至少 3 個 sr task。建議切法（PM 定）：(a) 憲法片段與 `constitution-rationale.md`；(b) 五個角色 SOP 與兩個範本（qa 的 `recommended_model` 與範本 `model:` 同一個 task）；(c) coordinator 片段、release-engineer／doc-writer／integrator SOP、`tools/registry.ts`、`tools/fanout-manifest.ts`、`gates/registry.ts`、`README.md` 與其他文件。golden 與預算的重新擷取由 qa 在最後一次做，回報相對 E418 節省量的差。
- 每個 AC 都要有實作 task，不只 qa task。
- cut 要決定：（1）三段 `hintStatic` 改不改、改成什麼（不加錯誤碼、條數不變）；（2）`CLAUDE.md` 改不改（整合者建議不改第 247 行）；（3）`docs/architecture.md:131`、`docs/release-cd.md:63,69,95` 改不改；（4）`skill-architect.md` 改不改；（5）`README.md` 第 71、106、125 行的改法；（6）`test/eval/` 跑不跑。
- 舊路徑（沒有 `chain_path` 的 feature）的伺服器行為不變：本票只改服務出去的規則與文字，不改任何 gate predicate、轉移表或 schema。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e433 | E433 | feat/e433-test-first-rules | ../agent-governance-mcp-lanes/e433 | `content/const-01-core-head.md`、`content/const-05-core-standards.md`、`content/const-06-chain-31-head.md`、`content/const-08-chain-31-mid.md`、`content/const-12-chain-r10-s4.md`、`content/constitution-rationale.md`、`content/coord-01-core-head.md`、`content/coord-02-host-dispatch.md`、`content/coord-03-core-fallback.md`、`content/coord-07-core-sop.md`、`content/skill-qa-engineer.md`、`content/skill-sr-engineer.md`、`content/skill-code-reviewer.md`、`content/skill-pm.md`、`content/skill-architect.md`、`content/skill-release-engineer.md`、`content/skill-doc-writer.md`、`content/skill-integrator.md`、`templates/claude-code-agents/qa-engineer.md`、`templates/claude-code-agents/code-reviewer.md`、`tools/registry.ts`、`tools/fanout-manifest.ts`、`gates/registry.ts`、`dist/tools/registry.*`、`dist/tools/fanout-manifest.*`、`dist/gates/registry.*`、`README.md`、`CLAUDE.md`、`docs/architecture.md`、`docs/release-cd.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/subagent-templates.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/pixel-perfect-visual-compare.test.mjs`、`test/e438-origin-fenced-labels.test.mjs`、`test/e440-current-rule-wording.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e289-render-addendum.test.mjs`、`test/e405-release-docs.test.mjs`、`test/e16-judge-dispatch-charter.test.mjs`、`test/e43-test-file-ask-at-dispatch.test.mjs`、`test/e18-write-provenance.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/render-structure.test.mjs`、`test/repro-first-gate.test.mjs`、`test/ac-execution.test.mjs`、`test/e118-reviewer-ac-completeness.test.mjs`、`test/e380-qa-suite-result-sop.test.mjs`、`test/e394-release-sop.test.mjs`、`test/release-staging.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/skill-manifest.test.mjs`、`test/eval/scenarios.mjs`、其他只因本票而紅的測試（PM probe 用完整套件逐檔列出，整合者預審時補進本欄並記 Decisions）、`test/e433-*.test.mjs`（新，qa 定名）、`specs/e433-*.md`、`.current/e433/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/skill-qa-visual.md`、`templates/claude-code-agents/qa-visual.md`、`content/const-07-design-chain-gates.md`、`content/const-09-design-chain-vround.md`、`content/const-11-design-chain-32.md`、`content/const-13-design-chain-s4.md`、`content/coord-05-core-visual-drift.md`（視覺裁判是 E434）；`content/skill-spec-workshop.md`（E445）；`templates/agent-adapters/**`、`AGENTS.md`、`.antigravityrules`；`prompts/**`；`gates/*.ts` 中 `gates/registry.ts` 以外的檔、`tools/handoff-orchestrator.ts`、`tools/transitions.ts`、`tools/tasks.ts`、`schema/**`（伺服器行為與舊路徑移除是 E435）；其他 `tools/**`、`dist/**`；`docs/lane-protocol*.md`、`docs/config.md`；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、討論檔 | 做：票面 (1)–(6)、2026-11-18 補充（15 節裁定 2、7）與 16.1 審查修正 (2)–(6)：憲法的完成條款改指主鏈的裁判、測試歸屬加 bugfix 例外（sr 寫重現測試，依 16.1 裁定 4）、builder ≠ judge 條文不變；qa SOP 改為測試作者（每個情境一個測試、只對公開介面、介面細節自決並列入批次摘要、記錄每個測試為何紅、寫清單、可記「不需新測試」、不再裁判、不看實作；退回經 sr 再到 code-reviewer），移除 Phase 1.5 的視覺子 skill 載入；sr SOP 照測試與情境實作、不改預寫的測試、兩條退回路線與上限；code-reviewer SOP 審測試對情境、跑套件、記每個情境的驗收、寫 PASS、依原因退回 qa／sr／pm，bug 票確認修到原因；pm 與 coordinator SOP 的新路由、architect 在 qa 之前、兩個計數器、tracker 編號沒有票檔時交 `spec-workshop`；release-engineer、doc-writer、integrator SOP 與 `PROMPT_TEMPLATE_3B` 改指主鏈的裁判；`tools/registry.ts` 兩個 prompt 描述；qa 範本與 SOP 釘 opus；三段 `hintStatic` 依 cut；新鏈文字加入時同一個改動移除被取代的舊鏈文字；golden 與預算重新擷取並回報相對 E418 的差。不做：伺服器行為、gate predicate、轉移表、schema、錯誤碼或步驟數；視覺裁判與 `const-11:9-10`（E434）；`skill-spec-workshop.md`（E445）；移除舊路徑（E435）；adapter 範本與 `CLAUDE.md` 第 247 行（除非 cut 經整合者預審後列入） | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共用生成物整組歸 e433**：`content/**`（只限上表逐檔列出的檔）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`。本波沒有別的 lane。E445 的相依已滿足，但同樣要改 `content/**` 與 `test/context-budget.test.mjs`，因此不進本波（見派工前核對）。
- **`CLAUDE.md`**：擁有，但只限 cut 寫明的行；總行數 250；第 7、9、11、13、44、64、195、220、221 行、agc-adapter 區塊（第 236–250 行）與 `agc-version` stamp 不動；本票不新增 `tools/*.ts`，不加 Layout 列。cut 若新增 `tools/*.ts`：Layout 列放在 e395 的 11 列區塊之外，並在區塊外合併一行抵銷（例如第 104–107 行 `gates/*.ts` 清單），先寄信給整合者。
- **`README.md`、`docs/architecture.md`、`docs/release-cd.md`**：擁有，只限派工前核對列出的行；`README.md` 第 107 行（qa-visual）屬 E434。
- **`tools/registry.ts`**：只限第 1161、1191 行一帶的兩個 prompt 描述；`tw_*` 工具的 input schema 與描述不動（`test/e441-tool-description-contracts.test.mjs` 不在本 lane）。
- **`gates/registry.ts`**：只限三段 `hintStatic` 文字；條數、`armCondition`、`documentedInProse` 不動。
- **測試檔**：上面兩張表列出、會被打紅的測試檔逐一劃進 e433；其餘讀 `content/**` 但 probe 綠的測試不必列。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 五個角色（qa-engineer、sr-engineer、code-reviewer、pm、coordinator）的組合後 prompt 描述新順序，沒有任何指令把 qa-engineer 當裁判（非 design 組合；`const-11:9-10` 屬 E434） | e433（E433） | ✓ |
| 單獨讀 qa SOP：寫明情境沒定的介面細節怎麼辦；qa 不看實作；退回經 sr 再到 code-reviewer；可記「不需新測試」；Phase 1.5 視覺載入已移除 | e433（E433） | ✓ |
| sr SOP 寫明兩條退回路線與上限；不改預寫的測試；bugfix 模式 sr 寫重現測試（16.1 裁定 4） | e433（E433） | ✓ |
| code-reviewer SOP：審測試對情境、跑套件、記每個情境的驗收、寫 PASS、依原因退回 qa／sr／pm、bug 票確認修到原因 | e433（E433） | ✓ |
| 憲法：完成條款改指主鏈的裁判；測試歸屬有 bugfix 例外；builder ≠ judge 條文逐字不變 | e433（E433） | ✓ |
| coordinator SOP：tracker 編號沒有票檔時交 `spec-workshop`、自己不寫情境；mini-chain 與主鏈圖改序 | e433（E433） | ✓ |
| release-engineer、doc-writer、integrator SOP 與 `PROMPT_TEMPLATE_3B` 改指主鏈的裁判（16.1 裁定 6） | e433（E433） | ✓ |
| 出貨的範本與 SOP frontmatter 釘選符合裁定 17（qa-engineer opus；sr-engineer、code-reviewer 維持 opus） | e433（E433） | ✓ |
| 三段 `hintStatic` 依 cut 改寫或寫明不改的理由；`GATE_REGISTRY` 條數不變 | e433（E433） | ✓ |
| 新鏈文字與被取代的舊鏈文字不同時出現在服務出去的 bundle；golden 與預算重新擷取，回報相對 E418 的差 | e433（E433） | ✓ |
| `CLAUDE.md` 仍 250 行、`agc check` exit 0；`dist/` 只含本 lane 三個 `.ts` 的產物；`npm audit --audit-level=high` exit 0 | e433（qa 核對） | ✓ |
| E433 done-mark（not yet released：裁定 18，從 `main` 不發版，隨 v5.0.0 發出）；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 `dist/` 無差異；golden capture 無差異；預算在上限內；`CLAUDE.md` 250 行。
- 記帳：E433 done-mark（not yet released），`docs/backlog.md` 列與佇列 `docs/v4.0.0-new-tickets.md` 第 246 號列都要加；`npm run check:bookkeeping` 直接跑、不接 `| tail`，exit 0；表格儲存格裡的 `|` 跳脫成 `\|`。
- 接線票：無。
- 不發版（裁定 18）。合併後 `main` 上的服務規則是新鏈，但 qa 已不載入視覺子 skill、`reviewer-visual` 要等 E434；兩張同在 v5.0.0 發出，發出的版本不會缺視覺裁判。
- 合併後 primary 的 MCP server 需重啟，下一次 prompt 呼叫才會服務新鏈的規則（`content/**` 每次 prompt 讀取，但 `tools/registry.ts`、`tools/fanout-manifest.ts`、`gates/registry.ts` 是編譯過的程式）。使用者層級已安裝的 subagent 範本（Claude Code 的 agents 目錄）不會自動更新，要人類決定是否重裝。
- 下一波 E434 從新鏈的 `main` 開；E445 之後才輪到。

## 合併順序
1. `integ/v5-w4` 自當時的 `main` 開。
2. ← `--no-ff` e433 → merge-invariants。`dist/` 衝突一律重建。
3. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e433 --shipped --base integ/v5-w4`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w4`。不發版。

## Dispatch pins
- e433：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（沿用第 2、3 波；本 lane 照舊鏈跑，裁定 17 的 qa opus 是出貨預設，不是本 repo 的派工釘選）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-23 | 人類 | 開 v5.0.0 里程碑第 4 波：下一張是 E433，依 backlog 相依找出能並行的票；順序依 17.1 裁定 4 修訂版；合進 `main` 不發版（16.1 裁定 18） | integrator prompt「fan-out v5.0.0 里程碑的下一波（第 4 波）」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1、17.1 |
| 2026-11-23 | 整合者 | Stage 1 核對：相依已滿足的是 E433 與 E445；E445 與 E433 共用 `content/**` 與 `test/context-budget.test.mjs`（共用生成物一波只歸一條 lane），且 17.1 裁定 4 排在 E434 之後，本波單一 lane；共用生成物整組歸 e433；讀原始碼文字的測試與已知紅點逐檔列出；第 3 波交接 `handoff --check` 的兩個 `DIFF` 由 PR #164 造成，與本波無關 | 本檔 |
| 2026-11-23 | 人類 | 核准本清單（單一 lane e433；E445 不進本波），含所有權重劃（共用生成物整組歸 e433；`CLAUDE.md`、`README.md`、`docs/architecture.md`、`docs/release-cd.md`、`tools/registry.ts`、`gates/registry.ts` 只限寫明的行與段落）、Dispatch pins 與交給 lane PM 的 cut 決定項；接受第 3 波交接 `handoff --check` 的兩個 `DIFF`（PR #164 造成）；本波結束不發版；寫進 lane 的 spec，lane 不再問 | 整合者 session（回覆「接受兩個 DIFF，核准清單」） |
