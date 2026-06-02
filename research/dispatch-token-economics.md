# 自動派發機制比較：Auto Model-Routing vs 單一 Model（同 context）

> 研究主題：agent-governance-mcp 路由鏈在 `/teamwork` 全模式下的兩種自動派發機制，
> 其差異、優缺點、token 成本估算（以 CDE OOBE PRD 為量測標的），以及與業界主流自動化開發流程的差異。
> 深度：**shallow**（standalone 預設；未啟用 `/deep-research` harness）。
> 量測 PRD：`/Users/paul.ph.chen/Downloads/CDE 31-14 OOBE PRD_v1_20260504.docx`（36,084 字元）。

## Summary

- 兩種機制走**同一條** `ALLOWED_TRANSITIONS` 路由鏈，差別只在「換不換 context、換不換 model」：
  **(A) Task subagent 派發**＝fresh context＋frontmatter model-routing（opus/sonnet/haiku 分層）；
  **(B) `tw_switch_role` 派發**＝同 context 累積＋單一 session model 全程。
- 以本 PRD（≈25k tokens）跑一輪乾淨全鏈（design-auditor→pm→architect→sr-eng↔reviewer→qa，6 個 role-turn）估算：
  **(A) ≈145k tokens / ≈US$2.6**；**(B)（全 opus）≈303k tokens / ≈US$4–6**。A 約省 **2× token、1.5–2.3× 成本**。
- 成本差距主因有二：**(1) context 不累積**——大 PRD 只由 pm 載入一次，下游讀「蒸餾後的 spec(~5k)」而非原始 25k；
  **(2) model 分層**——廉價角色（pm/qa→sonnet）不必用 opus 價跑。FAIL 迴圈越多，差距被放大越明顯。
- A 的代價：每次 fresh dispatch 重載 constitution+SOP（~6k×6 次）、且失去跨 turn 的 prompt cache 紅利；
  當 PRD 很小、session 本來就用 sonnet、且零 FAIL 時，兩者差距收斂。
- 對比業界：本架構屬「**role-based 虛擬團隊**」流派（同 MetaGPT/ChatDev），但加了業界少見的
  **server 端狀態機強制（`tw_*` + `ALLOWED_TRANSITIONS`）+ 跨 IDE 共享狀態**；
  與 Devin/OpenHands 的「sandbox 單 agent 跑到底交 PR」是不同範式。

---

## 架構脈絡（前置事實）

路由鏈（Constitution §4）：

```
researcher(選) → design-auditor(選) → pm → architect(若複雜) → sr-engineer ↔ code-reviewer → qa-engineer
                                                                      ↑__________________________|
                                              (qa_round 1-3 回測 / review_round 1-3 / visual_round 1-5)
```

- 7 個角色節點，`tools/transitions.ts` 的 `ALLOWED_TRANSITIONS` 定義 18 條邊 + 3 個 round 斷路器（cap=4/4/6）。
- 每個角色 handoff 時在 `pending_notes` 首行寫 `next_role: <name>`，coordinator 據此自動跳轉（hop cap=10）。

兩種派發機制（`content/skill-coordinator.md` §Auto-Routing 的 preference order）：

| | (A) Task subagent 派發 | (B) `tw_switch_role` 派發 |
|---|---|---|
| 觸發 | Claude Code + 已安裝 `templates/claude-code-agents/` | 其他 client（Cursor/Continue/Anti-Gravity/純 MCP）或未裝 templates |
| Context | **Fresh**（乾淨起步，僅靠 brief + 讀檔還原） | **累積**（看得到全部前序對話） |
| Model | **依 frontmatter 釘選 tier** | **不換**，全程用當前 session model |
| 版本 | v3.20.0+ 首選 | pre-v3.20.0 行為（graceful fallback） |

Model 釘選對照（`templates/claude-code-agents/*.md` frontmatter）：

| Tier | Subagents |
|---|---|
| **opus** | architect, code-reviewer, design-auditor, researcher, sr-engineer |
| **sonnet** | pm, qa-engineer, qa-visual, teamwork(coordinator) |
| **haiku** | doc-writer, lite, release-engineer |

