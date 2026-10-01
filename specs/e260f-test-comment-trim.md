# e260f-test-comment-trim

Lane `e260f` of the E260 fan-out (wave 2, see `specs/fanout-e260.md`), ticket E260. Task ids `T-E260F-01 and T-E260F-08..21`.
Scope: the comments in `test/e1*` and `test/e2*` (60 tracked files, `.test.mjs` plus `test/e148-seed-stamp.mjs` and `test/e259-lib.mjs`), and one wrong comment in `test/e246-mailbox-teardown.test.mjs`. Base commit `bdbffaf` (recorded in `.current/e260f/base-sha`).

## Problem Statement
The tests in `test/e1*` and `test/e2*` still carry long comment blocks written before the Comment discipline rule (constitution section 6) existed. Measured at base with `analyzeText` from `dist/tools/comment-scan.js` (the counter `agc check` uses): 60 files, 53 with a long block, 60 blocks of 8-20 counted lines, 51 blocks over 20, the longest 72. Long rationale in a test comment hides what a test pins, drifts from the assertions, and costs context on every read. This lane trims those blocks to the threshold the human approved for E260. Rationale worth keeping moves to a tracked spec and the comment keeps at most a one-line pointer. One comment is also wrong: the `setupLane` comment at `test/e246-mailbox-teardown.test.mjs:57` lists a `lane` field the helper does not return. Only comments change; assertions, test names, assertion messages and every string stay byte-for-byte the same.

## User Stories
- As a maintainer reading a test, I want a short comment that says what the test pins and why, so that I can judge a failure without reading a page of history first.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large comment-only diff in test files without re-reading every assertion.
- As a future editor, I want the rationale that was cut to stay findable from a one-line pointer, so that trimming does not lose it.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `bdbffaf`; the proof script reads `.current/e260f/base-sha` and falls back to `--base <rev>`.

- **AC1 (emit unchanged, human-mandated)**: Given every file under `test/e1*` and `test/e2*` that differs from BASE, when the base blob and the working-tree file are each transpiled with TypeScript `transpileModule` using the repo `tsconfig.json` compiler options with `removeComments: true` (and `sourceMap`, `inlineSourceMap`, `declaration`, `declarationMap` off), then the two outputs are byte-identical for every file. Test files are `.mjs`, so the script sets `allowJs: true` and passes the real file name.
  proof: `node .current/e260f/proof.mjs` prints `emit: <N> files, 0 differ` and exits 0.
- **AC2 (AST leaves unchanged)**: Given the same file set, when each version is parsed with `ts.createSourceFile` and its leaf tokens (kind and text, comments and whitespace excluded, JSDoc nodes excluded) are listed in source order, then the two lists are identical.
  proof: `node .current/e260f/proof.mjs` prints `tokens: <N> files, 0 differ` and exits 0.
- **AC3 (directive comments kept)**: Given every changed file, when the `@ts-*` and `eslint-*` directive comments are listed at BASE and at HEAD, then no directive present at BASE is missing at HEAD. A trimmed block that held a directive keeps that directive line.
  proof: `node .current/e260f/proof.mjs` prints `directives: 0 removed` and exits 0.
- **AC4 (scope containment)**: Given the lane diff against BASE, when it is listed, then every changed path is an existing tracked file matching `test/e1*` or `test/e2*` (none added, deleted or renamed), or is under `specs/e260f-*`, `qa_reports/*E260F*`, `review_reports/*E260F*` or `.current/e260f/`; nothing under `test/` outside `e1*`/`e2*`, no source directory, no `dist/`, and none of the fan-out's shared-forbidden list changed.
  proof: `node .current/e260f/proof.mjs` prints `scope: ok`; and `git diff --stat bdbffaf...HEAD -- dist tools gates prompts schema lib guards transport bin scripts content templates docs index.ts 'specs/fanout-*.md' CHANGELOG.md package.json CLAUDE.md AGENTS.md .antigravityrules .current/history 'test/fixtures' | wc -l` prints `0`.
