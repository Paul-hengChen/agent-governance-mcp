// Coded by @qa-engineer
// Tests for specs/bug-fixes-v3.14.1.md — AC-8.
// SQLite storage round-trip for visual_round (handoff schema v3 column).
// File mode is covered by test/handoff-versioning.test.mjs + handoff-migration.test.mjs;
// this file mirrors the same invariants for the SqliteHandoffStorage path so
// the HTTP/SQLite deployment can't silently regress visual_round persistence.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// SQLite storage relies on `better-sqlite3` which is an optionalDependency.
// Skip the suite if it's not installed locally (the file is still committed
// so CI environments that DO install it run the tests).
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch (err) {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite visual_round tests skipped");
}

function mkDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vrsql-"));
  return { dir, db: path.join(dir, "agc.db") };
}

const describe = (name, fn) => SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

describe("AC-8: SQLite visual_round persistence", () => {
  test("AC-8: writeState(visualRound=4) → parse(...).visual_round === 4", async () => {
    const { dir, db } = mkDb();
    try {
      const storage = new SqliteHandoffStorage(db);
      await storage.writeState(
        dir,                       // workspacePath
        "feat-sql",                 // activeFeature
        "FAIL",                     // status
        [],                         // completedTasks
        ["visual_fail: pixel"],     // pendingNotes
        undefined,                  // blockingReason
        "qa-engineer",              // lastAgent
        0,                          // qaRound
        undefined,                  // prdPath
        0,                          // reviewRound
        4,                          // visualRound
      );
      const state = storage.parse(dir);
      assert.ok(state, "state row must exist");
      assert.equal(state.visual_round, 4, "visual_round MUST persist in SQLite");
      assert.equal(state.qa_round, 0, "qa_round unaffected");
      assert.equal(state.review_round, 0, "review_round unaffected");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("AC-8: writeState omitting visualRound defaults to 0 (backwards-compat)", async () => {
    const { dir, db } = mkDb();
    try {
      const storage = new SqliteHandoffStorage(db);
      await storage.writeState(
        dir, "feat-noVR", "In_Progress", [], [],
        undefined, "pm", 0, undefined, 0,
        // visualRound omitted intentionally
      );
      const state = storage.parse(dir);
      assert.ok(state);
      assert.equal(state.visual_round, 0, "omitted visualRound MUST default to 0");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("AC-8: visual_round updates on subsequent write (round increment)", async () => {
    const { dir, db } = mkDb();
    try {
      const storage = new SqliteHandoffStorage(db);
      // Initial write at visual_round=1
      await storage.writeState(
        dir, "feat-incr", "FAIL", [], ["visual_fail: pixel"],
        undefined, "qa-engineer", 0, undefined, 0, 1,
      );
      let state = storage.parse(dir);
      assert.equal(state.visual_round, 1);

      // Second write at visual_round=2
      await storage.writeState(
        dir, "feat-incr", "FAIL", [], ["visual_fail: pixel"],
        undefined, "qa-engineer", 0, undefined, 0, 2,
      );
      state = storage.parse(dir);
      assert.equal(state.visual_round, 2, "row must update, not append");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("AC-8: visual_round resets to 0 on PASS write", async () => {
    const { dir, db } = mkDb();
    try {
      const storage = new SqliteHandoffStorage(db);
      await storage.writeState(
        dir, "feat-pass", "In_Progress", [], [],
        undefined, "qa-engineer", 0, undefined, 0, 5,
      );
      assert.equal(storage.parse(dir).visual_round, 5);

      // Caller (index.ts handler) computes new_visual_round=0 on PASS and
      // passes that. SQLite storage just writes what it's given.
      await storage.writeState(
        dir, "feat-pass", "PASS", ["T01"], [],
        undefined, "qa-engineer", 0, undefined, 0, 0,
      );
      assert.equal(storage.parse(dir).visual_round, 0, "PASS write MUST reset");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});
