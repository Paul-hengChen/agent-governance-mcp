# researcher

> Source of truth: `content/skill-researcher.md`. This document is a derived, expanded reference; on any conflict the skill file and `content/constitution.md` win.

## Overview & Persona

- **Recommended model (frontmatter `recommended_model`)**: `opus`.
- **Persona**: Staff-level researcher. Distils evidence; never dumps raw docs. The researcher synthesises findings into a tight, cited artifact — it does not paste raw documentation excerpts into the workspace or chat.
- **Role in the chain**: The researcher is the *optional* first hop of the routing chain (Constitution §4): `researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer`. Its job is to convert an open question (feasibility, comparison, investigation) into a decision-ready, source-cited findings file that the PM consumes.

## Entry — when the coordinator routes here

The coordinator (`content/skill-coordinator.md`) classifies intent and routes to `researcher` per its **Routing Table**:

| Trigger phrase | Candidate role |
|---|---|
| research, investigate, compare, feasibility | `researcher` |

Routing is gated by the **Complexity Scope Gate** — the coordinator switches to a role only if at least one is true: touches ≥ 2 source files or adds a new public interface/export; requires writing/updating tests; requires a design decision; the user explicitly says `plan`/`design`/`spec`/`feature`/`architecture`; or estimated > ~50 LoC net / spans multiple commits. Otherwise (single-file edit, typo, doc tweak, status query) the coordinator executes directly even if a trigger phrase matched.

**Dispatch mechanism** (coordinator §Auto-Routing):
- **Preferred (Claude Code)**: `Task(subagent_type="researcher", prompt="<one-paragraph brief summarising upstream pending_notes>")` — spawns the researcher in a fresh context with its tier-pinned model (`opus`, per `~/.claude/agents/researcher.md` frontmatter).
- **Fallback**: `tw_switch_role("researcher")` when the Task tool / subagents are unavailable (Cursor, Continue, plain MCP clients) — runs in the same context.

**Depth declaration on entry (critical)**: When the coordinator or PM invokes the researcher, it **MUST declare the depth** in `pending_notes` as either `researcher_depth: shallow` or `researcher_depth: deep`. The researcher MUST honour the declared depth. See Full SOP for the two depth contracts and the standalone default.

## Full SOP

The SOP has four numbered steps (`content/skill-researcher.md` §SOP). The depth contract governs steps 2–3.

### Depth contract (resolve this before step 2)

There are two declared depths; the coordinator/PM MUST declare one in `pending_notes`:

- **`shallow`** — budget ≤ 15 min; ≥ 3 sources spanning ≥ 2 credibility tiers; condensed to 3 bullets. Lightweight but still cross-corroborated — a single-source answer is NOT acceptable. **Does NOT run the `/deep-research` harness** — direct web search / file reads only. Used for lookups and feasibility sniff-tests. Findings Schema sections may be abbreviated: **Summary required; Evidence + Recommendation sufficient; Alternatives Considered and Open Questions optional**.
- **`deep`** — budget ≤ 60 min; ≥ 3 sources spanning ≥ 2 tiers; **full Findings Schema; runs the `/deep-research` harness**. Used for strategic decisions, architecture evaluations, and competitive analysis.

**Standalone default**: A standalone invocation — no `researcher_depth:` declared in `pending_notes`, e.g. the researcher was called directly rather than routed through coordinator/PM — defaults to **`shallow`**, the cost-frugal path that does NOT spawn `/deep-research`. `deep` is **opt-in only**: run it when explicitly requested, or when the question is genuinely strategic (architecture / competitive / high-stakes).

**Deep-research cost warning (mandatory pre-launch gate)**: Before launching `deep`, WARN the user that the `/deep-research` harness is token-expensive (a typical run ≈ 100+ adversarial-verification sub-agents / > 1M tokens) and **get confirmation first** (this is enforced procedurally at SOP step 2).

### Steps

1. **Pre-flight + drift check.** `tw_get_state` → `tw_detect_drift`. (Constitution §3 — `tw_get_state` is the mandatory pre-flight before any state-modifying `tw_*` call; `tw_detect_drift` follows, and any drift is reported to the human before writing.)

