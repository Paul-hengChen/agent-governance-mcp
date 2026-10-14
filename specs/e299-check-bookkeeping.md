# e299-check-bookkeeping

Ticket E299 (`docs/backlog.md`), lane `e299`, wave manifest `specs/fanout-post-v4-w1.md`
(e299 row). Scope is ticket items (1)–(5) only; the `content/skill-integrator.md` 5c pointer
is wave 2.

## Problem Statement

The integrator's bookkeeping writes — `docs/backlog.md` rows and done-marks,
`docs/v4.0.0-new-tickets.md` ticks, `specs/fanout-*.md` Decisions rows, ticket-id
allocation — are judged by nobody, and every class has already failed at least once
(a reused id, done-marks citing an evidence path that no longer exists, shipped tickets
left unticked in the queue, done-marks buried mid-cell for weeks because the E88 rule is
only an advisory). Since E297 that bookkeeping rides the wave PR, so a check that fails
inside `npm test` can keep a wrong write out of `main`. This feature adds
`scripts/check-bookkeeping.mjs` (four mechanical checks), promotes the E88 done-mark
position advisory in `scripts/check-md-tables.mjs` to a failure, and brings the current
corpus to green with mechanical edits only.

## User Stories

- As the integrator, I want `npm test` to fail on a duplicate or out-of-order ticket id, a
  dead evidence citation, a queue row out of step with the backlog, or an incomplete
  Decisions row, so that CI on the wave PR catches my bookkeeping mistakes before `main`.
- As a release-engineer archiving evidence files, I want the check to name the path a stale
  citation should now use, so that fixing it is a copy-paste, not a search.
- As a lane PM or qa-engineer, I want the check to run unchanged in a lane worktree and on
  the primary checkout, so that lanes see the same verdict the integrator will.
- As a backlog reader, I want every DONE / PARTIAL / VOID mark to lead its cell, so that a
  truncated read never reports a shipped ticket as open.

## Acceptance Criteria

Terms used below: *ticket table* = any `docs/backlog.md` table whose header is exactly
`id | desc | priority | depends_on | est. files | design-link`; *order table* = header exactly
`order | ticket | intake | why here`; *queue table* = any `docs/v4.0.0-new-tickets.md` table
whose first two header cells are `#` and `票`; *genuine mark* = the first
`**DONE` / `**PARTIAL` / `**VOID` bold span in a cell that opens outside a code span and
outside a `*"…"*` citation quote and either self-closes or carries a `vX.Y[.Z]` / ISO-date
stamp (the existing `findGenuineDoneMark` rule in `scripts/check-md-tables.mjs`, reproduced
verbatim); *closed row* = a ticket-table row whose `desc` cell's genuine mark is at index 0 and
is `DONE` or `VOID` (`PARTIAL` counts as open); *tree* = `qa_reports` or `review_reports`;
*evidence citation* = a token matching
`(qa_reports|review_reports)/(archive/<dir>/)?<file>.(md|txt|json|jsonl|png)` anywhere in a
row's raw text (after `\|` unescaping). Tokens containing `*` or `{` (globs) and tokens with no
file extension (prose such as `qa_reports/review_<id>.md` written with angle brackets) are not
citations. All cell splitting uses the escape-aware `splitRow` discriminators from
`scripts/check-md-tables.mjs` (an escaped `\|` is a literal pipe; fenced code is never a
table; a row starts with `|` at column 0; the delimiter row is skipped).

### Check (1) — ticket ids unique and monotone

- **AC1** — Given a `docs/backlog.md` whose ticket tables contain the same `id` cell twice,
  when `node scripts/check-bookkeeping.mjs` runs, then it exits 1 and stderr contains
  `docs/backlog.md:<line> — ticket id <id> appears twice (first at line <n>)`.
  proof: `test/e299-check-bookkeeping.test.mjs` case `ID-DUP`.
- **AC2** — Given a `docs/backlog.md` that has both a ticket-table row `E1` and a long-form
  heading `## E1 — …` (the real file has fifteen such pairs, E1–E13/E18/E19/E9A), when the
  check runs, then no duplicate is reported: the id-space is the `id` cell of ticket-table
  rows only; `## <ID> — ` headings are long-form bodies of the same tickets and are not read.
  proof: `test/e299-check-bookkeeping.test.mjs` case `ID-HEADING-NOT-DUP`.
