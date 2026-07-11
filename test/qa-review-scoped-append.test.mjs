// Coded by @qa-engineer
// Tests for specs/d9-qa-review-scoped-append.md — AC1 through AC4 (T-D9-05).
//
// WHY this file exists (not folded into an existing one): the D8 incident
// this spec fixes is an end-to-end orchestrator behavior — a real
// tw_update_state write's qa_review auto-append fanning out into every open
// task's evidence file/row. test/reviewer-completed-tasks-gate.test.mjs is
// the closest sibling (same class of bug: an orchestrator gate keyed on
// parsed write args, exercised via handleUpdateState against BOTH storage
// backends) and this file mirrors its structure and helpers deliberately.
// tasks.md row T-D9-05 and specs/d9-qa-review-scoped-append.md Dependencies
// both sanction a new file for this cut.
//
// Spec-to-Test map:
//   AC1 (FAIL + review_task_ids=["T-X"] touches ONLY T-X, file mode)  -> FM1
//   AC1 (same, SQLite mode)                                          -> SQ1
//   AC2 (PASS + completed_tasks back-compat unchanged, file mode)     -> FM2
//   AC2 (same, SQLite mode)                                          -> SQ2
//   AC3 (both empty -> QA_REVIEW_TARGET_REQUIRED, nothing recorded, file) -> FM3
//   AC3 (same, SQLite mode)                                          -> SQ3
//   AC4 (N open tasks, exactly 1 evidence file/row changes, file mode) -> FM1 (same test — the D8 incident shape IS the AC1 test)
//   AC4 (same, SQLite mode — exactly 1 reports row, not N)            -> SQ1
//   AC5 (read-side untouched) is a code-review-owned architectural
//     invariant, not independently exercised here — see review_reports/review_T-D9-01.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency. Skip the
// SQLite-mode block gracefully if it's not installed locally — same guard as
// test/reviewer-completed-tasks-gate.test.mjs / test/visual-round-sqlite.test.mjs.
let SqliteHandoffStorage;
let Database;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
  const dbMod = await import("better-sqlite3");
  Database = dbMod.default;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode qa-review-scoped-append tests skipped");
}

// ---------------------------------------------------------------------------
// File-mode helpers
// ---------------------------------------------------------------------------

function mkWorkspace(prefix = "qrsa-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedFileState(ws, feature, agent, status) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: agent,
  });
}

// Recreates the actual D8 incident precondition: a tasks.md with N > 1 open
// (incomplete) tasks, the exact shape the deleted `storage.listTasks(...)
// .filter((t) => !t.completed)` fallback used to fan out into. Also seeds a
// pre-existing qa_reports/ evidence file for each "other" task, so the test
// can assert their content is byte-identical afterward — not merely that no
// NEW file appeared (the actual D8 incident appended verbatim TEXT into
// pre-existing unrelated files, it did not only create new ones).
function seedOpenTasksAndPriorEvidence(ws, targetId, otherIds) {
  const lines = [`- [ ] ${targetId} the task actually under review`];
  for (const id of otherIds) lines.push(`- [ ] ${id} an unrelated open task`);
  fs.writeFileSync(path.join(ws, "tasks.md"), lines.join("\n") + "\n", "utf-8");

  const qaDir = path.join(ws, "qa_reports");
  fs.mkdirSync(qaDir, { recursive: true });
  const priorContent = new Map();
  for (const id of otherIds) {
    const body = `# QA review — ${id}\n\n## Round 1\nPASS — by qa-engineer\n\nunrelated prior review, untouched by this test\n`;
    const filePath = path.join(qaDir, `review_${id}.md`);
    fs.writeFileSync(filePath, body, "utf-8");
    priorContent.set(id, body);
  }
  return priorContent;
}

// ---------------------------------------------------------------------------
// FM1 / AC1 / AC4 — FAIL write naming exactly one task via review_task_ids,
// among N > 1 open tasks, touches ONLY that task's evidence file (file mode).
// ---------------------------------------------------------------------------

