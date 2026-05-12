# 🛡️ Teamwork MCP Server

> 給 AI 戴上「緊箍咒」+ 配「隨身秘書」的 Model Context Protocol 伺服器。
> 讓 Cursor / Claude / Anti-Gravity / Gemini 等任何 AI 工具，跨 IDE、跨 session 都遵守同一套團隊規則、共享同一份專案進度。

---

## 📑 目錄

- [一句話定位](#一句話定位)
- [給非工程師的快速說明](#給非工程師的快速說明)
- [它在解決什麼問題](#它在解決什麼問題)
- [核心架構：三層防禦](#核心架構三層防禦)
- [技術細節](#技術細節)
- [優點與限制](#優點與限制)
- [安裝與啟動](#安裝與啟動)
- [日常使用流程](#日常使用流程)
- [安全機制 (Safety)](#安全機制-safety)
- [常見問題 (FAQ)](#常見問題-faq)
- [未來規劃](#未來規劃)
- [專案結構](#專案結構)
- [名詞解釋](#名詞解釋)

---

## 一句話定位

**Teamwork MCP Server** 是一個讓多個 AI agent / IDE 在同一個專案上工作時，能**共享狀態、遵守同一套規則、不互相覆蓋**的基礎建設。

它**不是寫程式的工具**，而是「協作的治理層 (governance layer)」。

> 類比：團隊的 PM + QA + 員工守則 — 但是給 AI 看的，且 24/7 自動執行。

---

## 給非工程師的快速說明

想像三個情境：

- **情境 A**：你昨天叫 Claude 寫了一段登入功能，今天打開 Cursor 想繼續，但 Cursor 完全不知道昨天做到哪、用什麼方式做的。結果它重新猜一遍，跟昨天的版本不一致。
- **情境 B**：你訂了規矩「絕對不要直接讀 `.env` 檔」，但每個 AI 工具（Cursor / Claude / Anti-Gravity）的設定方式都不同，你要去四個地方各設一次，改一次規矩要同步四個檔案。
- **情境 C**：你在 VS Code 跟 Cursor 同時開著兩個 AI，兩邊同時更新進度紀錄，**後寫的把先寫的覆蓋了**。一個任務的成果靜默消失。

**這個 server 就是把這三個情境用程式碼解決掉。**它放在你電腦本機，AI 跟它對話而不是直接動檔案；它會：
1. 記住專案進度，無論你換哪個 AI 工具都讀同一份
2. 規則放一個地方，所有 AI 都從這裡拿
3. 兩個 AI 同時想寫東西時，幫你排隊、避免覆蓋

---

## 它在解決什麼問題

AI 寫 code 工具（Cursor / Claude / Anti-Gravity / Gemini Code）在做長線專案時有四個致命弱點：

### 痛點 1：金魚腦 — 狀態脫鉤
- 每個新 session、每換一個 IDE，AI 就忘記做到哪
- 你昨天叫 Claude 改的東西，今天打開 Cursor 它一無所知
- 結果：AI 重複工作 / 漏做 / 跟你的記憶版本不一致

### 痛點 2：規則飄移
- 你的「不要 yapping」「TDD 優先」「絕不直接動 .env」這些規範
- 每個工具都有自己的設定檔（`.cursorrules` / `CLAUDE.md` / `.antigravityrules`），寫法不同
- 改一條規矩要去多個檔案同步，常常忘掉

### 痛點 3：格式漂移
- 讓 AI 自己維護進度檔（`handoff.md` / `tasks.md`）
- 它常常把 YAML 寫壞、checkbox 格式不對、欄位漏掉
- 下次想讀回來就解析失敗，前面累積的進度全廢

### 痛點 4（隱形殺手）：寫入衝突 / Lost Update
- 兩個 IDE 同時開、兩個 session 並行
- 兩邊都讀到 state X，各自做事後分別寫入 Y 跟 Z
- **後寫的覆蓋先寫的，狀態靜默丟失**
- 沒人發現，直到下次 detect_drift 才看到「咦這 task 怎麼從完成變沒做？」

**Teamwork MCP Server 把這四個痛點全部用 server-side 程式碼解決。**

---

## 核心架構：三層防禦

不是只用「軟性的 prompt 約束」，而是 **server 端的硬約束** — AI 想繞也繞不過。

### Layer 1：Prompts — 自動注入規則

當任何 MCP-compatible client 呼叫 `sr-engineer` prompt 時，server 即時組裝：

```
content/constitution.md         ← 你的「憲法」（規範守則）
+ content/skill-sr-engineer.md   ← SOP（每次該做什麼順序）
+ 即時 handoff.md 狀態 JSON      ← 專案此刻做到哪
```

塞回給 client 當作 AI 的 context。

**白話講**：AI 一上工，員工守則 + 工作 SOP + 上次交接清單**自動**進它腦袋。你改 `constitution.md` 一份檔，所有工具下次 session 立刻生效。

### Layer 2：Tools — 結構化 API（剝奪 AI 亂寫的權力）

Server 提供 6 個 tools。**AI 不能直接動 `handoff.md` 或任務清單檔，只能透過這些 tools**：

| Tool | 功能 | 為什麼這樣設計 |
|---|---|---|
| `sdd_get_state` | 讀現在的專案進度 | **必須先呼叫**，否則所有寫入工具會被擋（pre-flight check） |
| `sdd_update_state` | 更新 handoff（active_feature / status / completed / pending） | Server 強制產合法 YAML，AI 寫壞格式不可能 |
| `sdd_get_next_task` | 從任務清單拿下一個未完成 task | 結構化回傳 task ID、section、是否到 checkpoint |
| `sdd_complete_task` | 把 `[ ]` 改成 `[x]` | 可加 note（例如 "via vibe coding"） |
| `sdd_rollback_task` | `[x]` → `[ ] (reverted: 原因)` | 用於後來發現先前實作壞掉 |
| `sdd_detect_drift` | 比對 handoff 跟任務清單是否一致 | 抓「兩邊不同步」的情況 |

**白話講**：AI 在無塵室工作，只能按規定的按鈕報告進度，杜絕亂寫。

### Layer 3：Guards — Server-side 攔截

兩道防線，**程式碼級別**強制執行：

#### (a) Pre-Flight Check
AI 沒呼叫過 `sdd_get_state` 就想 `update_state`？被擋並回 `⛔ BLOCKED` 錯誤。
強迫「先讀後寫」，不能憑空想像專案狀態。

#### (b) Cross-Process File Lock + Mtime Freshness Check
- **檔案鎖**：兩個 IDE / 兩個 AI 同時寫 → `O_EXCL` lockfile 序列化，不會 torn write
- **新鮮度檢查**：你讀完之後別人改過 → `STATE DRIFT` 錯誤，要求重讀
- **原子寫入**：寫入 `*.tmp` 然後 `rename`，讀者永遠看到舊版或新版，不會看到半寫的內容

---

## 技術細節

### 語言 / Runtime
- **TypeScript** 編譯到 ES2022，嚴格型別（no `any`）
- **Node.js** ESM modules
- 編譯產物在 `dist/` 內，直接 commit 進 repo 以供 `npx` 遠端執行

### 主要相依
| 套件 | 用途 |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server 框架 |
| `zod` v4 | Runtime 參數驗證 |
| `js-yaml` | YAML frontmatter 安全讀寫 |

### 通訊
- **Stdio transport**：透過 stdin / stdout 與 MCP client 通訊
- 不需要網路 port，零組態、低延遲、安全（不暴露在網路上）

### 資料儲存
- 純文字檔（無 DB）：
  - `<workspace>/.current/handoff.md` — YAML frontmatter + Markdown checkbox
  - `<workspace>/tasks.md` 或其他可配置路徑 — 任務清單
- 優點：人類可讀、可 git diff、可 grep、出問題時用編輯器就能修
- 限制：不支援跨機器即時同步

### 方法論無關 (Methodology-agnostic)

Server 不綁任何特定流程，預設只認最通用的 markdown checkbox 格式，其他需求都靠 workspace 自帶設定覆蓋：

- **Task 格式自訂**：放 `<workspace>/.current/.config.json` 指定 `taskPattern` (regex) + `taskPaths`
- **憲法 / Skill 自訂**：在 `<workspace>/.current/constitution.md` / `<workspace>/.current/skill-sr-engineer.md` 放你自己的版本，server 優先用 workspace 覆蓋而不是內建預設
- **純 vibe coding 模式**：完全不需要 task 清單，3 個 task 工具會優雅回 "No task list file found"，handoff state + prompt 注入照常運作

**預設行為**：
- 搜尋 task 清單路徑：`.current/tasks.md`, `tasks.md`, `TODO.md`
- 預設 regex：`^- \[([ x])\] (\S+)\s+(.+)$` — 匹配 `- [ ] <ID> <description>`

**自訂範例 — JIRA-style task ID**：
```jsonc
// <workspace>/.current/.config.json
{
  "taskPaths": ["TODO.md"],
  "taskPattern": "^- \\[([ x])\\] (PROJ-\\d+)\\s+(.+)$"
}
```

正則的合約：group 1 是 checkmark (`" "` 或 `"x"`)，group 2 是 task ID，其餘 group 會串成 description。Task 行本身需用標準 markdown checkbox 語法 (`- [ ]` / `- [x]`)，因為 complete/rollback 用此語法做原地翻轉。

### 並行控制（重點，工業強度）
- **In-memory session map**（`guards/session.ts`）：追蹤「本 process 是否呼叫過 `sdd_get_state`」+ snapshot 檔案 mtime
- **檔案鎖**（`guards/file-lock.ts`）：`O_EXCL` lockfile + PID liveness 檢查 + 30 秒 stale mtime fallback
- **Mtime freshness check**：讀取時 snapshot，寫入時比對，不一致就拒絕
- **Atomic write**：tmp file + `fs.renameSync`（POSIX rename 原子性）

---

## 優點與限制

### ✅ 優點

1. **零組態啟動**：透過 `npx github:...` 直接從 GitHub 跑，團隊成員不用 clone、不用 npm install
2. **Single Source of Truth**：規則改一個地方，所有 client 都生效
3. **真.跨工具一致性**：Claude / Cursor / Anti-Gravity / Gemini / Continue / Cline 任何 MCP-compatible 工具都能用
4. **資料完整性**：跨 process file lock + mtime check + atomic write 真的阻擋寫入衝突
5. **人類可審查**：所有狀態都是純文字 markdown，不是黑箱 DB
6. **失敗會大聲 (fail loud)**：server 啟動失敗 `process.exit(1)`、參數錯誤回乾淨的 zod error、寫入過時明確報 STATE DRIFT
7. **MVP 心智**：~600 行 TypeScript，沒有過度設計

### ❌ 限制（誠實邊界）

| 期待 | 實際 |
|---|---|
| 強迫 AI 一定要遵守規則 | ❌ 規則放進 context，但 AI 仍可選擇忽略（MCP 本質限制） |
| 強迫 AI 一定要用 tools | ❌ AI 可直接用 fs.write 改 handoff.md，server 抓不到；但下次 `detect_drift` 會發現 |
| 跨機器同步 | ❌ File lock 是 local-fs，不跨機器（同一台機器同 workspace 才有效） |
| 多人即時協作 | ❌ 沒有 user 概念、沒有 conflict resolution UI |
| 自動 commit / merge | ❌ 不碰 git |
| 寫程式 | ❌ Server 只管狀態 |

---

## 安裝與啟動

需求：Node.js 18+（包含 `npx`）

### 1. 設定 MCP client

#### Claude Desktop / Anti-Gravity / Gemini Code

編輯各自的 MCP 設定檔，加入：

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

#### Cursor IDE

Settings → Features → MCP → `+ Add new MCP server`：
- Name: `teamwork-mcp-server`
- Type: `command`
- Command: `npx -y github:Paul-hengChen/teamwork-mcp-server`

#### Claude Code (CLI)

`~/.claude/settings.json`：
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

### 2. （推薦）設定 SessionStart hook 自動載入規則

避免每次手動 `/sr-engineer`：

```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/teamwork-mcp-server/bin/sr-engineer-context.mjs",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Hook 會自動偵測 workspace 是否為 teamwork-managed（有 `.current/` / `tasks.md` / `TODO.md`）：
- 是 → 注入完整憲法 + skill + state
- 否 → 安靜退出，不打擾無關專案

### 3. 在新專案啟用 Teamwork 管理（⚠️ 關鍵步驟）

> **重要**：SessionStart hook 會偵測 workspace 是否包含以下任一 marker，**沒有就不會注入憲法**：
> - `.current/` 目錄
> - `tasks.md`
> - `TODO.md`

#### 方法 A：自動模式（推薦 — hook 每次 session 自動載入）

在你的專案根目錄執行：

```bash
# 建立 marker 目錄，讓 hook 知道這是被管理的專案
mkdir -p .current
```

下次開新 session 時，hook 會自動偵測到 `.current/` 並注入完整憲法 + skill + 當前 state。

> 如果你有任務清單，也放一份 `tasks.md`（任何 markdown checkbox 格式皆可）：
> ```markdown
> ## Phase 1
> - [ ] T01 初始化專案架構
> - [ ] T02 實作核心功能
> ```

AI 首次啟動時會呼叫 `sdd_get_state`，發現沒有 `handoff.md` 就會自動呼叫 `sdd_update_state` 初始化。

#### 方法 B：手動模式（不建 `.current/`，單次觸發）

如果你不想在專案裡建 marker 目錄，可以在 Claude Code session 裡手動載入：

```
/sr-engineer workspace_path:/你的/專案/絕對路徑
```

這會一次性注入憲法 + skill + state，但**不會**在下次 session 自動生效。

#### 方法 C：直接使用 Tools（最低門檻）

即使不載入憲法，MCP server 的 6 個 tools 仍然可用。AI 可以直接呼叫：

```
sdd_get_state → sdd_update_state → sdd_complete_task ...
```

只是 AI 不會自動收到行為規範，需要你手動告訴它遵守什麼規則。

---

## 日常使用流程

### 場景：你在做一個新功能 Ticket #42

```
1. 你開 Claude Code 進入 workspace
   → SessionStart hook 自動把規則 + 進度塞進 AI 的 context
   → AI 知道："喔，現在在做 Ticket #42，已完成 auth-01 ~ auth-03，auth-04 待辦"

2. 你說「繼續做」
   → AI 呼叫 sdd_get_next_task 拿到 auth-04
   → AI 改 code、跑測試

3. AI 呼叫 sdd_complete_task("auth-04")
   → tasks.md 自動 [ ] → [x]

4. AI 呼叫 sdd_update_state
   → handoff.md 自動更新成合法 YAML

5. 你關掉 session 去吃飯

────────────────────

6. 隔天你想用 Cursor 繼續
   → Cursor 一接 server，sdd_get_state 拿到完整最新進度
   → AI 自動接續 auth-05，零手動同步
```

### 場景：兩個 IDE 同時開（race condition 測試）

```
- VS Code 的 Claude Code 正在寫 handoff.md
- 你忘了關，又在 Cursor 開新 session 也想動同一個檔案
- Claude 在寫 → handoff.md 被 lockfile 鎖住
- Cursor 想寫 → 排隊等鎖
- 拿到鎖後 server 發現 mtime 變了 → 回 STATE DRIFT，要求重讀
- 災難避免，沒有任何資料遺失
```

---

## 安全機制 (Safety)

| 層級 | 機制 | 防的事 |
|---|---|---|
| 0 | **Zod schema 驗證** | AI 傳壞型別 / 缺欄位 → 立刻被擋並回乾淨錯誤訊息 |
| 1 | **Pre-Flight Check** | AI 沒讀過 state 就想寫 → 被擋 |
| 2 | **Cross-process file lock** | 兩個 process 同時寫 → 序列化（O_EXCL + PID liveness + stale fallback） |
| 3 | **Mtime freshness check** | 你讀完之後別人改過 → 拒絕你的寫入，要求重讀 |
| 4 | **Atomic write (tmp + rename)** | 讀者看到的永遠是「舊版」或「新版」，不會看到半寫的檔案 |
| 5 | **YAML 嚴格序列化** | 值含冒號 / 引號 / 中文都安全 round-trip（js-yaml） |
| 6 | **Server 失敗 fail loud** | `server.connect()` 失敗 → 印錯誤 + `process.exit(1)` |

---


## 常見問題 (FAQ)

**Q: 為什麼用 `npx github:...` 而不是 `npm install`？**
A: 為了零組態。團隊成員不用 clone repo、不用 `npm install`、永遠用最新版（除非鎖 commit hash）。

**Q: 我改了 `content/constitution.md`，client 沒有立即生效？**
A: 兩個原因：(1) AI 把舊版載進 context 了，要開新 session；(2) `npx` 有快取，跑 `rm -rf ~/.npm/_npx` 清掉。

**Q: 為什麼 `.current/handoff.md` 不存在但跑得起來？**
A: 設計上允許冷啟動。第一次 `sdd_get_state` 回 `{exists: false}`，AI 看到後會呼叫 `sdd_update_state` 初始化。

**Q: 跨機器團隊協作怎麼辦？**
A: 目前不支援。File lock 是 local-fs。要跨機器需要把 `.current/` commit 到 git（已經是純文字），或等 Roadmap Phase 3 的雲端版。

**Q: 我可以不用 SessionStart hook 嗎？**
A: 可以。手動在每個 session 開頭打 `/sr-engineer` 或讓 AI 呼叫 `sr-engineer` prompt。Hook 只是把這步驟自動化。

**Q: AI 還是不照規則做怎麼辦？**
A: 觀察是哪一層失效：(a) 沒看到憲法 → 確認 sr-engineer prompt 有被載入；(b) 沒用 tools → 在 prompt 強化 "MUST use tools"；(c) 用了 tools 但邏輯錯 → 那是 AI 推理問題，不是 server 能解的。

**Q: 跟 `.cursorrules` / `CLAUDE.md` 衝突嗎？**
A: 不衝突，互補。Workspace-level 的 rules 文件還是有用（fallback、適用於不支援 MCP 的工具）。Server 是 source of truth，rules 文件可以是它的精簡版備援。

---

## 未來規劃

| Phase | 內容 | 狀態 |
|---|---|---|
| 1 | 3-layer 架構、6 個 tools、`sr-engineer` prompt | ✅ 完成 |
| 2 | zod 驗證、js-yaml 安全寫入、cross-process lock、SessionStart hook | ✅ 完成 |
| 2.5 | 方法論解耦：可配置 task 格式 + 路徑、workspace 可覆蓋憲法/skill | ✅ 完成 |
| 3 | Schema versioning（讓未來改格式不會破壞既有 workspace） | Backlog |
| 4 | Test suite + GitHub Actions CI | Backlog |
| 5 | 替換 stdio → SSE / HTTP transport，導入 DB，支援跨機器即時協作 | 規劃中 |
| 6 | `skill-qa-engineer` 補完完整工作流閉環（自動驗收） | 規劃中 |
| 7 | CI/CD hook — PR merge 自動更新 handoff | 規劃中 |
| 8 | 認證層（API Key / JWT），雲端部署 | 規劃中 |

---

## 專案結構

```
teamwork-mcp-server/
├── index.ts                       # MCP server 入口：註冊 prompts/tools/dispatcher
├── tools/
│   ├── handoff.ts                 # 讀寫 .current/handoff.md（js-yaml）
│   ├── tasks.ts                   # 完成/回滾 tasks.md
│   └── drift.ts                   # 比對 handoff vs tasks 找不一致
├── guards/
│   ├── session.ts                 # In-memory pre-flight + mtime snapshot
│   └── file-lock.ts               # 跨 process O_EXCL lock + stale detection
├── prompts/
│   └── sr-engineer.ts             # 組裝 sr-engineer prompt
├── content/
│   ├── constitution.md            # 「憲法」(rules of conduct)
│   └── skill-sr-engineer.md       # SOP
├── bin/
│   └── sr-engineer-context.mjs    # SessionStart hook 助手腳本
├── dist/                          # 編譯產物（committed for npx）
├── CLAUDE.md                      # 給 Claude Code 在這個 repo 工作的指引
└── .antigravityrules              # 給 Anti-Gravity 的對應 rules
```

---

## 名詞解釋

給非 RD 背景的讀者：

| 名詞 | 解釋 |
|---|---|
| **MCP (Model Context Protocol)** | Anthropic 提出的開放協議，讓 AI 工具（Cursor / Claude 等）可以呼叫外部 server 的工具，類似「給 AI 用的 API 標準」 |
| **MCP Server** | 實作 MCP 協議的 server 程式。本專案就是一個 |
| **MCP Client** | 你日常用的 AI 工具（Cursor / Claude / Anti-Gravity / Gemini Code），它們會連到 MCP server |
| **Tool / Prompt (MCP 語境)** | Server 暴露給 AI 的兩種介面：tool 是「可以呼叫的函式」，prompt 是「可以注入的訊息模板」 |
| **stdio transport** | 透過 process 的標準輸入/輸出（stdin/stdout）通訊，不走網路 |
| **session** | 一次 AI 對話的生命週期。Cursor 開一個視窗 = 一個 session |
| **handoff.md** | 「交接檔」— 記錄專案做到哪、誰做的、卡在哪 |
| **tasks.md** | 任務清單，用 markdown checkbox 表示 |
| **YAML frontmatter** | Markdown 檔案開頭用 `---` 包起來的結構化資料區塊 |
| **race condition** | 兩個 process 競爭存取同一資源時的時序問題 |
| **lost update** | 你讀了資料 A，別人改成 B，你基於 A 寫成 C，覆蓋掉 B 的問題 |
| **atomic write** | 寫入是「全有或全無」的操作，不會出現半寫狀態 |
| **file lock** | 用檔案存在性當作鎖，跨 process 互斥 |
| **zod** | TypeScript 的 runtime 型別驗證套件 |
| **hook** | 在特定事件觸發時自動執行的腳本（例如 SessionStart） |

---

## License & Author

- Author: Paul Chen ([@Paul-hengChen](https://github.com/Paul-hengChen))
- License: ISC
- Repo: <https://github.com/Paul-hengChen/teamwork-mcp-server>
