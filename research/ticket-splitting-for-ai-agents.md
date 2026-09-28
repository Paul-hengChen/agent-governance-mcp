# 研究報告 — 如何切票以提高 AI agent 的執行準確率

> 深度：shallow（researcher 單獨呼叫）。日期：2026-06-25。
> 問題：業界一般怎麼切票？一張票（figma url / 描述 / 使用者行為 / 驗收條款）
> 要寫到多詳細，AI agent 執行時準確率才會高？

## 摘要（Summary）

- **業界基準 = INVEST + 垂直切片（vertical slicing）。** 以「端到端的使用者價值」
  切（UI→資料在同一張票），絕不依技術分層切。Bill Wake 的 INVEST
  （Independent / Negotiable / Valuable / Estimable / Small / Testable）至今仍是
  切票檢查表；對 agent 最關鍵的是 **Small（小）與 Testable（可驗）** 這兩條。
- **AI 時代的做法 = spec-driven development（SDD，規格驅動開發）。** GitHub Spec
  Kit / Kiro / Thoughtworks 都收斂到同一個三檔結構：`requirements.md`（使用者故事
  + 驗收）→ `design.md`（架構）→ `tasks.md`（原子化、排序、可平行標記的任務）。
  agent 真正執行的「票」就是 `tasks.md` 裡的一列，且必須「具體到 LLM 不需額外
  上下文就能完成」。
- **詳細程度是 U 形曲線，不是「越多越好」。** 把太多需求塞進同一張票會
  **實測降低準確率**：19 條需求塞進一個 prompt，GPT-4o 掉到 85%，個別需求會被
  默默忽略（最慘 −63.9%）。但過度精簡也會失敗（mis-scope，切錯範圍）。解法是
  **一張票一個關注點 + 只釘死這個關注點需要的值**，而不是大雜燴。
- **互動勝過預先寫滿（Interactivity > specification）。** 讓 agent 在模糊處
  **停下來發問**，比起試圖事前把一切寫死，能多救回 +74% 準確率——這正是
  104445 那次「停下來要 Figma URL」所做的事。
- **所以要寫多詳細：** 詳細到能消除「這一個切片」上的每一個決策點——verbatim
  的值（Figma node/URL、確切文案、預期輸出）、可機器驗證的驗收（Given/When/Then）、
  以及明確的 *out of scope*——但**不要**把一堆不相關的約束全堆進來。多的約束
  往**兄弟票**推，別往同一張票裡塞。

## 證據（Evidence）

- INVEST（Independent/Negotiable/Valuable/Estimable/Small/Testable），Bill Wake
  於 2003 提出；至今仍是切票的標準檢查表。[T3] https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/ ；[T3] https://ones.com/blog/knowledge/invest-criteria-scrum-user-stories-guide/
- 垂直切片＝一個會橫跨所有分層、交付可用行為的變更；依「完整的使用者功能」切，
  而非依 DB/API/UI 分層切，藉此降低依賴，讓未知不會卡住其餘部分。[T3] https://www.visual-paradigm.com/scrum/user-story-splitting-vertical-slice-vs-horizontal-slice/ ；[T3] https://dev.to/jan/user-stories-and-vertical-slicing-1dpo
- SDD 三檔模型（requirements/design/tasks），任務由 contracts + entities +
  scenarios 拆出，互相獨立的任務以 `[P]` 標記可安全平行；「拆解品質直接決定下游
  可靠度」。[T2] https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices ；[T2] https://github.com/github/spec-kit/blob/main/templates/tasks-template.md
- Spec Kit 的 `tasks.md`：「小、原子、可驗、可執行」；每個任務「小到產出容易
  review」、且「具體到 LLM 不需額外上下文就能完成」。[T2] https://github.com/github/spec-kit/blob/main/spec-driven.md
