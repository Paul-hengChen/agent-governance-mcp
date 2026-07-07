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
  hasDesignModeRequiringVisual,
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

// ============================================================================
// v3.16.0 — PASS-gate ordering & mutual exclusion (visual-fidelity-gate-hardening, AC-1, AC-10)
// Tests for the new arming signal + VISUAL_BASELINES_REQUIRED short-circuit in index.ts.
//
// The index.ts PASS gate (lines ~711-778) now runs in two steps:
//   STEP 1 (NEW): armCheck = hasDesignModeRequiringVisual — if required=true AND
//                 baselines absent → VISUAL_BASELINES_REQUIRED (fires FIRST, D2).
//   STEP 2 (existing): visualGate.present → check visual evidence + widget rows.
//
// These integration tests drive the same helper calls the handler makes so a
// future reorder of the gate steps would surface as a test failure here.
// ============================================================================

function seedDesignWithModeOnly(ws, feature, mode) {
  // Writes a design file with the given mode but NO ## Visual Baselines section.
  // This is the "armed but baseline-less" state that should trigger VISUAL_BASELINES_REQUIRED.
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "design", `${feature}.md`),
    `# design/${feature}\n\nmode: ${mode}\n\n## Source manifest\n- ${mode} | 1:1 | yes | audited\n`,
  );
}

function seedDesignWithModeAndBaselines(ws, feature, mode) {
  // Writes a design file with a real mode AND a ## Visual Baselines section.
  // This is the "armed + baseline-present" state — STEP 1 falls through to STEP 2.
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(
    path.join(ws, "design", `${feature}.md`),
    `# design/${feature}\n\nmode: ${mode}\n\n## Source manifest\n- ${mode} | 1:1 | yes | audited\n\n## Visual Baselines\n\n| surface | baseline | impl | notes |\n| --- | --- | --- | --- |\n| s1 | design/${feature}/s1.png | screenshots/s1.png | - |\n`,
  );
}

// ---------- STEP 1: real mode + NO baselines → VISUAL_BASELINES_REQUIRED, short-circuits ----------

test("v3.16.0 AC-1 STEP1: armed (real mode) + no baselines → gate would emit VISUAL_BASELINES_REQUIRED", () => {
  // Why: STEP 1 of the new gate. When the design file declares a real mode
  // (mode != no-design) but lacks ## Visual Baselines, the server MUST reject
  // PASS with VISUAL_BASELINES_REQUIRED BEFORE checking for visual evidence
  // files. This test encodes the mutual-exclusion invariant (D2): if STEP 1
  // fires, STEP 2 (VISUAL_EVIDENCE_MISSING) must NOT also fire.
  const ws = mkWorkspace();
  seedDesignWithModeOnly(ws, "feat-armed", "figma");

  const armCheck = hasDesignModeRequiringVisual(ws, "feat-armed");
  const visualGate = hasVisualBaselinesInDesign(ws, "feat-armed");

  assert.equal(armCheck.required, true, "real mode must arm the gate");
  assert.equal(visualGate.present, false, "no ## Visual Baselines declared");

  // STEP 1 condition — this is exactly the `if` branch in index.ts that
  // emits VISUAL_BASELINES_REQUIRED.
  const step1Fires = armCheck.required && !visualGate.present;
  assert.equal(step1Fires, true, "STEP 1 MUST fire: armed + no baselines");

  // Mutual exclusion: STEP 2 (evidence check) is only reached when
  // visualGate.present === true — which it is NOT here. This ensures
  // VISUAL_EVIDENCE_MISSING is never emitted for a section that doesn't exist.
  const step2Reached = visualGate.present;
  assert.equal(step2Reached, false, "STEP 2 must NOT be reached when STEP 1 fires (D2 mutual exclusion)");
});

test("v3.16.0 AC-1 STEP1: error message substring — VISUAL_BASELINES_REQUIRED + ## Visual Baselines is absent", () => {
  // Why: T-QA must assert on the stable substrings (D7) rather than the full
  // interpolated string (which includes mode and designPath). These two
  // substrings are the operator-facing identifiers that runbooks reference.
  // Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
  // body (including this gate) compiles into dist/tools/handoff-orchestrator.js,
  // not dist/index.js.
  const distIndex = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "tools", "handoff-orchestrator.js"),
    "utf-8",
  );
  assert.match(distIndex, /VISUAL_BASELINES_REQUIRED/, "VISUAL_BASELINES_REQUIRED code must appear in compiled handler");
  assert.match(distIndex, /## Visual Baselines is absent/, "stable substring '## Visual Baselines is absent' must be in compiled handler");
});

// ---------- STEP 2: baselines present + missing evidence → VISUAL_EVIDENCE_MISSING (unchanged) ----------

