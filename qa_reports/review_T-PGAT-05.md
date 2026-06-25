# QA review — T-PGAT-05

<!-- Auto-written by @qa-engineer for T-PGAT-05 (pixel-gate attestation tests) -->

## Phase 0 — Claim

QA claims review of T-PGAT-05. Feature: qa-visual-pixel-gate-attestation (v3.42.0).
Code-reviewer APPROVED (review_reports/review_T-PGAT.md). This is the final gate.

## Phase 1 — Review

### Implementation confirmed

- `tools/evidence-file.ts`: `DIFF_METRIC_PLACEHOLDERS` const (10 members), `isPlaceholderDiffMetric()` pure helper, `parsePixelGateAttestation()` pure helper, `checkPixelGateAttestation()` fs composition helper all present and exported. `VisualProvenanceRow` has new `pixelGateComplete: boolean` field. `checkVisualProvenance` tightened to use `isPlaceholderDiffMetric` for diff-metric rejection.
- `index.ts`: seventh gate wired at line 996–1030 inside `if (armCheck.required)`, after `checkBaselineManifest`. Version `3.42.0` confirmed in Server() literal and package.json.
- `tools/transitions.ts`: `"PIXEL_GATE_ATTESTATION_MISSING"` added to `TransitionRejection["error"]` union at line 75.
- Copy/Strings verified verbatim in `dist/index.js`.

### Copy Audit Gate (Phase 3a)

| string id | in dist/index.js | verdict |
|---|---|---|
| PIXEL_GATE_ATTESTATION_MISSING.error | YES — prefix + all clauses verified verbatim across concatenation lines | PASS |
| pixel_gate_complete.attestation_line | `'- pixel_gate_complete: true'` in error message | PASS |

No user-facing strings missing from spec.

### Visual Audit Gate (Phase 3b)

Feature is server-side enforcement only (spec Visual Tokens: N/A). No visual tokens. Gate skipped.

### Phase 1.5 — Visual Compare

No `design/qa-visual-pixel-gate-attestation.md`. Phase 1.5 skipped (no Visual Baselines declared).

## Phase 3 — Tests written

### New file: test/pixel-gate-attestation.test.mjs

52 tests covering all required ACs per spec.

AC → test mapping:

| AC | Tests | Coverage |
|---|---|---|
| AC-1 (placeholder diff-metric rejected) | PD1–PD11, AC-1 empirical blocks, AC-1 offense-names-value | FULL |
| AC-2 (attestation required) | CK2, CK3, CK8, E1–E5 | FULL |
| AC-3 (attestation shape — same label-line regex) | PA1–PA8, PR1, PR2 | FULL |
| AC-4 (carry-forward exempt) | CK4, PR3 | FULL |
| AC-5 (B1-fallback NOT exempt, diff-metric IS exempt) | CK5, CK6, PR4, AC-5 provenance pass | FULL |
| AC-7 (no-design / non-armed → dormant) | CK7 | FULL |
| AC-8 (legacy pre-provenance report → dormant) | CK1 | FULL |
| AC-9 (error messages actionable, version bump) | E1–E5, AC-9 version assertions, AC-9 CHANGELOG | FULL |
| AC-10 (pure parsers) | PA1, PD1 (doesNotThrow), security smoke tests | FULL |

### Modified existing tests

1. `test/baseline-manifest-gate.test.mjs` — AC-9 version assertions updated `3.40.1` → `3.42.0` (carried note from sr-engineer + code-reviewer).
2. `test/evidence-provenance.test.mjs` — AC-2 test updated offense string from `"no diff-metric:"` to `"invalid diff-metric value"` (behavior changed by v3.42.0 `checkVisualProvenance` tightening).
3. `test/qa-visual-skill-split.test.mjs` — AC-5 byte budget raised `18100` → `20700` to absorb AC-11 additions to `content/skill-qa-visual.md` (actual: 20180 bytes; headroom ~520 bytes).

## Phase 4 — Run results

```
npm run build   → ZERO errors (tsc clean)
npm test        → 779 tests, 779 pass, 0 fail
npm audit --audit-level=high → 1 HIGH (hono) — pre-existing, waived per §6
```

## Empirical gate verification

All AC gates verified to block false-PASS at the helper level:
- AC-2: surface with `baseline:` but no `pixel_gate_complete:` → `ok:false`, offense names surface
- AC-4: carry-forward surface (with armed sibling to opt-in) → `ok:true`
- AC-5: B1-fallback without attestation → `ok:false` (NOT exempt)
- AC-8: legacy report (no `baseline:`) → gate dormant `ok:true`
- AC-1: `N/A` diff-metric → `checkVisualProvenance` rejects with `"invalid diff-metric value"`

## Verdict

T-PGAT-05: PASS. All required ACs covered, zero test failures, build clean, audit waived for pre-existing hono HIGH.
## 2026-06-25T03:23:42.704Z — PASS — by qa-engineer

T-PGAT-05 PASS. Created test/pixel-gate-attestation.test.mjs (52 tests, full AC-1/2/3/4/5/7/8/9/10 coverage). Fixed 3 pre-existing test regressions from sr-engineer changes: (1) baseline-manifest-gate.test.mjs AC-9 version assertions 3.40.1→3.42.0; (2) evidence-provenance.test.mjs AC-2 offense string updated to match new isPlaceholderDiffMetric behavior; (3) qa-visual-skill-split.test.mjs byte budget 18100→20700 for AC-11 skill additions. npm run build: clean. npm test: 779/779 pass, 0 fail. npm audit --audit-level=high: 1 pre-existing hono HIGH waived per §6. Empirical gate verification: AC-2 blocks missing attestation, AC-4 carry-forward exempt, AC-5 B1-fallback NOT exempt, AC-8 legacy dormant, AC-1 N/A placeholder rejected. Evidence: qa_reports/review_T-PGAT-05.md.

