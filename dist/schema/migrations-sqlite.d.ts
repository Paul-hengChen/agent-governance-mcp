import type Database from "better-sqlite3";
export interface SqliteMigrationResult {
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly applied: number[];
}
/**
 * Run pending SQLite migrations against an open Database. Idempotent:
 * - creates schema_meta if missing,
 * - reads the on-disk sqlite version (no row → 0),
 * - refuses-loud when on-disk version > CURRENT_VERSIONS.sqlite (AC-4),
 * - walks every step from current up to CURRENT inside per-step transactions,
 *   bumping schema_meta.version inside the same tx as the DDL (AC-2, AC-5),
 * - returns the applied step list so callers can log / surface in drift checks.
 *
 * Callers MUST invoke this AFTER bootstrap DDL has run on the connection.
 */
export declare function runSqliteMigrations(db: Database.Database): SqliteMigrationResult;
//# sourceMappingURL=migrations-sqlite.d.ts.map