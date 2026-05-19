# QA Review — T29: tasks.md schema-versioning sentinel + migration (Phase 4)

<!-- @qa-engineer -->

## Scope

Reviewed:
- `schema/migrations-tasks.ts` (new, ~22 lines) — `TasksPayload` envelope + v0→v1 registration.
- `tools/tasks-file.ts` (refactor) — `SENTINEL_RE`, `stripSentinel`/`prependSentinel` helpers, `parseTasks` now returns `migratedBody` + `migrationApplied`, `getNextTaskFromFile` triggers sync heal-on-read, `atomicWrite` always re-stamps sentinel.

Implements `specs/schema-versioning.md` AC-1 / AC-2 / AC-4 for the tasks artifact.

## Phase 1 — Review

### Correctness
- Sentinel regex is anchored at `^` with `\d+` integer guard; it only matches a well-formed leading comment. Malformed (`<!-- schema_version: abc -->`) collapses to "no version" and the v0→v1 path heals the file with a clean sentinel.
- `atomicWrite` strips-then-prepends → idempotent across re-writes; the file never grows duplicate sentinels.
- Mutating ops (`completeTaskInFile` / `rollbackTaskInFile` / `addTaskInFile`) run regex replaces with the `m` flag and `^- \[` anchors — the sentinel HTML comment line never collides with checkbox patterns.
- `getNextTaskFromFile` heals on read via sync `atomicWrite` inside a `try/catch`; failure to heal does not break the read (in-memory tasks are already at CURRENT).
- `parseTasksFromFile` (the drift code path) deliberately skips write-back per architecture — T32 will surface skew as drift.

### Security
- No new I/O surface or external input. Sentinel `\d+` is bounded; no ReDoS surface.
- `runMigrations` validates payload via T27's `typeof` guards.
- No shell, SQL, path traversal, XSS.

### Concerns
None blocking. One cosmetic note:
1. **Malformed-sentinel artifact**: a file with `<!-- schema_version: abc -->` heals by prepending a fresh `<!-- schema_version: 1 -->` in front of the old malformed comment, leaving the old line in the body. Re-reads stay consistent (regex skips comments), but the body grows a vestigial line. Acceptable — corruption is rare and self-limiting.

### Phase 2 — Discussion
Not needed. No blocking issues.

## Phase 3 — Tests

### Spec → Test Mapping (T29 scope)

| AC | Test name | File |
|---|---|---|
| AC-1 | `addTaskInFile creates new tasks.md with sentinel on line 1` | `test/tasks-versioning.test.mjs` |
| AC-1 | `completeTaskInFile preserves sentinel after mutation` | same |
| AC-1 | `rollbackTaskInFile preserves sentinel after mutation` | same |
| AC-1 | `atomicWrite is idempotent — re-write does not duplicate sentinel` | same |
| AC-2 | `getNextTaskFromFile heals sentinel-less tasks.md on first read` | same |
| AC-2 fast-path | `getNextTaskFromFile no-op when file already at v1` | same |
| AC-2 boundary | `parseTasksFromFile does NOT trigger heal-on-read (drift path)` | same |
| AC-4 | `parseTasksFromFile refuses-loud when sentinel version > CURRENT` | same |
| AC-4 | `getNextTaskFromFile refuses-loud on future sentinel` | same |
| AC-4 | `completeTaskInFile refuses-loud on future sentinel (mutation path)` | same |
| boundary | `malformed sentinel value falls into v0 and heals` | same |
| boundary | `sentinel with extra whitespace still matches` | same |

ACs 3 / 5 / 6 remain covered by T27 / out-of-scope-here / T32 respectively.

### Coverage Gate
New / modified functions:
- `stripSentinel`, `prependSentinel` — hit by every test that touches the file.
- `parseTasks` migration branches (applied true/false) — both covered.
- `getNextTaskFromFile` heal branch — covered.
- `atomicWrite` re-stamp branch — covered.

Repo has no automated coverage tool — coverage asserted by branch-by-branch inspection.

### Security Smoke Tests
Boundary inputs covered: missing file, malformed sentinel integer, sentinel with whitespace, future-version sentinel, sentinel-in-body (not at line 1) deliberately ignored.

No auth surface.

## Phase 4 — Run

- `npm test`: **189/189 PASS** (+12 from `test/tasks-versioning.test.mjs` over the 177 baseline; existing tasks/handoff/session/RAG/QA-flow tests survived the sentinel injection).
- Project build: ZERO `tsc` errors.
- CI runnable: tests run headlessly under `node --test`.

**Verdict: PASS.** T29 ready to complete.
## 2026-05-19T10:00:52.172Z — PASS — by qa-engineer

T29 PASS — tasks.md sentinel migration: schema/migrations-tasks.ts (TasksPayload envelope v0→v1); tools/tasks-file.ts gets SENTINEL_RE + stripSentinel/prependSentinel + parseTasks migration + atomicWrite re-stamp + getNextTaskFromFile sync heal-on-read. 12 new tests cover AC-1 (sentinel on add/complete/rollback + idempotent re-write), AC-2 (heal-on-read + fast-path + parseTasksFromFile drift-path stays read-only), AC-4 (refuse-loud through read, getNext, and mutation paths), boundary (malformed value heals, whitespace-padded matches). 189/189 green.