- 過度詳述是反模式：19 條需求一起給 → GPT-4o 平均準確率 85.0%、Llama-3.3-70B
  為 79.7%；37.5% 的需求準確率掉超過 5%，最慘 −63.9%，原因是需求數一多，
  instruction-following 能力就退化、容易漏掉部分需求。[T1] https://arxiv.org/pdf/2505.13360（"What Prompts Don't Say"）；[T1] https://www.cs.cmu.edu/~sherryw/assets/pubs/2025-underspec.pdf
- 過度精簡：任務描述含糊時，agent 會「最佳化錯誤目標或切錯範圍」；含糊／
  未充分指定的指令是被點名的失敗模式。[T1] https://arxiv.org/html/2502.13069v2（Ambig-SWE）；[T2] https://galileo.ai/blog/agent-failure-modes-guide
- 在「未充分指定」的輸入上，互動式（讓 agent 發問）比非互動式多救回最多 +74%
  → 釐清優於事前寫死。[T1] https://arxiv.org/html/2502.13069v2
- 驗收條款應具體且完整（票、bug 描述、開啟的檔案、目前 diff、spec 都當成
  上下文），但必須塞得進 context window；「LLM 在較小、定義清楚的問題上推理得
  更好」。[T1] https://arxiv.org/html/2508.08322v1 ；[T2] https://factory.ai/news/context-window-problem

## 建議（Recommendation）

採用兩階段的「PRD → 票」流程，並對每張票套一個**欄位契約**、限定單一關注點：

1. **第一階段 — PRD 拆解（一次性、人工複審）：** 把 PRD 餵給 agent，產出一份
   由垂直切片組成的 `tasks.md`（一個切片＝一個使用者可見的行為）。互相獨立的
   切片標 `[P]`。**在任何開工前，由人複審這份「切法」——這是槓桿最高的檢查點。**
2. **第二階段 — 每張票的欄位。** 每張票恰好帶：
   - **Figma**：node id + URL（verbatim，不要寫「see design」）——釘到凍結的 node。
   - **描述**：一句話，這個切片交付的單一行為。
   - **使用者行為**：`Given/When/Then` 的 觸發→動作→可觀察結果。
   - **驗收**：可機器驗證的清單；每一條都要能用**一個指令／測試／像素 diff** 證明。
     若某條需要**另一種證明方式**，那它就是另一張票。
   - **Out of scope**：明確排除項（這是擋 scope creep 的關鍵）。
   - **釘死的值**：確切文案字串、hex/sp/dp token、預期輸出——verbatim 並附來源。
     （對應本 repo 的 PM spec schema。）

**詳細程度的拇指法則：** 一張票應控制在 **≤ ~7 條需求 / 一個關注點 / ≤ 5 檔**。
若你正要加第 8 條約束，就**切票**而非**塞票**——超過這點後，準確率下降的速度
比覆蓋率上升還快。同時刻意保留**停下來發問**的缺口（Figma URL、含糊文案），
不要硬把一切事前填滿；那個「釐清的停頓」比多寫的文字更值錢。

這對應到本 repo 既有的 gate：INVEST-Small ≈ `≤5 檔/300 行`；垂直切片 ≈
「一張票 = 一條 AC」；而**過度詳述的 U 形曲線是新發現**，它支持為每張票設一個
**硬性的需求數上限**。

## 已考慮並否決的替代方案（Alternatives Considered）

- **「新模型能吃更大的任務，所以別切了。」** 部分 SDD 文章指出前沿模型能容忍
  更大的任務。否決理由：過度詳述的數據（被忽略需求 −63.9%）顯示，把需求綑在
  一起時可靠度仍會退化，且 diff 越大 review 成本越高。能吃大任務是加分項，
  不是把多個關注點綑進同一張票的許可證。

## 待解問題（Open Questions）

- 過度詳述的準確率數字是 GPT-4o/Llama 的 benchmark [T1]；沒找到 Claude 專屬的
  「需求數 vs 準確率」曲線——~7 條需求的上限是跨模型的保守啟發值，不是針對
  Claude 調校出來的數字。
- 「需要不同證明方式＝不同票」（驗證模式切軸）這條線該畫在哪，文獻沒有定論；
  這是本團隊自己的延伸，應跨數次實跑後再經驗驗證。
