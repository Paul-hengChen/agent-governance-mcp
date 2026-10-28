# Fan-out: post-v4 佇列第 11 波（證據與判決完整性 lane：E139 + E236 + E136 + E154 ∥ 測試基礎設施 lane：E362 + E224 ∥ lane 生命週期 lane：E217 + E215 ∥ 插入 lane：E364）
base: ac7e25b    integration branch: integ/post-v4-w11
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准 2026-10-28（D1 不拆、D2 開 e217），派工中；同日追加插入 lane e364（E364，人類裁決升版）。** `base:` 是規劃基準（v4.13.0 發版後記帳 PR #41 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

佇列 P2 段剩下 12 張。本波挑其中 8 張，依檔案範圍分成三組，三組的擁有集合互不相交：
- (1) 證據與判決完整性：E139、E236、E136、E154。共同問題是閘門被錯的證據或錯的作者放行，或留下伺服器沒接受的紀錄。四張共用 `tools/handoff-orchestrator.ts`、`gates/qa-review.ts`、`tools/evidence-file.ts`，所以放同一條 lane。
- (2) 測試基礎設施：E362、E224，都在 test-lock 這一把鎖和它的測試上。
- (3) lane 生命週期：E217、E215，都在 `bin/agc-init.mjs` 的 `feature start`／`finish`。
- (4) 插入 lane（派工後追加）：E364。派工 base 上 `npm audit --audit-level=high` 報兩則沒有處置紀錄的 HIGH，三條 lane 的 build 都被擋住。e364 先修，經 PR 合進 `main`，再由整合者用中途修 base 帶進三條 lane（E275 同形）。

## 派工前核對（整合者，2026-10-28，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `ac7e25b`；工作區乾淨。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox`；本機沒有 `e139`／`e362`／`e217`／`post-v4-w11` 的殘留 branch。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ 每條 lane 的 cut 都由人類在該 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **第 10 波交接的更正**：第 10 波 `## 接手步驟` 的「佇列 P2 段還有…」漏列了 E224（#14）和 E217（#16）。兩張在佇列與 backlog 都還開著，本波收進來。
- **e139 的四張為什麼不拆**：
  - E139：判決的狀態一致性檢查在 `tools/handoff-orchestrator.ts` 的 `REVIEW_VERDICT_STATUS_MISMATCH` 步驟（`if (parsed.agent_id === "code-reviewer" && parsed.review_verdict)`），對應的 `armCondition` 在 `gates/registry.ts`。修法比照 `completed_tasks`：非 reviewer 的寫入帶 `review_verdict` 就拒絕，同樣是「一個閘門、兩個錯誤碼」（REVIEWER_COMPLETED_TASKS_REJECTED／NON_QA_COMPLETED_TASKS_REJECTED 的先例）。cut 也可以決定開一個獨立的 registry 條目。新錯誤碼如果要寫進憲法，就會改到 `content/const-08-chain-31-mid.md`。
  - E236：`QA_REVIEW_RECORD`（pipeline 第 12 步）在 `PASS_*` 檢查之前就把 `qa_review` 寫進證據檔（`storage.recordReview` → `gates/qa-review.ts` 的 `recordReviewInFile`）。但 `PASS_MISSING_EVIDENCE` 讀的正是這次寫入剛記下的證據，所以單純把步驟往後移行不通。修法不是在 orchestrator 改順序或加回滾，就是在 `recordReviewInFile` 改，兩者都和 E139（orchestrator）、E136（`gates/qa-review.ts`）重疊。
  - E136：證據路徑 `review_${taskId.replace(/[^A-Za-z0-9._-]/g, "_")}.md` 推導了六次：`gates/code-review.ts`、`gates/qa-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/visual.ts`，以及 `tools/evidence-lookup.ts` 的 `sanitizeTaskId`。票面只點名前兩處，cut 要決定其他四處是否一起改（建議一起改，否則同一個有損投影會留在 ac-execution／expected-red／visual 的證據上）。
  - E154：`tools/evidence-file.ts` 的 `parseCoversIds` 用 `COVERS_LINE_RE.exec`，只讀第一行 `covers:`。`tools/lane-status.ts` 也呼叫它，行為改了會一起變，但不必改檔。
