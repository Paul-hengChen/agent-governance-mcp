# Spec: Schema Versioning (Phase 4)

<!-- @pm -->

## Problem Statement

Four persisted artifacts — `.current/handoff.md` (YAML frontmatter), `tasks.md` (checkbox markdown), the SQLite tables in HTTP mode, and `.current/.config.json` — have evolved field-by-field with no recorded version. When this server ships a breaking change to any of these shapes (e.g. renaming `qa_round`, adding a required column, changing the task-line regex), older workspaces silently misparse: writes succeed against a half-understood file, drift detection lies, and the user only notices after handoff state is corrupted. Phase 4 fixes this by embedding a `schema_version` in each artifact and lazily upgrading old files on first read, so an upgraded server transparently rescues older workspaces and a downgrade can refuse-loud instead of corrupting state.

## User Stories

- As a **maintainer shipping a breaking change** to handoff YAML, I want to bump the handoff schema version and write a migration so that all existing workspaces auto-upgrade on the next `tw_get_state` call without manual intervention.
- As an **agent reading state** in a workspace last touched by an older server, I want my first `tw_get_state` to return the upgraded shape so that subsequent writes don't reintroduce stale fields.
- As a **server operator** on the SQLite backend, I want a `schema_meta` table that records the current DB version so that boot-time queries can detect and migrate older databases before any tool call lands.
- As an **agent on a newer client hitting an older-than-supported file**, I want a clear error (not a silent corruption) so that I know to upgrade the server or migrate manually.

## Acceptance Criteria

### AC-1: All four artifacts carry a schema_version

- **Given** a fresh workspace initialised by this server,
- **When** `.current/handoff.md`, `tasks.md`, the SQLite DB, and `.current/.config.json` are written,
- **Then** each artifact records its `schema_version` (currently `1`) in a stable, parseable location (YAML key, leading HTML comment, `schema_meta` row, JSON key respectively).

### AC-2: Lazy auto-migration on read

- **Given** an artifact whose `schema_version` is below `CURRENT` (or absent, treated as `0`),
- **When** `tw_get_state` (or the equivalent read entry-point for that artifact) is called,
- **Then** the server runs every registered migration from the file's version up to `CURRENT` in order, writes the upgraded artifact back atomically (tmp + rename, preserving file-lock semantics), and returns the upgraded view to the caller — all in a single tool call, no user prompt.

### AC-3: Migration framework is closed for modification, open for extension

- **Given** a need to ship schema version `N+1`,
- **When** a maintainer adds a new `Migration` object to the registry for that `SchemaKind`,
- **Then** they touch only the migration file and the `CURRENT_VERSION` constant — no edits to `tw_get_state`, `tw_update_state`, or any tool dispatcher are required.

### AC-4: Refuse-loud on unknown future versions

- **Given** an artifact whose `schema_version` is **greater** than `CURRENT`,
- **When** any read happens,
- **Then** the server returns a clear error mentioning the file's version and the server's max supported version, and does **not** attempt to "downgrade" or silently strip unknown fields.

### AC-5: Migrations are atomic and lock-aware

- **Given** two concurrent processes both reading a stale handoff,
- **When** both attempt the auto-migration write-back,
- **Then** the existing `withFileLock` + tmp-file + rename pattern serialises them, and the second writer detects via `verifyFreshness` that the file has already been upgraded and is a no-op.

### AC-6: Drift detection accounts for version skew

- **Given** a workspace where `handoff.md` is at version 2 and `tasks.md` is still at version 1 (migration partially completed before a crash),
- **When** `tw_detect_drift` runs,
- **Then** it reports the version mismatch as a first-class drift reason, distinct from completed-task drift.

## Out of Scope

- **No data-loss migrations**: every v1→v2 (etc.) migration must be lossless and reversible-in-principle; destructive bumps (drop a column, lose history) are deferred to a separate spec.
- **No external migration CLI**: lazy-on-read only. A `tw_migrate` tool is explicitly out of scope for Phase 4.
- **No cross-artifact transactional migrations**: handoff, tasks, SQLite, and config migrate independently. Coordinated migration (e.g. "bump all four atomically") is out of scope.
- **No version pinning on the client side**: the server is authoritative; clients don't negotiate.
- **No downgrade path**: an artifact written at a higher version cannot be read by an older server (AC-4 is the only behaviour).

## Dependencies / Prerequisites

- **Architect review required** — touches 4 modules (`tools/handoff.ts`, `tools/tasks-file.ts`, `tools/storage-sqlite.ts`, `tools/config.ts`) plus a new shared `schema/` namespace. New cross-cutting data shape ⇒ architect first per Constitution §4.
- Existing file-lock + atomic-write infrastructure (`guards/file-lock.ts`, `withFileLock`, tmp+rename) is reused as-is; no changes to the lock contract.
- Test suite (`test/*.test.mjs`) must be extendable by qa-engineer with version-skew fixtures — no new test framework needed.
