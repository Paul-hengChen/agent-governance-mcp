# e179-ticket-allocation-wiring — architecture

Contract: `specs/e179-ticket-allocation-wiring.md` (AC1–AC11, the G1–G4
preconditions, the shared Error-refusal precondition). This document fixes
**where** each read and write happens, **in what order**, and **which sr task
owns it**. It adds no requirement the spec does not already state. Every
place where it narrows an ambiguity is a row in *Decision Records*. Two points
the spec originally left open (Q1, Q2) were escalated and are now resolved in
the amended spec (see *Open Questions*).

Terms used below:
- `repoRoot` is the primary checkout (`resolvePrimaryRepoRoot`).
- `lanePath` is the lane's linked worktree.
- `lane` is `ticketId` (the finish matcher already requires
  `resolveCurrentLane(lanePath) === ticketId`).
- `base` is `opts.base ?? "main"`.
- `pendingRel` is `path.posix.join(".current", lane, laneFile("pendingTickets").filename)`.
  The filename comes from `LANE_FILES`; the literal string never appears in
  `agc-init.mjs`.
- `BACKLOG_REL` is `"docs/backlog.md"`.

## Affected Files

| file | change | sr task |
|---|---|---|
| `tools/lane-paths.ts` | Add the `pendingTickets` entry to `LANE_FILES`, the `LanePaths.pendingTicketsPath` field, and the `LANE_PATH_FIELD` mapping. Update the "Exactly 5 entries" comment to 6 (AC1). | T-E179-02 |
| `tools/lane-migrate.ts` | `planMoves`: merge a sidecar only when it is an append-only JSONL log (AC10, DR-10). Update the header comment. | T-E179-02 |
| `tools/lane-ticket-allocation.ts` | AC9 deletions. | T-E179-03 |
| `tools/lane-ticket-allocation.ts` | AC6/AC7 scanner reporting. New pure helper `findAppliedProvenance`. Optional `opts` on `parsePendingTickets` (AC6 ruling R1). | T-E179-04 |
| `tools/lane-ticket-allocation.ts` | New pure helper `appendBacklogRows`. | T-E179-05 |
| `bin/agc-init.mjs` | `loadTicketAllocation()` loader. `applyPendingTickets` for finish. `abandonEvidence` split into `planAbandonEvidence` and `applyAbandonEvidence`. Rewired `runFeatureFinish` (AC2/AC3/AC4). | T-E179-05 |
| `bin/agc-init.mjs` | `checkOrphanLanes(cwd)`. `runCheck` becomes `async`. Dispatch updated (AC5). | T-E179-06 |
| `content/coord-03-core-fallback.md`, `content/skill-release-engineer.md` | Prose only (AC8). | T-E179-15 |
| `dist/**` | `npm run build` after every sr task that edits `tools/*.ts`. `agc-init.mjs` imports from `dist/`, so the dist copy must be current before T-E179-05/06 are exercised. | each tools task |
| `test/lane-paths.test.mjs` | Qa-owned. REG1's "exactly 5 entries" assertion goes red at T-E179-02, and that is expected; T-E179-10 updates it. | T-E179-10 (qa) |
| `test/lane-ticket-allocation.test.mjs` | Qa-owned. | T-E179-09 (qa) |
| `test/agc-feature-lifecycle.test.mjs` | Qa-owned. | T-E179-11 (qa) |
| `test/lane-migrate.test.mjs` | Qa-owned. | T-E179-12 (qa) |
| `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | Qa-owned. | T-E179-17 (qa) |

No file outside the spec's *Dependencies → Files owned* list is touched.
`docs/backlog.md` is **written at runtime by the command**, never edited by
this ticket. `tools/handoff-parse.ts` is forbidden and needs no change; see
DR-11.

## Data Structures

### `tools/lane-paths.ts` (T-E179-02)

```ts
{ key: "pendingTickets", filename: "pending-tickets.md", required: false }   // appended last in LANE_FILES
interface LanePaths { /* existing 5 fields */ pendingTicketsPath: string; }
LANE_PATH_FIELD.pendingTickets = "pendingTicketsPath";
```

`LaneFileEntry` keeps its three fields. No `mergeable` flag is added (DR-10).

### `tools/lane-ticket-allocation.ts` scanner after AC9 (T-E179-03, then T-E179-04)

```ts
// AC9: backtick only; the "info string may not contain a backtick" special case is deleted.
const OPEN_FENCE_RE  = /^ {0,3}(`{3,})(.*)$/;
const CLOSE_FENCE_RE = /^ {0,3}(`{3,})[ \t]*\r?$/;
// T-E179-04: the same info-string rule the scanner already applies (first whitespace token === "pending-ticket")
const PENDING_OPENER_RE = /^ {0,3}(`{3,})[ \t]*pending-ticket(?:[ \t]|\r?$)/;

interface SwallowedOpener {
  fenceStart: number;   // 0-based line of the enclosing NON-pending fence opener
  line: number;         // 0-based line of the swallowed ```pending-ticket line
  runLen: number;       // its backtick run length
  fenceLen: number;     // enclosing fence's run length
  reason: "unclosed-at-eof" | "closes-enclosing-fence";   // both per AC7 ruling (b)
}
interface ScanResult {
  lines: string[];
  blocks: ScannedBlock[];
  appliedSections: AppliedSection[];
  swallowed: SwallowedOpener[];   // new
}
```

The scanner's fence state gains `swallowed: {line, runLen}[]`, which is
populated only while `fence.pending === false`:
- **AC7 literal.** At EOF, if a non-pending fence is still open and has at
  least one swallowed opener, emit `reason: "unclosed-at-eof"` for each one.
- **AC7 ruling (b).** When a non-pending fence closes, emit
  `reason: "closes-enclosing-fence"` for every swallowed opener with
  `runLen >= fence.len`. Swallowed openers with `runLen < fence.len` are
  CommonMark-legal nesting and are dropped silently.
- Each swallowed opener yields at most one entry: `closes-enclosing-fence`
  when its enclosing fence closes, `unclosed-at-eof` when that fence is still
  open at EOF.

`blocks[].ordinal` counts only real `pending-ticket` openers, as it does
today. Swallowed openers are never counted, so no existing error ordinal
shifts. `markApplied` ignores `swallowed` and its behaviour does not change.

### AC9 in `normalizeDependsOn` (T-E179-03)

- String input: `v.trim()` is one reference. `""` and `"none"` (any case)
  mean empty. A comma no longer splits the string.
- Array input: unchanged.
- The doc comment drops "or a comma-separated list".
- The post-loop `Number.isSafeInteger(next)` throw in `allocateTicketIds` is
  deleted.

## Interface Contracts

### `tools/lane-ticket-allocation.ts`

```ts
// T-E179-04 (AC6 ruling R1)
export interface ParsePendingTicketsOptions {
  /** laneLocalIds that docs/backlog.md already records for THIS lane (from findAppliedProvenance).
   *  When provided, every well-formed ARCHIVED block whose lane_local_id is NOT in the set is
   *  reported in `errors` (AC6). When omitted, archived blocks are never inspected. This is
   *  today's behaviour, so the E124 test at test/lane-ticket-allocation.test.mjs:342 stays green unmodified. */
  appliedLaneLocalIds?: ReadonlySet<string>;
}
export function parsePendingTickets(fileText: string, lane: string, opts?: ParsePendingTicketsOptions): ParsePendingTicketsResult;

