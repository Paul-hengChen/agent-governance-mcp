# Review — T-E123C-04

covers: T-E123C-01, T-E123C-02, T-E123C-03, T-E123C-04

## Round 1 — PASS — by qa-engineer

## Summary

Feature `e123c-cross-lane-aggregation` (specs/e123c-cross-lane-aggregation.md
AC1-AC12). code-reviewer APPROVED the T-E123C-01/02 diff in
`review_reports/review_T-E123C-01.md` with 0 required findings (I read and
independently agree with its recommended findings — see *Judging the
review's recommended finding* below; neither blocks PASS). My own job
(T-E123C-04) is: dispose the expected-red manifest, write the tests AC1-AC11
call for (the diff's own tests are qa-owned, per tasks.md T-E123C-01/04
split), resolve F2-NEW-1 per the human's decision A, and confirm the full
suite is green (AC12).

No production file was touched by this round — `tools/*.ts`, `dist/`,
`bin/agent-governance-usage-hook.mjs`, `tools/registry.ts`, and `tasks.md`
were already the sr-engineer's diff before I started; my own changes are
confined to `test/*.test.mjs` and `NEW-TICKETS.md` (F2-NEW-1's resolution
note).

## Expected-Red Diff

Phase 0.5. `qa_reports/expected-red_e123c-cross-lane-aggregation.txt` lists 14 entries.
Ran the full suite before touching any test file to confirm the actual red
set matched the manifest exactly (it did — same 14, verified independently
of code-reviewer's own classification in `review_reports/review_T-E123C-01.md`
Correctness "Expected-red manifest" bullet, which I re-derived rather than
took on trust). Disposition, one line per entry:

- `test/drift-skew.test.mjs | KNOWN GAP (J2-NEW-9, non-blocking): ...` —
  flipped to assert the graceful drift reason (AC8) and renamed off "KNOWN
  GAP" per the manifest's own instruction. Now green.
- `test/lane-paths.test.mjs | CALLERS2 (allow-list): ...` — added
  `tools/gate-stats.ts` + `tools/usage-accounting.ts` to
  `SANCTIONED_LANE_PATHS_IMPORTERS` (AC11). Now green.
- `test/lane-paths.test.mjs | CALLERS3 (allow-list): ...` — added the same
  two files to `SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS`. Now green.
- `test/usage-accounting.test.mjs | t-append-creates-file` — this file's
  `readUsageLines()` helper read the FLAT `usagePath(ws)`; AC7 retargets the
  writer to the current lane. Retargeted the helper to
  `resolveCurrentLanePaths(ws).usagePath`. Now green.
- `test/usage-accounting.test.mjs | t-append-creates-current-dir` — same
  root cause; its own assertion read `usagePath(ws)` directly, retargeted to
  a new `currentUsagePath(ws)` helper. Now green.
- `test/usage-accounting.test.mjs | t-append-appends-not-truncates` — same
  root cause, fixed by the `readUsageLines()` retarget. Now green.
- `test/usage-accounting.test.mjs | t-ac7-disjoint-keys` — same root cause,
  fixed by the `readUsageLines()` retarget. Now green.
- `test/usage-accounting.test.mjs | t-ac7-separate-files` — same root cause;
  its own assertions read `usagePath(ws)` directly, retargeted to
  `currentUsagePath(ws)`. Now green.
- `test/usage-accounting.test.mjs | t-hook-writes-record` — same root cause,
  fixed by the `readUsageLines()` retarget. Now green.
- `test/usage-accounting.test.mjs | t-hook-missing-usage-fields-default-zero`
  — same root cause, fixed by the `readUsageLines()` retarget. Now green.
- `test/usage-accounting.test.mjs | t-hook-no-usage-anywhere-all-zeros` —
  same root cause, fixed by the `readUsageLines()` retarget. Now green.
- `test/usage-accounting.test.mjs | t-hook-feature-null-when-no-handoff` —
  same root cause, fixed by the `readUsageLines()` retarget. Now green.
  (This entry's own assertion, `feature === null`, is unaffected by AC9 — it
  covers "no handoff anywhere at all", a different case from AC9's "flat
  handoff exists, no lane copy".)
- `test/e123b9-lane-flip.test.mjs | AC8 Round 1: ...` (F2-NEW-1, pre-existing)
  — rewired off `PRIMARY_CURRENT`/`copyRecursive` onto a new
  `mkFullFlatFixture()` test-built fixture in `os.tmpdir()` (human decision
  A). Now green. See *F2-NEW-1 resolution* below.
- `test/e123b9-lane-flip.test.mjs | AC8 Round 2: ...` (F2-NEW-1, pre-existing)
  — same fixture rewrite. Now green. See *F2-NEW-1 resolution* below.

**Disposition outcome**: all 14 manifest entries confirmed red pre-round,
all 14 now green post-round, zero unexplained/undispositioned reds, zero new
regressions introduced by my own edits (full-suite confirmation below).

## Phase 3 — Tests (spec-to-test map)

| AC | test file | case |
|---|---|---|
| AC1 | test/e26-gate-stats.test.mjs | "AC1: flat-only workspace (no .current/<lane> dirs at all — the pre-F2 shape): ..." |
| AC2 | test/e26-gate-stats.test.mjs | "AC2: two live lanes: total_fires sums both, ..." |
| AC3 | test/e26-gate-stats.test.mjs | "AC3: one live lane + one closed-history lane with a DISTINCT lane name: ..." |
| AC4(a) | test/e26-gate-stats.test.mjs | "AC4(a): same lane name live AND history, history bytes a PREFIX of live: ..." |
| AC4(b) | test/e26-gate-stats.test.mjs | 'AC4(b): "_primary" live + different-content history (NOT a prefix): ...' |
| AC5 | test/e26-gate-stats.test.mjs | "AC5: flat + live lane coexist with DISJOINT content ..." |
| AC5b | test/e26-gate-stats.test.mjs | "AC5b: flat bytes are a PREFIX of the lane file (interrupted flat->lane merge): ..." |
| AC6 | test/usage-accounting.test.mjs | "AC6: sumUsageForFeature aggregates across live/history/flat with the same content-based dedup rule as tw_gate_stats" |
| AC7 | test/usage-accounting.test.mjs | "AC7: on a workspace checked out to feat/e123c-cross-lane-aggregation, appendUsageRecord writes to .current/e123c/usage.jsonl — never .current/usage.jsonl" |
| AC8 | test/drift-skew.test.mjs | "AC8: an UNMIGRATED flat workspace with a from-the-future handoff schema_version IS caught by the skew precheck ..." |
| AC9 | test/usage-accounting.test.mjs | "AC9: hook records active_feature from the FLAT handoff.md on an unmigrated workspace ..." |
| AC10 | test/e26-gate-stats.test.mjs | "AC10: tw_gate_stats's tool description no longer states or implies a single flat sidecar path (L1-NEW-1)" |
| AC11 | test/lane-paths.test.mjs | CALLERS2 + CALLERS3 (allow-list additions) |
| AC12 | (whole suite) | `npm test` |

Also required by the human's explicit dispatch brief, all satisfied by the
map above: AC5b interrupted-merge case (AC5b row), AC4(b) `_primary`
live+different-content-history case (AC4(b) row), a fanned-out multi-lane
case whose total equals the per-lane sum with nothing double- or
un-counted (AC2 row: two independent live lanes, 3+2=5, both lanes' feature
and agent values present in the aggregate), and AC1 legacy flat-only numbers
unchanged (AC1 row).

**Coverage note**: the diff's file set (`tools/lane-paths.ts`,
`tools/gate-stats.ts`, `tools/usage-accounting.ts`, `tools/drift.ts`,
`bin/agent-governance-usage-hook.mjs`, `tools/lane-migrate.ts`,
`tools/registry.ts`) has no new user-facing strings or visual literals
(Copy/Visual Tokens tables are both N/A, server-internal tooling) — Phase 3a/
3b Copy/Visual Audit Gates are not applicable. No `design/<feature>.md`
exists — Phase 1.5 Visual Compare is skipped (logged: `Phase 1.5: skipped (no
Visual Baselines declared)`).

## AC Execution Log

Phase 3.5. Every AC above carries a `proof:` line in the spec — this section is
load-bearing for PASS (`AC_EXECUTION_LOG_MISSING` gate). Each row is the
exact command run in this worktree and its verdict.

| AC | command | result |
|---|---|---|
| AC1 | `node --test --test-name-pattern="AC1:" test/e26-gate-stats.test.mjs` | `ok 1 - AC1: ...` — PASS |
| AC2 | `node --test --test-name-pattern="AC2:" test/e26-gate-stats.test.mjs` | `ok 1 - AC2: ...` — PASS |
| AC3 | `node --test --test-name-pattern="AC3:" test/e26-gate-stats.test.mjs` | `ok 1 - AC3: ...` — PASS |
| AC4 | `node --test --test-name-pattern="AC4" test/e26-gate-stats.test.mjs` | `ok 1 - AC4(a): ...` / `ok 2 - AC4(b): ...` — both PASS |
| AC5 | `node --test --test-name-pattern="AC5:" test/e26-gate-stats.test.mjs` | `ok 1 - AC5: ...` — PASS |
| AC5b | `node --test --test-name-pattern="AC5b:" test/e26-gate-stats.test.mjs` | `ok 1 - AC5b: ...` — PASS |
| AC6 | `node --test --test-name-pattern="AC6:" test/usage-accounting.test.mjs` | `ok 1 - AC6: ...` — PASS |
| AC7 | `node --test --test-name-pattern="AC7:" test/usage-accounting.test.mjs` | `ok 1 - AC7: ...` — PASS |
| AC8 | `node --test --test-name-pattern="AC8:" test/drift-skew.test.mjs` | `ok 1 - AC8: ...` — PASS |
| AC9 | `node --test --test-name-pattern="AC9:" test/usage-accounting.test.mjs` | `ok 1 - AC9: ...` — PASS |
| AC10 | `grep -n "Aggregate .current/telemetry.jsonl" tools/registry.ts` | exit code 1 (no match — literal string confirmed gone) — PASS |
| AC11 | `node --test --test-name-pattern="CALLERS2\|CALLERS3" test/lane-paths.test.mjs` | `ok 1 - CALLERS2 ...` / `ok 2 - CALLERS3 ...` — both PASS |
| AC12 | `npm test` | exit 0; `# tests 2408` / `# pass 2408` / `# fail 0` — PASS |

Full-file confirmations beyond the single-case runs above (no regression in
neighboring cases from my edits):
- `node --test test/e26-gate-stats.test.mjs` → 34/34 pass.
- `node --test test/usage-accounting.test.mjs` → 35/35 pass.
- `node --test test/drift-skew.test.mjs` → 8/8 pass.
- `node --test test/lane-paths.test.mjs` → 54/54 pass.
- `node --test test/e123b9-lane-flip.test.mjs` → 25/25 pass (F2-NEW-1's fix).
- `npx tsc --noEmit` → exit 0, no errors.

## F2-NEW-1 resolution (human decision A, 2026-09-24)

`test/e123b9-lane-flip.test.mjs` "AC8 Round 1"/"AC8 Round 2" used to copy
`PRIMARY_CURRENT = <repo-root>/.current` — the
PRIMARY checkout's own live state directory — and assert it held the FLAT
pre-flip layout. Commit b7a566f migrated the primary itself to
`.current/_primary/`, so that assumption has been false since that commit:
Round 1 failed its own "genuine first migration" sanity assertion and Round
2 hit ENOENT reading `.current/handoff.md`. Both were red on a clean HEAD,
unrelated to any diff under test — filed as F2-NEW-1 by sr-engineer.

Per the human's decision A (dispatch brief), I rewrote both tests to build
their own flat fixture with a new `mkFullFlatFixture()` helper — a
self-contained `.current/` tree in `os.tmpdir()`, already at CURRENT
`schema_version` (15), carrying `handoff.md` plus all four optional
`LANE_FILES` sidecars (`telemetry.jsonl`, `metrics.jsonl`, `usage.jsonl`,
`dispatch.jsonl`) — and removed the now-dead `PRIMARY_ROOT`/
`PRIMARY_CURRENT` constants and `copyRecursive()` helper. What the two
rounds prove is unchanged:
- **Round 1** — `migrateFlatToLane` then `migrateLaneToFlat` on the fixture
  leaves every file byte-identical (per-file SHA-256), modulo only the
  lock/tmp tolerance AC8 already allows.
- **Round 2** — the WIRED trigger (`readHandoffState`, via a standalone node
  process against the built `dist/`) migrates the fixture, lands every
  `LANE_FILES` entry under `.current/_primary/`, deep-equals the
  pre-migration flat parse, then reverses byte-identically.

Both now pass deterministically on any machine, independent of any real
checkout's on-disk state. Marked resolved in `NEW-TICKETS.md` under
`## Lane: F2 (e123c-cross-lane-aggregation)`.

## Judging the review's recommended finding

code-reviewer's `review_reports/review_T-E123C-01.md` raised one
`recommended` (non-blocking) finding: `tw_gate_stats`'s `telemetry.path`/
`metrics.path` now name the current-lane write target, not necessarily an
existing read source, so a flat-only workspace's `path` can point at a file
that doesn't exist while `exists: true` (because `sources` holds the flat
copy instead). I confirmed this is real (reproduced: flat-only workspace →
`path=.current/_primary/telemetry.jsonl` (doesn't exist), `sources=[
".../telemetry.jsonl"]` (the flat file, does exist)) and confirmed it is
additive, not a regression — no in-repo consumer reads `.path` today (same
grep the reviewer ran, re-verified). This is a style/architecture
observation, not a failing test or missing coverage — per my SOP's Scope
rule, QA does not FAIL on architecture/style; it is correctly left as
`recommended` for a future ticket, not blocking T-E123C-04's PASS.

## Verdict

**PASS** — T-E123C-01, T-E123C-02, T-E123C-03, T-E123C-04. All 14 expected-red
manifest entries disposed (fixed, none dispositioned-away as unrelated).
AC1-AC12 each have a passing, mapped test with a logged AC Execution Log
entry. F2-NEW-1 resolved. Full suite green: `npm test` exit 0, 2408/2408.
`npx tsc --noEmit` clean. No production file modified by this round.
## 2026-09-24T06:01:33.499Z — PASS — by qa-engineer

PASS T-E123C-01..04. All 14 expected-red manifest entries disposed (fixed, none unrelated): AC8 drift-skew flip, CALLERS2/CALLERS3 allow-list additions, readUsageLines/currentUsagePath retarget (9 usage-accounting cases), F2-NEW-1 e123b9 AC8 Round1/2 rewired onto a test-built flat fixture (mkFullFlatFixture, human decision A) — marked resolved in NEW-TICKETS.md. Wrote/ran tests for AC1-AC11 (test/e26-gate-stats.test.mjs AC1-AC5b+AC10, test/usage-accounting.test.mjs AC6/AC7/AC9, test/drift-skew.test.mjs AC8, test/lane-paths.test.mjs CALLERS2/3=AC11) with an AC Execution Log per proof: annotation in qa_reports/review_T-E123C-04.md. Full suite green: npm test exit 0, 2408/2408 (AC12). npx tsc --noEmit clean. No production file modified this round. code-reviewer's one recommended finding (tw_gate_stats path/exists semantics) judged non-blocking, correctly left for a future ticket per QA's style/architecture scope boundary. See qa_reports/review_T-E123C-04.md.

## 2026-09-24T06:01:59.178Z — PASS — by qa-engineer

PASS T-E123C-01..04. All 14 expected-red manifest entries disposed (fixed, none unrelated): AC8 drift-skew flip, CALLERS2/CALLERS3 allow-list additions, readUsageLines/currentUsagePath retarget (9 usage-accounting cases), F2-NEW-1 e123b9 AC8 Round1/2 rewired onto a test-built flat fixture (mkFullFlatFixture, human decision A) — marked resolved in NEW-TICKETS.md. Wrote/ran tests for AC1-AC11 (test/e26-gate-stats.test.mjs AC1-AC5b+AC10, test/usage-accounting.test.mjs AC6/AC7/AC9, test/drift-skew.test.mjs AC8, test/lane-paths.test.mjs CALLERS2/3=AC11) with an AC Execution Log per proof: annotation in qa_reports/review_T-E123C-04.md. Full suite green: npm test exit 0, 2408/2408 (AC12). npx tsc --noEmit clean. No production file modified this round. code-reviewer's one recommended finding (tw_gate_stats path/exists semantics) judged non-blocking, correctly left for a future ticket per QA's style/architecture scope boundary. See qa_reports/review_T-E123C-04.md.

