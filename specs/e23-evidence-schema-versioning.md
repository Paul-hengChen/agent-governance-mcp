# Spec: e23-evidence-schema-versioning

Source ticket: docs/backlog.md E23 (104447-F0 P3 / B1 / B2). Cut approved by
human 2026-07-15 (coordinator chat): shape **(a) + (b-minimal) + (c)**; full
YAML report frontmatter explicitly deferred to a follow-on ticket.

## Problem

The visual/AC evidence schema tightened while a feature was in flight, so
crash-era artifacts that were legal when written became illegal at resume —
three consecutive rejections (`VISUAL_EVIDENCE_MISSING` →
`VISUAL_REPORT_INCOMPLETE` → `AC_EXECUTION_LOG_MISSING`), the last firing
solely on a `## Phase 3.5 — AC Execution Log` heading prefix: markdown prose
acting as a machine interface with exact-anchored matching
(`tools/evidence-file.ts` `sliceH2Section` — `^##\s+<heading>\b`, prefix text
never matches).

## Decisions

### D1 — `evidence_schema` pinned handoff field (shape a)

- New integer handoff field `evidence_schema`; handoff schema **v12 → v13**
  (per docs/schema-versions.md: bump `CURRENT_VERSIONS.handoff`, add adjacent
  migration step in `schema/migrations-handoff.ts`).
- **Server-stamped, never client-supplied**: the orchestrator stamps
  `evidence_schema = EVIDENCE_SCHEMA_CURRENT` on the first accepted write of a
  new `active_feature`. No new zod arg on `tw_update_state` — the field is not
  part of the client surface.
- **Feature-scoped** (same lifecycle as `dispatch_pins`): preserved verbatim
  across same-feature writes, dropped on `active_feature` change and
  re-stamped at the new feature's first write. NOT re-armed on PM re-entry.
- **Migration semantics**: the v12→v13 step does NOT invent a pin for
  historical payloads — an absent field stays absent post-migration (see D2
  fallback). This keeps the migration pure bookkeeping.
- `EVIDENCE_SCHEMA_CURRENT` lives beside the validators (new
  `gates/evidence-schema.ts` or a constant in `gates/registry.ts` —
  implementer's call), value **2**:
  - **v1** = legacy exact-anchored H2 heading match.
  - **v2** = normalized-contains heading match (D2).

### D2 — normalized-contains heading match (shape b, minimal tier)

- Evidence validators (`gates/visual.ts` `validateVisualReport` + section
  checks, `gates/ac-execution.ts` disposition check) accept an
  `evidenceSchema` parameter and key matching behavior off it:
  - pinned `1` → today's exact-anchored `sliceH2Section` behavior, unchanged.
  - pinned `>= 2` **or absent** → normalized-contains: an H2 line matches the
    target when `normalize(h2Text).includes(normalize(target))`, where
    `normalize` = lowercase, collapse every non-alphanumeric run to one
    space, trim. `## Phase 3.5 — AC Execution Log` therefore matches target
    `AC Execution Log`.
  - Absent-pin features get v2 because v2 is a strict superset of v1 (it can
    only newly ACCEPT, never newly reject) — the pin's protective value is
    for FUTURE tightenings (v3+), which must never apply to features pinned
    at 2.
- Implement as a new exported sibling of `sliceH2Section` in
  `tools/evidence-file.ts` (e.g. `sliceH2SectionAt(content, heading,
  evidenceSchema)`) so existing callers outside the two gates are untouched;
  first-match-wins when several H2s contain the target.
- The `## Verdict` value parse (`verdictIsPass`) keeps its own exact-token
  semantics — normalization applies to locating headings, never to verdict
  values or pass/fail cell parsing.

### D3 — rejection envelopes name the miss (shape c)

Audit the three emit sites in `tools/handoff-orchestrator.ts` (~L791, ~L862,
~L995). Each rejection MUST name, in the error text: (1) the exact missing
section heading(s) / expected string, (2) the file path checked, (3) the
evidence-schema version the check ran under. `VISUAL_REPORT_INCOMPLETE` and
`VISUAL_EVIDENCE_MISSING` already list missing items — extend with path +
version; `AC_EXECUTION_LOG_MISSING` currently lists task ids only — add the
expected heading (`## AC Execution Log`) and the `qa_reports/review_<id>.md`
path(s) inspected.

## Acceptance criteria

- AC1: first write of a new `active_feature` lands with `evidence_schema: 2`
  on disk; a subsequent same-feature write that omits it preserves it;
  an `active_feature` change drops and re-stamps it.
  proof: unit test over the orchestrator write path (file mode).
- AC2: handoff payloads at v12 migrate to v13 with no invented pin; on-disk
  `schema_version` becomes 13.
  proof: migration unit test with a v12 fixture.
- AC3: a review file whose disposition heading is `## Phase 3.5 — AC
  Execution Log` clears the AC gate under pin 2 (and under absent pin), and
  still FAILS under pin 1.
  proof: gate predicate unit test, exact replay of the 104447-F0 incident heading.
- AC4: a visual report with `## Widget Shape Verification (v2 grid)` style
  suffixed/prefixed headings passes section presence under pin 2; missing
  sections still reject.
  proof: validateVisualReport unit test.
- AC5: each of the three rejection envelopes names missing
  section(s)/expected string, file path, and evidence-schema version.
  proof: emit-site unit tests asserting envelope substrings.
- AC6: full suite green; no change to any client zod schema
  (tw_update_state arg surface unchanged).
  proof: npm test run log in the QA evidence.

## Out of scope

- YAML frontmatter on reports (deferred follow-on).
- Per-phase stale thresholds / E20 tier (ii).
- SQLite-mode evidence conventions (both gates are file-mode-only today and
  stay so).
- skill-qa-visual content rewrite — only a one-line note that headings may
  carry prefixes/suffixes but must contain the canonical section names.
