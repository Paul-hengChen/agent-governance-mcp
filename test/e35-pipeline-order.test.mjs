// Coded by @qa-engineer
// Pins the order of the checks a state write runs through: the ordered array
// UPDATE_STATE_GATE_PIPELINE (gates/pipeline.ts + tools/handoff-orchestrator.ts).
// Pins the step NAME sequence (17 steps) and each step's CODES, so a reorder, rename
// or dropped/added code fails a test; codes are cross-checked against gates/registry.ts.
// Imports from dist/ (npm test's prebuild builds it).
// Rationale: specs/e260g-comment-rationale.md (test/e35-pipeline-order.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";

const { UPDATE_STATE_GATE_PIPELINE } = await import(
  "../dist/tools/handoff-orchestrator.js"
);
const { ALL_GATE_CODES, TRANSITION_GATE_CODES } = await import(
  "../dist/gates/registry.js"
);

// The fixed 17-step sequence, copied from tools/handoff-orchestrator.ts
// (the source of truth). Order matters — this array IS the order pin. (E35)
const EXPECTED_PIPELINE = [
  { name: "TRANSITION_VALIDATION", codes: TRANSITION_GATE_CODES },
  { name: "FEATURE_LEASE", codes: ["FEATURE_LEASE_HELD", "LEASE_OVERRIDE_AUDIT_MISSING"] },
  { name: "SCOPE_DECISION_REQUIRED", codes: ["SCOPE_DECISION_REQUIRED"] },
  { name: "CUT_APPROVAL_REQUIRED", codes: ["CUT_APPROVAL_REQUIRED"] },
  { name: "EXTERNAL_REFS_UNRESOLVED", codes: ["EXTERNAL_REFS_UNRESOLVED"] },
  { name: "SOURCE_CREDIBILITY_UNVERIFIED", codes: ["SOURCE_CREDIBILITY_UNVERIFIED"] },
  { name: "REPRO_MANIFEST_MISSING", codes: ["REPRO_MANIFEST_MISSING"] },
  { name: "REVIEW_VERDICT_STATUS_MISMATCH", codes: ["REVIEW_VERDICT_STATUS_MISMATCH", "NON_REVIEWER_VERDICT_REJECTED"] },
  // Step 9 (E435, ruling (b)): one code. It rejects a non-empty completed_tasks
  // from any agent_id other than the judge (code-reviewer), qa-engineer
  // included. It replaces REVIEWER_COMPLETED_TASKS_REJECTED and
  // NON_QA_COMPLETED_TASKS_REJECTED and keeps the old step's position: after
  // REVIEW_VERDICT_STATUS_MISMATCH, before QA_REVIEW_RECORD.
  { name: "NON_JUDGE_COMPLETED_TASKS_REJECTED", codes: ["NON_JUDGE_COMPLETED_TASKS_REJECTED"] },
  { name: "QA_REVIEW_RECORD", codes: ["QA_REVIEW_TARGET_REQUIRED"] },
  { name: "QA_COMPLETION_EVIDENCE_MISSING", codes: ["QA_COMPLETION_EVIDENCE_MISSING"] },
  { name: "PASS_TASKS_INCOMPLETE", codes: ["PASS_TASKS_INCOMPLETE"] },
  { name: "PASS_MISSING_EVIDENCE", codes: ["MISSING_EVIDENCE"] },
  {
    name: "PASS_VISUAL_SUBGATES",
    codes: [
      "VISUAL_BASELINES_REQUIRED",
      "VISUAL_EVIDENCE_MISSING",
      "VISUAL_WIDGETS_UNVERIFIED",
      "VISUAL_ASSERTIONS_REQUIRED",
      "VISUAL_REPORT_INCOMPLETE",
      "VISUAL_PROVENANCE_MISSING",
      "BASELINE_MANIFEST_MISSING",
      "BASELINE_PROVENANCE_INCOMPLETE",
      "PIXEL_GATE_ATTESTATION_MISSING",
    ],
  },
  { name: "PASS_EXPECTED_RED_DIFF", codes: ["EXPECTED_RED_DIFF_MISSING"] },
  { name: "PASS_AC_EXECUTION_LOG", codes: ["AC_EXECUTION_LOG_MISSING"] },
  { name: "MISSING_REVIEW_EVIDENCE", codes: ["MISSING_REVIEW_EVIDENCE"] },
];

test("UPDATE_STATE_GATE_PIPELINE exists and has exactly 17 steps", () => {
  assert.ok(Array.isArray(UPDATE_STATE_GATE_PIPELINE), "pipeline must be an array");
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, 17);
  assert.equal(EXPECTED_PIPELINE.length, 17);
});

test("t-order-exact: step NAME sequence matches the frozen 17-step order exactly", () => {
  const actualNames = UPDATE_STATE_GATE_PIPELINE.map((s) => s.name);
  const expectedNames = EXPECTED_PIPELINE.map((s) => s.name);
  assert.deepEqual(
    actualNames,
    expectedNames,
    "gate step order/names drifted from the E35 frozen sequence — a reorder, " +
      "rename, insertion, or deletion was made without updating this pin " +
      "(and, if intentional, without updating the spec's documented order)."
  );
});

