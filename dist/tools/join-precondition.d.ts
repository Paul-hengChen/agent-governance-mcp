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
 * For each branch in `branches`, runs `git merge-base --is-ancestor <branch>
 * HEAD` with `cwd` pinned to `repoRoot` — never any other path. Never
 * throws: per branch, a clean negative (git exit 1 — the branch exists but
 * is simply not merged yet) degrades to `{ isAncestor: false }` with no
 * error, while any other failure (unknown/deleted branch, corrupt repo, git
 * unavailable, etc.) degrades to `{ isAncestor: false, error }` — naming the
 * failure rather than crashing the caller or silently coercing an unknown
 * result to `true` (AC1, AC2).
 */
export declare function checkLaneAncestry(branches: string[], repoRoot: string): LaneAncestryResult[];
/** The single membership finding possible under AC3's amended semantics:
 * this workspace's own actual `active_feature` is absent from EVERY row
 * declared in `.current/feature-split.md`. Names the full declared set
 * alongside the actual value — never one entry per non-matching row (a
 * Split Table has one row per planned lane, so sibling rows declaring a
 * different lane are expected, not mismatches; see Amendment History,
 * specs/e115-join-precondition-check.md:195). */
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
 * Reads THIS workspace's own `.current/feature-split.md` (never any other
 * workspace's) for its declared per-row feature identity, and checks
 * MEMBERSHIP of THIS workspace's own actual `.current/handoff.md`
 * `active_feature` (read via `parseHandoff(repoRoot)` — no other path is
 * ever read) within the full declared set (AC3, amended round 1). A Split
 * Table has one row per PLANNED lane, so at most one row can ever equal
 * this single workspace's `active_feature` — sibling rows declaring a
 * different lane are the expected, healthy shape, not a mismatch:
 *   - `actual` present in ANY declared row -> satisfied, `mismatches: []`,
 *     regardless of how many sibling rows declare something else.
 *   - `actual` absent from EVERY declared row -> exactly ONE finding
 *     naming the full declared set alongside `actual` (never one finding
 *     per non-matching row — that was the round-1 defect: it fabricated a
 *     mismatch on every healthy multi-row plan).
 * Rows are never skipped or special-cased by a `status` column — that
 * would make pass/fail depend on status-column hygiene, a remedy the PM
 * considered and refuted (Amendment History, spec:195).
 *
 * Degrades honestly rather than fabricating a verdict (AC4): when
 * `feature-split.md` is absent, when it has no recognizable feature-identity
 * column, or when this workspace's own handoff can't be read/has no
 * active_feature, this returns `{ compared: false, reason }` — never a
 * fabricated match or mismatch.
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