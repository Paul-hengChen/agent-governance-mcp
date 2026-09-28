# A13 — §1 polish: unified output policy, watermark decision table, positive examples per schema

## Problem Statement

Constitution §1 (`content/const-01-core-head.md`) carries two live text-quality
defects observed across repeated PM/coordinator sessions: (a) the terseness
directive is stated once in §1 ("≤ 15 words, skills MAY override") and then
independently restated — with a *different* cap — by eight per-role skill
files (`Chat output ≤ 1 sentence.` / `Chat output MUST be exactly 1
sentence.`), so the "canonical" rule lives in nine places, and PM's own
1-sentence override visibly conflicts with the same skill's mandatory
step-7 inline cut table (a structured artifact PM must render in full); (b)
the §1 watermark rule is one long run-on sentence mixing the format decision,
the tier enum, and a self-detection heuristic, which is exactly the kind of
prose LLMs mis-parse under load. Separately, backlog C5 (`docs/backlog.md`)
recorded that §1's tier enum lists only `opus`/`sonnet`/`haiku` even though a
dispatch-time `fable` override is a real, observed case — C5 explicitly
flagged "fold into A13 if that ships first" for this one piece.

Governance text is also prohibition-heavy: three of the four artifact
schemas that skills define (spec, review report, architecture) state their
required sections and STOP conditions but never show a filled-in passing
instance, leaving each implementer to reverse-engineer "minimal complete"
from prohibitions alone. (`content/skill-qa-visual.md`'s visual-report
schema already carries such an example — added under a prior ticket — and is
left untouched here.)

## Decision: scope and architect routing

This ticket is content-only (`content/const-01-core-head.md` +
`content/skill-{pm,code-reviewer,architect,qa-engineer,design-auditor,
doc-writer,researcher,release-engineer}.md`, 9 files) — no new data model, no
schema_version bump, no new `tw_*` tool, no cross-cutting API surface. It
does NOT engage architect, matching the bar `c3-covering-evidence` /
`c13-release-engineer-write-path` used to skip architect: prose-only edits to
already-existing sections, verified by hand-reading the two affected test
files below. Routing directly to sr-engineer.

**One load-bearing constraint discovered during spec authoring, binding on
the sr-engineer implementation (see AC1):** `test/constitution-deliverable-guard.test.mjs`
pins two literal substrings — `"assumption gap"` and `"acceptance criteria"`
— that today exist **only** inside the §1 Terse bullet being rewritten. The
new bullet MUST retain both phrases verbatim or `t-b1-assumption-gap` /
`t-b1-acceptance-criteria` regress. The backlog's suggested short-hand
("blockers/ACs") does not, by itself, satisfy this — the full phrases must
survive somewhere in the rewritten bullet.

**Two more pinned-test interactions discovered during spec authoring**
(both scoped to the §1 rewrite only — no skill-file edit touches either):

1. `test/compose-equivalence.test.mjs` asserts byte-identical output between
   the live `composeConstitution()` pipeline and 11 frozen fixtures under
   `test/fixtures/compose-golden/`. `content/const-01-core-head.md` is the
   **core-head** fragment — included in every dispatch mode regardless of
   `chain`/`design` flags (confirmed: `prompts/constitution-manifest.ts`
   tags it neither chain-only nor design-only) — so rewriting it changes the
   byte content of all 8 `build-*.txt` fixtures and both `hook-*.txt`
   fixtures. Precedent (`645ddaf`, `ecac938`, backlog C1/C2) shows fragment
   edits and their golden-fixture deltas landing in the **same commit**.
2. `test/context-budget.test.mjs` AC2 pins the "lean always-on" bundle
   (`composeConstitution({chain:false, design:true})` + `skill-coordinator-lite.md`)
   at exactly `<= 3030` ~tok — per the test file's own comment history this
   cap is deliberately set to "the exact measured value" each time, i.e.
   **zero headroom**. `const-01-core-head.md` is on this lean path (core,
   not chain-tagged), so ANY net token growth from the watermark
   decision-table / Terse rewrite will trip this assertion. The test file's
   own comments document the fix as a routine, expected **qa-owned bump**
   (Constitution §2 test-ownership — sr-engineer must not edit test files).