// T-E179-04. Pure. Scans ONLY lines whose leading cell matches BACKLOG_ROW_ID_RE's row shape.
// Returns laneLocalId -> leading-cell id (e.g. "E190") for every row whose desc cell contains
// the exact provenance needle for `lane`. See "Skip-already-applied provenance match".
export function findAppliedProvenance(backlogText: string, lane: string): Map<string, string>;

// T-E179-05. Pure. Inserts `rows` (each an AllocatedTicket.backlogRow) directly after the last
// contiguous `|`-prefixed line of the ticket table whose header row matches
// /^\|\s*id\s*\|\s*desc\s*\|\s*priority\s*\|/. Preserves the input's trailing newline.
// Throws Error("docs/backlog.md: ticket table header `| id | desc | priority | ...` not found")
// when the header is absent. It never guesses a location.
export function appendBacklogRows(backlogText: string, rows: string[]): string;
```

The per-block validation inside `parsePendingTickets` is factored into one
internal `validateBlock(block, lane): { entry } | { error }`. Live blocks and
archived blocks (under R1) share it, so the definitions of "archived
well-formed block" and "live entry" cannot diverge. `markApplied`'s
existing isolated re-parse is left as-is.

### `bin/agc-init.mjs`

```js
async function loadTicketAllocation()          // same shape as loadLanePaths(); imports ../dist/tools/lane-ticket-allocation.js
function readBlob(repoRoot, rev, rel)         // gitTry(repoRoot, ["cat-file","-e",`${rev}:${rel}`]) -> null if absent,
                                              // else git(repoRoot, ["show", `${rev}:${rel}`]). Never fs for a pre-commit read.
