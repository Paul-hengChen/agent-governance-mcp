# Fan-out: prompt-audit-w4（兩 lane：E403＋E407 content 側；E395＋E404 CLAUDE.md／模板側）
base: 4343909    integration branch: integ/prompt-audit-w4
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-04。** 兩 lane 已合併（`integ/prompt-audit-w4` ← e403 `adf6983` merge `7ab9758`、← e395 `e192cd8` merge `b8dc2ea`，零衝突）、finish、拆除；派工 base `1000517`（本清單的 PR #77 merge）。

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
| e403 | E403＋E407 | feat/e403-lean-dispatch-alias | ../agent-governance-mcp-lanes/e403 | `content/coord-03-core-fallback.md`（只限第 1 行 fallback 句）、`content/coord-05-core-visual-drift.md`（只限 Drift Reconcile 段）、`content/skill-coordinator-lite.md`（只限第 20 行 Hop cap-exempt）、`content/skill-qa-engineer.md`（只限第 13 行 ownership 條）、`content/skill-integrator.md`（只限第 38 行權限表第一列）、`content/coord-02-host-dispatch.md`（只限裁定 1 取 (b) 時的第 1 行；取 (a) 不動）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e96-dispatch-preference.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/skill-manifest.test.mjs`、`test/render-structure.test.mjs`、`test/compose-equivalence.test.mjs`、`test/teamwork-lite.test.mjs`、`test/e164-e167-content.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/e336-portable-pull.test.mjs`（只限 AC-E336-1 的 Permissions row 斷言）、`test/e403-*.test.mjs`、`test/e407-*.test.mjs`（新，qa 定名）、`specs/e403-*.md`、`specs/e407-*.md`、`.current/e403/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`CLAUDE.md`、`templates/**`、`test/subagent-templates.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/feature-lease.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`（e395 的）；`content/**` 其他檔與點名站點以外的行 | 做：E403 字句、E407 四站點、golden 重抓、lean／teamwork 預算重量、e96／e178a 等重釘。不做：提高 budget 上限（E397）、憲法標頭 bump（G2-14）、G2-17d、其他 flag-only 項 | 無 |
| e395 | E395＋E404 | feat/e395-claude-md-template-tail | ../agent-governance-mcp-lanes/e395 | `CLAUDE.md`（只限正文：What this repo is、Layout、Testing changes；adapter 區塊「## Agent Governance」「## Execution Profile」與 `agc-version` 戳記不動；e178a AC5 釘住的四句 prompt 計數不動）、`templates/claude-code-agents/release-engineer.md`、`test/subagent-templates.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/feature-lease.test.mjs`（只限 S4、E17-S3、E17-S4、E9A-S5 的模板斷言；skill 斷言不動）、`test/e392-subagent-templates.test.mjs`（只限 AC8）、`test/release-staging.test.mjs`（只限 AC5、C13-AC6／AC7、D10-AC4 的模板斷言）、`test/e391-prompt-audit-stale-facts.test.mjs`（只限 `CLAUDE.md` 斷言）、`test/e395-*.test.mjs`、`test/e404-*.test.mjs`（新，qa 定名）、`specs/e395-*.md`、`specs/e404-*.md`、`.current/e395/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**` 整個（E404 只讀 `content/skill-release-engineer.md` 的步驟編號）；`test/fixtures/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e96-dispatch-preference.test.mjs`（e403 的）；其他 11 份模板 | 做：CLAUDE.md 票面點名的數字、Layout 補列、F1 字句；模板瘦身與重釘。不做：adapter 區塊、戳記、其他模板、`content/**` | 無 |

