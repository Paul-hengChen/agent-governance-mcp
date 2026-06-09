# Cross-Agent Governance: One Source of Truth Without N Drifting Copies

> Topic: how to deliver one governance ruleset to Claude Code, Antigravity, Codex CLI,
> Cursor (and future agents) across both global and per-project scope, without
> hand-maintaining a copy per agent that silently drifts.
> Date: 2026-06-08
> Author: Claude (Opus 4.8), acting as `researcher` in an agent-governance-mcp session.
> Basis: synthesis of a working session that shipped Constitution v3.27.0 (v3.28.0 release)
> and diagnosed the delivery/fragmentation gaps below first-hand.

## Summary

- The operator's pain is **N hand-maintained copies of the same rules** spread across
  `scope × agent` (e.g. `~/.claude/CLAUDE.md`, `.antigravityrules`, `AGENTS.md`,
  `~/.codex/AGENTS.md`, Antigravity global). The cost is not the file count — it is that the
  *same rule is authored in many places and each copy drifts independently*. This is the exact
  doc-vs-code drift class that Constitution v3.27.0 edits A1–A4 were created to close. [T1: `content/constitution.md` §3.1, `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`]
- **Root principle:** a rule must be authored **once** — in the constitution served by the MCP
  server. Every other file is either a **thin loader (pointer)** or a **generated artifact**,
  never a hand-written second copy. [T1: `prompts/build.ts`, `index.ts`]
- Two distinct reasons a rule "doesn't run" on a non-Claude agent must be handled differently:
  a **delivery gap** (the rule never reached the agent's context) vs a **capability gap** (the
  agent cannot perform the action — e.g. no `Task` subagent dispatch). Broadening the
  constitution fixes neither alone. [T1: `content/constitution.md` §4 "Subagent Dispatch (Claude Code) … Fallback (tw_switch_role)"]
- **Recommended model:** universal contract in the constitution (server, live-served) + a thin
  per-agent **adapter** that only loads the contract and declares that agent's execution profile;
  set the adapter once per agent at **global** scope; bootstrap per project with `agc init`;
  generate adapters from one source so they cannot drift.
- The collapse: from `scope × agent` hand-edited rule copies down to **1 authored ruleset + a
  few one-time global pointers + one `agc init` per project**.

## Evidence

- `agc init` already exists and already scaffolds `.current/handoff.md`, `.current/.config.json`,
  `tasks.md`; it is idempotent (existing files skipped). [T1: `bin/agc-init.mjs:1-83`]
- The SessionStart hook self-gates on the presence of `.current/` / `tasks.md` / `TODO.md`;
  a workspace without any of those receives **no** auto-injection. So `agc init` creating
  `.current/` is what "arms" the hook for subsequent Claude Code sessions. [T1: `bin/agent-governance-context.mjs`, `CLAUDE.md` "Auto-injection: SessionStart hook"]
- `.current/` is created by the **first state write** (`ensureDir()` is called only inside the
  `tw_update_state` write path), not by reading state or by invoking a role prompt — both of
  which are read-only. A workspace where the agent only ever reads never materialises `.current/`
  and never arms the hook. [T1: `tools/handoff.ts:58-61, 359`; `readHandoffState` returns
  `{exists:false, "…initialize by calling tw_update_state"}` at `tools/handoff.ts:184-191`]
- The constitution is delivered to a managed workspace by exactly two channels: (a) the
  SessionStart hook (Claude Code only; requires install + a marker dir/file present), and (b)
  explicit role-prompt invocation, which bundles constitution + skill + live state via
  `prompts/build.ts`. Merely connecting the MCP server guarantees neither. [T1: `index.ts`, `prompts/build.ts`]
- The only **always-present, cross-client** signal is the MCP **tool description**: e.g.
  `tw_get_state` is described as "MANDATORY FIRST ACTION. Other tw_* writes blocked if skipped."
  Tool schemas load for every MCP client regardless of hook/prompt. [T1: `index.ts` tw_get_state registration]
