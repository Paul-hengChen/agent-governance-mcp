# Spec: figma-baseline-manifest-gate

> Feature ID: `figma-baseline-manifest-gate`
> Version tag: `v3.40.0`
> Mode: `no-design` (server + SOP change only — no design source, no visual surfaces)
> Scope decision: `single-feature`
> Scope decision why: Single coherent gate enforcement feature. Touches tools/evidence-file.ts (parser + two check helpers) + index.ts (PASS guard wiring) + constitution §3.1 text + skill SOP text + specs update + tests. All changes serve one behavior: enforce observable artifact completeness of the frozen baseline manifest at PASS time. Mirrors qa-visual-baseline-provenance (v3.38.0) scope pattern.

---

## Problem Statement

The v3.39.0 `figma-baseline-mechanical-selection` feature added SOP rules in `content/skill-design-auditor.md` step 2c (design-auditor MUST freeze baseline node-ids into the Source manifest) and `content/skill-qa-visual.md` Step A.0 (qa-visual MUST copy those ids verbatim). However, these rules are prose-only: the server performs no artifact check at PASS time. An agent can still eyeball-pick and write a manifest post-hoc, or qa-visual can re-derive the baseline set from the Figma URL — both violate the SOP intent without triggering any server rejection. The fix is a server-side PASS gate in the same pattern as the v3.38.0 `VISUAL_PROVENANCE_MISSING` gate: parse observable artifacts on the `design/<feature>.md` file and reject PASS when those artifacts are incomplete or absent.

---

## User Stories

- As a qa-engineer agent, I want the server to reject PASS with `BASELINE_MANIFEST_MISSING` when the feature is design-backed (mode ≠ no-design) but `design/<feature>.md` contains no Source manifest with frozen baseline node-ids, so that an eyeball-pick or post-hoc manifest cannot silently pass.
- As a qa-engineer agent, I want the server to reject PASS with `BASELINE_PROVENANCE_INCOMPLETE` when a multi-surface feature's manifest exists but lacks the filter-conditions + exclusion-reasons provenance required by step 2c, so that the selection criteria are auditable and not just a bare node-id list.
- As a pm or design-auditor agent, I want single-surface designs (exactly one audited baseline row in the Source manifest) to pass through the provenance-completeness check silently, so that a legitimate one-screen design is never blocked by a gate that fires only for multi-surface selection.
- As any agent on a no-design feature, I want the gate to be completely silent so that non-visual work is never accidentally blocked.

---

## Acceptance Criteria

**AC-1 — BASELINE_MANIFEST_MISSING: armed design-backed feature with no frozen node-id list blocks PASS**

Given a workspace with `design/<feature>.md` declaring `## Mode` ≠ `no-design`,
When `tw_update_state(status=PASS, agent_id=qa-engineer, completed_tasks=[...])` is called,
And the design file either (a) has no `## Source` section, or (b) has a `## Source` section with zero rows carrying a recognized `audited` status and a non-empty node-id value,
Then the server MUST return `⛔ BASELINE_MANIFEST_MISSING` with `isError: true` and MUST NOT write state.

**AC-2 — BASELINE_PROVENANCE_INCOMPLETE: multi-surface manifest without filter-conditions/exclusion-reasons blocks PASS**

Given a workspace with `design/<feature>.md` declaring `## Mode` ≠ `no-design`,
And the Source manifest has ≥ 2 audited baseline surface rows (multi-surface selection),
When `tw_update_state(status=PASS, agent_id=qa-engineer, completed_tasks=[...])` is called,
And the design file contains no `## Baseline Selection Provenance` section (or the section exists but has no `filter-conditions:` line or no `exclusion-reasons:` line),
Then the server MUST return `⛔ BASELINE_PROVENANCE_INCOMPLETE` with `isError: true` and MUST NOT write state.

**AC-3 — Single-surface exemption: one audited baseline row passes the provenance-completeness check**

Given a workspace with `design/<feature>.md` declaring `## Mode` ≠ `no-design`,
And the Source manifest has exactly 1 audited baseline surface row,
When `tw_update_state(status=PASS, agent_id=qa-engineer, completed_tasks=[...])` is called,
And AC-1 would otherwise pass (manifest exists, row has a node-id value),
Then the server MUST NOT return `BASELINE_PROVENANCE_INCOMPLETE` regardless of whether `## Baseline Selection Provenance` is present.
Rationale: a single frame from a single URL requires no filtering decision; the step 2c provenance recording is explicitly scoped to "multi-surface boards."

**AC-4 — No-design feature passes silently**

Given a workspace with `design/<feature>.md` declaring `## Mode` = `no-design`,
Or given a workspace with no `design/<feature>.md` at all,
When `tw_update_state(status=PASS, agent_id=qa-engineer, completed_tasks=[...])` is called,
Then neither `BASELINE_MANIFEST_MISSING` nor `BASELINE_PROVENANCE_INCOMPLETE` MUST be returned; gate is silent.

