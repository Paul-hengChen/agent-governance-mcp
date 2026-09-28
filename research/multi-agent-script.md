# Research: multi-agent-script(Antigravity PM/Design → Claude Build/QA 跨 CLI 流程)

> 研究深度:**shallow+(手動多源)**。本報告**未**啟動 `/deep-research` harness(該 harness 約 100+ 驗證子代理、>1M tokens,屬 token-expensive,依 researcher SOP 需先取得使用者確認)。改以 8 組定向 web search(2025–2026 來源)+ 程式碼/評估文件交叉佐證撰寫。若需更高強度的對抗式驗證,可再請求 deep。

---

## Summary

- **核心構想成立且有業界共識支撐**:用 Antigravity CLI(Gemini 3 Pro)跑 PM/Design、Claude CLI 跑 build/QA,靠 agent-governance-mcp 的 file-based handoff(`.current/handoff.md` + `tasks.md`)接力。交接協議是 file-based + CLI-agnostic,所以跨 CLI 天然可行,server 不需改。
- **token 分擔的經濟效益是真實的,但幅度取決於切分點**:把 PM/Design 這段「探索性、token 密集」的工作移到 Gemini 3 Pro(輸入 $2/$12 vs Claude Opus 4.8 $5/$25),在規格探索階段每百萬輸出 token 約省 50–52%。但 Anthropic 自己的數據顯示 multi-agent 之所以贏,主因是「花更多 token」——所以這套流程省的是**單價**,不是**總量**;若導入額外協調 overhead,總成本不一定下降。
- **Antigravity 擔任 PM/Design 有真實優勢**:Gemini 3 Pro 在 WebDev Arena 居首(1487 Elo),且 Antigravity 內建 browser computer-use + Artifacts(task list / implementation plan / 截圖),對「設計規格 + 視覺驗證」這類產出契合度高於純文字 CLI。
- **最大的結構性風險是「跨 agent 上下文遺失」**:這正是 Cognition《Don't Build Multi-Agents》(2025-06)點名的多代理頭號失敗模式——子代理在「未對齊的假設」上行動。你的單程交接 + discussion-summary 注入正好是對策,但必須做扎實。
- **與業界趨勢的關係**:你在重造「OpenAI Agents SDK 的 handoff」「Google A2A 的 horizontal 協作」這類模式,但用的是 file-based bus 而非 in-process / 標準協議。對單機、跨 IDE 的個人開發場景,file-based 反而更簡單;對企業級多廠商互通,A2A 才是收斂方向。

---

## Evidence

### 1. 跨 CLI handoff 的可行性(專案內證據)
- 交接機制是檔案系統:`tools/storage.ts` 的 `HandoffStorage` + `.current/handoff.md`/`tasks.md`;pre-flight guard 為 per-(process, workspace)(`guards/session.ts`),換 CLI 不會破壞。[T1 — 本 repo `CLAUDE.md` / `tools/`、`multi-agent-scripts/*_evaluation.md`]
- 切分點 `pm → architect/sr-engineer` 正落在 `ALLOWED_TRANSITIONS` 既有轉換邊(`tools/transitions.ts`),狀態機無需修改。[T1 — 本 repo]
- 已知限制:單程交接;QA→PM 返工時 Antigravity 已關閉,需人工重啟(`cross_cli_handoff_evaluation.md` §4 自陳)。[T2 — 專案評估文件]

### 2. Multi-agent 的 token 經濟學
- Anthropic Research 採 orchestrator-worker:lead agent 規劃 → 3–5 個並行 subagent → 獨立 citation pass;內部 eval 上比單代理 Opus 4 高 **90.2%**,代價約 **15× 一般 chat 的 token**。token 用量單獨解釋 BrowseComp 變異的 **80%**。結論:multi-agent 經濟性只在「任務價值高到足以付溢價」時成立。[T1 — Anthropic, "How we built our multi-agent research system", anthropic.com/engineering/multi-agent-research-system]
- 重要推論套用到你的場景:你的設計不是「並行 fan-out 燒更多 token」,而是「sequential 把同一段工作換到更便宜的模型」——所以省的是單價,風險是協調 overhead 抵銷掉節省。

### 3. 模型單價(2026-06,撰寫時)
| 模型 | 輸入 $/1M | 輸出 $/1M |
|---|---|---|
| Gemini 3 Pro(≤200K context) | $2.00 | $12.00 |
| Gemini 3 Pro(>200K context) | $4.00 | $18.00 |
| Claude Opus 4.8 | $5.00 | $25.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $5.00 |

