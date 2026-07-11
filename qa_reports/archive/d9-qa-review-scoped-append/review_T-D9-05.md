# Review — T-D9-05

covers: T-D9-01, T-D9-02, T-D9-03, T-D9-04, T-D9-05

## Summary
- Feature: `d9-qa-review-scoped-append` — closes the D8 fan-out incident class
  (a qa-engineer FAIL write's `qa_review` auto-append fanning into every
  open/incomplete task's evidence file instead of only the reviewed task).
- Code review already APPROVED T-D9-01..04 (`review_reports/review_T-D9-01.md`,
  covers T-D9-01..04) with zero findings. This report is the T-D9-05
  qa-engineer-owned regression-test authorship + the two re-baselines the
  code-reviewer flagged as expected (gate-count 23→24, skill byte budget).
- Phase 0.5 (Expected-Red Diff): skipped (no
  `qa_reports/expected-red_d9-qa-review-scoped-append.txt` manifest declared).
- Phase 1.5 (Visual Compare): skipped (no `design/d9-qa-review-scoped-append.md`
  — server-side field/logic fix, no UI, matches spec's Visual Tokens/Widgets
  "N/A" rows).
- Copy Audit Gate: PASS — `gates/registry.ts`'s `QA_REVIEW_TARGET_REQUIRED`
  `hintStatic` (concatenated across its two template-literal halves) is
  byte-exact to spec's Copy/Strings `error.qa_review_target_required.hint`
  row; the error code string `QA_REVIEW_TARGET_REQUIRED` is byte-exact to
  `error.qa_review_target_required`. No coverage gap: no other new
  user-facing string was introduced by this diff.
- Verdict: PASS.

## Spec-to-Test Map (specs/d9-qa-review-scoped-append.md)

| AC | Test(s) | File |
|---|---|---|
| AC1 (FAIL + review_task_ids=[T-X] touches ONLY T-X, no fan-out into N open tasks) | FM1/AC1/AC4 | test/qa-review-scoped-append.test.mjs |
| AC1 (same, SQLite mode) | SQ1/AC1/AC4 | test/qa-review-scoped-append.test.mjs |
| AC2 (PASS via completed_tasks, review_task_ids omitted — back-compat unchanged) | FM2/AC2 | test/qa-review-scoped-append.test.mjs |
| AC2 (same, SQLite mode) | SQ2/AC2 | test/qa-review-scoped-append.test.mjs |
| AC3 (both empty → QA_REVIEW_TARGET_REQUIRED, records nothing) | FM3/AC3, FM4 (full TOOL_REGISTRY dispatch) | test/qa-review-scoped-append.test.mjs |
| AC3 (same, SQLite mode) | SQ3/AC3 | test/qa-review-scoped-append.test.mjs |
| AC4 (N>1 open tasks, exactly 1 evidence file/row changes — file mode) | FM1/AC1/AC4 (asserts byte-identical unrelated files + exact file count) | test/qa-review-scoped-append.test.mjs |
| AC4 (same, SQLite reports table row count) | SQ1/AC1/AC4 (asserts exact row count, 2 seeded + 1 new, never N+1) | test/qa-review-scoped-append.test.mjs |
| AC5 (read-side `hasEvidence`/`hasEvidenceInFile`/`covers:` index untouched) | Architectural invariant — verified by code-reviewer (review_reports/review_T-D9-01.md, "Architecture" section); not independently re-tested here since it's a negative/no-diff claim already confirmed by source inspection | — |
| gate registry count (23→24, one gate added) | re-baseline: "AC-1/AC-5: GATE_REGISTRY has exactly 24 entries" | test/error-code-contract.test.mjs |
| doc-file mapping comment size (23→24) | re-baseline: "doc-file mapping (c12): ..." | test/error-code-contract.test.mjs |
| FREE_TEXT_ALLOWLIST completeness (QA_REVIEW_TARGET_REQUIRED triggerEdge/armCondition) | re-baseline: 2 new allowlist rows, follows REVIEWER_COMPLETED_TASKS_REJECTED precedent | test/error-code-contract.test.mjs |
| skill-qa-engineer.md byte budget (11500→12200, actual 11826) | re-baseline: "AC-5: byte counts stay within v3.14.0-relaxed budgets" | test/qa-visual-skill-split.test.mjs |

## Regression-test authenticity check

Before trusting the new tests, I proved they actually catch the D8-class
regression: temporarily `git stash`'d `tools/handoff-orchestrator.ts`,
`tools/registry.ts`, `gates/registry.ts` back to the pre-fix state, rebuilt,
and re-ran `test/qa-review-scoped-append.test.mjs`. Result: 5 of 7 tests
failed against the old code (FM1/AC1/AC4, FM4, SQ1, SQ3 failed outright; the
old fallback fanned the FAIL text into every other open task's file, and the
both-empty write silently no-op'd/accepted instead of rejecting). Only FM2/AC2
and SQ2/AC2 passed against old code, which is expected — the PASS +
`completed_tasks` back-compat path was never broken (it never hit the
deleted fallback branch, since `completed_tasks` is non-empty on that path).
Then `git stash pop` + rebuild restored the fix; all 7 pass again. This
confirms the tests are load-bearing, not tautological.

## Coverage Gate

New file `test/qa-review-scoped-append.test.mjs` — 7 tests, 100% of its
assertions exercise the new `review_task_ids` resolution branch and the new
`QA_REVIEW_TARGET_REQUIRED` reject path in
`tools/handoff-orchestrator.ts` (the only source file with new runtime
logic in this cut; `gates/registry.ts`/`tools/registry.ts` are declarative
additions already covered by `test/error-code-contract.test.mjs`'s
registry-parity tests). Both storage backends covered (file mode via
`handleUpdateState` against `FileHandoffStorage`; SQLite mode via
`handleUpdateState` against `SqliteHandoffStorage`, with row counts verified
against a raw independent `better-sqlite3` connection to the same db file —
not the storage instance's own read path, to avoid a tautological check).

## Security Smoke

- Boundary: both-empty (AC3) and the full-`TOOL_REGISTRY`-dispatch path with
  fields omitted entirely (FM4, zod defaults) are both exercised — no crash,
  clean reject.
- No new auth/permission surface — `review_task_ids` is bounded
  (`z.array(z.string().max(500)).max(200).optional()`, same limits as
  `completed_tasks`), unchanged from the code-reviewer's Security section
  findings (no findings) in review_reports/review_T-D9-01.md.

## Re-baselines (pre-existing failures caused by the in-scope diff, now fixed)

1. `test/error-code-contract.test.mjs` — `GATE_REGISTRY.length` / `ALL_GATE_CODES.length`
   23 → 24 (one gate added: `QA_REVIEW_TARGET_REQUIRED`). Two assertion sites
   updated (the entries-count test and the doc-file-mapping-comment-size
   test), both re-worded to name d9 instead of the stale d2 rationale.
2. `test/error-code-contract.test.mjs` — `FREE_TEXT_ALLOWLIST` gained 2 rows
   for `QA_REVIEW_TARGET_REQUIRED` (`triggerEdge`, `armCondition`), verbatim
   mirroring the `REVIEWER_COMPLETED_TASKS_REJECTED` precedent immediately
   above it in the list (same two reasons: free English triggerEdge,
   snake_case-shorthand armCondition with no camelCase predicate token).
   Verified via the `CAMEL_RE`/`extractPredicateNames` logic that
   `QA_REVIEW_TARGET_REQUIRED`'s armCondition genuinely contains no camelCase
   predicate name (`qa_review`, `agent_id`, `qa-engineer` all fail the regex),
   so allowlisting (not mechanical-check exemption) is the correct
   disposition — not a hand-wave.
3. `test/qa-visual-skill-split.test.mjs` — `skill-qa-engineer.md` byte budget.
   Independently re-measured with `wc -c content/skill-qa-engineer.md` →
   **11826 bytes** (confirms, does not just trust, sr-engineer's reported
   11826 figure). Cap raised 11500 → 12200 (~374-byte headroom, consistent
   with this file's established ~300–550-byte convention), with a dated
   (2026-07-11) comment explaining the delta (Phase 4 FAIL step +
   Escalation Routes format line both gained a `review_task_ids` clause).

## Full Gates

- `npm run build` — clean, zero errors; `dist/` rebuilt and in sync with
  source (confirmed via `git status` after build — no stray diff).
- `npm test` — **1173/1173 green** (1160 in the default suite's own count +
  the new file's 13 subtests reported under the aggregate — see raw
  `node --test test/*.test.mjs` output: `# tests 1173 / # pass 1173 / # fail 0`).
- `npm audit --audit-level=high` — exit 0. One pre-existing **low**-severity
  advisory (`esbuild` 0.27.3–0.28.0, dev-server-only, Windows-only attack
  surface) — unrelated to this diff, already known from prior sessions
  (matches the D1-03 precedent of a pre-existing low being noted and not
  blocking).

## Verdict
PASS — AC1–AC5 all covered (AC5 via code-reviewer's already-confirmed
architectural invariant), the regression test is proven load-bearing against
the pre-fix code, all 4 pre-existing re-baseline failures are fixed and
independently re-verified (not blindly trusted), and the full gate sequence
(build/test/audit) is clean.
## 2026-07-11T09:22:52.459Z — PASS — by qa-engineer

PASS — T-D9-01..05. Authored test/qa-review-scoped-append.test.mjs (7 tests: FM1-FM4 file mode, SQ1-SQ3 SQLite mode) covering spec AC1-AC4: FAIL+review_task_ids touches ONLY the named task among N open tasks (byte-identical unrelated files, exact SQLite row count); PASS+completed_tasks back-compat unchanged (review_task_ids omitted); both-empty rejected with QA_REVIEW_TARGET_REQUIRED, records nothing (verified qa_reports/ dir never created, 0 SQLite rows). Proved the tests are load-bearing: git-stashed the fix, rebuilt, re-ran — 5/7 failed against pre-fix code, confirming genuine regression coverage; restored fix, all 7 green. Re-baselined the 4 known pre-existing failures caused by the in-scope diff: GATE_REGISTRY entries 23->24 (2 sites) + 2 FREE_TEXT_ALLOWLIST rows for QA_REVIEW_TARGET_REQUIRED (mirrors REVIEWER_COMPLETED_TASKS_REJECTED precedent, verified via CAMEL_RE that armCondition genuinely has no predicate token); skill-qa-engineer.md byte budget independently re-measured at 11826 (confirms sr's reported figure, not blindly trusted) and cap raised 11500->12200. Full gates: npm run build clean, npm test 1173/1173 green, npm audit --audit-level=high exit 0 (1 pre-existing unrelated low, esbuild dev-server). Copy Audit Gate PASS: QA_REVIEW_TARGET_REQUIRED hintStatic byte-exact to spec. Phase 0.5/1.5 both skipped (no expected-red manifest, no design file — server-side fix, no UI). Evidence: qa_reports/review_T-D9-05.md (covers T-D9-01..05).

