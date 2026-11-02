# Fan-out: prompt-audit 第 1 波（單 lane：E391 content/ 與 CLAUDE.md 過時事實、懸空引用）
base: d519a45    integration branch: integ/e391-prompt-audit
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：規劃中 2026-11-02。** `base:` 是規劃基準（E391–E394 開票的 PR #58 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

範圍由人類指定：只做 E391（PR #58 開票，來源 `docs/prompt-audit-2026-11-02.md`）。單一 lane，不與其他票並行：E393 依賴 E391 的字數餘裕，E392／E394 另開波次。本波是純文字修正，不改任何 gate、routing、schema、錯誤碼。

- **E391 的內容**：報告第 3 節的 G2-02、G2-04、G2-05、G2-06、G2-07、G2-08、G2-11、G2-12、G2-18、G2-26（`content/` 十筆）＋ G2-03、G2-13、G2-15、G2-24（`CLAUDE.md` 四筆）。報告第 5 節的 diff **沒有按 finding 標 hunk**，而且同一份 diff 也含 E392／E393／E394 的 hunk；lane 只套用下表點名的站點，其餘一律不碰。sr-engineer 套每個 hunk 前要對現行檔案重新核對。

## 派工前核對（整合者，2026-11-02，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示，已知、不處理）。PR #58 merge 之後：`main` = `origin/main` = `d519a45`，工作區只有 `.current/_primary/` 兩個 session 檔與未追蹤的開票草稿（不進 repo）。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **E391 的站點（整合者 2026-11-02 逐一核對現行檔案）**：
  - G2-02 `content/skill-release-engineer.md` 第 292 行「`gates/registry.ts` (33 gate definitions)」→ `GATE_REGISTRY` 是 35（`CLAUDE.md` 第 43、97 行；CHANGELOG 4.16.0）。只改這一行；同檔第 130–137 行的敘事 hunk 是 E394 的，不碰。
  - G2-04 `content/constitution-rationale.md` 第 173–174 行「max 10 role transitions」→ `const-01` Limits 表與 `tools/transitions.ts` 第 326 行 `HOP_CAP = 14`；改成以 cap 名稱引用。
  - G2-08 同檔第 3、15 行引用 `content/constitution.md`（已拆成 15 片）與兩個釘死版本（`(v3.27.0)`、`Rationale target: v3.32.0`）。
  - G2-05 `content/skill-design-auditor.md` 第 71 行「max 5 files read per surface (constitution §5)」→ Limits 表 `read` cap = 3；改成具名引用（假設 auditor 沒有獨立額度；若 PM 認定要獨立額度，先停下來寄信，因為那會動 `const-01` 的 Limits 表）。
  - G2-07 同檔第 89 行「`skill-pm` step 2a-bis」→ `skill-pm.md` 沒有 2a-bis，對應的是 Gate Summary 表的 Geometric-Density Split Gate 列。
  - G2-06／G2-18 `content/const-08-chain-31-mid.md` 第 2 行「`skill-coordinator.md` stop-condition 6」→ coordinator SOP 的 stop conditions 已是 `## Escalation Routes` 表，對應段落是 `coord-03` 的 **Cut-approval gate writer obligation**；同檔第 2、4 行的 `skill-coordinator.md`／`skill-pm.md` 檔名式引用改成裸名（憲法其他處的慣例）。同檔第 12 行「Round 4 of `review_round`」是 E393 的，不碰。
  - G2-08 `content/skill-doc-writer.md` 第 13 行的禁改清單寫 `content/constitution.md` → 改成 `content/const-*.md`、`content/coord-*.md`（現行檔案）。
  - G2-11 `content/skill-coordinator-lite.md` 第 16 行「`tw_switch_role` … will be rejected」→ `tools/role.ts` 沒有 lite 判斷，伺服器只拒絕四個寫入工具；改成「SOP 禁止」。
  - G2-18 同檔第 49 行的 `skill-coordinator.md` 檔名式引用改裸名。同檔第 20 行 Hop cap-exempt 的重述是 G2-17b，不在 E391，不碰。
  - G2-12 `content/skill-qa-engineer.md` 第 60 行「Read `content/skill-qa-visual.md`」（同類：第 95、101 行；`content/skill-qa-visual.md` 第 24 行以 `content/skill-qa-engineer.md` 作路徑）→ `content/` 在 agc 安裝目錄、不在 adopter workspace，改成 `<agc install>/content/…` 的慣例（`skill-integrator.md` 第 68 行、`skill-pm.md` 第 112 行的寫法）。同檔第 13、66、92、113 行是 G2-17c／G2-21（E393），不碰。
  - G2-26 `content/const-15-core-tail.md` 第 6 行「See `skill-coordinator` §Auto-Routing for the full stop-condition list」→ 表在 `coord-03` 的 `## Escalation Routes`。
  - G2-03 `CLAUDE.md` 第 159 行「(1633/1633 at v3.94.0)」→ 改成指向每次 release 的 review 檔，不再寫數字。
  - G2-13 `CLAUDE.md` 第 191 行「(~18.7KB)」→ 今日實測 `node bin/agent-governance-context.mjs | wc -c` = 27,194；改成不會腐爛的寫法（量級或指向量測指令）。
  - G2-15 `CLAUDE.md` 第 181–182 行「It does NOT touch git. Commit/PR workflow is out of scope.」→ 伺服器**工具**不碰 git 是對的；commit／PR 流程由憲法 §6 與 release／integrator SOP 治理。改寫，不刪。
  - G2-24 `CLAUDE.md` Layout：`lib/` 漏 `render-boundary.ts`；漏 `tools/lane-paths.ts`、`tools/fanout-*.ts`、`tools/lane-status.ts`；第 134 行 `check-version.mjs` 的說明漏 dist parity／CHANGELOG／lockfile。補列，不重排。
