# agent-governance-mcp — Value Proposition

> Synthesised from: mcp-necessity.md, mcp-value-proposition.md, agc-value-proposition-2026-05-20.md,
> value-assessment.md, value-assessment-2026-05.md, how-to-introduce-this-tool.md,
> npm-readiness-and-adoption-potential.md, honest-evaluation.md, repo-description.md
> Authors: @researcher (multiple sessions, 2026-05-15 – 2026-05-26)
> Last synthesised: 2026-06-22

---

## One-Line Pitch

*"Cross-IDE governance layer for AI coding agents — shared state + a single source of truth for rules + role-based workflow, enforced server-side."*

---

## Summary

- **Core value is real and unique**: cross-IDE / cross-session state sync + concurrent-write protection + unified rule injection. No equivalent open-source solution satisfies all three simultaneously at zero install cost.
- **Three hard guarantees** (OS/server-layer): O_EXCL file lock + mtime freshness (prevents lost updates), Zod schema + js-yaml serialisation (prevents format corruption), pre-flight check (prevents blind overwrites). Everything else is soft (depends on LLM cooperation).
- **Highest ROI for solo multi-IDE users**: v3.6.0 Lite Mode (`/teamwork-lite`) cut per-task token overhead from ~15K to ~3K, making daily use practical.
- **Viable for 2–3-person studios** in HTTP + SQLite mode; not a replacement for Jira/Linear at 10+ people.
- **Biggest barrier is adoption friction, not technology**: new users need to understand MCP, configure their IDE, create `.current/`, and learn 10 tools and 7 role prompts.
- **npm-ready**: strict TypeScript, 727 passing tests, 4 runtime deps, ISC license — technically exceeds most published MCP servers.

---

## What Problems It Solves (Hard Guarantees)

| Problem | Solution | Guarantee Level |
|---|---|---|
| Cross-session amnesia (AI forgets between sessions) | `handoff.md` YAML persistence + `tw_get_state` enforced first read | Server-enforced |
| Concurrent overwrite (two IDEs write simultaneously → last wins) | `O_EXCL` file lock + mtime freshness + atomic rename | OS-layer guarantee |
| Format corruption (AI hand-writes invalid YAML) | Zod schema validation + `js-yaml` serialisation | Server-enforced |
| Rule sprawl (`.cursorrules`, `CLAUDE.md`, `.antigravityrules` each drift) | Constitution-as-Code, MCP prompt endpoint injects uniformly | Soft (LLM must cooperate) |

**Key distinction**: the first three are hard guarantees; the fourth depends on LLM compliance — an inherent protocol-level limitation any system shares.

---

## What MCP Adds (vs. Bash Scripts / CLAUDE.md Alone)

| Capability | MCP provides | Alternative |
|---|---|---|
| Cross-IDE tool calls | JSON-RPC 2.0, universal | Per-IDE bash integration (fragile) |
| Prompt injection (roles) | `prompts/list` endpoint | CLAUDE.md only (Claude Code-specific) |
| Schema validation | Zod, server-side | None (agent sees raw file) |
| File locking | O_EXCL + stale-PID | Implementable in any CLI |
| Atomic writes | tmp + rename | Implementable in any CLI |
| Freshness / drift detection | In-process snapshot | Implementable, but no standard hook point |

**When MCP is the right choice**: two IDE sessions simultaneously, non-Claude clients (Cursor, Gemini Code, Continue), or needing the `prompts/` endpoint for role contexts.

**When MCP is over-engineered**: Claude Code only, single window, willing to enforce "one session at a time" as a social contract. A plain Node CLI covering `get-state`, `update-state`, `complete-task` would be functionally equivalent.

---

## Audience-Segmented Pitches

### Solo developer already using Claude Code / Cursor

> "Right now your AI loses memory between sessions and between IDEs. This MCP server (`npx -y github:Paul-hengChen/agent-governance-mcp`) gives every AI session the same shared state file, a constitution they all read, and a 7-role workflow (researcher → PM → architect → engineer → QA) you can opt into via slash commands. Or use lite mode for daily one-shot work — same constitution, no chain overhead."

### Team lead / engineering manager

> "Three problems with current AI coding workflows: AI overwrites teammates' work, rules drift across `.cursorrules` / `CLAUDE.md` / `.continuerules`, and there's no audit trail when AI ships broken code. This tool fixes all three with **server-side hard constraints** — not advisory text in a CLAUDE.md, but rejected `tw_update_state` calls. The QA role's PASS verdict requires written evidence; the server refuses to record it otherwise."

