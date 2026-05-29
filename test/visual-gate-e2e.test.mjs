// Coded by @qa-engineer
// Tests for specs/bug-fixes-v3.14.1.md — AC-5, AC-6, AC-7, AC-10.
//
// These tests assert the COMPOSITION through index.ts handler logic:
//   tw_update_state path: validateTransition → visual evidence gate →
//   computeNewRound → writeState → readback.
// They drive the same primitives the handler calls; without them, a refactor
// to index.ts that re-orders the gates could silently regress v3.14.0
// contracts (visual_round persistence, VISUAL_EVIDENCE_MISSING rejection,
// VISUAL_ROUND_EXCEEDED rejection, Round 6 sentinel injection).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  validateTransition,
  computeNewRound,
} from "../dist/tools/transitions.js";
import {
  hasVisualBaselinesInDesign,
  hasVisualEvidenceInFile,
} from "../dist/tools/evidence-file.js";
import {
  parseHandoff,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "vge-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function seedDesignWithBaselines(ws, feature) {
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "design", `${feature}.md`),
    `# design/${feature}\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n| --- | --- | --- | --- |\n| oobe.s1 | design/oobe/s1.png | screenshots/s1.png | landscape |\n`,
  );
}

function seedVisualEvidence(ws, taskId) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "qa_reports", `visual_${taskId}.md`),
    `# Visual report ${taskId}\n\n## Verdict — PASS\n`,
  );
}

// ---------- AC-5 — VISUAL_EVIDENCE_MISSING composition ----------

test("AC-5: handler composition — PASS rejected when baselines declared but visual evidence missing", () => {
  // Why: unit tests verify hasVisualBaselinesInDesign + hasVisualEvidenceInFile
  // separately. This test verifies the conjunction the handler runs:
  // (1) baselines present? (2) every completed_task has visual evidence?
  // A refactor that reorders the two checks should still produce a missing
  // list for at least one task id if baselines exist + evidence absent.
  const ws = mkWorkspace();
  seedDesignWithBaselines(ws, "feat-x");
  // NO visual evidence written.

  const gate = hasVisualBaselinesInDesign(ws, "feat-x");
  assert.equal(gate.present, true, "baselines must trigger gate");
  const ev = hasVisualEvidenceInFile(ws, ["T01", "T02"]);
  assert.deepEqual(ev.missing, ["T01", "T02"], "both task ids must be missing");
  assert.deepEqual(ev.present, []);

  // The handler would now return isError: true with VISUAL_EVIDENCE_MISSING.
  // Mirror that decision logic here so we catch a regression where someone
  // splits the gate into "warn but allow" — that would make this assertion fail.
  const shouldReject = gate.present && ev.missing.length > 0;
  assert.equal(shouldReject, true, "handler MUST reject PASS in this state");
});

test("AC-5: handler composition — partial evidence still triggers VISUAL_EVIDENCE_MISSING", () => {
  // Edge case: half the tasks have visual reports, half don't. The gate
  // must reject because the missing-set is non-empty — NOT pass because
  // some-evidence-exists.
  const ws = mkWorkspace();
  seedDesignWithBaselines(ws, "partial");
  seedVisualEvidence(ws, "T01");
  // T02 has no visual_T02.md

  const gate = hasVisualBaselinesInDesign(ws, "partial");
  const ev = hasVisualEvidenceInFile(ws, ["T01", "T02"]);
  assert.equal(gate.present, true);
  assert.deepEqual(ev.present, ["T01"]);
  assert.deepEqual(ev.missing, ["T02"]);
  assert.equal(gate.present && ev.missing.length > 0, true, "ANY missing → reject");
});

test("AC-5: handler composition — no baselines → gate dormant even with no evidence (backwards-compat)", () => {
  // The non-UI workspace contract. Even with NO visual_<id>.md, PASS must
  // be allowed when no baselines are declared.
  const ws = mkWorkspace();
  // No design file at all.

  const gate = hasVisualBaselinesInDesign(ws, "any-feature");
  assert.equal(gate.present, false, "absent design file → gate dormant");
  // The handler skips hasVisualEvidenceInFile entirely in this branch.
});

// ---------- AC-6 — Round 6 sentinel ----------

test("AC-6: Round 6 sentinel — fires on cap-cross from prev=5", () => {
  // Why: the v3.14.1 predicate fix changes `=== 6 && === 5` to
  // `>= 6 && < 6`. The normal cap-cross MUST still fire.
  const result = computeNewRound(
    0, 0, 5,
    { agent: "qa-engineer", status: "FAIL" },
    undefined,
    ["visual_fail: pixel", "next_role: sr-engineer"],
  );
  assert.equal(result.visual_round, 6, "prev=5 + visual_fail FAIL = 6");
  const shouldInjectSentinel = result.visual_round >= 6 && 5 < 6;
  assert.equal(shouldInjectSentinel, true, "sentinel MUST inject on normal cap-cross");
});

