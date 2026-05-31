# Code Review — T360 (feature-split-lifecycle)

## Round 1 — APPROVED — by code-reviewer

## Summary

- `content/skill-coordinator.md` Feature-Scope Gate now branches **no-plan** (assess → generate, every row `status: pending`) vs **existing-plan (resume)** (reconcile done → next pending / named row → hydrate; never re-run `done`).
- Split Table gains a `status` column (pre-filled `pending`); "How to proceed" documents `done`-on-PASS + `do F<n>` by-id resume.
- Single file; maps to spec AC1–AC7. Section ~496 tok (within the AC6 ~550 budget). Verdict: **APPROVED** with non-blocking notes.
- Same-model-bias caveat: reviewer ran on the same model as the writer.

## Correctness

- AC1–AC5 all present and unambiguous; the no-plan / existing-plan split cleanly covers both entry paths, and AC7 (no plan + single-feature → continue) falls out of the no-plan branch.
- AC4 "never re-run a `done` row" explicit. AC2 reconcile (match row `feature id` ↔ handoff `active_feature` with status PASS → flip `done`) is sound for the **one-unit-per-invocation** flow: each resume reconciles the most-recent PASS, and since the stated flow runs one `/teamwork` per unit, every inter-unit transition passes through a reconcile. Correct under that assumption (which the spec states).
- **Minor (non-blocking, for qa/future)**: reconcile matching depends on the running unit's `active_feature` being **named identically to the split-row `feature id`**. The hydrate step feeds the row in, but the skill doesn't explicitly say "use the row's `feature id` as `active_feature`". If PM renames it, reconcile silently misses. Suggest a half-sentence making that binding explicit; not blocking.

## Quality

- Terse, consistent with surrounding sections; `status` placed as the last column (minimal table disruption); "do F<n>" matches the by-id resume wording. No dead text.

## Architecture

- Prompt-layer + human-checkpoint; diff touches only `skill-coordinator.md` (no `tools/transitions.ts`), matching spec Out of Scope. Coordinator editing the `.md` (not a `tw_*` write) is consistent with AC2's stated mechanism. `.current/feature-split.md` correctly remains the cross-feature source of truth; handoff stays the current-feature source.

## Security

- Governance content only; no secrets / executable surface / injection vector.

## Performance

- Reconcile = one split.md text scan + one handoff read per resume; no loop or fetch. No regression. Always-on footprint +~148 tok (496 vs prior 348), within the AC6 ~550 ceiling.

## Verdict

**APPROVED** — lifecycle (status column + done-marking + resume/skip-done + by-id) is correct and spec-conformant. Two stale footprint-cap assertions (≤425 in `feature-scope-gate` + `design-auditor-volume-guard` tests) must be raised to ~550 per AC6 — that is qa's T361 (test ownership), not a code defect.