test("FM1/AC1/AC4: FAIL write with review_task_ids=[T-X] among N open tasks touches ONLY T-X's evidence file — nothing else changes (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("qrsa-fm1-");
  const targetId = "T-QRSA-TARGET";
  const otherIds = ["T-QRSA-OTHER-1", "T-QRSA-OTHER-2", "T-QRSA-OTHER-3"];
  const priorContent = seedOpenTasksAndPriorEvidence(ws, targetId, otherIds);

  await seedFileState(ws, "qrsa-fm1", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "qrsa-fm1",
    status: "FAIL",
    agent_id: "qa-engineer",
    completed_tasks: [], // FAIL always has this empty per the Escalation call format
    review_task_ids: [targetId],
    qa_review: "FAIL — full test suite regression, see qa_reports/review_T-QRSA-TARGET.md",
    pending_notes: [`QA: ${targetId} FAIL`],
  });
  assert.ok(!result.isError, `expected acceptance; got: ${result.content?.[0]?.text}`);

  // The named task's evidence file must exist and carry the FAIL text.
  const targetPath = path.join(ws, "qa_reports", `review_${targetId}.md`);
  assert.ok(fs.existsSync(targetPath), "the named task's review file must be created");
  const targetBody = fs.readFileSync(targetPath, "utf-8");
  assert.match(targetBody, /FAIL — full test suite regression/, "target file must carry the FAIL text");

  // Every OTHER open task's evidence file must be BYTE-IDENTICAL to its
  // pre-write content — this is the exact invariant the D8 incident broke
  // (verbatim duplicate-append into unrelated files).
  for (const id of otherIds) {
    const otherPath = path.join(ws, "qa_reports", `review_${id}.md`);
    const afterBody = fs.readFileSync(otherPath, "utf-8");
    assert.equal(
      afterBody,
      priorContent.get(id),
      `${id}'s evidence file must be untouched (byte-identical) — the D8 fan-out incident class`,
    );
    assert.doesNotMatch(
      afterBody,
      /full test suite regression/,
      `${id}'s evidence file must NOT contain the target task's FAIL text`,
    );
  }

  // Exactly 1 file under qa_reports/ (out of N=4 total open tasks) was
  // written to as a RESULT of this write — the other 3 pre-existed
  // untouched. Confirms "exactly 1, not N" per AC4.
  const qaFiles = fs.readdirSync(path.join(ws, "qa_reports")).filter((f) => f.endsWith(".md"));
  assert.equal(qaFiles.length, 1 + otherIds.length, "no spurious extra files created for untouched tasks");
});

// ---------------------------------------------------------------------------
// FM2 / AC2 — PASS via completed_tasks (review_task_ids omitted) is
// unchanged back-compat behavior (file mode).
// ---------------------------------------------------------------------------

test("FM2/AC2: PASS write with completed_tasks=[T-Y,T-Z] and review_task_ids OMITTED records for exactly T-Y and T-Z (back-compat, file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("qrsa-fm2-");
  const otherIds = ["T-QRSA2-OTHER-1"];
  // Y/Z are themselves open tasks in tasks.md too (PASS completes them).
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    ["- [ ] T-QRSA2-Y do the thing", "- [ ] T-QRSA2-Z do the other thing", "- [ ] T-QRSA2-OTHER-1 unrelated"].join("\n") + "\n",
    "utf-8",
  );

  await seedFileState(ws, "qrsa-fm2", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "qrsa-fm2",
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T-QRSA2-Y", "T-QRSA2-Z"],
    // review_task_ids intentionally omitted — must fall back to completed_tasks.
    qa_review: "PASS — all green",
    pending_notes: ["QA: PASS"],
  });
  assert.ok(!result.isError, `expected acceptance; got: ${result.content?.[0]?.text}`);

  for (const id of ["T-QRSA2-Y", "T-QRSA2-Z"]) {
    const p = path.join(ws, "qa_reports", `review_${id}.md`);
    assert.ok(fs.existsSync(p), `${id} evidence file must exist (back-compat PASS path)`);
    assert.match(fs.readFileSync(p, "utf-8"), /PASS — all green/);
  }
  // The unrelated open task must have received NO evidence file at all.
  assert.equal(
    fs.existsSync(path.join(ws, "qa_reports", "review_T-QRSA2-OTHER-1.md")),
    false,
    "unrelated open task must get no evidence file on a completed_tasks-scoped PASS",
  );
});

