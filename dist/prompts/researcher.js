// Coded by @sr-engineer
// MCP Prompt: researcher role.
import { buildPromptForRole } from "./build.js";
export function buildResearcherPrompt(workspacePath) {
    return buildPromptForRole("skill-researcher.md", "Deep research. Load constitution, skill, state.", workspacePath);
}
//# sourceMappingURL=researcher.js.map