- **AC3** — Given a git repository whose base version of `docs/backlog.md` (see AC4 for how
  the base is chosen) has maximum numeric id `E10`, when the working tree adds a row `E9`,
  then exit 1 with `docs/backlog.md:<line> — new ticket id E9 is not above the previous
  maximum E10 (base <sha7>)`; when it adds `E11` instead, exit 0; when it adds `E10a` (a split
  of an id present in the base), exit 0. Numeric comparison uses the digits after `E`;
  a trailing letter is a split suffix.
  proof: `test/e299-check-bookkeeping.test.mjs` cases `ID-MONO-LOWER`, `ID-MONO-HIGHER`,
  `ID-MONO-SPLIT`.
- **AC4** — Given the check runs inside a git work tree, when it looks for the base, then it
  uses `git merge-base HEAD <ref>` with `<ref>` = the first of `--base <ref>` (CLI flag),
  `origin/main`, `main` that resolves to a commit, and reads `git show <base>:docs/backlog.md`.
  On primary `main` the base is `HEAD` itself (uncommitted additions are still checked); in a
  lane worktree it is the lane's fork point; in CI on a PR (`fetch-depth: 0`) it is the
  `origin/main` tip. When no ref resolves, or the file is absent at the base, then the
  monotone half is skipped with one stdout note `docs/backlog.md — id ordering not checked: no
  base commit found (pass --base <ref>)` and the exit code is unaffected.
  proof: `test/e299-check-bookkeeping.test.mjs` cases `ID-MONO-NO-BASE-NOTE`,
  `ID-MONO-BASE-FLAG`.

### Check (2) — evidence citations on closed rows

- **AC5** — Given a closed ticket-table row (or an order-table row whose `why here` cell has a
  genuine mark) citing `<tree>/<file>` that does not exist at the root, when the check runs,
  then exit 1 and stderr contains `docs/backlog.md:<line> — <id> cites <path>, which does not
  exist; the file is at <tree>/archive/<dir>/<file>` when exactly one file of that name exists
  under `<tree>/archive/`, else `docs/backlog.md:<line> — <id> cites <path>, which does not
  exist anywhere under <tree>/` (zero or several candidates; several are listed after
  `candidates:`).
  proof: `test/e299-check-bookkeeping.test.mjs` cases `CITE-ROOT-ARCHIVED`, `CITE-MISSING`,
  `CITE-AMBIGUOUS`.
- **AC6** — Given a closed row citing `<tree>/archive/<dir>/<file>` that does not exist, when
  a file of that name exists at `<tree>/<file>` (not yet archived), then exit 0 with one stdout
  note `docs/backlog.md:<line> — <id> cites <path>; the file is still at <tree>/<file> (not yet
  archived)`; when it instead exists under a different `<tree>/archive/<other>/<file>`, then
  exit 1 with the AC5 "the file is at" message.
  proof: `test/e299-check-bookkeeping.test.mjs` cases `CITE-PREDICTED-ARCHIVE-TOLERATED`,
  `CITE-WRONG-ARCHIVE-DIR`.
- **AC7** — Given a closed row citing `<tree>/<file>` that exists at the root, when the check
  runs, then exit 0 with one stdout note `docs/backlog.md:<line> — <id> cites <path> at the
  root; it moves under <tree>/archive/ at the next release`. Given an open row (no genuine
  mark leading `desc`) with any citation, then nothing is reported. Given a glob-shaped or
  extension-less token, then nothing is reported. The resolution lookup never crosses trees
  (a `review_reports/` citation is never resolved to a `qa_reports/` file).
  proof: `test/e299-check-bookkeeping.test.mjs` cases `CITE-ROOT-TOLERATED`, `CITE-OPEN-ROW-SKIPPED`,
  `CITE-GLOB-SKIPPED`, `CITE-NO-CROSS-TREE`.

### Check (3) — queue ↔ backlog

