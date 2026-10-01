// Coded by @sr-engineer
// Lane-layout seam, sole owner of the lane-scoped `.current/` filenames: every
// consumer (resolveLanePaths, the migration runners, dispatch-log) iterates
// LANE_FILES. Production call sites use resolveCurrentLanePaths; flat
// `.current/<filename>` is legacy, reached only by the migration runners.
// Pure path logic except three read-only fs helpers (resolveCurrentLane too).
// Why: specs/e260b-rationale.md (this file's section)
import * as fs from "fs";
import * as path from "path";
// The registry: exactly 8 entries, 1 required, 7 optional. `.config.json`,
// exemptions.json and feature-split.md are deliberately NOT lane files.
// Every file inside `.current/<lane>/` must be registered here, or the
// lane->flat runner refuses the whole lane. Per-entry notes (pendingTickets,
// tasks, baseSha): specs/e260b-rationale.md, this file's section. (E123)
export const LANE_FILES = [
    { key: "handoff", filename: "handoff.md", required: true },
    { key: "telemetry", filename: "telemetry.jsonl", required: false },
    { key: "metrics", filename: "metrics.jsonl", required: false },
    { key: "usage", filename: "usage.jsonl", required: false },
    { key: "dispatch", filename: "dispatch.jsonl", required: false },
    { key: "pendingTickets", filename: "pending-tickets.md", required: false },
    { key: "tasks", filename: "tasks.md", required: false, noFlatCounterpart: true },
    { key: "baseSha", filename: "base-sha", required: false },
];
// Registry key -> LanePaths field (resolveLanePaths' shape). Keys only, never
// filenames (AC15 is about filenames). Typed as a total Record over
// LaneFileKey, so adding a LANE_FILES entry without a matching field here
// (and in LanePaths) is a compile error rather than a silently missing path.
const LANE_PATH_FIELD = {
    handoff: "handoffPath",
    telemetry: "telemetryPath",
    metrics: "metricsPath",
    usage: "usagePath",
    dispatch: "dispatchLogPath",
    pendingTickets: "pendingTicketsPath",
    tasks: "tasksPath",
    baseSha: "baseShaPath",
};
// Look up one registry entry by key. enumerateLaneSidecarSources below
// derives a sidecar's filename from it; the lane-paths/dispatch-log tests
// use it too. (E123)
export function laneFile(key) {
    const entry = LANE_FILES.find((f) => f.key === key);
    // Unreachable for a well-typed key; guards a hand-built cast.
    if (!entry)
        throw new Error(`lane-paths: unknown lane file key "${String(key)}"`);
    return entry;
}
// Basename of the handoff lockfile: the ONE owner of the literal.
// tools/handoff-write.ts (writeHandoffState) and tools/lane-migrate.ts (both
// runners) import it; no other copy of this literal may exist under tools/.
// Not a LANE_FILES entry: it is a lock, not lane state. The lock is PER-LANE
// at `.current/<lane>/${HANDOFF_LOCK_FILENAME}`, so writers in different
// lanes never contend — see resolveLaneLockPath below, the one place that
// path is composed. (E123)
export const HANDOFF_LOCK_FILENAME = ".handoff.lock";
// Lane name used when a flat handoff's active_feature carries no parseable
// ticket id (absent / empty / no leading id token).
export const LEGACY_LANE = "_legacy";
// Lane name for a workspace whose checked-out branch carries no ticket id
// (main, integ/*, fix/*, detached HEAD, no/unreadable .git). Returned ONLY by
// the live resolver (resolveCurrentLane) — never by resolveLaneName.
export const PRIMARY_LANE = "_primary";
// Leading ticket-id token ("e163-ci-gate-ordering" -> "e163", "e123b0" ->
// "e123b0"), the single owner of the pattern; the capture is [a-z0-9] only,
// so the result is a safe path segment. Exactly ONE mandatory digit: two
// adjacent digit-claiming quantifiers would backtrack quadratically on a long
// unterminated digit run, and the accepted language is identical. (E123)
const TICKET_ID_RE = /^([a-z]+\d[a-z0-9]*)(?:-|$)/i;
/**
 * Derive a lane name from a handoff's active_feature: the lowercased leading
 * ticket-id token, else LEGACY_LANE. MUST NEVER return PRIMARY_LANE; branch
 * resolution belongs to resolveCurrentLane below. The flat->lane migration
 * does not use this; kept for lookups, no production caller today. (E123)
 */
