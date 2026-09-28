# Schema Versioning — Author's Guide

How to bump a schema version and ship a migration.

Ships under `specs/schema-versioning.md` (PM) and
`specs/schema-versioning-architecture.md` (architect). This doc is the
operational how-to that lives alongside the source.

## What gets versioned

Four persisted artifacts, each with its own `SchemaKind`:

| Kind      | Location                       | Where `schema_version` lives                |
| --------- | ------------------------------ | ------------------------------------------- |
| `handoff` | `.current/<lane>/handoff.md` (see *Lane layout* below) | YAML frontmatter key `schema_version: N`    |
| `tasks`   | `.current/<lane>/tasks.md` (the live ledger); root `tasks.md` (if present) is a v2 index read-only to `tw_*` | Leading HTML comment `<!-- schema_version: N -->` |
| `sqlite`  | The HTTP-mode database file    | `schema_meta(kind='sqlite').version` row    |
| `config`  | `.current/.config.json`        | JSON top-level key `"schema_version": N`    |

Single source of truth for the current version is `CURRENT_VERSIONS` in
`schema/versions.ts`. Bumping a kind here is the only edit to the runner
itself when shipping a new version.

### Tasks version history

| Version | Change | Migration |
| ------- | ------ | --------- |
| v1 | (baseline; pre-versioning task lists had no sentinel) | v0→v1 stamps version (v0 is legacy task lists with no sentinel comment) |
| v2 | lane-local ledgers (e125a): splits root `tasks.md` into a v2 read-only index + `.current/<lane>/tasks.md` ledger per lane | v1→v2 stamp-only, body untouched. The MEANING of v2 is load-bearing: a v2 file at a legacy path (root `tasks.md`, or taskPaths-resolved location) is a read-only index, never written by `tw_*` tools; a v1 file there is an unmigrated ledger. The root index carries an HTML comment notice (`<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->`) and a small receipt file (`.current/tasks-index-receipt.json`, v2 hash for reverse-migration validation). Lane-local ledgers at `.current/<lane>/tasks.md` are always v2 and are the exclusive read/write targets for `tw_*` tools. Exception: a git-ignored `.current/<lane>/` path skips the migration and keeps the legacy file as the ledger (option A), so a git-local `.current/` team workspace avoids creating lane files. |

### Handoff version history

