// Coded by @sr-engineer
// Tools: handoff.md parse/migrate/read responsibility (E36 —
// e36-handoff-split-overload-adapter). Extracted verbatim from tools/handoff.ts
// (pre-split readAndMigrate ~342 / parseHandoff ~516 / readHandoffState ~526 +
// the four field-parse helpers), which stays a thin barrel re-exporting this
// module's public surface so no importer churns. Kept SEPARATE from
// tools/handoff-write.ts (the write responsibility) per the split's stated
// goal: four responsibilities living in one file (parse/migrate, write, tool
// handler, types) collapsed into one undifferentiated 1,276-line unit.
//
// NOTE — deliberate circular import with tools/handoff-write.ts: readAndMigrate
// / readHandoffState's migration write-back heal calls writeHandoffState (this
// module → handoff-write.ts), and writeHandoffState's existing-state preserve
// logic calls parseHandoff (handoff-write.ts → this module). That cycle
// pre-dates this split (both directions lived in the same file); splitting
// the file makes it a real cross-module ES import cycle instead of an
// intra-file call graph. This is safe: both directions are ordinary function
// calls made at RUNTIME (inside function bodies), never read at module-init
// time, so Node's ESM live-binding semantics resolve it without error
// regardless of which module is imported first.
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { markStateRead } from "../guards/session.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
import { loadExemptions } from "./exemptions.js";
import { getConfigError } from "./config.js";
import { notifyStaleDispatch } from "./stale-notify.js";
import type { StaleDispatchAdvisory } from "./stale-notify.js";
// Type-only import (erased at compile): the runtime graph stays one-directional
// (transitions.ts never imports handoff.ts / handoff-parse.ts / handoff-write.ts).
import type { AgentName } from "./transitions.js";
// Side-effect import: registers the handoff v0→v1 migration on module load.
// (Relocated here from tools/handoff.ts, E36 — this is the module that
// actually calls runMigrations; ES module caching means the side effect still
// fires exactly once regardless of which file first imports it.)
import "../schema/migrations-handoff.js";
import type {
  HandoffState,
  ExternalRef,
  ExternalRefState,
  ResumeOfTarget,
  ReviewVerdict,
  DispatchMode,
} from "./handoff-types.js";
import { writeHandoffState } from "./handoff-write.js";

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

function getHandoffPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "handoff.md");
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

// v7 — legal value sets for the three protocol fields, for defensive
// parse-time filtering (c9-protocol-fields).
const NEXT_ROLE_VALUES: readonly string[] = [
  "pm",
  "researcher",
  "design-auditor",
  "architect",
  "sr-engineer",
  "code-reviewer",
  "qa-engineer",
  "release-engineer",
];
const RESUME_OF_VALUES: readonly string[] = ["code-reviewer", "qa-engineer"];
const REVIEW_VERDICT_VALUES: readonly string[] = ["APPROVED", "CHANGES_REQUESTED"];
// v11 — legal dispatch_mode values (e2-bugfix-repro-gate), for the same
// defensive parse-time filtering as the three v7 protocol fields.
const DISPATCH_MODE_VALUES: readonly string[] = ["feature", "bugfix"];

