// Coded by @sr-engineer
// E35 (e35-gate-pipeline-extraction) — gate-step pipeline contract for the
// tw_update_state orchestrator. Extends the A10 registry pattern (gates/
// registry.ts: gate METADATA as data) with the E35 half: gate ORDER as data.
//
// The ordered UPDATE_STATE_GATE_PIPELINE array itself lives in
// tools/handoff-orchestrator.ts — deliberately NOT here — because the
// per-gate emit bodies are byte-verbatim relocations of the pre-E35 inline
// blocks, and the source-pin suites assert their literals (error codes, arm
// predicate names, envelope keys, even guard indentation) against THAT file:
// test/error-code-contract.test.mjs (orchestrator-producer codes + AC2
// predicate names), test/ac-execution.test.mjs I5b, and
// test/gates-expected-red.test.mjs (compound/single-line guard shapes).
// This module is the shared, dependency-light contract: the ctx shape the
// orchestrator derives once per write, the step shape, and the
// first-rejection-wins runner.
//
// Runtime near-leaf: every import below is `import type` (erased at compile
// time) and runUpdateStatePipeline itself needs none of them at runtime, so
// the import DAG stays strictly acyclic — tools/registry.ts →
// tools/handoff-orchestrator.ts → gates/pipeline.ts, with only erased
// type-only back-edges.

import type { ToolResult, UpdateStateInput } from "../tools/registry.js";
import type { HandoffState, HandoffStorage } from "../tools/storage.js";
import type { TransitionTuple } from "../tools/transitions.js";
import type { GateErrorCode } from "./registry.js";

// The per-write context every gate step reads. Derivation happens ONCE, in
// handleUpdateStateCore's ctx-building phase (prev-state parse, round/hop
// inputs, feature_changed, evidence-schema pin resolution) — a gate step
// NEVER derives values that later steps or the final write depend on (E35
// hard constraint: derivation belongs in the ctx-building phase, not inside
// gate entries). Purely-gate-local derivations (e.g. the feature-lease
// gate's leaseFields projection, the code-reviewer evidence gate's
// reviewScopeIds resolution) stay inside their step, byte-verbatim.
export interface UpdateStateGateContext {
  readonly parsed: UpdateStateInput;
  readonly storage: HandoffStorage;
  readonly prevState: HandoffState | null;
  readonly prevTuple: TransitionTuple;
  readonly nextTuple: TransitionTuple;
  readonly prev_qa_round: number;
  readonly prev_review_round: number;
  readonly prev_visual_round: number;
  readonly prev_hop_count: number;
  readonly feature_changed: boolean;
  readonly evidenceSchemaPin: number | undefined;
  readonly evidenceSchemaLabel: string;
}

// One ordered entry in the pipeline. `run` returns the rejection ToolResult
// (byte-identical envelope to the pre-E35 inline emit site) or null to fall
// through to the next step. Steps are side-effect-free EXCEPT where the
// pre-E35 flow already had an effect at the same point in the sequence (the
// qa_review auto-record's storage.recordReview), which is preserved
// in-step, in-order.
export interface UpdateStateGateStep {
  readonly name: string;
  // Every GateErrorCode this step may emit. Doc/data companion to the A10
  // registry: the qa-owned order-pin test asserts the pipeline's name +
  // codes sequence instead of a frozen-additive comment.
  readonly codes: readonly GateErrorCode[];
  readonly run: (
    ctx: UpdateStateGateContext,
  ) => ToolResult | null | Promise<ToolResult | null>;
}

// First-rejection-wins runner: execute steps in array order, return the
// first non-null rejection unchanged, else null (all gates passed). The
// check order IS the array order — no reorder, no merge, no early-return
// removal (frozen-additive, now asserted as data).
export async function runUpdateStatePipeline(
  pipeline: readonly UpdateStateGateStep[],
  ctx: UpdateStateGateContext,
): Promise<ToolResult | null> {
  for (const step of pipeline) {
    const rejection = await step.run(ctx);
    if (rejection) {
      return rejection;
    }
  }
  return null;
}
