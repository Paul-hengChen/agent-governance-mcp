// Coded by @sr-engineer
// Gate-step pipeline contract for tw_update_state: the per-write context, the step
// shape, and the first-rejection-wins runner. Gate order is data, but the ordered
// UPDATE_STATE_GATE_PIPELINE array lives in tools/handoff-orchestrator.ts, where
// source-pin tests assert its literals. Every import here is `import type`, so the
// runtime import graph stays acyclic.
// Rationale: specs/e260d-comment-rationale.md (gates/pipeline.ts).

import type { ToolResult, UpdateStateInput } from "../tools/registry.js";
import type { HandoffState, HandoffStorage } from "../tools/storage.js";
import type { TransitionTuple } from "../tools/transitions.js";
import type { GateErrorCode } from "./registry.js";

// The per-write context every gate step reads, derived once before the pipeline
// runs. A step never derives a value that later steps or the final write depend
// on; gate-local derivations (such as the feature-lease field projection) stay
// inside their step.
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
// (byte-identical envelope to the former inline emit site) or null to fall
// through to the next step. Steps are side-effect-free EXCEPT where the
// pre-pipeline flow already had an effect at the same point in the sequence
// (the qa_review auto-record's storage.recordReview), which is preserved
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
