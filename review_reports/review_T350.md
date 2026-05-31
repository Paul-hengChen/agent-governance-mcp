# Code Review — T350 (design-auditor-volume-guard: Volume Gate + node-scoped fetch)

## Round 1 — APPROVED — by code-reviewer

## Summary

- `content/skill-design-auditor.md`: adds step **2a Volume Gate (pre-fetch)** between mode-detection (2) and Extract (3), plus a **Node-scoped fetch** rule inside step 3.
- Volume Gate STOPs (`status=Blocked` → `next_role: pm`) when a single feature's design source exceeds ~one feature's worth, instead of ingest-then-defer; fetch-based modes only.
- Maps to spec AC1/AC2/AC4/AC5. Verdict: **APPROVED** (minor non-blocking notes below).
- Same-model-bias caveat: reviewer ran on the same model as the writer.

## Correctness

- AC1: gate is correctly positioned BEFORE extraction and explicitly scoped to `figma/sketch/xd/penpot`; `image/pdf/paper/no-design` skip it — consistent with step 2's "no-design → jump to step 5" path (2a is bypassed, which is correct since no-design does no bulk fetch).
- AC4 fail-loud: the Blocked `pending_notes` carries the `<N> frames > threshold` count + split recommendation — surfaces, never silently truncates.
- The estimate is specified as "cheap metadata (frame list / node count) — NOT a full-document fetch", which correctly avoids the very blowup the gate exists to prevent (a naïve "fetch then measure" would defeat the purpose). Good.
- No reference breakage: inserted as `2a.` sub-step, so step 2's "jump to step 5" and the integer step numbers are untouched.
- Threshold is intentionally **qualitative** (LLM judgment: "more than 5 passes × 250 lines could audit, or would dominate the context budget"). Appropriate for a prompt-layer gate and matches the spec, which also declined a hard number. Note for qa: assert the gate's *presence + STOP behavior wording*, not a numeric threshold.

## Quality

- Wording is consistent with the surrounding SOP voice; the "input-side mirror of the 250-line/5-pass output cap" framing ties it cleanly to the existing cap.
- Minor (non-blocking): the `2a.` sub-step is the only non-integer step in the SOP. It's a deliberate no-renumber choice (preferable to shifting every downstream reference); acceptable.

## Architecture

- Prompt-layer only; diff touches no `tools/`. Matches spec Out of Scope (no server enforcement). Correct layering — an input-side gate placed in front of the existing output cap + Source-manifest deferral, not replacing them.

## Security

- Governance content only; no secrets, no executable surface. The gate *reduces* worst-case external-fetch volume.

## Performance

- Directly improves the failure mode it targets: cheap-metadata pre-check + node-scoped fetch bound the `get_figma_data` payload that previously could enter context wholesale. No regression.

## Verdict

**APPROVED** — Volume Gate + node-scoped fetch are correctly placed, fail-loud, and fetch-mode-scoped; the qualitative threshold and `2a` numbering are intentional and non-blocking.
