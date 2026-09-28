# Review — T-E82-01

covers: T-E82-01, T-E84-01

Feature: e82-e84-release-verify-tooling (Wave 1, lane L-RELTOOL)
Base: 3d53c93 · Diff under review: `scripts/verify-release.mjs` only
Reviewer model: opus (sr-engineer pinned `fable` — different model, no same-model-bias concern)

## Round 1 — APPROVED — by code-reviewer

## Summary
- One file changed (+102/-33 on `scripts/verify-release.mjs`; the rest of the diff vs base is governance artifacts: `.current/handoff.md`, `.current/telemetry.jsonl`, `tasks.md`). No `test/`, no `content/`, no new backlog IDs, no fixtures left behind.
- **E82 (T-E82-01)**: the CI-wait default moves 600 → 480 in all three places the file states it (lines 12, 263, 289). AC1 proof executes PASS (`n=3 m=0`). Env-override parsing and the `0` = no-wait path are textually untouched.
- **E84 (T-E84-01)**: a `--close-out` branch is added before version resolution, running exactly one `ahead-of-upstream` check through the existing `runCheck`/`failedChecks` machinery.
- **The acceptance question is answered YES, by execution not by reading**: against a fixture in the exact `6cd767b` / v3.102.5 shape (HEAD one commit ahead of a pushed upstream), `--close-out` exits 1 with `FAIL: HEAD is 1 commit(s) ahead of upstream origin/main — not pushed`. The range argument order is correct.
- **No-flag regression: none.** Old (base) and new script produce byte-identical stdout+stderr and identical exit codes on the same fixture for every existing invocation shape. Existing suite `test/verify-release.test.mjs` is 32/32 green against the changed script.
- Verdict: APPROVED.

## Correctness

No blocking findings.

