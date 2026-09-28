# Review — T-E125A-05 (adversarial review of T-E125A-01..04)

covers: T-E125A-01, T-E125A-02, T-E125A-03, T-E125A-04

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Reviewer tier: opus (sr-engineer ran on fable, so a different model; no same-model bias suspected).
Inputs: `git diff -- ':!dist'` of the uncommitted worktree, the new untracked `tools/tasks-lane-migrate.ts`, `specs/e125a-lane-local-ledgers.md`, `specs/e125a-lane-local-ledgers-architecture.md`, and `qa_reports/expected-red_e125a-lane-local-ledgers.txt` (the SOP 4a carve-out). Smoke fixtures ran against `dist/` in `$TMPDIR` only. `npx tsc --noEmit` is clean.

## Summary
- Adds `tasks` to `LANE_FILES` (`noFlatCounterpart`), bumps `tasks` to v2, adds the new `tools/tasks-lane-migrate.ts` (forward and reverse runners, a sync lock, `TasksMigrationBusyError`), and points `tools/tasks-file.ts` reads and writes at the lane ledger only. Also adds the D12 `_primary` ownership filter and dedups the metrics ticket count by id.
- `guards/file-lock.ts` is a pure extraction. The only change inside `withFileLock` is the identifier at its single call site (`looksStale` → `isLockPayloadStale`), and the predicate body is byte-identical. The integrator's acceptance condition holds.
- Lock order (lane outer, legacy inner) is correct on the read path, the mutator path and both reverse runners. `TASKS_MIGRATION_BUSY` is thrown on both paths and never swallowed. The smoke test confirmed it: the read throws after about 3003ms, and complete and add throw BUSY while the legacy lock is held.
- The feat round trip on non-contiguous runs is byte-identical (smoke-verified: runs 1 and 2, with a foreign section between them).
- Verdict: **CHANGES_REQUESTED**. There are two required findings: (1) the R3 silent-wrong-answer class is still open when the lane ledger is absent but the legacy file shows one must exist; (2) AC8 is partial because a missing LAST feat marker is accepted.

## AC Completeness
AC1 — implemented — tools/lane-paths.ts (`tasks` entry + `noFlatCounterpart`, `LanePaths.tasksPath`, `LANE_PATH_FIELD.tasks`). Callers derive the path via resolveCurrentLanePaths. The reverse runner uses resolveLaneDir + laneFile, and the D12 sibling path is derived from the resolved `_primary` path. Both are accepted deviations, see Architecture.
AC2 — implemented — tools/lane-migrate.ts `MOVABLE_LANE_FILES` covers every plan site. The explicit refusal at migrateLaneToFlatLocked matches the Copy string. `tasks.md.lock` is tolerated as debris and removed only when stale. `isStaleAtomicTmp` still iterates the full registry.
AC3 — partial — schema/versions.ts:9 and schema/migrations-tasks.ts implement the stamp-only v1→v2 step. The gap: a legacy root at v3 with no lane ledger returns "No task list file found" instead of the newer-server refusal (smoke-verified). See Correctness C1(c).
AC4 — implemented — tools/tasks-lane-migrate.ts:159-163 (smoke: root = sentinel + notice + B; ledger = sentinel + B).
AC5 — implemented — tools/tasks-lane-migrate.ts:167-185 (smoke: two non-adjacent runs, the foreign section untouched, the v1 sentinel kept).
AC6 — implemented — tools/tasks-lane-migrate.ts:209-239. Re-checks happen under the lock, the lock order is fixed, and BUSY is thrown (smoke-verified).
AC7 — implemented — the reverse runners at tools/tasks-lane-migrate.ts:296-381. D11 restores the current body. The receipt holds a content hash.
AC8 — partial — tools/tasks-lane-migrate.ts:333-371. Missing first, missing middle, duplicated and out-of-order markers refuse. A missing LAST marker is accepted and relocates its sections (smoke-verified). See C2.
AC9 — partial — writes go only to the lane path (tools/tasks-file.ts:352, :743-). But "listTasks ignore every checkbox row in root" becomes a silent "no task list / clean" when the `_primary` ledger is absent (see C1).
AC10 — implemented — config.ts, tasks-file.ts, drift.ts (comment only; findTasksFile is lane-then-legacy), metrics.ts (id-deduped across root, live lanes and history lanes). The grep also hits the new tools/tasks-lane-migrate.ts, which the architecture accounts for.
AC11 — implemented — tools/tasks-file.ts:134-157 (carrySnapshot). See R-1 for a narrow race on the read path.
AC12 — implemented — storage-sqlite.ts is untouched, and no tasks-file path is reachable in SQLite mode.
AC13 — missing (deferred by design) — the proof depends on T-E125A-06/07 (qa-owned). This is not held against T-01..04.
AC14 — implemented — (a) makeForeignCheck plus the parseTasks skip at tools/tasks-file.ts:99-113 and :185-192; (b) D13 at tasks-lane-migrate.ts:217/237; (c) the metrics Set dedup; (d) the add refusal at tasks-file.ts:~757.

