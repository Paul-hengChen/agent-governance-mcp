covers: T-E132-01, T-E132-02, T-E132-03, T-E132-04, T-E132-05

# QA review — e132-lane-registry

qa-engineer, crash-resume dispatch (a prior qa-engineer dispatch died mid-task
with zero durable output — verified absent by the coordinator before this
dispatch: `test/e132-lane-registry.test.mjs` did not exist, `test/feature-rollup.test.mjs`
was byte-unmodified vs `e784a3b`, no qa_reports evidence, no `completed_tasks`
growth). This report and its accompanying tests are the entirety of the QA
work product for T-E132-01 through T-E132-05.

Reviewed: `tools/feature-rollup.ts`, `tools/lane-registry.ts` (new),
`tools/handoff-parse.ts`, `scripts/feature-rollup.mjs` against
`specs/e132-lane-registry.md` AC1-AC10, plus `review_reports/review_T-E132-04.md`
(round 1 APPROVED-with-fixes at line ~429, round 2 APPROVED at line ~433/773)
and its 12 named coverage gaps.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e132-lane-registry.txt` manifest declared
— `dispatch_mode` is absent/"feature", not "bugfix"). Zero overhead per SOP.

## Phase 1 — Review

code-reviewer already performed the correctness/architecture review across
two rounds (round 1 CHANGES_REQUESTED on three findings — C1 stderr
inheritance, C2 CRLF block-collapse, C3 false "moved on" claim — all three
fixed and re-verified empirically by round 2's fresh-context reviewer;
round 2 APPROVED). I independently read all four touched files
(`tools/feature-rollup.ts`, `tools/lane-registry.ts`, `tools/handoff-parse.ts`,
`scripts/feature-rollup.mjs`) against the spec's Design section and confirm
the implementation matches: the two-entry-point cost-profile split
(`laneRegistryList` for the roll-up, `getLaneFeatureHistory`-skipping
`getLaneRegistrySummary` for `tw_get_state`), the documented 3-module import
cycle comment, the `null` vs `[]` `featureHistory` distinction, and the
degrade-honestly precedence chain in `computeFeatureRollup` all match the
spec verbatim. No new correctness/architecture findings — QA's job here is
coverage (§ SOP scope), which is this report's substance below.

### Copy Audit Gate / Visual Audit Gate

N/A — spec's own Copy/Strings and Visual Tokens tables both state "feature
is internal governance tooling/prose... not user-facing product copy" /
"feature has no visual literals." No drift, no coverage gap possible.

## Phase 1.5 — Visual Compare

Skipped (no `design/e132-lane-registry.md`, no Visual Baselines declared).

## Phase 3 — Tests

### Test-file placement

Per dispatch brief: NEW `test/e132-lane-registry.test.mjs` (pre-authorized),
EXTEND existing `test/feature-rollup.test.mjs`. No other test file created or
touched. `test/token-efficiency.test.mjs` untouched (sibling E112 lane has
uncommitted edits there).

### Spec-to-Test map

| AC | Test(s) | File |
|---|---|---|
| AC1 (read-only) | `AC1: laneRegistryList performs zero filesystem writes...` | e132-lane-registry.test.mjs |
| AC2 (provider + consumed) | `AC2: laneRegistryList returns source:"lane-registry"...` | e132-lane-registry.test.mjs |
| AC3 (tw_get_state wiring) | `AC3: ...ABSENT...`, `AC3: ...PRESENT...`, `gap-7: both readHandoffState() returns...` | e132-lane-registry.test.mjs |
| AC4 (cost ceiling) | `AC4: getLaneRegistrySummary never blocks or throws...`, `gap-6: the ceiling bounds only the git subprocess...` | e132-lane-registry.test.mjs |
| AC5 (N not 2N reads) | `AC5 (E132): computeFeatureRollup prefers the provider's completedTasks...` | feature-rollup.test.mjs |
| AC6 (historical-only match) | `AC6 (E132): a lane whose featureHistory includes featureId...` | feature-rollup.test.mjs |
| AC7 (degrade-honestly) | `AC7: ...featureHistory:null...`, `AC7: ...skips a malformed archive file...` | e132-lane-registry.test.mjs |
| AC8 (no writes) | `AC8: tools/lane-registry.ts performs no fs writes...` | e132-lane-registry.test.mjs |
| AC9 (build + boot) | `AC9: dist/index.js boots cleanly...` (boot half); `npm run build` (Gate 1, this report) | e132-lane-registry.test.mjs + Gate 1 |
| AC10 (full suite + boundaries) | full `npm test` (Gate 3) + two-dot diff / `ls-files --others` (Gate 4) | this report |

