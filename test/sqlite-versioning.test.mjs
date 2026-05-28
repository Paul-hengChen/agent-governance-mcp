// Coded by @qa-engineer
// T30: SQLite schema_meta table + migration runner. Imports compiled dist/.
// Per-test workspaces use mkdtempSync so each Database file is fresh.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import Database from "better-sqlite3";
import { runSqliteMigrations } from "../dist/schema/migrations-sqlite.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

function mkDbPath(prefix = "sqlitever-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, "tw.db");
}

// ---------- AC-1: schema_meta table created, sqlite row at CURRENT ----------

test("T30 AC-1: runSqliteMigrations creates schema_meta and seeds sqlite at CURRENT", async () => {
  const db = new Database(mkDbPath());
  try {
    // v3.9.0: the v1→v2 step ALTERs handoff_state. In production the
    // SqliteHandoffStorage ctor bootstraps the SCHEMA constant (which creates
    // handoff_state) before calling runSqliteMigrations, so the ALTER is safe.
    // The standalone runner test must seed the table to mirror that contract.
    db.exec("CREATE TABLE handoff_state (workspace_path TEXT PRIMARY KEY)");
    const result = runSqliteMigrations(db);
    const row = db.prepare("SELECT version FROM schema_meta WHERE kind = ?").get("sqlite");
    assert.equal(row?.version, CURRENT_VERSIONS.sqlite);
    assert.equal(result.toVersion, CURRENT_VERSIONS.sqlite);
  } finally {
    db.close();
  }
});

test("T30 AC-1: schema_meta primary key prevents duplicate kind rows", async () => {
  const db = new Database(mkDbPath());
  try {
    // v3.9.0: seed handoff_state so the v1→v2 ALTER step inside runSqliteMigrations succeeds.
    db.exec("CREATE TABLE handoff_state (workspace_path TEXT PRIMARY KEY)");
    runSqliteMigrations(db);
    // Second insert with same kind should violate PK.
    assert.throws(
      () => db.prepare("INSERT INTO schema_meta (kind, version) VALUES (?, ?)").run("sqlite", 5),
      /UNIQUE constraint failed|PRIMARY KEY/i,
    );
  } finally {
    db.close();
  }
});

// ---------- AC-2: lazy migration on first call + idempotent re-open ----------

test("T30 AC-2 legacy: pre-versioning DB (no schema_meta) migrates up to CURRENT", async () => {
  const dbPath = mkDbPath();
  // Simulate legacy DB: open, create a sibling table, close — no schema_meta.
  const legacy = new Database(dbPath);
  legacy.exec("CREATE TABLE handoff_state (workspace_path TEXT PRIMARY KEY)");
  legacy.close();

  const db = new Database(dbPath);
  try {
    const result = runSqliteMigrations(db);
    // v3.9.0: legacy DB at v0 now climbs through both v0→v1 and v1→v2.
    assert.deepEqual(result.applied, [1, 2]);
    assert.equal(result.fromVersion, 0);
    assert.equal(result.toVersion, CURRENT_VERSIONS.sqlite);

    const row = db.prepare("SELECT version FROM schema_meta WHERE kind = ?").get("sqlite");
    assert.equal(row?.version, CURRENT_VERSIONS.sqlite);
  } finally {
    db.close();
  }
});

test("T30 AC-2 reopen: second runSqliteMigrations is a no-op (applied: [])", async () => {
  const dbPath = mkDbPath();
  let db = new Database(dbPath);
  // v3.9.0: seed handoff_state so the first-run v1→v2 ALTER succeeds.
  db.exec("CREATE TABLE handoff_state (workspace_path TEXT PRIMARY KEY)");
  runSqliteMigrations(db);
  db.close();

  db = new Database(dbPath);
  try {
    const result = runSqliteMigrations(db);
    assert.deepEqual(result.applied, []);
    assert.equal(result.fromVersion, CURRENT_VERSIONS.sqlite);
    assert.equal(result.toVersion, CURRENT_VERSIONS.sqlite);
  } finally {
    db.close();
  }
});

// ---------- AC-4: refuse-loud on future versions ----------

test("T30 AC-4: refuses-loud when on-disk sqlite version > CURRENT", async () => {
  const dbPath = mkDbPath();
  const seed = new Database(dbPath);
  seed.exec("CREATE TABLE schema_meta (kind TEXT NOT NULL PRIMARY KEY, version INTEGER NOT NULL)");
  seed.prepare("INSERT INTO schema_meta (kind, version) VALUES (?, ?)").run("sqlite", 99);
  seed.close();

  const db = new Database(dbPath);
  try {
    assert.throws(
      () => runSqliteMigrations(db),
      /sqlite on-disk version 99 > server max 2/,
    );
  } finally {
    db.close();
  }
});

// ---------- AC-5: per-step atomicity (version bump in same tx as DDL) ----------

test("T30 atomic tx: version bump happens with the step (multi-step v0→v1→v2 visible together)", async () => {
  const dbPath = mkDbPath();
  // No schema_meta row pre-existing.
  const db = new Database(dbPath);
  try {
    // Seed handoff_state so v1→v2 ALTER finds its target (mirrors ctor flow).
    db.exec("CREATE TABLE handoff_state (workspace_path TEXT PRIMARY KEY)");
    // Before: no schema_meta.
    const meta = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'",
    ).get();
    assert.equal(meta, undefined, "schema_meta should not exist before runSqliteMigrations");

    runSqliteMigrations(db);

    // After: row exists at CURRENT (=2 in v3.9.0); chain ran atomically.
    const row = db.prepare("SELECT version FROM schema_meta WHERE kind = ?").get("sqlite");
    assert.equal(row?.version, CURRENT_VERSIONS.sqlite);
  } finally {
    db.close();
  }
});

// ---------- Integration: SqliteHandoffStorage constructor exercises the migration ----------

test("T30 integration: SqliteHandoffStorage constructor stamps schema_meta", async () => {
  const dbPath = mkDbPath();
  const { SqliteHandoffStorage } = await import("../dist/tools/storage-sqlite.js");
  const s = new SqliteHandoffStorage(dbPath);
  try {
    // Re-open with a raw Database handle to inspect schema_meta.
    const inspect = new Database(dbPath);
    try {
      const row = inspect.prepare("SELECT version FROM schema_meta WHERE kind = ?").get("sqlite");
      // v3.9.0: ctor bootstraps schema then runs migrations → lands at CURRENT (=2).
      assert.equal(row?.version, CURRENT_VERSIONS.sqlite);
    } finally {
      inspect.close();
    }
  } finally {
    s.close();
  }
});

test("T30 integration: SqliteHandoffStorage constructor refuses-loud on future schema_meta", async () => {
  const dbPath = mkDbPath();
  // Pre-seed schema_meta at a future version BEFORE the storage constructor runs.
  const seed = new Database(dbPath);
  seed.exec("CREATE TABLE schema_meta (kind TEXT NOT NULL PRIMARY KEY, version INTEGER NOT NULL)");
  seed.prepare("INSERT INTO schema_meta (kind, version) VALUES (?, ?)").run("sqlite", 42);
  seed.close();

  const { SqliteHandoffStorage } = await import("../dist/tools/storage-sqlite.js");
  assert.throws(
    () => new SqliteHandoffStorage(dbPath),
    /sqlite on-disk version 42 > server max 2/,
  );
});
