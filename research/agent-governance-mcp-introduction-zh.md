# agent-governance-mcp 完整介紹報告（給主管的版本）

> 目的:向技術主管解釋這個工具「是什麼、為什麼有價值、怎麼運作」。
> 全文以業務與工程價值為主軸,技術細節輔助。對齊 repo v3.34.0(2026-06-11),測試 629/629 全綠。

---

## 0. 一句話定位

**給 AI coding agent 戴上「緊箍咒」+ 配「共享記憶」的 MCP 伺服器。**
讓 Cursor / Claude Code / Anti-Gravity / Gemini 等任何 AI 工具,**跨 IDE、跨 session 都能共享專案狀態、遵守同一套規則、不會互相覆蓋** —— 而且規則是 **server 端硬性把關(hard gate)**,不是「拜託 AI 乖一點」的提示而已。

---

## 1. 它解決什麼問題(為什麼值得做)

當團隊讓 AI 跨工具、跨 session 做長期專案,會撞到四個**結構性**問題。這些不是「AI 不夠聰明」,而是「沒有治理層」必然發生:

| # | 痛點 | 沒有治理層時會怎樣 | 本工具怎麼解 |
|---|---|---|---|
| 1 | **狀態脫鉤(金魚腦)** | 換個 session / 換個 IDE,AI 不知道專案進度到哪、上一棒做了什麼 | 共享的 `.current/handoff.md` + `tasks.md`,任何工具開啟都先讀到同一份狀態 |
| 2 | **規則漂移** | 同一套規範在 `.cursorrules`、`CLAUDE.md`、`AGENTS.md` 各寫一份,改一處忘三處 | 單一 `constitution.md`(憲法)為唯一真理來源,各工具的設定檔只是「薄轉接層」指向它 |
| 3 | **格式漂移** | AI 手動改 `handoff.md` 把 YAML / checkbox 改壞 | 禁止自由文字編輯;所有狀態變更必須經過 11 個 `tw_*` 工具(zod 驗證參數) |
| 4 | **隱形殺手:Lost Update** | 兩個 IDE 同時寫 `handoff.md`,後寫者**靜默蓋掉**前寫者 | `O_EXCL` 跨行程檔案鎖 + mtime 新鮮度檢查,衝突方收到 `⛔ STATE DRIFT` |

**關鍵差異化**:市面同類工具(GitHub Spec Kit、OpenSpec)都是「樣板 + slash 指令」,規則是**勸導性(advisory)**的 —— AI 哪天不照做,你只能祈禱。本工具把把關推到 **server 端**:AI 違規時收到 `⛔ BLOCKED` 信封,**繞不過去**(除非完全不用 MCP,但那樣 `tw_detect_drift` 會在下個 session 抓出來)。

> **工程哲學**:借用分散式系統的觀念 —— 當你無法 100% 強制時,正解是「**偵測 + 補救**」而不是假裝能「完全阻擋」。本工具誠實地把自己定位成 *cooperative guardrail*(協作護欄),而不是 sandbox(沙箱)。

---

## 2. 三層架構(Three Layers of Defense)

全部在 `index.ts` 註冊,分三層:

```
┌── 第 1 層:Prompts(提示層)──────────────────────────────┐
│  /teamwork、/pm、/sr-engineer、/qa-engineer … 等 prompt  │
│  → 動態組裝「憲法 + 角色 SOP + 即時 handoff 狀態」注入    │
│  → build.ts 會依情境「條件式精簡」憲法(見第 8 節)         │
├── 第 2 層:Tools(工具層)─────────────────────────────────┤
│  11 個 tw_* MCP 工具 —— 修改 handoff/tasks 的「唯一」途徑 │
│  (參數經 zod 驗證;自由文字編輯被撤銷)                    │
├── 第 3 層:Guards(守衛層)────────────────────────────────┤
│  Pre-flight 預讀 ▸ 檔案鎖 ▸ mtime 新鮮度 ▸                │
│  ALLOWED_TRANSITIONS 狀態機 ▸ round 計數上限 ▸           │
│  evidence-of-PASS 證據門 ▸ 視覺門 ▸ scope 門 ▸           │
│  atomic tmp+rename 原子寫入                               │
└────────────────────────────────────────────────────────────┘
```

