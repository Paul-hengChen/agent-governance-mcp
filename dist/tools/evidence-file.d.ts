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
export declare function hasDesignModeRequiringVisual(workspacePath: string, activeFeature: string): {
    required: boolean;
    mode: string | null;
    designPath: string;
};
export declare function hasVisualEvidenceInFile(workspacePath: string, taskIds: string[]): {
    present: string[];
    missing: string[];
};
export interface VisualWidgetRow {
    widgetId: string;
    checked: boolean;
    rawLine: string;
}
export declare function parseVisualWidgetsChecklist(visualReportContent: string): VisualWidgetRow[];
export interface UncheckedWidgetsCheck {
    ok: boolean;
    uncheckedByTaskId: Record<string, string[]>;
}
export declare function hasUncheckedWidgets(workspacePath: string, taskIds: string[]): UncheckedWidgetsCheck;
export interface VisualReportValidation {
    ok: boolean;
    missingSections: string[];
    failedCanonicalStates: string[];
    failedStructuralAssertions: string[];
    verdictPass: boolean;
}
export declare function validateVisualReport(content: string): VisualReportValidation;
export declare function designDeclaresStructuralAssertions(workspacePath: string, activeFeature: string): boolean;
export interface VisualReportsCheck {
    ok: boolean;
    byTaskId: Record<string, VisualReportValidation>;
}
export declare function validateVisualReports(workspacePath: string, taskIds: string[]): VisualReportsCheck;
//# sourceMappingURL=evidence-file.d.ts.map