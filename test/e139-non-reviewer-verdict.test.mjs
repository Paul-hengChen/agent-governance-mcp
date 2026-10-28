// Coded by @qa-engineer
// Pins for specs/e139-evidence-verdict-integrity.md E139 (AC-E139-1..6, AC-E139-8).
// Invariant: review_verdict is the code-reviewer's field. Only an agent_id=code-reviewer write, or the
// single APPROVED handoff stamped qa-engineer on code-reviewer:In_Progress -> qa-engineer:In_Progress,
// may carry it (file mode). A forged verdict is rejected before QA_REVIEW_RECORD, so it cannot even leave
// evidence behind. Drives the real orchestrator, as test/reviewer-completed-tasks-gate.test.mjs does.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { GATE_REGISTRY, gate } from "../dist/gates/registry.js";
import { computeGateStats } from "../dist/tools/gate-stats.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

let SqliteHandoffStorage;
try {
  SqliteHandoffStorage = (await import("../dist/tools/storage-sqlite.js")).SqliteHandoffStorage;
} catch {
  console.log("[skip] better-sqlite3 not installed — SQLite-mode e139 case skipped");
}

const CODE = "NON_REVIEWER_VERDICT_REJECTED";

function mkWorkspace(prefix = "e139-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seed(ws, feature, agent, status) {
  setActiveStorage(new FileHandoffStorage());
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
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}

const handoffBytes = (ws) => fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath);
const text = (r) => r.content?.[0]?.text ?? "";

test("AC-E139-1: every non-reviewer role's write carrying review_verdict is rejected, envelope exact, handoff byte-unchanged", async () => {
  const roles = ["pm", "researcher", "design-auditor", "architect", "sr-engineer", "qa-engineer", "release-engineer"];
  for (const role of roles) {
    for (const verdict of ["APPROVED", "CHANGES_REQUESTED"]) {
      const feature = `e139-1-${role}`;
      const ws = mkWorkspace("e139-1-");
      // Blocked -> In_Progress self-resume: a legal edge for every role that no build-entry gate touches.
      await seed(ws, feature, role, "Blocked");
      const before = handoffBytes(ws);
      const r = await handleUpdateState({
        workspace_path: ws,
        active_feature: feature,
        status: "In_Progress",
        agent_id: role,
        completed_tasks: [],
        pending_notes: [`${role}: forged verdict`],
        review_verdict: verdict,
      });
      assert.ok(r.isError, `${role}/${verdict} must be rejected; got: ${text(r)}`);
      assert.equal(
        text(r),
        `⛔ ${CODE}: review_verdict=${verdict} on an agent_id=${role} write. ${gate(CODE).hintStatic}`,
        `${role}/${verdict} envelope`,
      );
      assert.ok(before.equals(handoffBytes(ws)), `${role}/${verdict}: handoff.md must be byte-unchanged`);
    }
  }
});

test("AC-E139-2: the APPROVED handoff row (qa-engineer on code-reviewer:In_Progress -> qa-engineer:In_Progress) is accepted", async () => {
  const ws = mkWorkspace("e139-2-");
  await seed(ws, "e139-2", "code-reviewer", "In_Progress");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-E139-X.md"), "# Review\n\nAPPROVED.\n");
  const r = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e139-2",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-E139-X"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(!r.isError, `the APPROVED row must still be accepted; got: ${text(r)}`);
  // Companion: with no evidence the row reaches MISSING_REVIEW_EVIDENCE, not the new gate (the two gates agree on the edge).
  const ws2 = mkWorkspace("e139-2b-");
  await seed(ws2, "e139-2b", "code-reviewer", "In_Progress");
  const r2 = await handleUpdateState({
    workspace_path: ws2,
    active_feature: "e139-2b",
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    review_task_ids: ["T-E139-NOEV"],
    review_verdict: "APPROVED",
    pending_notes: ["code-reviewer: APPROVED"],
  });
  assert.ok(r2.isError);
  assert.match(text(r2), /MISSING_REVIEW_EVIDENCE/);
  assert.doesNotMatch(text(r2), new RegExp(CODE));
});

