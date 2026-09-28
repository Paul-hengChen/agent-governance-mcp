# Automation and RAG in agent-governance-mcp

> Synthesised from: automated-workflow-phases.md, automation-workflow-walkthrough.md,
> rag-pipeline-analysis.md, rag-lifecycle-automation.md
> Authors: @researcher (multiple sessions, 2026-05-19 – 2026-05-22)
> Last synthesised: 2026-06-22

---

## Summary

- **Three-layer defense** (Prompts → Tools → Guards) is fully automated end-to-end. Each role has a defined SOP with `pending_notes: ["next_role: <name>"]` for automatic coordinator hand-off.
- **State transitions are server-enforced**: the `ALLOWED_TRANSITIONS` matrix (`tools/transitions.ts`) validates every `tw_update_state` call; round caps (qa_round ≤ 4, review_round ≤ 4, visual_round ≤ 6) prevent infinite loops.
- **RAG injection point is `buildPromptForRole`, not `tw_get_state`**: querying only fires once per role activation, is role-aware, and leaves `HandoffState` typed interface untouched.
- **RAG lifecycle is fully automated (recommendation)**: lazy reindex on prompt activation (`appendSpecContext`) + PRD auto-discovery fallback + PASS-triggered GC + workspace tombstone scan on server start.
- **Chunker correctness matters**: the naive `text.split(/^#{1,3} /m)` approach loses headings and truncates long sections; the correct approach uses `matchAll` to preserve headings + secondary split by paragraph for sections >512 tokens + 10% overlap.
- **Invalidation key must be a three-tuple**: `(prd_mtime, chunker_version, embedding_model)` — mtime alone will silently miss stale embeddings after model/chunker upgrades.

---

## Layer Architecture

### Layer 1 — MCP Prompts (context injection)

Every role prompt is assembled by `buildPromptForRole()` in `prompts/build.ts`:

```
composed constitution (const-*.md fragments) + skill-<role>.md + current handoff state (JSON) + [RAG spec context]
```

Automation details:
- Constitution assembled additively from 15 fragment files (content/const-*.md) via `composeConstitution()` in `prompts/build.ts`, which consumes the `CONSTITUTION_SEGMENTS` manifest from `prompts/constitution-manifest.ts` to select fragments by dispatch mode; skill content loaded from `content/`. Per-workspace override via `.current/<filename>`.
- Project state auto-injected as JSON from `storage.parse()`.
- RAG spec context appended via `appendSpecContext()` for non-coordinator roles.
- Conditional text-transform passes after composition: `stripOriginTags` (always) + `stripRationale` (non-fullDetail) keep bundle size minimal.

### Layer 2 — Structured Tools (10 `tw_*` APIs)

| Tool | R/W | Guard required | Purpose |
|---|---|---|---|
| `tw_get_state` | Read | None | Read handoff state; marks session for guards |
| `tw_detect_drift` | Read | None | Compare handoff vs task list |
| `tw_switch_role` | Read | None | Return role SOP text |
| `tw_get_next_task` | Read | None | Return next uncompleted task |
| `tw_update_state` | Write | Pre-flight | Atomic state write + transition validation |
| `tw_complete_task` | Write | Pre-flight | Mark task `[x]` — qa-engineer only |
| `tw_rollback_task` | Write | Pre-flight | Mark task `[ ]` with reason |
| `tw_add_task` | Write | Pre-flight | Append task to list |
| `tw_index_prd` | Write | None | Chunk + embed PRD into SQLite RAG index |
| `tw_clear_prd_chunks` | Write | None | Drop all RAG chunks for a workspace |

### Layer 3 — Server-side Guards

| Guard | Enforcement point | Mechanism |
|---|---|---|
| Pre-flight check | All write tools | `enforcePreFlight()` — throws if `tw_get_state` not called first |
| Freshness verification | All file-mode writes | `verifyFreshness()` — compares mtime snapshot vs current |
| Extra token verification | SQLite mode writes | `verifyExtra()` — compares `last_updated` snapshot |
| Stale session cleanup | Background | `cleanupStaleSessions(60 min)` — evicts idle sessions |
| File lock | handoff.md / tasks.md writes | `withFileLock()` from `guards/file-lock.ts` |

---

## Phase-by-Phase Automated Workflow

### Phase 0 — Coordinator Triage

```
User Request → Coordinator
  ├─ Design-source detected? → design-auditor (before PM)
  ├─ Complexity Scope Gate triggered? → tw_switch_role(<role>)
  └─ Simple task? → Execute directly
```

