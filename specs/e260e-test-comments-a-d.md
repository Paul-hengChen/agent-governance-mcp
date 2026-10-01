# e260e-test-comments-a-d

Lane `e260e` of the E260 fan-out (wave 2, tests; shared rules in `specs/fanout-e260.md`, not restated here). Ticket E260. Task ids `T-E260E-01..06`. Base commit `bdbffaf`. Scope: comments only in the 28 owned test files listed below. Only qa-engineer edits `test/` (constitution section 2); the chain is the test-lane hand-off in the fan-out spec (qa authors, `qa-engineer:Blocked` = authoring done, pm, code-reviewer with `resume_of`, fresh Task-dispatched qa verifier writes PASS). No sr-engineer hop.

## Problem Statement
The owned test files carry long comment blocks written before the Comment discipline rule: 59 blocks of 8 or more counted lines across 27 of the 28 files (45 of 8–20 lines, 14 over 20, longest 53 in `test/agc-feature-lifecycle.test.mjs`). They bury the test intent and drift from the code. This lane trims them to the E260 threshold, moves rationale still worth keeping to a tracked spec, and proves by machine that nothing but comments changed.

Measurement note for the integrator: the fan-out table says 22 files, 41 mid blocks, 13 long blocks. Re-measured at base with the same counter (`analyzeText`, `dist/tools/comment-scan.js`), the 22 `test/{a,b,d,ch,com,conf,cons,cov,cu}*.test.mjs` files give exactly 41 and 13; the six `test/_*` helpers (named in the same Scope line) add 5 files with blocks (4 mid, 1 over 20, 28 files in all). This spec covers all 28; the totals above include the helpers.

## User Stories
- As a maintainer reading a test, I want a short comment that says what it checks and why, so that I can find the intent without a page of history.
- As a reviewer, I want a mechanical proof that only comments changed, so that a large comment-only test diff needs no line-by-line logic review.
- As a future editor, I want cut rationale findable from a one-line pointer.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `bdbffaf` (also in `.current/e260e/base-sha`; the script falls back to `--base <rev>`). Owned set = the 28 files in the measurement table.

- **AC1 (emit unchanged, human-mandated)**: Given every owned file that differs from BASE, when base and HEAD versions are each transpiled with TypeScript `transpileModule` (repo `tsconfig.json` options, `removeComments: true`, source maps and declarations off), then the two outputs are byte-identical.
  proof: `node .current/e260e/proof.mjs` prints `emit: <N> files, 0 differ`.
- **AC2 (tokens unchanged)**: Given the same files, when each version is parsed with `ts.createSourceFile` and its leaf tokens (kind and text, comments and whitespace excluded, JSDoc nodes excluded) are listed, then the lists are identical. This also proves no assertion, test name, assertion message or string changed.
  proof: `node .current/e260e/proof.mjs` prints `tokens: <N> files, 0 differ`.
- **AC3 (directive comments kept)**: Given the changed files, when `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`/`@ts-check`, `eslint-disable`/`eslint-enable`, `__PURE__` and `@vite-ignore` occurrences are counted in base and HEAD, then the counts are equal for every file.
  proof: `node .current/e260e/proof.mjs` prints `directives: <N> files, 0 count change(s)`.
- **AC4 (scope)**: Given the lane diff against BASE, then every changed path is either a modified (`M`, never added or removed) owned test file or bookkeeping (`specs/e260e-*`, `qa_reports/*E260E*`, `review_reports/*E260E*`, `.current/e260e/**`, `tasks.md`); nothing under `test/fixtures/**`, `test/context-budget.test.mjs`, any other `test/**`, source directories, `dist/**` or the fan-out's shared-forbidden list changed.
  proof: `node .current/e260e/proof.mjs` prints `scope: ok`.
- **AC5 (no block over 20 lines)**: Given the owned files at HEAD, when measured with `analyzeText`, then no comment block counts more than 20 lines. No exception is sanctioned in this lane.
  proof: `node .current/e260e/proof.mjs` prints `>20: 0 block(s)`.
- **AC6 (blocks of 8 to 20 lines trimmed or justified)**: Given the 8–20-line blocks the script lists at HEAD, when the review report is read, then each has either been cut to 7 or fewer counted lines or carries a one-line keep-reason in `review_reports/review_T-E260E-NN.md` of the task owning its file.
  proof: `node .current/e260e/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each against the report (soundness of a reason is a judgment call, so no single command decides it).
- **AC7 (rationale kept, comments point to it)**: Given a trimmed block whose rationale is not already in a tracked spec that the comment cites, then that rationale is in `specs/e260e-comment-rationale.md` under a heading named after the source file, and the comment keeps at most one pointer line. A comment that already cites a tracked spec holding the rationale needs only that pointer.
  proof: `grep -c 'specs/e260e-comment-rationale.md'` over the changed files cross-checked against the section list of that spec by the reviewer; `node scripts/check-md-tables.mjs` exits 0 after commit.
- **AC8 (Generic citation)**: Given comment lines in the owned files at HEAD, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may trail plain words), and no comment this lane touches cites an untracked path. A touched comment naming the retired single-file constitution describes it in words.
  proof: `node .current/e260e/proof.mjs` prints `bare-id: 0`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability.
- **AC9 (comment form preserved)**: Given every touched file, then it keeps its first line (`// Coded by @<role>` marker), `//` stays `//`, JSDoc stays JSDoc, no `/*!` or `/// <reference` line changes, the count of `/* */` block comments does not grow, and no comment contains a `##` heading.
  proof: `node .current/e260e/proof.mjs` prints `form: ok`.
