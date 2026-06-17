# 評估：Agent 自我偵測 + 腳本觸發跨 CLI Handoff

## 🎯 你的提案

> PM 完成任務後，**agent 自己**檢查是否為 Antigravity 或非 Claude 系列 model。  
> 條件成立 → 觸發腳本 → 呼喚 Claude CLI 接手。

核心差異：handoff 觸發邏輯從「外部 polling」移到「agent 內部自我偵測」。

## ✅ 我覺得這個方向更好

比外部 polling 優越的原因：

| 維度 | 外部 polling | Agent 自我偵測 |
|------|-------------|---------------|
| 觸發時機 | 有延遲（poll interval） | 精確（PM 完成的瞬間） |
| 上下文 | 只看 handoff.md 文字 | Agent 知道自己的完整狀態 |
| 額外 process | 需要常駐 watcher | 不需要 |
| 與 governance 整合 | 外掛，感知不到 | 內建在 SOP flow 裡 |

## 🔍 偵測機制評估

Agent 需要回答一個問題：**「我不是 Claude CLI 嗎？」**

### 方案 A：環境變數（推薦 ✅）

引入一個新的 `AGC_HANDOFF_CLI` 環境變數（延續現有 `AGC_*` 慣例）：

```bash
# Antigravity 啟動時設定
AGC_HANDOFF_CLI=claude agy -i "..."

# 或反過來，標記自己的身份
AGC_AGENT_CLI=antigravity agy -i "..."
```

Agent 在 PM 完成時：
```
printenv AGC_HANDOFF_CLI → "claude" → 觸發 handoff 腳本
printenv AGC_AGENT_CLI → "antigravity" → 不是 claude → 觸發 handoff 腳本
```

**優點**：
- 延續 `AGC_AUTO_ROUTE` 的慣例（env-var 驅動、agent-side 檢查、不需 server 改動）
- 明確、可測試、不依賴 model 名稱的字串匹配
- 使用者可以控制是否啟用

**缺點**：
- 需要啟動時記得設定 env var

### 方案 B：Model 名稱自我檢測

Agent 從 watermark 或自我認知判斷 model：
```
我的 model 是 "gemini-2.5-pro" → 不是 claude 系列 → 觸發
我的 model 是 "claude-opus-4-6-thinking" → 是 claude → 不觸發
```

**優點**：零配置，agent 天然知道自己的 model
**缺點**：
- Model 名稱字串匹配脆弱（新 model 名稱可能不含 "claude"）
- 不同 CLI 報告 model 名稱的格式不一致
- Antigravity 上也可能跑 Claude model（透過 API key），這時不該觸發

### 方案 C：CLI 身份檔案偵測

檢查 workspace 中的 config 檔案：
```
存在 .antigravityrules → 可能是 Antigravity
存在 CLAUDE.md → 可能是 Claude
```

**缺點**：這些檔案可以同時存在（像你的 repo 兩個都有），所以不能區分「當前是哪個 CLI 在跑」

### 🏆 推薦：方案 A（環境變數）+ 方案 B（fallback）

```
1. 檢查 AGC_HANDOFF_CLI 環境變數 → 有值就用
2. fallback：檢查 model 名稱是否不含 "claude" → 觸發
```

## 🏗️ 觸發邏輯應該放在哪裡

### 選項 1：Coordinator Auto-Routing 擴充（推薦 ✅）

在 [skill-coordinator.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-coordinator.md) 的 **Auto-Routing** 段落加一個新判斷分支：

```
現有 Auto-Routing 邏輯：
  next_role 存在 → dispatch via Task tool / tw_switch_role

新增分支：
  next_role 存在 + 偵測到自己不是目標 CLI → 觸發外部 handoff 腳本
```

這自然地融入現有的 stop condition 機制，類似 `AGC_AUTO_ROUTE=0` 的 opt-out 概念。

### 選項 2：skill-pm.md SOP 末尾

在 PM SOP step 8（`tw_update_state`）之後加：
```
9. Cross-CLI handoff check: if AGC_HANDOFF_CLI is set, execute
   `scripts/handoff-to-claude.sh` to invoke the target CLI.
```

**缺點**：只有 PM 會觸發，如果 design-auditor 也需要 handoff 就需要重複邏輯。

### 結論：放在 Coordinator（選項 1）更好

因為 coordinator 是 auto-routing 的中樞，它掌控所有 role 切換的 dispatch 邏輯。

## 📐 建議的實作架構

### 新增 / 修改的檔案

