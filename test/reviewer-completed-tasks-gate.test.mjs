// Coded by @qa-engineer
// Tests for specs/c16-c10-role-boundary.md — AC-3/AC-4 (T-C16-05).
//
// Spec-to-Test map:
//   AC-3 bullet 1 (reject non-empty completed_tasks on agent_id=code-reviewer,
//     file mode)                                          -> FM1
//   AC-3 bullet 1 (same, SQLite/HTTP mode — storage-agnostic per DR-5)
//                                                          -> SQ1
//   AC-3 bullet 2 (Phase-2 claim write, completed_tasks=[],
//     unaffected — file mode)                              -> FM2
//   AC-3 bullet 2 (same, SQLite mode)                       -> SQ2
//   AC-3 bullet 2 (zod-default completed_tasks omitted entirely, full
//     TOOL_REGISTRY dispatch — crash-safety per review_T-C16-01.md finding)
//                                                          -> FM3
//   AC-3 bullet 3 (APPROVED row, agent_id=qa-engineer: new gate does not
//     fire; pre-existing MISSING_REVIEW_EVIDENCE still fires correctly —
//     file mode) — RE-PINNED (E32 amendment, e32-e33-gate-hardening):
//     review scope now travels via review_task_ids, completed_tasks stays
//     empty (a non-empty completed_tasks on this write would instead hit
//     the amended QA_COMPLETION_EVIDENCE_MISSING gate first — see
//     test/e18-write-provenance.test.mjs QAEV-4a/b and
//     test/e32-e33-gate-hardening.test.mjs C2/P6a/P6b/P6c)
//                                                          -> FM4, FM5
//   AC-3 bullet 3 (same, SQLite mode — unaffected by the E32 amendment:
//     QA_COMPLETION_EVIDENCE_MISSING is file-mode only, so SQ3 keeps the
//     pre-amendment completed_tasks shape)                 -> SQ3
//
// WHY: the C16 incident was a code-reviewer write's `completed_tasks` field
// polluting the handoff ledger with ids qa-engineer never actually completed
// (the CHANGES_REQUESTED self-stamped row). The new REVIEWER_COMPLETED_TASKS_
// REJECTED gate (tools/handoff-orchestrator.ts, sibling of
// REVIEW_VERDICT_STATUS_MISMATCH) closes that class server-side. It is
// deliberately storage-agnostic (keys only on parsed args, no
// `instanceof FileHandoffStorage` guard) so it must fire identically whether
// the active storage backend is file-mode or SQLite/HTTP — these tests pin
// both backends rather than trusting the "no guard" code-read alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency. Skip the
// SQLite-mode block gracefully if it's not installed locally — same guard as
// test/visual-round-sqlite.test.mjs and test/dispatch-pins.test.mjs S1.
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — SQLite-mode reviewer-completed-tasks-gate tests skipped");
}

// ---------------------------------------------------------------------------
// File-mode helpers
// ---------------------------------------------------------------------------