function planAbandonEvidence(lanePath, ticketId)       // -> { moves }  (the existing precondition + clash check, NO mutation)
function applyAbandonEvidence(lanePath, ticketId, moves) // -> { committed, untrackedMoved } (the existing moves + AC23 commit)
// abandonEvidence(lanePath, id) === applyAbandonEvidence(lanePath, id, planAbandonEvidence(lanePath, id).moves)
function planPendingApply({ alloc, lanePaths, repoRoot, rev, base, lane, pendingRel })
   // pure-ish: reads blobs only. -> null (no-op) | { pendingText, backlogText, toAllocate, skipped: Map, allocated[] }
   // throws FeatureError on C1 (content) refusals
function assertPrimaryWritable(repoRoot, base, lane, pendingRel)   // C2 (a) + C3 (b); throws FeatureError, mutates nothing
async function checkOrphanLanes(cwd)          // AC5; never throws, never exits
async function runCheck(cwd)                  // now async; awaits checkOrphanLanes after checkWorktreeEvidence
```

## Step order — `agc feature finish --shipped` (AC2, AC4, Error-refusal, G4(b) symmetry)

**Checks** (steps 1–10) mutate nothing. **Mutations** (M1–M3) run only after
every check has passed. The three reads marked `rev` use
`readBlob(repoRoot, base, ...)`, which reads the object database through the
primary checkout without looking at its working tree. That is why the content
refusal can run before any primary-state check, as the spec requires ("never
on primary's state").

| # | step | runs in | reads / writes |
|---|---|---|---|
| 1 | `resolvePrimaryRepoRoot`, parse, lane match | primary | existing, unchanged |
| 2 | `resolveBaseCommit(base)` + AC16 merge guard | primary | existing, unchanged, still first |
| 3 | `pendingText = readBlob(repoRoot, base, pendingRel)`. If `null`, **no-op** and go to step 11. | odb | read |
| 4 | `backlogText = readBlob(repoRoot, base, BACKLOG_REL) ?? ""` | odb | read (fresh per process: AC4) |
| 5 | `prov = findAppliedProvenance(backlogText, lane)`, then `parsed = parsePendingTickets(pendingText, lane, { appliedLaneLocalIds: new Set(prov.keys()) })` | in-proc | none |
| 6 | **C1a.** If `parsed.errors` is non-empty, refuse and list every entry verbatim (includes AC6/AC7). | — | — |
| 7 | If `parsed.entries.length === 0`, **no-op** and go to step 11. | — | — |
| 8 | Partition: `skipped = entries ∩ prov` and `toAllocate = entries \ prov`. If `toAllocate` is non-empty: `currentMaxId = extractMaxBacklogId(backlogText)`, then `allocateTicketIds({ currentMaxId, batches: [{ lane, entries: toAllocate }] })`. | in-proc | none |
| 9 | **C1b.** If `unresolvedDependencies` is non-empty, refuse and list each one verbatim (DR-7 format). If `toAllocate` is non-empty and `backlogText === ""`, refuse with `docs/backlog.md not found on <base>`. | — | — |
| 10 | **C2 (a)** `git rev-parse --abbrev-ref HEAD` in repoRoot must equal `base`. **C3 (b)** `git status --porcelain -z -- docs/backlog.md <pendingRel>` in repoRoot must be empty. | primary | read |
| M1 | Print one `already applied, skipping` line per skipped entry. `newBacklog = allocated.length ? appendBacklogRows(backlogText, rows) : backlogText`. `newPending = markApplied(pendingText, [...allocatedIds, ...skipped.keys()])`. Write both with `atomicWriteFile` at `repoRoot/<rel>`. | primary | write (working tree) |
| M2 | `git commit -m <msg-base> -- docs/backlog.md <pendingRel>` in repoRoot (path-limited, `--only` semantics, no `git add`). If the commit fails, restore both files by writing back `backlogText`/`pendingText` byte-for-byte with `atomicWriteFile`, surface git's stderr, and throw. Nothing else is mutated. | primary | commit on `base` |
| M3 | If `allocated.length` is non-zero, print `agc feature finish — applied N pending ticket(s): E<a>, E<b>`. | — | stdout |
| 11 | `removeWorktreeNoForce` then `git branch -d`. Existing and unchanged. | primary | existing |

Why the working tree matches the blob at M1: C2 plus C3 guarantee that
primary's HEAD is `base` and that both paths are clean. The working-tree copy
of each file is therefore byte-identical to the `base` blob read in steps 3–4.
Writing `f(blob)` onto it is the same as applying `f` to the working tree, and
no second read is needed.

Why a `--shipped` re-run is idempotent: this covers, for example, a
`removeWorktreeNoForce` refusal after M2 landed. The `base` blob of the pending
file is now fully archived and every archived id is in `prov`. The result is
`errors = []` and `entries = []`, so step 7 is a no-op and the run goes
straight to the teardown in step 11. This relies on AC6 ruling R1: legitimately
archived blocks (their id is in `prov`) never produce an error.

## Step order — `agc feature finish --abandoned` (AC3, AC3(a) G4 ordering, AC3(b) G4 idempotency)

| # | step | runs in | reads / writes |
|---|---|---|---|
| 1 | Primary guard, parse, lane match | primary | existing |
| 2 | `pendingText = readBlob(repoRoot, "refs/heads/" + branch, pendingRel)`. If `null`, jump to step 9 (today's flow, via the split functions). | odb | read (never `fs` against `lanePath`) |
| 3 | `resolveBaseCommit(base)`. Evaluated only once step 2 found a file (DR-5). `backlogText = readBlob(repoRoot, base, BACKLOG_REL) ?? ""`. | odb | read |
| 4 | Same as shipped steps 5–9: provenance, parse, **C1a**, entries=0 no-op (jump to step 9), partition, allocate, **C1b**. | in-proc | none |
| 5 | **C4 (G4(a))** `moves = planAbandonEvidence(lanePath, ticketId)`. This is the existing unrelated-dirty-file refusal and destination-clash refusal, now hoisted in front of every mutation. | lane | read |
| 6 | If `toAllocate` is non-empty: **C2 (a)** and **C3 (b)** on repoRoot, exactly as in shipped. | primary | read |
| M1 | If `toAllocate` is non-empty: print the skip lines, write `newBacklog` to `repoRoot/docs/backlog.md`, then `git commit -m <msg-base> -- docs/backlog.md` in repoRoot. The pathspec is **backlog only**: the pending file is not on `base`, and naming it would fail with "pathspec did not match". On failure, restore `backlogText`, surface stderr, throw. | primary | commit on `base` |
| M2 | `newPending = markApplied(pendingText, [...allocatedIds, ...skipped.keys()])`. Write it to `lanePath/<pendingRel>`, then `git commit -m <msg-lane> -- <pendingRel>` in **lanePath** (the `git(lanePath, …)` convention). On failure: restore `pendingText` in the lane and throw. The message must say that the base commit (if M1 ran) landed, that re-running `finish --abandoned` is idempotent (G4(b)), and that the worktree was left in place. | lane | commit on lane branch |
| M3 | Print the applied summary (if any were allocated). | — | stdout |
| 9 | `applyAbandonEvidence(lanePath, ticketId, moves)`: the existing moves and AC23 commit, a second, separate commit on the branch (DR-4). In the no-pending path, `planAbandonEvidence` runs here immediately before it, so today's behaviour is unchanged. | lane | commit on lane branch |
| 10 | `removeWorktreeNoForce(hint)`, then print "kept branch". Existing. | primary | existing |

The G4(a) order the spec requires, "check-worktree-clean, THEN commit-on-base,
THEN commit-on-branch, THEN removeWorktreeNoForce", maps to steps 5, M1, M2+9
and 10 in that order.

How AC3(b) re-runs after a partial failure (M1 landed, M2 died):
- The branch blob still has the entries unapplied.
- `prov` contains all of them, so `toAllocate` is empty.
- M1 is skipped: 0 new ids, 0 rows, and C2/C3 are not evaluated.
- M2 archives them on the branch.
- One `already applied, skipping` line is printed per entry.

Printing the skip lines: when M1 is skipped, they are printed at the start of
M2 instead.

### Commit messages (sr may reword; the pathspecs are load-bearing)

- `<msg-base>`: `chore(backlog): allocate E<a>[, E<b>…] from lane <lane> (<shipped|abandoned>)`.
  When only archival happens on `--shipped`, use `chore(backlog): mark lane <lane> pending tickets applied`.
- `<msg-lane>`: `chore(lane): mark <lane> pending tickets applied (E<a>[, …])`.

## Skip-already-applied provenance match (G4(b))

`formatBacklogRow` emits `` (filed by lane `<lane>` as `<laneLocalId>` `` followed by `)` or `; source: …)`.
The whole desc cell then passes through `tableCell`, which collapses
whitespace and escapes `|`. `findAppliedProvenance(backlogText, lane)` works
like this:

1. Iterate the lines of `backlogText`. Keep only lines matching
   `/^[ \t]*\|[ \t]*(E\d+[A-Za-z]*)[ \t]*\|/`, the same row shape as
   `extractMaxBacklogId`. Capture group 1 is the row's id. Prose, fenced
   examples, and the execution-order tables (which have no `| E<n> |` leading
   cell) are ignored.
2. For each kept line, find every match of
   ``/\(filed by lane `([^`]*)` as `([^`]*)`[);]/g``, where the lane literal
   is compared after the same `tableCell` transform. When captured lane `===`
   the argument `lane`, record `laneLocalId → rowId`. The first occurrence
   wins. The closing backtick plus the `)`/`;` delimiter make the match exact:
   `e17` never matches `e179`, and `X-NEW-1` never matches `X-NEW-10`.
3. The needle is built by the same code path as `formatBacklogRow`: a private
   `provenancePrefix(lane, id)` that both functions call. A future change to
   the row format therefore cannot silently desynchronise the matcher.

A mixed partial skip is possible: a non-skipped entry whose `depends_on` names
a skipped entry's `laneLocalId`. In that case `allocateTicketIds` reports the
reference as unresolved and C1b refuses, visibly (DR-8). This state arises
only from a human hand-applying part of a lane's tickets, because the
command's own M1 always applies a lane's whole set in one commit.

Known residual, already filed as root `NEW-TICKETS.md` E179-NEW-1: a ticket
re-picked-up after `--abandoned` reuses its lane name, so a new finding that
reuses an old `laneLocalId` is skipped. It is skipped *visibly*, via the skip
line.

## AC6 / AC7 scanner design (post-AC9)

- **AC9 (T-E179-03)** runs first and leaves a backtick-only scanner.
  `~~~` lines become ordinary text.
- **AC7 (T-E179-04), ruling (b), final.** See *Data Structures*. Both
  sub-cases are implemented. For `unclosed-at-eof` (AC7 (i)) the error text is
  `fence opened at line <fenceStart+1> is never closed before end of file; a
  pending-ticket opener at line <line+1> inside it could not be parsed — block
  lost`. For `closes-enclosing-fence` (AC7 (ii)), naming both lines, the text is `a
  pending-ticket opener at line <line+1> sits inside the fence opened at line
  <fenceStart+1> and its own closing fence ends that outer fence instead — block
  lost; close the outer fence first`.
  Neither rule fires for a strictly-longer enclosing fence (the
  4-backtick documentation-example case), and neither changes `entries` or
  `markApplied`.
- **AC6 (T-E179-04), ruling R1, final.** With `opts` omitted, behaviour is
  unchanged (the `:342` pin). With `opts.appliedLaneLocalIds` provided, every archived block that
  passes `validateBlock` and whose `lane_local_id` is not in the set produces:
  `pending-ticket block #<n> (line <l>): sits under "## Applied" but
  docs/backlog.md records no row for lane \`<lane>\` as \`<id>\` — it will never
  be allocated; move it above "## Applied"`. An archived block that fails
  validation is not reported, because archive content is never parsed today.
  `entries` never contains archived blocks, and `markApplied` is untouched.
  Both of those match AC6's "report-only". The finish wiring always passes
  `opts`; `agc check` (AC5) uses the two-argument call (accepted residual: a
  misplaced block on a never-finished branch stays invisible to the orphan
  scan).

