# Post-v3.5.1 Coverage Audit — Constitution vs 12-rule Template

## Summary

- **Substantive coverage ≈ 90%**: after v3.5.0 + v3.5.1 fusion, all 12 rules' *headline* ideas exist in the constitution or skills; only sub-clauses are missing.
- **R5 (model judgment) and R6 (token budgets) remain correctly deferred** — both require server-side enforcement to be meaningful in a multi-agent MCP context.
- **3 sub-clause gaps remain**, all medium-or-lower value. None are material capability gaps; each is a refinement.
- **Diminishing returns**: further line-by-line fusion risks diluting signal density. The constitution already exceeds the 12-rule template in scope (multi-agent §3/§4 have no template equivalent).
- **Recommendation: STOP fusing**. Optionally add 1 phrase (`No single-use abstractions`) if 100% R2 coverage is wanted; otherwise treat fusion as complete.

## Evidence

### Full clause-level matrix (post-v3.5.1)

| Rule | Sub-clause | Status | Location |
|---|---|---|---|
| **R1** | State assumptions explicitly | ✅ Covered | §7 Think first |
| R1 | If uncertain, ask | ✅ Covered | §7 Think first |
| R1 | **Present multiple interpretations when ambiguity exists** | ⚠️ **GAP** | not in constitution |
| R1 | Push back when simpler approach exists | ✅ Covered | §7 Think first |
| R1 | **Stop when confused. Name what's unclear** | ⚠️ Partial | sr-engineer Clarification Gate (skill-level only) |
| **R2** | Minimum code | ✅ Covered | §1 MVP strict |
| R2 | Nothing speculative | ✅ Covered | §1 MVP strict |
| R2 | No features beyond what was asked | ✅ Covered | §1 MVP strict |
| R2 | **No abstractions for single-use code** | ⚠️ **GAP** | implied by MVP strict but not stated |
| R2 | "Senior engineer overcomplicated" test | ⚠️ Tone-only | implied throughout |
| **R3** | Touch only what you must | ✅ Covered | §1 Surgical changes |
| R3 | Clean up only your own mess | ✅ Covered | §1 Surgical changes |
| R3 | Don't improve adjacent code/comments/formatting | ✅ Covered | §1 Surgical changes |
| R3 | Don't refactor what isn't broken | ⚠️ Implied | combo of Surgical + MVP strict |
| R3 | Match existing style | ✅ Covered | §2 Match conventions |
| **R4** | Define success criteria | ✅ Covered | §7 Goal-driven |
| R4 | Loop until verified | ✅ Covered | §7 Goal-driven |
| R4 | "Don't follow steps" (criterion-driven, not script-driven) | ⚠️ **Tension** | conflicts with PM's task-list approach — intentionally not adopted |
| **R5** | Use model for judgment only | ❌ Deferred | architectural — tool-driven MCP implicitly satisfies |
| R5 | If code can answer, code answers | ❌ Deferred | same |
| **R6** | Per-task / per-session token budget | ❌ Deferred | needs server-side metering |
| **R7** | Pick one (more recent / more tested) | ✅ Covered | §7 Surface conflicts |
| R7 | Explain why | ✅ Covered | §7 Surface conflicts |
| R7 | Flag the other for cleanup | ✅ Covered | §7 Surface conflicts |
| R7 | Don't blend | ✅ Covered | §7 Surface conflicts |
| **R8** | Read exports / callers / utilities | ✅ Covered | §7 Read before write |
| R8 | "Looks orthogonal" is dangerous | ✅ Covered | §7 Read before write |
| R8 | If unsure why, ask | ✅ Covered | overlap with §7 Think first |
| **R9** | Tests encode WHY | ✅ Covered | skill-qa-engineer Hard rules |
| R9 | **A test that can't fail when business logic changes is wrong** | ⚠️ **GAP** | assertive form not stated |
| **R10** | Summarize done / verified / left | ⚠️ Implicit | tw_update_state pending_notes mechanically does this; not stated as cognitive rule |
| R10 | Don't continue from state you can't describe back | ⚠️ Partial | implied by drift check / pre-flight read |
| R10 | If you lose track, stop and restate | ⚠️ Partial | §5 Escalation covers loop-limit but not lost-track |
| **R11** | Conformance > taste | ✅ Covered | §2 Match conventions |
| R11 | Surface harmful, don't fork silently | ✅ Covered | §2 Match conventions |
| **R12** | "Completed" wrong if skipped | ✅ Covered | §7 Fail loud |
| R12 | "Tests pass" wrong if skipped | ✅ Covered | §7 Fail loud |
| R12 | Default to surfacing uncertainty | ✅ Covered | §7 Fail loud |
| **Top** | "Bias: caution over speed on non-trivial work" | ❌ Not adopted | meta-rule, no explicit equivalent |

Sources: [content/constitution.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md), [content/skill-qa-engineer.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-engineer.md), [content/skill-sr-engineer.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-sr-engineer.md), user-provided 12-rule template.

