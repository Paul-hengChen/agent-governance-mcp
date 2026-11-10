# Review — T-E360-01

## Round 1 — APPROVED — by code-reviewer

Diff: `e748fc5..0928b7f` (feature `e262-sop-text-fixes`). Scope of this report: W10 (`content/skill-qa-visual.md` *Error codes & STOP routes*, lines 88, 89, 90, 91, 93).

## Summary
- Inserts `review_task_ids=[<task-id>], ` directly after the `qa_review=` argument of each of the five Phase 1.5 FAIL calls.
- Verbatim check: applying the five W10 replacements to the base file reproduces HEAD byte-for-byte; 133 lines before and after; 17169 bytes (cap 20700).
- Without the field these `qa_review`-bearing FAIL writes have an empty `completed_tasks` and are rejected with `QA_REVIEW_TARGET_REQUIRED`; with it the FAIL stamp lands on the named id and the id leaves the ledger.
- Verdict: APPROVED.

## AC Completeness
AC-E360-1 — implemented — `content/skill-qa-visual.md:88-91,93`: `status=FAIL` count 5, `review_task_ids=[<task-id>]` count 5, each immediately after `qa_review=…, ` and before `next_role=`.
AC-E360-2 — implemented — 17169 bytes ≤ 20700; `test/qa-visual-skill-split.test.mjs`, `test/pixel-perfect-visual-compare.test.mjs`, `test/visual-widgets-unverified-gate.test.mjs` green in my run; no golden or budget moves (file is in no composition).

## Correctness
No findings.
- Format match: `content/skill-qa-engineer.md:107` (Escalation Routes Format) requires FAIL rows to carry `qa_review` plus `review_task_ids=[<task-id(s)>]`. Phase 1.5 FAILs are per task, so the singular placeholder `[<task-id>]` is the right specialisation.
- Line 92 (dimension mismatch) has no call of its own and defers to the missing-baseline path, which now carries the field — correctly left unchanged.
- The two rows without a preceding `tw_rollback_task` (missing baseline, Step A.0) still benefit: a qa-engineer FAIL write removes its `review_task_ids` from `completed_tasks`.

## Quality
No findings. Argument order is uniform across the five rows and matches the qa SOP.

## Architecture
No architecture spec. Fits the server's `review_task_ids` resolution rule (tool schema: `review_task_ids` if non-empty, else `completed_tasks`).

## Security
No findings. Prose only; no path or personal information added.

## Performance
No findings. +145 bytes in a lazily loaded sub-skill.

## Verdict
APPROVED — the five FAIL calls now match the qa SOP format line and will be accepted by the server.
