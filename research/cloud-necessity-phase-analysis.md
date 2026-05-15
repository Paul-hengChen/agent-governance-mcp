# Research: Cloud Necessity & Phase 5–7 Purpose Analysis

<!-- @researcher -->

## Verdict First

**Phase 5 (test suite + CI)**: 上雲前必要的品質關卡。5a 已完成；5b (GitHub Actions CI) backlog。  
**Phase 6 (cloud transport)**: 唯一解決「跨機器 / 跨人員」同步問題的方案。若只有單人單機使用，不需要。  
**Phase 7 (CI/CD hook)**: 對有 PR 工作流的團隊有價值；個人專案可跳過。

---

## Phase Roadmap 現況

| Phase | 內容 | 狀態 |
|---|---|---|
| 1–3.6 | 3-layer 架構、多角色、QA/Architect 角色 | ✅ Done |
| 4 | Schema versioning | Backlog |
| **5a** | Unit + integration test suite | ✅ Done |
| **5b** | GitHub Actions CI | Backlog |
| **6** | SSE / HTTP transport + DB + remote team sync | Planning |
| **7** | CI/CD hook — PR merge 自動更新 handoff | Planning |

---

## Phase 5：目的

- **5a（已完成）**：保護現有工具不因重構而靜默壞掉。覆蓋 session guard、file-lock、handoff YAML round-trip、task checkbox 操作。
- **5b（待辦）**：在 GitHub Actions 跑 `npm test`，讓每個 PR 被 CI 攔截。  
  - **價值**：任何 contributor 的 PR 會自動驗證。  
  - **必要性**：若只有單人維護且已有本地 `npm test` 習慣，可延後；若開源後有外部 PR 則必要。

---

## Phase 6：目的 — 上雲的核心理由

目前架構的根本限制：**File lock 是 local-fs only**。

| 場景 | 現況 | Phase 6 後 |
|---|---|---|
| 單機、單 IDE | ✅ 完全可用 | 無差異 |
| 單機、兩個 IDE 視窗 | ✅ file-lock 保護 | 無差異 |
| 兩台機器 / 兩個人 | ❌ lock 失效，需靠 Git commit 手動同步 | ✅ SSE/HTTP transport + DB 提供中央化 lock |
| Cursor / Gemini Code 等非本地 client | ⚠️ 需在同一台機器上跑 server | ✅ remote server 讓任何 client 連接 |

**Phase 6 的具體交付**：
1. `StdioServerTransport` → `SSEServerTransport` (或 Streamable HTTP)
2. 用 DB（SQLite 或 PostgreSQL）取代 local `handoff.md`，提供真正的 cross-machine atomic write
3. 部署為常駐 service（Docker / Fly.io / Railway 等）

**是否必要**：  
- 個人單機使用 → **不需要**，現況已足夠。  
- 有第二個人（或第二台機器）要共用同一個 handoff state → **必要**。

---

## Phase 7：目的

在 PR merge 時自動觸發 `tw_update_state`，將 handoff status 改為 `PASS` 並寫入 merge SHA。

**用途**：讓 handoff.md 與 Git history 同步，不需要 AI 手動呼叫 `tw_update_state`。  
**必要性**：若工作流已有 QA 角色跑完後手動更新，Phase 7 只是自動化這個步驟。對個人工作流是 nice-to-have；對有 CI gate 的團隊則是自動審計鏈的最後一環。

---

## 結論與建議

| 問題 | 答案 |
|---|---|
| 還有上雲的必要嗎？ | **取決於使用場景**。單人單機：否。跨人或跨機：是（Phase 6 是唯一方案）。 |
| Phase 5 目的 | 品質護城河（CI/測試），讓開源貢獻和重構有安全網。 |
| Phase 6 目的 | 打破 local-fs 限制，實現真正的 remote/cross-machine 協作。 |
| Phase 7 目的 | CI/CD 自動化最後一哩路，handoff 隨 PR 自動更新。 |

**建議優先順序**（若要繼續投入）：  
1. **Phase 5b** — 最低成本，最高保障，先補 CI。  
2. **Phase 6** — 只有真的需要多人/多機時才做；單人不值得。  
3. **Phase 7** — Phase 6 完成後的自然延伸。
