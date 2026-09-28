# Review — T-E145-01

covers: T-E145-01

Feature: `e145-md-tables-cited-donemark` · lane `<lanes-root>/e145` ·
branch `feat/e145-md-tables-cited-donemark` · base `e1d62e2`
Diff under review: `scripts/check-md-tables.mjs` (sole source file touched).

## Round 1 — APPROVED — by code-reviewer

## Summary

- One file changed: `scripts/check-md-tables.mjs`. Adds `findCitationQuoteRanges()`
  (an exclusion-range scanner for `*"…"*` italic-quoted citation spans) plus a
  3-line wiring into `findGenuineDoneMark()` and a 40-line rationale comment.
  No other source file, no test file, no untracked file (`git status -uall`:
  only `.current/handoff.md` + the script).
- Independently re-derived the E88-style measurement: **68 marker-bearing cells,
  75 candidate bold opens, exactly 1 cell flipped (`docs/backlog.md:267`,
  desc-offset 483), 67 cells byte-identical in outcome**. The sr-engineer's
  claimed numbers are exact, not approximate.
- The four true positives survive with **identical token AND identical offset**:
  `:165 DONE@1398`, `:166 DONE@2626`, `:180 DONE@1827`, `:181 DONE@1952`.
  Critically, `:181` (E59's own mark — the row the ticket TEXT wrongly calls a
  citation) still fires. The comment explicitly records why silencing it would
  have been the real loss. This is the single most important property of the
  change and it holds.
- `npm run check:md-tables` → 4 advisories, `:267` silent, `0 malformed tables`,
  **exit 0**. `node --test test/check-md-tables.test.mjs` → **39/39 pass**.
- Verdict: **APPROVED**, with three recorded residuals and one comment-accuracy
  defect that must be corrected before release (details below). None of them
  changes behaviour on the live corpus; none of them silences a genuine mark
  that exists today.

## Correctness

**No blocking finding.** Detailed adversarial results:

**C1 (PASS) — the `CS-MULTI-CANDIDATE` invariant is preserved.**
`scripts/check-md-tables.mjs:199` uses `continue`, not `return`, so a candidate
excluded by a citation range does not abort the scan. Verified directly:
cell `cites *"E59 **DONE** (v3.99.0)"* filler **DONE** (v1.0.0) tail` →
citation range `[6,32]`, and the *later genuine* candidate still fires at
offset 40. The new exclusion composes with `matchAll` exactly as the code-span
exclusion does.

**C2 (PASS) — pairing algorithm survives the attacks I could construct.**
`findCitationQuoteRanges()` (`scripts/check-md-tables.mjs:165-177`). Cases run
against the real function:

| shape | cell | result |
|---|---|---|
| citation at offset 0 | `*"E59 **DONE** (v3.99.0)"* trailing` | range `[0,26]`, SILENT — correct |
| citation at cell end | `trailing *"E59 **DONE** (v3.99.0)"*` | range `[15,41]`, SILENT — correct |
| two spans, genuine mark between | `*"a"* then **DONE** (v1.0.0) then *"b"*` | ranges `[0,5],[34,39]`, fires @11 — correct |
| genuine in 1st half, cited in 2nd | `*"a"* x **DONE** (v1.0.0) y *"E59 **DONE**…"*` | fires @8 — correct |
| apostrophes adjacent | `it's *"E59's **DONE** (v3.99.0)"* and it's fine` | range `[5,33]`, SILENT — correct |
| escaped pipe inside citation | `cites *"a \| b **DONE** (v3.99.0)"* then prose` | range `[6,35]`, SILENT — correct |
| nested inner quotes | `cites *"outer "inner" **DONE** (v3.99.0)"* tail` | range `[6,42]`, SILENT — correct |
| empty citation `*""*` | `*""* then **DONE** (v1.0.0)` | range `[0,4]`, fires @10 — correct |
| degenerate `*"*` | `odd *"* then **DONE** (v1.0.0)` | no range (lookahead rejects), fires @13 — correct |
| `**"bold quoted"**` | — | no false opener: `(?<!\*)` / `(?!\*)` correctly refuse a `**` run — correct |

The `(?<!\*)\*"(?!\*)` / `"\*(?!\*)` delimiter guards do their job; I could not
produce a spurious opener or a mis-placed close from `**`-run adjacency alone.

**C3 (residual, NOT blocking) — the close search is unbounded and not
code-span-aware, so an over-broad range can swallow a genuine mark.**
`scripts/check-md-tables.mjs:168-174` takes the *next* `"*` anywhere later in
the cell, with no bound and with no subtraction of `findCodeSpanRanges()`.
Three constructed cells go SILENT that would previously have advised:

1. stray delimiters spanning a real mark —
   `he said *"hello" and then **DONE** (v1.0.0) ships, per "*the note`
   → range `[8,57]`, SILENT.
