// Coded by @sr-engineer
// SQLite DDL migrations. storage-sqlite.ts calls runSqliteMigrations() at
// construction time, after the bootstrap CREATE TABLE IF NOT EXISTS block.
// Each step changes the live Database in place, and the schema_meta version row
// is updated in the SAME transaction as the step's DDL, so a crashed migration
// leaves the version untouched (atomic migrations, AC-5 of
// specs/schema-versioning.md).
import { CURRENT_VERSIONS } from "./versions.js";
// v0 → v1: no-op DDL. The initial table set (handoff_state, tasks, reports,
// prd_chunks) is materialised by the CREATE TABLE IF NOT EXISTS block in
// storage-sqlite.ts's SCHEMA constant; v0→v1 only exists to stamp the
// schema_meta row at 1 and to give future v1→v2 migrations a baseline.
const STEPS = [
    {
        from: 0,
        to: 1,
        up: () => {
            // intentionally empty — v1 shape == bootstrap shape
        },
    },
    {
        from: 1,
        to: 2,
        up: (db) => {
            // Add review_round column to handoff_state. The idempotent-ALTER block in
            // storage-sqlite.ts's constructor also adds it for already-bootstrapped
            // DBs; this step exists so the version row + the column stay in sync
            // inside the same transaction (AC-2 of schema-versioning architecture).
            const cols = db.prepare("PRAGMA table_info(handoff_state)").all();
            if (!cols.some((c) => c.name === "review_round")) {
                db.exec("ALTER TABLE handoff_state ADD COLUMN review_round INTEGER NOT NULL DEFAULT 0");
            }
            // Code-reviewer evidence table. Distinct from `reports` (qa) because the
            // verdict enum differs and conflating them would force the qa PASS gate
            // at index.ts:619 to filter on reviewer column.
            db.exec(`CREATE TABLE IF NOT EXISTS code_review_reports (
        workspace_path TEXT NOT NULL,
        task_id        TEXT NOT NULL,
        verdict        TEXT NOT NULL CHECK (verdict IN ('APPROVED', 'CHANGES_REQUESTED')),
        reviewer       TEXT NOT NULL,
        notes          TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        PRIMARY KEY (workspace_path, task_id, created_at)
      )`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_code_review_reports_ws_task
        ON code_review_reports (workspace_path, task_id, verdict)`);
        },
    },
];
/**
 * Run pending SQLite migrations against an open Database, idempotently: create
 * schema_meta if missing, read the on-disk version (no row → 0), refuse loud
 * when it is above CURRENT_VERSIONS.sqlite, then run each step in its own
 * transaction together with its version bump. Returns the applied steps so
 * callers can log them. Callers MUST invoke this AFTER bootstrap DDL has run.
 */
export function runSqliteMigrations(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (
    kind    TEXT NOT NULL PRIMARY KEY,
    version INTEGER NOT NULL
  )`);
    const selectVersion = db.prepare("SELECT version FROM schema_meta WHERE kind = ?");
    const row = selectVersion.get("sqlite");
    const current = row?.version ?? 0;
    const target = CURRENT_VERSIONS.sqlite;
    if (current > target) {
        throw new Error(`⛔ schema-versioning: sqlite on-disk version ${current} > server max ${target}. ` +
            `This database was written by a newer server. Upgrade the server or migrate manually.`);
    }
    const upsertVersion = db.prepare("INSERT INTO schema_meta (kind, version) VALUES (?, ?) " +
        "ON CONFLICT(kind) DO UPDATE SET version = excluded.version");
    if (current === target) {
        // Make the row discoverable even when no migration ran (fresh DB on a
        // server that's never bumped versions still wants schema_meta populated).
        upsertVersion.run("sqlite", target);
        return { fromVersion: current, toVersion: target, applied: [] };
    }
    const applied = [];
    for (let v = current; v < target; v++) {
        const step = STEPS.find((s) => s.from === v);
        if (!step) {
            throw new Error(`⛔ schema-versioning: missing migration step sqlite v${v}→v${v + 1}. ` +
                `Add an entry to schema/migrations-sqlite.ts before bumping CURRENT_VERSIONS.sqlite.`);
        }
        db.transaction(() => {
            step.up(db);
            upsertVersion.run("sqlite", step.to);
        })();
        applied.push(step.to);
    }
    return { fromVersion: current, toVersion: target, applied };
}
// Compile-time grep anchor: bumping CURRENT_VERSIONS.sqlite without adding a
// matching STEPS entry triggers the missing-step error at next constructor run.
void CURRENT_VERSIONS.sqlite;
//# sourceMappingURL=migrations-sqlite.js.map