// Coded by @sr-engineer
// Gate registry: the single source of truth for every gate error code (producer,
// envelope, trigger edge, arm condition, clearing artifact) and the static part of
// each emitted hint (`hintStatic`), copied byte-for-byte from the emit sites, which
// add the dynamic part. Runtime leaf (no imports), so the import graph stays
// acyclic. Keyed lookup only: evaluation order is the UPDATE_STATE_GATE_PIPELINE
// array in tools/handoff-orchestrator.ts. Design: specs/gate-registry-architecture.md.

export type GateErrorCode =
  | "AGENT_ID_REQUIRED"
  | "TRANSITION_REJECTED"
  | "QA_ROUND_EXCEEDED"
  | "REVIEW_ROUND_EXCEEDED"
  | "VISUAL_ROUND_EXCEEDED"
  | "HOP_CAP_EXCEEDED"
  | "SCOPE_DECISION_REQUIRED"
  | "CUT_APPROVAL_REQUIRED"
  | "EXTERNAL_REFS_UNRESOLVED"
  | "SOURCE_CREDIBILITY_UNVERIFIED"
  | "FEATURE_LEASE_HELD"
  | "LEASE_OVERRIDE_AUDIT_MISSING"
  | "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE"
  | "STAMP_PROVENANCE_SUSPECT"
  | "MISSING_EVIDENCE"
  | "QA_COMPLETION_EVIDENCE_MISSING"
  | "MISSING_REVIEW_EVIDENCE"
  | "EXPECTED_RED_DIFF_MISSING"
  | "REPRO_MANIFEST_MISSING"
  | "VISUAL_BASELINES_REQUIRED"
  | "VISUAL_EVIDENCE_MISSING"
  | "VISUAL_WIDGETS_UNVERIFIED"
  | "VISUAL_ASSERTIONS_REQUIRED"
  | "VISUAL_REPORT_INCOMPLETE"
  | "VISUAL_PROVENANCE_MISSING"
  | "BASELINE_MANIFEST_MISSING"
  | "BASELINE_PROVENANCE_INCOMPLETE"
  | "PIXEL_GATE_ATTESTATION_MISSING"
  | "REVIEW_VERDICT_STATUS_MISMATCH"
  | "REVIEWER_COMPLETED_TASKS_REJECTED"
  | "NON_QA_COMPLETED_TASKS_REJECTED"
  | "QA_REVIEW_TARGET_REQUIRED"
  | "AC_EXECUTION_LOG_MISSING";

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
  // All 30 are true today. The field exists so a future code-internal gate can
  // opt out without weakening the parity test.
  readonly documentedInProse: boolean;
}

// errorCode → doc-file mapping, read by test/error-code-contract.test.mjs (specs/c12-registry-field-consumers.md AC2); rows: grep -l '`<CODE>`' content/*.md
//   AGENT_ID_REQUIRED               skill-qa-engineer.md
//   TRANSITION_REJECTED             coord-02-host-dispatch.md
//   QA_ROUND_EXCEEDED               skill-qa-engineer.md
//   REVIEW_ROUND_EXCEEDED           skill-code-reviewer.md
//   VISUAL_ROUND_EXCEEDED           skill-qa-visual.md
//   HOP_CAP_EXCEEDED                coord-01-core-head.md, coord-03-core-fallback.md
//   SCOPE_DECISION_REQUIRED         const-08-chain-31-mid.md, constitution-rationale.md, skill-pm.md
//   CUT_APPROVAL_REQUIRED           const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-coordinator-lite.md
//   EXTERNAL_REFS_UNRESOLVED        const-15-core-tail.md, coord-03-core-fallback.md, skill-pm.md
//   SOURCE_CREDIBILITY_UNVERIFIED   coord-03-core-fallback.md, skill-design-auditor.md, skill-pm.md
//   FEATURE_LEASE_HELD              const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-release-engineer.md
//   LEASE_OVERRIDE_AUDIT_MISSING    const-08-chain-31-mid.md
//   BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE  const-08-chain-31-mid.md
//   STAMP_PROVENANCE_SUSPECT        const-08-chain-31-mid.md, skill-release-engineer.md
//   MISSING_EVIDENCE                skill-qa-engineer.md
//   QA_COMPLETION_EVIDENCE_MISSING  const-08-chain-31-mid.md, skill-code-reviewer.md
//   MISSING_REVIEW_EVIDENCE         skill-code-reviewer.md, const-08-chain-31-mid.md
//   EXPECTED_RED_DIFF_MISSING       skill-qa-engineer.md
//   REPRO_MANIFEST_MISSING          skill-sr-engineer.md
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
//   REVIEWER_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md, skill-code-reviewer.md
//   NON_QA_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md
//   QA_REVIEW_TARGET_REQUIRED       skill-qa-engineer.md
//   AC_EXECUTION_LOG_MISSING        skill-qa-engineer.md

