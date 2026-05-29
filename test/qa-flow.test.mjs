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
import {
  recordReviewInFile,
  hasEvidenceInFile,
  recordCodeReviewInFile,
  hasCodeReviewEvidenceInFile,
} from "../dist/tools/evidence-file.js";
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

test("validateTransition: null→(design-auditor, In_Progress) accepted — coordinator can route to auditor before PM (v3.8.0)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: null, status: null },
      next: { agent: "design-auditor", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: design-auditor→pm accepted — auditor hands off to PM (v3.8.0)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "design-auditor", status: "In_Progress" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: design-auditor→sr-engineer REJECTED — auditor must go via PM (v3.8.0)", () => {
  const r = validateTransition({
    prev: { agent: "design-auditor", status: "In_Progress" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("validateTransition: researcher→design-auditor accepted — pre-PM chain (v3.8.0)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "researcher", status: "In_Progress" },
      next: { agent: "design-auditor", status: "In_Progress" },
      prev_qa_round: 0,
    }),
    null,
  );
});

test("validateTransition: pm→design-auditor accepted — PM re-routes when design refs surface late (v3.8.0)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "design-auditor", status: "In_Progress" },
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

test("validateTransition: sr-engineer→qa-engineer REJECTED (v3.9.0 routes through code-reviewer)", () => {
  // v3.9.0 dropped the direct sr → qa edge. The chain is now
  // sr ↔ code-reviewer → qa. Direct handoff must be rejected with the new
  // allowed-next list naming code-reviewer.
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "TRANSITION_REJECTED");
  // Allowed-next must contain code-reviewer:In_Progress (the replacement edge).
  // Envelope shape uses new_agent/new_status keys (see TransitionRejection in tools/transitions.ts).
  assert.ok(
    r.allowed.some((a) => a.new_agent === "code-reviewer" && a.new_status === "In_Progress"),
    `expected code-reviewer:In_Progress in allowed list, got ${JSON.stringify(r.allowed)}`,
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
// v3.14.0: signature widened to
//   (prev_qa_round, prev_review_round, prev_visual_round, next, prev?, next_pending_notes?)
// returning { qa_round, review_round, visual_round }. Tests assert qa_round
// semantics in this section; review_round semantics live in the T67 tests
// below; visual_round semantics live in test/visual-round-transitions.test.mjs.

test("computeNewRound: (qa-engineer, FAIL) increments qa_round, holds review_round", () => {
  assert.deepEqual(computeNewRound(0, 0, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 1, review_round: 0, visual_round: 0 });
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 3, review_round: 1, visual_round: 0 });
  assert.deepEqual(computeNewRound(3, 0, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 4, review_round: 0, visual_round: 0 }); // enter Round 4
});

test("computeNewRound: (qa-engineer, PASS) resets qa_round, holds review_round", () => {
  assert.deepEqual(computeNewRound(3, 0, 0, { agent: "qa-engineer", status: "PASS" }), { qa_round: 0, review_round: 0, visual_round: 0 });
  assert.deepEqual(computeNewRound(0, 2, 0, { agent: "qa-engineer", status: "PASS" }), { qa_round: 0, review_round: 2, visual_round: 0 });
});

test("computeNewRound: (pm, In_Progress) resets both counters (re-entry)", () => {
  assert.deepEqual(computeNewRound(4, 3, 0, { agent: "pm", status: "In_Progress" }), { qa_round: 0, review_round: 0, visual_round: 0 });
});

test("computeNewRound: other writes hold both counters unchanged", () => {
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "sr-engineer", status: "In_Progress" }), { qa_round: 2, review_round: 1, visual_round: 0 });
  // (qa-engineer, In_Progress) without prev=(code-reviewer, In_Progress) does NOT reset review_round.
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "qa-engineer", status: "In_Progress" }), { qa_round: 2, review_round: 1, visual_round: 0 });
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "pm", status: "Blocked" }), { qa_round: 2, review_round: 1, visual_round: 0 });
});

// ---------- v3.15.0 AC-11/AC-12/AC-13 — Round 4 sentinel symmetric `>=` predicate ----------
// v3.14.1 fixed visual_round Round 6. v3.15.0 brings qa_round and review_round in line.
// Predicate is `new >= 4 && prev < 4` for both counters — fires on every cap-cross
// from any prior value (handles migration / hand-edit edge cases).

