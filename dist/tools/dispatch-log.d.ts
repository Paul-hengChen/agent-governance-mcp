import type { DispatchMechanism } from "./handoff-types.js";
export interface DispatchRecord {
    ts: string;
    feature: string | null;
    agent_id: string | null;
    dispatch_mechanism: DispatchMechanism;
    dispatch_mechanism_tier: string | null;
}
export interface DispatchRecordInput {
    feature: string | null | undefined;
    agent_id: string | null | undefined;
    dispatch_mechanism: DispatchMechanism;
    dispatch_mechanism_tier: string | null | undefined;
}
export declare function dispatchLogPath(workspacePath: string): string;
export declare function appendDispatchRecord(workspacePath: string, input: DispatchRecordInput): void;
//# sourceMappingURL=dispatch-log.d.ts.map