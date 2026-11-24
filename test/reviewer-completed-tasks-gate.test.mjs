// Coded by @qa-engineer
// Tests for the role-boundary spec (specs/c16-c10-role-boundary.md, AC-3/AC-4).
// Bogus ids once reached completed_tasks from a role that never judged the
// work. Since E435 code-reviewer is the chain's only judge and only ledger
// writer: NON_JUDGE_COMPLETED_TASKS_REJECTED (pipeline step 9) rejects a
// non-empty completed_tasks from every other agent_id, qa-engineer included.
// It keys only on parsed args, so the tests pin file mode and SQLite mode alike.
// Spec-to-test map: specs/e260h-comment-rationale.md (test/reviewer-completed-tasks-gate.test.mjs).

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
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

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
  // Force the seed's last_updated off the wall clock, so the freshness
  // stamp cannot look suspicious (E148) — see test/e148-seed-stamp.mjs.
  forceSeedStamp(ws);
}

// ---------------------------------------------------------------------------
// FM1 (E435): code-reviewer is the judge, so its ledger write never hits the
// step-9 gate; an unevidenced id is caught by the evidence gate instead, and
// with its report on disk the id lands (file mode).
// ---------------------------------------------------------------------------

const NON_JUDGE_HINT =
  "completed_tasks on a write not stamped agent_id=code-reviewer is ledger pollution: only code-reviewer, the chain's judge, may grow completed_tasks (or complete tasks through tw_complete_task), backed by the QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks (or pass []) on this write. See docs/backlog.md E40.";
const REMOVED_LEDGER_CODES = /REVIEWER_COMPLETED_TASKS_REJECTED|NON_QA_COMPLETED_TASKS_REJECTED/;

test("FM1 (E435): a code-reviewer write carrying completed_tasks is never NON_JUDGE_COMPLETED_TASKS_REJECTED; no report -> QA_COMPLETION_EVIDENCE_MISSING, report present -> the id lands (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm1-");
  await seedFileState(ws, "rctg-fm1", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const args = {
    workspace_path: ws,
    active_feature: "rctg-fm1",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-RCTG-01"],
    pending_notes: ["code-reviewer: completing T-RCTG-01"],
  };
  const result = await handleUpdateState(args);
  assert.ok(result.isError, "an unevidenced judge ledger write is still refused, by the evidence gate");
  assert.match(result.content[0].text, /QA_COMPLETION_EVIDENCE_MISSING/);
  assert.doesNotMatch(result.content[0].text, /NON_JUDGE_COMPLETED_TASKS_REJECTED/, "the judge is the ledger writer");
  assert.doesNotMatch(result.content[0].text, REMOVED_LEDGER_CODES, "the removed ledger codes are never emitted");
  assert.deepEqual(parseHandoff(ws).completed_tasks, []);

  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "review_T-RCTG-01.md"), "# QA review — T-RCTG-01\n\nPASS.\n", "utf-8");
  resetSession(ws);
  markStateRead(ws);
  const ok = await handleUpdateState(args);
  assert.ok(!ok.isError, `with the judge report on disk the judge's ledger write lands; got: ${ok.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, ["T-RCTG-01"]);
});

// ---------------------------------------------------------------------------
// The Phase-2 claim write (agent_id=code-reviewer,
// completed_tasks=[]) is unaffected, file mode (FM2, AC-3 bullet 2).
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
// Crash-safety: completed_tasks OMITTED entirely at the
// real tw_update_state boundary (zod default []) does not throw and is
// ACCEPTED, exercising the full TOOL_REGISTRY dispatch (zod parse -> handler
// -> orchestrator), not a hand-built parsed object (FM3, AC-3 bullet 2).
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
// FM4 / FM5 (E435): the APPROVED row moved. code-reviewer -> qa-engineer is no
// longer an edge (code-reviewer closes the feature), and the judge's own
// APPROVED write carries the review scope in review_task_ids, never into
// completed_tasks.
// ---------------------------------------------------------------------------

test("FM4 (E435): a qa-engineer write after code-reviewer:In_Progress is TRANSITION_REJECTED with the judge hint, never a ledger code (file mode)", async () => {
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
    pending_notes: ["qa-engineer: after review"],
  });
  assert.ok(result.isError, "code-reviewer -> qa-engineer is not an edge");
  assert.match(result.content[0].text, /TRANSITION_REJECTED/);
  assert.ok(
    // "⛔ <CODE>\n<JSON envelope>": read the envelope's top-level `hint` (architecture), not escaped text.
    JSON.parse(result.content[0].text.slice(result.content[0].text.indexOf("\n") + 1)).hint.includes('code-reviewer is the judge and closes the feature: approve with code-reviewer:PASS (review_verdict: "APPROVED"), or reject with code-reviewer:FAIL; qa-engineer does not follow code-reviewer.'),
    `hint names code-reviewer as the closing judge; got: ${result.content[0].text}`,
  );
  assert.doesNotMatch(result.content[0].text, /NON_JUDGE_COMPLETED_TASKS_REJECTED|QA_COMPLETION_EVIDENCE_MISSING/);
});

test("FM5 (E435): the judge's APPROVED write with review_task_ids and its report present is ACCEPTED, completed_tasks stays empty (file mode, positive control)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-fm5-");
  await seedFileState(ws, "rctg-fm5", "code-reviewer", "In_Progress");
  const reviewDir = path.join(ws, "qa_reports");
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, "review_T-RCTG-EV2.md"), "# QA review — T-RCTG-EV2\n\nAPPROVED.\n", "utf-8");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "rctg-fm5",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    review_task_ids: ["T-RCTG-EV2"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(!result.isError, `the judge's APPROVED write must be accepted; got: ${result.content?.[0]?.text}`);
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "review scope must NOT persist into completed_tasks");
});

