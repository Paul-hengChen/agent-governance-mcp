import type { ToolResult, UpdateStateInput } from "../tools/registry.js";
import type { HandoffState, HandoffStorage } from "../tools/storage.js";
import type { TransitionTuple } from "../tools/transitions.js";
import type { GateErrorCode } from "./registry.js";
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
export interface UpdateStateGateStep {
    readonly name: string;
    readonly codes: readonly GateErrorCode[];
    readonly run: (ctx: UpdateStateGateContext) => ToolResult | null | Promise<ToolResult | null>;
}
export declare function runUpdateStatePipeline(pipeline: readonly UpdateStateGateStep[], ctx: UpdateStateGateContext): Promise<ToolResult | null>;
//# sourceMappingURL=pipeline.d.ts.map