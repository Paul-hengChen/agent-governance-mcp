# Compose-Not-Strip: Overlay Modules Replace Fence Stripping

> Backlog: `docs/backlog.md` **A9** (P2, supersedes A3).

## Problem Statement

`prompts/build.ts` assembles every role prompt **subtractively**: it loads one
large `content/constitution.md`, then removes `<!-- chain-only:start/end -->`,
`<!-- rationale:start/end -->`, and `<!-- design-only:start/end -->` fenced
spans with regexes (`stripChainOnly`, `stripRationale`, `stripDesignOnly`) to
produce the right bundle for lite mode, non-`fullDetail` dispatch, and
non-design features respectively. A single malformed or unbalanced fence
marker silently changes the governance text an agent receives — no build
error, no test tied to the marker's structural validity, and no signal to
the human that the bundle is corrupted. `content/constitution.md` also has
non-trivial fence **nesting** today (design-only spans nest inside
chain-only spans in §3.1/§3.2/§4; rationale spans nest inside a design-only
span at §1 L17; origin spans nest inside both), which makes hand-editing the
fences error-prone in exactly the way A3 (superseded by this ticket) wanted
to guard defensively rather than eliminate structurally.

This ticket inverts the assembly model to **additive composition**: split
`content/constitution.md` into `content/constitution-core.md` (always
shipped) plus `content/overlay-chain.md` (chain-role dispatch only) and
`content/overlay-design.md` (design-armed dispatch only), and change
`prompts/build.ts` to **concatenate** the modules that apply to a given
dispatch, instead of stripping the modules that don't. Once there is nothing
to strip, the unbalanced-fence failure class disappears structurally instead
of being guarded against (hence A3, the build-time fence validator, is
superseded rather than implemented).

The one hard constraint: this is a **pure refactor of how the text is
assembled**, not a change to what the text says. For every one of the four
live/reserved dispatch modes — lite, full non-design, full design-armed, and
`fullDetail` — the new composed bundle's normative content must be
empirically verified equivalent to what today's strip pipeline produces.
"Equivalent" is checked as byte-identical output on representative fixtures
captured **before** any content/build.ts edits land, per Acceptance
Criteria below — not asserted by inspection.

## User Stories

- As an sr-engineer editing `content/constitution.md` today, I want the
  file to be split into independently-lintable, independently-token-countable
  modules, so that a mistake in one overlay cannot silently corrupt the
  governance text shipped to an unrelated dispatch mode.
- As a maintainer of `prompts/build.ts`, I want the assembly logic to be a
  concatenation of modules that are true-or-false includable per dispatch,
  so that "what does role X receive" is answered by "which files got
  concatenated" instead of "which regex successfully matched a fence in a
  1,951-line document."
- As the team shipping this change, I want an empirical old-vs-new diff per
  dispatch mode before merge, so "supersedes A3" is not just an argument —
  it is a tested fact that no rule text moved, dropped, or reworded.

## Acceptance Criteria

**AC1 — Additive composition replaces subtractive stripping.**
- Given `prompts/build.ts` after this change,
- When `buildPromptForRole()` assembles the constitution portion of a
  prompt,
- Then it does so by concatenating `content/constitution-core.md` with
  zero or more of `content/overlay-chain.md` / `content/overlay-design.md`
  (selected by the existing `skillFile === LITE_SKILL_FILE` and
  `isDesignFeature` signals) — it MUST NOT call `stripChainOnly` or
  `stripDesignOnly` against a monolithic `content/constitution.md` to
  produce that text. (`stripRationale` and `stripOriginTags` remain
  text-transform passes run over the assembled result — see AC5/AC7.)

**AC2 — Lite dispatch is equivalent to today.**
- Given a lite dispatch (`skillFile === "skill-coordinator-lite.md"`),
- When the composed constitution is produced,
- Then it is byte-identical, after `stripOriginTags`, to the golden
  snapshot of today's `stripRationale(stripChainOnly(stripOriginTags(...)))`
  output captured for the lite mode fixture (Task T02).

**AC3 — Full non-design dispatch is equivalent to today.**
- Given a full chain-role dispatch (`skillFile !== LITE_SKILL_FILE`) on a
  feature that is NOT design-armed (`hasDesignModeRequiringVisual(...)
  .required === false`, including the "no state" / "no active_feature"
  safe-default case),
