// Coded by @sr-engineer
// Lane launcher core (scripts/lane-launch.mjs): starts the batch lanes of the
// current wave of a fan-out manifest under a parallel limit, waits on lane
// dependencies, and keeps a launch state in the git common dir. It only reads
// the manifest; it never writes a tracked path or anything under a lane worktree.
// Why: specs/e443b-lane-launcher-architecture.md

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, resolveTicketDir, type WorkspaceConfig } from "./config.js";
import {
  FANOUT_CODES, lanesSectionsWithoutWave, lookupTicketFiles, parseManifest, renderPrompt, resolveMailboxHeader, resolveWorktree,
  ticketIds, validateManifest, type DispatchableLane, type Manifest,
} from "./fanout-manifest.js";
import type { LaneAncestryResult } from "./join-precondition.js";
import { HISTORY_BUCKET_RE, resolveLaneName } from "./lane-paths.js";
import { parseTicketFile } from "./ticket-file.js";

// --- §A constants, output lines, launch-state shape --------------------------

export const DEFAULT_LANE_LAUNCH_LIMIT = 3;
export const LAUNCH_STATE_FILE = "agc-lane-launch.json";
export const LAUNCH_LOCK_FILE = "agc-lane-launch.lock";
export const LAUNCH_STATE_VERSION = 1;
export const LAUNCH_STATUSES = ["running", "paused-weekly", "paused-stopped", "finished", "window-gone", "start-failed"] as const;
export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];
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
} as const;
export type HostSignal = keyof typeof HOST_SIGNALS;
export type SignalCounts = Record<HostSignal, number>;
/** Statuses that hold a parallel-limit slot. */
const SLOT_STATUSES: ReadonlySet<LaunchStatus> = new Set(["running", "paused-weekly", "paused-stopped"]);

export type FinishedHow = "lane report" | "batch stop" | "finish record";
export const OUT = {
  refused: (reason: string) => `lane-launch: refused — ${reason}`,
  refusedNoWave: "the manifest has no 波次 column; add it at Stage 1 or start the lanes by hand",
  refusedNoHuman: "the manifest has no 人類 Decisions row",
  refusedTier: "cutApprovalAutoTier.manifest is not true in .current/.config.json",
  refusedSameWave: (lane: string, dep: string, wave: number) => `lane ${lane} depends on ${dep} in the same wave ${wave}; move ${lane} to a later wave`,
  refusedInvalid: (code: string, message: string) => `the manifest does not validate: ${code} ${message}`,
  refusedBusy: (pid: number) => `another lane-launch run is active (pid ${pid}); stop it first`,
  started: (lane: string, id: string) => `started ${lane} — window ${id}`,
  queued: (lane: string, limit: number) => `queued ${lane} — parallel limit ${limit}`,
  waiting: (lane: string, dep: string, why: string) => `waiting ${lane} — depends on ${dep}: ${why}`,
  notStarted: (lane: string, why: string) => `not started ${lane} — ${why}`,
  finished: (lane: string, how: FinishedHow) => `finished ${lane} — ${how}`,
  laterWave: (n: number, m: number) => `wave ${n} waits until every lane of wave ${m} is finished`,
  exit: (n: number) => `lane-launch: no lane of wave ${n} is running — exiting`,
};

export interface LaneLaunchRecord {
  status: LaunchStatus;
  wave: number;
  /** Window id as text (a record is first written right after the window opens). */
  windowId: string;
  /** Full sha the lane's render used; a resume re-renders with it, so the prompt is byte-identical. */
  baseSha: string;
  /** Count of each host signal line in the window just before the last send to it. */
  signals: SignalCounts;
  /** `type: report` messages seen at the last observation of the lane's tickets not settled. */
  reportFloor: number;
  /** `start-failed` only: why the start failed. */
  reason?: string;
  updatedAt: string;
}
export interface ManifestLaunchState { lanes: Record<string, LaneLaunchRecord> }
export interface LaunchState {
  version: 1;
  /** Keyed by the manifest path relative to primary, `/`-separated. */
  manifests: Record<string, ManifestLaunchState>;
}

// --- §A seams -----------------------------------------------------------------

