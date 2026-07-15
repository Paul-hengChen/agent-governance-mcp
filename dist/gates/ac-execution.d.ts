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
//# sourceMappingURL=ac-execution.d.ts.map