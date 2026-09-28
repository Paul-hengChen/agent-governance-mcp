# Cross-Agent Governance: Multi-IDE / Multi-Model Strategy

> Synthesised from: cross-agent-governance-single-source-strategy-2026-06-08.md,
> unified-agent-rules-strategy.md, configuration-sprawl-resolution-2026-06-08.md,
> multi-ai-agent-model-allocation-strategy-2026-06-08.md, multi-ai-agent-pipeline-report.md
> Authors: @researcher (multiple sessions, 2026-06-08; contributors: Antigravity/Gemini, Claude Opus 4.8, Codex)
> Last synthesised: 2026-06-22

---

## Summary

- **The core pain is N hand-maintained copies of the same rules** spread across `scope × agent` (`~/.claude/CLAUDE.md`, `.antigravityrules`, `AGENTS.md`, `~/.codex/AGENTS.md`, etc.). Each copy drifts independently — the same drift class that Constitution v3.27.0 edits A1–A4 were created to close.
- **One authored ruleset + thin per-agent adapters + `agc init` per project** collapses the maintenance surface. Never hand-copy governance rules; every file other than `content/constitution.md` is either a thin loader (pointer) or a generated artifact.
- **Model allocation principle**: the model that builds should not be the final authority that declares PASS. For multi-AI pipelines — Gemini gathers and compresses external truth; Claude builds; Codex (or any independent model family) judges.
- **Three-agent pipeline** (Gemini research → Claude build → Codex QA) is the recommended multi-AI default. Builder/judge separation is more important than using a single strong model for everything.
- **CLAUDE.md 12-rule fusion** (cross-ref): `content/constitution.md` already absorbed the 5 high-value cognitive discipline rules (§7) from the 12-rule template. The fusion is complete; further line-by-line fusion risks diluting signal density.

---

## The Configuration Sprawl Problem

Current drift surface (typical workspace with three AI tools):

| File | Agent | Scope |
|---|---|---|
| `.antigravityrules` | Antigravity | project |
| `AGENTS.md` | Codex / general | project |
| `~/.codex/AGENTS.md` | Codex | global |
| `CLAUDE.md` | Claude Code | project |
| SessionStart hook | Claude Code | global |
| Global Antigravity config | Antigravity | global |

If you update one governance rule, you must manually sync it to all of the above. Each copy drifts independently, producing different agent behaviour for the same task depending on which tool is running.

**Root principle**: a rule must be authored **once** — in `content/constitution.md`, served by the MCP server. Every other file is a thin loader or generated artifact.

---

## Recommended Architecture: "Author Once, Deliver Many"

### Layer 1 — Universal contract (one file, one place)

Keep `content/constitution.md` as the **single source of truth**. Purge any agent-specific execution mechanics from the constitution body — the §1 Watermark subagent self-detection and Task-dispatch details belong in `skill-coordinator.md`, not in the universal contract. The constitution should state *what* must hold (behaviour, `tw_*` protocol, abstract routing chain), not *how a specific agent performs it*.

### Layer 2 — Per-agent adapters (generated, thin, never hand-copied)

For each agent, a thin adapter in its native config file:
- `~/.claude/CLAUDE.md` (Claude Code)
- `.antigravityrules` (Antigravity)
- `AGENTS.md` (Codex)
- `.cursorrules` (Cursor)

Each adapter contains **only**:
1. **A loader**: "invoke the `teamwork` prompt / call `tw_get_state` and follow the served constitution."
2. **An execution profile**: what this agent can/cannot do — subagent dispatch available? else fall back to `tw_switch_role`; does the watermark-tier mechanic apply; which native file the agent reads.

Adapters MUST be generated from `constitution.md` + a per-agent profile (same pattern as `templates/claude-code-agents/`). Editing the constitution and regenerating is the only maintenance action — no parallel hand-editing.

### Layer 3 — Delivery modes (per agent capability)

- **Mode A — live reference (preferred, zero drift)**: adapter points at server-served constitution; rules fetched at runtime via MCP. No frozen copy anywhere.
- **Mode B — stamped copy + staleness guard**: materialise a copy with a version stamp, ship `agc check` (warns when deployed copy is stale vs installed server version). Drift becomes loud and detectable, never silent.
- **Mode C — blind copy, no version**: rejected. This is silent drift.

### Operating model

- **Global, one-time**: place the Layer-2 thin loader in each agent's global config once. This is a pointer, not a copy of governance rules.
- **Per project**: run `agc init`. It arms `.current/` (Claude hook); extend it to detect the project's agents and drop matching generated adapters.
- **Editing rules**: edit `content/constitution.md`, regenerate, done.

**Codex confirmation** (2026-06-09 independent review): `AGENTS.md` is Codex's instruction-chain entry, supports global + project layering, and hooks are a separate lifecycle layer — not the primary rule source. Governance entry belongs in **project** adapter (dropped by `agc init`), NOT in global config (`~/.codex/AGENTS.md` holds personal preferences only). Global governance loader would force constitution reading onto every project on the machine, including non-managed ones.

**Final agreed structure**:
```
content/constitution.md   ← authoritative rules (1 file)
AGENTS.md / .antigravityrules / CLAUDE.md  ← per-project entry (generated by agc init)
~/.codex/AGENTS.md        ← personal prefs only
agc check                 ← staleness guard
```

---

## Multi-AI Model Allocation

### Core Principle: Builder ≠ Judge

The model that builds should not be the final authority that declares PASS. Independent disagreement catches more failures than self-review, regardless of model strength.

Five separation-of-duties rules:
1. Builder cannot be final judge.
2. Researcher cannot be the only source of engineering feasibility.
3. Coordinator cannot define acceptance criteria for QA or visual PASS.
4. If subagent/model limits collapse roles into one context, high-risk work should stop as `Blocked` instead of self-certifying PASS.
5. Final PASS path must always be owned by the QA role and backed by evidence.

