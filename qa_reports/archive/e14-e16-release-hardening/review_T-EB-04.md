# Review: T-EB-04 — QA PASS round (E14 CI ground-truth + E16 judge-dispatch charter)

covers: T-EB-01, T-EB-02, T-EB-03, T-EB-04

**Feature**: e14-e16-release-hardening. No spec file — the backlog-row scopes
(`docs/backlog.md` E14 + E16 rows) plus the `tasks.md` `## E14+E16 batch`
ticket text are the acceptance criteria, per the batch's own scope decision.
code-reviewer's `review_reports/review_T-EB-03.md` (T-EB-01..03) verdict:
**APPROVED**, with two trivial non-blocking notes and the VR-8 stale-title
item explicitly left to this round.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e14-e16-release-hardening.txt` manifest
declared — this is a feature-mode ticket, not bugfix-mode).

## Phase 1 — Review

Re-read code-reviewer's APPROVED verdict and independently spot-checked the
two claims load-bearing for QA's own test-authoring scope:

- **Check 6 exception-safety**: confirmed every "cannot obtain ground truth"
  path (`res.error`, `res.status !== 0`, `JSON.parse` throw,
  `!Array.isArray || length===0`) calls `warn()` and `return`s *before* any
  throwable operation, and the sole `fails.push` fires only on a parsed
  `conclusion !== "success"`. `scripts/verify-release.mjs:176-241`.
- **E16 zero server-code change**: `git status --porcelain -- tools/transitions.ts gates/ index.ts`
  returns empty (see AC Execution Log below) — confirms option B landed as
  content-only, matching the T-EB-03 review's independent check.

No new correctness/architecture findings — this round's own scope is test
authoring (§2), not a second correctness pass. No spec file → Copy Audit Gate
/ Visual Audit Gate / Phase 1.5 Visual Compare: all N/A (no product-facing
copy or visual surface; this ticket is a CI-integration release-check step
and a routing-charter text broaden).

## Phase 3 — Tests authored

### 1. `test/verify-release.test.mjs` — Check 6 "CI ground-truth" (E14)

Added a `gh`-shim helper (`mkGhShim` / `runVerifyWithPath` / `ghJsonShim`) —
a real executable placed on a controlled `PATH`, following this file's
existing convention of driving the *actual* shipped script against a *real*
environment rather than mocking `spawnSync`. `PATH` is narrowed to
`/usr/bin:/bin` (still resolves the real `git`, needed by Checks 1/2/5 and
by `check-version.mjs`/Check 3) with the shim directory prepended, or with
no `gh` present at all for the gh-missing case.

| new test | behavior pinned |
|---|---|
| VR-11 | shimmed gh returns `conclusion: "failure"` on a completed run → exit non-zero, `FAIL:` line names conclusion + truncated head SHA + URL, the other 5 checks still report OK (no short-circuit) |
| VR-12 | shimmed gh returns `conclusion: "success"` → `OK: CI ground-truth`, **no** `WARN:` line, exit 0, empty stderr |
| VR-13 | `gh` absent from PATH (ENOENT) → `WARN: ... gh CLI unavailable (ENOENT)`, check still OK, exit 0 |
| VR-14 | shimmed gh exits 1 with stderr (auth/API error) → `WARN: ... gh run list failed: <gh's own stderr>`, exit 0 |
| VR-15 | shimmed gh returns `[]` (zero completed runs) → `WARN: ... no completed CI runs found on origin/main`, exit 0 |
| VR-16 (bonus) | shimmed gh returns unparseable stdout → `WARN: ... could not parse gh run list output`, exit 0 — beyond the ticket's named 3 degradation paths, but closes the `JSON.parse` try/catch branch the code-reviewer verified but left untested |

