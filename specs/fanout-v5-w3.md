# Fan-out: v5.0.0 里程碑第 3 波（E432 ∥ E444）
base: 8d57e41    integration branch: integ/v5-w3
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-20。** 兩條 lane 都已合併進 `integ/v5-w3`（e432 merge `80a83c0`、e444 merge `8ab5d3d`，都零衝突、無實質解衝突）、finish、拆除；派工 base `5f50af1`（清單 PR #160 merge）；整合 branch 自 `main` `d7d917c` 開（波中 PR #161 開了 E445，不屬本波）；merge 後 build 無 `dist/` 差異、audit 通過、`CLAUDE.md` 250 行、共用生成物未動；本波以一個 PR 合進 `main`，不發版（16.1 裁定 18）。lane 層 CI：e432 run 44715287224 @ `f6ece2c` 紅（Node 20 的 AC12 測試讀 base 樹的時機錯誤，送回 qa 修），修後 run 44721118494 @ `11f5944` 綠；e444 run 44727017206 @ `f6a7b9c` 綠。Roll-up：e432 tickets 7、hop 5/14、review 退回 0、qa 退回 0；e444 tickets 7、hop 7/14、review 退回 0、qa 退回 0（qa 中途一次 Blocked 交 sr 做裁定後的修正，不計輪次）；證據 7/7、7/7。人類在 lane session 的裁定見 Decisions（e432 D2、OQ1–OQ6；e444 (e)(h)、(j)、(k)(l)）。

