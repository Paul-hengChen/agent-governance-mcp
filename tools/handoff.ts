// Coded by @sr-engineer
// Tools: handoff state read/write with format enforcement

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  markStateRead,
  verifyFreshness,
  refreshSnapshotFor,
} from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { getActiveStorage } from "./storage.js";
import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
// Side-effect import: registers the handoff v0→v1 migration on module load.
import "../schema/migrations-handoff.js";

// External-reference ledger entry state (handoff schema v6,
// b8-external-ref-ledger). Closed enum (spec AC-9/S03): `unresolved` is the
// ONLY blocking state; the other three all clear the gate.
export type ExternalRefState =
  | "fetched"
  | "indexed"
  | "user-confirmed-ignorable"
  | "unresolved";

// One external-reference ledger entry. `ref` is free text (URL / design-file /
// ticket id) — NOT validated for reachability (spec Out of Scope); only
// `state` is validated (closed enum, enforced by zod at the tool boundary).
export interface ExternalRef {
  ref: string;
  state: ExternalRefState;
}

export interface HandoffState {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason?: string;
  last_agent?: string;
  completed_tasks: string[];
  pending_notes: string[];
  // QA round counter — incremented on (qa-engineer, FAIL), reset on PASS or
  // PM re-entry. Round-cap override (>= 4) blocks all transitions except
  // (pm, In_Progress). Backward-compat: parser defaults missing field to 0.
  qa_round: number;
  // Code-reviewer round counter — incremented on (code-reviewer, FAIL),
  // reset on handoff to qa-engineer or PM re-entry. Symmetric to qa_round
  // with its own REVIEW_ROUND_CAP. Backward-compat: parser defaults to 0.
  review_round: number;
  // Visual-fidelity round counter (v3.14.0) — incremented on (qa-engineer,
  // FAIL) when pending_notes contains `visual_fail:`. Independent of
  // qa_round / review_round; tracks pixel-perfect iteration only.
  // Backward-compat: parser defaults missing field to 0 (v2→v3 migration
  // also stamps the field).
  visual_round: number;
  // Optional absolute path to the workspace's PRD file. Consumed by the RAG
  // lazy-reindex hook in prompts/build.ts:appendSpecContext. When absent, the
  // hook falls back to discovering PRD.md/docs/PRD.md/specs/PRD.md.
  prd_path?: string;
  // Scope-decision attestation (handoff schema v4, server-scope-decision-gate).
  // Set to "single-feature" by the PM to attest the feature is appropriately
  // scoped as-is; satisfies the SCOPE_DECISION_REQUIRED gate in index.ts.
  // ABSENT by default — undefined === "no attestation recorded" === gate may
  // fire. No synthetic default is ever seeded (v3→v4 migration is a no-op).
  scope_decision?: string;
  // Optional free-text rationale accompanying scope_decision. Not validated by
  // the server; recorded for the audit trail / next reader.
  scope_decision_why?: string;
  // Ticket-cut approval attestation (handoff schema v5, pm-cut-approval-gate).
  // Set to `true` by the PM on its pm:In_Progress write AFTER presenting the
  // cut draft inline and obtaining human approval. Satisfies the
  // CUT_APPROVAL_REQUIRED gate on the build-entry edge.
  // ABSENT by default — undefined === "no approval recorded" === gate may fire.
  // Pure boolean: the ONLY meaningful set value is `true`. A literal `false`
  // is treated identically to absence by the gate (gate fires unless === true).
  // FEATURE-SCOPED (see writeHandoffState reset/preserve rule): NOT preserved
  // across an active_feature change, and reset to undefined on every PM
  // In_Progress re-entry that does not explicitly re-pass it.
  cut_approved?: boolean;
  // External-reference ledger (handoff schema v6, b8-external-ref-ledger).
  // Populated by the PM during the Resource Audit Gate: one entry per external
  // artifact the spec references, each classified fetched/indexed/
  // user-confirmed-ignorable/unresolved. Backs the EXTERNAL_REFS_UNRESOLVED
  // build-entry gate. ABSENT by default — undefined === "PM found zero external
  // references" === gate CLEARS (inverse polarity to cut_approved, where absence
  // BLOCKS; see architecture DR-3). FEATURE-SCOPED preserve: carried forward
  // across same-feature writes that omit it, dropped on any active_feature
  // change. NOT re-armed on PM re-entry (DR-4). FILE-MODE ONLY: never
  // round-trips in SQLite. Surfaced verbatim to tw_get_state readers via the
  // `{ ...state }` view in readHandoffState (User Story 3 — the architect reads
  // the ledger from there; do not "optimize away" as unused).
  external_refs?: ExternalRef[];
}

// Cap the completed_tasks array returned by readState() so long projects
// don't bloat the LLM context. The full list is still in handoff.md.
const COMPLETED_TASKS_RETURN_LIMIT = 50;

// Cap the total character length of pending_notes returned by readState().
// Long deliverable descriptions (common in sr-engineer handoffs) can bloat
// the LLM context on every tw_get_state call. Full notes remain on disk.
const PENDING_NOTES_CHAR_LIMIT = 3000;

function getHandoffPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "handoff.md");
}

function ensureDir(workspacePath: string): void {
  const dir = path.join(workspacePath, ".current");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractSectionContent(body: string, headingPattern: RegExp): string {
  const match = body.match(headingPattern);
  if (!match || match.index === undefined) return "";
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextSection = rest.search(/\n##\s/);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

interface HandoffReadResult {
  state: HandoffState;
  migrationApplied: boolean;
}

// The four legal external_refs states, for defensive parse-time filtering.
const EXTERNAL_REF_STATES: readonly string[] = [
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
function parseExternalRefs(raw: unknown): ExternalRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs: ExternalRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { ref, state } = entry as { ref?: unknown; state?: unknown };
    if (typeof ref !== "string" || ref === "") continue;
    if (typeof state !== "string" || !EXTERNAL_REF_STATES.includes(state)) continue;
    refs.push({ ref, state: state as ExternalRefState });
  }
  return refs.length > 0 ? refs : undefined;
}

// Internal helper. Reads + parses + runs schema migrations. Returns the
// migrated state plus a flag that lets readHandoffState fire a write-back
// to heal the on-disk file. Callers that don't need the flag use parseHandoff.
function readAndMigrate(workspacePath: string): HandoffReadResult | null {
  const handoffPath = getHandoffPath(workspacePath);
  if (!fs.existsSync(handoffPath)) return null;

  const content = fs.readFileSync(handoffPath, "utf-8");

  // Parse YAML frontmatter with js-yaml (handles quotes, colons in values, etc.)
  let rawFrontmatter: Record<string, unknown> = {};
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (yamlMatch) {
    try {
      const parsed = yaml.load(yamlMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        rawFrontmatter = parsed as Record<string, unknown>;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse handoff.md frontmatter: ${message}`);
    }
  }

  // Schema-versioning lazy migrate-on-read (Phase 4). Bumps an absent or
  // older schema_version up to CURRENT_VERSIONS.handoff. Throws refuse-loud
  // on future versions — propagates to the caller intentionally.
  const migration = runMigrations<Record<string, unknown>>("handoff", rawFrontmatter);
  const frontmatter = migration.payload;
  const migrationApplied = migration.applied.length > 0;

  const asString = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

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
  const qaRoundRaw = Number(frontmatter.qa_round);
  const qa_round = Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0 ? Math.floor(qaRoundRaw) : 0;
  const reviewRoundRaw = Number(frontmatter.review_round);
  const review_round =
    Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0 ? Math.floor(reviewRoundRaw) : 0;
  const visualRoundRaw = Number(frontmatter.visual_round);
  const visual_round =
    Number.isFinite(visualRoundRaw) && visualRoundRaw >= 0 ? Math.floor(visualRoundRaw) : 0;

  const state: HandoffState = {
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
    completed_tasks,
    pending_notes,
    qa_round,
    review_round,
    visual_round,
  };

  // One-shot stderr warning on v1→v2 migration when an in-flight ticket sits at
  // sr-engineer:In_Progress. After v2, that tuple can no longer transition
  // directly to qa-engineer; operator must manually re-route to code-reviewer.
  if (
    migration.applied.includes(2) &&
    state.last_agent === "sr-engineer" &&
    state.status === "In_Progress"
  ) {
    process.stderr.write(
      "[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — " +
        "next transition to qa-engineer will be rejected. " +
        "Manually re-route to code-reviewer or roll back to pm.\n",
    );
  }

  return { state, migrationApplied };
}

/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist. Runs schema migrations in-memory; does
 * NOT write back (callers that need persistence go through readHandoffState).
 */
export function parseHandoff(workspacePath: string): HandoffState | null {
  const result = readAndMigrate(workspacePath);
  return result ? result.state : null;
}

/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 * Triggers a fire-and-forget write-back when schema migrations were applied,
 * so the on-disk file heals to CURRENT on the first read.
 */
export function readHandoffState(workspacePath: string): string {
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
    void writeHandoffState(
      workspacePath,
      state.active_feature,
      state.status,
      state.completed_tasks,
      state.pending_notes,
      state.blocking_reason,
      state.last_agent,
      state.qa_round,
      state.prd_path,
      state.review_round,
      state.visual_round,
    ).catch(() => {
      /* swallowed — read still returns migrated state */
    });
  }

  const truncated = state.completed_tasks.length > COMPLETED_TASKS_RETURN_LIMIT;

  // Truncate pending_notes by total character count. Keep notes from the
  // front (routing directives like "next_role: ..." appear first and are
  // most important). Drop trailing notes that push past the limit.
  let pendingNotes = state.pending_notes;
  let pendingTruncated = false;
  const totalChars = pendingNotes.reduce((sum, n) => sum + n.length, 0);
  if (totalChars > PENDING_NOTES_CHAR_LIMIT) {
    const kept: string[] = [];
    let charBudget = PENDING_NOTES_CHAR_LIMIT;
    for (const note of pendingNotes) {
      if (charBudget <= 0) break;
      if (note.length <= charBudget) {
        kept.push(note);
        charBudget -= note.length;
      } else {
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
  return JSON.stringify({ exists: true, ...view });
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
  prdPath?: string;
  reviewRound?: number;
  visualRound?: number;
  // v4 — scope-decision attestation (server-scope-decision-gate). Emitted into
  // frontmatter only when truthy; preserved across writes that omit it.
  scopeDecision?: string;
  scopeDecisionWhy?: string;
  // v5 — cut-approval attestation (pm-cut-approval-gate). Emitted into
  // frontmatter only when === true. Unlike scopeDecision, this field is NOT
  // blindly preserved across omitting writes — see the feature-scoped reset
  // rule in writeHandoffState (it re-arms on every PM In_Progress re-entry and
  // on any active_feature change).
  cutApproved?: boolean;
  // v6 — external-reference ledger (b8-external-ref-ledger). REPLACE semantics
  // when provided (wholesale, like completedTasks — never merged); feature-
  // scoped preserve-if-omitted, reset ONLY on active_feature change, NOT on PM
  // re-entry (inverse polarity to cutApproved — see writeHandoffState).
  externalRefs?: ExternalRef[];
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
): Promise<string>;
export async function writeHandoffState(
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
): Promise<string> {
  // Discriminate by first-arg shape. Options-object branch when the first
  // argument is a non-null, non-array object. After this block, all locals
  // below are guaranteed non-undefined for the required fields.
  let workspacePath: string;
  let scopeDecision: string | undefined;
  let scopeDecisionWhy: string | undefined;
  let cutApproved: boolean | undefined;
  // v6 — external_refs ledger. The positional overload leaves it undefined
  // (positional callers — including the migration-heal write — never pass it;
  // the same-feature preserve clause below carries any existing ledger
  // forward, DR-8).
  let externalRefs: ExternalRef[] | undefined;
  if (
    typeof workspacePathOrOpts === "object" &&
    !Array.isArray(workspacePathOrOpts)
  ) {
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
    scopeDecision = o.scopeDecision;
    scopeDecisionWhy = o.scopeDecisionWhy;
    cutApproved = o.cutApproved;
    externalRefs = o.externalRefs;
  } else {
    workspacePath = workspacePathOrOpts as string;
    // Positional defaults preserved for backwards-compat callers passing < 11 args.
    completedTasks = completedTasks ?? [];
    pendingNotes = pendingNotes ?? [];
  }
  // Hoist required-from-overload strings to non-optional locals; the
  // overload signatures (positional + options) both make these required, so
  // the narrowing here is a compile-time assertion only.
  const _activeFeature: string = activeFeature as string;
  const _status: string = status as string;
  ensureDir(workspacePath);
  const handoffPath = getHandoffPath(workspacePath);
  const lockPath = path.join(workspacePath, ".current", ".handoff.lock");

  return withFileLock(lockPath, () => {
    // Reject if another process / hand-edit touched the file since we read it.
    verifyFreshness(workspacePath, handoffPath, "handoff");

    const now = new Date().toISOString();

    const completedList = (completedTasks as string[]).length
      ? (completedTasks as string[]).map((t) => `- [x] ${t}`).join("\n")
      : "- (none)";
    // Plain list items (no checkbox) so they are visually distinct from task IDs.
    const pendingList = (pendingNotes as string[]).length
      ? (pendingNotes as string[]).map((t) => `- ${t}`).join("\n")
      : "- (none)";

    // Value type admits ExternalRef[] for the external_refs block sequence
    // (DR-5 — the first array-of-object frontmatter field; js-yaml dump
    // serializes it losslessly with the existing options, DR-1).
    const frontmatterData: Record<string, string | number | boolean | ExternalRef[]> = {
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
    if (
      effectivePrdPath === undefined ||
      effectiveScopeDecision === undefined ||
      effectiveScopeDecisionWhy === undefined ||
      cutApprovalNeedsExisting ||
      externalRefsNeedsExisting
    ) {
      const existing = parseHandoff(workspacePath);
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
    }
    // clauses (1)/(2): explicit PM approval, or PM re-entry re-arm. These do not
    // depend on `existing`, so they resolve regardless of the read above.
    if (cutApproved === true) {
      effectiveCutApproved = true;
    } else if (isPmReentry) {
      effectiveCutApproved = undefined;
    }
    if (effectivePrdPath) frontmatterData.prd_path = effectivePrdPath;
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
    return JSON.stringify({ success: true, path: handoffPath, updated_at: now });
  });
}

// ==========================================
// MCP tool handler (registry-pattern) — verbatim relocation of the
// index.ts `tw_get_state` dispatcher case. args arrive pre-parsed by
// tools/registry.ts defineTool.run; type import is erased at compile so
// the runtime graph stays one-directional (registry.ts → handoff.ts).
// ==========================================

// --- No guard: reading state IS the pre-flight check ---
export async function handleGetState(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const result = getActiveStorage().readState(workspace_path);
  return { content: [{ type: "text" as const, text: result }] };
}