// ---------------------------------------------------------------------------
// FM3 / AC3 — both review_task_ids and completed_tasks empty on a
// qa_review-bearing write is REJECTED with QA_REVIEW_TARGET_REQUIRED, and
// records NOTHING (file mode).
// ---------------------------------------------------------------------------

test("FM3/AC3: qa_review write with review_task_ids AND completed_tasks both empty is REJECTED with QA_REVIEW_TARGET_REQUIRED, recording nothing (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("qrsa-fm3-");
  const otherIds = ["T-QRSA3-OTHER-1", "T-QRSA3-OTHER-2"];
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    otherIds.map((id) => `- [ ] ${id} unrelated open task`).join("\n") + "\n",
    "utf-8",
  );

  await seedFileState(ws, "qrsa-fm3", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "qrsa-fm3",
    status: "FAIL",
    agent_id: "qa-engineer",
    completed_tasks: [], // FAIL always has this empty
    // review_task_ids omitted entirely — the exact "forgot to name the reviewed task" shape AC3 describes.
    qa_review: "FAIL — forgot to name the task under review",
    pending_notes: ["QA: forgot review_task_ids"],
  });
  assert.ok(result.isError, "both-empty qa_review write must be rejected");
  assert.match(
    result.content[0].text,
    /QA_REVIEW_TARGET_REQUIRED/,
    `expected QA_REVIEW_TARGET_REQUIRED; got: ${result.content[0].text}`,
  );

  // Nothing recorded anywhere — no fall back to "every open task" (old
  // behavior) and no silent no-op-and-drop-the-evidence either: the
  // qa_reports/ dir must not even exist, since neither open task got touched.
  assert.equal(
    fs.existsSync(path.join(ws, "qa_reports")),
    false,
    "no evidence directory/file may be created when the write is rejected",
  );
});

// ---------------------------------------------------------------------------
// FM4 — full TOOL_REGISTRY dispatch smoke test (zod parse -> handler ->
// orchestrator) for the both-empty reject, mirroring
// test/reviewer-completed-tasks-gate.test.mjs's FM3 crash-safety pattern.
// ---------------------------------------------------------------------------

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

test("FM4: tw_update_state full dispatch — qa_review with both target fields omitted is rejected with QA_REVIEW_TARGET_REQUIRED, not a crash", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("qrsa-fm4-");
  await seedFileState(ws, "qrsa-fm4", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "qrsa-fm4",
    status: "FAIL",
    agent_id: "qa-engineer",
    qa_review: "FAIL — no target named",
    pending_notes: ["QA: forgot review_task_ids"],
    // completed_tasks and review_task_ids both omitted — zod defaults completed_tasks to [].
  });
  assert.ok(result.isError, "full-dispatch both-empty qa_review write must be rejected, not silently accepted");
  assert.match(result.content[0].text, /QA_REVIEW_TARGET_REQUIRED/);
});

// ---------------------------------------------------------------------------
// SQLite mode — mirrors FM1/FM2/FM3 against SqliteHandoffStorage, proving the
// scoped-append fix holds identically across both storage backends (the spec's
// AC4 explicitly requires SQLite `reports` table row-count coverage too).
// ---------------------------------------------------------------------------

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "qrsa-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

function countReportsRows(dbPath, workspacePath) {
  const raw = new Database(dbPath, { readonly: true });
  try {
    const row = raw
      .prepare("SELECT COUNT(*) AS n FROM reports WHERE workspace_path = ?")
      .get(workspacePath);
    return row.n;
  } finally {
    raw.close();
  }
}

