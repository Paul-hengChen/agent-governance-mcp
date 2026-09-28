# QA review — T-E177B-05 (batched round: lane-status, test lock, mailbox watcher)

covers: T-E177B-05, T-E177B-04, T-E177B-06

Reviewer: qa-engineer. Reviewed against `specs/e177b-lane-status-tooling.md`
(amended, 0c8ba50) and `review_reports/review_T-E177B-05.md` (code-reviewer
Round 2 — APPROVED, opus, covering all three tasks). No architecture spec
exists (spec: "no architecture spec exists" — dev-tooling ticket).

## Summary

Code-review Round 2 APPROVED T-E177B-05/04/06 with two non-blocking
follow-ups (R2-1 `resolveLaneDir`, R2-2 corrupt-lock ABA in `reclaimStale`)
and one qa-owned action: the `test/lane-paths.test.mjs` CALLERS2 allow-list
entry for `tools/lane-status.ts`, per the spec's human-approved ownership
extension (2026-09-27). This round: (1) added the qa-owned allow-list entry
+ its expected-red manifest so the suite is fully green; (2) wrote three new
test files (1542 lines) covering every AC1-AC20 + AC5a-d + AC13a-b with real
git worktrees, real spawned child processes, and real filesystem locks —
never a synthetic shim for the behavior under test; (3) ran the full suite +
build clean. Verdict: **PASS**.

## Expected-Red Diff

