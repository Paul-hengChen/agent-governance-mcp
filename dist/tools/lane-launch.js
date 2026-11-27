// Coded by @sr-engineer
// Lane launcher core (scripts/lane-launch.mjs): starts the batch lanes of the
// current wave of a fan-out manifest under a parallel limit, waits on lane
// dependencies, and keeps a launch state in the git common dir. It only reads
// the manifest; it never writes a tracked path or anything under a lane worktree.
// Why: specs/e443b-lane-launcher-architecture.md
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config.js";
import { lanesSectionsWithoutWave, validateManifest } from "./fanout-manifest.js";
// --- §A constants, output lines, launch-state shape --------------------------
export const DEFAULT_LANE_LAUNCH_LIMIT = 3;
export const LAUNCH_STATE_FILE = "agc-lane-launch.json";
export const LAUNCH_LOCK_FILE = "agc-lane-launch.lock";
export const LAUNCH_STATE_VERSION = 1;
export const LAUNCH_STATUSES = ["running", "paused-weekly", "paused-stopped", "finished", "window-gone", "start-failed"];
export const POLL_INTERVAL_MS = 15_000;
export const SLASH_LINE = "/mcp__agent-governance-mcp__teamwork";
export const SEND_GAP_MS = 500;
/** The one table of host line prefixes the launcher matches in a window. */
export const HOST_SIGNALS = {
    weekly: "You've hit your weekly limit",
    continuing: "Continuing automatically at",
    stopped: "Automatic continue stopped after repeated usage-limit hits",
    enter: "Press enter to continue",
    unknown: "Unknown command",
};
export const OUT = {
    refused: (reason) => `lane-launch: refused — ${reason}`,
    refusedNoWave: "the manifest has no 波次 column; add it at Stage 1 or start the lanes by hand",
    refusedNoHuman: "the manifest has no 人類 Decisions row",
    refusedTier: "cutApprovalAutoTier.manifest is not true in .current/.config.json",
    refusedSameWave: (lane, dep, wave) => `lane ${lane} depends on ${dep} in the same wave ${wave}; move ${lane} to a later wave`,
    refusedInvalid: (code, message) => `the manifest does not validate: ${code} ${message}`,
    refusedBusy: (pid) => `another lane-launch run is active (pid ${pid}); stop it first`,
    started: (lane, id) => `started ${lane} — window ${id}`,
    queued: (lane, limit) => `queued ${lane} — parallel limit ${limit}`,
    waiting: (lane, dep, why) => `waiting ${lane} — depends on ${dep}: ${why}`,
    notStarted: (lane, why) => `not started ${lane} — ${why}`,
    finished: (lane, how) => `finished ${lane} — ${how}`,
    laterWave: (n, m) => `wave ${n} waits until every lane of wave ${m} is finished`,
    exit: (n) => `lane-launch: no lane of wave ${n} is running — exiting`,
};
export function launchLimit(config) {
    return config.laneLaunchLimit ?? DEFAULT_LANE_LAUNCH_LIMIT;
}
const realOr = (p) => { try {
    return fs.realpathSync(p);
}
catch {
    return path.resolve(p);
} };
const firstLine = (s) => s.trim().split("\n")[0] ?? "";
const isDir = (p) => { try {
    return fs.statSync(p).isDirectory();
}
catch {
    return false;
} };
export function resolveLaunchContext(manifestPath, git) {
    const abs = realOr(manifestPath);
    const notRepo = { error: `${manifestPath} is not inside a git repository` };
    const list = git(["worktree", "list", "--porcelain"], path.dirname(abs));
    const line = list.status === 0 ? list.stdout.split("\n").find((l) => l.startsWith("worktree ")) : undefined;
    if (line === undefined)
        return notRepo;
    const primary = line.slice("worktree ".length);
    const common = git(["rev-parse", "--git-common-dir"], primary);
    if (common.status !== 0)
        return notRepo;
    const manifestKey = path.relative(realOr(primary), abs).split(path.sep).join("/");
    return { manifestPath: abs, manifestKey, primary, gitCommonDir: realOr(path.resolve(primary, common.stdout.trim())) };
}
// --- §B launch state and lock -------------------------------------------------
export function launchStatePaths(gitCommonDir) {
    return { state: path.join(gitCommonDir, LAUNCH_STATE_FILE), lock: path.join(gitCommonDir, LAUNCH_LOCK_FILE) };
}
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function isRecord(v) {
    if (!isObj(v) || !isObj(v.signals))
        return false;
    const signals = v.signals;
    return LAUNCH_STATUSES.includes(v.status) && typeof v.wave === "number" && typeof v.windowId === "string" &&
        typeof v.baseSha === "string" && typeof v.reportFloor === "number" && typeof v.updatedAt === "string" &&
        (v.reason === undefined || typeof v.reason === "string") &&
        Object.keys(HOST_SIGNALS).every((k) => typeof signals[k] === "number");
}
export function readLaunchState(file) {
    if (!fs.existsSync(file))
        return { ok: true, state: { version: LAUNCH_STATE_VERSION, manifests: {} } };
    const bad = { ok: false, error: `the launch state ${file} does not parse; move it aside` };
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch {
        return bad;
    }
    if (!isObj(raw) || raw.version !== LAUNCH_STATE_VERSION || !isObj(raw.manifests))
        return bad;
    for (const entry of Object.values(raw.manifests)) {
        if (!isObj(entry) || !isObj(entry.lanes) || !Object.values(entry.lanes).every(isRecord))
            return bad;
    }
    return { ok: true, state: raw };
}
export function writeLaunchState(file, state, now, pid) {
    const tmp = `${file}.${pid}.${now}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
    fs.renameSync(tmp, file);
}
function lockPid(lockFile) {
    try {
        const v = JSON.parse(fs.readFileSync(lockFile, "utf8"));
        return isObj(v) && typeof v.pid === "number" ? v.pid : undefined;
    }
    catch {
        return undefined;
    }
}
/** Own O_EXCL lock; staleness is pid liveness only (a run polls for hours). */
export function acquireLaunchLock(lockFile, pid, isPidAlive, now) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(lockFile, JSON.stringify({ pid, startedAt: new Date(now).toISOString() }), { flag: "wx" });
            return { ok: true, release: () => { if (lockPid(lockFile) === pid)
                    fs.rmSync(lockFile, { force: true }); } };
        }
        catch (e) {
            if (e.code !== "EEXIST")
                throw e;
            const holder = lockPid(lockFile);
            if ((holder !== undefined && isPidAlive(holder)) || attempt === 1)
                return { ok: false, pid: holder ?? -1 };
            fs.rmSync(lockFile, { force: true });
        }
    }
    return { ok: false, pid: -1 };
}
// --- §C manifest refusals -----------------------------------------------------
export function sameWaveDependencies(m) {
    const waveOf = new Map(m.dispatchable.map((l) => [l.lane, l.wave]));
    return m.dispatchable.flatMap((l) => (l.depLanes ?? []).filter((d) => l.wave !== undefined && waveOf.get(d) === l.wave)
        .map((d) => ({ dependent: l.lane, dependedOn: d, wave: l.wave })));
}
/** Manifest-phase refusal reasons, in order: no-wave, each validation error, no-human, tier, each same-wave pair. */
export function manifestRefusals(text, config) {
    const out = [];
    if (lanesSectionsWithoutWave(text).length > 0)
        out.push(OUT.refusedNoWave);
    const { manifest, errors } = validateManifest(text);
    out.push(...errors.map((e) => OUT.refusedInvalid(e.code, e.message)));
    if (!manifest.decisions.rows.some((r) => r.decider === "人類"))
        out.push(OUT.refusedNoHuman);
    if (config.cutApprovalAutoTier?.manifest !== true)
        out.push(OUT.refusedTier);
    out.push(...sameWaveDependencies(manifest).map((p) => OUT.refusedSameWave(p.dependent, p.dependedOn, p.wave)));
    return out;
}
/** Refusals, lock, launch state. Returns 0, or 1 on a refusal. */
export async function runLaneLaunch(ctx, deps) {
    const text = fs.readFileSync(ctx.manifestPath, "utf8");
    const config = loadConfig(ctx.primary);
    const refusals = manifestRefusals(text, config);
    if (refusals.length > 0) {
        for (const r of refusals)
            deps.err(OUT.refused(r));
        return 1;
    }
    const files = launchStatePaths(ctx.gitCommonDir);
    const lock = acquireLaunchLock(files.lock, deps.pid, deps.isPidAlive, deps.clock.now());
    if (!lock.ok) {
        deps.err(OUT.refused(OUT.refusedBusy(lock.pid)));
        return 1;
    }
    try {
        const read = readLaunchState(files.state);
        if (!read.ok) {
            deps.err(OUT.refused(read.error));
            return 1;
        }
        return 0;
    }
    finally {
        lock.release();
    }
}
//# sourceMappingURL=lane-launch.js.map