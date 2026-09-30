// Coded by @qa-engineer
// Tests for `tw_void_task` (E117) — tools/tasks-file.ts voidTaskInFile,
// tools/storage-sqlite.ts SqliteHandoffStorage.voidTask, the tools/tasks.ts
// delegator/handler, and the tools/registry.ts entry.
//
// No specs/e117-void-task.md exists — the backlog row for the void tool
// (docs/backlog.md, E117) IS the contract (PM/architect skipped per the
// mini-chain scope_decision). The acceptance point the ticket names:
// tw_get_next_task must stop offering a voided row, in BOTH storage modes
// (a live consequence found under E112).
// Three rounds of code-reviewer scrutiny (review_reports/review_T-E117-01.md)
// turned up further properties that are the real risk surface; this file
// pins exactly those, per the qa dispatch brief:
//
//   Section 1 — a voided row is never offered again (both modes; E112)
//   Section 2 — completion guard reads the LEDGER (handoff.completed_tasks),
//               not just the tasks.md mirror checkbox (both modes; C1)
//   Section 3 — the post-write invariant refuses (and leaves the file
//               byte-untouched) under a custom taskPattern and under a
//               newline-bearing reason (C2/C5)
//   Section 4 — BOTH modes now distinguish already-voided from
//               never-existed (Q1; E120 update, 2026-09-17 — SEE BELOW: this
//               used to be a deliberate file/SQLite asymmetry; it no longer
//               is, see the E120 note immediately following this list)
//   Section 5 — invisibility to parseTasksFromFile / tw_detect_drift / tw_sync
//   Section 0/6 — basic contract (not rollback/complete, id reuse, [x] refusal,
//               unknown id) + registry/dispatch wiring
//
// Update: re-cutting a voided task id is now refused (E120, 2026-09-17,
// docs/backlog.md order 0v, closed in
// `feat/e120-e131-e122-wave1-gate-render`, review_reports/review_T-E120131-01.md,
// APPROVED round 3). This file's original "a voided id becomes reusable in a
// re-cut via addTask" test (old Section 0) and its "Q1 (SQLite mode): ...
// uniform not-found ... deliberate asymmetry" test (old Section 4) BOTH
// asserted the old, pre-refusal contract as correct. That contract was the defect:
// id reuse inheriting stale review/QA evidence (finding C4 below) is exactly what a
// permitted re-cut let happen — a never-reviewed re-cut satisfied
// MISSING_REVIEW_EVIDENCE and the QA completion-evidence gate by inheriting
// the voided incarnation's leftover `review_reports/`/`qa_reports/` files,
// keyed only by task id with no void-generation field. The fix is to
// REFUSE the re-cut outright in both storage modes (a `voidedPattern` scan
// in `addTaskInFile`; a `voided_tasks` tombstone table in SQLite, since
// `voidTaskStmt` DELETEs the tasks row and would otherwise erase the
// evidence needed to refuse). Both tests below are rewritten in place to
// assert the NEW contract. The full refusal matrix — nine leading-whitespace
// forms, id-boundary controls, and the no-false-refusal cases — lives in
// test/e120-void-recut-refusal.test.mjs (created for this cut per the qa
// dispatch brief) rather than duplicated here.
//
// Deliberately NOT covered here (filed as separate, non-blocking backlog
// rows per the dispatch brief — do not fix or block on these in this file):
//   C3 (SQLite DELETE discards `reason`), C6 (`$\``/`$'` String.replace
//   splicing — shared with rollbackTaskInFile/completeTaskInFile/
//   addTaskInFile, out of scope for the same reason round 3 of the E117
//   review gave: void's OWN contract is satisfied in every C6 repro, the
//   damage is collateral to other rows). C4 (id reuse inherits stale
//   review/QA evidence) is NO LONGER out of scope — see the E120 update
//   above; it is closed and pinned by the two rewritten tests here plus
//   test/e120-void-recut-refusal.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { voidTask, completeTask, rollbackTask, getNextTask, addTask, handleVoidTask } from "../dist/tools/tasks.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { detectDrift } from "../dist/tools/drift.js";
import { reconcileTasks } from "../dist/tools/sync.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency — skip the
// SQLite-mode blocks gracefully if it isn't installed locally (same guard as
// test/reviewer-completed-tasks-gate.test.mjs / test/dispatch-pins.test.mjs).
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode e117-void-task tests skipped");
}

