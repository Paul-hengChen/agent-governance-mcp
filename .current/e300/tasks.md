<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E300-01 E300 dispatch_pins enum: DISPATCH_PIN_TIER_VALUES literal in tools/handoff-parse.ts; zod z.enum per value in tools/registry.ts with DISPATCH_PIN_TIER_REJECTED message naming the received value; inputSchema enum + description
- [ ] T-E300-02 E300 gates/registry.ts: GateProducer + "tool-boundary"; 34th entry DISPATCH_PIN_TIER_REJECTED (plain-text, documentedInProse false, mapping comment line)
- [ ] T-E300-03 E300 read-side advisory: handleGetState envelope adds dispatch_pins_advisory for out-of-enum on-disk pins (byte-identical otherwise); parseDispatchPins keeps the value, carry-forward unchanged
- [ ] T-E300-04 E300 tests (qa-engineer): dispatch-pins enum/advisory cases; error-code-contract 33→34 + allowlist + tool-boundary producer check + no-doc mapping marker; e26-gate-stats 33→34; e35 parity excludes tool-boundary codes; e300-* as needed
