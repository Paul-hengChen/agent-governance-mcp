// Coded by @qa-engineer
// E359 (lane e359, specs/e359-server-core-fixes.md AC-E359-1..5). Invariant: tw_void_task's refusal
// text names the step that actually clears the state that caused it. With E150's carry-forward the
// handoff completed_tasks ledger can hold an id while the task row is open (an off-SOP rollback), and
// the old advice "roll it back first" is wrong there. The refusal predicate (row completed OR ledger
// holds the id) is unchanged; only the text varies, and file and SQLite modes must return identical text.
// AC-E359-6 is proven by running the named unmodified suites, not here.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { voidTask } from "../dist/tools/tasks.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed -- SQLite-mode e359 AC-E359-4 tests skipped");
}
const sqliteTest = (name, fn) =>
  SqliteHandoffStorage ? test(name, fn) : test(name, { skip: "better-sqlite3 not installed" }, () => {});

// Copy / Strings (spec), quoted verbatim: the contract under test.
const ROW = (id) =>
  `Task ${id} is already completed and cannot be voided — roll it back first (tw_rollback_task) if it needs to be undone.`;
const LEDGER = (id) =>
  `Task ${id} is already completed and cannot be voided — the task list shows it open, but the handoff completed_tasks ledger still records it. Have qa-engineer remove it first with a FAIL write (tw_update_state) carrying review_task_ids=[${id}]; then void it.`;
const BOTH = (id) =>
  `Task ${id} is already completed and cannot be voided — to undo it, roll it back (tw_rollback_task) and have qa-engineer remove it from the handoff completed_tasks ledger with a FAIL write (tw_update_state) carrying review_task_ids=[${id}]; then void it.`;

const F = "e359-void-probe";

function mkWs(rows) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e359-"));
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, ".current", "_primary", "tasks.md"),
    `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n## P\n${rows}`,
  );
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  return ws;
}

async function seedLedger(ws, ledger, agent = "pm") {
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: F,
    status: "In_Progress",
    completedTasks: ledger,
    pendingNotes: ["seed"],
    lastAgent: agent,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

const tasksPath = (ws) => resolveCurrentLanePaths(ws).tasksPath;
const handoffPath = (ws) => resolveCurrentLanePaths(ws).handoffPath;

async function assertRefused(ws, expected) {
  const tBefore = fs.readFileSync(tasksPath(ws), "utf-8");
  const hBefore = fs.readFileSync(handoffPath(ws), "utf-8");
  const result = JSON.parse(await voidTask(ws, "T-B", "mis-cut"));
  assert.equal(result.error, expected);
  assert.equal(result.success, undefined);
  assert.equal(fs.readFileSync(tasksPath(ws), "utf-8"), tBefore, "task list byte-unchanged");
  assert.equal(fs.readFileSync(handoffPath(ws), "utf-8"), hBefore, "handoff.md byte-unchanged");
}

test("AC-E359-1: file mode, row open + ledger holds the id (the E359 state) -> void.refused.ledger, nothing changes", async () => {
  const ws = mkWs("- [ ] T-A first\n- [ ] T-B second\n");
  await seedLedger(ws, ["T-B"]);
  await assertRefused(ws, LEDGER("T-B"));
});

test("AC-E359-2: file mode, row [x] + ledger holds the id -> void.refused.both, nothing changes", async () => {
  const ws = mkWs("- [ ] T-A first\n- [x] T-B second\n");
  await seedLedger(ws, ["T-B"]);
  await assertRefused(ws, BOTH("T-B"));
});

test("AC-E359-3: file mode, row [x] + ledger does not hold the id -> void.refused.row (today's text, byte-identical)", async () => {
  const ws = mkWs("- [ ] T-A first\n- [x] T-B second\n");
  await seedLedger(ws, []);
  await assertRefused(ws, ROW("T-B"));
});

test("AC-E359-3 (no handoff at all): row [x] only still yields void.refused.row", async () => {
  const ws = mkWs("- [x] T-B second\n");
  const result = JSON.parse(await voidTask(ws, "T-B", "mis-cut"));
  assert.equal(result.error, ROW("T-B"));
});

test("AC-E359-1/2/3 boundary: a ledger holding only a prefix-similar id (T-B2) does not trigger the ledger text for T-B", async () => {
  const ws = mkWs("- [ ] T-B second\n");
  await seedLedger(ws, ["T-B2"]);
  const result = JSON.parse(await voidTask(ws, "T-B", "mis-cut"));
  assert.equal(result.success, true, "word-boundary match: T-B2 in the ledger must not block voiding T-B");
});

test("AC-E359-5: the step the ledger message names (qa FAIL write with review_task_ids) really unblocks the void", async () => {
  const ws = mkWs("- [ ] T-A first\n- [ ] T-B second\n");
  await seedLedger(ws, ["T-B"], "qa-engineer");
  const refused = JSON.parse(await voidTask(ws, "T-B", "mis-cut"));
  assert.equal(refused.error, LEDGER("T-B"));

  const fail = await handleUpdateState({
    workspace_path: ws,
    active_feature: F,
    status: "FAIL",
    agent_id: "qa-engineer",
    review_task_ids: ["T-B"],
    qa_review: "FAIL T-B: row rolled back off-SOP",
    blocking_reason: "QA: T-B FAIL",
    pending_notes: ["QA: T-B FAIL"],
  });
  assert.ok(!fail.isError, fail.content?.[0]?.text);
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "FAIL write removed T-B from the ledger");

  const voided = JSON.parse(await voidTask(ws, "T-B", "mis-cut"));
  assert.equal(voided.success, true);
  assert.match(fs.readFileSync(tasksPath(ws), "utf-8"), /- \[-\] T-B second \(voided: mis-cut\)/);
});

// ---------------------------------------------------------------------------
// AC-E359-4: SQLite returns the same bytes for the same three states and never deletes the row.
// ---------------------------------------------------------------------------
async function sqliteCase({ rowDone, ledger, expected }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e359-sql-"));
  try {
    const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
    await storage.addTask(dir, "T-B", "second", "P");
    await storage.writeState({
      workspacePath: dir,
      activeFeature: F,
      status: "In_Progress",
      completedTasks: ledger,
      pendingNotes: ["seed"],
      lastAgent: "pm",
    });
    if (rowDone) await storage.completeTask(dir, "T-B");
    const result = JSON.parse(await storage.voidTask(dir, "T-B", "mis-cut"));
    assert.equal(result.error, expected);
    assert.equal(result.success, undefined);
    assert.equal(storage.listTasks(dir).some((t) => t.id === "T-B"), true, "the tasks row is not deleted");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

sqliteTest("AC-E359-4 (SQLite): row completed=0 + ledger holds id -> void.refused.ledger", () =>
  sqliteCase({ rowDone: false, ledger: ["T-B"], expected: LEDGER("T-B") }));
sqliteTest("AC-E359-4 (SQLite): row completed=1 + ledger holds id -> void.refused.both", () =>
  sqliteCase({ rowDone: true, ledger: ["T-B"], expected: BOTH("T-B") }));
sqliteTest("AC-E359-4 (SQLite): row completed=1 + ledger empty -> void.refused.row", () =>
  sqliteCase({ rowDone: true, ledger: [], expected: ROW("T-B") }));
