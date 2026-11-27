# e463-release-gh-checks

Ticket: E463 (`docs/backlog.md` row E463; no ticket file)
Ticket: E464 (`docs/backlog.md` row E464; no ticket file)

One feature, one cut, one review (human ruling 2026-11-27, BATCHED notes on both
backlog rows). Fan-out lane `e463`, manifest `specs/fanout-post-v5-e463.md`.
Exit-class ruling: human Q1 (a) — both tickets stop under the existing exit 14
`GH_UNAVAILABLE`; no new class. No architect hop (one script, one new pure
helper, one doc section). Dispatch mode: `feature` (E464 adds behaviour and a
doc section; this is not a repro-only bug fix). qa-engineer still writes
`qa_reports/expected-red_e463-release-gh-checks.txt` for every test it leaves red.

## Problem Statement

Two defects in the release scripts' use of `gh`. **E463**: in
`scripts/release.mjs`, `viewPr()` returns `null` whenever `gh pr view` exits
non-zero, so a transient GitHub API failure reads exactly like "no pull request
for this branch". In the v5.0.0 release (workflow run 45636429488 of this
repository) the `publish` pre-check's lookup failed with
`GraphQL: Something went wrong while executing your query on …`, and the script
stopped with `PR_CANNOT_MERGE: no open or merged pull request for release/v5.0.0`
while pull request #189 was open and green; the release had to be resumed by
hand (issue #190 of this repository). `gh` reports a missing pull request with
its own message (`no pull requests found for branch "<branch>"`, stderr, exit 1;
observed with the installed `gh` 2.92.0 and present in the `gh` source from
2.40.0 through 2.106.0), so the two cases can be told apart. **E464**: the
strict pre-tag CI gate runs `gh run list --commit <sha>`; `gh` 2.29.0 has no
`--commit` flag, so the hand-resumed v5.0.0 `publish` stopped with
`CI_GATE_FAILED` ("gh run list failed: unknown flag: --commit") while CI was
green. Nothing states which `gh` version the release scripts need, and nothing
checks it before a phase starts work.

## User Stories

- As a release operator, I want a failed pull-request lookup retried a few times
  and then reported as a `gh` failure carrying `gh`'s own error, so that a
  transient GitHub error is never read as "there is no pull request".
- As a release operator, I want a genuinely missing pull request to keep its
  current meaning and stop, so that the fix does not hide a real problem.
- As a release operator, I want each phase to check the `gh` version before it
  does anything, and to stop naming the installed and the required version, so
  that an old `gh` fails at once with the cause instead of deep inside a later step.
- As someone resuming a release by hand, I want `docs/release-cd.md` to state the
  minimum `gh` version and why, so that I can check my machine before I start.

## Acceptance Criteria

Every AC's test lives in a new `test/e463-*.test.mjs` file (qa-engineer names it);
each test title starts with the AC id (for example `E463-AC2 …`), so
`node --test --test-name-pattern "<AC id>" test/e463-*.test.mjs` runs exactly that
AC. Harness: the existing in-process `main(argv, deps)` seam with an injected
`spawn` and `sleep` (as `test/e405-release-runner.test.mjs` does) — no real `gh`,
no network. "The failing stderr" below is
`GraphQL: Something went wrong while executing your query on 2026-11-25T14:44:24Z. Please include \`X\` when reporting this issue.`
(the v5.0.0 run's line, abridged), exit 1.

### E463 — a failed pull-request lookup is not a missing pull request

- **E463-AC1** — Given `gh pr view <branch> --json …` exits non-zero and the first
  non-empty line of its stderr starts with `no pull requests found`, when any
  `viewPr()` caller runs, then the lookup is one call, with no retry and no
  sleep, and it reads as "no pull request": `publish` stops exit 42
  `PR_CANNOT_MERGE` with the detail `no open or merged pull request for release/vX.Y.Z`
  (unchanged), and `close-out` goes on to open the bookkeeping pull request (unchanged).
  proof: `node --test --test-name-pattern "E463-AC1" test/e463-*.test.mjs`
- **E463-AC2** — Given every `gh pr view release/vX.Y.Z …` call exits 1 with the
  failing stderr, when `publish --version X.Y.Z` runs (with and without `--dry-run`),
  then exactly 3 `gh pr view` calls are made, the injected `sleep` is called
  exactly twice (between attempts), the exit code is 14, the last stderr line is
  string `stop.lookup_failed` with branch `release/vX.Y.Z`, attempts `3`, exit `1`,
  gh's last stderr line and phase `publish`, no `PR_CANNOT_MERGE` line is printed,
  and no call after the pre-check is made (no `git rev-parse` of the branch check,
  no merge, tag or release call).
  proof: `node --test --test-name-pattern "E463-AC2" test/e463-*.test.mjs`
- **E463-AC3** — Given the first 1 (and, in a second case, 2) `gh pr view` calls
  fail with the failing stderr and the next one returns the open pull request,
  when `publish` runs, then the phase proceeds exactly as if the first lookup had
  succeeded (one `log.lookup_retry` line per failed attempt, `publish OK`).
  proof: `node --test --test-name-pattern "E463-AC3" test/e463-*.test.mjs`
- **E463-AC4** — Given the failing stderr on every lookup, the same retry-then-stop
  as E463-AC2 (3 attempts, exit 14, `stop.lookup_failed` naming that branch and
  phase, never reported as a missing pull request) holds at every other `viewPr()`
  call site: the `close-out` pre-check (`release/vX.Y.Z-bookkeeping`), the
  `prepare` step 8a-6 lookup before `gh pr create` and the one after it, the
  `close-out` step 13a-5 lookup after `gh pr create`, and the merge wait of
  `publish` (8c-2) and `close-out` (13a-6). A deferred lookup under `--dry-run`
  is still not run and still returns "not observed" (unchanged). One test per
  call site, titles `E463-AC4 <site> …`.
  proof: `node --test --test-name-pattern "E463-AC4" test/e463-*.test.mjs`
- **E463-AC5** — Retry parameters are fixed: 3 attempts in all (the first plus 2
  retries), 10 seconds between attempts. The wait is
  `AGC_RELEASE_GH_RETRY_SECONDS` when that env value is a number ≥ 0, else 10
  (the existing `envSeconds` rule: unset, empty or not a number ≥ 0 falls back);
  `0` means no wait. The wait goes through `deps.sleep` when one is injected, as
  a millisecond count. With the env unset the two sleeps are `[10000, 10000]` ms,
  with `AGC_RELEASE_GH_RETRY_SECONDS=0` they are `[0, 0]`, with `=abc` they are
  `[10000, 10000]`. The attempt count is not configurable. The two constants are
  exported from the helper as `GH_LOOKUP_ATTEMPTS` (3) and
  `GH_LOOKUP_RETRY_SECONDS` (10).
  proof: `node --test --test-name-pattern "E463-AC5" test/e463-*.test.mjs`
- **E463-AC6** — Given `docs/release-cd.md`, when its `## Manual fallback` section
  is read, then it contains string `doc.lookup_retry` verbatim.
  proof: `node --test --test-name-pattern "E463-AC6" test/e463-*.test.mjs`

### E464 — minimum `gh` version, stated and checked at each phase start

- **E464-AC1** — Given `docs/release-cd.md`, when its `## Manual fallback` section
  is read, then it contains string `doc.gh_min` verbatim, and the version it names
  (`2.40.0`) equals the helper's exported `MIN_GH_VERSION`.
  proof: `node --test --test-name-pattern "E464-AC1" test/e463-*.test.mjs`
- **E464-AC2** — Given a `gh` that prints `gh version 2.40.0 (2023-12-07)`, when
  each of `start`, `prepare`, `publish` and `close-out` runs (with and without
  `--dry-run`), then the phase's first `gh` call is `gh --version` (argv exactly
  `["--version"]`), it is made exactly once per phase run, it comes before
  `gh auth status`, and the phase otherwise behaves as today. `record` makes no
  `gh` call (unchanged). The check lives in the existing `preGh` step, so the
  `PHASES` literal is unchanged.
  proof: `node --test --test-name-pattern "E464-AC2" test/e463-*.test.mjs`
- **E464-AC3** — Given a `gh` that prints `gh version 2.39.2 (2023-11-15)`, when
  each of the four phases runs, then it exits 14 with the last stderr line
  string `stop.gh_too_old` with installed `2.39.2`, and no child call follows
  `gh --version` (no `gh auth status`, no git call, no state call).
  proof: `node --test --test-name-pattern "E464-AC3" test/e463-*.test.mjs`
- **E464-AC4** — Given `gh --version` exits non-zero (and, in a second case, the
  spawn fails, as when `gh` is not installed: status -1 with the spawn error
  text), when a phase runs, then it exits 14 with string `stop.gh_version_failed`;
  given it exits 0 but prints no `gh version X.Y.Z` line (for example `gh version DEV`),
  then it exits 14 with string `stop.gh_version_unparsed`.
  proof: `node --test --test-name-pattern "E464-AC4" test/e463-*.test.mjs`
- **E464-AC5** — The helper compares versions numerically per component:
  `2.40.0`, `2.40.1`, `2.92.0`, `2.100.0` and `3.0.0` pass; `2.39.2`, `2.4.10`
  and `1.99.99` fail; the parse takes the first `gh version <X>.<Y>.<Z>` on the
  output (a pre-release suffix after `<Z>` is ignored).
  proof: `node --test --test-name-pattern "E464-AC5" test/e463-*.test.mjs`
- **E464-AC6** — `scripts/gh-compat.mjs` exists, exports `MIN_GH_VERSION`
  (`"2.40.0"`), `GH_LOOKUP_ATTEMPTS`, `GH_LOOKUP_RETRY_SECONDS` and pure functions
  for the version check and the not-found test, and imports nothing from
  `node:child_process` (every child call stays in `release.mjs`'s runner).
  `isAllowed("gh", ["--version"])` is true and the rule is a read;
  `isAllowed("gh", ["--version", "x"])` and `isAllowed("gh", ["version"])` are false.
  `scripts/verify-release.mjs` is byte-identical to the base.
  proof: `node --test --test-name-pattern "E464-AC6" test/e463-*.test.mjs`

### Both tickets

- **X-AC1** — No exit class is added or changed (`EXIT_CLASSES` equals the base's,
  `GH_UNAVAILABLE` stays code 14 in `start`, `prepare`, `publish`, `close-out`),
  and none of the files the lane may not touch changed. The viewPr argv literal
  `"--json", "number,state,mergeable,mergeStateStatus,statusCheckRollup,mergeCommit,headRefOid"`,
  the `PHASES` literal, `pullMain` and `STAGE_PATHS` are byte-identical.
  proof: `git diff --name-only e3a3db6...HEAD -- CLAUDE.md content test/release-staging.test.mjs test/e433-test-first-rules.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs test/e130-lane-default.test.mjs test/feature-lease.test.mjs scripts/verify-release.mjs .github package.json package-lock.json CHANGELOG.md dist` prints nothing, and `node --test test/release-staging.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs` passes. (After a mid-wave base merge, diff against `origin/integ/post-v5-e463` per lane protocol §7.)
- **X-AC2** — The full suite passes on the committed HEAD with a clean worktree.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0, and `git status --porcelain` prints nothing before and after.

## Copy / Strings

`<…>` marks a value filled at run time; everything else is literal. Stop details
follow `RELEASE_STOP GH_UNAVAILABLE: ` on the last stderr line (`ReleaseStop`
folds newlines into spaces).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| stop.lookup_failed | `gh pr view <branch> failed <attempts> times (last: exit <status> — <last stderr line of the last attempt, or "no output">) — a failed lookup, not a missing pull request; re-run <phase> once gh answers` | authored-here — names gh's error (backlog E463 "a class that names the gh error") and says it is not the missing-PR case |
| log.lookup_retry | `release: [<step>] gh pr view <branch> failed (exit <status>); attempt <n> of <attempts>, retrying in <seconds>s` | authored-here — one stdout line per failed attempt that will be retried, in the runner's existing `release: [<step>]` log shape |
| stop.gh_too_old | `gh <installed> is older than <required>, the minimum the release scripts need (gh run list --commit) — upgrade gh; see docs/release-cd.md, Manual fallback` | authored-here — backlog E464 "names the installed and required versions" |
| stop.gh_version_failed | `gh --version exited <status> — <last stderr line, or "gh unavailable">` | authored-here — same shape as the existing `gh auth status exited <n> — …` stop in `preGh` |
| stop.gh_version_unparsed | `gh --version printed no version (first line: <first stdout line, JSON-quoted>) — need gh <required> or newer` | authored-here — the unverifiable case stops rather than proceeds (decided below) |
| stop.merge_wait_not_found | `#<n> not merged within <budget>s (AGC_RELEASE_MERGE_WAIT_SECONDS); the last gh pr view found no pull request — re-run <phase> to keep waiting` | authored-here — replaces `; the last gh pr view failed` in the existing `MERGE_WAIT_TIMEOUT` detail: after E463 a failed lookup stops `GH_UNAVAILABLE`, so a `null` here can only mean "not found" (no test pins the old text) |
| doc.gh_min | the fenced block `doc.gh_min` below, verbatim | authored-here — basis verified 2026-11-27 against the `gh` release notes (cli/cli releases v0.4.0..v2.106.0), cli/cli PR #8350, and the `gh` source at tags v2.39.2 / v2.40.0 (see Gate Summary) |
| doc.lookup_retry | the fenced block `doc.lookup_retry` below, verbatim | authored-here — operator-facing statement of E463 |

Each `doc.*` block is one paragraph (the fence is not part of the text), appended
in this order at the end of `## Manual fallback`, after the existing "The two paths
share one rule set …" paragraph, each preceded by one blank line.

`doc.gh_min`:

```text
**`gh` version.** The release scripts need `gh` 2.40.0 or newer. `gh run list --commit`, which the strict CI gate (`verify-release.mjs --ci-check --sha`) runs, first shipped in `gh` 2.40.0 (its release notes: "Filtering `run list` results by commit sha", cli/cli#8350); `gh` 2.39.2 has no such flag. Every other `gh` flag and JSON field the scripts use is present in the `gh` 2.40.0 source: `run list` with `--branch`, `--workflow`, `--status`, `--limit` and the fields `conclusion`, `headSha`, `headBranch`, `url`, `updatedAt`; `pr view` with the fields `number`, `state`, `mergeable`, `mergeStateStatus`, `statusCheckRollup`, `mergeCommit`, `headRefOid`; `pr create`; `pr merge --auto --merge`; `release create --verify-tag`; `release view --json tagName`; `auth status`. Each phase that calls `gh` (`start`, `prepare`, `publish`, `close-out`; `record` calls none) runs `gh --version` before any other `gh` call and stops with exit 14 `GH_UNAVAILABLE`, naming the installed and the required version, when `gh` is older or prints no version.
```

`doc.lookup_retry`:

```text
**A failed pull-request lookup.** `gh pr view` reports a missing pull request with its own message (`no pull requests found …`); any other failure is a failed lookup. The scripts try a failed lookup 3 times, 10 seconds apart (`AGC_RELEASE_GH_RETRY_SECONDS` sets the wait), then stop with exit 14 `GH_UNAVAILABLE` and `gh`'s error, never with `PR_CANNOT_MERGE`. Re-run the phase once `gh` answers.
```

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- A new exit class, any change to `EXIT_CLASSES`, and the SOP's *Escalation Routes*
  (`content/skill-release-engineer.md`, forbidden; human Q1 (a)). The SOP row for
  exit 14 reads "authenticate, never work around"; the new causes are explained by
  the stop detail and `docs/release-cd.md`. Any SOP wording follow-up waits for
  E443b to land and is not filed by this lane.
- `scripts/verify-release.mjs` (decided below: unchanged, so it needs no helper
  import and the single-file fixtures in `test/e158-range-subject.test.mjs`,
  `test/e320-ci-check-sha.test.mjs` and `test/e326-empty-branch-run-poll.test.mjs`
  need no re-pin). Run standalone with an old `gh`, its strict mode still FAILs
  naming `unknown flag: --commit`; inside a release, the phase-start check stops first.
- A version check in `record` (it calls no `gh`; `GH_UNAVAILABLE` has no `record`
  phase, and adding one would change `EXIT_CLASSES`).
- Retrying any `gh` call other than `gh pr view` (`gh release view`, the mutations).
- `.github/**`, `CHANGELOG.md`, `package.json`, the version, `CLAUDE.md`, `content/**`,
  every other forbidden path in the manifest's Lanes row; release bookkeeping
  (done-marks for E463 / E464 belong to the integrator, 5c).

## Dependencies / Prerequisites

- Base `e3a3db6` (contains PR #208 BATCHED notes and PR #209 manifest).
- **Minimum `gh` version: 2.40.0 — verified.** `gh run list --commit` is the binding
  feature: the 2.40.0 release notes list "Filtering `run list` results by commit
  sha" (cli/cli PR #8350, merged 2023-11-29, whose description adds `--commit/-c`
  to `gh run list`); `pkg/cmd/run/list/list.go` has the `commit` flag at tag
  v2.40.0 and lacks it at v2.39.2. Every other flag and field the two scripts use
  is present at tag v2.40.0 (checked in `pkg/cmd/run/list/list.go`,
  `pkg/cmd/run/shared/shared.go` `RunFields`, `api/query_builder.go`,
  `pkg/cmd/release/create/create.go`, `pkg/cmd/pr/merge/merge.go`,
  `pkg/cmd/release/shared/fetch.go`); the oldest of them by release note is
  `--verify-tag` (2.21.0), then `headRefOid` (2.18.0). `gh --version` prints
  `gh version <X.Y.Z> (<date>)` at v2.40.0 (`pkg/cmd/version/version.go`) and on the
  installed 2.92.0.
- **Not-found message — verified.** `no pull requests found for branch %q` and
  `no pull requests found` (`pkg/cmd/pr/shared/finder.go`, `NotFoundError`) at
  v2.40.0, v2.106.0 and trunk; observed locally with 2.92.0 on stderr, exit 1.
- **CI runner `gh` version: unknown.** The release job runs on the GitHub-hosted
  Ubuntu image (image version 20261116 in the v5.0.0 run); its `gh` version is not
  in that log. After this change the runner echoes `gh --version`'s output in the
  run log at every phase start, so the next run records it; an image older than
  2.40.0 would stop at once with `stop.gh_too_old`.
- Installed locally: `gh` 2.92.0 (passes).

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count / Geometric-Density Split | not applicable — no design file, no visual surface |
| Parallel-Lane Cut | serial — shared layer: E463 and E464 both edit `scripts/release.mjs` and `docs/release-cd.md` (human ruling: one lane) |
| Scope Decision | `single-feature` — two backlog rows batched by human ruling into one feature, one cut, one review |
| Resource Audit (§7) | 6 external references, all fetched (none unresolved): `gh` release notes (cli/cli releases, all 213 notes v0.4.0..v2.106.0); cli/cli PR #8350; `gh` source at tags v2.39.2, v2.40.0, v2.106.0 and trunk (files listed in Dependencies); `gh` source at v2.4.0 / v1.9.0 (field history, informational); issue #190 of this repository (stop line confirmed); workflow run 45636429488 of this repository (failed `publish` log: the GraphQL line, then the `PR_CANNOT_MERGE` stop) |
| Question Batch | no-op — every scope question was answered by the manifest, human Q1 (a) / Q2 and the brief; the remaining choices are interface details decided here (see Decisions) |
| Ambiguity | none blocking |
| Design | none (`design: none`) |
| Schema change | none (no handoff / tasks / SQLite / config schema change; no `.ts` change, so no `dist/` diff) |
| Bugfix mode | no — `dispatch_mode` stays `feature` |
| Architect | not routed — one script, one pure helper, one doc section; below the ≥ 3 modules / new data model / cross-cutting API threshold |

### Decisions (PM, interface level)

1. The version check runs inside the existing `preGh` step, `gh --version` first,
   then the existing `gh auth status`. `preGh` is already the first `gh` step of
   `start` (after the `--work-dir` check), `prepare` (after the input checks),
   `publish` and `close-out`, so no `PHASES` entry is added (the `PHASES` literal
   is read by forbidden `test/release-staging.test.mjs`).
2. `verify-release.mjs` is not changed (see Out of Scope). The helper is still a
   separate file under `scripts/` because the brief and the human ruling place
   the shared `gh` logic there; `release.mjs` imports it with a relative import,
   and every test that copies `release.mjs` into a fixture runs the repository
   copy in-process (`main(argv, deps)`), so no fixture needs the helper.
3. An unparseable `gh --version` stops (`stop.gh_version_unparsed`): an unverified
   `gh` is not consent to start a release.
4. A failed lookup inside the merge wait also stops after 3 attempts (the brief:
   every caller); a "not found" there keeps polling as today.
5. Helper name: `scripts/gh-compat.mjs`.

### Red-test probe (reasoned + grep, suite not run)

Method: literal and regex grep of `test/` for `release.mjs`, `verify-release.mjs`,
`release-cd`, and for tests that read these files' source, import them, copy them
into fixtures, or run `release.mjs` with a fake `gh`; then each harness read
against the planned change. No prototype was written. "Red" = red after the sr
change and before qa's re-pin.

| test file | red under the change? | why | column |
|---|---|---|---|
| `test/e394-release-script.test.mjs` | yes, most phase-running tests | `GH_SHIM` falls through to `exit 0` with no output for `gh --version` → every phase stops `GH_UNAVAILABLE`; AC-S3's `ALLOW` regex list lacks `/^gh --version$/` | owned — re-pin in T-E463-02 |
| `test/e405-release-runner.test.mjs` | yes, every phase-running test | `mkSpawn` answers an unknown `gh` verb with `pr-or-release-url` (unparseable version) and logs it into `ghLog`, which the dry-run `snapshot` compares | owned — re-pin in T-E463-02 |
| `test/e432-judge-report-checks.test.mjs` | yes, `AC10 (E435): release s1 accepts …` | `runRelease` answers every `gh` call with exit 0 and empty stdout → `start` stops `GH_UNAVAILABLE` before s1 writes `state.md` | owned — re-pin in T-E463-02 |
| `test/e405-release-docs.test.mjs` | no | the new paragraphs add no `## ` heading and no numeric-first-cell row to *When a run fails*; lines 63/69/95 untouched | owned |
| `test/verify-release.test.mjs`, `test/e320-ci-check-sha.test.mjs`, `test/e326-empty-branch-run-poll.test.mjs`, `test/e158-range-subject.test.mjs` | no | `verify-release.mjs` unchanged, imports nothing new | owned — no re-pin |
| `test/e164-e167-content.test.mjs`, `test/e166-template-defers-staging.test.mjs`, `test/e435-remove-old-path.test.mjs`, `test/e394-release-sop.test.mjs`, `test/e405-release-workflow.test.mjs` | no | their source pins (`CI_GATE_FAILED`, staging contract, no `chain_path`, SOP text, `--help`) are untouched | owned |
| `test/release-staging.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e297-main-protected-sop.test.mjs`, `test/e336-portable-pull.test.mjs`, `test/e130-lane-default.test.mjs`, `test/feature-lease.test.mjs` | no — must stay green | `PHASES` literal, the viewPr `--json` argv literal, the `"pr merge", true, …` rule text, `pullMain`, `STAGE_PATHS`, `EXIT_CLASSES`, the SOP and the release-cd Copy lines are all unchanged; the one runner `spawn(bin, argv` call site stays the only one | forbidden |
| newly discovered | none | no other test file reads, imports, copies or spawns `release.mjs`, `verify-release.mjs` or `docs/release-cd.md` | — |

### Hop estimate

Current `hop_count` 1. pm write → 2; qa-engineer (T-E463-01, -02) → 3;
sr-engineer (T-E463-03..06, one session) → 4; code-reviewer PASS → 5. With one
review round (sr fix + re-review): 7. Well under the cap of 14.

### Open Questions

None needs a human ruling. For the integrator's pre-review: Decisions 1–5 above
(in particular 2, verify-release unchanged, and 3, an unparseable version stops),
and the unknown CI runner `gh` version (Dependencies).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E463-01 | qa-engineer: new `test/e463-*.test.mjs` with one test per AC id (E463-AC1..AC6, E464-AC1..AC6), titles starting with the AC id, using the in-process `main(argv, deps)` seam with injected `spawn` / `sleep`; write `qa_reports/expected-red_e463-release-gh-checks.txt` listing every test left red; commit, then run the suite with a clean worktree | none | 1 | `test/e463-*.test.mjs` | — |
| T-E463-02 | qa-engineer: re-pin the three owned harnesses so they answer `gh --version` with `gh version 2.40.0 (2023-12-07)` (green before and after the sr change): e394 `GH_SHIM` plus `/^gh --version$/` in AC-S3's `ALLOW`; e405-runner `mkSpawn` (answer without logging into `ghLog`); e432 `runRelease` stub. No assertion is loosened (X-AC2) | none | 3 | `test/e394-release-script.test.mjs` `test/e405-release-runner.test.mjs` `test/e432-judge-report-checks.test.mjs` | — |
| T-E463-03 | sr-engineer: new pure helper `scripts/gh-compat.mjs` — `MIN_GH_VERSION` "2.40.0", `GH_LOOKUP_ATTEMPTS` 3, `GH_LOOKUP_RETRY_SECONDS` 10, version parse + numeric compare + the stop details `stop.gh_too_old` / `stop.gh_version_failed` / `stop.gh_version_unparsed`, the not-found test (first non-empty stderr line starts `no pull requests found`); no `node:child_process` import (E464-AC5, AC6 helper half) (~80 lines) | T-E463-01 | 1 | `scripts/gh-compat.mjs` | — |
| T-E463-04 | sr-engineer: E464 phase-start check in `release.mjs` — read rule for exactly `gh --version` in `ALLOWED` (and `splitVerb` / `isAllowed` handling of the one-argument form), `preGh` runs `gh --version` through the runner first and stops `GH_UNAVAILABLE` via the helper, then `gh auth status` as today; `PHASES` unchanged (E464-AC2, AC3, AC4, AC6 allow-list half; X-AC1) (~40 lines) | T-E463-03 | 1 | `scripts/release.mjs` | — |
| T-E463-05 | sr-engineer: E463 `viewPr()` — not-found → "no pull request" with one call; any other failure retried (3 attempts, `AGC_RELEASE_GH_RETRY_SECONDS` / default 10 s via `envSeconds`, waits through `deps.sleep`, one `log.lookup_retry` line per retry) then `GH_UNAVAILABLE` with `stop.lookup_failed`; every caller awaited (`prePublish`, `preCloseOut`, `step8aCommitPushPr` both lookups, `openBookkeepingPr`, `waitMerged`); `MERGE_WAIT_TIMEOUT` detail → `stop.merge_wait_not_found`; the `--json` argv literal byte-identical (E463-AC1..AC5; X-AC1) (~80 lines) | T-E463-04 | 1 | `scripts/release.mjs` | — |
| T-E463-06 | sr-engineer: `docs/release-cd.md` — append `doc.gh_min` then `doc.lookup_retry` at the end of `## Manual fallback`; nothing else in the file changes (lines 63/69, the `PRECONDITION_NOT_PASS` row, the runner-only table byte-identical); then the full suite on the committed HEAD (E463-AC6, E464-AC1; X-AC1, X-AC2) (~6 lines) | T-E463-05 | 1 | `docs/release-cd.md` | — |

## Manifest tier

manifest-tier: not eligible — lane e463's approval column is `human`
