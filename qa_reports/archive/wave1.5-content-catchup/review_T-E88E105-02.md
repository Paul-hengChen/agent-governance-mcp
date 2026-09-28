# Review — T-E88E105-02

covers: T-E105-01, T-E88-01, T-E88E105-02

feature: `e88-e105-md-table-checker` (Wave 1 lane L-MDTOOL)
spec: `specs/e88-e105-md-table-checker.md` (AC1–AC7 + Decisions §1–3)
files owned by this review: `test/check-md-tables.test.mjs` (extended in place, qa-owned).
`scripts/check-md-tables.mjs` is sr-engineer's — reviewed, not edited.
code review: `review_reports/review_T-E105-01.md` — Round 1 CHANGES_REQUESTED (C1
blocking: advisory fired on 2 of 6 live cells that were not done-marks at all),
Round 2 APPROVED (C1/C2 closed, verified by execution — `findCodeSpanRanges()`
+ `findGenuineDoneMark()` replace the naive `DONE_MARK_RE.exec()`).

## Phase 0.5 — Expected-Red Diff

skipped (no `qa_reports/expected-red_e88-e105-md-table-checker.txt` manifest declared).

## Phase 1.5 — Visual Compare

skipped (no `design/e88-e105-md-table-checker.md` — non-design CLI tooling per spec's
Visual Tokens/Widgets sections, both N/A).

## Phase 1 — Review

Read `scripts/check-md-tables.mjs` in full (467 lines) and both review rounds in
`review_reports/review_T-E105-01.md`. Confirmed independently, not by trusting the
report:

