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
// E40 (e40-nonqa-completed-tasks-write-gate, T-E40-03) additions below.
//
// Spec-to-test map (docs/backlog.md E40 row is the spec; no separate
// specs/<feature>.md — mini-chain, PM/ARCH skipped, per scope_decision_why):
//   the reviewer-only completed_tasks gate (above) generalized to every
//   non-qa identity, rejecting with the NEW NON_QA_COMPLETED_TASKS_REJECTED
//   code, while code-reviewer keeps the UNCHANGED REVIEWER_COMPLETED_TASKS_
//   REJECTED envelope (proven byte-identical above, FM1/SQ1, untouched by
//   this feature) and qa-engineer keeps the UNCHANGED E18/E32
//   QA_COMPLETION_EVIDENCE_MISSING path (FM4/FM5/SQ3, also untouched)  ->
//     FM6-FM11 (one per identity: sr-engineer, pm, architect, researcher,
//     design-auditor, release-engineer)
//   the bypass itself — a non-qa write prefilling an id must now be
//   rejected AT THE FIRST WRITE, not merely somewhere downstream, and the
//   pre-existing QA_COMPLETION_EVIDENCE_MISSING set-difference gate must
//   still be armed on a genuinely-new id afterward (proving E18/E32 was
//   not loosened to compensate)                                        ->
//     BYPASS-FM (file mode), BYPASS-SQL (SQLite mode)
//
// TEST-DESIGN HAZARD (flagged forward by the code-reviewer,
// review_reports/review_T-E40-01.md round 2): the widened step sits AFTER
// AGENT_ID_REQUIRED, TRANSITION_REJECTED, and CUT_APPROVAL_REQUIRED in
// UPDATE_STATE_GATE_PIPELINE. A per-role test that seeds an ILLEGAL
// prev-tuple shadows on an earlier gate and passes for the WRONG reason —
// concretely, seeding prev=pm:In_Progress (cut_approved unset) and then
// writing agent_id="architect" would hit CUT_APPROVAL_REQUIRED, not this
// gate; a raw agent_id="doc-writer" write would hit AGENT_ID_REQUIRED (not
// even a real AgentName in tools/transitions.ts). Every FM6-FM11 case below
// therefore seeds a LEGAL prev-tuple via the generic self-loop fast path
// (validateTransition step 3: prev.agent === next.agent, both In_Progress —
// accepted unconditionally, before the table lookup and before any of the
// pm->{architect,sr-engineer}-pinned build-entry gates, none of which match
// a same-agent self-loop) and asserts the SPECIFIC new error code, not
// merely that the write failed.
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
      completed_tasks: ["T-BOGUS-01"], // the E40 prefill shape
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
// BYPASS-FM — the regression pin for the bypass itself (file mode). Mirrors
// the exact incident shape the code-reviewer constructed end-to-end in
// review_reports/review_T-E40-01.md ("WRITE1"/"WRITE2"): a non-qa write
// prefills an id, then a qa-engineer PASS carries that SAME id with zero
// qa_reports/ evidence anywhere on disk. Pre-E40, WRITE1 was accepted and
// WRITE2 was ALSO accepted (the E18/E32 set-difference gate diffs against
// the already-poisoned on-disk set, so the id contributes zero difference —
// this is the bypass). This test asserts the fix lands at the correct
// SITE: WRITE1 itself must fail with NON_QA_COMPLETED_TASKS_REJECTED (not
// merely "the sequence fails somewhere"), the ledger must stay unpoisoned,
// and — the control proving E18/E32 was not loosened to compensate — the
// downstream qa-engineer write carrying the same never-persisted id must
// still be caught by QA_COMPLETION_EVIDENCE_MISSING, because the id is now
// genuinely new rather than already on disk.
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

  // WRITE2 — the qa-engineer write carrying the SAME never-persisted id, with
  // NO qa_reports/ evidence anywhere and deliberately NO qa_review field: a
  // qa_review-bearing PASS/FAIL write auto-records its own evidence BEFORE
  // the completion-evidence gate runs (QA_REVIEW_RECORD precedes
  // QA_COMPLETION_EVIDENCE_MISSING in the pipeline, by design — a legitimate
  // PASS/FAIL satisfies the gate with the evidence that same write just
  // recorded), which would satisfy the gate for the wrong reason and prove
  // nothing about the bypass. This mirrors the QAEV-4a shape in
  // test/e18-write-provenance.test.mjs exactly (completed_tasks non-empty, no
  // qa_review, no evidence pre-staged). Because WRITE1 never persisted the
  // id, it is genuinely new from the E18/E32 gate's point of view, so it must
  // be caught there — proving that gate is still armed and was not loosened
  // or reordered to compensate for the new upstream gate.
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
  // SQ4 / BYPASS-SQL — E40 additions, SQLite mode. The widened gate keys
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

  // BYPASS-SQL mirrors BYPASS-FM's WRITE1 half — the load-bearing claim that
  // the widened gate rejects the prefill AT THE FIRST WRITE identically
  // under SqliteHandoffStorage, "c16 keys only on parsed args" (T-E40-03).
  // It does NOT replay BYPASS-FM's WRITE2 half: the downstream
  // QA_COMPLETION_EVIDENCE_MISSING set-difference gate is explicitly
  // FILE-MODE ONLY (content/const-08-chain-31-mid.md's QA Completion-
  // Evidence row; tools/handoff-orchestrator.ts's `storage instanceof
  // FileHandoffStorage` guard on that gate, pre-existing and untouched by
  // this feature) — asserting it fires in SQLite mode here would assert a
  // behavior the codebase documents as out of scope, not a real regression
  // check.
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