每一次 `tw_update_state` 都會跑完整條 9 步管線才碰硬碟。被拒絕的寫入回傳 `{ error, attempted, allowed, hint }`,AI 可以據此自我修正或上報。

---

## 3. 憲法(Constitution)詳解 —— 解釋與目的

憲法(`content/constitution.md`)是**注入到每一個角色、每一次對話**的最高行為準則。它「方法論無關(methodology-agnostic)」—— 不綁定任何特定的專案管理框架。各角色的 skill 繼承它,**不得複述**(避免重複、避免漂移)。

憲法分 7 節 + 文件優先序:

### §1 Output Directives(輸出指令,零容忍)
**目的:壓低雜訊、統一輸出格式,讓多角色協作可被機器解析。**
- **NO YAPPING**:禁止「好的/讓我為您…」等填充詞;不准敘述工具呼叫。
- **Tool-First**:用編輯工具改檔,不要把整份檔案貼進對話。
- **Terse**:預設回覆 ≤ 15 字(各 skill 可覆寫)。但「拋出阻塞、標記假設落差、陳述驗收標準」不受字數限制 —— 安全永遠優先於簡潔。
- **Watermark(浮水印)**:每則回覆結尾標角色。Subagent 用 `— @<role> (<tier>)`(含模型層級);coordinator / lite / 同 context 切換用 `— @<role>`(無層級)。**用途**:多角色協作時人類一眼知道「現在是誰在講話、用哪個模型」。
- **MVP strict**:只做被要求的事,不做投機重構、不做臆測功能。
  - **視覺例外**:設計稿明列的 widget 不可用 HTML 原生元件替代(那是偷工,不是 MVP)。
  - **設計基線**:設計稿(Figma node)才是 scope 基準,不是 spec 裡有損的文字轉述。
- **Surgical changes**:只動任務需要的部分,不順手「美化」鄰近程式碼。

### §2 Dev & Tech Standards(開發與技術標準)
**目的:工程品質的硬底線,跨角色共識。**
- **嚴格型別**:TS 禁 `any`;Python 要型別註解;Rust lib 禁 `unwrap()`。
- **測試所有權**:**只有 qa-engineer 能寫測試檔。零例外。** —— 這是「builder ≠ judge(造的人不能當裁判)」的根基。
- **Build gate**:每個角色交棒時必須零編譯/型別錯誤。
- **依慣例走**:先 grep 既有風格再動手,一致性 > 個人品味。

### §3 State Synchronisation(狀態同步)
**目的:這是整個系統的核心協議 —— 跨角色、跨行程的狀態怎麼安全交接。**
- **Pre-flight read**:任何改狀態的 `tw_*` 呼叫前,**必須先 `tw_get_state`**。server 強制,跳過就 `⛔ BLOCKED`。
- **Drift check**:讀完狀態先 `tw_detect_drift`,有漂移先報告人類再寫。
- **工具化編輯**:`tasks.md` 只能透過 `tw_add_task` / `tw_complete_task` / `tw_rollback_task` 改,不准手改。
- **完成權**:**只有 qa-engineer 能在 PASS 後翻最終的 `[x]`**。sr-engineer 只能在 `pending_notes` 寫「ready for QA」。防雙重完成競態。

#### §3.1 Server-enforced chain(伺服器強制鏈)
**目的:把「誰能交棒給誰、什麼條件才能 PASS」變成 server 端不可繞過的狀態機。**
- `status=PASS` 與 `tw_complete_task` **只接受 `agent_id="qa-engineer"`**。
- QA 連續 3 次 FAIL(第 4 輪)→ 只接受退回 `(pm, In_Progress)`(circuit breaker)。
- PASS 必須附證據(`qa_review` 或預寫 `qa_reports/review_<task-id>.md`)。
- **視覺證據門**(設計案):缺 baseline → `VISUAL_BASELINES_REQUIRED`;缺結構斷言 → `VISUAL_ASSERTIONS_REQUIRED`;報告不完整 → `VISUAL_REPORT_INCOMPLETE`。
- **Scope 決策門**:進 build 角色前,設計案若沒記錄 scope 決策 → `SCOPE_DECISION_REQUIRED`。
- 三個獨立的 round 計數器:`qa_round`(測試邏輯)/ `review_round`(code review)/ `visual_round`(像素忠實度),各有上限與 circuit breaker。

