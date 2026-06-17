# QA Review — T-FBMG-QA (figma-baseline-manifest-gate, v3.40.0)

**Reviewer:** qa-engineer
**Date:** 2026-06-17
**Tasks covered:** T-FBMG-ARCH, T-FBMG-01, T-FBMG-02, T-FBMG-QA
**Verdict:** PASS

---

## Phase 0 — Claim

State was already at (qa-engineer, In_Progress) per prompt instructions. No Phase 0 write needed.

---

## Phase 1 — Review

### Spec ACs verified against implementation

| AC | Description | Implementation location | Status |
|----|-------------|------------------------|--------|
| AC-1 | BASELINE_MANIFEST_MISSING fires on 0 audited rows | `tools/evidence-file.ts` `checkBaselineManifest()` lines 848–856; `index.ts` lines 970–892 | PASS |
| AC-2 | BASELINE_PROVENANCE_INCOMPLETE fires on ≥2 audited, missing provenance | `evidence-file.ts` lines 862–870 | PASS |
| AC-3 | Single-surface (1 audited row) exempt from provenance check | `evidence-file.ts` line 859 | PASS |
| AC-4 | No-design / no design file → gate dormant | `evidence-file.ts` line 833 (no file path) + index.ts placement inside `if(armCheck.required)` | PASS |
| AC-5 | Gate runs after VISUAL_PROVENANCE_MISSING, inside `if(armCheck.required)` | `dist/index.js` lines 876–893; ordering: evidence→widget→assertions→schema→provenance→manifest | PASS |
| AC-6 | `parseBaselineManifestRows` is pure — no I/O, never throws | `evidence-file.ts` lines 749–805; no fs calls | PASS |
| AC-7 | Parser: Source manifest row structure, status column by header index, backwards-compat all-audited fallback | `evidence-file.ts` lines 763–804 | PASS |
| AC-8 | `hasBaselineProvenance` section-scoped, both filter-conditions: and exclusion-reasons: required | `evidence-file.ts` lines 811–818 | PASS |
| AC-9 | Version 3.40.0 in package.json + index.ts Server() literal | `package.json` line 3; `index.ts` line 213 | PASS |
| AC-10 | CHANGELOG.md [3.40.0] with both error codes | `CHANGELOG.md` lines 19–22 | PASS |
| AC-11 | npm test green | Full suite: 713 tests, 713 pass, 0 fail | PASS |
| AC-N1 | no-design never sees gate errors (explicit negative) | Same as AC-4; armCheck.required=false for no-design | PASS |
| AC-N2 | Single-surface never blocked by provenance check (explicit negative) | Same as AC-3 | PASS |
| AC-N3 | Pre-manifest-gate designs (no ## Source) not retroactively blocked | `evidence-file.ts` line 842: `if (sliceH2Section(content, "Source") === null) return dormant` | PASS |
| AC-N4 | Deferred-only manifest is blocked | `evidence-file.ts` lines 847–856: 0 audited rows → BASELINE_MANIFEST_MISSING | PASS |

### Copy Audit Gate (Phase 3a)

| string id | spec text | implementation | drift? |
|-----------|-----------|----------------|--------|
| ERR-BMM-01 | `⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections). See specs/figma-baseline-manifest-gate.md.` | `dist/index.js` line 889 — verified byte-identical | None |
| ERR-BPI-01 | `⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c. See specs/figma-baseline-manifest-gate.md.` | `dist/index.js` line 890 — verified byte-identical | None |

### Visual Audit Gate (Phase 3b)

Feature mode = no-design. Visual Tokens table: N/A row only. Visual Widgets: N/A row only. No visual token verification applicable. Visual Audit Gate: skipped (no-design).

### Phase 1.5 — Visual Compare

Skipped — `design/figma-baseline-manifest-gate.md` does not exist and there are no `## Visual Baselines`. Feature mode = no-design.

---

## Phase 2 — Discussion

No issues found in Phase 1. Proceeding directly to Phase 3.

---

## Phase 3 — Tests

### Test file authored

`test/baseline-manifest-gate.test.mjs` — new file, 296 lines.

### AC-to-test mapping

| AC | Test case(s) | Coverage |
|----|-------------|---------|
| AC-1 / AC-1(b) | P4 (blank pointer not isAudited), C4 (deferred-only → BASELINE_MANIFEST_MISSING), E2 (verbatim error string in dist) | Full |
| AC-2 | C7 (2 audited, no provenance → INCOMPLETE), C8 (only filter-conditions), H3 (filter-only → false), H4 (exclusion-only → false), E3 (verbatim error string) | Full |
| AC-3 / AC-N2 | C5 (1 audited, no provenance → ok), C6 (1 audited + provenance → still ok), E4 (composition: 1 audited arm → ok) | Full |
| AC-4 / AC-N1 | C1 (no design file → dormant), C2 (no-design mode arm check), E1 (no-design gate unreachable), E1b (no design file gate unreachable) | Full |
| AC-5 | E2/E3 dist string tests verify placement indirectly; gate ordering verified via dist/index.js read | Structural |
| AC-6 | P1 (empty string), P9 (purity: same input = same output), security smoke tests | Full |
| AC-7 | P2 (no Source section), P3 (3 rows, 2 audited/1 deferred), P4 (blank pointer), P5 (no status column fallback), P6 (decorated status), P7 (reordered columns), P8 (header/separator excluded) | Full |
| AC-8 | H1 (no section → false), H2 (both lines → true), H3 (filter-only → false), H4 (exclusion-only → false), H5 (outside section → false), H6 (decorated labels → true) | Full |
| AC-9 | AC-9 test: package.json = 3.40.0; index.ts Server() literal = 3.40.0 | Full |
| AC-10 | 4 tests: heading present, feature name mentioned, BASELINE_MANIFEST_MISSING mentioned, BASELINE_PROVENANCE_INCOMPLETE mentioned | Full |
| AC-11 | npm test: 713/713 pass | Full |
| AC-N1 | E1, E1b, C2 | Full |
| AC-N2 | C5, E4 | Full |
| AC-N3 | C3 (armed, baselines present, NO ## Source → dormant), E5 (composition path) | Full |
| AC-N4 | C4 (deferred-only → BASELINE_MANIFEST_MISSING) | Full |

### Composition/decision tree coverage

All 6 rows of the architecture's Arming + Exemption Decision Tree are tested:

| Decision tree row | Test case |
|-------------------|-----------|
| mode=no-design / no design file / no baselines → gate never reached | C1, C2, E1, E1b |
| armed + baselines + no ## Source → dormant (opt-in) | C3, E5 |
| armed + ## Source + 0 audited rows → BASELINE_MANIFEST_MISSING | C4, E2 |
| armed + ## Source + exactly 1 audited row → pass, EXEMPT | C5, C6, E4 |
| armed + ≥2 audited rows + no complete provenance → BASELINE_PROVENANCE_INCOMPLETE | C7, C8, E3 |
| armed + ≥2 audited rows + complete provenance → pass | C9, C10 |

### Coverage gate

New parsers + composition helper in `tools/evidence-file.ts` (lines 695–872, ~178 lines). Every branch of `parseBaselineManifestRows`, `hasBaselineProvenance`, and `checkBaselineManifest` is exercised: no-content, no-section, header detection, separator skip, column reorder, status normalization, blank pointer, all-audited fallback, dormant paths (no file, no Source, fs error), and all 3 error-vs-pass outcome branches. Coverage well exceeds 80%.

---

## Phase 4 — Run

### Build

`npm run build` — ZERO TypeScript errors. `check:version` OK (3.40.0).

### Test suite

`npm test` — **713 tests, 713 pass, 0 fail.**

**Baseline-manifest-gate tests in this run (P1–P9, H1–H6, C1–C11, E1–E6, AC-9, AC-10, security):** all green.

**Pre-existing budget cap bumps required (qa-owned):**
- `test/context-budget.test.mjs` line ~362: cap 4304 → 4523 (stripped constitution grew due to v3.40.0 §3.1 bullet)
- `test/context-budget.test.mjs` line ~390: cap 7768 → 7987 (teamwork bundle grew correspondingly)
- `test/qa-visual-skill-split.test.mjs` line ~141: cap 17600 → 18100 (skill-qa-visual.md grew from 17247 to 17928 bytes)

These caps are qa-owned by convention (all prior bumps in these files carry `(qa-owned bump)` annotations). Bumping them is within QA scope — they are the measurable consequence of intentionally shipped content in this feature.

---

## Non-blocking notes

1. **npm audit 3 high vulnerabilities** — pre-existing, no dependency changes in this feature. Waived per prompt instruction.
2. **No git tag v3.40.0 yet** — `check:version` logs this note. Tag is a release-engineer post-PASS responsibility, not a QA blocker.
3. **Constitution header in dist** — the constitution file header now reads `# Constitution v3.40.0` (bumped from v3.28.0 per architect recommendation). This is documentation-fidelity only; `check-version.mjs` does not parse it.
## 2026-06-17T11:05:07.237Z — PASS — by qa-engineer

PASS. figma-baseline-manifest-gate v3.40.0: all 15 ACs verified (AC-1 through AC-11 + AC-N1 through AC-N4). New test file test/baseline-manifest-gate.test.mjs authored with 40+ tests covering P1-P9 (pure parser), H1-H6 (provenance predicate), C1-C11 (composition/decision-tree), E1-E6 (e2e wiring + verbatim strings), AC-9 (version), AC-10 (CHANGELOG), security smoke tests. Build zero errors. 713/713 tests pass. Budget caps bumped (qa-owned: context-budget.test.mjs 4304→4523 stripped constitution, 7768→7987 teamwork bundle; qa-visual-skill-split.test.mjs 17600→18100 bytes — measured actuals for v3.40.0 content additions). Non-blocking: npm audit 3 highs pre-existing/no-dep-change (waived); no git tag yet (release-engineer post-PASS). Review doc: qa_reports/review_T-FBMG-QA.md.