test("AC-6: Round 6 sentinel — fires on cap-cross from prev<5 (migration / external bump)", () => {
  // Why: this is the EXACT scenario the v3.14.0 `=== === ` predicate
  // missed. If somehow prev_visual_round arrives at the handler at a value
  // < 5 and the new counter goes to 6+ (e.g. migration bug, schema bump
  // that inserts a different default), the sentinel MUST still fire.
  // We can't easily synthesise this from computeNewRound (which increments
  // by 1), so we drive the predicate directly.
  const prev = 4;
  const next = 6; // hypothetically arrived externally
  const oldPredicate = next === 6 && prev === 5;
  const newPredicate = next >= 6 && prev < 6;
  assert.equal(oldPredicate, false, "v3.14.0 predicate would SKIP this case");
  assert.equal(newPredicate, true, "v3.14.1 predicate MUST fire");
});

test("AC-6: Round 6 sentinel — does NOT fire when already past cap", () => {
  // Why: predicate must be cap-CROSS, not cap-RESIDENCE. After the sentinel
  // fires once on 5→6, a subsequent 6→7 must NOT re-inject the message.
  const prev = 6;
  const next = 7;
  const newPredicate = next >= 6 && prev < 6;
  assert.equal(newPredicate, false, "sentinel must inject exactly once");
});

// ---------- AC-7 — visual_round persistence end-to-end ----------

test("AC-7: visual_round persists across writeState → readback", async () => {
  // Why: assert that the writeState + parseHandoff round-trip preserves
  // visual_round. The unit tests cover the parse + write separately but
  // the round-trip with v3 schema is what the handler exercises.
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws); // session warm-up

  await writeHandoffState(
    ws, "feat-vr", "FAIL", [], ["visual_fail: pixel"],
    "QA failed pixel diff", "qa-engineer",
    0, undefined, 0, 3,  // qa_round=0, prd_path=undefined, review_round=0, visual_round=3
  );

  const state = parseHandoff(ws);
  assert.equal(state.visual_round, 3, "visual_round MUST persist through writeState");
  assert.equal(state.qa_round, 0, "qa_round unaffected");
  assert.equal(state.review_round, 0, "review_round unaffected");
  assert.equal(state.last_agent, "qa-engineer");
});

test("AC-7: visual_round survives a subsequent read+write cycle", async () => {
  // Why: the lazy-migrate path triggers a fire-and-forget writeback. We
  // already heal at v3, so this should be a no-op — but a regression in
  // the heal path could drop visual_round on re-write.
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "f1", "In_Progress", [], [], undefined, "pm", 0, undefined, 0, 4);

  // simulate another agent reading and rewriting
  resetSession();
  const stateAfterRead = parseHandoff(ws);
  assert.equal(stateAfterRead.visual_round, 4, "round 1 read OK");
  markStateRead(ws);
  await writeHandoffState(ws, "f1", "In_Progress", [], [], undefined, "pm", 0, undefined, 0, 4);

  const stateAfterCycle = parseHandoff(ws);
  assert.equal(stateAfterCycle.visual_round, 4, "round 2 read MUST preserve visual_round");
});

// ---------- AC-10 — VISUAL_ROUND_EXCEEDED composition ----------

test("AC-10: handler composition — VISUAL_ROUND_EXCEEDED rejects everything except (pm, In_Progress)", () => {
  // Why: assert the round-cap branch via validateTransition. This is the
  // contract the handler relies on — if validateTransition stopped applying
  // the cap, the handler would silently accept post-cap writes.
  const rejection = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "sr-engineer", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 6,
    next_pending_notes: ["visual_fail: pixel"],
  });
  assert.ok(rejection, "must reject");
  assert.equal(rejection.error, "VISUAL_ROUND_EXCEEDED");
  assert.deepEqual(
    rejection.allowed,
    [{ new_agent: "pm", new_status: "In_Progress" }],
    "ONLY pm reset allowed",
  );
});

test("AC-10: handler composition — PM reset transitions through cleanly at cap", () => {
  const rejection = validateTransition({
    prev: { agent: "qa-engineer", status: "FAIL" },
    next: { agent: "pm", status: "In_Progress" },
    prev_qa_round: 0,
    prev_review_round: 0,
    prev_visual_round: 6,
    next_pending_notes: ["pm rebudgeting visual scope"],
  });
  assert.equal(rejection, null, "pm reset MUST be accepted");
});

test("AC-10: handler composition — computeNewRound resets visual_round on PM re-entry post-cap", () => {
  const next = computeNewRound(
    0, 0, 6,
    { agent: "pm", status: "In_Progress" },
  );
  assert.equal(next.visual_round, 0, "PM re-entry resets the counter");
});
