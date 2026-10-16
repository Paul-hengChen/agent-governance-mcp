# Review — T-E317-01

Round 1 — APPROVED — by code-reviewer (opus)

## Summary
- Commit f4ef626 adds one early-return guard in `emitZodGateTelemetry` (`tools/registry.ts`): `if (path.basename(workspacePath) === ".current") return;`. It also adjusts the docblock and rebuilds `dist/tools/registry.*`.
- The existing guards (non-string or non-absolute path, `statSync().isDirectory()`) and the normal-workspace emit are unchanged.
- Verdict: APPROVED.

## AC Completeness
AC-E317-1 — implemented (code) — tools/registry.ts:90. Probe through `dist/tools/registry.js` `TOOL_REGISTRY` `tw_update_state.run` with a bad tier `"gpt"`. For `workspace_path = <ws>/.current`, the ZodError `DISPATCH_PIN_TIER_REJECTED` is rethrown and the temp workspace has 0 files (`<ws>/.current/.current` does not exist). The same holds for a trailing-slash `<ws>/.current/` (`path.basename` strips the trailing separator). QA owns the resident test in `test/e303-zod-boundary-telemetry.test.mjs`.
AC-E317-2 — implemented — exactly one guard, placed before `statSync`. Probe: a normal `<ws>` still writes `.current/_primary/telemetry.jsonl`. `test/e303-zod-boundary-telemetry.test.mjs` passes unmodified (part of the 127/127 run). Dist parity: a fresh `tsc` build is byte-identical to the committed `dist/tools/registry.js` / `.d.ts`, and the maps differ only in the outDir-relative `sources`.

## Correctness
No findings within scope. (optional, out of scope, not a defect of this change) A `workspace_path` pointing at a lane directory under `.current`, such as `<ws>/.current/<lane>`, is still absolute, is a directory, and does not have the basename `.current`. It would therefore still emit under `<ws>/.current/<lane>/.current/…`. AC-E317-2 deliberately limits the fix to the single basename guard. If this matters it belongs in a separate ticket; it does not block here.

## Quality
No findings. The guard's comment is 2 lines and says what the guard does and why. The docblock edit keeps its line count. `agc check` raises no comment warning on this file.

## Architecture
There is no architecture spec. The guard sits in the existing best-effort, never-throw emitter, so the caller still rethrows the original ZodError untouched.

## Security
No findings. The change narrows where an unvalidated caller-supplied path can create directories (defence in depth on an existing boundary). It adds no new I/O.

## Performance
No findings. There is one `path.basename` call, and it now runs before `statSync`, which saves a syscall in the rejected case.

## Verdict
APPROVED. This is the minimal one-guard fix AC-E317-2 prescribes, verified by probe, and dist matches source.

Note: this review ran on the same model tier (opus) as sr-engineer, so same-model bias is possible.
