# e125a-lane-local-ledgers

Ticket: **E125a** (the first of three serial lanes E125 was split into on 2026-09-25: D1=A, `specs/fanout-wave6.md`). Cut input (b) only.
Lane `e125a` · branch `feat/e125a-lane-local-ledgers` · base `b0db90e` · next role: architect.

## Problem Statement

Since E123, every lane's handoff and sidecars live in `.current/<lane>/`, so lane branches no longer collide on them. `tasks.md` does not. The task list is still the single file that `tools/config.ts` `findTasksFile` resolves from `taskPaths` (default `.current/tasks.md`, `tasks.md`, `TODO.md`). Every lane appends its rows to the same root `tasks.md` (1111 lines, 545KB), and every lane merge has to reconcile that file line by line (`docs/v4.0.0-execution-plan.md` §2.3). E125 wants the root file to become a history index that `tw_*` never writes, with each lane keeping its own live ledger. E125a builds the enabler: a lane-local `tasks.md` in the `LANE_FILES` registry, a schema bump, a reversible migration from the legacy location, and `tw_*` reading and writing only the lane-local copy. Writeback into the index (E125b) and compaction and SOP prose (E125c) are out of scope.

## User Stories

- As a lane session, I want `tw_add_task` / `tw_complete_task` / `tw_rollback_task` / `tw_void_task` / `tw_sync` to write `.current/<lane>/tasks.md`, so that my branch never edits a file another lane also edits.
- As the integrator, I want the root `tasks.md` to be an index that no `tw_*` tool writes, so that merging a lane never needs line-by-line reconciliation of task rows.
- As an adopter who ran only `agc init`, I want my existing `tasks.md` to keep working after the upgrade with no manual step, so that the upgrade never loses a task.
- As a maintainer, I want the migration to be reversible with a byte-identical round trip, so that a bad release can be rolled back without losing ledger state.

## Decisions settled by this cut

### D-A: `specs/<feature>.md` does NOT move (stays at `specs/<feature>.md`)

Rationale, including the §8b adopter check (`docs/v4.0.0-execution-plan.md` §8b):
1. **§8b.** `specs/` does not exist in a workspace that has only run `agc init`. Only the PM SOP prose creates it, on demand. A `LANE_FILES` entry would make the server responsible for a path that only prose creates and that is absent for most adopters. The server has no existence-independent way to own it.
2. **Forbidden consumers.** `gates/ac-execution.ts:71` hard-codes `path.join(workspacePath, "specs", <feature>.md)`, and the PM, architect, and QA SOPs in `content/**` name `specs/<feature>.md`. Both directories are off-limits to this lane. Moving the spec would break the AC-execution gate and leave the SOP prose wrong.
3. **No collision to solve.** Spec filenames are unique per feature and written once. They never conflict on merge, which is the same reason the Wave 6 card keeps the evidence directories out of per-lane dirs. `tasks.md` moves because every lane appends to one shared file. A spec has no shared file.
4. **Durable references.** `docs/backlog.md`, `CHANGELOG.md`, other specs, and code comments cite `specs/<feature>.md`. E125b will move a closed lane directory to `history/<YYYY-MM>/<lane>/`, and every such citation would then point at nothing.

Consequence: part of cut input (b) (L-SCHEMA-NEW-2, "tasks.md **and** specs/<feature>.md move") is deliberately not done. The human confirmed this on 2026-09-25 (Q2 = D-A). If the spec move is ever wanted, it is a cross-lane ticket touching `gates/ac-execution.ts` and `content/**`, not a `LANE_FILES` entry.

### D-B: every lane, including `_primary`, has a lane-local ledger at `.current/<lane>/tasks.md`

This follows the integrator's scope ("root becomes a read-only index for tw_*") and the Wave 6 definition of done ("tw_* 只讀 lane 內那份"). The alternative, where `_primary` keeps the root file as its ledger, is cheaper and safer for adopters, but it narrows the decided scope. It was raised as Q1. **Resolved 2026-09-25: Q1 = L**, so this decision stands.

### D-C: migration semantics (forward)