// v7 — defensive enum parser for the three protocol frontmatter fields.
// Returns undefined on absent / non-string / out-of-enum raw values (matching
// parseExternalRefs' defensive posture); never throws. Absence stays the
// single "no routing signal recorded" sentinel.
function parseEnumField<T extends string>(
  raw: unknown,
  allowed: readonly string[],
): T | undefined {
  return typeof raw === "string" && allowed.includes(raw) ? (raw as T) : undefined;
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
function parseDispatchPins(raw: unknown): Partial<Record<AgentName, string>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const pins: Partial<Record<AgentName, string>> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (!NEXT_ROLE_VALUES.includes(key)) continue;
    if (typeof value !== "string" || value === "" || value.length > DISPATCH_PIN_VALUE_MAX) continue;
    pins[key as AgentName] = value;
    count++;
  }
  return count > 0 ? pins : undefined;
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
  // v7 — protocol fields (c9-protocol-fields). undefined when absent /
  // out-of-enum, so absence stays the "no routing signal recorded" sentinel.
  const nextRole = parseEnumField<AgentName>(frontmatter.next_role, NEXT_ROLE_VALUES);
  // v10 — dispatched_at stamp (d5-server-side-stale-dispatch-detection).
  // Permissive string passthrough (asString posture): validity of the ISO
  // timestamp is checked at compute time (read-path advisory, T-D5-02), not
  // parse time. undefined when absent, so absence stays the "no dispatch
  // currently in flight" sentinel.
  const dispatchedAt = asString(frontmatter.dispatched_at) || undefined;
  const resumeOf = parseEnumField<ResumeOfTarget>(frontmatter.resume_of, RESUME_OF_VALUES);
  const reviewVerdict = parseEnumField<ReviewVerdict>(
    frontmatter.review_verdict,
    REVIEW_VERDICT_VALUES,
  );
  // v8 — dispatch_pins map (c14-dispatch-pins). undefined when absent /
  // malformed, so absence stays the "no pins recorded" sentinel.
  const dispatchPins = parseDispatchPins(frontmatter.dispatch_pins);
  // v11 — dispatch_mode (e2-bugfix-repro-gate). undefined when absent /
  // out-of-enum, so absence stays the "feature-mode default" sentinel.
  const dispatchMode = parseEnumField<DispatchMode>(
    frontmatter.dispatch_mode,
    DISPATCH_MODE_VALUES,
  );
  // v13 — evidence_schema pin (e23-evidence-schema-versioning). Defensive
  // positive-integer parse; absent/malformed stays undefined — absence is the
  // "pre-E23 feature, v2 normalized-contains default" sentinel (D2), NEVER
  // defaulted to 0 (unlike the counters: 0 is not a legal schema version).
  const evidenceSchemaRaw = Number(frontmatter.evidence_schema);
  const evidenceSchema =
    Number.isFinite(evidenceSchemaRaw) && evidenceSchemaRaw >= 1
      ? Math.floor(evidenceSchemaRaw)
      : undefined;
  const qaRoundRaw = Number(frontmatter.qa_round);
  const qa_round = Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0 ? Math.floor(qaRoundRaw) : 0;
  const reviewRoundRaw = Number(frontmatter.review_round);
  const review_round =
    Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0 ? Math.floor(reviewRoundRaw) : 0;
  const visualRoundRaw = Number(frontmatter.visual_round);
  const visual_round =
    Number.isFinite(visualRoundRaw) && visualRoundRaw >= 0 ? Math.floor(visualRoundRaw) : 0;
  // v9 — hop_count counter (d2-server-brake-accounting). Defaults missing /
  // malformed to 0, the true pre-feature value (DR-3) — identical defensive
  // posture to the three round counters above.
  const hopCountRaw = Number(frontmatter.hop_count);
  const hop_count =
    Number.isFinite(hopCountRaw) && hopCountRaw >= 0 ? Math.floor(hopCountRaw) : 0;
  // v12 — cumulative round totals (e8-success-telemetry). Defaults missing /
  // malformed to 0, the true pre-feature value (v11→v12 seed-0 migration
  // precedent) — the exact hop_count defensive posture, per field.
  const qaRoundsTotalRaw = Number(frontmatter.qa_rounds_total);
  const qa_rounds_total =
    Number.isFinite(qaRoundsTotalRaw) && qaRoundsTotalRaw >= 0 ? Math.floor(qaRoundsTotalRaw) : 0;
  const reviewRoundsTotalRaw = Number(frontmatter.review_rounds_total);
  const review_rounds_total =
    Number.isFinite(reviewRoundsTotalRaw) && reviewRoundsTotalRaw >= 0
      ? Math.floor(reviewRoundsTotalRaw)
      : 0;
  const visualRoundsTotalRaw = Number(frontmatter.visual_rounds_total);
  const visual_rounds_total =
    Number.isFinite(visualRoundsTotalRaw) && visualRoundsTotalRaw >= 0
      ? Math.floor(visualRoundsTotalRaw)
      : 0;

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

  // E24 (exemptions manifest) — read-time surface of .current/exemptions.json,
  // the ONLY sanctioned §2 build-gate exemption channel. Same posture as the
  // v10 stale_dispatch advisory below: pure read-time computation, no handoff
  // schema field, informational, never blocks or throws (loadExemptions
  // collapses every failure to zero-exemptions + loud errors[]). Surfaced on
  // tw_get_state because it is the mandatory first action of every role —
  // the cheapest single point where every agent already looks, so the
  // exemption list (and its only-grows `count` metric) needs no second read
  // and no drift-advisory plumbing. File-mode read path only, matching the
  // sibling E10/E18 file-mode posture.
  const exemptions = loadExemptions(workspacePath);

  // E31 (e31-config-nonfatal) — loud surface for a .current/.config.json that
  // exists but cannot be used (unreadable / unparseable / non-object root /
  // future schema_version). loadConfig degrades to defaults instead of
  // throwing out of the markStateRead task-path resolution above (the
  // pre-existing call site that made the mandatory pre-flight read throw —
  // E22 QA Phase 1 finding); this field is what keeps that degradation
  // readable rather than silent. null (clean or absent config) adds no key —
  // valid/absent config envelopes stay byte-identical.
  const configError = getConfigError(workspacePath);

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

  // v10 — stale-dispatch advisory (d5-server-side-stale-dispatch-detection,
  // DR-1). Pure read-time computation over persisted next_role + dispatched_at
  // + wall clock: a fresh/post-compaction session with NO memory of dispatching
  // gets the identical signal (AC-4). Informational only — never blocks a
  // write, no GateErrorCode (DR-6). Defensive by construction: absence of
  // either field, an unparsable stamp, or an in-window stamp all yield no key
  // (AC-5); nothing here can throw or fail the read.
  let staleDispatch: Record<string, unknown> | undefined;
  if (state.next_role && state.dispatched_at) {
    const stampedMs = Date.parse(state.dispatched_at);
    if (Number.isFinite(stampedMs)) {
      // malformed stamp ⇒ no signal, never throw
      const elapsedMin = (Date.now() - stampedMs) / 60000;
      if (elapsedMin > STALE_DISPATCH_THRESHOLD_MIN) {
        const advisory: StaleDispatchAdvisory = {
          role: state.next_role,
          dispatched_at: state.dispatched_at,
          elapsed_minutes: Math.floor(elapsedMin),
          threshold_minutes: STALE_DISPATCH_THRESHOLD_MIN,
          message:
            `stale in-flight dispatch: ${state.next_role}, ` +
            `no state write for >${STALE_DISPATCH_THRESHOLD_MIN} min. ` +
            // E29 — Crash-Resume pointer. The recovery protocol lives in the
            // coordinator skill text only; if the coordinator itself is the
            // dead party (or a lite/fresh session takes over), this line is
            // the only in-band copy. One sentence, appended to the SAME
            // message field the stale-notify watch-file emit shares — no new
            // advisory key, byte-shape unchanged for consumers.
            `Crash-Resume: ground-truth before re-dispatch — compare git status/diff ` +
            `against handoff claims, honor dispatch_pins, then resume the incumbent ` +
            `role (never blind re-dispatch); full protocol: skill-coordinator ` +
            `Crash-Resume Protocol.`,
        };
        // E22 — opt-in push channel on the same threshold crossing: when the
        // workspace armed `staleDispatchNotifyFile` in .current/.config.json,
        // write the advisory to that watch-file so an EXTERNAL watcher can
        // surface it without waiting for the next pull. Same posture as the
        // advisory itself: never throws, never blocks the read (all failure
        // modes collapse to a loud `notify.error`), no-op when the key is
        // absent (null → no `notify` key at all, byte-identical pre-E22
        // payload). Dedupe lives in the watch-file, not in handoff state.
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
  });
}