#### §3.2 Visual Verdict Authority & Separation of Duties(視覺判決權與權責分離)
**目的:這節是一次真實事故(CDE-OOBE false-PASS)的結晶 —— 當時是「協調者自己寫了一條接受政策,預先放行了那個視覺缺陷」,純提示規則擋不住,所以這些規則同時被 server 強制。**
- **視覺判決歸 qa-visual 專屬**:協調者與所有非-qa 角色可以傳遞情境(baseline 路徑、Figma node、route),但**不得定義/override/放寬/預先接受任何視覺差異**。協調者寫的接受政策一律 **void(無效)**。
- **Builder ≠ Judge**:造東西的角色不能自發視覺 PASS;沒有獨立 qa context 時,視覺工作止於 `Blocked`。
- **禁止 whole-frame pixel-%**:稀疏畫布會稀釋局部錯誤,改用 per-region(分區)加權比對 + 結構斷言。
- **R10 順序假設與 reconcile**:平行/inline 執行可能讓 `tasks.md` 與權威的 `handoff.completed_tasks` 脫鉤;用 `tw_sync`(只補帳,絕不寫 handoff)修復。

### §4 Routing Chain(路由鏈)
**目的:定義多階段工作的角色順序與回圈。**(流程圖見第 7 節。)

### §5 Anti-Loop Circuit Breaker(防迴圈斷路器)
**目的:防止 AI 在同一個失敗上無限燒 token。**
- 同一失敗最多 2 次自動修;同一檔最多讀 3 次;超過就停手、上報、等人。
- 自動路由每個 session 最多 10 次角色轉換。

### §6 Security & Privacy(安全與隱私)
- 永不讀/output/改 `.env*`、`*secret*`、被 ignore 清單列的檔;碰到就回 `Access Denied: Security Policy.`
- **依賴稽核門**:跑 build 的角色必須同時跑 `npm audit` 等,HIGH/CRITICAL 視為 build 失敗。

### §7 Cognitive Discipline(認知紀律)
**目的:強制「先想清楚再動手、不確定就喊」的工程素養。**
- 先講假設、模稜兩可就問、有更簡單的做法就反駁(push back)。
- **Read before write**:動程式前先讀 exports / callers / 共用工具。
- **Fail loud**:有跳過就不能說「完成」;有測試沒跑就不能說「測試通過」。
- **外部引用政策**:spec 引用的外部資源(URL、設計檔、ticket)在被抓取/索引/人類確認可忽略之前,一律視為「不完整」。

### Document Priority(文件優先序)
`.antigravityrules` / `CLAUDE.md`(workspace)> Constitution > Skill > Templates。憲法內部衝突時,安全/正確性規則(§2/§3/§6/§7)壓過效率/風格規則(§1)。

---

## 4. 角色與 Skill —— 各自的寫法與目的

系統有 **12 個角色**,每個對應一份 `content/skill-*.md`,並在 README 宣告「推薦模型層級」(advisory,不是 server 強制 —— server 不控制 client 端推理)。**用便宜模型跑機械性角色、貴模型跑重推理角色**,是成本治理的核心。

