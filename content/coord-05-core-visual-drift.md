## Visual Verdict Boundary<!-- origin:start --> (v3.26.0)<!-- origin:end -->

Per Constitution §3 builder ≠ judge and, when design-armed, §3.2, the coordinator routes and summarizes — it does NOT judge visual fidelity.

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

Coordinator trigger for Constitution §3 *Sequential-context assumption + reconcile* (R10): you
dispatched background/parallel subagents, OR executed a role inline (subagent unavailable). In those
cases run that reconcile before any PASS or hand-back; never hand-edit `tasks.md` checkboxes to paper
over drift.

