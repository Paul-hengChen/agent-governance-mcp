// Coded by @sr-engineer
// MCP Prompt: conductor role. Prompt only — not a tw_switch_role /
// agent_id role.
import { buildPromptForRole } from "./build.js";
export function buildConductorPrompt(workspacePath) {
    return buildPromptForRole("skill-conductor.md", "Conductor — open a fresh integrator session for each wave of an approved fan-out manifest, check its wave-done report, close it. Human-started; writes no handoff state.", workspacePath);
}
//# sourceMappingURL=conductor.js.map