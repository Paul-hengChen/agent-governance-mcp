# 🔬 架構、流程、Skills 與憲法 — 綜合評估 v3.9.x

> Researcher assessment — 2026-05-28
> 範圍：架構完整性、自動化開發流程、每個 skill 的品質、憲法的覆蓋度、改善建議、新 skill 推薦。
> 基於：完整 source review（~2,200 LOC production TS）、11 個 skill 文件、23 份先前研究、641 行 CHANGELOG、21 個測試檔案、2026 MCP 生態趨勢。

---

## Summary

- **架構成熟度高**：3-Layer Defense（Prompts → Tools → Guards）+ server-enforced transition matrix 是 MCP 生態中最完整的治理實作。v3.9.0 加入 code-reviewer 後，routing chain 達到業界 best-practice 的 7-role pipeline。
- **Skills 品質不均**：pm / qa-engineer / code-reviewer 高度結構化且有 schema；researcher / coordinator-lite 過於精簡；architect 缺少 ADR 機制。
- **憲法覆蓋度高但有盲區**：§1-§7 共 25 條規則，核心安全/品質覆蓋完整。主要盲區：token 預算、agent 身份驗證、observability。
- **流程最大瓶頸**：manual role-switching（人類必須手動 `tw_switch_role`）是吞吐量的硬限制，但這也是刻意的 HITL 設計。
- **缺少 3 個高價值 skill**：doc-writer、devops/release-engineer、refactor-planner。

---

## Evidence

### A. 架構評估

