# Review — T-E350-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff judged: `git diff fac8990 aecfd29 -- content/skill-pm.md content/const-08-chain-31-mid.md content/coord-03-core-fallback.md`. Spec: `specs/e226-integrator-sop-portable.md`.

## Summary
- `fanout.mjs check --cut` in the PM Manifest-Tier row, in Constitution §3.1 manifest-tier condition 3, and in the coord-03 writer action now takes the `<agc install>` form. So does the coord-03 `feature-rollup.mjs` roll-up (decision C2).
- All four strings (`pm.manifest-row`, `const08.cond3`, `coord03.writer`, `coord03.rollup`) are verbatim, each occurring once. In the word-diff only the path token changes (and the PM row gains its inline definition).
- The three fragments are consistent: the same `<agc install>` token, with the definition given inline only in skill-pm, as the cut decided.
- Verdict: CHANGES_REQUESTED, only for the lane-wide missing expected-red manifest.

## AC Completeness
AC-E350-1 — implemented — `node scripts/` count = 0 in all three files. pm.manifest-row is at content/skill-pm.md:112, const08.cond3 at content/const-08-chain-31-mid.md:4, coord03.rollup at content/coord-03-core-fallback.md:11 and coord03.writer at content/coord-03-core-fallback.md:45. The e296 AC1–AC3 literals (`check --cut specs/fanout-<id>.md <lane> specs/<feature>.md`, `check --cut`) still hold, and only e296 AC6 (the integrator SOP) is red.
AC-E350-2 — source side done. The golden regeneration and budget re-baseline are qa task T-E350-03. Current reds: compose-equivalence (build-full ×4, hook-full, constitution-monolith); context-budget (skill-pm ≤ 4823, constitution ≤ 10523, non-design ≤ 8426, teamwork bundle ≤ 21633); and test/skill-manifest.test.mjs `t-golden-byte-identity`. The build-lite and hook-lite goldens stay green, as expected, because lite does not compose const-08.

## Correctness
- **required** (lane-wide, same finding as review_T-E226-01.md) — the expected-red manifest is missing. This task's reds must be listed in it, including `test/skill-manifest.test.mjs | t-golden-byte-identity (AC1/AC5) …`. That test reads `test/fixtures/compose-golden/skill-coordinator-monolith.txt`, which `scripts/capture-constitution-golden.mjs` regenerates, so it clears with T-E350-03 and no test-file edit. Neither the spec's re-pin table nor the AC-E350-2 proof command (`compose-equivalence`, `e90`, `context-budget`) runs it, so qa should add it to the T-E350-03 run.

## Quality
- **optional** — const-08:4 and coord-03:11/:45 use `<agc install>` without defining it, while skill-pm defines it inline. This is the cut's deliberate choice (it keeps the constitution and teamwork budgets small). The integrator SOP *Tool calls* paragraph and the generic `docs/lane-protocol.md` §5 (`<agc 安裝位置>`) define the term. No change needed.

## Architecture
No architecture spec. The change agrees with the generic lane protocol §5: the agc install form is generic, and a repo addendum may give its own call form. For this repo, addendum §5 line 30 already covers `fanout.mjs`, and line 31 covers `feature-rollup.mjs`.

## Security
No findings. No absolute path; generic placeholder only.

## Performance
No findings. The added text slightly raises the measured skill-pm, constitution and teamwork bundle sizes. T-E350-03 will re-baseline them with zero headroom; this is a budget bookkeeping step, not a runtime cost.

## Verdict
CHANGES_REQUESTED — T-E350-01's text is correct and consistent across all three fragments. The verdict carries only the lane-wide expected-red manifest finding, and that manifest must include the skill-manifest golden test.

## Round 2 — APPROVED — by code-reviewer

Diff judged: `aecfd29..dccf3f7` (sr reply to round 1). `git diff aecfd29 dccf3f7 --stat` touches no `content/**`, `docs/**`, `test/**` or source file. The only non-state changes are `qa_reports/expected-red_e226-integrator-sop-portable.txt` (new, 49 lines) and one new `pending-ticket` block, E226-NEW-3, in `.current/e226/pending-tickets.md`. The round-1 text verdicts therefore still apply unchanged. Reviewer tier opus.

## Summary
- Round 1's single `required` finding (missing expected-red manifest, SOP step 4a) is fixed. The manifest exists, parses, and matches the actual red set exactly.
- Full serial suite on the lane HEAD (`node --test --test-concurrency=1 test/*.test.mjs`): 3557 tests, 3528 pass, 27 fail. The 27 failing test names are exactly the 27 manifest rows: 0 unlisted reds, 0 listed-but-green rows.
- Count reconciliation: round 1's "about 28" double-counted one test. `test/e178a-integrator-role.test.mjs` AC13 is owned by both T-E226-01 (`:349`) and T-E349-01 (`:348`, `sop.verifier-build`), and the per-task tallies were 12 + 5 + 11 = 28. There are 27 unique tests. The sr's 27 is correct.
- Recommended follow-up from round 1 is filed as E226-NEW-3 (P3, `depends_on: [E349]`). Its body matches the finding.
- Verdict: APPROVED.

## AC Completeness
Unchanged from round 1. No content changed after `aecfd29`, so every AC verdict recorded in round 1 stands.

## Correctness
- Round-1 `required` finding: **resolved**. `qa_reports/expected-red_e226-integrator-sop-portable.txt` has 27 data rows in `<relative test file path> | <exact test name>` form. Blank and `#` lines are comments, per sr SOP 7a and qa SOP 2a. A parse script checked every row: each has exactly one ` | ` separator, the file exists, there are no duplicates, and the test name is locatable in that file. SOP 4a sampling covered all 27 rows, not only 3.
- Per-file red counts, each file run on its own: e178a 3, e285 1, e286 1, e292-integrator-sop 3, e295 4, e296 1, e329 3, context-budget 4, compose-equivalence 6, skill-manifest 1 (total 27). The three other e292-* files are green (8/8, 51/51, 15/15).
- Both round-1 additions are present: e178a AC9 and skill-manifest `t-golden-byte-identity (AC1/AC5)`.
- The NOT-OWNED header comment is correct. compose-equivalence ×6 and skill-manifest ×1 clear only when qa regenerates the goldens in T-E350-03. The comment says those test files are never edited, and it tells qa to add `test/skill-manifest.test.mjs` to the T-E350-03 run, since the AC-E350-2 proof command does not run it.
- The suite run left the worktree clean: `git status --porcelain` shows only the lane's own handoff/dispatch state.
- This task's reds are all listed: the four context-budget caps (skill-pm ≤ 4823, design-arm constitution ≤ 10523, teamwork bundle ≤ 21633, non-design ≤ 8426), the six compose-equivalence goldens, and skill-manifest `t-golden-byte-identity` (the round-1 addition). All clear in T-E350-03 (re-baseline plus golden regeneration).

## Quality
No findings. The comment headers name the owning qa re-pin task for each group (T-E226-03 / T-E349-02 / T-E226-05, T-E350-03), which is the grouping style sr SOP 7a asks for.

## Architecture
No architecture spec exists for this feature. Both new files are inside the lane's bookkeeping bounds (`qa_reports/` basename carries the lane name; `.current/e226/`).

## Security
No findings. Plain-text manifest and a ticket note. No paths outside the repo, no secrets, nothing sensitive in the comments.

## Performance
No findings. No runtime code changed.

## Verdict
APPROVED — the only blocking finding from round 1 is resolved, the manifest is parseable and matches the actual 27-test red set exactly, and no content changed after round 1.
