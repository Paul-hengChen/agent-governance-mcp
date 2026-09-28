<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E235B-01 architect: resolve Open Questions 1-3 (manifest worktree-column relative-path mechanism, render resolution, check/lane-status no-op confirmation) → specs/e235b-relative-manifest-worktree-architecture.md (note: QA verified specs/e235b-relative-manifest-worktree-architecture.md exists and is consistent with the shipped AC1-3 implementation, regression tests, and prior evidence. See qa_reports/review_T-E235B-01.md.)
- [x] T-E235B-02 sr: tools/fanout-manifest.ts format + render-resolution change per architecture; rebuild dist/tools/fanout-manifest.*
- [x] T-E235B-03 sr: sync docs/lane-protocol.md (+ content/skill-integrator.md only if architecture requires) to new worktree-column semantics
- [x] T-E235B-04 sr: one-time rewrite of 8 specs/fanout-*.md + specs/fanout-e235.md worktree columns to new format (AC6)
- [x] T-E235B-05 sr: E232 leftover — scrub 5 files (docs/agc-feedback-2026-09-08.md + 3 archived review/qa files + 1 qa_reports file), class description, prose lines only (AC7)
- [x] T-E235B-06 qa: rewrite test/fixtures/e177a/** + test/fixtures/e178b/** to match new format; regenerate render-e177a.golden.txt (AC6)
- [x] T-E235B-07 qa: update the 9 listed test/e17*|e223* files for new semantics; add AC3 regression test (relative-worktree manifest still passes check/lane-status)
- [x] T-E235B-08 qa: if content/** touched (AC5), regenerate test/fixtures/compose-golden/** + test/context-budget.test.mjs (note: N/A — content/** untouched, AC5 vacuous per architecture)
- [x] T-E235B-09 [E240 add-on] sr: tools/transitions.ts comment-only scrub + rebuild dist/tools/transitions.*
- [x] T-E235B-10 [E240 add-on] sr: CHANGELOG.md / NEW-TICKETS.md / docs/backlog.md / docs/v4.0.0-execution-plan.md — leaked-string lines only, no done-mark/ticket edits
- [x] T-E235B-11 [E240 add-on] sr: docs/agc-feedback-2026-09-08.md — 2 further leaked occurrences
- [x] T-E235B-12 [E240 add-on] sr: rename the short-form-named research/ file to a neutral name; update every reference across owned files + 3 named archive locations
- [x] T-E235B-13 [E240 add-on] sr: 8 named specs/ files (e106,e109,e110,e114,e180,e213 + 2 e73 acceptance records) — scrub leaked class
- [x] T-E235B-14 [E240 add-on] sr: qa_reports/ + review_reports/ evidence files carrying the leaked class — prose lines only
- [x] T-E235B-15 [E240 add-on] qa: scrub 4 named test files + test/fixtures/e177a/fanout-wave7.md, prose only
- [x] T-E235B-16 qa: final re-scan of full owned scope (core + add-on), both leaked-string forms, zero hits (AC8)
