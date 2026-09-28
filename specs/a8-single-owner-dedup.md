# Spec: a8-single-owner-dedup

Coded by @pm

## Backlog source

`docs/backlog.md` A8 — "Single-owner dedup of multi-told mechanisms" (P2).
Cut-approval (3×) was already resolved via C2 (§3.1, `content/const-08-chain-31-mid.md`).
**Remaining scope per the backlog text**: self-converge relaxation told 2×
(constitution §1 / skill-sr-engineer) with overlapping qualifiers.

## Re-verification against live content (2026-07-10)

The constitution is now composed from 15 `content/const-*.md` fragments
(v3.44.0+, `prompts/constitution-manifest.ts`) — the backlog's "constitution §1"
reference resolves to `content/const-04-design-surgical.md` (self-converge
relaxation) and `content/const-02-design-mvp.md` (Design-baseline scope,
Visual Widgets exception, Design-sourced assets — same §1 MVP-exception family).

`grep -rn "self-converge" content/const-*.md content/skill-*.md` confirms
**exactly 2 live sites**, matching the backlog:

1. `content/const-04-design-surgical.md` L2 — full definition, 3 bounding
   qualifiers (a)(b)(c). This is the correct single owner (server/QA-gate-adjacent
   process rule — the owning document per the single-owner principle).
2. `content/skill-sr-engineer.md` L26 — restates two of the three qualifiers
   in prose ("QA still independently verifies… NOT a self-issued visual
   verdict"; "you MAY fix all VSA-detected deviations in one pass rather than
   one property per handoff") rather than pointing.

**Drift from backlog framing — additional live duplicate found in the same
sweep, same file, adjacent lines:** `content/skill-sr-engineer.md` L28 restates
`content/const-02-design-mvp.md`'s **Design-baseline scope (v3.27.0)** bullet
nearly verbatim after a colon ("See Constitution §1 Design-baseline scope
(v3.27.0): the canonical design is the scope baseline — a gap vs design is a
fidelity defect, not MVP compliance.") — a second live 2× mechanism the backlog
text didn't name. In scope for this ticket (same file, same fix pattern,
trivial incremental cost).

**Found but descoped (report only, no fix in this ticket):**
- `content/skill-sr-engineer.md` L28 "Visual Widgets exception" mention and
  `content/skill-pm.md` L23 "Cross-reference to Constitution §1" mention both
  cite `const-02`'s Visual Widgets exception bullet, but each does so as a
  single clause + explicit pointer tag — the same style already accepted
  elsewhere in this codebase (e.g. `skill-coordinator.md`'s cut-approval
  mentions per C2). Not a clear violation of single-owner; recommend leaving
  as-is rather than re-opening a 3-file edit for marginal gain.
- `content/skill-sr-engineer.md` L27 "Design-sourced assets" mention restates
  `const-02`'s bullet with added sr-specific operational detail (asset
  manifest path, SVG `path`-data warning) not present in the constitution
  copy — borderline, judged process-specific enough to leave.
