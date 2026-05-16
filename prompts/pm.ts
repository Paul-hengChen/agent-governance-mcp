// Coded by @sr-engineer
// MCP Prompt: pm role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildPmPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-pm.md",
    "PM role. Write specs, break down tasks, sync state.",
    workspacePath,
  );
}
