# How to Introduce `agent-governance-mcp` — Positioning & Talk Tracks

> @researcher · 2026-05-26
> Scope: audience-segmented pitch + category clarification + comparison vs adjacent tools, anchored on the v3.8.3 architecture.

## Summary

- **Category line**: technically an **MCP server**; functionally a **governance / methodology layer** that the user's existing MCP-capable harness (Claude Code, Cursor, Continue, Anti-Gravity, Gemini Code, Windsurf, etc.) plugs into. The repo's own `README.md:32` says: *"Technically an MCP server (protocol/transport), functionally a harness — it injects governance, shared state, and role SOPs into the agent's execution shell"*. The community's "harness" usually means runtime (Claude Code itself); this tool's "harness" means scaffolding. Disambiguate when speaking with engineers.
- **One-line for any audience**: *"Cross-IDE governance layer for AI coding agents — shared state + a single source of truth for rules + role-based workflow, enforced server-side."*
- **Three things to point at when someone asks "what does it actually do"**: (1) **Prompts** that ship a constitution + role SOPs into every harness; (2) **`tw_*` tools** that read/write a shared handoff state so two IDEs don't overwrite each other; (3) **Server-side guards** (file lock, mtime freshness, ALLOWED_TRANSITIONS, evidence gate) that reject invalid agent moves *before* they hit disk.
- **Don't pitch as**: a code-generation tool, an LLM, a framework, a prompt library. It produces no code on its own; it provides governance and durable state. Use it *with* an MCP-capable agent runtime.
- **The "why a server" answer**: state lives in files on disk, but **multiple AI sessions across multiple IDEs** all need to read/write the same files atomically. A local server (MCP stdio or HTTP/SQLite mode) is the cheapest way to make that safe — file lock + mtime check + transaction-style writes.

---

## Evidence

### E1. What it ships, mechanically

From `CLAUDE.md` and `index.ts`:

| Surface | Count | Files |
|---|---:|---|
| **Prompts (role SOPs)** | 7 | `prompts/{coordinator,coordinator-lite,researcher,design-auditor,pm,architect,sr-engineer,qa-engineer}.ts` — note the dual coordinator (`teamwork` / `teamwork-lite`) prompt entry points |
| **Tools (`tw_*`)** | 10 | `tw_get_state`, `tw_update_state`, `tw_get_next_task`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_detect_drift`, `tw_switch_role`, `tw_index_prd`, `tw_clear_prd_chunks` (`README.md:94-110`) |
| **Guards** | 3 | Pre-flight `tw_get_state` (`guards/session.ts`), cross-process file lock + mtime freshness (`guards/file-lock.ts`), `ALLOWED_TRANSITIONS` matrix (`tools/transitions.ts`, v3.2.0) |
| **Persisted artifacts** | 4 | `.current/handoff.md` (YAML state), `tasks.md` (markdown checkboxes), SQLite DB (HTTP mode), `.current/.config.json` (taskPattern, taskPaths) |

### E2. The category answer (and the slippery word "harness")

`README.md:24-32` calls the tool "an infrastructure layer" + "technically an MCP server (protocol/transport), functionally a harness". This is the canonical line.

The trap: "harness" has two meanings in AI tooling:

1. **Runtime harness** (community usage): the program that actually runs the agent's tool calls — Claude Code, Cursor, Continue, Anti-Gravity. These provide the LLM loop, the Read/Edit/Bash tools, IDE integration. `agent-governance-mcp` is **not** this.
2. **Scaffolding harness** (README usage): structure injected around the agent — constitution, role SOPs, state, gates. `agent-governance-mcp` **is** this.

When introducing to engineers: lead with "MCP server", say "no LLM, no IDE integration — runs as a child process of your IDE's MCP client", then explain it adds a governance scaffold on top of whatever harness they already use.

### E3. Audience-segmented talk tracks

#### (a) Solo developer who already uses Claude Code / Cursor

> "Right now your AI loses memory between sessions and between IDEs. This is an MCP server you install in 30 seconds (`npx -y github:Paul-hengChen/agent-governance-mcp#v3.8.3`) that gives every AI session the same shared state file, a constitution they all read, and a 7-role workflow (researcher → PM → architect → engineer → QA) you can opt into via slash commands. Or use lite mode for daily one-shot work — same constitution, no chain overhead."

