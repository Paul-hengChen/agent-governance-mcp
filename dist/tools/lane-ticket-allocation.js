// Coded by @sr-engineer
// tools/lane-ticket-allocation.ts — collision-free backlog-id allocation for
// findings filed by lane worktrees (E124, e124-lane-ticket-allocation; spec
// specs/e124-lane-ticket-allocation.md AC1-AC9).
//
// The problem this closes: two lanes forked from the same base both read
// "max is E176" and both mint E177, and because each lane appends its own
// backlog row the collision is semantically invisible to a textual
// `git merge`. The remedy is structural, not procedural: a lane never picks a
// real id at all. It files a candidate under a lane-local token
// (`<LANE>-NEW-n`) in `.current/<lane>/pending-tickets.md`, and a single
// writer later allocates real ids in one sequential apply that observes the
// previous apply's result (AC5). Collision-freedom follows from that
// single-writer discipline, which this module assumes but does not enforce.
//
// PURE BY CONSTRUCTION (spec AC preamble): no `fs`, no `child_process`, no
// clock, no environment read. Every impure edge — reading
// `.current/<lane>/pending-tickets.md` (or `git show <branch>:<path>` for an
// orphaned branch), reading `docs/backlog.md`, enumerating worktrees and
// branches, writing results back — is an explicit argument or return value
// owned by the caller. Wiring any of this into `agc feature start/finish`,
// `agc check`, or an SOP is E124b, out of scope here. Nothing in this module
// changes today's `NEW-TICKETS.md` convention (AC1).
//
// FILE FORMAT (AC1). `pending-tickets.md` is ordinary markdown; only fenced
// blocks whose info string is exactly `pending-ticket` carry data, so
// free-form discussion prose around them is ignored:
//
//   ```pending-ticket
//   lane_local_id: L-STATE-NEW-3
//   title: Short one-line summary
//   priority: P2
//   depends_on: [E109, L-STATE-NEW-2]
//   source: found by code-reviewer, T-E124-01 round 1   # optional
//   body: |                                            # optional
//     Arbitrary free-form prose, any length.
//   ```
//
// A block never carries an `id` field — the real id is the allocator's to
// assign, never the lane's. Blocks under a `## Applied` heading are the
// archive `markApplied` maintains (AC8): kept verbatim, never returned by
// `parsePendingTickets`, so "has at least one unapplied entry" (AC7's input)
// is a checkable fact rather than "the file exists".
//
// Degrade-honestly (same posture as tools/lane-registry.ts): one malformed
// block is skipped and REPORTED, never allowed to take its siblings down,
// and an unresolvable dependency is surfaced, never dropped and never left
// as a dangling lane-local token inside a shipped backlog row.
import * as yaml from "js-yaml";
// ---------------------------------------------------------------------------
// Markdown structure scan (shared by parsePendingTickets and markApplied).
// ---------------------------------------------------------------------------
const PENDING_INFO = "pending-ticket";
// Backtick fences only (e179 AC9 removed tilde fences and the
// info-string-may-not-contain-a-backtick special case that served them).
const OPEN_FENCE_RE = /^ {0,3}(`{3,})(.*)$/;
const CLOSE_FENCE_RE = /^ {0,3}(`{3,})[ \t]*\r?$/;
// A line that would open a `pending-ticket` block: the same info-string rule
// the scanner applies (first whitespace token === "pending-ticket"). Used
// only to detect an opener swallowed by an enclosing non-pending fence
// (e179 AC7).
const PENDING_OPENER_RE = /^ {0,3}(`{3,})[ \t]*pending-ticket(?:[ \t]|\r?$)/;
// Only h1/h2 open or close a section; `## Applied` (case-sensitive, optional
// trailing whitespace) is the archive heading markApplied writes.
const SECTION_HEADING_RE = /^ {0,3}#{1,2}[ \t]/;
const APPLIED_HEADING_RE = /^ {0,3}##[ \t]+Applied[ \t]*\r?$/;
// An existing backlog id, including a sub-lettered split (E174a, E9A).
const BACKLOG_ID_RE = /^E\d+[A-Za-z]*$/;
/**
 * Line scanner that tracks fenced-code state so that (a) a heading or a
 * `pending-ticket` fence quoted inside some OTHER fenced block (e.g. a
 * ```` ```markdown ```` example of the format) is not mistaken for live
 * structure, and (b) a `pending-ticket` block's own content can safely
 * contain `## Applied` or a shorter fence. Closing-fence rule follows
 * CommonMark: a backtick run at least as long as the opener's.
 *
 * Swallowed openers (e179 AC7): a `pending-ticket` opener seen while a
 * NON-pending fence is open is recorded. When that fence closes, each one
 * whose run is >= the fence's run is reported as `closes-enclosing-fence`
 * (under CommonMark its closer necessarily ended the outer fence, so it can
 * never be legitimately nested); one with a strictly shorter run is legal
 * nesting (a documentation example) and is dropped silently. If the fence is
 * still open at EOF, every one is reported as `unclosed-at-eof`. Swallowed
 * openers never count toward `blocks[].ordinal`.
 */
function scanPendingFile(fileText) {
    const lines = fileText.split("\n");
    const blocks = [];
    const appliedSections = [];
    const swallowed = [];
    let fence = null;
    let inApplied = false;
    let ordinal = 0;
    const closeAppliedSection = (at) => {
        const open = appliedSections[appliedSections.length - 1];
        if (inApplied && open && open.end === -1)
            open.end = at;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (fence) {
            const close = line.match(CLOSE_FENCE_RE);
            if (close && close[1].length >= fence.len) {
                if (fence.pending) {
                    blocks.push({
                        ordinal,
                        start: fence.start,
                        end: i,
                        archived: inApplied,
                        payload: lines.slice(fence.start + 1, i).join("\n"),
                    });
                }
                else {
                    for (const s of fence.swallowed) {
                        if (s.runLen < fence.len)
                            continue;
                        swallowed.push({
                            fenceStart: fence.start,
                            line: s.line,
                            runLen: s.runLen,
                            fenceLen: fence.len,
                            reason: "closes-enclosing-fence",
                        });
                    }
                }
                fence = null;
                continue;
            }
            if (!fence.pending) {
                const inner = line.match(PENDING_OPENER_RE);
                if (inner)
                    fence.swallowed.push({ line: i, runLen: inner[1].length });
            }
            continue;
        }
        const open = line.match(OPEN_FENCE_RE);
        if (open) {
            const pending = open[2].trim().split(/\s+/)[0] === PENDING_INFO;
            if (pending)
                ordinal++;
            fence = { len: open[1].length, pending, start: i, swallowed: [] };
            continue;
        }
        if (SECTION_HEADING_RE.test(line)) {
            closeAppliedSection(i);
            inApplied = APPLIED_HEADING_RE.test(line);
            if (inApplied)
                appliedSections.push({ heading: i, end: -1 });
        }
    }
    if (fence && fence.pending) {
        // Unclosed at EOF: recorded with end = -1 so the parser can report it;
        // markApplied never moves an unclosed block.
        blocks.push({
            ordinal,
            start: fence.start,
            end: -1,
            archived: inApplied,
            payload: lines.slice(fence.start + 1).join("\n"),
        });
    }
    else if (fence) {
        for (const s of fence.swallowed) {
            swallowed.push({
                fenceStart: fence.start,
                line: s.line,
                runLen: s.runLen,
                fenceLen: fence.len,
                reason: "unclosed-at-eof",
            });
        }
    }
    closeAppliedSection(lines.length);
    return { lines, blocks, appliedSections, swallowed };
}
function swallowedError(s) {
    if (s.reason === "unclosed-at-eof") {
        return (`fence opened at line ${s.fenceStart + 1} is never closed before end of file; ` +
            `a pending-ticket opener at line ${s.line + 1} inside it could not be parsed — block lost`);
    }
    return (`a pending-ticket opener at line ${s.line + 1} sits inside the fence opened at line ` +
        `${s.fenceStart + 1} and its own closing fence ends that outer fence instead — block lost; ` +
        `close the outer fence first`);
}
// ---------------------------------------------------------------------------
// AC2 — parsePendingTickets
// ---------------------------------------------------------------------------
function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
}
/** `depends_on` accepts a YAML list of strings, a single string (one id), or
 *  absence/null. The literal `none` (the backlog table's own spelling for "no
 *  dependency") means empty. Returns null for any other shape so the caller
 *  can report the block as malformed. */
