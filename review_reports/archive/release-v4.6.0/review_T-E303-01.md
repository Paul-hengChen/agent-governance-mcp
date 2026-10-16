# Review — T-E303-01

covers: T-E303-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- E303: `defineTool.run` (`tools/registry.ts:121-130`) wraps the zod parse in try/catch. On a `ZodError` it calls `emitZodGateTelemetry(rawArgs, err)`, then rethrows the same instance. The throw is still synchronous.
- `emitZodGateTelemetry` (`tools/registry.ts:84-101`):
  - emits one telemetry line for each zod issue whose message starts with a code in `ALL_GATE_CODES`;
  - reads `workspace_path`, `agent_id` and `active_feature` from the raw arguments, each as a string or `null`;
  - is fully wrapped in try/catch.
- `gates/registry.ts` changed only the producer comment (`:45-49`).
- Scope: commit `cd4b03b`. `index.ts`, `tools/telemetry.ts`, `test/` and `content/` are unchanged.
- Verdict: APPROVED, with one recommended hardening (C1). No required findings.
- Same-model note: the sr-engineer was pinned to opus and this review also ran on opus, so the two may share blind spots. Every behaviour below was checked with a probe script run against `dist/`, not just read.

## AC Completeness
AC8 — implemented — `tools/registry.ts:84-101`, `:121-130`. Probe on a new absolute temp directory with no `.current/`:
  - The call throws synchronously, and the error is a `ZodError`.
  - Exactly one line is written to `.current/_primary/telemetry.jsonl`: `{"gate":"tool-boundary","error_code":"DISPATCH_PIN_TIER_REJECTED","agent_id":"pm","feature":"f"}`.
  - With `agent_id` left out, the line has `"agent_id":null`.
  - Two bad pins in one call give two lines.
  - A relative path, an absolute path that does not exist, and an issue with no gate code (`status: "BOGUS"`) each write nothing.
  - The code lookup goes through `ALL_GATE_CODES` from `gates/registry.ts`; there is no second list of codes.
AC9 — implemented — With `.current` created as a regular file (the THROW1/THROW2 pattern), the rethrown error has byte-identical `JSON.stringify(issues)` and `message` to the healthy run, and is still a `ZodError`. `index.ts` has no diff, so its formatting is unchanged.
AC10 — implemented (wiring) — the emitted line carries `gate: "tool-boundary"` and the registered code, which is the input `handleGateStats` counts. `test/e26-gate-stats.test.mjs` passes unmodified (34 codes). The `fired` assertion itself is qa's AC13 work.
AC11 — implemented — the non-comment changed-line count for `gates/registry.ts` is 0. The `DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md` grep prints 1, the `(none)` grep prints 0, and `index.ts` has no diff. The catalog comment was left alone, which the AC allows.
AC12 — implemented — `GATE_REGISTRY.length === 34`, and the only `tool-boundary` producer is `DISPATCH_PIN_TIER_REJECTED`. `test/e35-pipeline-order.test.mjs` and `test/error-code-contract.test.mjs` pass unmodified.

## Correctness
- C1 (recommended) — Emit can land in a nested `.current/.current/` tree.
  - **What happens:** when `workspace_path` names the `.current` state directory itself and another field fails at the same time, the telemetry line is written to `<ws>/.current/.current/_primary/telemetry.jsonl`.
  - **Why:** zod v4 skips the object-level refine at `tools/registry.ts:362-365` that rejects a `.current` basename whenever a field has already failed. So the only issue reported is the `dispatch_pins` one, and the existence check at `:88` passes.
  - **Reproduced** with `workspace_path = <tmp>/.current` and `dispatch_pins: {"sr-engineer":"x"}`.
  - **Impact:** that refine exists to stop exactly this nesting (see its comment). The misplaced line also never reaches `tw_gate_stats`, because it reads `<ws>/.current/<lane>/`.
  - **Suggested fix:** one extra guard in `emitZodGateTelemetry`, `if (path.basename(workspacePath) === ".current") return;`, so the emit mirrors the boundary's own rule.
  - **Why it does not block:** it needs two caller mistakes in the same call, the stray file stays inside the caller's own workspace, and AC8 as written does not require it.
