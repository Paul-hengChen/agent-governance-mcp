# Review — T-E8284-02

covers: T-E82-01, T-E84-01, T-E8284-02

Feature: e82-e84-release-verify-tooling (Wave 1, lane L-RELTOOL)
Base: 3d53c93 · Reviewed: `scripts/verify-release.mjs` (sr-engineer diff, code-reviewer APPROVED
in `review_reports/review_T-E82-01.md`) + this ticket's own addition,
`test/verify-release.test.mjs` (VR-23..VR-26, appended in place — the existing
32 cases are byte-unmodified).

Reviewer: qa-engineer. Scope per skill-qa-engineer: FAIL only for failing
tests, missing AC coverage, or test-infra defects; correctness/architecture
review is code-reviewer's job and was already APPROVED.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e82-e84-release-verify-tooling.txt`
manifest declared — feature-mode, not bugfix-mode).

## Phase 1 — Review

Read `scripts/verify-release.mjs` in full (396 lines) and cross-checked every
claim in `review_reports/review_T-E82-01.md` against the live file rather than
inheriting them:

- **E82**: `DEFAULT_WAIT_SECONDS` is 480 at line 289; the header comment
  (line 12) and the Check 6 comment above the constant (line 263) both say
  480; `grep -c '\b600\b'` on the file returns 0. Independently re-ran the
  spec's own AC1 proof command myself (not just trusted the prior run):
  `n=$(grep -c '\b480\b' scripts/verify-release.mjs); m=$(grep -c '\b600\b' scripts/verify-release.mjs); test "$n" = 3 && test "$m" = 0 && echo PASS`
  → `n=3 m=0` → `PASS`. Per the assignment, a grep pin alone is exactly the
  E82 defect shape (passes against a comment saying 480 with a different
  live constant) — Phase 3 below adds the required behavioral pin (VR-23).
- **E84 (`--close-out`)**: read the `if (closeOut) { ... }` block
  (lines ~90–150) end to end. It runs exactly one check
  (`ahead-of-upstream`) via the existing `runCheck`/`failedChecks` machinery,
  computes the ahead count via `git rev-list --count @{u}..HEAD` (the
  correct "commits reachable from HEAD but not from upstream" direction),
  and both its success and failure branches call `process.exit()` before
  the version-resolution block or any of Checks 1/3/4/5/6 are reached —
  structurally guaranteed, not just empirically observed on these fixtures.
- No edits to `scripts/verify-release.mjs` were made or are needed by QA;
  the diff under review here is limited to `test/verify-release.test.mjs`.

### Phase 3a — Copy Audit Gate

Spec's Copy/Strings table (2 entries) checked verbatim against the source:

| string id | spec text | source | match |
|---|---|---|---|
| vr.closeout.pass | `check:release — CLOSE-OUT PASSED` | `scripts/verify-release.mjs:136` `console.log("check:release — CLOSE-OUT PASSED")` | exact |
| vr.closeout.fail-ahead | `FAIL: HEAD is <n> commit(s) ahead of upstream <ref> — not pushed` | `scripts/verify-release.mjs:120-122` template literal | exact (n/ref are the documented interpolation points) |

No drift, no coverage gap (no new user-facing string outside this table —
the "FAILED (n check(s) failed)" and "OK: ahead-of-upstream" lines reuse the
pre-existing `runCheck`/summary copy, not new strings this ticket owns).

### Phase 3b — Visual Audit Gate

N/A — spec's Visual Tokens / Visual Widgets tables are both explicitly `N/A`
("feature has no visual literals" / "no non-primitive widgets"). Nothing to
audit.

## Phase 1.5 — Visual Compare

Skipped (no `design/e82-e84-release-verify-tooling.md`, no `## Visual
Baselines` section — non-design tooling feature per the handoff's own
`scope_decision_why`).

## Phase 3 — Tests

### Spec-to-Test map (this ticket's additions)