function normalizeDependsOn(v) {
    if (v === undefined || v === null)
        return [];
    let raw;
    if (typeof v === "string")
        raw = [v];
    else if (Array.isArray(v))
        raw = v;
    else
        return null;
    const out = [];
    for (const item of raw) {
        if (typeof item !== "string")
            return null;
        const ref = item.trim();
        if (ref.length === 0 || ref.toLowerCase() === "none")
            continue;
        out.push(ref);
    }
    return out;
}
/**
 * Validates one scanned block in isolation (the per-block rules of
 * `parsePendingTickets`, minus the file-level duplicate check). Shared by
 * live and archived blocks (e179 AC6) so "archived well-formed block" and
 * "live entry" can never diverge. `error` is the reason only; the caller
 * prefixes the block's ordinal/line.
 */
function validateBlock(block, lane) {
    if (block.end === -1)
        return { error: "unclosed fence (no closing ``` before end of file)" };
    let raw;
    try {
        // CORE_SCHEMA: no timestamp/binary coercion — every scalar this format
        // cares about stays a plain string/number/bool.
        raw = yaml.load(block.payload, { schema: yaml.CORE_SCHEMA });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        return { error: `YAML parse error: ${msg}` };
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return { error: "content is not a YAML mapping" };
    }
    const rec = raw;
    const missing = ["lane_local_id", "title", "priority"].filter((k) => !isNonEmptyString(rec[k]));
    if (missing.length > 0) {
        return { error: `missing, empty, or non-string required field(s): ${missing.join(", ")}` };
    }
    if (Object.prototype.hasOwnProperty.call(rec, "id")) {
        return { error: "carries an `id` field — real ids are assigned by the allocator, never by the lane" };
    }
    const laneLocalId = rec.lane_local_id.trim();
    if (BACKLOG_ID_RE.test(laneLocalId)) {
        return { error: `lane_local_id "${laneLocalId}" is shaped like a real backlog id (E<n>)` };
    }
    const dependsOn = normalizeDependsOn(rec.depends_on);
    if (dependsOn === null) {
        return { error: "depends_on must be a list of strings, a string, or absent" };
    }
    if (rec.source !== undefined && rec.source !== null && typeof rec.source !== "string") {
        return { error: "source must be a string when present" };
    }
    if (rec.body !== undefined && rec.body !== null && typeof rec.body !== "string") {
        return { error: "body must be a string when present" };
    }
    const entry = {
        laneLocalId,
        title: rec.title.trim(),
        priority: rec.priority.trim(),
        dependsOn,
        body: typeof rec.body === "string" ? rec.body : "",
        lane,
    };
    if (isNonEmptyString(rec.source))
        entry.source = rec.source.trim();
    return { entry };
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
export function parsePendingTickets(fileText, lane, opts) {
    const entries = [];
    const errors = [];
    const seen = new Set();
    const applied = opts?.appliedLaneLocalIds;
    const scan = scanPendingFile(fileText);
    for (const block of scan.blocks) {
        const where = `pending-ticket block #${block.ordinal} (line ${block.start + 1})`;
        if (block.archived) {
            if (applied === undefined)
                continue;
            const v = validateBlock(block, lane);
            if ("entry" in v && !applied.has(v.entry.laneLocalId)) {
                errors.push(`${where}: sits under "## Applied" but docs/backlog.md records no row for lane ` +
                    `\`${lane}\` as \`${v.entry.laneLocalId}\` — it will never be allocated; ` +
                    `move it above "## Applied"`);
            }
            continue;
        }
        const v = validateBlock(block, lane);
        if ("error" in v) {
            errors.push(`${where}: ${v.error} — block skipped`);
            continue;
        }
        if (seen.has(v.entry.laneLocalId)) {
            errors.push(`${where}: duplicate lane_local_id "${v.entry.laneLocalId}" (already used by an earlier block) — block skipped`);
            continue;
        }
        seen.add(v.entry.laneLocalId);
        entries.push(v.entry);
    }
    for (const s of scan.swallowed)
        errors.push(swallowedError(s));
    return { entries, errors };
}
// ---------------------------------------------------------------------------
// AC3/AC4/AC5 — allocateTicketIds
// ---------------------------------------------------------------------------
/** Collapses a free-form value to one table cell: whitespace (including
 *  newlines) runs become a single space and `|` is escaped, so a multi-line
 *  `body` can never break the row or inject an extra column. */
function tableCell(text) {
    return text.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}
/** The provenance parenthetical's opening, up to and including the
 *  laneLocalId's closing backtick. The ONE composer of that text:
 *  `formatBacklogRow` writes it and `findAppliedProvenance` matches it, so a
 *  change to the row format cannot silently desynchronise the two (e179). */
function provenancePrefix(lane, laneLocalId) {
    return `(filed by lane \`${lane}\` as \`${laneLocalId}\``;
}
function formatBacklogRow(t) {
    const provenance = provenancePrefix(t.lane, t.laneLocalId) +
        (t.source !== undefined ? `; source: ${t.source}` : "") +
        ")";
    const desc = [`**${t.title}**`, t.body, provenance]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" ");
    const deps = t.dependsOn.length > 0 ? t.dependsOn.join(", ") : "none";
    return `| ${tableCell(t.id)} | ${tableCell(desc)} | ${tableCell(t.priority)} | ${tableCell(deps)} | — | — |`;
}
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
export function allocateTicketIds(input) {
    const { currentMaxId, batches } = input;
    if (!Number.isSafeInteger(currentMaxId) || currentMaxId < 0) {
        throw new RangeError(`allocateTicketIds: currentMaxId must be a non-negative safe integer, got ${String(currentMaxId)}`);
    }
    // Pass 1 — number every entry.
    const numbered = [];
    let next = currentMaxId;
    batches.forEach((batch, b) => {
        for (const entry of batch.entries) {
            next += 1;
            numbered.push({ batch: b, entry, lane: batch.lane, id: `E${next}` });
        }
    });
    // laneLocalId -> every numbered index carrying it (duplicates kept so an
    // ambiguous reference is reported rather than silently picking one).
    const byLocalId = new Map();
    numbered.forEach((n, idx) => {
        const list = byLocalId.get(n.entry.laneLocalId) ?? [];
        list.push(idx);
        byLocalId.set(n.entry.laneLocalId, list);
    });
    // Pass 2 — resolve dependencies and format rows.
    const allocated = [];
    const unresolvedDependencies = [];
    numbered.forEach((n, idx) => {
        const resolved = [];
        const unresolved = (reference, reason) => {
            unresolvedDependencies.push({
                id: n.id,
                laneLocalId: n.entry.laneLocalId,
                lane: n.lane,
                reference,
                reason,
            });
        };
        for (const rawRef of n.entry.dependsOn) {
            const ref = rawRef.trim();
            if (BACKLOG_ID_RE.test(ref)) {
                if (!resolved.includes(ref))
                    resolved.push(ref);
                continue;
            }
            const candidates = byLocalId.get(ref) ?? [];
            const sameBatch = candidates.filter((c) => numbered[c].batch === n.batch);
            const pool = sameBatch.length > 0 ? sameBatch : candidates;
            if (pool.length === 0) {
                unresolved(rawRef, "not an E<n> id and no entry with that lane_local_id is part of this allocation");
            }
            else if (pool.length > 1) {
                const where = sameBatch.length > 0 ? `lane "${n.lane}"` : "this allocation";
                unresolved(rawRef, `ambiguous: ${pool.length} entries in ${where} share that lane_local_id`);
            }
            else if (pool[0] === idx) {
                unresolved(rawRef, "self-reference: a ticket cannot depend on itself");
            }
            else {
                const target = numbered[pool[0]].id;
                if (!resolved.includes(target))
                    resolved.push(target);
            }
        }
        const ticket = {
            id: n.id,
            laneLocalId: n.entry.laneLocalId,
            lane: n.lane,
            title: n.entry.title,
            priority: n.entry.priority,
            dependsOn: resolved,
            body: n.entry.body,
            ...(n.entry.source !== undefined && { source: n.entry.source }),
        };
        allocated.push({ ...ticket, backlogRow: formatBacklogRow(ticket) });
    });
    return { allocated, unresolvedDependencies, maxAllocatedId: next };
}
// ---------------------------------------------------------------------------
// AC6 — extractMaxBacklogId
// ---------------------------------------------------------------------------
// Leading cell only: `| E<digits><optional letters> |` at the start of a
// row. Anything after the first cell (desc, depends_on, prose) never counts.
const BACKLOG_ROW_ID_RE = /^[ \t]*\|[ \t]*E(\d+)[A-Za-z]*[ \t]*\|/;
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
export function extractMaxBacklogId(backlogText) {
    let max = 0;
    for (const line of backlogText.split("\n")) {
        const m = line.match(BACKLOG_ROW_ID_RE);
        if (!m)
            continue;
        const n = Number(m[1]);
        if (n > max)
            max = n;
    }
    return max;
}
// ---------------------------------------------------------------------------
// e179 — findAppliedProvenance / appendBacklogRows (finish-time wiring)
// ---------------------------------------------------------------------------
// Same row shape as BACKLOG_ROW_ID_RE, capturing the whole leading-cell id.
const BACKLOG_ROW_FULL_ID_RE = /^[ \t]*\|[ \t]*(E\d+[A-Za-z]*)[ \t]*\|/;
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
export function findAppliedProvenance(backlogText, lane) {
    const out = new Map();
    // "(filed by lane `<lane>` as `" — the prefix with an empty id, minus the
    // id's closing backtick.
    const head = provenancePrefix(tableCell(lane), "").slice(0, -1);
    for (const line of backlogText.split("\n")) {
        const row = line.match(BACKLOG_ROW_FULL_ID_RE);
        if (!row)
            continue;
        let from = 0;
        for (;;) {
            const at = line.indexOf(head, from);
            if (at === -1)
                break;
            const idStart = at + head.length;
            const idEnd = line.indexOf("`", idStart);
            if (idEnd === -1)
                break;
            from = idStart;
            const delim = line[idEnd + 1];
            if (delim !== ")" && delim !== ";")
                continue;
            const laneLocalId = line.slice(idStart, idEnd).replace(/\\\|/g, "|");
            if (laneLocalId.length > 0 && !out.has(laneLocalId))
                out.set(laneLocalId, row[1]);
        }
    }
    return out;
}
const TICKET_TABLE_HEADER_RE = /^\|\s*id\s*\|\s*desc\s*\|\s*priority\s*\|/;
/**
 * Inserts `rows` (each an `AllocatedTicket.backlogRow`) directly after the
 * last contiguous `|`-prefixed line of the ticket table — the first table
 * whose header row matches `| id | desc | priority | ...`. Preserves the
 * input's trailing newline (or its absence). Never guesses a location.
 * Pure.
 *
 * @throws Error when no such header exists.
 */
