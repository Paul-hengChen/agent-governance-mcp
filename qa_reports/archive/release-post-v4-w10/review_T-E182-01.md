# QA review — T-E182-01

## Choice (AC-E182-1)

Both options: default raised to 20000 ms (the ceiling `test/teamwork-lite.test.mjs`'s `spawnAndAwait` uses) and `AGC_USAGE_HOOK_TEST_TIMEOUT_MS` as an override; a non-numeric or non-positive value falls back to 20000. Always finite, so a genuinely hung hook still fails. Reason: the raise fixes the observed flake with no setup; the env knob lets a heavier host or CI raise it again without a code change. Documented in the header comment of `test/usage-accounting.test.mjs`.

Proof: `grep -n "timeoutMs" test/usage-accounting.test.mjs` shows `timeoutMs = HOOK_TIMEOUT_MS` and no 5000 default (the remaining `5000`-containing hits are `tokenBudgetPerFeature: 500000` literals). `node --test test/usage-accounting.test.mjs` alone: 35/35.

## Load evidence (AC-E182-2)

Host: 8 cores (`sysctl -n hw.ncpu` = 8), macOS, Node 22. Load = 8 concurrent copies of `node --test test/usage-accounting.test.mjs`, 3 rounds each, run in this lane's worktree.

Pre-fix baseline (fixed 5000 ms), same load, pass/total per copy:

| round | copies (pass/35) |
|---|---|
| 1 | 35, 34, 35, 35, 34, 35, 35, 34 (3 copies red) |
| 2 | 35, 34, 34, 34, 35, 35, 35, 35 (3 copies red) |
| 3 | 32, 35, 35, 35, 35, 34, 35, 33 (3 copies red; 6 failing tests) |

9 of 24 copies red. The failures I opened were hook tests with `duration_ms` about 5003-5004 (the `spawnSync` kill at the 5000 ms ceiling), the E182 signature.

After the fix (default 20000), same load:

| round | copies (pass/35) |
|---|---|
| 1 | 35 x 8 |
| 2 | 35 x 8 |
| 3 | 35 x 8 |

24 of 24 copies green. Headroom note: the slowest single test duration seen in those rounds was 11.5 s (10.3 s second), so the 20 s ceiling is about 1.7x above the worst observed; filed as pending ticket (P3) in `.current/e209/pending-tickets.md`.

## E156 cause judgment

Verdict: `unrelated` (as a cause). E182 is not a direct cause of E156; a shared-load link is possible but unproven.

Facts:
1. E156's failing test is `AC3b: GetPromptRequestSchema dispatches 'teamwork-lite' correctly` (`test/teamwork-lite.test.mjs:129`). It spawns `dist/index.js` through its own `spawnAndAwait` (`test/teamwork-lite.test.mjs:26`), response-driven with a 20000 ms ceiling (`waitMs = 20000`), resolving `null` on the ceiling. It never calls `runHook` and never touches the usage hook.
2. The E156 run had exactly one failure (2233/2234, `docs/backlog.md` E156 row), so `test/usage-accounting.test.mjs` was green in that run. E182's failure is a different test each time at about 5003 ms; E156 is one fixed test.
3. `node --test` runs each file in its own process; a `spawnSync` child killed in one file cannot change another file's result. The only possible link is machine saturation common to both.
4. Probe run in this session: `test/teamwork-lite.test.mjs` as 8 concurrent copies, 2 rounds: 16/16 copies 6/6 green (the same load that turned 9 of 24 usage-accounting copies red on the old ceiling). AC3b did not flake under that load, which weakens the saturation story for AC3b with a 20 s ceiling.
5. Caveat: the repository history was reset at v4.0.0 (2026-09-28), after E156 (2026-09-22), so AC3b's ceiling at the time of E156 cannot be read from git; the 20000 ms above is today's value.
6. This lane does not fix, close or edit E156 or `docs/backlog.md`.

PM's preliminary reading (AC-E182-3 points 1-3) is confirmed from the repo.

## AC-LANE results

The full-suite run must happen after the final commit on a clean tree, so its pass/total cannot live in a committed file; it is recorded in the PASS `qa_review` write and in the final report.
## 2026-10-20T12:11:49.720Z — PASS — by qa-engineer

QA round 1 PASS. Evidence: qa_reports/review_T-E209-02.md (covers batch, Expected-Red Diff, AC Execution Log), review_T-E183-02.md, review_T-E182-01.md (incl. ## E156 cause judgment: unrelated). AC-E209-1 red on base copy (lock lost), green on HEAD; AC-E183-4/5 red on base, green on HEAD; E8-S4 re-pinned; runHook timeout 20000 ms + env override, 8-copy x3 rounds 24/24 green (baseline 9/24 red). AC-LANE-1: node scripts/test-lock.mjs -- npm test on clean tree at d909908: 3590 pass / 3592 total (2 skipped, 0 fail). AC-LANE-2: diff within owned set. Pending tickets: E209-NEW-1 (reviewer), hook-spawn headroom (qa, P3).

