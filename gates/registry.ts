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
  | "REVIEW_ROUND_EXCEEDED"
  | "VISUAL_ROUND_EXCEEDED"
  | "HOP_CAP_EXCEEDED"
  | "SR_RETURN_CAP_EXCEEDED"
  | "SCOPE_DECISION_REQUIRED"
  | "CUT_APPROVAL_REQUIRED"
  | "EXTERNAL_REFS_UNRESOLVED"
  | "SOURCE_CREDIBILITY_UNVERIFIED"
  | "FEATURE_LEASE_HELD"
  | "LEASE_OVERRIDE_AUDIT_MISSING"
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
  | "NON_JUDGE_COMPLETED_TASKS_REJECTED"
  | "NON_REVIEWER_VERDICT_REJECTED"
  | "QA_REVIEW_TARGET_REQUIRED"
  | "AC_EXECUTION_LOG_MISSING"
  | "PASS_TASKS_INCOMPLETE"
  | "DISPATCH_PIN_TIER_REJECTED";

// "tool-boundary": a zod rejection raised by tools/registry.ts before the
// UPDATE_STATE_GATE_PIPELINE runs (E300). No handler sees it, so defineTool.run
// in tools/registry.ts emits the telemetry line itself when a zod issue message
// starts with a registered code (E303); telemetry and gate-stats then carry the
// producer verbatim, so the fire is counted like any other gate.
export type GateProducer = "validateTransition" | "orchestrator" | "tool-boundary";
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
  // Every entry is true except VISUAL_ROUND_EXCEEDED: nothing emits it since E435: its counter
  // ticks only on a qa-engineer FAIL; E420 owns the visual family (no served rule quotes it since E434). SR_RETURN_CAP_EXCEEDED, E431, DISPATCH_PIN_TIER_REJECTED,
  // E300, and NON_REVIEWER_VERDICT_REJECTED, E139, each shipped false until a content/*.md
  // sentence quoted it — E433 in the qa-engineer and sr-engineer SOPs, E295 in coord-02, E365 in
  // const-08. The field exists so a code-internal gate can opt out without weakening the parity test.
  readonly documentedInProse: boolean;
}

