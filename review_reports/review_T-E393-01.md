# Review — T-E393-01 (batched: E393 builder ≠ judge core)

covers: T-E393-01, T-E393-02, T-E393-03, T-E393-04, T-E393-05

Round 1 — APPROVED — by code-reviewer. Range: `git diff f664ec9...HEAD -- content/ CLAUDE.md templates/ qa_reports/expected-red_e393-builder-judge-core.txt`; contract: `specs/e393-builder-judge-core.md` (no architecture spec, mini-chain). Rulings applied as relayed in the dispatch brief: budget (i-b) with w2' (the const-15 D10 "Reason" sentence moved into the rationale §6 instead of deleted), header bump, t3 (inline clause dropped from the new bullet); ceilings unchanged.

## Summary

- Prose-only governance change across 19 files: the builder ≠ judge rule moves from const-11 §3.2 to the end of const-05 §3 and now covers code-review verdicts, qa verdicts and PASS; 13 citation sites now cite "§3 builder ≠ judge"; bare round numbers at the named sites become named caps; Limits gets a `visual_split` row; header goes to v3.41.0.
- Every spec §B/§C "current wording" is absent and every "new wording" is present exactly once at its named site (scripted exact-substring check over all 40 rows, including the approved trims t1–t6, w1, w3 and w2').
- The anchor `**Builder ≠ judge (role-collapse guard)**:` appears exactly once in all four `{chain, design}` compositions, raw and stripped; §3.2 appears only in `{true,true}` and holds exactly the two visual bullets.
- The 22 reds match the expected-red manifest exactly (22 of 260 in the affected files). `npm run build` leaves `dist/` with no diff; `agc check` is OK (4.16.1); `check:md-tables` is OK.
- Verdict: APPROVED. Two recommended findings, both about bookkeeping and the spec record, not the shipped text.

## AC Completeness

AC-A1 — implemented — content/const-05-core-standards.md:21: the bullet is the last line of §3 before the closing blank line; the text is the AC-A1 bullet with the t3 deletion applied as ruled; the anchor count is 1 in each of the four compositions
AC-A2 — implemented — content/const-11-design-chain-32.md: the five-line bullet is removed; header + origin tag (:2) and intro (:4–8) unchanged; exactly 2 `- **` bullets remain (:10, :22)
AC-B01 — implemented — content/const-04-design-surgical.md:2 (with trim t1: `(c) §3 builder ≠ judge and §3.2 still hold (sr fixes, qa judges).`)
AC-B02 — implemented — content/coord-02-host-dispatch.md:1 (only the citation changed; Task/Agent wording untouched)
AC-B03 — implemented — content/coord-03-core-fallback.md:39
AC-B04 — implemented — content/coord-05-core-visual-drift.md:3
AC-B05 — implemented — content/coord-07-core-sop.md:11
AC-B06 — implemented — content/skill-integrator.md:51
AC-B07 — implemented — content/skill-integrator.md:166
AC-B08 — implemented — content/skill-sr-engineer.md:26 (the same line's "§3.2 — no global-frame metric" citation is kept)
AC-B09 — implemented — content/skill-qa-visual.md:12 (lines 24 and 69 untouched)
AC-B10 — implemented — templates/agent-adapters/claude.md:12
AC-B11 — implemented — CLAUDE.md:233 (the only hunk in CLAUDE.md; `agc-version:` stamp untouched)
AC-B12 — implemented — content/constitution-rationale.md:7 unchanged, as specified
AC-B13 — implemented — content/constitution-rationale.md:10
AC-B14 — implemented — content/constitution-rationale.md:131–136 (header :104 and `See Constitution §3.2.` :106 unchanged; the first three lines of the paragraph are kept)
AC-B15 — implemented — content/constitution-rationale.md:164
AC-B — implemented — no `§3.2 builder` / `builder≠judge` / `builder ≠ judge, §3.2` / `builder (§3.2)` form in any citing file; the anchor resolves in every composition that loads each citing text (checked by composing through dist/prompts/build.js)
AC-B11-eq — implemented — the `- Subagent dispatch:` lines in templates/agent-adapters/claude.md:12 and CLAUDE.md:233 are byte-identical
AC-B-rat — implemented — the compose-equivalence cases "every 'Constitution §X' reference … resolves to a heading present in exactly one fragment" and "declared scope … live heading" pass; `See Constitution §3` (:136) resolves to const-05 `## 3. State Synchronisation`; the rationale remains one-way
AC-C01 — implemented — content/const-01-core-head.md:16, directly after the `visual_round` cap row (meaning cell per trim t2)
AC-C02 — implemented — content/const-06-chain-31-head.md:8
AC-C03 — implemented — content/const-08-chain-31-mid.md:12
AC-C04 — implemented — content/const-09-design-chain-vround.md:2
AC-C05 — implemented — content/const-09-design-chain-vround.md:3 (all of (a), (b) and (c))
AC-C06 — implemented — content/const-12-chain-r10-s4.md:13 (the parenthetical is removed entirely under trim t4; no trailing whitespace left)
AC-C07 — implemented — content/const-12-chain-r10-s4.md:16–17
AC-C08 — implemented — content/const-12-chain-r10-s4.md:18
AC-C09 — implemented — content/skill-qa-engineer.md:66
AC-C10 — implemented — content/skill-qa-engineer.md:91
AC-C11 — implemented — content/skill-qa-engineer.md:113
AC-C12 — implemented — content/skill-qa-visual.md:83
AC-C13 — implemented — content/skill-qa-visual.md:99
AC-C14 — implemented — content/skill-sr-engineer.md:28
AC-C15 — implemented — content/skill-sr-engineer.md:51
AC-C16 — implemented — content/constitution-rationale.md:183–184
AC-C — implemented — zero matches for `/Round \d|round \d|>= ?\d|up to \d|\d more rounds/` in const-06/08/09/12; none of the forbidden strings in skill-sr-engineer/qa-visual/qa-engineer; the C01 row is present
AC-C-x — implemented — the qa Escalation Routes table still has 7 data rows; test/ac-execution.test.mjs passes
AC-D1 — implemented — content/const-01-core-head.md:1 reads `# Constitution v3.41.0` (the comment is trimmed per the approved w3)
AC-E1 — n/a for this review (qa-owned, T-E393-06); the ceiling assertions at context-budget :200/:502/:566/:591 pass on HEAD, and :912 holds (see Performance)
AC-F1 — n/a for this review (qa-owned, T-E393-06); the 12 golden reds are listed in the manifest
AC-F2 — n/a for this review (qa-owned, T-E393-06); the AC test is not yet authored
AC-F3 — n/a for this review (qa-owned, T-E393-06; suite lock)
AC-F4 — implemented (the T-E393-01..05 part) — after `npm run build`, `git status --short dist/` is empty; `agc check` OK (4.16.1); `check:md-tables` OK

## Correctness

- Exact-substring check, scripted against the base and HEAD blobs: all 40 old/new pairs (B01–B15, C02–C16, t1–t6, w1, w2', w3) show old present once at base and gone at HEAD, and new present exactly once at HEAD. Character-level diffs per file show no edit outside the named spans. The only hunks outside the manifest's original line ranges are those the rulings cover: const-05:5 (w1), const-15:12 (w2'), rationale:183–184 (C16, allowed by the integrator's note in the manifest) and rationale:216–218 (w2' destination).
- Composition, checked through `dist/prompts/build.js` `composeConstitution`: the anchor count is 1 (raw and stripped) in `{F,F}`, `{F,T}`, `{T,F}` and `{T,T}`; the old `.**` anchor count is 0 everywhere; `§3.2 builder` count is 0; there are no bare-round regex hits in any composition. In lite compositions the bullet closes §3 just before `## 5.`, and in chain compositions just before `### 3.1`; it reads correctly in both.
- Semantics hold. `visual_round` cap = 5 means "any round past it locks" and "mandatory route past the cap", which matches the old "Round 6". `visual_split` = 3 means "from the threshold through the cap", which matches the old "Round 3 through Round 5". The `qa_round`/`review_round` "cap … is exhausted" wording matches the old "Round 4".
- Expected-red sampling (SOP 4a): the manifest exists. I sampled 4 entries and found each test string in its file: e391 :91 "AC-G2-18 …", phase-0-5 :58 "AC-4 …", context-budget :900 "AC8/AC-P2-7 …", e96 :73 "t-when-do-same-fragment-as-dispatch-mechanic …". I ran the 12 affected files individually: 260 tests, 238 pass, 22 fail, and the failing set equals the manifest's 22 entries exactly. ac-execution, agc-adapters, e90 and qa-visual-skill-split are all green.
- No findings.

## Quality

- `recommended` — The spec does not record the rulings that were applied: specs/e393-builder-judge-core.md:50 (the AC-A1 literal still contains the clause that t3 removed), :176 (w2 is "delete", but the ruling was w2', move into the rationale §6) and :315–321 (both items still say "needs human ruling"). The shipped text follows the relayed rulings. However, AC-F2 has qa author the AC-A1 test from the spec, and a test pinning the :50 literal would go red against correct text. Recommend that qa pins the as-ruled bullet (const-05:21) and that the PM or coordinator appends the rulings (i-b + w2', header bump, t3) to the spec's Gate Summary for the record.
- `recommended` — The fan-out manifest on this branch (specs/fanout-e393-builder-judge-core.md:56) still limits const-05 to the §3-end bullet, const-15 to "only when it is the destination", and the rationale to lines 7/10/104–137/165. The approved (i-b)+w2' edits (const-05:5, const-15:12, rationale:216–218) are outside that row, and no widening is visible on this branch. The integrator should confirm the widening is recorded before the ownership check at merge. This is integrator bookkeeping, not a lane defect.
- `optional` — content/constitution-rationale.md:216: the moved D10 paragraph sits under `## §6 — Information hygiene and Generic citation: what an agent may not write`, a heading that does not mention git operations. `See Constitution §6` still resolves correctly, because the git list is under const-15 `## 6. Security & Privacy`. A later heading tweak could name the git list; no action needed now.
- `optional` (existing at base, not introduced) — content/const-04-design-surgical.md:2 "§3.2 still hold" has no §3.2 to point to in the `{chain:false, design:true}` composition, because const-11 is chain-design. The base wording "§3.2 is unchanged" had the same gap, and the newly added "§3 builder ≠ judge" half resolves in every composition.
- Comment check (4b): the diff adds no code comments. The const-01 header HTML comment was shortened per w3 and carries no sensitive data.

## Architecture

There is no architecture spec (mini-chain). The layering is unchanged: no `prompts/constitution-manifest.ts` edit and no new segment, since const-05 and const-15 are both `core`, as the spec's §A destination analysis says. No `tools/`, `gates/`, `schema/`, `bin/` or `scripts/` change. The rationale stays non-normative and one-way.

## Security

No findings. Prose only: no new input crosses a trust boundary, and no secrets or absolute local paths were introduced. The rule change tightens governance; it widens builder ≠ judge from visual-only to every verdict, as the Gate Summary flags.

## Performance

No runtime code changed, so the remaining dimension is prompt size. On HEAD, the context-budget ceiling assertions for lean, sr-stripped, design-arm and teamwork pass, and the non-design ceiling holds. One related assertion fails: the design-only saving floor in the AC8/AC-P2-7 case (test/context-budget.test.mjs:913–915) measures 1999 against a required 2080. This floor drop is inherent to G2-10: the bullet leaves a design-only fragment and t1 shrinks const-04. It is listed in the manifest. Spec §E/§F name the :912 ceiling and :906–907 comments but not this saving floor, so qa should record the floor re-pin as a re-baseline (not a ceiling raise) in the T-E393-06 report. `optional`, informational for qa.

Same-model note: this review ran on opus, the same tier as the sr-engineer pin, so blind spots may be shared. I compensated with scripted exact-substring and composition checks rather than relying on reading alone.

## Verdict

APPROVED — every spec §A–§D site is implemented verbatim (with the human-ruled trims), the edits stay inside the named spans, all four compositions resolve the new anchor, `dist/` shows no diff, and the 22 reds match the expected-red manifest exactly.
