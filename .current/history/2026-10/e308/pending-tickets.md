# Pending tickets (lane e308)

## Applied

```pending-ticket
lane_local_id: E303-NEW-1
title: Zod-boundary telemetry emit mis-resolves lane dir when workspace_path is <ws>/.current plus a bad dispatch_pins tier
priority: P3
depends_on: [E303]
source: code-reviewer C1, confirmed by qa-engineer T-E308-02
body: |
  With workspace_path=<ws>/.current and a bad dispatch_pins tier, zod v4 skips the
  .current-basename refine, so emitZodGateTelemetry (tools/registry.ts) writes under
  <ws>/.current/.current/_primary/telemetry.jsonl. A one-line guard (skip the emit when
  the path basename is ".current") would fix it. Not required by E303 AC8; no test pins it.
```

```pending-ticket
lane_local_id: E308-NEW-1
title: Tier literals remain in the dispatch_pins inputSchema description and gates/registry.ts clearingArtifact
priority: P4
depends_on: [E308]
source: code-reviewer Q1, recorded by qa-engineer T-E308-02
body: |
  The tier list still appears as literals in the tools/registry.ts dispatch_pins inputSchema
  description and in gates/registry.ts clearingArtifact / hintStatic (spec-retained: the gates
  module is an import-free leaf). Only hintStatic is guarded (byte-equality test in
  test/error-code-contract.test.mjs). Candidate: compose the description from MODEL_TIERS and
  add a guard for clearingArtifact.
```
