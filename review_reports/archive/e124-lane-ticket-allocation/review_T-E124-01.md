# Review — T-E124-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Adds `tools/lane-ticket-allocation.ts` (645 lines) plus its compiled `dist/` output. The module is a pure core with five exports: `parsePendingTickets`, `allocateTicketIds`, `extractMaxBacklogId`, `detectOrphanLanes`, `markApplied`. Its only import is `js-yaml`; it uses no `fs`, `child_process`, clock or env.
- The diff also carries the spec and the lane's `.current/e124/` bookkeeping. No other source files are touched. The exported surface matches the spec's AC2–AC8 signatures, plus one additive field, `maxAllocatedId`.
- I checked that `dist/` is built from source: a fresh `tsc` into `$TMPDIR` gave a byte-identical `dist/tools/lane-ticket-allocation.js`.
- I ran a behavioural probe against `dist/` covering every AC. All behaved as specified, including the AC6 fixture, which returns 174.
- Verdict: APPROVED. There are three `recommended` findings (two silent-loss edges in the file format, and some trimming for size). None of them blocks.

## AC Completeness
AC1 — implemented — tools/lane-ticket-allocation.ts:25-43 (format doc), :121-127 (only exact `pending-ticket` fences carry data), :316-319 (a block with an `id` field is rejected). No convention change: nothing outside the module is wired.
AC2 — implemented — tools/lane-ticket-allocation.ts:276-358. `lane` comes from the argument (:351). A malformed block is skipped and reported with its ordinal and line (:283-286). Probe: 3 valid blocks plus 1 missing `lane_local_id` gave 3 entries and 1 error.
AC3 — implemented — tools/lane-ticket-allocation.ts:419-427 (sequential numbering in batch order, then entry order) and :478-488 (the `AllocatedTicket` fields plus `backlogRow`). The row shape matches docs/backlog.md:78, which has 6 columns.
AC4 — implemented — tools/lane-ticket-allocation.ts:456-476. `E<n>` ids pass through, lane-local refs are remapped, and anything else goes to `unresolvedDependencies`, never into `dependsOn` or the row. Probe: `[E109, L-X-NEW-2]` became `[E109, E178]`.
AC5 — implemented — tools/lane-ticket-allocation.ts:106-109 and :491. Probe: a second call seeded with `maxAllocatedId` 179 issued E180–E182, with no repeats.
AC6 — implemented — tools/lane-ticket-allocation.ts:500-521. Only the leading cell counts, and a sub-lettered id counts by its base number. Probe on the spec fixture gave 174.
AC7 — implemented — tools/lane-ticket-allocation.ts:546-559. Branch names are compared to branch names by exact equality. It returns `[]` on empty input, and the doc comment states the "unapplied entries, not file existence" contract (:536-541).
AC8 — implemented — tools/lane-ticket-allocation.ts:581-645. Blocks move verbatim into `## Applied`, unnamed entries stay where they are and still parse, and a second run is idempotent (probe: re-marking returned the input unchanged).
AC9 — implemented — neither `allocateTicketIds` (:411) nor `markApplied` (:581) takes a disposition parameter.

## Correctness
No required findings. AC7 does not depend on `parsePendingTickets` behaving differently for applied and unapplied files: re-parsing after `markApplied` returns only the unmoved entries.