- **會被擊中的測試**：改 `content/**` 一定要重抓 `test/fixtures/compose-golden/**`（golden 內含「stop-condition 6」與「§Auto-Routing for the full stop」字串）並讓 `test/context-budget.test.mjs` 過（lean bundle 上限 5723 ~tok 目前零餘裕；本票淨字數應為負，qa 在 cut 裡記下前後量測，用 `node scripts/measure-context-cost.mjs`）。其他可能釘住字句的測試（qa 在 cut 裡逐檔核對、列名）：`test/constitution-deliverable-guard.test.mjs`、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、`test/design-auditor-volume-guard.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/agc-adapters.test.mjs`（讀 `CLAUDE.md` 的 adapter 區塊，本票不動該區塊）、`test/e234-hygiene-scan.test.mjs`、`test/e258b-comment-scan.test.mjs`。
- **不在本波**：E392（模板、`coord-02`、`coord-04`、adapter）、E393（§3.2 搬 core、round cap 具名、`const-06`、`const-12`、`coord-05`）、E394（`skill-release-engineer.md` 重寫、`skill-integrator.md` 的 G2-17e）。報告裡所有 flag-only 項（G1-*、G2-14、G2-19、G2-20、G2-23、G4-01）。
- **共享生成物**：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` 全部歸 e391（單 lane）。
- **`CLAUDE.md` 從共同禁止移出，劃給 e391，只限 Layout、Testing changes、What this server does NOT do、Governance context loading 四段**；`agc init` 生成的 adapter 區塊（「## Agent Governance」「## Execution Profile」）與 `agc-version:` 戳記不碰。
- **`dist/`**：本票不改任何 `.ts`，`npm run build` 後 `dist/` 應無差異；有差異就是越界。
- **schema**：不升版。
- task id：`T-E391-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。golden 重抓由 qa 執行並逐 hunk 說明。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔與每個 finding 對應的站點。本票走 mini-chain：PM 寫 cut（以 backlog 列＋報告第 3 節為 spec 來源），不經 architect。PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/prompt-audit-2026-11-02.md`（報告是來源，不是修改對象）、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`、`docs/dependency-advisories.md`、`docs/agc-ticket-draft-wc32.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e391 | E391 | feat/e391-prompt-audit-stale-facts | ../agent-governance-mcp-lanes/e391 | `content/const-08-chain-31-mid.md`（只限第 2、4 行的引用）、`content/const-15-core-tail.md`（只限第 6 行）、`content/constitution-rationale.md`、`content/skill-coordinator-lite.md`（只限第 16、49 行）、`content/skill-design-auditor.md`（只限第 71、89 行）、`content/skill-doc-writer.md`（只限禁改清單）、`content/skill-qa-engineer.md`（只限第 60、95、101 行的路徑）、`content/skill-qa-visual.md`（只限第 24 行的路徑）、`content/skill-release-engineer.md`（只限第 292 行的 gate 數）、`CLAUDE.md`（只限 Layout、Testing changes、What this server does NOT do、Governance context loading 四段）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/constitution-deliverable-guard.test.mjs`、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、`test/design-auditor-volume-guard.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/e391-*.test.mjs`、`specs/e391-*`、`qa_reports/*E391*`、`review_reports/*E391*`、`.current/e391/**`；其他被本 lane 改變字句釘住的測試檔，cut 裡逐檔列名、預審核對 | 其他 `content/**`（含 `coord-*.md`、`const-06`、`const-12`、`skill-integrator.md`、`skill-pm.md`、`skill-sr-engineer.md`、`skill-code-reviewer.md`）、擁有檔案中點名行以外的段落、`templates/**`、`tools/**`、`gates/**`、`dist/**`、`bin/**`、`scripts/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`、共同禁止的全部項目 | 做：報告第 3 節 E391 名下的 14 個 finding，每個對應「派工前核對」點名的站點；每個 hunk 套用前對現行檔案重新核對事實（gate 數、cap 值、檔名、章節名）；`content/**` 改完由 qa 重抓 golden、逐 hunk 說明、量 context budget 前後值；`CLAUDE.md` 的數字改成不會腐爛的寫法。硬條件：不改任何 gate、routing、schema、錯誤碼；不動 `coord-*.md`；`dist/` 無差異；`agc check` 的戳記不動；lean bundle 不得超過上限；每個 finding 在 spec 裡對應一個 AC 與一個實作 task。　不做：報告 diff 中屬 E392／E393／E394 的 hunk；G2-17 任何重述的合併；flag-only 項目；新增 Limits 表列（若 G2-05 需要，停下來寄信）。 | 無 |

