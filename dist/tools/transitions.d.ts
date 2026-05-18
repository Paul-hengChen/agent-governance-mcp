export type AgentName = "pm" | "researcher" | "architect" | "sr-engineer" | "qa-engineer";
export interface AgentGateResult {
    ok: boolean;
    message?: string;
}
export declare function requireQaEngineer(agentId: string | undefined, toolName: string): AgentGateResult;
//# sourceMappingURL=transitions.d.ts.map