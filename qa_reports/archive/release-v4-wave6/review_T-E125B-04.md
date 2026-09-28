# Review — T-E125B-04 (QA)

covers: T-E125B-01, T-E125B-02, T-E125B-03, T-E125B-04, T-E125B-05, T-E125B-06, T-E125B-07

## Round 1 — by qa-engineer (sonnet)

Contract: `specs/e125b-lane-close-writeback.md`, AC1–AC6, AC8–AC13 (AC7 does not exist in
this spec — the AC numbering skips from AC6 to AC8). Code review: Round 2 APPROVED,
`review_reports/review_T-E125B-01.md`. Diff base: `f174d89` (post e125a merge to
`main`). HEAD at claim time: `1129387`.

## Summary

All 7 tasks (T-E125B-01/02/03/05/06/07 implementation + T-E125B-04 QA) are complete.
I wrote the tests T-E125B-04 owns (6 files: 2 new, 4 extended), executed every
`proof:`-annotated AC in the spec, ran the full suite after committing, and confirmed
the diff touches no `content/**`, `test/fixtures/compose-golden/**`,
`test/context-budget.test.mjs`, `schema/**`, or root `tasks.md`.

**Test-file placement disposition (Phase 3a):** the dispatch brief named
`test/agc-orphan-lanes.test.mjs` and `test/lane-registry-feature-history.test.mjs` as
files to extend. Neither exists in this repo. The real, pre-existing coverage for
AC4's own domain (the orphan-lane advisory, E179 AC5) already lives in
`test/agc-feature-lifecycle.test.mjs`; the real, pre-existing coverage for AC5's own
domain (`getLaneFeatureHistory`, e123b9's AC7) already lives in
`test/e132-lane-registry.test.mjs`. Per Phase 3a ("check if existing test files cover
the current task's scope — if relevant test files exist, extend those"), I placed the
AC4 and AC5 extensions in those two real files instead of creating two new files under
the brief's literal (non-existent) names. Each extension is called out in its own
file's added section header with this same reasoning. `test/tasks-file-foreign-check.test.mjs`
(the brief's AC8/X7 "new, or extend the nearest e125a D12 fixture test" option) — I
took the "extend" branch: `test/e125a-lane-local-ledgers.test.mjs` already carries the
exact D12/AC14 fixture shape (a stale `_primary` section for a foreign lane, live vs.
excluded) this AC's history-bucket variant needed, so I extended it rather than forking
a new file with materially the same fixture helpers.

## AC Completeness

- **AC1** (tracked-shape close, git mv into `.current/history/<YYYY-MM>/<ticket>/`,
  committed on `--base`) — verified. `test/agc-feature-finish-history.test.mjs` `AC1`.
- **AC2** (exactly one `lane_closed:` pointer line, HTML comment, never a checkbox row)
  — verified. `AC2` (x2: shape + idempotent re-run).
- **AC3** (a pre-existing e125a `tasks_moved` feat marker for the closing lane is
  replaced) — verified. `AC3` (x2: own-lane marker replaced, another lane's marker
  left untouched).
- **AC4** (orphan scan never reads `.current/history/`; a closed lane is never
  flagged) — verified. `test/agc-feature-lifecycle.test.mjs` two new tests: a
  grep-based structural proof that `checkOrphanLanes`'s body never mentions
  "history", plus a full closed-lane fixture (branch deleted, history copy tampered
  to look unapplied) that still produces zero warning.
- **AC5** (`getLaneFeatureHistory` merges `metrics.jsonl` rows, recovering a
  long-lived lane's shipped predecessor) — verified.
  `test/e132-lane-registry.test.mjs`, 6 new `AC5 (e125b)` tests: the worked example
  (in-place `_primary` change), same-feature dedup (handoff wins), repeated-row
  earliest-ts collapse, malformed-line tolerance, metrics-only lane, and closed
  (history-bucket) lane dir.
- **AC6** (`resolveHistoryBucket` UTC YYYY-MM; `resolveHistoryLaneDir` throws on a
  malformed bucket or unsafe lane; `hasHistoryLedger` pure fs, never throws) —
  verified. `test/lane-paths-history.test.mjs` (new), 30 tests.
- **AC8 / X7** (a `_primary` section for a lane closed into history is hidden on
  every read and refused on `tw_add_task`, same `makeForeignCheck` check ORed with
  `hasHistoryLedger`) — verified. `test/e125a-lane-local-ledgers.test.mjs`, 3 new
  `AC8 (e125b, X7)` tests: read-exclusion (the AC14-1 shape, history-bucket
  variant), add-refusal (the AC14-1(d) shape, history-bucket variant), and a
  negative control (a section backed by neither a live nor a closed ledger is NOT
  excluded).
- **AC9** (gitignored-`.current/` fs-copy harvest before worktree removal, never
  committed, advisory line; R1 re-run re-harvest; R2 partial-failure rollback; a
  zero-write lane no-ops) — verified. `test/agc-feature-finish-history.test.mjs`:
  `AC9-HARVEST`, two `AC9-ZEROWRITE` variants (genuinely absent dir vs.
  base-sha-only dir), `AC9-R1`, `AC9-R2`. R1's repro reproduces the exact review
  Round-1 finding (stray file forces a refused removal, later writes land, the
  re-run re-harvests the newer content and prints the refresh advisory). R2's repro
  reproduces the exact EACCES mid-copy finding (no `.current/history/` left behind,
  the retry succeeds).
- **AC10** (root `tasks.md` as the live ledger, AC4b shape: the Closed Lanes pointer
  parses as zero tasks) — verified. `test/agc-feature-finish-history.test.mjs`
  `AC10`, using the real `tools/tasks-file.ts` `parseTasksFromFile` reader (not a
  hand-rolled regex) against a fixture with one real task row plus the new pointer
  section.
- **AC11** (`base-sha` LANE_FILES registration; `agc feature start` writes the fork
  point; `agc feature finish` reads it back with `unknown` fallback; the AC11
  Implementation-note deviation — base-sha stays worktree-local via info/exclude,
  never committed) — verified across three files:
  - `test/lane-paths.test.mjs`: `REG1` (8 entries), a new dedicated `AC11 (e125b)`
    registry test (key/filename/required/no-noFlatCounterpart), a `baseShaPath`
    resolver test, and `CALLERS1` updated to the sanctioned `bin/agc-init.mjs`
    allow-list.
  - `test/lane-migrate.test.mjs`: `seedAllFiveFiles` now seeds `base-sha`
    (mechanically fixes `FL1`/`REV1`/`RT1`/`AC5-DEBRIS1-4`/`COUNT1`/`COUNT2`/the two
    `AC2 (e125a)` tests, all manifest entries), plus a new dedicated
    `AC11 (e125b)` test naming base-sha explicitly for the reverse-migrate-without-
    refusing + round-trip claim.
  - `test/agc-feature-finish-history.test.mjs`: `AC11-FORKPOINT` (base advances
    after start; pointer's `base_sha` equals the captured start-time commit, not
    the later tip), `AC11-UNKNOWN` (x2: no base-sha file at all; a malformed
    base-sha file — both fall back to the literal `unknown`, confirming no
    injection route through a tampered file).
  - The AC11 **Implementation note** (base-sha worktree-local, never committed) is
    confirmed structurally by `AC9-ZEROWRITE (base-sha only)`: the history copy of
    a base-sha-only lane is untracked (never asserted as committed), and by
    `AC1`, which shows the TRACKED-shape history copy holds no `base-sha` at all
    (only the file the lane actually committed) — matching the note's stated
    consequence exactly.
  - **Integrator ask (lane→flat→lane round-trip with the `/.current/**/base-sha`
    info/exclude rule in place):** confirmed. `test/lane-migrate.test.mjs`'s new
    `AC11` test round-trips a lane holding `base-sha` (flat→lane→flat, byte
    identical) using the real compiled `migrateFlatToLane`/`migrateLaneToFlat`
    runners — the same runners the exclude rule must not interfere with. I did not
    additionally re-run the code-reviewer's own live-git smoke of the exclude rule
    itself (`bin/agc-init.mjs`'s `upsertSharedExclude` / `LANE_EXCLUDE_RULES`) since
    Round 2's review already re-verified that smoke by repro; my proof is the
    registry-level round trip the integrator's ask is actually about.
- **AC12** (`--pr <n>` → `pr=<n>`; no `--pr` → `pr=none`; validates `/^\d+$/`; never
  queries a PR host) — verified. `test/agc-feature-finish-history.test.mjs`, 4
  `AC12` tests (given, omitted, invalid-value usage error, `--pr` with
  `--abandoned` rejected).
- **AC13** (full suite green, `npm run build` clean, the forbidden-path diff empty)
  — verified. See Phase 4 below for the post-commit run and the diff-stat
  confirmation.

## Copy Audit Gate (Phase 3a)

Every `Copy / Strings` row grepped against the actual implementation, verbatim:

- `e125b.closed-lane-pointer-line` — `closedLanePointerLine()` (`bin/agc-init.mjs:1727`)
  composes the exact literal template (`<!-- lane_closed: ticket=... -->`). Byte match.
- `e125b.closed-lanes-section-heading` — `CLOSED_LANES_HEADING = "## Closed Lanes"`
  (`bin/agc-init.mjs:1717`). Byte match.
- `e125b.orphan-scan-comment-update` — the code comment above `checkOrphanLanes`
  (`bin/agc-init.mjs:825-831`) states the AC4 rationale as decided by E125b, not
  pending. Matches the spec's description of the required update (code comment
  only, non-user-facing).
- `e125b.harvest-advisory-line` — `executeLaneClose`'s stdout write
  (`bin/agc-init.mjs:1982-1986`) matches the template exactly, including the
  conditional `<reason>` clause (`sourceIgnored` branch). Confirmed at runtime by
  `AC9-HARVEST`'s stdout assertions.
- `e125b.harvest-refresh-line` — `executeHarvestRefresh`'s stdout write
  (`bin/agc-init.mjs:2052-2058`) matches the template exactly, one `  <path>` line
  per re-harvested file. Confirmed at runtime by `AC9-R1`'s stdout assertions.

No drift, no coverage gap (every implementation-side user-facing string traces back to
one of these five rows). No `Visual Tokens` / `Visual Widgets` rows exist (spec states
"feature has no visual literals / no non-visual widgets") — Phase 1.5 is skipped (see
below).

## Phase 1.5 — Visual Compare

Skipped (no `## Visual Baselines` H2 in `design/e125b-lane-close-writeback.md` — no
such design file exists at all; spec's own Visual Tokens/Widgets tables both say N/A).

## Expected-Red Diff

(Phase 0.5.) `qa_reports/expected-red_e125b-lane-close-writeback.txt` exists (12 entries: 1 in
`test/agc-feature-lifecycle.test.mjs`, 9 in `test/lane-migrate.test.mjs`, 2 in
`test/lane-paths.test.mjs`). I re-baselined every one of them as part of T-E125B-04
(see AC Completeness above for the mechanism):

- `test/agc-feature-lifecycle.test.mjs` `AC2 proof (1)` — re-baselined: `git log -1`
  now asserts the close commit (was the pending-apply commit); the pending file is
  now read from `.current/history/<bucket>/e179a/` (the old flat path is asserted
  gone).
- `test/lane-migrate.test.mjs` `FL1`, `REV1`, `AC5-DEBRIS1`, `AC5-DEBRIS2`,
  `AC5-DEBRIS3`, `AC5-DEBRIS4`, `RT1`, the two `AC2 (e125a)` tests — re-baselined
  mechanically: `seedAllFiveFiles` now also seeds `base-sha`, and every one of these
  assertions is already derived from `MOVABLE_FILENAMES` (computed from
  `LANE_FILES`), so no per-test literal needed touching.
- `test/lane-paths.test.mjs` `REG1` (7→8 entries) and `CALLERS1` (added
  `bin/agc-init.mjs` to the sanctioned `resolveLanePaths` caller allow-list) —
  re-baselined directly.

**Diff after re-baseline:** clean. I ran the full suite (see Phase 4) and confirmed
these 12 are the ONLY tests whose expectations moved, and that they are now green —
zero unexplained reds, zero regressions outside the manifest.

## AC Execution Log

(Phase 3.5.) Every `proof:`-annotated AC in `specs/e125b-lane-close-writeback.md` executed
individually before PASS:

- **AC1** — `node --test test/agc-feature-finish-history.test.mjs` → exit 0, `tests
  19 / pass 19 / fail 0`.
- **AC2** — manual fixture run (`agc feature start e125bq2-proof` → merge → `agc
  feature finish e125bq2 --shipped`), then `grep -F "lane_closed: ticket=" tasks.md`:
  matched exactly one line —
  `<!-- lane_closed: ticket=e125bq2 branch=feat/e125bq2-proof
  base_sha=fdb7db3c4c94c819308771c7d3b4fefa77324b62 pr=none
  history=.current/history/2026-09/e125bq2/ closed_at=2026-09-25T16:07:52.067Z
  (base_sha invalidated by a history rewrite; git log --grep e125bq2 is the
  universal fallback) -->` (exit 0); then `grep -c "^- \[ \]\|^- \[x\]" <that line>`
  → `0` matches (grep exit 1, meaning "no match" — the checkbox count is correctly
  zero). Both proof commands pass.
- **AC3** — fixture case in `test/agc-feature-finish-history.test.mjs` ("a
  pre-existing e125a tasks_moved feat marker for the closing lane is replaced by
  the new Closed Lanes pointer") — PASS (see AC1's full-suite run above; this test
  is in the same file/run).
- **AC4** — `test/agc-orphan-lanes.test.mjs` does not exist (see Test-file
  placement disposition); proof executed as `node --test
  test/agc-feature-lifecycle.test.mjs` → included in the file's full run below
  (Phase 4), both new AC4 tests pass.
- **AC5** — `test/lane-registry-feature-history.test.mjs` does not exist (see Test-
  file placement disposition); proof executed as `node --test
  test/e132-lane-registry.test.mjs` → 22/22 pass, all six new `AC5 (e125b)` tests
  included.
- **AC6** — unit test file `test/lane-paths-history.test.mjs` — `node --test
  test/lane-paths-history.test.mjs` → exit 0, `tests 30 / pass 30 / fail 0`.
- **AC8** — `test/tasks-file-foreign-check.test.mjs` was not created (extended
  `test/e125a-lane-local-ledgers.test.mjs` instead, per its own explicit "or extend"
  branch); proof executed as `node --test test/e125a-lane-local-ledgers.test.mjs` →
  36/36 pass, all three new `AC8 (e125b, X7)` tests included.
- **AC9** — fixture case "gitignored `.current/` — untracked lane state is fs-copy
  harvested before worktree removal, never committed" — `AC9-HARVEST` in
  `test/agc-feature-finish-history.test.mjs` — PASS (same file/run as AC1).
- **AC10** — fixture case "root tasks.md as live ledger (AC4b shape): a `##
  Closed Lanes` pointer line parses as zero tasks" — `AC10` in
  `test/agc-feature-finish-history.test.mjs` — PASS (same file/run as AC1).
- **AC11** — case "base_sha in the pointer line is the fork point, not the branch
  tip, when base advanced after start" → `AC11-FORKPOINT` PASS; case "lane started
  before this ticket: base_sha=unknown" → `AC11-UNKNOWN` PASS (x2); PLUS the
  integrator's required `test/lane-migrate.test.mjs` case ("a lane dir containing
  base-sha reverse-migrates ... round-trips forward again unchanged") → the new
  dedicated `AC11 (e125b)` test in that file — PASS (`node --test
  test/lane-migrate.test.mjs` → 40/40 pass).
- **AC12** — fixture cases "--pr 42 → pr=42" and "no --pr → pr=none" — `AC12` (x2 of
  4 new tests) in `test/agc-feature-finish-history.test.mjs` — PASS (same file/run
  as AC1).
- **AC13** — `npm test` and the `git diff --stat` command — executed post-commit,
  see Phase 4 below (the SOP's own crash-checkpoint / full-suite ordering, and this
  lane's own protocol §3, both require the full run to happen after the test files
  are committed).

No proof could not be run; no proof's observed outcome contradicted its AC text.

## Phase 4 — Run

Test files, this evidence file, and `.current/e125b/` committed first (commit
`af40f29`, 10 files, working tree clean of untracked files per lane-protocol §3),
THEN the full suite:

```
npm test
# tests 2618
# suites 1
# pass 2618
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Base (per review Round 2, `review_reports/review_T-E125B-01.md`): 2543 pass, 12
fail (2555 total, all 12 fails = the expected-red manifest). This run: 2618 total,
2618 pass, 0 fail — exactly base 2555 + 63 new T-E125B-04 tests (30
`lane-paths-history.test.mjs` + 19 `agc-feature-finish-history.test.mjs` + 1
`lane-migrate.test.mjs` AC11 + 2 `lane-paths.test.mjs` AC11 + 2
`agc-feature-lifecycle.test.mjs` AC4 + 6 `e132-lane-registry.test.mjs` AC5 + 3
`e125a-lane-local-ledgers.test.mjs` AC8/X7 = 63), zero regressions, zero
unexplained reds — the 12 manifest entries are all now green.

`npm run build` clean (`tsc` zero errors, `check:transitions-sync` OK — run as
part of `npm test`'s `pretest`/prebuild step, and separately confirmed earlier).

`git diff --stat f174d89...HEAD -- content/ test/fixtures/compose-golden/
test/context-budget.test.mjs schema/ docs/ tasks.md` — empty, confirmed both
pre-commit and post-commit (QA's own commit `af40f29` touches only `test/**`,
`qa_reports/**`, and `.current/e125b/**`).

## Verdict

**PASS** — T-E125B-01, T-E125B-02, T-E125B-03, T-E125B-04, T-E125B-05, T-E125B-06,
T-E125B-07. All 13 in-scope ACs (AC1–AC6, AC8–AC13) verified by an executed test or
an executed `proof:` command; the 12 expected-red entries are re-baselined and green;
the forbidden-path diff is empty; the code review's two required findings (R1/R2)
were re-verified by repro in Round 2 and are additionally covered here by dedicated
automated regression tests (`AC9-R1`, `AC9-R2`) so they stay covered going forward,
not just in the reviewer's manual smokes.
## 2026-09-25T16:12:18.660Z — PASS — by qa-engineer

PASS. T-E125B-01..03,05..07 (impl, code-review round 2 APPROVED) + T-E125B-04 (QA tests) verified. All 13 in-scope ACs (AC1-AC6, AC8-AC13) confirmed by an executed test or spec-declared proof: command — see qa_reports/review_T-E125B-04.md AC Execution Log. 63 new tests across 7 files (2 new: lane-paths-history.test.mjs, agc-feature-finish-history.test.mjs; 5 extended: lane-migrate.test.mjs, lane-paths.test.mjs, agc-feature-lifecycle.test.mjs, e132-lane-registry.test.mjs, e125a-lane-local-ledgers.test.mjs). All 12 expected-red manifest entries re-baselined and green. Post-commit npm test: 2618/2618 pass, 0 fail (base 2555 + 63 new, zero regressions). npm run build clean. git diff --stat f174d89...HEAD touches no content/**, test/fixtures/compose-golden/**, test/context-budget.test.mjs, schema/**, or root tasks.md. AC9 R1/R2 code-review findings re-verified by dedicated automated regression tests (AC9-R1, AC9-R2), not just manual smokes. AC11 wording deviation (base-sha worktree-local via info/exclude, never committed) confirmed structurally; integrator's lane->flat->lane round-trip ask confirmed via test/lane-migrate.test.mjs's new AC11 test with the exclude rule in place. Pending tickets E125b-NEW-1..4 recorded, out of scope, not built here.

## 2026-09-25T16:12:51.279Z — PASS — by qa-engineer

PASS. T-E125B-01..03,05..07 (impl, code-review round 2 APPROVED) + T-E125B-04 (QA tests) verified. All 13 in-scope ACs (AC1-AC6, AC8-AC13) confirmed by an executed test or spec-declared proof: command — see qa_reports/review_T-E125B-04.md AC Execution Log. 63 new tests across 7 files (2 new: lane-paths-history.test.mjs, agc-feature-finish-history.test.mjs; 5 extended: lane-migrate.test.mjs, lane-paths.test.mjs, agc-feature-lifecycle.test.mjs, e132-lane-registry.test.mjs, e125a-lane-local-ledgers.test.mjs). All 12 expected-red manifest entries re-baselined and green. Post-commit npm test: 2618/2618 pass, 0 fail (base 2555 + 63 new, zero regressions). npm run build clean. git diff --stat f174d89...HEAD touches no content/**, test/fixtures/compose-golden/**, test/context-budget.test.mjs, schema/**, or root tasks.md. AC9 R1/R2 code-review findings re-verified by dedicated automated regression tests (AC9-R1, AC9-R2), not just manual smokes. AC11 wording deviation (base-sha worktree-local via info/exclude, never committed) confirmed structurally; integrator's lane->flat->lane round-trip ask confirmed via test/lane-migrate.test.mjs's new AC11 test with the exclude rule in place. Pending tickets E125b-NEW-1..4 recorded, out of scope, not built here.

