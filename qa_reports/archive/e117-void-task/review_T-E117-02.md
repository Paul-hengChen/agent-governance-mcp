# QA Review — T-E117-01 / T-E117-02

covers: T-E117-01, T-E117-02

## Context

Feature `e117-void-task`. No `specs/e117-void-task.md` or `design/e117-void-task.md`
exist — per the coordinator's `scope_decision_why`, the backlog E117 row
(`docs/backlog.md`) IS the contract for this mini-chain (PM/architect
skipped). The acceptance point the ticket names is the E112 live
consequence: `tw_get_next_task` must stop offering a voided row, in both
storage modes.

T-E117-01 (implementation) was reviewed by code-reviewer across three rounds
(`review_reports/review_T-E117-01.md`) and reached **APPROVED** at round 3.
T-E117-02 (this task) is qa-owned test coverage.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e117-void-task.txt` manifest declared).
There is exactly one pre-existing red in the suite, and it is not feature
`expected-red` machinery — it is a test-side count assertion that must move
with the feature (see Phase 4).

## Phase 1 — Review

Read the full three-round review (`review_reports/review_T-E117-01.md`) and
the implementation directly (`tools/tasks-file.ts` `voidTaskInFile`,
`tools/storage-sqlite.ts` `voidTaskStmt`/`voidTask`, `tools/storage.ts`
interface + `FileHandoffStorage` delegate, `tools/tasks.ts`
`voidTask`/`handleVoidTask`, `tools/registry.ts` `tw_void_task` entry).

Independently re-verified, not taken on the review's say-so:
- Option (a)/(b) boundary: `TaskRecord`, `parseTaskLine`, `DEFAULT_TASK_REGEX`
  untouched; no SQLite schema/DDL change; no `schema_version` bump.
- The four mutating-tool obligations present in `voidTaskInFile`:
  `withFileLock`, `verifyFreshness("tasks")` inside the lock, `atomicWrite`
  (tmp + `fs.renameSync`), `refreshSnapshotFor` on the success path only.
- `handleVoidTask` calls `enforcePreFlight(parsed.workspace_path,
  "tw_void_task")` as its first statement, matching every sibling handler —
  pinned by execution in this file's Section 6, not by reading the source.
- The C5 post-write guard asserts the invariant against `newContent` — the
  exact binding passed to `atomicWrite` — not a hand-rebuilt string. Verified
  by execution (Section 3 below), including a compound case (newline +
  `$&`).

No Copy/Strings or Visual Tokens H2 exists in any spec for this feature
(there is no spec file) — Phase 1.5/3a/3b gates are inapplicable, logged as
skipped per the SOP's absent branches.

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines — this is a
server-side tool, not a UI feature).

## Phase 2 — Discussion

No issues found in Phase 1 that code-reviewer's three rounds had not already
resolved. Proceeding directly to Phase 3.

## Phase 3 — Tests

### 3a. Test file placement

Per the dispatch brief: `test/tasks.test.mjs` is the existing home for
task-mutation tests, but the surface here (two storage modes, five review
rounds' worth of pinned properties) is large enough to deserve its own file.
Created **`test/e117-void-task.test.mjs`** (creation pre-authorized by the
brief). Also fixed the one expected red at
**`test/e26-gate-stats.test.mjs:469`** (T2): `TOOL_REGISTRY` now has 13
entries (was asserted at 12), because `tw_void_task` is correctly
registered — updated the count, the duplicate-check count, and the
descriptive text; added `tw_void_task` to the assertion.

### 3b. AC → test map

No `specs/e117-void-task.md` exists, so the map is against the backlog E117
row's stated acceptance point plus the properties three rounds of
code-review turned on (per the dispatch brief, this IS the acceptance
surface for this ticket):

| Property | Test(s) in `test/e117-void-task.test.mjs` |
|---|---|
| E112 live consequence (voided row never re-offered), both modes | "E112 (file mode): ..." , "E112 (SQLite mode): ..." |
| C1 — completion guard reads the ledger, not just the tasks.md mirror, both modes, incl. the divergent (handoff-ahead-of-tasks) state | "C1 (file mode): ...", "C1 (file mode) positive control: ...", "C1 (SQLite mode): ..." |
| C2 — custom `taskPattern` under which the void marker still parses is refused, loudly, file untouched | "C2: a custom taskPattern ..." |
| C5 — `reason` with a newline (and the newline+`$&` compound) is refused, file untouched | "C5: a reason containing a newline ...", "C5 compound: ..." |
| Q1 — file mode distinguishes already-voided from never-existed; SQLite is uniform not-found for both | "Q1 (file mode): ..." (x2), "Q1 (SQLite mode): ..." |
| Invisibility to `parseTasksFromFile`/`tw_detect_drift`/`tw_sync`, and the original C1 regression (a refused void must not erase a real drift signal) | "a voided row (not in the ledger) never surfaces as drift ...", "REGRESSION (the original C1 bug): ...", "tw_sync (reconcileTasks) never attempts ...", "SQLite: a voided row never surfaces as drift ..." |
| Basic contract: not rollback/complete, id reuse, `[x]` refusal, unknown id | Section 0 tests |
| Registry/dispatch wiring | Section 6 tests |

Deliberately NOT covered (per the dispatch brief — filed as separate,
non-blocking backlog rows, and NOT to be fixed here): C3 (SQLite `DELETE`
discards `reason`), C4 (re-cut id inherits stale review/QA evidence — a
`gates/` fix), C6 (`` $` ``/`$'` splicing — shared with
`rollbackTaskInFile`/`completeTaskInFile`/`addTaskInFile`, out of scope
because void's own contract is satisfied in every C6 repro per round 3's own
criterion). I did not touch any of those code paths.

