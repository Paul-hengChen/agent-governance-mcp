# Architecture: Schema Versioning (Phase 4)

<!-- @architect -->

Implements `specs/schema-versioning.md`. Lazy migrate-on-read across four
artifacts via a single shared runner.

## Affected Files

**New:**
- `schema/versions.ts` — `SchemaKind`, `CURRENT_VERSIONS`, `Migration<TFrom,TTo>`, `MigrationResult`, `runMigrations()`, `peekVersion()`.
- `schema/migrations-handoff.ts` — handoff YAML migration registry.
- `schema/migrations-tasks.ts` — tasks.md migration registry.
- `schema/migrations-sqlite.ts` — SQLite DDL migrations.
- `schema/migrations-config.ts` — `.config.json` migration registry.
- `docs/schema-versions.md` — author-facing how-to (T33).

**Modified:**
- `tools/handoff.ts` — `parseHandoff()` calls the runner; `writeHandoffState()` stamps `schema_version`.
- `tools/tasks-file.ts` — `parseTasks()` strips/applies the leading HTML-comment version sentinel; `atomicWrite()` re-stamps it.
- `tools/storage-sqlite.ts` — constructor creates `schema_meta` table, runs DDL migrations inside a single transaction at boot.
- `tools/config.ts` — `loadConfig()` runs the runner on the parsed JSON; cache stores the upgraded shape.
- `tools/drift.ts` — adds a "future-version contamination" drift reason via `peekVersion()`.
- `CLAUDE.md` — one-line mention under "What this server does".

Total: 5 new + 6 modified = 11 files. T27 sits at ≤ 5 files; T28–T31 each touch 1 implementation file + register migrations in their own `schema/migrations-*.ts`; well within the sr-engineer 5-files / 300-lines envelope per task.

## Data Structures

### `schema/versions.ts`

```ts
// String-literal union, not enum — matches existing TS style in this repo.
export type SchemaKind = "handoff" | "tasks" | "sqlite" | "config";

// Single source of truth. Bumping a kind's CURRENT here is the *only*
// edit a maintainer makes to the runner itself when shipping a new
// schema version (AC-3).
export const CURRENT_VERSIONS: Record<SchemaKind, number> = {
  handoff: 1,
  tasks:   1,
  sqlite:  1,
  config:  1,
};

// Absent version field == 0. A workspace last written by an
// older server (no schema_version key at all) is treated as v0 and
// migrated up to CURRENT on first read.
export const VERSION_WHEN_ABSENT = 0;

// `from` and `to` MUST be adjacent integers (to = from + 1). The runner
// composes them; a v0→v2 jump is two migrations, not one. This keeps
// individual migrations small and replayable.
export interface Migration<TFrom, TTo> {
  readonly kind: SchemaKind;
  readonly from: number;
  readonly to: number;
  // Pure function: payload in, payload out. No I/O. Throwing = abort,
  // caller does not write the artifact back.
  up(input: TFrom): TTo;
}

export interface MigrationResult<T> {
  readonly payload: T;          // upgraded payload at CURRENT_VERSIONS[kind]
  readonly fromVersion: number; // version on disk before runner ran
  readonly toVersion: number;   // CURRENT_VERSIONS[kind]
  readonly applied: number[];   // list of `to` versions of each step run (may be empty)
}
```

### `schema_meta` table (SQLite)

```sql
CREATE TABLE IF NOT EXISTS schema_meta (
  kind     TEXT NOT NULL PRIMARY KEY,  -- 'sqlite' (only — handoff/tasks/config live in their own files)
  version  INTEGER NOT NULL
);
-- Seeded on first open: INSERT OR IGNORE INTO schema_meta(kind, version) VALUES ('sqlite', 0).
-- DDL migrations bump the row inside a single transaction with their ALTERs.
```

### Where `schema_version` lives per artifact

| Artifact | Location | Read | Write |
|---|---|---|---|
| `.current/handoff.md` | YAML frontmatter key `schema_version: N` | parsed alongside other frontmatter | `yaml.dump` emits the field; runner stamps before serialize |
| `tasks.md` | Leading HTML comment **on line 1**: `<!-- schema_version: N -->` | `parseTasks()` strips this line before checkbox scan | `atomicWrite()` re-prepends current version |
| SQLite DB | `schema_meta(kind='sqlite').version` | `SELECT version FROM schema_meta WHERE kind='sqlite'` | `UPDATE schema_meta SET version = ? WHERE kind = 'sqlite'` inside DDL tx |
| `.current/.config.json` | JSON top-level key `"schema_version": N` | `JSON.parse`; runner inspects/strips before returning the typed `WorkspaceConfig` | `JSON.stringify` with `schema_version` injected |

## Interface Contracts

### `schema/versions.ts`

