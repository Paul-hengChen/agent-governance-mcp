# e260g-test-e3-l-comment-trim

Lane `e260g` of the E260 fan-out (wave 2, see `specs/fanout-e260.md`), ticket E260. Task ids `T-E260G-09..16` (ids 01..08 were voided in a re-cut before any work and cannot be reused).
Scope: the comments in 28 test files (`test/e3*` to `test/e9*`, `test/error-*`, `test/eval-*`, `test/evidence-*`, and `test/{f,g,h,i,j,k,l}*.test.mjs`). Base commit `bdbffaf`. Test files are written only by qa-engineer (constitution section 2), so every task here is a qa-engineer authoring task.

## Problem Statement
These test files carry long comment blocks written before the Comment discipline rule (constitution section 6) existed: 92 blocks of more than 7 counted lines across 25 of the 28 files, 21 of them over 20 lines, the longest 42 lines (the header of `test/e92-e86-handoff-write-boundary.test.mjs`). Most are file headers that retell the ticket history and review rounds. They hide the WHAT and WHY a reader needs and drift from the tests. This lane trims them to the threshold the human approved for E260 without touching a single assertion, test name, message or string. Rationale still worth keeping moves to a tracked spec and the comment keeps at most one pointer line.

## User Stories
- As a maintainer opening a test file, I want a short header that says what is under test and why, so that I do not read a page of ticket history first.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large comment-only diff without re-reading every assertion.
- As a future editor, I want the cut rationale to stay findable from a one-line pointer, so that trimming does not lose it.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `bdbffaf` (the proof script reads `.current/e260g/base-sha`, else `--base <rev>`). The lane file set is the 28 files listed under Measurement; `test/eval/**` and `test/fixtures/**` are never in it.

- **AC1 (emit unchanged, human-mandated)**: Given every lane file that differs from BASE, when the base blob and the HEAD file are each transpiled with TypeScript `transpileModule` (repo `tsconfig.json` compiler options, `removeComments: true`, `sourceMap`, `inlineSourceMap`, `declaration`, `declarationMap` off), then the outputs are byte-identical for every file.
  proof: `node .current/e260g/proof.mjs` prints `emit: <N> files, 0 differ` and exits 0.
- **AC2 (AST leaves unchanged, directives kept)**: Given the same files, when each version is parsed with `ts.createSourceFile` and its leaf tokens (kind and text, comments excluded, JSDoc nodes skipped) are listed in order, then the lists are identical; and the count of `@ts-*` and `eslint-*` directive comments (and `__PURE__` annotations) in each file is the same at HEAD as at BASE.
  proof: `node .current/e260g/proof.mjs` prints `tokens: <N> files, 0 differ` and `directives: <N> files, 0 lost`.
- **AC3 (assertions, names, messages, strings untouched; scope)**: Given the lane diff against BASE, when it is listed, then every changed path is one of the 28 lane files, none is added, deleted or renamed, and nothing under `test/eval/`, `test/fixtures/`, any other `test/` path, a source directory, `dist/`, `content/`, `templates/`, `docs/`, `specs/fanout-*.md`, `CHANGELOG.md`, `package.json`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules` or `.current/history/` changed. AC1 and AC2 already cover strings and test names (a string or template literal edit changes the emit).
  proof: `node .current/e260g/proof.mjs` prints `scope: ok`.
- **AC4 (no block over 20 lines)**: Given the lane files at HEAD, when each is measured with `analyzeText` from `dist/tools/comment-scan.js` (the counter `agc check` uses), then no comment block counts more than 20 lines.
  proof: `node .current/e260g/proof.mjs` prints `>20: 0 unexpected`.
- **AC5 (blocks of 8 to 20 lines are trimmed or justified)**: Given the 8-20-line blocks the proof script lists at HEAD, when the code-review report is read, then each listed block has a one-line keep reason in the "Retained blocks" table of `specs/e260g-comment-rationale.md`, copied into `review_reports/review_T-E260G-NN.md` of the task owning the file. A block cut to 7 or fewer counted lines needs none.
  proof: `node .current/e260g/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each against the table.
