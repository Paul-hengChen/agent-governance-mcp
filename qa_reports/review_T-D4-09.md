# Review — T-D4-09 (final feature QA, d4-behavioral-eval-harness)

covers: T-D4-09

## Summary
Final QA for the D4 behavioral-eval-harness feature. Upstream: code-reviewer
APPROVED the full diff (T-D4-08, `review_reports/review_T-D4-08.md`) — all 12
ACs verified against source, build clean, 1106/1106 tests green at review
time.

This pass re-verifies build + full suite green, and attempts the live
`npm run eval` smoke per the T-D4-09 task text ("smoke-test `npm run eval`
once against a live ANTHROPIC_API_KEY (or record a documented no-key skip if
none available in this environment)").

**Result: `ANTHROPIC_API_KEY` is not present in this environment.** No live
model call was made. Per the task's own documented fallback, this is recorded
as a no-key skip with the fail-fast path (AC-11) independently verified in
its place. Everything within reach without the key is green.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_d4-behavioral-eval-harness.txt` manifest
declared).

## Phase 1 — Review
No new implementation to review at this task — T-D4-07 (runner) and T-D4-08
(code review) already landed and were APPROVED upstream. This task's scope
per `tasks.md` is verification only: full test green + eval smoke. Confirmed
no changes to D2-reserved files (`tools/handoff-orchestrator.ts`,
`content/skill-coordinator.md`, `schema/migrations-handoff.ts`,
`tools/handoff.ts`) — disjointness holds (git status clean, no diff since
T-D4-08's APPROVED review).

Copy Audit / Visual Audit gates: N/A — spec's Copy/Strings and Visual Tokens
tables are both explicitly `N/A` (non-visual, server-internal tooling
feature); no user-facing strings or visual literals introduced.

Phase 1.5 Visual Compare: skipped (no `design/d4-behavioral-eval-harness.md`,
no Visual Baselines).

## Phase 3 — Tests
No new tests authored at this task (AC-1..AC-9, AC-12 already covered by
`test/eval-assertions.test.mjs` per T-D4-05/06's AC→test map, confirmed in
`review_reports/review_T-D4-08.md`). This task's job is to execute and
verify, not author.

## Phase 4 — Run

### 1. Build
```
$ npm run build
> agent-governance-mcp@3.66.0 prebuild
> npm run check:version
check:version — note: HEAD (6669a5f) is past tag v3.66.0 (9e49543). Bump version + add CHANGELOG entry before tagging next release.
check:version — OK (3.66.0)
> agent-governance-mcp@3.66.0 build
> tsc
```
Zero errors. (The check:version "note" is expected/pre-existing — release-engineer's job post-PASS, not a build error.)

### 2. Full test suite
```
$ npm test
...
1..1093
# tests 1106
# suites 1
# pass 1106
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 24655.302958
```
**1106/1106 green, 0 fail** — matches the expected count exactly, including
the 17 zero-cost `test/eval-assertions.test.mjs` assertions (AC-6).

### 3. Live eval smoke (AC-9, AC-10, AC-11)

Checked environment for `ANTHROPIC_API_KEY`:
```
$ echo "ANTHROPIC_API_KEY set: ${ANTHROPIC_API_KEY:+yes}${ANTHROPIC_API_KEY:-no}"
ANTHROPIC_API_KEY set: no
```
No `.env` file in the repo root, no key in the shell environment. Per the
assignment's explicit instruction ("If ANTHROPIC_API_KEY is unavailable,
verify the fail-fast path and report Blocked instead of improvising"), no
attempt was made to source a key from elsewhere.

**AC-11 fail-fast path — verified instead:**
```
$ unset ANTHROPIC_API_KEY; npm run eval; echo "EXIT_CODE=$?"
> agent-governance-mcp@3.66.0 eval
> node test/eval/run-eval.mjs
run-eval: ANTHROPIC_API_KEY is not set — export it to run the live eval (costs API calls).
EXIT_CODE=1
```
- Exits non-zero (1) — correct.
- One-line error naming the missing env var — correct.
- Returned immediately (no network delay) — no dynamic `@anthropic-ai/sdk`
  import or scenario dispatch occurred before the guard fired, consistent
  with `review_T-D4-08.md`'s static-analysis finding on `run-eval.mjs:42-47,
  91-96`. AC-11 satisfied.

**AC-9 (never per-commit) and AC-12 (never mutates governance state)** are
structurally re-confirmed by this run: `npm test` (which just ran green
above) never invoked `eval`, and the failed `npm run eval` attempt exited
before touching any `tw_*` tool or `.current/`/`tasks.md` file — `git
status` after the run shows no untracked/modified governance files.

**AC-10 (live 7-scenario PASS/FAIL summary + exit-code semantics)** —
**NOT independently verified live in this session.** No `ANTHROPIC_API_KEY`
was available in this environment to make real model calls. This was
verified by static analysis in the upstream code review
(`review_reports/review_T-D4-08.md`, "AC-10 exit semantics" finding,
`run-eval.mjs:125-138`) but not exercised end-to-end against a live model by
either the reviewer (who deliberately did not incur the spend) or this QA
pass (key unavailable).

## Deferred by human decision

On 2026-07-10, following the Blocked verdict originally recorded below, a
human decision was relayed via the coordinator (in coordinator chat, not
this session) waiving the live-eval requirement: **no `ANTHROPIC_API_KEY`
will be supplied now**, and T-D4-09 is to close on the evidence already
gathered — build clean, `npm test` 1106/1106 green, and the AC-11 fail-fast
path verified — with **AC-10 (live 7-scenario end-to-end run) explicitly
DEFERRED, not silently skipped**. The fail-fast evidence above is unchanged;
this section records the scope waiver layered on top of it.

Deferred item: AC-10 (`test/eval/run-eval.mjs` live run against a real
`ANTHROPIC_API_KEY`, producing the per-scenario PASS/FAIL lines + summary +
exit-code behavior) remains unexercised end-to-end in any session to date.
It is verified only by static analysis (`review_reports/review_T-D4-08.md`,
"AC-10 exit semantics" finding). Action item for whoever next has a key
available: run `npm run eval` once `ANTHROPIC_API_KEY` exists in the
environment, and treat any failure there as a live finding against this
already-released feature rather than a blocker on this ticket.

## Verdict: PASS (degraded scope, human-waived)

Not a harness defect — no crash, no wrong wiring, no false positive was
observed anywhere the harness could be exercised (build, full suite, and the
fail-fast branch are all correct). The one live-model assertion this task
exists to make (AC-10's real PASS/FAIL summary + exit code, run against an
actual model reply) was not produced in any session, for lack of an
`ANTHROPIC_API_KEY`. QA's own SOP scope would ordinarily hold this task at
Blocked pending that evidence; per the human-authorized scope waiver
recorded above, it is instead being closed as PASS with the gap recorded
openly so the release decision is made with eyes open.

T-D4-07, T-D4-08, and T-D4-09 are completed by this pass. `npm run eval` is
the one remaining unexercised path — see Deferred section above.
## 2026-07-10T13:54:11.650Z — PASS — by qa-engineer

T-D4-07/08/09 PASS on degraded scope: build clean, npm test 1106/1106 green, AC-11 fail-fast path verified; AC-10 live 7-scenario eval smoke DEFERRED (not run) per human decision relayed via coordinator 2026-07-10 — no ANTHROPIC_API_KEY supplied. See qa_reports/review_T-D4-09.md.

