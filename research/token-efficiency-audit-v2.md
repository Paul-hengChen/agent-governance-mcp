# Research: Token Efficiency Audit v2

> @researcher · 2026-05-19

## Summary

- **所有 6 個 skill 都已遵守節省 token 精神**。先前 v1 審計（conversation 6adfbabc）壓縮了 constitution §3.1 後，目前 constitution 為 3,952 B，已是精簡狀態。
- **qa-engineer (3,765 B) 仍是最大 skill**，但其 4-phase SOP + 3-round discussion protocol 的複雜度需要這些指令，無法再壓縮而不損失功能。
- **coordinator 從 1,174 B 增長到 2,024 B**（+72%），新增 Complexity Scope Gate 是合理的功能擴展，避免過度 routing 反而節省 token（減少不必要的 tw_switch_role 調用）。
- **drift 工具回傳可能成為 token 黑洞**：當 completed_tasks 與 handoff 不同步時（如目前 T01–T28），drift 回傳 28 條重複格式的 detail 字串，每條 ~80 bytes ≈ 2,240 B 額外消耗。建議加上截斷或摘要機制。
- **handoff state 的 `pending_notes` 有累積風險**：sr-engineer 的 pending_notes 包含完整 deliverable 描述（目前 ~800 B），每次 tw_get_state 都會回傳。建議限制長度或摘要化。

## Evidence

### Prompt 注入成本（每次角色載入）

```
constitution.md (3,952 B) + skill-<role>.md (N B) + state JSON (~200-800 B)
```

| 角色 | skill 大小 | 總注入估計 (bytes) | 佔比 (skill/total) | 變化 (vs v1) |
|---|---|---|---|---|
| researcher | 1,144 | ~5,296 | 22% | 不變 |
| architect | 1,705 | ~5,857 | 29% | 不變 |
| sr-engineer | 1,876 | ~6,028 | 31% | 不變 |
| pm | 1,881 | ~6,033 | 31% | 不變 |
| **coordinator** | **2,024** | **~6,176** | **33%** | **+72%** |
| **qa-engineer** | **3,765** | **~7,917** | **48%** | 不變 |

> coordinator 增長原因：新增 Complexity Scope Gate (§ Scope gate, 5 rules + 1 fallback)，這是有意為之的功能擴展。Source: [skill-coordinator.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-coordinator.md#L21-L31)

### Tool 回傳 token 成本分析

| 工具 | 典型回傳大小 | 浪費風險 | 備註 |
|---|---|---|---|
| `tw_get_state` | 200–1,500 B | ⚠️ 中 | `pending_notes` 可能包含大段 deliverable 描述 |
| `tw_detect_drift` | 100–3,000 B | 🔴 高 | 28 條 drift = 2,240 B 重複格式文字 |
| `tw_update_state` | ~80 B | ✅ 低 | 只回傳 success + path |
| `tw_switch_role` | 1,200–3,800 B | ⚠️ 中 | 回傳完整 skill SOP + instruction 包裝 |
| `tw_get_next_task` | ~100 B | ✅ 低 | 單行 |
| `tw_complete_task` | ~100 B | ✅ 低 | 單行 |
| `tw_rollback_task` | ~100 B | ✅ 低 | 單行 |

### 具體問題：drift 回傳膨脹

目前的 drift 輸出 ([drift.ts:86-92](file:///Users/paul.ph.chen/agent-governance-mcp/tools/drift.ts#L86-L92))：

```
每條: "Task list shows T01 completed, but handoff state doesn't mention it. Possible vibe-coding drift."
× 28 條 = ~2,240 bytes ≈ 560 tokens
```

這些 drift 全部是相同格式的重複資訊。Agent 只需要知道「T01–T28 在 task list 已完成但 handoff 未記錄」即可。

### 具體問題：pending_notes 累積

[handoff.ts:L37](file:///Users/paul.ph.chen/agent-governance-mcp/tools/handoff.ts#L37) 的 `COMPLETED_TASKS_RETURN_LIMIT = 50` 已對 completed_tasks 做截斷，但 pending_notes 無上限。目前 sr-engineer 的 pending_notes 包含 5 條詳細技術描述，合計 ~800 B。

### Skill 逐一合規性

1. **coordinator** — ✅ 合規。Scope Gate 增加了 token 但**減少了不必要的 role switch**，淨效果為正。Output rule 仍是「≤ 15 words」。
2. **pm** — ✅ 合規。Output rule「≤ 1 sentence」。Spec/Task schema 精簡，無冗言。
3. **architect** — ✅ 合規。Output rule「≤ 1 sentence」。Schema 5 個 H2 section 都是必要的。
4. **sr-engineer** — ✅ 合規。Output rule「≤ 15 words」。Hard rules 只有 2 條。Security Checklist 3 點也是最小集。
5. **qa-engineer** — ✅ 合規但最大。4 phase SOP 反映真實複雜度：review → discussion → tests → run。**不建議壓縮**——拆分為子角色會增加 routing token 消耗（v1 審計已 reject 此方案）。
6. **researcher** — ✅ 合規。最精簡的 skill（1,144 B）。

### Constitution 合規性

- §3.1 已在 v1 審計中壓縮（4,683 → 3,952 B，省 ~185 tokens/prompt）。
- 目前所有 section 都只含 behavioral contract，server implementation detail 已移到 `specs/qa-flow-enforcement-architecture.md`。
- Constitution 的「Skills inherit everything below — they MUST NOT restate these rules」避免了規則重複。

## Recommendation

**主要建議：壓縮 drift 工具回傳**（低成本 / 高收益）。

在 `tools/drift.ts` 中加上摘要邏輯：當同類 drift 超過 N 條時，合併為一行摘要：

```
Before: 28 × "Task list shows TXX completed, but handoff state doesn't mention it."
After:  1 × "28 tasks (T01–T28) completed in task list but not in handoff state. Likely accumulated prior-session drift."
```

預估節省：每次 drift 調用省 ~2,000 B ≈ 500 tokens。每個角色切入時都會調用 drift，因此**整個 feature lifecycle 省 ~2,500–5,000 tokens**。

**次要建議（可選）**：
- 對 `pending_notes` 在 `readHandoffState` 回傳時加上字元截斷（如 3,000 chars），類似 `COMPLETED_TASKS_RETURN_LIMIT` 的做法。

## Alternatives Considered

- **動態載入 skill section**（只載入當前 phase）：rejected。LLM 需完整 SOP 判斷所在 phase，且 server 複雜度增加不值得。（v1 審計同結論）
- **拆分 qa-engineer 為 reviewer + test-writer**：rejected。多一次 routing transition 消耗的 token > skill 文本差異。（v1 審計同結論）
- **移除 coordinator Scope Gate**：rejected。Gate 防止過度 routing，淨效果為節省 token。

## Open Questions

1. **drift 摘要的閾值**：建議 N=5（超過 5 條同類 drift 就合併），但需確認 PM 是否有不同看法。
2. **pending_notes 截斷**是否要做成 server 端截斷 vs 讓調用者自行管理？截斷可能遺失重要交接資訊。
