# Research: agent-governance-mcp — npm 發布資格與受歡迎潛力分析

> @researcher · 2026-05-20
> 問題：agent-governance-mcp 的價值是什麼？能幫助團隊/個人提高效率嗎？有資格發布到 npm 嗎？會受歡迎嗎？

---

## Summary

- **有資格發布 npm**：技術品質（strict TS、235 tests、4 runtime deps、6 層防禦）已超過 npm 上多數 MCP server 套件的水準。無技術性 blocker。
- **市場定位獨特**：2026 MCP 生態有 14,000+ 公開 server，但「跨 IDE 狀態同步 + 併發保護 + 規則治理注入」這個組合目前無直接競品。最近的競爭者（agsync、Storybloq、AgentState）各只覆蓋其中一環。
- **會受歡迎，但受眾精準而窄**：目標用戶是「同時使用 2+ AI IDE 的開發者」——這是一個真實但小眾的群體。不會是 Context7（54k stars）等級的爆款，但在這個 niche 裡有先行者優勢。
- **效率提升已驗證**：個人多 IDE 場景每日省 10-30 分鐘上下文重建時間；小團隊（2-3人）透過 HTTP+SQLite 共享狀態和 QA 流程強制可減少協作事故。
- **最大風險不是技術，是 discoverability**：npm 發布只解決安裝便利性，真正決定受歡迎程度的是能否被 Awesome MCP 列表、PulseMCP 等 MCP 發現平台收錄。

---

## Evidence

### 1. npm 發布資格——技術準備度

| 維度 | 現狀 | npm 生態標準 | 判定 |
|---|---|---|---|
| 程式碼品質 | Strict TS + Zod runtime validation | 多數 MCP server 無 runtime validation | ✅ 超過標準 |
| 測試覆蓋 | 235 tests passing | 多數 npm MCP server 無測試 | ✅ 超過標準 |
| 依賴數量 | 4 runtime deps | 越少越好 | ✅ 優秀 |
| 文件品質 | 全英文 README、Mermaid 圖、FAQ、安裝指南 | 有 README 即可 | ✅ 超過標準 |
| CLI 入口 | `bin` entry 已配置 (`agent-governance-mcp`, `agent-governance-context`) | 需要 `bin` field | ✅ 已就緒 |
| `init` 指令 | v3.7.0 已實作 | 非必要但加分 | ✅ 已就緒 |
| License | ISC | 需要 OSI-approved license | ✅ 已就緒 |
| `dist/` 提交 | 目前提交 git | npm publish 後可移除 | ⚠️ 發布後清理 |

