# RAG Lifecycle Automation — Auto-Trigger + GC

> @researcher · 2026-05-19
> 兩個架構缺口的研究: (1) `tw_index_prd` 需手動觸發; (2) `prd_chunks` 無 GC,跨 feature/廢棄 workspace 會無限堆積。

## Summary

- **Auto-Trigger 推薦**: **Lazy reindex in `appendSpecContext`** (Option A) + **auto-discover `prd_path`** fallback (Option E)。任何非 coordinator 角色被啟動時,server 比對 invalidation key,若 stale/missing 則 inline reindex。PM 可選擇性把 `prd_path` 存進 state,否則 server 自動探測 `PRD.md` / `docs/PRD.md` / `specs/PRD.md`。
- **GC 推薦**: **Cleanup on `status=PASS`** (Option α) + **workspace tombstone scan on startup** (Option γ)。Feature 結束即清,server 啟動掃過所有 `workspace_path`,目錄不存在就 DELETE。
- **Schema 改動最小**: `handoff_state` 加 `prd_path TEXT NULL`,`prd_chunks` 不動。
- **既有保護不必動**: invalidation key 三 tuple、`_indexingInFlight` coalesce map、path-traversal guard 全部沿用。
- **MVP 邊界**: 不做 TTL、不做 background watcher、不做 multi-PRD per workspace。

## Evidence

### 現況 (兩個缺口)

- `tw_index_prd` 是孤立 dispatcher case,沒有任何地方自動呼叫它 (`index.ts:617-665`)。
- `appendSpecContext` 只查不寫 — `queryPrdSpec` 走 cosine,從不檢查 freshness、也不會觸發 reindex (`prompts/build.ts:54-95`)。
- `upsertPrdChunks` 雖然 DELETE-all-by-workspace 後 INSERT (`storage-sqlite.ts:482-503`,確保單 feature 不累積),但**從未被 PASS 路徑、workspace 刪除事件、或 TTL 呼叫**。
- `prd_chunks` schema 以 `(workspace_path, chunk_id)` 為 PK,沒有 `active_feature`、`last_accessed_at` 欄位 (`storage-sqlite.ts:85-96`)。
- `HandoffState` 也沒有 `prd_path` 欄位 (`tools/handoff.ts` interface),所以 `appendSpecContext` 即使想 reindex 也不知道 PRD 在哪。

### Auto-Trigger 選項評估

| Option | 觸發點 | Pros | Cons |
|--------|--------|------|------|
| **A. Lazy in `appendSpecContext`** | 任何非 coordinator 角色 prompt 被 GET 時 | 純加法、只在需要時跑、復用既有 `_indexingInFlight` coalesce | 首次冷啟 3.8s 落在角色啟動 (researcher 報告 `rag-pipeline-analysis.md` § Open Question 1 已接受) |
| B. Hook in `tw_update_state` | server 端 state write 時觸發背景索引 | 角色啟動時 index 已就緒 | 需 background worker,server 啟動/重啟時遺失任務,複雜度高 |
| C. PM SOP step | PM skill 加一條「end with `tw_index_prd`」 | 零 code 改動 | 還是「手動」,只是搬到 PM 流程內;PM 跳過就破功 |
| D. `fs.watch` on PRD | server 端 per-workspace watcher | 即時 | 重啟遺失、目錄刪除/rename 邊角 case 多、watcher 表會膨脹 |
| **E. Auto-discover `prd_path`** | `appendSpecContext` 找不到 state.prd_path 時 fallback | PM 不用做事;與 A 組合可零手動 | 用啟發式 (`PRD.md` → `docs/PRD.md` → `specs/PRD.md`),可能挑錯檔 |

採用 **A + E 組合**: A 是主路徑,E 是 PM 沒設定時的 zero-config fallback。

### GC 選項評估

| Option | 觸發點 | 清誰 | Pros | Cons |
|--------|--------|------|------|------|
| **α. Cleanup on `status=PASS`** | `tw_update_state(status=PASS)` server handler | 該 workspace 全部 chunks | feature-lifecycle 對齊、無新 schema | 下個 feature 重來,首次冷啟 3.8s |
| β. TTL on `last_accessed_at` | server 啟動 cron / 每 N 次 query 後 | `now - last_accessed > N天` | 抓「廢棄 workspace」這條長尾 | 需 schema 加 column + 每次 query 寫一次、N 難調 |
| **γ. Workspace tombstone scan** | server 啟動時一次 | `fs.existsSync(workspace_path) === false` | 簡單、無 schema 改動、抓刪除的 workspace | 只抓「目錄已刪」,不抓「目錄還在但 feature 結束」 |
| δ. Feature-scoped chunks | `state.active_feature` 變動時 | 舊 feature 全部 chunks | 支援 feature 歷史回顧 | 需 schema 加 `active_feature` column 並改 PK |
| ε. Manual `tw_clear_prd_chunks` | user 主動 | 指定 workspace | 顯式、可控 | 仍是手動 |

採用 **α + γ 組合**:
- α 覆蓋 happy-path (feature 完成)。
- γ 覆蓋 worst-case (workspace 被刪除/搬家)。
- β/δ 需要 schema 改動 + cron,**MVP 不必**。
- ε 可以**順手**加 (兩行的事),作為 ops 緊急按鈕,但不是主路徑。

### 風險與緩解

