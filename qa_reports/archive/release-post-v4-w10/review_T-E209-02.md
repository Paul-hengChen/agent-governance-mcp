# QA review — e209-test-infra-fixes (round 1)

covers: T-E209-01, T-E183-01, T-E209-02, T-E183-02, T-E182-01

Per-task evidence also lives in `qa_reports/review_T-E183-02.md` and `qa_reports/review_T-E182-01.md`.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e209-test-infra-fixes.txt` has 1 entry: `test/success-metrics.test.mjs | E8-S4 ...`.

Run, before any re-baseline edit: the full suite (`node --test test/*.test.mjs`) on an isolated `git archive` copy of the lane HEAD at the start of QA (feba56b, plus a `node_modules` symlink): 3576 tests, 3564 pass, 10 fail.

- E8-S4 (manifest entry) — confirmed red, for the declared reason (T-E183-01 made a missing file exit 1). Re-pinned in T-E183-02, now green.
- 9 further reds, none on the manifest. All dispositioned as artifacts of the non-git `git archive` copy, not regressions of this lane's change surface (none of them touches `scripts/test-lock.mjs`, `scripts/summarize-metrics.mjs` or `docs/gate-retro-procedure.md`):
  - E104(ii) zero tracked binaries under research/; AC16 / AC14 "isolated copy of committed HEAD" hygiene cases; Partition (E66) top-level directory classification; AC12 Evidence-Citation / check:bookkeeping; REAL-CORPUS AC13/AC16; AC7 and CQ-9 real `docs/backlog.md` checks — they shell out to `git` or read the repo's own tracked state, which an extracted archive has none of.
  - AC17 (mailbox-watch second process on the same file) — the E224 load-sensitive case (out of scope for this lane); it also ran alone-and-green in the lane before.
  - The authoritative check is the real-tree final run (AC-LANE-1 below), which must show none of these.

Phase 0.5: manifest present; diff dispositioned as above.

## Phase 1 / Phase 1.5 / Phase 3.5

- Phase 1: code-reviewer round 1 APPROVED (`review_reports/review_T-E209-01.md`, `review_T-E183-01.md`); read the two diffs and the "notes for qa"; no new defect found.
- Copy Audit (3a): spec Copy / Strings rows grepped in `scripts/summarize-metrics.mjs`: `summarize-metrics:` prefix, `no metrics file`, `cannot read`, `legacy flat`, `tw_gate_stats` all present; the tests pin those fragments only.
- Visual Audit (3b): N/A (no visual literals).
- Phase 1.5: skipped (no Visual Baselines declared).
- Phase 3.5: the spec carries `proof:` annotations; every proof was executed and is logged below (one log covers all ids this round).

## AC Execution Log

| AC | command | result |
|---|---|---|
| AC-E209-1 | `node --test test/e209-test-lock-publish.test.mjs` (working tree) | 5/5 pass |
| AC-E209-1 (red on base) | same file with `E209_SCRIPT_UNDER_TEST=<temp copy of git show 2ad039d:scripts/test-lock.mjs>` | AC-E209-1 case RED (`existsSync(lockPath)` expected true, actual false: lock lost); also the EPERM case red (base has no linkSync); 3 other cases green; 3/5 pass |
| AC-E209-2 | cases 2, 3, 4 of the same file | green: after success, after live-holder timeout, and after an injected EPERM the directory holds no temp file |
| AC-E209-3 | `node --test test/e177b-test-lock.test.mjs`; `git diff 2ad039d --stat -- test/e177b-test-lock.test.mjs` | 19/19 pass; file untouched (no diff), so AC10 assertions are byte-identical |
| AC-E209-4 | existing corrupt-payload case + new empty-lock case | green (empty lock stays, not reclaimed inside `CORRUPT_GRACE_MS`) |
| AC-E209-5 | existing CLI cases in `test/e177b-test-lock.test.mjs` (AC7, AC9, AC12, AC13, usage) | green, unmodified |
| AC-E209-6 | code-reviewer ruling | partly refuted (guard path); filed as pending ticket E209-NEW-1, out of scope, not tested |
| AC-E183-* | see `review_T-E183-02.md` | see there |
| AC-E182-* | see `review_T-E182-01.md` | see there |

## T-E209-02 notes

- AC-E209-1 interpretation (integrator + reviewer agreed, spec text unchanged): the interposer passes the STALE observation `""` (the reclaimer saw an earlier, old empty lock) to the exported `reclaimStale` at the moment the new lock first appears. Reading it as the post-publish content would be red on HEAD too, because `reclaimStale` unlinks whatever matches the caller's observation by contract.
- Interposer patches the CJS `node:fs` object (`openSync` for the base shape, `linkSync` for the fix shape) plus `syncBuiltinESMExports()`; deterministic, no sleeps. It asserts the interposer fired exactly once so a miss can't pass vacuously.
- AC-LANE-3: the resident test runs against the working tree. `E209_SCRIPT_UNDER_TEST` is an opt-in env path (not a sha), used only in this session for the red run above.
## 2026-10-20T12:11:49.720Z — PASS — by qa-engineer

QA round 1 PASS. Evidence: qa_reports/review_T-E209-02.md (covers batch, Expected-Red Diff, AC Execution Log), review_T-E183-02.md, review_T-E182-01.md (incl. ## E156 cause judgment: unrelated). AC-E209-1 red on base copy (lock lost), green on HEAD; AC-E183-4/5 red on base, green on HEAD; E8-S4 re-pinned; runHook timeout 20000 ms + env override, 8-copy x3 rounds 24/24 green (baseline 9/24 red). AC-LANE-1: node scripts/test-lock.mjs -- npm test on clean tree at d909908: 3590 pass / 3592 total (2 skipped, 0 fail). AC-LANE-2: diff within owned set. Pending tickets: E209-NEW-1 (reviewer), hook-spawn headroom (qa, P3).