/** The session opener (iTerm2 in production; a stand-in in every automated test). */
export interface WindowDriver {
  open(command: string): Promise<string>;
  contents(windowId: string): Promise<string>;
  writeText(windowId: string, text: string, newline: boolean): Promise<void>;
  exists(windowId: string): Promise<boolean>;
}
export interface HostPaths { claudeJson: string; userSettings: string; managedSettings: string; managedDropInDir: string }
export interface FeatureStartRequest { primary: string; slug: string; base: string; worktree: string }
export type FeatureStartResult = { ok: true } | { ok: false; firstLine: string };
export interface Clock { now(): number; sleep(ms: number): Promise<void> }
export interface GitResult { status: number; stdout: string; stderr: string }
export type GitRunner = (args: string[], cwd: string) => GitResult;
export type AncestryFn = (branches: string[], repoRoot: string, ref: string) => LaneAncestryResult[];
export interface LaunchDeps {
  driver: WindowDriver;
  itermInstalled: () => boolean;
  host: HostPaths;
  featureStart: (req: FeatureStartRequest) => FeatureStartResult;
  clock: Clock;
  git: GitRunner;
  ancestry: AncestryFn;
  isPidAlive: (pid: number) => boolean;
  pid: number;
  out: (line: string) => void;
  err: (line: string) => void;
}
export interface LaunchContext { manifestPath: string; manifestKey: string; primary: string; gitCommonDir: string }

export function launchLimit(config: WorkspaceConfig): number {
  return config.laneLaunchLimit ?? DEFAULT_LANE_LAUNCH_LIMIT;
}

const realOr = (p: string): string => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const firstLine = (s: string): string => s.trim().split("\n")[0] ?? "";
const isDir = (p: string): boolean => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

export function resolveLaunchContext(manifestPath: string, git: GitRunner): LaunchContext | { error: string } {
  const abs = realOr(manifestPath);
  const notRepo = { error: `${manifestPath} is not inside a git repository` };
  const list = git(["worktree", "list", "--porcelain"], path.dirname(abs));
  const line = list.status === 0 ? list.stdout.split("\n").find((l) => l.startsWith("worktree ")) : undefined;
  if (line === undefined) return notRepo;
  const primary = line.slice("worktree ".length);
  const common = git(["rev-parse", "--git-common-dir"], primary);
  if (common.status !== 0) return notRepo;
  const manifestKey = path.relative(realOr(primary), abs).split(path.sep).join("/");
  return { manifestPath: abs, manifestKey, primary, gitCommonDir: realOr(path.resolve(primary, common.stdout.trim())) };
}

// --- §B launch state and lock -------------------------------------------------

export function launchStatePaths(gitCommonDir: string): { state: string; lock: string } {
  return { state: path.join(gitCommonDir, LAUNCH_STATE_FILE), lock: path.join(gitCommonDir, LAUNCH_LOCK_FILE) };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function isRecord(v: unknown): v is LaneLaunchRecord {
  if (!isObj(v) || !isObj(v.signals)) return false;
  const signals = v.signals;
  return (LAUNCH_STATUSES as readonly unknown[]).includes(v.status) && typeof v.wave === "number" && typeof v.windowId === "string" &&
    typeof v.baseSha === "string" && typeof v.reportFloor === "number" && typeof v.updatedAt === "string" &&
    (v.reason === undefined || typeof v.reason === "string") &&
    (Object.keys(HOST_SIGNALS) as HostSignal[]).every((k) => typeof signals[k] === "number");
}

export function readLaunchState(file: string): { ok: true; state: LaunchState } | { ok: false; error: string } {
  if (!fs.existsSync(file)) return { ok: true, state: { version: LAUNCH_STATE_VERSION, manifests: {} } };
  const bad = { ok: false as const, error: `the launch state ${file} does not parse; move it aside` };
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return bad; }
  if (!isObj(raw) || raw.version !== LAUNCH_STATE_VERSION || !isObj(raw.manifests)) return bad;
  for (const entry of Object.values(raw.manifests)) {
    if (!isObj(entry) || !isObj(entry.lanes) || !Object.values(entry.lanes).every(isRecord)) return bad;
  }
  return { ok: true, state: raw as unknown as LaunchState };
}