2. **opener living inside a code span** —
   `` see `a *" b` then **DONE** (v1.0.0) and "* tail ``
   → range `[7,42]`, SILENT.
3. `**bold**"*` acting as the closer —
   `lead *"q and **DONE** (v1.0.0) mid **bold**"* tail` → range `[5,45]`, SILENT.

Why this is a residual and not a CHANGES_REQUESTED:
- Direction of failure is the one this file documents as safe. The convention
  is *"fails toward silence, never a false claim"* — a **miss** costs one
  unprinted advisory on a non-blocking, exit-0 lint; a **false claim** is what
  makes the printed remedy fabricate a done-mark. C3 fails toward the miss.
- Blast radius on the live corpus is measured zero: 67 of 68 marker-bearing
  cells are outcome-identical, and no shape above occurs in `docs/backlog.md`.
- Case 2 is nonetheless a real asymmetry with the comment's own claim of being
  *"exclusion-only, same shape as `findCodeSpanRanges()`"* — it is not the same
  shape there, because `findCodeSpanRanges()` is self-contained while this
  scanner can be opened from inside a code span. Recorded for QA (see below);
  the one-line hardening (skip an opener whose index is `insideCodeSpan`) is a
  candidate follow-up ticket, not a blocker for this one.

**C4 (residual, NOT blocking, and the right call) — the predicate is narrow;
other citation costumes still false-positive.** Verified: `*"…"*` is excluded,
but `*“…”*` (typographic quotes), plain `"…"`, `**"…"**`, and bare `*…*` all
still fire an advisory on a cited mark. **Do not widen now.** Widening to plain
`"…"` or bare `*…*` would exclude ordinary prose emphasis and quoted phrases,
which is precisely the direction that *silences genuine marks* — the failure the
ticket forbids. Narrow-and-conservative is correct: the residual is a false
positive that a human still adjudicates, exactly as the v3.111.0
release-engineer did. **Record as a residual; revisit only if a second costume
actually appears in the corpus.** This is my explicit answer to the brief's
"widen now or record as residual" question: *record*.

**C5 (PASS) — no genuine mark can land inside a well-formed `*"…"*` span in the
live corpus.** The over-breadth question ("can a GENUINE mark ever land inside a
citation span") reduces to C3's malformed-delimiter cases; for a well-formed
citation the enclosed mark is by construction the cited one. Measured: exactly
one cell flips, and it is the intended one.

**C6 (PASS) — untouched surfaces are genuinely untouched.** The diff does not
touch `DONE_MARK_OPEN_RE`, `MARK_STAMP_RE`, `splitRow()`, `headerCellCount`,
`isDelimiterRow()`, `backlogDoneMarkColumn()`, the fence state machine, the
`violations` path, or the exit-code path. Confirmed by reading the full diff
and by `0 malformed tables` / exit 0 unchanged on the real corpus.

**C7 (n/a) — SOP step 4a does not arm.** The diff touches no test file and no
red tests exist, so no `qa_reports/expected-red_*` manifest is required.

## Quality

**Q1 (must fix before release, non-blocking for this round) — the comment's
rationale for the unpaired-opener branch is factually inverted.**
`scripts/check-md-tables.mjs:~153-157` reads: *"An unpaired opening delimiter …
is skipped — **SILENCE** (the candidate then falls through to the normal
code-span/stamp tests, which may still qualify it as genuine)"*. Skipping the
range means **no exclusion**, so the candidate can and does produce an
**ADVISORY**, not silence. Verified: cell
`quote *"unclosed start and then **DONE** (v1.0.0) ships` → no range, **fires
@32**. The parenthetical even describes the advisory outcome while the label
says the opposite.

The *behaviour* is right and is exactly the established precedent — an unpaired
opener is a literal, not a span, identical to `CS-UNMATCHED-BACKTICK` and
`CS-UNPAIRED-3BACKTICK`. Only the label is wrong. In a file whose entire
convention is that comments carry accurate measured justification — and in a
ticket that exists *because* a confidently-wrong printed statement nearly caused
a fabricated done-mark — a comment that misstates its own failure direction is
the kind of thing a future maintainer will act on. Correct the clause to say the
skip fails toward a possible **advisory** (noise), chosen over fabricating a
range that could swallow a real mark, and cite `CS-UNMATCHED-BACKTICK` as the
precedent it follows.

**Q2 (recommended) — record the residuals in the comment.** The comment
justifies what the fix *does* but not what it deliberately leaves open. Add one
sentence naming C4's unexcluded costumes (`*“…”*`, plain `"…"`, `**"…"**`,
`*…*`) and one naming C3's unbounded, non-code-span-aware close search. This
file's standard is that every discriminator states its measured blast radius and
its known residual; the round-2 block above `DONE_MARK_OPEN_RE` is the model.

