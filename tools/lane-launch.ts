// Coded by @sr-engineer
// Lane launcher core (scripts/lane-launch.mjs): starts the batch lanes of the
// current wave of a fan-out manifest under a parallel limit, waits on lane
// dependencies, and keeps a launch state in the git common dir. It only reads
// the manifest; it never writes a tracked path or anything under a lane worktree.
// Why: specs/e443b-lane-launcher-architecture.md

import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, type WorkspaceConfig } from "./config.js";
import { lanesSectionsWithoutWave, validateManifest, type Manifest } from "./fanout-manifest.js";
import type { LaneAncestryResult } from "./join-precondition.js";

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

/** Refusals, lock, launch state. Returns 0, or 1 on a refusal. */
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
    return 0;
  } finally {
    lock.release();
  }
}
