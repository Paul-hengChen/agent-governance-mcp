# Architecture

How the three layers fit together, what gates a state write, and how the routing chain is enforced.

---

## Three layers, one server

```
┌── Layer 1: Prompts ───────────────────────────────────────┐
│  prompts/build.ts assembles per-session:                  │
│    content/constitution.md                                │
│  + content/skill-<role>.md                                │
│  + .current/handoff.md state                              │
│                                                            │
│  Registered prompts: teamwork, teamwork-lite, pm,         │
│    architect, researcher, sr-engineer, qa-engineer        │
├── Layer 2: Tools (10 tw_* MCP tools) ─────────────────────┤
│  tw_get_state           tw_update_state                   │
│  tw_get_next_task       tw_add_task                       │
│  tw_complete_task       tw_rollback_task                  │
│  tw_detect_drift        tw_switch_role                    │
│  tw_index_prd           tw_clear_prd_chunks               │
│                                                            │
│  AI cannot edit handoff/tasks directly — MUST go through  │
│  these tools (zod-validated args).                        │
├── Layer 3: Guards ────────────────────────────────────────┤
│  guards/session.ts    — pre-flight read snapshot          │
│  guards/file-lock.ts  — O_EXCL cross-process lock         │
│                       + mtime freshness check             │
│                       + atomic tmp+rename publish         │
└────────────────────────────────────────────────────────────┘
```

---

## Per-write 9-step pipeline (v3.2.0+)

Every `tw_update_state` call runs this **before** `.current/handoff.md` (or the SQLite row) is touched. A rejection at any step returns `{ error, attempted, allowed, hint }` — the AI can self-correct or escalate.

```
caller: tw_update_state({ agent_id, status, completed_tasks, qa_review?, pending_notes })
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ① Pre-Flight Check (guards/session.ts)                          │
│    hasReadState(workspace)? ─ no → ⛔ BLOCKED                    │
├─────────────────────────────────────────────────────────────────┤
│ ② File Lock (guards/file-lock.ts)                               │
│    O_EXCL on .current/handoff.md.lock + stale-PID detection      │
├─────────────────────────────────────────────────────────────────┤
│ ③ Freshness Check                                                │
│    file mode: current mtime == snapshot mtime?                   │
│    SQLite mode: SNAPSHOT_KEY token unchanged?                    │
│    drift → ⛔ STATE DRIFT (caller must re-read)                  │
├─────────────────────────────────────────────────────────────────┤
│ ④ validateTransition() (tools/transitions.ts)                   │
│    (prev_agent, prev_status) → (next_agent, next_status)         │
│    must appear in ALLOWED_TRANSITIONS, OR qualify for the        │
│    same-agent In_Progress→In_Progress self-loop fast path.       │
│    reject → { error, attempted, allowed, hint }                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑤ Round-Cap Override                                             │
│    if prev_qa_round ≥ 4 → matrix collapses to {(pm, In_Progress)}│
│    forces PM re-entry; everything else rejected                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑥ Agent-ID Gate (PASS path + tw_complete_task)                  │
│    agent_id == "qa-engineer"? ─ no → ⛔ BLOCKED                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑦ Evidence-of-QA (PASS path)                                     │
│    every id in completed_tasks must have                         │
│    qa_reports/review_<id>.md (file mode) or `reports` row        │
│    qa_review attachment recorded atomically                      │
├─────────────────────────────────────────────────────────────────┤
│ ⑧ computeNewRound()                                              │
│    (qa-engineer, FAIL) → prev + 1                                │
│    (qa-engineer, PASS) | (pm, In_Progress) → 0                   │
│    else → unchanged                                              │
├─────────────────────────────────────────────────────────────────┤
│ ⑨ Atomic Write                                                   │
│    tmp file + fs.renameSync → refreshSnapshotFor                 │
│    next same-session write won't self-trip freshness check       │
└─────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                                  handoff state updated
```

---

## Routing chain

```
USER → coordinator
         ├─ "research / compare / feasibility"        → researcher
         ├─ "design source detected (Figma / 設計稿)"  → design-auditor → pm
         ├─ "plan / spec / create tasks"              → pm
         ├─ "design / architecture / contract"        → architect
         ├─ "implement / fix / refactor"              → sr-engineer
         ├─ "test / verify / rollback"                → qa-engineer
         └─ "Q&A / 1-file edit / status check"        → direct reply

specialist chain (full mode):
  researcher? → design-auditor? → pm → architect? → sr-engineer ↔ code-reviewer → qa-engineer → PASS

side-channel roles (post-PASS, manual):
  doc-writer       — updates README / CHANGELOG / docs
  release-engineer — version bump / tag / build / release

lite mode (/teamwork-lite):
  single-shot direct execution; server-read-only (no agent_id in the chain).
```