## 所有權重劃（相對於預設）
- **`content/**` 從共同禁止移出，劃給 e403，只限五檔的點名行**：addendum §2 的共享生成物（`content/**`、golden、budget 測試）本波只在 e403。
- **`CLAUDE.md` 從共同禁止移出，劃給 e395，只限正文三段**：adapter 區塊與 `agc-version` 戳記仍禁止（`agc init`／`agc check` 的面）；e178a AC5 的四句不動。
- **`templates/claude-code-agents/release-engineer.md` 從共同禁止移出，劃給 e395**：其他 11 份模板與 `templates/agent-adapters/**` 仍禁止。
- **`test/e178a-integrator-role.test.mjs` 劃給 e403**（它同時讀 `CLAUDE.md` 與 `skill-integrator.md`）：e395 以不動 AC5 四句換取不需要它。
- **`test/e391-prompt-audit-stale-facts.test.mjs` 劃給 e395**（它同時讀 `CLAUDE.md` 與 content）：e403 改的 lite 第 20 行、qa 第 13 行不是它釘的行（16／49、60／95／101）；若 e403 仍需要，寄信。
- **`test/feature-lease.test.mjs` 開 S4、E17-S3、E17-S4 的模板斷言給 e395**（lane 開工盤點後重劃，整合者 2026-11-04）；skill 斷言不碰。
- **`test/e392-subagent-templates.test.mjs` AC8 與 `test/release-staging.test.mjs` AC5、C13-AC6／AC7、D10-AC4 的模板斷言，以及 `test/feature-lease.test.mjs` E9A-S5 的模板斷言，劃給 e395**（cut 預審再補兩條，整合者 2026-11-04）：三檔都釘住裁定 3 要刪的段落（尾綴、driftBaselineIds 段、STOP-on-⛔ 段、staging 提示），不重釘就無法與其他 11 份同形；e403 不擁有這三檔，不衝突。
- **`test/e336-portable-pull.test.mjs` AC-E336-1 的 Permissions row 斷言劃給 e403**（cut 預審重劃，整合者 2026-11-04）：裁定 2 的第一列不再列舉 `pull --ff-only` on `main`，該斷言釘住這段字；同測試的 Git operations 斷言與 `e297` 的 const-15 斷言不受影響。e395 不擁有此檔。
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

## 結案
- 日期 2026-11-04。`integ/prompt-audit-w4` 自 `main` `1000517` 開；← `--no-ff` e403 `adf6983`（merge `7ab9758`）、← `--no-ff` e395 `e192cd8`（merge `b8dc2ea`），兩次零衝突，無實質合併解決 → 無合併審查；merge-invariants 兩次 PASS（0 lost [x]、134 sidecar）；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；`check:bookkeeping` OK；`agc check` OK；整合層 CI 見 Decisions。`finish e403 --shipped`（配號 E408 commit `e5cfb41`、history commit `4dda996`）與 `finish e395 --shipped`（`2303ecd`）各一次成功：`.current/e403/`、`.current/e395/` → `.current/history/2026-11/`；worktree、信箱、本地 lane branch 都已移除；遠端 `feat/e395-*` 已刪，`feat/e403-lean-dispatch-alias` 的遠端刪除兩次遇 GitHub 500（見待人類決定）。
- 彙總（上限按 lane 計）：e403 8 task／hop 4/14／review 0 輪退回／qa 0 輪；e395 7 task／hop 4/14／0／0；合計 15 task、hop 8（資訊用）；兩 lane 證據與 `completed_tasks` 一致；lane 全套 4012/4014 與 4014/4016（各 2 skipped）。
- 完成定義：表中「同一波 ✓」的列全部成立（coord-03 lean 字句、四站點引用、golden 與預算、CLAUDE.md 數字與 Layout 11 列、模板 13 行同形、重釘全綠、`dist/` 無差異、done-mark 與佇列、本段）。
- 記帳：`docs/backlog.md` E395、E403、E404、E407 done-mark（not yet released）；佇列 #210、#219、#220、#222 DONE；E408（E403-NEW-1，其餘 6 處核心片段 `Task` 字樣）配號、佇列 #223。接線票：無。reviewer 選修共 5 則不開票。
- 給下次發版的 CHANGELOG 提示：coord-03 fallback 句 host 中性（lean 組合不再點名 `Task`）；coord-05 Drift Reconcile、lite Hop cap-exempt、qa ownership 條、integrator 權限表第一列改為引用憲法（組合輸出變短，lean 5711→約 5681）；CLAUDE.md 去掉 test-file 與 gate 計數、Layout 補列 11 個 4.x `tools/` 模組、Testing 字句；release-engineer 模板 23→13 行；無行為變更，建議 PATCH。