| 角色 | 層級 | 推薦模型 | 一句話職責 |
|---|---|---|---|
| **researcher** | 高 | `opus` | 多源、有引用的研究,蒸餾成 `research/<topic>.md` |
| **architect** | 高 | `opus` | 把 PM spec 變成零歧義的架構藍圖 |
| **code-reviewer** | 高 | `opus` | 對抗式 diff 裁判,sr 與 qa 之間的正確性門 |
| **design-auditor** | 高 | `opus` | 逐字抽取設計稿的文案/視覺 token 進 `design/<feature>.md` |
| **sr-engineer** | 高 | `opus` | 實作 —— 出可型別、安全的程式碼(熱路徑,品質 > 成本) |
| **coordinator** | 中 | `sonnet` | 分流調度:讀請求、選車道、乾淨交棒 |
| **pm** | 中 | `sonnet` | 寫 spec、拆任務;模稜兩可就停,不猜意圖 |
| **qa-engineer** | 中 | `sonnet` | 寫測試、驗收、擁有「完成」的最終翻牌權 |
| **qa-visual** | 中 | `sonnet` | qa-engineer 的視覺子模式(分區比對、結構斷言) |
| **coordinator-lite** | 低 | `haiku` | 單人直做模式:1 檔編輯/Q&A/狀態查詢,不開鏈 |
| **doc-writer** | 低 | `haiku` | PASS 後同步 README / CHANGELOG / 文件 |
| **release-engineer** | 低 | `haiku` | PASS 後的發版機械:semver、CHANGELOG、tag、gh release |

### Skill 的共同「寫法」(為什麼每份都長這樣)

每份 skill 都遵守同一個結構模板,這本身就是設計:

1. **`## Persona`** —— 一句話人格設定(例:sr-engineer =「Staff-level engineer,出可型別、安全的程式碼,動檔前先標 scope creep 與歧義」)。**目的**:用人格錨定行為傾向。
2. **`## Output rule`** —— 嚴格的對話輸出規格,且**細節進檔案,對話只留指針**(例:architect 最終只回 `Done. Architecture in specs/<feature>-architecture.md.`)。**目的**:壓 token、強迫產出可追溯的 artifact。
3. **`## Hard rules`** —— 該角色的不可違反條款。
4. **`## SOP`** —— 編號步驟,通常 `tw_get_state → tw_detect_drift → 做事 → tw_update_state(next_role: …)`。
5. **`recommended_model`** —— YAML frontmatter 宣告層級。

關鍵設計原則:**skill 繼承憲法,絕不複述憲法**。憲法是共同契約(所有角色都讀),skill 只放「這個角色獨有的程序(procedure)」。這個「契約 vs 程序」的界線,就是判斷一條規則該放憲法還是放 skill 的準則。

### 各角色的目的(重點摘錄)

- **coordinator(協調者)**:第一線接觸點。讀請求 → 用「複雜度 scope gate」判斷直做還是派工 → 自動路由(auto-routing)。偵測到設計來源(Figma / 設計稿關鍵字)就先派 design-auditor。**它只路由與彙總,不做視覺判決**(§3.2 邊界)。
- **coordinator-lite(精簡模式)**:單人日常工作的直做模式。server-read-only、不開鏈、不寫狀態。3 檔以上/新公開 API/需測試/設計決策 → 升級成 full `/teamwork`。**目的:小事不要付全鏈的稅。**
- **pm**:寫 spec、拆任務。有「Resource Audit Gate」—— spec 引用的外部資源沒處理完,不准往下走。模稜兩可就停。
- **architect**:複雜任務才上場,把 spec 變成零歧義藍圖。
- **sr-engineer**:唯一的實作者。有「pre-handoff self-converge loop」可在交棒前一次修完所有結構偏差(v3.31.0 放寬)。
- **code-reviewer**:對抗式裁判。**只看 diff 對照 spec,不看寫的人的推理**(避免被說服)。連續 3 次 FAIL 退回 PM。
- **qa-engineer**:唯一能寫測試、唯一能翻最終 `[x]`、唯一能發 PASS。視覺工作委派給 qa-visual 子模式。
- **design-auditor**:逐字(verbatim)抽取設計稿,絕不改寫。
- **doc-writer / release-engineer**:PASS 後的機械性收尾,跑 haiku 省成本。

---

## 5. 自動化工作鏈 + 流程圖

### 5.1 路由鏈(full `/teamwork` 模式)

