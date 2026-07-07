// Coded by @sr-engineer
// tw_update_state gate-policy orchestration (registry-pattern, T-REG-04).
// Verbatim relocation of the index.ts `tw_update_state` dispatcher case body
// (pre-refactor index.ts:722-1197). Kept SEPARATE from tools/handoff.ts to
// avoid conflating "read/write handoff state" with "gate policy orchestration"
// (this module imports tools/transitions.ts + tools/evidence-file.ts; handoff.ts
// does not) — and to scope the future A2 gates/ extraction cleanly.
//
// Check order is FROZEN (spec AC-5/AC-8): preflight → PASS/qa-engineer gate →
// transition validation → scope-decision gate → cut-approval gate → QA evidence
// record → PASS evidence gate → visual sub-gates → code-reviewer evidence gate →
// round-cap sentinels → storage.writeState → PASS RAG GC hook.
// No reorder, no merge, no early-return removal.
//
// The 4-step mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot) lives inside tools/handoff.ts writeState — NOT here (spec finding #5).
import { enforcePreFlight } from "../guards/session.js";
import { getActiveStorage, FileHandoffStorage } from "./storage.js";
import { requireQaEngineer, validateTransition, computeNewRound, ALLOWED_TRANSITIONS, } from "./transitions.js";
import { hasVisualBaselinesInDesign, hasVisualEvidenceInFile, hasUncheckedWidgets, hasDesignModeRequiringVisual, designDeclaresStructuralAssertions, validateVisualReports, checkVisualProvenance, checkBaselineManifest, checkPixelGateAttestation, hasScopeDecision, hasCutApproval, } from "./evidence-file.js";
import { awaitAllInflightFor } from "./rag-coalesce.js";
// --- GUARDED: must call tw_get_state first ---
export async function handleUpdateState(parsed) {
    enforcePreFlight(parsed.workspace_path, "tw_update_state");
    // Defense-in-depth: zod refine already enforces this on PASS, but a
    // client that bypasses zod still hits this guard.
    if (parsed.status === "PASS") {
        const gate = requireQaEngineer(parsed.agent_id, "tw_update_state(status=PASS)");
        if (!gate.ok) {
            return { content: [{ type: "text", text: gate.message ?? "blocked" }] };
        }
    }
    const storage = getActiveStorage();
    const prevState = storage.parse(parsed.workspace_path);
    const prev_qa_round = prevState?.qa_round ?? 0;
    const prev_review_round = prevState?.review_round ?? 0;
    const prev_visual_round = prevState?.visual_round ?? 0;
    const prevTuple = {
        agent: prevState?.last_agent ?? null,
        status: prevState?.status ?? null,
    };
    const nextTuple = {
        agent: parsed.agent_id ?? null,
        status: parsed.status,
    };
    const rejection = validateTransition({
        prev: prevTuple,
        next: nextTuple,
        prev_qa_round,
        prev_review_round,
        prev_visual_round,
        next_pending_notes: parsed.pending_notes,
    });
    if (rejection) {
        return {
            content: [{ type: "text", text: `⛔ ${rejection.error}\n${JSON.stringify(rejection, null, 2)}` }],
            isError: true,
        };
    }
    // v3.30.0 — Scope Decision Gate (server-scope-decision-gate). Fires on
    // the build-entry edge (pm:In_Progress → {architect,sr-engineer}:In_Progress)
    // when the design is armed (mode != no-design) but no scope decision is
    // recorded. Pinning prev=pm makes re-entry/resume safe: the
    // architect→sr-engineer and sr-engineer self-loop edges have a non-pm
    // predecessor and are never gated. Structurally independent of the visual
    // gate (different edge, different artifacts; shares only the arm helper).
    // Placed here — after validateTransition accepts, before the evidence
    // blocks — so all transition-shaped rejects read first. NOT in
    // transitions.ts (that stays pure / fs-free; mirrors VISUAL_BASELINES_REQUIRED).
    if ((nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
        nextTuple.status === "In_Progress" &&
        prevTuple.agent === "pm" &&
        prevTuple.status === "In_Progress") {
        const arm = hasDesignModeRequiringVisual(parsed.workspace_path, parsed.active_feature);
        if (arm.required && !hasScopeDecision(parsed.workspace_path, prevState)) {
            const hint = "Scope decision missing. Either: (a) create .current/feature-split.md documenting the " +
                "multi-feature split decision, or (b) set scope_decision: single-feature in this " +
                "tw_update_state call with a why field explaining why this feature is appropriately " +
                "scoped. Gate only fires when design/<feature>.md declares mode != no-design. " +
                "See specs/server-scope-decision-gate.md.";
            const envelope = {
                error: "SCOPE_DECISION_REQUIRED",
                attempted: {
                    prev_agent: prevTuple.agent,
                    prev_status: prevTuple.status,
                    new_agent: nextTuple.agent,
                    new_status: nextTuple.status,
                },
                allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                    new_agent: c.agent,
                    new_status: c.status,
                })),
                hint,
            };
            return {
                content: [{
                        type: "text",
                        text: `⛔ SCOPE_DECISION_REQUIRED\n${JSON.stringify(envelope, null, 2)}`,
                    }],
                isError: true,
            };
        }
    }
    // v5 — Cut-Approval Gate (pm-cut-approval-gate). Fires on the same
    // build-entry edge (pm:In_Progress → {architect,sr-engineer}:In_Progress)
    // as the scope-decision gate, but is UNCONDITIONAL (not arm-gated): a
    // human must approve the ticket cut before ANY build role receives the
    // handoff, visual feature or not. Runs SECOND, directly after the
    // scope-decision gate (D1): independent error code, no merged envelope,
    // so each hint stays actionable and tests assert each in isolation.
    // Pinning prev=pm keeps resume/re-entry safe — architect→sr-engineer and
    // the sr self-loop have a non-pm predecessor and are never gated.
    // FILE-MODE ONLY (D5): cut_approved lives in the handoff YAML frontmatter
    // only; in SQLite/HTTP mode the parsed prev-state never carries it, so
    // the gate would always fire. Skip the gate unless the active storage is
    // the file implementation. NOT in transitions.ts (that stays pure /
    // fs-free; mirrors SCOPE_DECISION_REQUIRED).
    if (getActiveStorage() instanceof FileHandoffStorage &&
        (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
        nextTuple.status === "In_Progress" &&
        prevTuple.agent === "pm" &&
        prevTuple.status === "In_Progress") {
        if (!hasCutApproval(prevState)) {
            const hint = "Cut approval missing. PM must present the ticket cut inline in chat and " +
                "obtain human approval before routing to build. Set cut_approved: true on " +
                "the pm:In_Progress write after approval. See content/skill-pm.md §SOP step 7a.";
            const envelope = {
                error: "CUT_APPROVAL_REQUIRED",
                attempted: {
                    prev_agent: prevTuple.agent,
                    prev_status: prevTuple.status,
                    new_agent: nextTuple.agent,
                    new_status: nextTuple.status,
                },
                allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
                    new_agent: c.agent,
                    new_status: c.status,
                })),
                hint,
            };
            return {
                content: [{
                        type: "text",
                        text: `⛔ CUT_APPROVAL_REQUIRED\n${JSON.stringify(envelope, null, 2)}`,
                    }],
                isError: true,
            };
        }
    }
    // Evidence record FIRST so the PASS gate below can observe the row /
    // file just written. Only fires when QA attaches qa_review on a
    // PASS or FAIL write.
    if (parsed.qa_review &&
        parsed.agent_id === "qa-engineer" &&
        (parsed.status === "PASS" || parsed.status === "FAIL")) {
        let ids = parsed.completed_tasks;
        if (ids.length === 0) {
            const all = storage.listTasks(parsed.workspace_path);
            ids = all ? all.filter((t) => !t.completed).map((t) => t.id) : [];
        }
        if (ids.length > 0) {
            await storage.recordReview(parsed.workspace_path, ids, parsed.status, "qa-engineer", parsed.qa_review);
        }
    }
    // Evidence gate for PASS path
    if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
        const ev = await storage.hasEvidence(parsed.workspace_path, parsed.completed_tasks);
        if (ev.missing.length > 0) {
            return {
                content: [{
                        type: "text",
                        text: `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. Provide qa_review or write qa_reports/review_<id>.md (file mode) / insert reports row (SQLite) before PASS.`,
                    }],
                isError: true,
            };
        }
        // v3.16.0 — Visual gate self-arming (visual-fidelity-gate-hardening, AC-1).
        // Arming moved off "## Visual Baselines present" onto "design mode != no-design".
        // STEP 1 (arm-check) fires BEFORE the evidence-file lookup; the two paths are
        // mutually exclusive (D2): an armed-but-baseline-less workspace gets the single
        // actionable VISUAL_BASELINES_REQUIRED error, never the confusing evidence-missing
        // error for a section that doesn't exist. STEP 2 (the v3.14.0 gate below) is
        // unchanged and reached only when ## Visual Baselines IS present.
        const armCheck = hasDesignModeRequiringVisual(parsed.workspace_path, parsed.active_feature);
        const visualGate = hasVisualBaselinesInDesign(parsed.workspace_path, parsed.active_feature);
        // STEP 1 — armed (mode != no-design) but no baselines section → block (NEW path).
        if (armCheck.required && !visualGate.present) {
            return {
                content: [{
                        type: "text",
                        text: `⛔ VISUAL_BASELINES_REQUIRED: design/<feature>.md declares mode != no-design ` +
                            `(mode=${armCheck.mode}, at ${armCheck.designPath}) but ## Visual Baselines is absent. ` +
                            `Add the Visual Baselines section (design-auditor SOP §Artifact Schema) before retrying PASS.`,
                    }],
                isError: true,
            };
        }
        // STEP 2 — v3.14.0 Visual evidence gate (Constitution §3.1), UNCHANGED.
        // Reached only when `## Visual Baselines` is present; non-UI workspaces
        // (no design file, or mode = no-design) fall straight through here.
        if (visualGate.present) {
            const visEv = hasVisualEvidenceInFile(parsed.workspace_path, parsed.completed_tasks);
            if (visEv.missing.length > 0) {
                return {
                    content: [{
                            type: "text",
                            text: `⛔ VISUAL_EVIDENCE_MISSING: ${visEv.missing.join(", ")}. ` +
                                `design/<feature>.md declares ## Visual Baselines (at ${visualGate.designPath}) ` +
                                `but qa_reports/visual_<task-id>.md is absent for the listed task(s). ` +
                                `Run Phase 1.5 (skill-qa-visual) and write the visual report before PASS.`,
                        }],
                    isError: true,
                };
            }
            // v3.15.0 — R6 server-enforced Widget Shape Verification gate.
            // The previous gate confirmed every required visual_<id>.md exists.
            // This gate now verifies the contents: any unchecked `[ ]` row in
            // `## Widget Shape Verification` rejects PASS with the full list
            // (per AC-4: one round-trip to surface every offending widget).
            // Backwards-compat: visual reports without the `## Widget Shape
            // Verification` section pass through (per AC-2/AC-3 — pre-v3.15.0
            // reports didn't have the section, so absence = no claim).
            const widgetsCheck = hasUncheckedWidgets(parsed.workspace_path, parsed.completed_tasks);
            if (!widgetsCheck.ok) {
                const listing = Object.entries(widgetsCheck.uncheckedByTaskId)
                    .map(([taskId, widgets]) => `${taskId}: [${widgets.join(", ")}]`)
                    .join("; ");
                return {
                    content: [{
                            type: "text",
                            text: `⛔ VISUAL_WIDGETS_UNVERIFIED: ${listing}. ` +
                                `Unchecked widget row(s) in qa_reports/visual_<id>.md. ` +
                                `Edit the visual report to mark each verified widget as [x] before retrying PASS.`,
                        }],
                    isError: true,
                };
            }
            // v3.27.0 — Visual report SCHEMA validation (Constitution §3.2).
            // Existence + widget-shape was insufficient: CDE-OOBE shipped a bad
            // UI under a nominal PASS because the report carried no canonical-state
            // or structural-assertion claims. MANDATORY when the visual gate is
            // armed (mode != no-design): the design MUST declare
            // `## Visual Structural Assertions`. Missing it is NOT a silent
            // backwards-compatible fallback (the v3.26.0 bug Codex flagged) — it
            // is its own hard error VISUAL_ASSERTIONS_REQUIRED, mirroring how a
            // missing `## Visual Baselines` blocks at v3.16.0.
            if (armCheck.required) {
                if (!designDeclaresStructuralAssertions(parsed.workspace_path, parsed.active_feature)) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ VISUAL_ASSERTIONS_REQUIRED: design/<feature>.md declares mode != no-design ` +
                                    `(mode=${armCheck.mode}, at ${armCheck.designPath}) but ## Visual Structural ` +
                                    `Assertions is absent. The design-auditor MUST emit it (skill-design-auditor ` +
                                    `§Artifact Schema) and PM copy it into the spec; qa-visual marks each row pass/fail. ` +
                                    `Add the section before retrying PASS.`,
                            }],
                        isError: true,
                    };
                }
                const schema = validateVisualReports(parsed.workspace_path, parsed.completed_tasks);
                if (!schema.ok) {
                    const listing = Object.entries(schema.byTaskId)
                        .map(([taskId, v]) => {
                        const reasons = [];
                        if (v.missingSections.length)
                            reasons.push(`missing: ${v.missingSections.join("/")}`);
                        if (v.failedCanonicalStates.length)
                            reasons.push(`canonical-state fail: ${v.failedCanonicalStates.join("/")}`);
                        if (v.failedStructuralAssertions.length)
                            reasons.push(`structural fail: ${v.failedStructuralAssertions.join("/")}`);
                        if (v.failedRegionDiffs.length)
                            reasons.push(`region-diff fail: ${v.failedRegionDiffs.join("/")}`);
                        if (!v.verdictPass)
                            reasons.push("verdict != PASS");
                        return `${taskId} {${reasons.join("; ")}}`;
                    })
                        .join(" | ");
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ VISUAL_REPORT_INCOMPLETE: ${listing}. ` +
                                    `qa_reports/visual_<id>.md must contain Canonical State Verification, ` +
                                    `Structural Assertions, Region Diff (per-surface pass/accepted), Allowed ` +
                                    `Differences, and a Verdict that normalizes to exactly PASS — every row ` +
                                    `cleared (skill-qa-visual §Report schema). Resolve the failed/unverified ` +
                                    `rows — do NOT pre-accept them (visual verdict is qa-visual-owned, ` +
                                    `Constitution §3.2).`,
                            }],
                        isError: true,
                    };
                }
                // v3.38.0 — Baseline provenance gate (qa-visual-baseline-provenance, AC-1/AC-2).
                // The v3.27 schema gate confirmed the report's STRUCTURE is complete and every
                // row reads pass/accepted; it could NOT confirm the agent diffed a real baseline.
                // This gate parses each per-surface prose sub-section under ## Region Diff and
                // rejects PASS when a diffed (non-carry-forward) surface lacks a baseline:
                // fingerprint or a diff-metric: value. Opt-in (D2): dormant for reports with no
                // baseline: line anywhere (legacy/pre-provenance). Carry-forward surfaces are
                // exempt (AC-3); a "B1 tool unavailable — LLM fallback" note satisfies the
                // metric requirement (AC-4). FIFTH and LAST visual sub-gate — runs only on an
                // otherwise-clean, armed report.
                const prov = checkVisualProvenance(parsed.workspace_path, parsed.completed_tasks);
                if (!prov.ok) {
                    const listing = Object.entries(prov.offendingByTaskId)
                        .map(([taskId, offenses]) => `${taskId} {${offenses.join("; ")}}`)
                        .join(" | ");
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ VISUAL_PROVENANCE_MISSING: ${listing}. Each diffed surface in ` +
                                    `qa_reports/visual_<id>.md must carry a baseline: fingerprint and a ` +
                                    `diff-metric: value in its prose sub-section under ## Region Diff. ` +
                                    `Carry-forward surfaces (annotated "pass (carried forward — git diff ` +
                                    `confirms source untouched)") are exempt; "B1 tool unavailable — LLM ` +
                                    `fallback" satisfies the diff-metric requirement. ` +
                                    `See specs/qa-visual-baseline-provenance.md.`,
                            }],
                        isError: true,
                    };
                }
                // v3.40.0 — Baseline manifest gate (figma-baseline-manifest-gate).
                // SIXTH and LAST visual sub-gate. The v3.38 provenance gate confirmed
                // each diffed surface carries a real baseline+diff; this gate confirms
                // the design-auditor FROZE the baseline node-id selection in the
                // design file's ## Source manifest (step 2c) rather than eyeball-picking
                // or re-deriving it. Opt-in (AC-N3): dormant when ## Source is absent
                // (pre-v3.40 designs). Single-surface (1 audited row) is exempt from
                // the provenance-section requirement (AC-3); multi-surface (>=2) must
                // record filter-conditions + exclusion-reasons in
                // ## Baseline Selection Provenance (AC-2).
                const manifest = checkBaselineManifest(parsed.workspace_path, parsed.active_feature);
                if (!manifest.ok) {
                    const text = manifest.code === "BASELINE_MANIFEST_MISSING"
                        ? `⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.`
                        : `⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.`;
                    return { content: [{ type: "text", text }], isError: true };
                }
                // v3.42.0 — Pixel-gate attestation (qa-visual-pixel-gate-attestation,
                // AC-2/AC-5). SEVENTH and LAST visual sub-gate. The v3.38 provenance
                // gate (now tightened by DIFF_METRIC_PLACEHOLDERS, AC-1) confirms each
                // diffed surface carries a REAL baseline + non-placeholder diff-metric;
                // this gate confirms qa-visual POSITIVELY attested the pixel gate ran
                // to completion (`pixel_gate_complete: true`) per surface. Closes the
                // F2 false-pass: a skipped diff can no longer ride structural assertions
                // to PASS. Opt-in (mirrors provenance D2): dormant for reports with no
                // baseline: line anywhere. Carry-forward surfaces are exempt (AC-4);
                // the B1 LLM-fallback path STILL requires the attestation (AC-5).
                const attestation = checkPixelGateAttestation(parsed.workspace_path, parsed.completed_tasks);
                if (!attestation.ok) {
                    const listing = Object.entries(attestation.offendingByTaskId)
                        .map(([taskId, offenses]) => {
                        const surfaces = offenses
                            .map((o) => o.replace(/^missing-attestation:/, ""))
                            .join(", ");
                        return `${taskId} {${surfaces}}`;
                    })
                        .join(" | ");
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ PIXEL_GATE_ATTESTATION_MISSING: ${listing}. Each non-carry-forward ` +
                                    `surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' ` +
                                    `in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward ` +
                                    `surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.`,
                            }],
                        isError: true,
                    };
                }
            }
        }
    }
    // Code-reviewer evidence gate. Mirrors the PASS gate above for the
    // sr ↔ code-reviewer → qa handoff. Only fires when the previous tuple
    // is (code-reviewer, In_Progress) AND the next tuple hands off to qa.
    if (prevTuple.agent === "code-reviewer" &&
        prevTuple.status === "In_Progress" &&
        nextTuple.agent === "qa-engineer" &&
        nextTuple.status === "In_Progress" &&
        parsed.completed_tasks.length > 0) {
        const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, parsed.completed_tasks);
        if (ev.missing.length > 0) {
            return {
                content: [{
                        type: "text",
                        text: `⛔ MISSING_REVIEW_EVIDENCE: ${ev.missing.join(", ")}. ` +
                            `Code-reviewer evidence missing: write review_reports/review_<task-id>.md ` +
                            `before handing off to qa-engineer.`,
                    }],
                isError: true,
            };
        }
    }
    const { qa_round: new_qa_round, review_round: new_review_round, visual_round: new_visual_round, } = computeNewRound(prev_qa_round, prev_review_round, prev_visual_round, nextTuple, prevTuple, parsed.pending_notes);
    const pending = [...parsed.pending_notes];
    // v3.15.0 — symmetric cap-cross predicate fix.
    // v3.14.0 used `=== 4 && === 3` which would skip the sentinel when
    // prev_round arrived at the handler at a value already past 3
    // (migration / hand-edit). v3.14.1 fixed visual_round; v3.15.0 brings
    // qa_round and review_round in line. Predicate: `new >= 4 && prev < 4`
    // fires exactly once per cap-cross from any prior value.
    if (new_qa_round >= 4 && prev_qa_round < 4) {
        pending.unshift("⛔ Round 4: forced rollback to pm — no further QA allowed until PM resets.");
    }
    if (new_review_round >= 4 && prev_review_round < 4) {
        pending.unshift("⛔ Review Round 4: forced rollback to pm — no further code-review allowed until PM resets.");
    }
    // v3.14.0 — visual_round Round 6 lock (5 visual FAILs accumulated).
    // Symmetric to qa_round / review_round Round 4 lock.
    // v3.14.1 — fire on every cap-cross, not only the exact 5→6 step.
    // Earlier v3.14.0 used `=== 6 && === 5`, which skipped the sentinel
    // when the prior counter was already at cap due to migration or
    // hand-edit. `>=6 && <6` is the correct cap-cross predicate.
    if (new_visual_round >= 6 && prev_visual_round < 6) {
        pending.unshift("⛔ Visual Round 6: forced rollback to pm — no further pixel iteration allowed until PM rebudgets scope or threshold.");
    }
    // v3.15.0 — call site uses the new options-object overload of
    // storage.writeState. Each field is named, eliminating the
    // 11-positional risk that motivated the refactor. The positional
    // overload remains @deprecated for backwards-compat callers.
    const result = await storage.writeState({
        workspacePath: parsed.workspace_path,
        activeFeature: parsed.active_feature,
        status: parsed.status,
        completedTasks: parsed.completed_tasks,
        pendingNotes: pending,
        blockingReason: parsed.blocking_reason,
        lastAgent: parsed.agent_id,
        qaRound: new_qa_round,
        prdPath: parsed.prd_path,
        reviewRound: new_review_round,
        visualRound: new_visual_round,
        scopeDecision: parsed.scope_decision,
        scopeDecisionWhy: parsed.scope_decision_why,
        cutApproved: parsed.cut_approved,
    });
    // GC hook: when QA flips a feature to PASS, drop the workspace's RAG
    // chunks so the next feature starts clean. Await any concurrent lazy
    // reindex first so DELETE cannot race with INSERT.
    // Best-effort: a failure here MUST NOT undo the successful state write.
    if (parsed.status === "PASS" &&
        parsed.agent_id === "qa-engineer" &&
        "deletePrdChunks" in storage &&
        typeof storage.deletePrdChunks === "function") {
        try {
            await awaitAllInflightFor(parsed.workspace_path);
            storage.deletePrdChunks(parsed.workspace_path);
        }
        catch {
            // swallow — state write is the source of truth; cleanup is opportunistic
        }
    }
    return { content: [{ type: "text", text: result }] };
}
//# sourceMappingURL=handoff-orchestrator.js.map