# Fan-out: prompt-audit-w7（content 字句 lane：E409＋E411 ∥ 模板 lane：E412，各一條 mini-chain；E414 裁維持、直接結案）
base: aa2609a    integration branch: integ/prompt-audit-w7
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類已核准（2026-11-05，待人類裁定 1–6 全照建議），Stage 3 派工中。** E414 裁「三項維持」：不開 task，整合者 5c 結案。

範圍由人類指定（integrator prompt：「fan-out E409 + E411 + E412 + E414」，2026-11-05）：`docs/prompt-audit-2026-11-02.md` 在 v4.19.2＋w6 之後剩下的四張票（佇列 #224 E409、#226 E411、#227 E412、#229 E414），都帶待人類裁定的選項，在 Stage 2 一次問完、裁定寫進本清單 Decisions，lane 不再問。兩條 lane、各自 mini-chain（PM cut → sr-engineer → code-reviewer → qa-engineer，無 architect）：四票都是字句／模板描述，沒有介面契約要定。本波不改 gate 程式、routing 表、schema、錯誤碼、`tools/**`、`prompts/**`、`dist/**`、`scripts/**`、`bin/**`、`content/coord-*.md`（coord-05 點名行除外）。E414 裁「維持」就不開 task、整合者在 5c 直接結案。

