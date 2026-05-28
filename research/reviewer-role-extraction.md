# Reviewer Role Extraction — Findings

**Question:** Split code review out of qa-engineer into a dedicated `reviewer` role between sr-engineer and qa-engineer (`sr ↔ reviewer → qa`). Is the proposed workflow sound? Are there better architectures for the current chain?

## Summary

- **Yes, the split is sound and aligned with 2025–2026 industry consensus.** Writer/reviewer separation is now treated as a structural requirement, not optional polish. The dominant failure mode of single-agent self-review is bias: a model "too close" to code it wrote will rationalise its own logic. Splitting roles removes that bias [Evidence E1, E2].
- **The proposed two-gate chain (reviewer = code judge, qa = test author) is the right granularity for this server.** "Three-agent (architect/security/QA) catches categorically more than two-agent" — adding `reviewer` between `sr` and `qa` lifts this server from a 2-gate to a 3-gate pipeline without exploding handoff cost [E2, E3].
- **Required server changes are surgical but real:** `tools/transitions.ts` (new edges + new agent enum), new skill + prompt files, a new `review_round` counter symmetric to `qa_round`, evidence-file extension (`review_reports/`), `schema_version` bump, constitution §3.1/§4 update, SessionStart hook context. The PASS-reserved-for-qa rule and `tw_complete_task` ownership stay with qa.
- **Add one constraint the user did not mention:** the reviewer must run in a **clean context** — receive only the diff against base + original PM spec + (optional) architect handoff. Do NOT inherit sr-engineer's `pending_notes` reasoning; that defeats the bias-removal point [E1, E3].
- **One simpler alternative is worth considering:** instead of a full new role, keep the current chain and require sr-engineer to spawn a self-review sub-agent (separate context, same skill). Cheaper, but materially weaker — still same model family, still no independent state-machine gate. Recommend against for this codebase since the cost of adding a real role here is bounded and one-time.

## Evidence

