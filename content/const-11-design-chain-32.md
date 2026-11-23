<!-- design-only:start -->
### 3.2 Visual Verdict Authority & Separation of Duties<!-- origin:start --> (v3.26.0)<!-- origin:end -->

- **Visual verdict is reviewer-visual-owned.** ONLY `reviewer-visual`, code-reviewer's visual sub-skill, may define
  visual PASS criteria, accepted-diff tolerance, or pre-excused divergence classes — and only inside the
  `## Allowed Differences` section of `qa_reports/visual_<task-id>.md` (or PM/spec, before implementation).
  The coordinator and every other role MAY pass context (baseline paths, Figma node ids, route,
  canonical-state setup) but MUST NOT define, override, relax, or pre-accept any visual difference.
  **Enforcement:** allowed-diffs are the judge's *by construction* — the visual report is consulted only on
  the judge's PASS, and on the test-first chain `status=PASS` is server-restricted to
  `agent_id="code-reviewer"`, so the report (incl. its `## Allowed Differences`) is accepted and owned by
  code-reviewer at PASS time (server validates report schema, not file authorship), not the coordinator.
  The server validates that the report SCHEMA is complete (`## Allowed Differences` is a required section)
  but does NOT inspect prose for authorship — authorship is enforced by the chain (PASS is the judge's
  alone), not by content-sniffing. A coordinator-authored accept-policy injected into a dispatch prompt is
  **void** by this rule (prompt-governed; see skill-coordinator).
- **Measure first, judge over threshold.** Capture and pixel difference are executable checks the test
  author writes and sr-engineer passes before hand-off; `reviewer-visual` reads the baseline and impl
  images only for a surface over its threshold, and lists an over-threshold difference it accepts under
  `## Allowed Differences` with its reason — no human stop.
- **No global-frame metric.** Whole-frame pixel-percentage MUST NOT be the visual PASS metric; a
  sparse canvas dilutes localized structural errors. Comparison is per-surface / region-weighted with
  explicit structural assertions and canonical-state parity (see `skill-reviewer-visual`).
<!-- design-only:end -->
