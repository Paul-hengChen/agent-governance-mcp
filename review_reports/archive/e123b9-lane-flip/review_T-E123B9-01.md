# Review — T-E123B9-01 (batched round, review task T-E123B9-04)

covers: T-E123B9-01, T-E123B9-02, T-E123B9-03

## Round 1 — APPROVED — by code-reviewer

## Summary
- Uncommitted diff under `tools/`: lane-paths, lane-migrate, handoff-parse, handoff-write, lane-registry, metrics (726+/239-). Contract: `specs/e123b9-lane-flip.md` AC1–AC15 plus Out of Scope. No architecture spec exists for this feature.
- The resolver flip is in (AC1). Migration targets `resolveCurrentLane` (AC2) and is wired only at the two own-workspace entry points (AC3/AC13). The per-lane lock is in, with a locked-core/wrapper split (AC5/AC12). Dual presence raises a plain-Error `HANDOFF_LAYOUT_CONFLICT` (AC14). Sidecars merge flat-first (AC15). E132 history now reads the lane layout, ordered by `last_updated` (AC7).
- Checked against the built `dist/` with standalone node, in scratch fixtures only: 22/22 targeted checks pass. A 25-fixture × 6-process cross-process stress (4 readers + 2 writers at once on a flat workspace) gave 100/100 reads ok, zero half-moved layouts, zero duplicated sidecar lines, and zero leftover locks. The only errors were 5 writer `STATE DRIFT` rejections, which is correct when a sibling writer's write came in first.
- Suite: 205 reds (tsc --noEmit clean). I sampled failures by error class and found every one test-shaped: flat-path helpers, the retired "lane is ignored" RP2/RP4 contract, tests writing the flat `handoff.md` after a migration and so tripping AC14 by construction, and `session.test.mjs` passing the flat path to `verifyFreshness`. None points to a code bug.
- Verdict: **APPROVED**. No required findings. Two recommended hardening items (R1, R2) should be picked up before or with T-05, or filed.

