# 🛡️ Teamwork MCP Server - AI 時代的專案協作大腦

## 🌟 什麼是 Teamwork MCP Server？

在 AI 開發時代，我們大量依賴 AI Agent (如 Cursor, Claude, Windsurf) 來寫程式與開發。但 AI 在執行長線專案時有幾個致命弱點：
1. **金魚腦 (狀態脫鉤)**：每次對話結束就忘記專案做到哪裡，切換 IDE 狀態就斷裂。
2. **不受控 (規則遺忘)**：常常忘記遵守團隊制定的開發規範與安全政策。
3. **格式混亂 (格式漂移)**：讓 AI 自己維護進度表時，Markdown 或 YAML 格式經常被寫壞。

**Teamwork MCP Server** 就像是給 AI 戴上了一個「緊箍咒」與配置了一個「隨身秘書」。它是一個實作 Model Context Protocol (MCP) 的中介伺服器，扮演團隊專案的「唯一真實來源 (Single Source of Truth)」。只要 AI 接上這個伺服器，它就**必須**遵守團隊憲法，且**絕對無法**憑空亂改專案進度。

---

## 🏛️ 核心架構：三層防禦 (3-Layer Defense)

這套系統並非只靠「軟性的提示詞 (Prompt)」來約束 AI，而是透過程式碼級別的硬約束：

### Layer 1: MCP Prompts（大腦規則注入）
- **機制**：當開發者呼叫 `sr-engineer` prompt 時，伺服器會「自動且強制」地將「團隊憲法 (Constitution)」、「資深工程師技能 (SOP)」以及「專案的即時狀態」打包注入給 AI 的上下文。
- **白話文**：AI 上工的第一秒，我們就直接把員工守則和工作交接清單塞進它的腦袋裡，省去每次手動貼上的麻煩。

### Layer 2: Structured Tools（手腳硬約束）
- **機制**：伺服器提供 6 個結構化的 API 工具。AI **被剝奪了直接修改進度檔案的權力**，只能透過呼叫這些 API 進行操作。
    - `sdd_get_state` / `sdd_get_next_task`: 讀取進度與下一個任務。
    - `sdd_update_state` / `sdd_complete_task` / `sdd_rollback_task`: 精準更新狀態，保證 YAML 與 Checkbox (`[x]`) 格式永遠 100% 正確。
    - `sdd_detect_drift`: 自動比對程式碼狀態與任務清單是否有出入。
- **白話文**：AI 就像是在無塵室裡工作，只能按規定的按鈕來報告進度，杜絕了把進度表寫壞的可能。

### Layer 3: Server-side Guards（海關攔截器）
- **機制**：伺服器在記憶體中維護 Session 狀態 (`session.ts`)。如果一個全新的 AI Agent 企圖跳過讀取狀態，直接寫入或修改任務，伺服器會直接拋出 `⛔ BLOCKED` 錯誤並攔截該次行動。
- **白話文**：這是一個強制的防呆機制。AI 必須先「讀取現狀」，才能「採取行動」，完全消除了 AI 憑空猜測導致專案脫鉤的致命風險。

---

## 💻 技術實作細節
- **語言**：TypeScript (Node.js)
- **通訊協定**：MCP Stdio Transport (透過 Standard I/O 溝通，低延遲且無須網路通訊埠)。
- **無縫掛載**：利用 Node ESM 模組解析與 `npx`，可直接從 GitHub 遠端執行，團隊成員**完全不需要 clone 原始碼**。
- **資料儲存**：目前使用純文字檔案 (`.current/handoff.md` 與 `.current/tasks.md`) 進行持久化，兼具機器可讀 (YAML) 與人類可讀 (Markdown) 特性。

---

## 🚀 如何啟動與掛載？ (Team Onboarding)

非常簡單！無需安裝複雜依賴，只需要你的電腦有安裝 Node.js (含有 `npx`) 即可。

### 方式 A：Claude Desktop / Antigravity / Gemini
請編輯設定檔（`mcp_config.json` 或 `claude_desktop_config.json`），加入：
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```

### 方式 B：Cursor IDE
1. 打開 Cursor Settings > Features > MCP。
2. 點擊 `+ Add new MCP server`：
   - Name: `teamwork-mcp-server`
   - Type: `command`
   - Command: `npx -y github:Paul-hengChen/teamwork-mcp-server`

---

## ⚠️ 注意事項與最佳實踐
1. **快取問題**：如果你發現 MCP Server 執行行為異常，或沒有更新到 GitHub 的最新版，請在終端機執行 `rm -rf ~/.npm/_npx` 清除 npx 的背景快取。
2. **啟動工作流**：每次開立新的對話框，請直接對 AI 說：「**請呼叫 `sr-engineer` prompt 來啟動工作流，專案路徑是 `/你的/專案/絕對路徑`**」。
3. **絕對路徑要求**：呼叫 prompt 與 tools 時，要求提供專案的「絕對路徑 (workspace_path)」，MCP Server 才能精準定位專案的 `.current/` 資料夾。

---

## 🔮 未來展望 (Roadmap)
1. **Phase 3 (雲端整合)**：將傳輸協定從 `stdio` 升級為 `SSE (Server-Sent Events)`，並導入資料庫 (DB)，支援大型團隊的多人即時協作。
2. **QA Skill 實作**：定義 `skill-qa-engineer`，將自動化驗收測試納入 SDD (Spec-Driven Development) 的完美閉環。
3. **CI/CD Hook**：當 PR Merge 時自動分析變更，並自動更新 handoff 狀態。
4. **認證層機制**：加入 API Key / JWT 認證機制以確保雲端存取安全性。
