# Review — T-E10-07

covers: T-E10-07

## Summary
- Feature `e10-lease-override`: two additive, file-mode-only, transient lease mechanisms — `lease_override` (human-attested FEATURE_LEASE_HELD bypass, any edge) and `bookkeeping_write` (same-feature `last_updated` preservation), plus the migration heal-write hard-wired to the bookkeeping behavior.
- Diff scope matches the claimed manifest and architecture blueprint exactly: `gates/lease-override.ts` (new, 60 lines), `gates/registry.ts` (+2 codes/entries, 28→30), `tools/registry.ts` (zod + JSON schema, both fields), `tools/handoff-orchestrator.ts` (bypass/audit + AC6 gate + threading), `tools/handoff.ts` (preserve branch + heal opt-in), `content/const-08-chain-31-mid.md` (two §3.1 bullets), `qa_reports/expected-red_*.txt`, dist rebuilt.
- Architecture bindings all honored: NO schema bump (versions.ts/schema/ untouched, handoff stays v12, nothing new emitted to frontmatter); zod in `tools/registry.ts` not index.ts; heal-write wired to the preserve branch.
- AC1–AC9 all traceable to concrete hunks; Out-of-Scope respected (E13 disjunct untouched, no SQLite behavior change, no new status enum).
- Verdict: APPROVED.

## Correctness
No blocking findings.

- AC1 (audited bypass): `tools/handoff-orchestrator.ts:208` — `leaseFileMode && overrideClass === "audited"` falls through, suppressing FEATURE_LEASE_HELD for this write only. Correct.
- AC2 (unaudited reject): `:211` returns `LEASE_OVERRIDE_AUDIT_MISSING` — never silently downgraded to the plain lease envelope. Classifier `gates/lease-override.ts:53` returns `unaudited` when `lease_override===true` and `pending_notes[0]` absent/mismatched (`?? ""` guards empty/undefined). Correct.
- AC3 (transient): classifier reads incoming args only; neither field is ever assigned into `frontmatterData` (grep-verified — the only `frontmatterData.last_updated` write is line 1006). No persistence, no carry-forward. Correct.
- AC4 (heal preserve): `tools/handoff.ts:548` sets `bookkeepingWrite: true` on the fire-and-forget heal-write; heal is same-feature by construction, so the same-feature guard always preserves the pre-heal `last_updated`. Correct.
- AC5 (bookkeeping preserve): `tools/handoff.ts:997-1006` — default `effectiveLastUpdated = now`; preserved only when `bookkeepingWrite===true && existing.active_feature === _activeFeature && existing.last_updated`. A sibling write without the flag stamps fresh `now()` (default path intact). Correct.
- AC6 (different-feature reject): `tools/handoff-orchestrator.ts:277-282` — `FileHandoffStorage && bookkeeping_write===true && prevState && feature_changed` → `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`. Fresh-workspace edge (`prevState` null) is inert, not a crash — verified. Correct.
- AC9 (SQLite scoping): lease-override branches gated on `storage instanceof FileHandoffStorage`; in SQLite mode both `leaseFileMode && ...` are false, so control reaches the unchanged FEATURE_LEASE_HELD `else`. `bookkeepingWrite` is passed to `storage.writeState` but `SqliteHandoffStorage.writeState` never reads it. SQLite lease/timestamp behavior byte-for-byte unchanged. Correct.
- Bypass leakage: `lease_override` suppresses ONLY the FEATURE_LEASE_HELD reject. `validateTransition` (hop-cap, round caps) runs at line 131 BEFORE the lease block, so it cannot be bypassed. Scope/cut/external-refs gates run AFTER the lease block; an audited override still falls into them. No other gate is skipped. Correct.
- Heal cannot suppress genuine work writes: `bookkeepingWrite` is undefined on the positional overload and unset on normal role writes; only the heal call site and an explicit `bookkeeping_write:true` opt in. Correct.

## Quality
No findings. New code mirrors the established `gates/cut-approval.ts` runtime-leaf convention; comments cite spec AC / DR ids; naming consistent with surrounding fields. The FROZEN check-order header comment (`:10-11`) was correctly updated to insert the two E10 stages. `existing` hoist (`tools/handoff.ts:947`) leaves all pre-existing preserve clauses semantically unchanged.

## Architecture
Conforms to `specs/e10-lease-override-architecture.md` in full. DR-1 (no schema bump) verified: `index.ts`, `schema/`, `HandoffState`, `parseHandoff` body all untouched (git-verified); frontmatter shape byte-identical pre/post. DR-3 (audit gate inside lease-held branch), DR-4 (AC6 inline reusing `feature_changed`, `prevState`-guarded), DR-5 (writer preserve branch also same-feature-guarded for the direct heal caller), DR-6 (`dispatched_at` keeps its own `now()`), DR-7 (AC9 `instanceof` scoping) all implemented as specified.

## Security
No findings. Both fields are attested-trust booleans (the §3.1 `cut_approved` mechanics — attested, server-verified for shape not truthfulness). The AC6 same-feature restriction closes the pre-aged-clobber footgun at BOTH the orchestrator gate and the writer (defense-in-depth). No injection surface, no secrets, no unvalidated boundary — `pending_notes[0]` is matched against a fixed anchored RE.

## Performance
No findings. Both additions are O(1) structural checks on already-read state; the `existing` read is gated by `bookkeepingWrite === true` joining an existing trigger condition, adding no new I/O on the common path.

## Constitution / trust-boundary text
const-08 bullets consistent with §3.1 `cut_approved` attested-trust mechanics (coordinator-attested, never inferred from a summary; server-verified for shape only). No restated numeric limits (no TTL value, no LEASE_TTL_MIN). Cross-references `gates/feature-lease.ts` E1/E1A/E13 lineage rather than restating the predicate, per AC8.

## Expected-red catalogue (SOP 4a)
`qa_reports/expected-red_e10-lease-override.txt` present, C15 `file | test name` format, 14 entries. Full-suite run confirms exactly 1363 pass / 14 fail; every failing test (compose 93-96/98/99, budget 155/156/168, contract 315/316/318/334/335) maps 1:1 to a catalogued entry. Zero unexplained reds. No test file modified by the diff (git-verified). Catalogue is complete and honest; all 14 are legitimate qa-owned re-baselines (gate-count 28→30, compose goldens from the two new bullets, context-budget floor bumps).

## Verdict
APPROVED — AC1–AC9 fully traceable, architecture bindings honored, no schema bump, no `any`, no test-file edits, and the 14-failure catalogue is complete and honest.
