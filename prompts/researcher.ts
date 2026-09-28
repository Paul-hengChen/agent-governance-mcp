// Coded by @sr-engineer
// MCP Prompt: researcher role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildResearcherPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-researcher.md",
    "Deep research. Load constitution, skill, state.",
    workspacePath,
  );
}
