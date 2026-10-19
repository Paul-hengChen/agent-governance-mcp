covers: T-E336-01, T-E294-01, T-E285-01, T-E336-02, T-E294-02, T-E285-02

# QA review — lane e285, feature e285-integrator-session-handoff

Spec: `specs/e285-integrator-session-handoff.md`. Code review: `review_reports/review_T-E285-01.md` (round 2 APPROVED). Dispatch base `93ed15c`. Reviewer tier: sonnet (Task-spawned).

## Phase log

- Phase 0.5: skipped (no expected-red manifest declared). The known reds at hand-off (e297 AC1/AC7, compose-equivalence 1-11, skill-manifest golden byte identity, context-budget AC2 / AC8 x3) were all caused by the E336 command-form change and are resolved below.
- Phase 1.5: skipped (no Visual Baselines declared). Copy Audit / Visual Audit: the spec's Copy / Strings and Visual Tokens sections carry no rendered UI strings or tokens for this docs/SOP lane; the SOP wording was checked by the AC proofs below.
- Phase 3a placement: the dispatch brief pre-authorized creation of the three new test files; acted on that branch.

## T-E336-02 — re-pins and generated artifacts (AC-E336-4)

- `test/e297-main-protected-sop.test.mjs`: AC1 Stage 6 pattern and AC7 const-15 pinned sentence re-pinned from `git pull --ff-only` to `git -c pull.rebase=false pull --ff-only`. Meaning unchanged (read-plus-ff on `main`); only the command form moved.
- Goldens regenerated with `npm run build && node scripts/capture-constitution-golden.mjs` (never hand-edited): 12 files, 1 line each. Normalized hunk check (strip +/- prefix, map the portable form back to the plain form, count lines) leaves every line in an even count, so each hunk is exactly the command-form substitution. Note: the spec's literal proof pipeline keeps the diff `+`/`-` prefix, so `uniq -u` can never print nothing; the prefix-stripped form was used.
- `test/context-budget.test.mjs` caps re-measured (exact measured size, zero headroom, the file's cap rule). Reason for every change: E336 turns `git pull --ff-only` into `git -c pull.rebase=false pull --ff-only` (+22 chars per site, ~5.5 tokens at chars/4).

| cap | old | new | delta | reason |
|---|---|---|---|---|
| AC2 lean always-on bundle | 5717 | 5723 | +6 | one const-15 site (rounding of +22 chars) |
| AC8 rationale-stripped design-arm constitution | 10518 | 10523 | +5 | one const-15 site |
| AC8 teamwork coordinator bundle | 21623 | 21633 | +10 | two sites (const-15 + coord-03) |
| AC8 non-design constitution | 8420 | 8426 | +6 | one const-15 site |

The cap comments were updated in the file's existing style (old to new plus the E336 reason).

## New tests

- `test/e336-portable-pull.test.mjs` (7 tests): AC-E336-1 per-file counts 0 plain / 1, 1, 4, 6 portable, the two bare grant-name mentions kept, AC-E336-3 reason clause in `## Git operations` only.
- `test/e294-lane-enterworktree.test.mjs` (6 tests): AC-E294-1, -2, -3 on the `## 1.` slice; AC-E294-5 structural half (no trimmed section-1 line over 20 chars is a substring of `PROMPT_TEMPLATE_3B` or of the in-test frozen `E289_CANDIDATE`; every `EnterWorktree` line is at least 60 chars; fragments never form a whole line). No fixed base sha, no real `specs/fanout-*.md` content.
- `test/e285-integrator-session-handoff.test.mjs` (8 tests): AC-E285-1 to AC-E285-7, section-scoped.

## AC to test map

| AC | test |
|---|---|
| AC-E285-1 | e285 test "AC-E285-1" |
| AC-E285-2 | e285 test "AC-E285-2" |
| AC-E285-3 | e285 tests "AC-E285-3" (two) |
| AC-E285-4 | e285 test "AC-E285-4" |
| AC-E285-5 | e285 test "AC-E285-5" |
| AC-E285-6 | e285 test "AC-E285-6" |
| AC-E285-7 | e285 test "AC-E285-7" |
| AC-E294-1, -2, -3 | e294 tests "AC-E294-1/2/3" |
| AC-E294-4 | review-time diff (below) |
| AC-E294-5 | e294 tests "AC-E294-5" (three) plus `test/e177a-manifest.test.mjs` AC7 unchanged and green |
| AC-E336-1 | e336 tests "AC-E336-1" (five) |
| AC-E336-2 | review-time diff (below) |
| AC-E336-3 | e336 tests "AC-E336-3" (two) |
| AC-E336-4 | e297 AC1/AC7, context-budget AC2/AC8, compose-equivalence, e90, skill-manifest: 108/108 |
| AC-HC-1 | e296 + e177a unchanged vs base and green |
| AC-HC-2 | e178a, e246, e288, e329, e286, e295 green with no edits |
| AC-HC-3 | below |
| AC-HC-4 | final suite, recorded at the end of this file |

## AC Execution Log

Section extracts use the spec's `sec` / `need` helpers; "prints nothing" means no `missing:` line.

| AC | command | output | verdict |
|---|---|---|---|
| AC-E285-1 | `need '## Stage 6' content/skill-integrator.md 'handoff <manifest> --closing' '待人類決定' 'not overridable'` | nothing | pass |
| AC-E285-2 | `grep -c 'next-step recommendation'`; `need '## Stage 6' ... 'new session' 'handoff --check <manifest>' 'never proposes the next wave' 'continue'` | `0`; nothing | pass |
| AC-E285-3 | `grep -c '`接手 <manifest>`'`; `need '## Take-over' ...`; `grep -n '^## Take-over\|^## Status (any time)'` | `4`; nothing; lines 228 and 237 (adjacent headings) | pass |
| AC-E285-4 | `need '## Stage 4' ... '2 hours' ...`; `grep -c 're-arm from the printed baseline, always'` | nothing; `1` | pass |
| AC-E285-5 | `need '### 5a' ... 'MUST' 'pre-push' 'never in your own context'`; `need '## Output' ... 'differences'`; last-line check | nothing; nothing; `1` | pass |
| AC-E285-6 | `need '## Lifecycle' ... "another role's work" 'new session' 'advisory'` | nothing | pass |
| AC-E285-7 | `grep -o 'fanout.mjs handoff[^`]*' \| sort -u`; `node scripts/fanout.mjs 2>&1 \| grep -c 'handoff \[--check\] <manifest>'` | exactly the three allowed shapes; `1` | pass |
| AC-E294-1 | `need '## 1.' docs/lane-protocol.md 'EnterWorktree' 'path' 'feature start' 'pwd' 'git branch --show-current'` | nothing | pass |
| AC-E294-2 | `need '## 1.' ... 'cd <worktree> &&' '$TMPDIR'`; EnterWorktree-and-cd line count | nothing; `1` | pass |
| AC-E294-3 | `need '## 1.' ... 'git -C <primary>' '一條一條'` | nothing | pass |
| AC-E294-4 | section 2-to-end and head-through-`## 1.` compared against `93ed15c` (script using `git show`) | both identical | pass |
| AC-E294-5 | `node --test --test-name-pattern AC7 test/e177a-manifest.test.mjs` (part of the 158/158 owned-test run); added section-1 lines of 21 to 59 bytes | green; none | pass |
| AC-E336-1 | `grep -c 'git pull --ff-only'` over the four files; portable counts | `:0` x4; `1`, `1`, `4`, `6` | pass |
| AC-E336-2 | for each borrowed file, base text with the substitution applied compared with the current file | identical x3 | pass |
| AC-E336-3 | `need '## Git operations' ... 'pull.rebase' '.current/'` | nothing | pass |
| AC-E336-4 | `node --test` on e297, context-budget, compose-equivalence, e90, skill-manifest | 108 pass, 0 fail | pass |
| AC-HC-1 | diff of e296 and e177a against base; `node --test` both | no diff; green | pass |
| AC-HC-2 | `node --test` e178a e246 e288 e329 e286 e295 e130 skill-frontmatter render-structure e296 e177a | 158 pass, 0 fail; e178a unchanged | pass |
| AC-HC-3 | `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w7.md e285 specs/e285-integrator-session-handoff.md` | exit 0, `0 out of bounds`; every path in the diff list against `93ed15c` sits in the e285 owned set | pass |

Other gates: `npm run build` zero errors (including check:transitions-sync); `npm audit --audit-level=high` reports no high or critical findings (2 low, 6 moderate only).

## Observations

- `review_T-E285-01.md` carried two optional wording notes (skill-integrator.md); not QA-blocking, not actioned.
- The spec's AC-E336-4 golden-substitution proof pipeline is unsatisfiable as literally written (see above); recommend a one-line spec fix by PM when convenient. Not a FAIL ground.

## Verdict

PASS, subject to the final full-suite result recorded below.

## Final full suite (AC-HC-4)

`node scripts/test-lock.mjs -- npm test` at commit d194776 (clean tree, `git status --porcelain` empty): 3430 tests, 3428 pass, 0 fail, exit 0. This evidence line is the only change after that commit.
