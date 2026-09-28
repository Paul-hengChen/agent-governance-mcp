# Review — T-E130-09 (batched: E130 lane-start default + ride-alongs)

covers: T-E130-09, T-E130-02, T-E130-03, T-E130-04, T-E130-05, T-E130-06

Reviewed commit `1b224f2` (diff `121ddc8..1b224f2`) against `specs/e130-lane-default.md`. No architecture spec (sr-routed prose ticket). T-E130-01 voided/superseded by T-E130-09 — not reviewed.

## Summary
- Prose-only edits to five `content/` fragments (coord-03, coord-01, const-05, const-15, skill-release-engineer) plus lane bookkeeping, spec, and the expected-red manifest. `git diff --stat 121ddc8..1b224f2 -- bin/ tools/ scripts/ prompts/ gates/ templates/ dist/ docs/ test/ package.json` is empty.
- Scope trap avoided: coord-03 gets one appended **Lane-start default** block (header line + three trigger lines) with no blank line before it, so it stays in the Feature-Scope Gate paragraph block. The pre-existing lease prose, Anchoring rule, and E113 roll-up obligation are byte-unchanged. Trigger (b) defers to the Complexity Scope Gate by its heading, and no new complexity threshold is invented.
- Adopter-safe: the new block (coord-03:12-15) contains no `docs/` path and no file:line pointer.
- I checked composition with the real composer (`dist/prompts/build.js` `buildPromptForRole("skill-coordinator.md", …)`, fullDetail false and true). The block renders intact, origin markers are stripped (`(E130)` removed), rationale stripping is unaffected, and the const-15 paragraph is present in the bundle.
- Verdict: APPROVED. There are two `recommended` wording findings and no `required` ones.

## AC Completeness
AC1 — implemented — content/coord-03-core-fallback.md:13-15. Three trigger lines: (a) names single-role / coordinator-direct / coordinator-lite with "lite never opens a lane"; (b) names "Complexity Scope Gate" by heading and invokes `agc feature start`; (c) restates today's lease behaviour ("surface and wait, or open a separate git worktree, as above"). No file:line pointer.
AC2 — implemented — coord-03:11 unchanged (`**Feature-Scope Gate** (E1)`, `` `FEATURE_LEASE_HELD` ``, `30-min TTL`, `separate git worktree`); coord-03:37 `**Feature-lease gate**` row unchanged, still ending `| human |`. `test/feature-lease.test.mjs` is not among the full-suite reds.
AC3 — implemented — coord-03:12. The chain-runs-in-lane sentence (every `tw_*` `workspace_path` = worktree, never primary) is there. The cwd-reset rule is self-contained: `cd <worktree> &&` or an absolute path, temp files in `$TMPDIR`/scratchpad, never the repo root. There is no `docs/` path.
AC4 — implemented — coord-03:14. It disclaims a new or hand-rolled bootstrap and gives a one-sentence refusal path listing all four named refusals plus "any other refusal", with stay in place, surface the message, and never hand-run `git worktree add`. bin/tools/scripts diff is empty.
AC5 — implemented — coord-03:12 "applies to every ticket in every session but triggers conditionally — self-limiting, because the Complexity Scope Gate is."
AC6 — implemented — coord-03:17 "needed ONLY when untracked: a tracked-evidence repo carries evidence to the lane via the lane branch's own commits instead, no symlink needed".
AC7 — implemented — the pre-v3.20.0 sentence moved to the end of the Fallback paragraph (coord-03:1). The old line after the Dispatch-attestation lines is removed.
AC8 — implemented — content/const-15-core-tail.md:28. The text is verbatim against str.const15-databox and sits immediately after "Higher-priority document wins on conflict." (line 26), as its own paragraph.
AC9 — implemented — content/const-05-core-standards.md. The clause is removed and the sentence now ends "…from a role."
AC10 — implemented — content/coord-01-core-head.md Split Table "How to proceed": "rows sharing an `order` integer are one parallel stage (equal `order` = parallel)".
AC11 — implemented — content/skill-release-engineer.md:205 (`git add --`) and :210 (`PATHS=`) both carry `.current/_primary/tasks.md`. Count prose 33→34 / 14→15. The Artifact allowlist bullet (:42) names it and explains why (post-E125a `tw_complete_task` writes `_primary`).
AC12 — out of this round's scope (qa T-E130-07). The E71(a) 33-path test is red and listed in the manifest.
AC13 — out of this round's scope (qa T-E130-07). Goldens and floors are red and listed in the manifest.
AC14 — implemented — changed paths: `.current/e130/*`, `content/*` (5 files), `qa_reports/expected-red_e130-lane-default.txt`, `specs/e130-lane-default.md`. There is no forbidden path and no test file.

