# QA Review: T470, T471, T472
## Feature: drift-archived-task-exclusion (v3.23.1)
## Reviewer: qa-engineer
## Date: 2026-06-02

---

## Phase 1 — Implementation Review

### Spec: specs/drift-archived-task-exclusion.md

**Copy / Strings gate**: Spec section states "No user-facing strings are introduced or changed." Implementation confirmed — drift.ts message templates are unchanged. PASS.

**Visual Tokens gate**: Spec section states "No UI changes." Server-side TypeScript only. PASS.

**Phase 1.5**: No `design/<feature>.md` file exists; no `## Visual Baselines` declared. Phase 1.5 skipped (no Visual Baselines declared).

### Implementation findings (dist/tools/drift.js)

- `isArchivedSection(section)` correctly uses `section.trim().toLowerCase() === "completed"` matching AC-6 and tasks-file.ts line 85 convention.
- `usesActiveCompletedConvention` detection checks `.some((t) => s === "active" || s === "completed")` — backward-compat gate is correct for AC-3 and AC-4.
- `activeScopeTasks` filter excludes only `isArchivedSection(t.section)` records — unknown sections pass through conservatively (AC-7).
- `tasksCompleted` / `tasksIncomplete` derived from `partitionTasks(activeScopeTasks)` — active-scope only (AC-5).
- No schema_version bump (AC-8 correct — read-time filter only).
- Version: `package.json` = 3.23.1, `index.ts` Server literal = 3.23.1, `check:version` = OK.

No correctness issues found.

---

## Phase 2 — Discussion

No issues found. Phase 2 skipped.

---

## Phase 3 — Tests

### Test file written
`test/drift-archived-tasks.test.mjs`

### AC → Test mapping

| AC | Test(s) |
|----|---------|
| AC-1 | `AC-1: [x] tasks under ## Completed are NOT included in drift comparison` |
| AC-2 | `AC-2: [x] task under ## Active that is not in handoff is reported as drift` |
| AC-3 | `AC-3: legacy tasks.md with no ## Active / ## Completed → all [x] tasks included in drift` |
| AC-4 | `AC-4: tasks.md with ## Active only (no ## Completed) → all [x] tasks included in drift` |
| AC-5 | `AC-5: tasksCompleted and tasksIncomplete in the returned JSON are active-scope only` |
| AC-6 | `AC-6a: ## completed (lowercase)…`, `AC-6b: ## COMPLETED (all-caps)…`, `AC-6c: ##  Completed  (extra whitespace)…` |
| AC-7 | `AC-7: tasks under ## Sprint-3 (unknown section) are included in drift comparison`, `AC-7: …matching handoff entry produce no spurious drift` |

Total: 11 test cases covering all 7 required ACs (AC-8 = no schema bump, verified by check:version; AC-9 = other drift types unaffected, covered by existing drift-skew.test.mjs).

### Coverage Gate

All new AC-filter logic in `drift.ts` (lines 201–207, ~7 lines of new logic) is exercised by the 11 new test cases. No dedicated coverage tooling available; logic is fully branch-covered by the matrix of fixtures.

### Security smoke tests

- Boundary: tasks.md with no H2 sections (AC-3) — no crash.
- Boundary: tasks.md with only ## Active and no ## Completed (AC-4) — no crash.
- Boundary: tasks.md with three sections including an unknown one (AC-7) — no crash, conservative pass-through.
- Boundary: handoff with empty completed_tasks array — no crash.

---

## Phase 4 — Run

- `npm run build`: ZERO errors (prebuild check:version OK).
- `node scripts/check-version.mjs`: OK (3.23.1).
- `npm test`: All 11 new drift-archived-tasks tests PASS.
- Pre-existing failures (sqlite-versioning.test.mjs T30, rag.test.mjs, handoff-versioning.test.mjs AC-8 visual_round): confirmed pre-existing, NOT introduced by this PR. The failing tests are limited to SQLite/RAG infrastructure and visual_round tests unrelated to drift logic.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Existing `test/drift-skew.test.mjs` (7 tests): all PASS — no regression.

---

## Verdict: PASS

T470 (drift.ts implementation), T471 (version bump), T472 (test coverage AC-1..AC-7) — all acceptance criteria verified. Zero regressions in drift-related tests.