[T1 — ai.google.dev/gemini-api/docs/pricing;platform.claude.com/docs/en/about-claude/pricing / 本 session claude-api skill model 表]
- 解讀:PM/Design 階段移到 Gemini 3 Pro,輸出 token 單價約為 Opus 4.8 的 48%($12 vs $25)。但若 PM 只需中等智能,在純 Claude chain 內也可把該階段 pin 到 Sonnet 4.6($3/$15)甚至 Haiku($1/$5)——**這是「跨 CLI」必要性的關鍵反論**:省錢若靠 model-pinning 就能達成,未必需要第二個 CLI。

### 4. Antigravity 擔任 PM/Design 的效果
- Antigravity 是 Gemini 3 驅動的 agent-first IDE:agent 可自主規劃、寫碼、用內建 browser(Gemini 2.5 Computer Use)驗證;產出 **Artifacts**(task list、implementation plan、截圖、browser recording)供人類一眼審查。[T1 — developers.googleblog.com/build-with-google-antigravity;antigravity.google/blog]
- Gemini 3 Pro 基準:WebDev Arena 1487 Elo(榜首)、Terminal-Bench 2.0 54.2%、SWE-bench Verified 76.2%。設計/前端與規格產出契合度高。[T2 — blog.google/products/gemini/gemini-3]
- 對 PM/Design 的優點:(a) Artifacts 天然對應 PRD/task-list/design-spec 產物;(b) browser computer-use 利於視覺/設計審查;(c) 單價較低。
- 缺點/未知數:(a) 需確認 Antigravity 能連同一個 agent-governance-mcp server 並正確 `tw_switch_role("design-auditor")`(`dual_agent_evaluation.md` 列為待驗證前提);(b) `skill-design-auditor.md`(~17KB,Figma baseline、Visual Structural Assertions)是重角色,Antigravity 對該 SOP 的遵從度未經驗證;(c) Gemini 系家族的指令遵從/輸出風格與 Claude 不同,role-prompt 可能需要調校。[T2 — 專案評估文件 + repo `content/skill-design-auditor.md`]

### 5. 上下文遺失 —— 多代理的頭號失敗模式
- Cognition《Don't Build Multi-Agents》(2025-06):多代理在「子代理基於未事先建立的衝突假設行動」時極易失敗;失敗幾乎都歸因於系統內 missing context。主張單執行緒 + 獨立壓縮 LLM,核心是 **context engineering**。[T2 — cognition.ai/blog/dont-build-multi-agents]
- 與 Anthropic 同日(2025-06-13)對打,形成「該不該建多代理」之爭;雙方共識點:**多代理成敗取決於上下文工程**。[T2 — news.smol.ai/issues/25-06-13-cognition-vs-anthropic]
- 對你的設計的意義:你的「方案 A(discussion-summary)+ 方案 B(pending_notes)」混合注入,正是 context engineering 的具體落地;這不是可選項而是這套流程能否成功的決定因素。原始 transcript 注入(方案 C)被正確否決——token 災難 + 噪音。

### 6. HITL 觸發點設計
- 業界最佳實務:HITL 的「位置」比「有沒有」更關鍵;最可靠模式是 propose-then-commit 硬分離(儲存結構化動作 → 加 precondition/idempotency 檢查後才執行)。規劃階段前應有結構化 briefing(mission/roles/abort criteria)。[T2 — arxiv.org/pdf/2509.08646;stackai.com / permit.io HITL guides]
- 對你的設計的意義:「PM 跑完 → 使用者審 spec → 手動跑 handoff.sh 啟動 Claude」這個 gate,正是 propose(Antigravity 產 spec)→ commit(人核可後啟 build)的標準形,且把 token 浪費風險擋在 build 之前。

### 7. 與業界最新 multi-agent 的差異
- **OpenAI Agents SDK**(2025-03 取代 Swarm):核心抽象就是 **handoff**——agent 顯式移交控制權並攜帶對話上下文。你的 `next_role` + handoff.md 是同一概念的 file-based 版本。[T2 — getmaxim.ai / pecollective 框架比較]
- **LangGraph / CrewAI / AutoGen**(2026 仍主流):LangGraph = graph-based stateful、CrewAI = role-based team、AutoGen = conversational。你的「固定角色鏈 + 狀態機」最接近 CrewAI 的 role 分工 + LangGraph 的 state machine,但跑在跨 process / 跨 IDE 的檔案匯流排上。[T2 — pecollective.com;latenode.com 2025 比較]
- **Google A2A**(2025-04 起,現由 Linux Foundation 維護;2026-04 已 22K stars、150+ production orgs):標準化「horizontal」agent↔agent 協作,MCP 則是「vertical」agent↔tool。你目前用 file-based bus 取代 A2A 的線上協議。[T1/T2 — onereach.ai;digitalapplied.com agent protocol map 2026]
- **定位結論**:你的方案在「單機、個人、跨 IDE、人類在環」這個象限,file-based + 既有 governance 狀態機其實比拉進 A2A/in-process framework 更省事;但它**不可橫向擴展**到多廠商/多機器企業協作——那是 A2A 的領域。換句話說,這是一個刻意小而專的設計,不是 A2A 的競品。

