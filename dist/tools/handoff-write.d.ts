import type { AgentName } from "./transitions.js";
import type { ExternalRef, ResumeOfTarget, ReviewVerdict, DispatchMode } from "./handoff-types.js";
/**
 * v3.15.0 options-object shape for writeHandoffState's modern overload.
 * Prefer this form at all new call sites. The legacy positional signature
 * is retained for backwards-compat until v4.0.0.
 */
export interface WriteHandoffStateOptions {
    workspacePath: string;
    activeFeature: string;
    status: string;
    completedTasks?: string[];
    pendingNotes?: string[];
    blockingReason?: string;
    lastAgent?: string;
    qaRound?: number;
    prdPath?: string;
    reviewRound?: number;
    visualRound?: number;
    hopCount?: number;
    qaRoundsTotal?: number;
    reviewRoundsTotal?: number;
    visualRoundsTotal?: number;
    scopeDecision?: string;
    scopeDecisionWhy?: string;
    cutApproved?: boolean;
    externalRefs?: ExternalRef[];
    nextRole?: AgentName;
    resumeOf?: ResumeOfTarget;
    reviewVerdict?: ReviewVerdict;
    dispatchPins?: Partial<Record<AgentName, string>>;
    dispatchMode?: DispatchMode;
    evidenceSchema?: number;
    bookkeepingWrite?: boolean;
}
/**
 * Write handoff state. v3.15.0 dual API:
 *   - Modern (preferred): `writeHandoffState(options)` — pass a
 *     {@link WriteHandoffStateOptions} object. New call sites should use this
 *     form.
 *   - Legacy (deprecated): `writeHandoffState(workspacePath, activeFeature, …)`
 *     — 11 positional params. Retained for backwards-compat with v3.14.x
 *     callers; planned removal in v4.0.0.
 *
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export declare function writeHandoffState(opts: WriteHandoffStateOptions): Promise<string>;
/**
 * @deprecated v3.15.0: prefer the options-object overload
 * `writeHandoffState({ workspacePath, activeFeature, status, ... })`.
 * Positional signature retained for backwards-compat; planned removal in v4.0.0.
 */
export declare function writeHandoffState(workspacePath: string, activeFeature: string, status: string, completedTasks: string[], pendingNotes: string[], blockingReason?: string, lastAgent?: string, qaRound?: number, prdPath?: string, reviewRound?: number, visualRound?: number, hopCount?: number): Promise<string>;
//# sourceMappingURL=handoff-write.d.ts.map