"Legacy task file" means the file the pre-E125a resolver would pick: the first existing path in `taskPaths` (config) or `DEFAULT_TASK_PATHS`. A path inside any `.current/<lane>/` never counts. The forward migration runs lazily on the first task-list access in lane `L`. It runs only when `.current/L/tasks.md` is absent and the legacy file exists at schema **v1 or lower** (see D-D).
- **L = `_primary`: copy, then stamp the source as the index.** `.current/_primary/tasks.md` becomes the legacy body verbatim, stamped v2. The legacy file keeps its entire body. Its line 1 is re-stamped `<!-- schema_version: 2 -->` and a one-line index notice follows it, naming the lane-local ledger. Why copy and not move: the root body is history that E125c will compact in place. Emptying it would silently re-target E125c's compaction. Adopters lose nothing because the whole body is carried into the ledger. The `_primary` copy is indiscriminate at migration time, because it cannot see a sibling worktree's not-yet-merged extraction. Correctness against a feat lane that merges later is therefore enforced at read time (AC14, architecture D12): the live `_primary` task-list view excludes any section already claimed by an existing `.current/<otherLane>/tasks.md`.
- **L = a feat lane (`e125a`, ...): extract its own sections, leaving a marker.** Every `## ` section whose heading's leading ticket-id token (the `TICKET_ID_RE` of `tools/lane-paths.ts`, lowercased) equals `L` is moved verbatim into `.current/L/tasks.md` (stamped v2). Each contiguous run of such sections is replaced in the legacy file by one single-line marker comment that names `L` and the run ordinal. Nothing else in the legacy file changes, and its sentinel is not re-stamped. Why move and not copy: after merge, the `_primary` copy would otherwise bring the lane's rows back into `_primary` in whatever state root held, including stale open `[ ]` rows. With zero matching sections, the forward migration is a no-op and the lane file is created by the first `tw_add_task`. The marker's exact on-disk shape is `<!-- tasks_moved: lane=<lane> run=<n> of=<N> sections=<count> -> .current/<lane>/tasks.md (E125a) -->`, as adjusted by the architect. The reverse runner needs the `sections=<count>` field to put a changed lane file's blocks back at their original run positions without a second stored mapping. `of=<N>` is the total number of runs extracted for that lane, and every marker carries the same N (review round 1, C2).
- A legacy file already at v2 (an index) is never a forward source. A lane born after the `_primary` migration starts empty. This is a required behaviour, enforced by an on-disk sentinel check in `ensureTasksMigratedLocked` (architecture D13), not just a documented expectation.

- **Ignored-lane-path guard (option A, human-approved 2026-09-25 with the round-1 amendment).** Before the forward migration writes a lane path, for `_primary` and for feat lanes alike, it runs a read-only `git check-ignore -q <lanePath>` with the workspace as cwd.
  - Exit 0 means the lane path is **ignored**, for example a team repo where `.current/` is kept local-only (E73). The migration does **not** run. The legacy file stays the ledger, exactly as before E125a, which is the Q1=R behaviour for that workspace. No receipt (`.current/tasks-index-receipt.json`) is written, and a one-line advisory (Copy `tasks.ignored-lane-advisory`) names the reason.
  - Any other outcome means **not ignored**, and the migration proceeds as designed (Q1=L). That covers exit 1, no `.git`, `git` not installed, and any error or exit 128. This repo tracks `.current/<lane>/`, so it takes this path.
  - Precedent for read-only git in `tools/`: `tools/feature-rollup.ts:103` (`git worktree list --porcelain`) and `tools/join-precondition.ts:63` (`git merge-base --is-ancestor`). Both use `execFileSync` with stderr captured or suppressed. The charter's "does not touch git" covers mutations, commits and PRs, not read-only queries.

### D-D: schema bump `tasks` v1 → v2

`CURRENT_VERSIONS.tasks` goes 1 → 2. The v1→v2 content step is a stamp only and leaves the body unchanged. The meaning of the bump is the load-bearing part: **a v2 file at a legacy path is an index, not a ledger, and a v1 file at a legacy path is an unmigrated ledger.** The bump also protects against a downgrade. A pre-E125a server (max v1) refuses a v2 file loudly (`schema-versioning: tasks on-disk version 2 > server max 1`). Without the bump, an old server would treat the root index as the live ledger and write rows into it.

### D-E: reverse migration (rollback)

