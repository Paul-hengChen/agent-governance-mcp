# Fan-out: v5.0.0 里程碑第 2 波（E423 ∥ E431）
base: cc3fa5f    integration branch: integ/v5-w2
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-20。** 兩條 lane 都已合併進 `integ/v5-w2`（e423 merge `3f2d1e7` 零衝突；e431 merge `122d53e`，只有 `dist/tools/registry.*` 兩個 sourcemap 衝突，重建解掉、非實質；e431 補 QA 證據後再合一次 `8f7791d`）、finish、拆除；派工 base `0efc203`（清單 PR #157 merge）；整合 branch 自 `main` `0efc203` 開；整合 CI run 44698804351 綠；本波以一個 PR 合進 `main`，不發版（16.1 裁定 18）。派工後人類裁定四項擁有範圍改劃（1a、2a、5a、6a）與 e431 架構兩項（OQ1、OQ3），見 Decisions。Roll-up：e423 tickets 7、hop 6/14、review 退回 1 輪、qa 退回 0；e431 tickets 11、hop 12/14、review 退回 2 次（各 1 輪）、qa 退回 1 輪；證據 7/7、11/11。

範圍由人類指定（integrator prompt「fan-out v5.0.0 里程碑的下一波」，2026-11-20）：下一張是 E423，並找出剩下的票裡能與它同時跑的。兩張都是 v5.0.0 里程碑的票（`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 裁定 17 的順序）；依裁定 18，合進 `main` 但不單獨發版，與 E435 一起發 v5.0.0。本波結束時不發版。

## 派工前核對（整合者，2026-11-20，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `cc3fa5f`（第 1 波 PR #156 merge）、工作樹乾淨；primary handoff 停在 `release-cd-v4.22.0`（PASS），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（預設門檻 2 檔／P3；兩張都是 P2、約 11 檔 → 兩條 lane 的 cut 都在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`、`artifacts` = `repo`。`../agent-governance-mcp-lanes/` 只剩 `_mailbox/`；`feat/e423-*`、`feat/e431-*` branch 都不存在。
- **相依（`docs/backlog.md` 的 depends_on 欄）**：剩下 14 張票中，相依全部已 DONE 的只有兩張 —— E423（E422）與 E431（E422、E419）。其餘都等未完成的票：E432←E431；E433←E432；E434←E433；E435←E434；E424←E435；E425←E424、E435；E430←E425；E426←E435；E427←E424；E428←E423、E425；E443←E425；E420←E434。E431 的 intake 寫「after E419」，與 E423 之間沒有相依；16.1 裁定 17 的順序 E423 → E419 → E431 是合併順序，不是相依（E419 已依同一份裁定提前並行過）。因此本波只能是 E423 ∥ E431。
- **兩張票的程式面大致分開**：E423 是新 prompt（`prompts/spec-workshop.ts`、`content/skill-spec-workshop.md`，兩檔都不存在）、`content/**` 四處、`gates/visual.ts` 的 mode 解析；E431 是 `tools/transitions.ts`、`tools/handoff-orchestrator.ts`、`tools/tasks.ts`、handoff 三檔、`gates/registry.ts`、`schema/`。E431 不改任何 `content/**`（規則文字是 E433 的範圍），`prompts/build.ts` 不讀 `tools/transitions.ts` → 共享生成物全歸 e423。
- **E423 不需要 `tools/handoff-orchestrator.ts`、`gates/registry.ts`**：orchestrator 的視覺拒絕訊息已帶 `mode=${armCheck.mode}`（`tools/handoff-orchestrator.ts:853,917`），scope-decision 也呼叫同一個 `hasDesignModeRequiringVisual`（:352）；所以「認不得的 mode 也啟動視覺檢查並在錯誤訊息點名該值」只要改 `gates/visual.ts` 的回傳，既有錯誤碼照用、不加新碼。`tw_switch_role` 的角色 enum 本來就不含 prompt-only 的 `integrator`，新 prompt 不進 enum 即被拒。
- **五個檔兩條 lane 都要改，但改的段落不相鄰**（見「所有權重劃」，人類 2026-11-20 核准，裁定 1 = a）：
  - `tools/registry.ts`：e423 只在檔尾 `PROMPT_REGISTRY`（第 1117–1191 行）加一個條目；e431 改 `tw_update_state` 的 input schema 與 PASS refine（第 400–460 行一帶，refine 在第 451 行）與 tool 描述。對應的 `dist/tools/registry.*` 兩邊都會重建，合併後重建、不手動解。
  - `CLAUDE.md`（250 行，`test/e436-stale-handoff-paths.test.mjs` 以固定行號釘第 13、44、64、195、220、221 行）：e423 改第 5–42 行的 prompt 數與清單（第 7–10、33–42 行）和第 115–130 行 `prompts/`、`content/` Layout 列（`test/e178a-integrator-role.test.mjs:208-213` 釘這些句子）；e431 改第 47–109 行的步數、`tools/`、`gates/`、`schema/` 列（第 48、62、78 行與第 102–109 行一帶）。兩邊各自維持總行數 250、不動上述釘點行、不動 e395 的 11 列區塊（`tools/fanout-*.ts` 與 `gates/registry.ts` 之間）。
  - `README.md`：e423 只限第 90–115 行一帶「Per-Role Model Routing」（第 93 行「twelve single-file roles」與角色表）；e431 只限第 20、61、69、71、230 行一帶（round cap、pipeline 步數，只在 architect 改了步數或 cap 時）。
  - `docs/architecture.md`：e423 只限第 18–21 行（「12 registered prompts」與其下的 prompt 名單，2026-11-20 人類裁定 2a 擴到第 20–21 行）；e431 其餘（第 37、47、67–99、128、242–243 行一帶的 pipeline、state machine、round cap）。
  - `CONTRIBUTING.md`：e423 只限第 138 行「11 prompts registered」（已過期一張，改成實數）；e431 只限第 53、64 行（transitions 與 `GATE_REGISTRY — 34 gate definitions`）。
