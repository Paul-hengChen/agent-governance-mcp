// Coded by @sr-engineer
// MCP Prompt: pm role.
import { buildPromptForRole } from "./build.js";
export function buildPmPrompt(workspacePath) {
    return buildPromptForRole("skill-pm.md", "PM role. Write specs, break down tasks, sync state.", workspacePath);
}
//# sourceMappingURL=pm.js.map