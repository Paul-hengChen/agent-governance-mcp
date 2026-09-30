// Coded by @sr-engineer
// Tools: handoff.md parse / migrate / read. tools/handoff.ts stays a thin
// barrel that re-exports this module's public surface, so importers never
// change. Kept separate from tools/handoff-write.ts (writing) so parsing,
// writing, the tool handler, and the types each live in their own module
// instead of one large file. (E36)
//
// NOTE — deliberate circular import with tools/handoff-write.ts: readAndMigrate
// / readHandoffState's migration write-back heal calls writeHandoffState (this
// module → handoff-write.ts), and writeHandoffState's existing-state preserve
// logic calls parseHandoff (handoff-write.ts → this module). Both directions
// are ordinary function calls made at RUNTIME (inside function bodies), never
// read at module-init time, so Node's ESM live-binding semantics resolve the
// cycle without error regardless of which module is imported first.
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { markStateRead, refreshSnapshotFor } from "../guards/session.js";
import { runMigrations } from "../schema/versions.js";
import { loadExemptions } from "./exemptions.js";
import { getConfigError } from "./config.js";
import { getLaneRegistrySummary } from "./lane-registry.js";
import { notifyStaleDispatch } from "./stale-notify.js";
// gates/feature-lease.ts has ZERO imports (runtime leaf) — importing it here
// adds no cycle. The release-closing-write terminal-marker predicate has
// exactly one definition, shared by the feature-lease gate and this module's
// stale-dispatch advisory. (E97)
import { isReleaseClosingWrite } from "../gates/feature-lease.js";
// Side-effect import: registers the handoff v0→v1 migration on module load.
// It lives here because this is the module that actually calls
// runMigrations; ES module caching means the side effect still fires exactly
// once regardless of which file imports it first.
import "../schema/migrations-handoff.js";
import { writeHandoffState } from "./handoff-write.js";
import { resolveCurrentLanePaths, resolveCurrentLane, resolveLaneLockPath } from "./lane-paths.js";
import { hasFlatLaneFiles, migrateFlatToLaneLocked } from "./lane-migrate.js";
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
// How prd_path is stored. In memory `prd_path` is always an absolute path; on
// disk (file mode) it is stored relative to workspace_path so a committed
// handoff.md never embeds a local absolute path. These three pure helpers
// (path only, no I/O) are the single source for the relativize / resolve /
// traversal-bound logic — handoff-write.ts, this file's read path, and the
// two tools/registry.ts zod refines all call them. (E235a)
/** The workspace traversal bound. `candidateAbs` MUST already be resolved.
 *  Lexical (no realpath), matching the zod refines' original bound exactly,
 *  so it is neither loosened nor tightened. */
