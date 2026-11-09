# e247-qa-pass-unticked-gate

Lane `e247` of fan-out wave A (`specs/fanout-backlog-wave-a.md`, lane row `e247`). Tickets: E247 (absorbs E237), E396, E380. Base `2425e04`.

## Problem Statement

A qa-engineer PASS is terminal: there is no `qa-engineer:PASS -> qa-engineer:In_Progress` edge. When qa passes a lane but leaves another role's task unticked and missing from `completed_tasks`, the lane must take two extra hops (PASS -> pm amend -> qa resume -> PASS), or qa ticks the ledger and hand-writes evidence after PASS. The second path leaves `completed_tasks` short and the roll-up reports an evidence mismatch (E247's two instances; E237's drift that cannot be cleared). Separately, lane e391 saw a qa PASS rejected twice with `EXPECTED_RED_DIFF_MISSING` (two fires in that lane's archived telemetry) while its `## Expected-Red Diff` section sat in a `covers:` file named `review_E391.md`. Renaming the file to `review_T-E391-01.md` let the same write pass (E396). Reading the code gives a candidate mechanism: `QA_REVIEW_RECORD` creates `qa_reports/review_<id>.md` for every PASS'd id before `PASS_EXPECTED_RED_DIFF` runs, and `hasExpectedRedDisposition` reads the direct file whenever it exists, so it never looks at the covering file. This lane reproduces that first. Finally, the qa SOP never tells qa to fill E161's `qa_suite_result`, so the structured suite figure is not recorded in practice (E380).

## User Stories

- As a lane coordinator, I want a qa PASS to be refused while the feature's ledger still has an open task outside `completed_tasks`, so that the missing task is caught before PASS becomes terminal and no two-hop detour or hand-written evidence is needed.
- As a qa-engineer, I want the rejection to name every open id, so that I can add them to `completed_tasks` (with evidence) or void a dropped one in one retry.
- As a qa-engineer, I want a `covers:` evidence file to clear the expected-red PASS check even after the server has auto-created per-id review files, so that a covering report works whatever it is named.
- As an integrator reading evidence, I want qa to pass `qa_suite_result` on PASS and FAIL, so that the suite figure is a server-formatted line, not prose.

## Acceptance Criteria

Terms. **Feature lane ledger**: the path `findTasksFile(workspace)` (`tools/config.ts`) returns when it (a) sits exactly one directory below `<workspace>/.current/`, (b) that directory's name `<L>` does not start with `_`, and (c) the lowercased `active_feature` equals `<L>` or starts with `<L>-`. **Open task**: a row that `storage.listTasks` returns from that ledger with `completed: false`. Voided `- [-]` rows are never returned by that reader. **Completed set**: this write's `completed_tasks`, plus the on-disk `prevState.completed_tasks` unless `active_feature` changes on this write. **Post-PASS row**: a row whose description (after an optional `[P<digit>]` tag and whitespace) starts with the word `release-engineer` or `doc-writer`.

E247 (gate, T-E247-03; tests T-E247-06):

- **AC1**: Given a file-mode workspace with a feature lane ledger that has open, non-post-PASS rows whose ids are not in the completed set, when an `agent_id="qa-engineer"` `status=PASS` write runs, then it is rejected with the `e247.envelope` text. That text lists every such id once, in ledger order. The handoff is not written, and any evidence `QA_REVIEW_RECORD` appended on this write is undone (existing `evidenceUndoByCtx` path).
  proof: `node --test --test-name-pattern "AC1" test/e247-pass-tasks-incomplete.test.mjs` exits 0.
- **AC2**: Given the AC1 ledger, the PASS lands when each open id is (a) in this write's `completed_tasks` with its QA evidence, or (b) in the on-disk `completed_tasks` of the same feature, or (c) ticked `[x]`, or (d) voided via `tw_void_task`.
  proof: `node --test --test-name-pattern "AC2" test/e247-pass-tasks-incomplete.test.mjs` exits 0.
