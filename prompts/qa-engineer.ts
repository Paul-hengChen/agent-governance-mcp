// Coded by @sr-engineer
// MCP Prompt: qa-engineer role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildQaEngineerPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-qa-engineer.md",
    "QA role. Verify code, write tests, rollback bugs.",
    workspacePath,
  );
}
