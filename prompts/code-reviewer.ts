// Coded by @sr-engineer
// MCP Prompt: code-reviewer role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildCodeReviewerPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-code-reviewer.md",
    "Code review role — the chain's judge: reviews tests and implementation, writes PASS.",
    workspacePath,
  );
}