test("t-order-exact: each step's codes[] matches the frozen sequence exactly, in order", () => {
  assert.equal(UPDATE_STATE_GATE_PIPELINE.length, EXPECTED_PIPELINE.length);
  for (let i = 0; i < EXPECTED_PIPELINE.length; i++) {
    const actual = UPDATE_STATE_GATE_PIPELINE[i];
    const expected = EXPECTED_PIPELINE[i];
    assert.equal(
      actual.name,
      expected.name,
      `step ${i}: expected name "${expected.name}", got "${actual.name}"`
    );
    assert.deepEqual(
      [...actual.codes],
      [...expected.codes],
      `step ${i} ("${expected.name}"): codes[] drifted from the frozen pin`
    );
  }
});

test("t-order-exact: TRANSITION_VALIDATION.codes is the registry-exported TRANSITION_GATE_CODES (not a re-typed literal)", () => {
  const step = UPDATE_STATE_GATE_PIPELINE.find((s) => s.name === "TRANSITION_VALIDATION");
  assert.ok(step, "TRANSITION_VALIDATION step must exist");
  assert.equal(
    step.codes,
    TRANSITION_GATE_CODES,
    "TRANSITION_VALIDATION should carry the same array reference as " +
      "gates/registry.ts TRANSITION_GATE_CODES — a fork here would let the " +
      "two silently diverge."
  );
});

// E435: validateTransition emits 6 codes (QA_ROUND_EXCEEDED left with the qa
// round cap); pinned as a literal so step 1 cannot gain or lose a code unseen.
test("E435: TRANSITION_GATE_CODES is the 6 transition codes, step 9 is NON_JUDGE_COMPLETED_TASKS_REJECTED, the three removed codes are in no step", () => {
  assert.deepEqual([...TRANSITION_GATE_CODES], [
    "AGENT_ID_REQUIRED",
    "TRANSITION_REJECTED",
    "REVIEW_ROUND_EXCEEDED",
    "VISUAL_ROUND_EXCEEDED",
    "HOP_CAP_EXCEEDED",
    "SR_RETURN_CAP_EXCEEDED",
  ]);
  assert.equal(UPDATE_STATE_GATE_PIPELINE[8].name, "NON_JUDGE_COMPLETED_TASKS_REJECTED");
  const flattened = UPDATE_STATE_GATE_PIPELINE.flatMap((s) => s.codes);
  for (const gone of ["QA_ROUND_EXCEEDED", "REVIEWER_COMPLETED_TASKS_REJECTED", "NON_QA_COMPLETED_TASKS_REJECTED"]) {
    assert.ok(!flattened.includes(gone), `${gone} is removed (E435) and belongs to no step`);
  }
});

test("t-codes-registry-parity: the union of every step's codes[] equals ALL_GATE_CODES minus tool-boundary codes (registry is single source of truth)", async () => {
  const { GATE_REGISTRY } = await import("../dist/gates/registry.js");
  // E300: a "tool-boundary" producer is a zod rejection raised in tools/registry.ts BEFORE the
  // pipeline runs, so by design it has no pipeline step. Every other producer must have one.
  const toolBoundary = GATE_REGISTRY.filter((g) => g.producer === "tool-boundary").map((g) => g.errorCode);
  const expectedCodes = ALL_GATE_CODES.filter((c) => !toolBoundary.includes(c));
  const flattened = UPDATE_STATE_GATE_PIPELINE.flatMap((s) => s.codes);

  // No duplicate codes across steps — each error code belongs to exactly
  // one gate step in the pipeline.
  const asSet = new Set(flattened);
  assert.equal(
    asSet.size,
    flattened.length,
    "a gate error code appears in more than one pipeline step's codes[]"
  );

  const flattenedSorted = [...flattened].sort();
  const registrySorted = [...expectedCodes].sort();
  assert.deepEqual(
    flattenedSorted,
    registrySorted,
    "pipeline steps' codes, flattened, must equal ALL_GATE_CODES minus tool-boundary codes exactly " +
      "(no gate-registry code missing from the pipeline, and no pipeline " +
      "code absent from the registry) — a mismatch means a gate was added " +
      "to one side without the other, or a code was silently dropped."
  );
});

test("E300: DISPATCH_PIN_TIER_REJECTED is the only tool-boundary code today and appears in no pipeline step", async () => {
  const { GATE_REGISTRY } = await import("../dist/gates/registry.js");
  assert.deepEqual(
    GATE_REGISTRY.filter((g) => g.producer === "tool-boundary").map((g) => g.errorCode),
    ["DISPATCH_PIN_TIER_REJECTED"],
  );
  const flattened = UPDATE_STATE_GATE_PIPELINE.flatMap((s) => s.codes);
  assert.ok(!flattened.includes("DISPATCH_PIN_TIER_REJECTED"),
    "it fires in zod before the pipeline; listing it in a step would claim a pipeline emission that never happens");
});

test("t-codes-registry-parity: every step's codes are non-empty and every code round-trips through gate()", async () => {
  const { gate } = await import("../dist/gates/registry.js");
  for (const step of UPDATE_STATE_GATE_PIPELINE) {
    assert.ok(
      Array.isArray(step.codes) && step.codes.length > 0,
      `step "${step.name}" must declare a non-empty codes[] array`
    );
    for (const code of step.codes) {
      assert.doesNotThrow(
        () => gate(code),
        `step "${step.name}"'s code "${code}" must be a known GATE_REGISTRY entry`
      );
    }
  }
});