兩者皆受 server 端 `ALLOWED_TRANSITIONS` 逐一把關每次 `tw_update_state`——
**派發機制只改「哪個模型在哪種 context 跑」，不改路由鏈本身**。

---

## 差異與優缺點

### (A) Task subagent 派發（fresh context + model-routing）

**優點**
- **Context 隔離真實有效**：code-reviewer / qa-engineer 在乾淨 context 做對抗式審查，
  不被 sr-engineer 的實作敘事污染——這是 reviewer gate 的設計初衷。
- **成本分層**：重活（實作/審查/研究）給 opus，協調/規格/QA 給 sonnet，廉價單發（doc/release）給 haiku。
- **大 PRD 不重複載入**：原始 PRD 只在 pm 進 context 一次，下游讀蒸餾後的 spec。
- **FAIL 迴圈成本有界**：每次回跳 sr-engineer 都是 fresh，不會把整段失敗史拖著走。

**缺點**
- 每次 dispatch **重載 constitution+SOP（~6k tokens）**，N 個角色就付 N 次。
- **失去跨 turn 的 prompt cache 紅利**（每個 subagent 是冷啟動的獨立 process）。
- 依賴 brief 品質：上游 `pending_notes` 寫不清，下游 fresh context 會「接不住」。
- 需安裝 templates；環境不符就退回 (B)。

### (B) `tw_switch_role` 派發（單 context + 單 model）

**優點**
- **零資訊遺失**：所有角色共享完整對話，brief 寫不清也能從上文補。
- **prompt cache 友善**：累積前綴可被 cache-read（約 1/10 價），降低重複輸入成本。
- **零安裝門檻**：任何 MCP client 都能用，是 graceful degradation 的保底路徑。

**缺點**
- **Context 線性累積**：越後面的角色，輸入 context 越大（本 PRD 估算 qa 時已達 ~69k）。
- **無 context 隔離**：reviewer/qa 看過實作敘事，對抗審查的獨立性被稀釋（lite 模式直接因此**移除** reviewer gate）。
- **無 model 分層**：若 session 用 opus，連 pm/qa 這種可降階的角色也吃 opus 價。
- **FAIL 迴圈成本爆炸**：每次回跳都把成長中的 context 再算一遍。

---

## Token 成本量測（以 CDE OOBE PRD 為標的）

### 量測前提與假設（務必連同數字一起讀）

- PRD 字元數 36,084（`textutil` 實測）。zh-TW 技術文件混大量英文術語，
  以 **≈25k tokens** 為中央估值（區間 20–30k；Anthropic tokenizer 對 CJK 約 1–1.5 token/字，英文約 4 字/token）。
- 假設**一輪乾淨全鏈、零 FAIL**：design-auditor→pm→architect→sr-eng→code-reviewer→qa = 6 個 role-turn
  （此 PRD 含 Figma URL → design-auditor 會觸發）。
- 系統提示（constitution+role SOP）≈6k tokens/turn。各角色產出（output）估值：
  da 3k、pm spec 5k、architect 4k、sr-eng diff 8k、reviewer 2k、qa 3k（合計 ≈25k output）。
- 定價採 2025 年式 list price 量級（**會變動，僅供量級比較**）：
  opus ≈ \$15/\$75 per MTok（in/out）、sonnet ≈ \$3/\$15、haiku ≈ \$0.8/\$4。
- 「input-token-turns」＝各 role-turn 的輸入 context 大小總和（驅動成本的主因）。

### (B) 單 context 累積（全 opus）

每個 turn 的輸入 = 之前所有東西：

| Turn | 累積輸入 ≈ |
|---|---|
| design-auditor | 10k |
| pm（+PRD 25k） | 38k |
| architect | 43k |
| sr-engineer | 55k |
| code-reviewer | 63k |
| qa-engineer | 69k |
| **Σ input** | **≈278k** |

- input 278k×\$15/M ≈ **\$4.17**；output 25k×\$75/M ≈ **\$1.88** → **≈\$6.05**（未計 cache）。
- 計入累積前綴 cache-read，input 實付可降約 40–60% → 總計 **≈\$4**。
- **總 token ≈ 303k**（278k in + 25k out），單一模型。

