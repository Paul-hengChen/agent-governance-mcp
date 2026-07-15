// Coded by @sr-engineer
// Tools: handoff state read/write with format enforcement
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { markStateRead, verifyFreshness, refreshSnapshotFor, } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { getActiveStorage } from "./storage.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
// Side-effect import: registers the handoff v0→v1 migration on module load.
import "../schema/migrations-handoff.js";
// Cap the completed_tasks array returned by readState() so long projects
// don't bloat the LLM context. The full list is still in handoff.md.
const COMPLETED_TASKS_RETURN_LIMIT = 50;
// Cap the total character length of pending_notes returned by readState().
// Long deliverable descriptions (common in sr-engineer handoffs) can bloat
// the LLM context on every tw_get_state call. Full notes remain on disk.
const PENDING_NOTES_CHAR_LIMIT = 3000;
// v10 — staleness threshold for the tw_get_state stale-dispatch advisory.
// Fixed constant, NOT config-driven (DR-4): the advisory never blocks a write,
// so a false positive costs one cheap ground-truth check, and there is no
// legitimate reason a workspace would DISABLE it (unlike tokenBudgetPerFeature,
// whose absence is a meaningful opt-out). Mirrors HOP_CAP's fixed-constant
// posture. Tunable in one line if 15 proves too tight.
const STALE_DISPATCH_THRESHOLD_MIN = 15;
function getHandoffPath(workspacePath) {
    return path.join(workspacePath, ".current", "handoff.md");
}
function ensureDir(workspacePath) {
    const dir = path.join(workspacePath, ".current");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function extractSectionContent(body, headingPattern) {
    const match = body.match(headingPattern);
    if (!match || match.index === undefined)
        return "";
    const start = match.index + match[0].length;
    const rest = body.slice(start);
    const nextSection = rest.search(/\n##\s/);
    return nextSection === -1 ? rest : rest.slice(0, nextSection);
}
// The four legal external_refs states, for defensive parse-time filtering.
const EXTERNAL_REF_STATES = [
    "fetched",
    "indexed",
    "user-confirmed-ignorable",
    "unresolved",
];
// v6 — defensive parser for the external_refs frontmatter field. Returns
// undefined when raw is not a non-empty array of {ref: string, state: <known
// enum>} objects; malformed entries are dropped (matching the parser's
// defensive asString posture); never throws. An all-malformed / empty result
// collapses to undefined so absence stays the single non-blocking sentinel.
function parseExternalRefs(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const refs = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
            continue;
        const { ref, state } = entry;
        if (typeof ref !== "string" || ref === "")
            continue;
        if (typeof state !== "string" || !EXTERNAL_REF_STATES.includes(state))
            continue;
        refs.push({ ref, state: state });
    }
    return refs.length > 0 ? refs : undefined;
}
// v7 — legal value sets for the three protocol fields, for defensive
// parse-time filtering (c9-protocol-fields).
const NEXT_ROLE_VALUES = [
    "pm",
    "researcher",
    "design-auditor",
    "architect",
    "sr-engineer",
    "code-reviewer",
    "qa-engineer",
    "release-engineer",
];
const RESUME_OF_VALUES = ["code-reviewer", "qa-engineer"];
const REVIEW_VERDICT_VALUES = ["APPROVED", "CHANGES_REQUESTED"];
// v11 — legal dispatch_mode values (e2-bugfix-repro-gate), for the same
// defensive parse-time filtering as the three v7 protocol fields.
const DISPATCH_MODE_VALUES = ["feature", "bugfix"];
// v7 — defensive enum parser for the three protocol frontmatter fields.
// Returns undefined on absent / non-string / out-of-enum raw values (matching
// parseExternalRefs' defensive posture); never throws. Absence stays the
// single "no routing signal recorded" sentinel.
function parseEnumField(raw, allowed) {
    return typeof raw === "string" && allowed.includes(raw) ? raw : undefined;
}
// v8 — bound mirrored from the zod boundary (tools/registry.ts, spec AC-2);
// parse-time we only need it to drop grossly malformed hand-edited values.
const DISPATCH_PIN_VALUE_MAX = 100;
// v8 — defensive parser for the dispatch_pins frontmatter map
// (c14-dispatch-pins). Returns undefined when raw is not a non-array object
// with at least one well-formed entry; unknown role keys and empty /
// non-string / oversize values are dropped (matching parseExternalRefs'
// defensive posture); never throws. An all-malformed / empty result collapses
// to undefined so absence stays the single "no pins recorded" sentinel.
function parseDispatchPins(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    const pins = {};
    let count = 0;
    for (const [key, value] of Object.entries(raw)) {
        if (!NEXT_ROLE_VALUES.includes(key))
            continue;
        if (typeof value !== "string" || value === "" || value.length > DISPATCH_PIN_VALUE_MAX)
            continue;
        pins[key] = value;
        count++;
    }
    return count > 0 ? pins : undefined;
}
// Internal helper. Reads + parses + runs schema migrations. Returns the
// migrated state plus a flag that lets readHandoffState fire a write-back
// to heal the on-disk file. Callers that don't need the flag use parseHandoff.
function readAndMigrate(workspacePath) {
    const handoffPath = getHandoffPath(workspacePath);
    if (!fs.existsSync(handoffPath))
        return null;
    const content = fs.readFileSync(handoffPath, "utf-8");
    // Parse YAML frontmatter with js-yaml (handles quotes, colons in values, etc.)
    let rawFrontmatter = {};
    const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (yamlMatch) {
        try {
            const parsed = yaml.load(yamlMatch[1]);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                rawFrontmatter = parsed;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to parse handoff.md frontmatter: ${message}`);
        }
    }
    // Schema-versioning lazy migrate-on-read (Phase 4). Bumps an absent or
    // older schema_version up to CURRENT_VERSIONS.handoff. Throws refuse-loud
    // on future versions — propagates to the caller intentionally.
    const migration = runMigrations("handoff", rawFrontmatter);
    const frontmatter = migration.payload;
    const migrationApplied = migration.applied.length > 0;
    const asString = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
    // Section-scoped parsing: strip frontmatter, then extract by heading keyword.
    // Match either the Chinese or English keyword so mixed-locale handoff.md
    // files (or workspaces that have customised the heading text) still parse.
    const body = content.replace(/^---[\s\S]*?---\s*/, "");
    const completedSection = extractSectionContent(body, /^##[^\n]*(?:完成|Completed)[^\n]*\n/im);
    const pendingSection = extractSectionContent(body, /^##[^\n]*(?:待辦|Pending)[^\n]*\n/im);
    const completed_tasks = [...completedSection.matchAll(/- \[x\] (.+)/g)].map((m) => m[1].trim());
    // Pending notes are plain list items (not checkboxes). "(none)" / legacy "無" are empty-section sentinels.
    const pending_notes = [...pendingSection.matchAll(/^- (?!\[)(.+)/gm)]
        .map((m) => m[1].trim())
        .filter((s) => s !== "(none)" && s !== "無" && s !== "");
    const blockingReason = asString(frontmatter.blocking_reason) || undefined;
    const lastAgent = asString(frontmatter.last_agent) || undefined;
    const prdPath = asString(frontmatter.prd_path) || undefined;
    // v4 — scope-decision attestation. `|| undefined` keeps the field ABSENT when
    // unset, so undefined flows to hasScopeDecision and the gate is free to fire.
    const scopeDecision = asString(frontmatter.scope_decision) || undefined;
    const scopeDecisionWhy = asString(frontmatter.scope_decision_why) || undefined;
    // v5 — cut-approval attestation (pm-cut-approval-gate). Strict boolean:
    // only YAML boolean `true` surfaces as `true`; anything else (false, absent,
    // a string) collapses to `undefined` so the field is omitted via the
    // spread-guard below and the gate is free to fire.
    const cutApproved = frontmatter.cut_approved === true ? true : undefined;
    // v6 — external-reference ledger (b8-external-ref-ledger). undefined when
    // absent/malformed, so absence flows to hasUnresolvedRefs as the
    // non-blocking "zero refs found" sentinel (spec AC-2).
    const externalRefs = parseExternalRefs(frontmatter.external_refs);
    // v7 — protocol fields (c9-protocol-fields). undefined when absent /
    // out-of-enum, so absence stays the "no routing signal recorded" sentinel.
    const nextRole = parseEnumField(frontmatter.next_role, NEXT_ROLE_VALUES);
    // v10 — dispatched_at stamp (d5-server-side-stale-dispatch-detection).
    // Permissive string passthrough (asString posture): validity of the ISO
    // timestamp is checked at compute time (read-path advisory, T-D5-02), not
    // parse time. undefined when absent, so absence stays the "no dispatch
    // currently in flight" sentinel.
    const dispatchedAt = asString(frontmatter.dispatched_at) || undefined;
    const resumeOf = parseEnumField(frontmatter.resume_of, RESUME_OF_VALUES);
    const reviewVerdict = parseEnumField(frontmatter.review_verdict, REVIEW_VERDICT_VALUES);
    // v8 — dispatch_pins map (c14-dispatch-pins). undefined when absent /
    // malformed, so absence stays the "no pins recorded" sentinel.
    const dispatchPins = parseDispatchPins(frontmatter.dispatch_pins);
    // v11 — dispatch_mode (e2-bugfix-repro-gate). undefined when absent /
    // out-of-enum, so absence stays the "feature-mode default" sentinel.
    const dispatchMode = parseEnumField(frontmatter.dispatch_mode, DISPATCH_MODE_VALUES);
    // v13 — evidence_schema pin (e23-evidence-schema-versioning). Defensive
    // positive-integer parse; absent/malformed stays undefined — absence is the
    // "pre-E23 feature, v2 normalized-contains default" sentinel (D2), NEVER
    // defaulted to 0 (unlike the counters: 0 is not a legal schema version).
    const evidenceSchemaRaw = Number(frontmatter.evidence_schema);
    const evidenceSchema = Number.isFinite(evidenceSchemaRaw) && evidenceSchemaRaw >= 1
        ? Math.floor(evidenceSchemaRaw)
        : undefined;
    const qaRoundRaw = Number(frontmatter.qa_round);
    const qa_round = Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0 ? Math.floor(qaRoundRaw) : 0;
    const reviewRoundRaw = Number(frontmatter.review_round);
    const review_round = Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0 ? Math.floor(reviewRoundRaw) : 0;
    const visualRoundRaw = Number(frontmatter.visual_round);
    const visual_round = Number.isFinite(visualRoundRaw) && visualRoundRaw >= 0 ? Math.floor(visualRoundRaw) : 0;
    // v9 — hop_count counter (d2-server-brake-accounting). Defaults missing /
    // malformed to 0, the true pre-feature value (DR-3) — identical defensive
    // posture to the three round counters above.
    const hopCountRaw = Number(frontmatter.hop_count);
    const hop_count = Number.isFinite(hopCountRaw) && hopCountRaw >= 0 ? Math.floor(hopCountRaw) : 0;
    // v12 — cumulative round totals (e8-success-telemetry). Defaults missing /
    // malformed to 0, the true pre-feature value (v11→v12 seed-0 migration
    // precedent) — the exact hop_count defensive posture, per field.
    const qaRoundsTotalRaw = Number(frontmatter.qa_rounds_total);
    const qa_rounds_total = Number.isFinite(qaRoundsTotalRaw) && qaRoundsTotalRaw >= 0 ? Math.floor(qaRoundsTotalRaw) : 0;
    const reviewRoundsTotalRaw = Number(frontmatter.review_rounds_total);
    const review_rounds_total = Number.isFinite(reviewRoundsTotalRaw) && reviewRoundsTotalRaw >= 0
        ? Math.floor(reviewRoundsTotalRaw)
        : 0;
    const visualRoundsTotalRaw = Number(frontmatter.visual_rounds_total);
    const visual_rounds_total = Number.isFinite(visualRoundsTotalRaw) && visualRoundsTotalRaw >= 0
        ? Math.floor(visualRoundsTotalRaw)
        : 0;
    const state = {
        active_feature: asString(frontmatter.active_feature),
        status: asString(frontmatter.status),
        last_updated: asString(frontmatter.last_updated),
        ...(blockingReason && { blocking_reason: blockingReason }),
        ...(lastAgent && { last_agent: lastAgent }),
        ...(prdPath && { prd_path: prdPath }),
        ...(scopeDecision && { scope_decision: scopeDecision }),
        ...(scopeDecisionWhy && { scope_decision_why: scopeDecisionWhy }),
        ...(cutApproved && { cut_approved: cutApproved }),
        ...(externalRefs && { external_refs: externalRefs }),
        ...(nextRole && { next_role: nextRole }),
        ...(dispatchedAt && { dispatched_at: dispatchedAt }),
        ...(resumeOf && { resume_of: resumeOf }),
        ...(reviewVerdict && { review_verdict: reviewVerdict }),
        ...(dispatchPins && { dispatch_pins: dispatchPins }),
        ...(dispatchMode && { dispatch_mode: dispatchMode }),
        ...(evidenceSchema !== undefined && { evidence_schema: evidenceSchema }),
        completed_tasks,
        pending_notes,
        qa_round,
        review_round,
        visual_round,
        hop_count,
        qa_rounds_total,
        review_rounds_total,
        visual_rounds_total,
    };
    // One-shot stderr warning on v1→v2 migration when an in-flight ticket sits at
    // sr-engineer:In_Progress. After v2, that tuple can no longer transition
    // directly to qa-engineer; operator must manually re-route to code-reviewer.
    if (migration.applied.includes(2) &&
        state.last_agent === "sr-engineer" &&
        state.status === "In_Progress") {
        process.stderr.write("[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — " +
            "next transition to qa-engineer will be rejected. " +
            "Manually re-route to code-reviewer or roll back to pm.\n");
    }
    return { state, migrationApplied };
}
/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist. Runs schema migrations in-memory; does
 * NOT write back (callers that need persistence go through readHandoffState).
 */
export function parseHandoff(workspacePath) {
    const result = readAndMigrate(workspacePath);
    return result ? result.state : null;
}
/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 * Triggers a fire-and-forget write-back when schema migrations were applied,
 * so the on-disk file heals to CURRENT on the first read.
 */
export function readHandoffState(workspacePath) {
    markStateRead(workspacePath);
    const result = readAndMigrate(workspacePath);
    if (!result) {
        return JSON.stringify({
            exists: false,
            message: "No handoff state found. This is a fresh project — initialize by calling tw_update_state.",
        });
    }
    const { state, migrationApplied } = result;
    if (migrationApplied) {
        // Defense-in-depth heal of stale on-disk files. Best-effort: a freshness
        // error here just means another writer already healed the file (AC-5), so
        // swallow it. Any other failure also non-fatal — the in-memory state we
        // return is already at CURRENT.
        // v12 — heal write converted from the legacy positional overload to the
        // options object (architecture DR: prefer the modern form over growing the
        // positional list to 15 params). Behaviorally identical for the pre-v12
        // fields: transient v7 protocol fields stay omitted (dropped, AC-3) and
        // the feature-scoped fields (external_refs / dispatch_pins / dispatch_mode
        // / cut_approved) carry forward via the same-feature preserve clause in
        // writeHandoffState — exactly as the positional call behaved.
        void writeHandoffState({
            workspacePath,
            activeFeature: state.active_feature,
            status: state.status,
            completedTasks: state.completed_tasks,
            pendingNotes: state.pending_notes,
            blockingReason: state.blocking_reason,
            lastAgent: state.last_agent,
            qaRound: state.qa_round,
            prdPath: state.prd_path,
            reviewRound: state.review_round,
            visualRound: state.visual_round,
            // v9 — carry the (possibly migration-seeded) hop_count through the heal
            // write. Without this the v8→v9 heal stamped schema_version: 9 but
            // DROPPED the seeded counter, and the always-emit block below would
            // re-default it to 0 — harmless for the seed value (0) but lossy for any
            // real accumulated count on a hand-migrated file.
            hopCount: state.hop_count,
            // v12 — same forward-safety for the three cumulative totals: a future
            // v12→v13 heal must not stamp the new version while dropping real
            // accumulated totals (the v9 hop_count 12th-arg gap, closed at birth).
            qaRoundsTotal: state.qa_rounds_total,
            reviewRoundsTotal: state.review_rounds_total,
            visualRoundsTotal: state.visual_rounds_total,
            // E10 (e10-lease-override AC4) — the heal-write is hard-wired to the
            // bookkeeping behavior UNCONDITIONALLY: a schema heal is mechanically
            // non-substantive (never a real state transition), so it must preserve
            // the pre-heal last_updated verbatim instead of extending a possibly-
            // dead lease. Server-internal, no attestation needed (the same trust
            // posture as the pendingNotes passthrough above). Always same-feature
            // by construction, so writeHandoffState's same-feature guard always
            // takes the preserve branch.
            bookkeepingWrite: true,
        }).catch(() => {
            /* swallowed — read still returns migrated state */
        });
    }
    const truncated = state.completed_tasks.length > COMPLETED_TASKS_RETURN_LIMIT;
    // Truncate pending_notes by total character count. Keep notes from the
    // front (writers put the most load-bearing prose first; routing itself now
    // travels in the structured next_role field, v7). Drop trailing notes that
    // push past the limit.
    let pendingNotes = state.pending_notes;
    let pendingTruncated = false;
    const totalChars = pendingNotes.reduce((sum, n) => sum + n.length, 0);
    if (totalChars > PENDING_NOTES_CHAR_LIMIT) {
        const kept = [];
        let charBudget = PENDING_NOTES_CHAR_LIMIT;
        for (const note of pendingNotes) {
            if (charBudget <= 0)
                break;
            if (note.length <= charBudget) {
                kept.push(note);
                charBudget -= note.length;
            }
            else {
                kept.push(note.slice(0, charBudget) + "…[truncated]");
                charBudget = 0;
            }
        }
        pendingNotes = kept;
        pendingTruncated = true;
    }
    const view = {
        ...state,
        completed_tasks: truncated
            ? state.completed_tasks.slice(-COMPLETED_TASKS_RETURN_LIMIT)
            : state.completed_tasks,
        pending_notes: pendingNotes,
        ...(truncated && {
            completed_tasks_truncated: {
                showing: COMPLETED_TASKS_RETURN_LIMIT,
                total: state.completed_tasks.length,
            },
        }),
        ...(pendingTruncated && {
            pending_notes_truncated: {
                total_chars: totalChars,
                limit: PENDING_NOTES_CHAR_LIMIT,
            },
        }),
    };
    // v10 — stale-dispatch advisory (d5-server-side-stale-dispatch-detection,
    // DR-1). Pure read-time computation over persisted next_role + dispatched_at
    // + wall clock: a fresh/post-compaction session with NO memory of dispatching
    // gets the identical signal (AC-4). Informational only — never blocks a
    // write, no GateErrorCode (DR-6). Defensive by construction: absence of
    // either field, an unparsable stamp, or an in-window stamp all yield no key
    // (AC-5); nothing here can throw or fail the read.
    let staleDispatch;
    if (state.next_role && state.dispatched_at) {
        const stampedMs = Date.parse(state.dispatched_at);
        if (Number.isFinite(stampedMs)) {
            // malformed stamp ⇒ no signal, never throw
            const elapsedMin = (Date.now() - stampedMs) / 60000;
            if (elapsedMin > STALE_DISPATCH_THRESHOLD_MIN) {
                staleDispatch = {
                    role: state.next_role,
                    dispatched_at: state.dispatched_at,
                    elapsed_minutes: Math.floor(elapsedMin),
                    threshold_minutes: STALE_DISPATCH_THRESHOLD_MIN,
                    message: `stale in-flight dispatch: ${state.next_role}, ` +
                        `no state write for >${STALE_DISPATCH_THRESHOLD_MIN} min`,
                };
            }
        }
    }
    return JSON.stringify({ exists: true, ...view, ...(staleDispatch && { stale_dispatch: staleDispatch }) });
}
export async function writeHandoffState(workspacePathOrOpts, activeFeature, status, completedTasks, pendingNotes, blockingReason, lastAgent, qaRound, prdPath, reviewRound, visualRound, hopCount) {
    // Discriminate by first-arg shape. Options-object branch when the first
    // argument is a non-null, non-array object. After this block, all locals
    // below are guaranteed non-undefined for the required fields.
    let workspacePath;
    let scopeDecision;
    let scopeDecisionWhy;
    let cutApproved;
    // v6 — external_refs ledger. The positional overload leaves it undefined
    // (positional callers — including the migration-heal write — never pass it;
    // the same-feature preserve clause below carries any existing ledger
    // forward, DR-8).
    let externalRefs;
    // v7 — protocol fields. Positional overload leaves all three undefined
    // (transient AC-3 semantics: an omitting write — including the
    // migration-heal write in readHandoffState — simply drops them).
    let nextRole;
    let resumeOf;
    let reviewVerdict;
    // v8 — dispatch_pins map. The positional overload leaves it undefined
    // (positional callers — including the migration-heal write — never pass it;
    // the same-feature preserve clause below carries any existing pins forward,
    // mirroring external_refs' DR-8 posture).
    let dispatchPins;
    // v11 — dispatch_mode scalar. The positional overload leaves it undefined
    // (positional callers — including the migration-heal write — never pass it;
    // the same-feature preserve clause below carries any existing value forward,
    // mirroring dispatch_pins' DR-8 posture).
    let dispatchMode;
    // v13 — evidence_schema pin. Same positional-overload posture as
    // dispatchMode: undefined unless the orchestrator stamps it, with the
    // same-feature preserve clause carrying any existing pin forward.
    let evidenceSchema;
    // v12 — cumulative round totals. Options-object only (the positional
    // overload deliberately does NOT grow — architecture DR); a positional call
    // leaves them undefined and the always-emit blocks below normalise to 0.
    let qaRoundsTotal;
    let reviewRoundsTotal;
    let visualRoundsTotal;
    // E10 — bookkeeping-write attestation. Options-object only: the positional
    // overload leaves it undefined (the heal-write call site uses the options
    // object; a positional caller always gets the fresh-stamp default).
    let bookkeepingWrite;
    if (typeof workspacePathOrOpts === "object" &&
        !Array.isArray(workspacePathOrOpts)) {
        const o = workspacePathOrOpts;
        workspacePath = o.workspacePath;
        activeFeature = o.activeFeature;
        status = o.status;
        completedTasks = o.completedTasks ?? [];
        pendingNotes = o.pendingNotes ?? [];
        blockingReason = o.blockingReason;
        lastAgent = o.lastAgent;
        qaRound = o.qaRound;
        prdPath = o.prdPath;
        reviewRound = o.reviewRound;
        visualRound = o.visualRound;
        hopCount = o.hopCount;
        scopeDecision = o.scopeDecision;
        scopeDecisionWhy = o.scopeDecisionWhy;
        cutApproved = o.cutApproved;
        externalRefs = o.externalRefs;
        nextRole = o.nextRole;
        resumeOf = o.resumeOf;
        reviewVerdict = o.reviewVerdict;
        dispatchPins = o.dispatchPins;
        dispatchMode = o.dispatchMode;
        evidenceSchema = o.evidenceSchema;
        qaRoundsTotal = o.qaRoundsTotal;
        reviewRoundsTotal = o.reviewRoundsTotal;
        visualRoundsTotal = o.visualRoundsTotal;
        bookkeepingWrite = o.bookkeepingWrite;
    }
    else {
        workspacePath = workspacePathOrOpts;
        // Positional defaults preserved for backwards-compat callers passing < 11 args.
        completedTasks = completedTasks ?? [];
        pendingNotes = pendingNotes ?? [];
    }
    // Hoist required-from-overload strings to non-optional locals; the
    // overload signatures (positional + options) both make these required, so
    // the narrowing here is a compile-time assertion only.
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
        // combination: the migration heal-write in readHandoffState calls this
        // writer DIRECTLY (no orchestrator), so the writer itself must never
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
// ==========================================
// MCP tool handler (registry-pattern) — verbatim relocation of the
// index.ts `tw_get_state` dispatcher case. args arrive pre-parsed by
// tools/registry.ts defineTool.run; type import is erased at compile so
// the runtime graph stays one-directional (registry.ts → handoff.ts).
// ==========================================
// --- No guard: reading state IS the pre-flight check ---
export async function handleGetState(args) {
    const { workspace_path } = args;
    const result = getActiveStorage().readState(workspace_path);
    return { content: [{ type: "text", text: result }] };
}
//# sourceMappingURL=handoff.js.map