# Review — T-E299-01

covers: T-E299-01, T-E299-02, T-E299-03, T-E299-04

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base `6b8a195`, head `3b8faac` on `feat/e299-check-bookkeeping`, commits `dc5587d` (01),
`3b5a3f7` (02), `9168cc9` (03), `3b8faac` (04). Spec of record: `specs/e299-check-bookkeeping.md`
(no architecture spec). Reviewer tier: opus. Builder tier: fable, so the models differ.

## Summary

- Adds `scripts/check-bookkeeping.mjs` with four checks: ids unique and monotone, evidence
  citations on closed rows, queue and backlog alignment, and fan-out Decisions rows. It adds one
  `package.json` line, fixes the corpus mechanically (32 changed lines in `docs/backlog.md` and 1
  in `docs/v4.0.0-new-tickets.md`), and makes the E88 done-mark position rule in
  `scripts/check-md-tables.mjs` a failure instead of an advisory.
- Ownership holds: `git diff --stat 6b8a195...HEAD` touches only `scripts/check-bookkeeping.mjs`,
  `scripts/check-md-tables.mjs`, `package.json` (+1 line), `docs/backlog.md`,
  `docs/v4.0.0-new-tickets.md`, `specs/e299-check-bookkeeping.md` and `.current/e299/**`. Nothing
  changed under `test/`, `content/`, `tools/`, `gates/`, `bin/` or `dist/`.
- The code is correct against every AC I exercised. I tested the real corpus, ran with
  `--base 6b8a195`, ran from `/tmp`, and built a fixture repo that triggers every violation and
  note shape plus both exit-2 paths. The fixture output matches the spec's string table.
- Verdict: **CHANGES_REQUESTED** for one process gap only (F1). The handoff deliberately leaves
  14 tests in `test/check-md-tables.test.mjs` red, but there is no
  `qa_reports/expected-red_e299-check-bookkeeping.txt` manifest for them. No code change is
  requested.

## AC Completeness

- AC1 — implemented — `scripts/check-bookkeeping.mjs:302-311`. Fixture: `docs/backlog.md:11 — ticket id E1 appears twice (first at line 5)`, exit 1.
- AC2 — implemented — `:258-267`. The id space is the `id` cell of ticket-table rows only. A fixture `## E1 — long form` heading did not count as a duplicate.
- AC3 — implemented — `:327-347`. Fixture against base max E10: E9 gives `new ticket id E9 is not above the previous maximum E10 (base 2646da9)`. E11, E10a and E12b pass.
- AC4 — implemented — `:289-300, 313-325`. Resolution order is `--base`, then `origin/main`, then `main`, each through `rev-parse --verify` then `merge-base HEAD`. A fixture with no ref (branch `work`, no remote) prints the exact no-base note and exits 0. `--base 6b8a195` on the lane exits 0.
- AC5 — implemented — `:400-427`. Fixture covers all three shapes: the file is at a unique archive dir, it is missing everywhere, and it is ambiguous with `; candidates: …` (F6).
- AC6 — implemented — `:411-415`. A predicted-archive citation whose file is still at root gives a note. A citation of the wrong archive dir gives the "the file is at" violation (fixture `qa_reports/archive/r9/a.md` → `r1`).
- AC7 — implemented — `:404-409, 401-402, 354-355`. A root citation that exists gives a note. Open, PARTIAL and mid-cell DONE rows are skipped. Glob (`review_*.md`) and angle-bracket tokens are skipped. Lookup never crosses trees: the fixture's `review_reports/rv.md` resolved to `review_reports/archive/r1/rv.md`, ignoring a `qa_reports/rv.md` at root.
- AC8 — implemented — `:433-450`. Every id in the `票` cell is checked (fixture `**E99**（併 E10）` reports E99, existence-checks E10). `E10c` passes through its parent and `E77c` (no parent) is reported. `—` rows are skipped. The generic rule is stated in the file-header comment (`:18-21`), and `grep -n E177 scripts/check-bookkeeping.mjs` returns no hits.
- AC9 — implemented — `:451-459`. Ticked-but-open and closed-but-unticked both fire with the exact strings. Only the first id is compared.
- AC10 — implemented — `:477-517`. Fixture triggers header, no-table, date, decider-empty, decider-executor, content-empty and source-empty. A manifest without the section is silent.
- AC11 — implemented — `scripts/check-md-tables.mjs:377-394`. Violations go to stderr under the spec header, the per-line text is unchanged, and the run exits 1. The lists and counts stay separate (`doneMarkViolations` is never pushed into `allViolations`). `FAILED` is printed once, at the end (deviation 3, accepted below). Predicate bodies are byte-unchanged vs base: only comment lines differ inside `findCitationQuoteRanges`.
- AC12 — implemented — `node scripts/check-md-tables.mjs` gives `OK (519 file(s) scanned, 0 malformed tables)`, exit 0. Re-targeting `CQ-9` belongs to qa (T-E299-05).
- AC13 — implemented — `package.json:16`. It is the only line changed. The `REAL-CORPUS` / `WIRING` tests belong to qa.
- AC14 — implemented — `:39-40`. Root is resolved from the script location: a run from `cwd=/tmp` checked the lane and resolved a base. Only `docs/`, `specs/fanout-*.md` (via `git ls-files`) and `<tree>/archive/` are read. Nothing under `.current/` is read.
- AC15 — implemented — `:220-231, 469-475, 537-551`. Fixture: a missing queue file gives `cannot run: docs/v4.0.0-new-tickets.md is unreadable (ENOENT)`, exit 2. A non-git directory gives `cannot run: git ls-files failed (…)`, exit 2. Violations exit 1 and end in `FAILED`. A clean run exits 0 and ends with the OK line.
- AC16 — implemented, with an accepted deviation — the real corpus exits 0 with 0 violations and **23** notes, not 22 (deviation 1, below).

