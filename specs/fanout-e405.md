# Fan-out: E405（單 lane：`scripts/release.mjs` 上 GitHub Actions，發版不耗 agent token）
base: f0caa45    integration branch: integ/e405
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准（Stage 2，2026-11-04），待派工。** 派工 base 為本清單 PR 的 merge sha（派工時記入 Decisions）。

範圍由人類指定（coordinator 提案「下一張票：E405」，人類回「開 E405」）：E405（P2，佇列 #214，人類 2026-11-03 裁決「release SOP 要做成 CD，排在 E394 之後」）。E394 已於 v4.18.0 出貨（`scripts/release.mjs` 第一次真實執行成功），前置條件清除。單 lane、full chain（pm → architect → sr-engineer → code-reviewer → qa-engineer）：workflow 與腳本之間的契約（input、secret、runner 內的狀態寫入、失敗→issue）需要 architect。本波不改任何 gate 程式、routing 表、schema、錯誤碼、`tools/**`、`prompts/**`、`dist/**`。

- **E405 的內容**（`docs/backlog.md` E405 列，整合者 2026-11-03 開票、人類裁決）：`.github/workflows/release.yml`，`workflow_dispatch`（input：bump 種類、可選摘要）；prepare／publish／close-out 三個 job 在 runner 上呼叫 `release.mjs` 的三階段；三個人類決定（bump 種類、CHANGELOG 條目、dependency-advisory 處置）變成 workflow input 或預先 commit 的產物；closing write 與 read-back 在 runner 上對 repo 內的伺服器（`dist/`）執行，不經 agent 的 MCP 呼叫；PR 與 auto-merge 用 GitHub App token 或 PAT secret（`GITHUB_TOKEN` 開的 PR 不觸發 required checks）；失敗開 issue，帶 `RELEASE_STOP` 類別與 detail；SOP 留作手動 fallback。**吸收 E401**（佇列 #217：`publish --dry-run` 真會跑嚴格 CI gate、可能等 CI）。
- **E405 蘊含、但 E394 明文留作散文的步驟**（`specs/e394-release-sop-rewrite.md` Out of Scope：「Scripting SOP steps 1–7 (they stay prose)」）：新 SOP 第 2 步 opening write、第 5–11 步（pull、derive 版號、`switch -c release/vX.Y.Z`、四個 bump、`npx tsc`／check-version／transitions-sync、`npm test`＋audit、backlog done-mark、commit message 檔）、第 14–15 步 closing write 與 read-back，今天都由 agent 做。CD 沒有 agent，這些步驟要進腳本或 workflow 步驟 —— **範圍比票面「~4 檔」多的是行數，不是檔數**（見待人類裁定 1）。
- **同時進行**：無其他 lane。若本波中途發版，release-engineer 動 `package.json`、`CHANGELOG.md`、adapter 戳記、`docs/backlog.md`、`qa_reports/archive/**`、`.current/_primary/**` —— 與 e405 的擁有集合不重疊（`content/skill-release-engineer.md` 與 `scripts/release.mjs` 發版不改）。