### 3c. Coverage gate

New/modified production surface for this feature is `voidTaskInFile`
(`tools/tasks-file.ts`), `SqliteHandoffStorage.voidTask`
(`tools/storage-sqlite.ts`), the `FileHandoffStorage` delegate
(`tools/storage.ts`), and `voidTask`/`handleVoidTask`
(`tools/tasks.ts`). 25 tests in `test/e117-void-task.test.mjs` exercise
every branch: success path, unknown-id, already-voided, already-completed
(mirror and ledger), the custom-taskPattern refusal, the newline/`$&`
refusals, both Q1 arms in both modes, drift/sync invisibility, the
regression pin, and the registry/pre-flight wiring. No coverage-measurement
tool is wired into this repo's `npm test`; noting explicitly per the SOP
rather than fabricating a percentage. Manual branch inventory against the
implementation: every `return JSON.stringify({error...})` / `{success:
true}` branch in `voidTaskInFile` and in `SqliteHandoffStorage.voidTask` is
hit by at least one test.

### 3d. Security smoke tests

Boundary inputs exercised: empty/unknown task id (never-existed), an
already-voided id (re-void), a `reason` containing a newline (raw
injection), a compound `reason` combining a newline with `String.replace`
replacement syntax (`$&`). No auth/permission surface on this tool (no
`agent_id` gate, matching `tw_add_task`/`tw_rollback_task` by design,
reviewed and accepted in `review_reports/review_T-E117-01.md` Security
section) — pinned instead: `handleVoidTask` still requires the pre-flight
`tw_get_state` read before it can act (Section 6).

## Phase 3.5 — AC Execution Log

Skipped (no `specs/<active_feature>.md`, therefore no `proof:`-annotated
ACs).

## Phase 4 — Run

Checkpoint recorded via `tw_update_state` before the full regression run
(see handoff `pending_notes`).

- `npx tsc --noEmit`: **exit 0**, no output.
- `npm run build`: clean (`tsc` to `dist/`, `check:version` OK, `check:
  transitions-sync` OK — 21 keys, exact match).
- `npm test` (full suite, `node --test test/*.test.mjs`): **1840/1840
  pass, 0 fail.** This includes the previously-red
  `test/e26-gate-stats.test.mjs` (now green after the count fix) and
  `test/render-structure.test.mjs` (10/10, confirmed green — the
  `pending_notes` handoff-injection hazard the dispatch brief warned about
  was avoided by keeping all quoted task-row text in this doc, not in a
  `pending_notes` string).
