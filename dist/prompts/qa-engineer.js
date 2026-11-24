// Coded by @sr-engineer
// MCP Prompt: qa-engineer role.
import { buildPromptForRole } from "./build.js";
export function buildQaEngineerPrompt(workspacePath) {
    return buildPromptForRole("skill-qa-engineer.md", "QA role. Write each ticket scenario as a test before the build; no verdict.", workspacePath);
}
//# sourceMappingURL=qa-engineer.js.map