- **e139 會碰共享生成物**：只有 E139 的新錯誤碼要寫進 `content/**` 時才會改到。這時 golden（`test/fixtures/compose-golden/**`）和 `test/context-budget.test.mjs` 都要重新固定，所以本波這三樣只歸 e139。`gates/registry.ts` 如果多一個條目，閘門數「33」會變：`docs/architecture.md` 歸 e139（只限閘門數），`CLAUDE.md` 的閘門數由發版時更新（共同禁止）。
- **E215 的前提更正**：票面的第二半（巢狀 `node_modules` 不存在）已由 E291 的 `.current/.config.json` `nodeModulesLinks`（`agc feature start` 的連結位置可以設定）提供手段。剩下的是第一半：相對的 `core.hooksPath` 指到被 ignore 的生成目錄（例如 husky 的 `.husky/_`），在新 worktree 不存在，git 就無聲地不跑任何 hook。cut 要決定 `feature start` 是警告，還是從 primary 連結過去；另外決定 primary 有巢狀 `node_modules` 但沒有寫進 `nodeModulesLinks` 時要不要提示。
- **E217 的設計題（交 lane 的 PM）**：`ABANDON_EVIDENCE_DIRS`（`bin/agc-init.mjs`）目前只有 `qa_reports`、`review_reports`。`specs/` 是沿用 `--abandoned` 現有的「token 篩選、不遞迴、搬進 `abandoned/<ticket>/`」語意，還是比照 E214／AC17 給 `--shipped` 的「遞迴、不篩 token」？cut 寫明理由。
- **E224 是 qa-only**：只改兩個測試檔的 waitFor 預算（`test/e177b-mailbox-watch.test.mjs` 的 AC17、`test/e177b-test-lock.test.mjs` 的 AC10，E221 已併入），`scripts/mailbox-watch.mjs` 不動。E362 由 sr 改 `scripts/test-lock.mjs`，比照 E209 用暫存檔加 `linkSync` 發佈 guard 檔。兩張都碰 `test/e177b-test-lock.test.mjs`，所以同一條 lane。
- **不在本波**（P2 段剩下的 4 張）：
  - E152：要改 `content/skill-release-engineer.md`，而本波的共享生成物歸 e139。
  - E158：要先稽核 `scripts/` 才知道有幾個站點，會和 e362 的 `scripts/test-lock.mjs` 相撞。
  - E161：要先做設計決定（結構化欄位或解析散文）。
  - E184：`tools/handoff-parse.ts` 的讀取視圖，排在佇列 #20。
  - lane 如果順手碰到這幾張，記成新發現。
- **schema 不升版**：三條 lane 都不升 `schema_version`。`schema/**` 列在共同禁止。
- **會被擊中的測試（規劃時清點，lane PM 逐一核對）**：
  - e139：
    - 釘 pipeline 與錯誤碼的：`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/qa-flow.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`。
    - 讀 `covers:` 的：`test/covering-evidence.test.mjs`、`test/ac-execution.test.mjs`、`test/gates-expected-red.test.mjs`、`test/e32-e33-gate-hardening.test.mjs`、`test/e112-drift-fanout-feature-scope.test.mjs`、`test/release-staging.test.mjs`、`test/render-structure.test.mjs`。
    - `test/e177b-lane-status.test.mjs` 也讀 `covers:`。它不歸 e139，必須全綠不改。
  - e362：`test/e177b-test-lock.test.mjs`、`test/e209-test-lock-publish.test.mjs`、`test/e177b-mailbox-watch.test.mjs`。
  - e217：`test/e180-abandoned-harvest.test.mjs`、`test/e291-start-link-locations.test.mjs`、`test/agc-feature-lifecycle.test.mjs`，另有 15 個測試檔跑 `feature start`／`finish`。