- **票面清單外新增的地方（regex 與 literal grep 一起搜，排除 `dist/`、歷史 spec、CHANGELOG、retro、audit、backlog、佇列）**：E423 —— `docs/architecture.md:18`、`CONTRIBUTING.md:138`、`README.md:93` 之後的角色表；`test/e178a-integrator-role.test.mjs:463` 以 regex 釘 `test/skill-frontmatter.test.mjs` 原始碼裡的 `files.length, 12`（兩檔要一起改）；`test/subagent-templates.test.mjs:164` 一帶的「其他 11 個角色都有範本」（新 SOP 不出範本，比照 `integrator` 例外）。E431 —— `CONTRIBUTING.md:53,64`；handoff schema 目前是 15（`schema/versions.ts:8`），升 16 會碰到 14 個釘版本號的測試（見下）。
- **E423 的測試面**：prompt 數與 SOP 數 —— `test/e178a-integrator-role.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/subagent-templates.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/skill-evolution-v3.11.test.mjs`（第 74–82 行除外，裁定 1a 改劃給 e431）；設計來源偵測 —— `test/design-auditor-volume-guard.test.mjs`、`test/feature-scope-gate.test.mjs`、`test/feature-split-lifecycle.test.mjs`；mode 解析 —— `test/e384-design-mode-declared.test.mjs`、`test/visual-gate-e2e.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/source-credibility-gate.test.mjs`、`test/baseline-manifest-gate.test.mjs`、`test/pixel-gate-attestation.test.mjs`、`test/visual-report-schema-validation.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`；`content/**` 文字釘點 —— `test/compose-equivalence.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e407-restatement-citations.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/e437-repo-only-paths.test.mjs`、`test/e438-origin-fenced-labels.test.mjs`、`test/e439-rationale-fenced-stories.test.mjs`、`test/e440-current-rule-wording.test.mjs`、`test/e262-architect-hop-order.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e92-e86-handoff-write-boundary.test.mjs`（逐行掃 `content/*.md`）、`test/prompt-state-footer.test.mjs`。
- **E431 的測試面**：transitions —— `test/qa-flow.test.mjs`（:196、:1206、:1219、:1449）、`test/e151-resume-of-rejection-hint.test.mjs`、`test/handoff-write-arg-guard.test.mjs`（:477）、`test/hop-count-transitions.test.mjs`、`test/visual-round-transitions.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`、`test/e128-blocked-self-loop-repro.test.mjs`、`test/e128-orchestrator-blocked-repair.test.mjs`、`test/e409-lite-write-tool-facts.test.mjs`、`test/e441-tool-description-contracts.test.mjs`、`test/e177b-lane-status.test.mjs`、`test/e177b-mailbox-watch.test.mjs`、`test/feature-rollup.test.mjs`、`test/telemetry.test.mjs`、`test/success-metrics.test.mjs`、`test/p0-onboarding-lite-default.test.mjs`、`test/check-version.test.mjs`；registry 計數 —— `test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e308-single-source-tier-enum.test.mjs`、`test/e394-release-sop.test.mjs`、`test/release-staging.test.mjs`；handoff schema 版本 —— `test/schema-versions.test.mjs`、`test/handoff-versioning.test.mjs`、`test/handoff-migration.test.mjs`、`test/cut-approval-gate.test.mjs`、`test/dispatch-pins.test.mjs`、`test/e114-cut-approval-inheritance.test.mjs`、`test/e123b9-lane-flip.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/e235a-relative-prd-path.test.mjs`、`test/e312-read-path-race.test.mjs`、`test/e405-release-runner.test.mjs`、`test/lane-migrate.test.mjs`、`test/stale-dispatch-detection.test.mjs`。
- **兩邊都 grep 得到的 26 個測試檔已逐檔分給一條 lane**（上兩段即分配結果；依主要關注點：mode 解析、prompt 數、`content/**` 文字歸 e423，transitions、registry 計數、schema 版本歸 e431）。`test/visual-gate-e2e.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/e437-repo-only-paths.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/subagent-templates.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs` 都 import `tools/transitions.ts` 但歸 e423：E431 的驗收要求舊路徑結果完全相同，transition 檢查的新參數須為選用，這些檔不該因 E431 變紅。
- **不改的歷史檔**：`specs/` 既有 spec（`specs/qa-flow-enforcement-architecture.md` 除外，E431 票面點名）、`CHANGELOG.md` 既有段、`docs/retro-*`、`docs/prompt-audit-*`、`research/**`。