### AI tooling / infra engineer (knows MCP)

> "Three-layer MCP server in `index.ts`: prompts that bundle constitution + role-skill + live state into 7 entry points; tools (`tw_*`) that do atomic markdown / YAML / SQLite writes with file-lock + mtime freshness check + a state-machine guard (`tools/transitions.ts` ALLOWED_TRANSITIONS); and a schema-versioning system (`schema/versions.ts`) for lazy migration. Stdio mode for local use, HTTP+SQLite mode for cross-machine shared state."

### Non-technical stakeholder

> "When AI builds your product, it forgets between sessions, breaks unwritten rules, and overwrites itself. This is a 24/7 PM + QA + employee handbook that lives next to your code, runs locally, and keeps the AI on contract."

---

## Competitive Landscape (2026)

| Feature | agent-governance-mcp | Pure CLAUDE.md | Git commit sync | Linear/Jira + MCP | LangGraph/CrewAI |
|---|---|---|---|---|---|
| MCP native | Yes | N/A | N/A | Partial | No (SDK) |
| Cross-IDE | Yes | Claude only | Yes | Yes | No |
| Concurrent write protection | Yes (lock+mtime) | No | No | Yes (by design) | Yes |
| Unified rule injection | Yes | No | No | No | No |
| Remote deployment | Yes (HTTP+SQLite) | No | Yes | Yes | Yes (cloud) |
| Install cost | Zero (npx) | Zero | Zero | Paid | Paid / medium |
| Visualisation / dashboard | No | No | No | Yes | Yes |

**Unique combination**: MCP-native + cross-IDE + concurrent protection + rule injection + zero configuration — no other open-source solution satisfies all five simultaneously.

**Biggest competitive risk**: as LangGraph and CrewAI add MCP server capabilities, the role-routing and constitution injection features become table stakes. The concurrent-write safety + cross-IDE state sync remain the genuine differentiators.

---

## Honest Limitations

1. **AI can bypass MCP**: direct file-tool edits to `handoff.md` bypass all guards. `tw_detect_drift` surfaces this after the fact; it is a detective control, not a preventive one.
2. **File lock is local-fs only**: two machines cannot share a lock. HTTP + SQLite mode (Phase 6+) is required for cross-machine collaboration.
3. **Role switching is not enforcement**: `tw_switch_role` returns SOP text and hopes the LLM follows it. Any agent can call `tw_complete_task` regardless of declared role.
4. **No dashboard**: handoff state is only visible via AI oral report or direct file read.
5. **Session state is in-memory only**: server restart loses all session snapshots; every agent must re-call `tw_get_state`.
6. **Config cache never invalidates**: changes to `.current/.config.json` while the server runs are not picked up until restart.

---

## ROI by User Type

| User | Recommendation | Expected gain |
|---|---|---|
| Solo + multi-IDE | Use `/teamwork-lite` for daily work, full `/teamwork` for complex features | Save 10–30 min/day of context-rebuild time |
| 2–3 person studio | Deploy HTTP + SQLite, share constitution and handoff state | Unified AI rule enforcement, eliminate concurrent-overwrite incidents |
| >5 person team | Not recommended as primary tool; viable as AI rule injection layer | Limited |
| Portfolio / interviews | Extremely high showcase value (state machine, concurrency, cooperative guardrail) | N/A |

---

## npm Readiness

Technical readiness is 100%: strict TypeScript, 727 passing tests, 4 runtime deps, `bin` entry configured, ISC license, `agc init` CLI. The only mechanical step is adding `prepublishOnly: "npm run build"` and running `npm publish`.

The real question is discoverability: Awesome MCP lists and PulseMCP are the primary discovery channels. Conservative projection: 10–50 GitHub stars and 50–200 weekly downloads on launch, scaling to 100–500 stars if listed in Awesome MCP lists.

**Recommended description (GitHub):**
> `MCP governance layer for multi-IDE AI agents — shared state, role routing, and task tracking`

---

## Open Questions

1. **Should lite mode become the default?** Majority of solo-dev sessions are small; lite mode's ~3K token target is more sustainable as the entry point.
2. **npm publish timeline?** The `dist/` commit pattern inflates every diff. Removing it requires npm publish first.
3. **A2A protocol watch**: Google's Agent-to-Agent protocol may reshape the MCP ecosystem positioning. Monitor but not yet blocking.
4. **Multi-machine demo story**: HTTP + SQLite mode enables shared state across machines, which is a stronger pitch than local-multi-IDE, but no public demo exists yet.