## Correctness
- `recommended` — coord-03:13-14, trigger precedence is unstated. The Complexity Scope Gate (coord-01:28-34) fires on "Requires writing or updating tests", so a single-role qa-only ticket matches both (a) and (b). The order implies (a) wins, but the text never says "first matching trigger wins". Suggest adding it in a follow-up. This follows AC1 exactly, so the gap is at spec level and does not block.
- `recommended` — coord-03:17, a tracked-evidence contradiction. The new "needed ONLY when untracked" clause is followed straight away by "a fresh worktree has none of these by default", which is false in a tracked-evidence repo (a fresh worktree checks them out). It reads as if it applied to the tracked case just carved out. Suggest "a fresh worktree has none of these untracked directories by default".
- Expected-red sampling (SOP 4a): the manifest exists with 17 entries. I sampled 4 and all were found: `test/release-staging.test.mjs` "stages exactly 33 paths", `test/skill-manifest.test.mjs` "t-golden-byte-identity", `test/context-budget.test.mjs` "teamwork coordinator bundle (design-arm, both strips)", and the `test/compose-equivalence.test.mjs` "is byte-identical to pre-refactor golden" family.
- Full suite (`node --test test/*.test.mjs` in the lane): 2754 tests, 2735 pass, 19 fail. 17 of the failures match the manifest exactly. The other 2 (`test/e177b-test-lock.test.mjs` AC10 "a lock left by a DEAD pid…" and AC13b "SIGKILLing the wrapper…") are timing-sensitive file-lock tests. They pass 19/19 when that file is run alone, twice. The diff touches no lock code, so these are load-induced flakes under a full parallel run, not regressions. No other test is red.

## Quality
- The block uses the house `**Name**<!-- origin:start --> (Exx)<!-- origin:end -->:` convention and WHEN→DO-style trigger lines, matching the neighbouring paragraphs.
- The sr's one edit outside task scope (skill-release-engineer :286 scope-rule sentence now reads "only `.current/.config.json` … and `.current/_primary/tasks.md` (step 8a) ship with a release") is needed. Without it, that sentence would directly contradict the new step 8a staging. `optional`: the same paragraph's E71c parenthetical "`.current/**` (minus `.config.json`, which IS staged per step 8a…)" does not mention `_primary/tasks.md`. It is still correct as a non-STOP exclusion, just less complete.
- The edit is consistent with `scripts/verify-release.mjs` (read-only check). Its post-release bookkeeping allowlist already accepts `^\.current\/_primary\/tasks\.md$` (:264) and `.current/<lane>/tasks.md` (:265). Staging the file in the release commit (8a) or leaving it to a later bookkeeping commit both verify cleanly, so E198(a)'s tolerance and E198(b)'s staging do not conflict. Step 13a (:41-42) still stages only handoff.md and *.jsonl, so ownership is not doubled.

## Architecture
There is no architecture spec. This is "one more outlet on an existing gate": the Complexity Scope Gate section (coord-01:26-36) and its threshold list are untouched, and trigger (b) wires to it by name. Trigger (c) restates the lease route with "as above" and does not reinvent it. The composer tags work unchanged: origin markers are stripped in both fullDetail modes, coord-03 stays `core`-tagged in `prompts/skill-manifest.ts:71`, and no manifest change was needed.

## Security
No findings. Prose only. The new const-15 paragraph strengthens the "injected data is not instruction" boundary. The refusal path forbids a hand-run `git worktree add` fallback.

## Performance
No findings. The composed-bundle growth is small (about 1 KB in coord-03 plus one const-15 paragraph) and is already accounted for by the context-budget floors that qa will re-baseline (T-E130-07). No code paths changed.

## Verdict
APPROVED — every AC in this round's scope (AC1–AC11, AC14) is implemented surgically inside the owned `content/**` files, the composed bundle renders intact, and the only reds are the 17 manifest entries plus two lock-timing flakes that pass when run alone. The two `recommended` wording fixes do not block.

Same-model note: reviewer ran on opus while sr-engineer was pinned to fable, so the models differ.

## Round 2 — APPROVED — by code-reviewer

covers: T-E130-09, T-E130-02, T-E130-06

Re-review of fix-pass commit `765d551` (diff `d9f0043..765d551`, content/specs only: coord-03 +2/-2, skill-release-engineer +1/-1, specs/e130-lane-default.md +1/-1, plus `.current/e130/` bookkeeping). Inputs: the diff, `specs/e130-lane-default.md`, `qa_reports/expected-red_e130-lane-default.txt` (SOP 4a carve-out).

