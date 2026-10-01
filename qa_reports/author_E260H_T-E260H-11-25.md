# E260H author evidence (T-E260H-11..25)

Author hops of lane e260h (spec `specs/e260h-test-m-z-eval-comment-trim.md`). This file is the author's record, not the verification: T-E260H-26 is a fresh qa-engineer that re-runs every check. Worktree: `../agent-governance-mcp-lanes/e260h`, base `bdbffaf`.

## T-E260H-11 — proof script

`.current/e260h/proof.mjs` follows the wave-1 script of lane e260d with the spec's differences: the owned set is the AC3 regex over `git ls-files test`; `scope` checks every path changed against base (owned test files must be `M`, everything else must match `specs/e260h-*`, `qa_reports/*E260H*`, `review_reports/*E260H*` or `.current/e260h/**`), untracked files, and the forbidden list; `emit` uses `transpileModule` with `removeComments`, target and module ESNext; `leaves` compares kind and text of every non-JSDoc leaf; `directives`, `form` and `hygiene` compare base and HEAD comments taken from the scanner trivia. The bare-id regex is the wave-1 one, widened to also catch a lone `AC<n>` or `DR<n>`.

Self-test (every edit reverted with `git checkout` afterwards):

| case | edit | result |
|---|---|---|
| no-op at base | none | `scope: ok`, `emit: 0 files, 0 differ`, `>20: 30`, 8-20: 117, `bare-id: 0` (matches the spec's base measurement) |
| A | comment line 3 of `test/token-efficiency.test.mjs` reworded | `emit: 1 files, 0 differ`, `leaves: 1 files, 0 differ`, `proof: PASS` |
| B | string `"node:test"` given a trailing space | `emit` and `leaves` both `1 differ`, `proof: FAIL (emit, leaves)` |
| C | line 3 replaced by a `/* ## … url … sha */` plus an `eslint-disable-line` comment | `directives`, `form` (block comments 0 -> 1, `##` heading) and `hygiene` (url, sha) all fail |
| D | untracked `test/zz-new.test.mjs`, a blank line appended to `test/render-structure.test.mjs` | `scope: 3 bad path(s)` |
| E | first line changed | `form: first line changed` |
| F | a bare `// E123:` line and a home-directory path plus `git log` in a comment | `bare-id: 1`, `hygiene: 2 problem(s)` |

## T-E260H-12 — rationale spec skeleton

`specs/e260h-comment-rationale.md` created with the intro and the Retained blocks table; `node scripts/check-md-tables.mjs` reports 0 malformed tables.

## Trim tasks

One row per task; `proof` is `node .current/e260h/proof.mjs --changed-only` on the task's HEAD (cumulative over every file changed so far).

| task | files | blocks of 8+ trimmed | retained 8–20 | proof |
|---|---|---|---|---|
| T-E260H-13 | `test/release-staging.test.mjs` base lines 1–1500 | 18 (header 36 lines, longest) | 0 | emit/leaves 0 differ; only part-B blocks left over 7 |
| T-E260H-14 | `test/release-staging.test.mjs` base lines 1501–end | 17 (longest 50) | 0 | PASS; file has no block over 7 |
| T-E260H-15 | `test/verify-release.test.mjs` base lines 1–1200 | 10 (header 134 lines, longest) | 0 | PASS for this range; `proof.mjs` hygiene regexes for `git show` and `git log` given word boundaries, since the comment phrase "git logic" tripped the bare substring |
| T-E260H-16 | `test/verify-release.test.mjs` base lines 1201–end | 16 (longest 24) | 0 | PASS; file has no block over 7 |