### Gap value classification

| Gap | Value | Effort | Recommendation |
|---|---|---|---|
| R1 "Present multiple interpretations" | Medium | Low (~15 tok) | Skip — overlap with `If ambiguous, ask`; adds nuance not new behavior |
| R1 "Stop when confused / name what's unclear" | Low | Low | Skip — sr-engineer Clarification Gate already encodes the mechanism |
| R2 "No abstractions for single-use code" | **Medium-High** | Low (~10 tok) | **Optional add** — concrete YAGNI rule, distinct from generic MVP strict |
| R2 "Senior engineer overcomplicated" test | Low | n/a | Skip — taste/tone, not a rule |
| R3 "Don't refactor what isn't broken" | Low | Low | Skip — covered by Surgical + MVP strict combination |
| R4 "Don't follow steps" | Negative | n/a | **Reject** — conflicts with PM-driven task lists; multi-agent flow needs steps |
| R9 "Test that can't fail = wrong" | Low | Low | Skip — assertive restatement of "encode intent" |
| R10 "Lost-track recovery" | Low | Low | Skip — drift check + pre-flight read mechanically enforce |
| Top "Bias: caution over speed" | Low | Low | Skip — already implicit in "Think first" + "Fail loud"; one more meta-statement adds noise |

### Architectural observations

1. **The constitution now exceeds the 12-rule template in scope.** §3 (state sync), §3.1 (server-enforced chain), §4 (routing chain), §5 (anti-loop circuit breaker) are net additions with no template equivalent. The 12-rule template is a *single-agent* contract; this constitution is a *multi-agent* contract that absorbed the relevant single-agent rules.
2. **Skill files are doing legitimate work.** R1's "Stop when confused" lives in `sr-engineer` as the Clarification Gate. R9's "encode intent" lives in `qa-engineer` Hard rules. These are correctly scoped — not all 12-rule clauses belong in the constitution layer.
3. **Deliberate non-adoptions are sound.** R4 "Don't follow steps" would conflict with PM-driven task lists; R5/R6 require infrastructure that doesn't exist. Refusing to fuse these is a feature, not a gap.
4. **Token density is healthy.** The constitution body is ~870 tokens. Adding the remaining medium-value gaps (~30 tokens) yields <4% size growth — affordable but not transformative.

## Recommendation

**Treat the fusion as complete. Optionally add ONE phrase if 100% R2 coverage is desired.**

If you want a final polish pass, the highest-value single addition is:

```diff
- **MVP strict**: Fulfil ONLY what was asked. No predictive features. No speculative refactors.
+ **MVP strict**: Fulfil ONLY what was asked. No predictive features. No speculative refactors. No abstractions for single-use code.
```

Rationale:
- **Concrete YAGNI rule**, distinct from "no speculative refactors" (which targets *changes*, not *new code shape*).
- ~10 tokens, zero risk of conflict.
- Closes the only Medium-High gap remaining.

Beyond that, **stop**. Further additions would chase clauses with overlap to existing rules and degrade signal density.

## Alternatives Considered

### A. Full clause-level coverage (add all 5 medium/low gaps)
**Rejected.** ~60 tokens, mostly restating existing rules in slightly different words. Diminishing returns — the constitution starts to read like a redundant taxonomy.

### B. Lift sr-engineer Clarification Gate / qa-engineer intent rule into the constitution
**Rejected.** Both rules are role-specific behavior (sr-engineer asks before coding; qa-engineer writes intent-encoding tests). Promoting them would dilute the constitution's "applies to all roles" property.

### C. Add R6 token budget rule
**Rejected (consistent with v3.5.0 deferral).** Per-task/per-session budgets need server-side metering to be meaningful. Until `tw_update_state` (or similar) tracks token usage, the rule is unverifiable in a multi-agent setting.

### D. Add R4 "Don't follow steps" / "Define success and iterate"
**Rejected.** This conflicts with the PM-authored task list model. The 12-rule template assumes a single agent with full context discretion; the multi-agent system explicitly trades that discretion for routing and traceability. Adopting R4-as-written would weaken §4 Routing Chain.

## Open Questions

1. **R2 single-phrase add — accept or skip?** Single user decision. The audit recommends accept (low cost, medium-high value) but the v3.5.1 spec drew a stop line and reasonable people could end fusion here.
2. **R6 server-side token tracking — worth a future spec?** Would require a metering hook in `tw_update_state` and possibly a budget field in handoff state. Out of current scope but a plausible v3.6+ feature if cross-session cost control becomes a goal.
3. **Should §7 be renamed?** "Cognitive Discipline" was chosen for v3.5.0; with v3.5.1's additions, §7 now mixes thinking-quality rules (Think first, Goal-driven) with output-discipline rules (Fail loud). Not blocking, but the section is doing slightly broader work than its name suggests.