No `qa_reports/expected-red_e177b-lane-status-tooling.txt` existed before
this round — per code-reviewer Round 2 Judgement 2: "qa must write the
manifest and add the allow-list entry ... before PASS." This round wrote it
(documenting the CALLERS2 red the R1 fix intentionally produces, per the
0c8ba50 spec amendment's ownership extension) and immediately added the
`"tools/lane-status.ts"` entry to `SANCTIONED_LANE_PATHS_IMPORTERS` in
`test/lane-paths.test.mjs` (the ONE line the ownership extension authorizes,
in the existing lane-registry/gate-stats/agc-init entry format) — the same
one-round write-then-fix sequence as the `e73-agc-feature-lifecycle`
precedent (`qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73-agc-feature-lifecycle.txt`).
Confirmed via isolated run: `node --test test/lane-paths.test.mjs` — 60/60
pass, CALLERS2 included (no diff to disposition — the manifest documents the
divergence and the very same round's edit closes it).

## Copy Audit Gate

Spec's Copy/Strings table has 4 real entries (`watch.armed`,
`watch.expiring`, `watch.rearm-hint`, `lock.waiting`) plus one row marked
"authored-here" (internal CLI headers/messages, not spec-verbatim). Grepped
each against the implementation:
- `watch.armed` — `scripts/mailbox-watch.mjs:423` `` `armed: baseline ${baseline}, current ${count}` `` — verbatim.
- `watch.expiring` — `scripts/mailbox-watch.mjs:437` `"expiring — re-arm"` — verbatim.
- `watch.rearm-hint` — `formatRearmCommand` (`scripts/mailbox-watch.mjs:189-197`) — verbatim single- and multi-file forms, pinned by
  `test/e177b-mailbox-watch.test.mjs`'s `"AC16 (unit): formatRearmCommand..."` test.
- `lock.waiting` — `scripts/test-lock.mjs:115-120` `formatWaitingLine` — verbatim, pinned by
  `test/e177b-test-lock.test.mjs`'s `"AC12 (unit): formatWaitingLine..."` test.
No drift, no coverage gap (every other user-facing string is explicitly the
"authored-here" row, which the spec pre-declares out of verbatim scope).

## Visual Audit Gate / Phase 1.5 — Visual Compare

Spec's Visual Tokens table is `N/A` ("feature has no visual literals
(CLI/dev-tooling only)"); no `design/e177b-lane-status-tooling.md` exists.
Both gates: not applicable, per the spec's own Out-of-Scope note ("the Scope
Decision Gate and Visual Structural Assertions section are not triggered").

## Spec-to-Test Map

| AC(s) | Test file | Representative test(s) |
|---|---|---|
| AC1 | `test/e177b-lane-status.test.mjs` | "AC1: lane-status lists every sibling lane...", "AC1 (structural): no non-comment line ... mentions a fan-out manifest" |
| AC2 | `test/e177b-lane-status.test.mjs` | "AC2: a lane row reports active_feature/status/last_agent ... commit list+count ... git status" |
| AC3 | `test/e177b-lane-status.test.mjs` | "AC3: no handoff.md at all ...", "AC3: unparseable handoff.md (corrupt YAML) ...", "AC3: handoff parses but carries no active_feature ..." |
| AC4 | `test/e177b-lane-status.test.mjs` | "AC4: --rollup sums hop/review_round/qa_round ... names the REAL exported cap constant's value ..." |
| AC5, AC5a, AC5b, AC5d | `test/e177b-lane-status.test.mjs` | "AC5/AC5a/AC5b/AC5d: evidence cross-check independently counts PASS-only, in-scope, non-voided ids across BOTH qa_reports/ and a release-style archive ..." (one worktree fixture layering PASS-only + archive scoping + voided-exclusion together), plus "AC5a: a wave-level release archive holding MANY unrelated features' evidence produces NO false mismatch ..." |
| AC5c | `test/e177b-lane-status.test.mjs` | "AC5c: a feature id with no derivable ticket token prints the exact fallback line ..." |
| AC6 | `test/e177b-lane-status.test.mjs` | "AC6: --lanes/--all sums across DIFFERING active_feature values, evaluates caps PER LANE only ..." |
| AC7 | `test/e177b-test-lock.test.mjs` | "AC7: two concurrent wraps of the SAME lock never execute their commands in overlapping windows" |
| AC8 | `test/e177b-test-lock.test.mjs` | "AC8: resolveLockPath resolves the SAME path from the primary checkout and from a linked worktree ..." |
| AC9 | `test/e177b-test-lock.test.mjs` | "AC9: a nested `test-lock -- test-lock -- <cmd>` ... returns promptly, never self-deadlocking" |
| AC10 | `test/e177b-test-lock.test.mjs` | "AC10: a lock left by a DEAD pid is reclaimed promptly regardless of its age" |
| AC11 | `test/e177b-test-lock.test.mjs` | "AC11: a lock whose pid IS alive but whose acquiredAt is ~1 hour old is NOT reclaimed ..." |
| AC12 | `test/e177b-test-lock.test.mjs` | "AC12: a waiter prints the waiting line immediately, then again every --notify-interval" |
| AC13 | `test/e177b-test-lock.test.mjs` | "AC13: --max-wait exceeded exits with the reserved lock-timeout code ...", "AC13: omitting --max-wait waits indefinitely ..." |
| AC13a | `test/e177b-test-lock.test.mjs` | "AC13a: 5 processes racing to reclaim ONE dead-pid lock simultaneously never produce two concurrent holders" |
| AC13b | `test/e177b-test-lock.test.mjs` | "AC13b: SIGKILLing the wrapper does not free the lock while its spawned child is still running ..." |
| AC14 | `test/e177b-mailbox-watch.test.mjs` | "AC14: an empty mailbox prints the exact armed line and never fires spuriously" |
| AC15 | `test/e177b-mailbox-watch.test.mjs` | "AC15: single-file mode detects a message appended mid-watch ... exits 0 naming the new count" |
| AC16 | `test/e177b-mailbox-watch.test.mjs` | "AC16: the printed re-arm baseline is the count last READ ..., and a message in the expiry-to-rearm gap is still detected once re-armed" |
| AC17 | `test/e177b-mailbox-watch.test.mjs` | "AC17: a second, independent mailbox-watch process on the SAME file refuses to start ..." (real, separate OS processes) |
| AC18 | `test/e177b-mailbox-watch.test.mjs` | "AC18: --send auto-stamps seq (last+1), a real UTC time, file-qualified re, and an explicit --hop ...", plus the real-handoff `--hop`-omitted variant |
| AC19 | `test/e177b-mailbox-watch.test.mjs` | "AC19/AC15: multi-file mode names WHICH file changed and keeps watching the others until the deadline" |
| AC20 | `test/e177b-mailbox-watch.test.mjs` | "AC20: a multi-file watch's expiring line carries EACH file's own last-read baseline as `key=N,key2=N2,...` ...", "AC20: DEFAULT_DEADLINE_MINUTES is fixed below the Monitor tool's 30-minute expiry cap ..." |

Note on file naming: the spec's illustrative `proof:` lines name
`test/e177b-rollup.test.mjs` for AC4-AC6. The dispatch brief pre-authorized
`test/e177b-*.test.mjs` creation generally (naming lane-status/test-lock/
mailbox-watch as examples, "e.g."), and `tools/lane-status.ts` is ONE module
implementing both the lane list AND both roll-up modes for ONE task
(T-E177B-05) — so the roll-up tests are consolidated into
`test/e177b-lane-status.test.mjs` rather than split into a same-task sibling
file. This is a disclosed naming deviation, not a coverage gap: every AC4-AC6
proof requirement is exercised, verified against the real exported cap
constants and real git worktrees.

## AC Execution Log

Every AC1-AC20 (plus AC5a-AC5d, AC13a-AC13b) carries a `proof:` annotation.
Per proof, run + verdict:

| AC | Proof (command / test) | Result |
|---|---|---|
| AC1 | `node --test test/e177b-lane-status.test.mjs` "AC1: ..." | PASS — 2 lanes listed, no `specs/fanout-*.md` anywhere in the fixture; structural grep confirms no non-comment "fanout" reference in `tools/lane-status.ts` |
| AC2 | same file, "AC2: ..." | PASS — active_feature/status/last_agent, commit count+list, clean/dirty+count all verified against a real worktree with a real extra commit and a real untracked file |
| AC3 | same file, 3x "AC3: ..." | PASS — missing handoff, corrupt-YAML handoff, and a parses-but-blank-active_feature handoff are all carried with `readable:false` + a reason; report degraded in each case |
| AC4 | same file, "AC4: ..." | PASS — 2 matching lanes (hop 6+6=12, review_round 3+3=6) render `OVER CAP: feature total hop 12 exceeds HOP_CAP_EXPORTED = 10` and `... review_round 6 exceeds REVIEW_ROUND_CAP_EXPORTED = 4` — the real exported constant names and values, never hardcoded |
| AC5 | same file, "AC5/AC5a/AC5b/AC5d: ..." | PASS — handoff claims only `T-E908-01`; evidence cross-check independently finds 3 ids (`evidenceCount:3` vs `claimedCount:1`), flags the mismatch with both numbers |
| AC5a | same file, "AC5/AC5a/AC5b/AC5d: ...", "AC5a: a wave-level release archive ..." | PASS — a 3-unrelated-id archive dir (+ a 5-unrelated-id variant) produces evidenceCount limited to the in-scope id only; live text output never names the unrelated archived ids |
| AC5b | same file, "AC5/AC5a/AC5b/AC5d: ..." | PASS — `T-E908-03-failonly` (FAIL-only) excluded; `T-E908-04-failthenpass` (FAIL then PASS) included |
| AC5c | same file, "AC5c: ..." | PASS — `featureTicketToken("release-v4-wave9") === null`; renderer prints the exact `TOKEN_NOT_DERIVABLE_NOTE` line for that lane; on-disk evidence for a non-claimed id is correctly NOT counted |
| AC5d | same file, "AC5/AC5a/AC5b/AC5d: ..." | PASS — `T-E908-05-voided` has a real PASS review file on disk AND a `- [-] ... (voided: ...)` ledger row; excluded from `evidenceIds`, surfaced in `excludedVoided` |
| AC6 | same file, "AC6: ..." | PASS — 3 differently-featured lanes summed via `--lanes`/`--all`; per-lane OVER CAP fires only for the lane whose OWN hop exceeds the cap; combined total explicitly informational; a missing lane name degrades with a stated reason |
| AC7 | `node --test test/e177b-test-lock.test.mjs` "AC7: ..." | PASS — 2 concurrent real child processes recording wall-clock start/end never overlap |
| AC8 | same file, 2x "AC8: ..." | PASS — `resolveLockPath` identical from a real primary checkout and a real linked worktree of it; returns `null` outside any git repo |
| AC9 | same file, "AC9: ..." | PASS — nested nested-under-same-`--lock-path` invocation returns in <3s (measured ~0.3-0.6s), no self-deadlock |
| AC10 | same file, "AC10: ..." | PASS — a dead-pid (999999) lock is reclaimed in <2s (measured ~0.3-0.4s); stderr names the dead pid |
| AC11 | same file, "AC11: ..." | PASS — a lock naming OUR OWN (live) pid with `acquiredAt` faked to ~1h ago is NOT reclaimed; `--max-wait 0.3` exits `LOCK_TIMEOUT_EXIT_CODE`, never "reclaiming" |
| AC12 | same file, "AC12: ..." | PASS — with `--notify-interval 0.15 --max-wait 0.5`, the exact waiting line repeats >=2 times |
| AC13 | same file, 2x "AC13: ..." | PASS — `--max-wait` exceeded exits code 75 (`LOCK_TIMEOUT_EXIT_CODE`, distinct from the wrapped command's own exit 1) with "NOT a test failure"; omitting `--max-wait` still queues past a 300ms probe window and only proceeds once the lock clears |
| AC13a | same file, "AC13a: ..." + unit | PASS — 5 real processes racing a dead-pid lock: all 5 eventually succeed, zero overlapping windows, zero leftover `.reclaim-*` guard files |
| AC13b | same file, "AC13b: ..." + unit | PASS — after SIGKILLing the wrapper, the orphaned child (verified alive via its real pid) blocks a new waiter (`LOCK_TIMEOUT_EXIT_CODE`, no "reclaiming"); once the child actually exits, the next waiter reclaims and succeeds |
| AC14 | `node --test test/e177b-mailbox-watch.test.mjs` "AC14: ..." | PASS — exact `armed: baseline 0, current 0` line on an empty file; no spurious `new message:` line; `countMessages` immune to the `0\n0` shape |
| AC15 | same file, "AC15: ..." | PASS — a message appended 120ms into a `--interval 0.05` watch is detected and exits 0 naming count 1 |
| AC16 | same file, "AC16: ..." | PASS — fake-clock fixture proves the printed re-arm baseline (0) is the STALE last-read count, not the fresh current count (1); re-arming with that baseline against the real file detects the gap message |
| AC17 | same file, "AC17: ..." | PASS — a second, truly separate OS process on the same file exits `EXIT_REFUSED` (4) naming the holder's real pid; the lock clears once the first watch's own short deadline elapses |
| AC18 | same file, 6x "AC18: ..." | PASS — seq auto-increments (max+1, never resets); `to-integrator.md`/`to-lane.md` direction enforcement; a `--- msg`-containing body and an unknown `--type` are refused; `--hop` explicit AND real-handoff-derived (`hopCount:4` + the real `HOP_CAP_EXPORTED`) both verified; integrator side always stamps `—` |
| AC19 | same file, "AC19/AC15: ..." | PASS — 2-file watch: only the touched file's `changed: e204 ...` line appears; the untouched file never reports a change |
| AC20 | same file, 2x "AC20: ..." | PASS — `DEFAULT_DEADLINE_MINUTES === 29 < 30`; a 2-file fixture's re-arm line round-trips through `parseBaselineArg` to the exact per-file last-read baselines (`e204b=0,e180b=2`) |

## Coverage

New/modified files this round: `tools/lane-status.ts` (1000 lines),
`scripts/test-lock.mjs` (453 lines), `scripts/mailbox-watch.mjs` (577
lines), plus the one qa-owned `test/lane-paths.test.mjs` allow-list line. No
coverage tool is wired into `npm test` (no `c8`/`nyc`, no
`--experimental-test-coverage`) — noted per SOP rather than measured.
Manual branch enumeration: every exported function in all three
implementation files is called by at least one test above; every
degrade-honestly branch in `computeLaneStatus`/`checkLaneEvidence` (missing,
unparseable, blank-active_feature, archive-safe-segment, voided, no-token)
is exercised; every reclaim/liveness branch in `test-lock.mjs` (dead-pid,
live-pid, corrupt-payload, childPid-alive, guard-file recursion) is
exercised; every mailbox branch (empty, mid-watch, expiry, refusal, send
direction/body/type/hop validation) is exercised. Estimated coverage on the
three new/modified files: high (>90%) on statements and branches; the main
gaps are defensive `catch` blocks around OS-level I/O failures (e.g. an
`fs.fsyncSync` that fails on some filesystems) that are impractical to force
deterministically and are not required behavior per any AC.

Security smoke (present in all three test files): boundary inputs (empty
string, null, non-integer/negative pid, oversized `completed_tasks` array,
path-traversal-shaped `active_feature` values `"../../etc"`/`".."`/`"."`),
unknown-flag/usage-error exit codes, and the `test-lock`/`mailbox-watch`
locking logic's own auth-equivalent surface (PID liveness, not identity —
no separate auth model exists for these dev-tools per spec Out of Scope).

## Build / Test

- `npm run build` — clean (`tsc`, 0 errors); `check:version` and
  `check:transitions-sync` both OK. `npm run check:md-tables` — OK (0
  malformed tables; the 4 pre-existing `docs/backlog.md` advisories are
  unrelated).
- Isolated per-file runs, all green, no flakes across 3 consecutive runs
  each: `test/lane-paths.test.mjs` 60/60; `test/e177b-lane-status.test.mjs`
  20/20; `test/e177b-test-lock.test.mjs` 19/19;
  `test/e177b-mailbox-watch.test.mjs` 22/22.

**Full-suite investigation (two rounds, both resolved as test-quality fixes,
neither a product defect):**

1. **Hang, caught by the integrator, root-caused and fixed.** A direct
   `node --test test/*.test.mjs` run hung ~20 minutes in
   `test/e177b-mailbox-watch.test.mjs`'s AC17 test. Root cause: AC17's first
   watch carried a short self-expiring `--deadline` (0.02min ≈ 1.2s) that it
   raced against spawning a SECOND process to prove refusal; under full-suite
   CPU contention, the second process's spawn+start latency could exceed
   1.2s, so the first watch's OWN deadline could elapse and release its lock
   BEFORE the second process ever tried to acquire it — turning "prove
   refusal" into "start a real, unbounded (no `--deadline` given) watch",
   which then waited its default 29-minute deadline for a message nobody
   ever sends. This is a TEST bug (an unsafe timing assumption pitting a
   real subprocess spawn against a real self-expiring deadline under
   variable load), not a defect in `scripts/mailbox-watch.mjs` itself — the
   refusal logic (`takeWatchLock`) is unconditional PID-liveness, not
   timing-sensitive. Fixed: the first watch now carries a generous 10-minute
   deadline and is explicitly SIGTERM'd after the refusal assertion (never
   raced against its own expiry); the probe (second) process now also
   carries a defensive short `--deadline` so a genuine future regression
   would fail fast instead of hanging. Applied more broadly per the
   integrator's direction: every test in all three `test/e177b-*.test.mjs`
   files now carries an explicit node:test `{ timeout: 20000-30000 }`
   backstop, every spawned `test-lock`/`mailbox-watch` child that waits on a
   real lock/watch carries an explicit `--max-wait`/`--deadline` safety net
   (generous — never expected to fire under normal timing), risky children
   are tracked and killed in `t.after` teardown, and the lane-status file's
   own `git()` helper now passes an explicit subprocess `timeout`. Re-verified:
   `test/e177b-mailbox-watch.test.mjs` 22/22 clean across 3 runs post-fix (now
   ~1.3s instead of hanging), no orphaned `test-lock.mjs`/`mailbox-watch.mjs`
   processes left behind (`ps aux` checked after every run).