export function resolveLaneName(activeFeature) {
    if (typeof activeFeature !== "string")
        return LEGACY_LANE;
    const m = TICKET_ID_RE.exec(activeFeature.trim());
    return m ? m[1].toLowerCase() : LEGACY_LANE;
}
// A lane name must be ONE safe path segment directly under `.current/` — no
// separators, no "." / ".." traversal, not empty. Every lane this module
// produces (resolveLaneName, resolveCurrentLane, LEGACY_LANE, PRIMARY_LANE)
// satisfies it by construction; the check guards caller-supplied names
// (tools/lane-migrate.ts's reverse runner, any future lane argument) so a
// lane can never resolve to a path outside `.current/<lane>/`.
const SAFE_LANE_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
/** true iff `lane` is a single safe path segment (see SAFE_LANE_RE). */
export function isSafeLaneName(lane) {
    return typeof lane === "string" && SAFE_LANE_RE.test(lane);
}
function assertSafeLaneName(lane, who) {
    if (!isSafeLaneName(lane)) {
        throw new Error(`${who}: invalid lane name ${JSON.stringify(lane)} — must be a single path ` +
            `segment matching ${SAFE_LANE_RE}`);
    }
}
/** `<workspacePath>/.current/<lane>` — the directory holding a lane's files. */
export function resolveLaneDir(workspacePath, lane) {
    assertSafeLaneName(lane, "lane-paths");
    return path.join(workspacePath, ".current", lane);
}
// ==========================================
// Closed-lane history buckets (E125b)
// ==========================================
/**
 * The `.current/history/<bucket>/` month bucket for a lane closed at `now`:
 * the UTC year-month, `YYYY-MM`. Always satisfies HISTORY_BUCKET_RE. (E125b)
 */
