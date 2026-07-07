// Coded by @sr-engineer
// gate-registry (A10 + A2). The single structured source of truth for every
// gate error code the server enforces: error code, producer, envelope shape,
// trigger edge, arm condition, clearing artifact, and the STATIC portion of
// the emitted hint text (`hintStatic`), lifted byte-for-byte from the emit
// sites in tools/transitions.ts and tools/handoff-orchestrator.ts.
//
// Runtime LEAF: this module imports NOTHING at runtime (and no `import type`
// is needed either — every doc-facing field is a plain `string`, so there is
// no back-edge to tools/transitions.ts). tools/transitions.ts and
// tools/handoff-orchestrator.ts value-import `gate()` from here to source
// their hint text; the import DAG stays strictly acyclic.
//
// Byte-parity contract (spec AC-2): the emit sites interpolate the dynamic
// portion at the call site and concatenate `gate(code).hintStatic` for the
// fixed portion, so the emitted string stays byte-identical to pre-refactor
// behavior. The EXISTING gate tests assert that byte-parity; see DR-2.
//
// Evaluation order is NOT encoded here (no evalOrder field): it stays the
// physical top-to-bottom if-block sequence in tools/handoff-orchestrator.ts
// (spec AC-7, DR-5). This registry is a keyed lookup, never a dispatch loop.

export type GateErrorCode =
  | "AGENT_ID_REQUIRED"
  | "TRANSITION_REJECTED"
  | "QA_ROUND_EXCEEDED"
  | "REVIEW_ROUND_EXCEEDED"
  | "VISUAL_ROUND_EXCEEDED"
  | "SCOPE_DECISION_REQUIRED"
  | "CUT_APPROVAL_REQUIRED"
  | "MISSING_EVIDENCE"
  | "MISSING_REVIEW_EVIDENCE"
  | "VISUAL_BASELINES_REQUIRED"
  | "VISUAL_EVIDENCE_MISSING"
  | "VISUAL_WIDGETS_UNVERIFIED"
  | "VISUAL_ASSERTIONS_REQUIRED"
  | "VISUAL_REPORT_INCOMPLETE"
  | "VISUAL_PROVENANCE_MISSING"
  | "BASELINE_MANIFEST_MISSING"
  | "BASELINE_PROVENANCE_INCOMPLETE"
  | "PIXEL_GATE_ATTESTATION_MISSING";

export type GateProducer = "validateTransition" | "orchestrator";
export type GateEnvelope = "transition-json" | "orchestrator-json" | "plain-text";

export interface GateDefinition {
  readonly errorCode: GateErrorCode;
  readonly producer: GateProducer;
  readonly envelope: GateEnvelope;
  // Human-readable, doc-facing, verbatim-sourced from today's prose:
  readonly triggerEdge: string; // the prev/next agent+status pattern the gate fires on
  readonly armCondition: string; // names the predicate where one exists
  readonly clearingArtifact: string; // what satisfies the gate
  // The STATIC portion of the emitted hint, lifted byte-for-byte from the
  // current emit site (S02 verbatim rule). Dynamic interpolation stays at the
  // emit site; this is the fixed-sentence part that ALSO appears (paraphrased)
  // in constitution/skill prose and is what the generative parity check
  // (DR-3, qa-engineer's rewritten error-code-contract test) compares against.
  readonly hintStatic: string;
  // True iff the code is (and must stay) backtick-quoted in >=1 content/*.md.
  // All 18 are true today. The field exists so a future code-internal gate can
  // opt out without weakening the parity test.
  readonly documentedInProse: boolean;
}

