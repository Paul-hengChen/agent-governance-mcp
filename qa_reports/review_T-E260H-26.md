<!-- covers: T-E260H-11, T-E260H-12, T-E260H-13, T-E260H-14, T-E260H-15, T-E260H-16, T-E260H-17, T-E260H-18, T-E260H-19, T-E260H-20, T-E260H-21, T-E260H-22, T-E260H-23, T-E260H-24, T-E260H-25, T-E260H-26 -->
# QA review: e260h-test-m-z-eval (E260 lane e260h), independent verification T-E260H-26

Spec: `specs/e260h-test-m-z-eval-comment-trim.md`. Base `bdbffaf`. Verifier: fresh qa-engineer Task context (opus), not an author. Detail, mutation probes, semantic sample and findings: `qa_reports/verify_E260H_T-E260H-26.md`.

## Phase notes
- Phase 0.5: skipped (no expected-red manifest declared).
- Phase 1, Copy and Visual Audit: the spec's Copy/Strings, Visual Tokens and Visual Widgets tables are all N/A, and the emit check proves no string changed.
- Phase 1.5: skipped (no Visual Baselines declared; no `design/` file).
- Phase 3: skipped. The dispatch brief's `Test-file placement` line says no test file is to be created or edited, and the lane is comment-only. Each AC is mapped to its declared proof below.

## AC Execution Log
All commands were run from the lane worktree root (`../agent-governance-mcp-lanes/e260h`). Suite runs were at `be7be65`, a clean committed tree.

| AC | command | raw result | verdict |
|---|---|---|---|
| AC1 emit | `node .current/e260h/proof.mjs --base bdbffaf` | `emit: 38 files, 0 differ`, exit 0 | pass |
| AC2 leaves | same | `leaves: 38 files, 0 differ` | pass |
| AC3 scope | same, plus `git diff --name-status bdbffaf..HEAD` | `scope: ok`; 38 `M` owned files; every other path is `A` under `specs/e260h-*`, `.current/e260h/**`, `qa_reports/*E260H*` or `review_reports/*E260H*`; render-structure, `test/fixtures`, `test/eval/fixtures`, context-budget, `dist`, `content` and source dirs show no diff | pass |
| AC4 >20 | same | `>20: 0`; own `analyzeText` scan at HEAD: largest block 7 | pass |
| AC5 8–20 | `node .current/e260h/proof.mjs --base bdbffaf --list-mid` | `8-20: 0 block(s)`, none listed; Retained-blocks table says none | pass (vacuous: nothing to justify) |
| AC6 rationale | `node scripts/check-md-tables.mjs` | `OK (474 file(s) scanned, 0 malformed tables)`, exit 0; 20 pointers, 20 matching sections, every pointer names a tracked path | pass (observation F2) |
| AC7 bare-id | proof script, plus a hand grep for `T-` ids | `bare-id: 0`; no id-only comment line of any family, `T-` included | pass (tool gap F3) |
| AC8 directives and form | proof script | `directives: ok`, `form: ok`; directive grep base against HEAD identical in all 38 files | pass |
| AC9 counts | `node scripts/test-lock.mjs -- npm test` at HEAD and at base (temp worktree under `$TMPDIR`, removed afterwards) | HEAD: tests 3043, pass 3040, fail 0, skipped 3. Base: tests 3043, pass 3040, fail 0, skipped 3. Sorted test-name lists identical (3044 lines each); skip lists identical | pass |
| AC10 clean tree, suite green | `git status --porcelain \| wc -l`, then `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` | `0`, then `exit=0` (4m53s); tree still clean after the run (the build leaves no `dist` diff) | pass |
| AC11 hygiene | proof script, plus a grep of added comment lines and both e260h specs | `hygiene: ok`; no home path, URL, sha, `git show` or `git log` in any added comment line | pass |

Vacuity probes: 10 deliberate edits in a throwaway worktree, each one caught by the matching check, and a failing run exits 1. Table in the detail file, section 2.

## Phase 4
Build: zero errors (`npm test`'s prebuild `tsc` ran clean). CI runnability: headless, no interaction. No red test, nothing re-baselined.

## Verdict
PASS. AC1–AC11 were re-derived independently and all hold. Findings F1 (a stale `dist/index.js` location carried into the rewritten `test/pixel-gate-attestation.test.mjs` header), F2 (the qa-flow rationale section has no pointer) and F3 (the proof's bare-id regex misses `T-` ids) are comment-accuracy and tooling observations. They are outside qa-engineer's FAIL scope and are passed to the coordinator, PM and integrator for a follow-up ticket.