```ts
/**
 * Look at the raw payload, return the version it claims, without mutating.
 * Used by drift detection and by the runner itself. Implementations live
 * per-kind because each artifact stores the field differently.
 */
export function peekVersion(kind: SchemaKind, raw: unknown): number;

/**
 * Run every registered migration for `kind` from the payload's current
 * version up to CURRENT_VERSIONS[kind]. Pure: caller does the I/O.
 *
 * Throws (refuse-loud, AC-4) when:
 *   - peekVersion(kind, raw) > CURRENT_VERSIONS[kind]   ("future version")
 *   - a required migration step is not registered       ("missing migration N→N+1")
 *   - a migration's up() throws                         (propagated as-is)
 *
 * No-op (applied: []) when on-disk version already equals CURRENT.
 */
export function runMigrations<T>(kind: SchemaKind, raw: unknown): MigrationResult<T>;

/**
 * Register a migration step. Called at module load time from the per-kind
 * migrations-*.ts files. Idempotent (same from/to overwrite). Adjacent
 * integers only (to === from + 1) — runner enforces with a guard.
 */
export function registerMigration<TFrom, TTo>(m: Migration<TFrom, TTo>): void;
```

### Per-artifact integration

```ts
// tools/handoff.ts
export function parseHandoff(workspacePath: string): HandoffState | null {
  // ... existing read + YAML parse ...
  const result = runMigrations<RawHandoffPayload>("handoff", rawFrontmatterAndBody);
  if (result.applied.length > 0) {
    // Schedule a write-back inside the existing withFileLock + verifyFreshness pipeline.
    // Re-uses writeHandoffState() so the atomic tmp+rename + lock + freshness contract is unchanged.
    void persistMigratedHandoff(workspacePath, result.payload);
  }
  return toTypedState(result.payload);
}

// tools/tasks-file.ts
function parseTasks(workspacePath: string): ParseResult | null {
  // ... existing fs.readFileSync ...
  const { sentinelLineCount, contentBody, rawVersion } = stripVersionSentinel(content);
  const result = runMigrations<string>("tasks", { version: rawVersion, body: contentBody });
  if (result.applied.length > 0) {
    void persistMigratedTasks(workspacePath, filePath, result.payload);
  }
  // continue with current line-by-line checkbox scan on result.payload
}

// tools/storage-sqlite.ts (constructor)
// 1. CREATE TABLE IF NOT EXISTS schema_meta (...)
// 2. INSERT OR IGNORE INTO schema_meta(kind, version) VALUES ('sqlite', 0)
// 3. const current = selectVersion('sqlite');
// 4. for each Migration in migrations-sqlite.ts where m.from >= current:
//      this.db.transaction(() => { m.up(this.db); UPDATE schema_meta SET version = m.to; })()
// All DDL + version bump happens in one transaction per step. WAL mode (already enabled)
// guarantees no partial visibility.

// tools/config.ts
export function loadConfig(workspacePath: string): WorkspaceConfig {
  // ... existing JSON.parse ...
  const result = runMigrations<WorkspaceConfig & { schema_version?: number }>("config", parsed);
  if (result.applied.length > 0) {
    persistMigratedConfig(workspacePath, result.payload);
  }
  // strip schema_version from cached/returned shape so callers stay typed against WorkspaceConfig.
}
```

### Drift detection

```ts
// tools/drift.ts — add at the end of detectDrift(), before assembling DriftReport.
const skew = checkVersionSkew(workspacePath);
if (skew.length > 0) drifts.push(...skew);

/**
 * Reports any artifact whose on-disk schema_version is GREATER than
 * CURRENT_VERSIONS[kind] — i.e. file written by a newer server. Stale
 * (< CURRENT) artifacts are NOT reported because lazy-on-read healed them
 * before we got here.
 */
function checkVersionSkew(workspacePath: string): string[];
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Agent
    participant tw_get_state as MCP: tw_get_state
    participant parseHandoff as parseHandoff()
    participant runner as runMigrations("handoff")
    participant writer as writeHandoffState()
    participant lock as withFileLock + verifyFreshness
    participant fs as .current/handoff.md

    Agent->>tw_get_state: call
    tw_get_state->>parseHandoff: read workspace
    parseHandoff->>fs: readFileSync
    fs-->>parseHandoff: raw YAML + body
    parseHandoff->>runner: peekVersion → v0 (no schema_version key)
    runner->>runner: apply m0→1 (default schema_version = 1)
    runner-->>parseHandoff: { payload, applied: [1], fromVersion: 0, toVersion: 1 }
    parseHandoff->>writer: persistMigratedHandoff (fire-and-forget)
    writer->>lock: acquire
    lock->>fs: verifyFreshness (compare snapshot)
    fs-->>lock: ok
    writer->>fs: tmp write + renameSync (atomic)
    lock->>writer: release
    parseHandoff-->>tw_get_state: HandoffState (v1 shape)
    tw_get_state-->>Agent: JSON
    Note over Agent,fs: Subsequent reads in same process see v1 directly;<br/>runner returns applied: [] (no-op fast path).
```

## Open Questions

None. All four points raised by sr-engineer are answered above:

- **(a) Migration shape + registry**: `Migration<TFrom,TTo>` interface with adjacent-integer `from`/`to`, registered per-kind via `registerMigration()` at module load.
- **(b) `runMigrations()` contract**: pure, caller owns I/O; throws on future version / missing step / step failure; returns `MigrationResult<T>` including `applied[]` for write-back gating.
- **(c) Where `schema_version` lives**: YAML key in handoff, leading HTML comment in tasks.md, `schema_meta` row in SQLite, JSON key in `.config.json`. See table above.
- **(d) Drift rule**: `checkVersionSkew()` reports only **future-version contamination** (on-disk > CURRENT). Stale artifacts are healed in-place by the runner, so they never reach drift detection in a degraded state.
