# Review — T-E1A-02 (batched review of T-E1A-01)

covers: T-E1A-02

Base: working-tree diff (uncommitted) on `main` @ d74e255.
Contract: `specs/e1-feature-scoped-state-design.md` → `## Amendment (2026-07-12)`, AC-E1A-1..7.

## Summary
- Reviewed the actual `git diff` (not the sr-engineer claim). In-scope source changes: `gates/feature-lease.ts` (terminal-marker clause + optional `last_agent?`/`next_role?` fields + negative-age guard), `content/skill-release-engineer.md` (SOP step 12 + C13 Hard-rule prose), `tools/handoff-orchestrator.ts` (comment-only), plus rebuilt `dist/`.
- No test files touched — correct: tests are T-E1A-03 (qa-engineer) per the ticket cut; sr-engineer authoring them would violate §2.
- `dist/` is byte-identical to a fresh `npm run build` — rebuild faithful, no source/dist drift.
- Zero schema_version bump, zero `package.json`/`index.ts` version drift, zero new config keys.
- Verdict: APPROVED.

## Correctness
No findings.

- **Terminal-marker scoping (AC-E1A-1..3), `gates/feature-lease.ts:70-74`.** Clause fires only on `last_agent === "release-engineer" && status === "In_Progress" && next_role === "pm"`. Adversarial cases traced:
  - OPENING write (no `next_role`): `undefined !== "pm"` → clause skipped → falls through to age check → lease HELD. D9/D10 in-flight-release race preserved (AC-E1A-2). ✓
  - pm-authored write with `next_role="pm"`: `last_agent !== "release-engineer"` → skipped → held. Other-role pm-handbacks (e.g. code-reviewer CHANGES_REQUESTED) excluded. ✓
  - Blocked with release-engineer agent: `status !== "In_Progress"` → skipped → held (Blocked-counts-as-held preserved, AC-E1A-3). ✓
  - Escalation `next_role="qa-engineer"`: `!== "pm"` → skipped → held. ✓
  - Placement is after the `status === "PASS"` terminal check and after the same-feature / fresh-workspace short-circuits, matching the spec's "evaluated after the existing PASS check." ✓
- **`prevState` actually carries the fields.** Verified `next_role` is persisted in file mode (`tools/handoff.ts:859`) and parsed back (`:345`, `:386`); `last_agent` is likewise persisted/parsed (already consumed at `handoff-orchestrator.ts:110`). `next_role` is transient (dropped on writes that omit it), so the only state ever carrying the full terminal triple is exactly the closing write — no false-positive terminal match on a later state. ✓
- **Negative-age guard (AC-E1A-4/5), `gates/feature-lease.ts:79`.** `return ageMs >= 0 && ageMs < ttlMin * 60_000`:
  - NaN (unparseable `last_updated`): `NaN >= 0` is `false` → not held. Identical posture to pre-amendment (`NaN < ttl` was also false) — regression-safe. ✓
  - `ageMs === 0` (boundary): `0 >= 0 && 0 < ttl` → held/fresh. Boundary preserved. ✓
  - Future-dated stamp (`ageMs < 0`): fails first conjunct → not held. ✓

## Quality
No findings. Comment block accurately documents the semantics change, the file-mode-only asymmetry, and the fail-open rationale; naming/structure match the surrounding gate code. The `handoff-orchestrator.ts:154-162` comment was correctly updated from the now-stale "reads only the three universal fields" claim to describe the optional `last_agent`/`next_role` reads.

## Architecture
No findings. Change is additive and confined to the pure, fs-free predicate + its call-site comment + SOP prose — matches the spec's Decision Records (additive clause after `status===PASS`, reuse of the already-stamped `next_role`, no transition-table change). File-mode-only asymmetry is explicitly ratified in the spec and consistent with the existing `cut_approved`/`external_refs`/`dispatch_pins` precedent.

## Security
No findings. No new trust boundary, input parsing, or secret. Fail-open on negative/NaN age is a governance-advisory posture (mirrors `guards/file-lock.ts` stale-self-heal), not a security control.

## Performance
No findings. Adds a constant-time short-circuit conjunction ahead of the existing single `Date.parse`; no new I/O, no loop, no allocation. No regression vs base.

## SQLite no-op safety (AC-E1A-6)
Confirmed. `FeatureLeaseFields.last_agent`/`next_role` are optional (`gates/feature-lease.ts:64-65`); `SqliteHandoffStorage` never persists `next_role`, so `prevState.next_role` is `undefined` there → `undefined === "pm"` is `false` → terminal clause can never fire in SQLite mode. The SQLite row shape stays assignable to the widened interface with zero behavior change — still TTL-bounded post-release.

## Verdict
APPROVED — implementation matches AC-E1A-1..7 exactly, with zero findings in any category. dist byte-identical to source rebuild, no schema/version/config drift, no test files touched (§2 clean); tests correctly deferred to T-E1A-03.
