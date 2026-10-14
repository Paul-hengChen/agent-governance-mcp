# Review — T-E300-01

covers: T-E300-01, T-E300-02, T-E300-03

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed commit `dc3dc7a` (branch `feat/e300-dispatch-pins-enum`) against base `6b8a195`: 23 files, +369/-68.
- T-E300-01: each `dispatch_pins` value is now `z.enum(DISPATCH_PIN_TIER_VALUES)` (a literal in `tools/handoff-parse.ts`, not an import of `MODEL_TIERS`). The custom `error` callback emits `DISPATCH_PIN_TIER_REJECTED: <value> is not a model tier; allowed: opus, sonnet, haiku, fable`, and the role comes from the zod issue path. The inputSchema carries a matching `enum` and a rewritten description.
- T-E300-02: `GATE_REGISTRY` entry 34 uses the new `GateProducer` `"tool-boundary"`, with `envelope: "plain-text"`, `documentedInProse: false` and a `(none)` mapping-comment row. It is in no `UPDATE_STATE_GATE_PIPELINE` step.
- T-E300-03: `handleGetState` wraps the storage text in `withDispatchPinsAdvisory`. When on-disk pins fall outside the enum, a top-level `dispatch_pins_advisory {pins, allowed, hint}` is added. Otherwise the original text is returned by reference. `parseDispatchPins` behaviour is unchanged (out-of-enum values are kept).
- Scope is contained. Sources: `tools/registry.ts`, `tools/handoff-parse.ts`, `tools/handoff-orchestrator.ts` (handleGetState path only), `gates/registry.ts`. Other files: their `dist/**`, `.current/e300/**`, and `qa_reports/expected-red_e300-dispatch-pins-enum.txt`. Untouched: `index.ts`, `handoff-types.ts`, `handoff-write.ts`, `telemetry.ts`, `gate-stats.ts`, `skill-frontmatter.ts`, `content/**`, `templates/**`, `test/**`.
- Verdict: APPROVED. There are no required findings, and there are four recommended findings plus one optional finding.

## AC Completeness
AC Completeness: SKIP — no specs/e300-dispatch-pins-enum.md (backlog-row-as-spec mini-chain)

For information, here is how the change lines up with the human-approved cut (option A), from `docs/backlog.md` E300 plus the fanout manifest's e300 row:
- Literal enum on every value, not imported from MODEL_TIERS: done. `tools/handoff-parse.ts:285`, `tools/registry.ts:131-141`, `:224-231`.
- Rejection names the role (zod path) and the value: done. Verified on dist (see Correctness).
- New code with a `SUFFIX_RE`-shaped name, registered as entry 34 with producer `tool-boundary`, `plain-text`, `documentedInProse: false`, and not in the pipeline: done. `gates/registry.ts:43,48,106,616-635`.
- Read-side advisory in `tw_get_state` only; never a rejection; byte-identical when clean: done. `tools/handoff-orchestrator.ts:65-102`.
- No `HandoffState` / schema / content / templates / index.ts change: confirmed in the diff stat.

## Correctness
No required findings. I ran these probes against the built `dist/` (`npm run build` gives zero errors, and the rebuilt dist matches the committed dist byte-for-byte):
- All four tiers are accepted (opus, sonnet, haiku, fable, one per key, in a single write). Zod passes, and the handler is reached.
- `"claude-opus-4-1"` gives issue path `["dispatch_pins","sr-engineer"]`, code `invalid_value`, and message `DISPATCH_PIN_TIER_REJECTED: "claude-opus-4-1" is not a model tier; allowed: opus, sonnet, haiku, fable`. With `index.ts` `formatZodError` (`index.ts:129-133`, untouched), this renders as `dispatch_pins.sr-engineer: DISPATCH_PIN_TIER_REJECTED: ...`.
- `""` is rejected with `""` echoed. A 150-char string is clipped at 100 chars, followed by `…`. `'a"b\nc'` is JSON-escaped, so the echo stays on one line. `"Opus"` is rejected (the match is case-sensitive, which is correct).
- Non-string inputs are echoed unquoted: `5`, `null`, `{"a":1}`, `["opus"]`. Their echo is clipped too. JSON-RPC input cannot carry BigInt or circular values, so the `JSON.stringify` inside the callback cannot throw here.
- Several bad pins give one issue per role (`pm`, `architect`). Unknown key `bogus` still gives `unrecognized_keys`, so `.strict()` is kept.
- `hintStatic` (`gates/registry.ts:633`) equals the fixed suffix `DISPATCH_PIN_TIER_HINT` (`tools/registry.ts:125`) byte-for-byte, as checked in the dist output.
- Advisory, checked on scratch workspaces:
  - Pins `{sr-engineer: "claude-opus-4-1", pm: "opus", architect: ""}` on disk give `dispatch_pins_advisory = {pins:{sr-engineer:"claude-opus-4-1"}, allowed:[4 tiers], hint}`. `dispatch_pins` still carries the raw value. The `""` entry is dropped upstream by `parseDispatchPins`, as before.
  - All pins in-enum, or no pins at all: the output `===` the `readState` text.
  - `readState` emits compact `JSON.stringify`, so re-serializing on the advisory path keeps the envelope format. The `try/catch` returns the original text on any parse failure, so the function never throws.
