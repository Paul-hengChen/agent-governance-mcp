// Coded by @sr-engineer
// MCP Prompt: sr-engineer role.
import { buildPromptForRole } from "./build.js";
export function buildSrEngineerPrompt(workspacePath) {
    return buildPromptForRole("skill-sr-engineer.md", "Load constitution, skill, state. Run first.", workspacePath);
}
//# sourceMappingURL=sr-engineer.js.map