// Coded by @qa-engineer
// Tests for specs/pixel-perfect-fixes-v3.14.md — AC-8, AC-9, AC-11.
// Asserts the visual_round sub-loop semantics:
//   - increments only on (qa-engineer, FAIL) + pending_notes.visual_fail:
//   - resets on PASS or (pm, In_Progress)
//   - cap at 6 (5 fails then lock to pm)
//   - split escalation at visual_round >= 3 — sr-engineer → pm allowed

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeNewRound,
  validateTransition,
  VISUAL_ROUND_CAP_EXPORTED,
} from "../dist/tools/transitions.js";

// ---------- AC-8: counter semantics ----------

test("AC-8: (qa-engineer, FAIL) + visual_fail: token → visual_round increments", () => {
  // Why: visual_round is a *narrow* counter — only ticks when the FAIL is
  // a pixel/widget drift, not a test-logic FAIL. The token in pending_notes
  // is the discriminator. Tests verify both the token-present-bump and
  // the token-absent-hold semantics.
  const result = computeNewRound(
    0, 0, 0,
    { agent: "qa-engineer", status: "FAIL" },
    undefined,
    ["visual_fail: datetime.picker, keyboard.virtual", "next_role: sr-engineer"],
  );
  assert.equal(result.visual_round, 1, "visual_fail: token bumps visual_round");
  assert.equal(result.qa_round, 1, "qa_round bumps in lockstep for any FAIL");
});

test("AC-8: (qa-engineer, FAIL) without visual_fail: → visual_round held", () => {
  // Why: a test-logic FAIL must NOT bump visual_round. Without this guard
  // a non-visual workspace would accumulate phantom visual rounds.
  const result = computeNewRound(
    0, 0, 0,
    { agent: "qa-engineer", status: "FAIL" },
    undefined,
    ["QA: T01 failed — unit test reports wrong value", "next_role: sr-engineer"],
  );
  assert.equal(result.visual_round, 0, "no visual_fail: token → visual_round stays");
  assert.equal(result.qa_round, 1, "qa_round still bumps for test-logic FAIL");
});

test("AC-8: (qa-engineer, FAIL) + visual_fail: increments from prior count", () => {
  const result = computeNewRound(
    2, 0, 2,
    { agent: "qa-engineer", status: "FAIL" },
    undefined,
    ["visual_fail: pixel", "next_role: sr-engineer"],
  );
  assert.equal(result.visual_round, 3, "prior=2 + visual_fail FAIL = 3");
});

test("AC-8: (qa-engineer, PASS) resets visual_round to 0", () => {
  const result = computeNewRound(
    0, 0, 4,
    { agent: "qa-engineer", status: "PASS" },
  );
  assert.equal(result.visual_round, 0, "PASS resets — symmetric to qa_round");
});

test("AC-8: (pm, In_Progress) resets visual_round to 0 (PM re-entry)", () => {
  // Why: the unified escape valve must clear ALL counters; otherwise a
  // post-Round-6 PM rebudget would leave the lock in place.
  const result = computeNewRound(
    0, 0, 5,
    { agent: "pm", status: "In_Progress" },
  );
  assert.equal(result.visual_round, 0, "PM re-entry clears visual_round");
});

test("AC-8: other writes hold visual_round unchanged", () => {
  for (const next of [
    { agent: "sr-engineer", status: "In_Progress" },
    { agent: "code-reviewer", status: "In_Progress" },
    { agent: "code-reviewer", status: "FAIL" },
    { agent: "architect", status: "In_Progress" },
  ]) {
    const result = computeNewRound(0, 0, 2, next);
    assert.equal(result.visual_round, 2, `${next.agent}:${next.status} must not touch visual_round`);
  }
});

// ---------- AC-8: round-cap lock ----------

test("AC-8: VISUAL_ROUND_CAP exported as 6 (5 rounds visible + 1 lock index)", () => {
  // Why: Constitution §3.1 declares "cap is 5 rounds" — the off-by-one
  // matches ROUND_CAP=4 (3 fails then Round 4 lock). Export pinned so
  // skill SOPs and external tooling can grep the value.
  assert.equal(VISUAL_ROUND_CAP_EXPORTED, 6, "VISUAL_ROUND_CAP must be 6");
});

