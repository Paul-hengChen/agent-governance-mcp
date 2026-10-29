# Review — T-E158-01, T-E158-02, T-E369-01

covers: T-E158-01, T-E158-02, T-E369-01

## Round 1 — APPROVED — by code-reviewer

Base `f5485a7`, diff `f5485a7...HEAD` (source commits f517990, bbbd10f, ea871ef). Spec: `specs/e158-range-subject-audit.md` (ruling R1 = Option A). There is no architecture spec. The reviewer and sr-engineer ran on the same tier (opus), so same-model bias is possible. The independent checks below are runtime ones and do not rely on reading the code.

## Summary

- T-E158-01: `verify-release.mjs` Check 1 now FAILs when a commit in the range lists no changed path, and when the commit enumeration comes back empty. `check-bookkeeping.mjs` now exits 2 in three cases: an explicit `--base` that does not resolve, an explicit `--base` with no merge-base, and no base at all (R1 = A).
- T-E158-02: adds `FANOUT_CODES.rangeEmpty = "RANGE_EMPTY"`. `checkLane` and `rangePaths` return it when the `A...B` diff is empty, so the CLI exits 2 through `fail`. `dist/` is rebuilt.
- T-E369-01: `reclaimStale` now returns a boolean. When it returns false, `acquireLock` goes through the notify / `--max-wait` / sleep path instead of spinning. The reclaim log line is de-duplicated per observed content. The comment changes required by AC-E369-7 are done.
- Every hard constraint holds (see the evidence under each section). The only reds in the affected suites are the two re-pins the spec assigns to qa.
- Verdict: APPROVED. No `required` findings.

## AC Completeness

AC-E158-1 — implemented — scripts/verify-release.mjs:280-285. An empty commit joins `offenders` using the `vr.offender.no-paths` text. The tolerance NOTE (line 305) is unreachable once `offenders` is non-empty. The bookkeeping-only path is unchanged.
AC-E158-2 — implemented — scripts/verify-release.mjs:259-264. The text matches `vr.range.empty` word for word, and the function returns before the NOTE. Verified by reading the code, as the AC requires.
AC-E158-3 — implemented — the diff touches only Check 1. `--ci-check` and `--close-out` code is unchanged. `test/verify-release.test.mjs`, `test/e320-ci-check-sha.test.mjs` and `test/e326-empty-branch-run-poll.test.mjs` pass unmodified.
AC-E158-4 — implemented — scripts/check-bookkeeping.mjs:298-303. Runtime check against this repo: `--base nope` gives exactly one stderr line, `check:bookkeeping — cannot run: --base nope does not resolve to a commit`, and exit 2. `--base main` gives OK and exit 0. `cannotRun` (line 226) runs before any other output is printed.
AC-E158-4b — implemented — scripts/check-bookkeeping.mjs:318-320. The text matches `cb.base.none` word for word. The row-8 path (the base resolves but `docs/backlog.md` is missing at the base) keeps today's note (lines 336-343). The re-pin of `ID-MONO-NO-BASE-NOTE` belongs to qa (T-E158-03). That test is currently red, and the spec says it should be.
AC-E158-5 — implemented — tools/fanout-manifest.ts:1651-1661. The text matches `fanout.range-empty.check`. The early return comes before any report line is built, so the output for a non-empty range is unchanged.
AC-E158-6 — implemented — tools/fanout-manifest.ts:2166-2176. Runtime check: `owners specs/fanout-post-v4-w12.md --range main...main` gives one `fanout: error: RANGE_EMPTY: … an empty range proves nothing about ownership (E158)` line and exit 2. The `--paths` branch is untouched. The e331 re-pin belongs to qa (T-E158-03). That test is currently red, and the spec says it should be.
AC-E158-7 — implemented — tools/fanout-manifest.ts:193-195. Exactly one key was added. `test/error-code-contract.test.mjs` passes unmodified.
AC-E158-8 — implemented — `test/e177a-check-cli.test.mjs`, `test/e177a-manifest.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e235b-relative-worktree.test.mjs` and `test/e322-owners.test.mjs` pass unmodified. `npm run build` on HEAD leaves no diff under `dist/`.
AC-E158-9 — implemented — `grep -c '^lane_local_id: E158-NEW-1$' .current/e158/pending-tickets.md` prints `1`. The block sits above `## Applied` and has no `id:` field. The audit table has 17 rows with six columns each.
AC-E369-1 — implemented — scripts/test-lock.mjs:139, 268-277. Runtime smoke on a temp copy outside the repo (dead-pid lock plus a live guard, `maxWaitMs 300`, `pollMs 50`): the call resolved `{acquired:false, reason:"timeout"}` in 318 ms, using 18 ms of CPU and 13 `now()` calls (the bound is 26). Negative control: the base `f5485a7` copy of `scripts/test-lock.mjs` with the same setup never returned and was killed by SIGALRM at 4 s, which confirms the busy spin.
AC-E369-2 — implemented — same smoke with a corrupt guard inside the grace window: timeout in 310 ms, 11 `now()` calls.
AC-E369-3 — implemented — same smoke with the guard path as a directory: timeout in 329 ms, 13 `now()` calls.
AC-E369-4 — implemented — smoke with no `maxWaitMs` and the guard removed after 400 ms: `{acquired:true}` at 478 ms. The reclaim line was logged exactly once, plus one waiting line.
AC-E369-5 — implemented — CLI smoke `--max-wait 1 --lock-path L --poll-ms 50 --notify-interval 0.2`: exit 75, the wrapped command never ran (no marker file), and the waiting line was printed 5 times in about 1 s. So both `--max-wait` and the notify interval are honoured on the new wait path.
AC-E369-6 — implemented — scripts/test-lock.mjs:139 (`false` on guard contention or a recursive reclaim), 149 (`true` once the guard is won and the target is unlinked, gone, or changed), 150-151 (`true` only on ENOENT, `false` on any other unlink error). The callers at 268 and 276 retry at once only on `true`. `linkPublish`, `publishLock`, the payloads, the exports, `USAGE` and the exit codes are unchanged. `test/e177b-test-lock.test.mjs` (19/19), `test/e209-test-lock-publish.test.mjs` and `test/e362-reclaim-guard-publish.test.mjs` pass unmodified.
AC-E369-7 — implemented — the in-body `// Published by link…` comment is gone, and its content is in the `reclaimStale` doc comment (lines 112-114). The `publishLock` doc comment (line 187) is one line of 76 columns.
AC-E370-1..4 — not in scope for this round (qa-only, T-E370-01).
AC-LANE-1 — not in scope for this round (qa, final HEAD).
AC-LANE-2 — implemented — `git diff --quiet f5485a7 -- scripts/mailbox-watch.mjs` exits 0.
AC-LANE-3 — implemented, as of this HEAD — `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e158 --base main` reports `13 file(s) changed, 0 out of bounds`, exit 0.
AC-LANE-4 — not in scope for this round (no tests in this diff).