// ---------------------------------------------------------------------------
// The gate covers every non-judge identity (E40, E435): FM6-FM12 expect
// NON_JUDGE_COMPLETED_TASKS_REJECTED per role, qa-engineer included, and
// BYPASS-FM / BYPASS-SQL pin the bypass. The gate sits after AGENT_ID_REQUIRED, TRANSITION_REJECTED and
// CUT_APPROVAL_REQUIRED, so each case seeds a legal same-agent self-loop and
// asserts the specific code; an illegal prev-tuple would fail on an earlier gate.
// ---------------------------------------------------------------------------

const NON_QA_SELF_LOOP_IDENTITIES = [
  ["sr-engineer", "FM6"],
  ["pm", "FM7"],
  ["architect", "FM8"],
  ["researcher", "FM9"],
  ["design-auditor", "FM10"],
  ["release-engineer", "FM11"],
  ["qa-engineer", "FM12"],
];

for (const [role, label] of NON_QA_SELF_LOOP_IDENTITIES) {
  test(`${label} (E435): agent_id="${role}" self-loop carrying non-empty completed_tasks is REJECTED with NON_JUDGE_COMPLETED_TASKS_REJECTED, not an earlier gate (file mode)`, async () => {
    setActiveStorage(new FileHandoffStorage());
    const ws = mkWorkspace(`rctg-${label.toLowerCase()}-`);
    const feature = `rctg-${label.toLowerCase()}`;
    // Seed prev = (role, In_Progress) directly on disk (bypassing the gate
    // pipeline, same helper every FM test above uses) so the REAL write below
    // is a same-agent self-loop — legal per validateTransition step 3
    // regardless of the static table, and critically NOT the
    // pm->{architect,sr-engineer}:In_Progress edge the cut-approval /
    // scope-decision / external-refs / source-credibility gates are pinned
    // to (prevTuple.agent here is the role itself, never "pm").
    await seedFileState(ws, feature, role, "In_Progress");
    resetSession(ws);
    markStateRead(ws);
    const result = await handleUpdateState({
      workspace_path: ws,
      active_feature: feature,
      status: "In_Progress",
      agent_id: role,
      completed_tasks: ["T-BOGUS-01"], // the bogus-id shape a template prefill once produced (E40)
      pending_notes: [`${role}: self-loop`],
    });
    assert.ok(result.isError, `agent_id="${role}" carrying non-empty completed_tasks must be rejected`);
    // Exact emit (architecture step 9 + Copy hintStatic): names the ids, the writer, and the sole permitted writer.
    assert.ok(
      result.content[0].text.includes(`⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks=[T-BOGUS-01] on an agent_id=${role} write. ${NON_JUDGE_HINT}`),
      `expected the exact NON_JUDGE_COMPLETED_TASKS_REJECTED emit; got: ${result.content[0].text}`,
    );
    assert.doesNotMatch(result.content[0].text, REMOVED_LEDGER_CODES, "the removed ledger codes are never emitted");
    assert.deepEqual(
      parseHandoff(ws).completed_tasks,
      [],
      `the rejected write must NOT poison the on-disk ledger for agent_id="${role}"`,
    );
  });
}