Key beats: zero install friction, works in any MCP-capable client, has a "lite" escape hatch.

#### (b) Team lead / engineering manager evaluating AI workflows

> "Three problems with current AI coding workflows: (1) AI overwrites teammates' work because no two sessions see the same state; (2) rules drift across `.cursorrules`, `CLAUDE.md`, `.continuerules`; (3) there's no audit trail when AI ships broken code. This tool fixes all three with **server-side hard constraints** — not advisory text in a CLAUDE.md, but rejected `tw_update_state` calls. The QA role's PASS verdict requires written evidence; the server refuses to record it otherwise. Result: same governance discipline you'd expect from a PR review process, applied to AI sessions."

Key beats: enforcement vs convention, audit trail via `qa_reports/`, multi-IDE safety.

#### (c) AI tooling / infra engineer (someone who knows MCP)

> "Three-layer MCP server in `index.ts`: prompts that bundle constitution + role-skill + live state into 7 entry points (`teamwork`, `pm`, `qa-engineer`, etc.); tools (`tw_*`) that do atomic markdown / YAML / SQLite writes with file-lock + mtime freshness check + a state-machine guard (`tools/transitions.ts` ALLOWED_TRANSITIONS); and a schema-versioning system (`schema/versions.ts`) for lazy migration of older `handoff.md` / `tasks.md` files. Stdio mode for local use, HTTP+SQLite mode for cross-machine shared state."

Key beats: real architecture, schema-versioned artifacts, transport-agnostic.

#### (d) Non-technical stakeholder ("why does this matter for my product?")

> "When AI builds your product, it forgets between sessions, breaks unwritten rules, and overwrites itself. This is a 24/7 PM + QA + employee handbook that lives next to your code, runs locally, and keeps the AI on contract. Day-to-day: you ship features faster because the AI doesn't redo work, doesn't paraphrase the design, and doesn't quietly stomp on yesterday's changes."

Key beats: outcome language, no MCP jargon, references the README L30 analogy ("team's PM + QA + Employee Handbook").

### E4. What to NOT call it

- **"A framework"** — no runtime, no opinionated dependency tree. It's a transport-thin layer.
- **"A prompt library"** — has stateful tools + server-side enforcement, not just prompts.
- **"An AI"** — never generates code, never replaces the LLM; it's middleware.
- **"A CI tool"** — runs at agent-turn time, not at PR time. Closer to a pre-commit hook for AI sessions than to CI.
- **"A workflow engine"** — the workflow is server-enforced, but the engine is *the LLM following SOPs*. There is no task queue or scheduler.

### E5. Comparison vs adjacent / commonly-confused tools

| Tool / category | Same as agent-governance-mcp? | Difference |
|---|---|---|
| **`.cursorrules` / `CLAUDE.md`** | No — these are per-IDE rule files. | Static. Don't sync across IDEs. No state. |
| **A custom MCP "task-tracker" server** | Closest sibling. | Most task-tracker MCPs are CRUD-only. This one adds constitution injection, state-machine guards, multi-role SOPs. |
| **LangGraph / CrewAI / AutoGen** | No — these are agent *frameworks* (Python, run their own loop). | This is transport middleware — your IDE's existing agent loop calls into it. |
| **Claude Code subagents (`.claude/agents/*.md`)** | Related — subagents are role-bound contexts inside Claude Code. | agent-governance-mcp is *cross-client*; subagents are Claude Code-only. You can wrap each role as a subagent (per `content/skill-coordinator-lite.md` "Other tools" guidance) for per-role model selection. |
| **GitHub Copilot Workspace / Cursor Composer** | No — those are integrated agent UIs. | Different layer. agent-governance-mcp adds discipline *inside* whatever UI you use. |
| **Notion / Linear / Jira** | No. | Those are *human* tracking systems. This is *agent* tracking. The two coexist; agent-governance-mcp's `tasks.md` is the AI-readable view of whatever the team's human tracker says. |