## 派工前核對（整合者，2026-11-04，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`git status` 乾淨（只有不進 repo 的 `docs/agc-ticket-draft-wc32.md`，人類已裁不刪）；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示，已知、不處理）。規劃時 `main` = `origin/main` = `f0caa45`（PR #71，E406 開票）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary 狀態：`active_feature` release-prompt-audit-w3、`last_agent` release-engineer、`next_role` pm（v4.18.0 發版後收尾狀態；整合者不寫狀態）。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **GitHub 面（`gh api`，2026-11-04）**：repo 沒有任何 Actions secret／variable（`gh secret list` 空）→ token secret 要由人類建立，lane 只能在 workflow 裡點名 secret 名字，不能驗證它存在。`main` ruleset `main-protection`（id 25066643）：required checks `test (20)`、`test (22)`，strict（branch 要 up to date）、要 PR、0 個 approval、只允許 merge method `merge`。`gh` 在本機已登入（keyring）。
- **CI 觸發（`.github/workflows/ci.yml`）**：push 到 `main`／`feat/**`／`integ/**`／`release/**` 與 PR 到 `main`；matrix Node 20、22。GitHub 規則：用 `GITHUB_TOKEN` 做的 push／PR **不觸發** workflow → release branch push、tag push、bookkeeping branch push 都要用 PAT／App token，否則 `publish` 的嚴格 CI gate 找不到 run（exit 41）、PR 的 required checks 永遠不跑。`test/e298-finish-remote-delete.test.mjs` 釘住 ci.yml 的 push 觸發 —— **ci.yml 禁止改**；新 workflow 另開檔。
- **`scripts/release.mjs`（`f0caa45`，71,173 B，31 個 exit class）**：phase 表 prepare（7a–8a）／publish（8b–9a）／close-out（13a–13b）；`main(argv, deps)` 可注入 `spawn`／`env`／`importHandoffParse`／`importLanePaths`（測試用）；動態 import `dist/tools/handoff-parse.js`、`dist/tools/lane-paths.js`（runner 要先 build）；env：`AGC_RELEASE_MERGE_WAIT_SECONDS`（900）、`AGC_RELEASE_POLL_SECONDS`（15）；`verify-release.mjs --ci-check` 用 `AGC_VERIFY_CI_WAIT_SECONDS`；`gh` 呼叫：`pr create`、`pr view`、`pr merge --auto --merge`、`release view`／`release create --verify-tag`。`STAGE_PATHS` 不含 `.github/`（`test/release-staging.test.mjs` 第 58 行明文），所以 release commit 永遠不會 stage workflow 檔 —— 正確，它不是發版產物。
- **runner 內的狀態寫入**：`dist/tools/handoff-orchestrator.js` 匯出 `handleGetState`／`handleUpdateState`，同一程序內先 get 再 update 即滿足 pre-flight guard；寫入走伺服器路徑，`last_updated` 帶毫秒，stamp-provenance 不會擋。`.current/_primary/handoff.md`、`tasks.md`、`*.jsonl` 都 tracked（close-out 的 bookkeeping PR commit 它們）。
- **runner 看到的狀態是 `main` 上的**：`.current/_primary/handoff.md` 在 `main` 上是上一次 close-out 的狀態（今天：release-prompt-audit-w3／In_Progress／next_role pm）。新 SOP 第 1 步的前置條件 `(qa-engineer, PASS)` 是 release-gate feature 在本機寫的，要先 commit 到 `main` 才看得到（見待人類裁定 3）。
- **測試面**：`test/e394-release-script.test.mjs`（77,727 B，真實子程序，單檔約 2.5 分鐘）與 `test/e394-release-sop.test.mjs`（20,650 B，釘 SOP 字句）歸 lane 重釘；`js-yaml` 是正式相依，qa 可以用它解析 `release.yml` 做結構斷言。釘 `.github` 的測試：`e298-finish-remote-delete`（ci.yml）、`e296-manifest-tier`（路徑 case 範例）、`release-staging`（註解）—— 新檔 `release.yml` 不碰它們。
- **文件面**：`docs/` 沒有 release 相關文件（`docs/install.md:306` 只列 prompt 名）；`CONTRIBUTING.md` Dev workflow（第 9 行起）有 `agc check`／`npm audit` 兩條；`README.md` 第 108／123 行的 release-engineer 列是模型表，不動。
- **工具**：`scripts/fanout.mjs`、`mailbox-watch.mjs`、`lane-status.mjs`、`merge-invariants.mjs`、`test-lock.mjs`、`verify-release.mjs --ci-check` 都在 base 上；`docs/lane-protocol.md` 與 addendum 都已追蹤。
- **schema**：不升版。憲法標頭不動。task id：`T-E405-NN`。不重用前波 id。

### 待人類裁定（Stage 2，2026-11-04）
整合者建議在前；每項都影響 lane 的 cut，所以在派工前問一次，之後 lane 不再問。