## User Stories

- As any role reading §1, I want the terseness policy stated exactly once,
  so PM's mandatory cut table and every other structured-artifact output
  stop reading as an undocumented exception to a word cap.
- As any role emitting a final chat reply, I want the watermark rule
  expressed as a short decision table instead of one run-on sentence, so
  self-detection (Task-spawned + pinned model vs. everything else) resolves
  in one glance.
- As a subagent dispatched with a `fable`-pinned model, I want `fable`
  listed in §1's tier enum, so my watermark's parenthetical tier isn't an
  undocumented value relative to the constitution I was just handed.
- As an sr-engineer/architect/code-reviewer/PM implementer, I want one
  minimal complete passing example per artifact schema I own, so "what does
  a valid one look like" is answered by an instance, not just a list of
  MUSTs and STOPs.

## Acceptance Criteria

- **AC1** — Given `content/const-01-core-head.md`, when the **Terse** bullet
  is read, then it states the output policy exactly once: terse by default,
  with structured artifacts (tables, blockers, acceptance criteria) exempt
  and rendered in full — AND it MUST still contain the literal substrings
  `assumption gap` and `acceptance criteria` (test-pinned, see Decision) —
  AND it MUST state that skills do not define their own word cap; a skill
  may state only a canonical final-reply string (e.g. `` `Done. Tasks in
  tasks.md.` ``), never a separate terseness/word-count rule.
- **AC2** — Given `content/const-01-core-head.md`, when the **Watermark**
  bullet is read, then the format decision is a two-row markdown table:
  - row 1: condition = Task-spawned with `model:` pinned by the parent
    (`Task(subagent_type=…)`); format = `` `— @<role> (<tier>)` ``.
  - row 2: condition = otherwise (initial session agent, coordinator,
    coordinator-lite, or in-context `tw_switch_role`); format = `` `—
    @<role>` `` (no tier).
  The tier enum (wherever listed, in the table or its immediate prose) MUST
  read `opus` / `sonnet` / `haiku` / `fable` — `fable` added per backlog C5's
  fold-in note. No other §1 bullet changes.
- **AC3** — Given `content/skill-pm.md`: (a) the `## Output rule` section's
  `Chat output ≤ 1 sentence.` sentence is removed; the `Final reply:
  \`Done. Tasks in tasks.md.\`` line is unchanged. (b) The `## Spec Schema`
  section gains one minimal complete passing example (a fenced block) for a
  trivial non-design feature, demonstrating: a populated Copy/Strings row
  with an `authored-here` source, a `N/A` Visual Tokens row (literal
  convention, mirroring the existing Visual Widgets `N/A` row pattern), a
  `N/A` Visual Widgets row, and legitimate omission of Visual Structural
  Assertions (mode = no-design, so the section is not mandatory).
- **AC4** — Given `content/skill-code-reviewer.md`: (a) same Output-rule
  word-cap removal pattern as AC3(a) (`Final reply:` line unchanged). (b) The
  `## Review Report Schema` section gains one minimal complete passing
  example with all seven required H2 sections populated and a verdict of
  `APPROVED`.
- **AC5** — Given `content/skill-architect.md`: (a) same Output-rule
  word-cap removal pattern (`Final reply:` line unchanged). (b) The
  `## Artifact Schema` section gains one minimal complete passing example
  covering every always-required H2 (Affected Files, Data Structures,
  Interface Contracts, Decision Records, Deferred Resources, Open
  Questions), with a one-line note that Sequence Diagram and Visual Harness
  are correctly omitted in this instance (≤ 2 actors; no `design/<feature>.md`).
- **AC6** — Given `content/skill-qa-engineer.md`, when the `## Output rule`
  section is read, then `Chat output MUST be exactly 1 sentence.` is removed
  and `Details go in files.` is retained. No schema example is added here —
  `content/skill-qa-visual.md`'s existing `### Example — minimal complete
  passing report` (lines 93-124 as of this spec) already satisfies A13(c)
  for the visual-report schema; verify it is untouched by this ticket's diff.
- **AC7** — Given `content/skill-design-auditor.md`,
  `content/skill-doc-writer.md`, `content/skill-researcher.md`, and
  `content/skill-release-engineer.md`, when each `## Output rule` section is
  read, then each file's `Chat output ≤ 1 sentence.` sentence is removed and
  each file's `Final reply: \`Done. ...\`` line is unchanged.