---

## Recommendation

**Use a two-line pitch + an "if they want more" branch**:

> *"agent-governance-mcp is an MCP server that gives any AI coding tool — Claude Code, Cursor, Continue, whatever — a shared handoff state, a single constitution they all obey, and a 7-role workflow (researcher → PM → architect → engineer → QA) with server-enforced quality gates. It runs locally over MCP, takes 30 seconds to install (`npx -y github:Paul-hengChen/agent-governance-mcp#v3.8.3`), and writes its state to plain markdown files you can `git diff`."*

If they ask "but what IS it" — give the layered category line:

> *"Technically: an MCP server. Functionally: a governance layer your existing AI tool plugs into. It's not a framework, not an agent, not a prompt library — it's middleware that adds state + rules + gates to whatever agent runtime you already use."*

If they push back with *"isn't this just CLAUDE.md but bigger"* — point at three irreducible features:

1. **Cross-IDE shared state** (CLAUDE.md is per-IDE; this isn't).
2. **Server-side rejection of invalid moves** (CLAUDE.md is advisory text; ALLOWED_TRANSITIONS is enforced).
3. **Multi-role workflow with evidence-required PASS gates** (no equivalent in any rule-file solution).

For demo material: lead with the v3.8.0 design-auditor closing the `cde-oobe` Figma-paraphrase incident (`README.md:197-221`) — concrete, recent, ties enforcement to a real bug.

---

## Alternatives Considered

- **Pitch as "AI middleware"** — too vague; "middleware" suggests transport, not governance. Rejected because the value is in the *guards*, not in the *forwarding*.
- **Pitch as "agent OS"** — overclaims. There's no scheduler, no process model, no resource management. Tempting because it sounds important, but it sets expectations that don't match the code.
- **Pitch as "an open-source CursorPM / Linear-for-AI"** — confuses the picture; this isn't a UI, has no humans-in-the-loop UX. Worth mentioning as a *user* of this tool (humans can read `tasks.md`) but not as the headline category.
- **Lead with technical stack (TypeScript / SQLite / JSON-RPC over stdio)** — engineers will love it, everyone else will tune out. Lead with the problem (cross-IDE drift); save the stack for FAQ.

---

## Open Questions

1. **Does the tool have a logo / name discipline?** "agent-governance-mcp" is the repo name; "Agent Governance MCP" is the README's brand. The slash commands inside the tool say `/teamwork` (full mode) and `/teamwork-lite`. Should the public pitch unify these or treat "teamwork" as the *workflow* and "agent-governance-mcp" as the *server*? Recommend: keep the distinction — "the server" and "the teamwork workflow it provides". But surface this if used in marketing copy.
2. **Multi-machine demo story is missing**. The HTTP+SQLite mode (`README.md` Future Roadmap mentions Phase 6) enables shared state across machines, which is a stronger pitch than the local-multi-IDE story. No public demo of this mode exists yet — worth recording one before going wide.
3. **License & adoption signals**. The README links the GitHub repo but does not list a license, contribution policy, or recent-adoption stats. For external pitches (Show HN, conference talk, vendor evals), surface these explicitly — engineers screen for them.
4. **Who is the buyer if this scales beyond solo devs?** Solo devs can adopt with `npx`; teams need governance/audit/compliance arguments. The tool already produces audit-grade artifacts (`qa_reports/review_<id>.md`). A short "How this maps to SOC2 / change-management" page would unlock team-lead conversations. Out of scope for the pitch itself, in scope for follow-on collateral.
5. **What does the design-auditor / qa-visual story look like for non-Figma teams?** Architecturally it's source-agnostic (v3.8.1 manifest, v3.8.2 Phase 1.5), but every public example uses Figma. A second public example (Sketch / Penpot / paper mockup photo) would prove the source-agnostic claim. Worth one extra blog post or README section before pitching to non-Figma shops.
