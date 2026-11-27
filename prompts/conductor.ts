// Coded by @sr-engineer
// MCP Prompt: conductor role. Prompt only — not a tw_switch_role /
// agent_id role.
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildConductorPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-conductor.md",
    "Conductor — open a fresh integrator session for each wave of an approved fan-out manifest, check its wave-done report, close it. Human-started; writes no handoff state.",
    workspacePath,
  );
}
