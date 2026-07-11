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
// errorCode → doc-file mapping (T-C12-01, c12-registry-field-consumers).
// For each errorCode, the content/*.md file(s) that backtick-quote it — the
// documentedInProse anchor set. Consumed by the AC2 literal-parity assertions
// in test/error-code-contract.test.mjs (T-C12-02/03): when an entry's
// armCondition/triggerEdge carries a mechanically checkable literal, the
// files listed here are where that entry's gate prose lives. Audited
// 2026-07-10 against the live prose; regenerate with:
//   grep -l '`<CODE>`' content/*.md
//
//   AGENT_ID_REQUIRED               skill-qa-engineer.md
//   TRANSITION_REJECTED             skill-coordinator.md
//   QA_ROUND_EXCEEDED               skill-qa-engineer.md
//   REVIEW_ROUND_EXCEEDED           skill-code-reviewer.md
//   VISUAL_ROUND_EXCEEDED           skill-qa-visual.md
//   HOP_CAP_EXCEEDED                skill-coordinator.md
//   SCOPE_DECISION_REQUIRED         const-08-chain-31-mid.md, constitution-rationale.md, skill-pm.md
//   CUT_APPROVAL_REQUIRED           const-08-chain-31-mid.md, skill-coordinator.md, skill-coordinator-lite.md
//   EXTERNAL_REFS_UNRESOLVED        const-15-core-tail.md, skill-coordinator.md, skill-pm.md
//   MISSING_EVIDENCE                skill-qa-engineer.md
//   MISSING_REVIEW_EVIDENCE         skill-code-reviewer.md
//   EXPECTED_RED_DIFF_MISSING       skill-qa-engineer.md
//   VISUAL_BASELINES_REQUIRED       const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-design-auditor.md
//   VISUAL_EVIDENCE_MISSING         const-07-design-chain-gates.md, skill-qa-engineer.md, skill-qa-visual.md
//   VISUAL_WIDGETS_UNVERIFIED       skill-qa-visual.md
//   VISUAL_ASSERTIONS_REQUIRED      const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md
//   VISUAL_REPORT_INCOMPLETE        const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-qa-visual.md
//   VISUAL_PROVENANCE_MISSING       skill-qa-visual.md
//   BASELINE_MANIFEST_MISSING       const-07-design-chain-gates.md, skill-design-auditor.md, skill-qa-visual.md
//   BASELINE_PROVENANCE_INCOMPLETE  const-07-design-chain-gates.md, skill-design-auditor.md, skill-qa-visual.md
//   PIXEL_GATE_ATTESTATION_MISSING  skill-qa-visual.md
//   REVIEW_VERDICT_STATUS_MISMATCH  const-05-core-standards.md, const-08-chain-31-mid.md, skill-code-reviewer.md
//   REVIEWER_COMPLETED_TASKS_REJECTED  skill-code-reviewer.md
//   QA_REVIEW_TARGET_REQUIRED       skill-qa-engineer.md
// The 24-gate catalog, in documentation order. Array order is DOC order only —
// it MUST NOT be relied on for evaluation order (DR-5; that lives in
// handoff-orchestrator.ts as the physical if-block sequence).
export const GATE_REGISTRY = [
    // ---- transition-json (codes 1-6, producer: validateTransition) ----
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
    {
        errorCode: "HOP_CAP_EXCEEDED",
        producer: "validateTransition",
        envelope: "transition-json",
        triggerEdge: "prev_hop_count >= 10 on a role transition (next.agent != prev.agent) and next != (pm,In_Progress); feature_changed bypasses",
        armCondition: "opt-in (counter present)",
        clearingArtifact: "(pm, In_Progress) landing (does NOT reset hop_count) or active_feature change (resets to 0)",
        hintStatic: " reaches hop cap (10). Only the (pm, In_Progress) landing is allowed; " +
            "hop_count resets only on active_feature change — human must re-scope or override.",
        // DR-7 (d2-server-brake-accounting): the backtick-quoted literal in
        // skill-coordinator.md lands with T-D2-03; both must ship before the C12
        // parity test runs (T-D2-05).
        documentedInProse: true,
    },
    // ---- orchestrator-json (codes 7-9, producer: orchestrator) ----
    {
        errorCode: "SCOPE_DECISION_REQUIRED",
        producer: "orchestrator",
        envelope: "orchestrator-json",
        triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress",
        armCondition: "hasDesignModeRequiringVisual().required",
        clearingArtifact: ".current/feature-split.md OR scope_decision: single-feature",
        hintStatic: "Scope decision missing. Either: (a) create .current/feature-split.md documenting the " +
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
        hintStatic: "Cut approval missing. PM must present the ticket cut inline in chat and " +
            "obtain human approval before routing to build. Set cut_approved: true on " +
            "the pm:In_Progress write after approval. See content/skill-pm.md §SOP step 7a.",
        documentedInProse: true,
    },
    {
        errorCode: "EXTERNAL_REFS_UNRESOLVED",
        producer: "orchestrator",
        envelope: "orchestrator-json",
        triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress (file-mode only)",
        armCondition: "unconditional; FileHandoffStorage only; fires iff >=1 external_refs entry state==unresolved",
        clearingArtifact: "every external_refs entry fetched/indexed/user-confirmed-ignorable, or field absent/empty",
        hintStatic: " Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable " +
            "before routing to build. See content/skill-pm.md §Resource Audit Gate and " +
            "specs/b8-external-ref-ledger.md.",
        documentedInProse: true,
    },
    // ---- plain-text (codes 10-23, producer: orchestrator) ----
    {
        errorCode: "MISSING_EVIDENCE",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "status=PASS with completed_tasks",
        armCondition: "hasEvidence().missing non-empty",
        clearingArtifact: "qa_review / qa_reports/review_<id>.md",
        hintStatic: "Provide qa_review or write qa_reports/review_<id>.md (file mode) / insert reports row (SQLite) before PASS.",
        documentedInProse: true,
    },
    {
        errorCode: "MISSING_REVIEW_EVIDENCE",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "code-reviewer:In_Progress -> qa-engineer:In_Progress with completed_tasks",
        armCondition: "hasCodeReviewEvidence().missing non-empty",
        clearingArtifact: "review_reports/review_<id>.md",
        hintStatic: "Code-reviewer evidence missing: write review_reports/review_<task-id>.md " +
            "before handing off to qa-engineer.",
        documentedInProse: true,
    },
    {
        errorCode: "EXPECTED_RED_DIFF_MISSING",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "status=PASS with completed_tasks, manifest present, ## Expected-Red Diff absent",
        armCondition: "hasExpectedRedManifest().present (file-mode only)",
        clearingArtifact: "## Expected-Red Diff H2 in qa_reports/review_<id>.md (covers: files count)",
        hintStatic: "qa_reports/expected-red_<feature>.txt is declared but no ## Expected-Red Diff " +
            "section was found in any qa_reports/review_<id>.md for the PASS'd ids " +
            "(covers: files count). Run Phase 0.5 (skill-qa-engineer) — diff the actual " +
            "suite reds against the manifest and record the disposition before PASS.",
        documentedInProse: true,
    },
    {
        errorCode: "VISUAL_BASELINES_REQUIRED",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "PASS, armed, ## Visual Baselines absent",
        armCondition: "armCheck.required && !visualGate.present",
        clearingArtifact: "add ## Visual Baselines to design",
        hintStatic: "Add the Visual Baselines section (design-auditor SOP §Artifact Schema) before retrying PASS.",
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
        hintStatic: "Unchecked widget row(s) in qa_reports/visual_<id>.md. " +
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
        hintStatic: "The design-auditor MUST emit it (skill-design-auditor " +
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
        hintStatic: "qa_reports/visual_<id>.md must contain Canonical State Verification, " +
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
        hintStatic: "Each diffed surface in " +
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
        hintStatic: "⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.",
        documentedInProse: true,
    },
    {
        errorCode: "BASELINE_PROVENANCE_INCOMPLETE",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "PASS, armed, >=2 audited rows, provenance section absent/incomplete",
        armCondition: "checkBaselineManifest.code",
        clearingArtifact: "add ## Baseline Selection Provenance",
        hintStatic: "⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.",
        documentedInProse: true,
    },
    {
        errorCode: "PIXEL_GATE_ATTESTATION_MISSING",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "PASS, armed, non-carry-forward surface lacks pixel_gate_complete:true",
        armCondition: "checkPixelGateAttestation (opt-in)",
        clearingArtifact: "attest pixel_gate_complete: true per surface",
        hintStatic: "Each non-carry-forward " +
            "surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' " +
            "in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward " +
            "surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.",
        documentedInProse: true,
    },
    {
        errorCode: "REVIEW_VERDICT_STATUS_MISMATCH",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "code-reviewer write with review_verdict disagreeing with status",
        armCondition: "agent_id=code-reviewer && review_verdict present",
        clearingArtifact: "APPROVED↔In_Progress or CHANGES_REQUESTED↔FAIL",
        hintStatic: "A code-reviewer APPROVED verdict requires status=In_Progress; " +
            "CHANGES_REQUESTED requires status=FAIL. Align review_verdict with status, " +
            "or omit review_verdict. See specs/c9-protocol-fields.md AC-5.",
        documentedInProse: true,
    },
    {
        errorCode: "REVIEWER_COMPLETED_TASKS_REJECTED",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "any code-reviewer-stamped write carrying non-empty completed_tasks",
        armCondition: "agent_id=code-reviewer && completed_tasks.length > 0",
        clearingArtifact: "omit completed_tasks (or pass []) on self-stamped code-reviewer writes; the APPROVED row stamps agent_id=qa-engineer and is untouched",
        hintStatic: "completed_tasks on a code-reviewer-stamped write is ledger pollution: " +
            "the review-scope manifest is legal only on the APPROVED handoff " +
            "(agent_id=qa-engineer). Omit completed_tasks (or pass []) on this write. " +
            "See specs/c16-c10-role-boundary.md AC-3.",
        documentedInProse: true,
    },
    {
        errorCode: "QA_REVIEW_TARGET_REQUIRED",
        producer: "orchestrator",
        envelope: "plain-text",
        triggerEdge: "qa-engineer PASS/FAIL write carrying qa_review with review_task_ids and completed_tasks both empty",
        armCondition: "qa_review present && agent_id=qa-engineer && status in {PASS, FAIL}",
        clearingArtifact: "review_task_ids=[<task-id>, ...] naming the reviewed task(s) on the write (or completed_tasks on PASS)",
        // Spec Copy/Strings row (d9-qa-review-scoped-append) — byte-exact.
        hintStatic: "A qa_review write must name the reviewed task(s) via review_task_ids " +
            "(or completed_tasks on PASS) — it can no longer fall back to \"every " +
            "open task.\" Set review_task_ids=[<task-id>, ...] on the " +
            "tw_update_state call.",
        documentedInProse: true,
    },
];
// Precomputed O(1) lookup table. Built once at module load.
const REGISTRY_BY_CODE = (() => {
    const map = {};
    for (const def of GATE_REGISTRY) {
        map[def.errorCode] = def;
    }
    return map;
})();
// O(1) lookup; throws on unknown code (fail-loud, not silent undefined).
export function gate(code) {
    const def = REGISTRY_BY_CODE[code];
    if (!def) {
        throw new Error(`gate(): unknown gate error code "${code}" — not in GATE_REGISTRY`);
    }
    return def;
}
// The 6 codes validateTransition's rejection() may emit. For tests + optional
// Extract<> typing of validateTransition's own return — NOT for re-typing the
// 14-member TransitionRejection["error"] union in tools/transitions.ts (see DR-8:
// that union carries 8 additional handler-side envelope-consistency codes and
// must stay byte-identical; non-drift is enforced by a test assertion
// union ⊆ ALL_GATE_CODES, not by re-sourcing from here).
export const TRANSITION_GATE_CODES = [
    "AGENT_ID_REQUIRED",
    "TRANSITION_REJECTED",
    "QA_ROUND_EXCEEDED",
    "REVIEW_ROUND_EXCEEDED",
    "VISUAL_ROUND_EXCEEDED",
    "HOP_CAP_EXCEEDED",
];
// Every gate error code, in catalog order. === GATE_REGISTRY.map(g => g.errorCode).
export const ALL_GATE_CODES = GATE_REGISTRY.map((g) => g.errorCode);
//# sourceMappingURL=registry.js.map