- **AC8** — Given a queue-table row whose `票` cell names `E<n>[letter]` ids (bold or not; all
  ids in the cell, e.g. `**E231**（併 E107）`), when the check runs, then every id must have a
  ticket-table row in `docs/backlog.md`, else exit 1 with
  `docs/v4.0.0-new-tickets.md:<line> — <id> has no row in docs/backlog.md`. Generic rule: a
  suffixed id `E<n><letter>` with no row of its own passes existence when its parent `E<n>` has
  a row, and is excluded from AC9 (it has no row to compare); the rule is stated in the check
  script's file-header comment and is never special-cased to any particular id in code
  (`E177c`, queue #55, is the measured live instance only). A queue row whose `#` cell is `—`
  (an un-ticketed note) is skipped.
  proof: `test/e299-check-bookkeeping.test.mjs` cases `QUEUE-MISSING-ROW`, `QUEUE-SUBID-PARENT`,
  `QUEUE-DASH-ROW-SKIPPED`.
- **AC9** — Given a queue row whose `票` cell contains `✅ DONE` (any trailing text) and whose
  first id's backlog row is not closed, then exit 1 with
  `docs/v4.0.0-new-tickets.md:<line> — <id> is ticked DONE here but docs/backlog.md:<n> does
  not lead with a DONE or VOID mark`; given a queue row without `✅ DONE` whose first id's
  backlog row is closed, then exit 1 with `docs/v4.0.0-new-tickets.md:<line> — <id> is not
  ticked DONE here but docs/backlog.md:<n> is marked <DONE|VOID>`. Only the first id in the
  cell is compared (merged ids such as `（併 E107）` are existence-checked only).
  proof: `test/e299-check-bookkeeping.test.mjs` cases `QUEUE-TICKED-OPEN`, `QUEUE-UNTICKED-CLOSED`,
  `QUEUE-ALIGNED`.

### Check (4) — fan-out Decisions rows

- **AC10** — Given each git-tracked `specs/fanout-*.md` that has a `## Decisions` heading, when
  the check runs, then the first table after that heading (before the next `## `) must have
  the header exactly `日期 | 裁決者 | 內容 | 出處`, else exit 1 with `<file>:<line> — Decisions
  table header must be "日期 | 裁決者 | 內容 | 出處"`; and each data row must satisfy: date
  cell matches `YYYY-MM-DD` (`<file>:<line> — decision row: date cell "<x>" is not
  YYYY-MM-DD`), decider cell is exactly `人類` or `整合者` (`<file>:<line> — decision row:
  decider cell is empty` / `<file>:<line> — decision row: decider cell "<x>" must name who
  decided (人類 or 整合者); who executed belongs in the content cell`), content and source cells
  are non-empty and not `—` (`<file>:<line> — decision row: content cell is empty` /
  `… source cell is empty`). A file without a `## Decisions` heading is skipped silently
  (two historical manifests, `fanout-wave5.1.md` and `fanout-wave6.md`, predate the section).
  A `## Decisions` heading with no table beneath it is a violation
  (`<file>:<line> — Decisions section has no table`).
  proof: `test/e299-check-bookkeeping.test.mjs` cases `DEC-HEADER`, `DEC-DATE`, `DEC-DECIDER-EMPTY`,
  `DEC-DECIDER-EXECUTOR`, `DEC-SOURCE-EMPTY`, `DEC-NO-SECTION-OK`, `DEC-NO-TABLE`.

### Check (5) — E88 done-mark position becomes a failure

- **AC11** — Given a `docs/backlog.md` ticket-table or order-table row whose designated cell
  (`desc` / `why here`) has a genuine mark at a non-zero index, when
  `node scripts/check-md-tables.mjs` runs, then it exits 1 and stderr contains
  `check:md-tables — <n> done-mark position violation(s) (docs/backlog.md E88):` followed by
  `  docs/backlog.md:<line> — done-mark **<TOKEN>** is buried mid-cell in the <column> column
  (should lead the cell) — see docs/backlog.md E88`; a leading mark, a mark in a non-designated
  column, and an identical table outside `docs/backlog.md` still produce no output and exit 0.
  When malformed tables and buried marks occur together, both lists are printed and the exit
  code is 1; the two counts are reported separately (a buried mark is never counted as a
  malformed table). The `findGenuineDoneMark` / `findCodeSpanRanges` /
  `findCitationQuoteRanges` predicates are unchanged.
  proof: `test/check-md-tables.test.mjs` — the six `ADV-*` cases re-targeted (`ADV-ORDER-TABLE`,
  `ADV-TICKET-TABLE`, `ADV-NONFATAL-BOTH-DIRECTIONS` now assert exit 1 and the stderr shape;
  `ADV-TICKET-TABLE-NEG`, `ADV-LEADING`, `ADV-NON-BACKLOG` still assert exit 0 and no output).
- **AC12** — Given the real corpus after T-E299-03, when `node scripts/check-md-tables.mjs`
  runs, then exit 0 with zero done-mark violations and the E145 row stays silent (its
  `*"…"*` citation of E59's mark). `CQ-9` is rewritten to assert exactly that (zero
  violations on the real file; E145 line absent from stderr); it no longer expects
  E39/E40/E58/E59 to be reported, because those rows are fixed in this cut. `AC7` (real-corpus
  exit 0) is unchanged in text and now load-bearing.
  proof: `node scripts/check-md-tables.mjs; echo "exit=$?"` prints `check:md-tables — OK (…)`
  then `exit=0`; `test/check-md-tables.test.mjs` case `CQ-9`.

### Wiring, root resolution, exit codes, output

- **AC13** — Given `package.json`, when read, then `scripts["check:bookkeeping"]` equals
  `node scripts/check-bookkeeping.mjs` and no other `package.json` line changes.
  `test/e299-check-bookkeeping.test.mjs` spawns the real script against this repository
  (case `REAL-CORPUS`: exit 0) so the check is part of `npm test` exactly as `check:md-tables`
  is (`test/check-md-tables.test.mjs` AC7 pattern).
  proof: `test/e299-check-bookkeeping.test.mjs` cases `WIRING`, `REAL-CORPUS`.
- **AC14** — Given the script is invoked from any cwd, when it resolves the repository root,
  then it uses the script's own location (`path.resolve(<script dir>, "..")`, the
  `check-md-tables.mjs` pattern), so a lane worktree checks the lane's files and primary checks
  primary's; it reads nothing under `.current/`; `specs/fanout-*.md` are listed through
  `git ls-files` (untracked manifests are silently not checked, the same rule as
  `check-md-tables`); `docs/backlog.md` and `docs/v4.0.0-new-tickets.md` are read from the
  working tree.
  proof: `test/e299-check-bookkeeping.test.mjs` case `ROOT-FROM-SCRIPT-LOCATION` (fixture repo
  with a `.current/<lane>/` directory present, run with a different cwd, exit 0).
