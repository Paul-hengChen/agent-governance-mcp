# Pending tickets — lane e178a

## Applied

```pending-ticket
lane_local_id: E178A-NEW-1
title: Integrator SOP cites scripts/*.mjs and docs/lane-protocol.md that exist only in the agent-governance-mcp checkout — the `integrator` prompt is callable in any workspace but not functional there
priority: P2
depends_on: [E178]
source: e178a PM cut (Q-out-of-scope), integrator pre-review to-lane#1
body: |
  PACKAGING asks for the role to be "callable in any workspace". Registration in PROMPT_REGISTRY
  makes it callable; the SOP's mechanisms (fanout.mjs, lane-status.mjs, mailbox-watch.mjs,
  merge-invariants.mjs, test-lock.mjs, docs/lane-protocol.md) are not shipped to adopters.
  Human ruling 2026-09-27: post-v4.
```

```pending-ticket
lane_local_id: E178A-NEW-2
title: prompts/build.ts RAG_SKIP_ROLES does not list the new integrator role
priority: P3
depends_on: [E178]
source: e178a PM cut
body: |
  prompts/build.ts is forbidden to lane e178a. Decide whether the integrator prompt should skip
  RAG spec-context injection like other non-build roles.
```
