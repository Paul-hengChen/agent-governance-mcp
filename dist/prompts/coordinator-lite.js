// Coded by @sr-engineer
// MCP Prompt: teamwork-lite — coordinator-lite (solo-dev minimal-overhead) role.
import { buildPromptForRole } from "./build.js";
export function buildCoordinatorLitePrompt(workspacePath) {
    return buildPromptForRole("skill-coordinator-lite.md", "Agent Governance Coordinator (lite). Direct execution, no chain, no state writes.", workspacePath);
}
//# sourceMappingURL=coordinator-lite.js.map