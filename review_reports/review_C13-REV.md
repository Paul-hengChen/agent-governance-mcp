# Review — C13 release-engineer legal handoff write path

covers: C13-01, C13-02, C13-03, C13-04

Reviewed against `specs/c13-release-engineer-write-path.md` (authoritative ACs),
`specs/qa-flow-enforcement-architecture.md` §doc-sync rule. Clean-context adversarial pass.

## Summary

- **C13-01** `tools/transitions.ts`: purely additive — `qa-engineer:PASS` row gains `{release-engineer, In_Progress}` (pm/researcher intact); new `release-engineer:In_Progress → [{pm, In_Progress}]` row. Dead `release-engineer:PASS` row untouched. 10 lines added, 0 removed.
- **C13-02** `specs/qa-flow-enforcement-architecture.md`: both edges mirrored into the ALLOWED_TRANSITIONS matrix, table style consistent.
- **C13-03** `content/skill-release-engineer.md`: Side-channel bullet replaced with First-class-citizen rule; CRITICAL STOP-on-⛔ rule added (verbatim to copy string, covers ALL ⛔ rejections, forbids hand-editing both handoff.md AND tasks.md); opening-write step 2 inserted; steps renumbered 2→11, all internal cross-refs fixed.
- **C13-04** `templates/claude-code-agents/release-engineer.md`: two concise reinforcement hints (STOP-on-⛔, driftBaselineIds); watermark/example lines untouched.
- Build clean (`npm run build` exit 0); no test files edited (§2 honored); no unrelated files touched.
- **Verdict: APPROVED.**

## Correctness

- `tools/transitions.ts:206-215` — AC1/AC2 satisfied exactly. `qa-engineer:PASS` allowed-next = `[pm, researcher, release-engineer]` (all In_Progress); new `release-engineer:In_Progress` allowed-next = `[{pm, In_Progress}]` only. No other successor added; verified additive (git diff: 10 insertions, 0 deletions — the shared `]],` context line is the qa:PASS closer relocated, not a deletion).
- **Round-cap non-interaction (adversarial):** `validateTransition` precedence-2 round-cap override (`transitions.ts:316-352`) fires before the table lookup and would force pm-only if any of qa/review/visual round ≥ cap. Traced `computeNewRound` (`transitions.ts:430-458`): reaching `qa-engineer:PASS` requires all three counters under cap at the qa `In_Progress→PASS` write (else PASS itself is round-capped to pm), and at PASS `qa_round=0`, `visual_round=0`, `review_round` unchanged-and-under-cap. Therefore the `qa:PASS → release-engineer:In_Progress` opening write never trips a cap. The `release-engineer:In_Progress → pm:In_Progress` closing write hits the `next.agent==="pm"` branch and re-zeros all three — correct, already covered by existing pm-reset tests.
- **Self-loop:** release-engineer multi-step progress (`release-engineer:In_Progress → release-engineer:In_Progress`) is accepted by the precedence-3 self-loop fast path (`transitions.ts:355-362`) — no explicit row needed, matches AC2 note.
- **Amend-Resume edge (3.5):** scoped to `pm:In_Progress → {code-reviewer,qa-engineer}`; unaffected by either new edge.
- **Closing-write spec-vs-impl check (coordinator item 3):** spec AC5 states the closing write is `agent_id="pm"` (legal via the new AC2 edge, state stays release-engineer only during the release window). `content/skill-release-engineer.md` step 11 writes `agent_id="pm"` — **matches spec, no mismatch.**

## Quality

- Skill-file step renumbering internally consistent: opening-write=step 2, staging=step 8, GitHub release=step 9, driftBaselineIds=step 10, closing write=step 11. All internal cross-refs updated to match (Artifact section "SOP step 10"; Failure-modes "SOP step 8"; First-class-citizen rule "SOP step 2" / "final SOP step"; PASS-precondition "SOP step 1"). Grep for `step [0-9]` shows no stale reference.
- CRITICAL rule text is verbatim to copy string `c13.stop.rejection`; opening-write `pending_notes` verbatim to `c13.opening-write.notes`.
- Comments in `transitions.ts` accurately describe both edges and the wedge they close; version tag `v3.49.0 (C13)` consistent across code + skill + doc.

## Architecture

- Two additive map entries to a pure, fs-free function — matches spec Decision 2 (no architect hop): no new `AgentName`/`StatusName` variant (`release-engineer` already in both unions), no schema bump, no new tool, no cross-cutting surface.
- **Gate non-interaction (adversarial, coordinator item 1):** both SCOPE_DECISION_REQUIRED and CUT_APPROVAL_REQUIRED fire only on `prev=pm:In_Progress → next∈{architect,sr-engineer}:In_Progress` (`handoff-orchestrator.ts:98-176`). Neither new edge matches: `qa:PASS→release-engineer` has prev=qa-engineer; `release-engineer→pm` has next=pm. Neither gate is reachable through this change.
- **Cut-approval re-arm (coordinator item 1):** the `release-engineer:In_Progress → pm:In_Progress` edge lands at a pm:In_Progress state structurally identical to the pre-existing `qa:PASS→pm` edge. The gate is enforced on pm's *outbound* edge reading the prev handoff's feature-scoped `cut_approved`; C13 introduces no new bypass surface and the next feature's pm write re-attests normally. Confirmed no bypass.
- **Dead `release-engineer:PASS` row:** correctly left untouched per spec Decision 4 (deferred; its removal would touch T-MATRIX-A5 tests).

## Security

- No injection vectors, no secrets, no unvalidated boundaries. `isAgent`/`isStatus` guards unchanged; `release-engineer` already whitelisted in `isAgent`. `status:"PASS"` remains server-reserved to qa-engineer (untouched), so release-engineer still cannot reach PASS — the new edges only add In_Progress hops.

## Performance

- No hot-path change. Two additional Map entries; lookups remain O(1). No regression.

## Verdict

**APPROVED** — implementation matches all in-scope ACs (AC1, AC2, AC3, AC5, AC6) exactly; round-counter and both gates verified non-interacting; closing write matches spec AC5; build clean; §2 test-authorship boundary respected (AC4/AC7 tests are qa-engineer's).