- **AC6 (rationale kept, comments point to it)**: Given a trimmed block whose rationale no tracked spec already holds, when the trim lands, then that rationale is in `specs/e260g-comment-rationale.md` under a `## <test file path>` section and the comment keeps at most one pointer line. Where the comment already cites a tracked spec that holds the rationale, that pointer is enough and nothing is copied (check the spec, do not assume).
  proof: the reviewer cross-checks `grep -c 'specs/e260g-comment-rationale.md' <changed files>` against the section list; `node scripts/check-md-tables.mjs` exits 0 after commit.
- **AC7 (Generic citation)**: Given comment lines in the lane files at HEAD, when scanned, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may trail plain words), and no comment this lane touches cites an untracked path. At BASE four such lines exist: `test/e32-e33-gate-hardening.test.mjs` lines 79 and 343, `test/e92-e86-handoff-write-boundary.test.mjs` line 423, `test/feature-lease.test.mjs` line 1127.
  proof: `node .current/e260g/proof.mjs` prints `bare-id: 0`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability.
- **AC8 (comment form preserved)**: Given every touched file, when its diff is read, then it keeps its first line (`// Coded by @<role>`), `//` stays `//`, no `//` run is turned into `/* */`, no `/*!`, `/// <reference` or shebang line differs, and no comment contains a `##` heading.
  proof: `node .current/e260g/proof.mjs` prints `form: ok`.
