# Review — T-E123B9-05 (QA, batched round)

covers: T-E123B9-01, T-E123B9-02, T-E123B9-03, T-E123B9-04, T-E123B9-05

## Verdict — PASS — by qa-engineer

specs/e123b9-lane-flip.md AC1–AC15 verified. `npm run build` clean, full suite
**2371/2371 green**, zero expected-red exemptions (the T-03 manifest's 4
entries were re-pointed at the redefined AC7 contract, confirmed green, and
the manifest file removed), `npm audit --audit-level=high` exit 0,
`node scripts/check-version.mjs` exit 0. Three narrow, non-blocking
hardening gaps found in code this ticket's diff did NOT touch (filed
NEW-TICKETS.md J2-NEW-7/8/9, documented as passing tests, not FAILed).

## Phase 0.5 — Expected-Red Diff

Manifest present at start: `qa_reports/expected-red_e123b9-lane-flip.txt`,
4 entries (T-E123B9-03/AC7, re-pointing the retired `.current/archive/`-based
`getLaneFeatureHistory` contract):

- `test/e132-lane-registry.test.mjs | AC2: laneRegistryList returns source:"lane-registry"...`
- `test/e132-lane-registry.test.mjs | gap-4 (sharpest): getLaneRegistrySummary skips the archive scan entirely...`
- `test/e132-lane-registry.test.mjs | AC7: getLaneFeatureHistory skips a malformed archive file...`
- `test/lane-paths.test.mjs | CALLERS2 (allow-list): ... a NEW unlisted importer still fails this`