## AC Completeness
AC1 — implemented — tools/lane-paths.ts:162-172 (`resolveLanePaths` iterates LANE_FILES under `resolveLaneDir`); resolveCurrentLanePaths unchanged in shape (:250-252).
AC2 — implemented — tools/lane-migrate.ts:329, :375 (`opts.lane ?? resolveCurrentLane(ws)`); verified: branch `feat/e777-other` with flat `active_feature: e999-x` migrates to `.current/e777/`; `main` goes to `_primary`.
AC3 — implemented — tools/handoff-parse.ts:136-169 (`migrateOwnWorkspaceIfFlat`, called at :521) and tools/handoff-write.ts:283-293 (inside the lock, before handoffPath resolves). Not in `readAndMigrate`/`parseHandoff`.
AC4 — implemented — the trigger predicate goes false once migrated; verified that a second read gives a byte-identical tree. Core errors propagate (handoff-parse.ts:158-168; handoff-write.ts:291). See Correctness, Q2, for the race-loser deviation, which I judge correct.
AC5 — implemented — tools/lane-paths.ts:188-190 (`resolveLaneLockPath`, sole composer); handoff-write.ts:279-281; lane-migrate.ts:405, :496. The lane dir is created before the lock (lane-migrate.ts:403; handoff-write ensureDir). The `HANDOFF_LOCK_FILENAME` literal is still single-owned.
AC12 — implemented — lane-migrate.ts:325/371 (flat→lane core/wrapper), :434/486 (lane→flat core/wrapper). writeHandoffStateCore calls the core (handoff-write.ts:291). readHandoffState is sync and uses a try-acquire plus the core (see Q1). The only `readState` caller is the tw_get_state handler (handoff-orchestrator.ts:92), outside any lock, so no call stack takes the same lock twice. Verified: a flat-fixture write finished in 15 ms.
AC-MIG-3 — implemented — verified: two concurrent public migrations produce exactly one mover plus one `alreadyMigrated: true`, and neither throws. Concurrent write+read in-process: no error. The cross-process stress results are in the Summary.
AC6 — implemented — handoff-write.ts:515-518: comment only, no logic changed.
AC13 — implemented — `readAndMigrate` (handoff-parse.ts:308-321) makes no lock, move or create calls and falls back to lane first, then flat, read-only. Verified: `parseHandoff` on a flat fixture returns the flat state, the SHA-256 tree is identical, and no lane dir is created. feature-rollup.ts / join-precondition.ts are untouched and still reach state only via `parseHandoff` inside their existing try/catch. lane-registry is readdir/stat/readFile only.
AC14 — implemented — handoff-parse.ts:108-121; asserted first in readAndMigrate (:309) and inside the write lock before any move (handoff-write.ts:285). A plain Error, not in GATE_REGISTRY. Verified on both read and write: the message carries both absolute paths, both `last_updated` values (including `unparseable/missing`) and the repair steps (restart servers, choose, delete/move, retry); the tree is unchanged. `parseHandoff` throws with the prefix, so feature-rollup's catch surfaces it as `readable: false`.
AC15 — implemented — lane-migrate.ts:214-224 (plan), :254-280 (atomic tmp+rename merge, flat first, newline guard). Verified: `[A,B]+[C,D]` becomes `A,B,C,D`, and a flat file with no trailing newline gets a separator. The reverse runner still refuses (planMoves `mergeSidecars=false`, :464).
AC7 — implemented — lane-registry.ts:118-184. Live lanes plus `history/<YYYY-MM>/<lane>` are merged into one list sorted by `last_updated` (Date or string). Invalid timestamps sort last, then ties break by lane, then by path. The null/[] contract matches the spec text. `archive`/`history`/dot-dirs/files are excluded.
AC8 — N/A for review (qa-owned proof, T-E123B9-05). A synthetic spot check on flat + sidecar + `.config.json` + `feature-split.md` + `archive/` came back byte-identical after migrateFlatToLane → migrateLaneToFlat.
AC9 — N/A for review (qa-owned; the 205 test-shaped reds are T-05's job).
AC10 — N/A for review (qa-owned test file). Note for qa: `tools/lane-registry.ts` is a genuine new lane-paths importer (`isSafeLaneName`), contrary to AC10's "no new entries expected". It is justified by AC7's lane-name filter and listed in `qa_reports/expected-red_e123b9-lane-flip.txt`.
AC11 — partial by design (build + tsc clean; suite green is gated on T-05). Not a finding against T-01..03.
Optional metricsPath — done — metrics.ts:101 (one resolution per emit, still inside the never-throw try).
Optional J1-NEW-2 — done — lane-paths.ts:70-71 (comment only).

Human-approved decisions, checked one by one:
- Target = `resolveCurrentLane(ws)`: exact.
- Lock at `.current/<lane>/.handoff.lock`: exact.
- `archive/` workspace-wide, comment-only change: exact.
- `HANDOFF_LAYOUT_CONFLICT` as a plain Error carrying both paths, both last_updated values and repair steps: exact.
- AC7 ordered by last_updated: exact.
- AC15 flat-first, with conflicts on handoff.md only: exact.

Workspace-wide files: LANE_FILES is unchanged (5 entries). `.config.json`, `exemptions.json`, `feature-split.md`, role overrides and `.agc-hook-marker.json` are neither added nor moved (the runners iterate LANE_FILES only; the round-trip fixture confirmed `.config.json`, `feature-split.md` and `archive/` stay in place).

## Correctness

**Q1 — sync try-acquire in readHandoffState (handoff-parse.ts:136-169): accepted.**
- (a) Lock format: identical to `withFileLock`. It uses `openSync(lockPath, "wx")` followed by the `{pid, acquiredAt}` JSON payload, so another process's `looksStale` reads it correctly. The empty-payload gap between open and write falls back to mtime and reads as not stale, which is the same gap `withFileLock` itself has.
- (a, stale PIDs) The path neither clears nor steals a stale lock. On EEXIST it backs off to the read-only flat fallback. That is the conservative direction: the next `withFileLock` writer (or a schema heal-write) clears the stale lock and migrates. I verified a dead-PID lock: the read leaves the layout flat, and the next write clears the lock and migrates.
- (b) AC12: the path is synchronous, so no other in-process task can interleave while it holds the lock. It is never called from inside `writeHandoffStateCore`'s callback (the sole `readState` caller is the tw_get_state handler). The schema heal-write is fire-and-forget `writeHandoffState`, issued after the sync lock has been released. Nothing acquires the same lock twice on one stack.
- (c) Busy-path freshness holds. `guards/session.ts` snapshots only `mtimeMs` (not the path), and `verifyFreshness` compares the lane path's current mtime against it. `renameSync` preserves mtime, so the writer that migrates under the lock passes. Verified in both directions: busy read, then release, then own write passes; busy read, then a foreign migration plus edit, then own write is rejected with `STATE DRIFT`.
- Residual TOCTOU: if the migration completes between `markStateRead` (:522) and the `existsSync` checks / `refreshSnapshotFor` stat (:526-529), the snapshot is `null`, and the next write fails with a spurious `STATE DRIFT`. That fails safe (retry). — `optional`: re-stat the lane path when the flat stat returns null.

**Q2 — race-loser `alreadyMigrated: true` (lane-migrate.ts:338-342): accepted.** AC-MIG-3 requires that "neither caller errors" under two concurrent calls. AC4's parenthetical "required entry missing mid-race" is only compatible with that if it means missing at both ends, and that case still throws (:343, and wrapper :382-393). The write path cannot reach the loser branch (it re-checks the flat file inside the lock), and the read path's try-acquire reaches it only when a peer finished between the predicate and the open. Recommend the PM tighten AC4's wording at close. This is not a code change.

**Q3 — AC15 resume rule (lane-migrate.ts:217-222).** The rule never duplicates a line in its intended case: it only fires when the lane file's leading bytes equal the whole flat file, so dropping the flat file removes bytes the lane already holds. Theoretical loss would need an independently produced lane file that starts with byte-identical flat content. JSONL lines here carry timestamps or ids, so I treat that as negligible. The real issue is that the rule is almost unreachable on the wired path — see R1.

**R1 — `recommended` — move order makes a mid-run failure strand flat sidecars permanently (lane-migrate.ts:282-297 with :335-342; LANE_FILES order at lane-paths.ts:41-45).**
- `executeMoves` walks LANE_FILES in order, so the required `handoff.md` is renamed first.
- If the process dies or an I/O error hits after that rename but before the later sidecar renames or merges finish, then:
  - AC3's trigger predicate is false from then on, because the flat handoff is gone.
  - Any explicit re-run takes the `alreadyMigrated` short-circuit, which skips the remaining flat sidecars.
- The leftover `.current/{telemetry,metrics,usage,dispatch}.jsonl` are then never migrated and are invisible to every lane-path reader. For the E6 retro sidecars that is silent data loss in practice.
- The same ordering is why the T-01 "drop" and prefix-resume branches for sidecars are effectively dead on the wired path.
- Pre-flight catches every logical refusal, so this needs a crash or an I/O fault in a millisecond window, once per workspace. That is why I tag it recommended rather than required.
- Fix (either one):
  - Order the plan so the required entry moves last. The rename of `handoff.md` then becomes the commit point, the trigger stays armed after a partial run, and the existing resume rules become live.
  - Or have the `alreadyMigrated` branch still sweep any remaining flat optional entries.
- If you reorder, note the one duplication path that becomes reachable: a crash after a merge publishes, then a pre-flip server appends to the flat sidecar, then a re-run. That is covered by the AC14 Rollout note (restart all servers).

**Q4 — reverse runner (lane-migrate.ts:434-501): accepted.** The core never unlinks the held lock (:469-471) and only removes the lane dir if it is empty. The wrapper removes it after release (:499), and `removeDirIfEmpty` tolerates ENOENT/ENOTEMPTY. — `optional`: a concurrent writer's `withFileLock` that has already done its `mkdirSync` but not yet its `openSync("wx")` can hit ENOENT and throw if the wrapper's rmdir lands in between. The reverse runner has no production caller, so this is acceptable.

**Q5 — path safety (lane-paths.ts:138-160): accepted.** `SAFE_LANE_RE` allows a single segment only. Every internally produced lane passes by construction: TICKET_ID_RE captures lowercase `[a-z0-9]` only, and `_primary`/`_legacy` start with `_`. The production "never throws" callers (telemetry, metrics, hooks) therefore never reach the throw. Verified: `../x` is rejected.

**Q6 — AC7 local YAML parse (lane-registry.ts:58, :155-163): accepted.** Both stated reasons hold:
- A historical snapshot must not trip parseHandoff's refuse-loud schema check.
- `parseHandoff` can only address the current lane, not an arbitrary sibling or history dir.

**Heal write:** it lands on the lane path. `writeHandoffState` resolves `handoffPath` inside the per-lane lock after migrating. Verified: a schema_version 10 flat fixture on `main` ends with only `.current/_primary/`, and the lane file is at v15.

## Quality
- R2 — `recommended` — tools/handoff-parse.ts:147-160 re-implements the lock-acquire payload inline. That makes a second owner of the `withFileLock` lockfile format, and it drifts silently if `LockPayload` changes. Move it into `guards/file-lock.ts` as an exported sync try-acquire (for example `tryWithFileLockSync(lockPath, fn): T | undefined`) so the one module owns the format and the release.
- `optional` — handoff-parse.ts:152-156: if `openSync` fails with a non-EEXIST code, the lane dir created for the lock is left behind (the rmdir cleanup only covers core failures).
- `optional` — `lastUpdatedOf` (handoff-parse.ts:88-99) and lane-registry.ts's `FRONTMATTER_RE`/`toEpochMs` are a third copy of frontmatter + timestamp extraction. This is tolerable for a best-effort diagnostic.
- Size: about 965 changed lines against a 300-line-per-task budget. A large share is header and contract comments (lane-migrate.ts alone is about 40% comment). The logic is one tightly coupled seam: the core/wrapper split, the trigger at two sites, and the conflict check share the same invariants. Splitting it after the fact would add churn and risk without making review easier. **Do not cut or split.** Record the overrun as a sizing lesson for the E123 retro: AC12–AC15 landed after the cut.

## Architecture
- No `specs/e123b9-lane-flip-architecture.md`.
- Layering fits the spec. Migration lives in lane-migrate (which does not import handoff-parse, avoiding a cycle). The trigger sits only at the two own-workspace entry points. The shared read primitive is read-only. `resolveLaneLockPath` is the single lock-path composer.
- The write path's post-lock lane re-check (handoff-write.ts:296-300) correctly guards a branch switch that happens while waiting for the lock.

## Security
- No findings. Lane names that reach the filesystem are validated as single segments (lane-paths.ts:138-160). The conflict message echoes only server-resolved absolute paths and a validated timestamp or literal. No new input crosses a trust boundary, and no secrets are involved.

## Performance
- No regression.
- Each own-workspace read adds a few `existsSync` calls. The migration runs once per workspace.
- `resolveCurrentLane` (a HEAD read) is called a small, constant number of times per read or write. metrics.ts drops one of those reads.
- `getLaneFeatureHistory` is O(lanes + history buckets × lanes) readdir/readFile. It is only on the occasional roll-up path, not on tw_get_state.
- The sidecar merge reads each file into memory once or twice. Sidecars are small append logs, so this is acceptable.

## Verdict
APPROVED. All AC1–AC15 items owned by T-01..T-03 are implemented, every human-approved decision matches exactly, the six sr design calls hold under code reading and a multi-process stress test, and the remaining findings are hardening (R1 move order, R2 lock-helper ownership) that does not block qa.

Reviewer model: opus; sr-engineer pinned to fable, so this is a different model and same-model bias is not suspected. Scratch verification scripts: `cr/{verify,stress,child,heal}.mjs` in the reviewer session's scratch directory (not committed).
