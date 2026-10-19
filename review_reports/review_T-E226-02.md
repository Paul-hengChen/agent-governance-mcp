# Review — T-E226-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff judged: `git diff fac8990 aecfd29 -- content docs`. Spec: `specs/e226-integrator-sop-portable.md`. Manifest D2 row: `specs/fanout-post-v4-w9.md`, lines 15, 40 and 75.

## Summary
- The 5a lane-layer `evidence` and `new findings` rows in `content/skill-integrator.md` gain the `artifacts: "local"` reading.
- Both strings (`sop.5a-evidence`, `sop.5a-findings`) are verbatim, each occurring once. Both mismatch cells still say `send back`. The Stage 6 `**Findings finish did not number**` bullet is byte-identical: it is not in the diff.
- The wording matches the human D2 = (i) row: lanes do not commit excluded paths, the integrator reads the worktree copy, and the integrator hand-files findings from finish's history copy.
- Verdict: CHANGES_REQUESTED, only for the lane-wide missing expected-red manifest (see review_T-E226-01.md).

## AC Completeness
AC-E226-4 — implemented — content/skill-integrator.md:147. The evidence row reads `<worktree>/<evidence path>` under `artifacts: "local"`. At :149 the findings row reads `<worktree>/.current/<lane>/pending-tickets.md` and hand-files from primary's `.current/history/<YYYY-MM>/<lane>/` (Stage 6 step 1). Both rows keep `send back`. :197 is unchanged against `fac8990`.
Other ACs: see review_T-E226-01.md, review_T-E349-01.md and review_T-E350-01.md.

## Correctness
- **required** (lane-wide, same finding as review_T-E226-01.md) — `qa_reports/expected-red_e226-integrator-sop-portable.txt` is missing while intentional reds exist (SOP step 4a).
- D2 cross-check. Manifest line 15 option (i) says: 「lane 不 commit 被 exclude 的路徑；新發現照樣寫 `pending-tickets.md`，由整合者從 history 那份手動建票；證據靠 finish 收割」 ("the lane does not commit excluded paths; it still writes new findings to `pending-tickets.md`; the integrator files tickets by hand from the history copy; finish harvests the evidence"). The SOP matches each point. Evidence is read from the worktree before finish harvests it. The findings file is never committed, so finish numbers none of it, and the integrator hand-files from the history copy. The text does not name E196/E217, as decision C3 requires.
- No new red tests come from this task's text. e178a AC13 item 7 (`the `pending-tickets.md` / `## Applied` / root `NEW-TICKETS.md` check`) still matches.

## Quality
No findings. The appended clauses follow the style of the existing cells (a semicolon-joined clause, with the Stage 6 cross-reference in parentheses).

## Architecture
No architecture spec. Scope stays within manifest line 40 (the local-mode SOP reading is assigned to e226; both lanes follow the D2 row's wording without reading each other's branch).

## Security
No findings. The diff adds no path outside placeholder form.

## Performance
No findings. Text only.

## Verdict
CHANGES_REQUESTED — T-E226-02's text is correct and agrees with D2. The verdict carries only the lane-wide expected-red manifest finding.
