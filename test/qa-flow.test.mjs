// Coded by @qa-engineer
// Tests for tools/transitions.ts + tools/evidence-file.ts + handoff qa_round
// round-trip (v3.2.0 QA-Flow Enforcement). Imports compiled dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  validateTransition,
  computeNewRound,
  requireQaEngineer,
  ALLOWED_TRANSITIONS,
} from "../dist/tools/transitions.js";
import { recordReviewInFile, hasEvidenceInFile } from "../dist/tools/evidence-file.js";
import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

function mkWorkspace(prefix = "twqa-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// ---------- requireQaEngineer (A — handler-side agent gate) ----------

test("requireQaEngineer accepts agent_id='qa-engineer'", () => {
  assert.deepEqual(requireQaEngineer("qa-engineer", "tw_complete_task"), { ok: true });
});

test("requireQaEngineer rejects sr-engineer with explicit blame text", () => {
  const r = requireQaEngineer("sr-engineer", "tw_complete_task");
  assert.equal(r.ok, false);
  assert.match(r.message, /tw_complete_task is reserved for qa-engineer/);
  assert.match(r.message, /sr-engineer/);
});

test("requireQaEngineer rejects undefined and flags 'unidentified agent'", () => {
  const r = requireQaEngineer(undefined, "tw_update_state(status=PASS)");
  assert.equal(r.ok, false);
  assert.match(r.message, /unidentified agent/);
});

// ---------- validateTransition — fresh workspace ----------

test("validateTransition: null→(pm, In_Progress) accepted", () => {
  const r = validateTransition({
    prev: { agent: null, status: null },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
  });
  assert.equal(r, null);
});

test("validateTransition: null→(researcher, In_Progress) accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: null, status: null },
      next: { agent: "researcher", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: null→(sr-engineer, In_Progress) REJECTED — must start at pm/researcher", () => {
  const r = validateTransition({
    prev: { agent: null, status: null },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.equal(r.attempted.prev_agent, null);
  assert.equal(r.attempted.new_agent, "sr-engineer");
  assert.ok(Array.isArray(r.allowed));
});

test("validateTransition: null→(qa-engineer, PASS) REJECTED", () => {
  const r = validateTransition({
    prev: { agent: null, status: null },
    next: { agent: "qa-engineer", status: "PASS" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- validateTransition — pm transitions ----------

test("validateTransition: pm→architect accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "architect", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: pm→sr-engineer accepted (skip architect)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "sr-engineer", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: pm→qa-engineer REJECTED (must go through sr-engineer)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- validateTransition — sr-engineer / qa-engineer happy path ----------

test("validateTransition: sr-engineer→qa-engineer accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "sr-engineer", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: sr-engineer→PASS REJECTED (must enter qa-engineer first)", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "PASS" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("validateTransition: qa-engineer In_Progress→PASS accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "PASS" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: qa-engineer In_Progress→FAIL accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "FAIL" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: qa-engineer FAIL→sr-engineer accepted (round retry)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "FAIL" },
      next: { agent: "sr-engineer", status: "In_Progress" },
      prev_qa_round: 1,
    }),
    null,
  );
});

test("validateTransition: qa-engineer PASS→pm accepted (next feature)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "PASS" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

// ---------- self-loop fast path ----------

test("validateTransition: same-agent self-loop In_Progress→In_Progress accepted (sr-engineer)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "sr-engineer", status: "In_Progress" },
      next: { agent: "sr-engineer", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: self-loop does NOT apply across status change", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "sr-engineer", status: "PASS" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- round-cap override ----------

test("validateTransition: prev_qa_round=4 only allows (pm, In_Progress)", () => {
  const okR = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 4,
  });
  assert.equal(okR, null);

  const blocked = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 4,
  });
  assert.ok(blocked);
  assert.equal(blocked.error, "QA_ROUND_EXCEEDED");
});

test("validateTransition: round-cap also blocks PASS from qa-engineer", () => {
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "PASS" },
    prev_qa_round: 4,
  });
  assert.ok(r);
  assert.equal(r.error, "QA_ROUND_EXCEEDED");
});

// ---------- AGENT_ID_REQUIRED ----------

test("validateTransition: missing next.agent → AGENT_ID_REQUIRED", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: null, status: "In_Progress" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "AGENT_ID_REQUIRED");
});

// ---------- rejection envelope shape ----------

test("rejection envelope carries attempted + allowed + hint", () => {
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "PASS" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.attempted.prev_agent, "sr-engineer");
  assert.equal(r.attempted.new_status, "PASS");
  assert.equal(r.attempted.qa_round, 0);
  assert.ok(Array.isArray(r.allowed));
  assert.ok(r.allowed.length > 0);
  assert.equal(typeof r.hint, "string");
});

// ---------- ALLOWED_TRANSITIONS map exposed ----------

test("ALLOWED_TRANSITIONS map has known keys", () => {
  assert.ok(ALLOWED_TRANSITIONS instanceof Map);
  assert.ok(ALLOWED_TRANSITIONS.has("null:null"));
  assert.ok(ALLOWED_TRANSITIONS.has("sr-engineer:In_Progress"));
  assert.ok(ALLOWED_TRANSITIONS.has("qa-engineer:In_Progress"));
});

