// Coded by @qa-engineer
// Tests for backlog E38 (docs/backlog.md row E38) / T-E38-01: the
// write-time next_role LOOKAHEAD ADVISORY. tools/handoff-orchestrator.ts
// (effectiveAllowedSuccessors, :1231-1300ish, and the post-write advisory
// block feeding the E28-precedent success-envelope `warnings` array) is the
// unit under test. Non-rejecting by construction: no GATE_REGISTRY entry, no
// error code, no pipeline step. The feature's entire value is that the
// warning can be trusted — both defects code-reviewer found in
// review_reports/review_T-E38-01.md (round 1: hardcoded feature_changed:false
// false-warned on the just-shipped E37 qa-engineer:PASS -> design-auditor
// edge at hop cap; round 2: an over-broad self-loop filter emptied the
// remedy list on qa-engineer:In_Progress / pm:Blocked, printing a
// categorically false "(none ...)" message) were INVISIBLE in the diff and
// found only by sweeping states x counter regimes — so these tests go
// through the tw_update_state tool boundary (the shape a user actually
// sees), not just the bare helper.
//
// No specs/<feature>.md exists — the backlog row + review_reports/review_T-E38-01.md
// (three rounds) are the spec. File placement: no existing test file (e28's,
// e35's, qa-flow's) covers next_role-lookahead scope, so this is a new file,
// mirroring test/e28-shrink-warning.test.mjs's through-the-tool pattern (same
// warnings-array envelope mechanism, same seed-then-single-write shape).
//
// Spec-to-test map:
//   live 07-23 shape fires, remedy names pm:In_Progress + sr-engineer:In_Progress -> L1
//   E37 edge silent at hop 2 (trivially, in-table)                          -> S-E37-lo
//   E37 edge silent at hop 10 (the ROUND-1 REGRESSION PIN)                  -> S-E37-hi
//   resume_of whitelist: pm:In_Progress + next_role=code-reviewer silent    -> S-RESUME
//   round-cap collapse whitelist: qa_round at cap, next_role=pm silent     -> S-ROUNDCAP
//   self-loop whitelist: sr-engineer:In_Progress self-loop silent          -> S-SELFLOOP
//   non-empty, NAMED remedy on qa-engineer:In_Progress (ROUND-2 REGRESSION
//     PIN — round 2 emptied this exact list)                                -> R-QA-IP
//   non-empty, NAMED remedy on pm:Blocked (ROUND-2 REGRESSION PIN)          -> R-PM-BLOCKED
//   never rejects: bogus next_role still succeeds and persists             -> N-NEVERREJECT
//   coexists with E28: one write, two warnings, neither clobbers the other -> C-E28COEXIST

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const FEATURE = "e38-feat";

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-e38-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// Seeds a prior handoff state directly (bypassing tool-level gates, exactly
// like test/e28-shrink-warning.test.mjs and test/hop-count-transitions.test.mjs
// do), then arms the session so the SINGLE follow-up tw_update_state call
// under test is the only write exercising the gate pipeline.
async function seedAndRead(opts) {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWs();
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: FEATURE,
    status: opts.status ?? "In_Progress",
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: opts.lastAgent,
    hopCount: opts.hopCount ?? 0,
    qaRound: opts.qaRound ?? 0,
    reviewRound: opts.reviewRound ?? 0,
    visualRound: opts.visualRound ?? 0,
    ...(opts.seed ?? {}),
  });
  resetSession();
  markStateRead(ws);
  return ws;
}

async function runUpdate(ws, args) {
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: FEATURE,
    completed_tasks: [],
    pending_notes: ["e38 probe write"],
    ...args,
  });
  return result;
}

