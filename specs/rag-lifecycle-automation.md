# Spec — RAG Lifecycle Automation

> @pm · 2026-05-19
> Source: `research/rag-lifecycle-automation.md`

## Problem Statement

The current RAG pipeline has two architectural gaps that break the "automated workflow" promise:
(1) `tw_index_prd` is an isolated tool — nothing automatically triggers it, so reindexing relies on the human or agent remembering to run it after the PRD changes; and
(2) `prd_chunks` rows are never garbage-collected after a feature completes or a workspace is deleted, leaking SQLite storage unboundedly across the server's lifetime.
The fix must keep the pipeline zero-config and avoid background workers, fs.watch, or schema migrations beyond a single additive column.

## User Stories

- As a **PM**, I want to optionally register the PRD path in handoff state, so that downstream roles auto-receive scoped spec context without me running an extra tool.
- As a **PM with zero config**, I want the server to auto-discover `PRD.md`/`docs/PRD.md`/`specs/PRD.md` in the workspace, so that even if I forget to register the path, RAG still works.
- As an **sr-engineer/qa-engineer**, I want the first prompt activation after the PRD changes to transparently reindex, so I never read stale spec context.
- As an **ops operator**, I want chunks for completed features to be auto-cleared on PASS, so that SQLite doesn't grow unboundedly across feature cycles.
- As an **ops operator**, I want the server to drop chunks for workspaces whose directories no longer exist, so that abandoned workspaces self-clean.
- As a **server maintainer**, I want a `tw_clear_prd_chunks` escape hatch, so that I can manually purge chunks when needed.

## Acceptance Criteria

### Auto-Trigger

- **AC1** *(prd_path stored in state)*
  Given `tw_update_state` is called with `prd_path="/abs/path/to/PRD.md"`,
  When the value is read back via `tw_get_state` or `storage.parse`,
  Then `state.prd_path` returns `"/abs/path/to/PRD.md"`.
  Field MUST be optional/nullable; existing callers continue to work without setting it.

- **AC2** *(auto-discover fallback)*
  Given `state.prd_path` is absent (or null),
  When `appendSpecContext` resolves a PRD path,
  Then it tries in order: `${workspace}/PRD.md` → `${workspace}/docs/PRD.md` → `${workspace}/specs/PRD.md`, returning the first one that exists,
  And if none exist, returns null and `appendSpecContext` degrades to no-op (prompt unchanged).

- **AC3** *(lazy reindex on stale invalidation key)*
  Given `prd_chunks` exists for the workspace with `prd_mtime=X`,
  When `appendSpecContext` is called and the current `fs.statSync(prdPath).mtimeMs ≠ X` (or `chunker_version` / `embedding_model` differs),
  Then `buildPrdChunks` + `upsertPrdChunks` are invoked inline before `queryPrdSpec`,
  And subsequent calls within the same mtime window do NOT reindex.

- **AC4** *(lazy reindex on missing index)*
  Given a valid resolved `prdPath` and `getPrdIndexMeta(workspace) === null`,
  When `appendSpecContext` is called,
  Then reindex runs, chunks are stored, and the spec block is injected into the prompt.

- **AC5** *(reindex coalescing under lazy path)*
  Given two concurrent role-prompt requests for the same workspace with a stale index,
  When both reach `appendSpecContext`,
  Then only one `buildPrdChunks` invocation runs (reuse `_indexingInFlight` keyed by `${workspace}::${prd_path}`),
  And both requests receive the same fresh chunks.

- **AC6** *(graceful no-op on reindex failure)*
  Given lazy reindex throws (e.g. `@xenova/transformers` absent, file unreadable),
  When `appendSpecContext` catches the error,
  Then the prompt is returned unchanged (no crash, no partial injection).

- **AC7** *(coordinator still skipped)*
  Given `role === "teamwork"`,
  When `appendSpecContext` runs,
  Then no reindex AND no query happen (existing `RAG_SKIP_ROLES` behaviour preserved).

### GC

- **AC8** *(PASS cleanup)*
  Given `tw_update_state(agent_id="qa-engineer", status="PASS", workspace_path=W)` succeeds the transition matrix,
  When the handler commits,
  Then `prd_chunks` rows with `workspace_path = W` are DELETEd in the same logical operation,
  And `getPrdIndexMeta(W)` returns null afterward.

- **AC9** *(PASS cleanup awaits in-flight reindex)*
  Given a lazy reindex for workspace W is in flight (`_indexingInFlight.has(key)`),
  When `tw_update_state(status=PASS, workspace_path=W)` fires,
  Then the handler awaits the in-flight promise before DELETE, preventing INSERT-after-DELETE races.

- **AC10** *(tombstone sweep)*
  Given a `prd_chunks` row whose `workspace_path` directory no longer exists on disk,
  When the tombstone sweep runs (lazy: first RAG operation in the SQLite session),
  Then rows for non-existent workspaces are DELETEd,
  And the sweep runs at most once per process lifetime.

- **AC11** *(manual clear tool)*
  Given `tw_clear_prd_chunks(workspace_path=W)` is invoked,
  When the storage is RAG-capable,
  Then all chunks for W are DELETEd and the tool returns a count,
  And on non-RAG storage (file mode) the tool returns a "not supported" message without crashing.

### Cross-cutting

- **AC12** *(schema migration is additive)*
  Given an existing SQLite database without the `prd_path` column,
  When the server starts,
  Then `ALTER TABLE handoff_state ADD COLUMN prd_path TEXT` is applied idempotently (catching "duplicate column" same as `qa_round` migration at `storage-sqlite.ts:142-147`),
  And existing data is preserved.

- **AC13** *(no-op when storage lacks RAG capability)*
  Given file-mode `FileHandoffStorage` is active,
  When `appendSpecContext` runs,
  Then it returns unchanged (no auto-discover, no reindex attempt) — existing `isRagCapable` guard preserved.

## Out of Scope

- TTL based on `last_accessed_at` (no schema column, no cron) — deferred to v2.
- Feature-scoped chunks (`active_feature` in PK) — deferred to v2.
- Background indexer worker / `fs.watch` watchers — explicitly rejected by research.
- Multi-PRD per workspace — current model is one PRD per workspace.
- Config flag `keepChunksOnPass` — deferred; PASS always cleans for v1.
- `.current/.config.json` `prdPath` override — deferred until a user hits non-standard naming; auto-discover order is hardcoded.
- Hybrid BM25 retrieval — already deferred to v1.5 backlog.

## Dependencies / Prerequisites

- `rag-pipeline` feature MUST be PASSed (current state: PASS, `qa_reports/review_rag-pipeline.md`).
- `@xenova/transformers` optional dep still optional; AC6 ensures graceful no-op when absent.
- SQLite WAL mode (already enabled `storage-sqlite.ts:136`) — required for concurrent reader (`queryPrdSpec`) + writer (lazy reindex) coexistence.
- Existing `_indexingInFlight` coalesce map (`index.ts:137`) reused — no new global state.

— @pm
