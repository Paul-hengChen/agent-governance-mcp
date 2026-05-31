# Code Review — T351 (design-auditor-volume-guard: frame-scoped link guidance)

## Round 1 — APPROVED — by code-reviewer

## Summary

- `content/skill-coordinator.md` Feature-Split Plan schema "How to proceed" line gains: *"use a **frame-scoped** Figma link per row, not the whole-file link"*.
- One-clause addition to the always-on coordinator skill. Maps to spec AC3. Verdict: **APPROVED**.
- Same-model-bias caveat noted.

## Correctness

- AC3 satisfied: the schema now instructs the human to paste frame-scoped (deep) links, which is the upstream half of the Volume Gate / node-scoped-fetch defense (bounds each feature's fetch at the source).

## Quality

- Minimal, in-place edit; consistent voice. No new lines added to the always-on bundle (clause appended to an existing line) — gate section stays ~348 tok, well under the 425-tok footprint test from feature-scope-gate.

## Architecture

- Prompt-layer; no `tools/` change. Correctly pairs the human-input guidance (coordinator) with the auditor-side enforcement (T350).

## Security

- Content only; no surface.

## Performance

- Reduces fetch volume at the source (frame-scoped links). No regression.

## Verdict

**APPROVED** — minimal, correctly-placed guidance complementing T350's auditor-side guard.
