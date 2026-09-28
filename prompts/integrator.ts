// Coded by @sr-engineer
// MCP Prompt: integrator role (E178a). Prompt only — not a tw_switch_role /
// agent_id role (D11).
import { buildPromptForRole, type PromptResult } from "./build.js";

export function buildIntegratorPrompt(workspacePath: string): PromptResult {
  return buildPromptForRole(
    "skill-integrator.md",
    "Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.",
    workspacePath,
  );
}
