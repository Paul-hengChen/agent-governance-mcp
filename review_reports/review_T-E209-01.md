# Review — T-E209-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- `acquireLock` now creates the lock through a new private `publishLock` (scripts/test-lock.mjs:184-215): payload written to a per-attempt temp file `<lock>.acquire-<pid>-<seq>-<8 hex>`, best-effort fsync, `fs.linkSync(tmp, lockPath)`, temp unlinked in `finally`. The call site (scripts/test-lock.mjs:245) replaces base's `openSync("wx")` + write; the `EEXIST` contention path, `reclaimStale`, every export and the CLI are byte-unchanged.
- Scope: one file, matches the T-E209-01 cut row. `git diff 2ad039d --name-only -- tools/ dist/` is empty.
- Related tests: `e177b-test-lock`, `e177b-mailbox-watch`, `e177b-lane-status`, `success-metrics` = 96/97; the one red is E8-S4, which belongs to T-E183-01 and is on the expected-red manifest.
- AC-E209-6: **partly refuted**. Counterexample below, reproduced deterministically in a scratch script. The cause is in the guard path, which this ticket does not touch and which the spec puts out of scope. It is older than this change, not a regression, and it does not block this ticket.
- Verdict: APPROVED. Same-model note: sr-engineer and this reviewer both ran on opus (dispatch pin), so their blind spots may overlap.

## AC Completeness
AC-E209-1 — implemented (repro itself is qa-owned, T-E209-02) — scratch interposer on `fs.linkSync` that calls `reclaimStale(lockPath, "")` the first time the lock appears: HEAD keeps the lock, which names `process.pid`, and the dir holds only the lock. The same interposer on `fs.openSync` against the base copy loses the lock. See qa note 1 about the wording.
AC-E209-2 — implemented — scripts/test-lock.mjs:193-215. The temp name carries pid, a per-process counter and 4 random bytes, so it can't collide with `recordChildPid`'s `<lock>.tmp-<pid>`. `EEXIST` from `linkSync` falls into the base `catch` at :248. Other errors propagate. Scratch checks: an `EPERM` thrown by `linkSync` propagates out of `acquireLock` and leaves the dir empty. A contention timeout against a live holder leaves only the holder's lock.
AC-E209-3 — implemented — the payload literal at :239-244 is unchanged. `publishLock` is not exported. No exported signature changed. Pre-existing e177b-test-lock cases are green.
AC-E209-4 — implemented — `readLock` and `reclaimStale` are untouched (:80-158). An empty or corrupt lock still hits the `CORRUPT_GRACE_MS` branch at :263.
AC-E209-5 — implemented — the CLI surface (:25, :295-327, :356-410) is unchanged. The existing CLI cases are green.
AC-E209-6 — implemented (no guard change, as the spec asks); the PM's claim is **partly refuted**, see Correctness F1.

## Correctness

**F1 (recommended, follow-up ticket; not required: older than this change and out of scope by spec) — AC-E209-6 ruling: the reclaim guard can still lead to a live lock being deleted.**
The PM's analysis holds for any guard that is empty only *momentarily*, meaning shorter than `CORRUPT_GRACE_MS`. During that window a second reclaimer gets `EEXIST`, reads the guard as `corrupt` with a fresh mtime, and returns (:130). Mutual exclusion holds. A reclaimer that wins the guard later reads the target after its own guard is in place, and since this fix that target is either absent or a fresh lock whose content differs from the stale observation. So the ordinary two-reclaimer interleavings are safe.
It breaks when a reclaimer's guard stays empty for more than `CORRUPT_GRACE_MS` while that reclaimer is still alive, for example a process stopped or starved between `openSync(guardPath, "wx")` (:119) and its `writeSync` (:140). The guard path is the same "create empty, write later" pattern this ticket removed from the target lock, one level down:
1. The lock holds stale content S (dead pid). R1 sees S as dead, wins `G_S = <lock>.reclaim-<digest(S)>` and stalls for 10 s or more before writing it.
2. R2 sees S as dead and gets `EEXIST` on `G_S`. It reads `G_S` as `corrupt` and older than the grace, reclaims it one level down (:130-131), unlinks R1's guard, and returns.
3. R2 loops, wins a fresh `G_S`, reads the target (`current === S`).
4. R1 resumes: writes into its now-unlinked guard inode, reads the target, and also gets `current === S`.
5. R2 unlinks S (:148). Acquirer A runs `publishLock`, and the live lock L appears.
6. R1 runs `unlinkSync(targetPath)` (:148) and deletes L. A believes it holds the lock, R1 then acquires too, and two suites run at once.
Reproduced deterministically on HEAD in a scratch script outside the worktree, using `module.syncBuiltinESMExports` interposition and a backdated guard mtime. Output: "A acquired = true … after R1 unlink: live lock exists = false".
Severity: low. It needs a stall of `CORRUPT_GRACE_MS` or more inside a two-syscall window plus an exact interleaving of a second reclaimer, which is far less likely than the target-level race this ticket closes (base lost the lock with no stall at all). Suggested follow-up: publish the guard with the same temp + `linkSync` pattern, so a guard is never empty and the corrupt-guard branch is reachable only for legacy files. Out of scope here per the spec's Out of Scope list ("Changing the `reclaimStale` guard-file write").
The other target-level interleavings I checked are safe on HEAD:
- Two reclaimers with the same S, serialized by an intact guard: the loser reads absent or L, not S.
- A reclaimer that stalls between its compare and its unlink while its guard is written: the guard names a live pid, so no one can take it.
- A new acquirer publishing between a reclaimer's unlink and the next reclaimer's compare: L differs from S.
L can equal S only if the same pid reappears with the same `acquiredAt` millisecond, which is negligible. An in-process caller that injects a constant `now()` and re-acquires under its own live pid is never reclaimed, because liveness is checked first.

