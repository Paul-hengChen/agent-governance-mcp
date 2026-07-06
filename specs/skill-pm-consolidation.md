# Spec: PM Skill Consolidation Rewrite

> v1.0 — authored 2026-07-06 by @pm — backlog A7

## Problem Statement

`content/skill-pm.md` (54 lines) accreted its SOP numbering by postmortem
patch: `1 → 2 → 2a → 2a-bis → 2b → 3 → 4 → 5 → 6 → 7 → 7a → 8`. Each of the
lettered sub-steps (visual state-count split, geometric-density split, scope
decision, cut-approval) lives in its own paragraph with its own STOP/gate
prose, duplicated in shape (trigger condition → clearing action) but never
unified into one lookup surface — an agent under context pressure has to
re-derive "what does gate X require" by re-reading the whole numbered list
top to bottom instead of looking it up. This is a **content-only,
behavior-preserving rewrite** (same pattern as the just-shipped A6 rewrite of
`content/skill-qa-visual.md`, `specs/qa-visual-consolidation.md`): clean
sequential top-level numbering (no letter suffixes), one **Gate Summary**
table (`gate | trigger | clearing action`) replacing the seven scattered
per-gate paragraphs, and the verbatim-table Spec Schema / Task Format
sections untouched. No server code changes; every token another file or test
pins by exact string/regex must survive character-for-character.

