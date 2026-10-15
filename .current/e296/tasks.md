<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E296-01 [P2] E296 (1): content/const-08-chain-31-mid.md §3.1 Cut-Approval Auto-Tier bullet gains the manifest tier (eight conditions + audit line `cut-approved: manifest-tier (<manifest path>, Decisions <date>)`, AC1); content/coord-03-core-fallback.md Auto-tier writer action gains the manifest-tier writer action (AC2) | depends_on: none
- [ ] T-E296-02 [P2] E296 (4)(8) + E309: content/skill-pm.md Spec Schema `## Cut` section + Gate Summary row Manifest-Tier Self-Attestation + Cut-Approval row sentence (AC3); docs/lane-protocol.md §5-2 pre-review before any approval write, `check --cut`, present to human only on failure (AC4); content/skill-integrator.md Stage 2 names the `approval` column + Stage 4 close-on-final-cut sentence (AC5) and Stage 6-4 BEHIND remedy → CI-first, one sentence (AC6, E309) | depends_on: none
- [ ] T-E296-03 [P2] E296 (5): tools/config.ts CutApprovalAutoTier.manifest (type, default false, strict === true parse) + rebuilt dist/tools/config.* (AC7); docs/config.md cutApprovalAutoTier field-table row `manifest` + Semantics note (AC8) | depends_on: none
- [ ] T-E296-04 [P2] E296 (3)(7): tools/fanout-manifest.ts optional 9th `approval` Lanes column (APPROVAL_VALUE_UNKNOWN, DispatchableLane.approval, LANE_PROVISIONAL text, render ignores it; AC9, AC10) + `check --cut <manifest> <lane> <spec>` runner over the spec's `## Cut` table (AC11) + USAGE line; scripts/fanout.mjs routes --cut and updates its header comment (AC12); rebuilt dist/tools/fanout-manifest.* | depends_on: none
- [ ] T-E296-05 [P2] qa: tests for AC1–AC12 (new test/e296-manifest-tier.test.mjs; re-pins in test/e5-intake-tiering.test.mjs, test/e177a-manifest.test.mjs, test/e177a-check-cli.test.mjs), compose goldens regenerated, four context-budget ceilings re-measured (R1, human-approved with the cut), full suite green on final HEAD (AC13) | depends_on: T-E296-01, T-E296-02, T-E296-03, T-E296-04
