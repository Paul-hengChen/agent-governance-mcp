# Fan-out: prompt-audit-w4（兩 lane：E403＋E407 content 側；E395＋E404 CLAUDE.md／模板側）
base: 4343909    integration branch: integ/prompt-audit-w4
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准 2026-11-04，派工中。**

範圍由人類指定（整合者 prompt：「fan-out E395 + E403 + E404，G2-17 一併」，2026-11-04）：`docs/prompt-audit-2026-11-02.md` 在 E391（v4.16.1）、E393（v4.17.0）、E392／E394（v4.18.0）之後剩下的可做項。E395（佇列 #210）、E403（#219）、E404（#220）已開票；G2-17a/b/c/e 無票，整合者依 5c-1 開 **E407**（佇列 #222，緊跟 E403）。兩條 lane 都是 mini-chain（PM cut → sr-engineer → code-reviewer → qa-engineer，無 architect）：字句、模板、golden／budget 重釘，沒有介面契約要定。本波不改 gate 程式、routing 表、schema、錯誤碼、`tools/**`、`prompts/**`、`dist/**`、`scripts/**`。

- **E403 的內容**（`docs/backlog.md` E403 列）：`content/coord-03-core-fallback.md` 第 1 行 fallback 句在 lean 組合裡點名 coord-02 才定義的 `Task` 別名。選項：(a) coord-03 改成 host 中性字句（「no subagent-dispatch tool」類）；(b) 別名定義搬進 core 片段。釘住它的 `test/e96-dispatch-preference.test.mjs`（t-fallback-genuine-unavailability、t-fallback-self-contained）隨之改；golden 重抓、teamwork／lean 預算重量。
- **E407 的內容**（`docs/backlog.md` E407 列，整合者本波開票）：報告 G2-17 四處憲法↔skill 逐字重述 → 觸發條件＋具名引用：(a) `coord-05` Drift Reconcile 段重述 `const-12` R10；(b) lite 第 20 行 Hop cap-exempt 重述 Limits 表與 §5；(c) `skill-qa-engineer.md` 第 13 行 ownership 條重述 §3；(e) `skill-integrator.md` 第 38 行權限表重述 §6 grant。報告第 5 節有 (b)(c)(e) 與 coord-05 的 hunk 草案，字句由 lane 定。G2-17d 的 skill 半邊不在本波（見 Decisions）。
- **E395 的內容**（`docs/backlog.md` E395 列）：`CLAUDE.md` 正文會腐爛的數字（第 126／158 行「229 test files」、第 50 行「35 entries」、第 91 行「35 gate definitions」）；Layout 漏列的 4.x `tools/` 模組（規劃時核對：`comment-*.ts` 十檔、`dispatch-log.ts`、`evidence-lookup.ts`、`fanout-handoff.ts`、`fanout-manifest.ts`、`feature-rollup.ts`、`hygiene-scan.ts`、`join-precondition.ts`、`lane-migrate.ts`、`lane-registry.ts`、`lane-ticket-allocation.ts`、`merge-invariants.ts`、`tasks-lane-migrate.ts`；`fanout-*.ts` 一列已概括兩個）；E391 reviewer F1：第 163 行「latest `qa_reports/archive/release-*/`」改成「most recent release」的寫法。
- **E404 的內容**（`docs/backlog.md` E404 列；報告 G2-17d 替代 hunk）：`templates/claude-code-agents/release-engineer.md` 瘦身到其他 11 份模板的形狀：保留 frontmatter、第 7 行 CRITICAL 浮水印、第 9 行 SOP 載入句、RELAY 段落（`test/subagent-templates.test.mjs` e9a AC2 逐字釘住）；第 11 行（舊 step 8a「Stage explicitly」「Pre-commit verify」）、第 13 行（舊 step 3a）、第 15／17／21 行（§3／§6／record-integrity 的重述）、第 23 行（`driftBaselineIds`，E394 後由 `scripts/release.mjs` 做）依 E394 後的 SOP 重寫或刪除；範例尾綴 `(opus)`。
- **同時進行**：無其他 lane。本波中途若發版（人類觸發 Release workflow），runner 動 `package.json`、`CHANGELOG.md`、adapter 戳記（含 `CLAUDE.md` 的 `agc-version` 行）、`docs/backlog.md`、`qa_reports/archive/**`、`.current/_primary/**`。**`CLAUDE.md` 的戳記行與 e395 正文改動同檔不同行**：合併時可能需要逐 hunk 解；e395 不碰戳記行與 adapter 區塊。

