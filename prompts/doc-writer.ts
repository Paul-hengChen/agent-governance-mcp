// Coded by @sr-engineer
// MCP Prompt: doc-writer role (side-channel; not in ALLOWED_TRANSITIONS).
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildDocWriterPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-doc-writer.md",
    "Documentation maintainer — keeps README / CHANGELOG / docs in sync after PASS.",
    workspacePath,
  );
}
