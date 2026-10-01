// Coded by @sr-engineer
// Flat <-> live-lane layout migration runners (E123):
//   migrateFlatToLane(ws, opts?)       .current/<file>        -> .current/<lane>/<file>
//   migrateLaneToFlat(ws, lane, opts?) .current/<lane>/<file> -> .current/<file>
// Each pairs a lock-free `*Locked` core (the caller already holds the
// per-lane lock, which is not re-entrant) with a wrapper that takes it.
// Why: specs/e260b-rationale.md (tools/lane-migrate.ts)
import * as fs from "fs";
import * as path from "path";
import { isLockPayloadStale, withFileLock } from "../guards/file-lock.js";
import { LANE_FILES, HANDOFF_LOCK_FILENAME, isBytePrefix, isSafeLaneName, laneFile, resolveCurrentLane, resolveLaneDir, resolveLaneLockPath, } from "./lane-paths.js";
// The tools/lane-paths.ts LANE_FILES entries the flat<->lane runners plan
// moves for: all except a `noFlatCounterpart` one (tasks.md). isStaleAtomicTmp
// below deliberately keeps iterating the FULL registry: a stale
// `tasks.md.<pid>.<ms>.tmp` is still tolerable debris. (E125a)
const MOVABLE_LANE_FILES = LANE_FILES.filter((f) => !f.noFlatCounterpart);
// The lane-local task ledger's filename (tools/lane-paths.ts owns it) and
// its per-file lock sibling (architecture "Per-file tasks lock").
const TASKS_FILENAME = laneFile("tasks").filename;
const TASKS_LOCK_FILENAME = `${TASKS_FILENAME}.lock`;
// Stale atomic-write temp file left by an interrupted tmp-write + rename
// publish: `<lane filename>.<pid>.<epoch ms>.tmp` — the exact shape
// tools/handoff-write.ts (and the other atomic writers, including this
// module's sidecar merge) produce. Only a LANE_FILES filename prefix
// qualifies; anything else stays foreign.
const ATOMIC_TMP_SUFFIX_RE = /^\.\d+\.\d+\.tmp$/;
function isStaleAtomicTmp(name) {
    return LANE_FILES.some((f) => name.startsWith(f.filename) && ATOMIC_TMP_SUFFIX_RE.test(name.slice(f.filename.length)));
}
// Lane-dir debris migrateLaneToFlat tolerates: the held lane lock, a
// tasks.md.lock (removed after the moves only when stale), or a stale
// atomic-write tmp file. Never moved; anything else refuses. (E123, E125a)
function isTolerableDebris(name) {
    return name === HANDOFF_LOCK_FILENAME || name === TASKS_LOCK_FILENAME || isStaleAtomicTmp(name);
}
// Keeps the original "lane-migrate: invalid lane name" message prefix; the
// predicate is tools/lane-paths.ts's single SAFE_LANE_RE owner.
function assertSafeLane(lane) {
    if (!isSafeLaneName(lane)) {
        throw new Error(`lane-migrate: invalid lane name ${JSON.stringify(lane)} — must be a single path ` +
            `segment (letters, digits, "_" or "-"; no separators, no "." / "..")`);
    }
}
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
// Remove `dir` iff it is empty. Never recursive. Tolerates the directory
// being gone or having gained content concurrently (both leave the tree in a
// valid state); any other failure propagates.
function removeDirIfEmpty(dir) {
    try {
        fs.rmdirSync(dir);
    }
    catch (err) {
        const code = err.code;
        if (code === "ENOENT" || code === "ENOTEMPTY" || code === "EEXIST")
            return;
        throw err;
    }
}
// Append-only JSONL logs merge by concatenation; any other optional lane file
// (pending-tickets.md) is required-shaped at the destination: identical bytes
// -> drop, different bytes -> refuse, never merge. (E179)
const isAppendLog = (e) => e.filename.endsWith(".jsonl");
// Pre-flight over the registry: throws, before anything is touched, on a
// missing required entry or a conflicting destination. `requiredMayBeAbsent`
// (flat->lane resume) skips an absent required entry instead. Sidecars are
// planned first and handoff.md last, so an interrupted run leaves handoff.md
// at its source and the next read or write finishes the move. (E123)
function planMoves(srcDir, destDir, direction, mergeSidecars, requiredMayBeAbsent = false) {
    const plan = [];
    const skipped = [];
    const sidecarsFirst = [
        ...MOVABLE_LANE_FILES.filter((f) => !f.required),
        ...MOVABLE_LANE_FILES.filter((f) => f.required),
    ];
    for (const entry of sidecarsFirst) {
        const src = path.join(srcDir, entry.filename);
        const dest = path.join(destDir, entry.filename);
        if (!isFile(src)) {
            if (entry.required && requiredMayBeAbsent)
                continue;
            if (entry.required) {
                throw new Error(`lane-migrate (${direction}): required lane file ${entry.filename} not found at ${src} — nothing moved`);
            }
            skipped.push(entry.filename);
            continue;
        }
        let action = "rename";
        if (fs.existsSync(dest)) {
            const destIsFile = isFile(dest);
            const srcBytes = fs.readFileSync(src);
            const destBytes = destIsFile ? fs.readFileSync(dest) : null;
            const sidecarMerge = mergeSidecars && !entry.required && isAppendLog(entry) && destIsFile;
            if (destBytes !== null && destBytes.equals(srcBytes)) {
                action = "drop";
            }
            else if (sidecarMerge && destBytes !== null && isBytePrefix(srcBytes, destBytes)) {
                // The lane file already begins with every flat byte: a merge from a
                // prior run published but died before removing the flat source.
                // Merging again would duplicate the flat lines; dropping the source
                // loses nothing (its bytes are the lane file's prefix).
                action = "drop";
            }
            else if (sidecarMerge) {
                action = "merge";
            }
            else {
                throw new Error(`lane-migrate (${direction}): destination ${dest} already exists with different ` +
                    `content than ${src} — refusing to clobber; nothing moved`);
            }
        }
        plan.push({ entry, src, dest, action });
    }
    return { plan, skipped };
}
// The byte-prefix check above is tools/lane-paths.ts's isBytePrefix — the
// ONE predicate shared with the read-side aggregation, so a flat file this
// resume would drop is exactly a flat file tw_gate_stats /
// sumUsageForFeature skip as half-merged. (E123)
const NEWLINE = Buffer.from("\n");
const MERGE_MAX_ATTEMPTS = 5;
// Publish `src ++ dest` at `dest` atomically (tmp + rename), then remove
// `src`; a newline is added if the flat file lacks one. Sidecar appenders
// take no handoff lock, so `dest` is re-read before the rename and rebuilt if
// it changed. That narrows the lost-append window but cannot close it.
function mergeSidecar(src, dest) {
    const srcBytes = fs.readFileSync(src);
    const sep = srcBytes.length > 0 && srcBytes[srcBytes.length - 1] !== NEWLINE[0] ? NEWLINE : Buffer.alloc(0);
    for (let attempt = 1;; attempt++) {
        const destBytes = fs.readFileSync(dest);
        const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
        try {
            fs.writeFileSync(tmp, Buffer.concat([srcBytes, sep, destBytes]), { flag: "wx" });
            const recheck = fs.readFileSync(dest);
            if (!recheck.equals(destBytes) && attempt < MERGE_MAX_ATTEMPTS) {
                fs.unlinkSync(tmp);
                continue;
            }
            fs.renameSync(tmp, dest);
        }
        catch (err) {
            try {
                fs.unlinkSync(tmp);
            }
            catch {
                /* tmp never created, or already renamed */
            }
            throw err;
        }
        break;
    }
    fs.unlinkSync(src);
}
function executeMoves(plan) {
    const moved = [];
    const merged = [];
    for (const m of plan) {
        if (m.action === "drop") {
            fs.unlinkSync(m.src);
        }
        else if (m.action === "merge") {
            mergeSidecar(m.src, m.dest);
            merged.push(m.entry.filename);
        }
        else {
            fs.renameSync(m.src, m.dest);
        }
        moved.push(m.entry.filename);
    }
    return { moved, merged };
}
/**
 * Lock-free core of the flat->lane migration. The caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))` and pass that lane
 * as `opts.lane` (absent, it defaults to resolveCurrentLane); calling the
 * public wrapper instead self-deadlocks. Moves the present flat LANE_FILES
 * entries into `.current/<lane>/`, handoff.md last.
 * Refusal and resume rules: specs/e260b-rationale.md (tools/lane-migrate.ts).
 */