```
 researcher?  →  design-auditor?  →  pm  →  architect?  →  sr-engineer  ⇄  code-reviewer  →  qa-engineer  →  PASS
   (選用)         (偵測到設計稿)            (複雜才上)         │      ↑___________________│                  │
                                                              │      (review_round 1-3)                    │
                                                              └──────────────────────────────────────────┘
                                                                     (qa_round 1-3 退回重做 / visual_round 1-5)
                                                                                                          │
                                                                                          PASS 後(人類決定)→ release-engineer / doc-writer
```

### 5.2 每一棒的標準動作

```
進入角色
  │
  ├─ tw_get_state        ← 強制 pre-flight(沒做就 ⛔ BLOCKED)
  ├─ tw_detect_drift     ← 有漂移先報告人類
  │
  ├─ 做本角色的事(讀檔/寫程式/寫測試/審查…)
  │     └─ build gate:零編譯錯誤 + npm audit(HIGH/CRITICAL = 失敗)
  │
  └─ tw_update_state(status, agent_id, pending_notes=["next_role: <下一棒>", …])
        │
        └─ server 驗證 ALLOWED_TRANSITIONS:
              合法 → 寫入(atomic tmp+rename)
              非法 → 回 { error, attempted, allowed, hint } → 自我修正或上報
```

### 5.3 三個獨立回圈(retry 紀律)

| 計數器 | 觸發 | 上限 | 超限 |
|---|---|---|---|
| `review_round` | code-reviewer FAIL | 3 | 第 4 輪只准退回 PM |
| `qa_round` | qa-engineer 測試 FAIL | 3 | 第 4 輪只准退回 PM |
| `visual_round` | qa-engineer 視覺 FAIL(`visual_fail:`) | 5 | 第 3 輪起可請求拆分;第 6 輪鎖回 PM |

**好處**:AI 不會在同一個 bug 上無限燒錢;到上限自動把球交回人類。

### 5.4 自動路由(Auto-Routing)

full 模式預設開啟:每棒交棒後讀 `next_role:`,沒踩到停止條件就自動派下一棒。停止條件:`status: Blocked`、`status: PASS`(終點)、`next_role: human`、沒指定下一棒、或 hop 數 ≥ 10。Claude Code 環境下用 `Task` 工具把每個角色派到**獨立 context + 各自 pin 的模型**(省成本);其他 client fallback 到同 context 的 `tw_switch_role`。

---

## 6. Server-side Gates 一覽(這就是「繞不過」的本體)

| Gate / 機制 | 擋什麼 | 錯誤碼 |
|---|---|---|
| Pre-flight read | 沒先讀狀態就想寫 | `⛔ BLOCKED` |
| 檔案鎖 + mtime | 兩個 IDE 同時寫 → lost update | `⛔ STATE DRIFT` |
| ALLOWED_TRANSITIONS | 非法的角色轉換 | `{error, allowed, hint}` |
| PASS 權限 | 非 qa-engineer 想發 PASS / 翻 `[x]` | 拒絕 |
| Evidence 門 | PASS 沒附證據檔 | 拒絕 |
| 視覺三門 | 設計案缺 baseline / 斷言 / 報告不完整 | `VISUAL_*` |
| Scope 決策門 | 設計案沒記 scope 決策就進 build | `SCOPE_DECISION_REQUIRED` |
| Round 上限 | 同一失敗無限重試 | 鎖回 PM |
| 依賴稽核 | HIGH/CRITICAL 漏洞 | build 失敗 |

---

## 7. 跨 IDE / 跨 Agent + 成本治理(兩個對主管最有感的點)

### 7.1 跨 Agent 轉接層(v3.29.0+)
`agc init` 寫三份「薄轉接檔」:`CLAUDE.md`(Claude Code,marker-block upsert)、`AGENTS.md`(OpenAI Codex)、`.antigravityrules`(Anti-Gravity)。每份只是**指標**,指向 MCP server 服務的憲法,**不複製規則** → 單一真理來源。`agc check` 比對版本戳記,過期就 exit 1 → 漂移可偵測而非無聲。

