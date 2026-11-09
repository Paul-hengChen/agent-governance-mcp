# Review — T-E416-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `git diff integ/e416..243aacd` (6 files, +19 / -3). Spec: `docs/backlog.md` row E416 (backlog row used as the spec in a mini-chain).

## Summary
- Adds the E416 filing bar in four shipped places: a new **Filing bar** paragraph in `content/coord-03-core-fallback.md:56`, plus "that clears the filing bar" in the E179 paragraph at :58; a sentence on finding tiers in `content/skill-code-reviewer.md:31`; an inline bar in `content/skill-integrator.md:186` (5c-1); and a new first bullet **門檻** in `docs/lane-protocol.md:57` (§4). Separately, it adds a repo-only fix-spec self-check bullet to `CLAUDE.md:166`, and the expected-red manifest.
- Scope matches the cut. No code, gate, schema, script, dist or golden change. The `agc-version` stamp in CLAUDE.md is untouched.
- None of the four shipped sites cites a path or artifact that exists only in this repo. `docs/backlog.md` in 5c-1 was already in the original sentence and is a workspace-generic name.
- Verified independently rather than taken from sr's report:
  - `npm test`: 4053 tests, 4050 pass, 1 fail, 2 skipped. The one failure is `t-golden-byte-identity` (`test/skill-manifest.test.mjs:101`), as the manifest declares, and diffing the composed monolith against the golden shows only the coord-03 hunk (golden line 175 becomes lines 175-177).
  - Teamwork bundle, recomputed with the test's own formula: 21523 ~tok at 243aacd and 21418 at `integ/e416`, under the 21715 cap.
- Verdict: CHANGES_REQUESTED. The integrator site, which is the only copy of the bar the integrator's prompt carries, states two of the bar's three clauses and only part of the third (1 required).

## AC Completeness
AC Completeness: SKIP — no specs/e416-ticket-filing-bar.md (backlog-row-as-spec mini-chain)

Checked against the E416 backlog row's fix clauses instead:
- Site 1, code-reviewer finding tiers: done at `content/skill-code-reviewer.md:31`. Non-blocking tiers are report-only, and a defect this diff introduced is `required`.
- Site 2, integrator 5c-1: **partial**, see R-1. Clause (a)/(b) is present. The "defect the current ticket introduced is fixed in the same lane, never filed" clause is missing. The "review and QA `recommended` / `optional` notes" clause is narrowed to "a reviewer's".
- Site 3, coord-03 E179 paragraph: done at `content/coord-03-core-fallback.md:56-58`. All three clauses are present.
- Site 4, lane-protocol §4: done at `docs/lane-protocol.md:57`. All three clauses are present.
- CLAUDE.md repo-only self-check: done at `CLAUDE.md:166-168`. It names the repo-only-path check and the pins, goldens and context-budget caps.

## Correctness
- **R-1 `required`: `content/skill-integrator.md:186` (5c-1) states the bar incompletely.**
  - The cut requires the same bar at sites 2-4, with three clauses: (a)/(b); a defect the current ticket introduced, a flaw in its own fix spec included, is fixed in the same lane and never filed; and review **and QA** `recommended` / `optional` notes are listed once, not filed.
  - 5c-1 has the first clause. It drops the second entirely and narrows the third to "a reviewer's".
  - The integrator prompt is `skill-integrator.md` alone (`prompts/integrator.ts`; coord-03 is not composed in), so the missing clause exists nowhere in the integrator's context.
  - Consequence: a confirmed, user-facing defect that a lane of this wave introduced, and that the integrator finds at integration, clears the inline (a)/(b) test as written. The integrator would then file it as a new row instead of sending it back to the lane. That is the E415 loop this ticket exists to close.
  - 5b-5 and 5b-8 make it worse by still offering "the fix belongs to that lane or a new ticket" with no rule for choosing between them.
  - Suggested wording, one parenthetical, no new sentence: `… AND clear the filing bar (a confirmed defect that will make users go wrong, or one the human asks for; a defect a lane of this wave introduced goes back to that lane, never filed), full row in docs/backlog.md; a reviewer's or QA's recommended / optional items are listed in the wave report, not filed.`
  - No context-budget cap covers `skill-integrator.md` (checked in `test/context-budget.test.mjs`), so the extra words move no pin.

No other correctness findings:
- coord-03's new paragraph comes before the E179 paragraph and is referenced from it ("that clears the filing bar"). Both agree with the Backlog Intake Loop above them and the E297 bookkeeping paragraph below them.
- lane-protocol §4's later bullets (block format, no self-minted id, `target_repo`, commit requirement, `artifacts: local`) govern how to write a block, not whether to write one, so they still read correctly beneath the new **門檻** bullet.
- In 5c-1, "Place both kinds" still refers to lane-allocated and integrator-allocated tickets and still reads correctly.

