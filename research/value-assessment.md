# Research: Agent Governance MCP — 誠實價值評估

> @researcher · 2026-05-19

## Summary

- **核心價值成立**：跨 IDE / 跨 session 的狀態同步 + drift 偵測是真實痛點的真實解法，市面上沒有等價替代品。
- **但 token 開銷是致命傷**：治理架構本身每次互動消耗 ~2,000 tokens baseline（constitution + skill + state sync），完整 feature lifecycle 可達 50,000+ tokens。這與「節省 token」的精神矛盾。
- **Multi-role chain 對個人開發者是 overkill**：pm → architect → sr-engineer → qa-engineer 的完整 chain 適合嚴肅的多人協作，但對 solo dev 的日常工作是**淨負擔**。
- **作為面試作品價值極高**：展示了 state machine、concurrency control、cooperative guardrail 等系統設計能力。但「面試用」和「日常實用」是兩件事。
- **建議**：保留 Layer 1（state sync）+ Layer 3（guards），大幅精簡或設為可選的 Layer 2（multi-role chain），才能成為真正日常實用的工具。

## Evidence

### 價值成立的部分

| 功能 | 解決的真實問題 | 替代方案 | 勝出原因 |
|---|---|---|---|
| `handoff.md` 狀態持久化 | AI 金魚腦，跨 session 遺忘 | CLAUDE.md / .cursorrules | 那些是靜態規則，不含動態狀態（active_feature, completed_tasks） |
| `tw_detect_drift` | 多 IDE 同時改壞進度 | 無 | 市面上沒有等價工具 |
| File lock + mtime check | Lost update / torn write | git commit .current/ | git 需人工操作，lock 是自動的 |
| `ALLOWED_TRANSITIONS` | 防止 QA 流程被跳過 | 純 prompt 約束 | Prompt 約束可被忽略，server 拒絕不可忽略 |

Source: 實際開發體驗 + [README.md 限制章節](file:///Users/paul.ph.chen/agent-governance-mcp/README.md)

### Token 成本分析（真實數據）

本次 session 的 token-efficiency-improvements 功能，走完整 chain：

```
coordinator: tw_get_state + tw_detect_drift           ~1,500 tokens
coordinator: tw_switch_role(sr-engineer)               ~1,000 tokens
sr-engineer: 再次 tw_get_state（transition 被拒）       ~1,500 tokens
sr-engineer: tw_update_state（被拒，自修正）             ~500 tokens
sr-engineer: 第二次 tw_update_state                     ~500 tokens
qa-engineer: tw_get_state + tw_detect_drift            ~1,500 tokens
qa-engineer: tw_update_state (claim)                    ~500 tokens
qa-engineer: review + write tests                      ~8,000 tokens
qa-engineer: tw_get_state + tw_update_state (PASS)      ~1,000 tokens
```

**治理 overhead（非業務邏輯）：~8,000 tokens ≈ 整體的 50%**

這還不含每次角色載入的 constitution（~1,000 tokens）+ skill（~300-950 tokens）的 prompt 注入。

### Multi-role Chain 的 ROI

| 場景 | Chain 帶來的品質提升 | Token 成本 | ROI |
|---|---|---|---|
| 大型功能（>10 files, >500 LoC） | 高：QA 能抓到真 bug | ~50,000 tokens | ✅ 值得 |
| 中型功能（2-5 files, 50-200 LoC） | 中：QA 多半 rubber-stamp | ~25,000 tokens | ⚠️ 邊際 |
| 小修改（1 file, <50 LoC） | 低：chain 全是 overhead | ~15,000 tokens | ❌ 浪費 |
| Q&A / 文件修改 | 無：coordinator 直接做 | ~2,000 tokens | ✅ 合理 |

### 誠實的自我批評

1. **治理系統治理自己的悖論**：這個 session 裡，系統用自己的 multi-role chain 來實作「節省 token」的功能。實作 + QA 的治理 overhead (~8,000 tokens) 可能比未來省下的 token 還多。需要多次 drift 調用才能回本。

2. **`agent_id` 是自報的**：任何 agent 都可以聲稱自己是 `qa-engineer`。gate 只防「忘記填」或「填錯」，不防「主動騙」。這在 [README 限制章節](file:///Users/paul.ph.chen/agent-governance-mcp/README.md) 有誠實標註。

3. **`tw_switch_role` 不換 LLM**：只回傳 SOP 文字。模型是否「真的」進入角色無法驗證。角色切換更多是心理暗示而非技術強制。

4. **drift 偵測是事後的**：如果 agent 用 `fs.write` 直接改 handoff.md，只有下次 `tw_detect_drift` 才會發現。系統是 detective control，不是 preventive control。

5. **schema versioning 可能過度工程化**：4 個 artifact 的獨立版本追蹤 + lazy migrate-on-read，對一個 ~700 行的 MCP server 來說是重砲打蚊子。但作為面試作品展示 forward/backward compatibility 思維是加分的。

### 與替代方案的比較

| 方案 | 狀態持久化 | 規則強制 | Multi-agent | Token 成本 | 維護成本 |
|---|---|---|---|---|---|
| **agent-governance-mcp** | ✅ 完整 | ✅ Server-enforced | ✅ 6 角色 | 🔴 高 | 🔴 高 |
| **CLAUDE.md + .cursorrules** | ❌ 無 | ⚠️ 純 prompt | ❌ 無 | ✅ 零 | ✅ 低 |
| **Speckit / custom task.md** | ⚠️ 手動 | ⚠️ 純 prompt | ❌ 無 | ✅ 零 | ✅ 低 |
| **理想方案**：精簡版 governance | ✅ handoff 持久化 | ✅ Guard only | ⚠️ 可選 | 🟡 中 | 🟡 中 |

## Recommendation

**保留核心，精簡角色鏈。**

具體建議：

1. **保留**（核心價值）：
   - `tw_get_state` / `tw_update_state`（狀態持久化）
   - `tw_detect_drift`（drift 偵測）
   - File lock + mtime check（並行控制）
   - Constitution §1–§3（基本規則）

2. **設為可選**（非預設啟用）：
   - Multi-role chain（pm → architect → sr-engineer → qa-engineer）
   - QA-flow enforcement（ALLOWED_TRANSITIONS）
   - Schema versioning

3. **新增 "lite mode"**：
   - 只載入 coordinator skill（~2K tokens）
   - 不強制 `tw_detect_drift`
   - 直接執行，不 route
   - 適合 solo dev 日常工作

這樣你的日常使用成本從 ~15,000 tokens/task 降到 ~3,000 tokens/task，只有真正需要品質把關的功能才啟用完整 chain。

## Alternatives Considered

- **完全放棄 multi-role**：rejected。它在複雜功能開發中確實有價值，且是面試亮點。但應該是 opt-in，不是預設。
- **換成 background process 持續監控**：rejected。增加系統複雜度，且 MCP 協議不支援 server push。
- **只保留 CLAUDE.md**：rejected。失去狀態持久化和 drift 偵測的核心價值。

## Open Questions

1. **"lite mode" 的具體設計**：是一個新的 prompt（如 `/teamwork-lite`），還是 coordinator 自動判斷？
2. **是否值得發佈到 npm**：目前只能 `npx github:...`，若要推廣到團隊/社群，npm 發佈 + 文件國際化是必要的。
3. **社群定位**：是定位為「個人生產力工具」還是「團隊治理框架」？兩者的設計決策方向不同。
