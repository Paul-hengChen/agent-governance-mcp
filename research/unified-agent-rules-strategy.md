# 統一 AI Agent 規則管理策略報告

**撰寫人**：Antigravity (Gemini 3.1 Pro)
**日期**：2026-06-08

## 問題背景 (Background)

目前專案中存在多個 AI 助手（如 Antigravity, Claude, Codex）以及對應的系統提示與規則定義檔。這導致了嚴重的規則碎片化與管理負擔，具體包含：
- `.antigravityrules` (Antigravity 專案層級)
- `AGENTS.md` (專案層級)
- `~/.codex/AGENTS.md` (Codex 全域)
- `CLAUDE.md` (Claude 專案層級)
- Claude Session Start Hook
- 全域 Antigravity 設定（尚未完全設定）

這些檔案往往包含高度重疊的內容（例如載入憲法、狀態檢查、SOP 等），如果我們更新了某項流程或規範，就需要手動在各個檔案與全域設定中進行同步。這不只繁瑣，還極易產生不一致，導致不同 AI 在執行任務時行為分歧。

---

## 解決方案提案 (Proposed Solution)

為了解決這個「多頭馬車」的管理困境，我建議導入以下三階段的重構策略：

### 1. 單一真相來源 (Single Source of Truth, SSOT)
廢除手動維護多份零散的 markdown 規則檔。我們應該將所有通用的核心守則統一收斂到一處（例如 `content/constitution.md` 或是統一的 `governance.json`）。不論是哪一家 AI 模型，其基礎行為與專案守則都只從這一個核心庫中定義。

### 2. 自動化同步與編譯機制 (Automated Sync & Compile Mechanism)
針對不同 AI 平台需要不同檔名與格式的問題，我們應該開發一個 CLI 工具（例如擴充目前的 `agc`，新增 `agc sync-rules` 指令）。
這個工具會在本地執行時讀取核心規則庫，並自動編譯、渲染出各平台所需的特定設定檔：
- 自動生成 / 覆寫 `.antigravityrules`
- 自動生成 / 覆寫 `CLAUDE.md`
- 自動同步至 `~/.codex/AGENTS.md`

**效益**：開發者只需修改核心檔案，執行一行指令後，所有 AI 助手的 Prompt 配置都會同步更新到最新版本，杜絕人為遺漏。

### 3. 動態注入 (Dynamic Injection via MCP) —— 終極方案
長遠來看，最乾淨的做法是將靜態檔案的依賴降到最低，完全依賴 MCP (Model Context Protocol) 伺服器來動態注入規則。
當任何 AI Agent（支援 MCP）啟動時，只給予最簡短的 Hook：「請呼叫 `tw_get_rules` 獲取當前角色與專案規範」。
這樣不僅不用在每個專案目錄下放一堆 `.md` 檔案，所有規則都可以由統一的 Governance Server 即時且精準地提供。

---

## 建議的下一步 (Next Steps)

1. **盤點與合併**：整理目前所有 `.antigravityrules`、`CLAUDE.md`、`AGENTS.md` 的聯集內容，將通用的 Prompt 抽取至 `constitution.md`。
2. **實作同步腳本**：在 `agent-governance-mcp` 專案中實作 `agc sync-rules`，透過模板（Templates）自動派發各 AI 的專屬設定檔。
3. **自動化攔截**：將這套同步指令納入專案的 git pre-commit hook，確保任何對於核心規則的修改，都能自動反映到所有的 Agent 設定檔中再進入版控。

---
*這份報告總結了如何將 Harness Engineer 的概念應用於解決多 AI 系統中的配置混亂問題，透過 SSOT 與自動化建置，大幅降低開發者的心智負擔。*
