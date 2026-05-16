// Coded by @sr-engineer
// MCP Prompt: architect role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildArchitectPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-architect.md",
    "Architect role. Write system design, interface contracts.",
    workspacePath,
  );
}