- **AC3**: Post-PASS rows (`release-engineer ...`, `[P2] doc-writer: ...`) never block. A row that only mentions one of those words later in its description (for example `qa-engineer: verify release-engineer notes`) still blocks.
  proof: `node --test --test-name-pattern "AC3" test/e247-pass-tasks-incomplete.test.mjs` exits 0.
- **AC4**: The gate is dormant (the write behaves exactly as before) when any of these holds: the storage is not `FileHandoffStorage`; the status is not PASS; `findTasksFile` returns null or a legacy or configured path that is not a lane ledger; the ledger directory is `_primary` or any `_`-prefixed name; the ledger directory does not match the feature token (ledger `.current/e900/` with feature `e9001-x` or `e901-x`); `listTasks` returns null. A ledger parse error thrown by `listTasks` propagates and the write fails loudly, the same as every other ledger reader (E131).
  proof: `node --test --test-name-pattern "AC4" test/e247-pass-tasks-incomplete.test.mjs` exits 0.
- **AC5**: `GATE_REGISTRY` has exactly one new entry, `PASS_TASKS_INCOMPLETE` (producer `orchestrator`, envelope `plain-text`, `documentedInProse: true`, fields per Copy/Strings). It is inserted after `AC_EXECUTION_LOG_MISSING`, so the last catalog entry stays `DISPATCH_PIN_TIER_REJECTED`. The doc-file mapping comment gains the row `PASS_TASKS_INCOMPLETE  skill-qa-engineer.md`, and the registry holds 36 entries.
  proof: `node --test test/error-code-contract.test.mjs` exits 0.
- **AC6**: `UPDATE_STATE_GATE_PIPELINE` has 19 steps. The new step `{ name: "PASS_TASKS_INCOMPLETE", codes: ["PASS_TASKS_INCOMPLETE"] }` is at index 13, directly after `QA_COMPLETION_EVIDENCE_MISSING` and before `PASS_MISSING_EVIDENCE`. Neighbouring step bodies are not edited or re-indented.
  proof: `node --test test/e35-pipeline-order.test.mjs` exits 0.
- **AC7**: Ordering. A PASS that both omits an open id and newly adds an id with no evidence is rejected with `QA_COMPLETION_EVIDENCE_MISSING` (the earlier step). A rejection by the new gate appends one telemetry line with `error_code: "PASS_TASKS_INCOMPLETE"`.
  proof: `node --test --test-name-pattern "AC7" test/e247-pass-tasks-incomplete.test.mjs` exits 0.
- **AC8**: `gates/open-tasks.ts` and `tools/handoff-orchestrator.ts` contain none of the substrings `lane-paths`, `resolveCurrentLane` or `resolveLanePaths`, so the importer allow-lists in `test/lane-paths.test.mjs` (lane e381) stay green unedited. Neither file adds any other upper-snake token that ends in a gate-code suffix.
  proof: `grep -cE "lane-paths|resolveCurrentLane|resolveLanePaths" gates/open-tasks.ts tools/handoff-orchestrator.ts` prints `:0` for both files.
- **AC9**: `content/skill-qa-engineer.md` line 90 equals `qa.pass-write` byte for byte. The PASS write lists every task of the feature, not only qa's own (E237 (a)), and backtick-quotes `PASS_TASKS_INCOMPLETE`. Line 52 (lane e255) is unchanged.
  proof: `node --test test/e380-qa-suite-result-sop.test.mjs` exits 0.
- **AC10**: The step count reads 19 in `CLAUDE.md` lines 48 and 62, `README.md` lines 69 and 230, and `docs/architecture.md` (line 37 `15 modules` and `19-step`; line 47; line 67; the new row 14 per `e247.arch-row`, with old rows 14-18 renumbered 15-19; line 112 `36 entries`). No other line in those files changes.
  proof: `grep -c "18-step\|18 steps\|35 entries" CLAUDE.md README.md docs/architecture.md` prints `:0` for all three.

E396 (repro T-E247-01, fix T-E247-02):

