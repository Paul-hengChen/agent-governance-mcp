# Review — c9-protocol-fields

covers: T-C9-01, T-C9-02, T-C9-03, T-C9-04, T-C9-05, T-C9-06, T-C9-12, T-C9-13, T-C9-14, T-C9-15, T-C9-16

Round 1 — adversarial clean-context review (diff vs HEAD c8bc574 + specs/c9-protocol-fields.md + specs/c9-protocol-fields-architecture.md). Reviewer model tier: opus (distinct blind spots from sr-engineer=fable — no same-model bias concern).

## Summary
- Promotes the three `pending_notes` protocol tokens (`next_role:`, `resume_of:`, `review:`) to first-class handoff v7 fields with closed-enum validation. Server surfaces changed across 7 code files + 13 content files; no test file touched (Constitution §2 respected — QA owns T-C9-07..11).
- Handoff schema v6→v7 stamp-only migration (DR-1), legacy tokens inert (DR-2/DR-6), `resumeMarkerNames` + `next_pending_notes` deleted, `REVIEW_VERDICT_STATUS_MISMATCH` plain-text orchestrator gate added (GATE_REGISTRY 19→20, TransitionRejection union untouched at 13, DR-3).
- All nine ACs and eight DRs implemented as specified; enum validation, transient write-scoped semantics (AC-3), and check-order all verified against the diff.
- Build clean (`tsc` zero errors, version check OK). 52/959 tests red, 907 green — every red attributable to a QA-owned re-baseline; zero hidden regressions.
- Verdict: **APPROVED**.

## Correctness
- **v6→v7 migration** (schema/migrations-handoff.ts:76-88, schema/versions.ts:8): stamp-only `up: (input) => ({ ...input, schema_version: 7 })`, seeds nothing — matches DR-1 and Interface Contract verbatim. `CURRENT_VERSIONS.handoff = 7`. Grep anchor `void CURRENT_VERSIONS.handoff` preserved.
- **Amend-Resume rewire** (tools/transitions.ts:378): `req.next_resume_of === req.next.agent` replaces the `resumeMarkerNames` grep. Absent `resume_of` → `undefined === "qa-engineer"` is false → falls through to `TRANSITION_REJECTED` (AC-4 reject-on-absent, reject-on-mismatch both satisfied). Edge stays additive/pure/fs-free.
- **`next_pending_notes` deletion is safe** — the one risk I chased. Its OLD comment claimed it fed the `visual_round` bump, but `computeNewRound` (transitions.ts:421-453) has its OWN `next_pending_notes` parameter, and the orchestrator feeds it directly from `parsed.pending_notes` (handoff-orchestrator.ts:521). The `TransitionRequest.next_pending_notes` field was only ever read by `resumeMarkerNames`. The `visual_fail:` path is intact. DR-6's "only reader" claim is accurate; the removed comment was stale.
- **REVIEW_VERDICT_STATUS_MISMATCH gate** (handoff-orchestrator.ts:243-262): fires only when `agent_id === "code-reviewer" && review_verdict` present and polarity disagrees (APPROVED≠In_Progress or CHANGES_REQUESTED≠FAIL). Absent verdict never fires (AC-5/DR-8). Keys only on incoming write args — storage-agnostic, no FileHandoffStorage guard (DR-5), correct.
- **AC-3 transient semantics** (handoff.ts:534-536, 557-559, 689-691): write-path locals default `undefined`, are assigned ONLY from the options object, and emitted ONLY `if (set)`. No previous-state preserve read exists for the three — contrast `external_refs`, which needs an explicit preserve clause (proving the writer builds frontmatter fresh, so an omitting write drops them). Transient semantics verified, no leak/persist across writes.
- **Enum validation ordering**: zod closed enums at the tool boundary (registry.ts:134-160) reject out-of-enum before any gate runs (AC-2). Defensive `parseEnumField` at read (handoff.ts:203-211) returns `undefined` on non-string/out-of-enum, mirroring `parseExternalRefs`; surfaced via `{ ...state }` spread (handoff.ts:307-309) for `tw_get_state` (AC-2).

## Quality
- No findings. Comments are dense but accurate and point to the governing AC/DR. Naming (`ResumeOfTarget`, `ReviewVerdict`, `parseEnumField<T>`) fits the surrounding conventions. Type-only import of `AgentName` into handoff.ts is annotated to preserve the one-directional runtime graph (transitions.ts never imports handoff.ts) — good discipline.
- `next_resume_of` uses an inline `"code-reviewer" | "qa-engineer"` union in transitions.ts rather than importing `ResumeOfTarget` — consistent with the deliberate no-import boundary; acceptable minor duplication.

## Architecture
- Matches specs/c9-protocol-fields-architecture.md task-by-task (T-C9-01..06, T-C9-12..16). Check-order FROZEN comment (handoff-orchestrator.ts:8-13) updated to insert the new gate between external-refs and the evidence record — matches the Interface Contract placement exactly. GATE_REGISTRY entry (gates/registry.ts:306-317) is byte-faithful to the architecture's specified literal. sqlite untouched (DR-5 confirmed — no storage-sqlite.ts change). No `index.ts` dispatcher edit needed (arg surface driven by registry.ts).

## Security
- No findings. No new trust boundary: `resume_of` and `next_role` remain PM-attested (trust class of `scope_decision_why`), server validates only field-shape and field⟺target consistency — unchanged from prior. No injection vector; enums are closed sets. No secrets. Content-file edits are prose only.

## Performance
- No findings. Migration is O(1) stamp. The gate is a constant-time envelope check on incoming args. Deleting the `resumeMarkerNames` array scan is a marginal improvement. No hot-path or complexity-class regression.

## Red-test attribution (52 failures — all QA-owned re-baselines, no code file edited)
No `test/` file changed (verified via `git status`). Every failure is a pre-existing assertion asserting a stale constant against correctly-changed behavior:
- **Schema v6→v7** (handoff-versioning, handoff-migration, schema-versions, drift-skew): e.g. "future v7 refuses-loud against a v6 server" now fails because the server IS v7 (correct behavior change; fixture must move to v8). Confirmed by assertion `'Missing expected exception: v7 file must refuse-loud against a v6 server'`.
- **Migration-chain re-registration** (cut-approval-gate M1-M4): tests `_clearRegistryForTests` then re-register only through v5→v6, so `runMigrations` to CURRENT now throws "missing migration step handoff v6→v7". Production migration IS registered (schema/migrations-handoff.ts) — QA must extend the test chain to 6→7.
- **Gate 19→20 + SUFFIX_RE** (error-code-contract): "exactly 19 entries", registry↔code parity — needs `MISMATCH` added to `SUFFIX_RE` (DR-7) and 19→20 rebaseline.
- **Amend-Resume token→field** (qa-flow C1-07): resume driven via legacy `pending_notes` token, now inert — must re-target `next_resume_of`.
- **Content prose/token caps** (compose-equivalence goldens x11, context-budget token caps, phase-0-5-sop, qa-visual-skill-split, pixel-perfect): AC-7 prose edits shift golden bytes and token counts (c8 precedent).
Spot-checked two failure bodies directly; both are stale-constant re-baselines, not crashes or logic regressions.

## Verdict
**APPROVED** — implementation is faithful to all nine ACs and eight DRs, the risky `next_pending_notes` deletion is provably safe, AC-3 transient semantics and the new gate's polarity/scope are correct, build is clean, and all 52 red tests are genuine QA-owned re-baselines with no hidden regression. Route to qa-engineer for T-C9-07..11 test authoring.
