// Coded by @sr-engineer
// Lane launcher core (scripts/lane-launch.mjs): starts the batch lanes of the
// current wave of a fan-out manifest under a parallel limit, waits on lane
// dependencies, and keeps a launch state in the git common dir. It only reads
// the manifest; it never writes a tracked path or anything under a lane worktree.
// Why: specs/e443b-lane-launcher-architecture.md
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, resolveTicketDir } from "./config.js";
import { FANOUT_CODES, lanesSectionsWithoutWave, lookupTicketFiles, parseManifest, renderPrompt, resolveMailboxHeader, resolveWorktree, ticketIds, validateManifest, } from "./fanout-manifest.js";
import { HISTORY_BUCKET_RE, resolveLaneName } from "./lane-paths.js";
import { parseTicketFile } from "./ticket-file.js";
// --- §A constants, output lines, launch-state shape --------------------------
export const DEFAULT_LANE_LAUNCH_LIMIT = 3;
export const LAUNCH_STATE_FILE = "agc-lane-launch.json";
export const LAUNCH_LOCK_FILE = "agc-lane-launch.lock";
export const LAUNCH_STATE_VERSION = 1;
export const LAUNCH_STATUSES = ["running", "paused-weekly", "paused-stopped", "finished", "window-gone", "start-failed"];
export const POLL_INTERVAL_MS = 15_000;
export const SLASH_LINE = "/mcp__agent-governance-mcp__teamwork";
export const SEND_GAP_MS = 500;
export const READY_MARKER = "permissions on";
export const RESEND_BOUND = 3;
export const READY_TIMEOUT_MS = 120_000;
export const READY_POLL_MS = 1_000;
export const READY_SETTLE_MS = 6_000;
export const UNKNOWN_CHECK_MS = 5_000;
export const RESEND_GAP_MS = 10_000;
export const WAKE_LINE = "額度已恢復：先 tw_get_state，照 Crash-Resume 流程核對後從中斷處接續。";
/** The one table of host line prefixes the launcher matches in a window. */
export const HOST_SIGNALS = {
    weekly: "You've hit your weekly limit",
    continuing: "Continuing automatically at",
    stopped: "Automatic continue stopped after repeated usage-limit hits",
    enter: "Press enter to continue",
    unknown: "Unknown command",
};
/** Statuses that hold a parallel-limit slot. */
const SLOT_STATUSES = new Set(["running", "paused-weekly", "paused-stopped"]);
/** Statuses a run resumes in a new window. */
const RESUME_STATUSES = new Set(["window-gone", "start-failed"]);
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
    startFailed: (lane, why) => `start failed ${lane} — ${why}`,
    resumed: (lane, id) => `resumed ${lane} — window ${id} (its window was gone)`,
    woken: (lane, id) => `woken ${lane} — window ${id}`,
    entered: (lane) => `entered ${lane} — Press enter to continue`,
    pausedWeekly: (lane) => `paused ${lane} — weekly limit, no automatic wake`,
    pausedStopped: (lane) => `paused ${lane} — automatic continue stopped; re-run the launcher after the limit resets`,
    windowGone: (lane) => `window gone ${lane} — not finished; the next run resumes it`,
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
/** `--- msg` blocks: header closes at the first bare `---`, first key wins; body runs to the next `--- msg` line. */
export function parseMailboxMessages(text) {
    const out = [];
    let cur;
    const flush = () => { if (cur)
        out.push({ headers: cur.headers, body: cur.body.join("\n") }); };
    for (const line of text.split(/\r?\n/)) {
        if (/^--- msg(?:[ \t].*)?$/.test(line)) {
            flush();
            cur = { headers: Object.create(null), body: [], inHeader: true };
            continue;
        }
        if (!cur)
            continue;
        if (!cur.inHeader) {
            cur.body.push(line);
            continue;
        }
        if (line === "---") {
            cur.inHeader = false;
            continue;
        }
        const h = /^([a-z]+):\s?(.*)$/.exec(line);
        if (h && !Object.hasOwn(cur.headers, h[1]))
            cur.headers[h[1]] = h[2];
    }
    flush();
    return out;
}
const isReport = (msg) => msg.headers.type?.trim() === "report";
export function isLaneReport(msg) {
    return isReport(msg) && (msg.body.split("\n").find((l) => l.trim() !== "") ?? "").startsWith("## Lane report:");
}
export function laneTicketStatuses(worktree, ticketDirRel, ids) {
    const found = new Map();
    const dir = path.join(worktree, ticketDirRel);
    let names = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md");
    }
    catch { /* no worktree yet */ }
    for (const name of names) {
        let fields;
        try {
            fields = parseTicketFile(fs.readFileSync(path.join(dir, name), "utf8")).fields;
        }
        catch {
            continue;
        }
        if (typeof fields.id === "string" && typeof fields.status === "string")
            found.set(fields.id, fields.status);
    }
    return new Map(ids.map((id) => [id, found.get(id)]));
}
export function ticketsSettled(statuses) {
    const all = [...statuses.values()];
    const stopped = (s) => s !== undefined && /^stopped\s+—\s+\S/.test(s);
    return all.length > 0 && all.every((s) => s === "done" || stopped(s)) && all.some(stopped);
}
export function hasFinishRecord(primary, names) {
    const root = path.join(primary, ".current", "history");
    let buckets = [];
    try {
        buckets = fs.readdirSync(root).filter((b) => HISTORY_BUCKET_RE.test(b));
    }
    catch {
        return false;
    }
    return buckets.some((b) => names.some((n) => isDir(path.join(root, b, n))));
}
/** The lane id and the name `agc feature finish` derives from the branch slug. */
const recordNames = (lane) => [lane.lane, resolveLaneName(lane.branch.replace(/^feat\//, ""))];
export function probeFinished(input) {
    let text = "";
    try {
        if (input.mailboxFile !== undefined)
            text = fs.readFileSync(input.mailboxFile, "utf8");
    }
    catch { /* no messages yet */ }
    const reports = parseMailboxMessages(text).filter(isReport);
    const settled = input.worktree !== "" && ticketsSettled(laneTicketStatuses(input.worktree, input.ticketDirRel, ticketIds(input.lane.ticket)));
    let finished;
    if (reports.some(isLaneReport))
        finished = "lane report";
    else if (settled && reports.length > input.reportFloor)
        finished = "batch stop";
    else if (hasFinishRecord(input.primary, recordNames(input.lane)))
        finished = "finish record";
    return { finished, reportCount: reports.length, settled };
}
export function dependencyMet(input) {
    const { primary, dep, startRef } = input;
    const recorded = hasFinishRecord(primary, recordNames(dep));
    if (input.knowledgeLocal)
        return recorded ? { met: true } : { met: false, why: `agc feature finish --shipped has not run for ${dep.lane}` };
    if (input.git(["show-ref", "--verify", "--quiet", `refs/heads/${dep.branch}`], primary).status !== 0) {
        return recorded ? { met: true } : { met: false, why: `branch ${dep.branch} is gone and ${dep.lane} has no finish record` };
    }
    const r = input.ancestry([dep.branch], primary, startRef)[0];
    if (r?.isAncestor)
        return { met: true };
    if (r?.error !== undefined)
        return { met: false, why: `git: ${firstLine(r.error)}` };
    return { met: false, why: `branch ${dep.branch} is not an ancestor of ${startRef}` };
}
/** The manifest's `base:` for the lowest 波次, `main` for any later one. */
export function startRefFor(m, wave) {
    const lowest = Math.min(...m.dispatchable.map((l) => l.wave ?? Infinity));
    return wave === lowest && m.base !== undefined ? m.base : "main";
}
// --- §F the run ---------------------------------------------------------------
export function shellQuote(s) {
    return `'${s.replace(/'/g, "'\\''")}'`;
}
export function launchCommand(worktree, lane) {
    return `cd ${shellQuote(worktree)} && claude --permission-mode bypassPermissions -n ${lane}`;
}
const zeroSignals = () => ({ weekly: 0, continuing: 0, stopped: 0, enter: 0, unknown: 0 });
class LaunchRun {
    ctx;
    deps;
    config;
    m;
    state;
    stateFile;
    records;
    limit;
    ticketDirRel;
    mailboxRoot;
    constructor(ctx, deps, config, m, state, stateFile) {
        this.ctx = ctx;
        this.deps = deps;
        this.config = config;
        this.m = m;
        this.state = state;
        this.stateFile = stateFile;
        this.records = (state.manifests[ctx.manifestKey] ??= { lanes: {} }).lanes;
        this.limit = launchLimit(config);
        this.ticketDirRel = path.relative(ctx.primary, resolveTicketDir(ctx.primary));
        const mb = m.mailbox !== undefined ? resolveMailboxHeader(m.mailbox, ctx.primary) : undefined;
        this.mailboxRoot = mb?.ok ? mb.path : undefined;
    }
    update(lane, patch) {
        Object.assign(this.records[lane], patch, { updatedAt: new Date(this.deps.clock.now()).toISOString() });
        writeLaunchState(this.stateFile, this.state, this.deps.clock.now(), this.deps.pid);
    }
    probe(lane) {
        const wt = resolveWorktree(lane.worktree, this.ctx.primary);
        return probeFinished({
            primary: this.ctx.primary, lane, worktree: wt.ok ? wt.path : "", ticketDirRel: this.ticketDirRel,
            mailboxFile: this.mailboxRoot && path.join(this.mailboxRoot, lane.lane, "to-integrator.md"),
            reportFloor: this.records[lane.lane]?.reportFloor ?? 0,
        });
    }
    isFinished(lane) {
        return this.records[lane.lane]?.status === "finished" || this.probe(lane).finished !== undefined;
    }
    /**
     * One look at a recorded lane: finished frees it; unsettled tickets raise the report floor; a slot holder
     * whose window is gone becomes window-gone; a running lane's new signals pause it or get an Enter.
     */
    async observe(lane) {
        const rec = this.records[lane.lane];
        if (rec === undefined || rec.status === "finished")
            return;
        const p = this.probe(lane);
        if (p.finished !== undefined) {
            this.update(lane.lane, { status: "finished" });
            return this.deps.out(OUT.finished(lane.lane, p.finished));
        }
        if (!p.settled && p.reportCount > rec.reportFloor)
            this.update(lane.lane, { reportFloor: p.reportCount });
        if (!SLOT_STATUSES.has(rec.status))
            return;
        // A failed probe is not a closed window: only a definite false marks it gone.
        if (!(await this.deps.driver.exists(rec.windowId).catch(() => true))) {
            this.update(lane.lane, { status: "window-gone" });
            return this.deps.out(OUT.windowGone(lane.lane));
        }
        if (rec.status !== "running")
            return;
        let contents;
        try {
            contents = await this.deps.driver.contents(rec.windowId);
        }
        catch {
            return;
        }
        const s = newSignals(contents, rec.signals);
        if (s.stopped) {
            this.update(lane.lane, { status: "paused-stopped" });
            this.deps.out(OUT.pausedStopped(lane.lane));
        }
        else if (s.weekly) {
            this.update(lane.lane, { status: "paused-weekly" });
            this.deps.out(OUT.pausedWeekly(lane.lane));
        }
        else if (s.enter) {
            this.update(lane.lane, { signals: await sendEnter(this.deps.driver, rec.windowId) });
            this.deps.out(OUT.entered(lane.lane));
        }
    }
    /** The wake line into a paused-stopped lane's own window (observe just saw it exists); a weekly pause is never woken. */
    async wake(lane) {
        const rec = this.records[lane.lane];
        if (rec?.status !== "paused-stopped")
            return;
        const signals = await sendText(this.deps.driver, this.deps.clock, rec.windowId, WAKE_LINE);
        this.update(lane.lane, { status: "running", signals, reportFloor: this.probe(lane).reportCount });
        this.deps.out(OUT.woken(lane.lane, rec.windowId));
    }
    slotsOpen(wave) {
        return this.limit - this.m.dispatchable.filter((l) => l.wave === wave && SLOT_STATUSES.has(this.records[l.lane]?.status ?? "finished")).length;
    }
    /** New lanes of `wave` that may start: no record, not finished, every dependency met, batch lanes only. */
    plan(wave) {
        const startRef = startRefFor(this.m, wave);
        const queue = [];
        for (const lane of this.m.dispatchable.filter((l) => l.wave === wave)) {
            if (this.records[lane.lane] !== undefined || this.isFinished(lane))
                continue;
            let met = true;
            for (const id of lane.depLanes ?? []) {
                const dep = this.m.dispatchable.find((d) => d.lane === id);
                if (dep === undefined)
                    continue;
                const c = dependencyMet({ primary: this.ctx.primary, dep, startRef, knowledgeLocal: this.config.knowledge === "local", git: this.deps.git, ancestry: this.deps.ancestry });
                if (!c.met) {
                    this.deps.out(OUT.waiting(lane.lane, id, c.why));
                    met = false;
                }
            }
            if (!met)
                continue;
            if (lane.approval === "human") {
                this.deps.out(OUT.notStarted(lane.lane, "approval is human"));
                continue;
            }
            const absent = ticketIds(lane.ticket).find((id) => {
                const r = lookupTicketFiles(this.ctx.primary, [id]);
                return !r.ok && r.errors.some((e) => e.code === FANOUT_CODES.ticketFileAbsent);
            });
            if (absent !== undefined) {
                this.deps.out(OUT.notStarted(lane.lane, `no ticket file for ${absent}`));
                continue;
            }
            queue.push(lane);
        }
        return queue;
    }
    worktreeListed(worktree) {
        const r = this.deps.git(["worktree", "list", "--porcelain"], this.ctx.primary);
        const want = realOr(worktree);
        return r.stdout.split("\n").some((l) => l.startsWith("worktree ") && realOr(l.slice("worktree ".length)) === want);
    }
    async start(lane, wave) {
        const { primary } = this.ctx;
        const startRef = startRefFor(this.m, wave);
        const sha = this.deps.git(["rev-parse", "--verify", "--quiet", `${startRef}^{commit}`], primary);
        const baseSha = sha.status === 0 && sha.stdout.trim() !== "" ? sha.stdout.trim() : startRef;
        const r = renderPrompt(this.m, lane.lane, { batch: true, base: baseSha, primary });
        const wt = resolveWorktree(lane.worktree, primary);
        if (!r.ok || !wt.ok)
            return this.deps.out(OUT.notStarted(lane.lane, `render failed: ${!r.ok ? r.errors[0]?.code : wt.ok ? "" : wt.code}`));
        if (!this.worktreeListed(wt.path)) {
            const fsr = this.deps.featureStart({ primary, slug: lane.branch.replace(/^feat\//, ""), base: startRef, worktree: wt.path });
            if (!fsr.ok)
                return this.deps.out(OUT.notStarted(lane.lane, `agc feature start failed: ${fsr.firstLine}`));
        }
        await this.session(lane, wave, baseSha, wt.path, r.prompt, OUT.started);
    }
    /** A window-gone or start-failed lane in a new window: the recorded baseSha renders the same prompt; no feature start. */
    async resume(lane, rec) {
        const r = renderPrompt(this.m, lane.lane, { batch: true, base: rec.baseSha, primary: this.ctx.primary });
        const wt = resolveWorktree(lane.worktree, this.ctx.primary);
        if (!r.ok || !wt.ok)
            return this.deps.out(OUT.notStarted(lane.lane, `render failed: ${!r.ok ? r.errors[0]?.code : wt.ok ? "" : wt.code}`));
        await this.session(lane, rec.wave, rec.baseSha, wt.path, r.prompt, OUT.resumed);
    }
    /** Opens the window, records `running` at once, then startSession; a failure records start-failed and frees the slot. */
    async session(lane, wave, baseSha, worktree, prompt, line) {
        const windowId = await this.deps.driver.open(launchCommand(worktree, lane.lane));
        this.records[lane.lane] = { status: "running", wave, windowId, baseSha, signals: zeroSignals(), reportFloor: this.probe(lane).reportCount, updatedAt: "" };
        this.update(lane.lane, {});
        const s = await startSession(this.deps.driver, this.deps.clock, windowId, prompt);
        if (!s.ok) {
            this.update(lane.lane, { status: "start-failed", reason: s.why });
            return this.deps.out(OUT.startFailed(lane.lane, s.why));
        }
        this.update(lane.lane, { signals: s.signals });
        this.deps.out(line(lane.lane, windowId));
    }
    /** Resumes and new starts in queue order while a slot is open; a lane finished while queued is dropped. */
    async fill(queue, wave) {
        while (queue.length > 0 && this.slotsOpen(wave) > 0) {
            const lane = queue.shift();
            const rec = this.records[lane.lane];
            if (rec === undefined)
                await this.start(lane, wave);
            else if (RESUME_STATUSES.has(rec.status))
                await this.resume(lane, rec);
        }
    }
    async run() {
        const lanes = this.m.dispatchable;
        for (const lane of lanes)
            await this.observe(lane);
        for (const lane of lanes)
            await this.wake(lane);
        const waves = [...new Set(lanes.map((l) => l.wave ?? 0))].sort((a, b) => a - b);
        const wave = waves.find((w) => lanes.some((l) => l.wave === w && !this.isFinished(l)));
        if (wave === undefined) {
            this.deps.out(OUT.exit(waves.at(-1) ?? 0));
            return 0;
        }
        for (const w of waves)
            if (w > wave)
                this.deps.out(OUT.laterWave(w, wave));
        const resumable = lanes.filter((l) => l.wave === wave && RESUME_STATUSES.has(this.records[l.lane]?.status ?? "finished"));
        const queue = [...resumable, ...this.plan(wave)];
        await this.fill(queue, wave);
        for (const l of queue)
            this.deps.out(OUT.queued(l.lane, this.limit));
        const running = () => lanes.some((l) => l.wave === wave && this.records[l.lane]?.status === "running");
        while (running()) {
            await this.deps.clock.sleep(POLL_INTERVAL_MS);
            for (const lane of lanes)
                if (lane.wave === wave)
                    await this.observe(lane);
            await this.fill(queue, wave);
        }
        this.deps.out(OUT.exit(wave));
        return 0;
    }
}
/** Whole run: refusals, lock, launch state, then the wave. Returns 0, or 1 on a refusal; a clock error propagates. */
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
        return await new LaunchRun(ctx, deps, config, parseManifest(text), read.state, files.state).run();
    }
    finally {
        lock.release();
    }
}
// --- §G window sends and lane start ------------------------------------------
/** Lines of a window's text, leading whitespace and UI glyphs (box drawing, bullets) stripped. */
export function signalLines(contents) {
    return contents.split(/\r?\n/).map((l) => l.replace(/^[^\p{L}\p{N}]+/u, ""));
}
const SIGNAL_KEYS = Object.keys(HOST_SIGNALS);
const signalOf = (line) => SIGNAL_KEYS.find((k) => line.startsWith(HOST_SIGNALS[k]));
export function signalCounts(contents) {
    const counts = zeroSignals();
    for (const line of signalLines(contents)) {
        const k = signalOf(line);
        if (k !== undefined)
            counts[k]++;
    }
    return counts;
}
/** A signal is new when its count is above `baseline`; a new weekly line counts only with no `continuing` line after the last weekly line. */
export function newSignals(contents, baseline) {
    const now = signalCounts(contents);
    const kinds = signalLines(contents).map(signalOf);
    const lastWeekly = kinds.lastIndexOf("weekly");
    const above = (k) => now[k] > baseline[k];
    return {
        weekly: above("weekly") && !kinds.slice(lastWeekly + 1).includes("continuing"),
        stopped: above("stopped"), enter: above("enter"), unknown: above("unknown"),
    };
}
/** Phase 0 send method: text with newline NO, 0.5 s, then an empty write text. Returns the counts read just before (the new baseline). */
export async function sendText(driver, clock, windowId, text) {
    const before = signalCounts(await driver.contents(windowId));
    await driver.writeText(windowId, text, false);
    await clock.sleep(SEND_GAP_MS);
    await driver.writeText(windowId, "", true);
    return before;
}
/** One empty write text; returns the new baseline. */
export async function sendEnter(driver, windowId) {
    const before = signalCounts(await driver.contents(windowId));
    await driver.writeText(windowId, "", true);
    return before;
}
/** Ready wait, settle, slash line (resent on a new `Unknown command`, at most RESEND_BOUND times), then the prompt in one send. */
export async function startSession(driver, clock, windowId, prompt) {
    const deadline = clock.now() + READY_TIMEOUT_MS;
    const read = () => driver.contents(windowId).catch(() => "");
    while (!(await read()).includes(READY_MARKER)) {
        if (clock.now() >= deadline)
            return { ok: false, why: `not ready after ${READY_TIMEOUT_MS / 1000} s` };
        await clock.sleep(READY_POLL_MS);
    }
    await clock.sleep(READY_SETTLE_MS);
    let baseline = await sendText(driver, clock, windowId, SLASH_LINE);
    for (let resends = 0;; resends++) {
        await clock.sleep(UNKNOWN_CHECK_MS);
        if (!newSignals(await read(), baseline).unknown)
            break;
        if (resends === RESEND_BOUND)
            return { ok: false, why: `Unknown command after ${RESEND_BOUND} resends` };
        await clock.sleep(RESEND_GAP_MS - UNKNOWN_CHECK_MS);
        baseline = await sendText(driver, clock, windowId, SLASH_LINE);
    }
    return { ok: true, signals: await sendText(driver, clock, windowId, prompt) };
}
/** Argv for the real `agc feature start` runner, spawned with process.execPath from primary. */
export function featureStartArgv(installRoot, req) {
    return [path.join(installRoot, "bin", "agc-init.mjs"), "feature", "start", req.slug, "--base", req.base, "--path", req.worktree];
}
//# sourceMappingURL=lane-launch.js.map