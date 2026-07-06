# Review — T-QVC-01 — `content/skill-qa-visual.md` consolidation rewrite

> Reviewer: @code-reviewer (opus) · 2026-07-06 · clean-context (diff + `specs/qa-visual-consolidation.md` + parser source only)

## Round 1 — APPROVED — by code-reviewer

## Summary

- **What changed:** `content/skill-qa-visual.md` rewritten 265 → 124 lines (`git diff` = 106 insertions / 247 deletions). Behavior-preserving consolidation: scattered exemption prose folded into ONE provenance matrix (AC-4), the "Failure modes" + "Report schema" narratives folded into ONE error-code trigger table (AC-5), steps renumbered A.0/A/A.5/B0-B2/C (AC-6), one minimal passing example added (AC-7).
- **Scope discipline:** working tree touches only 4 files — the reviewed `content/skill-qa-visual.md` plus three known chain artifacts (`.current/handoff.md`, `docs/backlog.md`, `tasks.md`). **Zero changes under `tools/`, `index.ts`, `schema/`, `guards/`** — AC-1's content-only constraint holds.
- **Headline verdict: APPROVED.** All 21 verbatim tokens (S01–S21) survive character-for-character against the *parser source* (not just the spec); all 7 required error codes + the newly-documented `VISUAL_REPORT_INCOMPLETE` are present; the AC-7 example passes all three compiled parsers; build clean; 811/811 tests green.
- **Independence note:** reviewed on opus (recommended tier); sr-engineer tier unknown to me by design — no same-model-bias flag raised, verification was performed against source-of-truth code rather than the writer's reasoning.

## Correctness

