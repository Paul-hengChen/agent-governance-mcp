// Coded by @sr-engineer
// Conductor window script core (scripts/conductor.mjs): opens, closes and wakes
// the integrator session of each wave of a fan-out manifest, keeps its state and
// mailbox in the git common dir, and checks a wave-done report before closing.
// Why: specs/e466-conductor-architecture.md
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWaveDoneAt } from "./config.js";
import { parseManifest } from "./fanout-manifest.js";
import { EXIT_LINE, OUT as LAUNCH_OUT, READY_MARKER, READY_POLL_MS, READY_SETTLE_MS, READY_TIMEOUT_MS, RESEND_BOUND, RESEND_GAP_MS, UNKNOWN_CHECK_MS, WAKE_LINE, createHostDeps, createItermDriver, launchCommand, newSignals, parseMailboxMessages, resolveLaunchContext, runLaneLaunch, sendText, } from "./lane-launch.js";
// --- §A constants, output lines, state shape -----------------------------------
export const CONDUCTOR_STATE_FILE = "agc-conductor.json";
export const CONDUCTOR_MAILBOX_DIR = "agc-conductor";
export const CONDUCTOR_STATE_VERSION = 1;
export const INTEGRATOR_SLASH_LINE = "/mcp__agent-governance-mcp__integrator";
export const CONDUCTOR_USAGE = "usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check";
export const fanoutLine = (record) => `fan-out ${record}`;
export const takeoverLine = (manifest, n) => `接手 ${manifest}，開始第 ${n} 波次`;
export const CONDUCTOR_STEPS = ["opening", "integrator-open", "wave-closed", "integrator-gone", "done"];
const DASH = "—";
const orDash = (v) => v ?? DASH;
export const CONDUCTOR_OUT = {
    opened: (n, id) => `opened integrator — wave ${n}, window ${id}`,
    closed: (id) => `closed integrator — window ${id}`,
    woken: (id) => `woken integrator — window ${id}`,
    unmet: (n, fact) => `wave ${n} not done — ${fact}; integrator kept open`,
    allDone: (manifest) => `all waves done — ${manifest}`,
    gone: (n, what, id) => `integrator gone — wave ${n} of ${what}, window ${id}; no new window opened`,
    ok: (n, id) => `integrator alive — wave ${n}, window ${id}`,
    factPr: (pr, state, waveDoneAt) => `pull request #${pr} is ${state}, waveDoneAt ${waveDoneAt} needs ${waveDoneAt === "pr-open" ? "OPEN/MERGED" : "MERGED"}`,
    factHandoff: (manifest, code) => `fanout.mjs handoff --check ${manifest} exited ${code}`,
    factReport: (n, manifest, pr) => `the wave-done report does not read "wave ${n} of ${manifest}, pull request #${pr}"`,
    replyUnmet: (n, facts) => `Wave ${n} is not done yet: ${facts.join("; ")}. Fix it and send the wave-done report again.`,
    stateLine,
    refused: (reason) => `conductor: refused — ${reason}`,
    refusedOpen: (id) => `an integrator is already open — window ${id}; close it first`,
    refusedNoWindow: "no integrator window is recorded",
    refusedWindowGone: (id) => `integrator window ${id} does not exist`,
    refusedNotReady: (id, s) => `integrator window ${id} not ready after ${s} s`,
    refusedUnknown: (id, n) => `integrator window ${id}: Unknown command after ${n} resends`,
    refusedStep: (step) => `wave-done needs step integrator-open or wave-closed, not ${step}`,
    refusedNotRepo: (dir) => `${dir} is not inside a git repository`,
};
export function stateLine(state, paths) {
    const s = state;
    return `conductor: manifest ${orDash(s?.manifest)} record ${orDash(s?.record)} wave ${s?.wave ?? 0} window ${orDash(s?.windowId)} ` +
        `step ${s?.step ?? "none"} mailbox ${paths.mailboxDir}`;
}
const realOr = (p) => { try {
    return fs.realpathSync(p);
}
catch {
    return path.resolve(p);
} };
const firstLine = (s) => s.trim().split("\n")[0] ?? "";
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const strOrNull = (v) => v === null || typeof v === "string";
/** Same two git calls as resolveLaunchContext, from `cwd`. */
export function resolveConductorContext(cwd, git) {
    const notRepo = { error: CONDUCTOR_OUT.refusedNotRepo(cwd) };
    const list = git(["worktree", "list", "--porcelain"], cwd);
    const line = list.status === 0 ? list.stdout.split("\n").find((l) => l.startsWith("worktree ")) : undefined;
    if (line === undefined)
        return notRepo;
    const primary = line.slice("worktree ".length);
    const common = git(["rev-parse", "--git-common-dir"], primary);
    if (common.status !== 0)
        return notRepo;
    return { primary, gitCommonDir: realOr(path.resolve(primary, common.stdout.trim())) };
}
export function conductorPaths(gitCommonDir) {
    const mailboxDir = path.join(gitCommonDir, CONDUCTOR_MAILBOX_DIR);
    return {
        state: path.join(gitCommonDir, CONDUCTOR_STATE_FILE),
        mailboxDir,
        toLane: path.join(mailboxDir, "to-lane.md"),
        toIntegrator: path.join(mailboxDir, "to-integrator.md"),
    };
}
function isState(v) {
    return isObj(v) && v.version === CONDUCTOR_STATE_VERSION && strOrNull(v.record) && strOrNull(v.manifest) &&
        Number.isInteger(v.wave) && strOrNull(v.windowId) && CONDUCTOR_STEPS.includes(v.step) &&
        Number.isInteger(v.reportFloor) && typeof v.updatedAt === "string";
}
/** Absent file → no run recorded; anything unreadable is refused, never overwritten. */
export function readConductorState(file) {
    if (!fs.existsSync(file))
        return { ok: true, state: undefined };
    const bad = { ok: false, error: `the conductor state ${file} does not parse; move it aside` };
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch {
        return bad;
    }
    return isState(raw) ? { ok: true, state: raw } : bad;
}
export function writeConductorState(file, state) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
    fs.renameSync(tmp, file);
}
export function ensureConductorMailbox(paths) {
    fs.mkdirSync(paths.mailboxDir, { recursive: true });
    for (const f of [paths.toLane, paths.toIntegrator])
        fs.writeFileSync(f, "", { flag: "a" });
}
/** Primary-relative, `/`-separated key of `p` (realpath on both sides). */
export function toPrimaryKey(primary, p) {
    return path.relative(realOr(primary), realOr(p)).split(path.sep).join("/");
}
const readText = (file) => { try {
    return fs.readFileSync(file, "utf8");
}
catch {
    return "";
} };
// --- §C report parser and fact decision -------------------------------------------
const FIRST_ITEM_PREFIX = "- 做了什麼：";
const FIRST_ITEM_RE = /^- 做了什麼：wave (\d+) of (\S+), pull request #(\d+)\s*$/;
export function parseWaveDoneFirstItem(body) {
    const line = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(FIRST_ITEM_PREFIX));
    const m = line === undefined ? null : FIRST_ITEM_RE.exec(line);
    if (!m)
        return undefined;
    const wave = Number(m[1]);
    const pr = Number(m[3]);
    return Number.isSafeInteger(wave) && Number.isSafeInteger(pr) ? { wave, manifest: m[2], pr } : undefined;
}
const isWaveDone = (msg) => msg.headers.type?.trim() === "report" && (msg.headers.re ?? "").trim().startsWith("wave-done");
/** The newest wave-done report at index >= floor. */
export function findWaveDoneReport(messages, floor) {
    for (let i = messages.length - 1; i >= Math.max(0, floor); i--) {
        if (isWaveDone(messages[i]))
            return { index: i, msg: messages[i] };
    }
    return undefined;
}
export function hasWaveDoneReport(messages, floor) {
    return findWaveDoneReport(messages, floor) !== undefined;
}
export function prFactMet(state, waveDoneAt) {
    return state === "MERGED" || (waveDoneAt === "pr-open" && state === "OPEN");
}
/** Smallest 波次 above `wave` among the manifest's dispatchable lanes. */
export function nextWave(manifestText, wave) {
    const later = parseManifest(manifestText).dispatchable.map((l) => l.wave).filter((w) => w !== undefined && w > wave);
    return later.length === 0 ? undefined : Math.min(...later);
}
const formatUtcSecond = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
/** Same block format as `mailbox-watch.mjs --send`, with `from: conductor`, `type: reply`, `hop: —`. */
export function appendConductorReply(file, input) {
    const existing = readText(file);
    let max = 0;
    for (const m of parseMailboxMessages(existing)) {
        const n = Number.parseInt(m.headers.seq ?? "", 10);
        if (Number.isInteger(n) && n > max)
            max = n;
    }
    const block = `--- msg\nseq: ${max + 1}\nfrom: conductor\ntype: reply\nre: ${input.re}\ntime: ${formatUtcSecond(input.time)}\nhop: ${DASH}\n---\n${input.body}\n`;
    const sep = existing === "" ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, sep + block, "utf8");
}
function load(ctx, deps) {
    const paths = conductorPaths(ctx.gitCommonDir);
    const r = readConductorState(paths.state);
    if (!r.ok) {
        deps.err(CONDUCTOR_OUT.refused(r.error));
        return { ok: false };
    }
    return { ok: true, paths, state: r.state };
}
function save(paths, deps, state) {
    const full = { version: CONDUCTOR_STATE_VERSION, ...state, updatedAt: deps.now().toISOString() };
    writeConductorState(paths.state, full);
    return full;
}
const isOpenStep = (step) => step === "opening" || step === "integrator-open";
/** Ready wait, settle, integrator slash line (resent on a new `Unknown command`), as the launcher's startSession. */
async function startIntegrator(deps, id, line) {
    const { driver, clock } = deps;
    const deadline = clock.now() + READY_TIMEOUT_MS;
    const read = () => driver.contents(id).catch(() => "");
    while (!(await read()).includes(READY_MARKER)) {
        if (clock.now() >= deadline)
            return CONDUCTOR_OUT.refusedNotReady(id, READY_TIMEOUT_MS / 1000);
        await clock.sleep(READY_POLL_MS);
    }
    await clock.sleep(READY_SETTLE_MS);
    let baseline = await sendText(driver, clock, id, INTEGRATOR_SLASH_LINE);
    for (let resends = 0;; resends++) {
        await clock.sleep(UNKNOWN_CHECK_MS);
        if (!newSignals(await read(), baseline).unknown)
            break;
        if (resends === RESEND_BOUND)
            return CONDUCTOR_OUT.refusedUnknown(id, RESEND_BOUND);
        await clock.sleep(RESEND_GAP_MS - UNKNOWN_CHECK_MS);
        baseline = await sendText(driver, clock, id, INTEGRATOR_SLASH_LINE);
    }
    await sendText(driver, clock, id, line);
    return undefined;
}
export async function conductorOpen(ctx, deps, target) {
    const l = load(ctx, deps);
    if (!l.ok)
        return 1;
    const { paths, state } = l;
    if (state && isOpenStep(state.step) && state.windowId !== null && (await deps.driver.exists(state.windowId))) {
        deps.err(CONDUCTOR_OUT.refused(CONDUCTOR_OUT.refusedOpen(state.windowId)));
        return 1;
    }
    ensureConductorMailbox(paths);
    const reportFloor = parseMailboxMessages(readText(paths.toLane)).length;
    const isRecord = "record" in target;
    const record = isRecord ? toPrimaryKey(ctx.primary, target.record) : state?.record ?? null;
    const manifest = isRecord ? null : toPrimaryKey(ctx.primary, target.manifest);
    const wave = isRecord ? 1 : target.wave;
    const id = await deps.driver.open(launchCommand(ctx.primary, "integrator"));
    const base = { record, manifest, wave, windowId: id, reportFloor };
    save(paths, deps, { ...base, step: "opening" });
    const line = manifest === null ? fanoutLine(record ?? "") : takeoverLine(manifest, wave);
    const refusal = await startIntegrator(deps, id, line);
    if (refusal !== undefined) {
        deps.err(CONDUCTOR_OUT.refused(refusal));
        return 1;
    }
    save(paths, deps, { ...base, step: "integrator-open" });
    deps.out(CONDUCTOR_OUT.opened(wave, id));
    return 0;
}
/** Shared guard of close / wake: a recorded window that still exists. */
async function liveWindow(ctx, deps) {
    const l = load(ctx, deps);
    if (!l.ok)
        return undefined;
    const id = l.state?.windowId ?? null;
    if (l.state === undefined || id === null) {
        deps.err(CONDUCTOR_OUT.refused(CONDUCTOR_OUT.refusedNoWindow));
        return undefined;
    }
    if (!(await deps.driver.exists(id))) {
        deps.err(CONDUCTOR_OUT.refused(CONDUCTOR_OUT.refusedWindowGone(id)));
        return undefined;
    }
    return { paths: l.paths, state: l.state, id };
}
export async function conductorClose(ctx, deps) {
    const w = await liveWindow(ctx, deps);
    if (w === undefined)
        return 1;
    await sendText(deps.driver, deps.clock, w.id, EXIT_LINE);
    const { version: _v, updatedAt: _u, ...rest } = w.state;
    save(w.paths, deps, rest);
    deps.out(CONDUCTOR_OUT.closed(w.id));
    return 0;
}
export async function conductorWake(ctx, deps) {
    const w = await liveWindow(ctx, deps);
    if (w === undefined)
        return 1;
    await sendText(deps.driver, deps.clock, w.id, WAKE_LINE);
    deps.out(CONDUCTOR_OUT.woken(w.id));
    return 0;
}
export function conductorState(ctx, deps) {
    const l = load(ctx, deps);
    if (!l.ok)
        return 1;
    deps.out(stateLine(l.state, l.paths));
    return 0;
}
/** Key of a report's manifest when it names a readable file inside primary. */
function manifestKeyIn(primary, named) {
    if (path.isAbsolute(named))
        return undefined;
    const key = toPrimaryKey(primary, path.resolve(primary, named));
    if (key === "" || key.startsWith("..") || path.isAbsolute(key))
        return undefined;
    try {
        return fs.statSync(path.join(primary, key)).isFile() ? key : undefined;
    }
    catch {
        return undefined;
    }
}
export async function conductorWaveDone(ctx, deps) {
    const l = load(ctx, deps);
    if (!l.ok)
        return 1;
    const { paths } = l;
    const state = l.state;
    if (state === undefined || !(isOpenStep(state.step) || state.step === "wave-closed")) {
        deps.err(CONDUCTOR_OUT.refused(CONDUCTOR_OUT.refusedStep(state?.step ?? "none")));
        return 1;
    }
    const n = state.wave;
    let manifest = state.manifest;
    if (state.step !== "wave-closed") {
        const messages = parseMailboxMessages(readText(paths.toLane));
        const found = findWaveDoneReport(messages, state.reportFloor);
        const parsed = found === undefined ? undefined : parseWaveDoneFirstItem(found.msg.body);
        const re = found === undefined ? `wave-done ${n}` : `to-lane#${found.msg.headers.seq?.trim() ?? found.index + 1}`;
        const unmet = (facts) => {
            appendConductorReply(paths.toIntegrator, { re, body: CONDUCTOR_OUT.replyUnmet(n, facts), time: deps.now() });
            for (const f of facts)
                deps.err(CONDUCTOR_OUT.unmet(n, f));
            return 1;
        };
        const reportFact = CONDUCTOR_OUT.factReport(n, manifest ?? "<manifest>", "<number>");
        if (parsed === undefined)
            return unmet([reportFact]);
        const parsedKey = manifestKeyIn(ctx.primary, parsed.manifest);
        if (parsed.wave !== n || parsedKey === undefined || (manifest !== null && parsedKey !== manifest))
            return unmet([reportFact]);
        manifest = parsedKey;
        const manifestAbs = path.join(ctx.primary, manifest);
        const resolved = resolveWaveDoneAt(ctx.primary);
        if (resolved.rejected !== undefined)
            deps.err(LAUNCH_OUT.waveDoneInvalid(resolved.rejected));
        const facts = [];
        const pr = deps.prState(parsed.pr, ctx.primary);
        if (!pr.ok)
            deps.err(pr.why);
        if (!pr.ok || !prFactMet(pr.state, resolved.waveDoneAt))
            facts.push(CONDUCTOR_OUT.factPr(parsed.pr, pr.ok ? pr.state : "unknown", resolved.waveDoneAt));
        const code = deps.handoffCheck(manifestAbs, ctx.primary);
        if (code !== 0)
            facts.push(CONDUCTOR_OUT.factHandoff(manifest, code));
        if (facts.length > 0)
            return unmet(facts);
        if (state.windowId !== null && (await deps.driver.exists(state.windowId))) {
            await sendText(deps.driver, deps.clock, state.windowId, EXIT_LINE);
            deps.out(CONDUCTOR_OUT.closed(state.windowId));
        }
        const { version: _v, updatedAt: _u, ...rest } = state;
        save(paths, deps, { ...rest, manifest, step: "wave-closed" });
    }
    if (manifest === null) {
        deps.err(CONDUCTOR_OUT.refused(CONDUCTOR_OUT.refusedStep(state.step)));
        return 1;
    }
    const manifestAbs = path.join(ctx.primary, manifest);
    await deps.closeFinished(manifestAbs);
    const k = nextWave(readText(manifestAbs), n);
    if (k !== undefined)
        return conductorOpen(ctx, deps, { manifest: manifestAbs, wave: k });
    const after = readConductorState(paths.state);
    const cur = after.ok && after.state ? after.state : state;
    const { version: _v, updatedAt: _u, ...rest } = cur;
    save(paths, deps, { ...rest, manifest, step: "done" });
    deps.out(CONDUCTOR_OUT.allDone(manifest));
    return 0;
}
export async function conductorCheck(ctx, deps) {
    const l = load(ctx, deps);
    if (!l.ok)
        return 1;
    const { paths, state } = l;
    if (state === undefined || !isOpenStep(state.step) || state.windowId === null) {
        deps.out(stateLine(state, paths));
        return 0;
    }
    if (await deps.driver.exists(state.windowId)) {
        deps.out(CONDUCTOR_OUT.ok(state.wave, state.windowId));
        return 0;
    }
    if (hasWaveDoneReport(parseMailboxMessages(readText(paths.toLane)), state.reportFloor)) {
        deps.out(stateLine(state, paths));
        return 0;
    }
    deps.err(CONDUCTOR_OUT.gone(state.wave, state.manifest ?? state.record ?? DASH, state.windowId));
    const { version: _v, updatedAt: _u, ...rest } = state;
    save(paths, deps, { ...rest, step: "integrator-gone" });
    return 1;
}
const BARE = new Set(["state", "close", "wake", "wave-done", "check"]);
const WAVE_RE = /^[1-9]\d*$/;
export function parseConductorArgv(argv) {
    const [cmd, ...rest] = argv;
    if (cmd === undefined)
        return undefined;
    if (BARE.has(cmd))
        return rest.length === 0 ? { cmd } : undefined;
    if (cmd !== "open")
        return undefined;
    if (rest.length === 2 && rest[0] === "--record" && rest[1] !== "")
        return { cmd: "open", target: { record: rest[1] } };
    if (rest.length !== 4)
        return undefined;
    const flags = new Map();
    for (let i = 0; i < 4; i += 2) {
        if ((rest[i] !== "--manifest" && rest[i] !== "--wave") || flags.has(rest[i]))
            return undefined;
        flags.set(rest[i], rest[i + 1]);
    }
    const manifest = flags.get("--manifest");
    const wave = flags.get("--wave");
    if (manifest === undefined || manifest === "" || wave === undefined || !WAVE_RE.test(wave))
        return undefined;
    const n = Number(wave);
    return Number.isSafeInteger(n) ? { cmd: "open", target: { manifest, wave: n } } : undefined;
}
/** argv → exit code 0 / 1 / 2; exit-1 lines go to `deps.err`. */
export async function runConductorCli(argv, deps, cwd) {
    const parsed = parseConductorArgv(argv);
    if (parsed === undefined) {
        deps.err(CONDUCTOR_USAGE);
        return 2;
    }
    let command = parsed;
    if (command.cmd === "open") {
        const t = command.target;
        const given = "record" in t ? t.record : t.manifest;
        const abs = path.resolve(cwd, given);
        try {
            fs.readFileSync(abs);
        }
        catch (e) {
            deps.err(`conductor: cannot read ${given}: ${firstLine(e.message)}`);
            deps.err(CONDUCTOR_USAGE);
            return 2;
        }
        command = { cmd: "open", target: "record" in t ? { record: abs } : { manifest: abs, wave: t.wave } };
    }
    const ctx = resolveConductorContext(cwd, deps.git);
    if ("error" in ctx) {
        deps.err(CONDUCTOR_OUT.refused(ctx.error));
        return 1;
    }
    switch (command.cmd) {
        case "state": return conductorState(ctx, deps);
        case "open": return conductorOpen(ctx, deps, command.target);
        case "close": return conductorClose(ctx, deps);
        case "wake": return conductorWake(ctx, deps);
        case "wave-done": return conductorWaveDone(ctx, deps);
        case "check": return conductorCheck(ctx, deps);
    }
}
// --- §F host deps ---------------------------------------------------------------------
const INSTALL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Real seams: iTerm2 driver (used only by commands that act on a window), gh, fanout.mjs, the real launcher. */
export function createConductorHostDeps() {
    const err = (line) => { process.stderr.write(`${line}\n`); };
    return {
        driver: createItermDriver(),
        clock: { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
        git: (args, cwd) => {
            const r = spawnSync("git", args, { cwd, encoding: "utf8" });
            return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
        },
        prState: (pr, cwd) => {
            const r = spawnSync("gh", ["pr", "view", String(pr), "--json", "state"], { cwd, encoding: "utf8" });
            if (r.status === 0) {
                try {
                    const state = JSON.parse(r.stdout).state;
                    if (typeof state === "string")
                        return { ok: true, state };
                }
                catch { /* falls through to the failure below */ }
            }
            return { ok: false, why: firstLine(r.stderr || r.stdout || String(r.error ?? `exit ${r.status}`)) };
        },
        handoffCheck: (manifestAbs, primary) => spawnSync(process.execPath, [path.join(INSTALL_ROOT, "scripts", "fanout.mjs"), "handoff", "--check", manifestAbs], {
            cwd: primary, stdio: ["ignore", "inherit", "inherit"],
        }).status ?? 1,
        closeFinished: async (manifestAbs) => {
            const launch = createHostDeps();
            const ctx = resolveLaunchContext(manifestAbs, launch.git);
            if ("error" in ctx) {
                launch.err(`lane-launch: ${ctx.error}`);
                return 1;
            }
            return runLaneLaunch(ctx, launch, { closeFinished: true });
        },
        out: (line) => { process.stdout.write(`${line}\n`); },
        err,
        now: () => new Date(),
    };
}
//# sourceMappingURL=conductor.js.map