// ---------------------------------------------------------------------------
// File-mode helpers (mirrors test/tasks.test.mjs)
// ---------------------------------------------------------------------------

// The tasks.md sentinel MUST be present and current: without it,
// getNextTaskFromFile's lazy "heal-on-read" migration (tools/tasks-file.ts)
// applies an unlocked atomicWrite on the very first read, bumping tasks.md's
// mtime out from under the markStateRead() snapshot below — any test that
// calls getNextTask() before a mutating call would then spuriously trip the
// freshness guard (STATE DRIFT) on a file nothing actually changed.
//
// Lane-local-ledger re-baseline (e125a, qa-owned, spec AC13 "Test impact";
// review_reports/review_T-E125A-05.md "Expected-Red Sampling"): a workspace
// fixture stamped `CURRENT_VERSIONS.tasks` (now 2) at the workspace ROOT is
// no longer an unmigrated ledger — v2 at a legacy path IS the root "index"
// shape, so tw_* would now throw TASKS_LEDGER_ABSENT (AC6b) instead of
// reading it. This file's fixtures are about void semantics, not migration
// mechanics (that has its own dedicated coverage in
// test/e125a-lane-local-ledgers.test.mjs), so the reviewer's suggested
// re-baseline is taken here: seed the lane-local ledger DIRECTLY at
// `.current/_primary/tasks.md` (no .git in these fixtures ⇒
// resolveCurrentLane === PRIMARY_LANE) — the exact file tw_* now reads and
// writes (spec AC9) — rather than a root file that must first migrate.
function laneTasksPath(ws) {
  return path.join(ws, ".current", "_primary", "tasks.md");
}

function mkWorkspaceWithTasks(taskBody) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twvoid-"));
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n${taskBody}`);
  resetSession(ws);
  markStateRead(ws);
  return ws;
}

function readTasks(ws) {
  return fs.readFileSync(laneTasksPath(ws), "utf-8");
}

function writeConfig(ws, config) {
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), JSON.stringify(config), "utf-8");
}

/**
 * Seed a divergent ledger AFTER markStateRead has already snapshotted
 * tasks.md — this is the exact divergence shape C1 targets: handoff says a
 * task is done while the tasks.md checkbox still reads `[ ]`. Only touches
 * handoff.md; the tasks-freshness snapshot taken by mkWorkspaceWithTasks is
 * untouched.
 */
async function seedLedgerCompleted(ws, completedTasks) {
  await writeHandoffState(ws, "e117-void-task-test", "In_Progress", completedTasks, [], undefined, "pm", 0);
}

// ---------------------------------------------------------------------------
// SQLite-mode helpers (mirrors test/reviewer-completed-tasks-gate.test.mjs)
// ---------------------------------------------------------------------------

const sqliteTest = (name, fn) =>
  SqliteHandoffStorage ? test(name, fn) : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "twvoid-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

// ===========================================================================
// Section 0 — basic contract (file mode)
// ===========================================================================

test("void marks an incomplete row as voided and returns success", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first task\n`);
  const result = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(result.success, true);
  assert.equal(result.taskId, "T-A");
  assert.equal(result.marked, "voided");
  assert.equal(result.reason, "mis-cut");
  assert.match(readTasks(ws), /- \[-\] T-A first task \(voided: mis-cut\)/);
});

