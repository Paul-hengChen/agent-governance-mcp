# Review — T-C8-CR

covers: T-C8-01, T-C8-02, T-C8-03, T-C8-04

## Summary
- Reviews the uncommitted working-tree diff for `c8-crash-resume-protocol`: four additive SOP-text insertions into `content/skill-coordinator.md` (+48/-0). Spec: `specs/c8-crash-resume-protocol.md`.
- File scope is clean: `skill-coordinator.md` is the only content file touched; `skill-coordinator-lite.md` is byte-untouched (AC-5); zero `.ts`/`schema`/`test` changes. The other two diffed files (`.current/handoff.md`, `tasks.md`) are governance-state/task-registry churn, not implementation.
- All four exact-text blocks (T-C8-01..04) reproduce the spec's binding fenced blocks **verbatim** (byte-substring match) and sit at the spec's stated anchors. Diff is purely additive (48 insertions, 0 deletions).
- Verdict: **APPROVED**. One inherited spec-text errata flagged (non-blocking) + one non-defect test re-baseline confirmed.

## Correctness
No implementation defects. Verified independently (not from sr-engineer's notes):
- **Verbatim**: extracted the four ```-fenced blocks from the spec (T-C8-01 len 1203, T-C8-02 len 554, T-C8-03 len 2162, T-C8-04 len 423) and confirmed each is a byte-exact substring of the shipped `skill-coordinator.md`.
- **Anchors** (content/skill-coordinator.md):
  - T-C8-01 `dispatch_pins` paragraph sits after the Subagent Dispatch para ("…NOT the routing chain itself.") and before the Fallback para. ✓
  - T-C8-02 `Pinned-tier expectation` sits after the "leading character MUST be U+2014…" para and before Correction strategy. ✓
  - T-C8-03 `## Crash-Resume Protocol` (line 124) sits after the Cut-approval gate writer obligation and before `## Subagent Reply Watermark Validation` (line 150), with the three numbered steps ground-truth → restate → re-assert in order. ✓
  - T-C8-04 Crash detection row sits after the `hop counter ≥ 10` row and before the Cut-approval gate row; its DO action points at the Crash-Resume Protocol. ✓
- **Additive-only**: `git diff --numstat` = `48  0  content/skill-coordinator.md`; no existing line disturbed.

**Finding CR-1 (LOW, spec errata — inherited verbatim, NOT an implementation defect).** `content/skill-coordinator.md:148` (Crash-Resume step 3): "check the tier against the pin per the Pinned-tier expectation **above**". The Pinned-tier expectation heading is at line 164 — **below** the Crash-Resume section (line 124), inside `## Subagent Reply Watermark Validation` (line 150). The correct word is "below". This text is byte-identical to spec line 260, so sr-engineer faithfully reproduced a binding block; the error originates upstream in the spec. Not routed back to sr-engineer (would violate the verbatim-reproduction contract). Functional risk is negligible — "Pinned-tier expectation" is a unique named anchor an agent locates by name regardless of direction. Recommended disposition: PM fixes the one word in the spec and the file in a trivial follow-up, or QA accepts as-is. Both other new directional refs are correct ("Escalation Routes above" line 128; "Cut-approval gate writer obligation below" line 88).

## Quality
No findings. New text matches the surrounding SOP register, bold-label convention, and code-span backticking. Exactly one origin-tag pair added (the `## Crash-Resume Protocol` version stamp), balanced.

## Architecture
Matches the spec's `no-design`, content-only mandate. `dispatch_pins` is explicitly framed as "a note-convention, not a schema field (backlog C9 …)" (line 92) — no `schema_version` bump, no `tools/handoff.ts` field, consistent with the existing `next_role:`/`resume_of:` `pending_notes` string conventions. The same-tuple-amendment mechanism is cross-referenced to the existing Cut-approval gate writer obligation. No contradiction with existing Auto-Routing, watermark, or escalation rules.

## Security
No findings. Governance prose only; no input crosses a trust boundary, no secrets, no new external surface.

## Performance
No findings on the runtime hot path (content-only). One measured non-functional impact: the coordinator design-arm bundle grows.

**Test re-baseline (CONFIRMED, not a code defect).** `test/context-budget.test.mjs:741` asserts the coordinator bundle ≤ 9699 ~tok (an exact QA-owned cap, no headroom, per the file's established "Phase-2 convention"). I independently re-measured via `composeConstitution({chain,design}) + stripOriginTags + stripRationale`: **10774 ~tok, exceeds by 1075** — reproducing sr-engineer's claim exactly. The growth is entirely spec-mandated SOP text (+48 lines). The cap is a QA-owned artifact bumped to the exact measured value on every content ticket that grows the constitution/skill (see the ~10 prior bump comments in that test). sr-engineer correctly left the test untouched (per-ticket constraint); the bump is QA's to apply during verification. sr-engineer's "release-time re-baseline, NOT a code defect" assessment is **confirmed**.

## Verdict
**APPROVED** — all five ACs met (four blocks verbatim at correct anchors, purely additive, lite byte-untouched); the sole correctness finding (CR-1, "above"→"below") is an errata inherited byte-identically from a binding spec block, low-severity and non-blocking; the context-budget failure is a confirmed QA-owned cap re-baseline, not an implementation defect.
