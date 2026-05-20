<!-- schema_version: 1 -->
# Tasks: qa-flow-enforcement
<!-- feature_id: qa-flow-enforcement | created_at: 2026-05-18 | created_by: @pm | supersedes: qa-gate-enforcement -->

## Active

### Architect phase

- [x] T01 [P0] Produce `design/qa-flow-enforcement.md` covering: (1) full ALLOWED_TRANSITIONS matrix for `(prev_agent, prev_status) → (new_agent, new_status)`, (2) `qa_round` persistence — handoff frontmatter field + SQLite column migration shape, (3) evidence convention — `qa_reports/review_<task-id>.md` path rule + SQLite `reports` table schema, (4) error envelope format for rejected transitions / missing evidence (must include `attempted` + `allowed` sets), (5) module split — whether transition logic lives in new `tools/transitions.ts` or inline in `index.ts`, (6) helper signatures `validateTransition()`, `incrementRound()`, `assertEvidence()`. No code. | depends_on: none (note: architect blueprint shipped)

### Sr-engineer phase (A+B — agent_id gate)

- [x] T02 [P0] Add `agent_id` (optional string, max 200) to `CompleteTaskArgs` zod schema AND to the `tw_complete_task` JSON inputSchema in `index.ts`. Update description to reference qa-engineer constraint. | depends_on: T01 (note: A — CompleteTaskArgs.agent_id added (zod + inputSchema))
- [x] T03 [P0] Add `requireQaEngineer(agentId, toolName)` helper in `index.ts` (or `tools/transitions.ts` per architect's call). Returns either `null` or an MCP error content payload. | depends_on: T01 (note: requireQaEngineer lives in tools/transitions.ts)
- [x] T04 [P0] Apply `requireQaEngineer` to `tw_complete_task` case after `enforcePreFlight`, before storage call. | depends_on: T02, T03 (note: tw_complete_task case gated)
- [x] T05 [P0] Replace in-handler PASS check on `tw_update_state` (current `index.ts:422`) with `.refine()` on `UpdateStateArgs`: `status !== "PASS" || agent_id === "qa-engineer"`. Delete the runtime `if`. Keep `requireQaEngineer` as defence-in-depth for clients that bypass zod. | depends_on: T03 (note: B — UpdateStateArgs .refine for PASS)

### Sr-engineer phase (qa_round + transition state machine — E)

- [x] T06 [P0] Extend `HandoffState` in `tools/handoff.ts` with `qa_round?: number` (default 0). Parser reads `qa_round` from frontmatter; serializer writes it. Backward-compat: missing field → 0. | depends_on: T01 (note: HandoffState.qa_round + parser/writer)
- [x] T07 [P0] Extend `HandoffStorage` interface in `tools/storage.ts` and both implementations (`FileHandoffStorage`, `SqliteHandoffStorage`) to persist/return `qa_round`. SQLite: add column via migration (architect's design dictates strategy — additive ALTER or new table). | depends_on: T01, T06 (note: storage interface + SQLite migration + reports table)
- [x] T08 [P0] Create `tools/transitions.ts` (per architect's design) exporting `ALLOWED_TRANSITIONS` table + `validateTransition(prev, next): TransitionError | null`. Pure function, no I/O. | depends_on: T01 (note: ALLOWED_TRANSITIONS + validateTransition + computeNewRound)
- [x] T09 [P0] Wire `validateTransition` into `tw_update_state` handler in `index.ts` — read previous state, build `prev`/`next` tuples, reject with architect-defined error envelope on failure. | depends_on: T07, T08 (note: tw_update_state handler — transition gate)
- [x] T10 [P0] Implement round-counter logic in `tw_update_state` handler: FAIL increments, PASS resets, Round 4 (qa_round === 3 + new FAIL) appends forced-rollback note and rejects subsequent PASS. | depends_on: T09 (note: round-counter + Round-4 sentinel)

### Sr-engineer phase (D — evidence-of-QA)

- [x] T11 [P0] Add `assertEvidence(workspacePath, completedTaskIds): EvidenceError | null` per architect's signature. File mode: check `qa_reports/review_<id>.md` exists for each id. SQLite mode: check `reports` table has matching rows. | depends_on: T01 (note: evidence-file.ts + SQLite reports impls)
- [x] T12 [P0] Wire `assertEvidence` into `tw_update_state` PASS path (after agent_id + transition checks, before storage write). | depends_on: T11 (note: PASS-path evidence gate wired)

### Sr-engineer phase (docs)

- [x] T13 [P1] Update `content/skill-qa-engineer.md`: (a) line 43 use `tw_complete_task(<id>, agent_id="qa-engineer")`, (b) add Phase 4 step "produce `qa_reports/review_<task-id>.md` before tw_complete_task", (c) explain round counter + Round-4 force-rollback. | depends_on: T10, T12 (note: skill-qa-engineer.md Phase 0 + qa_review usage)
- [x] T14 [P1] Audit other skills (sr-engineer, pm, architect, researcher, coordinator): none should write PASS or call tw_complete_task; verify and adjust only if drift found. | depends_on: T10 (note: other skills audit — no changes required)
- [x] T15 [P1] Bump `content/constitution.md` heading to v3.2.0 + §3 new sub-section "Server-enforced chain": list transition matrix authoritative source (design doc), evidence requirement, round cap. | depends_on: T13 (note: constitution v3.2.0 + §3.1 sub-section)
- [x] T16 [P1] Bump `package.json` to 3.2.0 + run `scripts/check-version.mjs` mentally (sr-engineer ensures it would pass; qa actually runs). | depends_on: T15 (note: package.json + Server() literal bumped to 3.2.0; check-version OK)
- [x] T17 [P2] Update README.md: add "Enforcement" section summarising A/B/D/E; tools count stays 8. | depends_on: T15 (note: README Layer-3 (c) enforcement section)

### QA-engineer phase

- [x] T18 [P0] Add unit tests covering: (1) schema rejects PASS w/o qa-engineer agent_id (B), (2) handler rejects tw_complete_task w/o qa-engineer agent_id (A), (3) `validateTransition` — every legal AND illegal cell of the matrix (E), (4) qa_round increment on FAIL, reset on PASS, (5) Round 4 forced-rollback path, (6) `assertEvidence` — missing file (file mode) rejects, present file passes, (7) SQLite reports table equivalent. | depends_on: T02-T12 (note: test/qa-flow.test.mjs — 36 new tests across matrix/round/evidence/sanitisation)
- [x] T19 [P0] Run full suite — all existing 39 tests stay green plus new tests pass. `tsc` clean. `scripts/check-version.mjs` green. | depends_on: T18 (note: 75/75 tests pass; tsc clean; check-version OK (3.2.0))
- [x] T20 [P0] qa-engineer: `npm run build`, commit `dist/`, produce `qa_reports/review_qa-flow-enforcement.md`, then `tw_complete_task` per task + final `tw_update_state(status=PASS, agent_id="qa-engineer")`. | depends_on: T19 (note: dist rebuilt; review doc at qa_reports/review_qa-flow-enforcement.md)
- [x] T21 [P0] Schema + state: add `prd_path` column to handoff_state (idempotent ALTER), extend HandoffState type, update YAML parse/serialize in tools/handoff.ts and SQLite read/write paths. AC1, AC12. | depends_on: none
- [x] T22 [P0] Storage GC primitives: add `deletePrdChunks(workspacePath)` to SqliteHandoffStorage + RagCapableStorage interface; implement lazy tombstone sweep (run-once flag); register `tw_clear_prd_chunks` MCP tool (graceful on file mode). AC8, AC10, AC11, AC13. | depends_on: T21
- [x] T23 [P0] Shared coalesce map: extract `_indexingInFlight` from index.ts to new tools/rag-coalesce.ts so both `tw_index_prd` handler and `appendSpecContext` (T24) reuse the same in-flight registry. AC5, AC9. | depends_on: none
- [x] T24 [P0] Auto-trigger in `appendSpecContext`: add `resolvePrdPath(workspace, state)` helper (state.prd_path → PRD.md → docs/PRD.md → specs/PRD.md); lazy reindex when invalidation key stale/missing via shared coalesce map; graceful no-op on failure; preserve RAG_SKIP_ROLES and isRagCapable guards. AC2, AC3, AC4, AC5, AC6, AC7. | depends_on: T21, T22, T23
- [x] T25 [P0] PASS cleanup hook: in `tw_update_state` handler, when transition matrix accepts (qa-engineer, PASS), await any in-flight reindex for the workspace, then call `deletePrdChunks(workspace_path)` before/within the state write. AC8, AC9. | depends_on: T22, T23
- [x] T26 [P0] QA: write test/rag-lifecycle.test.mjs covering AC1-AC13 (prd_path round-trip, auto-discover order, lazy reindex stale/missing, coalesce dedupe, graceful failure, coordinator skip, PASS cleanup w/ in-flight await, tombstone sweep once, manual clear tool, file-mode no-op, additive migration). Run `npx tsc --noEmit` + `npm test` must be ZERO errors / all green. | depends_on: T21, T22, T23, T24, T25
- [x] T27 [P0] Create `schema/` namespace: `SchemaKind` enum (`handoff|tasks|sqlite|config`), `CURRENT_VERSIONS` map, `Migration<TFrom,TTo>` interface, `runMigrations()` runner with refuse-loud on future versions (AC-3, AC-4). No callers wired yet. | depends_on: none (note: QA PASS — review at qa_reports/review_T27.md; 30 new tests, 166/166 green.)
- [x] T28 [P0] Wire handoff.md migrations: add `schema_version` to YAML frontmatter in `tools/handoff.ts`, register v0→v1 migration (absent → 1), call `runMigrations()` on read path, atomic write-back via existing tmp+rename + `withFileLock` (AC-1, AC-2, AC-5). | depends_on: T27 (note: QA PASS — review at qa_reports/review_T28.md; 11 new tests, 177/177 green.)
- [x] T29 [P0] Wire tasks.md migrations: persist version via leading HTML comment `<!-- schema_version: N -->` in `tools/tasks-file.ts`, register v0→v1 migration, run on every parse, atomic rewrite preserving checkbox state (AC-1, AC-2). | depends_on: T27 (note: QA PASS — review at qa_reports/review_T29.md; 12 new tests, 189/189 green.)
- [x] T30 [P0] Wire SQLite migrations in `tools/storage-sqlite.ts`: add `schema_meta(kind TEXT PRIMARY KEY, version INTEGER)` table, seed `(sqlite, 1)` on init, run pending migrations inside a transaction at first query after open, refuse-loud on future version (AC-1, AC-2, AC-4). | depends_on: T27 (note: QA PASS — review at qa_reports/review_T30-T33.md)
- [x] T31 [P1] Wire `.current/.config.json` migrations in `tools/config.ts`: add `schema_version` JSON key, register v0→v1 migration (absent → 1), upgrade on first read, atomic write-back (AC-1, AC-2). | depends_on: T27 (note: QA PASS — review at qa_reports/review_T30-T33.md)
- [x] T32 [P1] Extend `tw_detect_drift` in `tools/drift.ts` to surface version skew across the four artifacts as a distinct drift reason, separate from completed-task drift (AC-6). | depends_on: T28, T29, T30, T31 (note: QA PASS — review at qa_reports/review_T30-T33.md)
- [x] T33 [P2] Document the migration framework: add `docs/schema-versions.md` (how to author a new migration: bump CURRENT, add Migration object, fixtures), and update `CLAUDE.md` "What this server does" to mention schema versioning. No code changes. | depends_on: T32 (note: QA PASS — review at qa_reports/review_T30-T33.md)
- [x] T34 [P0] Add §7 Cognitive Discipline to constitution.md (5 bullets: Think first, Goal-driven, Surface conflicts, Read before write, Fail loud) + bump version to v3.5.0 | depends_on: none
- [x] T35 [P0] Add R11 'Match conventions' bullet to §2 Dev & Tech Standards | depends_on: T34
- [x] T36 [P1] Add R9 'Tests verify intent' to skill-qa-engineer.md Hard rules | depends_on: T34
- [x] T37 [P1] Add R3 'Surgical changes — don't touch adjacent code' bullet to constitution §1 | depends_on: none
- [x] T38 [P1] Extend §7 Fail loud with R12 tests sub-clause ('Tests pass' wrong if skipped) | depends_on: none
- [x] T39 [P1] Extend §2 Match conventions with R11 conformance>taste + surface-harmful clause; bump header to v3.5.1 | depends_on: none
- [x] T40 [P2] Extend §1 MVP strict with 'No abstractions for single-use code'; bump constitution header to v3.5.2 | depends_on: none

## Completed

<!-- tw_complete_task will move items here -->
