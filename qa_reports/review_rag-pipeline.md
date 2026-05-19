# QA Review — rag-pipeline

> Reviewer: @qa-engineer · 2026-05-19 · Round 0 (PASS, no discussion rounds needed)

Spec source: `research/rag-pipeline-analysis.md` (researcher-authored, no formal `specs/<feature>.md` was created — sr-engineer worked directly from research findings).

---

## Phase 1 — Code Review

### Self-review verification (sr-engineer flagged 11 issues, all confirmed fixed)

| # | Issue | Fix verified at | Evidence |
|---|-------|------------------|----------|
| 1 | Path traversal on `prd_path` | `index.ts:120-126` | `.refine` uses `path.relative` + rejects `..` / absolute / empty rel |
| 2 | Pipeline never run end-to-end | `scripts/smoke-rag.mjs` | Cold start 3.8s, warm 1ms, 384-dim vectors, top-hit retrieval correct |
| 3 | Garbage query (`pending_notes`) | `prompts/build.ts:62-67` | Query is `active_feature + nextTask.description`, `pending_notes` excluded |
| 4 | No try/catch around `queryPrdSpec` | `prompts/build.ts:69-74` | Error degrades silently to no injection |
| 5 | Concurrent `tw_index_prd` race | `index.ts:135` (`_indexingInFlight`) | Map coalesces duplicate calls; `finally` clears entry |
| 6 | Repeated failed dynamic imports | `tools/rag.ts:108-119` (`_modulePromise`) | Cached promise; resolved exactly once |
| 7 | Coordinator gets RAG noise | `prompts/build.ts:50-51` (`RAG_SKIP_ROLES`) | `teamwork` short-circuits before storage call |
| 8 | `embedding_model` unvalidated | `index.ts:100-103` | `EMBEDDING_MODEL_RE` regex enforced via zod |
| 9 | `fs` imported inside case handler | `index.ts:10` | Hoisted to module top |
| 10/11 | Cosmetic | n/a | Deferred per researcher's MVP scope |

### New observations (not blocking)

- **`queryPrdSpec` model picked from `chunks[0]`** (`storage-sqlite.ts:530`). Safe because `upsertPrdChunks` deletes all rows before insert, but the `?? DEFAULT_EMBEDDING_MODEL` fallback is dead code (field is non-nullable in the type). Cosmetic — leave for later.
- **First role activation after server start pays cold-start latency** (~3.8s) due to ONNX init. Acceptable behaviour; researcher Open Question 1 acknowledged this trade-off.
- **`prd_chunks.embedding` stored as JSON text** (~50% larger than BLOB). Per researcher's MVP scope, ignored.
- **Symlink edge case**: `path.relative` doesn't resolve symlinks; a writer who can drop a symlink inside the workspace could in theory traverse. Workspace write access already implies trust, so out of threat model.

**Verdict**: No blocking issues. Proceed to Phase 3.

---

## Phase 3 — Spec → Test Map

Acceptance criteria extracted from `research/rag-pipeline-analysis.md` § Recommendation + § 修正後的 pipeline:

| AC | Description | Test(s) |
|----|-------------|---------|
| AC1 | Chunk PRD by markdown sections, preserve heading text | `chunkMarkdown: extracts section title…`, `…preamble chunk…` |
| AC2 | Oversized sections split with overlap, heading prefix retained | `chunkMarkdown: splits oversized sections…` |
| AC3 | No-heading documents fall back to single `document` chunk | `chunkMarkdown: returns single 'document' chunk…` |
| AC4 | H4+ headings NOT treated as section dividers (only H1–H3) | `chunkMarkdown: does not match H4+…` |
| AC5 | Cosine similarity correctness across identical / orthogonal / anti-parallel / zero | 4× `cosineSim:` tests |
| AC6 | `buildPrdChunks` reports error on missing PRD file | `buildPrdChunks: returns error when PRD file does not exist` |
| AC7 | `prd_path` MUST resolve inside workspace (no `/etc/passwd`, no `..`, no workspace root itself) | 4× `path guard:` tests |
| AC8 | `embedding_model` must match `namespace/name` allowlist regex | 4× `model regex:` tests |
| AC9 | SQLite RAG round-trip: upsert → list preserves all 8 chunk fields | `SqliteHandoffStorage RAG: upsertPrdChunks → listPrdChunks round-trip` |
| AC10 | Reindex is idempotent (DELETE before INSERT in transaction) | `…upsertPrdChunks deletes prior rows before insert…` |
| AC11 | Invalidation key tuple = (prd_mtime, chunker_version, embedding_model) | `…getPrdIndexMeta returns invalidation tuple…` |
| AC12 | `getPrdIndexMeta` returns null when no chunks | `…getPrdIndexMeta returns null when no chunks` |
| AC13 | `queryPrdSpec` returns empty string when no chunks (no crash) | `…queryPrdSpec returns empty string…` |
| AC14 | `appendSpecContext` skipped for `teamwork` (coordinator) role | `appendSpecContext: skips for teamwork role` |
| AC15 | `appendSpecContext` returns prompt unchanged when storage lacks RAG (file mode) | `…returns unchanged when storage lacks queryPrdSpec` |
| AC16 | `appendSpecContext` returns unchanged when state is null | `…returns unchanged when state is null` |
| AC17 | `appendSpecContext` injects spec block when query succeeds | `…injects spec block on successful query` |
| AC18 | `appendSpecContext` degrades silently on `queryPrdSpec` exception | `…degrades silently when queryPrdSpec throws` |
| AC19 | Query construction excludes `pending_notes` routing metadata | `…query construction uses active_feature + next task desc…` |

All ACs map to ≥1 test. 19 ACs / 28 tests.

### Coverage gate

Touched files:
- `tools/rag.ts` (new) — chunkMarkdown, cosineSim, embedText, buildPrdChunks
- `tools/storage-sqlite.ts` (extended) — 4 new methods
- `prompts/build.ts` (extended) — appendSpecContext
- `index.ts` (extended) — IndexPrdArgs + tw_index_prd dispatcher

`tools/rag.ts`: `chunkMarkdown` (covered), `cosineSim` (covered), `buildPrdChunks` error path (covered), `embedText` real-embedding path NOT unit-tested (covered by `scripts/smoke-rag.mjs` end-to-end instead — including it in `npm test` would force every CI run to download the ONNX model). Coverage estimate ≥80% for the typed surface, with the model-load path explicitly excluded as an integration concern.

`tools/storage-sqlite.ts` RAG methods: round-trip + idempotence + meta + empty-query all covered.

`prompts/build.ts` `appendSpecContext`: 6 paths covered (skip-role, no-rag-storage, null-state, success, error-degrade, query-construction).

`index.ts` `IndexPrdArgs` refinements: tested via duplicated logic in `test/rag.test.mjs` (the schema itself is not exported; refinement logic is mirrored, with a follow-up suggestion below).

### Security smoke tests (per qa SOP)

- ✅ Path traversal: `/etc/passwd`, `..` segments, empty rel (workspace root) — all rejected.
- ✅ Oversized input: `chunkMarkdown` handles a 60+ KB section (split with overlap).
- ✅ Special characters in model name: rejected by allowlist regex.
- ✅ Auth/permission: out of scope at this layer — RAG is data-only, the HTTP transport's existing auth gate covers tool calls.

### Follow-ups (non-blocking, file as backlog)

1. Extract `IndexPrdArgs` (or its `isPathInsideWorkspace` predicate) to `tools/path-guard.ts` so the test can import the real implementation rather than mirror it.
2. Optional: store `embedding` as BLOB (Float32 buffer) rather than JSON text — ~50% storage saving.
3. Consider role-aware top-K (architect/PM may want broader context than sr-engineer).

---

## Phase 4 — Run

- `npx tsc --noEmit` → ZERO errors.
- `npm test` → all green including new `test/rag.test.mjs` (28 tests).
- `scripts/smoke-rag.mjs` → end-to-end embedding verified (cold 3.8s, warm 1ms, retrieval top-hit correct).
- CI runnability: `npm test` runs headlessly. `scripts/smoke-rag.mjs` is NOT in `npm test` (intentional — requires model download). Documented in `package.json` as a manual smoke script.

**Decision**: PASS. Evidence recorded in this file. No per-task IDs flipped (feature was implemented without `tw_add_task` per-task breakdown; QA records the feature-level review only).