### (A) Fresh context + model-routing

各角色獨立、不累積；下游讀蒸餾 spec(5k) 而非原始 PRD：

| Turn | 輸入 ≈ | output | tier |
|---|---|---|---|
| design-auditor | 10k | 3k | opus |
| pm（+PRD 25k） | 32k | 5k | sonnet |
| architect | 15.5k | 4k | opus |
| sr-engineer | 23.5k | 8k | opus |
| code-reviewer | 19.5k | 2k | opus |
| qa-engineer | 19.5k | 3k | sonnet |
| **Σ input** | **≈120k** | **25k** | — |

- opus 部分：in 68.5k×\$15/M + out 17k×\$75/M ≈ \$1.03 + \$1.28 = **\$2.31**
- sonnet 部分：in 51.5k×\$3/M + out 8k×\$15/M ≈ \$0.155 + \$0.12 = **\$0.27**
- 總計 **≈\$2.58**；**總 token ≈ 145k**（120k in + 25k out）。

### 結論與敏感度

| 指標 | (A) Task + routing | (B) 單 context opus | A 相對 B |
|---|---|---|---|
| 總 token | ≈145k | ≈303k | **省 ~52%** |
| 估算成本 | ≈\$2.6 | ≈\$4–6 | **省 ~35–57%** |

**敏感度（差距何時收斂 / 放大）：**
- PRD 越大 → B 的累積懲罰越重 → A 優勢**放大**。
- FAIL 迴圈越多 → B 每次回跳重算成長 context → A 優勢**放大**。
- 若 session 本來就用 sonnet（非 opus）→ B 成本大降，兩者**收斂**（model 分層紅利消失，只剩 context 累積差）。
- 角色數越少（小任務）→ A 的 SOP 重載固定成本佔比上升，差距**收斂**。
- B 的 prompt cache 命中率越高 → B input 實付越低，差距略**收斂**（但 cache 不改 model 價差）。

---

## 與業界主流自動化開發流程的差異

**本架構的範式**：role-based 虛擬團隊（pm/architect/engineer/reviewer/qa），與 MetaGPT、ChatDev 同一流派——
MetaGPT 模擬完整軟體公司、指派 PM/Architect/Engineer/QA 角色 [T1]；ChatDev 實作 7 角色虛擬軟體公司
（CEO/CPO/CTO/Programmer/Reviewer/Tester/Designer）[T2]。

**關鍵差異點：**

1. **狀態機 server 端強制 vs 對話式編排**：業界 role-based 框架（AutoGen 多 agent 對話、CrewAI role 團隊）多半靠
   **prompt 約定/對話**串接角色 [T3]；本架構把路由鏈搬到 **server 端 `ALLOWED_TRANSITIONS` 硬性 reject 非法轉移**，
   並用 `tw_*` 工具強制 pre-flight 讀取——這是「治理層」而非「編排層」，業界較少見。

2. **跨 IDE / 跨 session 共享狀態**：本架構透過 MCP server 讓 Claude Code / Cursor / Continue 等多 client
   共享 `handoff.md` / `tasks.md`。業界主流要嘛綁單一 IDE（Cursor agent、VS Code 1.109/1.110 的 multi-agent
   orchestration + parallel subagents，2026/01）[T3]，要嘛綁單一平台。

3. **vs sandbox 單 agent 範式**：Devin（agent-first，sandbox Linux + 自帶 browser/terminal/editor，
   跑完交 PR 給人審）[T3] 與 OpenHands（CodeAct agent + 可替換執行環境/介面，2025 末釋出 Software Agent SDK）[T2]
   是「**一個 agent 端到端跑到底**」；本架構是「**多角色接力 + 每段獨立把關**」。前者重 autonomy，後者重 governance/可稽核。

4. **model 分層派發**：Claude Code Agent Teams（Opus 4.6，2026/02）已支援 agent-to-agent 共享 mailbox 通訊 [T3]；
   本架構的 frontmatter tier-pinning（opus/sonnet/haiku 分層）與此方向一致，屬於 2026 年「**讓對的模型跑對的角色**」的成本優化潮流。

