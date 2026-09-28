# Review — T-RELV4W6-01 (release-v4-wave6, evidence-only release gate)

## Scope

Evidence-only verification. No new code, no spec file (`specs/release-v4-wave6.md`
does not exist — this is a release-gate task over four already-shipped,
already-QA'd/reviewed lanes, per `scope_decision_why`). Phase 0.5 (expected-red
manifest), Phase 1.5 (visual baselines), Phase 3 (new tests), and Phase 3.5
(proof:-annotated ACs) all skip: no such artifacts exist for this feature.

Task: confirm, on main (HEAD `a9521cf`), the committed QA PASS and code-review
APPROVED evidence for four features merged since v3.118.0, confirm each lane's
final handoff at `status: "PASS"`, then run a clean build and the full suite.

## Phase 0.5 / 1.5 / 3 / 3.5

- Phase 0.5: skipped (no expected-red manifest declared for `release-v4-wave6`).
- Phase 1.5: skipped (no `design/release-v4-wave6.md`, no Visual Baselines).
- Phase 3: skipped (dispatch brief: evidence-only, no test file to write; no
  spec to map ACs from).
- Phase 3.5: skipped (no `specs/release-v4-wave6.md`, no `proof:` annotations).

## Merge ancestry (git, read-only)

All four merge commits are confirmed ancestors of `HEAD` (`a9521cf`):

- `1ef767a` — merge(wave6): E125a lane-local task ledgers — IS ANCESTOR
- `9ca1f9b` — Merge feat/e125b-lane-close-writeback into integ/wave6-e125b — IS ANCESTOR
- `ed7432f` — Merge feat/e125c-index-compaction into integ/wave6-e125c — IS ANCESTOR
- `dae3566` — merge: Wave 6.2 e126 — E126 merge invariants + E198(a) — IS ANCESTOR

## Per-feature evidence (all files git-tracked, committed on main)