| Version | Change | Migration |
| ------- | ------ | --------- |
| v2 | adds `review_round` counter | v1→v2 stamps version + seeds `review_round: 0` |
| v3 | adds `visual_round` counter | v2→v3 stamps version + seeds `visual_round: 0` |
| v4 | adds optional `scope_decision` attestation | v3→v4 stamp-only, seeds nothing (absence === no attestation) |
| v5 | adds optional `cut_approved?: boolean` (pm-cut-approval-gate) | v4→v5 stamp-only, seeds nothing — **absence === unapproved**; a defaulted `false` would redundantly materialize absence and a defaulted `true` would be a false attestation, so nothing is seeded. Mirrors v3→v4 exactly. |
| v6 | adds optional `external_refs?: ExternalRef[]` ledger (b8-external-ref-ledger) | v5→v6 stamp-only, seeds nothing — **absence === zero external refs found === non-blocking** (inverse polarity to `cut_approved`); seeding `[]` would redundantly materialize absence. |
| v7 | adds optional `next_role` / `resume_of` / `review_verdict` protocol fields (c9-protocol-fields) | v6→v7 stamp-only, seeds nothing — **absence === no routing signal recorded**; a synthesized default would fabricate a directive. Legacy `next_role:` / `resume_of:` / `review:` pending_notes token lines are left byte-verbatim and NOT extracted (they become inert prose). |
| v8 | adds optional `dispatch_pins?: Partial<Record<AgentName, string>>` map (c14-dispatch-pins) | v7→v8 stamp-only, seeds nothing — **absence === no pins recorded**; a synthesized default would fabricate a human directive. Legacy `dispatch_pins: <role>=<model>` pending_notes lines (C8-era convention) are left byte-verbatim and NOT extracted (they become inert prose). REPLACE-wholesale when provided; feature-scoped carry-forward when omitted, NO PM-re-entry re-arm (the `external_refs` algorithm). |
| v9 | adds `hop_count` counter (d2-server-brake-accounting) — feature-scoped role-transition counter, computed server-side by `computeNewRound`, enforced by the `HOP_CAP_EXCEEDED` override in `validateTransition` (HOP_CAP = 10); resets ONLY on `active_feature` change, NOT on PM re-entry (DR-6) | v8→v9 stamps version + **seeds `hop_count: 0`** — the `review_round`/`visual_round` counter precedent, NOT the stamp-only attestation precedent (DR-3: a 0 count is the true pre-feature value, not a fabricated attestation). |
| v10 | adds optional `dispatched_at?: string` stamp (d5-server-side-stale-dispatch-detection) — server-stamped companion to `next_role`, transient/write-scoped, file-mode-only | v9→v10 stamp-only, seeds nothing — **absence === no dispatch in flight** (the `next_role` absence-is-signal precedent, NOT `hop_count`'s seed-0). |
| v11 | adds optional `dispatch_mode?: "feature" \| "bugfix"` classification (e2-bugfix-repro-gate) — PM marks bugfix-mode tickets at cut time; `"bugfix"` arms the file-mode repro-first gate (`REPRO_MANIFEST_MISSING`) on the sr-engineer → code-reviewer fix-phase edge and makes QA's Phase 0.5 expected-red disposition load-bearing; feature-scoped carry-forward (the `dispatch_pins` algorithm, but scalar), NO PM-re-entry re-arm, file-mode-only | v10→v11 stamp-only, seeds nothing — **absence === "feature" (the default dispatch mode)**; seeding `"feature"` would redundantly materialize absence. Mirrors the v9→v10 template. |
| v12 | adds `qa_rounds_total` / `review_rounds_total` / `visual_rounds_total` cumulative counters (e8-success-telemetry) — feature-scoped mirrors of the per-cycle `qa_round`/`review_round`/`visual_round`: each ticks in lock-step with its cycle counter's FAIL branch in `computeNewRound`, but resets ONLY on `active_feature` change (hop_count's reset rule — NOT on QA PASS, NOT on PM re-entry). Consumed by the release-time `metrics.jsonl` emit; file-mode-only (DR-1 — the emit keys on `next_role`, which SQLite never persists), sqlite stays v2 | v11→v12 stamps version + **seeds all three to `0`** — the `hop_count` v8→v9 counter precedent, NOT the stamp-only attestation precedent (a 0 count is the true pre-feature value; AC8 — stale rows migrate in with all three = 0). |
| v13 | adds optional `evidence_schema?: number` pin (e23-evidence-schema-versioning D1) — server-stamped, NEVER client-supplied: the orchestrator stamps `EVIDENCE_SCHEMA_CURRENT` on the first accepted write of a new `active_feature`; pins which evidence-heading-match convention (v1 exact-anchored H2, v2 normalized-contains) the `qa_reports/*.md` gate predicates run under for the life of the feature, so a mid-flight tightening of the conventions can never retroactively invalidate crash-era artifacts (the 104447-F0 incident class); feature-scoped carry-forward (the `dispatch_mode` scalar algorithm), NO PM-re-entry re-arm, file-mode-only | v12→v13 stamp-only, seeds nothing — **absence === pre-E23 feature, gets the v2 normalized-contains default at the gates** (D2 fallback: v2 is a strict superset of v1, an absent pin can only newly ACCEPT, never newly reject); seeding `EVIDENCE_SCHEMA_CURRENT` would fabricate a dispatch-time attestation the feature never received. Mirrors the v9→v10 / v10→v11 stamp-only template. |
| v14 | adds optional `cut_approved_source?: string` provenance attestation (e114-cut-approval-inheritance) — client-settable companion to `cut_approved`: the writer records `"inherited:<parent-feature>"` when this workspace's `cut_approved: true` was NOT witnessed in this workspace's own conversation turn but carried forward from a parent feature's human approval; preserves the audit property `cut_approved` exists to provide instead of quietly voiding it across workspace/lane boundaries. Feature-scoped carry-forward (the `dispatch_mode` scalar algorithm, NOT `cut_approved`'s PM-re-entry re-arm — inheritance is a stable fact about the lane, not a per-cut approval), NO PM-re-entry re-arm, file-mode-only. Recording-only: does NOT satisfy `CUT_APPROVAL_REQUIRED` or any other gate by itself (out of scope — see spec) | v13→v14 stamp-only, seeds nothing — **absence === non-inherited** (the safe direction: an old handoff with no such field must never be read as claiming inheritance); closest precedent v4→v5 (`cut_approved`), closest mechanical precedent v10→v11 (`dispatch_mode`). |
| v15 | adds optional `dispatch_mechanism?: "task" \| "switch_role" \| "inline"` and `dispatch_mechanism_tier?: string` per-hop attestation fields (e123a-lane-layout-migration, E99 option (i)) — how the acting role was dispatched and the model tier it self-reports, so a pin-vs-actual mismatch is visible in the record (nothing compares it automatically). TRANSIENT, the `next_role`/`review_verdict` per-hop lifetime: absent on any write that omits them, never carried forward. The durable per-hop history is the append-only `.current/<lane>/dispatch.jsonl` sidecar, not the handoff. Recording-only (no gate reads them), file-mode-only (`SqliteHandoffStorage.writeState` ignores them) | v14→v15 stamp-only, seeds nothing — **absence === not attested for this hop**: a historical payload has no hop in flight whose mechanism could truthfully be claimed, so any seeded value would fabricate an attestation. Mirrors the v9→v10 `dispatched_at` / v12→v13 `evidence_schema` stamp-only template. |

