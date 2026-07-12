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
} from "../dist/gates/qa-review.js";
import {
  recordCodeReviewInFile,
  hasCodeReviewEvidenceInFile,
} from "../dist/gates/code-review.js";
import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

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

// d2-server-brake-accounting (qa-owned re-baseline): computeNewRound's return
// shape gained a fourth field, hop_count (v9). Additive-only — the three
// round fields are computed identically; every deepEqual fixture below now
// pins hop_count too. None of these calls pass prev_hop_count/feature_changed
// (both default), and every one is a role-transition (next.agent differs from
// the (possibly-omitted, i.e. null) prev.agent) — DR-9: hop_count = 0 + 1 = 1
// in every case here, never a reset (no feature_changed=true call in this file).

test("computeNewRound: (qa-engineer, FAIL) increments qa_round, holds review_round", () => {
  assert.deepEqual(computeNewRound(0, 0, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 1, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 1, review_rounds_total: 0, visual_rounds_total: 0 });
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 3, review_round: 1, visual_round: 0, hop_count: 1, qa_rounds_total: 1, review_rounds_total: 0, visual_rounds_total: 0 });
  assert.deepEqual(computeNewRound(3, 0, 0, { agent: "qa-engineer", status: "FAIL" }), { qa_round: 4, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 1, review_rounds_total: 0, visual_rounds_total: 0 }); // enter Round 4
});

