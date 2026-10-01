// Coded by @sr-engineer
// handoff.md YAML frontmatter migrations. Self-registers on import — call sites
// in tools/handoff.ts pull this module in for the side-effect.

import { CURRENT_VERSIONS, registerMigration } from "./versions.js";

// v0 → v1: pre-versioning handoffs simply lacked the `schema_version` key.
// No field rename, no value coercion — just stamp the version. Future
// migrations (v1→v2 etc.) would live below this one.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 0,
  to: 1,
  up: (input) => ({ ...input, schema_version: 1 }),
});

// v1 → v2: add review_round counter for the code-reviewer chain step.
// Pure transform — the stderr warning for in-flight sr-engineer:In_Progress
// tickets is emitted by tools/handoff.ts:readAndMigrate (caller-side I/O)
// after this step runs, so the migration stays pure.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 1,
  to: 2,
  up: (input) => ({ ...input, schema_version: 2, review_round: 0 }),
});

// v2 → v3: add visual_round counter for the pixel-fidelity sub-loop
// (Constitution §3.1, v3.14.0). Bumps only when pending_notes contains
// `visual_fail:` and design/<feature>.md declares ## Visual Baselines.
// Pure transform — the round counter is initialised to 0 for in-flight
// tickets, identical to the v1→v2 pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 2,
  to: 3,
  up: (input) => ({ ...input, schema_version: 3, visual_round: 0 }),
});

// v3 → v4: add optional scope_decision attestation field (server-scope-decision-gate).
// Additive NO-OP: stamps the version but adds NO default value for scope_decision.
// Absence is meaningful — undefined === "no attestation recorded" === gate may fire.
// Mirrors the v1→v2 / v2→v3 pattern EXCEPT it seeds no field default (those seeded a
// 0 counter; here a defaulted value would be a false attestation, so we add nothing).
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 3,
  to: 4,
  up: (input) => ({ ...input, schema_version: 4 }),
});

// v4 → v5: add optional cut_approved attestation (pm-cut-approval-gate).
// Additive STAMP-ONLY: bumps the version, seeds NO default for cut_approved.
// Absence is the unapproved sentinel (AC-7) — a defaulted `false` would be a
// redundant materialization of absence and a defaulted `true` a false
// attestation, so we add nothing. Mirrors the v3→v4 scope_decision pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 4,
  to: 5,
  up: (input) => ({ ...input, schema_version: 5 }),
});

// v5 → v6: add optional external_refs ledger (b8-external-ref-ledger).
// Additive STAMP-ONLY: bumps the version, seeds NO default for external_refs.
// Absence is the "zero refs found" non-blocking sentinel (AC-2/AC-7) — seeding
// [] would be a redundant materialization of absence, so we add nothing.
// Mirrors the v3→v4 scope_decision and v4→v5 cut_approved stamp-only pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 5,
  to: 6,
  up: (input) => ({ ...input, schema_version: 6 }),
});

// v6 → v7: add optional next_role / resume_of / review_verdict protocol fields.
// Additive STAMP-ONLY, no default: absence means "no routing signal recorded",
// and a default would fabricate a directive. Legacy pending_notes token lines
// (`next_role: x` / `resume_of: y` / `review: APPROVED`) stay byte-verbatim as
// inert prose, not extracted. Rationale: specs/c9-protocol-fields-architecture.md.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 6,
  to: 7,
  up: (input) => ({ ...input, schema_version: 7 }),
});

// v7 → v8: add optional dispatch_pins map (C14). Additive
// STAMP-ONLY: bumps the version, seeds NO default (AC-1) — absence means "no
// pins recorded", and a synthesized default would fabricate a human directive.
// Legacy `dispatch_pins: <role>=<model>` pending_notes lines (the C8-era
// convention) are left byte-verbatim and NOT extracted into the new field
// (AC-8 — they become inert prose; the next writer sets the field explicitly).
// Mirrors the v3→v4 / v4→v5 / v5→v6 / v6→v7 stamp-only pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 7,
  to: 8,
  up: (input) => ({ ...input, schema_version: 8 }),
});

