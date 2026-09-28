# QA Review — T-E4-05 (e4-design-source-credibility-gate)

covers: T-E4-ARCH, T-E4-01, T-E4-02, T-E4-03, T-E4-04, T-E4-05

Feature: `e4-design-source-credibility-gate`. Spec: `specs/e4-design-source-credibility-gate.md`
(10 ACs) + `specs/e4-design-source-credibility-gate-architecture.md` (§Test Specification).
Code-reviewer APPROVED T-E4-01/02/03 (`review_reports/review_T-E4-01.md`, covers all three);
T-E4-04 is satisfied by that review per the coordinator's dispatch note.

## Phase 0.5 — Expected-Red Diff

No `qa_reports/expected-red_e4-design-source-credibility-gate.txt` manifest exists for this
feature. Per SOP absent-branch: **Phase 0.5: skipped (no expected-red manifest declared)**.

## Phase 1 — Review

Code-reviewer's `review_reports/review_T-E4-01.md` already covers correctness, quality,
architecture (all 10 ACs + DR-1..DR-9), security, and performance for the full T-E4-01/02/03
diff (`content/skill-design-auditor.md`, `gates/visual.ts`, `gates/registry.ts`,
`tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `content/coord-03-core-fallback.md`,
`content/skill-pm.md`) — verdict APPROVED, zero deviations. Independently re-read the same
diff against the architecture blueprint before writing tests and found it consistent:

- `checkSourceCredibility` (`gates/visual.ts`) decision tree matches AC-4/AC-1/AC-3 exactly;
  never throws (fs errors / missing file → dormant).
- `FETCH_BASED_MODES` is an explicit inclusion list (`figma`/`sketch`/`xd`/`penpot`), not the
  broader `hasDesignModeRequiringVisual` exclusion (DR-2) — confirmed no false-fire on
  `image`/`pdf`/`paper`/`no-design`.
- Orchestrator gate block sits at the `pm:In_Progress -> {architect,sr-engineer}:In_Progress`
  edge, pinned to `prevTuple.agent === "pm"` (AC-6 resume safety), with NO
  `instanceof FileHandoffStorage` guard (AC-7 storage-mode-agnostic, DR-4) — verified directly
  against the compiled `dist/tools/handoff-orchestrator.js` (see T11 below).
- `hintStatic` (`gates/registry.ts`) carries the documented leading space; dynamic prefix +
  static suffix reproduces spec S02 byte-for-byte (AC-8, DR-9) — verified against the
  **runtime-evaluated** `gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic` value (see T13
  below and the note on why a raw dist-text scan of the concatenated string doesn't work).
- `tools/transitions.ts` union member is handler-side-only, doc-commented, matches DR-3.
- schema_version unchanged at 11; `tools/telemetry.ts` untouched (E8 boundary, DR-8).

**Copy Audit Gate**: spec's Copy/Strings table (S01-S04) — grepped the source tree:
- S01 `SOURCE_CREDIBILITY_UNVERIFIED` — present in `gates/registry.ts`, `tools/transitions.ts`,
  `tools/handoff-orchestrator.ts`.
- S02 hint string — verified byte-exact via the runtime `gate(...).hintStatic` concatenation
  (T13).
- S03 `credibility` — new `## Source` manifest column header, present in
  `content/skill-design-auditor.md` Artifact Schema + `gates/visual.ts` parser.
- S04 `full-page-composite` — the closed attestation value, present in both files and the
  registry `clearingArtifact`/`hintStatic` text.
No drift, no coverage gap found.

**Visual Audit Gate**: spec's Visual Tokens table is N/A (server-only feature, no visual UI) —
logged per SOP N/A branch. No visual token coverage gap possible.

## Phase 1.5 — Visual Compare

No `design/e4-design-source-credibility-gate.md` exists (infra/meta feature, no design mode
armed for it — spec's own Visual Structural Assertions section confirms this). **Phase 1.5:
skipped (no Visual Baselines declared)**.

## Phase 3 — Tests

### A. `test/error-code-contract.test.mjs` re-baseline (T-E4-05 item 1)
- Gate count 26→27 (`GATE_REGISTRY.length`, `ALL_GATE_CODES.length`, catalog-order deepEqual) —
  bump-comment added naming e4-design-source-credibility-gate.
- Doc-file mapping `mapping.size` 26→27, comment line added:
  `SOURCE_CREDIBILITY_UNVERIFIED   coord-03-core-fallback.md, skill-design-auditor.md, skill-pm.md`
  — matches the exact 3-file backtick-quote set (verified no other `content/*.md` file quotes it).
- DR-8 union 15→16 members, bump-comment added.
- `FREE_TEXT_ALLOWLIST`: added `{ code: "SOURCE_CREDIBILITY_UNVERIFIED", field: "triggerEdge", ... }`
  per spec's exact reasoning (role:Status pair present but not in `triggerEdgeCheckable`/
  `EDGE_CHECKED_CODES`). `armCondition` intentionally NOT allowlisted — `checkSourceCredibility`
  is a real camelCase predicate literally present in `tools/handoff-orchestrator.ts`, so it is
  mechanically checked via `armConditionCheckable` (verified: AC3 closure test passes without an
  armCondition allowlist entry).

### B. `test/source-credibility-gate.test.mjs` (new, 18 tests) — AC→test map

| AC | test(s) |
|---|---|
| AC-1 (attestation required on audited rows; missing/empty cell) | T1, T2, T4, T12 |
| AC-2 (existing STOP unchanged) | prose-only in `content/skill-design-auditor.md`; no code path to unit-test — regression coverage is the unchanged step-2b STOP behavior, out of this file's scope by spec design |
| AC-3 (wrong value fires; hint names row) | T3, T5 |
| AC-4 (dormant: non-fetch mode / no design file / no `## Source`) | T8, T9a, T9b |
| AC-5 (independent of BASELINE_MANIFEST_MISSING/PROVENANCE_INCOMPLETE) | T6, T7 |
| AC-6 (pinned to pm predecessor — resume safety) | T10 |
| AC-7 (storage-mode agnostic — no `instanceof FileHandoffStorage`) | T11 |
| AC-8 (hint format + byte-exact S02) | T13 |
| AC-9 (coordinator Auto-Routing stop-condition) | T14 |
| AC-10 (build gate) | exercised by the closing `npm run build && npm audit --audit-level=high && npm test`, see Phase 4 |
| DR-1 (parser extension, `credibility` column by header) | T12 |
| DR-5 (no backfill — missing column fires, not grandfathered) | T1 |

Plus 3 security smoke tests (path traversal / hostile feature name / unreadable workspace path /
oversized input — all `doesNotThrow` + dormant-result assertions).

**Coverage gate**: `checkSourceCredibility` and the extended `parseBaselineManifestRows`
branches are covered line-for-line by T1-T12 (every decision-tree branch: no-file, non-fetch
mode, no-Source-section, missing-column, blank-cell, wrong-value, compliant, multi-row,
deferred-ignored, zero-audited). No tooling-measured coverage percentage available (no nyc/c8
wired into this repo's `npm test`) — noted explicitly per SOP.

### C. Test-impact awareness — verified green
- `test/baseline-manifest-gate.test.mjs`: the additive `credibility` field on
  `BaselineManifestRow` does not break any existing assertion (none deep-equal a full row
  literal) — confirmed by running the file (all pass).

## Phase 4 — Run

`npm run build` — 0 errors. `npm audit --audit-level=high` — exit 0 (1 low-severity `esbuild`
advisory only, below the `--audit-level=high` threshold). `npm test` — full suite green.

**Found and fixed 3 additional test-infra casualties of the T-E4-01/03 content diff** (not
covered by the architecture's Test Specification, but caught by the "0 fail" bar in T-E4-05
item 3). Verified by temporarily stashing the E4 source/content diff and re-running: all three
pass at the pre-E4 baseline, confirming the failures are a genuine, expected consequence of the
E4 content additions, not pre-existing flakes:

| test | cause | fix |
|---|---|---|
| `test/context-budget.test.mjs` "AC1/AC2: skill-pm stripped token count meets ≤ 3775 cap" | new Source-Credibility Gate row added to skill-pm.md's Gate Summary table (T-E4-03) | cap re-measured and raised 3775→3922 (qa-owned bump, exact-measured-value convention, no headroom — same precedent as every prior `e2-bugfix-repro-gate`/`b8-external-ref-ledger`/etc. bump in this file) |
| `test/context-budget.test.mjs` "AC8/AC-P2-7: teamwork coordinator bundle ... floor (≤ 13537 ~tok)" | new stop-condition row added to `content/coord-03-core-fallback.md` (T-E4-03), folded into the composed skill-coordinator monolith | cap re-measured and raised 13537→13669 (same convention) |
| `test/skill-manifest.test.mjs` "t-golden-byte-identity" | same `coord-03-core-fallback.md` growth — frozen fixture `test/fixtures/compose-golden/skill-coordinator-monolith.txt` predates the new row | fixture regenerated via `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent)`; diff confirmed to be exactly the one new stop-condition line (+1 line) |

All three re-measured values were independently computed (not trusted from any handoff note)
via direct invocation of the same `stripRationale`/`stripOriginTags`/`composeConstitution`/
`composeSkill` functions the tests use.

**Final full suite**: `npm test` → **1281/1281 pass, 0 fail** (1268 top-level + subtests).
`npm run build && npm audit --audit-level=high && npm test` all exit 0 (AC-10 satisfied).

## Verdict

**PASS** — T-E4-ARCH, T-E4-01, T-E4-02, T-E4-03, T-E4-04, T-E4-05 all satisfied. All 10 spec
ACs covered by tests (new `test/source-credibility-gate.test.mjs`, 18 tests) or by the
unchanged-STOP-behavior prose (AC-2, out of code-test scope by spec design). Re-baselined
`test/error-code-contract.test.mjs` (gate count, union count, doc-map, allowlist) and 3
qa-owned token-budget/golden-fixture re-baselines caused by the same content diff. Full
regression clean.
## 2026-07-12T06:43:09.507Z — PASS — by qa-engineer

PASS — e4-design-source-credibility-gate. Phase 0.5: skipped (no expected-red manifest). Phase 1: code-reviewer APPROVED (review_reports/review_T-E4-01.md, covers T-E4-01/02/03); Copy/Visual Audit Gates clean (S01-S04 verbatim; Visual Tokens N/A). Phase 1.5: skipped (no design/e4-*.md, no Visual Baselines). Phase 3: re-baselined test/error-code-contract.test.mjs (gate 26->27, union 15->16, doc-map size 27, new FREE_TEXT_ALLOWLIST triggerEdge entry); new test/source-credibility-gate.test.mjs (18 tests, full AC-1..AC-9 + DR-1/DR-5 map, security smoke). Phase 4: found+fixed 3 qa-owned re-baselines caused by the same content diff (skill-pm token cap 3775->3922, teamwork coordinator bundle cap 13537->13669, golden monolith fixture regenerated) — verified via stash-and-rerun that all 3 pass at pre-E4 baseline, confirming genuine expected consequence not pre-existing flake. npm run build: 0 errors. npm audit --audit-level=high: exit 0 (1 low esbuild advisory only). npm test: 1281/1281 pass, 0 fail. Evidence: qa_reports/review_T-E4-05.md.

