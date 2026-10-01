// Coded by @sr-engineer
// Evidence-schema version: which revision of the QA evidence conventions (how
// gate predicates match qa_reports/*.md headings) a feature is read under. It
// versions conventions, not a persisted shape, so it is not in schema/versions.ts.
// v1 = exact-anchored H2 match, v2 = normalized-contains. A feature's first
// accepted write pins it: pin 1 reads exact, pin >= 2 or absent reads v2 (a
// strict superset of v1). Spec: specs/e23-evidence-schema-versioning.md.

export const EVIDENCE_SCHEMA_CURRENT = 2;
