# Research: Design Fidelity Enforcement — Closing the Figma/Design-Spec Gap

**Filed**: 2026-05-21
**Author**: researcher
**Scope**: Threads 1–4, 6 follow-ups from `research/external-reference-policy-followups.md`
**Focus**: (a) external resources like Figma not being read → product ≠ design, (b) implementation not fully following design spec

---

## Summary

- **v3.7.3 已修補「文字漂移」問題** (Copy / Strings H2 + QA Copy Audit Gate)，但 **防線仍是 SOP 文字層**——skill markdown 只是建議，agent 可跳過。
- **外部資源（Figma）的根本問題有兩層**：(1) PM 未讀取設計稿就寫 spec，(2) 即使讀取了，也沒有結構化地將設計稿內容（文字、色彩、佈局）綁定到 AC。
- **server-enforced Resource Audit Gate（Thread 1）是最高槓桿改進**：在 `tw_update_state` 的 PM→architect 轉場時，server 可 grep PRD 內的外部參考 URL，若 spec 的 Dependencies/Prerequisites 未逐一分類，則拒絕轉場。
- **Figma MCP 整合（Thread 2）可大幅降低摩擦**：PM 掃到 `*.figma.com` 時自動建議呼叫 Figma MCP 的 `get_file` tool，直接抽取 text nodes 寫入 Copy / Strings 表。
- **Copy / Strings 表 + Copy Audit Gate 已涵蓋「文字」面向**，但 **視覺保真度（色彩、間距、圖標）仍然靠 AC 人工描述**——長期應考慮 visual regression baseline。

---

## Evidence

### E1: PM 缺乏強制讀取外部資源的 server guard