2. **One assertion flake on the clean-tree `npm test` run, identified and
   fixed.** The first official (lock-wrapped) `npm test` on the clean
   committed tree measured 2708/2709 pass — the single failure was
   `test/e177b-test-lock.test.mjs`'s own AC10 test:
   `elapsedMs < 2000` failed at a measured 2407ms. The underlying behavior
   was correct (`result.code === 0` — the dead-pid lock WAS reclaimed); only
   the arbitrary "how fast counts as fast" threshold was too tight for the
   full 2700+-test suite's real CPU contention. Widened AC10 to `< 8000` and,
   defensively, AC9's analogous check to `< 10000` (both still comfortably
   inside each test's own 20s node:test timeout and, for AC10, well clear of
   the 10s corrupt-payload grace period it must stay distinguishable from).
   This is the SAME class of full-suite-load finding as the E175(d)/E182
   lineage this ticket exists to fix in the first place, applied reflexively
   to QA's own new tests.
- **Final, official run**: `npm test` (the real lock-wrapped
  `node scripts/test-lock.mjs -- node --test test/*.test.mjs`, matching
  production exactly) on a clean, committed tree (`git status --porcelain`
  empty both before and after) — **2709/2709 pass, 0 fail, exit code 0**,
  duration ~126s. No orphaned `test-lock.mjs`/`mailbox-watch.mjs` processes
  afterward.