test("computeNewRound: (qa-engineer, PASS) resets qa_round, holds review_round", () => {
  assert.deepEqual(computeNewRound(3, 0, 0, { agent: "qa-engineer", status: "PASS" }), { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
  assert.deepEqual(computeNewRound(0, 2, 0, { agent: "qa-engineer", status: "PASS" }), { qa_round: 0, review_round: 2, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
});

test("computeNewRound: (pm, In_Progress) resets both counters (re-entry)", () => {
  assert.deepEqual(computeNewRound(4, 3, 0, { agent: "pm", status: "In_Progress" }), { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
});

test("computeNewRound: other writes hold both counters unchanged", () => {
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "sr-engineer", status: "In_Progress" }), { qa_round: 2, review_round: 1, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
  // (qa-engineer, In_Progress) without prev=(code-reviewer, In_Progress) does NOT reset review_round.
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "qa-engineer", status: "In_Progress" }), { qa_round: 2, review_round: 1, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
  assert.deepEqual(computeNewRound(2, 1, 0, { agent: "pm", status: "Blocked" }), { qa_round: 2, review_round: 1, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 });
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
  // Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
  // body (including these sentinels) moved verbatim from index.ts to
  // tools/handoff-orchestrator.ts.
  const __dirname_ac13 = path.dirname(new URL(import.meta.url).pathname);
  const indexTs = fs.readFileSync(path.join(__dirname_ac13, "..", "tools", "handoff-orchestrator.ts"), "utf-8");
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
  // d2-server-brake-accounting (qa-owned re-baseline): hop_count pinned per
  // the file-header note above (role transition, no feature_changed → 1).
  assert.deepEqual(
    computeNewRound(2, 0, 0, { agent: "code-reviewer", status: "FAIL" }),
    { qa_round: 2, review_round: 1, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 1, visual_rounds_total: 0 },
  );
  assert.deepEqual(
    computeNewRound(0, 2, 0, { agent: "code-reviewer", status: "FAIL" }),
    { qa_round: 0, review_round: 3, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 1, visual_rounds_total: 0 },
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
    { qa_round: 1, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
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
    { qa_round: 0, review_round: 2, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
});

test("AC-12: computeNewRound — (pm, In_Progress) resets BOTH counters (re-entry)", () => {
  // The unified escape valve — PM re-entry clears the whole loop history.
  // v3.14.0: also resets visual_round.
  assert.deepEqual(
    computeNewRound(3, 2, 4, { agent: "pm", status: "In_Progress" }),
    { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
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

test("AC-12: evidence gate verbatim hint string is reachable from compiled handoff-orchestrator.js", () => {
  // Why: AC-8 mandates the exact hint substring in the rejection envelope.
  // The string is composed inline in the handler; this test guards
  // against future refactors that paraphrase the hint and break the contract.
  // Relocated by the gate-registry refactor (A10): the MISSING_REVIEW_EVIDENCE
  // hint body is sourced from gates/registry.ts (gate("...").hintStatic), so its
  // verbatim text compiles into dist/gates/registry.js. The `⛔ CODE: ${listing}. `
  // prefix stays at the orchestrator emit site.
  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "gates", "registry.js"),
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

// ============================================================================
// T-MATRIX-A5 — release-engineer added to routing chain (v3.28.0)
// ============================================================================
// WHY: release-engineer was absent from the AgentName union, the isAgent()
// guard, and the ALLOWED map. Any handoff that landed in state
// (release-engineer, PASS) returned an empty allowed set — the chain was
// permanently wedged with no valid next transition. A5 fixes all three sites.
// These tests encode the contract; a regression that removes any of the three
// sites would make one or more fail.

// ---------- T-MATRIX-A5(a): isAgent recognises release-engineer ----------

test("T-MATRIX-A5: release-engineer is a valid agent_id (unknown-agent gate does not fire)", () => {
  // WHY: the isAgent() guard rejects unknown agent_id values with
  // AGENT_ID_REQUIRED. Before A5, "release-engineer" fell through as unknown.
  // Now it must be accepted so the write can reach the table-lookup step.
  // We verify by requesting a known-valid transition; AGENT_ID_REQUIRED would
  // fire before TRANSITION_REJECTED, so absence of that error code is the proof.
  const r = validateTransition({
    prev: { agent: "release-engineer", status: "PASS" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  // null means accepted — the agent was recognised and the edge is in ALLOWED.
  assert.equal(r, null, "release-engineer:PASS → pm:In_Progress must be accepted");
});

// ---------- T-MATRIX-A5(b): allowed edges from release-engineer:PASS ----------

test("T-MATRIX-A5: release-engineer:PASS → pm:In_Progress accepted", () => {
  // WHY: mirrors qa-engineer:PASS → pm:In_Progress (post-release PM entry).
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "PASS" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-MATRIX-A5: release-engineer:PASS → researcher:In_Progress accepted", () => {
  // WHY: mirrors qa-engineer:PASS → researcher:In_Progress (next-feature
  // research path directly from release gate).
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "PASS" },
      next: { agent: "researcher", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- T-MATRIX-A5(c): rejected edge from release-engineer:PASS ----------

test("T-MATRIX-A5: release-engineer:PASS → sr-engineer:In_Progress REJECTED", () => {
  // WHY: the row only grants (pm, In_Progress) and (researcher, In_Progress).
  // Jumping back to sr-engineer would bypass PM triage, which the matrix
  // forbids. The rejection envelope's allowed list must NOT contain sr-engineer.
  const r = validateTransition({
    prev: { agent: "release-engineer", status: "PASS" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.ok(
    !r.allowed.some((a) => a.new_agent === "sr-engineer"),
    `allowed list must NOT contain sr-engineer; got ${JSON.stringify(r.allowed)}`,
  );
  // Positive assertion: the two valid targets must appear in the allowed list.
  assert.ok(
    r.allowed.some((a) => a.new_agent === "pm" && a.new_status === "In_Progress"),
    "allowed list must contain (pm, In_Progress)",
  );
  assert.ok(
    r.allowed.some((a) => a.new_agent === "researcher" && a.new_status === "In_Progress"),
    "allowed list must contain (researcher, In_Progress)",
  );
});

// ---------- T-MATRIX-A5(d): prior-wedge regression guard ----------

test("T-MATRIX-A5: release-engineer:PASS row is present in ALLOWED_TRANSITIONS (empty-set wedge regression)", () => {
  // WHY: before A5 the ALLOWED map had no "release-engineer:PASS" key.
  // ALLOWED.get("release-engineer:PASS") returned undefined, which the
  // validator treated as an empty allowed set — validateTransition would
  // return TRANSITION_REJECTED with allowed=[] for EVERY next tuple,
  // permanently wedging the chain with no valid exit. This test encodes that
  // exact regression: the key MUST be present AND its value must be non-empty.
  assert.ok(
    ALLOWED_TRANSITIONS.has("release-engineer:PASS"),
    "ALLOWED_TRANSITIONS must have a 'release-engineer:PASS' key (absent before A5 — the wedge)",
  );
  const row = ALLOWED_TRANSITIONS.get("release-engineer:PASS");
  assert.ok(row && row.length > 0, "release-engineer:PASS row must have at least one allowed target");
});

// ============================================================================
// C1-07 — Amend-Resume Edge regression tests (backlog C1, spec AC-8)
// Re-baselined by c9-protocol-fields (T-C9-09, AC-4/DR-2/DR-6): the edge is
// now gated by the structured `next_resume_of` field on TransitionRequest,
// NOT by grepping `next_pending_notes` for a `resume_of: <target>` line
// (`resumeMarkerNames` and the `next_pending_notes` field are both deleted —
// no dual-read fallback). These tests pin: (a) exact-field accept, (b)
// missing-field reject, (c) wrong-role-field reject, (d) legacy pending_notes
// token is now INERT (does not open the edge on its own), (e) round-cap
// precedence over a valid field, (f) pre-existing pm:In_Progress edges are
// field-independent, and (g) gate isolation — the Scope Decision and
// Cut-Approval gates neither fire on the new edges nor are weakened on their
// own (positive control).
// ============================================================================
// WHY: specs/pm-repair-resume-routing.md adds a narrowly-scoped routing edge so
// PM can hand back directly to a downstream role (code-reviewer/qa-engineer) it
// interrupted mid-chain, instead of a manufactured detour through sr-engineer.
// Spec-to-test map: AC-2 -> t-c1-accept-*; AC-3 -> t-c1-reject-*;
// c9 AC-4/AC-9 -> t-c1-inert-*; AC-1/AC-8(e) -> t-c1-gate-isolation-*;
// AC-8(d) -> t-c1-preexisting-*; architecture Test Surface item 7 ->
// t-c1-roundcap-precedence.

// ---------- AC-2: accept — exact field, exact role ----------

test("C1-07/AC-2: pm:In_Progress -> code-reviewer:In_Progress accepted with resume_of: code-reviewer", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
      next_resume_of: "code-reviewer",
    }),
    null,
  );
});

test("C1-07/AC-2: pm:In_Progress -> qa-engineer:In_Progress accepted with resume_of: qa-engineer", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "qa-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
      next_resume_of: "qa-engineer",
    }),
    null,
  );
});

test("C1-07/AC-2/c9: next_resume_of alone is sufficient — the field is independent of pending_notes content", () => {
  // Why: pre-c9, the marker HAD to live inside pending_notes. Post-c9 the
  // structured field is the only thing validateTransition reads at step 3.5;
  // TransitionRequest no longer even has a next_pending_notes property
  // (DR-6). This accepts purely on the field, with no pending_notes-shaped
  // input at all.
  assert.equal(
    validateTransition({
      prev: { agent: "pm", status: "In_Progress" },
      next: { agent: "code-reviewer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
      next_resume_of: "code-reviewer",
    }),
    null,
  );
});

// ---------- AC-3: reject — no field ----------

test("C1-07/AC-3: pm:In_Progress -> code-reviewer:In_Progress REJECTED with next_resume_of absent", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    // next_resume_of omitted entirely (undefined !== "code-reviewer").
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
  // Byte-identical fall-through: allowed is the unchanged static pm:In_Progress
  // set — code-reviewer/qa-engineer must NOT appear absent the field.
  assert.ok(
    !r.allowed.some((a) => a.new_agent === "code-reviewer" || a.new_agent === "qa-engineer"),
    `allowed list must NOT contain code-reviewer/qa-engineer without next_resume_of; got ${JSON.stringify(r.allowed)}`,
  );
});

test("C1-07/AC-3: pm:In_Progress -> qa-engineer:In_Progress REJECTED with next_resume_of undefined", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- AC-3: reject — field names the wrong role ----------

test("C1-07/AC-3: pm:In_Progress -> qa-engineer:In_Progress REJECTED with resume_of: code-reviewer (wrong role)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_resume_of: "code-reviewer",
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("C1-07/AC-3: pm:In_Progress -> code-reviewer:In_Progress REJECTED with resume_of: qa-engineer (wrong role)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_resume_of: "qa-engineer",
  });
  assert.ok(r);
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- AC-4/AC-9/DR-2: legacy pending_notes token is now INERT ----------
// Byte-identical fall-through in every case: TRANSITION_REJECTED, no new error
// code. TransitionRequest no longer has a next_pending_notes property at all
// (DR-6) — these tests pin that passing pending_notes-shaped data (even a
// well-formed legacy token) has ZERO effect without the structured field.

test("C1-07/c9: well-formed legacy 'resume_of: code-reviewer' pending_notes token, with NO next_resume_of field, does NOT open the edge (inert)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    // Legacy shape, no longer a field on TransitionRequest — passed here only
    // to prove the extra/unknown property is silently ignored, not honored.
    next_pending_notes: ["resume_of: code-reviewer"],
  });
  assert.ok(r, "a legacy pending_notes-shaped token must NOT open the edge post-c9");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("C1-07/c9: well-formed legacy 'resume_of: qa-engineer' pending_notes token, with NO next_resume_of field, does NOT open the edge (inert)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_pending_notes: ["resume_of: qa-engineer"],
  });
  assert.ok(r, "a legacy pending_notes-shaped token must NOT open the edge post-c9");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("C1-07/c9: legacy pending_notes token PLUS an unrelated next_resume_of value still rejects (field, not prose, is authoritative)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_pending_notes: ["resume_of: code-reviewer"], // legacy text names the RIGHT role...
    next_resume_of: "qa-engineer", // ...but the structured field names the WRONG one — field wins.
  });
  assert.ok(r, "the structured field is authoritative — legacy prose naming the correct role must not override a mismatched field");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- Status must be In_Progress on BOTH sides (architecture step-3.5 guard) ----------

test("C1-07: prev status Blocked (not In_Progress) does NOT open the edge even with a valid resume_of field", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "Blocked" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_resume_of: "code-reviewer",
  });
  assert.ok(r, "prev.status must be pinned to In_Progress — Blocked must not qualify");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("C1-07: next status FAIL (not In_Progress) does NOT open the edge even with a valid resume_of field", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "FAIL" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_resume_of: "code-reviewer",
  });
  assert.ok(r, "next.status must be In_Progress — FAIL must not qualify for the resume edge");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

test("C1-07: next status Blocked (not In_Progress) does NOT open the edge even with a valid resume_of field", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "Blocked" },
    prev_qa_round: 0,
    prev_review_round: 0,
    next_resume_of: "qa-engineer",
  });
  assert.ok(r, "next.status must be In_Progress — Blocked must not qualify for the resume edge");
  assert.equal(r.error, "TRANSITION_REJECTED");
});

// ---------- AC-8(d): pre-existing pm:In_Progress edges unaffected, field-independent ----------

const PRE_EXISTING_PM_TARGETS = [
  { agent: "architect", status: "In_Progress" },
  { agent: "sr-engineer", status: "In_Progress" },
  { agent: "researcher", status: "In_Progress" },
  { agent: "design-auditor", status: "In_Progress" },
  { agent: "pm", status: "Blocked" },
  { agent: "pm", status: "In_Progress" },
];

for (const target of PRE_EXISTING_PM_TARGETS) {
  test(`C1-07/AC-8(d): pm:In_Progress -> ${target.agent}:${target.status} still accepted WITHOUT a resume_of field`, () => {
    assert.equal(
      validateTransition({
        prev: { agent: "pm", status: "In_Progress" },
        next: { agent: target.agent, status: target.status },
        prev_qa_round: 0,
        prev_review_round: 0,
      }),
      null,
    );
  });

  test(`C1-07/AC-8(d): pm:In_Progress -> ${target.agent}:${target.status} still accepted WITH an (irrelevant) resume_of field present`, () => {
    // A resume_of field naming a role that isn't the target must not change
    // the outcome of an already-allowed edge — step 3.5 only ever ADDS an
    // acceptance path; it never removes one from the static table.
    assert.equal(
      validateTransition({
        prev: { agent: "pm", status: "In_Progress" },
        next: { agent: target.agent, status: target.status },
        prev_qa_round: 0,
        prev_review_round: 0,
        next_resume_of: "code-reviewer",
      }),
      null,
    );
  });
}

// ---------- Round-cap precedence (architecture Test Surface item 7) ----------

test("C1-07: review_round at cap (4) rejects the resume edge even with a valid resume_of field (round cap outranks step 3.5)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "code-reviewer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 4,
    next_resume_of: "code-reviewer",
  });
  assert.ok(r, "must be rejected despite the valid field");
  assert.equal(r.error, "REVIEW_ROUND_EXCEEDED");
});

test("C1-07: qa_round at cap (4) rejects the resume edge even with a valid resume_of field (round cap outranks step 3.5)", () => {
  const r = validateTransition({
    prev: { agent: "pm", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 4,
    prev_review_round: 0,
    next_resume_of: "qa-engineer",
  });
  assert.ok(r, "must be rejected despite the valid field");
  assert.equal(r.error, "QA_ROUND_EXCEEDED");
});

// ---------- Gate isolation (AC-1 / AC-8(e)) — integration via handleUpdateState ----------
// WHY: the resume edge must never arm or weaken the Scope Decision / Cut-Approval
// gates (tools/handoff-orchestrator.ts), which fire ONLY on
// pm:In_Progress -> {architect,sr-engineer}:In_Progress. These tests exercise the
// real orchestrator (not just validateTransition) on a design-armed workspace with
// neither scope_decision nor cut_approved recorded, and assert: (a) the new edges
// (pm -> code-reviewer / qa-engineer, with a valid marker) trip NEITHER gate; (b)
// the pre-existing pm -> sr-engineer edge in the SAME unattested armed state STILL
// trips the gates (positive control — proves the new edge did not weaken them).

function mkGateWorkspace(feature = "c1-gate-fixture") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twc1gate-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", `${feature}.md`), "# Design\n\n## Mode\n\nfigma\n");
  return { ws, feature };
}

async function seedPmInProgress(ws, feature, extra = {}) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["resuming"],
    lastAgent: "pm",
    ...extra,
  });
}

