// Coded by @sr-engineer
// MCP Prompt: spec-workshop role. Prompt only — not a tw_switch_role /
// agent_id role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildSpecWorkshopPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-spec-workshop.md",
    "Spec workshop — turn specs, design sources, issue-tracker items or an idea into dated rulings, ticket files and a wave table, in rounds with the human. Human-started; writes no handoff state.",
    workspacePath,
  );
}
