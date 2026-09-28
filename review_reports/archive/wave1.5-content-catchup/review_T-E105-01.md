# Review — T-E105-01

covers: T-E105-01, T-E88-01

feature: `e88-e105-md-table-checker` (Wave 1 lane L-MDTOOL)
diff under review: `git diff 3d53c93 -- scripts/check-md-tables.mjs` (+135 / −9, one file)
contract: `specs/e88-e105-md-table-checker.md` (AC1–AC7 + Decisions §1–3); no architecture spec exists.
reviewer model: opus (sr-engineer was pinned `fable` — different model, so no same-model blind-spot risk).

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- **E105 (T-E105-01) is correct and proven.** The (a)/(b)/(c) tie-break now compares the *prior run's header* cell count against the current block's header cell count. Verified by execution against purpose-built fixtures (the shape occurs 0 times in this repo, so the green repo run proves nothing): base and new classify the two-adjacent-tables case differently, and the newly-prescribed remedy actually clears the violation while the old prescribed remedy demonstrably corrupts the file.
- **E88 (T-E88-01) is structurally right and mechanically sound** — it reuses `splitRow()` and the fence-aware run builder, never stands up a second parser, and cannot affect the exit code. All of AC4/AC5/AC6 and the non-fatal guarantee verified by fixture.
- **One blocking finding (C1): the advisory's marker predicate matches any bold run that merely *opens* with the token, so 2 of its 6 live advisories point at text that is not a done-mark at all** — `docs/backlog.md:210` (prose quoting the convention) and `docs/backlog.md:193` (a done-mark quoted *inside a code span*, describing a different row). Measured false-positive rate on the tool's only live corpus: 33%.
- Collateral factual correction: **PM's "5 buried rows (E39/E40/E58/E59/E71)" is wrong by one.** Ground truth is 4 — E71's `desc` cell contains no done-mark; its mark lives in the `design-link` cell. This propagates into `NEW-TICKETS.md` L-MDTOOL-N1 ("normalizing these 5 rows"), recorded there as L-MDTOOL-N2.
- AC1 regression: `node --test test/check-md-tables.test.mjs` → **17/17 pass, unmodified**.

## Correctness

### C1 — BLOCKING — `scripts/check-md-tables.mjs:69` (`DONE_MARK_RE`) + `:312-322` — the advisory fires on bold text that is not a done-mark, and its prescribed remedy corrupts the row

`const DONE_MARK_RE = /\*\*(DONE|PARTIAL|VOID)\b/;` matches the *opening* of any bold span whose first word is the token, and `:314-322` reports the **first** such match when its index is non-zero. The widening itself is well-reasoned and I am **not** asking for it to be reverted — I re-measured the premise and it holds: of 65 marker-bearing cells in the two scoped tables, only 5 use the self-closing `**DONE**` form; 57 use the compound `**DONE — shipped vX.Y.Z**` / `**DONE (v3.105.1)**` form. An immediate-close anchor would be blind to the dominant convention. That part is right.