- **recommended — a block appended after `## Applied` silently disappears** (tools/lane-ticket-allocation.ts:213-217, :641-643). `markApplied` appends `## Applied` at EOF when the section is missing (:643). The archive section runs until the next h1/h2 heading. So the natural next write, appending a new finding at the end of the file, puts that block inside the archive. `parsePendingTickets` then skips it with no error, and `detectOrphanLanes` never sees it. I reproduced this: a block `L-X-NEW-4` appended after a `markApplied` result was missing from both `entries` and `errors`. This is exactly the silent loss the spec's Problem Statement exists to prevent. It does not block this cut, because the header (:39-43) does define "under `## Applied` = archive", and no writer is wired yet (E124b). But the module's doc comments are the format spec (Out of Scope: no template file), so the writer rule should be stated explicitly: new blocks go above `## Applied`. Better still would be a structural guard, for example keeping `## Applied` pinned to the end and having the parser report a block found after the last archived block. Hand this to E124b if it is not fixed here.
- **recommended — an unmatched plain fence in the prose swallows the next `pending-ticket` block without reporting it** (tools/lane-ticket-allocation.ts:182-197). If a stray ```` ``` ```` appears in the free-form prose, a later ```` ```pending-ticket ```` line is read as content inside that fence. The block's closing ```` ``` ```` then closes the stray fence. I reproduced this: `{ entries: [], errors: [] }`. This matches CommonMark, since the rendered markdown also shows it as code. But it breaks the AC2 degrade-honest posture. A cheap fix is to push an `errors` line when a non-pending fence's content contains a line matching the pending opener.
- optional — `lane` on an `AllocatedTicket` is `batch.lane` (:425), so the `entry.lane` the parser set is ignored. If the two disagree, that is a caller bug and it goes unreported. The choice is defensible; see the rulings below.
- optional — with CRLF input, the new `## Applied` heading is written with a bare LF (:643), which mixes line endings. The block lines themselves keep their `\r`.

## Quality
Naming and structure match the sibling `tools/lane-*.ts` modules. There is no dead code, and the two exported paths share a single scanner (`scanPendingFile`), so nothing is duplicated.

- **recommended — size: 645 lines against the ≤300 `task_size` budget.** Breakdown: 215 comment lines, 56 blank lines, and about 374 code lines. My ruling: the overage is **mostly justified, not scope bloat.** (1) There are no exports beyond the spec's five functions and their result types. (2) Each doc block carries contract text the spec puts on the module: the Out of Scope section says the format is "fully specified by AC1-AC2 and the module's own doc comments". (3) The fence-aware scanner (:157-234, about 60 code lines) is not optional. Without it, a `## Applied` or a `pending-ticket` fence quoted inside another code block would corrupt AC8's archive semantics. What does look like speculative generality (Constitution §1 MVP) is small, about 20–25 lines:
  - tilde fences, and the rule that a backtick fence's info string cannot contain a backtick (:203-205);
  - a comma-separated string form for `depends_on` (:251);
  - the post-loop safe-integer overflow check (:428-430), which is unreachable in practice once `currentMaxId` has been validated;
  - the "where" wording in the ambiguous-reference error (:468).

  Trimming these would help, but even trimmed, the code alone is still over 300 lines. So the budget overage is inherent to a 5-function spec, and it is a PM slicing question, not a defect in the implementation.

## Architecture
There is no `specs/e124-lane-ticket-allocation-architecture.md`; the spec explicitly waives an architect pass. Layering follows the spec: every impure edge is the caller's. Nothing is imported from `tools/lane-paths.ts` or `tools/lane-registry.ts`, and both are forbidden or owned by other lanes, so that is correct. The module stays unregistered in `LANE_FILES` as the spec intends (the gap is filed as L-STATE-NEW-1).