- When the composed constitution is produced,
- Then it is byte-identical, after `stripOriginTags`, to the golden
  snapshot of today's non-design chain-role output (Task T02).

**AC4 — Full design-armed dispatch is equivalent to today.**
- Given a full chain-role dispatch on a feature that IS design-armed,
- When the composed constitution is produced,
- Then it is byte-identical, after `stripOriginTags`, to the golden
  snapshot of today's design-armed chain-role output (Task T02), including
  the §3.2 body and the §3.1/§4 visual bullets that only exist on this arm.

**AC5 — `fullDetail` is equivalent to today.**
- Given `buildPromptForRole(..., fullDetail=true)`,
- When the composed constitution and skill body are produced,
- Then `stripRationale` is skipped exactly as it is today (rationale fences
  kept verbatim), and the result is byte-identical to the golden snapshot
  of today's `fullDetail=true` output on both the design and non-design
  arm (Task T02). This mode has no live caller today (reserved for future
  readers/tests — see `specs/governance-text-load-architecture.md` DR-5)
  but remains part of the equivalence contract because tests exercise it.

**AC6 — Rationale stays out of every shipped bundle.**
- Given any dispatch mode,
- When the composed bundle is produced,
- Then `content/constitution-rationale.md` is never loaded by
  `prompts/build.ts` or `bin/agent-governance-context.mjs` (unchanged —
  it already isn't today), and every inline `<!-- rationale:start/end -->`
  span inside `constitution-core.md` / `overlay-chain.md` /
  `overlay-design.md` is still removed by `stripRationale` for
  non-`fullDetail` dispatch, exactly as today.

**AC7 — A4's tag-strip pass keeps working on the new shape.**
- Given the additively-composed bundle (any mode),
- When `stripOriginTags` runs,
- Then it removes every `<!-- origin:start/end -->` span the same way it
  does today, regardless of which module(s) the span now lives in — the A4
  behavior (governance-tag-strip, v3.44.0) is preserved, not just the A4
  function signature.

**AC8 — Single source of truth; no dual maintenance.**
- Given the module split lands,
- When a maintainer wants to change a piece of governance text,
- Then that text exists in exactly one of `constitution-core.md` /
  `overlay-chain.md` / `overlay-design.md` — `content/constitution.md`
  (the old monolith) is deleted once every caller (`prompts/build.ts`,
  `bin/agent-governance-context.mjs`, any script) has migrated. No file
  contains a stale copy of text that now lives in another module.

**AC9 — SessionStart hook stays byte-equivalent.**
- Given `bin/agent-governance-context.mjs` (the SessionStart hook, which
  does NOT go through `prompts/build.ts` — separate module system, and
  today carries its own duplicate `stripChainOnly`, per the DR-3 parity
  comment in `prompts/build.ts`),
- When the hook runs in lite mode and in full-coordinator mode
  (`AGC_DEFAULT_SKILL=full`) after this change,
- Then its `additionalContext` output is byte-identical (constitution
  portion) to today's output for both variants, sourced from the new
  module set instead of `content/constitution.md` + its own
  `stripChainOnly` copy. The architecture doc (Task T01) must define what
  replaces the DR-3 "keep the regex in sync" contract now that there is no
  regex to keep in sync — e.g. "keep the module file list in sync."

**AC10 — No server-checked token or error code changes.**
- Given the full diff of this ticket,
- When reviewed against `tools/transitions.ts` and `tools/evidence-file.ts`,
- Then neither file's logic changes — every string that either file
  checks for (`VISUAL_BASELINES_REQUIRED`, `SCOPE_DECISION_REQUIRED`,
  `next_role:`, etc.) is untouched. This ticket is content-assembly-only.

**AC11 — A3 stays superseded, not implemented.**
- Given this ticket ships,
- Then no build-time fence-marker-pairing validator (A3's proposal) is
  added — the fence-marker failure class no longer exists once stripping
  is gone, so the guard A3 proposed has no object to guard.

**AC12 — Build and tests are green.**
- Given the full change set,
- When `npm run build && npm test` runs,
- Then both exit 0, including the reworked `test/context-budget.test.mjs`
  and the new empirical equivalence tests (AC2–AC5).

## Copy / Strings

N/A — this is a build-time governance-text assembly refactor with no new
user-facing strings. Every string the composed bundle emits already exists
verbatim in today's `content/constitution.md`; this ticket relocates text
across files, it does not author new copy. (`authored-here` would apply
only if new prose were introduced, which AC1–AC5 explicitly forbid.)

## Visual Tokens

N/A — no visual surface. This ticket does not touch any UI, styling, or
rendered visual output.

## Visual Widgets

N/A | — | feature has no non-primitive widgets.

## Out of Scope

- **A10 (gate registry as structured data)** and **A12 (shared SOP
  partials)** — both are named in the backlog as building on A9's module
  split, but are separate future tickets. Do not start either.
- **A3's build-time fence-marker validator** — superseded (AC11). Not
  implemented as a fallback or a transitional safety net.
- Any change to the **wording, ordering semantics, or gate behavior** of a
  constitution rule. This ticket may reorder prose across files (module
  boundaries force some physical relocation) but must not reword, add, or
  drop a rule. Byte-content preservation is the bar (AC2–AC5), not
  line-position preservation.
- Any change to `content/skill-*.md` files. Skill files only go through
  `stripOriginTags` and `stripRationale` (both stay as pure text-transform
  functions over a single file — no chain-only/design-only axis applies to
  skill bodies today), so they are untouched by this ticket.
- Any change to `tools/transitions.ts`, `tools/evidence-file.ts`, or any
  other server-enforced gate logic (AC10).
- Any change to `content/constitution-rationale.md`'s content. Its
  one-way `§X` references into the constitution must keep resolving (the
  composed document's section numbers/headings are unchanged — see
  Dependencies) but the file itself is not edited by this ticket unless a
  reference literally breaks.

## Dependencies / Prerequisites

- **Fence nesting is non-trivial and must be resolved by the architect,
  not assumed away.** In today's `content/constitution.md`, design-only
  spans appear in two structurally different places: (a) nested inside
  chain-only spans (§3.1 visual evidence/report-schema/baseline-manifest
  gates, all of §3.2, the §4 visual-round + design-auditor paragraphs) —
  these are only ever relevant when BOTH chain mode and design-arm are
  active; and (b) standalone inside §1, outside any chain-only span (the
  Visual Widgets exception, design-baseline scope, design-sourced-assets,
  self-converge-relaxation bullets) — these are relevant on ANY
  design-armed dispatch, lite included. A single `overlay-design.md` file
  concatenated at one insertion point cannot represent both cases
  correctly. The architecture task (T01) must decide the module
  boundary/insertion-point design (e.g. two design-only fragments with two
  insertion points, or an outline restructure that groups all design-only
  content together) before any content is physically moved.
- **`bin/agent-governance-context.mjs` is in scope even though it wasn't
  in the human's original ~8-file estimate.** It does not call
  `prompts/build.ts` (different module system) and keeps its own
  duplicate of `stripChainOnly` today, explicitly to mirror
  `prompts/build.ts` per the DR-3 parity rule
  (`specs/context-budget-reduction-architecture.md`). Once
  `content/constitution.md` is split/removed, this script must be updated
  in lockstep or it silently breaks (reads a file that no longer exists)
  or silently diverges (reads a stale monolith kept around only for its
  benefit, defeating AC8). See AC9.
- **Golden-snapshot fixtures must be captured from the pre-refactor
  pipeline first.** Task T02 captures `buildPromptForRole()` (and the
  hook's) actual output for the four dispatch modes in AC2–AC5 BEFORE any
  content or `build.ts` edit lands — these snapshots are the empirical
  proof artifact the "hard behavior-preserving requirement" depends on.
  Sequencing matters: if content edits land before the snapshot capture,
  the diff proves nothing.
- **No `design/<feature>.md` exists for this ticket** (pure engineering
  refactor, no design-auditor step). The Scope Decision Gate and the
  Visual Structural Assertions spec section are therefore not triggered
  (`scope_decision: single-feature` recorded on the routing write for
  audit-trail consistency with prior non-design tickets in this repo, not
  because the gate requires it).
- **Resource Audit Gate (constitution §7):** scanned the backlog A9
  section and the coordinator's brief for `http(s)://`, `figma`, `sketch`,
  `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, `JIRA`.
  Zero hits (two internal backlog cross-references, A3 and A10/A12, both
  already resolved above under Out of Scope / AC11). No fetch/index/ignore
  decision required.
- **Question Batch Gate:** zero clarifications accumulated — the fence-
  nesting wrinkle above is a technical design decision for the architect,
  not a product-requirements ambiguity, so it is handled via T01 rather
  than an `AskUserQuestion` round-trip.