- **AC15** — Given the script finishes, then the exit code is 0 when no violation was found
  (notes allowed), 1 when at least one violation was found, 2 when it cannot run
  (`docs/backlog.md` or `docs/v4.0.0-new-tickets.md` unreadable, or `git` not available for the
  manifest listing) with one stderr line `check:bookkeeping — cannot run: <reason>`. On
  success stdout ends with `check:bookkeeping — OK (<a> ticket row(s), <b> queue row(s), <c>
  decision row(s) checked)`. Violations go to stderr under
  `check:bookkeeping — <n> violation(s):` and end with `check:bookkeeping — FAILED`; notes go
  to stdout under `check:bookkeeping — <n> note(s) (non-blocking):`. Every violation and note
  line starts with two spaces and `<file>:<line> — `.
  proof: `test/e299-check-bookkeeping.test.mjs` cases `EXIT-0-WITH-NOTES`, `EXIT-1`, `EXIT-2`.
- **AC16** — Given the real corpus after T-E299-03 (five done-mark relocations, 46 citation
  rewrites, one queue tick — the list in *Mechanical fix list* below), when
  `node scripts/check-bookkeeping.mjs` runs in the lane worktree and on primary, then exit 0
  with exactly the 22 notes enumerated there (8 root-tolerated + 14 predicted-archive
  tolerated) and no violation.
  proof: `node scripts/check-bookkeeping.mjs; echo "exit=$?"` ends with `exit=0`.

## Copy / Strings

