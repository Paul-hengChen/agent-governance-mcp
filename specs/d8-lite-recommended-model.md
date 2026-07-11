# d8-lite-recommended-model

## Problem Statement

`content/skill-coordinator-lite.md` frontmatter declares `recommended_model: haiku`
for the solo-dev lite dispatch mode. Haiku's §1 (watermark) compliance is
documented-poor elsewhere in this same codebase — it is the stated reason the
full coordinator's `validateWatermark` step exists at all (`content/skill-coordinator.md`
line 172: "Haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`)
sometimes omit the `— @<name> (<tier>)` suffix ... even with `CRITICAL:`
template reminders"). For those three roles when Task-dispatched as subagents,
the parent coordinator's `validateWatermark` step corrects the omission before
the reply reaches the human — a validating parent exists.

Lite invoked directly (`/teamwork-lite`, or the SessionStart-hook default
`AGC_DEFAULT_SKILL=lite` path) has **no such parent**: it is server-read-only
by design, with no `agent_id` in the routing chain (`tools/transitions.ts`),
and its reply goes straight to the human. `recommended_model: haiku` on this
surface recommends the one tier whose §1 compliance is known-weak, on the one
dispatch path with no corrective layer.

Backlog D8 (`docs/backlog.md` §D8) frames the fix as a choice between (a)
trimming the lite bundle further until haiku reliably complies, measured via
the D4 behavioral-eval harness, or (b) bumping the recommendation to sonnet
and accepting the cost, deciding directly if D4 data is unavailable. The D4
harness (`npm run eval`, shipped v3.67.0) exists and includes a scripted
`lite-haiku-task-completion` scenario built for exactly this question, but its
live smoke run against a real model was deferred (T-D4-09: no
`ANTHROPIC_API_KEY` available in this environment) — no live pass/fail
evidence on the *current*, already-heavily-trimmed lite bundle exists to
justify trusting haiku here.

## Decision (recorded per backlog's "decide directly" instruction)

**Option (b): bump `recommended_model` to `sonnet`.** Rationale:

1. **No corrective layer exists on this surface.** Unlike `@lite` (Task-subagent
   dispatch, pinned via `templates/claude-code-agents/lite.md`, watched by the
   coordinator's `validateWatermark`), direct/session-invoked lite has zero
   downstream check. A format-compliance failure here is not cosmetic-and-caught,
   it is cosmetic-and-shipped.
2. **The bundle is already near its practical trim floor.** Per
   `scripts/measure-context-cost.mjs`, `skill-coordinator-lite.md` is already
   the smallest role skill in the corpus (929 ~tok) after four rounds of
   token-reduction work (A6/A7/A9/A12); the lean always-on bundle is
   capped at an exact-measured 4027 ~tok ceiling with the documented Phase-2
   convention of *no* additional headroom. There is little further trimming
   room to "reliably fix" haiku compliance through bundle size alone, and no
   live data demonstrating that a smaller bundle would even move the needle
   (the compliance gap is model-attention behavior, not proven to be a
   function of bundle length).
3. **No counter-evidence exists.** Absent a live D4 run on this bundle, the
   only evidence in the codebase is negative (the coordinator's own
   watermark-validation step was built *because* haiku silently drops the
   suffix). Deciding to keep haiku on the one unchecked surface would be
   deciding against the only evidence available.
4. **The fix is cheap and reversible.** P3, content-only, ~2 files. If a
   future live D4 run (once an API key is available) shows haiku reliably
   complies on this bundle, the recommendation can be reverted in the same
   small blast radius.

**Scope note — what this decision does NOT touch:** the `@lite` Task-subagent
dispatch mechanism (`templates/claude-code-agents/lite.md`, `model: haiku`
frontmatter) is a *different* mechanism from the `recommended_model` hint this
spec changes, and it already has a validating parent (the full coordinator's
`validateWatermark` step, `content/skill-coordinator.md` §Subagent Reply
Watermark Validation, which explicitly lists `@lite` among the roles it
watches). The defect this spec fixes — "no validating parent" — does not
apply to that path, so it is left unchanged. Changing it would also require
updating `test/subagent-templates.test.mjs`'s `HAIKU_ROLES` fixture,
`content/skill-coordinator.md`'s watched-role list, and `docs/skills/doc-writer.md`
cross-references — well beyond backlog D8's own ~2-file estimate and beyond
the specific defect identified. See Out of Scope. (See Amendment below for
how this note's rationale interacts with a *different*, pre-existing test
the original analysis did not check.)

### Amendment (2026-07-11, post QA-FAIL Round 1)

QA's independent Phase 4 run (`qa_reports/review_T-D8-02.md`) surfaced a
regression this spec's Out-of-Scope analysis did not anticipate:
`test/subagent-templates.test.mjs:147`'s pre-existing `ROLE_TO_SKILL`
tier-consistency guard asserts, for every role, that
`templates/claude-code-agents/<role>.md`'s `model:` frontmatter equals
`content/skill-<role>.md`'s `recommended_model:` frontmatter, verbatim. This
spec's AC1 change (bumping the `lite` skill's `recommended_model` to `sonnet`
while deliberately leaving `templates/claude-code-agents/lite.md`'s
`model: haiku` pin untouched, per the Scope note above) breaks that guard for
the `lite` row — a *different* test than the `HAIKU_ROLES` fixture the Scope
note above correctly identified and left alone; neither this spec's
Out-of-Scope section nor `review_reports/review_T-D8-01.md`'s static diff
review caught it, because it only fails once the full suite actually
executes.

