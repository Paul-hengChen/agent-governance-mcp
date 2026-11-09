# Prompt Audit — 2026-11-02

`/claude-api prompt-audit`，依 `shared/prompt-audit.md` 七步執行。只產出報告與 proposed diff，**未套用任何修改**。

## 0. 範圍、目標模型與跳過項目

**實際稽核範圍**（逐檔全文讀取）：

| 區塊 | 檔案數 | 位元組 |
|---|---|---|
| `content/` | 36（const ×15、coord ×7、skill ×12、partial ×1、constitution-rationale ×1） | 367,369 |
| `CLAUDE.md` | 1（含 `agc init` 生成的 adapter 區塊） | 14,876 |
| `templates/claude-code-agents/` | 12 | 8,684 |
| `templates/agent-adapters/` | 3 | 2,764 |

**目標模型假設**：
- `content/*` 與 `CLAUDE.md`：以 Claude Code 目前跑 agc 角色的模型為準 — 依 skill frontmatter 與模板 pin，`opus` 層的角色（coordinator-dispatched architect / code-reviewer / design-auditor / researcher / sr-engineer / release-engineer / integrator）對應 **Claude Opus 5.5**，`sonnet` 層（pm / qa-engineer / qa-visual / teamwork / coordinator-lite 的 `recommended_model`）對應 **Claude Sonnet 5.5**，`haiku` 層（doc-writer、lite 模板）對應 **Claude Haiku 5.5**。層名依 `coord-02` 定義「永遠解析到該層最新模型」。
- `templates/claude-code-agents/*.md`：各自以 frontmatter `model:` 為準（opus ×6、sonnet ×4、haiku ×2）。
- 範圍內沒有非 Anthropic 供應商標記；`content/` 提到 Cursor / Continue / Anti-Gravity / Gemini Code 只是 MCP 宿主清單，不是模型目標。

**被跳過（未讀、未稽核）**：`dist/`、`test/`、`docs/`（除寫入本報告）、`specs/`、`node_modules/`、`.claude/settings.local.json`（可能含機密）、`.current/*`、`tools/registry.ts` 的工具 `description`（Group 3 因此不適用）、使用者層級 `~/.claude/agents/*.md`（範圍外；`coord-02` 多處指向它）。`specs/`、`test/`、`tools/`、`gates/`、`scripts/`、`bin/`、`CHANGELOG.md`、`qa_reports/` **僅作為事實比對來源**（路徑、常數、gate 數、測試數、CLI 旗標），未對其提出 finding。

**前提（依指示）**：`MUST / NEVER / BLOCKED / WHEN→DO→ELSE` 視為 gate 語意與規範文法；Group 1a 一律標低信心、只進報告不進 diff。憲法 `const-01:4-5`「Skills inherit everything below — they MUST NOT restate these rules」與 `const-01:9`「named numeric limit … never by restating the bare number」被當作可引用的內部一致性規則。

**Provenance 限制**：repo 歷史從 2026-09-28 的 `48fb9fe` 起（squash），所有衝突行的 `git blame` 皆落在同一 commit，無法用歷史排序新舊；方向判斷改以程式碼常數、frontmatter、CHANGELOG 與 `qa_reports/` 為準，並在各 finding 註明。

## 1. 摘要

**三個影響最大的發現**：

1. **`templates/claude-code-agents/teamwork.md:9` 叫 subagent 用 Read 工具載入 `content/skill-coordinator.md`，但這個檔案不存在**（`CLAUDE.md:117` 自己也寫「there is NO skill-coordinator.md」；SOP 是 `coord-01..07` 依 `prompts/skill-manifest.ts` 組合）。以 `teamwork` subagent 身分啟動的 coordinator 會在第一步讀檔失敗。同一個「邏輯檔名當實體路徑」的寫法也出現在 `const-08:2,4` 與 `skill-coordinator-lite.md:49`。
2. **§3.2「builder ≠ judge」在非 design 組合裡不存在，但永遠載入的 coordinator 片段把它當 hard floor 引用。** 實測 `includeSegment` 組合：`{chain, non-design}` 的憲法沒有 `### 3.2` 標題、沒有「Builder ≠ judge」文字（`const-11` 是 `chain-design` tag），但 `coord-03:39`、`coord-05:3`、`coord-07:11`（core）、`coord-02:1`（host）、`CLAUDE.md:226` adapter 全部引用 §3.2。非 design 的 `/teamwork` 每次都載入一條指向不存在章節的硬規則。
3. **數字與版本不同步**：`skill-release-engineer.md:292` 寫 `gates/registry.ts` 有 33 個 gate（實際 35，`CLAUDE.md:43,97` 與 CHANGELOG 4.16.0 皆 35）；`constitution-rationale.md:174` 寫 hop cap 10（Limits 表與 `HOP_CAP` 皆 14）；`skill-design-auditor.md:71` 寫每 surface 最多讀 5 個檔（Limits `read` cap = 3，且它自己引用 §5）；`CLAUDE.md:171` 寫 `1633/1633 at v3.94.0`（最近 release review 記 2453/2453，版本已 4.16.0）；`CLAUDE.md:196` 寫 hook 注入 ~18.7KB（今日實測 27,194 bytes）；`const-01:1` 標頭 `v3.40.0` 自稱「tracks the highest behavior」，但本文已引用到 v3.104.0 / E296 / E385。

**各組計數**：

| Group | 發現數 | 其中進 diff |
|---|---|---|
| 1 Dated prompt text | 3（全部 `flag`，依指示不進 diff） | 0 |
| 2 Brittle config / stale facts / conflicts | 24（High 11、Medium 9、Low 4） | 21 個 finding、27 hunks + 1 替代 hunk |
| 3 Tool descriptions | 不適用（`tools/registry.ts` 在範圍外） | — |
| 4 Request config / architecture | 不適用，唯一適用的 sub-agent roster 檢查產出 1 筆 `flag` | 0 |

## 2. 盤點（Step 1）

- **憲法** `content/const-01..15-*.md`：依 `CONSTITUTION_SEGMENTS` tag（core / design / chain / chain-design）組合；實測組合大小：lite 非 design 16,931 B、chain 非 design 34,877 B、chain design 44,016 B。
- **Coordinator SOP** `content/coord-01..07-*.md`：core 4 片 + `host:claude-code` 3 片（02 dispatch、04 watermark、06 token）。邏輯鍵名 `skill-coordinator.md`。
- **角色 SOP** `content/skill-*.md` ×12（含 lite、qa-visual）；`skill-release-engineer.md` 98,840 B，佔 `content/` 26.9%。
- **Partial** `content/partial-step1-preflight.md`（`{{PARTIAL:step1-preflight}}`；sr / pm / architect / researcher / design-auditor 使用，code-reviewer:67、qa-engineer:28、doc-writer:28、release-engineer:51 改為逐字寫出同一行）。
- **非規範** `content/constitution-rationale.md`（`stripRationale` 只處理 `<!-- rationale -->` 標記；這個檔案整體是否注入由 prompt 決定，未在本次驗證）。
- **Claude Code 模板** 12 份；**adapter 模板** 3 份（`claude.md` 生成 `CLAUDE.md` 的 adapter 區塊，兩者逐字相同）。
- 沒有 request-building code（模型 ID、thinking、sampling）在範圍內。

## 3. 發現（Step 5）— 依信心排序，Group 2 優先

欄位：**位置｜證據｜Pattern｜為何過時｜信心｜Action**。

### 3.1 High

**G2-01**｜`templates/claude-code-agents/teamwork.md:9`｜"runs the agc coordinator (full) SOP from `content/skill-coordinator.md` … (load it via the Read tool …)"｜Group 2 volatile specifics（不存在的路徑）｜`content/` 無此檔；`CLAUDE.md:117` 明寫沒有；`prompts/skill-manifest.ts` 以它為邏輯鍵組合 `coord-*.md`。Read 會失敗。｜**High**｜`rewrite`（diff 保留 `content/skill-coordinator.md` 字串，因 `test/subagent-templates.test.mjs:77` 以 regex 釘住它；改為說明它是邏輯名並改用 `teamwork` prompt 或 `<agc install>/content/coord-*.md`）。

**G2-02**｜`content/skill-release-engineer.md:292`｜"`gates/registry.ts` (33 gate definitions)"｜Group 2 volatile specifics｜`GATE_REGISTRY` 現為 35（`CLAUDE.md:43,97`；CHANGELOG 4.16.0「stays at 35 entries」）。同一行的「guards/ is 2 files」「12 gate predicate modules」已核對正確。｜**High**｜`rewrite`：移除會腐爛的數字。

**G2-03**｜`CLAUDE.md:171`｜"`(1633/1633 at v3.94.0)`"｜Group 2 volatile specifics｜最近一份 release review `qa_reports/review_release-v4-wave5-5.1.md` 記 2453/2453；package 版本 4.16.0。｜**High**｜`rewrite`：改為指向每次 release 的 review 檔。

**G2-04**｜`content/constitution-rationale.md:173-174`｜"max 10 role transitions per `/teamwork` session"｜Group 2 衝突 + 違反 `const-01:9`「never restating the bare number」｜`const-01:16` `hop` cap = 14；`tools/transitions.ts:326` `HOP_CAP = 14`。｜**High**｜`rewrite`：改以名稱引用三個 cap。

**G2-05**｜`content/skill-design-auditor.md:71`｜"max 3 extraction attempts per surface; max 5 files read per surface (constitution §5 Anti-Loop)"｜Group 2 衝突｜它引用的 §5 / Limits 表說 `read` cap = 3、`fix_try` cap = 2。若 5 與 3 是刻意不同，依 `const-01:9` 它們必須進 Limits 表而不是寫在 skill。｜**High**｜`rewrite`：以 cap 名稱引用（假設：auditor 沒有獨立額度；若有，改在 Limits 表新增一列）。

**G2-06**｜`content/const-08-chain-31-mid.md:2`｜"coordinator writer obligation: `skill-coordinator.md` stop-condition 6"｜Group 2 dangling reference｜coordinator SOP 已沒有編號的 stop conditions；對應段落是 `coord-03:43` "**Cut-approval gate writer obligation**"，stop conditions 是 `## Escalation Routes` 表。｜**High**｜`rewrite`。

**G2-07**｜`content/skill-design-auditor.md:89`｜"`skill-pm` step 2a-bis"｜Group 2 dangling reference｜`skill-pm.md` SOP 沒有 2a-bis；Geometric-Density Split Gate 是 Gate Summary 表的一列（pm:105），pm:86 要求「work the four split/scope rows of the Gate Summary」。｜**High**｜`rewrite`。

**G2-08**｜`content/constitution-rationale.md:3,15`、`content/skill-doc-writer.md:13`（另 `skill-release-engineer.md:47` 已自述該路徑為 dead path，不列）｜"`content/constitution.md`"｜Group 2 volatile specifics｜檔案已拆成 15 片 `const-*.md`。doc-writer 的禁改清單因此漏掉 `const-*.md` / `coord-*.md`。｜**High**｜`rewrite` ×4 hunks（rationale 同時移除 `(v3.27.0)` / `Rationale target: v3.32.0` 兩個釘死版本）。