1. **範圍確認：步驟 2、5–11、14–15 也要自動化**（E394 留作散文的部分）。建議：**是**，放進 `scripts/release.mjs`（新 phase 或 `prepare` 的前置步驟，architect 定）而不是散在 workflow 的 shell step —— 測試既有做法是把單檔複製到暫存 repo 跑，一個檔最好測；bump 種類與票號是 input，版號由腳本從 `main` HEAD 的 `package.json` 推導；done-mark 由 `--tickets` 的票號自動寫（今天 `--tickets` 只檢查）。不同意則 CD 只能跑 7a–13b，前面仍要 agent，票的目標（不耗 agent token）不成立。
2. **Token**：GitHub App 還是 PAT、secret 名字、誰建。建議：**fine-grained PAT**，權限 Contents RW、Pull requests RW、Actions Read（`verify-release --ci-check` 讀 run）、Metadata Read；repo secret 名由 PM 在 cut 定（建議 `RELEASE_TOKEN`）；**人類在第一次真實執行前建立**，lane 不建、也驗不到。App 之後要換再開票。
3. **runner 的狀態來源**：前置條件 `(qa-engineer, PASS)` 讀的是 `main` 上的 `.current/_primary/handoff.md`。建議：**release-gate feature 的 PASS 寫入先 commit 到 `main`**（coordinator 以 `docs/*` namespace 開 PR，和 CHANGELOG 條目同一個 PR），workflow 的 `prepare` job 核對 `main` 的 handoff tuple，不符 → `RELEASE_STOP` 停；不另設「人類保證已 PASS」的 input（伺服器可驗的事不改成口頭保證）。
4. **CHANGELOG 條目來源**：input 還是預先 commit。建議：**預先 commit**（與第 3 項同一個 docs PR；人類在 PR 裡讀到完整條目），workflow input 只有 `bump`（patch／minor／major）、`tickets`（`E1,E2|none`）、`dry_run`（bool）。
5. **dependency-advisory 處置**：建議 **不做 input**：`docs/dependency-advisories.md` 本身就是處置紀錄，runner 跑 `npm audit --audit-level=high`，HIGH／CRITICAL 沒有對應列就 `RELEASE_STOP`（新 exit class），補列走 pm，和今天一樣。
6. **第一次真實執行**：建議 **v4.19.0（出貨 E405 本身）就用 workflow 發**，手動 SOP 當 fallback；lane 的 qa 只能驗 `--dry-run` 與 YAML 結構，真實 PR／tag／release 只有第一次跑才驗得到，所以第一次跑算 E405 的驗收尾段，失敗開票。
7. **E401 併入 e405**（票面已寫「可吸收」，整合者併入）：`--dry-run` 不等 CI（印 CI 狀態不等），SOP 的 dry-run 句一起改。結案時 E401 一併 done-mark、佇列 #217 勾 DONE。
8. **Dispatch pins**：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（與 e394 同）。

