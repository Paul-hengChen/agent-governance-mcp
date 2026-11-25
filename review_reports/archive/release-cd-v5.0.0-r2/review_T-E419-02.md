# Review — T-E419-02

Feature: e419-retire-bookkeeping-stamp. Diff judged: `c29f100..HEAD` (commit ceb3135 for this task). Spec: `specs/e419-retire-bookkeeping-stamp.md` (no architecture spec; D5).

## Round 1 — APPROVED — by code-reviewer

## Summary
- Retires Bookkeeping-Write: zod field + comment and `inputSchema` property removed from `tools/registry.ts`; orchestrator step and the `bookkeepingWrite: parsed.bookkeeping_write` pass-through removed; union member, doc-map row and `GateDefinition` entry removed from `gates/registry.ts`.
- Writer option renamed `bookkeepingWrite` -> `preserveLastUpdated` (`tools/handoff-write.ts`), with the heal in `tools/handoff-parse.ts:700` as its only caller (D3); the same-feature guard is unchanged.
- Section-header code ranges corrected (`7-12`, `13-33`, `34`) and the catalog comment rewritten for 34 entries.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `'bookkeeping_write' in inputSchema.properties` prints `false` (from `dist/`); `grep -c bookkeeping_write tools/registry.ts` = 0.
AC2 — implemented — `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` absent from `GateErrorCode`, `GATE_REGISTRY` and `UPDATE_STATE_GATE_PIPELINE` (checked live from `dist/`; qa's new test pins it).
AC3 — implemented — top-level `UpdateStateArgs` is a non-`.strict()` `z.object` (only the nested objects at `tools/registry.ts:331,416` are strict), so the key is dropped. Reviewer probe: same-feature write with `bookkeeping_write: true` over a forced old stamp is accepted and `last_updated` is a fresh stamp; the same call with a different `active_feature` returns `FEATURE_LEASE_HELD` with no BOOKKEEPING text.
AC4 — implemented — `tools/handoff-parse.ts:700` `preserveLastUpdated: true`; guard at `tools/handoff-write.ts:473-477` still requires `existing.active_feature === _activeFeature`. Reviewer probe: a v0 handoff with `last_updated: "2026-05-01T00:00:00.000Z"` healed to schema_version 15 with that stamp kept exactly. In the full run, `AC4 (e10)` fails only at its stamp-provenance block (the `STAMP_PROVENANCE_SUSPECT` expectation, `test/feature-lease.test.mjs:1181`), after its first assertion passed.
AC10 — implemented — `GATE_REGISTRY.length === 34`, `UPDATE_STATE_GATE_PIPELINE.length === 17`, order = base minus steps 2 and 4.
AC15 — implemented — `git diff c29f100 -- schema/` empty; `tools/handoff-types.ts` untouched; the option was never persisted (it selects the timestamp only).

## Correctness
No findings.
- No other caller can set `preserveLastUpdated`: `git grep` finds it only in `tools/handoff-write.ts` (definition/uses) and `tools/handoff-parse.ts:700`. The orchestrator builds the writer options as an explicit field list (no spread of `parsed`, `tools/handoff-orchestrator.ts:1395-1460`), and zod strips unknown keys, so a client cannot inject it.
- Section headers re-derived by counting entries: transition-json 1-6, orchestrator-json 7-12 (six entries, SCOPE_DECISION_REQUIRED .. LEASE_OVERRIDE_AUDIT_MISSING), plain-text 13-33 (21 entries), tool-boundary 34. Correct.
- The doc-map comment lists exactly the 34 registered codes (the `error-code-contract` doc-map test fails only on its hard-coded `expected: 36`, `actual: 34`).

## Quality
No required findings.
- optional: `agc check — comments` warns `tools/handoff-parse.ts` (37.3%) and `tools/handoff-write.ts` (42.5%) are over the 30% comment ratio. Kept: both ratios are file-level and pre-existing; this diff is a rename with net +1 comment line in `handoff-write.ts` and 0 in `handoff-parse.ts`.
- The catalog comment rewrite (`gates/registry.ts:112-116`) drops the per-ticket history narration (E40/E300/E139/E247) and keeps the WHAT/WHY (doc order only, not evaluation order). That matches Constitution §6 comment discipline; the history stays in CHANGELOG/specs.
- New option comment (`tools/handoff-write.ts:160-165`) states what it does and who sets it ("Server-internal: only the migration heal-write sets it"). Good.

## Architecture
No architecture spec (D5). The rename keeps the writer's public options type internal (`WriteHandoffStateOptions` has no external surface); the heal path keeps its hard-wired don't-restamp behaviour as ruled.

## Security
No findings. Removing an attested client field shrinks the input surface; the internal preserve option is unreachable from the tool boundary (see Correctness).

## Performance
No findings. One branch removed per write; the `existing` read is still forced by `archiveCheckNeedsExisting`, unchanged.

## Verdict
APPROVED — the client field, step and code are gone, stale callers degrade to an ordinary lease-refreshing write, and the heal's preserve behaviour is intact under the new name with the heal as its only caller.