### Recorded deviations, judged

1. **23 notes, not 22 — ACCEPTED.** The spec's own Measurements enumeration lists nine root-tolerated
   citations (E74 196; E235 358 ×5; E239 362; E243 366; order 5d 515) but sums them as 8. The
   ninth, `docs/backlog.md:196` E74 → `qa_reports/review_T-E3-QA.md:111`, is a real citation of an
   existing root file. The token regex stops at `:` (`:354`), which is what makes the
   line-suffixed form resolve. Dropping it would hide a future dead citation. This is an
   arithmetic error in the spec, and AC16 should read 23 when the spec is next touched.
2. **Order-row `<id>` and "closed" — ACCEPTED.** AC5 says only that the `why here` cell "has a
   genuine mark", and the message `<id>` for order rows is unspecified. The implementation uses
   the first `E<n>` of the ticket cell (`:272-276`) and treats DONE/VOID at any index as closed,
   with PARTIAL open (`:277`). That is consistent with the "closed row" definition. Since
   T-E299-04 makes a non-leading mark fatal, the any-index choice changes nothing on a green
   corpus. See F3 for a labelling nit.
3. **`FAILED` printed once at the end for either list — ACCEPTED.** AC11 requires both lists to
   print and exit 1, with separate counts. Ending with one `FAILED` keeps a done-mark-only failure
   from ending without the marker. The per-line text is unchanged and the malformed-table block
   is otherwise untouched.

## Correctness

- **F1 — required — `qa_reports/expected-red_e299-check-bookkeeping.txt` is missing (SOP 4a; sr-engineer SOP 7a).**
  After `3b8faac`, `node --test test/check-md-tables.test.mjs` fails 14 of 49 tests:
  ADV-ORDER-TABLE, ADV-TICKET-TABLE, ADV-NONFATAL-BOTH-DIRECTIONS, CS-UNMATCHED-BACKTICK,
  CS-2RUN-CONTAINING-1RUN, CS-PAIRED-3BACKTICK, CS-UNPAIRED-3BACKTICK, CS-MULTI-CANDIDATE,
  CS-ESCAPED-PIPE-ADJACENT, CQ-MULTI-CANDIDATE, CQ-GENUINE-OUTSIDE-QUOTE, CQ-UNPAIRED-OPENER,
  CQ-BOLD-RUN-NOT-AN-OPENER and CQ-9.
  - All 14 are intentional consequences of AC11/AC12. I sampled CS-UNMATCHED-BACKTICK and
    CQ-GENUINE-OUTSIDE-QUOTE: both fail on stdout being empty and exit 1 instead of 0, which is
    the channel and exit contract change, not a predicate change.
  - Seven of the 14 (the CS-* and the non-CQ-9 CQ-* cases) are outside the re-target list in
    spec AC11 and T-E299-05. Without a manifest, qa's Phase 0.5 sees seven reds that its own
    task does not name, and the only place they are listed is a `pending_notes` entry that
    `tw_get_state` already truncates.
  - Fix: add `qa_reports/expected-red_e299-check-bookkeeping.txt` with one
    `test/check-md-tables.test.mjs | <exact test-name prefix>` line per test above, and commit it.
    No code change. The coordinator's ownership list for this lane needs that one path added
    (lane protocol §3 already lets lanes commit `qa_reports/`).
