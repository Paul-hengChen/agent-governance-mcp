# Judge report — T-E462-10 (e462-stale-comments-wording)

covers: T-E462-10, T-E462-11

## Round 1 — APPROVED — by code-reviewer

Review report: `review_reports/review_T-E462-10.md`. AC9 amendment round (base `4620ebc`, the round-1 PASS of T-E462-01..09). Full suite: `node scripts/test-lock.mjs -- npm test` on a clean tree at 9bb4a8f (this round's claim/checkpoint state commit on top of 678a24d), Node 22: 4699 tests, 4697 pass, 0 fail, 0 cancelled, 2 skipped, exit 0. The two skips are the history-dependent `test/e130-lane-default.test.mjs` AC4 / AC14 checks (commit 121ddc8 not resolvable), loud `t.skip`, not this feature's tests and not manifest rows; e108 AC2 green in this run (no rerun needed). `git status --porcelain` after the suite showed only this round's new review report.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e462-stale-comments-wording.txt`: 24 entry rows (22 from T-E462-01 / T-E462-02, judged green at `4620ebc`, plus the 2 AC9 rows appended by T-E462-10). Actual reds in the full suite: 0.

- `test/e462-stale-comments-wording.test.mjs` | AC9 tools/handoff-orchestrator.ts no longer calls the completion-evidence gate a QA gate — green (ok 3037) — scenario test, now green — built (T-E462-11, tools/handoff-orchestrator.ts:737-742). Red against the `4620ebc` source in a scratch copy, as the manifest says.
- `test/e462-stale-comments-wording.test.mjs` | AC9 gates/visual.ts source-credibility comment names the pm to architect or qa-engineer build entry — green (ok 3038) — scenario test, now green — built (T-E462-11, gates/visual.ts:862). Red against the `4620ebc` source in a scratch copy.
- The 22 earlier rows — green (suite 0 fail); unchanged since the round-1 disposition in `qa_reports/review_T-E462-01.md`.
- Actual reds not on the manifest: none.

## AC Execution Log

AC9 is the only scenario reopened by the amendment (no ticket file; the spec's AC stands in). Run in the worktree at 678a24d / 9bb4a8f; scratch scripts and the scratch copy live outside the worktree.

| AC | command | raw outcome | result |
|---|---|---|---|
| AC9 proof (resident) | `node --test --test-name-pattern "^AC9 " test/e462-stale-comments-wording.test.mjs` | exit 0; tests 2, pass 2, fail 0 | pass |
| AC9 proof (transpile) | scratch script: `ts.transpileModule` (`removeComments: true`, target/module ESNext) of `tools/handoff-orchestrator.ts`, `gates/visual.ts`, `gates/expected-red.ts` at `4620ebc` (via `git show`, in memory) and HEAD | `SAME` ×3 (53409/53409, 20754/20754, 2513/2513 chars), exit 0 — no DIFF | pass |
| AC9 proof (comment scan, HEAD) | the spec's scan command verbatim, from the worktree after `npm run build` (base `83ca8c0`) | 7 warnings in 5 files; no `gates/expected-red.ts` line, no `tools/handoff-orchestrator.ts` line | pass |
| AC9 proof (comment scan, `4620ebc`) | same scan logic evaluated on the committed `4620ebc` tree (scratch script: `git diff -U0 … 83ca8c0 4620ebc` added lines + `git show 4620ebc:<path>` blobs, same `dist/` scanner); cross-checked by the same script on `HEAD`, which reproduced the worktree scan exactly | 8 warnings; the HEAD set equals this set minus `gates/expected-red.ts:1 long-block 8 lines (limit 7)` — no line at HEAD that `4620ebc` did not print | pass |
| AC9 (tests fail if old phrases return) | scratch copy of the worktree (`node_modules` symlinked), one mutation at a time, AC9 proof re-run, restored | M1 `QA completion-evidence gate` restored → test 1 red; M2 `per-id QA` / `evidence` re-wrapped across two comment lines → test 1 red; M3 `pm to architect or sr-engineer hop` restored → test 2 red; M4 edge renamed with no `qa-engineer` → test 2 red; restored control → exit 0. Both `4620ebc` source files in the copy → 0/2 pass. Never applied to the worktree | pass |
| AC9 (comment-only, no `chain_path`, no bare ticket id) | `git diff -U0 4620ebc...HEAD -- tools gates test` saved to scratch, `grep` of its `+` lines for `chain_path` or `\b(E\|T-E)[0-9]{2,}` | no match (grep exit 1); transpile SAME ×3 above | pass |
| AC9 scope | `git log --stat 4620ebc..HEAD`; `node scripts/fanout.mjs check --cut specs/fanout-pre-v5-w2.md e462 specs/e462-stale-comments-wording.md` | sr commit 8471f7a = the three source files + 7 `dist/` files only, no test; qa commit bc5f9b4 = AC9 tests + two qa_reports files + state; pm db08c85 / ac22ed7 = spec + `.current/e462/`; fanout exit 0, "2 ticket(s), 20 token(s), 0 out of bounds" | pass |
| AC9 build | `npm run build`, then `git status --porcelain` | build OK (check:version, check:transitions-sync OK); status showed only this round's `.current/e462/` claim write — `dist/` equals build output | pass |
| AC8 (re-confirmed) | `node scripts/test-lock.mjs -- npm test` | exit 0; `# tests 4699`, `# pass 4697`, `# fail 0`, `# cancelled 0`, `# skipped 2` (e130 AC4 / AC14 history skips) | pass |

Other checks: `npm audit --audit-level=high` exit 0; `node bin/agc-init.mjs check` exit 0 (OK 4.23.0, adapters current; one advisory: `gates/visual.ts high-ratio 31%`, pre-existing, kept — see the review report).
## 2026-11-25T11:29:17.178Z — PASS — by code-reviewer

suite-result: 4697/4699 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (AC9 amendment round, base 4620ebc). AC9 (a) tools/handoff-orchestrator.ts:737-742 says 'Completion-evidence gate' / 'per-id evidence in the judge report on disk', other clauses verbatim, bare ids dropped, block 6+1 lines; (b) gates/visual.ts:862 names 'pm to architect or qa-engineer hop', matching isBuildEntry; (c) gates/expected-red.ts header joined to 7 lines, wording unchanged. transpileModule(removeComments, ESNext) SAME x3 vs 4620ebc. Spec comment scan vs 83ca8c0: HEAD prints 7 warnings = the 4620ebc set (8) minus 'gates/expected-red.ts:1 long-block 8 lines'; nothing new. AC9 proof 2/2 green; both tests red on 4620ebc sources and under 4 scratch mutations (phrase restored, phrase re-wrapped, old edge restored, qa-engineer removed). No chain_path or ticket id in added lines. Scope: sr commit 8471f7a = 3 source files + dist only, no test edited; fanout check --cut 0 out of bounds; dist equals npm run build. Expected-red: 24 rows all green, 0 reds off manifest. Full suite 4697/4699, 0 fail, 2 e130 history skips. npm audit high exit 0; agc check exit 0 (one pre-existing advisory gates/visual.ts high-ratio 31%, kept). Optional: gates/expected-red.ts:6 is 82 columns. review_report: review_reports/review_T-E462-10.md (covers T-E462-10, T-E462-11).

