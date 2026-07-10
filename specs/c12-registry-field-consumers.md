# c12-registry-field-consumers

## Problem Statement
`gates/registry.ts`'s `GATE_REGISTRY` (22 entries, one per gate error code) carries
three doc-facing prose fields per entry — `triggerEdge`, `armCondition`,
`clearingArtifact` — that have **zero consumers and zero test assertions**
anywhere in the repo (confirmed by a repo-wide property-access grep: no file
ever reads `.triggerEdge`, `.armCondition`, or `.clearingArtifact` off a
`GateDefinition`). Only two sibling fields on the same type, `errorCode` and
`hintStatic`/`documentedInProse`, are protected by the generative parity check
in `test/error-code-contract.test.mjs` (A10, DR-3). These three fields are a
fourth hand-authored copy of gate semantics that nothing verifies — exactly
the unverified-copy drift class A10 was built to eliminate, now recreated
inside the registry itself. Per the backlog ticket's own framing: "an
unverified copy is worse than no copy" — the fields either need a real
consumer (generation), a verification harness (assertion), or removal.

## User Stories
- As a maintainer editing `gates/registry.ts`, I want the three doc-facing
  fields checked by CI the same way `errorCode`/`hintStatic` already are, so
  that an edit that silently drifts from the shipped constitution/skill
  prose is caught before it ships, not trusted blindly.
- As a future engineer relying on `gates/registry.ts` as a structured source
  of truth, I want confidence that `triggerEdge`/`armCondition`/
  `clearingArtifact` are live-verified, not decorative, so I don't have to
  independently re-derive them from prose before trusting them.

## Acceptance Criteria
- **AC1** — Given all 22 `GATE_REGISTRY` entries, when
  `test/error-code-contract.test.mjs` runs, then each entry's `triggerEdge`,
  `armCondition`, and `clearingArtifact` is asserted non-empty (the same
  parity bar the existing `hintStatic` check already applies).
- **AC2** — Given an entry whose `armCondition` or `triggerEdge` encodes a
  mechanically checkable literal (a named predicate/function call such as
  `hasDesignModeRequiringVisual`, or an `agent:status` transition-edge pair
  such as `pm:In_Progress`), when the test runs, then it asserts that literal
  appears verbatim in the `content/*.md` (or `skill-*.md`) prose that already
  backtick-quotes that entry's `errorCode` (per the existing
  `documentedInProse` → doc-file mapping).
- **AC3** — Given an entry whose `armCondition`/`triggerEdge`/
  `clearingArtifact` value is free-form English with no mechanically
  checkable literal, when the test runs, then it is asserted at the AC1
  non-empty bar only, and is named in an explicit allowlist/comment in the
  test file — never silently exempted without acknowledgment in the diff.
- **AC4** — Given the new assertions, when a field's value is deliberately
  mutated in a negative-control (test-of-the-test) pass, then the
  corresponding assertion fails — proving the check is not vacuously true.
- **AC5** — Given the full test suite, when `npm test` runs after this
  change, then `test/compose-equivalence.test.mjs` and
  `test/context-budget.test.mjs` pass **unchanged**, with zero edits to
  `test/fixtures/compose-golden/*.txt` or to any hardcoded `~tok` cap —
  proof this stays inside the guardrail DR-3 chose and does not reopen the
  A9-hardened composition pipeline.
- **AC6** — Given `gates/registry.ts`, when this feature ships, then its
  `GateDefinition` type and all 22 literal entries are unchanged except for
  correcting any factual staleness discovered during verification (no field
  removed, no field added, no edit required to `prompts/build.ts` or any
  `content/const-*.md` file to satisfy AC1–AC4).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no new user-facing strings |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Rendering §3.1 gate-table prose or skill "gates you must clear" sections
  FROM the registry fields into `prompts/build.ts` / `content/const-*.md`
  — this is rejected option (a); see *Rejected Alternatives*.
- Deleting the three fields — this is rejected option (c); see *Rejected
  Alternatives*.
- Any edit to `prompts/build.ts`, `prompts/constitution-manifest.ts`, or the
  compose pipeline.
- Regenerating `test/fixtures/compose-golden/*.txt` (incl.
  `constitution-monolith.txt`) or re-baselining any `test/context-budget.test.mjs`
  token cap. If implementation pressure pushes toward either of these, that
  is a signal scope has drifted toward option (a) — STOP and flag back to
  PM rather than proceeding.