### 7.2 Context 成本治理(v3.31.0–v3.34.0,本週剛完成)
憲法每次 dispatch 都注入,所以它的大小是「每次對話的固定稅」。三條條件式精簡軸(都在 `prompts/build.ts`):

| 軸 | helper | 剝除什麼 | 何時 |
|---|---|---|---|
| chain-only | `stripChainOnly` | §3.1 + §3.2 + §4 | 精簡模式 |
| rationale | `stripRationale` | §1/§7 的 `<!-- rationale -->` 解釋性例句 | 每次非 full 的鏈 dispatch |
| **design-only** | `stripDesignOnly` | 視覺治理(§3.2、§3.1 視覺門、§4 visual prose、§1 視覺例外) | **僅非設計案** |

**design-only 的巧思**:視覺治理在非設計案上本來就 inert(server 視覺門靠 `## Mode ≠ no-design` 自我武裝),所以那段文字在非設計案的鏈 dispatch 被剝除。剝除的觸發條件**重用 server PASS 門同一個 `hasDesignModeRequiringVisual()` helper** → 憲法文字「正好在門能觸發時存在、在 inert 時剝除」,兩者不可能 drift。

**成效**:非設計案的憲法從 ~4,233 → **~2,409 tokens**(每跳輕 ~1,790),設計案完整載入不變。由 `scripts/measure-context-cost.mjs` 量測、`test/context-budget.test.mjs` 釘住。

---

## 8. 給主管的「好處」總結(Business Value)

1. **可重現的品質**:不是靠「找到好的 prompt」或「祈禱 AI 乖」,而是 server 端硬性把關。AI 違規 = 收到 `⛔ BLOCKED`,寫不進去。
2. **多工具不打架**:團隊可以同時用 Cursor / Claude Code / Codex / Gemini,共享同一份狀態與規則,不會互相覆蓋、不會規則各寫一份。
3. **權責分離防自欺**:「造的人不能當裁判」—— 只有 qa-engineer 能發 PASS、只有 qa 能寫測試。這條規則是一次真實 false-PASS 事故換來的,且被 server 強制。
4. **退場與重試紀律**:三個 round 計數器 + 防迴圈斷路器,AI 不會在死路上無限燒錢,到上限自動把球交回人類。
5. **成本可控**:角色分層派模型(機械性工作跑 haiku、重推理跑 opus)+ 條件式精簡憲法,把 token 花在刀口上。
6. **誠實的邊界**:它不假裝萬能(見第 9 節),把無法強制的部分明確標成「可偵測」,這是成熟的工程分寸。

---

## 9. 限制(誠實邊界 —— 採用前必讀)

- **無法強迫 AI 遵守憲法**:只能注入 context。AI 仍會 hallucinate;gate 擋的是「狀態寫入」,不是「壞的推理」。
- **無法擋直接 `fs.write`**:AI 若繞過 MCP 直接改 `handoff.md`,要靠 `tw_detect_drift` 在**下個** session 抓,不是即時擋。
- **`agent_id` 是自報的**:gate 擋空值/拼錯,但擋不住刻意冒名。
- **stdio 模式只在單機**:跨機器要用 HTTP+SQLite 模式,或把 `.current/` commit 進 Git。
- **首次 `npx` 拉取慢**:30–60 秒;SessionStart hook 的 timeout 若 < 60s 會看起來壞掉(最常見的安裝坑)。

---

## 附錄:延伸閱讀(repo 內)

- `README.md` —— user-facing 安裝與總覽
- `content/constitution.md` —— 憲法本體(唯一真理來源)
- `content/constitution-rationale.md` —— 憲法每條規則背後的「為什麼」
- `content/skill-*.md` —— 12 個角色的 SOP
- `docs/architecture.md` —— 9 步寫入管線、狀態機、RAG 生命週期
- `research/` —— token 撙節稽核、業界對位、事故 retrospective
- `CHANGELOG.md` —— 每個版本與其 rationale
