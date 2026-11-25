# Judge report — e461-mutation-test-gaps (T-E461-01 … T-E461-08)

covers: T-E461-01, T-E461-02, T-E461-03, T-E461-04, T-E461-05, T-E461-06, T-E461-07, T-E461-08

Review report: `review_reports/review_T-E461-01.md`.

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff

Manifest `qa_reports/expected-red_e461-mutation-test-gaps.txt`: zero entries (header comments only). Full suite on the branch: 0 actual reds. Difference: none — no manifest entry to turn green, no red off the manifest.

## AC Execution Log

Environment: Node v22.22.3. Mutations applied only in a throwaway copy of the branch tree (rsync without the VCS dir and `node_modules`, `node_modules` symlinked) under the judge's scratchpad, one at a time by a harness that replaces the exact anchor (asserting it is unique, or the stated occurrence), runs the command, then restores the file. "Old" = the same test file as at base `83ca8c0`, placed beside it in the copy and run under the same mutation. After all mutations were reverted, the five touched test files were re-run in the copy: all green (e433 16 tests / 13 pass / 3 skip — the history-dependent closed-range checks skip in a copy without history; e461 5/5; e435 13/13; e419 11/11; e422 55/55).

| AC | mutation | command | branch, unmutated | branch, mutated | old test, mutated | result |
|---|---|---|---|---|---|---|
| AC1 | M1a: new last line `- qa-engineer writes PASS on the feature and then calls \`tw_complete_task\`.` in `content/const-06-chain-31-head.md` | `node --test --test-name-pattern "AC1 " test/e433-test-first-rules.test.mjs` | pass | exit 1, 5/5 AC1 role tests fail | exit 0, 5/5 pass | pass |
| AC2 (a) | M1b: step 7 `Always sr-engineer, never code-reviewer. STOP.` → `… Then write \`status=PASS\` with your \`completed_tasks\`. STOP.` | `node --test --test-name-pattern "AC3" test/e433-test-first-rules.test.mjs` | pass | exit 1, AC3 fails | exit 0 | pass |
| AC2 (b) | M1c: step 7 `next_role="sr-engineer"` → `next_role="code-reviewer"` | same | pass | exit 1, AC3 fails | exit 0 | pass |
| AC3 | M1d: `(return route 1) \| In_Progress \|` → `\| Blocked \|` in `content/skill-sr-engineer.md` | `node --test --test-name-pattern "AC4" test/e433-test-first-rules.test.mjs` | pass | exit 1, AC4 fails | exit 0 | pass |
| AC4 | M2a: `dist/tools/transitions.js` `const base = feature_changed ? 0 : prev_sr_return_count;` → `const base = prev_sr_return_count;` | `node --test test/e461-sr-return-rag-cleanup.test.mjs` | 5/5 pass | exit 1, only AC4 fails | — (new test) | pass |
| AC5 | M2b: second `if (!req.feature_changed &&` → `if (` | same | 5/5 pass | exit 1, AC5 fails (AC4, AC7 also red) | — | pass |
| AC6 | M2c: `dist/tools/handoff-parse.js` delete `srReturnCount: state.sr_return_count,` | same | 5/5 pass | exit 1, only AC6 fails | — | pass |
| AC7 | M2d: `dist/tools/handoff-orchestrator.js` delete `sr_return_count: new_sr_return_count,` | same | 5/5 pass | exit 1, only AC7 fails | — | pass |
| AC8 | M4: GC hook `parsed.agent_id === JUDGE_ROLE &&` (followed by `"deletePrdChunks" in storage`) → `parsed.agent_id === "qa-engineer" &&` | same (binding present) | 5/5 pass | exit 1, only AC8 fails | — | pass |
| AC9 | M5: `dist/schema/migrations-handoff.js` v16→v17 `up` → `return { ...input, schema_version: 17 };` | `node --test --test-name-pattern "AC4" test/e435-remove-old-path.test.mjs` | 3/3 pass | exit 1, 1 fail (lazy-migration AC4) | exit 0, 3/3 | pass |
| AC10 | `dist/tools/storage-sqlite.js` replaced by a module that throws on import | `node --test test/e435-remove-old-path.test.mjs test/e461-sr-return-rag-cleanup.test.mjs` | — | exit 0, 18 tests / 16 pass / 2 skip: `# SKIP better-sqlite3 not installed` (e435 AC9), `# SKIP better-sqlite3 not installed: the SQLite RAG cleanup case cannot run` (e461 AC8) | — | pass |
| AC11 | M6a: `dist/tools/drift.js` final report object gains `stampAdvisory: null,` | `node --test --test-name-pattern "AC8" test/e419-retired-write-mechanisms.test.mjs` | 3/3 pass | exit 1, the full-report case fails | exit 0, 2/2 | pass |
| AC12 | M6b: `dist/tools/registry.js` `active_feature: z.string().min(1).max(500),` → `.max(500).transform(… throw new Error("BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE: …") …)` | `node --test --test-name-pattern "boundary" test/e419-retired-write-mechanisms.test.mjs` | pass | exit 1, boundary fails | exit 0 (gap confirmed) | pass |
| AC13 | M7a: `dist/tools/ticket-file.js` `name.toLowerCase() !== "readme.md"` → `name !== "README.md"` | `node --test test/e422-ticket-file.test.mjs` | 55/55 | exit 1, only the ReadMe.md test fails | exit 0, 53/53 | pass |
| AC14 | M7b: `words(name).includes(words(listed))` → `name.toLowerCase().includes(listed)` | same | 55/55 | exit 1, the rounding test fails (plus existing `AC3 Review Round, lane, …`) | exit 1, the existing `AC3 Review Round …` only | pass |
| AC14 (variant) | M7b′: `words(name).includes(words(listed))` → `words(name).includes(words(listed).trim())` | same | 55/55 | exit 1, only the rounding test fails | exit 0, 53/53 (survivor) | pass |
| AC15 | append one line to `CLAUDE.md` | in a full-history local clone of the branch head: `node --test --test-name-pattern "AC12" test/e433-test-first-rules.test.mjs`; in the copy: old AC12 | — | branch AC12: exit 0, 1/1 pass (closed-range checks ran, not skipped) | old AC12: exit 1, `CLAUDE.md is 250 lines` | pass |
| AC16 | M9a: `dist/tools/registry.js` `if (d.status === "PASS" && d.agent_id !== "code-reviewer") {` → `if (false) {` | `node scripts/smoke-qa-flow.mjs` | `[PASS] qa-engineer PASS rejected at the tool boundary, judge named — ❌ Invalid arguments … status="PASS" requires agent_id="code-reviewer": code-reviewer is the judge`, exit 0 | `[FAIL] …` with text `⛔ BLOCKED: tw_update_state(status=PASS) is reserved for code-reviewer …`, exit 1 | old smoke: `[PASS] qa-engineer PASS rejected, judge named` (gap confirmed) | pass |
| AC18 | — (no mutation) | `node scripts/smoke-qa-flow.mjs; echo exit=$?` | `12/12 smoke tests passed.`, exit=0 | — | old smoke: `11/12`, exit 1, `[FAIL] code-reviewer PASS … — ⛔ MISSING_REVIEW_EVIDENCE` | pass |
| AC17 | — | `node scripts/test-lock.mjs -- npm test` on the worktree (only uncommitted files: the judge's own `.current/e461` claim write and this round's report files); `git diff --name-only 83ca8c0..HEAD` | exit 0: 4676 tests, 4674 pass, 0 fail, 2 skipped (the history-dependent e130 closed-range checks AC4 / AC14, same as base); diff name list inside the e461 owned set | — | — | pass |