// errorCode → doc-file mapping, read by test/error-code-contract.test.mjs (specs/c12-registry-field-consumers.md AC2); rows: grep -l '`<CODE>`' content/*.md
//   AGENT_ID_REQUIRED               skill-qa-engineer.md
//   TRANSITION_REJECTED             coord-02-host-dispatch.md, skill-qa-engineer.md
//   REVIEW_ROUND_EXCEEDED           skill-code-reviewer.md
//   VISUAL_ROUND_EXCEEDED           (none)
//   HOP_CAP_EXCEEDED                coord-01-core-head.md, coord-03-core-fallback.md
//   SR_RETURN_CAP_EXCEEDED          skill-qa-engineer.md, skill-sr-engineer.md
//   SCOPE_DECISION_REQUIRED         const-08-chain-31-mid.md, constitution-rationale.md, skill-pm.md
//   CUT_APPROVAL_REQUIRED           const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-coordinator-lite.md
//   EXTERNAL_REFS_UNRESOLVED        const-15-core-tail.md, coord-03-core-fallback.md, skill-pm.md
//   SOURCE_CREDIBILITY_UNVERIFIED   coord-03-core-fallback.md, skill-design-auditor.md, skill-pm.md
//   FEATURE_LEASE_HELD              const-08-chain-31-mid.md, coord-03-core-fallback.md, skill-release-engineer.md
//   LEASE_OVERRIDE_AUDIT_MISSING    const-08-chain-31-mid.md
//   MISSING_EVIDENCE                skill-code-reviewer.md
//   QA_COMPLETION_EVIDENCE_MISSING  const-08-chain-31-mid.md, skill-code-reviewer.md
//   MISSING_REVIEW_EVIDENCE         skill-code-reviewer.md
//   EXPECTED_RED_DIFF_MISSING       skill-code-reviewer.md
//   REPRO_MANIFEST_MISSING          skill-qa-engineer.md, skill-sr-engineer.md
//   VISUAL_BASELINES_REQUIRED       const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-design-auditor.md
//   VISUAL_EVIDENCE_MISSING         const-07-design-chain-gates.md, skill-reviewer-visual.md
//   VISUAL_WIDGETS_UNVERIFIED       skill-reviewer-visual.md
//   VISUAL_ASSERTIONS_REQUIRED      const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md
//   VISUAL_REPORT_INCOMPLETE        const-07-design-chain-gates.md, const-13-design-chain-s4.md, constitution-rationale.md, skill-reviewer-visual.md
//   VISUAL_PROVENANCE_MISSING       skill-reviewer-visual.md
//   BASELINE_MANIFEST_MISSING       const-07-design-chain-gates.md, skill-design-auditor.md, skill-reviewer-visual.md
//   BASELINE_PROVENANCE_INCOMPLETE  const-07-design-chain-gates.md, skill-design-auditor.md, skill-reviewer-visual.md
//   PIXEL_GATE_ATTESTATION_MISSING  skill-reviewer-visual.md
//   REVIEW_VERDICT_STATUS_MISMATCH  const-05-core-standards.md, const-08-chain-31-mid.md, skill-code-reviewer.md
//   NON_JUDGE_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md
//   NON_REVIEWER_VERDICT_REJECTED   const-08-chain-31-mid.md
//   QA_REVIEW_TARGET_REQUIRED       skill-code-reviewer.md
//   AC_EXECUTION_LOG_MISSING        skill-code-reviewer.md
//   PASS_TASKS_INCOMPLETE           skill-code-reviewer.md
//   DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md

