# Spec: QA-Visual Skill Consolidation Rewrite

> v1.0 — authored 2026-07-06 by @pm — backlog A6

## Problem Statement

`content/skill-qa-visual.md` is 265 lines, accreted incrementally across six
postmortem-driven revisions (v3.14.0 → v3.42.0): B0/B1/B2 staged pixel-diff
gates, three attestation fields (`baseline:` / `diff-metric:` /
`pixel_gate_complete:`), and carry-forward/fallback exemption logic repeated
across four separate sections ("fallback token satisfies diff-metric but does
NOT exempt pixel_gate_complete (AC-5)" appears in three places with slightly
different phrasing). The exemption logic — which surface class owes which
provenance field — is currently only recoverable by reading the whole file
end to end; there is no single table an agent can look up. This is a
**content-only, behavior-preserving rewrite**: same SOP, same server
contract, reorganized into an exemption-matrix table, an error-code trigger
table, renumbered steps, and one minimal complete passing-report example,
targeting ~120 lines (soft goal). The server-side parser
(`tools/evidence-file.ts`) is NOT modified — every token/format it reads from
`qa_reports/visual_<task-id>.md` must survive the rewrite character-for-
character, verified against `test/error-code-contract.test.mjs` and the
existing evidence-parser tests staying green.

## User Stories

- As a qa-engineer/qa-visual agent, I want the exemption rules (carry-forward,
  B1-fallback, single- vs multi-surface baseline manifest) in one lookup
  table instead of four scattered paragraphs, so that I stop mis-applying an
  exemption from the wrong section under context pressure.
- As a qa-engineer/qa-visual agent, I want one minimal complete example of a
  passing `visual_<id>.md` report, so that I have a concrete template instead
  of assembling the format from prose rules alone.
- As a maintainer, I want the file's error codes and their trigger conditions
  in one table, so that a future gate change (new error code, changed
  trigger) has one place to update instead of a "Failure modes" narrative
  interleaved with a "Report schema" narrative that both mention overlapping
  codes.
- As the `test/error-code-contract.test.mjs` suite, I want the rewritten file
  to keep mentioning every gate error code it mentions today (directly or via
  another `content/*.md` file), so that the doc↔code contract test stays
  green with zero code changes.

## Acceptance Criteria

**AC-1 — Full test suite green, zero server-code changes:**
Given the rewritten `content/skill-qa-visual.md`,
When `npm run build && npm test` is run,
Then the full suite (811 tests, including `test/error-code-contract.test.mjs`,
`test/context-budget*.test.mjs`, and the evidence-parser tests exercising
`tools/evidence-file.ts`) passes with exit code 0, AND `git diff` shows zero
changes to any file under `tools/`, `index.ts`, `schema/`, or `guards/`
(content-only diff, per backlog A6 constraint).

