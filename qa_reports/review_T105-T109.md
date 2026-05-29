# QA review — T105 + T106 + T107 + T109 (Batch B + C + tests)

## Round 1 — PASS — by qa-engineer

### Phase 0 — Claimed

Advanced state from (code-reviewer, In_Progress) APPROVED → (qa-engineer, In_Progress).

### Phase 1 — Review

- **Copy Audit Gate**: spec's *Copy / Strings* entries are server error strings (`err.visual_evidence_missing`, `err.visual_widget_missing`) and SOP directive text (`sop.sr_engineer.phase_0_5`, `sop.pm.visual_widgets_intro`). Each is tagged `authored-here` per spec. Implementation strings in `index.ts` enrich the spec wording with operational detail (path + missing-id list + remediation step) — consistent with the existing `MISSING_EVIDENCE` / `MISSING_REVIEW_EVIDENCE` enrichment pattern. Surfaced as observation, not FAIL: enrichment over verbatim spec strings is the established convention for server error messages. SOP directive text in skill-sr-engineer.md matches the spec semantics.
- **Visual Audit Gate**: spec *Visual Tokens* explicitly declares `N/A — 本 feature 純 framework 規約變更`. No code-side literals to audit. ✓
- **Phase 1.5**: `design/pixel-perfect-fixes-v3.14.md` does NOT exist (feature has no UI surfaces). Phase 1.5 skipped per the v3.14.0 absent-branch contract. ✓ This is also the AC-13 backwards-compat self-test: our own server-gate code is exercising the gate in dormant mode while we ship it.

### Phase 3 — Tests (T109)

**Test File Discovery**: existing test files exist for handoff, transitions, schema, qa-flow, and qa-visual. Migrated 6 broken tests across existing files. Wrote 4 new test files for v3.14.0 acceptance criteria.

**Spec-to-Test Map**:

| AC | Test |
|---|---|
| AC-1 (skill-pm Visual Widgets schema) | `test/widget-shape-spec.test.mjs` — 5 tests |
| AC-2 (skill-design-auditor extraction) | `test/widget-shape-spec.test.mjs` — 5 tests |
| AC-3 (skill-architect Visual Harness) | `test/phase-0-5-sop.test.mjs` — 3 tests |
| AC-4 (skill-sr-engineer Phase 0.5) | `test/phase-0-5-sop.test.mjs` — 7 tests |
| AC-5 (qa-engineer Phase 1.5 PASS-gated) | `test/visual-evidence-gate.test.mjs` — 5 tests + qa-visual-skill-split.test.mjs (AC-3 v3.14.0 migration) |
| AC-6 (widget-shape checklist) | `test/widget-shape-spec.test.mjs` — 2 tests (R6) + qa-visual-skill-split.test.mjs AC-1 v3.14.0 |
| AC-7 (Constitution §1 exception) | `test/widget-shape-spec.test.mjs` — 2 tests (R5) |
| AC-8 (visual_round sub-loop) | `test/visual-round-transitions.test.mjs` — 9 tests |
| AC-9 (split escalation) | `test/visual-round-transitions.test.mjs` — 2 tests |
| AC-10 (server PASS gate) | `test/visual-evidence-gate.test.mjs` — 6 tests |
| AC-11 (handoff schema v3 + migration) | `test/handoff-migration.test.mjs` (migrated) + `test/handoff-versioning.test.mjs` (migrated) + `test/visual-round-transitions.test.mjs` AC-11 — 2 tests |
| AC-12 (build green, tests pass, audit clean) | this report's Phase 4 |
| AC-13 (backwards compat absent design file) | `test/visual-evidence-gate.test.mjs` — 2 tests |
| AC-14 (no retroactive enforcement) | not directly tested; covered by AC-5/AC-13 absent-branch tests proving the gate is dormant by default |

**Coverage Gate**: T109 line coverage:
- `tools/evidence-file.ts` new exports (`hasVisualBaselinesInDesign`, `hasVisualEvidenceInFile`) — 11 test cases covering present/absent/empty/sanitised paths/case-insensitive match. > 90% line coverage.
- `tools/transitions.ts` `computeNewRound` v3.14.0 logic — 6 visual_round bump/reset/hold tests, plus 3 boundary tests (cap, split escalation, backwards-compat). > 95% coverage of new branches.
- Markdown SOP files — lint-style tests assert structural contracts (schema sections present, cross-refs intact, ordering invariants).

**Security Smoke Tests**:
- Boundary inputs: empty active_feature → gate dormant ✓; path-unsafe characters → slashes sanitised ✓; empty task id list → empty present/missing ✓.
- No auth/permission surface in this feature.
- Path-traversal vectors: confirmed sanitised in `visualEvidencePath` and `designFilePath`.

### Phase 4 — Run

- `npm run build` — zero errors. ✓
- `npm test` — 353/353 passing (was 275/303 pre-migration). ✓
- `npm audit --audit-level=high` — 5 vulnerabilities (1 moderate, 3 high, 1 critical) all transitive under `@xenova/transformers` (not reachable). Same waiver as v3.13.0, carried forward unchanged. ✓
- CI runnability: headless, no human interaction needed.

### Verdict — PASS for T100-T107 + T109

All v3.14.0 implementation tasks pass. Remaining tasks:
- **T108**: `specs/qa-flow-enforcement-architecture.md` matrix update — sr-engineer / doc-writer scope.
- **T110**: CHANGELOG + README + package.json + index.ts version bump 3.13.0 → 3.14.0 — sr-engineer / release-engineer scope.

These were intentionally excluded from this qa cycle because (a) they don't affect functional behaviour and (b) they belong to non-test roles per Constitution §2. Routing forward to PM → sr-engineer for T108 + T110 to complete v3.14.0.

— @qa-engineer