What is wrong is that "opens with the token" is not the same predicate as "is a done-mark". Full context of all six live advisories, extracted independently (my own parser, not the tool's, to avoid a circular check):

| line | id | matched text | code span? | is it a done-mark? |
|---|---|---|---|---|
| 165 | E39 | `**DONE** (shipped v3.99.0).` | no | **yes** — genuine buried mark |
| 166 | E40 | `**DONE** (shipped v3.100.0).` | no | **yes** — genuine buried mark |
| 180 | E58 | `**DONE** (shipped v3.99.0).` | no | **yes** — genuine buried mark |
| 181 | E59 | `**DONE** (shipped v3.99.0, commit …)` | no | **yes** — genuine buried mark |
| 193 | E71 | `` `**DONE** (2026-08-17, not yet released)` `` | **YES** | **no** — a quotation, inside a code span, of a mark the coordinator wrote on the **E48** row. E71's own mark is in its `design-link` cell. |
| 210 | E88 | `**DONE and shipped** (v3.99.0, v3.100.0, v3.103.0 respectively)` | no | **no** — prose: "*the order table records them **DONE and shipped***". E88 is this ticket; it is not shipped. |

Two independent reasons this is blocking rather than a note:

1. **The message asserts a fact that is false, about the ticket the diff implements.** `docs/backlog.md:210 — done-mark **DONE** is buried mid-cell in the desc column` tells a reader that E88 carries a done-mark. It does not. The file's own header comment (`scripts/check-md-tables.mjs:13-14`) records E74's standard verbatim — *"omit any and the checker produces false positives worse than having no checker at all"* — and that standard is about exactly this: output a reader learns to discount. A 1-in-3 false rate on day one, on the only corpus the rule will ever run against, is under that bar.
2. **The prescribed remedy corrupts the row — the same defect class T-E105-01 exists to close.** "should lead the cell" applied literally at `:210` moves the prose fragment `**DONE and shipped**` to the head of E88's `desc` cell, falsely done-marking an open ticket; applied at `:193` it hoists a backticked example out of the sentence that quotes it. That is structurally identical to the E105 bug this very cut fixes — *following the tool's own instruction produces the corruption the tool exists to prevent*. Shipping the fix for one instance of that class while introducing another instance beside it is not defensible within one cut.

**On the tension the brief names (narrowing risks false negatives, and E88's history is of narrow fixes being defeated):** the historical defeat mechanism in E88/E96 is *column determination* — a naive splitter meeting an unescaped `|`. This diff already closes that axis correctly (see C2 below), and it stays closed no matter what the marker predicate does. A qualifier on the **span body** is orthogonal to that axis and cannot re-open it. I measured four variants over all 65 marker-bearing cells:

| variant | advisories produced | cells where no qualifying marker is found |
|---|---|---|
| A — current (any bold-open) | 165, 166, 180, 181, **193**, **210** | none |
| B — skip matches inside a code span | 165, 166, 180, 181, **210** | 193 |
| C — require the span to self-close *or* carry a `vN.N` / ISO-date stamp | 165, 166, 180, 181, **193** | 210 |
| D — B + C together | 165, 166, 180, 181 | 193, 210 |

Variant D yields exactly the four genuine buried marks, **with zero loss across the other 63 marker-bearing cells** — every compound-form mark (`**DONE — shipped v3.110.0**`, `**PARTIAL 2026-08-21 — …**`, `**VOID 2026-08-17 — …**`) still resolves, and every leading mark still suppresses correctly. So the false-negative cost of narrowing is, on this corpus, zero — the objection is real in principle but does not bind here, and that is measured rather than asserted.

D is an existence proof, not a required design. What I am requiring is the property: **a bold span that is not a done-mark must not be reported as one.** Whatever predicate you choose must (i) still recognize the compound form, (ii) leave `splitRow()`/`headerCellCount` untouched, and (iii) fail toward *silence* rather than toward a false claim — an advisory that goes quiet costs nothing beyond the status quo, an advisory that lies costs the reader's trust in every other line it prints. Backtick-parity within an already-correctly-split cell is an acceptable approximation under (iii) precisely because its failure direction is suppression.

Residual, and worth stating so the narrowing is not oversold: under any of B/C/D, E71 stops being reported. E71 *is* non-compliant, but in a way this rule does not model — its mark sits in `design-link` instead of `desc`, which is the E96 "mark landed in the wrong column" shape. The current code only appears to catch it, via the wrong string and with a message describing the wrong problem. Modelling that shape properly is a scope question for PM, filed as L-MDTOOL-N2, not something to fix here.

### C2 — VERIFIED CLEAN — the naive-parser trap is closed

The advisory never parses anything itself. `:290` derives the column from `backlogDoneMarkColumn(splitRow(header.raw))` — the same escape-aware `splitRow()` as rule 1 — off the block's own header, and the block comes from the fence-aware run builder (`:154-191`), so discriminators (i)–(iv) all apply unchanged. `:296-307` splits each data row once with `splitRow()` and **`continue`s on any `cellCount !== headerCellCount`**, so a row whose columns cannot be trusted is never column-indexed. That is the correct polarity: the E96 shape goes fatal under rule 1 and is *excluded* from the advisory instead of being guessed at.

Executed, not merely read:
- unescaped `|` in a code span (the literal v3.105.0 recurrence): `docs/backlog.md:5 — row has 7 cell(s), header declares 6`, exit 1, **zero advisories** — no misfire.
- escaped `` `a \| b \| c` `` before a buried mark: advisory fires on the correct column, exit 0.

One additional correctness point in the same area, worth recording because it is the kind of thing that breaks later: `DONE_MARK_RE` is **not** `/g`, so the `.exec()` at `:315` carries no `lastIndex` state across rows. If C1's fix moves to `matchAll` or a `/g` regex, keep it out of module scope or reset `lastIndex` — a module-level `/g` regex reused per row is a classic silent-skip bug.

### C3 — VERIFIED CLEAN — E105 discriminator, proven by execution

All four cases run against base (`3d53c93`) and HEAD in throwaway `$TMPDIR` git repos (never at a repo root):

| fixture | base | HEAD | required |
|---|---|---|---|
| (a) blank-split, prior run header = 3 cells, block header = 3 cells | `blank-split` | `blank-split` | AC3 ✓ unchanged |
| (b) two adjacent tables, 3-cell then 2-cell, 2nd headerless | `blank-split` ✗ | `missing-delimiter` ✓ | AC2 ✓ now correct |
| (c) same, with a 3-cell delimiter under a 2-cell header | `blank-split` ✗ | `mis-sized-delimiter` ✓ | AC2 ✓ alternate branch |
| (b) after applying the **newly prescribed** remedy (add a delimiter row) | — | `OK`, exit 0 | AC2's "remedy actually clears" ✓ |
| (b) after applying the **old** remedy (delete the blank line) | — | 2 cell-count violations | confirms the old message corrupted ✓ |

The lookup `runs.find((r) => r[r.length - 1].lineNo === ln)` at `:243` is sound: everything between `ln` and the block header is blank by construction of the walk-up, so `ln` can only be the final row of its run. When no run owns that line (a `|` line inside a fence), `priorRunHeaderCellCount` stays `null`, `isGenuineContinuation` is false, and the block falls through to (b)/(c) — I fixture-checked that this changes nothing versus base, because a closing fence line intervenes and the walk-up never sees the pipe row anyway. The spec's Out-of-Scope claim that the walk-up's fence-unawareness is untouched therefore still holds.

Known residual, not a defect: two genuinely separate adjacent tables whose headers happen to have **equal** cell counts still classify as `blank-split` (fixture-confirmed). The tie-break cannot distinguish them, and AC3 defines a continuation exactly that way. Flagging it for QA's fixture notes so it is pinned as intended behaviour rather than discovered later as a surprise.

### C4 — VERIFIED CLEAN — non-fatal guarantee

`advisories` is a separate array threaded through a changed `checkFile()` return shape (`{violations, advisories}`), accumulated into `allAdvisories` at `:334`, and printed in its own block at `:371-383`. It is never pushed into `allViolations`, and the single `process.exit(1)` at `:385-387` is keyed on `allViolations.length` only. Both directions executed:
- advisory only → advisory printed, then `OK (1 file(s) scanned, 0 malformed tables)`, **exit 0**.
- advisory + a genuinely malformed table → `1 malformed table site(s)` (the advisory is *not* counted), `FAILED`, advisory still printed, **exit 1** for the malformed table.

The ENOENT early-return at `:129` was correctly updated to the new shape; it is the only other return path in `checkFile`.

### C5 — VERIFIED CLEAN — scoping (AC5/AC6) and regression (AC1)

Fixtures: identical buried-marker shape at `docs/other.md` → 0 advisories (AC6 ✓). Marker buried in `design-link` instead of `desc` → 0 advisories (AC5 negative ✓). Order-table shape with a buried marker in `why here` → advisory, exit 0 (AC4 ✓). The 3-column historical order table (`order | ticket | why here`) → correctly ignored, confirming Decisions §2's claim that exact-header matching excludes it without special-casing. `**PARTIALLY FALSIFIED** premise` → no advisory, so the `\b` in the token regex does its job. A cell with a leading mark *and* a later `**DONE**` mention → no advisory, so first-match-wins suppresses correctly.

## Quality

- `:320` — `if (doneMarkCol && doneMarkCol.index >= 0)`: the `index >= 0` half is unreachable-false. `backlogDoneMarkColumn` only returns after an exact array equality against a constant that contains the key it then `indexOf`s, so the index is always found. Harmless, but it reads as if the lookup could fail. Drop it, or keep it and say why.
- Comment-to-code ratio is high (≈50 lines of commentary for ≈40 lines of logic), but that is this file's established and deliberate style — every discriminator carries its incident history inline. Consistent, not drift.
- Naming (`BACKLOG_REL_PATH`, `TICKET_TABLE_HEADER`, `ORDER_TABLE_HEADER`, `backlogDoneMarkColumn`, `isGenuineContinuation`) is clear and matches surrounding convention. `arraysEqual` is a reasonable 1-line local helper; no duplication introduced.
- The advisory block prints to `stdout` while fatal violations print to `stderr`, so in a combined run the advisory appears after `FAILED`. That is the right stream for a non-error note; recording it only so nobody "fixes" it into `stderr` later and accidentally makes it look fatal.
- Copy strings match `specs/…` Copy/Strings verbatim (`advisory.header`, `advisory.line`), including the `(should lead the cell) — see docs/backlog.md E88` tail. Note that the C1 fix does not require any string change.

## Architecture

No architecture spec for this feature. The change stays inside the single-file, two-rules-plus-four-discriminators structure the file documents in its own header, and adds a third, clearly-segregated *advisory* channel with its own array, its own print block, and no path into the exit code — which is exactly what Decisions §1 specifies. Decisions §2 (hardcoded `relPath === "docs/backlog.md"`, exact header-cell match, never corpus-wide) and §3 (2 files, `docs/backlog.md` untouched) are all honoured; the diff touches one file and I confirmed `docs/backlog.md` is unmodified in the working tree.

## Security

No findings. No new trust boundary: inputs are git-tracked files already being read, the two new regexes are non-backtracking literals over a bounded cell string, and no new process spawn, network call, filesystem write, or secret is introduced. `execFileSync("git", [...])` is untouched and still argument-array form.

## Performance

No regression. Per block, one extra `splitRow(header.raw)` (already computed once for `headerCellCount`, so this is one redundant split per block — negligible, and clearer than threading the cells through). Per data row, one extra regex `exec` over a single cell, and only when the file is `docs/backlog.md` *and* the header matched one of two shapes; every other file short-circuits on `isBacklogFile`. The `runs.find()` at `:243` is O(runs) but executes only inside the headerless-block branch, i.e. only on files that already have a violation — worst case O(k²) in the number of runs in one pathological file, which at this corpus's scale (243 files, 0 violations) is unmeasurable. Full-corpus run time is unchanged in practice.

## Verdict

**CHANGES_REQUESTED** — E105's fix is correct and proven by execution, and E88's advisory is structurally sound, correctly scoped, and provably non-fatal; but the marker predicate reports two non-marks out of six as done-marks on the only corpus it runs against, and its prescribed remedy would corrupt both rows — the same "the tool's own instruction causes the corruption" defect class this cut ships a fix for.

### Required before re-review

1. Narrow the marker predicate so a bold span that is not a done-mark is not reported as one. Property required, not an implementation: keep compound-form recognition, do not touch `splitRow()`/`headerCellCount`, and fail toward silence. Variant D above (skip matches inside a code span; require the span to self-close or carry a `vN.N`/ISO-date stamp) is measured to give exactly the 4 genuine rows with zero loss across the other 63 marker-bearing cells — use it or beat it.
2. Re-run `node scripts/check-md-tables.mjs` against the real repo and report the resulting advisory lines (expected: 165, 166, 180, 181 — E39/E40/E58/E59 — and **not** 193 or 210). Exit code must stay 0.
3. Re-run `node --test test/check-md-tables.test.mjs` and confirm 17/17 still pass unmodified.
4. Nothing else in the diff needs to change. Do not revert the compound-form widening, do not touch the E105 tie-break, do not touch `docs/backlog.md`, `test/`, or `content/**`.

### Carried forward, not blocking (recorded in `NEW-TICKETS.md` as L-MDTOOL-N2)

- PM's 5-row figure and `NEW-TICKETS.md` L-MDTOOL-N1's "normalizing these 5 rows" are wrong by one: the ground truth is **4** (E39, E40, E58, E59). E71's `desc` cell contains no done-mark.
- All 4 genuine rows — and E71 — also carry a mark in the `design-link` cell. "Mark in the wrong column entirely" is the actual E96 shape and is not modelled by this rule at all; expanding scope to it is a PM decision, not a build-role fix.

---

## Round 2 — APPROVED — by code-reviewer

Diff re-reviewed: round-1 HEAD → current `scripts/check-md-tables.mjs` (two hunks; `DONE_MARK_RE.exec` → `findGenuineDoneMark()` + `findCodeSpanRanges()`, and the 4-line call-site swap at `:389-397`). No other file changed for this feature — confirmed `docs/backlog.md`, `test/`, and `content/**` are untouched in the working tree (`scripts/verify-release.mjs` / `test/verify-release.test.mjs` are the prior L-RELTOOL feature, out of scope).

### C1 — CLOSED

The corpus now emits exactly the 4 genuine buried marks — `docs/backlog.md:165` (E39), `:166` (E40), `:180` (E58), `:181` (E59) — exit 0. `:193` and `:210` are gone. Independently re-derived: I re-ran my own round-1 variant-D measurement and it agrees line-for-line, and I re-extracted the shipped `findGenuineDoneMark()` / `findCodeSpanRanges()` **verbatim from the file** into a test module (no reimplementation) and replayed them over all 65 marker-bearing cells. `:193` and `:210` are the only two cells that now resolve to "no qualifying mark", which is the correct answer for both.

Both exclusion axes are load-bearing, confirmed against real cells: `MARK_STAMP_RE` alone would keep `:193` (its quoted body `(2026-08-17, not yet released)` *does* carry a stamp — it is excluded only by the code-span test), and code-span awareness alone would keep `:210`. Neither half is redundant.

### C2 — CLOSED

`matchAll` on `DONE_MARK_OPEN_RE` clones the regex and its `lastIndex` per call and never mutates the module-scope original, so no state leaks across rows or files. `MARK_STAMP_RE` is non-global and used only with `.test()`. `backtickRe` inside `findCodeSpanRanges` is constructed per call. The `while ((rm = backtickRe.exec(text)))` loop cannot spin: `` /`+/g `` can never produce a zero-length match.

### The new parser — `findCodeSpanRanges()` (`:98-132`)

This is the highest-risk line of the diff and I treated it as such. **It cannot shift column determination, structurally**: it is a pure `string → ranges` function called at `:390` on `cells[doneMarkCol.index].trim()` — i.e. on a cell that `splitRow()` has *already* produced. Nothing it returns flows back into `splitRow()`, `headerCellCount`, the run builder, or the violation path; its only consumer is a `continue` inside the advisory loop. The `splitRow()` / `headerCellCount` / fence-builder region is byte-identical to the version cleared in round 1, and so is the E105 tie-break (`cmp`-verified, 33 lines, identical).

Algorithm checked against CommonMark: maximal backtick runs, an opener closed by the **next run of exactly equal length**, an unpaired run treated as a literal with the scan resuming at the next run. That is the correct rule, and it is strictly better than the backtick-parity approximation I measured in round 1 — parity mis-handles `` ``a ` b`` `` and would have produced a false negative there.

25 adversarial cases run end-to-end through the real script against a `$TMPDIR` fixture, **25/25 as expected**:

| case | shape | expected | actual |
|---|---|---|---|
| C02 | mark quoted inside a code span (the `:193` shape) | silent | silent |
| C03 | unmatched single backtick before the mark → literal | fire | fire |
| C04 | `` ``a ` b`` `` then a buried mark (parity would mis-skip) | fire | fire |
| C05 | mark inside a 2-run span that contains a single backtick | silent | silent |
| C06 / C07 | unpaired vs paired 3-backtick runs | fire / silent | fire / silent |
| C08 / C09 | two closed spans, mark outside / inside the second | fire / silent | fire / silent |
| C10 | `` `a \| b \| c` `` escaped pipes adjacent to the span | fire | fire |
| C24 | 1-run opens, 2-run inside, 1-run closes, mark inside | silent | silent |
| C25 | 1-run span closes before the mark | fire | fire |
| C17 | `**DONE` with no closing `**` in the cell | silent | silent |
| C19 | non-qualifying prose leads, genuine mark buried later | fire | fire |
| C21 | `**PARTIALLY FALSIFIED 2026-08-21**` (word boundary + date) | silent | silent |

Column-determination regression, executed: an **unescaped** `|` inside a code span still splits to 7 cells → fatal under rule 1, advisory suppressed. A code span crossing a cell boundary that nonetheless yields exactly `headerCellCount` cells (a column omitted) → the advisory stays **silent**, because the mark lands outside the `desc` slice. That is the pre-existing rule-1 blind spot for coincidentally-well-counted rows, not a new one, and the advisory fails in the safe direction.

### The stamp qualifier — is it the predicate I measured?

Yes, with one difference in my favour. Branch tally over the 65 real marker-bearing cells, computed with the shipped function: **5 self-close, 56 three-component `vX.Y.Z`, 0 two-component `vX.Y`, 2 ISO-date, 2 no-qualifying-mark (`:193`, `:210`)**.

- The **ISO-date branch is exercised by real data** — `docs/backlog.md:314` (`**VOID 2026-08-17 — no longer executable.**`) and `:331` (`**PARTIAL 2026-08-21 — the cheap half executed…**`). Both lead their cells today so neither produces an advisory, but without that branch the rule would not recognize them as marks at all, i.e. it would silently miss them if they were ever buried. Justified.
- The **two-component `vX.Y` allowance has zero support in the corpus** (0 of 65). It is a harmless widening, not a regression — noted below as a residual, not a finding.
- Divergence from my round-1 candidate: the implementation tests `spanBody === ""` (no trim), so `**DONE **` with a space before the close does not self-qualify where my candidate's `body.trim()` would have. That is *stricter*, i.e. it fails toward silence — the property I required. 0 real cells are affected.

### Non-fatal guarantee and the 2 fatal rules / 4 E74 discriminators

All 16 round-1 fixtures re-run against the round-2 binary, **all identical to round 1**: (a) `blank-split`, (b) `missing-delimiter`, (c) `mis-sized-delimiter`, the prescribed remedy still clears to exit 0, the old remedy still produces 2 cell-count violations, the fence-adjacent walk-up and orphan-chain cases unchanged, advisory-only → exit 0, advisory + malformed → exit 1 counting only the malformed table, non-backlog path and non-`desc` column → 0 advisories, order-table shape → advisory + exit 0, 3-column historical order table still ignored. `node --test test/check-md-tables.test.mjs` → **17/17 pass, unmodified** (AC1).

### Performance

No regression: base, round-1 and round-2 all run the 243-file corpus in ~200-230 ms (3 runs each, differences inside noise). Worst case for the new inner loop is 352 backtick runs in a single cell (`docs/backlog.md:195`), so ~1.2e5 comparisons on the fattest cell — unmeasurable. One nit: `findCodeSpanRanges()` runs on **every** well-formed row of the two scoped tables, including the ~190 that contain no `**` at all; a `cellTrimmed.includes("**")` guard before the scan would skip most of the work. Not worth a round.

### Residuals recorded for QA (none blocking)

- The stamp test remains a heuristic: prose that bolds the token *together with* a real version — `**DONE and shipped v3.99.0**` — would still be reported. Zero instances in the corpus, and the residual surface is far narrower than round 1's "any bold-open"; the remaining failure mode needs a specific and unusual authoring shape.
- `:389` still carries the round-1 nit `doneMarkCol.index >= 0`, which is unreachable-false. Left as-is deliberately; not worth a round.
- `NEW-TICKETS.md` still contains two literally disagreeing counts: **L-MDTOOL-N1 says "5 pre-existing violations … normalizing these 5 rows"**, L-MDTOOL-N2 says 4 and names the correction explicitly. The record is annotated rather than silent, but N1's own lines were not edited (`docs/backlog.md` is shared with seven Wave 1 lanes, and rewriting another role's filed entry is out of a reviewer's boundary). The integrator or PM should collapse N1's count to 4 when either entry is actioned.
- QA fixture note: two adjacent, genuinely separate tables whose headers have **equal** cell counts still classify as `blank-split`. Inherent to the tie-break and consistent with AC3's own definition of a continuation — pin it as intended, not as a bug.

### Verdict

**APPROVED** — C1 and C2 are closed and verified by execution rather than by reading. The corpus emits exactly the 4 genuine buried marks at exit 0; the new code-span parser is CommonMark-correct across 25 adversarial shapes, is strictly better than the parity approximation I measured in round 1, and is structurally incapable of shifting `splitRow()`'s column determination; the stamp qualifier's ISO-date branch is justified by real cells and every divergence from my measured candidate fails toward silence. E105's tie-break is byte-identical to the version cleared in round 1, and all 16 fixtures plus the 17 existing tests are unchanged. AC1-AC7 are all satisfied by the implementation; the fixture pins for them are qa's task (T-E88E105-02) and their absence is not a finding here.