AC14 decision: the spec's proof (the new word-boundary test red under M7b) holds as written. M7b also reds one pre-existing test, so M7b alone was not a survivor of the base suite; M7b′ is a survivor of the whole base e422 file and only the new rounding test catches it, which shows the new test closes a real gap. AC14 is proven.
## 2026-11-25T10:43:35.857Z — PASS — by code-reviewer

suite-result: 4674/4676 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED. Judge re-ran every named mutation in a throwaway copy: M1a (5/5 AC1 red), M1b, M1c (AC3 red), M1d (AC4 red), M2a/M2b/M2c/M2d/M4 (e461 AC4/AC5/AC6/AC7/AC8 red), M5 (e435 AC4 red), M6a, M6b (e419 full-report / boundary red), M7a (ReadMe.md test red), M7b (rounding test red; also reds an existing e422 test) and M7b' (only the rounding test red, old e422 file 53/53 green, so AC14 proven), M9a (smoke qa PASS line [FAIL], exit 1); old base tests stayed green under M1a-M1d, M5, M6a, M6b, M7a, M7b', M9a. AC15: CLAUDE.md +1 line in a full-history clone, branch AC12 pass, old AC12 red. AC10: sqlite module throwing on import, exit 0 with both SKIP lines carrying the reason. AC16/AC18: smoke 12/12, exit 0. Scope inside the e461 owned set; no source/content/dist/docs change; no e462 source-text read; no git show / SHA pins in added lines. Full suite 4674/4676 (2 base skips), 0 fail. Expected-red manifest zero entries, zero actual reds. Recommended: R1 NEGATED bare no/not can mask a clause (spec-accepted limit); R2 M7b not a pure base survivor, M7b' shows the gap. Optional: O1 e419 earlyReturns strings hard-coded; O2 zod issue-count coupling.