test("void on an unknown task id returns a plain not-found error", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first task\n`);
  const result = JSON.parse(await voidTask(ws, "T-ZZZ", "no such row"));
  assert.match(result.error, /T-ZZZ not found/);
  assert.equal(result.alreadyVoided, undefined);
});

test("void on an already-completed [x] row is refused", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [x] T-A done already\n`);
  const result = JSON.parse(await voidTask(ws, "T-A", "trying to erase history"));
  assert.match(result.error, /already completed/);
  assert.match(readTasks(ws), /- \[x\] T-A done already/, "the completed row must be untouched");
});

test("void is not complete: completeTask on a voided id reports not-found, not success", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first task\n`);
  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);
  const attempt = JSON.parse(await completeTask(ws, "T-A", "sneaking it through as done"));
  assert.match(attempt.error, /T-A not found/);
});

test("void is not rollback: rollbackTask on a voided id reports not-found, not success", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first task\n`);
  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);
  const attempt = JSON.parse(await rollbackTask(ws, "T-A", "trying to resurrect via rollback"));
  assert.match(attempt.error, /T-A not found/);
});

test("E120: a re-cut of a voided id is REFUSED via addTask — reverses the old id-reuse contract this test used to assert", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first task\n`);
  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);

  const readded = JSON.parse(await addTask(ws, "T-A", "entirely different work", "P"));
  // THE TRAP this test used to fall into (before re-cuts were refused, E120): `success: true` here
  // was the recorded defect, not a passing contract — a re-cut silently
  // inherited the voided incarnation's review/QA evidence. Assert the
  // refusal positively, not just "not success".
  assert.equal(readded.success, undefined, "a re-cut of a voided id must not succeed");
  assert.equal(readded.voided, true, "the refusal must carry voided:true");
  assert.match(readded.error, /previously voided/);

  // The void marker must be the only trace of T-A on disk — no live re-cut
  // row was planted alongside it.
  assert.match(readTasks(ws), /- \[-\] T-A first task \(voided: mis-cut\)/);
  assert.equal(
    (readTasks(ws).match(/^- \[ \] T-A\b/m) || null),
    null,
    "no live re-cut row for T-A may coexist with the void marker",
  );

  // With no other task, nothing is left to offer.
  const next = JSON.parse(getNextTask(ws));
  assert.equal(next.allComplete, true);
  assert.equal(next.totalTasks, 0, "the voided-only row must not be counted as a task at all");
});

// ===========================================================================
// Section 1 — a voided row is never offered again (E112 acceptance point)
// ===========================================================================

test("E112 (file mode): getNextTask skips a voided row and progress.total drops", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n- [ ] T-C third\n`);
  const before = JSON.parse(getNextTask(ws));
  assert.equal(before.next.id, "T-A");
  assert.equal(before.progress.total, 3);

  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);

  const after = JSON.parse(getNextTask(ws));
  assert.equal(after.next.id, "T-B", "the voided row must never be offered again");
  assert.equal(after.progress.total, 2, "a voided row must not be counted at all, not even as incomplete");
});

