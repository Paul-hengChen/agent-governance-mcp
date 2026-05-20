# CLAUDE.md 12-Rule Template vs Constitution v3.4.0 — 融合分析

## Summary

- **12-rule template 是優秀的「個人開發者 / 單 agent」憲法**，強調思考紀律、簡潔性、和認知誠實。你的 Constitution v3.4.0 則為 **多 agent 協作** 設計，側重狀態同步與角色路由。
- 兩者**互補大於衝突**：12-rule 覆蓋了你的憲法缺少的「思考品質」規範（Rule 1, 4, 8, 10, 12）；你的憲法覆蓋了 12-rule 完全沒有的「多角色狀態機」。
- **直接衝突只有 1 處**：12-rule Rule 6 的 token budget（4k/task, 30k/session）與你的 terse output（≤15 words）目標一致但機制不同。你的是 output 約束，12-rule 是 input+output 預算。可並存。
- **建議融合策略**：將 12-rule 中 5 條高價值規則提取為你 Constitution 的新 §7「Cognitive Discipline」，而非取代現有結構。
- **不建議全盤採用 12-rule**：它缺乏你已有的 state sync、routing chain、QA enforcement 等核心多 agent 機制，且沒有 MCP 工具意識。

## Evidence

### 逐條對照表

| 12-Rule | 你的 Constitution | 關係 | 融合價值 |
|---|---|---|---|
| **R1 Think Before Coding** — 顯式假設、推回簡化方案 | 無對應 | ✅ **填補空白** | 高 — 防止 agent 衝動行動 |
| **R2 Simplicity First** — 最少代碼解決問題 | §1 MVP strict | 🔄 **重疊** | 低 — 已覆蓋 |
| **R3 Surgical Changes** — 只改必要的 | §1 MVP strict | 🔄 **重疊** | 低 — 已覆蓋 |
| **R4 Goal-Driven Execution** — 定義成功標準、迭代 | 無對應 | ✅ **填補空白** | 高 — 比「做被要求的」更深一層 |
| **R5 Use model only for judgment** — 確定性邏輯用代碼 | 無對應 | ⚡ **新維度** | 中 — 適合計算密集場景 |
| **R6 Token budgets** — 4k/task, 30k/session | §1 Terse (≤15 words) | 🔄 **互補** | 中 — 可吸收為 budget 意識 |
| **R7 Surface conflicts** — 矛盾時選一個、解釋為什麼 | 無對應 | ✅ **填補空白** | 高 — 防止 agent 混合矛盾模式 |
| **R8 Read before write** — 先讀 exports、callers | §5 File reads max 3 | 🔄 **互補** | 中 — 你的是限制次數，12-rule 是強制閱讀 |
| **R9 Tests verify intent** — 測試編碼 WHY | §2 Test strategy | 🔄 **延伸** | 中 — 可加入 qa-engineer skill |
| **R10 Checkpoint** — 每步總結 | §3 State update | 🔄 **重疊** | 低 — tw_update_state 已實現 |
| **R11 Match conventions** — 遵循 codebase 風格 | §2 Strict typing | 🔄 **延伸** | 中 — 可泛化為風格一致性 |
| **R12 Fail loud** — 不靜默跳過 | §5 Escalation | 🔄 **重疊** | 低 — 已有上報機制 |

### 核心設計哲學差異

| 維度 | 12-Rule Template | Constitution v3.4.0 |
|---|---|---|
| **目標使用者** | 單一 Claude agent + 人類開發者 | 多 agent 系統（coordinator → pm → engineer → qa） |
| **狀態管理** | 無（靠 agent 自律） | Server-enforced handoff state machine |
| **角色概念** | 無角色分離 | 5+ roles with SOP per skill |
| **品質保證** | R9 tests, R12 fail loud | Dedicated qa-engineer + 3-round review cycle |
| **Token 意識** | 明確數字預算 | Output 長度約束 |
| **認知紀律** | 強（R1, R4, R7, R8, R10） | 弱 — 偏向流程合規而非思考品質 |

Source: 12-rule template from `@Mnilax` X article; Constitution v3.4.0 from `content/constitution.md`

## Recommendation

**推薦方案：Cherry-pick 融合 — 新增 §7 Cognitive Discipline**

在 Constitution v3.4.0 中新增一個章節，提取 12-rule 中你缺少的高價值規則：

```markdown
## 7. Cognitive Discipline

- **Think first**: State assumptions before coding. If ambiguous, ask. Push back when simpler approach exists. (← R1)
- **Goal-driven**: Define success criteria before execution. Loop until verified. (← R4)
- **Surface conflicts**: When patterns contradict, pick one (more recent / more tested), explain why, flag the other. Don't blend. (← R7)
- **Read before write**: Before adding code, read exports, callers, shared utilities. "Looks orthogonal" is not safe. (← R8)
- **Fail loud**: "Completed" is wrong if anything was skipped. Default to surfacing uncertainty. (← R12)
```

**理由**：
- **低成本**：+5 bullets，~100 tokens 增量
- **高價值**：填補你的憲法在「思考品質」維度的空白
- **零衝突**：不觸動現有 §1-§6 的任何規則
- **版本控制**：標註為 v3.5.0，changelog 記錄來源

## Alternatives Considered

### A. 全盤取代 — 用 12-rule 替換 Constitution
**拒絕理由**：12-rule 缺乏 state sync（§3）、routing chain（§4）、server-enforced QA（§3.1）。這些是你的 MCP server 的核心差異化。全盤取代 = 退化為單 agent 模式。

### B. 雙文件並行 — Constitution + CLAUDE.md
**拒絕理由**：根據你的 Document Priority（`CLAUDE.md > Constitution`），這會讓 CLAUDE.md 覆蓋 Constitution，破壞 state sync 規則。且雙文件增加維護成本和 token 開銷。

### C. 不融合 — 維持現狀
**拒絕理由**：可行但錯失價值。12-rule 的認知紀律規則（R1, R4, R7）真的很好，你的憲法目前缺少這個維度。

## Open Questions

1. **Token budget 規則（R6）是否值得引入？** 你的系統已有 terse output 約束，但沒有 per-task/per-session 的總量預算。這在多 agent 場景更難追蹤 — 需要 MCP server 層面支持還是僅靠 agent 自律？
2. **R5（Use model only for judgment）是否適用？** 在 MCP 工具驅動的環境中，大部分確定性工作已經由工具完成。這條規則可能在你的架構中已被隱式滿足。
3. **R9（Tests verify intent）要放入 qa-engineer skill 還是 Constitution？** 它偏向測試哲學，可能更適合作為 qa-engineer skill 的 SOP 補充。