- Server-side pre-flight enforcement (`enforcePreFlight`) blocks state-mutating `tw_*` calls
  until `tw_get_state` runs — a reactive safety net that holds even when the constitution was
  never read, but only for state-mutating calls, and only reactively. [T1: `guards/session.ts`, `index.ts:651,673,968,979,986`]
- Claude-specific execution mechanics are **already mostly outside** the constitution
  (in `skill-coordinator.md` §Auto-Routing + `templates/claude-code-agents/`); the main
  Claude-only leak still inside the constitution is the §1 Watermark subagent self-detection
  (`Task(subagent_type=…)` + tier pinning). [T1: `content/constitution.md` §1 Watermark, §4; `skill-coordinator.md`]
- A blind per-project copy of `constitution.md` (the naive scaffolding proposal) reproduces the
  drift the product exists to eliminate, and is also likely **inert**: no agent auto-loads a
  root file literally named `constitution.md` (Claude reads `CLAUDE.md`, Antigravity
  `.antigravityrules`, Codex `AGENTS.md`). [T1: per-agent native-config conventions]

## Recommendation

Adopt a **three-layer "author once, deliver many" architecture**, and extend `agc init` as the
delivery vehicle.

### Layer 1 — Universal contract (author once)
Keep `content/constitution.md` as the **single source of truth**, but purge the few
agent-specific *execution* mechanics from it (relocate §1 Watermark's subagent self-detection
and any residual `Task`-dispatch detail into the Claude adapter / `skill-coordinator`). The
constitution then states *what* must hold (behaviour, the `tw_*` state protocol, the abstract
routing chain), not *how a specific agent performs it*.

### Layer 2 — Per-agent adapters (generated, thin, never hand-copied)
For each agent, ship a thin adapter in that agent's native config file:
`~/.claude/CLAUDE.md`, `.antigravityrules`, `AGENTS.md` (Codex), `.cursorrules` (Cursor). Each
adapter contains only:
1. **A loader** — "the agent-governance MCP is available; before acting, obtain the constitution
   (invoke the `teamwork` prompt / call `tw_get_state`) and follow it."
2. **An execution profile** — what this agent can/can't do: subagent dispatch available? else
   fall back to `tw_switch_role` (same-context); does the watermark-tier mechanic apply; which
   native file the agent reads.

Adapters MUST be **generated** from `constitution.md` + a per-agent profile (the pattern already
used by `templates/claude-code-agents/`), so editing the constitution and regenerating is the
only maintenance action — no parallel hand-editing.

### Layer 3 — Delivery, two modes (pick per agent capability)
- **Mode A — live reference (preferred, zero drift):** the adapter points at the
  server-served constitution; rules are fetched at runtime via MCP. Requires the agent to
  support MCP prompt/tool invocation. No frozen copy anywhere.
- **Mode B — stamped copy + staleness guard (only if the agent reads static files and cannot
  fetch at runtime):** materialise a copy **with a version stamp**, and ship `agc check` (warns
  when a deployed copy is stale vs the installed server version — a mirror of
  `scripts/check-version.mjs`) + `agc update` (refresh). Drift becomes **loud and detectable**,
  never silent — the same "make the gap a hard gate" lesson as the v3.28.0
  `constitution-deliverable-guard.test.mjs`.
- **Mode C — blind copy, no version, no update path:** rejected. This is silent drift.

### Operating model that collapses the maintenance surface
- **Global, one-time:** put the Layer-2 loader in each agent's **global** config once
  (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, Antigravity global). Set once per machine, never
  touched again. Governance never lives in per-project files.
- **Per project:** run `agc init`. It already arms `.current/` (Claude hook); extend it to
  detect the project's agent(s) and drop the matching **generated** adapter(s).
- **Editing rules:** edit `content/constitution.md`, regenerate, done — one place.

Net: `scope × agent` hand-edited copies → **1 authored ruleset + ~3 one-time global pointers +
one `agc init` per project**.

### Immediate pain relief (before the tooling lands)
Hand-place one short canonical **loader** (not the rules) into each agent's global config now,
and strip governance rules out of per-project files (leave only project-specific deltas). This
removes the multi-copy drift today; the generation tooling then automates it.

## Alternatives Considered

