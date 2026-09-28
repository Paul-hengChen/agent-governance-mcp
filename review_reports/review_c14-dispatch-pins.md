# Review — c14-dispatch-pins

covers: T-C14-01, T-C14-02, T-C14-03, T-C14-04, T-C14-05, T-C14-06, T-C14-07, T-C14-08

## Summary
- Promotes the C8-era `dispatch_pins: <role>=<model>` pending_notes convention to a first-class, schema-validated handoff field (handoff schema v7→v8): schema bump + stamp-only migration, zod closed-key/open-value boundary, defensive parser, REPLACE-wholesale/feature-scoped write semantics, one shared const-01 watermark rule, and three skill-coordinator passage rewrites.
- Surface: 6 source files (`schema/versions.ts`, `schema/migrations-handoff.ts`, `tools/handoff.ts`, `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/storage-sqlite.ts`), 2 content files, 1 doc, + committed `dist/`. Scope matches spec AC-1..AC-8 exactly — no scope creep.
- The implementation reuses the `external_refs` (v6) and `next_role` (v7) precedents faithfully; every Decision Record in the spec is honored, not re-derived.
- Verified functionally against compiled `dist/`: 6/6 write-semantics parity checks pass; migration v7→v8 stamp-only preserves the legacy note verbatim and does not extract it (AC-8); future-v9 read refuses loud; zod `.parse()` is wired ahead of the handler.
- Verdict: APPROVED.

## Correctness
No findings.
- **Read/write key symmetry (the one asymmetry risk).** `parseDispatchPins` (tools/handoff.ts:238) filters keys against `NEXT_ROLE_VALUES` (handoff.ts:208), which is exactly the 8 `AgentName` values — including `design-auditor` and `release-engineer` — matching the zod key set (registry.ts:126-133) and the `AgentName` type (transitions.ts:8). No role that zod accepts on write can be silently dropped on read. Confirmed.
- **Write semantics (AC-3/AC-4), verified against dist:** (1) explicit map REPLACES wholesale incl. `{}` which clears; (2) omit + same `active_feature` carries forward unchanged; (3) omit + changed `active_feature` drops to `undefined`; (4) survives a PM `In_Progress` re-entry (NOT re-armed, unlike `cut_approved`). This is the exact `external_refs` algorithm (handoff.ts:699-740). All four polarities exercised and passing.
- **Non-empty-only emit (AC-4):** `Object.keys(...).length > 0` guard (handoff.ts:766); empty map is not serialized, so `{}` and absence are behaviorally identical. Confirmed by the "empty clears → undefined on re-read" check.
- **Migration (AC-1/AC-8):** v7→v8 is pure `{...input, schema_version: 8}` (migrations-handoff.ts) — structurally cannot seed or drop fields. On a real serialized v7 file carrying a legacy `dispatch_pins: sr-engineer=fable` note, the note round-trips byte-verbatim and the new field stays `undefined`. Future-v9 read throws (refuse-loud). Confirmed.
- **Defensive parser:** non-object/array → `undefined`; unknown key / non-string / empty / >100-char values dropped; all-malformed collapses to `undefined` so absence stays the single "no pins" sentinel. `DISPATCH_PIN_VALUE_MAX=100` mirrors the zod bound (intentional parse-time defense for hand-edited files; same posture as `parseExternalRefs`).

## Quality
No findings. Naming, comment density, and structure match the surrounding v5/v6/v7 field-plumbing precedent verbatim. The frontmatter type union was correctly widened to admit the nested map. `dist/` was rebuilt (`npm run build` exits 0; a fresh build produces no net-new diff; `dist/schema/versions.js` shows `handoff: 8`, `dist/tools/registry.js` carries the strict schema) — dist is fresh vs src.

## Architecture
Matches spec (no separate `-architecture.md`; the spec's Decision Records are the design bar).
- **AC-5 / DR-5:** `SqliteHandoffStorage.writeState` does not destructure `dispatchPins` — documented, no DDL, sqlite `schema_version` unchanged. `handoff-orchestrator.ts` threads the value through to `storage.writeState` with no new gate, no `GateErrorCode`. Advisory-only, like `next_role`. Correct.
- **AC-2:** closed 8-key `.strict()` zod object, values `z.string().min(1).max(100)` (open vocabulary, not enum). Wired via `spec.zodSchema.parse(rawArgs)` (registry.ts:73) before the handler — unknown key / empty / oversize / array-shape all rejected at the boundary.

## Security
No findings. The only new trust boundary is the `dispatch_pins` write arg, bounded by zod (closed keys, ≤100-char values) at the tool edge and re-filtered by the defensive parser on read. No injection surface (values are inert model-tier strings, never executed); no secrets; js-yaml dump of a plain string→string map is lossless with existing options.

## Performance
No findings. Parser is a single O(k≤8) pass over map entries; the write path adds at most one `parseHandoff` existing-state read that is already gated/shared with the `external_refs`/`cut_approved` preserve logic (no additional disk read). No hot-path or complexity-class regression.

## Verdict
APPROVED — implementation satisfies AC-1..AC-8 with zero findings; write-semantics parity with `external_refs`, the zod boundary, the stamp-only migration (incl. AC-8 legacy-note inertness), and content edits (AC-6 three passages, AC-7 single shared const-01 line) all verified. The 37-entry expected-red manifest is plausibly schema-bump/golden-fixture caused (compose goldens grew, version-literal asserts, future-version fixtures using 8); QA owns re-baselining.
