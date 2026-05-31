# 研究：agent-governance-mcp 自動化開發流程與兩個 prompt 走查

> Depth: deep（未由 coordinator/PM 宣告，因屬全架構走查故採 deep；來源全為 repo 自身原始碼 = T1）
> 範圍：(1) 完整角色鏈與每個 skill 的實作細節/作業流程；(2) prompt「幫我實作一個抽獎小幫手」走查；(3) prompt「根據 PRD 實作產品」走查。

## Summary

- 自動化開發流程 = **三層防禦**（Prompts 注入 → `tw_*` Tools 讀寫狀態 → Guards 強制 pre-flight/freshness/lock），角色鏈由 server 端 `tools/transitions.ts` 的 `ALLOWED_TRANSITIONS` 狀態機**硬性強制**，非建議性。`index.ts:transitions.ts:178`
- 完整鏈：`researcher?(選) → design-auditor?(選) → pm → architect?(複雜時) → sr-engineer ↔ code-reviewer → qa-engineer → PASS`，PASS 後 release-engineer / doc-writer 由人類決定（不自動 hop）。`content/constitution.md §4`
- **「幫我實作一個抽獎小幫手」**：無 PRD、無設計稿 → 跳過 researcher 與 design-auditor → 實務上落在 **pm**（寫 spec+tasks）→ architect（新 app/資料模型）→ sr-engineer ↔ code-reviewer → qa-engineer。coordinator 雖依字面把「實作」對應 sr-engineer，但因無 spec 且為多檔新建，sr-engineer 的 Task-Size/Clarification gate 會回彈到 pm。
- **「根據 PRD 實作產品」**：coordinator 先掃 PRD 找設計來源 → 命中(Figma/mockup) 則先 **design-auditor** 抽 Copy/Token/Widget 表，否則略過 → **pm**（Resource Audit Gate + 在 SQLite 模式 `tw_index_prd` 把 PRD 切塊做 RAG）→ architect → sr-engineer ↔ code-reviewer → qa-engineer。這是教科書級的完整鏈。
- 自動 hop 上限 10 次/session，且在五種 stop condition（Blocked / PASS / `next_role: human` / 無 `next_role:` / hop≥10）任一觸發時交還人類。`content/skill-coordinator.md` Auto-Routing。Lite 模式無自動路由。

---

## Evidence

### A. 三層防禦與狀態機（架構底層）

- **三層**：Prompts（`prompts/build.ts` 打包 `constitution.md`+`skill-*.md`+即時 handoff）；Tools（十個 `tw_*`，讀寫 `.current/handoff.md`、`tasks.md`、SQLite RAG）；Guards（`guards/session.ts` per-process pre-flight、`guards/file-lock.ts` O_EXCL 跨程序鎖、mtime freshness）。`CLAUDE.md` What this repo is。[T1]
- **Pre-flight 強制**：任何狀態變更 `tw_*`（`tw_update_state`/`tw_complete_task`/`tw_rollback_task`/`tw_add_task`）前必須先 `tw_get_state`，否則 server 回 `⛔ BLOCKED`。`content/constitution.md §3`。[T1]
- **狀態機矩陣**：`tools/transitions.ts:89-176` 的 `ALLOWED` Map 定義每個 `(agent:status)` 的合法後繼。`validateTransition()` 優先序：① `agent_id` 必填 → ② round-cap override → ③ 同 agent In_Progress 自迴圈快捷 → ④ 查表。`transitions.ts:236-308`。[T1]
- **三個獨立計數器**（`computeNewRound`, `transitions.ts:335-376`）：
  - `qa_round`：`(qa-engineer, FAIL)` +1；cap=4，第 4 輪只准 `(pm, In_Progress)`。
  - `review_round`：`(code-reviewer, FAIL)` +1；cap=4，對稱熔斷。
  - `visual_round`（v3.14.0）：僅當 `(qa-engineer, FAIL)` 且 `pending_notes` 含 `visual_fail:` 才 +1；cap=6（使用者視角 5 輪）。`transitions.ts:180-186, 365-374`。[T1]
- **PASS 必須帶證據**：`status=PASS` 與 `tw_complete_task` 僅 `agent_id="qa-engineer"` 可發；需 `qa_reports/review_<id>.md`。若設計檔含 `## Visual Baselines`，PASS 另需 `qa_reports/visual_<id>.md`，缺則 server 回 `VISUAL_EVIDENCE_MISSING`/`VISUAL_WIDGETS_UNVERIFIED`。`constitution §3.1`、`transitions.ts:47-51`。[T1]

