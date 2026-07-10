# a12-partials-limits-registry

## Problem Statement

`content/skill-*.md` (12 files) and `content/const-*.md` (15 fragments) each hand-author
text that is either (a) verbatim-identical across multiple skill files, or (b) a bare
numeric literal (a round cap, a hop cap, a line/pass ceiling) repeated in prose across
several fragments and skills with no single canonical definition. Both are silent-drift
hazards: (a) the step-1 preflight line `` `tw_get_state` → `tw_detect_drift`. `` is
byte-identical across skill-architect.md, skill-pm.md, skill-design-auditor.md,
skill-researcher.md, and skill-sr-engineer.md today, but nothing enforces that it stays
identical when one is edited; separately, three skills (skill-design-auditor.md,
skill-researcher.md, skill-sr-engineer.md) each *restate*, in three different wordings,
a rule the constitution already states once (const-05-core-standards.md's "State
update" bullet) — despite const-01's own header mandate that "skills inherit everything
below — they MUST NOT restate these rules." (b) eight numeric limits (`qa_round` cap 3,
`review_round` cap 3, `visual_round` cap 5, hop cap 10, fix-try cap 2, file-read cap 3,
design-auditor pass budget 250 lines × 5 passes, sr-engineer task-size budget ≤5 files /
300 lines) are asserted independently in 4 constitution fragments and 6 skill files with
inconsistent framing (e.g. const-09 says "cap is 5 rounds," skill-qa-visual.md says
"round cap (6)" for the exact same limit) — changing a cap today means grepping all of
`content/` and hoping every restatement is caught.

This ticket is text/build-composition only: it does not change any server-side gate
logic (`tools/transitions.ts` round-increment/threshold code is untouched — the actual
enforcement values already live there and are not sourced from markdown), does not
touch a persisted-artifact schema, and does not add a schema_version bump.

## User Stories

- As a maintainer changing `visual_round`'s cap, I want one file to edit, so that every
  fragment referencing the cap picks up the new value (or, for prose that must restate
  the number for readability, so that a drift-lock test fails loudly if I forget one
  copy) instead of silently leaving stale copies behind.
- As a maintainer editing the shared step-1 preflight instruction, I want to edit one
  partial file, so that the five skills sharing it can never diverge in wording.
- As an agent reading a skill file, I want failure-handling instructions to appear
  exactly once (in the constitution, which I already inherit), so I am not asked to
  reconcile three slightly different restatements of the same rule.

## Acceptance Criteria