- **AC5 (no block over 20 lines)**: Given the 60 lane files at HEAD, when each is measured with `analyzeText`, then no comment block counts more than 20 lines. There is no sanctioned exception in this lane.
  proof: `node .current/e260f/proof.mjs` prints `>20: 0` and exits 0.
- **AC6 (blocks of 8 to 20 lines are trimmed or justified)**: Given the 8-20-line blocks the proof script lists at HEAD, when the code-review report is read, then every listed block has a one-line reason to keep it in the `review_reports/review_T-E260F-NN.md` of the task that owns its file. A block cut to 7 or fewer counted lines needs no reason.
  proof: `node .current/e260f/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each against the report (no single command decides whether a reason is sound).
- **AC7 (rationale kept, comments point to it)**: Given a trimmed block whose rationale is not already in a tracked spec the comment cites, when the trim lands, then that rationale is in `specs/e260f-comment-rationale.md` under a section named after the source file, and the comment keeps at most one pointer line. Where the comment already cites a tracked spec that holds the rationale, the pointer to that spec is enough and nothing is copied.
  proof: reviewer cross-checks `grep -l 'specs/e260f-comment-rationale.md' test/e1* test/e2*` against the section list of that file; `node scripts/check-md-tables.mjs` exits 0 after commit.
- **AC8 (Generic citation)**: Given comment lines in the lane files at HEAD, when scanned, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may stay as a trailing pointer after plain words), and no comment this lane touches cites a path that is not tracked (a moved report is cited at its `archive/` path); the bare-id id pattern also matches ids ending in a letter such as `E177b` or `AC4b`. Base has one known miss, `test/e24-exemptions.test.mjs:9` (`// (E24)`).
  proof: `node .current/e260f/proof.mjs` prints `bare-id: 0` and `cited-paths: 0 untracked`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability.
- **AC13 (comment width, added round 1)**: Given every comment line this lane adds or rewrites under `test/e1*` and `test/e2*`, when its width is measured, then no line exceeds 120 columns and the median added comment line is at most 100 columns. Joining lines to meet the AC5 counted-line target does not satisfy AC5: re-wrap to the width of the surrounding file (about 80-100 columns).
  proof: `node .current/e260f/proof.mjs` prints `width: max <=120, median <=100` and exits 0.
- **AC9 (comment form preserved)**: Given every changed file, when its diff is read, then each file keeps its `// Coded by @<role>` line, `//` comments stay `//`, JSDoc stays JSDoc, no `/*!` or `/// <reference` line differs, and no comment contains a `##` heading.
  proof: `node .current/e260f/proof.mjs` prints `form: ok`.
- **AC10 (e246 setupLane comment correct)**: Given `test/e246-mailbox-teardown.test.mjs`, when the comment above `setupLane` is read, then it lists exactly the fields the helper returns, `{ repo, ticket, branch, lanePath, mailboxRoot, mailbox }`, and no `lane`.
  proof: `grep -n 'returns { repo, ticket, branch, lanePath, mailboxRoot, mailbox }' test/e246-mailbox-teardown.test.mjs` finds exactly one line directly above `function setupLane`, and `grep -c 'returns { repo, lane,' test/e246-mailbox-teardown.test.mjs` prints `0`.