- Ruling on the deliberate narrowing beyond AC8 (skip unless `workspace_path` is absolute **and** an existing directory): **sound, and it hides no real fire.**
  - `emitGateTelemetry` (`tools/telemetry.ts`) calls `fs.mkdirSync(dirname, { recursive: true })` on `<ws>/.current/<lane>/`, so only the workspace root has to exist.
  - A real workspace whose `.current/` does not exist yet still records the fire. Verified: the AC8 probe used a new temp directory with no `.current/`, and `.current/_primary/telemetry.jsonl` was created.
  - A root that does not exist cannot be a real workspace, since every handler would fail on it anyway.
  - A non-directory root also cannot be a workspace.
  - Side effect also verified: the existing tests that pass `/tmp/does-not-matter` no longer leave that directory behind (it is absent after the smoke run).
- Gate-code regex `^([A-Z][A-Z0-9_]*)(?![A-Za-z0-9_])` (`:71`): it cannot match a non-gate message.
  - `Field "x"…` gives the capture `F`, and the lookahead fails on `i`.
  - `workspace_path must…` and `status="PASS"…` start with a lowercase letter.
  - zod's default `Invalid option…` fails on `n`.
  - Any uppercase token that does match must also be in `GATE_CODE_SET`, so a word like `OK` emits nothing.
- Rethrow fidelity: `throw err` rethrows the caught binding unchanged, so `issues` and `message` are preserved (verified byte-identical). A non-`ZodError` thrown during the parse is rethrown untouched without calling the emit. A Proxy whose traps throw makes zod itself throw `Error("boom")`, which is the same as at base.
- Robustness against odd raw arguments: `rawStringField` returns `null` for `null`, `undefined`, a string, a number or an array. Each of those reaches the caller as the original `ZodError`, verified. A throwing getter is caught by the outer try/catch.
- The synchronous-throw contract is kept: `run` throws before returning a promise, as at base. `assert.rejects` and the formatting in `index.ts` are unaffected (dispatch-pins Z-cases pass).
- Smoke run: the 7 test files listed in the T-E308-01 report passed 135/135.

## Quality
No required findings.
- The comments at `tools/registry.ts:59-66` and `:79-83`, and the producer comment at `gates/registry.ts:45-49`, explain the mechanism and the reason in plain terms. They contain no workflow jargon, no local paths and no `##` headings.
- Optional: the comment at `:69-70` credits the lookahead with stopping a code from matching a longer token. The greedy capture plus the Set lookup already do that; the lookahead adds protection against a lowercase letter right after the code. This is accurate enough and does not need changing.

## Architecture
No architecture spec exists for this feature. The emit sits where the spec puts it (`defineTool.run`, not `index.ts`). It reuses `emitGateTelemetry` unchanged, so it shares that function's sidecar resolution and never-throw behaviour. `tools/registry.ts` → `gates/registry.ts` is a leaf import and adds no cycle.

## Security
- No required findings. The existence check is a real improvement: an absolute path that does not exist and was never validated can no longer make the server create directories.
- Informational (optional): any client that can call the tool can still make the server create `<any existing dir>/.current/<lane>/telemetry.jsonl` by sending an invalid `dispatch_pins`, without the pre-flight read. This is bounded: the stdio client is the user's own agent with its own filesystem access, the HTTP transport requires auth, and the content written is a fixed-shape JSON line. No action needed now.
- C1 above is the only boundary gap found.

## Performance
No findings. The emit runs only when validation fails: one `statSync` plus one append per gate-coded issue. The success path costs one try block and nothing else.

## Verdict
APPROVED — AC8–AC12 are all met and verified by running them, the narrowing is sound, and the rethrow is exact; C1 is a recommended one-line hardening that does not block.