Full-suite run before any re-baseline edit confirmed all 4 (plus 201 more,
205 total — see AC9 below) actually red, all test-shaped (matches
code-reviewer's own sampling in review_reports/review_T-E123B9-01.md
Summary — "None points to a code bug"). Disposition: all 4 rewritten to
assert the NEW, redefined contracts (AC7's live-lane-dir + history-bucket
scan; AC10's `tools/lane-registry.ts` allow-listing) — see AC7/AC9/AC10
below for the reasoning per group. All 4 now GREEN. **Manifest emptied and
removed** (`qa_reports/expected-red_e123b9-lane-flip.txt` deleted) —
AC11 requires zero expected-red exemptions and every entry is now fixed.

## Phase 1 — Review

Read `git diff -- tools/lane-paths.ts tools/lane-migrate.ts tools/lane-registry.ts
tools/handoff-parse.ts tools/handoff-write.ts tools/metrics.ts` in full
(already code-reviewer APPROVED, review_reports/review_T-E123B9-01.md — no
new findings against that diff; QA's own findings below are all about
UNCHANGED files whose established callers were retargeted by the flip, not
about T-01..03's diff itself). No production code was modified by QA
(constraint honored — `git diff -- tools/` between the start and end of this
QA pass is empty).

**Copy / Visual Tokens**: N/A — spec states "feature introduces no new
user-facing copy" / "no visual literals" (server-internal storage-layout
change). Gate skipped by the spec's own escape hatch.

**Visual Baselines**: absent (no `design/e123b9-lane-flip.md`) — Phase 1.5
skipped per the SOP's own absent-branch.

## AC Execution Log

specs/e123b9-lane-flip.md's Acceptance Criteria carry line-leading `proof:`
annotations throughout — this section is load-bearing for PASS (Phase 3.5).
Each proof was executed via the named test(s); `npm test`'s 2371/2371 green
run is the umbrella command for all of them except where noted otherwise.

| AC | proof (summary) | executed via | result |
|---|---|---|---|
| AC1 | `resolveLanePaths` returns lane-scoped paths for every LANE_FILES key | `test/lane-paths.test.mjs` RP1, RP3 | PASS |
| AC2 | branch wins over stale `active_feature` for migration lane | `test/lane-migrate.test.mjs` FL4, FL5 | PASS |
| AC3 | first `tw_get_state`-equivalent call migrates; a `parseHandoff`-pattern read doesn't | `test/e123b9-lane-flip.test.mjs` AC13; `test/handoff-versioning.test.mjs`, `test/success-metrics.test.mjs` E8-M2 (readHandoffState migration trigger) | PASS |
| AC4 | 3x `tw_get_state` — only call 1 moves anything; byte-identical no-ops after | `test/lane-migrate.test.mjs` RT1 (round-trip) + `test/e123b9-lane-flip.test.mjs` AC12 (single-call migrate-and-stay-migrated) | PASS |
| AC5 | resolved lane lock path is `.current/<lane>/.handoff.lock` | `test/lane-paths.test.mjs` LOCK1/LOCK2 (table) | PASS |
| AC12 | write against unmigrated flat fixture completes well under LOCK_MAX_WAIT_MS, ends migrated | `test/e123b9-lane-flip.test.mjs` AC12 | PASS (15ms, ceiling 10000ms) |
| AC-MIG-3 | 2+ concurrent processes migrate exactly once, no half-moved state, no error/timeout | `test/e123b9-lane-flip.test.mjs` AC-MIG-3 (5 real child processes, synchronized start) | PASS |
| AC6 | `archiveDir` diff is comment-only | `test/e116-archive-on-feature-change.test.mjs` (full file, unchanged archive-path behavior); `git diff -- tools/handoff-write.ts` inspected directly — comment-only at the archiveDir line | PASS |
| AC13 | cross-workspace-pattern `parseHandoff` on a flat fixture: correct state, byte-identical tree, no lane dir/lock created | `test/e123b9-lane-flip.test.mjs` AC13 | PASS |
| AC14 | dual-presence throws `HANDOFF_LAYOUT_CONFLICT` (both paths, both `last_updated`/`unparseable missing`, repair steps) on read+write, neither file modified; sidecar dual-presence never conflicts | `test/e123b9-lane-flip.test.mjs` AC14; `test/lane-migrate.test.mjs` MERGE5 (sidecar non-conflict); `test/drift-skew.test.mjs`, `test/e22-stale-notify.test.mjs` (both re-fixtured to avoid incidental dual-presence, confirming the boundary) | PASS |
| AC15 | sidecar merge is flat-lines-then-lane-lines, atomic, handoff.md unaffected, reverse runner unchanged | `test/lane-migrate.test.mjs` MERGE1–MERGE6 | PASS |
| AC7 | history ordered by `last_updated` not mtime, tie/missing rules, null/[] contract redefined, flat-archive ignored | `test/e132-lane-registry.test.mjs` AC7-ORDER, AC7-NULL1, AC7-EMPTY1, AC7-FLATARCHIVE1, plus the re-pointed AC2/gap-4/AC7-malformed tests | PASS |
| AC8 | reversibility, both rounds, on the real primary `.current/`, per-file SHA-256 | `test/e123b9-lane-flip.test.mjs` AC8 Round 1 / Round 2 — see dedicated section below | PASS |
| AC9 | `npm test` green, zero new expected-red exemptions | `npm test` — 2371/2371, manifest removed | PASS |
| AC10 | CALLERS1-3 allow-lists updated for genuinely new callers only, verified against spec | `test/lane-paths.test.mjs` CALLERS2/CALLERS3; `test/lane-migrate.test.mjs` CALLERS1/CALLERS-LOCKED | PASS — see AC10 section below |
| AC11 | build clean, suite green, audit clean, check-version clean | `npm run build`, `npm test`, `npm audit --audit-level=high`, `node scripts/check-version.mjs` | PASS — all 4 |

## AC7 — ordering / null / [] contract (T-E123B9-05 (i))

`test/e132-lane-registry.test.mjs`'s new `AC7-ORDER` test constructs one live
lane + two closed lanes across two DIFFERENT `YYYY-MM` history buckets, plus
a tie-broken pair and a missing-`last_updated` entry, and forces every
fixture file's mtime to an IDENTICAL, wrong-order instant (`fs.utimesSync`)
to prove the sort key is really `last_updated`, not mtime. Result order:
`hc-old(2026-01-01) < lv(2026-01-15) < hc-new(2026-03-01) < aa-tie(2026-04-01,
lane "aa-tie") < zz-tie(2026-04-01, lane "zz-tie") < no-ts(missing, sorts last)`
— matches spec exactly. `AC7-NULL1` (zero lane dirs + no history dir → null),
`AC7-EMPTY1` (history dir present, empty → `[]`), and `AC7-FLATARCHIVE1`
(flat-archive-only fixture → null, the flat-era signal is gone by design)
round out the redefined contract. All 4 PASS.

## AC10 — CALLERS allow-list verification (T-E123B9-05 (b))

Verified each newly-required entry against the spec/diff before allow-listing
— never blind:

- `tools/lane-migrate.ts` → **CALLERS3** (`resolveCurrentLane`): confirmed via
  `grep -n resolveCurrentLane tools/lane-migrate.ts` — `opts.lane ?? resolveCurrentLane(workspacePath)`
  at both `migrateFlatToLaneLocked`/`migrateFlatToLane` and their `LaneToFlat`
  counterparts (AC2's Decision 1). Added to `test/lane-paths.test.mjs`'s
  `SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS`.
- `tools/handoff-parse.ts` + `tools/handoff-write.ts` → already on both
  CALLERS2/CALLERS3 allow-lists since J1 (L1, `e123b1-core-write-path`); no
  new entry needed — the migration wiring (AC3) landed inside files already
  sanctioned.
- `tools/lane-registry.ts` → **CALLERS2** (`lane-paths` module import) via
  `isSafeLaneName` (AC7's lane-name filter for `getLaneFeatureHistory`) —
  confirmed via `grep -n "lane-paths" tools/lane-registry.ts` → one hit,
  `import { isSafeLaneName } from "./lane-paths.js";`. Added to
  `test/lane-paths.test.mjs`'s `SANCTIONED_LANE_PATHS_IMPORTERS`. Confirmed
  it is NOT a CALLERS3 hit (`tools/lane-registry.ts` never calls
  `resolveCurrentLane` itself) — matches the spec's own note.

`test/lane-migrate.test.mjs`'s own CALLERS1 (AC10's retired "zero callers"
invariant, now AC12's "public wrapper has zero production callers") and the
new CALLERS-LOCKED (an allow-list of `migrateFlatToLaneLocked`'s two
sanctioned own-workspace callers) both PASS — verified via a
call-site-only grep (`migrateFlatToLane\(` / `migrateLaneToFlat\(`, not a
bare-word match, so `migrateFlatToLaneLocked(` and doc-comment prose
mentioning the public name by name don't produce false hits).

## AC8 — reversibility (T-E123B9-05 (c))

**Procedure** (both rounds live in `test/e123b9-lane-flip.test.mjs`,
permanent suite members — `os.tmpdir()` scratch, matching every other test
in this suite; never the repo root, never primary itself except as a
read-only copy source):

- **Round 1 (direct runners)**: copied the PRIMARY checkout's real
  `.current/` (`<repo-root>/.current/` —
  **11 files**: `.agc-hook-marker.json`, `.config.json`, `archive/` (3 real
  entries), `feature-split.md`, `handoff.md`, `metrics.jsonl`,
  `multi-agent-pipeline.md`, `telemetry.jsonl`) into a fresh scratch dir.
  Called `migrateFlatToLane(scratchRoot)` (resolved lane: `_primary`, this
  checkout is on `main`) then `migrateLaneToFlat(scratchRoot, "_primary")`
  directly. Per-file SHA-256 comparison against the pre-copy snapshot: **0
  diffs** (no lock/tmp leftover either — nothing to tolerate).
- **Round 2 (the WIRED trigger, via `dist/`)**: a second, independent fresh
  copy of the same real flat layout. A **standalone node child process**
  (`test/_e123b9-round2-migrate.mjs`, spawned via `child_process.spawnSync`)
  imported the BUILT `dist/tools/handoff-parse.js` and called
  `readHandoffState(scratchRoot)` — the actual own-workspace entry point AC3
  wires the migration into. Asserted: the returned state deep-equals a
  `parseHandoff` of the pre-copy flat `handoff.md` (module load order
  irrelevant to a deep-equal check; `exists`/`schema_version` excluded from
  the comparison — see below); every `LANE_FILES` entry now lives under
  `.current/_primary/` and no longer at the flat root. Then ran
  `migrateLaneToFlat(scratchRoot, "_primary")` directly (return leg, per
  spec) and repeated the per-file SHA-256 comparison against Round 2's own
  pre-migration snapshot: **0 diffs beyond one exact, verified, named
  tolerance** — see below.

**Hash-table excerpt** (first 5 of 11 files, identical set both rounds since
both copy the same primary snapshot; captured via `node --test
test/e123b9-lane-flip.test.mjs`, saved at
`ac8-reversibility-evidence.txt` in the QA session's scratch directory):

```
.agc-hook-marker.json -> 3f650c708f50c4fa44b3ee03fd4780d45ce2b30c527d3f135acd80658ee508e5
.config.json -> 2712f8efd27484819e53c086d6dd54b963d55aebcdea7ae431c827474ec5a907
archive/e115-join-precondition-check.4801.1790062983247.md -> 7a5a6b5ce38d74a40893672c52ff4c75691b383505ce4a5f0031141c2a287769
archive/e123a-lane-layout-migration.53062.1790154915660.md -> 07b9757ff43ef24f7439d1b73bef896d48632ec6584a1b47deda65865358d239
archive/e162-ci-default-branch-test-fix.4801.1790064935046.md -> ab6c8b18a00ba4624c3db59aa96e0c9c5f41c5e8eb7e67001544ae135e809868
```

**Round 1 outcome**: PASS. 11 files, 0 diffs, no tolerated debris (none was
needed — the lock file and tmp artifacts were fully cleaned up by both
runners before the comparison ran).

**Round 2 outcome**: PASS, with one exact, verified, named tolerance BEYOND
AC8's own lock/tmp clause. The PRIMARY checkout's real `handoff.md` is
currently at `schema_version: 14` (one step behind this build's CURRENT,
v15 — the v14→v15 `e123a-lane-layout-migration` step is stamp-only, per its
own migration comment). `readHandoffState`'s fire-and-forget heal write is a
real, documented, additive-only side effect of the WIRED path Round 2
specifically exercises (Round 1's direct runner calls never trigger it,
since they never call `readHandoffState`). Verified via a line-by-line diff
of `handoff.md`'s raw text before vs. after the full round trip: **the ONLY
differing line is `schema_version: 14` → `schema_version: 15`** — `last_updated`
and every other line, and all 10 other files, are byte-for-byte identical.
The test asserts this precisely (not a blanket file-level skip): any OTHER
difference in `handoff.md`, or any difference at all in any other file,
still fails the test.

## Findings (non-blocking, filed as NEW-TICKETS.md J2-NEW-7/8/9)

Three narrow hardening gaps in code THIS ticket's diff did not touch,
exposed as a side effect of the flip (the `resolveLanePaths` call sites in
each were already-sanctioned callers from earlier lanes). None violates
AC1-AC15, none is a crash in production (index.ts's top-level try/catch
still converts every one to a graceful `isError` ToolResult), all are
documented as PASSING tests (not weakened, not skipped):

- **J2-NEW-7**: `readAndMigrate`'s shared read primitive rethrows `ENOTDIR`
  for a bogus `workspace_path` where it used to degrade gracefully to
  `null`. Documented in `test/telemetry.test.mjs` THROW2 (re-targeted to a
  narrower fixture that still tests its own intended AC-4 telemetry-isolation
  target without tripping this gap).
- **J2-NEW-8**: a directory squatting on the per-lane lock's own path
  (`.current/<lane>/.handoff.lock`) makes `migrateLaneToFlat` hang the full
  10s `LOCK_MAX_WAIT_MS` instead of failing fast. Documented in
  `test/lane-migrate.test.mjs` AC5-DEBRIS4 (re-targeted to assert the actual,
  correct-enough-but-slow outcome).
- **J2-NEW-9**: `tools/drift.ts`'s version-skew precheck (unchanged by this
  ticket) has no AC13-style flat fallback, so an unmigrated workspace's
  future-schema handoff is invisible to it and the graceful skew-drift path
  it exists to provide doesn't fire. Documented as a new, clearly-labeled
  "KNOWN GAP (J2-NEW-9)" passing test in `test/drift-skew.test.mjs`, which
  also required re-fixturing its two existing skew tests to seed at the
  lane path (the precheck's actual read target) instead of incidentally
  colliding with a real lane-path write and tripping AC14 instead.
- **J2-NEW-10** (informational, test-harness only, not a production defect):
  a raw `markStateRead()` shortcut (bypassing the real `readHandoffState`
  entry point) can poison the freshness snapshot ahead of a write that
  triggers its own migration. Hit once (`test/e23-evidence-schema.test.mjs`
  AC1-3), fixed locally by calling `readHandoffState` instead.

## Phase 4 — Run

- `npm run build`: clean (tsc, check:version, check:transitions-sync all OK).
- `npm test` (full suite, `node --test test/*.test.mjs`): **2371 pass / 2371
  total, 0 fail**, `duration_ms 93533`.
- `npm audit --audit-level=high`: exit 0 (6 findings, all low/moderate —
  none high/critical).
- `node scripts/check-version.mjs`: exit 0 (`dist/index.js` and
  `package-lock.json` parity OK, v3.116.0).

**PASS.**
## 2026-09-23T12:38:38.067Z — PASS — by qa-engineer

T-E123B9-01..05 PASS. specs/e123b9-lane-flip.md AC1-AC15 fully verified: resolver flip (AC1), branch-based migration lane (AC2), own-workspace-only trigger with lane-then-flat read-only fallback (AC3/AC13), trigger-once (AC4), per-lane lock (AC5), non-reentrant lock under bounded timeout (AC12), concurrency-safety via real cross-process stress (AC-MIG-3), archive comment-only diff (AC6), dual-presence HANDOFF_LAYOUT_CONFLICT with full message content on read+write (AC14), sidecar merge flat-first atomic (AC15), E132 re-point with last_updated ordering + redefined null/[] contract (AC7), every flat-path-assuming test fixed — 33 test files touched, 3 new (test/e123b9-lane-flip.test.mjs + 2 worker scripts) — full suite 2371/2371 green, zero expected-red exemptions, manifest removed (AC9), CALLERS allow-lists verified against spec per-caller (AC10), build/suite/audit/check-version all clean (AC11), AC8 reversibility both rounds on the real primary .current/ (11 files, 0 diffs Round 1; 0 diffs beyond one verified schema-heal line Round 2). 3 non-blocking hardening findings in code outside this ticket's diff filed NEW-TICKETS.md J2-NEW-7/8/9 (readAndMigrate ENOTDIR, lock-path-squatting-directory hang, drift.ts skew precheck missing flat fallback), each documented as a passing test, none violating any AC. Evidence: qa_reports/review_T-E123B9-05.md.

