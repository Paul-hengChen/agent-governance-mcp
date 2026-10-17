# Fan-out: post-v4 佇列第 6 波（fanout 工具 lane：E284 + E331 + E330 + E332 + E333 ∥ content lane：E329 + E328 + E334 + E327 ∥ start／finish lane：E291 + E335）
base: cebeb64    integration branch: integ/post-v4-w6
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-17。** 三條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w6` merge `d4855e4`（e329）、`ec6697b`（e284）、`047a652`（e291）→ finish 三 lane（E337–E340 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（v4.8.0 發版記帳 PR #20 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

照第 5 波結案的建議做，再加上 integrator 改版第 2 波剩下的票。E284（`fanout.mjs handoff`）原本等的 E283 已出貨；E331、E330、E332 和它改同一組檔案，併成一條 lane；E333 只改 E283 的測試檔，也併進來。E329、E328、E334 都改 `content/skill-integrator.md`，E327 改 `docs/lane-protocol.md` §3，四張併成本波唯一的 content lane。E291 原本等的 E287 已出貨；E335 改的也是 `bin/agc-init.mjs` 的 finish，和 E291 併成一條 lane。改版第 2 波的 E294 本波不做，因為票面要先實測，而且 prompt 範本那一行在 `scripts/fanout.mjs`，和 e284 同檔；E288 已在第 5 波出貨。

## 派工前核對（整合者，2026-10-17，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `cebeb64`（v4.8.0：release PR #19 `3f0c2a8`、發版記帳 PR #20；tag `v4.8.0`）；遠端只剩 `main`。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`<lanes-root>/_mailbox/` 是空的。
- `.current/.config.json` 的 `cutApprovalAutoTier` 是 `{}`，沒有 `manifest: true`（人類 2026-10-17 決定本波不開）→ 本波每條 lane 的 cut 仍由人類在 lane session 核准；Lanes 表不加 `approval` 欄。
- **E284 的落點**：`tools/fanout-manifest.ts`（或新模組 `tools/fanout-handoff.ts`）＋ `scripts/fanout.mjs`。事實欄位：目標分支 sha 對 origin、`git status`、`git worktree list`（只寫相對路徑）、信箱訊息數與 watch baseline、lane-status、未 push 的 commit；判斷類欄位（待人類決定、建議）留佔位。產生的骨架必須通過 E283 的 `validate`（`## 接手步驟` 四個必填子項）。`--check` 重新收集同一組事實，不一致就以非零碼結束、逐項點名。**不改 SOP**：SOP 引用這個指令是 E285（改版第 3 波）。
- **lane-status 與信箱的重用**：E284 可以匯入 `tools/lane-status.ts`、`scripts/mailbox-watch.mjs` 的既有邏輯；要改它們只限新增 export，既有 CLI 輸出 byte-identical。`test/e177b-lane-status.test.mjs` AC1（structural）斷言 `tools/lane-status.ts` 的非註解行不提清單 —— 清單相關邏輯不得寫進 `tools/lane-status.ts`。
- **E330 的落點**：`scripts/fanout.mjs` 通用 USAGE 加 `owners` 一行，同一個改動重新固定 `test/e296-manifest-tier.test.mjs` AC12。e296 測試檔劃給 e284，但只限 AC12；它也釘 `docs/lane-protocol.md` §5-2（AC4）與 skill-integrator Stage 2（AC5）的句子，所以 e329 不得改這些句子。
- **E331 的落點**：`owners --range` 與 `checkLane` 的 `git diff` 失敗（例如沒有 merge base）時改為 exit 2 並給具名錯誤碼，不再印 stack trace、不再和「有命中」同碼。
- **E332 的落點**：validate 交接段的絕對路徑偵測補上漏抓的邊界（粗體 `**` 之後、ASCII 冒號或逗號之後、表格 `|…|` 內、`file:///`、`$HOME/`、UNC），並排除 `~10/17` 這類日期。**硬條件**：本 repo 現有每一份 `specs/fanout-*.md` 的 `validate` 結果（exit code 與錯誤碼集合）不變 —— 第 5 波的已結案清單若因此新被擋，是真發現，寄信箱，不是改測試。
- **E333 的落點**：`test/e283-validate-handoff.test.mjs` 的文法案例改成 in-process 呼叫 `validateManifest`，只留少數 CLI 案例檢查 exit code 與 stderr。qa 負責。
- **E329 的落點**：`content/skill-integrator.md` Stage 6 寫明標準狀態行 `**狀態：已結案 <日期>。…**` 與 `## 接手步驟` 子項標題（核對 primary、已結案、待人類決定、進行中的背景工作；可選 裝置、工具）；Stage 4 *Mid-wave base fix* 條件 2 改用 `node scripts/fanout.mjs owners <manifest> --range <lane branch>...origin/<target>`（exit 0 = 沒碰任何 lane 擁有檔）。引用的指令形狀以派工 base 上的實作為準，不以票面為準。
- **E328 的落點**：同檔 Stage 0：交辦單那列 Decisions 的 `裁決者` 寫明是哪個值；改 cut 檔而重派 PM 屬於「Stage 0 only」那列權限。
- **E334 的落點**：`docs/lane-protocol.md` §4 寫明選填的 `target_repo: <repo>`，以及從未 commit 進分支的 `pending-tickets.md` 不配號（finish 警告並留一份在 `.current/history/<YYYY-MM>/<lane>/`）；`content/skill-integrator.md` Stage 6 寫明整合者對每一筆 `target_repo` 新發現請人類裁決、對被警告未配號的新發現手動建票。行為以派工 base 上的 `bin/agc-init.mjs` 為準。
- **E327 的落點**：`docs/lane-protocol.md` §3 的歷史 SHA 許可與 `content/skill-qa-engineer.md` 的 E323 慣例句（「never diff against a fixed lane base sha」）說成同一件事：二選一，縮小 §3 的許可，或在 qa 那一句點名唯一例外。`content/skill-qa-engineer.md` 進 compose golden、位元組上限 18500（`test/qa-visual-skill-split.test.mjs`），派工 base 實測 18066 bytes。
- **E291 的落點**：`bin/agc-init.mjs`（`feature start` 的 node_modules 連結）、`tools/config.ts`（選填的連結位置清單）、`docs/config.md`（新 key 的說明）。config schema 要不要升版由 PM 決定；升版時連帶 `schema/versions.ts`、`schema/migrations-config.ts`、`docs/schema-versions.md`。`docs/lane-protocol.md` §1 的 node_modules 那段本波不改（屬 E290）。
- **E335 的落點**：同檔 finish 的 lane-close／abandon harvest：lane 的 `pending-tickets.md` 是 symlink 時，在 harvest 解參照，或在 plan 階段拒絕並給自己的 Copy 字串，二選一由 PM 決定；加回歸測試。
- task id：e284 用 `T-E284-NN`／`T-E330-NN`／`T-E331-NN`／`T-E332-NN`／`T-E333-NN`；e329 用 `T-E329-NN`／`T-E328-NN`／`T-E334-NN`／`T-E327-NN`；e291 用 `T-E291-NN`／`T-E335-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要就在測試裡建固定清單／fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`（e291 擁有的 `bin/agc-init.mjs` 除外）。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e284 | E284、E331、E330、E332、E333 | feat/e284-fanout-handoff-command | ../agent-governance-mcp-lanes/e284 | `tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`tools/fanout-handoff.ts` 與其 `dist/tools/fanout-handoff.*`（新建，可選）、`tools/lane-status.ts` 與其 `dist/tools/lane-status.*`（只限新增 export）、`scripts/fanout.mjs`、`scripts/mailbox-watch.mjs`（只限新增 export）、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e322-owners.test.mjs`、`test/e316-cut-heading-variants.test.mjs`、`test/e296-manifest-tier.test.mjs`（只限 AC12 重新固定）、`test/e177b-lane-status.test.mjs`（只在新增 export 需要時）、`test/e177b-mailbox-watch.test.mjs`（同上）、`test/e284-*.test.mjs`、`test/e330-*.test.mjs`、`test/e331-*.test.mjs`、`test/e332-*.test.mjs`、`test/e333-*.test.mjs`、`specs/e284-*`、`qa_reports/*E284*`、`qa_reports/*E330*`、`qa_reports/*E331*`、`qa_reports/*E332*`、`qa_reports/*E333*`、`review_reports/*E284*`、`review_reports/*E330*`、`review_reports/*E331*`、`review_reports/*E332*`、`review_reports/*E333*`、`.current/e284/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、其他 `scripts/**`、其他 `tools/**`（特別是 `tools/config.ts`）、`gates/**`、`bin/**`、其他 `test/**`（特別是 `test/e178a-integrator-role.test.mjs`、`test/e288-integrator-stage0.test.mjs`）、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E284：`fanout.mjs handoff <manifest>` 產生 `## 接手步驟` 骨架並填好事實欄位（目標分支 sha 對 origin、`git status`、相對路徑的 worktree 清單、信箱訊息數與 watch baseline、lane-status、未 push 的 commit），判斷類欄位留佔位；產物必須通過 `validate`；`handoff --check` 重新收集事實，不一致時非零結束並逐項點名；輸出介面與 exit code 由 PM 定。(2) E331：`owners --range` 與 `check` 的 `git diff` 失敗時 exit 2 加具名錯誤碼，不印 stack trace。(3) E330：通用 USAGE 列出 `owners`，重新固定 e296 AC12。(4) E332：絕對路徑偵測補邊界、排除日期形狀，附 fixture 測試。(5) E333（qa）：`test/e283-validate-handoff.test.mjs` 文法案例改 in-process。硬條件：現有每一份 `specs/fanout-*.md` 的 `validate` 結果不變；`render` 對既有清單 byte-identical；`owners`／`check` 除 E331 的失敗路徑外 exit code 不變；`tools/lane-status.ts`、`scripts/mailbox-watch.mjs` 的既有 CLI 輸出 byte-identical；e296 除 AC12 外不改。　不做：改 `content/skill-integrator.md`（SOP 引用 `handoff` 屬 E285）；E289 render 補充檔；E294 的 prompt 範本行；E314／E315。 | 無 |
| e329 | E329、E328、E334、E327 | feat/e329-integrator-sop-followups | ../agent-governance-mcp-lanes/e329 | `content/skill-integrator.md`、`content/skill-qa-engineer.md`（只限 E327 那一句）、`docs/lane-protocol.md`（只限 §3、§4）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/qa-visual-skill-split.test.mjs`（只限 qa SOP 位元組上限，調整需人類在 cut 核准）、`test/e178a-integrator-role.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e246-mailbox-teardown.test.mjs`（只限 SOP／lane-protocol 句子的重新固定，finish 行為案例不動）、`test/skill-frontmatter.test.mjs`（只在需要重新固定時）、`test/render-structure.test.mjs`（同上）、`test/e329-*.test.mjs`、`test/e328-*.test.mjs`、`test/e334-*.test.mjs`、`test/e327-*.test.mjs`、`specs/e329-*`、`qa_reports/*E329*`、`qa_reports/*E328*`、`qa_reports/*E334*`、`qa_reports/*E327*`、`review_reports/*E329*`、`review_reports/*E328*`、`review_reports/*E334*`、`review_reports/*E327*`、`.current/e329/**` | 其他 `content/**`（特別是 `content/const-*.md`、`content/coord-*.md`、`content/skill-pm.md`）、`tools/**`、`gates/**`、`scripts/**`、`bin/**`、`dist/**`、其他 `docs/**`（特別是 `docs/config.md`）、其他 `test/**`（特別是 `test/e296-manifest-tier.test.mjs` 與 e284、e291 擁有的測試）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E329：Stage 6 寫明標準狀態行與 `## 接手步驟` 子項標題；Stage 4 *Mid-wave base fix* 條件 2 改用 `fanout.mjs owners … --range`。(2) E328：Stage 0 寫明交辦單那列的 `裁決者` 值、改 cut 檔重派 PM 屬 Stage 0 權限。(3) E334：lane-protocol §4 寫明 `target_repo` 與未 commit 的 `pending-tickets.md` 不配號；Stage 6 寫明整合者對兩者的處理。(4) E327：lane-protocol §3 的歷史 SHA 許可與 qa SOP 慣例句一致（二選一由 PM 決定）。硬條件：`test/e296-manifest-tier.test.mjs`（不擁有）全綠不改 —— 不得改它釘住的 lane-protocol §5-2 與 skill-integrator Stage 2 句子；`test/e246-mailbox-teardown.test.mjs` 釘住的 Stage 6 finish／mailbox 句子只能在同一個改動裡重新固定、語意不變；引用的指令與 finish 行為以派工 base 為準。　不做：憲法片段與 coordinator SOP；SOP 引用 `fanout.mjs handoff`（E285）；lane-protocol 改通用寫法（E290）；lane-protocol §1 的 node_modules 段（E291 不改文件，E290 處理）。 | 無 |
| e291 | E291、E335 | feat/e291-start-link-locations | ../agent-governance-mcp-lanes/e291 | `bin/agc-init.mjs`、`tools/config.ts` 與其 `dist/tools/config.*`、`docs/config.md`、`schema/versions.ts`、`schema/migrations-config.ts` 與其 `dist/schema/versions.*`、`dist/schema/migrations-config.*`（只在 PM 決定升 config schema 版本時）、`docs/schema-versions.md`（同上）、`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/e287-finish-findings.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`（只在需要時）、`test/config-versioning.test.mjs`（同上）、`test/config-cache.test.mjs`（同上）、`test/e31-config-nonfatal.test.mjs`（同上）、`test/lane-paths.test.mjs`（同上）、`test/e291-*.test.mjs`、`test/e335-*.test.mjs`、`specs/e291-*`、`qa_reports/*E291*`、`qa_reports/*E335*`、`review_reports/*E291*`、`review_reports/*E335*`、`.current/e291/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `docs/**`（特別是 `docs/lane-protocol.md`）、`scripts/**`、其他 `tools/**`（特別是 `tools/fanout-manifest.ts`、`tools/lane-status.ts`）、`gates/**`、其他 `schema/**`、其他 `bin/**`、其他 `test/**`（特別是 `test/e246-mailbox-teardown.test.mjs`）、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E291：`.current/.config.json` 加選填的 node_modules 連結位置清單，`feature start` 依清單建連結；key 不存在時行為與派工 base 相同（只連 root、沒有 root `package.json` 時警告）；key 名稱、格式、是否升 schema 版本由 PM 定；`docs/config.md` 寫明新 key。(2) E335：lane 的 `pending-tickets.md` 是 symlink 時 finish 會收斂（harvest 解參照，或 plan 階段拒絕並給自己的 Copy 字串，二選一由 PM 定），加回歸測試。硬條件：`test/e246-mailbox-teardown.test.mjs`（不擁有）全綠不改；finish 對一般檔案的 `pending-tickets.md` 行為不變。　不做：`docs/lane-protocol.md` §1 的改字（E290）；E304（finish 刪 remote branch 的小修，佇列後段）；改 `templates/**`。 | 無 |

## 所有權重劃（相對於預設）
- 三條 lane 擁有集合不相交；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e329。
- **`bin/agc-init.mjs` 劃給 e291**：共同禁止改成「`bin/**`（e291 的 `bin/agc-init.mjs` 除外）」。
- **`docs/lane-protocol.md` 劃給 e329，只限 §3、§4**：第 5 波它在共同禁止；本波 E334、E327 必須改它，所以移出共同禁止。
- **`docs/config.md` 劃給 e291**：E291 的新 key 要寫進去；其他 lane 一律禁止 `docs/**`。
- **`test/e296-manifest-tier.test.mjs` 劃給 e284，只限 AC12**：E330 要在同一個改動裡重新固定 AC12（USAGE 在 `scripts/fanout.mjs`，屬 e284）；這個檔也讀 lane-protocol 與 skill-integrator，所以 e329 不得改它釘住的句子。
- **`test/e246-mailbox-teardown.test.mjs` 劃給 e329，只限句子重新固定**：第 5 波它在 finish lane；本波 E334 要改 Stage 6，而 E335 只動 harvest、不碰信箱拆除，所以 e291 對它是硬條件（全綠不改）。
- **`tools/lane-status.ts`、`scripts/mailbox-watch.mjs` 劃給 e284，只限新增 export**：E284 要收集 lane 狀態和信箱 baseline；本波沒有其他 lane 碰這兩個檔。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `fanout.mjs handoff` 產生的 `## 接手步驟` 骨架已填事實欄位、通過 `validate`；`handoff --check` 在事實不一致時非零結束並逐項點名 | e284（E284） | ✓ |
| `owners --range`／`check` 的 `git diff` 失敗時 exit 2 加具名錯誤碼，不印 stack trace | e284（E331） | ✓ |
| `fanout.mjs` 通用 USAGE 列出 `owners`，e296 AC12 跟著重新固定 | e284（E330） | ✓ |
| 絕對路徑偵測抓得到票面列的六種邊界，`~10/17` 日期不誤報；現有清單 validate 結果不變 | e284（E332） | ✓ |
| `test/e283-validate-handoff.test.mjs` 的文法案例改 in-process，執行時間明顯下降 | e284（E333） | ✓ |
| skill-integrator Stage 6 寫明標準狀態行與 `## 接手步驟` 子項；Stage 4 條件 2 用 `owners --range` | e329（E329） | ✓ |
| skill-integrator Stage 0 寫明交辦單那列的裁決者值、重派 PM 改 cut 檔屬 Stage 0 權限 | e329（E328） | ✓ |
| lane-protocol §4 寫明 `target_repo` 與未 commit 的 `pending-tickets.md`；Stage 6 寫明整合者的處理 | e329（E334） | ✓ |
| lane-protocol §3 與 qa SOP 對歷史 SHA 測試的說法一致 | e329（E327） | ✓ |
| goldens 重產、budget 綠（qa SOP 上限若要調，由人類核准 cut 時定） | e329（qa） | ✓ |
| `.current/.config.json` 可設 node_modules 連結位置，`feature start` 照設定建連結；沒設時行為不變；`docs/config.md` 有說明 | e291（E291） | ✓ |
| lane 的 `pending-tickets.md` 是 symlink 時 finish 會收斂，並有回歸測試 | e291（E335） | ✓ |
| E284、E331、E330、E332、E333、E329、E328、E334、E327、E291、E335 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時自己寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e329 → e284 → e291；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback）。
- 本清單結案時可以先試用 e284 剛出貨的 `fanout.mjs handoff` 產生 `## 接手步驟`，再以 `handoff --check` 核對；工具有問題就手寫並把問題記成新發現。
- E285（SOP 引用 `handoff`、接手模式）與 E289（render 補充檔，等 E284 與 E291）是改版第 3 波，本波結案時排進下一波建議。
- backlog done-mark 與佇列 DONE。

## 合併順序
`integ/post-v4-w6` ← `--no-ff` e329 → merge-invariants → `--no-ff` e284 → merge-invariants → `--no-ff` e291 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w6` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git pull --ff-only` → `git branch -d integ/post-v4-w6`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## Dispatch pins
- e284：`sr-engineer=opus`。
- e329：`sr-engineer=opus`。
- e291：`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-17 | 人類 | v4.8.0 發版後 fan-out 第 6 波：照整合者建議三條 lane（e284、e329、e291）；繼續做 integrator 改版，不回佇列頂端；`cutApprovalAutoTier.manifest` 本波不開；v4.8.0 release-engineer 回報的 `pull.rebase` 發現建票 | 整合者 session |
| 2026-10-17 | 整合者 | 草案：e284（E284＋E331＋E330＋E332＋E333）∥ e329（E329＋E328＋E334＋E327，唯一 content lane）∥ e291（E291＋E335）；三條擁有集合不相交；`bin/agc-init.mjs` 劃給 e291；`docs/lane-protocol.md`（§3、§4）劃給 e329；`docs/config.md` 劃給 e291；`test/e296-manifest-tier.test.mjs` 只限 AC12 劃給 e284；`test/e246-mailbox-teardown.test.mjs` 只限句子重新固定劃給 e329；E294 本波不做 | 本檔 |
| 2026-10-17 | 整合者 | E336 配號（backlog 列＋佇列 #153），來源為 v4.8.0 release-engineer 的回報（primary handoff pending_notes），不屬任何 lane 檔 | 本檔 |
| 2026-10-17 | 人類 | 核准本清單（全部）：三條 lane（e284、e329、e291）與六項所有權重劃；E294 本波不做 | 整合者 session |
| 2026-10-17 | 整合者 | 清單 PR #21 merge `902462e` = 派工 base；派工前核對：三條 lane 點名的擁有／禁止路徑在 base 存在或標為新建、無殘留 branch／worktree、`owners --range` 可用；信箱 e284／e329／e291 空建、mailbox-watch 與 lane-status watch 皆 armed；三份 prompt 以 `fanout.mjs render --base 902462e` 產生 | 本檔 |
| 2026-10-17 | 整合者 | 三條 cut 預審 close：e291（`e4ea650`，一次通過）、e329（`cec96d7`；退回一次：條件 2 的 exit 2 改寫成 usage／manifest／git 錯誤，全套 proof 包 test-lock）、e284（`2a3e3b3`；退回一次：R2 補上 primary 在 integ 分支上的結案註記與 merge 後以 sha 驗證的 MOVED） | 信箱 e284／e329／e291 |
| 2026-10-17 | 人類 | 在三條 lane 各自的 session 核准 cut：e291（`e4ea650`）、e329（`cec96d7`，D1–D3 一併接受）、e284（`2a3e3b3`，R1＝(a)、R2＝(a)） | lane session；各 lane spec 與 handoff commit |
| 2026-10-17 | 人類 | opus 週額度用完時不改用 fable，照舊用 opus：遇到 429 重試一次，再被擋就暫停等重置。e329 曾把「continue」解讀成可換 tier 而加了 `code-reviewer=fable`，人類在 lane session 確認後移除（`5bdff14`，fable 審查未留任何證據），改用 opus 重審 | 整合者 session；lane session（e329 `5bdff14`） |
| 2026-10-17 | 人類 | 本波 qa-engineer 用 opus：e284、e291 的 `dispatch_pins` 帶 `qa-engineer=opus`（起因是整合者轉達時把「不要換成 fable」寫成「所有角色照舊用 opus」，已更正）；e329 的 qa 用預設 sonnet | 整合者 session |
| 2026-10-17 | 人類 | e291：E335 的 `--abandoned` 重跑缺口在本 lane 一起修（修訂 cut `03f2133`）；Node 20 的修正（修訂 cut `0709431`，D8、AC-E335-7）也在本 lane 修 | lane session；e291 `a93dbb0`、`7910cee` |
| 2026-10-17 | 整合者 | 接受的偏離：e291 D7 改為 refresh 與 preserve 兩處共用 helper（spec 已補記）；e291 `868b28d` 在審查後只改註解（qa 已註明）；e284 primary 列的 clean／dirty 排除清單檔，與 git status 事實同一規則（reviewer 記入證據）；e291 PM 手改一次未勾選 task 行（已揭露，工具缺口立為 E340） | 信箱 e284／e291 |
| 2026-10-17 | 整合者 | 5a：e329 `0b39648`（run 39033629359）close；e291 `cc4ae03` 退回 —— run 39035552502 的 test (20) 紅（AC-E335-6 (a)(b)，Node 20 的 `cpSync` 不能把 link 蓋過同名 link），修正後 `cf29621`（run 39045233532，test (20)／test (22) 皆綠）close；e284 `e7d43fa`（run 39036891542）close，qa 第 1 輪 FAIL 只因 spec 範例的家目錄名被路徑檢查擋下，第 2 輪 PASS | 本檔 |
| 2026-10-17 | 整合者 | 5b：`integ/post-v4-w6` ← e329 `d4855e4` ← e284 `ec6697b` ← e291 `047a652`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 三次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39045490708 在 `047a652` 綠；finish 三 lane 配號 E337（e329）、E338、E339（e284）、E340（e291） | 本檔 |
| 2026-10-17 | 人類 | 使用者層級的 teamwork 子代理改用 opus（第 5 波待決項）；repo 範本 `templates/claude-code-agents/` 的 pm／teamwork 預設維持 sonnet（新使用者的預設，不是落後） | 整合者 session |

## 結案
- 日期 2026-10-17。`integ/post-v4-w6` ← e329（`d4855e4`）← e284（`ec6697b`）← e291（`047a652`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 三次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39045490708 在 `047a652` 綠。
- 彙總（上限按 lane 計）：e329 5 張 task／hop 4/14／review 0 輪／qa 0 輪；e284 6 張 task／hop 6/14／review 0 輪／qa 退回 1 輪（spec 範例文字）；e291 8 張 task（cut 修訂兩次）／hop 11/14／review 0 輪／qa 0 輪，但 qa PASS 被 CI 的 Node 20 job 推翻一次。
- 完成定義 14 項全部成立（本清單自己的 `## 接手步驟` 為最後一項，由 e284 剛出貨的 `fanout.mjs handoff --closing` 產生事實欄位 —— 這是工具的第一次實戰使用）。
- 例外：(1) opus 週額度在派工後約 20 分鐘用完，三條 lane 各停一次，人類裁定照舊用 opus、不換 fable；(2) e291 的 qa PASS 在本機 Node 22 成立、在 CI Node 20 失敗 —— 本機與 CI 的 Node 版本不同，lane 在本機用 Node 20 跑全套時，共用的 node_modules（為 Node 22 編譯）會讓 SQLite 測試失敗，Node 20 的定論以 CI 為準；(3) 三條 lane 的 sr、reviewer 都是 opus，e284、e291 的 qa 也是 opus（同模型疑慮，各審查報告已註明）；(4) 記帳 commit `12ef68b` 的一格表格沒跳脫 `|`，由 `c4e6fcb` 修正（不改寫歷史）。
- 新票：E337（e329）、E338、E339（e284）、E340（e291），由 `finish --shipped` 配號，排在佇列 #154–#157；E336（整合者配號，規劃時）在 #153。
- 下一波建議：integrator 改版第 3 波 —— content lane E285（SOP 引用 `fanout.mjs handoff`、接手模式；可帶 E294 的 lane-protocol §1 那一半）；程式 lane E289（render 補充檔，原本等的 E284、E291 都已出貨）＋ E337 ＋ E338 ＋ E339（同為 `tools/fanout-manifest.ts`）。E336（`pull --ff-only` 寫法，動憲法 §6）要人類先裁定寫法，再進 content lane。E340 是 `tw_*` 工具票，可獨立一條。
- 發版：`main` 帶 E284（`fanout.mjs handoff` 新指令）、E291（新設定 key `nodeModulesLinks`）、E331／E330／E332／E333／E335（修正）、E329／E328／E334／E327（SOP 與 lane-protocol）→ 建議 MINOR v4.9.0，由人類決定。

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 902462e
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v4-w6 @ c4e6fcb）
- lane-status：primary（main ← integ/post-v4-w6 @ c4e6fcb）release-post-v4-w5／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 第 6 波三條 lane（e329、e284、e291）已合併、finish、拆除；lane 紀錄在 `.current/history/2026-10/`，記帳與本清單在同一個 wave PR。
- 未配號的新發現：無（四筆都已配號 E337–E340）。
### 待人類決定
- 是否發版（建議 MINOR v4.9.0）。
- 下一波範圍（建議見「結案」）。
- E336 的寫法（`git -c pull.rebase=false pull --ff-only`，或 `git fetch` 加 `git merge --ff-only origin/main` —— 後者要改憲法 §6 的授權）。
- v4.8.0 回報的 9a 逾時與 CI 警告問題要併進 E82 還是另開票（整合者建議併進 E82）。
### 進行中的背景工作
無
