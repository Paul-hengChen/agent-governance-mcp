// Coded by @sr-engineer
// MCP Prompt: qa-engineer role.
import { buildPromptForRole } from "./build.js";
export function buildQaEngineerPrompt(workspacePath) {
    return buildPromptForRole("skill-qa-engineer.md", "QA role. Verify code, write tests, rollback bugs.", workspacePath);
}
//# sourceMappingURL=qa-engineer.js.map