export function migrateFlatToLaneLocked(workspacePath, opts = {}) {
    const lane = opts.lane ?? resolveCurrentLane(workspacePath);
    assertSafeLane(lane);
    const flatDir = path.join(workspacePath, ".current");
    const laneDir = resolveLaneDir(workspacePath, lane);
    // Required-entry check first, so a missing handoff surfaces as the clear
    // "required lane file not found" error rather than a later failure.
    const missingRequired = MOVABLE_LANE_FILES.filter((entry) => entry.required && !isFile(path.join(flatDir, entry.filename)));
    const alreadyInLane = missingRequired.length > 0 &&
        missingRequired.every((entry) => isFile(path.join(laneDir, entry.filename)));
    if (missingRequired.length > 0 && !alreadyInLane && !opts.allowMissingRequired) {
        throw new Error(`lane-migrate (flat->lane): required lane file ${missingRequired[0].filename} not found in ${flatDir} — nothing moved`);
    }
    if (fs.existsSync(laneDir) && !isDirectory(laneDir)) {
        throw new Error(`lane-migrate (flat->lane): ${laneDir} exists and is not a directory — nothing moved`);
    }
    const { plan, skipped } = planMoves(flatDir, laneDir, "flat->lane", true, missingRequired.length > 0);
    if (alreadyInLane && plan.length === 0) {
        return { lane, moved: [], skipped: [], merged: [], alreadyMigrated: true };
    }
    fs.mkdirSync(laneDir, { recursive: true });
    const { moved, merged } = executeMoves(plan);
    return { lane, moved, skipped, merged, alreadyMigrated: false };
}
/**
 * Own-workspace migration trigger: true iff ANY LANE_FILES entry (handoff.md
 * or a sidecar) still exists as a file at the flat `<ws>/.current/<filename>`.
 * Read-only. Shared by tools/handoff-parse.ts (readHandoffState) and
 * tools/handoff-write.ts (writeHandoffStateCore) so both entry points use the
 * same predicate before calling migrateFlatToLaneLocked on
 * resolveCurrentLane's lane. (E123)
 */