Automated routing logic:
1. **Design-source detection**: `figma.com`, `.sketch`, `mockup`, `設計稿` etc. → routes to `design-auditor` before PM.
2. **Complexity Scope Gate**: ≥2 files, new public API, ≥50 LoC, needs tests, or explicit keyword (`plan`, `spec`, `feature`) → route to appropriate role.
3. **State sync**: `tw_get_state` → `tw_detect_drift` before routing (skipped for Q&A / doc edits).
4. **Routing**: `tw_switch_role(<role>)` → follow returned SOP.
5. **Chaining**: each role emits `pending_notes: ["next_role: <name>"]` for automatic coordinator continuation.
6. **Auto-routing** (full coordinator only): reads `next_role:` from `pending_notes`, continues without stop condition, up to hop cap 10.

**Lite mode**: server-read-only (no state writes, no role switching). Scope creep → recommend `/teamwork`.

### Phase 1 — Research (Optional)

| Step | Action | Automation |
|---|---|---|
| 1 | `tw_get_state` → `tw_detect_drift` | Server-enforced pre-flight |
| 2 | Web search, file reads, code traversal | Max 3 research branches |
| 3 | Write `research/<topic>.md` | Structured schema: Summary → Evidence → Recommendation → Alternatives → Open Questions |
| 4 | `tw_update_state(status=In_Progress, pending_notes=["next_role: pm"])` | Transition validated |

Allowed transitions from `researcher:In_Progress`: `(pm, In_Progress)`, `(pm, Blocked)`, `(researcher, Blocked)`, `(design-auditor, In_Progress)`.

### Phase 1.5 — Design Audit (Optional)

Trigger: coordinator detects design reference.

| Step | Action | Automation |
|---|---|---|
| 1 | `tw_get_state` → `tw_detect_drift` | Server-enforced |
| 2 | Mode detection (`figma`/`sketch`/`xd`/`penpot`/`pdf`/`image`/`no-design`) | Pattern-matching table |
| 3 | Extract Copy/Strings + Visual Tokens + Visual Widgets + Visual Baselines | Verbatim-only policy |
| 4 | Write `design/<feature>.md` | Structured schema: Mode → Source manifest → Copy/Strings → Visual Tokens → Visual Widgets |
| 5 | `tw_update_state(agent_id="design-auditor", pending_notes=["next_role: pm"])` | Transition validated |

When skipped entirely: the skill is never loaded — zero per-prompt cost.

### Phase 2 — Product Management (Spec + Tasks)

| Step | Action | Automation |
|---|---|---|
| 1 | `tw_get_state` → `tw_detect_drift` | Server-enforced |
| 2 | Review requirements + research + design files | If design audit exists, **copy verbatim** |
| 3 | **Resource Audit Gate**: grep for external refs | Per-reference: `fetch / index / ignore` |
| 4 | **Ambiguity Gate** | Incomplete ACs → `tw_update_state(status=Blocked)` + STOP |
| 5 | Write `specs/<feature>.md` | 7-section schema including Copy/Strings + Visual Tokens + Visual Widgets tables |
| 6 | Append tasks via `tw_add_task` | One call per task; format: `- [ ] T01 [P0] <desc> \| depends_on: none` |
| 7 | `tw_update_state(pending_notes=["next_role: architect/sr-engineer"])` | Complexity-based routing |

SQLite/HTTP mode: PM runs `tw_index_prd` to chunk and embed the PRD for downstream RAG retrieval.

### Phase 3 — Architecture (Conditional)

Trigger: PM routes here when ≥3 modules, new data model, or cross-cutting API.

| Step | Action | Automation |
|---|---|---|
| 1–3 | Pre-flight + Ambiguity Gate + External-ref Sanity Gate | Server-enforced; missing ACs → block to PM |
| 4 | Write `specs/<feature>-architecture.md` | 6-section schema: Affected Files → Data Structures → Interface Contracts → Sequence Diagram → Deferred Resources → Open Questions |
| 5 | **Open Questions Gate** | Non-empty → block back to PM |
| 6 | `tw_update_state(pending_notes=["next_role: sr-engineer"])` | Transition validated |

### Phase 4 — Implementation (Sr-Engineer)

| Step | Action | Automation |
|---|---|---|
| 1 | Pre-flight | Server-enforced |
| 2 | **Clarification Gate** | Ambiguous → `Blocked, next_role: human` |
| 3 | **Task-Size Check** | >5 files or >300 lines → block, recommend PM split |
| 4–7 | Implement + type check + security checklist + build | ZERO errors required |
| 8 | `tw_update_state(pending_notes=["next_role: qa-engineer"])` | Transition validated |

