# 🎯 Teamwork MCP Server — 價值評估報告

> Researcher assessment — 2026-05-15
> 問題：這個專案的價值是什麼？能幫助團隊提高效率嗎？目前值得繼續投入嗎？

---

## 一句話結論

**值得——但價值邊界要畫清楚。它是目前 MCP 生態中唯一同時具備「跨 IDE 狀態同步 + 併發寫入保護 + 規則治理注入」的開源方案。最大風險不是技術，而是 adoption friction。**

---

## 1. 它解決了什麼真實問題？

| 痛點 | 具體場景 | 解法 | 保證等級 |
|---|---|---|---|
| **金魚記憶** | Claude 昨天改的，Cursor 今天不知道 | `handoff.md` 跨 session 持久化 + `tw_get_state` 強制先讀 | ⚙️ Server 強制 |
| **併發覆蓋** | 兩個 IDE 同時寫進度 → 後者蓋前者 | `O_EXCL` file lock + mtime freshness + SQLite WAL | 🔒 OS/DB 層保證 |
| **格式腐壞** | AI 手動維護 YAML → 語法壞掉 → 下次解析失敗 | Zod schema + `js-yaml` 序列化，AI 只能按按鈕 | 🔒 Server 強制 |
| **規則散落** | `.cursorrules`、`CLAUDE.md`、`.antigravityrules` 各自為政 | Constitution-as-Code，MCP prompt endpoint 統一注入 | ⚠️ Soft（AI 需合作） |

**核心洞察**：前三個是 hard guarantee（OS/Server 層強制），第四個依賴 LLM 合規——這是任何系統都無法完全解決的本質限制，專案本身也誠實承認。

---

## 2. 它能提高團隊效率嗎？

### ✅ 確實能提高效率的場景

1. **個人開發者 + 多 IDE**（ROI 最高）
   - Claude Code + Cursor + Anti-Gravity 同開，不怕 race condition
   - 切換 IDE 不需要重新交代進度
   - Constitution 自動注入，不用複製貼上規則到每個工具

2. **小型工作室 (2–3 人)（Phase 6 已完成）**
   - HTTP + SQLite 模式已可用，每人 IDE 連同一個 server
   - 共享 handoff state 和 constitution

3. **AI-heavy 工作流（多角色流水線）**
   - PM → Architect → Engineer → QA 的 SOP 自動路由
   - `tw_detect_drift` 自動抓住同步脫節
   - 每個角色有明確的進入/退出條件

### ❌ 無法提高效率的場景

| 場景 | 原因 |
|---|---|
| 10+ 人工程團隊 | `handoff.md` 不是 issue tracker，需要 Linear/Jira |
| PM 需要 dashboard | 沒有 Web UI，只能靠 AI 口頭報告 |
| 強制 AI 守規矩 | LLM 本質限制，任何系統都無法解決 |
| 跨機器（不部署 HTTP server） | Stdio 模式的 file lock 是 local-fs only |

---

## 3. 與替代方案的比較（2026 市場）

| 維度 | teamwork-mcp-server | 純 CLAUDE.md | Git commit 手動同步 | Linear/Jira + MCP | LangGraph/CrewAI |
|---|---|---|---|---|---|
| MCP 原生 | ✅ | N/A | N/A | 部分 | ❌ (SDK) |
| 跨 IDE | ✅ | ❌ Claude only | ✅ | ✅ | ❌ |
| 併發保護 | ✅ Lock+mtime | ❌ | ❌ | ✅ by design | ✅ |
| 規則統一注入 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 遠端部署 | ✅ HTTP+SQLite | ❌ | ✅ | ✅ | ✅ Cloud |
| 建置成本 | 零 (`npx`) | 零 | 零 | 付費 | 付費/中等 |
| 視覺化 | ❌ | ❌ | ❌ | ✅ | ✅ |

**獨特定位**：MCP 原生 + 跨 IDE + 併發保護 + 規則注入 + 零配置——這個組合目前沒有其他方案能同時滿足。

---

## 4. 技術品質評估

| 指標 | 狀態 | 評語 |
|---|---|---|
| 程式碼規模 | ~2,167 LOC TypeScript | 精簡，可維護 |
| 依賴數量 | 4 runtime deps | 極低供應鏈風險 |
| 測試覆蓋 | 39 tests / 4 test files | 核心路徑有覆蓋，HTTP/SQLite 尚無 |
| 型別安全 | Strict TypeScript + Zod runtime validation | 優秀 |
| 安全機制 | 6 層防禦（Zod → pre-flight → lock → mtime → atomic write → YAML） | 同類最佳 |
| 已完成里程碑 | Phase 1–7 全部完成 | 快速迭代中 |

---

## 5. 值得繼續投入嗎？

### 值得的條件

1. **你日常確實使用多個 AI IDE**：每天節省的「重新交代進度 + 手動同步」時間是真實的
2. **你把它當作個人工具和學習專案**：它是「如何用技術約束 AI 行為」的活生生實驗
3. **你計畫開源推廣**：MCP 生態仍在早期，有先行者優勢

### 不值得的條件

1. **你只用一個 IDE**：直接用 `CLAUDE.md` + `tasks.md` 就夠了
2. **你期望它取代 Jira/Linear**：它不是，也不該是 PM 工具
3. **你期望商業化**：A2A 協議和 LangGraph/CrewAI 的 MCP 整合會逐步蠶食這個位置

### 如果繼續，下一步建議

| 優先級 | 動作 | 理由 |
|---|---|---|
| **P0** | 補 HTTP transport + SQLite 測試 | 最暴露的攻擊面零覆蓋 |
| **P0** | `teamwork init` CLI 命令 | 降低 onboarding friction（目前新用戶需 6 步才能啟動） |
| **P1** | 發布到 npm（移除 `dist/` 提交） | 正規分發，proper semver |
| **P1** | 結構化 logging | 從 `console.error` 升級到 JSON stderr，生產可觀察性 |
| **P2** | 簡易 Web dashboard（HTTP mode 已有 transport） | 讓非工程師能看到 handoff 狀態 |

---

## 最終判斷

> **Teamwork MCP Server 在「單人多 IDE 的 AI 協作治理」這個精準問題上，是目前生態中技術最紮實的方案。**
>
> 它不該試圖成為 Jira 或 LangGraph。它的價值在於：**讓 AI agent 不再是無記憶、無紀律的臨時工，而是有進度、有規矩、有交接的隊友。**
>
> 繼續投入的 ROI 取決於你是否每天使用它。如果是——它每天省下的上下文重建時間就是它的價值。如果不是——沒有任何基礎設施工具能在閒置中產生價值。

---

*Research based on: full source review (2,167 LOC), 5 prior research artifacts, 7-phase roadmap analysis, 2026 MCP ecosystem landscape scan.*
