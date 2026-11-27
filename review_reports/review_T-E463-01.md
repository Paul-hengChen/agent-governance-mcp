covers: T-E463-01, T-E463-02, T-E463-03, T-E463-04, T-E463-05, T-E463-06

# Review — e463-release-gh-checks (E463 + E464), round 1

## Round 1 — APPROVED — by code-reviewer

Base `e3a3db6`, reviewed head `98bbe04` (implementation head `e7b736c` plus the reviewer's claim/checkpoint commit, ledger only).
Inputs read: `git diff e3a3db6...HEAD`, `specs/e463-release-gh-checks.md` (no ticket files; the spec's ACs stand in as the scenarios),
`qa_reports/tests_e463-release-gh-checks.md`, `qa_reports/expected-red_e463-release-gh-checks.txt`. No architecture spec (architect not routed, spec Gate Summary).

## Summary
- E463: `viewPr()` in `scripts/release.mjs` is now async; gh's own not-found message (`no pull requests found …`, first non-empty stderr line) is one call and reads as "no pull request"; any other failure is retried (3 attempts in all, `AGC_RELEASE_GH_RETRY_SECONDS` via `envSeconds`, default 10 s, waits through `deps.sleep`) and then stops exit 14 `GH_UNAVAILABLE` with `stop.lookup_failed`. All six call sites await it (`prePublish`, `preCloseOut`, both 8a-6 lookups, 13a-5, `waitMerged` for 8c-2 / 13a-6).
- E464: new pure helper `scripts/gh-compat.mjs` (`MIN_GH_VERSION` 2.40.0, `GH_LOOKUP_ATTEMPTS`, `GH_LOOKUP_RETRY_SECONDS`, `parseGhVersion`, `compareVersions`, `ghVersionProblem`, `isPrNotFound`; no `node:child_process`). `preGh` runs `gh --version` first (exact one-argument read rule in `ALLOWED`), then `gh auth status`; `PHASES` unchanged.
- `docs/release-cd.md`: `doc.gh_min` then `doc.lookup_retry` appended at the end of `## Manual fallback`, byte-equal to the spec's fenced blocks; nothing else in the file changed.
- Tests: new `test/e463-release-gh-checks.test.mjs` (24 tests, one or more per AC) plus three owned harness re-pins (e394, e405-runner, e432).
- Scope clean (only owned paths), no exit class added, `scripts/verify-release.mjs` byte-identical. Suite 4928/4930 (0 fail, 2 unrelated history-dependent skips). Verdict: APPROVED.

## AC Completeness
E463-AC1 — implemented — scripts/release.mjs:351 (`isPrNotFound` → null, before any retry); scripts/gh-compat.mjs:45-48; tests "E463-AC1 …" (publish two stderr shapes, close-out).
E463-AC2 — implemented — scripts/release.mjs:343-358 (3 attempts, stop text at :353); tests "E463-AC2 …" with and without `--dry-run` assert 3 views, sleeps [10000,10000], exit 14, exact stop line, no PR_CANNOT_MERGE, no call after the pre-check.
E463-AC3 — implemented — scripts/release.mjs:355-356 (retry log + sleep, loop continues); tests "E463-AC3 1/2 failed lookup(s) …".
E463-AC4 — implemented — awaited at scripts/release.mjs:393, :400, :897, :907, :990, :1194; one test per site (close-out pre-check, 8a-6 before / after create, 13a-5, 8c-2, 13a-6) plus the dry-run deferred test.
E463-AC5 — implemented — scripts/release.mjs:344 (`envSeconds(…, "AGC_RELEASE_GH_RETRY_SECONDS", GH_LOOKUP_RETRY_SECONDS)`), :356 (ms through `sleepOf`); scripts/gh-compat.mjs:8,10; tests cover unset / 0 / abc / "" / -1 / 2.
E463-AC6 — implemented — docs/release-cd.md:121 (`doc.lookup_retry` verbatim, after `doc.gh_min`).
E464-AC1 — implemented — docs/release-cd.md:119 (`doc.gh_min` verbatim; names 2.40.0 = `MIN_GH_VERSION`).
E464-AC2 — implemented — scripts/release.mjs:322-327 (`gh --version` then `gh auth status` in `preGh`); `record` has no `preGh`.
E464-AC3 — implemented — scripts/gh-compat.mjs:37-39 (`stop.gh_too_old`); stop thrown before `gh auth status` at scripts/release.mjs:325.
E464-AC4 — implemented — scripts/gh-compat.mjs:31-36 (`stop.gh_version_failed`, `stop.gh_version_unparsed`); spawn error maps to status -1 + error text in the existing runner.
E464-AC5 — implemented — scripts/gh-compat.mjs:12-25 (first `gh version X.Y.Z` with `/m`, numeric per component; pre-release suffix ignored).
E464-AC6 — implemented — scripts/gh-compat.mjs (no `child_process`); scripts/release.mjs:88 rule + :108 `splitVerb` one-word form; `isAllowed("gh",["--version","x"])` and `["version"]` false; `git diff --exit-code e3a3db6 HEAD -- scripts/verify-release.mjs` exit 0.
X-AC1 — implemented — forbidden-path `git diff --name-only` prints nothing; `EXIT_CLASSES` deep-equal to base (42 entries); viewPr `--json` literal present once in base and head; no `+`/`-` diff line touches `PHASES`, `pullMain`, `STAGE_PATHS`, `EXIT_CLASSES`; the three forbidden release tests pass.
X-AC2 — implemented — `node scripts/test-lock.mjs -- npm test` exit 0 on committed HEAD `98bbe04`, `git status --porcelain` empty before and after.

## Correctness
Tests:
- Every AC has a test (or a command proof where the spec makes it one: E464-AC6 byte-identity, X-AC1 diff half, X-AC2); titles start with the AC id, so each `proof:` pattern selects exactly that AC's tests (13 pattern runs, all exit 0).
- Assertions are exact: full stop-line literals for `stop.lookup_failed`, `stop.gh_too_old`, `stop.gh_version_failed` (three shapes) and `stop.gh_version_unparsed` (two shapes); exact `log.lookup_retry` lines per step label; sleep arrays compared with `deepEqual`; call counts per branch.
- Negative controls (on a copy outside the worktree): forcing `viewPr` to return null on every failure reds 8/9 E463-AC2/AC4 tests (the dry-run deferred test stays green, as it should); removing the not-found check and the version stop reds E463-AC1 (2), E464-AC3, E464-AC4, E464-AC5.
- Re-pins (`git diff e3a3db6...HEAD -- test/`): e394 `GH_SHIM` and e405 `mkSpawn` / e432 stub only answer `gh --version` (e405 answers it before the `ghLog` fall-through, so the dry-run snapshot is unchanged); e394 AC-S3 `ALLOW` gains the exact `/^gh --version$/`. e394 AC-S9 changed from "no relative import at all" to "every relative import is exactly `./gh-compat.mjs`"; this is the narrowest change spec Decision 2 (a relative helper import) allows, and the `./check*` / `./verify*` and dynamic-import refusals are intact, so it is not a loosening beyond the spec.

Implementation: no findings.
- Empty stderr on a failed lookup → retried, stop names `no output` (scripts/release.mjs:353). Leading blank / indented stderr lines handled by `isPrNotFound` (trim + first non-empty). A not-found message that is not the first non-empty line (e.g. `GraphQL: no pull requests found`) is a failure, per the spec wording.
- `"deferred"` under `--dry-run` returns null on the first attempt (no retry, no sleep), keeping the "not observed" meaning; `waitMerged` still returns its placeholder.
- A failed lookup inside the merge wait now stops `GH_UNAVAILABLE` rather than polling to `MERGE_WAIT_TIMEOUT`; a null there can only mean not-found, so the `stop.merge_wait_not_found` wording is correct (scripts/release.mjs:996).
- Step-runner loop already `await`s every step (scripts/release.mjs:1624), so making `prePublish` / `preCloseOut` / `step8aCommitPushPr` async changes no ordering; `openBookkeepingPr` was already awaited at :1206.

## Quality
- recommended — test/e463-release-gh-checks.test.mjs:1-15: `agc check — comments` flags the 15-line head block (limit 7). Kept: it is the file's head warning describing the two harnesses for a 500-line file, not an in-body comment, and carries no sensitive data; trimming it to a pointer at `qa_reports/tests_e463-release-gh-checks.md` (which already holds the harness notes) would satisfy the advisory.
- optional — scripts/gh-compat.mjs:5, :9, :21 and scripts/release.mjs:107, :321: `//` summary lines of 82-97 columns. These are line comments, not JSDoc doc comments, and the base `release.mjs` already has 27 comment lines over 80 columns; consistent with the surrounding file.
- No other findings: comments say WHAT/WHY, no in-body comments beyond the head warnings, no ticket ids or governance jargon in the script/doc comments (test re-pin comments carry a ticket id followed by an explanation, matching the surrounding test files), no absolute paths or usernames in the diff.

## Architecture
No architecture spec (not routed). The helper is pure and owns no child call; every `gh` call still goes through the runner and the allow-list, matching spec Decisions 1-5. `verify-release.mjs` untouched (Decision 2).

## Security
No findings. The new allow-list rule admits exactly `gh --version` as a read (a mutate of it is refused, tested). Stop details echo gh's own stderr line, as the existing `gh auth status` stop already does; no secrets introduced.

## Performance
No findings. At most 2 extra waits (20 s default) on a failing lookup, by design; one extra `gh --version` spawn per phase. No hot-path change.

## Verdict
APPROVED — every spec AC is implemented and pinned by an exact test or a command proof I ran, scope and exit classes are unchanged, and the full suite is green on the committed head.
