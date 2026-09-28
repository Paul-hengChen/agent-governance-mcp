// Coded by @sr-engineer
// MCP Prompt: teamwork-lite — coordinator-lite (solo-dev minimal-overhead) role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildCoordinatorLitePrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-coordinator-lite.md",
    "Agent Governance Coordinator (lite). Direct execution, no chain, no state writes.",
    workspacePath,
  );
}