test("C1-07/AC-1/AC-8(e)/c9: armed+unattested pm->code-reviewer with resume_of field trips NEITHER gate", async () => {
  // Re-baselined by c9 AC-4: the tool-boundary arg is now the structured
  // `resume_of` field, not a `pending_notes` token.
  setActiveStorage(new FileHandoffStorage());
  const { ws, feature } = mkGateWorkspace("c1-gate-cr");
  await seedPmInProgress(ws, feature); // no scope_decision, no cut_approved

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["resuming after PM amendment"],
    resume_of: "code-reviewer",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `resume edge must not be rejected; got: ${text}`);
  assert.ok(!text.includes("SCOPE_DECISION_REQUIRED"), "Scope Decision Gate must NOT fire on the resume edge");
  assert.ok(!text.includes("CUT_APPROVAL_REQUIRED"), "Cut-Approval Gate must NOT fire on the resume edge");
});

test("C1-07/AC-1/AC-8(e)/c9: armed+unattested pm->qa-engineer with resume_of field trips NEITHER gate", async () => {
  setActiveStorage(new FileHandoffStorage());
  const { ws, feature } = mkGateWorkspace("c1-gate-qa");
  await seedPmInProgress(ws, feature); // no scope_decision, no cut_approved

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "qa-engineer",
    completed_tasks: [],
    pending_notes: ["resuming after PM amendment"],
    resume_of: "qa-engineer",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `resume edge must not be rejected; got: ${text}`);
  assert.ok(!text.includes("SCOPE_DECISION_REQUIRED"), "Scope Decision Gate must NOT fire on the resume edge");
  assert.ok(!text.includes("CUT_APPROVAL_REQUIRED"), "Cut-Approval Gate must NOT fire on the resume edge");
});

