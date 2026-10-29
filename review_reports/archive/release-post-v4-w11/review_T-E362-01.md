# Review — T-E362-01

## Summary
- Round 1. Scope: sr-engineer commit fe88f88, `scripts/test-lock.mjs` only (+17/−11), checked as `git diff origin/main...HEAD -- scripts/`. The merged-in E364 files are not reviewed here.
- `reclaimStale` no longer creates its guard with `openSync(guardPath, "wx")` and writes the payload afterwards. It now publishes the guard through a new private helper, `linkPublish(destPath, tag, content)`, which writes a temp file next to the guard, fsyncs it best-effort, hard-links it into place, and removes the temp in `finally`. `publishLock` now delegates to the same helper with tag `acquire`.
- I reproduced the F1 sequence on my own, in a scratch copy under `$TMPDIR` written from scratch (sr's scratch script was read but not relied on). On the base copy (`fe88f88~1`), the guard is empty when it first exists and the live lock L is deleted by the stalled reclaimer R1. On HEAD the guard is non-empty when it first exists, R2 is blocked by R1's live guard, and the invariant holds. Node 22.22.3 and Node 20.20.2 give the same result.
- Isolated lock suites: `node --test test/e177b-test-lock.test.mjs test/e209-test-lock-publish.test.mjs` gives 24/24 on Node 22 and 24/24 on Node 20.
- Same-model note: sr-engineer and this reviewer both ran on the opus tier, so some blind spots may be shared. The behavioural checks below were written independently of sr's repro to offset that.
- Verdict: APPROVED.

## AC Completeness
AC-E362-1 — N/A for this task. The deterministic repro belongs to qa (T-E362-02). Reviewer-side, the F1 sequence goes red on base and green on HEAD; see Correctness case A.
AC-E362-2 — implemented — scripts/test-lock.mjs:120 (guard published via `linkPublish(guardPath, "publish", …)`, payload shape `{ pid, at }` unchanged). The temp name `<guardPath>.publish-<pid>-<seq>-<hex>` is built at :200, so it starts with `<guardPath>.` and contains `.reclaim-`. Best-effort fsync at :205–209. Link at :213. Temp unlinked in `finally` at :214–220. The EEXIST inspection path is unchanged at :121–135 (dead-pid and corrupt-past-grace branches, `depth < 2`, early `return`). Other errors fall through to the bare `return` at :135. The compare-and-unlink step at :137–153 is unchanged. Nested guards go through the same recursive call, so they are published the same way.
AC-E362-3 — implemented — no change to the corrupt branch (:131). Checked behaviourally in case H: a fresh zero-byte guard leaves both the guard and the target untouched, a guard backdated past the grace period is reclaimed while the target is kept, and the next call reclaims the target.
AC-E362-4 — implemented — `publishLock` (:189–191) keeps the temp shape `<lock>.acquire-<pid>-<seq>-<hex8>` (case G regex), the fsync, the link, EEXIST and other-error propagation (the helper rethrows, and acquireLock's `err.code !== "EEXIST"` rethrow at :254 is unchanged), and temp removal. Exports, signatures, constants, `USAGE`, flags and exit codes are untouched (the diff touches no export line). `test/e209-test-lock-publish.test.mjs` is unmodified and green.
AC-E362-5 — implemented — `git diff --name-only origin/main...HEAD` lists `scripts/test-lock.mjs`, `specs/e362-test-lock-guard.md` (PM) and `.current/e362/*` (lane state) only. No `scripts/mailbox-watch.mjs`, `tools/**` or `dist/**` change. Nothing else in `scripts/`, `bin/` or `tools/` imports `reclaimStale`.

## Correctness
No required findings. The adversarial checks below were run on a scratch copy of HEAD and of base (`fe88f88~1`), using a CommonJS `node:fs` interposer plus `syncBuiltinESMExports()`, on Node 22 and Node 20:

- **A — F1 sequence (never observable empty).** The interposer fires the first time the guard path exists: after `openSync` on base, after `linkSync` on HEAD. It backdates the guard past `CORRUPT_GRACE_MS` and runs R2. When R1 reads the target, R2 runs again, and an acquirer publishes L if S is gone. Base: the guard is empty when first seen, and **L is deleted**, which reproduces the bug. HEAD: the guard is non-empty, R2 returns on a live guard, R1 alone reclaims S, and nothing is left over.
- **B — throw between temp create and link** (`writeSync` throws EIO): no throw escapes, no guard, no temp, target intact.
- **C — non-EEXIST link error** (`linkSync` EPERM): no throw, no temp, target intact.
- **D — `closeSync` throws** after the close: no throw, temp removed, target intact.
- **E — lost race to a live guard** (EEXIST): only the target and that guard remain, and no temp is left.
- **F — nested depth-1 reclaim of a dead-pid guard:** the nested guard `<guard>.reclaim-<d2>` is link-published non-empty (45 bytes) from `<guard>.reclaim-<d2>.publish-…`. The first call removes only the dead guard and the second removes the target. The directory ends up empty.
- **G — shared `publishSeq`:** in a dead-holder acquire, the sequence runs `l.acquire-<pid>-11-…`, then `l.reclaim-…publish-<pid>-12-…`, then `l.acquire-<pid>-13-…`. The lock temp shape still matches `^l\.acquire-<pid>-\d+-[0-9a-f]{8}$`. The only visible effect of sharing the counter is gaps in the lock's sequence numbers. No test or reader depends on the sequence values, and uniqueness still rests on pid + seq + 4 random bytes.
- **H — legacy empty guard grace:** as described under AC-E362-3.

EEXIST can only come from `linkSync`. `openSync(tmp, "w")` has no `O_EXCL`, so a stray EEXIST cannot come from the temp open and wrongly route to the inspection path. The `publishSeq` TDZ is not a risk: `linkPublish` is only reachable after the module has finished evaluating.

- `optional` — scripts/test-lock.mjs:120. On a filesystem without hard-link support, `reclaimStale` called directly now returns silently, where base reclaimed through `openSync("wx")` (case C differs between base and HEAD). This is not reachable through `acquireLock`: since E209, `publishLock` already needs `linkSync`, and its non-EEXIST error is rethrown at :254 before any reclaim. No action needed. Recorded only so the contract change is visible.

## Quality
- `recommended` — scripts/test-lock.mjs:118–119. The two-line WHY comment sits inside the function body. Constitution §6 says to avoid in-body comments and to put a short non-obvious warning at the head of the function. It could become one clause of the `reclaimStale` doc comment (:107–113). This is not blocking: the file already uses in-body comments (e.g. :262–263), and the comment says WHY, not HOW.
- `recommended` — scripts/test-lock.mjs:193–198. The summary sentence of `linkPublish`'s doc comment runs about 200 characters, past the §6 limit of one sentence and at most 80 columns. Something like "Create `destPath` already holding `content`, never observable empty." followed by the mechanics as caller-facing constraints would meet the limit. The advisory comment scan (`dist/tools/comment-scan.js`) raises no warning for this file.
- `optional` — scripts/test-lock.mjs:120. The temp tag `publish` says less than the lock's `acquire`. A tag such as `guard` would make a crash leftover easier to identify. Cosmetic.
- Removing the extra `try { writeSync } finally { closeSync }` level simplifies `reclaimStale`. Extracting the helper is the single shared helper that AC-E362-2 explicitly allows, and the change adds no dead code.

## Architecture
There is no `specs/e362-test-lock-guard-architecture.md`; the spec routes without an architect. The helper stays private (not exported), so the public surface is unchanged. Sharing one publish primitive between the lock and its guard removes the "create empty, write later" pattern at both levels, which is the design intent stated in the spec's Problem Statement.

## Security
No findings. Temp names are built from the guard path plus pid, counter and `randomBytes(4)`, with no user-controlled input. `linkSync` will not overwrite an existing destination, so there is no clobber vector. No new trust boundary and no secrets.

## Performance
No regression worth noting. Each reclaim attempt now makes about five filesystem calls (open, write, fsync, close, link, plus an unlink) instead of open/write/close, and adds one best-effort fsync. Reclaim only runs on a dead or corrupt holder, so this is off the hot path. Nothing grows without bound and no listeners are added.

## Verdict
APPROVED — the guard is now link-published and never observable empty. The F1 repro turns from red on base to green on HEAD under Node 20 and 22, cleanup holds on every failure path tested, and publishLock's observable contract is unchanged. The only open findings are recommended or optional comment and naming polish.