**Rulings on the judgment calls the spec left open** (the coordinator asked for these; I judged each one against the spec, not against the writer's reasoning):
1. Parser rejects a block with an `id` key: **upheld.** This enforces AC1's rule of no `id` field anywhere.
2. Parser rejects an `E<n>`-shaped `lane_local_id`: **upheld.** Without this, AC4's "E<n> passes through unchanged" rule would be ambiguous.
3. Parser rejects a malformed `depends_on`/`source`/`body`: **upheld.** This is the AC2 skip-and-report posture.
4. Duplicate `lane_local_id`, first one wins, the rest are reported: **upheld.** It is deterministic, and `markApplied` mirrors it (:591-601), so "movable" and "parsed" never disagree.
5. `depends_on` accepts a list, a comma string, or `none`: **upheld, but trim recommended.** `none` matches the backlog table's own spelling. The comma-string form is speculative (see Quality).
6. Blocks under any `## Applied` h2 are archive and never parsed: **upheld.** AC8 requires it. See the first Correctness finding for the writer-side hazard.
7. Lane-local refs resolve in the same batch first, then across batches, and only on exactly one match: **upheld.** "Resolvable within the same call" (AC4) includes other batches, and preferring the same batch is the least surprising order.
8. Zero, ambiguous, or self references go to `unresolvedDependencies` and are omitted from `dependsOn` and the row: **upheld.** This is exactly AC4's "never silently dropped, never a dangling token".
9. Forward references resolve (two passes): **upheld.** Otherwise the result would depend on entry order for no reason.
10. The output `lane` is `batch.lane`: **upheld.** At allocation time the batch is the authority (optional note above).
11. `RangeError` on a negative or non-safe `currentMaxId`: **upheld.** Throwing is correct; guessing a base would reintroduce collisions.
12. The extra `maxAllocatedId` field: **upheld.** It is additive, and it is the natural value for AC5's re-derived `currentMaxId`.
13. `backlogRow` is one line, with whitespace collapsed, `|` escaped, and em dashes in the est.files and design-link cells: **upheld.** It matches docs/backlog.md:78 and the existing rows' `—` convention.
14. `extractMaxBacklogId` does not skip fenced code: **upheld.** Overcounting only wastes an id; undercounting causes collisions.
15. `markApplied` targets the FIRST `## Applied` and appends one at EOF when none exists, ignores unknown ids, and returns the input byte-identical when nothing matches: **upheld,** subject to the first Correctness finding about where the section is placed.

## Security
No findings. A free-form `body`, `title` or `source` cannot break or inject table columns, because newlines are collapsed and `|` is escaped (:367-369). YAML is loaded with `CORE_SCHEMA` (:297), so there are no custom tags or code-execution types. There are no secrets, file system access or subprocesses. An `E<n>` digit string above the safe-integer range can only produce a `RangeError` in `allocateTicketIds`, never a wrong id.

## Performance
No findings. The scan, parse and max extraction are linear in the number of lines. Dependency lookup uses a `Map` (:434-439). The `resolved.includes` dedupe is O(deps²) per ticket, and deps is tiny. `markApplied` re-parses each block on its own (:593-601), which is O(blocks × block size), still linear overall. None of this is a hot path, and there is no regression against base because the module is new.

## Verdict
APPROVED — every AC (AC1–AC9) is implemented and matched my probe. `dist/` is built from source. The three `recommended` findings (the append-after-`## Applied` silent loss, the stray-fence silent loss, and trimming for size) should go to this lane's next round or to E124b. None of them is a spec violation in this unwired, pure-core cut.

Reviewer note: I ran on opus and the writer was pinned to fable, so this is not a same-model review.

## Round 2 — APPROVED — by code-reviewer

covers: T-E124-01, T-E124-02

## Summary
- The delta is commit e2bc7db only: 1 file (`specs/e124-lane-ticket-allocation.md`), 1 line changed (+1/-1).
- It fixes the Visual Tokens `N/A` row by adding a 4th `—` cell, so the row matches the table's 4-column header.
- T-E124-01's code (5fd09da) has not changed since the Round 1 APPROVED verdict. That verdict carries forward.
- Verdict: APPROVED.

## AC Completeness
AC1–AC9: unchanged from Round 1 (all implemented). The delta touches no AC-bearing code; it only corrects the spec's table formatting.

## Correctness
No findings. The row at specs/e124-lane-ticket-allocation.md:204 is now `| N/A | — | feature has no visual literals | — |`, which gives 4 cells for a 4-column header. `node --test test/check-md-tables.test.mjs` passes 49/49.

## Quality
No findings. The `—` placeholder matches the convention already used in the `property` cell of the same row.

## Architecture
No findings. The change is doc-only and involves no layering.

## Security
No findings. The change is doc-only.

## Performance
No findings. The change is doc-only.

## Verdict
APPROVED. The delta is limited to the one malformed table row, and it clears the QA round-1 table-lint failures without touching the code approved in Round 1. The Round 1 `recommended` findings still stand as advisory.
