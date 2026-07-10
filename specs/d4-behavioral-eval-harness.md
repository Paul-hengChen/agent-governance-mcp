# d4-behavioral-eval-harness

## Problem Statement
All 1067+ existing tests are structural — marker greps, error-code contracts,
compose golden baselines, parser round-trips. None of them verify that a real
model, handed an assembled role bundle (constitution + skill + state), actually
*behaves* per the bundle's rules. Known haiku watermark omissions (already
patched downstream by the coordinator's `validateWatermark`) prove behavioral
drift is real; nothing today would catch a regression introduced when a skill
is rewritten for token savings (the A6/A7-class consolidation rewrites) before
it reaches a live session.

## User Stories
- As a maintainer rewriting a skill file for token savings, I want an on-demand
  harness that dispatches a small set of scripted scenarios to a real model and
  checks output invariants, so that I catch behavior regressions before release
  instead of after a live session misbehaves.
- As a release-engineer, I want a single `npm run eval` command to run before
  cutting a release, so that I have one signal for "did this rewrite change
  model behavior" without paying API cost on every commit.
- As a qa-engineer, I want the invariant-checking logic itself unit-tested with
  zero API cost, so that I trust the harness's verdicts before spending money
  running it against a live model.

## Acceptance Criteria
- **AC-1 (assertions are pure, zero-cost)** — Given `test/eval/assertions.mjs`,
  when its four checker functions (`checkWatermark`, `checkTerseCap`,
  `checkEscalationShape`, `checkBannedPhrases`) are invoked, then none of them
  perform any I/O or network call — they take a reply string (plus checker
  args) and return a pass/fail verdict + reason, synchronously.
- **AC-2 (watermark checker reuses the canonical regex)** — Given a reply
  string, when `checkWatermark(reply, name, tier)` runs, then it reuses
  `WATERMARK_REGEX` / `buildWatermark` from `dist/lib/watermark-check.js`
  rather than re-implementing detection — the eval harness and the
  coordinator's live post-validation MUST never disagree on what counts as a
  present/absent watermark.
- **AC-3 (terse-cap checker honors §1 exemptions)** — Given a reply string,
  when `checkTerseCap(reply)` runs, then it fails only replies over 15 words
  that are NOT a structured artifact (a markdown table), a blocker/escalation
  statement, an assumption-gap flag, or an acceptance-criteria statement —
  mirroring the exact carve-out in `content/const-01-core-head.md` §1.
- **AC-4 (escalation-shape checker matches the canonical call)** — Given a
  reply string that contains an escalation, when `checkEscalationShape(reply)`
  runs, then it passes only when the reply names the canonical shape
  `tw_update_state(status=<Blocked|FAIL>, agent_id=<role>, next_role=<role>,
  pending_notes=["<Role>: <situation> — <detail>"])` per
  `content/const-05-core-standards.md` §3 (Escalation call format) — field
  order flexible, but all four keys (`status`, `agent_id`, `next_role`,
  `pending_notes`) must be present and `status` must be `Blocked` or `FAIL`.
- **AC-5 (banned-phrase checker matches the canonical list)** — Given a reply
  string, when `checkBannedPhrases(reply)` runs, then it fails on any of
  `好的`, `讓我為您`, `現在`, `我將` (verbatim from `content/const-01-core-head.md`
  §1 NO YAPPING) appearing anywhere in the text.
- **AC-6 (assertions are self-tested before trusted)** — Given
  `test/eval-assertions.test.mjs` (matches the existing `test/*.test.mjs` glob,
  runs inside plain `npm test`, zero API cost), when the suite runs, then each
  of the four checkers is exercised against at least one hand-written
  compliant fixture (expected pass) and one hand-written violating fixture
  (expected fail) — proving the checkers themselves catch what they claim to
  catch, before the live runner ever trusts their verdicts.
- **AC-7 (scenario set covers 5–10 roles/situations)** — Given
  `test/eval/scenarios.mjs`, when the file is loaded, then it exports an array
  of 5–10 scenario objects, each with `{ id, role, tier, task, assertions }`,
  covering at minimum: sr-engineer task completion, qa-engineer PASS reply, pm
  ambiguity→Blocked escalation, code-reviewer CHANGES_REQUESTED escalation,
  and one lite/haiku-tier scenario (the class of role known for watermark
  omission).
