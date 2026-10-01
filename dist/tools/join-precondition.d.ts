/** One `depends_on` branch's ancestry result. */
export interface LaneAncestryResult {
    branch: string;
    isAncestor: boolean;
    /** Populated only when `isAncestor` is false AND the branch could not be
     * cleanly evaluated (unknown/deleted branch, git failure) — never set for
     * a clean "exists but not yet merged" negative result. */
    error?: string;
}
/**
 * For each branch, runs `git merge-base --is-ancestor <branch> HEAD` with
 * `cwd` pinned to `repoRoot`. Never throws: a clean "not merged yet" (git
 * exit 1) is `{ isAncestor: false }`; any other failure (unknown branch, git
 * unavailable, corrupt repo) is `{ isAncestor: false, error }`, never `true`.
 */
export declare function checkLaneAncestry(branches: string[], repoRoot: string): LaneAncestryResult[];
/** The only membership finding possible: this workspace's own actual
 * `active_feature` is absent from EVERY row declared in
 * `.current/feature-split.md`. Names the full declared set alongside the
 * actual value — never one entry per non-matching row (a Split Table has one
 * row per planned lane, so sibling rows declaring a different lane are
 * expected, not mismatches; see Amendment History,
 * specs/e115-join-precondition-check.md). */
export interface LaneIdentityMismatch {
    /** Every populated feature-identity value found in feature-split.md,
     * order as parsed. */
    declaredFeatureIds: string[];
    actual: string;
}
export interface LaneIdentityCheckResult {
    /** false when there was nothing honest to compare (see `reason`). */
    compared: boolean;
    reason?: string;
    mismatches: LaneIdentityMismatch[];
}
/**
 * Checks that THIS workspace's own handoff `active_feature` is a member of the
 * feature ids declared in its own `.current/feature-split.md` (one row per
 * planned lane, so non-matching sibling rows are healthy). Absent from every
 * row -> exactly one finding naming the full declared set. No split file, no
 * identity column, or no readable active_feature -> `{ compared: false, reason }`.
 * Why: specs/e260b-rationale.md (tools/join-precondition.ts)
 */
export declare function checkDeclaredVsActualLaneIdentity(repoRoot: string): LaneIdentityCheckResult;
/**
 * Renders the combined ancestry + declared-vs-actual identity results as a
 * human-readable report, suitable for pasting into chat ahead of a join.
 * Takes both check results directly (no hidden re-read of any path) so the
 * CLI wrapper (scripts/join-precondition.mjs) can call checkLaneAncestry /
 * checkDeclaredVsActualLaneIdentity itself and pass their results straight
 * through.
 */
export declare function renderJoinPreconditionReport(ancestry: LaneAncestryResult[], identity: LaneIdentityCheckResult): string;
//# sourceMappingURL=join-precondition.d.ts.map