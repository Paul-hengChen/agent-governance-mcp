// Coded by @sr-engineer
// MCP Prompt: code-reviewer role.
import { buildPromptForRole } from "./build.js";
export function buildCodeReviewerPrompt(workspacePath) {
    return buildPromptForRole("skill-code-reviewer.md", "Code review role — clean-context diff judge between sr-engineer and qa-engineer.", workspacePath);
}
//# sourceMappingURL=code-reviewer.js.map