function mkWorkspace(prefix = "rctg-") {
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

// ---------------------------------------------------------------------------
// FM1 — AC-3 bullet 1: code-reviewer write with non-empty completed_tasks is
// REJECTED with REVIEWER_COMPLETED_TASKS_REJECTED (file mode).
// ---------------------------------------------------------------------------

test("FM1: code-reviewer CHANGES_REQUESTED-shaped write carrying non-empty completed_tasks is REJECTED (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm1-");
  // prev: code-reviewer:In_Progress -> code-reviewer:FAIL is a valid transition
  // edge (the real CHANGES_REQUESTED self-stamp), so the write reaches the new
  // gate rather than being rejected earlier by validateTransition.
  await seedFileState(ws, "rctg-fm1", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rctg-fm1",
    status: "FAIL",
    agent_id: "code-reviewer",
    completed_tasks: ["T-BOGUS-01"], // the C16 ledger-pollution shape
    pending_notes: ["code-reviewer: found a correctness issue"],
  });
  assert.ok(result.isError, "a code-reviewer write with non-empty completed_tasks must be rejected");
  assert.ok(
    result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
    `expected REVIEWER_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
  );
});

// ---------------------------------------------------------------------------
// FM2 — AC-3 bullet 2: the Phase-2 claim write (agent_id=code-reviewer,
// completed_tasks=[]) is unaffected (file mode).
// ---------------------------------------------------------------------------

test("FM2: code-reviewer claim write (completed_tasks=[]) is ACCEPTED — unaffected (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm2-");
  await seedFileState(ws, "rctg-fm2", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rctg-fm2",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: claiming review"],
  });
  assert.ok(!result.isError, `an empty completed_tasks claim write must never be rejected; got: ${result.content?.[0]?.text}`);
});

// ---------------------------------------------------------------------------
// FM3 — AC-3 bullet 2 (crash-safety): completed_tasks OMITTED entirely at the
// real tw_update_state boundary (zod default []) does not throw and is
// ACCEPTED, exercising the full TOOL_REGISTRY dispatch (zod parse -> handler
// -> orchestrator), not a hand-built parsed object.
// ---------------------------------------------------------------------------

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

test("FM3: tw_update_state with completed_tasks omitted defaults to [] (zod) and is not rejected — full dispatch path", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm3-");
  await seedFileState(ws, "rctg-fm3", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "rctg-fm3",
    status: "In_Progress",
    agent_id: "code-reviewer",
    pending_notes: ["code-reviewer: claiming review"],
    // completed_tasks intentionally omitted — zod .default([]) must kick in
    // before the orchestrator's `parsed.completed_tasks.length` dereference.
  });
  assert.ok(!result.isError, `omitted completed_tasks must default to [] without crashing; got: ${result.content?.[0]?.text}`);
});

// ---------------------------------------------------------------------------
// FM4 / FM5 — AC-3 bullet 3: the APPROVED row is untouched by the new
// REVIEWER_COMPLETED_TASKS_REJECTED gate — it keys on agent_id, not on which
// role authored the call. RE-PINNED (E32 amendment, e32-e33-gate-hardening):
// review scope now travels via the transient review_task_ids field, with
// completed_tasks staying EMPTY on this row (a non-empty completed_tasks
// here would instead be caught by the amended QA_COMPLETION_EVIDENCE_MISSING
// gate FIRST — see test/e18-write-provenance.test.mjs QAEV-4a). The
// pre-existing MISSING_REVIEW_EVIDENCE gate downstream must still fire
// correctly off review_task_ids (FM4: evidence absent -> rejected by
// MISSING_REVIEW_EVIDENCE, NOT by the new gate) and clear when evidence
// exists (FM5: positive control, proves the new gate is truly inert on this
// path and that completed_tasks stays unpolluted).
// ---------------------------------------------------------------------------

test("FM4 (E32 amendment): qa-engineer APPROVED-row write with review_task_ids and NO review evidence is rejected by MISSING_REVIEW_EVIDENCE, not the new gate (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm4-");
  await seedFileState(ws, "rctg-fm4", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rctg-fm4",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-RCTG-EV"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(result.isError, "no review evidence on disk must still be rejected");
  assert.ok(
    result.content[0].text.includes("MISSING_REVIEW_EVIDENCE"),
    `expected MISSING_REVIEW_EVIDENCE; got: ${result.content[0].text}`,
  );
  assert.ok(
    !result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
    "the new gate must NOT fire for an agent_id=qa-engineer write",
  );
  assert.ok(
    !result.content[0].text.includes("QA_COMPLETION_EVIDENCE_MISSING"),
    "with completed_tasks empty the amended completion-evidence gate must not fire either — the two gates are orthogonal",
  );
});

test("FM5 (E32 amendment): qa-engineer APPROVED-row write with review_task_ids and review evidence PRESENT is ACCEPTED, completed_tasks stays empty (file mode, positive control)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm5-");
  await seedFileState(ws, "rctg-fm5", "code-reviewer", "In_Progress");
  const reviewDir = path.join(ws, "review_reports");
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "review_T-RCTG-EV2.md"), "# Review — T-RCTG-EV2\n\nAPPROVED.\n", "utf-8");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rctg-fm5",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-RCTG-EV2"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(!result.isError, `review evidence present must clear MISSING_REVIEW_EVIDENCE; got: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review scope must NOT persist into completed_tasks under the amended contract");
});

// ---------------------------------------------------------------------------
// SQLite mode — mirrors FM1/FM2/FM4 against SqliteHandoffStorage, proving the
// gate's "no FileHandoffStorage guard" design actually holds at runtime, not
// just by code inspection.
// ---------------------------------------------------------------------------

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "rctg-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

sqliteDescribe("SQLite mode: REVIEWER_COMPLETED_TASKS_REJECTED gate matrix", () => {
  test("SQ1: code-reviewer write carrying non-empty completed_tasks is REJECTED (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("rctg-sq1-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "rctg-sq1",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "code-reviewer",
      });
      // Mirrors the production tw_get_state flow: readState() both marks the
      // session as having read state (enforcePreFlight) and snapshots the
      // SQLite freshness token (verifyExtra) so the subsequent write doesn't
      // trip a spurious STATE DRIFT.
      resetSession(dir);
      storage.readState(dir);
      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-sq1",
        status: "FAIL",
        agent_id: "code-reviewer",
        completed_tasks: ["T-BOGUS-SQL"],
        pending_notes: ["code-reviewer: found a correctness issue"],
      });
      assert.ok(result.isError, "SQLite-mode code-reviewer write with non-empty completed_tasks must be rejected too");
      assert.ok(
        result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
        `expected REVIEWER_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
      );
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ2: code-reviewer claim write (completed_tasks=[]) is ACCEPTED — unaffected (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("rctg-sq2-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "rctg-sq2",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "sr-engineer",
      });
      resetSession(dir);
      storage.readState(dir);
      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-sq2",
        status: "In_Progress",
        agent_id: "code-reviewer",
        completed_tasks: [],
        pending_notes: ["code-reviewer: claiming review"],
      });
      assert.ok(!result.isError, `SQLite-mode empty completed_tasks claim write must never be rejected; got: ${result.content?.[0]?.text}`);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test("SQ3: qa-engineer APPROVED-row write with non-empty completed_tasks and no evidence ROW is rejected by MISSING_REVIEW_EVIDENCE, not the new gate (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("rctg-sq3-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "rctg-sq3",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "code-reviewer",
      });
      resetSession(dir);
      storage.readState(dir);
      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-sq3",
        status: "In_Progress",
        agent_id: "qa-engineer",
        completed_tasks: ["T-RCTG-SQL-EV"],
        pending_notes: ["code-reviewer: APPROVED"],
      });
      assert.ok(result.isError, "no code-review evidence row in the SQLite reports table must still be rejected");
      assert.ok(
        result.content[0].text.includes("MISSING_REVIEW_EVIDENCE"),
        `expected MISSING_REVIEW_EVIDENCE; got: ${result.content[0].text}`,
      );
      assert.ok(
        !result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
        "the new gate must NOT fire for an agent_id=qa-engineer write in SQLite mode either",
      );
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});