Two exported runners mirror the E123 pair `migrateFlatToLane` / `migrateLaneToFlat`. There is no CLI: `bin/**` is forbidden, and the E123 precedent is runner-only.
- `_primary` reverse: the legacy file becomes the lane file's body under a v1 sentinel, and `.current/_primary/tasks.md` is deleted. The runner refuses, touching nothing, when the legacy file is not a v2 index carrying this migration's notice. It also refuses when the legacy body has changed since the forward run, because overwriting it would drop index writes such as E125b rows or E125c compaction. The forward run records the body state in a small, git-tracked receipt file at the fixed path `.current/tasks-index-receipt.json`: top level under `.current/`, no ticket prefix, no lane subdirectory. It holds `{bodySha256}`, a sha256 content hash of the root's trailing body. The reverse run checks the hash, then consumes and deletes the receipt (R4, architecture D7).
  - Why not an mtime: `git merge`, `checkout` and `clone` rewrite mtimes regardless of content, so the reverse would refuse after any git operation.
  - Why not a `LANE_FILES` entry: the E123 flat↔lane runners iterate `LANE_FILES` and must never touch the receipt.
  - Placement is checked: `.gitignore` has no broad `.current/*` rule, and `agc feature start`'s shared `info/exclude` rules cover only `.env` and `/node_modules`.
- Feat reverse: each marker for `L` is replaced by its run's sections from the lane file. Rows added lane-locally in sections that are not in any run are placed after the last marker. `.current/L/tasks.md` is then deleted. The runner refuses, touching nothing, on a missing, duplicated, or out-of-order marker.
- Full lane rollback order: tasks reverse first, then E123 `migrateLaneToFlat`. While the lane dir still holds `tasks.md`, the E123 reverse runner **refuses**. It must not move `tasks.md` to flat `.current/tasks.md`, because that is not where the ledger came from.

### D-F: read-only-index semantics of the root file

After E125a, no `tw_*` tool writes a legacy-path task file, except for the one-shot forward and reverse migration, which is not a ledger operation. `tw_get_next_task`, `tw_detect_drift`, `tw_sync`, the session freshness snapshot, and the prompt state footer (`prompts/build.ts` via `storage.listTasks`) all read **only** `.current/<lane>/tasks.md`. The root file is never a read fallback for the ledger. It stays readable by non-ledger consumers: the drift schema-skew check and `emitFeatureMetrics`' ticket count (AC10). A future E125b summary row in the root is therefore invisible to drift and sync by construction. **Scope of this guarantee (option A):** "`tw_*` read only the lane-local copy" holds only when the lane path is **tracked**, meaning not git-ignored. In a workspace whose lane path is ignored, the root (legacy file) stays the ledger that `tw_*` reads and writes. Follow-up **X4b**: E125c must state this condition in its SOP declaration of the root as an index, and the Wave 8 CHANGELOG upgrade notes must spell it out. **Side effect of Q1 = L (adopters):** after the migration, no `tw_*` tool reads hand edits to the root `tasks.md` any more. A row an adopter adds or ticks by hand in the root is silently outside the ledger. This is accepted for E125a and flagged as a follow-up for **E125c**, which must state it in the SOPs when it declares the root an index, and for **Wave 8**, whose CHANGELOG upgrade notes must spell out the upgrade path: edit `.current/_primary/tasks.md` or use `tw_add_task`.

## Acceptance Criteria