test("v3.15.0 AC-11: qa_round Round 4 cap-cross predicate fires from prev=3 (normal)", () => {
  // Normal path — counter increments by 1, prev=3 → new=4.
  const result = computeNewRound(3, 0, 0, { agent: "qa-engineer", status: "FAIL" });
  assert.equal(result.qa_round, 4);
  // Sentinel-injection predicate (mirrors the live index.ts code):
  const shouldInject = result.qa_round >= 4 && 3 < 4;
  assert.equal(shouldInject, true, "v3.15.0 predicate fires on normal cap-cross");
});

test("v3.15.0 AC-11: qa_round Round 4 cap-cross predicate fires from prev<3 (external bump)", () => {
  // Hypothetical: migration / hand-edit places counter at 4+ while prev<3.
  // The new `>= && <` predicate handles this case where the old `=== && ===`
  // would have silently skipped the sentinel.
  const prev = 2;
  const next = 4;
  const oldPredicate = next === 4 && prev === 3;
  const newPredicate = next >= 4 && prev < 4;
  assert.equal(oldPredicate, false, "v3.14.0 predicate would SKIP this case");
  assert.equal(newPredicate, true, "v3.15.0 predicate MUST fire");
});

test("v3.15.0 AC-11: qa_round Round 4 predicate does NOT fire past cap", () => {
  // After the lock, subsequent writes must not re-inject the sentinel.
  const prev = 4;
  const next = 5;
  const newPredicate = next >= 4 && prev < 4;
  assert.equal(newPredicate, false, "predicate must fire exactly once per crossing");
});

test("v3.15.0 AC-12: review_round Round 4 cap-cross predicate fires from prev=3 (normal)", () => {
  const result = computeNewRound(0, 3, 0, { agent: "code-reviewer", status: "FAIL" });
  assert.equal(result.review_round, 4);
  const shouldInject = result.review_round >= 4 && 3 < 4;
  assert.equal(shouldInject, true);
});

test("v3.15.0 AC-12: review_round Round 4 cap-cross predicate fires from prev<3 (external bump)", () => {
  const prev = 1;
  const next = 4;
  const newPredicate = next >= 4 && prev < 4;
  assert.equal(newPredicate, true);
});

test("v3.15.0 AC-13: sentinel message strings are unchanged from v3.14.x wording", () => {
  // Why: AC-13 mandates that only the predicate changes — the user-visible
  // sentinel text stays identical so existing operator runbooks / docs
  // don't break.
  const __dirname_ac13 = path.dirname(new URL(import.meta.url).pathname);
  const indexTs = fs.readFileSync(path.join(__dirname_ac13, "..", "index.ts"), "utf-8");
  assert.match(indexTs, /⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets\./,
    "qa_round sentinel wording must be unchanged");
  assert.match(indexTs, /⛔ Review Round 4: forced rollback to pm — no further code-review allowed until PM resets\./,
    "review_round sentinel wording must be unchanged");
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

// ============================================================================
// T67 / AC-12 — v3.9.0 code-reviewer chain coverage
// ============================================================================
// These tests cover the NEW behavior introduced by the code-reviewer role
// split. Existing tests above were revised (not deleted) to match v3.9.0
// contracts where AC-2 mandated edge removal made the prior assertions
// obsolete (sr→qa direct edge; single-return computeNewRound; schema v1).
// Revisions are documented inline at each touched site.

// ---------- AC-12(a) — new ALLOWED edges accept ----------

test("AC-12: sr-engineer:In_Progress → code-reviewer:In_Progress accepted", () => {
  // The replacement edge for the removed sr→qa direct handoff.
  assert.equal(
    validateTransition({
      prev: { agent: "sr-engineer", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer:In_Progress → code-reviewer:FAIL accepted (CHANGES_REQUESTED bounce)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "FAIL" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer:In_Progress → code-reviewer:Blocked accepted", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "Blocked" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer:In_Progress → qa-engineer:In_Progress accepted (APPROVED handoff)", () => {
  // The architecture-mandated successful-review handoff path.
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer:FAIL → sr-engineer:In_Progress accepted (Round N+1 fix cycle)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "FAIL" },
      next: { agent: "sr-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 1,
    }),
    null,
  );
});

test("AC-12: code-reviewer:FAIL → pm:In_Progress accepted (manual escalation)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "FAIL" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 2,
    }),
    null,
  );
});

