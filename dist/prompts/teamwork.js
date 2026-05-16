// Coded by @sr-engineer
// MCP Prompt: teamwork — coordinator role.
import { buildPromptForRole } from "./build.js";
export function buildTeamworkPrompt(workspacePath) {
    return buildPromptForRole("skill-coordinator.md", "Teamwork Coordinator. Route tasks or execute them.", workspacePath);
}
//# sourceMappingURL=teamwork.js.map