// v8 → v9: add hop_count counter (d2-server-brake-accounting). SEEDS
// `hop_count: 0` — the review_round (v1→v2) / visual_round (v2→v3) counter
// precedent, NOT the stamp-only attestation precedent (DR-3): hop_count is a
// counter whose true pre-feature value is 0, not an attestation whose absence
// is meaningful. Feature-scoped role-transition counter, computed server-side
// by computeNewRound and enforced by the HOP_CAP_EXCEEDED override in
// validateTransition (HOP_CAP = 10).
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 8,
  to: 9,
  up: (input) => ({ ...input, schema_version: 9, hop_count: 0 }),
});

// v9 → v10: add optional dispatched_at stamp (d5-server-side-stale-dispatch-
// detection). Additive STAMP-ONLY: bumps the version, seeds NO default —
// absence === "no dispatch currently in flight" (the next_role / scope_decision
// absence-is-signal precedent, NOT hop_count's seed-0: there is no true
// pre-feature value to seed). Mirrors the v3→v4 … v6→v7 stamp-only pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 9,
  to: 10,
  up: (input) => ({ ...input, schema_version: 10 }),
});

// v10 → v11: add optional dispatch_mode field (bugfix repro gate, E2). Additive
// STAMP-ONLY: bumps the version, seeds NO default — absence === "feature"
// (the default dispatch mode; the next_role / scope_decision absence-is-signal
// precedent, NOT hop_count's seed-0). Seeding "feature" would be a redundant
// materialization of absence (DR-1/DR-8). Mirrors the v9→v10 dispatched_at
// stamp-only template.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 10,
  to: 11,
  up: (input) => ({ ...input, schema_version: 11 }),
});

// v11 → v12: add qa_rounds_total / review_rounds_total / visual_rounds_total
// cumulative counters (success telemetry, E8). SEEDS all three to 0 — the
// hop_count v8→v9 counter precedent, NOT the stamp-only attestation precedent
// (DR: a 0 count is the true pre-feature value, not a fabricated attestation;
// AC8 — stale rows migrate in with all three = 0). Feature-scoped exactly like
// hop_count: persist across QA PASS/FAIL cycles and PM re-entries, reset ONLY
// on active_feature change. File-mode-only (DR-1) — sqlite schema stays v2.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 11,
  to: 12,
  up: (input) => ({
    ...input,
    schema_version: 12,
    qa_rounds_total: 0,
    review_rounds_total: 0,
    visual_rounds_total: 0,
  }),
});

// v12 → v13: add optional evidence_schema pin. Additive STAMP-ONLY: historical
// payloads get no pin, and the gates read an absent pin as the v2
// normalized-contains default (a strict superset of v1, so it can only newly
// accept). Seeding the current version would fabricate an attestation; seeding
// 1 would newly reject crash-era artifacts. The orchestrator stamps the real
// pin on the next new active_feature's first accepted write.
// Rationale: specs/e23-evidence-schema-versioning.md.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 12,
  to: 13,
  up: (input) => ({ ...input, schema_version: 13 }),
});

// v13 → v14: add optional cut_approved_source provenance attestation.
// Additive STAMP-ONLY, no default: absence === "non-inherited", the safe
// direction, so an old handoff is never read as claiming an inherited
// approval. Same template as v12 → v13.
// Rationale: specs/e114-cut-approval-inheritance.md.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 13,
  to: 14,
  up: (input) => ({ ...input, schema_version: 14 }),
});

// v14 → v15: add optional dispatch_mechanism / dispatch_mechanism_tier per-hop
// attestation fields. Additive STAMP-ONLY, seeds nothing: absence === "not
// attested for this hop". Both fields are transient, so a historical payload
// has no hop in flight to attest, and any seed would fabricate one.
// Rationale: specs/e123a-lane-layout-migration.md.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 14,
  to: 15,
  up: (input) => ({ ...input, schema_version: 15 }),
});

// Compile-time guard: if CURRENT_VERSIONS.handoff is ever bumped without a
// matching registration added above, the runner's missing-step error fires
// at read time. This reference makes the dependency explicit for grep.
void CURRENT_VERSIONS.handoff;
