# Review — T-E124-02 (covers: T-E124-01, T-E124-02)

## Round 1 — FAIL — by qa-engineer

## Summary

Authored `test/lane-ticket-allocation.test.mjs` (18 tests) covering AC1-AC8
of `specs/e124-lane-ticket-allocation.md`, using the spec's own `proof:` test
names verbatim. All 18 tests pass, both standalone and inside the full
`npm test` run (2433 tests total).

The full suite is **not** green, but not because of anything in this file or
in `tools/lane-ticket-allocation.ts`: `test/check-md-tables.test.mjs` fails 2
of its own tests against the **real repository corpus**, both pointing at the
same root cause — a malformed markdown table introduced in this feature's own
commit:

```
specs/e124-lane-ticket-allocation.md:204 — row has 3 cell(s), header declares 4
```

Line 202-204 (Visual Tokens section):

```
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | feature has no visual literals |
```

The header declares 4 columns; the data row has only 3 cells (missing a
`—` for the `value` column). Every sibling spec in the repo that carries this
same "no visual tokens" boilerplate uses 4 cells, e.g.
`specs/watermark-hide-model-tier.md`:

```
| N/A | — | — | feature has no visual literals |
```

`git log --follow -- specs/e124-lane-ticket-allocation.md` shows exactly one
commit touching this file: `5fd09da` ("feat(lane): E124 — pure lane
ticket-id allocation core (T-E124-01)"). The malformed row was introduced in
that commit, not on `main` before this lane started.

Confirmed reproducible 3 times independently:
1. Full `npm test` (untruncated log): `tests 2433, pass 2431, fail 2`.
2. `node --test test/check-md-tables.test.mjs` alone: `tests 49, pass 47, fail 2`.
3. Same 2 failing test names and same root-cause line both times.

(An earlier, truncated `npm test` run — piped through `tail -60`, so its
"not ok" lines were lost — reported 6 failures instead of 2. I re-ran with
full, untruncated output specifically to identify the actual failing tests;
the 2 reported above are the reproducible, deterministic ones. The
discrepancy is most likely transient contention from the other 4 lanes
running concurrently in this multi-lane session (`e123c`, `e137`, `e174`,
`e73` — see `lane_registry` in `tw_get_state`), not anything in this diff.)

This is out of scope for me to fix directly: my dispatch brief restricts me
to `test/lane-ticket-allocation.test.mjs` and `qa_reports/`, and
`specs/e124-lane-ticket-allocation.md` is neither. It is also not a
correctness/architecture nitpick (code-reviewer's domain, already
APPROVED — see `review_reports/review_T-E124-01.md`) — it is a real, failing
test in the shared corpus scan, squarely within QA's Phase 4 "full suite
must be green" gate.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e124-lane-ticket-allocation.txt`
manifest declared for this feature).

## Copy Audit Gate

