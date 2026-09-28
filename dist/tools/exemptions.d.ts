export declare const EXEMPTIONS_SCHEMA_VERSION = 1;
export interface ExemptionEntry {
    path: string;
    reason: string;
    expires_when: string;
}
export interface ExemptionsView {
    count: number;
    entries: ExemptionEntry[];
    errors: string[];
}
/**
 * Load and validate .current/exemptions.json for a workspace.
 * Returns null when the manifest does not exist (zero exemptions, no signal).
 * NEVER throws — see module header for the failure-mode table.
 */
export declare function loadExemptions(workspacePath: string): ExemptionsView | null;
//# sourceMappingURL=exemptions.d.ts.map