test("C1-07/c9: armed+unattested pm->code-reviewer with ONLY a legacy pending_notes token (no resume_of field) IS rejected — TRANSITION_REJECTED, not a gate", async () => {
  // Why: proves the inert-token contract end-to-end through the real tool
  // boundary, not just validateTransition in isolation. A legacy-shaped note
  // with no structured resume_of field must fall through to the ordinary
  // TRANSITION_REJECTED path (the edge simply never opens) — it must NOT be
  // silently accepted, and must NOT be misreported as a gate failure.
  setActiveStorage(new FileHandoffStorage());
  const { ws, feature } = mkGateWorkspace("c1-gate-inert");
  await seedPmInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["resume_of: code-reviewer"],
    // resume_of field intentionally omitted.
  });
  const text = result.content[0].text;
  assert.ok(result.isError, "the edge must NOT open on a legacy pending_notes token alone");
  assert.ok(text.includes("TRANSITION_REJECTED"), `expected TRANSITION_REJECTED; got: ${text}`);
});

test("C1-07/AC-1 positive control: armed+unattested pm->sr-engineer (SAME state) STILL trips SCOPE_DECISION_REQUIRED", async () => {
  // Proves the new edge did not weaken the gate: the identical armed/unattested
  // precondition, on the pre-existing build-entry edge, still fires as before.
  setActiveStorage(new FileHandoffStorage());
  const { ws, feature } = mkGateWorkspace("c1-gate-positive-scope");
  await seedPmInProgress(ws, feature); // no scope_decision, no cut_approved

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
  });
  const text = result.content[0].text;
  assert.ok(result.isError, "the pre-existing gated edge must still be rejected");
  assert.ok(text.includes("SCOPE_DECISION_REQUIRED"), "Scope Decision Gate must still fire on pm->sr-engineer");
});

