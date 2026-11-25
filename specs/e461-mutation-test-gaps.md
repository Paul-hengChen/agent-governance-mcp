# e461-mutation-test-gaps

Lane e461 of the pre-v5.0.0 wave 2 fan-out (`specs/fanout-pre-v5-w2.md`, Lanes row e461). Ticket: `docs/backlog.md` row E461, read with its 2026-11-25 re-check corrections. Item (3) is not in this lane: it moved to lane e462 (manifest 所有權重劃, human-approved 2026-11-25).

## Problem Statement

A post-merge audit of the v5.0.0 waves broke the code in a scratch copy and found tests that stay green when the behaviour they cover breaks: served-text rules picked by keyword (a sentence giving qa-engineer the PASS slips past), the `sr_return` counter's reset / bypass / heal / lookahead paths, the SQLite RAG chunk cleanup on the judge's PASS, the v16 → v17 handoff migration, the drift report and a boundary test in E419, two E422 ticket-file edges, a resident `CLAUDE.md` line-count pin, and a smoke check that accepts any failure naming code-reviewer. This lane adds or tightens one test per gap so each named mutation turns a test red, and removes the resident pin. Tests only: no source, content, docs or `dist/` change.

## User Stories

- As a maintainer, I want every mutation named in E461 to turn a test red, so that a regression in that behaviour cannot merge with a green suite.
- As a maintainer, I want the `CLAUDE.md` line-count pin gone from the test suite, so that editing `CLAUDE.md` does not break an unrelated test.
- As a maintainer running `scripts/smoke-qa-flow.mjs`, I want the qa-engineer PASS probe to accept only the tool-boundary judge rejection, so that an unrelated failure that happens to name code-reviewer does not read as a pass.

## Acceptance Criteria

How every AC is proved (manifest 交給 lane 的 PM): the named test is green on the lane branch; the named mutation, applied only in a throwaway copy of the worktree (outside the worktree, never committed; copying the tree without `.git` is fine for these test files), turns it red; reverting turns it green again. code-reviewer's `## AC Execution Log` re-runs each mutation at least once. A mutation names the compiled file in `dist/` (the file the tests import) and, for reference, its TypeScript source; edit the `dist/` file in the copy, no rebuild needed. "Base" = `83ca8c0`. Every mutation below was run by PM on a copy of base and behaves as stated (sr_return, RAG, drift-boundary, smoke and the served-text rule were probed; the rest follow the ticket's re-check).

### E461 (1) — served-text rules (`test/e433-test-first-rules.test.mjs`)

**Pairing rule** (replaces the AC1 keyword filter `judgeAssignmentSentences`; qa may refine the regexes as long as base stays green and every mutation below turns red):
- Split the text into sentences at `.` `;` `!` `?` followed by whitespace and at newlines; split each sentence into clauses at `, `, ` — `, `: ` and before ` then `.
- *judge term*: `status=PASS`; the word `PASS` not followed by `_` (so `PASS_TASKS_INCOMPLETE` is not one); `tw_complete_task`; `completed_tasks`.
- *qa actor*: `qa-engineer` not followed by `'s`. In the raw qa SOP (`content/skill-qa-engineer.md`, AC2 below) every clause counts as a qa actor clause, because the SOP addresses qa-engineer as "you".
- *negated*: the clause contains `never`, `not`, `no`, `cannot`, `can't`, `don't`, `nor` or `must not` (word boundary, any case).
- *judge named*: the clause contains `code-reviewer` or `the chain's judge`.
- A *violation* is a clause with a qa actor and a judge term that is neither negated nor judge named. PM probe on base: zero violations in each of the five composed prompts (qa-engineer, sr-engineer, code-reviewer, pm, teamwork) and in the raw qa SOP. Known limit (accepted): a clause that names both qa-engineer and code-reviewer is not flagged.
- Keep a vacuity guard: the scan must see at least one judge-term clause per text.

- **AC1** — Given the five composed prompts as served (non-design, `buildPromptForRole`), when the AC1 test applies the pairing rule, then it finds no violation on base, and it fails when `content/const-06-chain-31-head.md` gains, as a new last line, `` - qa-engineer writes PASS on the feature and then calls `tw_complete_task`. `` (mutation M1a; the compose goldens and context-budget caps also go red under M1a, so judge only the AC1 tests: `--test-name-pattern "AC1"`). The existing AC1 positive checks (chain.main, forbidden strings, const-06 identity sentence, const-05 ownership bullet) stay.
  proof: `node --test --test-name-pattern "AC1" test/e433-test-first-rules.test.mjs` green on the branch, red under M1a.
