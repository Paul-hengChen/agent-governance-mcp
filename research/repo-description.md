---
topic: repo-description
date: 2026-05-18
---

## Summary

- Current description references "SDD (Spec-Driven Development)" — old branding, misleading.
- Coordinator proposed: `teamwork-mcp-server — shared project state & governance for multi-IDE / multi-session AI agents` — accurate but redundantly repeats the repo name.
- README tagline is the best existing signal: *"governance layer + automated secretary via MCP"*.
- Three strong candidates below, ordered by recommendation.

## Evidence

- `gh repo view`: current description = `SDD (Spec-Driven Development) MCP Server — enforces constitution, tracks state, manages tasks`
- `README.md` tagline: `A "governance layer" + "automated secretary" via the Model Context Protocol.`
- `README.md` one-liner: *"infrastructure layer that allows multiple AI agents/IDEs to work on the same project while sharing state, adhering to a single source of truth for rules, and avoiding mutual overwrites."*
- GitHub truncates descriptions to ~120 visible chars in search results.

## Recommendation

**Option A (recommended):**
> `MCP governance layer for multi-IDE AI agents — shared state, role routing, and task tracking`

Rationale: doesn't repeat repo name; leads with "MCP" (searchable keyword); "governance layer" is the exact metaphor used in README; covers all three pillars (state / roles / tasks); 93 chars.

## Alternatives Considered

**Option B (coordinator's proposal):**
> `teamwork-mcp-server — shared project state & governance for multi-IDE / multi-session AI agents`

Rejected: repeats repo name (GitHub already displays it); wordy.

**Option C (README-literal):**
> `Governance layer + automated secretary via MCP: shared state, role-based workflows, constitution enforcement`

Rejected: "automated secretary" is folksy and less searchable; slightly long at 107 chars.

**Option D (minimal):**
> `MCP server: shared AI agent state, role workflows, and governance for cross-IDE teams`

Fine fallback if "governance layer" feels too abstract.

## Open Questions

- Does the team want to target discoverability by "MCP" keyword, or by "multi-agent"? Both are in Option A, but ordering matters for search rank.
- Should "constitution enforcement" be surfaced (differentiator vs generic MCP servers)?
