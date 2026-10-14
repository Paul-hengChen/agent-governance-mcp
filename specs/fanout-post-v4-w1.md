# Fan-out: post-v4 佇列第 1 波（E297 ∥ E299 ∥ E300 ∥ E298 程式半邊）
base: 6b8a195    integration branch: integ/post-v4-w1
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類核准 2026-10-14（含九項重劃／拆分），開始派工。**

本波是 `main` 加上 ruleset `main-protection` 後的第一波：Stage 6 不再 ff push `main`，改走 E297 票面第 (1) 項（lane 全部 merge 進 `integ/post-v4-w1` → 在 integ branch 上逐條 `finish --shipped --base integ/post-v4-w1` → 記帳也 commit 在 integ branch → `git push -u origin integ/post-v4-w1` → `gh pr create` → `gh pr merge --auto --merge` → 等 merged → `git switch main && git pull --ff-only`）。`content/skill-integrator.md` 現行 Stage 6 文字在本波由 e297 改寫；本波的整合者照票面做，不照現行文字。

## 派工前核對（整合者，2026-10-14）
- `git worktree list` 只有 primary；main = origin/main = `6b8a195`（PR #4 merged；四個 `docs/2026-10-14-*` branch 與 spike branch `feat/e294-enterworktree-spike` 已 `branch -d`）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.5.0`。
- 派工 base：`6b8a195`。本檔以 `docs/2026-10-14-fanout-post-v4-w1` branch 走 PR 併入 `main`（E297 票面第 (4) 項：沒有開放波次時記帳走 docs branch）；本檔是純文件，lane 從 `6b8a195` 開不受影響。
- `<lanes-root>/_mailbox/` 是空的；`e297`／`e299`／`e300`／`e298` 不重名。`qa_reports/`、`review_reports/`、`specs/` tracked → 不需要 symlink。
- `cutApprovalAutoTier` 是空物件（預設 2 檔），E296 未出貨 → 每條 lane 的 cut 都要人類在 lane session 核准。hop cap 仍是 10（E295 未出貨）；lane hop 用完 → escalate 給人類，不自行開續集 feature。
- **E297 的落點**：
  - `content/skill-integrator.md`：第 2 行 frontmatter `recommended_model: sonnet`；第 29 行（工作總覽 stage 6）、第 36 行（Permissions）、第 60 行（Lifecycle stage 6）、第 137–138 行（5b-1/5b-2）、第 144 行（5b-5「never fast-forward `main`」）、第 149 行（5c 標題）、第 157–163 行（Stage 6 全部）、第 169 行（Git operations）。
  - `content/skill-release-engineer.md`：第 15 行（No force pushes）、第 202–234 行（8a commit+push branch、8b CI gate、8c tag+push）、第 249–265 行（13a bookkeeping commit+push、13b `--close-out`）。**票面只點名 8a/8c 與 Check 1/6；13a/13b 與 `verify-release.mjs --close-out`（「zero commits ahead of upstream」）同樣假設能 push `main`，lane 的 PM 要一併判定（預審時整合者會問）。**
  - `content/const-15-core-tail.md` 第 12 行（§6 Sanctioned git operations；Integrator-only grant 子項）。`test/e178a-integrator-role.test.mjs:249` 一字不差釘住 §6 第一句，`:264` 釘住 Integrator-only grant 整句，`:77–78` 釘住 `recommended_model: sonnet`，`:309` 釘住「never fast-forward `main` before that verdict is APPROVED」。
  - `content/coord-03-core-fallback.md`：E297 第 (4) 項（coordinator 記帳 commit 在 integ branch 或 `docs/<date>-<slug>` branch）目前沒有任何既有句子可改，落在 `## Backlog Intake Loop`（第 47 行起）或 `## Evidence-Citation Convention`（第 60 行起）附近，由 PM 決定。coord-03 與 const-15 都組進全部 compose golden，並計入 `test/context-budget.test.mjs` 四個上限（5567／10076／20453／7978）。
  - **票面沒寫但必要**：`tools/skill-frontmatter.ts:8` `MODEL_TIERS = ["opus","sonnet","haiku"]` 沒有 `fable`，`recommended_model: fable` 會被 parser 丟掉；`test/skill-frontmatter.test.mjs:88` 釘住這個陣列。→ e297 擁有 `tools/skill-frontmatter.ts`（+ 其 `dist/`）與 `test/skill-frontmatter.test.mjs`（見所有權重劃）。
  - `scripts/verify-release.mjs` Check 1（`tag-at-HEAD`，第 182 行起）與 Check 6／`--ci-check`（第 353 行起）：票面說「只在壞掉時才改」→ e297 條件式擁有。
  - 釋出 SOP 文字的其他測試：`test/release-staging.test.mjs`（D10 非 ff push 列）、`test/e164-e167-content.test.mjs:31–32`（8b/8c 區段切割、`git tag -a`／`git push origin vX.Y.Z` 句型）、`test/e166-template-defers-staging.test.mjs:66`（8a 起點）。`templates/claude-code-agents/release-engineer.md:17` 的 STOP 規則不變，不碰 templates。
  - `docs/**` 沒有任何現行文件寫「ff push main」（只有歷史紀錄），e297 不碰 `docs/`。E228 關票是整合者 5c 的 done-mark。