**Reconciliation decision: keep the divergence (do not bump the template),
and encode `lite` as a documented, dated exemption in the test.** Two options
were weighed:

- **(a) Bump `templates/claude-code-agents/lite.md`'s `model:` to `sonnet`
  too**, restoring the mirror invariant by making both surfaces agree.
  Rejected: this abandons the Scope note's own rationale mid-amendment. The
  `@lite` Task-subagent already has a validating parent — the full
  coordinator's `validateWatermark` step (`content/skill-coordinator.md`
  §Subagent Reply Watermark Validation explicitly lists `@lite` among the
  roles it watches) — which is precisely the corrective layer this spec's
  Decision section (point 1, above) identifies as *absent* on the
  direct/session surface this spec actually fixes. Bumping the template tier
  buys no additional §1-compliance safety on a surface that already
  self-corrects; it only raises the per-dispatch cost of the more
  frequently-invoked `@lite` Task-subagent path, and would require a fresh
  pm→sr-engineer build hop (re-arming the Cut-Approval Gate a second time) to
  satisfy a test assumption rather than fix a real defect.
- **(b) Keep the deliberate divergence; teach the test the exemption.**
  Chosen. The `ROLE_TO_SKILL` mirror test was written under the assumption
  that a role's Task-subagent tier and its session/direct-invocation
  recommended tier are always the same value — true for every role until this
  spec. This spec is the first legitimate case where the two surfaces'
  risk profiles genuinely diverge (one has a corrective layer, one doesn't),
  so it is the test's assumption, not this spec's decision, that needs to
  catch up. `test/subagent-templates.test.mjs` already carries this exact
  pattern twice — `HAIKU_ROLES` (a fixed per-role list gating a different
  assertion) and `FILE_PATH_DELEGATES` (a per-role exemption map with an
  inline rationale comment) — so adding a third, narrowly-scoped exemption
  for the mirror assertion is consistent with the file's own conventions, not
  a new one. This is a **test-logic change**, owned by qa-engineer per
  Constitution §2 (sr-engineer may not edit tests; the template file itself
  remains this spec's own Out-of-Scope, untouched). See amended AC6, new AC8,
  and task T-D8-03.

This amendment does not reopen AC1-AC5's substance — the frontmatter bump
itself is independently re-verified PASS in `qa_reports/review_T-D8-02.md`.
It revises AC6 (the touched-files fence) to admit
`test/subagent-templates.test.mjs` as a third in-scope file (narrowly
scoped), adds AC8 (the exemption contract), and cuts T-D8-03 (qa-engineer)
to implement and verify it.

## User Stories

- As a solo developer running `/teamwork-lite` (or a session defaulted into
  lite mode via the SessionStart hook), I want the recommended model to be one
  with reliable §1 (watermark) compliance, so that my replies aren't silently
  missing required format elements with nobody to catch it.
- As a maintainer revisiting this decision later, I want the rationale and the
  cost tradeoff recorded in-repo, so that a future D4 live-eval run can either
  confirm this was the right call or justify reverting to haiku with evidence.

## Acceptance Criteria

- **AC1** — Given `content/skill-coordinator-lite.md`'s YAML frontmatter,
  when read after this change, then `recommended_model: sonnet` (was `haiku`);
  no other line in the file's frontmatter or body changes.
- **AC2** — Given `docs/skills/coordinator-lite.md` (the doc mirror whose own
  header states "Source of truth: `content/skill-coordinator-lite.md`"), when
  read after this change, then its "**Recommended model (frontmatter):**"
  line reads `sonnet`, matching AC1.
- **AC3** — Given `test/context-budget.test.mjs`'s AC2 lean-bundle test
  (`assert.ok(lean <= 4027, ...)`, the exact-measured-value cap per that
  file's own documented convention), when `npm test` runs after this change,
  then the assertion still passes with no numeric edit required. (PM
  pre-verified empirically: current lite skill file is 3714 chars including
  `recommended_model: haiku`; swapping to `recommended_model: sonnet` adds
  exactly 1 char [3715 total], and the lean-bundle total moves from 16105 to
  16106 chars — `ceil(16106/4) = 4027`, unchanged. QA re-verifies
  independently per the file's "never trust the prior agent's number"
  convention rather than trusting this note.)
- **AC4** — Given `test/skill-frontmatter.test.mjs`'s regression guard
  ("every content/skill-*.md carries a valid recommended_model frontmatter"),
  when run after this change, then it still passes (`sonnet` is already a
  member of `MODEL_TIERS`).
- **AC5** — Given the full test suite, `npm run build`, and
  `npm audit --audit-level=high`, when run after this change, then all are
  clean/green with zero unrelated regressions.
- **AC6** (amended, Round-1 reconciliation) — Given `git diff` against the
  pre-change tree, when reviewed, then it touches ONLY
  `content/skill-coordinator-lite.md`, `docs/skills/coordinator-lite.md`, and
  `test/subagent-templates.test.mjs` (plus, only if AC3's empirical
  pre-verification turns out wrong on a live re-measure, the minimal numeric
  cap edit in `test/context-budget.test.mjs` with a dated comment entry
  following that file's existing convention). The
  `test/subagent-templates.test.mjs` edit MUST be scoped to exactly one
  narrowly-targeted change — adding a documented, dated exemption for the
  `lite` role to the AC1-contract tier-mirror test (line ~147) per AC8 — no
  other line in that file changes. In particular, confirm
  `templates/claude-code-agents/lite.md`, `content/skill-coordinator.md`,
  `docs/architecture.md`, and `test/eval/scenarios.mjs` are byte-identical to
  their pre-change state (see Out of Scope for why each is excluded);
  `test/subagent-templates.test.mjs` is no longer in that byte-identical set
  as of this amendment — see AC8.
- **AC7** — Given `node scripts/measure-context-cost.mjs`, when run after this
  change, then it executes cleanly (reporting-only script, no assertions) and
  QA captures its output as evidence in the QA report.
- **AC8** (added, Round-1 reconciliation) — Given
  `test/subagent-templates.test.mjs`'s `"AC1 contract: each template tier
  mirrors content/skill-*.md recommended_model"` test (line ~147), when read
  after this amendment's fix, then: (a) it defines an explicit,
  narrowly-scoped exemption for the `lite` role only (e.g. a
  `MIRROR_EXEMPT_ROLES` map or equivalent, following the file's existing
  `HAIKU_ROLES`/`FILE_PATH_DELEGATES` per-role-exception convention) with an
  inline, dated comment recording the rationale (pointing back to this
  spec's Amendment subsection); (b) the assertion still runs, and still
  fails on a real mismatch, for all 11 non-exempt roles — the exemption
  narrows the test's scope by exactly one row, it does not weaken or remove
  the invariant for anyone else; (c) `npm test` (full suite) passes
  1107/1107 with zero other regressions; (d) `npm run build` and
  `npm audit --audit-level=high` remain clean.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| lite.recommended_model | `sonnet` | authored-here — decision value recorded in this spec's Decision section, not a canonical external source; replaces the prior `haiku` value in the same frontmatter field |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **`templates/claude-code-agents/lite.md`'s `model: haiku` frontmatter** (the
  `@lite` Task-subagent dispatch pin) remains unchanged — different mechanism,
  already has a validating parent (coordinator `validateWatermark`, per
  `content/skill-coordinator.md` §Subagent Reply Watermark Validation).
  Changing the pin itself is a materially larger, differently-motivated
  change (would also require edits to `test/subagent-templates.test.mjs`'s
  `HAIKU_ROLES` array, the coordinator's watched-role prose, and
  `docs/skills/doc-writer.md` cross-references) and is not the defect
  backlog D8 names. **Amended (Round 1):** a *different*, pre-existing test
  in that same file — the `ROLE_TO_SKILL` tier-mirror guard — asserts this
  pin must equal `content/skill-coordinator-lite.md`'s `recommended_model`,
  which this spec's AC1 now breaks for the `lite` row; reconciling that one
  assertion (a narrow, dated exemption, NOT touching `HAIKU_ROLES` or the
  pin itself) is in-scope as of this amendment — see the Amendment
  subsection above and AC8/T-D8-03.
- **`docs/architecture.md` line 177** (the `/teamwork` vs `/teamwork-lite`
  dispatch-surface table) — its "pinned Haiku" cell describes the `@lite`
  Task-subagent mechanism above, unchanged by this spec; its "session model"
  cell (for direct `/teamwork-lite`) was already model-agnostic prose. No
  edit needed.
- **`test/eval/scenarios.mjs`'s `lite-haiku-task-completion` D4 scenario** —
  remains valid coverage for the still-supported case of a human manually
  overriding lite to haiku for cost savings. Not required to change; a future
  live D4 run against this exact scenario is how this decision gets
  empirically revisited.
- **Trimming the lite bundle further** (backlog's option (a)) — rejected per
  the Decision section: the bundle is already at the corpus floor with no
  live data showing size reduction would fix the compliance gap.
- **Re-running the D4 harness live** — out of scope for this ticket; no
  `ANTHROPIC_API_KEY` is available in this environment (per T-D4-09). The
  decision is made on documented evidence per backlog D8's own fallback
  instruction.

## Dependencies / Prerequisites

- Depends on the D4 behavioral-eval harness existing (`npm run eval`, shipped
  v3.67.0) as the mechanism a future live re-evaluation would use, but does
  NOT depend on a live run completing — backlog D8 explicitly authorizes
  deciding on documented evidence when D4 live data is unavailable (this
  environment has no `ANTHROPIC_API_KEY`, per T-D4-09's note).
- No external references (URLs, Figma, tickets) found in the backlog D8 entry
  or this spec's own inputs — Resource Audit Gate is a no-op (zero hits,
  `external_refs` omitted).
- No design file exists for this feature (`design/d8-lite-recommended-model.md`
  absent) — Scope Decision Gate is not triggered; `scope_decision:
  "single-feature"` is recorded on the routing write per the assignment's
  explicit instruction, not because the gate fired.
- **Amendment note (2026-07-11):** this spec was amended mid-chain after a
  QA-FAIL (`qa_reports/review_T-D8-02.md`) surfaced a pre-existing test
  (`test/subagent-templates.test.mjs:147`) this spec's original Out-of-Scope
  analysis did not account for. See the Decision section's Amendment
  subsection for the reconciliation and AC8 for the new exemption contract.
  New task T-D8-03 (qa-engineer, test-logic change per Constitution §2)
  implements and verifies it; `T-D8-REL`'s dependency moves from `T-D8-02`
  to `T-D8-03` accordingly.