### Code-reviewer's 12 coverage gaps — disposition

All 12 covered. Gap numbering per `review_reports/review_T-E132-04.md` round 2
(:705), which supersedes round 1's numbering for gaps 1/3 (refined) and adds
8-12.

| gap | covered by | file |
|---|---|---|
| 1 (C1, two-sided stderr) | `gap-1 (C1, two-sided): ...` | feature-rollup.test.mjs |
| 2 (C2, CRLF == LF) | `gap-2 (C2): CRLF-terminated porcelain...` | feature-rollup.test.mjs |
| 3 (C3 refined) | `gap-3 & gap-10 (C3, refined + adversarial): ...` | feature-rollup.test.mjs |
| 4 (sharpest — archive-scan skip) | `gap-4 (sharpest): getLaneRegistrySummary skips the archive scan entirely...` | e132-lane-registry.test.mjs |
| 5 (branch extraction) | `gap-5: branch is extracted from 'branch refs/heads/<name>'...` | feature-rollup.test.mjs |
| 6 (AC4 ceiling e2e) | `gap-6: the ceiling bounds only the git subprocess...` | e132-lane-registry.test.mjs |
| 7 (both readHandoffState returns) | `gap-7: both readHandoffState() returns...` | e132-lane-registry.test.mjs |
| 8 (flush() control flow) | `gap-8 (C2's flush() rewrite): ...` | feature-rollup.test.mjs |
| 9 (terminal shapes) | `gap-9: porcelain terminal shapes...` | feature-rollup.test.mjs |
| 10 (C3 adversarial combo) | same test as gap 3 (`gap-3 & gap-10`) | feature-rollup.test.mjs |
| 11 (C3 positive control) | covered by the AC6 test (same fixture shape: readable moved-on lane, degraded:true + note line) | feature-rollup.test.mjs |
| 12 (Q2 predicate parity) | `gap-12 (Q2, predicate parity): ...` | feature-rollup.test.mjs |

### Method notes (for the next reader)

- **node:test's `mock.method` cannot intercept this codebase's compiled ESM
  exports** — verified empirically (`Cannot redefine property: readdirSync`
  when attempting to mock `fs.readdirSync`, and the same failure mode applies
  to `child_process.execFileSync`). Every gap that needed to control git's
  output or timing (C1/C2/C3 combos, branch extraction, flush() control flow,
  terminal shapes, the AC4 hang, gap-6, gap-4) instead uses a real, small,
  executable `git` shim placed on `PATH` — a real subprocess, real bytes, no
  interception. Gap 4 (archive-scan skip) is proven via a real, large sentinel
  `.current/archive/` directory plus a timing contrast against `laneRegistryList`
  (which DOES scan it) rather than via source-text inspection, per the
  dispatch brief's explicit steer against the brittle regex approach the dead
  dispatch was attempting.
- **AC5's proof deliberately does not spy on `parseHandoff`'s call count**
  (also unmockable) — instead it deletes the on-disk `handoff.md` after
  building the provider fixture, so a stray second read fails loudly
  (`readable` flips to `false`) rather than silently succeeding. This is a
  stronger, more deterministic proof of "no second read happened" than a call
  counter would be.
- **Two environment-specific timing flakes were found and fixed during this
  dispatch** (not defects in the code under test): (1) the very first exec of
  a freshly-written shell script in this sandboxed dev environment
  consistently costs ~200ms+ (confirmed via isolated repro), which was
  defeating `AC3`/`gap-7`'s reliance on `readHandoffState`'s default 200ms
  ceiling — fixed by warming up each fake-git shim with one throwaway
  invocation before the timed assertion. (2) `gap-6`'s original small-N-vs-
  large-N wall-clock comparison was too close (tiny real handoff.md files
  parse in single-digit ms even at 25 lanes) and flaked ~4/15 runs — fixed by
  padding fixture `completedTasks` to make each lane's real read cost
  dominate scheduler noise, and taking the min of 3 trials per side. Both
  fixes were validated with 15-20 repeated runs post-fix (0 failures) before
  being considered closed; see the tests' own header/inline comments for the
  measured numbers.

