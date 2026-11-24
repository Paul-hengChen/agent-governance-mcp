// Coded by @sr-engineer
// MCP Prompt: code-reviewer role.
import { buildPromptForRole } from "./build.js";
export function buildCodeReviewerPrompt(workspacePath) {
    return buildPromptForRole("skill-code-reviewer.md", "Code review role — the chain's judge: reviews tests and implementation, writes PASS.", workspacePath);
}
//# sourceMappingURL=code-reviewer.js.map