# e179-ticket-allocation-wiring

## Problem Statement

E124 shipped a pure, unit-tested module (`tools/lane-ticket-allocation.ts`:
`parsePendingTickets`, `allocateTicketIds`, `extractMaxBacklogId`,
`detectOrphanLanes`, `markApplied`) but wired it into nothing. Wave 5's two
Definition-of-Done lines — "ticket ids are structurally collision-proof under
parallel lanes" and "an orphaned lane's findings are detectable" — are both
still false, because no caller in `bin/agc-init.mjs` invokes any of these
five functions. A lane today still has nowhere sanctioned to file a new
finding except the legacy, tracked, append-only `NEW-TICKETS.md` at the repo
root, which does not solve the cross-lane collision problem E124's own module
exists to close. This ticket (E124b, Wave 5.1) is the wiring: it does not
change the module's logic beyond deleting speculative surface E124's own
reviewer already flagged, and it does not touch `docs/backlog.md`,
`docs/v4.0.0-*.md`, or `docs/lane-protocol.md` themselves (integrator-owned,
post-merge).

## User Stories

- As a lane's `agc feature finish --shipped`, I want the lane's pending
  tickets (if any) allocated real ids and appended to `docs/backlog.md` in
  the same run that removes the worktree, so that a filed finding is never
  lost and never requires a human to remember a separate step.
- As a lane's `agc feature finish --abandoned`, I want the exact same
  allocation to happen even though the lane's branch never merges to `base`,
  so that abandoning a ticket does not also discard what it discovered
  (Decision F, already settled 2026-09-16).
- As the person running `agc check` from the primary checkout, I want to be
  warned about a branch that still carries an unapplied pending-tickets file
  but has no live worktree, so that an abandoned-and-forgotten lane's
  findings are surfaced instead of silently rotting on a dead branch.
- As a future lane session filing a new finding, I want the SOP to tell me to
  write it to `.current/<lane>/pending-tickets.md` instead of the root
  `NEW-TICKETS.md`, so that my finding gets a collision-proof id instead of
  racing every other lane's `NEW-N` counter.

## Acceptance Criteria

**AC1 — `pending-tickets.md` is a registered, optional `LANE_FILES` entry.**
Given `tools/lane-paths.ts`'s `LANE_FILES` registry, when this ticket lands,
then it carries a new entry `{ key: "pendingTickets", filename:
"pending-tickets.md", required: false }`, `LanePaths` gains a matching
`pendingTicketsPath` field, and `LANE_PATH_FIELD` maps the new key to it.
`required: false` is load-bearing: a lane that never files a finding has no
`pending-tickets.md` at all, and marking it `required: true` would make
`migrateLaneToFlatLocked`'s existing "required entry missing" refusal fire on
every ordinary `agc feature finish` — the exact "lane→flat rollback refuses"
failure the backlog row cites (Wave 5 finding L-STATE-NEW-1's class). This AC
MUST land before the only code path that WRITES a `pending-tickets.md` —
`markApplied`, called from `agc feature finish`'s AC2/AC3 wiring (AC5's
orphan check and AC6's scanner change are both read-only, so they carry no
ordering hazard of their own) — enforced by task ordering (`T-E179-02`
before `T-E179-05`), not by a runtime check.
  proof: `node --test test/lane-paths.test.mjs` (new case asserting the
  registry entry, its optionality, and that `resolveLanePaths`/
  `resolveFlatLanePaths` both expose `pendingTicketsPath`).

**AC2 — `agc feature finish --shipped` applies pending tickets and commits
on primary's `--base`.** Given a lane whose committed
`.current/<lane>/pending-tickets.md` holds at least one well-formed,
unapplied entry, when `agc feature finish <id> --shipped [--base <branch>]`
runs (after its existing AC16 merge guard passes), then, before the worktree
is removed: it freshly reads `docs/backlog.md` and `pending-tickets.md` as
they stand on `--base` (default `main`) in the PRIMARY checkout — never a
stale in-memory copy — derives `currentMaxId` via `extractMaxBacklogId`,
parses the pending file via `parsePendingTickets`, allocates via
`allocateTicketIds`, appends each `AllocatedTicket.backlogRow` to
`docs/backlog.md`'s ticket table, rewrites `pending-tickets.md` via
`markApplied` with the allocated tickets' `laneLocalId`s, and commits both
files in ONE commit on `--base` in the primary checkout — all of this BEFORE
`removeWorktreeNoForce` runs, so a refusal at any step leaves the worktree
and branch exactly as `agc feature finish` already leaves them today on any
other precondition failure (nothing removed, error surfaced verbatim). A
lane with no `pending-tickets.md`, or one with zero unapplied entries, is a
silent no-op for this step — the existing finish behavior is otherwise
unchanged.