- **AC11 (suite green)**: Given the final HEAD with a clean tree, when the full suite runs, then it passes. A red test is reported to the coordinator and integrator, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test` exits 0.
- **AC12 (no local absolute paths)**: Given the lane's tracked evidence and spec files and the lines added under `test/`, when scanned for a home-directory style absolute path, then none is found. Evidence names scripts by file name only. The scan pattern is built at run time from parts so no tracked file carries the literal prefix.
  proof: `node .current/e260f/proof.mjs` prints `paths: 0`.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no user-facing string is introduced or changed; string literals are out of scope |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Assertions, test names, assertion messages, string and template literals, imports, code layout. No reflow of code lines.
- Other `test/**` (waves 2 and 3 lanes), `test/fixtures/**`, `test/context-budget.test.mjs`, source directories, `dist/**`, and the fan-out's shared-forbidden list.
- File-level comment ratio (the `agc check` advisory): reported, not gated.
- Release bookkeeping (version, CHANGELOG, backlog done-mark): release-engineer and the integrator.

## Dependencies / Prerequisites

### Measurement at base (re-run 2026-10-01 on `bdbffaf`, matches the fan-out table)
Method: `analyzeText` over `git ls-files 'test/e1*' 'test/e2*'`. Result: **60 files, 53 with a long block, 60 blocks of 8-20 counted lines, 51 blocks over 20, longest 72**. Per-file counts come from the proof script (`--list-mid` and a base scan); the table below gives each task's file set and total counted lines in blocks of 8 or more (the task's authoring weight).

| task | files (counted lines in blocks of 8+) | weight | closes |
|---|---|---|---|
| T-E260F-01 | `.current/e260f/proof.mjs` (1 file, no test edit) | — | AC1-AC6, AC8, AC9, AC12 (the script implements the checks; final AC4 and AC12 runs are in T-E260F-21) |
| T-E260F-08 | `e106-init-artifacts-flag`(42), `e108-eject`(75), `e112-drift-fanout-feature-scope`(42), `e114-cut-approval-inheritance`(19), `e115-join-precondition`(30) | 208 | AC5-AC9 |
| T-E260F-09 | `e116-archive-on-feature-change`(48), `e117-void-task`(94), `e118-reviewer-ac-completeness`(28), `e120-void-recut-refusal`(71) | 241 | AC5-AC9 |
| T-E260F-10 | `e121-tasks-file-injection`(134), `e122-state-render-injection`(106) | 240 | AC5-AC9 |
| T-E260F-11 | `e123b2-sidecars-lane-paths`(22), `e123b9-lane-flip`(81), `e125a-lane-local-ledgers`(44), `e125c-index-compaction`(49) | 196 | AC5-AC9 |
| T-E260F-12 | `e126-merge-invariants`(75), `e128-blocked-self-loop-repro`(21), `e128-orchestrator-blocked-repair`(53), `e130-lane-default`(80) | 229 | AC5-AC9 |
| T-E260F-13 | `e132-lane-registry`(125), `e137-rag-render`(25), `e137-render-sanitise`(46) | 196 | AC5-AC9 |
| T-E260F-14 | `e148-seed-stamp.mjs`(81), `e148-stamp-provenance-seed`(44), `e16-judge-dispatch-charter`(32), `e164-e167-content`(28), `e166-template-defers-staging`(37) | 222 | AC5-AC9 |
| T-E260F-15 | `e177a-check-cli`(30), `e177a-manifest`(28), `e177b-lane-status`(38), `e177b-mailbox-watch`(49), `e177b-test-lock`(44) | 189 | AC5-AC9 |
| T-E260F-16 | `e178a-integrator-role`(33), `e178b-cut-prereview`(37), `e178b-fanout-unmatched`(29), `e178b-lane-watch`(37), `e18-write-provenance`(66) | 202 | AC5-AC9 |
| T-E260F-17 | `e180-abandoned-harvest`(45), `e20-e21-crash-resilience`(24), `e213-shipped-ignored-shape`(45), `e22-stale-notify`(66), `e223-watch-rearm-gone`(28) | 208 | AC5-AC9 |
| T-E260F-18 | `e23-evidence-schema`(37), `e231-info-hygiene-rule`(28), `e234-hygiene-scan`(20), `e235a-relative-prd-path`(28), `e235b-relative-worktree`(28) | 141 | AC5-AC9 |
| T-E260F-19 | `e239-init-subdir-exclude`(61), `e24-exemptions`(31, plus the bare-id fix at line 9), `e246-mailbox-teardown`(0, plus the `setupLane` comment fix), `e248-relative-mailbox-header`(24), `e250-eject-path-escape`(62) | 178 | AC5-AC10 |
| T-E260F-20 | `e258a-comment-rule`, `e258b-comment-scan`, `e259-comment-scan-brace`, `e259-comment-scan-hash`, `e259-comment-scan-limits` (no long block; citation-only sweep, edited only if the proof script's `bare-id` finds a miss) | 0 | AC8, AC9 |
| T-E260F-21 | `e259-lib.mjs`(0, citation sweep), `e26-gate-stats`(47), `e28-shrink-warning`(43); then the final proof run and the AC11 full suite on the clean committed HEAD, before the `qa-engineer:Blocked` write | 90 | AC5-AC9, AC11 |

**Task size rule (task_size, integrator pre-review)**: every task touches at most 5 files, citation-only sweeps counted, and carries at most about 300 counted comment lines (the cut tops out at 241). No single file exceeds 300 counted lines (the largest is `e121-tasks-file-injection`, 134), so no file is split by line range.

**AC-to-task map**: AC1, AC2, AC3, AC4, AC12 are implemented by the proof script (T-E260F-01) and run per task with `--changed-only`, then in full in T-E260F-21; AC5-AC9 are closed per file by T-E260F-08..21; AC10 by T-E260F-19; AC11 by T-E260F-21 (the last authoring task) and independently re-run by the fresh verifier on final HEAD.

The task weights sum to the measured total, 2540 counted lines. (T-E260F-02..07 of the first cut were voided and replaced by T-E260F-08..21 under fresh ids so no stale evidence can attach.)

### Per-block disposition (how the qa author decides each block)
Work top-down, one block at a time:
1. **Split what/why from history.** Keep what a reader of this test needs now: what behaviour the test pins, the non-obvious setup or pitfall, and the reason in one or two sentences. Drop history ("relocated from", "previously"), restated spec text, AC/DR bookkeeping and review-round narrative.
2. **Rationale still worth keeping**: if the block already cites a tracked spec that holds it (check the spec, do not assume), keep a one-line pointer and move nothing. Otherwise move the text, lightly edited for standalone reading, to `specs/e260f-comment-rationale.md` under `## <source path>` and leave one pointer line such as `// Rationale: specs/e260f-comment-rationale.md (test/e121-tasks-file-injection.test.mjs).`
3. **Target size**: blocks end at 7 counted lines or fewer. A block may stay at 8-20 only when cutting it would remove a contract a reader needs (a fixture format, a pinned ordering, a pitfall) with no better home. Record a one-line reason in the "Retained blocks" table of `specs/e260f-comment-rationale.md`; the code-reviewer copies each line into the task's review report (AC6). Nothing may stay above 20.
4. **In-body comments**: a long comment inside a test body becomes a short note at the test head, or is cut. Do not move code to make room.
5. **Do not touch**: string or template literals (comment-looking text inside a template is a string), `/*!`, `/// <reference`, the `// Coded by` line, any `@ts-*` or `eslint-*` directive comment (a block that contains one keeps that line).
6. **Generic citation**: any id, AC or DR reference left in a block gets plain words on the same line; a cited path must be tracked. A comment that names the retired single-file constitution describes it in words and does not cite its old path.
7. **Prove per task**: after each task's edits run `node .current/e260f/proof.mjs --changed-only`, then commit the task's files with the rationale additions, so every commit on the branch is consistent.

### Behaviour-neutral proof script (`.current/e260f/proof.mjs`) — who writes it and how
- **Author**: the qa-engineer author, in T-E260F-01, before any test file is edited. Only qa may touch `test/` (constitution section 2) and the script is the lane's only executable, so one role writes it; the independent check is that the code-reviewer reads it and the fresh qa verifier re-runs it on final HEAD plus a self-made negative control (see below). PM writes no code here.
- **Starting point**: copy `.current/history/2026-10/e260d/proof.mjs` (tracked on main) and adapt: lane set `test/e1*` and `test/e2*` expanded from `git ls-files` at BASE (a glob, not a hard-coded list); no `tools`-style pinned-token and no `gates/registry.ts` allowance; default base from `.current/e260f/base-sha`; file path of the comment scanner imported relative to `import.meta.url`; no absolute path in the script or its output.
- **Checks** (each prints one line, final line `proof: PASS` or `proof: FAIL (<checks>)`, exit 1 on FAIL):
  - `scope` (AC4): `git diff --name-status BASE` and untracked files; only `M` on a tracked `test/e1*`/`test/e2*` file, or paths under the owned non-test locations; any forbidden path or `A`/`D`/`R` fails.
  - `emit` (AC1): `ts.transpileModule` with `removeComments: true`, `allowJs: true`, source and declaration maps off, on `git show BASE:<f>` and the working-tree file; `outputText` compared byte for byte.
  - `tokens` (AC2): `createSourceFile` leaf list (kind, text), skipping JSDoc nodes and `EndOfFileToken`; compared base vs working tree.
  - `directives` (AC3): per changed file, the multiset of comment lines matching `@ts-(ignore|expect-error|nocheck|check)` or `eslint-(disable|enable)` at BASE must be contained in HEAD's.
  - `>20` and `--list-mid` (AC5, AC6): `analyzeText` over all 60 lane files at HEAD; no exception.
  - `bare-id` (AC8): the E233 regex (a comment line made only of an id, an optional slug in brackets, and punctuation) over the lane files.
  - `form` (AC9): first line unchanged, block-comment opener count not higher than BASE, no `##` heading in a comment, `/*!` and `/// <reference` lines identical.
  - `paths` (AC12): scan lines added under `test/` plus the lane's tracked evidence and spec files for a home-directory style absolute path; the pattern is assembled from parts at run time.
  - Flags: `--base <rev>`, `--changed-only` (run `>20` and `bare-id` on changed files only), `--list-mid`.
- **Negative control** (the verifier's own, not committed): in a throwaway copy, change one string literal and one comment in a lane file and confirm `emit` and `tokens` report it; delete one `@ts-*` or `eslint-*` line in the copy and confirm `directives` reports it. Record the outcome in the QA report by description.
- **Why both emit and tokens**: `removeComments` emit erases types and some syntax forms; the leaf comparison catches a type-only or formatting-dependent edit. Both are mandated by the wave-2 re-check decision in `specs/fanout-e260.md`.

### Pinned test: `test/e258b-comment-scan.test.mjs` (AC14b)
The test "AC14b: this test file obeys the same limits" runs `analyzeText` on its own source and asserts the longest comment block is at most 7 and the comment ratio at most 30% (today 6 and 9/404). `test/e258b-comment-scan.test.mjs` is in T-E260F-20; if a citation fix touches it, any added comment must keep both limits.

### Chain and task shape
- Chain (E233 test-lane edge, precedent `specs/e233e-test-comments-c.md`): pm `In_Progress` (this write, `next_role: qa-engineer`) -> qa-engineer author writes `Blocked` (authoring done, not failure) -> pm -> code-reviewer (`resume_of: code-reviewer`) -> fresh Task-dispatched qa-engineer verifier writes `PASS` and completes all tasks.
- No architect hop: comment-only, no data model or API. Dispatch pin `sr-engineer=fable` is on record but no sr hop is cut (no source file changes).
- T-E260F-01 is the proof script; T-E260F-08..21 are the file batches above, each one qa authoring round, committed per task. T-E260F-19 carries the `e24` bare-id fix and the `e246` `setupLane` fix. T-E260F-21, the last authoring task, runs the full suite (AC11) on the clean committed HEAD before the `qa-engineer:Blocked` write. The skeleton of `specs/e260f-comment-rationale.md` is created by PM with this spec; tasks append sections and rows.
- Information hygiene: the rationale spec, the proof script and evidence carry no absolute local paths; refer to the worktree as `../agent-governance-mcp-lanes/e260f` or by description.
- Tests that read other tests' text: none for comments (wave-2 re-check: deleting every comment-only line in `test/` leaves the suite 3043/3040/0). Code-level readers exist (`test/e122-state-render-injection.test.mjs` reads a regex literal from `test/render-structure.test.mjs`; `test/e178a-integrator-role.test.mjs` reads assertions from `test/skill-frontmatter.test.mjs`); neither file is in this lane and comment edits cannot change them. The full suite on final HEAD is the last word (AC11).