## Dispatch pins
- e403：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e395：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-04 | 人類 | 本波範圍：E395＋E403＋E404，G2-17 一併（整合者 prompt「fan-out E395 + E403 + E404，G2-17 一併」）；G2-17 進本里程碑由此裁定 | 整合者 session |
| 2026-11-04 | 整合者 | 開票 E407（G2-17a/b/c/e，5c-1 授權，完整票面在 `docs/backlog.md`，佇列 #222 緊跟 E403）；G2-17d 的 skill 半邊判定已由 E394 關閉（待人類裁定 4 確認）、模板半邊即 E404。草案：兩 lane mini-chain，e403 = E403＋E407（content、golden、budget），e395 = E395＋E404（CLAUDE.md 正文、模板）；重劃見上。待人類裁定 1–6 見上 | 本檔 |
| 2026-11-04 | 人類 | 核准清單與待人類裁定 1–6 全部照整合者建議（「approve」）：E403 取 (a)；E407 (e) 照 hunk；E404 保留清單如裁定 3；G2-17d skill 半邊不入本波；E395 只處理票面數字；pins 如 Dispatch pins。這六項寫進 lane 的 spec，lane 不再問 | 整合者 session |
| 2026-11-04 | 整合者 | 清單 PR #77 merge `1000517` = 派工 base（docs branch `docs/2026-11-04-fanout-prompt-audit-w4` 已刪）；派工前核對在 `1000517` 重做：擁有／禁止的 32 個已追蹤檔都在、golden 12 檔、五個 content 站點行號未變、CLAUDE.md 三個數字站點 4 處命中、`cutApprovalAutoTier` `{}`、遠端無 `feat/e403*`／`feat/e395*`／`integ/prompt-audit-w4`；信箱 `_mailbox/e403/`、`_mailbox/e395/` 建為空、watch armed baseline 0／0；兩份 prompt 由 `fanout.mjs render --base 1000517` 產生 | 整合者 session |
| 2026-11-04 | 整合者 | e395 開工盤點（to-integrator#1）：裁定 3 的瘦身還會紅三個未劃檔 —— `test/e392-subagent-templates.test.mjs` AC8（無尾綴、23 行、末行 driftBaselineIds）、`test/release-staging.test.mjs` AC5 與 C13-AC6／AC7（staging 提示、STOP-on-⛔、driftBaselineIds 逐字）、`test/feature-lease.test.mjs` E17-S3／E17-S4 的模板半邊（record-integrity、push-rejection 段）。整合者核對屬實，取 lane 建議 (a)：三檔的模板斷言劃給 e395，skill 斷言不動；Lanes 表與所有權重劃已改。e403 不擁有這三檔，無衝突 | 信箱 e395 to-lane#1 |
| 2026-11-04 | 整合者 | e395 cut 預審（spec `4966828`，to-integrator#2）：7 task、check --cut 11 token 0 越界、每個 AC 有實作 task。再劃兩條模板斷言給 e395（`release-staging` D10-AC4、`feature-lease` E9A-S5，都釘舊第 17 行 push-rejection 段）。**修正裁定 3 的尾綴項**：其他 11 份模板都沒有範例尾綴（`subagent-templates` v3.21.2 AC2 明文要求 non-haiku 模板不得有、E392 AC8 已把它刪掉），加回 `(opus)` 會與 E404「同形」的目標衝突、還要重釘兩條 → 不加尾綴；AC-E404-1／6 與 T-E404-02 隨之改。要求 lane 修 spec 後再 close | 信箱 e395 to-lane#2 |
| 2026-11-04 | 整合者 | e395 cut 預審 close（spec `ca776f3`，to-integrator#3）：spec diff 只含要求的改動 —— 無尾綴（AC-E404-1 body 4 行／檔 13 行、AC-E404-6 改成無 suffix 行、`subagent-templates` 不動保持綠、e392 AC8 只重釘行數與末行）、D10-AC4 與 E9A-S5 改必做、Decisions 兩列；check --cut 10 token 0 越界；每個 AC 有實作 task（T-E395-01／02、T-E404-01 sr；T-E395-03、T-E404-02／03 qa；T-E395-04 驗證）。lane 的 `.current/e395/tasks.md` 對 T-E404-02／03 的描述留舊字（無工具可改既有 task 描述，E340），以 spec Cut 表為準 | 信箱 e395 to-lane#3 |
| 2026-11-04 | 人類 | 在 e395 lane session 核准 cut（spec `specs/e395-claude-md-template-tail.md` @ `ca776f3`，含無尾綴與兩條追加斷言）；coordinator 寫 cut_approved、next_role sr-engineer；sr（opus）已派 T-E395-01／02、T-E404-01。只影響 e395、已寫在核准的 spec 裡 | e395 lane session；信箱 e395 to-integrator#4 |
| 2026-11-04 | 整合者 | e403 cut 預審（spec `61fcb19`，to-integrator#1）：8 task（5 sr、3 qa）、每個 AC 有實作 task；coord-03 字句取裁定 1 (a)、沿用 coord-02 的名詞「subagent-dispatch tool」；coord-05 採報告 hunk 但刪括號內的機制複述；lite／qa／integrator 逐字照 hunk；PM 試套 lean 5711→5682、teamwork 21515→21401，上限不動，golden 只有 coordinator monolith 變。所有權：`test/e336-portable-pull.test.mjs` AC-E336-1 的 Permissions row 斷言劃給 e403（`e297` 只釘 const-15 與 Git operations，不受影響）。PM 列的其餘 6 處核心片段 `Task` 字樣（coord-03:31/77/88/95、coord-05:5、coord-07:14）不在本波：lane 寫成 pending-ticket block，finish 時配號。要求 lane 把 AC8／T-E407-05 的「grant pending」字樣改掉後再 close | 信箱 e403 to-lane#1 |
| 2026-11-04 | 整合者 | e403 cut 預審 close（spec `481702d`，to-integrator#2）：diff 只含 grant 字樣改寫（AC8、Site map、pin audit、Dependencies、Gate Summary、T-E407-05）與 Out of Scope 指向 pending ticket；新增 `.current/e403/pending-tickets.md` E403-NEW-1（其餘 6 處核心片段 `Task` 字樣，P3，depends E403），finish 時配號；check --cut 8 ticket、11 token、0 越界 | 信箱 e403 to-lane#2 |
| 2026-11-04 | 整合者 | lane e395 進度（to-integrator#5，不需回覆）：sr 完成 `ec66eb0`（CLAUDE.md +16/-5、模板 +2/-12 → 13 行）、handoff `a27f7fa`、`dist/` 無差異、`agc check`／`check:bookkeeping` exit 0；預期紅燈恰為 re-pin 清單 10 條，e391／e178a／subagent-templates 不改即綠；code-reviewer（opus）已派，hop 2/14 | 信箱 e395 to-integrator#5 |
| 2026-11-04 | 整合者 | lane e395 進度（to-integrator#6，不需回覆）：code-reviewer（opus）round 1 APPROVED T-E395-01／02、T-E404-01（`review_reports/review_T-E395-01.md` covers 三個 task，commit `1ed8421`，handoff `1bb1264`）；0 必修、2 選修未改（comment-* 列未寫 language registry；re-baseline 提示未寫 bump kind，SOP 有）；qa（sonnet）已派 T-E395-03、T-E404-02／03、T-E395-04；hop 4/14 | 信箱 e395 to-integrator#6 |
| 2026-11-04 | 人類 | 在 e403 lane session 核准 cut（spec `specs/e403-lean-dispatch-alias.md` @ `481702d`，含 e336 斷言重劃與 E403-NEW-1 pending ticket）；coordinator 寫 cut_approved；sr（opus）已派 T-E403-01、T-E407-01..04，hop 2/14。只影響 e403、已寫在核准的 spec 裡 | e403 lane session；信箱 e403 to-integrator#3 |
| 2026-11-04 | 整合者 | lane e403 進度（to-integrator#4，不需回覆）：sr 完成 `d9e953e`（五個 content 檔 +8/-16、`dist/` 無差異、audit high 0）；targeted 11 檔 174/177，3 個預期紅（e96 t-fallback-genuine-unavailability、skill-manifest golden、e336 AC-E336-1）留給 qa；code-reviewer（opus）已派，hop 2/14 | 信箱 e403 to-integrator#4 |
| 2026-11-04 | 整合者 | lane e403 進度（to-integrator#5，不需回覆）：code-reviewer（opus）round 1 APPROVED（`review_reports/review_T-E403-01.md` covers T-E403-01、T-E407-01..04；commits `4274513`、`215a005`）；非阻擋 3 則：R1 記 expected-red 檔、Q1 qa 條只引用 tw_complete_task（rollback 無憲法條）、Q2 integrator 新列「every … verb §6 forbids」對 gh 選項讀起來偏窄（同列 grant 引用仍涵蓋）；qa（sonnet）已派；hop 4/14 | 信箱 e403 to-integrator#5 |
| 2026-11-04 | 整合者 | e395 lane 層驗證 close（to-integrator#7）：HEAD `e192cd8`，9 commits，hop 4/14，review 0 輪退回、qa 0 輪；fanout check 14 檔 0 越界；worktree porcelain 空；證據 `qa_reports/review_T-E395-04.md`（PASS，covers 七個 task，suite-result 4014/4016）、`review_reports/review_T-E395-01.md`（APPROVED，covers T-E395-01／02、T-E404-01）；handoff PASS、ledger 七個 id；無 pending-tickets；其他 11 份模板、`test/fixtures/**`、`context-budget`、`content/**` 無差異；CLAUDE.md 與模板 diff 逐行核對符合 cut；整合者 push 後 CI run 41811234457 在 `e192cd8` 綠。lane 疑慮 (1) tasks.md 舊描述（E340 類）、(2) qa 略過 Phase 4 crash-checkpoint 寫入（同輪跑完，無風險）、(3) sr／reviewer 同 opus 盲點——記錄不處理。reviewer 2 選修不開票 | 信箱 e395 to-lane#4 |
| 2026-11-04 | 整合者 | e403 lane 層驗證 close（to-integrator#6）：HEAD `adf6983`，9 commits，hop 4/14，review 0 輪退回、qa 0 輪；fanout check 18 檔 0 越界；worktree porcelain 空；證據 `qa_reports/review_T-E403-01.md`（PASS，covers 8 id，suite 4012/4014）、`review_reports/review_T-E403-01.md`（APPROVED，covers T-E403-01、T-E407-01..04，3 optional）；handoff PASS、ledger 8 id；五處 content diff 逐行符合 cut；golden 只有 `skill-coordinator-monolith.txt`，`context-budget`、coord-02、`dist/` 無差異；pending-tickets E403-NEW-1 一筆；整合者 push 後 CI run 41812846155 在 `adf6983` 綠。lane 疑慮：(1) reviewer Q1／Q2 不開票（引用仍涵蓋）；(2) expected-red 未記（Phase 0.5 skipped，紅燈全在 Re-pin survey）；(3) e132 gap-6 計時 flake 一次（E348 同族，load-sensitive），integ 重現再議 | 信箱 e403 to-lane#3 |
| 2026-11-04 | 整合者 | 整合層 CI：run 41813339823 在 merge HEAD `b8dc2ea` 綠（Node 20、22）；記帳 HEAD `c9829d6` 的 run 41813651365 見下一列 | 整合者 session |
| 2026-11-04 | 整合者 | 整合：`integ/prompt-audit-w4` 自 `1000517` 開，← e403 `adf6983`（merge `7ab9758`）、← e395 `e192cd8`（merge `b8dc2ea`），零衝突，merge-invariants 兩次 PASS；`dist/` 無差異、audit 0、`check:bookkeeping` OK、`agc check` OK；整合層 CI 在 `b8dc2ea` 見下一列。finish e403（E408 配號 `e5cfb41`、history `4dda996`）、finish e395（`2303ecd`）；信箱 watch 已停、兩個信箱由 finish 移除。遠端 `feat/e403-lean-dispatch-alias` 刪除：finish 內與一次重試都遇 GitHub Internal Server Error，留給人類或稍後重試（不是半狀態：本地 branch、worktree 都已拆） | 整合者 session |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 1000517
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/prompt-audit-w4 @ 2303ecd）
- lane-status：primary（main ← integ/prompt-audit-w4 @ 2303ecd）release-cd-v4.19.0／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 兩 lane（e403 = E403＋E407、e395 = E395＋E404）已合併、finish、拆除；lane 紀錄在 `.current/history/2026-11/e403/` 與 `.current/history/2026-11/e395/`。記帳與本清單在同一個 wave PR。佇列 #210、#219、#220、#222 至此完成。
- 未配號的新發現：無（e403 的 E403-NEW-1 已由 finish 配為 E408，佇列 #223；e395 無 pending-tickets；reviewer 5 則選修不開票）。
- 本波交付：`content/coord-03-core-fallback.md` 第 1 行 host 中性；`coord-05` Drift Reconcile 段、lite Hop cap-exempt、qa ownership 條、integrator 權限表第一列改為引用憲法；golden `skill-coordinator-monolith.txt` 重抓、預算上限不動；`CLAUDE.md` 去計數、Layout 補 11 列、Testing 字句；`templates/claude-code-agents/release-engineer.md` 23→13 行；四個新測試檔、六個重釘。
### 待人類決定
- 是否發版、版號（content 字句與引用、CLAUDE.md、模板；無行為變更：建議 PATCH → v4.19.1，走 Release workflow `dry_run=true` 再真跑；E395、E403、E404、E407 列帶 `not yet released` 預標）。
- 遠端 branch `feat/e403-lean-dispatch-alias` 的刪除：finish 與一次重試都遇 GitHub 500；要不要再試或留著（本地已拆乾淨，不影響 PR）。
- E408（其餘 6 處核心片段 `Task` 字樣，P3，佇列 #223）排進哪一波。
- `.current/_primary/` 的 primary 狀態仍是 release-cd-v4.19.0／release-engineer／next_role pm（v4.19.0 發版後收尾狀態），由下一個 role 的寫入推進。
### 進行中的背景工作
無
