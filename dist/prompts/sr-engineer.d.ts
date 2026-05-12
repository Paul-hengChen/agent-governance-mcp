/**
 * Build the sr-engineer prompt with dynamic state injection.
 * This is the key mechanism that makes ANY AI agent follow our rules
 * without manual system prompt configuration.
 */
export declare function buildSrEngineerPrompt(workspacePath: string): {
    description: string;
    messages: Array<{
        role: "user";
        content: {
            type: "text";
            text: string;
        };
    }>;
};
//# sourceMappingURL=sr-engineer.d.ts.map