## 所有權重劃（相對於預設）
- 單 lane，擁有集合不相交的條件自動成立。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）歸 e391。
- **`CLAUDE.md` 從共同禁止移出，劃給 e391，只限四段正文**（Layout、Testing changes、What this server does NOT do、Governance context loading）；adapter 區塊與戳記不動。
- `content/**` 內只開放點名的檔案與點名的行；同檔其他段落屬 E393／E394，禁止。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `content/` 十筆（G2-02/04/05/06/07/08/11/12/18/26）的過時事實與懸空引用修正，每筆對應現行檔案核對過 | e391（E391） | ✓ |
| `CLAUDE.md` 四筆（G2-03/13/15/24）修正，數字改成不會腐爛的寫法 | e391（E391） | ✓ |
| compose-golden 重抓、每個 hunk 有說明；context budget 前後值記在 qa 報告，lean bundle 未超上限 | e391（qa） | ✓ |
| 被改變字句釘住的測試重新固定，其他測試全綠不改；`dist/` 無差異 | e391（qa） | ✓ |
| E391 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 單 lane：`integ/e391-prompt-audit` ← `--no-ff` e391，跑 `merge-invariants`；`npm run build` 確認 `dist/` 無差異；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。E393 的「依賴 E391」在 E391 合併後解除。

