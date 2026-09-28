# Review — T-ECCT-01 (error-code-contract-test)

## Round 1 — APPROVED — by code-reviewer

## Summary

- **Scope:** Doc-only diff. Adds backtick-quoted mentions of the 8 previously-undocumented gate error codes into `content/*.md`, each anchored to existing conceptual prose describing the same gate. No behavior change.
- **Files touched (in-scope):** `content/skill-code-reviewer.md`, `content/skill-coordinator.md`, `content/skill-qa-engineer.md`, `content/skill-qa-visual.md`. (`.current/handoff.md` + `tasks.md` are governance bookkeeping, not review targets.)
- **Contract:** `specs/error-code-contract-test.md`. No architecture artifact exists (correctly — server-behavior-only doc feature).
- **Verification:** All 8 codes confirmed to exist at real code-side emit sites; each doc mention anchored to same-gate prose; `npm run build` exit 0; `npm test` 802/802 pass.
- **Headline verdict:** APPROVED.

## Correctness

All 8 required codes are present, spelled exactly, and each is anchored to prose describing the *same* gate that emits it. Independently verified each against its emit site:

| Code | Doc anchor | Emit site | Same-gate? |
|---|---|---|---|
| `AGENT_ID_REQUIRED` | skill-qa-engineer.md — "required before any later PASS/FAIL is accepted … any state write lacking a valid `agent_id` is rejected" | `tools/transitions.ts:280,283` (missing + unknown agent_id) | ✓ |
| `MISSING_EVIDENCE` | skill-qa-engineer.md — "verifies evidence exists (else `MISSING_EVIDENCE`) before persisting PASS" | `index.ts:885` (PASS evidence gate) | ✓ |
| `MISSING_REVIEW_EVIDENCE` | skill-code-reviewer.md — "verifies a review_reports/review_<id>.md exists … before accepting the handoff to qa" | `index.ts:1112` (code-review evidence gate) | ✓ |
| `QA_ROUND_EXCEEDED` | skill-qa-engineer.md — "At Round 4 (after 3 prior FAILs), only (pm, In_Progress) is accepted next" | `tools/transitions.ts:296` (ROUND_CAP=4) | ✓ |
| `REVIEW_ROUND_EXCEEDED` | skill-code-reviewer.md — "After 3 FAILs the next valid transition is (pm, In_Progress)" | `tools/transitions.ts:307` (REVIEW_ROUND_CAP=4) | ✓ |
| `TRANSITION_REJECTED` | skill-coordinator.md — "ALLOWED_TRANSITIONS matrix … gates every tw_update_state write (invalid edges rejected)" | `tools/transitions.ts:345` (generic invalid-edge) | ✓ |
| `VISUAL_ROUND_EXCEEDED` | skill-qa-visual.md — "Past the cap (Round 6), only (pm, In_Progress) is accepted" | `tools/transitions.ts:322` (VISUAL_ROUND_CAP=6) | ✓ |
| `VISUAL_WIDGETS_UNVERIFIED` | skill-qa-visual.md — "server likewise rejects PASS while any row is unchecked" | `index.ts:949` (unchecked-widgets gate) | ✓ |

Numeric claims in the anchoring prose verified against constants: `ROUND_CAP=4`, `REVIEW_ROUND_CAP=4`, `VISUAL_ROUND_CAP=6` (`tools/transitions.ts:220-226`). No off-by-one drift introduced. `TRANSITION_REJECTED` is also emitted at `:286` for unknown-status, but the doc anchors the code to the invalid-edge semantics (its primary meaning at `:345`) — accurate.

No phantom codes introduced: the diff adds only the 8 real codes, so it cannot break AC-3 (docs ⊆ code). No edge cases or logic to mis-handle in a doc-only change.

## Quality

Anchors are inline parentheticals appended to sentences that already describe the behavior — minimal, in-context diff exactly as the spec's Dependencies section directs ("anchor each one to the existing prose … rather than appending a disconnected list"). Backtick fencing is consistent with surrounding error-code references. `VISUAL_WIDGETS_UNVERIFIED` is placed in `skill-qa-visual.md` next to the Visual Widgets shape-FAIL checkbox rules rather than the spec's *example* location (`constitution-rationale.md`/`skill-sr-engineer.md`); the spec wording is "e.g."/"should", and the chosen anchor genuinely describes the same gate, so this is a valid same-gate placement, not a wrong anchor. No dead text, no convention drift.

## Architecture

No architecture spec exists for this feature (correct — server-behavior-only doc change). The diff introduces no new module, no `tools/error-codes.ts` export, and no call-site refactor — consistent with the spec's explicit Out-of-Scope rejection of a shared module for this interim ticket. Fits the three-layer defense model: only `content/*.md` (governance prose loaded into workspaces) is edited.

## Security

N/A — no code paths, inputs, boundaries, or secrets touched. Prose-only edits to governance markdown.

## Performance

N/A — doc-only. No runtime surface, loops, or I/O changed. `npm test` completes in ~27s, unchanged.

## Verdict

**APPROVED** — all 8 undocumented gate codes now carry a backtick mention anchored to same-gate prose, every named code verified against a real emit site, build and 802/802 tests green.
