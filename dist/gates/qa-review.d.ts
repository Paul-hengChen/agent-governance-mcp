export declare function qaEvidencePath(workspacePath: string, taskId: string): string;
export declare function recordReviewInFile(workspacePath: string, taskIds: string[], status: "PASS" | "FAIL", reviewer: string, notes: string): Promise<void>;
export declare function hasEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
//# sourceMappingURL=qa-review.d.ts.map