## 合併順序
1. `integ/e391-prompt-audit` ← `--no-ff` e391，再跑 merge-invariants。
2. `npm run build`（`dist/` 應無差異），跑 `check:bookkeeping`。
3. 在 integ 上 `finish e391 --shipped --base integ/e391-prompt-audit`。
4. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
5. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/e391-prompt-audit`。

## 結案
- 日期 2026-11-02。`integ/e391-prompt-audit` ← e391 `5b27a16`（merge `34bd318`），`--no-ff`、零衝突 → 無合併審查；merge-invariants PASS；重建 `dist/` 無差異；`check:bookkeeping` OK；`npm audit --audit-level=high` exit 0；整合層 CI run 41397788105 在 `34bd318` 綠。
- 彙總（上限按 lane 計）：e391 7 張 task／hop 4/14／review 0 輪退回／qa 0 輪；證據與 `completed_tasks` 一致。
- 完成定義：6 項全部成立。
- 例外：(1) sr 與 code-reviewer 都是 opus（同模型疑慮，比照前幾波）。(2) 全套 3851/3853，2 skipped（既有的 skip）。(3) lane 回報 `covers:` 證據檔命名引發 `EXPECTED_RED_DIFF_MISSING`，未重現，開 E396。
- 新發現：E395（e391，finish 配號）、E396（整合者）排在佇列 #210–#211；E391–E394 補進佇列 #206–#209（開票時漏排）。
- 發版：`main` 帶 E391（`content/` 九檔的點名行、`CLAUDE.md` 四段、11 個 compose-golden、一個測試重釘、一個新 AC 測試）。adopter 可見：無行為變更；design-auditor SOP 的每 surface 上限改為引用 Limits 表的 `fix_try`／`read`（2／3，原文寫 3／5）。是否發版與版號由人類決定。

## Dispatch pins
- e391：`pm=opus`、`sr-engineer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-02 | 人類 | 第 1 波範圍：只做 E391（PR #58 開票，來源 `docs/prompt-audit-2026-11-02.md`）。人類回覆「先 fan-out E391」 | 整合者 session |
| 2026-11-02 | 整合者 | 草案：單 lane e391，mini-chain（PM cut、無 architect）。重劃：`CLAUDE.md` 從共同禁止移出、劃給 e391，只限四段正文。範圍限定：報告 diff 未按 finding 標 hunk，lane 只套用「派工前核對」點名的站點；同檔其他 hunk（E393 的 round cap、E394 的敘事）禁止。G2-05 若需要獨立額度，lane 停下來寄信 | 本檔 |
| 2026-11-02 | 人類 | 核准本清單（全部）：單 lane e391、mini-chain、`CLAUDE.md` 四段正文重劃、報告 diff 只套用點名站點、G2-05 預設具名引用（需獨立額度則寄信）。人類回覆「approve，E391 照清單派工」 | 整合者 session |
| 2026-11-02 | 整合者 | 清單 PR #59 merge `664e147` = 派工 base；派工前核對：lane 點名的擁有／禁止路徑與工具在 base 都存在，14 個站點的現行字句與清單一致（G2-15 站點在現行第 180 行）；沒有殘留 e391 branch／worktree；信箱 e391 已建空檔，mailbox-watch 與 lane-status watch 都已 armed；prompt 以 `fanout.mjs render --base 664e147` 產生。此列隨記帳 commit 進 integ | 本檔 |
| 2026-11-02 | 整合者 | e391 cut 預審第一輪（spec `be3abe7`，to-lane#1）：check --cut exit 0（7 tasks）；每條 AC 都有實作 task。同意四項偏離：預算導向的較短字句且 `test/context-budget.test.mjs` 上限不下修（餘裕留給 E393）；G2-15 改成「工具不寫 git、部分會讀」（報告 hunk「never run git」是錯的，`tools/feature-rollup.ts` 跑 `git worktree list`，不採用）；G2-05 用清單預設、lane 呈給人類時須明說行為效果（auditor 每 surface 上限變成 2 次嘗試／3 次讀取）；CLAUDE.md 不留任何數字。重劃（整合者裁定）：G2-12 擴及 `skill-qa-engineer.md:59` 與 `skill-qa-visual.md:65`（同一 finding、同一機械改法、同一擁有檔案），E391-NEW-1 因此撤銷；E391-NEW-3 不開票（只是對一次性報告的註記，記在此列） | 信箱 e391 |
| 2026-11-02 | 整合者 | e391 cut 預審 close（spec `023eaa8`，lane HEAD `d412b4f`，to-lane#2）：check --cut exit 0（7 tasks）；G2-12 擴及六處、T-E391-03 作廢改 T-E391-08、E391-NEW-1／NEW-3 撤銷、E391-NEW-2 保留。lane 呈給人類時附 G2-05 行為效果；核准在 lane session 親手打字 | 信箱 e391 |
| 2026-11-02 | 人類 | 在 e391 lane session 核准 cut（spec `023eaa8`），含 G2-05 行為效果（design-auditor 每 surface 上限改為 `fix_try`／`read` 的值）與 G2-15 改寫（工具不寫 git、部分會讀） | e391 lane session；`specs/e391-prompt-audit-stale-facts.md`，commit `023eaa8`（`cut_approved` 見 lane 的 handoff，尚未 commit） |
| 2026-11-02 | 整合者 | e391 code review 一輪 APPROVED（`review_reports/review_T-E391-01.md`，commit `a5acd54`；sr 四個 task commit `c06cbd8`、`9ffa4ef`、`d2376fa`、`a081f20`）。選修註記三則只記錄：F1 `CLAUDE.md` 指「最新的 release 證據資料夾」帶 `suite-result:` 是按日期而非按名稱排序成立；F2 AC-G2-24 的刪除行計數是 4 不是 3（含 G2-13 那行，已授權）；F3 G2-13 行未換行（spec 允許） | 信箱 e391（to-integrator#5） |
| 2026-11-02 | 整合者 | 5a：e391 `5b27a16`（CI run 41397320316）close —— review、qa 都一輪通過（review 0 輪退回、qa 0 輪）；39 檔都在擁有範圍內；content/ 只動點名行、CLAUDE.md 只動四段；11 個 compose-golden 重抓（三個字串）、qa-visual-skill-split :87 重釘、新增 AC 測試；`dist/` 零差異；budget lean 5722/5723、stripped 10593/10598、teamwork 21588/21715、non-design 8495/8501。全套 3851/3853（2 skipped）。新發現 E391-NEW-2 等 finish 配號；F1 字句併入其後續；lane 回報 `covers:` 證據檔不叫 `review_<task-id>.md` 時 PASS 被 `EXPECTED_RED_DIFF_MISSING` 拒絕，疑似伺服器缺陷，由整合者在 5c 開票 | 本檔 |
| 2026-11-02 | 整合者 | 5b：`integ/e391-prompt-audit` ← e391 `5b27a16`（merge `34bd318`），`--no-ff`、零衝突 → 無合併審查；merge-invariants PASS；重建 `dist/` 無差異；`check:bookkeeping` OK；`npm audit --audit-level=high` exit 0；整合層 CI run 41397788105 在 `34bd318` 綠 | 本檔 |
| 2026-11-02 | 整合者 | 5c／6：finish e391 配號 E395；整合者開 E396（covers: 證據檔命名的 PASS 拒絕，未重現）；E391–E396 排進佇列 #206–#211（E391–E394 開票時漏排，此處補上）；E391 done-mark；F1 字句併入 E395 | 本檔 |
