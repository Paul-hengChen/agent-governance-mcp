import { type WorkspaceConfig } from "./config.js";
import { type DispatchableLane, type Manifest } from "./fanout-manifest.js";
import type { LaneAncestryResult } from "./join-precondition.js";
export declare const DEFAULT_LANE_LAUNCH_LIMIT = 3;
export declare const LAUNCH_STATE_FILE = "agc-lane-launch.json";
export declare const LAUNCH_LOCK_FILE = "agc-lane-launch.lock";
export declare const LAUNCH_STATE_VERSION = 1;
export declare const LAUNCH_STATUSES: readonly ["running", "paused-weekly", "paused-stopped", "finished", "window-gone", "start-failed"];
export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];
export declare const POLL_INTERVAL_MS = 15000;
export declare const SLASH_LINE = "/mcp__agent-governance-mcp__teamwork";
export declare const SEND_GAP_MS = 500;
export declare const READY_MARKER = "permissions on";
export declare const RESEND_BOUND = 3;
export declare const READY_TIMEOUT_MS = 120000;
export declare const READY_POLL_MS = 1000;
export declare const READY_SETTLE_MS = 6000;
export declare const UNKNOWN_CHECK_MS = 5000;
export declare const RESEND_GAP_MS = 10000;
/** The one table of host line prefixes the launcher matches in a window. */
export declare const HOST_SIGNALS: {
    readonly weekly: "You've hit your weekly limit";
    readonly continuing: "Continuing automatically at";
    readonly stopped: "Automatic continue stopped after repeated usage-limit hits";
    readonly enter: "Press enter to continue";
    readonly unknown: "Unknown command";
};
export type HostSignal = keyof typeof HOST_SIGNALS;
export type SignalCounts = Record<HostSignal, number>;
export type FinishedHow = "lane report" | "batch stop" | "finish record";
export declare const OUT: {
    refused: (reason: string) => string;
    refusedNoWave: string;
    refusedNoHuman: string;
    refusedTier: string;
    refusedSameWave: (lane: string, dep: string, wave: number) => string;
    refusedInvalid: (code: string, message: string) => string;
    refusedBusy: (pid: number) => string;
    started: (lane: string, id: string) => string;
    queued: (lane: string, limit: number) => string;
    waiting: (lane: string, dep: string, why: string) => string;
    notStarted: (lane: string, why: string) => string;
    finished: (lane: string, how: FinishedHow) => string;
    laterWave: (n: number, m: number) => string;
    exit: (n: number) => string;
    startFailed: (lane: string, why: string) => string;
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
export interface ManifestLaunchState {
    lanes: Record<string, LaneLaunchRecord>;
}
export interface LaunchState {
    version: 1;
    /** Keyed by the manifest path relative to primary, `/`-separated. */
    manifests: Record<string, ManifestLaunchState>;
}
/** The session opener (iTerm2 in production; a stand-in in every automated test). */
export interface WindowDriver {
    open(command: string): Promise<string>;
    contents(windowId: string): Promise<string>;
    writeText(windowId: string, text: string, newline: boolean): Promise<void>;
    exists(windowId: string): Promise<boolean>;
}
export interface HostPaths {
    claudeJson: string;
    userSettings: string;
    managedSettings: string;
    managedDropInDir: string;
}
export interface FeatureStartRequest {
    primary: string;
    slug: string;
    base: string;
    worktree: string;
}
export type FeatureStartResult = {
    ok: true;
} | {
    ok: false;
    firstLine: string;
};
export interface Clock {
    now(): number;
    sleep(ms: number): Promise<void>;
}
export interface GitResult {
    status: number;
    stdout: string;
    stderr: string;
}
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
export interface LaunchContext {
    manifestPath: string;
    manifestKey: string;
    primary: string;
    gitCommonDir: string;
}
export declare function launchLimit(config: WorkspaceConfig): number;
export declare function resolveLaunchContext(manifestPath: string, git: GitRunner): LaunchContext | {
    error: string;
};
export declare function launchStatePaths(gitCommonDir: string): {
    state: string;
    lock: string;
};
export declare function readLaunchState(file: string): {
    ok: true;
    state: LaunchState;
} | {
    ok: false;
    error: string;
};
export declare function writeLaunchState(file: string, state: LaunchState, now: number, pid: number): void;
export type LockResult = {
    ok: true;
    release: () => void;
} | {
    ok: false;
    pid: number;
};
/** Own O_EXCL lock; staleness is pid liveness only (a run polls for hours). */
export declare function acquireLaunchLock(lockFile: string, pid: number, isPidAlive: (pid: number) => boolean, now: number): LockResult;
export declare function sameWaveDependencies(m: Manifest): {
    dependent: string;
    dependedOn: string;
    wave: number;
}[];
/** Manifest-phase refusal reasons, in order: no-wave, each validation error, no-human, tier, each same-wave pair. */
export declare function manifestRefusals(text: string, config: WorkspaceConfig): string[];
export interface MailboxMessage {
    headers: Record<string, string>;
    body: string;
}
/** `--- msg` blocks: header closes at the first bare `---`, first key wins; body runs to the next `--- msg` line. */
export declare function parseMailboxMessages(text: string): MailboxMessage[];
export declare function isLaneReport(msg: MailboxMessage): boolean;
export declare function laneTicketStatuses(worktree: string, ticketDirRel: string, ids: string[]): Map<string, string | undefined>;
export declare function ticketsSettled(statuses: Map<string, string | undefined>): boolean;
export declare function hasFinishRecord(primary: string, names: string[]): boolean;
export interface FinishedProbe {
    finished: FinishedHow | undefined;
    reportCount: number;
    settled: boolean;
}
export declare function probeFinished(input: {
    primary: string;
    lane: DispatchableLane;
    worktree: string;
    mailboxFile: string | undefined;
    ticketDirRel: string;
    reportFloor: number;
}): FinishedProbe;
export type DepCheck = {
    met: true;
} | {
    met: false;
    why: string;
};
export declare function dependencyMet(input: {
    primary: string;
    dep: DispatchableLane;
    startRef: string;
    knowledgeLocal: boolean;
    git: GitRunner;
    ancestry: AncestryFn;
}): DepCheck;
/** The manifest's `base:` for the lowest 波次, `main` for any later one. */
export declare function startRefFor(m: Manifest, wave: number): string;
export declare function shellQuote(s: string): string;
export declare function launchCommand(worktree: string, lane: string): string;
/** Whole run: refusals, lock, launch state, then the wave. Returns 0, or 1 on a refusal; a clock error propagates. */
export declare function runLaneLaunch(ctx: LaunchContext, deps: LaunchDeps): Promise<number>;
/** Lines of a window's text, leading whitespace and UI glyphs (box drawing, bullets) stripped. */
export declare function signalLines(contents: string): string[];
export declare function signalCounts(contents: string): SignalCounts;
export interface NewSignals {
    weekly: boolean;
    stopped: boolean;
    enter: boolean;
    unknown: boolean;
}
/** A signal is new when its count is above `baseline`; a new weekly line counts only with no `continuing` line after the last weekly line. */
export declare function newSignals(contents: string, baseline: SignalCounts): NewSignals;
/** Phase 0 send method: text with newline NO, 0.5 s, then an empty write text. Returns the counts read just before (the new baseline). */
export declare function sendText(driver: WindowDriver, clock: Clock, windowId: string, text: string): Promise<SignalCounts>;
/** One empty write text; returns the new baseline. */
export declare function sendEnter(driver: WindowDriver, windowId: string): Promise<SignalCounts>;
export type StartOutcome = {
    ok: true;
    signals: SignalCounts;
} | {
    ok: false;
    why: string;
};
/** Ready wait, settle, slash line (resent on a new `Unknown command`, at most RESEND_BOUND times), then the prompt in one send. */
export declare function startSession(driver: WindowDriver, clock: Clock, windowId: string, prompt: string): Promise<StartOutcome>;
/** Argv for the real `agc feature start` runner, spawned with process.execPath from primary. */
export declare function featureStartArgv(installRoot: string, req: FeatureStartRequest): string[];
//# sourceMappingURL=lane-launch.d.ts.map