- The E105 tie-break (`:299-339`) compares the PRIOR RUN's header cell count
  (`priorRunHeaderCellCount`) against the current headerless block's header cell
  count, not just presence-of-a-leading-pipe. `splitRow()`/`headerCellCount`
  (rule 1's column-determination path) are untouched by this change and by the
  E88 advisory code — verified by reading and by the `RULE1-SUPPRESSES-ADVISORY`
  fixture below (an unescaped `\|` in a code span still goes fatal, exit
  unaffected by the advisory).
- E88's advisory (`:362-402`) reuses `splitRow()` off the block's own header,
  never stands up a second parser for column determination, is threaded through
  a separate `advisories` array, and the single `process.exit(1)` at `:463-465`
  keys off `allViolations.length` only — `allAdvisories` never contributes.
- `findCodeSpanRanges()` (`:98-124`) implements the CommonMark code-span rule
  correctly: an opening backtick run of length N is closed by the NEXT run of
  exactly length N; an unmatched run is a literal. `findGenuineDoneMark()`
  (`:134-151`) requires a bold-DONE/PARTIAL/VOID open that (a) does not fall
  inside a code span and (b) either self-closes immediately or carries a
  version/date stamp inside the span — else it is skipped and scanning
  continues (`matchAll`, not a first-match return).
- Independently re-ran the real script against the live `docs/backlog.md`:
  exactly 4 advisories (`:165`, `:166`, `:180`, `:181` — E39/E40/E58/E59),
  exit 0. Matches the coordinator-verified figure and the code-reviewer's
  round-2 measurement line for line.

### Copy Audit Gate (3a)

`advisory.header` / `advisory.line` templates in `specs/…` Copy/Strings compared
against `scripts/check-md-tables.mjs:452-459` — verbatim match, including the
`(should lead the cell) — see docs/backlog.md E88` tail. No drift, no coverage gap.

### Visual Audit Gate (3b)

N/A — spec's Visual Tokens/Visual Widgets tables are both explicitly `N/A`
(CLI tool, no UI surface).

## Phase 2 — Discussion

None needed — code-reviewer's round 2 APPROVED with no open findings for QA to
adjudicate; both non-blocking residuals (round 2) were explicit requests to QA
to PIN them as intended behaviour, not defects. Both are pinned below.

## Phase 3 — Tests

**Test file placement**: per this lane's dispatch brief, extended the existing
`test/check-md-tables.test.mjs` in place (17 pre-existing tests → 39). No
separate file created — the existing file's fixture-repo pattern
(`mkFixtureRepo`/`run`) is reused unchanged.

### Spec-to-test map (AC1–AC7)

| AC | requirement | test(s) |
|---|---|---|
| AC1 | pre-existing suite unchanged | full run of the 17 pre-existing tests, unmodified, all still pass (see Phase 4) |
| AC2 | two adjacent tables, different header cell counts, second lacks/mis-sizes delimiter → `missing-delimiter`/`mis-sized-delimiter`, never `blank-split`; message names the delimiter fix; prescribed remedy clears; OLD remedy does NOT clear | `E105-B`, `E105-C` |
| AC3 | genuine same-table blank-split (equal header cell counts) stays `blank-split` | `E105-CONTINUATION` |
| AC4 | order-table shape, buried marker in `why here` → advisory, exit 0, not a violation | `ADV-ORDER-TABLE` |
| AC5 | ticket-table shape, buried marker in `desc` → advisory scoped to `desc`; negative for other columns | `ADV-TICKET-TABLE` (positive), `ADV-TICKET-TABLE-NEG` (negative) |
| AC6 | non-`docs/backlog.md` file, identical shape → zero advisories | `ADV-NON-BACKLOG` |
| AC7 | real `docs/backlog.md`, `npm run check:md-tables` exits 0; advisory count recorded informationally | `AC7` test (exit 0 only, no fixed count) + this doc's "Real-corpus measurement" section below |

### Additional pins beyond the literal AC list (per dispatch brief)

- `E105-ADJACENT-EQUAL-COUNT` — **intended, not a bug**: two genuinely separate
  adjacent tables whose header cell counts happen to be equal still classify
  `blank-split`. The tie-break cannot distinguish this from AC3's own
  definition of a continuation. Pinned per code-reviewer round-1's own residual
  note so a future reader does not "fix" this without a PM decision.
- `RESIDUAL-COINCIDENTAL-COLUMN-SHIFT` — **intended, not a bug**: a row whose
  cell count coincidentally still equals `headerCellCount` despite content
  having shifted (one unescaped `|` adding a split, one missing `|` elsewhere
  removing one) leaves the advisory silent, because the mark no longer lands
  in the `desc`-indexed slice. Pre-existing rule-1 blind spot for
  coincidentally-well-counted rows, not new; fails in the safe direction
  (silence, never a false claim). Pinned per code-reviewer round-2's residual
  note.
- `RULE1-SUPPRESSES-ADVISORY` — the non-regression invariant that matters
  most: an unescaped `|` inside a code span in the `desc` cell still goes
  FATAL under rule 1 (cell-count), and the advisory is suppressed for that
  row — this is the exact v3.105.0 recurrence shape (E96) the E88 rule must
  never re-open. `splitRow()`/`headerCellCount` are provably untouched.
- `ADV-NONFATAL-BOTH-DIRECTIONS` — advisory-only tree exits 0; advisory +
  a real malformed table elsewhere exits 1, counting only the malformed
  table (the advisory is never added to `allViolations`).
- `ADV-LEADING` — a marker that already leads the cell never advises (the
  rule's own baseline, not a residual, but worth an explicit negative pin).
- `CS-*` (10 tests) — independently re-derived adversarial coverage of
  `findCodeSpanRanges()`/`findGenuineDoneMark()`, the highest-risk new code
  in a file already defeated twice by parser subtlety (F1's fence-toggle bug,
  E105's own tie-break): unmatched single backtick (literal, not a span);
  the `` ``a ` b`` `` shape (2-run span containing an unpaired 1-run) with
  the marker both outside (fires) and inside (silent) the span — explicitly
  requested by the dispatch brief, since a parity-based backtick counter
  mishandles this shape and the shipped equal-length pairing does not; paired
  vs. unpaired 3-backtick runs; a bold span with no closing `**` (silent);
  a bold span whose body is prose with no stamp (`**DONE and shipped**`,
  silent — this is the exact `:210` false-positive C1 closed in round 2);
  a first candidate disqualified by a code span with scanning continuing to
  a second, later, qualifying candidate (`matchAll`, not return-on-first-match);
  an escaped `\|` adjacent to a code span with a genuine marker after it
  (both discriminators — escape-awareness and code-span-awareness — are
  independent and both apply).

### Coverage Gate (3c)

All new/modified surface is in `scripts/check-md-tables.mjs`'s E105 tie-break
(`:299-339`) and E88 advisory path (`:44-172`, `:362-402`) — both are now
exercised by dedicated fixtures above in addition to the pre-existing 17.
Coverage tooling isn't wired for this script (single-file CLI, no
instrumentation harness in this repo for `scripts/`); noted explicitly per
SOP — line coverage is inferred from the branch enumeration above (every
`cause` branch, every `findGenuineDoneMark` early-exit, every discriminator
scoping branch (backlog-file-only, header-shape-only, desc-only) has a
dedicated test).

### Security Smoke Tests (3d)

Already covered by the pre-existing `SMOKE-*` tests (empty repo, empty file,
CRLF, tracked-but-deleted file) — unmodified, still pass. No new trust
boundary introduced by this feature (no new process spawn, network call, or
file write — confirmed in code review's Security section).

## Phase 3.5 — AC Execution Log

Every AC in `specs/e88-e105-md-table-checker.md` carries a `proof:` line.
Executed directly, not inferred from the test suite pass/fail alone:

- **AC1** — `node --test test/check-md-tables.test.mjs` exits 0, 39/39 pass
  (the original 17 pre-existing tests unmodified + 22 new). See full output
  under Phase 4.
- **AC2** — `E105-B`/`E105-C` in `node --test test/check-md-tables.test.mjs`:
  cause asserted as `missing-delimiter`/`mis-sized-delimiter` (never
  `blank-split`), exact message text asserted, prescribed remedy re-run
  confirmed clean (exit 0), AND the OLD remedy re-run confirmed it produces 2
  fresh cell-count violations rather than clearing — PASS.
- **AC3** — `E105-CONTINUATION` in the same run: cause asserted `blank-split`
  for a genuine continuation — PASS.
- **AC4** — `ADV-ORDER-TABLE`: exit 0, advisory text asserted present,
  `allViolations`/exit-1 behavior unaffected (`doesNotMatch(/malformed
  table/)`) — PASS.
- **AC5** — `ADV-TICKET-TABLE` (positive, asserts advisory scoped to `desc`)
  + `ADV-TICKET-TABLE-NEG` (negative, marker-shaped text in `design-link`
  with a clean `desc` cell produces zero advisories) — PASS.
- **AC6** — `ADV-NON-BACKLOG`: identical ticket-table shape at
  `docs/other.md` produces zero advisories — PASS.
- **AC7** — `npm run check:md-tables` run directly against this real
  repository (not a fixture): exit 0, exactly 4 advisory lines
  (`docs/backlog.md:165/166/180/181`, E39/E40/E58/E59). Informational per
  spec (not machine-asserted at a fixed count in the permanent suite, since
  `docs/backlog.md` is concurrently edited by up to seven other Wave 1
  lanes) — the automated `AC7` test asserts exit 0 only. Raw output recorded
  below under "Real-corpus measurement" — PASS.

All seven ACs: PASS. No proof command failed; no observed outcome
contradicted its AC text.

### Real-corpus measurement (AC7, informational)

```
$ npm run check:md-tables
check:md-tables — 4 advisory note(s) (non-blocking, done-mark convention):

  docs/backlog.md:165 — done-mark **DONE** is buried mid-cell in the desc column (should lead the cell) — see docs/backlog.md E88
  docs/backlog.md:166 — done-mark **DONE** is buried mid-cell in the desc column (should lead the cell) — see docs/backlog.md E88
  docs/backlog.md:180 — done-mark **DONE** is buried mid-cell in the desc column (should lead the cell) — see docs/backlog.md E88
  docs/backlog.md:181 — done-mark **DONE** is buried mid-cell in the desc column (should lead the cell) — see docs/backlog.md E88
check:md-tables — OK (243 file(s) scanned, 0 malformed tables)
```
Exit code 0. Matches the coordinator-verified figure and code-reviewer's
round-2 independent re-derivation (E39/E40/E58/E59; E71 correctly excluded —
its apparent mark is a quotation inside a code span of a different row's
mark, per `NEW-TICKETS.md` L-MDTOOL-N2).

## Phase 4 — Run

- **Build**: `npm run build` — clean (`tsc` zero errors, `check:version` OK
  at 3.110.0, `check:transitions-sync` OK — 21 keys, exact match).
- **Full suite**: `npm test` — **1890/1890 pass** (baseline 1868/1868 at the
  end of the prior feature in this worktree + 22 new tests in
  `test/check-md-tables.test.mjs` = 1890; 0 fail, 0 cancelled). CI-runnable
  headlessly, zero human interaction.
- **`npm run check:md-tables`**: exit 0, 4 advisories (see above) — matches
  the coordinator-verified pre-condition exactly.
- **`scripts/verify-release.mjs` / `test/verify-release.test.mjs`**: NOT
  touched by this feature (confirmed via `git status` — both were already
  modified in the working tree before this task started, belonging to the
  prior, already-PASSed `e82-e84-release-verify-tooling` feature sharing this
  worktree). Not re-verified here; out of this review's scope per the
  dispatch brief.

**PASS.**

## Bookkeeping (dispatch brief item)

`NEW-TICKETS.md` L-MDTOOL-N1 said "5 pre-existing violations … normalizing
these 5 rows", contradicting L-MDTOOL-N2's corrected count of 4
(code-reviewer's round-1 finding, round-2-confirmed). Collapsed N1's own text
to the verified 4 (E39/E40/E58/E59), with an inline correction note
cross-referencing L-MDTOOL-N2 rather than silently rewriting history — so the
file no longer hands the integrator two disagreeing counts. Did not touch
`docs/backlog.md`, and used the existing `L-MDTOOL-N<n>` series (no new
backlog ticket numbers assigned), per the dispatch brief.
## 2026-09-16T10:53:11.727Z — PASS — by qa-engineer

PASS. AC1-AC7 verified by execution (fixture-based, not corpus-based — the E105 shape occurs 0 times in this repo). E105 tie-break and E88 advisory both pinned: 22 new tests appended to test/check-md-tables.test.mjs (17 pre-existing unmodified -> 39 total). Behavioural pin for AC2: prescribed remedy clears the violation; the OLD (pre-E105) remedy does NOT clear it and instead produces 2 fresh cell-count violations. Two residuals pinned as INTENDED per code-reviewer's round-2 request: equal-width adjacent tables still classify blank-split; a coincidentally-well-counted row with shifted content leaves the advisory silent. Non-regression invariant pinned: unescaped | inside a code span still goes FATAL under rule 1 with the advisory suppressed (the v3.105.0/E96 recurrence shape) - splitRow()/headerCellCount unchanged. 10 independently re-derived findCodeSpanRanges()/findGenuineDoneMark() adversarial fixtures, including the `` ``a ` b`` `` shape both outside (fires) and inside (silent) a marker. Non-fatal guarantee pinned both directions. npm run build clean. npm test 1890/1890 (1868 baseline + 22 new). npm run check:md-tables exits 0, exactly 4 advisories (docs/backlog.md:165/166/180/181, E39/E40/E58/E59) - independently re-verified, matches coordinator claim and code-reviewer round-2. NEW-TICKETS.md L-MDTOOL-N1 collapsed to the verified 4-row count with a correction note (was contradicting L-MDTOOL-N2); docs/backlog.md and scripts/check-md-tables.mjs untouched. Evidence: qa_reports/review_T-E88E105-02.md.

