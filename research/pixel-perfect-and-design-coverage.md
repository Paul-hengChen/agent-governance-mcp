# Pixel-Perfect Enforcement & Design Coverage Gaps

> @researcher · 2026-05-22
> Source: Codebase analysis + web research on Figma MCP, visual regression testing, LLM vision pricing

## Summary

- **Root cause 1 (漏看)**: Design-auditor 有 ≤250 行 / max 5 file reads 限制，且只抓「當前 task 相關的 frames」，多畫面功能必然漏掉 frames。
- **Root cause 2 (非 pixel-perfect)**: 現有 QA 只做 literal-value grep（hex/sp/dp），無法偵測 layout、spacing、alignment、元件遺漏等視覺差異。
- **解法分三級**：A) 低成本結構化增強（改 auditor 行為），B) 中成本 vision-LLM 截圖比對，C) 高成本 Playwright visual regression CI。
- **Token 成本估算**：Vision 比對每張圖約 +1,000–5,000 input tokens；一個 10 畫面的功能若走 B 方案，QA 階段增加 ~$0.05–0.25/次（依模型）。
- **建議**：先走 A（零成本），再評估 B（中等 ROI）；C 適合有 CI 基礎的團隊。

---

## Evidence

### 1. 現有架構的兩個盲區

**盲區 1：Design-auditor 的覆蓋範圍不足**