- **E409 的內容**（`docs/backlog.md` E409 列）：`content/skill-coordinator-lite.md` 第 16 行 Hard rules「Server-read-only」把 `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task` 四個都寫成 server-rejected；規劃時核對 `tools/tasks.ts`：只有 `tw_complete_task`（第 71–72 行 `enforcePreFlight` ＋ `requireQaEngineer`）與 `tw_update_state`（無 `agent_id` → `AGENT_ID_REQUIRED`）真的被伺服器擋；`handleAddTask`（第 94–95 行）、`handleRollbackTask`（第 80–81 行）、`handleVoidTask`（第 88–89 行）只跑 `enforcePreFlight`，lite 呼叫過 `tw_get_state` 後會接受。選項 (a) 只改第 16 行字句（server-rejected 只留兩個、其餘標 SOP-forbidden）＋重釘 `test/e391-prompt-audit-stale-facts.test.mjs` 第 73–77 行 AC-G2-11（逐字釘「`` `tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden. ``」與 `will be rejected` = 0）；(b) 給兩個 handler 加 agent gate（行為變更，動 `tools/`、`dist/`，要 architect、自己一條 lane）。第 16 行不在任何 golden（規劃時 grep：12 個 golden 無「Server-read-only」），但 lite skill 在 lean bundle（958 ~tok）→ lean 上限 5723、今日 5675、餘 48；新字句淨字數要量。`templates/claude-code-agents/lite.md` 第 9 行已由 E408 改為引 SOP 禁令，與 (a) 一致、不動。`tw_void_task` 同樣只跑 pre-flight、未列在第 16 行：是否順手列入由 PM 在 cut 裡決定（可選，不是本票 AC）。
- **E411 的內容**（`docs/backlog.md` E411 列）：`content/const-01-core-head.md` 第 1 行 `# Constitution v3.41.0 <!-- versioned independently of package.json -->`，內文 origin tag 已到 v3.104.0，沒有任何步驟 bump 它。選項 (a) `scripts/release.mjs prepare` 加「`content/const-*.md` 自上個 tag 有變但標頭沒 bump 就停」（動 `scripts/`、full chain、自己一條 lane）；(b) 標頭改成 `# Constitution`（拿掉版本與註解），放寬測試、憲法變更只由 CHANGELOG 記錄；(c) 綁 `package.json`。**讀標頭的站點（規劃時 grep，排除 golden、backlog、CHANGELOG、稽核文件）**：`test/constitution-deliverable-guard.test.mjs` 第 62–72 行 A3（`/^# Constitution v3\.\d+\.\d+/` ＋ 不是 v3.14.1）、`test/e393-builder-judge-core.test.mjs` 第 138 行（`head.startsWith("# Constitution v3.41.0")`）、`test/prompt-state-footer.test.mjs` 第 421／429／433／463／483 行（五處 `/^# Constitution v/m`，三處正向、兩處反向，都要改成不帶 `v` 的標頭 regex）；標頭在 12 個 golden 的 11 個（`constitution-monolith.txt`、`build-*.txt` 八檔、`hook-*.txt` 兩檔；`skill-coordinator-monolith.txt` 不含）。`prompts/`、`bin/`、`lib/`、`tools/`、`scripts/` 沒有任何程式讀標頭形狀。`specs/release-sop-history.md` 第 48 行「If a release requires a constitution-version bump… route back to PM」在 (b) 之後變成無對象的句子，歷史文件、不動（記在 Decisions）。預算：(b) 標頭變短，四個憲法上限全部淨負。
- **E412 的內容**（`docs/backlog.md` E412 列）：`templates/claude-code-agents/qa-visual.md`（10 行）與 `qa-engineer.md` 只差 `name`、`description` 與「lazy-loading qa-visual when Visual Baselines are present」一句。選項 (a) 留模板：`description` 改成「qa-engineer 的視覺子派工，獨立 judge context」類的句子、第 9 行說明何時用它；`content/coord-05-core-visual-drift.md` 第 5 行「When dispatching `qa-visual` (subagent-dispatch tool or `tw_switch_role`)」補一句何時選 `qa-visual` 而不是 `qa-engineer`（design-armed、Visual Baselines 存在時的視覺 verdict）；(b) 退役模板（`test/subagent-templates.test.mjs` 第 33–46 行 EXPECTED_ROLES 12→11、第 48–62 行 SKILL_MAP 的 `qa-visual` 列、coord-05 第 5 行改派 qa-engineer、const-11 第 10 行的 verdict 擁有者名稱保留）。**票面「五個讀 qa-visual.md 的測試」核對後是讀 `content/skill-qa-visual.md`（qa-visual-skill-split、pixel-perfect-visual-compare、widget-shape-spec、e393、skill-evolution-v3.11），不是模板**；(a) 不動 `content/skill-qa-visual.md`，所以這五個測試不受影響；讀模板的只有 `test/subagent-templates.test.mjs`（frontmatter 三鍵、`model:` 鏡射 `skill-qa-visual.md` 的 `recommended_model`、body 第一行 `CRITICAL:` 逐字、body 含 `tw_switch_role("…")`），`description` 改字不觸發重釘。**(a) 會動 `content/coord-05`（整合者 prompt 說「不碰 content/」是不完整的）**：coord-05 只進 `skill-coordinator-monolith.txt` 一個 golden 與 teamwork bundle（上限 21715、今日 21398、餘約 317），與 e409 lane 的檔案在檔案層級不重疊（e409 不碰 coord-*、不碰 coordinator monolith golden）。README 第 105 行「Lazy sub-mode of qa-engineer; inherits its tier.」與 (a) 一致、不動（README 在共同禁止）。
- **E414 的內容**（`docs/backlog.md` E414 列）：三項純政策裁決——G1-01 `const-01` 第 23–29 行（§1 標題「Zero Tolerance」、NO YAPPING、Banned phrases、Silent execution、≤ 15 words）；G1-02 12 份模板第一行 `CRITICAL: End every reply with …`（`test/subagent-templates.test.mjs` 第 370–385 行逐字釘第一行；`test/e404-release-engineer-template.test.mjs` 第 16 行、`test/feature-lease.test.mjs` 第 1571／1663 行、`test/release-staging.test.mjs` 第 354／856／924 行逐字釘 release-engineer 那一行）；G1-03 `const-15` 第 39–43 行 §7（Think first、Goal-driven、Read before write 泛用；Fail loud、Surface conflicts 有專案語意）。`test/context-budget.test.mjs` 第 59 行 UNIVERSAL_MARKERS 與第 802 行釘「NO YAPPING」字串；`test/eval-assertions.test.mjs` 第 179 行附近讀 banned list。裁「維持」→ 零檔案、整合者 5c 結案；裁任一項「軟化／移除」→ 併入 e409 lane（同為 const-* 與 golden），且 **改字句前先跑 `npm run eval`** 留基準，改後再跑一次比對（D4 eval 是唯一行為儀器）。
- **同時進行**：兩條 lane 平行。primary 狀態是 v4.19.2 發版後的收尾狀態（release-cd-v4.19.2／release-engineer／In_Progress），與本波無關。

