import type { LaneInfo, LaneListProvider, LaneListResult } from "./feature-rollup.js";
import type { HandoffState } from "./handoff-types.js";
/** `git log <base>..<branch> --oneline` for one lane. */
export interface LaneCommits {
    /** null when the list could not be computed (see `error`). */
    list: string[] | null;
    count: number | null;
    error?: string;
}
/** `git status --porcelain` for one lane's worktree. */
export interface LaneGitStatus {
    /** null when status could not be read (see `error`). */
    clean: boolean | null;
    changedFiles: number | null;
    error?: string;
}
/** Evidence cross-check for one lane (AC5). */
export interface LaneEvidenceCheck {
    /** completed_tasks as the handoff claims them. */
    claimedIds: string[];
    /** Task ids independently backed by on-disk qa evidence, sorted. */
    evidenceIds: string[];
    claimedCount: number;
    evidenceCount: number;
    /** Claimed in the handoff but no evidence file found. */
    claimedWithoutEvidence: string[];
    /** Evidence on disk but not claimed in the handoff (the E175(d) class). */
    evidenceWithoutClaim: string[];
    /** true iff the two id sets differ in either direction. */
    mismatch: boolean;
    /** The feature's ticket token; null = not derivable (AC5c). */
    ticketToken: string | null;
    /** In-scope PASS-evidence ids dropped because the lane voided them (AC5d). */
    excludedVoided: string[];
    /** Human-readable statement of which files/ids were in scope. */
    scope: string;
}
export interface LaneStatusRow {
    workspacePath: string;
    /** Worktree directory basename (e.g. `e177b`) — the display/selection key. */
    lane: string;
    /** Ticket-id lane token from a `feat/<id>-...` branch, else null. */
    laneId: string | null;
    branch: string | null;
    readable: boolean;
    /** Set whenever `readable` is false: why the handoff could not be read. */
    reason?: string;
    activeFeature: string | null;
    status: string | null;
    lastAgent: string | null;
    lastUpdated: string | null;
    hopCount: number | null;
    reviewRound: number | null;
    qaRound: number | null;
    /** completed_tasks from the handoff; [] when unreadable. */
    completedTasks: string[];
    commits: LaneCommits;
    gitStatus: LaneGitStatus;
    /** null when the lane is unreadable (no feature to scope evidence by). */
    evidence: LaneEvidenceCheck | null;
    /** E178b cut pre-review fan-in; present ONLY when `mailboxRoot` was given
     *  (spec decision (j): no field at all otherwise). */
    cutPrereview?: CutPrereviewCheck;
}
/** Decision (g)'s five states. */
export type CutPrereviewState = "sent" | "missing" | "no-mailbox" | "n/a" | "not-checked";
/** E178b cut pre-review check for one lane (spec decision (g), AC10-AC12). */
export interface CutPrereviewCheck {
    state: CutPrereviewState;
    /** Rendered text printed after `cut pre-review: ` (Copy/Strings prereview.*). */
    text: string;
    /** Worktree-relative `specs/<active_feature>.md` checked; null when not derivable. */
    specFile: string | null;
    /** Absolute `<mailbox-root>/<lane>/to-integrator.md`; null when not derivable. */
    mailboxFile: string | null;
    /** Whether mailboxFile exists (state missing covers both absent and no match). */
    mailboxFileExists: boolean;
    /** `seq:` / `re:` of the FIRST matching block (state sent only). */
    seq?: string;
    re?: string;
    /** Why the lane was not checked (state not-checked only). */
    reason?: string;
}
export interface LaneStatusReport {
    repoRoot: string;
    baseRef: string;
    source: LaneListResult["source"];
    lanes: LaneStatusRow[];
    degraded: boolean;
    degradedReason?: string;
    /** Lane-LIST derivation itself degraded (git failure, lone worktree, ...),
     *  as opposed to individual lanes being unreadable. Lets the cross-lane
     *  roll-up ignore an unreadable lane that was not selected. */
    listDegraded: boolean;
    listDegradedReason?: string;
}
export interface ComputeLaneStatusOptions {
    repoRoot?: string;
    /** Ref the per-lane commit list is computed against. Default "main". */
    baseRef?: string;
    /** Lane list source. Default `laneRegistryList` (tools/lane-registry.ts). */
    laneListProvider?: LaneListProvider;
    /** Handoff reader for round fields. Default `parseHandoff`. */
    handoffReader?: (workspacePath: string) => HandoffState | null;
    /** Per git subprocess timeout. Default 15000ms. */
    gitTimeoutMs?: number;
    /** E178b: mailbox root; when set, each row carries `cutPrereview`. */
    mailboxRoot?: string;
}
/** One cap comparison. `capName` is the REAL exported constant name. */
export interface CapCheck {
    metric: "hop" | "review_round" | "qa_round";
    capName: "HOP_CAP_EXPORTED" | "REVIEW_ROUND_CAP_EXPORTED" | "ROUND_CAP_EXPORTED";
    cap: number;
    value: number;
    over: boolean;
    atCap: boolean;
}
export interface RollupTotals {
    tickets: number;
    hop: number;
    reviewRounds: number;
    qaRounds: number;
}
export interface SameFeatureRollup {
    mode: "feature";
    featureId: string;
    /** Lanes whose active_feature === featureId (the summed set). */
    matchingLanes: LaneStatusRow[];
    /** Every lane in the report, for context. */
    allLanes: LaneStatusRow[];
    /** tickets/hop from computeFeatureRollup; review/qa rounds summed here. */
    totals: RollupTotals;
    capChecks: CapCheck[];
    evidenceMismatches: LaneStatusRow[];
    degraded: boolean;
    degradedReason?: string;
}
export interface CrossLaneRollup {
    mode: "cross";
    /** Selected lanes, each carrying its own active_feature. */
    lanes: LaneStatusRow[];
    /** Names passed via --lanes that matched no lane. */
    missing: string[];
    distinctFeatures: string[];
    /** Per-lane cap evaluation — never a shared cap across differing features. */
    perLaneCaps: {
        lane: string;
        activeFeature: string | null;
        checks: CapCheck[];
    }[];
    /** Informational only — never compared against any cap. */
    combined: RollupTotals;
    evidenceMismatches: LaneStatusRow[];
    degraded: boolean;
    degradedReason?: string;
}
/** Printed (per lane) when the feature id yields no ticket token (AC5c). */
export declare const TOKEN_NOT_DERIVABLE_NOTE = "ticket token not derivable \u2014 comparing completed_tasks only";
/**
 * Lowercased leading ticket-id token of a feature id, or null. Delegates to
 * tools/lane-paths.ts `resolveLaneName` (the single owner of the ticket-id
 * pattern — import-only reuse, never a restated regex), mapping its
 * LEGACY_LANE "no token" sentinel to null.
 */