### E1 — Bias is the structural problem self-review cannot solve
> "The model that wrote the code is too close to it… use separate sessions for adversarial PR review that catches what one agent misses. The fix is structural: separate sessions, ideally separate models, with the validator receiving only the diff and original requirements."
[Multi-Agent Automated Code Review — MindStudio](https://www.mindstudio.ai/blog/automated-code-review-multiple-ai-agents)

> "If a single agent writes the code and the tests, it will write tests that pass its own flawed logic… the reviewing agent has no bias toward the code it's evaluating when there's a writer/reviewer separation."
[Letting Agents Run the First Draft of My SDLC — DEV Community](https://dev.to/kowshik_jallipalli_a7e0a5/letting-agents-run-the-first-draft-of-my-sdlc-safely-133c)

### E2 — Two-agent is the recommended starting topology; three-agent is the next step up
> "Start with two agents (coder + reviewer), add more only when you can observe and control every handoff."
[AI Agent Orchestration 2026 Guide — Fungies.io](https://fungies.io/ai-agent-orchestration-developers-guide-2026/)

> "A three-agent setup — architect, security, QA — catches categorically more than a two-agent setup, especially on complex diffs."
[Multi-Agent Code Review — MindStudio](https://www.mindstudio.ai/blog/automated-code-review-multiple-ai-agents)

The current chain (`sr → qa`) is the two-agent baseline. The proposed chain (`sr ↔ reviewer → qa`) reaches the three-agent tier without entering parallel-reviewer territory.

### E3 — Specialisation by reviewer concern is the natural next axis (not required now)
> "Four review agents launch in parallel: a reflector, a correctness reviewer, a quality reviewer, and an architecture reviewer."
[Agentic SDLC Guide — Beam](https://getbeam.dev/blog/agentic-sdlc-complete-guide.html)

> "Bounded agents with clear roles work better — The Analyst focuses solely on feature analysis, The Sentinel only audits, The Healer only debugs."
[Agentic Quality Assurance — Tricentis](https://www.tricentis.com/learn/agentic-quality-assurance)

### E4 — Current routing matrix (this repo) is the integration target
`tools/transitions.ts:117-143` — `sr-engineer:In_Progress` currently points directly at `qa-engineer:In_Progress`. The PASS terminal state is reserved for qa-engineer (`tools/transitions.ts:127, 139`). The round-cap (`ROUND_CAP=4`, line 147) and reset rule (`computeNewRound`, line 243) gate on `qa_round`. A new `review_round` counter must mirror these mechanics or share `ROUND_CAP`.

### E5 — Constitution §3.1 currently encodes the qa-engineer monopoly on PASS
`content/constitution.md` §3.1: `status=PASS and tw_complete_task require agent_id="qa-engineer"`. Reviewer cannot use `status=PASS` without either (a) widening this rule (rejected: weakens qa as final gate) or (b) introducing a new intermediate signal. Recommended: reviewer signals approval via `pending_notes: ["next_role: qa-engineer", "review: APPROVED", "review_report: review_reports/<task-id>.md"]` while keeping `status=In_Progress`. FAIL stays meaningful — reviewer can write `status=FAIL` to bounce back to sr.

## Recommendation

**Adopt the user's proposal, with the following concrete adjustments:**

1. **Add `reviewer` to `AgentName` union** (`tools/transitions.ts:6-12`).
2. **New transition edges** (insert between `sr-engineer:In_Progress` and `qa-engineer:In_Progress`):
   - `sr-engineer:In_Progress` → next allowed: `reviewer:In_Progress` (replaces direct `qa-engineer:In_Progress`)
   - `reviewer:In_Progress` → `{reviewer:FAIL, reviewer:Blocked, qa-engineer:In_Progress}` (reviewer "PASS" expressed as `In_Progress` handoff to qa; see E5)
   - `reviewer:FAIL` → `{sr-engineer:In_Progress, pm:In_Progress}`
   - `reviewer:Blocked` → `{reviewer:In_Progress, pm:In_Progress}`
3. **New counter `review_round`** symmetric to `qa_round`. Cap at 3 (one strike below qa because the loop is cheaper to escape: PM re-spec is cheap when style/correctness issues recur). On `(reviewer, FAIL)` increment; on handoff to qa or pm reset to 0.
4. **Constitution §3.1 amendment:** PASS still qa-only. Add: "Reviewer approval is recorded via `pending_notes` + `review_reports/review_<task-id>.md`, not via a status terminal."
5. **Constitution §4 routing chain** redrawn: `researcher → design-auditor → pm → architect → sr-engineer ↔ reviewer → qa-engineer ↺ sr-engineer`.
6. **New `content/skill-reviewer.md`** with hard rule: "Read only the diff vs base, the PM spec, and the architect handoff. Ignore sr-engineer's pending_notes commentary." Output: `review_reports/review_<task-id>.md` (Summary / Correctness / Quality / Architecture / Security / Verdict).
7. **New `prompts/reviewer.ts`** following existing pattern (e.g. `prompts/qa-engineer.ts`).
8. **`content/skill-qa-engineer.md` scope narrowing:** "Code review is owned by reviewer. QA rejects only for failing tests, missing coverage on required paths, or test-infra defects — not style/architecture."
9. **`content/skill-sr-engineer.md` handoff line change:** `next_role: reviewer` (was: `next_role: qa-engineer`).
10. **Schema bump:** `schema/versions.ts` increments handoff `schema_version`; add migration to default `review_round: 0`. SessionStart hook displays it.
11. **`tools/evidence-file.ts` extension:** support `review_reports/` writes mirroring `qa_reports/`.
12. **Tests:** `test/transitions.test.mjs` (or equivalent) covers the new edges, the `review_round` cap, and the reset semantics. qa-engineer keeps test-file ownership per constitution §2; the reviewer-role tests are still authored by qa-engineer when this feature is implemented.

**Effort estimate:** small-to-medium. Roughly 1 architect day for the spec update + transition matrix design, 1 sr-engineer day for code + migrations, 1 qa-engineer day for tests + dogfood. The bulk of risk is in (10) — schema migration touching all live workspaces. Treat as a v3.9.0 minor bump, not a patch.

## Alternatives Considered

### A1 — Self-review sub-agent inside sr-engineer (rejected for this repo)
Keep current chain; sr-engineer must spawn a fresh-context "self-review" sub-agent before handoff. Cheaper (no new state-machine work, no schema bump), but still same model family, still no independent gate, and the sub-agent's findings are not first-class in `handoff.md`. Industry evidence (E1) explicitly warns this is structurally weak. **Reject** unless the user prioritises shipping speed over review quality.

### A2 — Parallel reviewer fan-out (correctness + security + style) (defer)
Spawn three reviewer agents in parallel, aggregate verdicts. Industry-proven for "complex diffs" [E3], but operationally heavy for a solo-dev tool: 3× tokens per review, harder evidence-trail merging, more transition edges. **Defer**: ship single `reviewer` first; revisit fan-out if FAIL-loop data shows correctness vs style issues are routinely conflated.

### A3 — Merge reviewer responsibilities into architect (rejected)
Have architect do post-implementation review instead of pre-implementation design. Saves a role definition, but conflates "design judgement" with "implementation judgement" — different cognitive tasks, and architects often miss line-level defects they were never trained to look for. **Reject.**

### A4 — Reviewer as a different model than sr-engineer (recommended as a soft rule, not a hard rule)
The "ideally separate models" guidance in E1 is real. The server cannot force model choice at the MCP layer, but `skill-reviewer.md` can recommend running reviewer in a different model than sr-engineer when feasible (e.g. sr=Opus, reviewer=Sonnet or vice versa). Treat as a "Recommended Practice" note in the skill, not a tool-enforced rule.

## Open Questions

1. **`review_round` cap — 2 or 3?** Recommend 3 to match qa, but 2 would force faster PM escalation. PM to decide.
2. **Reviewer FAIL → PM threshold:** after `review_round=3` FAILs, force `(pm, In_Progress)` like the qa cap? Or allow one more sr loop? Recommend symmetric with qa for predictability.
3. **Should reviewer also run in `teamwork-lite` mode?** Currently lite is server-read-only; adding reviewer to the lite chain would require giving lite an `agent_id`. Probably leave lite untouched — lite is for solo same-context work where reviewer-as-separate-context is impossible anyway.
4. **Migration path for in-flight tickets:** when a workspace upgrades schema mid-feature with `status=sr-engineer:In_Progress`, does it route to reviewer or qa-engineer? Recommend: migration sets a flag `legacy_skip_reviewer: true` for one ticket lifetime, expires on next PM bootstrap.
5. **Reviewer's relationship to `design-auditor`:** if a feature has a design source, should reviewer also re-check copy/tokens against `design/<feature>.md`? Or is that strictly qa's UI-test concern? Defer to PM.
6. **Naming:** `reviewer` is short and clear, but conflicts with the GitHub-PR "Reviewer" concept. Consider `code-reviewer` for unambiguity. Author preference, no functional impact.
