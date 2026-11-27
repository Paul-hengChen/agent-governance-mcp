# Fan-out: post-v5.0.0 E463 + E464 波（發版腳本的 gh 查詢與版本檢查）
base: a2f1062    integration branch: integ/post-v5-e463
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-27。** e463 以 `--no-ff` 合進 `integ/post-v5-e463`（merge `9b9e9e2`，零衝突），merge-invariants PASS；派工 base `e3a3db6`（清單 PR #209）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`check:bookkeeping` exit 0。lane 層 CI：e463 run 45969838889 @ `3c4b533` 綠。Roll-up：e463 6 個 task、hop 6/14、review 退回 0、sr 退回 1/2、證據 6/6。E463、E464 done-mark（not yet released）。例外：無。本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out 下一波：E463 + E464」，2026-11-27）：E463、E464 合成一個 feature（人類裁定 2026-11-27，`docs/backlog.md` 兩列開頭的 BATCHED 註記，PR #208），本波只有一條 lane e463 同時做兩張票；E420、E443b 不列（E443b 另有 session 在做，可能同時跑另一波、共用 `../agent-governance-mcp-lanes/_mailbox`）。共用的 gh helper 放 `scripts/`、不放 `tools/`。本波不發版。

## 派工前核對（整合者，2026-11-27，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `a2f1062`（PR #207 合併後）；primary 在 `docs/2026-11-27-batch-e463-e464`（PR #208，BATCHED 註記，auto-merge 已開、CI 跑中），工作樹除本清單外乾淨；`feat/e463-*`、`integ/post-v5-e463` 本機與 `origin` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的；`agc check` exit 0。primary handoff 停在 `release-cd-v5.0.0-r2`（v5.0.0 已發版）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **wave id 與並行 wave**：`specs/fanout-post-v5-w1..w7.md` 已用；E443b 的 wave 若同時開，最可能取 `post-v5-w8`。本波以票號命名 `post-v5-e463`（清單 `specs/fanout-post-v5-e463.md`、整合分支 `integ/post-v5-e463`、lane `e463`、信箱 `_mailbox/e463/`），不會與 E443b 的 wave（lane `e443b`）撞名。信箱監看只點名 `_mailbox/e463/to-integrator.md`，不用 glob。兩波共用一個帳號的額度。
- 相依：E463、E464 不依賴其他票（兩列 `depends_on` = none）；派工 base 須含 PR #208（BATCHED 註記）與本清單的 PR。

### Probe（整合者，literal 與 regex grep `test/`，沒跑——沒有 diff；完整清單由 lane 的 PM 用完整套件列出）
| 被讀的檔 | 讀它的測試檔數 | 歸屬 |
|---|---|---|
| `scripts/release.mjs` | 16 | e463；下表逐檔歸屬 |
| `scripts/verify-release.mjs` | 15（其中 6 檔只在 SOP／addendum 字串裡提到名字，不讀內容） | e463；讀內容的逐檔歸屬 |
| `docs/release-cd.md` | 6 | e463；下表逐檔歸屬 |

