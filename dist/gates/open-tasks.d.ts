import type { TaskRecord } from "../tools/tasks-file.js";
export interface FeatureLaneLedger {
    readonly armed: boolean;
    readonly ledgerPath: string | null;
}
/**
 * Resolves the feature's own lane ledger. Armed only when it sits directly in
 * `.current/<L>/`, `<L>` is not `_`-prefixed, and the lowercased feature is `<L>`
 * or starts with `<L>-`; any other ledger leaves the check off. Read-only.
 */
export declare function featureLaneLedger(workspacePath: string, activeFeature: string): FeatureLaneLedger;
/**
 * Lists the ids of open rows not in `completedIds`, once each, in ledger order,
 * skipping post-sign-off role rows. Pure.
 */
export declare function listOpenFeatureTasks(tasks: readonly TaskRecord[], completedIds: ReadonlySet<string>): string[];
//# sourceMappingURL=open-tasks.d.ts.map