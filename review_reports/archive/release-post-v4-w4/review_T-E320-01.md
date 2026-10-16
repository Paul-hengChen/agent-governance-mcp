# Review — T-E320-01

Round 1 — APPROVED — by code-reviewer (opus)

## Summary
- Commit c6aaf61 changes one file, `scripts/verify-release.mjs` (+66/-11). `--ci-check --sha <v>` now resolves `<v>` to a full commit with `git rev-parse --verify --quiet <v>^{commit}`. It then queries runs with `gh run list --commit <full>`, without the checkout-derived `--branch`. An empty list is polled, and when the budget runs out with no completed run for the sha the result is a FAIL, never the E14 WARN.
- The no-`--sha` path (`--ci-check` on HEAD, and Check 6 of the full release run) is unchanged: `byCommit` defaults to `false`. My shim probe confirmed the `--branch main … conclusion,headSha,url,updatedAt` argv is the same as at base.
- The gh-cannot-answer paths still go through `warn()` under `--sha`: spawn ENOENT, non-zero exit, and unparseable or non-array output. Lenient mode prints the WARN and `--strict` FAILs.
- Inputs read: `git diff 7afa4e3..HEAD`, `specs/e320-ci-check-sha-and-small-fixes.md`, and the manifest e320 row (for ownership). There is no architecture spec.
- Verdict: APPROVED. There are no `required` findings.

## AC Completeness
AC-E320-1 — implemented — scripts/verify-release.mjs:478 (`scope = byCommit ? ["--commit", releaseSha] : ["--branch", ciBranch]`), :469-476 (`deriveCIBranch` skipped under byCommit). Probe: shim argv recorded `run list --commit <40-hex> --workflow CI --status completed --limit 10 --json conclusion,headSha,headBranch,url,updatedAt`, with no `--branch`.
AC-E320-2 — implemented — :552-556. Probe, red run on `feat/x`, lenient: exit 1, stderr `FAIL: CI ground-truth — latest completed CI run for <sha12> (branch feat/x) concluded "failure"`, no `CI-CHECK PASSED`.
AC-E320-3 — implemented — :158-160. Probe, green run: exit 0, `CI-CHECK PASSED (<sha12>)`.
AC-E320-4 — implemented — :532-538 (an empty array is polled, not answered at once) and :563-569 (FAIL on budget exhaustion). Probe: `[]` with budget 0 gave exit 1, `FAIL … no completed CI run for <sha12> found on any branch within the 0s poll budget`, no `graceful degradation`, no PASSED. A list holding only other shas also gave exit 1. `[]` followed by success with budget 3s gave exit 0, and the poll line was printed.
AC-E320-5 — implemented — :58-74 (`resolveShaOverride`). Probe: a 7-char prefix resolved to the full sha, the full sha was passed to `--commit`, and the verdict followed the shim. `--sha deadbee` gave exit 1 and stderr naming `--sha "deadbee"`.
AC-E320-6 — implemented — :513-529 untouched apart from the byCommit split. Probe under `--sha`: gh missing in lenient mode printed the WARN and exited 0; gh exit 4 in lenient mode printed the WARN and exited 0; gh exit 4 with `--strict` FAILed with exit 1; non-array output in lenient mode printed the WARN and exited 0.
AC-E320-7 — implemented — :472 / :489 / :539-541 / :570-573. The non-byCommit branches are textually identical to base. The Check 6 call at :599 does not pass `byCommit`. `node --test test/verify-release.test.mjs` (with the other three lane test files) passes 127/127 with the test files unmodified.
AC-E320-8 — implemented (by non-touch) — the diff edits no test file. QA owns the quoted pass lines.
AC-E320-9 — implemented — :469-475. Probe with a detached HEAD and `--sha <S>` plus a success shim: exit 0 and no "detached HEAD" WARN. With a detached HEAD and no `--sha`, the base WARN still appears.
Ticket (c) — implemented (by non-touch) — no `content/**` file is in the diff.
AC-LANE-2 — on track — `git diff 7afa4e3..HEAD --name-only` lists 9 files: `scripts/verify-release.mjs`, `gates/visual.ts`, `dist/gates/visual.{js,js.map,d.ts.map}`, `tools/registry.ts`, `dist/tools/registry.{js,js.map,d.ts.map}`. All of them are in the e320 owned column.
AC-LANE-1 / AC-LANE-3 / AC-E321-* — out of this task's scope (T-E320-02 / T-E321-01, qa).

