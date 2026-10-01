# Review — T-E260G-16

Round 1 — CHANGES_REQUESTED (lane-wide) — by code-reviewer (opus). Commits `2e90729` (trim), `ea794d9` (Retained blocks table closed as none), `a116e4a` (state record); files `test/lane-paths-history`, `lane-paths`, `lane-ticket-allocation` (`.test.mjs`), plus the lane-wide sign-off.

## Summary
- 9 long blocks (140 counted lines) were trimmed. Each file has one pointer line and its own rationale section.
- Lane-wide proof at `a116e4a`: PASS (25 changed, scope ok, emit and tokens 0 differ, directives 0 lost, >20 0, 8-20 0, bare-id 0, form ok). `node scripts/check-md-tables.mjs`: OK (0 malformed).
- Lane-wide checks I ran by hand: every added or removed line in the 25 test diffs is a comment or a blank line; no `/*` is added; no `##` heading is added. 78 cited paths in added comment lines: all tracked except `gates/registry.js` (T-E260G-12) and two runtime fixture paths (`.current/tasks.md`, `.current/<lane>/tasks.md`) that describe test workspaces, not repo files.
- AC9 (suite) was not re-run by me. The verifier re-runs it independently, per the spec.
- This task has no required finding. The lane verdict is CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — proof `emit: 25 files, 0 differ`
AC2 — implemented — proof `tokens: 0 differ`, `directives: 0 lost`
AC3 — implemented — proof `scope: ok`; `git diff --name-status bdbffaf..a116e4a` shows only `M` on 25 lane test files, plus `A` on lane-owned `.current/e260g/*` and `specs/e260g-*`
AC4 — implemented — proof `>20: 0 unexpected`
AC5 — implemented — `--list-mid` prints `8-20: 0 block(s)`; the Retained blocks table is "none" (copied below)
AC6 — implemented — pointer lines lane-paths-history:7, lane-paths:7, lane-ticket-allocation:7; 19 pointer files against 20 sections (handoff-migration has a section and no pointer, see T-E260G-14); check-md-tables exits 0
AC7 — partial (lane-wide) — `bare-id: 0`; the widened id-only scan (E/AC/DR/T- ids) finds 3 continuation lines, all optional; one untracked-path citation (T-E260G-12, required)
AC8 — implemented — proof `form: ok`
AC9 — not judged here — the coordinator reports 3043/3040/0/3 on `ea794d9`; `a116e4a` changes only `.current/e260g/` files; the fresh verifier re-runs it

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
No required findings in this task's files. Rewritten sentences I checked against code: the lane-paths-history header and scope note (both cited test files are tracked), the lane-paths header labels (the `RN`, `CL`, `RP`, `REG`, `CLP`, `CALLERS1-3` test titles exist), the AC6 regex ruler and the 10k-digit WHY, the AC5 lock-path ruler, the allow-list ruler, the CALLERS1 base-sha note, the three-importer note, and the lane-ticket-allocation header (the `## Applied` mention is mid-line).
- recommended — test/lane-ticket-allocation.test.mjs:4 — "AC9 … is checked by reading the signatures." The base sentence went on "not by a runnable test". Without it, a reader can take the line to mean some test in this file checks AC9, and none does (`disposition` appears only in this comment). Restore "not by a runnable test", or say a reviewer checks it.

## Quality
No findings in this task's files. (Lane-wide Quality items are in the per-task reports.)

## Architecture
No architecture spec; comment-only change. `specs/e260g-comment-rationale.md` carries no absolute local paths.

## Security
No findings.

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED (lane-wide) — these three files are clean apart from one recommended item, but the round has three required findings: e31:6 together with rationale :25 (T-E260G-10), error-code-contract:317 (T-E260G-12) and hop-count-transitions:3 (T-E260G-15).
