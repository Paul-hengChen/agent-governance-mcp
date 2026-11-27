import { type WaveDoneAt } from "./config.js";
import { type Clock, type GitRunner, type MailboxMessage, type WindowDriver } from "./lane-launch.js";
export declare const CONDUCTOR_STATE_FILE = "agc-conductor.json";
export declare const CONDUCTOR_MAILBOX_DIR = "agc-conductor";
export declare const CONDUCTOR_STATE_VERSION = 1;
export declare const INTEGRATOR_SLASH_LINE = "/mcp__agent-governance-mcp__integrator";
export declare const CONDUCTOR_USAGE = "usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check";
export declare const fanoutLine: (record: string) => string;
export declare const takeoverLine: (manifest: string, n: number) => string;
export declare const CONDUCTOR_STEPS: readonly ["opening", "integrator-open", "wave-closed", "integrator-gone", "done"];
export type ConductorStep = (typeof CONDUCTOR_STEPS)[number];
export interface ConductorState {
    version: 1;
    /** Discussion record of the first wave, primary-relative; null when the run started from `open --manifest`. */
    record: string | null;
    /** Fan-out manifest, primary-relative; null until the first met wave-done report names it. */
    manifest: string | null;
    wave: number;
    windowId: string | null;
    step: ConductorStep;
    /** `to-lane.md` message count when the current integrator opened; older messages never count as its report. */
    reportFloor: number;
    updatedAt: string;
}
export declare const CONDUCTOR_OUT: {
    opened: (n: number, id: string) => string;
    closed: (id: string) => string;
    woken: (id: string) => string;
    unmet: (n: number, fact: string) => string;
    allDone: (manifest: string) => string;
    gone: (n: number, what: string, id: string) => string;
    ok: (n: number, id: string) => string;
    factPr: (pr: number, state: string, waveDoneAt: WaveDoneAt) => string;
    factHandoff: (manifest: string, code: number) => string;
    factReport: (n: number | string, manifest: string, pr: number | string) => string;
    replyUnmet: (n: number, facts: string[]) => string;
    stateLine: typeof stateLine;
    refused: (reason: string) => string;
    refusedOpen: (id: string) => string;
    refusedNoWindow: string;
    refusedWindowGone: (id: string) => string;
    refusedNotReady: (id: string, s: number) => string;
    refusedUnknown: (id: string, n: number) => string;
    refusedStep: (step: string) => string;
    refusedNotRepo: (dir: string) => string;
};
export declare function stateLine(state: ConductorState | undefined, paths: ConductorPaths): string;
export type PrStateResult = {
    ok: true;
    state: string;
} | {
    ok: false;
    why: string;
};
export interface ConductorDeps {
    driver: WindowDriver;
    clock: Clock;
    git: GitRunner;
    /** `gh pr view <pr> --json state` in `cwd`. */
    prState: (pr: number, cwd: string) => PrStateResult;
    /** `fanout.mjs handoff --check <manifestAbs>` in `primary`; its exit code. */
    handoffCheck: (manifestAbs: string, primary: string) => number;
    /** The launcher's close-finished run for the manifest; its exit code. */
    closeFinished: (manifestAbs: string) => Promise<number>;
    out: (line: string) => void;
    err: (line: string) => void;
    now: () => Date;
}
export interface ConductorPaths {
    state: string;
    mailboxDir: string;
    toLane: string;
    toIntegrator: string;
}
export interface ConductorContext {
    primary: string;
    gitCommonDir: string;
}
/** Same two git calls as resolveLaunchContext, from `cwd`. */
export declare function resolveConductorContext(cwd: string, git: GitRunner): ConductorContext | {
    error: string;
};
export declare function conductorPaths(gitCommonDir: string): ConductorPaths;
/** Absent file → no run recorded; anything unreadable is refused, never overwritten. */
export declare function readConductorState(file: string): {
    ok: true;
    state: ConductorState | undefined;
} | {
    ok: false;
    error: string;
};
export declare function writeConductorState(file: string, state: ConductorState): void;
export declare function ensureConductorMailbox(paths: ConductorPaths): void;
/** Primary-relative, `/`-separated key of `p` (realpath on both sides). */
export declare function toPrimaryKey(primary: string, p: string): string;
export interface WaveDoneReport {
    index: number;
    seq: string | undefined;
    wave: number;
    manifest: string;
    pr: number;
}
export declare function parseWaveDoneFirstItem(body: string): {
    wave: number;
    manifest: string;
    pr: number;
} | undefined;
/** The newest wave-done report at index >= floor. */
export declare function findWaveDoneReport(messages: MailboxMessage[], floor: number): {
    index: number;
    msg: MailboxMessage;
} | undefined;
export declare function hasWaveDoneReport(messages: MailboxMessage[], floor: number): boolean;
export declare function prFactMet(state: string, waveDoneAt: WaveDoneAt): boolean;
/** Smallest 波次 above `wave` among the manifest's dispatchable lanes. */
export declare function nextWave(manifestText: string, wave: number): number | undefined;
/** Same block format as `mailbox-watch.mjs --send`, with `from: conductor`, `type: reply`, `hop: —`. */
export declare function appendConductorReply(file: string, input: {
    re: string;
    body: string;
    time: Date;
}): void;
export type OpenTarget = {
    record: string;
} | {
    manifest: string;
    wave: number;
};
export declare function conductorOpen(ctx: ConductorContext, deps: ConductorDeps, target: OpenTarget): Promise<number>;
export declare function conductorClose(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export declare function conductorWake(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export declare function conductorState(ctx: ConductorContext, deps: ConductorDeps): number;
export declare function conductorWaveDone(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export declare function conductorCheck(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export type ConductorCommand = {
    cmd: "state";
} | {
    cmd: "close";
} | {
    cmd: "wake";
} | {
    cmd: "wave-done";
} | {
    cmd: "check";
} | {
    cmd: "open";
    target: OpenTarget;
};
export declare function parseConductorArgv(argv: string[]): ConductorCommand | undefined;
/** argv → exit code 0 / 1 / 2; exit-1 lines go to `deps.err`. */
export declare function runConductorCli(argv: string[], deps: ConductorDeps, cwd: string): Promise<number>;
/** Real seams: iTerm2 driver (used only by commands that act on a window), gh, fanout.mjs, the real launcher. */
export declare function createConductorHostDeps(): ConductorDeps;
//# sourceMappingURL=conductor.d.ts.map