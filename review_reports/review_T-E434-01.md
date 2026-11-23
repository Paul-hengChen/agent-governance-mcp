# Review — T-E434-01 (feature e434-reviewer-visual, test-first chain)

covers: T-E434-01, T-E434-02, T-E434-03, T-E434-04, T-E434-05, T-E434-06, T-E434-07, T-E434-08

## Round 1 — APPROVED — by code-reviewer

## Summary
- Renames the visual sub-skill and its subagent template from `qa-visual` to `reviewer-visual` (both opus), loaded by code-reviewer step 6a only when `design/<feature>.md` declares `## Visual Baselines`; qa SOP step 4g makes capture and pixel diff qa-written executable checks; sr's whole-surface loop runs those checks with the pixel-progress rule.
- Retires the served rule text of the visual counter and split threshold (const-01 Limits rows and example, const-05 note token, const-09 rewritten as `const09.body`, const-13 S3 sentence, rationale 63 / 135 / 142–151 / 204–206, sr split row); §3.2 now names `reviewer-visual` / the judge; coord-03 / coord-05 dispatch the judge hop.
- Server: three `hintStatic` texts, mapping comment, field comment and `VISUAL_ROUND_EXCEEDED.documentedInProse=false` in `gates/registry.ts`; comment-only edits in `gates/visual.ts`, `tools/evidence-file.ts`, `tools/handoff-orchestrator.ts`; `dist/` rebuilt for exactly those four groups. No predicate, counter, transition or schema change.
- Docs: README tier row, `docs/config.md` override row + migration note; eval bundle role map. 12 compose goldens and the moved `test/context-budget.test.mjs` caps re-captured (R3 (b)).
- Verdict: APPROVED — every AC implemented and proved, suite green on a clean tree, scope inside the owned files and their line / section restrictions.