- **AC10 (suite green)**: Given the final HEAD with a clean committed tree, when the full suite runs, then it passes. A red test is reported to the coordinator and integrator, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test` exits 0.
- **AC11 (whole-lane proof)**: Given the final HEAD, `node .current/e260e/proof.mjs` prints `proof: PASS` and exits 0.
  proof: `node .current/e260e/proof.mjs; echo "exit=$?"` ends `proof: PASS` and `exit=0`.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; string literals, test names and assertion messages are out of scope |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Assertions, test names, assertion messages, any string, `test/fixtures/**`, `test/context-budget.test.mjs` (lane e260i), all other `test/**`, source directories, `dist/**`.
- File-level comment ratio (`agc check` advisory); reported, not gated.
- Release bookkeeping (version, CHANGELOG, backlog done-mark): release-engineer and the integrator.
- Per the fan-out Decisions row (wave-2 premise re-check), no test reads another test's comment text, so there are no comment pins in this lane. The proof still compares AST leaves, and the full suite is the final judge.

## Dependencies / Prerequisites
Wave 1 merged (base `bdbffaf` is after it). Shared artefacts that only one lane may touch (`content/**`, goldens, `test/context-budget.test.mjs`) are untouched here; a red test there is reported, not fixed.

### Measurement at base (re-run, same counter as `agc check`)
Method: `analyzeText` from `dist/tools/comment-scan.js` over `git ls-files test` restricted to the owned globs (`test/_*`, `test/{a,b,d}*.test.mjs`, `test/{ch,com,conf,cons,cov,cu}*.test.mjs`, top level only). Result: **28 files, 27 with a long block, 45 blocks of 8–20 counted lines, 14 over 20.** Ranges are physical lines at BASE, bracket is the counted size, `**` marks over 20. The proof script's `--list-mid` and `>20` output regenerates this table at any commit.

| file | long blocks | ranges at BASE (counted lines) |
|---|---|---|
| `test/_e123b9-crash-worker.mjs` | 1 | L1–16 (16) |
| `test/_e123b9-fault-fs-loader.mjs` | 1 | L1–16 (16) |
| `test/_e123b9-fault-fs-shim.mjs` | 1 | L1–23 (23**) |
| `test/_e123b9-migration-worker.mjs` | 1 | L1–20 (20) |
| `test/_e123b9-round2-migrate.mjs` | 1 | L1–12 (12) |
| `test/_lock-worker.mjs` | 0 | — |
| `test/ac-execution.test.mjs` | 4 | L1–40 (40**), L247–255 (9), L371–384 (14), L451–462 (12) |
| `test/agc-adapters.test.mjs` | 11 | L1–8 (8), L464–485 (22**), L618–633 (16), L759–773 (15), L814–830 (17), L852–865 (14), L919–927 (9), L961–980 (20), L1033–1041 (9), L1069–1091 (23**), L1118–1125 (8) |
| `test/agc-feature-finish-history.test.mjs` | 2 | L1–33 (33**), L209–216 (8) |
| `test/agc-feature-lifecycle.test.mjs` | 2 | L1–53 (53**), L1061–1070 (10) |
| `test/baseline-manifest-gate.test.mjs` | 2 | L1–13 (13), L478–488 (11) |
| `test/check-md-tables.test.mjs` | 7 | L1–52 (52**), L96–109 (14), L350–360 (11), L433–449 (17), L632–640 (9), L736–744 (9), L846–854 (9) |
| `test/check-version.test.mjs` | 2 | L1–43 (43**), L240–278 (39**) |
| `test/compose-equivalence.test.mjs` | 1 | L1–29 (29**) |
| `test/config-cache.test.mjs` | 1 | L1–26 (26**) |
| `test/config-versioning.test.mjs` | 0 | — |
| `test/constitution-deliverable-guard.test.mjs` | 2 | L1–19 (19), L39–47 (9) |
| `test/covering-evidence.test.mjs` | 3 | L1–15 (15), L48–77 (30**), L217–226 (10) |
| `test/cut-approval-gate.test.mjs` | 6 | L1–19 (19), L126–133 (8), L387–395 (9), L417–433 (17), L619–626 (8), L667–684 (18) |
| `test/dependency-overrides.test.mjs` | 1 | L1–25 (25**) |
| `test/design-auditor-volume-guard.test.mjs` | 1 | L1–15 (15) |
| `test/dispatch-log.test.mjs` | 1 | L1–15 (15) |
| `test/dispatch-mechanism.test.mjs` | 1 | L1–16 (16) |
| `test/dispatch-pins.test.mjs` | 2 | L1–18 (18), L187–195 (9) |
| `test/drift-archived-tasks.test.mjs` | 1 | L1–15 (15) |
| `test/drift-baseline.test.mjs` | 1 | L1–19 (19) |
| `test/drift-skew.test.mjs` | 2 | L66–75 (10), L208–218 (11) |
| `test/drift-stamp-advisory.test.mjs` | 1 | L1–22 (22**) |

### Proof script
`.current/e260e/proof.mjs` (PM-authored, same shape as the archived e260d script, adapted to `.mjs` test files; no sr-engineer needed). Flags: `--base <rev>`, `--changed-only` (per-task `>20` and `bare-id` scope), `--list-mid`. Checks: `scope`, `emit`, `tokens`, `directives`, `>20`, `bare-id`, `form`; prints `proof: PASS` or `proof: FAIL (...)`. At base it reports 0 changed files and fails only `>20` (14 blocks), which is the expected starting state.

### Task batches
Each task ends with a commit whose title carries `E260E` and the task id. Per-task evidence: `node .current/e260e/proof.mjs --changed-only` output for the files of that task, appended to the qa authoring notes. The last task also runs the whole-lane proof. The full suite (AC10) runs once, on the committed final HEAD, by the verifier.
