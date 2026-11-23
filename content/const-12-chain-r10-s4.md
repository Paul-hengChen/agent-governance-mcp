- **Sequential-context assumption + reconcile<!-- origin:start --> (R10)<!-- origin:end -->.** The chain assumes sequential single-context
  handoffs. Background/parallel subagents and inline-coordinator execution can desync `tasks.md`
  from the authoritative `handoff.completed_tasks`. After any out-of-band/inline execution, before a
  PASS or hand-back, `tw_detect_drift`; on handoff-ahead drift run **`tw_sync`** (mirrors the ledger
  onto `tasks.md` — bookkeeping only; NEVER writes `handoff`, NEVER promotes a `tasks.md`-only `[x]`,
  which still needs the judge's (code-reviewer) PASS). Vibe-drift (tasks-ahead) is reported, not
  reconciled → code-reviewer or `tw_rollback_task`.

## 4. Routing Chain (multi-phase work)

```
researcher (optional) → design-auditor (optional) → pm → architect (if complex) → qa-engineer → sr-engineer → code-reviewer
  code-reviewer rejection → qa-engineer → sr-engineer → code-reviewer (test defect) | sr-engineer → code-reviewer (implementation only) | pm (scenario defect)
  sr-engineer return → qa-engineer → sr-engineer (a test contradicts a scenario or collides with existing code)
```

qa-engineer writes one test per ticket scenario, sr-engineer builds to those tests, and code-reviewer, the chain's judge, reviews both and writes PASS. Each code-reviewer rejection (`(code-reviewer, FAIL)`) counts once in `review_round`, whichever role it routes to; past the `review_round` cap only pm may take the feature.
Each sr-engineer return to qa-engineer counts toward the `sr_return` cap, past which only pm may take the feature; a scenario that cannot be built stops to pm (Blocked), never to qa-engineer.

Each role finishes with `tw_update_state` whose first-class `next_role` field names the successor role so the coordinator (or human) knows where to route (`pending_notes` stays free-text prose for the next reader — it carries no routing token).

