# Review — T-SCOPE-IMPL / T-SCOPE-SCHEMA / T-SCOPE-DOCS (server-scope-decision-gate)

## Round 1 — APPROVED — by code-reviewer

## Summary

- New `SCOPE_DECISION_REQUIRED` transition reject added handler-side in `index.ts` at the build-entry edge (`pm:In_Progress → {architect,sr-engineer}:In_Progress`), gated on design-armed + no recorded scope decision.
- Handoff schema v3→v4 additive no-op migration; new optional `scope_decision` / `scope_decision_why` fields round-trip through both YAML (`tools/handoff.ts`) and SQLite (`tools/storage-sqlite.ts`).
- `hasScopeDecision` helper added to `tools/evidence-file.ts` (existence-or-equality, never throws). `transitions.ts` stays pure (union extension + comment only).
- Docs: constitution §3 gate bullet, skill-pm step 2b. Build clean, zero TS errors, version check OK.
- Verified against `specs/server-scope-decision-gate.md` (AC-1..AC-10) and `specs/qa-flow-enforcement-architecture.md → ## Scope Decision Gate` (5 edge cases). All hold.

## Correctness

- **Gate edge fires exactly right** (`index.ts:741-746`): all four conditions ANDed — `next.agent ∈ {architect,sr-engineer}`, `next.status=In_Progress`, `prev.agent=pm`, `prev.status=In_Progress`. Matches arch Decision 1 conditions 1-4. Confirmed by runtime smoke: armed (figma) + no attestation + no split-file ⇒ fires; clears with attestation; clears with `.current/feature-split.md`. (AC-1, AC-2, AC-3 ✓)
- **Re-entry/resume safe** (`index.ts:744-745`): `architect→sr-engineer` and `sr-engineer→sr-engineer` self-loop have a non-`pm` predecessor ⇒ condition 2 false ⇒ gate structurally skipped. Additionally the persisted `scope_decision` survives downstream omitting writes (verified — see below), so a FAIL→pm→build re-route reads the prior attestation off `prevState` and does not re-block. Edge Case row 1 honored. ✓
- **Non-design pass-through silent** (`index.ts:747-748`): `hasDesignModeRequiringVisual().required` short-circuits before `hasScopeDecision` is consulted; no design file or `mode=no-design` ⇒ `required:false` ⇒ no emit. (AC-5 ✓)
- **Non-build target silent**: condition 1 false skips the whole block regardless of design presence. (AC-6 ✓)
- **Placement correct** (`index.ts:730-777`): after the `validateTransition` reject early-return (`:724-729`), before the evidence/PASS blocks (`:779+`). The two regions are runtime-mutually-exclusive (In_Progress build write vs PASS write); ordering is moot but reads cleanly. ✓
- **Schema migration no-seed** (`schema/migrations-handoff.ts:152-157`): `up: (input) => ({ ...input, schema_version: 4 })` adds NO default. Verified runtime: a raw v3 file reads back `scope_decision=undefined` (no synthetic attestation), `prd_path`/`active_feature`/`last_agent` all preserved, file content intact. (AC-7 ✓)
- **v5 refuse-loud**: `runMigrations` throws on on-disk version > server max (verified: throws "on-disk version 5 > server max 4"). No new code needed. (AC-10(g) ✓)
- **`hasScopeDecision` never throws** (`tools/evidence-file.ts:428-435`): null/undefined handoffState handled via optional chaining; verified `hasScopeDecision(ws, null)` and `(ws, undefined)` both return `false`. Wrong value `multi-feature` correctly rejected (only `single-feature` clears). ✓
- **prd_path NOT silently lost** — the scrutinized claim holds. Both `tools/handoff.ts:519-533` and `tools/storage-sqlite.ts:663-677` merge a SINGLE existing-read servicing prd_path + scope_decision + scope_decision_why; each field individually falls back to the on-disk value only when the incoming value is undefined/null. Verified runtime: a downstream `sr-engineer` write that omits all three preserves `scope_decision`, `scope_decision_why`, AND `prd_path`. No field-drop path found. ✓
- **Attestation not silently lost**: write guards (`tools/handoff.ts:537-538`, sqlite parse `:631-632`) emit only when truthy — empty string is correctly treated as "not set", consistent with the "absence is meaningful" invariant. No path seeds a false attestation.

## Quality

- Naming consistent with surrounding code (`effectiveScopeDecision` mirrors `effectivePrdPath`; `scope_decision`/`scope_decision_why` mirror `prd_path` snake_case in YAML, camelCase in options). No dead code, no duplication beyond the deliberate file/SQLite parity.
- Comments are accurate and match the implementation (no stale claims). The preserve-block comment correctly states "A single existing read services all three."
- **Minor (non-blocking)**: spec §Implementation location (`server-scope-decision-gate.md:121`) lists `hasScopeDecision(workspacePath, activeFeature, handoffState)` (3-arg), but the architecture blueprint Decision 2 corrected this to 2-arg `(workspacePath, handoffState)` since the helper never reads the design file. Impl correctly follows the architecture spec (binding design constraint). Reconciled inconsistency, not a defect.

## Architecture

- `tools/transitions.ts` stays **pure** — confirmed no `fs`/`node:fs` import; only the `TransitionRejection["error"]` union gained `SCOPE_DECISION_REQUIRED` with a handler-side-only comment (`:697-703`), exactly mirroring the `VISUAL_*` precedent. (AC-8 ✓)
- Guard is handler-side in `index.ts`, reusing the existing `hasDesignModeRequiringVisual` arm helper — no new scanner, identical arm signal to the visual gate, structurally independent (different edge, different artifacts). Matches arch Decision 1 + Edge Case row 5.
- Storage parity: SQLite `HandoffRow`, `CREATE TABLE`, idempotent `addColumnIfMissing` ALTERs, upsert statement arity (+2 params), `txUpsert` signature, `parse()`, and `writeState` preserve-merge all threaded. Generic-param tuples on `upsertStmt`/`txUpsert` updated to match. ✓

## Security

- `scope_decision` constrained by zod `z.enum(["single-feature"])` (`index.ts:52`) — no injection surface; only one accepted value. `scope_decision_why` capped at 2000 chars (`:53`). Both written via js-yaml dump / parameterized SQLite bind — no string interpolation into SQL or YAML. Hint text is a static constant. No secrets, no unvalidated boundary.

## Performance

- No new I/O in hot paths. The gate adds one `hasDesignModeRequiringVisual` design-file read + one `fs.existsSync` only on the narrow build-entry edge (after all four cheap tuple checks short-circuit). Preserve-merge reuses the single existing read already performed for prd_path — no extra query added. No loops, no algorithmic regression vs base.

## Verdict

**APPROVED** — gate fires on exactly the right edge and over-fires nowhere; all 5 edge cases (re-entry, non-design, non-build, lite-mode, visual-gate independence) hold; v3→v4 migration is a true no-seed no-op with v5 refuse-loud; scope_decision and prd_path both round-trip and are preserved across omitting writes in YAML and SQLite; transitions.ts stays pure; no `any`; envelope matches the VISUAL_* precedent with verbatim hint text.

*Same-model-bias note: this review ran on opus; if sr-engineer also ran on opus, flag for a cross-model spot-check of the migration path. No correctness concern found regardless.*
