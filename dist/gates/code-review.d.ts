export declare function recordCodeReviewInFile(workspacePath: string, taskIds: string[], verdict: "APPROVED" | "CHANGES_REQUESTED", reviewer: string, notes: string): Promise<void>;
export declare function hasCodeReviewEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
//# sourceMappingURL=code-review.d.ts.map