Hard constraint: `tw_complete_task` is **rejected** for sr-engineer — server requires `agent_id="qa-engineer"`.

### Phase 5 — QA Review and Testing (QA-Engineer)

Four sub-phases:

- **Sub-phase 0 (Claim)**: `tw_update_state(status=In_Progress, agent_id="qa-engineer")`.
- **Sub-phase 1 (Review)**: Copy Audit Gate (spec vs implementation, string-by-string), Visual Audit Gate (spec tokens vs implementation), Phase 1.5 visual compare if baselines exist. Write `qa_reports/review_<task-id>.md`.
- **Sub-phase 2 (Discussion)**: ≤3 rounds with sr-engineer. After 3 rounds → block to PM.
- **Sub-phase 3 (Tests)**: qa-engineer is the sole test author. Asks human before creating first test file if none exists.
- **Sub-phase 4 (Run + verdict)**: If all pass → `tw_complete_task` + `tw_update_state(status=PASS)`. If fail → FAIL back to sr-engineer (`qa_round` +1; cap 4 → forces PM re-entry).

Server gate at PASS: checks for `qa_reports/review_<task-id>.md` + `qa_reports/visual_<task-id>.md` (if design has `## Visual Baselines`).

---

## Role Routing Table

| From → | To | Condition |
|---|---|---|
| coordinator | researcher | research / investigate / compare / feasibility keyword |
| coordinator | design-auditor | Figma URL / `.sketch` / `mockup` / `設計稿` keyword detected |
| coordinator | pm | plan / spec / feature keyword, or after researcher/design-auditor |
| coordinator | sr-engineer | implement / fix / refactor + existing spec |
| researcher | pm | findings ready |
| design-auditor | pm | design extracted |
| pm | architect | ≥3 modules / new data model / cross-cutting API |
| pm | sr-engineer | simple feature, spec + tasks ready |
| architect | sr-engineer | architecture ready, zero open questions |
| sr-engineer | code-reviewer | implementation ready (if code-reviewer role active) |
| sr-engineer | qa-engineer | implementation ready |
| code-reviewer | sr-engineer | CHANGES_REQUESTED (review_round +1; cap 4) |
| code-reviewer | qa-engineer | APPROVED |
| qa-engineer | sr-engineer | FAIL (qa_round +1; cap 4) |
| qa-engineer | pm | FAIL after round cap |
| qa-engineer | PASS | all checks pass, evidence files present |

---

## RAG Pipeline Architecture

### Injection Point: `buildPromptForRole`, Not `tw_get_state`

The RAG spec context must be appended in `prompts/build.ts:buildPromptForRole()`, not in `tw_get_state`. Three reasons:
1. `HandoffState` is a typed interface (`tools/handoff.ts`) — adding spec context to the state object forces changes to all downstream types.
2. `tw_get_state` is called repeatedly per session (agents re-check state frequently). Running an embedding query on every call is wasteful.
3. Spec context is role-prompt-specific; state-level injection bleeds it to all tools.