test("AC-8: visual_round >= cap → only (pm, In_Progress) is accepted", () => {
  const rejection = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 6,
    next_pending_notes: ["visual_fail: pixel"],
  });
  assert.ok(rejection !== null, "must reject sr-engineer transition at cap");
  assert.equal(rejection.error, "VISUAL_ROUND_EXCEEDED");
  assert.deepEqual(
    rejection.allowed,
    [{ new_agent: "pm", new_status: "In_Progress" }],
    "only PM rebudget is allowed at cap",
  );
  assert.equal(rejection.attempted.visual_round, 6, "rejection carries visual_round in attempted");
});

test("AC-8: visual_round at cap allows (pm, In_Progress)", () => {
  const rejection = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 6,
  });
  assert.equal(rejection, null, "PM rebudget must be the only accepted transition at cap");
});

// ---------- AC-9: split escalation ----------

test("AC-9: at visual_round=3, (sr-engineer → pm, In_Progress) is accepted", () => {
  // Why: the constitutional split-escalation early-escape path. Without
  // this transition being allowed, sr-engineer would have to grind 2 more
  // rounds before PM could split the widget into sub-tasks.
  const rejection = validateTransition({
    prev: { agent: "sr-engineer", status: "In_Progress" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 3,
    next_pending_notes: ["visual_split_requested: datetime.picker too large to converge", "next_role: pm"],
  });
  assert.equal(rejection, null, "split-escalation transition must be allowed at visual_round=3");
});

test("AC-9: split escalation also allowed at rounds 4 and 5 (Round 3-5 window)", () => {
  for (const round of [3, 4, 5]) {
    const rejection = validateTransition({
      prev: { agent: "sr-engineer", status: "In_Progress" },
      next: { agent: "pm", status: "In_Progress" },
      prev_qa_round: 0,
      prev_review_round: 0,
      prev_visual_round: round,
      next_pending_notes: ["visual_split_requested: <reason>"],
    });
    assert.equal(rejection, null, `split escalation must be allowed at visual_round=${round}`);
  }
});

// ---------- AC-11: handoff schema v3 round-trip via computeNewRound ----------

test("AC-11: pre-v3.14 callers (no prev_visual_round) work unchanged (backwards compat)", () => {
  // Why: the prev_visual_round parameter is required positionally now,
  // but downstream Storage/handoff parsers default missing fields to 0.
  // Passing 0 explicitly should match historical behaviour.
  const result = computeNewRound(
    2, 1, 0,
    { agent: "sr-engineer", status: "In_Progress" },
  );
  assert.deepEqual(result, { qa_round: 2, review_round: 1, visual_round: 0 });
});

test("AC-11: visual_fail token detection is whitespace-robust", () => {
  // Why: pending_notes routinely carry leading/trailing whitespace from
  // operators. The token detector trims before matching, so all of these
  // must bump visual_round.
  for (const note of ["visual_fail: pixel", "  visual_fail: widget", "visual_fail:   "]) {
    const result = computeNewRound(
      0, 0, 0,
      { agent: "qa-engineer", status: "FAIL" },
      undefined,
      [note],
    );
    assert.equal(result.visual_round, 1, `note "${note}" must bump visual_round`);
  }
});

test("AC-11: visual_fail token NOT confused with substring matches", () => {
  // Why: a freeform note like "no visual_fail observed" must NOT trigger
  // the bump. Detection uses startsWith() after trim, so the token must
  // appear at the start of a (trimmed) note line.
  const result = computeNewRound(
    0, 0, 0,
    { agent: "qa-engineer", status: "FAIL" },
    undefined,
    ["all visual checks fine, no visual_fail observed", "next_role: sr-engineer"],
  );
  assert.equal(result.visual_round, 0, "substring 'visual_fail' must not trigger the bump");
});