**E84 — range direction (the whole ticket), verified by execution.** `scripts/verify-release.mjs:118` computes `git rev-list --count @{u}..HEAD`. `@{u}..HEAD` = commits reachable from HEAD but not from upstream = the *ahead* count. This is the correct order; the reversed `HEAD..@{u}` would have been the always-passing checker the assignment warns about. Fixtures built under `$TMPDIR` (real `git init`, real local bare origin, the real script copied into the fixture's `scripts/`, no mocks):

| fixture | state | result |
|---|---|---|
| A | HEAD == upstream | exit 0, `OK: ahead-of-upstream` + `check:release — CLOSE-OUT PASSED` |
| B | HEAD 1 ahead of pushed upstream (**the 6cd767b shape**) | exit 1, `FAIL: HEAD is 1 commit(s) ahead of upstream origin/main — not pushed` |
| C | upstream tracking branch unset | exit 1, `FAIL: no upstream tracking branch configured` |
| D | detached HEAD (1 commit unpushed) | exit 1, `FAIL: no upstream tracking branch configured` |
| E | HEAD 1 *behind* upstream | exit 0, `CLOSE-OUT PASSED` (see Note 1) |
| F | diverged, 1 ahead / 1 behind | exit 1, `FAIL: HEAD is 1 commit(s) ahead …` |
| G | `git fetch origin` fails (origin URL bogus) | exit 1, `FAIL: could not verify against origin: <git stderr>` |

Fixture B is the E84 acceptance question: the checker would have caught the live defect. Fixture G confirms the file's own header contract ("a `git fetch origin` failure (network/auth) is itself a FAIL … never advisory") is honoured by the new path — the fetch failure is a FAIL, not a silent pass, and it returns before the count is computed so a stale-ref false PASS is impossible. Fixtures C and D confirm no-upstream and detached-HEAD are FAILs, not silent passes.

**AC4 — no version resolved in close-out mode.** The `if (closeOut)` block (`scripts/verify-release.mjs:90-150`) sits *before* the version-resolution block (now at `:152-166`) and `process.exit()`s in both branches, so no version arg is parsed or required, `package.json` is never read, and Checks 1/3/4/5/6 never run. Confirmed literally, not just behaviorally: close-out stdout contained only the two expected lines — no `OK: tag-at-HEAD`, no `OK: CI ground-truth`, no `target version` line.

**AC5 — no-flag path unchanged, verified by differential execution.** `process.argv[2]` → `argv[0]` where `argv = process.argv.slice(2)` is index-equivalent. Rather than argue that, I ran the base script and the new script against the same fixture with identical env (`AGC_VERIFY_CI_WAIT_SECONDS=0`) and diffed full stdout + stderr + exit code, with fixture paths normalized:

- no args (package.json fallback) → IDENTICAL, exit 1 both
- `v3.110.0` → IDENTICAL (`target version v3.110.0`), exit 1 both
- `3.110.0` (no `v`) → IDENTICAL (`target version v3.110.0`), exit 1 both
- `1.0.0` → IDENTICAL
- `--verbose` (unknown flag, the invalid-version error path) → IDENTICAL: `check:release — invalid target version "--verbose" (expected vX.Y.Z)`, exit 1 both
- `bogus` → IDENTICAL invalid-version error, exit 1 both

The only shape that differs is `--close-out` itself, which is the point of the ticket. `node --test test/verify-release.test.mjs` → **32 pass, 0 fail** against the changed script, which independently confirms AC2 and AC5.

**AC1/AC2 (E82).** `grep -n 480` returns exactly lines 12, 263, 289 and `grep -c '\b600\b'` returns 0 — the spec's proof command prints PASS. The three statements agree with each other and with the constant. The override machinery (`scripts/verify-release.mjs:290-294`) is untouched by the diff: `rawBudget`/`parsedBudget`/`Number.isFinite(parsedBudget) && parsedBudget >= 0` is unchanged, so an explicit `0` still yields a 0 budget (one `gh` call, no wait) and any explicit positive integer still governs. The only changed line in that hunk is the constant. No stale "10 minutes"/"600" prose remains anywhere in the file.

**Note 1 — silence on "behind" is correct, silence on "diverged" does not occur.** A pure-behind HEAD passes close-out. That is right for E84 as specified ("FAILs if HEAD carries any commits not on its upstream tracking branch" — a behind-only HEAD carries none), and diverged still FAILs because its ahead count is > 0. It is worth stating explicitly for whoever writes the L-CONTENT SOP line: `--close-out` is **not** "Check 2 run later". Check 2 FAILs on *any* HEAD≠upstream inequality, including behind; `--close-out` is deliberately one-directional. Recorded as a non-blocking note in `NEW-TICKETS.md` (L-RELTOOL-N1), not a finding against this diff.

## Quality

No blocking findings.

- The close-out block is a near-verbatim reuse of Check 2's fetch + `@{u}` resolution preamble (`:91-110` vs `:169-183`), including the identical `err?.stderr` detail extraction and the identical `FAIL: could not verify against origin:` / `FAIL: no upstream tracking branch configured` copy. This duplication is deliberate and correct here: the spec's rejected option (iii) and AC5 both require Check 2's contract to stay untouched, and factoring a shared helper out of Check 2 would have been exactly the refactor T-E84-01 forbids. Flagging it only so a future reader does not "clean it up" without re-reading the spec.
- `scripts/verify-release.mjs:141-149`: the trailing `process.exit(0)` after the `if/else` is reachable only on the success branch (the else already exits 1). Correct, just slightly indirect. Not worth a round.
- The new header paragraph (`:32-40`) documents the mode, its deliberate omission of Checks 1 and 3-6, and that no automatic invocation point exists yet — matching the spec's Out-of-Scope framing exactly. Good.
- Naming (`closeOut`, `ahead-of-upstream`, `aheadCount`, `upstreamRef`) matches the file's conventions.

## Architecture

No architecture spec exists for this feature (`specs/e82-e84-release-verify-tooling-architecture.md` absent; spec declares mode = no-design, no `design/<feature>.md`). Fit with the spec's own stated decisions:

- Built as fix-shape (iii)-via-new-mode, not as a change to Check 2 — matches the spec's Decision paragraph and its explicit rejection of amending Check 2.
- Strictly additive: the six existing checks and the existing summary block are untouched; the new mode reuses `runCheck`/`failedChecks` rather than inventing a second reporting path, and reuses the existing `check:release — FAILED (n check(s) failed)` failure line.
- Layering: the close-out branch is placed after `runCheck` is defined and before version resolution — the only ordering that satisfies AC4 without duplicating the runner. Correct placement.
- Lane boundaries respected: no `content/**`, no `test/**`, no `scripts/check-version.mjs` change, no new backlog IDs. E83 and E82 option (ii) are correctly absent.

## Security

No findings.

- Every new subprocess call uses `execFileSync` with an array argv (`["fetch", "origin"]`, `["rev-parse", …]`, `["rev-list", "--count", "@{u}..HEAD"]`) via the existing `EXEC_OPTS` — no shell, no interpolation of any external value into a command string. The existing `VR-SEC-3`/`VR-SEC-4` injection pins stay green.
- The one new external input (git's stdout ahead-count) is `Number()`-parsed and `Number.isFinite`-guarded before the `> 0` comparison (`:118-127`), so a non-numeric or empty git output produces an explicit FAIL rather than a `NaN > 0` silent pass. I confirmed the guard is not dead code by reading the fall-through: `NaN` cannot reach the comparison.
- Git stderr is interpolated only into a console message, never into another command. No secrets added; no new file writes; no network egress beyond the `git fetch origin` the header already contracts for.

## Performance

No findings. Close-out mode performs strictly less work than a normal run: one `git fetch origin` plus two cheap plumbing calls, then exit — no `gh` polling, no `spawnSync` of `check-version.mjs`, no dist parity read. Normal-mode cost is unchanged. The E82 change lowers the worst-case wall-clock of Check 6 by 120s. No loops, no added I/O in any existing path.

## Verdict

APPROVED — E84's `--close-out` computes the ahead count in the correct direction and FAILs on the exact live `6cd767b` / v3.102.5 shape (proven against a real git fixture, not by reading), every failure mode (no upstream, fetch failure, detached HEAD, diverged) is a FAIL rather than a silent pass, the no-flag path is byte-identical to base across every existing invocation shape with the existing 32-test suite green, and E82's three 600-spots all moved to 480 with the override and `0` = no-wait paths untouched.

Hand-off note for qa-engineer (T-E8284-02): the fixtures above are reproducible with `git init` + a local bare origin and the script copied into `<fixture>/scripts/` — note `EXEC_OPTS.cwd` is the script's own repo root, so the script must live inside the fixture repo, not be invoked from it by path.
