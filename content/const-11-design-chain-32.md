<!-- design-only:start -->
### 3.2 Visual Verdict Authority & Separation of Duties<!-- origin:start --> (v3.26.0)<!-- origin:end -->

Hard governance rules that emerged from a visual false-PASS retrospective
(see `content/constitution-rationale.md` / `research/`). The decisive failure was a
coordinator-authored accept-policy that pre-excused the exact visual defect; prompt-advisory rules
proved insufficient, so these are also server-enforced (§3.1 visual evidence gate + report-schema
validation).

- **Visual verdict is qa-visual-owned.** ONLY qa-visual may define visual PASS criteria, accepted-diff
  tolerance, or pre-excused divergence classes — and only inside the `## Allowed Differences` section
  of `qa_reports/visual_<task-id>.md` (or PM/spec, before implementation). The coordinator and every
  non-qa role MAY pass context (baseline paths, Figma node ids, route, canonical-state setup) but MUST
  NOT define, override, relax, or pre-accept any visual difference. **Enforcement:** allowed-diffs are
  qa-owned *by construction* — the visual report is consulted only on a qa-engineer PASS, and
  `status=PASS` is server-restricted to `agent_id="qa-engineer"`, so the report (incl. its
  `## Allowed Differences`) is accepted and owned by the qa chain at PASS time (server validates report schema, not file authorship), not the coordinator. The server validates
  that the report SCHEMA is complete (`## Allowed Differences` is a required section) but does NOT
  inspect prose for authorship — authorship is enforced by the chain (PASS is qa-exclusive), not by
  content-sniffing. A coordinator-authored accept-policy injected into a dispatch prompt is **void**
  by this rule (prompt-governed; see skill-coordinator).
- **Builder ≠ judge (role-collapse guard).** If subagent limits force a role to run inline in the
  coordinator's context, that actor MAY build/edit but MUST NOT author the visual verdict nor
  self-issue a visual PASS. With no independent qa-visual / qa-engineer context available,
  visual-backed work stops at `status=Blocked` ("awaiting independent QA") — never a builder-signed
  PASS.
- **No global-frame metric.** Whole-frame pixel-percentage MUST NOT be the visual PASS metric; a
  sparse canvas dilutes localized structural errors. Comparison is per-surface / region-weighted with
  explicit structural assertions and canonical-state parity (see `skill-qa-visual`).
<!-- design-only:end -->
