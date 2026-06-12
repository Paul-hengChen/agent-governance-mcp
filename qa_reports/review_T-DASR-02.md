# QA review — T-DASR-02

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-06-12T06:28:11.793Z — PASS — by qa-engineer

PASS — design-asset-source-rule / constitution v3.28.0. All 5 ACs verified:
AC-1: content/skill-design-auditor.md line 69 — Asset export + manifest (v3.28.0) subsection added; download_figma_images MCP call mandated per fetch-based mode; asset manifest table (Figma node-id | exported file path | usage/widget) recorded in design/<feature>.md; copy-auditor-manifest-header verbatim present.
AC-2: content/skill-sr-engineer.md line 27 — Source assets, don't redraw them (v3.28.0) added inside Design-Aware Pre-Flight; import mandate for auditor manifest assets; fidelity defect label on hand-authored SVG; CSS/geometric primitives carve-out retained; copy-sr-rule verbatim present.
AC-3: content/constitution.md line 19 — Design-sourced assets (v3.28.0) rule sits INSIDE the first design-only:start…design-only:end fence (L16–L20); copy-constitution-line verbatim present; test #64 non-design floor (2409 ≤ 2409) confirms stripDesignOnly removes it on non-design arm — fence placement correct.
AC-4: diff contains ONLY content/skill-design-auditor.md, content/skill-sr-engineer.md, content/constitution.md plus qa-owned test/context-budget.test.mjs; no CLAUDE.md, no .ts server files, no tier changes; package.json/index.ts untouched.
AC-5: constitution header reads # Constitution v3.28.0.
Re-baseline (test/context-budget.test.mjs — qa-owned per §2): 4 caps updated with rationale comments in the established qa-owned bump style:
  (1) AC2 lean always-on: 2600 → 2700 (measured 2641; lean applies stripChainOnly only, not stripDesignOnly; ~59-tok headroom)
  (2) AC2 skill-sr stripped: 2048 → 2210 (measured 2160; sr-skill growth from new rule; ~50-tok headroom)
  (3) AC8 design-arm constitution: 4239 → 4304 (measured 4304 exact; Phase-2 exact-value convention)
  (4) AC8 teamwork design-arm bundle: 7703 → 7768 (measured 7768 exact; Phase-2 exact-value convention)
Non-design floor (2409) and saving (1895 ≥ 1830) assertions unchanged and still pass.
Gates: npm run build ZERO errors; npm audit --audit-level=high pre-existing MODERATE hono non-gating; npm test 634/634 PASS (up from 45/45 on context-budget.test.mjs; full repo suite green).

