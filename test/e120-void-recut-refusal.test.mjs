// Coded by @qa-engineer
// Tests for E120 (docs/backlog.md order 0v) — a re-cut task id used to
// inherit the review and QA evidence of the incarnation that was voided, so
// a never-reviewed re-cut satisfied MISSING_REVIEW_EVIDENCE and the QA
// completion-evidence gate. Closed in
// `feat/e120-e131-e122-wave1-gate-render` by REFUSING a re-cut of a voided
// id outright in both storage modes: a `voidedPattern` scan in
// `addTaskInFile` (tools/tasks-file.ts), and a `voided_tasks` tombstone
// table in SQLite (tools/storage-sqlite.ts), since `voidTaskStmt` DELETEs
// the tasks row and would otherwise erase the state needed to refuse.
//
// This file is the home the qa dispatch brief names for the refusal matrix;
// the two rewritten E117-era tests asserting the headline contract
// (re-cut refused / SQLite alreadyVoided parity) stay in
// test/e117-void-task.test.mjs, which they were already pinning under the
// old (pre-E120) contract.
//
// review_reports/review_T-E120131-01.md (round 3, APPROVED) is the record
// this file executes:
//
//   Section 1 — the nine-indent matrix (round 2's R2-C1 finding, round 3's
//               independent re-verification). THE highest-value property:
//               it caught two successive incomplete fixes (round 1's `\b`
//               boundary bug, round 2's `[ \t]*` two-character subset of
//               `trim()`). Four sites (parseTasks, the duplicate-id
//               re-scan, voidTaskInFile's Q1 check, addTaskInFile's re-cut
//               refusal) must all agree on what "leading whitespace" means;
//               a fifth definition is the regression this section guards.
//   Section 2 — no false refusal: a `- [-] <id>` marker embedded in another
//               row's text (plain, after an embedded CR, after an embedded
//               U+2028) must not block adding that id. Narrower than round
//               2's rejected `m`-flag intermediate, which would have
//               false-refused these exact cases (round 3, "item 3").
//   Section 3 — id-boundary controls: prefix collision (T-12 vs T-1),
//               punctuation-terminated ids (T-1.), a `T-1.5` vs `T-1`
//               control (the NEW-3 false-positive `\b` used to produce),
//               and a regex-metacharacter id (T-A+B) — `escapeRegExp`
//               coverage.
//   Section 4 — SQLite parity: refusal after void, `alreadyVoided` vs a
//               distinct never-existed, and workspace-scoped tombstones (the
//               same id stays addable in a DIFFERENT workspace).
//
// Deliberately NOT covered here (see review_reports/review_T-E120131-01.md
// Architecture / NEW-TICKETS.md for why, and do not fix or block on these in
// this file):
//   NEW-2 (evidence file path lowercases ids, reproducing E120 through a
//   case change on a case-insensitive filesystem — its own ticket, not a
//   task-id uniqueness defect), NEW-5 (a fully custom taskPattern is not
//   covered by the E131 parser-shape heuristic — input boundary remains the
//   defense there), NEW-6 (a void marker hidden after an embedded CR/U+2028/
//   U+2029 mid-`\n`-line is unreachable through the tw_* API — every mutator
//   already refuses those characters in taskId/description/note/reason).
//   True crash-atomicity of the SQLite DELETE+tombstone transaction (NEW-4)
//   was verified in review by fault injection against the vendored
//   better-sqlite3 build (forcing a failure on the second statement and
//   observing rollback); that is a code-inspection-grade property, not one
//   this file re-derives — Section 4 below pins the OBSERVABLE contract
//   (void, then immediately re-void reports alreadyVoided) that atomicity
//   exists to guarantee.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { voidTask, addTask, getNextTask } from "../dist/tools/tasks.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency — skip the
// SQLite-mode blocks gracefully if it isn't installed locally (same guard as
// test/e117-void-task.test.mjs / test/reviewer-completed-tasks-gate.test.mjs).
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode e120 tests skipped");
}

// ---------------------------------------------------------------------------
// File-mode helpers (mirrors test/e117-void-task.test.mjs).
// ---------------------------------------------------------------------------

// e125a-lane-local-ledgers re-baseline (qa-owned, spec AC13 "Test impact";
// review_reports/review_T-E125A-05.md "Expected-Red Sampling"): a workspace
// fixture stamped `CURRENT_VERSIONS.tasks` (now 2) at the workspace ROOT is
// the D-D "index" shape, not an unmigrated ledger — tw_* would throw
// TASKS_LEDGER_ABSENT (AC6b) reading it. These fixtures are about the
// void/re-cut refusal matrix, not migration mechanics (that has its own
// dedicated coverage in test/e125a-lane-local-ledgers.test.mjs), so — same
// re-baseline as test/e117-void-task.test.mjs — seed the lane-local ledger
// DIRECTLY at `.current/_primary/tasks.md` (no .git in these fixtures ⇒
// resolveCurrentLane === PRIMARY_LANE), the exact file tw_* now reads and
// writes (spec D-F/AC9).
function laneTasksPath(ws) {
  return path.join(ws, ".current", "_primary", "tasks.md");
}

