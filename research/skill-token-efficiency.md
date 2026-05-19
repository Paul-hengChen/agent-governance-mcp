# Research: Skill Token Efficiency Analysis

> @researcher · 2026-05-19

## Summary

- **coordinator** (1,174 bytes), **researcher** (1,144 bytes), **architect** (1,705 bytes) 都極度精簡，充分體現節省 token 精神。
- **pm** (1,881 bytes) 和 **sr-engineer** (1,876 bytes) 屬於中等，結構清晰無冗餘，合格。
- **qa-engineer** (3,765 bytes) 是最大的 skill，比第二大的 sr-engineer 多出 **2× token**。但其複雜度有合理理由。
- **constitution** (4,683 bytes) 作為所有角色共享的基底，是最大的 token 消費者。§3.1 Server-enforced chain 佔 ~1,200 bytes，有壓縮空間。

## Evidence

### Token 成本量化（每次 prompt 注入）

每次啟動角色 prompt，`buildPromptForRole()` 組裝的內容為：

```
constitution.md (4,683 B) + skill-<role>.md (N B) + state JSON (~200-800 B)
```

| 角色 | skill 大小 | 總注入估計 (bytes) | 佔比 (skill/total) |
|---|---|---|---|
| coordinator | 1,174 | ~6,057 | 19% |
| researcher | 1,144 | ~6,027 | 19% |
| architect | 1,705 | ~6,588 | 26% |
| pm | 1,881 | ~6,764 | 28% |
| sr-engineer | 1,876 | ~6,759 | 28% |
| **qa-engineer** | **3,765** | **~8,648** | **44%** |

來源: [content/](file:///Users/paul.ph.chen/agent-governance-mcp/content/) 檔案大小 + [prompts/build.ts](file:///Users/paul.ph.chen/agent-governance-mcp/prompts/build.ts#L236) 組裝邏輯。

### 各角色分析

#### ✅ 節省 token 的角色

**coordinator** (1,174 B) — 最精簡的 skill。只有 routing table + 5 步 SOP。無模板、無 schema。完美。

**researcher** (1,144 B) — 最小的 skill。Findings Schema 5 個 H2 section 用 bullet list 定義，SOP 只有 4 步。完美。

**architect** (1,705 B) — Artifact Schema + SOP + 兩個 gate。每一行都承載決策邏輯，無冗餘。

**pm** (1,881 B) — Spec Schema + Task Format + SOP。Task format 用 code block 示範格式是必要的（沒有範例 agent 會猜錯）。

**sr-engineer** (1,876 B) — SOP 8 步 + QA Round Reply 3 步。Security Checklist 3 bullet 是壓縮後的 OWASP 精華。合格。

#### ⚠️ 需要討論的角色

**qa-engineer** (3,765 B) — **是唯一超過 2,000 bytes 的 skill**。

原因分析：
1. **Phase 0-4 流程**（~2,000 B）：QA 的工作本質上就是最複雜的——它有 4 個 phase（claim → review → discussion → tests → run），每個 phase 有獨立的退出條件和 state transition。
2. **Discussion round protocol**（~800 B）：3-round time-boxed discussion 是 QA 的核心價值，不能刪。
3. **Spec-to-Test mapping + Coverage gate**（~500 B）：直接影響測試品質。
4. **Security Smoke Tests**（~200 B）：4 行 bullet。

### 是否需要壓縮 qa-engineer？

**結論：不需要。** 理由：

1. **qa-engineer 是 pipeline 的終端角色**。它的 prompt 只在 QA 階段注入，不像 constitution 每次都載入。一個 feature cycle 裡 QA 可能只跑 1-3 次。
2. **QA 的複雜度是必要的**。它需要同時處理：多 phase 流程、round-based discussion、PASS/FAIL state transition、evidence recording、coverage gate。任何一條刪掉都會導致 QA 品質下降。
3. **3,765 B ≈ ~940 tokens**（按 4 chars/token 估計）。在 200K context window 下是 **0.47%**。成本可忽略。
4. **constitution §3.1 已經把很多 transition 邏輯下沉到 server-side enforcement**。如果沒有 server enforcement，qa-engineer skill 會更大。

### constitution.md 壓縮空間

**§3.1 Server-enforced chain** (~1,200 B) 是一個潛在壓縮目標：
- 這段描述了 server 內部的 implementation detail（transition matrix、round counter、evidence gate）。
- Agent 不需要知道 server 內部怎麼實作，只需要知道「如果違規會被 reject，看 error envelope 自行修正」。
- **可壓縮為 ~300 B**，把 implementation detail 留在 `specs/qa-flow-enforcement-architecture.md`（已存在）。

壓縮後預估：constitution 從 4,683 → ~3,783 B，每次 prompt 注入省 ~900 B (~225 tokens)。

## Recommendation

**不建議修改任何 skill 檔案。** 所有 skill 都已高度壓縮。

**建議壓縮 constitution.md §3.1**：將 server implementation detail 移到 spec reference，只保留 agent 需要知道的行為契約。預估每次 prompt 注入省 ~225 tokens。

優先順序：
1. (Low priority) 壓縮 constitution §3.1 — 省 ~225 tokens/prompt
2. (Not recommended) 壓縮 qa-engineer — 風險 > 收益

## Alternatives Considered

- **拆分 qa-engineer 為兩個 sub-role**（reviewer + test-writer）：rejected。增加 routing 複雜度 + 多一次 state transition 消耗的 token 遠大於 skill 文本本身。
- **動態載入 skill section**（只載入當前 phase 的指令）：rejected。增加 server 複雜度，且 LLM 需要完整 SOP 才能正確判斷自己處於哪個 phase。
- **從 constitution 中完全移除 §3.1**：rejected。Agent 需要知道 transition 被 enforce 的事實，才能在收到 rejection 時 self-correct。

## Open Questions

1. 壓縮 constitution §3.1 後是否需要跑 regression test 確認 agent 行為不變？
2. 是否應該在 tool description 中加入更精簡的 transition hint，取代 constitution 中的詳細描述？

— @researcher