**G2-09**｜(a) `templates/claude-code-agents/release-engineer.md:25` "Example reply suffix: … — @release-engineer (haiku)" vs 同檔 `:3` `model: opus`；(b) `content/coord-04-host-watermark.md:5` "Haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`)"｜Group 2 instruction files that contradict each other（同檔自相矛盾 + 跨檔）｜模板 frontmatter 與 `skill-release-engineer.md:2` `recommended_model: opus` 一致指向 opus；範例尾綴與 coord-04 的 haiku 描述是 pin 變更前的殘留。注意 `test/subagent-templates.test.mjs:397` 仍把 release-engineer 列為 `HAIKU_ROLES` 並斷言 `(haiku)` 範例行——測試本身同樣過時，套用 (a) 須一併改測試（`test/` 範圍外，僅標示）。｜**High**｜`rewrite` ×2。

**G2-10**｜`content/coord-03-core-fallback.md:39`、`coord-05-core-visual-drift.md:3`、`coord-07-core-sop.md:11`（core，所有 `/teamwork`）、`coord-02-host-dispatch.md:1`、`CLAUDE.md:226` / `templates/agent-adapters/claude.md:12`、`skill-integrator.md:51,166`｜引用「Constitution §3.2 builder ≠ judge」為 hard floor｜Group 2 跨片段矛盾（組合後懸空）｜`### 3.2` 與「Builder ≠ judge」只在 `const-11`（`chain-design`）。實測 `{chain:true, design:false}` 組合：無 §3.2 標題、無該規則文字、§3.2 被引用 0 次於憲法本身；但上列 coordinator 片段仍引用。非 design 工作的 reviewer/qa 獨立性目前只靠 coordinator SOP 與 adapter 的引用在撐，憲法本文沒有對應條款。｜**High**（懸空為事實；修法是設計決定）｜`flag`，建議二選一：(A) 把 role-collapse guard 那一條從 `const-11` 抽成 core 片段（例如併入 `const-05` §3 末或 `const-15`），§3.2 保留 visual 專屬兩條；(B) 把 core 片段的引用改為「builder ≠ judge（design-armed 時見 §3.2；否則見 `skill-coordinator` *Visual Verdict Boundary*）」。(A) 需重跑 `scripts/capture-constitution-golden.mjs` 並檢查 `test/context-budget.test.mjs` 的 lean bundle 上限（5723 ~tok，零餘裕），故不進 diff。

**G2-11**｜`content/skill-coordinator-lite.md:16`｜"`tw_update_state` / … / `tw_switch_role` will be rejected"｜Group 2 claim the repository contradicts｜`tools/role.ts` 無任何 lite 判斷；`tw_switch_role` 沒有 `agent_id`，伺服器不會因 lite 拒絕它。被拒的是四個寫入工具（無 `agent_id` → `AGENT_ID_REQUIRED` 等）。｜**High**｜`rewrite`：改為「SOP 禁止」而非「伺服器拒絕」。

### 3.2 Medium

**G2-12**｜`content/skill-qa-engineer.md:60`（同類：`:95,101`、`skill-qa-visual.md:24` 以 `content/skill-qa-engineer.md` 作路徑）｜"Read `content/skill-qa-visual.md` (via the Read tool)"｜Group 2 volatile specifics（相對於錯誤根目錄的路徑）｜`content/` 位於 agc 安裝目錄，不在 adopter workspace；`tools/`、`bin/`、`README.md`、`docs/install.md` 都沒有把它複製到 workspace 的機制；`ROLE_SKILL_MAP` 也沒有 `qa-visual`。repo 自己的慣例是 `<agc install>/…`（`skill-integrator.md:68`、`skill-pm.md:112`）。｜**Medium**（在本 repo 內跑時路徑恰好成立，故非 High）｜`rewrite` :60；其餘三處建議同改。

**G2-13**｜`CLAUDE.md:196`｜"(~18.7KB)"｜Group 2 volatile specifics｜`node bin/agent-governance-context.mjs | wc -c` 今日 27,194 bytes。｜**Medium**（量測值會隨 fixture 變動）｜`rewrite`。

**G2-14**｜`content/const-01-core-head.md:1`｜"# Constitution v3.40.0 <!-- … tracks the highest behavior the document describes …-->"｜Group 2 volatile specifics / history｜本文 origin tag 最高 v3.104.0（`const-05:9`），且含 4.x 期間加入的 E296、E385；CHANGELOG:3742 顯示 v3.40.0 是 v3.49.0 時代最後一次 bump。`test/constitution-deliverable-guard.test.mjs:66` 釘住 `^# Constitution v3\.\d+\.\d+`，所以不能直接拿掉版本。｜**Medium**｜`flag`：(a) 在 release SOP 加「憲法片段有變則 bump 標頭」步驟，或 (b) 放寬測試、移除標頭版本改由 CHANGELOG 記錄。不進 diff。

**G2-15**｜`CLAUDE.md:181-182`｜"It does NOT touch git. Commit/PR workflow is out of scope."｜Group 2 instruction files that contradict each other｜`const-15:12-16` §6 定義全角色 git 白名單與 PR 流程、`skill-release-engineer` 8a–8c/13a、`skill-integrator` Stage 5–6、`coord-03:58` 都在治理 commit/PR。伺服器**工具**不碰 git 是對的，「workflow out of scope」不對。｜**Medium**｜`rewrite`。

**G2-16**｜`content/coord-02-host-dispatch.md:1`（"advertises a `Task` tool"）、`templates/agent-adapters/claude.md:12` / `CLAUDE.md:226`（"MUST be dispatched via `Task`"），以及 `const-01:32`、`const-05:9`、`const-12:2`、`coord-03/04/06`、`skill-coordinator-lite.md:43,49`、`skill-integrator.md:40-41,78,177,181` 的 `Task(subagent_type=…)`｜Group 2 volatile specifics（宿主工具名）｜Claude Code 的 subagent 工具現名 `Agent`（本次 session 工具表；adapter 同一行已寫「Task/Agent tool」但下一句仍只寫 `Task`）。`Task(...)` 作為 SOP 內的簡寫可保留，但要定義一次。｜**Medium**｜`rewrite` ×3（coord-02 定義別名；adapter 與 `CLAUDE.md` 同步——`CLAUDE.md` 區塊由 `agc init` 從模板再生，兩者需一起改）。

**G2-17 重述（依指示：憲法 ↔ skill 重述算發現；`const-01:4-5`）**｜Group 2 duplicated info / keep-list 8 的例外（使用者明示）｜**Medium**：
- (a) `coord-05:16-29` *Drift Reconcile* 幾乎逐句重述 `const-12:1-7`（R10）；兩者在 `/teamwork` 必同時載入。→ `rewrite` 為 coordinator 觸發條件 + 指標。
- (b) `skill-coordinator-lite.md:20` *Hop cap-exempt* 重述 `const-01:16` 與 `const-15:6`（三份）。→ `rewrite` 為一行指標。
- (c) `skill-qa-engineer.md:13` 重述 `const-05:18` *`tw_complete_task` ownership*。→ `rewrite` 為指標。
- (d) `skill-release-engineer.md:20,23` 與 `templates/claude-code-agents/release-engineer.md` 第 4、6 段三度重述憲法 §3「never hand-edit」與 §6 的禁用 git 動詞；:23 已自述「one source of truth is §6」卻仍列舉。模板另重述 SOP 3a、7b、8a、E17。→ 見 **替代 hunk**（模板瘦身到與其他 11 份同形，保留 `test/subagent-templates.test.mjs:471` 斷言的 RELAY 段落）；skill :23 建議只留 recovery 機制（未出 hunk，避免與 D10 事故紀錄的取捨）。
- (e) `skill-integrator.md:38` 權限表格與 `:211` *Git operations* 兩度重述 `const-15:15` 的 integrator grant 與禁用清單。→ `rewrite` :38 為指標（:211 保留「何時用哪個動詞」的程序性內容）。
- 不列為發現（同意且屬 working redundancy，keep-list 8）：`sr-engineer:31-32` ↔ `qa-engineer:21,87`（E20/E21 兩 skill 共用）、`code-reviewer:80` ↔ `qa-engineer:83`（negative control）、`coord-03:58` ↔ `const-15:15`（程序 vs 授權）。

**G2-18**｜`content/skill-coordinator-lite.md:49`、`content/const-08-chain-31-mid.md:2,4`｜"`skill-coordinator.md`"、"`skill-pm.md`" 以檔名形式引用｜Group 2 volatile specifics｜磁碟上沒有 `skill-coordinator.md`；憲法其他處一律用 `skill-coordinator` / `skill-pm` 裸名（`const-05:9`、`const-11:21`、`const-15:6,44`）。｜**Medium**｜`rewrite` ×2（const-08:2 併入 G2-06 hunk）。

**G2-21**｜`const-06:8`「(Round 4 of `qa_round`)」、`const-08:12`「(Round 4 of `review_round`)」、`const-12:13`「Round 1-3 … Round 1-5」、`const-12:16`「up to 3 rounds」、`const-09:2-3`「Round 6 / Round 3 through Round 5」、`skill-qa-engineer.md:66,92,113`、`skill-qa-visual.md:83,99`、`skill-sr-engineer.md:28,51`｜裸數字重述 round cap｜Group 2 duplicated info，且違反 `const-01:9` 自訂規則｜值與 Limits 表一致（3/3/5 ⇒ 第 4/4/6 輪鎖定），所以是內部一致性而非事實錯誤；一旦 `transitions.ts` 的 cap 變動，這 11 處會各自腐爛。｜**Medium**｜`rewrite`：diff 含憲法內 4 個代表性 hunk（const-06:8、const-08:12、const-12:13、const-12:16-17）；skill 內其餘 7 處建議同改，sr-engineer 的 `visual_round >= 3` 門檻屬 const-09 定義的 split 門檻，應改為具名（例如在 Limits 表加 `visual_split` 門檻）。

**G2-22**｜`content/skill-release-engineer.md`（例：`:21-23` 事故年月日與版本、`:72-73` "round 1 … F1/F2"、`:133-137` 六個 release 的回測結果、`:189` "Round 1 claimed … that claim was false"、`:200-201` "was step 10 through v3.100.0"、`:208` "all 34 of which happen to exist"、`:221`、`:226`、`:243`、`:270`）｜Group 2 history narratives（past tense、incident id、commit sha）｜SOP 的權威來自它規定的行為，不是促成它的事故；這些敘事大多在 `<!-- rationale -->` 標記**之外**，所以 `stripRationale` 不會在一般 dispatch 剝掉它們。此檔 98,840 B，佔 `content/` 26.9%。｜**Medium**｜`move`：把敘事包進既有的 `<!-- rationale:start/end -->` 標記（repo 既有機制，零語意風險）或移到對應 `specs/e*.md`。diff 僅含一個示範 hunk（`:133-137`），其餘列於此處。

**G2-26**｜`content/const-15-core-tail.md:6`｜"See `skill-coordinator` §Auto-Routing for the full stop-condition list"｜Group 2 dangling reference（章節名）｜stop conditions 在 `coord-03:19` 的獨立 H2 `## Escalation Routes`；`coord-03:5` 自己也說 "Stop conditions: see `## Escalation Routes`"。｜**Medium**｜`rewrite`。

