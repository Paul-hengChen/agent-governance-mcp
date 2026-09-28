// Coded by @sr-engineer
// MCP Prompt: teamwork — coordinator role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildCoordinatorPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-coordinator.md",
    "Agent Governance Coordinator. Route tasks or execute them.",
    workspacePath,
  );
}
