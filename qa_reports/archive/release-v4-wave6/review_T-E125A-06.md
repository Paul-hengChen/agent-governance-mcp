# Review — T-E125A-01..07 (e125a-lane-local-ledgers)

covers: T-E125A-01, T-E125A-02, T-E125A-03, T-E125A-04, T-E125A-05, T-E125A-06, T-E125A-07

QA's own scope is T-E125A-06 (new test coverage) and T-E125A-07 (expected-red
triage) — see those sections below. T-E125A-01..05 (registry/schema,
forward migration, reverse migration, tw_* wiring, and the round-1/round-2
adversarial code-review pass) are sr-engineer's and code-reviewer's work,
already APPROVED (`review_reports/review_T-E125A-05.md`, round 2). This QA
pass is the PASS gate for the whole task set: Phase 1 below re-reads that
implementation end to end against the spec, and the new/re-baselined tests
below are QA's independent verification of it — this file is the vehicle
that completes all seven tasks together, per the dispatch brief.

Reviewer: qa-engineer (sonnet, Task-spawned). Feature: `e125a-lane-local-ledgers`.
Base commit under review: `df744ee` (feat(E125a): lane-local task ledgers —
tasks.md moves into `.current/<lane>/`). Code-review APPROVED round 2
(`review_reports/review_T-E125A-05.md`, covers T-E125A-01..04). Spec:
`specs/e125a-lane-local-ledgers.md` (AC1–AC14 incl. AC4b, AC6b); blueprint
`specs/e125a-lane-local-ledgers-architecture.md`.

## Expected-Red Diff

`qa_reports/expected-red_e125a-lane-local-ledgers.txt` exists (87 entries).
Ran the FULL suite BEFORE any re-baseline edit and diffed the actual red set
against the manifest:

```
node --test test/*.test.mjs
# tests 2517, pass 2430, fail 87
```

`diff` of `<sorted manifest test names>` vs `<sorted actual failing test
names>` was **empty** — the 87 actual reds are byte-for-byte the 87 manifest
entries, no more, no fewer.

**Phase 0.5: clean (87/87 manifest entries confirmed red, 0 unexplained
reds).**

## Phase 1 — Review

Read `tools/tasks-lane-migrate.ts`, `tools/tasks-file.ts`, `tools/config.ts`,
`tools/lane-paths.ts`, `tools/lane-migrate.ts`, `tools/metrics.ts`,
`tools/drift.ts`, `schema/versions.ts`, `schema/migrations-tasks.ts`,
`guards/file-lock.ts` end to end, and cross-checked every code path against
the spec's ACs and the architecture blueprint's Decision Records, building
33 new tests plus re-baselining 10 pre-existing test files against it (see
Phase 3.5 below and the file list). No correctness, security, or
architecture defect found beyond what round-2 code review already resolved
(O2-1..O2-4 remain open as optional, non-blocking, per that review).