### 人類裁定（Stage 2，2026-11-04）
人類回覆：「approve，1–8 都照建議」。對應：1 步驟 2、5–11、14–15 自動化進 `scripts/release.mjs`；2 fine-grained PAT（Contents RW、Pull requests RW、Actions R），secret 名由 PM 定（建議 `RELEASE_TOKEN`），人類在第一次真實執行前建立；3 release-gate 的 PASS 狀態先以 docs PR commit 到 `main`，workflow 核對 tuple，不設口頭保證 input；4 CHANGELOG 條目預先 commit（同一 docs PR），input 只有 `bump`、`tickets`、`dry_run`；5 advisory 處置不做 input，`docs/dependency-advisories.md` 沒列就停；6 第一次真實執行是 v4.19.0（出貨 E405 本身），手動 SOP 當 fallback；7 E401 併入 e405；8 pins 如 Dispatch pins。這八項寫進 lane 的 spec，lane 不再問。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值；workflow、文件、spec 裡不得出現 token 值、個人路徑、內部連結。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；不得在測試裡真的呼叫 GitHub API（`gh` 一律以注入的 `spawn` 假造，沿用 `test/e394-release-script.test.mjs` 的做法）。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task。PM 在預審 `close` 之前不寫 `next_role=architect`。architect 的 Open Questions 第二次預審。
- 不 push、不 merge、不發版、不刪 worktree、不建 secret、不跑真實 workflow；hop 用完 → `type: escalate`。
- 共同禁止：`.github/workflows/ci.yml`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`README.md`、`AGENTS.md`、`.antigravityrules`、`CLAUDE.md`、`qa_reports/archive/**`、`review_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`.current/_primary/**`、`index.ts`、`tools/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`bin/**`、`dist/**`、`templates/**`、`content/**`（`content/skill-release-engineer.md` 的點名行除外）、`scripts/**`（`scripts/release.mjs` 除外）、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/dependency-advisories.md`。需要動禁止檔 → 寄信，整合者裁或轉人類。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e405 | E405＋E401 | feat/e405-release-cd | ../agent-governance-mcp-lanes/e405 | `.github/workflows/release.yml`（新）、`scripts/release.mjs`（runner 模式、步驟 2／5–11／14–15 的自動化、E401 dry-run 不等 CI、失敗→issue 所需的輸出）、`docs/release-cd.md`（新：觸發方式、input、secret 名與權限、觸發前檢查清單、失敗 issue、手動 fallback）、`content/skill-release-engineer.md`（只限：指向 `docs/release-cd.md` 的一行、E401 的 dry-run 句；不整檔重寫、≤ 15,000 B 不變）、`CONTRIBUTING.md`（只限 Dev workflow 一行指標，可不動）、`specs/e405-*.md`、`test/e405-*.test.mjs`（新，qa 定名）、`test/e394-release-script.test.mjs`、`test/e394-release-sop.test.mjs`、`.current/e405/**`、`qa_reports/`、`review_reports/` | 共同禁止全部，特別是 `.github/workflows/ci.yml`、`scripts/verify-release.mjs`／`check-version.mjs`／`check-bookkeeping.mjs`（E401 在 `release.mjs` 端解：dry-run 時不呼叫嚴格 gate 或把等待秒數設 0）、`tools/**`（E402 的內容層 parser export 不在本波）、`dist/**`（不改 `.ts` 就不該有差異） | 做：workflow 檔、腳本的 runner 模式與步驟自動化、文件、測試、SOP 點名行。不做：建 secret、跑真實 workflow、第一次真實發版（整合後、人類）、E402、E406、E404 | 無 |

## 所有權重劃（相對於預設）
- **`.github/**` 從共同禁止移出，劃給 e405，只限新檔 `release.yml`**：`ci.yml` 仍禁止（`test/e298-finish-remote-delete.test.mjs` 釘住它的 push 觸發；CD 不需要改 CI）。
- **`scripts/**` 從共同禁止移出，劃給 e405，只限 `release.mjs`**：三個被吸收腳本的 CLI 入口與 exit 語意不變（E394 的硬條件延續）；E401 在 `release.mjs` 端解。
- **`content/skill-release-engineer.md` 劃給 e405，只限點名行與 dry-run 句**：它不在任何 golden、不在 budget 測試（e392-e394 波已查明），所以 addendum §2 的「`content/**` 共享生成物」對它不成立；整檔仍 ≤ 15,000 B（`test/e394-release-sop.test.mjs` 釘住）。
- **`docs/` 新檔 `release-cd.md` 歸 e405**；其他 `docs/*` 禁止。
- **`package.json` 不劃給 lane**：`release` npm script 別名若要，開整合後接線票。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `.github/workflows/release.yml`：`workflow_dispatch`，input 至少 bump 種類；prepare／publish／close-out 三 job（或三 step）在 runner 上呼叫 `release.mjs` 三階段；Node 22、`npm ci`、build 後才跑 | e405（E405；architect 定 job／step 切法） | ✓ |
| 三個人類決定變成 input 或預先 commit 的產物（待人類裁定 3–5） | e405（PM 依裁定寫進 spec） | ✓ |
| opening write、closing write、read-back 在 runner 上經 `dist/` 執行，不經 agent MCP；寫入帶伺服器戳記 | e405（E405） | ✓ |
| 步驟 5–11 的自動化（版號推導、release branch、四個 bump、build／test／audit、done-mark、commit message） | e405（待人類裁定 1） | ✓ |
| PR、auto-merge、push 用 secret 的 token；文件寫明 secret 名與最小權限 | e405 點名；**secret 由人類建立**（不是 repo 檔） | ✓／整合後（人類） |
| 失敗開 issue，帶 `RELEASE_STOP <CLASS>` 與 detail；成功不開 | e405（E405） | ✓ |
| E401：`publish --dry-run` 不等 CI（印狀態不等），SOP 的 dry-run 句一起改 | e405（E401 併入） | ✓ |
| SOP 留作手動 fallback：只加指向 `docs/release-cd.md` 的一行與 E401 句，整檔 ≤ 15,000 B | e405（E405） | ✓ |
| `docs/release-cd.md`：觸發方式（`gh workflow run`／UI）、input、觸發前檢查清單（PASS 已 commit、CHANGELOG 已 commit、advisory 列齊）、失敗 issue 的讀法、手動 fallback | e405（E405） | ✓ |
| 測試：`release.yml` 結構斷言（input 名、job 順序、沒有 `GITHUB_TOKEN` 做 push／PR、secret 名一致）；`release.mjs` 新步驟與 runner 模式以注入 `spawn` 測；E401 的 dry-run 斷言；`e394-release-sop` 重釘 | e405（qa） | ✓ |
| 第一次真實執行（建議 v4.19.0）成功，或失敗開票 | **整合後，人類觸發**（待人類裁定 6） | ✗（整合後） |
| `dist/` 無差異；`check:version`／`check:bookkeeping` 在 lane HEAD exit 0 | e405（qa 核對） | ✓ |
| E405、E401 done-mark；佇列 #214、#217 勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- `integ/e405` ← `--no-ff` e405 → merge-invariants。單 lane，預期零衝突。
- `npm run build` 確認 `dist/` 無差異（lane 不改 `.ts`）；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- 人類：建立 repo secret（名字與權限照 `docs/release-cd.md`）；第一次真實執行依待人類裁定 6。
- backlog done-mark（E405、E401）與佇列 DONE（#214、#217）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- 給下次發版的 CHANGELOG 提示：新 workflow 的觸發前檢查清單；手動 SOP 仍可用。

## 合併順序
1. `integ/e405` ← `--no-ff` e405，跑 merge-invariants。
2. `npm run build`（`dist/` 應無差異），跑 `check:bookkeeping`。
3. 在 integ 上 `finish e405 --shipped --base integ/e405`。
4. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
5. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/e405`。

## Dispatch pins
- e405：`pm=opus`、`architect=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-03 | 人類 | release SOP 要做成 CD（雲端跑、不耗 agent token）；開接線票排在 E394 之後。人類：「好，現在記進清單，排在 E394 之後」→ E405（佇列 #214） | `specs/fanout-e392-e394.md` Decisions；`docs/backlog.md` E405 列 |
| 2026-11-04 | 整合者 | 草案：單 lane e405、full chain（architect 替 workflow↔腳本契約）；E401 併入；`.github/**` 只開 `release.yml`、`scripts/**` 只開 `release.mjs`、`content/skill-release-engineer.md` 只開點名行與 dry-run 句；`ci.yml`、三個被吸收腳本、`tools/**`、`dist/**`、`package.json` 禁止；secret 由人類建、第一次真實執行在整合後。待人類裁定 1–8 見上 | 整合者 session |
| 2026-11-04 | 人類 | 核准清單與待人類裁定 1–8 全部照整合者建議（「approve，1–8 都照建議」）：範圍含步驟 2／5–11／14–15 自動化；fine-grained PAT、secret 由人類建；PASS 狀態與 CHANGELOG 條目先 commit 到 `main`；advisory 不做 input；v4.19.0 為第一次真實執行；E401 併入；pins 如表 | 整合者 session |