export function resolveHistoryBucket(now = new Date()) {
    const y = String(now.getUTCFullYear()).padStart(4, "0");
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
/**
 * `<workspacePath>/.current/history/<bucket>/<lane>` — where a closed lane's
 * `.current/<lane>/` directory lands. Throws on a `bucket` that is not
 * exactly `YYYY-MM` (HISTORY_BUCKET_RE) or an unsafe `lane` (not a single
 * path segment), so it can never return a path outside
 * `.current/history/<bucket>/`. Pure path logic — creates nothing. (E125b)
 */
export function resolveHistoryLaneDir(workspacePath, bucket, lane) {
    if (typeof bucket !== "string" || !HISTORY_BUCKET_RE.test(bucket)) {
        throw new Error(`lane-paths: invalid history bucket ${JSON.stringify(bucket)} — must match ${HISTORY_BUCKET_RE}`);
    }
    assertSafeLaneName(lane, "lane-paths");
    return path.join(workspacePath, ".current", "history", bucket, lane);
}
/**
 * true iff some `.current/history/<bucket>/<lane>/<filename>` exists as a
 * regular file, for any HISTORY_BUCKET_RE bucket — i.e. lane `lane` has
 * closed with that file in its history. Read-only (readdir / stat); never
 * throws — an unlistable dir, an unsafe lane or filename, or an fs error all
 * read as false (like enumerateLaneSidecarSources). (E125b)
 */
export function hasHistoryLedger(workspacePath, lane, filename) {
    if (!isSafeLaneName(lane))
        return false;
    if (typeof filename !== "string" || filename === "" || filename !== path.basename(filename))
        return false;
    if (filename === "." || filename === "..")
        return false;
    const historyDir = path.join(workspacePath, ".current", "history");
    for (const bucket of listDirNames(historyDir)) {
        if (!HISTORY_BUCKET_RE.test(bucket))
            continue;
        try {
            if (fs.statSync(path.join(historyDir, bucket, lane, filename)).isFile())
                return true;
        }
        catch {
            continue;
        }
    }
    return false;
}
/**
 * Lane-scoped paths: returns `<workspacePath>/.current/<lane>/<filename>`
 * for every LANE_FILES entry. The shape is derived by iterating LANE_FILES —
 * the filenames are never restated here. Throws on an unsafe `lane` (not a
 * single path segment); every lane the resolvers in this module produce is
 * safe by construction, so production callers (all via
 * resolveCurrentLanePaths) never hit that throw. (E123)
 */
export function resolveLanePaths(workspacePath, lane) {
    const dir = resolveLaneDir(workspacePath, lane);
    const out = {};
    for (const entry of LANE_FILES) {
        out[LANE_PATH_FIELD[entry.key]] = path.join(dir, entry.filename);
    }
    return out;
}
/**
 * Per-lane handoff lock path `.current/<lane>/${HANDOFF_LOCK_FILENAME}`, the
 * single composer of it, so the migration runners and a live writer of the
 * SAME lane serialize on the SAME lockfile. Pure path logic: the lock
 * acquirer creates the lane directory. (E123)
 */
export function resolveLaneLockPath(workspacePath, lane) {
    return path.join(resolveLaneDir(workspacePath, lane), HANDOFF_LOCK_FILENAME);
}
// `ref: refs/heads/<branch>` — the only HEAD shape that names a branch, so
// the only one resolveCurrentLane maps to a lane. A detached HEAD is a bare
// sha and does not match.
const HEAD_REF_RE = /^ref:\s*refs\/heads\/(\S+)$/;
const GITDIR_RE = /^gitdir:\s*(.+)$/;
const FEAT_PREFIX = "feat/";
// resolveCurrentLane's HEAD locator, by pure fs: `.git` directory ->
// `.git/HEAD`; `.git` gitfile (`gitdir: <path>`, a linked worktree or
// submodule) -> `<gitdir>/HEAD`, a relative gitdir resolved against the
// workspace. Returns null for a missing `.git` or a malformed gitfile.
// May throw on an fs error; the caller swallows it.
function headFilePath(workspacePath) {
    const dotGit = path.join(workspacePath, ".git");
    const st = fs.statSync(dotGit, { throwIfNoEntry: false });
    if (!st)
        return null;
    if (st.isDirectory())
        return path.join(dotGit, "HEAD");
    if (!st.isFile())
        return null;
    const m = GITDIR_RE.exec(fs.readFileSync(dotGit, "utf-8").trim());
    if (!m)
        return null;
    const gitdir = m[1].trim();
    if (gitdir === "")
        return null;
    return path.join(path.resolve(workspacePath, gitdir), "HEAD");
}
/**
 * LIVE lane resolver, by pure fs (no git subprocess): `feat/<rest>` whose
 * `<rest>` starts with a ticket-id token -> the lowercased id
 * (`feat/e123b1-core-write-path` -> `e123b1`); anything else (main, integ/*,
 * a feat/ branch with no id, detached HEAD, missing or malformed .git) ->
 * PRIMARY_LANE. NEVER throws. (E123)
 */
export function resolveCurrentLane(workspacePath) {
    try {
        const headPath = headFilePath(workspacePath);
        if (headPath === null)
            return PRIMARY_LANE;
        const ref = HEAD_REF_RE.exec(fs.readFileSync(headPath, "utf-8").trim());
        if (!ref)
            return PRIMARY_LANE;
        const branch = ref[1];
        if (!branch.startsWith(FEAT_PREFIX))
            return PRIMARY_LANE;
        const id = TICKET_ID_RE.exec(branch.slice(FEAT_PREFIX.length));
        return id ? id[1].toLowerCase() : PRIMARY_LANE;
    }
    catch {
        return PRIMARY_LANE;
    }
}
/**
 * The current lane's paths: resolveLanePaths over resolveCurrentLane. It
 * returns lane-scoped `.current/<lane>/<filename>` paths —
 * `.current/_primary/...` on a primary checkout, `.current/<ticket-id>/...`
 * on a `feat/<id>-*` lane. (E123)
 */
export function resolveCurrentLanePaths(workspacePath) {
    return resolveLanePaths(workspacePath, resolveCurrentLane(workspacePath));
}
/**
 * Legacy flat paths: `<workspacePath>/.current/<filename>` for every
 * LANE_FILES entry — the old layout a not-yet-migrated workspace still
 * holds. Read-only fallbacks (tools/drift.ts's skew precheck,
 * bin/agent-governance-usage-hook.mjs, enumerateLaneSidecarSources) resolve
 * the flat copy through this one composer instead of restating a filename.
 * No live writer targets these paths. (E123)
 */
export function resolveFlatLanePaths(workspacePath) {
    const dir = path.join(workspacePath, ".current");
    const out = {};
    for (const entry of LANE_FILES) {
        out[LANE_PATH_FIELD[entry.key]] = path.join(dir, entry.filename);
    }
    return out;
}
// ==========================================
// Cross-lane sidecar aggregation (E123)
// ==========================================
/**
 * true iff `candidate`'s bytes are identical to, or a prefix of,
 * `authority`'s bytes. THE one byte-prefix predicate for "already counted":
 * tools/lane-migrate.ts's flat->lane resume check (a flat sidecar whose bytes
 * already lead the lane file = a merge that published but died before
 * unlinking the flat source) and enumerateLaneSidecarSources's read-side
 * dedup both use it, so the migrator and the aggregating readers agree on
 * what "already counted" means. (E123)
 */
export function isBytePrefix(candidate, authority) {
    return (authority.length >= candidate.length &&
        authority.subarray(0, candidate.length).equals(candidate));
}
// `.current/` subdirectories that are never lanes. Files (.config.json,
// feature-split.md, ...) are excluded by the isDirectory() check, dot-dirs by
// isSafeLaneName. (E123)
export const NON_LANE_DIRS = new Set(["archive", "history"]);
// A `.current/history/<bucket>/` month bucket.
export const HISTORY_BUCKET_RE = /^\d{4}-\d{2}$/;
function listDirNames(dir) {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
    }
    catch {
        return [];
    }
}
// null = absent / not a regular file / unreadable.
function readFileBytes(p) {
    try {
        if (!fs.statSync(p).isFile())
            return null;
        return fs.readFileSync(p);
    }
    catch {
        return null;
    }
}
/**
 * Every copy of one lane sidecar in this workspace's own `.current/` tree
 * (live lane dirs, `history/<YYYY-MM>/<lane>/`, legacy flat), deduplicated by
 * CONTENT, never by name: a copy that is a byte prefix of a counted copy is a
 * half-finished move or merge and is skipped. Read-only; never throws.
 * Why: specs/e260b-rationale.md (this file's section)
 */
