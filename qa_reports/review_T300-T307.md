# QA review — T300 + T301 + T302 + T303 + T304 + T305 + T306 + T307 (v3.15.0)

## Round 1 — PASS — by qa-engineer

### Phase 0 — Claimed

State advanced (code-reviewer, In_Progress) APPROVED → (qa-engineer, In_Progress).

### Phase 1 — Review

- **Copy Audit Gate**: spec lists 3 `authored-here` strings:
  - `err.visual_widgets_unverified.head` = `VISUAL_WIDGETS_UNVERIFIED` → grep confirms exact match in `tools/transitions.ts:48` (union entry) and `index.ts:750` (error text). ✓
  - `err.visual_widgets_unverified.hint` = "Unchecked widget row(s) in qa_reports/visual_<id>.md: <list>. Edit the visual report to mark each verified widget as [x] before retrying PASS." → implementation in `index.ts:748-752` enriches the literal with the dynamic `listing` (taskId-grouped). Pattern matches existing `MISSING_EVIDENCE` enrichment convention. Accepted (consistent with v3.14.0 / v3.14.1 enrichment).
  - `jsdoc.writestate.deprecated` → grep confirms verbatim in `tools/handoff.ts:280` (positional overload JSDoc) and approximation in `tools/storage.ts:42`. Accepted.
- **Visual Audit Gate**: N/A — framework / TypeScript changes only.
- **Phase 1.5**: `design/v3.15.0.md` does NOT exist; skipped per v3.14.0 absent-branch contract.

### Phase 3 — Tests

**Test File Discovery**: 2 new files + 1 existing extended.

**Spec-to-Test Map**:

| AC | Test |
|---|---|
| AC-1 (unchecked → reject) | `visual-widgets-unverified-gate.test.mjs` AC-1 × 2 |
| AC-2 (all checked → accept) | `visual-widgets-unverified-gate.test.mjs` AC-2 |
| AC-3 (missing section → accept, backwards-compat) | `visual-widgets-unverified-gate.test.mjs` AC-3 × 2 (+ empty-string defensive) |
| AC-4 (error envelope lists every offending row) | `visual-widgets-unverified-gate.test.mjs` AC-4 (multi-task aggregation) |
| AC-5 (permissive whitespace, strict bracket content) | `visual-widgets-unverified-gate.test.mjs` AC-5 × 5 ([x]/[X]/[Y]/[ ]/case-insensitive heading) |
| AC-6 (options-object overload) | `writestate-options-object.test.mjs` AC-6 × 2 (parity + all-fields-persist) |
| AC-7 (interface support both shapes) | Compiles cleanly via `tsc` (asserted by `npm run build` green) |
| AC-8 (index.ts handler uses options form) | `writestate-options-object.test.mjs` AC-8 (grep compiled dist/index.js) |
| AC-9 (@deprecated JSDoc present) | `writestate-options-object.test.mjs` AC-9 × 2 (handoff.ts + storage.ts) |
| AC-10 (backwards-compat defaults) | `writestate-options-object.test.mjs` AC-10 × 2 (8-arg positional + min options) |
| AC-11 (qa_round Round 4 `>= && <`) | `qa-flow.test.mjs` v3.15.0 AC-11 × 3 (normal + external-bump + post-cap) |
| AC-12 (review_round Round 4 `>= && <`) | `qa-flow.test.mjs` v3.15.0 AC-12 × 2 |
| AC-13 (sentinel wording unchanged) | `qa-flow.test.mjs` v3.15.0 AC-13 (grep index.ts) |
| AC-14 (build + tests) | this report's Phase 4 |
| AC-15 (audit waiver carries) | this report's Phase 4 |
| AC-16 (version bump) | T308 — sr-engineer scope |

**Coverage**: +27 new tests across 3 files; 0 regression. 371 (v3.14.1) → **398/398 passing**.

**Security Smoke Tests**:
- Boundary: empty input string (parser returns []); section bounded by next `## ` (later sections' checkboxes not misread); missing visual-report file (silent skip — defensive).
- Special characters: `[Y]`, `[a]`, `[1]`, `[ ]`, whitespace+tabs around dash.
- Path traversal: covered by existing v3.14.1 sanitiser tests (reuses `visualEvidencePath`).

### Phase 4 — Run

- `npm run build` — zero TS errors. ✓
- `npm test` — 398/398 passing. ✓ (Note: one transient flake on first run for `teamwork-lite.test.mjs AC3` — re-ran clean; suspected session-state cross-contamination from concurrent test setup; non-deterministic, isolated test passes consistently.)
- `npm audit --audit-level=high` — same waiver as v3.14.1 (allowlist mitigation framing). No change.
- CI runnability: headless.

### Verdict — PASS

T300-T307 all PASS. T308 (version bump + CHANGELOG + README) remains — sr-engineer scope.

— @qa-engineer