// The 33-gate catalog, in documentation order, grouped by envelope; the one
// tool-boundary entry (DISPATCH_PIN_TIER_REJECTED, raised by zod before the
// pipeline) stays last. Array order is DOC order only — it MUST NOT be relied
// on for evaluation order (DR-5; that lives in handoff-orchestrator.ts as the
// ordered UPDATE_STATE_GATE_PIPELINE array, E35).
export const GATE_REGISTRY: readonly GateDefinition[] = [
  // ---- transition-json (codes 1-6) — producer: validateTransition ----
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
    documentedInProse: false,
  },
  {
    errorCode: "HOP_CAP_EXCEEDED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge:
      "prev_hop_count >= 14 on a role transition (next.agent != prev.agent); the (pm,In_Progress) landing is accepted unconditionally (E295, E41); feature_changed bypasses",
    armCondition: "opt-in (counter present)",
    clearingArtifact:
      "(pm, In_Progress) landing (does NOT reset hop_count) or active_feature change (resets to 0)",
    hintStatic:
      " reaches hop cap (14). Only the (pm, In_Progress) landing is allowed; " +
      "hop_count resets only on active_feature change — human must re-scope or override.",
    // DR-7 (d2-server-brake-accounting): the backtick-quoted literal in
    // skill-coordinator.md lands with T-D2-03; both must ship before the C12
    // parity test runs (T-D2-05).
    documentedInProse: true,
  },
  {
    // E431 — sr-engineer's third return of the feature to qa-engineer
    // (every file-mode feature since E435). Edge-specific (validateTransition step 2.6);
    // every other write on the feature is evaluated normally.
    errorCode: "SR_RETURN_CAP_EXCEEDED",
    producer: "validateTransition",
    envelope: "transition-json",
    triggerEdge:
      "prev_sr_return_count >= 2 on sr-engineer:In_Progress -> qa-engineer:In_Progress (file mode; SQLite never persists the counter); feature_changed bypasses",
    armCondition: "opt-in (counter present)",
    clearingArtifact: "(pm, In_Progress) reset (sr_return_count -> 0) or active_feature change",
    hintStatic:
      " — sr-engineer has returned this feature to qa-engineer the maximum 2 times. " +
      "Route to pm (pm:In_Progress) for a human ruling on the scenario.",
    // Quoted in the qa-engineer and sr-engineer SOPs since E433.
    documentedInProse: true,
  },
  // ---- orchestrator-json (codes 7-12) — producer: orchestrator ----
  {
    errorCode: "SCOPE_DECISION_REQUIRED",
    producer: "orchestrator",
    envelope: "orchestrator-json",
    triggerEdge: "pm:In_Progress -> {architect,qa-engineer}:In_Progress",
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
    triggerEdge: "pm:In_Progress -> {architect,qa-engineer}:In_Progress (file-mode only)",
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
    triggerEdge: "pm:In_Progress -> {architect,qa-engineer}:In_Progress (file-mode only)",
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
    triggerEdge: "pm:In_Progress -> {architect,qa-engineer}:In_Progress",
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
  // ---- plain-text (codes 13-32) — producer: orchestrator ----
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
    // agent_id="qa-engineer" with pre-filled completed_tasks) (E432: the feature's
    // judge — code-reviewer on a test-first feature — is armed the same way). A
    // qa-engineer write that adds ids to the on-disk completed set needs per-id
    // QA evidence on disk (hasEvidenceInFile from gates/qa-review.ts, covers:
    // honored); ids already there are exempt, and no edge or verdict is. Runs after the qa_review auto-record, so a PASS
    // or FAIL write's own evidence counts. File mode only.
    // Spec: specs/c16-c10-role-boundary.md (the E32 amendment).
    errorCode: "QA_COMPLETION_EVIDENCE_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "any write by code-reviewer (the judge) whose completed_tasks adds ids not in the on-disk completed set — no edge/status/verdict exemption (file-mode only)",
    armCondition:
      "agent_id === resolveJudgeReport().judge && newly-added completed ids non-empty && hasEvidenceInFile(newIds).missing non-empty; FileHandoffStorage only",
    clearingArtifact:
      "qa_reports/review_<id>.md (or a covers: file) on disk for every newly-added id — including via the qa_review auto-record on this same write",
    hintStatic:
      "code-reviewer is the judge: write its report for each newly added id " +
      "first (qa_review with review_task_ids on a PASS/FAIL write, or " +
      "qa_reports/review_<id>.md or a covers: file), or drop the unevidenced " +
      "ids from completed_tasks. No exemption for any edge, status, or " +
      "review_verdict. See docs/backlog.md E18 incident (b) + E32.",
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
      "(covers: files count). Run the Expected-Red Diff step (skill-code-reviewer) — diff the actual " +
      "suite reds against the manifest and record the disposition before PASS.",
    documentedInProse: true,
  },
  {
    // Repro-first gate for bugfix tickets: on sr-engineer:In_Progress ->
    // code-reviewer:In_Progress, when prevState.dispatch_mode is "bugfix" and no
    // qa_reports/expected-red_<feature>.txt manifest exists (hasExpectedRedManifest).
    // E432/E435: also arms on qa-engineer:In_Progress|Blocked -> sr-engineer:In_Progress
    // on every file-mode feature unless
    // qa_reports/no-new-test_<feature>.txt exists (hasNoNewTestRecord);
    // that edge has its own message, no hintStatic.
    // Plain-text family, so not in the TransitionRejection["error"] union.
    // Design: specs/e2-bugfix-repro-gate-architecture.md.
    errorCode: "REPRO_MANIFEST_MISSING",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "sr-engineer:In_Progress -> code-reviewer:In_Progress (bugfix), or qa-engineer:In_Progress|Blocked -> sr-engineer:In_Progress (file-mode only)",
    armCondition:
      "prevState.dispatch_mode === bugfix on the sr -> code-reviewer edge, or the qa -> sr edge without a no-new-test record (hasNoNewTestRecord); FileHandoffStorage only",
    clearingArtifact:
      "qa_reports/expected-red_<feature>.txt present (hasExpectedRedManifest); on the qa -> sr edge, qa_reports/no-new-test_<feature>.txt present also clears (hasNoNewTestRecord)",
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
    hintStatic: "Run the visual verdict (skill-reviewer-visual) and write the visual report before PASS.",
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
      "§Artifact Schema) and PM copy it into the spec; reviewer-visual marks each row pass/fail. " +
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
      "cleared (skill-reviewer-visual §Report schema; headings may carry " +
      "prefixes/suffixes but must contain the canonical names, evidence " +
      "schema v2). Resolve the failed/unverified " +
      "rows — do NOT pre-accept them (visual verdict is reviewer-visual-owned, " +
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
    clearingArtifact: "APPROVED↔{PASS, In_Progress} or CHANGES_REQUESTED↔FAIL",
    hintStatic:
      "A code-reviewer APPROVED verdict requires status=PASS or In_Progress; " +
      "CHANGES_REQUESTED requires status=FAIL. Align review_verdict with status, " +
      "or omit review_verdict. See specs/c9-protocol-fields.md AC-5.",
    documentedInProse: true,
  },
  {
    // Ledger authorship: only the chain's judge (code-reviewer) may grow
    // completed_tasks; any other identity carrying a non-empty list is rejected
    // at the write, every storage mode. Replaces the two pre-E435 role-specific
    // ledger codes (E435, ruling (b)).
    errorCode: "NON_JUDGE_COMPLETED_TASKS_REJECTED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "any write whose agent_id is present and is NOT code-reviewer, carrying non-empty completed_tasks",
    armCondition: "agent_id present && agent_id !== \"code-reviewer\" && completed_tasks.length > 0",
    clearingArtifact: "omit completed_tasks (or pass []) on any write not stamped agent_id=code-reviewer; only the judge may grow the ledger",
    hintStatic:
      "completed_tasks on a write not stamped agent_id=code-reviewer is ledger " +
      "pollution: only code-reviewer, the chain's judge, may grow completed_tasks " +
      "(or complete tasks through tw_complete_task), backed by the " +
      "QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks (or " +
      "pass []) on this write. See docs/backlog.md E40.",
    documentedInProse: true,
  },
  {
    // Authorship half of the review_verdict check (the consistency half is
    // REVIEW_VERDICT_STATUS_MISMATCH): only the code-reviewer may stamp a
    // verdict, so a forged APPROVED cannot advance auto-routing. Emitted by the
    // same pipeline step as REVIEW_VERDICT_STATUS_MISMATCH; file mode only
    // (SQLite never persists review_verdict, so there is nothing to forge).
    errorCode: "NON_REVIEWER_VERDICT_REJECTED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "any file-mode write whose agent_id is present and is NOT code-reviewer, carrying review_verdict",
    armCondition:
      "FileHandoffStorage && review_verdict present && agent_id present && agent_id !== \"code-reviewer\"; no prevTuple/nextTuple edge exemption (E435)",
    clearingArtifact:
      "omit review_verdict on any write not stamped agent_id=code-reviewer",
    hintStatic:
      "review_verdict is the code-reviewer's verdict field: only an " +
      "agent_id=code-reviewer write may carry it. Omit review_verdict on this " +
      "write. See docs/backlog.md E139.",
    documentedInProse: true,
  },
  {
    errorCode: "QA_REVIEW_TARGET_REQUIRED",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge:
      "PASS/FAIL write by code-reviewer (the judge) carrying qa_review with review_task_ids and completed_tasks both empty",
    armCondition:
      "qa_review present && agent_id=code-reviewer && status in {PASS, FAIL}",
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
      "Run the AC Execution step (skill-code-reviewer) — execute each proof:-annotated AC in " +
      "specs/<feature>.md and record command, raw output/exit code, and a per-AC " +
      "pass/fail verdict under a ## AC Execution Log section in a " +
      "qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count; " +
      "the heading may carry a prefix/suffix but must contain the canonical " +
      "name, evidence schema v2) " +
      "before PASS. The server checks the section's presence only — the proofs' " +
      "truthfulness stays with the judge. " +
      "See specs/e3-outcome-shaped-acceptance.md AC3/AC4.",
    documentedInProse: true,
  },
  {
    // PASS-time open-task gate: a qa PASS must account for every open row of the
    // feature's own lane ledger (gates/open-tasks.ts); post-PASS role rows are exempt.
    // Shared, legacy and configured ledgers leave it dormant. File mode only.
    // Spec: specs/e247-qa-pass-unticked-gate.md.
    errorCode: "PASS_TASKS_INCOMPLETE",
    producer: "orchestrator",
    envelope: "plain-text",
    triggerEdge: "code-reviewer:In_Progress -> code-reviewer:PASS (every status=PASS write; file-mode only)",
    armCondition:
      "status=PASS && featureLaneLedger().armed && listOpenFeatureTasks() non-empty; FileHandoffStorage only",
    clearingArtifact:
      "every listed id in completed_tasks (this write or on disk for the same feature), ticked, or voided via tw_void_task",
    hintStatic:
      "A code-reviewer PASS must account for every open task in the feature's lane " +
      "ledger: add each listed id to completed_tasks with its QA evidence (a covers: " +
      "line counts), or void a dropped task with tw_void_task, then retry the PASS. " +
      "Rows whose description starts with release-engineer or doc-writer (post-PASS " +
      "work) are exempt. See docs/backlog.md E247.",
    documentedInProse: true,
  },
  // ---- tool-boundary (code 33) — producer: zod at tools/registry.ts ----
  {
    // dispatch_pins tier enum (E300): each value must be one of the four tier
    // names. Rejected by zod before UPDATE_STATE_GATE_PIPELINE, so it has no
    // pipeline step; file and SQLite mode alike. The zod issue path carries
    // the role, which index.ts formatZodError prefixes as "dispatch_pins.<role>: ".
    // An on-disk value outside the enum is surfaced by tw_get_state as
    // dispatch_pins_advisory, never rejected on read.
    errorCode: "DISPATCH_PIN_TIER_REJECTED",
    producer: "tool-boundary",
    envelope: "plain-text",
    triggerEdge:
      "any tw_update_state write whose dispatch_pins carries a value outside the four tier names (any agent, any status; rejected before the pipeline, file and SQLite mode alike)",
    armCondition:
      "zod z.enum on each dispatch_pins value (tools/registry.ts UpdateStateArgs); runs before UPDATE_STATE_GATE_PIPELINE",
    clearingArtifact: "dispatch_pins.<role> set to one of opus, sonnet, haiku, fable",
    // tools/registry.ts DISPATCH_PIN_TIER_HINT — byte-exact; the received value precedes it.
    hintStatic: "is not a model tier; allowed: opus, sonnet, haiku, fable",
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
// 16-member TransitionRejection["error"] union in tools/transitions.ts (see DR-8:
// that union carries 10 additional handler-side envelope-consistency codes and
// must stay byte-identical; non-drift is enforced by a test assertion
// union ⊆ ALL_GATE_CODES, not by re-sourcing from here).
export const TRANSITION_GATE_CODES: readonly GateErrorCode[] = [
  "AGENT_ID_REQUIRED",
  "TRANSITION_REJECTED",
  "REVIEW_ROUND_EXCEEDED",
  "VISUAL_ROUND_EXCEEDED",
  "HOP_CAP_EXCEEDED",
  "SR_RETURN_CAP_EXCEEDED",
];

// Every gate error code, in catalog order. === GATE_REGISTRY.map(g => g.errorCode).
export const ALL_GATE_CODES: readonly GateErrorCode[] = GATE_REGISTRY.map((g) => g.errorCode);
