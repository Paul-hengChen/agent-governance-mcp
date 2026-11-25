# Review — T-E462-10 (e462-stale-comments-wording)

covers: T-E462-10, T-E462-11

## Round 1 — APPROVED — by code-reviewer

Diff judged: `git diff 4620ebc...HEAD` (AC9 amendment base `4620ebc`, the round-1 PASS of T-E462-01..09; HEAD at review start `678a24d`, plus this round's claim/checkpoint state commit `9bb4a8f`). pm amendment commits db08c85 / ac22ed7 (spec, tasks); qa commit bc5f9b4 (T-E462-10); sr commit 8471f7a (T-E462-11, source + `dist/`), state commits 82ed680 / 678a24d. Inputs read: the diff, the AC9 amendment note and AC9 in `specs/e462-stale-comments-wording.md`, the AC9 tests in `test/e462-stale-comments-wording.test.mjs`, `qa_reports/tests_e462-stale-comments-wording.md`, `qa_reports/expected-red_e462-stale-comments-wording.txt`, and the e462 row of `specs/fanout-pre-v5-w2.md` (via `fanout.mjs check --cut`). No architecture spec. Independence note: `tw_get_state` returned sr-engineer's pending notes with the state read, so they were seen; every claim in them was re-derived here by independent runs (transpile, both scans, four mutations, the AC9 tests against base sources, full suite). Same-model note: sr-engineer, qa-engineer and this judge are all opus-pinned.

## Summary
- AC9 amendment, comment-only in the three named files: (a) `tools/handoff-orchestrator.ts:737-742` completion-evidence step comment now says "Completion-evidence gate" and "per-id evidence in the judge report on disk", re-wrapped 7 → 6 lines with the bare ids dropped; (b) `gates/visual.ts:862` now names the "pm to architect or qa-engineer hop"; (c) `gates/expected-red.ts:6` joins `File mode only.` back onto one line, header block 8 → 7 lines.
- `transpileModule` (removeComments, ESNext) output of all three files is byte-identical to `4620ebc`; `dist/` equals `npm run build` output.
- Tests (T-E462-10): two resident AC9 tests, red against the `4620ebc` sources, green at HEAD, each red under the mutations tried (old phrase restored, old phrase re-wrapped across two comment lines, old edge restored, `qa-engineer` removed).
- Scope: sr's commit touches only the three files plus their `dist/` output; no test edited by sr; `fanout.mjs check --cut` 0 out of bounds.
- Full suite on a clean tree: 4697/4699 pass, 0 fail, 2 skipped (the known e130 history skips); every expected-red row green (judge report `qa_reports/review_T-E462-10.md`).
- Verdict: APPROVED.

## AC Completeness
AC1–AC8 — implemented at `4620ebc` (round-1 PASS, `review_reports/review_T-E462-01.md`); not reopened by this amendment, and the transpile check below shows the amendment changes no emitted code in the files it touches. The full suite is green again (AC8 re-confirmed).
AC9 (a) — implemented — tools/handoff-orchestrator.ts:737-742 (old phrases `QA completion-evidence gate`, `per-id QA evidence` absent from file and comment text; names "Completion-evidence gate" and "per-id evidence in the judge report"; step name and `QA_COMPLETION_EVIDENCE_MISSING` unchanged)
AC9 (b) — implemented — gates/visual.ts:862 (`pm to architect or qa-engineer hop`; matches `isBuildEntry` at tools/handoff-orchestrator.ts:210-217, pm → {architect, qa-engineer})
AC9 (c) — implemented — gates/expected-red.ts:1-7 (header 7 lines; spec scan prints no `gates/expected-red.ts` line; wording unchanged apart from the joined line)
AC9 (all three) — implemented — transpile output SAME ×3 vs `4620ebc`; no added line contains `chain_path` or a ticket id (grep of the `+` lines of the source/test diff: no match)

## Correctness
No required findings.
- (a) wording: "needs per-id evidence in the judge report on disk (hasEvidenceInFile: a per-id file or a covers: line)" matches `hasEvidenceInFile` (gates/qa-review.ts:242-264: per-id file at `evidencePath`, else a `covers:` line in `evidenceDir`) and the step's own `resolveJudgeReport` call on the line above. Every other clause of the old block (whatever the status; ids already on disk need none; runs after the qa_review record; no exemptions, no prevState guard; other identities belong to the gate above; file mode only) is kept verbatim. Dropping `E432/E435` removes bare ticket ids from comment text, as Constitution §6 comment discipline and the AC9 "no bare ticket id in new comment text" rule ask; the `Why:` pointer to the tracked rationale spec stays, so no rationale is lost. Within scope: AC9 (a) asks for exactly this block.
- (a) re-wrap: the six-line block plus the unchanged `Why:` line is 7 lines, at the scan limit (the old wrap was 7 + 1 = 8; edited in place it would have been an added-line long-block). The spec scan at HEAD shows no `tools/handoff-orchestrator.ts` finding.
- (b): the build-entry predicate (`isBuildEntry`) arms on prev pm:In_Progress → architect|qa-engineer:In_Progress, and `checkSourceCredibility` is called under it (tools/handoff-orchestrator.ts:490-494), so the comment now states the real edge.
- (c): only the line break moved; the text is identical word for word.
- Tests: the AC9 tests check each old phrase in both the raw file and the marker-stripped, whitespace-normalised comment text, so a re-wrap cannot hide it (mutation M2 below proves it); (b) also requires `qa-engineer` in the `Source-credibility gate` block, so deleting the edge without naming the new one fails (M4). Assertions are on the public artefact (the source text) the AC names; no loose assertion found. (c) and the transpile invariance are judge-run per the spec's proof, not resident tests — accepted as `qa_reports/tests_e462-stale-comments-wording.md` states.
- Coverage: comment-only change, no new executable lines; line coverage not applicable.

## Quality
No required findings.
- `gates/expected-red.ts:6` is now 82 characters, over the 80-column wrap the rest of the header uses — optional, cosmetic; the AC9 (c) example wording asks for exactly this join, and other comment lines in the repo exceed 80 (e.g. gates/visual.ts:865).
- Comment check (5d): spec AC9 scan at HEAD prints 7 advisory warnings, every one also printed by the same scan evaluated on the `4620ebc` tree (which prints 8: the extra one is the removed `gates/expected-red.ts:1 long-block 8 lines`). `node bin/agc-init.mjs check` (diff vs `@{upstream}` = `4620ebc`) prints one: `gates/visual.ts high-ratio 31% of 846 non-blank lines` — kept: pre-existing file-level ratio, this diff changes one comment line in place and adds none.
- The new test helpers `commentText` / `commentBlockAt` are local to the AC9 section, reuse the file's existing `lines` / `norm` helpers, and carry a short WHAT comment each.

## Architecture
No architecture spec for this feature; no layering change (comment-only edits).

## Security
No findings. No code, input path or string changes; no secrets; no repo-only path or personal data added to comments.

## Performance
No findings. No executable code changed (transpile output identical); no performance change possible.

## Verdict
APPROVED — AC9 (a)(b)(c) are met as comment-only edits with byte-identical emitted code, the resident AC9 tests are sound under mutation, scope is exactly the amendment, and the full suite is green.
