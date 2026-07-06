# error-code-contract-test

## Problem Statement

Governance prose in `content/*.md` (the constitution and the seven role-skill
files) names specific server-emitted gate error codes by their exact
SCREAMING_CASE identifier — e.g. `` `VISUAL_PROVENANCE_MISSING` ``,
`` `CUT_APPROVAL_REQUIRED` ``, `` `BASELINE_MANIFEST_MISSING` `` — so that an
agent reading the SOP recognizes a real `⛔` rejection when the server issues
one. Nothing currently prevents that prose from drifting away from what
`tools/transitions.ts`, `tools/evidence-file.ts`, and the PASS-gate handler in
`index.ts` actually emit. A code changes a rejection code, or renames one, or
adds a new gate, and the docs silently stop matching reality — the failure
surfaces downstream as an agent staring at a confusing `⛔` it doesn't
recognize, or trusting stale prose that describes a gate no longer wired up.

This ticket (backlog A5) closes that gap with a cheap, static contract test —
an interim guard until backlog A10 makes the content↔code relationship
generative (single source of truth, codegen'd). No runtime behavior changes.

**Investigation finding (this spec):** live extraction (below) already shows
real drift: 8 of the 18 code-side gate error codes have zero mention anywhere
in `content/*.md` today (`AGENT_ID_REQUIRED`, `MISSING_EVIDENCE`,
`MISSING_REVIEW_EVIDENCE`, `QA_ROUND_EXCEEDED`, `REVIEW_ROUND_EXCEEDED`,
`TRANSITION_REJECTED`, `VISUAL_ROUND_EXCEEDED`, `VISUAL_WIDGETS_UNVERIFIED`).
This spec's task cut fixes that drift (T-ECCT-01) *before* the contract test
lands (T-ECCT-02), so the new test is green on introduction rather than
shipping red.

## User Stories

- As an sr-engineer changing a gate's error code in `tools/transitions.ts` or
  `tools/evidence-file.ts`, I want a test to fail immediately if I forget to
  update the matching prose in `content/*.md`, so that the docs never silently
  diverge from server behavior.
- As a PM/architect reading `content/constitution.md` to understand what a
  gate does, I want every error code named there to be guaranteed to exist in
  code, so that I'm never chasing a phantom rejection that was renamed or
  removed.

## Acceptance Criteria

**Shape rule (used identically by both extraction sides):** a token qualifies
as a "gate error code" iff it matches
`/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/` **and** additionally matches
`/_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED)$/` **or**
`/^MISSING_/`. This was derived empirically (see Dependencies) to capture
exactly the 18 known gate codes while excluding SCREAMING_CASE noise that
happens to share the same backtick / all-caps surface form (constant names,
review-verdict labels, routing tokens — see AC-6).

- **AC-1 (code-side extraction, non-vacuous):** Given the source files
  `index.ts`, `tools/*.ts`, `schema/*.ts`, `guards/*.ts`, when the test reads
  each file's raw text and extracts every token matching the shape rule via
  `\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b`, then the resulting set `CODE_CODES` has
  `size >= 18` (sanity floor — guards against a regex typo that silently
  matches nothing and makes AC-3/AC-4 vacuously pass).
- **AC-2 (doc-side extraction, non-vacuous):** Given every file in
  `content/*.md`, when the test extracts every backtick-delimited span
  `` `TOKEN` `` whose inner text matches the shape rule, then the resulting
  set `DOC_CODES` has `size >= 1`.
- **AC-3 (direction a — docs ⊆ code):** Given `DOC_CODES` and `CODE_CODES`,
  when compared, then `DOC_CODES \ CODE_CODES` is empty; on failure the test
  reports the orphaned doc-only codes by name and the file(s) they appear in.
- **AC-4 (direction b — code ⊆ docs):** Given `DOC_CODES` and `CODE_CODES`,
  when compared, then `CODE_CODES \ DOC_CODES` is empty; on failure the test
  reports the undocumented code-only codes by name and the file they were
  found in.
- **AC-5 (green on introduction):** Given T-ECCT-01 has landed (the 8
  previously-undocumented codes now have a backtick mention in `content/*.md`)
  before T-ECCT-02 adds the test file, when `node --test
  test/error-code-contract.test.mjs` runs on the resulting tree, then both
  AC-3 and AC-4 pass with zero hardcoded allowlist/exclude entries.
- **AC-6 (shape-rule precision — no-noise guard):** Given the known
  SCREAMING_CASE-with-underscore, backtick-quoted tokens that are NOT gate
  error codes — `` `ALLOWED_TRANSITIONS` `` (transition-matrix export name),
  `` `REQUIRED_VISUAL_SECTIONS` `` (a constant name referenced in prose, not
  itself thrown), `` `AGC_AUTO_ROUTE` `` (a routing-convention token that
  never appears in `tools/*.ts`/`index.ts` at all), `` `CHANGES_REQUESTED` ``
  (a code-reviewer verdict label, not a rejection code) — when the shape rule
  is applied to each in isolation, then none of the four is classified as a
  gate error code (explicit inline assertions in the test, one per token,
  each with a one-line comment naming what the token actually is).
- **AC-7 (no build dependency):** Given the test reads source `.ts` and
  `content/*.md` text directly via `fs.readFileSync` (never imports from
  `dist/`), when run standalone as `node --test
  test/error-code-contract.test.mjs` without a prior `npm run build`, then it
  still passes — keeping it valid even against an unbuilt tree.

## Copy / Strings

N/A — this feature adds a test file only; it introduces no user-facing
strings, prompts, or UI copy.

## Visual Tokens

N/A | — | feature has no visual tokens (non-UI, test-only change).

## Visual Widgets

N/A | — | feature has no non-primitive widgets (non-UI, test-only change).

## Visual Structural Assertions

N/A | — | non-design feature; no `design/<feature>.md` exists and the visual
gate arm signal (`hasDesignModeRequiringVisual()`) is inactive.

## Out of Scope

- Building the generative single-source-of-truth mechanism described as the
  long-term fix in backlog A10 (e.g. codegen'ing `content/*.md` snippets from
  a canonical error-code registry, or vice versa). This ticket is explicitly
  the cheap interim static guard, not that.
- A shared `tools/error-codes.ts` export module. Investigated and rejected
  for this ticket: the shape-rule regex (above) extracts the full 18-code
  inventory cleanly from existing source with zero false positives against
  the four known noise tokens (AC-6) and zero false negatives (AC-1/AC-2
  floors), so introducing a new shared module — and refactoring ~15+ call
  sites in `transitions.ts`/`evidence-file.ts`/`index.ts` to reference it —
  would add behavior-adjacent risk for no contract benefit. Revisit only if
  A10 needs it.
- Renaming, removing, or otherwise changing the behavior of any existing gate
  or error code. Zero behavior change; doc-only + test-only diff.
- Scanning `docs/*.md`, `specs/*.md`, `README.md`, or `CHANGELOG.md` for error
  codes. Only `content/*.md` is governance prose loaded into agent
  workspaces (per `CLAUDE.md`'s own description of the three-layer defense);
  the other doc trees are project-internal and out of this contract's scope.
- Catching free-text rejection messages that carry no SCREAMING_CASE
  identifier at all (there are none today — every `⛔` rejection in `index.ts`
  and every `TransitionRejection.error` / evidence-file `code:` value is
  coded — but if one is ever added without a code, this test cannot see it).

## Dependencies / Prerequisites

- **Resource Audit Gate (constitution §7):** scanned `docs/backlog.md` §A5
  for external references (`http(s)://`, Figma, tickets, etc.) — none found.
  No fetch/index/ignore decisions needed.
- **Question Batch Gate:** zero clarifications accumulated — the ticket text,
  plus the live extraction performed while authoring this spec, fully
  resolved the shape-rule design and the scope of the sr-engineer task. No
  `AskUserQuestion` call made.
- **Live extraction performed 2026-07-06 (frozen here for reviewer
  traceability only — the test itself re-extracts live, it does not read this
  table):**

  | Code | In `content/*.md` today? |
  |---|---|
  | `AGENT_ID_REQUIRED` | No — T-ECCT-01 adds |
  | `BASELINE_MANIFEST_MISSING` | Yes |
  | `BASELINE_PROVENANCE_INCOMPLETE` | Yes |
  | `CUT_APPROVAL_REQUIRED` | Yes |
  | `MISSING_EVIDENCE` | No — T-ECCT-01 adds |
  | `MISSING_REVIEW_EVIDENCE` | No — T-ECCT-01 adds |
  | `PIXEL_GATE_ATTESTATION_MISSING` | Yes |
  | `QA_ROUND_EXCEEDED` | No — T-ECCT-01 adds |
  | `REVIEW_ROUND_EXCEEDED` | No — T-ECCT-01 adds |
  | `SCOPE_DECISION_REQUIRED` | Yes |
  | `TRANSITION_REJECTED` | No — T-ECCT-01 adds |
  | `VISUAL_ASSERTIONS_REQUIRED` | Yes |
  | `VISUAL_BASELINES_REQUIRED` | Yes |
  | `VISUAL_EVIDENCE_MISSING` | Yes |
  | `VISUAL_PROVENANCE_MISSING` | Yes |
  | `VISUAL_REPORT_INCOMPLETE` | Yes |
  | `VISUAL_ROUND_EXCEEDED` | No — T-ECCT-01 adds |
  | `VISUAL_WIDGETS_UNVERIFIED` | No — T-ECCT-01 adds |

- **T-ECCT-01 must land before T-ECCT-02** so the new test is green, not red,
  on introduction (AC-5). This is a hard task-order dependency, not just a
  suggestion.
- sr-engineer, when placing the 8 new mentions in T-ECCT-01, should anchor
  each one to the existing prose that already describes the behavior
  conceptually (e.g. `AGENT_ID_REQUIRED` next to
  `content/skill-qa-engineer.md`'s "required before any later PASS/FAIL is
  accepted" line; the three `*_ROUND_EXCEEDED` codes next to
  `content/constitution.md`'s existing round-cap paragraphs; `MISSING_EVIDENCE`
  / `MISSING_REVIEW_EVIDENCE` next to the PASS-evidence prose in
  `content/skill-qa-engineer.md` / `content/skill-code-reviewer.md`;
  `VISUAL_WIDGETS_UNVERIFIED` next to the existing Visual Widgets gate
  description in `content/constitution-rationale.md` /
  `content/skill-sr-engineer.md`) rather than appending a disconnected list —
  keep the doc-only diff minimal and in-context.
