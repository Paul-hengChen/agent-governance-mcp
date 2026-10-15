# Review — T-E308-01

covers: T-E308-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- E308: the model-tier list now has one source. `DISPATCH_PIN_TIER_VALUES` in `tools/handoff-parse.ts` is the same array object as `MODEL_TIERS` in `tools/skill-frontmatter.ts`; the unused `DispatchPinTier` type is deleted.
- `tools/registry.ts` builds the rejection hint and the eight `dispatch_pins` inputSchema enums from that constant. `tools/handoff-orchestrator.ts` builds the advisory tier sentence from it too.
- The stale "no gate" wording beside `dispatch_pins` is replaced with the spec's sentence.
- Scope: commit `72c01b1`, 3 source files and their compiled output. `index.ts`, `schema/`, `content/`, `test/` and `tools/skill-frontmatter.ts` are unchanged.
- Verdict: APPROVED. One optional follow-up and one note for qa on AC6. No required findings.
- Same-model note: the sr-engineer was pinned to opus and this review also ran on opus, so the two may share blind spots. The checks below were run, not just read, to make up for that.

## AC Completeness
AC1 — implemented — `tools/handoff-parse.ts:15` imports `MODEL_TIERS`; `:288` `DISPATCH_PIN_TIER_VALUES = MODEL_TIERS`. The literal grep prints 0; the runtime check finds the same reference (`===` true).
AC2 — implemented — `tools/registry.ts:192` `dispatchPinTierJsonSchema()`; `:652-659` uses it for all 8 roles. The literal grep prints 0. At runtime there are 8 role keys, every `enum` deep-equals `[...MODEL_TIERS]`, and the 8 arrays are separate objects, none of them `MODEL_TIERS` itself.
AC3 — implemented — `tools/registry.ts:186`. A probe call with `"claude-opus-4-1"` produced exactly `DISPATCH_PIN_TIER_REJECTED: "claude-opus-4-1" ` + `gate("DISPATCH_PIN_TIER_REJECTED").hintStatic` (true). The `hintStatic` grep in `gates/registry.ts` prints 1.
AC4 — implemented — `tools/handoff-orchestrator.ts:95` builds the sentence from the constant. The literal grep prints 0. The rendered text matches the Copy/Strings row. `test/dispatch-pins.test.mjs` passes unmodified, R1–R3 included.
AC5 — implemented — the type is deleted; `grep -rn 'DispatchPinTier\b' tools/ gates/` prints 0.
AC6 — implemented — the zod comment at `tools/registry.ts:287-291` and the inputSchema description at `:663` no longer say `File-mode only, no gate` or `Advisory bookkeeping — no gate`. The description carries the exact gate sentence. `DISPATCH_PIN_TIER_REJECTED` appears 5 times (needs >= 3). The proof's "no gate prints 0" does not hold for the whole file; see Quality Q2.
AC7 — implemented — `git diff --stat c392cc3 -- schema/` is empty. `test/skill-frontmatter.test.mjs`, `test/e297-main-protected-sop.test.mjs` and `test/dispatch-pins.test.mjs` pass unmodified (part of the 135/135 smoke run below).

## Correctness
No findings.
- `z.enum(DISPATCH_PIN_TIER_VALUES)` still gets a readonly tuple of the same literal type, so the zod inferred type and the enum behave as before.
- No import cycle: `tools/skill-frontmatter.ts` imports only `js-yaml` (0 relative imports), and `dist/tools/handoff-orchestrator.js` imports cleanly.
- The advisory `allowed` array (`handoff-orchestrator.ts:91`) is still a spread copy, so the JSON output cannot alias the shared constant.
- Smoke run: `node --test test/dispatch-pins.test.mjs test/skill-frontmatter.test.mjs test/error-code-contract.test.mjs test/telemetry.test.mjs test/e26-gate-stats.test.mjs test/e35-pipeline-order.test.mjs test/e297-main-protected-sop.test.mjs` passed 135/135.

## Quality
- Q1 (optional) — Three literal copies of the tier list remain outside the single source:
  - the `dispatch_pins` inputSchema description (`tools/registry.ts:663`, `"opus", "sonnet", "haiku", "fable"` and "the four");
  - `gates/registry.ts:634` `clearingArtifact`;
  - `gates/registry.ts:636` `hintStatic`.
  The spec keeps all three on purpose: the description text is "otherwise unchanged", and `gates/registry.ts` may change only in comments. Only `hintStatic` will be guarded, by qa's AC3 byte-equality test. Adding a tier will still mean editing the description and `clearingArtifact` by hand, and no test catches a missed copy. Worth a small follow-up ticket; it does not block.
- Q2 (note for qa, AC6) — Confirmed: `grep -c 'no gate' tools/registry.ts` prints 2. Both hits were already there at base, on lines this diff did not touch:
  - `:317`, the `cut_approved_source` comment ("no gate reads it");
  - `:322`, the `dispatch_mechanism` comment ("no gate reads either").
  At base the count was 4 lines: the two above plus the two `dispatch_pins` hits this ticket removed. The spec's claim that the only hits belong to the `dispatch_pins` block is wrong. **qa should limit the AC6 check to the `dispatch_pins` block**: the zod comment around `:280-291` and the inputSchema `description` at `:663`. Assert that neither `File-mode only, no gate` nor `Advisory bookkeeping — no gate` appears, rather than a whole-file count of 0.
- Comments: the new comments say what and why, use no workflow jargon, contain no local paths and no `##` headings.

## Architecture
No architecture spec exists for this feature. Using `tools/skill-frontmatter.ts` as the source matches the spec's Dependencies section, which notes it imports nothing from `tools/`. `gates/registry.ts` stays an import-free leaf; the new comment at `tools/registry.ts:183-185` says why its `hintStatic` remains a literal.

## Security
No findings. No new input crosses a trust boundary. The inputSchema now hands out fresh arrays, so a consumer that mutates the published schema cannot corrupt the zod enum or the other role entries.

## Performance
No findings. The arrays and the hint string are built once when the module loads.

## Verdict
APPROVED — AC1–AC7 are all met and verified by running them, with no required findings; Q1 is an optional follow-up and Q2 asks qa to scope its AC6 check.