**AC-5 — Gate runs after visual evidence gates and before or in the same block as VISUAL_PROVENANCE_MISSING**

Given the index.ts PASS handler runs through the existing visual gate sequence (evidence → widget-shape → canonical-state → report-schema → provenance),
When the baseline manifest gate fires,
Then its position MUST be within the `if (visualGate.present)` block (it is only meaningful when baselines exist) and MUST run AFTER `VISUAL_PROVENANCE_MISSING` so the ordering: evidence → widget → canonical → schema → provenance → manifest-gate is preserved. This is the "sixth visual sub-gate."

**AC-6 — Parser is pure (no I/O)**

Given `parseBaselineManifestRows(content: string)` is called,
Then the function MUST accept a string and return structured rows; it MUST NOT perform any filesystem I/O, and MUST NOT throw (mirrors `parseVisualProvenanceRows` AC-9 precedent).

**AC-7 — Parser: Source manifest row structure**

Given a `design/<feature>.md` with a `## Source` H2 section containing a markdown table with columns `medium | pointer | fetched? | status | reason`,
When `parseBaselineManifestRows(content)` is called,
Then it MUST return one row per table data line (not header/separator), with `pointer` (node-id), `status` (audited/deferred/out-of-scope/unknown), and `medium` fields extracted.
Rows where `status` is not `audited` MUST be excluded from the audited count (deferred/out-of-scope rows do not constitute a frozen manifest).
Backwards-compat: a table with no `status` column is treated as all-audited (pre-manifest-gate designs).

**AC-8 — Parser: Baseline Selection Provenance section detection**

Given a `design/<feature>.md`,
When `hasBaselineProvenance(content: string)` is called,
Then the function MUST return `true` if and only if the document contains a `## Baseline Selection Provenance` H2 section (case-insensitive) with at least one `filter-conditions:` line AND at least one `exclusion-reasons:` line somewhere in that section's body.
Both lines must be present; a section with only one field is incomplete and MUST return `false`.

**AC-9 — Version bump to 3.40.0**

Given `package.json` and `index.ts` are read,
When checking the version fields,
Then `package.json` `"version"` field MUST equal `"3.40.0"` and the `Server()` literal in `index.ts` MUST equal `"3.40.0"`.

**AC-10 — CHANGELOG entry for 3.40.0**

Given `CHANGELOG.md` is read,
When checking for a `## [3.40.0]` heading,
Then a `## [3.40.0]` entry MUST be present and MUST mention `figma-baseline-manifest-gate` and describe both error codes (`BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`).

**AC-11 — npm test green**

Given `npm test` is run after all changes,
When the test suite completes,
Then all tests MUST pass with zero failures.

**Negative ACs (must not false-positive):**

**AC-N1 — no-design workspace never sees gate errors (same as AC-4 — explicit negative)**

Given `design/<feature>.md` has `mode: no-design` (or no design file),
When PASS is attempted,
Then server output MUST NOT contain `BASELINE_MANIFEST_MISSING` or `BASELINE_PROVENANCE_INCOMPLETE`.

**AC-N2 — Single-surface never blocked by provenance check (same as AC-3 — explicit negative)**

Given a Source manifest with exactly 1 audited row,
When PASS is attempted,
Then server output MUST NOT contain `BASELINE_PROVENANCE_INCOMPLETE` even when `## Baseline Selection Provenance` is absent.

**AC-N3 — Pre-manifest-gate designs are not retroactively blocked**

Given a `design/<feature>.md` (mode ≠ no-design) created before v3.40.0 that has `## Visual Baselines` and a complete visual report but NO `## Source` section (old-style design doc),
When PASS is attempted,
Then `BASELINE_MANIFEST_MISSING` MUST NOT fire (the gate is opt-in: activated only when `## Source` is present AND at least one row exists with a recognized status — absence of the section entirely means the design predates the manifest contract and the gate is dormant). This preserves backwards-compatibility for existing managed workspaces.

**AC-N4 — Deferred-only manifest is blocked**

Given a `design/<feature>.md` with `## Source` section containing ONLY rows with `status: deferred` (zero audited rows),
When PASS is attempted,
Then `BASELINE_MANIFEST_MISSING` MUST fire (a manifest with zero audited rows is not a frozen selection — the design-auditor has not completed baseline locking).

---

## Copy / Strings

Error messages are server-emitted strings. They are internal governance text, not product UI strings.

| string id | exact text | source |
|-----------|-----------|--------|
| ERR-BMM-01 | `⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.` | authored-here — server error string, no design source |
| ERR-BPI-01 | `⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.` | authored-here — server error string, no design source |

---

## Visual Tokens

This feature introduces no visual tokens (mode = no-design).

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | — | feature has no visual tokens |

---

## Visual Widgets

This feature introduces no visual widgets (mode = no-design).

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets |

---

## Visual Structural Assertions

Not applicable — `mode = no-design`. Section present to satisfy spec schema; no assertions required.

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| N/A | — | mode = no-design; no visual surfaces | — |

---

## Out of Scope

- **`tw_extract_figma_baseline` MCP tool** — the server parses the artifact (design file), not Figma directly. Tool automation deferred as in v3.39.0.
- **Parsing the exact node-id value format** — the gate counts audited rows; it does NOT validate that the pointer value is a well-formed Figma node-id. Pointer format validation would be brittle across design sources (Figma ids vs Sketch artboard ids vs PDF page numbers). Existence of a non-empty audited row is the observable completeness signal.
- **Cross-checking Visual Baselines source nodes against Source manifest** — the gate verifies manifest existence and provenance section completeness, not row-by-row cross-reference. Cross-reference validation is deferred (spec item (b) from the design discussion). The architect MUST comment on whether cross-referencing belongs in v3.40.0 or a follow-on; the PM's position is that the observable-completeness constraint (a) + (c) is the minimum viable gate and (b) adds parser complexity that should be architected separately.
- **CHANGELOG / README doc-only changes** — doc-writer role handles these post-PASS as usual.
- **Schema version bump** — the gate reads `design/<feature>.md` (not handoff.md), so no handoff schema migration is needed. Architect to confirm.

---

## Dependencies / Prerequisites

- **Resource Audit Gate (§7):** Research docs contain one external URL (`https://viewsonic-ssi.visualstudio.com/Corporate%20OS/_workitems/edit/104444`) — context-of-origin reference only, not load-bearing for the gate logic. Classified: **ignore**.
- **Precedent to mirror**: `tools/evidence-file.ts` → `checkVisualProvenance()` and `parseVisualProvenanceRows()` (v3.38.0). New gate lives in the same file as a sibling export pair: `parseBaselineManifestRows()` (pure parser) + `checkBaselineManifest()` (composition helper, fs). Wiring in `index.ts` mirrors `checkVisualProvenance` — called as the sixth visual sub-gate within the `if (visualGate.present)` block.
- **Arm signal**: reuse `hasDesignModeRequiringVisual()` — same arm signal as every prior gate. No new arming mechanism.
- **Backwards-compat opt-in (AC-N3)**: gate is dormant when `## Source` section is absent (pre-v3.40.0 designs). Activated only when the section is present with at least one row with a recognized status. This mirrors v3.38.0's D2 opt-in (dormant until any `baseline:` line is found).
- **Gate ordering**: SIXTH and LAST visual sub-gate, positioned after `VISUAL_PROVENANCE_MISSING`. Architect to confirm exact placement in index.ts.
- **Architect open question (must be resolved before sr-engineer)**: confirm the deferred cross-reference check (spec item (b) — every `## Visual Baselines` `source node` traces to a Source manifest row) is OUT of v3.40.0 scope. If architect judges it tractable, it becomes a new AC and a new error code; PM will add it before architect blueprint is finalized.
- **T-ORM-02 and T-ORM-03** — pre-existing incomplete tasks on a different feature (`retro-sop-hardening`). Unrelated; leave open.
- Prior-session historical drift (T470–T-RSH-QA) — noise; leave as-is.

---

## Architecture Blueprint Contract (for architect)

The architect MUST produce `specs/figma-baseline-manifest-gate-architecture.md` that pins:

1. **Exact parser contract** for `parseBaselineManifestRows(content: string)` — TypeScript interface for the row shape, the exact regex(es) for locating the `## Source` H2 and extracting table rows, and how status values are normalized (case-insensitive? trim? unknown falls through to what?).
2. **Exact parser contract** for `hasBaselineProvenance(content: string)` — regex for `## Baseline Selection Provenance` H2, regex for `filter-conditions:` and `exclusion-reasons:` lines within that section.
3. **`checkBaselineManifest(workspacePath, activeFeature)` composition helper** — reads `design/<feature>.md` via the existing `designFilePath()` helper, calls the two parsers, applies AC-1/AC-2/AC-3/AC-N3/AC-N4 logic, returns a typed result.
4. **Exact placement in `index.ts`** — which line after `VISUAL_PROVENANCE_MISSING` the new guard block starts, the if-condition, and the exact error string template (must match ERR-BMM-01 and ERR-BPI-01 verbatim, including the `⛔` prefix).
5. **Decision on item (b) cross-reference** — explicitly scoped in or out with rationale.
6. **Decision on schema_version bump** — needed or not (PM position: not needed, but architect to confirm since the gate reads design file not handoff).
7. **Test surface** — enumerate all `node --test` cases the qa-engineer task must cover (minimum: AC-1 fires, AC-2 fires, AC-3 single-surface exempt, AC-4 no-design silent, AC-N3 no-Source-section silent, AC-N4 deferred-only blocks, parser unit tests for edge cases).
