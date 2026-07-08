import type { HandoffState } from "../tools/handoff.js";
export declare function composeConstitution(opts: {
    chain: boolean;
    design: boolean;
}, workspacePath?: string): string;
export declare function stripRationale(text: string): string;
export declare function stripOriginTags(text: string): string;
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