Also fixed the **VR-8 stale title** (T-EB-04's own §2 item): retitled from
"all 5 checks pass" to "all 6 checks report OK", added `"CI ground-truth"`
to the per-check OK-line loop, and added an explicit sanity assertion that
this fixture's local-bare-repo origin (not a real GitHub remote) legitimately
still produces a `WARN: CI ground-truth —` line even on an "all OK" run —
documenting the fixture's real, unmodified (not gh-shimmed) behavior so a
future reader doesn't mistake the WARN for a masked regression.

### 2. `test/e16-judge-dispatch-charter.test.mjs` (new file) — §3.1 charter + coord-03 pointer (E16)

Mirrors the `readContentFile` grep-pinning convention from
`test/feature-lease.test.mjs` (S1-S6). Pins the exact load-bearing phrases
named in the dispatch brief:

| test | phrase pinned |
|---|---|
| E16-01 | charter lives inside the existing **Amend-Resume Edge** bullet (not a new top-level rule); `resume_of` is still explicitly required — the pre-existing mechanism sentence survives verbatim |
| E16-02 | **fresh-dispatch-not-only-resume**: "a PM-sanctioned FRESH dispatch of exactly one judge role ... not only a mid-chain resume of a previously stranded role" |
| E16-03 | same trust mechanics: "the server still checks only field⟺target consistency" |
| E16-04 | **judge roles only**: "the field opens no edge to any build role" |
| E16-05 | **no-build-role-edge sentence**: "so a code-bearing forward flow can never use it to skip code-reviewer or qa-engineer" |
| E16-06 | coord-03's Amend-Resume relay row carries the exact pointer sentence naming Constitution §3.1, and does **not** duplicate the trust-mechanics prose (single-sourced) |

Deliberately did **not** add a `git status --porcelain`-based "zero
server-code change" unit test: that check is only meaningful against *this
session's* uncommitted diff — once committed it would report clean
forever regardless of any later, unrelated edit to those files, which is a
false-confidence trap rather than a real regression guard. That fact is a
one-time observation, recorded in the AC Execution Log below instead. The
actual **lasting** regression guard for "the edge still requires `resume_of`
and only opens to the two judge roles" is the pre-existing C1-07
Amend-Resume Edge suite in `test/qa-flow.test.mjs` — confirmed unmodified
and green (see below).

### 3. Existing Amend-Resume / transitions tests — confirmed green, unmodified

```
$ git status --porcelain -- test/qa-flow.test.mjs tools/transitions.ts gates/ index.ts
(empty)
$ node --test test/qa-flow.test.mjs
# tests 127
# pass 127
# fail 0
```

`tools/transitions.ts`, `gates/`, `index.ts`, and `test/qa-flow.test.mjs`
(home of the C1-07 Amend-Resume Edge regression suite) are all byte-identical
to what's on disk pre-feature — E16 shipped as pure content (option B),
exactly as scoped.

## Phase 3.5 — AC Execution Log

No `specs/<feature>.md` exists (no `proof:`-annotated ACs possible), but per
this round's own dispatch brief the backlog-row scopes stand in as the ACs.
Recording the concrete commands proving each scope item below.

### E14 — Check 6 "CI ground-truth" (`scripts/verify-release.mjs`)

**1. Live green run** (real environment — real `gh`, real GitHub remote, real CI, no shim, no fixture):

```
$ node scripts/verify-release.mjs v3.82.0
check:release — target version v3.82.0
FAIL: tag v3.82.0 (21e7d8251965a8d599fa2b112665afdf4d14234c) does not point at HEAD (3267a696eb87935c7514beb5263e28088d69abb9)
OK: pushed-to-origin
OK: check-version
OK: CHANGELOG entry
OK: dist committed+parity
OK: CI ground-truth
check:release — FAILED (1 check(s) failed)
exit: 1
```
The overall run FAILs on Check 1 (tag-at-HEAD) — expected: HEAD has moved
past v3.82.0 with this feature's uncommitted work, and no v3.83.0 tag exists
yet (that's release-engineer's post-PASS job, T-EB-REL). **Check 6 itself
reports a clean `OK: CI ground-truth` with no WARN** — proof that against
the real repo/remote, `gh` resolved the host, found the latest completed run
on `main`, and it concluded `success`. This is the genuine "green → OK"
path, exercised live, not simulated.

**2. Shimmed red run** (fake `gh` on a controlled PATH, real fixture repo otherwise valid/green):

```
$ node <harness driving scripts/verify-release.mjs against a temp fixture repo,
   PATH = <shim-dir-with-fake-gh-returning-conclusion:failure>:/usr/bin:/bin>
exit: 1
check:release — target version v99.0.0
OK: tag-at-HEAD
OK: pushed-to-origin
OK: check-version
OK: CHANGELOG entry
OK: dist committed+parity

FAIL: latest completed CI run on main concluded "failure" (head deadbeefdead) — https://github.com/example/repo/actions/runs/999
check:release — FAILED (1 check(s) failed)
```
Matches VR-11. A definitively red completed run STOPs the release; every
other check still ran and reported OK.

**3. One degradation run** (gh binary missing entirely — PATH narrowed to `/usr/bin:/bin`, no `gh`):

```
$ node <same harness>, PATH = /usr/bin:/bin (no gh)
exit: 0
check:release — target version v99.0.1
OK: tag-at-HEAD
OK: pushed-to-origin
OK: check-version
OK: CHANGELOG entry
OK: dist committed+parity
WARN: CI ground-truth — gh CLI unavailable (ENOENT); continuing without CI verification (graceful degradation, E14)
OK: CI ground-truth
check:release — ALL CHECKS PASSED (v99.0.1)
```
Matches VR-13. Missing tooling degrades to WARN-and-continue; the release
still passes. (VR-14/VR-15/VR-16 in the automated suite additionally cover
the API-error and zero-runs degradation paths plus a bonus unparseable-output
path — all WARN, never FAIL, all exit 0.)

### E16 — §3.1 single-role judge dispatch charter + coord-03 pointer

**4. Charter grep proof** (`content/const-08-chain-31-mid.md`):

```
$ grep -n "Single-role judge dispatch\|resume_of. names the dispatched role\|not only a mid-chain resume of a previously stranded role\|judge roles only: the field opens no edge to any build role\|so a code-bearing forward flow can never use it to skip code-reviewer or qa-engineer" content/const-08-chain-31-mid.md
5:- **Amend-Resume Edge...**: ... **Single-role judge dispatch (v3.83.0, E16):** the same
`resume_of`-gated edges are ALSO the sanctioned door for a PM-sanctioned FRESH dispatch of
exactly one judge role (`code-reviewer` or `qa-engineer`) on a test-only / evidence-only
ticket — not only a mid-chain resume of a previously stranded role. Same field (`resume_of`
names the dispatched role), same trust mechanics (... the server still checks only
field⟺target consistency), judge roles only: the field opens no edge to any build role, so a
code-bearing forward flow can never use it to skip code-reviewer or qa-engineer.
```
All four load-bearing phrases present in one bullet, appended to (not
replacing) the pre-existing Amend-Resume Edge mechanism. Automated in
E16-01..05.

**5. Coordinator pointer grep proof** (`content/coord-03-core-fallback.md`):

```
$ grep -n "charter: Constitution §3.1" content/coord-03-core-fallback.md
29:| **Amend-Resume relay** — ... The same edge also carries a PM-sanctioned fresh
single-role judge dispatch on a test-only/evidence-only ticket — charter: Constitution §3.1 | ...
```
Pointer-only, as scoped — automated in E16-06 (also asserts the trust-mechanics
prose is NOT duplicated here).

**6. Zero server-code change** (E16 option B):

```
$ git status --porcelain -- tools/transitions.ts gates/ index.ts
(empty)
```

## Phase 4 — Run

- **Build**: `npm run build` — zero TypeScript errors (`tsc` clean), `check:version` prebuild OK.
- **Audit**: `npm audit --audit-level=high` — exit 0. One pre-existing **low**-severity advisory (esbuild dev-server arbitrary-file-read, GHSA-g7r4-m6w7-qqqr) — below the `high` threshold, not introduced by this feature, not blocking.
- **Test — CI runnability**: `npm test` runs headlessly, zero human interaction.
- **Test counts**: **1408/1408 → 1420/1420**, net **+12** (6 new `verify-release.test.mjs` Check-6 tests [VR-11..16] + 6 new `e16-judge-dispatch-charter.test.mjs` tests [E16-01..06]), **0 regressions, 0 removed**. `test/qa-flow.test.mjs` (Amend-Resume/transitions regression suite) independently re-run in isolation: 127/127, unmodified (confirmed via `git status --porcelain`).

```
$ npm run build && npm audit --audit-level=high && npm test
... tsc clean ...
... 1 low severity vulnerability (esbuild, pre-existing, non-blocking) ...
# tests 1420
# pass 1420
# fail 0
```

## Verdict

**PASS.** Check 6 behaviors (red→FAIL, green→OK, and all named degradation
paths — gh-missing/API-error/zero-runs, plus a bonus unparseable-output
path — →WARN+continue) are pinned by real-environment/real-shim tests
following the file's existing conventions; the §3.1 charter's four
load-bearing phrases and the coord-03 pointer are grep-pinned; existing
Amend-Resume/transitions tests are confirmed green and byte-identical
(unmodified); the VR-8 stale title is fixed. Full verification green:
build clean, audit clean at the `high` threshold, 1420/1420 tests passing.
Batch T-EB-01..04 (E14 CI ground-truth self-check + E16 judge-dispatch
charter) is complete and ready for T-EB-REL (release-engineer, post-PASS:
v3.83.0).
## 2026-07-13T07:06:18.734Z — PASS — by qa-engineer

PASS. Authored Check 6 (CI ground-truth, E14) behavior tests VR-11..16 in test/verify-release.test.mjs (red-CI FAIL, green OK, gh-missing/API-error/zero-runs degradation WARN+continue, plus bonus unparseable-output coverage) using a real gh-shim-on-PATH convention matching the file's existing fixture-repo approach. Fixed the stale VR-8 title (5->6 checks). Added new test/e16-judge-dispatch-charter.test.mjs pinning the §3.1 single-role judge dispatch charter's 4 load-bearing phrases (resume_of names dispatched role, fresh-dispatch-not-only-resume, judge-roles-only, no-build-role-edge) plus the coord-03 pointer sentence. Confirmed existing Amend-Resume/transitions suite (test/qa-flow.test.mjs, 127/127) unmodified and green via git status. AC Execution Log recorded in qa_reports/review_T-EB-04.md with live commands: Check 6 live green run (real gh/CI), shimmed red run, gh-missing degradation run, plus grep proofs for charter/pointer text and zero server-code diff. Full verification green: npm run build clean, npm audit --audit-level=high exit 0 (1 pre-existing low-sev esbuild advisory only), npm test 1420/1420 (up from 1408/1408, net +12 new tests, 0 regressions). Batch T-EB-01..04 complete, ready for T-EB-REL.

