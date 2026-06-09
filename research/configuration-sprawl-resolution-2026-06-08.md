# 解決 Agent 規則碎片化 (Configuration Sprawl) 之收斂策略報告

**Author:** Antigravity (@lite)
**Date:** 2026-06-08

## 背景與痛點
目前在專案與全域環境中，為了適配不同的 AI 開發工具（Antigravity、Claude Code、Codex 等），系統內散落了多份設定檔與 Hook，包含：
- `.antigravityrules` (Antigravity 專案層級)
- `AGENTS.md` (專案層級)
- `~/.codex/AGENTS.md` (全域 Codex)
- `CLAUDE.md` (Claude Code 專案層級)
- `content/constitution.md` (專案治理核心)
- Claude 的 Session Start Hook

這些設定檔功能高度重疊，導致維護成本極高。若要修改一條規則（例如調整 Token 節省模式），需要手動同步多處，極易產生配置漂移 (Configuration Drift)。

## 解決方案

### 方案一：單一真相來源 (SSOT) 與皮包檔案 (Wrapper Files)
放棄在各工具的設定檔中維護實質規則，將所有核心邏輯、狀態同步要求與極簡輸出模式，**全部收斂**至 `content/constitution.md`。

其他所有設定檔（`.antigravityrules`, `CLAUDE.md`, `AGENTS.md`）僅作為進入點的「皮包檔案 (Wrapper)」。內容統一縮減為一行強制指令：
> "MANDATORY: 啟動時請優先讀取並嚴格執行專案下的 `content/constitution.md`。"

### 方案二：擴充自動化鷹架 (Scaffolding via agc init)
利用專案現有的 `agent-governance-mcp` CLI 工具，將上述皮包檔案的生成邏輯寫入 `bin/agc-init.mjs`。
未來在初始化任何新專案時，只需執行 `agc init`，系統便會自動於根目錄生成 `.antigravityrules`、`CLAUDE.md` 等對應的進入點檔案，並自動綁定至統一的 `constitution.md`。

### 方案三：MCP 原生動態規則下發 (終極方案)
充分發揮 MCP (Model Context Protocol) 的優勢，徹底消滅客戶端的實體設定檔依賴：
1. **實作 MCP Resource 或 Tool**：在 Server 端暴露一個 `tw_get_rules` 工具或專屬 Resource，用於提供全局憲法內容。
2. **啟動即拉取**：指示所有 Agent (無論是 Antigravity、Claude 或其他工具) 在連線 MCP Server 時，直接讀取該 Resource 來獲取行為規範。
此方案能讓跨專案、跨工具的 Agent 直接從伺服器端動態取得最新的全域規範，達成真正的中心化治理。
