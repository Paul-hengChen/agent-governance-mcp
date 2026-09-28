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
}
export declare function evaluateMergeInvariants(p1: CommitSnapshot, p2: CommitSnapshot, base: CommitSnapshot, merge: CommitSnapshot): MergeInvariantsFindings;
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
/** Exported entrypoint: never throws; every outcome maps to an exit code. */
export declare function runMergeInvariants(ref?: string, repoRoot?: string): MergeInvariantsResult;
/** Parse argv (`[ref] [--ref <ref>] [abs-repo-root]`) and run; never throws. */
export declare function runMergeInvariantsCli(argv: string[], cwd: string): MergeInvariantsResult;
//# sourceMappingURL=merge-invariants.d.ts.map