**Governing constraint discovered during pin inventory** (test/context-budget.test.mjs
`PM_RULE_MARKERS`, line 43): four SOP steps are pinned to their *exact
current numbers* by literal substring match — step **1** = `` `tw_get_state` ``,
step **3** = **Resource Audit Gate**, step **5** = **Ambiguity Gate**, step
**8** = `` `tw_update_state ``. This means "clean sequential numbering" is
**already true at the top level** (1,2,3,4,5,6,7,8 are already plain
integers today) — the sediment being cleaned up is entirely the *lettered
sub-steps* (2a, 2a-bis, 2b, 7a), which collapse into the new Gate Summary
table. Steps 1/3/5/8 keep their exact number+name text (may shrink to a
one-line pointer into the table) so the pin survives; no full renumber to
a different integer sequence is attempted or required.

## User Stories

- As the pm role reading its own SOP under context pressure, I want every
  gate's trigger and clearing action in one table instead of re-deriving it
  from seven scattered paragraphs, so that I stop mis-sequencing gates
  (e.g. setting `cut_approved` before presenting the cut, or forgetting the
  deferred-surface disclosure) under load.
- As a maintainer, I want gate semantics changes (new trigger condition, new
  clearing artifact) to touch one table row instead of a full paragraph
  rewrite, so future gate additions (A10 "gate registry as structured data")
  have a clean base to build on.
- As `test/context-budget.test.mjs`, `test/widget-shape-spec.test.mjs`,
  `test/pixel-perfect-design-coverage.test.mjs`, `test/cut-approval-gate.test.mjs`,
  and `test/skill-frontmatter.test.mjs`, I want every literal string/regex I
  currently assert against `content/skill-pm.md` to still match after the
  rewrite, so the suite stays green with zero test-file edits.
- As `content/constitution.md` §7 and `content/skill-design-auditor.md`
  (both out of scope for this ticket), I want the gate **names** I cite by
  name (`skill-pm §Resource Audit Gate`, `Geometric-Density Split Gate`) to
  still exist in `content/skill-pm.md` after the rewrite, so my own
  cross-reference doesn't silently point at nothing.

## Acceptance Criteria

**AC-1 — Full test suite green, zero non-target diff:**
Given the rewritten `content/skill-pm.md`,
When `npm run build && npm test` is run,
Then the full suite (812 tests) passes with exit code 0, AND `git diff`
shows changes to `content/skill-pm.md` only (plus this spec + `tasks.md` /
`.current/handoff.md` bookkeeping) — zero changes to any file under `tools/`,
`index.ts`, `schema/`, `guards/`, or `test/`.

**AC-2 — Error-code contract stays green:**
Given `content/skill-pm.md` currently backtick-mentions `SCOPE_DECISION_REQUIRED`
and `CUT_APPROVAL_REQUIRED` (both also independently mentioned in
`content/constitution.md`, `content/skill-coordinator.md`, and
`content/skill-coordinator-lite.md`, so neither is a sole-mention the way
A6's four codes were),
When the rewrite lands,
Then both codes remain backtick-mentioned in the rewritten file (dropping
them would not break `test/error-code-contract.test.mjs` today, but would
silently weaken this SOP's own gate-surface documentation — keep them).

**AC-3 — Verbatim-token manifest survives character-for-character:**
Given the verbatim-token manifest in Copy/Strings (rows S01–S18) enumerates
every string/regex another test file or content file pins against
`content/skill-pm.md`,
When the rewritten file is checked against that manifest,
Then every entry is satisfied exactly as specified (literal substrings
present verbatim; regex rows still match). No paraphrasing of a pinned
literal is permitted; prose AROUND a pinned literal may be freely rewritten
or relocated (e.g. into a table cell).

**AC-4 — One Gate Summary table replaces seven scattered gate paragraphs:**
Given the file currently states gate trigger/clearing logic across seven
separate locations (step 2a, step 2a-bis, step 2b, step 3, step 4, step 5,
step 7a),
When the rewrite lands,
Then it contains exactly ONE table, `gate | trigger | clearing action`, with
(at minimum) these seven rows, each preserving its current trigger condition
and clearing action with exact semantics (no gate weakened, no clearing
artifact dropped):

| gate | trigger (today's step) | clearing action must still specify |
|---|---|---|
| Visual State-Count Split (v3.26.0) | step 2a | split >~8–10 states → surface-state tasks, shared shell/widgets first, record `.current/feature-split.md`; Deferred-surface sub-gate (pointer+reason under Dependencies/Prerequisites); backwards-compat no-op for older manifests |
| Geometric-Density Split Gate (v3.31.0) | step 2a-bis | ≥3 independently-constrained geometry layers on one surface → sub-task split, shared shell/container first, same `.current/feature-split.md` artifact; additive to state-count gate; non-design features exempt |
| Scope Decision Gate (v3.30.0) | step 2b | design armed (`## Mode` ≠ no-design) + no decision recorded → server `SCOPE_DECISION_REQUIRED`; clears via `.current/feature-split.md` OR `scope_decision: "single-feature"` (+ optional `scope_decision_why`) on step 8's write; non-design features not gated |
| Resource Audit Gate (Constitution §7) | step 3 | grep every requirement doc for `http(s)://`/`figma`/`sketch`/`mockup`/`設計圖`/`URL`/`link`/`see <ticket>`/`Azure DevOps`/`JIRA`; classify EACH hit fetch/index/ignore; never let architect/sr-engineer silently defer one |
| Question Batch Gate | step 4 | consolidate all mid-flow clarifications (resource-audit decisions + would-be ambiguity asks) into ONE `AskUserQuestion` call, ≤4 questions (2 batches if more); zero clarifications → silent no-op; record answers in spec's Dependencies/Prerequisites |
| Ambiguity Gate | step 5 | load-bearing gaps unresolved after Question Batch → STOP, `tw_update_state(status=Blocked, pending_notes=["PM blocked: ambiguous — <detail>"])`; do not guess |
| Cut-Approval Gate (pm-cut-approval-gate) | step 7a | AFTER split/scope decision, BEFORE step 8 routing → present ticket cut inline in chat (NOT `AskUserQuestion`) as a plain markdown table with header `id | desc | depends_on | est. files | design-link`; design-link rule when visual arm active (Figma node id + canonical URL, same token as design-auditor's Source manifest pointer; `—` otherwise); server blocks `pm:In_Progress → {architect,sr-engineer}:In_Progress` with `CUT_APPROVAL_REQUIRED` until `cut_approved: true` is set on the step-8 write, set ONLY after human approval; feature-scoped re-arm (fresh PM entry / QA-FAIL bounce / scope rework / new `active_feature`) |

This is the single source of truth for "what does gate X require" — the
numbered SOP steps may point at this table by name instead of restating the
rule inline.

**AC-5 — Clean sequential top-level numbering, pinned anchors preserved:**
Given today's numbered list is `1, 2, 2a, 2a-bis, 2b, 3, 4, 5, 6, 7, 7a, 8`
(the top-level integers are already sequential; the sediment is the four
lettered sub-steps),
When the rewrite lands,
Then the top-level numbered SOP list contains ONLY plain integers `1`
through `8` (no letter suffix anywhere), AND the four literal pinned
substrings from `test/context-budget.test.mjs` `PM_RULE_MARKERS` are present
verbatim: `` "1. `tw_get_state`" ``, `` "3. **Resource Audit Gate**" ``,
`` "5. **Ambiguity Gate**" ``, `` "8. `tw_update_state" `` — these four steps
may shrink to a one-line pointer into the Gate Summary table (step 3 and 5)
or keep their current call-shape detail (step 1 and 8), but the exact
number+name/token text must not move to a different number.

**AC-6 — Schema sections preserved verbatim (untouched by this rewrite):**
Given the Spec Schema H2 list (Problem Statement … Dependencies /
Prerequisites), the Copy/Strings / Visual Tokens / Visual Widgets / Visual
Structural Assertions table-contract bullets, and the Task Format code block
are load-bearing for OTHER roles (architect/sr-engineer copy the Task
Format; qa-engineer and qa-visual consume the Visual Widgets contract;
`test/widget-shape-spec.test.mjs` and `test/pixel-perfect-design-coverage.test.mjs`
pin their exact wording),
When the rewrite lands,
Then these sections are byte-identical to today (or provably equivalent —
e.g. whitespace-only) — the consolidation target is the numbered SOP +
per-gate prose, NOT the schema sections.

**AC-7 — Rationale fences remain balanced and correctly scoped:**
Given today's file has exactly 4 `<!-- rationale:start -->…<!-- rationale:end -->`
blocks — 2 inside the Spec Schema section (Copy/Strings STOP reason, Visual
Tokens STOP reason — both untouched per AC-6) and 2 inside the SOP gate
prose (step 2a-bis Geometric-Density rationale, step 4 Question Batch
rationale — both being relocated into the Gate Summary table),
When the rewrite lands,
Then all fences remain balanced (`stripRationale` idempotent, per
`test/context-budget.test.mjs` AC9), the two schema-embedded blocks are
unchanged in place, and the two SOP-embedded rationale texts (if kept) are
relocated into their Gate Summary table cell as non-normative why-text
inside a balanced fence — never left wrapping a rule/trigger/clearing-action
clause. `PM_RULE_MARKERS` (the 9 literal substrings, listed in Copy/Strings
S02 below) must all survive `stripRationale(content)` unchanged.

**AC-8 — STOP/Blocked payload strings preserved exactly:**
Given the file's Blocked-state `pending_notes` strings are read verbatim by
whichever human/agent handles the escalation,
When the rewrite lands,
Then these exact strings survive unchanged: `"PM blocked: copy missing
source for <string id>"`, `"PM blocked: ambiguous — <detail>"` (note the
em-dash, U+2014), `"PM blocked: design lacks Visual Structural Assertions"`
+ `"next_role: design-auditor"`.

**AC-9 — Line-count is a soft observation, never wins over a pinned token:**
Given the file is already small (54 lines) — unlike A6's 265-line target,
there is no aggressive line-reduction goal here,
When the rewrite is complete,
Then the file may grow slightly (a table has row/header overhead) or shrink
slightly; no specific target is set. Never drop a pinned literal, gate
semantic, or STOP payload to hit a line count.

## Copy / Strings

Verbatim-token manifest. Every row is a literal or regex that another
`content/*.md` file, `docs/backlog.md`, or a test in `test/` pins against
`content/skill-pm.md`'s exact text. Source column cites the pinning
file:line, not a PRD/Figma — same verbatim-quoting discipline as A6's
manifest (a paraphrase here silently breaks a test or a cross-file
citation).

| string id | exact text / regex (quote verbatim) | source |
|---|---|---|
| S01 | `"1. \`tw_get_state\`"` | `test/context-budget.test.mjs:45` (`PM_RULE_MARKERS`) |
| S02 | `"3. **Resource Audit Gate**"` | `test/context-budget.test.mjs:46` |
| S03 | `"5. **Ambiguity Gate**"` | `test/context-budget.test.mjs:47` |
| S04 | `` "8. `tw_update_state" `` | `test/context-budget.test.mjs:48` |
| S05 | `"Copy / Strings"` (heading text, in Spec Schema bullet list) | `test/context-budget.test.mjs:50` |
| S06 | `"Visual Tokens"` (heading text, in Spec Schema bullet list) | `test/context-budget.test.mjs:51` |
| S07 | `"Scope Decision Gate"` (gate name substring, anywhere) | `test/context-budget.test.mjs:52` |
| S08 | `"Geometric-Density Split Gate"` (gate name substring, anywhere) | `test/context-budget.test.mjs:53` |
| S09 | `"MUST contain these H2"` (Spec Schema intro sentence) | `test/context-budget.test.mjs:55` |
| S10 | Token cap: `stripRationale`-stripped body (frontmatter stripped first) must be ≤ 2850 ~tok | `test/context-budget.test.mjs:267-281` |
| S11 | `/-\s+\*\*Visual Widgets\*\*\s*\(v3\.14\.0\)/` — Spec Schema bullet (untouched, AC-6) | `test/widget-shape-spec.test.mjs:27` |
| S12 | `/3-column table.*widget id.*description.*source-node/is` (untouched, AC-6) | `test/widget-shape-spec.test.mjs:32` |
| S13 | `/column-scroller.*<input type="date">/i`, `/virtual.*keyboard/i`, `/segmented.*<select>/i` (untouched, AC-6) | `test/widget-shape-spec.test.mjs:40-42` |
| S14 | `/N\/A.*feature has no non-primitive widgets/` (untouched, AC-6) | `test/widget-shape-spec.test.mjs:50` |
| S15 | `/Constitution\s*§1/` + `/scope violation/i` (untouched, AC-6) | `test/widget-shape-spec.test.mjs:55-56` |
| S16 | `/design\/<feature>\.md.*Visual Widgets/i` (untouched, AC-6) | `test/widget-shape-spec.test.mjs:108` |
| S17 | `"Deferred-surface gate"` literal name; `/Source manifest.*contains rows with.*status:\s*deferred/is`; `/Dependencies\s*\/\s*Prerequisites/`; `/pointer\s*\+\s*reason/i`; `/Backwards-compat[^\n]*older.*design[^\n]*requires no action/is` | `test/pixel-perfect-design-coverage.test.mjs:75-92` |
| S18 | `"id \| desc \| depends_on \| est. files \| design-link"` (Cut-Approval table header, verbatim) | `test/cut-approval-gate.test.mjs:543` |
| S19 | Frontmatter `recommended_model: sonnet` must remain parseable; body (post-frontmatter-strip) must start with `"# Skill: pm"` | `test/skill-frontmatter.test.mjs:96-121,142-160` |
| S20 | `` `SCOPE_DECISION_REQUIRED` `` and `` `CUT_APPROVAL_REQUIRED` `` remain backtick-mentioned (not sole-mentions — see AC-2) | `test/error-code-contract.test.mjs`; `content/constitution.md:57` |
| S21 | Cross-file citation by NAME (not by step number) — `"skill-pm §Resource Audit Gate"` — must resolve to a still-present gate name in this file (satisfied by S02) | `content/constitution.md:159` (out of scope to edit) |
| S22 | Cross-file citation by NAME + informal step locator — `` "Geometric-Density Split Gate" (`skill-pm` step 2a-bis) `` — the gate NAME must survive (satisfied by S08); the informal `"step 2a-bis"` locator is EXPECTED to go stale once the lettered sub-step is folded into the Gate Summary table — accepted, see Out of Scope | `content/skill-design-auditor.md:88` (out of scope to edit) |

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

N/A — `design/skill-pm-consolidation.md` does not exist; no design mode is
armed for this feature (content-only rewrite of a governance skill file, no
design source per ticket).

## Out of Scope

- Any change to `tools/*.ts`, `index.ts`, `schema/*.ts`, `guards/*.ts`, or
  any file under `test/` — the server parser, gate wiring, and test
  assertions are frozen; this ticket is content-only (backlog A7
  constraint, same as A6).
- `docs/skills/pm.md` (the generated per-role reference doc) — it documents
  today's `Step 2a` / `Step 2a-bis` / `Step 2b` / step 7a numbering in
  detail and will read as stale once this rewrite lands. No test pins its
  content (`grep -rln "docs/skills" test/` returns zero hits) and A6's
  precedent commit (`77a6373`) did not update `docs/skills/qa-visual.md`
  either — same treatment here. Not a reviewed diff target.
- `content/skill-design-auditor.md` — its `"skill-pm step 2a-bis"` informal
  locator (line 88) goes stale (see Copy/Strings S22); the gate NAME it
  actually needs (`Geometric-Density Split Gate`) survives. Out of scope
  to edit per the content-only constraint; not this ticket's file.
- Backlog A8 (single-owner dedup of multi-told mechanisms), A11 (escalation-
  route tables + unified rule grammar, which lists A7 as a dependency), A9/A10
  (compose-not-strip, gate registry as data) — all separate, larger tickets
  this rewrite does not attempt or block.
- Renumbering the top-level SOP to a *different* integer sequence (e.g.
  collapsing to 1–8 by eliminating a step) — steps 1/3/5/6/8's current
  integers are pinned or otherwise load-bearing; only the lettered
  sub-steps (2a/2a-bis/2b/7a) are being folded into the Gate Summary table.

## Dependencies / Prerequisites

### No design source (non-design feature)

Per the ticket, this feature has no `design/<feature>.md` and no Figma
source — it is a rewrite of the governance skill text itself. Scope decision
gate and visual PASS gates do not arm for this feature (mode = no-design).

### Resource Audit Gate (Constitution §7) — result: CLEAR

Scanned this ticket's brief, `docs/backlog.md` §A7, and
`specs/qa-visual-consolidation.md` (the reused spec pattern) for
`http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`,
`see <ticket>`, `Azure DevOps`, `JIRA`. Zero external-reference hits.
Nothing to fetch/index/ignore.

### Question Batch Gate — result: no-op

Zero clarifications accumulated. The pin inventory (grep across `test/`,
`content/*.md`, `specs/*.md`, `docs/backlog.md`) fully resolved the only
open design question — whether "clean sequential numbering" could mean a
full renumber — against the `PM_RULE_MARKERS` hard constraint (see Problem
Statement governing-constraint note and AC-5). No `AskUserQuestion` call
made.

### Build/verification sequence sr-engineer should follow

1. Read `content/skill-pm.md` (current, 54 lines) and this spec's
   Copy/Strings manifest (S01–S22) side by side.
2. Draft the rewrite: one Gate Summary table (AC-4) with the 7 rows;
   collapse steps 2a/2a-bis/2b into step 2's flow (or a pointer to the
   table) and step 7a into step 7's flow; keep steps 1/3/5/8's pinned
   number+text (AC-5); leave the Spec Schema / Task Format sections
   byte-identical (AC-6); keep the 2 schema-embedded rationale fences in
   place and relocate the 2 SOP-embedded ones into their table cell,
   fences balanced (AC-7); preserve the 3 STOP/Blocked payload strings
   exactly (AC-8).
