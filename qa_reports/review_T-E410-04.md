covers: T-E410-01, T-E410-02, T-E410-03, T-E410-05, T-E413-01, T-E410-04

# QA review: e410-task-alias-content-tail (E410 + E413)

Implementation c216461, code review APPROVED at b840b0a. QA by qa-engineer (sonnet), Task-dispatched.

Phase 0.5: skipped (no expected-red manifest declared; the reds were enumerated in the spec pin-audit table, E408 precedent).
Phase 1.5: skipped (no Visual Baselines declared; no design file).
Phase 3.5: the spec's ACs carry `proof:` annotations; every proof is executed in the AC Execution Log below.

## Phase 1: Copy Audit Gate

All 16 Copy / Strings spans (c01.33, c05.9, c08.2, c08.5, c12.2, lite.43, lite.49, int.40, int.41,
int.78, int.81, int.177, int.181, int.248, pm.111, pm.109.new) were checked verbatim against
`git diff cd24f34 -U0 -- content/` and by the new tests (per row: new span present on its line, old span
absent). No drift; no user-facing string outside the spec. Visual Audit: N/A (no Visual Tokens).

## Phase 3: AC to test map

| AC | test |
|---|---|
| AC1 | test/e410-task-alias-content-tail.test.mjs: occurrence-level alias rule over const-*/skill-* = 0, plus a control test showing tasks.md lines are not excluded wholesale |
| AC2 | e410 per-row test (15 E410 rows), line-count test; e413 test (pm.109 exact string) |
| AC3 | e410 AC3 test: per-row new <= old for all 16 rows (per-row sum is -74; the spec prose "-78" is a known slip, not asserted) |
| AC4 | review-time numstat (below) |
| AC5 | e410 AC5 test (coord-02 alias once, const-01 two table rows, const-05 (c) starts `otherwise`) + e43/e403/e408 green + coord-* diff exit 0 |
| AC6 | test/e413-pm-question-batch-inline.test.mjs (incl. line 111 prohibition intact) |
| AC7 | e178a (lines 89, 287, 292), e285 (81), e288 (31 PERM_ROW, 64, title at 113), e329 (46) re-pinned; only the pinned literals/title changed |
| AC8 | goldens re-captured, below |
| AC9 | budget re-measure, below |
| AC10 | final suite, recorded in the state write |

Resident-test hygiene: new tests read content/** only; no specs/fanout-* assertions; no fixed-sha diff.

## AC8: goldens (exactly 11 moved; skill-coordinator-monolith.txt unchanged at 45783 bytes)

Every hunk is a one-line span swap; word-diffed and confirmed:

- build-full-{nondesign,design}{,-fd}.txt, hook-full.txt, constitution-monolith.txt (6 files, 5 hunks each):
  const-01:33 (table row: `Task-spawned ... (`Task(subagent_type=...)`)` -> `Subagent-dispatched ...`),
  const-05:9 (`Task-dispatched` -> `dispatched`), const-08:2 and const-08:5 (`Task-subagent` -> `subagent`),
  const-12:2 (`` `Task` fan-out `` -> `subagents`).
- build-lite-{nondesign,design}{,-fd}.txt, hook-lite.txt (5 files, 2 hunks each): const-01:33 and const-05:9
  only (lite composition excludes const-08/12).
- Sizes match the spec table (e.g. build-lite-nondesign 16911 -> 16885; build-full-nondesign 34178 -> 34137;
  hook-full / constitution-monolith 43857 -> 43816).

## AC9: budgets (chars/4, measured on cd24f34 vs this tree; no cap literal edited)

| measure | before | after | cap |
|---|---|---|---|
| lean always-on | 5682 | 5675 | 5723 |
| stripped constitution (design arm) | 10475 | 10466 | 10598 |
| non-design constitution | 8476 | 8466 | 8501 |
| teamwork bundle | 21408 | 21398 | 21715 |
| skill-pm stripped body | 4849 | 4847 | 4849 |

`git diff --exit-code cd24f34 -- test/context-budget.test.mjs` exits 0.

## AC Execution Log

- AC1/AC2/AC3/AC5/AC6 (e410 + e413 tests): `node --test test/e410-task-alias-content-tail.test.mjs test/e413-pm-question-batch-inline.test.mjs` green.
- AC4: `git diff --numstat cd24f34 -- content/` = const-01 1/1, const-05 1/1, const-08 2/2, const-12 1/1, skill-coordinator-lite 2/2, skill-integrator 7/7, skill-pm 2/2 (exactly seven files).
- AC5: `git diff --exit-code cd24f34 -- 'content/coord-*.md'` exit 0.
- AC7: e178a / e285 / e288 / e329 green after re-pin.
- AC8: `git diff --stat -- test/fixtures/compose-golden/` names the 11 files; skill-manifest / compose-equivalence / e90 / render-structure green (in the full suite).
- AC9: context-budget 54/54 green.
- AC10: see the suite-result line recorded by the server on the PASS write.
## 2026-11-05T08:41:09.843Z — PASS — by qa-engineer

suite-result: 4040/4042 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. All 16 Copy/Strings spans verified verbatim; new e410 (AC1 occurrence-level alias rule = 0, per-row AC2/AC3, AC5) and e413 (AC2/AC6) tests green; e178a/e285/e288/e329 re-pinned (literals/title only); exactly 11 goldens moved (5 hunks x 6 full/hook/monolith, 2 hunks x 5 lite), skill-coordinator-monolith unchanged, every hunk a one-line span swap; five budgets before->after: lean 5682->5675 (cap 5723), stripped const 10475->10466 (10598), non-design 8476->8466 (8501), teamwork 21408->21398 (21715), skill-pm 4849->4847 (4849), no cap edit; AC4 numstat = the seven files; coord-* diff exit 0; dist/ clean; check:bookkeeping 0; npm audit 0. Final full suite on clean HEAD ea79a2a: 4040 pass, 0 fail, 2 skipped, of 4042. Evidence: qa_reports/review_T-E410-04.md. Phase 0.5, 1.5 skipped (none declared).

