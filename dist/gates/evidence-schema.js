// Coded by @sr-engineer
// E23 (e23-evidence-schema-versioning, D1) — the evidence-schema version
// vocabulary. Lives beside the validators (gates/) per the spec's placement
// call, NOT in schema/versions.ts: this constant versions the EVIDENCE
// CONVENTIONS (how gate predicates read qa_reports/*.md), not a persisted
// artifact's shape — the handoff `evidence_schema` field that pins it is
// itself covered by the handoff schema (v13).
//
// Version history:
//   v1 = legacy exact-anchored H2 heading match (`^##\s+<heading>\b`,
//        tools/evidence-file.ts sliceH2Section).
//   v2 = normalized-contains heading match (D2): an H2 line matches the
//        target when normalize(h2Text).includes(normalize(target)), where
//        normalize = lowercase, collapse every non-alphanumeric run to one
//        space, trim. `## Phase 3.5 — AC Execution Log` therefore matches
//        target `AC Execution Log` (the 104447-F0 incident heading).
//
// Pin semantics (D1/D2): the orchestrator stamps evidence_schema =
// EVIDENCE_SCHEMA_CURRENT on the FIRST accepted write of a new
// active_feature (server-stamped, never client-supplied). Gate predicates
// key matching behavior off the pinned value: pinned 1 → exact; pinned >= 2
// OR ABSENT → normalized-contains. Absent-pin features get v2 because v2 is
// a strict superset of v1 (it can only newly ACCEPT, never newly reject) —
// the pin's protective value is for FUTURE tightenings (v3+), which must
// never apply to features pinned at 2.
export const EVIDENCE_SCHEMA_CURRENT = 2;
//# sourceMappingURL=evidence-schema.js.map