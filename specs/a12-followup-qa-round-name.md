# a12-followup-qa-round-name

## Problem Statement
A12 (`a12-partials-limits-registry`, v3.64.0) rewrote every bare-number
restatement of a named `## Limits` value across `content/const-*.md` and
`content/skill-*.md` to reference the Limits-table name instead (e.g.
const-08's `review_round` line). One site was deliberately left outside
A12's AC4 file list and flagged as a non-blocking follow-up in the v3.64.0
CHANGELOG note (sr-engineer flag, code-reviewer concurred):
`content/const-06-chain-31-head.md` L8 still restates the `qa_round` cap as
a bare number:

> `- After 3 QA FAILs (Round 4), only \`(pm, In_Progress)\` is accepted.`

This is the same drift class A12 fixed everywhere else — body text
restating a Limits-table value by number instead of by name, one of the
two symmetric circuit breakers (`qa_round` / `review_round`) already
inconsistent with its own mirror (const-08's `review_round` line, already
correct). Fix scope: this one line, no other const/skill content changes.

## User Stories
- As an agent reading `const-06-chain-31-head.md`, I want the `qa_round`
  circuit-breaker line phrased the same way as const-08's `review_round`
  line, so that the two symmetric caps read consistently and a future
  Limits-table value change (e.g. `qa_round` cap 3 → 4) doesn't leave this
  line silently stale.

## Acceptance Criteria
- **AC1** — Given `content/const-06-chain-31-head.md` L8 currently reads
  `After 3 QA FAILs (Round 4), only \`(pm, In_Progress)\` is accepted.`,
  when the fix lands, then it reads `After the \`qa_round\` cap of QA FAILs
  (Round 4 of \`qa_round\`), only \`(pm, In_Progress)\` is accepted.` —
  mirroring const-08's shipped `review_round` phrasing exactly, substituting
  `qa_round` for `review_round` and "QA" for "code-reviewer".
- **AC2** — Given the A12 blueprint's Limits Reference Rewrite Map
  `[KEEP-DERIVED]` rule (`specs/a12-partials-limits-registry-architecture.md`),
  when the line is rewritten, then the literal `Round 4` index is preserved
  (it is a derived cap+1 lock index, not a restated limit value) — only the
  bare `3` is replaced with the `qa_round` name-reference.
- **AC3** — Given no other line in `const-06-chain-31-head.md` restates a
  Limits-table value, when the fix lands, then no other line in the file
  changes.
- **AC4** — Given `const-06-chain-31-head.md` carries the `chain` tag
  (ships on every non-lite dispatch: teamwork, sr-engineer, pm, architect,
  researcher, qa-engineer), when the line grows by a few characters, then
  `test/compose-equivalence.test.mjs` golden fixtures under
  `test/fixtures/compose-golden/*.txt` are regenerated via
  `scripts/capture-constitution-golden.mjs` and the diff reviewed, and
  `test/context-budget.test.mjs` per-role token caps are independently
  re-measured and bumped to the exact new value (no headroom) for every
  cap whose bundle includes the `chain` tag — same Phase-2 convention as
  A12 (T-A12-08 precedent).
- **AC5** — Given the full test suite passes after AC1–AC4, when
  qa-engineer signs off, then `npm test` reports all tests passing with no
  unrelated regressions.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| const06.qa-round-line | `After the \`qa_round\` cap of QA FAILs (Round 4 of \`qa_round\`), only \`(pm, In_Progress)\` is accepted.` | authored-here — mirrors `content/const-08-chain-31-mid.md`'s already-shipped `review_round` line verbatim in structure (A12, v3.64.0), substituting the symmetric `qa_round` name and "QA" for "code-reviewer" per the actor already used elsewhere in const-06 (L7: `agent_id="qa-engineer"`) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (content-only prose fix) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any other const-*.md or skill-*.md line. This ticket is scoped to the
  single flagged line; no new drift sweep.
- Any change to `tools/transitions.ts`, `ALLOWED_TRANSITIONS`, or the
  `qa_round` cap's actual value (3) — text-framing fix only, behavior
  unchanged.
- A release bump on its own — cut with the next batch per release-engineer
  discretion, or as a standalone patch release if the coordinator prefers
  to ship it immediately (release-engineer's call, not gated here).

## Dependencies / Prerequisites
- Sequenced after A12 (`a12-partials-limits-registry`, v3.64.0) — the
  Limits-table name-reference convention and the `[KEEP-DERIVED]` rule this
  ticket applies both ship there. No re-derivation needed; copy the
  established pattern.
- No external references (URLs, Figma, tickets, Azure DevOps) found —
  Resource Audit Gate: zero hits, field omitted.
- Non-design ticket: no `design/<feature>.md`, Scope Decision Gate not
  armed. `scope_decision: "single-feature"` recorded on the routing write
  per standing PM practice regardless.
- Routing: `next_role: sr-engineer` (not architect) — single line in a
  single file, no new data model, no cross-cutting API. Well under the
  ≥3-module architect threshold.