- **AC2** — Given `content/skill-qa-engineer.md`, when the AC3 test runs, then (a) it applies the pairing rule with every clause as a qa actor clause and finds no violation on base, failing when step 7's `Always sr-engineer, never code-reviewer. STOP.` becomes ``Always sr-engineer, never code-reviewer. Then write `status=PASS` with your `completed_tasks`. STOP.`` (M1b); and (b) it reads the step 7 line (the line starting `7. **Hand off to sr-engineer**`) and requires `next_role="sr-engineer"` in it and no other `next_role=` value, failing when that line's `next_role="sr-engineer"` becomes `next_role="code-reviewer"` (M1c).
  proof: `node --test --test-name-pattern "AC3" test/e433-test-first-rules.test.mjs` green on the branch, red under M1b and under M1c.
- **AC3** — Given `content/skill-sr-engineer.md` `## Escalation Routes`, when the AC4 test reads the `(return route 1)` row, then it requires the status cell to be exactly `In_Progress` (in addition to today's `| qa-engineer |` end), failing when that row's status cell `In_Progress` becomes `Blocked` (M1d). The `(return route 2)` row check (Blocked, to pm) stays.
  proof: `node --test --test-name-pattern "AC4" test/e433-test-first-rules.test.mjs` green on the branch, red under M1d.

### E461 (2) — `sr_return` counter (new `test/e461-*.test.mjs`, behavioural)

All four drive the real tool entry (`TOOL_REGISTRY` `tw_update_state` `.run`, file mode) on a temp workspace, seeding through `writeHandoffState` (with `srReturnCount`) and pinning `last_updated` to an old stamp (`test/e148-seed-stamp.mjs`, `SAFE_SEED_STAMP`) so no feature lease is held; record `qa_reports/no-new-test_<feature>.txt` in the temp workspace so the qa → sr hand-off is not the thing under test. No assertion reads the source text of `tools/handoff-orchestrator.ts`, `tools/handoff-parse.ts` or any other e462-owned file.

- **AC4** — Given a handoff for feature A at `sr-engineer:In_Progress` with `sr_return_count: 2`, when `qa-engineer` writes `In_Progress` with `active_feature` B, then the write is accepted and the stored `sr_return_count` is 1 (the feature change restarts the count from 0, then the return adds 1). Mutation M2a: `dist/tools/transitions.js` (`computeSrReturnCount`, `tools/transitions.ts`) `const base = feature_changed ? 0 : prev_sr_return_count;` → `const base = prev_sr_return_count;` — the count becomes 3.
  proof: the AC4 test in `test/e461-*.test.mjs`, green on the branch, red under M2a.
- **AC5** — Given the same seed as AC4, when `qa-engineer` writes `In_Progress` with `active_feature` B, then the write is not rejected with `SR_RETURN_CAP_EXCEEDED` (a feature change bypasses the cap). Mutation M2b: `dist/tools/transitions.js` (`validateTransition` step 2.6, the second `if (!req.feature_changed &&` in the file) → `if (` — the write is rejected `SR_RETURN_CAP_EXCEEDED`. Keep AC5 a separate test from AC4 (one test per mutation).
  proof: the AC5 test, green on the branch, red under M2b.
- **AC6** — Given a schema 16 handoff written by hand at `sr-engineer:In_Progress` carrying `sr_return_count: 2`, when the `tw_get_state` read path (`readHandoffState`) heals it to schema 17, then the healed file on disk still carries `sr_return_count: 2`, and a following `qa-engineer:In_Progress` write on the same feature is rejected `SR_RETURN_CAP_EXCEEDED`. The heal write is fire-and-forget: poll the file for `schema_version: 17` (the `test/e435-remove-old-path.test.mjs` AC4 pattern, 100 × 10 ms) before asserting. Mutation M2c: `dist/tools/handoff-parse.js` (`tools/handoff-parse.ts` ~692) delete `srReturnCount: state.sr_return_count,` — the healed file has no `sr_return_count` and the third return is accepted.
  proof: the AC6 test, green on the branch, red under M2c.
- **AC7** — Given `sr-engineer:In_Progress` with `sr_return_count: 2` on feature A, when `sr-engineer` writes `In_Progress` on A with `next_role: "release-engineer"` (not a legal successor, so the lookahead warning fires), then the success envelope's `warnings` list the pair `qa-engineer:In_Progress (only legal if the next write opens a new feature)`; control: with `sr_return_count: 1` the same write lists `qa-engineer:In_Progress` without that annotation. Mutation M2d: `dist/tools/handoff-orchestrator.js` (the next_role lookahead's `counters` object, `tools/handoff-orchestrator.ts` ~1575) delete `sr_return_count: new_sr_return_count,` — the annotation disappears at count 2.
  proof: the AC7 test, green on the branch, red under M2d.

