# Review — T-E433-12 (feature e433-test-first-rules)

covers: T-E433-12

## Round 1 — APPROVED — by code-reviewer

Diff: `e12c42e..5fbf9a1` (source: `content/const-05-core-standards.md`, `content/skill-sr-engineer.md`, `content/skill-qa-engineer.md`, `content/skill-integrator.md`; plus `specs/e433-test-first-rules.md` AC2(f), D19, D20 and `.current/e433/pending-tickets.md`). Inputs: the diff, the spec, `qa_reports/expected-red_e433-test-first-rules.txt` (carve-out), and the server source the new text describes (`tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `tools/handoff-write.ts`, `tools/handoff-parse.ts`, read-only). Reviewer model: opus, the same tier as sr-engineer; possible same-model bias is flagged here as the SOP asks.

## Summary
- Fixes round-1 recommendations 1–3 (`review_reports/review_T-E433-01.md`) as the human ruled in D19/D20: the sr SOP checks `sr_return_count` before a return; the qa SOP says what a claim rejected with `SR_RETURN_CAP_EXCEEDED` means; the const-05 *Build gate* covers sr's return to qa; integrator verifier constraint (5) no longer calls qa-engineer a judge.
- Recommendation 4 (doc-writer's post-PASS write) is filed as pending ticket E433-NEW-1 instead of being fixed, as ruled.
- 4 content files, 1 line each; no `gates/`, `tools/`, `dist/`, `test/` or `CLAUDE.md` change.
- Verdict: APPROVED. No `required` finding; two `recommended` and two `optional` notes. The round-1 approval of T-E433-01..07 and T-E433-11 still holds.

## AC Completeness
AC2 — implemented — (c) the *Builder ≠ judge* bullet, const-05:21, is byte-identical to base 96708e6 (`git diff 96708e6 HEAD` shows no change to that line); (f) const-05:6 adds the D19 clause: on a return, sr carries back only the manifest-listed errors and adds none, and "sr-engineer → code-reviewer included" stays at zero.
AC3 — implemented — skill-qa-engineer.md:31 (step 2: a claim rejected with `SR_RETURN_CAP_EXCEEDED` → stop, write no state, report so pm takes the feature); :59 (step 8 now says the cap is checked on qa's claim).
AC4 — implemented — skill-sr-engineer.md:33 (4c: read `sr_return_count`, absent means 0; below the cap → return, at the cap → *sr_return cap reached* row; a return adds no compile errors; the server checks on qa's claim); :54 (the cap row is now triggered by `sr_return_count` at the cap, not by the rejection code).
AC7 — implemented (scope of this task: integrator) — skill-integrator.md:166 constraint (5): "code-reviewer is the judge and qa-engineer the test author". The bold label `(5) **not code-reviewer / qa-engineer**` is unchanged; it is pinned by test/e178a-integrator-role.test.mjs:368 and test/e295-hop-cap-and-sop-halves.test.mjs:96.
Other ACs: not touched by this delta; round-1 lines stand.

## Correctness
Checked against the server:
- The cap fires on qa's claim. tools/transitions.ts:604-625 rejects `sr-engineer:In_Progress → qa-engineer:In_Progress` on a marked feature when `prev_sr_return_count >= SR_RETURN_CAP` (2), and allows only `pm:In_Progress`. sr's return write is a self-loop, `sr:In_Progress → sr:In_Progress` with `next_role`, which step 3 accepts before any cap applies. The SOP text matches.
- sr can read the counter. `sr_return_count` is written to the frontmatter only when it is above 0 (tools/handoff-write.ts:631-638), read back by tools/handoff-parse.ts:519,586, and returned by `tw_get_state`. So "absent means 0" is correct. 2 returns → count 2 → "at the cap" → no third return, which is the return the server would reject. The boundary is correct.
- The sr cap row can be written. `sr-engineer:In_Progress → sr-engineer:Blocked` is in ALLOWED (transitions.ts:266-270), and `sr-engineer:Blocked → pm:In_Progress` is too (:271-273).
- qa's "write no state" is the only thing qa can do. From `sr-engineer:In_Progress` the table offers code-reviewer:In_Progress, sr-engineer:Blocked, pm:In_Progress, and on a marked feature qa-engineer:In_Progress (transitions.ts:266-270, :374). It has no `qa-engineer:Blocked` or `qa-engineer:FAIL` edge, and the cap rejection allows only `pm:In_Progress`. So any qa write would be rejected, and the sr deviation from its brief is correct. The instruction can be carried out (stop and report; pm's claim `sr:In_Progress → pm:In_Progress` is accepted and resets `sr_return_count`, transitions.ts:829-830). No role is left without a compliant action. A step-2 precedent has the same shape (a `TRANSITION_REJECTED` claim → stop and report), and round 1 approved it.
- Build gate (D19): the clause is limited to the return edge and says "adds none". `sr-engineer → code-reviewer` is named as zero.
- Integrator (5): "both write verdicts, tests or state" is read collectively. It is accurate for the new chain, and the label pins still hold.
- Round-1 findings: no regression. No old-chain text is reintroduced in the four files: no qa PASS, no qa `tw_complete_task`, and no `qa_round` charge (the only `qa_round` mention, skill-qa-engineer.md:13, is round-1 text saying it is never charged). "those are judges" is gone from content/ and test/.
- `recommended` — skill-qa-engineer.md:31 against const-05:16 (*State update*: "On crash/failure, still call it with the failure summary in `pending_notes`"). The qa SOP's "write no state" is correct, because the server accepts no qa write here, and the SOP says so in a parenthesis. But §3 *State update* has no general clause for "every write is rejected". So a reader of §3 alone could take step 2 as a violation. The SOP's own reason settles it for this site. A one-line §3 carve-out (when the server accepts no write for your role, stop and report instead) would cover this site and the step-2 `TRANSITION_REJECTED` precedent together. It is not blocking: the rule can be carried out, and pm owns the next write.
- `recommended` — const-05:6 together with skill-sr-engineer.md:54-55. D19 covers only the return to qa. The two sr → pm escalations (*`sr_return` cap reached*, *scenario cannot be built*) are also hand-offs that can leave qa's manifest-listed compile errors in the tree, which sr may not edit. Under "every other hand-off … stays at zero", these two are read literally as zero too. This gap existed before this delta (the R1 (a) text approved in round 1), and the human's D19 ruling is scoped to the return. Name it in the final lane report so the human can decide whether Blocked escalations to pm fall under the same exception. Not a defect this diff introduced.

## Quality
- Each file changes by one line, and line counts are unchanged. The wording matches the surrounding SOP style (WHEN/DO in 4c; the Escalation Routes row keeps its column shape).
- Mapping comment: `grep -l '`SR_RETURN_CAP_EXCEEDED`' content/*.md` → skill-qa-engineer.md, skill-sr-engineer.md, which equals gates/registry.ts:85. In the four edited files, the backtick-quoted error-code set is unchanged from e12c42e: the sr cap row lost its quote, but 4c (:33) still has one, and qa :31 and :59 both quote it.
- `optional` — the qa stop at skill-qa-engineer.md:31 is prose, not an `## Escalation Routes` row. That is consistent: the convention's rows are state writes (const-05:19), and this site makes none. The step-2 `TRANSITION_REJECTED` stop is the precedent.
- `optional` — specs/e433-test-first-rules.md D20 ends with "Routing: qa-engineer writes Blocked → sr-engineer (no qa_round charge), then code-reviewer re-review, then qa." That describes how this lane routes T-E433-12, not the qa SOP. Placed next to "the qa SOP says that a claim rejected … stops and hands to pm", a reader could take it for the SOP's own rule. The spec does not ship, so there is no user impact.
- `agc check — comments` flags gates/registry.ts:78 (long block). That file is untouched in this delta. The warning comes from T-E433-07 and was reviewed in round 1.

## Architecture
There is no architecture spec. The new text agrees with the server's transition table and counters (see Correctness). No layering change.

## Security
No findings. Text-only change. No secrets. In content/**: no absolute path and no repo-only path (the added text cites only `qa_reports/expected-red_<feature>.txt`, which already appeared in const-05). E433-NEW-1 is in lane-protocol §4 block format (`lane_local_id`, `title`, `priority`, `depends_on`, `source`, `body`), above `## Applied`. `node bin/agc-init.mjs check` exits 0.

## Performance
No findings. Text-only. The context-budget caps move with the added sentences; those tests are already in the expected-red manifest (T-E433-10 re-captures them).

## Suite
`node scripts/test-lock.mjs -- npm test` at HEAD 5fbf9a1: 4497 tests, 4436 pass, 59 fail, 2 skipped, 0 cancelled. The set of failing test names equals the 59 entries in `qa_reports/expected-red_e433-test-first-rules.txt` exactly: 0 unexpected, 0 missing (name-by-name comparison of the `not ok` lines against the manifest's `file | test name` pairs). This delta adds no red and removes none. 4a sampling is covered by that comparison: all 59 entries are real, locatable and failing.

## Verdict
APPROVED — recommendations 1–3 are resolved as ruled in D19/D20, every write the new text prescribes is accepted by the server (and the one it forbids is truly unavailable), and the red set equals the manifest. The round-1 approval of T-E433-01..07 and T-E433-11 stands.
