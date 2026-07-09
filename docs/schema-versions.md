# Schema Versioning — Author's Guide

How to bump a schema version and ship a migration.

Ships under `specs/schema-versioning.md` (PM) and
`specs/schema-versioning-architecture.md` (architect). This doc is the
operational how-to that lives alongside the source.

## What gets versioned

Four persisted artifacts, each with its own `SchemaKind`:

| Kind      | Location                       | Where `schema_version` lives                |
| --------- | ------------------------------ | ------------------------------------------- |
| `handoff` | `.current/handoff.md`          | YAML frontmatter key `schema_version: N`    |
| `tasks`   | `tasks.md` (or configured path)| Leading HTML comment `<!-- schema_version: N -->` |
| `sqlite`  | The HTTP-mode database file    | `schema_meta(kind='sqlite').version` row    |
| `config`  | `.current/.config.json`        | JSON top-level key `"schema_version": N`    |

Single source of truth for the current version is `CURRENT_VERSIONS` in
`schema/versions.ts`. Bumping a kind here is the only edit to the runner
itself when shipping a new version.

### Handoff version history

| Version | Change | Migration |
| ------- | ------ | --------- |
| v2 | adds `review_round` counter | v1→v2 stamps version + seeds `review_round: 0` |
| v3 | adds `visual_round` counter | v2→v3 stamps version + seeds `visual_round: 0` |
| v4 | adds optional `scope_decision` attestation | v3→v4 stamp-only, seeds nothing (absence === no attestation) |
| v5 | adds optional `cut_approved?: boolean` (pm-cut-approval-gate) | v4→v5 stamp-only, seeds nothing — **absence === unapproved**; a defaulted `false` would redundantly materialize absence and a defaulted `true` would be a false attestation, so nothing is seeded. Mirrors v3→v4 exactly. |
| v6 | adds optional `external_refs?: ExternalRef[]` ledger (b8-external-ref-ledger) | v5→v6 stamp-only, seeds nothing — **absence === zero external refs found === non-blocking** (inverse polarity to `cut_approved`); seeding `[]` would redundantly materialize absence. |
| v7 | adds optional `next_role` / `resume_of` / `review_verdict` protocol fields (c9-protocol-fields) | v6→v7 stamp-only, seeds nothing — **absence === no routing signal recorded**; a synthesized default would fabricate a directive. Legacy `next_role:` / `resume_of:` / `review:` pending_notes token lines are left byte-verbatim and NOT extracted (they become inert prose). |

`sqlite` stays at v2 — `cut_approved`, `external_refs`, and the v7 protocol
fields live in the handoff YAML frontmatter only and are not mirrored to the
SQLite schema (the gates that consume them either read the incoming write args
or are file-mode only).

## Authoring a v(N) → v(N+1) migration

The framework is closed-for-modification, open-for-extension. Adding a new
version means touching exactly two places:

1. **Register the step** in the kind's migrations module:
   - `schema/migrations-handoff.ts` — `Migration<Record<string, unknown>, Record<string, unknown>>`
   - `schema/migrations-tasks.ts` — `Migration<TasksPayload, TasksPayload>`
   - `schema/migrations-config.ts` — `Migration<Record<string, unknown>, Record<string, unknown>>`
   - `schema/migrations-sqlite.ts` — append a `SqliteMigrationStep` to `STEPS`
2. **Bump** `CURRENT_VERSIONS.<kind>` in `schema/versions.ts` to `N+1`.

That's it. No edits to `tw_get_state`, `tw_update_state`, drift detection, or
any tool dispatcher are required (AC-3).

### File-backed kinds (handoff / tasks / config)

```ts
// schema/migrations-<kind>.ts
import { CURRENT_VERSIONS, registerMigration } from "./versions.js";

registerMigration<TFrom, TTo>({
  kind: "<kind>",
  from: N,        // MUST be the previous CURRENT
  to: N + 1,      // MUST be from + 1 (runner enforces adjacency)
  up: (input) => {
    // Pure transform. Throw to abort the read; the caller will NOT write
    // the artifact back, so a thrown step is safe.
    return { ...input, /* new field, renamed field, etc. */ };
  },
});

void CURRENT_VERSIONS.<kind>; // grep anchor
```

### SQLite

```ts
// schema/migrations-sqlite.ts — append to STEPS
{
  from: N,
  to: N + 1,
  up: (db) => {
    // DDL only. The runner wraps this in a transaction together with the
    // schema_meta UPDATE, so partial DDL crashes don't bump the version.
    db.exec(`ALTER TABLE handoff_state ADD COLUMN new_field TEXT`);
  },
}
```

## Lazy migrate-on-read

The framework runs migrations on the FIRST read of a stale artifact in the
process lifetime. Subsequent reads return the upgraded shape directly.

- File kinds: the reader (`parseHandoff`, `parseTasks`, `loadConfig`) calls
  `runMigrations()`, persists the upgraded payload atomically via tmp+rename
  inside `withFileLock`, and returns the in-memory upgraded shape.
- SQLite: `runSqliteMigrations()` runs at storage-sqlite.ts construction,
  inside per-step transactions, before any tool handler can touch a row.

## Refuse-loud on future versions (AC-4)

If `peekVersion(raw) > CURRENT_VERSIONS[kind]`, the runner throws. No silent
field-stripping, no best-effort downgrade. The error message includes the
on-disk version and the server's max — enough for the user to know whether
to upgrade the server or migrate manually.

## Constraints to honour

- **Lossless**: every step must be reversible-in-principle. Destructive
  migrations (drop a column, lose history) are out of scope per the spec.
- **Adjacent integers only**: `to === from + 1`. Multi-step jumps are
  composed by the runner, not encoded inside a single migration.
- **Pure for file kinds**: no I/O inside `up()`. The caller owns reading
  and writing the artifact.
- **No cross-artifact transactions**: each kind migrates independently.
  Coordinated bumps across all four artifacts are out of scope.

## Test fixtures

QA fixtures live under `test/`:

- `test/schema-versioning.test.mjs` — runner unit tests.
- `test/handoff.test.mjs`, `test/tasks-file.test.mjs`, `test/sqlite.test.mjs`,
  `test/config.test.mjs` — per-kind integration tests with `_clearRegistryForTests`.

When you add a v(N+1) migration, add at least:

1. A migrate-on-read fixture (stale v(N) input → upgraded v(N+1) output).
2. A future-version refuse-loud fixture (v(N+2) input → throws).
3. A round-trip write-back fixture (parse stale → re-read → applied=[]).