## AC Completeness
AC1 — implemented — `content/skill-reviewer-visual.md:1-4` (opus, `# Skill: reviewer-visual`); `templates/claude-code-agents/reviewer-visual.md:1-9`; `content/skill-qa-visual.md` and `templates/claude-code-agents/qa-visual.md` deleted; 12 templates.
AC2 — implemented — `content/skill-code-reviewer.md:83` (step 6a = `cr.visual_step`, between 6 and 7); `content/skill-qa-engineer.md:44` (no sub-skill load, no visual verdict); `content/coord-05-core-visual-drift.md:5` (`coord05.dispatch`). Reading of the last clause: see Correctness (ruling on note 1).
AC3 — implemented — no `content/*` file contains `qa-visual`; `gates/registry.ts` only at :474 / :512 (the two historical spec file names, D19); `content/const-11-design-chain-32.md:4` (`const11.head`), :17 (`const11.measure`).
AC4 — implemented — `content/skill-qa-engineer.md:44` (step 4g **Visual checks**: capture check, diff check, record fields, fails only when it cannot measure, isolation captures, sr passes both); `content/skill-sr-engineer.md:26` (loop runs qa-engineer's capture / diff checks).
AC5 — implemented — `content/skill-reviewer-visual.md:6-10` (code-reviewer's sub-skill, metric from the diff check's record of the judge's own suite run, within = `pass` with no image read, R2 (a) rows), Step B2 (over-threshold image read only), *Allowed Differences* (surface id, metric, reason, no human stop), *Error codes & STOP routes* (CHANGES_REQUESTED counted once in `review_round`; sr / qa / Blocked pm routes; step 5c pointer); report contract unchanged.
AC6 — implemented — no gate change (D3); `test/e434-reviewer-visual.test.mjs` AC6 green.
AC7 — implemented — `accepted` surface + `## Allowed Differences` entry passes; AC7 green.
AC8 — implemented — `gates/registry.ts:414` (`hint.visual_evidence`); AC8 green.
AC9 — implemented — (a) server unchanged: code-reviewer FAIL bumps `review_round`, `visual_round` stays; (b) `content/const-01-core-head.md:9-17`, `content/const-09-design-chain-vround.md`, `content/skill-sr-engineer.md:26`, `content/constitution-rationale.md:205`; no `visual_round` / `visual_split` / `visual_fail:` / `VISUAL_ROUND_EXCEEDED` in `content/`.
AC10 — implemented — `gates/registry.ts:69-73` (field comment), :82 (`mapping.vround`), :97-104 (mapping rows), :169 (`documentedInProse: false`), :414 / :438 / :453-456 (hints); 35 entries, 17 steps, D21 digest equal.
AC11 — implemented — `docs/config.md:263,268`; `README.md:107`; `test/eval/lib/bundle.mjs:40`.
AC12 — implemented — `test/fixtures/compose-golden/**` (12 re-captured), `test/context-budget.test.mjs` caps = measured values with one re-baseline line each; design-arm sentinel names `const11.head`; per-site token delta in `qa_reports/tests_e434-reviewer-visual.md`.
AC13 — implemented — 35 / 17 / `CURRENT_VERSIONS` unchanged; `tools/transitions.ts`, `schema/**`, `prompts/**`, `CLAUDE.md` untouched (250 lines); `agc check` exit 0; `dist/` diff only the four groups; `npm audit --audit-level=high` exit 0; full suite exit 0.

## Correctness
Tests (step 4):
- Every automatable AC has one test in `test/e434-reviewer-visual.test.mjs` (AC1–AC11, AC13) plus AC12 via `compose-equivalence` / `context-budget`; the tests landed (dfba8f4) before the build and were red at write (56 reds, recorded in the manifest), so they fail on the wrong result. Server scenarios (AC6–AC9 (a)) drive the real `tw_update_state` entry on a design-armed, test-first temp workspace; AC8 asserts the code, the expected path and the exact hint; AC10 freezes a base digest of every non-moving registry field (D21) and checks the mapping rows against the live quote sites; AC2 / AC13 / AC10 read a closed range (`LANE_END_SHA` = 11073f3, sr's last source commit; nothing in `content/`, source or `dist/` changed after it) and skip loudly when unreachable.
- Ruling on carried note (1), AC2's last clause: the clause cannot hold for the whole composed prompt, because AC9 (b) and D16 — same spec, cut-approved — change const-01 and const-05, which are core fragments in every composition. The intent (non-UI features pay only step 6a on the code-reviewer side) is met. I composed the non-design code-reviewer prompt at base `e5ccda0` and at HEAD and diffed them: the only differences are step 6a, the const-01 Limits example + two rows and the const-05 note-token list (plus the handoff timestamp). The qa reading (SOP minus 6a = base blob, composed prompt carries 6a once) is acceptable; not a scenario defect — the conflict is resolved inside the spec by the more specific AC9 (b) / D16, so a pm round would change wording only. (recommended, report-only) pm words such a clause as "the SOP part" in future specs.
- (recommended) `test/e360-qa-visual-review-task-ids.test.mjs` AC-E360-1 loops over the FAIL calls it finds with no count assertion, so it would pass with zero calls; AC5 of the new file covers the routes, so not blocking. Asserting `calls.length >= 1` (4 today) would restore the guard.
- (recommended) `test/e393-builder-judge-core.test.mjs` AC-A2 relaxed `bullets.length === 2` to `>= 2`; const-11 now has exactly 3 bullets, which could be pinned. Covered in part by AC3 (const11.head first, const11.measure present).
- (optional) AC9 (a) uses a pending note without `visual_fail:`; the scenario says "a visual finding", which the test meets; adding the token would also show the old counter path cannot be re-triggered from a code-reviewer FAIL.
- (optional) AC7's second assertion reads back the fixture's own `## Allowed Differences`; the load-bearing part is the accepted PASS with an `accepted` surface, which is asserted.
Implementation: no defects. Spot checks — `content/skill-sr-engineer.md:26` keeps "until both pass and ALL VSA rows hold" next to the `fix_try` hand-off, consistent with const-09's carve-out (R1 (a)); the reviewer-visual STOP table routes a design defect `Blocked` → pm (no `code-reviewer:FAIL` → design-auditor edge exists, D13); `const-11` enforcement now states PASS is server-restricted to code-reviewer on the test-first chain, which matches the server.

## Quality
- Copy audit (5a): every Copy / Strings row matched verbatim — `rv.title`, `tpl.rv_*`, `cr.visual_step`, `coord05.dispatch`, `qa.visual_label`, `const11.head`, `const11.measure`, `const09.body`, `sr.progress`, `limits.example`, `rationale.pixel`, `hint.visual_evidence`, `hint.assertions_required`, `hint.report_incomplete`, `mapping.vround`, `readme.rv_row` (cell widths equal the base row), `config.override_row`, `config.migration`; `registry.field_comment` is split across two `//` lines with identical text (the test joins comment lines). No unlisted user-facing string. Visual-token audit (5b): spec has no Visual Tokens (N/A).
- (optional) `test/e410-task-alias-content-tail.test.mjs:49,76` lost a space after `31,` and `35,` — cosmetic.
- Comment check (5d), each `agc check — comments` warning touching the diff, kept:
  - `gates/registry.ts:77` long-block 36 — the errorCode → doc-file mapping table pre-exists on base and is read by `test/error-code-contract.test.mjs`; the diff only renames rows (carried note (2): does not matter).
  - `test/context-budget.test.mjs:590 / :617 / :947` long-block 8 / 12 / 10 and the file's high ratio — cap-history runs the file already uses; AC12 requires one re-baseline line per moved cap, which is all the diff adds (carried note (2): advisory only, no trim requested).
  - `gates/visual.ts`, `tools/evidence-file.ts` high ratio — pre-existing; the diff changes words inside existing comments, zero net lines.
  - `test/e434-reviewer-visual.test.mjs:1` long-block 15 — header states the invariant and the frozen-base / closed-range mechanism a reader needs to trust the digests; kept. (optional) could shrink to the invariant + a pointer to the test report.
  - `test/e412-qa-visual-template.test.mjs:1` long-block 8 — one line over, the re-pin note (D20 file name kept); kept.
  - `test/eval/lib/bundle.mjs`, `test/pixel-perfect-visual-compare.test.mjs`, `test/qa-visual-skill-split.test.mjs`, `test/widget-shape-spec.test.mjs` high ratio — pre-existing; re-pin notes are one to four lines; kept.
- `content/**` portability: no added served line cites a repo-only path or a ticket id (the only id in an added line is the pre-existing origin-fenced `(E30)`, carried from the old file).

## Architecture
No architecture spec (D6: no architect hop). Layering unchanged: server text edits are hints, one `documentedInProse` value and comments; the gate predicates stay agent-agnostic (`PASS_VISUAL_SUBGATES` runs on any PASS), so the report path `qa_reports/visual_<task-id>.md` and its writer change needs no code (D3). The sub-skill is loaded by the judge's SOP (step 6a), not by `prompts/**` (byte-identical), keeping non-UI dispatches free of it. `const-09` keeps its file (15 fragments, manifest untouched). Scope: `fanout.mjs check --cut` 0 out of bounds; the manifest's prose restrictions checked by hand — `gates/registry.ts` only hints / mapping / field comment / one `documentedInProse`; `README.md` only :107; `docs/config.md` only the list + note; `gates/visual.ts` / `tools/evidence-file.ts` / `tools/handoff-orchestrator.ts` comments only; `tools/transitions.ts` and `CLAUDE.md` untouched; pre-assigned test sections (e295 AC11, e308 E303-AC11a, e410 AC2, e118 cap, constitution-deliverable-guard A4, phase-0-5 AC-4) are the only parts edited in those files; e431 / e433 / error-code-contract not edited and green.

## Security
No findings. No new input crosses a trust boundary; no secrets; no executable change outside comments and static hint strings.

## Performance
No findings. Served prompts shrink (non-design constitution −62 ~tok, design arm −46, sr SOP −50; code-reviewer SOP +399 bytes for step 6a, inside its cap); no runtime code path changes.

## Verdict
APPROVED — all 13 ACs implemented and proved, full suite green, no required finding; the AC2 clause is read as the SOP part (verified independently by composing base vs HEAD).
