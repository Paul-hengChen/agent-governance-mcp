# Code Review — A10-09 (gate-registry, A10 + A2 folded in)

Reviewed against `specs/gate-registry.md` (8 ACs) and
`specs/gate-registry-architecture.md` (Decision Records DR-1..DR-8).
Clean-context adversarial review of the uncommitted working tree. Build +
full suite run independently; byte-parity of every hint verified against the
`HEAD` emit sites.

## Summary

- Pure re-plumbing refactor: new `gates/` package (`registry.ts` +
  `qa-review`, `code-review`, `visual`, `scope-decision`, `cut-approval`),
  `tools/evidence-file.ts` drained to shared parsing plumbing, and
  `transitions.ts` / `handoff-orchestrator.ts` / `storage.ts` / `build.ts`
  re-sourcing hint text + imports. 18-gate catalog, verified 18-in / 18-out.
- `npm run build` → zero TS errors. `npm test` → **868/868 pass** with
  gate-test assertions unmodified (the AC-2 byte-parity contract holds by the
  existing suite, empirically).
- All 12 hint emit sites verified byte-identical to `HEAD` (5 transition-json,
  2 orchestrator-json, 11 plain-text — the split points preserve every
  leading/trailing space).
- DR-8 honored: `TransitionRejection["error"]` union stays byte-identical at
  12 members; not narrowed to `TRANSITION_GATE_CODES` (5). All 12 ∈ the
  18-code catalog. Import DAG acyclic (registry imports nothing; evidence-file
  imports nothing from gates/). AC-3 preserved: **zero** `content/*.md` edits.
- Headline verdict: **APPROVED.**

## Correctness

- **Transition hints (codes 1–5), `tools/transitions.ts:296,299,302,314,325,340,380`** —
  each rejection composes `<dynamic>${gate(CODE).hintStatic}`. Verified against
  `HEAD` literals: `QA_ROUND_EXCEEDED` / `REVIEW_ROUND_EXCEEDED` /
  `VISUAL_ROUND_EXCEEDED` / `TRANSITION_REJECTED` hintStatic each carry the
  exact leading space (`" exceeds cap…"`, `" in ALLOWED_TRANSITIONS…"`) so the
  concatenated string is byte-identical. `AGENT_ID_REQUIRED` is fully static
  and matches `"All state writes must declare agent_id."`. Secondary
  `Unknown agent_id`/`Unknown status` literals correctly left inline (not
  gates).
- **Orchestrator hints (codes 6–18), `tools/handoff-orchestrator.ts`** — every
  emit site verified against `HEAD`: fully-static SCOPE/CUT strings moved whole;
  plain-text sites keep the `⛔ CODE: ${dynamic}. ` prefix at the emit site and
  source the fixed sentence(s) from the registry. Byte-checked the non-obvious
  splits (`VISUAL_ASSERTIONS_REQUIRED` keeps `"…Structural Assertions is absent. "`
  inline + registry starts `"The design-auditor MUST emit it…"`;
  `VISUAL_PROVENANCE_MISSING` / `PIXEL_GATE_ATTESTATION_MISSING` registry
  entries begin `"Each diffed surface in "` / `"Each non-carry-forward "` to
  reconstruct the original exactly). `BASELINE_*` entries hold the whole string
  including the `⛔` prefix, matching the original fully-static ternary.
- **`gate()` fail-loud**, `gates/registry.ts:303` — throws on unknown code
  (verified at runtime), not silent `undefined`. `REGISTRY_BY_CODE` built once
  at load.
- **Predicate moves are verbatim**, `gates/visual.ts` / `qa-review.ts` /
  `code-review.ts` / `scope-decision.ts` / `cut-approval.ts` — signatures,
  regexes, sanitizers, opt-in/carry-forward logic, and `designFilePath`
  co-location all match the `HEAD` bodies. No logic drift found.
- **Evaluation order (AC-7)** — the orchestrator diff is localized
  string-source swaps inside each existing `if` block; block sequence
  (scope → cut → missing-evidence → 7 visual sub-gates → review-evidence)
  unchanged. No reorder, merge, or early-return removal.

## Quality

- Module headers document the registry-linkage rationale and the "no registry
  import needed (predicates return data only)" decision per module — accurate
  and useful.
- `escapeRegex` in `tools/evidence-file.ts` is now module-private (was
  effectively plumbing); no external consumer references it — clean.
- Naming/convention consistent with the surrounding codebase; no dead code
  left behind in the drained `evidence-file.ts` (confirmed zero
  `has*/check*/validate*` predicates remain — AC-6).

## Architecture

- **AC-1** single source of truth: one `GATE_REGISTRY` with 18 typed
  `GateDefinition` entries + `gate()`/`TRANSITION_GATE_CODES`/`ALL_GATE_CODES`.
- **DR-1 deviation (acceptable, documented):** the blueprint's snippet showed
  `import type { AgentName, StatusName }` in `registry.ts`; the engineer instead
  types `triggerEdge`/`armCondition` as plain `string`, so `registry.ts` imports
  **nothing** at all. This is a strict strengthening of the "runtime leaf"
  invariant (Cycle risk 1 eliminated by construction rather than by type
  erasure) and is called out in the file header. Not a defect.
- **DR-5** order-not-data: no `evalOrder` field; order stays physical if-block
  sequence. Honored.
- **DR-6** envelope shapes: all three (`transition-json` 4/5-field `attempted`,
  `orchestrator-json` 4-field, `plain-text`) preserved — the envelope objects in
  the orchestrator were untouched, only their `hint` field re-sourced.
- **DR-3 / AC-3:** `content/*.md` diff count = **0**; composeConstitution /
  manifest / strippers untouched; golden-baseline test green in-suite.
- **Import DAG:** `registry.ts` imports nothing; `evidence-file.ts` has zero
  `gates/` imports; `gates/*` import plumbing from `evidence-file.ts` +
  (transitions/orchestrator) the registry. Acyclic — confirmed.

## Security

- Path-traversal sanitizers preserved verbatim in the moved code:
  `evidencePath`/`codeReviewPath`/`visualEvidencePath` retain
  `replace(/[^A-Za-z0-9._-]/g, "_")`; `designFilePath` retains the v3.14.1
  `..`-collapse hardening. No boundary weakened by the move.
- No new I/O, no new external input surface, no secrets. `gate()` is pure.

## Performance

- `REGISTRY_BY_CODE` precomputes an O(1) lookup at module load; `gate()` is
  O(1). No hot-path regression vs the prior inline-literal approach (a string
  literal became one object-property read). No new loops, no unbatched I/O; the
  moved fs predicates keep their original read-once-per-call behavior.

## Verdict

**APPROVED** — behavior-preserving re-plumbing: 18/18 gate catalog, all hint
strings byte-identical to the pre-move emit sites, DR-8 union intact at 12,
import DAG acyclic, envelope shapes and frozen evaluation order unchanged,
`content/*.md` untouched, build clean, 868/868 tests green with unmodified
gate assertions.