| 限制 | 來源 | 影響 |
|------|------|------|
| ≤250 行 output | [`skill-design-auditor.md:13`](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-design-auditor.md#L13) | 大型功能的完整 token 表無法塞進一次 audit |
| Max 5 file reads per surface | [`skill-design-auditor.md:42`](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-design-auditor.md#L42) + constitution §5 | 多頁 Figma 只能讀 5 個 node |
| Max 3 extraction attempts | 同上 | 失敗後無法重試 |
| 只抓「task 相關 frames」 | [`skill-design-auditor.md:13`](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-design-auditor.md#L13) "audit only what's referenced by the current task" | 設計稿中未明確在 task 描述裡提到的畫面會被歸入 Out of Scope |

**盲區 2：QA 的 Visual Audit Gate 只做 literal grep**

| 現有檢查 | 不能抓的 |
|----------|----------|
| `grep source tree for literal value` (hex, sp, dp) | Layout / spacing / alignment 差異 |
| 只比對 spec 裡列出的 tokens | 設計稿有但 spec 漏列的元件 |
| 無截圖比對 | 元件遺漏、錯位、重疊 |

Source: [`skill-qa-engineer.md:34-39`](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-engineer.md#L34-L39)

### 2. 每階段 Token 消耗估算（現有流程）

基於 constitution + skill + state prompt 結構（[`prompts/build.ts`](file:///Users/paul.ph.chen/agent-governance-mcp/prompts/build.ts)）：

| 階段 | 角色 | Prompt 大小 (est.) | 工作 output (est.) | 總 tokens/次 (est.) |
|------|------|-------------------|-------------------|-------------------|
| 0 | Coordinator | ~3K (constitution) + ~1K (skill) + ~0.5K (state) = **~4.5K input** | ~0.5K | **~5K** |
| 1 | Researcher | ~3K + ~0.5K + ~0.5K + RAG = **~5K input** | ~2K | **~7K** |
| 1.5 | Design-auditor | ~3K + ~2K + ~0.5K = **~5.5K input** | ~1K (250 lines ≈ 1K tokens) | **~6.5K** |
| 2 | PM | ~3K + ~2K + ~0.5K + design tables = **~7K input** | ~3K (spec + tasks) | **~10K** |
| 3 | Architect | ~3K + ~1K + ~0.5K + spec = **~6K input** | ~3K (arch doc) | **~9K** |
| 4 | Sr-engineer | ~3K + ~0.8K + ~0.5K + spec + arch = **~8K input** | ~5K (code) | **~13K** |
| 5 | QA-engineer | ~3K + ~3K + ~0.5K + spec = **~8K input** | ~4K (review + tests) | **~12K** |
| | | | **單次完整 chain 總計** | **~62.5K tokens** |

> 註：這是單 task、無 QA round 的估算。每次 QA FAIL → sr-engineer fix → re-review 增加 ~25K tokens。

### 3. 解決方案分析

---

#### 方案 A：結構化增強（零額外 API 成本）

**改動**：修改 design-auditor skill 和 QA skill 的行為規則。

| 改動 | 效果 | Token 增量 |
|------|------|-----------|
| **A1: Multi-pass audit** — 允許 design-auditor 對大型功能做多次 pass（每次 ≤250 行），不同 pass 涵蓋不同 frames，最終合併成完整 `design/<feature>.md` | 解決「漏看」 | +6.5K × (pass 數 - 1)，例如 3 pass = **+13K** |
| **A2: Frame manifest gate** — Auditor 第一步先用 Figma MCP 列出所有 frames（`get_figma_data` 的 node tree），建立完整 manifest，逐一標記 `audited / deferred / out-of-scope`。PM 在 spec 的 Dependencies 中列出 deferred frames | 解決「隱性遺漏」 | +2K（manifest 列表） |
| **A3: Relaxed limits** — 提高 output 上限（250→500 行）和 file reads（5→10）| 簡單但有 token 膨脹風險 | +1K–3K |

**成本影響**：

| 模型 | 基線成本/chain | A 方案增量 | 增幅 |
|------|--------------|-----------|------|
| Claude Sonnet 4.6 ($3/$15) | ~$0.19 + $0.19 = **$0.38** | +$0.05–0.08 | **+15–20%** |
| Claude Haiku 4.5 ($1/$5) | ~$0.06 + $0.06 = **$0.13** | +$0.02–0.03 | **+15–20%** |
| Gemini 3 Flash ($0.5/$3) | ~$0.03 + $0.04 = **$0.07** | +$0.01 | **+15%** |

---

#### 方案 B：Vision-LLM 截圖比對（中等成本）

**原理**：QA 階段新增一步——將 Figma frame 截圖與實作截圖並排送入 vision model，讓 LLM 直接比對差異。

**流程**：
```
QA Phase 1 (現有 review)
  ↓
QA Phase 1.5 (NEW: Visual Comparison)
  1. Figma API export frame as PNG (GET /v1/images/:file_key?ids=:node_id&format=png&scale=2)
  2. Playwright/browser capture implementation screenshot
  3. Send both images to vision model: "Compare these two images. List every visual difference."
  4. Differences → append to qa_reports/review_<task-id>.md
  ↓
QA Phase 2 (Discussion)
```

**Token 成本估算（vision input）**：

| 圖片大小 | 約 tokens (Claude) | 約 tokens (Gemini) |
|----------|--------------------|--------------------|
| 384×384 px | ~250 | ~258 |
| 768×768 px | ~800 | ~774 |
| 1024×1024 px | ~1,600 | ~1,290 |
| 1920×1080 px (full screen) | ~3,000 | ~2,580 |

每次比對 = 2 張圖 + prompt text ≈ **5,000–8,000 input tokens**

| 場景 | 圖片數 | Vision tokens | 模型 | 額外成本 |
|------|--------|--------------|------|---------|
| 小功能 (3 screens) | 6 images | ~30K | Claude Sonnet 4.6 | **+$0.09** |
| 中功能 (10 screens) | 20 images | ~100K | Claude Sonnet 4.6 | **+$0.30** |
| 大功能 (30 screens) | 60 images | ~300K | Claude Sonnet 4.6 | **+$0.90** |
| 中功能 (10 screens) | 20 images | ~100K | Gemini 3 Flash | **+$0.05** |
| 中功能 (10 screens) | 20 images | ~100K | Claude Haiku 4.5 | **+$0.10** |

**限制**：
- 需要可運行的 implementation（Playwright 截圖），不適用於純後端
- Vision model 的「pixel-perfect」能力有限——能抓 ±5px 差異，但 ±1px 的次像素差異可能被忽略
- Figma API 有 rate limit（30 req/min），大型設計需要排隊

---

#### 方案 C：Playwright Visual Regression CI（高成本、高可靠）

**原理**：用 Figma frame PNG 作為 baseline，Playwright `toHaveScreenshot()` 做 pixel diff。

**流程**：
```
Build → Playwright screenshot capture → pixel diff vs Figma baseline → fail on threshold exceeded
```

**成本**：
- **零 LLM token 成本**（純 pixel diff，不經過 LLM）
- **CI 運算成本**：每次 run ~1–3 分鐘 headless browser，依 CI provider ~$0.01–0.05/run
- **開發成本**：需要 Playwright 基礎設施、Docker 環境一致性、baseline 管理流程
- **維護成本**：高 — 每次設計變更需更新 baseline；動態內容需 masking 策略

**適用場景**：
- 團隊已有 Playwright + CI pipeline
- 需要絕對 pixel-perfect（如品牌一致性嚴格的產品）
- 長期維護的設計系統

---

### 4. 方案比較總結

| 維度 | A: 結構化增強 | B: Vision-LLM 比對 | C: Playwright VRT |
|------|-------------|-------------------|-------------------|
| **解決「漏看」** | ✅ (multi-pass + manifest) | ✅ (全 frame 截圖) | ✅ (全 frame baseline) |
| **解決「非 pixel-perfect」** | ❌ (仍是 literal grep) | ⚠️ (~5px 精度) | ✅ (configurable threshold) |
| **LLM token 增量** | +15–20% | +30–200% (依畫面數) | 0% |
| **額外依賴** | 無 | Figma API + browser screenshot + vision model | Playwright + CI + Docker |
| **實作難度** | 低（改 skill md） | 中（新 QA sub-phase + Figma API 整合） | 高（CI 基礎設施 + baseline 管理） |
| **維護成本** | 低 | 低 | 高 |
| **精度** | 低 | 中 | 高 |

---

## Recommendation

**推薦分階段實施 A + B 組合**：

1. **Phase 1 (立即)**：實施 A1 (multi-pass audit) + A2 (frame manifest gate)。零額外 API 成本，只需修改 `content/skill-design-auditor.md` 和 `content/skill-qa-engineer.md`。預期解決 ~70% 的「漏看」問題。

2. **Phase 2 (需評估 ROI)**：實施 B (vision-LLM 比對) 作為 QA Phase 1.5。使用 Gemini 3 Flash 做 vision 比對可將每功能增量控制在 ~$0.05。需要：
   - Figma REST API integration（frame export as PNG）
   - Browser screenshot capability（Playwright or similar）
   - 新增 `tw_visual_compare` tool 或在 QA skill SOP 內建

**理由**：A 方案 ROI 最高（幾乎零成本），B 方案的 Gemini Flash 路線成本可控且涵蓋 layout/alignment 差異。C 方案適合已有 CI 基礎的團隊，但對本專案來說 setup cost 過高。

## Alternatives Considered

- **只做 C (Playwright VRT)**：拒絕，因為需要完整 CI 基礎設施和 baseline 管理，setup cost 高且維護負擔重。適合大型工程團隊但不適合 AI-agent-first workflow。
- **Applitools / Chromatic SaaS**：拒絕，引入外部 SaaS 依賴，月費 $150+，且與 agent-governance-mcp 的 self-contained 設計理念衝突。
- **只提高 design-auditor limits (A3)**：拒絕作為唯一方案，因為即使提高到 500 行 / 10 reads，仍無法解決 pixel-perfect 問題，且有 token 膨脹風險。

## Open Questions

1. **Figma MCP 可用性**：團隊是否已配置 Figma MCP server？方案 B 需要 Figma API access（Personal Access Token）。
2. **可運行截圖的前提**：實作是 web app（可用 Playwright 截圖）還是 native app（需要其他截圖方案）？
3. **精度需求**：±5px 的 vision-LLM 精度是否足夠？若需 ±1px 則只有 C 方案可行。
4. **Multi-pass 的 anti-loop 影響**：A1 方案的多次 pass 是否需要修改 constitution §5 的 circuit-breaker 限制？
5. **成本承受度**：每個功能 +$0.05–0.30 的 vision 比對成本是否可接受？
