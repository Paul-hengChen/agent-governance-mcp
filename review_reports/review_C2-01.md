# Review — cut-approval-coordinator-attestation (C2-01..C2-05, C2-07)

Covering report for the full review round. `review_C2-02.md` … `review_C2-07.md` are pointer stubs to this file (per-id evidence-check requirement; see backlog C3).

## Round 1 — APPROVED — by code-reviewer

## Summary

- Governance-text-only feature per `specs/cut-approval-coordinator-attestation.md`: new Cut-Approval Gate bullet in Constitution §3.1 (`content/const-08-chain-31-mid.md`), three skill retellings trimmed to pointers + role-specific actions, 6 compose-golden fixtures regenerated, backlog C2/A8 updated.
- Zero changes under `tools/`, `index.ts`, `prompts/`, `lib/`, `schema/`, `guards/`, `dist/` — AC-6 satisfied.
- Spec strings S02/S03/S04 present verbatim, exactly once each in their target files.
- Verdict: **APPROVED**. Two non-blocking notes below.

## Correctness

- `content/const-08-chain-31-mid.md:2` — new bullet's mechanism cross-checked against `tools/handoff-orchestrator.ts:135-183`: trigger edge (pm:In_Progress → {architect,sr-engineer}:In_Progress), `CUT_APPROVAL_REQUIRED`, unconditional (not design-arm-gated), file-mode-only (`FileHandoffStorage` guard), prev pinned to pm (resume-safe), clearing artifact `cut_approved: true`. All match code. AC-1 ✓.
- S02 trust-rule sentence verbatim per spec (AC-2 ✓); S03 dispatch branch verbatim in `content/skill-pm.md:58` Gate Summary row (AC-3 ✓); S04 self-check verbatim in `content/skill-coordinator.md:91` stop-condition 6 (AC-4 ✓).
- `content/skill-pm.md:44` step 8 no longer hardcodes `cut_approved=true` in the canonical call — correctly deferred to the dispatch branch. Present-inline-and-halt (step 7), table header, and design-link rule retained.
- `content/skill-coordinator-lite.md:20` — pointer added; server-read-only ceiling, single-context-by-construction note, halt-and-present + escalation-signal text preserved. AC-5 ✓.
- Fixture regeneration: 6 chain/monolith fixtures each +1/-0 lines (exactly the new bullet); 5 lite fixtures untouched (lite excludes chain-tagged fragments) — matches spec blast-radius list. `test/compose-equivalence.test.mjs` green. AC-7 ✓.

## Quality

- Bullet follows the adjacent Scope Decision Gate house style, including `<!-- origin:start --> (v3.46.0)<!-- origin:end -->` version tag.
- Backlog: C2 done-entry accurate; A8 "4×→3" correction is precise and the still-open self-converge item stays visibly open. AC-10 ✓ (commit hash deferred to post-PASS single-feature commit — acceptable, entry says so).
- Note (non-blocking, pre-existing): server hint at `tools/handoff-orchestrator.ts:159-161` still says "See content/skill-pm.md §SOP step 7a" — after this change the mechanism owner is Constitution §3.1 and skill-pm no longer labels a step "7a". Out of scope here (AC-6 forbids server edits); candidate for backlog A10 (gate registry renders hints from data).
- Note: skill-coordinator stop-condition 6 retains the single `CUT_APPROVAL_REQUIRED` token — required by `test/cut-approval-gate.test.mjs` assertion; one identifier with no mechanism prose restated is consistent with the pointer-line principle.

## Architecture

- Single-owner placement in `const-08-chain-31-mid.md` (chain-tagged) matches the gate's unconditional non-lite enforcement — correct fragment per spec §Fragment placement. No manifest change needed. No architecture spec exists for this feature (none required — content-only).

## Security

- No code paths touched; no secrets; no injection surface. The documented trust boundary is explicitly attestation-based ("server cannot verify same-context witnessing") — honest per spec AC-2/AC-6, no false security claim introduced.

## Performance

- N/A — content + fixtures only. Bundle growth (~150-300 est. tokens on chain dispatches) is intentional and gated by the qa-owned budget re-baseline (C2-06).

## Verdict

**APPROVED** — implementation matches spec ACs 1-7 + 10 exactly, with no server-code drift; the two notes above are non-blocking follow-ups.

Test-state at review time: `npm test` = 819-820 pass / 4 fail, the 4 fails being exactly the `test/context-budget.test.mjs` cap re-baselines reserved for C2-06 (measured: L99 3030>3010, L487 4957>4487, L525 8635>8078, L914 2872>2403 — note L525 actual is 8635, sr-engineer's note said 8625; re-baseline from the measured value). One run also showed a 5th intermittent failure that did not reproduce across two re-runs — qa-engineer should watch for a flake during C2-06.

Reviewer context: in-context fallback review by the coordinator session (subagent dispatch hit session limit). Same-model-as-writer bias risk flagged per SOP: writer ran on fable; this review also ran on a fable-family context. Mitigated by verbatim-string and code-cross-check verification rather than judgment-only review.