// ---------------------------------------------------------------------------
// BYPASS-FM (file mode): a non-judge write prefilled an id, then the judge's
// write carried the same id with no evidence and was accepted, because the
// set-difference gate compared against the already-poisoned ledger. Now the
// first write fails with NON_JUDGE_COMPLETED_TASKS_REJECTED, the ledger stays
// clean, and the code-reviewer write is still caught by QA_COMPLETION_EVIDENCE_MISSING.
// ---------------------------------------------------------------------------

test("BYPASS-FM (E435): a non-judge prefill write is rejected AT THE FIRST WRITE; the downstream code-reviewer write carrying the same id is still caught by QA_COMPLETION_EVIDENCE_MISSING (file mode)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace("rctg-bypass-fm-");
  const feature = "rctg-bypass-fm";
  await seedFileState(ws, feature, "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);

  // WRITE1 — the bypass attempt: sr-engineer self-loop prefilling a bogus id.
  const write1 = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: ["T-BOGUS-BYPASS"],
    pending_notes: ["sr-engineer: (bypass attempt) prefilling completed_tasks"],
  });
  assert.ok(write1.isError, "WRITE1 (the non-judge prefill) must be rejected — this is the fix's load-bearing site");
  assert.ok(
    write1.content[0].text.includes("NON_JUDGE_COMPLETED_TASKS_REJECTED"),
    `WRITE1 must fail specifically with NON_JUDGE_COMPLETED_TASKS_REJECTED; got: ${write1.content[0].text}`,
  );
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the on-disk ledger must NOT be poisoned after the rejected WRITE1");

  // Legitimate advance to code-reviewer (empty completed_tasks — the claim
  // shape), so the sequence reaches a real (code-reviewer, In_Progress)
  // prev-tuple honestly. WRITE1 never landed; forcing the stamp is a no-op
  // belt-and-braces (E148).
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const advance1 = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: claiming review"],
  });
  assert.ok(!advance1.isError, `legitimate sr-engineer->code-reviewer advance must not be rejected; got: ${advance1.content?.[0]?.text}`);

  // WRITE2: the judge's write with the same id, no evidence and no qa_review
  // (a qa_review write records its own evidence first and would pass for the
  // wrong reason). The id was never persisted, so the evidence gate must catch
  // it. advance1 stamped a wall-clock last_updated; force it safe (E148).
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const write2 = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: ["T-BOGUS-BYPASS"],
    pending_notes: ["code-reviewer: (bypass attempt) claiming completion with no evidence on disk"],
  });
  assert.ok(write2.isError, "WRITE2 must also be rejected — the downstream evidence gate closes what the first-write gate doesn't need to");
  assert.ok(
    write2.content[0].text.includes("QA_COMPLETION_EVIDENCE_MISSING"),
    `WRITE2 must fail with QA_COMPLETION_EVIDENCE_MISSING (the id is genuinely new); got: ${write2.content[0].text}`,
  );
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the ledger must still be [] after both rejected writes — never poisoned at any point");
});

// ---------------------------------------------------------------------------
// SQLite mode — mirrors FM1/FM2/FM4 above against SqliteHandoffStorage,
// proving the gate's "no FileHandoffStorage guard" design actually holds at
// runtime, not just by code inspection.
// ---------------------------------------------------------------------------

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

function mkSqliteWorkspace(prefix = "rctg-sql-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(dir, "agc.db");
  return { dir, dbPath };
}

