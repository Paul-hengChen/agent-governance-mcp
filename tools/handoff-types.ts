// Coded by @sr-engineer
// Shared handoff.md types. Kept in their own module so the parse module
// (tools/handoff-parse.ts) and the write module (tools/handoff-write.ts) can
// share the HandoffState / protocol-field types WITHOUT importing each
// other's types — only the two runtime functions (parseHandoff /
// writeHandoffState) cross the parse↔write boundary (the heal-write /
// existing-state-preserve circular call; see the top-of-file notes in both
// modules). tools/handoff.ts re-exports every type below verbatim so
// importers of the barrel never change. (E36)

// Type-only import (erased at compile): the runtime graph stays one-directional
// (transitions.ts never imports handoff.ts / handoff-parse.ts / handoff-write.ts).
import type { AgentName } from "./transitions.js";

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

// Dispatch-mode classification. (handoff schema v11, E2)
export type DispatchMode = "feature" | "bugfix";

// Per-hop dispatch-mechanism attestation values: which mechanism carried
// THIS hop — a Task-spawned subagent, an in-context tw_switch_role swap, or
// inline work with no role hand-off at all. Attested, not verified.
// (handoff schema v15, E99)
export type DispatchMechanism = "task" | "switch_role" | "inline";

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
  // Cumulative per-feature round totals. Each ticks in step with its
  // per-cycle counter's FAIL branch (computed in one place, computeNewRound)
  // but NEVER resets except when active_feature changes — not on QA PASS,
  // not on (pm, In_Progress) re-entry (exactly hop_count's reset rule). In
  // file mode they behave like hop_count: the parser ALWAYS fills all three
  // (missing/malformed defaults to 0) and the serializer ALWAYS writes them
  // (even 0). Optional at the type level ONLY because only file mode
  // persists them (storage-sqlite.ts is untouched — the sqlite schema stays
  // v2 and its parse() never sets them; their only consumer, the
  // release-close metrics emit, runs only under FileHandoffStorage).
  // Consumers read `state.qa_rounds_total ?? 0`. (E8, handoff schema v12)
  qa_rounds_total?: number;
  review_rounds_total?: number;
  visual_rounds_total?: number;
  // Optional absolute path to the workspace's PRD file. Consumed by the RAG
  // lazy-reindex hook in prompts/build.ts:appendSpecContext. When absent, the
  // hook falls back to discovering PRD.md/docs/PRD.md/specs/PRD.md.
  // Absolute in memory (resolved at parse); stored workspace-relative on disk. (E235a)
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
  // Cut-approval inheritance attestation. SET BY THE CLIENT, NOT stamped by
  // the server: the writer's own honest claim that this workspace's
  // cut_approved: true was NOT given in this workspace's own conversation
  // but inherited from a parent feature's human approval. The server cannot
  // verify a claim about another workspace, so it records the writer's word
  // rather than stamping something it cannot check (contrast
  // evidence_schema below, which the server stamps because it computes it
  // itself). Shape: "inherited:<parent-feature>" — anything else is dropped
  // defensively at parse time, never rejected at the boundary.
  // FEATURE-SCOPED (the dispatch_mode single-value rule, NOT cut_approved's
  // PM-re-entry reset above): carried across same-active_feature writes that
  // omit it, dropped when active_feature changes, NOT re-armed on PM
  // re-entry — inheritance is a stable fact about how this lane came to
  // exist, not a per-cut approval to be re-given on every PM bounce. ABSENT
  // by default — undefined === "not inherited" (the safe direction; the
  // v13→v14 migration seeds nothing). For the record only: it does NOT by
  // itself satisfy CUT_APPROVAL_REQUIRED or any other gate — no gate
  // predicate reads this field. (E114, handoff schema v14)
  cut_approved_source?: string;
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
  // Dispatch-mode ticket classification. Absence === "feature" (the
  // default). The PM marks a bug-fix ticket at cut time with dispatch_mode:
  // "bugfix", which arms the file-mode repro-first gate
  // (REPRO_MANIFEST_MISSING) on the sr-engineer:In_Progress →
  // code-reviewer:In_Progress fix-phase edge and makes QA's Phase 0.5
  // expected-red check decisive. FEATURE-SCOPED (the dispatch_pins /
  // external_refs rule, for a single value): carried across
  // same-active_feature writes that omit it, dropped when active_feature
  // changes, NOT re-armed on PM re-entry (a stable classification, unlike
  // cut_approved which re-arms per cut). An explicit PM write can change it
  // (set "feature" or route to architect). File mode only:
  // SqliteHandoffStorage.writeState ignores it, like dispatch_pins — the
  // gates it arms are file-mode only anyway. dispatch_mode never gates a
  // transition edge; transitions.ts stays pure. (E2, handoff schema v11)
  dispatch_mode?: DispatchMode;
  // Evidence-schema pin. STAMPED BY THE SERVER, NEVER CLIENT-SUPPLIED: the
  // orchestrator stamps EVIDENCE_SCHEMA_CURRENT (gates/evidence-schema.ts)
  // on the first accepted write of a new active_feature — there is
  // deliberately NO zod arg on tw_update_state for it. It fixes which
  // evidence-heading-match rule the qa_reports/*.md gate predicates use for
  // the LIFE of the feature (v1 = exact-anchored H2 match, v2 =
  // normalized-contains), so tightening the rules mid-flight can never
  // invalidate evidence files written earlier (for example after a crash).
  // FEATURE-SCOPED (the dispatch_mode single-value rule): carried across
  // same-active_feature writes that omit it, dropped when active_feature
  // changes (then re-stamped at the new feature's first write), NOT
  // re-armed on PM re-entry. ABSENT for features started before pins
  // existed — absence gets the v2 normalized-contains rules at the gates
  // (v2 is a strict superset of v1, so it can only newly ACCEPT; the
  // v12→v13 migration invents NO pin). File mode only: SqliteHandoffStorage
  // ignores it (both evidence gates are file-mode only).
  // (E23, handoff schema v13)
  evidence_schema?: number;
  // Per-hop dispatch-mechanism attestation: the ACTING role's own report of
  // which mechanism carried this hop (Task subagent vs in-context
  // tw_switch_role vs inline) — attested, NOT verified: the server cannot
  // observe how it was invoked. Closed enum, zod-enforced at the tool
  // boundary; a malformed on-disk value is dropped defensively at parse
  // time. Lives for ONE write only, like next_role / review_verdict: absent
  // on any write that omits it, NEVER carried forward. Do NOT "fix" this
  // into the dispatch_pins/external_refs feature-scoped preserve or the
  // dispatch_mode single-value carry: a mechanism reported by an earlier hop
  // lingering on a later hop's record would credit the wrong hop — exactly
  // the ambiguity this field exists to remove. The durable per-hop history
  // lives in the append-only .current/dispatch.jsonl sidecar, not here.
  // ABSENT by default — undefined === "not attested for this hop" (the
  // v14→v15 migration seeds nothing). For the record only: no gate
  // predicate reads it. File mode only: SqliteHandoffStorage.writeState
  // ignores it. (E99, handoff schema v15)
  dispatch_mechanism?: DispatchMechanism;
  // Companion to dispatch_mechanism (handoff schema v15): the acting role's
  // SELF-REPORTED model tier for this hop (e.g. "fable", "opus"). Bounded free
  // text, NOT a closed enum — the model vocabulary is not owned by this server
  // (the dispatch_pins value precedent). Compared against dispatch_pins it
  // makes a pin-vs-actual mismatch visible in the record; nothing compares it
  // automatically. TRANSIENT, per-hop — identical lifetime to
  // dispatch_mechanism (absent on any omitting write, never carried forward).
  // Recording-only, FILE-MODE ONLY.
  dispatch_mechanism_tier?: string;
}