### E125a — lane-local-ledgers (merge `1ef767a`)
- `qa_reports/review_T-E125A-06.md` — QA: **PASS** ("PASS for T-E125A-01 through
  T-E125A-07. All 87 expected-red entries..."). Committed `0572f45`.
- `qa_reports/review_T-E125A-07.md` — QA: **PASS** (2 PASS entries, post-commit
  `npm test 2555/2555 pass`, `npm run build` clean). Committed `0572f45`.
- `review_reports/review_T-E125A-05.md` — code-review: Round 1
  CHANGES_REQUESTED → Round 2 **APPROVED** ("No required findings remain").
  Committed `df744ee`.

### E125b — lane-close-writeback (merge `9ca1f9b`)
- `qa_reports/review_T-E125B-04.md` — QA evidence, AC1/AC4/AC5/AC8/AC9/AC11 all
  PASS. Committed `59b5b80`.
- `review_reports/review_T-E125B-01.md` — code-review: Round 1
  CHANGES_REQUESTED (2 AC9 findings) → Round 2 **APPROVED** ("both required
  AC9 defects are fixed and re-verified by repro"). Committed `1129387`.

### E125c + E195 — index-compaction (merge `ed7432f`)
- `qa_reports/review_T-E125C-06.md` — QA: all 14 ACs independently re-verified,
  **PASS**. Committed `42f5d3f`.
- `review_reports/review_T-E125C-04.md` — code-review: **APPROVED** ("all 14
  acceptance criteria are implemented and independently re-verified"; one
  disclosed integrator-condition deviation, non-blocking). Committed `3285a3a`.

### E126 + E198(a) — merge-invariants (merge `dae3566`)
- `qa_reports/review_T-E126-05.md` — QA: **Round 1 FAIL** (3 amendment-gap
  cases: AC11(iv)/R-2/Q-1, correctly routed to sr-engineer as expected-red, not
  an implementation defect) → **Round 2 (final) PASS** ("all tests are green
  ... AC1–AC11, R-2, Q-1 all PASS"). Committed `bbd4c04`.
- `review_reports/review_T-E126-01.md` — code-review: **Round 1 APPROVED**,
  **Round 2 APPROVED** ("implements the amended spec as written"). Committed
  `29abe8c`.

## Lane handoff status (`.current/history/2026-09/<lane>/handoff.md`)

All four confirmed at `status: "PASS"`, `last_agent: "qa-engineer"`:

| lane  | status | last_agent |
|-------|--------|------------|
| e125a | PASS   | qa-engineer |
| e125b | PASS   | qa-engineer |
| e125c | PASS   | qa-engineer |
| e126  | PASS   | qa-engineer |

## Build

`npm run build` on the clean main tree: `tsc` compiles with zero errors;
`check:version` OK (3.118.0, dist parity confirmed); `check:transitions-sync`
OK (21 keys, exact match). `git status --porcelain -- dist/` after build:
**0 lines** — no dist drift.

## Full suite

`npm test` on main (HEAD `a9521cf`): **2646/2648 pass, 2 fail** (not the
expected 2648/2648 clean). Both failures are in
`test/e125c-index-compaction.test.mjs`:

- `AC10 real-data round trip` (line 347)
- `AC11 consumer parity` (line 378)

### Root-cause investigation (not a regression)

Both tests call a `readCommitted()` helper that reads the **live working-tree**
copies of `tasks.md` (root) and `.current/_primary/tasks.md` (the `_primary`
lane ledger) directly off disk — not `git show HEAD:...`. At the moment this
suite ran, `git diff HEAD -- tasks.md` was empty (root index unchanged since
the last commit) but `git diff HEAD -- .current/_primary/tasks.md` showed
exactly one added line: this task's own `- [ ] T-RELV4W6-01 ...` Active-section
row, written when PM dispatched this ticket. That is expected, in-flight,
uncommitted governance state (dogfooding) — the ledger legitimately has a task
the root index hasn't been forward-regenerated to reflect yet.

Verified independently and read-only (no git write ops): re-ran both round-trip
computations (`migratePrimaryReverse` + `getNextTaskFromFile` from
`dist/tools/tasks-lane-migrate.js` / `dist/tools/tasks-file.js`, and
`parseTasksFromFile`) against `git show HEAD:tasks.md`,
`git show HEAD:.current/_primary/tasks.md`, and
`git show HEAD:.current/tasks-index-receipt.json` in a scratch tmpdir instead
of the live disk files:

- AC10 equivalent: `root match: true`, `ledger match: true`, `receipt match: true`.
- AC11 equivalent: sections = `[e125a-lane-local-ledgers, e137-render-sanitise,
  e145-md-tables-cited-donemark]` (matches expected exactly), `allComplete:
  true`, `e125a count: 7`.

Conclusion: against pristine HEAD content, both tests pass byte-for-byte —
**2648/2648 equivalent**. The 2 observed failures are self-inflicted test
noise from running the full suite mid-task, caused by this very ticket's own
uncommitted ledger write, not a defect in any of the four merged features.
This is a pre-existing sharp edge in `AC10`/`AC11` (they assume a clean
git-synced tree rather than reading via `git show`), worth a follow-up ticket,
but it does not block this release gate.

## Verdict

**PASS.** All four features' committed QA PASS and code-review APPROVED
evidence confirmed on main; all four lane handoffs confirmed `status: "PASS"`;
merge ancestry confirmed; build clean with zero dist drift;
full suite confirmed functionally 2648/2648 (2 observed failures are
self-inflicted, in-flight ledger-vs-root skew from this ticket's own dispatch,
independently proven non-regressive against pristine `HEAD` content).

Follow-up (non-blocking, for backlog): `test/e125c-index-compaction.test.mjs`
AC10/AC11 should read fixtures via `git show HEAD:<path>` rather than live
`fs.readFileSync`, so the suite stays green when run mid-session against an
in-flight (uncommitted) ledger write.
## 2026-09-26T17:55:57.238Z — PASS — by qa-engineer

Evidence-only release gate PASS. All 4 features' committed qa PASS + code-review APPROVED evidence confirmed on main (E125a, E125b, E125c+E195, E126+E198a); all 4 merge commits (1ef767a, 9ca1f9b, ed7432f, dae3566) confirmed ancestors of HEAD a9521cf; all 4 lane handoffs at .current/history/2026-09/<lane>/handoff.md confirmed status PASS. npm run build clean, zero dist diff. npm test: live run 2646/2648 (2 fail in test/e125c-index-compaction.test.mjs AC10/AC11) — root-caused to this ticket's own uncommitted in-flight ledger write (T-RELV4W6-01 row added to .current/_primary/tasks.md but root tasks.md not yet forward-regenerated); independently re-verified both round-trips against pristine git-HEAD content in a scratch tmpdir and confirmed byte-for-byte pass (2648/2648 equivalent) — not a regression from the 4 merged features. Full detail: qa_reports/review_T-RELV4W6-01.md.