- Full mechanical 1:1 parity for every field — some `armCondition`/
  `triggerEdge`/`clearingArtifact` values are free English prose and only
  receive the AC3 non-empty bar, by design.

## Dependencies / Prerequisites
- Depends on A10 (gate-registry, done 2026-07-08) — `GATE_REGISTRY` and
  `test/error-code-contract.test.mjs`'s existing generative-parity pattern
  already exist; this feature extends that pattern, it does not invent one.
- No `design/<feature>.md` — non-design feature, no visual arm; Scope
  Decision Gate not armed (recorded on the handoff write regardless, per
  standing PM practice).
- Resource Audit Gate: zero external references found in the backlog C12
  body (no URL/figma/ticket references) — field omitted, non-blocking.
- Question Batch / Ambiguity Gates: no open questions accumulated — the
  three-option decision this ticket required was resolved by PM research
  below, not deferred to the human as an open question.

## Rejected Alternatives

### Option (a) — render §3.1 gate table / skill sections from the registry fields
The backlog's stated preference, but rejected for this cut. `specs/gate-registry-architecture.md`'s
DR-3 ("Rendering mechanism (AC-3/AC-4)") already weighed and explicitly
rejected in-band generation into content files for this exact class of
field, for three reasons that apply unchanged today:
1. **AC-3 forbids regenerating the compose-equivalence golden baseline** —
   `test/compose-equivalence.test.mjs` + `test/fixtures/compose-golden/*.txt`
   (incl. `constitution-monolith.txt`) assert `composeConstitution()`'s
   output is byte-identical to frozen fixtures. Any byte-level rewrite of
   `const-07-design-chain-gates.md` / `const-08-chain-31-mid.md` /
   `const-09-design-chain-vround.md` to be registry-generated would require
   regenerating that fixture set.
2. **The prose is not 1:1 with codes and is role-tailored.** The existing
   const-07/08/09 bullets are thematic (one bullet already spans 2 error
   codes), and skill-file cross-references are role-specific SOP paragraphs
   — mechanical generation from flat registry fields would either mismatch
   this shape or require storing whole prose paragraphs as `.ts` string
   literals (prose-in-TypeScript, strictly worse to maintain).
3. **It touches the A9-hardened composition pipeline** that
   `test/context-budget.test.mjs` guards with hardcoded `~tok` ceilings
   (currently as tight as ~3196–9106 across bundles) — a wording change to
   satisfy generation would very likely require a token-cap re-baseline,
   for zero behavioral gain over the assertion approach.

Estimated blast radius: `prompts/build.ts`, 3 `content/const-*.md` files
(possibly `skill-qa-engineer.md`/`skill-code-reviewer.md` too),
`constitution-manifest.ts` wiring, compose-golden fixture regen, and a
context-budget cap re-baseline — ~10–15 files, and it reopens a design
question DR-3 already closed 2 days prior. **If the human overrides this
recommendation and picks option (a) instead, the cut below should be
re-drawn with an architect hop first** — the rendering-mechanism redesign
(marker scheme, per-code vs. per-bullet granularity, fixture/cap
re-baseline plan) is exactly the kind of cross-cutting design call
`specs/gate-registry-architecture.md` itself required an architect pass to
resolve the first time.

### Option (c) — delete the three fields until a consumer exists
MVP-strict, lowest blast radius (`gates/registry.ts` only — drop 3 interface
fields + their 66 literal values across 22 entries). Rejected because it
discards gate-semantics captured during A10 with no compensating
verification, and because A10's intent was a fully structured registry;
deleting a third of its doc-facing surface is a step backward a future
ticket would likely re-propose once a consumer need reappears. The stated
risk in C12 is that the copy is *unverified*, not that it exists — the fix
for "unverified" is verification (option b), not removal, when removal
isn't otherwise forced by a conflicting priority.

### Option (b) — extend `test/error-code-contract.test.mjs` to assert the fields against prose (CHOSEN)
Directly extends A10's own established pattern (generative parity check,
DR-3) to the two fields A10 left unchecked. Confines the diff to
`test/error-code-contract.test.mjs` (plus a possible minor
`gates/registry.ts` wording correction if verification surfaces factual
staleness) — no touch to `build.ts`, `constitution-manifest.ts`,
`content/const-*.md`, the compose-golden fixture, or context-budget caps.
Weaker than option (a) (keyword/non-empty parity, not full
generation-backed identity) but that weakness is bounded and explicit
(AC3's allowlist), and it closes the actual risk the ticket names — an
unverified copy — without reopening a cost DR-3 already paid to avoid.