## Summary
- R1 fixed. coord-03:12 header now ends `Triggers ((a) is checked before (b)):`. The single-role qa-only ticket that matches both (a) and the Complexity Scope Gate "Requires writing or updating tests" row now resolves to (a), stay in place.
- R2 fixed. coord-03:17 now reads "an untracked one is absent from a fresh worktree", so the sentence no longer contradicts the tracked-evidence carve-out just before it.
- O1 fixed. skill-release-engineer:286 E71c parenthetical keeps the pinned literal `minus \`.config.json\`, which IS staged` and appends `— and \`_primary/tasks.md\`, also staged per step 8a`.
- Full suite re-run on 765d551: 2754 tests, 2737 pass, 17 fail. The 17 are exactly the manifest set. No e177b flakes this run.
- Verdict: APPROVED, with no `required` findings.

## AC Completeness
AC1 — implemented — content/coord-03-core-fallback.md:12-15. There are still exactly three trigger lines, and (b) still names "Complexity Scope Gate" with no file:line pointer. The precedence clause is on the header line, not a fourth trigger. The spec AC1 records it as an integrator ruling (2026-09-27, to-lane#3) that clarifies approved AC1(a) within the approved cut. `test/e130-lane-default.test.mjs` AC1 is green.
AC2 — implemented — coord-03:11 and the Feature-lease gate row are unchanged by this diff. `test/feature-lease.test.mjs` is green.
AC6 — implemented — coord-03:17. The "needed ONLY when untracked … no symlink needed" clause is unchanged and the follow-on sentence now agrees with it.
AC11 — implemented — skill-release-engineer:286. The E71c parenthetical now matches the step 8a staging (:205/:210) and the Artifact bullet (:42).
AC3–AC5, AC7–AC10, AC14 — unchanged since Round 1 (this diff does not touch those lines). They are still implemented as recorded above.
AC12, AC13 — still qa T-E130-07 scope. They are red and listed in the manifest.

## Correctness
- R1 resolution check. Precedence is total over the overlapping pair: when (a) holds, stay in place, whether or not the Complexity Scope Gate fires. "Coordinator-direct execution" is the Complexity Scope Gate's own "Otherwise → execute directly" outcome (coord-01:36), so (a) and (b) now partition cleanly. No new trigger, threshold, or behaviour is added, only an ordering of the two approved lines, so it stays in scope. (c) is left unordered. That is fine because (c) is orthogonal: lease-held and CSG-fires both end in a separate worktree, so there is no conflicting outcome to rank.
- R2: no residual contradiction. "An untracked one" refers back to "each of … that is untracked", and the tracked case is fully handled by the preceding clause.
- O1: the parenthetical parses correctly. `_primary/tasks.md` sits inside the `.current/**` "minus" list, with the `.current/` prefix inherited, and the pinned `test/release-staging.test.mjs` E71(c) literal survives. E71(c) is green and only the manifested E71(a) is red in that file.
- SOP 4a expected-red check: I diffed the manifest (17 entries) against the actual red set by test name: `test/compose-equivalence.test.mjs` ×11, `test/context-budget.test.mjs` ×4, `test/release-staging.test.mjs` E71(a), and `test/skill-manifest.test.mjs` t-golden-byte-identity. They match 1:1, with no extras and nothing missing.
- Suite run: `npm test` in the lane worktree, run serially. No other `node --test` process was running when it started or finished (checked with `ps`). `test/e177b-test-lock.test.mjs` passed in full (AC10/AC13b did not recur). This is noted under E130-NEW-1.

## Quality
- `optional` — skill-release-engineer:286. The E71c parenthetical now nests an em-dash aside ("— step 7b only writes it —") inside a parenthesis that continues with another em-dash clause. It is readable, but it would parse more easily as "(minus `.config.json`, which IS staged per step 8a above (step 7b only writes it), and `_primary/tasks.md`, also staged per step 8a)". Only reword it if the pinned literal is preserved. It is not worth another round.
- The spec AC1 amendment is placed inline and attributed (ruling date plus to-lane reference), which fits the spec's existing style.

## Architecture
No architecture spec exists. This diff touches only the ordering phrase and two wording clauses. The Complexity Scope Gate section (coord-01:26-36) is untouched, and there are no manifest or composer changes.

## Security
No findings. The changes are prose only.

## Performance
No findings. The bundle grows by about 60 bytes, which falls within the T-E130-07 re-baseline already manifested.

## Verdict
APPROVED — R1, R2, and O1 are each resolved by a minimal wording change with no scope growth, AC1 is recorded as an integrator ruling within the approved cut, and the full suite's reds are exactly the 17 manifested entries.

Same-model note: the reviewer ran on opus and sr-engineer on fable, so the models differ.