Verified independently (not trusting the spec's own manifest — checked against `tools/evidence-file.ts` / `tools/transitions.ts` directly).

- **Verbatim-token survival (S01–S21): PASS.** Ran a scratch script importing `dist/tools/evidence-file.js` asserting exact-byte membership:
  - S15 `pass (carried forward — git diff confirms source untouched)` — present, em-dash U+2014 intact (`tools/evidence-file.ts:602` `CARRY_FORWARD_TOKEN`). New file lines 30, 48.
  - S16 `B1 tool unavailable — LLM fallback` — present, em-dash intact (`:603` `B1_UNAVAILABLE_TOKEN`). New file lines 36, 50, 54, 55.
  - S02–S07 H2 headings (`## Widget Shape Verification` … `## Verdict`) — all six present, exact casing (`REQUIRED_VISUAL_SECTIONS` `:377-384`).
  - S08 checkbox shape `- [x] <id> — <description>`, mark `x`/`X`, split at first ` — `/` - ` (`:302-313`) — new file line 16.
  - S09 `assertion id` header + last cell `pass` (`:418-432`) — new file line 59.
  - S10 `### <surface id>` H3–H6, one heading/surface (`:671`) — new file line 40.
  - S11 `| surface | result |`, result cell `pass`/`accepted` (`:441-455`) — new file line 40.
  - S12/S13/S14 label lines `baseline:` / `diff-metric:` / `pixel_gate_complete: true` (`:632-636`, `:652-658`) — new file lines 44, 53, 54, 55.
  - S17 REJECTED placeholder lists — fingerprint set (`:606`) and diff-metric set (`:616-627`) reproduced exactly at new file lines 53–54, including `dimensionsMatch=false` (human form) and the "count as absent" framing; shown as REJECTED, never as valid examples.
  - S18 verdict rule (`verdictIsPass` `:464-483`) — new file line 71 reproduces the first-token-`PASS` rule + the negation-token list from spec S18 verbatim.
  - S19 `visual_fail:` prefix (`tools/transitions.ts:408` `.trim().startsWith("visual_fail:")`) — new file line 75.
  - S20 round cap 6 + `VISUAL_ROUND_EXCEEDED` + `(pm, In_Progress)` (`transitions.ts:226` `VISUAL_ROUND_CAP = 6`) — new file lines 75, 91.
  - S21 sole-mention codes (`VISUAL_PROVENANCE_MISSING`, `PIXEL_GATE_ATTESTATION_MISSING`, `VISUAL_ROUND_EXCEEDED`, `VISUAL_WIDGETS_UNVERIFIED`) — all four still backtick-mentioned (error table lines 80, 84, 88, 89, 91).
- **Behavior preservation vs old 265-line text: PASS.** Enumerated every normative statement in `git show HEAD:content/skill-qa-visual.md` and located each in the new file:
  - Step A.0 verbatim-copy rule + no-URL-re-derivation STOP → line 12; its full `tw_update_state` payload (`qa_review="Source manifest missing frozen baseline node-id list"`, `pending_notes=["QA: baseline node-id manifest absent — re-derivation forbidden", "next_role: design-auditor"]`) preserved in error table line 85.
  - `BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE` server backstops → error table lines 86–87.
  - Widget-shape checklist rules (skip N/A, `[x]`/`[ ]` semantics, shape FAIL precedes pixel diff) → lines 14–20.
  - Canonical-state verification + **multi-value guard** (incl. the exact FAIL note "context-dependent property requires per-context baseline — see §四#7 in `research/mode-feature-process-retrospective.md`") → line 24.
  - Step B whole-frame-banned + B0 carry-forward gate (round 0/1 no-op, round ≥2 re-diff `fail`/`accepted`/recaptured, `pass`+untouched carry-forward with cell-stays-`pass` + annotation, shared-file → full re-diff, every surface has a row every round) → lines 26–30.
  - Step B1 pre-screen (tool list, crop, threshold, at/below → pass without image read, above → B2, tool-unavailable → B2 + fallback token + still-requires `baseline:` + `pixel_gate_complete:`) → lines 32–36.
  - Step B2 LLM diff (Read both, 6-dimension diff, heading convention, table) → line 38.
  - Provenance matrix (AC-4, four surface classes × three fields) → lines 42–55.
  - Step C structural assertions, Allowed Differences qa-ownership (§3.2 void-if-not-qa-authored), per-widget isolation → lines 57–67.
  - All five FAIL routes (widget-shape-miss / pixel-drift / missing-baseline / dimension-mismatch / missing-impl) with exact `tw_rollback_task` + `tw_update_state` payloads and `visual_fail:` presence/absence → error table lines 80–84.
  - PASS sub-verdict (all-A `[x]`, all-A.5 `[x]`, all-C `pass`, all-B `pass`/`accepted`, six required H2 sections) → lines 69–71.
  - **Old "Rationale" section (lines 257–265) dropped** — verified non-normative: its two load-bearing facts (`review_<id>.md` does not satisfy the gate; `visual_fail:` triggers `visual_round`, cap 6 → `VISUAL_ROUND_EXCEEDED`) are preserved at new lines 6 and 75. No behavioral loss.
- **AC-7 example validity: PASS.** Extracted the fenced example, wrote it to a scratch `qa_reports/visual_T42.md`, and ran the three named parsers from `dist/tools/evidence-file.js`:
  - `validateVisualReport` → `{ok:true, missingSections:[], failedCanonicalStates:[], failedStructuralAssertions:[], failedRegionDiffs:[], verdictPass:true}`
  - `checkVisualProvenance` → `{ok:true, offendingByTaskId:{}}`
  - `checkPixelGateAttestation` → `{ok:true, offendingByTaskId:{}}`
- **Non-blocking observation (no change required):** new file line 71 enumerates `blocked`/`blocking` as forbidden verdict tokens, faithfully reproducing spec S18. The actual parser regex (`evidence-file.ts:477`) is `blocked?` which matches `block`/`blocked` but *not* `blocking`. The doc thus instructs agents to avoid a superset of what the server rejects — it errs safe (no false-PASS path), and the discrepancy originates in the spec's S18 wording, not in this rewrite. Flagging for the record only; correcting it is out of scope for a content-only, spec-faithful rewrite.

## Quality

- Consolidation is genuine, not cosmetic: the four scattered exemption paragraphs collapse into a single lookup table (matrix, lines 46–51) and the two overlapping failure narratives into one trigger table (lines 77–91), directly satisfying the user stories.
- No dead references: `research/figma-baselines.md`, `research/mode-feature-process-retrospective.md`, and the sibling specs are cited but not required to exist for the gate.
- `recommended_model: sonnet` frontmatter retained unchanged — correct, this is a lazy-loaded sub-skill.
- Prose around literals was freely rewritten (permitted by AC-3) while every server-parsed literal was left byte-exact — the discipline the ticket demanded.

## Architecture

- Fits the design constraint exactly: `specs/qa-visual-consolidation.md` §"Out of Scope" freezes the parser and gate wiring; the diff honors that (content-only, zero server-code change). No architecture spec (`specs/qa-visual-consolidation-architecture.md`) exists — expected for a doc rewrite.
- Layering intact: the skill file remains the *human/agent-facing* contract mirror of `evidence-file.ts`; the parser stays the source of truth. The rewrite reduces drift risk between the two (single matrix / single error table = one place to update), which is the stated maintainer goal.

## Security

- No executable surface. The illustrative CLI examples (`odiff`, `pixelmatch`, `magick`/`compare`) are non-binding prose (spec explicitly permits keeping/trimming). No injection vector, no secret, no new boundary. `git diff` scoping guidance in Step B0 is advisory, not a shell command the file runs.

## Performance

- N/A — documentation change, no runtime code path. No algorithmic surface. Prompt-budget-relevant: the file shrank 265 → 124 lines, so context cost drops; `test/context-budget*.test.mjs` stays green (part of the 811).

## Verdict

**APPROVED** — every S01–S21 token survives byte-exact against the parser source, all 7 error codes (+ correctly-emitted `VISUAL_REPORT_INCOMPLETE`) are covered, the AC-7 example passes all three compiled parsers, no normative rule from the 265-line original was dropped or weakened, scope is content-only, and `npm run build` + `npm test` (811/811) are green.
