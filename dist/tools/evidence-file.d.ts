export declare function recordReviewInFile(workspacePath: string, taskIds: string[], status: "PASS" | "FAIL", reviewer: string, notes: string): Promise<void>;
export declare function hasEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
export declare function recordCodeReviewInFile(workspacePath: string, taskIds: string[], verdict: "APPROVED" | "CHANGES_REQUESTED", reviewer: string, notes: string): Promise<void>;
export declare function hasCodeReviewEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
export declare function hasVisualBaselinesInDesign(workspacePath: string, activeFeature: string): {
    present: boolean;
    designPath: string;
};
export declare function hasVisualEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
//# sourceMappingURL=evidence-file.d.ts.map