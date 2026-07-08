# QA Review — a13-section1-polish

covers: A13-01, A13-02, A13-03, A13-04, A13-05, A13-06, A13-07

Round 1 — PASS — by qa-engineer

## Summary
- Reviewed code-reviewer's APPROVED verdict (`review_reports/review_a13-section1-polish.md`, covers A13-01..A13-06) against `specs/a13-section1-polish.md` AC1..AC9.
- Owned A13-07 (Constitution §2 test-ownership): re-measured all five context-budget caps flagged red by sr-engineer's handoff and code-reviewer's Build & Test state, independently (not trusted from the handoff note), via `dist/prompts/build.js` composeConstitution + stripRationale/stripOriginTags — the exact pipeline `test/context-budget.test.mjs` and `buildPromptForRole` use.
- Verdict: PASS.

## Independent re-measurement (A13-07 / AC9)

| bundle | old cap | sr-engineer's reported value | qa independently re-measured | new cap |
|---|---|---|---|---|
| lean always-on (chain:false,design:true + skill-coordinator-lite.md) | 3030 | 3087 | 3087 | 3087 |
| skill-pm stripped (stripOriginTags→stripRationale) | 2918 | 3196 | 3196 | 3196 |
| design-arm stripped constitution (chain:true,design:true) | 5260 | 5316 | 5316 | 5316 |
| teamwork design-arm bundle (constitution + skill-coordinator.md) | 9050 | 9106 | 9106 | 9106 |
| non-design constitution (chain:true,design:false) | 3175 | 3232 | 3232 | 3232 |

All five values matched sr-engineer's reported numbers exactly on independent re-measurement — no discrepancy found. Saving-margin assertions (`raw − stripped ≥ 240` on the design-arm floor; `design-arm − non-design ≥ 2080`) were re-verified against the new numbers and still hold (273 and 2084 respectively, unchanged in magnitude) — no assertion threshold change needed for those two, only the dated comment.

`test/context-budget.test.mjs` edits (qa-owned, Constitution §2 — sr-engineer did not touch this file, confirmed via the review report's Test-ownership check and my own `git diff` inspection): five cap literals + five test-title literals + five dated comment blocks (`a13-section1-polish (qa-owned bump, A13-07)`) appended per the file's existing convention (see the `v3.24.0`/`pm-cut-approval-gate`/`C2-06`/`pm-repair-resume-routing` blocks immediately above each assertion for precedent format).

## AC spot-check against the diff

- **AC1** (`content/const-01-core-head.md` Terse bullet): states the output-length policy exactly once ("this is the ONLY output-length policy; it is stated here exactly once"); structured artifacts (tables, blockers, assumption gap, acceptance criteria) exempt; both test-pinned literal substrings `assumption gap` and `acceptance criteria` survive verbatim; states skills define no separate word cap. Confirmed via `git diff content/const-01-core-head.md`.
- **AC2** (Watermark bullet): two-row markdown table present — row 1 Task-spawned+`model:` pinned → `` `— @<role> (<tier>)` ``; row 2 otherwise → `` `— @<role>` `` (no tier); tier enum reads `opus`/`sonnet`/`haiku`/`fable`. No other §1 bullet changed. Confirmed.
- **AC3** (`content/skill-pm.md`): (a) `Chat output ≤ 1 sentence.` removed, `Final reply:` line unchanged; (b) minimal complete passing Spec Schema example added with populated `authored-here` Copy row, `N/A` Visual Tokens/Widgets rows, and a Dependencies note legitimately omitting Visual Structural Assertions. Confirmed.
- **AC4** (`content/skill-code-reviewer.md`): (a) same word-cap removal pattern; (b) Review Report Schema example with all seven H2 sections and `APPROVED` verdict. Confirmed.
- **AC5** (`content/skill-architect.md`): (a) same pattern; (b) Artifact Schema example covering all six always-required H2s plus the correct Sequence-Diagram/Visual-Harness-omitted note. Confirmed.
- **AC6** (`content/skill-qa-engineer.md`): `Chat output MUST be exactly 1 sentence.` removed, `Details go in files.` retained; no schema example added (visual-report example in `skill-qa-visual.md` untouched — confirmed via `git status`, that file is not in the diff). Confirmed.
- **AC7** (`skill-design-auditor.md`, `skill-doc-writer.md`, `skill-researcher.md`, `skill-release-engineer.md`): each `Chat output ≤ 1 sentence.` removed, each `Final reply:` line unchanged. Confirmed for all four files via diff.
- **AC8** (fixture regeneration): all 11 `test/fixtures/compose-golden/*.txt` files changed (8 `build-*.txt`, 2 `hook-*.txt`, `constitution-monolith.txt`) reflecting the new §1 text; `test/compose-equivalence.test.mjs` green (confirmed in full suite run).
- **AC9** (qa-owned cap bump): completed this round — see re-measurement table above.
- **AC10** (full green build/test): `npm run build` clean (tsc, version check OK at 3.49.0); `npm test` — 938/938 pass, 0 fail, 0 regressions outside the AC9 cap updates.
- **AC11** (backlog bookkeeping): deferred — explicitly scoped post-PASS/post-release-engineer per the spec; not a qa-round AC.

## Drift check
`tw_detect_drift` (pre-round): reported the known pre-existing C6C11/C13-08 vibe-drift (acknowledged, left as-is per coordinator instruction) plus expected A13-01..A13-07 handoff-ahead-of-tasks.md drift (handoff `completed_tasks` had A13-01..06 before this round's `tw_complete_task` calls synced `tasks.md`). Resolved by this round's `tw_complete_task` calls for all seven A13 task ids; `tw_sync` run afterward to reconcile any residual tasks.md checkbox lag.

## Build & Test state
- `npm run build`: clean.
- `npm test`: 938/938 green, 0 failures, 0 skipped.

## Verdict
PASS — A13-01..A13-07 complete; all governing ACs (1–10) verified against the diff; AC11 correctly deferred to post-release bookkeeping. Full suite green with zero regressions.