sqliteDescribe("SQLite mode: NON_JUDGE_COMPLETED_TASKS_REJECTED gate matrix", () => {
  test("SQ1 (E435): the judge's write carrying non-empty completed_tasks is ACCEPTED and stored as given (SQLite mode)", async () => {
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
        status: "In_Progress",
        agent_id: "code-reviewer",
        completed_tasks: ["T-RCTG-SQL"],
        pending_notes: ["code-reviewer: completing T-RCTG-SQL"],
      });
      // The evidence gate is file-mode only, so the judge's ledger write lands as given.
      assert.ok(!result.isError, `SQLite-mode judge ledger write must be accepted; got: ${result.content?.[0]?.text}`);
      assert.deepEqual(storage.parse(dir).completed_tasks, ["T-RCTG-SQL"]);
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

  test("SQ3 (E435): qa-engineer self-loop carrying non-empty completed_tasks is REJECTED with NON_JUDGE_COMPLETED_TASKS_REJECTED, ledger unpoisoned (SQLite mode)", async () => {
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
        lastAgent: "qa-engineer",
      });
      resetSession(dir);
      storage.readState(dir);
      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-sq3",
        status: "In_Progress",
        agent_id: "qa-engineer",
        completed_tasks: ["T-RCTG-SQL-EV"],
        pending_notes: ["qa-engineer: tests written"],
      });
      assert.ok(result.isError, "qa-engineer is not the judge: its ledger write is rejected in SQLite mode too");
      assert.ok(
        result.content[0].text.includes(`⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks=[T-RCTG-SQL-EV] on an agent_id=qa-engineer write. ${NON_JUDGE_HINT}`),
        `expected the exact NON_JUDGE_COMPLETED_TASKS_REJECTED emit; got: ${result.content[0].text}`,
      );
      assert.deepEqual(storage.parse(dir).completed_tasks, []);
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  // -------------------------------------------------------------------------
  // SQLite-mode coverage of the widened gate (SQ4 / BYPASS-SQL, E40). The widened gate keys
  // only on parsed.agent_id/parsed.completed_tasks (no FileHandoffStorage
  // guard — see gates/registry.ts's NON_JUDGE_COMPLETED_TASKS_REJECTED entry's
  // "Applies in file and SQLite/HTTP mode alike" clause), so it must behave
  // identically under SqliteHandoffStorage.
  // -------------------------------------------------------------------------

  test("SQ4 (E435): agent_id=\"sr-engineer\" self-loop carrying non-empty completed_tasks is REJECTED with NON_JUDGE_COMPLETED_TASKS_REJECTED (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("rctg-sq4-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "rctg-sq4",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "sr-engineer",
      });
      resetSession(dir);
      storage.readState(dir);
      const result = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-sq4",
        status: "In_Progress",
        agent_id: "sr-engineer",
        completed_tasks: ["T-BOGUS-SQL-2"],
        pending_notes: ["sr-engineer: self-loop"],
      });
      assert.ok(result.isError, "SQLite-mode sr-engineer write with non-empty completed_tasks must be rejected too");
      assert.ok(
        result.content[0].text.includes("NON_JUDGE_COMPLETED_TASKS_REJECTED"),
        `expected NON_JUDGE_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
      );
      const readBack = storage.parse(dir);
      assert.deepEqual(readBack.completed_tasks, [], "the SQLite-backed ledger must NOT be poisoned after the rejected write");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  // BYPASS-SQL replays only BYPASS-FM's first write: QA_COMPLETION_EVIDENCE_MISSING
  // is file-mode only, so asserting the second half here would test behaviour
  // the codebase documents as out of scope.
  test("BYPASS-SQL (E435): a non-judge prefill write is rejected AT THE FIRST WRITE, ledger stays unpoisoned (SQLite mode)", async () => {
    const { dir, dbPath } = mkSqliteWorkspace("rctg-bypass-sql-");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      setActiveStorage(storage);
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "rctg-bypass-sql",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: ["seed"],
        lastAgent: "pm",
      });
      resetSession(dir);
      storage.readState(dir);
      const write1 = await handleUpdateState({
        workspace_path: dir,
        active_feature: "rctg-bypass-sql",
        status: "In_Progress",
        agent_id: "pm",
        completed_tasks: ["T-BOGUS-BYPASS-SQL"],
        pending_notes: ["pm: (bypass attempt) prefilling completed_tasks"],
      });
      assert.ok(write1.isError, "WRITE1 (the non-judge prefill) must be rejected in SQLite mode too");
      assert.ok(
        write1.content[0].text.includes("NON_JUDGE_COMPLETED_TASKS_REJECTED"),
        `WRITE1 must fail specifically with NON_JUDGE_COMPLETED_TASKS_REJECTED; got: ${write1.content[0].text}`,
      );
      const readBack = storage.parse(dir);
      assert.deepEqual(readBack.completed_tasks, [], "the SQLite-backed ledger must NOT be poisoned after the rejected WRITE1");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});