## Orphan-check data flow — `agc check` (AC5, T-E179-06)

`checkOrphanLanes(cwd)`. All git reads are repo-global. None of them depend on
which worktree `cwd` is in, which is what makes the output byte-identical
between primary and any lane.

1. `gitTry(cwd, ["rev-parse","--is-inside-work-tree"])`. If this is not a
   repo, return silently.
2. `const [lp, ta] = await Promise.all([loadLanePaths(), loadTicketAllocation()])`.
3. `live = listWorktrees(cwd).filter(w => w.branch?.startsWith("refs/heads/") && fs.existsSync(w.path)).map(strip "refs/heads/")`.
   A worktree entry whose directory is gone (removed by `rm -rf`, not yet
   pruned) is **not** live (DR-9). This is what makes spec proof (1)'s "worktree
   removed without finish" case flag.
4. `branches = git(cwd, ["for-each-ref","--format=%(refname)","refs/heads/"])`,
   with `refs/heads/` stripped. The output is sorted by refname, so it is
   deterministic. See DR-6: candidates are *all local branches*;
   `listWorktrees` supplies only the live set.
5. For each branch `b`:
   - Run `git ls-tree -r -z --name-only refs/heads/<b> -- .current/`.
   - Keep paths matching `^\.current\/([^/]+)\/<pendingFilename>$`, where
     `lp.isSafeLaneName(lane)` is true and `!lp.NON_LANE_DIRS.has(lane)`.
     Depth 2 only, so `.current/history/**` is never scanned (S1).
   - For each kept path: `git show refs/heads/<b>:<path>`, then
     `ta.parsePendingTickets(text, lane).entries.length > 0`. No `opts` is
     passed and no backlog cross-check is done (E124 AC7's contract).
   - OR the results into `hasUnappliedPendingTickets`.
6. `ta.detectOrphanLanes(candidates, live).orphans` produces one stderr line
   each, in the `check.orphan-warning` shape (wording per DR-12).
7. The whole function is wrapped in `try`/`catch`. On an unexpected error
   (dist missing, a git failure) it prints one
   `agc check — warning: orphan-lane scan skipped (<message>)` and returns. It
   never throws and never exits.

`runCheck` becomes `async`. It awaits `checkOrphanLanes(cwd)` directly after
`checkWorktreeEvidence(cwd)` and before the adapter loop, whose
`process.exit` calls stay where they are. The dispatch changes to
`runCheck(process.cwd()).catch((e) => { process.stderr.write(...); process.exit(1); })`.
That branch is unreachable for orphan-scan errors, which are caught inside
`checkOrphanLanes`.

## AC10 decision — exclude `pendingTickets` from the sidecar merge

**Decision: exclude it.** `mergeSidecar` publishes `src ++ dest`, a byte
concatenation. That is correct for JSONL, where each line is a record, and
wrong for `pending-tickets.md`:
- two concatenated markdown files can yield two `## Applied` sections;
- `lane_local_id`s can be duplicated, and `parsePendingTickets` skips the
  second block of a duplicate as an error;
- the `isBytePrefix` "already merged" resume heuristic is meaningless for a
  hand-edited markdown file.

Change (T-E179-02), in `planMoves`:

```ts
// Append-only JSONL logs merge by concatenation; any other optional lane file
// (pending-tickets.md) is required-shaped at the destination: identical bytes
// -> drop, different bytes -> refuse, never merge.
const isAppendLog = (e: LaneFileEntry): boolean => e.filename.endsWith(".jsonl");
const sidecarMerge = mergeSidecars && !entry.required && isAppendLog(entry) && destIsFile;
```

Resulting behaviour:

| direction | dest absent | dest identical | dest different |
|---|---|---|---|
| flat→lane | rename | drop | **refuse** ("refusing to clobber; nothing moved") |
| lane→flat | rename | drop | refuse (unchanged: `mergeSidecars` is already false) |

"Source absent" means skipped, as for the other optional entries (AC1:
`required: false`, so an ordinary finish never trips the missing-required
refusal). No other `tools/lane-migrate.ts` path needs a change:
- `known`, `isStaleAtomicTmp` and the flat-remnant checks all iterate
  `LANE_FILES` and pick the new entry up automatically;
- `enumerateLaneSidecarSources` is called with explicit JSONL keys only.

T-E179-12 covers all four cells of the table above with a markdown file,
matching and conflicting.

## Sequence Diagram

`finish --abandoned` with unapplied entries. This path has the most actors and
the non-atomic window.

```mermaid
sequenceDiagram
  participant U as agc (primary cwd)
  participant O as git object db
  participant P as primary checkout
  participant L as lane worktree
  U->>O: show refs/heads/<branch>:.current/<lane>/pending-tickets.md
  U->>O: show <base>:docs/backlog.md
  U->>U: findAppliedProvenance → parsePendingTickets(opts) → C1a errors?
  U->>U: partition skip/allocate → allocateTicketIds → C1b unresolved?
  U->>L: planAbandonEvidence (C4: unrelated dirty? clash?)
  U->>P: C2 rev-parse HEAD == base? C3 status -- backlog, pending clean?
  Note over U,P: every check above mutates nothing
  U->>P: write docs/backlog.md; commit -- docs/backlog.md (M1)
  Note over P,L: non-atomic window (G4): a death here is healed by re-run skip
  U->>L: write pending-tickets.md; commit -- .current/<lane>/pending-tickets.md (M2)
  U->>L: applyAbandonEvidence (existing moves + commit)
  U->>P: git worktree remove <lanePath> (no --force)
```

## Decision Records

| # | Context | Decision | Consequences |
|---|---|---|---|
| DR-1 | Where the `--shipped` reads come from: the working tree or `base` | `git show <base>:<rel>` through repoRoot's object db, for both files | The content refusal (C1) runs before C2/C3, as the spec's Error-refusal precondition requires. After C2+C3 pass, the working tree equals those blobs, so the M1 write is exact. |
| DR-2 | When the C2/C3 primary preconditions run | Only when a primary commit will happen: `--shipped` with at least 1 unapplied entry, or `--abandoned` with `toAllocate` non-empty | The AC2 "silent no-op, existing behaviour otherwise unchanged" clause holds. A lane with no findings can still finish from a primary on a non-base branch, as today. This does not generalise to the L-INIT-NEW-3/E185 class (spec (a)). |
| DR-3 | Rollback when M1/M2 fails | Restore the file(s) this run wrote to their pre-run bytes (the blob text), then throw | C3 guaranteed the paths were clean before, so the restore loses nothing. A failed commit never leaves primary dirty in a way that trips C3 on the re-run. `git checkout`/`reset` are never used. |
| DR-4 | `markApplied` commit on the branch: the same commit as the evidence move or a separate one | Separate. M2 is committed before `applyAbandonEvidence` | `abandonEvidence`'s AC23 "commit only if something staged" logic and its message stay exactly as they are. The branch history reads as two single-purpose commits. |
| DR-5 | `--base` on `--abandoned` (ignored today) | Validated with `resolveBaseCommit` only when the branch carries a pending file | Today's behaviour is unchanged for lanes with no findings. A bad `--base` now refuses only when it would be used. |
| DR-6 | AC5 wording, "every local branch from `git worktree list --porcelain`-derived branch names", cannot be read literally: an orphan by definition has no worktree entry | Candidates = `git for-each-ref refs/heads/`. `listWorktrees` supplies the live set (it is the helper whose shape the spec names) | This is the only reading under which any orphan can be found. It matches the fan-out manifest's "只掃活 branch" (local branches that still exist, not history). |
| DR-7 | Refusal text for C1b | One line per `UnresolvedDependency`: `<lane>/<laneLocalId> (provisional <id>): depends_on "<reference>" — <reason>` | The spec's "verbatim, not summarised" requirement is met. "provisional" stops a reader taking a never-committed id as allocated. |
| DR-8 | Partial skip where a dependent's dependency was skipped | No substitution of the matched row id. It surfaces as unresolved and refuses | §1 MVP. This arises only from a human hand-applying part of a lane. It is visible and fixable by editing the pending file's `depends_on` to the real id. |
| DR-9 | A prunable worktree entry (directory deleted, not pruned) | Not live (`fs.existsSync(w.path)`) | Spec proof (1)'s "removed without finish" case is flagged. The check is still repo-global, so output is identical from any checkout. |
| DR-10 | How to mark "never merge" in lane-migrate | A filename predicate (`.jsonl` means append log), local to `lane-migrate.ts`. No new `LaneFileEntry` field | AC1's literal entry shape `{key, filename, required}` is kept. A future non-JSONL optional file defaults to refuse, never concatenate (the safe direction). |
| DR-11 | Flat `.current/pending-tickets.md` now satisfies `handoff-parse.ts`'s "any flat LANE_FILES entry" auto-migrate trigger | Accepted, no change (the file is forbidden anyway) | It behaves like every other sidecar. A conflicting lane copy refuses under DR-10, and the read falls back per the existing path. |
| DR-12 | The `check.orphan-warning` copy says "run `agc feature finish --abandoned <ticket-id>`", but `finish` refuses without a live worktree ("no linked worktree found"), which is exactly an orphan's state | Wording (delegated to sr by the spec's Copy table): `agc check — warning: branch <branch> carries an unapplied pending-tickets file with no live worktree — findings may be stranded; re-attach it (\`git worktree add <dir> <branch>\`) and run \`agc feature finish --abandoned <ticket-id>\` to apply and retire it, or investigate why the worktree is gone` | The advice can actually be followed. After `worktree add`, the finish matcher resolves the lane from the branch name. |
| DR-13 | `--shipped` has no G4(a)-style lane-clean pre-check before M2 | None added. A later `removeWorktreeNoForce` refusal is healed by an idempotent re-run (shipped re-run analysis above) | The spec's "otherwise unchanged" for `--shipped` holds. This relies on AC6 ruling R1, under which legitimately archived blocks do not error. |

