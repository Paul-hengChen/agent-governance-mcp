covers: T-E154-01, T-E136-01, T-E136-02, T-E139-01, T-E236-01, T-E154-02, T-E136-03, T-E139-02, T-E236-02, T-E139-03

# QA review — e139-evidence-verdict-integrity (E139, E236, E136, E154)

Phase 0.5: skipped (no expected-red manifest declared). The 17 reds seen before the re-pins were the planned T-E139-03 re-pins plus the e295 AC11 cut gap, which the integrator ruled in ("integrator mailbox to-lane#8").
Phase 1.5: skipped (no Visual Baselines declared; mode no-design).
Copy Audit: the new envelope text and `hintStatic` are asserted verbatim by `test/e139-non-reviewer-verdict.test.mjs` (AC-E139-1, built from `gate(...).hintStatic`). Visual Tokens: N/A.
Phase 3a: test placement pre-authorised by the dispatch brief; four new files created.
Code review: APPROVED (`review_reports/review_T-E139-01.md`, optional findings only; none is a QA failure).

## Spec-to-test map

| AC | test |
|---|---|
| AC-E154-1..5 | `test/e154-multi-covers.test.mjs` (AC-E154-4 drives the real orchestrator on both the review and the QA side) |
| AC-E154-6 | `tools/lane-status.ts` and `test/e177b-lane-status.test.mjs` absent from the branch diff; e177b green unmodified |
| AC-E136-1..5, 7 | `test/e136-evidence-path-injective.test.mjs` (AC-E136-3 corpus = 8^1..8^3 strings plus the named pairs, >500 distinct ids) |
| AC-E136-6 | `test/qa-flow.test.mjs` "recordReviewInFile sanitises path-traversal in task id" (re-pinned) |
| AC-E139-1..6, 8 | `test/e139-non-reviewer-verdict.test.mjs` (per-role x verdict matrix, APPROVED row, near-misses, code-reviewer non-interference, absence, SQLite, telemetry + gate-stats, no evidence file on rejection) |
| AC-E139-7 | the four re-pinned registry tests + the telemetry facet test |
| AC-E139-9 | no `content/`, `test/fixtures/compose-golden/` or `test/context-budget.test.mjs` path in the branch diff |
| AC-E236-1..7 | `test/e236-rejected-write-evidence.test.mjs` (AC-E236-4 has one case per rejecting step, compared by full directory snapshot) |
| AC-E236-8 | `test/qa-review-scoped-append.test.mjs`, `test/covering-evidence.test.mjs` green unmodified |
| AC-L1 | `schema/` absent from the branch diff |
| AC-L2 | the only removed lines in `gates/registry.ts` are `//` comment lines (count wording, a catalog comment, the code-34 note, the documentedInProse comment) |
| AC-L3 | every changed path is in the cut's touches or under `.current/e139/`, `qa_reports/`, `review_reports/`; no `tools/**`, `gates/**`, `dist/**`, `content/**`, `docs/**` path touched by qa |
| AC-L4 | `npm run build` leaves `git status --porcelain` empty |
| AC-L5 | full suite, below |

## Existing-test re-pins (T-E139-03), nothing else changed in these files