Source: [package.json](file:///Users/paul.ph.chen/agent-governance-mcp/package.json), npm registry standards

**結論：技術上 100% 準備好了。** 唯一需要的是加 `prepublishOnly: "npm run build"` 到 scripts，然後 `npm publish`。

### 2. 2026 MCP 生態競爭格局

MCP 生態已有 **14,000+ 公開 server**，由 Linux Foundation 的 Agentic AI Foundation (AAIF) 治理。頂級 server 的規模：

| Server | Stars | Weekly Downloads | 定位 |
|---|---|---|---|
| Context7 | ~54,000 | ~890,000 | 開發文件查詢 |
| Playwright MCP | ~30,000 | N/A | 瀏覽器自動化 |
| Filesystem (Anthropic) | N/A | N/A | 本地檔案存取 |

Source: Web search — shareuhack.com, developersdigest.tech (2026 MCP ecosystem surveys)

**直接競品分析：**

| 工具 | 跨 IDE 狀態同步 | 併發保護 | 規則治理 | MCP 原生 | 分發方式 |
|---|---|---|---|---|---|
| **agent-governance-mcp** | ✅ | ✅ lock+mtime | ✅ constitution injection | ✅ | GitHub tag |
| **agsync** | ⚠️ config 同步 only | ❌ | ❌ | ❌ (dot-file generator) | npm |
| **Storybloq** | ⚠️ ticket/handover only | ❌ | ❌ | ❌ (.story/ dir) | npm |
| **AgentState** | ✅ shared state | ✅ (hosted) | ❌ | ❌ (SaaS API) | hosted |
| **agent-passport-system** | ❌ | ❌ | ✅ DID/policy | ✅ MCP | npm |
| **@codemcp/agentskills** | ⚠️ skill sync only | ❌ | ⚠️ skill versioning | ⚠️ partial | npm |

Source: Web search — npmjs.com, GitHub repositories (2026-05)

**關鍵洞察：沒有任何一個競品同時具備這三個核心功能。** agsync 最接近但只做 config 同步（不追蹤動態 state），AgentState 最強但是 SaaS（不是 MCP 原生、需付費）。

### 3. 會受歡迎嗎？——受眾規模估計

**目標受眾**：同時使用 2+ AI IDE 的開發者。

市場訊號：
- 2026 年幾乎所有主流 AI IDE（Claude Code、Cursor、Windsurf、VS Code + Copilot、Zed、Replit）都支援 MCP — 多 IDE 用戶基數在擴大
- MCP 發現平台（PulseMCP、Awesome MCP lists）是目前開發者找 MCP server 的主要管道
- `agent-passport-system-mcp` 等治理類 MCP server 已在 npm 上架，說明市場認可這個類別

**保守估計**：

| 時間點 | GitHub Stars | npm Weekly Downloads | 依據 |
|---|---|---|---|
| 發布後 1 個月 | 10-50 | 50-200 | Niche 工具冷啟動 |
| 被 Awesome MCP 列表收錄後 | 100-500 | 500-2,000 | 列表流量效應 |
| 如果有 viral moment（HN/Reddit post） | 1,000-5,000 | 5,000-20,000 | 高度不確定 |

**不會是爆款，但在 niche 裡有真實需求。** 類比：`lint-staged`（解決一個精準問題）而非 `React`（平台級工具）。

### 4. 效率提升——量化證據

| 場景 | 無 agent-governance | 有 agent-governance | 節省 |
|---|---|---|---|
| 個人切換 IDE（每次） | ~5 min 重新交代進度 | 0 min（`tw_get_state` 自動載入） | ~5 min/次 |
| 個人每日（~6 次切換） | ~30 min | ~0 min | ~30 min/日 |
| 小團隊併發寫入事故（每週） | ~1 次 lost update → 30-60 min 修復 | 0 次（lock+mtime 防護） | ~45 min/週 |
| 規則維護（每次修改） | 改 N 個檔案（.cursorrules, CLAUDE.md, ...） | 改 1 個 constitution.md | ~10 min/次 |

Source: [value-assessment.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment.md), [value-assessment-2026-05.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment-2026-05.md), 實際開發體驗

### 5. npm 發布的真實成本

| 成本項 | 工作量 | 頻率 |
|---|---|---|
| 首次發布 | 加 `prepublishOnly` + `npm publish` | 一次性，~15 min |
| 版本更新 | `npm version patch && npm publish` | 每次 release，~5 min |
| Issue 回覆 | 取決於使用者數量 | 持續，初期極少 |
| Breaking change 管理 | semver 紀律（已在做） | 已有 CHANGELOG 流程 |
| `dist/` 清理 | 從 git 移除 + 更新 `.gitignore` | 一次性，~10 min |

**實際維護負擔比想像中小**——你已經有 semver + CHANGELOG + CI 流程。npm 發布只是多一個 `publish` 步驟。

---

## Recommendation

**發布到 npm。理由：成本極低（15 min 首次設置），但收益是永久性的（discoverability + 安裝便利性 + 移除 dist/ 提交）。**

執行順序：

1. **npm publish**（~15 min）
   - 加 `prepublishOnly: "npm run build"` 到 `package.json`
   - `npm publish --access public`
   - 從 git 移除 `dist/`，加入 `.gitignore`
   - 更新 README 安裝指令為 `npx -y agent-governance-mcp`

2. **提交到 MCP 發現平台**（~30 min）
   - Awesome MCP Servers list（GitHub PR）
   - PulseMCP registry
   - mcpmanager.ai

3. **Demo GIF**（~1 hr）
   - 30 秒展示：`init` → 多 IDE 共享狀態 → drift 偵測
   - 放 README 頂部

4. **（可選）寫一篇介紹文**
   - Dev.to / Hashnode / Reddit r/ClaudeAI
   - 聚焦痛點：「你的 AI agent 跨 IDE 時會失憶嗎？」

---

## Alternatives Considered

- **不發布 npm，維持 GitHub tag 分發**：rejected。`dist/` 提交問題持續存在，安裝指令冗長。但如果完全不想要外部使用者，這仍是合理選擇。
- **發布但不推廣**：viable。npm 上大量套件是 0 star 的 personal utility。你可以發布純粹為了解決 `dist/` 問題和縮短安裝指令，不做任何推廣。社群會自然發現或不發現。
- **等 A2A 協議成熟再決定**：rejected。A2A 是 agent-to-agent 層，與 agent-governance-mcp 的 agent-to-tool 定位互補而非取代。且先行者優勢有時間窗口。

---

## Open Questions

1. **npm 套件名 `agent-governance-mcp` 是否可用？** 需要 `npm view agent-governance-mcp` 確認未被佔用。
2. **是否要設 npm scope？** `@paul-hengchen/agent-governance-mcp` vs bare `agent-governance-mcp`。Scoped 避免名稱衝突但安裝指令較長。
3. **Awesome MCP Servers 的收錄標準？** 需查看各列表的 PR template 和品質要求。
4. **是否需要 CLA / CONTRIBUTING.md？** 如果預期外部 PR，需要貢獻指南。現階段可能不需要。
