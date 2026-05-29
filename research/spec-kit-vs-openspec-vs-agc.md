# agent-governance-mcp vs GitHub Spec Kit vs OpenSpec — competitive positioning

## Summary

- **All three sit in the same broad category** ("Spec-Driven Development tooling for AI coding agents"), use markdown artifacts on disk, and integrate with multi-IDE / multi-agent setups (Claude Code, Cursor, Copilot, etc.).
- **Spec Kit and OpenSpec are template + slash-command generators**: they shape the conversation by injecting structured prompts and producing spec/plan/tasks markdown. **Enforcement is advisory** — AI agents *may* follow the schema, but nothing rejects an out-of-spec write.
- **agent-governance-mcp (this repo) is an MCP server with hard server-side gates**: pre-flight checks, file locks, mtime freshness, allowed-transition matrix, evidence-of-PASS gates, schema-versioned state. AI agents *cannot* bypass these — the server returns `⛔ BLOCKED` envelopes.
- **The differentiator is enforcement layer**, not workflow shape. agc's three feedback counters (`qa_round`, `review_round`, `visual_round` — the last added in v3.14.0) and role-separated chain are the only mechanism among the three that *forces* iteration discipline.
- **Cost**: agc is heavier to install (an MCP server runs in your tool config) but is the only option for multi-IDE / multi-session work where lost updates matter. Spec Kit / OpenSpec are lighter for solo or sequential work.

## Evidence

### Workflow shape (similar across all three)

- **Spec Kit** ships seven slash commands forming an explicit pipeline: `/speckit.constitution` → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`, plus optional `/speckit.analyze` / `/speckit.checklist` / `/speckit.taskstoissues`. ([GitHub — github/spec-kit](https://github.com/github/spec-kit)) [T1]
- **OpenSpec** ships a three-phase workflow `Propose → Apply → Archive` via `/opsx:propose`, `/opsx:apply`, `/opsx:archive`, with expansion commands `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:bulk-archive`, `/opsx:onboard`. ([GitHub — Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)) [T1]
- **agent-governance-mcp** ships `/teamwork` (full coordinator) + `/teamwork-lite` + per-role prompts (`pm`, `architect`, `researcher`, `design-auditor`, `sr-engineer`, `code-reviewer`, `qa-engineer`, `doc-writer`, `release-engineer`) plus ten `tw_*` MCP tools. ([this repo CLAUDE.md](file:///Users/paul.ph.chen/agent-governance-mcp/CLAUDE.md)) [T1]
- All three are methodology-agnostic in style (no PM framework forced) and produce markdown artifacts. The conceptual loop is comparable: spec → plan → tasks → implement → verify.

### State persistence (filesystem in all three; agc adds a server lifecycle)

- Spec Kit stores `.specify/memory/constitution.md` + `specs/{feature-id}/` + `.specify/templates/`. The CLI bootstraps these; no centralized server. ([GitHub blog announcement](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)) [T2]
- OpenSpec: "each change gets its own folder with proposal, specs, design, and tasks"; "filesystem-based tracking rather than database persistence." Users may "update any artifact anytime" — no gates. ([Fission-AI/OpenSpec docs](https://github.com/Fission-AI/OpenSpec)) [T1]
- agc keeps the same markdown surface (`specs/<feature>.md`, `design/<feature>.md`, `tasks.md`, `.current/handoff.md`) **plus** a running MCP server process that mediates writes: pre-flight check, cross-process O_EXCL file lock, mtime freshness check, atomic tmp+rename publish. Optional HTTP/SQLite mode adds a persistence layer for multi-machine scenarios. ([this repo index.ts + guards/](file:///Users/paul.ph.chen/agent-governance-mcp/index.ts)) [T1]

### Enforcement layer (the load-bearing difference)

- **Spec Kit**: validation is **prompt-level** only. The CLI bootstraps templates; the AI agent applies logic. Documentation describes "guardrails" but they are template suggestions, not hard rules. ([GitHub — github/spec-kit](https://github.com/github/spec-kit)) [T1]
- **OpenSpec**: explicitly self-described as "fluid not rigid"; users can update artifacts anytime; "no rigid phase gates." Validation is prompt-based. ([Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)) [T1]
- **agc**: has a **server-enforced ALLOWED_TRANSITIONS matrix** (`tools/transitions.ts`) — `tw_update_state` rejects invalid `(prev_agent:prev_status) → (new_agent:new_status)` writes before they reach storage. PASS requires evidence files (`qa_reports/review_<id>.md` mandatory; v3.14.0 added `qa_reports/visual_<task-id>.md` for features with `## Visual Baselines`). Three independent round-cap counters (`qa_round=4`, `review_round=4`, `visual_round=6`) lock to PM re-entry on cap. ([this repo specs/qa-flow-enforcement-architecture.md](file:///Users/paul.ph.chen/agent-governance-mcp/specs/qa-flow-enforcement-architecture.md)) [T1]
- The agc constitution is enforced two ways simultaneously: (a) the SessionStart hook injects it into every session that has a managed workspace; (b) the server gates state writes against it. spec-kit/openSpec rely on (a) only.