- **AC1** — Given `content/skill-design-auditor.md`, `content/skill-researcher.md`, and
  `content/skill-sr-engineer.md` each currently restate the const-05 "on crash/failure,
  still call `tw_update_state`" rule in their own wording, when this ticket ships, then
  none of the three files contains a restatement of that rule (the const-05 bullet is
  the sole source; the three skills rely on const-01's inherited-rules mandate).
- **AC2** — Given skill-architect.md, skill-pm.md, skill-design-auditor.md,
  skill-researcher.md, and skill-sr-engineer.md today each hand-author the byte-identical
  line `` 1. `tw_get_state` → `tw_detect_drift`. `` as their SOP step 1, when this ticket
  ships, then all five source that line from one canonical partial file, and
  `buildPromptForRole`'s composed output for each of the five roles is **byte-identical**
  to today's composed output (pure refactor of the *source*, zero change to what any
  role's dispatched prompt contains).
- **AC3** — Given the eight named limits (`qa_round`, `review_round`, `visual_round`,
  hop cap, fix-try cap, read cap, design-auditor pass budget, sr-engineer task-size
  budget), when this ticket ships, then `content/const-01-core-head.md` contains one
  **Limits** table (name | value | meaning) at the top of the document (before §1) that
  is the sole authoritative definition of each value.
- **AC4** — Given the Limits table exists, when body text in const-08, const-09,
  const-12, const-15, skill-qa-engineer.md, skill-code-reviewer.md,
  skill-design-auditor.md, skill-sr-engineer.md, skill-pm.md, skill-qa-visual.md, and
  skill-coordinator.md currently states one of the eight values as a bare number, then
  each is rewritten to reference the Limits-table name (e.g. "the `visual_round` cap")
  rather than independently restating the number — resolving, in particular, the
  const-09 ("cap is 5 rounds") vs skill-qa-visual.md ("round cap (6)") inconsistent
  framing of the identical `visual_round` limit into one consistent name + value pair.
- **AC5** — Given `test/context-budget.test.mjs` contains exact-value token caps (the
  ≤12247 teamwork bundle, the design-arm floor, skill-pm's ≤3196, skill-sr-engineer's
  ≤2469, and others) and `PM_RULE_MARKERS`/`SR_RULE_MARKERS` assertions that
  `fs.readFileSync` the raw `content/skill-{pm,sr-engineer}.md` files directly, when the
  Limits table and partial-composition changes land, then every affected exact-value cap
  is re-measured and re-baselined (qa-owned bump, per established repo convention), and
  any raw-file marker/token-count assertion that would no longer see composed text (due
  to the AC2 partial-token substitution) is updated to assert against the
  partial-composed output instead of the raw disk file.
- **AC6** — Given `test/compose-equivalence.test.mjs` golden fixtures
  (`test/fixtures/compose-golden/*.txt`) pin `composeConstitution()`'s byte-output,
  when const-01/08/09/12/15 change under AC3/AC4, then the golden fixtures are
  regenerated via `scripts/capture-constitution-golden.mjs` and the regenerated fixtures
  are reviewed (not blindly accepted) to confirm only the intended Limits-table /
  reference-by-name text changed.
- **AC7** — Given `test/subagent-templates.test.mjs` and
  `test/skill-evolution-v3.11.test.mjs` assert literal text/structure in
  `content/skill-*.md`, when this ticket's edits land, then both suites are swept and
  updated if any assertion collided with an edited line (expected: none, since neither
  suite currently references the step-1 preflight line or the eight limit numbers, but
  this must be confirmed, not assumed).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing copy; all edits are internal governance-doc prose consumed only by AI agents |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **`skill-code-reviewer.md`, `skill-qa-engineer.md`, `skill-doc-writer.md`,
  `skill-release-engineer.md`'s step-1 preflight lines** — these four files share the
  *prefix* `` `tw_get_state` → `tw_detect_drift`. `` but each appends a different
  role-specific confirmation clause on the same line (not a verbatim-repeated whole
  block). Partial-izing a same-line prefix-only fragment adds mechanism complexity
  (inline substitution, not whole-line) for four files, for the same-line-prefix
  benefit; MVP-strict cut per the ticket's own execution-order caveat ("lowest marginal
  benefit post-A9") — deferred to a follow-up ticket if drift is later observed there.
- **"Output-rule lines"** — on inspection, only the two-word heading `## Output rule` is
  actually shared verbatim across skills; the final-reply body text differs by design
  (each role has a distinct canonical reply string, e.g. `Done. Tasks in tasks.md.` vs
  `Done. Audit in design/<feature>.md.`). There is no repeated *content* block to
  extract — cut from this ticket's scope; the backlog's phrasing is treated as covered
  by the two blocks that survive scrutiny as truly verbatim (AC1, AC2).
- **Server-side enforcement values** — `tools/transitions.ts` and any other
  code that increments/compares `qa_round`/`review_round`/`visual_round`/hop-counter
  values is untouched. The Limits table documents existing behavior; it does not
  become a config file the server reads (no schema bump, no `docs/schema-versions.md`
  change).
- **A new runtime templating engine** — the partial-substitution mechanism (AC2) is a
  single non-recursive `{{PARTIAL:<token>}}` string replace, not a general template
  language. Partials referencing other partials is explicitly unsupported.

## Dependencies / Prerequisites

- Depends on A9 (compose-not-strip constitution manifest, DONE) — this ticket reuses the
  ordered-fragment-and-predicate pattern conceptually for the Limits table's placement
  (const-01 is always-included `core` tag) but does **not** need a new `SegmentTag` or
  manifest entry, since the Limits table is inserted into the existing
  const-01-core-head.md fragment rather than requiring conditional inclusion.
- **Test-surface budget** (researched by PM before this spec, not assumed): the
  heaviest-risk test file is `test/context-budget.test.mjs` — it contains ~10 exact-value
  token caps with a documented "qa-owned bump" convention (each prior cap change carries
  an inline comment recording old→new value and why) and, critically, two tests
  (`PM_RULE_MARKERS`, `SR_RULE_MARKERS` at lines ~440-490) that `fs.readFileSync` the raw
  `content/skill-pm.md` / `content/skill-sr-engineer.md` files directly rather than going
  through `buildPromptForRole`. AC2's partial-token substitution happens at
  `buildPromptForRole` time, so these two raw-file tests must be updated to check the
  partial-expanded text (see AC5) — this was independently confirmed in this session
  by reading the test file, not inferred from the ticket description.
- `test/compose-equivalence.test.mjs` locks `composeConstitution()`'s byte-output against
  committed golden fixtures (`test/fixtures/compose-golden/*.txt`) captured by
  `scripts/capture-constitution-golden.mjs` — any const-01/08/09/12/15 edit requires
  re-running that capture script and reviewing the diff (AC6).
- No `research/<topic>.md` or `design/<feature>.md` exists for this ticket (non-design,
  content-only feature) — Visual Structural Assertions section is correctly omitted per
  the PM spec schema's `no-design` exemption.
- Resource Audit Gate: docs/backlog.md §A12 (the sole external reference, a same-repo
  file) was read verbatim before drafting this spec; no `external_refs` ledger entry is
  required (same-repo doc, not an external artifact per Constitution §7).