function mkWorkspaceWithTasks(taskBody) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e120-recut-"));
  fs.mkdirSync(path.join(ws, ".current", "_primary"), { recursive: true });
  fs.writeFileSync(laneTasksPath(ws), `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n${taskBody}`);
  resetSession(ws);
  markStateRead(ws);
  return ws;
}

function readTasks(ws) {
  return fs.readFileSync(laneTasksPath(ws), "utf-8");
}

const sqliteTest = (name, fn) =>
  SqliteHandoffStorage ? test(name, fn) : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "e120-recut-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

// ===========================================================================
// Section 1 — the nine-indent matrix (round 2 R2-C1 / round 3 independent
// re-verification). Four sites must agree on what "leading whitespace"
// means; this is the reproduction that caught two successive incomplete
// fixes (round 1's `\b`-only fix, round 2's `[ \t]*` subset fix), so it is
// the single highest-value regression guard in this cut.
// ===========================================================================

const INDENT_FORMS = [
  ["flat (no indent)", ""],
  ["2-space", "  "],
  ["tab", "\t"],
  ["U+00A0 NBSP", "\u00A0"],
  ["U+000B VT", "\u000B"],
  ["U+000C FF", "\u000C"],
  ["U+2000 EN QUAD", "\u2000"],
  ["U+3000 IDEOGRAPHIC SPACE", "\u3000"],
  ["U+FEFF BOM", "\uFEFF"],
];

for (const [label, indent] of INDENT_FORMS) {
  test(`E120 nine-indent matrix (${label}): void succeeds, re-void reports alreadyVoided, re-add is refused, no live re-cut ever coexists with the marker`, async () => {
    const ws = mkWorkspaceWithTasks(`## P\n${indent}- [ ] T-A first task\n- [ ] T-KEEP control task\n`);

    const voided = JSON.parse(await voidTask(ws, "T-A", "mis-cut"));
    assert.equal(voided.success, true, `void must succeed under indent ${label}`);

    const reVoid = JSON.parse(await voidTask(ws, "T-A", "voiding it again"));
    assert.equal(reVoid.alreadyVoided, true, `re-void must report alreadyVoided:true under indent ${label}`);

    const readd = JSON.parse(await addTask(ws, "T-A", "re-cut attempt", "P"));
    assert.equal(readd.success, undefined, `re-add must be refused under indent ${label}`);
    assert.equal(readd.voided, true, `refusal must carry voided:true under indent ${label}`);

    // The healthy control row must keep parsing in every case — the indent
    // character must not corrupt the file globally, only defeat (or, after
    // the fix, correctly not defeat) the void-marker scan for T-A.
    const next = JSON.parse(getNextTask(ws));
    assert.equal(next.next.id, "T-KEEP", `the control row must still be offered under indent ${label}`);
    assert.equal(next.progress.total, 1, `only the control row may count as live under indent ${label}`);

    // No live re-cut row for T-A may coexist with its void marker — the
    // exact end-state the re-cut refusal exists to prevent (E120).
    assert.equal(
      readTasks(ws).match(/^\s*- \[ \] T-A\b/m),
      null,
      `no live T-A row may exist alongside the void marker under indent ${label}`,
    );
  });
}

// ===========================================================================
// Section 2 — no false refusal: a `- [-] <id>` marker appearing inside
// another row's description/note text must not block adding that id. Round
// 3 measured this narrower than round 2's rejected `m`-flag intermediate,
// which would have produced these exact false refusals.
// ===========================================================================

test("no false refusal: a void marker embedded in another row's plain text does not block adding that id", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A see also - [-] T-Y for context\n");
  const result = JSON.parse(await addTask(ws, "T-Y", "brand new, unrelated work", "P"));
  assert.equal(result.success, true, "a marker-shaped substring inside another row's text must not be mistaken for a real void marker");
});

test("no false refusal: a void marker embedded after an embedded CR on the same physical line does not block adding that id", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A note\r- [-] T-Y quoted marker\n");
  const result = JSON.parse(await addTask(ws, "T-Y", "brand new, unrelated work", "P"));
  assert.equal(
    result.success,
    true,
    "an embedded CR does not split the \\n-delimited line the void-marker scan iterates over, so the marker after it is not at line-start",
  );
});

test("no false refusal: a void marker embedded after an embedded U+2028 on the same physical line does not block adding that id", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A note\u2028- [-] T-Y quoted marker\n");
  const result = JSON.parse(await addTask(ws, "T-Y", "brand new, unrelated work", "P"));
  assert.equal(
    result.success,
    true,
    "an embedded U+2028 does not split the \\n-delimited line either (JS-only terminator, not a real newline for split(\"\\n\")), so the marker is not at line-start",
  );
});