- **AC11**: Before any `gates/expected-red.ts` change, `test/e396-covers-expected-red.test.mjs` reproduces lane e391's shape. The covering file is `qa_reports/review_E391.md`, holding an H1, the line `covers: T-E391-01, T-E391-02, T-E391-04, T-E391-05, T-E391-06, T-E391-07, T-E391-08` and a `## Expected-Red Diff` section. The cases are: (U1) no per-id files; (U2) a per-id `review_<id>.md` without the H2 exists for every id; (I) an integration case through `handleUpdateState` with the manifest present, a qa PASS over the seven ids and a `qa_review` without the H2, so `QA_REVIEW_RECORD` creates the per-id files before `PASS_EXPECTED_RED_DIFF` runs. Each case's red/green result against the unfixed build is recorded in `qa_reports/review_T-E247-01.md`.
  proof: `qa_reports/review_T-E247-01.md` has a `## E396 Reproduction` H2 naming U1, U2 and I with red or green each.
- **AC12**: If AC11 recorded U2 or I red: after T-E247-02, `hasExpectedRedDisposition` also checks an id's `covers:` file when the id's direct file exists but has no H2. All three cases are green. The existing U6-U13 and I1-I5b in `test/gates-expected-red.test.mjs` and `test/e136-evidence-path-injective.test.mjs` stay green unedited, and the module still uses `encodeEvidenceId` with no `taskId.replace(`. If AC11 recorded all green, `gates/expected-red.ts` has no diff against the base, T-E247-02 is voided with reason `E396 not reproduced (see qa_reports/review_T-E247-01.md)`, and the reproduction test stays as the record.
  proof: `node --test test/e396-covers-expected-red.test.mjs test/gates-expected-red.test.mjs test/e136-evidence-path-injective.test.mjs` exits 0.

E380 (T-E247-04; test T-E247-07):

- **AC13**: The `qa.pass-write` line tells qa to fill `qa_suite_result` from the full suite on PASS and on FAIL.
  proof: `node --test test/e380-qa-suite-result-sop.test.mjs` exits 0.

Lane-wide (T-E247-08):

- **AC14**: `content/skill-qa-engineer.md` is at most 18500 bytes (the cap in `test/e391-prompt-audit-stale-facts.test.mjs`, unedited). It measures 18476 after this lane.
  proof: `wc -c < content/skill-qa-engineer.md` prints a number <= 18500.
