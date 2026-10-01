// Coded by @qa-engineer
// Tests for the role-boundary spec (specs/c16-c10-role-boundary.md, AC-3/AC-4).
// A code-reviewer write once stamped ids into completed_tasks that qa-engineer
// never completed; REVIEWER_COMPLETED_TASKS_REJECTED blocks that server-side. It
// keys only on parsed args, so the tests pin file mode and SQLite mode alike.
// Later sections widen the gate to every non-qa identity (E40).
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
// A code-reviewer write with non-empty completed_tasks is
// REJECTED with REVIEWER_COMPLETED_TASKS_REJECTED, file mode (FM1, AC-3 bullet 1).
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
    completed_tasks: ["T-BOGUS-01"], // the bogus-id shape that once polluted the task ledger (C16)
    pending_notes: ["code-reviewer: found a correctness issue"],
  });
  assert.ok(result.isError, "a code-reviewer write with non-empty completed_tasks must be rejected");
  assert.ok(
    result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
    `expected REVIEWER_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
  );
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
// FM4 / FM5: the APPROVED row (agent_id=qa-engineer) is untouched by the new
// gate. Review scope travels in review_task_ids and completed_tasks stays empty
// (a non-empty one would hit QA_COMPLETION_EVIDENCE_MISSING first). FM4: no
// evidence -> MISSING_REVIEW_EVIDENCE; FM5: evidence present -> accepted.
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
// The gate widened to every non-qa identity (E40): FM6-FM11 expect
// NON_QA_COMPLETED_TASKS_REJECTED per role, and BYPASS-FM / BYPASS-SQL pin the
// bypass. The gate sits after AGENT_ID_REQUIRED, TRANSITION_REJECTED and
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
];

for (const [role, label] of NON_QA_SELF_LOOP_IDENTITIES) {
  test(`${label}: agent_id="${role}" self-loop carrying non-empty completed_tasks is REJECTED with NON_QA_COMPLETED_TASKS_REJECTED, not an earlier gate (file mode)`, async () => {
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
    assert.ok(
      result.content[0].text.includes("NON_QA_COMPLETED_TASKS_REJECTED"),
      `expected NON_QA_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
    );
    assert.ok(
      !result.content[0].text.includes("REVIEWER_COMPLETED_TASKS_REJECTED"),
      "a non-code-reviewer, non-qa-engineer identity must get the NEW code, not the pre-existing c16 code",
    );
    assert.deepEqual(
      parseHandoff(ws).completed_tasks,
      [],
      `the rejected write must NOT poison the on-disk ledger for agent_id="${role}"`,
    );
  });
}

// ---------------------------------------------------------------------------
// BYPASS-FM (file mode): a non-qa write prefilled an id, then a qa-engineer
// write carried the same id with no evidence and was accepted, because the
// set-difference gate compared against the already-poisoned ledger. Now the
// first write fails with NON_QA_COMPLETED_TASKS_REJECTED, the ledger stays
// clean, and the qa-engineer write is still caught by QA_COMPLETION_EVIDENCE_MISSING.
// ---------------------------------------------------------------------------

test("BYPASS-FM: a non-qa prefill write is rejected AT THE FIRST WRITE; the downstream qa-engineer write carrying the same id is still caught by QA_COMPLETION_EVIDENCE_MISSING (file mode)", async () => {
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
  assert.ok(write1.isError, "WRITE1 (the non-qa prefill) must be rejected — this is the fix's load-bearing site");
  assert.ok(
    write1.content[0].text.includes("NON_QA_COMPLETED_TASKS_REJECTED"),
    `WRITE1 must fail specifically with NON_QA_COMPLETED_TASKS_REJECTED; got: ${write1.content[0].text}`,
  );
  assert.deepEqual(parseHandoff(ws).completed_tasks, [], "the on-disk ledger must NOT be poisoned after the rejected WRITE1");

  // Legitimate advance to code-reviewer (empty completed_tasks — the real
  // Phase-2 claim shape), then to qa-engineer (empty claim), so the sequence
  // reaches a real (qa-engineer, In_Progress) prev-tuple honestly rather than
  // skipping straight to an illegal edge.
  // WRITE1 was rejected (never landed), so the on-disk stamp is still
  // the seed's forced-safe value — nothing new to force here. Belt-and-
  // braces anyway since it's a no-op if already safe (seed-stamp fix E148).
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

  // advance1 was ACCEPTED and stamped a fresh, wall-clock last_updated
  // — force it safe before it becomes advance2's prevState (E148).
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const advance2 = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: APPROVED, handing to qa-engineer"],
  });
  assert.ok(!advance2.isError, `legitimate code-reviewer->qa-engineer advance must not be rejected; got: ${advance2.content?.[0]?.text}`);

  // WRITE2: the qa-engineer write with the same id, no evidence and no
  // qa_review (a qa_review write records its own evidence first and would pass
  // for the wrong reason). The id was never persisted, so the evidence gate
  // must catch it. advance2 stamped a wall-clock last_updated; force it safe.
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const write2 = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: ["T-BOGUS-BYPASS"],
    pending_notes: ["qa-engineer: (bypass attempt) claiming completion with no evidence on disk"],
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

  // -------------------------------------------------------------------------
  // SQLite-mode coverage of the widened gate (SQ4 / BYPASS-SQL, E40). The widened gate keys
  // only on parsed.agent_id/parsed.completed_tasks (no FileHandoffStorage
  // guard — see gates/registry.ts's NON_QA_COMPLETED_TASKS_REJECTED entry's
  // "Applies in file and SQLite/HTTP mode alike" clause), so it must behave
  // identically under SqliteHandoffStorage.
  // -------------------------------------------------------------------------

  test("SQ4: agent_id=\"sr-engineer\" self-loop carrying non-empty completed_tasks is REJECTED with NON_QA_COMPLETED_TASKS_REJECTED (SQLite mode)", async () => {
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
        result.content[0].text.includes("NON_QA_COMPLETED_TASKS_REJECTED"),
        `expected NON_QA_COMPLETED_TASKS_REJECTED; got: ${result.content[0].text}`,
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
  test("BYPASS-SQL: a non-qa prefill write is rejected AT THE FIRST WRITE, ledger stays unpoisoned (SQLite mode)", async () => {
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
      assert.ok(write1.isError, "WRITE1 (the non-qa prefill) must be rejected in SQLite mode too");
      assert.ok(
        write1.content[0].text.includes("NON_QA_COMPLETED_TASKS_REJECTED"),
        `WRITE1 must fail specifically with NON_QA_COMPLETED_TASKS_REJECTED; got: ${write1.content[0].text}`,
      );
      const readBack = storage.parse(dir);
      assert.deepEqual(readBack.completed_tasks, [], "the SQLite-backed ledger must NOT be poisoned after the rejected WRITE1");
    } finally {
      setActiveStorage(new FileHandoffStorage());
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});