## 派工前核對（整合者，2026-11-05，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`git status` 乾淨；`git fetch --prune` 後 `main` = `origin/main` = `aa2609a`（PR #90，w6 結案）。遠端沒有任何 `feat/*`、`integ/*`、`docs/*`、`release/*`（三個過期 remote-tracking ref 已 prune）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。tag `v4.19.2` = `3e08859`，E410／E413 done-mark、not yet released。
- `.current/.config.json`：`artifacts: "repo"`、`host: "claude-code"`、`cutApprovalAutoTier` 是 `{}` → cut 由人類在各 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。`agc check` OK（4.19.2）。Node 22；CI 在 `aa2609a` 綠（`verify-release.mjs --ci-check`）。
- **共享生成物依檔案切給兩條 lane**（addendum §2：`content/**`、golden、`test/context-budget.test.mjs`）：e409 擁有 `const-01`、lite 與 11 個憲法 golden；e412 擁有 `coord-05` 與 `skill-coordinator-monolith.txt`；`test/context-budget.test.mjs` 兩條都禁止（上限不提高，E397）。兩條 lane 都影響 teamwork bundle（e409 淨負、e412 可能淨正），合併後由整合層 `npm test` 核對。
- **預算（上限都不提高，E397 的題目）**：lean 5723（今日 5675，餘 48；E409 的 lite 第 16 行在 lean）、stripped constitution 10598（10466）、non-design 8501（8466）、teamwork 21715（21398）、skill-pm 4849（4847，本波不動 skill-pm）。
- **會動的 golden**：e409 ← const-01 第 1 行 → 11 檔（`skill-coordinator-monolith.txt` 不變）；e412 ← coord-05 第 5 行 → `skill-coordinator-monolith.txt` 一檔。每條 lane 跑 `node scripts/capture-constitution-golden.mjs` 後只 commit 自己擁有的 golden 檔（其餘應 byte-identical；不是就停、寄信）。
- **釘住站點的測試**（規劃時 grep；站點清單用 occurrence 層級規則、排除清單寫明——w6 教訓）：e409：`test/e391-prompt-audit-stale-facts.test.mjs`（第 73–77 行）、`test/constitution-deliverable-guard.test.mjs`（第 62–72 行）、`test/e393-builder-judge-core.test.mjs`（第 138 行）、`test/prompt-state-footer.test.mjs`（第 421／429／433／463／483 行）、`test/compose-equivalence.test.mjs`、`test/e90-golden-capture-completeness.test.mjs`、`test/skill-manifest.test.mjs`（golden byte-identity）、`test/render-structure.test.mjs`、`test/context-budget.test.mjs`（預期不變）、`test/teamwork-lite.test.mjs`（預期不變）。e412：`test/subagent-templates.test.mjs`（預期不變）、`test/e403-lean-dispatch-alias.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`（coord 側，預期不變）。
- **工具**：`scripts/fanout.mjs`、`mailbox-watch.mjs`、`lane-status.mjs`、`merge-invariants.mjs`、`test-lock.mjs`、`verify-release.mjs --ci-check`、`capture-constitution-golden.mjs`、`measure-context-cost.mjs` 都在 base 上。
- **schema**：不升版。task id：`T-E409-NN`、`T-E411-NN`、`T-E412-NN`（E414 若裁改：`T-E414-NN`，在 e409 lane）。

### 待人類裁定（Stage 2，2026-11-05）
整合者建議在前；每項都影響 lane 的 cut，派工前問一次，之後 lane 不再問。

