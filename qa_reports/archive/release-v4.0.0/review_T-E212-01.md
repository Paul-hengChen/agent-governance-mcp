# QA Review — T-E212-01 (E212: deflake AC13b)

**Feature**: `e212-deflake-ac13b` · **Lane**: e212 · **Branch**: `feat/e212-deflake-ac13b`
**Dispatch**: PM-sanctioned fresh single-role qa dispatch (Constitution §3.1, E16) — qa-engineer
authors + verifies; no sr-engineer or code-reviewer hop.
**Spec**: `docs/backlog.md` E212 row + `specs/fanout-wave7.md` e212 row (no dedicated
`specs/e212-*.md` — test-only infra ticket, no design/API/data-model surface).

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e212-deflake-ac13b.txt` manifest declared — this is not a
bugfix-mode ticket).

## Phase 1 — Review

**Problem** (backlog E212 / fanout-wave7.md e212 row): `test/e177b-test-lock.test.mjs` AC13b's
orphaned child busy-waited a fixed 700ms wall-clock window to "outlive" the wrapper's SIGKILL.
Under full-suite load the kill → wait-dead → spawn-probe sequence could outlast 700ms, so the
child legitimately exited before the probe ran, the lock was legitimately reclaimed, and the probe
observed exit 0 instead of `LOCK_TIMEOUT_EXIT_CODE`. Observed by the integrator: 1 failure in 3
full-suite runs (the failing run spent 4153ms in that one test); 8/8 isolated runs passed. The lock
implementation (`scripts/test-lock.mjs`) is not implicated — the probe's exit 0 was correct
behaviour once the child had actually exited; the test's timing assumption was the defect.

**Fix** (`test/e177b-test-lock.test.mjs`, AC13b test only — no other AC touched, no production code,
no `scripts/test-lock.mjs` change):
- Replaced the child's fixed `while (Date.now() - start < 700) {}` busy-wait with a test-controlled
  release: the child now polls (`Atomics.wait` on a throwaway `SharedArrayBuffer`-backed
  `Int32Array`, 20ms per tick — a real sleep, not a CPU busy-spin) for the existence of a
  `releaseFile` in its private tmpdir, and only writes `doneFile` once it observes that file.
- The test writes `releaseFile` only **after** the reclaim-probe assertion
  (`assert.equal(probe.code, LOCK_TIMEOUT_EXIT_CODE, ...)`) has already returned its verdict — so
  the "child still alive while the probe runs" premise now holds by construction, regardless of how
  long the kill → wait-dead → spawn-probe sequence takes under load.
- Added a safety ceiling in the child (`CEILING_MS = 15000`): if the test never writes the release
  file (e.g. an earlier assertion threw), the child self-exits after 15s instead of hanging forever.
- Hardened `t.after` cleanup: it now also best-effort writes the release file (idempotent) and
  SIGKILLs the recorded `childPid` (closed over via a `let childPid` set once known), so a failed
  assertion mid-test can never leak an orphan child process or leave one polling until the 15s
  ceiling.
- **Every existing assertion, its message text, and the exit-code expectations are unchanged** —
  diff is additive (release-file plumbing + comments) plus the one substitution of the busy-wait
  loop body; no assertion was added, removed, or reworded.

## AC → Test Map
| AC | Test | Coverage |
|---|---|---|
| AC13b (this ticket's target) | `test("AC13b: SIGKILLing the wrapper does not free the lock while its spawned child is still running; a new waiter reclaims only after the child exits", ...)` | Fixed: child lifetime is now test-controlled (release file, written post-probe) instead of a fixed 700ms wall-clock window. All 6 assertions unchanged (child-alive-before-kill, wrapper-dead, child-survives-SIGKILL, probe→LOCK_TIMEOUT_EXIT_CODE, stderr does-not-match `/reclaiming/`, post-release probe→0). |
| AC13b (unit) | `test("AC13b (unit): recordChildPid only rewrites a lock that still names OUR pid...")` | Untouched — not in scope, unaffected by this change. |

Copy Audit Gate / Visual Audit Gate / Phase 1.5 Visual Compare / Phase 3.5 AC Execution: all
**skipped — not applicable** (no `Copy/Strings` or `Visual Tokens` H2 in any spec for this ticket,
no `design/<feature>.md`, no `proof:`-annotated ACs; this is a test-timing-only infra fix with no
UI or spec-literal surface).

## Phase 2 — Discussion
No issues requiring a round — the fix is a direct, mechanical replacement of the flaky timing
premise; no open questions. Proceeding to Phase 3.

## Phase 3 — Tests
Test-file placement per dispatch brief: **only** `test/e177b-test-lock.test.mjs` AC13b + its helper
may be touched; no new test file. Confirmed — the diff is confined to the AC13b test block (lines
~427–484 pre-fix) in that file; no other file in `test/` was touched.

Security smoke tests: not applicable (test-infra timing fix, no new input surface, no auth/permission
change).

## Phase 4 — Run

### 1. Isolated sanity (no load)
```
node --test --test-name-pattern "AC13b" test/e177b-test-lock.test.mjs
```
Result: 2/2 pass (`AC13b`, `AC13b (unit)`).

### 2. Repeat run, no extra load — 25 iterations
```
for i in $(seq 1 25); do
  node --test --test-name-pattern "AC13b" test/e177b-test-lock.test.mjs