**AC-2 — Error-code contract stays green (doc↔code mutual subset):**
Given `content/skill-qa-visual.md` is, prior to this rewrite, the ONLY
`content/*.md` file that backtick-mentions `VISUAL_PROVENANCE_MISSING`,
`PIXEL_GATE_ATTESTATION_MISSING`, `VISUAL_ROUND_EXCEEDED`, and
`VISUAL_WIDGETS_UNVERIFIED` (verified by
`grep -rl` against `content/*.md` — see Copy/Strings row S18),
When the rewrite lands,
Then each of those four codes still appears backtick-quoted at least once
somewhere in `content/*.md` (keeping them in the rewritten file is the
simplest way to satisfy this — do not relocate them to another file as a
line-count trick). `BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`,
and `VISUAL_EVIDENCE_MISSING` are also mentioned in `constitution.md` /
`skill-design-auditor.md` / `skill-qa-engineer.md` respectively, so the
contract test does not strictly require them here — but they SHOULD stay
(they are this SOP's own gate surface) unless the line budget is genuinely
exhausted after satisfying every other AC.

**AC-3 — Verbatim-token manifest survives character-for-character:**
Given the verbatim-token manifest in Copy/Strings (rows S01–S17) enumerates
every server-checked token/format extracted from `tools/evidence-file.ts`,
When the rewritten file is diffed against that manifest,
Then every entry appears identical, including em-dash (`—`, U+2014) vs
hyphen (`-`) distinctions in `pass (carried forward — git diff confirms
source untouched)` and `B1 tool unavailable — LLM fallback`, exact H2 heading
text/casing, exact result-cell tokens (`pass`/`accepted`/`fail`), and the
exact placeholder-value lists that must be described as REJECTED (not shown
as valid examples). No paraphrasing of a server-parsed literal is permitted;
prose AROUND a literal may be freely rewritten.

**AC-4 — Exemption-matrix table replaces scattered exemption prose:**
Given the file currently states carry-forward/B1-fallback exemption rules in
four separate places (Step B0, Step B1, Step B2, and the Report Schema
section),
When the rewrite lands,
Then it contains exactly ONE table, `surface class × required provenance
fields`, with (at minimum) these four surface classes as rows and
`baseline:` / `diff-metric:` / `pixel_gate_complete:` as columns, each cell
one of `required` / `exempt` / `required (token, non-numeric OK)`:

| surface class | `baseline:` | `diff-metric:` | `pixel_gate_complete:` |
|---|---|---|---|
| Carry-forward (Step B0, prior-round `pass` + proven untouched) | exempt | exempt | exempt |
| B1 pre-screened pass (auto pass, at/below threshold) | required | required (numeric) | required |
| B1 tool unavailable (LLM fallback) | required | required (`B1 tool unavailable — LLM fallback` token) | required |
| B2 LLM-judged (escalated, above threshold) | required | required (quantified/qualitative) | required |

This is the single source of truth for "what does surface class X owe" —
every other section may reference the table by name instead of restating the
rule.

**AC-5 — Error-code trigger table replaces "Failure modes" narrative:**
Given the file currently narrates failure handling as free-form prose
interleaved across "Failure modes" and "Report schema",
When the rewrite lands,
Then it contains exactly ONE table, `trigger condition | error code | STOP
action`, covering at minimum the 7 codes already present today:
`VISUAL_EVIDENCE_MISSING`, `VISUAL_WIDGETS_UNVERIFIED`,
`VISUAL_PROVENANCE_MISSING`, `PIXEL_GATE_ATTESTATION_MISSING`,
`BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`,
`VISUAL_ROUND_EXCEEDED`. No code may be silently dropped from the table
relative to today's file. Optionally (not required — see AC-2) the table MAY
also add `VISUAL_REPORT_INCOMPLETE`, since that is exactly what this file's
own Report Schema section gates on and it is currently undocumented in this
file (only in `constitution.md`).

**AC-6 — Step order/dependency preserved under renumbering:**
Given the current step labels (A.0, A, A.5, B with sub-stages B0/B1/B2, C)
reflect accretion order rather than a clean sequence,
When the rewrite renumbers them,
Then the SOP's behavioral sequence is unchanged: baseline source-of-truth
fix → widget shape checklist → canonical-state verification → region diff
(carry-forward gate → deterministic pre-screen → LLM diff) → structural
assertions → verdict. Renumbering is presentation-only; no step may be
reordered, merged in a way that loses a decision point, or silently dropped.

**AC-7 — One minimal complete passing-report example:**
Given the file currently has no single end-to-end example of a passing
`qa_reports/visual_<id>.md`,
When the rewrite adds exactly one such example (single surface, non-carry-
forward, B1 pre-screened pass — the simplest passing case),
Then the example is internally consistent with the manifest: if fed to
`validateVisualReport()`, `checkVisualProvenance()`, and
`checkPixelGateAttestation()` (via a scratch Node script importing the
compiled `dist/tools/evidence-file.js`), all three report `ok: true` /
no offenses for that example's task id. This is the concrete verification
method for this AC — sr-engineer or qa-engineer should run it once against
the drafted example before submitting.

**AC-8 — Line-count target is soft, never wins over token survival:**
Given the ~120-line target,
When the rewrite is complete,
Then the file SHOULD land in the ~110–145 line range — but this AC is
explicitly non-blocking: if satisfying AC-2 through AC-7 requires more lines,
the token/table requirements win and the line count may exceed the target.
Do not drop a required table row, manifest token, or error code to hit the
line number.

## Copy / Strings

Verbatim-token manifest. Every row is a literal the server-side parser in
`tools/evidence-file.ts` (or `tools/transitions.ts`) reads by exact string/
regex match. Source column cites the parser code, not a PRD/Figma — these
are server-contract literals, not user-facing copy, but the same
verbatim-quoting discipline applies (a paraphrase here silently breaks the
gate, exactly the failure class Copy/Strings normally guards against).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | Report filename pattern: `visual_<task-id>.md` (sanitized task id, written under `qa_reports/`) | `tools/evidence-file.ts:109-112` (`visualEvidencePath`) |
| S02 | H2 heading `## Widget Shape Verification` | `tools/evidence-file.ts:377-384` (`REQUIRED_VISUAL_SECTIONS`) |
| S03 | H2 heading `## Canonical State Verification` | `tools/evidence-file.ts:377-384` |
| S04 | H2 heading `## Structural Assertions` | `tools/evidence-file.ts:377-384` |
| S05 | H2 heading `## Region Diff` | `tools/evidence-file.ts:377-384` |
| S06 | H2 heading `## Allowed Differences` | `tools/evidence-file.ts:377-384` |
| S07 | H2 heading `## Verdict` | `tools/evidence-file.ts:377-384` |
| S08 | Checkbox row shape `- [x] <id> — <description>` / `- [ ] <id> — <description>` (mark `x`/`X` = checked; anything else unchecked; split at first ` — ` or ` - `) — used by BOTH Widget Shape Verification and Canonical State Verification | `tools/evidence-file.ts:294-317` (`parseVisualWidgetsChecklist`), `:401-413` (`parseUncheckedLabels`) |
| S09 | Structural Assertions table header cell containing `assertion id` (case-insensitive) marks the header row; last cell must be exactly `pass` (case-insensitive) or the row counts as failed | `tools/evidence-file.ts:415-435` (`parseAssertionFailures`) |
| S10 | Region Diff surface heading convention: `### <surface id>` (any level H3–H6, one heading per surface, no nested sub-headings within a surface's block) | `tools/evidence-file.ts:670-677` (heading regex `/^(#{3,6})\s+(.+?)\s*$/gm`) |
| S11 | Region Diff table `\| surface \| result \|`; header cell matching `surface` or `surface id` (case-insensitive) is skipped; result cell MUST be exactly `pass` or `accepted` (case-insensitive) to count as non-failing — anything else (including `fail` or a blank cell) is a failure | `tools/evidence-file.ts:437-458` (`parseRegionDiffFailures`) |
| S12 | Prose label line `baseline: <fingerprint>` (bullet/bold optional, `:`/`—`/`-` separator) | `tools/evidence-file.ts:632` (`BASELINE_LINE_RE`) |
| S13 | Prose label line `diff-metric: <value>` (same permissive shape as S12) | `tools/evidence-file.ts:633` (`DIFF_METRIC_LINE_RE`) |
| S14 | Prose label line `pixel_gate_complete: true` — value must normalize to exactly `true` (case-insensitive, emphasis-stripped); any other value (or absence) fails the attestation gate | `tools/evidence-file.ts:636`, `:652-658` (`PIXEL_GATE_COMPLETE_LINE_RE`, `parsePixelGateAttestation`) |
| S15 | Carry-forward annotation, EXACT substring including em-dash: `pass (carried forward — git diff confirms source untouched)` | `tools/evidence-file.ts:602` (`CARRY_FORWARD_TOKEN`) |
| S16 | B1-unavailable annotation, EXACT substring including em-dash: `B1 tool unavailable — LLM fallback` | `tools/evidence-file.ts:603` (`B1_UNAVAILABLE_TOKEN`) |
| S17 | Placeholder values that are REJECTED, not accepted — must be described as invalid in the rewrite, never shown as a valid example: fingerprint placeholders `<fingerprint>` / `todo` / `tbd` / `n/a` / `none` / `-` / empty string (case-insensitive); diff-metric placeholders `n/a` / `skipped` / `skip` / `dimensionsMatch=false` (normalizes to `dimensionsmatch=false`) / `dimensions mismatch` / `todo` / `tbd` / `none` / `-` / empty string (case-insensitive, whitespace-collapsed) | `tools/evidence-file.ts:606` (`FINGERPRINT_PLACEHOLDERS`), `:616-627` (`DIFF_METRIC_PLACEHOLDERS`) |
| S18 | Verdict rule: `## Verdict` value's first alphabetic token must uppercase to exactly `PASS`, AND must not contain `not`/`fail`/`failed`/`blocked`/`blocking`/`changes requested`/`incomplete`/`pending` (case-insensitive) anywhere in the value text | `tools/evidence-file.ts:464-483` (`verdictIsPass`) |
| S19 | `pending_notes` trigger prefix `visual_fail:` — a note whose trimmed text starts with this exact literal (colon included, no required trailing space) increments `visual_round`; a pure test-logic FAIL without it increments only `qa_round` | `tools/transitions.ts:408` (`.trim().startsWith("visual_fail:")`) |
| S20 | Visual round cap: past round 6, only a `(pm, In_Progress)` transition is accepted; the rejection code is `VISUAL_ROUND_EXCEEDED` | `tools/transitions.ts:226` (`VISUAL_ROUND_CAP = 6`), `:316-322` |
| S21 | Sole-mention error codes (this file is currently the ONLY `content/*.md` file mentioning these — MUST remain mentioned somewhere in `content/*.md` after the rewrite): `VISUAL_PROVENANCE_MISSING`, `PIXEL_GATE_ATTESTATION_MISSING`, `VISUAL_ROUND_EXCEEDED`, `VISUAL_WIDGETS_UNVERIFIED` | verified via `grep -rl` across `content/*.md`, 2026-07-06 (see AC-2) |

## Visual Tokens

N/A — this is a content-only documentation rewrite; no visual UI is
introduced or changed.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — non-design, server-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — `design/qa-visual-consolidation.md` does not exist; no design mode is
armed for this feature (content-only rewrite of a governance skill file, no
design source per ticket).

## Out of Scope

- Any change to `tools/evidence-file.ts`, `tools/transitions.ts`, `index.ts`,
  `schema/*.ts`, or `guards/*.ts` — the server parser and gate wiring are
  frozen; this ticket is content-only (backlog A6 constraint).
- Adding new server-checked sections/fields/codes to the visual gate stack
  (that is A10's job — gate registry as structured data). This rewrite only
  reorganizes existing prose.
- Splitting `tools/evidence-file.ts` into `gates/` modules (backlog A2) —
  unrelated refactor, different ticket.
- Rewriting `content/skill-pm.md` (backlog A7) or the escalation-route
  tables (A11) — separate tickets, though A11 is noted to depend on this one
  (A6) landing first.
- Adding `VISUAL_BASELINES_REQUIRED` or `VISUAL_ASSERTIONS_REQUIRED` mentions
  to this file — those codes are design-auditor-facing (armed by the design
  file's `## Mode`/`## Visual Baselines`/`## Visual Structural Assertions`
  presence, not by this file's own report contents) and are already
  documented in `constitution.md` / `skill-design-auditor.md`; out of scope
  for a qa-visual-focused consolidation.
- Re-validating the illustrative CLI tool names (`odiff`, `pixelmatch`,
  ImageMagick `compare`) in Step B1 — these are non-binding examples, not
  server-parsed tokens; the rewrite may keep, trim, or reword this list
  freely.

## Dependencies / Prerequisites

### No design source (non-design feature)

Per the ticket, this feature has no `design/<feature>.md` and no Figma
source — it is a rewrite of the governance skill text itself, authored by
reading `tools/evidence-file.ts` directly (the parser IS the spec for what
must survive). Scope decision gate and visual PASS gates do not arm for this
feature (mode = no-design).

### Build/verification sequence sr-engineer should follow

1. Read `content/skill-qa-visual.md` (current, 265 lines) and
   `tools/evidence-file.ts` side by side.
2. Draft the rewrite: exemption-matrix table (AC-4), error-code trigger table
   (AC-5), renumbered steps (AC-6), one minimal passing example (AC-7),
   verbatim-token manifest entries preserved in place (AC-3), sole-mention
   codes retained (AC-2).
3. Run `npm run build && npm test` — must be 811/811 green with zero diffs
   outside `content/skill-qa-visual.md` (AC-1).
4. Spot-check AC-7's example against the compiled parsers per the AC-7
   verification method.
5. Route to code-reviewer (content-only but high blast radius per backlog
   A6 owner note: pm→sr→reviewer→qa) before qa-engineer sign-off.

### Reference specs for context (not modified by this ticket)

`specs/qa-visual-baseline-provenance.md`, `specs/qa-visual-pixel-gate-attestation.md`,
`specs/figma-baseline-manifest-gate.md`, `specs/visual-fidelity-gate-hardening.md` —
these are the specs that ORIGINALLY introduced the mechanisms this rewrite is
consolidating. They remain valid historical record; this ticket does not
supersede or edit them.

### Backlog cross-reference

Backlog A6 (`docs/backlog.md`). A11 (escalation-route tables) lists A6 as a
dependency — do not block on A11 landing first; A6 ships independently.
