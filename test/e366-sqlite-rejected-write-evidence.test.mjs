// Coded by @qa-engineer
// Pins for specs/e161-qa-claim-and-state-reads.md E366 (AC-E366-1..4; AC-E366-5 is the unmodified
// test/e236-rejected-write-evidence.test.mjs, qa-flow, sqlite-versioning and qa-review-scoped-append tests).
// Invariant: in SQLite mode the reports table is a record of what the server accepted. QA_REVIEW_RECORD stays
// before the later PASS gates (same-write evidence must still count), but a write that does not land -- a later
// gate rejects it, or writeState throws -- has its inserted rows undone, mirroring E236 for file mode.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite e366 cases skipped");
}

const text = (r) => r.content?.[0]?.text ?? "";

async function mkSqlite(feature) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e366-"));
  const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
  setActiveStorage(storage);
  await storage.writeState({
    workspacePath: dir, activeFeature: feature, status: "In_Progress",
    completedTasks: [], pendingNotes: ["QA: claiming review"], lastAgent: "qa-engineer",
  });
  resetSession(dir);
  storage.readState(dir);
  return { dir, storage };
}

const cleanup = (dir, storage) => {
  setActiveStorage(new FileHandoffStorage());
  try { storage.close(); } catch {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
};

const rows = (storage, dir) =>
  storage.db.prepare("SELECT * FROM reports WHERE workspace_path = ? ORDER BY task_id, created_at").all(dir);

const PASS = (feature, extra = {}) => ({
  active_feature: feature,
  status: "PASS",
  agent_id: "qa-engineer",
  pending_notes: ["QA: PASS"],
  qa_review: "Verified.",
  ...extra,
});

test("AC-E366-1: MISSING_EVIDENCE rejection leaves the reports table exactly as it was", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3");
  const feature = "e366-1";
  const { dir, storage } = await mkSqlite(feature);
  try {
    // Pre-existing evidence for an unrelated task must survive untouched.
    await storage.recordReview(dir, ["T-OLD"], "PASS", "qa-engineer", "earlier round");
    const before = rows(storage, dir);
    assert.equal(before.length, 1);
    const r = await handleUpdateState({
      workspace_path: dir,
      ...PASS(feature, { review_task_ids: ["T1"], completed_tasks: ["T1", "T2"] }),
    });
    assert.ok(r.isError, `T2 has no PASS row so the write must be rejected; got: ${text(r)}`);
    assert.match(text(r), /MISSING_EVIDENCE/);
    assert.deepEqual(rows(storage, dir), before, "the rejected write's T1 row is gone; the rest is byte-identical");
    assert.equal((await storage.hasEvidence(dir, ["T1"])).missing.length, 1, "T1 is not evidenced by a refused verdict");
  } finally {
    cleanup(dir, storage);
  }
});

test("AC-E366-2: a write that passes every gate but whose writeState throws leaves no row, and the same error propagates", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3");
  for (const status of ["PASS", "FAIL"]) {
    const feature = `e366-2-${status.toLowerCase()}`;
    const { dir, storage } = await mkSqlite(feature);
    try {
      const before = rows(storage, dir);
      storage.writeState = async () => { throw new Error("E366-INJECTED-WRITE-FAILURE"); };
      await assert.rejects(
        () => handleUpdateState({
          workspace_path: dir,
          ...PASS(feature, { status, review_task_ids: ["T1"], completed_tasks: status === "PASS" ? ["T1"] : [] }),
        }),
        /E366-INJECTED-WRITE-FAILURE/,
      );
      assert.deepEqual(rows(storage, dir), before, `${status}: rows from the failed write are undone`);
    } finally {
      cleanup(dir, storage);
    }
  }
});

test("AC-E366-3: an accepted PASS whose only evidence is its own qa_review is accepted and its rows remain", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3");
  const feature = "e366-3";
  const { dir, storage } = await mkSqlite(feature);
  try {
    const r = await handleUpdateState({
      workspace_path: dir,
      ...PASS(feature, { review_task_ids: ["T1", "T2"], completed_tasks: ["T1", "T2"], qa_review: "Everything verified." }),
    });
    assert.ok(!r.isError, `same-write evidence must still satisfy MISSING_EVIDENCE; got: ${text(r)}`);
    const got = rows(storage, dir);
    assert.deepEqual(got.map((x) => [x.task_id, x.status, x.reviewer, x.notes]), [
      ["T1", "PASS", "qa-engineer", "Everything verified."],
      ["T2", "PASS", "qa-engineer", "Everything verified."],
    ]);
  } finally {
    cleanup(dir, storage);
  }
});

test("AC-E366-4: the undo deletes only its own rows, deletes nothing once the database is closed, and never throws", async (t) => {
  if (!SqliteHandoffStorage) return t.skip("no better-sqlite3");
  const { dir, storage } = await mkSqlite("e366-4");
  try {
    // (a) another row for the same (workspace, task) with a different created_at is never touched
    await storage.recordReview(dir, ["T-U"], "PASS", "qa-engineer", "someone else's");
    await new Promise((r) => setTimeout(r, 5)); // distinct created_at (the primary key includes it)
    const undo = await storage.recordReviewUndoable(dir, ["T-U", "T-V"], "FAIL", "qa-engineer", "mine");
    assert.equal(rows(storage, dir).length, 3);
    assert.doesNotThrow(() => undo());
    const left = rows(storage, dir);
    assert.deepEqual(left.map((x) => [x.task_id, x.notes]), [["T-U", "someone else's"]]);
    assert.doesNotThrow(() => undo(), "idempotent");
    assert.equal(rows(storage, dir).length, 1);

    // (b) a row changed by someone else after the record (same key, different notes) is left alone
    await new Promise((r) => setTimeout(r, 5));
    const undo2 = await storage.recordReviewUndoable(dir, ["T-W"], "PASS", "qa-engineer", "mine2");
    storage.db.prepare("UPDATE reports SET notes = 'edited' WHERE workspace_path = ? AND task_id = 'T-W'").run(dir);
    assert.doesNotThrow(() => undo2());
    assert.equal(rows(storage, dir).filter((x) => x.task_id === "T-W").length, 1, "a modified row is not deleted");

    // (c) closed database: the undo deletes nothing and does not throw
    await new Promise((r) => setTimeout(r, 5));
    const undo3 = await storage.recordReviewUndoable(dir, ["T-X"], "PASS", "qa-engineer", "mine3");
    storage.close();
    assert.doesNotThrow(() => undo3());
    const reopened = new SqliteHandoffStorage(path.join(dir, "agc.db"));
    try {
      const x = reopened.db.prepare("SELECT * FROM reports WHERE workspace_path = ? AND task_id = 'T-X'").all(dir);
      assert.equal(x.length, 1, "rows are left as they are when the database is closed");
    } finally {
      reopened.close();
    }
  } finally {
    cleanup(dir, storage);
  }
});