export function appendBacklogRows(backlogText, rows) {
    if (rows.length === 0)
        return backlogText;
    const hadTrailingNewline = backlogText.endsWith("\n");
    const lines = (hadTrailingNewline ? backlogText.slice(0, -1) : backlogText).split("\n");
    const header = lines.findIndex((l) => TICKET_TABLE_HEADER_RE.test(l));
    if (header === -1) {
        throw new Error("docs/backlog.md: ticket table header `| id | desc | priority | ...` not found");
    }
    let last = header;
    while (last + 1 < lines.length && lines[last + 1].startsWith("|"))
        last++;
    lines.splice(last + 1, 0, ...rows);
    return lines.join("\n") + (hadTrailingNewline ? "\n" : "");
}
// ---------------------------------------------------------------------------
// AC7 — detectOrphanLanes
// ---------------------------------------------------------------------------
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
export function detectOrphanLanes(branches, liveWorktreeBranches) {
    const live = new Set(liveWorktreeBranches);
    const orphans = [];
    const seen = new Set();
    for (const { branch, hasUnappliedPendingTickets } of branches) {
        if (hasUnappliedPendingTickets !== true || live.has(branch) || seen.has(branch))
            continue;
        seen.add(branch);
        orphans.push(branch);
    }
    return { orphans };
}
// ---------------------------------------------------------------------------
// AC8 — markApplied
// ---------------------------------------------------------------------------
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
export function markApplied(fileText, appliedLaneLocalIds) {
    const wanted = new Set(appliedLaneLocalIds.map((id) => id.trim()));
    if (wanted.size === 0)
        return fileText;
    const { lines, blocks, appliedSections } = scanPendingFile(fileText);
    // Identify movable blocks by re-using parsePendingTickets' own validation
    // on each block in isolation, so "movable" can never disagree with "would
    // have been returned as an entry". Duplicate ids: only the first block
    // (the one the parser returns) moves.
    const toMove = [];
    const taken = new Set();
    for (const block of blocks) {
        if (block.archived || block.end === -1)
            continue;
        const blockText = lines.slice(block.start, block.end + 1).join("\n");
        const parsed = parsePendingTickets(blockText, "");
        const entry = parsed.entries[0];
        if (!entry || !wanted.has(entry.laneLocalId) || taken.has(entry.laneLocalId))
            continue;
        taken.add(entry.laneLocalId);
        toMove.push(block);
    }
    if (toMove.length === 0)
        return fileText;
    const isBlank = (s) => s !== undefined && s.trim().length === 0;
    // Line indices to drop from their original position.
    const drop = new Set();
    const moved = [];
    for (const block of toMove) {
        for (let i = block.start; i <= block.end; i++)
            drop.add(i);
        if (isBlank(lines[block.end + 1]) && block.end + 1 < lines.length - 1)
            drop.add(block.end + 1);
        moved.push(lines.slice(block.start, block.end + 1));
    }
    const archivedLines = [];
    for (const blockLines of moved) {
        archivedLines.push("", ...blockLines);
    }
    const out = [];
    const target = appliedSections[0];
    if (target) {
        // Insert at the end of the first Applied section, before any trailing
        // blank lines that separate it from the next heading / EOF.
        let insertAt = target.end;
        while (insertAt - 1 > target.heading && isBlank(lines[insertAt - 1]))
            insertAt--;
        for (let i = 0; i < lines.length; i++) {
            if (i === insertAt)
                out.push(...archivedLines);
            if (!drop.has(i))
                out.push(lines[i]);
        }
        if (insertAt >= lines.length)
            out.push(...archivedLines);
        return out.join("\n");
    }
    for (let i = 0; i < lines.length; i++) {
        if (!drop.has(i))
            out.push(lines[i]);
    }
    // Trim trailing blank lines, then append the new section and restore a
    // single trailing newline if the input ended with one.
    const hadTrailingNewline = fileText.endsWith("\n");
    while (out.length > 0 && isBlank(out[out.length - 1]))
        out.pop();
    if (out.length > 0)
        out.push("");
    out.push("## Applied", ...archivedLines);
    return out.join("\n") + (hadTrailingNewline ? "\n" : "");
}
//# sourceMappingURL=lane-ticket-allocation.js.map