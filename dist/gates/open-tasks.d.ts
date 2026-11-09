import type { TaskRecord } from "../tools/tasks-file.js";
export interface FeatureLaneLedger {
    readonly armed: boolean;
    readonly ledgerPath: string | null;
}
/**
 * Resolves the active feature's own lane ledger, or reports the check as off.
 *
 * Armed only when the resolved ledger sits directly in `.current/<L>/`, `<L>`
 * is not `_`-prefixed, and the lowercased feature equals `<L>` or starts with
 * `<L>-`. Read-only.
 */
export declare function featureLaneLedger(workspacePath: string, activeFeature: string): FeatureLaneLedger;
/**
 * Lists the ids of open rows not in `completedIds`, once each, in ledger order.
 *
 * Rows whose description starts with a post-sign-off role prefix are skipped.
 * Pure.
 */
export declare function listOpenFeatureTasks(tasks: readonly TaskRecord[], completedIds: ReadonlySet<string>): string[];
//# sourceMappingURL=open-tasks.d.ts.map