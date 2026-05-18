# Tasks: qa-flow-enforcement
<!-- feature_id: qa-flow-enforcement | created_at: 2026-05-18 | created_by: @pm | supersedes: qa-gate-enforcement -->

## Active

### Architect phase

- [ ] T01 [P0] Produce `design/qa-flow-enforcement.md` covering: (1) full ALLOWED_TRANSITIONS matrix for `(prev_agent, prev_status) → (new_agent, new_status)`, (2) `qa_round` persistence — handoff frontmatter field + SQLite column migration shape, (3) evidence convention — `qa_reports/review_<task-id>.md` path rule + SQLite `reports` table schema, (4) error envelope format for rejected transitions / missing evidence (must include `attempted` + `allowed` sets), (5) module split — whether transition logic lives in new `tools/transitions.ts` or inline in `index.ts`, (6) helper signatures `validateTransition()`, `incrementRound()`, `assertEvidence()`. No code. | depends_on: none

### Sr-engineer phase (A+B — agent_id gate)

- [ ] T02 [P0] Add `agent_id` (optional string, max 200) to `CompleteTaskArgs` zod schema AND to the `tw_complete_task` JSON inputSchema in `index.ts`. Update description to reference qa-engineer constraint. | depends_on: T01
- [ ] T03 [P0] Add `requireQaEngineer(agentId, toolName)` helper in `index.ts` (or `tools/transitions.ts` per architect's call). Returns either `null` or an MCP error content payload. | depends_on: T01
- [ ] T04 [P0] Apply `requireQaEngineer` to `tw_complete_task` case after `enforcePreFlight`, before storage call. | depends_on: T02, T03
- [ ] T05 [P0] Replace in-handler PASS check on `tw_update_state` (current `index.ts:422`) with `.refine()` on `UpdateStateArgs`: `status !== "PASS" || agent_id === "qa-engineer"`. Delete the runtime `if`. Keep `requireQaEngineer` as defence-in-depth for clients that bypass zod. | depends_on: T03

### Sr-engineer phase (qa_round + transition state machine — E)

- [ ] T06 [P0] Extend `HandoffState` in `tools/handoff.ts` with `qa_round?: number` (default 0). Parser reads `qa_round` from frontmatter; serializer writes it. Backward-compat: missing field → 0. | depends_on: T01
- [ ] T07 [P0] Extend `HandoffStorage` interface in `tools/storage.ts` and both implementations (`FileHandoffStorage`, `SqliteHandoffStorage`) to persist/return `qa_round`. SQLite: add column via migration (architect's design dictates strategy — additive ALTER or new table). | depends_on: T01, T06
- [ ] T08 [P0] Create `tools/transitions.ts` (per architect's design) exporting `ALLOWED_TRANSITIONS` table + `validateTransition(prev, next): TransitionError | null`. Pure function, no I/O. | depends_on: T01
- [ ] T09 [P0] Wire `validateTransition` into `tw_update_state` handler in `index.ts` — read previous state, build `prev`/`next` tuples, reject with architect-defined error envelope on failure. | depends_on: T07, T08
- [ ] T10 [P0] Implement round-counter logic in `tw_update_state` handler: FAIL increments, PASS resets, Round 4 (qa_round === 3 + new FAIL) appends forced-rollback note and rejects subsequent PASS. | depends_on: T09

### Sr-engineer phase (D — evidence-of-QA)

- [ ] T11 [P0] Add `assertEvidence(workspacePath, completedTaskIds): EvidenceError | null` per architect's signature. File mode: check `qa_reports/review_<id>.md` exists for each id. SQLite mode: check `reports` table has matching rows. | depends_on: T01
- [ ] T12 [P0] Wire `assertEvidence` into `tw_update_state` PASS path (after agent_id + transition checks, before storage write). | depends_on: T11

### Sr-engineer phase (docs)

- [ ] T13 [P1] Update `content/skill-qa-engineer.md`: (a) line 43 use `tw_complete_task(<id>, agent_id="qa-engineer")`, (b) add Phase 4 step "produce `qa_reports/review_<task-id>.md` before tw_complete_task", (c) explain round counter + Round-4 force-rollback. | depends_on: T10, T12
- [ ] T14 [P1] Audit other skills (sr-engineer, pm, architect, researcher, coordinator): none should write PASS or call tw_complete_task; verify and adjust only if drift found. | depends_on: T10
- [ ] T15 [P1] Bump `content/constitution.md` heading to v3.2.0 + §3 new sub-section "Server-enforced chain": list transition matrix authoritative source (design doc), evidence requirement, round cap. | depends_on: T13
- [ ] T16 [P1] Bump `package.json` to 3.2.0 + run `scripts/check-version.mjs` mentally (sr-engineer ensures it would pass; qa actually runs). | depends_on: T15
- [ ] T17 [P2] Update README.md: add "Enforcement" section summarising A/B/D/E; tools count stays 8. | depends_on: T15

### QA-engineer phase

- [ ] T18 [P0] Add unit tests covering: (1) schema rejects PASS w/o qa-engineer agent_id (B), (2) handler rejects tw_complete_task w/o qa-engineer agent_id (A), (3) `validateTransition` — every legal AND illegal cell of the matrix (E), (4) qa_round increment on FAIL, reset on PASS, (5) Round 4 forced-rollback path, (6) `assertEvidence` — missing file (file mode) rejects, present file passes, (7) SQLite reports table equivalent. | depends_on: T02-T12
- [ ] T19 [P0] Run full suite — all existing 39 tests stay green plus new tests pass. `tsc` clean. `scripts/check-version.mjs` green. | depends_on: T18
- [ ] T20 [P0] qa-engineer: `npm run build`, commit `dist/`, produce `qa_reports/review_qa-flow-enforcement.md`, then `tw_complete_task` per task + final `tw_update_state(status=PASS, agent_id="qa-engineer")`. | depends_on: T19

## Completed

<!-- tw_complete_task will move items here -->