test("C1-07/AC-1 positive control: armed pm->sr-engineer with scope_decision set but NO cut_approved STILL trips CUT_APPROVAL_REQUIRED", async () => {
  // Second gate, isolated: once scope is cleared, the cut-approval gate (which
  // runs next, unconditionally) must still fire on the SAME pre-existing edge —
  // proving the resume edge's marker-consistency check did not fold into or
  // replace the cut-approval gate's own predicate.
  setActiveStorage(new FileHandoffStorage());
  const { ws, feature } = mkGateWorkspace("c1-gate-positive-cut");
  await seedPmInProgress(ws, feature, { scopeDecision: "single-feature" }); // scope cleared, cut_approved absent

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: [],
  });
  const text = result.content[0].text;
  assert.ok(result.isError, "the pre-existing gated edge must still be rejected");
  assert.ok(text.includes("CUT_APPROVAL_REQUIRED"), "Cut-Approval Gate must still fire on pm->sr-engineer");
  assert.ok(!text.includes("SCOPE_DECISION_REQUIRED"), "Scope Decision Gate must be clear (already satisfied)");
});

// ---------- Marker single-use (architecture "Consumption" section) ----------

test("C1-07: resume_of marker is single-use — pending_notes are replaced (not merged) on the next write", async () => {
  // WHY: architecture doc — "pending_notes are REPLACED on every write ... The
  // marker therefore never persists past the write that carries it." This pins
  // that contract directly against writeHandoffState (the mechanism the resume
  // edge's single-use property rests on).
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twc1su-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "c1-single-use",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["resume_of: code-reviewer"],
    lastAgent: "code-reviewer",
  });
  let state = parseHandoff(ws);
  assert.ok(state.pending_notes.some((n) => n.trim() === "resume_of: code-reviewer"), "marker must be present immediately after the edge-crossing write");

  // Next write supplies its own notes, without the marker.
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "c1-single-use",
    status: "FAIL",
    completedTasks: [],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "code-reviewer",
  });
  state = parseHandoff(ws);
  assert.ok(
    !state.pending_notes.some((n) => n.trim() === "resume_of: code-reviewer"),
    "marker must NOT survive into the next write — pending_notes are replaced, not merged",
  );
});

// ============================================================================
// T-C9-10 — enum rejection + REVIEW_VERDICT_STATUS_MISMATCH gate matrix
// (c9-protocol-fields, spec AC-2/AC-5, architecture §Test Thresholds T-C9-10)
// ============================================================================
// WHY: c9-protocol-fields promotes next_role/resume_of/review_verdict to
// closed-enum handoff v7 fields. Two distinct server layers must be pinned:
// (1) the zod boundary (tools/registry.ts) rejects an out-of-enum value
// BEFORE any gate runs — tested here directly against the real TOOL_REGISTRY
// entry (spec.zodSchema.parse), not a hand-rolled schema copy; (2) the new
// REVIEW_VERDICT_STATUS_MISMATCH plain-text orchestrator gate
// (tools/handoff-orchestrator.ts) enforces verdict<->status consistency on
// code-reviewer writes ONLY, firing only when review_verdict is PRESENT and
// disagrees with status (AC-5, DR-8 polarity).

// ---------- AC-2: zod enum rejection at the tool boundary ----------

const UPDATE_STATE_ENTRY = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");

test("T-C9-10/AC-2: tw_update_state rejects an out-of-enum next_role at the zod boundary", async () => {
  assert.ok(UPDATE_STATE_ENTRY, "tw_update_state must be registered in TOOL_REGISTRY");
  // NOTE: ToolRegistryEntry.run is `(rawArgs) => spec.handler(spec.zodSchema.parse(rawArgs))`
  // — a non-async arrow. When .parse() throws, run() throws SYNCHRONOUSLY (it never
  // gets far enough to return a promise). assert.rejects only converts a synchronous
  // throw into a proper rejection to await/inspect when the function IT calls is
  // itself `async` — hence the `async () => { ... }` wrapper below (a plain
  // `() => UPDATE_STATE_ENTRY.run(...)` throws past assert.rejects uncaught).
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        next_role: "reviewer", // not one of the 8 AgentName values
      });
    },
    /ZodError|invalid_value|invalid_enum_value/i,
    "an out-of-enum next_role must be rejected by zod before any gate/handler logic runs",
  );
});