export declare function featureTicketToken(activeFeature: string | null): string | null;
/** Does `id` carry `token` as one delimited segment (case-insensitive)?
 *  e.g. token "e177b" matches "T-E177B-04" but not "T-E177-04". */
export declare function idCarriesTicketToken(id: string, token: string): boolean;
/**
 * Independently count the task ids backed by qa evidence
 * on disk in one lane's worktree, and compare against the handoff's
 * completed_tasks. Never trusts the handoff's own count.
 *
 * Evidence sources: `qa_reports/*.md` and `qa_reports/archive/<feature>/*.md`
 * — each file's `review_<id>.md` id and its `covers:` ids. The SAME filters
 * apply to both directories; neither is ever scanned unfiltered:
 *   - PASS-only: a file with no `— PASS — by qa-engineer` round
 *     contributes nothing.
 *   - in scope: the id is in completed_tasks, OR carries the feature's ticket
 *     token as a delimited segment (`e177b-lane-status-tooling` → `e177b` →
 *     `T-E177B-04` in scope, `T-E125A-01` not). A worktree's `qa_reports/`
 *     holds every merged feature's evidence, and a release archive holds a
 *     whole wave's.
 *   - no token: scoping falls back to completed_tasks membership
 *     alone, and the report states it (TOKEN_NOT_DERIVABLE_NOTE).
 *   - voided: an id voided in the lane's own tasks ledger never counts.
 *     `lane` names that ledger (`.current/<lane>/`); computeLaneStatus passes
 *     the branch's lane (`feat/<id>-*` → id, else PRIMARY_LANE, mirroring
 *     the live resolver). Omitted, it defaults to the feature's ticket token,
 *     else PRIMARY_LANE.
 */