export function hasFlatLaneFiles(workspacePath) {
    const flatDir = path.join(workspacePath, ".current");
    return MOVABLE_LANE_FILES.some((entry) => isFile(path.join(flatDir, entry.filename)));
}
/**
 * Public, lock-acquiring wrapper around migrateFlatToLaneLocked, for callers
 * that do not hold the lane lock (e.g. readHandoffState). `lane` defaults to
 * resolveCurrentLane(ws), i.e. "_primary" off a feat branch. Creates the lane
 * dir to host the lock and removes it again if the run is refused and the dir
 * is still empty.
 */
export async function migrateFlatToLane(workspacePath, opts = {}) {
    const lane = opts.lane ?? resolveCurrentLane(workspacePath);
    assertSafeLane(lane);
    const flatDir = path.join(workspacePath, ".current");
    const laneDir = resolveLaneDir(workspacePath, lane);
    // Cheap pre-lock refusals, so an obviously-impossible run creates nothing:
    // no required entry at either end, or a non-directory where the lane dir
    // must go. The core re-checks both under the lock.
    const requiredNowhere = !opts.allowMissingRequired && MOVABLE_LANE_FILES.some((entry) => entry.required &&
        !isFile(path.join(flatDir, entry.filename)) &&
        !isFile(path.join(laneDir, entry.filename)));
    if (requiredNowhere) {
        const entry = MOVABLE_LANE_FILES.find((f) => f.required);
        throw new Error(`lane-migrate (flat->lane): required lane file ${entry?.filename} not found in ${flatDir} — nothing moved`);
    }
    if (fs.existsSync(laneDir) && !isDirectory(laneDir)) {
        throw new Error(`lane-migrate (flat->lane): ${laneDir} exists and is not a directory — nothing moved`);
    }
    const createdLaneDir = !fs.existsSync(laneDir);
    // spec AC5: the lane dir may not exist yet; create it purely to host the
    // lock file (withFileLock would also mkdir the lock's parent — explicit
    // here so the ordering is visible).
    fs.mkdirSync(laneDir, { recursive: true });
    try {
        return await withFileLock(resolveLaneLockPath(workspacePath, lane), () => migrateFlatToLaneLocked(workspacePath, { ...opts, lane }));
    }
    catch (err) {
        if (createdLaneDir)
            removeDirIfEmpty(laneDir);
        throw err;
    }
}
/**
 * Lock-free core of the lane->flat migration (no sidecar merge this way); the
 * caller MUST hold the lane lock. Refuses, touching nothing, when the lane dir
 * is missing, lacks handoff.md, holds tasks.md, holds anything that is not a
 * lane file or tolerable debris, or a flat destination differs. Never deletes
 * the held lock, so the wrapper removes the lane dir after releasing it.
 */