The injection is role-aware: PM receives broad context; sr-engineer receives narrow context scoped to the active task.

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS prd_chunks (
  workspace_path TEXT NOT NULL,
  chunk_id       TEXT NOT NULL,
  section        TEXT NOT NULL,
  text           TEXT NOT NULL,
  embedding      TEXT NOT NULL,  -- JSON float array
  prd_mtime      INTEGER NOT NULL,
  PRIMARY KEY (workspace_path, chunk_id)
);
```

File-mode does not support RAG (no fallback to JSON files). RAG is SQLite-mode only. Maintaining a dual-path would add complexity disproportionate to the feature's value.

### Chunker Correctness

The naive `text.split(/^#{1,3} /m)` split loses headings (the delimiter is consumed) and the `.slice(0, 1500)` truncation permanently excludes the second half of long sections.

Correct approach:
1. Use `matchAll` to capture heading + content, preserving heading text.
2. For sections >~512 tokens, apply secondary split by paragraph, then sentence.
3. Add 10% overlap; prepend parent section heading to each child chunk.

### Invalidation Key

The invalidation key must be a three-tuple:

```ts
{
  prd_mtime: number,
  chunker_version: string,   // bump when chunking logic changes
  embedding_model: string,   // e.g. "xenova/all-MiniLM-L6-v2"
}
```

Using `prd_mtime` alone silently re-uses stale embeddings after model or chunker upgrades.

### Embedding Model

Recommended: `@xenova/transformers` + `all-MiniLM-L6-v2` (23 MB, 384-dim, ONNX, local cache in `~/.cache/`). Voyage API should remain opt-in via `.current/.config.json: embeddingModel` — it avoids breaking zero-config positioning and offline environments, while allowing teams to trade API cost for higher-quality embeddings.

### BM25 Hybrid

PRDs contain proper nouns (feature names, API names, people's names) where BM25 outperforms dense embeddings. A hybrid (semantic + BM25 via `minisearch` + RRF fusion) is worth adding in v1.5 after baseline retrieval quality is measured. Not MVP.

---

## RAG Lifecycle Automation

### Auto-Trigger Problem

`tw_index_prd` is currently an isolated dispatcher case — nothing calls it automatically. `appendSpecContext` queries without freshness checking. `HandoffState` has no `prd_path` field, so `appendSpecContext` cannot reindex even if it wanted to.

### Recommended Solution: Lazy Reindex (Option A + E)

**Option A — Lazy reindex in `appendSpecContext`**: when any non-coordinator role's prompt is fetched, compare the stored invalidation key against `(fs.statSync(prdPath).mtimeMs, CHUNKER_VERSION, DEFAULT_EMBEDDING_MODEL)`. If stale or missing, inline reindex via the existing `_indexingInFlight` coalesce map (prevents concurrent duplicate index operations).

**Option E — Auto-discover `prd_path`**: when `state.prd_path` is absent, try `PRD.md` → `docs/PRD.md` → `specs/PRD.md` in order. If none found, graceful no-op (existing behavior). PM can override by setting `state.prd_path`.

A + E combination: zero-manual for the common case; PM override available for non-standard naming.

**Cold start latency (~3.8s)** is accepted: it falls on role activation, not on the hot path of tool calls, and is a one-time cost per feature until the PRD changes.

### GC: Cleanup on PASS (Option α) + Workspace Tombstone Scan (Option γ)

**Option α — Cleanup on `status=PASS`**: when `tw_update_state(status=PASS, agent_id="qa-engineer")` is called and the matrix passes, run `storage.deletePrdChunks(workspace_path)`. The next feature's first role activation will trigger a fresh reindex.

**Option γ — Workspace tombstone scan**: at server start (or lazy on first RAG call), run `SELECT DISTINCT workspace_path FROM prd_chunks` and delete rows for any path where `fs.existsSync(workspace_path) === false`. Targets deleted/moved workspaces. Estimated startup cost: <100ms for <50 workspaces.

Options not adopted at MVP:
- TTL with `last_accessed_at`: requires schema column + per-query write; defer until "workspace still alive but feature inactive for months" is an observed problem.
- Feature-scoped chunks: PK change + all RAG SQL modified; disproportionate to current PRD-per-workspace assumption.
- `fs.watch`: multi-platform edge cases and restart-loss risk outweigh the benefit.

### Recommended Implementation Order

1. Schema: add `prd_path TEXT NULL` to `handoff_state` (additive, ALTER TABLE ADD COLUMN).
2. PM SOP: add optional note — if a PRD file exists, write its absolute path to `tw_update_state(prd_path=...)`.
3. Auto-discover: `resolvePrdPath(workspace, state)` helper in `appendSpecContext`.
4. Lazy reindex: compare invalidation key; reindex via `_indexingInFlight`; graceful no-op on failure.
5. GC (α): `status=PASS` path → `storage.deletePrdChunks(workspace_path)`.
6. GC (γ): constructor/lazy tombstone scan.
7. New storage method: `deletePrdChunks(workspacePath): void`.
8. Optional: `tw_clear_prd_chunks(workspace_path)` as an ops emergency switch (~10 lines).

Estimated change surface: <120 lines; +6 tests (lazy trigger ×2, PASS cleanup ×1, tombstone ×1, auto-discover ×2).

---

## Open Questions

1. **RAG availability in file mode**: `tw_index_prd` and `appendSpecContext` RAG injection are SQLite-mode only. Confirm deployment mode before asserting whether RAG fires in a given setup.
2. **BM25 hybrid priority**: depends on observed query distribution in real usage. One week of log data would clarify whether semantic-only retrieval is sufficient or whether proper-noun recall is a real failure mode.
3. **`_indexingInFlight` PASS concurrency**: if a reindex is in-flight when `status=PASS` fires the GC delete, `PASS handler` should `await _indexingInFlight.get(key)` before calling `deletePrdChunks` to avoid "just inserted, then deleted" race.
4. **Tombstone scan timing**: server startup vs first RAG call lazy. Recommendation: lazy, to avoid penalising file-mode users who never use RAG.
5. **Query string quality**: baseline uses `active task description`. For very short task descriptions, concatenating `task description + role skill summary` may improve retrieval. Measure baseline first.