---

## Recommendation

**推薦:採用「Antigravity(PM/Design)→ 人類審查 gate → Claude(build/QA)」的單程、使用者觸發流程,但先做一次連線實測再寫腳本。** 理由:

1. **成本/效益正向**:PM/Design 移到 Gemini 3 Pro 省單價(輸出約 -52% vs Opus 4.8)+ Antigravity 的 Artifacts/browser 對規格與視覺產出契合;切分點落在既有狀態機轉換邊,server 零改動。
2. **單程是對的取捨**:QA 返工多數回 sr-engineer(留在 Claude 內);真正回 PM 的返工罕見。為雙向自動迴圈加複雜度不划算(Anthropic/Cognition 都指出協調 overhead 是 multi-agent 的主要成本與失敗源)。
3. **HITL gate 是淨賺**:符合 propose-then-commit 業界實務,把「PM 誤解需求 → 燒 build token」的風險擋在 commit 前。
4. **必做的前置驗證(阻斷性)**:用一個小 feature 實測 `agy` 能否連同一 agent-governance-mcp server、`tw_switch_role("design-auditor")` 能否正確載入 SOP、handoff.md 寫出是否合規。此前提不過,後續腳本全部白做。
5. **context engineering 不可省**:落實「pending_notes(結構化 todo)+ `.ai-pipeline/00-discussion-summary.md`(脈絡)」雙注入;這是這套流程成功與否的決定因素,不是 nice-to-have。

實作順序:(0) 連線實測 →(1) `pipeline.sh` 串接 →(2) review gate →(3) 對話框觸發的 osascript wrapper。

## Alternatives Considered

- **純 Claude chain + model-pinning(把 PM/Design pin 到 Sonnet 4.6/Haiku)**:若導入跨 CLI 的唯一目的是省 token,這個方案在單一 context 內就能達成成本目標,無協調 overhead、無上下文遺失風險、無連線前置驗證。**否決理由**:使用者的目標包含「Antigravity 在 PM/Design 品質/體驗可能更好」(Artifacts、browser、Gemini 3 設計能力),這是 model-pinning 給不了的——故跨 CLI 的價值不只在價格。但若日後實測發現 Antigravity 品質優勢不顯著,應退回此方案。
- **雙向自動 handoff(QA fail 自動重啟 Antigravity)**:否決——返工回 PM 罕見,雙向自動化複雜度高、踩 session freshness/TTY 巢狀,且放大上下文遺失面;違反 MVP。
- **Agent 自我偵測 model 名稱自動觸發**:否決——字串匹配脆弱、Antigravity 上也可能跑 Claude model;`cross_cli_handoff_evaluation.md` 與 HITL 文獻都指向「使用者主動觸發」更安全可控。
- **A2A / in-process framework(LangGraph 等)**:否決(現階段)——為單機個人跨 IDE 場景引入線上協議或框架是過度工程;file-based bus 已足夠。保留為「未來需多機/多廠商協作」時的升級路徑。

## Open Questions(交給 PM/人類)

1. **Antigravity ↔ agent-governance-mcp 連線是否實證可行?** 整套流程的單點依賴,尚未驗證(阻斷性)。
2. **Antigravity 對重角色 SOP(design-auditor ~17KB)的遵從度?** Gemini 3 的指令遵從特性與 Claude 不同,role-prompt 可能需重新調校。
3. **跨 CLI 的實際省額是否大於協調 overhead?** 建議用一個小 feature 端到端量測(記錄兩段各自 input/output tokens × 各自單價),再決定是否值得維護兩套 CLI。
4. **context window 計價邊界**:Gemini 3 Pro 在 >200K context 價格跳到 $4/$18;PM 階段若注入大量 PRD/Figma 內容是否會越過 200K,影響省額試算。
5. **本報告所有市場數據(價格、基準、框架版本)為撰寫時(2026-06)快照,且部分為 T2/T3 來源**;正式決策前對「Antigravity MCP 支援度」「Gemini 3 Pro 定價」建議以官方文件二次確認。