- **AC9 (suite green)**: Given the final HEAD with a clean tree, when the full suite runs, then it passes with the same pass, fail and skip counts as at BASE. A red test is reported, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test` exits 0.

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
- Assertions, test names, assertion messages, string and template literals (comment-looking text inside a template is a string), test logic, imports, code layout. No reflow of code lines.
- `test/eval/**` (lane e260h), `test/fixtures/**`, every other `test/**` file, all source directories, `dist/**`, and the fan-out's shared-forbidden list.
- Comment-text pins: wave-2 premise re-check (fan-out Decisions, 2026-10-01) found none in `test/`, so no comment text is frozen in this lane.
- Release bookkeeping (version, CHANGELOG, backlog done-mark) belongs to release-engineer and the integrator.

## Dependencies / Prerequisites

### Measurement at base (re-run 2026-10-01, matches the fan-out row exactly)
Method: `analyzeText` from `dist/tools/comment-scan.js` over the 28 files below (`git ls-files test`, top level only, excluding `test/eval/` and `test/fixtures/`). Result: **28 files, 25 with a long block, 71 blocks of 8-20 counted lines, 21 over 20.** Ranges are physical lines at BASE with the counted size in brackets; `**` marks a block over 20. Task column = owning task.

| file | blocks 8-20 / over 20 | ranges at BASE (counted lines) | task |
|---|---|---|---|
| `test/e31-config-nonfatal.test.mjs` | 2 / 1 | L1-38 (38**), L256-265 (10), L309-317 (9) | 10 |
| `test/e32-e33-gate-hardening.test.mjs` | 4 / 1 | L1-40 (40**), L71-79 (9), L103-110 (8), L196-203 (8), L337-344 (8) | 10 |
| `test/e35-pipeline-order.test.mjs` | 0 / 1 | L1-28 (28**) | 10 |
| `test/e38-next-role-lookahead.test.mjs` | 0 / 1 | L1-34 (34**) | 10 |
| `test/e43-test-file-ask-at-dispatch.test.mjs` | 0 / 1 | L1-30 (30**) | 10 |
| `test/e5-intake-tiering.test.mjs` | 0 / 1 | L1-36 (36**) | 11 |
| `test/e90-golden-capture-completeness.test.mjs` | 0 / 1 | L1-34 (34**) | 11 |
| `test/e92-e86-handoff-write-boundary-repro.test.mjs` | 1 / 0 | L1-8 (8) | 11 |
| `test/e92-e86-handoff-write-boundary.test.mjs` | 5 / 1 | L1-42 (42**), L199-209 (11), L263-271 (9), L297-304 (8), L331-338 (8), L368-376 (9) | 11 |
| `test/e96-dispatch-preference.test.mjs` | 0 / 1 | L1-36 (36**) | 11 |
| `test/eval-assertions.test.mjs` | 1 / 1 | L1-33 (33**), L171-178 (8) | 12 |
| `test/evidence-provenance.test.mjs` | 1 / 0 | L1-13 (13) | 12 |
| `test/error-code-contract.test.mjs` | 17 / 2 | L1-21 (21**), L52-65 (14), L117-125 (9), L149-157 (9), L277-300 (24**), L374-383 (10), L413-422 (10), L468-475 (8), L496-507 (12), L561-575 (15), L611-621 (11), L661-670 (10), L672-679 (8), L681-689 (9), L691-699 (9), L701-708 (8), L710-718 (9), L720-728 (9), L730-739 (10) | 12 |
| `test/feature-lease.test.mjs` | 7 / 2 | L1-23 (23**), L469-483 (15), L706-725 (20), L728-735 (8), L1004-1027 (24**), L1120-1127 (8), L1484-1491 (8), L1623-1632 (10), L1673-1685 (13) | 13 |
| `test/feature-scope-gate.test.mjs` | 1 / 0 | L1-17 (17) | 13 |
| `test/feature-split-lifecycle.test.mjs` | 1 / 0 | L1-16 (16) | 13 |
| `test/feature-rollup.test.mjs` | 3 / 2 | L1-32 (32**), L172-180 (9), L353-361 (9), L403-435 (33**), L458-466 (9) | 13 |
| `test/gates-expected-red.test.mjs` | 4 / 0 | L1-17 (17), L171-181 (11), L300-308 (9), L326-335 (10) | 14 |
| `test/handoff-migration.test.mjs` | 3 / 0 | L259-267 (9), L426-436 (11), L560-570 (11) | 14 |
| `test/handoff-write-arg-guard.test.mjs` | 1 / 1 | L1-30 (30**), L48-61 (9) | 14 |
| `test/hop-count-transitions.test.mjs` | 2 / 1 | L1-26 (26**), L61-70 (10), L347-360 (14) | 15 |
| `test/lane-migrate.test.mjs` | 12 / 0 | L1-20 (20), L75-83 (9), L91-99 (9), L266-275 (10), L330-341 (12), L378-389 (12), L412-423 (12), L426-434 (9), L481-488 (8), L505-512 (8), L603-612 (10), L689-698 (10) | 15 |
| `test/lane-paths-history.test.mjs` | 0 / 1 | L1-22 (22**) | 16 |
| `test/lane-paths.test.mjs` | 6 / 1 | L1-32 (32**), L105-114 (10), L120-127 (8), L273-280 (8), L302-311 (10), L314-321 (8), L385-393 (9) | 16 |
| `test/lane-ticket-allocation.test.mjs` | 0 / 1 | L1-33 (33**) | 16 |
| `test/file-lock.test.mjs`, `test/handoff-versioning.test.mjs`, `test/handoff.test.mjs` | 0 / 0 | no long block; swept only for Generic citation (none found at BASE) | 14 (file-lock, handoff-versioning), 15 (handoff) |

### Task cut and size check (task_size: at most 5 files and ~300 counted comment lines per task)
Lines = sum of counted lines of the 8+ line blocks in the task's files at BASE. Sweep files count toward the file limit.

| task | files | long blocks / counted lines | ACs closed |
|---|---|---|---|
| T-E260G-09 | 1 (`.current/e260g/proof.mjs`) | 0 / 0 | instrument for AC1, AC2, AC3, AC4, AC7, AC8 |
| T-E260G-10 | 5 | 11 / 222 | AC1-AC8 for its files |
| T-E260G-11 | 5 | 10 / 201 | AC1-AC8 for its files |
| T-E260G-12 | 3 | 22 / 269 (`error-code-contract` alone 19 / 215) | AC1-AC8 for its files |
| T-E260G-13 | 4 | 16 / 254 | AC1-AC8 for its files |
| T-E260G-14 | 5 (3 trimmed, 2 swept) | 9 / 117 | AC1-AC8 for its files |
| T-E260G-15 | 3 (2 trimmed, 1 swept) | 15 / 179 | AC1-AC8 for its files |
| T-E260G-16 | 3 | 9 / 140 | AC1-AC8 for its files, lane-wide AC1-AC8 sign-off, AC9 (suite on the clean committed HEAD, before `qa-engineer:Blocked`) |

Totals: 92 long blocks, 1382 counted lines, 28 lane files. AC9 is re-run independently by the fresh verifier.

### Per-block disposition (how qa-engineer decides each block)
1. Keep what a reader needs now: what the file tests, the non-obvious setup or pitfall, the reason in one or two sentences. Drop history ("relocated from", "previously"), review-round narratives, restated spec text and AC/DR bookkeeping.
2. Rationale worth keeping: if the block cites a tracked spec that holds it, keep a one-line pointer. Otherwise move the text, lightly edited to read standalone, to `specs/e260g-comment-rationale.md` under `## <test file path>` and leave one pointer line such as `// Rationale: specs/e260g-comment-rationale.md (test/<file>).`
3. Target: file headers and in-body comments end at 7 counted lines or fewer. A block may stay at 8-20 only when cutting it would drop a setup contract or pitfall with no better home; record a one-line reason in the "Retained blocks" table.
4. A long in-body comment becomes a short warning above the test it explains, or is cut. Do not move code.
5. Do not touch string or template literals, `// Coded by` first line, `@ts-*`, `eslint-*` or `__PURE__` comments, test names, assertion messages.
6. Generic citation: while a block is open, a bare id gets plain words; a cited path must be tracked.
7. Run `node .current/e260g/proof.mjs --changed-only` after each task and commit per task (source only, no `dist/`: nothing here is compiled).

### Behaviour-neutral proof script (`.current/e260g/proof.mjs`, written in T-E260G-09)
A Node ESM script, no dependencies beyond the repo's `typescript` and `dist/tools/comment-scan.js` (imported relative to `import.meta.url`); no absolute paths. It is modelled on the wave-1 script of lane e260d (`.current/history/2026-10/e260d/proof.mjs`) with these changes: the lane set is the 28 files (a path filter equivalent to the ownership globs, excluding `test/eval/` and `test/fixtures/`, `.mjs` instead of `.ts`); the `ALLOWED_MARK` exception and the pinned-token check are dropped; and a new `directives` check counts `@ts-*`, `eslint-*` and `__PURE__` comments in base vs HEAD. Checks: `scope`, `emit` (transpile `.mjs` as JS with the same options, base blob vs working tree), `tokens` (AST leaves excluding JSDoc), `directives`, `>20`, optional `--list-mid`, `bare-id` (E233 regex), `form` (first line, no new block comments, no `##` heading, no `/*!` or `/// <reference` or `#!` change). Flags: `--base <rev>`, `--changed-only`, `--list-mid`. Ends with `proof: PASS` or `proof: FAIL (<checks>)`, exit 1 on FAIL. T-E260G-09 proves the script by running it at base (0 changed files, `>20` and `bare-id` report the base numbers 21 and 4) and by a negative control on a scratch copy: a code edit makes `emit` and `tokens` fail, and deleting a directive comment makes `directives` fail.

### Home for retained rationale
`specs/e260g-comment-rationale.md` (skeleton created in this PM hop): a "Retained blocks" table `file | line at HEAD | counted | reason`, then one `## <test file path>` section per file whose rationale moved. Each task appends its own sections. It carries no absolute local paths and must pass `scripts/check-md-tables.mjs`.

### Other prerequisites
- Base `bdbffaf`; wave 1 merged. Dispatch pin `sr-engineer=fable` (human; no sr-engineer hop in this lane). Chain: pm, qa-engineer author (ends `qa-engineer:Blocked` = authoring done, not a failure), pm, code-reviewer (`resume_of`), fresh Task-dispatched qa-engineer verifier PASS (fan-out, E233 precedent).
- Information hygiene: the rationale spec, proof script and evidence carry no absolute local paths (e234 AC16); name the worktree as `../agent-governance-mcp-lanes/e260g` or by description.
- `test/error-code-contract.test.mjs`: integrator confirmed (pre-review) that no test parses its own comments, so it is trimmed like the rest; its parsing and regex code and mapping assertions stay byte-identical (AC1, AC2).
- Architect hop: none. Comment-only, no data model or API, proof is mechanical.
- Generic citation at BASE: the four lines in AC7; every `specs/*.md` path cited in lane comments should be checked as touched.