test("AC-E139-3: near-misses of the APPROVED row are rejected", async () => {
  // (a) qa-engineer APPROVED from qa-engineer:In_Progress (self-loop)
  const a = mkWorkspace("e139-3a-");
  await seed(a, "e139-3a", "qa-engineer", "In_Progress");
  const ra = await handleUpdateState({
    workspace_path: a, active_feature: "e139-3a", status: "In_Progress", agent_id: "qa-engineer",
    completed_tasks: [], pending_notes: ["x"], review_verdict: "APPROVED",
  });
  assert.ok(ra.isError, `self-loop APPROVED must be rejected; got: ${text(ra)}`);
  assert.match(text(ra), new RegExp(CODE));

  // (b) qa-engineer CHANGES_REQUESTED on the code-reviewer:In_Progress -> qa-engineer:In_Progress edge
  const b = mkWorkspace("e139-3b-");
  await seed(b, "e139-3b", "code-reviewer", "In_Progress");
  const rb = await handleUpdateState({
    workspace_path: b, active_feature: "e139-3b", status: "In_Progress", agent_id: "qa-engineer",
    completed_tasks: [], pending_notes: ["x"], review_verdict: "CHANGES_REQUESTED",
  });
  assert.ok(rb.isError, `CHANGES_REQUESTED on the handoff edge must be rejected; got: ${text(rb)}`);
  assert.match(text(rb), new RegExp(CODE));

  // (c) qa-engineer PASS and FAIL writes carrying any verdict
  for (const [status, verdict] of [["PASS", "APPROVED"], ["PASS", "CHANGES_REQUESTED"], ["FAIL", "APPROVED"], ["FAIL", "CHANGES_REQUESTED"]]) {
    const ws = mkWorkspace("e139-3c-");
    await seed(ws, "e139-3c", "qa-engineer", "In_Progress");
    const r = await handleUpdateState({
      workspace_path: ws, active_feature: "e139-3c", status, agent_id: "qa-engineer",
      completed_tasks: [], pending_notes: ["x"], review_verdict: verdict,
    });
    assert.ok(r.isError, `qa ${status}+${verdict} must be rejected; got: ${text(r)}`);
    assert.match(text(r), new RegExp(CODE), `qa ${status}+${verdict}`);
  }
});

test("AC-E139-4: code-reviewer writes never trip the new code; the consistency matrix is unchanged", async () => {
  const cases = [
    // [status, verdict, expectedReject]
    ["FAIL", "APPROVED", "REVIEW_VERDICT_STATUS_MISMATCH"],
    ["In_Progress", "CHANGES_REQUESTED", "REVIEW_VERDICT_STATUS_MISMATCH"],
    ["In_Progress", "APPROVED", null],
    ["FAIL", "CHANGES_REQUESTED", null],
  ];
  for (const [status, verdict, expected] of cases) {
    const ws = mkWorkspace("e139-4-");
    await seed(ws, "e139-4", "code-reviewer", "In_Progress");
    const r = await handleUpdateState({
      workspace_path: ws, active_feature: "e139-4", status, agent_id: "code-reviewer",
      completed_tasks: [], pending_notes: ["code-reviewer: verdict"], review_verdict: verdict,
    });
    assert.doesNotMatch(text(r), new RegExp(CODE), `code-reviewer ${status}/${verdict} must never carry the new code`);
    if (expected) {
      assert.ok(r.isError);
      assert.match(text(r), new RegExp(expected));
    } else {
      assert.ok(!r.isError, `code-reviewer ${status}/${verdict} must be accepted; got: ${text(r)}`);
    }
  }
});

test("AC-E139-5: a non-reviewer write without review_verdict never trips the new branch", async () => {
  for (const [role, from, to] of [
    ["pm", "Blocked", "In_Progress"],
    ["sr-engineer", "Blocked", "In_Progress"],
    ["qa-engineer", "In_Progress", "In_Progress"],
  ]) {
    const ws = mkWorkspace("e139-5-");
    await seed(ws, "e139-5", role, from);
    const r = await handleUpdateState({
      workspace_path: ws, active_feature: "e139-5", status: to, agent_id: role,
      completed_tasks: [], pending_notes: [`${role}: ordinary write`],
    });
    assert.ok(!r.isError, `${role} write with no verdict must be accepted; got: ${text(r)}`);
  }
});

