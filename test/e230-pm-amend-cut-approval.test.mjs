// Coded by @qa-engineer
// Tests for spec: specs/e230-pm-amend-and-resume-hint.md (AC1, AC2, AC4, AC5, AC6; AC3/AC7 are
// pinned by R5 / R1 / R3 in test/cut-approval-gate.test.mjs). A pm:In_Progress write over an
// on-disk pm:In_Progress tuple of the same feature is an amendment and keeps cut_approved;
// every other PM In_Progress write re-arms, and an explicit false always re-arms.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { hasCutApproval } from "../dist/gates/cut-approval.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const FEATURE = "e230-feat";

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e230-amend-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function write(ws, opts) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: opts.activeFeature ?? FEATURE,
    status: opts.status ?? "In_Progress",
    completedTasks: [],
    pendingNotes: opts.pendingNotes ?? ["note"],
    lastAgent: opts.lastAgent,
    ...(opts.cutApproved !== undefined ? { cutApproved: opts.cutApproved } : {}),
    ...(opts.blockingReason ? { blockingReason: opts.blockingReason } : {}),
  });
  forceSeedStamp(ws);
}

// ---- AC1 ------------------------------------------------------------------

test("AC1: pm:In_Progress amendment on the same feature omitting cut_approved keeps true", async () => {
  // WHY: the amendment is not a re-entry; losing the human's approval forced a double approval.
  const ws = mkWs();
  await write(ws, { lastAgent: "pm", cutApproved: true });
  await write(ws, { lastAgent: "pm", pendingNotes: ["amend"] });
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, true);
  assert.equal(hasCutApproval(state), true);
});

// ---- AC2 (handler-level incident sequence) --------------------------------

test("AC2: incident sequence (pm approve, pm dispatch_pins-only amendment, sr-engineer) is NOT rejected CUT_APPROVAL_REQUIRED", async () => {
  // WHY: replays the E230 incident through the real pipeline: persisting dispatch_pins on the
  // approved tuple must not re-arm the gate for the next build-entry hop.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await write(ws, { lastAgent: "pm", cutApproved: true });

  resetSession(ws);
  markStateRead(ws);
  const amend = await handleUpdateState({
    workspace_path: ws,
    active_feature: FEATURE,
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: persisting dispatch pins"],
    scope_decision: "single-feature",
    dispatch_pins: { "sr-engineer": "opus" },
  });
  assert.ok(!amend.isError, `pm amendment must succeed: ${amend.content?.[0]?.text}`);
  forceSeedStamp(ws);
  const mid = parseHandoff(ws);
  assert.equal(mid.cut_approved, true, "amendment must keep cut_approved");
  assert.deepEqual(mid.dispatch_pins, { "sr-engineer": "opus" });

  resetSession(ws);
  markStateRead(ws);
  const sr = await handleUpdateState({
    workspace_path: ws,
    active_feature: FEATURE,
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: ["sr-engineer: starting"],
  });
  const text = sr.content?.[0]?.text ?? "";
  assert.ok(!sr.isError, `sr-engineer build entry must not be rejected: ${text}`);
  assert.ok(!text.includes("CUT_APPROVAL_REQUIRED"));
});

// ---- AC4 ------------------------------------------------------------------

for (const [label, pred] of [
  ["pm:Blocked", { lastAgent: "pm", status: "Blocked", blockingReason: "waiting" }],
  ["sr-engineer:In_Progress", { lastAgent: "sr-engineer", status: "In_Progress" }],
  ["code-reviewer:FAIL", { lastAgent: "code-reviewer", status: "FAIL", blockingReason: "changes" }],
]) {
  test(`AC4: pm:In_Progress write over ${label} predecessor omitting cut_approved re-arms`, async () => {
    // WHY: only the exact pm:In_Progress tuple is an amendment; pm:Blocked is the same-agent
    // boundary, the others are genuine re-entries.
    const ws = mkWs();
    await write(ws, { lastAgent: "pm", cutApproved: true });
    await write(ws, pred);
    await write(ws, { lastAgent: "pm" });
    const state = parseHandoff(ws);
    assert.equal(state.cut_approved, undefined);
    assert.equal(hasCutApproval(state), false);
  });
}

// ---- AC5 ------------------------------------------------------------------

test("AC5: pm:In_Progress write naming a different feature drops cut_approved", async () => {
  // WHY: approval is feature-scoped; a feature change re-arms even from a pm:In_Progress tuple.
  const ws = mkWs();
  await write(ws, { lastAgent: "pm", cutApproved: true });
  await write(ws, { lastAgent: "pm", activeFeature: "e230-other" });
  assert.equal(parseHandoff(ws).cut_approved, undefined);
});

// ---- AC6 ------------------------------------------------------------------

test("AC6 (writer): explicit cut_approved:false on an amendment clears it", async () => {
  // WHY: explicit false is the same-tuple revoke; it must not be treated as "omitted".
  const ws = mkWs();
  await write(ws, { lastAgent: "pm", cutApproved: true });
  await write(ws, { lastAgent: "pm", cutApproved: false });
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined);
  assert.equal(hasCutApproval(state), false);
});

test("AC6 (handler): cut_approved:false through the zod boundary clears it on an amendment", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await write(ws, { lastAgent: "pm", cutApproved: true });
  resetSession(ws);
  markStateRead(ws);
  const res = await handleUpdateState({
    workspace_path: ws,
    active_feature: FEATURE,
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: revoking approval"],
    scope_decision: "single-feature",
    cut_approved: false,
  });
  assert.ok(!res.isError, `pm amendment must succeed: ${res.content?.[0]?.text}`);
  const state = parseHandoff(ws);
  assert.equal(state.cut_approved, undefined);
  assert.equal(hasCutApproval(state), false);
});

// ---- AC7 (explicit true on a PM write still sets; non-PM carry is pinned by R1/R3) ----

test("AC7: explicit cut_approved:true on a PM write over a non-amendment predecessor still sets it", async () => {
  const ws = mkWs();
  await write(ws, { lastAgent: "sr-engineer" });
  await write(ws, { lastAgent: "pm", cutApproved: true });
  assert.equal(parseHandoff(ws).cut_approved, true);
});
