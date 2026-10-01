import type Database from "better-sqlite3";
export interface SqliteMigrationResult {
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly applied: number[];
}
/**
 * Run pending SQLite migrations against an open Database, idempotently: create
 * schema_meta if missing, read the on-disk version (no row → 0), refuse loud
 * when it is above CURRENT_VERSIONS.sqlite, then run each step in its own
 * transaction together with its version bump. Returns the applied steps so
 * callers can log them. Callers MUST invoke this AFTER bootstrap DDL has run.
 */
export declare function runSqliteMigrations(db: Database.Database): SqliteMigrationResult;
//# sourceMappingURL=migrations-sqlite.d.ts.map