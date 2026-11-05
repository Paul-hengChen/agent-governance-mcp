covers: T-E408-01, T-E408-02, T-E408-03, T-E408-04

# QA review: e408-core-task-alias-tail (T-E408-01..04)

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared).
Test placement: new `test/e408-core-task-alias-tail.test.mjs`, creation pre-authorized in the dispatch brief.

## AC Execution Log

Base is the merge-base of HEAD and main, `c337d5b`. Commands run in the lane worktree on a fresh build.

| AC | command | raw result | verdict |
|---|---|---|---|
| AC1, AC2, AC3 (resident), AC5, AC6 | `node --test test/e408-core-task-alias-tail.test.mjs test/e403-lean-dispatch-alias.test.mjs test/subagent-templates.test.mjs test/e178a-integrator-role.test.mjs test/skill-evolution-v3.11.test.mjs test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs` | `# tests 153`, `# pass 153`, `# fail 0` | pass |
| AC3 (review-time) | `git diff --numstat c337d5b -- content/` (stands in for the per-file `git diff --exit-code`, which the worktree guard refuses in that compound form) | only coord-03, coord-05, coord-07 listed, so coord-01/02/04/06 are byte-identical to base | pass |
| AC4 | `git diff --numstat c337d5b -- content/` | `4 4 content/coord-03-core-fallback.md`, `1 1 content/coord-05-core-visual-drift.md`, `1 1 content/coord-07-core-sop.md` | pass |
| AC5 (skill unchanged) | same numstat: `content/skill-coordinator-lite.md` absent | unchanged | pass |
| AC6 (review-time) | `git diff -U0 c337d5b -- tools/role.ts` | single hunk `@@ -36,5 +36,5 @@ const ROLE_SKILL_MAP = {`, comment lines only | pass |
| AC7 | `npm run build`, then `git status --porcelain dist/`, then `git diff --stat c337d5b -- dist/` | status empty; stat lists `dist/tools/role.js` (10 lines) and `dist/tools/role.js.map` (1 line) only; role.d.ts untouched | pass |
| AC8 | `npm run build && node scripts/capture-constitution-golden.mjs`, then `git status --porcelain` | only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` modified (45762 to 45783 bytes); six one-line hunks | pass |
| AC9 | `node --test test/context-budget.test.mjs` (inside the 153/153 run) and `git diff --exit-code c337d5b..HEAD -- test/context-budget.test.mjs` | green; diff exit 0 (no cap literal changed); AC8 teamwork 21408 ~tok (cap 21715); lean 5682 ~tok (cap 5723) | pass |
| AC10 | `node scripts/test-lock.mjs -- npm test` on clean tree at 0da94dc; `npm run check:bookkeeping`; `npm audit --audit-level=high` | `# tests 4032`, `# pass 4030`, `# fail 0`, `# skipped 2`, exit 0; bookkeeping OK; audit exit 0 (moderate advisories only) | pass |

Golden hunks (skill-coordinator-monolith.txt): coord-03 crash-detection row, Crash-Resume steps 0, 2, 3, coord-05 No-accept-policy-injection bullet, coord-07 SOP step 5; each swaps a `Task` span for its Copy / Strings replacement.
## 2026-11-05T03:54:50.009Z — PASS — by qa-engineer

suite-result: 4030/4032 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Per-AC: AC1-AC10 all PASS (full log under ## AC Execution Log in qa_reports/review_T-E408-01.md). Golden: only skill-coordinator-monolith.txt differs, 45762 -> 45783 bytes, six one-line hunks (coord-03 crash row, Crash-Resume steps 0/2/3, coord-05 accept-policy bullet, coord-07 SOP step 5), each a Task span swapped for its host-neutral Copy/Strings text; other 11 goldens identical. Budgets, no cap raised: AC8 teamwork 21401 -> 21408 ~tok (cap 21715; before = PM dry-run base, after measured); AC2 lean 5682 -> 5682 (cap 5723); test/context-budget.test.mjs unchanged. Suite: node scripts/test-lock.mjs -- npm test exit 0, 4030 pass / 0 fail / 2 skipped of 4032 on clean tree at 0da94dc; check:bookkeeping OK; npm audit --audit-level=high exit 0. Phase 0.5/1.5 skipped (no manifest, no baselines). Code-reviewer O1 optional spec text, not a QA blocker; E408-NEW-1 filed for the integrator.