## Phase 3.5 — AC Execution Log

Each spec-declared `proof:` line executed directly (test names below are this
file's actual titles — the spec's own proof lines predate the tests and name
them slightly differently; `node --test`'s `-t`/`--test-name-pattern` did not
filter as expected in this Node 22 install, so each command below ran the
full file and the specific test's `ok`/`not ok` line is what's recorded).

| AC | command | result |
|---|---|---|
| AC1 | `node --test test/e132-lane-registry.test.mjs` | `ok 1 - AC1: laneRegistryList performs zero filesystem writes anywhere under any worktree (mtime-snapshot proof, verified by execution)` — PASS |
| AC2 | `node --test test/e132-lane-registry.test.mjs` | `ok 2 - AC2: laneRegistryList returns source:"lane-registry", AND scripts/feature-rollup.mjs's output proves IT (not localFallbackLaneList) supplied the provider` — PASS |
| AC3 | `node --test test/e132-lane-registry.test.mjs` | `ok 3` (absent case) and `ok 4` (present case) both PASS; `ok 5` (gap-7, both readHandoffState returns) PASS |
| AC4 | `node --test test/e132-lane-registry.test.mjs` | `ok 6 - AC4: getLaneRegistrySummary never blocks or throws...` — PASS; stub is a real sleeping `git` shim, not execFileSync mocking |
| AC5 | `node --test test/feature-rollup.test.mjs` | `ok 12 - AC5 (E132): computeFeatureRollup prefers the provider's completedTasks...` — PASS |
| AC6 | `node --test test/feature-rollup.test.mjs` | `ok 13 - AC6 (E132): a lane whose featureHistory includes featureId...` — PASS |
| AC7 | `node --test test/e132-lane-registry.test.mjs` | `ok 9` (null vs absent archive) and `ok 10` (malformed-file skip) both PASS |
| AC8 | `node --test test/e132-lane-registry.test.mjs` | `ok 11 - AC8: tools/lane-registry.ts performs no fs writes...` — PASS; corroborated by `grep -nE "fs\.(write|append|mkdir)" tools/lane-registry.ts` printing nothing |
| AC9 | `npm run build` then `node --test test/e132-lane-registry.test.mjs` | `npm run build` exit 0 (tsc + check:version + check:transitions-sync all OK); `ok 12 - AC9: dist/index.js boots cleanly...` — PASS |
| AC10 | `npm test` (full suite) + `git diff e784a3b -- tools/drift.ts content/ scripts/verify-release.mjs docs/backlog.md` | see Gate 3/Gate 4 below — both clean |

All ten proofs pass. No proof could not be run; no proof's observed outcome
contradicts its AC text.

## Phase 4 — Gate sequence

1. **`npm run build`** — exit 0 (tsc clean; `check:version` OK at 3.114.0;
   `check:transitions-sync` OK, 21 keys exact match).
2. **`npm audit --audit-level=high`** — 6 findings: 2 low (body-parser,
   esbuild) + 4 moderate (hono, protobufjs, qs) — **zero HIGH/CRITICAL**.
   Matches the `e784a3b` baseline exactly per the dispatch brief (lockfile
   byte-identical to base, independently confirmed by code-reviewer round 2
   and re-confirmed here). No new advisory disposition needed.
3. **Full `npm test`** — **2177/2177 pass, 0 fail, 0 skipped, 0 cancelled,
   0 todo.** Baseline before this dispatch's tests: 2156/2156. Delta: +21
   (12 new in `test/e132-lane-registry.test.mjs` + 9 net-new appended to
   `test/feature-rollup.test.mjs`, whose original 11 tests remain
   byte-unmodified). `test/token-efficiency.test.mjs` did NOT fail (no E112
   interaction observed).
4. **Boundary checks** (two-dot form, per the dispatch brief's own steer that
   `HEAD` is still `e784a3b` and three-dot diffs would pass vacuously):
   - `git diff e784a3b -- tools/drift.ts content/ scripts/verify-release.mjs tools/storage-sqlite.ts test/token-efficiency.test.mjs docs/backlog.md` → **empty**.
   - `git ls-files --others --exclude-standard` → only expected untracked
     paths from this feature's own cut (`tools/lane-registry.ts`,
     `dist/tools/lane-registry.{js,d.ts}(.map)`, `specs/e132-lane-registry.md`,
     `review_reports/review_T-E132-04.md`, this dispatch's own
     `test/e132-lane-registry.test.mjs`) plus one pre-existing, pre-dated
     (mtime 11:21, before this dispatch started) stray
     `.current/archive/e142-release-tooling-wave25...md` file that is not
     part of this feature's cut and not touched by it — left alone, not
     mine to clean up.
   - No `docs/backlog.md` done-marks made (release-engineer's job, post-PASS,
     per SOP).