// The 33-gate catalog, in documentation order (the non-qa completed_tasks write gate, E40,
// added the 33rd, NON_QA_COMPLETED_TASKS_REJECTED — the reviewer-only completed_tasks gate
// generalized to every non-qa identity). Array order is DOC order only — it MUST NOT be relied
// on for evaluation order (DR-5; that lives in handoff-orchestrator.ts as the ordered
// UPDATE_STATE_GATE_PIPELINE array, E35).
export const GATE_REGISTRY: readonly GateDefinition[] = [
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
    triggerEdge:
      "prev_hop_count >= 10 on a role transition (next.agent != prev.agent) and next != (pm,In_Progress); feature_changed bypasses",
    armCondition: "opt-in (counter present)",
    clearingArtifact:
      "(pm, In_Progress) landing (does NOT reset hop_count) or active_feature change (resets to 0)",
    hintStatic:
      " reaches hop cap (10). Only the (pm, In_Progress) landing is allowed; " +
      "hop_count resets only on active_feature change — human must re-scope or override.",
    // DR-7 (d2-server-brake-accounting): the backtick-quoted literal in
    // skill-coordinator.md lands with T-D2-03; both must ship before the C12
    // parity test runs (T-D2-05).
    documentedInProse: true,
  },
  // ---- orchestrator-json (codes 7-10, producer: orchestrator) ----
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
  {
    errorCode: "EXTERNAL_REFS_UNRESOLVED",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress (file-mode only)",
    armCondition: "unconditional; FileHandoffStorage only; fires iff >=1 external_refs entry state==unresolved",
    clearingArtifact: "every external_refs entry fetched/indexed/user-confirmed-ignorable, or field absent/empty",
    hintStatic:
      " Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable " +
      "before routing to build. See content/skill-pm.md §Resource Audit Gate and " +
      "specs/b8-external-ref-ledger.md.",
    documentedInProse: true,
  },
  {
    // Design-source credibility gate: the fourth build-entry attestation gate. Unlike the
    // three before it, it reads design/<feature>.md via fs, so it runs in every storage
    // mode; it arms on the fetch-based modes listed in checkSourceCredibility. hintStatic
    // starts with a space: the emit site adds a dynamic prefix ending in `.`.
    // Design: specs/e4-design-source-credibility-gate-architecture.md.
    errorCode: "SOURCE_CREDIBILITY_UNVERIFIED",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress",
    armCondition: "checkSourceCredibility (fetch-based modes figma/sketch/xd/penpot only)",
    clearingArtifact:
      "every audited ## Source row carries credibility: full-page-composite, or design is non-fetch-mode / has no ## Source section / no design file",
    hintStatic:
      " Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry " +
      "credibility: full-page-composite in the ## Source manifest before routing to build. " +
      "See content/skill-design-auditor.md step 2b and specs/e4-design-source-credibility-gate.md.",
    documentedInProse: true,
  },
  {
    errorCode: "FEATURE_LEASE_HELD",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge:
      "any write whose active_feature differs from the prev state's (feature_changed) while the incumbent feature is non-terminal (status != PASS; Blocked counts as held) and fresh (last_updated within LEASE_TTL_MIN = 30 min)",
    armCondition: "isFeatureLeaseHeld(prevState, incoming active_feature, now, LEASE_TTL_MIN)",
    clearingArtifact:
      "incumbent feature reaches terminal PASS, or its lease goes stale (last_updated older than LEASE_TTL_MIN), or the new feature runs in a separate git worktree (distinct workspace_path)",
    hintStatic:
      "A second feature cannot take the workspace slot while the incumbent feature's lease is live " +
      "(per-workspace mutual exclusion: at most one non-terminal feature per workspace_path). " +
      "Wait for the incumbent to reach PASS or for its lease to expire, or run the new feature " +
      "in a separate git worktree (distinct workspace_path). " +
      "See specs/e1-feature-scoped-state-design.md.",
    documentedInProse: true,
  },
  {
    // Lease-override audit gate: fires inside the FEATURE_LEASE_HELD branch (file mode)
    // when lease_override: true lacks a /^lease-override:/ audit line in pending_notes[0].
    // An audited override bypasses the lease for this write only; an unaudited one is
    // rejected here, never downgraded to FEATURE_LEASE_HELD. Spec: specs/e10-lease-override.md.
    errorCode: "LEASE_OVERRIDE_AUDIT_MISSING",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge:
      "any write while FEATURE_LEASE_HELD would fire, carrying lease_override:true (file-mode only)",
    armCondition: "classifyLeaseOverride === unaudited; FileHandoffStorage only",
    clearingArtifact: "pending_notes[0] matching /^lease-override:/",
    hintStatic:
      "A lease_override write must carry its human-attested audit line: prepend " +
      "a \"lease-override: <reason>\" note as pending_notes[0] (gates/lease-override.ts). " +
      "See specs/e10-lease-override.md AC2.",
    documentedInProse: true,
  },
  {
    // bookkeeping_write: true is valid only on a same-active_feature write: on a new
    // feature, keeping the old last_updated would make the new lease look pre-aged.
    // Checked inline in the orchestrator from feature_changed; a fresh workspace
    // (no prevState) never trips it. Spec: specs/e10-lease-override.md (AC6).
    errorCode: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge:
      "bookkeeping_write:true whose active_feature differs from the incumbent's (file-mode only)",
    armCondition: "bookkeeping_write===true && prevState && feature_changed; FileHandoffStorage only",
    clearingArtifact: "same-active_feature write, or drop bookkeeping_write",
    hintStatic:
      "bookkeeping_write is valid only on a same-active_feature write: it preserves " +
      "the incumbent lease's last_updated, and suppressing a NEW feature's own " +
      "freshness stamp would make its lease look pre-aged (premature-clobber " +
      "footgun). Drop bookkeeping_write on feature-changing writes. " +
      "See specs/e10-lease-override.md AC6.",
    documentedInProse: true,
  },
  {
    // Stamp-provenance gate: blocks any write while the on-disk last_updated has the
    // hand-authored shape (the predicate in gates/stamp-provenance.ts, shared with the
    // read-only advisory in tools/drift.ts), unless pending_notes[0] is a remediation
    // note. Runs before the feature-lease gate, which trusts last_updated. File mode
    // only; a new workspace is never gated.
    // Rationale: specs/e260d-comment-rationale.md (gates/stamp-provenance.ts).
    errorCode: "STAMP_PROVENANCE_SUSPECT",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge:
      "any write while the on-disk handoff last_updated matches the hand-authored stamp shape (file-mode only)",
    armCondition:
      "isHandAuthoredStamp(prevState.last_updated) && !hasStampRemediationAudit; FileHandoffStorage only; prevState present",
    clearingArtifact:
      "pending_notes[0] matching /^stamp-remediation:/ on this write (self-disarms after any accepted write, which stamps a fresh server now())",
    hintStatic:
      "The on-disk handoff last_updated has the hand-authored, out-of-band stamp shape " +
      "(seconds 00, ms .000) — the server write path always stamps millisecond entropy. " +
      "Acknowledge the contamination before overwriting the evidence: prepend a " +
      "\"stamp-remediation: <how the suspect stamp was produced / verified>\" note as " +
      "pending_notes[0] (gates/stamp-provenance.ts). " +
      "See docs/backlog.md E18 incident (a).",
    documentedInProse: true,
  },
  // ---- plain-text (codes 11-25, producer: orchestrator) ----
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
    // QA completion-evidence gate: closes the identity-swap gap (another role writing
    // agent_id="qa-engineer" with pre-filled completed_tasks). A qa-engineer write that
    // adds ids to the on-disk completed set needs per-id QA evidence on disk
    // (hasEvidenceInFile from gates/qa-review.ts, covers: honored); ids already there are
    // exempt, and no edge or verdict is. Runs after the qa_review auto-record, so a PASS
    // or FAIL write's own evidence counts. File mode only.
    // Spec: specs/c16-c10-role-boundary.md (the E32 amendment).
    errorCode: "QA_COMPLETION_EVIDENCE_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "any qa-engineer-stamped write whose completed_tasks adds ids not in the on-disk completed set — no edge/status/verdict exemption (file-mode only)",
    armCondition:
      "agent_id=qa-engineer && newly-added completed ids non-empty && hasEvidenceInFile(newIds).missing non-empty; FileHandoffStorage only",
    clearingArtifact:
      "qa_reports/review_<id>.md (or a covers: file) on disk for every newly-added id — including via the qa_review auto-record on this same write",
    hintStatic:
      "A qa-engineer write adding completed_tasks ids requires per-id QA evidence " +
      "on disk (qa_reports/review_<id>.md or a covers: file) for each NEWLY added " +
      "id — no exemption for any edge, status, or review_verdict. Run the QA " +
      "review and record evidence first (attach qa_review with review_task_ids " +
      "on a PASS/FAIL write, or write the report file), or drop the unevidenced " +
      "ids from completed_tasks. If this is the code-reviewer APPROVED handoff, " +
      "carry the review scope in review_task_ids INSTEAD of completed_tasks " +
      "(c16 amendment, E32). See docs/backlog.md E18 incident (b) + E32.",
    documentedInProse: true,
  },
  {
    errorCode: "MISSING_REVIEW_EVIDENCE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "code-reviewer:In_Progress -> qa-engineer:In_Progress with review scope (review_task_ids if non-empty, else completed_tasks — c16 amendment, E32)",
    armCondition: "hasCodeReviewEvidence(reviewScopeIds).missing non-empty",
    clearingArtifact: "review_reports/review_<id>.md",
    hintStatic:
      "Code-reviewer evidence missing: write review_reports/review_<task-id>.md " +
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
    hintStatic:
      "qa_reports/expected-red_<feature>.txt is declared but no ## Expected-Red Diff " +
      "section was found in any qa_reports/review_<id>.md for the PASS'd ids " +
      "(covers: files count). Run Phase 0.5 (skill-qa-engineer) — diff the actual " +
      "suite reds against the manifest and record the disposition before PASS.",
    documentedInProse: true,
  },
  {
    // Repro-first gate for bugfix tickets: on sr-engineer:In_Progress ->
    // code-reviewer:In_Progress, when prevState.dispatch_mode is "bugfix" and no
    // qa_reports/expected-red_<feature>.txt manifest exists (hasExpectedRedManifest).
    // Plain-text family, so not in the TransitionRejection["error"] union.
    // Design: specs/e2-bugfix-repro-gate-architecture.md.
    errorCode: "REPRO_MANIFEST_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "sr-engineer:In_Progress -> code-reviewer:In_Progress (file-mode only)",
    armCondition: "prevState.dispatch_mode === bugfix; FileHandoffStorage only",
    clearingArtifact: "qa_reports/expected-red_<feature>.txt present (hasExpectedRedManifest)",
    hintStatic:
      "Bugfix-mode fix cannot hand off to code-reviewer until " +
      "qa_reports/expected-red_<feature>.txt records the failing reproduction " +
      "test(s) proven red before the fix (skill-sr-engineer). If repro is " +
      "infeasible, escalate status=Blocked to pm instead. " +
      "See specs/e2-bugfix-repro-gate.md AC2/AC6.",
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
      "cleared (skill-qa-visual §Report schema; headings may carry " +
      "prefixes/suffixes but must contain the canonical names, evidence " +
      "schema v2). Resolve the failed/unverified " +
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
  {
    errorCode: "REVIEW_VERDICT_STATUS_MISMATCH",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "code-reviewer write with review_verdict disagreeing with status",
    armCondition: "agent_id=code-reviewer && review_verdict present",
    clearingArtifact: "APPROVED↔In_Progress or CHANGES_REQUESTED↔FAIL",
    hintStatic:
      "A code-reviewer APPROVED verdict requires status=In_Progress; " +
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
    clearingArtifact:
      "omit completed_tasks (or pass []) on self-stamped code-reviewer writes; the APPROVED row stamps agent_id=qa-engineer with review scope in review_task_ids (c16 amendment, E32)",
    hintStatic:
      "completed_tasks on a code-reviewer-stamped write is ledger pollution: " +
      "the review-scope manifest travels in review_task_ids on the APPROVED " +
      "handoff (agent_id=qa-engineer) — never in completed_tasks. Omit " +
      "completed_tasks (or pass []) on this write. " +
      "See specs/c16-c10-role-boundary.md AC-3 + the E32 amendment.",
    documentedInProse: true,
  },
  {
    errorCode: "NON_QA_COMPLETED_TASKS_REJECTED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "any write whose agent_id is present, is NOT qa-engineer, and is NOT code-reviewer, carrying non-empty completed_tasks",
    armCondition: "agent_id present && agent_id !== \"qa-engineer\" && agent_id !== \"code-reviewer\" && completed_tasks.length > 0",
    clearingArtifact: "omit completed_tasks (or pass []) on any non-qa-stamped write; only agent_id=qa-engineer may grow the ledger",
    hintStatic:
      "completed_tasks on a non-qa-stamped write is ledger pollution: " +
      "only agent_id=qa-engineer may grow completed_tasks, backed by the " +
      "QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks " +
      "(or pass []) on this write. See docs/backlog.md E40.",
    documentedInProse: true,
  },
  {
    errorCode: "QA_REVIEW_TARGET_REQUIRED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "qa-engineer PASS/FAIL write carrying qa_review with review_task_ids and completed_tasks both empty",
    armCondition: "qa_review present && agent_id=qa-engineer && status in {PASS, FAIL}",
    clearingArtifact:
      "review_task_ids=[<task-id>, ...] naming the reviewed task(s) on the write (or completed_tasks on PASS)",
    // Spec Copy/Strings row (d9-qa-review-scoped-append) — byte-exact.
    hintStatic:
      "A qa_review write must name the reviewed task(s) via review_task_ids " +
      "(or completed_tasks on PASS) — it can no longer fall back to \"every " +
      "open task.\" Set review_task_ids=[<task-id>, ...] on the " +
      "tw_update_state call.",
    documentedInProse: true,
  },
  {
    // AC-execution-log gate: QA must log each spec `proof:` run. Arms when
    // specs/<feature>.md has a line-leading `proof:` (gates/ac-execution.ts); clears on
    // an `## AC Execution Log` H2 in any PASS'd id's qa_reports/review_<id>.md (covers:
    // files count). Older specs with no `proof:` lines leave it dormant. Plain-text family,
    // not a transition code. Design: specs/e3-outcome-shaped-acceptance-architecture.md.
    errorCode: "AC_EXECUTION_LOG_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "status=PASS with completed_tasks, spec has >=1 proof: AC, ## AC Execution Log absent",
    armCondition: "hasProofAnnotatedAC().armed (file-mode only)",
    clearingArtifact: "## AC Execution Log H2 in qa_reports/review_<id>.md (covers: files count)",
    hintStatic:
      "Run Phase 3.5 (skill-qa-engineer) — execute each proof:-annotated AC in " +
      "specs/<feature>.md and record command, raw output/exit code, and a per-AC " +
      "pass/fail verdict under a ## AC Execution Log section in a " +
      "qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count; " +
      "the heading may carry a prefix/suffix but must contain the canonical " +
      "name, evidence schema v2) " +
      "before PASS. The server checks the section's presence only — the proofs' " +
      "truthfulness stays with qa-engineer / code-reviewer. " +
      "See specs/e3-outcome-shaped-acceptance.md AC3/AC4.",
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

// The 6 codes validateTransition's rejection() may emit. For tests + optional
// Extract<> typing of validateTransition's own return — NOT for re-typing the
// 15-member TransitionRejection["error"] union in tools/transitions.ts (see DR-8:
// that union carries 9 additional handler-side envelope-consistency codes and
// must stay byte-identical; non-drift is enforced by a test assertion
// union ⊆ ALL_GATE_CODES, not by re-sourcing from here).
export const TRANSITION_GATE_CODES: readonly GateErrorCode[] = [
  "AGENT_ID_REQUIRED",
  "TRANSITION_REJECTED",
  "QA_ROUND_EXCEEDED",
  "REVIEW_ROUND_EXCEEDED",
  "VISUAL_ROUND_EXCEEDED",
  "HOP_CAP_EXCEEDED",
];

// Every gate error code, in catalog order. === GATE_REGISTRY.map(g => g.errorCode).
export const ALL_GATE_CODES: readonly GateErrorCode[] = GATE_REGISTRY.map((g) => g.errorCode);