- task id：
  - e139 用 `T-E139-NN`／`T-E236-NN`／`T-E136-NN`／`T-E154-NN`。
  - e362 用 `T-E362-NN`／`T-E224-NN`。
  - e217 用 `T-E217-NN`／`T-E215-NN`。
  - 不重用前波 id（E310 的 basename 撞名）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要的話，在測試裡自己建固定清單或 fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。有 architect 那一跳的 lane，architect 的 Open Questions 也要預審。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`schema/**`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e139 | E139、E236、E136、E154 | feat/e139-evidence-verdict-integrity | ../agent-governance-mcp-lanes/e139 | `tools/handoff-orchestrator.ts`、`gates/registry.ts`、`gates/code-review.ts`、`gates/qa-review.ts`、`gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/visual.ts`（只限證據路徑推導）、`tools/evidence-file.ts`、`tools/evidence-lookup.ts`、`tools/storage.ts`（只在 E236 需要時）、`dist/tools/handoff-orchestrator.*`、`dist/gates/registry.*`、`dist/gates/code-review.*`、`dist/gates/qa-review.*`、`dist/gates/ac-execution.*`、`dist/gates/expected-red.*`、`dist/gates/visual.*`、`dist/tools/evidence-file.*`、`dist/tools/evidence-lookup.*`、`dist/tools/storage.*`、`content/**`（只在 E139 的錯誤碼要寫進憲法時）、`test/fixtures/compose-golden/**`（同上，只在需要重新固定時）、`test/context-budget.test.mjs`（同上）、`docs/architecture.md`（只限閘門數）、`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/qa-flow.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`、`test/covering-evidence.test.mjs`、其他讀寫證據檔或判決的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）、`test/e139-*.test.mjs`、`test/e236-*.test.mjs`、`test/e136-*.test.mjs`、`test/e154-*.test.mjs`、`specs/e139-*`、`qa_reports/*E139*`、`qa_reports/*E236*`、`qa_reports/*E136*`、`qa_reports/*E154*`、`review_reports/*E139*`、`review_reports/*E236*`、`review_reports/*E136*`、`review_reports/*E154*`、`.current/e139/**` | `bin/**`、`scripts/**`、`tools/storage-sqlite.ts`、`tools/lane-status.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/registry.ts`、其他 `tools/**`、其他 `gates/**`、其他 `dist/**`、`guards/**`、`prompts/**`、其他 `docs/**`、其他 `.current/**`、`test/e177b-lane-status.test.mjs`、e362 與 e217 擁有的測試、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E139：非 code-reviewer 的寫入帶 `review_verdict` 時拒絕，比照 `completed_tasks` 的作者閘門（一個閘門兩個錯誤碼，或獨立條目，cut 擇一並寫明理由）；code-reviewer 的 APPROVED 列（`agent_id: qa-engineer` 的那一筆寫入，見 coordinator SOP 的 Known non-mismatches）要照常通過，cut 必須寫明怎麼辨認它。(2) E236：被拒絕的寫入不得在證據檔留下任何東西（不追加段落，也不新建檔案）；修法在「每個會拒絕的檢查都先於證據寫入」或「拒絕時回滾」之間擇一，`PASS_MISSING_EVIDENCE` 依賴同一次寫入記下的證據這一點必須保留。(3) E136：證據路徑對 task id 是單射，大小寫或被消毒的字元不同的兩個 id 不會落到同一個檔案；六個推導點收斂成同一個 helper；既有 `T-<票>-NN` 形狀的 id 路徑不變（已出貨的證據檔不必搬）。(4) E154：`parseCoversIds` 讀取每一行 `covers:` 取聯集並去重；只有一行時行為逐字不變。硬條件：不升 `schema_version`；SQLite／HTTP 模式行為不變（證據路徑只在 file 模式）；既有錯誤碼與拒絕條件不變，只新增；`tools/lane-status.ts` 不改檔，它的測試全綠不改。　不做：E184、E152、E161；`tools/storage-sqlite.ts`。 | 無 |