sqliteTest("E112 (SQLite mode): getNextTask skips a voided row and progress.total drops", async () => {
  const { dir, dbPath } = mkSqliteWorkspace();
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    await storage.addTask(dir, "T-A", "first", "P");
    await storage.addTask(dir, "T-B", "second", "P");
    await storage.addTask(dir, "T-C", "third", "P");

    const before = JSON.parse(storage.getNextTask(dir));
    assert.equal(before.next.id, "T-A");
    assert.equal(before.progress.total, 3);

    const voided = JSON.parse(await storage.voidTask(dir, "T-A", "mis-cut"));
    assert.equal(voided.success, true);

    const after = JSON.parse(storage.getNextTask(dir));
    assert.equal(after.next.id, "T-B");
    assert.equal(after.progress.total, 2);
    assert.equal(storage.listTasks(dir).some((t) => t.id === "T-A"), false, "voided row must be gone from listTasks");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Section 2 — C1: the completion guard reads the AUTHORITATIVE ledger
// (handoff.completed_tasks), not just the tasks.md mirror checkbox.
// ===========================================================================

test("C1 (file mode): a task the ledger considers complete cannot be voided, even while its tasks.md checkbox still reads [ ]", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  // The divergence tw_sync exists to repair: ledger ahead of the
  // tasks.md mirror. Written AFTER markStateRead so the tasks-freshness
  // snapshot (unrelated file) is untouched.
  await seedLedgerCompleted(ws, ["T-B"]);

  const result = JSON.parse(await voidTask(ws, "T-B", "PM decided this row was a mis-cut"));
  assert.match(
    result.error,
    /already completed/,
    "the guard must consult handoff.completed_tasks, not just the tasks.md checkbox",
  );
  assert.match(readTasks(ws), /- \[ \] T-B second/, "the divergent row must be left exactly as it was");
});

test("C1 (file mode) positive control: a task NOT in the ledger and unchecked can still be voided", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  await seedLedgerCompleted(ws, ["T-B"]);

  const result = JSON.parse(await voidTask(ws, "T-A", "genuinely unrelated mis-cut"));
  assert.equal(result.success, true, "the guard must not over-refuse tasks the ledger has nothing to say about");
});

sqliteTest("C1 (SQLite mode): a task the ledger considers complete cannot be voided, even while the tasks-table row is completed=0", async () => {
  const { dir, dbPath } = mkSqliteWorkspace();
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    await storage.addTask(dir, "T-B", "second task", "P");
    // Ledger says done; the tasks TABLE's own completed flag is still 0 —
    // the same divergence as the file-mode C1 repro, expressed in SQLite.
    await storage.writeState({
      workspacePath: dir,
      activeFeature: "e117-void-task-sql",
      status: "In_Progress",
      completedTasks: ["T-B"],
      pendingNotes: ["seed"],
      lastAgent: "pm",
    });

    const result = JSON.parse(await storage.voidTask(dir, "T-B", "PM decided this row was a mis-cut"));
    assert.match(result.error, /already completed/);
    assert.equal(storage.listTasks(dir).some((t) => t.id === "T-B"), true, "the divergent row must not be deleted");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Section 3 — C2/C5: post-write invariant. A void must never report success
// while leaving the row live — checked against the REAL written content, not
// a hand-rebuilt string. Both vectors below must refuse loudly AND leave
// tasks.md byte-for-byte untouched (atomicWrite always prepends the
// schema_version sentinel, so a refused write leaves no sentinel behind —
// the reviewer's own signal for "nothing was written").
// ===========================================================================

test("C2: a custom taskPattern under which the voided marker still parses as a task is refused, file untouched", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  // A permissive checkmark class that also matches the void marker char "-".
  writeConfig(ws, { schema_version: 1, taskPattern: "^- \\[(.)\\] (\\S+)\\s+(.+)$" });
  const before = readTasks(ws);

  const result = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.match(result.error, /Refusing to void T-A/);
  assert.equal(readTasks(ws), before, "a refused void must leave tasks.md byte-identical — atomicWrite was never reached");

  const next = JSON.parse(getNextTask(ws));
  assert.equal(next.next.id, "T-A", "the task must still be offered — the void did not happen");
});

test("C5: a reason containing a newline that would plant a live task line is refused, file untouched", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  const before = readTasks(ws);

  const result = JSON.parse(await voidTask(ws, "T-A", "oops\n- [ ] T-A resurrected task"));
  assert.match(result.error, /Refusing to void T-A/);
  assert.equal(readTasks(ws), before, "a refused void must leave tasks.md byte-identical");

  const next = JSON.parse(getNextTask(ws));
  assert.equal(next.next.id, "T-A", "the task must still be offered — the void did not happen");
  assert.equal(next.progress.total, 2, "no extra row must have been planted");
});