### E461 (4) — SQLite RAG cleanup on the judge's PASS (new `test/e461-*.test.mjs`)

- **AC8** — Given SQLite storage (`SqliteHandoffStorage` on a temp DB, set active) with a feature at `code-reviewer:In_Progress` and one PRD chunk stored for the workspace (`upsertPrdChunks`), when `code-reviewer` writes `PASS` with `qa_review` and `review_task_ids` / `completed_tasks` set (accepted), then `getPrdIndexMeta(<workspace>)` is `null`; control: a non-PASS write leaves the chunk. Without the SQLite binding the test skips with a visible reason (`t.skip("<reason naming better-sqlite3>")`, import guarded like `test/e435-remove-old-path.test.mjs` line 26), never a silent pass. Mutation M4: `dist/tools/handoff-orchestrator.js` GC hook, `parsed.agent_id === JUDGE_ROLE &&` (the one directly followed by `"deletePrdChunks" in storage`) → `parsed.agent_id === "qa-engineer" &&` — the chunk survives.
  proof: the AC8 test, green on the branch, red under M4 (with the binding present).

### E461 (5)(9b) — `test/e435-remove-old-path.test.mjs`

- **AC9** — Given a schema 16 handoff payload carrying `chain_path`, `qa_round` and `qa_rounds_total`, when the AC4 test (base ~187, the lazy-migration test) runs the v16 → v17 step through the public runner (`runMigrations("handoff", …)` from `dist/schema/versions.js`) in addition to today's parse and heal checks, then the result has none of the three fields and keeps every other field. Mutation M5: `dist/schema/migrations-handoff.js` v16 → v17 `up` returns `{ ...input, schema_version: 17 }` (version bump only) — the AC4 test turns red (today only `test/handoff-migration.test.mjs` does).
  proof: `node --test --test-name-pattern "AC4" test/e435-remove-old-path.test.mjs` green on the branch, red under M5.
- **AC10** — Given the e435 AC9 test (base ~293), when the SQLite binding is absent, then it still reports a skip with its reason (`better-sqlite3 not installed`) — unchanged, the re-check found it already visible; the new AC8 test follows the same pattern. Verification (no mutation of test logic): in a throwaway copy, replace `dist/tools/storage-sqlite.js` with a module that throws on import; `node --test test/e435-remove-old-path.test.mjs <the new e461 file>` exits 0 and its output shows `# SKIP` with the reason for e435 AC9 and for AC8.
  proof: the copy run above; both SKIP lines carry a reason.

### E461 (6) — `test/e419-retired-write-mechanisms.test.mjs`

- **AC11** — Given a workspace with both a handoff and a task list (at least one task, e.g. via `tw_add_task`), when `detectDrift` runs, then the report is the full report (it lists the seeded task in `tasksIncomplete` or `tasksCompleted`, and `details` is not one of the early-return lines) and has no `stampAdvisory` key. Today's two cases (hand-written stamp without a task list, fresh project) stay. Mutation M6a: `dist/tools/drift.js` final report object (the last one, before the last `return JSON.stringify(report);`) gains `stampAdvisory: null,` — the new case turns red.
  proof: `node --test --test-name-pattern "AC8" test/e419-retired-write-mechanisms.test.mjs` green on the branch, red under M6a.
- **AC12** — Given the boundary test (base ~130–141, empty `active_feature` with `bookkeeping_write: true`), when the write is rejected, then the test accepts only the tool-boundary schema rejection of `active_feature` (a zod error whose issue has path `["active_feature"]` and code `too_small`, observed on base as a thrown `ZodError`) and fails on any other throw or error result. Mutation M6b: `dist/tools/registry.js` `active_feature: z.string().min(1).max(500),` → `active_feature: z.string().max(500).transform((v) => { if (v === "") throw new Error("BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE: empty active_feature"); return v; }),` — base's test still passes under it (any throw counts); the new test turns red.
  proof: `node --test --test-name-pattern "boundary" test/e419-retired-write-mechanisms.test.mjs` green on the branch, red under M6b.