export declare function checkLaneEvidence(workspacePath: string, activeFeature: string | null, completedTasks: string[], lane?: string): LaneEvidenceCheck;
/** The lane-side mailbox file, as docs/lane-protocol.md §5 names it. */
export declare const LANE_TO_INTEGRATOR_FILE = "to-integrator.md";
/**
 * Header fields of every `--- msg` block, in file order — a minimal reader
 * kept at parity with scripts/mailbox-watch.mjs `parseMessageHeaders`
 * (pinned by test, AC14): a block opens at a `--- msg` line, its header
 * closes at the first bare `---` line, `<key>: <value>` lines inside the
 * header are captured, and the first occurrence of a key wins. tools/ cannot
 * import the script (tsconfig), hence the local copy. Objects are
 * null-prototype, so a header key such as `constructor` is captured rather
 * than shadowed.
 */
export declare function parseMailboxHeaders(text: string): Record<string, string>[];
/** Decision (g) recognizer: `type: proposal` whose `re:` contains `cut` or `預審`, any case. */
export declare function isCutPrereviewMessage(headers: Record<string, string>): boolean;
export interface CutPrereviewInput {
    workspacePath: string;
    /** Worktree basename — names the `<mailbox-root>/<lane>/` directory. */
    lane: string;
    activeFeature: string | null;
    readable: boolean;
    mailboxRoot: string;
}
/**
 * Did a lane that has a written cut (`specs/<active_feature>.md`
 * in its worktree) send it for pre-review? Read-only; never throws. States:
 *   sent (to-integrator#<seq>) — first matching block;
 *   missing     — spec exists, no matching block (or the file is absent);
 *   no-mailbox  — spec exists, `<mailbox-root>/<lane>/` does not;
 *   n/a         — no spec;
 *   not-checked — lane unreadable, no active_feature, or a name that is not
 *                 a safe single path segment (never joined into a path).
 * Policy-neutral: whether a given lane must send a cut is not decided here. (E178b)
 */
export declare function checkCutPrereview(input: CutPrereviewInput): CutPrereviewCheck;
/**
 * Derive every sibling lane from `git worktree list` (via the lane-registry
 * provider — never a fan-out manifest, AC1) and, per lane, report the
 * handoff's active_feature/status/last_agent, `git log <base>..<branch>`,
 * `git status --porcelain`, round counters, and the evidence cross-check
 * (AC2, AC5). Never throws: provider failure, unreadable handoffs, and git
 * failures all degrade (AC3).
 */
export declare function computeLaneStatus(opts?: ComputeLaneStatusOptions): LaneStatusReport;
/**
 * AC4 — same-feature roll-up: sum tickets / hop / review+qa rounds over the
 * lanes whose active_feature === featureId and compare each total against
 * its cap (imported constant, never hardcoded). Hop/ticket totals and the
 * attribution/degrade rules come from tools/feature-rollup.ts's
 * computeFeatureRollup, fed this report's lane list (no re-derivation);
 * only its totals and degrade verdict are kept.
 * AC5 — lanes whose evidence cross-check mismatches are collected.
 */