**G4-01 / G2-25**｜`templates/claude-code-agents/qa-visual.md` vs `qa-engineer.md`｜兩份模板同為 `sonnet`、同一工具集、同樣呼叫 `tw_switch_role("qa-engineer")`，差異只有 `name` 與一句「lazy-loading qa-visual」｜Group 4 redundant specialist sub-agents｜qa-visual 的行為由 `skill-qa-engineer` Phase 1.5 載入 `skill-qa-visual.md` 定義，獨立模板沒有自己的 SOP 入口；但 `coord-05:5`、`const-11` 以 `qa-visual` 為 verdict 擁有者的名稱，watermark 驗證（`coord-04:13`）也比對 `name`。｜**Medium**｜`flag`：決定 `qa-visual` 是否該是獨立 subagent；若不是，刪模板並把 `coord-05:5` 的「dispatching `qa-visual`」改為 qa-engineer。涉及角色模型，不進 diff。

### 3.3 Low / flag only

**G2-19**｜`templates/claude-code-agents/lite.md:3` `model: haiku` vs `content/skill-coordinator-lite.md:2` `recommended_model: sonnet`｜看似衝突，但 CHANGELOG v3.68.1（D8）與 `test/subagent-templates.test.mjs:152-156` 記錄為刻意分歧（Task 路徑有 validateWatermark 修正層，直接路徑沒有）。｜**Low**｜`flag`：建議模板加一行說明分歧原因，避免下一位讀者再報一次。

**G2-20**｜`content/skill-pm.md:109` Question Batch Gate 要求用 `AskUserQuestion`；同檔 `:112` 與 `skill-coordinator-lite.md:21` 對 cut 禁用它｜repo 內部一致（問題 vs cut 兩種情境），但與操作者在 repo 外記錄的偏好（/teamwork 內不用 `AskUserQuestion`，改 inline）相左。｜**Low**（repo 外證據）｜`flag`。

**G2-23**｜`tools/role.ts:35-39` 註解說 doc-writer / release-engineer「intentionally absent from AgentName」並指向 skill 的 "Side-channel constraint" 條款｜`transitions.ts:16` 已含 `release-engineer`，`skill-release-engineer.md:19` 明說舊 workaround 已過時。｜**Low**（範圍外，僅標示）｜`flag`。

**G2-24**｜`CLAUDE.md:104` lib/ 只列 2 個 helper（漏 `render-boundary.ts`）；`:134` 說 `check-version.mjs` 只比對 package.json 與 index.ts（腳本同時檢查 dist parity、CHANGELOG、lockfile）；Layout 未列 `tools/lane-paths.ts`、`tools/fanout-*.ts`、`tools/lane-status.ts` 等 4.x 新模組｜不完整但未與 repo 矛盾。｜**Low**｜`flag`。

**G1-01**｜`content/const-01-core-head.md:24-29` §1：「NO YAPPING」「Zero Tolerance」、Banned phrases 清單、「Silent execution: Do NOT narrate tool calls」、「Default chat replies ≤ 15 words」｜1a（壓力語）、1e（無出處的禁語清單）、1d（update suppressor）、1f（數字輸出上限）｜在 Opus 5.5 / Sonnet 5.5 上，「don't narrate」與硬字數上限是文件化的 under-narration / 推理受限來源；這一組沒有對應 gate 或 escalation row。但它是一致的、刻意的成本政策（§1 自述「stated here exactly once」），且使用者要求 1a 只報告。｜**Low**（依指示）|`flag`，不進 diff。若要處理，建議只保留「Structured artifacts are exempt」的正面陳述，把 ≤ 15 words 改為質性描述。

**G1-02**｜12 份模板第一行 `CRITICAL: End every reply with …`｜1a booster｜`coord-04:5` 自己記錄「even with `CRITICAL:` template reminders」haiku 仍會漏；現在只剩 doc-writer / lite 是 haiku。`test/subagent-templates.test.mjs:369` 釘住此行必須是第一行。｜**Low**｜`flag`。

**G1-03**｜`content/const-15-core-tail.md:39-43` §7「Think first / Goal-driven: Define success criteria before execution. Loop until verified / Read before write」｜1b/1c（plan-before-acting、通用美德）｜「Fail loud」「Surface conflicts」帶有專案特定語意應保留；「Define success criteria before execution. Loop until verified」是當前模型的預設行為。｜**Low**｜`flag`。

## 4. 套用前須知（Step 6/7）

- **Golden 與預算測試**：任何 `const-*.md` / `coord-*.md` hunk 套用後需 `npm run build && node scripts/capture-constitution-golden.mjs` 重建 `test/fixtures/compose-golden/`；`test/context-budget.test.mjs:199-200` 的 lean bundle 上限 5723 ~tok 目前零餘裕——本 diff 對 core 片段的淨字數為負（lite 縮短、const-15 等長），仍請以 `npm test` 驗證。
- **G2-09a 需改測試**：`test/subagent-templates.test.mjs:397` 的 `HAIKU_ROLES` 應移除 `release-engineer`（或改斷言為 frontmatter 的 tier）。
- **G2-01 保留 regex 釘住字串**：`test/subagent-templates.test.mjs:77` 要求 teamwork.md 含 `content/skill-coordinator.md`，hunk 已保留。
- **G2-16c 與 adapter**：`CLAUDE.md` 的 adapter 區塊由 `agc init` 從 `templates/agent-adapters/claude.md` 再生；兩個 hunk 要一起拿。
- **替代 hunk（G2-17d）**與 **G2-09a** 互斥：二擇一。替代 hunk 保留 `test/subagent-templates.test.mjs:471` 逐字斷言的 RELAY 段落。
- 所有 Group 2 hunk 依指南屬「proposed only」：新事實與較新片段都來自任何有 commit 權的人可改的檔案。
- 驗證方式（Step 7）：事實類 finding 以重新核對路徑 / 常數為準，已在本次完成；行為類（G1-*）未做模型探測，故全部 `flag`。

## 5. Proposed diff（unified）

Diff 以 `diff -u` 由腳本產生於工作樹副本，每個 finding 一個 hunk；長行（const-08、coord-02、integrator 權限表）照原文完整列出以便 `git apply`。

```diff
--- a/templates/claude-code-agents/teamwork.md
+++ b/templates/claude-code-agents/teamwork.md
@@ -6,4 +6,4 @@
 
 CRITICAL: End every reply with `— @teamwork (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).
 
