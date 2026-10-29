<!-- pending-tickets for lane e161 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E161-NEW-1
title: gate the structured qa suite result (qa_suite_result) — passed < total on PASS, required on PASS, non-qa authorship
priority: P2
depends_on: [E161]
source: pm, e161 lane cut (specs/e161-qa-claim-and-state-reads.md, D-E161)
body: |
  E161 (lane e161) adds an optional qa_suite_result {passed, total, command?} argument to
  tw_update_state. On a qa-engineer PASS/FAIL write that records evidence, the server writes it as a
  fixed suite-result: line at the top of the evidence section (file mode) or reports.notes (SQLite).
  It is recorded only, with no rejection. Three follow-ups need new GATE_REGISTRY entries, which
  lane e152 owns this wave, so e161 could not add them:
  (1) a qa PASS whose qa_suite_result has passed < total: reject it, or require an explicit
  disposition (compare the expected-red manifest);
  (2) require qa_suite_result on a qa PASS once the qa SOP tells qa to fill it (pairs with the
  D1-A SOP ticket the integrator files at wave close; landing this gate before the SOP would break
  every qa PASS);
  (3) a non-qa write carrying qa_suite_result is silently ignored today; an authorship rejection
  would mirror NON_REVIEWER_VERDICT_REJECTED.
  A later step could also compare the recorded figure against a machine run (the verify-release
  precedent, E9).
```

```pending-ticket
lane_local_id: E184-NEW-1
title: the role-prompt / SessionStart state block still renders the previous hop's dispatch_mechanism_tier
priority: P3
depends_on: [E184]
source: pm, e161 lane cut (specs/e161-qa-claim-and-state-reads.md, D-E184)
body: |
  E184 (lane e161) drops dispatch_mechanism_tier from the tw_get_state envelope (handleGetState).
  The other read view is prompts/build.ts renderHandoffStateBlock, which the role prompts and the
  opt-in SessionStart hook (bin/agent-governance-context.mjs) use. It renders the full parsed
  handoff, so the tier is still shown there to the role that is about to write. prompts/** and
  bin/** were forbidden to lane e161. Suggested fix: omit the same key in renderHandoffStateBlock
  (or in sanitizeForRender's caller). Expect compose-golden fixtures that carry live state to be
  re-pinned.
```

## Applied