All strings are authored-here (no PRD or design source for CLI text); they avoid
governance jargon and name the file, line and fix.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| bk.id.dup | `docs/backlog.md:<line> — ticket id <id> appears twice (first at line <n>)` | authored-here — mirrors check-md-tables line format |
| bk.id.mono | `docs/backlog.md:<line> — new ticket id <id> is not above the previous maximum <Emax> (base <sha7>)` | authored-here |
| bk.id.nobase | `docs/backlog.md — id ordering not checked: no base commit found (pass --base <ref>)` | authored-here — note, non-fatal |
| bk.cite.resolved | `docs/backlog.md:<line> — <id> cites <path>, which does not exist; the file is at <resolved>` | authored-here |
| bk.cite.missing | `docs/backlog.md:<line> — <id> cites <path>, which does not exist anywhere under <tree>/` | authored-here; with `candidates: <a>, <b>` appended when more than one |
| bk.cite.root.note | `docs/backlog.md:<line> — <id> cites <path> at the root; it moves under <tree>/archive/ at the next release` | authored-here — note |
| bk.cite.pred.note | `docs/backlog.md:<line> — <id> cites <path>; the file is still at <tree>/<file> (not yet archived)` | authored-here — note |
| bk.queue.norow | `docs/v4.0.0-new-tickets.md:<line> — <id> has no row in docs/backlog.md` | authored-here |
| bk.queue.ticked | `docs/v4.0.0-new-tickets.md:<line> — <id> is ticked DONE here but docs/backlog.md:<n> does not lead with a DONE or VOID mark` | authored-here |
| bk.queue.unticked | `docs/v4.0.0-new-tickets.md:<line> — <id> is not ticked DONE here but docs/backlog.md:<n> is marked <TOKEN>` | authored-here |
| bk.dec.header | `<file>:<line> — Decisions table header must be "日期 \| 裁決者 \| 內容 \| 出處"` | authored-here (header cells per E286 revision O4) |
| bk.dec.notable | `<file>:<line> — Decisions section has no table` | authored-here |
| bk.dec.date | `<file>:<line> — decision row: date cell "<x>" is not YYYY-MM-DD` | authored-here |
| bk.dec.decider.empty | `<file>:<line> — decision row: decider cell is empty` | authored-here |
| bk.dec.decider.who | `<file>:<line> — decision row: decider cell "<x>" must name who decided (人類 or 整合者); who executed belongs in the content cell` | E286 revision O4 wording, authored-here |
| bk.dec.content | `<file>:<line> — decision row: content cell is empty` | authored-here |
| bk.dec.source | `<file>:<line> — decision row: source cell is empty` | authored-here |
| bk.head.viol | `check:bookkeeping — <n> violation(s):` | authored-here |
| bk.head.note | `check:bookkeeping — <n> note(s) (non-blocking):` | authored-here |
| bk.failed | `check:bookkeeping — FAILED` | authored-here — mirrors `check:md-tables — FAILED` |
| bk.ok | `check:bookkeeping — OK (<a> ticket row(s), <b> queue row(s), <c> decision row(s) checked)` | authored-here |
| bk.cannot | `check:bookkeeping — cannot run: <reason>` | authored-here |
| mt.e88.head | `check:md-tables — <n> done-mark position violation(s) (docs/backlog.md E88):` | authored-here — replaces the advisory header |
| mt.e88.line | `  docs/backlog.md:<line> — done-mark **<TOKEN>** is buried mid-cell in the <column> column (should lead the cell) — see docs/backlog.md E88` | unchanged from v3.111.0 |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The one-line `content/skill-integrator.md` 5c pointer at the check (wave 2 content lane).
- Prose correctness of any ticket row (E276 class); no ticket text is edited — only a
  done-mark span relocates, an evidence path is replaced by its resolved path, or a queue
  tick is added.
- Rows that are open (no leading mark): their citations are not checked (ticket item (2) is
  scoped to DONE/shipped rows).
- Checking the three-column legacy order tables (`order | ticket | why here`) or the
  `## A1 — …` long-form headings.
- Any change under `content/**`, `tools/**`, `gates/**`, `bin/**`, `dist/**`, other
  `scripts/**`, other `test/**`, `specs/fanout-*.md`, other `docs/**`, `CHANGELOG.md`.
- Repairing citations that a future release's archive move will break (the check names the
  new path; the repair is the release bookkeeping commit's, see finding E299-NEW-2).
- Adding a backlog row for `E177c` (integrator ruling: no row; the generic parent rule covers it).
- Validating `specs/fanout-post-v4-w1.md` itself inside this lane: it is not in the lane's base
  tree; the integrator runs the check on the integ branch after merge.

## Dependencies / Prerequisites

- Base `6b8a195`; lane branch `feat/e299-check-bookkeeping`; dispatch pin `sr-engineer=fable`.
- No `design/e299-check-bookkeeping.md` (mode = no-design): Visual Structural Assertions omitted.
- External references: none (ticket row and manifest are in-tree; no URLs). `external_refs`
  omitted on the routing write.
- T-E299-03 (corpus fixes) must land before T-E299-04 (E88 promotion) in the same branch, or
  `test/check-md-tables.test.mjs` AC7 goes red between commits. Task order below encodes this.
- `test/**` is qa-owned (Constitution §2): T-E299-05 is the qa-engineer's authoring task; sr
  tasks write no tests.
- Full-suite runs after commit with a clean tree (`check-md-tables` and the new check list
  tracked files only); wrap in `node scripts/test-lock.mjs -- npm test`.
- The cut was pre-reviewed through the lane mailbox before the human approved it (lane
  protocol §5 rule 2).

## Decisions