## Correctness

No `required` findings.

- sr flag (1), the FAIL prefix wording (verify-release.mjs:296), `optional`: an empty commit is counted under the prefix `… commit(s) in range touch non-bookkeeping paths:`, which is not literally true for a commit with no paths. The spec Copy row `vr.offender.no-paths` says on purpose that the string "joins the existing `offenders` list format", and AC-E158-1 pins only the per-offender text and the exit code. This is accepted as specified. A later wording pass could make the prefix neutral (for example "cannot be tolerated"), but that would change the bytes of the existing offender FAIL and needs its own ticket.
- sr flag (2), `--base` that resolves but has no merge-base (check-bookkeeping.mjs:304-308): **in scope, fail-loud.** The base code fell through silently to `origin/main` here. That is exactly the "silently swapping the `--base` I asked for" that the user story forbids. The only alternatives would be falling back (which contradicts the user story) or skipping with a note (which contradicts R1 = A and the new header promise "never a silent skip"). The reason string is not in the Copy table: `recommended` that pm add a Copy row (`cb.base.no-merge-base`) and that qa pin it in `test/e158-*.test.mjs`. This does not block approval. It can be reached with an unrelated-history ref. CI uses `fetch-depth: 0` and calls `check:bookkeeping` with no `--base`, so CI is not affected.
- sr flag (3), `reclaimStale` treating ENOENT as `true` (test-lock.mjs:150-151): correct. ENOENT means the target is already gone, so "the target no longer holds `observedRaw`" holds and retrying the publish at once is right. Every other unlink error returns `false` and waits, so a persistent EACCES can no longer spin. The shared de-duplication (`lastReclaimLoggedRaw`) is sound. A given raw string is either a parseable dead-pid payload or unparseable, never both, so the two log lines cannot hide each other. The de-duplication remembers only the last value, so an A→B→A content sequence logs A twice. That is negligible and within "at most once per distinct observed content" in practice. `optional`.
- `recommended` (follow-up, not part of this AC): `parseArgs` (check-bookkeeping.mjs:243-250) still silently ignores `--base=` (an empty value is falsy) and a trailing `--base` with no value. Both fall back to `origin/main` with no message. This is the same class of error as the user story but outside AC-E158-4's "does not resolve" wording. Suggest a pending ticket.
- `optional`: the row-8 note text (check-bookkeeping.mjs:342) still says `no base commit found (pass --base <ref>)`. After this change it is only reached when a base *was* found but has no `docs/backlog.md`, so the text no longer matches the cause. The spec pins "keeps today's note" (audit row 8 and AC-E158-4b), so it is correctly left unchanged in this ticket. A future wording fix needs a spec change.
- `optional`: when a dead-holder reclaim returns `false`, the waiting line (test-lock.mjs:280-285) names the dead pid as the holder, but the real blocker is the guard's holder. This is cosmetic, and the AC12 line format is pinned.
- Pre-existing, not introduced here, `optional`: if `lockPath` is a dangling symlink, `linkSync` returns EEXIST while `readLock` returns `absent`, so the loop at line 258 still spins. It is outside E369's scope (the AC names the guard-blocked spin only).
- Expected-Red Sampling (SOP 4a): the diff touches no test file. The two reds seen in the affected-suite run are `test/e299-check-bookkeeping.test.mjs` `ID-MONO-NO-BASE-NOTE` and `test/e331-git-diff-failure.test.mjs` `other owners / check exit codes are unchanged on the same repo`. Both are explained by this diff, and the human-approved spec assigns them to qa as re-pins (T-E158-03). No `qa_reports/expected-red_e158-range-subject-audit.txt` exists. Since these are spec-declared re-pins in the same feature, and not unexplained reds, this is not a finding. qa must land T-E158-03 before any full-suite PASS. Run result: 203 tests, 201 pass, 2 fail (exactly those two).