### Role separation

- Spec Kit: "no PM/architect/QA gatekeeping is built in." Single agent per session is the assumed model. ([WebFetch from github/spec-kit](https://github.com/github/spec-kit)) [T1]
- OpenSpec: "no explicit role separation … operates as human-AI pairs." ([WebFetch from Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)) [T1]
- agc has a defined chain `researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer` (Constitution §4). Each role has its own SOP file and is server-validated — e.g. `tw_complete_task` is reserved for `agent_id="qa-engineer"`; `status=PASS` rejects any other `agent_id`. ([this repo content/constitution.md §3.1](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md)) [T1]

### Feedback loops & retry caps

- Spec Kit: "no hard retry limits mentioned … encourages user judgment." ([WebFetch]) [T1]
- OpenSpec: "explicit retry or feedback mechanisms aren't documented … iterative not waterfall." ([WebFetch]) [T1]
- agc has three independent round counters with hard caps and PM-escape-valve semantics: `qa_round` (3 FAILs → Round 4 lock to PM), `review_round` (3 FAILs → Round 4 lock to PM), `visual_round` (5 FAILs → Round 6 lock to PM; Round 3 sr-engineer split escalation allowed). All three are enforced in `tools/transitions.ts:validateTransition`. ([this repo tools/transitions.ts](file:///Users/paul.ph.chen/agent-governance-mcp/tools/transitions.ts)) [T1]

### Agent / IDE support

- Spec Kit supports 29 named integrations (Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, Codex CLI, Qwen Code, etc.) plus Generic. ([MarkTechPost coverage 2026-05-08](https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/)) [T2]
- OpenSpec supports 20+ tools including amazon-q, claude, cline, codex, cursor, gemini, github-copilot. ([Fission-AI/OpenSpec docs/supported-tools.md](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)) [T1]
- agc supports any MCP-compatible client: Claude Code, Cursor, Continue, Anti-Gravity, Gemini Code (per repo README). The integration model is MCP server registration, not slash-command injection per IDE. ([this repo README](file:///Users/paul.ph.chen/agent-governance-mcp/README.md)) [T1]
- All three are vendor-neutral on the AI model; differences are in tool surface.

### Cross-IDE / cross-session safety (agc-only feature)

- Spec Kit and OpenSpec are filesystem-only. Concurrent writes from two IDEs to the same `tasks.md` lose updates silently — there is no lock. ([WebFetch on both]) [T1]
- agc enforces an `O_EXCL` file lock + mtime freshness check on every `tw_update_state`. Two concurrent IDEs writing to the same handoff serialise; the later writer sees `⛔ STATE DRIFT` and must re-read. ([this repo guards/file-lock.ts + guards/session.ts](file:///Users/paul.ph.chen/agent-governance-mcp/guards/)) [T1]
- This is the original motivating problem for agc per README Pain Point 4 ("The Silent Killer: Write Conflicts / Lost Updates"). It is a different category of problem from what spec-kit/openSpec address.

### Industry framing (where Spec Kit's category sits)

- GitHub's own blog frames spec-kit as the "spec-driven development" canonical reference: "you start with a spec, which is a contract for how your code should behave and becomes the source of truth your tools and AI agents use to generate, test, and validate code." ([GitHub blog 2026](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)) [T2]
- Microsoft's developer blog and Visual Studio Magazine both position spec-kit as GitHub's official SDD framework. ([Microsoft developer blog](https://developer.microsoft.com/blog/spec-driven-development-spec-kit), [Visual Studio Magazine](https://visualstudiomagazine.com/articles/2025/09/03/github-open-sources-kit-for-spec-driven-ai-development.aspx)) [T2]
- OpenSpec positions itself as the lighter community alternative; the project tagline is "Make AI Coding Assistants Follow a Spec, Not Just Guess." ([Recca's article on OpenSpec](https://recca0120.github.io/en/2026/03/08/openspec-sdd/)) [T3]
- agc has no comparable third-party coverage yet (this repo is the only source of self-description).

## Recommendation

**agent-governance-mcp's distinct positioning is "the only SDD tool with server-side enforcement and cross-session concurrency safety."** Other tools (spec-kit, openSpec) are template + workflow generators that depend on AI cooperation. agc adds three things they don't have:

1. **Hard transition gates** — server rejects bad writes, not just prompts AI not to make them.
2. **Multi-agent concurrency safety** — file locks + freshness checks for IDEs running in parallel.
3. **Bounded iteration loops** — three independent round counters with PM-escape-valve, including the v3.14.0 `visual_round` for pixel-perfect convergence (no equivalent in either competitor).

**Position agc as complementary, not competing**, with spec-kit / openSpec:

- For solo developers with one IDE doing sequential work → **spec-kit or openSpec is enough**. Their template-generator UX is lighter, requires no MCP server runtime.
- For teams running ≥ 2 IDEs in parallel, or projects where a silent lost-update is a release-blocker, or shops that need *enforced* role separation for compliance/audit reasons → **agc fills the gap** that spec-kit and openSpec explicitly defer to "user judgment."
- The visual_round + visual evidence gate in v3.14.0 is a category neither competitor has — pixel-perfect convergence as a first-class iterative loop is unique to agc.

**Tactical implication for README + positioning**:
- The current README leads with the three pain points (state decoupling / rule drift / lost updates) and three-layer defense. That's the right framing — keep it, but add a 30-second "Why not spec-kit or openSpec?" FAQ row pointing to enforcement, concurrency, and the visual_round loop. (Out of scope for v3.14.0; flag as v3.15.0 README candidate.)

## Alternatives Considered

- **A1: Position agc as a spec-kit superset (one tool replaces the other).** Rejected — spec-kit's template UX and the `/speckit.*` slash commands are well-designed for solo flows; offering to replace them is over-claiming and unlikely to draw users away from GitHub-blessed tooling. Co-existence is the honest pitch.
- **A2: Migrate agc's role chain to spec-kit's command surface (use `/speckit.specify` instead of `pm`, etc.).** Rejected — agc's role chain is server-validated; reusing spec-kit's command names without their enforcement semantics would confuse users. Either invent a wrapper that pipes spec-kit commands through agc tools, or keep the surfaces distinct. The wrapper is a v3.16+ exploration, not v3.14.0.
- **A3: Drop the agc chain and rely on spec-kit's pipeline.** Rejected — agc's value (concurrency safety, evidence gates, round counters) is *attached* to the chain, not orthogonal. Removing the chain would also remove the gates. Not worth the simplification.

## Open Questions

- **Adoption signal**: spec-kit has GitHub-official endorsement + tier-2 blog coverage; OpenSpec has community traction (~20 tool integrations). No public adoption numbers found for agc yet. Worth tracking GitHub stars / npm downloads over the next 90 days as a proxy.
- **Should agc expose a spec-kit-compatible command surface as a bridge?** A `/speckit.specify` → `tw_switch_role(pm)` mapping could let spec-kit users adopt agc without learning a new vocabulary. Cost: maintaining the mapping. Benefit: reduces switching friction. v3.16+ candidate.
- **Pixel-perfect framing**: agc v3.14.0 adds `visual_round` and visual evidence gates; neither competitor has this. Is the "Why not spec-kit?" delta convincing enough on its own, or does agc need its own pixel-perfect case study (e.g. publish the cde-oobe rollout retrospective)? Suggest yes — case study makes the visual_round value tangible.
- **Recency: spec-kit announcement** dates from late 2025 (Visual Studio Magazine 2025-09-03 article) and remains under active development; this comparison reflects spec-kit's mid-2026 surface. ([VS Mag 2025-09-03](https://visualstudiomagazine.com/articles/2025/09/03/github-open-sources-kit-for-spec-driven-ai-development.aspx)) — within the 12-month recency gate, no `(stale)` flag needed.
- Only T3 source used (Recca's blog) corroborates T1/T2 — not load-bearing for any recommendation, satisfies tier requirement.
