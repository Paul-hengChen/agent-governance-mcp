# 五大燒 token 情況的解法（中文）

> Researcher findings。Depth: **shallow**（standalone 預設，未啟動 `/deep-research`）。
> 方法：複用 `research/agent-governance-framework-industry-comparison.md` 的 T1 來源（Anthropic context-engineering / building-effective-agents / Claude Code docs）＋ 直接讀本 repo 程式碼。對應前一輪列出的五個燒 token case。
> Date: 2026-05-31。

## Summary

- **五項裡有四項已有現成解法，且多數不需改架構**——最大槓桿是 **prompt caching**（把常駐 bundle 放進可快取前綴）＋ **on-demand skill（progressive disclosure）**。
- **#1 bundle 每輪重注入** → prompt caching（快取命中近乎免費）＋ 拆「精簡常駐憲法 / 按需載入 skill」。這是唯一「每輪都付且可結構性削減」的成本，**最該做**。[T1][repo]
- **#2 context rot** → 本框架已用 `handoff.md`/`tasks.md` 做 external memory（Anthropic 推薦的 structured note-taking 範式）；再配 compaction ＋ 任務間 `/clear`。[T1][repo]
- **#3 多 agent fan-out** → 子代理回傳「壓縮後 1–2k token 摘要」而非原始 context、per-agent Haiku model-routing、按複雜度決定代理數（勿過度拆解）。[T1]
- **#4 鏈＋重試迴圈** → circuit breaker 已封頂（`qa_round`≤3、`visual_round`≤5、hop cap 10、fix≤2）；caching 攤平每次轉移的 bundle 重載；不需鏈的工作走 lite 模式。[repo]
- **#5 反覆讀大檔** → 讀區段（offset/limit）而非整檔、RAG 檢索取代整份 PRD 傾倒（已實作）。[T1][repo]

## Evidence

### #1 — bundle 每輪重注入

- **Prompt caching（最高槓桿）**：常駐的 constitution＋skill 是穩定前綴，正是 Anthropic prompt cache 的理想標的；快取命中時該前綴幾乎不計費（5 分鐘 TTL）。屬 API/harness 設定，**零架構改動**。— Anthropic prompt caching docs [T1]
- **Progressive disclosure / on-demand skill**：Anthropic 明言「always-on 規則要精簡、domain 知識走 on-demand skill，避免每段對話都膨脹」；Agent Skills 標準採 metadata→SKILL.md body→linked files 漸進揭露，SKILL.md <500 行。對應拆分本框架目前全量注入的 `bin/agent-governance-context.mjs` + `prompts/build.ts`。— Anthropic context-engineering / Agent Skills [T1]
- 已持續瘦身：commit `f4742d3`（§3.1 省 ~185 tokens）、`13e40c1`（移除重複規則）。[repo]

### #2 — context rot（長對話累積）

- **External memory 已內建**：`tools/handoff.ts` 的 `handoff.md` ＋ `tasks.md` 即 Anthropic 推薦的「structured note-taking to external memory」——狀態可從檔案重建，不必靠全 transcript。這正是本框架的設計強項。— Anthropic context-engineering [T1][repo]
- **Compaction**：Claude Code 自動壓縮舊回合；跨無關任務用 `/clear` 重置。— Claude Code docs [T1]
- 已做截斷：`handoff.ts:218-236`（`completed_tasks` 上限、`pending_notes` 字元預算）。[repo]

### #3 — 多 agent fan-out

- **壓縮摘要回傳**：Anthropic sub-agent 在隔離 context 跑、回傳 1,000–2,000 token 濃縮摘要，避免把子代理的原始 context 灌回主線。— Anthropic context-engineering [T1]
- **Model-routing**：Claude Code 支援 per-subagent 選模型「routing 到更便宜的 Haiku 以控成本」＋ per-agent tool allowlist 縮 context。— Claude Code docs [T1]
- **勿過度拆解**：OpenAI「能用一個 agent 就用一個；過早拆分只增 prompt/trace/審批面而未必更好」。代理數應按複雜度縮放。— OpenAI Agents guidance [T1]

### #4 — `/teamwork` 鏈 ＋ 重試迴圈

- **已封頂**：`tools/transitions.ts` 的 `qa_round`≤3、`review_round`≤3、`visual_round`≤5、constitution §5 hop cap 10 / fix≤2——重試的 token 乘數有硬上限，符合 Anthropic「設停止條件以維持控制」。[repo][T1]
- **Caching 攤平**：每次 role 轉移重載的 bundle 命中快取後成本趨近零（見 #1）。
- **不需鏈就走 lite**：單檔/Q&A 用 `/teamwork-lite`，完全跳過鏈與 code-reviewer gate。[repo]

### #5 — 反覆讀大檔

- **讀區段**：用 Read 的 offset/limit 讀必要行，而非整檔（如 `dist/index.js`）。circuit breaker 每目標 3 次的上限是封頂、非優化。[repo]
- **RAG 檢索已實作**：`tools/rag.ts` `MAX_CHUNK_CHARS=2048`，HTTP/SQLite 模式以 PRD 片段檢索取代整份注入。[repo]

## Recommendation

**按「槓桿 ÷ 風險」排序，建議順序：**

1. **確認 / 啟用 prompt caching 於常駐前綴（最高 CP 值，零架構改動，低風險）。** 這直接同時打掉 #1 與 #4 的主成本——每輪重注入與每次轉移重載。若 harness 已快取則先量測命中率；未快取則把 constitution＋skill 排成穩定前綴。
2. **拆「精簡常駐憲法 / on-demand skill」（高值，中工，低風險）。** 把不常用 skill 改 progressive disclosure，只在 role 啟用時載入 body。需先量測目前每 session 注入的實際 token 數（既有 deep 檔的 Open Question）。
3. **多 agent 場景強制「壓縮摘要回傳 ＋ Haiku routing ＋ 代理數隨複雜度縮放」（高值，中工）。** 針對 #3。
4. **維持現有 circuit breaker，不需新增**（#4 已被結構性封頂）；#2、#5 屬使用紀律（compaction/`/clear`、讀區段），靠習慣與既有 RAG 即可。

核心結論：**這些問題大多「已被緩解」或「用現有 Claude Code 原語可解」，唯一真正待辦的結構項是「量測並拆分常駐 bundle ＋ 確保 caching」。**

## Alternatives Considered

- **重跑 `/deep-research` 重新蒐證**：*否決*。既有 deep 檔已含本題所需 T1 來源（context-engineering、building-effective-agents、Claude Code docs），重跑違反 shallow 預設與使用者反覆強調的 token 節省。
- **改造成全自主 agent 以「自行省 token」**：*否決*。違反 workflow-vs-agent 治理定位，且自主性反而增加不可預測的 token 消耗。

## Open Questions

- **prompt caching 現況未量測**：harness 是否已快取常駐前綴、命中率多少，未經實測——這是第 1 建議的前置。
- **常駐 bundle 實際 token 數未量測**：每 session 注入量須對 `prompts/build.ts` ＋ `bin/agent-governance-context.mjs` 量測後才能定 on-demand 拆分範圍。
- **prompt caching 細節依文件、未本輪 fetch**：5 分鐘 TTL 與計費為已知 Anthropic 功能（T1），但本輪未重新抓取最新定價/限制，視為方向性。
- **#3 解法為業界 best practice、未在本框架實測**：本框架目前無平行執行，故 #3 屬「若未來導入平行時」的前瞻解法。