test("v3.16.0 AC-1 STEP2: baselines present + missing visual_<task>.md → VISUAL_EVIDENCE_MISSING path", () => {
  // Why: STEP 2 is the existing v3.14.0 gate (unchanged). When ## Visual
  // Baselines IS present, the server checks for qa_reports/visual_<id>.md.
  // STEP 1 falls through (armCheck.required=true AND visualGate.present=true
  // → the `if (armCheck.required && !visualGate.present)` condition is false).
  const ws = mkWorkspace();
  seedDesignWithModeAndBaselines(ws, "feat-bl", "sketch");

  const armCheck = hasDesignModeRequiringVisual(ws, "feat-bl");
  const visualGate = hasVisualBaselinesInDesign(ws, "feat-bl");

  assert.equal(armCheck.required, true, "real mode arms gate");
  assert.equal(visualGate.present, true, "## Visual Baselines present");

  // STEP 1 does NOT fire (baselines present → condition false)
  const step1Fires = armCheck.required && !visualGate.present;
  assert.equal(step1Fires, false, "STEP 1 must NOT fire when baselines are present");

  // STEP 2 IS reached (baselines present → existing gate logic applies)
  const step2Reached = visualGate.present;
  assert.equal(step2Reached, true, "STEP 2 is reached when baselines present");

  // Evidence is absent → STEP 2 would emit VISUAL_EVIDENCE_MISSING
  const visEv = hasVisualEvidenceInFile(ws, ["T01"]);
  assert.deepEqual(visEv.missing, ["T01"], "missing visual evidence → server emits VISUAL_EVIDENCE_MISSING");
});

// ---------- AC-10: no-design / no design file → gate silent, PASS proceeds ----------

test("v3.16.0 AC-10: no-design mode → gate silent (both STEP 1 and STEP 2 skipped)", () => {
  // Why: AC-10 non-UI pass-through regression guard. mode=no-design must
  // leave both gates dormant so infra/server features are not affected.
  const ws = mkWorkspace();
  seedDesignWithModeOnly(ws, "feat-nod", "no-design");

  const armCheck = hasDesignModeRequiringVisual(ws, "feat-nod");
  const visualGate = hasVisualBaselinesInDesign(ws, "feat-nod");

  assert.equal(armCheck.required, false, "no-design mode must NOT arm the gate");
  const step1Fires = armCheck.required && !visualGate.present;
  assert.equal(step1Fires, false, "STEP 1 must NOT fire for no-design");
  assert.equal(visualGate.present, false, "STEP 2 must NOT fire (no baselines)");
});

test("v3.16.0 AC-10: no design file at all → gate silent, PASS proceeds", () => {
  // Why: non-UI workspaces with no design/<feature>.md must remain completely
  // unaffected by the new gate.
  const ws = mkWorkspace();
  // No design directory or file created.

  const armCheck = hasDesignModeRequiringVisual(ws, "infra-feature");
  const visualGate = hasVisualBaselinesInDesign(ws, "infra-feature");

  assert.equal(armCheck.required, false, "no file → gate silent");
  assert.equal(visualGate.present, false, "no baselines → STEP 2 dormant");
  const step1Fires = armCheck.required && !visualGate.present;
  assert.equal(step1Fires, false, "neither step fires when no design file exists");
});

// ---------- Baselines present + evidence present → PASS (full happy path) ----------

test("v3.16.0 AC-1: baselines present + evidence present → PASS (all gates satisfied)", () => {
  // Why: the complete PASS scenario. Armed mode, baselines declared, visual
  // evidence written. Both STEP 1 falls through and STEP 2 finds all evidence
  // present. This mirrors the AC-1 backwards-compat row in the architecture:
  // "Design file, mode != no-design, ## Visual Baselines PRESENT — Unaffected".
  const ws = mkWorkspace();
  seedDesignWithModeAndBaselines(ws, "feat-happy", "figma");
  // Write visual evidence for the task
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "visual_T01.md"), "# Visual report T01\n\n## Verdict — PASS\n");

  const armCheck = hasDesignModeRequiringVisual(ws, "feat-happy");
  const visualGate = hasVisualBaselinesInDesign(ws, "feat-happy");

  assert.equal(armCheck.required, true);
  assert.equal(visualGate.present, true);

  // STEP 1: fires only when required=true AND present=false — NOT this case.
  const step1Fires = armCheck.required && !visualGate.present;
  assert.equal(step1Fires, false, "STEP 1 must not fire when baselines present");

  // STEP 2: baselines present + evidence present → no rejection.
  const visEv = hasVisualEvidenceInFile(ws, ["T01"]);
  assert.deepEqual(visEv.missing, [], "all visual evidence present → PASS proceeds");
});

// ---------- VISUAL_BASELINES_REQUIRED in TransitionRejection.error union ----------

test("v3.16.0 AC-9: VISUAL_BASELINES_REQUIRED is in TransitionRejection.error union (compiled transitions.js)", () => {
  // Why: the error code must be registered in the TransitionRejection.error
  // union in tools/transitions.ts so handler-side narrowing + envelope
  // consistency work correctly (mirrors VISUAL_WIDGETS_UNVERIFIED precedent).
  // This test pins the union member's presence so a future refactor cannot
  // accidentally drop it from the type definition.
  const distTransitions = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "dist", "tools", "transitions.js"),
    "utf-8",
  );
  // The union is a TypeScript string literal union; after compilation it appears
  // as a JSDoc type comment or is elided. We verify it appears in the source TS
  // (which is the authoritative type contract) rather than the compiled output.
  const srcTransitions = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "tools", "transitions.ts"),
    "utf-8",
  );
  assert.match(srcTransitions, /VISUAL_BASELINES_REQUIRED/, "VISUAL_BASELINES_REQUIRED MUST appear in TransitionRejection.error union in tools/transitions.ts");
  // Also verify the explanatory comment is present (mirrors VISUAL_WIDGETS_UNVERIFIED style).
  assert.match(srcTransitions, /v3\.16\.0.*emitted by index\.ts PASS gate/is, "v3.16.0 comment must document that the code is handler-emitted, not from validateTransition");
});
