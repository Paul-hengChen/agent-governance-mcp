# Token Economics of agent-governance-mcp

> Synthesised from: token-frugality-audit-v3.12.md, token-efficiency-audit-v2.md,
> token-burn-mitigations-zh.md, dispatch-token-economics.md,
> automation-flow-per-skill-token-zh.md, skill-token-efficiency.md,
> skill-token-cost-and-pixel-perfect-success-rate.md
> Authors: @researcher / @sr-engineer (multiple sessions, 2026-05-19 – 2026-05-31)
> Last synthesised: 2026-06-22

---

## Summary

- **Per-role base prompt** ranges from ~1.9K tokens (researcher / coordinator-lite) to ~5.8K tokens (qa-engineer with RAG context). Constitution alone is ~1,480 tokens post-v3.12 trimming.
- **Task subagent dispatch (A) vs same-context tw_switch_role (B)**: for a mid-large PRD, (A) costs ~145K tokens vs (B) ~303K tokens — roughly 52% savings — primarily from context isolation (downstream roles read a ~5K distilled spec, not the original ~25K PRD) plus per-role model-tier routing.
- **Five main token burn patterns** and their mitigations: (1) bundle re-injection → prompt caching; (2) context rot → external memory already built-in; (3) multi-agent fan-out → compressed summaries + Haiku routing; (4) chain + retry loops → circuit breakers already in place; (5) large file reads → offset/limit + RAG already implemented.
- **Token frugality audit (v3.12)** found only ~10 lines of true restatement / padding across 13 skill files — 1.7% actual reduction headroom, not the 5% originally estimated. All remaining content is load-bearing.
- **Biggest single optimisation**: prompt caching of the stable constitution + skill prefix. Cache hit rate needs measurement; if already caching, re-load cost drops ~90%.

---

## Per-Role Prompt Sizes (post-v3.12, measured)

Fixed injection = constitution + skill + state block + optional RAG context. Token estimate: 4 chars ≈ 1 token (English markdown; ±20% for Chinese/symbol density).

| Role | Constitution | Skill | State | RAG ctx (when on) | Total load (est.) |
|---|---:|---:|---:|---:|---:|
| coordinator | 1,480 | 800 | 125 | — (skipped) | ~2,400 |
| coordinator-lite | 1,480 | 270 | 125 | — (skipped) | ~1,880 |
| researcher | 1,480 | 290 | 125 | ~2,000 | ~3,900 |
| design-auditor | 1,480 | 1,450 | 125 | ~2,000 | ~5,050 |
| pm | 1,480 | 1,250 | 125 | ~2,000 | ~4,850 |
| architect | 1,480 | 590 | 125 | ~2,000 | ~4,200 |
| sr-engineer | 1,480 | 470 | 125 | ~2,000 | ~4,080 |
| qa-engineer | 1,480 | 2,170 | 125 | ~2,000 | ~5,780 |

Notes:
- Prompt caching amortises reload to ~10% of the above on subsequent turns within the 5-min TTL. Numbers above are worst-case (cold).
- State JSON grows with `completed_tasks` history: 51 completed tasks adds ~400 extra tokens vs a fresh workspace. No GC mechanism exists for old entries yet.

**Most expensive fixed injection**: qa-engineer at 2,170 skill tokens — 2× any other role. Its complexity is justified: 4-phase SOP (Phase 0–4), 3-round discussion protocol, Copy and Visual Audit Gates, spec-to-test mapping, coverage gate. Not recommended for compression; splitting into `skill-qa-engineer.md` + `skill-qa-visual.md` (already done in v3.8.2+) is the right approach.

---

## Dispatch Mechanism Comparison: (A) Task Subagent vs (B) tw_switch_role

Both mechanisms walk the same `ALLOWED_TRANSITIONS` routing chain. The difference is context isolation and model tiering.