- **AC15**: `npm run build` is clean. `dist/` changes only for `dist/gates/open-tasks.*`, `dist/gates/registry.*`, `dist/gates/expected-red.*` (only with T-E247-02) and `dist/tools/handoff-orchestrator.*`. `npm audit --audit-level=high` and `npm run check:bookkeeping` exit 0. The full suite under `node scripts/test-lock.mjs -- npm test` on the final committed HEAD shows 0 fail.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the final HEAD.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e247.code | `PASS_TASKS_INCOMPLETE` | authored-here: the suffix `_INCOMPLETE` is already in the error-code shape rule (`test/error-code-contract.test.mjs` SUFFIX_RE), so no test edit is needed to make the code visible |
| e247.envelope | `⛔ PASS_TASKS_INCOMPLETE: <id>, <id>. Lane ledger <ledger path> has open task(s) not in completed_tasks. ` followed by `e247.hint` | authored-here: same `⛔ CODE: <ids>. <dynamic>. ` + `hintStatic` shape as `QA_COMPLETION_EVIDENCE_MISSING` |
| e247.hint | `A qa-engineer PASS must account for every open task in the feature's lane ledger: add each listed id to completed_tasks with its QA evidence (a covers: line counts), or void a dropped task with tw_void_task, then retry the PASS. Rows whose description starts with release-engineer or doc-writer (post-PASS work) are exempt. See docs/backlog.md E247.` | authored-here: backlog E247 "Scope ruled 2026-11-09" mechanism + D2 |
| e247.trigger | `qa-engineer:In_Progress -> qa-engineer:PASS (every status=PASS write; file-mode only)` | authored-here (registry `triggerEdge`) |
| e247.arm | `status=PASS && featureLaneLedger().armed && listOpenFeatureTasks() non-empty; FileHandoffStorage only` | authored-here (registry `armCondition`; both camelCase names must appear literally in `tools/handoff-orchestrator.ts`, error-code-contract AC2) |
| e247.clear | `every listed id in completed_tasks (this write or on disk for the same feature), ticked, or voided via tw_void_task` | authored-here (registry `clearingArtifact`) |
| qa.pass-write | `   - **PASS** → \`tw_update_state(status=PASS, agent_id="qa-engineer", completed_tasks=[<ids>], qa_review="<summary>", pending_notes=["QA: <task-id> PASS"])\`. \`completed_tasks\` lists every feature task, not only yours (else \`PASS_TASKS_INCOMPLETE\`). Fill \`qa_suite_result\` from the full suite (FAIL too). Server auto-records the review (file: \`qa_reports/review_<id>.md\`; SQLite: \`reports\` row) and checks evidence (else \`MISSING_EVIDENCE\`). \`covers:\` is for pre-PASS manual batch files. Then \`tw_complete_task(<task-id>, agent_id="qa-engineer")\` per completed id.` (the backslashes escape the table cell only; the file line has plain backticks and starts with three spaces) | backlog E247 (E237 (a)) + E380; compact wording fits the 18500-byte cap (D6) |
| e247.arch-row | `│ 14 PASS_TASKS_INCOMPLETE          (gates/open-tasks.ts)         │` (67 columns, same width as its neighbours) | authored-here |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- A `qa-engineer:PASS -> qa-engineer:In_Progress` edge, and any change to the transitions table (`tools/transitions.ts`): human ruling.
- E375 (a gate that requires `qa_suite_result` on PASS): CLOSED.
- Requiring ticked rows to also be in `completed_tasks`. The ruled mechanism checks unticked rows only; E237's drift advisory stays the detector for that case.
- SQLite/HTTP mode: SQLite has no lane ledger, so the gate is file-mode only, like its PASS-path siblings.
- The constitution (`content/const-08-chain-31-mid.md`), compose goldens and `test/context-budget.test.mjs`: not touched. The qa SOP backtick-quote satisfies the error-code contract (D7).
- The `CLAUDE.md` Layout row that lists the `gates/*.ts` module names: outside the owned lines (48, 62). Integrator note.
- The same direct-file-first traversal in `gates/ac-execution.ts` `hasAcExecutionLogDisposition`: outside the owned set (ruling item R3).
- Release bookkeeping (version, CHANGELOG, backlog done-marks): integrator / release-engineer.

## Dependencies / Prerequisites

No `design/<feature>.md`; mode = no-design (no Visual Structural Assertions). No external references. Every cited path is in this repo.

### Decisions (PM)

- **D1, which tasks belong to this feature.** The binding is the lane ledger whose directory name is the feature's leading ticket token: the path `findTasksFile` resolves, one directory below `.current/`, not `_`-prefixed, with `active_feature` equal to `<L>` or starting with `<L>-`. Every row in that ledger belongs to the feature. Why:
  - A fan-out lane runs one feature per worktree, and `tw_add_task` writes into that ledger (E247 says "the lane's task list").
  - The `_primary` ledger collects many features under `## Active`, with free-form ids and no feature boundary, so it is excluded.
  - A legacy root ledger (git-ignored lane path) and a configured `taskPaths` file have no lane binding, so they are excluded.
  - No ledger means dormant.
  - SQLite is excluded (no lane ledger; D8).
  - Section headings are not used: `tw_add_task` defaults to `## Active`. Id prefixes are not used: release and integration features have no derivable token.
  - The rule uses `findTasksFile` (side-effect-free, `tools/config.ts`) and a string comparison, not `tools/lane-paths.ts`, so the e381-owned allow-lists in `test/lane-paths.test.mjs` stay green (AC8).
  - Rows are read with `storage.listTasks`, the same reader as `tw_get_next_task` / `tw_detect_drift`, called only after the lane ledger file is confirmed to exist.