**Representation note (e235a, no version bump):** from e235a on, file-mode `prd_path` is stored relative to `workspace_path` (POSIX separators) and resolved back to an absolute path at parse time. A value outside `workspace_path` is dropped as absent. No version gate: absolute vs relative is self-describing (`path.isAbsolute`), legacy absolute values read unchanged, and an older server reading a relative value only displays or carries it forward (its RAG hook is SQLite-only). The SQLite `prd_path` columns stay absolute: the DB is never committed, so there is nothing to protect, and sqlite stays at v2.

### Config version history

| Version | Change | Migration |
| ------- | ------ | --------- |
| v1 | (baseline; pre-versioning configs had no `schema_version` key) | v0→v1 stamps version, seeds nothing |
| v2 | adds optional `artifacts?: "local" \| "repo"` key (e106-init-artifacts-flag) — the adopter's declared git posture for governance runtime artifacts (`.current/`, `tasks.md`, `qa_reports/`, `review_reports/`), written by `agc init --artifacts=local\|repo`; `local` keeps them out of git via the shared `.git/info/exclude`, `repo` tracks them. Surfaced as `WorkspaceConfig.artifacts` by `loadConfig` (only the two exact strings pass; anything else reads as absent, never throws) and compared against the repo's actual exclude/tracked state by `agc check` (advisory only) | v1→v2 stamp-only, seeds nothing — **absence === undeclared, NOT `"local"`**: `agc check` prints an "artifacts undeclared" advisory for an absent key, and seeding a value would fabricate a declaration the adopter never made. The `local` default applies only at `agc init` time, and only when no artifact path is already tracked. Mirrors the handoff v9→v10 stamp-only template. |

### Lane layout (E123, same release as handoff v15 — a location change, not a `schema_version` bump)

The per-workspace governance files moved from `.current/` into a lane directory,
`.current/<lane>/`. The file set is the `LANE_FILES` registry in `tools/lane-paths.ts`
(`handoff.md`, `telemetry.jsonl`, `metrics.jsonl`, `usage.jsonl`, `dispatch.jsonl`) —
read it there rather than restating it. The lane comes from the checked-out branch
(`resolveCurrentLane`): `feat/<id>-…` → `<id>` lowercased, anything else (`main`,
`integ/*`, `fix/*`, detached HEAD) → `_primary`. `.current/.config.json`,
`exemptions.json` and `feature-split.md` stay at the top level.

- **Migrate-on-read**: the first `readHandoffState` in a workspace that still holds any
  flat `LANE_FILES` entry moves them into the current lane's directory under the
  per-lane lock. An interrupted move is completed on the next read. The version
  migration above runs on the moved file as usual.
- **Refuse-loud on dual presence**: if both `.current/handoff.md` and
  `.current/<lane>/handoff.md` exist, the read throws `HANDOFF_LAYOUT_CONFLICT`
  instead of picking one. Resolve by hand; never delete either file blind.
- **No automatic downgrade path**: `migrateLaneToFlat` exists in
  `tools/lane-migrate.ts` (it backs the reversibility tests) but no tool or CLI calls it.
  A pre-lane server version pointed at a migrated workspace finds no flat
  `handoff.md`. It then sees the workspace as unstarted: it does not read the lane
  file, and it does not error.

