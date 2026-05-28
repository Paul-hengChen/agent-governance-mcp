// Coded by @sr-engineer
// MCP Prompt: release-engineer role (side-channel; not in ALLOWED_TRANSITIONS).
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildReleaseEngineerPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-release-engineer.md",
    "Release engineer — owns version bumps, CHANGELOG, git tag, and gh release after PASS.",
    workspacePath,
  );
}