5. **真實落地數據參照**：Devin 在定義良好的任務上 PR merge 率約 67%，但模糊/複雜任務約 85% 需人介入 [T3]——
   呼應本架構的設計取向：**用強制 gate（reviewer/qa/round cap）+ 人在環**換取可靠性，而非追求全自主。

---

## Evidence

- MetaGPT 模擬軟體公司、指派 PM/Architect/Engineer/QA 角色，44,000+ GitHub stars。
  `https://arxiv.org/pdf/2308.00352`（MetaGPT 論文）[T1]
- ChatDev 7 角色虛擬軟體公司（CEO/CPO/CTO/Programmer/Reviewer/Tester/Designer）。
  `https://www.ibm.com/think/topics/chatdev` [T2]
- 2026 多 agent 框架分工（LangGraph stateful / AutoGen 對話 / CrewAI role 團隊 / MetaGPT 軟體開發）；
  VS Code 1.109（2026/01）multi-agent orchestration、1.110 parallel subagents、Claude Code Agent Teams（Opus 4.6, 2026/02）共享 mailbox。
  `https://vibecoding.app/blog/multi-agent-software-development-workflow` [T3]、
  `https://is4.ai/blog/our-blog-1/top-12-multi-agent-ai-frameworks-2026-335` [T3]
- Devin agent-first sandbox 架構、PR 交付、67% merge / 85% 複雜任務需人介入；
  OpenHands CodeAct agent + 可替換執行環境/介面（2025 末 Software Agent SDK）。
  `https://toolhalla.ai/blog/devin-vs-openhands-vs-swe-agent-2026` [T3]、
  `https://agentstant.com/tools/opendevin/` [T3]
- 本架構事實來源（程式碼）：`tools/transitions.ts`（ALLOWED_TRANSITIONS / round caps）、
  `content/skill-coordinator.md` §Auto-Routing、`templates/claude-code-agents/*.md`（model frontmatter）。[T1, 本 repo]
- PRD 規模：`textutil -convert txt` 實測 36,084 字元。[T1, 本機檔案]

## Recommendation

**預設採 (A) Task subagent 派發**，理由：本類 PRD（中大型、UI、含 FAIL 迴圈可能）正好命中 A 的兩大優勢
（context 不累積 + model 分層），估算省 ~50% token、~35–57% 成本，且 reviewer/qa 的對抗審查獨立性是 governance 價值的核心。
**(B) 僅作 fallback**：當 client 不支援 subagent、或任務極小（單角色、零 FAIL、session 已是 sonnet）時，
B 的 cache 紅利與零安裝門檻使其足夠且不劣。

實務 checklist：
- 安裝 `templates/claude-code-agents/` 以啟用 A；確認 `AGC_AUTO_ROUTE` 未設為 `0`。
- 上游務必把意圖寫進 `pending_notes` brief——A 的成敗繫於此。
- 大 PRD 先 `tw_index_prd`（RAG）讓下游檢索而非全文重載，進一步壓低 A 的 pm-turn 成本。

## Alternatives Considered

- **全程單一 opus + 單 context（B 的極端）**：資訊最完整、實作最省心，但成本最高且無對抗審查獨立性——
  僅適合極高風險、需全程連貫推理的單一複雜任務，不適合本類多角色 PRD。
- **全程 haiku 省到底**：成本最低，但 architect/sr-eng/reviewer 等重推理角色品質不足，FAIL 迴圈反而增加總成本——否決。

## Open Questions

- **Token 估值未經實跑校準**：以上為 heuristic 模型（PRD token 數、各角色 output、cache 命中率均為假設）。
  建議實跑一次完整 `/teamwork` 並從 API usage 回填真實數字校正係數。
- **本報告產業對比的二手來源多為 T3**（vibecoding / toolhalla / agentstant 等彙整型部落格）；
  MetaGPT[T1]/ChatDev[T2] 為高可信，但 Devin/OpenHands 的 merge 率、VS Code/Claude Code 版本里程碑等
  數字宜以官方文件再核實。
- prompt cache 對 (B) 的實際折扣率高度依賴 client 行為與 TTL，未納入精算。
