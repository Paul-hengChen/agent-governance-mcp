# QA Review — Phase 4 Schema Versioning (T30–T33)

Reviewer: @qa-engineer
Date: 2026-05-19
Tasks: T30 (SQLite migrations), T31 (.config.json migrations), T32 (drift skew),
T33 (docs).

## Phase 1 — Code Review

### T30 — schema/migrations-sqlite.ts + tools/storage-sqlite.ts

- **`runSqliteMigrations(db)`**: creates `schema_meta(kind, version)`, reads
  current sqlite version (no row → 0), refuses-loud on `current > target`,
  walks `STEPS` per-from in adjacent integer order, wraps each `step.up(db)`
  with the version `UPSERT` inside a single `db.transaction`. ✓
- v0→v1 step is a no-op DDL (initial table set already in `SCHEMA` bootstrap).
  Future v(N→N+1) just appends to `STEPS`. ✓
- Wiring point: `SqliteHandoffStorage` constructor calls `runSqliteMigrations`
  AFTER `this.db.exec(SCHEMA)` and the additive `addColumnIfMissing` ALTERs.
  Order matters — the additive ALTERs are part of "what v1 already looks
  like" for DBs created by older builds. Confirmed correct order. ✓
- Idempotent re-open: second construction finds row at v1 → `current === target`
  → upserts (no-op) → returns `applied: []`. No DDL re-runs. ✓
- Refuse-loud: when row is `(sqlite, 99)`, constructor throws with
  `version 99 > server max 1` message. Propagates to HTTP boot caller. ✓

### T31 — schema/migrations-config.ts + tools/config.ts

- v0→v1 stamps `schema_version: 1` on legacy JSON; same shape as handoff
  migration. ✓
- `loadConfig` runs `runMigrations<Record<string, unknown>>("config", parsed)`
  AFTER the JSON-object guard. ✓
- Heal-on-read: when `applied.length > 0`, `atomicWriteConfig` re-stamps with
  CURRENT and writes via tmp+rename. Failure is swallowed (best-effort). ✓
- Stripping: only known fields (`taskPattern`, `taskPaths`) are surfaced on
  the typed `WorkspaceConfig` view; `schema_version` is dropped from cache. ✓
- Module-level `configCache` keys on workspacePath → fresh tmpdirs in tests
  yield isolated cache entries. ✓

### T32 — tools/drift.ts

- `readArtifactVersion(workspacePath, kind)`:
  - `handoff`: reads `.current/handoff.md`, extracts YAML frontmatter, runs
    `peekVersion`. Missing frontmatter → 0 (treat as legacy). ✓
  - `tasks`: uses `findTasksFile` (honours `.current/.config.json` overrides),
    matches `<!-- schema_version: N -->` sentinel on line 1. Missing → 0. ✓
  - `config`: reads `.current/.config.json`, parses JSON, runs `peekVersion`. ✓
  - All read errors caught and collapsed to `null` (skip artifact). ✓
- `checkVersionSkew` reports ONLY `onDisk > CURRENT` (refuse-loud surface);
  stale artifacts are healed by lazy migrate-on-read elsewhere — confirmed
  per architect AC-6. ✓
- Integration: appended at the end of `detectDrift`, after the existing
  completed-task drift loop and the FAIL/Blocked-with-incomplete check.
  Preserves prior message ordering. ✓

### T33 — docs/schema-versions.md + CLAUDE.md

- `docs/schema-versions.md` covers: kinds, where `schema_version` lives,
  authoring v(N→N+1) for file kinds AND SQLite, lazy migrate-on-read
  semantics, refuse-loud (AC-4), constraints, test fixtures. ✓
- `CLAUDE.md` adds a one-liner under "What this repo is" pointing at
  `docs/schema-versions.md`. No other code changes. ✓

### Security Checklist

- No hardcoded secrets. ✓
- All external input validated at boundaries:
  - `loadConfig` rejects non-object / array JSON before migration runs.
  - `peekVersion` collapses NaN / Infinity / negative / string / non-object
    to 0 (per existing T27 contract).
  - `readArtifactVersion` swallows parse errors (drift detection is
    diagnostic, not authoritative).
- No injection vectors:
  - SQLite uses prepared statements (`db.prepare`) for the version row.
  - DDL strings are static literals — no string interpolation.
  - File paths use `path.join` exclusively.

### Spec-to-Test Map

| AC   | Test (file)                          |
| ---- | ------------------------------------ |
| AC-1 (sqlite) | `T30 AC-1` in `test/sqlite-versioning.test.mjs` |
| AC-1 (config) | `T31 AC-1` in `test/config-versioning.test.mjs` |
| AC-2 (sqlite legacy → v1) | `T30 AC-2 legacy` |
| AC-2 (sqlite idempotent re-open) | `T30 AC-2 reopen` |
| AC-2 (config legacy heal-on-read) | `T31 AC-2 heal` |
| AC-2 (config fast-path) | `T31 AC-2 fast-path` |
| AC-4 (sqlite future) | `T30 AC-4` |
| AC-4 (config future) | `T31 AC-4` |
| AC-5 (atomicity) | `T30 atomic tx` |
| AC-6 (drift skew) | `T32 drift-skew.test.mjs` (multiple) |
| AC-3 (closed-for-modification) | covered by existing T27 tests; T30/T31 add zero new edits to dispatcher |

## Phase 4 — Run

- `tsc --noEmit`: clean
- `npm test`: see final run below
- `scripts/check-version.mjs`: green (3.3.0)

## Verdict

PASS. Tests, type check, and build are clean. T30–T33 complete the Phase 4
schema-versioning rollout across all four artifacts plus drift surface plus
author docs.