## Deferred Resources

_None. The spec's Dependencies / Prerequisites records zero external
references (Resource Audit Gate: zero hits)._

## sr task map

| task | pieces from this document |
|---|---|
| T-E179-02 | AC1 registry entry and field. AC10 `isAppendLog` in `planMoves`. `npm run build`. Put the AC10 choice ("excluded, refuse on conflict") in pending_notes for T-E179-12. REG1 going red is expected (qa, T-E179-10). |
| T-E179-03 | AC9: backtick-only fence regexes, removal of the info-backtick special case, single-string `depends_on`, removal of the post-loop overflow throw. `npm run build`. |
| T-E179-04 | `SwallowedOpener` / `scan.swallowed` plus both AC7 errors (`unclosed-at-eof`, `closes-enclosing-fence`; ruling (b)). `validateBlock` refactor. `ParsePendingTicketsOptions` (`appliedLaneLocalIds`) plus the AC6 error, reported only for archived well-formed blocks whose id is absent from the set (ruling R1). `findAppliedProvenance` plus the shared `provenancePrefix`. Error texts as in *AC6 / AC7 scanner design*. `npm run build`. |
| T-E179-05 | `appendBacklogRows`. `loadTicketAllocation`, `readBlob`, `planPendingApply`, `assertPrimaryWritable`. The `abandonEvidence` split. Both finish step orders exactly as tabled. Commit pathspecs. Skip and summary lines. DR-1…DR-5, DR-7, DR-8, DR-13. |
| T-E179-06 | `checkOrphanLanes`, async `runCheck`, dispatch change. DR-6, DR-9, DR-12. |
| T-E179-15 | AC8 prose only. Name `.current/<lane>/pending-tickets.md`, finish-time allocation, and the retirement of `NEW-TICKETS.md` for lane candidates. No `test/` edits. |

## Open Questions

None. Both escalations are resolved, and the human re-approved the revised
cut on 2026-09-25:

- **Q1 (AC6 distinguisher): resolved as R1.** `parsePendingTickets(text,
  lane, { appliedLaneLocalIds })` reports an archived well-formed block only
  when `docs/backlog.md` has no provenance row for it. This is now in the
  amended spec, AC6. R2 and R3 were rejected.
- **Q2 (AC7 equal-length swallowed opener): resolved as option (b).** Both
  `unclosed-at-eof` and `closes-enclosing-fence` are reported. This is now in
  the amended spec, AC7. Options (a) and (c) were rejected.
- The integrator accepted DR-12's orphan-warning wording. The accepted
  residual is that `agc check` uses the two-argument parse.
