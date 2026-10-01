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
/** Optional third argument to `parsePendingTickets`. (E179) */
export interface ParsePendingTicketsOptions {
    /** laneLocalIds that docs/backlog.md already records for THIS lane (from
     *  `findAppliedProvenance`). When provided, every well-formed ARCHIVED
     *  block (under `## Applied`) whose `lane_local_id` is NOT in the set is
     *  reported in `errors` — it will never be allocated. When omitted,
     *  archived blocks are never inspected. (E179) */
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
 * `pending-tickets.md`; prose, other fences and `## Applied` blocks are
 * ignored. A bad block (unclosed, not a mapping, a required field missing, an
 * `id` field, an `E<n>`-shaped or duplicate `lane_local_id`, a malformed
 * optional field) is skipped and reported in `errors`. Swallowed openers and,
 * with `opts.appliedLaneLocalIds`, archived blocks with no backlog provenance
 * row are reported too. Never throws. (E179)
 */
export declare function parsePendingTickets(fileText: string, lane: string, opts?: ParsePendingTicketsOptions): ParsePendingTicketsResult;
/**
 * Assigns sequential ids `E<currentMaxId+1>`, ... in batch, then entry, order
 * (AC3); a ticket's `lane` is its batch's. Lane-local `depends_on` tokens are
 * rewritten once every id is known; a missing, ambiguous or self reference
 * lands in `unresolvedDependencies` instead. Collision-free (AC5) only under
 * single-writer sequential apply.
 * Why: specs/e260b-rationale.md (tools/lane-ticket-allocation.ts)
 * @throws RangeError when `currentMaxId` is not a non-negative safe integer.
 */
export declare function allocateTicketIds(input: AllocateTicketIdsInput): AllocationResult;
/**
 * Highest BASE number across ticket-table rows whose leading cell is an
 * `E<n>` id (`E174a` -> 174); 0 when none. Fenced code is NOT skipped: an
 * extra match can only overcount (wastes an id), while skipping could
 * undercount (collides), so overcounting is the safe direction.
 */
export declare function extractMaxBacklogId(backlogText: string): number;
/**
 * laneLocalId -> backlog row id (e.g. "E190") for every `E<n>`-led ticket row
 * whose desc cell carries `formatBacklogRow`'s provenance for `lane`, so a
 * re-run finish is idempotent. Exact on both values: the id must be followed
 * by its closing backtick, then `)` or `;` (`X-NEW-1` never matches
 * `X-NEW-10`); an escaped `\|` is unescaped; first occurrence wins. Pure.
 * (E179)
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
 * Branches with at least one unapplied pending ticket but no live worktree:
 * an abandoned lane's findings. Exact branch-name set logic, no shell-out.
 * The caller normalizes both sides (e.g. strips `refs/heads/`) and computes
 * `hasUnappliedPendingTickets` from `parsePendingTickets` over the branch's
 * OWN lane's committed file, never from mere file existence. Returns matches
 * in input order, de-duplicated. (E179)
 */
export declare function detectOrphanLanes(branches: {
    branch: string;
    hasUnappliedPendingTickets: boolean;
}[], liveWorktreeBranches: string[]): {
    orphans: string[];
};
/**
 * Moves every unapplied, well-formed block whose `lane_local_id` is in
 * `appliedLaneLocalIds` VERBATIM to the end of the first `## Applied`
 * section, appended when absent (AC8): archived, never deleted. Everything
 * else, malformed blocks included, stays put; one trailing blank line moves
 * with its block. Unmatched ids are ignored, so a re-run is a no-op.
 */
export declare function markApplied(fileText: string, appliedLaneLocalIds: string[]): string;
//# sourceMappingURL=lane-ticket-allocation.d.ts.map