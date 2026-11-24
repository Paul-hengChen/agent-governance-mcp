// Coded by @qa-engineer
// Tests for spec: specs/e230-pm-amend-and-resume-hint.md (AC9-AC14, E151). A rejected
// pm:In_Progress -> code-reviewer:In_Progress write must name the Amend-Resume edge
// and the resume_of field that opens it; every other rejection keeps the static hint,
// plus the E435 in-flight hint on a removed old-path step.
// E435 (specs/e435-remove-old-path-architecture.md): pm -> qa-engineer is an ordinary
// edge, so resume_of names only code-reviewer and only one conditional entry remains.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { validateTransition, ALLOWED_TRANSITIONS } from "../dist/tools/transitions.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const HINT_STATIC = " in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md.";

function req(prev, next, extra = {}) {
  return { prev, next, prev_review_round: 0, ...extra };
}
const PM = { agent: "pm", status: "In_Progress" };

// E435 copy texts (architecture Copy / Strings), frozen here so a wording drift shows up red.
const IN_FLIGHT_HINT =
  " If this feature started on the pre-v5 chain, docs/migration-v5.md says how to finish or restart it.";
const PM_TO_SR_HINT = (a) =>
  ` The build entry is qa-engineer: hand off ${a}:In_Progress → qa-engineer:In_Progress; qa-engineer writes the scenario tests, or records that the ticket needs no new test, before sr-engineer builds.`;
const QA_JUDGE_HINT =
  " qa-engineer writes tests and never writes PASS or FAIL: code-reviewer is the judge and writes them from code-reviewer:In_Progress.";

function s1(role, received) {
  return (
    `No edge pm:In_Progress → ${role}:In_Progress in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md. ` +
    `Amend-Resume edge: set resume_of: "${role}" on this write itself (the resuming write, not only the PM amendment) ` +
    `to open pm:In_Progress → ${role}:In_Progress; received resume_of: ${received}.`
  );
}

const CONDITIONAL = [
  { new_agent: "code-reviewer", new_status: "In_Progress", requires: { resume_of: "code-reviewer" } },
];

function staticPmList() {
  const row = ALLOWED_TRANSITIONS.get("pm:In_Progress");
  assert.ok(row, "static pm:In_Progress row must exist");
  return row.map((c) => ({ new_agent: c.agent, new_status: c.status }));
}

test("AC9 (E435): allowed = six static pm:In_Progress entries (qa-engineer the build entry, no sr-engineer) then the one code-reviewer conditional entry", () => {
  // WHY: the writer sees the edge exists and what field opens it, without the static table changing.
  const r = validateTransition(req(PM, { agent: "code-reviewer", status: "In_Progress" }));
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
  const stat = staticPmList();
  assert.equal(stat.length, 6);
  assert.ok(stat.some((e) => e.new_agent === "qa-engineer" && e.new_status === "In_Progress"), "pm -> qa-engineer is a table edge (AC1)");
  assert.ok(!stat.some((e) => e.new_agent === "sr-engineer"), "pm -> sr-engineer is not an edge (AC1)");
  assert.deepEqual(r.allowed, [...stat, ...CONDITIONAL]);
});

test("AC10: hint is S1 byte-for-byte with received=absent", () => {
  const r = validateTransition(req(PM, { agent: "code-reviewer", status: "In_Progress" }));
  assert.equal(r.hint, s1("code-reviewer", "absent"));
});

test("AC11 (E435): wrong-role resume_of on the code-reviewer resume keeps the AC9 list and names the received value; on pm -> qa-engineer it is irrelevant", () => {
  // pm -> qa-engineer is an ordinary table edge now: a resume_of naming another role cannot close it.
  const a = validateTransition(
    req(PM, { agent: "qa-engineer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }),
  );
  assert.equal(a, null);
  // A stale pre-v5 value reaching validateTransition directly (the zod boundary rejects it on the tool path).
  const b = validateTransition(
    req(PM, { agent: "code-reviewer", status: "In_Progress" }, { next_resume_of: "qa-engineer" }),
  );
  assert.deepEqual(b.allowed, [...staticPmList(), ...CONDITIONAL]);
  assert.equal(b.hint, s1("code-reviewer", '"qa-engineer"'));
});

test("AC12 (E435): every other rejection has no requires entry and the static hint, plus only the in-flight hint on a removed old-path step", () => {
  // WHY: enrichment must not leak onto unrelated rejections (envelope stays byte-identical);
  // a removed old-path step (S1, S4) appends its step hint + the docs/migration-v5.md hint (AC3).
  const cases = [
    [PM, { agent: "qa-engineer", status: "PASS" }, {}, QA_JUDGE_HINT + IN_FLIGHT_HINT],
    [PM, { agent: "code-reviewer", status: "FAIL" }, {}, ""],
    [{ agent: "pm", status: "Blocked" }, { agent: "code-reviewer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }, ""],
    [{ agent: "sr-engineer", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }, {}, QA_JUDGE_HINT + IN_FLIGHT_HINT],
    [PM, { agent: "sr-engineer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }, PM_TO_SR_HINT("pm") + IN_FLIGHT_HINT],
  ];
  for (const [prev, next, extra, suffix] of cases) {
    const r = validateTransition(req(prev, next, extra));
    const label = `${prev.agent}:${prev.status} -> ${next.agent}:${next.status}`;
    assert.ok(r, label);
    assert.equal(r.error, "TRANSITION_REJECTED", label);
    assert.ok(!r.allowed.some((a) => "requires" in a), `${label}: no requires key`);
    assert.equal(
      r.hint,
      `No edge ${prev.agent}:${prev.status} → ${next.agent}:${next.status}${HINT_STATIC}${suffix}`,
      label,
    );
  }
});

test("AC13 (E435): handler path returns ⛔ TRANSITION_REJECTED with the code-reviewer conditional entry and S1", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e151-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "e151-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["amend"],
    lastAgent: "pm",
    cutApproved: true,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e151-feat",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["resuming"],
  });
  assert.equal(res.isError, true);
  const text = res.content[0].text;
  assert.ok(text.startsWith("⛔ TRANSITION_REJECTED"), text);
  const body = JSON.parse(text.slice(text.indexOf("{")));
  assert.deepEqual(body.allowed, [...staticPmList(), ...CONDITIONAL]);
  assert.equal(body.hint, s1("code-reviewer", "absent"));
});

test("AC14 (E435): the code-reviewer resume is accepted with resume_of; pm -> qa-engineer is accepted without one", () => {
  const cr = validateTransition(req(PM, { agent: "code-reviewer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }));
  assert.equal(cr, null, "code-reviewer resume");
  const qa = validateTransition(req(PM, { agent: "qa-engineer", status: "In_Progress" }));
  assert.equal(qa, null, "pm -> qa-engineer is the build entry, no resume_of (AC1)");
});
