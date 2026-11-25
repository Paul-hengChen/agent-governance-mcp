# Tests — e461-mutation-test-gaps

Author: qa-engineer (T-E461-01..04). Scenarios = spec Acceptance Criteria (`specs/e461-mutation-test-gaps.md`, no ticket file).
Placement: the spec's "Test placement (fixed for qa)" table (Constitution §2 placement branch: dispatch brief / spec fixed it; no question asked).

Every test here pins behaviour the unchanged branch already has: green on the branch, red under its named mutation.
Mutations were applied only in throwaway copies of the worktree (rsync without the VCS dir and `node_modules`, `node_modules` symlinked), never in the worktree, never committed. "Old test" = the same file as it stood at the lane base, run in the same mutated copy, to show the gap the new assertion closes.

## Scenario → Test Map

| AC | file | exact test name |
|---|---|---|
| AC1 | `test/e433-test-first-rules.test.mjs` | `AC1 (E435): composed <role> prompt carries chain.main, no forbidden old-judge or marker string, and no clause gives qa-engineer PASS / tw_complete_task / completed_tasks` (one per role: qa-engineer, sr-engineer, code-reviewer, pm, teamwork) |
| AC2 | `test/e433-test-first-rules.test.mjs` | `AC3 (E435): skill-qa-engineer.md alone makes qa the test author (scenarios, public interface, open interface details, manifest, no verdict, return loops, bug ticket)` |
| AC3 | `test/e433-test-first-rules.test.mjs` | `AC4: skill-sr-engineer.md builds to pre-written tests, has both return routes with Escalation Routes rows, and no QA Round Reply` |
| AC4 | `test/e461-sr-return-rag-cleanup.test.mjs` | `AC4: a return that opens a new feature restarts the sr_return count: 2 on feature A becomes 1 on feature B` |
| AC5 | `test/e461-sr-return-rag-cleanup.test.mjs` | `AC5: at the sr_return cap a return that opens a new feature is not rejected SR_RETURN_CAP_EXCEEDED` |
| AC6 | `test/e461-sr-return-rag-cleanup.test.mjs` | `AC6: the schema 16 -> 17 read heal keeps sr_return_count on disk, so the cap still holds after the heal` |
| AC7 | `test/e461-sr-return-rag-cleanup.test.mjs` | `AC7: at sr_return_count 2 the next_role lookahead marks qa-engineer:In_Progress as legal only on a new feature; at 1 it does not` |
| AC8 | `test/e461-sr-return-rag-cleanup.test.mjs` | `AC8: in SQLite mode the judge's PASS drops the workspace's PRD chunks; a non-PASS write keeps them` |
| AC9 | `test/e435-remove-old-path.test.mjs` | `AC4: a schema 16 handoff carrying chain_path lazily migrates to 17 with chain_path, qa_round, qa_rounds_total dropped` (extended with the `runMigrations("handoff", …)` check) |
| AC10 | `test/e435-remove-old-path.test.mjs` + `test/e461-sr-return-rag-cleanup.test.mjs` | e435 `AC9: SQLite mode rejects …` (unchanged) and e461 `AC8: …` — skip-with-reason verification, no test edit |
| AC11 | `test/e419-retired-write-mechanisms.test.mjs` | `AC8: the full drift report (handoff and task list both present) has no stampAdvisory key` |
| AC12 | `test/e419-retired-write-mechanisms.test.mjs` | `boundary: an empty active_feature on a stale bookkeeping_write is still validated normally (no silent acceptance)` (tightened in place) |
| AC13 | `test/e422-ticket-file.test.mjs` | `AC10 the readme exclusion ignores case for a name the .md filter keeps (ReadMe.md)` |
| AC14 | `test/e422-ticket-file.test.mjs` | `AC3 forbidden names match whole words: a rounding field is unknown, not forbidden` |
| AC15 | `test/e433-test-first-rules.test.mjs` | `AC12 (E435): counts and hygiene — 33 gates, 17 pipeline steps, untouched server files (CLAUDE.md in the closed range), dist diff` (the `CLAUDE.md is 250 lines` assertion removed; title no longer lists CLAUDE.md as a live pin) |
| AC16 | `scripts/smoke-qa-flow.mjs` | probe label `qa-engineer PASS rejected at the tool boundary, judge named` |
| AC17 | — (command scenario) | judge runs `node scripts/test-lock.mjs -- npm test` and `git diff --name-only 83ca8c0..HEAD`; qa's run recorded under *Suite result* |
| AC18 | `scripts/smoke-qa-flow.mjs` | last probe `code-reviewer PASS with qa_review accepted + evidence file written`, now preceded by seeding `review_reports/review_X1.md` |