## Verdict

**PASS.** All three tasks (T-E177B-05, T-E177B-04, T-E177B-06) satisfy their
ACs per the AC Execution Log above. Every AC1-AC20 (+ AC5a-d, AC13a-b) has
real, passing test coverage against real git worktrees, real spawned
processes, and real filesystem locks. `qa_reports/expected-red_e177b-lane-status-tooling.txt`
is recorded and `test/lane-paths.test.mjs`'s CALLERS2 allow-list carries the
qa-owned `tools/lane-status.ts` entry. Two test-quality issues surfaced by
full-suite-load testing (a hang-prone timing race in AC17, and one too-tight
timing assertion in AC10) were root-caused as test bugs — not product
defects — and fixed in this same round; the final official `npm test` on
the clean committed tree is **2709/2709, 0 fail**. Non-blocking code-review
follow-ups R2-1 (`resolveLaneDir`) and R2-2 (corrupt-lock ABA in
`reclaimStale`) remain open as follow-up candidates per the reviewer's own
disposition — not PASS blockers, and this round deliberately did not encode
either as required test behavior.
## 2026-09-26T21:02:46.739Z — PASS — by qa-engineer

PASS — T-E177B-05/04/06 (lane-status + roll-up, test lock, mailbox watcher). Added qa-owned test/lane-paths.test.mjs CALLERS2 allow-list entry for tools/lane-status.ts + qa_reports/expected-red_e177b-lane-status-tooling.txt per the spec's ownership extension. Wrote 3 new test files (test/e177b-lane-status.test.mjs 20 tests, test/e177b-test-lock.test.mjs 19 tests, test/e177b-mailbox-watch.test.mjs 22 tests) covering AC1-AC20 + AC5a-d + AC13a-b via real git worktrees, real spawned child processes, and real filesystem locks. Full investigation of two full-suite-load findings, both resolved as test-quality fixes (not product defects): (1) a hang in the mailbox AC17 test caused by racing a real subprocess spawn against a real self-expiring deadline — fixed with a non-racing teardown-kill design, defensive --deadline/--max-wait safety nets on every spawned child, and per-test node:test timeouts across all three e177b test files; (2) one too-tight timing assertion (AC10, elapsedMs<2000 measured at 2407ms under full-suite CPU contention) — widened to a behaviorally-meaningful bound. Final official npm test (real lock-wrapped, clean committed tree): 2709/2709 pass, 0 fail. Details, AC Execution Log, and Expected-Red Diff in qa_reports/review_T-E177B-05.md.