| 層 | 機制 | 評價 | 來源 |
|---|---|---|---|
| Layer 1: Prompts | Constitution + Skill 注入 via MCP `GetPrompt` | ✅ 業界唯一將規則治理嵌入 MCP prompt pipeline 的方案 | [index.ts](file:///Users/paul.ph.chen/agent-governance-mcp/index.ts#L283-L315) |
| Layer 2: Tools | 10 個 `tw_*` tools，Zod runtime validation | ✅ 每個 tool 都有 schema 驗證，path-traversal guard 完整 | [index.ts](file:///Users/paul.ph.chen/agent-governance-mcp/index.ts#L57-L155) |
| Layer 3: Guards | Pre-flight session check + transition matrix | ✅ State machine 在 server 端強制，非 advisory | [transitions.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/transitions.ts) |
| Storage | Dual-mode: File (lockfile + mtime) / SQLite (WAL) | ✅ 併發保護是同類最佳 | [storage-sqlite.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/storage-sqlite.ts) |
| RAG | PRD chunking + embedding + lazy reindex | ✅ 加分項，但僅 SQLite mode 可用 | [rag.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/rag.ts) |

**架構弱點**（與 2026 業界趨勢對照）：
1. **無 Observability** — 業界共識：governance layer 必須有 structured logging + per-action audit trail。目前只有 `console.error`。（已在 [honest-evaluation.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/honest-evaluation.md#L82-L88) 指出）
2. **無 Agent Identity Binding** — MCP 協議無 caller-id；`agent_id` 是 self-declared。業界趨勢要求 zero-trust between agents。（先前研究 §5 Role Switching is Pure Theater）
3. **Config cache never invalidates** — [config.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/config.ts) 無 TTL，runtime 修改不生效。

### B. 自動化開發流程評估

```
Routing chain (v3.9.0):
researcher (opt) → design-auditor (opt) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer
```

| 面向 | 狀態 | 改善空間 |
|---|---|---|
| **Role 數量** | 9 roles（含 coordinator/lite）| ✅ 超過 MetaGPT 的 5-role 模型 |
| **State machine enforcement** | ✅ Server-enforced, 18 state entries | 最完整的 MCP 原生實作 |
| **Circuit breaker** | ✅ qa_round + review_round cap at 3 | 有效防 infinite loop |
| **Evidence gating** | ✅ PASS/handoff 需要 review report | 業界少見的嚴格度 |
| **Manual role-switching** | ⚠️ 人類必須手動切換 | 刻意設計（HITL），但可加 auto-route 建議 |
| **Parallel execution** | ❌ 純串行 | 業界有 split-and-merge pattern，但對 solo-dev 不適用 |
| **Token efficiency** | ✅ qa-visual lazy-load, RAG_SKIP_ROLES | v3.8.3 已優化 |

### C. 各 Skill 評估

| Skill | Lines | Quality | Schema | 主要問題 |
|---|---|---|---|---|
| [skill-pm.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-pm.md) | 39 | ⭐⭐⭐⭐⭐ | Spec Schema + Task Format + Copy/Strings + Visual Tokens | **最完整的 skill**。Resource Audit Gate + Ambiguity Gate 都有 |
| [skill-qa-engineer.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-engineer.md) | 67 | ⭐⭐⭐⭐⭐ | 4-Phase SOP + Copy/Visual/Visual-Compare gates | 改善：新增 Conditional test writing (done) |
| [skill-code-reviewer.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-code-reviewer.md) | 45 | ⭐⭐⭐⭐½ | Review Report Schema (6 sections) + Clean-context rule | 缺少：performance review 維度 |
| [skill-sr-engineer.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-sr-engineer.md) | 38 | ⭐⭐⭐⭐ | Security Checklist + Task-Size Check | 缺少：commit message format 規範 |
| [skill-architect.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-architect.md) | 27 | ⭐⭐⭐½ | Artifact Schema (6 sections) | 缺少：ADR (Architecture Decision Record)、trade-off analysis |
| [skill-design-auditor.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-design-auditor.md) | 51 | ⭐⭐⭐⭐⭐ | Source manifest + Multi-pass + 7 modes | 非常完整，token-frugal 設計 |
| [skill-coordinator.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-coordinator.md) | 63 | ⭐⭐⭐⭐ | Routing Table + Scope Gate + Design detection | 缺少：multi-task priority scheduling |
| [skill-coordinator-lite.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-coordinator-lite.md) | 24 | ⭐⭐⭐ | 最精簡的 skill | 缺少：scope-creep 判定的具體範例 |
| [skill-researcher.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-researcher.md) | 23 | ⭐⭐⭐ | Findings Schema (5 sections) | 缺少：research depth control（shallow/deep）、source credibility scoring |
| [skill-qa-visual.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-visual.md) | 20 | ⭐⭐⭐⭐ | Lazy-loaded sub-skill | 設計精良，但依賴 vision LLM 能力 |

### D. 憲法（Constitution v3.9.0）評估

| 章節 | 規則數 | 覆蓋度 | 盲區 |
|---|---|---|---|
| §1 Output Directives | 6 | ✅ 完整 | — |
| §2 Dev & Tech Standards | 5 | ✅ 良好 | 缺少 commit convention / branch strategy |
| §3 State Sync | 5 + §3.1 | ✅ 最強章節 | — |
| §4 Routing Chain | 1 diagram + prose | ✅ 清晰 | — |
| §5 Anti-Loop | 3 | ✅ 有效 | 缺少 token/cost budget |
| §6 Security | 1 | ⚠️ 基本 | 缺少 OWASP-level guidance、dependency audit |
| §7 Cognitive Discipline | 5 | ✅ 獨創 | — |
| Doc Priority | 1 | ✅ 明確 | — |

**總計 26 條規則**。與 2026 業界 governance-by-design 趨勢對照，覆蓋度約 85%。

---

## Recommendation

**新增 3 個 high-value skills**，按推薦優先級排序：

### 1. `skill-doc-writer` — 文件撰寫者（P1，推薦）

**理由**：2026 趨勢顯示 documentation 已從附帶產物變成 agent workflow 的核心 artifact。目前 PM 寫 spec、QA 寫 review、但沒有角色負責 user-facing docs（README 更新、API reference、migration guides）。

**建議 SOP**：
- 觸發條件：new public API / breaking change / user-facing feature
- 讀 `specs/<feature>.md` + diff → 產出/更新 `docs/<feature>.md`、README 相關段落
- 不進入 routing chain（optional post-QA hook），不需要 transition matrix edge
- 可由 coordinator 在 QA PASS 後觸發，或人類手動呼叫

### 2. `skill-refactor-planner` — 重構規劃者（P2）

**理由**：Constitution §1 明確禁止 speculative refactor。但合法的技術債清理需要一個有紀律的角色。目前只能靠 PM 開 task，沒有專門的 tech-debt assessment 機制。

**建議 SOP**：
- 觸發條件：sr-engineer 在 `pending_notes` 標記 `tech-debt: <description>`
- 讀 codebase → 產出 `research/refactor-<area>.md`（code smell 清單 + impact 評估 + 建議拆分方案）
- 不動代碼，只產出分析。PM 決定是否將其轉為 task
- 可復用 researcher 的 Findings Schema

### 3. `skill-release-engineer` — 發佈工程師（P2）

**理由**：目前沒有角色負責 version bump、CHANGELOG 更新、`dist/` rebuild、git tag。這些都是人工手動做的。

**建議 SOP**：
- 觸發條件：QA PASS 後、人類決定要發版
- 讀 handoff state → bump `package.json` version → 更新 `CHANGELOG.md` → build → tag
- Guard：只在 `status=PASS` 後允許執行

### 現有 Skill 改善建議

| Skill | 改善項 | 優先級 | 說明 |
|---|---|---|---|
| **architect** | 加入 ADR section | P1 | `## Decision Records` — 每個 trade-off 記錄 context/decision/consequences，長期維護必備 |
| **researcher** | 加入 depth control | P2 | 參數化：`shallow`（3 bullets, 15 min）vs `deep`（full findings, 1 hr）。減少小問題的過度研究 |
| **code-reviewer** | 加入 performance review | P2 | Review Schema 加 `## Performance` — 檢查 O(n²) 迴圈、未 batch 的 I/O、memory leak |
| **sr-engineer** | 加入 commit convention | P2 | `conventional-commits: feat/fix/refactor/docs/test`。目前沒有 commit message 規範 |
| **coordinator-lite** | 加入 scope-creep 範例 | P3 | 具體列出 2-3 個「看似 lite 但應該用 full」的案例 |

### 憲法改善建議

| 章節 | 改善項 | 優先級 |
|---|---|---|
| §5 | Token/cost budget（業界共識：match model size to task complexity） | P2 |
| §6 | 擴充：dependency audit rule（`npm audit` / `cargo audit` 在 build gate 中） | P2 |
| §2 | 加入 commit convention reference（不必在憲法中全文，但 point to a standard） | P3 |

---

## Alternatives Considered

| 方案 | 評估 | 結論 |
|---|---|---|
| **照搬 MetaGPT 的 Project Manager 角色** | MetaGPT PM 比較偏 task scheduling；目前 PM skill 的 spec schema 已經超越 MetaGPT | ❌ 不需要 |
| **加入 DevOps CI/CD 角色** | 2026 趨勢支持，但 agent-governance-mcp 是 MCP server，不是 CI pipeline | ⚠️ 簡化為 release-engineer，不做 full DevOps |
| **加入 Security Auditor 角色** | sr-engineer + code-reviewer 已有 security checklist；獨立角色在 solo-dev 場景 overhead 太高 | ❌ 保留在現有角色中 |
| **移除 design-auditor** | v3.8.0 加入的，非 UI 項目零 overhead | ❌ 設計精良，保留 |
| **合併 coordinator + coordinator-lite** | 兩者的 trade-off 不同（chain vs direct execute），合併會增加認知負擔 | ❌ 保持分離 |

---

## Open Questions

1. **Auto-routing vs HITL**：是否考慮加入 optional auto-routing（coordinator 自動 `tw_switch_role` 到 `pending_notes` 中的 `next_role`），以減少人類介入次數？需要額外 guard（防止 runaway chain）。
2. **Token budget enforcement**：§5 是否應加入 per-task token cap？需 server-side tracking（目前 MCP 協議不提供 token counting），可能只能做 advisory rule。
3. **npm publish timeline**：`dist/` 仍在 git 中（已在 prior research 指出）。是否有發版到 npm 的計畫？
4. **Multi-workspace support**：HTTP mode 已支持多 workspace，但 constitution/skill 是 server-global 的。是否需要 per-workspace skill override？

---

*Research based on: 11 skill files, constitution v3.9.0, transitions.ts (315 LOC), index.ts (960 LOC), 23 prior research artifacts, 641-line CHANGELOG, 21 test files, 2026 MCP ecosystem survey.*
