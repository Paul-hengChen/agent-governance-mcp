// Coded by @sr-engineer
// Tools: handoff.md writing. tools/handoff.ts stays a thin barrel that
// re-exports this module's public surface, so importers never change. Kept
// separate from tools/handoff-parse.ts (parse / migrate / read). (E36)
//
// NOTE — deliberate circular import with tools/handoff-parse.ts: see the
// top-of-file note there. writeHandoffStateCore's existing-state preserve
// logic below calls parseHandoff (this module → handoff-parse.ts), and
// handoff-parse.ts's migration write-back heal calls writeHandoffState
// (handoff-parse.ts → this module). Both directions are ordinary runtime
// function calls, never read at module-init time, so the cycle is safe.
//
// One implementation, two call shapes: writeHandoffStateCore(opts) is the
// only real implementation and takes only the options object. The exported
// writeHandoffState keeps BOTH public overload signatures (options object
// preferred; the 12-positional overload stays @deprecated, removal planned
// for v4.0.0) but its body is a thin ~10-line dispatcher: options-shaped
// input goes straight to writeHandoffStateCore; positional input is packed
// into a WriteHandoffStateOptions object first. (E36)

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  verifyFreshness,
  refreshSnapshotFor,
} from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { CURRENT_VERSIONS } from "../schema/versions.js";
// Type-only import (erased at compile): the runtime graph stays one-directional
// (transitions.ts never imports handoff.ts / handoff-parse.ts / handoff-write.ts).
import type { AgentName } from "./transitions.js";
import type {
  HandoffState,
  ExternalRef,
  ResumeOfTarget,
  ReviewVerdict,
  DispatchMode,
  DispatchMechanism,
} from "./handoff-types.js";
import {
  parseHandoff,
  parseCutApprovedSource,
  assertNoHandoffLayoutConflict,
  relativizePrdPath,
} from "./handoff-parse.js";
import {
  resolveCurrentLanePaths,
  resolveCurrentLane,
  resolveLaneDir,
  resolveLaneLockPath,
} from "./lane-paths.js";
import { hasFlatLaneFiles, migrateFlatToLaneLocked } from "./lane-migrate.js";

// The handoff path comes from the lane resolver (`.current/<lane>/handoff.md`).
// path.resolve makes the result absolute for a relative workspacePath. (E123)
function getHandoffPath(workspacePath: string): string {
  return resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
}

