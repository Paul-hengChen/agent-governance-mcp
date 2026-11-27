# Review — T-E465-01

covers: T-E465-01, T-E465-02, T-E465-03, T-E465-04, T-E465-05, T-E465-06, T-E465-07

## Round 1 — APPROVED — by code-reviewer

## Summary
- Feature `e465-launcher-wave-done` (ticket E465, S1–S7), base `b90c7e9f`, commits c1542670 (cut), ffcc10be (cut amendment), 45ba4e0c (qa tests), be06e542 (build).
- Adds the `waveDoneAt` config key (`merged` default / `pr-open`) with a separate resolver, a `pr-open` dependency rule that checks the depended-on lane's branch or recorded tip against the start ref, a `--wake-weekly` option, a close-only `--close-finished` option, the `docs/config.md` section and the new usage text.
- Diff stays inside the ticket's allowed paths plus the lane's own `specs/`, `.current/e465/` and `qa_reports/`. `docs/lane-protocol.md` and every forbidden test file are untouched. The `docs/tickets/E465.md` change is limited to the seven `Verification:` lines, as the integrator accepted.
- Full suite 5008/5011 pass, 0 fail, 3 skipped. All 16 expected-red manifest entries are now green. Negative controls fail the matching tests.
- Verdict: APPROVED.

## AC Completeness
AC (S1) — implemented — tools/config.ts:481-486 (loadConfig surfaces only usable values, no default), tools/config.ts:545-549 (resolveWaveDoneAt), tools/lane-launch.ts:603-604 (wavedone.invalid once per run on stderr)
AC (S2) — implemented — tools/lane-launch.ts:344-362 (dependencyMet pr-open branch / recorded-tip ancestry, dep.not-merged / dep.no-tip), tools/lane-launch.ts:483-487 (tip recorded at the dependency check)
AC (S3) — implemented — the same ancestry check on the recorded tip (tools/lane-launch.ts:358); the existing "already recorded is never restarted" rule is unchanged
AC (S4) — implemented — tools/lane-launch.ts:350-355: merged / knowledge-local paths give the same results as before; unedited `test/e443b-*` stay green
AC (S5) — implemented — tools/lane-launch.ts:461-467 (wake pass also wakes paused-weekly under `--wake-weekly`)
AC (S6) — implemented — tools/lane-launch.ts:558-568 (close pass: finished, not already closed, no `stopped — …` ticket or worktree gone; `/exit` through sendText; `windowClosed: true`), tools/lane-launch.ts:572-575 (close-only run, exit 0, no wake/start/poll)
AC (S7) — implemented — docs/config.md:262-288 (section verbatim after the `---` ending laneLaunchLimit, own closing `---`), tools/lane-launch.ts:799 (usage.line), scripts/lane-launch.mjs:5-6 (script.header)

## Correctness
Tests (step 4 / 4a):
- Every scenario has at least one test on the public interface (`runLaneLaunchCli`, `runLaneLaunch` via the harness, `loadConfig` / `resolveWaveDoneAt` from `dist/`). Assertions are exact (Copy strings verbatim, window writes deepEqual, launch-state fields, featureStart calls, poll-sleep count).
- All seven `Verification: test …` titles in `docs/tickets/E465.md` match a test of that exact title in the named file, and each test checks its scenario.
- Spec-mandated extra cases are present: S6 worktree-gone, S6 close-only run, and both options given together.
- Negative controls, run on a copy outside the worktree: forcing `prOpen = false` in `dist/tools/lane-launch.js` turns all 4 S2 tests and the S3 test red while S4 stays green. Dropping the `windowClosed` guard turns the S6 "never sent /exit again" tests red.
- Coverage: no line-coverage tooling is configured in this repo, so it was not measured.

Implementation:
- No required findings.
- optional — tools/lane-launch.ts:564: a failed `/exit` send is swallowed (`catch { return; }`), so the lane gets no record and no `close.done` line, and nothing is printed. The spec does not cover this case. Retrying on the next run is a safe default. A window that no longer exists (closed by hand) will be retried silently on every close run; a stderr line would help the operator.
- optional — tools/lane-launch.ts:804-808: a repeated option (`--close-finished --close-finished`) is a usage error (exit 2). The spec does not cover this. It is consistent with the "each at most as given" interface in `qa_reports/tests_e465-launcher-wave-done.md` and with keeping argv parsing strict. Accepted.
- optional — tools/lane-launch.ts:434: the tip is recorded only on the transition to `finished` and at dependency checks. If `agc feature finish --shipped` deletes the branch before any launcher run observes it, there is no tip and dependents wait with `dep.no-tip`. The spec covers this case (docs/config.md "A lane the launcher never saw"), and it fails safe.

## Quality
- Naming follows the module (`OUT.*` copy builders, `EXIT_LINE` next to `WAKE_LINE`, `isStopped` extracted from `ticketsSettled` and shared with `anyTicketStopped`). No dead code. `dist/` is rebuilt; `npm run build` leaves no diff.
- Comment check (5d): `agc check — comments` warns about the three test-file header blocks (10–13 lines). Kept: they carry the WHY for each scenario group and follow the `test/e443b-*` header convention. It also warns that `tools/config.ts` is high-ratio (40.3%). Kept: the file already exceeded the limit at base, and the diff adds 7 short WHAT/WHY lines, consistent with the neighbouring `laneLaunchLimit` field comment.

## Architecture
- No architecture spec (no architect hop, per cut). The default lives in a separate resolver, so `loadConfig` still returns `{}` with no file (`test/config-cache.test.mjs` is green and unedited). There is no config `schema_version` bump. Launch state stays version 1, and `isRecord` accepts records without `tip` / `windowClosed`. `startRefFor` and the current-wave rule are unchanged. There are no server, gate or error-code changes.

## Security
- No new trust boundary. The config value is printed through `JSON.stringify` (a newline or quote in the value cannot forge a second stderr line, as the S1 test confirms). Git calls use argv arrays (`rev-parse --verify --quiet refs/heads/<branch>^{commit}`), not a shell. `/exit` is a fixed constant sent only to a window id from the launcher's own launch state. No secrets. The sr report says `npm audit` shows no HIGH/CRITICAL; this was not re-run in this round.

## Performance
- One extra `git rev-parse` per dependency check and per finish transition. The close pass reads ticket files once per finished lane. No loops over hot paths and no regression against base.

## Verdict
APPROVED — every scenario S1–S7 is implemented and pinned by exact, negative-controlled tests, the full suite is green, and the scope constraints from the manifest's Probe table hold. Same-model note: sr-engineer, qa-engineer and code-reviewer all ran on the opus tier (per the pins), so some blind spots may be shared.