## Mutation record (green on the branch / red under mutation)

Command per row: `node --test --test-name-pattern "<pattern>" <file>` in the copy (the AC1 pattern also matches AC10/AC12/AC13; the five failures under M1a are the five AC1 tests).

| AC | mutation | file mutated (in the copy) | branch test, unmutated | branch test, mutated | old test, mutated |
|---|---|---|---|---|---|
| AC1 | M1a: new last line `- qa-engineer writes PASS on the feature and then calls \`tw_complete_task\`.` | `content/const-06-chain-31-head.md` | green (6 pass) | **red** (5 fail: every AC1 role) | green (6 pass) |
| AC2 (a) | M1b: step 7 gains ``Then write `status=PASS` with your `completed_tasks`.`` | `content/skill-qa-engineer.md` | green | **red** | green |
| AC2 (b) | M1c: step 7 `next_role="sr-engineer"` → `next_role="code-reviewer"` | `content/skill-qa-engineer.md` | green | **red** | green |
| AC3 | M1d: return route 1 status cell `In_Progress` → `Blocked` | `content/skill-sr-engineer.md` | green | **red** | green |
| AC4 | M2a: `const base = feature_changed ? 0 : prev_sr_return_count;` → `const base = prev_sr_return_count;` | `dist/tools/transitions.js` | green | **red** (count 3) | — (new test) |
| AC5 | M2b: second `if (!req.feature_changed &&` → `if (` | `dist/tools/transitions.js` | green | **red** (`SR_RETURN_CAP_EXCEEDED`) | — (new test) |
| AC6 | M2c: delete `srReturnCount: state.sr_return_count,` | `dist/tools/handoff-parse.js` | green | **red** (healed file has no count) | — (new test) |
| AC7 | M2d: delete `sr_return_count: new_sr_return_count,` (lookahead `counters`) | `dist/tools/handoff-orchestrator.js` | green | **red** (annotation gone at 2) | — (new test) |
| AC8 | M4: GC hook `parsed.agent_id === JUDGE_ROLE &&` → `parsed.agent_id === "qa-engineer" &&` | `dist/tools/handoff-orchestrator.js` | green (binding present) | **red** (chunk survives) | — (new test) |
| AC9 | M5: v16 → v17 `up` returns `{ ...input, schema_version: 17 }` | `dist/schema/migrations-handoff.js` | green (3 pass) | **red** (1 fail) | green (3 pass) |
| AC11 | M6a: final report object gains `stampAdvisory: null,` | `dist/tools/drift.js` | green (3 pass) | **red** (1 fail) | green (2 pass) |
| AC12 | M6b: `active_feature: z.string().min(1).max(500),` → `.max(500).transform(… throw new Error("BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE: …") …)` | `dist/tools/registry.js` | green | **red** | green |
| AC13 | M7a: `name.toLowerCase() !== "readme.md"` → `name !== "README.md"` | `dist/tools/ticket-file.js` | green (10 pass) | **red** (1 fail: the ReadMe.md test) | green (9 pass) |
| AC14 | M7b: `words(name).includes(words(listed))` → `name.toLowerCase().includes(listed)` | `dist/tools/ticket-file.js` | green (5 pass) | **red** (2 fail) | red (1 fail, see note) |
| AC14 | M7b′: `words(name).includes(words(listed))` → `words(name).includes(words(listed).trim())` | `dist/tools/ticket-file.js` | green | **red** (1 fail: the rounding test) | green (53 pass, whole file) |
| AC16 | M9a: `if (d.status === "PASS" && d.agent_id !== "code-reviewer") {` → `if (false) {` | `dist/tools/registry.js` | `[PASS]`, 12/12, exit 0 | **`[FAIL]`** (text is the orchestrator's `⛔ BLOCKED … reserved for code-reviewer`), exit 1 | old smoke: line prints `[PASS]` (gap) |
| AC15 | inverse: append one line to `CLAUDE.md` | `CLAUDE.md` | — | AC12 **green** (gate/pipeline asserts pass; closed range skips in the copy: no history) | old AC12 **red** (`CLAUDE.md is 250 lines`) |
| AC10 | replace `dist/tools/storage-sqlite.js` with a module that throws on import | `dist/tools/storage-sqlite.js` | — | `node --test test/e435-remove-old-path.test.mjs test/e461-sr-return-rag-cleanup.test.mjs` exit 0; `# SKIP better-sqlite3 not installed` (e435 AC9) and `# SKIP better-sqlite3 not installed: the SQLite RAG cleanup case cannot run` (e461 AC8) | — |
| AC18 | — (base failure, no mutation) | — | `12/12 smoke tests passed.`, exit 0 | — | old smoke: `11/12`, exit 1 (`MISSING_REVIEW_EVIDENCE`) |

Note on M7b: as written in the spec, M7b also turns an existing test red (`AC3 Review Round, lane, dispatch mechanism and Review-Round are all refused as forbidden`: `"agent id"` no longer contains `agent_id` once the word split is gone), so it was not a pure survivor of the old suite. M7b′ keeps the word split but drops the whole-word padding; it survives the whole old e422 file and only the new rounding test catches it. Both are recorded; AC14's proof (new test red under M7b) holds either way.

## Open Interface Details

- New test file name: `test/e461-sr-return-rag-cleanup.test.mjs` (matches `test/e461-*.test.mjs`; names the two behaviours it covers).
- Pairing-rule regexes (AC1/AC2), refined from the spec wording: judge term `/status=PASS|\bPASS\b(?!_)|tw_complete_task|completed_tasks/`; qa actor `/qa-engineer(?!'s)/`; negated `/\b(never|not|no|cannot|can't|don't|nor|must not)\b/i`; judge named `/code-reviewer|the chain's judge/`; sentence split `/(?<=[.;!?])\s+|\n+/`, clause split `/, | — |: |(?= then )/`. On the branch: 0 violations in all five composed prompts and the raw qa SOP; judge-term clauses seen 31 / 26 / 43 / 30 / 37 (qa / sr / code-reviewer / pm / teamwork) and 6 in the raw qa SOP (vacuity guard).
- AC1 drops the two per-sentence regex checks of the old keyword filter (`agent_id="qa-engineer"` and the `flips|owns|grows…` verb list): the pairing rule flags any non-negated, judge-unnamed clause naming qa-engineer with a judge term, which covers both.
- AC2 (b): the step 7 line must contain `next_role="sr-engineer"` and its list of `next_role="…"` values must be exactly that one.
- AC3: the status cell is the second table cell of the `(return route 1)` row, compared exactly to `In_Progress`.
- AC12: accepted outcome = a thrown `ZodError` with exactly one issue, path `["active_feature"]`, code `too_small`; a returned result (error or not) fails the test.
- AC16 match text: `status="PASS" requires agent_id="code-reviewer": code-reviewer is the judge` (the tool-boundary refine message prefix) and no `"success":true`. Probe label reworded to `qa-engineer PASS rejected at the tool boundary, judge named` (dev-only script, not served text).
- AC18 seed: `review_reports/review_X1.md` with a two-line markdown body, written just before the last probe's `tw_get_state`.

## Red Reasons

None: the manifest `qa_reports/expected-red_e461-mutation-test-gaps.txt` has zero entries. Every new or tightened test is green on the unchanged branch (spec Gate Summary: tests pin current behaviour; reds exist only under the mutations above).

## Node 20 / CI

- Local Node 20 (fnm v20.20.2) run of the five touched test files: all green except the two SQLite cases (e435 AC9, pre-existing; e461 AC8, new), which fail with `NODE_MODULE_VERSION 127 … requires 115`: the shared `node_modules` binding is compiled for Node 22. That is the known local environment limit, not a test defect; CI installs the binding per Node version.
- No test reads base text through `git show`; the e433 closed-range capture is unchanged. The e461 tests read only temp workspaces, live `dist/` and the in-test v16 fixture.
- All runs are headless (`node --test`, `node scripts/smoke-qa-flow.mjs`).

## Suite result

Run on a clean tree (`git status --porcelain` empty) at commit `c8fb76f`, Node 22.22.3:

- `node scripts/test-lock.mjs -- npm test`: **4676 tests, 4674 pass, 0 fail, 2 skipped, exit 0.** The 2 skips are the base's history-dependent e130 closed-range checks (AC4, AC14), unchanged. 4676 = base probe 4668 + 8 new tests (5 in the new e461 file, the e419 full drift report case, the e422 ReadMe.md and rounding cases).
- `node scripts/smoke-qa-flow.mjs`: **`12/12 smoke tests passed.`, exit 0**; the `qa-engineer PASS rejected at the tool boundary, judge named` line is `[PASS]` with the boundary message.
