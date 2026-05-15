# Research: teamwork-mcp-server 完成後的真實價值

<!-- @researcher -->

## 核心結論

**技術上：有真實價值，但邊界非常清晰。**  
**對真實團隊：現階段是個人/小型工作室工具，不是團隊工具。**

---

## 真正解決的問題（技術保證，非 prompt 幻覺）

| 問題 | 解法 | 保證等級 |
|---|---|---|
| 兩個 IDE 同時寫 handoff.md → 後者覆蓋前者 | O_EXCL file lock + mtime freshness check | **Hard guarantee**（OS 層） |
| AI 寫出格式壞掉的 YAML | Zod schema + js-yaml 序列化 | **Hard guarantee**（server-side） |
| AI 未讀就寫（盲目覆蓋） | Pre-flight check（read 前 write 被 block） | **Hard guarantee**（server-side） |
| 換 IDE 後 AI 忘記進度 | handoff.md 作為跨 session 持久化 | **Soft guarantee**（AI 需合作） |
| 每個 IDE 的 rules 不一致 | MCP prompts endpoint 統一注入 constitution | **Soft guarantee**（AI 需合作） |

**關鍵區分**：前三個是 OS/Server 層強制；後兩個仍依賴 AI 合規，LLM 本質上不可強制。

---

## 誠實的限制（README 自己也承認）

1. **AI 可以繞過 MCP**：直接用 file tool 編輯 `handoff.md`，server 無法阻止。`detect_drift` 只是事後發現，不是預防。
2. **File lock 是 local-fs only**：兩個人、兩台機器 → lock 完全失效。Phase 6 之前這不是「團隊工具」。
3. **Constitution 只是注入，不是強制**：AI 可以忽略任何規則。這是 LLM 的本質限制，任何系統都無法解決。
4. **沒有可視化 dashboard**：PM 無法用瀏覽器看 handoff 狀態，只能靠 AI 口頭報告。

---

## 與現有方案的比較

| 方案 | 跨 IDE | 跨人員 | File lock | 自動規則注入 | 建置成本 |
|---|---|---|---|---|---|
| **teamwork-mcp-server（現況）** | ✅ | ❌（Phase 6 前） | ✅（單機） | ✅ | 零（npx） |
| 手動 Git commit handoff.md | ✅ | ✅（靠 commit 紀律） | ❌ | ❌ | 零 |
| Linear/Jira + GitHub MCP | ✅ | ✅ | ✅（by design） | ❌ | 有成本 |
| 純 CLAUDE.md + tasks.md | Claude Code only | ❌ | ❌ | ❌ | 零 |

**結論**：teamwork-mcp-server 的獨特優勢是「單機多 IDE + 自動 constitution 注入 + local file lock」的組合。其他方案無法同時滿足這三點且零配置。

---

## 做完 Phase 6+7 之後的真實場景

### 可以做到的
- 兩個人（你 + AI agent）在不同機器上，連同一個 cloud server，不會 race condition
- PR merge 自動更新 handoff，審計鏈完整
- 任何 MCP-compatible client（Cursor、Gemini Code、Cline）共用同一 governance layer

### 依然做不到的
- 強制 AI 遵守規則（這是 LLM 問題，不是 MCP 問題）
- 取代 Linear/Jira 的 PM 視覺化需求
- 適合 10 人以上的真實工程團隊（handoff.md 不是 issue tracker）

---

## 最適合的使用者畫像

1. **個人開發者 + 多 IDE**（現階段最高 ROI）：Claude Code + Cursor 同時開，不怕 race condition，constitution 自動注入。
2. **AI-heavy 小型工作室（2–3 人）**（Phase 6 完成後）：每個人的 IDE 連同一個 cloud server，共享 handoff 和規則。
3. **探索 AI 治理的研究者**：本專案是「如何用技術約束 AI 行為」的活生生實驗，具備學術示範價值。

---

## 最終判斷

**teamwork-mcp-server 是一個精準解決「單機多 AI 工具協作」問題的工具。** 它的 file lock 和 schema validation 是業界目前少數有技術保證的跨 IDE 同步方案。

但它不是傳統意義上的「團隊開發工具」——它沒有 UI、沒有跨機器同步（Phase 6 前）、無法強制 AI 合規。

**做完 Phase 5b + 6 之後，它可以成為 AI-native 小型團隊的合理基礎設施選擇。在此之前，它的最高價值在個人工作流。**
