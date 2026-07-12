export type GateErrorCode = "AGENT_ID_REQUIRED" | "TRANSITION_REJECTED" | "QA_ROUND_EXCEEDED" | "REVIEW_ROUND_EXCEEDED" | "VISUAL_ROUND_EXCEEDED" | "HOP_CAP_EXCEEDED" | "SCOPE_DECISION_REQUIRED" | "CUT_APPROVAL_REQUIRED" | "EXTERNAL_REFS_UNRESOLVED" | "SOURCE_CREDIBILITY_UNVERIFIED" | "FEATURE_LEASE_HELD" | "MISSING_EVIDENCE" | "MISSING_REVIEW_EVIDENCE" | "EXPECTED_RED_DIFF_MISSING" | "REPRO_MANIFEST_MISSING" | "VISUAL_BASELINES_REQUIRED" | "VISUAL_EVIDENCE_MISSING" | "VISUAL_WIDGETS_UNVERIFIED" | "VISUAL_ASSERTIONS_REQUIRED" | "VISUAL_REPORT_INCOMPLETE" | "VISUAL_PROVENANCE_MISSING" | "BASELINE_MANIFEST_MISSING" | "BASELINE_PROVENANCE_INCOMPLETE" | "PIXEL_GATE_ATTESTATION_MISSING" | "REVIEW_VERDICT_STATUS_MISMATCH" | "REVIEWER_COMPLETED_TASKS_REJECTED" | "QA_REVIEW_TARGET_REQUIRED" | "AC_EXECUTION_LOG_MISSING";
export type GateProducer = "validateTransition" | "orchestrator";
export type GateEnvelope = "transition-json" | "orchestrator-json" | "plain-text";
export interface GateDefinition {
    readonly errorCode: GateErrorCode;
    readonly producer: GateProducer;
    readonly envelope: GateEnvelope;
    readonly triggerEdge: string;
    readonly armCondition: string;
    readonly clearingArtifact: string;
    readonly hintStatic: string;
    readonly documentedInProse: boolean;
}
export declare const GATE_REGISTRY: readonly GateDefinition[];
export declare function gate(code: GateErrorCode): GateDefinition;
export declare const TRANSITION_GATE_CODES: readonly GateErrorCode[];
export declare const ALL_GATE_CODES: readonly GateErrorCode[];
//# sourceMappingURL=registry.d.ts.map