function envelopeOf(result) {
  assert.ok(!result.isError, `write must succeed; got: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content[0].text);
}

// Extracts the "Actual allowed next (agent:status) pair(s): X." segment from
// a next_role warning string, so tests assert on the NAMED successors rather
// than merely "the string is non-empty" — the round-2 regression printed a
// non-empty-LOOKING but categorically FALSE message, so presence alone is
// not a sufficient pin.
function remedyOf(warning) {
  const m = warning.match(/pair\(s\): (.*?)\. next_role is advisory-only/);
  assert.ok(m, `warning must contain the "pair(s): ..." remedy segment; got: ${warning}`);
  return m[1];
}

// ============================================================================
// L1: fires correctly on the live 2026-07-23 shape
// ============================================================================

test("L1: qa-engineer:FAIL + next_role=design-auditor warns, remedy names pm:In_Progress and sr-engineer:In_Progress", async () => {
  const ws = await seedAndRead({ lastAgent: "qa-engineer", status: "In_Progress", hopCount: 3 });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "FAIL",
    blocking_reason: "e38 L1 probe FAIL",
    next_role: "design-auditor",
  });
  const envelope = envelopeOf(result);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1, "exactly one warning expected");
  const warning = envelope.warnings[0];
  assert.match(warning, /next_role="design-auditor"/);
  assert.match(warning, /qa-engineer:FAIL/, "warning must name the state just written");
  const remedy = remedyOf(warning);
  assert.match(remedy, /pm:In_Progress/, "remedy must name pm:In_Progress");
  assert.match(remedy, /sr-engineer:In_Progress/, "remedy must name sr-engineer:In_Progress");
});

// ============================================================================
// S-E37-lo / S-E37-hi: silent on E37's newly-legal edge, at hop 2 AND hop 10.
// hop 10 is the ROUND-1 REGRESSION PIN: the hardcoded feature_changed:false
// bug computed a SMALLER allowed set at hop cap and would have false-warned
// on exactly this edge, re-emitting as prose the false signal E37 shipped
// one commit earlier to delete.
// ============================================================================

test("S-E37-lo: qa-engineer:PASS + next_role=design-auditor is silent at hop_count=2", async () => {
  const ws = await seedAndRead({ lastAgent: "qa-engineer", status: "In_Progress", hopCount: 2 });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "PASS",
    qa_review: undefined,
    next_role: "design-auditor",
  });
  const envelope = envelopeOf(result);
  assert.equal(envelope.warnings, undefined, "E37 edge must stay silent below hop cap");
});

test("S-E37-hi (ROUND-1 REGRESSION PIN): qa-engineer:PASS + next_role=design-auditor is silent at hop_count=10 (HOP_CAP)", async () => {
  // PASS from qa-engineer:In_Progress is a same-agent status change, not a
  // role transition (DR-9) — hop_count does NOT increment on this write, so
  // seeding hopCount=10 reproduces new_hop_count=10 exactly, the counters
  // effectiveAllowedSuccessors is evaluated against.
  const ws = await seedAndRead({ lastAgent: "qa-engineer", status: "In_Progress", hopCount: 10 });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "PASS",
    next_role: "design-auditor",
  });
  const envelope = envelopeOf(result);
  assert.equal(
    envelope.warnings,
    undefined,
    "at hop cap, design-auditor is still reachable via the feature_changed=true branch (E37's opening edge) — " +
      "a warning here is exactly the round-1 hardcoded-feature_changed:false regression",
  );
});

// ============================================================================
// S-RESUME / S-ROUNDCAP / S-SELFLOOP: silent on each of the three whitelists
// the backlog row mandates.
// ============================================================================

test("S-RESUME: pm:In_Progress + next_role=code-reviewer is silent (resume_of whitelist)", async () => {
  const ws = await seedAndRead({ lastAgent: "researcher", status: "In_Progress" });
  const result = await runUpdate(ws, {
    agent_id: "pm",
    status: "In_Progress",
    next_role: "code-reviewer",
  });
  const envelope = envelopeOf(result);
  assert.equal(
    envelope.warnings,
    undefined,
    "pm:In_Progress -> code-reviewer:In_Progress is legal with resume_of set; the helper assumes " +
      "resume_of generously by default, so this must stay silent",
  );
});

test("S-ROUNDCAP: qa_round at cap collapses the allowed set to pm alone, and next_role=pm is silent", async () => {
  const ws = await seedAndRead({ lastAgent: "qa-engineer", status: "In_Progress", qaRound: 3 });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "FAIL",
    blocking_reason: "e38 round-cap probe",
    next_role: "pm",
  });
  const envelope = envelopeOf(result);
  assert.equal(
    envelope.warnings,
    undefined,
    "new_qa_round reaches 4 (ROUND_CAP) on this write; the collapsed effective set is {pm:In_Progress} " +
      "exactly, and next_role=pm names it, so this must stay silent",
  );
});

test("S-SELFLOOP: sr-engineer:In_Progress self-loop (next_role=sr-engineer) is silent", async () => {
  // pm:In_Progress -> sr-engineer:In_Progress is a build-entry hop gated by
  // CUT_APPROVAL_REQUIRED — orthogonal to E38, so clear it on the seed.
  const ws = await seedAndRead({ lastAgent: "pm", status: "In_Progress", seed: { cutApproved: true } });
  const result = await runUpdate(ws, {
    agent_id: "sr-engineer",
    status: "In_Progress",
    next_role: "sr-engineer",
  });
  const envelope = envelopeOf(result);
  assert.equal(
    envelope.warnings,
    undefined,
    "the In_Progress->In_Progress self-loop fast path makes staying sr-engineer legal, so this must stay silent",
  );
});

// ============================================================================
// R-QA-IP / R-PM-BLOCKED: the ROUND-2 REGRESSION PIN. Round 2's over-broad
// `e.agent === nextTuple.agent` filter emptied the remedy list on exactly
// these two states (every legal successor is same-agent), printing the
// categorically false "(none ...)" fallback. Assert the REAL successors are
// named, not merely that the string is non-empty.
// ============================================================================

test("R-QA-IP (ROUND-2 REGRESSION PIN): qa-engineer:In_Progress remedy names PASS/FAIL/Blocked, excludes the self-loop", async () => {
  const ws = await seedAndRead({ lastAgent: "code-reviewer", status: "In_Progress" });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "In_Progress",
    next_role: "architect", // deliberately bogus, to force the warning path
  });
  const envelope = envelopeOf(result);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1);
  const remedy = remedyOf(envelope.warnings[0]);
  assert.match(remedy, /qa-engineer:PASS/);
  assert.match(remedy, /qa-engineer:FAIL/);
  assert.match(remedy, /qa-engineer:Blocked/);
  assert.doesNotMatch(
    remedy,
    /qa-engineer:In_Progress/,
    "the exact (agent,status) pair just written (the true self-loop) must be excluded from the remedy, " +
      "but the real same-agent STATUS CHANGES above must survive — round 2's bug was excluding ALL of them",
  );
  assert.notEqual(remedy, "(none — no successor is currently reachable from this state)");
});

test("R-PM-BLOCKED (ROUND-2 REGRESSION PIN): pm:Blocked remedy names pm:In_Progress, excludes the self-loop", async () => {
  const ws = await seedAndRead({ lastAgent: "pm", status: "In_Progress" });
  const result = await runUpdate(ws, {
    agent_id: "pm",
    status: "Blocked",
    blocking_reason: "e38 pm:Blocked probe",
    next_role: "architect", // deliberately bogus, to force the warning path
  });
  const envelope = envelopeOf(result);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1);
  const remedy = remedyOf(envelope.warnings[0]);
  assert.match(remedy, /pm:In_Progress/);
  assert.doesNotMatch(
    remedy,
    /pm:Blocked/,
    "the exact (agent,status) pair just written must be excluded — round 2's bug emptied this list entirely",
  );
  assert.notEqual(remedy, "(none — no successor is currently reachable from this state)");
});

// ============================================================================
// N-NEVERREJECT: the advisory is provably incapable of failing a write, even
// with a next_role that is not just wrong but wildly implausible.
// ============================================================================

test("N-NEVERREJECT: a write carrying a bogus next_role still succeeds and still persists", async () => {
  const ws = await seedAndRead({ lastAgent: "qa-engineer", status: "In_Progress", hopCount: 1 });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "FAIL",
    blocking_reason: "e38 never-reject probe",
    next_role: "release-engineer", // not in {sr-engineer, pm} — the actual allowed set
  });
  assert.ok(!result.isError, "the write itself must never be rejected by the advisory");
  const envelope = JSON.parse(result.content[0].text);
  assert.equal(envelope.success, true);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1, "it still warns — just never rejects");

  // Confirm the underlying state write actually persisted, independent of
  // the advisory's own success.
  const storage = new FileHandoffStorage();
  const persisted = storage.parse(ws);
  assert.equal(persisted.active_feature, FEATURE);
  assert.equal(persisted.status, "FAIL");
  assert.equal(persisted.last_agent, "qa-engineer");
});

// ============================================================================
// C-E28COEXIST: a write that trips BOTH the E28 shrink warning and the E38
// lookahead advisory must carry both entries in `warnings`, neither
// clobbering the other.
// ============================================================================

test("C-E28COEXIST: a single write triggering both a shrink warning and a lookahead advisory yields both, uncorrupted", async () => {
  const ws = await seedAndRead({
    lastAgent: "qa-engineer",
    status: "In_Progress",
    seed: { dispatchPins: { "sr-engineer": "fable", "release-engineer": "opus" } },
  });
  const result = await runUpdate(ws, {
    agent_id: "qa-engineer",
    status: "FAIL",
    blocking_reason: "e38/e28 coexistence probe",
    dispatch_pins: { "sr-engineer": "fable" }, // drops release-engineer -> E28 shrink warning
    next_role: "design-auditor", // not in {sr-engineer, pm} for qa-engineer:FAIL -> E38 advisory
  });
  const envelope = envelopeOf(result);
  assert.ok(Array.isArray(envelope.warnings), "warnings array must be present");
  assert.equal(envelope.warnings.length, 2, "both the shrink warning and the lookahead advisory must be present");
  const shrink = envelope.warnings.find((w) => /dispatch_pins/.test(w));
  const lookahead = envelope.warnings.find((w) => /next_role="design-auditor"/.test(w));
  assert.ok(shrink, "E28 shrink warning must be present");
  assert.ok(lookahead, "E38 lookahead advisory must be present");
  assert.match(shrink, /release-engineer/, "shrink warning must still name the dropped pin");
  const remedy = remedyOf(lookahead);
  assert.match(remedy, /pm:In_Progress/);
  assert.match(remedy, /sr-engineer:In_Progress/);
});