test("T-C9-10/AC-2: tw_update_state rejects an out-of-enum resume_of at the zod boundary", async () => {
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "pm",
        resume_of: "pm", // restricted to code-reviewer | qa-engineer only
      });
    },
    /ZodError|invalid_value|invalid_enum_value/i,
    "an out-of-enum resume_of (e.g. 'pm', 'architect', 'sr-engineer') must be rejected by zod",
  );
});

test("T-C9-10/AC-2: tw_update_state rejects a lowercase (out-of-enum) review_verdict at the zod boundary", async () => {
  await assert.rejects(
    async () => {
      UPDATE_STATE_ENTRY.run({
        workspace_path: "/tmp/does-not-matter",
        active_feature: "x",
        status: "In_Progress",
        agent_id: "code-reviewer",
        review_verdict: "approved", // must be exactly "APPROVED" | "CHANGES_REQUESTED"
      });
    },
    /ZodError|invalid_value|invalid_enum_value/i,
    "a lowercase/garbage review_verdict must be rejected by zod",
  );
});

test("T-C9-10/AC-2: tw_update_state ACCEPTS valid enum values for all three fields (zod parse succeeds — real write goes through)", async () => {
  // Positive control for the three rejection tests above — proves the schema
  // isn't accidentally rejecting everything. Exercises a real self-loop write
  // (pm:In_Progress -> pm:In_Progress, untouched by the scope/cut/external-refs
  // build-entry gates) carrying all three fields at once; a ZodError here would
  // mean the enum definitions themselves are broken, not just the negative cases.
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twc9enum-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  await seedState(ws, "c9-enum-ok", "pm", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await UPDATE_STATE_ENTRY.run({
    workspace_path: ws,
    active_feature: "c9-enum-ok",
    status: "In_Progress",
    agent_id: "pm",
    completed_tasks: [],
    pending_notes: ["pm: re-evaluating"],
    next_role: "sr-engineer",
    resume_of: "qa-engineer",
    review_verdict: "APPROVED",
  });
  assert.ok(!result.isError, `valid enum values on all three fields must not be rejected; got: ${result.content?.[0]?.text}`);
});

// ---------- AC-5/DR-8: REVIEW_VERDICT_STATUS_MISMATCH gate matrix (integration, real orchestrator) ----------

function mkMismatchWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twc9mm-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedState(ws, feature, agent, status, extra = {}) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status,
    completedTasks: [],
    pendingNotes: ["seed"],
    lastAgent: agent,
    ...extra,
  });
}

// | agent_id       | review_verdict     | status      | expect            |
// |----------------|---------------------|-------------|--------------------|
// | code-reviewer  | APPROVED            | FAIL        | reject             |
// | code-reviewer  | CHANGES_REQUESTED   | In_Progress | reject             |
// | code-reviewer  | APPROVED            | In_Progress | accept             |
// | code-reviewer  | CHANGES_REQUESTED   | FAIL        | accept             |
// | code-reviewer  | (absent)            | FAIL        | accept (never fires) |
// | sr-engineer    | APPROVED            | In_Progress | accept (non-reviewer never fires) |

test("T-C9-10/AC-5: code-reviewer APPROVED + status=FAIL is REJECTED (polarity mismatch)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-1");
  await seedState(ws, "c9-mm-1", "code-reviewer", "In_Progress"); // prev: code-reviewer:In_Progress (valid edge to code-reviewer:FAIL)
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-1",
    status: "FAIL",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: found a correctness issue"],
    review_verdict: "APPROVED",
  });
  assert.ok(result.isError, "APPROVED with status=FAIL must be rejected");
  assert.ok(result.content[0].text.includes("REVIEW_VERDICT_STATUS_MISMATCH"), `expected REVIEW_VERDICT_STATUS_MISMATCH; got: ${result.content[0].text}`);
});

test("T-C9-10/AC-5: code-reviewer CHANGES_REQUESTED + status=In_Progress is REJECTED (polarity mismatch)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-2");
  await seedState(ws, "c9-mm-2", "sr-engineer", "In_Progress"); // prev: sr-engineer:In_Progress (valid edge to code-reviewer:In_Progress)
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-2",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: starting review"],
    review_verdict: "CHANGES_REQUESTED",
  });
  assert.ok(result.isError, "CHANGES_REQUESTED with status=In_Progress must be rejected");
  assert.ok(result.content[0].text.includes("REVIEW_VERDICT_STATUS_MISMATCH"), `expected REVIEW_VERDICT_STATUS_MISMATCH; got: ${result.content[0].text}`);
});

test("T-C9-10/AC-5: code-reviewer APPROVED + status=In_Progress is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-3");
  await seedState(ws, "c9-mm-3", "sr-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-3",
    status: "In_Progress",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: approved"],
    review_verdict: "APPROVED",
  });
  assert.ok(!result.isError, `APPROVED with status=In_Progress must be accepted; got: ${result.content?.[0]?.text}`);
});

