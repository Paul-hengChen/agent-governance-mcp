import type { HandoffState } from "../tools/handoff.js";
export declare function stripChainOnly(text: string): string;
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
export declare function buildPromptForRole(skillFile: string, description: string, workspacePath: string): {
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