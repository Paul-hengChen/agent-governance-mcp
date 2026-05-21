// Coded by @sr-engineer
// MCP Prompt: design-auditor role (v3.8.0).
import { buildPromptForRole } from "./build.js";
export function buildDesignAuditorPrompt(workspacePath) {
    return buildPromptForRole("skill-design-auditor.md", "Design audit. Load constitution, skill, state.", workspacePath);
}
//# sourceMappingURL=design-auditor.js.map