- **AC1 (registry)**: Given `tools/lane-paths.ts`, when `LANE_FILES` is read, then it contains exactly one new entry `{ key: "tasks", filename: "tasks.md", required: false }` plus a marker meaning "no flat `.current/<filename>` counterpart" (field name is the architect's call). `LanePaths` gains `tasksPath`, and `resolveLanePaths(ws, "e125a").tasksPath === <ws>/.current/e125a/tasks.md`. No other file under `tools/` restates the lane-local tasks path; they all derive it from `resolveCurrentLanePaths`.
  proof: `node --test test/lane-paths.test.mjs` (REG1 updated to 7 entries plus a new tasksPath case).
- **AC2 (E123 runners unaffected)**: Given a flat `.current/` with `handoff.md` plus a `.current/tasks.md`, when `migrateFlatToLane` runs, then `.current/tasks.md` is neither moved nor read, and `hasFlatLaneFiles` ignores it. Given a lane dir holding `tasks.md` and `tasks.md.lock`, when `migrateLaneToFlat` runs, then it refuses with nothing moved and a message naming the tasks reverse runner. The `tasks.md.lock` file on its own counts as tolerable debris.
  proof: `node --test test/lane-migrate.test.mjs` (COUNT1/COUNT2 re-baselined plus new AC2 cases).
- **AC3 (schema)**: Given `schema/versions.ts`, then `CURRENT_VERSIONS.tasks === 2`, a registered `tasks` v1→v2 step preserves the body byte-for-byte, and a v0 file migrates through v1 to v2. Given a v3 task file, then a read refuses with the newer-server error.
  proof: `node --test test/schema-versions.test.mjs test/tasks-versioning.test.mjs`.
- **AC4 (`_primary` forward)**: Given a workspace with no `.git`, which therefore resolves to lane `_primary`, and a v1 root `tasks.md` with body `B`, when any task-list tool runs for the first time, then:
  - `.current/_primary/tasks.md` equals `<!-- schema_version: 2 -->\n` + `B`;
  - root `tasks.md` equals `<!-- schema_version: 2 -->\n` + the index notice line + `B`;
  - the tool's result is computed from the lane-local file.
  proof: new test in `test/e125a-lane-local-ledgers.test.mjs` (AC4).
- **AC4b (ignored lane path: no migration, root stays the ledger; option A)**: Given a git workspace whose `.gitignore` ignores `.current/` (or at least `.current/<lane>/tasks.md`) and whose v1 root `tasks.md` has body `B`, when any task-list tool runs, first for a `_primary` checkout and then for a worktree on `feat/e999-x` whose root holds an `## e999-x` section, then:
  - no `.current/<lane>/tasks.md` and no `.current/tasks-index-receipt.json` is created;
  - root `tasks.md` is byte-identical: no v2 stamp, no index notice, no marker;
  - the tool result is served from root, as before E125a: `tw_add_task` / `tw_complete_task` write root, and `tw_get_next_task` reads it;
  - the one-line advisory `tasks.ignored-lane-advisory` is observable (its exact surface is the architect's or sr's call, but the test must be able to assert it);
  - none of the AC6b `TASKS_LEDGER_ABSENT` cases fires in either workspace.
  A control fixture without the ignore rule migrates per AC4/AC5, and a workspace with no `.git` counts as not-ignored.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC4b): the ignored `_primary` fixture, the ignored feat-lane fixture (real `git init` in `$TMPDIR` with a `.gitignore`), and the control.
- **AC5 (feat forward)**: Given a worktree on branch `feat/e999-x` whose v1 root `tasks.md` holds sections `## e999-x` (two runs, not adjacent) and `## e123a-y`, when `tw_get_next_task` runs, then:
  - `.current/e999/tasks.md` holds both `e999` runs verbatim, in order, under a v2 sentinel;
  - root holds two markers where the runs were, keeps its v1 sentinel, and is otherwise byte-identical;
  - the `## e123a-y` section is untouched.
  With zero `e999` sections, the migration is a no-op and root is byte-identical.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC5a/AC5b).
- **AC6 (idempotent / no re-migration)**: Given a lane file that already exists, or a root already at v2, when any task-list tool runs again, then neither file changes. Given two concurrent first accesses in the same lane, then exactly one migration happens. The lock is the lane's tasks lock plus the legacy file's lock, taken in a fixed order.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC6). The same test also covers lock contention (R3, architecture D14): when the lazy migration cannot get its lock within its bound (a stuck or contended concurrent first access), then `tw_get_next_task`, `tw_detect_drift` and each of the four mutators throw a recognisable error (`TasksMigrationBusyError`, `code: "TASKS_MIGRATION_BUSY"`). They never return an empty task list, never report a false clean drift result, and never silently read a stale legacy-path file.
- **AC6b (ledger absent but required: loud, never empty; review round 1, C1)**: Given no lane ledger at `.current/<lane>/tasks.md`, when any task-list read (`tw_get_next_task`, `tw_detect_drift`, `tw_sync`, `listTasks`) or mutator (`tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task`) runs, then it throws a recognisable error with `code: "TASKS_LEDGER_ABSENT"` naming the missing ledger path, in each of these cases:
  - (a) the lane is `_primary` and the legacy file is at v2 or above (an index that proves a ledger existed);
  - (b) the lane is a feat lane `L` and the legacy file holds at least one `tasks_moved: lane=L` marker;
  - (c) the legacy file is above `CURRENT_VERSIONS.tasks`. This case reuses the runMigrations newer-server message (AC3), carried on the same error.
  It never returns "no tasks", a clean drift report, or `ok: true` in these cases, and `tw_add_task` never starts a fresh ledger in them. It is raised from `ensureTasksMigrated` / `ensureTasksMigratedLocked`, so the read and mutator paths share it. A feat lane on a v2 root with **no** marker for itself still starts empty (AC14(b) unchanged). In a workspace whose lane path is git-ignored (option A, AC4b), none of (a) to (c) fires, because the legacy file is the ledger there. Case (c) still refuses through the ordinary newer-server read error (AC3). The code must stay outside `test/error-code-contract.test.mjs`'s harvested vocabulary (`_MISSING` suffix, `MISSING_` prefix); `_ABSENT` is not harvested.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC6b). One fixture per case (a) to (c): assert that each of the four readers and four mutators throws `TASKS_LEDGER_ABSENT`, and that no `.current/<lane>/tasks.md` is created. A fourth fixture, a feat lane on a v2 root with no own marker, asserts `tw_add_task` succeeds and creates an empty-start ledger.
