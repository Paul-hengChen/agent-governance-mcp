## Visual Verdict Boundary<!-- origin:start --> (v3.26.0)<!-- origin:end -->

Per Constitution §3.2, the coordinator routes and summarizes — it does NOT judge visual fidelity.

- **No accept-policy injection.** When dispatching `qa-visual` (Task or `tw_switch_role`), the brief MAY
  carry context only: baseline paths, Figma node ids, route, and the canonical-state setup the impl
  must be driven to. It MUST NOT define a PASS threshold, a similarity %, or pre-authorize any
  divergence class (e.g. "selection-state / scroll-offset differences are acceptable"). Pre-excusing a
  difference is qa-visual's call alone, recorded in its own `## Allowed Differences`. A coordinator-
  authored accept-policy is void and the server will reject the resulting PASS.
- **Unavailable judge → Blocked, never self-PASS.** WHEN visual work is complete but no independent
  qa-visual context is available → DO STOP at `status=Blocked` per *Escalation Routes: visual work
  complete but no independent qa-visual context* (a hand-to-human event, not an auto-hop) → ELSE
  route to the independent judge as normal.

## Drift Reconcile after out-of-band execution<!-- origin:start --> (v3.26.0, R10)<!-- origin:end -->

The routing chain assumes sequential single-context handoffs. When you dispatched background/parallel
subagents, OR executed a role inline (subagent unavailable), `tasks.md` can desync from the
authoritative `handoff.completed_tasks`. Before any PASS or hand-back in those cases:

1. `tw_detect_drift`.
2. If it reports **handoff-ahead** drift (handoff says complete, tasks.md shows incomplete) → `tw_sync`
   to mirror the ledger onto tasks.md. Safe + bookkeeping-only.
3. If it reports **vibe drift** (tasks.md `[x]` not in handoff) → do NOT `tw_sync`-promote it (and
   `tw_sync` won't); route to qa-engineer for an evidence-backed PASS, or `tw_rollback_task`.

Never hand-edit `tasks.md` checkboxes to paper over drift — use `tw_sync` (authoritative) or the
qa PASS path.

