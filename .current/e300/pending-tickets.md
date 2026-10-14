# Pending tickets (lane e300)

```pending-ticket
lane_local_id: E300-NEW-1
title: zod-boundary rejections never reach emitGateTelemetry, so tw_gate_stats shows DISPATCH_PIN_TIER_REJECTED as zero_fire forever
priority: P3
depends_on: [E300]
source: qa-engineer, T-E300-04 (code-reviewer note c)
body: |
  DISPATCH_PIN_TIER_REJECTED (producer "tool-boundary") is raised by zod in
  tools/registry.ts before any handler or UPDATE_STATE_GATE_PIPELINE step runs,
  so no emitGateTelemetry call is ever made for it. tw_gate_stats therefore
  always lists it under zero_fire, and the gates/registry.ts producer comment
  overstates that its fires are observable. Fix belongs in tools/telemetry.ts
  and the index.ts / registry.ts run() error path (catch the ZodError, emit
  telemetry for any issue message starting with a registered gate code, then
  rethrow). Out of the e300 lane's owned files.
```

## Applied