test("C5 compound: a newline PLUS a $&-expansion reason (reconstructing the row verbatim) is still refused, file untouched", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const before = readTasks(ws);

  const result = JSON.parse(await voidTask(ws, "T-A", "a\n$&"));
  assert.match(result.error, /Refusing to void T-A/);
  assert.equal(readTasks(ws), before, "the compound escape must not slip past the post-write check");
});

test("void with a benign reason (no newline, no $-expansion) succeeds normally under the default pattern", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const result = JSON.parse(await voidTask(ws, "T-A", "plain, harmless reason"));
  assert.equal(result.success, true, "the post-write guard must not over-refuse ordinary reasons");
});

// ===========================================================================
// Section 4 — Q1: file mode distinguishes already-voided from never-existed;
// SQLite mode reports both cases as a uniform not-found. Pinned so the
// asymmetry can't drift silently in either direction.
// ===========================================================================

test("Q1 (file mode): re-voiding an already-voided id is refused with alreadyVoided:true", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const first = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(first.success, true);

  const second = JSON.parse(await voidTask(ws, "T-A", "voiding it again"));
  assert.match(second.error, /already voided/);
  assert.equal(second.alreadyVoided, true);
});

test("Q1 (file mode): a never-existed id is refused WITHOUT alreadyVoided", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const result = JSON.parse(await voidTask(ws, "T-NOPE", "typo'd id"));
  assert.match(result.error, /T-NOPE not found/);
  assert.equal(result.alreadyVoided, undefined);
});

sqliteTest("E120/Q1 (SQLite mode): re-void now reports alreadyVoided:true; never-existed stays a distinct plain not-found", async () => {
  const { dir, dbPath } = mkSqliteWorkspace();
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    await storage.addTask(dir, "T-A", "first", "P");
    const first = JSON.parse(await storage.voidTask(dir, "T-A", "mis-cut"));
    assert.equal(first.success, true);

    // THE TRAP this test used to fall into (before re-cuts were refused, E120):
    // "uniform not-found, neither carries alreadyVoided" was a recorded gap
    // (finding C3) this test used to pin as correct — SQLite's DELETE
    // discarded the voided state, so it could not tell already-voided from
    // never-existed apart. The voided_tasks tombstone
    // (tools/storage-sqlite.ts) now survives the DELETE precisely so
    // addTask/voidTask CAN refuse against it, giving SQLite the same
    // already-voided vs never-existed distinction file mode already had (Q1).
    const reVoid = JSON.parse(await storage.voidTask(dir, "T-A", "again"));
    assert.match(reVoid.error, /already voided/);
    assert.equal(
      reVoid.alreadyVoided,
      true,
      "the tombstone must let SQLite distinguish already-voided from never-existed now",
    );

    const neverExisted = JSON.parse(await storage.voidTask(dir, "T-ZZZ", "typo"));
    assert.match(neverExisted.error, /T-ZZZ not found/);
    assert.equal(neverExisted.alreadyVoided, undefined, "a never-existed id must not falsely claim alreadyVoided");
    assert.notEqual(
      reVoid.error,
      neverExisted.error,
      "already-voided and never-existed must now be textually DISTINCT (the opposite of the old uniform-not-found contract)",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Section 5 — invisibility to parseTasksFromFile / tw_detect_drift / tw_sync.
// No vibe drift, no sync promotion, and — the exact regression the C1 fix
// exists to prevent — a REFUSED void of a ledger-complete task must not
// erase a pre-existing, legitimate drift signal.
// ===========================================================================

test("a voided row (not in the ledger) never surfaces as drift and is excluded from tasksIncomplete", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  await seedLedgerCompleted(ws, []);

  const before = JSON.parse(detectDrift(ws));
  assert.equal(before.driftDetected, false);

  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);

  const after = JSON.parse(detectDrift(ws));
  assert.equal(after.driftDetected, false, "voiding an uninvolved row must not manufacture drift");
  assert.ok(!after.tasksIncomplete.includes("T-A"), "a voided row must not appear in tasksIncomplete");
});

test("REGRESSION (the original C1 bug): a REFUSED void of a ledger-complete task must not erase the pre-existing drift signal", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  await seedLedgerCompleted(ws, ["T-B"]);

  const before = JSON.parse(detectDrift(ws));
  assert.equal(before.driftDetected, true);
  assert.ok(before.details.some((d) => d.includes("T-B")), "the divergence must be visible before the void attempt");

  const attempt = JSON.parse(await voidTask(ws, "T-B", "trying to make the drift go away"));
  assert.match(attempt.error, /already completed/, "the void must be refused, not silently succeed");

  const after = JSON.parse(detectDrift(ws));
  assert.equal(after.driftDetected, true, "the drift signal must survive the refused void attempt");
  assert.ok(
    after.details.some((d) => d.includes("T-B")),
    "T-B's divergence must still be reported — this is exactly what round-1 code review found broken",
  );
});