範圍由人類指定（integrator prompt「fan-out v5.0.0 里程碑的下一波」，2026-11-20）：下一張是 E432，並找出剩下的票裡能與它同時跑的。E432 是 v5.0.0 里程碑的票（`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 裁定 17 的順序）；依裁定 18，合進 `main` 但不單獨發版，與 E435 一起發 v5.0.0。本波結束時不發版。人類隨後問 E444（2026-11-20 開的票，不在里程碑內）能否同時跑：相依為無、檔案面與 E432 不相交，加入本波（待核准）。

## 派工前核對（整合者，2026-11-20，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `8d57e41`（PR #159 merge：E444 開票）、工作樹乾淨；沒有 open 的 pull request；`feat/e432-*` branch 不存在；`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary handoff 停在 `release-cd-v4.22.0`（schema 16），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（預設門檻 2 檔／P3；E432 是 P2、約 15 檔 → cut 在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`、`artifacts` = `repo`。
- **primary 的 MCP server 已跑第 2 波合併後的程式**：`tw_get_state` 讀 schema 16 的 handoff 沒有報「newer server」錯誤；`schema/versions.ts` 的 `handoff: 16`。
- **第 2 波交接**：`node scripts/fanout.mjs handoff --check specs/fanout-v5-w2.md` exit 1：兩個 `MOVED`（目標分支、worktree，合併後的預期結果）和兩個 `DIFF`（`git status` 由「1 項：?? docs/agc-feedback-2026-11-20-tracked-claude-md.md」變乾淨；primary `lane-status` 由 dirty 變 clean）。兩個 `DIFF` 同一個原因：那個暫存檔已由 PR #159（`0704580`，開 E444）提交進 `main`，不是本波範圍的變動。
- **相依（`docs/backlog.md` 的 depends_on 欄，2026-11-20 讀）**：剩下 12 張票中，相依全部已 DONE 的只有 E432（相依 E431，第 2 波已合併）。其餘都等未完成的票：E433←E432；E434←E433；E435←E434；E424←E422、E435；E425←E422、E424、E435；E430←E425；E426←E422、E435；E427←E424；E428←E422、E423、E425；E443←E422、E425；E420←E419、E434。改相依是改票，不在整合者的權限內，因此本波只有 E432 一條 lane。
- **E444 可以與 E432 同時跑**（人類 2026-11-20 追加詢問）：backlog 列 depends_on 為「—」、P2、不在 v5.0.0 里程碑、intake 為 mini-chain（sr-engineer、code-reviewer、qa-engineer，以 backlog 列為 spec）、約 2 檔（`bin/agc-init.mjs`、`docs/install.md`）加測試。兩檔都不在 e432 的擁有範圍；`bin/agc-init.mjs` 是純 `.mjs`，沒有 `dist/` 產物；票面寫明不改 `content/**`，不動 golden 與預算；不新增 `tools/*.ts`，不動 `CLAUDE.md`。
- **E444 的測試面**：票面點名的 `test/agc-adapters.test.mjs`、`test/e106-init-artifacts-flag.test.mjs`、`test/e239-init-subdir-exclude.test.mjs`、`test/e108-eject.test.mjs`、`test/e250-eject-path-escape.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e429-lane-config-copy.test.mjs`、`test/p0-onboarding-lite-default.test.mjs`；讀 `docs/install.md` 的 `test/e234-hygiene-scan.test.mjs`、`test/e258b-comment-scan.test.mjs`、`test/e259-comment-scan-limits.test.mjs`（`test/agc-feature-lifecycle.test.mjs` 已列）；讀 `bin/agc-init.mjs` 原始碼的 `test/e351-lane-protocol-gaps.test.mjs:108-120`（AC-E351-5：`ARTIFACT_EXCLUDE_RULES` **恰好**是 `/.current/`、`/qa_reports/`、`/review_reports/`、`/tasks.md` 四條。E444 若把 `/CLAUDE.local.md` 加進這個常數就打紅；PM 在 cut 決定另立常數或改這個 test）；把 `bin/agc-init.mjs` 複製進假安裝目錄的 `test/e291-start-link-locations.test.mjs`。
- **E444 碰到 e432 擁有的測試（跨 lane 釘點）**：提到 `agc init`、`agc eject`、`feature start` 的 39 個測試檔中，5 個在 e432 的清單裡，逐一看過都只是順帶提到：`test/e150-completed-tasks-carry-forward.test.mjs`、`test/e431-test-first-server-path.test.mjs`（「feature starts」字樣，誤中）；`test/e394-release-script.test.mjs:128,543`、`test/release-staging.test.mjs:1748`（發版腳本以 `bin/agc-init.mjs check` 呼叫 `agc check`：e444 不改 `check` 子命令名稱與參數）；`test/lane-paths.test.mjs:270-296,333`（grep `bin/` 下 `resolveLanePaths`／lane-paths 的呼叫者允許清單：e444 不在 `bin/agc-init.mjs` 新增 lane-paths 呼叫，`CLAUDE.local.md` 的複製照 `.env` 複製的寫法）。任何一條做不到 → 寄信給整合者，不自己改。
- **E432 的程式面**（票面 + 16.1 審查修正 (2)–(4)）：`gates/qa-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/code-review.ts`（裁判報告若留在 `review_reports/`）、`gates/registry.ts`、`tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/drift.ts`、`tools/handoff-orchestrator.ts`、`tools/storage.ts`、`tools/storage-sqlite.ts`、`tools/lane-status.ts`（`QA_PASS_HEADER_RE`，現在第 213 行）、`scripts/release.mjs`（`preInputs` 與 S1 前置檢查的 `(qa-engineer, PASS)` 判斷，現在第 302、1239 行；票面的 304、1238 是審查當時的行號）。「不需新測試」紀錄若做成 handoff 欄位：再加 `tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`schema/versions.ts`、`schema/migrations-handoff.ts`、`docs/schema-versions.md`，若做成工具入參再加 `tools/registry.ts` 的 `tw_update_state` 段落；SQLite 是否升版見下一條。共用 resolver 若新增 `tools/*.ts` 或 `gates/*.ts`，新檔與它的 `CLAUDE.md` Layout 列都劃進本 lane（見所有權）。
- **SQLite 要不要動是 cut 的決定**：審查修正 (4) 說 `MISSING_EVIDENCE` 兩種模式都跑、SQLite reports 表只記 qa PASS 列（`tools/storage-sqlite.ts:377,388`）；但 E431 的 D1（人類 2026-11-20 在 e431 lane 裁定）讓 `chain_path` 只在 file mode 存在，SQLite 上沒有「新路徑的 feature」。PM 在 cut 寫明 SQLite 是否需要改，不改就寫明理由；`CURRENT_VERSIONS.sqlite` 留在 2 或升版也寫在 cut。
- **票面清單外新增的地方**（literal 與 regex 寫法一起搜，例如 `handoff:\s*16`、`schema_version: 16`、`GATE_REGISTRY.length, 35`、`35 gate`；排除 `dist/`、歷史 spec、CHANGELOG、retro、audit、backlog、佇列）：pipeline 步數在 `README.md:69,232`、`CLAUDE.md:48,62`、`docs/architecture.md:37,47,67`；gate 數在 `CONTRIBUTING.md:64`（`35 gate definitions`）、`docs/architecture.md:114`（`35 entries`）、`docs/architecture.md:37`（`gates/ (14 modules)`）。只有在 cut 改了步數、條數或 gates 模組數時才動。`docs/release-cd.md` 的「`(qa-engineer, PASS)`」檢查項目（`test/e405-release-docs.test.mjs:59` 釘）不改：新路徑在 E433 前不提供給 adopter，舊路徑的這一項照舊成立。

### 讀原始碼文字的測試（每個會改的檔都查了 `readFileSync`／`readSource` 的讀者；lane 改寫法時這些檢查必須仍成立，或在 cut 寫明要改哪一段）
| 被讀的檔 | 測試（行） | 檢查什麼 |
|---|---|---|
| `tools/handoff-orchestrator.ts` | `test/gates-expected-red.test.mjs:304-340`（I5b） | `hasExpectedRedManifest(parsed.workspace_path` **恰好兩個**呼叫點：第一個包在多行 `if (\n          storage instanceof FileHandoffStorage &&`，第二個包在單行 guard。E432 要在 qa → sr 也檢查清單：加第三個呼叫點就會打紅，PM 在 cut 決定是共用既有呼叫點還是改這個 test |
| 同上 | `test/ac-execution.test.mjs:361-370`（I5b） | `hasProofAnnotatedAC(parsed.workspace_path` 呼叫點直接包在 `if (storage instanceof FileHandoffStorage)` 裡，中間沒有區塊結尾 |
| 同上 | `test/e247-pass-tasks-incomplete.test.mjs:188-189` | 原始碼含 `storage instanceof FileHandoffStorage && parsed.status === "PASS"` |
| 同上 | `test/qa-flow.test.mjs:599-603` | 兩句 round 4 forced rollback 的訊息原文 |
| 同上 | `test/error-code-contract.test.mjs:227-236,400-410` | 每個 orchestrator 產生的錯誤碼、每個 `armCondition` 寫到的 predicate 名稱都逐字出現在 orchestrator 原始碼 |
| 同上 | `test/visual-evidence-gate.test.mjs:573-640` | `SCOPE_DECISION_REQUIRED` 提示原文；開工檢查的 `allowedSuccessors` 寫法（第 2 波裁定 6a 後的形式） |
| 同上 | `test/context-budget.test.mjs:977-990`（共用生成物，本 lane 不改） | orchestrator 從 `../gates/visual.js` import `hasDesignModeRequiringVisual`；不要動這個 import |
| 同上、`tools/handoff-parse.ts`、`tools/registry.ts`、`gates/registry.ts` | `test/e308-single-source-tier-enum.test.mjs:14-30,92-94` | 不出現四個 tier 的字面陣列；`GATE_REGISTRY.length` 35 |
| `gates/qa-review.ts`、`gates/code-review.ts` | `test/covering-evidence.test.mjs:290-310,372-395` | `hasEvidenceInFile`／`hasCodeReviewEvidenceInFile` 是該檔**最後一個 export**，函式內 `fs.existsSync(...Path(workspacePath, id))` → `continue;` → `if (coverage === null)` → `buildCoverageIndex(...)` 的先後順序。在這兩檔檔尾加 export 會打紅 |
| `gates/qa-review.ts`、`gates/code-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`tools/evidence-lookup.ts`（與不改的 `gates/visual.ts`） | `test/e136-evidence-path-injective.test.mjs:146-156` | 這六檔不含 `taskId.replace(`，且都用 `encodeEvidenceId` |
| `gates/registry.ts` | `test/e295-hop-cap-and-sop-halves.test.mjs:122-128`（AC11） | 對照註解裡 `(none)` **恰好一個**，且是 `SR_RETURN_CAP_EXCEEDED`。新錯誤碼照 E300 慣例標 `(none)` 就要改這段 |
| 同上 | `test/e431-test-first-server-path.test.mjs:686-715`（AC17） | registry 35 條、`SR_RETURN_CAP_EXCEEDED {10}(none)` 的寫法、pipeline 17 步的名稱與順序、`HOP_CAP` 註解 |
| 同上 | `test/error-code-contract.test.mjs:118-125,476-501,638-683` | 條數 35；對照註解與 `documentedInProse` 的一致 |
| `tools/lane-status.ts` | `test/e177b-lane-status.test.mjs:133-140` | 非註解行不提 fan-out manifest |
| 同上 | `test/e178b-lane-watch.test.mjs:541-548` | `// Watch mode (E178b` 之後的程式不呼叫 `runGit(`、`execFileSync(`、`checkLaneEvidence(`、`computeLaneStatus(` |
| 同上 | `test/e235b-relative-worktree.test.mjs:273-278` | 程式碼不含 `fanout`（不分大小寫） |
| 同上 | `test/e367-lane-status-decode.test.mjs:111-116` | 從 `./evidence-file.js` import `decodeEvidenceId`；`decodeEvidenceId(m[1]) ?? m[1]`；沒有 `ids.add(m[1])` |
| 同上、`tools/drift.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts` | `test/lane-paths.test.mjs:305-330,347-353,600-620` | lane-paths 匯入者與 `resolveCurrentLane` 呼叫者的允許清單：新呼叫者不在清單就紅（新 resolver 若呼叫 `resolveCurrentLane`，要改這兩份清單） |
| `tools/drift.ts`（與 `dist/tools/drift.js`） | `test/e150-completed-tasks-carry-forward.test.mjs:478-490` | 不含 `discarded on conflict`；逐字含 E150 的 feature-scoped 那句 |
| `tools/storage.ts` | `test/writestate-options-object.test.mjs:150-155` | 保留 `@deprecated v3.15.0:` |
| `scripts/release.mjs` | `test/release-staging.test.mjs:38-45`、`test/e164-e167-content.test.mjs:25`、`test/e166-template-defers-staging.test.mjs:67`、`test/e297-main-protected-sop.test.mjs:51-70`、`test/e336-portable-pull.test.mjs:53`、`test/verify-release.test.mjs:1139-1141`、`test/e394-release-script.test.mjs`（整檔執行腳本） | 函式定義存在、pull 一律帶 `-c pull.rebase=false`、PR 流程字面、close-out 函式存在；E432 只改 PASS 判斷，這些不應變 |
| 同上 | `test/e405-release-runner.test.mjs:280-305,799-834` | `RELEASE_STOP PRECONDITION_NOT_PASS:` 前綴與錯誤碼；非 PASS 的 handoff 仍要被擋 |
| `schema/versions.ts` | `test/skill-evolution-v3.11.test.mjs:74-82`、`test/subagent-templates.test.mjs:505-511` | `handoff:\s*16,`、`sqlite:\s*2,` 的寫法；仍 export `CURRENT_VERSIONS` |
| `tools/registry.ts` | `test/e23-evidence-schema.test.mjs:552-570`、`test/e114-cut-approval-inheritance.test.mjs:384-391`、`test/e26-gate-stats.test.mjs:585-590`、`test/e150-completed-tasks-carry-forward.test.mjs:492-500` | 沒有 `evidence_schema` 入參；有 `cut_approved_source` 的 zod 與 JSON-Schema 宣告；`tw_gate_stats` 描述；`completed_tasks` 描述原文（改 `tw_update_state` 描述時要一起看 `test/e441-tool-description-contracts.test.mjs`） |
| `gates/evidence-schema.ts` | `test/e23-evidence-schema.test.mjs:102` | `EVIDENCE_SCHEMA_CURRENT` 是 2 |

### 釘了版本號或條數的測試（只有 cut 改了對應的數字才動；全部劃進本 lane）
- **handoff schema 16 → 17**（「不需新測試」紀錄做成 handoff 欄位時）：`test/schema-versions.test.mjs`、`test/handoff-versioning.test.mjs`、`test/handoff-migration.test.mjs`、`test/cut-approval-gate.test.mjs`、`test/dispatch-pins.test.mjs`、`test/e114-cut-approval-inheritance.test.mjs`、`test/e123b9-lane-flip.test.mjs`、`test/e22-stale-notify.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/repro-first-gate.test.mjs`、`test/stale-dispatch-detection.test.mjs`、`test/success-metrics.test.mjs`、`test/skill-evolution-v3.11.test.mjs`（第 74–82 行）、`test/e431-test-first-server-path.test.mjs`（AC16，第 654–680 行），共 14 檔（以第 2 波 15 → 16 實際改過的 13 檔，加 regex 搜到的 e431 AC16 核對）。
- **SQLite schema 2 → 3**（cut 決定升時）：`test/schema-versions.test.mjs:32`、`test/skill-evolution-v3.11.test.mjs:81`、`test/e431-test-first-server-path.test.mjs:656`；`test/sqlite-versioning.test.mjs` 讀 `CURRENT_VERSIONS.sqlite`，不寫死。
- **`GATE_REGISTRY` 35 條**（新增錯誤碼時）：`test/e26-gate-stats.test.mjs`（第 78、80、91、214、329、343、656 行）、`test/e308-single-source-tier-enum.test.mjs:92-94`、`test/e419-retired-write-mechanisms.test.mjs:76-78`、`test/e431-test-first-server-path.test.mjs:686-687`、`test/error-code-contract.test.mjs:118-125,682-683`；新碼標 `(none)` 時加 `test/e295-hop-cap-and-sop-halves.test.mjs:122-128`。
- **pipeline 17 步**（新增或重排步驟時）：`test/e35-pipeline-order.test.mjs`、`test/e419-retired-write-mechanisms.test.mjs:76-78`、`test/e431-test-first-server-path.test.mjs:696-705`。

### 行為面的測試（literal grep 錯誤碼與 helper，未試跑；PM probe 用完整套件確認）
- `QA_COMPLETION_EVIDENCE_MISSING`：`test/e154-multi-covers.test.mjs`、`test/e150-completed-tasks-carry-forward.test.mjs`、`test/e18-write-provenance.test.mjs`、`test/e247-pass-tasks-incomplete.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e32-e33-gate-hardening.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/e431-test-first-server-path.test.mjs`、`test/error-code-contract.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`。
- `MISSING_EVIDENCE`／`PASS_MISSING_EVIDENCE`：`test/e161-qa-suite-result.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/e366-sqlite-rejected-write-evidence.test.mjs`、`test/e380-qa-suite-result-sop.test.mjs`、`test/error-code-contract.test.mjs`、`test/gates-expected-red.test.mjs`、`test/telemetry.test.mjs`、`test/e431-test-first-server-path.test.mjs`。
- `EXPECTED_RED_DIFF_MISSING`：`test/e161-qa-suite-result.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/e396-covers-expected-red.test.mjs`、`test/error-code-contract.test.mjs`、`test/gates-expected-red.test.mjs`。
- `AC_EXECUTION_LOG_MISSING`：`test/ac-execution.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`。
- `REPRO_MANIFEST_MISSING`：`test/e35-pipeline-order.test.mjs`、`test/e431-test-first-server-path.test.mjs`、`test/error-code-contract.test.mjs`、`test/repro-first-gate.test.mjs`。
- `MISSING_REVIEW_EVIDENCE`（裁判報告若留在 `review_reports/`）：`test/e154-multi-covers.test.mjs`、`test/e139-non-reviewer-verdict.test.mjs`、`test/e18-write-provenance.test.mjs`、`test/e32-e33-gate-hardening.test.mjs`、`test/qa-flow.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`（其餘同上）。
- archive-aware lookup 與 drift：`test/drift-baseline.test.mjs`、`test/e112-drift-fanout-feature-scope.test.mjs`、`test/e136-evidence-path-injective.test.mjs`、`test/drift-skew.test.mjs`、`test/token-efficiency.test.mjs`。
- lane-status 證據比對：`test/e177b-lane-status.test.mjs`、`test/e178b-cut-prereview.test.mjs`、`test/e178b-lane-watch.test.mjs`、`test/e367-lane-status-decode.test.mjs`、`test/e235b-relative-worktree.test.mjs`。
- 發版腳本：`test/e405-release-runner.test.mjs`、`test/e394-release-script.test.mjs`、`test/release-staging.test.mjs`、`test/verify-release.test.mjs`。

### 交給 lane 的 PM（寫進 cut，隨 cut 在 lane session 呈人類核准；前三點兩條 lane 共同，其餘是 e432）
- e444：intake 是 mini-chain、以 backlog 列為 spec，但 cut 照樣先寄整合者預審、再在 lane session 呈人類核准（`cutApprovalAutoTier` 為 `{}`）。cut 決定 `/CLAUDE.local.md` 的 exclude 規則放哪個常數（見 e351 AC-E351-5）、`README.md` 第 33–36 行一帶的安裝範例要不要補 `--adapter`（票面沒列，補就寫進 cut）。
- PM probe 用完整測試套件試跑（`node scripts/test-lock.mjs -- npm test`），不只跑相關測試檔；cut 逐檔列出紅的測試，標明在不在本 lane 擁有範圍內。擁有範圍外的測試打紅（例如 `test/context-budget.test.mjs`、compose golden、`content/**` 的文字釘點）→ 寄信給整合者，不自己改；改劃要人類在整合者 session 核准、記成 Decisions 一列。
- cut 預審的信用 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e432`），`lane-status --mailbox-root` 才偵測得到。architect 的 Open Questions 回來做第二次預審時也一樣。
- 改 `CLAUDE.md` 後總行數仍是 250，`test/e436-stale-handoff-paths.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs:132-142`（Layout 錨點列相對順序）必須綠；cut 寫明改哪幾行、用哪一行合併抵銷新增的行。
- cut 要決定：（1）裁判報告的位置與段落名稱（architect 決定，單一共用 resolver，不是每個 predicate 各抄一份）；（2）「不需新測試」紀錄的形式（裁定 10；handoff 欄位就升 handoff schema 16 → 17，連帶上面 14 檔）；（3）SQLite 改不改、`CURRENT_VERSIONS.sqlite` 升不升（見派工前核對）；（4）qa → sr 的清單檢查用既有 `REPRO_MANIFEST_MISSING` 還是新錯誤碼（新碼就 35 → 36，連帶條數釘點與 e295 AC11）、加不加 pipeline 步驟（加就 17 → 18，連帶步數釘點與文件）；（5）`gates-expected-red.test.mjs` I5b「恰好兩個呼叫點」怎麼處理；（6）是否新增 `tools/*.ts` 或 `gates/*.ts`，新檔名寫在 cut。
- 舊路徑（沒有 `chain_path` 的 feature）每個結果與改動前逐字相同；伺服器照舊不解析清單內容、不跑測試。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e432 | E432 | feat/e432-judge-report-checks | ../agent-governance-mcp-lanes/e432 | `gates/qa-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/code-review.ts`、`gates/registry.ts`、`gates/evidence-schema.ts`（只在 cut 決定升 evidence schema 時）、`gates/*.ts` 新模組（cut 列名）、`tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/drift.ts`、`tools/handoff-orchestrator.ts`、`tools/storage.ts`、`tools/storage-sqlite.ts`、`tools/lane-status.ts`、`scripts/release.mjs`、`tools/transitions.ts`（只在 architect 設計需要時，舊路徑結果不變）、`tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`schema/versions.ts`、`schema/migrations-handoff.ts`、`schema/migrations-sqlite.ts`（以上六檔只在 cut 決定升 schema 時）、`tools/registry.ts`（只限 `tw_update_state` 的 input schema、refine 與描述）、`tools/*.ts` 新模組（cut 列名）、`docs/schema-versions.md`（只限版本紀錄）、`CLAUDE.md`（只限第 47–109 行的步數與 `tools/`、`gates/`、`schema/` Layout 列；新 `tools/*.ts` 列放在第 80 行 `tools/evidence-file.ts` 之後、e395 的 11 列區塊（第 91–101 行）外，並在第 65–109 行內（區塊外）合併一行抵銷，例如把第 104–107 行 `gates/*.ts` 清單重排成 3 行；總行數 250；第 13、44、64、195、220、221 行與 `agc-version` stamp 不動）、`README.md`（只限第 69、232 行的步數）、`CONTRIBUTING.md`（只限第 64 行的 gate 數）、`docs/architecture.md`（只限第 37、47、67–99、114 行一帶的 pipeline、步數、gate 數與模組數）、`dist/gates/{qa-review,ac-execution,expected-red,code-review,registry,evidence-schema}.*`、`dist/gates/` 新模組產物、`dist/tools/{evidence-file,evidence-lookup,drift,handoff-orchestrator,storage,storage-sqlite,lane-status,transitions,handoff-types,handoff-parse,handoff-write,registry}.*`、`dist/tools/` 新模組產物、`dist/schema/**`、派工前核對三張測試清單列出的測試檔全部（`test/context-budget.test.mjs` 除外）、其他只因本票而紅的測試（PM probe 用完整套件逐檔列出，整合者預審時確認）、`test/e432-*.test.mjs`（新，qa 定名）、`specs/e432-*.md`、`.current/e432/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`（共用生成物，本波沒有 lane 改）；`prompts/**`、`templates/**`；`gates/visual.ts`（視覺裁判是 E434）；`tools/tasks.ts`、`tools/fanout-manifest.ts`（E433）；`docs/release-cd.md`、`docs/lane-protocol*.md`；其他 `tools/**`、`gates/**`、`dist/**`；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md` | 做：新路徑（`chain_path: test-first`）的 feature 上，完成證據（`QA_COMPLETION_EVIDENCE_MISSING` 與 PASS 時的 `MISSING_EVIDENCE`）、AC 執行紀錄（`AC_EXECUTION_LOG_MISSING`）與 expected-red 檢查改讀裁判報告，經由單一共用 resolver；drift 與 archive-aware evidence lookup 走同一個 resolver；清單必須存在的檢查也在 qa → sr 交接時啟動，qa 記了「不需新測試」就跳過；bug 票共用紅燈測試清單（16.1 裁定 4：qa 寫了紅燈情境測試就算重現測試；sr → code-reviewer 照舊只看清單在不在，qa 或 sr 建的都算）；`scripts/release.mjs` 與 `tools/lane-status.ts` 接受新路徑的 code-reviewer PASS（16.1 裁定 6）；SQLite 依 cut 決定。只看存在、不解析清單、不跑測試；擴充的檢查原本只在 file mode 跑的照舊只在 file mode。舊路徑每個結果與改動前逐字相同。不做：任何 `content/**` 規則、SOP 或派工範本文字（E433）；視覺裁判（E434）；移除舊路徑（E435）；`tw_complete_task`；`docs/release-cd.md` | — |
| e444 | E444 | feat/e444-claude-local-adapter | ../agent-governance-mcp-lanes/e444 | `bin/agc-init.mjs`、`docs/install.md`、`README.md`（只限第 33–36 行一帶的安裝範例，cut 決定）、派工前核對列出的 E444 測試面全部、其他只因本票而紅的測試（PM probe 用完整套件逐檔列出，整合者預審時確認）、`test/e444-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本票新增的 fixture、`specs/e444-*.md`、`.current/e444/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；e432 擁有的全部（含 `test/lane-paths.test.mjs`、`test/e394-release-script.test.mjs`、`test/release-staging.test.mjs` 與 e432 的三張測試清單）；`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；`templates/**`（區塊文字不變）；`tools/**`、`gates/**`、`schema/**`、`dist/**`；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`；`bin/` 其他檔；歷史 spec、CHANGELOG 既有段、retro、audit；`docs/backlog.md`、`docs/agc-feedback-2026-11-20-tracked-claude-md.md` | 做：票面 (1)–(8)：`agc init --adapter=shared\|local`；預設（裁定 1，B'）只在首次安裝且 `CLAUDE.md` 被追蹤、artifacts 為 `local`、`CLAUDE.md` 沒有區塊時選 `local`，其餘照舊；明確 `--adapter=local` 而 `CLAUDE.md` 已有區塊時寫 `CLAUDE.local.md` 並提示手動移除（裁定 2，`init` 不改被追蹤的檔）；寫進被追蹤的 `CLAUDE.md` 時印一行建議、不跑 git；`agc check` 兩檔任一有區塊都算、兩檔都有印 advisory、skip-worktree／assume-unchanged 印 advisory 與對應指令且不改 exit code；`agc eject` 涵蓋 `CLAUDE.local.md` 與其 exclude 行、旗標檔加進「無法代做」清單；`agc feature start` 把 primary 未追蹤的 `CLAUDE.local.md` 逐位元複製進新 lane（照 `.env`）；`docs/install.md` 新增一節。不做：`AGENTS.md`、`.antigravityrules`（裁定 3）；自動移除既有區塊（裁定 2）；憲法 §6 的 `pull --ff-only` 文字；`bin/agc-init.mjs` 新增 lane-paths 呼叫 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則；人類 2026-11-20 核准）
- **兩條 lane 的檔案面不相交**：e432 在 `gates/`、`tools/`、`schema/`、`scripts/release.mjs` 與幾份文件的特定行；e444 在 `bin/agc-init.mjs`、`docs/install.md` 與 `README.md` 第 33–36 行（e432 的 `README.md` 只限第 69、232 行，相隔 30 行以上）。`fanout.mjs check` 只看檔名，`README.md` 的段落限制由整合者 5a 驗證時看 diff 範圍。跨 lane 的測試釘點見派工前核對（e444 碰到 e432 擁有的 5 檔）。
- **共用生成物**（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）本波不歸任何 lane：E432、E444 都不改 compose bundle，`test/context-budget.test.mjs:977-990` 讀 orchestrator 原始碼的那段，lane 以不動該 import 維持綠。若 PM probe 發現它們打紅 → 寄信給整合者，由人類在整合者 session 裁定改劃給 e432（記一列 Decisions）。
- **`CLAUDE.md` 的 Layout 列在 Stage 1 就劃給 e432**：共用 resolver 若新增 `tools/*.ts`，`test/e395-claude-md-tail.test.mjs` AC-E395-5 要求它有 Layout 列；位置與抵銷方式見 Lanes 表，`test/e391-prompt-audit-stale-facts.test.mjs:138` 的錨點列相對順序不變。
- **`tools/transitions.ts`、`tools/registry.ts`、handoff 三檔與 `schema/`** 是第 2 波 e431 擁有、已合併的檔；本波沒有別的 lane，劃給 e432，但只在 cut 寫明的條件下改（見 Lanes 表括號）。
- **測試檔**：三張測試清單列出的檔整檔劃給 e432（`test/context-budget.test.mjs` 除外），包括第 2 波按段落劃分過的 `test/e295-hop-cap-and-sop-halves.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/skill-evolution-v3.11.test.mjs`。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 新路徑 feature 的裁判報告帶齊所有必要段落時，code-reviewer 寫 PASS 被接受 | e432（E432） | ✓ |
| 同一個 feature 沒有裁判報告時，code-reviewer 寫 PASS 以既有的完成證據錯誤碼被拒 | e432（E432） | ✓ |
| 新路徑 feature 沒有清單、也沒有「不需新測試」紀錄時，qa → sr 被拒；有該紀錄時被接受 | e432（E432） | ✓ |
| 舊路徑 feature 上 qa 寫 PASS，結果與改動前逐字相同 | e432（E432） | ✓ |
| 完成證據、AC 執行紀錄、expected-red 三種檢查與 drift、archive-aware lookup 都經由同一個 resolver；伺服器照舊只看存在 | e432（E432） | ✓ |
| bug 票：sr → code-reviewer 的清單檢查接受 qa 或 sr 建的清單（16.1 裁定 4） | e432（E432） | ✓ |
| `scripts/release.mjs` 與 `tools/lane-status.ts` 接受新路徑的 code-reviewer PASS，舊路徑照舊（16.1 裁定 6） | e432（E432） | ✓ |
| SQLite 的處理依 cut 決定，不改時 cut 寫明理由 | e432（E432） | ✓ |
| 若升 schema、加錯誤碼或加 pipeline 步驟：所有釘點測試與文件同步；`CLAUDE.md` 仍 250 行；新 `tools/*.ts` 有 Layout 列 | e432（E432） | ✓ |
| 被追蹤、沒有區塊的 `CLAUDE.md` + artifacts `local`：無 `--adapter` 的 `agc init` 把區塊寫進 `CLAUDE.local.md`，`CLAUDE.md` 逐位元不變，`/CLAUDE.local.md` 進 `info/exclude`，`git status` 無變化 | e444（E444） | ✓ |
| `CLAUDE.md` 已有區塊、artifacts `repo`、未追蹤或不存在的 `CLAUDE.md`、非 git 目錄：無 `--adapter` 的結果與改動前相同 | e444（E444） | ✓ |
| `--adapter=local` 遇到已有區塊的 `CLAUDE.md`：寫 `CLAUDE.local.md`、`CLAUDE.md` 不變、印移除提示；`--adapter=shared` 首次安裝印一行建議 | e444（E444） | ✓ |
| `agc check`：只有 `CLAUDE.local.md` 有最新區塊時 exit 0；兩檔都有印重複 advisory；skip-worktree／assume-unchanged 印 advisory 與指令，exit code 不變 | e444（E444） | ✓ |
| `agc eject` 刪掉只剩區塊的 `CLAUDE.local.md` 與其 exclude 行，旗標檔的解除指令列在「無法代做」 | e444（E444） | ✓ |
| `agc feature start` 把 primary 未追蹤的 `CLAUDE.local.md` 逐位元複製進新 lane、lane `git status` 乾淨；primary 沒有就不複製 | e444（E444） | ✓ |
| `docs/install.md` 新一節寫明 `--adapter`、首次安裝的預設、不建議 skip-worktree 的原因 | e444（E444） | ✓ |
| e432 的 `dist/` 只含自己原始碼的產物；e444 不產生 `dist/` 變動；`npm audit --audit-level=high` exit 0 | 全部 lane（qa 核對） | ✓ |
| E432、E444 done-mark（not yet released：裁定 18，從 `main` 不發版，兩張都隨 v5.0.0 發出）；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 `dist/` 無差異；golden capture 無差異；預算在上限內；`CLAUDE.md` 250 行。
- 記帳：E432、E444 done-mark（not yet released）；`npm run check:bookkeeping` exit 0。（已完成：`docs/backlog.md` 兩列、佇列 `docs/v4.0.0-new-tickets.md` E432 列；E444 不在佇列裡。E433 列補上 OQ4 的 `hintStatic` 備註。）
- 接線票：無。
- 不發版（裁定 18）：從本波合併到 E435 發版之間不從 `main` 發版。E444 是 adopter 回報的缺陷、不在里程碑內，合進 `main` 後也要等 v5.0.0 才發出；若要更早給 adopter，須依裁定 18 從 v4.22.0 tag 另開 v4.x 分支，做法未定（人類決定）。
- 交給 E433 的 cut（不開新票）：e432 架構 OQ4 把 `MISSING_EVIDENCE`、`EXPECTED_RED_DIFF_MISSING`、`AC_EXECUTION_LOG_MISSING` 在新路徑上指向 skill-qa-engineer 的提示文字留給 E433 改寫，這些文字是 `gates/registry.ts` 的 `hintStatic`，不在 E433 票面的檔案清單裡；E433 的 cut 要把 `gates/registry.ts` 列進來或寫明不改。
- 兩條 lane 共用同一個帳號額度（2026-11-19 起單一帳號）：並行會加快額度消耗，遇到 usage limit 時兩條都會停。
- 若本波升了 handoff schema：合併後 primary 的 MCP server 需重啟，下一次 `tw_*` 呼叫才會跑合併後的程式。

## 合併順序
1. `integ/v5-w3` 自當時的 `main` 開。
2. ← `--no-ff` e432 → merge-invariants。`dist/` 衝突一律重建。
3. ← `--no-ff` e444 → merge-invariants。兩條 lane 檔案不相交，`README.md` 若有衝突逐 hunk 解並送 code-reviewer（5b-5）。
4. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish e432 --shipped --base integ/v5-w3`、`finish e444 --shipped --base integ/v5-w3`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w3`。不發版。

## Dispatch pins
- e432：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（沿用第 2 波 e431）。
- e444：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（mini-chain，不經 architect）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-20 | 人類 | 開 v5.0.0 里程碑下一波：從 E432 起，找出能與它同時跑的票；合進 `main` 不發版（16.1 裁定 18） | integrator prompt「fan-out v5.0.0 里程碑的下一波」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1 |
| 2026-11-20 | 整合者 | Stage 1 核對：剩下 12 張中只有 E432 的相依全部 DONE，本波單一 lane；共用生成物本波不歸任何 lane；`CLAUDE.md` Layout 列預先劃給 e432；讀原始碼文字的測試、版本號與條數釘點、錯誤碼行為測試逐檔列出並劃進 e432；第 2 波交接 `handoff --check` 的兩個 `DIFF` 由 PR #159 造成，與本波無關 | 本檔 |
| 2026-11-20 | 人類 | 詢問 E444 能否與 E432 同時開發 | 整合者 session（「我剛剛有開另一張票 e444，可以同步進行開發嗎？」） |
| 2026-11-20 | 整合者 | E444 核對：相依為無、不在里程碑內、檔案面（`bin/agc-init.mjs`、`docs/install.md`、`README.md` 第 33–36 行）與 e432 不相交、無共用生成物、無 `dist/`；碰到 e432 擁有的 5 個測試檔都只是順帶提到，已在派工前核對寫明 e444 要維持的條件；`test/e351-lane-protocol-gaps.test.mjs` AC-E351-5 釘 `ARTIFACT_EXCLUDE_RULES` 四條，劃給 e444；提議加入本波，合併順序 e432 先 | 本檔 |
| 2026-11-20 | 人類 | 核准兩條 lane 的清單（e432 ∥ e444），含本檔所有權重劃（共用生成物本波不歸任何 lane；`CLAUDE.md` Layout 列預先劃給 e432；第 2 波 e431 的檔有條件劃給 e432；跨 lane 測試釘點的條件）、Dispatch pins 與合併順序 e432 先；接受第 2 波交接 `handoff --check` 的兩個 `DIFF`（PR #159 造成）；本波結束不發版；寫進各 lane 的 spec，lane 不再問。E444 何時發給 adopter（等 v5.0.0 或另開 v4.x 分支）未裁定，不影響本波 | 整合者 session（回覆「approve」） |
| 2026-11-20 | 人類 | e432 cut 核准（cut 預審整合者 close，to-lane#2）：D2 = (a) ——「不需新測試」紀錄是檔案 `qa_reports/no-new-test_<feature>.txt`，只看存在、只在 file mode，handoff schema 維持 16；D4 沿用 `REPRO_MANIFEST_MISSING`、不加 pipeline 步驟，其餘照草稿。只影響 e432 | e432 lane session；`specs/e432-judge-report-checks.md` D2 列，lane commit `7460f89` |
| 2026-11-20 | 人類 | e444 cut 核准（cut 預審整合者 close，to-lane#3）：(h) —— 票面 acceptance 1 的「`git status` 無變化」解讀為 porcelain 不列 `CLAUDE.md`、`CLAUDE.local.md` 與 artifact 路徑（`AGENTS.md`、`.antigravityrules` 照裁定 3 照舊建立，fixture 先 commit）；(e) —— 一行建議只在本次新附加區塊進被追蹤的 `CLAUDE.md` 時印，artifacts `repo` 時也印（寫入的檔案不變，多一行 stderr）。只影響 e444 | e444 lane session；`specs/e444-claude-local-adapter.md` Decisions，lane commit `8720b17` |
| 2026-11-20 | 人類 | e432 架構 Open Questions（第二次預審整合者 close，to-lane#5）：OQ1–OQ6 照 architect 預設——OQ1 已標記 feature 的 `qa-engineer:Blocked → sr-engineer` 也要清單或「不需新測試」紀錄；OQ2 lane-status 不論標記都認 code-reviewer 的 PASS 標頭；OQ3 `scripts/release.mjs` 自寫裁判規則（E435 拆）；OQ4 三個錯誤碼的提示改寫留給 E433；OQ5 報告首行不變；OQ6 改寫 `tools/registry.ts` 的 `qa_review`、`qa_suite_result` 描述。只影響 e432 | e432 lane session；`specs/e432-judge-report-checks-architecture.md` Open Questions，lane commit `da8cc53` |
| 2026-11-20 | 人類 | e444 預設規則延伸（sr 實作時提出，整合者建議採納，to-lane#5）：decision (j) —— 沒帶 `--adapter` 時，`CLAUDE.local.md` 有區塊而 `CLAUDE.md` 沒有 → `local`，先於裁定 1（B'）的四條件判斷；與裁定 1「重跑 init 行為不變」同一原則。新增 AC2b 與 T-E444-06。只影響 e444 | e444 lane session；`specs/e444-claude-local-adapter.md` decision (j)，lane commit `2c7d1bf` |
| 2026-11-20 | 人類 | e444 code review 建議 R3、R2 在本 lane 修（整合者建議，to-lane#11）：decision (k) —— `agc eject` 保留含使用者筆記的 `CLAUDE.local.md` 時，一併保留 `/CLAUDE.local.md` 的 exclude 行並在計畫說明，只剩區塊時照舊刪檔刪行；decision (l) —— decision (j) 隱含 `local` 遇到不安全路徑段時的拒絕文字不再寫「refusing --adapter=local」，exit 2、不寫檔不變。新增 AC7b、T-E444-07，AC12 修訂。只影響 e444 | e444 lane session；`specs/e444-claude-local-adapter.md` decisions (k)、(l)，lane commit `e89c82b` |
| 2026-11-20 | 整合者 | e432 5a：`fanout.mjs check` 報 `test/e431-test-first-server-path.test.mjs` 越界，屬機械性誤報——本檔「派工前核對」的版本號／條數釘點與讀原始碼表都列了該檔，擁有欄以「三張測試清單列出的測試檔全部」概括，工具不解析這句。改動是 architect 預測的 5 個 fixture 補 no-new-test 檔、斷言未改，接受 | 本檔；lane branch `f6ece2c` |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ d7d917c
- 目標分支對 origin：一致
- git status：1 項： M .current/_primary/handoff.md
- worktree：primary（main ← integ/v5-w3 @ d00af59）
- lane-status：primary（main ← integ/v5-w3 @ d00af59）release-cd-v4.22.0／In_Progress／release-engineer，hop 3，commits 0，dirty
### 已結案
- 本波 2 條 lane、2 張票（E432、E444）全部 qa PASS、合併、finish、拆除；兩張都 not yet released——E432 依 16.1 裁定 18 隨 v5.0.0（E435）發出，E444 不在里程碑內，但同樣不從 `main` 單獨發版。lane 紀錄在 `.current/history/2026-11/{e432,e444}/`；裁定與驗證細節在本檔 Decisions 與狀態行。新發現：無（兩條 lane 都沒有 pending-tickets），無未配號的新發現。e432 架構 OQ4 留給 E433 的提示改寫已寫進 `docs/backlog.md` E433 列（不開票）。git status 那一項是 primary handoff 的 schema 15→16 lazy migration（server 讀檔時寫回；`next_role`、`dispatched_at` 本來就只屬於寫入它們的那一次），不屬本波。
### 待人類決定
- E444 何時發給 adopter：等 v5.0.0，或依裁定 18 從 v4.22.0 tag 另開 v4.x 分支（做法未定）。
- 是否開下一波：v5.0.0 里程碑順序的下一張是 E433（相依 E432，本波已合併）；E433 的 cut 要處理 E433 列新增的 `gates/registry.ts` 提示備註。
- primary 的 `.current/_primary/handoff.md` 未提交的 lazy migration 改動要不要提交。
### 進行中的背景工作
無
