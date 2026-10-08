covers: T-E268-01, T-E268-02, T-E268-03, T-E268-04, T-E268-05, T-E268-06

# QA review — e268-test-comment-accuracy (batched)

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3: skipped (pure verification, qa authors no tests). Full per-AC narrative: qa_reports/verify_E268_T-E268-06.md.

## AC Execution Log
All commands run from the lane worktree root on HEAD dbbcb6d.
| AC | command | raw output | verdict |
|---|---|---|---|
| AC1 | `grep -nE "no (lane-then-)?flat (path )?fallback\|no flat fallback" test/drift-skew.test.mjs` | (empty) | pass |
| AC2 | `test -f qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73-agc-feature-lifecycle.txt; grep -c "qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73" specs/e260e-comment-rationale.md` | exists; `1` | pass |
| AC3 | `grep -n review_T-TESTS test/agc-adapters.test.mjs` | (empty) | pass |
| AC4 | `sed -n 1,5p test/e22-stale-notify.test.mjs \| grep -c tools/handoff-parse.ts` | `1` | pass |
| AC5 | `grep -n "tools/handoff\.ts" test/e22-stale-notify.test.mjs` | (empty) | pass |
| AC6 | `sed -n 3p test/gates-expected-red.test.mjs \| grep -c U1-U13` | `1` | pass |
| AC7 | `grep -c "documents the conservative per-field defaults" specs/e260g-comment-rationale.md` | `1` | pass |
| AC8 | `awk 'NR==363\|\|NR==366{print length}' test/e92-e86-handoff-write-boundary.test.mjs \| uniq \| wc -l` | `1` | pass |
| AC9 | `sed -n 1,6p test/lane-ticket-allocation.test.mjs \| awk '{ if (length>118) bad=1 } END{ exit bad }'` | exit=0 | pass |
| AC10 | `sed -n 5p test/pixel-gate-attestation.test.mjs \| grep -c dist/index.js` | `0` | pass |
| AC11 | `grep -c e260h-comment-rationale test/qa-flow.test.mjs` | `1` | pass |
| AC12 | `node scripts/test-lock.mjs -- npm test` (includes test/subagent-templates.test.mjs) | exit 0, 3040 pass / 0 fail / 3 skipped of 3043 | pass |
| AC13 | `node .current/e268/proof.mjs` | `emit: 9 files, 0 differ` | pass |
| AC14 | `git diff main...HEAD --name-status` | 19 paths, all owned, test/ all M (proof.mjs scope line diffs vs BASE so false-reports the main merge) | pass |
| AC15 | `node .current/e268/proof.mjs` | `hygiene: ok` | pass |
| AC16 | clean tree + full suite | exit 0, 3040/0/3 of 3043 | pass |
| AC17 | emit compare on out-of-worktree copy with one test-name literal changed | `DIFFERS` | pass |
