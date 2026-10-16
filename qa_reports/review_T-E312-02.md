covers: T-E312-01, T-E312-02

# QA review — E312 read-path migration race (T-E312-01 fix, T-E312-02 tests)

Verdict: PASS. Test commit 09a6496 on top of fix c5d0c21 (code-review APPROVED, review_reports/review_T-E312-01.md).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3.5: skipped (no proof:-annotated ACs). Copy/Visual gates: n/a (no user-facing strings or tokens).
Phase 3a placement: dispatch brief `Test-file placement` line — created test/e312-read-path-race.test.mjs (pre-authorized).

## Phase 1 — implementation read (tools/handoff-parse.ts, c5d0c21)
- assertNoHandoffLayoutConflict observes lane, flat, lane; throws only when all true (AC1). Message unchanged.
- readAndMigrate retries the other layout once via readHandoffFileIfPresent; neither present -> null (AC2). No lock, no mkdir, no write added (AC3). Stable dual presence still throws (AC4, test (iv) + e123b9 AC14).

## AC -> test map
| AC | test (test/e312-read-path-race.test.mjs) |
|---|---|
| AC5(i) R1 forward | "(i) R1 forward ..." and "(i) R1/R2 forward sweep" x {parseHandoff, readHandoffState} |
| AC5(ii) reverse | "(ii) reverse ..." x both readers |
| AC5(iii) R2 both directions | "(iii) R2 both directions ... N=1..6" x both readers |
| AC5(iv) stable dual | "(iv) stable dual presence ..." |
Harness: node:fs CJS existsSync wrapped + syncBuiltinESMExports, restored in finally; sibling rename injected after a chosen lane/flat existsSync call (named trigger, plus sweep N=1..6); injections skipped while the lane lock is held (a real sibling renames only under the lock). Tmp fixtures only.

## Expected-red evidence (AC5)
Base build: `git archive cac3036` extracted to a temp dir, node_modules symlinked from the primary checkout, `npx tsc`, then the new test file copied in and run.
- Base: 9 tests, 2 pass, 7 fail. Red: both (i) tests and (iii) test for parseHandoff, both (i) for readHandoffState, (iii) readHandoffState, (ii) parseHandoff. Failure shapes: false HANDOFF_LAYOUT_CONFLICT (R1) and "reader returned no state" (R2/reverse). Green on base: (iv) (correct, real conflict unchanged) and (ii) readHandoffState (that interleave needs a later injection point, covered by its (iii) sweep which is red).
- Fixed build (HEAD): 9/9 pass.
(i) and (iii) are red on base for both readers as required.

## AC6 — load evidence (12 busy-loop hogs, 8 cores, AC-MIG-3 worker mix r,w,r,w,r, 400 ms head start, scratch harness not committed)
- Fixed build: 120 iterations, 0 failing iterations (tally: 360 R-ok, 234 W-ok, 6 benign "STATE DRIFT" w-exits accepted by AC-MIG-3; end-of-run tree clean every iteration).
- Base build (cac3036): 200 iterations, 0 failing iterations in this run. The coordinator's earlier base run reproduced 1/100; the base failure is rare, so this run did not reproduce it. Baseline here is therefore not a proof of fixed-vs-base difference; the deterministic tests above are the causal evidence.
- No residual red after the fix; no load-sensitive-family ruling needed.

## AC7
- Test commit 09a6496; `git status --short` shows no untracked files (only tracked lane state files .current/e312/{dispatch.jsonl,handoff.md} modified by tw_* writes, plus this report).
- `node scripts/test-lock.mjs -- npm test` on HEAD 09a6496: exit 0, 3194 tests, 3191 pass, 0 fail, 3 skipped.
- Evidence line only: `git diff cac3036 -- test/e123b9-lane-flip.test.mjs` is empty.

## Notes
- Optional (out of scope, from review): readHandoffState snapshot-refresh window (fail-safe STATE DRIFT, accepted by AC-MIG-3); tools/drift.ts:228-229 same pick/read window class.
## 2026-10-16T07:14:53.972Z — PASS — by qa-engineer

PASS. AC5: test/e312-read-path-race.test.mjs 9/9 green on fix, 7/9 red on base cac3036 build (i and iii red both readers). AC6: 120 iters x 12 hogs on fixed build 0 failures; base 200 iters 0 failures (rare, not reproduced this run). AC7: HEAD 09a6496 full suite 3191/3194 pass, 0 fail, 3 skipped; e123b9 test diff vs cac3036 empty. Evidence qa_reports/review_T-E312-02.md.