export declare function rollupSameFeature(report: LaneStatusReport, featureId: string): SameFeatureRollup;
/** Does a lane answer to `name`? Worktree basename, branch lane id, or branch. */
export declare function laneMatchesName(row: LaneStatusRow, name: string): boolean;
/**
 * AC6 — cross-feature (wave-level) roll-up over explicitly named lanes (or
 * every lane with `{ all: true }`), REGARDLESS of each lane's own
 * active_feature. Caps are evaluated per lane only; the combined total is
 * informational and never compared against any cap.
 */
export declare function rollupAcrossLanes(report: LaneStatusReport, selection: {
    all: true;
} | {
    lanes: string[];
}): CrossLaneRollup;
/** AC1-AC3 — plain lane status listing. */
export declare function renderLaneStatus(report: LaneStatusReport): string;
/** AC4/AC5 — same-feature roll-up report. */
export declare function renderSameFeatureRollup(r: SameFeatureRollup): string;
export declare const CROSS_FEATURE_BANNER: readonly ["CROSS-FEATURE ROLL-UP — the lanes below carry their own (possibly different) active_feature values; the sum spans features.", "Caps are evaluated PER LANE — never a shared cap across differing features.", "The combined total is informational only; it is not compared against any cap."];
/** AC6 — cross-feature (wave-level) roll-up report. */
export declare function renderCrossLaneRollup(r: CrossLaneRollup): string;
export declare const LANE_STATUS_USAGE: string;
export interface LaneStatusArgs {
    mode: "status" | "rollup" | "cross" | "watch";
    featureId?: string;
    lanes?: string[];
    all?: boolean;
    baseRef?: string;
    repoRoot?: string;
    json: boolean;
    /** --watch (E178b): polling event stream, served by `runLaneWatch`. */
    watch?: boolean;
    /** --interval <s>, positive integer; --watch only. */
    intervalSeconds?: number;
    /** --deadline <min>, positive integer; --watch only. */
    deadlineMinutes?: number;
    /** Raw --baseline value; parsed against the watched lane keys at start. */
    baseline?: string;
    /** --mailbox-root <dir> (E178b decision (g)); lane listing and --watch only. */
    mailboxRoot?: string;
}
/** Parse argv (without node + script). Throws Error with a usage message. */
export declare function parseLaneStatusArgs(argv: string[]): LaneStatusArgs;
/** Run the CLI end to end; returns what to print and the exit code. */
export declare function runLaneStatusCli(argv: string[], opts?: Omit<ComputeLaneStatusOptions, "repoRoot" | "baseRef">): {
    output: string;
    exitCode: number;
    stream: "stdout" | "stderr";
};
/** Mirrors scripts/mailbox-watch.mjs `DEFAULT_DEADLINE_MINUTES` — tools/ cannot
 *  import scripts/*.mjs under the tsconfig, so the value is declared here and
 *  pinned equal by test (spec decision (f), AC8). */