export function migrateLaneToFlatLocked(workspacePath, lane, opts = {}) {
    void opts;
    assertSafeLane(lane);
    const flatDir = path.join(workspacePath, ".current");
    const laneDir = resolveLaneDir(workspacePath, lane);
    let entries;
    try {
        if (!fs.statSync(laneDir).isDirectory())
            throw new Error("not a directory");
        entries = fs.readdirSync(laneDir);
    }
    catch {
        throw new Error(`lane-migrate (lane->flat): lane directory ${laneDir} not found — nothing moved`);
    }
    // The lane-local ledger has no flat `.current/` home — refuse before any
    // classification, touching nothing. (E125a)
    if (isFile(path.join(laneDir, TASKS_FILENAME))) {
        throw new Error(`lane-migrate (lane->flat): ${laneDir} holds ${TASKS_FILENAME} — run the tasks reverse migration first; nothing moved`);
    }
    // tasks.md stays out of `known` (defense in depth: a non-file tasks.md
    // entry falls through to the foreign-entry refusal below).
    const known = new Set(MOVABLE_LANE_FILES.map((f) => f.filename));
    // Debris must be a regular file: a debris-NAMED directory (or other
    // non-file) is foreign, so it refuses in pre-flight rather than failing
    // mid-run after the moves.
    const isDebris = (name) => !known.has(name) && isTolerableDebris(name) && isFile(path.join(laneDir, name));
    const debris = entries.filter(isDebris);
    const foreign = entries.filter((name) => !known.has(name) && !isDebris(name));
    if (foreign.length > 0) {
        throw new Error(`lane-migrate (lane->flat): ${laneDir} holds non-lane entries (${foreign.join(", ")}) — ` +
            `it cannot end empty and unknown content is never deleted; nothing moved`);
    }
    const { plan, skipped } = planMoves(laneDir, flatDir, "lane->flat", false);
    const { moved } = executeMoves(plan);
    // Debris goes only AFTER every pre-flight check passed and the moves ran,
    // so a refused run still touches nothing. The lockfile is the caller's
    // held lock — never deleted here.
    for (const name of debris) {
        const p = path.join(laneDir, name);
        if (name === HANDOFF_LOCK_FILENAME)
            continue;
        if (name === TASKS_LOCK_FILENAME) {
            if (isLockPayloadStale(p))
                fs.rmSync(p, { force: true });
            continue;
        }
        fs.unlinkSync(p);
    }
    removeDirIfEmpty(laneDir);
    return { moved, skipped };
}
/**
 * Exact reverse of migrateFlatToLane: the lock-acquiring wrapper around
 * migrateLaneToFlatLocked. Refuses a missing lane dir before locking, and
 * removes the lane dir after the lock is released unless new content landed.
 */
export async function migrateLaneToFlat(workspacePath, lane, opts = {}) {
    assertSafeLane(lane);
    const laneDir = resolveLaneDir(workspacePath, lane);
    if (!isDirectory(laneDir)) {
        throw new Error(`lane-migrate (lane->flat): lane directory ${laneDir} not found — nothing moved`);
    }
    const result = await withFileLock(resolveLaneLockPath(workspacePath, lane), () => migrateLaneToFlatLocked(workspacePath, lane, opts));
    removeDirIfEmpty(laneDir);
    return result;
}
//# sourceMappingURL=lane-migrate.js.map