- **E299 的落點**：`scripts/check-md-tables.mjs` 第 24–27、292–331、375–385 行（E88 advisory，exit 0）；`test/check-md-tables.test.mjs:449–470`（ADV-* 斷言 exit 0）、`:808–810`（WIRING 釘住 `check:md-tables` script）。E88 兩則現存違規：`docs/backlog.md` 第 181 行（E59 列）、第 226 行（E104 列）。歷史 `specs/fanout-*.md` 的 Decisions 表粗掃沒有空格。票面 (3) 佇列↔backlog 對齊在現行資料上可能另有違規，lane 的 PM 在 cut 時先跑原型回報數量（見範圍切線）。
- **E300 的落點**：`tools/registry.ts:194–213`（zod `dispatch_pins` map）、`:556–570`（inputSchema 描述「NOT validated against a model vocabulary」）；`tools/handoff-parse.ts:254–279`（`parseDispatchPins` 讀側）；`tools/handoff-orchestrator.ts:1284–1292`（pass-through）。錯誤碼契約：`test/error-code-contract.test.mjs` 的 `SUFFIX_RE` 要求碼尾是 `_REQUIRED|_MISSING|…|_REJECTED|…`，而且**程式側每個符合形狀的碼都必須在 `gates/registry.ts` `GATE_REGISTRY` 有一列**（tool-boundary 的 zod 拒絕也是，前例 `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`，第 277 行）；`test/e26-gate-stats.test.mjs:78/80/91/214/329/343/656` 釘住 33 筆。→ e300 擁有 `gates/registry.ts` 與那兩個測試檔；新碼 `documentedInProse: false`（content 本波歸 e297，不能在 content 裡 backtick 這個碼），第 2 波 coord-02 那一句再決定是否翻成 true。`test/dispatch-pins.test.mjs:327–355、:695–708` 現行斷言只有 ≤100 字元邊界，沒有「接受任意字串」的正向斷言。
  - 票面寫 coordinator SOP 的 *Dispatch-time overrides* 段在 coord-03 —— 實際在 `content/coord-02-host-dispatch.md:19`。那一句留到第 2 波。
- **E298 程式半邊的落點**：`.github/workflows/ci.yml` 第 3–6 行（`push: branches: [main]`）；`bin/agc-init.mjs` `feature finish` 拆除段（teardown 約第 2243–2300 行，`--base`／`--pr` 解析第 2767–2770 行附近）。沒有任何測試讀 `ci.yml`。finish 的測試：`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`。
- task id：`T-E297-NN`／`T-E299-NN`／`T-E300-NN`／`T-E298-NN`。

