import type { HandoffState } from "../tools/handoff.js";
export declare function composeConstitution(opts: {
    chain: boolean;
    design: boolean;
}, workspacePath?: string): string;
/**
 * E137: the ONE renderer for a parsed handoff state, shared by
 * buildPromptForRole and bin/agent-governance-context.mjs (the SessionStart
 * hook imports it from dist/), so both sites emit byte-identical state blocks
 * (spec AC4). E122's sanitizeForRender runs first (a deep clone — the caller's
 * object is never mutated); JSON encoding escapes every newline, so no value
 * can start a line of its own; renderDataBlock supplies the unclosable fence.
 * Additive (spec AC11): JSON.parse of the fence body deep-equals
 * sanitizeForRender(state).
 */
export declare function renderHandoffStateBlock(state: HandoffState): string;
/**
 * E137: the S02 "lookup failed" block, shared by buildPromptForRole and the
 * SessionStart hook. The error message (which may be HANDOFF_LAYOUT_CONFLICT,
 * a refuse-loud schema-version throw, or a YAML parse error quoting lines of
 * the file) renders inside the render boundary, never as top-level text.
 */
export declare function renderStateLookupFailedBlock(handoffPath: string, error: Error): string;
/**
 * E137 (spec ruling item 4, Copy/Strings footer.bothpaths): the "no state"
 * diagnostic names BOTH the lane-scoped handoff path and the legacy flat one,
 * because the read path (parseHandoff) falls back lane → flat — a reader
 * debugging a missing state needs to know both places were looked at.
 * `workspacePath` is resolved to an absolute path first (L-SCHEMA-NEW-9).
 */
export declare function describeMissingHandoff(workspacePath: string): string;
export { stripRationale, stripOriginTags } from "./text-transforms.js";
export type WorkspaceSource = "workspace_path arg" | "CLAUDE_PROJECT_DIR env" | "cwd fallback";
export type PromptResult = {
    description: string;
    messages: Array<{
        role: "user";
        content: {
            type: "text";
            text: string;
        };
    }>;
};
export declare function resolvePrdPath(workspacePath: string, state: HandoffState | null): string | null;
export declare function appendSpecContext(result: PromptResult, workspacePath: string, role?: string): Promise<PromptResult>;
export declare function buildPromptForRole(skillFile: string, description: string, workspacePath: string, fullDetail?: boolean, resolutionSource?: WorkspaceSource, omitConstitution?: boolean): {
    description: string;
    messages: Array<{
        role: "user";
        content: {
            type: "text";
            text: string;
        };
    }>;
};
//# sourceMappingURL=build.d.ts.map