- **Auto-discover 挑錯檔 (Option E)**: 若 PM 命名為 `requirements.md` 而非 `PRD.md`,fallback 失敗 → `appendSpecContext` 走目前的 graceful no-op (回傳原 prompt),不會崩。PM 設 `state.prd_path` 即可覆蓋。
- **PASS 後立刻又改 PRD 重啟同 feature**: α 清掉後,下次角色啟動會被 A 自動 reindex,正確但多付一次冷啟。可接受。
- **並發 PASS 與 query**: 既有 `_indexingInFlight` map (`index.ts:137`) 保護 reindex 之間的並發;PASS 的 DELETE 與 query 的 SELECT 走 SQLite WAL,讀寫不互鎖。
- **Server 啟動 tombstone scan 慢**: 用一次 `SELECT DISTINCT workspace_path FROM prd_chunks` + N 個 `fs.existsSync`,N 量級小 (一般 <50 workspaces),啟動 <100ms 預估。

## Recommendation

**實作順序 (build order)**:

1. **Schema**: `handoff_state` 加 `prd_path TEXT NULL` (additive,migration 用 `ALTER TABLE ADD COLUMN` 套既有模式 `storage-sqlite.ts:142-147`)。
2. **PM SOP**: 加一句「若有 PRD 檔,把絕對路徑寫入 `tw_update_state(prd_path=...)`」 (可選,PM 不寫也行)。
3. **Auto-discover**: 在 `appendSpecContext` 開頭加 helper `resolvePrdPath(workspace, state)`:
   - 優先用 `state.prd_path`
   - fallback 順序: `PRD.md` → `docs/PRD.md` → `specs/PRD.md`
   - 都找不到回 `null` → 走 graceful no-op
4. **Lazy reindex**: `appendSpecContext` 拿到 prdPath 後,比對 `getPrdIndexMeta(ws)` 與當前 `fs.statSync(prdPath).mtimeMs + CHUNKER_VERSION + DEFAULT_EMBEDDING_MODEL`:
   - 不一致 → 透過既有的 `_indexingInFlight` coalesce key 呼叫 `buildPrdChunks` + `upsertPrdChunks`
   - 一致 → 直接走 `queryPrdSpec`
   - reindex 失敗 → catch、log、走 graceful no-op
5. **GC (α)**: 在 `tw_update_state` handler 內,當 `status === "PASS"` 且 `agent_id === "qa-engineer"` 成立後 (matrix 已通過),`storage.deletePrdChunks(workspace_path)`。
6. **GC (γ)**: `SqliteHandoffStorage` constructor 末段 (或 lazy on first RAG call) 跑一次 `SELECT DISTINCT workspace_path FROM prd_chunks WHERE workspace_path NOT IN (...)` → 對不存在的目錄 DELETE。
7. **新增 storage method**: `deletePrdChunks(workspacePath): void` 供 α 用;tombstone 內部實作即可,不必對外暴露。
8. **Optional ops tool**: `tw_clear_prd_chunks(workspace_path)` (~10 行,用 ε 當緊急開關)。

**Rationale**: A + E 把「下一次有人用」變成自動 reindex 觸發點 — 這是 RAG 系統最自然的 lazy 模型 (與 HTTP cache revalidation 同形)。α + γ 對齊 feature 生命週期 + workspace 物理存在,兩個 invariant 都是 server 本來就知道的。**不引入 background worker、不引入 cron、不引入 schema 大改**;改動量估 <120 行,測試 +6 tests (lazy trigger × 2、PASS cleanup × 1、tombstone × 1、auto-discover × 2)。

## Alternatives Considered

- **Background indexer worker (Option B)**: 否決。MCP server 是 stdio long-lived 但無 supervisor,worker crash 後沒人重啟;增加 process lifecycle 複雜度,RAG 不值得。
- **TTL with `last_accessed_at` (Option β)**: 否決於 MVP。需要 schema 加 column、每次 query 寫一次 timestamp (放大寫入)。等實際遇到「workspace 還在但 feature 多月沒動」再加。
- **Feature-scoped chunks (Option δ)**: 否決於 MVP。PK 改動 + 所有 RAG SQL 要加 `active_feature` 過濾,改動成本高;且當前 PRD 假設是「一個 workspace 一份 PRD」,feature 切換時整份 reindex 也只 3.8s,沒有非分不可。
- **fs.watch (Option D)**: 否決。watcher 表膨脹、跨 platform 行為差異 (macOS FSEvents vs Linux inotify)、deletion edge cases 多。Lazy revalidation 比 push-based 健壯。
- **PM SOP-only (Option C)**: 否決。「自動」這個需求的本質是「不要靠人記得」,把責任搬到 PM 還是手動。

## Open Questions

1. **Auto-discover 順序要 hardcode 嗎?** 目前建議 `PRD.md` → `docs/PRD.md` → `specs/PRD.md`。要不要支援 `.current/.config.json` 加一個 `prdPath` 欄位 (跟既有 `taskPattern`/`taskPaths` 同形,`tools/config.ts`)? 推薦支援,但延到實際遇到非標命名再做。
2. **PASS cleanup 要不要 opt-out?** 有些 team 可能想保留 chunks 讓下個 feature 沿用 (例如同一份 PRD 拆多 feature)。建議加個 config flag `keepChunksOnPass: false` 預設清,進階使用者可以關掉。延到 v2 再說。
3. **Tombstone scan 時機**: server 啟動還是 first RAG call lazy? 推薦 lazy,避免無 RAG 的 file-mode 用戶付這成本。
4. **`_indexingInFlight` 是 module-level Map**,目前 key 為 `${workspace_path}::${prd_path}`。Lazy reindex 重用這個 map 沒問題;但 PASS cleanup 若與正進行的 reindex 並發,需要先 await in-flight 再 DELETE。建議 PASS handler 內: `await _indexingInFlight.get(key)?` then DELETE,避免「剛 INSERT 又被 DELETE」競態。

---

要直接路由 `/pm` 開始拆 tasks 嗎?

— @researcher
