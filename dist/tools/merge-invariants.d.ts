export declare const MERGE_INVARIANTS_EXIT: {
    readonly PASS: 0;
    readonly FAIL: 1;
    readonly NOT_A_MERGE_COMMIT: 2;
    readonly NO_MERGE_BASE: 3;
    readonly USAGE_ERROR: 4;
};
export type MergeInvariantsCode = keyof typeof MERGE_INVARIANTS_EXIT;
export declare const MERGE_INVARIANTS_USAGE: string;
export type RowState = " " | "x" | "-";
export declare const SIDECAR_KINDS: readonly ["dispatch", "telemetry", "metrics", "usage"];
export type SidecarKind = (typeof SIDECAR_KINDS)[number];
export interface TaskRow {
    taskId: string;
    state: RowState;
    file: string;
    /** Enclosing `## ` heading text (trimmed), null before any H2 / after an H1. */
    section: string | null;
}
export interface ManifestEntry {
    done: number;
    voided: number;
}
export interface LedgerSnapshot {
    file: string;
    rows: TaskRow[];
    /** `## Compacted History` bullets keyed by section heading text; null = no manifest. */
    manifest: Map<string, ManifestEntry> | null;
}
export interface SidecarCount {
    kind: SidecarKind;
    lane: string | null;
    records: number;
    paths: string[];
}
export interface CommitSnapshot {
    label: string;
    sha: string;
    ledgers: Map<string, LedgerSnapshot>;
    rowsById: Map<string, TaskRow[]>;
    /** keyed by sidecarKey(kind, lane) */
    sidecars: Map<string, SidecarCount>;
}
/** Thrown for anything that must surface as USAGE_ERROR rather than a stack trace. */
export declare class MergeInvariantsUsageError extends Error {
}
/** Ledger path shape per spec Definitions → Row identity; null = not a ledger. */
export declare function isLedgerPath(p: string): boolean;
export interface SidecarPathInfo {
    kind: SidecarKind;
    lane: string | null;
    source: "flat" | "live" | "history";
}
/** Sidecar path shape (flat / live lane / history lane); null = not a sidecar. */
export declare function classifySidecarPath(p: string): SidecarPathInfo | null;
export declare function sidecarKey(kind: SidecarKind, lane: string | null): string;
/**
 * Parse one ledger's text: checkbox rows (via the workspace's configured task
 * regex; the `[-]` void marker is normalized to `[ ]` for id extraction only)
 * and the `## Compacted History` manifest, which counts ONLY when its first
 * non-blank line is the `<!-- compacted: ... -->` marker.
 */
export declare function parseLedger(file: string, content: string, taskRegex: RegExp): LedgerSnapshot;
/**
 * Read one commit's ledgers + sidecars from git objects. `blobCache` is shared
 * across the four commits of one run so an unchanged file is read once.
 */
export declare function readCommitSnapshot(repoRoot: string, sha: string, label: string, taskRegex: RegExp, blobCache?: Map<string, Buffer>): CommitSnapshot;
export declare const HISTORY_COMMIT_CAP = 256;
export type HistoryFallbackReason = "shallow" | "unreadable" | "cap" | "unreconciled";
/** One walk: compacting parent P_c, ledger file F, the sections whose verdict depends on it, sorted. */
export interface HistoryRequest {
    parent: CommitSnapshot;
    file: string;
    sections: string[];
}
/** Walk outcome for one F/S. `summarized` = recovered task_id -> counted state; null = snapshot-only rule. */
export interface SectionHistory {
    parent: string;
    parentSha: string;
    file: string;
    section: string;
    summarized: Map<string, RowState> | null;
    /** Non-null => one WARN line; the section keeps the snapshot-only rule. */
    fallback: {
        reason: HistoryFallbackReason;
        detail: string;
    } | null;
}
export interface HistoryFallback {
    parent: string;
    parentSha: string;
    file: string;
    section: string;
    reason: HistoryFallbackReason;
    /** The text after the class keyword in the WARN line ("" for shallow). */
    detail: string;
}
/**
 * Sections whose (c) verdict depends on history: the merge's F names S (t1),
 * exactly one parent's F names S (t2, that parent is P_c), and the other
 * parent has a closed row under F/S that is nowhere at the merge (t3).
 * Grouped per (P_c, F); empty means no extra git call at all.
 */