- **D2, post-PASS exemption.** The ruled text is "unticked, non-voided, not in `completed_tasks`". A literal reading would deadlock a ledger holding a release-engineer or doc-writer row: the skill-pm release-bookkeeping rule assigns those to post-PASS roles, qa cannot evidence them before PASS, and voiding loses them. Rows whose description starts with those role words are therefore exempt. This narrows the ruled mechanism (ruling item R2).
- **D3, completed set.** This write's ids, plus the on-disk ids for the same feature. File mode merges a qa list into the on-disk set, so a later PASS that omits ids qa already recorded must not be refused.
- **D4, code and placement.** The code is `PASS_TASKS_INCOMPLETE`, emitted by a new module `gates/open-tasks.ts` exporting `featureLaneLedger(workspacePath, activeFeature)` -> `{ armed, ledgerPath }` and the pure `listOpenFeatureTasks(tasks, completedIds)` -> `string[]`. The new pipeline step sits after `QA_COMPLETION_EVIDENCE_MISSING` (evidence for listed ids is judged first, so its precise message wins) and before `PASS_MISSING_EVIDENCE`. The registry entry goes after `AC_EXECUTION_LOG_MISSING`, so the last catalog code is unchanged.
- **D5, E396 is repro-first and `dispatch_mode` stays feature.** Bugfix mode is feature-scoped and would make the whole lane (a new gate plus SOP text) bugfix. The repro-first discipline is enforced by task order instead: T-E247-01 (qa, red-or-green record) before T-E247-02 (sr). Chain shape: ruling item R1.
- **D6, qa SOP budget.** `test/e391-prompt-audit-stale-facts.test.mjs` caps `content/skill-qa-engineer.md` at 18500 bytes. The base is 18398. A fuller wording (two sentences plus a new bullet) measured 18669. The compact `qa.pass-write` measures 18476, so no test outside the owned set is touched. It drops only redundant words ("Auto-record is unchanged;", "before persisting PASS"). Lane e255 edits line 52 of the same file: the merged file stays under the cap only if e255's net change is at most +24 bytes. Integrator note for the merge check.
- **D7, no constitution change.** The qa SOP quote satisfies `registry ⊆ doc`. Goldens and budgets are unaffected, because the qa SOP is in no compose golden and has no `test/context-budget.test.mjs` cap.
- **D8, failure modes.** `listTasks` returning null means dormant. A thrown ledger parse error propagates, and the orchestrator's existing catch undoes recorded evidence.
- **D9, intentional reds at the sr hand-off.** sr cannot edit tests, so after T-E247-03 the count and order pins are red until qa re-pins them: `test/e35-pipeline-order.test.mjs`, the 35-count tests in `test/error-code-contract.test.mjs`, and, if re-allocated, `test/e26-gate-stats.test.mjs` R1/R2 and `test/e308-single-source-tier-enum.test.mjs` E303-AC12. sr lists them in `qa_reports/expected-red_e247-qa-pass-unticked-gate.txt` before handing to code-reviewer.

### Blast radius (measured on base `2425e04`)

- **Tests that write PASS (38 files match a PASS literal): 0 break.** Every PASS write through `handleUpdateState` / `tw_update_state` / a spawned server runs on a temp workspace without `.git`, which resolves to the `_primary` ledger and leaves the gate dormant. No test file that sets up a `feat/<id>` branch or worktree writes PASS through the handler; those files hand-write handoff frontmatter, mock the handler, or call `writeHandoffState` directly, which runs no gates. This covers:
  - e230's `test/qa-flow.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/dispatch-pins.test.mjs` and `test/e114-cut-approval-inheritance.test.mjs`;
  - e238's `test/feature-lease.test.mjs`, `test/e177b-mailbox-watch.test.mjs`, `test/verify-release.test.mjs`, `test/e132-lane-registry.test.mjs`, `test/teamwork-lite.test.mjs` and `test/usage-accounting.test.mjs`;
  - `test/e177b-lane-status.test.mjs`, `test/e178b-lane-watch.test.mjs`, `test/e284-fanout-handoff.test.mjs`, `test/e339-non-ascii-manifest.test.mjs`, `test/e394-release-script.test.mjs`, `test/e405-release-runner.test.mjs` and `test/feature-rollup.test.mjs`.
  T-E247-08's full suite confirms this. Any red there that is not on the list below means STOP and mail the integrator, never a re-pin.
