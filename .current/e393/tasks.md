<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E393-01 [P0] sr-engineer: AC-A1, AC-A2, AC-B01, AC-C01, AC-D1 (if approved) + approved budget trims t1/t2/t3/w1/w3 (w2 only if ownership widened) — const-05 §3-end bullet, const-11 bullet removal, const-04 (c), const-01 Limits visual_split row + header. Spec: specs/e393-builder-judge-core.md | depends_on: none
- [ ] T-E393-02 [P0] sr-engineer: citation retargets AC-B02–AC-B07 — coord-02:1, coord-03:39, coord-05:3, coord-07:11, skill-integrator:51,166 → "§3 builder ≠ judge". Spec: specs/e393-builder-judge-core.md | depends_on: T-E393-01
- [ ] T-E393-03 [P1] sr-engineer: AC-B10–AC-B15, AC-C16 — templates/agent-adapters/claude.md:12 and CLAUDE.md:233 (byte-identical), constitution-rationale.md :10, :131-137, :165, :184-185 (:7 unchanged). Spec: specs/e393-builder-judge-core.md | depends_on: T-E393-01
- [ ] T-E393-04 [P1] sr-engineer: G2-21 constitution sites AC-C02–AC-C08 (+ trim t4 if approved) — const-06:8, const-08:12, const-09:2-3, const-12:13,16-18. Spec: specs/e393-builder-judge-core.md | depends_on: T-E393-01
- [ ] T-E393-05 [P1] sr-engineer: AC-B08, AC-B09, AC-C09–AC-C15 (+ trims t5/t6 if approved) — skill-sr-engineer:26,28,51; skill-qa-visual:12,83,99; skill-qa-engineer:66,91,113 (66+113 renamed together). Spec: specs/e393-builder-judge-core.md | depends_on: T-E393-01
- [ ] T-E393-06 [P0] qa-engineer: AC-E1, AC-F1–AC-F4 — re-capture 12 compose-golden fixtures with hunk notes; re-pin context-budget (:658, :712, :1022), e178a:83, e391:91-94, e5:385, e96:52, phase-0-5:67; budget re-measure, ceiling change only as the human ruled (incl. sr cap :502); author test/e393-builder-judge-core.test.mjs; full suite under test-lock; dist no diff. Spec: specs/e393-builder-judge-core.md | depends_on: T-E393-02, T-E393-03, T-E393-04, T-E393-05