Auto-routing in full mode: after each role's handoff, the coordinator self-calls `tw_switch_role(<next_role>)` based on `pending_notes.next_role`. Five stop conditions yield to the human (`Blocked`, `PASS`, `next_role: human`, missing `next_role:` line, hop counter ≥ 10). Opt-out via `AGC_AUTO_ROUTE=0`.

---

## Three round counters

| Counter | FAIL cap | Increments on | Resets on | Round-cap collapse target |
|---|---|---|---|---|
| `qa_round` | 3 (Round 4 locks) | `(qa-engineer, FAIL)` | `PASS` or `(pm, In_Progress)` | `{(pm, In_Progress)}` |
| `review_round` | 3 (Round 4 locks) | `(code-reviewer, CHANGES_REQUESTED)` | `PASS` or `(pm, In_Progress)` | `{(pm, In_Progress)}` |
| `visual_round` | 5 (Round 6 locks) | `(qa-engineer, FAIL)` w/ `visual_fail:` | `PASS` or `(pm, In_Progress)` | `{(pm, In_Progress)}` |

Round 3 of `visual_round` allows an early `(sr-engineer → pm, In_Progress)` split escalation (`visual_split_requested:` in `pending_notes`) instead of grinding to the cap. All counters are persisted in `handoff.md`.

---

## RAG Lifecycle (SQLite mode only)

The server manages PRD-to-RAG indexing and garbage collection automatically:

- **Lazy auto-reindex**: When any specialist role prompt activates, `appendSpecContext` checks the PRD's mtime against the stored invalidation key. If stale or missing, it reindexes inline. Coordinator is skipped (`RAG_SKIP_ROLES`). Concurrent reindexes are coalesced via `_indexingInFlight`.
- **Auto-discover**: If `state.prd_path` is unset, the server probes `PRD.md` → `docs/PRD.md` → `specs/PRD.md`. Graceful no-op if none found.
- **PASS cleanup**: When `tw_update_state(status=PASS)` succeeds, all `prd_chunks` rows for that workspace are deleted. In-flight reindexing is awaited first to prevent INSERT-after-DELETE races.
- **Tombstone sweep**: On first RAG operation per process, workspaces whose directories no longer exist on disk have their chunks purged.
- **Manual escape hatch**: `tw_clear_prd_chunks(workspace_path)` for ops.

Full design: `specs/rag-lifecycle-automation.md`.

---

## Schema versioning

All four persisted artifacts carry a `schema_version` and are upgraded transparently on the next read — no manual migration step:

| Artifact | Where the version lives |
|---|---|
| `handoff.md` | YAML frontmatter `schema_version:` |
| `tasks.md` | Sentinel comment line |
| SQLite | `PRAGMA user_version` + additive `schema_version` row |
| `.config.json` | Top-level `schema_version` field |

Migration runners under `schema/migrations-*.ts`, keyed `from → to`. `tw_detect_drift` reports schema-version skew across artifacts.

Authoring a new schema version: see [docs/schema-versions.md](schema-versions.md).

---

## File mode vs HTTP/SQLite mode

| | Stdio (file mode) | HTTP (SQLite mode) |
|---|---|---|
| State location | `.current/handoff.md` + `tasks.md` per workspace | SQLite DB (single file) |
| Concurrency | `O_EXCL` lock + mtime check | SQLite transaction + SNAPSHOT_KEY token |
| Multi-machine | No (local fs only) | Yes (one DB shared) |
| Native deps | None | `better-sqlite3` (Python + C++ toolchain on install) |
| RAG / PRD chunking | Disabled | Enabled |
| Auth | N/A (stdio) | `TW_AUTH_TOKEN` Bearer + `TW_ALLOWED_ORIGINS` |

Switch by passing `--port <n> [--db <path>]` to the server binary. See [docs/http-mode.md](http-mode.md).

---

## What this server does NOT do

- **Cannot force AI to obey the constitution** — only injects it into context. AI can still hallucinate. Gates stop *state writes*, not bad reasoning.
- **Cannot stop direct `fs.write`** — if an AI bypasses MCP and edits `handoff.md` directly, `tw_detect_drift` catches it on the *next* session, not at write time.
- **`agent_id` is self-declared** — gate blocks empty/misspelled ids but cannot stop deliberate impersonation.
- **Stdio mode is local-fs only** — no cross-machine sync without HTTP+SQLite or Git-committed `.current/`.
- **Does NOT touch git** — commit/PR workflow is out of scope.