`sqlite` stays at v2 — `cut_approved`, `external_refs`, the v7 protocol
fields, the v8 `dispatch_pins` map, the v11 `dispatch_mode` scalar, and the v10 `dispatched_at` stamp
(`next_role`'s direct companion — stamped only when `next_role` is emitted,
and `SqliteHandoffStorage.writeState` never persists `next_role`, so it never
stamps `dispatched_at` either, D5 DR-5) live in the handoff YAML frontmatter
only and are not mirrored to the SQLite schema (the gates that consume them
either read the incoming write args or are file-mode only). The v9
`hop_count` IS mirrored to SQLite, but via the idempotent
`addColumnIfMissing` ALTER in the storage-sqlite constructor with **NO
version bump** (DR-2) — the exact mechanism that added `visual_round`; an
additive `DEFAULT 0` column is backward/forward-compatible, so no
`schema_meta` step is registered.

### Tasks v2 index shape and `_primary` forward migration (e125a)

The root `tasks.md` file, once all lanes have accessed their task lists, becomes a read-only index at schema v2. The `tw_*` tools (`tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task`, `tw_sync`) read and write **only** `.current/<lane>/tasks.md` (the lane-local ledger) and never touch the legacy root file after the migration completes.

**v2 index shape:**
- **Line 1 (Sentinel):** `<!-- schema_version: 2 -->\n` (required to mark this as a v2 index, blocking downgrade to pre-E125a servers that expect v1 ledger)
- **Line 2 (Notice comment):** `<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->\n` (exact string from the codebase; inert HTML comment hidden by markdown renderers)
- **Body:** The original task list body, preserved byte-for-byte (may contain `## ` section headings and checkboxes from closed lanes)

**The `_primary` forward migration** runs lazily on first task-list access (via `ensureTasksMigrated`) when:
- The current lane resolves to `_primary` (no git, or on `main` / non-feature branch)
- The root `tasks.md` exists at schema v1 or v0 (pre-migration)
- The `.current/<lane>/` path is not git-ignored (see option A below)

When triggered, the forward migration:
1. **Copies** the root `tasks.md` body into `.current/_primary/tasks.md` (stamped v2)
2. **Re-stamps** the legacy root file with a v2 sentinel and index notice
3. **Writes** a receipt file `.current/tasks-index-receipt.json` containing `{bodySha256}` — a SHA256 hash of the normalized root body (used by the reverse migration to detect edits and validate rollback safety)

**Why copy instead of move for `_primary`:** The root file is history that will be compacted in place by E125c. Emptying it would re-target future compaction onto the wrong file. Adopters lose nothing because the entire historical body is copied into the ledger.

**Feat lanes:** Each lane's own `## <id>-*` sections are **extracted** (moved) into `.current/<lane>/tasks.md`, and replaced in the root with a marker comment: `<!-- tasks_moved: lane=<id> run=<n> of=<N> sections=<count> -> .current/<lane>/tasks.md (E125a) -->`. The root sentinel remains v1 in feat lanes until explicitly migrated. Zero matching sections make the forward migration a no-op.

**Reception and reverse runner:** The forward migration writes `.current/tasks-index-receipt.json` for `_primary` only. The `migratePrimaryReverse` runner uses this receipt to detect changes to the root body since migration and refuses (touching nothing) if the body has been edited, protecting against losing work. The receipt is deleted on successful reverse migration.

### Option A: git-ignored lane path exception

If `.current/<lane>/` is git-ignored in a workspace (e.g., a team repo that keeps `.current/` local-only), the forward migration skips entirely:
- No `.current/<lane>/tasks.md` is created
- No receipt is written
- The legacy file stays the ledger, exactly as before E125a
- A one-line advisory names the reason: `tasks ledger: <lanePath> is git-ignored in this workspace — lane-local migration skipped; <legacyPath> remains the tw_* ledger (E125a option A)`

This preserves pre-E125a behaviour for git-local workflows. The check runs via read-only `git check-ignore -q` (no git mutations). Whether a workspace adopts lane-local files (Q1=L) or not (option A) is transparent to `tw_*` calls — they route through the same `resolveTasksLedgerPath` logic.

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

- `test/schema-versions.test.mjs` — runner unit tests; this is the file that uses
  `_clearRegistryForTests`.
- `test/handoff-versioning.test.mjs` (T28), `test/tasks-versioning.test.mjs` (T29),
  `test/sqlite-versioning.test.mjs` (T30), `test/config-versioning.test.mjs` (T31)
  — per-kind integration tests. All four import the compiled output from `dist/`,
  so run `npm run build` (or plain `npm test`, which prebuilds) before them.

When you add a v(N+1) migration, add at least:

1. A migrate-on-read fixture (stale v(N) input → upgraded v(N+1) output).
2. A future-version refuse-loud fixture (v(N+2) input → throws).
3. A round-trip write-back fixture (parse stale → re-read → applied=[]).