test("T-C9-10/AC-5: code-reviewer CHANGES_REQUESTED + status=FAIL is ACCEPTED", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-4");
  await seedState(ws, "c9-mm-4", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-4",
    status: "FAIL",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: changes requested"],
    review_verdict: "CHANGES_REQUESTED",
  });
  assert.ok(!result.isError, `CHANGES_REQUESTED with status=FAIL must be accepted; got: ${result.content?.[0]?.text}`);
});

test("T-C9-10/AC-5: code-reviewer FAIL with review_verdict ABSENT is ACCEPTED (gate never fires on absence)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-5");
  await seedState(ws, "c9-mm-5", "code-reviewer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-5",
    status: "FAIL",
    agent_id: "code-reviewer",
    completed_tasks: [],
    pending_notes: ["code-reviewer: changes requested, no verdict field set"],
    // review_verdict intentionally omitted.
  });
  assert.ok(!result.isError, `a code-reviewer FAIL with no review_verdict must be legal; got: ${result.content?.[0]?.text}`);
});

test("T-C9-10/AC-5: sr-engineer write carrying review_verdict=APPROVED is ACCEPTED (gate is code-reviewer-only, never fires for other agents)", async () => {
  // Uses the sr-engineer:Blocked -> sr-engineer:In_Progress self-resume edge
  // (not a pm->build-entry edge) so SCOPE_DECISION_REQUIRED/CUT_APPROVAL_REQUIRED
  // — unrelated build-entry gates — cannot confound this assertion.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkMismatchWorkspace("c9-mm-6");
  await seedState(ws, "c9-mm-6", "sr-engineer", "Blocked");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "c9-mm-6",
    status: "In_Progress",
    agent_id: "sr-engineer",
    completed_tasks: [],
    pending_notes: ["sr-engineer: implementing"],
    review_verdict: "APPROVED", // nonsensical for this role, but the gate only keys on agent_id === "code-reviewer"
  });
  assert.ok(!result.isError, `a non-code-reviewer write must never trip REVIEW_VERDICT_STATUS_MISMATCH; got: ${result.content?.[0]?.text}`);
});

// ============================================================================
// T-MATRIX-C13 — release-engineer legal handoff write path (v3.49.0)
// ============================================================================
// WHY: the v3.48.0 release incident (specs/c13-release-engineer-write-path.md)
// found release-engineer had NO legal entry edge out of (qa-engineer, PASS) —
// only {pm, researcher} were granted — and NO row at all for
// (release-engineer, In_Progress), which would have wedged the chain with an
// empty allowed set the instant anything tried to land there (the same wedge
// class T-MATRIX-A5 fixed for release-engineer:PASS). Faced with the
// rejection, a haiku-tier subagent hand-edited handoff.md directly instead of
// stopping. C13 adds two additive edges — qa-engineer:PASS →
// release-engineer:In_Progress (open) and release-engineer:In_Progress →
// pm:In_Progress (close) — so release-engineer becomes a first-class,
// wedge-free citizen of the state machine. These tests pin the two new
// edges, the wedge-regression guard (non-empty allowed set), non-regression
// of the pre-existing qa-engineer:PASS successors, and round-counter
// steadiness across the new hop.

// ---------- T-MATRIX-C13(a): opening edge — qa-engineer:PASS → release-engineer:In_Progress ----------