1. **E409**：(a) 只改 lite 第 16 行字句＋重釘 e391 AC-G2-11，或 (b) 給 `handleAddTask`／`handleRollbackTask` 加 agent gate（行為變更、full chain、自己一條 lane）。建議 **(a)**；lite 本來就是 SOP 約束為主，(b) 要定義 lite 的 agent_id 語意、動 tools/ 與 dist/，不值一張 P3。
2. **E411**：(a) release.mjs prepare 加 const-* 變更對標頭的檢查、(b) 拿掉標頭版本並放寬四個測試檔、(c) 綁 package.json。建議 **(b)**；少一個會爛的數字，CHANGELOG 已逐版記錄憲法變更。
3. **E412**：(a) 留 `qa-visual.md`，補 description 與 coord-05 何時選它；(b) 退役（EXPECTED_ROLES 12→11、coord-05 改派 qa-engineer）。建議 **(a)**；獨立 subagent name 就是獨立 judge context 的保證，design 鏈最需要它。附帶修正：(a) 會動 `content/coord-05` 一行（prompt 裡「不碰 content/」不成立），檔案層級仍與 e409 不重疊，可平行。
4. **E414** 逐項（G1-01 §1、G1-02 模板 CRITICAL、G1-03 §7）：維持／軟化／移除。建議 **三項都維持**、直接結案；要改任何一項就先跑 `npm run eval` 留基準，併入 e409 lane。
5. **lane 數**：二條平行（e409 = E409＋E411［＋E414］∥ e412 = E412），或一條（cheapest：三票一個 cut、一輪 review＋QA，~6 檔）。建議 **二條**（人類提出的分法；e412 檔案極少、可早收）；要併成一條則 e412 的擁有集併入 e409、Lanes 表刪一列。
6. **Dispatch pins**：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`；本波無 architect。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值；文件、spec 裡不得出現個人路徑、內部連結。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task。mini-chain：PM 以 backlog 票列＋本清單的站點集合與 Decisions 裁定為 spec 來源寫 cut，不經 architect；PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 每一站改前對現行檔案重新核對行號；PM 在 cut 裡附試套後的預算數字（e409：lean、stripped constitution、non-design、teamwork；e412：teamwork）與 golden 變動清單。
- 跑 `capture-constitution-golden.mjs` 之後只 commit 自己擁有的 golden 檔；其他 golden 有差 → 停、寄信。
- 不 push、不 merge、不發版、不刪 worktree、不跑 Release workflow；hop 用完 → `type: escalate`。
- 共同禁止：`.github/**`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/prompt-audit-2026-11-02.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`README.md`、`AGENTS.md`、`.antigravityrules`、`CLAUDE.md`、`qa_reports/archive/**`、`review_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`.current/_primary/**`、`index.ts`、`tools/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`bin/**`、`dist/**`、`scripts/**`、`test/context-budget.test.mjs`、`content/skill-qa-visual.md`、`content/skill-qa-engineer.md`、`content/**` 點名檔的點名行以外、`templates/**` 點名檔以外、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/dependency-advisories.md`。需要動禁止檔 → 寄信，整合者裁或轉人類。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e409 | E409＋E411 | feat/e409-lite-wording-const-header | ../agent-governance-mcp-lanes/e409 | `content/skill-coordinator-lite.md`（只限第 16 行）、`content/const-01-core-head.md`（只限第 1 行；E414 若裁改再加第 23–29 行）、`content/const-15-core-tail.md`（只限第 39–43 行，E414 裁改時才有）、`test/fixtures/compose-golden/**`（`skill-coordinator-monolith.txt` 除外）、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/constitution-deliverable-guard.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/prompt-state-footer.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e90-golden-capture-completeness.test.mjs`、`test/skill-manifest.test.mjs`、`test/render-structure.test.mjs`、`test/teamwork-lite.test.mjs`、`test/eval-assertions.test.mjs`（E414 裁改時才有）、`test/e409-*.test.mjs`、`test/e411-*.test.mjs`、`test/e414-*.test.mjs`（新，qa 定名）、`specs/e409-*.md`、`.current/e409/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/coord-*.md` 整個；`content/**` 其他檔與點名站點以外的行；`templates/**`；`test/fixtures/compose-golden/skill-coordinator-monolith.txt`；`test/subagent-templates.test.mjs` | 做：lite 第 16 行 server-rejected／SOP-forbidden 分開寫、e391 AC-G2-11 重釘；const-01 第 1 行改 `# Constitution`、deliverable-guard A3／e393 第 138 行／prompt-state-footer 五處 regex 重釘、11 個 golden 重抓、四個預算重量。不做：提高任何上限（E397）、qa-visual 模板與 coord-05（E412）、release.mjs（E411 (a)）、tools/ handler gate（E409 (b)）、E414 除非 Decisions 裁改 | 無 |
| e412 | E412 | feat/e412-qa-visual-template | ../agent-governance-mcp-lanes/e412 | `templates/claude-code-agents/qa-visual.md`、`content/coord-05-core-visual-drift.md`（只限第 5 行，必要時第 5–6 行的同一句）、`test/fixtures/compose-golden/skill-coordinator-monolith.txt`、`test/subagent-templates.test.mjs`、`test/e403-lean-dispatch-alias.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/e412-*.test.mjs`（新，qa 定名）、`specs/e412-*.md`、`.current/e412/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**` 其他檔與 coord-05 第 5 行以外；`templates/claude-code-agents/` 其他 11 檔；`test/fixtures/compose-golden/` 其他 11 檔；`content/const-11-design-chain-32.md`（verdict 擁有者名稱不動） | 做：qa-visual.md description 與第 9 行改成「qa-engineer 的視覺子派工、獨立 judge context」並說何時用它；coord-05 第 5 行補何時選 qa-visual 而非 qa-engineer；coordinator monolith golden 重抓；teamwork 預算重量。不做：退役模板（E412 (b)）、改 `skill-qa-visual.md`／`skill-qa-engineer.md`、改 const-11、改 README 第 105 行 | 無 |

## 所有權重劃（相對於預設）
- **`content/**` 從共同禁止移出，依檔案切給兩條 lane**：e409 = `skill-coordinator-lite.md` 第 16 行、`const-01` 第 1 行（＋E414 裁改時的 const-01 §1、const-15 §7 行）；e412 = `coord-05` 第 5 行。`content/coord-*.md` 其餘仍禁止。
- **golden 依檔案切**：`skill-coordinator-monolith.txt` → e412；其餘 11 檔 → e409。`test/context-budget.test.mjs` 兩條都禁止（上限不動）。
- **`templates/**` 從共同禁止移出一檔**：`templates/claude-code-agents/qa-visual.md` → e412；其餘 11 個模板仍禁止（E414 裁改 G1-02 時才重劃給 e409，屆時 `test/subagent-templates.test.mjs` 也要移給 e409、e412 改為禁止——若發生，Decisions 加一列再派工）。
- `test/prompt-state-footer.test.mjs`、`test/constitution-deliverable-guard.test.mjs`、`test/e393-builder-judge-core.test.mjs` 劃給 e409（E411 (b) 的標頭 regex 重釘）。
- `test/subagent-templates.test.mjs` 劃給 e412 作預期不變／紅了才重釘。
- **`tools/**`、`dist/**`、`scripts/**` 在共同禁止**（E409 (b)、E411 (a) 若被選中，那張票改 full chain、自己一條 lane，本清單重寫）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| lite 第 16 行只把 `tw_update_state`／`tw_complete_task` 寫成 server-rejected，`tw_add_task`／`tw_rollback_task`／`tw_switch_role` 寫成 SOP-forbidden；`will be rejected` 仍為 0；lean 上限 5723 內 | e409（E409） | ✓ |
| `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-11 重釘到新字句 | e409（E409，qa） | ✓ |
| `const-01` 第 1 行為 `# Constitution`（無版本、無註解）；四個憲法組合的第一行一致；11 個 golden 重抓；`skill-coordinator-monolith.txt` 不變 | e409（E411） | ✓ |
| deliverable-guard A3、e393 第 138 行、prompt-state-footer 五處 regex 改成不帶 `v` 的標頭形狀，仍能區分「含完整憲法」與「不含」 | e409（E411，qa） | ✓ |
| 四個憲法預算（lean、stripped、non-design、teamwork）綠且上限不動 | e409（qa） | ✓ |
| `qa-visual.md` description 與 body 說明它是 qa-engineer 的視覺子派工、何時選它；frontmatter 三鍵與 `model: sonnet` 不變；`CRITICAL:` 第一行不變；`tw_switch_role("qa-engineer")` 不變 | e412（E412） | ✓ |
| coord-05 第 5 行說何時派 `qa-visual` 而非 `qa-engineer`；`skill-coordinator-monolith.txt` 重抓；teamwork 上限 21715 內 | e412（E412） | ✓ |
| `test/subagent-templates.test.mjs` 12 個模板仍綠（EXPECTED_ROLES 不動） | e412（qa） | ✓ |
| E414 三項裁決寫進 Decisions；裁「維持」→ done-mark 註明「ruled keep, no edit」；裁改 → e409 的 task 與 eval 前後數字 | 人類裁定 → 整合者（5c）或 e409 | ✓ |
| `dist/` 無差異；`check:bookkeeping` 在各 lane HEAD exit 0；`npm audit --audit-level=high` exit 0 | e409、e412（qa 核對） | ✓ |
| E409、E411、E412、E414 done-mark；佇列 #224、#226、#227、#229 勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- `integ/prompt-audit-w7` ← `--no-ff` e409（golden 11 檔、憲法）→ merge-invariants → ← `--no-ff` e412 → merge-invariants。預期零衝突（檔案層級不重疊）。
- 合併後 `npm run build` 確認 `dist/` 無差異；全套（整合層 CI）要證明 teamwork bundle 在兩條 lane 的淨效果下仍 ≤ 21715、`capture-constitution-golden.mjs` 對合併樹 byte-identical（兩條 lane 各抓一半 golden，合併後要一致；不一致 → 派 qa 重抓一次並解釋每個 hunk）。
- `npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- backlog done-mark（E409、E411、E412、E414）與佇列 DONE（#224、#226、#227、#229）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- 給下次發版的 CHANGELOG 提示：lite Hard rules 改成只把真正被伺服器擋的兩個工具寫成 server-rejected；憲法標頭不再帶版本號（憲法變更只由 CHANGELOG 記錄）；qa-visual 模板 description 說明它是 qa-engineer 的視覺子派工、coordinator SOP 說何時選它；E414 三項維持（或列出裁改）；golden 重抓、上限不動；無行為變更，建議 PATCH。

## 合併順序
1. `integ/prompt-audit-w7` ← `--no-ff` e409，跑 merge-invariants。
2. `integ/prompt-audit-w7` ← `--no-ff` e412，跑 merge-invariants。
3. `npm run build`（`dist/` 無差異）、`capture-constitution-golden.mjs` byte-identical、跑 `check:bookkeeping`。
4. 在 integ 上依序 `finish e409 --shipped --base integ/prompt-audit-w7`、`finish e412 --shipped --base integ/prompt-audit-w7`。
5. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
6. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/prompt-audit-w7`。

## Dispatch pins
- e409：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e412：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-05 | 人類 | 本波範圍：E409＋E411＋E412＋E414（integrator prompt「fan-out E409 + E411 + E412 + E414」）；四票進本里程碑由此裁定；發版不在本波 | 整合者 session |
| 2026-11-05 | 人類 | 核准清單與待人類裁定 1–6 全部照整合者建議（「approve, 全照建議」）：E409 取 (a)；E411 取 (b)；E412 取 (a)（含 coord-05 第 5 行）；E414 三項（G1-01／G1-02／G1-03）維持、不改字句、不跑 eval、整合者 5c 結案；二 lane 平行（e409 = E409＋E411、e412 = E412）；pins 如 Dispatch pins。這些寫進各 lane 的 spec，lane 不再問 | 整合者 session |
| 2026-11-05 | 整合者 | 規劃核對修正三處票面／prompt 事實：(1) E412 (a) 會動 `content/coord-05` 第 5 行與 `skill-coordinator-monolith.txt`（prompt 說「不碰 content/」不成立），檔案層級仍與 e409 不重疊；(2) E412 票面「五個讀 qa-visual.md 的測試」實際讀 `content/skill-qa-visual.md`，(a) 不動它們；讀模板的只有 `test/subagent-templates.test.mjs`；(3) E411 (b) 除票面三處外還要重釘 `test/prompt-state-footer.test.mjs` 五處 `/^# Constitution v/m`。草案：二 lane 平行，e409 = E409＋E411（＋E414 若裁改）、e412 = E412；待人類裁定 1–6 見上 | 本檔 |
