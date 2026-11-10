# QA review — T-E381-03

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-09T09:27:18.223Z — PASS — by qa-engineer

suite-result: 4089/4091 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

covers: T-E381-01, T-E381-02, T-E381-03, T-E381-04, T-E381-05, T-E381-06, T-E381-07

Verdict: PASS. Full suite on final test HEAD 7d40c3f (clean tree, no untracked files): 4091 tests, 4089 pass, 0 fail, 2 skipped (pre-existing skips), run as `node scripts/test-lock.mjs -- npm test`. Code review R1 APPROVED beforehand (7537dea).

## Expected-Red Diff
Phase 0.5: clean (1/1 manifest entries confirmed addressed, 0 unexplained reds). Manifest entry `test/e177a-manifest.test.mjs | AC1 wave7 parses` was the only expected red; re-pinned in T-E381-04 (`.current/e177a/` removed from the expected owned list, absence asserted citing E381) and now green. Full suite shows 0 reds, so no extra or missing entries.

## AC Execution Log
- AC-E381-4: review-time node script -> `lanes 5 differ 0`; `node scripts/fanout.mjs validate specs/fanout-backlog-wave-a.md` -> `fanout: ok — 5 dispatchable lane(s)`, exit 0. PASS.
- AC-E390-7: `node scripts/fanout.mjs 2>&1 | grep -c 'check <manifest> <lane> \[--base <ref>\] \[--repo <dir>\]'` -> 1; same grep on scripts/fanout.mjs -> 1; test/e296-manifest-tier.test.mjs passes unedited in the full suite. PASS.
- AC-E388-6: test/e125a-lane-local-ledgers.test.mjs and test/e383-lane-ledger-worktree.test.mjs unedited, green in the full suite. PASS.
- AC-L1: full suite as above, clean tree. PASS.
- AC-L2: `git diff --stat main...HEAD -- dist/` lists exactly dist/tools/fanout-manifest.* and dist/tools/tasks-lane-migrate.* (8 files); `npm test` prebuild left `git status --porcelain` with no source/dist changes. PASS.
- AC-L3: `node scripts/fanout.mjs check specs/fanout-backlog-wave-a.md e381 --base main` -> `23 file(s) changed, 0 out of bounds`, exit 0; `npm audit --audit-level=high` exit 0; `npm run check:bookkeeping` exit 0. PASS.
- Unedited regression list (e177a-check-cli, e178b, e296, e386, e125a, e383, lane-paths): green in the full suite.

## Spec-to-Test Map
- AC-E381-1..3, 5, 6 -> test/e381-owned-clause-tokens.test.mjs (14 tests: zh/English prose clauses, 上列 item, both paren forms, nested parens, label/新檔 idiom, concrete paths, 禁止/pathTokens unchanged, check and check --cut OUT lines, boundary inputs). Also pins reviewer note: `qa : t/**` (space before colon) is prose.
- AC-E390-1..6 -> test/e390-check-recorded-base.test.mjs (11 tests: develop-only repo, none-recorded/no-line/unparseable/duplicated-line byte-identical to --base main, err.base-default/-recorded/-flag verbatim, explicit --base wins, library default main, parity with handoff --check). Duplicated 目標分支 line falls back to main is pinned.
- AC-E388-1..5 -> test/e388-tracked-legacy-ledger.test.mjs (5 tests, real git init + worktree add fixtures: tracked TODO.md, tracked tasks.md alone and both, ignored-untracked TODO.md still ledger, primary checkout main and feat, _primary lane in linked worktree).
- AC-E381-4 / AC-E390-7: review-time/lane checks above (not resident tests, by spec).
- Negative control: the three new files run in a scratch copy outside the worktree against the pre-fix dist (base 2425e04) go red (8 failures across the three files), and green on HEAD.
- Fixtures: temp dirs only, no absolute local paths asserted, no real specs/fanout-*.md content asserted, no fixed-sha diffs.

## Notes (optional, non-blocking)
- isGitTracked is uncached (one ls-files per tracked candidate per resolve), per code-reviewer note.
- docs/lane-protocol.md:45 needs-integrator edit (add "；git 追蹤中的檔不算（E388）") remains for the integrator after merge.