// ---------- computeNewRound ----------

test("computeNewRound: (qa-engineer, FAIL) increments", () => {
  assert.equal(computeNewRound(0, { agent: "qa-engineer", status: "FAIL" }), 1);
  assert.equal(computeNewRound(2, { agent: "qa-engineer", status: "FAIL" }), 3);
  assert.equal(computeNewRound(3, { agent: "qa-engineer", status: "FAIL" }), 4); // enter Round 4
});

test("computeNewRound: (qa-engineer, PASS) resets to 0", () => {
  assert.equal(computeNewRound(3, { agent: "qa-engineer", status: "PASS" }), 0);
  assert.equal(computeNewRound(0, { agent: "qa-engineer", status: "PASS" }), 0);
});

test("computeNewRound: (pm, In_Progress) resets to 0 (re-entry)", () => {
  assert.equal(computeNewRound(4, { agent: "pm", status: "In_Progress" }), 0);
});

test("computeNewRound: other writes hold prev unchanged", () => {
  assert.equal(computeNewRound(2, { agent: "sr-engineer", status: "In_Progress" }), 2);
  assert.equal(computeNewRound(2, { agent: "qa-engineer", status: "In_Progress" }), 2);
  assert.equal(computeNewRound(2, { agent: "pm", status: "Blocked" }), 2);
});

// ---------- evidence-file: recordReview + hasEvidence ----------

test("hasEvidenceInFile: missing returns all in missing[]", () => {
  const ws = mkWorkspace();
  const result = hasEvidenceInFile(ws, ["T01", "T02"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T01", "T02"]);
});

test("recordReviewInFile creates qa_reports/review_<id>.md per task", async () => {
  const ws = mkWorkspace();
  await recordReviewInFile(ws, ["T01", "T02"], "PASS", "qa-engineer", "all checks green");
  const p1 = path.join(ws, "qa_reports", "review_T01.md");
  const p2 = path.join(ws, "qa_reports", "review_T02.md");
  assert.ok(fs.existsSync(p1));
  assert.ok(fs.existsSync(p2));
  const body = fs.readFileSync(p1, "utf-8");
  assert.match(body, /^# QA review — T01/);
  assert.match(body, /PASS — by qa-engineer/);
  assert.match(body, /all checks green/);
});

test("recordReviewInFile appends new round without truncating prior content", async () => {
  const ws = mkWorkspace();
  await recordReviewInFile(ws, ["T01"], "FAIL", "qa-engineer", "round 1 — found bug");
  await recordReviewInFile(ws, ["T01"], "PASS", "qa-engineer", "round 2 — bug fixed");
  const body = fs.readFileSync(path.join(ws, "qa_reports", "review_T01.md"), "utf-8");
  assert.match(body, /round 1 — found bug/);
  assert.match(body, /round 2 — bug fixed/);
  // Two ## sections expected
  const sectionCount = (body.match(/^## /gm) ?? []).length;
  assert.equal(sectionCount, 2);
});

test("hasEvidenceInFile: present after recordReview", async () => {
  const ws = mkWorkspace();
  await recordReviewInFile(ws, ["T01"], "PASS", "qa-engineer", "ok");
  const result = hasEvidenceInFile(ws, ["T01", "T02"]);
  assert.deepEqual(result.present, ["T01"]);
  assert.deepEqual(result.missing, ["T02"]);
});

test("recordReviewInFile sanitises path-traversal in task id", async () => {
  const ws = mkWorkspace();
  await recordReviewInFile(ws, ["../escape"], "PASS", "qa-engineer", "nope");
  // Resulting file must live inside qa_reports/, not above
  const evilEscape = path.join(ws, "qa_reports", "review_..", "escape.md");
  assert.equal(fs.existsSync(evilEscape), false);
  const safe = path.join(ws, "qa_reports", "review_.._escape.md");
  assert.ok(fs.existsSync(safe));
});

// ---------- handoff qa_round round-trip ----------

test("writeHandoffState → parseHandoff preserves qa_round when set", async () => {
  const ws = mkWorkspace("twqar-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState(ws, "feat", "In_Progress", [], [], undefined, "qa-engineer", 2);
  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 2);
});

test("writeHandoffState defaults qa_round to 0 when undefined", async () => {
  const ws = mkWorkspace("twqar-");
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState(ws, "feat", "In_Progress", [], [], undefined, undefined);
  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
});

test("parseHandoff backward-compat: missing qa_round frontmatter → 0", () => {
  const ws = mkWorkspace("twqar-");
  const body = `---
active_feature: "legacy-feature"
status: "In_Progress"
last_updated: "2026-05-13T00:00:00.000Z"
---
# 📍 Handoff
## ✅ Completed
- 無
## ⚠️ Pending
- 無
`;
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body);
  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
});

test("parseHandoff sanitises negative / NaN qa_round to 0", () => {
  const ws = mkWorkspace("twqar-");
  const body = `---
active_feature: "feat"
status: "In_Progress"
last_updated: "2026-05-13T00:00:00.000Z"
qa_round: -7
---
# Handoff
## Completed
- 無
## Pending
- 無
`;
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body);
  assert.equal(parseHandoff(ws).qa_round, 0);
});