## Correctness

**C1 — required — R3 silent-wrong-answer when the lane ledger is absent but the legacy file shows it must exist.**
tools/tasks-lane-migrate.ts:213-217 and :237 (a v2+ legacy file is treated as "nothing to do"), tools/tasks-file.ts:162 (parseTasks → `null`), tools/tasks-file.ts:743-752 (add creates a fresh ledger).
Smoke (dist, `$TMPDIR`): run the `_primary` forward, then delete `.current/_primary/tasks.md`. This is a fresh clone, or a team repo where `.current/` is local-only (E73), while the root v2 index with the notice is present. Results:
- `parseTasksFromFile` returns `null`, and `tw_get_next_task` returns `{"error":"No task list file found in workspace."}`.
- tools/drift.ts:354-365 reports `driftDetected:false`, "Handoff state exists but no task list found. Likely vibe-coding only mode."
- tools/sync.ts:47-53 reports `ok:true`, "No task list — nothing to reconcile."
- `tw_add_task` **succeeds** and writes a brand-new `.current/_primary/tasks.md` (`# Tasks / ## Active / T-A-03`). The whole history is silently forked away.
The same class applies in two more cases:
- (b) A feat lane `L` whose legacy file carries one or more `tasks_moved: lane=L` markers but has no `.current/L/tasks.md`. The forward migration finds 0 sections and does nothing, so every reader returns empty.
- (c) A legacy file at a version above `CURRENT_VERSIONS.tasks` with no lane ledger. The read returns silently instead of refusing as a newer server would.
This does NOT conflict with AC14(b): a feat lane on a v2 root with **no marker for L** still legitimately starts empty.
Fix: when the lane ledger is absent, have `ensureTasksMigrated` / `ensureTasksMigratedLocked` (so read and mutator paths both get it, including `addTaskInFile`) throw a recognisable error in these cases:
- (a) the lane is `_primary` and the legacy file is at v2 or above;
- (b) the lane is a feat lane and the legacy file holds a `tasks_moved: lane=<L>` marker;
- (c) the legacy version is above `CURRENT_VERSIONS.tasks` (reuse the runMigrations newer-server message).
Never return empty for these cases. Keep the `.code` outside test/error-code-contract.test.mjs's harvested vocabulary. For example, use `TASKS_LEDGER_ABSENT`, **not** `*_MISSING` or `MISSING_*`, mirroring D14's `TASKS_MIGRATION_BUSY` reasoning. Add a Copy/Strings row via the coordinator (PM amendment), because this is a new user-visible string.

**C2 — required — AC8 partial: a missing LAST feat marker is undetectable.**
tools/tasks-lane-migrate.ts:333-371. The runs are validated only as a 1..k prefix, so if the final marker is deleted, the run's sections become `extras` and get placed after the previous run.
Smoke: with the `run=2` marker removed, the reverse is accepted and T-E999-02/03 land under run 1's position. The last block is also joined to the next `## e123a-y` heading with no blank line.
No row is lost, but AC8 says the reverse "refuses, touching nothing, when a marker is missing". It is a silent relocation in exactly the case the refusal exists for, such as a tail marker dropped during merge-conflict resolution or an E125b edit.
Fix: carry the run total in the marker, for example `run=<n> of=<N>` or `run=<n>/<N>`, and refuse unless `markers.length === N` and every marker agrees on N. No marker has shipped yet, so there is no compatibility cost. This changes the `tasks.feat-marker` Copy string, so the coordinator must obtain the PM/architect Copy-table amendment before sr implements it. The spec row already says the shape "is fixed by the architecture blueprint".

