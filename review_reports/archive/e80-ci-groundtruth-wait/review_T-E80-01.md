# Review — T-E80-01

feature: e80-ci-groundtruth-wait
spec: `docs/backlog.md:203` (E80 row) + the cut recorded in handoff `scope_decision_why`
reviewed diff: working tree vs HEAD (`d85cd3f`) — `scripts/verify-release.mjs` (+130/-75), `content/skill-release-engineer.md` (+1/-1)
reviewed by: code-reviewer (opus) — sr-engineer ran fable, so this is a cross-model review; no same-model blind-spot risk.

## Summary
- `scripts/verify-release.mjs` Check 6's **sha-not-found branch only** becomes a bounded poll of `gh run list` (`POLL_INTERVAL_SECONDS = 20`, budget from `AGC_VERIFY_CI_WAIT_SECONDS`, default `600`, `0` = no wait). Every other degraded branch is untouched and still immediate.
- `content/skill-release-engineer.md` step 9a rewritten to say the script waits, reserving WARN-and-continue for poll-expiry or a genuinely degraded environment.
- Scope is proportionate despite the 205-line churn: only ~28 lines are genuinely new code; 52 added lines are the two comment blocks the cut explicitly named, and the rest is re-indentation of the four pre-existing degraded branches into the new `for (;;)`.
- **E78's contract is preserved, not inverted** — verified empirically: no new FAIL mode exists on any path, and budget expiry emits the byte-identical pre-E80 WARN with the check green.
- §2 clean: zero test files touched. Verdict: **APPROVED**.

## Correctness

I did not take the behavioural claims on trust; I drove the real script against a stubbed `gh` binary on `PATH`. Results:

| scenario | budget | `gh` calls | wall-clock in Check 6 | outcome |
|---|---|---|---|---|
| sha not found | `0` | **1** | ~0s | pre-E80 WARN verbatim, `OK: CI ground-truth`, empty stderr |
| sha not found | `5` | 2 | ~5s | one stdout progress line, then the same WARN, green |
| sha found, `success` | 600 | 1 | ~0s | `OK`, no poll |
| sha found, `failure` | 600 | 1 | ~0s | pre-existing FAIL text on stderr, exit 1 |
| `gh` ENOENT | 600 | 0 | ~0s | immediate WARN, green |
| `gh` exit 4 | 600 | 1 | ~0s | immediate WARN, green |
| unparseable JSON | 600 | 1 | ~0s | immediate WARN, green |
| `[]` (zero runs) | 600 | 1 | ~0s | immediate WARN, green |

**1. `Atomics.wait` sleep (`verify-release.mjs:238-242`) — correct and portable.** `Atomics.wait(view, 0, 0, ms)` over a freshly zero-initialised `SharedArrayBuffer` matches the expected value `0`, so it always blocks to timeout and returns `"timed-out"` (measured: 250ms requested → 255ms actual on Node 22 / darwin). Node — unlike browsers — permits main-thread `Atomics.wait`, and `SharedArrayBuffer` is unflagged on every Node ≥ 20 (`package.json` `engines: >=20`) on both darwin and linux. No finding. I also checked the one plausible usability trap: `SIGINT` during the sleep **does** terminate the process (verified by signalling a blocked 10s sleep), so a 10-minute poll stays Ctrl-C-able.

**No off-by-one and no unbounded loop.** The `deadline` is absolute and computed once (`:244`); each iteration either returns or sleeps `Math.min(20000, remainingMs)` (`:290`), so the sleep can never overshoot the deadline, and `remainingMs > 0` guarantees `sleepMs ≥ 1ms` — no busy-spin. Total wall-clock is bounded at `budget + one final gh call`. The one call that lands exactly at the deadline is a deliberate last look, not an extra poll: with `budget=5, interval=20` the observed sequence was `gh @t=0 → sleep 5s → gh @t=5 → expire`. A slow `gh` cannot extend the loop either, because its duration is charged against the same absolute deadline.

**2. `AGC_VERIFY_CI_WAIT_SECONDS` parsing (`:218-222`) — safe across the whole input space.** Exercised: unset→600, `""`→600, `"0"`→0, `"abc"`→600, `"-1"`→600, `"1e999"`/`"Infinity"`→600 (`Number.isFinite` rejects both), `" 0 "`→0, `"30s"`→600. **`0` is provably exactly one `gh` call**: `deadline = Date.now()`, so after the first `spawnSync` returns, `remainingMs = deadline - Date.now() ≤ 0` and the `<= 0` comparison (not `< 0`) catches the zero-elapsed case. Confirmed empirically at 1 call.

**Every other degraded branch is behaviourally unchanged.** I diffed the four early-return branches text-for-text: `res.error` / `res.status !== 0` / `JSON.parse` catch / `!Array.isArray || length === 0` are byte-identical to base apart from indentation, and all four sit *before* the sleep, so each returns on the first iteration regardless of budget — confirmed above at a 600s budget with sub-second elapsed times. The matched-run branch reuses the FAIL string verbatim.