- **Breaks inside the owned set (qa re-pins):**
  - `test/e35-pipeline-order.test.mjs`: 18 -> 19, the new step at index 13, header comments.
  - `test/error-code-contract.test.mjs`: the count 35 -> 36 at the AC-1/AC-5 title and asserts (~:118-135), the mapping-comment count (~:503-507) and the E308/AC3 asserts (~:684-685).
  - `test/e128-orchestrator-blocked-repair.test.mjs`: prose only, "18-step" in the header comment and test title (~:3, :53) -> 19-step. No assertion changes.
- **Breaks OUTSIDE the owned set: needs mailbox / re-allocation.** Neither file belongs to e230 or e238, and both break on any E247 design because the registry grows by one entry:
  - `test/e26-gate-stats.test.mjs` ~:70-92: R1/R2 pin `GATE_REGISTRY.length === 35`, plus the titles and comment; it becomes 36. R3 stays green because the last catalog code is unchanged (D4).
  - `test/e308-single-source-tier-enum.test.mjs` ~:91-93: E303-AC12 pins `GATE_REGISTRY.length === 35`, plus the title; it becomes 36.

  Request: the integrator adds both files (those lines only) to e247's owned set. T-E247-06 then re-pins them. Otherwise the integrator re-pins them at the join.
- **Unaffected and verified:**
  - `test/covering-evidence.test.mjs`: `hasEvidenceInFile` is not changed.
  - `test/gates-expected-red.test.mjs` U7 (direct file without the H2 and no covers file means false) stays true after the E396 fix.
  - `test/e161-qa-suite-result.test.mjs`: no SOP pin.
  - The compose goldens and `test/context-budget.test.mjs`.
  - `test/lane-paths.test.mjs` (AC8).
  - `test/e114-cut-approval-inheritance.test.mjs` AC9 (the new module must not mention `cut_approved_source`).
  - `test/e308` E308-AC5 (no `DispatchPinTier`).

### Needs human ruling

- **R1, E396 repro-first chain shape.**
  - (a) Recommended: after cut approval, pm routes to qa with `resume_of: "qa-engineer"` (the e238 ruling-4 mechanism) for T-E247-01. qa then writes `qa-engineer:Blocked` -> `sr-engineer:In_Progress` (an existing edge, no `qa_round` charge) for T-E247-02..05, then code-reviewer, then qa for T-E247-06..08 and PASS. That is about 5 more hops.
  - (b) Standard edges only: pm -> sr (T-03..05) -> code-reviewer -> qa (T-01 repro) -> qa Blocked -> sr (T-02) -> code-reviewer -> qa (T-06..08). That is about 7 more hops, close to the hop cap.
- **R2, the D2 exemption.**
  - (a) Recommended: keep it. A post-PASS-role row (`release-engineer`, `doc-writer`) never blocks the PASS.
  - (b) No exemption. A lane ledger must then never hold post-PASS rows, and PM voids any that exist.