**R-1 — recommended — read-path snapshot carry is not tied to "this call migrated".**
tools/tasks-file.ts:142-149. `migrateForRead` passes `hadLedger=false` literally. If another process creates the ledger (and then mutates it) between the unlocked `existsSync` and the lock, this session's snapshot is advanced to that process's mtime. The session's next mutation then skips the STATE DRIFT it should have hit.
Fix: have `ensureTasksMigrated` / `ensureTasksMigratedLocked` return `true` only when they wrote, and carry only then. The mutator path is already safe because it evaluates `hadLedger` under the lane lock.

**R-2 — recommended — `withSyncLock` can spin forever on an undeletable stale lock.**
tools/tasks-lane-migrate.ts:101-108. The code reaches `continue` before the timeout check. A stale lock whose `unlinkSync` keeps failing (EPERM, or a directory named `tasks.md.lock`: the stat-mtime fallback says stale and unlink fails with EISDIR) loops with no bound and blocks the whole server synchronously.
Fix: check the deadline before `continue`, and throw `TasksMigrationBusyError`. `withFileLock` has the same pre-existing shape. Leave it alone, because it is a pure-extraction file.

**R-3 — recommended — the sync lock waits on a lock its own process holds.**
tools/tasks-lane-migrate.ts:109-110. `Atomics.wait` blocks the event loop, so if the holder is this same PID (an async `withFileLock` holder parked at its `await fn()` microtask), it can never release, and the wait is a guaranteed 3s stall followed by BUSY.
Fix: fail fast when `payload.pid === process.pid`.

**O-1 — optional — heading detection diverges.**
The migration splits on `startsWith("## ")` (tools/tasks-lane-migrate.ts:147), but parseTasks uses `/^##\s+/` (tools/tasks-file.ts:185). A `##\t<ticket>` heading is a section to the reader but not to the extractor. Share one predicate.

**O-2 — optional — AC14(a) edge with a duplicated id.**
The complete, rollback and void rewrites use a first-match `content.replace(oldPattern)` over the whole file (tools/tasks-file.ts:370, :448, :633). If the same id exists both in a foreign section and in a non-foreign section of the `_primary` ledger, the lookup passes on the non-foreign row, but the rewrite can hit the foreign copy first. Restrict the rewrite to the line that the filtered parse found.

**O-3 — optional — a v0 root does not round-trip byte-identically.**
For a `_primary` root with no sentinel (v0, e.g. the `agc init` scaffold), the reverse writes a v1 sentinel, so the result is not byte-identical to the original. AC7 pins a v1 fixture, so this is not a violation. Document it.

## Quality
- The naming, comments and *Locked/wrapper split mirror tools/lane-migrate.ts. No dead code.
- `isFresh` (tools/tasks-file.ts:125-132) swallows every error from `verifyFreshness`. That is acceptable only because it gates nothing but the snapshot carry. A one-line comment saying so would help.
- O-4 (optional): the feat forward leaves the marker line directly above the next heading, and the smoke root shows a marker followed immediately by `## e123a-y`. Cosmetic only; the round trip is still exact.
- O-5 (optional): tools/metrics.ts `(T-<code>-\S*)` captures trailing punctuation, e.g. `T-X-01:`. That is harmless while the id format is consistent. `[A-Za-z0-9_.-]*` would be tighter.

## Architecture
- The deviations are justified and accepted:
  - (1) `ensureTasksMigratedLocked(ws, laneTasksPath)`: the lock held and the ledger written can never diverge, and CALLERS1 stays green.
  - (2) The reverse runners take an explicit lane, so they use `resolveLaneDir` + `laneFile("tasks")`, not the current-lane resolver.
  - (3) The D12 sibling derivation `dirname(dirname(_primaryPath))/<lane>/<basename>` is equivalent to resolveLaneDir for regex-constrained lane tokens. TICKET_ID_RE blocks traversal.
  - (4) lane→flat removes a stale `tasks.md.lock` via `isLockPayloadStale` and keeps a live one along with its dir. This is consistent with AC2's "tolerable debris".
