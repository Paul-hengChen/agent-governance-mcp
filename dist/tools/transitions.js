// Coded by @sr-engineer
// Pure state-machine logic for routing-chain enforcement.
// See specs/qa-flow-enforcement-architecture.md §ALLOWED_TRANSITIONS.
// T03 scope: requireQaEngineer helper only. T08-T10 will add the full
// ALLOWED_TRANSITIONS map, validateTransition, and computeNewRound.
export function requireQaEngineer(agentId, toolName) {
    if (agentId === "qa-engineer")
        return { ok: true };
    const who = agentId ? `"${agentId}"` : "unidentified agent (agent_id not set)";
    return {
        ok: false,
        message: `⛔ BLOCKED: ${toolName} is reserved for qa-engineer. Called by ${who}. ` +
            `Hand off to qa-engineer and pass agent_id="qa-engineer".`,
    };
}
//# sourceMappingURL=transitions.js.map