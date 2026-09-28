// Coded by @sr-engineer
// MCP Prompt: architect role.
import { buildPromptForRole } from "./build.js";
export function buildArchitectPrompt(workspacePath) {
    return buildPromptForRole("skill-architect.md", "Architect role. Write system design, interface contracts.", workspacePath);
}
//# sourceMappingURL=architect.js.map