### E461 (7) — `test/e422-ticket-file.test.mjs`

- **AC13** — Given a ticket directory holding `ReadMe.md` (passes the `.md` filter; only the case-insensitive name check drops it) and one ticket file, when `scripts/check-tickets.mjs` runs with no arguments, then only the ticket file is checked (`1 file(s)`). Use one README spelling per directory (macOS file systems fold case). Mutation M7a: `dist/tools/ticket-file.js` `name.toLowerCase() !== "readme.md"` → `name !== "README.md"` — `ReadMe.md` is checked and fails.
  proof: the new AC10 README-case test in `test/e422-ticket-file.test.mjs`, green on the branch, red under M7a.
- **AC14** — Given a ticket with a field named `rounding`, when it is checked, then it is reported as `unknown field "rounding"` and not as `forbidden field name "rounding"` (forbidden names match whole words: `round` is listed, `rounding` is not it). Mutation M7b: `dist/tools/ticket-file.js` `words(name).includes(words(listed))` → `name.toLowerCase().includes(listed)` — `rounding` is reported forbidden.
  proof: the new AC3 word-boundary test in `test/e422-ticket-file.test.mjs`, green on the branch, red under M7b.

### E461 (8) — resident pin

- **AC15** — Given `test/e433-test-first-rules.test.mjs` AC12, when `CLAUDE.md`'s line count changes, then AC12 stays green: the `CLAUDE.md is 250 lines` assertion (base line 561) is removed; the gate count, pipeline length and the closed-range checks (which list `CLAUDE.md` among files unchanged in E433's own fixed range) stay. `CLAUDE.md` itself is not edited. Inverse check: append one line to `CLAUDE.md` in a throwaway copy — AC12 is red on base, green on the branch.
  proof: `node --test --test-name-pattern "AC12" test/e433-test-first-rules.test.mjs` in a copy with one line appended to `CLAUDE.md`: red on base, green on the branch.

### E461 (9a) — `scripts/smoke-qa-flow.mjs`

