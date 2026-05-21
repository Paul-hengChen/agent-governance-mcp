// Coded by @sr-engineer
// MCP Prompt: design-auditor role (v3.8.0).
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildDesignAuditorPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-design-auditor.md",
    "Design audit. Load constitution, skill, state.",
    workspacePath,
  );
}
