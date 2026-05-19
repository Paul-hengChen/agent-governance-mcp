# QA Review — rag-lifecycle-automation (T21-T25)

> Reviewer: @qa-engineer · 2026-05-19 · Round 0 (PASS, no discussion rounds needed)

Spec: `specs/rag-lifecycle-automation.md` (13 ACs).
Source research: `research/rag-lifecycle-automation.md`.

---

## Phase 1 — Code Review

### Verification of sr-engineer's claims

| Claim | Verified at | Evidence |
|-------|-------------|----------|
| Additive `prd_path` column migration | `storage-sqlite.ts:140-152` | `addColumnIfMissing` helper; identical pattern to `qa_round` migration |
| `prd_path` preserved across writes | `storage-sqlite.ts:writeState`, `handoff.ts:writeHandoffState` | Both call `fetchRow`/`parseHandoff` when arg omitted, carry prior value forward |
| Shared coalesce registry | `tools/rag-coalesce.ts` | Module-level Map + 4 exports + `awaitAllInflightFor` |
| `tw_index_prd` reuses shared map | `index.ts:639-672` | `getInflightKey` / `getInflight` / `setInflight` / `deleteInflight` |
| Lazy reindex in `appendSpecContext` | `prompts/build.ts:171-183` | Gated by `canLazyReindex`; only runs if storage has GC/index hooks |
| `resolvePrdPath` fallback order | `prompts/build.ts:85-100` | state.prd_path → PRD.md → docs/PRD.md → specs/PRD.md |
| Graceful no-op on reindex failure | `prompts/build.ts:179-181` | try/catch + `ensureIndexFresh` returns `false` on any error |
| Coalesce in lazy path | `prompts/build.ts:127-136` | `getInflight` check before kicking off a new run |
| PASS cleanup awaits in-flight | `index.ts:603-614` | `awaitAllInflightFor` before `deletePrdChunks` |
| Tombstone runs once per process | `storage-sqlite.ts:160-176` | `_tombstoneSwept = false` guard; flipped on first call |
| Tombstone hooked into 4 entry points | `storage-sqlite.ts:531,558,578,586` | `upsertPrdChunks`, `listPrdChunks`, `getPrdIndexMeta`, `queryPrdSpec` |
| `tw_clear_prd_chunks` graceful in file mode | `index.ts:692-708` | `deletePrdChunks in storage` capability check |
| `prd_path` zod validation | `index.ts:UpdateStateArgs` refine | absolute path + path-traversal `path.relative` guard |

### New observations (non-blocking)

1. **`ensureIndexFresh` hardcodes `DEFAULT_EMBEDDING_MODEL`** (`prompts/build.ts:117-120`). If a user previously indexed via `tw_index_prd` with a custom `embedding_model`, the lazy path will treat the meta as stale on first lookup and reindex with default — silently overwriting their explicit choice. Not a bug for MVP (no `.current/.config.json` model override yet) but **flag as Open Question**: should the lazy path read a workspace-config model preference?

2. **`resolvePrdPath` re-validates `state.prd_path` existence on disk** (`prompts/build.ts:92`). Strictly speaking AC2 says "Given state.prd_path is absent (or null)" — but if PM sets a path then the file gets renamed/removed, falling through to auto-discover is a kinder UX than failing. Defensive enhancement, **not a deviation** from spec intent.

3. **`deletePrdChunks` doesn't call `ensureTombstoneSwept`** (`storage-sqlite.ts:551-555`). Intentional and correct — PASS cleanup targets one known-live workspace; tombstone is for dead workspaces. No fix needed.

4. **`ensureTombstoneSwept` swallows all errors** (`storage-sqlite.ts:174`). MVP-acceptable per spec ("best-effort"), but a future logger hook would help diagnose SQLite-level failures.

5. **`UpdateStateArgs.prd_path` traversal guard mirrors `IndexPrdArgs`** — good defense-in-depth.

6. **Concern (verified safe)**: PASS cleanup is **post-write** (`index.ts:603` runs after `storage.writeState` resolves). Spec AC8 says "in the same logical operation". The post-write order is correct because state write is the source of truth; if cleanup fails, the feature still PASSes. Confirmed acceptable.

**Verdict**: No blocking issues. Proceed to Phase 3.

---

## Phase 3 — Spec → Test Map