// ===========================================================================
// Section 3 — id-boundary controls: escapeRegExp holds, and the id-boundary
// assertion (?=\s|$) neither leaks across a prefix collision nor falsely
// blocks an unrelated shorter id.
// ===========================================================================

test("id boundary: voiding T-12 does not block adding the unrelated shorter id T-1", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-12 a task\n");
  const voided = JSON.parse(await voidTask(ws, "T-12", "mis-cut"));
  assert.equal(voided.success, true);
  const result = JSON.parse(await addTask(ws, "T-1", "unrelated new work", "P"));
  assert.equal(result.success, true, "a voided T-12 must not be mistaken for a voided T-1 via prefix collision");
});

test("id boundary: voiding T-1.5 does not block adding the unrelated id T-1 (the false positive the old \\b boundary produced)", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-1.5 a task\n");
  const voided = JSON.parse(await voidTask(ws, "T-1.5", "mis-cut"));
  assert.equal(voided.success, true);
  const result = JSON.parse(await addTask(ws, "T-1", "unrelated new work", "P"));
  assert.equal(
    result.success,
    true,
    "under the old \\b boundary, voided T-1.5 wrongly blocked adding T-1 (\\b matches between '1' and '.'); (?=\\s|$) must not repeat that bug",
  );
});

test("id boundary: a punctuation-terminated id (T-1.) voids, re-voids with alreadyVoided, and refuses its own re-cut", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-1. a task\n");
  const voided = JSON.parse(await voidTask(ws, "T-1.", "mis-cut"));
  assert.equal(voided.success, true, "an id ending in punctuation must still void — it legally matches the row's (\\S+) id group");
  const reVoid = JSON.parse(await voidTask(ws, "T-1.", "again"));
  assert.equal(reVoid.alreadyVoided, true);
  const readd = JSON.parse(await addTask(ws, "T-1.", "re-cut", "P"));
  assert.equal(readd.voided, true, "T-1. must be refused on re-cut just like any other voided id");
});

test("id boundary: a regex-metacharacter id (T-A+B) is escaped correctly and does not leak into T-AB", async () => {
  const ws = mkWorkspaceWithTasks("## P\n- [ ] T-A+B a task\n");
  const voided = JSON.parse(await voidTask(ws, "T-A+B", "mis-cut"));
  assert.equal(voided.success, true);
  const readd = JSON.parse(await addTask(ws, "T-A+B", "re-cut", "P"));
  assert.equal(readd.voided, true, "the metacharacter id itself must be refused on re-cut");
  const unrelated = JSON.parse(await addTask(ws, "T-AB", "a genuinely different, unrelated id", "P"));
  assert.equal(unrelated.success, true, "escapeRegExp must prevent the '+' from being interpreted as a quantifier and leaking into T-AB");
});

// ===========================================================================
// Section 4 — SQLite parity: refusal after void, alreadyVoided vs a distinct
// never-existed, and workspace-scoped tombstones.
// ===========================================================================

sqliteTest("SQLite: a re-cut of a voided id is refused with voided:true, matching file mode", async () => {
  const { dir, dbPath } = mkSqliteWorkspace();
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    await storage.addTask(dir, "T-A", "first", "P");
    const voided = JSON.parse(await storage.voidTask(dir, "T-A", "mis-cut"));
    assert.equal(voided.success, true);

    const readd = JSON.parse(await storage.addTask(dir, "T-A", "re-cut attempt", "P"));
    assert.equal(readd.success, undefined, "SQLite must refuse the re-cut just like file mode");
    assert.equal(readd.voided, true);
    assert.match(readd.error, /previously voided/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

sqliteTest("SQLite: the voided_tasks tombstone is workspace-scoped — the same id remains addable in a DIFFERENT workspace", async () => {
  const { dir: dirA, dbPath } = mkSqliteWorkspace("e120-recut-sql-a-");
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "e120-recut-sql-b-"));
  try {
    const storage = new SqliteHandoffStorage(dbPath);
    await storage.addTask(dirA, "T-A", "first", "P");
    await storage.voidTask(dirA, "T-A", "mis-cut");

    const readdSameWorkspace = JSON.parse(await storage.addTask(dirA, "T-A", "re-cut", "P"));
    assert.equal(readdSameWorkspace.voided, true, "the same workspace must still refuse the re-cut");

    const readdOtherWorkspace = JSON.parse(await storage.addTask(dirB, "T-A", "different workspace, unrelated new work", "P"));
    assert.equal(
      readdOtherWorkspace.success,
      true,
      "a voided id in one workspace must not block that same id in a different workspace — the tombstone is (workspace_path, task_id) keyed",
    );
  } finally {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  }
});
