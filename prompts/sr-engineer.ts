// Coded by @sr-engineer
// MCP Prompt: sr-engineer role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildSrEngineerPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-sr-engineer.md",
    "Load constitution, skill, state. Run first.",
    workspacePath,
  );
}