export function enumerateLaneSidecarSources(workspacePath, key) {
    const filename = laneFile(key).filename;
    const currentDir = path.join(workspacePath, ".current");
    const historyDir = path.join(currentDir, "history");
    const live = [];
    for (const lane of listDirNames(currentDir)) {
        if (NON_LANE_DIRS.has(lane) || !isSafeLaneName(lane))
            continue;
        const p = path.join(currentDir, lane, filename);
        const bytes = readFileBytes(p);
        if (bytes !== null)
            live.push({ path: p, kind: "live", lane, bytes });
    }
    const liveByLane = new Map(live.map((s) => [s.lane, s]));
    const skipped = [];
    const history = [];
    for (const bucket of listDirNames(historyDir)) {
        if (!HISTORY_BUCKET_RE.test(bucket))
            continue;
        for (const lane of listDirNames(path.join(historyDir, bucket))) {
            if (!isSafeLaneName(lane))
                continue;
            const p = path.join(historyDir, bucket, lane, filename);
            const bytes = readFileBytes(p);
            if (bytes === null)
                continue;
            const liveCopy = liveByLane.get(lane);
            if (bytes.length > 0 && liveCopy && isBytePrefix(bytes, liveCopy.bytes)) {
                skipped.push({ path: p, kind: "history", lane, authorityPath: liveCopy.path });
                continue;
            }
            history.push({ path: p, kind: "history", lane, bytes });
        }
    }
    const flat = [];
    const flatPath = path.join(currentDir, filename);
    const flatBytes = readFileBytes(flatPath);
    if (flatBytes !== null) {
        const authority = flatBytes.length > 0
            ? [...live, ...history].find((s) => isBytePrefix(flatBytes, s.bytes))
            : undefined;
        if (authority) {
            skipped.push({ path: flatPath, kind: "flat", lane: null, authorityPath: authority.path });
        }
        else {
            flat.push({ path: flatPath, kind: "flat", lane: null, bytes: flatBytes });
        }
    }
    return { sources: [...flat, ...history, ...live], skipped };
}
//# sourceMappingURL=lane-paths.js.map