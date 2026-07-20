// Coded by @sr-engineer
// tw_update_state gate-policy orchestration (registry-pattern, T-REG-04).
// Verbatim relocation of the index.ts `tw_update_state` dispatcher case body
// (pre-refactor index.ts:722-1197). Kept SEPARATE from tools/handoff.ts to
// avoid conflating "read/write handoff state" with "gate policy orchestration"
// (this module imports tools/transitions.ts + tools/evidence-file.ts; handoff.ts
// does not) — and to scope the future A2 gates/ extraction cleanly.
//
// Check order is FROZEN-ADDITIVE and, since E35 (e35-gate-pipeline-extraction),
// expressed as DATA: the ordered UPDATE_STATE_GATE_PIPELINE array below replaces
// the pre-E35 hand-woven if-block sequence. Full order: preflight →
// PASS/qa-engineer gate → ctx derivation → pipeline [transition validation →
// stamp-provenance gate (E18, before the lease gate: the lease predicate
// consumes last_updated, so provenance resolves first) → feature-lease gate (E1)
// → lease-override bypass/audit (E10) → bookkeeping-write feature-change gate
// (E10) → scope-decision gate → cut-approval gate → external-refs gate →
// source-credibility gate (E4) → repro-first gate (E2, bugfix-mode) →
// review-verdict/status mismatch gate → reviewer completed_tasks gate (v3.58.0,
// C16) → QA evidence record → qa completion-evidence gate (E18, after the record
// so a qa_review-bearing write's own evidence counts) → PASS evidence gate →
// visual sub-gates → expected-red diff gate → AC-execution-log gate (E3) →
// code-reviewer evidence gate] → round-cap sentinels → storage.writeState →
// PASS RAG GC hook. No reorder, no merge, no early-return removal — the order
// is asserted by the qa-owned order-pin test, not a comment. Gate bodies are
// byte-verbatim relocations of the pre-E35 inline blocks (original indentation
// deliberately preserved: the source-pin suites — error-code-contract,
// ac-execution I5b, gates-expected-red — assert exact byte shapes; do not
// re-indent).
//
// The 4-step mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot) lives inside tools/handoff.ts writeState — NOT here (spec finding #5).
import { enforcePreFlight } from "../guards/session.js";
import { getActiveStorage, FileHandoffStorage } from "./storage.js";
import { requireQaEngineer, validateTransition, computeNewRound, ALLOWED_TRANSITIONS, HOP_CAP_EXPORTED, } from "./transitions.js";
import { hasVisualBaselinesInDesign, hasVisualEvidenceInFile, visualEvidencePath, hasUncheckedWidgets, hasDesignModeRequiringVisual, designDeclaresStructuralAssertions, validateVisualReports, checkVisualProvenance, checkBaselineManifest, checkPixelGateAttestation, checkSourceCredibility, } from "../gates/visual.js";
import { hasScopeDecision } from "../gates/scope-decision.js";
import { isFeatureLeaseHeld } from "../gates/feature-lease.js";
import { hasExpectedRedManifest, hasExpectedRedDisposition } from "../gates/expected-red.js";
import { hasProofAnnotatedAC, hasAcExecutionLogDisposition } from "../gates/ac-execution.js";
import { hasCutApproval } from "../gates/cut-approval.js";
import { EVIDENCE_SCHEMA_CURRENT } from "../gates/evidence-schema.js";
import { classifyLeaseOverride } from "../gates/lease-override.js";
import { isHandAuthoredStamp, hasStampRemediationAudit } from "../gates/stamp-provenance.js";
import { hasEvidenceInFile, qaEvidencePath } from "../gates/qa-review.js";
import { hasUnresolvedRefs, listUnresolvedRefs } from "../gates/external-refs.js";
import { gate, TRANSITION_GATE_CODES } from "../gates/registry.js";
import { awaitAllInflightFor } from "./rag-coalesce.js";
import { emitGateTelemetry, extractGateCodeFromText } from "./telemetry.js";
import { emitFeatureMetrics } from "./metrics.js";
import { runUpdateStatePipeline, } from "../gates/pipeline.js";
// ==========================================
// tw_get_state tool handler (E36 — e36-handoff-split-overload-adapter).
// Relocated from tools/handoff.ts (verbatim body, pre-split ~line 1272) to
// live alongside its sibling handleUpdateState — both are MCP tool handlers
// for the same handoff.md surface (read vs. write), not part of the
// parse/write library code tools/handoff.ts now barrels. registry.ts imports
// both from this module.
// ==========================================
// --- No guard: reading state IS the pre-flight check ---
export async function handleGetState(args) {
    const { workspace_path } = args;
    const result = getActiveStorage().readState(workspace_path);
    return { content: [{ type: "text", text: result }] };
}
// E1 (e1-feature-scoped-state-design) — feature-lease TTL. Fixed constant,
// NOT config-driven (mirrors STALE_DISPATCH_THRESHOLD_MIN in
// tools/handoff-parse.ts and HOP_CAP's fixed-constant posture): stale-lease
// auto-expiry is a safety self-heal, not a tunable policy knob. 30 min —
// deliberately LONGER than the 15-min dispatch-staleness threshold, since a
// whole feature legitimately spans longer gaps than a single dispatch
// (PM-ratified calibration, 2026-07-12; any change requires a PM spec
// amendment).
const LEASE_TTL_MIN = 30;
// D3 (d3-gate-fire-telemetry) — thin telemetry wrapper, the ONE emit point
// for all 22 GATE_REGISTRY rejections. Zero changes to the frozen check-order
// body below (handleUpdateStateCore was the pre-D3 handleUpdateState,
// byte-identical; since E35 its gate blocks live in UPDATE_STATE_GATE_PIPELINE,
// bodies still byte-verbatim). emitGateTelemetry swallows internally (AC-4): the returned
// ToolResult is never masked or altered by a telemetry failure.
// enforcePreFlight's thrown session-guard exceptions propagate through
// unmodified — not a GateErrorCode, out of scope.
export async function handleUpdateState(parsed) {
    const result = await handleUpdateStateCore(parsed);
    if (result.isError) {
        const first = result.content[0];
        const text = first && first.type === "text" ? first.text : "";
        const errorCode = extractGateCodeFromText(text);
        if (errorCode) {
            emitGateTelemetry(parsed.workspace_path, errorCode, parsed.agent_id, parsed.active_feature);
        }
    }
    return result;
}
// E35 (e35-gate-pipeline-extraction) — the tw_update_state gate pipeline.
// Check order as DATA: this array IS the frozen-additive check order the
// pre-E35 orchestrator hand-wove as an if-block sequence (each step's body is
// that block, moved byte-verbatim with its provenance comments attached). New
// gates are added by inserting a step at the spec'd position — never by
// editing a neighbor's body. Step granularity: one step per gate family; the
// PASS-path visual sub-gates share derived arm state (armCheck/visualGate)
// and remain one step, their internal order unchanged. Side effects: the
// pre-E35 flow's only mid-sequence effect (the qa_review auto-record) stays
// in its step at the same position (QA_REVIEW_RECORD).
export const UPDATE_STATE_GATE_PIPELINE = [
    {
        name: "TRANSITION_VALIDATION",
        codes: TRANSITION_GATE_CODES,
        run: (ctx) => {
            const { parsed, prevTuple, nextTuple, prev_qa_round, prev_review_round, prev_visual_round, prev_hop_count, feature_changed } = ctx;
            const rejection = validateTransition({
                prev: prevTuple,
                next: nextTuple,
                prev_qa_round,
                prev_review_round,
                prev_visual_round,
                // v7 (c9-protocol-fields AC-4) — structured Amend-Resume field.
                // Replaces the former next_pending_notes token grep; legacy
                // `resume_of: <role>` pending_notes lines are inert (DR-2).
                next_resume_of: parsed.resume_of,
                // v9 — hop-cap inputs (d2-server-brake-accounting). Arms the
                // HOP_CAP_EXCEEDED override: fires when the feature's persisted
                // hop_count is at/over cap on a counted role transition that is not
                // the (pm, In_Progress) landing; feature_changed=true bypasses.
                prev_hop_count,
                feature_changed,
            });
            if (rejection) {
                return {
                    content: [{ type: "text", text: `⛔ ${rejection.error}\n${JSON.stringify(rejection, null, 2)}` }],
                    isError: true,
                };
            }
            return null;
        },
    },
    {
        name: "STAMP_PROVENANCE_SUSPECT",
        codes: ["STAMP_PROVENANCE_SUSPECT"],
        run: (ctx) => {
            const { parsed, storage, prevState } = ctx;
            // E18 — Stamp-Provenance Gate (e18-write-provenance, fix a). Escalates
            // the E9A read-only stampAdvisory (tools/drift.ts) to a blocking gate:
            // when the CURRENT on-disk last_updated matches the hand-authored
            // stamp shape (gates/stamp-provenance.ts — the exact predicate the
            // advisory uses, extracted, not forked), reject any write that does
            // not acknowledge the contamination via pending_notes[0] matching
            // /^stamp-remediation:/ (the LEASE_OVERRIDE_AUDIT_MISSING audit-note
            // style; note-only — no companion boolean, see the module header).
            // Placement: AFTER validateTransition (all transition-shaped rejects
            // still read first — the standing convention) and BEFORE the E1
            // feature-lease gate, an intentional additive insertion: the lease
            // predicate CONSUMES last_updated, so on a suspect stamp its
            // freshness answer is untrustworthy — provenance must be resolved
            // before any gate that trusts the stamp runs. The 4-step freshness
            // guard (writeState: lock → verifyFreshness → atomic write → refresh)
            // is orthogonal: it compares session-snapshot mtimes, never the stamp
            // content, and runs after all gates. Guarded by prevState so the very
            // first write to a brand-new workspace is never gated (no existing
            // handoff = nothing to distrust). Self-disarming: any accepted write
            // stamps a fresh millisecond-entropy now(), so the remediation write
            // itself clears the condition (it must be a NORMAL write — a
            // bookkeeping_write would preserve the suspect stamp verbatim).
            // FILE-MODE ONLY: SQLite/HTTP stamps come from the DB write path,
            // mirroring the sibling attestation gates.
            if (storage instanceof FileHandoffStorage &&
                prevState &&
                isHandAuthoredStamp(prevState.last_updated) &&
                !hasStampRemediationAudit(parsed)) {
                const hint = gate("STAMP_PROVENANCE_SUSPECT").hintStatic;
                const envelope = {
                    error: "STAMP_PROVENANCE_SUSPECT",
                    attempted_feature: parsed.active_feature,
                    incumbent: {
                        active_feature: prevState.active_feature,
                        status: prevState.status,
                        last_updated: prevState.last_updated,
                    },
                    hint,
                };
                return {
                    content: [{
                            type: "text",
                            text: `⛔ STAMP_PROVENANCE_SUSPECT\n${JSON.stringify(envelope, null, 2)}`,
                        }],
                    isError: true,
                };
            }
            return null;
        },
    },
    {
        name: "FEATURE_LEASE",
        codes: ["FEATURE_LEASE_HELD", "LEASE_OVERRIDE_AUDIT_MISSING"],
        run: (ctx) => {
            const { parsed, storage, prevState, prevTuple, nextTuple } = ctx;
            // E1 — Feature-Lease Gate (e1-feature-scoped-state-design, option a-min).
            // Converts the silent second-feature clobber (D5/D9/D10 incident class)
            // into a loud, governed rejection: a write carrying a DIFFERENT
            // active_feature is rejected while the incumbent feature is non-terminal
            // (status != PASS — Blocked counts as held, PM-ratified) and fresh
            // (last_updated within LEASE_TTL_MIN). Per-workspace mutual exclusion:
            // at most one non-terminal feature per workspace_path; the release path
            // is serial by construction. Same-feature writes NEVER gate
            // (feature_changed false short-circuits inside the predicate). Runs
            // FIRST among the state-reading gates — after validateTransition
            // accepts, before the build-entry attestation gates — so the "can this
            // feature take the slot at all?" question is answered before any
            // per-edge attestation is evaluated. BOTH storage modes (unlike
            // cut-approval / external-refs): the core clauses read the three
            // universal fields (active_feature/status/last_updated), which exist
            // identically in the SQLite row; the E1A release-engineer closing-write
            // terminal marker additionally reads last_agent/next_role, which are
            // optional and file-mode-only (SQLite never persists next_role) — the
            // clause simply never matches there (accepted asymmetry, spec
            // §Amendment 2026-07-12). E13 (e13-terminal-marker-advisory): the
            // marker's durable pending_notes disjunct is scoped file-mode-only
            // HERE, at the call site, not inside the pure predicate — SQLite DOES
            // persist pending_notes (unlike next_role), so passing prevState
            // wholesale would silently extend terminal-marker relief to SQLite
            // mode as an unreviewed side effect. The explicit lease-fields object
            // below passes pending_notes ONLY under FileHandoffStorage; SQLite
            // inputs stay byte-for-byte what they were pre-E13 (TTL-bounded only,
            // spec AC4). NOT in transitions.ts (that stays pure / fs-free;
            // mirrors SCOPE_DECISION_REQUIRED).
            const leaseFields = prevState
                ? {
                    active_feature: prevState.active_feature,
                    status: prevState.status,
                    last_updated: prevState.last_updated,
                    last_agent: prevState.last_agent,
                    next_role: prevState.next_role,
                    // E13: file-mode only — undefined for SQLite/HTTP storage.
                    pending_notes: storage instanceof FileHandoffStorage
                        ? prevState.pending_notes
                        : undefined,
                }
                : null;
            if (leaseFields && isFeatureLeaseHeld(leaseFields, parsed.active_feature, Date.now(), LEASE_TTL_MIN)) {
                // E10 (e10-lease-override, AC1/AC2) — human-attested override,
                // file-mode only (AC9: SQLite ignores lease_override and falls
                // through to the unchanged FEATURE_LEASE_HELD reject). Classified
                // from the INCOMING tool args (transient, write-scoped — AC3); the
                // audit gate lives INSIDE this lease-held branch by design (DR-3:
                // an override with nothing to bypass is inert, so an unaudited
                // lease_override on an unheld lease is never rejected).
                const leaseFileMode = storage instanceof FileHandoffStorage;
                const overrideClass = classifyLeaseOverride(parsed);
                if (leaseFileMode && overrideClass === "audited") {
                    // BYPASS — fall through to the remaining gates; the lease-held
                    // rejection is suppressed for THIS write only.
                }
                else if (leaseFileMode && overrideClass === "unaudited") {
                    // AC2 — an unaudited bypass is rejected loud with its own code,
                    // never silently accepted and never silently downgraded to the
                    // plain FEATURE_LEASE_HELD envelope.
                    const hint = gate("LEASE_OVERRIDE_AUDIT_MISSING").hintStatic;
                    const envelope = {
                        error: "LEASE_OVERRIDE_AUDIT_MISSING",
                        attempted_feature: parsed.active_feature,
                        incumbent: {
                            active_feature: leaseFields.active_feature,
                            status: leaseFields.status,
                            last_updated: leaseFields.last_updated,
                            lease_ttl_min: LEASE_TTL_MIN,
                        },
                        hint,
                    };
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ LEASE_OVERRIDE_AUDIT_MISSING\n${JSON.stringify(envelope, null, 2)}`,
                            }],
                        isError: true,
                    };
                }
                else {
                    const hint = `Feature lease held by "${leaseFields.active_feature}" ` +
                        `(status=${leaseFields.status}, last_updated=${leaseFields.last_updated}, ` +
                        `TTL=${LEASE_TTL_MIN}min). ` +
                        gate("FEATURE_LEASE_HELD").hintStatic;
                    const envelope = {
                        error: "FEATURE_LEASE_HELD",
                        attempted: {
                            prev_agent: prevTuple.agent,
                            prev_status: prevTuple.status,
                            new_agent: nextTuple.agent,
                            new_status: nextTuple.status,
                        },
                        incumbent: {
                            active_feature: leaseFields.active_feature,
                            status: leaseFields.status,
                            last_updated: leaseFields.last_updated,
                            lease_ttl_min: LEASE_TTL_MIN,
                        },
                        attempted_feature: parsed.active_feature,
                        hint,
                    };
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ FEATURE_LEASE_HELD\n${JSON.stringify(envelope, null, 2)}`,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE",
        codes: ["BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE"],
        run: (ctx) => {
            const { parsed, storage, prevState, feature_changed } = ctx;
            // E10 (e10-lease-override, AC6) — bookkeeping-write same-feature
            // restriction, immediately after the lease block. Inline (DR-4): a
            // one-line comparison the orchestrator already computed
            // (feature_changed, line ~117) needs no predicate module. Guarded by
            // prevState so a fresh workspace is INERT, not rejected
            // (writeHandoffState's same-feature guard falls through to now()
            // there). File-mode only (AC9). Rejecting — rather than silently
            // downgrading to a normal refreshed write — closes the footgun where
            // marking a brand-new feature's own claim as "bookkeeping" would make
            // its lease look artificially pre-aged (the E1/E1A clobber race).
            if (storage instanceof FileHandoffStorage &&
                parsed.bookkeeping_write === true &&
                prevState &&
                feature_changed) {
                const hint = gate("BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE").hintStatic;
                const envelope = {
                    error: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE",
                    attempted_feature: parsed.active_feature,
                    incumbent: {
                        active_feature: prevState.active_feature,
                        status: prevState.status,
                        last_updated: prevState.last_updated,
                    },
                    hint,
                };
                return {
                    content: [{
                            type: "text",
                            text: `⛔ BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE\n${JSON.stringify(envelope, null, 2)}`,
                        }],
                    isError: true,
                };
            }
            return null;
        },
    },
    {
        name: "SCOPE_DECISION_REQUIRED",
        codes: ["SCOPE_DECISION_REQUIRED"],
        run: (ctx) => {
            const { parsed, prevState, prevTuple, nextTuple } = ctx;
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
                    const hint = gate("SCOPE_DECISION_REQUIRED").hintStatic;
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
            return null;
        },
    },
    {
        name: "CUT_APPROVAL_REQUIRED",
        codes: ["CUT_APPROVAL_REQUIRED"],
        run: (ctx) => {
            const { prevState, prevTuple, nextTuple } = ctx;
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
                    const hint = gate("CUT_APPROVAL_REQUIRED").hintStatic;
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
            return null;
        },
    },
    {
        name: "EXTERNAL_REFS_UNRESOLVED",
        codes: ["EXTERNAL_REFS_UNRESOLVED"],
        run: (ctx) => {
            const { prevState, prevTuple, nextTuple } = ctx;
            // v6 — External-Refs Gate (b8-external-ref-ledger). THIRD build-entry
            // attestation gate, back-to-back after scope-decision and cut-approval
            // on the same pm:In_Progress → {architect,sr-engineer}:In_Progress edge.
            // Unconditional (not arm-gated on design mode); the gate only FIRES when
            // the prev state's external_refs ledger carries >=1 entry with
            // state === "unresolved". INVERSE polarity to cut_approved (DR-3):
            // absence / empty / all-resolved falls straight through (AC-2) —
            // absence means "PM's Resource Audit Gate found zero external refs".
            // Pinning prev=pm keeps resume/re-entry safe (AC-3): architect→sr and
            // the sr self-loop have a non-pm predecessor and are never re-blocked
            // by a ledger populated on an earlier PM write. FILE-MODE ONLY (AC-5):
            // external_refs lives in the handoff YAML frontmatter only; in
            // SQLite/HTTP mode prevState never carries it, so skip explicitly
            // rather than gate on an always-empty read. NOT in transitions.ts
            // (that stays pure / fs-free; mirrors CUT_APPROVAL_REQUIRED).
            if (getActiveStorage() instanceof FileHandoffStorage &&
                (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
                nextTuple.status === "In_Progress" &&
                prevTuple.agent === "pm" &&
                prevTuple.status === "In_Progress") {
                if (hasUnresolvedRefs(prevState)) {
                    const refs = listUnresolvedRefs(prevState).join(", ");
                    const hint = `External reference(s) unresolved: ${refs}.` +
                        gate("EXTERNAL_REFS_UNRESOLVED").hintStatic;
                    const envelope = {
                        error: "EXTERNAL_REFS_UNRESOLVED",
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
                                text: `⛔ EXTERNAL_REFS_UNRESOLVED\n${JSON.stringify(envelope, null, 2)}`,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "SOURCE_CREDIBILITY_UNVERIFIED",
        codes: ["SOURCE_CREDIBILITY_UNVERIFIED"],
        run: (ctx) => {
            const { parsed, prevTuple, nextTuple } = ctx;
            // E4 — Source-Credibility Gate (e4-design-source-credibility-gate). FOURTH
            // build-entry attestation gate on the pm:In_Progress -> {architect,sr-engineer}
            // :In_Progress edge, after scope-decision / cut-approval / external-refs.
            // UNLIKE those three (file-mode only, read handoff YAML), this gate reads
            // design/<feature>.md directly via fs, so it is STORAGE-MODE-AGNOSTIC (AC-7) —
            // NO `getActiveStorage() instanceof FileHandoffStorage` guard. Arm is the
            // fetch-based-mode INCLUSION list inside checkSourceCredibility, NOT the broad
            // hasDesignModeRequiringVisual exclusion. Pinned to prev=pm keeps resume/re-entry
            // safe (AC-6): architect->sr-engineer and the sr self-loop have a non-pm
            // predecessor and are never gated. NOT in transitions.ts (that stays pure /
            // fs-free; mirrors SCOPE_DECISION_REQUIRED). Independent of the PASS-time
            // baseline-manifest gates (AC-5): different edge, different check.
            if ((nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
                nextTuple.status === "In_Progress" &&
                prevTuple.agent === "pm" &&
                prevTuple.status === "In_Progress") {
                const cred = checkSourceCredibility(parsed.workspace_path, parsed.active_feature);
                if (!cred.ok) {
                    const rows = cred.offendingRows.join(", ");
                    const hint = `Source-credibility attestation missing or unverified for: ${rows}.` +
                        gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic;
                    const envelope = {
                        error: "SOURCE_CREDIBILITY_UNVERIFIED",
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
                                text: `⛔ SOURCE_CREDIBILITY_UNVERIFIED\n${JSON.stringify(envelope, null, 2)}`,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "REPRO_MANIFEST_MISSING",
        codes: ["REPRO_MANIFEST_MISSING"],
        run: (ctx) => {
            const { parsed, storage, prevState, prevTuple, nextTuple } = ctx;
            // E2 — Repro-First Gate (e2-bugfix-repro-gate, AC2/AC6). Bugfix-mode
            // only. Fires on the fix-phase handoff sr-engineer:In_Progress →
            // code-reviewer:In_Progress when the incumbent feature is
            // dispatch_mode="bugfix" but no repro manifest
            // (qa_reports/expected-red_<feature>.txt) exists. Blocks the write —
            // never a silent skip, never a throw (AC6). The Blocked escape edge
            // (sr-engineer → pm) is NOT keyed here, so escalation is always
            // available. Reuses the existing hasExpectedRedManifest() predicate —
            // a repro test is a "declared red" recorded in the same C15 manifest
            // (DR-2), no new file, no new predicate. FILE-MODE ONLY: the manifest
            // is a qa_reports/ file convention and dispatch_mode lives in the
            // handoff YAML frontmatter only (SQLite never carries it) — so gate
            // only under FileHandoffStorage, mirroring the cut-approval /
            // external-refs / expected-red guards. Placed AFTER the external-refs
            // gate and BEFORE the review-verdict/status-mismatch gate: a disjoint
            // edge (sr→code-reviewer, not pm→build), so it reorders no existing
            // gate; check order stays frozen-additive. NOT in transitions.ts (this
            // plain-text gate family is not in the TransitionRejection union —
            // DR-5).
            if (storage instanceof FileHandoffStorage &&
                prevState?.dispatch_mode === "bugfix" &&
                prevTuple.agent === "sr-engineer" &&
                prevTuple.status === "In_Progress" &&
                nextTuple.agent === "code-reviewer" &&
                nextTuple.status === "In_Progress") {
                const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
                if (!manifest.present) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ REPRO_MANIFEST_MISSING: ${parsed.active_feature}. ` +
                                    `Expected repro manifest at ${manifest.manifestPath}. ` +
                                    gate("REPRO_MANIFEST_MISSING").hintStatic,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "REVIEW_VERDICT_STATUS_MISMATCH",
        codes: ["REVIEW_VERDICT_STATUS_MISMATCH"],
        run: (ctx) => {
            const { parsed } = ctx;
            // v7 — Review-Verdict/Status Mismatch Gate (c9-protocol-fields AC-5).
            // Plain-text envelope, modeled on MISSING_EVIDENCE /
            // MISSING_REVIEW_EVIDENCE (DR-3): NOT threaded through
            // TransitionRejection["error"] (that union stays at 13 members).
            // Fires ONLY when a code-reviewer write carries a review_verdict AND
            // it disagrees with status — absence never fires (a code-reviewer
            // FAIL write with no verdict field is legal). Polarity (DR-8):
            // APPROVED pairs with In_Progress (code-reviewer:In_Progress → qa);
            // CHANGES_REQUESTED pairs with FAIL (code-reviewer:FAIL → sr) —
            // matches the existing transition matrix + review_round semantics.
            // Keys only on the INCOMING write args, so it is storage-agnostic
            // (DR-5) — no FileHandoffStorage guard, unlike cut-approval /
            // external-refs which read prev-state from disk.
            if (parsed.agent_id === "code-reviewer" && parsed.review_verdict) {
                const mismatch = (parsed.review_verdict === "APPROVED" && parsed.status !== "In_Progress") ||
                    (parsed.review_verdict === "CHANGES_REQUESTED" && parsed.status !== "FAIL");
                if (mismatch) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ REVIEW_VERDICT_STATUS_MISMATCH: review_verdict=${parsed.review_verdict} ` +
                                    `with status=${parsed.status}. ` +
                                    gate("REVIEW_VERDICT_STATUS_MISMATCH").hintStatic,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "REVIEWER_COMPLETED_TASKS_REJECTED",
        codes: ["REVIEWER_COMPLETED_TASKS_REJECTED"],
        run: (ctx) => {
            const { parsed } = ctx;
            // v3.58.0 — Reviewer completed_tasks Gate (c16-c10-role-boundary AC-3).
            // Sibling of REVIEW_VERDICT_STATUS_MISMATCH above — same family:
            // plain-text envelope, keys ONLY on the incoming parsed args (no
            // FileHandoffStorage guard, so it applies uniformly in file mode AND
            // SQLite/HTTP mode). Fires on ANY code-reviewer-stamped write carrying
            // a non-empty completed_tasks (the C16 ledger-pollution class: the
            // CHANGES_REQUESTED row feeds no gate — MISSING_REVIEW_EVIDENCE only
            // reads the manifest when nextTuple.agent === "qa-engineer"). The
            // legitimate uses are untouched: the APPROVED row stamps
            // agent_id="qa-engineer" with the review scope in the transient
            // review_task_ids field (c16 amendment, E32 — completed_tasks stays
            // empty there; growth is rejected by QA_COMPLETION_EVIDENCE_MISSING
            // below), and the Phase-2 claim write carries completed_tasks=[]
            // (zod default) so it never fires.
            if (parsed.agent_id === "code-reviewer" && parsed.completed_tasks.length > 0) {
                return {
                    content: [{
                            type: "text",
                            text: `⛔ REVIEWER_COMPLETED_TASKS_REJECTED: completed_tasks=` +
                                `[${parsed.completed_tasks.join(", ")}] on an agent_id=code-reviewer write. ` +
                                gate("REVIEWER_COMPLETED_TASKS_REJECTED").hintStatic,
                        }],
                    isError: true,
                };
            }
            return null;
        },
    },
    {
        name: "QA_REVIEW_RECORD",
        codes: ["QA_REVIEW_TARGET_REQUIRED"],
        run: async (ctx) => {
            const { parsed, storage } = ctx;
            // Evidence record FIRST so the PASS gate below can observe the row /
            // file just written. Only fires when QA attaches qa_review on a
            // PASS or FAIL write.
            // d9-qa-review-scoped-append — scoped target resolution: the review
            // stamp lands on review_task_ids (if non-empty), else completed_tasks
            // (the unchanged PASS back-compat path, AC2). The former "every
            // incomplete task in the workspace" fallback is DELETED (AC1): it
            // fired on every FAIL write (completed_tasks is legitimately empty
            // there per the Escalation call format) and fanned the stamp into
            // every open task's evidence file — the D8 incident polluted 11
            // unrelated review files. Both empty now rejects loud with
            // QA_REVIEW_TARGET_REQUIRED before anything is recorded (AC3) —
            // never forge evidence, never silently drop it. Keys ONLY on the
            // incoming parsed args, so it is storage-agnostic (file + SQLite).
            if (parsed.qa_review &&
                parsed.agent_id === "qa-engineer" &&
                (parsed.status === "PASS" || parsed.status === "FAIL")) {
                const ids = parsed.review_task_ids && parsed.review_task_ids.length > 0
                    ? parsed.review_task_ids
                    : parsed.completed_tasks;
                if (ids.length === 0) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ QA_REVIEW_TARGET_REQUIRED: qa_review on a ${parsed.status} write with ` +
                                    `review_task_ids and completed_tasks both empty. ` +
                                    gate("QA_REVIEW_TARGET_REQUIRED").hintStatic,
                            }],
                        isError: true,
                    };
                }
                await storage.recordReview(parsed.workspace_path, ids, parsed.status, "qa-engineer", parsed.qa_review);
            }
            return null;
        },
    },
    {
        name: "QA_COMPLETION_EVIDENCE_MISSING",
        codes: ["QA_COMPLETION_EVIDENCE_MISSING"],
        run: (ctx) => {
            const { parsed, storage, prevState } = ctx;
            // E18 — QA Completion-Evidence Gate (e18-write-provenance, fix b).
            // Closes the identity-swap side door REVIEWER_COMPLETED_TASKS_REJECTED
            // cannot see (E5 incident: a code-reviewer subagent made a SECOND
            // write stamped agent_id="qa-engineer", pre-filling completed_tasks
            // before any qa-engineer ran, with zero evidence on disk — the
            // borrowed agent_id bypassed the reviewer gate entirely). Any
            // qa-engineer-stamped write whose completed_tasks adds ids NOT
            // already in the on-disk handoff's completed set must have per-id QA
            // evidence on disk via the existing gates/qa-review.ts convention
            // (hasEvidenceInFile — reused, not forked; per-id file OR covers:
            // coverage). Set-difference scoping keeps the legitimate cumulative
            // flow intact: ids already on disk need no re-evidence when qa passes
            // the full list back. Placed AFTER the qa_review auto-record above —
            // deliberately, mirroring how the PASS MISSING_EVIDENCE gate observes
            // the row just written — so a legitimate PASS/FAIL write carrying
            // qa_review satisfies this gate with its own just-recorded evidence;
            // an evidence-less pre-fill (the incident shape: In_Progress, no
            // qa_review) has nothing on disk and is rejected naming the ids.
            // NO EXEMPTIONS — c16 contract amendment (E32, e32-e33-gate-hardening,
            // review round 1 finding C1/C2 + PM re-scope option A). The gate as
            // shipped exempted the sanctioned APPROVED-row handoff
            // (code-reviewer:In_Progress → qa-engineer:In_Progress), whose
            // completed_tasks was the c16 review-scope manifest. That exemption
            // WAS the hole: the fourth E9A/E18-class incident (2026-07-16,
            // e-p3-tail-batch) rode it with a write byte-identical to the
            // sanctioned shape — no predicate can distinguish a forged manifest
            // write from a real one because they are the same write, and the
            // persisted ids then poisoned the on-disk baseline so any later
            // carry-forward of them was ungated (two-step evasion). The contract
            // is amended instead of the predicate: review scope on an APPROVED
            // handoff travels ONLY in the transient review_task_ids field (per
            // skill-code-reviewer.md; MISSING_REVIEW_EVIDENCE below now reads it),
            // and completed_tasks on ANY agent_id=qa-engineer write is reserved
            // for evidence-backed QA completions. So: ANY qa-engineer-stamped
            // write that GROWS completed_tasks vs the on-disk prior set without
            // per-id QA evidence is rejected, unconditionally — regardless of
            // status, review_verdict, or the previous tuple. Carry-forward (no
            // new ids) never gates BY DESIGN — ledgers already poisoned by
            // pre-amendment manifest writes are documented (docs/backlog.md E32),
            // not chased. bookkeeping_write touches don't grow the ledger; non-qa
            // identities are REVIEWER_COMPLETED_TASKS_REJECTED's jurisdiction.
            // tw_complete_task is untouched (its own evidence path). No prevState
            // guard: on a brand-new workspace EVERY claimed id is new, and a
            // first-write completion claim with no evidence is exactly the class
            // this gate exists to reject. FILE-MODE ONLY, matching the sibling
            // attestation gates (SQLite's hasEvidence path is reports-row-based
            // and out of scope).
            if (storage instanceof FileHandoffStorage &&
                parsed.agent_id === "qa-engineer" &&
                parsed.completed_tasks.length > 0) {
                const onDiskCompleted = new Set(prevState?.completed_tasks ?? []);
                const newIds = parsed.completed_tasks.filter((id) => !onDiskCompleted.has(id));
                if (newIds.length > 0) {
                    const ev = hasEvidenceInFile(parsed.workspace_path, newIds);
                    if (ev.missing.length > 0) {
                        // E32 (E23 named-path posture): name the exact expected
                        // evidence file per offending id — the same sanitised path
                        // hasEvidenceInFile checked — plus the covers: fallback, so
                        // the writer knows precisely which artifact clears the gate
                        // (mirrors VISUAL_EVIDENCE_MISSING's expectedPaths listing).
                        const expectedPaths = ev.missing
                            .map((id) => qaEvidencePath(parsed.workspace_path, id))
                            .join(", ");
                        return {
                            content: [{
                                    type: "text",
                                    text: `⛔ QA_COMPLETION_EVIDENCE_MISSING: ${ev.missing.join(", ")}. ` +
                                        `Expected evidence file(s): ${expectedPaths} ` +
                                        `(or an existing qa_reports/ report covering the id via a covers: line). ` +
                                        gate("QA_COMPLETION_EVIDENCE_MISSING").hintStatic,
                                }],
                            isError: true,
                        };
                    }
                }
            }
            return null;
        },
    },
    {
        name: "PASS_MISSING_EVIDENCE",
        codes: ["MISSING_EVIDENCE"],
        run: async (ctx) => {
            const { parsed, storage } = ctx;
            // Evidence gate for PASS path
            if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
                const ev = await storage.hasEvidence(parsed.workspace_path, parsed.completed_tasks);
                if (ev.missing.length > 0) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. ${gate("MISSING_EVIDENCE").hintStatic}`,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
    {
        name: "PASS_VISUAL_SUBGATES",
        codes: ["VISUAL_BASELINES_REQUIRED", "VISUAL_EVIDENCE_MISSING", "VISUAL_WIDGETS_UNVERIFIED", "VISUAL_ASSERTIONS_REQUIRED", "VISUAL_REPORT_INCOMPLETE", "VISUAL_PROVENANCE_MISSING", "BASELINE_MANIFEST_MISSING", "BASELINE_PROVENANCE_INCOMPLETE", "PIXEL_GATE_ATTESTATION_MISSING"],
        run: (ctx) => {
            const { parsed, evidenceSchemaPin, evidenceSchemaLabel } = ctx;
            if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
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
                                    gate("VISUAL_BASELINES_REQUIRED").hintStatic,
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
                        // E23 (D3): name the exact expected file path per missing id and
                        // the evidence-schema version the check ran under (existence
                        // check — the version is context, not a matcher input here).
                        const expectedPaths = visEv.missing
                            .map((id) => visualEvidencePath(parsed.workspace_path, id))
                            .join(", ");
                        return {
                            content: [{
                                    type: "text",
                                    text: `⛔ VISUAL_EVIDENCE_MISSING: ${visEv.missing.join(", ")}. ` +
                                        `design/<feature>.md declares ## Visual Baselines (at ${visualGate.designPath}) ` +
                                        `but qa_reports/visual_<task-id>.md is absent for the listed task(s). ` +
                                        `Expected file(s): ${expectedPaths}. ` +
                                        `Evidence schema: ${evidenceSchemaLabel}. ` +
                                        gate("VISUAL_EVIDENCE_MISSING").hintStatic,
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
                                        gate("VISUAL_WIDGETS_UNVERIFIED").hintStatic,
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
                                            `Assertions is absent. ` +
                                            gate("VISUAL_ASSERTIONS_REQUIRED").hintStatic,
                                    }],
                                isError: true,
                            };
                        }
                        // E23 (D2): the report validator runs under the feature's pinned
                        // evidence schema — pin 1 replays the exact-anchored heading
                        // match; pin >=2 / absent uses normalized-contains.
                        const schema = validateVisualReports(parsed.workspace_path, parsed.completed_tasks, evidenceSchemaPin);
                        if (!schema.ok) {
                            // E23 (D3): each failing task names the exact missing section
                            // heading(s) / failed row(s), the report file path checked,
                            // and (below) the evidence-schema version the check ran under.
                            const listing = Object.entries(schema.byTaskId)
                                .map(([taskId, v]) => {
                                const reasons = [];
                                if (v.missingSections.length)
                                    reasons.push(`missing section(s): ${v.missingSections.map((s) => `## ${s}`).join(", ")}`);
                                if (v.failedCanonicalStates.length)
                                    reasons.push(`canonical-state fail: ${v.failedCanonicalStates.join("/")}`);
                                if (v.failedStructuralAssertions.length)
                                    reasons.push(`structural fail: ${v.failedStructuralAssertions.join("/")}`);
                                if (v.failedRegionDiffs.length)
                                    reasons.push(`region-diff fail: ${v.failedRegionDiffs.join("/")}`);
                                if (!v.verdictPass)
                                    reasons.push("verdict != PASS");
                                return `${taskId} (at ${visualEvidencePath(parsed.workspace_path, taskId)}) {${reasons.join("; ")}}`;
                            })
                                .join(" | ");
                            return {
                                content: [{
                                        type: "text",
                                        text: `⛔ VISUAL_REPORT_INCOMPLETE: ${listing}. ` +
                                            `Evidence schema: ${evidenceSchemaLabel}. ` +
                                            gate("VISUAL_REPORT_INCOMPLETE").hintStatic,
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
                                        text: `⛔ VISUAL_PROVENANCE_MISSING: ${listing}. ` +
                                            gate("VISUAL_PROVENANCE_MISSING").hintStatic,
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
                                ? gate("BASELINE_MANIFEST_MISSING").hintStatic
                                : gate("BASELINE_PROVENANCE_INCOMPLETE").hintStatic;
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
                                        text: `⛔ PIXEL_GATE_ATTESTATION_MISSING: ${listing}. ` +
                                            gate("PIXEL_GATE_ATTESTATION_MISSING").hintStatic,
                                    }],
                                isError: true,
                            };
                        }
                    }
                }
            }
            return null;
        },
    },
    {
        name: "PASS_EXPECTED_RED_DIFF",
        codes: ["EXPECTED_RED_DIFF_MISSING"],
        run: (ctx) => {
            const { parsed, storage } = ctx;
            if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
                // v3.57.0 — Expected-Red Diff gate (c15-expected-red-manifest, AC-4).
                // Mirrors VISUAL_EVIDENCE_MISSING's arming polarity: dormant unless
                // sr-engineer declared qa_reports/expected-red_<feature>.txt (absence
                // = "no expected reds", zero cost — the external_refs/dispatch_pins
                // precedent). When armed, at least ONE qa_reports/review_<id>.md for
                // the PASS'd ids (or a file covering one of them via the c3 covers:
                // convention) must contain a ## Expected-Red Diff H2 recording QA's
                // Phase 0.5 suite-vs-manifest diff disposition. Existence-of-section
                // only — the server does NOT run the test suite or validate the diff
                // content (same trust boundary as MISSING_EVIDENCE). FILE-MODE ONLY
                // (AC-5): the manifest is a qa_reports/ file convention; SQLite/HTTP
                // mode has no equivalent — skip explicitly, mirroring the
                // cut-approval / external-refs guards.
                if (storage instanceof FileHandoffStorage) {
                    const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
                    if (manifest.present) {
                        const disposition = hasExpectedRedDisposition(parsed.workspace_path, parsed.completed_tasks);
                        if (!disposition.present) {
                            return {
                                content: [{
                                        type: "text",
                                        text: `⛔ EXPECTED_RED_DIFF_MISSING: ${parsed.completed_tasks.join(", ")}. ` +
                                            `Expected-red manifest exists (at ${manifest.manifestPath}) but no ` +
                                            `## Expected-Red Diff section was found for the listed task(s). ` +
                                            gate("EXPECTED_RED_DIFF_MISSING").hintStatic,
                                    }],
                                isError: true,
                            };
                        }
                    }
                }
            }
            return null;
        },
    },
    {
        name: "PASS_AC_EXECUTION_LOG",
        codes: ["AC_EXECUTION_LOG_MISSING"],
        run: (ctx) => {
            const { parsed, storage, evidenceSchemaPin, evidenceSchemaLabel } = ctx;
            if (parsed.status === "PASS" && parsed.completed_tasks.length > 0) {
                // E3 — AC-Execution-Log gate (e3-outcome-shaped-acceptance, AC4/AC5). Sibling
                // of EXPECTED_RED_DIFF_MISSING: arms on spec content (≥1 proof: AC), clears on a
                // `## AC Execution Log` H2 in a PASS'd review file (or a covers: file).
                // Existence-only trust boundary. FILE-MODE ONLY.
                if (storage instanceof FileHandoffStorage) {
                    const arm = hasProofAnnotatedAC(parsed.workspace_path, parsed.active_feature);
                    if (arm.armed) {
                        // E23 (D2): the disposition heading match runs under the
                        // feature's pinned evidence schema — under pin >=2 / absent,
                        // `## Phase 3.5 — AC Execution Log` (the 104447-F0 incident
                        // heading) clears; pin 1 keeps the exact anchor.
                        const disposition = hasAcExecutionLogDisposition(parsed.workspace_path, parsed.completed_tasks, evidenceSchemaPin);
                        if (!disposition.present) {
                            // E23 (D3): name the expected heading, every review file path
                            // inspected, and the evidence-schema version the check ran
                            // under (pre-E23 this envelope listed task ids only).
                            const inspected = disposition.checkedPaths.length > 0
                                ? disposition.checkedPaths.join(", ")
                                : "(none — no review file resolved for the listed task(s))";
                            return {
                                content: [{ type: "text",
                                        text: `⛔ AC_EXECUTION_LOG_MISSING: ${parsed.completed_tasks.join(", ")}. ` +
                                            `Spec ${arm.specPath} declares ≥1 proof:-annotated AC but no ` +
                                            `## AC Execution Log section was found for the listed task(s). ` +
                                            `Expected heading: "## AC Execution Log". ` +
                                            `Inspected: ${inspected}. ` +
                                            `Evidence schema: ${evidenceSchemaLabel}. ` +
                                            gate("AC_EXECUTION_LOG_MISSING").hintStatic, }],
                                isError: true,
                            };
                        }
                    }
                }
            }
            return null;
        },
    },
    {
        name: "MISSING_REVIEW_EVIDENCE",
        codes: ["MISSING_REVIEW_EVIDENCE"],
        run: async (ctx) => {
            const { parsed, storage, prevTuple, nextTuple } = ctx;
            // Code-reviewer evidence gate. Mirrors the PASS gate above for the
            // sr ↔ code-reviewer → qa handoff. Only fires when the previous tuple
            // is (code-reviewer, In_Progress) AND the next tuple hands off to qa.
            // c16 amendment (E32, e32-e33-gate-hardening): the review-scope
            // manifest travels in the transient review_task_ids field —
            // completed_tasks on the APPROVED handoff is retired (any growth
            // there is rejected upstream by QA_COMPLETION_EVIDENCE_MISSING).
            // Resolution mirrors the d9 qa_review rule: review_task_ids if
            // non-empty, else completed_tasks (carry-forward ids on a legacy-
            // shaped write still get review-evidence-checked here).
            const reviewScopeIds = parsed.review_task_ids && parsed.review_task_ids.length > 0
                ? parsed.review_task_ids
                : parsed.completed_tasks;
            if (prevTuple.agent === "code-reviewer" &&
                prevTuple.status === "In_Progress" &&
                nextTuple.agent === "qa-engineer" &&
                nextTuple.status === "In_Progress" &&
                reviewScopeIds.length > 0) {
                const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, reviewScopeIds);
                if (ev.missing.length > 0) {
                    return {
                        content: [{
                                type: "text",
                                text: `⛔ MISSING_REVIEW_EVIDENCE: ${ev.missing.join(", ")}. ` +
                                    gate("MISSING_REVIEW_EVIDENCE").hintStatic,
                            }],
                        isError: true,
                    };
                }
            }
            return null;
        },
    },
];
// --- GUARDED: must call tw_get_state first ---
async function handleUpdateStateCore(parsed) {
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
    // v9 (d2-server-brake-accounting) — hop-cap inputs, derived HERE so
    // transitions.ts stays pure / fs-free (it never reads active_feature
    // itself, only the boolean computed from prevState + the incoming
    // write). No prevState (fresh workspace) counts as a feature change:
    // the counter starts from a 0 base either way.
    const prev_hop_count = prevState?.hop_count ?? 0;
    // v12 (e8-success-telemetry) — cumulative-total inputs, same derivation
    // posture as prev_hop_count: transitions.ts stays pure / fs-free; the
    // orchestrator reads the persisted totals and threads them through.
    // File-mode-only fields (DR-1): SqliteHandoffStorage.parse never
    // constructs them, so `?? 0` keeps SQLite mode at a harmless 0 base.
    const prev_qa_rounds_total = prevState?.qa_rounds_total ?? 0;
    const prev_review_rounds_total = prevState?.review_rounds_total ?? 0;
    const prev_visual_rounds_total = prevState?.visual_rounds_total ?? 0;
    const feature_changed = prevState
        ? prevState.active_feature !== parsed.active_feature
        : true;
    // E23 (e23-evidence-schema-versioning, D1/D2) — evidence-schema pin
    // resolution. Same-feature writes run the evidence gates under the
    // feature's persisted pin (absent for pre-E23 in-flight features →
    // the v2 normalized-contains default, D2 fallback). A feature-change
    // write IS the stamping write: its checks run under
    // EVIDENCE_SCHEMA_CURRENT, the exact value stamped below. NEVER
    // client-supplied — resolved purely from prevState + feature_changed
    // (AC6: no new zod arg on tw_update_state).
    const evidenceSchemaPin = feature_changed
        ? EVIDENCE_SCHEMA_CURRENT
        : prevState?.evidence_schema;
    // D3 — the version string the rejection envelopes cite. An absent pin
    // is named as such (not silently rendered as v2) so the reader knows
    // the feature predates pinning and got the default.
    const evidenceSchemaLabel = evidenceSchemaPin !== undefined
        ? `v${evidenceSchemaPin}`
        : "absent pin (v2 normalized-contains default)";
    const prevTuple = {
        agent: prevState?.last_agent ?? null,
        status: prevState?.status ?? null,
    };
    const nextTuple = {
        agent: parsed.agent_id ?? null,
        status: parsed.status,
    };
    // E35 (e35-gate-pipeline-extraction) — everything above this line is
    // the ctx-building phase: prev-state derivation, round/hop inputs,
    // feature_changed, and the evidence-schema pin are resolved ONCE
    // here, never inside a gate step. The pipeline then runs the frozen
    // check order as data; the first rejection's envelope is returned
    // unchanged (byte-identical to the pre-E35 inline emits).
    const ctx = {
        parsed,
        storage,
        prevState,
        prevTuple,
        nextTuple,
        prev_qa_round,
        prev_review_round,
        prev_visual_round,
        prev_hop_count,
        feature_changed,
        evidenceSchemaPin,
        evidenceSchemaLabel,
    };
    const pipelineRejection = await runUpdateStatePipeline(UPDATE_STATE_GATE_PIPELINE, ctx);
    if (pipelineRejection) {
        return pipelineRejection;
    }
    const { qa_round: new_qa_round, review_round: new_review_round, visual_round: new_visual_round, 
    // v9 — server-computed hop counter (DR-9: +1 on role transitions
    // only; DR-6: reset only on feature change, pm landing does NOT
    // reset). Persisted via storage.writeState below.
    hop_count: new_hop_count, 
    // v12 — cumulative per-feature totals (e8-success-telemetry). Tick in
    // lock-step with the per-cycle FAIL branches inside computeNewRound;
    // reset ONLY on feature change (hop_count's rule). Persisted via
    // storage.writeState below (file-mode frontmatter only, DR-1).
    qa_rounds_total: new_qa_rounds_total, review_rounds_total: new_review_rounds_total, visual_rounds_total: new_visual_rounds_total, } = computeNewRound(prev_qa_round, prev_review_round, prev_visual_round, nextTuple, prevTuple, parsed.pending_notes, prev_hop_count, feature_changed, prev_qa_rounds_total, prev_review_rounds_total, prev_visual_rounds_total);
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
    // v9 (d2-server-brake-accounting) — hop-cap-cross sentinel. Same
    // `new >= cap && prev < cap` predicate as the three round sentinels
    // above: fires exactly once per cap-cross from any prior value. This
    // write itself is still accepted (the counter only REACHED cap here);
    // the NEXT counted role transition trips HOP_CAP_EXCEEDED in
    // validateTransition, which admits only the (pm, In_Progress) landing
    // — and that landing does NOT reset hop_count (DR-6): only an
    // active_feature change does.
    if (new_hop_count >= HOP_CAP_EXPORTED && prev_hop_count < HOP_CAP_EXPORTED) {
        pending.unshift(`⛔ Hop cap reached (hop_count=${new_hop_count}/${HOP_CAP_EXPORTED}): ` +
            "next role transition will be rejected (HOP_CAP_EXCEEDED) — only (pm, In_Progress) may land. " +
            "Halt autonomous dispatch and surface to human; only an active_feature change resets the counter.");
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
        // v9 — server-computed hop counter; persisted in BOTH storage modes
        // (file frontmatter + sqlite hop_count column, DR-2) unlike the
        // file-mode-only attestation fields below.
        hopCount: new_hop_count,
        // v12 — cumulative totals (e8-success-telemetry). Server-computed by
        // computeNewRound alongside hop_count; persisted in file-mode
        // frontmatter ONLY (DR-1: SqliteHandoffStorage.writeState ignores
        // all three — their sole consumer, the release-close metrics emit,
        // fires only under FileHandoffStorage).
        qaRoundsTotal: new_qa_rounds_total,
        reviewRoundsTotal: new_review_rounds_total,
        visualRoundsTotal: new_visual_rounds_total,
        scopeDecision: parsed.scope_decision,
        scopeDecisionWhy: parsed.scope_decision_why,
        cutApproved: parsed.cut_approved,
        externalRefs: parsed.external_refs,
        // v7 — protocol fields (c9-protocol-fields). Transient, write-scoped
        // (AC-3): persisted only when set on this write. File-mode only
        // (DR-5): SqliteHandoffStorage.writeState ignores all three.
        nextRole: parsed.next_role,
        resumeOf: parsed.resume_of,
        reviewVerdict: parsed.review_verdict,
        // v8 — dispatch_pins (c14-dispatch-pins). Pass-through only:
        // advisory bookkeeping like next_role (AC-5) — NOT cross-checked
        // against ALLOWED_TRANSITIONS, no gate, no GateErrorCode. REPLACE
        // wholesale when provided; the feature-scoped carry-forward for
        // omitting writes lives in writeHandoffState. File-mode only:
        // SqliteHandoffStorage.writeState ignores it.
        dispatchPins: parsed.dispatch_pins,
        // v11 — dispatch_mode (e2-bugfix-repro-gate). Pass-through only:
        // feature-scoped scalar sibling of dispatchPins (carry-forward for
        // omitting writes lives in writeHandoffState). File-mode only:
        // SqliteHandoffStorage.writeState ignores it.
        dispatchMode: parsed.dispatch_mode,
        // v13 — evidence_schema server-stamp (e23-evidence-schema-versioning
        // D1). SET here on the first accepted write of a new active_feature
        // (feature_changed includes the fresh-workspace case); OMITTED on
        // same-feature writes so writeHandoffState's feature-scoped carry
        // preserves the existing pin verbatim — including its ABSENCE for
        // pre-E23 in-flight features (the migration invents no pin). Never
        // client-supplied: `parsed` has no such field (AC6 — the
        // tw_update_state zod surface is unchanged). File-mode only:
        // SqliteHandoffStorage.writeState ignores it.
        evidenceSchema: feature_changed ? EVIDENCE_SCHEMA_CURRENT : undefined,
        // E10 — bookkeeping-write attestation (e10-lease-override AC5).
        // Pass-through only: writeHandoffState's same-feature-guarded
        // preserve branch selects last_updated (DR-5 defense-in-depth);
        // the AC6 different-feature reject already fired above. TRANSIENT:
        // never persisted to frontmatter, no schema bump (DR-1). File-mode
        // only (AC9): SqliteHandoffStorage.writeState ignores it.
        bookkeepingWrite: parsed.bookkeeping_write,
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
    // E8 (e8-success-telemetry, T-E8-03) — release-close metrics emit.
    // Fires on the E1A terminal-marker signature (the same "feature has
    // shipped" predicate gates/feature-lease.ts trusts): release-engineer
    // closing self-loop routing back to pm. File-mode only (DR-1) — the
    // marker keys on next_role, which SqliteHandoffStorage never persists.
    // Totals are read from prevState (DR: the closing write is a
    // release-engineer self-loop, so computeNewRound carries them
    // unchanged — prevState is authoritative and already in scope).
    // emitFeatureMetrics never throws (AC2): the ToolResult below is
    // byte-identical with or without this hook.
    if (storage instanceof FileHandoffStorage &&
        parsed.agent_id === "release-engineer" &&
        parsed.status === "In_Progress" &&
        parsed.next_role === "pm") {
        emitFeatureMetrics({
            workspacePath: parsed.workspace_path,
            feature: parsed.active_feature,
            qaRoundsTotal: prevState?.qa_rounds_total ?? 0,
            reviewRoundsTotal: prevState?.review_rounds_total ?? 0,
            visualRoundsTotal: prevState?.visual_rounds_total ?? 0,
            hops: prevState?.hop_count ?? 0,
        });
    }
    // E28 — wholesale-replace shrink warning (dispatch_pins / external_refs).
    // Both fields REPLACE on write, so a writer that skips read-before-write
    // silently drops entries. When THIS write supplied one of them and the
    // supplied set DROPS any prior entry (same-feature writes only — a
    // feature change legitimately drops both feature-scoped fields),
    // append an advisory `warnings` array to the success envelope naming
    // the dropped entries. E33 (e32-e33-gate-hardening): detection is
    // ENTRY-IDENTITY diff — dispatch_pins by key set, external_refs by
    // ref string — not cardinality, so a same-count (or even growing)
    // entry SWAP that drops a prior entry warns too; the E28-as-shipped
    // `nextSize < prevLength` compare let equal-count swaps drop entries
    // silently. Warn-only by design: never rejects, no new arg, no schema
    // bump, and any failure here leaves the original envelope untouched
    // (the state write already succeeded). A pin whose VALUE changes but
    // whose key survives is NOT a drop (values are free-text tiers, and
    // re-pinning a role is the field's normal use); same for an
    // external_refs entry whose state advances under an unchanged ref.
    const shrinkWarnings = [];
    if (prevState && !feature_changed) {
        if (parsed.dispatch_pins) {
            const prevPinKeys = Object.keys(prevState.dispatch_pins ?? {});
            const nextPinKeys = new Set(Object.keys(parsed.dispatch_pins));
            const dropped = prevPinKeys.filter((k) => !nextPinKeys.has(k));
            if (dropped.length > 0) {
                shrinkWarnings.push(`dispatch_pins REPLACES wholesale, not merges: this write kept ` +
                    `${prevPinKeys.length - dropped.length} of ${prevPinKeys.length} prior entries — dropped: ` +
                    `${dropped.join(", ")}. If unintended, read the previous state and ` +
                    `re-write the FULL map including every still-wanted pin.`);
            }
        }
        if (parsed.external_refs) {
            const prevRefs = prevState.external_refs ?? [];
            const nextRefSet = new Set(parsed.external_refs.map((r) => r.ref));
            const dropped = prevRefs.filter((r) => !nextRefSet.has(r.ref)).map((r) => r.ref);
            if (dropped.length > 0) {
                shrinkWarnings.push(`external_refs REPLACES wholesale, not merges: this write kept ` +
                    `${prevRefs.length - dropped.length} of ${prevRefs.length} prior entries — dropped: ` +
                    `${dropped.join(", ")}. If unintended, read the previous state and ` +
                    `re-write the FULL ledger including every still-wanted entry.`);
            }
        }
    }
    let responseText = result;
    if (shrinkWarnings.length > 0) {
        try {
            const envelope = JSON.parse(result);
            envelope.warnings = [
                ...(Array.isArray(envelope.warnings) ? envelope.warnings : []),
                ...shrinkWarnings,
            ];
            responseText = JSON.stringify(envelope);
        }
        catch {
            // Advisory only — an unparseable success payload keeps its original text.
        }
    }
    return { content: [{ type: "text", text: responseText }] };
}
//# sourceMappingURL=handoff-orchestrator.js.map