- `content/skill-sr-engineer.md` L28 `visual_round >= 3` split-escalation
  sentence overlaps `content/const-09-design-chain-vround.md`'s "Split
  escalation (Round 3)" bullet, but the skill copy is the operational
  Escalation-Routes trigger sr-engineer actually acts on (process class,
  correctly skill-owned per the single-owner principle's second branch) —
  not a duplicate in the same sense as the other two.
- Recommend a future fine-grained backlog item if these are judged worth
  trimming later; NOT folded into this ticket to keep the diff reviewable
  and avoid the accretion pattern A6/A7 warn about.

**Zero `content/const-*.md` edits in this ticket.** Both fixes are confined to
`content/skill-sr-engineer.md` — this keeps the change outside
`composeConstitution()`'s output entirely, so it cannot affect
`test/compose-equivalence.test.mjs`'s golden-fixture comparison or the
full-bundle token-cap tests in `test/context-budget.test.mjs`. The only
budget test in scope is the skill-sr-engineer-specific ceiling
(`test/context-budget.test.mjs` "AC1/AC2: skill-sr-engineer stripped token
count meets ≤ 2138 cap") — shrinking text only improves margin there, never
regresses it. No test greps for the exact restated clauses being removed
(verified: `grep -rn "MAY fix all VSA-detected deviations in one pass" test/*.mjs`
and the "scope baseline — a gap vs design" variant both return zero hits).
Expect **zero new red tests**; sr-engineer should still run the full suite and
file `qa_reports/expected-red_a8-single-owner-dedup.txt` per the C15 convention
if anything unexpected goes red, but none is anticipated.

## Fix — single-owner principle

Full definition lives in exactly one document; every other mention shrinks to
one pointer line.

### Fix 1 — self-converge relaxation

Owner: `content/const-04-design-surgical.md` (unchanged — already the sole
full definition with qualifiers (a)(b)(c)).

Edit `content/skill-sr-engineer.md` L26 (inside "Whole-surface self-converge
loop" — heading text and steps (a)-(e) unchanged, only the trailing sentences
touched):

- Remove: "QA still independently verifies every VSA row at PASS — this loop
  is upstream and additive, NOT a self-issued visual verdict (§3.2 builder ≠
  judge)."
- Remove: "Per Constitution §1 (Surgical changes, self-converge relaxation
  v3.31.0), inside this loop you MAY fix all VSA-detected deviations in one
  pass rather than one property per handoff."
- Replace both with a single pointer line: "QA still independently verifies
  every VSA row at PASS (§3.2 builder ≠ judge). Per Constitution §1
  self-converge relaxation (v3.31.0) — full mechanism and bounding qualifiers
  there; this loop is upstream/additive only."
- Keep verbatim: "If no render harness exists, do NOT claim self-checked —
  note it and let qa-visual catch it."

### Fix 2 — Design-baseline scope

Owner: `content/const-02-design-mvp.md` (unchanged — already the sole full
definition).

Edit `content/skill-sr-engineer.md` L28: replace "See Constitution §1
Design-baseline scope (v3.27.0): the canonical design is the scope baseline —
a gap vs design is a fidelity defect, not MVP compliance." with "See
Constitution §1 Design-baseline scope (v3.27.0) — full definition there."
(preserve the existing `<!-- origin:start/end -->` tag wrapping the version
number exactly; do not touch tag placement/balance).

Leave the rest of L28 (Visual Widgets exception sentence, `visual_round >= 3`
split-escalation sentence) unchanged — descoped per above.

## Acceptance criteria

- AC1: `content/const-04-design-surgical.md` and `content/const-02-design-mvp.md`
  are byte-identical to their pre-ticket state (zero constitution edits).
- AC2: `content/skill-sr-engineer.md`'s self-converge relaxation paragraph no
  longer restates the MAY-fix-in-one-pass permission or the QA-independent-
  verification qualifier as full clauses — only a pointer to Constitution §1.
- AC3: `content/skill-sr-engineer.md`'s Design-baseline scope mention no
  longer restates "the canonical design is the scope baseline — a gap vs
  design is a fidelity defect, not MVP compliance" — only a pointer to
  Constitution §1 (v3.27.0).
- AC4: the "Whole-surface self-converge loop" heading, its five lettered
  steps (a)-(e), and the "Design-Aware Pre-Flight" numbered structure are
  unchanged — only trailing restated sentences are touched.
- AC5: `npm run build && npm test` — zero new failures (or, if any appear
  unexpectedly, an expected-red manifest is filed per C15 and the reason is
  documented in `pending_notes`).
- AC6: `docs/backlog.md` A8 entry is marked done with a dated note (release-engineer).

## Out of scope

- Any edit to `content/const-*.md` fragments.
- The four descoped duplicate sites listed above (Visual Widgets exception ×2,
  Design-sourced assets, visual_round split-escalation).
- A6/A7 (separate P1 consolidation rewrites, not part of this cut).
