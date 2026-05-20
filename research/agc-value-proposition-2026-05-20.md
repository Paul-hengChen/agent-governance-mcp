# Research: agent-governance-mcp 的價值是什麼？

> @researcher · 2026-05-20
> 問題：agent-governance-mcp 的價值是什麼？可以幫助團隊或者個人提高工作效率嗎？

---

## Summary

- **核心價值：跨 IDE / 跨 session 的狀態同步 + 併發保護 + 規則統一注入**——這三者的組合在 MCP 生態中獨一無二，市面無等價替代品。([README.md](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L24-L27))
- **個人效率提升已驗證**：v3.6.0 新增的 Lite Mode (`/teamwork-lite`) 回應了先前研究指出的「multi-role chain 對 solo dev 是淨負擔」問題，將每次互動的 token 開銷從 ~15,000 降至 ~3,000。([CHANGELOG.md v3.6.0](file:///Users/paul.ph.chen/agent-governance-mcp/CHANGELOG.md#L33-L63))
- **團隊效率提升有條件**：2–3 人工作室用 HTTP + SQLite 模式共享狀態已可行；10+ 人團隊需要 Linear/Jira，此工具無法取代。([value-assessment-2026-05.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment-2026-05.md#L46-L53))
- **技術品質紮實**：~2,167 LOC TypeScript、4 runtime deps、6 層防禦（Zod → pre-flight → lock → mtime → atomic write → transition matrix）、235 passing tests。([package.json](file:///Users/paul.ph.chen/agent-governance-mcp/package.json), [honest-evaluation.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L23-L37))
- **最大瓶頸是 adoption friction，不是技術**：新用戶需理解 MCP 概念 + 配置 IDE + 建立 `.current/` + 學習 10 個工具和 7 個角色。([honest-evaluation.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L166-L180))

---

## Evidence

### 1. 它解決的四個真實痛點（hard guarantee）

| 痛點 | 解法 | 保證等級 | Source |
|---|---|---|---|
| 金魚記憶（跨 session 遺忘） | `handoff.md` YAML 持久化 + `tw_get_state` 強制先讀 | ⚙️ Server 強制 | [README §Pain Point 1](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L55-L58) |
| 併發覆蓋（多 IDE 同時寫 → lost update） | `O_EXCL` file lock + mtime freshness + atomic rename | 🔒 OS 層保證 | [README §Layer 3](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L117-L123) |
| 格式腐壞（AI 手寫 YAML 語法壞） | Zod schema validation + `js-yaml` 序列化 | 🔒 Server 強制 | [README §Layer 2](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L94-L111) |
| 規則散落（多 IDE 各自為政） | Constitution-as-Code + MCP prompt 統一注入 | ⚠️ Soft（依賴 LLM 合作） | [README §Layer 1](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L81-L92) |

### 2. 效率提升的真實場景分析

**對個人開發者（ROI 最高）：**
- 多 IDE 同開（Claude Code + Cursor + Antigravity），切換時不需重新交代進度
- Constitution 自動注入所有工具，規則修改一處生效
- Lite Mode（v3.6.0+）跳過 multi-role chain，~80% per-task token 節省
- Source: [CHANGELOG v3.6.0](file:///Users/paul.ph.chen/agent-governance-mcp/CHANGELOG.md#L33-L63), [value-assessment.md §Recommendation](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment.md#L76-L99)

**對小團隊（2–3 人）：**
- HTTP + SQLite 模式已完成，每人 IDE 連同一 server
- `ALLOWED_TRANSITIONS` 強制 QA 流程不可跳過（v3.2.0），防止 engineer 自己 mark PASS
- 3 rounds QA fail → 強制 PM 介入（Round 4 circuit breaker）
- Source: [CHANGELOG v3.2.0](file:///Users/paul.ph.chen/agent-governance-mcp/CHANGELOG.md#L170-L204)

**對大團隊（>5 人）——不適用：**
- 缺少 Web dashboard、RBAC、audit log、multi-tenant isolation
- `handoff.md` 不是 issue tracker，無法取代 Linear/Jira
- Source: [honest-evaluation.md §Weaknesses](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L43-L111)

### 3. v3.6.1 當前狀態（已解決先前研究指出的問題）

| 先前研究指出的問題 | 狀態 | 解法 |
|---|---|---|
| Multi-role chain 對 solo dev 是 overkill | ✅ 已解決 | v3.6.0 `/teamwork-lite` |
| Token 開銷過高 | ✅ 部分解決 | v3.4.0 drift compression + pending_notes truncation |
| 角色切換是 theater | ⚠️ 本質限制 | MCP 協議無 caller-id，無法 server-side 強制 |
| File ops 不支援 remote | ✅ 已解決 | v3.1.0 Phase 7 storage adapter |
| 測試覆蓋不足 | ✅ 已大幅改善 | 235 tests passing（Phase 5a/5b） |

### 4. 市場唯一性

在 2026 年 MCP 生態中，agent-governance-mcp 是**唯一**同時滿足以下組合的開源方案：

```
MCP 原生 + 跨 IDE + 併發保護 + 規則注入 + 零配置（npx）
```

Source: [honest-evaluation.md §Competitive Landscape](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L114-L130)

---

## Recommendation

**值得投入，但需精準定位使用場景。**

| 使用者 | 建議 | 預期效率提升 |
|---|---|---|
| 個人 + 多 IDE | 用 `/teamwork-lite` 做日常工作，複雜功能才啟用 `/teamwork` | 每日省 10-30 分鐘「重交代進度」時間 |
| 2–3 人小團隊 | 部署 HTTP + SQLite，共享 constitution 和 handoff state | 統一 AI 行為規範，減少「互相覆蓋」事故 |
| >5 人團隊 | 不建議作為主要工具，可作為輔助的 AI 規則注入層 | 有限 |
| 面試/作品集 | 極高展示價值（state machine、concurrency、cooperative guardrail） | N/A |

**下一步優先事項**（若繼續投入）：
1. **P0**: `agc init` CLI — 降低 6-step onboarding 到 1 command
2. **P1**: npm 發布 — 正規分發取代 `dist/` 提交
3. **P2**: 簡易 Web dashboard — 讓 handoff state 可視覺化

---

## Alternatives Considered

- **只用 CLAUDE.md + .cursorrules**：rejected。失去狀態持久化和 drift 偵測。但若只用單一 IDE，這已足夠。
- **換成 LangGraph/CrewAI**：rejected。它們不是 MCP 原生，不支援跨 IDE，且需付費或自建 infra。但若需要 production-grade multi-agent orchestration，它們更成熟。
- **Git commit `.current/` 手動同步**：rejected。需人工操作，無即時併發保護。但零成本是優勢。

---

## Open Questions

1. **Lite mode 是否應成為預設？** 目前 `/teamwork` 是預設入口，但先前研究和 v3.6.0 設計都指向 solo dev 場景佔多數。預設切到 lite 可降低新用戶認知負擔。
2. **npm 發布 timeline？** `dist/` 提交模式持續造成 diff 膨脹（[honest-evaluation.md §8](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L98-L104)）。
3. **A2A 協議的威脅**：Google 的 Agent-to-Agent 協議若普及，MCP 生態定位可能被重新洗牌。需持續觀察。