## Quality

- New code follows the surrounding conventions (`cannotRun`, `inputErr`, `FANOUT_CODES`, the offenders list). No dead code. The old `if (base !== null)` branch was removed correctly, because `resolveBase` now either returns a sha or exits.
- Comment check (SOP 4b), with two `agc check — comments` warnings touching the diff, both kept:
  - `scripts/check-bookkeeping.mjs:2 long-block 37 lines`: kept. The header block was already over the limit before this change. The diff adds one line that documents the new exit-2 behaviour, which is user-visible.
  - `scripts/test-lock.mjs:107 long-block 11 lines`: kept. AC-E369-7 requires moving the in-body rationale into this doc comment, and the four added lines state the return contract (WHAT), which callers depend on.
- Other new comments are short WHAT/WHY lines (verify-release.mjs:215-216, check-bookkeeping.mjs:295-296, fanout-manifest.ts:193-194, 1620-1621, 2153). The fanout-manifest.ts:2153 doc comment dropped "read-only git". The function is still read-only, so nothing was lost that matters.
- Information hygiene: no local absolute paths, hostnames or secrets in the tracked diff (`.current/e158/*`, spec, scripts, tools, dist). The runtime messages include `${repo}`, the same as the existing `GIT_DIFF_FAILED` message.

## Architecture

No architecture spec exists (the spec says there was no architect hop). Layering is unchanged: the CLI-facing errors go through the existing `fail`/`formatError` (exit 2), and `RANGE_EMPTY` is one new `FANOUT_CODES` key. No programmatic caller of `checkLane`/`rangePaths` exists outside `tools/fanout-manifest.ts` (`runCheck` at :2321 and `runOwners` at :2367 only). The new exit 2 reaches only CLI consumers, and the spec says the integrator SOP already reads exit 2 as "the condition does not hold". The changed files are within the lane's owned set, and `fanout check` reports 0 out of bounds.

## Security

No findings. All git calls use `execFileSync` with an argv array (no shell). In check-bookkeeping, the user-supplied `--base` goes into `rev-parse --verify --quiet <ref>^{commit}` before `merge-base`, so only a resolvable ref reaches `merge-base`. No new filesystem write paths in test-lock. The guard and lock publish method is unchanged.

## Performance

No regression. Check 1 adds an O(1) length check per commit. fanout adds an O(1) emptiness check after the existing diff. test-lock is strictly better: on a blocked reclaim the base pegged a core (it never returned in 4 s), and the new code sleeps `pollMs` per iteration (18 ms of CPU across 318 ms of waiting in the smoke).

## Verdict

APPROVED. Every AC in this round is implemented and every hard constraint holds (dist matches source, the `--ci-check`/`--close-out` code is untouched, the publish method is unchanged, `mailbox-watch.mjs` is byte-identical, the error-code contract is green, and the non-empty-range output is unchanged). The no-busy-spin fix was confirmed at runtime against a base negative control. The remaining items are `recommended`/`optional` follow-ups.