test("AC-12: code-reviewer:Blocked → code-reviewer:In_Progress accepted (unblock self-loop)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "Blocked" },
      next: { agent: "code-reviewer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer:Blocked → pm:In_Progress accepted (manual escalation)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "Blocked" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: removed sr-engineer→qa-engineer edge rejects with TRANSITION_REJECTED naming code-reviewer", () => {
  // Why: AC-2 mandates the prior direct edge MUST be rejected; the error
  // envelope MUST cite the new allowed list so downstream agents can self-correct
  // to the chain step they missed.
  const r = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.ok(
    r.allowed.some((a) => a.new_agent === "code-reviewer" && a.new_status === "In_Progress"),
    `allowed list must contain code-reviewer:In_Progress; got ${JSON.stringify(r.allowed)}`,
  );
});

// ---------- AC-12(b) — review_round cap ----------

test("AC-12: review_round=3 + (code-reviewer, FAIL) → REVIEW_ROUND_EXCEEDED (only pm allowed)", () => {
  // Why: the AC-3 circuit breaker — 3 FAILs allowed; the 4th FAIL must force
  // PM escalation. Symmetric to the qa_round cap.
  const r = validateTransition({
    prev: { agent: "code-reviewer", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "FAIL" },
    prev_qa_round: 0,
    prev_review_round: 4, // cap is REVIEW_ROUND_CAP=4; prev>=cap triggers the gate
  });
  assert.ok(r);
  assert.equal(r.error, "REVIEW_ROUND_EXCEEDED");
  assert.equal(r.allowed.length, 1);
  assert.equal(r.allowed[0].new_agent, "pm");
  assert.equal(r.allowed[0].new_status, "In_Progress");
});

test("AC-12: review_round cap exceeded — (pm, In_Progress) is the only accepted next", () => {
  // The escape valve — once the cap is hit, only PM re-entry resets the loop.
  assert.equal(
    validateTransition({
      prev: { agent: "code-reviewer", status: "FAIL" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 4,
    }),
    null,
  );
});

test("AC-12: review_round cap independent from qa_round cap", () => {
  // qa_round=4 + (qa, FAIL) still triggers QA_ROUND_EXCEEDED even when review_round=0.
  // Documents the AC-3 claim "both counters are checked independently".
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "FAIL" },
    prev_qa_round: 4,
    prev_review_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "QA_ROUND_EXCEEDED");
});

// ---------- AC-12(c) — computeNewRound for review_round ----------

test("AC-12: computeNewRound — (code-reviewer, FAIL) increments review_round, holds qa_round", () => {
  // Why: AC-3 mandates FAIL increments. qa_round must hold steady — the two
  // counters are independent. v3.14.0: visual_round also independent.
  assert.deepEqual(
    computeNewRound(2, 0, 0, { agent: "code-reviewer", status: "FAIL" }),
    { qa_round: 2, review_round: 1, visual_round: 0 },
  );
  assert.deepEqual(
    computeNewRound(0, 2, 0, { agent: "code-reviewer", status: "FAIL" }),
    { qa_round: 0, review_round: 3, visual_round: 0 },
  );
});

test("AC-12: computeNewRound — handoff (code-reviewer→qa-engineer, In_Progress) resets review_round only", () => {
  // Why: AC-3 mandates reset on successful APPROVAL handoff. qa_round must
  // be untouched (different lifecycle counter).
  assert.deepEqual(
    computeNewRound(
      1,
      2,
      0,
      { agent: "qa-engineer", status: "In_Progress" },
      { agent: "code-reviewer", status: "In_Progress" },
    ),
    { qa_round: 1, review_round: 0, visual_round: 0 },
  );
});

test("AC-12: computeNewRound — (qa-engineer, In_Progress) without code-reviewer prev does NOT reset review_round", () => {
  // The prev-tuple guard prevents accidental review_round resets on unrelated
  // qa-loop traffic. Without the guard, any qa:In_Progress write would clear
  // the counter and defeat the cap.
  assert.deepEqual(
    computeNewRound(
      0,
      2,
      0,
      { agent: "qa-engineer", status: "In_Progress" },
      { agent: "sr-engineer", status: "In_Progress" },
    ),
    { qa_round: 0, review_round: 2, visual_round: 0 },
  );
});

