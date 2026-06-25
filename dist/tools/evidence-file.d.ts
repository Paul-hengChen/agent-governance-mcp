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
export declare function hasScopeDecision(workspacePath: string, handoffState: {
    scope_decision?: string;
} | null | undefined): boolean;
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
    failedRegionDiffs: string[];
    verdictPass: boolean;
}
export declare function validateVisualReport(content: string): VisualReportValidation;
export declare function designDeclaresStructuralAssertions(workspacePath: string, activeFeature: string): boolean;
export interface VisualReportsCheck {
    ok: boolean;
    byTaskId: Record<string, VisualReportValidation>;
}
export declare function validateVisualReports(workspacePath: string, taskIds: string[]): VisualReportsCheck;
export interface VisualProvenanceRow {
    surfaceId: string;
    fingerprint: string | null;
    diffMetric: string | null;
    isCarryForward: boolean;
    isFallback: boolean;
    pixelGateComplete: boolean;
}
export interface VisualProvenanceCheck {
    ok: boolean;
    offendingByTaskId: Record<string, string[]>;
}
export declare function isPlaceholderDiffMetric(value: string | null): boolean;
export declare function parsePixelGateAttestation(body: string): boolean;
export declare function parseVisualProvenanceRows(content: string): VisualProvenanceRow[];
export declare function checkVisualProvenance(workspacePath: string, taskIds: string[]): VisualProvenanceCheck;
export interface PixelGateAttestationCheck {
    ok: boolean;
    offendingByTaskId: Record<string, string[]>;
}
export declare function checkPixelGateAttestation(workspacePath: string, taskIds: string[]): PixelGateAttestationCheck;
export interface BaselineManifestRow {
    medium: string;
    pointer: string;
    status: string;
    isAudited: boolean;
    rawLine: string;
}
export interface BaselineManifestCheck {
    ok: boolean;
    code: null | "BASELINE_MANIFEST_MISSING" | "BASELINE_PROVENANCE_INCOMPLETE";
    detail: string;
    designPath: string;
    auditedCount: number;
}
export declare function parseBaselineManifestRows(content: string): BaselineManifestRow[];
export declare function hasBaselineProvenance(content: string): boolean;
export declare function checkBaselineManifest(workspacePath: string, activeFeature: string): BaselineManifestCheck;
//# sourceMappingURL=evidence-file.d.ts.map