# QA review — T100-T104 (Batch A)

## Round 1 — DEFERRED-TO-T109 — by qa-engineer

### Phase 1 — Review

Batch A is markdown-only framework changes (Constitution + 4 skill SOPs). No code paths, no Copy / Strings, no Visual Tokens for the feature `pixel-perfect-fixes-v3.14` itself — the feature IS the framework rule update.

- **Phase 1.3a Copy Audit Gate**: N/A — spec's *Copy / Strings* table contains only server error strings (`err.visual_evidence_missing`, `err.visual_widget_missing`) and SOP directive text (`sop.sr_engineer.phase_0_5`, `sop.pm.visual_widgets_intro`). These are framework-internal; the SOP text in `content/skill-sr-engineer.md:11-15` matches `sop.sr_engineer.phase_0_5` semantically (paraphrased to fit SOP grammar — this is acceptable per `authored-here` precedent). The server error strings are referenced for implementation in T107 (`tools/transitions.ts`), not Batch A.
- **Phase 1.3b Visual Audit Gate**: N/A — spec's *Visual Tokens* explicitly declares `N/A — 本 feature 純 framework 規約變更`.
- **Phase 1.5 Visual Compare**: skipped (no `design/pixel-perfect-fixes-v3.14.md` — feature has no UI surfaces). Logged here, no Read of `skill-qa-visual.md`.

### Phase 3 — Test File Discovery

The spec's task list designates **T109** as the dedicated test task covering Batch A + Batch B + Batch C combined:
> `T109 [P0] Tests: visual-evidence-gate / visual-round-transitions / widget-shape-spec / phase-0-5-sop | depends_on: T107`

Specifically `widget-shape-spec.test.mjs` and `phase-0-5-sop.test.mjs` are scoped to lint the SOP markdown produced by Batch A (skill-pm Visual Widgets section, skill-sr-engineer Phase 0.5 SOP). These tests cannot be written yet because they would assert against final-state markdown — and Batch B + C may still adjust adjacent clauses.

Per skill-qa-engineer **Conditional test writing** rule (Constitution §2): tests are planned in T109, scoped to one combined session per qa standard. Not creating duplicate per-batch tests.

### Phase 4 — Build

`npx tsc --noEmit` (run by sr-engineer at Batch A handoff): zero errors. No code changes, no audit needed.

### Verdict

**DEFERRED-TO-T109** (custom verdict — neither PASS nor FAIL):
- No regression: TS build clean, no code touched.
- No coverage gap to assert: tests for Batch A clauses are planned in T109 alongside Batch B/C.
- Routing back to sr-engineer (via Blocked status with `next_role: sr-engineer`) so the chain continues to Batch B (T105 + T106) without burning a PASS evidence cycle on framework-only changes.

This deviation from the strict Phase 4 PASS/FAIL dichotomy is justified by the multi-batch implementation structure declared in `specs/pixel-perfect-fixes-v3.14.md` Task Breakdown. T109 will produce the formal PASS evidence covering this batch.

— @qa-engineer