- D12 mapping: heading text → `resolveLaneName` (TICKET_ID_RE `^([a-z]+\d[a-z0-9]*)(?:-|$)`, lowercased) → foreign iff `.current/<lane>/tasks.md` exists. Against the real root, 50 of 70 headings map to a ticket token and the rest are `_legacy` (Active, Completed, "Cut-Approval …"). A false positive requires a live sibling ledger for that exact token, which is the intended semantics. `###` subsections stay inside the foreign scope, which is correct.
- D13: v2+ legacy is never a forward source, on both the unlocked pre-check (:237) and the locked re-read (:217). This is correct, but see C1: for `_primary`, and for a marker-bearing feat lane, "never a source" must also mean "loud", not "empty".
- The D3 trigger site is respected: `findTasksFile` stays pure (config.ts:351-354).
- E123 interaction: `hasFlatLaneFiles`, `planMoves`, `missingRequired` and `known` all use `MOVABLE_LANE_FILES`. `.current/tasks.md` is legacy for tasks (findLegacyTasksFile) and invisible to the E123 runners. The `.handoff.lock` and `tasks.md.lock` files are distinct, so the two migrations never contend.

## Security
No findings. Lane names that reach a path join come from TICKET_ID_RE or resolveLaneDir (which validates). The receipt is JSON-parsed and hex-validated. No new input crosses a trust boundary unvalidated. The E121 injection guards run before any file resolution, so they are unchanged.

