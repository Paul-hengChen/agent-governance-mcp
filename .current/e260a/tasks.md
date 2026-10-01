<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E260A-01 [P0] sr-engineer: write .current/e260a/prove-neutral.mjs and .current/e260a/measure.mjs per specs/e260a-tools-a-h.md "Verification scripts"; create specs/e260a-tools-a-h-rationale.md skeleton; prove AC1 and both scripts green on the untouched tree (AC12) | depends_on: none
- [x] T-E260A-02 [P1] sr-engineer: trim comments in tools/handoff-orchestrator.ts base lines 1-531 (8 blocks, 124 lines; incl. L1 28, L216 22) per specs/e260a-tools-a-h.md trim rule | depends_on: T-E260A-01
- [x] T-E260A-03 [P1] sr-engineer: trim comments in tools/handoff-orchestrator.ts base lines 532-1015 (9 blocks, 142 lines; incl. L787 36) per specs/e260a-tools-a-h.md trim rule | depends_on: T-E260A-02
- [x] T-E260A-04 [P1] sr-engineer: trim comments in tools/handoff-orchestrator.ts base lines 1016-end (14 blocks, 181 lines; incl. L1247 38, L1692 21) and remove the ## heading comment near base L1051 (AC10) | depends_on: T-E260A-03
- [x] T-E260A-05 [P1] sr-engineer: trim comments in tools/handoff-write.ts (18 blocks, 220 lines) per specs/e260a-tools-a-h.md trim rule | depends_on: T-E260A-01
- [x] T-E260A-06 [P1] sr-engineer: trim comments in tools/handoff-types.ts (12 blocks, 148) and tools/handoff.ts (1 block, 15; keep the test-pinned @deprecated substrings, AC7) | depends_on: T-E260A-01
- [x] T-E260A-07 [P1] sr-engineer: trim comments in tools/handoff-parse.ts (8 blocks, 87), tools/drift.ts (6, 74), tools/evidence-file.ts (3, 34) | depends_on: T-E260A-01
- [x] T-E260A-08 [P1] sr-engineer: trim comments in tools/feature-rollup.ts (4 blocks, 65; keep SEAM FOR E132), tools/evidence-lookup.ts (2, 66), tools/exemptions.ts (1, 47), tools/hygiene-scan.ts (1, 25) | depends_on: T-E260A-01
- [x] T-E260A-09 [P1] sr-engineer: trim comments in tools/config.ts (3 blocks, 48), tools/fanout-manifest.ts (3, 52; keep PROMPT_TEMPLATE_3B doc-comment pins), tools/gate-stats.ts (2, 47), tools/dispatch-log.ts (1, 25; // style only) | depends_on: T-E260A-01
- [-] T-E260A-10 [P1] sr-engineer: Generic-citation sweep of the ten tools/comment-*.ts files; npm run build and stage dist/tools/[a-h]* share; run prove-neutral.mjs, measure.mjs --check and --citations over the full range | depends_on: T-E260A-02, T-E260A-03, T-E260A-04, T-E260A-05, T-E260A-06, T-E260A-07, T-E260A-08, T-E260A-09 (voided: Integrator pre-review (to-lane#1): covers 10 files, over the task_size budget of 5 files; re-cut as T-E260A-11 + T-E260A-12 (5 comment-*.ts files each, dist rebuild + full-range proof in the second).)
- [x] T-E260A-11 [P1] sr-engineer: Generic-citation sweep of tools/comment-lang-c.ts, tools/comment-lang-hash.ts, tools/comment-lang-js.ts, tools/comment-lang-nested.ts, tools/comment-langs.ts | depends_on: T-E260A-02, T-E260A-03, T-E260A-04, T-E260A-05, T-E260A-06, T-E260A-07, T-E260A-08, T-E260A-09
- [x] T-E260A-12 [P1] sr-engineer: Generic-citation sweep of tools/comment-lex.ts, tools/comment-python.ts, tools/comment-scan.ts, tools/comment-tags.ts, tools/comment-types.ts; npm run build and stage dist/tools/[a-h]* share; run prove-neutral.mjs, measure.mjs --check and --citations over the full range | depends_on: T-E260A-11