done
```
Result: **25/25 pass**, 0 failures.

### 3. CPU-stress + concurrent full-suite load — 25 iterations
Setup: 6 background `yes > /dev/null` CPU hogs (saturating cores) **plus** a concurrent background
`npm test` (full 2737-test suite) running at the same time, to reproduce the "kill → wait-dead →
spawn-probe sequence outlasts a fixed window under load" condition the integrator observed.
```
for i in 1 2 3 4 5 6; do ( yes > /dev/null & ) ; done
( npm test & )   # concurrent full suite for realistic contention
for i in $(seq 1 25); do
  node --test --test-name-pattern "AC13b" test/e177b-test-lock.test.mjs
done
```
Result: **25/25 pass**, 0 failures. The concurrent background `npm test` (2737 tests, using its own
real git-common-dir lock, unaffected by AC13b's private-tmpdir lock paths) also completed
**2737/2737 pass** (`duration_ms 161912.72`). All 6 `yes` stress processes were killed after.

### 4. Repro attempt on the OLD (pre-fix) code, same-machine stress (optional, cheap)
`git stash`'d the fix, restored the original 700ms-busy-wait AC13b, ran 15 iterations under 8
concurrent `yes` CPU hogs (no concurrent full suite, to keep this cheap):
```
for i in 1..8; do ( yes > /dev/null & ) ; done
for i in $(seq 1 15); do
  node --test --test-name-pattern "AC13b" test/e177b-test-lock.test.mjs
done
```
Result: 15/15 pass — did **not** reproduce the flake. Consistent with the integrator's own note
that 8/8 isolated runs passed; the reported 1/3 failure required real *full-suite* contention
(process-scheduling pressure from ~2700 concurrent/sequential test processes), not raw CPU
saturation from `yes` alone, so a cheap standalone repro doesn't reliably surface it. Restored the
fix immediately after (`git stash pop`) — verified via `git diff --stat` that the working tree
matched the fix before proceeding. This is supplementary evidence only; the load-bearing proof is
run #3 above (fixed code, 25/25 under real full-suite contention).

### 5. Baseline full suite (fixed code, no extra stress)
```
npm test
```
Result: **2737/2737 pass**, `duration_ms 136743.48`.

**Tallies summary**:
| Run | Code | Load | Iterations | Pass | Fail |
|---|---|---|---|---|---|
| 1 | fixed | none | 1 | 1 | 0 |
| 2 | fixed | none | 25 | 25 | 0 |
| 3 | fixed | 6× `yes` + concurrent `npm test` | 25 | 25 | 0 |
| 3b | fixed | (the concurrent full suite from run 3) | 1 | 2737/2737 | 0 |
| 4 | pre-fix (stashed) | 8× `yes` | 15 | 15 | 0 (did not reproduce; supplementary only) |
| 5 | fixed | none | 1 (full suite) | 2737/2737 | 0 |

**CI Runnability**: `npm test` runs headlessly with zero human interaction (confirmed above, twice).

### 6. Post-commit gate (clean tree)
Commit: `e3ee371` — `test(e212): E212 T-E212-01 — deflake AC13b's orphaned-child timing race`.
`git status --short` was empty (no untracked files) before this run, satisfying the lane-protocol
§3 requirement that the gating full suite runs post-commit on a clean tree (untracked files are
silently skipped by some checks otherwise).
```
git status --short   # (empty)
npm test
```
Result: **2737/2737 pass**, exit code 0, `duration_ms 135971.44`. This is the gating run.

- **PASS** — see `tw_update_state(status=PASS, ...)` write and `tw_complete_task(T-E212-01)`.
## 2026-09-26T22:41:23.137Z — PASS — by qa-engineer

E212 T-E212-01 PASS. Replaced AC13b's fixed 700ms child busy-wait (test/e177b-test-lock.test.mjs) with a test-controlled release-file handshake: the child polls (Atomics.wait sleep, not a CPU spin) for a release file the test writes only AFTER the reclaim-probe assertion has already returned LOCK_TIMEOUT_EXIT_CODE, so the timing race is eliminated by construction rather than by a bigger fixed window. Added a 15s child safety ceiling and hardened t.after cleanup (release + SIGKILL by pid) so a failed assertion can never leak an orphan process. All AC13b assertions/messages/exit-code expectations unchanged; no other AC, no scripts/test-lock.mjs, no tools/**, no package.json touched. Verified: 25/25 AC13b iterations with no load, 25/25 under 6x `yes` CPU stress plus a concurrent full-suite run (2737/2737), baseline full suite 2737/2737, and the post-commit clean-tree gate 2737/2737 (exit 0) at commit 5e548e7 (fix in e3ee371). Full detail in qa_reports/review_T-E212-01.md.

