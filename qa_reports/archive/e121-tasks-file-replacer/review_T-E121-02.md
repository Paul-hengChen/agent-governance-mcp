# QA review — T-E121-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-09-15T12:17:59.086Z — PASS — by qa-engineer

covers: T-E121-01, T-E121-02

PASS. Verified code-reviewer round 3's APPROVED verdict on tools/tasks-file.ts by execution, not by re-reading the diff, then authored the test surface it specified.

**What was verified before writing a single test.** THE TRAP (round 3 pending_notes 1/9): the pre-fix build ALSO returns success:true for every forged-row payload, so success===true / no-crash / error===undefined are not tests of this defect. Confirmed directly: extracted HEAD's pre-fix dist via `git archive HEAD dist`, ran the new test file against it with only the import paths retargeted — 11 of 13 tests fail against that build (the 2 that pass are the must-succeed/no-over-refusal cases, which are correctly build-invariant). The same 13 tests are 13/13 green against the working tree's dist. This is the discriminating evidence that the suite tests the defect, not merely the tool's plumbing.

**test/e121-tasks-file-injection.test.mjs (new, 13 tests):**
- 8 must-refuse cells, field x mutator: completeTask(taskId/note), rollbackTask(taskId/reason), voidTask(taskId/reason), addTask(taskId/description) — each pins (a) {error} matching the field-accurate refusal message, (b) tasks.md byte-identical to pre-call content, (c) the forged marker id absent from the whole file, (d) parseTasksFromFile row count unchanged, (e) no .lock artifact left behind.
- Explicit-refusal assertion for the taskId column (complete/rollback/void): asserts POSITIVELY on /task_id must not contain a line break/ AND NEGATIVELY that the message does NOT match /not found|Could not find|No incomplete/i — the property that distinguishes a stated boundary invariant from incidental lookup-order safety.
- 1 CR-only consistency case (addTask taskId) — refused, asserted WITHOUT claiming CR forges a row (it doesn't; LF is the whole forging class per round 2/3 measurement, cited in-file).
- Must-succeed floor: 15 benign id shapes (T-1, JIRA-42, $-bearing, backtick, T-E121-99, ABC_123, slash, dotted, CJK, emoji, space, tab, #123) all succeed via addTask; the round-1 non-regression round trip ($&, $1, $`, $\\', $$ through completeTask then rollbackTask) stores all five sequences literally with the id occurring exactly once; a backtick-id void with a benign reason succeeds.
- Structural reasoning (why over-refusal is zero) cited in-file per tools/tasks-file.ts:80-92 / tools/config.ts:100,353-364, not re-derived.

**Scope respected, nothing extended beyond the brief:** no test written for U+2028/U+2029 erasure (R2-C2, out of scope, separate ticket); tools/registry.ts's task_id schema left untouched; SQLite mode untouched; test/e117-void-task.test.mjs NOT edited — git diff is empty, its 25 tests including :298 pass unchanged.

**Phase gates:** `npm run build` clean (tsc 0 errors, check:version + check:transitions-sync OK). `npm test`: 1859/1859 pass, 0 fail (1846 baseline + 13 net new), test/ byte-clean apart from the one new file.

Boundaries respected: cut_approved untouched (already true), docs/backlog.md E121 row NOT done-marked (release-engineer's call per SOP 7c), no commit made, no worktree/branch change. R2-C2, E122, and the "inert garbage" premise in docs/backlog.md:243 + the tasks.md T-E121-01 row are left exactly as instructed for the coordinator/release-engineer to carry forward.

## 2026-09-15T12:18:17.914Z — PASS — by qa-engineer

covers: T-E121-01, T-E121-02

PASS. Verified code-reviewer round 3's APPROVED verdict on tools/tasks-file.ts by execution, not by re-reading the diff, then authored the test surface it specified.

**What was verified before writing a single test.** THE TRAP (round 3 pending_notes 1/9): the pre-fix build ALSO returns success:true for every forged-row payload, so success===true / no-crash / error===undefined are not tests of this defect. Confirmed directly: extracted HEAD's pre-fix dist via `git archive HEAD dist`, ran the new test file against it with only the import paths retargeted — 11 of 13 tests fail against that build (the 2 that pass are the must-succeed/no-over-refusal cases, which are correctly build-invariant). The same 13 tests are 13/13 green against the working tree's dist. This is the discriminating evidence that the suite tests the defect, not merely the tool's plumbing.

**test/e121-tasks-file-injection.test.mjs (new, 13 tests):**
- 8 must-refuse cells, field x mutator: completeTask(taskId/note), rollbackTask(taskId/reason), voidTask(taskId/reason), addTask(taskId/description) — each pins (a) {error} matching the field-accurate refusal message, (b) tasks.md byte-identical to pre-call content, (c) the forged marker id absent from the whole file, (d) parseTasksFromFile row count unchanged, (e) no .lock artifact left behind.
- Explicit-refusal assertion for the taskId column (complete/rollback/void): asserts POSITIVELY on /task_id must not contain a line break/ AND NEGATIVELY that the message does NOT match /not found|Could not find|No incomplete/i — the property that distinguishes a stated boundary invariant from incidental lookup-order safety.
- 1 CR-only consistency case (addTask taskId) — refused, asserted WITHOUT claiming CR forges a row (it doesn't; LF is the whole forging class per round 2/3 measurement, cited in-file).
- Must-succeed floor: 15 benign id shapes (T-1, JIRA-42, $-bearing, backtick, T-E121-99, ABC_123, slash, dotted, CJK, emoji, space, tab, #123) all succeed via addTask; the round-1 non-regression round trip ($&, $1, $`, $\\', $$ through completeTask then rollbackTask) stores all five sequences literally with the id occurring exactly once; a backtick-id void with a benign reason succeeds.
- Structural reasoning (why over-refusal is zero) cited in-file per tools/tasks-file.ts:80-92 / tools/config.ts:100,353-364, not re-derived.

**Scope respected, nothing extended beyond the brief:** no test written for U+2028/U+2029 erasure (R2-C2, out of scope, separate ticket); tools/registry.ts's task_id schema left untouched; SQLite mode untouched; test/e117-void-task.test.mjs NOT edited — git diff is empty, its 25 tests including :298 pass unchanged.

**Phase gates:** `npm run build` clean (tsc 0 errors, check:version + check:transitions-sync OK). `npm test`: 1859/1859 pass, 0 fail (1846 baseline + 13 net new), test/ byte-clean apart from the one new file.

Boundaries respected: cut_approved untouched (already true), docs/backlog.md E121 row NOT done-marked (release-engineer's call per SOP 7c), no commit made, no worktree/branch change. R2-C2, E122, and the "inert garbage" premise in docs/backlog.md:243 + the tasks.md T-E121-01 row are left exactly as instructed for the coordinator/release-engineer to carry forward.

