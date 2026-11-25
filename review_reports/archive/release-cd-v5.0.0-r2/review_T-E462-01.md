# Review — T-E462-01 (e462-stale-comments-wording)

covers: T-E462-01, T-E462-02, T-E462-03, T-E462-09, T-E462-04, T-E462-05, T-E462-06, T-E462-07, T-E462-08

## Round 1 — APPROVED — by code-reviewer

Diff judged: `git diff 83ca8c0...HEAD` (spec base `83ca8c0`; HEAD at review start `175953b`, plus this round's claim/checkpoint state commit `a471ac8`). qa commit a5e0ad3 (T-E462-01/02); sr commits d529cc7 (T-E462-03), 9dbf406 (T-E462-09), 53f32c6 (T-E462-04), 0c8bbd2 (T-E462-05), aa35472 (T-E462-06), 086cc9d (T-E462-07), a3b6402 / 175953b (T-E462-08). Inputs read: the diff, `specs/e462-stale-comments-wording.md`, the e462 row of `specs/fanout-pre-v5-w2.md` (via `fanout.mjs check`), backlog rows E462 and E461, `qa_reports/tests_e462-stale-comments-wording.md`, `qa_reports/expected-red_e462-stale-comments-wording.txt`. No architecture spec (none cut). Same-model note: sr-engineer and this judge are both opus-pinned; the independent checks below (transpile invariance, four mutations, full suite) do not depend on reading the builder's reasoning.

## Summary
- Comment-only sweep of stale old-chain wording in six files (`tools/transitions.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `schema/migrations-handoff.ts`, `gates/expected-red.ts`, `gates/registry.ts`) plus the expected-red comment in `tools/handoff-orchestrator.ts`; `transpileModule` (removeComments, ESNext) output byte-identical to base for all six.
- Small behaviour-neutral / message-only code changes: `resume_of` normalised once at handler entry (two ternaries removed); completion-evidence message names `resolveJudgeReport().dir`; new judge reports start `# Review — <id>`; an unknown design mode is reported as written (first word, case kept, ≤ 40 chars + `…`) with the `no-design` note in the two visual messages; arming unchanged.
- Text: `content/skill-spec-workshop.md` step 4 / step 5 sentences (sw.reopen, sw.done); `docs/migration-v5.md` gains mig.midline and mig.review_evidence.
- Tests: new `test/e462-stale-comments-wording.test.mjs` (29 tests, AC1–AC7) and five re-pinned files. Every changed path is in the e462 owned set (`fanout.mjs check`: 44 files, 0 out of bounds). `dist/` equals `npm run build` output.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — tools/transitions.ts:93,106,113,401; tools/registry.ts:358; tools/handoff-types.ts:160; schema/migrations-handoff.ts:202; gates/expected-red.ts:2-7,14,39; gates/registry.ts:301-306,572,595; tools/handoff-orchestrator.ts:1049-1054 (transpile invariance SAME ×6; kept lines intact; no `chain_path` in any changed line)
AC2 — implemented — tools/handoff-orchestrator.ts:1233-1238 (normalisation), :239 and :1443 (consumers read `parsed.resume_of`)
AC3 — implemented — tools/handoff-orchestrator.ts:736,767 (`resolveJudgeReport().dir`); gates/qa-review.ts:169 (`# Review — ${id}`); `EVIDENCE_SCHEMA_CURRENT` = 3
AC4 — implemented — gates/visual.ts:121-138 (`declaredWord`, exported `unknownDesignModeNote`), :169 (first-unknown value); tools/handoff-orchestrator.ts:868,934 (note wired after `is absent. ` / `Assertions is absent. `)
AC5 — implemented — test/e462-stale-comments-wording.test.mjs:648-666; both E461 (3) mutations re-run on this build (red under mutation, green on restore)
AC6 — implemented — content/skill-spec-workshop.md:20 (sw.reopen), :21 (sw.done); no other line moved; no backtick error code gained or lost
AC7 — implemented — docs/migration-v5.md:32-34 (mig.midline bullet), :100-101 (mig.review_evidence after mig.sqlite_checks); only additions
AC8 — implemented — full suite green (see judge report), gate count 33, pipeline 17, no golden or context-budget change

## Correctness
No required findings.
- **AC2** (`tools/handoff-orchestrator.ts:1233-1238`): the `if` normalises any non-`"code-reviewer"` value to `undefined` before every gate; the only consumers of `parsed.resume_of` in the handler are `validateTransition`'s `next_resume_of` (:239) and the write option `resumeOf` (:1443). `tools/transitions.ts:605-616` prints `absent` for `undefined`, so a direct no-zod call with `"qa-engineer"` / `"sr-engineer"` / `""` reads exactly as an absent field — same as the base ternaries. No other reader of the raw value exists in `tools/`, `gates/` or `lib/` (grep).
- **AC4** (`gates/visual.ts:126-130,169`): the known/prefix decision still uses the lowercased `declared` token; only the remembered first-unknown value comes from `declaredWord(raw)`. `declaredWord` strips the same leading wrapper class as the token regex, and the token branch is entered only when the first stripped character is a letter, so the reported word is never empty and `hasDesignModeRequiringVisual`'s `mode !== null && mode !== "no-design"` arms exactly as before. A known mode is always returned lowercased from the earlier branches, so `unknownDesignModeNote` (`KNOWN_MODES.includes`) never fires for one. `checkSourceCredibility` only tests membership in `FETCH_BASED_MODES`, which an unknown value can never hit.
- **AC3**: readers key on the `## <ISO> — PASS|FAIL — by <signer>` heading; the H1 is written only by `gates/qa-review.ts:169`. The old-heading fixture test credits the id through the PASS predicate, drift evidence, lane-status and a real PASS write, and a later append adds no second `#` line.
- **Tests**: every scenario has a test on the public interface (dist exports / `handleUpdateState`) whose assertion fails when the behaviour breaks — confirmed by negative controls in a scratch copy: removing `prototype` from `KNOWN_MODES` reds AC5 tests 1–2; last-unknown-wins reds AC5 tests 3–4; disabling the `resume_of` normalisation reds the two AC2 behaviour tests; making `unknownDesignModeNote` always return `""` reds the two AC4 message tests. All green after restore. sr-engineer edited no test file (only a5e0ad3 touches `test/`). Re-pins keep intent (heading regexes / sentence pins moved to the Copy rows; old-heading fixtures untouched). Line coverage is not measured by the repo tooling for this change.

## Quality
- `recommended` — `gates/expected-red.ts:1-8`: re-wrapping the header put `only.` on its own line, growing the block from 7 to 8 lines and adding a new `agc check — comments` long-block warning (base: none for this file). Kept: the text is accurate and the warning is advisory; joining `File mode only.` back onto line 6 would clear it.
- `optional` — `tools/handoff-orchestrator.ts:737-739`: the gate comment still says "QA completion-evidence gate … per-id QA evidence"; and `gates/visual.ts:862` still names the build entry "pm to architect or sr-engineer hop". Both stale old-chain wording outside the spec's listed lines; comment-only, not filed.
- Other `agc check — comments` warnings on touched files are pre-existing at base (`gates/visual.ts` high-ratio 30.6% → 31% and :101 block, transitions.ts :398/:501, handoff-types / migrations-handoff ratios, orchestrator blocks); `gates/registry.ts:301` warning removed by this diff. New comments (`declaredWord`, `unknownDesignModeNote`, the normalisation) state WHAT/WHY in ≤ 5 lines and cite no ticket id.

## Architecture
No architecture spec for this feature. The note helper lives with the parser in `gates/visual.ts` and is a pure function; the orchestrator only concatenates it. Layering unchanged; gate registry 33, pipeline 17.

## Security
No findings. The reported unknown-mode value is bounded (first word, ≤ 40 chars + `…`) and stops at whitespace, backticks, quotes, brackets and `<`/`>`, so markup after the word does not reach the error text (tested with `<script>`). `optional`: the 40-unit cut can split a UTF-16 surrogate pair; cosmetic only. No secrets, no new trust boundary; `npm audit --audit-level=high` exit 0. Information hygiene: no absolute home paths, names or URLs added to tracked files.

## Performance
No findings. `declaredWord` runs two anchored regexes on one line only when a first unknown token is remembered; `unknownDesignModeNote` is a 9-element `includes` on a rejection path. No hot-path change.

## Verdict
APPROVED — every AC is implemented and independently verified (transpile invariance, mutations, full suite), with no required finding.
