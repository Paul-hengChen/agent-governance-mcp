import type { HandoffState } from "../tools/handoff.js";
export declare function composeConstitution(opts: {
    chain: boolean;
    design: boolean;
}, workspacePath?: string): string;
/**
 * The one renderer for a parsed handoff state, shared by buildPromptForRole
 * and the SessionStart hook (via dist/) so both emit byte-identical blocks.
 * sanitizeForRender deep-clones first, JSON encoding escapes every newline,
 * and renderDataBlock supplies the unclosable fence (specs/e137-render-sanitise.md).
 */
export declare function renderHandoffStateBlock(state: HandoffState): string;
/**
 * The S02 "lookup failed" block (E137), shared by buildPromptForRole and the
 * SessionStart hook. The error message (which may be HANDOFF_LAYOUT_CONFLICT,
 * a refuse-loud schema-version throw, or a YAML parse error quoting lines of
 * the file) renders inside the render boundary, never as top-level text.
 */
export declare function renderStateLookupFailedBlock(handoffPath: string, error: Error): string;
/**
 * The "no state" diagnostic footer (E137; spec ruling item 4, Copy/Strings
 * footer.bothpaths): the "no state" diagnostic names BOTH the lane-scoped
 * handoff path and the legacy flat one, because the read path (parseHandoff)
 * falls back lane → flat — a reader debugging a missing state needs to know
 * both places were looked at. `workspacePath` is resolved to an absolute path
 * first (L-SCHEMA-NEW-9).
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