| AC | requirement | test |
|---|---|---|
| AC1 (E82) | 480s default, pinned behaviorally, not via grep | VR-23 |
| AC2 (E82 regression) | existing VR-22 + siblings stay green, unmodified | full suite run below (no edits to VR-1..VR-22/VR-SEC-1..4) |
| AC3 (E84) | `--close-out` FAILs when HEAD ahead of upstream, names count, skips tag-at-HEAD | VR-24 |
| AC4 (E84) | `--close-out` PASSes when HEAD == upstream, demonstrably skips Checks 1/3/4/5/6 | VR-25, VR-26 |
| AC5 (E84 regression) | full existing suite green, no-flag path untouched | full suite run below |

### VR-23 (AC1) — why this is a behavioral pin, not a grep

Drives the real script as a child process with `AGC_VERIFY_CI_WAIT_SECONDS`
explicitly deleted from its env, and a `gh` shim that never matches the
release sha, so Check 6 enters its poll loop. The script itself prints its
own remaining budget on the very first poll iteration
(`... (~<N>s left in budget)`) — the test reads that one line and asserts
`470 <= N <= 480`, then SIGKILLs the child. This can only be ~480 if
`DEFAULT_WAIT_SECONDS` genuinely evaluates to 480 at runtime; it would read
~600 (or crash the range assertion) if the shipped constant regressed to 600
while a stray comment still said 480 — the exact E82 defect shape a grep pin
cannot catch. Test window is ~1s wall-clock, not 480s (spawn + kill, not
spawnSync + wait-out).

### VR-24 (AC3) — the load-bearing pin, verified against a constructed mutant

Fixture: `mkFixtureRepo({ origin: "not-pushed" })` — pushes `main`, then adds
one local-only commit, so HEAD is a strict descendant of `@{u}`
(`@{u}..HEAD` ahead-count = 1; sanity-asserted in the test itself before
exercising the script). `--close-out` must exit non-zero, the stderr FAIL
line must name the count, and `OK: tag-at-HEAD` / `target version` must be
absent from stdout.

Per the assignment, I did not stop at "the test passes against the real
script" — I constructed the reversed-range mutant myself and ran it against
this exact fixture shape, outside the repo (scratchpad only, nothing left in
either git tree):

```
$ sed 's/"rev-list", "--count", "@{u}\.\.HEAD"/"rev-list", "--count", "HEAD..@{u}"/' scripts/verify-release.mjs > <scratch>/verify-release.mjs
$ node <scratch>/verify-release.mjs --close-out   # run inside the VR-24 fixture shape
OK: ahead-of-upstream
check:release — CLOSE-OUT PASSED
exit=0
```

The reversed range silently PASSes on the exact fixture VR-24 exercises —
confirming the always-passing-checker failure mode the assignment warned
about is real, and that VR-24's assertion (`result.status != 0` on this
fixture) is what catches it. The shipped script (correct direction) FAILs on
this same fixture, as VR-24 also asserts. VR-24 discriminates; a pin that
only checked "eventually exits" or only checked the equal-HEAD case would
not have.

### VR-25 / VR-26 (AC4)

VR-25: HEAD == upstream fixture, asserts exit 0, `CLOSE-OUT PASSED`, and the
**absence** of each of the five `OK: <check-name>` lines for Checks 1/3/4/5/6
individually (not a single aggregate assertion) — a build that silently
skipped every check for the wrong reason would still fail this if any
`OK:` line leaked through. VR-26 strengthens AC4's "no version argument is
resolved or required" clause: a fixture with deliberately-invalid
`package.json` JSON still exits 0 with `CLOSE-OUT PASSED`, which is only
possible if the version-resolution `JSON.parse` call is never reached (it
sits outside `runCheck`, so a genuine attempt would crash the process, not
produce a clean PASS).

### Coverage / security

New/modified code is `test/verify-release.test.mjs` only (test file); no new
production code surface for QA to add security smoke tests against beyond
what VR-SEC-1..4 already cover for the shared argv/version-parsing path
(untouched by this ticket — `--close-out` takes no version argument at all,
confirmed by VR-26).

## Phase 3.5 — AC Execution Log

