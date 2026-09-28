// Coded by @sr-engineer
// MCP Prompt: teamwork — coordinator role.
import { buildPromptForRole } from "./build.js";
export function buildCoordinatorPrompt(workspacePath) {
    return buildPromptForRole("skill-coordinator.md", "Agent Governance Coordinator. Route tasks or execute them.", workspacePath);
}
//# sourceMappingURL=coordinator.js.map