| date | decider | decision | source |
|---|---|---|---|
| 2026-10-14 | PM (proposed; integrator pre-review, human approval) | Id-space for check (1) = `id` cell of ticket-table rows only; `## <ID> —` headings are long-form bodies (E1–E19 appear in both; counting headings yields 15 false duplicates). | prototype on base |
| 2026-10-14 | PM (proposed) | Base for the monotone half = `merge-base(HEAD, --base \| origin/main \| main)`; degrades to a stdout note (never a failure) when no ref resolves. In a lane worktree this is the fork point; on primary main it is HEAD; in CI it is the `origin/main` tip (`fetch-depth: 0`). | AC4 |
| 2026-10-14 | PM (proposed) | Check (2) tolerance has two shapes, both notes: a root citation whose file is still at the root (ticket text), and a predicted `archive/<dir>/` citation whose file is still at the root (14 live rows wrote the E87 convention before release named the folder). Resolution of a dead path is by basename within the cited tree only, and only a unique match is printed as the fix. | prototype: 46 rewrites all unique; 0 ambiguous |
| 2026-10-14 | PM (proposed) | Check (3) "closed" = genuine `DONE`/`VOID` leading `desc`; `PARTIAL` is open. A suffixed queue id `E<n><letter>` without its own row passes existence through its parent `E<n>` and skips alignment — generic parent pass-through, integrator ruling 2026-10-14 (pre-review close), no finding filed; no E177c row is added on integ (an old number would trip check (1)); the rule lives in the script's file-header comment, never as an id special case. Un-ticketed `—` rows (N12, N13) are skipped. | prototype; mailbox to-lane#2 |
| 2026-10-14 | 整合者 (pre-review close) | E104 = DONE confirmed: its leading bold gets `DONE — ` inserted (row 226). | mailbox to-lane#2 |
| 2026-10-14 | 整合者 (pre-review close) | The 7 rewrites that replace a predicted `archive/<lane>/` folder with the actual `release-v4.x.x/` folder (E130, E180, E204, E212, E223 rows) are confirmed mechanical. | mailbox to-lane#2 |
| 2026-10-14 | PM (proposed) | Check (4) decider vocabulary is the closed set `人類` / `整合者` (E286 revision O4: "the SOP names the two 裁決者 values"); a manifest without `## Decisions` is skipped silently. | E286 row; 149 live rows pass |
| 2026-10-14 | PM (proposed) | Check (5) fixes all five live advisories, not the two the manifest lists: E39 (165), E40 (166), E58 (180) are the rows CQ-9 pins as "must advise", so CQ-9 is rewritten rather than the promotion scoped around them. | `node scripts/check-md-tables.mjs` on base: 5 advisories |
| 2026-10-14 | PM (proposed) | Done-mark relocation rule (mechanical, no prose change): cut the exact span ` **DONE** (<stamp>)` (leading space included) from its mid-cell position and prepend `**DONE** (<stamp>) — ` to the cell. E104's leading bold already carries a date stamp, so `DONE — ` is inserted after its opening `**` instead. | measured mark contexts |

## Measurements (prototype against the lane tree at base `6b8a195`)