// The 18-gate catalog, in documentation order. Array order is DOC order only —
// it MUST NOT be relied on for evaluation order (DR-5; that lives in
// handoff-orchestrator.ts as the physical if-block sequence).
export const GATE_REGISTRY: readonly GateDefinition[] = [
  // ---- transition-json (codes 1-5, producer: validateTransition) ----
  {
    errorCode: "AGENT_ID_REQUIRED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge: "next.agent null/unknown on any state write",
    armCondition: "always (validateTransition step 1)",
    clearingArtifact: "a valid agent_id",
    hintStatic: "All state writes must declare agent_id.",
    documentedInProse: true,
  },
  {
    errorCode: "TRANSITION_REJECTED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge: "no edge prev->next in ALLOWED_TRANSITIONS; unknown status",
    armCondition: "always (validateTransition step 4)",
    clearingArtifact: "a legal edge in ALLOWED_TRANSITIONS",
    hintStatic: " in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md.",
    documentedInProse: true,
  },
  {
    errorCode: "QA_ROUND_EXCEEDED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge: "prev_qa_round >= 4 and next != (pm,In_Progress)",
    armCondition: "always (validateTransition step 2)",
    clearingArtifact: "(pm, In_Progress) reset",
    hintStatic: " exceeds cap. Only (pm, In_Progress) allowed to reset.",
    documentedInProse: true,
  },
  {
    errorCode: "REVIEW_ROUND_EXCEEDED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge: "prev_review_round >= 4 and next != (pm,In_Progress)",
    armCondition: "always (validateTransition step 2)",
    clearingArtifact: "(pm, In_Progress) reset",
    hintStatic: " exceeds cap. Only (pm, In_Progress) allowed to reset.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_ROUND_EXCEEDED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge: "prev_visual_round >= 6 and next != (pm,In_Progress)",
    armCondition: "opt-in (counter present)",
    clearingArtifact: "(pm, In_Progress) rebudget",
    hintStatic: " exceeds cap. Only (pm, In_Progress) allowed for pixel/widget rebudget.",
    documentedInProse: true,
  },
  // ---- orchestrator-json (codes 6-7, producer: orchestrator) ----
  {
    errorCode: "SCOPE_DECISION_REQUIRED",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress",
    armCondition: "hasDesignModeRequiringVisual().required",
    clearingArtifact: ".current/feature-split.md OR scope_decision: single-feature",
    hintStatic:
      "Scope decision missing. Either: (a) create .current/feature-split.md documenting the " +
      "multi-feature split decision, or (b) set scope_decision: single-feature in this " +
      "tw_update_state call with a why field explaining why this feature is appropriately " +
      "scoped. Gate only fires when design/<feature>.md declares mode != no-design. " +
      "See specs/server-scope-decision-gate.md.",
    documentedInProse: true,
  },
  {
    errorCode: "CUT_APPROVAL_REQUIRED",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress (file-mode only)",
    armCondition: "unconditional; FileHandoffStorage only",
    clearingArtifact: "cut_approved: true on prev state",
    hintStatic:
      "Cut approval missing. PM must present the ticket cut inline in chat and " +
      "obtain human approval before routing to build. Set cut_approved: true on " +
      "the pm:In_Progress write after approval. See content/skill-pm.md §SOP step 7a.",
    documentedInProse: true,
  },
  // ---- plain-text (codes 8-18, producer: orchestrator) ----
  {
    errorCode: "MISSING_EVIDENCE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "status=PASS with completed_tasks",
    armCondition: "hasEvidence().missing non-empty",
    clearingArtifact: "qa_review / qa_reports/review_<id>.md",
    hintStatic:
      "Provide qa_review or write qa_reports/review_<id>.md (file mode) / insert reports row (SQLite) before PASS.",
    documentedInProse: true,
  },
  {
    errorCode: "MISSING_REVIEW_EVIDENCE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "code-reviewer:In_Progress -> qa-engineer:In_Progress with completed_tasks",
    armCondition: "hasCodeReviewEvidence().missing non-empty",
    clearingArtifact: "review_reports/review_<id>.md",
    hintStatic:
      "Code-reviewer evidence missing: write review_reports/review_<task-id>.md " +
      "before handing off to qa-engineer.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_BASELINES_REQUIRED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, ## Visual Baselines absent",
    armCondition: "armCheck.required && !visualGate.present",
    clearingArtifact: "add ## Visual Baselines to design",
    hintStatic:
      "Add the Visual Baselines section (design-auditor SOP §Artifact Schema) before retrying PASS.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_EVIDENCE_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, baselines present, visual_<id>.md absent",
    armCondition: "visualGate.present",
    clearingArtifact: "write qa_reports/visual_<id>.md",
    hintStatic: "Run Phase 1.5 (skill-qa-visual) and write the visual report before PASS.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_WIDGETS_UNVERIFIED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, unchecked ## Widget Shape Verification rows",
    armCondition: "hasUncheckedWidgets",
    clearingArtifact: "mark rows [x]",
    hintStatic:
      "Unchecked widget row(s) in qa_reports/visual_<id>.md. " +
      "Edit the visual report to mark each verified widget as [x] before retrying PASS.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_ASSERTIONS_REQUIRED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, ## Visual Structural Assertions absent from design",
    armCondition: "armCheck.required && !designDeclaresStructuralAssertions",
    clearingArtifact: "add design section",
    hintStatic:
      "The design-auditor MUST emit it (skill-design-auditor " +
      "§Artifact Schema) and PM copy it into the spec; qa-visual marks each row pass/fail. " +
      "Add the section before retrying PASS.",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_REPORT_INCOMPLETE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, report fails schema/rows/verdict",
    armCondition: "validateVisualReports.ok === false",
    clearingArtifact: "clear failing rows",
    hintStatic:
      "qa_reports/visual_<id>.md must contain Canonical State Verification, " +
      "Structural Assertions, Region Diff (per-surface pass/accepted), Allowed " +
      "Differences, and a Verdict that normalizes to exactly PASS — every row " +
      "cleared (skill-qa-visual §Report schema). Resolve the failed/unverified " +
      "rows — do NOT pre-accept them (visual verdict is qa-visual-owned, " +
      "Constitution §3.2).",
    documentedInProse: true,
  },
  {
    errorCode: "VISUAL_PROVENANCE_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, diffed surface lacks baseline:/diff-metric:",
    armCondition: "checkVisualProvenance (opt-in)",
    clearingArtifact: "add provenance lines",
    hintStatic:
      "Each diffed surface in " +
      "qa_reports/visual_<id>.md must carry a baseline: fingerprint and a " +
      "diff-metric: value in its prose sub-section under ## Region Diff. " +
      "Carry-forward surfaces (annotated \"pass (carried forward — git diff " +
      "confirms source untouched)\") are exempt; \"B1 tool unavailable — LLM " +
      "fallback\" satisfies the diff-metric requirement. " +
      "See specs/qa-visual-baseline-provenance.md.",
    documentedInProse: true,
  },
  {
    errorCode: "BASELINE_MANIFEST_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, ## Source present, 0 audited rows",
    armCondition: "checkBaselineManifest.code",
    clearingArtifact: "freeze >=1 audited node-id",
    // Fully static (no interpolation): hintStatic holds the whole emitted string
    // including the ⛔ prefix; the emit site is `gate(code).hintStatic`.
    hintStatic:
      "⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.",
    documentedInProse: true,
  },
  {
    errorCode: "BASELINE_PROVENANCE_INCOMPLETE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, >=2 audited rows, provenance section absent/incomplete",
    armCondition: "checkBaselineManifest.code",
    clearingArtifact: "add ## Baseline Selection Provenance",
    hintStatic:
      "⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.",
    documentedInProse: true,
  },
  {
    errorCode: "PIXEL_GATE_ATTESTATION_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "PASS, armed, non-carry-forward surface lacks pixel_gate_complete:true",
    armCondition: "checkPixelGateAttestation (opt-in)",
    clearingArtifact: "attest pixel_gate_complete: true per surface",
    hintStatic:
      "Each non-carry-forward " +
      "surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' " +
      "in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward " +
      "surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.",
    documentedInProse: true,
  },
];

