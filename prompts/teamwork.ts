// Coded by @sr-engineer
// MCP Prompt: teamwork — coordinator role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildTeamworkPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-coordinator.md",
    "Teamwork Coordinator. Route tasks or execute them.",
    workspacePath,
  );
}