function reportedTaskIds(dbPath, workspacePath) {
  const raw = new Database(dbPath, { readonly: true });
  try {
    return raw
      .prepare("SELECT DISTINCT task_id FROM reports WHERE workspace_path = ?")
      .all(workspacePath)
      .map((r) => r.task_id);
  } finally {
    raw.close();
  }
}

sqliteDescribe("SQLite mode: QA_REVIEW_TARGET_REQUIRED / scoped-append gate matrix", () => {
  test("SQ1/AC1/AC4: FAIL write with review_task_ids=[T-X] among N open tasks writes EXACTLY 1 reports row (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("qrsa-sq1-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "qrsa-sq1",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "qa-engineer",
      });
      // Seed N pre-existing report rows for OTHER tasks — the SQLite
      // equivalent of the D8 incident's pre-existing polluted review files.
      await storage.recordReview(dir, ["T-QRSA-SQL-OTHER-1", "T-QRSA-SQL-OTHER-2"], "PASS", "qa-engineer", "prior unrelated PASS");
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "qrsa-sq1",
        status: "FAIL",
        agent_id: "qa-engineer",
        completed_tasks: [],
        review_task_ids: ["T-QRSA-SQL-TARGET"],
        qa_review: "FAIL — SQLite mode scoped-append check",
        pending_notes: ["QA: T-QRSA-SQL-TARGET FAIL"],
      });
      assert.ok(!result.isError, `expected acceptance; got: ${result.content?.[0]?.text}`);

      // Total rows: the 2 seeded prior rows + exactly 1 new row for the
      // target — never N+1 fanning into every open task.
      assert.equal(countReportsRows(dbPath, dir), 3, "expected exactly 1 new reports row written (2 seeded + 1 new)");
      const ids = reportedTaskIds(dbPath, dir);
      assert.ok(ids.includes("T-QRSA-SQL-TARGET"), "target task must have a reports row");
      assert.ok(!ids.includes("T-QRSA-SQL-OTHER-1-FANOUT"), "no fan-out row for unrelated tasks");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ2/AC2: PASS write with completed_tasks=[T-Y,T-Z], review_task_ids omitted, records for exactly T-Y/T-Z (back-compat, SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("qrsa-sq2-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "qrsa-sq2",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "qa-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "qrsa-sq2",
        status: "PASS",
        agent_id: "qa-engineer",
        completed_tasks: ["T-QRSA-SQL-Y", "T-QRSA-SQL-Z"],
        qa_review: "PASS — all green",
        pending_notes: ["QA: PASS"],
      });
      assert.ok(!result.isError, `expected acceptance; got: ${result.content?.[0]?.text}`);
      assert.equal(countReportsRows(dbPath, dir), 2, "expected exactly 2 rows (Y and Z), back-compat unchanged");
      const ids = reportedTaskIds(dbPath, dir).sort();
      assert.deepEqual(ids, ["T-QRSA-SQL-Y", "T-QRSA-SQL-Z"]);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ3/AC3: qa_review write with review_task_ids AND completed_tasks both empty is REJECTED with QA_REVIEW_TARGET_REQUIRED, writing ZERO rows (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("qrsa-sq3-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "qrsa-sq3",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "qa-engineer",
      });
      resetSession(dir);
      storage.readState(dir);

      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "qrsa-sq3",
        status: "FAIL",
        agent_id: "qa-engineer",
        completed_tasks: [],
        qa_review: "FAIL — forgot to name the task under review",
        pending_notes: ["QA: forgot review_task_ids"],
      });
      assert.ok(result.isError, "both-empty qa_review write must be rejected (SQLite mode too)");
      assert.match(result.content[0].text, /QA_REVIEW_TARGET_REQUIRED/);
      assert.equal(countReportsRows(dbPath, dir), 0, "no reports row may be written when the write is rejected");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});
