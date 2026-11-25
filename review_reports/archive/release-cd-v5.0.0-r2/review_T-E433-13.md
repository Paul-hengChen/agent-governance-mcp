# Review — T-E433-13 (feature e433-test-first-rules)

covers: T-E433-13

## Round 1 — APPROVED — by code-reviewer

Diff: `91cd022..9a72946`. Source change: `content/const-05-core-standards.md` only (5d3f115). Also in range: the expected-red manifest rewrite (1bb2e8a), lane-state commits (da4c97d, 47301e6), and a spec-only fix (9a72946). Inputs: the diff, `specs/e433-test-first-rules.md` (AC2(f)/(g), D21), `qa_reports/expected-red_e433-test-first-rules.txt` (carve-out), the qa and sr SOP sites that D21 must stay consistent with (`content/skill-qa-engineer.md:31,59`, `content/skill-sr-engineer.md:33,54-55`), and `tools/transitions.ts` (read-only). Reviewer model: opus, the same tier as sr-engineer. Possible same-model bias is flagged here, as the SOP asks.

## Summary
- Resolves round-2 recommendations 1–2 (`review_reports/review_T-E433-12.md`) as the human ruled in D21. const-05:16 *State update* gains one sentence: when the server accepts no write from the acting role, that role stops and reports, and a role that can write takes over. const-05:6 *Build gate* extends the D19 allowance to sr-engineer's stop to pm (`sr_return` cap reached, or a scenario cannot be built).
- Two sentences in one file. Line count is unchanged (22 newline-terminated lines, the same as base 96708e6 and 91cd022). No `gates/`, `tools/`, `dist/`, `test/` or `CLAUDE.md` change.
- The spec fix 9a72946 only reorders the 12 proof commands so `--test-name-pattern` comes before the file argument. The command set is otherwise identical.
- Verdict: APPROVED. No `required` finding; two `optional` notes. Prior approvals (T-E433-01..07, -11, -12) stand.

## AC Completeness
AC2 — implemented (scope of this delta: (c), (f), (g)):
- (c) The *Builder ≠ judge* bullet (const-05:21) is byte-identical to base 96708e6 (cmp of the grepped line: identical).
- (f) const-05:6 adds "or its stop to pm (`sr_return` cap reached, or a scenario cannot be built)" inside the D19 sentence. "may carry back only those listed errors and adds none" now governs both the return and the stop. "Every other hand-off, sr-engineer → code-reviewer included, stays at zero" is unchanged.
- (g) const-05:16 adds "When the server accepts no write from the acting role, that role stops and reports instead, and a role that can write takes over." This matches D21 (1).

AC2 proof (`node --test --test-name-pattern "AC2:" test/e433-*.test.mjs`) filters to 1 of the file's 16 tests and passes. The AC2(f)/(g) assertions for the new text are qa's T-E433-10, as D21 says.

Other ACs are not touched by this delta; earlier rounds' lines stand.

## Correctness
- D21 (1) matches the server. After a qa claim is rejected with `SR_RETURN_CAP_EXCEEDED`, the state is still `sr-engineer:In_Progress`. The successors of that state are code-reviewer:In_Progress, sr-engineer:Blocked and pm:In_Progress (tools/transitions.ts:266-270), plus qa-engineer:In_Progress on a marked feature (:374, rejected at the cap by :610-624, which allows only `pm:In_Progress`). The table has no qa-engineer Blocked or FAIL edge, so the server accepts no qa write. The new §3 sentence makes skill-qa-engineer.md:31 ("stop, write no state … report … so pm takes the feature") a direct application of §3 instead of a deviation from it. The step-2 `TRANSITION_REJECTED` stop is covered the same way.
- No loophole against §3. The trigger is "accepts no write from the acting role", which means no write of any kind. A role whose intended write is rejected but whose Blocked or FAIL escalation write would be accepted is not covered and must still write. The sentence also leaves *Builder ≠ judge* untouched: it never lets a role write on another role's behalf, only hands over to "a role that can write". In the one live site, that is pm, whose `sr:In_Progress → pm:In_Progress` claim is accepted.
- D21 (2) matches sr's SOP. skill-sr-engineer.md:54-55 are exactly the two stops named in const-05:6, and both route sr-engineer Blocked → pm. sr may not edit qa's tests (const-05:5, "sr-engineer never edits a test qa-engineer wrote"). Before this change, those stops required zero errors that sr had no means to clear. Now they carry back only the manifest-listed errors and add none. The return to qa (D19) and sr → code-reviewer (zero) are unchanged.
- Error codes: the set of backtick-quoted ALL-CAPS tokens in const-05 is identical between 91cd022 and HEAD (md5 match). No code is added, dropped or unquoted.
- 4a: the diff touches no test file. Intentional reds exist, so the manifest was read. It has 21 entries: 11 compose-equivalence, 9 context-budget, 1 skill-manifest golden. Sampled entries resolve to real tests: context-budget.test.mjs:190 and :596; skill-manifest.test.mjs:101; the compose-equivalence names are generated from the 3 templated "is byte-identical to pre-refactor golden" sites. The manifest's "(new) — none" claim is confirmed by the suite comparison (see Suite).

## Quality
- Wording follows the D21 ruling closely, and the build-gate clause sits inside the D19 sentence instead of a new bullet, so const-05 keeps its shape.
- `optional`: const-05:16 "a role that can write takes over" does not name the role. That is correct for a general rule, because the allowed role depends on the state. Both live sites (qa claim rejected at the cap; qa claim rejected with `TRANSITION_REJECTED` for a missing marker) name pm in their own SOP text. No change needed.
- `optional`: the manifest note says "const-05 keeps 23 lines". By newline count the file has 22 lines (`awk 'END{print NR}'`: 22 at base, 91cd022 and HEAD). The "23" is presumably `split("\n").length` with the trailing newline. The count is unchanged either way, so this only affects how the claim reads.
- Comment check (4b): the diff adds no code comment. The `agc check — comments` warnings (gates/registry.ts:78, test/e433-test-first-rules.test.mjs:1, two older test files) are outside this delta.

## Architecture
There is no architecture spec. The new constitution text agrees with the transition table (see Correctness). No layering change.

## Security
No findings. Text-only change. No secrets. The content/** hygiene holds: the added text cites no absolute or repo-only path, only `sr_return`, which const-01 Limits defines. `node bin/agc-init.mjs check` exits 0 (OK 4.23.0).

## Performance
No findings. Text-only change. The context-budget caps move with the added words; those tests are in the expected-red manifest, and T-E433-10 re-captures them.

## Suite
`node scripts/test-lock.mjs -- npm test` at HEAD 9a72946 (clean tree apart from this report): 4513 tests, 4490 pass, 21 fail, 2 skipped, 0 cancelled (npm exit 1, from the expected reds). I compared the failing test names with the manifest's 21 `file | test name` pairs, name by name. They are the same set: 0 unexpected, 0 missing. This delta adds no red and removes none, and the totals match sr's pre- and post-T-E433-13 baseline.

## Verdict
APPROVED — D21 (1) and (2) are implemented exactly as ruled in const-05 only, they agree with the qa/sr SOP sites and the server's transition table, *Builder ≠ judge* is byte-identical to base, and the red set equals the 21-entry manifest.