- **R3, `gates/ac-execution.ts` has the same traversal.** `hasAcExecutionLogDisposition` prefers an existing direct file and skips the covering file, so a `covers:`-only `## AC Execution Log` fails the same way once `QA_REVIEW_RECORD` has created the per-id files.
  - (a) Recommended: re-allocate `gates/ac-execution.ts`, `dist/gates/ac-execution.*` and `test/ac-execution.test.mjs` to e247, and add one sr task and one qa case mirroring T-E247-02 (fix only if T-E247-01's pattern reproduces).
  - (b) Leave it out of this wave. The integrator files it.

### Task-id notes

`T-E247-00` is the PM cut hop itself (commit title only), not a ledger row. Code review is a chain hop, not a task row.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E247-01 | qa (E396 repro, first): new `test/e396-covers-expected-red.test.mjs` with cases U1, U2 and I per AC11, run against the unfixed build. Record each case red or green under `## E396 Reproduction` in `qa_reports/review_T-E247-01.md` (AC11). Commit. Hand to sr | none | 1 | `test/e396-*.test.mjs` | — |
| T-E247-02 | sr (E396 fix, only if T-E247-01 recorded U2 or I red): in `hasExpectedRedDisposition`, when an id's direct file exists but lacks `## Expected-Red Diff`, also check the id's `covers:` file (index built lazily, at most once per call). Keep `encodeEvidenceId`, no `taskId.replace(`, never throws. Rebuild `dist/`. If all cases are green, this task is voided per AC12 (AC12) | T-E247-01 | 1 (+dist) | `gates/expected-red.ts`、`dist/gates/expected-red.*` | — |
| T-E247-03 | sr (E247 gate): new `gates/open-tasks.ts` (`featureLaneLedger`, `listOpenFeatureTasks`, per D1-D3, D8). Add one `GATE_REGISTRY` entry `PASS_TASKS_INCOMPLETE` after `AC_EXECUTION_LOG_MISSING`, with Copy/Strings `e247.trigger` / `e247.arm` / `e247.clear` / `e247.hint`, a mapping-comment row and catalog-count comments 35 -> 36. Add one pipeline step at index 13 that emits `e247.envelope`. Do not touch neighbouring step bodies. No `lane-paths` / `resolveCurrentLane` / `resolveLanePaths` substring (AC8). Rebuild `dist/` (of `dist/gates/*` only the `open-tasks` and `registry` outputs change). Write the expected-red manifest per D9 (AC1-AC8) | T-E247-01 | 3 (+dist) | `gates/open-tasks.ts`、`gates/registry.ts`、`tools/handoff-orchestrator.ts`、`dist/gates/*`、`dist/gates/registry.*`、`dist/tools/handoff-orchestrator.*` | — |
| T-E247-04 | sr (E247 + E380 SOP): replace `content/skill-qa-engineer.md` line 90 with `qa.pass-write`, byte for byte. Do not touch line 52 or any other line. The file must stay <= 18500 bytes (AC9, AC13, AC14) | T-E247-03 | 1 | `content/skill-qa-engineer.md` | — |
| T-E247-05 | sr (step-count prose): 18 -> 19 in `CLAUDE.md` lines 48 and 62 and `README.md` lines 69 and 230. In `docs/architecture.md`: line 37 (`15 modules`, `19-step`), line 47, line 67, insert `e247.arch-row` after row 13 and renumber rows 14-18 to 15-19 at the same width, line 112 `36 entries`. Nothing else in those files (AC10) | T-E247-03 | 3 | `CLAUDE.md`、`README.md`、`docs/architecture.md` | — |
| T-E247-06 | qa (E247 tests and re-pins): new `test/e247-pass-tasks-incomplete.test.mjs` with AC1-AC4 and AC7 named per their proofs. Lane workspaces use a temp dir with `.git/HEAD` = `ref: refs/heads/feat/e900-x` and `.current/e900/tasks.md`, plus `_primary`, token-mismatch, legacy-ledger, SQLite and non-PASS dormancy controls. Re-pin `test/e35-pipeline-order.test.mjs` (AC6) and `test/error-code-contract.test.mjs` (AC5), and update the prose in `test/e128-orchestrator-blocked-repair.test.mjs`. If the integrator re-allocates them, re-pin `test/e26-gate-stats.test.mjs` and `test/e308-single-source-tier-enum.test.mjs` 35 -> 36 (blast radius) | T-E247-03, T-E247-04 | 4 | `test/e247-*.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`、`test/e128-orchestrator-blocked-repair.test.mjs` | — |
| T-E247-07 | qa (E380 + E237 (a) SOP pin): new `test/e380-qa-suite-result-sop.test.mjs`. It asserts line 90 equals `qa.pass-write` (every feature task, the `PASS_TASKS_INCOMPLETE` quote, the `qa_suite_result` sentence) and the file is <= 18500 bytes (AC9, AC13, AC14) | T-E247-04 | 1 | `test/e380-*.test.mjs` | — |
| T-E247-08 | qa (lane close): on the final committed HEAD with a clean tree, run every `proof:` and AC15. Run the full suite under `node scripts/test-lock.mjs -- npm test`. Any red outside the blast-radius list means STOP and mail the integrator. Write `## Expected-Red Diff` and `## AC Execution Log`. The PASS lists every T-E247 id (AC1-AC15) | T-E247-02, T-E247-05, T-E247-06, T-E247-07 | 0 | — | — |
