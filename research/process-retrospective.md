# Research: 自動化開發流程回顧 — CDE OOBE「Language」功能

> Topic: 本次 `/teamwork` 鏈在實作 Language 步驟時的耗時、token 消耗、成本、以及 sr↔qa 反覆 reject 的根因與流程優化建議。
> Scope: 單一功能（Language, A.3.1）。資料來源為本 session 的 subagent 遙測（每次 dispatch 回傳的 `<usage>` 區塊）+ 官方定價文件。

---

## Summary

- **總計可量測的 subagent token = 1,052,022**（≈ 1.05M，約等於一個 1M 上下文視窗的 105%，但實際分散在 15 個獨立 subagent context）。**QA 佔 45.7%、sr-engineer 佔 28.8%**，兩者合計 74.5%。
- **55.6% 的 token 花在 4 輪視覺返工（visual_round 1–4）**，而非第一次建置。這直接回答「光是 Language 就燒很多 token」——主因是像素級的逐輪結構修正。
- **活躍處理時間 ≈ 100 分鐘**（15 個 subagent，排除 1 個異常值）；**牆鐘耗時 ≈ 17+ 小時**，因 QA 第 1 輪期間跨越了整夜閒置（日期由 2026-06-09 滾動到 06-10）。
- **成本：以 output token 計約 US$26.3**（最硬的下限）；計入 input + coordinator context + 快取後，**實際帳單估在 US$35–90 區間（低信心）**。
- **sr 被 reject 4 次主要是系統「按設計運作」**（§3.2 禁止用整體 % 通過視覺閘門）+ **缺陷層層遮蔽**（外層位移不修好就量不到內層）+ **規格幾何有損** + **我（coordinator）把每輪修正框得太窄**。

---

## Evidence

所有 token / 工具呼叫 / 耗時數字皆引自本 session 各 subagent 回傳的 `<usage>` 區塊 [T1: session telemetry]。定價引自 `claude-api` skill 之 `shared/models.md` 與 `shared/prompt-caching.md` [T1: Anthropic 官方 skill 文件]。

### 1. 逐次 dispatch 明細（依時間順序）

| # | 角色 / 任務 | subagent_tokens | tool_uses | duration_ms |
|---|---|---:|---:|---:|
| 1 | design-auditor（抽 Figma 設計契約） | 55,404 | 26 | 310,252 |
| 2 | pm（寫 spec + tasks） | 35,376 | 17 | 248,211 |
| 3 | architect（藍圖；blocked 回 pm） | 58,154 | 15 | 276,738 |
| 4 | pm（修 tasks.md harness 排序） | 34,973 | 12 | 62,159 |
| 5 | sr-engineer（實作 T01–T09） | 87,170 | 51 | 446,716 |
| 6 | code-reviewer（APPROVED） | 84,738 | 47 | 213,693 |
| 7 | qa（R1 FAIL：卡片高度，跨夜） | 111,661 | 92 | **56,050,330** ⚠ |
| 8 | sr（修 align-items stretch） | 39,201 | 23 | 134,383 |
| 9 | qa（R2 FAIL：stepper 高度+gap） | 103,496 | 65 | 1,008,728 |
| 10 | sr（重建 stepper widget） | 95,115 | 42 | 719,762 |
| 11 | qa（R3 FAIL：8px 非對稱邊距） | 68,452 | 46 | 520,399 |
| 12 | sr（修 frame justify flex-start） | 48,158 | 23 | 262,205 |
| 13 | qa（R4 FAIL：圓點 8px 左內距） | 69,260 | 42 | 447,289 |
| 14 | sr（修 stepper padding-left 0） | 33,325 | 19 | 348,427 |
| 15 | qa（最終 PASS） | 127,539 | 125 | 976,849 |
| | **總計** | **1,052,022** | **645** | **62,026,141** |

⚠ 第 7 列 duration（56,050,330 ms ≈ 15.57 小時）為異常值：QA R1 期間跨越整夜閒置（系統時間 06-09 → 06-10），屬牆鐘等待而非活躍運算。排除後 14 個 subagent 的活躍時間合計 **5,975,811 ms ≈ 99.6 分鐘**。

### 2. Token 佔比（百分比換算）

依角色彙整（分母 = 1,052,022）：

| 角色 | tokens | 佔比 |
|---|---:|---:|
| qa-engineer（×5 輪） | 480,408 | **45.67%** |
| sr-engineer（×5 次） | 302,969 | **28.80%** |
| code-reviewer | 84,738 | 8.06% |
| pm（×2） | 70,349 | 6.69% |
| architect | 58,154 | 5.53% |
| design-auditor | 55,404 | 5.27% |

依階段彙整：

| 階段 | tokens | 佔比 |
|---|---:|---:|
| 第一次建置（design→…→qa R1，#1–7） | 467,476 | 44.4% |
| **視覺返工（4 輪 sr↔qa，#8–15）** | **584,546** | **55.6%** |

工具呼叫：總 645 次，其中 **QA 370 次（57.4%）**——反映 QA 每輪做大量逐區域像素量測（單是最終 PASS 那輪就 125 次工具呼叫）。

相對基準：總 1.05M token ≈ **單一 1M 上下文視窗的 105%**（但實際分散於 15 個獨立 context，非單視窗）。未設定 token budget，故無「預算百分比」可算。