**Q3 (accurate, no action) — the measurement claim is exact.** I re-derived
68/75/1-flipped/67-identical from `docs/backlog.md` with an independent harness,
including the same four advisory offsets. The comment's numbers are correct as
written.

**Q4 (no action) — regex locality is consistent with the file's C2 lesson.**
Both `openRe` and `closeRe` are function-local (`closeRe` re-created per
iteration), so no module-scope `/g` `lastIndex` leaks between cells — the exact
hazard the existing comment at `:186-189` warns about.

**Q5 (test coverage — QA scope, correctly NOT authored here).** The new function
ships with **zero direct test coverage**; `test/check-md-tables.test.mjs` is
untouched, which is correct under §2 test ownership (sr-engineer must not author
tests). Handing qa-engineer the precise case list instead, see below.

## Architecture

`specs/e88-e105-md-table-checker.md` is the governing spec (no E145-specific
spec or architecture doc exists — appropriate for a mini-chain with the backlog
row as spec). The change is exclusion-only and sits at the same layer as
`findCodeSpanRanges()`: a pure `(text) -> ranges` function consumed by one
predicate in `findGenuineDoneMark()`. It adds no new parser beside `splitRow()`,
so the column-split axis where E88/E96 were historically defeated is untouched.
The advisory remains advisory: `allAdvisories` never feeds `allViolations` and
never changes the exit code. Layering and spec fit: clean.

## Security

No finding. No new I/O, no new external input, no `execFileSync` argument
change, no filesystem path construction, no secrets. The one new regex is
linear-time with no nested quantifier or alternation-over-repetition, so no
catastrophic-backtracking (ReDoS) vector — and its input is a trimmed table cell
from a git-tracked file in the repo, not untrusted data.

## Performance

**P1 (no regression, note only).** `findCitationQuoteRanges()` is called once per
scoped backlog row, adding one linear scan per cell. Worst case is O(n²) per
cell when many unpaired `*"` openers each trigger a full scan to end-of-cell
(each unpaired opener advances `openRe.lastIndex` by only 2). Longest real cell
is ~2.6k chars and carries no unpaired openers; measured wall-clock on the full
249-file corpus is unchanged. No batching or hot-path concern. No memory growth:
`ranges` is per-call and discarded.

## Verdict

**APPROVED** — the fix silences exactly the one false positive it targets
(`docs/backlog.md:267`, desc-offset 483) and preserves all four genuine buried
marks at identical token and offset, independently re-measured (68 cells / 75
opens / 1 flip / 67 identical), with 39/39 targeted tests green, `0 malformed
tables` and exit 0; the residuals I found (C3 over-broad close search, C4 narrow
predicate) both fail in this file's documented safe direction and occur nowhere
in the live corpus, and the one real defect (Q1, an inverted failure-direction
label in a comment) is a documentation correction that does not alter behaviour.

### Required follow-through for qa-engineer

Test authorship is QA's. These are the cases this round's analysis says must be
pinned; the first four are the load-bearing ones:

1. `CQ-CITED-MARK-SUPPRESSED` — `cites *"E59 **DONE** (v3.99.0)"* tail` → no advisory.
2. `CQ-MULTI-CANDIDATE` — `cites *"E59 **DONE** (v3.99.0)"* filler **DONE** (v1.0.0) tail`
   → advisory fires on the *second*, genuine candidate (the `matchAll` invariant).
3. `CQ-GENUINE-OUTSIDE-QUOTE` — `*"a"* then **DONE** (v1.0.0) then *"b"*` → advisory fires.
4. `CQ-UNPAIRED-OPENER` — `quote *"unclosed start and then **DONE** (v1.0.0) ships`
   → advisory **fires** (pins the real behaviour, and guards Q1's correction).
5. `CQ-CELL-START` / `CQ-CELL-END` — citation at offset 0 and at end of cell.
6. `CQ-ESCAPED-PIPE-IN-CITATION` — `cites *"a \| b **DONE** (v3.99.0)"* then prose`
   → one cell, no rule-1 violation, no advisory.
7. `CQ-BOLD-RUN-NOT-AN-OPENER` — `**"E59 **DONE** (v3.99.0)"** tail` → advisory
   still fires (pins C4's residual as *intended*, so a future widening is a
   deliberate decision rather than an accident).
8. `CQ-RESIDUAL-SPAN-SWALLOW` — `` see `a *" b` then **DONE** (v1.0.0) and "* tail ``
   → currently SILENT; pin it as a *recorded residual* so a future hardening
   flips it deliberately.
9. Non-regression: the real `docs/backlog.md` still exits 0 and still advises on
   `:165 / :166 / :180 / :181` (assert the rows, per AC7's convention do not pin
   a count).