## Quality
- **recommended: `docs/lane-protocol.md:127`, lane final-report template.** The `新發現` line still asks for "哪幾筆值得提升、為什麼". Under the new §4 bar, every block has already passed the bar, so this clause now reads as a second filter. The template also has no slot for the review / QA `recommended` / `optional` notes that §4 now says are "只在最終回報列一次". A lane may drop them or put them under `新發現`, which this ticket is trying to prevent. A wording such as `+ 每筆符合門檻的理由` on that line, plus a line `- review / QA 的 recommended / optional 意見：<列一次，不開票>`, would close both. Report-only.
- **optional: `content/coord-03-core-fallback.md:56`.** "fixed in the same lane before merge" assumes a lane. coord-03's own E130 *Lane-start default* (:12-13) keeps single-role, coordinator-direct and lite work in place with no lane. "fixed in the same lane (or the same feature, when no lane was opened) before merge" would cover that case. Report-only.
- No new code comments in the diff, so step 4b does not apply.

## Architecture
No architecture spec exists for this feature. The change is wording only. It respects the boundaries that apply here:
- The shipped `content/**` and `docs/lane-protocol.md` sites stay workspace-generic.
- The repo-only rule goes in `CLAUDE.md`, not the lane-protocol addendum, per the backlog row's own reasoning.
- The integrator bar is stated inline, as its prompt requires, though incompletely (R-1).

## Security
No findings. Prose only. No new input crosses a trust boundary, and the diff adds no secret, private path or confidential reference.

## Performance
No runtime code changed. Context cost is the only measurable effect:
- The teamwork bundle grows by +105 ~tok (21418 → 21523) and stays under the 21715 cap.
- No cap covers code-reviewer or integrator.
- No regression.

Expected-red sampling (step 4a): the manifest `qa_reports/expected-red_e416-ticket-filing-bar.txt` has one entry. It is real and locatable (`test/skill-manifest.test.mjs:101`), and it is the only red in the suite run.

## Verdict
CHANGES_REQUESTED — the integrator 5c-1 site, the only copy of the bar in that role's prompt, omits the "a defect the current ticket introduced goes back to its lane, never filed" clause and narrows the review/QA clause, so the cut's "same bar at sites 2-4" is only partly met (R-1). The `recommended` and `optional` items above are report-only and are not proposed as tickets.

### sr-engineer reply (round 1)
- R-1 (required): fixed at `content/skill-integrator.md:186` (5c-1) with the suggested parenthetical. The lane-introduced-defect clause is now inline, and the review clause reads "a reviewer's or QA's". "Place both kinds" still refers to lane-allocated and integrator-allocated tickets.
- recommended, `docs/lane-protocol.md:127`: folded in at the coordinator's direction, because this diff created the inconsistency. The `新發現` line drops the second filter and now reads "只寫過 §4 門檻的". A new line `review / QA 的 recommended / optional 意見：<列出，不開票>` gives those notes a slot.
- optional, `content/coord-03-core-fallback.md:56`: also folded in. It now reads "is fixed within the current ticket before it merges", which covers work done in place with no lane. The §4 門檻 bullet in lane-protocol is lane-scoped, so its "本 lane merge 前" stays.
- 5b conflict, which the reviewer noted under R-1 and the coordinator asked to close in this round: `content/skill-integrator.md:179` (5b-5) and `:182` (5b-8) no longer offer "or a new ticket". Each now says the fix belongs to the owning lane, never a new ticket, and that when no single lane owns the defect, the integrator reports to the human. Line 202 (stage 6 step 4, red required check after the pull request opens) is left as it was, per the coordinator.
- Line 202 (stage 6 step 4, a red required check after the pull request opens): on the coordinator's follow-up, which reverses its earlier "leave it alone", it now says "by the owning lane, never a new ticket and never by hand on `main` (no single owner → report to the human)". The rest of that line is unchanged. No "lane or a new ticket" choice remains anywhere in `content/`.

## Round 2 — APPROVED — by code-reviewer

Round diff: `git diff 6bfb2a5..96c1d88` (362bc4a, 3e80450, 96c1d88). Feature diff re-judged in full: `git diff integ/e416..96c1d88` (7 files: `CLAUDE.md`, `content/coord-03-core-fallback.md`, `content/skill-code-reviewer.md`, `content/skill-integrator.md`, `docs/lane-protocol.md`, the expected-red manifest, this report). Spec: `docs/backlog.md` row E416.

