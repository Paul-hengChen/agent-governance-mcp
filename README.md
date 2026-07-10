# Agent Governance MCP

**An MCP server that gives multiple AI coding agents (Claude Code, Cursor, Windsurf, …) shared state + a single source of truth for project rules — with server-side gates that AI cannot bypass.**

Lost updates, rule drift across `.cursorrules` / `CLAUDE.md` / `.windsurfrules`, and silent overwrites when two IDEs write at once — solved at the protocol layer, not by hoping the AI behaves.

> **Status**: production-used, v3.59.0. Suite **1035/1035**. Stdio mode is solo/single-machine; HTTP+SQLite mode is for multi-machine teams.

*Solo-built and self-hosting: this repo dogfoods its own server — development of agent-governance-mcp itself runs through the constitution and `tw_*` gates it ships.*

---

## Why this exists

| Problem | What this fixes |
|---|---|
| **Lost updates** — two IDEs write `handoff.md` simultaneously, later one silently overwrites | `O_EXCL` file lock + mtime freshness check; concurrent writer gets `⛔ STATE DRIFT` |
| **Rule drift** — same rules duplicated across `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, … | Constitution (composed from fragments) injected into every session via SessionStart hook + MCP prompts |
| **Format drift** — AI hand-edits `handoff.md` and breaks YAML / checkboxes | Free-text edits revoked; AI MUST go through 11 `tw_*` tools with zod-validated args |
| **No iteration discipline** — AI declares PASS without testing, or loops forever on the same fail | Server-enforced state machine: `qa_round` / `review_round` / `visual_round` caps; PASS requires evidence files |

Existing tools in the same category (GitHub Spec Kit, OpenSpec) ship **templates + slash commands** — enforcement is advisory. This ships **server-side gates** — AI gets `⛔ BLOCKED` envelopes on rule violations. See [vs. alternatives](#vs-alternatives) below.

---

## Quick Start (Claude Code, 3 commands)

```bash
# 1. Register the MCP server
claude mcp add -s user agent-governance-mcp -- npx -y github:Paul-hengChen/agent-governance-mcp#v3.64.1

# 2. Mark the current workspace as managed (REQUIRED — hook is a silent no-op without this)
# Recommended: use agc init (writes .current/ + tasks.md)
npx -y github:Paul-hengChen/agent-governance-mcp#v3.64.1 agc init
# Alternative (bare scaffold):
mkdir -p .current