| AC | proof | command / action | result |
|---|---|---|---|
| AC1 | spec `proof:` line (grep) | `n=$(grep -c '\b480\b' scripts/verify-release.mjs); m=$(grep -c '\b600\b' scripts/verify-release.mjs); test "$n" = 3 && test "$m" = 0 && echo PASS` | `n=3 m=0` → `PASS` (re-run independently, not inherited from code-reviewer) |
| AC1 (behavioral) | qa-authored | `node --test test/verify-release.test.mjs -t VR-23` (run as part of the full file below) | pass — observed ~480s left in budget on first poll line |
| AC2 | existing suite stays green | `node --test test/verify-release.test.mjs` | 36/36 pass (32 pre-existing + 4 new; 0 pre-existing case modified) |
| AC3 | qa-authored (VR-24) | `node --test test/verify-release.test.mjs` + mutant cross-check above | pass against shipped script; FAILs to catch (i.e. mutant PASSes, VR-24 would go red) against the reversed-range mutant — confirms discrimination |
| AC4 | qa-authored (VR-25, VR-26) | `node --test test/verify-release.test.mjs` | pass |
| AC5 | full existing suite green | `npm test` (full repo suite, not just this file) | 1868/1868 pass, 0 fail |

## Phase 4 — Run

- `npm run build`: clean, 0 errors. (Lane worktree had no `node_modules` —
  ran `npm ci` first, an environment-setup step, not a code change; nothing
  under version control was touched by it.)
- `node --test test/verify-release.test.mjs`: **36 pass / 0 fail** (32
  pre-existing + VR-23, VR-24, VR-25, VR-26).
- `npm test` (full repo suite): **1868 pass / 0 fail**, 0 cancelled, 0
  skipped.
- `npm run check:md-tables`: OK (243 files scanned, 0 malformed tables).
- `npm audit --audit-level=high`: exit 0 — 6 vulnerabilities reported, all
  moderate/low severity (`@hono/node-server`, `body-parser`, `esbuild`,
  `hono`, `protobufjs`, `qs`), none high/critical. Pre-existing dependency
  posture, unrelated to this ticket's diff (`test/verify-release.test.mjs`
  only) — not a finding against T-E8284-02/T-E82-01/T-E84-01.
- `git status --porcelain` confirms the only files this QA pass touched are
  `test/verify-release.test.mjs` and this evidence file; `scripts/**`,
  `content/**`, and `test/fixtures/compose-golden/**` are untouched by QA.

**Verdict: PASS.** AC1–AC5 all have qa-authored or independently re-run
proofs, AC3's pin is empirically confirmed load-bearing against a
constructed mutant, the pre-existing 32-case suite is unmodified, and the
full repo suite (1868/1868) plus build and md-tables checks are green.
## 2026-09-16T09:59:00.355Z — PASS — by qa-engineer

PASS. AC1 (E82, 480s default) pinned behaviorally via VR-23 (reads the script's own first poll-progress line, not a grep) — grep proof also independently re-run (n=3 m=0). AC3 (E84 close-out FAILs when HEAD ahead of upstream, skips tag-at-HEAD) pinned via VR-24, confirmed load-bearing by constructing a reversed-range (HEAD..@{u}) mutant in scratchpad and showing it silently PASSes the exact VR-24 fixture shape the shipped script correctly FAILs. AC4 (close-out PASSes on HEAD==upstream, skips Checks 1/3/4/5/6) pinned via VR-25 (absence of each OK: line asserted individually) and VR-26 (invalid package.json still PASSes, proving no version resolution is attempted). AC2/AC5 regression: the pre-existing 32 cases in test/verify-release.test.mjs are byte-unmodified; full file now 36/36 pass. Full repo suite: 1868/1868 pass, 0 fail. npm run build clean. npm run check:md-tables OK (243 files, 0 malformed). npm audit --audit-level=high: exit 0, only moderate/low findings, all pre-existing and unrelated to this diff. QA touched only test/verify-release.test.mjs and qa_reports/review_T-E8284-02.md.