export declare function compactionHistoryRequests(p1: CommitSnapshot, p2: CommitSnapshot, _base: CommitSnapshot, merge: CommitSnapshot): HistoryRequest[];
/** Every requested section of one walk falls back with the same reason. */
export declare function historyFallbackAll(req: HistoryRequest, reason: HistoryFallbackReason, detail: string): SectionHistory[];
/** WARN detail for a failed git call: first non-empty stderr line, else message line, else a fixed text; never empty. */
export declare function historyErrorDetail(err: unknown, subcommand: string): string;
/** True iff `git version` output names 2.44 or later (the first release honouring GIT_NO_LAZY_FETCH). */
export declare function gitVersionAllowsNoLazyFetch(versionText: string): boolean;
/** Run probes p1-p3 (spec step 2): shallow, or an unreadable detail, or null when walks may read. */
export declare function probeHistoryReadable(repoRoot: string): {
    reason: "shallow" | "unreadable";
    detail: string;
} | null;
/**
 * One walk over P_c's history between the merge-base and P_c for ledger F,
 * one entry per requested section. Never throws: shallow, unreadable and
 * over-cap history map to a fallback (snapshot-only rule + WARN line).
 */
export declare function readCompactionHistory(repoRoot: string, baseSha: string, req: HistoryRequest, blobCache: Map<string, Buffer>, opts: {
    cap: number;
    shallow: boolean;
    taskRegex: RegExp;
}): SectionHistory[];
export interface ParentRowRef extends TaskRow {
    parent: string;
    parentSha: string;
}
export interface MissingRow {
    taskId: string;
    foundAt: ParentRowRef[];
    checkedAtMerge: string[];
    /** Why the compaction exemption did not apply (one per ineligible occurrence); empty when no occurrence came near it. */
    reasons: string[];
}
export interface LostCompletion {
    taskId: string;
    doneAt: ParentRowRef[];
    atMerge: TaskRow[];
}
export interface CompactedRow {
    taskId: string;
    occurrences: ParentRowRef[];
}
export interface SidecarShortfall {
    kind: SidecarKind;
    lane: string | null;
    merge: number;
    parent1: number;
    parent2: number;
    base: number;
    expectedMin: number;
}
export interface MergeInvariantsFindings {
    rowsChecked: number;
    missing: MissingRow[];
    lostCompletions: LostCompletion[];
    compacted: CompactedRow[];
    sidecarsChecked: number;
    sidecarShortfalls: SidecarShortfall[];
    /** One per F/S whose history walk fell back; [] when none. */
    historyFallbacks: HistoryFallback[];
}
/** Pure. `history` = walk outcomes; [] (or only null-`summarized` entries) is the snapshot-only rule. */
export declare function evaluateMergeInvariants(p1: CommitSnapshot, p2: CommitSnapshot, base: CommitSnapshot, merge: CommitSnapshot, history?: SectionHistory[]): MergeInvariantsFindings;
export declare function renderMergeInvariantsReport(shas: {
    merge: string;
    parent1: string;
    parent2: string;
    base: string;
}, f: MergeInvariantsFindings): string;
export interface MergeInvariantsResult {
    code: MergeInvariantsCode;
    exitCode: (typeof MERGE_INVARIANTS_EXIT)[MergeInvariantsCode];
    report: string;
    findings?: MergeInvariantsFindings;
}
/**
 * Exported entrypoint: never throws; every outcome maps to an exit code.
 * `opts.historyCommitCap` is a test knob only; the CLI never passes it.
 */
export declare function runMergeInvariants(ref?: string, repoRoot?: string, opts?: {
    historyCommitCap?: number;
}): MergeInvariantsResult;
/** Parse argv (`[ref] [--ref <ref>] [abs-repo-root]`) and run; never throws. */
export declare function runMergeInvariantsCli(argv: string[], cwd: string): MergeInvariantsResult;
//# sourceMappingURL=merge-invariants.d.ts.map