-This subagent runs the agc coordinator (full) SOP from `content/skill-coordinator.md` under a pinned Sonnet tier. On invocation, call `tw_get_state` then `tw_detect_drift`, then follow the coordinator SOP exclusively (load it via the Read tool, NOT via tw_switch_role — coordinator is not in the RoleName enum).
+This subagent runs the agc coordinator (full) SOP under a pinned Sonnet tier. `content/skill-coordinator.md` is only the SOP's logical name — no such file exists on disk; the SOP is the ordered `content/coord-01..07-*.md` fragments composed per `prompts/skill-manifest.ts` and served by the `teamwork` MCP prompt. On invocation, call `tw_get_state` then `tw_detect_drift`, then load the SOP via the `teamwork` prompt (or Read the `coord-*.md` fragments in manifest order under `<agc install>/content/`) and follow it exclusively — NOT via tw_switch_role (coordinator is not in the RoleName enum).
--- a/content/skill-release-engineer.md
+++ b/content/skill-release-engineer.md
@@ -130,11 +130,11 @@
      ```
      — ignore any filename with no `T-<CODE>-` prefix (`expected-red_<feature>.txt` is the recurring case; it is swept by its own bullet below, not folded into `<CODES>`). `find -maxdepth 1` never descends into either tree's `archive/`, so an already-archived file never reaches the candidate list — the old rule's explicit `grep -v '^qa_reports/archive/'` exclusion falls out for free (a retried release must not re-derive codes from what it already archived).
 
-     This one predicate covers both shapes that previously diverged: a file already committed at root within the range is still absent from `$PREV_TAG`'s tree (still admitted — the committed case), and a file that is still untracked right now is *also* absent from `$PREV_TAG`'s tree, since untracked files were never in any historical tree (also admitted — the untracked case, the norm for QA/review evidence at 7a time). Verified against the real v3.93.0 release (run from that release's own pre-commit point, working tree reconstructed exactly as it stood at 7a time — `review_T-E36-01.md` untracked at root): `PREV_TAG=v3.92.1`, and the `qa_reports` command above returned exactly
+     This one predicate covers both shapes that previously diverged: a file already committed at root within the range is still absent from `$PREV_TAG`'s tree (still admitted — the committed case), and a file that is still untracked right now is *also* absent from `$PREV_TAG`'s tree, since untracked files were never in any historical tree (also admitted — the untracked case, the norm for QA/review evidence at 7a time).<!-- rationale:start --> Verified against the real v3.93.0 release (run from that release's own pre-commit point, working tree reconstructed exactly as it stood at 7a time — `review_T-E36-01.md` untracked at root): `PREV_TAG=v3.92.1`, and the `qa_reports` command above returned exactly
      ```
      qa_reports/review_T-E36-01.md
      ```
-     → `<CODES> = {E36}` — the case the committed-history-only rule this replaces returned `∅` for. Re-run at each of the last six releases' own step-7a point and every one reproduces exactly what that release actually archived: v3.91.0 → `{E25,E27,E28,E29,E30,E32,E33,RELSOP}`, v3.92.0 → `{E34}`, v3.92.1 → `{E35}`, v3.93.0 → `{E36}` (shown above), v3.94.0 → `{E37,E38}` (also untracked at 7a time — same shape as v3.93.0), v3.95.0 → `{E45,E46}` (unchanged from the prior fix).
+     → `<CODES> = {E36}` — the case the committed-history-only rule this replaces returned `∅` for. Re-run at each of the last six releases' own step-7a point and every one reproduces exactly what that release actually archived: v3.91.0 → `{E25,E27,E28,E29,E30,E32,E33,RELSOP}`, v3.92.0 → `{E34}`, v3.92.1 → `{E35}`, v3.93.0 → `{E36}` (shown above), v3.94.0 → `{E37,E38}` (also untracked at 7a time — same shape as v3.93.0), v3.95.0 → `{E45,E46}` (unchanged from the prior fix).<!-- rationale:end -->
 
      A single-ticket release still yields a one-element set — this generalizes the old single-`<CODE>` derivation, it does not change behavior on the common case (matching the project-wide `T-<CODE>-*` task-id convention). `<CODES>` is **evidence-file-backed**, not ship-backed: a commit that merely *names* a ticket in prose (e.g. `5a9a824`'s bare-code mentions of the then-newly-filed, unshipped `E39`–`E44`) adds no `qa_reports/`/`review_reports/` file for it, so it cannot enter `<CODES>` this way — but a ticket that WAS code-reviewed and then deferred or FAILed out, whose evidence file sits at root and is new since `$PREV_TAG`, still would — and under the `qa_reports`/`review_reports` union (E50) that ticket can enter `<CODES>` from `review_reports/` **alone** (exactly the deferred/FAILed-out shape: code-reviewed but never reached QA PASS), which then also drives the `qa_reports/` `covers:` sweep below, pulling a QA-side evidence file into a shipping feature's archive dir for a ticket that never shipped as QA-PASSed. The MUST NOT below bounds *range*, not *ship status* — it excludes evidence from other, unrelated releases; it cannot close that gap.
 
@@ -289,4 +289,4 @@
 | release self-check reports any FAIL (`node scripts/verify-release.mjs` exits non-zero, SOP step 9a) | Blocked | `release-engineer: release self-check failed — <failed check name(s)> — see script output` | human |
 | empty-baseline hazard (step 7a: no membership baseline for `qa_reports`/`review_reports`, and that tree currently holds root-level evidence files it would sweep in full — `STOP_QA`/`STOP_RR` set) | Blocked | `step 7a has no membership baseline for <qa_reports\|review_reports> (PREV_TAG='$PREV_TAG') — that tree has root-level evidence files and no baseline to diff them against; refusing to derive <CODES> for it rather than risk an unbounded sweep.` | human |
 
-**Expected vs unrelated scope rule** (first row's trigger): feature source files in `lib/`, `tools/`, `schema/`, `guards/`, `gates/`, `prompts/`, `bin/`, `transport/`, `scripts/`, `content/`, `templates/`, `specs/`, `test/`, `qa_reports/`, `review_reports/`, `docs/`, `research/`, `multi-agent-scripts/`, `.github/` are EXPECTED in a release commit and MUST be staged per SOP step 8a — these never trigger STOP. `.github/` is CI workflow config (`.github/workflows/ci.yml`), tracked and feature-touchable like any other source path — unlike `.current/`, where only `.current/.config.json` (staged separately as one of the five metadata paths below) and `.current/_primary/tasks.md` (step 8a) ship with a release; the rest of that tree is session bookkeeping committed separately — as of E84 (SOP step 13a), by release-engineer's own SOP immediately after the release commit and closing write, rather than left ad hoc to whichever session happens to be at the keyboard next (historical examples predating step 13a: commits `cc3e0df`, `53a6392`) — and is NOT added to this list. `guards/` and `gates/` are one letter apart and hold different things — `guards/` is 2 files (`session.ts`, `file-lock.ts`); `gates/` is 12 gate predicate modules plus `gates/registry.ts` (33 gate definitions) and `gates/pipeline.ts` — both are equally EXPECTED here and neither substitutes for the other in a `git status --short` scan. **`.current/**` (minus `.config.json`, which IS staged per step 8a above — step 7b only writes it — and `_primary/tasks.md`, also staged per step 8a) and `tasks.md` are explicit non-STOP exclusions from THIS STOP-on-unrelated-uncommitted-changes rule only (E71c)**: both are modified at every release by construction — ordinary session/task bookkeeping the coordinator/pm chain updates continuously, not this feature's source — so seeing either show as unstaged/modified in `git status --short` MUST NOT, on its own, fire the STOP row above. This exclusion says nothing about which commit stages or owns either path (E143) — it is scoped to this one STOP check only; see the Artifact list above for that question. Only UNRELATED uncommitted changes beyond those two exclusions (paths with no connection to the active feature, e.g. stray editor swap files `*.swp`, `.DS_Store`, IDE caches, `.env*`, secrets, scratch dirs, or unrelated source edits in directories outside the feature scope) trigger the STOP row above. The `qa_reports/archive/<feature>/**` and `review_reports/archive/<feature>/**` (E50) moves produced by SOP step 7a (deleted root-level paths plus their new archive paths, for the released feature's evidence files, plus the per-feature `expected-red_*` archive dirs step 7a's sweep produces) are likewise EXPECTED move-only release-engineer output, not a role-boundary violation — never a STOP trigger. Likewise, the five metadata paths written by SOP steps 7b–7d ahead of the release commit — `.current/.config.json` (7b), `docs/backlog.md` (7c), and the `agc-version:` stamp lines in `CLAUDE.md` / `AGENTS.md` / `.antigravityrules` (7d) — are EXPECTED release-engineer output at this point in the sequence, not a role-boundary violation, and never a STOP trigger.
+**Expected vs unrelated scope rule** (first row's trigger): feature source files in `lib/`, `tools/`, `schema/`, `guards/`, `gates/`, `prompts/`, `bin/`, `transport/`, `scripts/`, `content/`, `templates/`, `specs/`, `test/`, `qa_reports/`, `review_reports/`, `docs/`, `research/`, `multi-agent-scripts/`, `.github/` are EXPECTED in a release commit and MUST be staged per SOP step 8a — these never trigger STOP. `.github/` is CI workflow config (`.github/workflows/ci.yml`), tracked and feature-touchable like any other source path — unlike `.current/`, where only `.current/.config.json` (staged separately as one of the five metadata paths below) and `.current/_primary/tasks.md` (step 8a) ship with a release; the rest of that tree is session bookkeeping committed separately — as of E84 (SOP step 13a), by release-engineer's own SOP immediately after the release commit and closing write, rather than left ad hoc to whichever session happens to be at the keyboard next (historical examples predating step 13a: commits `cc3e0df`, `53a6392`) — and is NOT added to this list. `guards/` and `gates/` are one letter apart and hold different things — `guards/` is 2 files (`session.ts`, `file-lock.ts`); `gates/` is 12 gate predicate modules plus `gates/registry.ts` (`GATE_REGISTRY`) and `gates/pipeline.ts` — both are equally EXPECTED here and neither substitutes for the other in a `git status --short` scan. **`.current/**` (minus `.config.json`, which IS staged per step 8a above — step 7b only writes it — and `_primary/tasks.md`, also staged per step 8a) and `tasks.md` are explicit non-STOP exclusions from THIS STOP-on-unrelated-uncommitted-changes rule only (E71c)**: both are modified at every release by construction — ordinary session/task bookkeeping the coordinator/pm chain updates continuously, not this feature's source — so seeing either show as unstaged/modified in `git status --short` MUST NOT, on its own, fire the STOP row above. This exclusion says nothing about which commit stages or owns either path (E143) — it is scoped to this one STOP check only; see the Artifact list above for that question. Only UNRELATED uncommitted changes beyond those two exclusions (paths with no connection to the active feature, e.g. stray editor swap files `*.swp`, `.DS_Store`, IDE caches, `.env*`, secrets, scratch dirs, or unrelated source edits in directories outside the feature scope) trigger the STOP row above. The `qa_reports/archive/<feature>/**` and `review_reports/archive/<feature>/**` (E50) moves produced by SOP step 7a (deleted root-level paths plus their new archive paths, for the released feature's evidence files, plus the per-feature `expected-red_*` archive dirs step 7a's sweep produces) are likewise EXPECTED move-only release-engineer output, not a role-boundary violation — never a STOP trigger. Likewise, the five metadata paths written by SOP steps 7b–7d ahead of the release commit — `.current/.config.json` (7b), `docs/backlog.md` (7c), and the `agc-version:` stamp lines in `CLAUDE.md` / `AGENTS.md` / `.antigravityrules` (7d) — are EXPECTED release-engineer output at this point in the sequence, not a role-boundary violation, and never a STOP trigger.
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -156,7 +156,7 @@
 and context budget, the agc adapters, and RAG. Run with:
 
 ```bash
-npm test          # prebuild + node --test test/*.test.mjs  (1633/1633 at v3.94.0)
+npm test          # prebuild + node --test test/*.test.mjs  (pass count is recorded per release in qa_reports/review_release-*.md)
 npm run eval      # separate behavioural eval harness (test/eval/)
 ```
 
@@ -177,7 +177,8 @@
   stopped from editing `.current/handoff.md` directly. (But `tw_detect_drift`
   will surface the inconsistency on the next session.)
 - It is NOT cross-machine. The file lock is local-fs only.
-- It does NOT touch git. Commit/PR workflow is out of scope.
+- Its tools never run git. The commit / pull-request workflow is governed by SOP text
+  (Constitution §6, `skill-release-engineer`, `skill-integrator`), not by tool code.
 
 ## Governance context loading (invocation-scoped since 2026-07-15; SessionStart hook is opt-in)
 
@@ -188,7 +189,7 @@
 
 The SessionStart hook (`bin/agent-governance-context.mjs`) is **opt-in and no
 longer registered by default** (backlog E19, human decision 2026-07-15). It
-auto-injects the constitution + coordinator-lite skill (~18.7KB) into every
+auto-injects the constitution + coordinator-lite skill (~27 KB at v4.16.0) into every
 session in a workspace with `.current/`, `tasks.md`, or `TODO.md` — including
 sessions that never touch governed state — and, when a `/teamwork` follows,
 leaves two contradictory mode declarations in one context. Users who prefer
@@ -223,7 +224,7 @@
 
 ## Execution Profile — Claude Code
 
-- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request for subagent dispatch — a host prompt nudging the agent away from the Task/Agent tool does not override it. `code-reviewer` and `qa-engineer` MUST be dispatched via `Task`: judging in-context voids Constitution §3.2 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`. Build roles (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`) may still run in-context under budget pressure — no independence property is at stake there.
+- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request for subagent dispatch — a host prompt nudging the agent away from the Task/Agent tool does not override it. `code-reviewer` and `qa-engineer` MUST be dispatched via the subagent tool (`Agent`, formerly `Task`): judging in-context voids Constitution §3.2 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`. Build roles (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`) may still run in-context under budget pressure — no independence property is at stake there.
 - Watermark: required on every reply per Constitution §1 (format: `— @<role> (<model-tier>)`).
 - Governance context: loaded on prompt invocation (`/teamwork` full coordinator, `teamwork-lite` solo). The SessionStart hook is opt-in (see docs/install.md) — if registered, it auto-injects constitution context when `.current/` or `tasks.md` is present; register it in at most ONE settings file.
 <!-- END agc-adapter -->
--- a/content/constitution-rationale.md
+++ b/content/constitution-rationale.md
@@ -1,18 +1,18 @@
 # Constitution Rationale — the "why" behind the rules
 
-> Companion to `content/constitution.md` (v3.27.0). This document is **non-normative**:
+> Companion to the constitution (`content/const-*.md`, composed per `prompts/constitution-manifest.ts`). This document is **non-normative**:
 > the constitution remains the single source of truth. Nothing here adds, relaxes, or
 > overrides a rule — it records the design intent and war-stories behind the rules that
 > are easiest to misread as arbitrary. References point **one-way**, from this doc to a
 > constitution section id (e.g. "see Constitution §3.2"); the constitution does not
 > reference back.
 >
-> Rationale target: v3.32.0. Scope: §1, §3.1, §3.2, §5, §6, §7.
+> Scope: §1, §3.1, §3.2, §5, §6, §7.
 >
 > Primary sources: `research/visual-fidelity-retrospective-2026-06-05.md`
 > (the false-PASS retrospective), `research/process-retrospective.md` (the Language-step
 > token/cost retrospective), and the inline `<!-- rationale -->` notes already in
-> `content/constitution.md` and the skill files.
+> `content/const-*.md` and the skill files.
 
 ---
 
@@ -170,8 +170,8 @@
 
 See Constitution §5.
 
-The caps (max 2 consecutive auto-fix tries on the same failure, max 3 reads per target,
-max 10 role transitions per `/teamwork` session) exist because an agent's natural response
+The caps (the `fix_try`, `read`, and `hop` caps — values live in the Constitution's Limits
+table, not here) exist because an agent's natural response
 to a failure it cannot diagnose is to *try again* — re-reading the same file, re-applying a
 near-identical fix — which burns tokens without converging. The process-retrospective is
 the cautionary data point at the *macro* scale: a single screen (Language) consumed
--- a/content/skill-design-auditor.md
+++ b/content/skill-design-auditor.md
@@ -68,7 +68,7 @@
    - `sketch` / `xd` / `penpot`: use the corresponding MCP if available; else ask the user to export Copy / Visual values manually.
    - `pdf` / `image` / `paper`: OCR is brittle. Ask the user to confirm every value before recording — these become `authored-here` with the source filename as justification.
    **Node-scoped fetch**: scope every fetch to the specific node/frame id(s) you are auditing this pass — pass node ids to `get_figma_data` (and `download_figma_images` per node), never pull the whole document when a frame-scoped id is available. Bounds the fetch payload alongside the Volume Gate.
-   Hard limits: max 3 extraction attempts per surface; max 5 files read per surface (constitution §5 Anti-Loop). On limit, stop and surface what you have so far.
+   Hard limits: consecutive extraction attempts per surface are bounded by the `fix_try` cap and file reads per surface by the `read` cap (Constitution Limits / §5 Anti-Loop — values live there, not here). On limit, stop and surface what you have so far.
 4. **Audit**: fill the Copy / Strings + Visual Tokens + Visual Widgets tables. Quote verbatim. For values that must be paraphrased (translated, OCR'd), record `authored-here` and explain why. If a fetch returns empty nodes (e.g., `nodes: []`), flag the surface as `empty`/`unresolved` in the manifest, never `audited`. If the design exceeds the `pass_budget` per-pass line cap for this pass, mark uncovered surfaces as `deferred` in the *Source manifest* with a one-line reason and hand back — the coordinator may route you again for a follow-up pass that flips `deferred` → `audited`. `no-design` mode skips multi-pass and manifest entirely (empty manifest, single pass).
 
    **Widget-shape heuristics<!-- origin:start --> (v3.14.0)<!-- origin:end -->** — for the *Visual Widgets* table, emit a row whenever any of the following match on a layer / component / frame:
@@ -86,7 +86,7 @@
 
    **Asset export + manifest<!-- origin:start --> (v3.28.0)<!-- origin:end -->** — for fetch-based modes (`figma`/`sketch`/`xd`/`penpot`), during extraction you MUST export the design's raster/vector assets (icons, logos, illustrations) via the export MCP call (Figma: `download_figma_images`, scoped per asset node id), saving each file into the workspace assets dir (`src/assets/` or the repo convention). Record an **asset manifest** table in `design/<feature>.md` mapping `Figma node-id | exported file path | usage/widget` — one paper-verifiable row per asset. `image`/`pdf`/`paper`: record the human-supplied file path; `no-design`: no manifest. Upstream half of source-don't-redraw (Constitution §1 v3.28.0); sr-engineer imports from this manifest instead of hand-authoring SVG.
 
-   **Geometric-density flag (<!-- origin:start -->v3.31.0, <!-- origin:end -->awareness-only)** — while auditing a surface's `## Layout / Canvas` structure, count its **independently-constrained geometry layers** (stacked container constraints, asymmetric padding, nested components with independent fill/sizing rules) — distinct from canonical state-count. When a single surface has **≥ 3 independently-constrained geometry layers**, note it in the surface's *Source manifest* `reason` (or *Out of Scope* note) and flag it so PM can apply the authoritative **Geometric-Density Split Gate** (`skill-pm` step 2a-bis). Design-auditor only **flags**; PM owns the split decision and writes `.current/feature-split.md`. This does not change the 8–10 state-count threshold.
+   **Geometric-density flag (<!-- origin:start -->v3.31.0, <!-- origin:end -->awareness-only)** — while auditing a surface's `## Layout / Canvas` structure, count its **independently-constrained geometry layers** (stacked container constraints, asymmetric padding, nested components with independent fill/sizing rules) — distinct from canonical state-count. When a single surface has **≥ 3 independently-constrained geometry layers**, note it in the surface's *Source manifest* `reason` (or *Out of Scope* note) and flag it so PM can apply the authoritative **Geometric-Density Split Gate** (`skill-pm` Gate Summary, *Geometric-Density Split Gate* row). Design-auditor only **flags**; PM owns the split decision and writes `.current/feature-split.md`. This does not change the 8–10 state-count threshold.
 5. **Write** `design/<feature>.md` per the Artifact Schema.
 6. Hand off per *Escalation Routes: audit complete* (include `active_feature=<name>` on the write).
 
--- a/content/const-08-chain-31-mid.md
+++ b/content/const-08-chain-31-mid.md
@@ -1,7 +1,7 @@
 - **Scope decision gate<!-- origin:start --> (v3.30.0)<!-- origin:end -->**: a transition INTO build — `(pm, In_Progress) → (architect, In_Progress)` or `(pm, In_Progress) → (sr-engineer, In_Progress)` — is blocked with `SCOPE_DECISION_REQUIRED` when `design/<active_feature>.md` is armed (`## Mode` ≠ `no-design`) but no scope decision is recorded. The gate clears when EITHER `.current/feature-split.md` exists (multi-feature split recorded) OR handoff `scope_decision: single-feature` is set (single-feature attestation). The predecessor is pinned to `pm:In_Progress`, so re-entry/resume (architect→sr-engineer, sr-engineer self-loop) is never re-blocked. Independent of the visual evidence gate (different edge, different artifacts; shares only the arm signal). Non-design workspaces (no design file or `## Mode` = `no-design`) pass through silently. Closes the routing-chain half of the scope-creep finding (see `content/constitution-rationale.md`) — it does NOT stop in-context / lite-mode work that emits no transition.
-- **Cut-Approval Gate<!-- origin:start --> (v3.46.0)<!-- origin:end -->**: the same build-entry edge — `(pm, In_Progress) → (architect, In_Progress)` or `(pm, In_Progress) → (sr-engineer, In_Progress)` — is blocked with `CUT_APPROVAL_REQUIRED` until `cut_approved: true` is set on the handoff. Unconditional (NOT design-arm-gated): a human must approve the ticket cut before ANY build role receives the handoff, visual feature or not. File-mode only: `cut_approved` lives in the handoff YAML frontmatter, so in SQLite/HTTP mode the gate is skipped. The predecessor is pinned to `pm:In_Progress`, so resume/re-entry (architect→sr-engineer, the sr-engineer self-loop) is never re-blocked. Clearing artifact: `cut_approved: true` on the `pm:In_Progress` state write, set ONLY after the human approved the inline cut in chat. Feature-scoped re-arm: a fresh PM `In_Progress` entry, a QA-FAIL bounce back to PM, or any `active_feature` change re-arms the gate — the cut must be re-presented and re-approved. Sanctioned writer (coordinator-attested approval): cut_approved may be set ONLY by the context that directly witnessed the human's chat-turn approval in its OWN conversation — never from another agent's summary or relayed claim of approval. In same-context dispatch (lite, full non-subagent, or the `tw_switch_role` fallback) that witness is the PM itself; under Task-subagent dispatch — where the PM subagent ends its turn after presenting the draft — it is the coordinator, attesting via `tw_update_state(agent_id="pm", cut_approved: true, ...)` on the PM's still-current state tuple. The server cannot verify same-context witnessing; this is an honest, attestation-based trust boundary, not a cryptographic guarantee. Role-specific actions live in the skills (PM inline-present rules: `skill-pm.md` Gate Summary; coordinator writer obligation: `skill-coordinator.md` stop-condition 6) and MUST NOT restate this mechanism.
+- **Cut-Approval Gate<!-- origin:start --> (v3.46.0)<!-- origin:end -->**: the same build-entry edge — `(pm, In_Progress) → (architect, In_Progress)` or `(pm, In_Progress) → (sr-engineer, In_Progress)` — is blocked with `CUT_APPROVAL_REQUIRED` until `cut_approved: true` is set on the handoff. Unconditional (NOT design-arm-gated): a human must approve the ticket cut before ANY build role receives the handoff, visual feature or not. File-mode only: `cut_approved` lives in the handoff YAML frontmatter, so in SQLite/HTTP mode the gate is skipped. The predecessor is pinned to `pm:In_Progress`, so resume/re-entry (architect→sr-engineer, the sr-engineer self-loop) is never re-blocked. Clearing artifact: `cut_approved: true` on the `pm:In_Progress` state write, set ONLY after the human approved the inline cut in chat. Feature-scoped re-arm: a fresh PM `In_Progress` entry, a QA-FAIL bounce back to PM, or any `active_feature` change re-arms the gate — the cut must be re-presented and re-approved. Sanctioned writer (coordinator-attested approval): cut_approved may be set ONLY by the context that directly witnessed the human's chat-turn approval in its OWN conversation — never from another agent's summary or relayed claim of approval. In same-context dispatch (lite, full non-subagent, or the `tw_switch_role` fallback) that witness is the PM itself; under Task-subagent dispatch — where the PM subagent ends its turn after presenting the draft — it is the coordinator, attesting via `tw_update_state(agent_id="pm", cut_approved: true, ...)` on the PM's still-current state tuple. The server cannot verify same-context witnessing; this is an honest, attestation-based trust boundary, not a cryptographic guarantee. Role-specific actions live in the skills (PM inline-present rules: `skill-pm` Gate Summary; coordinator writer obligation: `skill-coordinator` *Cut-approval gate writer obligation*) and MUST NOT restate this mechanism.
 - **Cut-Approval Auto-Tier<!-- origin:start --> (v3.85.0, E5)<!-- origin:end -->**: a cut meeting ALL of the auto-tier threshold — touches at most `maxFiles` files, ticket priority no more urgent than `maxPriority`, no schema change, non-design (no design source armed) — may be auto-approved: the sanctioned writer (same witness/trust rule as the Cut-Approval Gate above) sets `cut_approved: true` WITHOUT halting for the human, and MUST record the tier in the SAME write — a `pending_notes` line `cut-approved: auto-tier` plus the threshold facts (file count, ticket priority, schema/design classification). Threshold source: the `.current/.config.json` key `cutApprovalAutoTier` (`docs/config.md`). Opt-in arming: the tier exists ONLY while that key is present — key absent = auto-tier disabled, every cut HALTs exactly as today (cut review is the highest-leverage human checkpoint; removing it is an explicit per-workspace decision, never a default). Fields omitted inside a present key take the conservative defaults: `maxFiles` 2, `maxPriority` P3, `allowSchemaChange` false, `allowDesignArmed` false — schema-change and design-armed cuts are never auto-approvable unless those flags are explicitly `true`. Anything over-threshold, design-armed, or unclassifiable HALTs exactly as today. Advisory, not server-enforced: the server parses and surfaces the config key but neither checks the threshold nor distinguishes an auto-tier write — the coordinator/PM reads the config and applies it, and the recorded `cut-approved: auto-tier` note is the audit trail (the `scope_decision_why` trust class: attested, not server-verified).
-  - **Manifest tier**<!-- origin:start --> (E296)<!-- origin:end -->: the same writer may also set `cut_approved: true` without halting when ALL hold — (1) `cutApprovalAutoTier.manifest` is `true` (strict); (2) the lane branch carries `specs/fanout-<id>.md` whose `## Decisions` table has a `人類` row and whose Lanes table has this lane's row; (3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0, proving every file the cut names is inside that row's owned set; (4) the PM's Gate Summary attests no option choice and no needs-human-ruling item; (5) no-schema-change and non-design still hold, and the row replaces `maxFiles` / `maxPriority` (not added to them); (6) the integrator's mailbox pre-review returned `close` on this final cut (the mailbox still never carries approval); (7) the row's optional `approval` column is not `human`; (8) the SAME write carries the `pending_notes` line `cut-approved: manifest-tier (<manifest path>, Decisions <date>)`, `<date>` = the `日期` of the latest `人類` Decisions row. Any failing condition HALTs exactly as today; a manifest changed mid-wave needs a fresh `人類` row, merged into the lane, before the lane auto-approves against it. Role-specific writer actions live in the skills (`skill-coordinator.md` auto-tier and manifest-tier writer actions) and MUST NOT restate this mechanism.
+  - **Manifest tier**<!-- origin:start --> (E296)<!-- origin:end -->: the same writer may also set `cut_approved: true` without halting when ALL hold — (1) `cutApprovalAutoTier.manifest` is `true` (strict); (2) the lane branch carries `specs/fanout-<id>.md` whose `## Decisions` table has a `人類` row and whose Lanes table has this lane's row; (3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0, proving every file the cut names is inside that row's owned set; (4) the PM's Gate Summary attests no option choice and no needs-human-ruling item; (5) no-schema-change and non-design still hold, and the row replaces `maxFiles` / `maxPriority` (not added to them); (6) the integrator's mailbox pre-review returned `close` on this final cut (the mailbox still never carries approval); (7) the row's optional `approval` column is not `human`; (8) the SAME write carries the `pending_notes` line `cut-approved: manifest-tier (<manifest path>, Decisions <date>)`, `<date>` = the `日期` of the latest `人類` Decisions row. Any failing condition HALTs exactly as today; a manifest changed mid-wave needs a fresh `人類` row, merged into the lane, before the lane auto-approves against it. Role-specific writer actions live in the skills (`skill-coordinator` *Auto-tier writer action* / *Manifest-tier writer action*) and MUST NOT restate this mechanism.
 - **Lease-Override<!-- origin:start --> (v3.80.0)<!-- origin:end -->**: a write that would be rejected `FEATURE_LEASE_HELD` (incumbent feature non-terminal and fresh — see `gates/feature-lease.ts`'s header notes (E1/E1A/E13) for the predicate; not restated here) may carry `lease_override: true` to bypass the lease for THAT write only, after a human present in the workspace attests the incumbent lease is dead (shipped or abandoned). Sanctioned writer (coordinator-attested, the Cut-Approval Gate trust rule): `lease_override` may be set ONLY by the context that directly witnessed the human's chat-turn attestation in its OWN conversation — never from another agent's summary or relayed claim. In same-context dispatch that witness is the acting role itself; under Task-subagent dispatch it is the coordinator, attesting on the stranded role's still-current state tuple. Differences from cut-approval: (i) usable on **any edge** where `FEATURE_LEASE_HELD` can fire, not pinned to build-entry; (ii) a **stricter audit requirement** — the write MUST carry `pending_notes[0]` matching `/^lease-override:/` with a human-readable reason, or it is rejected `LEASE_OVERRIDE_AUDIT_MISSING` (an unaudited bypass is never silently accepted); (iii) **transient, write-scoped** — never persisted, never carried forward; a later write omitting it is evaluated by the normal lease predicate. File-mode only: in SQLite/HTTP mode the field is ignored and the plain lease rejection stands.
 - **Bookkeeping-Write<!-- origin:start --> (v3.80.0)<!-- origin:end -->**: a same-feature write that records no forward progress (a PM crash/failure record, an administrative note) may carry `bookkeeping_write: true` to attest it is non-substantive: the server then PRESERVES the existing on-disk `last_updated` verbatim instead of stamping fresh `now()`, so the incumbent feature's lease age keeps measuring the last REAL write and a genuinely idle workspace is not re-armed for the next feature. Attested, not server-verified for truthfulness (the `scope_decision_why` trust class); server-verified for shape: valid ONLY when the write's `active_feature` equals the existing on-disk `active_feature` — a differing-feature combination is rejected `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`, never silently accepted or downgraded (suppressing a NEW feature's own freshness stamp would make its lease look pre-aged — the clobber race the lease exists to close). The `readHandoffState` schema-migration heal-write is this mechanism's **hard-wired unconditional equivalent** (server-internal, no attestation): a read-triggered heal is never evidence the feature is alive and cannot extend its lease. Transient, write-scoped; file-mode only (SQLite/HTTP timestamp behavior unchanged).
 - **Stamp-Provenance<!-- origin:start --> (v3.86.0, E18)<!-- origin:end -->**: when the CURRENT on-disk handoff `last_updated` matches the hand-authored stamp shape (seconds `00`, milliseconds `.000` — the server write path always stamps millisecond entropy; the exact predicate lives in `gates/stamp-provenance.ts`, shared with the read-side drift advisory, not restated here), ANY next write is rejected `STAMP_PROVENANCE_SUSPECT` unless it acknowledges the contamination with `pending_notes[0]` matching `/^stamp-remediation:/` and a human-readable account of how the suspect stamp was produced/verified — forcing the anomaly into the audit trail instead of letting the next write silently overwrite the evidence of an out-of-band hand-edit. Note-only audit (no companion boolean field): the gate arms from the on-disk state alone, so the audit note is simultaneously the acknowledgment and the audit trail. Fires on any edge; self-disarms after any accepted write (which stamps a fresh server `now()`); a brand-new workspace (no existing handoff) is never gated. File-mode only: SQLite/HTTP stamps come from the DB write path.
@@ -9,4 +9,4 @@
 - **Non-QA Completed-Tasks Gate<!-- origin:start --> (v3.100.0, E40)<!-- origin:end -->**: any write whose `agent_id` is present and is NOT `qa-engineer`, carrying a non-empty `completed_tasks`, is rejected — closing a prefill door the QA Completion-Evidence gate above cannot see on its own (that gate diffs an incoming `qa-engineer` write's `completed_tasks` against the ON-DISK set, so ids a non-qa role already persisted BEFORE any `qa-engineer` write contribute zero difference and never trigger per-id evidence — the on-disk set was already poisoned upstream of that check). ONE gate, TWO codes: an `agent_id: code-reviewer` write keeps the pre-existing `REVIEWER_COMPLETED_TASKS_REJECTED` envelope byte-identical; every OTHER non-qa identity is rejected `NON_QA_COMPLETED_TASKS_REJECTED`. STRICT predicate — any non-empty `completed_tasks`, deliberately NOT a set-difference against the on-disk ledger (a set-difference is exactly the shape of the bypass this gate closes) — and NO exemptions (E32 precedent: an exemption on this same class of check is the hole that reopened once already). Clearing artifact: omit `completed_tasks` (or pass `[]`) on any write stamped with a non-qa `agent_id` — only `agent_id: qa-engineer` may grow the ledger, backed by the QA Completion-Evidence gate above. `tw_complete_task` is untouched (its own evidence path, never routed through this write). Methodology-agnostic: the predicate keys only on `agent_id`, not on any role-specific SOP wording. Applies in file and SQLite/HTTP mode alike — the predicate reads only the incoming write's args.
 - **Amend-Resume Edge<!-- origin:start --> (v3.46.0)<!-- origin:end -->**: when PM re-enters `pm:In_Progress` mid-chain to amend a spec-only issue flagged by a downstream role, two additional guarded edges — `pm:In_Progress → code-reviewer:In_Progress` and `pm:In_Progress → qa-engineer:In_Progress` — allow PM to hand back directly to the role that was stranded, instead of a manufactured detour through sr-engineer. **Mechanism:** the write that crosses the edge must set the first-class `resume_of` handoff field to `code-reviewer` or `qa-engineer` (schema v7, c9-protocol-fields; enum-validated at the tool boundary; trust class of `scope_decision_why`: attested, not server-verified — the server checks only that the field names the exact target role; whether that role was genuinely stranded is the writer's honest attestation). Scoped to exactly the stranded role — the field only opens an edge to the role it names, and the static routing table still forbids `pm→{code-reviewer, qa-engineer}` absent the field, so this can never skip code-reviewer or qa-engineer on a normal forward flow. A legacy `resume_of: <role>` line inside `pending_notes` is inert — not honored, not rejected. **It does not interact with the Scope Decision Gate or the Cut-Approval Gate**, which fire only on `pm:In_Progress → {architect,sr-engineer}:In_Progress`; these edges target `code-reviewer`/`qa-engineer`, so neither gate arms. **Single-role judge dispatch<!-- origin:start --> (v3.83.0, E16)<!-- origin:end -->:** the same `resume_of`-gated edges are ALSO the sanctioned door for a PM-sanctioned FRESH dispatch of exactly one judge role (`code-reviewer` or `qa-engineer`) on a test-only / evidence-only ticket — not only a mid-chain resume of a previously stranded role. Same field (`resume_of` names the dispatched role), same trust mechanics (whether the ticket is genuinely judge-only is the PM's honest attestation; the server still checks only field⟺target consistency), judge roles only: the field opens no edge to any build role, so a code-bearing forward flow can never use it to skip code-reviewer or qa-engineer.
 - Code-reviewer approval is signalled via `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` handoff with the first-class `review_verdict` field set to `APPROVED` and a `review_reports/review_<task-id>.md` evidence file; a rejection sets `review_verdict=CHANGES_REQUESTED` on the `(code-reviewer, FAIL)` write. The server enforces verdict⟺status consistency (`REVIEW_VERDICT_STATUS_MISMATCH`). Only the code-reviewer may carry `review_verdict`: any other `agent_id` carrying it is rejected with `NON_REVIEWER_VERDICT_REJECTED`, except on the APPROVED handoff itself (`agent_id=qa-engineer` on the `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` edge); file mode only. Code-reviewer cannot use `status=PASS`; that remains qa-engineer-exclusive.
-- After the `review_round` cap of code-reviewer FAILs (Round 4 of `review_round`), only `(pm, In_Progress)` is accepted — symmetric to the `qa_round` circuit breaker.
+- After the `review_round` cap of code-reviewer FAILs, only `(pm, In_Progress)` is accepted — symmetric to the `qa_round` circuit breaker.
--- a/content/skill-doc-writer.md
+++ b/content/skill-doc-writer.md
@@ -10,7 +10,7 @@
 Final reply: `Done. Doc updates in <files>.`
 
 ## Hard rules
-- **No API / spec changes**: do not edit `specs/`, `content/skill-*.md`, `content/constitution.md`, `package.json`, `index.ts`, or any source file under `tools/` / `prompts/` / `schema/` / `guards/`. Doc-writer documents what shipped — it does not re-decide what ships.
+- **No API / spec changes**: do not edit `specs/`, `content/skill-*.md`, `content/const-*.md`, `content/coord-*.md`, `package.json`, `index.ts`, or any source file under `tools/` / `prompts/` / `schema/` / `guards/`. Doc-writer documents what shipped — it does not re-decide what ships.
 - **Fact-preservation**: every claim the docs make MUST be traceable to a source the doc-writer can cite (a code symbol, a CHANGELOG entry the qa-engineer signed off on, a `specs/<feature>.md` AC). If a fact has no source in the workspace, STOP and surface it — do not invent.
 - **Side-channel constraint**: doc-writer is NOT in `ALLOWED_TRANSITIONS` (`tools/transitions.ts`). When calling `tw_update_state`, set `agent_id` to the upstream caller's identifier (typically `qa-engineer` after PASS) — NOT `"doc-writer"`. The server will reject `agent_id="doc-writer"` because it never appears in the transition matrix.
 
--- a/templates/claude-code-agents/release-engineer.md
+++ b/templates/claude-code-agents/release-engineer.md
@@ -22,4 +22,4 @@
 
 Before the closing handoff write, append this release's shipped task IDs to `driftBaselineIds` in `.current/.config.json` (deduplicated, create the array if absent) per the SOP's drift-baseline acknowledgment step. Skipping it makes every shipped task resurface as drift noise next session.
 
-Example reply suffix: … — @release-engineer (haiku)
+Example reply suffix: … — @release-engineer (opus)
--- a/content/coord-04-host-watermark.md
+++ b/content/coord-04-host-watermark.md
@@ -2,7 +2,7 @@
 
 This validation applies ONLY to **Task-dispatched subagent replies** (which still emit the `— @<name> (<tier>)` with-tier form per Constitution §1). The coordinator's **own** main-loop replies are non-subagent context and end with `— @coordinator` (no tier) — they are not processed by `validateWatermark`.
 
-When the parent (this coordinator) dispatches a role via `Task(subagent_type="<role>", …)` and receives back a reply, the parent MUST verify the watermark before relaying the reply to the user. Haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`) sometimes omit the `— @<name> (<tier>)` suffix mandated by Constitution §1 even with `CRITICAL:` template reminders; this step closes that gap at the layer that has guaranteed execution.
+When the parent (this coordinator) dispatches a role via `Task(subagent_type="<role>", …)` and receives back a reply, the parent MUST verify the watermark before relaying the reply to the user. Haiku-tier subagents (currently `@lite` and `@doc-writer`; `@release-engineer` is opus-pinned) sometimes omit the `— @<name> (<tier>)` suffix mandated by Constitution §1 even with `CRITICAL:` template reminders; this step closes that gap at the layer that has guaranteed execution.
 
 **Detection regex** — applied to the last non-empty line of the subagent reply, after stripping leading/trailing whitespace from that line:
 
--- a/content/skill-coordinator-lite.md
+++ b/content/skill-coordinator-lite.md
@@ -13,11 +13,11 @@
 - **Full (`/teamwork`)**: cross-module work, anything needing `tasks.md`/`handoff.md` tracking or independent QA.
 
 ## Hard rules
-- **Server-read-only.** Lite has no `agent_id` in the routing chain (`tools/transitions.ts`); `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task` / `tw_switch_role` will be rejected. Do NOT call them.
+- **Server-read-only.** Lite has no `agent_id` in the routing chain (`tools/transitions.ts`); `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task` are rejected by the server; `tw_switch_role` is not server-gated — this SOP forbids it (lite never switches role). Do NOT call any of them.
 - `tw_get_state` allowed (read-only) if you need context. `tw_detect_drift` only on user request.
 - **No code-reviewer step.** Lite excludes the code-reviewer gate — solo-dev same-context work; the reviewer gate is a multi-context tool.
 - **No auto-routing.** Lite is single-shot; the auto-hop loop lives in `/teamwork` only.
-- **Hop cap-exempt.** Lite is exempt from the `hop` cap (const-01 Limits) and server-read-only — no `hop_count` enforcement applies (the server-tracked counter gates role-transition `tw_update_state` writes, which lite never issues).
+- **Hop cap-exempt** — per Constitution Limits / §5 (lite issues no role-transition write, so `hop_count` never moves).
 - **Cut-approval halt (SOP-ceiling).** Full mechanism and trust rule: Constitution §3.1. Lite is server-read-only, so the server's `CUT_APPROVAL_REQUIRED` transition gate cannot fire here — this SOP rule is the enforcement ceiling for the lite path; lite is also always single-context by construction (no coordinator/subagent boundary), so the sanctioned-writer question never arises here. If a lite task ever crosses into PM-style ticket-splitting and then build work, you MUST present the ticket cut inline in chat (header per skill-pm *Cut-Approval Gate*) and HALT for human approval before executing/nominating build — do NOT use `AskUserQuestion`, present inline and wait. In practice this is also a `/teamwork` escalation signal (multi-ticket cut → not a one-shot lite edit → **full** per step 3), so prefer escalating.
 
 ## SOP
@@ -46,7 +46,7 @@
 /^—\s@[\w-]+\s\([\w-]+\)$/i
 ```
 
-Out-of-scope: ONLY after `Task(…)`; skip after `tw_*`/bash/file. Full rules: `skill-coordinator.md` §Subagent Reply Watermark Validation.
+Out-of-scope: ONLY after `Task(…)`; skip after `tw_*`/bash/file. Full rules: `skill-coordinator` §Subagent Reply Watermark Validation (`content/coord-04-host-watermark.md`).
 
 Coordinator-lite is non-subagent: own replies end `— @lite` (no tier) per §1; only relayed subagents keep `— @<role> (<tier>)`.
 
--- a/content/skill-qa-engineer.md
+++ b/content/skill-qa-engineer.md
@@ -10,7 +10,7 @@
 Details go in files.
 
 ## Hard rules
-- **You own `tw_complete_task` and `tw_rollback_task`**. Sr-engineer never flips these (constitution §3).
+- **You own `tw_complete_task` and `tw_rollback_task`** (Constitution §3 *`tw_complete_task` ownership*).
 - **Scope**: QA rejects only for failing tests, missing coverage on required acceptance criteria, or test-infra defects. Style, architecture, and correctness review are owned by code-reviewer and are out of scope for QA FAIL. If you observe a correctness/architecture issue the code-reviewer missed, surface it in the review doc and escalate to code-reviewer or pm — do not FAIL the task on those grounds.
 - **No release bookkeeping**<!-- origin:start --> (v3.58.0, C10)<!-- origin:end -->: version bump, CHANGELOG, and `docs/backlog.md` done-marking are release-engineer's job post-PASS — never qa-engineer's, even though QA is the role physically present at the PASS boundary. PASS is a handoff, not an invitation to ship.
 - **Review before tests**: Always Phase 1 spec/copy/visual audit before Phase 3 tests.
@@ -57,7 +57,7 @@
 
 4. **Phase 1.5 — Visual Compare** (v3.14.0: lazy-load + PASS-gated when Visual Baselines present): after Phase 1 PASS (3a + 3b), before Phase 2. Check `design/<feature>.md` for a `## Visual Baselines` H2.
    - **Absent** (or no design file) → log `Phase 1.5: skipped (no Visual Baselines declared)` in the review doc and proceed to Phase 2. Do NOT Read `content/skill-qa-visual.md`. Non-UI features pay zero overhead.
-   - **Present** → Read `content/skill-qa-visual.md` (via the Read tool) and follow its SOP for each baseline row. The sub-skill carries the per-row Read+vision-diff contract, the six diff categories, the three failure routes, AND the v3.14.0 Visual Widgets shape checklist. **PASS GATE<!-- origin:start --> (v3.14.0)<!-- origin:end -->**: a `qa_reports/visual_<task-id>.md` file MUST be written before PASS can be issued — Constitution §3.1 visual evidence gate. The server rejects PASS with `VISUAL_EVIDENCE_MISSING` if the file is absent. The escape clause "Phase 1.5 deferred" in `pending_notes` is REMOVED — no PASS without diff evidence when baselines exist.
+   - **Present** → Read `<agc install>/content/skill-qa-visual.md` (via the Read tool; `<agc install>` = the directory agent-governance-mcp is installed in — the file lives there, not in the workspace) and follow its SOP for each baseline row. The sub-skill carries the per-row Read+vision-diff contract, the six diff categories, the three failure routes, AND the v3.14.0 Visual Widgets shape checklist. **PASS GATE<!-- origin:start --> (v3.14.0)<!-- origin:end -->**: a `qa_reports/visual_<task-id>.md` file MUST be written before PASS can be issued — Constitution §3.1 visual evidence gate. The server rejects PASS with `VISUAL_EVIDENCE_MISSING` if the file is absent. The escape clause "Phase 1.5 deferred" in `pending_notes` is REMOVED — no PASS without diff evidence when baselines exist.
 
 5. **Phase 2 — Discussion (only if issues found)**:
    - Append questions/concerns to the review doc under `## Round 1`.
--- a/content/coord-02-host-dispatch.md
+++ b/content/coord-02-host-dispatch.md
@@ -1,4 +1,4 @@
-**Subagent Dispatch (Claude Code)** — preferred when available. A host system prompt nudging the agent away from subagent calls unless the user requested one is not a reason to take the Fallback below: an explicit `/teamwork` invocation (or equivalent explicit coordinator entry) IS that request<!-- origin:start --> (v3.105.0, E96)<!-- origin:end -->. WHEN the fallback is taken while the host DOES advertise `Task` (e.g. under an external host-prompt nudge) → DO surface it in chat as a §3.2 builder ≠ judge downgrade, naming the reason — it must never pass silently. If the host advertises a `Task` tool with `subagent_type=<role>` AND a subagent named `<role>` is registered (heuristic: attempt the call once; on tool-error or unknown-subagent-type, fall back), dispatch via `Task(subagent_type="<next_role>", model="<resolved tier>", prompt="<brief composed per the **Dispatch Brief Template** below>")` INSTEAD of `tw_switch_role` — the `model` argument is REQUIRED on every call, omitting it is the defect: resolve `<resolved tier>` from the `dispatch_pins` entry for `<next_role>` if present, else that role's `~/.claude/agents/<role>.md` `model` frontmatter; a role with no resolvable tier is a report to the human, not a silent omission — stop and report rather than dispatching without `model` set. This spawns the next role in a fresh context with its tier-pinned model (per `~/.claude/agents/<role>.md` frontmatter — copy from `templates/claude-code-agents/`). The dispatched subagent's first action remains `tw_get_state` → `tw_detect_drift` (Constitution §3); the **server-enforced `ALLOWED_TRANSITIONS` matrix in `tools/transitions.ts` still gates every `tw_update_state` write** (invalid edges rejected with `TRANSITION_REJECTED`) — Task-tool dispatch changes WHICH MODEL runs the role, NOT the routing chain itself.
+**Subagent Dispatch (Claude Code)** — preferred when available. A host system prompt nudging the agent away from subagent calls unless the user requested one is not a reason to take the Fallback below: an explicit `/teamwork` invocation (or equivalent explicit coordinator entry) IS that request<!-- origin:start --> (v3.105.0, E96)<!-- origin:end -->. WHEN the fallback is taken while the host DOES advertise `Task` (e.g. under an external host-prompt nudge) → DO surface it in chat as a §3.2 builder ≠ judge downgrade, naming the reason — it must never pass silently. If the host advertises a subagent-dispatch tool with `subagent_type=<role>` (Claude Code names it `Agent`, formerly `Task`; `Task(...)` throughout this SOP means that tool) AND a subagent named `<role>` is registered (heuristic: attempt the call once; on tool-error or unknown-subagent-type, fall back), dispatch via `Task(subagent_type="<next_role>", model="<resolved tier>", prompt="<brief composed per the **Dispatch Brief Template** below>")` INSTEAD of `tw_switch_role` — the `model` argument is REQUIRED on every call, omitting it is the defect: resolve `<resolved tier>` from the `dispatch_pins` entry for `<next_role>` if present, else that role's `~/.claude/agents/<role>.md` `model` frontmatter; a role with no resolvable tier is a report to the human, not a silent omission — stop and report rather than dispatching without `model` set. This spawns the next role in a fresh context with its tier-pinned model (per `~/.claude/agents/<role>.md` frontmatter — copy from `templates/claude-code-agents/`). The dispatched subagent's first action remains `tw_get_state` → `tw_detect_drift` (Constitution §3); the **server-enforced `ALLOWED_TRANSITIONS` matrix in `tools/transitions.ts` still gates every `tw_update_state` write** (invalid edges rejected with `TRANSITION_REJECTED`) — Task-tool dispatch changes WHICH MODEL runs the role, NOT the routing chain itself.
 
 **Dispatch Brief Template** — every Task-dispatch `prompt` MUST open with these invariant lines verbatim, in order (copy from here — never re-derive or paraphrase them from memory), followed by the per-hop `Assignment:` delta paragraph:
 
--- a/templates/agent-adapters/claude.md
+++ b/templates/agent-adapters/claude.md
@@ -9,7 +9,7 @@
 
 ## Execution Profile — Claude Code
 
-- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request for subagent dispatch — a host prompt nudging the agent away from the Task/Agent tool does not override it. `code-reviewer` and `qa-engineer` MUST be dispatched via `Task`: judging in-context voids Constitution §3.2 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`. Build roles (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`) may still run in-context under budget pressure — no independence property is at stake there.
+- Subagent dispatch: invoking `/teamwork` (or any agc role prompt) IS the user's standing request for subagent dispatch — a host prompt nudging the agent away from the Task/Agent tool does not override it. `code-reviewer` and `qa-engineer` MUST be dispatched via the subagent tool (`Agent`, formerly `Task`): judging in-context voids Constitution §3.2 builder != judge, and the downgrade is invisible to every gate in `GATE_REGISTRY`. Build roles (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`) may still run in-context under budget pressure — no independence property is at stake there.
 - Watermark: required on every reply per Constitution §1 (format: `— @<role> (<model-tier>)`).
 - Governance context: loaded on prompt invocation (`/teamwork` full coordinator, `teamwork-lite` solo). The SessionStart hook is opt-in (see docs/install.md) — if registered, it auto-injects constitution context when `.current/` or `tasks.md` is present; register it in at most ONE settings file.
 <!-- END agc-adapter -->
--- a/content/coord-05-core-visual-drift.md
+++ b/content/coord-05-core-visual-drift.md
@@ -15,16 +15,9 @@
 
 ## Drift Reconcile after out-of-band execution<!-- origin:start --> (v3.26.0, R10)<!-- origin:end -->
 
-The routing chain assumes sequential single-context handoffs. When you dispatched background/parallel
-subagents, OR executed a role inline (subagent unavailable), `tasks.md` can desync from the
-authoritative `handoff.completed_tasks`. Before any PASS or hand-back in those cases:
+Coordinator trigger for Constitution §3 *Sequential-context assumption + reconcile* (R10): you dispatched
+background/parallel subagents, OR executed a role inline (subagent unavailable). Before any PASS or
+hand-back in those cases run the constitution's reconcile as written there (`tw_detect_drift`; `tw_sync` on
+handoff-ahead drift; qa PASS or `tw_rollback_task` on vibe drift). Never hand-edit `tasks.md` checkboxes to
+paper over drift.
 
-1. `tw_detect_drift`.
-2. If it reports **handoff-ahead** drift (handoff says complete, tasks.md shows incomplete) → `tw_sync`
-   to mirror the ledger onto tasks.md. Safe + bookkeeping-only.
-3. If it reports **vibe drift** (tasks.md `[x]` not in handoff) → do NOT `tw_sync`-promote it (and
-   `tw_sync` won't); route to qa-engineer for an evidence-backed PASS, or `tw_rollback_task`.
-
-Never hand-edit `tasks.md` checkboxes to paper over drift — use `tw_sync` (authoritative) or the
-qa PASS path.
-
--- a/content/skill-integrator.md
+++ b/content/skill-integrator.md
@@ -35,7 +35,7 @@
 
 | can | cannot |
 |---|---|
-| The §6 integrator-only git grant (merge, `switch -c` / `switch <existing-branch>`, `worktree remove`, `branch -d`, compare-and-delete `update-ref`, `gh pr create`, `gh pr merge --auto --merge`) plus the base list incl. `fetch`, `pull --ff-only` on `main`, and pushing the integration branch | Pushing `main` directly (protected: it moves only by pull request merge), `gh pr merge --squash` / `--rebase` / `--admin`, `reset`, `rebase`, `clean`, force-push, `checkout --force`, `checkout -- <file>`, `commit --amend` |
+| Constitution §6: the base list plus the integrator-only grant (enumerated there, not here), and pushing the integration branch | Pushing `main` directly (protected: it moves only by pull request merge) and every git verb Constitution §6 forbids |
 | Read governance state (`tw_get_state`, `tw_detect_drift`, `tw_gate_stats`); `tw_sync` on primary | `tw_update_state`; writing any lane's `.current/<lane>/` |
 | Dispatch code-reviewer / qa-engineer (Task) for integration-time issues; dispatch a read-only verifier | Write feature code or tests; fix a lane's feature code |
 | Stage 0 only: dispatch PM (Task) to write the ticket-cut file — no `tasks.md`, no write-type `tw_*` | Dispatch PM for anything else (spec, tasks, state writes) |
--- a/content/const-06-chain-31-head.md
+++ b/content/const-06-chain-31-head.md
@@ -5,5 +5,5 @@
 `tw_update_state` writes are rejected before reaching storage. Key rules:
 
 - `status=PASS` and `tw_complete_task` require `agent_id="qa-engineer"`.
-- After the `qa_round` cap of QA FAILs (Round 4 of `qa_round`), only `(pm, In_Progress)` is accepted.
+- After the `qa_round` cap of QA FAILs, only `(pm, In_Progress)` is accepted.
 - PASS requires evidence: attach `qa_review`, or pre-write `qa_reports/review_<task-id>.md`.
--- a/content/const-12-chain-r10-s4.md
+++ b/content/const-12-chain-r10-s4.md
@@ -10,11 +10,11 @@
 
 ```
 researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer
-                                                                                          ↑________________________|  (Round 1-3 QA review; Round 1-5 visual review)
+                                                                                          ↑________________________|  (QA review up to the `qa_round` cap; visual review up to the `visual_round` cap)
 ```
 
-sr-engineer ↔ code-reviewer loops on `(code-reviewer, FAIL)` for up to 3
-rounds (`review_round` cap). The qa-engineer loop back to sr-engineer
+sr-engineer ↔ code-reviewer loops on `(code-reviewer, FAIL)` up to the
+`review_round` cap. The qa-engineer loop back to sr-engineer
 (review Round 1 through the `qa_round` cap) runs `qa_round` independently.
 
 Each role finishes with `tw_update_state` whose first-class `next_role` field names the successor role so the coordinator (or human) knows where to route (`pending_notes` stays free-text prose for the next reader — it carries no routing token).
--- a/content/const-15-core-tail.md
+++ b/content/const-15-core-tail.md
@@ -3,7 +3,7 @@
 - **Fix attempts**: Max consecutive auto-fix tries on the same failure is the `fix_try` cap. Then STOP.
 - **File reads per target**: Max is the `read` cap. Then STOP.
 - **Escalation**: On limit, stop tool use immediately. Report what's missing and wait for human instruction.
-- **Auto-routing hop cap**: per `/teamwork` session, role transitions are capped at the `hop` cap. See `skill-coordinator` §Auto-Routing for the full stop-condition list. Lite mode is exempt (no auto-routing).
+- **Auto-routing hop cap**: per `/teamwork` session, role transitions are capped at the `hop` cap. See `skill-coordinator` §Escalation Routes for the full stop-condition list. Lite mode is exempt (no auto-routing).
 
 ## 6. Security & Privacy
 
```

### 替代 hunk（G2-17d，與 G2-09a 互斥）— `templates/claude-code-agents/release-engineer.md` 瘦身

```diff
--- a/templates/claude-code-agents/release-engineer.md
+++ b/templates/claude-code-agents/release-engineer.md
@@ -6,20 +6,8 @@
 
 CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).
 
-This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively.
+This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively — its Hard rules (STOP on ⛔ rejection, push-rejection STOP, record integrity) and its steps 3a, 7b and 8a are normative there and are not restated here.
 
-Staging scope includes ALL uncommitted upstream work, not just files you edited this turn: stage exactly the enumerated path list in the SOP's step 8a ("Stage explicitly"), existence-pre-filtered as that step prescribes — it is the single normative list, so this file deliberately restates none of it and you never stage from memory or from any shorter list. Before committing, run step 8a's "Pre-commit verify" exactly as written and STOP on any path it reports missing.
-
-Before applying any version bump, `git fetch origin` and re-derive the target version from current `origin/<branch>` HEAD, not from the baseline read at PASS time (SOP step 3a). If HEAD advanced since the PASS, re-baseline the bump off the just-released HEAD version — never improvise a rebase.
-
-CRITICAL: On any ⛔ rejection from any tw_* tool call, STOP immediately and hand back to the coordinator/human. NEVER hand-edit `.current/handoff.md` or `tasks.md` to work around a rejection.
-
-CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP — NEVER `git reset`, `git rebase`, `git checkout --force`, or `git clean`. Write `status=Blocked` with the local release commit SHA in `pending_notes` and hand back to the coordinator/human for recovery.
-
 CRITICAL: If this session has no MCP tool-invocation path at all (no `tw_*` tools reachable), NEVER hand-edit `.current/handoff.md` or `tasks.md` to simulate a `tw_update_state` write. Perform every non-MCP release mechanic normally (fetch/bump/build/test/commit/tag/push/`gh release`), and for each state write the SOP calls for that you cannot make yourself (the opening write, the closing write), state the exact literal `tw_update_state` call — every argument, verbatim values — in your reply, marked with a `RELAY REQUIRED:` prefix, so the coordinator can issue it via MCP. Emit `Done. Released <tag>.` only after a confirmed write (your own read-back, or the coordinator's confirmation that a relayed write landed) — never speculatively.
 
-CRITICAL: Record integrity — describe the diff, not the brief. Every file path named in a commit message, CHANGELOG entry, or release-notes body MUST appear in the `git diff --stat` of the commit being described, and every referenced report/spec path MUST exist on disk at write time. Verify with `ls` / `git diff --stat` immediately before writing each record — never from memory of the dispatch brief. Never claim a code-review or QA round that has no on-disk report.
-
-Before the closing handoff write, append this release's shipped task IDs to `driftBaselineIds` in `.current/.config.json` (deduplicated, create the array if absent) per the SOP's drift-baseline acknowledgment step. Skipping it makes every shipped task resurface as drift noise next session.
-
-Example reply suffix: … — @release-engineer (haiku)
+Example reply suffix: … — @release-engineer (opus)
```