## Correctness
No required findings.
- **sr flag (1), ruling: accepting ref names in `--sha` (for example `HEAD`, `main`) is acceptable. No hex restriction is required.** AC-E320-5 requires that an abbreviated sha resolves and that an unresolvable value FAILs loudly. Both hold, and the spec does not forbid ref names. Ref names are safe here for three reasons. git rejects anything that does not peel to a commit (`^{commit}`). The value that is queried, matched and printed is always the canonical 40-hex output. The `CI-only check … for <sha12>` stdout line shows which commit was judged. At base, `--sha HEAD` could never match `headSha` and silently WARN-PASSED, so the change is strictly safer. (optional) Ref resolution is local: a stale local `main` resolves to the local tip, not the remote one. The `--sha` usage comment could say "commit-ish" so this is documented.
- **sr flag (2), confirmed:** `sleepMs = Math.min(POLL_INTERVAL_SECONDS * 1000, remainingMs)` (:577) is base code that this diff did not touch. A 2–5 s `AGC_VERIFY_CI_WAIT_SECONDS` exercises poll-then-success; my probe did this with 3 s.
- (recommended, behaviour note) `--sha ""` now FAILs ("not a commit id"). At base it silently fell back to HEAD through `shaOverride ||`. This is a deliberate tightening in line with the F2/E163 "never silently answer about a different sha" rule. QA should pin it.
- (optional) The comment at :543-546 ("A run for an earlier commit … degrades like any other cannot-obtain-ground-truth path") and the section header at :375-379 ("any inability … WARNs, and only a non-success conclusion … FAILs") are now inaccurate for the byCommit path. The byCommit docblock at :385-389 states the exception, so a reader is not misled overall.
- (optional) Under byCommit the poll-progress line reads `not found among the last 0 completed run(s) yet` when the list is empty. It is accurate but awkward wording. This is cosmetic.
- Multiple runs for one sha: `runs.find` takes gh's first, which is the newest. This matches PM interpretation 3.

## Quality
- Naming and structure follow the surrounding script: `byCommit` mirrors `strict` as an evaluator parameter, and the `resolveShaOverride` error path mirrors the existing `--sha requires a value` exit.
- Comment check (SOP 4b): `agc check` raises two warnings on this file that the diff introduced (base had neither):
  - `scripts/verify-release.mjs:2` long-block 9 lines (limit 7; base was 7). **Kept:** the two added lines are the only usage-level statement of the new `--sha` semantics, and the header is the script's usage doc.
  - `scripts/verify-release.mjs:381` long-block 9 lines. **Kept:** the 5 added lines define the `byCommit` parameter contract, including which paths still WARN, beside the existing `strict` contract. (optional) This could be cut to 2–3 lines with the rest moved to the commit message.
- No dead code. The `ciBranch` / `ciBranchLabel` `let`s stay `undefined` under byCommit and are only read on non-byCommit branches. I checked :478, :489, :539-541, :555 and :570-573.

## Architecture
There is no `specs/e320-ci-check-sha-and-small-fixes-architecture.md` (the spec says no architect is needed). The change stays inside the single shared evaluator (E163), and Check 6 and the no-sha `--ci-check` keep their single code path. The layering is unchanged.

## Security
No findings. Argument injection through `--sha` is closed at four points:
1. `git` and `gh` are spawned through `execFileSync` / `spawnSync` with argv arrays and no shell.
2. A value starting with `--` is rejected at parse time (:44, base). A value starting with a single `-` or an empty value is rejected before git is called (:66). Probe: `--sha -n` gave exit 1 and git was never called.
3. The value reaches git only as `<v>^{commit}` behind `--verify --quiet`, so it is treated as a revision, never as an option. Probe: `--sha 'HEAD --all'` (a single argv element) FAILed as unresolvable.
4. gh only ever receives git's 40-hex output, never the caller's raw string.

`headBranch` from gh JSON is interpolated into a stderr line only. Git ref names cannot contain control characters, so there is no terminal-escape risk.

## Performance
No findings. There is one extra `git rev-parse` per `--sha` invocation. The poll loop, interval and budget are unchanged.

## Verdict
APPROVED. AC-E320-1..9 are met, the no-sha, `--strict` and gh-unavailable paths are unchanged (verified by probe and by the unmodified 127/127 test run), and the `--sha` input boundary is sound.

Note: this review ran on the same model tier (opus) as sr-engineer, so same-model bias is possible. QA's independent tests are the second control.