- **AC7 (round trip)**: Given the AC4 fixture and the AC5 fixture, when forward then reverse run with no edits in between, then root is byte-identical to the original and the lane `tasks.md` is gone. When a row is completed and a new row is added lane-locally between forward and reverse, then after reverse root contains both edits and no row from either the lane or the original root is lost.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC7a/AC7b). The `_primary` round trip includes the forward run writing `.current/tasks-index-receipt.json` `{bodySha256}` and the reverse run consuming and deleting it (R4). The round trip must still succeed after the files' mtimes change with no content change.
- **AC8 (reverse refusals)**: The `_primary` reverse refuses, touching nothing, in both of these cases:
  - root is not a v2 index carrying the notice;
  - the root body has changed since the forward run.
  The feat reverse refuses, touching nothing, when a marker is missing, duplicated, or out of order.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC8). For the feat reverse, it refuses and touches nothing unless the number of markers for `L` equals N and every marker agrees on the same `of=<N>` (review round 1, C2). This includes the case where the LAST marker is missing, which previously relocated that run's sections silently. For `_primary`, "body changed" means `sha256(current trailing body) !== receipt.bodySha256`. A missing or unreadable `.current/tasks-index-receipt.json` also makes the reverse refuse, touching nothing (R4).
- **AC9 (tw_* read/write lane-local only)**: Given a migrated workspace, when `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task`, or `tw_sync` runs, then only `.current/<lane>/tasks.md` changes and root `tasks.md` is byte-identical (mtime unchanged). `tw_get_next_task`, `tw_detect_drift`, and `listTasks` ignore every checkbox row in root. Given an unmigrated feat lane with no rows in root, then `tw_add_task` creates `.current/<lane>/tasks.md` (v2) and does not touch root.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC9).
- **AC10 (other resolvers)**: Given the grep `grep -ln 'tasks\.md' tools/*.ts`, every hit is accounted for:
  - `tools/config.ts` (`findTasksFile` resolves the lane-local path; a new legacy finder is used only by the migration and the index readers);
  - `tools/tasks-file.ts` (all five entry points plus parse);
  - `tools/drift.ts` (the `tasks` skew check reads the lane file, else the legacy file, so a future-schema root still reports skew);
  - `tools/metrics.ts` (`emitFeatureMetrics`' ticket count = distinct completed `T-<code>-` ids across root, every live `.current/<lane>/tasks.md`, and every `.current/history/<YYYY-MM>/<lane>/tasks.md`, deduplicated by id);
  - `tools/sync.ts`, `tools/registry.ts`, and `tools/storage-sqlite.ts` (no behaviour change; strings or comments only, or untouched);
  - `tools/lane-paths.ts` and `tools/lane-migrate.ts` (AC1/AC2).
  proof: `node --test test/success-metrics.test.mjs test/drift-skew.test.mjs` plus the AC9 test.
- **AC11 (freshness)**: Given `tw_get_state` taken before the first migration in a session, when the first mutating task tool runs and triggers the migration, then it succeeds with no freshness violation, and a second mutating call in the same session also succeeds.
  proof: `test/e125a-lane-local-ledgers.test.mjs` (AC11).
- **AC12 (SQLite mode unaffected)**: Given HTTP/SQLite storage, then no lane-local `tasks.md` is created or read, and the existing SQLite task tests pass unchanged.
  proof: `npm test` (SQLite suites green).
- **AC13 (suite)**: Given the lane committed with no untracked files, when `npm test` runs, then it is fully green. Every pre-existing test that asserted root-`tasks.md` ledger behaviour has been updated by qa-engineer to the lane-local path or to a v2 sentinel, and each update is listed in the QA report. `npm run build` leaves `dist/` in sync with the source.
  proof: `cd <lanes-root>/e125a && git status --porcelain | wc -l` prints `0`, then `npm test` exits 0.

- **AC14 (merge interleave: every task id is live in exactly one ledger; R1)**: Given the `_primary` forward migration and a feat lane `L`'s forward migration have each run, independently and in either order, and `L` is then merged into `main` with an ordinary `git merge` (no special driver), then:
  - (a) if `.current/L/tasks.md` exists after the merge, every `tw_*` read or write resolved to `_primary` on `main` excludes any section of `.current/_primary/tasks.md` whose heading resolves to lane `L`, whatever the merge order (architecture D12, read-time ownership filter). Those rows are invisible to `tw_get_next_task`, unreachable by `tw_complete_task`, `tw_rollback_task` and `tw_void_task`, and left out of `tw_detect_drift`'s comparison;
  - (b) a legacy (root) file already at schema v2 is never a forward-migration source, so a lane forked after the `_primary` migration starts with an empty ledger (architecture D13, v2-sentinel skip);
  - (c) `emitFeatureMetrics`' ticket count (AC10) deduplicates by task id across the root, every live lane and every history-bucket lane, so a stale duplicate left in the `_primary` ledger is never counted twice;
  - (d) `addTaskInFile`, when resolved as `_primary`, refuses to add a task under a `section` name that resolves to an existing other lane's ticket id.
  proof: new cases in `test/e125a-lane-local-ledgers.test.mjs`:
  1. Feat-first fixture: a hand-built `.current/_primary/tasks.md` containing `## e999-x` rows, plus a separately created `.current/e999/tasks.md`. Asserts that `tw_get_next_task` and `tw_complete_task` under `_primary` never see or touch the `e999`-owned id.
  2. Primary-first fixture: root is already v2 before the lane's first access. Asserts that the lane starts empty.
  3. Asserts that `emitFeatureMetrics`' count is unchanged by either fixture.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| tasks.index-notice | `<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->` | authored-here — D-C `_primary` index notice; one comment line so every markdown renderer hides it and the first-row parser is unaffected |
| tasks.feat-marker | `<!-- tasks_moved: lane=<lane> run=<n> of=<N> sections=<count> -> .current/<lane>/tasks.md (E125a) -->` | authored-here — D-C feat-lane marker; `<lane>`, `<n>`, `<N>` (run total, the same on every marker for a lane; review round 1, C2) and `<count>` are substituted; the shape is fixed by the architecture blueprint (the reverse runner needs `sections=<count>`) |
| tasks.ledger-absent | `TASKS_LEDGER_ABSENT: lane <lane> has no task ledger at <lanePath>, but <legacyPath> shows one must exist (<reason>) — restore <lanePath> (e.g. from git) or run the tasks reverse migration; refusing to report an empty task list` (the `code` of the thrown error; `<reason>` ∈ `_primary index v<N>` / `tasks_moved markers for lane <lane>` / the newer-server message) | authored-here — review round 1, C1; `_ABSENT` deliberately avoids the `_MISSING`/`MISSING_` harvested vocabulary |
| tasks.ignored-lane-advisory | `tasks ledger: <lanePath> is git-ignored in this workspace — lane-local migration skipped; <legacyPath> remains the tw_* ledger (E125a option A)` | authored-here — option A advisory (human-approved 2026-09-25); one line, emitted when the guard skips the migration |
| tasks.migration-busy | `TASKS_MIGRATION_BUSY` (the `code` of `TasksMigrationBusyError`) | authored-here — R3, architecture D14; deliberately outside the vocabulary `test/error-code-contract.test.mjs` harvests |
| tasks.refuse-lane-to-flat | `lane-migrate (lane->flat): <laneDir> holds tasks.md — run the tasks reverse migration first; nothing moved` | authored-here — AC2 refusal, same prefix convention as the existing lane-migrate errors |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Moving a lane directory to `history/<YYYY-MM>/<lane>/` at lane close, `feature finish --shipped`, J2-NEW-4, and the S1 orphan scan (all E125b).
- Writeback summary rows or pointers in the root index (E125b). The D-C marker is only a migration tombstone for reversibility. E125b may replace or format around it (cross-lane item X3).
- Release SOP 7a, any `content/**` prose, declaring the index in the SOPs, compacting the existing `tasks.md` (all E125c), and any `docs/backlog.md` edit (D3).
- Moving `specs/<feature>.md` (D-A) or the evidence directories (E168, post-v4).
- A CLI for the reverse migration (`bin/**` forbidden). The runners are exported functions, as in E123.
- A git merge driver for `tasks.md` across the `_primary`/feat-lane forward-migration interleave (R1). A resulting merge conflict, or a hybrid file with an inert stale duplicate, is an accepted outcome (AC14).
- Changing `agc init`'s root `tasks.md` scaffold (`bin/agc-init.mjs:370`, forbidden). The scaffold still works: the first `tw_*` access migrates it (cross-lane item X2).

## Dependencies / Prerequisites

- E123 (LANE_FILES, resolveCurrentLane, the E123 runner pair) and Wave 5 are merged: base `b0db90e`.
- No `design/<feature>.md`, mode = no-design, so Visual Structural Assertions are omitted. No external references were found in the E125 row or `specs/fanout-wave6.md`, so `external_refs` is omitted.
- **Self-hosting note**: this lane's own `tw_*` calls are served by the primary checkout's `dist/` (old code). This lane's tasks therefore live in the root `tasks.md` under `## e125a-lane-local-ledgers` for the whole chain, and the lane-local mechanism does not govern its own lane. After merge and release, the `_primary` migration copies these (by then closed) rows into `.current/_primary/tasks.md` as history. The D-C feat extraction path only applies to lanes that run the new server while their rows are still in a v1 root.
- **Temporary state, not a design goal (E125a → E125c; R2).** After the `_primary` forward migration, the full historical ledger body (about 545KB today) exists twice on disk: in the frozen root index, kept verbatim because D-C copies rather than moves for `_primary`, and in `.current/_primary/tasks.md`, the live ledger from then on. This is a deliberate, temporary result of that choice: emptying the root would silently re-target E125c's future compaction onto the wrong file. It is not a design goal. Operators should expect `tasks.md` disk usage to roughly double in any `_primary` workspace that has run the forward migration, until E125c ships and compacts the root's frozen body. The state is fully reversible in the meantime: `migratePrimaryReverse` restores the exact single-copy pre-migration state, and it refuses rather than guesses if anything else has touched the root since (AC8).
- **Cross-lane items** (the coordinator takes these to the integrator mailbox; this lane does not edit them):
  - **X1** `content/**` (E125c): SOP prose that says tasks go in `tasks.md` (PM "Artifacts", release 7a greps, coord-03) must name `.current/<lane>/tasks.md`. `docs/lane-protocol.md` §3 "commit … the rows of this ticket in `tasks.md`" becomes "commit `.current/<lane>/`", which already includes the ledger. The integrator already planned this after merge (`specs/fanout-wave6.md` "整合後").
  - **X2** `bin/agc-init.mjs` (E125b owns `bin/`): `agc init` may scaffold `.current/_primary/tasks.md` directly and write the root as an index. It is optional, because the lazy migration already covers the root scaffold. `bin/agent-governance-context.mjs:34` arms on root `tasks.md`, which still exists as the index, so there is no break.
  - **X3** E125b: the root index is a v2 file. E125b's summary rows must be non-checkbox, or sit inside a v2 index region the parser skips. E125b must also decide whether to replace the D-C feat markers.
  - **X4** E125c: compaction of the root must keep line 1 `<!-- schema_version: 2 -->` and the index notice. After the `_primary` migration, the 545KB of closed history also sits in `.current/_primary/tasks.md`. Whether E125c compacts that copy is E125c's cut to make (J2-NEW-4 is related).
  - **X6** (E126, informational only): every lane-local ledger can already be enumerated with `enumerateLaneSidecarSources(workspacePath, "tasks").sources` (architecture D10), so E126 needs no new `lane-paths.ts` export. For E125b: once closed lanes move to `history/`, the AC14 ownership filter (which checks live `.current/<lane>/tasks.md` only) stops seeing their claims. E125b decides whether to extend the filter to history buckets.
  - **X4b** E125c + Wave 8: the "`tw_*` read only the lane-local copy" guarantee is conditional on a tracked lane path (option A, D-F). E125c's SOP index declaration and the Wave 8 CHANGELOG upgrade path must state that a workspace with a git-ignored `.current/` keeps the root `tasks.md` as its ledger.
  - **X5** `scripts/verify-release.mjs:256` tolerates `^tasks\.md$` in the release range. A post-E125a release range would also carry `.current/_primary/tasks.md`. Check that the `.current/<lane>/` tolerance already covers it. `scripts/` belongs to E126/L-RELTOOL and is not this lane's file.
- **Test impact (qa-owned; expected updates under D-B)**: `test/lane-paths.test.mjs` (REG1: 6 → 7), `test/lane-migrate.test.mjs` (COUNT1/COUNT2, lane→flat refusal), `test/schema-versions.test.mjs`, `test/tasks-versioning.test.mjs` (the sentinel heals to v2 at the lane path), `test/tasks.test.mjs`, `test/e117-void-task.test.mjs`, `test/e120-void-recut-refusal.test.mjs`, `test/e121-tasks-file-injection.test.mjs`, `test/p0-onboarding-lite-default.test.mjs`, `test/tw-sync-reconcile.test.mjs`, `test/drift-archived-tasks.test.mjs`, `test/drift-baseline.test.mjs`, `test/drift-skew.test.mjs`, `test/success-metrics.test.mjs`, `test/qa-review-scoped-append.test.mjs`, and `test/e112-drift-fanout-feature-scope.test.mjs`. Any other test that writes a root `tasks.md` and then reads it back after a `tw_*` mutation also needs updating. 35 test files mention `tasks.md`, and QA triages all of them. `test/context-budget.test.mjs` and the goldens should **not** change, because no `content/` changes. If they go red, stop and report.
- **Round-1 in-scope fixes (review_reports/review_T-E125A-05.md, "Recommended"; small, all in owned files, fixed this round alongside C1/C2):**
  - **R-1** — the read-path snapshot carry happens only when THIS call migrated: `ensureTasksMigrated` / `ensureTasksMigratedLocked` return `true` only when they wrote, and `migrateForRead` carries only then. This protects AC11 against another process creating and mutating the ledger between the unlocked check and the lock.
  - **R-2** — `withSyncLock` checks its deadline before every `continue`, and throws `TasksMigrationBusyError` on an undeletable stale lock (EPERM, or a directory named `tasks.md.lock`), never spinning without a bound. `guards/file-lock.ts` `withFileLock` has the same shape but is left untouched.
  - **R-3** — `withSyncLock` fails fast (`TasksMigrationBusyError`) when the lock holder's `pid === process.pid`, instead of a guaranteed 3s `Atomics.wait` stall.
  - **R-4** — for a feat lane on a v1 root with zero own sections, add an unlocked pre-scan for a `## <lane>`-token heading before any locking, and read only the first line for the sentinel in `legacyIsIndexOrGone`. Then the no-op case no longer re-reads and re-splits the 545KB root, or creates `.current/<lane>/`, on every call.
  - Optional O-1..O-3 (shared `##` heading predicate, a first-match rewrite on a duplicated id, v0 round-trip note) are at the sr-engineer's discretion.
- **Human decisions (resolved 2026-09-25, recorded by the coordinator; cut approved)**: Q1 = **L** (`_primary` is lane-local too; D-B stands). Q2 = **D-A** (`specs/<feature>.md` stays put). Q3 = **keep** the feat-lane extraction path (D-C). Q4 = **runner-only** reverse migration, no CLI (D-E). The integrator's pre-review items R1–R4 are resolved in `specs/e125a-lane-local-ledgers-architecture.md` and folded in above: R1 → AC14, R2 → the temporary dual-copy note, R3 → the AC6 proof, R4 → the receipt in D-E, AC7 and AC8. Round-1 amendment plus **option A** (ignored-lane-path guard) approved by the human on 2026-09-25 ("approve amendment + A").
