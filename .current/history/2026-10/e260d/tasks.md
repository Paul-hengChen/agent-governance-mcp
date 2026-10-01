<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E260D-01 [P0] sr-engineer: write .current/e260d/proof.mjs (emit/tokens/scope/long-block/bare-id/form checks per specs/e260d-core-dirs-comment-trim.md) and the skeleton of specs/e260d-comment-rationale.md; run proof at base (expect 0 files) | depends_on: none
- [x] T-E260D-02 [P1] sr-engineer: trim comments in gates/{feature-lease,lease-override,stamp-provenance,cut-approval,scope-decision}.ts (5 files, 7 long blocks, 3 over 20 incl. the 87-line max); rationale to spec; proof + rebuild + commit with dist | depends_on: T-E260D-01
- [x] T-E260D-03 [P1] sr-engineer: trim comments in gates/{ac-execution,code-review,evidence-schema,expected-red,qa-review}.ts (5 files, 8 long blocks, 3 over 20); proof + rebuild + commit with dist | depends_on: T-E260D-01
- [x] T-E260D-04 [P1] sr-engineer: trim comments in gates/{registry,pipeline,external-refs}.ts (3 files, 12 long blocks, 5 over 20); keep the 33 mapping rows above GATE_REGISTRY byte-identical (decision D1); proof + rebuild + commit with dist | depends_on: T-E260D-01
- [x] T-E260D-05 [P1] sr-engineer: trim comments in gates/visual.ts and index.ts (2 files, 12 long blocks of 8-20); proof + rebuild + commit with dist | depends_on: T-E260D-01
- [x] T-E260D-06 [P1] sr-engineer: trim comments in prompts/{build,constitution-manifest,partials-manifest,skill-manifest,text-transforms}.ts (5 files, 14 long blocks, 3 over 20); comments only, no prompt strings; reword retired-constitution path mentions; proof + rebuild + commit with dist | depends_on: T-E260D-01
- [x] T-E260D-07 [P1] sr-engineer: trim comments in lib/{render-boundary,tsconfig-source-dirs,watermark-check}.ts and schema/{migrations-handoff,migrations-sqlite}.ts (5 files, 13 long blocks, 2 over 20); then run the lane-wide proof against base on all changed files | depends_on: T-E260D-01
