# Review — T-E26-01

covers: T-E26-01, T-E26-02, T-E26-03

Commit under review: `de180f1` (sr-engineer, fable). Base: parent commit.
Spec: docs/backlog.md E26 row + the 2026-07-15 order table row 5.

## Summary
- Adds `tools/gate-stats.ts` (413 lines): a read-only, never-throws `computeGateStats()` aggregator over `.current/telemetry.jsonl` (D3 gate fires) + `.current/metrics.jsonl` (E8 per-feature outcomes), plus the `tw_gate_stats` MCP handler.
- Registers one `defineTool` entry in `tools/registry.ts` (A1 pattern, `WorkspaceOnly` schema, no `index.ts` edit). Registry now 12 tools; `tw_gate_stats` present.
- Structurally distinguishes gate-backed rules (`fired`/`zero_fire`, real counts, full 32/32 GATE_REGISTRY coverage) from prose-behavioral rules (`prose_behavioral`, `fires: null`), satisfying the load-bearing E26 category-boundary requirement.
- Docs aligned: `docs/gate-retro-procedure.md` retires the "no built analysis tool exists" claim and points steps 2–4 + metrics summary at the tool; `CLAUDE.md` roster 11 → 12. No test files authored (§2 — qa owns tests).
- Verdict: APPROVED.

## Correctness
No findings. Verified live and against edge cases:
- Live run against this workspace reconciles exactly with the 07-15 retro: 18 total fires (TRANSITION_REJECTED 8, FEATURE_LEASE_HELD 4, EXPECTED_RED_DIFF_MISSING 4, MISSING_EVIDENCE 1, AC_EXECUTION_LOG_MISSING 1), 5 fired + 27 zero-fire = 32/32 coverage, 9 metrics features after 1 dedupe.
- Coverage contract holds: every `GATE_REGISTRY.errorCode` lands in exactly one of `fired`/`zero_fire` (gate-stats.ts:263-292); `GATE_REGISTRY.length===32`, no duplicate codes.
- Dedupe key is collision-safe: `JSON.stringify([feature, releasedVersion])` (gate-stats.ts:333) correctly avoids the `"a|b"+null` vs `"a"+"b|null"` ambiguity a raw string join would introduce. Verified a real duplicate pair collapses (dups=1) while `released_version: null` normalizes distinctly.
- Malformed handling verified loud: non-JSON, arrays, bare strings/numbers, and `null` all count as `lines_malformed` (readJsonlSidecar, gate-stats.ts:207-223); a well-formed object lacking `error_code` is correctly treated as a non-fire event (not counted, not malformed) rather than mis-bucketed.
- `one_pass` is strict-boolean (`rec.one_pass === true`, gate-stats.ts:349) — `"yes"` reads false, no truthy-coercion bug.
- Missing sidecars degrade to zero counts + caveats, `one_pass_rate`/means are `null` (no fake 0%), `zero_fire` still enumerates all 32. Never throws under any tested input.

## Quality
No findings. Naming, comment density, and the `// Coded by @sr-engineer` header match the surrounding tools. Posture is explicitly modeled on the `tools/exemptions.ts` (E24) never-throw loader and the `handleDetectDrift` no-guard read-only precedent — convention-consistent. No `any` types (the lone "any" hit is a comment word); `Record<string, unknown>` + typed interfaces throughout; `npx tsc --noEmit` clean; `dist/` in sync after rebuild.

Minor (non-blocking, no change required): the doc edit removed the stale "`gates/registry.ts`, 22 entries" count rather than updating it to 32 — the safer choice, since an un-pinned count cannot re-stale.

## Architecture
No findings. Correct layering: gate-stats.ts is a runtime leaf importing only `fs`, `path`, the `GATE_REGISTRY` value/`GateProducer` type, and registry types — no back-edge into the orchestrator, no guard, no state mutation. The category boundary is genuinely *structural*, not merely prose: `ProseBehavioralRule.fires` is typed as the literal `null` while `GateFireStat.fires` is `number`, so a prose rule can never carry a numeric 0 — TypeScript-enforced, exactly the E26 "zero-fires ≠ dead" contract. `index.ts` untouched (A1 registry pattern honored).

## Security
No findings. Read-only; no new trust boundary. Paths are `path.join(workspace_path, ".current", …)` off the validated `WorkspaceOnly` input; no injection surface, no secrets, no writes. All parse/IO failures are contained by try/catch and degrade to empty data.

## Performance
No findings. Single linear pass per sidecar with Map-based accumulation; sorts operate on ≤32-element (`fired`) and small (`unregistered`) arrays. No hot-path regression versus the `jq`/`summarize-metrics.mjs` baseline it replaces; O(n) in sidecar line count.

## Verdict
APPROVED — implementation matches the E26 spec (never-throws read-only aggregation, full 32/32 registry coverage, structurally-enforced gate-backed vs prose-behavioral boundary, E12-keyed dedupe), with zero blocking findings across all categories. Routing to qa-engineer.
