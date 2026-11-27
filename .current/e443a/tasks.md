<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E443A-01 [P0] qa-engineer: write test/e443a-wave-columns.test.mjs (A1-1..A1-3), test/e443a-wave-compare.test.mjs (A1-4..A1-7), test/e443a-integrator-sop.test.mjs (A1-8), test/e443a-batch-render.test.mjs (A1-9..A1-11) + fixtures under test/fixtures/e443a/; record qa_reports/validate-baseline_e443a-manifest-waves.txt at base; re-pin e423 AC12, e428 base hash, e292 AC-E292-9, e296 AC12 per spec Test impact; write qa_reports/expected-red_e443a-manifest-waves.txt | depends_on: none
- [ ] T-E443A-02 [P0] sr-engineer: 波次 column (after 相依) and restricted 相依 checks in tools/fanout-manifest.ts per spec I1 (four header shapes, approval read by position, wave/depLanes, WAVE_NOT_INTEGER / DEPS_* row errors) + build (A1-1, A1-2, A1-3) | depends_on: T-E443A-01
- [ ] T-E443A-03 [P0] sr-engineer: ticketIds splitter, ticket-file lookup and render --batch in tools/fanout-manifest.ts per spec I2/I3 (derived batch template, title/reading from ticket files, --batch parsing, usage line) + build; hand-started render byte-identical (A1-9, A1-10, A1-11, A1-12) | depends_on: T-E443A-01
- [ ] T-E443A-04 [P0] sr-engineer: waves comparison in new tools/fanout-waves.ts + route and header comment in scripts/fanout.mjs + usage line per spec I4 (wave-table parse, three conditions, outputs, exit 0/1/2) + build (A1-4, A1-5, A1-6, A1-7) | depends_on: T-E443A-02, T-E443A-03
- [ ] T-E443A-05 [P1] sr-engineer: integrator SOP text in content/skill-integrator.md — SOP_STAGE1_WAVES (end of Stage 1 step 6 line) and SOP_STAGE2_WAVES (Stage 2 exception) verbatim from the spec's Copy / Strings blocks (A1-8) | depends_on: T-E443A-01