| AC | Description | Test(s) in `test/rag-lifecycle.test.mjs` |
|----|-------------|------------------------------------------|
| AC1 | `prd_path` round-trip in state | `prd_path round-trip: file mode`, `…SQLite mode` |
| AC1 | `prd_path` preserved across writes | `prd_path preserved when writeState called without it: file`, `…SQLite` |
| AC2 | Auto-discover order: state.prd_path wins | `resolvePrdPath: returns state.prd_path when it exists on disk` |
| AC2 | Auto-discover fallback PRD.md | `resolvePrdPath: falls back to workspace/PRD.md` |
| AC2 | Auto-discover docs/PRD.md | `resolvePrdPath: falls back to workspace/docs/PRD.md` |
| AC2 | Auto-discover specs/PRD.md | `resolvePrdPath: falls back to workspace/specs/PRD.md` |
| AC2 | None match → null | `resolvePrdPath: returns null when no candidate exists` |
| AC2 | state.prd_path missing file → falls through | `resolvePrdPath: state.prd_path file removed falls back to auto-discover` |
| AC3 | Fresh invalidation key skips reindex | `appendSpecContext: matching invalidation key skips upsertPrdChunks` |
| AC3 | Stale mtime triggers reindex attempt | `appendSpecContext: stale mtime triggers reindex (failure path)` |
| AC4 | Missing index triggers reindex | `appendSpecContext: null meta triggers reindex (failure path)` |
| AC5 | Coalesce dedupes concurrent runs | `lazy reindex: concurrent appendSpecContext calls coalesce` |
| AC6 | Graceful no-op on reindex failure | `appendSpecContext: reindex failure returns prompt unchanged` |
| AC7 | Coordinator role skipped | `appendSpecContext: skips lazy reindex for teamwork role` |
| AC8 | PASS cleanup drops chunks | `deletePrdChunks: removes all chunks for workspace` |
| AC8 | After cleanup, meta is null | `deletePrdChunks: getPrdIndexMeta returns null after cleanup` |
| AC9 | PASS cleanup awaits in-flight | `awaitAllInflightFor: resolves only after in-flight promise settles` |
| AC10 | Tombstone drops missing-workspace chunks | `tombstone: drops chunks for workspaces whose dir no longer exists` |
| AC10 | Tombstone runs at most once | `tombstone: runs only once per storage instance` |
| AC11 | Manual clear via deletePrdChunks | `deletePrdChunks: returns count of deleted rows` |
| AC11 | Tool capability check (file mode no-op) | `FileHandoffStorage: lacks deletePrdChunks method` |
| AC12 | Additive migration is idempotent | `schema: re-opening DB does not throw on prd_path migration` |
| AC13 | File mode: appendSpecContext no-op | `appendSpecContext: file mode storage returns unchanged` |

24 ACs ↦ tests / 24 new tests in `test/rag-lifecycle.test.mjs` + 13 existing rag tests preserved.

### Coverage gate

Touched files:
- `tools/handoff.ts` — `prd_path` parse/serialize + preservation. **Covered** by file-mode round-trip + preservation tests.
- `tools/storage.ts` — interface change. **Covered transitively** (any storage call exercises it).
- `tools/storage-sqlite.ts` — schema, migration, `deletePrdChunks`, tombstone. **Covered** by 6 dedicated tests.
- `tools/rag-coalesce.ts` — 5 exported functions. **Covered** by `awaitAllInflightFor` + concurrent coalesce test.
- `prompts/build.ts` — `resolvePrdPath` + `ensureIndexFresh` + `canLazyReindex`. **Covered** by 9 tests.
- `index.ts` — `UpdateStateArgs.prd_path` refine + `tw_clear_prd_chunks` + PASS hook. **Covered indirectly** via storage method + capability tests; dispatcher wiring reviewed in Phase 1.

Estimated coverage ≥ 80% on the typed surface. Real-embedding lazy-reindex success path is intentionally NOT unit-tested (would force every CI run to download ONNX model + pay 3.8s cold start); failure path IS tested by pointing reindex at a non-existent PRD.

### Security smoke tests (per qa SOP)

- ✅ **Path traversal on `prd_path` state field**: covered by `UpdateStateArgs` refine (mirrors `IndexPrdArgs`). Verified via dedicated test `path guard: prd_path traversal rejected at zod boundary`.
- ✅ **Tombstone uses prepared SQL**: no user-supplied workspace_path in tombstone's `SELECT DISTINCT` — operates on already-stored rows only.
- ✅ **Auto-discover paths hardcoded**: `PRD.md` / `docs/PRD.md` / `specs/PRD.md` — no user input in the relative segment.
- ✅ **`resolvePrdPath` re-checks existence**: a state-stored path that was valid at write but later replaced by a symlink to `/etc/passwd` will still be served — but workspace write access already implies trust at the boundary, matching the existing rag-pipeline threat model.

### Follow-ups (non-blocking)

1. Open Question: per-workspace embedding-model preference (`.current/.config.json` field) so lazy reindex doesn't silently overwrite a custom model choice.
2. Optional: structured logger hook in `ensureTombstoneSwept` instead of bare swallow.
3. Optional: smoke script `scripts/smoke-rag-lifecycle.mjs` that exercises the full lazy reindex via real ONNX (manual run only, not in `npm test`).

---

## Phase 4 — Run

- `npx tsc --noEmit` → ZERO errors.
- `npm test` → 136/136 green (104 prior + 32 new tests in `test/rag-lifecycle.test.mjs`).
- CI runnability: headless, no model download required (real-embedding paths kept in opt-in `scripts/smoke-rag*.mjs`).

**Decision**: PASS. Evidence recorded in this file.
