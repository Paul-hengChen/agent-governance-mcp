// Coded by @qa-engineer
// Tests for spec: specs/e230-pm-amend-and-resume-hint.md (AC9-AC14, E151). A rejected
// pm:In_Progress -> {code-reviewer,qa-engineer}:In_Progress write must name the Amend-Resume edge
// and the resume_of field that opens it; every other rejection stays byte-identical.

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
  return { prev, next, prev_qa_round: 0, prev_review_round: 0, ...extra };
}
const PM = { agent: "pm", status: "In_Progress" };

function s1(role, received) {
  return (
    `No edge pm:In_Progress → ${role}:In_Progress in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md. ` +
    `Amend-Resume edge: set resume_of: "${role}" on this write itself (the resuming write, not only the PM amendment) ` +
    `to open pm:In_Progress → ${role}:In_Progress; received resume_of: ${received}.`
  );
}

const CONDITIONAL = [
  { new_agent: "code-reviewer", new_status: "In_Progress", requires: { resume_of: "code-reviewer" } },
  { new_agent: "qa-engineer", new_status: "In_Progress", requires: { resume_of: "qa-engineer" } },
];

function staticPmList() {
  const row = ALLOWED_TRANSITIONS.get("pm:In_Progress");
  assert.ok(row, "static pm:In_Progress row must exist");
  return row.map((c) => ({ new_agent: c.agent, new_status: c.status }));
}

test("AC9: allowed = six static pm:In_Progress entries then the two conditional entries", () => {
  // WHY: the writer sees the edge exists and what field opens it, without the static table changing.
  const r = validateTransition(req(PM, { agent: "code-reviewer", status: "In_Progress" }));
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
  const stat = staticPmList();
  assert.equal(stat.length, 6);
  assert.deepEqual(r.allowed, [...stat, ...CONDITIONAL]);
});

test("AC10: hint is S1 byte-for-byte with received=absent", () => {
  const r = validateTransition(req(PM, { agent: "code-reviewer", status: "In_Progress" }));
  assert.equal(r.hint, s1("code-reviewer", "absent"));
});

test("AC11: wrong-role resume_of keeps the AC9 list and names the received value", () => {
  const a = validateTransition(
    req(PM, { agent: "qa-engineer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }),
  );
  assert.deepEqual(a.allowed, [...staticPmList(), ...CONDITIONAL]);
  assert.equal(a.hint, s1("qa-engineer", '"code-reviewer"'));
  const b = validateTransition(
    req(PM, { agent: "code-reviewer", status: "In_Progress" }, { next_resume_of: "qa-engineer" }),
  );
  assert.deepEqual(b.allowed, [...staticPmList(), ...CONDITIONAL]);
  assert.equal(b.hint, s1("code-reviewer", '"qa-engineer"'));
});

test("AC12: every other rejection has no requires entry and the unchanged static hint", () => {
  // WHY: enrichment must not leak onto unrelated rejections (envelope stays byte-identical).
  const cases = [
    [PM, { agent: "qa-engineer", status: "PASS" }, {}],
    [PM, { agent: "code-reviewer", status: "FAIL" }, {}],
    [{ agent: "pm", status: "Blocked" }, { agent: "code-reviewer", status: "In_Progress" }, { next_resume_of: "code-reviewer" }],
    [{ agent: "sr-engineer", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }, {}],
  ];
  for (const [prev, next, extra] of cases) {
    const r = validateTransition(req(prev, next, extra));
    const label = `${prev.agent}:${prev.status} -> ${next.agent}:${next.status}`;
    assert.ok(r, label);
    assert.equal(r.error, "TRANSITION_REJECTED", label);
    assert.ok(!r.allowed.some((a) => "requires" in a), `${label}: no requires key`);
    assert.equal(
      r.hint,
      `No edge ${prev.agent}:${prev.status} → ${next.agent}:${next.status}${HINT_STATIC}`,
      label,
    );
  }
});

test("AC13: handler path returns ⛔ TRANSITION_REJECTED with the conditional entries and S1", async () => {
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
  assert.deepEqual(body.allowed.slice(-2), CONDITIONAL);
  assert.equal(body.hint, s1("code-reviewer", "absent"));
});

test("AC14: both resume accept paths are still accepted", () => {
  for (const role of ["code-reviewer", "qa-engineer"]) {
    const r = validateTransition(req(PM, { agent: role, status: "In_Progress" }, { next_resume_of: role }));
    assert.equal(r, null, role);
  }
});
