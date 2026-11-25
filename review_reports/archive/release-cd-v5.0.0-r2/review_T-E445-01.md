# Review — T-E445-01 (feature e445-spec-workshop-questioning, test-first chain)

covers: T-E445-01, T-E445-02, T-E445-03, T-E445-04

## Round 1 — APPROVED — by code-reviewer

## Summary
- SOP text only: `content/skill-spec-workshop.md` steps 2, 3, 4 and 5 gain the eleven Copy / Strings sentences (four lines changed, no line added or removed); step headings, step count, frontmatter, Purpose, step 1, step 6, Short form, Outputs and Governance state are byte-identical to base `b3ac374`.
- Tests: new `test/e445-spec-workshop-questioning.test.mjs` (11 tests, AC1–AC10, AC10 split in two); `test/context-budget.test.mjs` AC21 cap 1092 → 1415 (AC21 block only, measured value, zero headroom).
- Ticket points (1)–(8) of the backlog row are each present at the step the ticket names, with the intended meaning (see AC Completeness).
- Judge checks: frozen `BASE_SOP` literal byte-identical to `git show b3ac374:content/skill-spec-workshop.md`; AC21 re-measured independently (base 1092, HEAD 1415, +323); 13 mutation negative controls all turned the test file red; `fanout.mjs check --cut` 0 out of bounds.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — six headings in the composed prompt; `## Steps` span holds six `^\d\. \*\*` lines; Short form byte-identical (content/skill-spec-workshop.md:13-24)
AC2 — implemented — step 4 opens `at most 4 questions per batch.` then sw.batch_ready (ticket point 1) (content/skill-spec-workshop.md:20)
AC3 — implemented — sw.format (replaces the base `each with your recommendation …` clause; parenthesis kept verbatim) and sw.by_number (ticket point 4) (content/skill-spec-workshop.md:20)
AC4 — implemented — sw.yes, straight double quotes (ticket point 2) (content/skill-spec-workshop.md:20)
AC5 — implemented — base ruling sentence verbatim, sw.reopen directly after as a separate sentence (ticket point 8) (content/skill-spec-workshop.md:20)
AC6 — implemented — sw.prototype then sw.prototype_end as the last sentence of step 4 (ticket point 6) (content/skill-spec-workshop.md:20)
AC7 — implemented — step 2 base text verbatim, sw.lookup appended (ticket point 3) (content/skill-spec-workshop.md:18)
AC8 — implemented — step 3 base text verbatim, sw.facts appended (ticket point 5) (content/skill-spec-workshop.md:19)
AC9 — implemented — three base sentences verbatim in base order, sw.pushback appended; done-condition sentence unchanged (ticket point 7) (content/skill-spec-workshop.md:21)
AC10 — implemented — everything outside steps 2–5 byte-identical to base; added lines carry no new step, write-tool name, ticket id, repo-only path, `Task` alias or backticked gate code
AC11 — implemented — test/context-budget.test.mjs:500-514, cap = measured 1415 (judge re-measured: 1415), one re-baseline comment line naming +323; no other cap moved
AC12 — implemented — full suite green (see judge report), goldens / dist / CLAUDE.md diff empty, CLAUDE.md 250 lines, `agc check` exit 0, `npm audit --audit-level=high` exit 0

## Correctness
No findings.

Tests (step 4 review): one test per AC on the public artefacts (the shipped SOP file and the composed prompt from `buildPromptForRole`). Assertions are verbatim includes plus order / adjacency / end-of-step checks, so they fail on a wrong edit. Negative controls run by the judge on a scratch copy outside the worktree (test file + mutated SOP, `dist/` linked):
- base SOP → AC2–AC9 and AC10 (added lines) red;
- batch cap clause not ending its sentence → AC2, AC3 red;
- reopen / prototype sentences swapped → AC5, AC6 red;
- curly quotes around yes → AC4 red;
- reminder moved from step 5 into step 4 → AC6, AC9, AC10 red;
- a seventh numbered step → AC1, AC9, AC10 red;
- ticket id / write-tool name / `Task` alias / repo-only path / backticked gate code added to a step line → AC10 (added lines) red (plus the verbatim AC for that step);
- trailing space added in Outputs → AC10 (unchanged sections) red;
- facts sentence moved from step 3 to step 2 → AC8, AC10 red;
- done-condition sentence reworded → AC9 red.
Identity copy → all green. The frozen `BASE_SOP` literal equals the base file byte for byte (4398 chars), so the base comparisons are sound.

qa's AC10 reading (a changed step line may open with its own base heading; any other numbered opener fails; dispatch-view numbered-line count equal to base) matches the spec's stated intent and the integrator's acceptance; the "a seventh step" control shows it still catches a new step.

Coverage: no line-coverage tooling applies to Markdown SOP text; every Copy / Strings row is pinned verbatim.

## Quality
Copy audit (5a): all eleven Copy / Strings rows present verbatim at the placement and in the step-4 order the spec gives (`sw.batch_cap` `sw.batch_ready` `sw.format` `sw.yes` `sw.by_number`, operator sentence, ruling sentence, `sw.reopen` `sw.prototype` `sw.prototype_end`). No user-facing string outside the table was added.

Comment check (5d), two `agc check — comments` advisories touching the diff, both kept:
- `test/context-budget.test.mjs` high-ratio (40.8%): file-wide and pre-existing; this diff adds only the one re-baseline comment line AC11 requires (the file's cap-history convention).
- `test/e445-spec-workshop-questioning.test.mjs:1` long-block 8 lines (limit 7): the header holds the repo's `Coded by` authorship line plus a load-bearing re-pin notice for the frozen base text; one line over the advisory limit — `optional` trim, not blocking.

`optional`: the test header (lines 3, 8) names the ticket id and a `specs/` path — fine for a repo-only test file, noted only because the SOP itself must not.

## Architecture
No architecture spec (pure SOP text, no architect by ruling). No tool, prompt, registry, gate, schema, template or `dist/` change. Scope: `git diff b3ac374...HEAD --name-only` touches only owned files; `node scripts/fanout.mjs check --cut specs/fanout-v5-w6.md e445 specs/e445-spec-workshop-questioning.md` → 0 out of bounds, exit 0. `test/e423-spec-workshop.test.mjs` untouched and green (AC6, AC9, AC10, AC11 there pass). The 12 compose goldens unchanged.

## Security
No findings. Agent-facing text plus tests; no input boundary, no secret, no command built from input. The SOP's Governance state prohibition (no write tools) is unchanged and no added sentence names a write tool.

## Performance
No findings. The SOP body grows by 323 ~tok per `spec-workshop` invocation (prompt-only, human-started role), captured by the AC21 cap at zero headroom; no other composition carries this SOP.

## Verdict
APPROVED — every ticket point (1)–(8) is in the SOP at the named step, verbatim to Copy / Strings; the tests check every AC and fail on wrong edits (13 mutation controls); everything else in the file and repo scope is unchanged.