- Test run: the five targeted files give 103 tests, 91 pass, 12 fail. The full `node --test test/*.test.mjs` gives 3045 tests, 3030 pass, 12 fail, and those are the same 12. Every one of the 12 appears in `qa_reports/expected-red_e300-dispatch-pins-enum.txt`, which has 12 entries: dispatch-pins Z2/Z3; e26-gate-stats R1/R2/U1/D1/D2/T3b; e35 t-codes-registry-parity; error-code-contract AC-1/AC-5, doc-file mapping (c12), AC3 (c12). Expected-red sampling (SOP 4a) covered all 12 entries. Each one names a real test that I found in its file and that is red in the run. There are no reds outside the manifest.

## Quality
- recommended — `tools/registry.ts:582-589`: the inputSchema repeats the literal `["opus", "sonnet", "haiku", "fable"]` eight times, while the zod side reads `DISPATCH_PIN_TIER_VALUES`. Use `enum: [...DISPATCH_PIN_TIER_VALUES]` (or one shared const) so the JSON Schema and zod cannot drift. The same applies to `DISPATCH_PIN_TIER_HINT` (`tools/registry.ts:125`), which spells the list out instead of deriving it from `DISPATCH_PIN_TIER_VALUES.join(", ")`. The `hintStatic` copy must stay a literal for the contract test, which already guards it. This can go into the planned MODEL_TIERS wiring ticket.
- recommended — `tools/registry.ts:593` (inputSchema description) and `:220-221` (zod comment) still say "Advisory bookkeeping — no gate" / "File-mode only, no gate". The same description now says values are rejected with `DISPATCH_PIN_TIER_REJECTED`, a registered gate code that fires in SQLite mode too (`gates/registry.ts:628`). An agent reading the tool description gets two statements that contradict each other. Suggested wording: "no pipeline gate; the value set is enforced at the tool boundary".
- optional — `tools/handoff-parse.ts:286`: `export type DispatchPinTier` has no consumer in this diff. That is harmless, and the wiring ticket will probably use it.
- Comment discipline (SOP 4b): the added comments state WHAT and WHY, contain no absolute paths, usernames or org names, and are generic enough for agents that are not agc agents. The catalog run-on sentence at `gates/registry.ts:108-115` is long but follows the existing E40 sentence pattern, so I kept it.

## Architecture
- No `specs/e300-*-architecture.md`. Layering matches the approved cut. The vocabulary lives in the parse module and is shared by the boundary and the read side. The boundary rejection stays in zod, ahead of the pipeline. The read-side advisory touches only the `tw_get_state` envelope, with no `HandoffState` or schema change, and `index.ts` is unchanged.
- recommended — `gates/registry.ts:45-47`: the comment says "telemetry and gate-stats carry the producer verbatim, so no consumer change is needed". That is true of the types. However, `emitGateTelemetry` is called only inside the orchestrator after zod has parsed the input (`tools/handoff-orchestrator.ts:126`). A zod rejection never reaches it, so `tw_gate_stats` will always list `DISPATCH_PIN_TIER_REJECTED` under `zero_fire`, even when it fires. `telemetry.ts` and `gate-stats.ts` are outside this lane's scope, so this is not a blocker. The fix is either to make the comment say the fires are not counted, or to file it as a new discovery (lane-protocol §4) for the E6 retro and the wiring ticket. The `telemetry.ts:15` comment listing producers is also stale, but that file is also outside scope.

## Security
No findings. The boundary is narrower than before: a closed enum replaces bounded free text. The echo of the rejected value is limited to 100 chars plus an ellipsis, and strings are JSON-escaped, so the error text cannot be bloated and newlines cannot be injected into it. The advisory parses only server-produced JSON. No secrets are introduced.

## Performance
No findings. The added cost in `tw_get_state` is one `JSON.parse` of the envelope it already builds, plus a loop over at most 8 pins. The extra `JSON.stringify` runs only when the advisory fires. Zod enum validation costs about the same as the old string min/max check.

## Verdict
APPROVED — all three tasks match the human-approved cut (option A) and are confined to the owned files. Probes on dist confirm the rejection's path and echo, that `.strict()` still works, that all four tiers are accepted, that `hintStatic` matches byte-for-byte, and that the advisory leaves clean output byte-identical. Every red is in the expected-red manifest. The recommended findings (literal duplication, a stale "no gate" wording, and fires not being counted in telemetry) do not block.