## Summary
- R-1 is fixed. `content/skill-integrator.md:186` (5c-1) now states the whole bar inline: (a)/(b); "a defect a lane of this wave introduced goes back to that lane, never filed"; and "a reviewer's or QA's `recommended` / `optional` items are listed in the wave report, not filed".
- The round-1 `recommended` item (`docs/lane-protocol.md:127`) and `optional` item (`content/coord-03-core-fallback.md:56`) are both folded in, and both read correctly.
- Integrator 5b-5 (:179), 5b-8 (:182) and stage 6 step 4 (:202) no longer offer "lane or a new ticket" as a choice. Each sends the fix to the owning lane and, when no single lane owns it, to the human. `grep -rnE "or a new ticket|lane or a new" content/ docs/ templates/` finds nothing.
- Scope holds: wording only, no code, gate, schema, script, dist or golden change, and the `CLAUDE.md` `agc-version` stamp is untouched.
- Verified independently at 96c1d88:
  - `node scripts/test-lock.mjs -- npm test`: 4053 tests, 4049 pass, 2 fail, 2 skipped.
    - Fail 1: `t-golden-byte-identity` (`test/skill-manifest.test.mjs`). This is the manifest's one expected red. Diffing the composed monolith against `test/fixtures/compose-golden/skill-coordinator-monolith.txt` shows only the coord-03 hunk (golden line 175 becomes 175-177).
    - Fail 2: `tracked host-trace: no-op branches …` (`test/e108-eject.test.mjs:952`), with `status` `null` after 16.5 s, which is a spawn timeout. The diff touches nothing on the eject path. Re-running `node scripts/test-lock.mjs -- node --test test/e108-eject.test.mjs` alone gives 35/35 pass, so this is load flakiness, not something this diff introduced.
  - Teamwork bundle: 21526 ~tok, recomputed with the test's own formula. That is under the 21715 cap, and the cap test itself is green.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e416-ticket-filing-bar.md (backlog-row-as-spec mini-chain)

Re-checked against the E416 row's fix clauses, whole feature diff:
- Site 1, code-reviewer tiers (`content/skill-code-reviewer.md:31`): done. Non-blocking tiers are report-only, and a defect this diff introduced is `required`.
- Site 2, integrator 5c-1 (`content/skill-integrator.md:186`): done, with all three clauses. The fix-spec case is covered by "a defect a lane of this wave introduced".
- Site 3, coord-03 (`content/coord-03-core-fallback.md:56`, `:58`): done. All three clauses are present, and the E179 paragraph files only "each new finding that clears the filing bar".
- Site 4, lane-protocol §4 (`docs/lane-protocol.md:57`) plus the final-report template (`:127-128`): done. All three clauses are present, and the template now has a slot for review / QA `recommended` / `optional` notes ("列出，不開票").
- `CLAUDE.md:166-168` repo-only fix-spec self-check: done.
- None of the shipped sites (`content/**`, `docs/lane-protocol.md`) cites a repo-only path. The only paths in the added text, `docs/backlog.md` and `.current/<lane>/pending-tickets.md`, were already in the surrounding sentences and are workspace-generic.

## Correctness
No `required` findings. R-1 is closed.
- The four sites state one bar. coord-03 says "fixed within the current ticket before it merges", which covers work with no lane, and lane-protocol §4 says "本 lane merge 前", which is lane-scoped by design. The two agree.
- 5c-1 "Place both kinds" still refers to lane-allocated and integrator-allocated tickets. The inserted clauses don't change what it points to.
- The new "(no single owner → report to the human)" endings agree with the integrator *Decision rights* table (`content/skill-integrator.md:218-224`): sending a lane back is the integrator's call, and anything the table doesn't grant the integrator goes to the human.
- Expected-red sampling (step 4a): the manifest has one entry, and it is real and locatable (`test/skill-manifest.test.mjs`, `t-golden-byte-identity`). The round-1 re-measure note added to it (21526 ~tok) matches my own measurement.

## Quality
- **optional, existing before this ticket: `content/skill-integrator.md:202` vs `:182`.** Stage 6 step 4 says "the fix is a commit on the integration branch by the owning lane", while 5b-8 says "Never fix feature code on the integration branch". The "commit on the integration branch" wording was there before E416; this ticket only replaced "or a new ticket". Both lines likely mean the lane fixes it and the fix is then merged into the integration branch, but neither says so. Report-only.
- **optional: `content/skill-integrator.md:186`** says "listed in the wave report" where coord-03 and lane-protocol say "listed once". The integrator writes one wave report, so the meaning is the same. Report-only.
- The diff adds no code comments, so step 4b does not apply.

## Architecture
No architecture spec exists. The boundaries this feature depends on hold:
- The shipped sites stay workspace-generic.
- The repo-only rule lives in `CLAUDE.md` only.
- The integrator prompt (`skill-integrator.md` alone, with no coord-03 composed in) now carries the complete bar inline.

## Security
No findings. The change is prose only. It adds no secret, private path or confidential reference.

## Performance
No runtime code changed.
- Teamwork bundle: 21418 at base, 21526 at 96c1d88 (+108 ~tok for the feature, +3 from this round). That is under the 21715 cap.
- No context-budget cap covers `skill-integrator.md` or `skill-code-reviewer.md`.
- No regression.

## Verdict
APPROVED. All four shipped sites state one consistent filing bar with no repo-only paths, the integrator SOP no longer offers "lane or a new ticket" anywhere, and nothing outside scope changed. The suite matches the declared expected red, plus one unrelated timeout that passes on re-run. The two `optional` items above are report-only and are not proposed as tickets.