### B. 每個 skill 的實作細節與作業流程

| 角色 | 觸發 | 產出物 | 核心 gate / SOP | hand-off `next_role` |
|---|---|---|---|---|
| **coordinator**（`teamwork`） | 預設入口 | — | Routing Table + Complexity Scope Gate + Design-source detection + Auto-Routing（hop≤10） | 依分類 switch_role |
| **coordinator-lite**（`teamwork-lite`） | solo 小工作 | — | server-read-only，無 `agent_id`、無鏈、無自動路由；scope creep（≥3 檔/新 API/需測試）→ 建議升 `/teamwork` | 不寫狀態 |
| **researcher** | research/investigate/compare/feasibility | `research/<topic>.md` | depth 由上游宣告（shallow ≤15min/1源；deep ≤60min/≥3源/≥2 tier）；Findings Schema：Summary/Evidence(每條附 `[T1-3]` tier)/Recommendation/Alternatives/Open Questions；Recency Gate（>18mo 標 stale） | pm |
| **design-auditor** | 偵測到 Figma/Sketch/XD/Penpot/mockup/`設計稿` | `design/<feature>.md` | source-agnostic 偵測 mode；逐字 verbatim（不可逐字→`authored-here`）；產 Copy/Strings + Visual Tokens + **Visual Widgets**(widget-shape 啟發式) + 選配 Visual Baselines；≤250 行/pass、≤5 pass；無設計→寫 `mode: no-design` 不 block | pm |
| **pm** | plan/spec/break down/create tasks | `specs/<feature>.md` + tasks | Spec Schema 7 段（含 Copy/Strings、Visual Tokens、Visual Widgets 強制三表）；**Resource Audit Gate**（外部引用 fetch/index/ignore）；**Question Batch Gate**（合併 ≤4 問一次問）；**Ambiguity Gate**（不明→Blocked 不猜）；經 `tw_add_task` 逐筆加任務 | architect（複雜）或 sr-engineer |
| **architect** | design/architecture/interface contract | `specs/<feature>-architecture.md` | Affected Files/Data Structures/Interface Contracts/Sequence Diagram/Decision Records/Deferred Resources/(Visual Harness 當有 Baselines)/Open Questions；Open Questions 非空→必 Block；Visual Harness Gate 檢查 PM 是否排了 `[P0] Build visual-diff harness` | sr-engineer |
| **sr-engineer** | implement/fix/refactor/add feature | 程式碼 | Clarification Gate（不明→1 問即 Block）；Task-Size Check（>5 檔或 >300 行→Block 回 pm 拆）；Design-Aware Pre-Flight（讀 Visual Widgets/Baselines，禁用 HTML primitive 替代）；strict typing；Security Checklist；build ZERO error；**僅以 `pending_notes` 標 ready，不可自行 complete** | code-reviewer |
| **code-reviewer** | review/judge diff | `review_reports/review_<id>.md` | **clean-context**（只讀 diff+spec+architecture，不讀 sr 的 notes/qa 報告以保獨立）；7 段 Schema（Summary/Correctness/Quality/Architecture/Security/Performance/Verdict）；APPROVED→帶 review 證據轉 qa；CHANGES_REQUESTED→FAIL 回 sr（`review_round`+1，3 次後回 pm）；**不可發 PASS** | sr-engineer（FAIL）/ qa-engineer（APPROVED） |
| **qa-engineer** | test/verify/validate/rollback | `qa_reports/review_<id>.md` (+`visual_<id>.md`) | Phase 0 claim → Phase 1 review（**Copy Audit Gate** 逐字比對、**Visual Audit Gate** 逐字面值比對）→ Phase 1.5 Visual Compare（有 Baselines 才 lazy-load `skill-qa-visual`）→ Phase 2 discussion（≤3 輪）→ Phase 3 tests（**唯一可寫測試者**；無既有測試檔需先問人類）→ Phase 4 run；**唯一可 `tw_complete_task`/PASS** | PASS 終止 / FAIL 回 sr / 3 輪後回 pm |
| **qa-visual**（lazy） | qa Phase 1.5 且有 Baselines | `qa_reports/visual_<id>.md` | Step A Widget Shape Checklist（每 widget 一 checkbox，`[ ]`=shape FAIL 先於 pixel diff）→ Step B 逐 baseline 多模態 pixel diff（6 類）；`visual_fail:` prefix 觸發 `visual_round`；此檔即 PASS gate | FAIL 回 sr / baseline 缺回 design-auditor |
| **release-engineer**（非鏈內） | PASS 後人類決定 | package.json/index.ts/CHANGELOG/README/dist | 前提必為 `(qa-engineer, PASS)`；major bump 需明確同意；禁 force push/tag -f；HEREDOC commit；`check-version.mjs` gate；`agent_id` 須冒用上游（qa-engineer，因不在轉移矩陣） | coordinator |
| **doc-writer**（非鏈內） | PASS 後 | README/CHANGELOG/docs/**.md | 只記錄已 ship 的事實（可溯源否則 STOP）；不碰 specs/content/source；`agent_id` 冒用上游 | caller |

來源：`content/skill-*.md`（全 13 檔逐一讀取）。[T1]

### C. Auto-Routing 機制

- 預設 ON（`/teamwork`），`/teamwork-lite` 關閉。每次 hand-off 後讀 `pending_notes` 的 `next_role:`，無 stop condition 即自動 `tw_switch_role`。`content/skill-coordinator.md` Auto-Routing。[T1]
- Stop conditions（任一交還人類）：`status: Blocked` / `status: PASS` / `next_role: human` / 無 `next_role:` 行 / hop≥10。env `AGC_AUTO_ROUTE=0` 可整體 opt-out。[T1]

---

## 走查一：「幫我實作一個抽獎小幫手」

無 PRD、無設計稿、無 research/compare 關鍵字。

1. **coordinator**：`AGC_AUTO_ROUTE` 預檢 → Design-source detection（掃 prompt：無 figma/mockup/`設計稿` → 0 命中 → **design-auditor 整個略過，成本為零**）→ Complexity Scope Gate。
   - 「抽獎小幫手」= 全新多檔 app + 需測試 + 需資料模型決策 → gate 觸發（非 lite 直接執行）。
   - 字面 Routing Table 把「實作」對應 `sr-engineer`，但**無 spec/tasks**。實務兩種等價結果：
     - (a) coordinator 直接判定需先規劃 → `tw_switch_role(pm)`；或
     - (b) 路由到 sr-engineer，sr-engineer SOP step 3 Task-Size Check（>5 檔/>300 行）或 step 2 Clarification Gate → `Blocked, next_role: pm` 回彈。
   - **有效進入點 = pm**。
2. **pm**：問清抽獎規則（人數/權重/去重/動畫/平台）走 **Question Batch Gate**（≤4 問一次 `AskUserQuestion`）；寫 `specs/lucky-draw.md`（含 Copy/Strings、Visual Tokens、Visual Widgets——若是純 CLI 則 Widgets 寫 `N/A` 一列）；`tw_add_task` 逐筆建任務（如 T01 資料模型、T02 抽獎邏輯、T03 UI、T04 防重）。`next_role: architect`（新 app 有資料模型故走 architect）。
3. **architect**：`specs/lucky-draw-architecture.md`——Affected Files、抽獎演算法資料結構、介面契約、（>2 actor 時）sequenceDiagram、Decision Records；無 Visual Baselines 則 **省略 Visual Harness**。Open Questions 空 → `next_role: sr-engineer`。
4. **sr-engineer ↔ code-reviewer**：sr 實作（strict typing、security checklist、build 0 error、`npm audit`）→ `next_role: code-reviewer`；reviewer clean-context 審 diff，APPROVED→qa（附 `review_reports/`），CHANGES_REQUESTED→FAIL 回 sr（最多 `review_round` 3 輪）。
5. **qa-engineer**：Phase 1 Copy/Visual Audit → 無 Baselines 故 **Phase 1.5 skip** → Phase 3 寫測試（抽獎機率分布、去重、邊界 0/1 人、超大名單）→ Phase 4 run → **PASS** + `tw_complete_task`。
6. **終止**：PASS 為 stop condition，自動路由停止；release-engineer/doc-writer 由人類決定是否觸發。

**淨效果**：一句口語 → 自動產出 spec + 架構 + 程式 + 獨立 code review + 測試 + 證據檔，全程狀態機把關，最多約 6-9 hop（<10 上限）。

## 走查二：「根據 PRD 實作產品」

存在 PRD 文件。

1. **coordinator**：Design-source detection 掃 **PRD 內容**——
   - **命中**（PRD 內含 figma.com / `.fig` / mockup / `設計稿` 等）→ 先 `tw_switch_role(design-auditor)`。
   - **未命中** → 略過 design-auditor。
2. **design-auditor**（若命中）：偵測 mode（figma/sketch/pdf/image…）→ 逐字抽出 `design/<feature>.md` 的 Source manifest + Copy/Strings + Visual Tokens + **Visual Widgets**(跑 widget-shape 啟發式) + 選配 Visual Baselines；≤250 行/pass。`next_role: pm`。
3. **pm**：
   - **Resource Audit Gate**（constitution §7）：grep PRD 中所有 `http(s)://`/figma/JIRA/「see <ticket>」等外部引用，逐一分類 fetch/index/ignore——**不可被 architect/sr 私自延後**。
   - **若 design 檔存在** → 把 Copy/Strings + Visual Tokens + Visual Widgets **逐字複製**進 spec（不可改寫）；deferred surface 列入 Dependencies。
   - SQLite/HTTP 模式下以 **`tw_index_prd`** 把 PRD 切塊嵌入做 RAG（`tools/rag.ts`），供下游檢索。
   - Question Batch Gate 合併澄清；Ambiguity Gate 不明則 Block。寫 `specs/<product>.md` + 任務。`next_role: architect`（產品通常 ≥3 模組/新資料模型）。
4. **architect**：完整 blueprint；**若 design 檔含 `## Visual Baselines`** → 強制 Visual Harness 段（Playwright/viewport/pixelmatch threshold/CI 指令/font pinning）並檢查 PM 是否排了 `[P0] Build visual-diff harness`（缺則 Block 回 pm）。`next_role: sr-engineer`。
5. **sr-engineer ↔ code-reviewer**：sr **Design-Aware Pre-Flight**——動工前讀 design 檔、Visual Widgets 列、每個 baseline/impl path；**禁止用 HTML primitive 替代 spec 列出的 widget**（否則屬 scope violation）。reviewer 迴圈同走查一。
6. **qa-engineer（+qa-visual）**：Phase 1 Copy/Visual Audit；**Phase 1.5**——design 檔有 Baselines 故 lazy-load `skill-qa-visual`：Step A Widget Shape Checklist（shape miss → `visual_fail:` → `visual_round`+1 回 sr）、Step B 多模態 pixel diff，產 `qa_reports/visual_<id>.md`（PASS 硬性 gate）；Phase 3 測試 → Phase 4 PASS。
7. **PASS 後**：人類決定 release-engineer（semver/tag/`gh release`）與 doc-writer。

**關鍵差異 vs 走查一**：PRD 觸發 (a) design-auditor 前置抽取、(b) PM 的 Resource Audit + RAG 索引、(c) 視覺評估全鏈（Visual Harness/Widgets/Baselines/`visual_round`）。

---

## Recommendation

向使用者解說時用**一張鏈圖 + 兩條走查路徑**對照最有效：
- 共同骨幹：`pm → (architect) → sr ↔ code-reviewer → qa → PASS`，server 狀態機強制、自動 hop ≤10。
- 兩個 prompt 的唯一分歧在**前置段**：「抽獎小幫手」是零前置（跳過 researcher+design-auditor，PM 從零問規格）；「根據 PRD」是 PRD 驅動（design-auditor 抽設計 + PM RAG 索引 + 全套視覺 gate）。

理由：使用者真正想懂的是「一句話如何變成受治理的產出」，鏈圖回答骨幹、兩走查回答分歧，成本/風險最低且不需額外背景。

## Alternatives Considered

- **逐 tool 逐函式列 API 文件**：被否決——使用者問的是「自動化流程會做什麼」（行為層），不是 tool reference；逐函式會淹沒重點且 `index.ts` 的 zod schema 已自描述。
- **只給鏈圖不走查**：被否決——無法凸顯兩 prompt 的實際分歧（design-auditor 與 RAG 是否觸發），失去提問價值。

## Open Questions

1. **PM 的 `tw_index_prd` RAG 僅在 HTTP/SQLite 模式可用**（`CLAUDE.md`、`tools/storage-sqlite.ts`）。「根據 PRD」走查若跑在預設 file 模式下，PRD 不會被切塊索引——需與使用者確認部署模式才能斷言 RAG 步驟是否發生。
2. **本 workspace 偵測到既有 drift**：`tw_detect_drift` 回報 106 個任務（T01–T307）在 `tasks.md` 已完成但未記入 handoff（前期累積 drift）；且當前 handoff 停在 `(sr-engineer, In_Progress)`、`next_role: human`、`v3.15.0 ready for release`。此為既存狀態，非本研究造成。
3. 兩走查的 hop 數為估計（6-9），實際依 code-review/qa 失敗輪數浮動；未實跑驗證。