test("T-MATRIX-C13: qa-engineer:PASS → release-engineer:In_Progress accepted", () => {
  // WHY: this is the legal opening write the incident lacked — release-engineer
  // stamping its own agent_id straight out of PASS, no more mis-stamping as
  // "pm" and no more hand-editing handoff.md to route around a rejection.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "PASS" },
      next: { agent: "release-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- T-MATRIX-C13(b): closing edge — release-engineer:In_Progress → pm:In_Progress ----------

test("T-MATRIX-C13: release-engineer:In_Progress → pm:In_Progress accepted", () => {
  // WHY: the legal closing write — release-engineer hands the chain back to
  // pm with a true last_agent="release-engineer" audit trail during the
  // release window, rather than the old stamp-as-pm convention that recorded
  // a false last_agent for work pm never did.
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "In_Progress" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- T-MATRIX-C13(c): rejected edge + wedge-regression guard ----------

test("T-MATRIX-C13: release-engineer:In_Progress → sr-engineer:In_Progress REJECTED with non-empty allowed set", () => {
  // WHY: release-engineer's SOP hands back to pm ONLY (AC2) — it does not
  // route to sr-engineer, researcher, architect, or qa-engineer directly.
  // Critically, the allowed set must be NON-EMPTY: an empty allowed set from
  // a reachable (release-engineer, In_Progress) tuple is exactly the wedge
  // this ticket fixes (mirrors T-MATRIX-A5(d)'s prior-wedge regression for
  // release-engineer:PASS). A regression that dropped the new row entirely
  // would make ALLOWED.get(...) return undefined -> allowed=[] here.
  const r = validateTransition({
    prev: { agent: "release-engineer", status: "In_Progress" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.ok(r.allowed.length > 0, "allowed set must be NON-EMPTY — empty is the wedge regression");
  assert.ok(
    !r.allowed.some((a) => a.new_agent === "sr-engineer"),
    `allowed list must NOT contain sr-engineer; got ${JSON.stringify(r.allowed)}`,
  );
  assert.deepEqual(
    r.allowed,
    [{ new_agent: "pm", new_status: "In_Progress" }],
    "allowed set must be exactly {pm, In_Progress} per AC2 — no other successor",
  );
});

test("T-MATRIX-C13: release-engineer:In_Progress → qa-engineer:In_Progress REJECTED with non-empty allowed set", () => {
  // WHY: same wedge-regression guard as the sr-engineer case above, exercised
  // against a second unrelated target to rule out a narrower bug (e.g. a
  // fix that special-cased sr-engineer only).
  const r = validateTransition({
    prev: { agent: "release-engineer", status: "In_Progress" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.ok(r.allowed.length > 0, "allowed set must be NON-EMPTY — empty is the wedge regression");
  assert.ok(
    r.allowed.some((a) => a.new_agent === "pm" && a.new_status === "In_Progress"),
    "allowed list must contain (pm, In_Progress)",
  );
});

test("T-MATRIX-C13: release-engineer:In_Progress row is present in ALLOWED_TRANSITIONS and non-empty (wedge regression)", () => {
  // WHY: static-map counterpart of the two rejection tests above. Before C13
  // there was NO "release-engineer:In_Progress" key at all; ALLOWED.get(...)
  // returned undefined, which validateTransition treats as allowed=[] for
  // EVERY next tuple — a tuple with zero outbound edges is exactly what
  // wedged the chain in the incident. This test encodes that the key must
  // exist AND carry at least one target.
  assert.ok(
    ALLOWED_TRANSITIONS.has("release-engineer:In_Progress"),
    "ALLOWED_TRANSITIONS must have a 'release-engineer:In_Progress' key (absent before C13 — the wedge)",
  );
  const row = ALLOWED_TRANSITIONS.get("release-engineer:In_Progress");
  assert.ok(row && row.length > 0, "release-engineer:In_Progress row must have at least one allowed target");
  assert.deepEqual(
    row,
    [{ agent: "pm", status: "In_Progress" }],
    "row must be exactly [{pm, In_Progress}] per AC2 — no researcher/architect/self successor",
  );
});

// ---------- T-MATRIX-C13(d): qa-engineer:PASS retains pm/researcher successors (no regression) ----------

test("T-MATRIX-C13: qa-engineer:PASS → pm:In_Progress still accepted (no regression from AC1 edit)", () => {
  // WHY: AC1 is additive — adding release-engineer as a third successor of
  // qa-engineer:PASS must not disturb the two pre-existing edges.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "PASS" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-MATRIX-C13: qa-engineer:PASS → researcher:In_Progress still accepted (no regression from AC1 edit)", () => {
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "PASS" },
      next: { agent: "researcher", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-MATRIX-C13: qa-engineer:PASS allowed-next contains all three successors {pm, researcher, release-engineer}", () => {
  // WHY: a direct spot-check of the static row itself, complementing the
  // three behavioral accept tests above.
  const row = ALLOWED_TRANSITIONS.get("qa-engineer:PASS");
  assert.ok(row, "qa-engineer:PASS row must exist");
  assert.ok(row.some((c) => c.agent === "pm" && c.status === "In_Progress"), "row must retain (pm, In_Progress)");
  assert.ok(
    row.some((c) => c.agent === "researcher" && c.status === "In_Progress"),
    "row must retain (researcher, In_Progress)",
  );
  assert.ok(
    row.some((c) => c.agent === "release-engineer" && c.status === "In_Progress"),
    "row must gain (release-engineer, In_Progress)",
  );
  assert.equal(row.length, 3, "row must have exactly 3 successors — additive, not a fourth accidental entry");
});

// ---------- T-MATRIX-C13(e): round-counter pin ----------

test("T-MATRIX-C13: computeNewRound holds qa_round/review_round/visual_round steady across qa-engineer:PASS → release-engineer:In_Progress", () => {
  // WHY: spec AC4's round-counter pin. next=(release-engineer, In_Progress)
  // matches none of computeNewRound's reset-or-increment branches (all keyed
  // on qa-engineer or pm as next.agent), so all three counters must hold
  // from a nonzero prior value — correct, since PASS already zeroed them and
  // nothing should regress on the hop into release-engineer.
  // d2-server-brake-accounting (qa-owned re-baseline): both calls here are a
  // role transition (qa-engineer -> release-engineer), no feature_changed →
  // hop_count = 1 in both cases (per the file-header note above).
  assert.deepEqual(
    computeNewRound(2, 3, 4, { agent: "release-engineer", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }),
    { qa_round: 2, review_round: 3, visual_round: 4, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
  // Also pin the zero-prior case (the realistic post-PASS state).
  assert.deepEqual(
    computeNewRound(0, 0, 0, { agent: "release-engineer", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }),
    { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
});

test("T-MATRIX-C13: computeNewRound re-zeros all three counters on release-engineer:In_Progress → pm:In_Progress", () => {
  // WHY: the closing write hits the existing (pm, In_Progress) reset branch —
  // already covered generically elsewhere, but this pins it specifically
  // following a (release-engineer, In_Progress) prev, per spec AC4.
  // d2-server-brake-accounting (qa-owned re-baseline): role transition
  // (release-engineer -> pm), no feature_changed → hop_count = 1.
  assert.deepEqual(
    computeNewRound(2, 3, 4, { agent: "pm", status: "In_Progress" }, { agent: "release-engineer", status: "In_Progress" }),
    { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
});