- **AC8** — Given the AC1/AC2 edit to `content/const-01-core-head.md`, when
  `npm run build` completes, then `test/fixtures/compose-golden/*.txt`
  (all 8 `build-*.txt` fixtures, both `hook-*.txt` fixtures, and
  `constitution-monolith.txt` if it diverges) MUST be regenerated —
  `node scripts/capture-constitution-golden.mjs` (per the script's own usage
  line) or an equivalent hand-patch that reproduces the exact same bytes —
  so `test/compose-equivalence.test.mjs` stays green with zero regressions.
- **AC9** — Given `test/context-budget.test.mjs` AC2's `<= 3030` lean-bundle
  cap (documented in-file as pinned to "the exact measured value" with zero
  headroom), when the AC1/AC2/AC3–AC7 edits land, then qa-engineer (test
  ownership, Constitution §2 — sr-engineer must NOT edit this file)
  re-measures the lean bundle and bumps the literal cap to the new exact
  value, appending a dated comment matching the file's existing convention
  (see the `v3.24.0` / `v3.31.0` / `pm-cut-approval-gate` / `C2-06` comment
  blocks immediately above the assertion for the exact format to follow).
- **AC10** — Given the full repo after all edits, `npm run build` and
  `npm test` MUST both be clean/green — zero compile errors, zero failing
  tests, zero regressions outside the AC8/AC9 fixture/cap updates.
- **AC11** — Given `docs/backlog.md`, after this feature ships and releases
  (post-PASS, post-release-engineer), the A13 row/section MUST be marked
  done with the shipping version and commit reference (pm/coordinator
  bookkeeping, not a code AC — mirrors the A2/C6/C11/C13 precedent). The C5
  section MUST gain a one-line note that its tier-enum fold-in shipped via
  A13; the remainder of C5 (`lib/watermark-check.ts` append-vs-replace fix,
  `templates/claude-code-agents/*` hardcoded-tier fix) stays open.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature is governance-prose editing, not product copy |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `lib/watermark-check.ts` (`validateWatermark` append-vs-replace-on-mismatch
  defect) and `templates/claude-code-agents/*` (hardcoded tier in the
  CRITICAL reminder line) — remainder of backlog C5, not folded in here.
- Adding a minimal-example to the visual-report schema — already exists in
  `content/skill-qa-visual.md`.
- Any Hard-rules / SOP content beyond the specific Output-rule sentence and
  (for pm/code-reviewer/architect) the schema-example addition named in the
  ACs above.
- `content/skill-coordinator.md` / `content/skill-coordinator-lite.md` — 
  neither defines a per-skill word cap today; no change needed.
- Removing the `## Output rule` H2 heading itself — pinned by
  `test/skill-evolution-v3.11.test.mjs` (doc-writer/release-engineer require
  the heading to exist); only the word-cap sentence beneath it is removed.

## Dependencies / Prerequisites

- No `design/<feature>.md` — non-visual, content-only feature. Scope
  Decision Gate not triggered; `scope_decision: "single-feature"` recorded
  directly on the routing write.
- AC8's fixture regeneration must run `npm run build` FIRST (compiles
  `content/` changes are picked up by `dist/prompts/build.js`, which the
  capture script imports) — same sequencing the script's own header comment
  documents.
- AC9's cap bump is qa-engineer's edit, not sr-engineer's — if sr-engineer's
  own pre-handoff `npm test` run trips the `<= 3030` assertion, that is the
  expected signal to hand off with the failure noted, not to edit the test
  file directly.

## Suggested version

Prose/text-quality fix to already-shipped governance content — no new
capability, no schema bump, no new tool. Recommend PATCH:
`3.49.0 → 3.49.1`. Final bump-kind decision remains release-engineer's per
its own bump-kind gate.