- **Broaden the constitution to a lowest-common-denominator ruleset, drop the rest into each
  agent file (the operator's first instinct).** Rejected as the primary fix: "dropping the rest
  into each agent file" means hand-copying behavioural rules → N drifting copies. The correct
  split is *universal contract vs per-agent execution profile*, with execution profiles
  generated, not the rules duplicated. (Broadening the constitution to remove Claude-only
  *mechanics* is still worth doing — but as relocation, not duplication.)
- **`agc init` copies `constitution.md` + `.antigravityrules` into every project root (Gemini's
  scaffolding proposal, verbatim).** Rejected: a frozen per-project copy of the constitution is
  the drift trap (A1–A4 reincarnated), and a root `constitution.md` is read by no agent
  automatically. The salvageable kernel — extend `agc init` for cross-IDE scaffolding — is
  adopted above, but deploying **adapters/loaders** (Mode A) or **stamped copies with `agc
  check`** (Mode B), never a blind copy.
- **Rely solely on server-side pre-flight enforcement + tool descriptions (no adapters).**
  Rejected as insufficient: enforcement is reactive and only covers state-mutating `tw_*`
  calls; the proactive SOP (which role runs, what to verify) is skipped entirely if the
  constitution never reaches context. Good as a safety net, not as the delivery mechanism.

## Open Questions

- **Runtime fetch capability per agent:** does Antigravity / Codex CLI actually load an MCP
  *prompt* into context automatically, or only expose MCP *tools*? This determines how many
  agents can use Mode A vs are forced into Mode B. Needs per-agent verification (the claims here
  about non-Claude agents are inference from their native-config conventions, not first-hand
  tested — effectively T3 confidence on that specific point).
- **Generation tooling scope:** `agc init` adapter generation + `agc check` staleness guard +
  `agc update` do not yet exist; this report specifies the shape, not the implementation. Needs
  a PM spec → architect → build cycle.
- **Watermark relocation blast radius:** moving §1 Watermark subagent-detection out of the
  constitution touches `skill-coordinator.md` and the watermark validation util; confirm no
  managed workspace depends on reading those mechanics from the constitution body.
- **Where the "loader" text is canonicalised:** if the loader string itself is authored once and
  emitted into each global config, it too should be generated (else it becomes another small
  hand-copied artifact). Decide its home (likely a `templates/agent-adapters/` directory).

## Update 2026-06-09 — Codex review convergence

An independent Codex review converged on the same 1-source + thin-adapter architecture, and
sharpened two points; both adopted:

- **Refinement to "Operating model" (supersedes the global-loader suggestion above):** the
  governance **entry** belongs in the **project** adapter (`AGENTS.md` / `.antigravityrules` /
  `CLAUDE.md`, dropped by `agc init`), NOT in each agent's global config. Global config
  (`~/.codex/AGENTS.md` etc.) holds **personal preferences only — no project governance**. This
  is more correct than the original "set a global loader once" idea: a global loader would force
  the "read the constitution" instruction onto *every* project on the machine, including
  non-managed ones. Per-project opt-in (via `agc init`) scopes governance to managed repos only
  and keeps global config clean. [T1: Codex AGENTS.md guide — global+project layering;
  https://developers.openai.com/codex/guides/agents-md]
- **Resolves Open Question #1 (for Codex):** Codex's official docs confirm `AGENTS.md` is the
  instruction-chain **entry** that Codex loads automatically, supports **global + project
  layering**, and that **hooks are a separate lifecycle layer, not the primary rule source** —
  matching this report's "hook = entry/lifecycle, not governance body" stance. [T1:
  https://developers.openai.com/codex/guides/agents-md, https://developers.openai.com/codex/hooks]
  Antigravity's equivalent (`.antigravityrules` auto-load + global scope) remains
  unverified-first-hand (still T3 confidence for that agent specifically).

Final agreed structure: `content/constitution.md` (authoritative rules) · `AGENTS.md` /
`.antigravityrules` / `CLAUDE.md` (per-project entry, generated by `agc init`) · `~/.codex/AGENTS.md`
(personal prefs only) · `agc check` (staleness guard). Same-rule-in-four-places is eliminated;
the entry files carry a one-line pointer, never duplicated clauses.
