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
import { loadExemptions } from "./exemptions.js";
import { notifyStaleDispatch } from "./stale-notify.js";
import type { StaleDispatchAdvisory } from "./stale-notify.js";
// Type-only import (erased at compile): the runtime graph stays one-directional
// (transitions.ts never imports handoff.ts).
import type { AgentName } from "./transitions.js";
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

// Amend-Resume target set (handoff schema v7, c9-protocol-fields). Restricted
// to the exact two roles the Amend-Resume Edge in tools/transitions.ts allows.
export type ResumeOfTarget = "code-reviewer" | "qa-engineer";

// Code-reviewer verdict values (handoff schema v7, c9-protocol-fields).
export type ReviewVerdict = "APPROVED" | "CHANGES_REQUESTED";

// Dispatch-mode classification (handoff schema v11, e2-bugfix-repro-gate).
export type DispatchMode = "feature" | "bugfix";

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
  // v9 (d2-server-brake-accounting) — feature-scoped role-transition counter.
  // Computed server-side by computeNewRound; enforced by the HOP_CAP_EXCEEDED
  // override in validateTransition. Always emitted (even 0), parser defaults
  // missing to 0 — identical treatment to qa_round/review_round/visual_round.
  // Feature-scoped: resets ONLY on active_feature change (NOT on PM re-entry,
  // DR-6 — the hop cap is a session-length circuit breaker, harder to clear
  // than the per-task round caps by design).
  hop_count: number;
  // v12 (e8-success-telemetry) — cumulative per-feature round totals. Each
  // ticks in lock-step with its per-cycle counter's FAIL branch (computed by
  // computeNewRound, single site) but NEVER resets except on active_feature
  // change — NOT on QA PASS, NOT on (pm, In_Progress) re-entry (hop_count's
  // reset rule byte-for-byte, AC8). FILE-MODE runtime treatment is identical
  // to hop_count: the parser ALWAYS materializes all three (missing/malformed
  // defaults to 0) and the serializer ALWAYS emits them (even 0). Declared
  // OPTIONAL at the type level ONLY because their persistence is file-mode-only
  // (DR-1: storage-sqlite.ts is untouched — sqlite schema stays v2, and its
  // parse() never constructs them; their sole consumer, the release-close
  // metrics emit, fires only under FileHandoffStorage). Consumers read via
  // `state.qa_rounds_total ?? 0` (the blueprint's own access pattern).
  qa_rounds_total?: number;
  review_rounds_total?: number;
  visual_rounds_total?: number;
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
  // Single-hop routing directive to the IMMEDIATE next reader (handoff schema
  // v7, c9-protocol-fields). Enum-validated at the zod boundary against the 8
  // AgentName values. Advisory metadata only — NOT cross-checked against
  // ALLOWED_TRANSITIONS (AC-6, DR-4). TRANSIENT (AC-3): identical in lifetime
  // to the pending_notes line it replaces — absent on any write that omits it,
  // NEVER carried forward. Do NOT "fix" this into the prd_path/scope_decision
  // blind-preserve or the external_refs/cut_approved feature-scoped preserve:
  // a stale next_role from three writes ago lingering silently would be a
  // behavioral regression versus the wholesale-replaced pending_notes it
  // replaced.
  next_role?: AgentName;
  // v10 (d5-server-side-stale-dispatch-detection) — server-stamped ISO-8601
  // UTC timestamp recording WHEN this write set next_role. Direct companion to
  // next_role: emitted by writeHandoffState iff next_role is set on THIS write,
  // and — like next_role — never carried forward from existing state (transient,
  // write-scoped, AC-3). NOT client-supplied: derived from the write's own
  // now(). Absence === "no dispatch currently in flight" (the next_role /
  // scope_decision absence-is-signal precedent, NOT hop_count's seed-0). FILE-
  // MODE ONLY: SqliteHandoffStorage.writeState never persists next_role, so it
  // never stamps this either (DR-5).
  dispatched_at?: string;
  // Which stranded role a PM Amend-Resume write targets (handoff schema v7).
  // Consumed by validateTransition via TransitionRequest.next_resume_of
  // (AC-4) — NOT by a pending_notes grep. Trust class of scope_decision_why:
  // the server checks only that it names the exact target role being handed
  // off to; "genuinely stranded" stays the PM's honest attestation.
  // TRANSIENT (AC-3): see next_role.
  resume_of?: ResumeOfTarget;
  // Code-reviewer verdict (handoff schema v7). Server-checked for consistency
  // against `status` by the REVIEW_VERDICT_STATUS_MISMATCH orchestrator gate
  // (AC-5): APPROVED pairs with In_Progress, CHANGES_REQUESTED with FAIL.
  // Optional even on code-reviewer writes — absence never fires the gate.
  // TRANSIENT (AC-3): see next_role.
  review_verdict?: ReviewVerdict;
  // Human model-tier pins per role (handoff schema v8, c14-dispatch-pins).
  // Keys closed to the 8 AgentName values (zod-rejected at the tool boundary;
  // defensively dropped at parse time); values are bounded free text naming
  // the pinned model tier (NOT closed-enum — the model vocabulary is not owned
  // by this server, spec AC-2). DURABLE DIRECTIVE, not a single-hop routing
  // signal: REPLACE-wholesale when provided; FEATURE-SCOPED preserve when
  // omitted — carried forward across same-feature writes, dropped on any
  // active_feature change, NOT re-armed on PM re-entry (the exact external_refs
  // algorithm, spec AC-3/AC-4 Decision Record — do NOT "fix" this into the
  // transient next_role lifetime or the cut_approved PM-re-entry re-arm by
  // analogy). ABSENT by default — undefined === "no pins recorded". FILE-MODE
  // ONLY (AC-5): SqliteHandoffStorage.writeState ignores it. Surfaced verbatim
  // to tw_get_state readers via the `{ ...state }` view (User Story 2 — the
  // dispatched role reads its OWN pin to stamp its watermark at the source).
  dispatch_pins?: Partial<Record<AgentName, string>>;
  // Dispatch-mode ticket classification (handoff schema v11,
  // e2-bugfix-repro-gate). Absence === "feature" (the default) — a bugfix-mode
  // ticket is marked by the PM at cut time with dispatch_mode: "bugfix", which
  // arms the file-mode repro-first gate (REPRO_MANIFEST_MISSING) on the
  // sr-engineer:In_Progress → code-reviewer:In_Progress fix-phase edge and
  // makes QA's Phase 0.5 expected-red disposition load-bearing. FEATURE-SCOPED
  // (the exact dispatch_pins/external_refs algorithm, but SCALAR): carried
  // across same-active_feature writes that omit it, dropped on active_feature
  // change, NOT re-armed on PM re-entry (a stable ticket classification,
  // unlike cut_approved which re-arms per cut). Changeable by an explicit PM
  // write (AC4 opt-back-in: set "feature" or route to architect). FILE-MODE
  // ONLY: SqliteHandoffStorage.writeState ignores it (mirrors dispatch_pins
  // DR-5) — the gates it arms are file-mode only anyway. dispatch_mode never
  // gates a transition edge; transitions.ts stays pure (DR on AC1/AC5).
  dispatch_mode?: DispatchMode;
  // Evidence-schema pin (handoff schema v13, e23-evidence-schema-versioning
  // D1). SERVER-STAMPED, NEVER CLIENT-SUPPLIED: the orchestrator stamps
  // EVIDENCE_SCHEMA_CURRENT (gates/evidence-schema.ts) on the first accepted
  // write of a new active_feature — there is deliberately NO zod arg on
  // tw_update_state for it. Pins which evidence-heading-match convention the
  // qa_reports/*.md gate predicates run under for the LIFE of the feature
  // (v1 = exact-anchored H2 match, v2 = normalized-contains), so a
  // mid-flight tightening of the conventions can never retroactively
  // invalidate crash-era artifacts (the 104447-F0 incident class).
  // FEATURE-SCOPED (the exact dispatch_mode scalar algorithm): carried
  // across same-active_feature writes that omit it, dropped on
  // active_feature change (then re-stamped by the orchestrator at the new
  // feature's first write), NOT re-armed on PM re-entry. ABSENT for pre-E23
  // in-flight features — absence gets the v2 normalized-contains default at
  // the gates (D2 fallback: v2 is a strict superset of v1, it can only
  // newly ACCEPT; the v12→v13 migration invents NO pin). FILE-MODE ONLY:
  // SqliteHandoffStorage ignores it (both evidence gates are file-mode-only).
  evidence_schema?: number;
}

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

  const result = readAndMigrate(workspacePath);
  if (!result) {
    // Surface the manifest even before the first handoff write: an adopted
    // workspace may declare exemptions before governance state exists, and
    // sanctioned exemptions must never be silently hidden.
    return JSON.stringify({
      exists: false,
      message: "No handoff state found. This is a fresh project — initialize by calling tw_update_state.",
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
            `no state write for >${STALE_DISPATCH_THRESHOLD_MIN} min`,
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
  });
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
  // v9 — hop_count counter (d2-server-brake-accounting). Server-computed by
  // computeNewRound and threaded through the orchestrator; always emitted to
  // frontmatter (even 0), normalised like the three round counters. NOT
  // preserved-if-omitted: an omitting write normalises to 0, matching
  // qaRound/reviewRound/visualRound semantics exactly.
  hopCount?: number;
  // v12 — cumulative round totals (e8-success-telemetry). Server-computed by
  // computeNewRound and threaded through the orchestrator; always emitted to
  // frontmatter (even 0), normalised like hopCount. NOT preserved-if-omitted:
  // an omitting write normalises to 0, matching hopCount semantics exactly.
  // NOT added to the legacy positional overload (architecture DR: the heal
  // call site converts to this options object instead of growing to 15
  // positional params). FILE-MODE only (DR-1): SqliteHandoffStorage.writeState
  // ignores all three.
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
  // rule in writeHandoffState (it re-arms on every PM In_Progress re-entry and
  // on any active_feature change).
  cutApproved?: boolean;
  // v6 — external-reference ledger (b8-external-ref-ledger). REPLACE semantics
  // when provided (wholesale, like completedTasks — never merged); feature-
  // scoped preserve-if-omitted, reset ONLY on active_feature change, NOT on PM
  // re-entry (inverse polarity to cutApproved — see writeHandoffState).
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
  // v11 — dispatch_mode (e2-bugfix-repro-gate). Scalar sibling of
  // dispatchPins: feature-scoped preserve-if-omitted, reset ONLY on
  // active_feature change, NOT on PM re-entry (NOT the transient nextRole
  // lifetime, NOT the cutApproved re-arm — bug-vs-feature is a stable ticket
  // classification for the life of the feature). Emitted to frontmatter only
  // when set; absence === "feature" (the default). FILE-MODE only:
  // SqliteHandoffStorage.writeState ignores it.
  dispatchMode?: DispatchMode;
  // v13 — evidence_schema pin (e23-evidence-schema-versioning D1). Scalar
  // sibling of dispatchMode with the identical feature-scoped algorithm:
  // preserve-if-omitted within the same active_feature, drop on
  // active_feature change, NO PM-re-entry re-arm. SET ONLY BY THE
  // ORCHESTRATOR (feature_changed → EVIDENCE_SCHEMA_CURRENT) — never from a
  // client arg; positional callers and the migration heal-write leave it
  // undefined and the same-feature carry preserves any existing pin. Emitted
  // to frontmatter only when set; absence === "pre-E23 feature, v2
  // normalized-contains default at the gates" (D2). FILE-MODE only:
  // SqliteHandoffStorage.writeState ignores it.
  evidenceSchema?: number;
  // E10 — bookkeeping-write attestation (e10-lease-override AC4/AC5). When
  // true, PRESERVE the existing on-disk last_updated verbatim (same-
  // active_feature only — defense-in-depth, DR-5) instead of stamping now(),
  // so a non-substantive touch (failure record, migration heal) cannot extend
  // the incumbent feature's lease. NOT emitted to frontmatter — it only
  // selects the timestamp (no schema bump, DR-1). TRANSIENT: never persisted,
  // never carried forward. FILE-MODE only: SqliteHandoffStorage.writeState
  // ignores it (spec AC9).
  bookkeepingWrite?: boolean;
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
  hopCount?: number,
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
  // v7 — protocol fields. Positional overload leaves all three undefined
  // (transient AC-3 semantics: an omitting write — including the
  // migration-heal write in readHandoffState — simply drops them).
  let nextRole: AgentName | undefined;
  let resumeOf: ResumeOfTarget | undefined;
  let reviewVerdict: ReviewVerdict | undefined;
  // v8 — dispatch_pins map. The positional overload leaves it undefined
  // (positional callers — including the migration-heal write — never pass it;
  // the same-feature preserve clause below carries any existing pins forward,
  // mirroring external_refs' DR-8 posture).
  let dispatchPins: Partial<Record<AgentName, string>> | undefined;
  // v11 — dispatch_mode scalar. The positional overload leaves it undefined
  // (positional callers — including the migration-heal write — never pass it;
  // the same-feature preserve clause below carries any existing value forward,
  // mirroring dispatch_pins' DR-8 posture).
  let dispatchMode: DispatchMode | undefined;
  // v13 — evidence_schema pin. Same positional-overload posture as
  // dispatchMode: undefined unless the orchestrator stamps it, with the
  // same-feature preserve clause carrying any existing pin forward.
  let evidenceSchema: number | undefined;
  // v12 — cumulative round totals. Options-object only (the positional
  // overload deliberately does NOT grow — architecture DR); a positional call
  // leaves them undefined and the always-emit blocks below normalise to 0.
  let qaRoundsTotal: number | undefined;
  let reviewRoundsTotal: number | undefined;
  let visualRoundsTotal: number | undefined;
  // E10 — bookkeeping-write attestation. Options-object only: the positional
  // overload leaves it undefined (the heal-write call site uses the options
  // object; a positional caller always gets the fresh-stamp default).
  let bookkeepingWrite: boolean | undefined;
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
    let effectiveDispatchMode: DispatchMode | undefined = dispatchMode;
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
    let effectiveEvidenceSchema: number | undefined = evidenceSchema;
    const evidenceSchemaNeedsExisting = evidenceSchema === undefined;
    // E10 — `existing` is hoisted out of the preserve block so the timestamp
    // resolution below can read it; a bookkeeping write joins the trigger
    // condition (it needs existing.last_updated). All other paths are
    // unchanged: `existing` stays null unless some preserve clause needed the
    // read, exactly as before.
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
      bookkeepingWrite === true
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
    if (nextRole) frontmatterData.next_role = nextRole;
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
    if (nextRole) frontmatterData.dispatched_at = now;
    if (resumeOf) frontmatterData.resume_of = resumeOf;
    if (reviewVerdict) frontmatterData.review_verdict = reviewVerdict;
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
export async function handleGetState(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const result = getActiveStorage().readState(workspace_path);
  return { content: [{ type: "text" as const, text: result }] };
}
