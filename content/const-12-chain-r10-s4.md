- **Sequential-context assumption + reconcile<!-- origin:start --> (R10)<!-- origin:end -->.** The chain assumes sequential single-context
  handoffs. Background/parallel `Task` fan-out and inline-coordinator execution can desync `tasks.md`
  from the authoritative `handoff.completed_tasks`. After any out-of-band/inline execution, before a
  PASS or hand-back, `tw_detect_drift`; on handoff-ahead drift run **`tw_sync`** (mirrors the ledger
  onto `tasks.md` — bookkeeping only; NEVER writes `handoff`, NEVER promotes a `tasks.md`-only `[x]`,
  which still needs a qa PASS). Vibe-drift (tasks-ahead) is reported, not reconciled → qa or
  `tw_rollback_task`.

## 4. Routing Chain (multi-phase work)

```
researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer
                                                                                          ↑________________________|  (Round 1-3 QA review; Round 1-5 visual review)
```

sr-engineer ↔ code-reviewer loops on `(code-reviewer, FAIL)` for up to 3
rounds (`review_round` cap). The qa-engineer loop back to sr-engineer
(review Round 1 through the `qa_round` cap) runs `qa_round` independently.

Each role finishes with `tw_update_state` whose first-class `next_role` field names the successor role so the coordinator (or human) knows where to route (`pending_notes` stays free-text prose for the next reader — it carries no routing token).

