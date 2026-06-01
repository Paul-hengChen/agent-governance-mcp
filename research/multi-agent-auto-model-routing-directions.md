# Research: Multi-Agent + Auto Model-Routing — Directions & Approaches

**Depth**: `shallow` (standalone invocation default per skill-researcher §Hard rules).
**Scope**: future architectural direction for agent-governance-mcp; the question is "how do we go from v3.19.0's advisory `recommended_model` hint to a system where the right model actually runs each role automatically?"
**Date**: 2026-06-01.

## Summary

- **Industry has converged on three orchestration patterns for multi-agent + auto routing**: (1) **subagent dispatch** (Claude Code, Anthropic orchestrator-worker) — framework owns inference, per-agent pin via YAML, parent spawns isolated children; (2) **handoff-as-tool** (OpenAI Agents SDK) — handoff is a tool call the LLM emits, receiving agent inherits or resets context; (3) **LLM-router gateway** (LiteLLM / OpenRouter / Bifrost / Portkey / ClawRouters) — provider-agnostic proxy in front of the inference call, classifies each request and dispatches to the cheapest model that meets the bar. [T1, T2]
- **Production cost evidence (2026)**: production LLM routers cut **20–60% baseline, 30–70% typical, up to 98% on narrow workloads**, with 37% of enterprises already running ≥ 5 models in production. Anthropic's own data: Opus 4.7 orchestrator + 4× Sonnet 4.6 workers ≈ 40% cheaper than 5× Opus. The economic case for routing is settled. [T2]
- **agc's structural constraint**: as an MCP server (advisory layer), agc **does not own inference** — it cannot force routing the way LangGraph or OpenAI Agents SDK can. v3.19.0 surfaced `recommended_model` hints but the chain still runs in one client context with one model. To get **actual** routing, agc must either (a) move some control into a client-side dispatcher, (b) emit a structured dispatch directive the client can act on, or (c) ship its own thin CLI harness that wraps a router gateway.
- **Recommended direction**: **two-track approach** — short term, ship a **Claude Code subagent recipe pack** (cost: ~1 spec + 11 template files; unlocks Claude Code's native parallel subagent dispatch with per-agent `model:` pinning); medium term, add a new MCP tool **`tw_dispatch_role(role)`** that returns an isolated-context dispatch directive (`{role, model, fresh_context: true, sop_url}`), letting any client that implements the dispatch protocol — Claude Code Dynamic Workflows (May 2026 research preview) and OpenAI Agents SDK both have a hook for this — perform real per-role model switching. Skip the "wrap our own CLI" path until adoption justifies it.
- **Hard trade-off to confront upfront**: real routing means **breaking the single-context invariant**. Today the whole `/teamwork` chain runs in one client context — every role inherits the full conversation. Subagent dispatch and handoff-as-tool both create **fresh contexts per role**; you gain per-role model selection and isolation but lose implicit history. PM and architect specs already capture decisions in files (`specs/<feature>.md`, `qa_reports/`, `review_reports/`) — agc is unusually well-positioned to survive context resets because state lives on disk, not in chat. This is a feature of agc's architecture, not a bug.

## Evidence

### E1 — Subagent dispatch is Anthropic's recommended pattern, and 2026 made it parallel and large-scale

- Subagents are reusable configurations defined in YAML at `.claude/agents/*.md`, each with custom system prompt, model selection, and tool permissions. Per-agent model selection enables routing high-stakes reasoning to Opus and high-volume cheap tasks to Haiku. An Opus 4.7 orchestrator + 4× Sonnet 4.6 workers ≈ **40% cheaper than 5× Opus**. — [cloudzero.com 2026 Claude Code agents post] [T2]
- **Dynamic Workflows (May 28, 2026)**: Claude writes an orchestration script on the fly then spins up **up to 1,000 subagents in parallel**. From April 24, 2026 onward, subagents + MCP connections initialize in parallel, cutting startup latency. Subagents run within a parent session and report back, making them **the most token-efficient agent type**. — [pasqualepillitteri.it research preview note, mindstudio.ai blog] [T2]
- Practical pattern cited in the wild: Haiku subagent does first-pass syntax check → only flagged files routed to Sonnet code-reviewer → Opus invoked only when Sonnet flags architectural concerns. This is **exactly the shape of agc's coordinator → code-reviewer → architect chain** — just with model tiers wired in. — [vibecodingacademy.ai 2026 subagents guide] [T2]
- Cross-corroborated by Anthropic's own orchestrator-worker post in the existing repo research: `research/agent-governance-framework-industry-comparison.md` (Q1–Q5) reported the same multi-agent system outperformed single-agent Claude Opus 4 by **90.2%** and cut research time up to **90%**. [T1, internal-citing-T1]

### E2 — LLM-router gateways are mature, provider-agnostic, and quantified

- Production LLM routers in 2026: **ClawRouters** (cost optimization + BYOK), **OpenRouter** (623+ models in one API), **LiteLLM** (self-hosted open-source), **Bifrost** (11μs overhead — fastest), **Portkey** (enterprise compliance). Most ship as drop-in OpenAI-API-compatible proxies. — [clawrouters.com 2026 router comparison, mindstudio.ai AI model routers post] [T2]
- **Quantified savings**: "20–60% baseline, 30–70% typical, up to 98% on narrow workloads" cited across multiple 2026 production reports. Price spread between cheapest and most expensive frontier model is now **~1000×** (Gemini 3 Flash input $0.075/M vs Claude Opus 4 output $75/M) — the spread is large enough that routing pays for itself even with rough heuristics. — [burnwise.io LLM model routing guide, swfte.com intelligent LLM routing post] [T2]
- **Routing mechanism**: a router is itself an LLM (typically small/cheap) that classifies each prompt's complexity → dispatches to the appropriate downstream model. Conceptually identical to agc's coordinator role's classification step, but operating one layer lower (per-prompt, not per-role). — [getmaxim.ai top-5 LLM router solutions, inworld.ai best LLM router guide] [T2]
- **Adoption signal**: **37% of enterprises run 5+ models in production in 2026**. Routing is no longer experimental. — [mindstudio.ai AI model router post] [T2]

### E3 — OpenAI Agents SDK ships handoff-as-tool with per-agent model config

- OpenAI Agents SDK (early 2026 open-source release) primitives: **Agents, Tools, Handoffs, Guardrails** — Agents carry their own `model=` parameter. Handoffs are represented as tools to the LLM (e.g. `transfer_to_refund_agent`); the model itself decides when to delegate. — [openai.github.io/openai-agents-python handoffs docs] [T1]
- **Recommended pattern**: triage agent uses **GPT-5.4-mini** (fast + cheap) for classification → hands off to specialists running heavier models. Direct parallel to agc's coordinator-as-Sonnet → opus-tier specialists pattern. — [developers.openai.com agents guide] [T1]
- **Architectural difference from agc**: OpenAI Agents SDK lets the **model** choose the handoff destination; agc's transitions are **server-enforced** (`tools/transitions.ts` ALLOWED_TRANSITIONS). agc's model is more constrained — and that constraint is what gives it the audit trail. The two approaches are not mutually exclusive: agc could keep server-enforced routing AND add per-role model dispatch on top. — [internal `tools/transitions.ts`] [T1]

### E4 — MCP servers as advisors: structural ceiling and the escape hatch

- An MCP server has no inference channel — by design, it returns text the host LLM reads. Existing repo audit captured this: `research/agent-governance-framework-industry-comparison.md` lists **"no model-routing / cost control"** as one of the **three biggest gaps vs 2025–2026 best practice** alongside parallel agents and observability. [T1, internal]
- v3.19.0 already does what the MCP layer alone can do: surfaces `recommended_model` via three channels (`tw_switch_role` response, `prompts/build.ts` body, SessionStart hook banner). Beyond surfacing, **enforcement must move into the client**. — [internal `specs/model-routing.md`, `specs/model-routing-architecture.md`] [T1]
- Claude Code Dynamic Workflows + per-subagent `model:` frontmatter is the cleanest **existing** mechanism that an MCP server can leverage — agc only needs to provide the YAML files (or a generator). LiteLLM / OpenRouter sit one layer lower and could be wired if agc shipped its own CLI wrapper, but that's a bigger architectural commitment. — [vibecodingacademy.ai subagents guide, mindstudio.ai routers post] [T2]

## Recommendation

**Adopt the two-track approach described in *Summary* — short-term subagent recipe pack, medium-term `tw_dispatch_role` MCP tool — and explicitly defer the "agc ships its own CLI router" path until usage proves it needed.**

### Track 1 (short term, ≤ 1 week) — Claude Code subagent recipe pack

**What ships**:
- `templates/claude-code-agents/<role>.md` × 11 files — one per role, each pre-filled with the tier from `specs/model-routing.md` (e.g. `sr-engineer.md` has `model: opus` frontmatter; `doc-writer.md` has `model: haiku`).
- A README section + `agc init-subagents` CLI bootstrap that copies the templates into `~/.claude/agents/`.
- A `## SOP` body in each template that says: "When invoked, call `tw_switch_role(<role>)` then follow the returned SOP. Your model is pinned to the tier in the frontmatter."

**Why this first**:
1. Zero architectural change to the MCP server.
2. Leverages Claude Code Dynamic Workflows directly — when the user's coordinator delegates via Task tool to one of these subagents, Claude Code starts a **fresh context with the pinned model** automatically.
3. Anthropic's own published 40%-savings figure tracks straight to agc's chain shape; no engineering risk, just packaging work.
4. Cost is one feature-sized chunk — fits a normal `/teamwork` flow.

**Limits**: Claude Code only. Cursor / Anti-Gravity / Continue users still pay the manual-switch cost. That's acceptable for Track 1.

### Track 2 (medium term, 1–2 quarters) — `tw_dispatch_role` MCP tool

**What ships**:
- New MCP tool: `tw_dispatch_role(role) → { role, model, fresh_context: true, sop_text, evidence_path }` returning a structured dispatch directive instead of just SOP text (which is what `tw_switch_role` returns today).
- Document the protocol so other multi-agent harnesses (OpenAI Agents SDK adapters, LangGraph nodes, custom wrappers) can read the directive and call their own dispatch primitive — Agents SDK's `transfer_to_<agent>` tool, LangGraph's `Send` API, CrewAI's `delegate` — with the right model already selected.
- Keep `tw_switch_role` as a back-compat alias for hosts that don't implement dispatch (it remains the same text-load no-op).
- Add a token of trust: `tw_dispatch_role` requires the client to echo back a `dispatch_ack: <role>@<model>` in the next `tw_update_state` — this is the audit hook so the server can detect "client claimed to dispatch but actually didn't" drift.

**Why second**:
1. Unblocks every MCP client, not just Claude Code.
2. Couples cleanly to agc's existing `ALLOWED_TRANSITIONS` — the dispatch directive is just a richer version of the role-switch envelope.
3. Stays in agc's lane: server defines the contract, client owns inference.

### Explicitly out of scope (Track 3) — agc ships its own CLI router

Wrapping LiteLLM / OpenRouter inside an `agc run` CLI would give agc real inference control and unlock cost dashboards, but it:

- Forces agc out of "MCP advisor" lane into "agent harness" lane — competing with Claude Code, OpenAI Agents SDK, LangGraph (much bigger codebases).
- Requires solving secrets management, prompt-cache passthrough, streaming, structured output across providers.
- Duplicates effort already done by LiteLLM (open-source, Apache-2.0).

**Recommended posture**: write a 10-line ADR documenting this is a deliberate non-goal; revisit if Track 2 adoption stalls because hosts won't implement dispatch.

## Alternatives Considered

- **Stay fully advisory (do nothing beyond v3.19.0)**. Rejected: leaves the chain running on a single client-selected model — every user keeps paying Opus prices for Haiku-class work (the original problem that motivated v3.19.0). The hint is necessary but not sufficient; we already shipped it.
- **Hand-roll a router proxy inside agc (Track 3)**. Rejected for now — see *out of scope* above. Re-visit if Track 2 fails adoption.
- **Bet only on Claude Code subagents (Track 1 only)**. Rejected as a *final* destination: locks the framework to a single IDE, contradicts agc's "multi-IDE / multi-session" core value proposition (per `README.md` opener). Acceptable as a *first* step because it ships fast and proves out the per-role-model pattern with real Anthropic infra.
- **Mirror OpenAI Agents SDK's "handoff-as-tool" exactly** — let the LLM choose which role to hand off to via tool calls. Rejected: agc's whole differentiator is **server-enforced routing** (`ALLOWED_TRANSITIONS`). Letting the LLM pick the next role re-opens the drift surface that `tools/transitions.ts` is designed to close. Track 2's `tw_dispatch_role` adds **model** routing without giving up **role** routing.

## Open Questions

- **Context inheritance vs reset on dispatch**: Anthropic subagents inherit some parent context (the parent's tool descriptions, MCP server registrations) but start with a fresh conversation. agc's `specs/<feature>.md` + `qa_reports/` + `review_reports/` already serialise the load-bearing context to disk — but is that enough for sr-engineer to pick up mid-implementation across a context reset? Empirical question; mitigated by `tw_get_state` re-injection on dispatch but not yet tested at scale. **Suggested next step**: run one realistic feature through a fresh-context Claude Code subagent dispatch and measure how much state is recoverable.
- **Router gateway integration timing**: Track 3 is deferred, but `LiteLLM` could be a *recommended* (not bundled) companion — should agc ship a doc page wiring it up for users who already self-host? Decision deferred to whoever picks up Track 2.
- **Cost telemetry**: routing without measurement is just hope. None of this research recommends an observability layer for agc; the existing repo audit flagged observability as another of the three gaps alongside model-routing. **Implication**: Track 2 should plan a `dispatch_ack`-derived cost ledger (per-role token + model + cost columns persisted in `.current/`) so users can verify the routing actually saved money.
- **T3-source freshness**: most of the 2026 router-comparison blog posts cited are T2 vendor / aggregator content. The Anthropic / OpenAI primary docs (T1) corroborate the architectural shape but quantitative cost figures (40%, 30–70%, etc.) rely on T2. Treat dollar figures as ballpark, not contract.

---

## Sources

**External (web search, 2026-06-01)**

- [Claude Code Subagents: The Complete Guide to Parallel Workflows](https://www.vibecodingacademy.ai/blog/claude-code-subagents-complete-guide) [T2]
- [Claude Code Agents In 2026: Agent View, Subagents, Teams, And What Parallel Sessions Actually Cost — CloudZero](https://www.cloudzero.com/blog/claude-code-agents/) [T2]
- [Dynamic Workflows in Claude Code: Anthropic Opens Research Preview with Up to 1,000 Subagents — Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/3663/claude-code-dynamic-workflows-anthropic-research-preview) [T2]
- [Multi-Agent Orchestration in Claude Code: The Architecture and Economics of Subagents — Neural Notions / Medium](https://medium.com/neuralnotions/multi-agent-orchestration-in-claude-code-the-architecture-and-economics-of-subagents-06d52e69f8b2) [T2]
- [Best LLM Routers 2026: 11 Tools Tested (With Real Cost Data) — ClawRouters blog](https://www.clawrouters.com/blog/best-llm-routers-2026) [T2]
- [Intelligent LLM Routing: How Multi-Model AI Cuts Costs by 85% — Swfte AI](https://www.swfte.com/blog/intelligent-llm-routing-multi-model-ai) [T2]
- [AI Model Routers Compared: Bifrost, LiteLLM, Portkey & More — MindStudio](https://www.mindstudio.ai/blog/best-ai-model-routers-multi-provider-llm-cost) [T2]
- [LLM Model Routing: Cut Costs 85% with Smart Model Selection — Burnwise](https://www.burnwise.io/blog/llm-model-routing-guide) [T2]
- [Handoffs — OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/handoffs/) [T1]
- [Orchestration and handoffs — OpenAI API docs](https://developers.openai.com/api/docs/guides/agents/orchestration) [T1]
- [Agent orchestration — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/multi_agent/) [T1]

**Internal (existing repo research, cross-corroborated)**

- `research/agent-governance-framework-industry-comparison.md` — Q1–Q5: identifies "no model-routing / cost control" as one of the three big gaps; documents Anthropic orchestrator-worker pattern. [T1-citing-T1]
- `research/architecture-vs-industry-and-token-frugality-zh.md` — same gap analysis in Chinese with `per-role model-routing` framed as the recommended remedy. [T2-internal]
- `research/token-burn-mitigations-zh.md` — §model-routing: Claude Code subagent pattern cited as the route-to-Haiku mechanism. [T2-internal]
- `specs/model-routing.md`, `specs/model-routing-architecture.md` — v3.19.0 surfaced the hint; this research is the natural follow-up on enforcement. [T1-internal]
