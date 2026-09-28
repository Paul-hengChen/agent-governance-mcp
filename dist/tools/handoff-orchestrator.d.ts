import type { ToolResult, UpdateStateInput, WorkspaceOnlyInput } from "./registry.js";
import { type UpdateStateGateStep } from "../gates/pipeline.js";
export declare function handleGetState(args: WorkspaceOnlyInput): Promise<ToolResult>;
export declare function handleUpdateState(parsed: UpdateStateInput): Promise<ToolResult>;
export declare const UPDATE_STATE_GATE_PIPELINE: readonly UpdateStateGateStep[];
//# sourceMappingURL=handoff-orchestrator.d.ts.map