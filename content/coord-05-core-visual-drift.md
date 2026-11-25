## Visual Verdict Boundary<!-- origin:start --> (v3.26.0)<!-- origin:end -->

Per Constitution §3 builder ≠ judge and, when design-armed, §3.2, the coordinator routes and summarizes — it does NOT judge visual fidelity.

- **No accept-policy injection.** When dispatching `reviewer-visual` (subagent-dispatch tool only; `tw_switch_role` has no `reviewer-visual` role, so that fallback switches to `code-reviewer`, whose SOP loads the visual rules) — picked over `code-reviewer` for the judge hop when the feature is design-armed and `design/<feature>.md` has `## Visual Baselines` — the brief MAY
  carry context only: baseline paths, Figma node ids, route, and the canonical-state setup the impl
  must be driven to. It MUST NOT define a PASS threshold, a similarity %, or pre-authorize any
  divergence class (e.g. "selection-state / scroll-offset differences are acceptable"). Pre-excusing a
  difference is reviewer-visual's call alone, recorded in its own `## Allowed Differences`. A coordinator-
  authored accept-policy is void: the judge ignores it, and no server check detects it (no prose inspection).
- **Unavailable judge → Blocked, never self-PASS.** WHEN visual work is complete but no independent
  judge context is available → DO STOP at `status=Blocked` per *Escalation Routes: visual work
  complete but no independent judge context* (a hand-to-human event, not an auto-hop) → ELSE
  route to the independent judge as normal.

## Drift Reconcile after out-of-band execution<!-- origin:start --> (v3.26.0, R10)<!-- origin:end -->

Coordinator trigger for Constitution §3 *Sequential-context assumption + reconcile*<!-- origin:start --> (R10)<!-- origin:end -->: you
dispatched background/parallel subagents, OR executed a role inline (subagent unavailable). In those
cases run that reconcile before any PASS or hand-back; never hand-edit `tasks.md` checkboxes to paper
over drift.

