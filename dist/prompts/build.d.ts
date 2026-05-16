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