// Coded by @sr-engineer
// SQLite DDL migrations. Storage-sqlite.ts calls runSqliteMigrations() at
// construction time, after the bootstrap CREATE TABLE IF NOT EXISTS block.
//
// Unlike file-based artifacts, the "payload" is the live Database handle and
// each step performs DDL/data changes in place. The version row in the
// schema_meta table is updated inside the SAME transaction as the step's DDL
// so a crashed migration leaves the version untouched (AC-5).

import type Database from "better-sqlite3";
import { CURRENT_VERSIONS } from "./versions.js";

interface SqliteMigrationStep {
  readonly from: number;
  readonly to: number;
  up(db: Database.Database): void;
}

// v0 → v1: no-op DDL. The initial table set (handoff_state, tasks, reports,
// prd_chunks) is materialised by the CREATE TABLE IF NOT EXISTS block in
// storage-sqlite.ts's SCHEMA constant; v0→v1 only exists to stamp the
// schema_meta row at 1 and to give future v1→v2 migrations a baseline.
const STEPS: readonly SqliteMigrationStep[] = [
  {
    from: 0,
    to: 1,
    up: () => {
      // intentionally empty — v1 shape == bootstrap shape
    },
  },
];

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
export function runSqliteMigrations(db: Database.Database): SqliteMigrationResult {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (
    kind    TEXT NOT NULL PRIMARY KEY,
    version INTEGER NOT NULL
  )`);

  const selectVersion = db.prepare<[string]>(
    "SELECT version FROM schema_meta WHERE kind = ?",
  );
  const row = selectVersion.get("sqlite") as { version: number } | undefined;
  const current = row?.version ?? 0;
  const target = CURRENT_VERSIONS.sqlite;

  if (current > target) {
    throw new Error(
      `⛔ schema-versioning: sqlite on-disk version ${current} > server max ${target}. ` +
        `This database was written by a newer server. Upgrade the server or migrate manually.`,
    );
  }

  const upsertVersion = db.prepare<[string, number]>(
    "INSERT INTO schema_meta (kind, version) VALUES (?, ?) " +
      "ON CONFLICT(kind) DO UPDATE SET version = excluded.version",
  );

  if (current === target) {
    // Make the row discoverable even when no migration ran (fresh DB on a
    // server that's never bumped versions still wants schema_meta populated).
    upsertVersion.run("sqlite", target);
    return { fromVersion: current, toVersion: target, applied: [] };
  }

  const applied: number[] = [];
  for (let v = current; v < target; v++) {
    const step = STEPS.find((s) => s.from === v);
    if (!step) {
      throw new Error(
        `⛔ schema-versioning: missing migration step sqlite v${v}→v${v + 1}. ` +
          `Add an entry to schema/migrations-sqlite.ts before bumping CURRENT_VERSIONS.sqlite.`,
      );
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
