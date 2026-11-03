<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E394-01 [P1] architect: specs/e394-release-sop-rewrite-architecture.md — exit-code table + class prefixes, phase split + inputs, dry-run/runner seam, absorption table, 69-id lesson table, narrative-unit list, SOP outline (AC-S1..S9, L1, P4, P10) | depends_on: none
- [ ] T-E394-02 [P1] sr-engineer: scripts/release.mjs skeleton — CLI, phases, --dry-run recorder, array-argv runner seam, exported exit table, preconditions incl. scope rule + check-version.mjs call (AC-S1, S2, S3, S9) | depends_on: T-E394-01
- [ ] T-E394-03 [P1] sr-engineer: scripts/release.mjs step 7a evidence archive in Node (AC-S4) | depends_on: T-E394-02
- [ ] T-E394-04 [P1] sr-engineer: scripts/release.mjs steps 7b-7d — driftBaselineIds, backlog done-mark + check-bookkeeping.mjs, adapter stamps + agc check (AC-S5) | depends_on: T-E394-03
- [ ] T-E394-05 [P1] sr-engineer: scripts/release.mjs step 8a staging list + existence pre-filter, feature-dir and root-file completeness, CHANGELOG citation check (AC-S6) | depends_on: T-E394-04
- [ ] T-E394-06 [P1] sr-engineer: scripts/release.mjs step 8a post-commit spec classes (REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE), commit, push -u release branch, gh pr create (AC-S6) | depends_on: T-E394-05
- [ ] T-E394-07 [P1] sr-engineer: scripts/release.mjs publish phase 8b-9a — strict CI gate, tag-exists stop, merge --auto --merge, ff pull + oid assert, tag, gh release, self-check (verify-release.mjs only if architecture names an export) (AC-S7, S9) | depends_on: T-E394-06
- [ ] T-E394-08 [P1] sr-engineer: scripts/release.mjs close-out phase 13a-13b — lane via resolveCurrentLane, bookkeeping branch/commit/PR/merge, --close-out two failure classes (AC-S8) | depends_on: T-E394-07
- [ ] T-E394-09 [P1] sr-engineer: specs/release-sop-history.md — move the architecture-enumerated narrative units verbatim with provenance header (AC-P10) | depends_on: T-E394-08
- [ ] T-E394-10 [P1] sr-engineer: rewrite content/skill-release-engineer.md whole, <= 15000 bytes by wc -c (AC-P1..P9, H5, H6, H8) | depends_on: T-E394-09
- [ ] T-E394-11 [P1] qa-engineer: test/e394-release-script.test.mjs — contract, dry-run, verb allow-list, phases, S-class lessons (AC-S1..S9, L1) | depends_on: T-E394-10
- [ ] T-E394-12 [P1] qa-engineer: re-pin test/release-staging.test.mjs — executed fragments to the script, prose to SOP/history (AC-S4, S6, P4, P6, P7, P10) | depends_on: T-E394-10
- [ ] T-E394-13 [P1] qa-engineer: re-pin group A — feature-lease, e18-write-provenance, verify-release (VR-9/VR-10 only), e130-lane-default, e336-portable-pull, e297-main-protected-sop (AC-P3..P7, S3, S6..S8, H1) | depends_on: T-E394-10
- [ ] T-E394-14 [P1] qa-engineer: re-pin group B — render-structure, e166-template-defers-staging, e164-e167-content; e295 + skill-evolution-v3.11 expected unedited; qa-flow comment only (AC-P1, P3, P4, P6, P9, S6) | depends_on: T-E394-10
- [ ] T-E394-15 [P1] qa-engineer: test/e394-release-sop.test.mjs — structure, size, rules, Escalation bijection + valid next_role, history anchors, 69-id meta-assertion (AC-P1..P8, P10, H5, H6, L1) | depends_on: T-E394-10
- [ ] T-E394-16 [P1] qa-engineer: hard conditions H1-H8 + full suite under node scripts/test-lock.mjs -- npm test on final HEAD, evidence (AC-H1..H8, T1, T2) | depends_on: T-E394-11, T-E394-12, T-E394-13, T-E394-14, T-E394-15