**Primary-checkout preconditions (coordinator amendment, pre-review)** — the
commit above lands in the PRIMARY checkout, which is a working tree with a
life of its own (unrelated staged/unstaged edits are the norm, not the
exception), so before touching anything:
  - **(a) refuse if primary's checked-out HEAD is not `--base`.** `git
    rev-parse --abbrev-ref HEAD` in the primary checkout must equal `--base`
    (default `main`); any mismatch refuses with nothing mutated and a message
    naming both the checked-out branch and `--base`. This is a NEW, narrowly-
    scoped check for this write path only — it does not generalize or extend
    any existing broader "primary must be on X" check elsewhere in
    `agc-init.mjs` (the known L-INIT-NEW-3 class the coordinator flagged);
    it exists solely so this command never composes a backlog row against a
    `docs/backlog.md` that isn't actually `--base`'s.
  - **(b) refuse if primary has uncommitted changes to `docs/backlog.md` or
    the lane's `.current/<lane>/pending-tickets.md`.** `git status
    --porcelain -- docs/backlog.md .current/<lane>/pending-tickets.md` in
    the primary checkout must be empty before this step runs; a non-empty
    result refuses with nothing mutated (a human is already mid-edit on one
    of the two files this command is about to write).
  - **(c) the commit is path-limited to exactly those two files** — `git
    commit -- docs/backlog.md .current/<lane>/pending-tickets.md` (or the
    `execFileSync` equivalent), never a bare `git commit -a` / `git commit`
    with a prior `git add -A`. Any OTHER staged or unstaged change already
    sitting in primary is left exactly as it was — staged stays staged,
    unstaged stays unstaged — never swept into this commit.
  proof: `test/agc-feature-lifecycle.test.mjs` new cases —
  (1) seed a lane branch with a committed `pending-tickets.md` holding 2
  entries, run `feature finish --shipped`, assert `docs/backlog.md` gained
  exactly 2 new rows with ids `>` the pre-run `extractMaxBacklogId`, the
  commit lands on `--base` (not on the lane branch, which no longer exists
  after removal), and re-parsing the lane's last pending-tickets.md blob
  (via `git show`) shows both entries now archived under `## Applied`;
  (2) primary checked out on a branch other than `--base` refuses with
  nothing mutated; (3) primary with an uncommitted edit to `docs/backlog.md`
  (or to the lane's `pending-tickets.md`) refuses with nothing mutated;
  (4) primary with an UNRELATED staged file present before the run — assert
  that file is STILL staged and uncommitted after `finish` completes (proves
  (c): the apply commit never swept it up).

**Error-refusal precondition (coordinator amendment, pre-review) — applies to
both AC2 and AC3.** Given the same allocation pipeline (`parsePendingTickets`
→ `allocateTicketIds`), when `parsePendingTickets` returns a non-empty
`errors` array (whether from a pre-existing malformed-block case, or from the
new AC6 "block after `## Applied`" / AC7 "opener swallowed inside an unclosed
fence" reports), OR `allocateTicketIds` returns a non-empty
`unresolvedDependencies` array, then the whole finish-time apply step refuses
BEFORE any mutation — no `docs/backlog.md` append, no `markApplied` rewrite,
no commit on either `--base` or the lane branch — and surfaces every entry in
whichever array is non-empty verbatim (not summarized/counted) as the error
message, exactly as every other precondition failure in this command leaves
the worktree and branch untouched. This refusal is independent of, and
checked before, the AC2(a)/(b)/(c) primary-checkout preconditions above have
any chance to matter — a malformed pending file refuses on its own content,
never on primary's state.
  proof: `test/agc-feature-lifecycle.test.mjs` — one case per class: (1) a
  `pending-tickets.md` with a malformed block (`parsePendingTickets` errors
  non-empty) refuses, nothing committed, error text includes the block's
  ordinal/line; (2) a `pending-tickets.md` whose `depends_on` cannot be
  resolved (`allocateTicketIds.unresolvedDependencies` non-empty) refuses,
  nothing committed, error text includes the offending reference and reason;
  (3) same two cases repeated under `--abandoned` (reading via `git show`)
  to confirm the refusal fires identically on that path.

**AC3 — `agc feature finish --abandoned` applies pending tickets identically,
reading the file from the branch (not the base).** Given the same
precondition as AC2 but the lane is finished with `--abandoned` (no merge
guard, per AC20's existing behavior), when the command runs, then it reads
`pending-tickets.md`'s content via `git show <branch>:.current/<lane>/
pending-tickets.md` — never `fs.readFileSync` against a working-tree path —
because an abandoned branch's commits are, by construction, not on `--base`.
Allocation, backlog append, and the commit-on-`--base` all behave exactly as
AC2 (E124's `allocateTicketIds`/`markApplied` take no disposition parameter
— AC9 of the E124 spec — so shipped and abandoned apply identically). The
`markApplied` result is committed back onto the LANE BRANCH itself (the only
place that file lives pre-finish), in the LANE'S OWN worktree (`lanePath`, via
the same `git(lanePath, [...])` calling convention `abandonEvidence` already
uses) — in the same step `abandonEvidence` already commits the evidence
move — either as the same commit or a second one on that branch,
sr-engineer's call — so a human inspecting the kept abandoned branch
afterward sees its own pending tickets already marked applied, not
perpetually "still pending." The existing `abandonEvidence` precondition
(refuse on unrelated dirty files) and `removeWorktreeNoForce` ordering are
unchanged and still run after this step. **AC2's primary-checkout
preconditions (a)/(b)/(c) apply unchanged to the separate backlog-append
commit on `--base`** (which always lands in the PRIMARY checkout, shipped or
abandoned alike, per the ticket's own "the allocation commit lands on
primary's `--base`" framing) — they say nothing about, and impose no new
precondition on, the lane-branch commit above, which runs in the lane's own
worktree and is governed by `abandonEvidence`'s existing precondition
instead.

**(a) Precondition ordering (G4, coordinator amendment) — the two commits
below are separate and NOT atomic**: the backlog-append commit lands on
primary's `--base`, and the `markApplied` commit lands on the lane branch in
the lane's own worktree; a process death (or a git failure) between them is
possible. To bound the failure window to "git itself failing" — the one
class this command cannot make atomic — `abandonEvidence`'s existing
lane-worktree precondition (refuse on unrelated dirty files in `lanePath`)
MUST be evaluated BEFORE the primary-side backlog-append commit runs, not
after. Concretely: check-worktree-clean, THEN commit-on-base, THEN
commit-on-branch, THEN `removeWorktreeNoForce`. If the lane worktree is dirty
in a way `abandonEvidence` would refuse, nothing happens at all — not even
the primary commit — exactly like every other AC2/AC3 refusal leaves nothing
mutated.

**(b) Re-run idempotency (G4, coordinator amendment) — no double allocation
on a partial failure.** Because the two commits are non-atomic ((a) above),
a primary commit can land while the branch-side `markApplied` commit then
fails (git error, disk full, process kill) — the branch still shows those
entries as unapplied, `agc check` (AC5) correctly flags it as an orphan (if
its worktree is also gone) or simply as still-pending, and without this
rule a re-run of `finish --abandoned` would allocate a SECOND set of ids for
the SAME findings. Fix: before allocating, freshly read `docs/backlog.md`
and, for every unapplied entry, check whether a row already exists whose
provenance parenthetical matches this entry's exactly — `formatBacklogRow`
already embeds `(filed by lane \`<lane>\` as \`<laneLocalId>\`` — i.e. match
on the literal `(lane, laneLocalId)` pair. Any entry that already has a
matching row is SKIPPED from `allocateTicketIds`'s input entirely (no new id
minted, no new row appended) but is STILL passed to `markApplied` with its
existing (pre-mined, this-run-unknown) archival — so a re-run of a
partially-failed apply allocates 0 new ids, appends 0 new rows, and finishes
ONLY the branch-side archive that failed to land last time. Print one line
per skipped entry naming its `lane`/`laneLocalId` and "already applied,
skipping" so a re-run's idempotent no-op is visible, not silent. **Applies
identically to `--shipped`** (AC2) for symmetry — harmless there, since a
normal `--shipped` run never has a pre-existing matching row, but it costs
nothing to check and closes the same class of bug if a `--shipped` run is
ever re-attempted after a partial failure of its own single commit.
  proof: `test/agc-feature-lifecycle.test.mjs` new cases — (1) a dirty lane
  worktree (unrelated file) with `--abandoned` refuses, and `docs/backlog.md`
  on `--base` is asserted UNTOUCHED (proves (a): the primary commit never
  ran); (2) simulate a partial failure — commit the allocated row(s) onto
  `--base` directly (bypassing the command, as a partial-failure stand-in)
  while the branch's `pending-tickets.md` is left unapplied, then re-run
  `finish --abandoned`: assert `docs/backlog.md` gains 0 new rows,
  `allocateTicketIds` is invoked with 0 entries (or the skip is asserted via
  the printed "already applied, skipping" line), and the branch's
  `pending-tickets.md` (read via `git show`) now shows the entries archived.
  proof: `test/agc-feature-lifecycle.test.mjs` new case — seed a lane branch
  with a committed `pending-tickets.md`, run `feature finish --abandoned`,
  assert `docs/backlog.md` on `--base` gained the new row(s) and the kept
  branch's own `pending-tickets.md` (read via `git show <branch>:...` after
  the run) shows the entries archived; reuses AC2's precondition cases
  (2)-(4) against the primary-side backlog-append commit only.

**AC4 — sequential applies are structurally collision-proof.** Given two
lanes, each with an unapplied pending ticket, when their `agc feature finish`
runs are issued one after the other (never concurrently — single-writer
ordering is the caller's/human's job per the E124 spec, unchanged by this
ticket), then the second run's `currentMaxId` is derived by freshly
re-reading `docs/backlog.md` AFTER the first run's commit landed — never
reused from an earlier read or from the first call's `maxAllocatedId` held
in a long-lived process — so the two runs allocate disjoint id ranges even
though `agc feature finish` is a fresh process invocation each time.
  proof: `test/agc-feature-lifecycle.test.mjs` new case — run `feature
  finish --shipped` for lane A then lane B (two separate process
  invocations, matching real usage), assert the union of ids each allocated
  is disjoint and both are `>` the pre-run max.

**AC5 — `agc check` surfaces orphaned lanes, advisory only, from ANY
checkout.** Given `agc check` run from EITHER the primary checkout OR a
linked git worktree, when it executes, then it additionally lists every
local branch from `git worktree list --porcelain`-derived branch names
(reusing the existing `listWorktrees` helper's shape) that `detectOrphanLanes`
flags — i.e. a branch with `git show <branch>:.current/<lane>/
pending-tickets.md` parsing to at least one unapplied entry (per E124's own
precondition for `hasUnappliedPendingTickets`) but no live worktree checked
out on it — and prints one `agc check — warning: ...` line per orphan naming
the branch, in the same style and same non-blocking class as the existing
`checkWorktreeEvidence`/`checkResearchBinaries` advisories (`runCheck`'s
comment "advisory; never affects exit code"). Zero orphans is silent (no new
output). **Decided (was an open question pre-review, coordinator amendment):
this check runs unconditionally, regardless of checkout — unlike
`checkWorktreeEvidence`, which gates on `isLinkedWorktree` because it is
about protecting a LANE'S OWN untracked evidence dirs (a concern specific to
being inside that lane's own worktree), the orphan scan's subject is the
repo-global branch list from `git worktree list --porcelain`, which resolves
identically no matter which worktree of the repo you run it from.** So the
output is byte-identical whether `agc check` runs from primary or from any
lane's worktree — there is no primary-only restriction to add, and none is
added. A branch whose worktree is live is, by `detectOrphanLanes`'s own
definition, never an orphan even if its pending file still has unapplied
entries — orphan-ness is "no live worktree," never "has unapplied entries"
alone. This check does NOT scan `.current/history/` (S1, integrator-decided,
deferred to E125). **Own-lane only (human ruling 2026-09-25, E179-NEW-2 option
(a), integrator-recommended, mailbox seq 6):** `<lane>` above is the branch's
OWN lane, `resolveCurrentLane(branch)`. Only `.current/<that lane>/pending-tickets.md`
is read. A branch that resolves to no lane is skipped. Another lane's pending
file that a fork carries along never flags the branch, and the warning never
names another lane's id. `detectOrphanLanes`'s docstring is updated to match.
  proof: `test/agc-feature-lifecycle.test.mjs` new cases — (1) create a
  branch with a committed unapplied `pending-tickets.md` and no worktree (or
  one whose worktree was removed without `finish`), run `agc check` from
  primary, assert stderr contains the orphan warning naming that branch and
  the process still exits 0; (2) run the identical `agc check` from a
  DIFFERENT lane's live linked worktree, assert byte-identical orphan output
  (same branch named, same exit 0); (3) a branch WITH a live worktree but
  still-unapplied pending entries is asserted NOT flagged as an orphan; (4) a
  branch with no worktree, forked while ANOTHER lane's unapplied
  `pending-tickets.md` sits on base, is asserted NOT flagged, and no warning
  names that other lane.

**AC6 — a pending-ticket-shaped block placed AFTER `## Applied` with NO
matching backlog provenance is reported; a legitimately archived block is
not.** (Ruling R1, architect Q1, `specs/e179-architecture.md` — adopted
as-is; see rationale below.) `parsePendingTickets` gains an optional third
parameter: `parsePendingTickets(text, lane, opts?: { appliedLaneLocalIds?:
Set<string> })`. **With `opts` omitted, behavior is UNCHANGED from today** —
this is what E124's own `test/lane-ticket-allocation.test.mjs:342` (`errors
.length === 0` on `markApplied` output) already pins, and what `AC9`'s "every
test exercising retained behaviour continues to pass unmodified" requires.
**With `opts.appliedLaneLocalIds` provided**, a well-formed `pending-ticket`
block physically after the file's (first) `## Applied` heading is reported
in `errors` — naming the block's ordinal and line — ONLY if its
`lane_local_id` is NOT in that set; it is treated as archived exactly as
before (still absent from `entries`) either way. The set is derived by
`findAppliedProvenance` (a fresh `docs/backlog.md` scan for a `(lane,
lane_local_id)` provenance row) — the SAME scan the G4(b) re-run-idempotency
skip already needs, so this costs no new read. This is how "legitimately
archived by `markApplied`" (its id has a real backlog row — R1's
distinguishing fact) is told apart from "a writer inserted a new finding
below `## Applied` and it will never be allocated" (no row exists), without
`markApplied` gaining a marker on the blocks it moves (which would break
E124 AC8's byte-verbatim guarantee — ruled out, see Alternatives). An
archived block that FAILS validation (malformed YAML, missing fields, etc.)
is never reported under either mode — archived content is not parsed today
and this AC does not change that. `agc feature finish`'s AC2/AC3 wiring
ALWAYS passes `opts.appliedLaneLocalIds`; `agc check`'s orphan scan (AC5)
does NOT (it uses the two-argument call, matching E124 AC7's original
contract, and needs no backlog cross-check for its purpose).
**Alternatives considered and rejected**: R2 (have `markApplied` stamp a
marker on archived blocks) breaks E124 AC8's verbatim-move guarantee: R3
(keep AC6 literal, exempt the finish Error-refusal from AC6 lines) leaves
(i) a real, cited test regression, (ii) a `--shipped` re-run made
permanently unrefusable after a partial worktree-removal failure, and (iii)
the reviewer's actual `review_T-E124-01.md` repro (every block already
archived, so a bare "block after `## Applied`" rule reports on ALL of them,
which is noise, not signal) unsolved.
  proof: `node --test test/lane-ticket-allocation.test.mjs` new cases —
  (1) `opts` omitted: a `pending-ticket` block placed after `## Applied`
  behaves exactly as before (`errors.length === 0`, matching the existing
  `:342` pin — no regression); (2) `opts: { appliedLaneLocalIds: new Set() }`
  (nothing recorded as applied yet): the same placement is absent from
  `entries` AND present, by ordinal, in `errors`; (3) `opts: {
  appliedLaneLocalIds: new Set(["<its lane_local_id>"]) }`: the identical
  placement produces `errors.length === 0` (a legitimately archived block is
  silent).

**AC7 — a pending-ticket opener swallowed inside an enclosing fence it
cannot legitimately nest inside is reported.** (Ruling (b), architect Q2,
`specs/e179-architecture.md` — adopted as-is; see rationale below.) Two
sub-cases, both reported by `scanPendingFile`/`parsePendingTickets`, never
by `markApplied`, never changing `entries`:
  - **(i) `unclosed-at-eof`** (the AC7 case as originally written): an
    ordinary (non-`pending-ticket`) fenced block is never closed before EOF,
    and a line that would otherwise open a ` ```pending-ticket ` block
    appears inside that unclosed span. Reports one `errors` entry naming the
    outer fence's opening line and stating a `pending-ticket` opener at the
    swallowed line could not be parsed — block lost.
  - **(ii) `closes-enclosing-fence`** (added by ruling (b) — the AC7 case AS
    ORIGINALLY WRITTEN misses this, the reviewer's OWN reproduced case in
    `review_T-E124-01.md`: a stray `` ``` `` in the prose, immediately
    followed by a COMPLETE ` ```pending-ticket … ``` ` block. The inner
    block's own closing fence closes the stray outer one — nothing is open
    at EOF, so `unclosed-at-eof` alone stays silent and the result is
    `{ entries: [], errors: [] }`, i.e. the finding vanishes with zero
    trace). The added rule: when a swallowed `pending-ticket` opener's own
    backtick run length is `>=` the enclosing (non-`pending-ticket`) fence's
    run length, report it — under CommonMark, such an opener's closer
    necessarily terminates the OUTER fence instead of its own, so it can
    NEVER be legitimately nested; there is no correct-markdown case this
    misclassifies. Reports one `errors` entry naming both the swallowed
    opener's line and the enclosing fence's opening line, stating the inner
    block's own closer ends the outer fence instead — block lost; close the
    outer fence first.
  A pending-ticket opener nested inside a fence with a STRICTLY LONGER
  backtick run (e.g. a 4-backtick ` ````markdown ` fence containing a
  correctly-closed 3-backtick ` ```pending-ticket ` example) is exactly
  CommonMark's legitimate nesting case and stays silent under both rules —
  neither (i) nor (ii) fires. **Alternatives considered and rejected**: (a)
  keep AC7 literal (`unclosed-at-eof` only) and file the equal/longer-run
  case as a residual — rejected because it leaves the reviewer's own repro
  unsolved, the exact motivating case for this AC; (c) the reviewer's
  broader rule (report ANY swallowed opener, regardless of fence-length
  relationship) — rejected because it also flags the correctly-nested
  documentation-example case above, which is valid markdown and must stay
  silent.
  proof: `node --test test/lane-ticket-allocation.test.mjs` new cases —
  (1) `unclosed-at-eof`: an outer ` ``` ` opened and never closed, containing
  a ` ```pending-ticket ` line, assert `entries` is empty for it AND
  `errors` names the outer fence's opening line; (2) the reviewer's repro,
  `closes-enclosing-fence`: a stray ` ``` ` followed by a COMPLETE
  ` ```pending-ticket ... ``` ` block, assert `entries` is empty for it AND
  `errors` names both the opener's line and the enclosing fence's line;
  (3) a correctly nested 4-backtick ` ````markdown ` fence containing a
  complete 3-backtick ` ```pending-ticket ... ``` ` example: assert `errors`
  is empty (stays silent) and, if the inner content is itself well-formed
  and NOT actually inside a real unclosed/misnesting situation, it is
  treated purely as inert documentation content (not returned in `entries`
  either — it is prose, per the existing fence-depth design, not a live
  block).

**AC8 — SOP prose retires `NEW-TICKETS.md` for lane ticket candidates and
names finish-time allocation as the sanctioned numbering step.**
`content/coord-03-core-fallback.md`'s *Backlog Intake Loop* section and
`content/skill-release-engineer.md` are updated (prose only, no mechanism
change to either file's existing gates/steps) to state: (a) a lane's new
findings are filed to `.current/<lane>/pending-tickets.md` (E124's format),
not the root `NEW-TICKETS.md`; (b) real backlog ids are assigned ONLY at
`agc feature finish` time (AC2/AC3 above), never by a lane itself; (c) the
root `NEW-TICKETS.md` convention is retired for this purpose going forward —
the file itself is NOT deleted and NOT edited by this ticket (integrator-
owned, per `docs/lane-protocol.md` §4's own note that it "still" points here
until E179 lands). This is the ticket's one prose-only AC; it does not touch
`docs/lane-protocol.md` or `.claude/commands/integrator.md` (explicitly
forbidden — integrator amends those post-merge). **§2 boundary (coordinator
amendment)**: sr-engineer edits `content/coord-03-core-fallback.md` /
`content/skill-release-engineer.md` ONLY — it does NOT touch anything under
`test/`, even though this edit is expected to turn `test/context-budget.test.mjs`
and/or `test/fixtures/compose-golden/**` red. That is qa-engineer's job (AC11,
`T-E179-17`), per the repo's uniform precedent for a content-prose ticket
(`T-E96-02`, `T-E109-02`, `T-E142-05`, `T-E164-02`, `T-E174A-03`): sr-engineer
never re-baselines the golden fixtures it invalidates; qa-engineer does, via
`node scripts/capture-constitution-golden.mjs`, diff-verifying the
regeneration is minimal and moving only the floor(s) this edit actually
pushes, to the exact measured value.
  proof: manual review — `grep -n "pending-tickets.md" content/coord-03-core-fallback.md content/skill-release-engineer.md` each return ≥1 hit, and `grep -c "NEW-TICKETS" content/coord-03-core-fallback.md content/skill-release-engineer.md` is unchanged from pre-ticket (no new references added) or explicitly marks it retired; `git diff --stat` for this task's commit shows no path under `test/`.

**AC9 — the ~20-25 speculative lines E124's own reviewer flagged are
deleted.** Given `review_reports/review_T-E124-01.md`'s Quality section
(lines 34-37), when this ticket lands, then `tools/lane-ticket-allocation.ts`
no longer supports: (a) tilde (`~~~`) code fences — only backtick fences are
recognized by `OPEN_FENCE_RE`/`CLOSE_FENCE_RE` (and the accompanying
backtick-info-string-cannot-contain-a-backtick special case, which existed
only to serve the dual-fence-character design); (b) a comma-separated string
form for `depends_on` in `normalizeDependsOn` — only a YAML list, a single
bare string (one id), or absence/`null`/`"none"` remain accepted; (c) the
post-loop `Number.isSafeInteger(next)` overflow throw in `allocateTicketIds`
— unreachable once `currentMaxId` is validated as a safe integer and a
single call's batch sizes are bounded by realistic lane counts. Every
existing AC1-AC9 test in `test/lane-ticket-allocation.test.mjs` that exercised
ONLY the deleted surface is removed with it; every test exercising retained
behavior continues to pass unmodified.
  proof: `node --test test/lane-ticket-allocation.test.mjs` full pass, plus
  `grep -n "~{3,}\|comma-separated\|isSafeInteger(next)" tools/lane-ticket-allocation.ts` returns no hits (or only hits inside a doc comment describing what was removed and why, never live code).

**AC10 — no regression to `tools/lane-migrate.ts`'s flat↔lane round trip.**
Given the new optional `pendingTickets` `LANE_FILES` entry, when
`migrateFlatToLane`/`migrateLaneToFlat` run on a workspace whose
`.current/<lane>/pending-tickets.md` exists (or doesn't), then both runners
handle it exactly like the other three optional sidecars (`telemetry`,
`metrics`, `usage`) purely by iterating `LANE_FILES` — no new code path is
needed in `tools/lane-migrate.ts` itself UNLESS sr-engineer's audit finds a
sidecar-merge-specific reason `pending-tickets.md` needs different handling
(e.g. it is committed markdown, not an append-only JSONL log, so the AC15
"merge flat ++ lane" behavior — designed for JSONL — would be WRONG for it:
concatenating two markdown files is not a valid merge). If sr-engineer's
audit confirms this, `pendingTickets` MUST be excluded from the sidecar-merge
branch (treated as a required-shaped "refuse on conflicting content, never
merge" entry instead) — record whichever way in the implementation and cover
it with a test either way.
  proof: `node --test test/lane-migrate.test.mjs` (new case covering
  flat→lane and lane→flat with a `pending-tickets.md` present at both ends
  with matching AND with conflicting content, asserting no silent data loss
  in either direction).

**AC11 — full suite green on the committed tree; context budget intact.**
Given every AC above lands and is committed (lane protocol §3: qa's full
suite runs after commit, on a clean working tree), when `npm test` runs,
then it is 100% green with no unexplained reds, and
`test/context-budget.test.mjs` passes against the `test/fixtures/compose-golden/**`
golden fixtures qa-engineer re-baselined (`T-E179-17`) to match AC8's prose
changes — a minimal regeneration, moving only the floor(s) AC8 actually
pushed, never a wholesale re-capture.
  proof: `npm test` (full suite, run after `git add` + commit per
  `docs/lane-protocol.md` §3) and `node --test test/context-budget.test.mjs`
  (`T-E179-18`).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| check.orphan-warning | `agc check — warning: branch <branch> carries an unapplied pending-tickets file with no live worktree — findings may be stranded; run \`agc feature finish --abandoned <ticket-id>\` to apply and retire it, or investigate why the worktree is gone` | authored-here — matches the existing `agc check — warning: ...` house style (`checkWorktreeEvidence`); exact wording is sr-engineer's to finalize within that style, this is the intent/shape |
| finish.applied-summary | `agc feature finish — applied N pending ticket(s): E<id1>, E<id2>, ...` | authored-here — matches the existing `agc feature finish — ...` stdout line style; printed once per successful application, before the worktree-removal lines |
| finish.applied-none | (no output — silent no-op per AC2/AC3) | authored-here — matches existing silent-no-op precedent (e.g. `checkResearchBinaries` on a clean tree) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (backend CLI + governance-prose only) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Scanning `.current/history/<YYYY-MM>/<lane>/` for orphan detection (S1) —
  that path does not exist until E125 lands; folded into E125 as an AC there.
- Any change to `docs/backlog.md`, `docs/v4.0.0-*.md`, `docs/lane-protocol.md`,
  or `.claude/commands/integrator.md` (integrator-owned, post-merge).
- Deleting the root `NEW-TICKETS.md` file itself (S2) — SOP prose retires the
  *convention*; the tracked file's disposition is the integrator's call.
- E125's backlog-writeback-into-release-SOP-7a integration.
- Any change to `tools/handoff-*.ts`, `tools/registry.ts`, `schema/**`,
  `gates/**`, `prompts/**`, `lib/**`, or any other `content/**` fragment
  (forbidden files, per the fan-out manifest).
- Concurrent-write protection for two `agc feature finish` runs issued at the
  same instant — the E124 module (and this wiring) assume single-writer,
  sequential-apply ordering, exactly as `specs/e124-lane-ticket-allocation.md`
  already scopes it; a true lock across primary invocations is not this
  ticket's job.
- **Assumption (G4 re-run idempotency, AC3(b))**: matching a pending entry to
  an already-applied backlog row by its `(lane, laneLocalId)` provenance
  parenthetical assumes that pair is unique across the whole of
  `docs/backlog.md`'s history. This holds because a lane's name is derived
  from its ticket id (`tools/lane-paths.ts`'s `resolveCurrentLane`/
  `resolveLaneName`), and a ticket id is never reused once assigned — so no
  two lanes that ever existed can share a `lane` value, and `laneLocalId` is
  only unique WITHIN one lane's own pending file (enforced by
  `parsePendingTickets`'s existing duplicate check) — the pair together is
  therefore globally unique by construction, not by a new invariant this
  ticket introduces.

## Dependencies / Prerequisites

- E73 ✓, E124 ✓, E174 ✓ — all already on this lane's base (e4a47c0).
- Base: `e4a47c0`; branch `feat/e179-ticket-allocation-wiring`; worktree
  `<lanes-root>/e179`; single serial lane (crosses L-INIT +
  L-STATE + L-CONTENT per `specs/fanout-wave5.1.md` — split would only create
  more wiring tickets between the pieces, so it stays one lane).
- Files owned (from the fan-out manifest, restated here for the record):
  `bin/agc-init.mjs`, `tools/lane-ticket-allocation.ts`, `tools/lane-paths.ts`,
  `tools/lane-migrate.ts` (only if AC10's audit needs it), `content/coord-03-
  core-fallback.md`, `content/skill-release-engineer.md`,
  `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`,
  `dist/**`, this ticket's `tasks.md` rows, `specs/e179-*.md`, its
  `qa_reports/`/`review_reports/` evidence, `.current/e179/`; qa-owned tests:
  `test/lane-ticket-allocation.test.mjs`, `test/agc-feature-lifecycle.test.mjs`,
  `test/lane-paths.test.mjs`, `test/lane-migrate.test.mjs`, new E179 test
  files.
- Forbidden (per the manifest): `docs/backlog.md`, `docs/v4.0.0-*.md`,
  `docs/lane-protocol.md`, `.claude/commands/integrator.md`, root
  `NEW-TICKETS.md` (append-only if touched at all, never commit),
  `tools/handoff-*.ts`, `tools/registry.ts`, `schema/**`, `gates/**`,
  `prompts/**`, `lib/**`, other `content/**` fragments.
- No `design/e179-*.md` exists — non-visual feature, Visual Structural
  Assertions section omitted per the Spec Schema's own conditional rule.
- No external references (URLs, Figma, tickets) found in this ticket's own
  requirement documents beyond internal repo docs already read as inputs
  (`docs/backlog.md`, `docs/lane-protocol.md`, `specs/fanout-wave5.1.md`,
  `docs/v4.0.0-execution-plan.md`) — Resource Audit Gate: zero hits, field
  omitted.
- Scope decision: single-feature (`active_feature =
  e179-ticket-allocation-wiring`) — recorded explicitly per the fan-out
  manifest's instruction, though the Scope Decision Gate itself is not
  triggered (no `design/e179-*.md` exists).