export function isInsideWorkspace(workspacePath, candidateAbs) {
    const rel = path.relative(workspacePath, candidateAbs);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
/** Write side (AC1). Resolves `prdPath` against `workspacePath` and returns the
 *  POSIX-separator workspace-relative form, or `undefined` when it falls
 *  outside the bound. Never returns an absolute string, so an absolute path
 *  can never be persisted. */
export function relativizePrdPath(workspacePath, prdPath) {
    const abs = path.resolve(workspacePath, prdPath);
    if (!isInsideWorkspace(workspacePath, abs))
        return undefined;
    return path.relative(workspacePath, abs).split(path.sep).join("/");
}
/** Read side (AC2/AC3/AC4). `stored` is the raw non-empty frontmatter value.
 *  - absolute + in-bounds → returned verbatim (legacy encoding, AC3)
 *  - relative + in-bounds → resolved against workspacePath (AC2)
 *  - either, out-of-bounds → undefined (drop to absent, AC4) */
export function resolveStoredPrdPath(workspacePath, stored) {
    const abs = path.resolve(workspacePath, stored);
    if (!isInsideWorkspace(workspacePath, abs))
        return undefined;
    return path.isAbsolute(stored) ? stored : abs;
}
// Resolved through the lane seam: the handoff lives at
// `.current/<lane>/handoff.md`. (E123)
function getHandoffPath(workspacePath) {
    return resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
}
// The legacy flat `.current/handoff.md` written before handoff state moved
// into per-lane directories. The filename comes from the resolved lane path,
// never restated. (E123)
export function getFlatHandoffPath(workspacePath) {
    const abs = path.resolve(workspacePath);
    return path.join(abs, ".current", path.basename(getHandoffPath(abs)));
}
function lastUpdatedOf(filePath) {
    try {
        const m = fs.readFileSync(filePath, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const fm = m ? yaml.load(m[1]) : null;
        const v = fm && typeof fm === "object" ? fm.last_updated : undefined;
        const s = v instanceof Date ? v.toISOString() : typeof v === "string" ? v : "";
        if (s && !Number.isNaN(Date.parse(s)))
            return s;
    }
    catch {
        /* unreadable / malformed frontmatter — reported as unparseable below */
    }
    return "unparseable/missing";
}
/**
 * Throw HANDOFF_LAYOUT_CONFLICT when BOTH the flat and the lane-scoped
 * handoff.md exist (the state an older, flat-layout server produces by
 * writing the flat file after a restarted server migrated). Scoped to
 * handoff.md only — a sidecar on both sides is merged by the migration
 * instead. A plain Error, deliberately NOT a GateErrorCode: it fires on reads
 * too. Touches nothing; callers run it before any move. (E123)
 */
export function assertNoHandoffLayoutConflict(workspacePath) {
    const lanePath = getHandoffPath(workspacePath);
    const flatPath = getFlatHandoffPath(workspacePath);
    if (!fs.existsSync(flatPath) || !fs.existsSync(lanePath))
        return;
    throw new Error(`HANDOFF_LAYOUT_CONFLICT: two handoff.md files exist for this workspace: ` +
        `flat ${flatPath} (last_updated: ${lastUpdatedOf(flatPath)}) and ` +
        `lane ${lanePath} (last_updated: ${lastUpdatedOf(lanePath)}). Nothing was moved or modified. ` +
        `Repair: (1) stop and restart every running MCP server for this workspace ` +
        `(a pre-flip server keeps writing the flat path); (2) decide which file to keep ` +
        `(typically the newer last_updated; the server does not decide for you); ` +
        `(3) delete the other file or move it out of .current/; (4) retry the tw_* call.`);
}
// Flat->lane migration for readHandoffState, own workspace only. Trigger:
// ANY flat LANE_FILES entry still present (false forever once every flat
// file has moved — no flag file). The dual-presence check runs first, before
// any move. A partial migration (either move order) is completed here; flat
// sidecars with no handoff.md anywhere are moved without throwing.
// readHandoffState is synchronous (FileHandoffStorage.readState /
// HandoffStorage), so it cannot await the public async migrateFlatToLane;
// instead it takes the SAME per-lane lock (resolveLaneLockPath, same O_EXCL
// file + payload as withFileLock) with one non-blocking attempt and runs the
// lock-free core under it. If the lock is held (a concurrent migrator/writer
// — which migrates under that lock itself — or a crashed holder, which the
// next writer's withFileLock clears) the read skips the migration and reads
// read-only via readAndMigrate's flat fallback. Errors from the core
// propagate. (E123)
function migrateOwnWorkspaceIfFlat(workspacePath) {
    const abs = path.resolve(workspacePath);
    assertNoHandoffLayoutConflict(abs);
    if (!hasFlatLaneFiles(abs))
        return;
    const lane = resolveCurrentLane(abs);
    const lockPath = resolveLaneLockPath(abs, lane);
    const laneDir = path.dirname(lockPath);
    const createdLaneDir = !fs.existsSync(laneDir);
    fs.mkdirSync(laneDir, { recursive: true }); // spec AC5: host the lock
    let fd;
    try {
        fd = fs.openSync(lockPath, "wx");
    }
    catch (err) {
        if (err.code === "EEXIST")
            return;
        throw err;
    }
    try {
        try {
            fs.writeSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }));
            migrateFlatToLaneLocked(abs, { lane, allowMissingRequired: true });
        }
        finally {
            fs.closeSync(fd);
            fs.rmSync(lockPath, { force: true });
        }
    }
    catch (err) {
        // A refused run leaves no lane dir behind if it only existed for the lock.
        if (createdLaneDir) {
            try {
                fs.rmdirSync(laneDir);
            }
            catch {
                /* not empty — leave it */
            }
        }
        throw err;
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
// Legal dispatch_mode values, for the same defensive parse-time filtering as
// the three v7 protocol fields. (E2, handoff schema v11)
const DISPATCH_MODE_VALUES = ["feature", "bugfix"];
// Legal dispatch_mechanism values, for the same defensive parse-time
// filtering as dispatch_mode above. (E99, v15)
const DISPATCH_MECHANISM_VALUES = ["task", "switch_role", "inline"];
// v15 — bound mirrored from the zod boundary (tools/registry.ts
// dispatch_mechanism_tier .max(40)); parse-time we only need it to drop a
// grossly malformed hand-edited value, never to reject.
const DISPATCH_MECHANISM_TIER_MAX = 40;
// v15 — defensive parser for dispatch_mechanism_tier. Bounded free text (the
// dispatch_pins value posture): non-string / empty / oversize collapses to
// undefined so absence stays the single "not attested for this hop"
// sentinel; never throws.
function parseDispatchMechanismTier(raw) {
    if (typeof raw !== "string" || raw === "" || raw.length > DISPATCH_MECHANISM_TIER_MAX) {
        return undefined;
    }
    return raw;
}
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
// Legal shape for cut_approved_source: "inherited:<parent-feature>" with a
// non-empty parent-feature suffix. Same defensive-drop behaviour as the
// parseEnumField / parseDispatchPins helpers above — a malformed hand-edited
// value (missing prefix, empty suffix, non-string) becomes undefined, never
// throws. No other shape is accepted. (E114, v14)
const CUT_APPROVED_SOURCE_PREFIX = "inherited:";
export function parseCutApprovedSource(raw) {
    if (typeof raw !== "string")
        return undefined;
    if (!raw.startsWith(CUT_APPROVED_SOURCE_PREFIX))
        return undefined;
    // Trim before the length test so a whitespace-only suffix ("inherited:   ")
    // becomes undefined instead of round-tripping as a persisted, API-visible
    // claim that names no parent. Return `raw` UNCHANGED on success — trimming
    // is only for the validity test, so the stored/returned value round-trips
    // exactly. (E114)
    const parentFeature = raw.slice(CUT_APPROVED_SOURCE_PREFIX.length).trim();
    return parentFeature.length > 0 ? raw : undefined;
}
// Internal helper. Reads + parses + runs schema migrations. Returns the
// migrated state plus a flag that lets readHandoffState fire a write-back
// to heal the on-disk file. Callers that don't need the flag use parseHandoff.
//
// SHARED by cross-workspace readers, so it NEVER migrates, locks or creates
// anything. Dual presence throws HANDOFF_LAYOUT_CONFLICT; otherwise it reads
// the lane path, falling back to the legacy flat path read-only for a
// not-yet-migrated workspace. (E123)
function readAndMigrate(workspacePath) {
    assertNoHandoffLayoutConflict(workspacePath);
    const lanePath = getHandoffPath(workspacePath);
    const handoffPath = fs.existsSync(lanePath) ? lanePath : getFlatHandoffPath(workspacePath);
    let content;
    try {
        content = fs.readFileSync(handoffPath, "utf-8");
    }
    catch (err) {
        // ENOTDIR (a non-directory component in workspace_path) degrades exactly
        // like ENOENT — "no prior state". (E123)
        const code = err.code;
        if (code !== "ENOENT" && code !== "ENOTDIR")
            throw err;
        // A concurrent migration may have renamed flat -> lane between the check
        // and the read; the rename is atomic, so the lane path now has it.
        if (handoffPath === lanePath || !fs.existsSync(lanePath))
            return null;
        content = fs.readFileSync(lanePath, "utf-8");
    }
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
    // Stored relative (or, in older files, absolute); resolved to absolute here
    // and bounded to workspace_path. An out-of-bounds value is dropped to
    // absent (it self-heals on the next write's carry-forward) and is not
    // echoed. (E235a)
    const rawPrdPath = asString(frontmatter.prd_path) || undefined;
    const prdPath = rawPrdPath ? resolveStoredPrdPath(workspacePath, rawPrdPath) : undefined;
    if (rawPrdPath && !prdPath) {
        console.error("prd_path in handoff frontmatter resolves outside workspace_path — ignored (treated as absent)");
    }
    // v4 — scope-decision attestation. `|| undefined` keeps the field ABSENT when
    // unset, so undefined flows to hasScopeDecision and the gate is free to fire.
    const scopeDecision = asString(frontmatter.scope_decision) || undefined;
    const scopeDecisionWhy = asString(frontmatter.scope_decision_why) || undefined;
    // v5 — cut-approval attestation (pm-cut-approval-gate). Strict boolean:
    // only YAML boolean `true` surfaces as `true`; anything else (false, absent,
    // a string) collapses to `undefined` so the field is omitted via the
    // spread-guard below and the gate is free to fire.
    const cutApproved = frontmatter.cut_approved === true ? true : undefined;
    // Cut-approval inheritance attestation. Set by the client; parsed
    // defensively like dispatch_mode below: undefined when absent or
    // malformed, so absence keeps meaning "not inherited" (the safe
    // direction). (E114, v14)
    const cutApprovedSource = parseCutApprovedSource(frontmatter.cut_approved_source);
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
    // dispatch_mode: undefined when absent or not in the enum, so absence keeps
    // meaning "feature mode, the default". (E2, v11)
    const dispatchMode = parseEnumField(frontmatter.dispatch_mode, DISPATCH_MODE_VALUES);
    // Per-hop dispatch-mechanism attestation. Only kept for one write on the
    // write side; here just parsed defensively — an out-of-enum or malformed
    // value becomes undefined (dropped, never rejected), so absence keeps
    // meaning "not attested for this hop". (E99, v15)
    const dispatchMechanism = parseEnumField(frontmatter.dispatch_mechanism, DISPATCH_MECHANISM_VALUES);
    const dispatchMechanismTier = parseDispatchMechanismTier(frontmatter.dispatch_mechanism_tier);
    // evidence_schema pin. Defensive positive-integer parse; absent or
    // malformed stays undefined — absence means "feature started before pins
    // existed, use the v2 normalized-contains rules". Never defaulted to 0
    // (unlike the counters: 0 is not a legal schema version). (E23, v13)
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
    // Cumulative round totals. Missing or malformed values default to 0, the
    // true value before the fields existed (the v11→v12 migration also seeds
    // 0) — the same defensive handling as hop_count, per field. (E8, v12)
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
        ...(cutApprovedSource && { cut_approved_source: cutApprovedSource }),
        ...(dispatchMechanism && { dispatch_mechanism: dispatchMechanism }),
        ...(dispatchMechanismTier && { dispatch_mechanism_tier: dispatchMechanismTier }),
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
    // Migrate BEFORE markStateRead, so the freshness snapshot is taken of the
    // file at its post-migration (lane) path. (E123)
    migrateOwnWorkspaceIfFlat(workspacePath);
    markStateRead(workspacePath);
    // Migration skipped (lock busy): this read comes from the flat fallback, so
    // snapshot THAT file's mtime. A rename preserves mtime, so the writer that
    // migrates under the lock still passes verifyFreshness on the lane path.
    const flatPath = getFlatHandoffPath(workspacePath);
    if (!fs.existsSync(getHandoffPath(workspacePath)) && fs.existsSync(flatPath)) {
        refreshSnapshotFor(workspacePath, flatPath, "handoff");
    }
    // Read-time view of .current/exemptions.json, the ONLY sanctioned channel
    // for exempting a task from the §2 build gate. Like the stale_dispatch
    // advisory below: computed at read time, no handoff schema field,
    // informational, never blocks or throws (loadExemptions turns every failure
    // into zero exemptions plus a loud errors[]). Shown on tw_get_state because
    // every role calls it first — the one place every agent already looks, so
    // the exemption list (and its only-grows `count` metric) needs no second
    // read and no drift-advisory plumbing. File-mode read path only, like the
    // other file-mode-only fields. (E24)
    const exemptions = loadExemptions(workspacePath);
    // Loud report of a .current/.config.json that exists but cannot be used
    // (unreadable, unparseable, non-object root, or a future schema_version).
    // loadConfig falls back to defaults instead of throwing out of the
    // markStateRead task-path resolution above — a throw there would make the
    // mandatory first read fail — and this field keeps that fallback visible
    // rather than silent. null (clean or absent config) adds no key, so
    // valid/absent config envelopes stay byte-identical. (E31)
    const configError = getConfigError(workspacePath);
    // Fast, cost-capped advisory about sibling lanes (git worktrees) for
    // tw_get_state. Like exemptions/configError above: computed at read time,
    // never throws. getLaneRegistrySummary's 200ms timeoutMs bounds only the
    // `git worktree list` subprocess; on top of that, not covered by the 200ms,
    // is one synchronous parseHandoff read per sibling worktree (measured:
    // 34ms across 14 worktrees in this repo).
    // null (0/1 worktrees, or nothing to report) adds no key, so the common
    // single-checkout payload is unchanged. File-mode read path only
    // (SQLite-mode readState in tools/storage-sqlite.ts is untouched). (E132)
    const laneRegistry = getLaneRegistrySummary(workspacePath);
    const result = readAndMigrate(workspacePath);
    if (!result) {
        // Surface the manifest even before the first handoff write: an adopted
        // workspace may declare exemptions before governance state exists, and
        // sanctioned exemptions must never be silently hidden.
        return JSON.stringify({
            exists: false,
            message: "No handoff state found. This is a fresh project — initialize by calling tw_update_state.",
            ...(configError && { config_error: configError }),
            ...(exemptions && { exemptions }),
            ...(laneRegistry && { lane_registry: laneRegistry }),
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
            // The heal-write always behaves as a bookkeeping write: a schema heal
            // is not a real state transition, so it must keep the pre-heal
            // last_updated exactly instead of extending a lease that may be dead.
            // Server-internal, so no attestation is needed (the same trust as the
            // pendingNotes passthrough above). Always same-feature by
            // construction, so writeHandoffState's same-feature guard always takes
            // the preserve branch. (E10)
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
        // A note that is PARTIALLY kept already gets an inline "…[truncated]"
        // marker (above), but a note dropped WHOLLY (charBudget <= 0 before it
        // is even considered) would leave no inline trace — only the sibling
        // pending_notes_truncated advisory below, which a caller who does not
        // look for it never notices. omittedCount counts every note from the
        // break point onward (index i within pendingNotes) so one synthetic
        // marker can be appended as the array's last entry. (E92)
        let omittedCount = 0;
        for (let i = 0; i < pendingNotes.length; i++) {
            if (charBudget <= 0) {
                omittedCount = pendingNotes.length - i;
                break;
            }
            const note = pendingNotes[i];
            if (note.length <= charBudget) {
                kept.push(note);
                charBudget -= note.length;
            }
            else {
                kept.push(note.slice(0, charBudget) + "…[truncated]");
                charBudget = 0;
            }
        }
        if (omittedCount > 0) {
            // Omission-marker text, quoted verbatim from the spec's Copy/Strings
            // table except for the "{n}" substitution the table declares.
            // (specs/e92-e86-handoff-write-boundary.md)
            kept.push(`…[${omittedCount} further note(s) omitted — see pending_notes_truncated]`);
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
    // Stale-dispatch advisory. Computed at read time from the persisted
    // next_role + dispatched_at and the wall clock, so a fresh or
    // post-compaction session with NO memory of dispatching gets the same
    // signal. Informational only — never blocks a write, no GateErrorCode.
    // Defensive: if either field is missing, the stamp is unparsable, or the
    // stamp is still within the window, no key is added; nothing here can
    // throw or fail the read. (D5, handoff schema v10)
    //
    // A release-engineer CLOSING write (isReleaseClosingWrite, the same
    // terminal-marker predicate gates/feature-lease.ts uses to release the
    // feature lease) is excluded up front, before any elapsed-time math: the
    // write that ships and hands back to pm is terminal, not a dispatch
    // awaiting a response, so it must never read as stale however much time
    // has passed. (E97)
    let staleDispatch;
    if (state.next_role && state.dispatched_at && !isReleaseClosingWrite(state)) {
        const stampedMs = Date.parse(state.dispatched_at);
        if (Number.isFinite(stampedMs)) {
            // malformed stamp ⇒ no signal, never throw
            const elapsedMin = (Date.now() - stampedMs) / 60000;
            if (elapsedMin > STALE_DISPATCH_THRESHOLD_MIN) {
                const advisory = {
                    role: state.next_role,
                    dispatched_at: state.dispatched_at,
                    elapsed_minutes: Math.floor(elapsedMin),
                    threshold_minutes: STALE_DISPATCH_THRESHOLD_MIN,
                    message: `stale in-flight dispatch: ${state.next_role}, ` +
                        `no state write for >${STALE_DISPATCH_THRESHOLD_MIN} min. ` +
                        // Crash-Resume pointer. The recovery steps live only in the
                        // coordinator skill text; if the coordinator itself is the one
                        // that died (or a lite/fresh session takes over), this line is
                        // the only in-band copy. One sentence, appended to the SAME
                        // message field the stale-notify watch-file emit shares — no new
                        // advisory key, byte shape unchanged for consumers. (E29)
                        `Crash-Resume: ground-truth before re-dispatch — compare git status/diff ` +
                        `against handoff claims, honor dispatch_pins, then resume the incumbent ` +
                        `role (never blind re-dispatch); full protocol: skill-coordinator ` +
                        `Crash-Resume Protocol.`,
                };
                // Opt-in push channel on the same threshold crossing: when the
                // workspace set `staleDispatchNotifyFile` in .current/.config.json,
                // write the advisory to that watch-file so an EXTERNAL watcher can
                // show it without waiting for the next read. Like the advisory
                // itself: never throws, never blocks the read (every failure becomes
                // a loud `notify.error`), and does nothing when the key is absent (no
                // `notify` key at all, so the payload is unchanged). Dedupe lives in
                // the watch-file, not in handoff state. (E22)
                const notify = notifyStaleDispatch(workspacePath, advisory);
                staleDispatch = { ...advisory, ...(notify && { notify }) };
            }
        }
    }
    return JSON.stringify({
        exists: true,
        ...view,
        ...(staleDispatch && { stale_dispatch: staleDispatch }),
        ...(exemptions && { exemptions }),
        ...(configError && { config_error: configError }),
        ...(laneRegistry && { lane_registry: laneRegistry }),
    });
}
//# sourceMappingURL=handoff-parse.js.map