// Coded by @sr-engineer
// Flat <-> live-lane layout migration runners (e123a-lane-layout-migration,
// E123 F0, spec AC6-AC10/AC15; re-targeted and split by e123b9 J2, spec
// AC2/AC5/AC12/AC15).
//
//   migrateFlatToLane(ws, opts?)       .current/<file>        -> .current/<lane>/<file>
//   migrateLaneToFlat(ws, lane, opts?) .current/<lane>/<file> -> .current/<file>
//
// Each runner is TWO functions (e123b9 spec AC12): a lock-free `*Locked` core
// that does the whole pre-flight + move critical section and assumes the
// caller already holds the lane's lock, plus a thin public wrapper that
// acquires that lock and calls the core — the same shape as
// tools/handoff-write.ts's writeHandoffState / writeHandoffStateCore.
// guards/file-lock.ts's withFileLock is O_EXCL-based and NOT re-entrant, so a
// caller that already holds the lane lock (T-E123B9-02's
// writeHandoffStateCore) MUST call the core; every other caller calls the
// wrapper. Nothing may acquire the same lock path twice on one call stack.
//
// Destination lane (e123b9 spec AC2, Decision 1, human 2026-09-23): the
// flat->lane runner targets the BRANCH-based live resolver
// (tools/lane-paths.ts's resolveCurrentLane), not the lane implied by the
// flat handoff's active_feature. This modifies D1 of .current/feature-split.md
// (its fallback rung). The runner therefore no longer parses the flat handoff
// at all — and must not import tools/handoff-parse.ts, which (T-E123B9-02)
// imports this module.
//
// Lock (e123b9 spec AC5, Decision 2): PER-LANE, at resolveLaneLockPath(ws,
// lane) = `.current/<lane>/.handoff.lock` — for flat->lane the destination
// lane above, for lane->flat the source lane. A live writer of the same lane
// takes the same lockfile, so the migration and that writer serialize.
//
// Candidate file set (e123a AC15): derived by ITERATING tools/lane-paths.ts's
// LANE_FILES registry — never a second list of filenames. Anything that is
// not a LANE_FILES entry (.current/.config.json, exemptions.json,
// .current/feature-split.md, .current/archive/, ...) is never read, moved or
// deleted by either runner. e125a (spec AC2, architecture D1): a LANE_FILES
// entry marked `noFlatCounterpart` (tasks.md) is ALSO never planned — its
// legacy location is not `.current/<filename>`, and its flat<->lane
// transition belongs to the tasks lane migration. lane->flat refuses outright
// while the lane dir still holds tasks.md (run the tasks reverse first).
//
// Safety posture:
//   - MOVE, not copy: fs.renameSync — the same atomic publish primitive the
//     handoff writer (tools/handoff-write.ts) ends on. The source file is
//     already complete on disk, so the rename itself is the atomic publish:
//     readers see the file at its old path or its new path, never partial.
//     Bytes are untouched (e123a AC9 round trip is byte-identical).
//   - Refuse, never clobber (e123a AC7): every check (required entry
//     present, destination conflict, lane-dir purity) runs BEFORE the first
//     move. The required handoff.md at a destination with DIFFERENT bytes
//     throws with both sides untouched; IDENTICAL bytes is a completed move
//     from an interrupted prior run: the redundant source is removed and the
//     entry is reported as moved (idempotent resume).
//   - Sidecar merge, flat->lane ONLY (e123b9 spec AC15): an OPTIONAL
//     append-only JSONL entry (telemetry/metrics/usage/dispatch.jsonl)
//     already present at the lane destination is the normal case (e.g. the
//     usage hook appended to the lane path before the first tw_* call
//     migrated the handoff) and is MERGED — flat lines first, then the lane's
//     pre-existing lines — and published atomically (tmp + rename) inside the
//     same critical section. The reverse runner keeps refuse-on-different-
//     content for every entry: a merge cannot be un-merged.
//   - Never merged (e179 AC10, DR-10): any optional entry that is NOT a
//     `.jsonl` append log — today pending-tickets.md, committed markdown —
//     is required-shaped at the destination in both directions: identical
//     bytes -> drop, different bytes -> refuse. Concatenating two markdown
//     files would yield two "## Applied" sections and duplicate
//     lane_local_ids, and the byte-prefix resume heuristic means nothing for
//     a hand-edited file. A future non-JSONL optional entry defaults here
//     (the safe direction).
//
// Out of scope (spec): the live-lane -> .current/history/<YYYY-MM>/<lane>/
// close-time move (E73/E125) is a different operation and is NOT here.
import * as fs from "fs";
import * as path from "path";
import { isLockPayloadStale, withFileLock } from "../guards/file-lock.js";
import { LANE_FILES, HANDOFF_LOCK_FILENAME, isBytePrefix, isSafeLaneName, laneFile, resolveCurrentLane, resolveLaneDir, resolveLaneLockPath, } from "./lane-paths.js";
// e125a (spec AC2, architecture D1): the LANE_FILES entries the E123 runners
// plan moves for — every entry except a `noFlatCounterpart` one (tasks.md).
// isStaleAtomicTmp below deliberately keeps iterating the FULL registry: a
// stale `tasks.md.<pid>.<ms>.tmp` is still tolerable debris.
const MOVABLE_LANE_FILES = LANE_FILES.filter((f) => !f.noFlatCounterpart);
// The lane-local task ledger's filename (the registry owns the literal) and
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
// e123b8 J1 (spec AC5): lane-dir debris migrateLaneToFlat tolerates — a
// lockfile or a stale atomic-write temp file. Never moved. Since e123b9 J2
// the lockfile in the lane dir is the lane lock the caller HOLDS, so the core
// never deletes it (only withFileLock's release does); stale tmp files are
// removed with the lane dir. Every other non-LANE_FILES entry still refuses.
// e125a (spec AC2): `tasks.md.lock` alone is tolerable too. It is NOT the
// caller's lock, so after the moves it is removed ONLY when stale
// (guards/file-lock.ts's isLockPayloadStale — withFileLock's own predicate);
// a live one (a tasks-ledger writer mid-operation) stays, and so does the
// lane dir holding it.
function isTolerableDebris(name) {
    return name === HANDOFF_LOCK_FILENAME || name === TASKS_LOCK_FILENAME || isStaleAtomicTmp(name);
}
// Keeps the pre-J2 "lane-migrate: invalid lane name" message prefix; the
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
// -> drop, different bytes -> refuse, never merge (e179 AC10, DR-10).
const isAppendLog = (e) => e.filename.endsWith(".jsonl");
// Pre-flight over the registry. Throws — before anything is touched — on a
// missing required entry or a conflicting destination. Returns the move plan
// plus the skipped (absent optional) filenames. `mergeSidecars` is true only
// for flat->lane (spec AC15). `requiredMayBeAbsent` (flat->lane resume/AC19
// only) leaves an absent required entry out of the plan instead of throwing;
// the caller has already decided that is legal.
//
// e123b9 amendment AC17: the plan lists the optional sidecars FIRST and the
// required entry (handoff.md) LAST, so an interrupted run leaves handoff.md
// at its source and the own-workspace trigger (AC16) stays armed.
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
// ONE predicate shared with the read-side aggregation (e123c spec, "Double-
// count rule"), so a flat file this resume would drop is exactly a flat file
// tw_gate_stats / sumUsageForFeature skip as half-merged.
const NEWLINE = Buffer.from("\n");
const MERGE_MAX_ATTEMPTS = 5;
// AC15 merge: publish `src ++ dest` at `dest` atomically (tmp + rename), then
// remove `src`. A newline is inserted only if the flat file lacks a trailing
// one, so the two JSONL streams never fuse into one malformed line.
//
// The sidecar appenders (tools/telemetry.ts, tools/metrics.ts,
// tools/dispatch-log.ts, the usage hook) append WITHOUT the handoff lock, so
// a line appended to `dest` after it was read would be lost by the rename.
// Optimistic guard: re-read `dest` just before the rename and rebuild if it
// changed. This narrows the window to the stat->rename gap; it cannot close
// it (see NEW-TICKETS.md J2-NEW-2).
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
 * LOCK-FREE CORE of the flat->lane migration (e123b9 spec AC12).
 *
 * CONTRACT: the caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))` for the exact
 * destination lane, and MUST pass that lane as `opts.lane` (it defaults to
 * resolveCurrentLane(workspacePath) only for a caller that resolves the lane
 * the same way immediately before locking — prefer passing it). This function
 * takes NO lock itself; calling the public migrateFlatToLane while holding
 * the lane lock would self-deadlock until LOCK_MAX_WAIT_MS and then fail,
 * because withFileLock is not re-entrant. Intended caller:
 * tools/handoff-write.ts's writeHandoffStateCore (T-E123B9-02), from inside
 * its own per-lane locked section, BEFORE it resolves handoffPath for the
 * write. The lane directory already exists (it hosts the held lock).
 *
 * Behaviour: moves every present flat LANE_FILES entry into
 * `.current/<lane>/`, sidecars first and handoff.md last (amendment AC17).
 * The required entry must be present at the flat source (throws otherwise,
 * nothing moved), except:
 *   - absent at the source and already in the lane (a completed or
 *     interrupted migration): any leftover flat sidecars are swept in via
 *     the AC15 merge/resume rule (amendment AC18); with none left over it is
 *     the loser of a concurrent race (AC-MIG-3) — `alreadyMigrated: true`,
 *     nothing touched;
 *   - absent at both paths with `opts.allowMissingRequired` (amendment
 *     AC19): the sidecars are moved, no throw.
 * Absent optional entries are skipped silently. An optional JSONL sidecar
 * already present in the lane is merged (flat lines first) — spec AC15; a
 * non-JSONL optional entry (pending-tickets.md) with different bytes at both
 * ends refuses instead, nothing moved (e179 AC10). handoff.md
 * at both paths with different bytes throws (dual presence is surfaced one
 * layer up as HANDOFF_LAYOUT_CONFLICT by T-E123B9-02; this is the backstop).
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
 * e123b9 amendment AC16: the own-workspace migration trigger — true iff ANY
 * LANE_FILES entry (handoff.md or a sidecar) still exists as a file at the
 * flat `<ws>/.current/<filename>`. Read-only. Shared by tools/handoff-parse.ts
 * (readHandoffState) and tools/handoff-write.ts (writeHandoffStateCore) so
 * both entry points use the same predicate.
 */
export function hasFlatLaneFiles(workspacePath) {
    const flatDir = path.join(workspacePath, ".current");
    return MOVABLE_LANE_FILES.some((entry) => isFile(path.join(flatDir, entry.filename)));
}
/**
 * Move the flat `.current/` lane files into `.current/<lane>/`, where `lane`
 * is `opts.lane` or, by default, resolveCurrentLane(workspacePath) — the
 * checked-out branch's lane, PRIMARY_LANE ("_primary") on a non-feat branch
 * (spec AC2). Public, LOCK-ACQUIRING wrapper (spec AC12): takes the per-lane
 * lock `.current/<lane>/.handoff.lock` (spec AC5), creating the lane
 * directory first to host it, then runs migrateFlatToLaneLocked. For a caller
 * that does NOT already hold that lock (e.g. readHandoffState). See the core
 * for behaviour.
 *
 * If the run is refused and the lane directory was created only to host the
 * lock, the (then empty) directory is removed again after the lock releases.
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
 * LOCK-FREE CORE of the lane->flat migration (e123b9 spec AC12).
 *
 * CONTRACT: the caller MUST already hold
 * `withFileLock(resolveLaneLockPath(workspacePath, lane))`. This function
 * takes NO lock itself (withFileLock is not re-entrant — see
 * migrateFlatToLaneLocked). Because that held lockfile lives INSIDE the lane
 * directory, the core never deletes it and so cannot remove the lane
 * directory while it is held: it removes the directory only if it is already
 * empty, and otherwise leaves it holding just the lock for the caller to
 * remove after releasing (the public wrapper does exactly that).
 *
 * Behaviour (unchanged by e123b9 AC15 — no sidecar merge in this direction):
 * moves `.current/<lane>/`'s lane files back to flat `.current/`. Refuses
 * (throws, touches nothing) when the lane directory is missing, lacks the
 * required entry, holds anything that is not a LANE_FILES entry or tolerable
 * debris (a HANDOFF_LOCK_FILENAME regular file, a `tasks.md.lock` regular
 * file, a stale `<lane file>.<pid>.<ms>.tmp`), or a flat destination exists
 * with different content — and (e125a spec AC2) whenever the lane dir holds
 * tasks.md. Stale tmp debris and a stale tasks.md.lock are removed after the
 * moves; the held .handoff.lock and a live tasks.md.lock never are.
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
    // e125a (spec AC2, architecture D2): the lane-local ledger has no flat
    // `.current/` home — refuse before any classification, touching nothing.
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
 * Exact reverse of migrateFlatToLane: move `.current/<lane>/`'s lane files
 * back to flat `.current/`, then remove the now-empty `.current/<lane>/`.
 * Public, LOCK-ACQUIRING wrapper (spec AC12): takes the per-lane lock
 * `.current/<lane>/.handoff.lock` (spec AC5) and runs migrateLaneToFlatLocked;
 * once the lock is released (its file gone) it removes the lane directory,
 * leaving it in place only if something new landed there concurrently. A
 * missing lane directory is refused BEFORE locking, so a refused run never
 * creates one. See the core for the refusal rules.
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