test("tw_sync (reconcileTasks) never attempts to sync or flag a voided row", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n- [ ] T-B second\n`);
  await seedLedgerCompleted(ws, []);

  const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
  assert.equal(voided.success, true);

  const report = JSON.parse(await reconcileTasks(ws));
  assert.equal(report.ok, true);
  assert.ok(!report.synced.includes("T-A"), "a voided row must never be a sync target");
  assert.ok(!report.refusedVibeDrift.includes("T-A"), "a voided row must never be reported as vibe drift either");
});

sqliteTest("SQLite: a voided row never surfaces as drift and is never a tw_sync target", async () => {
  const { dir, dbPath } = mkSqliteWorkspace();
  const previousStorage = new FileHandoffStorage();
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    setActiveStorage(storage);
    await storage.addTask(dir, "T-A", "first", "P");
    await storage.addTask(dir, "T-B", "second", "P");
    await storage.writeState({
      workspacePath: dir,
      activeFeature: "e117-void-task-sql-drift",
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: ["seed"],
      lastAgent: "pm",
    });

    const voided = JSON.parse(await storage.voidTask(dir, "T-A", "mis-cut"));
    assert.equal(voided.success, true);

    const drift = JSON.parse(detectDrift(dir));
    assert.equal(drift.driftDetected, false);
    assert.ok(!drift.tasksIncomplete.includes("T-A"));

    const report = JSON.parse(await reconcileTasks(dir));
    assert.ok(!report.synced.includes("T-A"));
    assert.ok(!report.refusedVibeDrift.includes("T-A"));
  } finally {
    setActiveStorage(previousStorage);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Section 6 — registry / dispatch wiring
// ===========================================================================

test("tw_void_task is registered with the expected required inputs", () => {
  const entry = TOOL_REGISTRY.find((e) => e.name === "tw_void_task");
  assert.ok(entry, "tw_void_task must be registered in TOOL_REGISTRY");
  assert.deepEqual(entry.inputSchema.required, ["workspace_path", "task_id", "reason"]);
});

test("handleVoidTask enforces the pre-flight tw_get_state gate before voiding", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  resetSession(ws); // undo the markStateRead the helper just did
  await assert.rejects(
    () => handleVoidTask({ workspace_path: ws, task_id: "T-A", reason: "mis-cut" }),
    /BLOCKED.*tw_void_task/s,
  );
});

test("handleVoidTask dispatches through to the real void once pre-flight is satisfied", async () => {
  const ws = mkWorkspaceWithTasks(`## P\n- [ ] T-A first\n`);
  const result = await handleVoidTask({ workspace_path: ws, task_id: "T-A", reason: "mis-cut" });
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.success, true);
  assert.match(readTasks(ws), /- \[-\] T-A first \(voided: mis-cut\)/);
});
