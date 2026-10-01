# Review — T-E260G-10

Round 1 — CHANGES_REQUESTED — by code-reviewer (opus). Commit `b3595f6`; files `test/e31-config-nonfatal`, `e32-e33-gate-hardening`, `e35-pipeline-order`, `e38-next-role-lookahead`, `e43-test-file-ask-at-dispatch` (`.test.mjs`).

## Summary
- 11 long blocks (222 counted lines) cut to 7 or fewer each. Rationale moved to `specs/e260g-comment-rationale.md`, with one pointer line per file.
- Emit and tokens are identical to base for all 5 files. The base bare ids at e32 L79 and L343 are gone.
- One trimmed header now states something the code contradicts (e31), and the matching rationale line carries the same stale claim.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — proof `emit: 0 differ`
AC2 — implemented — proof `tokens`/`directives` ok
AC3 — implemented — proof `scope: ok`
AC4 — implemented — proof `>20: 0`
AC5 — implemented — no 8-20 block remains (table below)
AC6 — implemented — pointer lines e31:7, e32:6, e35:7, e38:7, e43:6; one section per file in the rationale spec
AC7 — implemented — `bare-id: 0`. The widened id-only scan found one hit (optional, below). I sampled 10+ trimmed blocks and they read as plain language.
AC8 — implemented — `form: ok`
AC9 — not judged here — lane-level; the fresh verifier re-runs it

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
- **required** — test/e31-config-nonfatal.test.mjs:6 — "Known and accepted: the task-mutation tools degrade to default task paths silently." This is false for the code below it. `completeTaskInFile` under a corrupt config returns a loud JSON error (`"No task list file found."`, test at :257). `addTaskInFile` writes to the lane ledger `.current/_primary/tasks.md`, not a default task path (test at :271). The trim turned a stale gap into a present-tense fact, the same defect class as e260e round 1. Suggested wording: "Known and accepted: under a corrupt config the task-mutation tools ignore the custom taskPaths/taskPattern (completeTaskInFile errors loudly, addTaskInFile writes the lane ledger)."
- **required** — specs/e260g-comment-rationale.md:25 — the same stale claim ("silently fall back to `DEFAULT_TASK_PATHS` and `DEFAULT_TASK_REGEX` … not surfaced as an error by the mutation tools") was copied from base into the tracked rationale. Correct it as above, or mark it as the pre-e125a history.
- recommended — test/e31-config-nonfatal.test.mjs:195-198 — the untouched section comment says the same thing ("silently fall back to DEFAULT_TASK_PATHS"). It was already wrong at base, so it does not block, but it should be fixed in the same pass as the header.
- Other rewritten sentences I checked against code: e32 header and the R1/C2/ENV rulers (:2-5, :64-67, :155-157, :293-295), e32 seed-stamp comment (:37-39), e35 header (the 18-step pin is asserted at :61-64), e38 header, e43 header and the comment at :170-173. All accurate.

## Quality
- recommended — test/e31-config-nonfatal.test.mjs:225-228, :272-275 — the in-body comments lost their 2-space indent and now start at column 0 inside the test body (base had `  //`). Restore the indent.
- optional — test/e43-test-file-ask-at-dispatch.test.mjs:173 — `// (E69, E76, E77)` is an id-only line (from the widened scan). It continues the sentence above it, so it is allowed, and it is unchanged from base (base L197). It could be folded onto line 172 if that block is touched again.
- optional — pending note (b) says e32 dropped "a pointer to an untracked review_reports path". In fact `review_reports/review_T-E32-01.md` is tracked, at base and at HEAD. Dropping it from the test is fine, but the rationale section (spec :32, "labels match the ones the code review used") could keep it as a tracked pointer.

## Architecture
No architecture spec; comment-only change.

## Security
No findings. No code or literal changed (emit identical).

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED — the e31 header and its rationale line state a silent default-path fallback that the tests at e31:257 and e31:271 show is not what happens.