export declare const WATCH_DEFAULT_DEADLINE_MINUTES = 29;
/** The prototype's 30 s (decision (f)); a handoff changes less often than a mailbox. */
export declare const WATCH_DEFAULT_INTERVAL_SECONDS = 30;
/** Mirrors mailbox-watch.mjs `EXIT_ERROR`. */
export declare const WATCH_EXIT_ERROR = 1;
/** Mirrors mailbox-watch.mjs `EXIT_EXPIRED`. */
export declare const WATCH_EXIT_EXPIRED = 3;
/** Mirrors mailbox-watch.mjs `EXIT_USAGE`. */
export declare const WATCH_EXIT_USAGE = 64;
/** Hex characters of sha256(state line) carried in --baseline (decision (d)). */
export declare const WATCH_FINGERPRINT_LENGTH = 12;
/** Watched keys, in state-line order (decision (c)). */
export declare const WATCH_STATE_KEYS: readonly ["feature", "status", "last_agent", "next_role", "hop", "review_round", "qa_round"];
/** Decision (c)'s optional last key, present only under --mailbox-root. */
export declare const WATCH_PREREVIEW_KEY = "cut_prereview";
/** State line of a `--lanes`-named lane that matches no worktree. */
export declare const WATCH_GONE_STATE = "gone";
/** One lane's watched state as of one read. */
export interface LaneWatchState {
    /** Watch key: the worktree basename (or the `--lanes` name as given). */
    lane: string;
    workspacePath: string;
    readable: boolean;
    /** Set whenever `readable` is false. Single line. */
    reason?: string;
    /** Ordered (key, display value) pairs; empty when unreadable. */
    fields: [string, string][];
}
export interface LaneWatchIo {
    out: (line: string) => void;
    err: (line: string) => void;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
}
export interface LaneWatchOptions {
    /** Lane list source. Default `laneRegistryList` (tools/lane-registry.ts). */
    laneListProvider?: LaneListProvider;
    /** Handoff reader. Default `parseHandoff`. */
    handoffReader?: (workspacePath: string) => HandoffState | null;
    /** Injectable clock / sleep / output (AC7). */
    io?: Partial<LaneWatchIo>;
}
/** The state line (Copy/Strings watch.state / watch.unreadable). */
export declare function formatWatchState(s: LaneWatchState | null): string;
/** First WATCH_FINGERPRINT_LENGTH hex chars of sha256(state line) (decision (d)). */
export declare function watchFingerprint(stateLine: string): string;
/** Keys whose values moved, in `next`'s key order. [] unless both are readable. */
export declare function diffWatchState(prev: LaneWatchState, next: LaneWatchState): string[];
/**
 * Read one lane's watched state from its lane-list entry + its handoff
 * (decision (b)). Never throws: every failure becomes `readable: false` with
 * a one-line reason (AC3). A handoff naming no active_feature is unreadable,
 * the same rule computeLaneStatus applies.
 */
export declare function readLaneWatchState(key: string, info: LaneInfo, readHandoff: (workspacePath: string) => HandoffState | null, mailboxRoot?: string): LaneWatchState;
/**
 * Parse a --baseline value (`<lane>=<fp>,...`, the fingerprints a previous
 * watch printed) against the watched keys. A repeated key, a malformed entry
 * or an empty value is always a usage error, and the whole value is
 * validated before anything is printed.
 * An unknown key (one naming no watched lane) is a usage error unless
 * `unknownIsGone` is set — the default watch set, where it is a lane that
 * closed since the last watch. Such keys are kept in the returned map, in
 * --baseline order, for the caller to report as gone; an all-gone value is
 * not empty. (E178b, E223)
 */
export declare function parseWatchBaseline(value: string | undefined, keys: readonly string[], opts?: {
    unknownIsGone?: boolean;
}): Map<string, string>;
export interface WatchRearmArgs {
    lanes?: string[];
    intervalSeconds: number;
    deadlineMinutes: number;
    /** Absolute; carried only when --mailbox-root was given. */
    mailboxRoot?: string;
    /** Absolute; carried only when --repo was given. */
    repoRoot?: string;
}
/**
 * The ready-to-run re-arm command (Copy/Strings watch.rearm). `lastRead` is
 * [key, state line as last read] in watch order; non-default --interval /
 * --deadline and any given --lanes / --mailbox-root / --repo are carried
 * (AC4). No --baseline when nothing is watched (an empty one is a usage error).
 */
export declare function formatWatchRearmCommand(lastRead: [string, string][], a: WatchRearmArgs): string;
/**
 * AC1-AC9 — `lane-status --watch` end to end. Resolves to the exit code:
 * WATCH_EXIT_EXPIRED at the deadline, WATCH_EXIT_USAGE on a usage error,
 * WATCH_EXIT_ERROR on a runtime error. Never rejects.
 */
export declare function runLaneWatch(argv: string[], opts?: LaneWatchOptions): Promise<number>;
//# sourceMappingURL=lane-status.d.ts.map