```
content/skill-coordinator.md        ← 新增 Cross-CLI Handoff 段落
scripts/handoff-to-claude.sh        ← 新腳本：觸發 Claude CLI 接手
mulit-agent-scripts/dual-agent.sh   ← 更新：改用 env-var 模式啟動
```

### Coordinator SOP 新增段落（草案）

```markdown
## Cross-CLI Handoff (v3.39.0+)

When auto-routing would dispatch the next role, FIRST check:

1. `printenv AGC_HANDOFF_CLI` — if set (e.g. `claude`), this agent is NOT
   the target CLI for the next phase.
2. Fallback: if your model name does not contain `claude` (case-insensitive),
   treat as non-Claude CLI.

If either check fires AND the next_role is a build-phase role
(architect, sr-engineer, code-reviewer, qa-engineer):
  → Execute `scripts/handoff-to-claude.sh` with the workspace path
  → STOP auto-routing (this is a terminal hand-off to another CLI)
  → Surface: "Handed off to Claude CLI for {next_role}."

If neither check fires → continue normal auto-routing (Task tool / tw_switch_role).
```

### handoff-to-claude.sh（草案）

```bash
#!/bin/bash
# handoff-to-claude.sh — invoke Claude CLI to continue from handoff state

WORKSPACE="${1:-$(pwd)}"
NEXT_ROLE=$(grep 'next_role:' "$WORKSPACE/.current/handoff.md" | head -1 | sed 's/.*next_role: *//')
FEATURE=$(grep 'active_feature:' "$WORKSPACE/.current/handoff.md" | head -1 | sed 's/.*active_feature: *"*//;s/"$//')

echo "🔄 Cross-CLI Handoff"
echo "   Feature: $FEATURE"
echo "   Next Role: $NEXT_ROLE"
echo ""

# Launch Claude CLI in a new iTerm pane or directly
claude --print \
  "You are continuing work on feature '${FEATURE}'. \
   Start by calling tw_get_state, then tw_switch_role('${NEXT_ROLE}') \
   and follow the SOP until QA PASS."
```

## ⚠️ 需要考慮的風險

### 1. Agent 能執行 shell script 嗎？

- **Claude CLI**：可以（有 bash tool）
- **Antigravity CLI**：有 `run_command` tool → ✅ 可以觸發腳本

### 2. Claude CLI 的啟動模式

`claude` CLI 有幾種模式：
- `claude -p "prompt"` — print mode（非互動、headless），適合 pipeline
- `claude "prompt"` — 互動模式，需要 terminal

Pipeline 場景建議用 `-p` + `--output-format json`。但如果需要完整的互動 session（auto-routing 連續跑 architect → sr-engineer → QA），可能需要互動模式。

### 3. 同時兩個 CLI process 的 MCP 連線

Antigravity 觸發 Claude CLI 後，如果 Antigravity 的 process 還沒結束：
- 兩個 MCP client 同時連線到 agent-governance-mcp
- **Session freshness guard** 可能會衝突

> [!WARNING]
> 建議 Antigravity 觸發腳本後**自行結束 session**（stop condition），確保只有 Claude CLI 在寫 handoff state。

### 4. 設計來回的情境

如果 Claude CLI（RD/QA）發現需要回到 PM（`qa_round >= 4` 或 `status: Blocked`）：
- Claude 會把 handoff 寫回 `pm:In_Progress`
- 但此時 Antigravity 已經結束了
- **需要人工重新啟動 Antigravity** 或做反向 handoff

這是一個「單程」handoff 的限制 — 完整的雙向需要更多設計。

## 📊 總結

| 維度 | 評估 |
|------|------|
| **可行性** | 🟢 完全可行 — 所有技術元件都已存在 |
| **偵測機制** | 🟢 `AGC_HANDOFF_CLI` env var（延續慣例） + model name fallback |
| **觸發位置** | 🟢 Coordinator Auto-Routing 擴充（自然融入） |
| **實作量** | 🟡 中等 — coordinator SOP 修改 + 新腳本 + env var 文件 |
| **風險** | 🟡 同時連線衝突、反向 handoff 未覆蓋 |

> [!TIP]
> **建議的 MVP 範圍**：
> 1. 新增 `AGC_HANDOFF_CLI` env var 慣例
> 2. 在 coordinator SOP 加入 Cross-CLI Handoff 段落
> 3. 建立 `scripts/handoff-to-claude.sh`
> 4. 更新 `dual-agent.sh` 為串接模式
> 5. 在 docs/config.md 文件記錄新 env var
