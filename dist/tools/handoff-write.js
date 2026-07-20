// Coded by @sr-engineer
// Tools: handoff.md write responsibility (E36 — e36-handoff-split-overload-adapter).
// Extracted verbatim from tools/handoff.ts (pre-split writeHandoffState +
// WriteHandoffStateOptions, lines ~722-1270), which stays a thin barrel
// re-exporting this module's public surface so no importer churns. Kept
// SEPARATE from tools/handoff-parse.ts (the parse/migrate/read responsibility)
// per the split's stated goal.
//
// NOTE — deliberate circular import with tools/handoff-parse.ts: see the
// top-of-file note there. writeHandoffStateCore's existing-state preserve
// logic below calls parseHandoff (this module → handoff-parse.ts), and
// handoff-parse.ts's migration write-back heal calls writeHandoffState
// (handoff-parse.ts → this module). Both directions are ordinary runtime
// function calls, never read at module-init time, so the cycle is safe.
//
// Option-A adapter convergence (E36 part (b), human-approved, NON-breaking):
// writeHandoffStateCore(opts) is now the ONE real implementation, taking only
// the options-object shape. The exported writeHandoffState keeps BOTH public
// overload signatures (options-object preferred; the 12-positional overload
// stays @deprecated, removal deferred to v4.0.0 — NOT this ticket) but its
// body is now a thin ~10-line dispatcher: options-shaped input goes straight
// to writeHandoffStateCore; positional input is packed into a
// WriteHandoffStateOptions object first. No public signature changed.
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { verifyFreshness, refreshSnapshotFor, } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { CURRENT_VERSIONS } from "../schema/versions.js";
import { parseHandoff } from "./handoff-parse.js";
function getHandoffPath(workspacePath) {
    return path.join(workspacePath, ".current", "handoff.md");
}
function ensureDir(workspacePath) {
    const dir = path.join(workspacePath, ".current");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Real implementation (E36 Option-A convergence). Every writeHandoffState
 * call — options-object callers directly, positional callers via the thin
 * packing wrapper below — bottoms out here. Options-object shape ONLY: no
 * more first-arg discrimination inside the body.
 *
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
async function writeHandoffStateCore(opts) {
    const workspacePath = opts.workspacePath;
    const activeFeature = opts.activeFeature;
    const status = opts.status;
    const completedTasks = opts.completedTasks ?? [];
    const pendingNotes = opts.pendingNotes ?? [];
    const blockingReason = opts.blockingReason;
    const lastAgent = opts.lastAgent;
    const qaRound = opts.qaRound;
    const prdPath = opts.prdPath;
    const reviewRound = opts.reviewRound;
    const visualRound = opts.visualRound;
    const hopCount = opts.hopCount;
    const scopeDecision = opts.scopeDecision;
    const scopeDecisionWhy = opts.scopeDecisionWhy;
    const cutApproved = opts.cutApproved;
    // v6 — external_refs ledger. Options callers pass it explicitly or leave it
    // undefined (the same-feature preserve clause below carries any existing
    // ledger forward, DR-8).
    const externalRefs = opts.externalRefs;
    // v7 — protocol fields. Left undefined by callers that don't set them
    // (transient AC-3 semantics: an omitting write — including the
    // migration-heal write in tools/handoff-parse.ts — simply drops them).
    const nextRole = opts.nextRole;
    const resumeOf = opts.resumeOf;
    const reviewVerdict = opts.reviewVerdict;
    // v8 — dispatch_pins map. Left undefined by callers that don't set it (the
    // same-feature preserve clause below carries any existing pins forward,
    // mirroring external_refs' DR-8 posture).
    const dispatchPins = opts.dispatchPins;
    // v11 — dispatch_mode scalar. Left undefined by callers that don't set it
    // (the same-feature preserve clause below carries any existing value
    // forward, mirroring dispatch_pins' DR-8 posture).
    const dispatchMode = opts.dispatchMode;
    // v13 — evidence_schema pin. Undefined unless the orchestrator stamps it,
    // with the same-feature preserve clause carrying any existing pin forward.
    const evidenceSchema = opts.evidenceSchema;
    // v12 — cumulative round totals. Left undefined by the legacy positional
    // overload's packing (architecture DR: it deliberately does NOT grow); the
    // always-emit blocks below normalise undefined to 0.
    const qaRoundsTotal = opts.qaRoundsTotal;
    const reviewRoundsTotal = opts.reviewRoundsTotal;
    const visualRoundsTotal = opts.visualRoundsTotal;
    // E10 — bookkeeping-write attestation. Left undefined by the legacy
    // positional overload's packing (the heal-write call site always uses the
    // options object directly; a positional caller always gets the
    // fresh-stamp default).
    const bookkeepingWrite = opts.bookkeepingWrite;
    // Hoist required strings to the names the body below already uses.
    const _activeFeature = activeFeature;
    const _status = status;
    ensureDir(workspacePath);
    const handoffPath = getHandoffPath(workspacePath);
    const lockPath = path.join(workspacePath, ".current", ".handoff.lock");
    return withFileLock(lockPath, () => {
        // Reject if another process / hand-edit touched the file since we read it.
        verifyFreshness(workspacePath, handoffPath, "handoff");
        const now = new Date().toISOString();
        const completedList = completedTasks.length
            ? completedTasks.map((t) => `- [x] ${t}`).join("\n")
            : "- (none)";
        // Plain list items (no checkbox) so they are visually distinct from task IDs.
        const pendingList = pendingNotes.length
            ? pendingNotes.map((t) => `- ${t}`).join("\n")
            : "- (none)";
        // Value type admits ExternalRef[] for the external_refs block sequence
        // (DR-5 — the first array-of-object frontmatter field; js-yaml dump
        // serializes it losslessly with the existing options, DR-1) and the v8
        // dispatch_pins map (first nested-map frontmatter field — js-yaml dumps a
        // plain string→string object losslessly with the same options).
        const frontmatterData = {
            schema_version: CURRENT_VERSIONS.handoff,
            active_feature: _activeFeature,
            status: _status,
            last_updated: now,
        };
        if (blockingReason)
            frontmatterData.blocking_reason = blockingReason;
        if (lastAgent)
            frontmatterData.last_agent = lastAgent;
        // Preserve prd_path AND the scope_decision attestation across writes that
        // don't set them (PM sets each once; downstream roles call writeState
        // without re-passing the fields, and must not drop them). A single existing
        // read services all three.
        let effectivePrdPath = prdPath;
        let effectiveScopeDecision = scopeDecision;
        let effectiveScopeDecisionWhy = scopeDecisionWhy;
        // v5 — cut-approval is FEATURE-SCOPED, not write-sticky (pm-cut-approval-gate).
        // It needs the on-disk active_feature for the same-feature carry-forward, so
        // it shares the single existing-state read below with the prd_path /
        // scope_decision preserve logic (no extra I/O). The consolidated algorithm:
        //   1. option cutApproved === true                  → true   (PM approving now)
        //   2. agent is pm && status In_Progress            → undefined (every PM
        //                                                      re-entry re-arms — new
        //                                                      feature, QA-FAIL bounce,
        //                                                      scope rework all funnel
        //                                                      here; closes the stale-
        //                                                      true hole, so we do NOT
        //                                                      copy scope_decision's
        //                                                      blind preserve)
        //   3. existing.active_feature === this active_feature → carry existing value
        //                                                      forward (non-PM same-
        //                                                      feature self-progression)
        //   4. otherwise (feature changed)                  → undefined (drop stale)
        let effectiveCutApproved;
        const isPmReentry = lastAgent === "pm" && _status === "In_Progress";
        const cutApprovalNeedsExisting = cutApproved !== true && !isPmReentry;
        // v6 — external_refs is FEATURE-SCOPED with NO PM-re-entry re-arm (DR-4).
        // It deliberately does NOT copy cut_approved's clause (2): cut_approved
        // re-arms on PM re-entry because its ABSENCE BLOCKS (re-arming forces
        // re-approval); external_refs has INVERSE polarity — absence CLEARS — so
        // re-arming here would silently DISCARD a valid ledger and un-block the
        // EXTERNAL_REFS_UNRESOLVED gate. The consolidated algorithm (AC-6):
        //   1. option externalRefs !== undefined             → use it verbatim
        //                                                      (REPLACE, incl. [])
        //   2. omitted && existing.active_feature === this   → carry existing
        //                                                      ledger forward
        //   3. omitted && active_feature changed             → undefined (drop
        //                                                      stale ledger)
        let effectiveExternalRefs = externalRefs;
        const externalRefsNeedsExisting = externalRefs === undefined;
        // v8 — dispatch_pins is FEATURE-SCOPED with NO PM-re-entry re-arm, the
        // exact external_refs algorithm (spec AC-3/AC-4). It is a durable human
        // directive, not a single-hop routing signal — it must survive every write
        // in the chain that doesn't concern it (the bug c14 fixes), and a PM
        // bouncing a QA FAIL back to In_Progress must NOT silently un-pin a role
        // mid-feature (so no cut_approved-style clause (2)). The algorithm:
        //   1. option dispatchPins !== undefined             → use it verbatim
        //                                                      (REPLACE, incl. {})
        //   2. omitted && existing.active_feature === this   → carry existing
        //                                                      pins forward
        //   3. omitted && active_feature changed             → undefined (drop
        //                                                      stale pins)
        let effectiveDispatchPins = dispatchPins;
        const dispatchPinsNeedsExisting = dispatchPins === undefined;
        // v11 — dispatch_mode is FEATURE-SCOPED with NO PM-re-entry re-arm, the
        // exact dispatch_pins/external_refs algorithm but SCALAR (e2 DR): a bug-
        // vs-feature classification is stable for the life of the ticket — a PM
        // bouncing a QA FAIL back to In_Progress must NOT silently flip the mode
        // (so no cut_approved-style clause (2)); AC4 opt-out is an EXPLICIT PM
        // write of "feature". The algorithm:
        //   1. option dispatchMode !== undefined              → use it verbatim
        //   2. omitted && existing.active_feature === this    → carry existing
        //                                                       mode forward
        //   3. omitted && active_feature changed              → undefined (drop
        //                                                       stale mode —
        //                                                       absence = feature)
        let effectiveDispatchMode = dispatchMode;
        const dispatchModeNeedsExisting = dispatchMode === undefined;
        // v13 — evidence_schema is FEATURE-SCOPED with NO PM-re-entry re-arm, the
        // exact dispatch_mode scalar algorithm (e23 D1): the pin records which
        // evidence conventions were CURRENT when the feature was dispatched — a
        // stable dispatch-time fact for the life of the ticket, so no write in
        // the chain (PM bounce included) may silently re-pin it. The algorithm:
        //   1. option evidenceSchema !== undefined            → use it verbatim
        //                                                       (orchestrator
        //                                                       stamp on feature
        //                                                       change)
        //   2. omitted && existing.active_feature === this    → carry existing
        //                                                       pin forward
        //   3. omitted && active_feature changed              → undefined (drop
        //                                                       stale pin —
        //                                                       absence = v2
        //                                                       default)
        let effectiveEvidenceSchema = evidenceSchema;
        const evidenceSchemaNeedsExisting = evidenceSchema === undefined;
        // E10 — `existing` is hoisted out of the preserve block so the timestamp
        // resolution below can read it; a bookkeeping write joins the trigger
        // condition (it needs existing.last_updated). All other paths are
        // unchanged: `existing` stays null unless some preserve clause needed the
        // read, exactly as before.
        let existing = null;
        if (effectivePrdPath === undefined ||
            effectiveScopeDecision === undefined ||
            effectiveScopeDecisionWhy === undefined ||
            cutApprovalNeedsExisting ||
            externalRefsNeedsExisting ||
            dispatchPinsNeedsExisting ||
            dispatchModeNeedsExisting ||
            evidenceSchemaNeedsExisting ||
            bookkeepingWrite === true) {
            existing = parseHandoff(workspacePath);
            if (effectivePrdPath === undefined)
                effectivePrdPath = existing?.prd_path;
            if (effectiveScopeDecision === undefined)
                effectiveScopeDecision = existing?.scope_decision;
            if (effectiveScopeDecisionWhy === undefined)
                effectiveScopeDecisionWhy = existing?.scope_decision_why;
            if (cutApprovalNeedsExisting) {
                // clauses (3)/(4): carry forward only within the same feature.
                effectiveCutApproved =
                    existing?.active_feature === _activeFeature ? existing?.cut_approved : undefined;
            }
            if (externalRefsNeedsExisting) {
                // clauses (2)/(3): carry the ledger forward only within the same feature.
                effectiveExternalRefs =
                    existing?.active_feature === _activeFeature ? existing?.external_refs : undefined;
            }
            if (dispatchPinsNeedsExisting) {
                // v8 clauses (2)/(3): carry the pins forward only within the same feature.
                effectiveDispatchPins =
                    existing?.active_feature === _activeFeature ? existing?.dispatch_pins : undefined;
            }
            if (dispatchModeNeedsExisting) {
                // v11 clauses (2)/(3): carry the mode forward only within the same feature.
                effectiveDispatchMode =
                    existing?.active_feature === _activeFeature ? existing?.dispatch_mode : undefined;
            }
            if (evidenceSchemaNeedsExisting) {
                // v13 clauses (2)/(3): carry the pin forward only within the same feature.
                effectiveEvidenceSchema =
                    existing?.active_feature === _activeFeature ? existing?.evidence_schema : undefined;
            }
        }
        // E10 — timestamp resolution (e10-lease-override AC4/AC5, DR-5). Default:
        // fresh stamp (unchanged). A bookkeeping write PRESERVES the existing
        // on-disk last_updated verbatim so the incumbent lease's measured age
        // keeps reflecting the last REAL write — guarded same-active_feature even
        // though the orchestrator's AC6 gate already rejects the differing-feature
        // combination: the migration heal-write in tools/handoff-parse.ts calls
        // this writer DIRECTLY (no orchestrator), so the writer itself must never
        // suppress a differing-feature freshness stamp (the pre-aged-clobber
        // footgun). dispatched_at deliberately keeps its own now() (DR-6): the
        // lease clock is last_updated; dispatched_at feeds the D5 stale-dispatch
        // advisory, a separate concern.
        let effectiveLastUpdated = now;
        if (bookkeepingWrite === true &&
            existing &&
            existing.active_feature === _activeFeature &&
            existing.last_updated) {
            effectiveLastUpdated = existing.last_updated;
        }
        frontmatterData.last_updated = effectiveLastUpdated;
        // clauses (1)/(2): explicit PM approval, or PM re-entry re-arm. These do not
        // depend on `existing`, so they resolve regardless of the read above.
        if (cutApproved === true) {
            effectiveCutApproved = true;
        }
        else if (isPmReentry) {
            effectiveCutApproved = undefined;
        }
        if (effectivePrdPath)
            frontmatterData.prd_path = effectivePrdPath;
        // String attestation: emit only when set (empty string is indistinguishable
        // from "not set", so guard the write).
        if (effectiveScopeDecision)
            frontmatterData.scope_decision = effectiveScopeDecision;
        if (effectiveScopeDecisionWhy)
            frontmatterData.scope_decision_why = effectiveScopeDecisionWhy;
        // Boolean attestation: emit `true` only when effective === true. A falsy
        // value is indistinguishable from "not set", so never emit `false`.
        if (effectiveCutApproved === true)
            frontmatterData.cut_approved = true;
        // v6 — external_refs: emit only a NON-EMPTY ledger. An empty array is NOT
        // serialized (empty === absence === non-blocking, spec AC-2) — keeps the
        // file clean and the two states behaviorally identical.
        if (effectiveExternalRefs && effectiveExternalRefs.length > 0) {
            frontmatterData.external_refs = effectiveExternalRefs;
        }
        // v8 — dispatch_pins: emit only a NON-EMPTY map. An empty object is NOT
        // serialized (empty === absence === "no pins recorded", spec AC-4) — keeps
        // the file clean and the two states behaviorally identical.
        if (effectiveDispatchPins && Object.keys(effectiveDispatchPins).length > 0) {
            frontmatterData.dispatch_pins = effectiveDispatchPins;
        }
        // v11 — dispatch_mode: emit only when set. Absence === "feature" (the
        // default) — never materialize the default (the scope_decision /
        // dispatched_at absence-is-signal emit posture).
        if (effectiveDispatchMode)
            frontmatterData.dispatch_mode = effectiveDispatchMode;
        // v13 — evidence_schema: emit only when set. Absence === "pre-E23
        // feature, v2 normalized-contains default at the gates" (e23 D2) — never
        // materialize a pin the feature was not dispatched with. Explicit
        // !== undefined guard (not truthiness): a schema version can never
        // legally be 0, but the guard style keeps the numeric intent obvious.
        if (effectiveEvidenceSchema !== undefined) {
            frontmatterData.evidence_schema = effectiveEvidenceSchema;
        }
        // v7 — protocol fields: emit ONLY when set on THIS write (AC-3 transient
        // semantics). Deliberately NOT joined to the existing-state preserve read
        // above — carrying a stale single-hop directive forward would be a
        // behavioral regression versus the wholesale-replaced pending_notes lines
        // these fields replace (c9-protocol-fields DR on AC-3).
        if (nextRole)
            frontmatterData.next_role = nextRole;
        // v10 — dispatch-liveness stamp (d5-server-side-stale-dispatch-detection,
        // DR-2): stamp iff dispatching, on the SAME transient predicate and the
        // SAME now() as last_updated, so dispatched_at === last_updated exactly
        // whenever a dispatch is stamped (E10 exception, DR-6: a bookkeeping
        // write that also dispatches preserves last_updated but stamps
        // dispatched_at = now — acceptable, advisory only, not gated). Single-sourced HERE (not the
        // orchestrator) so every write path — orchestrator, migration heal-write,
        // positional callers — gets it for free. Server-derived, never
        // client-supplied. Bare sync assignment (D3 best-effort discipline): can
        // never throw, never fails a tw_update_state write. An omitting write
        // drops it; a re-dispatching write re-stamps it (AC-3/AC-6 fall out of
        // the nextRole transient lifecycle — do NOT join to the preserve read).
        if (nextRole)
            frontmatterData.dispatched_at = now;
        if (resumeOf)
            frontmatterData.resume_of = resumeOf;
        if (reviewVerdict)
            frontmatterData.review_verdict = reviewVerdict;
        // Always emit qa_round (even 0) so the field is discoverable; falsy
        // input (undefined/NaN) normalises to 0.
        const normalisedRound = Number.isFinite(qaRound) && qaRound >= 0 ? Math.floor(qaRound) : 0;
        frontmatterData.qa_round = normalisedRound;
        const normalisedReviewRound = Number.isFinite(reviewRound) && reviewRound >= 0
            ? Math.floor(reviewRound)
            : 0;
        frontmatterData.review_round = normalisedReviewRound;
        const normalisedVisualRound = Number.isFinite(visualRound) && visualRound >= 0
            ? Math.floor(visualRound)
            : 0;
        frontmatterData.visual_round = normalisedVisualRound;
        // v9 — always emit hop_count (even 0) so the field is discoverable and the
        // v8→v9 migration-heal write persists the seeded counter (closing the 01A
        // stamp-v9-but-drop-hop_count gap). Falsy input normalises to 0.
        const normalisedHopCount = Number.isFinite(hopCount) && hopCount >= 0
            ? Math.floor(hopCount)
            : 0;
        frontmatterData.hop_count = normalisedHopCount;
        // v12 — always emit the three cumulative totals (even 0) so the fields are
        // discoverable and the v11→v12 migration-heal write persists the seeded
        // counters (the hop_count v9 emit posture, per field). Falsy input
        // normalises to 0.
        const normalisedQaRoundsTotal = Number.isFinite(qaRoundsTotal) && qaRoundsTotal >= 0
            ? Math.floor(qaRoundsTotal)
            : 0;
        frontmatterData.qa_rounds_total = normalisedQaRoundsTotal;
        const normalisedReviewRoundsTotal = Number.isFinite(reviewRoundsTotal) && reviewRoundsTotal >= 0
            ? Math.floor(reviewRoundsTotal)
            : 0;
        frontmatterData.review_rounds_total = normalisedReviewRoundsTotal;
        const normalisedVisualRoundsTotal = Number.isFinite(visualRoundsTotal) && visualRoundsTotal >= 0
            ? Math.floor(visualRoundsTotal)
            : 0;
        frontmatterData.visual_rounds_total = normalisedVisualRoundsTotal;
        const frontmatter = yaml
            .dump(frontmatterData, { lineWidth: -1, forceQuotes: true, quotingType: '"' })
            .trimEnd();
        const content = `---
${frontmatter}
---
# Handoff State

## Completed
${completedList}

## Pending & Handoff Notes
${pendingList}

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
`;
        // Atomic publish: write to temp, then rename. Readers see old or new, never partial.
        const tmpPath = `${handoffPath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tmpPath, content, "utf-8");
        fs.renameSync(tmpPath, handoffPath);
        refreshSnapshotFor(workspacePath, handoffPath, "handoff");
        // E10 — report the timestamp actually persisted (preserved on a
        // bookkeeping write, fresh otherwise), not unconditionally now().
        return JSON.stringify({ success: true, path: handoffPath, updated_at: effectiveLastUpdated });
    });
}
// E36 Option-A: thin ~10-line dispatcher. Discriminate by first-arg shape and
// delegate immediately to writeHandoffStateCore — no gate/preserve logic
// lives at this boundary any more, that all moved into the core above.
export function writeHandoffState(workspacePathOrOpts, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound, prdPath, reviewRound, visualRound, hopCount) {
    if (typeof workspacePathOrOpts === "object" && !Array.isArray(workspacePathOrOpts)) {
        return writeHandoffStateCore(workspacePathOrOpts);
    }
    return writeHandoffStateCore({
        workspacePath: workspacePathOrOpts,
        activeFeature: activeFeature,
        status: status,
        completedTasks: completedTasks ?? [],
        pendingNotes: pendingNotes ?? [],
        blockingReason,
        lastAgent,
        qaRound,
        prdPath,
        reviewRound,
        visualRound,
        hopCount,
    });
}
//# sourceMappingURL=handoff-write.js.map