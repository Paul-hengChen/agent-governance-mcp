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