| | (A) Task subagent dispatch | (B) `tw_switch_role` dispatch |
|---|---|---|
| Context | Fresh per role | Cumulative single context |
| Model | Frontmatter tier-pinned (opus/sonnet/haiku) | Unchanged from session model |
| Version | v3.20.0+ preferred | Pre-v3.20.0 / graceful fallback |
| Context isolation | Real (reviewer/qa start clean) | None (reviewer sees implementation history) |
| Cache benefit | None (cold start per role) | Prefix cache-read (~1/10 cost) |

**Model tier pinning** (from `templates/claude-code-agents/*.md`):
- Opus: architect, code-reviewer, design-auditor, researcher, sr-engineer
- Sonnet: pm, qa-engineer, qa-visual, teamwork (coordinator)
- Haiku: doc-writer, lite, release-engineer

### Cost Estimate for a Mid-Large PRD (~25K tokens, 6-role chain, zero FAIL)

| Mechanism | Total tokens | Estimated cost | Notes |
|---|---|---|---|
| (A) Fresh context + model routing | ~145K | ~US$2.6 | Downstream reads distilled spec (~5K), not raw PRD |
| (B) Single context, all-Opus | ~303K | ~US$4–6 (US$4 with cache) | Cumulative: QA context ~69K by final turn |

A saves ~52% tokens and ~35–57% cost. The gap widens with: larger PRDs, more FAIL loops, higher Opus session baseline. The gap narrows with: very small tasks, single-role work, high B cache hit rate, or when B is already on Sonnet.

**Practical checklist for (A)**:
- Install `templates/claude-code-agents/` to enable subagent dispatch.
- Write clear `pending_notes` briefs — (A) succeeds or fails on brief quality.
- Use `tw_index_prd` for large PRDs so downstream roles retrieve via RAG rather than re-loading the full document.

---

## Five Token Burn Patterns and Mitigations

### #1 — Bundle re-injection every turn (highest leverage)

The constitution + skill prefix is stable across turns within a session — the ideal prompt caching target. Cache hit reduces this cost to ~1/10.

**Status**: depends on harness behaviour. Measure cache hit rate; if not already caching, restructure the stable prefix before the dynamic state block.

Already applied: v3.12 trimming removed 10 lines of restatement (1.7% of 580 lines). Constitution shrank from ~4,683 B (v1 audit) to ~5,911 B at peak, then trimmed back to ~5,148 B after v3.12 + §3.1 compression. Further aggressive cuts risk removing load-bearing content.

### #2 — Context rot (long conversation accumulation)