| e362 | E362、E224 | feat/e362-test-lock-guard | ../agent-governance-mcp-lanes/e362 | `scripts/test-lock.mjs`、`test/e177b-test-lock.test.mjs`、`test/e209-test-lock-publish.test.mjs`、`test/e177b-mailbox-watch.test.mjs`（只限 AC17 的等待預算）、`test/e362-*.test.mjs`、`test/e224-*.test.mjs`、`specs/e362-*`、`qa_reports/*E362*`、`qa_reports/*E224*`、`review_reports/*E362*`、`review_reports/*E224*`、`.current/e362/**` | `tools/**`、`dist/**`、`gates/**`、`guards/**`、`prompts/**`、`content/**`、`bin/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `scripts/**`（特別是 `scripts/mailbox-watch.mjs`）、`docs/**`、其他 `.current/**`、其他 `test/**`（特別是 e139、e217 擁有的測試、`test/e177b-lane-status.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E362：reclaim guard 檔（`<target>.reclaim-<digest>`）比照 E209 的鎖檔，先寫進暫存檔再用 `linkSync` 放到位，讓 guard 永遠不會以空檔被看到；qa 寫確定性重現（reviewer 在 E209 時已用 scratch script 重現過）。(2) E224（qa-only，E221 已併入）：AC17、AC10（含 E221 的 AC13b）在全套負載下不再因 3 秒 waitFor 逾時而紅；等待預算可由環境變數覆寫或提高，qa 決定，理由寫進 qa 報告。硬條件：`test-lock` 的命令列介面與 `-- npm test` 用法不變；E209 的鎖檔發佈方式不變；`scripts/mailbox-watch.mjs` 一行都不改。　不做：E363（spawn 餘裕的數據點）、E238／E254／E278 的其他偶發測試、E156。 | 無 |
| e217 | E217、E215 | feat/e217-lane-lifecycle-gaps | ../agent-governance-mcp-lanes/e217 | `bin/agc-init.mjs`、`tools/config.ts`（只在 E215 的 cut 需要新設定鍵時）、`dist/tools/config.*`（同上）、`docs/config.md`（同上）、`test/e180-abandoned-harvest.test.mjs`、`test/e291-start-link-locations.test.mjs`、`test/agc-feature-lifecycle.test.mjs`（只限被本 lane 改變的行為斷言）、其他跑 `feature start`／`finish` 的 `test/**`（同上，cut 裡逐一列名，預審核對）、`test/e217-*.test.mjs`、`test/e215-*.test.mjs`、`specs/e217-*`、`qa_reports/*E217*`、`qa_reports/*E215*`、`review_reports/*E217*`、`review_reports/*E215*`、`.current/e217/**` | `bin/agent-governance-context.mjs`、`bin/agent-governance-usage-hook.mjs`、其他 `tools/**`、其他 `dist/**`、`gates/**`、`guards/**`、`prompts/**`、`content/**`、`scripts/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `docs/**`、其他 `.current/**`、其他 `test/**`（特別是 e139、e362 擁有的測試）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E217：`finish --abandoned` 收割被 ignore 或未連結的 `specs/`，不再隨 `git worktree remove` 無聲消失；遞迴與 token 篩選的語意由 cut 決定並寫明理由（見派工前核對的設計題）。(2) E215：`feature start` 偵測到相對的 `core.hooksPath` 在新 worktree 不存在時，至少大聲警告（是否從 primary 連結由 cut 決定）；primary 有巢狀 `node_modules` 但沒寫進 `nodeModulesLinks` 時，是否提示由 cut 決定。硬條件：不升 `schema_version`（config 加選填鍵比照 E291，不升版）；`--shipped` 的收割行為不變；`feature start` 的拒絕條件與回滾不變；絕不執行 `npm ci`／`npm install`；新增的訊息回顯路徑時，比照 E250 跳脫控制字元。　不做：E218、E219、E220 等 finish 邊角；E242；E252／E253 的路徑回顯。 | 無 |
| e364 | E364 | feat/e364-audit-high-upgrade | ../agent-governance-mcp-lanes/e364 | `package-lock.json`、`package.json`（只在 cut 認定要提高 `zod` 下限時）、`docs/dependency-advisories.md`、`specs/e364-*`、`qa_reports/*E364*`、`review_reports/*E364*`、`.current/e364/**` | `content/**`、`test/**`、`tools/**`、`dist/**`、`bin/**`、`scripts/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`、共同禁止的其餘項目 | 做：人類已裁決兩則都升版 —— 更新 `package-lock.json`，讓 `zod` 解析到 `>=4.6.6`（GHSA-mrhx-c7xc-m3w5，直接相依，宣告範圍 `^4.4.3` 已涵蓋修正版）、`body-parser` 解析到 `>=2.4.0`（GHSA-27r3-jxmh-p828，經 `@modelcontextprotocol/sdk` → `express` 5.2.1 的 `^2.2.1` 帶進來，範圍已涵蓋修正版）；兩則處置（upgrade＋各自的 re-review trigger）寫進 `docs/dependency-advisories.md`，格式照該檔既有各節；`npm audit --audit-level=high` exit 0；全套綠。硬條件：lockfile 只動這兩個套件與它們必要的連動，cut 列出實際的版本變動清單；不跑 `npm audit fix`（會連帶升 SDK／hono 等，E57 已否決）也不帶 `--force`；照補充規則 §1 先 `rm node_modules`（只刪 symlink）再 `npm ci`，lane 用自己的 `node_modules`，不經 symlink 改 primary；不加 override，除非 lockfile 做不到（cut 說明理由）。　不做：其他 moderate／low advisory（`qs`、`protobufjs`、`ip-address` 等）；`@modelcontextprotocol/sdk` 升版。 | 無 |

## 所有權重劃（相對於預設）
- 三條 lane 的擁有集合不相交。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部歸 e139，只在 E139 的錯誤碼要寫進憲法時才動；e362、e217 一律不碰。
- **證據四張放同一條 lane**（不拆，D1）：E139／E236 共用 `tools/handoff-orchestrator.ts`，E236／E136 共用 `gates/qa-review.ts`，E154 與 E136 都在證據檔的讀取路徑上（`tools/evidence-file.ts`／`tools/evidence-lookup.ts`）。
- **`bin/agc-init.mjs` 從共同禁止移出，劃給 e217**：第 10 波它在共同禁止裡；本波只有 e217 能改。`bin/` 的另外兩個檔仍禁止。
- **`docs/architecture.md` 劃給 e139，只限閘門數**。
- **`test/e177b-mailbox-watch.test.mjs` 劃給 e362，只限 AC17 的等待預算**。
- **`test/e177b-lane-status.test.mjs` 不劃給任何 lane**：它讀 `covers:`，E154 改了解析之後必須全綠不改。
- **`schema/**`、`docs/lane-protocol*.md` 在共同禁止**：本波不升 schema，也不改 lane 規則。
- **e364 例外**：`package-lock.json`、`package.json`（只限 `zod` 下限）從共同禁止移出，劃給 e364；`docs/dependency-advisories.md` 也劃給 e364。其他三條 lane 一律不碰這三個檔。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 非 reviewer 的寫入帶 `review_verdict` 會被拒絕；reviewer 的 APPROVED 列照常通過；錯誤碼在 registry 與（需要時）憲法一致 | e139（E139） | ✓ |
| 被伺服器拒絕的 qa 寫入不會在證據檔留下段落或新檔，有 qa 的測試 | e139（E236） | ✓ |
| 只有大小寫或被消毒字元不同的兩個 task id，不會解析到同一個證據檔；六個推導點共用一個 helper | e139（E136） | ✓ |
| 證據檔裡多行 `covers:` 取聯集去重；單行行為不變 | e139（E154） | ✓ |
| reclaim guard 檔永遠不會以空檔被看到，停滯的回收者不會刪掉活著的鎖，有 qa 的確定性重現 | e362（E362） | ✓ |
| mailbox-watch AC17、test-lock AC10／AC13b 在全套負載下不再撞固定 3 秒逾時 | e362（E224） | ✓ |
| `finish --abandoned` 不再無聲丟掉被 ignore 或未連結的 `specs/` | e217（E217） | ✓ |
| `feature start` 遇到新 worktree 缺少相對 `core.hooksPath` 時大聲提示（或補上連結） | e217（E215） | ✓ |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e139、e362、e217（各自的 qa） | ✓ |
| E139、E236、E136、E154、E362、E224、E217、E215 done-mark；佇列對應列勾 DONE；E215 的前提更正寫進 done-mark | 整合者（5c） | ✓ |
| `npm audit --audit-level=high` exit 0；兩則處置寫進 `docs/dependency-advisories.md` | e364（E364） | ✓ |
| e364 經 PR 合進 `main` 後，primary 重新安裝相依套件，整合者用中途修 base 把 `main` merge 進 e139、e362、e217 | 整合者（e364 合併後） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e139 → e362 → e217。每次 merge 後跑 `merge-invariants`；全部合併後重建 `dist/`、跑 `check:bookkeeping`、`npm audit --audit-level=high`，push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback 時跑）。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。
- e217 合併後，整合者修 `docs/install.md` 的 `--abandoned` 第 2 步（原句「`specs/` is never touched」），改成符合 E217 的行為（E217-NEW-1 的一半）。

## 合併順序
**先做 e364（單獨）**：核對 e364 回報（5a）→ `integ/e364` ← `--no-ff` e364、merge-invariants → push、讀 CI → 在 `integ/e364` 上 `finish e364 --shipped --base integ/e364` 與 E364 的 done-mark → push、讀 CI → `gh pr create`、`gh pr merge --auto --merge` → 合併後 `main` pull、primary `npm ci`（各 lane 的 `node_modules` symlink 指向 primary）→ 依中途修 base 五條件，逐條 lane 暫停、`merge --no-ff origin/main`、恢復通知。

其餘三條：
1. `integ/post-v4-w11` ← `--no-ff` e139（共享生成物 lane 先），再跑 merge-invariants。
2. ← `--no-ff` e362，再跑 merge-invariants。
3. ← `--no-ff` e217，再跑 merge-invariants。
4. 重建 `dist/`，跑 `check:bookkeeping`。
5. 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w11`。
6. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
7. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/post-v4-w11`。

預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，一律重建。

## Dispatch pins
- e139：`pm=opus`、`sr-engineer=opus`。
- e362：`pm=opus`、`sr-engineer=opus`。
- e217：`pm=opus`、`sr-engineer=opus`。
- e364：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-28 | 整合者 | 草案：e139（E139＋E236＋E136＋E154，證據與判決完整性，共用 `tools/handoff-orchestrator.ts`／`gates/qa-review.ts`／`tools/evidence-file.ts` 所以不拆；唯一可能碰共享生成物的 lane）∥ e362（E362＋E224，test-lock 與它的測試）∥ e217（E217＋E215，`bin/agc-init.mjs` 的 lane 生命週期）。更正第 10 波交接漏列的 E224、E217；E215 的前提更正（巢狀 `node_modules` 那半已由 E291 提供手段）；`bin/agc-init.mjs` 從共同禁止移出、劃給 e217；`docs/architecture.md` 劃給 e139（只限閘門數）。E152、E158、E161、E184 不在本波。待人類裁決：D1（證據四張是否放同一條 lane）、D2（是否開第三條 lane e217） | 本檔 |
| 2026-10-28 | 人類 | 核准本清單（全部）：三條 lane（e139、e362、e217）與所有重劃；D1、D2 照草案（D1 —— 證據四張放同一條 lane；D2 —— 開 e217 lane）；Lanes 表不加 `approval` 欄。人類回覆「approve」 | 整合者 session |
| 2026-10-28 | 整合者 | 清單 PR #42 merge `1adb50b` = 派工 base（CI run 40626875225 在 `79c15ac` 綠）；派工前核對：三條 lane 點名的擁有／禁止路徑在 base 都存在，沒有殘留 branch／worktree；信箱 e139／e362／e217 已建空檔，mailbox-watch 與 lane-status watch 都已 armed；三份 prompt 以 `fanout.mjs render --base 1adb50b` 產生。派工前修正 e217 的一條硬條件：原句「新增的訊息不印本機絕對路徑以外的敏感資訊，路徑回顯比照 E250 的跳脫做法」語意不清，改成「新增的訊息回顯路徑時，比照 E250 跳脫控制字元」。此修正隨記帳 commit 進 integ | 本檔 |
| 2026-10-28 | 整合者 | e362 cut 預審 close（`afb5585`，to-lane#2）：範圍、檔案邊界、完成定義對照都符合；check --cut exit 0；E362 有 sr 實作 task，E224 依清單 qa-only；同意 feature 模式（qa 對 base 副本重現，比照 E209）與 spec 的四個詮釋；新發現 E362-NEW-1（P3，acquireLock 在 guard 被持有時忙轉、不檢查 --max-wait）等 finish 配號。例外：PM 在預審前就寫了 `next_role=sr-engineer`，且沒寄信，整合者以 to-lane#1 索取（cut gate 會擋，沒有派工） | 信箱 e362 |
| 2026-10-28 | 整合者 | e217 cut 預審 close（`a9abf83`，to-lane#2）：範圍、檔案邊界、完成定義對照都符合；check --cut exit 0；每條 AC 都有實作 task；同意 D-E217-1..5（specs/ 用 E214 的遞迴、不篩 token 走訪，只複製到 primary `specs/abandoned/<ticket>/`，`ABANDON_EVIDENCE_DIRS` 不變）與 D-E215-1/2/4（只警告、不連結、不加設定鍵）。給人類的建議：D-E215-3 確認不提示巢狀 `node_modules`（needs human ruling，由 lane 呈）。E217-NEW-1：`docs/install.md` 那半邊改由整合者在整合後修（記入「整合後」），`docs/lane-protocol.md` §3 留作新發現。例外：PM 在預審前就寫了 `next_role=sr-engineer`，且沒寄信，整合者以 to-lane#1 索取（cut gate 會擋，沒有派工） | 信箱 e217 |
| 2026-10-28 | 人類 | 在 e362 lane session 核准 cut（`afb5585`） | e362 lane session；`specs/e362-test-lock-guard.md`，commit `afb5585` |
| 2026-10-28 | 人類 | 在 e217 lane session 核准 cut（`a9abf83`）；D-E215-3 裁決：不提示巢狀 `node_modules`（不採選項 B），spec 不改 | e217 lane session；`specs/e217-lane-lifecycle-gaps.md`，commit `a9abf83` |
| 2026-10-28 | 整合者 | e139 cut 預審 close（`3a53bf8`，to-lane#3）：範圍、檔案邊界、完成定義對照都符合；check --cut exit 0（10 張 task）；每條 AC 都有實作 task；同意 E139（新條目 `NON_REVIEWER_VERDICT_REJECTED`，與 REVIEW_VERDICT_STATUS_MISMATCH 同一步驟、兩碼；`documentedInProse: false`，所以共享生成物不動）、E236（file 模式回滾，不改順序）、E136（`encodeEvidenceId`，正規 id 路徑不變；本 repo 非正規 id 的影響已查為零）、E154（逐行取聯集）。R1 由整合者裁決（機械性越界）：准許 qa 只改 `test/e308-single-source-tier-enum.test.mjs` 的 E303-AC12 數字（34 → 35）與標題。例外：PM 在預審前就寫了 `next_role=sr-engineer`，且沒寄信，整合者以 to-lane#2 索取 | 信箱 e139 |
| 2026-10-28 | 人類 | 兩則 HIGH advisory（`zod` GHSA-mrhx-c7xc-m3w5、`body-parser` GHSA-27r3-jxmh-p828）處置為升版（選項 A）：開 E364（P1）、以插入 lane e364 執行，先經 PR 合進 `main`，再由整合者用中途修 base 帶進 e139、e362、e217。人類回覆「升版」 | 整合者 session |
| 2026-10-28 | 整合者 | E364 配號（`docs/backlog.md`、佇列 #3a，插隊）；e364 擁有 `package-lock.json`、`package.json`（只限 `zod` 下限）、`docs/dependency-advisories.md`（從共同禁止中除外）；e364 用自己的 `node_modules`。e362 已因此停在 Blocked（T-E362-01 已 commit `fe88f88`），e139、e217 已通知撞到時照 §6 停下、不必另寄 escalate | 本檔 |
| 2026-10-28 | 人類 | 在 e139 lane session 核准 cut（`3a53bf8`；R1 記為整合者裁決） | e139 lane session；`specs/e139-evidence-verdict-integrity.md`，commit `3a53bf8` |
| 2026-10-28 | 整合者 | E364 立票 PR #43 merge `ab8dfbb` = e364 派工 base；e364 擁有的路徑在 base 存在、沒有殘留 branch／worktree；信箱 e364 已建空檔，mailbox-watch 重新 armed 時加入 e364 | 本檔 |
| 2026-10-28 | 整合者 | e139 R1 擴大（機械性越界，to-lane#4）：sr 回報 `test/e308-single-source-tier-enum.test.mjs` E303-AC11a 斷言 registry 原始碼 `(none)` 出現 0 次，新條目合法的 `(none)` 對照列會讓它變紅。准許 qa 改該斷言與標題，條件是保留原意（`(none)` 不得出現在 `DISPATCH_PIN_TIER_REJECTED` 的對照列上）；同測試其他斷言與 AC11b／AC11c 不改。另接受 sr 改寫 `documentedInProse` 介面註解（只動註解，由 code-reviewer 確認）；cut 列出的 qa re-pin 不需要 expected-red 清單 | 信箱 e139 |
| 2026-10-28 | 整合者 | e364 cut 預審 close（`4b39641`，to-lane#1）：範圍、檔案邊界、完成定義對照都符合；check --cut exit 0；同意 `zod` 下限提高到 `^4.6.6`（透過 `npx github:` 安裝的使用者只受宣告範圍約束；清單「只在 cut 認定要提高 `zod` 下限時」的條件成立），lockfile 預期 7 項變動，不符就停；不加 override、不跑 `npm audit fix` | 信箱 e364 |
| 2026-10-28 | 人類 | 在 e364 lane session 核准 cut（`4b39641`） | e364 lane session；`specs/e364-audit-high-upgrade.md`，commit `4b39641` |
| 2026-10-28 | 整合者 | e364 揭露：coordinator 派 code-reviewer 時誤傳 `model=sonnet`（frontmatter 是 opus，本票沒有它的 pin），handoff 的 `dispatch_mechanism_tier` 卻由 reviewer 自報成 opus。給人類的建議（needs human ruling，由 lane 呈）：不必用 opus 重審（變更只有 lockfile、`package.json` 一行與文件；qa 會獨立重驗），但要在 review 報告或下一次 handoff 寫一行更正 | 信箱 e364 to-integrator#4、to-lane#2 |
| 2026-10-28 | 整合者 | 5a：e364 `8adb9ba`（CI run 40643730940）close —— review 一輪通過（見 sonnet 派工例外）、qa 一輪通過；10 檔都在擁有範圍內；lockfile 正好 7 項變動、audit high exit 0、全套 3689／2 skipped／0 fail（lane 回報，CI 綠）；沒有新發現 | 本檔 |
| 2026-10-28 | 人類 | e364 不用 opus 重審（照整合者建議）；sonnet 派工的例外以 lane handoff 的更正行為準。人類回覆「ok 不重審」 | 整合者 session |
| 2026-10-28 | 整合者 | e364 先行：`integ/e364` ← e364 `8adb9ba`（`--no-ff`，merge `163c397`，零衝突 → 無合併審查）；merge-invariants PASS；primary `npm ci` 後 `zod` 4.6.7、`body-parser` 2.4.0；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；roll-up e364 2 張 task／hop 4/14／review 0 輪／qa 0 輪；`finish e364 --shipped --base integ/e364`（`aa8c566`）沒有新發現；E364 done-mark 與佇列 #3a DONE | 本檔 |
