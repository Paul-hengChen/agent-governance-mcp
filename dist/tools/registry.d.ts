import { z } from "zod";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { PromptResult } from "../prompts/build.js";
export type ToolResult = CallToolResult;
export interface ToolRegistryEntry {
    name: string;
    description: string;
    inputSchema: Tool["inputSchema"];
    run: (rawArgs: unknown) => Promise<ToolResult>;
}
export interface PromptRegistryEntry {
    name: string;
    description: string;
    arguments: Array<{
        name: string;
        description: string;
        required: boolean;
    }>;
    build: (workspacePath: string) => PromptResult;
}
export declare function defineTool<TSchema extends z.ZodTypeAny>(spec: {
    name: string;
    description: string;
    inputSchema: Tool["inputSchema"];
    zodSchema: TSchema;
    handler: (args: z.infer<TSchema>) => Promise<ToolResult>;
}): ToolRegistryEntry;
declare const WorkspaceOnly: z.ZodObject<{
    workspace_path: z.ZodString;
}, z.core.$strip>;
declare const UpdateStateArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    active_feature: z.ZodString;
    status: z.ZodEnum<{
        PASS: "PASS";
        FAIL: "FAIL";
        Blocked: "Blocked";
        In_Progress: "In_Progress";
    }>;
    completed_tasks: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pending_notes: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    blocking_reason: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    qa_review: z.ZodOptional<z.ZodString>;
    prd_path: z.ZodOptional<z.ZodString>;
    scope_decision: z.ZodOptional<z.ZodEnum<{
        "single-feature": "single-feature";
    }>>;
    scope_decision_why: z.ZodOptional<z.ZodString>;
    cut_approved: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
declare const CompleteTaskArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    task_id: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const RollbackTaskArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    task_id: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
declare const AddTaskArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    task_id: z.ZodString;
    description: z.ZodString;
    section: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const SwitchRoleArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    role: z.ZodEnum<{
        pm: "pm";
        researcher: "researcher";
        "design-auditor": "design-auditor";
        "sr-engineer": "sr-engineer";
        "code-reviewer": "code-reviewer";
        "qa-engineer": "qa-engineer";
        architect: "architect";
        "doc-writer": "doc-writer";
        "release-engineer": "release-engineer";
    }>;
}, z.core.$strip>;
declare const IndexPrdArgs: z.ZodObject<{
    workspace_path: z.ZodString;
    prd_path: z.ZodString;
    embedding_model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkspaceOnlyInput = z.infer<typeof WorkspaceOnly>;
export type UpdateStateInput = z.infer<typeof UpdateStateArgs>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskArgs>;
export type RollbackTaskInput = z.infer<typeof RollbackTaskArgs>;
export type AddTaskInput = z.infer<typeof AddTaskArgs>;
export type SwitchRoleInput = z.infer<typeof SwitchRoleArgs>;
export type IndexPrdInput = z.infer<typeof IndexPrdArgs>;
export declare const TOOL_REGISTRY: ToolRegistryEntry[];
export declare const PROMPT_REGISTRY: PromptRegistryEntry[];
export {};
//# sourceMappingURL=registry.d.ts.map