- **AC16** — Given the smoke's "qa-engineer PASS rejected" probe (base lines ~103–115), when the server rejects the qa-engineer PASS, then the probe records `[PASS]` only when the text carries the tool-boundary judge rejection `status="PASS" requires agent_id="code-reviewer": code-reviewer is the judge` and the write did not succeed; any other failure (including the orchestrator's defence-in-depth `BLOCKED … reserved for code-reviewer` or a `TRANSITION_REJECTED` whose text names code-reviewer) records `[FAIL]`. Mutation M9a: `dist/tools/registry.js` `if (d.status === "PASS" && d.agent_id !== "code-reviewer") {` → `if (false) {` — on base the probe still prints `[PASS]` (the orchestrator's message names code-reviewer); on the branch it prints `[FAIL]`.
  proof: `node scripts/smoke-qa-flow.mjs`, the `qa-engineer PASS rejected` line: `[PASS]` on the branch, `[FAIL]` under M9a. (The smoke's overall exit code is not the proof: see *Findings for the integrator*.)

### Lane-wide

- **AC17** — Given the lane branch, when the full suite runs (`node scripts/test-lock.mjs -- npm test`), then it has 0 failures, and no file outside the Cut `touches` changed (`git diff --name-only 83ca8c0` lists only those paths plus governance bookkeeping).
  proof: `node scripts/test-lock.mjs -- npm test` exit 0; `git diff --name-only 83ca8c0..HEAD`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no served text changes: the lane edits tests and the dev-only `scripts/smoke-qa-flow.mjs` probe (its record label may be reworded; not served to any agent or user) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E461 (3) (design mode, `gates/visual.ts`): lane e462.
- Any source, `content/**`, `docs/**`, `dist/**`, compose golden or `test/context-budget.test.mjs` change; `CLAUDE.md` is not edited.
- Assertions that read the source text of an e462-owned file (`tools/handoff-orchestrator.ts`, `tools/handoff-types.ts`, `tools/transitions.ts`, `gates/registry.ts` comments and the rest of the e462 row).
- `test/e431-test-first-server-path.test.mjs` (owned by e462), `test/handoff-migration.test.mjs` and `test/rag-lifecycle.test.mjs` (not named: the new tests do not need them).
- The orchestrator's own PASS judge check (already caught by four tests, per the ticket's closing note).
- The smoke's base failure in its last probe (see *Findings for the integrator*).

## Dependencies / Prerequisites

- Merge order e462 → e461 (manifest). Nothing here reads text e462 changes: the pairing rule scans the five composed prompts (const-06, the qa / sr / code-reviewer / pm SOPs and the coordinator fragments, none in e462's set), and the sr_return / RAG tests are behavioural (e462 changes no behaviour). The integrator re-runs the suite on the merged branch.
- If the pairing rule finds a real violation in current served text, qa stops and mails the integrator (content is not this lane's; manifest 讀對方檔案文字 row). PM probe found none on base.
- Node 20 and 22 (CI matrix): any base text a test compares against is read into memory at capture time; no test reads a temp directory again after the fact; no `git show` (the T-E77-02 meta-test blocks it). The new tests read only live files and temp workspaces.
- SQLite binding: AC8 and e435 AC9 skip with a visible reason when `better-sqlite3` cannot load.
- No design source (mode no-design). No external references (Resource Audit: the ticket and the manifest cite only repo paths).

## Gate Summary

- Visual State-Count Split / Geometric-Density Split: not applicable (no visual surface).
- Parallel-Lane Cut: the lane is one ticket (E461 minus (3)), cut by the integrator.
- Scope Decision: single feature — one ticket, tests only, one owned set.
- Resource Audit: zero external refs.
- Question Batch / Ambiguity: none open inside the cut. Every placement and mutation is fixed above.
- Expected-red manifest: **zero entries.** Every new or tightened test is green on base (they pin current behaviour), so qa writes `qa_reports/expected-red_e461-mutation-test-gaps.txt` with header comment lines only; the qa → sr hand-off check reads only that the file exists.
- Cut-Approval: not set by PM; the coordinator writes `cut_approved` after the integrator's pre-review `close` (manifest tier per Constitution §3.1).

manifest-tier: no option choice, no needs-human-ruling item

## Probe — baseline at `83ca8c0`

**Baseline** (PM, 2026-11-25, worktree at `83ca8c0`, untouched, `node scripts/test-lock.mjs -- npm test`): **4668 tests, 4666 pass, 0 fail, 2 skipped, exit 0.** No red file. The 2 skips are the history-dependent e130 closed-range checks (AC4, AC14: commit `121ddc8` not in this history), not lane-related.

**Tests red only because of this lane: none expected.** The cut changes no file outside its own `touches` (tests and the dev-only smoke script); no source, content, golden or budget file moves, so no other test reads anything this lane changes. The manifest's estimate for e461 (0) holds.

**Mutation probe** (PM, throwaway copies of `dist/` + `content/` under the PM scratchpad, never the worktree): M1a appended to const-06 → the pairing rule finds 1 violation in each of the five composed prompts (0 on base); M1b in the qa SOP → 1 violation (0 on base); M2a → `sr_return_count` 3 (base 1); M2b → `SR_RETURN_CAP_EXCEEDED` (base accepted); M2c → healed v17 file has no `sr_return_count` and the third return is accepted (base: kept, rejected); M2d → `qa-engineer:In_Progress` loses the "only legal if the next write opens a new feature" annotation at count 2; M4 → the chunk survives the code-reviewer PASS (base: `getPrdIndexMeta` null); M6b → a plain `Error` naming the retired code is thrown instead of the `ZodError` (base test still passes); M9a → the smoke's qa PASS line still prints `[PASS]` with the orchestrator's `BLOCKED … reserved for code-reviewer` text. M1c, M1d, M5, M6a, M7a, M7b follow the ticket's re-check (each survives today's suite).

## Findings for the integrator (not in this cut)

- `scripts/smoke-qa-flow.mjs` already fails on base: its last probe ("code-reviewer PASS with qa_review accepted + evidence file written") is rejected `MISSING_REVIEW_EVIDENCE` (a file-mode code-reviewer PASS now needs `review_reports/review_<id>.md`), so the smoke prints `11/12` and exits 1 on base. The smoke is in this lane's owned set but the fix is not an E461 item; the cut leaves it alone and AC16 is judged on its own probe line. Fold-in (seed `review_reports/review_X1.md` before that probe) is the integrator's call.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E461 | mutation-verified test gaps except (3): AC1/AC3/AC4 pairing rule + qa step 7 `next_role` + sr return-route status; `CLAUDE.md` line pin removed; four `sr_return` mutation tests and the SQLite RAG judge-PASS cleanup test in a new file; e435 AC4 migration drop; e419 full drift report + exact boundary rejection; e422 README case + word boundary; smoke accepts only the judge rejection | — | 5 tests + 1 new test + 1 script | `test/e433-test-first-rules.test.mjs`、`test/e435-remove-old-path.test.mjs`、`test/e419-retired-write-mechanisms.test.mjs`、`test/e422-*.test.mjs`、`test/e461-*.test.mjs`、`scripts/smoke-qa-flow.mjs` | — |

## Test placement (fixed for qa)

| item | AC | file |
|---|---|---|
| (1) | AC1, AC2, AC3 | `test/e433-test-first-rules.test.mjs` (AC1, AC3, AC4 tests, in place) |
| (8) | AC15 | `test/e433-test-first-rules.test.mjs` (AC12, delete one assertion) |
| (2), (4) | AC4–AC8 | one new file `test/e461-<name>.test.mjs` (qa names it; matches `test/e461-*.test.mjs`); titles start with the AC id |
| (5), (9b) | AC9, AC10 | `test/e435-remove-old-path.test.mjs` (AC4 test extended; AC9 unchanged) |
| (6) | AC11, AC12 | `test/e419-retired-write-mechanisms.test.mjs` |
| (7) | AC13, AC14 | `test/e422-ticket-file.test.mjs` (the only e422 file touched) |
| (9a) | AC16 | `scripts/smoke-qa-flow.mjs` |

## Tasks

Order: qa T-01 … T-04 → sr T-05 … T-08 → code-reviewer judges every id and writes PASS. Mutations live only in throwaway copies; nothing mutated is committed. sr never edits a qa-written test.

- [ ] T-E461-01 [P0] qa-engineer: `test/e433-test-first-rules.test.mjs` — pairing rule in AC1 (replaces the keyword filter), qa SOP pairing + step 7 `next_role` in AC3, return-route 1 status in AC4, remove the `CLAUDE.md` 250-line assertion in AC12; base green, each of M1a–M1d red; test report section | AC1, AC2, AC3, AC15 | depends_on: none
- [ ] T-E461-02 [P0] qa-engineer: new `test/e461-*.test.mjs` — AC4–AC7 (`sr_return`, one test per mutation M2a–M2d) and AC8 (SQLite RAG cleanup, skip with reason without the binding) | AC4–AC8, AC10 | depends_on: none
- [ ] T-E461-03 [P0] qa-engineer: `test/e435-remove-old-path.test.mjs` AC4 (M5), `test/e419-retired-write-mechanisms.test.mjs` AC8 full report + exact boundary rejection (M6a, M6b), `test/e422-ticket-file.test.mjs` README case + word boundary (M7a, M7b) | AC9, AC10, AC11, AC12, AC13, AC14 | depends_on: none
- [ ] T-E461-04 [P0] qa-engineer: `scripts/smoke-qa-flow.mjs` qa PASS probe (M9a); `qa_reports/expected-red_e461-mutation-test-gaps.txt` with zero entries; `qa_reports/tests_e461-mutation-test-gaps.md` listing every mutation and its observed red/green | AC16, AC17 | depends_on: T-E461-01, T-E461-02, T-E461-03
- [ ] T-E461-05 [P0] sr-engineer: confirm nothing to build for AC1–AC3, AC15 (no source / content change needed; the qa tests are green on the unchanged source); run `test/e433-test-first-rules.test.mjs` | AC1, AC2, AC3, AC15 | depends_on: T-E461-04
- [ ] T-E461-06 [P0] sr-engineer: confirm nothing to build for AC4–AC8, AC10; run the new e461 file | AC4–AC8, AC10 | depends_on: T-E461-04
- [ ] T-E461-07 [P0] sr-engineer: confirm nothing to build for AC9–AC14; run the e435, e419, e422 files | AC9–AC14 | depends_on: T-E461-04
- [ ] T-E461-08 [P0] sr-engineer, last: run `node scripts/smoke-qa-flow.mjs` (AC16 line) and the full suite on a clean tree, confirm the manifest still lists zero reds and `git diff --name-only 83ca8c0..HEAD` stays inside the Cut `touches`; hand off to code-reviewer | AC16, AC17 | depends_on: T-E461-05, T-E461-06, T-E461-07

### Task Budget Map

| task | role | files | est. changed lines |
|---|---|---|---|
| T-E461-05 | sr | 0 (run only) | 0 |
| T-E461-06 | sr | 0 (run only) | 0 |
| T-E461-07 | sr | 0 (run only) | 0 |
| T-E461-08 | sr | 0 (run only) | 0 |