**Expected-red disposition (SOP step 4a):** the diff touches zero test files and no `qa_reports/expected-red_e80-ci-groundtruth-wait.txt` exists. I judged the manifest not required here: the reds are not sr-authored intentional reds but the downstream consequence of a behaviour change whose test update is a separately-filed task, `T-E80-02`, whose acceptance criteria already enumerate the exact pins (`tasks.md:330`). No finding.

## Quality

No blocking findings. Four advisory notes:

- `scripts/verify-release.mjs:221` — a negative budget (`-1`) falls back to the **600s default**, not to `0`. Someone typing `-1` to mean "don't wait" gets a ten-minute wait instead. Safe in every case (the branch is WARN/green either way) and only `0` is a documented opt-out, so this is a nit, not a change request.
- `scripts/verify-release.mjs:239` — `if (ms <= 0) return;` inside `sleepSync` is unreachable: the sole caller already gates on `remainingMs > 0`. Harmless defensive code.
- `scripts/verify-release.mjs:280` — the FAIL string still reads `latest completed CI run on main`, which has been stale wording since E78 made the check sha-matched. Correctly left untouched (it is byte-pinned by VR-11 at `test/verify-release.test.mjs:549`); flagging only so nobody "tidies" it inside this ticket.
- `spawnSync` carries no `timeout`, so a single hung `gh` invocation can still exceed the budget indefinitely. This is pre-existing exposure — the pre-E80 single-call version had exactly the same one — and the poll does not widen it, so it is out of scope for this cut.

Comment quality is good: the removed line `Never a blocking wait/poll for the run to finish` was correctly deleted rather than left to rot, and the E78 sha-matching rationale block moved into the loop verbatim.

## Architecture

No `specs/e80-*.md` exists — expected, this is a mini-chain where the backlog row is the spec. The change respects the file's established shape: `runCheck` callbacks stay independent and non-short-circuiting, `failedChecks` is only grown via `fails`, and the poll introduces no async control flow into what is otherwise a straight-line sequence of `execFileSync`/`spawnSync` calls. The synchronous-sleep choice is the right one for that shape.

**Scope discipline verified mechanically.** All three diff hunks fall inside the two regions the cut named — the file-header Check-6 note (`:8-18`) and the Check-6 block comment plus body (`:181-`). Checks 1-5 are untouched. Breaking down the 205 lines: 52 added comment lines, 73 added code lines, of which only ~28 are new statements (the env parse, `deadline`, `for (;;)`, `listCompletedRuns`, `sleepSync`, the `if (matched)` restructure, the expiry check, the progress `console.log`); the remaining ~45 are the pre-existing branches re-indented one level. The one comment amendment outside the two named blocks — the `warn` helper's stdout note at `:203-205`, extended to cover poll-progress lines — is a direct consequence of the new stdout writes and is in scope.

`content/skill-release-engineer.md:209` matches the cut: sha-pending is now "the script itself bounded-polls … just let this step run to completion, do not treat a poll-in-progress as a WARN to manually re-run around", with WARN-and-continue explicitly scoped to the two cases (poll-budget expiry, degraded environment). Step numbering, the `9a. **Release self-check**` anchor, and the Escalation Routes rows at `:152-157` are untouched, so the structural VR-9 assertions (`test/verify-release.test.mjs:809-822`) and the byte pins in `test/release-staging.test.mjs:757` still hold.

## Security

No findings. The single new external input is `AGC_VERIFY_CI_WAIT_SECONDS`, which is `Number`-parsed and used only as an arithmetic operand — never interpolated into a command line or a path. The `gh` argv is unchanged and remains a fixed literal array passed to `spawnSync` without a shell. `gh`-supplied JSON is still only `===`-compared (`r.headSha`) and `String()`-interpolated into console output. The new progress line interpolates only a git-derived hex sha and integers. No secrets, no new trust boundary.

## Performance

No regression. On the `wait=0` and on every degraded path the subprocess count is **identical to base** (verified: 1 call, or 0 for ENOENT). On the sha-pending path the script spends up to the configured budget and issues at most `ceil(budget / 20s) + 1` `gh` calls (≤ 31 at the 600s default) — the intended cost of the feature, incurred only on a path that previously gave a wrong-but-fast answer. `sleepSync` allocates a 4-byte `SharedArrayBuffer` per call (≤ 30 allocations); immaterial. No hot-path or complexity-class change.

**One operational heads-up for qa (T-E80-02, not a finding against this diff):** `test/verify-release.test.mjs` VR-17 (`:623`) and VR-18 (`:657`) both drive the sha-not-found branch, and `runVerify` (`:204`) passes no `env`, so the child inherits `process.env`. With `AGC_VERIFY_CI_WAIT_SECONDS` unset, each of those two tests will now **block for the full 600s** rather than fail an assertion — a ~20-minute suite slowdown, not a red. T-E80-02(c) already scopes the fix; the pin should set the variable explicitly per-run rather than rely on shell inheritance, so a developer's exported value cannot silently change test behaviour. No pin is made unfixable by this diff.

## Verdict

**APPROVED** — the poll is confined to the sha-not-found branch exactly as the cut licensed, `0` is provably a single `gh` call, wall-clock is genuinely bounded, all four other degraded branches and the matched-run FAIL are behaviourally identical to base, no new FAIL mode exists on any path, VR-8's stderr contract holds, and no test file was touched; the four notes above are nits, none blocking.
