/** One unapplied ticket candidate parsed out of a lane's
 *  `pending-tickets.md` (AC2). `lane` comes from the caller's argument to
 *  `parsePendingTickets`, never from the file. `body` is `""` when the block
 *  omits it; `dependsOn` is `[]` when the block omits it. */
export interface PendingTicketEntry {
    laneLocalId: string;
    title: string;
    priority: string;
    dependsOn: string[];
    source?: string;
    body: string;
    lane: string;
}
/** Optional third argument to `parsePendingTickets` (e179 AC6, ruling R1). */
export interface ParsePendingTicketsOptions {
    /** laneLocalIds that docs/backlog.md already records for THIS lane (from
     *  `findAppliedProvenance`). When provided, every well-formed ARCHIVED
     *  block (under `## Applied`) whose `lane_local_id` is NOT in the set is
     *  reported in `errors` — it will never be allocated. When omitted,
     *  archived blocks are never inspected (the E124 behaviour). */
    appliedLaneLocalIds?: ReadonlySet<string>;
}
export interface ParsePendingTicketsResult {
    entries: PendingTicketEntry[];
    /** Human-readable, one per skipped block, each naming the block's
     *  1-based ordinal among `pending-ticket` blocks and its opening line. */
    errors: string[];
}
/** One ticket after allocation (AC3). `dependsOn` holds only real
 *  `E<n>`-shaped ids — every lane-local reference has either been rewritten
 *  to the id allocated in the same call or moved to
 *  `AllocationResult.unresolvedDependencies`. `backlogRow` is a single-line
 *  row for `docs/backlog.md`'s six-column ticket table
 *  (`| id | desc | priority | depends_on | est. files | design-link |`). */
export interface AllocatedTicket {
    id: string;
    laneLocalId: string;
    lane: string;
    title: string;
    priority: string;
    dependsOn: string[];
    source?: string;
    body: string;
    backlogRow: string;
}
/** A `depends_on` reference that could not be turned into a real id (AC4):
 *  neither `E<n>`-shaped nor resolvable to exactly one entry in the same
 *  allocation call. `id`/`laneLocalId`/`lane` identify the DEPENDENT ticket;
 *  `reference` is the offending token verbatim; `reason` says why. */
export interface UnresolvedDependency {
    id: string;
    laneLocalId: string;
    lane: string;
    reference: string;
    reason: string;
}
export interface AllocationResult {
    allocated: AllocatedTicket[];
    unresolvedDependencies: UnresolvedDependency[];
    /** Highest numeric id allocated by this call, or the input `currentMaxId`
     *  when nothing was allocated — the value the NEXT sequential apply's
     *  `currentMaxId` must be re-derived to (AC5). */
    maxAllocatedId: number;
}
export interface AllocateTicketIdsInput {
    currentMaxId: number;
    batches: {
        lane: string;
        entries: PendingTicketEntry[];
    }[];
}
/**
 * Extracts every well-formed, unapplied `pending-ticket` block from a lane's
 * `pending-tickets.md` text (AC1/AC2). Prose, other fenced blocks, and
 * blocks archived under `## Applied` are ignored. A block is skipped and
 * reported in `errors` — its siblings still parse — when it is unclosed,
 * is not a YAML mapping, lacks a non-empty string `lane_local_id`, `title`,
 * or `priority`, carries an `id` field (a lane never assigns real ids),
 * uses an `E<n>`-shaped `lane_local_id` (indistinguishable from a real id
 * in `depends_on`), has a malformed `depends_on`/`source`/`body`, or repeats
 * a `lane_local_id` already taken by an earlier block in the same file.
 *
 * Also reported, never changing `entries` (e179):
 *   - AC7: a `pending-ticket` opener swallowed by an enclosing non-pending
 *     fence that is unclosed at EOF, or whose own closer ends that fence;
 *   - AC6 (only when `opts.appliedLaneLocalIds` is given): a well-formed
 *     archived block whose `lane_local_id` has no provenance row in the
 *     backlog — a finding written below `## Applied` that would never be
 *     allocated. An archived block that fails validation is never reported.
 * Never throws.
 */
export declare function parsePendingTickets(fileText: string, lane: string, opts?: ParsePendingTicketsOptions): ParsePendingTicketsResult;
/**
 * Assigns sequential ids `E<currentMaxId+1>`, `E<currentMaxId+2>`, … to every
 * entry, batches in array order and entries within a batch in array order
 * (AC3) — deterministic; any cross-lane ordering policy is the caller's. The
 * ticket's `lane` is its batch's `lane`.
 *
 * Dependencies (AC4) are resolved after every id in the call is known, so a
 * forward reference resolves too. Per reference: an `E<n>`-shaped id
 * (sub-letters allowed) passes through unchanged; a lane-local token is
 * rewritten to the allocated id of the entry carrying that `laneLocalId` —
 * looked up in the dependent's own batch first, then across all other
 * batches — provided exactly one match exists at the first level that has
 * any. Zero matches, an ambiguous match, or a self-reference is reported in
 * `unresolvedDependencies` and left out of the ticket's `dependsOn` and its
 * `backlogRow`. Resolved ids are de-duplicated, first occurrence wins.
 *
 * Collision-freedom (AC5) holds under the single-writer, sequential-apply
 * discipline: a second call whose `currentMaxId` is re-derived from the
 * backlog after the first call's rows land (equivalently, the first call's
 * `maxAllocatedId`) starts strictly above every id the first call issued.
 * Takes no disposition parameter — shipped and abandoned lanes apply
 * identically (AC9).
 *
 * @throws RangeError when `currentMaxId` is not a non-negative safe integer
 *   (a caller bug — an allocator that guesses a base would reintroduce the
 *   very collision this module exists to prevent).
 */