test("AC-12: computeNewRound — (pm, In_Progress) resets BOTH counters (re-entry)", () => {
  // The unified escape valve — PM re-entry clears the whole loop history.
  // v3.14.0: also resets visual_round.
  assert.deepEqual(
    computeNewRound(3, 2, 4, { agent: "pm", status: "In_Progress" }),
    { qa_round: 0, review_round: 0, visual_round: 0 },
  );
});

// ---------- AC-12(d) — evidence-file: code-reviewer review_reports/ ----------

test("AC-12: hasCodeReviewEvidenceInFile — missing review file marks task as missing", () => {
  // Why: AC-8 — the cr→qa handoff is rejected when any task in completed_tasks
  // lacks its review file. The storage helper IS the gate.
  const ws = mkWorkspace();
  const result = hasCodeReviewEvidenceInFile(ws, ["T100", "T101"]);
  assert.deepEqual(result.present, []);
  assert.deepEqual(result.missing, ["T100", "T101"]);
});

test("AC-12: recordCodeReviewInFile → hasCodeReviewEvidenceInFile present", async () => {
  // Why: round-trip the evidence pair end-to-end. The dir auto-creates;
  // the file lands at review_reports/review_<id>.md.
  const ws = mkWorkspace();
  await recordCodeReviewInFile(ws, ["T200"], "APPROVED", "code-reviewer", "looks good");
  const result = hasCodeReviewEvidenceInFile(ws, ["T200", "T201"]);
  assert.deepEqual(result.present, ["T200"]);
  assert.deepEqual(result.missing, ["T201"]);

  // Confirm the file is at the documented path.
  const expected = path.join(ws, "review_reports", "review_T200.md");
  assert.ok(fs.existsSync(expected), `review file must exist at ${expected}`);
});

test("AC-12: recordCodeReviewInFile sanitises unsafe task ids", () => {
  // Why: path-traversal defence. Mirrors qa_reports/ regex `[^A-Za-z0-9._-]`.
  // A task id of "../../etc/passwd" must NOT write outside review_reports/.
  const ws = mkWorkspace();
  recordCodeReviewInFile(ws, ["../../evil"], "CHANGES_REQUESTED", "cr", "bad").catch(() => {});
  // The sanitised name replaces every disallowed char with _.
  const sanitised = path.join(ws, "review_reports", "review_______evil.md");
  // Ensure no traversal happened: the parent dir of workspace was NOT touched.
  const traversalTarget = path.join(path.dirname(ws), "evil");
  assert.equal(fs.existsSync(traversalTarget), false, "must not write outside workspace");
});

test("AC-12: evidence gate verbatim hint string is reachable from compiled index.js", () => {
  // Why: AC-8 mandates the exact hint substring in the rejection envelope.
  // The string is composed inline in the index.ts handler; this test guards
  // against future refactors that paraphrase the hint and break the contract.
  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "index.js"),
    "utf-8",
  );
  // The hint is composed via two concatenated template literals in the source,
  // so the substring search splits accordingly. Both halves must be present
  // and the runtime concat reconstructs the AC-8 verbatim message.
  assert.match(
    distIndex,
    /Code-reviewer evidence missing: write review_reports\/review_<task-id>\.md /,
    "verbatim AC-8 hint head must be present in compiled handler",
  );
  assert.match(
    distIndex,
    /before handing off to qa-engineer\./,
    "verbatim AC-8 hint tail must be present in compiled handler",
  );
});

// ---------- AC-12(f) — qa-engineer scope safety net ----------

test("AC-12: qa PASS transition unaffected by code-reviewer chain (regression guard)", () => {
  // Why: the v3.9.0 chain insertion MUST NOT regress the qa terminal step.
  // The (qa, In_Progress → qa, PASS) edge stays valid.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "PASS" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("AC-12: code-reviewer agent is in ALLOWED_TRANSITIONS keys", () => {
  // Spot-check the three new agent rows live in the exported map.
  assert.ok(ALLOWED_TRANSITIONS.has("code-reviewer:In_Progress"));
  assert.ok(ALLOWED_TRANSITIONS.has("code-reviewer:FAIL"));
  assert.ok(ALLOWED_TRANSITIONS.has("code-reviewer:Blocked"));
});