3. Run `npm run build && npm test` — must be 812/812 green with zero diffs
   outside `content/skill-pm.md` (AC-1).
4. Spot-check every Copy/Strings row (S01–S22) against the rewritten file
   by direct string/regex match before submitting.
5. Route to qa-engineer for sign-off (single-file, well-bounded content
   change; architect/code-reviewer hop not required given the small,
   fully-enumerated blast radius — unlike A6's 265-line file, this is a
   54-line file with an exhaustive pin manifest already derived).

### Reference specs for context (not modified by this ticket)

`specs/pm-cut-approval-gate.md`, `specs/pm-cut-approval-gate-architecture.md`,
`specs/server-scope-decision-gate.md`, `specs/auto-routing-v3.13.md`,
`specs/auto-routing-v3.13-architecture.md`, `specs/visual-selfconverge-architecture.md`
— these are the specs that ORIGINALLY introduced the gates this rewrite is
consolidating (cut-approval, scope-decision, question-batch/resource-audit
renumbering, geometric-density split). They remain valid historical record;
this ticket does not supersede or edit them.

### Backlog cross-reference

Backlog A7 (`docs/backlog.md`). A11 (escalation-route tables) lists A7 as a
dependency — do not block on A11 landing first; A7 ships independently, same
precedent as A6.
