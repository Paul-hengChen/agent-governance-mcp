# QA Review — T-E112-03 (e112-drift-fanout-and-feature-scope)

covers: T-E112-01, T-E112-02, T-E112-03

Reviewed: `tools/drift.ts` + `tools/evidence-lookup.ts` (sr-engineer, T-E112-01),
code-reviewer's `review_reports/review_T-E112-01.md` (round 2 APPROVED, T-E112-02),
and this ticket's own new/re-baselined test coverage (T-E112-03). Lane
`<lanes-root>/e112`, branch `feat/e112-drift-fanout-and-feature-scope`,
base `1b5a48c`. No `specs/e112-*.md` exists — mini-chain per `docs/backlog.md:234`
(Wave 3 L-GATE, P1); judged against that backlog row and the approved
`scope_decision`.

Per the qa-engineer SOP scope rule: QA verifies T-E112-01 **by execution**, owns
every `test/` edit (Constitution §2), and rejects only for failing tests, missing
coverage, or test-infra defects — correctness/architecture is code-reviewer's
domain and was already adjudicated APPROVED (round 2) in
`review_reports/review_T-E112-01.md`. This review does not re-litigate that
verdict; it verifies the shipped behavior by running fixtures against the
compiled artifact, not by reading the diff.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e112-drift-fanout-and-feature-scope.txt`
manifest declared — `dispatch_mode` is absent/`"feature"`, not `"bugfix"`).

## Phase 1 — Review

Read `tools/drift.ts` (full) and `tools/evidence-lookup.ts` (full) end to end.
Independently confirmed by inspection, then re-confirmed by execution below:

- `DriftReport` declares `fanoutAdvisory: string | null` and
  `evidenceBackedIds: string[]` as non-optional fields; all 5 `return`
  statements are `JSON.stringify(report)` over a `const report: DriftReport`
  — the compiler enforces field presence on every path (deleting one yields
  TS2741, per code-reviewer's round-2 negative-compile test; re-verified here
  at runtime, see Phase 4 field-presence tests).
- `evidenceCandidateIds` excludes `baselineIds` and `handoffTaskIds` BEFORE
  `hasEvidenceAnywhere` is ever called (`tools/drift.ts:436-439`) — the
  baseline-runs-first ordering is structural, not incidental.
- `compressDriftDetails` returns a fresh `out` array
  (`tools/drift.ts:191-236`), so `details.push(buildEvidenceBackedLine(...))`
  at `:482` cannot retroactively affect `drifts.length` — `driftDetected` is
  safe to compute before that push.
- `hasEvidenceAnywhere`'s content test (`tools/evidence-lookup.ts:111-127`,
  `VERDICT_HEADING_RE`) requires the **last** verdict section to be `PASS`,
  or no verdict section at all — matches `recordReviewInFile`'s exact write
  shape (`gates/qa-review.ts:58`), with `reviewer` hardcoded to
  `"qa-engineer"` at the sole call site
  (`tools/handoff-orchestrator.ts:805`), closing the one theoretical
  starve-the-regex variant.
- `fanoutAdvisory` is never read by any gate: `grep -rn
  "fanoutAdvisory|evidenceBackedIds" gates/ index.ts content/ prompts/` (run
  fresh in this lane) prints nothing.
- Boundary compliance re-confirmed: `git diff --stat 1b5a48c` (plus
  untracked) touches only `tools/drift.ts`, `tools/evidence-lookup.ts`, their
  `dist/` output, and governance bookkeeping files. `gates/qa-review.ts`,
  `tools/evidence-file.ts`, `content/`, `schema/`, `tools/handoff-write.ts`,
  `scripts/verify-release.mjs` are untouched; no E113/E115/E116/E132/E150
  surface implemented.

No correctness/architecture objection raised — none is in scope for QA per
the SOP, and code-reviewer's round-2 APPROVED already covers that ground in
depth (C1 closed, A1 closed, Q1/P1 closed, Q2 closed; C5/Q4/Q5/A3/P3
non-blocking, filed as E112-NEW-2/E112-NEW-3).

### Copy / Visual Audit Gates (3a/3b)

No `specs/e112-*.md` exists (mini-chain), so there is no *Copy / Strings* or
*Visual Tokens* H2 to audit against. All user-facing strings introduced
(`buildEvidenceBackedLine`, `computeFanoutAdvisory`) are new advisory prose,
not spec-sourced copy — no coverage gap: the backlog row is the spec and
does not enumerate copy/visual tokens for this ticket.

## Phase 1.5 — Visual Compare

Skipped (no `design/e112-drift-fanout-and-feature-scope.md`, no `## Visual
Baselines` H2 — this is a non-UI, server-internals ticket).

## Phase 3 — Tests

**Test File Discovery**: per this lane's dispatch brief (`Test-file
placement`), created `test/e112-drift-fanout-feature-scope.test.mjs` (30
tests, new coverage) and re-baselined the three named existing files:
`test/token-efficiency.test.mjs`, `test/drift-archived-tasks.test.mjs`,
`test/drift-baseline.test.mjs` (2 new tests each in the latter two, plus
strengthened assertions in the former's pre-existing clean-headline test). No
other test file was touched or created.

### AC → test mapping (backlog row `docs/backlog.md:234`, T-E112-01/02/03 task lines)

| AC / requirement | Test(s) |
|---|---|
| Case (b) Q1: root evidence PASS diverts, not vibe drift | `case(b) Q1: [x] task with root qa_reports/review_<id>.md PASS diverts...` |
| Case (b) Q2: archived evidence PASS diverts | `case(b) Q2: [x] task with qa_reports/archive/<feature>/review_<id>.md PASS diverts...` |
| Case (b) Q3: covers:-only evidence diverts | `case(b) Q3: [x] task reached ONLY via a covers: line diverts...` |
| Case (b) Q4: no evidence keeps verbatim vibe line + flips driftDetected | `case(b) Q4: [x] task with NO evidence anywhere keeps the verbatim vibe-coding-drift line...` |
| Evidence branch 2 (no verdict section) resolves | `evidence branch: covers: line pointing at a report with NO verdict section still resolves...` |
| Zero-byte file counts (deliberate, pin as INTENDED) | `evidence branch (DELIBERATE, do not 'fix')...` |
| C1: server FAIL-only still vibe drift | `C1 regression: a server-written FAIL-only round still counts as vibe drift...` |
| C1: PASS→FAIL (last-wins) rejected | `C1 regression: PASS then a later FAIL (last-wins) is REJECTED...` |
| C1: FAIL→PASS (last-wins) accepted | `C1 regression: FAIL then a later PASS (last-wins) is ACCEPTED...` |
| C1: CRLF FAIL-only rejected | `C1 regression: a CRLF-line-ending FAIL-only record is still REJECTED...` |
| C1: covers: file ending FAIL rejected | `C1 regression: a covers: report whose own last verdict is FAIL is REJECTED...` |
| Bucket re-tiering, all 3 compression tiers | `mixed tier 1/2/3: ...` (3 tests) |
| driftBaselineIds runs first (never double-counted with evidence) | `driftBaselineIds precedence: ...`, plus 2 re-baseline tests in `drift-baseline.test.mjs` |
| Archived filter unchanged, composes with new mechanisms | `regression: an archived (## Completed) task with a PASS evidence file...`, plus 2 re-baseline tests in `drift-archived-tasks.test.mjs` |
| handoff-ahead direction unchanged | `regression: handoff-ahead drift still fires even when a PASS evidence file exists...` |
| FAIL/Blocked passthrough unchanged | `regression: FAIL-status incomplete-tasks passthrough still fires...` |
| Case (a) NDI shape (7 rows, 1 recorded, 6 unrecorded) | `case(a) NDI shape: 7 rows, 1 [x] ledger-recorded, 6 unrecorded...` |
| Case (a) negative (fanoutAdvisory null, byte-identical clean string) | `case(a) negative: fully-accounted task list...`, plus strengthened `token-efficiency.test.mjs` clean-headline test |
| Case (a) lane signals (feature-split.md, linked-worktree .git file), non-throwing on absent/odd | 4 `case(a) lane signals: ...` tests |
| Both new fields present on all 5 return paths | 4 `field presence (early return N/4): ...` tests (version skew, fresh project, tasks-no-handoff, handoff-no-tasks) + main-path coverage throughout |
| Measured 2026-09-18 three-lane-merge incident | `measured incident (2026-09-18 shape): merged-lane ledger reset...` |

**Coverage Gate**: `tools/drift.ts` and `tools/evidence-lookup.ts` are
exercised across every branch named in the code-reviewer's round-2 verdict
(quadrants, C1 edge cases, both evidence-resolution branches, symlink-A1
scope untouched — A1/A3 remain code-reviewer's domain and are not
re-verified here since QA does not own security/architecture findings).
Tooling (`c8`/`nyc`) is not wired into this repo's test harness; coverage is
asserted by branch enumeration against the reviewed diff instead (noted per
SOP 6c).

**Security Smoke**: covered implicitly by the C1 regression tests (malformed
verdict content: CRLF, reopened rounds) and by the zero-byte-file boundary
test; path-traversal and symlink-confinement hygiene were code-reviewer's
verified domain (round-2 Security section) and are not duplicated here.

## Phase 3.5 — AC Execution Log

Skipped (no `specs/e112-*.md`, so no `proof:`-annotated Acceptance Criteria
exist).

## Phase 4 — Run

- **Build**: `npm run build` — zero errors (tsc + check:version +
  check:transitions-sync all OK).
- **Type check**: `npx tsc --noEmit` — clean, zero errors.
- **New/re-baselined files in isolation**:
  `node --test test/token-efficiency.test.mjs test/drift-archived-tasks.test.mjs
  test/drift-baseline.test.mjs test/e112-drift-fanout-feature-scope.test.mjs`
  → 67/67 pass.
- **Full regression suite**: `node --test test/*.test.mjs` →
  **2169/2169 pass, 0 fail** (baseline was 2135/2135; +34 from this ticket:
  30 new in `test/e112-drift-fanout-feature-scope.test.mjs`, 2 new each in
  `test/drift-archived-tasks.test.mjs` and `test/drift-baseline.test.mjs`;
  `test/token-efficiency.test.mjs`'s existing clean-headline test was
  strengthened in place, not counted as new).
- **CI runnability**: `node --test` runs headlessly, zero human interaction.
- **Security**: `npm audit --audit-level=high` → exit 0 (6 pre-existing
  moderate/low advisories in `hono`/`protobufjs`/`qs` transitive deps,
  unrelated to this ticket's diff, none at or above `high`).

## Bar check (該叫的時候叫、不該叫的時候不叫)

Both directions proven, not just the quiet one:
- **Should fire**: Q4 (no evidence), every C1 regression case (server-written
  FAIL, PASS→FAIL, CRLF FAIL, covers: FAIL), the NDI fan-out shape.
- **Should stay silent**: Q1/Q2/Q3 (evidence-backed), FAIL→PASS, the
  covers:-no-verdict branch, the zero-byte branch (declared trade-off), the
  fully-accounted case(a) negative, the archived-task exclusion.

## Residuals (recorded, not fixed — out of scope for this ticket)

`E112-NEW-2` (fenced-code-block verdict scanning, measured zero incidence on
real corpus) and `E112-NEW-3` (symlinked evidence *file* / symlinked
`qa_reports/` root not confined by `lstatSync`) are code-reviewer's filed
findings in `NEW-TICKETS.md`. Not fixed here (explicitly out of this
ticket's boundaries) and not additionally pinned by new tests beyond the
zero-byte-file INTENDED pin already listed above, to avoid manufacturing
test coverage for behavior this ticket is not authorized to change.

## Verdict

**PASS.** T-E112-01 verified by execution (not by reading the diff);
T-E112-02's APPROVED verdict stands unchallenged (out of QA's scope to
relitigate); T-E112-03's new + re-baselined tests close the "zero tests
reference fanoutAdvisory/evidenceBackedIds" gap code-reviewer flagged, proving
both distortion cases fire when they should and stay silent when they should
not. Full suite green (2169/2169), build clean, `tsc --noEmit` clean, `npm
audit --audit-level=high` exit 0. No `docs/backlog.md` row done-marked (release
bookkeeping, not QA's).
## 2026-09-22T03:09:12.787Z — PASS — by qa-engineer

T-E112-03 PASS: verified T-E112-01 (evidence-aware vibe-drift split + fan-out advisory in tools/drift.ts + tools/evidence-lookup.ts) by execution against synthetic fixtures, not by reading the diff. Added test/e112-drift-fanout-feature-scope.test.mjs (30 tests: four case-(b) quadrants, all C1 regression edges (FAIL-only, PASS-then-FAIL, FAIL-then-PASS, CRLF, covers:-FAIL), both evidence-resolution branches plus the zero-byte-file INTENDED trade-off, all three compression-tier re-tierings, driftBaselineIds-runs-first precedence, case-(a) NDI fan-out shape + negative + lane signals, all 4 early-return field-presence pins, and the measured 2026-09-18 three-lane-merge incident). Re-baselined test/token-efficiency.test.mjs (strengthened the clean-headline test to byte-identical + fanoutAdvisory===null), test/drift-archived-tasks.test.mjs (+2), test/drift-baseline.test.mjs (+2) confirming the archived-section filter and driftBaselineIds precedence are behaviorally unchanged. Full suite 2169/2169 green (was 2135/2135), npm run build clean, npx tsc --noEmit clean, npm audit --audit-level=high exit 0. code-reviewer's T-E112-02 round-2 APPROVED verdict stands unchallenged (correctness/architecture out of QA scope). Evidence: qa_reports/review_T-E112-03.md (covers: T-E112-01, T-E112-02, T-E112-03).