### Recommended Mental Model: Gemini + Claude + Codex

```
Gemini gathers and compresses external truth.
Claude builds.
Codex judges.
```

| AGC role | Primary | Fallback |
|---|---|---|
| researcher | Gemini 3.1 Pro Preview (deep); Gemini 3.5 Flash (shallow) | Gemini 2.5 Pro |
| design-auditor | Gemini 3.1 Pro Preview | Claude Opus / Codex vision |
| pm | Gemini 3.1 Pro Preview (large context); Claude Sonnet (executable spec) | Codex feasibility |
| architect | Claude Sonnet | Claude Opus / Codex high-reasoning |
| sr-engineer | Claude Sonnet | Claude Opus (large refactor) |
| code-reviewer | Codex / GPT-5-Codex | Claude Sonnet (if Codex built) |
| qa-engineer | Codex | Claude (only if Codex was builder) |
| qa-visual | Gemini 3.1 Pro Preview or Codex vision | Must be independent from sr-engineer |
| doc-writer | Gemini Flash / Claude Haiku | Any low-cost model |
| release-engineer | Low-cost + strict checklist | Codex final sanity check |

**Cost tiers by risk level**:
| Risk | Tasks | Tier |
|---|---|---|
| Low | Docs, changelog, summaries | Gemini Flash / Haiku / GPT mini |
| Medium | Feature implementation, focused review, tests | Claude Sonnet / Codex standard |
| High | Architecture, security, visual fidelity, large refactor | Gemini 3.1 Pro / Claude Opus / Codex high |

Exact model IDs should stay configurable in `templates/claude-code-agents/` frontmatter — provider catalogs, preview status, and pricing change frequently.

### Multi-AI Pipeline Architecture

All three CLIs (Antigravity, Claude Code, Codex) share:
1. **Shared filesystem**: `.current/handoff.md`, `tasks.md`, `specs/`, `qa_reports/`, `review_reports/`.
2. **Shared MCP server**: `agent-governance-mcp` via stdio or HTTP+SQLite — the 10 `tw_*` tools are the only valid state mutation path.

The server enforces the same 9-step validation pipeline (`ALLOWED_TRANSITIONS`, pre-flight check, file lock, mtime freshness, schema validation, evidence gates) regardless of which CLI calls a tool.

**Standard feature workflow**:
1. Gemini researches and summarises requirements.
2. Claude writes implementation.
3. Codex performs clean-context code review.
4. Codex runs QA and tests.
5. Low-cost model stages release; Codex final sanity check for high blast-radius releases.

**Design-backed UI feature**:
1. Gemini audits design source, extracts layout, states, baselines, and structural assertions.
2. Claude implements UI + scoped render self-checks.
3. Codex reviews code diff and verifies tests.
4. Independent visual judge compares canonical states and structural assertions.
5. Codex QA validates visual evidence and server gates before PASS.

---

## CLAUDE.md 12-Rule Fusion (Historical Snapshot)

> This section records the v3.5.0 / v3.5.1 12-rule fusion decision. The work is complete; this is a historical reference.

The 12-rule template (`@Mnilax` X article) is an excellent single-agent cognitive discipline framework. Constitution v3.4.0 is designed for multi-agent orchestration. The two are complementary: 12-rule covers "thinking quality" (R1, R4, R7, R8, R12 were gaps); the constitution covers "multi-role state machine" (§3/§4 have no template equivalent).

**Fusion result (v3.5.0, completed)**: 5 high-value rules extracted as Constitution §7 "Cognitive Discipline":
- Think first (R1): state assumptions before coding; push back when simpler approach exists.
- Goal-driven (R4): define success criteria before execution; loop until verified.
- Surface conflicts (R7): when patterns contradict, pick one (more recent / more tested), explain why, flag the other. Don't blend.
- Read before write (R8): before adding code, read exports, callers, shared utilities.
- Fail loud (R12): "Completed" is wrong if anything was skipped. Default to surfacing uncertainty.

**v3.5.1 coverage audit** found ~90% substantive coverage after fusion; 3 medium-or-lower sub-clause gaps remained. Final recommendation: stop fusing. The only optional addition was "No abstractions for single-use code" (~10 tokens) to close the last Medium-High R2 gap. Further fusion would dilute signal density.

**Deliberately NOT adopted**: R5 (model judgment only — architecturally satisfied by MCP tool-driven design), R6 (per-task/session token budgets — needs server-side metering), R4 "don't follow steps" (conflicts with PM-driven task lists in a multi-agent system).

---

## Open Questions

1. **Runtime fetch capability per agent**: does Antigravity / Codex CLI load an MCP *prompt* into context automatically, or only expose MCP *tools*? This determines Mode A vs Mode B eligibility. The claims about non-Claude agents are inference from native-config conventions, not first-hand verified — effectively T3 confidence for those agents.
2. **Generation tooling scope**: `agc init` adapter generation + `agc check` staleness guard + `agc update` do not yet exist as discrete commands; this report specifies the shape, not the implementation.
3. **Watermark relocation blast radius**: moving §1 Watermark subagent-detection out of the constitution into `skill-coordinator.md` touches the watermark validation utility; confirm no managed workspace depends on reading those mechanics from the constitution body.
4. **When (A) Gemini + Claude + Codex is unavailable**: three separate CLI subscriptions and account limits can collapse the separation-of-duties model. The fallback is `tw_switch_role` (same model, same context) — which still routes through `ALLOWED_TRANSITIONS` but loses context isolation. Flag this as `Blocked` rather than silently losing the independence property.