### 人類裁定（Stage 2，2026-11-20）
1. **五個檔兩條 lane 都要改，怎麼處理**：(a) 按上表的段落拆分，兩條 lane 並行；`fanout.mjs check` 只看檔名，整合者驗證時逐檔看 diff 落在哪幾行；(b) 這波只跑 E423，E431 下一波。—— 已裁 a。
2. **Dispatch pins**：沿用第 1 波（pm、sr、code-reviewer opus，qa sonnet），e431 加 `architect=opus`（整合者提議，隨清單一併核准）。

3. **派工後改劃（2026-11-20，cut 預審時發現）**：(1a) `test/skill-evolution-v3.11.test.mjs` 第 74–82 行（釘 handoff schema 15 的那個 test）改劃給 e431，該檔其餘仍屬 e423；(2a) `docs/architecture.md` 第 20–21 行（第 18 行下的 prompt 名單）改劃給 e423，名單補 `spec-workshop`，不增行、不改框寬；(5a) `test/e295-hop-cap-and-sop-halves.test.mjs` 第 121–126 行（AC11，要求 registry 對照註解沒有 `(none)`）改劃給 e431；(6a) `test/visual-evidence-gate.test.mjs` 第 610–625 行（AC-4，比對 orchestrator 原始碼 `allowed:` 字面）改劃給 e431；兩檔其餘仍屬 e423。

