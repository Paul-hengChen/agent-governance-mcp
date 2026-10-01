// Coded by @sr-engineer
// Shared handoff.md types, in their own module so handoff-parse.ts and
// handoff-write.ts share them without importing each other's types; only
// parseHandoff and writeHandoffState cross that boundary. tools/handoff.ts
// re-exports every type here.

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
  // Cumulative per-feature round totals: each ticks with its per-cycle
  // counter's FAIL branch (computeNewRound) and resets only when
  // active_feature changes, like hop_count. In file mode the parser always
  // fills them and the serializer always writes them; optional here only
  // because SQLite never stores them. Read as `state.qa_rounds_total ?? 0`.
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
  // Ticket-cut approval attestation: `true`, set by PM on its pm:In_Progress
  // write after human approval of the cut, satisfies CUT_APPROVAL_REQUIRED.
  // Absent or `false` means no approval. Feature-scoped and reset on every PM
  // In_Progress re-entry that does not re-pass it (see writeHandoffState).
  cut_approved?: boolean;
  // Cut-approval inheritance attestation, "inherited:<parent-feature>": the
  // client's own claim that cut_approved came from a parent feature's
  // approval. The server cannot verify another workspace, so it records the
  // writer's word; any other shape is dropped at parse time. Feature-scoped,
  // not re-armed on PM re-entry. Absent means "not inherited". No gate reads it.
  // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-write.ts — field lifetimes".
  cut_approved_source?: string;
  // External-reference ledger, filled by PM during the resource audit; backs
  // EXTERNAL_REFS_UNRESOLVED. Absent means PM found no external references,
  // so the gate clears (the inverse of cut_approved). Feature-scoped, not
  // re-armed on PM re-entry, file mode only. tw_get_state shows it verbatim
  // through the `{ ...state }` view, where the architect reads it: keep it.
  external_refs?: ExternalRef[];
  // Single-hop routing directive for the next reader, enum-checked but not
  // cross-checked against ALLOWED_TRANSITIONS. One write only: never carried
  // forward, so a stale next_role cannot linger.
  // Why: specs/e260a-tools-a-h-rationale.md, "tools/handoff-write.ts — field lifetimes".
  next_role?: AgentName;
  // Server-stamped ISO-8601 UTC time at which this write set next_role; same
  // one-write lifetime as next_role. Absent means no dispatch is in flight.
  // File mode only, since SQLite never stores next_role.
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
  // Human model-tier pins per role. Keys are AgentName values (rejected at the
  // tool boundary, dropped at parse time otherwise); values are free text,
  // since this server does not own the model vocabulary. A durable directive:
  // replaced whole when given, feature-scoped when omitted, file mode only.
  // The dispatched role reads its own pin from tw_get_state to stamp its
  // watermark.
  dispatch_pins?: Partial<Record<AgentName, string>>;
  // Dispatch-mode classification; absence means "feature". PM sets "bugfix"
  // at cut time, which arms REPRO_MANIFEST_MISSING on the sr-engineer →
  // code-reviewer fix-phase edge and makes QA's expected-red check decisive.
  // Feature-scoped, not re-armed on PM re-entry; an explicit PM write can
  // change it. File mode only. It never gates a transition edge itself.
  dispatch_mode?: DispatchMode;
  // Evidence-schema pin, stamped by the orchestrator (never by a client) on a
  // new feature's first accepted write. It fixes which evidence-heading rule
  // the gates use for the life of the feature (1 = exact H2 match, 2 =
  // normalized contains), so tightening the rules later cannot invalidate
  // evidence written earlier. Absent for older features, which get rule 2, a
  // superset of rule 1. Feature-scoped, file mode only.
  evidence_schema?: number;
  // Per-hop dispatch-mechanism attestation: the acting role's own report of
  // what carried this hop, attested not verified. A malformed on-disk value is
  // dropped at parse time. One write only: a value from an earlier hop would
  // credit the wrong hop; the durable history is the dispatch.jsonl sidecar.
  // No gate reads it. File mode only.
  dispatch_mechanism?: DispatchMechanism;
  // Companion to dispatch_mechanism: the acting role's self-reported model
  // tier for this hop, free text. Comparing it with dispatch_pins shows a
  // pin-vs-actual mismatch; nothing compares them automatically. Same
  // one-write lifetime, file mode only.
  dispatch_mechanism_tier?: string;
}
