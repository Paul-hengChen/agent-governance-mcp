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
  // WHY: release-engineer's SOP hands back to pm ONLY as its role-changing
  // successor (AC2) — it does not route to sr-engineer, researcher,
  // architect, or qa-engineer directly. Critically, the allowed set must be
  // NON-EMPTY: an empty allowed set from a reachable (release-engineer,
  // In_Progress) tuple is exactly the wedge this ticket fixes (mirrors
  // T-MATRIX-A5(d)'s prior-wedge regression for release-engineer:PASS). A
  // regression that dropped the new row entirely would make ALLOWED.get(...)
  // return undefined -> allowed=[] here.
  //
  // v3.98.0 (E53) retarget: the exact shape below is STALE, not the guard —
  // E53 opened release-engineer:In_Progress -> release-engineer:Blocked (the
  // entry edge into the newly-reachable Blocked state), so this row now has
  // TWO successors, not one. The wedge-regression assertions above (non-empty,
  // no sr-engineer leak) are untouched and still catch a real wedge; only the
  // frozen exact-shape pin below needed updating to the new intended shape.
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
    [
      { new_agent: "pm", new_status: "In_Progress" },
      { new_agent: "release-engineer", new_status: "Blocked" },
    ],
    "allowed set must be exactly {pm:In_Progress, release-engineer:Blocked} per E53 AC1 — no other successor",
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
  //
  // v3.98.0 (E53) retarget: the frozen exact shape below is stale, not the
  // guard — see the sibling test above at the same line-shape. E53 appended
  // release-engineer:Blocked as this row's second successor (the entry edge
  // AC1 opens); researcher/architect/self are still correctly absent.
  assert.ok(
    ALLOWED_TRANSITIONS.has("release-engineer:In_Progress"),
    "ALLOWED_TRANSITIONS must have a 'release-engineer:In_Progress' key (absent before C13 — the wedge)",
  );
  const row = ALLOWED_TRANSITIONS.get("release-engineer:In_Progress");
  assert.ok(row && row.length > 0, "release-engineer:In_Progress row must have at least one allowed target");
  assert.deepEqual(
    row,
    [
      { agent: "pm", status: "In_Progress" },
      { agent: "release-engineer", status: "Blocked" },
    ],
    "row must be exactly [{pm, In_Progress}, {release-engineer, Blocked}] per E53 AC1 — no researcher/architect/self-loop successor beyond the new Blocked edge",
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

test("T-MATRIX-C13/E37: qa-engineer:PASS allowed-next contains all four successors {pm, researcher, release-engineer, design-auditor}", () => {
  // WHY: a direct spot-check of the static row itself, complementing the
  // behavioral accept tests above. v3.94.0 (E37) widened this row a second
  // time (C13 added release-engineer; E37 restores design-auditor's
  // post-PASS opening edge, parity with the null:null opener's
  // design-auditor:In_Progress entry) — this test is pinned by identity
  // (row.some per entry) AND cardinality (row.length), so a future edit
  // that swaps one successor for another without changing the count would
  // still be caught.
  const row = ALLOWED_TRANSITIONS.get("qa-engineer:PASS");
  assert.ok(row, "qa-engineer:PASS row must exist");
  assert.ok(row.some((c) => c.agent === "pm" && c.status === "In_Progress"), "row must retain (pm, In_Progress)");
  assert.ok(
    row.some((c) => c.agent === "researcher" && c.status === "In_Progress"),
    "row must retain (researcher, In_Progress)",
  );
  assert.ok(
    row.some((c) => c.agent === "release-engineer" && c.status === "In_Progress"),
    "row must retain (release-engineer, In_Progress)",
  );
  assert.ok(
    row.some((c) => c.agent === "design-auditor" && c.status === "In_Progress"),
    "row must gain (design-auditor, In_Progress) — E37",
  );
  assert.equal(row.length, 4, "row must have exactly 4 successors — additive, not a fifth accidental entry");
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

// ============================================================================
// T-E37-01 — design-auditor's post-PASS opening edge (v3.94.0)
// ============================================================================
// WHY: the qa-engineer:PASS row ("previous feature closed, next may open")
// admitted only {pm, researcher, release-engineer} — design-auditor was
// never restored here when C13 added release-engineer, even though the
// null:null fresh-workspace opener has always admitted
// design-auditor:In_Progress (:177). Consequence: the design-armed chain's
// canonical opening move (coordinator dispatches design-auditor BEFORE pm so
// the auditor's token tables feed the spec) worked on a workspace's first
// feature and was TRANSITION_REJECTED on every feature thereafter — 6 of 7
// observed TRANSITION_REJECTED fires across 2 workspaces / 5 features,
// 07-21..07-23 (VS-NDI-Receiver telemetry). E37 adds
// { agent: "design-auditor", status: "In_Progress" } to the qa-engineer:PASS
// row. qa-engineer:FAIL is deliberately NOT widened (a QA failure is a fix
// loop — sr-engineer/pm — not a re-audit trigger); E38 revisits that shape
// deliberately, so the reject test below pins the deferral as a conscious
// boundary rather than an oversight.

// ---------- T-E37-01(a): opening edge — qa-engineer:PASS → design-auditor:In_Progress ----------

test("T-E37-01: qa-engineer:PASS → design-auditor:In_Progress accepted", () => {
  // WHY: the legal post-PASS opening write E37 restores — design-auditor
  // stamping its own agent_id straight out of a prior feature's PASS to
  // open the next one, exactly as it already could from null:null.
  // Mirrors T-MATRIX-C13(a) at :1711 for the release-engineer opening edge.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "PASS" },
      next: { agent: "design-auditor", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- T-E37-01(b): scope-guard reject — qa-engineer:FAIL → design-auditor:In_Progress ----------

test("T-E37-01: qa-engineer:FAIL → design-auditor:In_Progress still REJECTED (E38 deferral pin)", () => {
  // WHY: E37's scope guard — a QA failure is a fix loop (sr-engineer/pm),
  // not a re-audit trigger, so qa-engineer:FAIL is deliberately NOT widened
  // alongside qa-engineer:PASS. This pin locks that deferral so a future
  // widening of the FAIL row (E38's subject) is a conscious, reviewed edit
  // rather than an accidental copy-paste of the PASS row's new entry.
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "design-auditor", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "TRANSITION_REJECTED");
  assert.ok(
    !r.allowed.some((a) => a.new_agent === "design-auditor"),
    `allowed list must NOT contain design-auditor; got ${JSON.stringify(r.allowed)}`,
  );
  assert.deepEqual(
    r.allowed,
    [
      { new_agent: "sr-engineer", new_status: "In_Progress" },
      { new_agent: "pm", new_status: "In_Progress" },
    ],
    "qa-engineer:FAIL allowed set must be unchanged — exactly {sr-engineer, pm}",
  );
});

// ---------- T-E37-01(c): round-counter pin ----------

test("T-E37-01: computeNewRound holds qa_round/review_round/visual_round steady across qa-engineer:PASS → design-auditor:In_Progress", () => {
  // WHY: spec AC's round-counter expectation, mirroring T-MATRIX-C13(e).
  // next=(design-auditor, In_Progress) matches none of computeNewRound's
  // reset-or-increment branches (all keyed on qa-engineer or pm as
  // next.agent), so all three counters must hold from a nonzero prior
  // value. This is provably safe at any REACHABLE qa-engineer:PASS state —
  // PASS already zeroes qa_round and visual_round, and review_round was
  // zeroed by the code-reviewer:In_Progress → qa-engineer:In_Progress hop
  // that necessarily precedes PASS — but the pin is worth taking because it
  // is the same one-line insurance C13 took: a future edit that adds
  // design-auditor to a reset branch would silently launder a hot counter,
  // and this test would be the only thing to catch it.
  assert.deepEqual(
    computeNewRound(2, 3, 4, { agent: "design-auditor", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }),
    { qa_round: 2, review_round: 3, visual_round: 4, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
  // Also pin the zero-prior case (the realistic post-PASS state).
  assert.deepEqual(
    computeNewRound(0, 0, 0, { agent: "design-auditor", status: "In_Progress" }, { agent: "qa-engineer", status: "PASS" }),
    { qa_round: 0, review_round: 0, visual_round: 0, hop_count: 1, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 },
  );
});

// ============================================================================
// T-E45-01 — qa-engineer:Blocked → pm:In_Progress escape edge (v3.95.0, E45)
// ============================================================================
// WHY: tools/transitions.ts:246-287 (E45) adds { agent: "pm", status:
// "In_Progress" } to the qa-engineer:Blocked row of ALLOWED, restoring
// symmetry with the other six <role>:Blocked rows (all of which already
// carry a Blocked -> pm:In_Progress escape) and closing the dead end
// documented in research/vs-ndi-button-realign-qa-blocked-dead-end.md: QA
// halted at Blocked on a contract defect that was honestly markable neither
// PASS nor FAIL, and from there PM was unreachable. Human chose option A,
// LOOSE variant — no resume_of requirement on this outbound edge, matching
// the qa-engineer:FAIL -> pm precedent and all six peer Blocked rows (none
// of which require resume_of to reach pm; that field gates only the PM
// RETURN-leg, step 3.5 of validateTransition).
//
// Per code-reviewer's review (review_reports/review_T-E45-01.md), the row
// edit shipped correct but UNPINNED — the suite stayed green on a purely
// additive change because nothing asserted this row's exact membership.
// These tests close that gap: the positive accept the ticket exists for, a
// row-equality pin (T-MATRIX-C13/E37 shape) so the next additive edit to
// this row cannot land silently the same way, regression pins on the
// sibling qa-engineer:In_Progress row and the three round-cap override
// envelopes (measured byte-identical by the reviewer, but never pinned from
// this row's own direction), and the E38 next_role lookahead advisory's
// predicate on a Blocked state, both silent (pm now legal) and still firing
// (a genuinely unreachable next_role).

// ---------- positive accept: the edge the ticket exists for ----------

test("T-E45-01: qa-engineer:Blocked → pm:In_Progress accepted, no resume_of required", () => {
  // WHY: this is the edge E45 ships, and it shipped with zero coverage of
  // itself. next_resume_of is omitted entirely below — resume_of gates ONLY
  // the PM RETURN-leg (pm:In_Progress -> {code-reviewer,qa-engineer}) and
  // plays no role in this OUTBOUND edge — so this must accept without it,
  // per the human's explicit loose-variant choice.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "Blocked" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- row-equality pin (T-MATRIX-C13/E37 shape, :1841) ----------

test("T-E45-01: qa-engineer:Blocked row equals exactly {sr-engineer:In_Progress, qa-engineer:In_Progress, pm:In_Progress}", () => {
  // WHY: mirrors the T-MATRIX-C13/E37 row-identity-and-cardinality pin at
  // :1841. deepEqual pins membership AND order (the new pm entry is
  // appended last, matching the C13/E37 append convention) — a future
  // additive edit to this row (the exact way E45 itself shipped unpinned)
  // can no longer land silently.
  const row = ALLOWED_TRANSITIONS.get("qa-engineer:Blocked");
  assert.ok(row, "qa-engineer:Blocked row must exist");
  assert.deepEqual(
    row,
    [
      { agent: "sr-engineer", status: "In_Progress" },
      { agent: "qa-engineer", status: "In_Progress" },
      { agent: "pm", status: "In_Progress" },
    ],
    "qa-engineer:Blocked row must be exactly these three successors, in this order",
  );
});

// ---------- regression pin: qa-engineer:In_Progress unaffected (no direct pm leak) ----------

test("T-E45-01 (regression pin): qa-engineer:In_Progress row still admits only its three own-agent statuses — no direct pm entry", () => {
  // WHY: E45's edit is scoped to the qa-engineer:Blocked row only. This pins
  // that the sibling qa-engineer:In_Progress row (the state QA occupies
  // WHILE reviewing, before it reaches PASS/FAIL/Blocked) did not acquire
  // the same shortcut to pm — that would let QA hand off to PM mid-review,
  // bypassing the PASS/FAIL/Blocked decision entirely.
  assert.deepEqual(
    ALLOWED_TRANSITIONS.get("qa-engineer:In_Progress"),
    [
      { agent: "qa-engineer", status: "PASS" },
      { agent: "qa-engineer", status: "FAIL" },
      { agent: "qa-engineer", status: "Blocked" },
    ],
    "qa-engineer:In_Progress must still admit only PASS/FAIL/Blocked — no pm leak",
  );
});

// ---------- regression pin: round-cap override envelopes unaffected, pinned from this row's direction ----------

test("T-E45-01 (regression pin): qa_round at cap still rejects qa-engineer:Blocked → sr-engineer:In_Progress (QA_ROUND_EXCEEDED, pm-only)", () => {
  // WHY: round-cap overrides (transitions.ts step 2) outrank the table
  // lookup (step 4) unconditionally — a target legal at the table level
  // must still be rejected once qa_round is at cap, exactly as before this
  // row grew a third entry. The reviewer measured the three cap envelopes
  // byte-identical across both review rounds; nothing previously pinned
  // that from THIS row's own direction.
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "Blocked" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 4,
    prev_review_round: 0,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "QA_ROUND_EXCEEDED");
  assert.deepEqual(r.allowed, [{ new_agent: "pm", new_status: "In_Progress" }]);
});

test("T-E45-01 (regression pin): review_round at cap still rejects qa-engineer:Blocked → qa-engineer:In_Progress (REVIEW_ROUND_EXCEEDED, pm-only)", () => {
  const r = validateTransition({
    prev: { agent: "qa-engineer", status: "Blocked" },
    next: { agent: "qa-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 4,
  });
  assert.ok(r, "transition must be rejected");
  assert.equal(r.error, "REVIEW_ROUND_EXCEEDED");
  assert.deepEqual(r.allowed, [{ new_agent: "pm", new_status: "In_Progress" }]);
});

test("T-E45-01 (regression pin): visual_round at cap still accepts qa-engineer:Blocked → pm:In_Progress (the cap's own escape, unweakened)", () => {
  // WHY: at visual_round cap, (pm, In_Progress) was already the sole legal
  // landing regardless of the table row. This confirms the new table entry
  // didn't change the cap's own behavior — no duplicate/shadowing effect —
  // by exercising the cap from qa-engineer:Blocked specifically.
  assert.equal(
    validateTransition({
      prev: { agent: "qa-engineer", status: "Blocked" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
      prev_visual_round: 6,
    }),
    null,
  );
});

// ---------- E38 next_role lookahead advisory, pinned on a Blocked state ----------
// WHY: docs/backlog.md's E45 row flags an open question about how the E38
// next_role lookahead advisory (tools/handoff-orchestrator.ts) behaves on
// Blocked states. The two tests below pin the CURRENT predicate directly,
// in both directions: silent now that pm is a legal successor of
// qa-engineer:Blocked (this ticket's edge), and still firing for a
// genuinely unreachable next_role from that same state — so together they
// pin the predicate itself, not merely its silence on this one edge.

test("T-E45-01/E38: qa-engineer:Blocked write with next_role=pm produces NO advisory (pm now a legal successor)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twe45-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  await seedState(ws, "e45-lookahead-silent", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e45-lookahead-silent",
    status: "Blocked",
    agent_id: "qa-engineer",
    completed_tasks: [],
    pending_notes: [],
    blocking_reason: "e45 probe — Blocked with next_role=pm",
    next_role: "pm",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `write must succeed; got: ${text}`);
  const envelope = JSON.parse(text);
  assert.equal(
    envelope.warnings,
    undefined,
    "next_role=pm from qa-engineer:Blocked must stay silent now that pm is a legal successor of this row",
  );
});

test("T-E45-01/E38: qa-engineer:Blocked write with an unreachable next_role STILL warns (predicate pinned, not just its silence)", async () => {
  // WHY: "architect" is not, and never was, in the qa-engineer:Blocked row
  // ({sr-engineer, qa-engineer, pm}) — proving E45 widened the row's legal-
  // successor SET, not the advisory's willingness to fire at all.
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twe45-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  await seedState(ws, "e45-lookahead-fires", "qa-engineer", "In_Progress");
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: "e45-lookahead-fires",
    status: "Blocked",
    agent_id: "qa-engineer",
    completed_tasks: [],
    pending_notes: [],
    blocking_reason: "e45 probe — Blocked with unreachable next_role",
    next_role: "architect",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `write must succeed (advisory never rejects); got: ${text}`);
  const envelope = JSON.parse(text);
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length === 1, "exactly one warning expected");
  const warning = envelope.warnings[0];
  assert.match(warning, /next_role="architect"/);
  assert.match(warning, /qa-engineer:Blocked/, "warning must name the state just written");
  assert.match(warning, /sr-engineer:In_Progress/, "remedy must name sr-engineer:In_Progress");
  assert.match(warning, /qa-engineer:In_Progress/, "remedy must name qa-engineer:In_Progress");
  assert.match(warning, /pm:In_Progress/, "remedy must name pm:In_Progress (the E45 edge)");
});

// ============================================================================
// T-E53-03 — release-engineer:Blocked reachability + sr-engineer gap B (v3.98.0, E53)
// ============================================================================
// WHY: before this cut, release-engineer:Blocked was UNREACHABLE — no edge
// into it existed at all (release-engineer:In_Progress admitted only
// pm:In_Progress), even though content/skill-release-engineer.md's step 7a
// empty-baseline guard and six Escalation Routes rows all instruct the role
// to halt via exactly that write. E53 opens the missing entry edge plus a
// new release-engineer:Blocked key with three destinations (self-resume,
// pm-recovery, qa-engineer for the npm-test-regression row), and separately
// fixes the same defect SHAPE for sr-engineer (content/skill-sr-engineer.md:50
// routes Blocked -> design-auditor on "visual structure unspecified", an
// edge sr-engineer:Blocked previously lacked). Five edges total, proven
// exhaustively by code-reviewer's 1056-tuple differential
// (review_reports/review_T-E53-01.md AC4): accepted edges 63 -> 68, zero
// closed. The two positive-accept groups below pin each edge individually;
// the row-equality pins pin each row's full membership+order; the exhaustive
// sweep at the end is the durable, in-suite form of that differential — it
// re-derives the reviewer's proof from source rather than trusting a
// point-in-time review artifact, so a later edit that opens or closes ANY
// edge anywhere in the matrix (not just these five) fails loudly here.

// ---------- positive accepts: the five edges this ticket opens ----------

test("T-E53-03(a): release-engineer:In_Progress → release-engineer:Blocked accepted (the entry edge)", () => {
  // WHY: the edge that made release-engineer:Blocked reachable at all. Before
  // E53, ALLOWED.get("release-engineer:In_Progress") had exactly one
  // successor (pm:In_Progress); the state release-engineer:Blocked existed
  // as a *destination* (self.SOP instructs writing it) but no source edge
  // led there — writing it would have hit TRANSITION_REJECTED.
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "In_Progress" },
      next: { agent: "release-engineer", status: "Blocked" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-E53-03(b): release-engineer:Blocked → release-engineer:In_Progress accepted (self-resume)", () => {
  // WHY: NOT covered by the generic self-loop fast path in validateTransition
  // (step 3) — that path only fires on same-agent In_Progress→In_Progress;
  // Blocked→In_Progress for the same agent must come from the table. This is
  // the resume-after-halt edge every peer <role>:Blocked row already has.
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "Blocked" },
      next: { agent: "release-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-E53-03(c): release-engineer:Blocked → pm:In_Progress accepted (recovery escape)", () => {
  // WHY: mirrors the pm-escape shape all six other <role>:Blocked rows carry
  // (researcher/design-auditor/pm/architect/sr-engineer/code-reviewer) —
  // five of the six D10-style Escalation Routes rows in
  // content/skill-release-engineer.md:152-157 route to next_role=human, which
  // resolves via this edge (coordinator recovery) or the self-resume edge
  // above.
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "Blocked" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-E53-03(d): release-engineer:Blocked → qa-engineer:In_Progress accepted (npm-test-regression row)", () => {
  // WHY: the one Escalation Routes row (content/skill-release-engineer.md:153,
  // "`npm test` regression") that names next_role=qa-engineer rather than
  // human — pm alone would have been the wrong destination set for this key.
  // Precedent: qa-engineer:Blocked -> sr-engineer:In_Progress (route to the
  // role that must fix, not just to pm).
  assert.equal(
    validateTransition({
      prev: { agent: "release-engineer", status: "Blocked" },
      next: { agent: "qa-engineer", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

test("T-E53-03(e): sr-engineer:Blocked → design-auditor:In_Progress accepted (gap B)", () => {
  // WHY: content/skill-sr-engineer.md:50's "visual structure unspecified"
  // escalation row instructs exactly this write; sr-engineer:Blocked
  // previously admitted only {sr-engineer:In_Progress, pm:In_Progress} — the
  // SOP-prescribed route was TRANSITION_REJECTED. Same defect shape as
  // T-E45-01's qa-engineer:Blocked gap, found by E53's own instruction to
  // audit every role's :Blocked reachability in the same pass.
  assert.equal(
    validateTransition({
      prev: { agent: "sr-engineer", status: "Blocked" },
      next: { agent: "design-auditor", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
    }),
    null,
  );
});

// ---------- row-equality pins (T-MATRIX-C13/E37/T-E45-01 shape) ----------

test("T-E53-03(f): release-engineer:Blocked row equals exactly {release-engineer:In_Progress, pm:In_Progress, qa-engineer:In_Progress}, in this order", () => {
  // WHY: this key did not exist at all before E53 (ALLOWED.get(...) returned
  // undefined). Pinning membership AND order now, at the moment the key is
  // introduced, means a future additive edit to this brand-new row is caught
  // from its very first review rather than shipping unpinned the way E45's
  // qa-engineer:Blocked row once did (review_reports/review_T-E45-01.md).
  const row = ALLOWED_TRANSITIONS.get("release-engineer:Blocked");
  assert.ok(row, "release-engineer:Blocked row must exist");
  assert.deepEqual(
    row,
    [
      { agent: "release-engineer", status: "In_Progress" },
      { agent: "pm", status: "In_Progress" },
      { agent: "qa-engineer", status: "In_Progress" },
    ],
    "release-engineer:Blocked row must be exactly these three successors, in this order",
  );
});

test("T-E53-03(g): sr-engineer:Blocked row equals exactly {sr-engineer:In_Progress, pm:In_Progress, design-auditor:In_Progress}, in this order", () => {
  // WHY: same rationale as T-MATRIX-C13/E37's :1841 pin — an additive edit to
  // an existing row is invisible to a same-set-membership assert.ok chain;
  // only deepEqual on the full row catches a stray sixth successor or a
  // silently dropped existing one.
  const row = ALLOWED_TRANSITIONS.get("sr-engineer:Blocked");
  assert.ok(row, "sr-engineer:Blocked row must exist");
  assert.deepEqual(
    row,
    [
      { agent: "sr-engineer", status: "In_Progress" },
      { agent: "pm", status: "In_Progress" },
      { agent: "design-auditor", status: "In_Progress" },
    ],
    "sr-engineer:Blocked row must be exactly these three successors, in this order",
  );
});

// ---------- exhaustive negative pin: nothing else opened (durable differential) ----------

test("T-E53-03(h): exhaustive matrix sweep — accepted edge set is EXACTLY the 69 tuples E53+E58 leave standing (durable form of the reviewer's 1056-tuple differential; extended by T-E39-03 for E58's pm:Blocked -> design-auditor:In_Progress edge)", () => {
  // WHY: code-reviewer's AC4 proof (review_reports/review_T-E53-01.md) ran a
  // one-off 1056-tuple differential (33 prev tuples x 32 next tuples) against
  // two compiled snapshots to show accepted edges went 63 -> 68 with zero
  // closed. That proof is real but point-in-time — it lives in a review
  // artifact, not the suite, so it cannot catch a LATER regression. This test
  // re-derives the same universe from source and pins the resulting accepted
  // set as a literal snapshot, so any future edit that opens or closes ANY
  // edge anywhere in ALLOWED_TRANSITIONS — not just the five this ticket
  // touches — fails here with an actionable diff, the same way the row-
  // equality pins above do for a single row. Deliberately a positive pin
  // (the accepted set), not a hand-listed set of rejected tuples: a rejected-
  // tuple list only proves the tuples someone thought to write down were
  // still rejected, and silently says nothing about tuples nobody enumerated;
  // pinning the accepted set is exhaustive by construction, since anything
  // not in the expected set is implicitly asserted rejected.
  const AGENTS = [
    "pm",
    "researcher",
    "design-auditor",
    "architect",
    "sr-engineer",
    "code-reviewer",
    "qa-engineer",
    "release-engineer",
  ];
  const STATUSES = ["In_Progress", "PASS", "FAIL", "Blocked"];

  // Universe: prev in {null:null} ∪ (agent x status) = 1 + 8*4 = 33 tuples;
  // next in (agent x status) = 8*4 = 32 tuples (agent_id is always required on
  // a real write, so next.agent is never null here). 33 x 32 = 1056 combos —
  // matches the reviewer's own enumeration exactly.
  const prevTuples = [{ agent: null, status: null }];
  for (const a of AGENTS) for (const s of STATUSES) prevTuples.push({ agent: a, status: s });
  const nextTuples = [];
  for (const a of AGENTS) for (const s of STATUSES) nextTuples.push({ agent: a, status: s });
  assert.equal(prevTuples.length, 33, "prev universe must be 33 tuples");
  assert.equal(nextTuples.length, 32, "next universe must be 32 tuples");

  const accepted = [];
  for (const prev of prevTuples) {
    for (const next of nextTuples) {
      const r = validateTransition({ prev, next, prev_qa_round: 0, prev_review_round: 0 });
      if (r === null) accepted.push(`${prev.agent ?? "null"}:${prev.status ?? "null"} -> ${next.agent}:${next.status}`);
    }
  }

  const EXPECTED = [
    "null:null -> pm:In_Progress",
    "null:null -> pm:Blocked",
    "null:null -> researcher:In_Progress",
    "null:null -> researcher:Blocked",
    "null:null -> design-auditor:In_Progress",
    "null:null -> design-auditor:Blocked",
    "pm:In_Progress -> pm:In_Progress",
    "pm:In_Progress -> pm:Blocked",
    "pm:In_Progress -> researcher:In_Progress",
    "pm:In_Progress -> design-auditor:In_Progress",
    "pm:In_Progress -> architect:In_Progress",
    "pm:In_Progress -> sr-engineer:In_Progress",
    "pm:Blocked -> pm:In_Progress",
    "pm:Blocked -> pm:Blocked",
    "pm:Blocked -> design-auditor:In_Progress",
    "researcher:In_Progress -> pm:In_Progress",
    "researcher:In_Progress -> pm:Blocked",
    "researcher:In_Progress -> researcher:In_Progress",
    "researcher:In_Progress -> researcher:Blocked",
    "researcher:In_Progress -> design-auditor:In_Progress",
    "researcher:Blocked -> pm:In_Progress",
    "researcher:Blocked -> researcher:In_Progress",
    "design-auditor:In_Progress -> pm:In_Progress",
    "design-auditor:In_Progress -> design-auditor:In_Progress",
    "design-auditor:In_Progress -> design-auditor:Blocked",
    "design-auditor:Blocked -> pm:In_Progress",
    "design-auditor:Blocked -> design-auditor:In_Progress",
    "architect:In_Progress -> pm:In_Progress",
    "architect:In_Progress -> architect:In_Progress",
    "architect:In_Progress -> architect:Blocked",
    "architect:In_Progress -> sr-engineer:In_Progress",
    "architect:Blocked -> pm:In_Progress",
    "architect:Blocked -> architect:In_Progress",
    "sr-engineer:In_Progress -> pm:In_Progress",
    "sr-engineer:In_Progress -> sr-engineer:In_Progress",
    "sr-engineer:In_Progress -> sr-engineer:Blocked",
    "sr-engineer:In_Progress -> code-reviewer:In_Progress",
    "sr-engineer:Blocked -> pm:In_Progress",
    "sr-engineer:Blocked -> design-auditor:In_Progress",
    "sr-engineer:Blocked -> sr-engineer:In_Progress",
    "code-reviewer:In_Progress -> code-reviewer:In_Progress",
    "code-reviewer:In_Progress -> code-reviewer:FAIL",
    "code-reviewer:In_Progress -> code-reviewer:Blocked",
    "code-reviewer:In_Progress -> qa-engineer:In_Progress",
    "code-reviewer:FAIL -> pm:In_Progress",
    "code-reviewer:FAIL -> sr-engineer:In_Progress",
    "code-reviewer:Blocked -> pm:In_Progress",
    "code-reviewer:Blocked -> code-reviewer:In_Progress",
    "qa-engineer:In_Progress -> qa-engineer:In_Progress",
    "qa-engineer:In_Progress -> qa-engineer:PASS",
    "qa-engineer:In_Progress -> qa-engineer:FAIL",
    "qa-engineer:In_Progress -> qa-engineer:Blocked",
    "qa-engineer:PASS -> pm:In_Progress",
    "qa-engineer:PASS -> researcher:In_Progress",
    "qa-engineer:PASS -> design-auditor:In_Progress",
    "qa-engineer:PASS -> release-engineer:In_Progress",
    "qa-engineer:FAIL -> pm:In_Progress",
    "qa-engineer:FAIL -> sr-engineer:In_Progress",
    "qa-engineer:Blocked -> pm:In_Progress",
    "qa-engineer:Blocked -> sr-engineer:In_Progress",
    "qa-engineer:Blocked -> qa-engineer:In_Progress",
    "release-engineer:In_Progress -> pm:In_Progress",
    "release-engineer:In_Progress -> release-engineer:In_Progress",
    "release-engineer:In_Progress -> release-engineer:Blocked",
    "release-engineer:PASS -> pm:In_Progress",
    "release-engineer:PASS -> researcher:In_Progress",
    "release-engineer:Blocked -> pm:In_Progress",
    "release-engineer:Blocked -> qa-engineer:In_Progress",
    "release-engineer:Blocked -> release-engineer:In_Progress",
  ].sort();

  const sortedAccepted = accepted.slice().sort();
  assert.equal(sortedAccepted.length, 69, `expected exactly 69 accepted edges, got ${sortedAccepted.length}`);
  assert.deepEqual(
    sortedAccepted,
    EXPECTED,
    "accepted edge set must match the E53 baseline exactly — any diff here is either an unintended edge opened or an unintended edge closed",
  );
});
