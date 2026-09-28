export interface TelemetryEvent {
    ts: string;
    gate: string;
    error_code: string;
    agent_id: string | null;
    feature: string | null;
}
export declare function extractGateCodeFromText(text: string): string | null;
export declare function emitGateTelemetry(workspacePath: string, errorCode: string, agentId: string | null | undefined, feature: string | null | undefined): void;
//# sourceMappingURL=telemetry.d.ts.map