### 交給各 lane 的 PM（寫進 cut，隨 cut 在 lane session 呈人類核准）
- **兩條 lane 共同**：PM probe 一律用完整測試套件試跑（`node scripts/test-lock.mjs -- npm test`），不只跑相關測試檔；cut 逐檔列出紅的測試，標明屬本 lane 擁有或對方擁有。對方擁有的測試打紅 → 寄信給整合者，不自己改。
- **兩條 lane 共同**：cut 預審的信用 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e423`），`lane-status --mailbox-root` 才偵測得到。
- **兩條 lane 共同**：改 `CLAUDE.md` 後總行數仍是 250，`test/e436-stale-handoff-paths.test.mjs`、`test/e395-claude-md-tail.test.mjs` 必須綠；PM 在 cut 寫明改哪幾行、用哪一行合併抵銷新增的行。
- e423：`spec-workshop` 的 `recommended_model`；context-budget 新 prompt 的上限數字（新條目，照 E336／E365 慣例定在實測值、零餘量，cut 附數字）；coord-01 等既有 bundle 若因加字超過上限，調整數字附在 cut；SOP 步驟數的驗收寫法（裁定 16.1 審查第 (5) 點：含簡短形式，不是恰好六步）；是否需要 architect（票面 intake 為 full chain、不含 architect）。
- e431：architect 必經（票面 intake）。cut 決定：SQLite 是否涵蓋（只限 file mode，或升 SQLite schema）；sr→qa 退回上限的錯誤碼名稱與它放在 transitions 或新 gate 模組；pipeline 步數是否改變（改了才動 `README.md`、`CLAUDE.md` 第 48、62 行、`docs/architecture.md` 的步數）；若新增 `tools/*.ts` 或 `gates/*.ts`，新檔的 `CLAUDE.md` Layout 列（見所有權重劃）。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e423 | E423 | feat/e423-spec-workshop | ../agent-governance-mcp-lanes/e423 | `content/skill-spec-workshop.md`（新）、`prompts/spec-workshop.ts`（新）、`tools/registry.ts`（只限檔尾 `PROMPT_REGISTRY` 新增一個條目）、`gates/visual.ts`（只限 mode 解析與 `prototype` mode）、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`CLAUDE.md`（只限第 5–42 行 prompt 數與清單、第 115–130 行 `prompts/` 與 `content/` Layout 列；總行數 250；`agc-version` stamp 與 e436 釘點行不動）、`README.md`（只限第 90–115 行一帶 Per-Role Model Routing）、`docs/install.md`（只限第 294 行一帶 prompt 清單）、`docs/architecture.md`（只限第 18–21 行 prompt 數與名單，裁定 2a）、`CONTRIBUTING.md`（只限第 138 行 prompt 數）、`dist/prompts/spec-workshop.*`、`dist/gates/visual.*`、`dist/tools/registry.*`（與 e431 共用，合併後重建）、派工前核對列出的 E423 測試面全部、其他只因本票而紅的測試（PM probe 用完整套件逐檔列出，整合者預審時確認）、`test/e423-*.test.mjs`（新，qa 定名）、`specs/e423-*.md`、`.current/e423/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；e431 擁有的全部（`tools/transitions.ts`、`tools/handoff-orchestrator.ts`、`tools/tasks.ts`、`tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/storage-sqlite.ts`、`gates/registry.ts`、`schema/**`、`specs/qa-flow-enforcement-architecture.md`、`docs/schema-versions.md`、E431 測試面）；`tools/registry.ts` 的 `PROMPT_REGISTRY` 以外；`gates/visual.ts` 的 mode 解析以外；其他 `tools/**`、`gates/**`、`dist/**`；`templates/claude-code-agents/**`（不出範本）；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md` | 做：第 13 個註冊 prompt `spec-workshop`（prompt-only，比照 integrator：不是 `agent_id`、不寫 handoff、不持 lease、不出 subagent 範本）；SOP 含票面六步、簡短形式（一次完成、不出波次表）、issue-tracker 項目入口與 15.2 裁定 1–3、6；產出：討論紀錄（裁定表、逐筆寫日期）、E422 格式的票檔、精簡波次表（票、分波、相依）與人類核准列。`content/skill-integrator.md` 寫入 16.1 裁定 9 的例外（轉出的清單沒改票、分組、順序且無待選項時 stage 2 不停；有任何改動就停，直到 E443）。coordinator 的設計來源偵測涵蓋本機原型匯出：沒有票檔 → 提示 `spec-workshop`；有票檔 → design-auditor。新 mode `prototype`（`content/skill-design-auditor.md` 與 `gates/visual.ts` 的 `KNOWN_MODES`），Figma 與原型雙來源的規則。`gates/visual.ts`：宣告了認不得的 mode → 啟動視覺檢查、拒絕訊息點名該值（orchestrator 已帶 `mode=`），E384 對 Figma 專屬檢查的保護不變。prompt 數 12→13、SOP 檔數同步；`content/**` 不引用只存在本 repo 的路徑。不做：`tools/handoff-orchestrator.ts`、`gates/registry.ts`、新錯誤碼；E431 的任何檔；`fanout.mjs check` 的波次比對（E443）；E428 的 tracker 解析 | — |
| e431 | E431 | feat/e431-test-first-server-path | ../agent-governance-mcp-lanes/e431 | `tools/transitions.ts`、`tools/handoff-orchestrator.ts`、`tools/tasks.ts`、`tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/storage-sqlite.ts`（cut 決定是否涵蓋）、`tools/registry.ts`（`PROMPT_REGISTRY` 以外：`tw_update_state` input schema、PASS refine、tool 描述）、`gates/registry.ts`、`gates/*.ts` 新模組（只限 architect 設計新增時，cut 列名）、`schema/versions.ts`、`schema/migrations-handoff.ts`、`schema/migrations-sqlite.ts`（cut 決定）、`specs/qa-flow-enforcement-architecture.md`、`docs/schema-versions.md`（只限 handoff 版本紀錄，若有）、`CLAUDE.md`（只限第 47–109 行的步數與 `tools/`、`gates/`、`schema/` Layout 列；新 `tools/*.ts` 列放在 e395 的 11 列區塊外，與 e436 釘點行一樣不動；總行數 250）、`README.md`（只限第 20、61、69、71、230 行一帶）、`docs/architecture.md`（第 18–21 行以外）、`test/skill-evolution-v3.11.test.mjs`（只限第 74–82 行 schema 版本那個 test，裁定 1a）、`test/e295-hop-cap-and-sop-halves.test.mjs`（只限第 121–126 行 AC11 test，裁定 5a）、`test/visual-evidence-gate.test.mjs`（只限第 610–625 行 AC-4 test，裁定 6a）、`CONTRIBUTING.md`（只限第 53、64 行一帶）、`dist/tools/{transitions,handoff-orchestrator,tasks,handoff-types,handoff-parse,handoff-write,storage-sqlite}.*`、`dist/tools/registry.*`（與 e423 共用，合併後重建）、`dist/gates/registry.*`、`dist/gates/` 新模組產物、`dist/schema/**`、派工前核對列出的 E431 測試面全部、其他只因本票而紅的測試（PM probe 用完整套件逐檔列出，整合者預審時確認）、`test/e431-*.test.mjs`（新，qa 定名）、`specs/e431-*.md`、`.current/e431/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；e423 擁有的全部（含 `content/**`、golden、預算、`gates/visual.ts`、`prompts/**`、`docs/install.md`、`tools/registry.ts` 的 `PROMPT_REGISTRY`、E423 測試面）；`tools/storage.ts`、`tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/drift.ts`、`tools/lane-status.ts`、`gates/qa-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`scripts/release.mjs`（E432）；`tools/fanout-manifest.ts`（E433）；其他 `tools/**`、`gates/**`；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md` | 做：新路徑與舊路徑並存，什麼都不移除。transition 矩陣加 pm→qa、architect→qa、qa→sr（非 PASS 非 FAIL）、sr→qa（退回）、code-reviewer→PASS、code-reviewer 退件給 qa（須經 sr 才回 code-reviewer），以及 `code-reviewer:PASS` 往 pm、researcher、release-engineer、design-auditor 的出口。入口寫入帶路徑標記（如 `chain_path: "test-first"`），換 `active_feature` 前不可改；transition 檢查依標記關掉另一條路徑的邊（新參數為選用，舊呼叫行為不變）；沒標記的 pm→qa 照舊須 `resume_of`，兩者都沒有則拒絕並提示兩種寫法。四道開工檢查（cut 核准、範圍決定、外部參考、來源可信度）也套用在帶標記的 pm→qa。裁判身分依標記：PASS refine 移進 orchestrator、`tools/tasks.ts:72`、`REVIEWER_COMPLETED_TASKS_REJECTED`、`REVIEW_VERDICT_STATUS_MISMATCH`、ledger 移除與 RAG 清除。sr→qa 退回另計、上限 2、自己的錯誤碼與 registry 條目（34→35）、持久計數；code-reviewer 退件不論給誰都算 review round（上限 4）；hop 上限 14 不變，改 `tools/transitions.ts:325-330` 的註解。handoff schema 15→16、lazy migration。bugfix 模式 sr 照舊寫重現測試、加 code-reviewer PASS。舊路徑每個結果與改動前相同；憲法 §3 文字不動。不做：PASS 時的證據檢查（E432）、任何 `content/**` 規則文字（E433）、視覺裁判（E434）、移除舊路徑（E435）；E423 的任何檔 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則；人類 2026-11-20 核准）
- **共享生成物**（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部 → e423。E431 不改任何 compose bundle。
- **五個檔按段落拆給兩條 lane（偏離「擁有集合不相交」的檔案層級規則）**：`tools/registry.ts`（e423 只限 `PROMPT_REGISTRY` 條目；e431 其餘）、`CLAUDE.md`（e423 第 5–42、115–130 行；e431 第 47–109 行）、`README.md`（e423 第 90–115 行；e431 第 20、61、69、71、230 行）、`docs/architecture.md`（e423 第 18–21 行；e431 其餘）、`CONTRIBUTING.md`（e423 第 138 行；e431 第 53、64 行）。每組段落之間至少隔 5 行未動的行，合併時不應衝突；`fanout.mjs check` 不檢查段落限制（它只看檔名），整合者 5a 驗證時逐檔看 diff 範圍。`dist/tools/registry.*` 兩邊都會重建，合併後 `npm run build` 重建，不手動解。
- **`CLAUDE.md` 的 Layout 列在 Stage 1 就劃給 e431**：E431 的 architect 若新增 `tools/*.ts`，`test/e395-claude-md-tail.test.mjs` AC-E395-5 要求它有 Layout 列；這一列放在 e395 的 11 列區塊外（例如 `tools/transitions.ts` 列附近），並在 e431 自己的段落裡合併一行抵銷，讓總行數維持 250。E423 不新增 `tools/*.ts`。
- **測試檔**：兩邊 grep 都命中的 26 檔已在派工前核對逐檔分配；**打紅規則**：任一 lane 在對方擁有的測試打紅 → 寄信給整合者，不自己改。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| prompt 清單有 `spec-workshop`，`tw_switch_role` 拒絕它 | e423（E423） | ✓ |
| 組好的 `spec-workshop` prompt 含 SOP 各步（含簡短形式），沒有寫 handoff 的指示 | e423（E423） | ✓ |
| coordinator 的設計來源偵測涵蓋本機原型目錄；無票檔 → `spec-workshop` 提示，有票檔 → design-auditor | e423（E423） | ✓ |
| integrator SOP 寫入裁定 9 的 stage 2 例外（有改動照舊停，直到 E443） | e423（E423） | ✓ |
| `prototype` mode 與雙來源規則；宣告了認不得的 mode 會啟動視覺檢查並在拒絕訊息點名；E384 保護不變 | e423（E423） | ✓ |
| prompt 數 12→13、SOP 檔數同步（`CLAUDE.md` 仍 250 行、`README.md`、`docs/install.md`、`docs/architecture.md`、`CONTRIBUTING.md`）；新 SOP 有 `recommended_model`；context-budget 新條目；golden 重抓逐 hunk 說明；`content/**` 無 repo 專屬路徑 | e423（E423，golden 與預算由 qa） | ✓ |
| pm→qa、qa→sr 兩筆寫入被接受；新路徑 code-reviewer 寫 PASS 被接受、qa 寫 PASS 被拒 | e431（E431） | ✓ |
| 退件給 qa 後 qa 直接交回 code-reviewer 被拒；第三次 sr→qa 退回被拒且提示轉 pm | e431（E431） | ✓ |
| 帶標記的 pm→qa 在 cut 未核准時被拒；沒標記也沒 `resume_of` 的 pm→qa 被拒並提示兩種寫法 | e431（E431） | ✓ |
| `code-reviewer:PASS` 的四個出口；舊路徑跑到 PASS 每個結果與改動前相同 | e431（E431） | ✓ |
| 路徑標記持久化、handoff schema 15→16 與 lazy migration；sr→qa 退回錯誤碼與 registry 條目（34→35）；hop 上限 14 與註解修正；文件同步（`CONTRIBUTING.md`、`docs/architecture.md`、`specs/qa-flow-enforcement-architecture.md`、必要時 `CLAUDE.md`、`README.md`） | e431（E431） | ✓ |
| 每條 lane `dist/` 只含自己原始碼的產物（`dist/tools/registry.*` 除外，合併後重建）、`npm audit --audit-level=high` exit 0 | 全部 lane（qa 核對） | ✓ |
| E423、E431 done-mark（not yet released：裁定 18，與 E435 一起發 v5.0.0）；`check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 每次 merge 後 `node scripts/merge-invariants.mjs`；合併後 `npm run build`、`dist/` 無差異（`dist/tools/registry.*` 以重建結果為準）；golden capture 無差異（只有 e423 動 golden）；預算在上限內；`CLAUDE.md` 250 行。
- 記帳：兩列 done-mark（not yet released）；`npm run check:bookkeeping` exit 0。
- 接線票：無。
- 不發版（裁定 18）：從本波合併到 E435 發版之間不從 `main` 發版。
- 16.1 裁定 3 的修訂（OQ1 = a）要寫進 `docs/discussion-2026-11-10-gate-retro-and-full-auto.md`：本波結案記帳時補一列。
- E435 的 backlog 列要補（e431 D1 = a，人類 2026-11-20 在 lane session 裁定）：`chain_path`、`sr_return_count` 只在 file mode 生效，SQLite 維持 2；E435 移除舊路徑時須補 SQLite 支援，或在 cut 寫明 SQLite 不支援。本波結案記帳時寫進 E435 列。
- v5.0.0 CHANGELOG 要寫（e423 預審確認）：宣告了認不得的 design mode（例如 `code`）會啟動視覺檢查、scope-decision 檢查與 design-armed 的 prompt 組合，adopter 看得到。
- 合併後 primary 的 MCP server 需重啟，下一次 `tw_*` 呼叫才會跑合併後的程式（handoff schema 16）。

## 合併順序
1. `integ/v5-w2` 自當時的 `main` 開。
2. ← `--no-ff` e423（共享生成物 lane 先）→ merge-invariants。
3. ← `--no-ff` e431 → merge-invariants。`tools/registry.ts`、`CLAUDE.md`、`README.md`、`docs/architecture.md`、`CONTRIBUTING.md` 若有衝突，逐 hunk 解並送 code-reviewer（5b-5）；`dist/` 衝突一律重建。
4. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish <lane> --shipped --base integ/v5-w2`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w2`。不發版。

## Dispatch pins
- e423：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e431：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-20 | 人類 | 開 v5.0.0 里程碑下一波：從 E423 起，找出能與它同時跑的票；合進 `main` 不發版（16.1 裁定 18） | integrator prompt「fan-out v5.0.0 里程碑的下一波」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 |
| 2026-11-20 | 整合者 | Stage 1 核對：剩下 14 張中只有 E423、E431 的相依全部 DONE；兩條 lane 的程式面分開，共享生成物全歸 e423；`tools/registry.ts`、`CLAUDE.md`、`README.md`、`docs/architecture.md`、`CONTRIBUTING.md` 按段落拆分（交人類裁定）；兩邊都命中的 26 個測試檔逐檔分配；`CLAUDE.md` Layout 列預先劃給 e431；合併順序 e423 先 | 本檔 |
| 2026-11-20 | 人類 | 核准兩條 lane 的清單（e423 ∥ e431），裁定 1 = a（五個共用檔按段落拆分並行），含本檔所有權重劃、測試檔分配、Dispatch pins（e431 加 `architect=opus`）與合併順序 e423 先；本波結束不發版；寫進各 lane 的 spec，lane 不再問 | 整合者 session（回覆「approve (a)」） |
| 2026-11-20 | 人類 | 派工後改劃：1a —— `test/skill-evolution-v3.11.test.mjs` 第 74–82 行（schema 版本 test）歸 e431（e431 預審發現 15→16 會打紅）；2a —— `docs/architecture.md` 第 20–21 行（prompt 名單）歸 e423（e423 cut D12） | 整合者 session（回覆「1a 2a」） |
| 2026-11-20 | 人類 | e431 架構第二次預審：OQ1 = a —— 已標記（`chain_path: test-first`）的 feature 上 pm→qa 一律過四道開工檢查，`resume_of` 不豁免（修訂 16.1 裁定 3「帶 `resume_of` 的交回 qa 照舊不檢查」：只適用未標記的 feature）；OQ3 = a —— 接受舊路徑第二處文字差異（code-reviewer PASS 同時違反另一個輸入檢查時只列另一條，仍被拒），AC12 末句隨之放寬 | e431 lane session（人類親手裁定，lane commit `388c7d9`；整合者預審提出） |
| 2026-11-20 | 人類 | 派工後改劃（e431 sr 發現的跨 lane 紅燈）：5a —— `test/e295-hop-cap-and-sop-halves.test.mjs` 第 121–126 行歸 e431（新錯誤碼依 E300 慣例標 `(none)`）；6a —— `test/visual-evidence-gate.test.mjs` 第 610–625 行歸 e431（開工檢查的 `allowed` 改用 `allowedSuccessors`）；兩檔其餘仍屬 e423，e423 未改這兩段 | 整合者 session（回覆「5a 6a」） |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 0efc203
- 目標分支對 origin：一致
- git status：1 項：?? docs/agc-feedback-2026-11-20-tracked-claude-md.md
- worktree：primary（main ← integ/v5-w2 @ c263a6d）
- lane-status：primary（main ← integ/v5-w2 @ c263a6d）release-cd-v4.22.0／In_Progress／release-engineer，hop 3，commits 0，dirty
### 已結案
- 本波 2 條 lane、2 張票（E423、E431）全部 qa PASS、合併、finish、拆除；兩張都 not yet released，依 16.1 裁定 18 隨 v5.0.0（E435）發出，本波不發版。lane 紀錄在 `.current/history/2026-11/{e423,e431}/`；裁定與驗證細節在本檔 Decisions 與狀態行。新發現：無（兩條 lane 都沒有 pending-tickets；e431 qa 發現的 `code-reviewer:PASS` 換 feature 出口缺口已在 lane 內修掉，不開票）；無未配號的新發現。git status 那一項是人類另外的討論暫存檔，不屬本波。
### 待人類決定
- 是否開下一波：v5.0.0 里程碑順序的下一張是 E432（相依 E431，本波已合併）；由人類決定何時開。
- 合併後 primary 的 MCP server 需重啟一次，下一次 `tw_*` 呼叫才會跑本波合併後的程式（handoff schema 16、`spec-workshop` prompt）。
- v5.0.0 發版時 CHANGELOG 要寫：宣告了認不得的 design mode 會啟動視覺檢查（E423 D3）；E435 要處理 SQLite 模式（已寫進 E435 列）。
### 進行中的背景工作
無