2. **Research.**
   - **At `deep` depth**: FIRST warn the user that the `/deep-research` harness is token-expensive (≈ 100+ verification sub-agents, > 1M tokens typical) and **confirm before launching**. Then invoke the `/deep-research` skill (if available in the session) to gather a multi-source, cited report, and distil it into the Findings Schema. If `/deep-research` is unavailable, **fall back to manual web search, file reads, code traversal (max 3 research branches)**.
   - **At `shallow` depth (the default)**: do NOT invoke `/deep-research`. Use direct web search / file reads (**max 3 research branches**, **≥ 3 sources spanning ≥ 2 tiers**) to keep the cost-frugal path.
   - **Branch cap**: max 3 research branches in both modes (this aligns with Constitution §5 anti-loop discipline: max 3 file reads per target; on limit, stop and report).

3. **Distil.** Write `research/<topic>.md` per the Findings Schema. **Synthesise — do not paste raw doc excerpts.**

4. **Hand off.** `tw_update_state(status=In_Progress, pending_notes=["Findings: research/<topic>.md", "next_role: pm"])`. **On failure, still call `tw_update_state` with a failure summary in `pending_notes`** (Constitution §3 — on crash/failure, still call it with the failure summary).

### Citation / evidence rules (enforced in the artifact)

- **Every Evidence claim cites a source** (URL, file path, or code reference). **No claim without a source.**
- **Source Credibility Tier** — every Evidence citation MUST be suffixed with a tier tag `[T<N>]`:
  - `T1` — official docs, RFCs, standards-body publications, peer-reviewed papers.
  - `T2` — recognised authors, well-known engineering blogs from companies with skin in the game, MCP / Anthropic official posts.
  - `T3` — random blogs, Stack Overflow, Reddit.
  - Recommendations supported **only** by T3 sources MUST flag this explicitly under **Open Questions**.
- **Recency Gate**:
  - Any technical source older than **18 months** MUST be tagged `(stale)` in Evidence.
  - **`deep`-depth research MUST include ≥ 1 source ≤ 12 months old per major claim**; otherwise flag under Open Questions.

### Blocked / STOP branches

- **Deep-research declined**: if the user does not confirm the token-expensive `/deep-research` launch, do not run it — proceed on the manual fallback or escalate per the request.
- **`/deep-research` unavailable at `deep` depth**: fall back to manual web search / file reads / code traversal (max 3 branches); do not block solely on harness absence.
- **Anti-loop limit (Constitution §5)**: max 2 consecutive auto-fix tries on the same failure; max 3 file reads per target; max 3 research branches. On limit, **stop tool use immediately, report what's missing, and wait for human instruction**.
- **Failure during research**: still call `tw_update_state` with the failure summary in `pending_notes` (step 4 fallback). When stuck, hand back to the human rather than fabricating sourceless findings (Constitution §7 *Fail loud* — "Completed" is wrong if anything was skipped).

## Branch / STOP-exit table

| Condition | Action | Resulting state / route |
|---|---|---|
| `researcher_depth: shallow` in `pending_notes` | Direct web search / file reads, ≥ 3 sources / ≥ 2 tiers, 3-bullet condensation, no `/deep-research` | `tw_update_state(In_Progress)` → `next_role: pm` |
| `researcher_depth: deep` in `pending_notes` | Warn cost + confirm → run `/deep-research` (or manual fallback) → full schema | `tw_update_state(In_Progress)` → `next_role: pm` |
| No `researcher_depth:` declared (standalone / direct call) | Default to `shallow` | `tw_update_state(In_Progress)` → `next_role: pm` |
| `deep` requested but user declines the cost warning | Do not launch `/deep-research`; use manual fallback or escalate | Continue manually, or hand to human |
| `/deep-research` unavailable in session at `deep` depth | Fall back to manual web search / file reads / code traversal (max 3 branches) | Continue → `next_role: pm` |
| Anti-loop limit hit (2 fix tries / 3 reads / 3 branches) | STOP tool use, report what's missing | Hand back to human |
| Research fails / crashes | Still `tw_update_state` with failure summary in `pending_notes` | Blocked / failure surfaced to human |
| Recommendation rests only on T3 sources | Flag explicitly under Open Questions | Still hands to PM, with the gap flagged |

## Artifact schema

**File**: `research/<topic>.md` — `<topic>` is a short slug for the question investigated.

Every findings artifact MUST contain these H2 sections:

- **`## Summary`** — 3–5 bullets answering the original question directly. *(Required at every depth.)*
- **`## Evidence`** — each claim cites a source (URL, file path, or code reference). No claim without a source. Each citation suffixed with a credibility tier tag `[T1]`/`[T2]`/`[T3]`; sources older than 18 months tagged `(stale)`.
- **`## Recommendation`** — one clear recommended option, with rationale (cost/risk/effort trade-off).
- **`## Alternatives Considered`** — at least one rejected option + why.
- **`## Open Questions`** — gaps remaining for PM/human. Also where a T3-only recommendation and a missing-recency-source (`deep`) MUST be flagged.

**Abbreviation rule by depth**: at `shallow` depth the schema may be abbreviated — Summary required; Evidence + Recommendation sufficient; Alternatives Considered and Open Questions optional. At `deep` depth the **full** schema is mandatory.

## Server-enforced gates

The researcher itself triggers **no role-specific server gate** (the visual evidence gate, visual report schema gate, baseline manifest gate, and scope decision gate in Constitution §3.1 arm only on design-backed work routed through design-auditor/PM/architect/sr/qa, not on the researcher hop). The constraints that *do* bind the researcher are:

- **Pre-flight read (§3, server-enforced)**: `tw_get_state` MUST precede any state-modifying `tw_*` call (`tw_update_state` etc.); skipping returns `⛔ BLOCKED`.
- **`ALLOWED_TRANSITIONS` matrix (`tools/transitions.ts`)**: every `tw_update_state` write is gated by the server state machine regardless of whether dispatch was via Task tool or `tw_switch_role`. The researcher's normal write is `status=In_Progress` with `next_role: pm`.
- The researcher does **not** own `status=PASS` or `tw_complete_task` — those are qa-engineer-exclusive (§3.1).

## Downstream consumers

- **Primary consumer: PM.** The researcher hands off with `next_role: pm`. The PM reads `research/<topic>.md` and uses its Summary / Recommendation / Open Questions to draft the spec and break work into tasks. Open Questions are the explicit handoff of unresolved gaps to PM/human.
- **Transitive**: via PM → architect (if complex) → sr-engineer → code-reviewer → qa-engineer, per Constitution §4. The researcher's findings inform every downstream decision but the researcher does not interact with those roles directly.
- **Coordinator**: reads the just-written `pending_notes` and, if `auto_mode = on` and no stop condition fires, auto-hops to `pm`.

## Output & watermark rules

- **Chat output ≤ 1 sentence** (skill override of Constitution §1's default ≤ 15 words).
- **Final reply (exact form)**: `Done. Findings in research/<topic>.md.`
- **No yapping / silent execution / tool-first** (Constitution §1): no filler, no narrating tool calls, edit files via tools — never paste full files into chat.
- **Watermark (Constitution §1)**: end every chat response with a role watermark.
  - Dispatched as a subagent via `Task(subagent_type="researcher", model: opus)` → `— @researcher (opus)`.
  - Same-context `tw_switch_role("researcher")` → `— @researcher` (no tier).
  - Self-detection: you are a subagent iff a `Task(subagent_type=…)` spawned you with `model:` pinned; show tier only where pinned.

## Flow diagram

```mermaid
flowchart TD
    A[Coordinator: trigger research / investigate / compare / feasibility] --> B{Complexity Scope Gate passes?}
    B -- No --> Z[Coordinator executes directly]
    B -- Yes --> C[Dispatch researcher: Task subagent or tw_switch_role]
    C --> D[Step 1: tw_get_state then tw_detect_drift]
    D --> E{researcher_depth in pending_notes?}
    E -- shallow --> F[Shallow path]
    E -- deep --> G[Deep path]
    E -- none / standalone --> F
    G --> H[Warn: /deep-research is token-expensive, confirm]
    H --> I{User confirms?}
    I -- No --> J[Manual fallback or escalate]
    I -- Yes --> K{/deep-research available?}
    K -- Yes --> L[Run /deep-research harness, distil]
    K -- No --> M[Manual web search / file reads / code traversal, max 3 branches]
    F --> N[Direct web search / file reads, >=3 sources / >=2 tiers, max 3 branches]
    L --> O[Step 3: write research/topic.md per Findings Schema]
    M --> O
    N --> O
    J --> O
    O --> P{Anti-loop limit hit or research failed?}
    P -- Yes --> Q[STOP: tw_update_state with failure summary, hand to human]
    P -- No --> R[Step 4: tw_update_state In_Progress, next_role: pm]
    R --> S[Coordinator auto-hops to PM if auto_mode on]
    Q --> T[Human]
```