- **AC-8 (runner builds the same bundle a real dispatch would receive)** —
  Given a scenario naming a role, when the runner resolves its system prompt,
  then it calls `buildPromptForRole` (via the `test/eval/lib/bundle.mjs`
  loader, importing the compiled `dist/prompts/build.js`) against a fixed
  fixture workspace under `test/eval/fixtures/workspace/` — NOT this repo's
  live `.current/handoff.md` — so scenario bundles are reproducible run to run
  regardless of this repo's own in-flight feature state.
- **AC-9 (live run is on-demand, never per-commit)** — Given `package.json`,
  when the scripts are inspected, then a new `"eval"` script invokes
  `node test/eval/run-eval.mjs`, and neither `"test"` nor `"pretest"` invoke it
  — running `npm test` never calls the live model API or costs money.
- **AC-10 (runner reports a clear pass/fail summary + exit code)** — Given
  `test/eval/run-eval.mjs` run against a live `ANTHROPIC_API_KEY`, when all
  scenarios complete, then it prints one PASS/FAIL line per scenario plus a
  summary count, and exits non-zero iff any scenario failed (so it composes
  into a pre-release gate check).
- **AC-11 (fail-fast on missing API key)** — Given `ANTHROPIC_API_KEY` is
  unset, when `npm run eval` is invoked, then the runner exits non-zero
  immediately with a one-line error naming the missing env var — it does not
  attempt a network call and does not silently skip scenarios.
- **AC-12 (harness never mutates governance state)** — Given a full
  `npm run eval` run, when it completes, then no file under `.current/`,
  `tasks.md`, or any `tw_*` tool has been called or written — the harness is
  read-only with respect to this repo's own governance state (it only reads
  the fixture workspace for bundle assembly).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | — | feature has no user-facing strings (internal dev-tooling harness) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (non-visual, server-internal) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Wiring the eval harness into CI / pre-commit (backlog explicitly scopes this
  to on-demand / pre-release only — "costs API calls").
- Any change to `tools/handoff-orchestrator.ts`, `content/skill-coordinator.md`,
  or handoff schema files (`schema/migrations-handoff.ts`, `tools/handoff.ts`
  schema shape) — reserved for the concurrently-in-flight D2 ticket; kept
  disjoint by design.
- Retrying/backoff logic for API transient failures, cost/token-budget
  tracking for the harness's own API usage, or a mocked/offline replay mode
  for the *live* runner (AC-6's zero-cost self-test of the assertion functions
  covers the "catch a broken checker cheaply" need; the live runner itself is
  intentionally simple).
- Actually rewriting any skill file (A6/A7) — this ticket builds the
  regression-detection tool those future rewrites will run against; it does
  not perform the rewrites.
- Backlog D8 (lite recommended-model-vs-haiku-compliance measurement) —
  explicitly named in the backlog as a *future consumer* of this harness's
  output ("measure via D4 harness"), not a dependency of building it.

## Dependencies / Prerequisites
- New devDependency: `@anthropic-ai/sdk` (harness-only; not a runtime
  dependency of the shipped MCP server — the harness is a dev/pre-release
  tool, never loaded by `index.ts` or `dist/index.js`).
- Requires `ANTHROPIC_API_KEY` in the environment to run the live harness
  (`npm run eval`); absent for the zero-cost self-test (`npm test`).
- **File-disjointness with concurrent D2** (server-side accounting, hop
  counter + token brake): D2 touches `tools/handoff-orchestrator.ts`,
  `content/skill-coordinator.md`, and config files. D4's file set (new
  `test/eval/` tree, `test/eval-assertions.test.mjs`, `package.json`
  script/devDependency addition) is disjoint by construction — no task below
  is scoped to touch any D2 file.
- **Resource Audit** (constitution §7): the backlog ticket text names two
  internal backlog cross-references — D8 (lite/haiku compliance measurement)
  and the A6/A7 skill-consolidation rewrites — as motivating context, not as
  fetchable/indexable external resources (no URL, no Figma node, no ticket-
  system link). Classified `ignore` / recorded `user-confirmed-ignorable` on
  the routing state write; see Out of Scope above for how each is actually
  related.
- No `design/<feature>.md` exists for this feature (non-visual, server-
  internal tooling) — Visual State-Count Split, Geometric-Density Split, and
  Scope Decision gates do not arm; recording `scope_decision: "single-feature"`
  on the routing write per SOP for clarity, matching the d3-gate-fire-telemetry
  precedent.