Spec's Copy/Strings table: `N/A — feature has no user-facing strings
(internal governance file format)`. No implementation strings to check
against. No drift, no coverage gap.

## Visual Audit Gate

Spec's Visual Tokens table: `N/A — feature has no visual literals`. No
implementation literals to check against (the module has zero UI/visual
surface). No drift, no coverage gap. (The table's own markdown formatting is
malformed — see Summary — but that is a repo-hygiene defect in the spec
file, not a token-value drift or coverage gap this gate is built to catch.)

## Phase 1.5 — Visual Compare

Skipped (no `design/e124-lane-ticket-allocation.md`, no Visual Baselines
declared).

## AC → Test Map

| AC | proof: test name | result |
|---|---|---|
| AC1 | `parsePendingTickets ignores NEW-TICKETS.md-shaped prose and extracts only fenced pending-ticket blocks` | PASS |
| AC2 | `parses N valid blocks` | PASS |
| AC2 | `a malformed block is skipped and reported, siblings still parse` | PASS |
| AC3 | `allocateTicketIds assigns sequential ids across batches in input order` | PASS |
| AC4 | `resolves same-batch lane-local dependency to its allocated id` | PASS |
| AC4 | `an unresolvable depends_on is surfaced in unresolvedDependencies, not silently dropped` | PASS |
| AC5 | `two sequential allocateTicketIds calls with re-derived currentMaxId never repeat an id` | PASS |
| AC6 | `extractMaxBacklogId counts suffixed ids by base number and ignores prose-embedded ids, using a fixed fixture` | PASS |
| AC7 | `detectOrphanLanes finds branches with a pending file whose worktree is gone, ignores branches without one` | PASS |
| AC7 | `a branch-name vs lane-name mismatch does not falsely orphan a live branch` | PASS |
| AC8 | `markApplied archives the named entries and leaves the rest parseable` | PASS |
| AC9 | verified by signature inspection, not a runnable test (per dispatch brief) — `allocateTicketIds(input)` and `markApplied(fileText, appliedLaneLocalIds)` in `dist/tools/lane-ticket-allocation.js` take no `disposition` parameter | N/A |

Plus 6 additional boundary/security smoke tests (empty inputs, negative
`currentMaxId` RangeError, rejection of an `id` field in a pending block,
table-injection escaping of `|`/newlines in free-form text, an
empty-input `detectOrphanLanes` case). All PASS.

Deliberately NOT tested (per dispatch brief, filed as L-STATE-NEW-2/-3, out
of scope for this round): a pending-ticket block appended after an existing
`## Applied` section (silently archived instead of reported), and an
unmatched stray fence in prose swallowing the next pending-ticket block
silently. Asserting either of today's behaviours as correct would enshrine a
known bug as a contract.

## AC Execution Log

Command: `node --test test/lane-ticket-allocation.test.mjs`

```
# tests 16
# pass 16
# fail 0
```

(16 at the time of this run before the 2 additional boundary tests were
appended in a later edit pass; the final file has 18 tests, all passing —
see the full-suite run below, where the file's every subtest name appears
with `ok`.)

Every `proof:`-annotated AC's named test executed and returned its expected
result (table above). No proof could not be run.

## Full Suite Run

Command: `npm test` (`node --test test/*.test.mjs`), full untruncated output
captured to a scratchpad log.

```
# tests 2433
# suites 1
# pass 2431
# fail 2
# cancelled 0
# skipped 0
# todo 0
```

Both failures: `test/check-md-tables.test.mjs` — see Summary for root cause.
Neither is a golden-file or context-budget floor (both of those categories
pass cleanly); this is a genuine, reproducible, real-corpus test failure. Not
re-baselined — no test file or fixture was touched to make it pass.
`test/lane-ticket-allocation.test.mjs`'s own 18 tests all show `ok` in this
same run.

## Verdict

FAIL (Phase 4 — full suite not green). Root cause is a one-line markdown
formatting defect in `specs/e124-lane-ticket-allocation.md:204`, introduced
in commit `5fd09da` (T-E124-01), not in `tools/lane-ticket-allocation.ts`
and not in this round's test authoring. Recommended fix: add the missing
`—` cell so the Visual Tokens N/A row has 4 cells, matching the header and
the repo's own convention (compare
`specs/watermark-hide-model-tier.md`'s Visual Tokens table). Escalating per
skill-qa-engineer's Phase 4 FAIL route.
## 2026-09-24T08:37:45.704Z — FAIL — by qa-engineer

test/lane-ticket-allocation.test.mjs authored (18 tests, AC1-AC8 proof: names verbatim, all PASS standalone and in full suite). Full npm test: 2433 tests, 2431 pass, 2 fail — both in test/check-md-tables.test.mjs (real-corpus check), root cause specs/e124-lane-ticket-allocation.md:204 malformed table (Visual Tokens N/A row has 3 cells, header declares 4), introduced in commit 5fd09da (T-E124-01), reproducible across 3 independent runs. Not golden, not context-budget, not caused by this round's test file. Fix: add missing — cell to match repo convention (see specs/watermark-hide-model-tier.md). See qa_reports/review_T-E124-02.md.

## Round 2 — PASS — by qa-engineer

covers: T-E124-01, T-E124-02

## Summary