## 派工前核對（整合者，2026-11-04，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`git status` 乾淨；`git fetch --prune` 後 `main` = `origin/main` = `4343909`（PR #76，v4.19.0 post-release bookkeeping）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示，已知、不處理）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary 狀態：`active_feature` release-cd-v4.19.0、`last_agent` release-engineer、`next_role` pm（v4.19.0 發版後收尾狀態；整合者不寫狀態）。遠端無 `feat/e395*`、`feat/e403*`、`integ/prompt-audit-w4`。
- `.current/.config.json`：`artifacts: "repo"`、`host: "claude-code"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。`agc check` OK（4.19.0）。
- **共享生成物只在 e403**（addendum §2：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。e395 不碰任何 `content/**`：E404 讀 `content/skill-release-engineer.md` 的步驟編號，但不改它。
- **lean 預算零餘裕**：`test/context-budget.test.mjs` AC2 上限 5723 ~tok（E336 重設，註記 zero headroom）。E403 的 coord-03 是 core 片段，改句若加字會紅；E407 (a) 把 coord-05 Drift Reconcile 段縮成一段、(b)(c)(e) 都是縮短 → 淨負。兩票同 lane 的理由就在這裡：qa 最後一次重量時兩者一起算，不得以提高上限收尾（提高上限是 E397 的題目，不在本波）。
- **釘住 e403 站點的測試**（規劃時 grep）：`test/e96-dispatch-preference.test.mjs`（coord-03 第 1 行兩個 disjunct 的 regex）、`test/e178a-integrator-role.test.mjs` AC1（權限表）、`test/e393-builder-judge-core.test.mjs`（coord-05 的 §3 引用，不在 Drift Reconcile 段）、`test/skill-manifest.test.mjs`（片段清單）、`test/render-structure.test.mjs`（結構 ratchet）、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、golden 12 檔。Hop cap-exempt、ownership 條、Drift Reconcile 內文：無逐字 pin。
- **釘住 e395 站點的測試**：`CLAUDE.md` — `test/e178a-integrator-role.test.mjs` AC5 釘住四句 prompt 計數（「12 registered role prompts」「Twelve prompts are registered」「the other ten」「the other 11 role SOPs」，**e395 不動這四句**，因為該測試檔劃給 e403）；`test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-03／13／15／24 與「changed sections add no literal gate-definition or pass counts」（E395 刪數字、加列，預期不用改；要改只能改 CLAUDE.md 斷言）。模板 — `test/subagent-templates.test.mjs`（第一行 CRITICAL、`HAIKU_ROLES` 不含 release-engineer、e9a AC2 RELAY 段逐字）、`test/e166-template-defers-staging.test.mjs`（模板不自列 staging 清單、skill 有 prepare step 12）、`test/feature-lease.test.mjs` S4（模板鏡像 re-baseline 提示 ≤ 2 句）。
- **`CLAUDE.md` 的 adapter 區塊**（「## Agent Governance」「## Execution Profile」）由 `agc init` 從 `templates/agent-adapters/claude.md` 再生，`agc check` 比對 `agc-version` 戳記 → e395 只改正文，不碰區塊與戳記。
- **工具**：`scripts/fanout.mjs`、`mailbox-watch.mjs`、`lane-status.mjs`、`merge-invariants.mjs`、`test-lock.mjs`、`verify-release.mjs --ci-check`、`capture-constitution-golden.mjs` 都在 base 上；`docs/lane-protocol.md` 與 addendum 都已追蹤。
- **schema**：不升版。憲法標頭（`const-01` 第 1 行 `v3.41.0`）不動：本波不加規則，只刪重述與改引用（G2-14 的 bump 規則不在本波）。task id：`T-E403-NN`、`T-E407-NN`（e403）、`T-E395-NN`、`T-E404-NN`（e395）。不重用前波 id。

### 待人類裁定（Stage 2，2026-11-04）
整合者建議在前；每項都影響 lane 的 cut，派工前問一次，之後 lane 不再問。

1. **E403 選項**：(a) coord-03 host 中性字句，或 (b) 別名定義搬 core。建議 **(a)**：零 lean 預算成本、不動 coord-02；(b) 會把只對 Claude Code 成立的 `Agent` 名字塞進所有宿主的組合，正是 E392 把它放進 host 片段的理由。
2. **E407 (e) integrator 權限表的形狀**：報告 hunk 把「cannot」格縮成「§6 禁止的每個 git 動詞」。建議 **照 hunk**：`gh pr merge --squash/--rebase/--admin`、`--amend` 都已在 §6 grant 內文，表裡只留 §6 沒有的項（`tw_update_state`、寫 lane 的 `.current/<lane>/`、寫 feature code／test）。
3. **E404 保留哪些段**：建議保留 frontmatter、CRITICAL 浮水印、SOP 載入句（加一句「Hard rules 與步驟在 SOP，這裡不重述」）、RELAY 段逐字、**一句** re-baseline 提示指向新 SOP 第 5 步（讓 `feature-lease` S4 不必重釘）、範例尾綴 `(opus)`；其餘刪。`e166` 的「不自列 staging」斷言刪段後仍成立；qa 只重釘真的紅掉的。
4. **G2-17d skill 半邊**：建議 **判定已由 E394 關閉**，不入本波：`content/skill-release-engineer.md` Hard rules 現在以名引用 §6／§3，剩下的「never force-push；tags immutable」是 release 專屬規則，不是重述。
5. **E395 的數字範圍**：建議 **只處理票面點名的**（test files、35 gates ×2、Layout 補列、F1 字句）；「thirteen `tw_*` tools」「18-step」「12 prompts」不在票面，且後者被 e178a 釘住，不擴。
6. **Dispatch pins**：兩 lane 都 `pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`（與 e391／e405 同）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值；文件、spec 裡不得出現個人路徑、內部連結。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task。本波兩 lane 都走 mini-chain：PM 以 backlog 列＋報告第 3／5 節為 spec 來源寫 cut，不經 architect；PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 報告第 5 節的 diff 沒有按 finding 標 hunk，且含已出貨的 hunk；lane 只套用本清單點名的站點，套每個 hunk 前對現行檔案重新核對。
- 不 push、不 merge、不發版、不刪 worktree、不跑 Release workflow；hop 用完 → `type: escalate`。
- 共同禁止：`.github/**`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/prompt-audit-2026-11-02.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`README.md`、`AGENTS.md`、`.antigravityrules`、`qa_reports/archive/**`、`review_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`.current/_primary/**`、`index.ts`、`tools/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`bin/**`、`dist/**`、`scripts/**`、`templates/agent-adapters/**`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/dependency-advisories.md`；`content/**`、`CLAUDE.md`、`templates/claude-code-agents/**` 依 Lanes 表劃分，對方 lane 的檔禁止。需要動禁止檔 → 寄信，整合者裁或轉人類。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e403 | E403＋E407 | feat/e403-lean-dispatch-alias | ../agent-governance-mcp-lanes/e403 | `content/coord-03-core-fallback.md`（只限第 1 行 fallback 句）、`content/coord-05-core-visual-drift.md`（只限 Drift Reconcile 段）、`content/skill-coordinator-lite.md`（只限第 20 行 Hop cap-exempt）、`content/skill-qa-engineer.md`（只限第 13 行 ownership 條）、`content/skill-integrator.md`（只限第 38 行權限表第一列）、`content/coord-02-host-dispatch.md`（只限裁定 1 取 (b) 時的第 1 行；取 (a) 不動）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e96-dispatch-preference.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/skill-manifest.test.mjs`、`test/render-structure.test.mjs`、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、`test/e164-e167-content.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/e403-*.test.mjs`、`test/e407-*.test.mjs`（新，qa 定名）、`specs/e403-*.md`、`specs/e407-*.md`、`.current/e403/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`CLAUDE.md`、`templates/**`、`test/subagent-templates.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/feature-lease.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`（e395 的）；`content/**` 其他檔與點名站點以外的行 | 做：E403 字句、E407 四站點、golden 重抓、lean／teamwork 預算重量、e96／e178a 等重釘。不做：提高 budget 上限（E397）、憲法標頭 bump（G2-14）、G2-17d、其他 flag-only 項 | 無 |
| e395 | E395＋E404 | feat/e395-claude-md-template-tail | ../agent-governance-mcp-lanes/e395 | `CLAUDE.md`（只限正文：What this repo is、Layout、Testing changes；adapter 區塊「## Agent Governance」「## Execution Profile」與 `agc-version` 戳記不動；e178a AC5 釘住的四句 prompt 計數不動）、`templates/claude-code-agents/release-engineer.md`、`test/subagent-templates.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/feature-lease.test.mjs`（只限 S4 斷言）、`test/e391-prompt-audit-stale-facts.test.mjs`（只限 `CLAUDE.md` 斷言）、`test/e395-*.test.mjs`、`test/e404-*.test.mjs`（新，qa 定名）、`specs/e395-*.md`、`specs/e404-*.md`、`.current/e395/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**` 整個（E404 只讀 `content/skill-release-engineer.md` 的步驟編號）；`test/fixtures/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e96-dispatch-preference.test.mjs`（e403 的）；其他 11 份模板 | 做：CLAUDE.md 票面點名的數字、Layout 補列、F1 字句；模板瘦身與重釘。不做：adapter 區塊、戳記、其他模板、`content/**` | 無 |

## 所有權重劃（相對於預設）
- **`content/**` 從共同禁止移出，劃給 e403，只限五檔的點名行**：addendum §2 的共享生成物（`content/**`、golden、budget 測試）本波只在 e403。
- **`CLAUDE.md` 從共同禁止移出，劃給 e395，只限正文三段**：adapter 區塊與 `agc-version` 戳記仍禁止（`agc init`／`agc check` 的面）；e178a AC5 的四句不動。
- **`templates/claude-code-agents/release-engineer.md` 從共同禁止移出，劃給 e395**：其他 11 份模板與 `templates/agent-adapters/**` 仍禁止。
- **`test/e178a-integrator-role.test.mjs` 劃給 e403**（它同時讀 `CLAUDE.md` 與 `skill-integrator.md`）：e395 以不動 AC5 四句換取不需要它。
- **`test/e391-prompt-audit-stale-facts.test.mjs` 劃給 e395**（它同時讀 `CLAUDE.md` 與 content）：e403 改的 lite 第 20 行、qa 第 13 行不是它釘的行（16／49、60／95／101）；若 e403 仍需要，寄信。
- **`test/feature-lease.test.mjs` 只開 S4 一個斷言給 e395**；其餘斷言不碰。
- **`scripts/**`、`.github/**` 回到共同禁止**（e405 的重劃不延續）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| coord-03 第 1 行在 lean 組合裡不再點名未定義的 `Task`；claude-code 組合語意不變 | e403（E403） | ✓ |
| `test/e96-dispatch-preference.test.mjs` 重釘到新字句；golden 12 檔重抓；lean 與 teamwork 預算斷言綠、上限不提高 | e403（E403＋E407，qa） | ✓ |
| coord-05 Drift Reconcile 段、lite Hop cap-exempt、qa ownership 條、integrator 權限表第一列：觸發條件＋具名引用，不再重述機制 | e403（E407） | ✓ |
| `test/e178a-integrator-role.test.mjs` AC1、`e393`、`render-structure` 等重釘 | e403（E407，qa） | ✓ |
| `CLAUDE.md` 正文不再帶 test-file 數與 35 gate 數；Layout 列出規劃時核對的 4.x `tools/` 模組；F1 字句 | e395（E395） | ✓ |
| `test/e391-prompt-audit-stale-facts.test.mjs` 的 CLAUDE.md 斷言綠（必要時重釘） | e395（E395，qa） | ✓ |
| `templates/claude-code-agents/release-engineer.md` 與其他 11 份同形；RELAY 段逐字保留；尾綴 `(opus)`；不再引用舊 SOP 步驟 | e395（E404） | ✓ |
| `test/subagent-templates.test.mjs`、`e166`、`feature-lease` S4 綠（必要時重釘） | e395（E404，qa） | ✓ |
| `dist/` 無差異；`check:bookkeeping` 在 lane HEAD exit 0 | 兩 lane（qa 核對） | ✓ |
| E395、E403、E404、E407 done-mark；佇列 #210、#219、#220、#222 勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- `integ/prompt-audit-w4` ← `--no-ff` e403（共享生成物 lane 先）→ merge-invariants → ← `--no-ff` e395 → merge-invariants。預期零衝突（擁有集合不相交）；唯一同檔風險是本波中途發版改了 `CLAUDE.md` 戳記行，逐 hunk 解。
- `npm run build` 確認 `dist/` 無差異（兩 lane 都不改 `.ts`）；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- backlog done-mark（E395、E403、E404、E407）與佇列 DONE（#210、#219、#220、#222）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- 給下次發版的 CHANGELOG 提示：content 四站點改為引用（組合輸出變短）、coord-03 lean 字句、CLAUDE.md 數字、release-engineer 模板瘦身；無行為變更。

## 合併順序
1. `integ/prompt-audit-w4` ← `--no-ff` e403，跑 merge-invariants。
2. ← `--no-ff` e395，跑 merge-invariants。
3. `npm run build`（`dist/` 應無差異），跑 `check:bookkeeping`。
4. 在 integ 上依序 `finish e403 --shipped --base integ/prompt-audit-w4`、`finish e395 --shipped --base integ/prompt-audit-w4`。
5. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
6. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/prompt-audit-w4`。

## Dispatch pins
- e403：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e395：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-04 | 人類 | 本波範圍：E395＋E403＋E404，G2-17 一併（整合者 prompt「fan-out E395 + E403 + E404，G2-17 一併」）；G2-17 進本里程碑由此裁定 | 整合者 session |
| 2026-11-04 | 整合者 | 開票 E407（G2-17a/b/c/e，5c-1 授權，完整票面在 `docs/backlog.md`，佇列 #222 緊跟 E403）；G2-17d 的 skill 半邊判定已由 E394 關閉（待人類裁定 4 確認）、模板半邊即 E404。草案：兩 lane mini-chain，e403 = E403＋E407（content、golden、budget），e395 = E395＋E404（CLAUDE.md 正文、模板）；重劃見上。待人類裁定 1–6 見上 | 本檔 |
| 2026-11-04 | 人類 | 核准清單與待人類裁定 1–6 全部照整合者建議（「approve」）：E403 取 (a)；E407 (e) 照 hunk；E404 保留清單如裁定 3；G2-17d skill 半邊不入本波；E395 只處理票面數字；pins 如 Dispatch pins。這六項寫進 lane 的 spec，lane 不再問 | 整合者 session |
