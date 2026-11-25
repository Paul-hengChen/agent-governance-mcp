export interface AcArmResult {
    armed: boolean;
    specPath: string;
}
export interface AcDispositionResult {
    present: boolean;
    checkedPaths: string[];
}
export declare function specFilePath(workspacePath: string, activeFeature: string): string;
export declare function hasProofAnnotatedAC(workspacePath: string, activeFeature: string): AcArmResult;
export declare function hasAcExecutionLogDisposition(workspacePath: string, taskIds: string[], evidenceSchema?: number): AcDispositionResult;
export declare const AC_TICKET_HINT: string;
export interface AcceptanceEntry {
    id: string;
    pass: boolean;
}
export type TicketAcceptanceProblem = {
    kind: "many";
} | {
    kind: "missing-file";
} | {
    kind: "parse";
    count: number;
    first: string;
};
export interface TicketAcceptanceResult {
    armed: boolean;
    specPath: string;
    ticketPaths: string[];
    problem: TicketAcceptanceProblem | null;
    missingIds: string[];
    notPassedIds: string[];
    manualIds: string[];
    checkedPaths: string[];
    rejected: boolean;
}
export declare function findTicketCitations(workspacePath: string, specContent: string): string[];
export declare function sliceLastAcExecutionLog(content: string, evidenceSchema?: number): string | null;
export declare function parseAcceptanceRecord(section: string, scenarioIds: readonly string[]): AcceptanceEntry[];
export declare function evaluateTicketAcceptance(workspacePath: string, activeFeature: string, taskIds: string[], evidenceSchema?: number): TicketAcceptanceResult;
export declare function renderTicketAcceptanceRejection(result: TicketAcceptanceResult, evidenceSchemaLabel: string): string;
//# sourceMappingURL=ac-execution.d.ts.map