### 所有 lane 共通的範圍（寫進每條 lane 的 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`（約 3.5 分鐘；四條 lane 排隊），最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕（E294 票面）。
- 負向對照在 worktree 外的複本上做，不用 `git stash`（E269 前例）。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate` 給整合者，由人類在 lane session 裁決，不自行開 `-r<n>-fix` 續集。
- 共同禁止（本表另有例外者除外）：`docs/**`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`。

## Lanes（並行）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e297 | E297 | feat/e297-main-protected-sop | ../agent-governance-mcp-lanes/e297 | `content/skill-integrator.md`、`content/skill-release-engineer.md`、`content/const-15-core-tail.md`、`content/coord-03-core-fallback.md`、`content/constitution-rationale.md`（只在 §6 的理由需要搬過去時）、`tools/skill-frontmatter.ts` 與其 `dist/tools/skill-frontmatter.*`、`scripts/verify-release.mjs`（只在 Check 1／Check 6 真的壞掉時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/release-staging.test.mjs`、`test/e164-e167-content.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/render-structure.test.mjs`、`test/e297-*.test.mjs`、`specs/e297-*`、`qa_reports/*E297*`、`review_reports/*E297*`、`.current/e297/**` | 其他 `content/**`（含 `coord-02-host-dispatch.md`）、`tools/registry.ts`、`tools/handoff-*.ts`、`gates/**`、`bin/**`、`scripts/check-*.mjs`、其他 `scripts/**`、其他 `test/**`、其他 `dist/**`、共同禁止的全部項目 | 做：票面 (1)–(6) 全部 —— Stage 6 改成 integ branch 上 finish + PR + auto-merge；release SOP 改成 `release/vX.Y.Z` branch + PR + auto-merge，tag 打在 `main` 的 merge commit；§6 grant 加 `gh pr create`／`gh pr merge --auto --merge`（與 release-engineer 共用），`git pull --ff-only` on `main` 進 base list；coord-03 加 coordinator 記帳走 integ／docs branch 一段；`MODEL_TIERS` 加 `fable`，frontmatter 改 `fable`；E228 縮成 SOP 文字半邊由本票關掉（done-mark 是整合者的）。PM 必須明確判定 release SOP 13a/13b 與 `--close-out` 在保護後的做法（票面漏列）。四個 budget 上限若需調高，照 e269 前例由 qa 實測、人類在核准 cut 時決定。　不做：E298 的 5a `--ci-check`／5b 改讀 CI／verifier brief；E299 的 5c 一句；E300 的 coord-02 一句（三者都在第 2 波）；不碰 `templates/**`、`docs/**`。 | 無 |
| e299 | E299 | feat/e299-check-bookkeeping | ../agent-governance-mcp-lanes/e299 | `scripts/check-bookkeeping.mjs`（新）、`scripts/check-md-tables.mjs`、`package.json`（只加 `check:bookkeeping` script）、`docs/backlog.md`（**只限**第 181、226 列的 E88 位置修正，以及新檢查在 base 上找出的其他純機械違規：done-mark 位置、證據路徑、佇列勾記；不改任何票面文字）、`docs/v4.0.0-new-tickets.md`（同上，只限機械勾記對齊）、`test/check-md-tables.test.mjs`、`test/e299-*.test.mjs`、`specs/e299-*`、`qa_reports/*E299*`、`review_reports/*E299*`、`.current/e299/**` | `content/**`、`tools/**`、`gates/**`、`bin/**`、`dist/**`、其他 `scripts/**`、其他 `test/**`、`specs/fanout-*.md`（含本檔：本波 Decisions 列由整合者寫，lane 的檢查若在本檔上失敗 → 信箱回報，不自己改）、其他 `docs/**`、共同禁止的其餘項目 | 做：票面 (1)–(5) —— `scripts/check-bookkeeping.mjs` + `package.json` `check:bookkeeping`，由 qa 的測試檔跑進 `npm test`；E88 advisory 升為失敗；修掉第 181、226 列。PM 在 cut 時先用原型跑 (1)–(4) 對 base `6b8a195` 的現況，把違規數量與位置寫進 cut（只有機械修正才在本 lane 做；需要判斷的寫成新發現）。`check:bookkeeping` 必須能在 lane worktree（從 v2 root 分出、`.current/<lane>/` 存在）與 primary 上都跑。　不做：`content/skill-integrator.md` 5c 那一句（第 2 波）；prose 正確性（E276 類）。 | 無 |
| e300 | E300 | feat/e300-dispatch-pins-enum | ../agent-governance-mcp-lanes/e300 | `tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-orchestrator.ts`（只限 `tw_get_state` 讀側 advisory）、`gates/registry.ts`（新錯誤碼一列，`documentedInProse: false`）、上列四檔的 `dist/**`（`.js`、`.d.ts`、`.map`）、`test/dispatch-pins.test.mjs`、`test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e35-pipeline-order.test.mjs`（只在登記的一列影響步驟順序斷言時）、`test/telemetry.test.mjs`（同上）、`test/e300-*.test.mjs`、`specs/e300-*`、`qa_reports/*E300*`、`review_reports/*E300*`、`.current/e300/**` | `content/**`、`tools/skill-frontmatter.ts`（本波歸 e297）、其他 `tools/**`、其他 `gates/**`、`bin/**`、`scripts/**`、其他 `test/**`、其他 `dist/**`、共同禁止的全部項目 | 做：`dispatch_pins` 每個值收緊為 `z.enum(["opus","sonnet","haiku","fable"])`（**本波寫字面值 enum，不 import `MODEL_TIERS`** —— 那個常數本波由 e297 加 `fable`，整合後另開接線票統一來源）；拒絕信封點名角色與值，新錯誤碼尾綴符合 `SUFFIX_RE`（例如 `…_REJECTED`）並在 `GATE_REGISTRY` 登記（33 → 34，`documentedInProse: false`）；`tw_get_state` 讀側：磁碟上 enum 外的 pin 以 advisory 呈現，不拒絕讀。　不做：coord-02 *Dispatch-time overrides* 那一句（第 2 波）；不改 `MODEL_TIERS`；不改 `templates/**`。 | 無 |
| e298 | E298（程式半邊） | feat/e298-ci-triggers-finish-remote-delete | ../agent-governance-mcp-lanes/e298 | `.github/workflows/ci.yml`、`bin/agc-init.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/e298-*.test.mjs`、`specs/e298-*`、`qa_reports/*E298*`、`review_reports/*E298*`、`.current/e298/**` | `content/**`、`tools/**`、`gates/**`、`dist/**`、`scripts/**`、其他 `test/**`、共同禁止的其餘項目（`.github/**` 例外） | 做：票面 (1) `ci.yml` 觸發加 `feat/**`、`integ/**`、`release/**`（E170 選項 (i) 併入）；票面 (5) `agc feature finish --shipped` 順便 `git push origin --delete <branch>` —— remote 上沒有該 branch、或沒有 remote／離線時必須是**靜默 no-op 加一行提示，絕不失敗**（本波的 lane branch 都不會被 push，finish 跑在 integ branch 上）。　不做：票面 (2)(3)(4)(6)(7)（全是 `content/skill-integrator.md` 文字，第 2 波）；不碰 `scripts/verify-release.mjs`。 | 無 |

## 所有權重劃（相對於預設）
- **`tools/skill-frontmatter.ts` + `test/skill-frontmatter.test.mjs` → e297**（票面沒列；`recommended_model: fable` 要先進 `MODEL_TIERS` 才解析得出來）。e300 因此**不**從 `MODEL_TIERS` 推導 enum，寫字面值；統一來源是整合後的接線票。
- **`gates/registry.ts`、`test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs` → e300**（錯誤碼契約要求登記；e260-followups 那波對這兩檔的共同禁止在本波解除，只給 e300）。
- **`docs/backlog.md`、`docs/v4.0.0-new-tickets.md` → e299，限機械修正**（第 181、226 列 + 新檢查找出的純機械違規）。其他三條 lane 不碰 `docs/**`。整合者本波的 5c 記帳在 integ branch 上、e299 合併之後做，會經過 e299 的檢查。
- **`.github/workflows/ci.yml` → e298**（共同禁止 `.github/**` 的例外）。
- **`scripts/verify-release.mjs` → e297，條件式**（只在 Check 1／Check 6 因新 release 流程壞掉時改）；e298 本波不碰它（`--ci-check` 已存在，第 2 波的 SOP 半邊只是引用）。
- 共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）整份 → e297。其他三條 lane 不碰。
- **三張小票的 SOP 一句（E298 5a/5b/verifier、E299 5c 一行、E300 coord-02 一句）→ 第 2 波**，不併進 e297：e297 是 P1、文字量已是本波最大，而且那三句引用的程式（`check:bookkeeping`、enum 錯誤碼、`--ci-check` 流程）要在本波合併後才存在於同一棵樹上，留到第 2 波才能在同一個 branch 上驗證。代價：E298／E299／E300 的 done-mark 等到第 2 波。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `skill-integrator.md` Stage 6／5b／5c／Permissions／Lifecycle／Git operations 不再寫 ff push `main`，改成 integ branch 上 finish + PR + auto-merge + `git pull --ff-only` | e297（E297-1） | ✓ |
| `skill-release-engineer.md` 8a/8b/8c（含 13a/13b 與 `--close-out` 的處置）改成 `release/vX.Y.Z` + PR + auto-merge，tag 打在 `main` merge commit；Check 1／6 驗證仍成立 | e297（E297-2） | ✓ |
| §6 Integrator-only grant 加 `gh pr create`／`gh pr merge --auto --merge`（與 release-engineer 共用，永不 `--squash`/`--rebase`/`--admin`）；`git pull --ff-only` on `main` 進 base list | e297（E297-3） | ✓ |
| coord-03 寫明 coordinator 記帳 commit 在 integ 或 `docs/<date>-<slug>` branch，絕不在本機 `main` | e297（E297-4） | ✓ |
| E228 縮成 SOP 文字半邊並關閉（backlog done-mark） | 整合者（5c，引 e297 證據） | ✓ |
| `skill-integrator.md` frontmatter `recommended_model: fable`；`MODEL_TIERS` 含 `fable`；相關測試綠 | e297（E297-6） | ✓ |
| compose goldens 重產、budget 測試綠（上限調整由人類核准） | e297 | ✓ |
| `scripts/check-bookkeeping.mjs` 做票面 (1)–(4)，`npm test` 內跑，`package.json` 有 `check:bookkeeping` | e299 | ✓ |
| E88 位置提示升為失敗；backlog 第 181、226 列修正；base 現況上檢查全綠 | e299 | ✓ |
| `skill-integrator.md` 5c 一句指向 `check:bookkeeping` | 第 2 波 content lane | ✗（第 2 波） |
| `dispatch_pins` 值 enum 化、拒絕信封點名角色與值、新錯誤碼登記、讀側 advisory | e300 | ✓ |
| coord-02 *Dispatch-time overrides* 一句點名四個值 | 第 2 波 content lane | ✗（第 2 波） |
| `dispatch_pins` enum 與 `MODEL_TIERS` 單一來源 | 整合後接線票（整合者 5c 開票） | ✗（接線票） |
| `ci.yml` 觸發含 `feat/**`、`integ/**`、`release/**`；E170 關閉 | e298 + 整合者 done-mark | ✓ |
| `agc feature finish --shipped` 刪 remote lane branch，無 remote branch 時 no-op | e298 | ✓ |
| `skill-integrator.md` 5a `--ci-check`、5b 改讀 CI、verifier brief、fallback、flake rule | 第 2 波 content lane | ✗（第 2 波） |
| 合併後全套測試綠（本機，E298 SOP 未出貨前仍是本機）；integ PR 的 CI 綠 | 整合者（合併後） | ✓ |

四個 ✗ 都已指定歸屬（第 2 波 content lane 或接線票），沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、全套測試（本機，`test-lock`）；integ PR 的 CI 是第二次。
- 接線票（整合者開，放第 2 波之前或之後由人類排）：`dispatch_pins` 的 zod enum 改為從 `tools/skill-frontmatter.ts` `MODEL_TIERS` 推導（e297 加了 `fable`，e300 寫了字面值）。
- 第 2 波建議（另開 manifest）：單一 content lane，票 E295 + E298 SOP 半邊 + E299 5c 一行 + E300 coord-02 一句（四者都碰 `content/skill-integrator.md`／`coord-02`／`coord-03`／`const-01`，只能一條 lane）；E295 另含 `docs/lane-protocol.md` 與 `tools/transitions.ts`。lane-protocol 可寫 EnterWorktree 為前提（E294 spike：repo 外 lane 能進入、cwd 不跑回 primary；git 指令單條下）。第 3 波：E296。
- backlog done-mark：E297、E228（縮編關閉）、E170（併入 E298 關閉）；E298／E299／E300 在第 2 波 SOP 半邊合併後才 done-mark（本波在佇列 0j／0k／0l 註記「程式半邊已合併 <sha>」）。佇列 0i 勾 DONE，#15（E228）、#35（E170）勾 DONE。
- `lane-status --lanes e297,e299,e300,e298 --rollup` 後，在 `integ/post-v4-w1` 上依序 `finish --shipped --base integ/post-v4-w1`。

## 合併順序
e297 → e299 → e300 → e298（共享生成物的 lane 先；四條檔案互斥；每次 merge 後跑 `node scripts/merge-invariants.mjs`）→ `integ/post-v4-w1` 重建 `dist/`、全套 → 在 integ branch 上 finish 四條 lane（配號、history 搬移、拆 worktree）→ 記帳 commit → 全套 → `git push -u origin integ/post-v4-w1` → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main && git pull --ff-only` → `git branch -d integ/post-v4-w1`（remote 由 repo 設定自動刪）。

## Dispatch pins
- e297：`sr-engineer=fable`（人類長期偏好）。
- e299：`sr-engineer=fable`（人類長期偏好）。
- e300：`sr-engineer=fable`（人類長期偏好）。
- e298：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-14 | 人類 | post-v4 佇列 0i–0l 與 E295、E296 分三波：第 1 波 E297 + E299／E300／E298 程式半邊；第 2 波 E298 SOP 半邊 + E295；第 3 波 E296。Stage 6 照 E297 票面第 (1) 項（integ branch + PR + auto-merge），不照現行 SOP 文字 | 整合者 session（派工指示） |
| 2026-10-14 | 整合者 | 拆成 e297 ∥ e299 ∥ e300 ∥ e298；E298／E299／E300 各拆成程式半邊（本波）與 SOP 一句（第 2 波，不併進 e297）；`tools/skill-frontmatter.ts` + 其測試重劃給 e297（`MODEL_TIERS` 缺 `fable`，票面漏列）；e300 寫字面值 enum、不碰 `MODEL_TIERS`，統一來源另開接線票；`gates/registry.ts` + 錯誤碼契約／gate-stats 測試重劃給 e300；`docs/backlog.md`／佇列的機械修正重劃給 e299；`.github/workflows/ci.yml` 重劃給 e298；`scripts/verify-release.mjs` 條件式給 e297；release SOP 13a/13b 與 `--close-out` 列為 e297 PM 必判項 | 本檔 |
| 2026-10-14 | 人類 | 核准本清單（含九項重劃／拆分：三張小票的 SOP 一句留第 2 波、`skill-frontmatter.ts` 給 e297、e300 字面值 enum、`gates/registry.ts` 給 e300、backlog 機械修正給 e299、`ci.yml` 給 e298、`verify-release.mjs` 條件式給 e297、release 13a/13b 列為必判、coord-02 更正），開始派工 | 整合者 session |
| 2026-10-14 | 整合者 | 四條 lane 的 PM 都先在 session 裡找人類核准 cut、未送信箱；整合者對四條各送 question 要求先寄 proposal 預審。e299 回報 session 已達使用量上限 | 信箱四條 lane to-lane#1、e297／e299 to-integrator#1 |
| 2026-10-14 | 整合者 | e298 預審通過（mini-chain 無 PM hop；T-E298-01 ci.yml 觸發、T-E298-02 finish 刪 remote branch，AC1–AC7；前置檢查用本地 remote-tracking ref、不 ls-remote；qa 加 --base 非 main 案例） | 信箱 e298 to-integrator#1、to-lane#2 |
| 2026-10-14 | 整合者 | e300 預審：T-01／02／04 通過，T-03 的 advisory 改放 tw_get_state 信封、不加在 HandoffState（handoff-types／handoff-write 不在擁有範圍）；index.ts 不動（formatZodError 已帶 zod path）；建議方案 A、碼名 DISPATCH_PIN_TIER_REJECTED，兩者交人類裁決 | 信箱 e300 to-integrator#1、to-lane#2 |
| 2026-10-14 | 整合者 | e300 預審通過（T-E300-01 字面值 enum + zod、02 GATE_REGISTRY 第 34 列 producer tool-boundary、03 advisory 只在 tw_get_state 信封、04 測試）；兩項交人類裁決：方案 A（建議）vs B、碼名 DISPATCH_PIN_TIER_REJECTED | 信箱 e300 to-integrator#2、to-lane#3 |
| 2026-10-14 | 整合者 | e299 預審通過（T-E299-01..05；原型量測：46 則死引用機械改寫、E137 #7 勾記、E88 五則全修 + CQ-9 改寫、22 則容忍註記）；E177c 以「E<n><字母> 父列存在即通過」的通用規則處理、不開 E299-NEW-1；E104 視為 DONE；release-v4.x.x/ 路徑改寫視為機械 | 信箱 e299 to-integrator#1、to-lane#2 |
| 2026-10-14 | 整合者 | e297 預審：Rulings（8b、step 12、13a/13b、Check 1/6、verify-release 零修改）同意；要求補兩處：Stage 6 的 PR 卡 up-to-date 時整合者 merge main 進 integ 而非 STOP；coord-03 記帳段要在 §6 下可執行 → 裁決項 (a) 擴成 release/*（release-engineer）與 docs/*（coordinator）兩個命名空間，交人類 | 信箱 e297 to-integrator#2、to-lane#2 |
| 2026-10-14 | 整合者 | e297 預審通過（T-E297-01..06；兩處修正已進 spec：Stage 6 PR 卡 up-to-date 由整合者 merge main 進 integ；§6 namespace 裁決改為 A/B 兩選項）；交人類四項：(a) A（建議）vs B、(b) 上限 = qa 實測值、(c) 單一 PR 路徑、(d) merge --ff-only 留在 grant | 信箱 e297 to-integrator#3、to-lane#3 |
| 2026-10-14 | 人類 | e297 cut 核准（在 e297 lane session）：(a) 選 A —— §6 在整合者之外開 release/*（release-engineer）與 docs/*（coordinator）兩個 namespace，各共用 switch -c／switch main／branch -d + gh pr create／gh pr merge --auto --merge；(b) 四個上限照 qa 實測值；(c) SOP 只寫 PR 單一路徑；(d) merge --ff-only 留在 grant | e297 lane session（信箱 e297 to-integrator#4 轉述） |
| 2026-10-14 | 整合者 | e298 核對通過（9f5a541，全套 3055/3052/0/3 與回報相同，11 檔 0 越界，T-E298-01/02 review APPROVED + qa PASS，hop 4/10，ci.yml 無 paths 過濾）；e299 回報期間確認 qa_reports/expected-red_e299-check-bookkeeping.txt 屬本票新建檔案、在範圍內 | 信箱 e298 to-integrator#2、to-lane#3；e299 to-integrator#4、to-lane#3 |