export function writeLaunchState(file: string, state: LaunchState, now: number, pid: number): void {
  const tmp = `${file}.${pid}.${now}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

export type LockResult = { ok: true; release: () => void } | { ok: false; pid: number };
function lockPid(lockFile: string): number | undefined {
  try {
    const v: unknown = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    return isObj(v) && typeof v.pid === "number" ? v.pid : undefined;
  } catch { return undefined; }
}

/** Own O_EXCL lock; staleness is pid liveness only (a run polls for hours). */
export function acquireLaunchLock(lockFile: string, pid: number, isPidAlive: (pid: number) => boolean, now: number): LockResult {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile, JSON.stringify({ pid, startedAt: new Date(now).toISOString() }), { flag: "wx" });
      return { ok: true, release: () => { if (lockPid(lockFile) === pid) fs.rmSync(lockFile, { force: true }); } };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const holder = lockPid(lockFile);
      if ((holder !== undefined && isPidAlive(holder)) || attempt === 1) return { ok: false, pid: holder ?? -1 };
      fs.rmSync(lockFile, { force: true });
    }
  }
  return { ok: false, pid: -1 };
}

// --- §C manifest refusals -----------------------------------------------------

export function sameWaveDependencies(m: Manifest): { dependent: string; dependedOn: string; wave: number }[] {
  const waveOf = new Map(m.dispatchable.map((l) => [l.lane, l.wave]));
  return m.dispatchable.flatMap((l) =>
    (l.depLanes ?? []).filter((d) => l.wave !== undefined && waveOf.get(d) === l.wave)
      .map((d) => ({ dependent: l.lane, dependedOn: d, wave: l.wave as number })));
}

/** Manifest-phase refusal reasons, in order: no-wave, each validation error, no-human, tier, each same-wave pair. */
export function manifestRefusals(text: string, config: WorkspaceConfig): string[] {
  const out: string[] = [];
  if (lanesSectionsWithoutWave(text).length > 0) out.push(OUT.refusedNoWave);
  const { manifest, errors } = validateManifest(text);
  out.push(...errors.map((e) => OUT.refusedInvalid(e.code, e.message)));
  if (!manifest.decisions.rows.some((r) => r.decider === "人類")) out.push(OUT.refusedNoHuman);
  if (config.cutApprovalAutoTier?.manifest !== true) out.push(OUT.refusedTier);
  out.push(...sameWaveDependencies(manifest).map((p) => OUT.refusedSameWave(p.dependent, p.dependedOn, p.wave)));
  return out;
}

// --- §D finished signals ------------------------------------------------------

export interface MailboxMessage { headers: Record<string, string>; body: string }
/** `--- msg` blocks: header closes at the first bare `---`, first key wins; body runs to the next `--- msg` line. */
export function parseMailboxMessages(text: string): MailboxMessage[] {
  const out: MailboxMessage[] = [];
  let cur: { headers: Record<string, string>; body: string[]; inHeader: boolean } | undefined;
  const flush = () => { if (cur) out.push({ headers: cur.headers, body: cur.body.join("\n") }); };
  for (const line of text.split(/\r?\n/)) {
    if (/^--- msg(?:[ \t].*)?$/.test(line)) { flush(); cur = { headers: Object.create(null) as Record<string, string>, body: [], inHeader: true }; continue; }
    if (!cur) continue;
    if (!cur.inHeader) { cur.body.push(line); continue; }
    if (line === "---") { cur.inHeader = false; continue; }
    const h = /^([a-z]+):\s?(.*)$/.exec(line);
    if (h && !Object.hasOwn(cur.headers, h[1])) cur.headers[h[1]] = h[2];
  }
  flush();
  return out;
}

const isReport = (msg: MailboxMessage): boolean => msg.headers.type?.trim() === "report";
export function isLaneReport(msg: MailboxMessage): boolean {
  return isReport(msg) && (msg.body.split("\n").find((l) => l.trim() !== "") ?? "").startsWith("## Lane report:");
}

export function laneTicketStatuses(worktree: string, ticketDirRel: string, ids: string[]): Map<string, string | undefined> {
  const found = new Map<string, string>();
  const dir = path.join(worktree, ticketDirRel);
  let names: string[] = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md"); } catch { /* no worktree yet */ }
  for (const name of names) {
    let fields: Record<string, string | string[]>;
    try { fields = parseTicketFile(fs.readFileSync(path.join(dir, name), "utf8")).fields; } catch { continue; }
    if (typeof fields.id === "string" && typeof fields.status === "string") found.set(fields.id, fields.status);
  }
  return new Map(ids.map((id) => [id, found.get(id)]));
}

export function ticketsSettled(statuses: Map<string, string | undefined>): boolean {
  const all = [...statuses.values()];
  const stopped = (s: string | undefined) => s !== undefined && /^stopped\s+—\s+\S/.test(s);
  return all.length > 0 && all.every((s) => s === "done" || stopped(s)) && all.some(stopped);
}

export function hasFinishRecord(primary: string, names: string[]): boolean {
  const root = path.join(primary, ".current", "history");
  let buckets: string[] = [];
  try { buckets = fs.readdirSync(root).filter((b) => HISTORY_BUCKET_RE.test(b)); } catch { return false; }
  return buckets.some((b) => names.some((n) => isDir(path.join(root, b, n))));
}

/** The lane id and the name `agc feature finish` derives from the branch slug. */
const recordNames = (lane: DispatchableLane): string[] => [lane.lane, resolveLaneName(lane.branch.replace(/^feat\//, ""))];

export interface FinishedProbe { finished: FinishedHow | undefined; reportCount: number; settled: boolean }
export function probeFinished(input: {
  primary: string; lane: DispatchableLane; worktree: string; mailboxFile: string | undefined; ticketDirRel: string; reportFloor: number;
}): FinishedProbe {
  let text = "";
  try { if (input.mailboxFile !== undefined) text = fs.readFileSync(input.mailboxFile, "utf8"); } catch { /* no messages yet */ }
  const reports = parseMailboxMessages(text).filter(isReport);
  const settled = input.worktree !== "" && ticketsSettled(laneTicketStatuses(input.worktree, input.ticketDirRel, ticketIds(input.lane.ticket)));
  let finished: FinishedHow | undefined;
  if (reports.some(isLaneReport)) finished = "lane report";
  else if (settled && reports.length > input.reportFloor) finished = "batch stop";
  else if (hasFinishRecord(input.primary, recordNames(input.lane))) finished = "finish record";
  return { finished, reportCount: reports.length, settled };
}

// --- §E dependencies and waves ------------------------------------------------

export type DepCheck = { met: true } | { met: false; why: string };
export function dependencyMet(input: {
  primary: string; dep: DispatchableLane; startRef: string; knowledgeLocal: boolean; git: GitRunner; ancestry: AncestryFn;
}): DepCheck {
  const { primary, dep, startRef } = input;
  const recorded = hasFinishRecord(primary, recordNames(dep));
  if (input.knowledgeLocal) return recorded ? { met: true } : { met: false, why: `agc feature finish --shipped has not run for ${dep.lane}` };
  if (input.git(["show-ref", "--verify", "--quiet", `refs/heads/${dep.branch}`], primary).status !== 0) {
    return recorded ? { met: true } : { met: false, why: `branch ${dep.branch} is gone and ${dep.lane} has no finish record` };
  }
  const r = input.ancestry([dep.branch], primary, startRef)[0];
  if (r?.isAncestor) return { met: true };
  if (r?.error !== undefined) return { met: false, why: `git: ${firstLine(r.error)}` };
  return { met: false, why: `branch ${dep.branch} is not an ancestor of ${startRef}` };
}

/** The manifest's `base:` for the lowest 波次, `main` for any later one. */
export function startRefFor(m: Manifest, wave: number): string {
  const lowest = Math.min(...m.dispatchable.map((l) => l.wave ?? Infinity));
  return wave === lowest && m.base !== undefined ? m.base : "main";
}

// --- §F the run ---------------------------------------------------------------

export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
export function launchCommand(worktree: string, lane: string): string {
  return `cd ${shellQuote(worktree)} && claude --permission-mode bypassPermissions -n ${lane}`;
}
const zeroSignals = (): SignalCounts => ({ weekly: 0, continuing: 0, stopped: 0, enter: 0, unknown: 0 });

class LaunchRun {
  private readonly records: Record<string, LaneLaunchRecord>;
  private readonly limit: number;
  private readonly ticketDirRel: string;
  private readonly mailboxRoot: string | undefined;

  constructor(
    private readonly ctx: LaunchContext, private readonly deps: LaunchDeps, private readonly config: WorkspaceConfig,
    private readonly m: Manifest, private readonly state: LaunchState, private readonly stateFile: string,
  ) {
    this.records = (state.manifests[ctx.manifestKey] ??= { lanes: {} }).lanes;
    this.limit = launchLimit(config);
    this.ticketDirRel = path.relative(ctx.primary, resolveTicketDir(ctx.primary));
    const mb = m.mailbox !== undefined ? resolveMailboxHeader(m.mailbox, ctx.primary) : undefined;
    this.mailboxRoot = mb?.ok ? mb.path : undefined;
  }

  private update(lane: string, patch: Partial<LaneLaunchRecord>): void {
    Object.assign(this.records[lane], patch, { updatedAt: new Date(this.deps.clock.now()).toISOString() });
    writeLaunchState(this.stateFile, this.state, this.deps.clock.now(), this.deps.pid);
  }

  private probe(lane: DispatchableLane): FinishedProbe {
    const wt = resolveWorktree(lane.worktree, this.ctx.primary);
    return probeFinished({
      primary: this.ctx.primary, lane, worktree: wt.ok ? wt.path : "", ticketDirRel: this.ticketDirRel,
      mailboxFile: this.mailboxRoot && path.join(this.mailboxRoot, lane.lane, "to-integrator.md"),
      reportFloor: this.records[lane.lane]?.reportFloor ?? 0,
    });
  }

  private isFinished(lane: DispatchableLane): boolean {
    return this.records[lane.lane]?.status === "finished" || this.probe(lane).finished !== undefined;
  }

  /** One look at a recorded lane holding a slot: finished frees it; unsettled tickets raise the report floor. */
  private observe(lane: DispatchableLane): void {
    const rec = this.records[lane.lane];
    if (rec === undefined || !SLOT_STATUSES.has(rec.status)) return;
    const p = this.probe(lane);
    if (p.finished !== undefined) {
      this.update(lane.lane, { status: "finished" });
      this.deps.out(OUT.finished(lane.lane, p.finished));
    } else if (!p.settled && p.reportCount > rec.reportFloor) this.update(lane.lane, { reportFloor: p.reportCount });
  }

  private slotsOpen(wave: number): number {
    return this.limit - this.m.dispatchable.filter((l) => l.wave === wave && SLOT_STATUSES.has(this.records[l.lane]?.status ?? "finished")).length;
  }

  /** New lanes of `wave` that may start: no record, not finished, every dependency met, batch lanes only. */
  private plan(wave: number): DispatchableLane[] {
    const startRef = startRefFor(this.m, wave);
    const queue: DispatchableLane[] = [];
    for (const lane of this.m.dispatchable.filter((l) => l.wave === wave)) {
      if (this.records[lane.lane] !== undefined || this.isFinished(lane)) continue;
      let met = true;
      for (const id of lane.depLanes ?? []) {
        const dep = this.m.dispatchable.find((d) => d.lane === id);
        if (dep === undefined) continue;
        const c = dependencyMet({ primary: this.ctx.primary, dep, startRef, knowledgeLocal: this.config.knowledge === "local", git: this.deps.git, ancestry: this.deps.ancestry });
        if (!c.met) { this.deps.out(OUT.waiting(lane.lane, id, c.why)); met = false; }
      }
      if (!met) continue;
      if (lane.approval === "human") { this.deps.out(OUT.notStarted(lane.lane, "approval is human")); continue; }
      const absent = ticketIds(lane.ticket).find((id) => {
        const r = lookupTicketFiles(this.ctx.primary, [id]);
        return !r.ok && r.errors.some((e) => e.code === FANOUT_CODES.ticketFileAbsent);
      });
      if (absent !== undefined) { this.deps.out(OUT.notStarted(lane.lane, `no ticket file for ${absent}`)); continue; }
      queue.push(lane);
    }
    return queue;
  }

  private worktreeListed(worktree: string): boolean {
    const r = this.deps.git(["worktree", "list", "--porcelain"], this.ctx.primary);
    const want = realOr(worktree);
    return r.stdout.split("\n").some((l) => l.startsWith("worktree ") && realOr(l.slice("worktree ".length)) === want);
  }

  private async send(windowId: string, text: string): Promise<void> {
    await this.deps.driver.writeText(windowId, text, false);
    await this.deps.clock.sleep(SEND_GAP_MS);
    await this.deps.driver.writeText(windowId, "", true);
  }

  private async start(lane: DispatchableLane, wave: number): Promise<void> {
    const { primary } = this.ctx;
    const startRef = startRefFor(this.m, wave);
    const sha = this.deps.git(["rev-parse", "--verify", "--quiet", `${startRef}^{commit}`], primary);
    const baseSha = sha.status === 0 && sha.stdout.trim() !== "" ? sha.stdout.trim() : startRef;
    const r = renderPrompt(this.m, lane.lane, { batch: true, base: baseSha, primary });
    const wt = resolveWorktree(lane.worktree, primary);
    if (!r.ok || !wt.ok) return this.deps.out(OUT.notStarted(lane.lane, `render failed: ${!r.ok ? r.errors[0]?.code : wt.ok ? "" : wt.code}`));
    if (!this.worktreeListed(wt.path)) {
      const fsr = this.deps.featureStart({ primary, slug: lane.branch.replace(/^feat\//, ""), base: startRef, worktree: wt.path });
      if (!fsr.ok) return this.deps.out(OUT.notStarted(lane.lane, `agc feature start failed: ${fsr.firstLine}`));
    }
    const windowId = await this.deps.driver.open(launchCommand(wt.path, lane.lane));
    this.records[lane.lane] = { status: "running", wave, windowId, baseSha, signals: zeroSignals(), reportFloor: this.probe(lane).reportCount, updatedAt: "" };
    this.update(lane.lane, {});
    await this.send(windowId, SLASH_LINE);
    await this.send(windowId, r.prompt);
    this.deps.out(OUT.started(lane.lane, windowId));
  }

  private async fill(queue: DispatchableLane[], wave: number): Promise<void> {
    while (queue.length > 0 && this.slotsOpen(wave) > 0) await this.start(queue.shift() as DispatchableLane, wave);
  }

  async run(): Promise<number> {
    const lanes = this.m.dispatchable;
    for (const lane of lanes) this.observe(lane);
    const waves = [...new Set(lanes.map((l) => l.wave ?? 0))].sort((a, b) => a - b);
    const wave = waves.find((w) => lanes.some((l) => l.wave === w && !this.isFinished(l)));
    if (wave === undefined) {
      this.deps.out(OUT.exit(waves.at(-1) ?? 0));
      return 0;
    }
    for (const w of waves) if (w > wave) this.deps.out(OUT.laterWave(w, wave));
    const queue = this.plan(wave);
    await this.fill(queue, wave);
    for (const l of queue) this.deps.out(OUT.queued(l.lane, this.limit));
    const running = () => lanes.some((l) => l.wave === wave && this.records[l.lane]?.status === "running");
    while (running()) {
      await this.deps.clock.sleep(POLL_INTERVAL_MS);
      for (const lane of lanes) if (lane.wave === wave) this.observe(lane);
      await this.fill(queue, wave);
    }
    this.deps.out(OUT.exit(wave));
    return 0;
  }
}

/** Whole run: refusals, lock, launch state, then the wave. Returns 0, or 1 on a refusal; a clock error propagates. */
export async function runLaneLaunch(ctx: LaunchContext, deps: LaunchDeps): Promise<number> {
  const text = fs.readFileSync(ctx.manifestPath, "utf8");
  const config = loadConfig(ctx.primary);
  const refusals = manifestRefusals(text, config);
  if (refusals.length > 0) {
    for (const r of refusals) deps.err(OUT.refused(r));
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
  } finally {
    lock.release();
  }
}
