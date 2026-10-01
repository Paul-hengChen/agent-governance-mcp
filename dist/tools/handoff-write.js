// Coded by @sr-engineer
// handoff.md writing; tools/handoff.ts re-exports it, handoff-parse.ts parses.
// Deliberate import cycle with handoff-parse.ts: this module calls parseHandoff
// and the migration heal calls writeHandoffState. Both are runtime calls, never
// made at module init, so the cycle is safe. writeHandoffStateCore(opts) is the
// one implementation; writeHandoffState packs the deprecated positional form
// into options and forwards it.
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { verifyFreshness, refreshSnapshotFor, } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { CURRENT_VERSIONS } from "../schema/versions.js";
import { parseHandoff, parseCutApprovedSource, assertNoHandoffLayoutConflict, relativizePrdPath, } from "./handoff-parse.js";
import { resolveCurrentLanePaths, resolveCurrentLane, resolveLaneDir, resolveLaneLockPath, } from "./lane-paths.js";
import { hasFlatLaneFiles, migrateFlatToLaneLocked } from "./lane-migrate.js";
// The handoff path comes from the lane resolver (`.current/<lane>/handoff.md`).
// path.resolve makes the result absolute for a relative workspacePath. (E123)
function getHandoffPath(workspacePath) {
    return resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
}
// Create the handoff's parent directory (recursive). Derived from the
// resolved handoff path rather than a hard-coded `.current`, so a lane
// sub-directory is created once the resolver goes lane-aware.
function ensureDir(handoffPath) {
    const dir = path.dirname(handoffPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * The real implementation. Every writeHandoffState call — options-object
 * callers directly, positional callers via the thin packing wrapper below —
 * ends up here. Options-object shape ONLY: the body never inspects the
 * first argument's shape. (E36)
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
    // v15 — per-hop dispatch-mechanism attestation. Left undefined by callers
    // that don't set it (transient: an omitting write simply drops both — there
    // is intentionally NO existing-state preserve read for these two).
    const dispatchMechanism = opts.dispatchMechanism;
    const dispatchMechanismTier = opts.dispatchMechanismTier;
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
    // Sanitized through the read path's parseCutApprovedSource, so a forbidden
    // shape becomes undefined and the existing valid value carries forward;
    // nothing of a forbidden shape reaches YAML. Not a zod regex at the
    // registry boundary: the value is never rejected, only never persisted.
    const cutApprovedSource = parseCutApprovedSource(opts.cutApprovedSource);
    // v12 — cumulative round totals. Left undefined by the legacy positional
    // overload's packing (architecture DR: it deliberately does NOT grow); the
    // always-emit blocks below normalise undefined to 0.
    const qaRoundsTotal = opts.qaRoundsTotal;
    const reviewRoundsTotal = opts.reviewRoundsTotal;
    const visualRoundsTotal = opts.visualRoundsTotal;
    // Bookkeeping-write attestation. Left undefined by the legacy positional
    // overload's packing (the heal-write call site always uses the options
    // object directly; a positional caller always gets a fresh stamp). (E10)
    const bookkeepingWrite = opts.bookkeepingWrite;
    // Hoist required strings to the names the body below already uses.
    const _activeFeature = activeFeature;
    const _status = status;
    // Each lane has its own lock, `.current/<lane>/.handoff.lock`, built only
    // by resolveLaneLockPath, so writers in different lanes never block each
    // other. ensureDir runs before the lock so the lane dir can host the lockfile.
    const absWorkspace = path.resolve(workspacePath);
    const lane = resolveCurrentLane(absWorkspace);
    ensureDir(getHandoffPath(workspacePath));
    const lockPath = resolveLaneLockPath(absWorkspace, lane);
    return withFileLock(lockPath, () => {
        // A handoff.md at both the flat and the lane location is ambiguous: fail
        // loud before moving anything. (E123)
        assertNoHandoffLayoutConflict(workspacePath);
        // Any lane file still at the flat `.current/` location is migrated into
        // the lane we hold the lock for, via the lock-free core (the public
        // migrateFlatToLane would re-take this lock and self-deadlock). This also
        // completes a half-finished migration, and flat sidecars with no
        // handoff.md anywhere move without throwing. Migration errors propagate.
        // A caller that loses a race gets alreadyMigrated: true, no throw. (E123)
        if (hasFlatLaneFiles(absWorkspace)) {
            migrateFlatToLaneLocked(absWorkspace, { lane, allowMissingRequired: true });
        }
        // Resolved INSIDE the lock (a writer that waited re-resolves), and it
        // must still be the lane whose lock we hold.
        const handoffPath = getHandoffPath(workspacePath);
        if (path.dirname(handoffPath) !== resolveLaneDir(absWorkspace, lane)) {
            throw new Error(`writeHandoffState: the current lane changed from "${lane}" while waiting for its lock — retry the write`);
        }
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
        // cut_approved is feature-scoped and re-armed on every PM In_Progress
        // write (new feature, QA-FAIL bounce, scope rework), so a stale `true`
        // never survives. Resolution: (1) explicit true → true; (2) PM re-entry →
        // unset; (3) same active_feature on disk → carry; (4) otherwise → unset.
        // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-write.ts — field lifetimes".
        let effectiveCutApproved;
        const isPmReentry = lastAgent === "pm" && _status === "In_Progress";
        const cutApprovalNeedsExisting = cutApproved !== true && !isPmReentry;
        // external_refs: feature-scoped with no PM re-entry re-arm. Its absence
        // clears the gate (the inverse of cut_approved), so re-arming would
        // discard a valid ledger and unblock EXTERNAL_REFS_UNRESOLVED.
        // Resolution: (1) given, even [] → replace; (2) omitted on the same
        // feature → carry; (3) omitted after a feature change → unset.
        let effectiveExternalRefs = externalRefs;
        const externalRefsNeedsExisting = externalRefs === undefined;
        // dispatch_pins: the external_refs rule. Pins are a durable human
        // directive, so a PM bouncing a QA FAIL must not un-pin a role mid-feature.
        let effectiveDispatchPins = dispatchPins;
        const dispatchPinsNeedsExisting = dispatchPins === undefined;
        // dispatch_mode: the external_refs rule, for one value. Bug-vs-feature is
        // stable for the life of the ticket; opting out takes an explicit PM write
        // of "feature". Absence means "feature".
        let effectiveDispatchMode = dispatchMode;
        const dispatchModeNeedsExisting = dispatchMode === undefined;
        // evidence_schema: the external_refs rule. The pin records which evidence
        // conventions were current at dispatch, so no write in the chain may
        // re-pin it; the orchestrator supplies it only on a feature change.
        // Absence means the v2 default.
        let effectiveEvidenceSchema = evidenceSchema;
        const evidenceSchemaNeedsExisting = evidenceSchema === undefined;
        // cut_approved_source: the external_refs rule, not cut_approved's re-arm.
        // Inheriting approval from a parent feature is established once, not
        // re-witnessed on every PM bounce. Absence means non-inherited.
        let effectiveCutApprovedSource = cutApprovedSource;
        const cutApprovedSourceNeedsExisting = cutApprovedSource === undefined;
        // Archive-on-feature-change needs the on-disk active_feature on every
        // write, even when a caller sets all six fields above and this is not a
        // bookkeeping write, so this flag only forces the read to happen.
        const archiveCheckNeedsExisting = true;
        // `existing` is declared outside the preserve block so the timestamp
        // resolution below can read it; a bookkeeping write also triggers the
        // read (it needs existing.last_updated). Otherwise `existing` stays null
        // unless some preserve clause needed the read. (E10)
        let existing = null;
        if (effectivePrdPath === undefined ||
            effectiveScopeDecision === undefined ||
            effectiveScopeDecisionWhy === undefined ||
            cutApprovalNeedsExisting ||
            externalRefsNeedsExisting ||
            dispatchPinsNeedsExisting ||
            dispatchModeNeedsExisting ||
            evidenceSchemaNeedsExisting ||
            cutApprovedSourceNeedsExisting ||
            bookkeepingWrite === true ||
            archiveCheckNeedsExisting) {
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
            if (cutApprovedSourceNeedsExisting) {
                // v14 clauses (2)/(3): carry the value forward only within the same feature.
                effectiveCutApprovedSource =
                    existing?.active_feature === _activeFeature ? existing?.cut_approved_source : undefined;
            }
        }
        // Archive-on-feature-change: copy the old file before this write replaces
        // it. Separate from the preserve rules above; it never touches
        // frontmatterData. Fires only when active_feature actually changes, inside
        // the same lock and after the same verifyFreshness, before the publish, so
        // it captures exactly the file the preserve logic read.
        const featureChanged = existing !== null &&
            !!existing.active_feature &&
            existing.active_feature !== _activeFeature;
        if (featureChanged && fs.existsSync(handoffPath)) {
            // The archive stays workspace-wide on purpose, not per lane: filenames
            // are globally unique and the dir is gitignored; a per-lane split would
            // only let an archive entry outlive the lane dir that produced it.
            const archiveDir = path.join(workspacePath, ".current", "archive");
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }
            // Sanitize before the name reaches the filesystem: characters outside
            // [A-Za-z0-9._-] become "-", so the name cannot escape .current/archive/,
            // and the length is clamped to 200 so the name plus its
            // ".<pid>.<epoch>.md" suffix stays under NAME_MAX (255). Without the
            // clamp a long feature name would throw ENAMETOOLONG on every later
            // feature change. The full name survives inside the copied file.
            // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-write.ts — archive file name".
            const sanitizedOutgoingFeature = existing.active_feature
                .replace(/[^A-Za-z0-9._-]/g, "-")
                .slice(0, 200);
            const archivePath = path.join(archiveDir, `${sanitizedOutgoingFeature}.${process.pid}.${Date.now()}.md`);
            // Verbatim copy of the pre-overwrite file (AC1) — not a field-by-field
            // reconstruction from `existing`.
            fs.copyFileSync(handoffPath, archivePath);
        }
        // Timestamp: a fresh stamp, except a bookkeeping write keeps the on-disk
        // last_updated so the lease age reflects the last real write. Guarded to
        // the same feature here too, because the migration heal-write calls this
        // writer without the orchestrator. dispatched_at still gets now(): it
        // feeds the stale-dispatch advisory, not the lease.
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
        // Persist prd_path relative to workspace_path (never absolute). An
        // out-of-bounds value (only reachable from a direct, non-zod caller) is
        // left out rather than persisted as-is; the value is not echoed. (E235a)
        if (effectivePrdPath) {
            const storedPrdPath = relativizePrdPath(workspacePath, effectivePrdPath);
            if (storedPrdPath) {
                frontmatterData.prd_path = storedPrdPath;
            }
            else {
                console.error("prd_path resolves outside workspace_path — omitted from handoff write");
            }
        }
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
        // evidence_schema: write only when set. Absence means "feature started
        // before pins existed, the gates use the v2 normalized-contains rules" —
        // never invent a pin the feature was not dispatched with. Explicit
        // !== undefined guard (not truthiness): a schema version can never
        // legally be 0, but the guard style keeps the numeric intent obvious.
        if (effectiveEvidenceSchema !== undefined) {
            frontmatterData.evidence_schema = effectiveEvidenceSchema;
        }
        // v14 — cut_approved_source: emit only when set. Absence === "non-inherited"
        // (the safe direction) — never materialize a claim the writer did not make
        // (the dispatch_mode / scope_decision absence-is-signal emit posture).
        if (effectiveCutApprovedSource)
            frontmatterData.cut_approved_source = effectiveCutApprovedSource;
        // v7 — protocol fields: emit ONLY when set on THIS write (AC-3 transient
        // semantics). Deliberately NOT joined to the existing-state preserve read
        // above — carrying a stale single-hop directive forward would be a
        // behavioral regression versus the wholesale-replaced pending_notes lines
        // these fields replace (c9-protocol-fields DR on AC-3).
        if (nextRole)
            frontmatterData.next_role = nextRole;
        // dispatched_at: stamped with the same now() as last_updated, only when
        // this write names a next_role, and never carried forward. Set here so
        // every write path (orchestrator, heal-write, positional callers) gets it.
        // A bookkeeping write that dispatches keeps last_updated but still stamps
        // dispatched_at; that only feeds an advisory. Server-derived; cannot throw.
        if (nextRole)
            frontmatterData.dispatched_at = now;
        if (resumeOf)
            frontmatterData.resume_of = resumeOf;
        if (reviewVerdict)
            frontmatterData.review_verdict = reviewVerdict;
        // v15 — dispatch_mechanism / dispatch_mechanism_tier: emit ONLY when set
        // on THIS write (the v7 transient template directly above). Deliberately
        // NOT joined to any existing-state preserve read — see the options-field
        // comment. The tier is independent of the mechanism: each is emitted iff
        // this write supplied it.
        if (dispatchMechanism)
            frontmatterData.dispatch_mechanism = dispatchMechanism;
        if (dispatchMechanismTier)
            frontmatterData.dispatch_mechanism_tier = dispatchMechanismTier;
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
        // Report the timestamp actually persisted (kept on a bookkeeping write,
        // fresh otherwise), not always now(). (E10)
        return JSON.stringify({ success: true, path: handoffPath, updated_at: effectiveLastUpdated });
    });
}
// Thin ~10-line dispatcher: pick the call shape from the first argument and
// hand off to writeHandoffStateCore right away — no gate or preserve logic lives
// at this boundary; it is all in the core above. (E36)
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