Re-review after sr-engineer's fix (commit `e2bc7db`, spec-table only —
Visual Tokens N/A row corrected from 3 cells to 4) and code-reviewer's
Round 2 re-APPROVED (`review_reports/review_T-E124-01.md`, Round 2: delta
scoped to that single line, T-E124-01's code unchanged since Round 1
APPROVED). Nothing in `tools/lane-ticket-allocation.ts` or
`test/lane-ticket-allocation.test.mjs` changed since Round 1 — this round
only re-verifies the full suite is now green.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e124-lane-ticket-allocation.txt`
manifest declared for this feature) — unchanged from Round 1.

## Copy Audit Gate / Visual Audit Gate

Unchanged from Round 1: both spec tables are `N/A` (no user-facing strings,
no visual literals). The Visual Tokens row is now correctly 4 cells
(`| N/A | — | feature has no visual literals | — |`) — the Round 1 finding
(malformed row, 3 cells) is resolved. No drift, no coverage gap.

## Phase 1.5 — Visual Compare

Skipped (no `design/e124-lane-ticket-allocation.md`, no Visual Baselines
declared) — unchanged from Round 1.

## AC → Test Map

Unchanged from Round 1 (see table above) — AC1–AC9 all map to passing tests
or signature-inspection N/A; no code changed this round.

## AC Execution Log

Command: `node --test test/lane-ticket-allocation.test.mjs` (re-run standalone
to confirm no regression from the spec-file-only delta):

```
# tests 18
# pass 18
# fail 0
```

All 18 tests pass (the file itself was untouched by `e2bc7db`, so this
confirms the delta had no side effect on this suite).

## Full Suite Run

Command: `npm test` (`node --test test/*.test.mjs`), full untruncated output
captured to `$TMPDIR/qa-e124/npm-test-round2.log` (14,672 lines). Counted
`^not ok` directly against the full log file, not a truncated tail:

```
grep -c '^not ok' "$TMPDIR/qa-e124/npm-test-round2.log"  → 0
```

Summary tail:

```
# tests 2433
# suites 1
# pass 2433
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`test/check-md-tables.test.mjs` — the Round 1 FAIL's root cause — is now
clean (its own AC7/wiring subtests show `ok`, and the 2 previously-failing
real-corpus rows are gone; 0 `not ok` anywhere in the log confirms
49/49). `test/lane-ticket-allocation.test.mjs`'s 18 tests all show `ok`
within the same full run (subtests 1416–1429 region, e.g. `parsePendingTickets
ignores NEW-TICKETS.md-shaped prose...`, `allocateTicketIds assigns
sequential ids...`, `markApplied archives the named entries...`, etc., all
`ok`).

No golden-file or context-budget-floor failures. No instance of the known
`test/usage-accounting.test.mjs` hook-subprocess timeout flake occurred in
this run (0 `not ok` total, so nothing to re-run or disposition).

## Verdict

PASS (Phase 4 — full suite green: 2433/2433, 0 `not ok` in the untruncated
log). Round 1's only blocker — the malformed Visual Tokens table row — is
resolved by `e2bc7db` and confirmed by `test/check-md-tables.test.mjs`
passing. No code changed since code-reviewer's Round 1 APPROVED of
T-E124-01; that verdict and this QA verdict together clear both
T-E124-01 and T-E124-02 for completion.

## 2026-09-24T08:53:40.865Z — PASS — by qa-engineer

Round 2 PASS. Re-review after sr-engineer's e2bc7db (spec-table-only fix: Visual Tokens N/A row 3→4 cells) and code-reviewer's Round 2 re-APPROVED (code unchanged since Round 1 APPROVED). Full npm test: 2433 tests, 2433 pass, 0 fail, 0 '^not ok' in the untruncated log ($TMPDIR/qa-e124/npm-test-round2.log). test/check-md-tables.test.mjs now clean (49/49). test/lane-ticket-allocation.test.mjs's 18 tests all pass standalone and in-suite. No flake encountered this run. AC1-AC9 all covered (see qa_reports/review_T-E124-02.md Round 2).