## Definition-of-done disposition (per dispatch brief)

1. **Read-only module derived from git worktree metadata, verified by
   execution** — CONFIRMED. `tools/lane-registry.ts` delegates all worktree
   enumeration/handoff parsing to `localFallbackLaneList`; AC1's test proves
   zero filesystem mutation via a real mtime-snapshot diff across the call,
   not by reading the source.
2. **`LaneListProvider` implemented and E113's roll-up actually consuming
   it** — CONFIRMED. `laneRegistryList` type-checks against `LaneListProvider`
   (compile-time assertion in the source) and AC2's test proves
   `scripts/feature-rollup.mjs` behaviorally uses it (not merely imports it)
   by observing the historical-only-match note line, which only
   `laneRegistryList`'s `featureHistory` attachment can produce.
3. **Wired into the `tw_get_state` return** — CONFIRMED. `tools/handoff-parse.ts`
   spreads `lane_registry` into both `readHandoffState` returns; AC3 (present)
   + gap-7 (both returns) prove this by executing this worktree's own compiled
   `readHandoffState` directly (never through the live PRIMARY-checkout MCP
   server, per the dispatch brief's documented trap #1). AC3 (absent) proves
   byte-identical output in the non-fan-out case.
4. **Each of E113's three hand-forward items explicitly dispositioned**:
   - Item 1 (provider bypass) — FIXED, AC5-tested (`AC5 (E132)` test).
   - Item 2 (2N reads) — FIXED as a consequence of item 1's fix; same test
     proves it via the delete-after-build technique (a stray second read
     would have found nothing, since the file no longer exists).
   - Item 3 (silent under-report) — FIXED, scoped narrow per the spec's own
     stated decision (visibility, not retroactive arithmetic); AC6-tested,
     with the C3 false-positive/false-negative combinations additionally
     covered by gaps 3/10/11.

No skips. No error-laden PASS. All 21 new tests pass; all 2177 suite tests
pass; both build gates clean; boundary checks clean.

## Verdict

**PASS.**
## 2026-09-22T06:00:20.933Z — PASS — by qa-engineer

PASS. Crash-resume dispatch — prior qa-engineer died mid-task with zero durable output; all work here is fresh. Wrote NEW test/e132-lane-registry.test.mjs (12 tests: AC1,AC2,AC3x2,AC4,AC7x2,AC8,AC9 + gaps 4/6/7) and EXTENDED test/feature-rollup.test.mjs (+9 tests: AC5,AC6 + gaps 1/2/3/5/8/9/10/11/12; original 11 tests byte-unmodified). All 12 code-reviewer coverage gaps covered — full disposition table in qa_reports/review_T-E132-05.md. Gate 1 npm run build exit 0. Gate 2 npm audit: 6 findings (2 low + 4 moderate), zero HIGH/CRITICAL, matches e784a3b baseline exactly. Gate 3 full npm test: 2177/2177 pass (baseline 2156 + 21 new), 0 fail/skip. Gate 4 boundary checks clean (two-dot diff + ls-files --others, per the uncommitted-cut trap). Two environment-specific test timing flakes found and fixed during this dispatch (fake-git first-exec cold-start ~200ms in this sandbox, and a too-tight small-vs-large lane-count timing margin) — both validated stable across 15-20 repeat runs post-fix; documented in the review doc's Method notes. DoD: (1) read-only, verified by execution (mtime-snapshot, not source-read) — CONFIRMED. (2) LaneListProvider implemented + actually consumed by scripts/feature-rollup.mjs, proven behaviorally via the featureHistory note line only laneRegistryList can produce — CONFIRMED. (3) wired into tw_get_state, verified via this worktree's own compiled readHandoffState (not the live PRIMARY-checkout server) — CONFIRMED both present and absent cases, both JSON return shapes. (4) all three E113 hand-forward items explicitly dispositioned and tested (AC5/AC6). No skips, no error-laden PASS. cut_approved not touched by me. Full detail: qa_reports/review_T-E132-05.md.

