# 架構 / 憲法 / Skills vs. 業界主流，以及 token 節省精神（中文）

> Researcher findings。Depth: **shallow**（standalone 預設，未啟動 `/deep-research` harness）。
> 方法：複用既有 deep 研究檔 `research/agent-governance-framework-industry-comparison.md`（其底層為 15+ T1/T2 來源、104 條對抗式驗證主張）＋ 直接讀本 repo 程式碼作為一手來源。
> Date: 2026-05-31。

## Summary

- **本框架在 Anthropic 分類學裡是「workflow」而非「agent」** —— 由程式碼路徑（server 強制的 routing chain ＋ `ALLOWED_TRANSITIONS` 狀態機）編排 LLM，而非讓 LLM 自我導引。這是站得住腳的設計選擇。[T1]
- **角色模型是主流且被驗證過的**：pm/architect/sr-engineer/qa-engineer 幾乎 1:1 對應 MetaGPT 的流水線 SOP 角色、結構上近似 ChatDev 的瀑布式 chat-chain。但**「server 強制」的轉移驗證比 MetaGPT / ChatDev / OpenAI Agents SDK 更強**（後者多為 advisory / model-driven）。[T1]
- **「Constitution」命名已被業界佐證**（GitHub Spec Kit 出貨 `.specify/memory/constitution.md`），但需與 Anthropic 的 *training-time* Constitutional AI 區隔——本框架是 *runtime / operational* constitution。[T1]
- **vs. 2025–2026 best practice 的三大缺口**：(1) 無平行 agent 執行、(2) 無 evaluation / observability 層、(3) 無 model-routing / 成本控管。Anthropic 自家 orchestrator-worker 平行系統較單 agent 高 90.2%、研究時間省最多 90%。[T1]
- **token 節省精神：有，且是刻意的工程主軸，但有一個結構性反例。** 多處實作（drift 壓縮、`pending_notes` / `completed_tasks` 截斷、RAG 分塊、憲法逐版壓縮、v3.16.1 shallow 預設）證明節省是 first-class 考量；唯一反例是 SessionStart hook **每個 session 都全量注入** constitution＋skill bundle，這與 Anthropic「always-on 規則要精簡、其餘走 on-demand skill」的指引相左。[T1][repo]

## Evidence

### 與業界主流的差別（複用既有 deep 研究檔）

- 完整對照（MetaGPT / ChatDev / OpenAI Agents SDK / LangGraph / CrewAI / AutoGen / Kiro / Spec Kit / AGENTS.md）見 `research/agent-governance-framework-industry-comparison.md` Q1–Q5，此處不重述。其核心結論：**enforcement 領先業界、缺 observability/平行/model-routing**。[T1]
- 關鍵差異點：本框架 routing 是 server 強制的 `ALLOWED_TRANSITIONS`（`tools/transitions.ts`）＋ evidence-gated PASS（`tools/evidence-file.ts`），而 OpenAI SDK 的 handoff「以 tool 形式交給 model 自行選擇」、ChatDev 純對話、MetaGPT 為 advisory SOP。[T1]

### token 節省精神（本 repo 一手證據）

- **Drift 壓縮**：`tools/drift.ts:35-85`，當多筆 drift 共用同一 pattern 時合併，避免 20+ 重複行灌爆 context——註解標明「~500 tokens saved per」。[repo]
- **handoff 回傳截斷**：`tools/handoff.ts:218-236`，`completed_tasks` 有 `COMPLETED_TASKS_RETURN_LIMIT`、`pending_notes` 以字元預算 `PENDING_NOTES_CHAR_LIMIT` 截斷並標 `…[truncated]`。[repo]
- **RAG 分塊取代整份 PRD 注入**：`tools/rag.ts:43` `MAX_CHUNK_CHARS = 2048 // ~512 tokens`，HTTP/SQLite 模式以檢索片段取代全文傾倒。[repo]
- **憲法 / skill 逐版瘦身**：commit `f4742d3`（壓縮 §3.1 省 ~185 tokens/prompt）、`13e40c1`（移除重複規則陳述以省 token）、`05e02d6`（qa-visual 子技能拆分作 token-efficiency）、`f2c8ef0`（drift 壓縮＋pending_notes 截斷）、v3.13.0 含「token-frugality audit」。[repo]
- **憲法本身禁止冗詞**：constitution §1「NO YAPPING / Terse ≤15 words / Tool-First」，skill 不得 restate 憲法規則——這是 prompt 層的 token 紀律。[repo]
- **v3.16.1 shallow 預設**：standalone researcher 不再自動 spawn `/deep-research`（典型一次 >1M tokens），deep 改 opt-in 且啟動前須警告成本。[repo / CHANGELOG]
- **反例（context budget）**：`bin/agent-governance-context.mjs` 的 SessionStart hook 每個 session 注入 constitution＋skill＋state 區塊；憲法約 100 行，已達 Anthropic 建議 always-on 上限。Anthropic：「臃腫的 CLAUDE.md 會讓 Claude 忽略你真正的指令」、domain 知識應走 on-demand skill。本框架走全量注入。[T1][repo]

## Recommendation

**結論：架構健全、在 enforcement 上領先；token 節省「有意識且有實作」，但下一步應把焦點從「逐版微調 prompt」轉到「結構性的 always-on 預算」。**

1. **量測 always-on 成本**（最高槓桿、低風險）：確認每 session 實際注入的 constitution＋skills token 數，評估能否將不常用 skill 改為 on-demand（progressive disclosure），而非全量注入。對應既有 deep 檔的 Open Question。
2. **加 observability 層**：每次 `tw_*` 轉移發 trace event（role/round/tokens/duration/outcome）——這同時是「業界最大缺口」與「量化 token 成本的前提」。
3. **per-role model-routing**：researcher/code-reviewer = Opus、sr-engineer = Sonnet、status/doc = Haiku，直接降成本。

## Alternatives Considered

- **重跑 `/deep-research` 產生全新對照**：*否決*。既有 deep 檔（104 條已驗證主張）已覆蓋此題，且使用者明確要求節省 token；重跑等同違反剛上線的 v3.16.1 shallow 預設精神。
- **只口頭回答、不落檔**：*否決*。researcher 角色契約要求 findings 落 `research/<topic>.md` 且每條 claim 附來源。

## Open Questions

- **always-on 實際 token 數未量測**：憲法＋skill bundle 每 session 全量注入的真實成本仍未測（須對 `prompts/build.ts`＋`bin/agent-governance-context.mjs` 量測），這是 token 精神唯一未補強的結構缺口。
- **競品機制細節部分依賴 T3**：LangGraph/CrewAI/AutoGen 的細節屬 practitioner blog（T3），視為方向性而非權威；Anthropic/OpenAI/MetaGPT/Spec-Kit 核心為 T1。
- **未做 outcome benchmark**：本比較針對「設計慣例」，未對 token 成本或任務結果做 head-to-head 實測。