export declare function allocateTicketIds(input: AllocateTicketIdsInput): AllocationResult;
/**
 * Highest BASE number across every ticket-table row whose leading cell is
 * an `E<n>` id (AC6). A sub-lettered split counts by its base (`E174a` ->
 * 174, `E9A` -> 9) — ignoring it would undercount the true max, and an
 * undercount is exactly the collision this module exists to prevent. An id
 * mentioned in any later cell or in prose is never counted. Returns 0 when
 * no row matches. Deliberately does NOT skip fenced code: counting an extra
 * `| E<n> |` line can only overcount, which wastes an id; skipping could
 * undercount, which collides — overcounting is the safe direction.
 */
export declare function extractMaxBacklogId(backlogText: string): number;
/**
 * laneLocalId -> backlog row id (e.g. "E190") for every ticket-table row
 * whose desc cell carries `formatBacklogRow`'s provenance parenthetical for
 * `lane` (e179 AC3(b) re-run idempotency, AC6 ruling R1). Only lines whose
 * leading cell is an `E<n>` id are scanned, so prose, fenced examples and
 * tables without an id column never match. The match is exact on both
 * values: the lane is compared as `formatBacklogRow` + the row's cell
 * transform would have written it, and the laneLocalId must be followed by
 * its closing backtick and then `)` or `;` — `e17` never matches `e179`, and
 * `X-NEW-1` never matches `X-NEW-10`. An escaped `\|` inside a captured
 * laneLocalId is unescaped. First occurrence wins. Pure.
 */
export declare function findAppliedProvenance(backlogText: string, lane: string): Map<string, string>;
/**
 * Inserts `rows` (each an `AllocatedTicket.backlogRow`) directly after the
 * last contiguous `|`-prefixed line of the ticket table — the first table
 * whose header row matches `| id | desc | priority | ...`. Preserves the
 * input's trailing newline (or its absence). Never guesses a location.
 * Pure.
 *
 * @throws Error when no such header exists.
 */
export declare function appendBacklogRows(backlogText: string, rows: string[]): string;
/**
 * Branches that still carry at least one unapplied pending ticket but no
 * longer have a live worktree (AC7) — an abandoned lane's findings that
 * would otherwise be silently lost. Plain-data set logic: compares BRANCH
 * names against BRANCH names by exact string equality, never against lane
 * names, and never shells out. The caller normalizes both sides the same
 * way (e.g. strips `refs/heads/` from `git worktree list --porcelain`'s
 * `branch` lines) before calling.
 *
 * `hasUnappliedPendingTickets` must be computed by the caller as
 * `parsePendingTickets(text, lane).entries.length > 0` over the COMMITTED
 * `.current/<lane>/pending-tickets.md` of the branch's OWN lane only (e179
 * AC5, E179-NEW-2 option (a): the lane the branch resolves to, e.g.
 * `feat/e179-x` -> `e179`; a branch resolving to no lane is not a
 * candidate). Another lane's file the branch happens to carry — forked from
 * base between that lane's merge and its finish — is never consulted. And
 * NOT "the file exists": `markApplied` leaves the file in place with its
 * entries archived, so existence alone would report an already-applied lane
 * as an orphan forever.
 *
 * Returns the matching branches in input order, de-duplicated; `[]` on
 * empty input.
 */
export declare function detectOrphanLanes(branches: {
    branch: string;
    hasUnappliedPendingTickets: boolean;
}[], liveWorktreeBranches: string[]): {
    orphans: string[];
};
/**
 * Returns `pending-tickets.md` text with every unapplied, well-formed block
 * whose `lane_local_id` is in `appliedLaneLocalIds` moved VERBATIM (fences
 * and payload byte-for-byte) to the end of the file's first `## Applied`
 * section, which is appended at end of file when absent (AC8). Records are
 * archived, never deleted. Re-parsing the result with `parsePendingTickets`
 * no longer returns the moved entries; every other entry, all prose, and
 * every block `parsePendingTickets` would skip as malformed stay exactly
 * where they were. One blank line directly following a moved block is
 * taken with it so no gap of doubled blank lines is left behind.
 *
 * Ids in `appliedLaneLocalIds` that match no unapplied block are ignored
 * (idempotent: re-running with the same ids is a no-op). When nothing
 * matches, the input is returned unchanged. Takes no disposition parameter
 * (AC9).
 */
export declare function markApplied(fileText: string, appliedLaneLocalIds: string[]): string;
//# sourceMappingURL=lane-ticket-allocation.d.ts.map