- `test/e117-void-task.test.mjs` in isolation, run 3x to rule out flakiness:
  **25/25 pass** every run (one transient failure was found and fixed
  during authoring — see note below — not present in the final file).

### Note: a real hazard found and fixed while authoring the tests (not a defect in the sr-engineer's diff)

An early draft of "E112 (file mode)" called `getNextTask(ws)` (read-only)
between seeding a workspace and calling `voidTask`. This reproducibly
tripped `⛔ STATE DRIFT` on the *tasks* file, even though nothing in the
test modified it. Root cause: `getNextTaskFromFile`'s lazy heal-on-read
migration (`tools/tasks-file.ts`) does an **unlocked** `atomicWrite` the
first time it reads a `tasks.md` with no (or a stale) `schema_version`
sentinel, which bumps the file's mtime out from under the
`markStateRead()` freshness snapshot taken moments earlier. Fixed on the
test side by seeding every workspace's `tasks.md` with the current
sentinel (`<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->`), matching
the convention already used by `test/drift-archived-tasks.test.mjs` /
`test/drift-baseline.test.mjs`. This is pre-existing behavior in
`getNextTaskFromFile`, unrelated to `voidTaskInFile`, and out of scope for
E117 — not filed as a new backlog row since it only manifests when a
caller constructs a non-current tasks.md by hand (real workspaces are
created via `agc init` with a current sentinel already in place).

## Verdict

**PASS** for both T-E117-01 and T-E117-02.

- T-E117-01: code-reviewer APPROVED at round 3; QA's own Phase 1 review
  found nothing further blocking; build and full suite verified green by
  me independently (not taken on the review's numbers, which round 3 itself
  flagged sr-engineer had misreported once).
- T-E117-02: 25 new tests added in `test/e117-void-task.test.mjs`, mapped
  to every property named in the dispatch brief; the one expected red
  (`test/e26-gate-stats.test.mjs` T2) fixed; full suite 1840/1840; `tsc
  --noEmit` clean.

Not fixed here, by design (see dispatch brief and Phase 3b above): C3, C4,
C6. These remain the coordinator's/release-engineer's to file as their own
backlog rows, per code-reviewer round 3's explicit instruction that the
round-2-opened row must be widened to cover the full `$`-expansion class.
## 2026-09-15T05:30:45.180Z — PASS — by qa-engineer

PASS. T-E117-01 (tw_void_task impl): code-reviewer APPROVED at round 3 (review_reports/review_T-E117-01.md); QA independently re-verified the option-(a) scope boundary, the four mutating-tool obligations, and the C5 post-write guard by execution. T-E117-02 (qa tests): added 25 tests in test/e117-void-task.test.mjs covering the E112 acceptance point (both storage modes), C1 (ledger-authoritative completion guard, both modes, incl. the divergent handoff-ahead-of-tasks state), C2/C5 (post-write invariant refusals under a custom taskPattern and a newline/newline+$& reason, file left byte-untouched), Q1 (file mode distinguishes already-voided from never-existed; SQLite is uniform not-found for both), invisibility to parseTasksFromFile/tw_detect_drift/tw_sync plus a regression pin for the original C1 bug (a refused void must not erase a real drift signal), and registry/pre-flight dispatch wiring. Also fixed the single expected red: test/e26-gate-stats.test.mjs T2 (TOOL_REGISTRY count 12->13 for tw_void_task), updated count + descriptive text. Verified independently: npx tsc --noEmit exit 0; npm run build clean; full suite npm test 1840/1840 pass, 0 fail; test/e117-void-task.test.mjs run 3x isolated, 25/25 every run. Not fixed (per dispatch brief, filed as separate non-blocking backlog rows, code paths untouched): C3 (SQLite DELETE discards reason), C4 (re-cut id inherits stale review/QA evidence), C6 ($-backtick/$-quote String.replace splicing, shared with rollbackTaskInFile/completeTaskInFile/addTaskInFile). Evidence: qa_reports/review_T-E117-02.md (covers T-E117-01, T-E117-02).