- `test/e26-gate-stats.test.mjs`: R1, R2, U1, D1, D2, T3b, 34 -> 35 (titles and the explanatory comment follow).
- `test/e35-pipeline-order.test.mjs` t-order-exact: the verdict step's codes gain `NON_REVIEWER_VERDICT_REJECTED`.
- `test/error-code-contract.test.mjs`: AC-1/AC-5 count (and title), doc-file mapping (c12) count, AC3 (c12) `FREE_TEXT_ALLOWLIST` row for `NON_REVIEWER_VERDICT_REJECTED` `triggerEdge`, E308/AC3 count and title.
- `test/qa-flow.test.mjs`: path-traversal expected filename `review_..__002F_E_S_C_A_P_E.md`; T-C9-10/AC-2 positive control (pm write carrying review_verdict now asserts the `NON_REVIEWER_VERDICT_REJECTED` rejection, still proving zod accepts the enums); T-C9-10/AC-5 sr-engineer test (now asserts the new rejection and that `REVIEW_VERDICT_STATUS_MISMATCH` stays code-reviewer-only).
- `test/e308-single-source-tier-enum.test.mjs` (integrator mailbox to-lane#4/#5): E303-AC12 34 -> 35 + title; E303-AC11a `(none)` count 0 -> 1 with exact `===` + title.
- `test/e295-hop-cap-and-sop-halves.test.mjs` (integrator mailbox to-lane#8): AC11 `count(REGISTRY, "(none)")` 0 -> 1, exact `===`, title unchanged.

## Phase 4 results

- Build: `npm run build` zero errors, `git status --porcelain` empty afterwards (no dist diff).
- `npm audit --audit-level=high`: exit 0.
- Full suite `node scripts/test-lock.mjs -- npm test` on HEAD 317a22d (clean tree, no untracked files): tests 3717, pass 3715, fail 0, skipped 2, exit 0.
- `test/e177b-lane-status.test.mjs` and every other pre-existing test green without edits beyond the re-pins above.

## Verdict

PASS for all ten tasks (T-E154-01, T-E136-01, T-E136-02, T-E139-01, T-E236-01, T-E154-02, T-E136-03, T-E139-02, T-E236-02, T-E139-03).

## AC Execution Log

One log for the round (all ten ids). Each proof was run from the lane worktree on HEAD 317a22d; every command exits 0 with the stated counts.

| AC | command | result |
|---|---|---|
| AC-E139-1..6, 8 | `node --test --test-name-pattern="AC-E139-N" test/e139-non-reviewer-verdict.test.mjs` for N=1,2,3,4,5,6,8 | each exit 0, 1/1 pass |
| AC-E139-7 | `node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs test/e26-gate-stats.test.mjs test/e308-single-source-tier-enum.test.mjs` | exit 0, 76/76 pass |
| AC-E139-9 | diff of `content`, `test/fixtures/compose-golden`, `test/context-budget.test.mjs` against the merge-base | prints nothing |
| AC-E236-1..7 | `node --test --test-name-pattern="AC-E236-N" test/e236-rejected-write-evidence.test.mjs` for N=1..7 | each exit 0, 1/1 pass |
| AC-E236-8 | `node --test test/qa-review-scoped-append.test.mjs test/covering-evidence.test.mjs` | exit 0, 42/42 pass |
| AC-E136-1..5, 7 | `node --test --test-name-pattern="AC-E136-N" test/e136-evidence-path-injective.test.mjs` for N=1,2,3,4,5,7 | each exit 0, 1/1 pass |
| AC-E136-6 | `node --test --test-name-pattern="recordReviewInFile sanitises path-traversal in task id" test/qa-flow.test.mjs` | exit 0, 1/1 pass |
| AC-E154-1..5 | `node --test --test-name-pattern="AC-E154-N" test/e154-multi-covers.test.mjs` for N=1..5 | each exit 0, 1/1 pass |
| AC-E154-6 | diff of `tools/lane-status.ts` and `test/e177b-lane-status.test.mjs` against the merge-base; `node --test test/e177b-lane-status.test.mjs` | diff empty; exit 0, 20/20 pass |
| AC-L1 | diff of `schema` against the merge-base | prints nothing |
| AC-L2 | registry diff, removed lines only | only `//` comment lines removed, none inside an existing GateDefinition |
| AC-L3 | name-only diff against the merge-base | only cut-listed paths plus `.current/e139/`, `qa_reports/`, `review_reports/` |
| AC-L4 | `npm run build`, then a porcelain status | zero errors, tree clean |
| AC-L5 | `node scripts/test-lock.mjs -- npm test` | exit 0, 3717 tests, 3715 pass, 0 fail, 2 skipped |

Note: the tw_update_state server that records this evidence is the already-installed build, not this lane's `dist/`, so the E236 undo is verified by the lane's own tests against `dist/`, not by this write.

## 2026-10-28T07:47:24.611Z — PASS — by qa-engineer

Summary: PASS for all ten tasks. Four new test files plus the T-E139-03 re-pins (e308 per integrator mailbox to-lane#4/#5, e295 per to-lane#8). Build clean, no dist diff, npm audit exit 0, full suite on 317a22d: 3717 tests, 3715 pass, 0 fail, 2 skipped. Spec-to-test map and AC Execution Log above.

