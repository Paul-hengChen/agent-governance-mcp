# Review — T-E260G-09

Round 1 — CHANGES_REQUESTED (lane-wide) — by code-reviewer (opus). Diff range `bdbffaf..a116e4a`, lane e260g.

## Summary
- Adds `.current/e260g/proof.mjs` (156 lines), the comment-only proof for AC1-AC4, AC7, AC8. The commit touches only that file.
- I ran it at `a116e4a`: `scope: ok`, `emit: 25 files, 0 differ`, `tokens: 25 files, 0 differ`, `directives: 25 files, 0 lost`, `>20: 0 unexpected`, `8-20: 0 block(s)`, `bare-id: 0`, `form: ok`, `proof: PASS`.
- I ran 13 negative controls of my own on a scratch clone, not on the worktree. Each check fails when it should, with three gaps (listed under Correctness).
- This task's own verdict: no required finding. The lane verdict is CHANGES_REQUESTED, because of required findings in T-E260G-10, T-E260G-12 and T-E260G-15.
- Same-model note: the qa author commits name Claude Sonnet 5.5, and this review ran on Opus, so the two have different blind spots.

## AC Completeness
AC1 — implemented — proof.mjs:66-73 (transpileModule with the tsconfig options and `removeComments: true`, base blob vs working tree)
AC2 — implemented — proof.mjs:76-89 (leaf tokens, JSDoc skipped), proof.mjs:108-115 (directive counts)
AC3 — implemented — proof.mjs:54-63 (name-status vs base, untracked test files, forbidden pathspecs)
AC4 — implemented — proof.mjs:118-132 (`analyzeText` from dist/tools/comment-scan.js)
AC5 — implemented — proof.mjs:133-136 (`--list-mid`)
AC7 — partial (instrument) — proof.mjs:23 checks only bare `E<n>` ids; see Correctness. I ran a wider check by hand (see T-E260G-10..16).
AC8 — implemented — proof.mjs:140-153

**Retained blocks** (AC5, copied from `specs/e260g-comment-rationale.md`):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
Negative controls I ran on a `git clone --shared` scratch copy at `a116e4a`, with `--base bdbffaf`:

| control | expected | result |
|---|---|---|
| code edit (`assert.x(` to `assert.ok(`) | emit, tokens fail | FAIL (emit, tokens) |
| string literal edit | emit, tokens fail | FAIL (emit, tokens) |
| 22-line comment block added | >20 fails | FAIL (>20) |
| `// E92` line added | bare-id fails | FAIL (bare-id) |
| `// ## Heading` added | form fails | FAIL (form) |
| `/* */` block added | form fails | FAIL (form) |
| first line changed | form fails | FAIL (form) |
| `eslint-disable` comment deleted | directives fails | FAIL (directives) |
| docs/backlog.md edited | scope fails | FAIL (scope) |
| non-lane `test/e22-stale-notify.test.mjs` edited | scope fails | FAIL (scope) |
| `test/eval/**` file edited | scope fails | FAIL (scope) |
| untracked new test file | scope fails | FAIL (scope) |
| `// AC3` line added | bare-id should fail | **PASS (gap)** |
| whitespace-only code reflow | AC "no reflow" | **PASS (gap)** |

- recommended — proof.mjs:23 — `BARE_ID` matches only `E<n>` ids. An id-only line such as `// AC3`, `// DR-3` or `// T-E123A3-08` passes, but AC7 also forbids bare AC and DR references. I made up for this by hand: a widened scan of the 25 changed files for id-only lines matching `(E|AC|DR|T-)…\d` finds 3 hits. All 3 continue a sentence from the line above (findings in T-E260G-10, -13, -15).
- recommended — proof.mjs (no check) — AC7's "no comment this lane touches cites an untracked path" is not checked by the script. A hand scan of the paths cited in added comment lines found one untracked path, in T-E260G-12.
- optional — proof.mjs:72, :88 — emit and tokens are both blind to whitespace, so a pure reflow of code lines passes (the spec's Out of Scope says "No reflow of code lines"). A hand check found none: every added or removed line in the 25 test diffs is a comment line or a blank line.
- optional — the negative control was run in place on worktree files and then restored (pending note (a)), not on a scratch copy as the spec and task text say. I see no leftover from it: `git status` shows only `.current/e260g/` server files, the scope check passes for every non-lane test path, and my own scratch-copy controls above reproduce the failure modes.

## Quality
No findings. The script is dependency-free, has no absolute paths, and its flags match the spec. `.current/e260g/base-sha` is not tracked, so a fresh clone needs `--base bdbffaf`, and the error message says so.

## Architecture
No architecture spec (the spec says no architect hop). The proof follows the e260d wave-1 shape, as specified.

## Security
No findings. `execFileSync("git", …)` is called with argument arrays, so there is no shell interpolation.

## Performance
No findings. It is a one-shot script, and each of the 25 files is transpiled twice.

## Verdict
CHANGES_REQUESTED (lane-wide) — this task has no required finding, but the round carries required accuracy and citation findings in T-E260G-10, T-E260G-12 and T-E260G-15.