**F2 (optional) — `linkSync` on a filesystem without hard links.** On exFAT/FAT and some SMB/FUSE mounts, `linkSync` throws (`EPERM`/`ENOTSUP`/`EXDEV`), and `acquireLock` now throws where base's `openSync("wx")` would have succeeded. The error path is identical to base: a non-`EEXIST` error propagates to `main`'s rejection handler, which prints `test-lock: <stack>` and exits 1 (:413-419). Checked with a scratch `EPERM` injection; no temp file is left. Acceptable. The lock lives in `<git-common-dir>` (or `--lock-path`), which is a hard-link-capable local FS in every supported setup. This is a loud failure, not a silent one, and AC-E209-2 sets exactly this propagation contract. A related note: on NFS, a `link()` whose reply is lost can be retried by the client and return `EEXIST` even though the link succeeded. The acquirer would then wait on its own live pid until `--max-wait`. A `.git` on NFS is out of the supported envelope, so no action.

**F3 (no finding) — temp-file lifecycle in every outcome.**
- Published: the `finally` unlinks the temp, and the lock keeps the inode (nlink goes 2 to 1).
- `EEXIST`: the `finally` unlinks the temp before the error leaves `publishLock`.
- `openSync(tmp)` fails: nothing was created, and the `ENOENT` from the unlink is swallowed.
- Write fails: the fd is closed, then the temp is unlinked.
- Other `linkSync` error: the temp is unlinked.
- Crash between open and the `finally`: a stray `<lock>.acquire-*` is left, holding either partial payload or a second hard link to the lock inode. Nothing sweeps it. That does not matter: `readLock`, `releaseLock`, `recordChildPid` and the guards only ever open exact names, and nothing lists the directory. The spec explicitly puts this cleanup out of scope.
- Name collisions: impossible within a process (the counter); across processes the pid differs; with pid reuse after a crash, the counter restarts but the 32-bit random suffix makes a collision negligible. Even then, "w" truncates and the file is rewritten as our own temp.

**Expected-red sampling (SOP 4a).** The diff adds no test file, but the run shows one red. `qa_reports/expected-red_e209-test-infra-fixes.txt` exists with one entry; I sampled all of it. `test/success-metrics.test.mjs | E8-S4: …` is locatable at test/success-metrics.test.mjs:941 with the exact name, and it is the only red in the run.

## Quality
- optional — scripts/test-lock.mjs:196 opens the temp with `"w"`. `"wx"` would refuse a pre-existing file or symlink at the temp name. With an unpredictable name in a user-owned directory, the practical gain is small. If adopted, note that an `EEXIST` from the temp open would then be read as lock contention, which is benign: the next loop iteration retries with a new name.
- Comment check (SOP 4b): the new JSDoc at :186-192 is accurate, generic, and holds nothing sensitive. Kept.
- Naming and structure match the surrounding module: same fsync best-effort idiom, same `finally` cleanup style as `reclaimStale`.

## Architecture
No architecture spec for this feature. The change stays inside the script, and the module keeps its no-dependency, builtins-only shape.

## Security
No findings. No new input crosses a trust boundary. The temp path derives from `lockPath`, which is resolved as before. `randomBytes` is used only for name uniqueness. See the Quality note on `"w"` vs `"wx"`.

## Performance
- optional — every acquire attempt now does open + write + fsync + link + unlink, where base did a single failing `openSync("wx")`. While waiting on a live holder, that is about 4 fsyncs per second at the default 250 ms poll. On local SSD the cost is negligible, and it is not on any test hot path. If it ever matters, `publishLock` could skip the temp write when `lockPath` already exists; the check would be advisory only, and the link stays the atomic step.
- No complexity-class change.

## Verdict
APPROVED — every T-E209-01 AC is met and the target lock can no longer be observed empty. The AC-E209-6 counterexample (F1) lives in the guard path, which the spec leaves out of scope, and needs a ≥10 s stall; it goes to a follow-up ticket, not this one.

### Notes for qa (T-E209-02)
1. AC-E209-1 wording: read `<content read>` as **the reclaimer's stale observation** (`""`, the content of the earlier empty incarnation), not as the content read after the publishing call. Read literally, the AC is red on HEAD too. Right after `linkSync`, the content is the fresh payload P, and `reclaimStale(lockPath, P)` unlinks P by contract, because it removes whatever matches the caller's observation and liveness is the caller's check. Scratch matrix: base/literal lost the lock (read length 0); base/stale lost it; HEAD/literal lost it (read length 212); HEAD/stale kept it, names `process.pid`, and the dir holds only the lock. On base, the literal read and the stale observation are the same `""`, which is why the cut-time repro looked right. The faithful repro passes `""` on both copies.
2. The AC-E209-6 counterexample (F1) is for the integrator to file as a follow-up. qa does not need to cover it.