| 測試檔 | 釘什麼 | 本 lane 改動下會紅？ | 歸屬 |
|---|---|---|---|
| `test/e394-release-script.test.mjs`、`test/e405-release-runner.test.mjs` | 假 `gh`（只認 `auth status` 等指令）、允許的 gh 指令 regex 清單（`/^gh auth status$/` 等） | 很可能（每個 phase 起頭多一次 `gh --version`；`viewPr` 失敗改停） | 擁有 |
| `test/verify-release.test.mjs`、`test/e320-ci-check-sha.test.mjs`、`test/e326-empty-branch-run-poll.test.mjs` | PATH 上的 `gh` shim；e320／e326 把 `verify-release.mjs` 單檔複製進 fixture | 很可能（shim 不回 `--version`；helper 若被 `verify-release.mjs` import，單檔 fixture 找不到模組） | 擁有 |
| `test/e158-range-subject.test.mjs` | 把 `scripts/verify-release.mjs` 單檔複製進 fixture 後 spawn | 可能（同上，缺 helper 模組） | 擁有 |
| `test/e405-release-docs.test.mjs` | `docs/release-cd.md` 段落、checklist 文字（「line 63」Copy）、runner-only class 表 | 可能（manual fallback 段加最低 gh 版本） | 擁有 |
| `test/e164-e167-content.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/e432-judge-report-checks.test.mjs`、`test/e435-remove-old-path.test.mjs`、`test/e394-release-sop.test.mjs`、`test/e405-release-workflow.test.mjs` | 讀 `release.mjs`／`verify-release.mjs` 原始碼或 import 其 export（staging、parseArgs、無 `chain_path`、workflow 的 phase 名） | 不應該；紅了先查是否改到不相干的段 | 擁有 |
| `test/release-staging.test.mjs` | `EXIT_CLASSES` 每個手動 phase class 對 SOP（`content/skill-release-engineer.md`）Escalation Routes 一列、依 code 排序 | 不得紅（人類 Q1 (a)：不新增 class） | **禁止**（E443b 切票檔列為 coord-03 讀者） |
| `test/e433-test-first-rules.test.mjs` | `docs/release-cd.md` 第 63／69 行 Copy 文字、`PRECONDITION_NOT_PASS` 列、無 `chain_path` | 不得紅（這幾行原封不動） | **禁止**（E443b 讀者） |
| `test/e297-main-protected-sop.test.mjs`、`test/e336-portable-pull.test.mjs`、`test/e130-lane-default.test.mjs`、`test/feature-lease.test.mjs` | `release.mjs` 的 PR 流程字串、`-c pull.rebase=false` pull、`STAGE_PATHS`／`planStage`、歷史檔 | 不得紅（這些段不動） | **禁止**（E443b 讀者） |
| `test/e226-*`、`test/e295-*`、`test/e349-*`、`test/e355-*`、`test/render-structure.test.mjs`、`test/e404-*` | 只在 SOP／addendum／template 字串裡提到腳本名，不讀腳本或 doc 內容 | 不會 | 不列 |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e463 | E463, E464 | feat/e463-release-gh-checks | ../agent-governance-mcp-lanes/e463 | `scripts/release.mjs`、`scripts/verify-release.mjs`、`scripts/gh-*.mjs`（新，共用 gh helper，PM 定名）、`docs/release-cd.md`、`test/e463-*.test.mjs`（新，qa 定名）、`test/fixtures/e463/**`（新）、`test/e394-release-script.test.mjs`、`test/e405-release-runner.test.mjs`、`test/verify-release.test.mjs`、`test/e320-ci-check-sha.test.mjs`、`test/e326-empty-branch-run-poll.test.mjs`、`test/e158-range-subject.test.mjs`、`test/e405-release-docs.test.mjs`、`test/e164-e167-content.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/e432-judge-report-checks.test.mjs`、`test/e435-remove-old-path.test.mjs`、`test/e394-release-sop.test.mjs`、`test/e405-release-workflow.test.mjs`、其他只因本 lane 而紅且不在禁止欄的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e463-*.md`、`.current/e463/**`、`qa_reports/`、`review_reports/` | E443b 的範圍：`CLAUDE.md`、`content/**`（含 `content/skill-release-engineer.md`）、`tools/config.ts`、`docs/lane-protocol.md`、`docs/config.md`；E443b 讀者（跨波不得同改）：`test/release-staging.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e336-portable-pull.test.mjs`、`test/e130-lane-default.test.mjs`、`test/feature-lease.test.mjs`；共用生成物：`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`；`tools/**`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`、`dist/**`；`scripts/**` 除上列；`docs/**` 除 `docs/release-cd.md`（含 `docs/backlog.md`、`docs/lane-protocol-addendum.md`）；`.github/**`；`templates/**`；`specs/fanout-*.md`；`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E463——`viewPr()` 分辨「查詢失敗」與「查無 pull request」（`gh` 對不存在的 PR 有自己的訊息），失敗時有限次重試後停在既有 class、detail 帶 `gh` 的錯誤，絕不報成查無 PR；涵蓋每個呼叫點（`publish`／`close-out` 前檢、`prepare`／`close-out` 的 PR 步驟、deferred 檢視）。E464——在 `docs/release-cd.md` *Manual fallback* 段寫明發版腳本需要的最低 `gh` 版本，每個 phase 起頭檢查一次，版本太舊時停在既有 class、detail 帶已裝與需要的版本；共用 helper 在 `scripts/`。兩票都**不新增** exit class（人類 Q1 (a)：用 exit 14 `GH_UNAVAILABLE`），所以 SOP 的 Escalation Routes 表、`release-staging` 不動。不做：`.github/workflows/release.yml`、SOP（`content/skill-release-engineer.md`）、CHANGELOG、版本號、發版；E443b 的任何檔 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- 本波只有一條 lane：本 lane 不動 `test/fixtures/compose-golden/**` 與 `test/context-budget.test.mjs`（不改 `content/**`，兩者不會變），兩者列禁止。
- **跨波禁止**：E443b 的 wave 可能同時在跑；它的切票檔（`specs/ticket-cut-e443.md` NEW-2）把 `test/release-staging.test.mjs`、`test/e433-test-first-rules.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e336-portable-pull.test.mjs`、`test/e130-lane-default.test.mjs`、`test/feature-lease.test.mjs` 列為它的讀者。這 6 檔也讀本 lane 的檔，但本 lane 的改動不應讓它們紅；兩波同改一檔，後合進 `main` 的那波會撞衝突，所以列禁止。任一個紅了就是設計問題，回整合者，不是 re-pin 的理由。
- **常設規則：無主紅檔直接劃給該 lane**（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給該 lane，記一列 Decisions（裁決者 `整合者`），不問人類。禁止欄點名的檔不適用；落在 E443b 範圍或其讀者的檔也不適用（回人類）。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **approval** = `human`（E463 是 P2、檔案數超過 auto-tier；人類指定 cut 由人類核准）：cut 在 lane session 由人類親手核准。預估不走 architect；若 PM 判定要走，Open Questions 先回整合者第二次預審，再呈人類裁定，然後 sr-engineer 才開工。cut 估 hop 數。
- **一個 feature、一次 cut、兩張票**：寫在一份 `specs/e463-*.md`，驗收按票分組（E463、E464 各自的 AC），done-mark 兩張票都要。
- **最低 `gh` 版本**：cut 寫定版本號，並寫明依據（哪個 `gh` 版本加入 `run list --commit` 及腳本用到的每個 JSON 欄位）；依據要能查證（`gh` 的 release notes 或實測），查不到就在 cut 標 unverified、呈人類。
- **helper 與單檔 fixture**：`verify-release.mjs` 若 import `scripts/` 的新 helper，e158／e320／e326 把它單檔複製進 fixture 會找不到模組——cut 寫定做法（fixture 一併複製 helper，或 helper 內聯），並列出要 re-pin 的檔。
- **重試**：E463 的重試次數與間隔在 cut 寫定，且要能在測試裡縮到不等待（環境變數或注入，照 `AGC_VERIFY_CI_WAIT_SECONDS` 的既有做法）。
- `docs/release-cd.md` 現有的第 63／69 行 Copy、`PRECONDITION_NOT_PASS` 列、runner-only class 表原封不動（e433、e405-release-docs 釘著）。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者；禁止欄的檔紅了 → 是設計問題，回整合者。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e463`）；信件標明 lane 名 `e463`（同一個 `_mailbox` 可能有 E443b 的 lane）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內（建議至少拆：E463 `viewPr`、E464 helper 與 phase 起頭檢查、E464 文件）。
- **禁止 `git commit --amend`**（憲法 §6）：一律另開 commit。lane 報告前 grep 證據檔（`qa_reports/`、`review_reports/`、`specs/e463-*.md`、`.current/e463/`）有沒有絕對路徑或使用者名稱，有就改成相對路徑再報。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `viewPr()` 查詢失敗與查無 PR 分開；失敗有限次重試後停在既有 class、detail 帶 `gh` 錯誤；每個呼叫點都涵蓋 | e463（E463） | ✓ |
| `docs/release-cd.md` *Manual fallback* 寫明最低 `gh` 版本與依據 | e463（E464） | ✓ |
| 每個 phase 起頭檢查一次 `gh` 版本，太舊時停下、detail 帶已裝與需要的版本；helper 在 `scripts/` | e463（E464） | ✓ |
| 不新增 exit class；`content/**`、`CLAUDE.md`、`release-staging` 未動 | e463（E463、E464） | ✓ |
| 合併後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、全套 CI 綠 | 整合者（5b） | ✓ |
| E463、E464 done-mark（not yet released）；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認沒有 `dist/` 差異（本 lane 不改 `.ts`，不必重啟 MCP server）。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-e463` 自當時的 `main` 開。
2. ← `--no-ff` e463 → merge-invariants。
3. `npm run build`、`check:bookkeeping`、audit；記帳 commit。
4. `finish e463`（`--shipped --base integ/post-v5-e463`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-e463`。若 E443b 的 PR 先合進 `main` 而本 PR 變 `BEHIND`，照 Stage 6 第 4 步處理。不發版。

## Dispatch pins
- e463：`pm=opus`、`qa-engineer=sonnet`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-27）；`architect=opus`（人類 Q2，預估不走）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-27 | 人類 | E463、E464 合成一個 feature：一條 lane、一次 cut、一次審查；共用 `gh` helper 放 `scripts/`，不動 `CLAUDE.md` | `docs/backlog.md` E463／E464 列 BATCHED 註記（PR #208） |
| 2026-11-27 | 整合者 | Stage 1：一條 lane e463；wave id 取 `post-v5-e463` 避開 E443b 可能用的 `post-v5-w8`；release 腳本與 doc 的讀者 13 檔進擁有欄；與 E443b 切票檔重疊的讀者 6 檔列禁止；`content/**`、`CLAUDE.md`、`tools/config.ts`、`docs/lane-protocol.md`、`docs/config.md` 與共用生成物列禁止 | 本檔 |
| 2026-11-27 | 人類 | Q1 (a)：E463 查詢失敗與 E464 `gh` 版本太舊都停在既有 exit 14 `GH_UNAVAILABLE`、detail 帶 `gh` 錯誤或已裝與需要的版本，不新增 exit class，SOP 與 `test/release-staging.test.mjs` 不動；Q2：`architect=opus`（預估不走）；pins `pm=opus`、`qa-engineer=sonnet`、`sr-engineer=opus`、`code-reviewer=opus`；`approval` = `human`；本波不發版；lane brief 禁止 `--amend`、報告前查證據的絕對路徑 | 整合者 session（integrator prompt「fan-out 下一波：E463 + E464」；答「Q1 (a), Q2 用 opus」） |
| 2026-11-27 | 人類 | 核准本清單：一條 lane e463（E463、E464，`approval` = `human`）；wave id `post-v5-e463`；release 腳本與 doc 的讀者 13 檔進擁有欄；與 E443b 重疊的讀者 6 檔、E443b 範圍與共用生成物列禁止；pins 照 Dispatch pins 段 | 整合者 session（「approve」） |
| 2026-11-27 | 整合者 | 清單 PR #209 合進 `main`（merge `e3a3db6`，PR 必要檢查綠），派工 base = `e3a3db6`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e463-*` 與 `integ/post-v5-e463` 都不存在、`_mailbox/` 原為空、擁有與禁止欄點名的既有路徑都在、新檔路徑都還不存在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e463/`，開信箱監看（只點名 e463 的 `to-integrator.md`，baseline e463=0）與 lane-status 監看，render e463 的 prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-27 | 整合者 | e463 cut 預審（to-integrator#1，spec @ `eae38b2`）`close`（to-lane#1）：6 個 task（qa T-E463-01 新測試、02 三個 harness 回 `gh --version`；sr 03 新 helper `scripts/gh-compat.mjs`、04 E464 phase 起頭檢查、05 E463 `viewPr`、06 文件），每個 AC 都有實作 task、每個 sr task 在 `task_size` 內；最低 `gh` 2.40.0（整合者查 v2.40.0 release notes：`run list` 依 commit 篩選）；重試 3 次、間隔 10 秒、可用環境變數縮短；`verify-release.mjs` 不改（發版流程內 phase 起頭先擋），e158／e320／e326 不必 re-pin；整合者重跑 `check --cut`：8 token、0 越界，唯一 FAIL 為 APPROVAL_HUMAN（預期）；禁止欄 6 檔只有 release-staging 釘 SOP 的 exit 14 列文字，本 cut 不動 SOP；條件：第一次在有改動的 HEAD 跑全套時，擁有欄外的紅檔先寄信給整合者；hop 估 5（含一輪審查 7）；cut 由 lane 呈人類核准 | e463 信箱 to-integrator#1、to-lane#1 |
| 2026-11-27 | 人類 | 在 e463 的 session 親手核准 cut（spec @ `eae38b2`，無選項、無 needs human ruling 項）；coordinator 在 pm tuple 寫入 `cut_approved: true`，派 qa-engineer（sonnet）做 T-E463-01／02。只影響本 lane，寫在核准的 cut 裡 | e463 lane session；`specs/e463-release-gh-checks.md` @ `eae38b2`、`.current/e463/handoff.md`（`cut_approved: true`）；e463 信箱 to-integrator#2 |
| 2026-11-27 | 整合者 | e463 收工報告（to-integrator#6）核對通過並 `close`（to-lane#2）：`feat/e463-release-gh-checks` @ `3c4b533`（14 commit），`fanout check --base main` 21 檔 0 越界，證據 `review_reports/review_T-E463-01.md` APPROVED（covers T-E463-01..06）與 `qa_reports/review_T-E463-01..06.md`，worktree 乾淨，無 pending-tickets，共用生成物未動，證據無絕對路徑；lane 層 CI run 45969838889 @ `3c4b533` 綠。sr 退回 qa 一次（e394 的 helper import 衝突，qa re-pin、AC-S9 只放行 `./gh-compat.mjs`，裁判認定不是放寬）。reviewer recommended（新測試檔頭註解 15 行）與 optional（幾行 `//` 註解超過 80 欄）列入結案報告、不開票 | e463 信箱 to-integrator#6、to-lane#2；CI run 45969838889 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ a06cc92
- 目標分支對 origin：一致
- git status：1 項： M specs/fanout-post-v5-w8.md
- worktree：primary（main ← integ/post-v5-e463 @ 1f9480c）；../agent-governance-mcp-lanes/e443b（feat/e443b-lane-launcher） ［別的清單］
- lane-status：primary（main ← integ/post-v5-e463 @ 1f9480c）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，dirty
### 已結案
- e463（E463、E464）PASS，merge `9b9e9e2`；以本波 PR 合進 `main`。lane 紀錄在 `.current/history/2026-11/e463/`；沒有未配號的新發現。裁判的 recommended（新測試檔 `test/e463-release-gh-checks.test.mjs` 檔頭註解 15 行）與 optional（`scripts/gh-compat.mjs`、`scripts/release.mjs` 幾行 `//` 註解超過 80 欄）列在結案報告，不開票。
- 本波與 E443b 的第 8 波（`specs/fanout-post-v5-w8.md`）同時進行、共用 primary：上方事實裡的 `specs/fanout-post-v5-w8.md` 未 commit 修改與 `e443b` worktree 屬於第 8 波，不是本波留下的；第 8 波往前走後 `handoff --check` 對這兩項報 `DIFF` 是預期的。
- 上線後觀察（非驗收）：發版 workflow 的 runner 上 `gh` 版本未知；合進 `main` 後，下一次發版每個 phase 起頭會把 `gh --version` 印進 run log，第一次跑時確認它不低於 2.40.0。
### 待人類決定
- 要不要發 v5.x：E424、E425、E427、E430、E449、E426、E428、E446、E447、E443a、E463、E464 都已完成，合進 `main` 後尚未發版（E443b 的第 8 波另行結案）。
### 進行中的背景工作
無