**Status**: mitigated by design. `handoff.md` + `tasks.md` are the external memory store (Anthropic's recommended structured note-taking pattern). State can be reconstructed from files; the full transcript is not needed. `completed_tasks` is truncated server-side to the last 50; `pending_notes` has a character budget.

Additional mitigation: use `/clear` between unrelated tasks; Claude Code auto-compacts old turns.

### #3 — Multi-agent fan-out

When roles fan out as subagents, each returns a result to the coordinator context. If the subagent returns its full transcript instead of a compressed summary, the coordinator context bloats.

**Best practice**: subagents should return 1,000–2,000 token compressed summaries, not raw context. The `pending_notes` brief is the canonical compression surface for each role handoff.

**Model routing** (per Anthropic guidance): route cheaper tasks (doc-writer, pm, qa-engineer) to Sonnet/Haiku tiers; reserve Opus for heavy reasoning (architect, sr-engineer, code-reviewer).

### #4 — Chain + retry loops

**Status**: already bounded. `tools/transitions.ts` caps: `qa_round` ≤ 3, `review_round` ≤ 3, `visual_round` ≤ 5, hop cap 10. At round 4/4/6, the chain forces PM re-entry or human intervention. No change needed.

**Caching benefit**: each re-hop re-loads the same constitution + skill bundle; if caching is active, the re-load is nearly free.

### #5 — Repeated large file reads

**Status**: mitigated. `tw_index_prd` + RAG chunks (top-5, ≤2,048 chars each, ~2,500 tokens) replace full PRD re-injection for non-coordinator roles. `Read` with `offset`/`limit` handles large source files without full-file loads. Constitution §5 caps reads at 3 per target file.

---

## Token Frugality Audit Findings (v3.12)

Full audit of 13 skill files (580 lines total at time of audit). Three categories of cuts: (a) skill lines that restate constitution rules, (b) redundant padding/editorial prose, (c) per-file before/after counts.

**Actual headroom found: ~10 lines (1.7%)**, not the estimated 5%. Every other line carries unique normative content — role-unique behaviour, schema fields, verdict paths, or concrete failure incidents that prevent regression.

Key finding per file:
- `skill-coordinator.md`: -4 lines (restatement of §4 routing + §4 next_role prose)
- `skill-qa-engineer.md`: -2 lines (verbose rationale duplicating existing gate prose)
- `skill-architect.md`: +1 line (required ADR section addition)
- All other files: 0 or -1 line

**Security coverage** (v3.9 flagged gaps): §6 already includes OWASP-category checklist in sr-engineer + code-reviewer skills, and `npm audit --audit-level=high` dependency enforcement. "No Agent Identity Binding" and "No Observability" remain architectural protocol-level limitations — not constitution gaps.

---

## End-to-End Chain Cost Estimates (v3.8.2 architecture)

| Scenario | Coordinator | Auditor passes | PM + arch + sr-eng + qa | Phase 1.5 (5 surfaces) | Total tokens |
|---|---:|---:|---:|---:|---:|
| Non-UI feature (no auditor, no Phase 1.5) | ~3K | 0 | ~38K | 0 | ~41K |
| Small UI (1 pass, 3 baselines) | ~3K | ~6K | ~38K | ~18K | ~65K |
| Medium UI (3 passes, 10 baselines) | ~3K | ~18K | ~38K | ~50K | ~109K |
| Large UI (5 passes, 30 baselines) | ~3K | ~30K | ~38K | ~180K | ~251K |

For medium UI cost at Sonnet 4.6 rates (~$3/$15 per MTok): ~$0.33.

**Vision tokens dominate Phase 1.5**: each baseline pair costs ~5K–8K input tokens (768×768 → ~800 tokens; 1920×1080 → ~3,000 tokens). A 30-surface feature at Phase 1.5 alone can exceed 180K tokens.

---

## Optimisation Priority Order

1. **Verify / enable prompt caching on the stable prefix** — highest leverage, zero architecture change. Measure cache hit rate first.
2. **Split oversized features** — Phase 1.5 vision costs scale linearly with surface count. PM's state-count gate (≥8–10 canonical states → split) and geometric-density gate (≥3 independently-constrained geometry layers → split) already address this.
3. **Keep retry loops short** — PM's precise ACs and code-reviewer single-pass approval are the highest-leverage upstream quality improvements. Each avoided QA round saves ~25K tokens.
4. **Design-auditor passes** — maintain ≤250 lines/pass + ≤5 pass cap. Bumping to 500 lines was rejected (doubles per-pass cost for marginal coverage gain).

---

## Open Questions

1. **Prompt caching hit rate**: has the harness been verified to cache the stable constitution + skill prefix? Without measurement, the 90% reload-discount estimate is unverified.
2. **Vision-LLM precision floor across models**: the ~5px sensitivity figure is from Anthropic image-input docs. Gemini 3 Flash's floor is unchecked — if comparable, it offers a ~60–70% Phase 1.5 cost reduction.
3. **State JSON growth**: at 51+ completed tasks, the state block adds ~400 tokens per role load with no GC mechanism. A sliding window (last N completed tasks) would cap this.
4. **chars/4 approximation**: actual token counts for Chinese/code can vary ±30% from this estimate. Validated measurements from real runs are not yet available.