test("AC-E139-6: SQLite storage is unchanged — an sr-engineer APPROVED write is not rejected with the new code", async (t) => {
  if (!SqliteHandoffStorage) {
    t.skip("no better-sqlite3");
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e139-6-"));
  try {
    const storage = new SqliteHandoffStorage(path.join(dir, "agc.db"));
    setActiveStorage(storage);
    await storage.writeState({
      workspacePath: dir, activeFeature: "e139-6", status: "Blocked",
      completedTasks: [], pendingNotes: ["seed"], lastAgent: "sr-engineer",
    });
    resetSession(dir);
    storage.readState(dir);
    const r = await handleUpdateState({
      workspace_path: dir, active_feature: "e139-6", status: "In_Progress", agent_id: "sr-engineer",
      completed_tasks: [], pending_notes: ["sr-engineer: resume"], review_verdict: "APPROVED",
    });
    assert.doesNotMatch(text(r), new RegExp(CODE), `SQLite must not apply the file-mode gate; got: ${text(r)}`);
    assert.ok(!r.isError, `SQLite behaviour is unchanged (accepted); got: ${text(r)}`);
  } finally {
    setActiveStorage(new FileHandoffStorage());
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test("AC-E139-7 (telemetry + registry facets): a rejection appends one telemetry line with the code and tw_gate_stats lists it", async () => {
  const entry = GATE_REGISTRY.find((g) => g.errorCode === CODE);
  assert.ok(entry, "registered");
  assert.equal(entry.producer, "orchestrator");
  assert.equal(entry.envelope, "plain-text");
  assert.equal(entry.documentedInProse, false);
  const ws = mkWorkspace("e139-7-");
  await seed(ws, "e139-7", "pm", "Blocked");
  const r = await handleUpdateState({
    workspace_path: ws, active_feature: "e139-7", status: "In_Progress", agent_id: "pm",
    completed_tasks: [], pending_notes: ["x"], review_verdict: "APPROVED",
  });
  assert.ok(r.isError);
  const tele = fs.readFileSync(resolveCurrentLanePaths(ws).telemetryPath, "utf-8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const mine = tele.filter((e) => e.error_code === CODE);
  assert.equal(mine.length, 1, "exactly one telemetry line carries the new code");
  const stats = computeGateStats(ws);
  assert.ok(stats.fired.some((f) => f.error_code === CODE), "tw_gate_stats lists it as fired");
  assert.ok(!stats.zero_fire.includes(CODE));
});

test("AC-E139-8: a forged verdict on a qa PASS write with qa_review is rejected before the evidence record — no file appears", async () => {
  const ws = mkWorkspace("e139-8-");
  await seed(ws, "e139-8", "qa-engineer", "In_Progress");
  const r = await handleUpdateState({
    workspace_path: ws, active_feature: "e139-8", status: "PASS", agent_id: "qa-engineer",
    completed_tasks: ["T-E139-8"], review_task_ids: ["T-E139-8"],
    pending_notes: ["QA: PASS"], qa_review: "forged pass with a forged verdict", review_verdict: "APPROVED",
  });
  assert.ok(r.isError);
  assert.match(text(r), new RegExp(CODE));
  assert.equal(fs.existsSync(path.join(ws, "qa_reports")), false, "step 10 rejects before QA_REVIEW_RECORD: qa_reports/ never created");

  // Same with a pre-existing evidence file: its bytes stay exactly as they were.
  const ws2 = mkWorkspace("e139-8b-");
  await seed(ws2, "e139-8b", "qa-engineer", "In_Progress");
  fs.mkdirSync(path.join(ws2, "qa_reports"), { recursive: true });
  const file = path.join(ws2, "qa_reports", "review_T-E139-8B.md");
  fs.writeFileSync(file, "# existing\n");
  const before = fs.readFileSync(file);
  const r2 = await handleUpdateState({
    workspace_path: ws2, active_feature: "e139-8b", status: "PASS", agent_id: "qa-engineer",
    completed_tasks: ["T-E139-8B"], review_task_ids: ["T-E139-8B"],
    pending_notes: ["QA: PASS"], qa_review: "forged", review_verdict: "CHANGES_REQUESTED",
  });
  assert.ok(r2.isError);
  assert.ok(before.equals(fs.readFileSync(file)));
  assert.deepEqual(fs.readdirSync(path.join(ws2, "qa_reports")), ["review_T-E139-8B.md"]);
});