**Copy Audit Gate (3a)**: the spec's Copy/Strings table has 6 rows (all
`authored-here`, no external source to drift against). Verified each
literal against the actual thrown/returned text via passing assertions in
the new test file: `tasks.index-notice` (AC4/AC7a), `tasks.feat-marker`
(AC5a/AC8), `tasks.ledger-absent` (AC6b, all three cases), `tasks
.ignored-lane-advisory` (AC4b), `tasks.migration-busy` (AC6 busy tests),
`tasks.refuse-lane-to-flat` (`test/lane-migrate.test.mjs`'s new AC2 case).
No drift, no coverage gap.

**Visual Audit Gate (3b) / Phase 1.5**: N/A — spec's Visual Tokens/Visual
Widgets tables are both `N/A` ("feature has no visual literals" / "no
non-primitive widgets"), no `design/<feature>.md` exists. Skipped per SOP,
zero overhead.

## AC Execution Log

Every AC in the spec carries a `proof:` annotation. Executed each command
(fresh, post-re-baseline) and recorded output/exit code:

| AC | proof command | result |
|---|---|---|
| AC1 | `node --test test/lane-paths.test.mjs` | exit 0, 58/58 pass |
| AC2 | `node --test test/lane-migrate.test.mjs` | exit 0, 38/38 pass |
| AC3 | `node --test test/schema-versions.test.mjs test/tasks-versioning.test.mjs` | exit 0, 42/42 pass |
| AC4 | `test/e125a-lane-local-ledgers.test.mjs` (AC4) | exit 0 (part of the 33/33 run below) |
| AC4b | `test/e125a-lane-local-ledgers.test.mjs` (AC4b, real `git init`+`.gitignore` for both `_primary` and a feat lane, plus a control) | exit 0 |
| AC5 | `test/e125a-lane-local-ledgers.test.mjs` (AC5a/AC5b) | exit 0 |
| AC6 | `test/e125a-lane-local-ledgers.test.mjs` (AC6, incl. two `TASKS_MIGRATION_BUSY` lock-order cases) | exit 0 |
| AC6b | `test/e125a-lane-local-ledgers.test.mjs` (AC6b(a)/(b)/(c) + the feat-on-v2-no-marker empty start) | exit 0 |
| AC7 | `test/e125a-lane-local-ledgers.test.mjs` (AC7a/AC7b) | exit 0 |
| AC8 | `test/e125a-lane-local-ledgers.test.mjs` (AC8, incl. missing-LAST-marker, duplicated, out-of-order, receipt-missing, body-changed, not-an-index) | exit 0 |
| AC9 | `test/e125a-lane-local-ledgers.test.mjs` (AC9) | exit 0 |
| AC10 | `node --test test/success-metrics.test.mjs test/drift-skew.test.mjs` plus the AC9 test | exit 0, 44/44 pass (success-metrics + drift-skew); AC9 above also exit 0 |
| AC11 | `test/e125a-lane-local-ledgers.test.mjs` (AC11, incl. explicit R-1 snapshot-carry assertion) | exit 0 |
| AC12 | `npm test` (SQLite suites green) | exit 0, part of the full 2555/2555 run below — no lane-local `tasks.md` created/read in SQLite mode, confirmed by inspection (`tools/storage-sqlite.ts` untouched by this feature) |
| AC13 | `git status --porcelain \| wc -l` → `0`, then `npm test` exits 0 | see "Post-commit full run" below (run AFTER the lane-protocol commit, per SOP ordering) |
| AC14 | new cases in `test/e125a-lane-local-ledgers.test.mjs` (AC14-1 feat-first + AC14-1(d) add-refusal + AC14-2 primary-first + AC14-3 metrics dedup) | exit 0 |

`test/e125a-lane-local-ledgers.test.mjs` alone: **33/33 pass**, exit 0.

## T-E125A-06 — new/updated test coverage

- **Created** `test/e125a-lane-local-ledgers.test.mjs` (33 tests): AC4, AC4b
  (3 fixtures — ignored `_primary` real-git, ignored feat-lane real-git with
  a genuine `git init`+`.gitignore`+`git symbolic-ref HEAD`, and a
  non-ignored real-git control, plus a no-`.git` control), AC5a/AC5b, AC6
  (idempotency ×2, `TASKS_MIGRATION_BUSY` lock-order ×2 — inner legacy lock
  and outer lane lock, both fast-failed via a same-PID lock payload per R-3,
  no 3s wait needed), AC6b (all three `TASKS_LEDGER_ABSENT` cases — (a)
  `_primary` v2 index, (b) feat-lane marker, (c) newer-than-CURRENT legacy
  file, each asserting all 4 readers + 4 mutators throw/reject and that no
  lane ledger is ever created — plus the AC14(b) empty-start control), AC7a/
  AC7b (round trip, incl. a completed-row + a lane-added row surviving
  reverse, and an mtime-only-changed no-op round trip), AC8 (six refusal
  shapes: not-an-index, body-changed-since-forward, receipt missing, last
  marker missing, duplicated marker, out-of-order marker), AC9 (mutators
  touch only the lane, root byte-identical + mtime-unchanged across 5
  mutator calls; an unmigrated feat lane's first add creates the ledger and
  never touches root), AC11 (a pre-migration freshness snapshot survives the
  triggering mutation AND a second same-session mutation; a dedicated R-1
  assertion that `verifyFreshness` against the NEW lane path never throws
  right after a read-path migration), AC14 (the feat-first stale-duplicate
  fixture — `_primary`'s read/complete paths never see or touch the
  foreign `e999`-owned id; the AC14(d) add-refusal under a foreign section
  name; the primary-first fixture — a lane forking after a v2 root starts
  empty (D13); `emitFeatureMetrics`'s id-dedup across `_primary`'s stale
  copy and `e999`'s own ledger).
- Fixtures live under `os.tmpdir()` only (`fs.mkdtempSync`), never the repo
  root. Feat-lane fixtures that don't need a REAL git ignore-check use a
  FAKE `.git` (a bare directory + a hand-written `HEAD` file) — sufficient
  because `resolveCurrentLane` is pure-fs and `isLanePathIgnored` treats any
  `git check-ignore` spawn failure (including "not a git repository") as
  "not ignored," the exact fallback a no-`.git` workspace also takes. AC4b
  specifically needs a REAL `git init` (plus, for the feat-lane fixture,
  `git symbolic-ref HEAD refs/heads/feat/e999-x` — no commit required)
  because it is the one place a genuine `.gitignore` must be consulted.
- Byte-exact assertions (AC4, AC5a, AC7a/b, the AC6b error-message shapes,
  the AC9 mutation trace, the AC14-3 metrics count) were derived by first
  running the real compiled code against each fixture and capturing its
  actual output (`node --input-type=module -e '...'` against `dist/`), then
  embedding that verified ground truth into the assertions — not
  hand-derived from reading the source, to eliminate a guess-and-fix loop on
  multi-line marker/sentinel byte layouts.
- **Updated** `test/lane-paths.test.mjs`: REG1 (6→7 entries, `tasks` entry
  + `noFlatCounterpart:true` assertion), a new AC1 case for
  `LanePaths.tasksPath`, and CALLERS2/CALLERS3 allow-lists gained
  `tools/tasks-lane-migrate.ts`, `tools/config.ts`, `tools/tasks-file.ts`
  (verified via `grep -rln "lane-paths"` / `grep -rln "resolveCurrentLane"`
  against the real tree before allow-listing — no blind addition).
- **Updated** `test/lane-migrate.test.mjs`: introduced `MOVABLE_FILENAMES`/
  `MOVABLE_OPTIONAL_FILENAMES` (LANE_FILES minus the `noFlatCounterpart`
  `tasks` entry) and repointed FL1/FL2/REV1/REV2/AC5-DEBRIS1-4/RT1/COUNT1/
  COUNT2 at them instead of the raw (now 7-entry) `ALL_FILENAMES`/
  `OPTIONAL_FILENAMES` — those assertions were about what the E123 runners
  actually move, which never included `tasks.md` even before it existed in
  the registry, so this is a re-scoping to the registry's own
  `noFlatCounterpart` flag, not a weakening. Added 4 new AC2 cases: a flat
  `tasks.md` is neither moved nor read by `migrateFlatToLane`;
  `hasFlatLaneFiles` ignores a flat `tasks.md` on its own (with a positive
  control proving the predicate itself still works); `migrateLaneToFlat`
  refuses outright while the lane dir holds `tasks.md`, naming the tasks
  reverse runner; a leftover `tasks.md.lock` on its own is tolerable debris.
- **Updated** `test/schema-versions.test.mjs`: `CURRENT_VERSIONS.tasks`
  assertion 1→2; "applies single v0→v1 step" retargeted from `kind:"tasks"`
  to `kind:"config"` (config is still v1-targeted, preserving the "exactly
  one step" intent this test exists to pin, since tasks now needs two
  steps to reach CURRENT); "threads payload through steps" rewritten to
  register BOTH real tasks steps (v0→v1→v2) with an explicit mid-step
  input/output identity check — strictly stronger than the original
  single-step version, not weaker.

## T-E125A-07 — expected-red triage (87 entries, 10 files)

Every stale-fixture assumption traced to its root cause and fixed at the
fixture level, never by relaxing an assertion. Per file:

- **`test/schema-versions.test.mjs`** (3): see above — version-literal and
  target-kind updates only; no assertion removed or weakened.
- **`test/drift-skew.test.mjs`** (1): `T32 AC-6: future tasks sentinel
  surfaces as drift reason` — updated the expected regex from `server max
  v1` to `server max v2`. Same assertion, same fixture, new constant.
- **`test/lane-paths.test.mjs`** (3), **`test/lane-migrate.test.mjs`**
  (11): see above.
- **`test/tasks-versioning.test.mjs`** (11): every fixture rewritten to
  write/read `.current/_primary/tasks.md` directly instead of a root
  `tasks.md` (no `.git` in these fixtures ⇒ lane `_primary`). This was the
  reviewer's own suggested re-baseline
  (`review_reports/review_T-E125A-05.md`, "Expected-Red Sampling"): these
  tests are about the sentinel/versioning CONTRACT tasks-file.ts enforces
  on whatever file it actually reads, not about the D-C migration mechanism
  (which has its own dedicated AC4/AC5/AC6/AC7/AC8 coverage in the new
  file) — operating directly on the lane path sidesteps an irrelevant
  migration step without touching what each test actually asserts.
  `SENTINEL_LINE` updated 1→2 throughout; the "still matches as v1" boundary
  test's fixture literal changed to `2` (CURRENT) to keep testing what it
  always tested — whitespace-tolerant parsing of the file's OWN declared
  version, not a hardcoded "1".
- **`test/tasks.test.mjs`** (5): `readTasks()` now falls back from root to
  the lane path (`.current/_primary/tasks.md`) if the lane file exists —
  the root fixture these tests seed (unstamped, i.e. v0) auto-migrates on
  first access exactly like a real adopter's file would; the test's own
  assertions (does `completeTask`/`rollbackTask` do the right thing) are
  unchanged, only WHERE the mutation is read back from.
- **`test/e117-void-task.test.mjs`** (18), **`test/e120-void-recut-
  refusal.test.mjs`** (16), **`test/e121-tasks-file-injection.test.mjs`**
  (17): all three seed their fixture directly at
  `.current/_primary/tasks.md` now, stamped `CURRENT_VERSIONS.tasks` (2).
  Previously they stamped a ROOT file at `CURRENT_VERSIONS.tasks`, which —
  now that CURRENT is 2 — is the D-D "index" shape at a legacy path, not an
  unmigrated ledger; `tw_*` would throw `TASKS_LEDGER_ABSENT` (AC6b) trying
  to read it, exactly the failure mode the round-2 review predicted for this
  fixture class. These files are about void/injection-guard semantics, not
  migration mechanics, so — same call as tasks-versioning above — the
  fixture now targets the file tw_* actually reads post-e125a directly.
  `e121`'s `lockExists()` helper was repointed at the lane lock path too
  (`${laneTasksPath}.lock`), since mutators now lock the lane ledger, never
  a legacy path.
- **`test/e31-config-nonfatal.test.mjs`** (2): both are genuine, reviewer-
  confirmed intentional behaviour changes (D-F), not regressions —
  re-baselined to assert the NEW correct contract rather than deleted or
  weakened:
  - *"corrupting config after the precondition read"*: once the
    precondition `parseTasksFromFile` call has migrated the custom file
    into the lane ledger, subsequent config corruption can no longer
    un-discover the FILE (tw_* reads only the lane copy from then on,
    spec D-F/AC9) — this is a strict improvement over the pre-e125a defect
    the test used to pin. Re-baselined to assert the file stays
    discoverable (`tasks` is an array, not `null`). A second-order effect
    surfaced during re-baselining and is now asserted explicitly: the
    custom taskPattern is ALSO lost with the corrupted config, so the
    custom-format ROW no longer parses under the reverted
    `DEFAULT_TASK_REGEX` (`tasks.length === 0`) — two independent,
    already-documented E31 degradations compose here, neither is a crash.
  - *"addTaskInFile against a config-degraded workspace"*: the fallback
    target itself moved from flat `.current/tasks.md` to the lane-local
    `.current/_primary/tasks.md` — re-baselined the expected `result.path`
    accordingly, plus an added assertion that the OLD flat fallback path is
    NOT created either (confirming the fallback moved, not just gained a
    second candidate). The core "documented fallback, not fixed" claim
    (configured custom path is still never used) is unchanged and still
    asserted.

No entry in the manifest turned out to be a genuine regression — every one
was a stale fixture assumption, confirmed by tracing the actual on-disk
shape each fixture produced against the new v2/lane-local semantics before
touching the assertion.

## Post-commit full run

Per lane protocol §3: test files + this report were committed first
(`e8d4ead`), then the resulting `.current/e125a/` churn from the QA
claim-review `tw_update_state` write was committed separately (`e5c8796`),
`git status --porcelain` confirmed 0 lines (fully clean), and only THEN was
the full suite run against the committed tree:

```
npm test    # exit 0 — tests 2555, pass 2555, fail 0
npm run build   # exit 0 — tsc clean, check:transitions-sync OK
git status --porcelain | wc -l   # 0 (build produced no dist drift)
```

HEAD at the time of this run: `e5c8796`.

## Verdict

**PASS** for T-E125A-01 through T-E125A-07. All 87 expected-red entries
re-baselined with no assertion weakened; 33 new tests added covering every
`proof:`-annotated AC this lane owns; zero regressions found; full suite
green post-commit (2555/2555).
## 2026-09-25T13:48:20.804Z — PASS — by qa-engineer

PASS. Phase 0.5 expected-red diff clean pre-re-baseline (87/87 manifest entries confirmed red, 0 unexplained). Wrote test/e125a-lane-local-ledgers.test.mjs (33 tests) covering AC4-AC11, AC4b, AC6b, AC8, AC14 per specs/e125a-lane-local-ledgers.md, ground-truthed against the real dist/ output before asserting byte-exact shapes. Re-baselined all 87 expected-red tests across 10 files (schema-versions, tasks-versioning, lane-paths, lane-migrate, drift-skew, tasks, e117-void-task, e120-void-recut-refusal, e121-tasks-file-injection, e31-config-nonfatal) with no assertion weakened — full per-file breakdown in qa_reports/review_T-E125A-06.md. No regressions found; the two e31-config-nonfatal re-baselines reflect a genuine, reviewer-confirmed intentional D-F behaviour change, not a defect. Copy Audit Gate clean (6/6 Copy strings verified against actual output). AC Execution Log: every proof:-annotated AC's command run and recorded, all exit 0. Post-commit (HEAD e5c8796 at run time; docs commit 62e5a1a after): npm test 2555/2555 pass, npm run build clean, git status --porcelain 0 lines.

## 2026-09-25T13:48:55.913Z — PASS — by qa-engineer

PASS. Expected-Red Diff clean pre-re-baseline (87/87 manifest entries confirmed red, 0 unexplained). Wrote test/e125a-lane-local-ledgers.test.mjs (33 tests) covering AC4-AC11, AC4b, AC6b, AC8, AC14 per specs/e125a-lane-local-ledgers.md, ground-truthed against the real dist/ output before asserting byte-exact shapes. Re-baselined all 87 expected-red tests across 10 files (schema-versions, tasks-versioning, lane-paths, lane-migrate, drift-skew, tasks, e117-void-task, e120-void-recut-refusal, e121-tasks-file-injection, e31-config-nonfatal) with no assertion weakened — full per-file breakdown in qa_reports/review_T-E125A-06.md. No regressions found; the two e31-config-nonfatal re-baselines reflect a genuine, reviewer-confirmed intentional D-F behaviour change, not a defect. Copy Audit Gate clean (6/6 Copy strings verified against actual output). AC Execution Log: every proof:-annotated AC's command run and recorded, all exit 0. Post-commit npm test 2555/2555 pass, npm run build clean, git status --porcelain 0 lines.