| check | violations on base | where | classification |
|---|---|---|---|
| (1) duplicate ids | 0 (15 when headings are counted — the reason for the id-space decision) | — | — |
| (1) monotone | 0 new ids vs base (360 ids, max E300) | — | no-op on base by construction |
| (2) dead citations on closed rows | 46 citations across 29 rows: lines 180, 181, 183, 184, 192, 209, 215, 222, 243, 247 (×6), 252 (×2), 303 (×2), 327, 335, 345, 346 (×2), 357 (×2), 366 (×3), 371 (×3), 373 (×2), 374, 387, 391 (×2), 393, 394 (×3), 395, 396, 397, 515 (order row 5d) | all resolve to exactly one file in the cited tree | mechanical — fix in this lane (T-E299-03) |
| (2) tolerated (notes) | 22: 8 root citations still at the root (E74 line 196; E235 line 358 ×5; E239 line 362; E243 line 366; order 5d line 515) + 14 predicted-archive citations still at the root (E106 ×2, E108 ×3, E213 ×2, E229, E231 ×2, E232 ×2, E239 ×2) | — | no fix; they turn into AC5 failures at the release that archives them (finding E299-NEW-2) |
| (2) ambiguous / not found | 0 | — | — |
| (3) queue ↔ backlog | 2 real + 2 skipped: queue line 48 (#7 `E137`) not ticked but backlog line 259 leads with DONE; queue line 98 (#55 `E177c`) has no backlog row; lines 158–159 (`—` rows N12/N13) have no id | E137: mechanical tick (T-E299-03); E177c: generic parent pass-through, integrator ruling 2026-10-14 (pre-review close), no finding filed | 1 mechanical, 1 ruled |
| (4) Decisions rows | 0 across 149 rows in 15 manifests; 2 manifests without the section | — | — |
| (5) E88 advisories | 5: lines 165 (E39), 166 (E40), 180 (E58), 181 (E59), 226 (E104) | all mid-cell `**DONE** (shipped …)` spans, E104 a leading bold without the token | mechanical — fix in this lane (T-E299-03); CQ-9 rewrite (T-E299-05) |

## Mechanical fix list (T-E299-03; the check's own stderr is the oracle — re-run until clean)

Done-mark relocations in `docs/backlog.md` (`desc` cell):

| line | id | span to cut (exact, with its leading space) | prepend to the cell |
|---|---|---|---|
| 165 | E39 | ` **DONE** (shipped v3.99.0)` | `**DONE** (shipped v3.99.0) — ` |
| 166 | E40 | ` **DONE** (shipped v3.100.0)` | `**DONE** (shipped v3.100.0) — ` |
| 180 | E58 | ` **DONE** (shipped v3.99.0)` | `**DONE** (shipped v3.99.0) — ` |
| 181 | E59 | ` **DONE** (shipped v3.99.0, commit \`25d231e\`)` | `**DONE** (shipped v3.99.0, commit \`25d231e\`) — ` |
| 226 | E104 | (none) | insert `DONE — ` after the cell's opening `**`, giving `**DONE — SECOND RESET — EXECUTED 2026-09-28 by the human, repository now PUBLIC**:` |

Queue tick in `docs/v4.0.0-new-tickets.md` line 48 (#7): `**E137**` →
`**E137** ✅ DONE（merged 2026-09-24，`integ/wave5`，v3.118.0 發版）` (date and version from the
backlog row's own leading mark).

Evidence-path rewrites in `docs/backlog.md` (replace the cited token with the resolved one;
each is the unique file of that name in the cited tree):

| line | id | cited | resolved |
|---|---|---|---|
| 180 | E58 | `review_reports/review_T-E53-01.md` | `review_reports/archive/e57-dependency-advisory-decisions/review_T-E53-01.md` |
| 181 | E59 | `review_reports/review_T-E57-01.md` | `review_reports/archive/e57-dependency-advisory-decisions/review_T-E57-01.md` |
| 183 | E61 | `review_reports/review_T-E59-01.md` | `review_reports/archive/e39-e58-transition-matrix-sync/review_T-E59-01.md` |
| 184 | E62 | `review_reports/review_T-E39-01.md` | `review_reports/archive/e39-e58-transition-matrix-sync/review_T-E39-01.md` |
| 192 | E70 | `review_reports/review_T-E66-01.md` | `review_reports/archive/e66-e67-release-sop-docs-staging/review_T-E66-01.md` |
| 209 | E87 | `qa_reports/review_T-E52-01.md` | `qa_reports/archive/e52-metrics-rework-semantics/review_T-E52-01.md` |
| 215 | E93 | `review_reports/review_T-E6X-01.md` | `review_reports/archive/e61-e62-e70-prose-accuracy/review_T-E6X-01.md` |
| 222 | E100 | `review_reports/review_T-E96-01.md` | `review_reports/archive/e96-dispatch-preference-explicit/review_T-E96-01.md` |
| 243 | E121 | `review_reports/review_T-E117-01.md` | `review_reports/archive/e117-void-task/review_T-E117-01.md` |
| 247 | E125 | `qa_reports/review_T-E125A-06.md` | `qa_reports/archive/release-v4-wave6/review_T-E125A-06.md` |
| 247 | E125 | `review_reports/review_T-E125A-05.md` | `review_reports/archive/release-v4-wave6/review_T-E125A-05.md` |
| 247 | E125 | `qa_reports/review_T-E125B-04.md` | `qa_reports/archive/release-v4-wave6/review_T-E125B-04.md` |
| 247 | E125 | `review_reports/review_T-E125B-01.md` | `review_reports/archive/release-v4-wave6/review_T-E125B-01.md` |
| 247 | E125 | `qa_reports/review_T-E125C-06.md` | `qa_reports/archive/release-v4-wave6/review_T-E125C-06.md` |
| 247 | E125 | `review_reports/review_T-E125C-04.md` | `review_reports/archive/release-v4-wave6/review_T-E125C-04.md` |
| 252 | E130 | `qa_reports/archive/e130-lane-default/review_T-E130-07.md` | `qa_reports/archive/release-v4.0.0/review_T-E130-07.md` |
| 252 | E130 | `review_reports/archive/e130-lane-default/review_T-E130-09.md` | `review_reports/archive/release-v4.0.0/review_T-E130-09.md` |
| 303 | E180 | `qa_reports/archive/e180-abandoned-harvest/review_T-E180-05.md` | `qa_reports/archive/release-v4.0.0/review_T-E180-05.md` |
| 303 | E180 | `review_reports/archive/e180-abandoned-harvest/review_T-E180-01.md` | `review_reports/archive/release-v4.0.0/review_T-E180-01.md` |
| 327 | E204 | `qa_reports/archive/e204-pin-e125c-fixture/review_T-E204-01.md` | `qa_reports/archive/release-v4.0.0/review_T-E204-01.md` |
| 335 | E212 | `qa_reports/archive/e212-deflake-ac13b/review_T-E212-01.md` | `qa_reports/archive/release-v4.0.0/review_T-E212-01.md` |
| 345 | E222 | `qa_reports/review_T-E222-01.md` | `qa_reports/archive/release-v4.0.0/review_T-E222-01.md` |
| 346 | E223 | `qa_reports/archive/e223-watch-rearm-gone/review_T-E223-01.md` | `qa_reports/archive/release-v4.0.0/review_T-E223-01.md` |
| 346 | E223 | `review_reports/archive/e223-watch-rearm-gone/review_T-E223-01.md` | `review_reports/archive/release-v4.0.0/review_T-E223-01.md` |
| 357 | E234 | `review_reports/review_T-E234-01.md` | `review_reports/archive/release-v4.2.0/review_T-E234-01.md` |
| 357 | E234 | `qa_reports/review_T-E234-05.md` | `qa_reports/archive/release-v4.2.0/review_T-E234-05.md` |
| 366 | E243 | `review_reports/review_T-E243-03.md` | `review_reports/archive/release-v4.1.0/review_T-E243-03.md` |
| 366 | E243 | `qa_reports/review_T-E243-03.md` | `qa_reports/archive/release-v4.1.0/review_T-E243-03.md` |
| 366 | E243 | `qa_reports/review_T-E243-04.md` | `qa_reports/archive/release-v4.1.0/review_T-E243-04.md` |
| 371 | E248 | `review_reports/review_T-E248-01.md` | `review_reports/archive/release-v4.1.0/review_T-E248-01.md` |
| 371 | E248 | `qa_reports/review_T-E248-01.md` | `qa_reports/archive/release-v4.1.0/review_T-E248-01.md` |
| 371 | E248 | `qa_reports/review_T-E248-02.md` | `qa_reports/archive/release-v4.1.0/review_T-E248-02.md` |
| 373 | E250 | `review_reports/review_T-E250-01.md` | `review_reports/archive/release-v4.2.0/review_T-E250-01.md` |
| 373 | E250 | `qa_reports/review_T-E250-06.md` | `qa_reports/archive/release-v4.2.0/review_T-E250-06.md` |
| 374 | E251 | `qa_reports/review_T-E250-05.md` | `qa_reports/archive/release-v4.2.0/review_T-E250-05.md` |
| 387 | E264 | `review_reports/review_T-E260B-01.md` | `review_reports/archive/e260b-tools-i-z/review_T-E260B-01.md` |
| 391 | E268 | `review_reports/review_T-E260E-12.md` | `review_reports/archive/E260E/review_T-E260E-12.md` |
| 391 | E268 | `qa_reports/review_T-E260E-12.md` | `qa_reports/archive/E260E/review_T-E260E-12.md` |
| 393 | E270 | `review_reports/review_T-E260F-22.md` | `review_reports/archive/e260f/review_T-E260F-22.md` |
| 394 | E271 | `review_reports/review_T-E260G-09.md` | `review_reports/archive/e260g-r3-fix/review_T-E260G-09.md` |
| 394 | E271 | `review_reports/review_T-E260G-17.md` | `review_reports/archive/e260g-r3-fix/review_T-E260G-17.md` |
| 394 | E271 | `qa_reports/review_T-E260G-09.md` | `qa_reports/archive/e260g-r3-fix/review_T-E260G-09.md` |
| 395 | E272 | `review_reports/review_T-E260H-11.md` | `review_reports/archive/e260h-test-m-z-eval/review_T-E260H-11.md` |
| 396 | E273 | `qa_reports/verify_E260H_T-E260H-26.md` | `qa_reports/archive/e260h-test-m-z-eval/verify_E260H_T-E260H-26.md` |
| 397 | E274 | `review_reports/review_T-E260I-11.md` | `review_reports/archive/e260i-r3-fix/review_T-E260I-11.md` |
| 515 | 5d (order) | `review_reports/review_T-E6X-01.md` | `review_reports/archive/e61-e62-e70-prose-accuracy/review_T-E6X-01.md` |

Line numbers are those of base `6b8a195`; none of the edits above adds or removes a line,
so they stay valid through T-E299-03.