## Performance
- R-4 (recommended): for a feat lane on a v1 root with zero own sections (a legitimate no-op), every `tw_*` read or mutation reads the whole root (545KB today) for the unlocked version check. Each call then takes two lockfiles, re-reads and splits the root, and creates `.current/<lane>/`. This continues until the first `tw_add_task`. That is a per-call regression compared with base. Fix: an unlocked pre-scan for a `## <lane>`-token heading before locking, and a first-line-only sentinel read in `legacyIsIndexOrGone` (:189-195).
- The `_primary` steady state is one `existsSync` fast path, with no regression. The D12 memoised `existsSync` per distinct section lane is O(#sections).
- Metrics now reads every live and history lane ledger once per feature close. This is acceptable and not a hot path.

## Expected-Red Sampling (SOP 4a)
The manifest exists (83 entries). I sampled 4, and each was located and its failure reproduced:
- `test/tasks.test.mjs | completeTask flips the checkbox and appends the note`. `readTasks` reads the root, and the row now lands in the lane ledger. Stale assumption.
- `test/e117-void-task.test.mjs | void marks an incomplete row as voided and returns success`. The fixture stamps the root `schema_version: ${CURRENT_VERSIONS.tasks}` (now 2), which is an index per D13, so it yields "No task list file found." Stale fixture. Note that its failure mode is exactly the C1 silent path, and it will change to a thrown error once C1 is fixed. QA should re-baseline to a v1 root or a lane ledger.
- `test/e121-tasks-file-injection.test.mjs | THE TRAP …` and `must-refuse 1/8`. The refusal itself still fires. The red comes from `parseTasksFromFile(ws).length` on `null`, the same v2-root fixture. Stale fixture, not an injection regression.
- `test/e31-config-nonfatal.test.mjs | E31 QA probe 1: corrupting … undiscoverable`. After the precondition read migrates the custom file into the lane ledger, config taskPaths no longer affect discovery. This is a genuine intended behaviour change (D-F), not a regression.
Conclusion: the sampled reds are stale assumptions, not regressions.

## Verdict
CHANGES_REQUESTED. C1 leaves the R3 silent-wrong-answer class open: a v2 `_primary` index, or a marker-bearing feat lane, with no lane ledger reports "no tasks / clean" and lets `tw_add_task` silently fork a new ledger. C2 leaves AC8 partial, because a missing last marker is silently relocated instead of refused.

## Round 2 — APPROVED — by code-reviewer

covers: T-E125A-01, T-E125A-02, T-E125A-03, T-E125A-04

Reviewer tier: opus. Inputs: the amended `specs/e125a-lane-local-ledgers.md`, which adds AC4b, AC6b, the `of=<N>` marker shape, R-1..R-4 and the D-F tracked-only condition. Also the round-2 diff (`tools/tasks-lane-migrate.ts` 381→548 lines, `tools/tasks-file.ts`) and the expected-red manifest (87 entries). Smoke fixtures ran against `dist/` in `$TMPDIR`, including a real `git init` with a `.gitignore`. `npx tsc --noEmit` is clean. `guards/file-lock.ts` is unchanged since round 1, and the pure extraction still holds.

### Summary
- C1 → AC6b is fixed. `TasksLedgerAbsentError` (`code: "TASKS_LEDGER_ABSENT"`, exact Copy text) is raised from `mustMigrate` (tools/tasks-lane-migrate.ts:306-320) through both `ensure*` functions, so every reader and mutator gets it.
- C2 → AC8 is fixed. Markers carry `of=<N>`, and the reverse refuses unless the marker count equals N on every marker (:511-513).
- R-1..R-4 and O-1 are fixed. Option A (AC4b) is implemented with a per-process-cached `git check-ignore -q` (:250-267) and `resolveTasksLedgerPath` (:275-278). The advisory is surfaced in `tw_get_next_task`.
- Verdict: **APPROVED**. No required findings remain.

### AC Completeness (round-2 deltas)
AC3 — implemented — a v3 root now refuses in both modes. Tracked mode gives TASKS_LEDGER_ABSENT carrying the runMigrations newer-server message. Ignored mode gives the ordinary `schema-versioning … version 3 > server max 2` read error (smoke).
AC4b — implemented — smoke (`git init` + `.current/` ignored):
- `tw_get_next_task` is served from root with `advisory` = Copy `tasks.ignored-lane-advisory`.
- complete and add write root.
- Root stays `<!-- schema_version: 1 -->` with no notice or marker.
- No lane ledger and no receipt are created.
- The control (git, no ignore rule) migrates.
AC6b — implemented — smoke:
- (a) `_primary` v2 index with the ledger deleted: next, list, add, complete and sync all throw TASKS_LEDGER_ABSENT, and no ledger is created.
- (b) a feat lane with an own `tasks_moved` marker and the ledger deleted: next and add throw.
- (c) a v3 root: throws.
- A feat lane on a v2 root with no own marker: next returns "No task list file found", and add succeeds, creating an empty-start ledger. AC14(b) is preserved.
AC8 — implemented — smoke: with the `run=2` marker deleted, the reverse refuses (`1 e999 marker(s) found but they declare of=2`). Root and ledger are untouched. The unedited round trip is still byte-identical.
AC11 — implemented — the R-1 carry now happens only when `ensure*` returns true (tools/tasks-file.ts:152-172).
All other ACs are unchanged from round 1 (implemented). AC13 is still deferred to QA (T-06/T-07).

### Round-1 findings: disposition
- C1: resolved (above).
- C2: resolved (above).
- R-1: resolved (tasks-lane-migrate.ts:364-396 return values; tasks-file.ts:158).
- R-2: resolved. The deadline is checked before every retry (:138). Smoke: a directory named `tasks.md.lock` with an old mtime gives BUSY after about 3076ms, with no spin.
- R-3: resolved. `lockHolderPid === process.pid` gives BUSY immediately (:136). Smoke: 15ms.
- R-4: resolved as far as AC6b allows. For a feat lane with zero own sections, there is no lock and no `.current/<lane>/` mkdir (smoke). The sentinel is read from the first 256 bytes. A full-body read remains, because AC6b(b)'s marker scan needs it; see O2-3.
- O-1: resolved. `SECTION_HEADING_RE` is shared by the extractor and the parser.
- O-2: open (optional, needs a line index on TaskRecord).
- O-3: documented.

### Coordinator focus items
1. **prompts/build.ts `listTasks` — not a crash; no fix in this lane.** The only `listTasks` call in build.ts (:401) is inside `appendSpecContext`, which returns early at :375 unless the storage `isRagCapable` (has `queryPrdSpec`). `FileHandoffStorage` does not have it, so in file mode the call is unreachable. In SQLite mode `listTasks` is the SQLite implementation, which never throws TASKS_LEDGER_ABSENT or BUSY. A `/teamwork` invocation therefore cannot crash on these codes today. `tw_get_state` does not call `listTasks` either: `markStateRead` uses only the pure `findTasksFile`, so the pre-flight is never blocked. Cross-lane advisory, informational only: if file storage ever gains RAG, wrap build.ts:401 (prompts/** owner).
2. **Per-process check-ignore cache — acceptable.**
   - `resolveTasksLedgerPath` consults `existsSync(laneTasksPath)` before the cache. So once any process creates the lane ledger, every process follows it whatever answer it cached.
   - The ignored-mode mutators lock `<root>.lock`, which is the same file the migrator takes as its inner lock, so a write in ignored mode and a migration in tracked mode serialize correctly.
   - A transient git failure is cached as "not ignored", as the spec requires ("any error → not ignored"). The worst outcome is a migration into an ignored path, which then fails loud (AC6b(a)) on a teammate's clone instead of silently.
   - A `.gitignore` edit takes effect on the next server start. This is documented at :240-242.
3. **Ignored workspace — correct.**
   - The root stays v1: `sentinelVersionFor` gives v1 for any non-lane path, so there is no v2 stamp and no heal.
   - The locks are keyed on root, and `ensureTasksMigratedLocked` returns before taking the legacy lock, so there is no self-deadlock.
   - AC6b never fires because `isLanePathIgnored` is checked before `preScanMustMigrate`. Case (c) still refuses through the ordinary read path (smoke).
4. **The 4 new expected-reds are stale fixtures, confirmed.** The 3 `e120` "no false refusal" cases and the `e121` "must-succeed: addTask accepts a spread of benign id shapes" case all fail with `TASKS_LEDGER_ABSENT … (_primary index v2)`. The fixtures stamp the root `CURRENT_VERSIONS.tasks` (now 2) with no ledger. They used to pass only because `tw_add_task` silently started a fresh ledger, which was the round-1 C1 defect. This is the correct new behaviour, and QA re-baselines them to a v1 root or a lane ledger.

### Correctness (round 2)
- **O2-1 — recommended — the mutator lock and target are resolved before the lock.** tools/tasks-file.ts:373-375, :452-454, :586-588, :767-771.
  - The lock key `resolveTasksLedgerPath(...)`, and in add also `targetPath`, are computed before `withFileLock`.
  - In the narrow case of two processes with different cached ignore answers (a `.gitignore` edited while both servers are running), an ignored-mode add can wait on `<root>.lock` while a tracked-mode process migrates. It then appends to the root, which is now a v2 index, and re-stamps it v1. complete, rollback and void re-resolve inside `parseTasks` but still hold the root lock, not the lane lock.
  - Fix: re-resolve inside the lock, and retry or refuse if the result changed.
  - This is not reachable with a single consistent ignore answer, so it does not block.
- **O2-2 — optional — `sentinelVersionFor` identifies a lane ledger by its grandparent being named `.current`.** tools/tasks-file.ts:40-45. This misfires only for a workspace that itself lives directly under a directory named `.current`. Compare against `resolveCurrentLanePaths(ws).tasksPath`, or check for a `.current/<lane>/` shape relative to the workspace.
- **O2-3 — optional — the zero-section feat-lane no-op still reads the full root on each call** (:342-348). There is no lock and no mkdir, so it is acceptable. The read is inherent to AC6b(b)'s marker scan. A later step could cache it by (path, mtime).
- **O2-4 — optional — an ignored workspace whose committed root is already a v2 index** (migrated before the ignore rule was added) serves that index as its ledger, and its first write re-stamps it v1. This matches the spec: AC6b does not fire when the lane path is ignored. It is worth one line in the X4b upgrade notes.

### Quality / Architecture / Security / Performance (round 2)
- Quality: the constants, Copy strings and errors match the spec verbatim. The `isFresh` comment was added. No dead code.
- Architecture: the option-A guard sits in the migration module, as the spec's "before the forward migration writes a lane path" requires. D-F's tracked-only condition is honoured through `resolveTasksLedgerPath`. The `TASKS_LEDGER_ABSENT` and `TASKS_MIGRATION_BUSY` codes stay outside the error-code-contract harvest.
- Security: `execFileSync("git", [...])` uses an argv array, not a shell, with `--` before the path, stdio ignored and a 5s timeout. The path is workspace-relative and built from a validated lane name. It is read-only git, following the `tools/feature-rollup.ts` precedent. No findings.
- Performance: at most one git spawn per (workspace, lane path) per process, and only while the lane ledger is absent. There is no regression in the steady state, which stays a single `existsSync` fast path.

### Verdict
APPROVED. Round-1 C1 and C2 are resolved and proven by smoke tests, AC4b and AC6b are implemented as amended, R-1..R-4 and O-1 are fixed, the build.ts concern is unreachable in file mode, and only recommended or optional items remain.