- [skill-pm.md L33](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-pm.md#L33): Resource Audit Gate 是 SOP step 3，純文字指令。
- [transitions.ts L84–89](file:///Users/paul.ph.chen/agent-governance-mcp/tools/transitions.ts#L84-L89): `pm:In_Progress` 可直接轉 `architect:In_Progress` 或 `sr-engineer:In_Progress`，**無任何 payload 驗證**。Server 不檢查 spec 是否存在、是否包含 Resource Audit 結果。
- [constitution.md L72](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L72): §7 External-reference policy 宣告「no role may unilaterally treat refs as out-of-scope」，但唯一的執行力來自 skill text。
- **Post-mortem 佐證**：`cde-oobe` 的 Figma URL 被 architect 單方面標 out-of-scope（followups.md L22–24），PM 從未執行 Resource Audit。

### E2: Copy / Strings 已修補文字漂移，但只在 SOP 層

- [skill-pm.md L18](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-pm.md#L18): Copy / Strings H2 要求 `string id | exact text | source` 表。
- [skill-qa-engineer.md L28–30](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-engineer.md#L28-L30): Copy Audit Gate (Phase 1 step 3a) 會 grep 實作，但這是 QA agent 的 SOP 文字，**不是 server guard**。
- **風險**：如果 agent context window 太小或 agent 忽略 SOP，Copy Audit 不會執行。

### E3: Figma MCP 可程式化抽取文字

- Web research: Figma MCP server 可透過 `get_file` / node selection 回傳所有 `type=TEXT` node 的 `characters` 屬性。
- 現有 MCP 配置中 **未見 Figma server**，但架構上 PM skill 可偵測 `*.figma.com` URL 後建議用戶啟用。

### E4: Server 已有 PRD 路徑追蹤基礎建設

- [handoff.ts L32](file:///Users/paul.ph.chen/agent-governance-mcp/tools/handoff.ts#L32): `prd_path` 欄位在 handoff state 中已存在。
- [rag.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts): `tw_index_prd` 可 chunk + embed PRD。
- 這表示 server 已有能力在轉場時讀取 PRD 並 grep 外部參考。

---

## Recommendation

**分三階段遞進，由低成本到高成本**：

### Phase A — Server-enforced Resource Audit Gate（Thread 1，建議 v3.8.0）

在 `tw_update_state` handler 中，當 `(pm, In_Progress) → (architect|sr-engineer, In_Progress)` 時：

1. Server 讀取 `state.prd_path`（若無則跳過 — 向下相容）。
2. Grep PRD 內容，用 regex 擷取外部參考：
   ```
   /(https?:\/\/[^\s)]+|figma|sketch|mockup|設計圖|see\s+\w+-\d+)/gi
   ```
3. 讀取 `specs/<feature>.md` 的 **Dependencies / Prerequisites** section。
4. 對每個 PRD hit，驗證 spec 中是否存在對應分類（`fetch` / `index` / `ignore`）。
5. 缺漏 → reject transition，返回結構化 error：
   ```json
   {
     "error": "RESOURCE_AUDIT_INCOMPLETE",
     "unclassified_refs": ["https://figma.com/file/xxx", "設計圖：Figma URL"],
     "hint": "PM must classify each ref in spec Dependencies/Prerequisites before handoff."
   }
   ```

**成本**：~150 行 TS，新增 `guards/resource-audit.ts`。
**風險**：false positive 需要 allowlist（code-fence URLs, footnotes）。建議初版用 warning-only mode + `--strict-resource-audit` flag 控制。

### Phase B — Figma MCP hostname routing（Thread 2，建議 v3.8.x）

在 `skill-pm.md` Resource Audit Gate 的 `fetch` 選項中，新增 hostname → MCP tool 建議表：

| Hostname pattern | Suggested MCP | Tool |
|---|---|---|
| `*.figma.com` | `figma` | `get_file` → 抽取 text nodes → 寫入 Copy / Strings |
| `dev.azure.com` | `azure-devops` | `wit_get_work_item` |
| `*.atlassian.net` | JIRA MCP | `get_issue` |

PM 偵測 `fetch` 選擇後，輸出：
```
建議工具：figma MCP → get_file(file_key=xxx, node_ids=[...])
將自動抽取所有 TEXT node 並填入 Copy / Strings 表。
```

**成本**：~50 行 skill-pm.md 文字 + PM SOP 邏輯（agent 側）。
**前提**：用戶需在 MCP config 中啟用 Figma server。PM skill 應 graceful degrade（偵測 MCP server 列表，若無 Figma server 則回退為手動 fetch）。

### Phase C — Visual Fidelity Baseline（長期，v3.9+）

Copy / Strings 解決了「文字」，但**視覺屬性（色彩、間距、圓角、圖標）仍靠 AC 描述**。長期選項：

1. **QA Phase 3 加入 screenshot comparison**：用 Playwright `toHaveScreenshot()` 對比 Figma 導出的 baseline PNG。需要 Figma REST API 導出 + Playwright 整合。
2. **Applitools / Percy 整合**：第三方 visual regression 服務，可直接用 Figma 作為 baseline。

這超出 agent-governance-mcp 的核心職責，建議作為外部工具整合，不內建。

---

## Alternatives Considered

### Alt 1: 在 constitution 加更多文字規則（不加 server guard）
- **拒絕原因**：`cde-oobe` 的失敗正是因為文字規則被忽略。Constitution §7 + skill-pm L33 已經很明確，問題不在規則缺失，而在執行力。SOP 文字對 context window 壓力大的 agent 不可靠。

### Alt 2: Server 強制讀取 Figma（server 直接呼叫 Figma API）
- **拒絕原因**：server 是 MCP provider，不應主動呼叫其他 MCP server 或外部 API。這違反 MCP 架構的單向依賴。正確做法是讓 PM agent 透過 MCP client 呼叫 Figma server。

### Alt 3: 在 sr-engineer 層加 design check
- **拒絕原因**：太晚。sr-engineer 已在實作，此時發現設計稿未讀取要全部重來。應在 PM→architect 轉場時攔截。

---

## Open Questions

1. **Warning-only vs strict mode**：Phase A 的 Resource Audit Gate 初版應該是 warning（log but allow transition）還是 strict（block transition）？建議 warning-only 先收集 false positive 數據，再切 strict。
2. **PRD 以外的文件**：有些專案的外部參考不在 PRD，而在 user story ticket 或 Notion page。Phase A 只 grep `prd_path`，其他文件需要人工或 PM 補充。
3. **Figma MCP 的可用性**：Figma MCP server 是否穩定到可以寫入 PM SOP？需要實測 `get_file` 回傳的 text node 結構。
4. **Copy / Strings 是否應涵蓋 assets**（Thread 6 followup #1）：建議不擴展——asset 的正確性更適合 visual regression，不適合文字表格。
5. **i18n 字串表的格式**（Thread 6 followup #3）：建議 Copy / Strings 只列 canonical language（通常英文），i18n 由獨立的 localization review ticket 處理，不混入 spec。
