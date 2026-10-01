// Coded by @sr-engineer
// Collision-free backlog ids for lane findings (E124): a lane files candidates
// as `<LANE>-NEW-n` in `.current/<lane>/pending-tickets.md` (only
// `pending-ticket` fenced blocks carry data; `## Applied` holds the archive),
// and one sequential writer allocates real ids later. Pure: every fs/git edge
// is the caller's. A malformed block is skipped and reported, never fatal.
// Why: specs/e260b-rationale.md (tools/lane-ticket-allocation.ts)
import * as yaml from "js-yaml";
// ---------------------------------------------------------------------------
// Markdown structure scan (shared by parsePendingTickets and markApplied).
// ---------------------------------------------------------------------------
const PENDING_INFO = "pending-ticket";
// Backtick fences only (no tilde fences, so no special case for an info
// string that may not contain a backtick). (E179)
const OPEN_FENCE_RE = /^ {0,3}(`{3,})(.*)$/;
const CLOSE_FENCE_RE = /^ {0,3}(`{3,})[ \t]*\r?$/;
// A line that would open a `pending-ticket` block: the same info-string rule
// the scanner applies (first whitespace token === "pending-ticket"). Used
// only to detect an opener swallowed by an enclosing non-pending fence.
// (E179)
const PENDING_OPENER_RE = /^ {0,3}(`{3,})[ \t]*pending-ticket(?:[ \t]|\r?$)/;
// Only h1/h2 open or close a section; `## Applied` (case-sensitive, optional
// trailing whitespace) is the archive heading markApplied writes.
const SECTION_HEADING_RE = /^ {0,3}#{1,2}[ \t]/;
const APPLIED_HEADING_RE = /^ {0,3}##[ \t]+Applied[ \t]*\r?$/;
// An existing backlog id, including a sub-lettered split (e.g. E174a, E9A).
const BACKLOG_ID_RE = /^E\d+[A-Za-z]*$/;
/**
 * Fence-aware line scanner (CommonMark closing rule): a heading or fence
 * quoted inside another fenced block is not live structure, and a pending
 * block may contain `## Applied` or a shorter fence. A pending opener
 * swallowed by a non-pending fence is reported as `closes-enclosing-fence`
 * (run >= the fence's) or `unclosed-at-eof`; a shorter run is legal nesting.
 * Swallowed openers never count toward `blocks[].ordinal`.
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
 * live and archived blocks so "archived well-formed block" and "live entry"
 * can never diverge. `error` is the reason only; the caller prefixes the
 * block's ordinal/line. (E179)
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
 * `pending-tickets.md`; prose, other fences and `## Applied` blocks are
 * ignored. A bad block (unclosed, not a mapping, a required field missing, an
 * `id` field, an `E<n>`-shaped or duplicate `lane_local_id`, a malformed
 * optional field) is skipped and reported in `errors`. Swallowed openers and,
 * with `opts.appliedLaneLocalIds`, archived blocks with no backlog provenance
 * row are reported too. Never throws. (E179)
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
 *  change to the row format cannot silently desynchronise the two. (E179) */
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
 * Assigns sequential ids `E<currentMaxId+1>`, ... in batch, then entry, order
 * (AC3); a ticket's `lane` is its batch's. Lane-local `depends_on` tokens are
 * rewritten once every id is known; a missing, ambiguous or self reference
 * lands in `unresolvedDependencies` instead. Collision-free (AC5) only under
 * single-writer sequential apply.
 * Why: specs/e260b-rationale.md (tools/lane-ticket-allocation.ts)
 * @throws RangeError when `currentMaxId` is not a non-negative safe integer.
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
 * Highest BASE number across ticket-table rows whose leading cell is an
 * `E<n>` id (`E174a` -> 174); 0 when none. Fenced code is NOT skipped: an
 * extra match can only overcount (wastes an id), while skipping could
 * undercount (collides), so overcounting is the safe direction.
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
// findAppliedProvenance / appendBacklogRows (finish-time wiring, E179)
// ---------------------------------------------------------------------------
// Same row shape as BACKLOG_ROW_ID_RE, capturing the whole leading-cell id.
const BACKLOG_ROW_FULL_ID_RE = /^[ \t]*\|[ \t]*(E\d+[A-Za-z]*)[ \t]*\|/;
/**
 * laneLocalId -> backlog row id (e.g. "E190") for every `E<n>`-led ticket row
 * whose desc cell carries `formatBacklogRow`'s provenance for `lane`, so a
 * re-run finish is idempotent. Exact on both values: the id must be followed
 * by its closing backtick, then `)` or `;` (`X-NEW-1` never matches
 * `X-NEW-10`); an escaped `\|` is unescaped; first occurrence wins. Pure.
 * (E179)
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
 * Branches with at least one unapplied pending ticket but no live worktree:
 * an abandoned lane's findings. Exact branch-name set logic, no shell-out.
 * The caller normalizes both sides (e.g. strips `refs/heads/`) and computes
 * `hasUnappliedPendingTickets` from `parsePendingTickets` over the branch's
 * OWN lane's committed file, never from mere file existence. Returns matches
 * in input order, de-duplicated. (E179)
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
 * Moves every unapplied, well-formed block whose `lane_local_id` is in
 * `appliedLaneLocalIds` VERBATIM to the end of the first `## Applied`
 * section, appended when absent (AC8): archived, never deleted. Everything
 * else, malformed blocks included, stays put; one trailing blank line moves
 * with its block. Unmatched ids are ignored, so a re-run is a no-op.
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