// Create the handoff's parent directory (recursive). Derived from the
// resolved handoff path rather than a hard-coded `.current`, so a lane
// sub-directory is created once the resolver goes lane-aware.
function ensureDir(handoffPath: string): void {
  const dir = path.dirname(handoffPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * v3.15.0 options-object shape for writeHandoffState's modern overload.
 * Prefer this form at all new call sites. The legacy positional signature
 * is retained for backwards-compat until v4.0.0.
 */
export interface WriteHandoffStateOptions {
  workspacePath: string;
  activeFeature: string;
  status: string;
  completedTasks?: string[];
  pendingNotes?: string[];
  blockingReason?: string;
  lastAgent?: string;
  qaRound?: number;
  // Absolute in memory; persisted relative to workspacePath. (E235a)
  prdPath?: string;
  reviewRound?: number;
  visualRound?: number;
  // v9 — hop_count counter (d2-server-brake-accounting). Server-computed by
  // computeNewRound and threaded through the orchestrator; always emitted to
  // frontmatter (even 0), normalised like the three round counters. NOT
  // preserved-if-omitted: an omitting write normalises to 0, matching
  // qaRound/reviewRound/visualRound semantics exactly.
  hopCount?: number;
  // Cumulative round totals, computed by computeNewRound and passed through
  // the orchestrator; always written to frontmatter (even 0), normalised
  // like hopCount. NOT kept when omitted: an omitting write normalises to 0,
  // exactly like hopCount. Not added to the legacy positional overload (the
  // heal call site uses this options object instead of growing to 15
  // positional params). File mode only: SqliteHandoffStorage.writeState
  // ignores all three. (E8, handoff schema v12)
  qaRoundsTotal?: number;
  reviewRoundsTotal?: number;
  visualRoundsTotal?: number;
  // v4 — scope-decision attestation (server-scope-decision-gate). Emitted into
  // frontmatter only when truthy; preserved across writes that omit it.
  scopeDecision?: string;
  scopeDecisionWhy?: string;
  // v5 — cut-approval attestation (pm-cut-approval-gate). Emitted into
  // frontmatter only when === true. Unlike scopeDecision, this field is NOT
  // blindly preserved across omitting writes — see the feature-scoped reset
  // rule in writeHandoffStateCore (it re-arms on every PM In_Progress
  // re-entry and on any active_feature change).
  cutApproved?: boolean;
  // v6 — external-reference ledger (b8-external-ref-ledger). REPLACE semantics
  // when provided (wholesale, like completedTasks — never merged); feature-
  // scoped preserve-if-omitted, reset ONLY on active_feature change, NOT on PM
  // re-entry (inverse polarity to cutApproved — see writeHandoffStateCore).
  externalRefs?: ExternalRef[];
  // v7 — protocol fields (c9-protocol-fields). TRANSIENT, write-scoped (AC-3):
  // emitted into frontmatter ONLY when set on THIS write; a write that omits
  // any of the three drops it — they are never preserved from the existing
  // state (unlike prd_path/scope_decision blind-preserve or the
  // externalRefs/cutApproved feature-scoped preserve). FILE-MODE persistence
  // only (DR-5): SqliteHandoffStorage.writeState ignores all three.
  nextRole?: AgentName;
  resumeOf?: ResumeOfTarget;
  reviewVerdict?: ReviewVerdict;
  // v8 — dispatch_pins map (c14-dispatch-pins). REPLACE semantics when
  // provided (wholesale, like externalRefs — never merged key-by-key);
  // feature-scoped preserve-if-omitted, reset ONLY on active_feature change,
  // NOT on PM re-entry (the exact externalRefs algorithm, spec AC-3/AC-4 —
  // NOT the transient nextRole lifetime, NOT the cutApproved re-arm). Emitted
  // to frontmatter only when non-empty. FILE-MODE only (AC-5):
  // SqliteHandoffStorage.writeState ignores it.
  dispatchPins?: Partial<Record<AgentName, string>>;
  // dispatch_mode. Scalar sibling of dispatchPins: kept when omitted within
  // the same feature, reset ONLY when active_feature changes, NOT on PM
  // re-entry (unlike the one-write nextRole or the re-armed cutApproved —
  // bug-vs-feature is a stable classification for the life of the feature).
  // Written to frontmatter only when set; absence === "feature" (the
  // default). File mode only: SqliteHandoffStorage.writeState ignores it.
  // (E2, v11)
  dispatchMode?: DispatchMode;
  // evidence_schema pin. Same feature-scoped rule as dispatchMode: kept when
  // omitted within the same active_feature, dropped when active_feature
  // changes, not re-armed on PM re-entry. Set ONLY by the orchestrator
  // (feature_changed → EVIDENCE_SCHEMA_CURRENT), never from a client arg;
  // positional callers and the migration heal-write leave it undefined and
  // the same-feature carry keeps any existing pin. Written to frontmatter
  // only when set; absence means "feature started before pins existed, the
  // gates use the v2 normalized-contains rules". File mode only:
  // SqliteHandoffStorage.writeState ignores it. (E23, v13)
  evidenceSchema?: number;
  // cut_approved_source provenance attestation. Same feature-scoped rule as
  // dispatchMode (not evidenceSchema's server-only handling): SET BY THE
  // CLIENT — the writer's own honest claim, not something the server
  // computes. Kept when omitted within the same active_feature, dropped when
  // active_feature changes, not re-armed on PM re-entry (whether a lane
  // inherited its approval is a stable fact about how the lane came to
  // exist, not a per-cut approval — do NOT copy cutApproved's
  // re-arm-on-PM-re-entry clause). Written to frontmatter only when set;
  // absence === "not inherited" (the safe direction). No gate reads it. File
  // mode only: SqliteHandoffStorage.writeState ignores it. (E114, v14)
  cutApprovedSource?: string;
  // Per-hop dispatch-mechanism attestation (with a self-reported tier). Lives
  // for ONE write only, like nextRole/resumeOf/reviewVerdict: written into
  // frontmatter ONLY when set on THIS write; an omitting write (including the
  // migration heal-write) drops both. NEVER kept from existing state —
  // deliberately not the dispatchPins/externalRefs feature-scoped preserve nor
  // the dispatchMode scalar carry: a mechanism reported by an earlier hop
  // surviving onto a later hop's record would credit the wrong hop. For the
  // record only (no gate reads either). File mode only:
  // SqliteHandoffStorage.writeState ignores both. (E99, v15)
  dispatchMechanism?: DispatchMechanism;
  dispatchMechanismTier?: string;
  // Bookkeeping-write attestation. When true, KEEP the existing on-disk
  // last_updated exactly (same active_feature only — a second line of
  // defence) instead of stamping now(), so a touch that records no progress
  // (failure record, migration heal) cannot extend the incumbent feature's
  // lease. Not written to frontmatter — it only selects the timestamp (no
  // schema bump). Applies to this write only: never persisted, never carried
  // forward. File mode only: SqliteHandoffStorage.writeState ignores it.
  // (E10)
  bookkeepingWrite?: boolean;
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
async function writeHandoffStateCore(opts: WriteHandoffStateOptions): Promise<string> {
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
  // cut_approved_source scalar. Left undefined by callers that don't set it
  // (the same-feature preserve clause below carries any existing value forward,
  // like dispatch_mode — not evidence_schema's orchestrator-only handling,
  // since this field is set by the client).
  // Sanitize through the same parseCutApprovedSource the read path uses, so
  // a forbidden shape (missing prefix, empty/whitespace-only suffix,
  // non-string, "") becomes undefined here instead of being persisted as-is.
  // undefined then makes cutApprovedSourceNeedsExisting true below, so the
  // existing valid record CARRIES FORWARD instead of being silently
  // destroyed — nothing of a forbidden shape ever reaches YAML. Deliberately
  // not a zod regex at the registry boundary: the value must never be
  // rejected at the boundary, only never persisted in a forbidden shape.
  // (E114)
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
  const _activeFeature: string = activeFeature;
  const _status: string = status;
  // e123b9 J2 (spec AC5): per-lane lock `.current/<lane>/.handoff.lock`,
  // built only by resolveLaneLockPath. ensureDir runs BEFORE the lock so the
  // lane dir exists to host the lockfile.
  const absWorkspace = path.resolve(workspacePath);
  const lane = resolveCurrentLane(absWorkspace);
  ensureDir(getHandoffPath(workspacePath));
  const lockPath = resolveLaneLockPath(absWorkspace, lane);

  return withFileLock(lockPath, () => {
    // e123b9 spec AC14: dual presence fails loud before any move.
    assertNoHandoffLayoutConflict(workspacePath);
    // e123b9 spec AC3/AC12, amendment AC16-AC19: any flat lane file left ->
    // migrate into the lane we hold the lock for, via the lock-free core (the
    // public migrateFlatToLane would re-take this lock and self-deadlock).
    // Completes a partial migration; flat sidecars with no handoff.md anywhere
    // move without throwing. Errors propagate (AC4). A race loser gets
    // alreadyMigrated: true, no throw.
    if (hasFlatLaneFiles(absWorkspace)) {
      migrateFlatToLaneLocked(absWorkspace, { lane, allowMissingRequired: true });
    }
    // Resolved INSIDE the lock (a writer that waited re-resolves), and it
    // must still be the lane whose lock we hold.
    const handoffPath = getHandoffPath(workspacePath);
    if (path.dirname(handoffPath) !== resolveLaneDir(absWorkspace, lane)) {
      throw new Error(
        `writeHandoffState: the current lane changed from "${lane}" while waiting for its lock — retry the write`,
      );
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
    const frontmatterData: Record<
      string,
      string | number | boolean | ExternalRef[] | Partial<Record<AgentName, string>>
    > = {
      schema_version: CURRENT_VERSIONS.handoff,
      active_feature: _activeFeature,
      status: _status,
      last_updated: now,
    };
    if (blockingReason) frontmatterData.blocking_reason = blockingReason;
    if (lastAgent) frontmatterData.last_agent = lastAgent;
    // Preserve prd_path AND the scope_decision attestation across writes that
    // don't set them (PM sets each once; downstream roles call writeState
    // without re-passing the fields, and must not drop them). A single existing
    // read services all three.
    let effectivePrdPath: string | undefined = prdPath;
    let effectiveScopeDecision: string | undefined = scopeDecision;
    let effectiveScopeDecisionWhy: string | undefined = scopeDecisionWhy;
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
    let effectiveCutApproved: boolean | undefined;
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
    let effectiveExternalRefs: ExternalRef[] | undefined = externalRefs;
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
    let effectiveDispatchPins: Partial<Record<AgentName, string>> | undefined = dispatchPins;
    const dispatchPinsNeedsExisting = dispatchPins === undefined;
    // dispatch_mode is FEATURE-SCOPED with NO PM-re-entry re-arm: the same
    // rule as dispatch_pins/external_refs, but for a single value. A
    // bug-vs-feature classification is stable for the life of the ticket — a
    // PM bouncing a QA FAIL back to In_Progress must NOT silently flip the
    // mode (so no cut_approved-style re-arm clause); opting out takes an
    // EXPLICIT PM write of "feature". (E2) The rule:
    //   1. option dispatchMode !== undefined              → use it verbatim
    //   2. omitted && existing.active_feature === this    → carry existing
    //                                                       mode forward
    //   3. omitted && active_feature changed              → undefined (drop
    //                                                       stale mode —
    //                                                       absence = feature)
    let effectiveDispatchMode: DispatchMode | undefined = dispatchMode;
    const dispatchModeNeedsExisting = dispatchMode === undefined;
    // evidence_schema is FEATURE-SCOPED with NO PM-re-entry re-arm, the same
    // single-value rule as dispatch_mode: the pin records which evidence
    // conventions were CURRENT when the feature was dispatched — a stable
    // fact for the life of the ticket, so no write in the chain (PM bounce
    // included) may silently re-pin it. (E23) The rule:
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
    let effectiveEvidenceSchema: number | undefined = evidenceSchema;
    const evidenceSchemaNeedsExisting = evidenceSchema === undefined;
    // cut_approved_source is FEATURE-SCOPED with NO PM-re-entry re-arm, the
    // same single-value rule as dispatch_mode — not cutApproved's
    // re-arm-on-PM-re-entry clause: whether this lane inherited its approval
    // from a parent feature is a stable fact about how the lane came to
    // exist, established once, not a per-cut approval that must be
    // re-witnessed on every PM bounce. (E114) The rule:
    //   1. option cutApprovedSource !== undefined         → use it verbatim
    //   2. omitted && existing.active_feature === this    → carry existing
    //                                                        value forward
    //   3. omitted && active_feature changed               → undefined (drop
    //                                                        stale claim —
    //                                                        absence =
    //                                                        non-inherited)
    let effectiveCutApprovedSource: string | undefined = cutApprovedSource;
    const cutApprovedSourceNeedsExisting = cutApprovedSource === undefined;
    // Archive-on-feature-change needs the ON-DISK active_feature on EVERY
    // write, not just on writes that omit one of the six fields above — the
    // archive decision below (existing.active_feature !== this write's
    // active_feature) has to see it even when a caller sets all six fields
    // explicitly and this is not a bookkeeping write (the one combination
    // that would otherwise skip the read entirely). Unlike the six flags
    // above, this one does not drive a keep/carry-forward decision on
    // `existing` — it only forces the read to always happen, so it is
    // unconditionally true rather than tied to an existing condition. (E116)
    const archiveCheckNeedsExisting = true;
    // `existing` is declared outside the preserve block so the timestamp
    // resolution below can read it; a bookkeeping write also triggers the
    // read (it needs existing.last_updated). Otherwise `existing` stays null
    // unless some preserve clause needed the read. (E10)
    let existing: HandoffState | null = null;
    if (
      effectivePrdPath === undefined ||
      effectiveScopeDecision === undefined ||
      effectiveScopeDecisionWhy === undefined ||
      cutApprovalNeedsExisting ||
      externalRefsNeedsExisting ||
      dispatchPinsNeedsExisting ||
      dispatchModeNeedsExisting ||
      evidenceSchemaNeedsExisting ||
      cutApprovedSourceNeedsExisting ||
      bookkeepingWrite === true ||
      archiveCheckNeedsExisting
    ) {
      existing = parseHandoff(workspacePath);
      if (effectivePrdPath === undefined) effectivePrdPath = existing?.prd_path;
      if (effectiveScopeDecision === undefined) effectiveScopeDecision = existing?.scope_decision;
      if (effectiveScopeDecisionWhy === undefined) effectiveScopeDecisionWhy = existing?.scope_decision_why;
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
    // Archive-on-feature-change. This is NOT a seventh member of the
    // six-field preserve/reset pattern above: it never reads or writes
    // cut_approved / external_refs / dispatch_pins / dispatch_mode /
    // evidence_schema / cut_approved_source, and it never touches
    // frontmatterData. It answers a different question — "does a COPY of the
    // OLD file need to survive before this write overwrites it" — so it sits
    // beside that pattern rather than inside it. Fires only on an actual
    // active_feature change (never on a same-feature write, never on a
    // brand-new workspace — both follow from `existing` being null or
    // unchanged). Runs inside the same withFileLock critical section, after
    // the same verifyFreshness call above, and strictly before the tmp-write
    // + rename publish below — so it captures exactly the last known good
    // file the preserve logic itself read, with no new lock and no new freshness
    // check. (E116)
    const featureChanged =
      existing !== null &&
      !!existing.active_feature &&
      existing.active_feature !== _activeFeature;
    if (featureChanged && fs.existsSync(handoffPath)) {
      // The archive stays WORKSPACE-WIDE on purpose, not per lane: filenames
      // are globally unique and the dir is gitignored; a per-lane split would
      // only let an archive entry outlive the lane dir that produced it.
      // (E123)
      const archiveDir = path.join(workspacePath, ".current", "archive");
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      // AC5 — sanitize before it reaches the filesystem: any character
      // outside [A-Za-z0-9._-] collapses to "-", so a pathological
      // active_feature (e.g. containing "/" or "..") cannot escape
      // .current/archive/. Charset alone is not enough: active_feature is
      // z.string().min(1).max(500) (tools/registry.ts), but the filesystem's
      // NAME_MAX is 255, and the suffix below (".<pid>.<epoch>.md") already
      // costs up to 1 + 7 (pid, generously sized for a Linux pid_max default)
      // + 1 + 13 (epoch ms, good until year 2286) + 3 (".md") = 25 bytes.
      // 255 - 25 leaves 230; clamp to 200 for headroom against any future
      // growth in the pid/epoch widths. Truncation is lossless for the
      // archive's purpose — the full outgoing active_feature still survives
      // verbatim inside the copied file's own frontmatter (AC1), so nothing
      // is actually lost by shortening only the filename. Without this
      // clamp, a feature name of 233+ chars (5-digit pid) throws
      // ENAMETOOLONG on every future feature-change write, permanently
      // wedging the workspace on that feature with no tw_* recovery path.
      const sanitizedOutgoingFeature = existing!.active_feature
        .replace(/[^A-Za-z0-9._-]/g, "-")
        .slice(0, 200);
      const archivePath = path.join(
        archiveDir,
        `${sanitizedOutgoingFeature}.${process.pid}.${Date.now()}.md`,
      );
      // Verbatim copy of the pre-overwrite file (AC1) — not a field-by-field
      // reconstruction from `existing`.
      fs.copyFileSync(handoffPath, archivePath);
    }
    // Timestamp resolution. Default: a fresh stamp. A bookkeeping write KEEPS
    // the existing on-disk last_updated exactly, so the incumbent lease's
    // measured age keeps reflecting the last REAL write. It is guarded to the
    // same active_feature even though the orchestrator already rejects the
    // differing-feature combination, because the migration heal-write in
    // tools/handoff-parse.ts calls this writer DIRECTLY (no orchestrator):
    // the writer itself must never suppress a new feature's fresh stamp,
    // which would make its lease look older than it is. dispatched_at still
    // gets its own now(): the lease clock is last_updated, while
    // dispatched_at feeds the separate stale-dispatch advisory. (E10)
    let effectiveLastUpdated = now;
    if (
      bookkeepingWrite === true &&
      existing &&
      existing.active_feature === _activeFeature &&
      existing.last_updated
    ) {
      effectiveLastUpdated = existing.last_updated;
    }
    frontmatterData.last_updated = effectiveLastUpdated;
    // clauses (1)/(2): explicit PM approval, or PM re-entry re-arm. These do not
    // depend on `existing`, so they resolve regardless of the read above.
    if (cutApproved === true) {
      effectiveCutApproved = true;
    } else if (isPmReentry) {
      effectiveCutApproved = undefined;
    }
    // Persist prd_path relative to workspace_path (never absolute). An
    // out-of-bounds value (only reachable from a direct, non-zod caller) is
    // left out rather than persisted as-is; the value is not echoed. (E235a)
    if (effectivePrdPath) {
      const storedPrdPath = relativizePrdPath(workspacePath, effectivePrdPath);
      if (storedPrdPath) {
        frontmatterData.prd_path = storedPrdPath;
      } else {
        console.error("prd_path resolves outside workspace_path — omitted from handoff write");
      }
    }
    // String attestation: emit only when set (empty string is indistinguishable
    // from "not set", so guard the write).
    if (effectiveScopeDecision) frontmatterData.scope_decision = effectiveScopeDecision;
    if (effectiveScopeDecisionWhy) frontmatterData.scope_decision_why = effectiveScopeDecisionWhy;
    // Boolean attestation: emit `true` only when effective === true. A falsy
    // value is indistinguishable from "not set", so never emit `false`.
    if (effectiveCutApproved === true) frontmatterData.cut_approved = true;
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
    if (effectiveDispatchMode) frontmatterData.dispatch_mode = effectiveDispatchMode;
    // evidence_schema: write only when set. Absence means "feature started
    // before pins existed, the gates use the v2 normalized-contains rules" —
    // never invent a pin the feature was not dispatched with. Explicit
    // !== undefined guard (not truthiness): a schema version can never
    // legally be 0, but the guard style keeps the numeric intent obvious.
    // (E23, v13)
    if (effectiveEvidenceSchema !== undefined) {
      frontmatterData.evidence_schema = effectiveEvidenceSchema;
    }
    // v14 — cut_approved_source: emit only when set. Absence === "non-inherited"
    // (the safe direction) — never materialize a claim the writer did not make
    // (the dispatch_mode / scope_decision absence-is-signal emit posture).
    if (effectiveCutApprovedSource) frontmatterData.cut_approved_source = effectiveCutApprovedSource;
    // v7 — protocol fields: emit ONLY when set on THIS write (AC-3 transient
    // semantics). Deliberately NOT joined to the existing-state preserve read
    // above — carrying a stale single-hop directive forward would be a
    // behavioral regression versus the wholesale-replaced pending_notes lines
    // these fields replace (c9-protocol-fields DR on AC-3).
    if (nextRole) frontmatterData.next_role = nextRole;
    // Dispatch-liveness stamp: set only when this write dispatches (names a
    // next_role), using the SAME now() as last_updated, so dispatched_at ===
    // last_updated whenever a dispatch is stamped. Exception: a bookkeeping
    // write that also dispatches keeps last_updated but stamps
    // dispatched_at = now — acceptable, since it only feeds an advisory. Set
    // HERE (not in the orchestrator) so every write path — orchestrator,
    // migration heal-write, positional callers — gets it for free.
    // Server-derived, never client-supplied. A plain synchronous assignment:
    // it can never throw or fail a tw_update_state write. A write without a
    // next_role drops it; a re-dispatching write re-stamps it (it follows
    // nextRole's one-write lifetime — do NOT tie it to the preserve read).
    // (D5, v10)
    if (nextRole) frontmatterData.dispatched_at = now;
    if (resumeOf) frontmatterData.resume_of = resumeOf;
    if (reviewVerdict) frontmatterData.review_verdict = reviewVerdict;
    // v15 — dispatch_mechanism / dispatch_mechanism_tier: emit ONLY when set
    // on THIS write (the v7 transient template directly above). Deliberately
    // NOT joined to any existing-state preserve read — see the options-field
    // comment. The tier is independent of the mechanism: each is emitted iff
    // this write supplied it.
    if (dispatchMechanism) frontmatterData.dispatch_mechanism = dispatchMechanism;
    if (dispatchMechanismTier) frontmatterData.dispatch_mechanism_tier = dispatchMechanismTier;
    // Always emit qa_round (even 0) so the field is discoverable; falsy
    // input (undefined/NaN) normalises to 0.
    const normalisedRound = Number.isFinite(qaRound) && (qaRound as number) >= 0 ? Math.floor(qaRound as number) : 0;
    frontmatterData.qa_round = normalisedRound;
    const normalisedReviewRound =
      Number.isFinite(reviewRound) && (reviewRound as number) >= 0
        ? Math.floor(reviewRound as number)
        : 0;
    frontmatterData.review_round = normalisedReviewRound;
    const normalisedVisualRound =
      Number.isFinite(visualRound) && (visualRound as number) >= 0
        ? Math.floor(visualRound as number)
        : 0;
    frontmatterData.visual_round = normalisedVisualRound;
    // v9 — always emit hop_count (even 0) so the field is discoverable and the
    // v8→v9 migration-heal write persists the seeded counter (closing the 01A
    // stamp-v9-but-drop-hop_count gap). Falsy input normalises to 0.
    const normalisedHopCount =
      Number.isFinite(hopCount) && (hopCount as number) >= 0
        ? Math.floor(hopCount as number)
        : 0;
    frontmatterData.hop_count = normalisedHopCount;
    // v12 — always emit the three cumulative totals (even 0) so the fields are
    // discoverable and the v11→v12 migration-heal write persists the seeded
    // counters (the hop_count v9 emit posture, per field). Falsy input
    // normalises to 0.
    const normalisedQaRoundsTotal =
      Number.isFinite(qaRoundsTotal) && (qaRoundsTotal as number) >= 0
        ? Math.floor(qaRoundsTotal as number)
        : 0;
    frontmatterData.qa_rounds_total = normalisedQaRoundsTotal;
    const normalisedReviewRoundsTotal =
      Number.isFinite(reviewRoundsTotal) && (reviewRoundsTotal as number) >= 0
        ? Math.floor(reviewRoundsTotal as number)
        : 0;
    frontmatterData.review_rounds_total = normalisedReviewRoundsTotal;
    const normalisedVisualRoundsTotal =
      Number.isFinite(visualRoundsTotal) && (visualRoundsTotal as number) >= 0
        ? Math.floor(visualRoundsTotal as number)
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

/**
 * Write handoff state. v3.15.0 dual API:
 *   - Modern (preferred): `writeHandoffState(options)` — pass a
 *     {@link WriteHandoffStateOptions} object. New call sites should use this
 *     form.
 *   - Legacy (deprecated): `writeHandoffState(workspacePath, activeFeature, …)`
 *     — 11 positional params. Retained for backwards-compat with v3.14.x
 *     callers; planned removal in v4.0.0.
 *
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export function writeHandoffState(opts: WriteHandoffStateOptions): Promise<string>;
/**
 * @deprecated v3.15.0: prefer the options-object overload
 * `writeHandoffState({ workspacePath, activeFeature, status, ... })`.
 * Positional signature retained for backwards-compat; planned removal in v4.0.0.
 */
export function writeHandoffState(
  workspacePath: string,
  activeFeature: string,
  status: string,
  completedTasks: string[],
  pendingNotes: string[],
  blockingReason?: string,
  lastAgent?: string,
  qaRound?: number,
  prdPath?: string,
  reviewRound?: number,
  visualRound?: number,
  hopCount?: number,
): Promise<string>;
// Thin ~10-line dispatcher: pick the call shape from the first argument and
// hand off to writeHandoffStateCore right away — no gate or preserve logic lives
// at this boundary; it is all in the core above. (E36)
export function writeHandoffState(
  workspacePathOrOpts: string | WriteHandoffStateOptions,
  activeFeature?: string,
  status?: string,
  completedTasks?: string[],
  pendingNotes?: string[],
  blockingReason?: string,
  lastAgent?: string,
  qaRound?: number,
  prdPath?: string,
  reviewRound?: number,
  visualRound?: number,
  hopCount?: number,
): Promise<string> {
  if (typeof workspacePathOrOpts === "object" && !Array.isArray(workspacePathOrOpts)) {
    return writeHandoffStateCore(workspacePathOrOpts);
  }
  return writeHandoffStateCore({
    workspacePath: workspacePathOrOpts as string,
    activeFeature: activeFeature as string,
    status: status as string,
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
