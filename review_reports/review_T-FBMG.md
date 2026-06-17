# Code Review — T-FBMG-01 / T-FBMG-02 (figma-baseline-manifest-gate, v3.40.0)

> Reviewer: code-reviewer (opus) — clean-context (spec + architecture + diff only)
> Base: HEAD (staged + working tree). Build: `npm run build` ZERO tsc errors; `check:version` OK (3.40.0).

## Summary

- Adds the SIXTH/last visual sub-gate: pure parsers `parseBaselineManifestRows()` + `hasBaselineProvenance()` and fs composition `checkBaselineManifest()` in `tools/evidence-file.ts` (pure append, lines 692–872), wired into `index.ts` (line 970) inside `if (armCheck.required)` after `VISUAL_PROVENANCE_MISSING`.
- Arming/exemption decision tree behaves EXACTLY per the AC matrix: no-Source→dormant (AC-N3), 0 audited→`BASELINE_MANIFEST_MISSING`, 1 audited→provenance-EXEMPT pass (AC-3), ≥2 audited→require both provenance lines else `BASELINE_PROVENANCE_INCOMPLETE` (AC-2). Verified by live behavioral execution of the built dist.
- Error strings are BYTE-IDENTICAL to spec ERR-BMM-01 / ERR-BPI-01 (programmatic verbatim diff: both match), selected by `manifest.code`.
- Surgical: `evidence-file.ts` pure append (no edits to existing exports, no duplication of `sliceH2Section`/`designFilePath`); `index.ts` sole deletion is the version literal; constitution = header bump + 1 bullet inside `<!-- design-only -->`. Reuses existing `armCheck` (no re-arm).
- Strict typing clean: no `any`, no non-null assertions, no unguarded undefined index in the new code.
- **Headline verdict: APPROVED.**

## Correctness

- `tools/evidence-file.ts:752` `parseBaselineManifestRows` — `if (!content) return [];` then `sliceH2Section(content,"Source") === null → []`. AC-6 purity (no I/O) and AC-2/N3 dormancy entry both correct. Verified P2 (no Source → `[]`).
- `evidence-file.ts:772-787` header detection — first `|`-line containing a `/^status$/` cell sets `statusIdx`/`pointerIdx`/`mediumIdx`; separator rows excluded via `/^\|[\s:|-]+\|?$/`. P7 (reordered headers `status|medium|pointer`) resolves status by header index, not position — verified (`audited`, pointer `1:2`, isAudited true).
- `evidence-file.ts:789` `noStatusColumn` backwards-compat — all rows treated audited (AC-7). Header row (first cell `medium`/`pointer`/`node-id`) skipped via the `noStatusColumn` heuristic at line 802. Verified P5 (1 data row, not 2).
- `evidence-file.ts:812` `isAudited = status === "audited" && pointer.trim().length > 0` — AC-1(b) blank-pointer exclusion verified (P4 → isAudited false).
- `checkBaselineManifest` decision tree (lines 845-872) — all branches executed live and match the AC matrix: N3 dormant, 0-audited MISSING, 1-audited EXEMPT pass (the single-surface false-positive case the prompt flagged as a release regression — confirmed CLEAN: returns `ok:true, code:null`), 2-audited-noprov INCOMPLETE, 2-audited+both-lines pass.
- `hasBaselineProvenance` section-scoping (line 837) — H5 verified: a stray `filter-conditions:`/`exclusion-reasons:` OUTSIDE the `## Baseline Selection Provenance` section returns `false`. Load-bearing; correct.
- Dormant-case regression (the other prompt-flagged risk): no `## Source` section → `checkBaselineManifest` returns dormant before parsing (line 862). Verified. Every pre-v3.40.0 design doc is safe.

## Quality

- Naming consistent with file conventions (`parse*Rows`, `has*`, `check*`; `BaselineManifestRow`/`BaselineManifestCheck` mirror `VisualProvenanceCheck`). No dead code.
- `splitTableCells`/`normalizeStatus` are new private helpers; `splitTableCells` duplicates the inline cell-split logic of `parseAssertionFailures`/`parseRegionDiffFailures` rather than extracting a shared helper. NOTE (LOW): minor opportunity to consolidate the cell-split across the three callers, but the architecture spec explicitly directed "reuse the EXACT cell-splitting logic already proven" by re-implementing the same shape, and a cross-cutting refactor would exceed §1 surgical scope. Acceptable as-is.
- Comments accurately describe the gate; AC references are correct.

## Architecture

- Matches `specs/figma-baseline-manifest-gate-architecture.md` exactly: result shape `{ok,code,detail,designPath,auditedCount}`; placement as last statement inside `if (armCheck.required)` after the provenance block; verbatim error strings switched on `code`; `mode != no-design` NOT re-checked in the helper (enforced by call-site placement). AC-1(a)/AC-N3 reconciliation implemented per the pinned decision (Source-absent ⇒ dormant). No schema bump (correct — reads a non-versioned artifact). Item (b) cross-reference correctly absent (deferred).

## Security

- Read-only fs (`fs.existsSync` + `fs.readFileSync` wrapped in try/catch → dormant on error). No injection vector: error strings are static templates; `detail`/`auditedCount` are never interpolated into user-facing output (correct — AC exact-match strings stay green). `designFilePath` reuse confines path construction to the existing validated helper. No secrets.

## Performance

- No regression. `checkBaselineManifest` reads the design file once; parsers are single-pass line scans over one H2 section. No loops in a hot path, no unbatched I/O, no listeners/caches. Complexity O(lines-in-Source-section). Equivalent profile to the sibling v3.38.0 provenance gate.

## Notes (non-blocking, recorded for transparency)

- **Substring status match**: a status cell of `unaudited`/`not audited` normalizes to `audited` (contains the substring). This is the architecture-pinned permissive behavior (spec line 116-119: "Substring match, not exact ... tolerant of operator decoration"), intended to never false-positive on decorated `audited ✅`. The design-auditor template never emits `unaudited`. Within contract; note only.
- **Status-less table with a non-standard header** (e.g. `| surface | id |`) counts the header as a data row (all-audited fallback). This is the documented AC-7 fallback that "favours not blocking legitimate-but-quirky designs." The real template always carries a `status` column (header-detection path), so this edge cannot trip on conforming designs. Within contract; note only.
- **Version-bump trail**: sr pending_notes say `3.39.0→3.40.0`; actual diff is `3.38.0→3.40.0` because 3.39.0 (figma-baseline-mechanical-selection) was SOP-only and never bumped package.json. The CHANGELOG backfills BOTH `[3.39.0]` and `[3.40.0]` accurately. Final state correct (3.40.0 everywhere). Harmless.
- Same-model bias: reviewed on opus; sr-engineer model unknown — no same-model-bias concern flagged.

## Round 1 — APPROVED — by code-reviewer

The arming/exemption decision tree is correct on every branch (verified by live execution of the built dist), the single-surface exemption does NOT false-positive, the dormant/backwards-compat case is preserved, parsers are pure and never throw, error strings are verbatim, wiring is correctly nested and cannot fire on no-design features, typing is strict, and the change is surgical. Tests are qa-engineer scope (not run here). **Verdict: APPROVED.**