// Precomputed O(1) lookup table. Built once at module load.
const REGISTRY_BY_CODE: Record<GateErrorCode, GateDefinition> = (() => {
  const map = {} as Record<GateErrorCode, GateDefinition>;
  for (const def of GATE_REGISTRY) {
    map[def.errorCode] = def;
  }
  return map;
})();

// O(1) lookup; throws on unknown code (fail-loud, not silent undefined).
export function gate(code: GateErrorCode): GateDefinition {
  const def = REGISTRY_BY_CODE[code];
  if (!def) {
    throw new Error(`gate(): unknown gate error code "${code}" — not in GATE_REGISTRY`);
  }
  return def;
}

// The 5 codes validateTransition's rejection() may emit. For tests + optional
// Extract<> typing of validateTransition's own return — NOT for re-typing the
// 12-member TransitionRejection["error"] union in tools/transitions.ts (see DR-8:
// that union carries 7 additional handler-side envelope-consistency codes and
// must stay byte-identical; non-drift is enforced by a test assertion
// union ⊆ ALL_GATE_CODES, not by re-sourcing from here).
export const TRANSITION_GATE_CODES: readonly GateErrorCode[] = [
  "AGENT_ID_REQUIRED",
  "TRANSITION_REJECTED",
  "QA_ROUND_EXCEEDED",
  "REVIEW_ROUND_EXCEEDED",
  "VISUAL_ROUND_EXCEEDED",
];

// Every gate error code, in catalog order. === GATE_REGISTRY.map(g => g.errorCode).
export const ALL_GATE_CODES: readonly GateErrorCode[] = GATE_REGISTRY.map((g) => g.errorCode);