# 3. Add the SessionStart hook to ~/.claude/settings.json (see Setup → Hook below)
```

Then `claude mcp list` should show `✓ Connected`, and opening Claude Code in that workspace injects the constitution banner. First `npx` pull is ~30–60s; subsequent runs are instant.

**Other clients** (Cursor, Windsurf, Cline, Continue, Zed, Anti-Gravity) — same `npx` command, different config file path. See [docs/install.md](docs/install.md).

---

## How it works (3 layers)

```
┌── Layer 1: Prompts ───────────────────────────────────────┐
│  /teamwork, /pm, /architect, /sr-engineer, /qa-engineer,  │
│  …  →  inject constitution + role SOP + handoff state     │
├── Layer 2: Tools ─────────────────────────────────────────┤
│  11 tw_* MCP tools — the ONLY way to mutate handoff/tasks │
│  (zod-validated args; free-text edits revoked)            │
├── Layer 3: Guards ────────────────────────────────────────┤
│  Pre-flight read ▸ file lock ▸ mtime freshness ▸          │
│  ALLOWED_TRANSITIONS ▸ round caps ▸ evidence-of-QA ▸      │
│  SCOPE_DECISION_REQUIRED ▸ VISUAL_BASELINES_REQUIRED ▸    │
│  VISUAL_ASSERTIONS_REQUIRED ▸ VISUAL_REPORT_INCOMPLETE ▸  │
│  BASELINE_MANIFEST_MISSING ▸ PIXEL_GATE_ATTESTATION_MISSING  │
│  atomic tmp+rename                                        │
└────────────────────────────────────────────────────────────┘
```

Every `tw_update_state` runs the full 9-step pipeline before touching disk. A rejected write returns `{ error, attempted, allowed, hint }` so the AI can self-correct or escalate. Full pipeline diagram: [docs/architecture.md](docs/architecture.md).

**Routing chain** (full mode): `researcher? → design-auditor? → pm → architect? → sr-engineer ↔ code-reviewer → qa-engineer → PASS`. Lite mode (`/teamwork-lite`) bypasses the chain for solo 1-file edits — server-read-only, no state writes.

---

## vs. alternatives

| | **agent-governance-mcp** | GitHub Spec Kit | OpenSpec |
|---|---|---|---|
| Category | MCP server + hard gates | Slash-command + templates | Slash-command + templates |
| Enforcement | **Server-side** (`⛔ BLOCKED`) | Prompt-level (advisory) | Prompt-level (advisory) |
| Concurrent-write safety | **O_EXCL lock + mtime check** | None | None |
| Role separation | **12 roles + ALLOWED_TRANSITIONS** | Single agent per session | Human-AI pair |
| Retry / feedback loops | **3 round counters w/ caps** | Undefined | Undefined |
| Multi-IDE shared state | **Yes** (stdio fs, or HTTP+SQLite) | Filesystem only | Filesystem only |
| Install weight | Heavier (MCP server) | Lighter (CLI scaffold) | Lighter (CLI scaffold) |

**Pick agc when** lost updates / rule drift / iteration discipline matter (cross-IDE, multi-session, team work). **Pick Spec Kit / OpenSpec when** you're solo + sequential and want lighter install. Detailed research: [research/spec-kit-vs-openspec-vs-agc.md](research/spec-kit-vs-openspec-vs-agc.md).

---

## Per-Role Model Routing

Every `content/skill-*.md` declares a `recommended_model` in its YAML frontmatter. The recommendation is **advisory** — the MCP server does not control client-side inference. Honor it via Claude Code's `~/.claude/agents/*.md` (per-subagent model pinning) or manual `/model` switches; old clients that ignore the field keep working.

| Role             | Tier   | Recommended model | Rationale                                                            |
| ---------------- | ------ | ----------------- | -------------------------------------------------------------------- |
| researcher       | high   | `opus`            | Heavy reasoning, long-context synthesis.                             |
| architect        | high   | `opus`            | Cross-module design decisions; subtle interface trade-offs.          |
| code-reviewer    | high   | `opus`            | Detail sensitivity; correctness gate before QA.                      |
| design-auditor   | high   | `opus`            | Verbatim copy/tokens extraction; precision on visual contracts.      |
| sr-engineer      | high   | `opus`            | Hot path — every FAIL re-runs the whole chain; quality > cost.       |
| coordinator      | medium | `sonnet`          | Triage + routing; structured decisions but not deep reasoning.       |
| pm               | medium | `sonnet`          | Spec drafting; structured output, bounded scope per call.            |
| qa-engineer      | medium | `sonnet`          | Test execution & evidence; high determinism.                         |
| qa-visual        | medium | `sonnet`          | Lazy sub-mode of qa-engineer; inherits its tier.                     |
| coordinator-lite | low    | `haiku`           | Single-file doer; no chain, no design decisions.                     |
| doc-writer       | low    | `haiku`           | Doc-only side-channel; deterministic formatting.                     |
| release-engineer | low    | `haiku`           | Mechanical release packaging; no novel reasoning.                    |

Pinning a model in Claude Code — create one file per role under `~/.claude/agents/`. Example for sr-engineer:

```markdown
---
name: sr-engineer
model: opus
description: Implements PM spec + architecture per agent-governance-mcp constitution.
---

(SOP body is loaded dynamically via `tw_switch_role` — leave this section empty
or paste a one-line reminder to call /sr-engineer.)
```

Repeat with `model: sonnet` for pm / qa-engineer / coordinator and `model: haiku` for coordinator-lite / doc-writer / release-engineer. `tw_switch_role` returns the same tier in its `recommended_model` field, and the SessionStart hook prints `Recommended model: <model> (tier <tier>)` in its banner — wrappers can read either to set `--model` automatically.

The hint is the only enforcement — see [specs/model-routing.md](specs/model-routing.md) for the full design and out-of-scope list.

### Claude Code subagent install (auto model-routing)

v3.20.0+ ships pre-pinned Claude Code subagent templates under `templates/claude-code-agents/`. Install them once and Claude Code dispatches each role to a fresh context running its tier-pinned model — no more whole-chain-on-Opus or whole-chain-on-Sonnet.

```bash
# After installing agc via npx (e.g. ~/.npm/_npx/<hash>/node_modules/agent-governance-mcp/...)
# or a local clone, copy the 12 templates into your Claude Code agents dir:
mkdir -p ~/.claude/agents
cp -r path/to/agent-governance-mcp/templates/claude-code-agents/*.md ~/.claude/agents/
```

Primary entry points after install (v3.21.0):

- **`@teamwork <task>`** — Sonnet-pinned coordinator subagent in a fresh context. Use this instead of `/teamwork` when you want the orchestrator itself pinned to its tier (Sonnet) rather than running on your main session's model. The chain still dispatches downstream roles per their own templates.
- **`@lite <task>`** — Haiku-pinned solo-doer for single-shot work (renamed from v3.20.0's `@coordinator-lite`). The cheapest entry point for daily 1-file edits, doc tweaks, Q&A.
- **`@pm` / `@sr-engineer` / `@qa-engineer` / `@code-reviewer` / etc.** — invoke an individual role directly, each at its tier (see table above).

What changes after install:

- **Inside Claude Code with `@teamwork` (or `/teamwork`)** — coordinator dispatches via the Task tool to each role's subagent; each subagent runs in a **fresh context with the model pinned in its frontmatter** (see tier table above). Anthropic-reported cost: Opus workers + Sonnet orchestrator ≈ 40 % cheaper than all-Opus.
- **Without the templates installed, or outside Claude Code** (Cursor, Continue, Anti-Gravity, plain MCP clients) — coordinator silently falls back to the existing `tw_switch_role` text-load path. No tw_* tool surface changes.

For the conceptual model — the two orthogonal axes (slash `/teamwork` vs `@teamwork` entry point ⊥ Task-dispatch vs `tw_switch_role`), and why `/teamwork` also model-routes when a host advertises a `Task` tool — see [docs/architecture.md → Entry points & model routing](docs/architecture.md#entry-points--model-routing).

See [specs/subagent-dispatch.md](specs/subagent-dispatch.md) + [specs/subagent-short-names.md](specs/subagent-short-names.md) + [research/multi-agent-auto-model-routing-directions.md](research/multi-agent-auto-model-routing-directions.md) for the full design + roadmap.

---

## Limits (read before adopting)

- **Cannot force AI to follow the constitution** — only injects it into context. AI can still hallucinate. The gates stop *state writes*, not bad reasoning.
- **Cannot stop direct `fs.write`** — if an AI bypasses MCP and edits `handoff.md` directly, `tw_detect_drift` catches it on the *next* session, not at write time.
- **`agent_id` is self-declared** — gate blocks empty/misspelled ids but cannot stop deliberate impersonation.
- **Stdio mode is local-fs only** — no cross-machine sync. For teams: HTTP+SQLite mode, or commit `.current/` to Git.
- **First `npx` pull is slow** — 30-60s. If the SessionStart hook's `timeout` is < 60s, it appears broken. (#1 install pitfall.)

---

## Setup (full)

- **All clients + hook config**: [docs/install.md](docs/install.md)
- **HTTP / Docker / remote mode**: [docs/http-mode.md](docs/http-mode.md)
- **Workspace customisation** (task format, constitution override): [docs/config.md](docs/config.md)

### SessionStart hook (Claude Code only)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "npx -y -p github:Paul-hengChen/agent-governance-mcp#v3.64.1 agent-governance-context",
        "timeout": 60
      }]
    }]
  }
}
```

The hook is a silent no-op outside managed workspaces (no `.current/`, `tasks.md`, or `TODO.md`) — by design.

---

## Links

- **Changelog**: [CHANGELOG.md](CHANGELOG.md) — every version with rationale
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md) — dev workflow, project layout, schema-version checklist
- **Architecture**: [docs/architecture.md](docs/architecture.md) — 9-step write pipeline, state machine, RAG lifecycle
- **Research**: [research/](research/) — token-frugality audits, industry comparisons, retrospectives
- **Repo**: <https://github.com/Paul-hengChen/agent-governance-mcp>

---

License: ISC · Author: Paul Chen ([@Paul-hengChen](https://github.com/Paul-hengChen))
