# Review — T-E4-01

covers: T-E4-01, T-E4-02, T-E4-03

Feature: `e4-design-source-credibility-gate` — new build-entry gate
`SOURCE_CREDIBILITY_UNVERIFIED` on the `pm:In_Progress → {architect,sr-engineer}:In_Progress`
edge, arming only on fetch-based design-armed features. Reviewed against the 10 ACs of
`specs/e4-design-source-credibility-gate.md` and DR-1..DR-9 of the architecture spec.

## Summary
- Full E4 surface reviewed as one round: `content/skill-design-auditor.md` (T-E4-01),
  `gates/visual.ts` + `gates/registry.ts` + `tools/transitions.ts` (T-E4-02),
  `tools/handoff-orchestrator.ts` + `content/coord-03-core-fallback.md` + `content/skill-pm.md` (T-E4-03).
- All E4 changes are uncommitted working-tree diff over base `dc872ea`; nothing was pre-committed.
- Every AC and every Decision Record constraint is satisfied; zero deviations from the blueprint.
- Verdict: APPROVED.

## Correctness
No findings.
- Orchestrator gate block (`tools/handoff-orchestrator.ts:349-383`) is a sibling `if` at the same
  nesting level as the external-refs gate (ends `:335`) and precedes the E2 repro gate (`:385`) —
  exactly the frozen-additive position DR-4/architecture prescribes (after external-refs, before E2).
- Arm condition pins `prevTuple.agent === "pm" && prevTuple.status === "In_Progress"` and
  `nextTuple.agent ∈ {architect,sr-engineer}` at In_Progress (AC-6 resume safety): the
  architect→sr-engineer edge (prev=architect) and the sr self-loop (prev=sr-engineer) carry a
  non-pm predecessor and are never gated. Verified against the actual condition, not the comment.
- `checkSourceCredibility` (`gates/visual.ts:849-891`) never throws: fs errors and missing file →
  dormant `{ok:true}`. Decision tree matches AC-4 exactly — no activeFeature / file absent (`:857`),
  mode ∉ FETCH_BASED_MODES (`:869`), no `## Source` section (`:861`) all fall through silently.
- Only `isAudited` rows are checked (`:884`); a normalized `credibility !== "full-page-composite"`
  is the sole fire condition (AC-1/AC-3). Offending rows collected as `medium/pointer` pairs.
- Parser (`parseBaselineManifestRows`, `gates/visual.ts:701,729-735`) locates `credibility` by
  header name only (`/^credibility$/`, header cells lowercased) with no positional fallback, and
  normalizes the cell `trim().toLowerCase()` — so `full-page-composite` compares byte-exact against
  the literal. Absent header / short row → `""` → gate fires (DR-5 no-backfill re-audit behavior).
- hintStatic byte-exactness (AC-8): emit-site dynamic prefix
  `Source-credibility attestation missing or unverified for: ${rows}.` concatenated with
  `gate(...).hintStatic` (leading space, `gates/registry.ts:106-109`) reproduces spec S02
  character-for-character, including the single space after the prefix period and the two internal
  line-join spaces. Confirmed by hand-collation against S02.

## Quality
No findings. Naming, comment discipline, and dormant/fail shape mirror the sibling
`checkBaselineManifest` helper (DR-1 DRY: one read of the identical `## Source` table). The
additive `credibility` field on `BaselineManifestRow` leaves `isAudited`/`auditedCount` untouched.
Doc-map comment in `gates/registry.ts` and the `26→27`/`All 26→27` catalog comments are updated
consistently.

## Architecture
No findings. Implementation matches every Decision Record:
- DR-1 parser extension; DR-2 explicit `FETCH_BASED_MODES` inclusion list (`gates/visual.ts:823`),
  narrower than `hasDesignModeRequiringVisual` — no false-fire on image/pdf/paper/no-design.
- DR-3 `transitions.ts` union member added between `EXTERNAL_REFS_UNRESOLVED` and
  `FEATURE_LEASE_HELD` with a handler-side-only doc-comment (`tools/transitions.ts:115-123`);
  `validateTransition` stays pure/fs-free.
- DR-4 storage-agnostic: the gate condition carries NO `getActiveStorage() instanceof
  FileHandoffStorage` guard (AC-7) — verified the block is NOT nested inside the external-refs
  file-mode `if`.
- DR-6 stop-condition added to `content/coord-03-core-fallback.md` (the composed fragment, not a
  monolithic skill file); DR-7 lite untouched.
- schema_version stays 11 (no `tools/handoff.ts` / `schema/*` / zod changes); `tools/telemetry.ts`
  untouched (DR-8 / E8 boundary — the generic `extractGateCodeFromText` picks up the `⛔` prefix).

## Security
No findings. No new trust boundary. The gate reads a workspace-local `design/<feature>.md` via the
existing `fs` path already used by `checkBaselineManifest`; no user input is interpolated into a
sink. Envelope construction is pure string assembly of server-controlled values.

## Performance
No findings. One additional synchronous `design/<feature>.md` read on the pm→build hop (a cold
edge, not a hot path), reusing the same parse the manifest gates already perform elsewhere. No
loop/complexity regression; the audited-row scan is O(rows) over a small manifest.

## Doc-map parity
`` `SOURCE_CREDIBILITY_UNVERIFIED` `` is backtick-quoted in EXACTLY the three files named in the
`gates/registry.ts` doc-map comment — `content/coord-03-core-fallback.md`,
`content/skill-design-auditor.md`, `content/skill-pm.md` — and nowhere else in `content/`. No test
files, `tools/telemetry.ts`, or `schema/*` were touched. `npm run build` exits 0.

Note (out of review scope, expected): `test/error-code-contract.test.mjs` gate-count baselines
(26→27, union 15→16, doc-map size 27, new `FREE_TEXT_ALLOWLIST` entry) are qa-owned re-baseline
work under T-E4-05 and are legitimately red until then — not a CHANGES_REQUESTED reason.

## Verdict
APPROVED — the full E4 surface implements all 10 ACs and DR-1..DR-9 with zero deviations; the
build-entry gate is correctly positioned, storage-agnostic, prev-pinned for resume safety, and its
hint reproduces spec S02 byte-for-byte.