### 3. 成本換算（Opus 4.8：$5/M in、$25/M out；快取讀 $0.50/M、寫 $6.25/M）[T1]

| 情境 | 假設 | 估算 |
|---|---|---:|
| **Output-only 下限** | subagent_tokens ≈ output（每工具呼叫約 1,020 token，比例合理） | 1.052M × $25/M = **$26.30** |
| 含 input（未快取） | input:output 約 5:1，全價 | + ~$26 → ~$52 |
| 含 input（多數快取讀） | input 大多 $0.50/M | + ~$5–15 → ~$31–41 |
| + coordinator 額外開銷 | 每次 /teamwork 注入完整憲法、claude-api skill 注入 ~40k+ token | 數美元至數十美元，未量測 |

**結論：硬下限約 $26；計入 input 與 coordinator context、扣除快取後，實際帳單合理落在 US$35–90，低信心。**（見 Open Questions。）

### 4. 「為何 Language 燒這麼多」與「sr 一直被 reject」的根因 [T1: 各輪 qa_reports/visual_*.md + sr handoff notes]

- **視覺閘門不看整體 %（憲法 §3.2）**：第 2 輪起整體 diff 已低於 3.5% 門檻（2.13%→1.86%→1.33%→0.92%），但 QA 依規定做 region-weighted 分析，每輪在「已達標」數字底下挖出真實結構偏差。這是憲法刻意防 false-PASS 的設計（源自 `cde-oobe-visual-fidelity-retrospective`）。
- **缺陷層層遮蔽**：卡片內容撐小（巨大位移）→ 遮住 stepper 高度未傳遞 + 缺 gap → 遮住 8px 非對稱邊距溢出 → 遮住圓點自身 8px 左內距。外層不修好，內層量不到，天生需序列發現。
- **規格幾何有損（§1 design-baseline）**：design-auditor 抽了 tokens/VSA，但精確逐元素幾何（40/32 非對稱邊距、圓點貼齊左緣、stepper 填滿傳遞、精確 pitch）未釘進 spec；sr 照 architecture 的「文字」實作，而文字是 Figma 的有損轉錄。
- **coordinator 把修正框太窄**：每輪指示 sr「只改這一個屬性、別碰相鄰」。利於防迴歸，但保證每輪只修一個缺陷——sr 在 stepper 重建輪已看到圓點偏移，卻被要求守在範圍內。等於用「輪數」換「安全」。
- 平心而論：sr 從未謊報通過、每輪主動 flag 殘差、diff 單調收斂；QA 完全盡責。

---

## Recommendation

**首選：在設計階段就把精確幾何釘進 spec，並對 design-backed 功能放寬 sr 的單輪修正範圍。**

具體：
1. **design-auditor / architect 升級**：對 design-backed 功能，從 Figma 直接擷取每個元素的絕對座標、邊距（含非對稱）、圓點/連接線幾何、容器寬度加總（驗證 = 畫布寬），寫成 `## Visual Structural Assertions` 的可量測列。讓 sr 一次就照基準實作，而非 4 輪逼近。
2. **放寬「surgical」對 design-backed 修正的解讀**：給 sr「對齊基準、把你發現的所有結構偏差一次修掉」的 brief（接受小幅迴歸風險），用一點風險換掉 3 輪來回。預估可省下 ~40–50% 的本功能 token（返工佔 55.6%）。
3. **sr 在交給 QA 前先自跑 region-weighted 量測**：把 QA 的逐區域檢查前移到 sr（QA 仍保有最終判定權），減少昂貴的 sr↔qa 往返。
4. 把以上寫進 workspace 的 `CLAUDE.md` / design-auditor 規則，讓後續步驟（Orientation 等）不重蹈。

成本/風險權衡：放寬修正範圍會略增單輪迴歸風險，但 QA 的視覺閘門仍會攔截——淨效應是大幅減少輪數與 token。

---

## Alternatives Considered

- **維持現狀（每輪一個屬性）**：最安全、零迴歸，但本功能因此花 55.6% token 在返工。對單一功能可接受，對 7 步 OOBE 全做會放大 7×，故不建議作為預設。
- **降低視覺門檻或允許 coordinator 預先豁免差異**：被憲法 §3.2 明文禁止（coordinator 不得定義/放寬視覺差異；違者 server 拒絕 PASS）。否決。
- **跳過 design-auditor、直接讓 sr 讀 Figma**：會失去 VSA 契約與 server 端視覺證據閘門，回到 false-PASS 風險。否決。

---

## Open Questions

- **`subagent_tokens` 的確切定義未知**：本報告假設其 ≈ output token（依每工具呼叫 ~1,020 token 的比例推斷）。若其實為「總計費 token」或「含 input」，成本與佔比結論需重算。建議：之後從各 `agent-*.jsonl` 轉錄檔讀 `usage.input_tokens` / `output_tokens` / `cache_*` 以精算。**此為成本估算僅低信心的主因。**
- **coordinator 自身 context 開銷未量測**：每次 /teamwork 注入完整憲法、claude-api skill 注入大量文件，這些不在 subagent_tokens 內。
- 來源信心：本報告硬數字皆 T1（session 遙測 + 官方 skill 定價），無 T3 依賴；唯成本「總帳單」因 input 拆分不明而為估算。