- **F2 — optional — `scripts/check-bookkeeping.mjs:436`.** `new Map(ticketRows.map(...))` keeps the
  *last* row for a duplicated id, so check (3) compares against the duplicate. In the fixture,
  `docs/v4.0.0-new-tickets.md:3` named `docs/backlog.md:11` (the dup) instead of line 5. This only
  happens when check (1) has already failed. Keeping the first occurrence would make the two
  checks agree.
- No other correctness findings. T-E299-03 is purely mechanical:
  - `git diff --numstat 6b8a195 9168cc9 -- docs/` gives 32/32 and 1/1.
  - I replayed the spec's Mechanical fix list programmatically on base `docs/backlog.md`: 4 span
    relocations, the E104 `DONE — ` insert and 46 token rewrites. The result is
    **byte-identical** to `9168cc9` (0 mismatching lines).
  - The E137 queue tick matches the spec text exactly.
  - 12 of the rewritten paths resolve via `git ls-files --error-unmatch` (E53, E52, E125A,
    E130, E212, E234, E248, E260E, E260H verify, E6X order 5d, E260I, E260G).
  - E104 now opens `**DONE — SECOND RESET — EXECUTED 2026-09-28 …**`. The span body carries an
    ISO date, so `findGenuineDoneMark` returns `{index: 0, token: "DONE"}`; the live checks agree
    (0 done-mark violations, and the row is closed for check 2).

## Quality

- **F3 — optional — `scripts/check-bookkeeping.mjs:276`.** An order row's messages use the first
  ticket id, for example `docs/backlog.md:515 — E61 cites …` for order row 5d. That row lists
  E61, E62 and E70, and a reader may look for the citation on the E61 ticket row. The line
  number disambiguates, but a label such as `order 5d (E61)` would be clearer. Not
  spec-mandated.
- **F4 — recommended — `scripts/check-bookkeeping.mjs:30-32, 55-209`.** The four predicates are
  copied from `check-md-tables.mjs`. I diffed the bodies and they are identical apart from two
  trailing comments. Parity rests on the comment "Keep the two in step". A cheap parity assertion
  in qa's T-E299-05 (comment-stripped function bodies equal) would catch drift. The
  self-contained rationale (copied into fixture repos) is sound.
- Comment discipline (§6): the header comment states the four checks, the id space, the generic
  suffix rule and the tolerance shapes. It has no local paths, no id special cases and no
  governance jargon in output strings. The `check-md-tables.mjs` comment edits are accurate to
  the new behaviour and keep the pointer to the advisory history.
- No dead code. Naming matches the sibling script.

## Architecture

- No architecture spec exists. The script follows the `check-md-tables.mjs` pattern: it resolves
  root from its own location, lists files through `git ls-files`, and keeps notes on stdout and
  violations on stderr.
- It adds no dependencies (node built-ins only) and makes no TS-tree change.
- The `check:bookkeeping` script line is the only wiring. `npm test` coverage arrives with qa's
  `REAL-CORPUS` case, as the spec intends.

## Security

- No new trust boundary. `git` runs through `execFileSync` with an argument array, so there is no
  shell. `--base <ref>` reaches git only as `rev-parse --verify --quiet <ref>^{commit}` and then
  `merge-base`/`show` with the resolved sha. A crafted ref cannot inject flags into `show`,
  because `merge-base` output is used.
- **F5 — optional — `:291-297`.** If `--base` names a ref that does not exist, the script silently
  falls back to `origin/main`. This matches AC4 ("first … that resolves"), but a typo'd `--base`
  goes unnoticed. A stdout note would help.
- Information hygiene: none of the tracked files in the diff contain `/Users/` or a worktree path.
- `npm audit --audit-level=high` exits 0.

## Performance

- Single pass per file. The archive index is one `readdirSync` per archive dir, built once
  (`:358-386`). There is one `existsSync` per citation on closed rows only, and queue lookup goes
  through a `Map`.
- The real corpus runs in well under a second. `check-md-tables.mjs` is unchanged in complexity.
- `npm run build` exits 0.

## Verdict

**CHANGES_REQUESTED.** The implementation is correct and the corpus edits are byte-for-byte
mechanical, but the handoff leaves 14 tests red on purpose without the expected-red manifest
(F1, required). The fix is one new file, `qa_reports/expected-red_e299-check-bookkeeping.txt`,
with no code change. F2–F5 are optional or recommended and do not block.

Other notes:
- **Other required changes:** none.
- **Gaps in the spec, for the PM:**
  - AC16 should read 23 notes.
  - AC11 and T-E299-05 should also name the seven CS-*/CQ-* cases that need re-targeting.
- **Accepted:** the three recorded deviations.
