// Coded by @sr-engineer
// Evidence-schema version: which revision of the QA evidence conventions (how
// gate predicates match qa_reports/*.md headings) a feature is read under. It
// versions conventions, not a persisted shape, so it is not in schema/versions.ts.
// v1 = exact-anchored H2 match; v2 = normalized-contains; v3 = v2 plus: every
// Region Diff surface whose result is `accepted` must be named somewhere in the
// ## Allowed Differences section (gates/visual.ts). A feature's first accepted
// write pins it: pin 1 reads headings exact, pin >= 2 or absent reads them
// normalized, and only pin >= 3 applies the v3 listing rule, so a feature or
// report judged under an older pin is never re-judged. Defect fixes to what
// counts as a verdict (tools/evidence-file.ts judgeReportStanding) apply under
// every pin. Spec: specs/e23-evidence-schema-versioning.md.

export const EVIDENCE_SCHEMA_CURRENT = 3;

// First pin under which an accepted Region Diff surface must be named in
// ## Allowed Differences. Pins below it (and an absent pin) skip the rule.
export const EVIDENCE_SCHEMA_ACCEPTED_LISTING = 3;
