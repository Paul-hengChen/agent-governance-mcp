# e260a-tools-a-h

Lane e260a of the E260 fan-out (`specs/fanout-e260.md`, first wave). Base commit b37178a.

## Problem Statement
The 25 source files `tools/{a..h}*` still carry long comment blocks written before the Comment discipline rule (constitution section 6) existed: 82 blocks of 8 to 20 counted lines and 14 blocks over 20, the longest 52 lines. Readers have to wade through history and restated design notes to find the code. This lane trims those blocks to the shared E260 threshold, moves rationale still worth keeping into a tracked spec with at most a one-line pointer, and fixes the remaining *Generic citation* misses in the same files. Comments only: program behaviour must not change, and that is proved mechanically.

## User Stories
- As a contributor reading `tools/handoff-orchestrator.ts`, I want each comment to state only what the code does and why, so that I can follow the code without paging through design history.
- As a reviewer, I want a script that proves the change is comment-only and a script that re-measures the blocks, so that I can approve a large trim without reading every hunk for logic.
- As the integrator, I want this lane to touch only its own share of `tools/` and `dist/tools/`, so that the first-wave merge has no conflicts.

## Baseline (measured at b37178a)
Measured with `analyzeText` from `dist/tools/comment-scan.js`, the same counting `agc check` uses (JSDoc tag lines and delimiter-only lines are not counted). Scope is `git ls-files 'tools/[a-h]*'`, `.ts` only, no `.d.ts`. "Pct" is comment lines / non-blank lines.

| file | 8–20 blocks | >20 blocks | longest | pct | >20 block starts (line, counted) |
|---|---|---|---|---|---|
| tools/comment-lang-c.ts | 0 | 0 | 3 | 8.6 | — |
| tools/comment-lang-hash.ts | 0 | 0 | 3 | 6.3 | — |
| tools/comment-lang-js.ts | 0 | 0 | 3 | 3.3 | — |
| tools/comment-lang-nested.ts | 0 | 0 | 3 | 9.1 | — |
| tools/comment-langs.ts | 0 | 0 | 3 | 6.8 | — |
| tools/comment-lex.ts | 0 | 0 | 3 | 1.5 | — |
| tools/comment-python.ts | 0 | 0 | 3 | 9.1 | — |
| tools/comment-scan.ts | 0 | 0 | 5 | 4.5 | — |
| tools/comment-tags.ts | 0 | 0 | 3 | 7.9 | — |
| tools/comment-types.ts | 0 | 0 | 3 | 15.0 | — |
| tools/config.ts | 2 | 1 | 26 | 46.9 | L1 (26) |
| tools/dispatch-log.ts | 0 | 1 | 25 | 50.0 | L1 (25) |
| tools/drift.ts | 5 | 1 | 21 | 32.6 | L63 (21) |
| tools/evidence-file.ts | 3 | 0 | 14 | 34.8 | — |
| tools/evidence-lookup.ts | 1 | 1 | 52 | 53.6 | L1 (52) |
| tools/exemptions.ts | 0 | 1 | 47 | 41.2 | L1 (47) |
| tools/fanout-manifest.ts | 2 | 1 | 34 | 16.6 | L1 (34) |
| tools/feature-rollup.ts | 3 | 1 | 38 | 31.3 | L1 (38) |
| tools/gate-stats.ts | 1 | 1 | 39 | 22.0 | L1 (39) |
| tools/handoff-orchestrator.ts | 26 | 5 | 38 | 36.0 | L1 (28), L216 (22), L787 (36), L1247 (38), L1692 (21) |
| tools/handoff-parse.ts | 8 | 0 | 14 | 40.0 | — |
| tools/handoff-types.ts | 12 | 0 | 18 | 81.9 | — |
| tools/handoff-write.ts | 18 | 0 | 19 | 53.1 | — |
| tools/handoff.ts | 1 | 0 | 15 | 67.7 | — |
| tools/hygiene-scan.ts | 0 | 1 | 25 | 12.2 | L1 (25) |
| **total (25 files, 15 with long blocks)** | **82** | **14** | **52** | — | — |

The totals match the e260a row of the measurement table in `specs/fanout-e260.md`.

## Acceptance Criteria
Commands run from the lane root. `<base>` is b37178a.

- **AC1 (measurement script reproduces the baseline)** — Given the measurement script, when it is run against the base commit, then it prints the totals in the Baseline table.
  proof: `node .current/e260a/measure.mjs --rev b37178a` ends with the line `TOTAL files=25 with-long=15 mid=82 big=14 longest=52`.
- **AC2 (no block over 20 lines)** — Given the 25 files at HEAD, when they are measured, then no comment block counts more than 20 lines.
  proof: `node .current/e260a/measure.mjs --check` exits 0 (it fails on any block over 20, see AC3).
- **AC3 (every 8–20 block trimmed or justified)** — Given the 25 files at HEAD, when they are measured, then every remaining block of 8 to 20 counted lines appears, by `file:start-line` at HEAD, in the keep table of `specs/e260a-tools-a-h-rationale.md` with a one-line reason, and the table lists no block that no longer exists; the code-reviewer copies each kept row into the review report with its own one-line verdict (the shared rule in `specs/fanout-e260.md` puts the keep reason in the review report).
  proof: `node .current/e260a/measure.mjs --check` exits 0 and prints `measure check OK`; the review report under `review_reports/` for this lane has one line per kept block.
- **AC4 (behaviour unchanged)** — Given every `tools/*.ts` file changed by this lane, when each is transpiled with TypeScript `transpileModule` (`removeComments: true`) at `<base>` and at HEAD, then the two outputs are byte-identical.
  proof: `node .current/e260a/prove-neutral.mjs` prints `neutral OK: <n> files` and exits 0.
- **AC5 (scope)** — Given the lane's owned set, when all paths changed since `<base>` (tracked changes plus untracked files) are listed, then each is inside `tools/[a-h]*`, `dist/tools/[a-h]*`, `specs/e260a-*`, `qa_reports/*E260A*`, `review_reports/*E260A*`, or `.current/e260a/**`.
  proof: `node .current/e260a/prove-neutral.mjs` prints no `OUT-OF-SCOPE` line.
- **AC6 (comment style unchanged)** — Given the style rule (a `//` comment stays `//`, JSDoc stays JSDoc; two tests strip `//` lines from `tools/dispatch-log.ts`), when the files are edited, then no changed file has more `/*` comment openers at HEAD than at base, `tools/dispatch-log.ts` has none at all, and every file keeps its `// Coded by @<role>` marker line.
  proof: `node .current/e260a/prove-neutral.mjs` prints no `STYLE` or `MARKER` line.
- **AC7 (comment text pinned by tests survives)** — Given tests that match comment text in this lane's files (listed under Dependencies / Prerequisites), when the files are edited, then each pinned substring is still present at its required place, and no file gains the token `lane-paths` unless it already contained it at base.
  proof: `node .current/e260a/prove-neutral.mjs` prints no `PIN-MISSING` or `NEW-TOKEN` line.
- **AC8 (Generic citation)** — Given the Generic citation rule (a bare ticket id is never the whole explanation; pair it with plain words on the same line), when the comment lines of the 25 files that contain a ticket id are checked, then none is left whose text, with ids, slugs and punctuation removed, has fewer than three words. Stand-alone pointer lines such as `// (E36)` are joined to the sentence they cite or dropped.
  proof: `node .current/e260a/measure.mjs --citations` prints `citations OK` and exits 0; the reviewer samples 20 trimmed comments by eye.
- **AC9 (rationale moved, not lost)** — Given a trimmed block whose reason is still worth keeping (a non-obvious constraint, a hazard, a contract a caller relies on), when it is trimmed, then that reason is written in plain language under a heading in `specs/e260a-tools-a-h-rationale.md`, and the comment keeps at most one pointer line naming that file and heading. History narrative ("originally", "after the bug in ...") is dropped, not moved.
  proof: reviewer judgment; every pointer line in the diff names `specs/e260a-tools-a-h-rationale.md` and a heading that exists there.
- **AC10 (Comment discipline for touched comments)** — Given the Comment discipline rule, when a comment is touched, then a doc comment opens with a one-sentence summary of at most 80 columns, and no comment in the 25 files contains a `##` heading.
  proof: `grep -nE '^\s*(//|\*)\s*##' tools/[a-h]*.ts` prints nothing (base has one hit, `tools/handoff-orchestrator.ts` near line 1051); the summary-line part is reviewer judgment.
- **AC11 (generated output rebuilt and committed)** — Given `tsconfig.json` does not set `removeComments` and emits declarations and source maps, when the sources change, then `npm run build` is run, the changed `dist/tools/[a-h]*` files are committed, and a fresh build after the commit leaves the tree clean.
  proof: after the commit, `npm run build && git status --porcelain` prints nothing.
- **AC12 (scripts obey the rule they enforce)** — Given the two scripts are tracked `.mjs` files under `.current/e260a/` that `agc check` also scans, when they are measured, then neither has a comment block over 7 counted lines nor a comment ratio over 30%, and neither contains an absolute path.
  proof: `node bin/agc-init.mjs check` prints no `agc check — comments` warning naming `.current/e260a/`; `grep -nE '/(Users|home)/' .current/e260a/*.mjs` prints nothing.
- **AC13 (suite unchanged)** — Given the change is comment-only, when the full suite runs on the final HEAD after commit with a clean tree, then it reports 0 failures.
  proof: `node scripts/test-lock.mjs -- npm test` (qa, after commit, clean tree) reports 0 failures.
- **AC14 (hygiene)** — Given the information-hygiene rule, when the trimmed comments and the rationale spec are read, then none adds an absolute path, username, employer-internal link or codename, and none introduces governance jargon where plain words describe the behaviour. Names of real functions, files and config keys stay.
  proof: `git diff b37178a -- tools specs/e260a-tools-a-h-rationale.md | grep -E '^\+' | grep -E '/(Users|home)/|https?://'` prints nothing; the rest is reviewer judgment.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature adds no user-facing strings; string literals, error messages and tool descriptions are out of scope and must not change |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- String literals, error messages, assertion text, tool `description` strings, identifiers, file names.
- Every path outside the owned set: other `tools/**` and `dist/**` (lane e260b owns `tools/{i..z}*`), `bin/**`, `scripts/**`, `gates/**`, `prompts/**`, `schema/**`, `lib/**`, `guards/**`, `transport/**`, `index.ts`, and the common-forbidden list in `specs/fanout-e260.md`.
- Any change under `test/**`. If a test turns red because of a comment edit, stop and report; the coordinator mails the integrator.
- `/*!` comments and `/// <reference` lines (not present in range at base; leave them if found).
- Release bookkeeping (version, CHANGELOG, backlog done-marking): integrator and release-engineer after the wave merges.

## Dependencies / Prerequisites
E258 (comment scan, `dist/tools/comment-scan.js`) shipped. No design file (mode = no-design; Visual Structural Assertions omitted). Resource Audit: zero external references in the backlog row or the fan-out manifest. No clarifications were needed (Question Batch skipped).

Spec authority: `docs/lane-protocol.md`; `specs/fanout-e260.md` sections 「派工前核對」 (measurement), 「測試釘住原始碼註解的地方」, 「所有 lane 共通的範圍」 and the e260a row; the E260 row of `docs/backlog.md`.

**Comment text pinned by tests in this range** (found by the PM's own grep of `test/` at base; the fan-out manifest lists only the `tools/dispatch-log.ts` one for this lane):
- `tools/dispatch-log.ts` — `test/dispatch-log.test.mjs` and `test/lane-paths.test.mjs` treat `//` lines as comments: keep every comment `//`.
- `tools/handoff.ts` — `test/writestate-options-object.test.mjs` (AC-9) greps the file for `@deprecated v3.15.0:`, `options-object overload` and `removal in v4.0.0`. All three substrings stay in the file.
- `tools/feature-rollup.ts` — `test/feature-rollup.test.mjs` (AC2) greps for the literal `SEAM FOR E132`. Keep it.
- `tools/fanout-manifest.ts` — `test/e178a-integrator-role.test.mjs` (AC15) requires the `/** ... */` block directly above `export const PROMPT_TEMPLATE_3B` to stay a doc comment containing `content/skill-integrator.md`, `the single canonical copy` and `E177a render golden`, and the file must not contain `commands/integrator`.
- `test/lane-paths.test.mjs` (CALLERS2) lists the exact files under `tools/` that contain the text `lane-paths`. Do not add that token to a file that lacks it at base.
- `tools/handoff-orchestrator.ts` — several tests slice the source or `dist/tools/handoff-orchestrator.js` around code anchors (`test/ac-execution.test.mjs` I5b, `test/gates-expected-red.test.mjs`, `test/visual-evidence-gate.test.mjs`, `test/source-credibility-gate.test.mjs`, `test/cut-approval-gate.test.mjs`). They anchor on code, not comments; removing comment text only shortens those windows. Do not insert comment text containing `if (` between a guard and its call site.

**Chain**: sr-engineer (pinned `fable`) for all tasks, then one code-reviewer round and one QA round over the whole batch. No architect hop: comment-only, no module or API design.

**Cut shape**: serial inside the lane; tasks partition the files so no two tasks edit the same file (except `tools/handoff-orchestrator.ts`, split by line range and done in order). `specs/e260a-tools-a-h-rationale.md` is appended to by every trim task. Line counts below are counted lines in blocks of 8 or more at base; each task stays within the 5-file / 300-line `task_size` budget.

## Trim rule (for sr-engineer)
For each block over 7 counted lines: keep what the code does and why in as few lines as the reader needs; drop history, restated spec text, lists of call sites, and anything the code already says. A reason still worth keeping that does not fit goes to `specs/e260a-tools-a-h-rationale.md` under a heading named after the file and symbol (for example `### tools/config.ts — loadConfig`), and the comment keeps one pointer line such as `// Why: specs/e260a-tools-a-h-rationale.md, "tools/config.ts — loadConfig".` Keep a block at 8–20 lines only when every line carries caller-facing contract (params, return, constraints, pitfalls); record it in the keep table. Do not reflow code, change blank-line structure outside the comment itself, or change comment style. Run `npm run build` after each task (type check) and both scripts before handing on.

## Verification scripts (T-E260A-01)
Both live in `.current/e260a/`, are committed with the lane, resolve the repo root from `import.meta.url`, import `typescript` and `../../dist/tools/comment-scan.js` relatively, and contain no absolute path.

`prove-neutral.mjs [--base <rev>]` (default base `b37178a`):
- Changed files: `git diff --name-only <base> -- tools`, `.ts` only, not `.d.ts`. For each, transpile the base text (`git show <base>:<file>`) and the working-tree text with `ts.transpileModule(src, { fileName, compilerOptions: { target: ES2022, module: ESNext, removeComments: true } })`; print `DIFF <file>` when the outputs differ.
- Scope: every path from `git diff --name-only <base>` plus `git ls-files --others --exclude-standard` must match the AC5 set; print `OUT-OF-SCOPE <path>` otherwise.
- Style, per changed `tools/*.ts`: print `STYLE <file>` when HEAD has more comment-opening `/*` tokens than base (count block-comment trivia with the TypeScript scanner, so `/*` inside a string or regex is ignored), or when `tools/dispatch-log.ts` has any; print `MARKER <file>` when the `// Coded by @` line count differs from base.
- Pins: the AC7 substrings and placements from Dependencies / Prerequisites; print `PIN-MISSING <file> <text>`. Print `NEW-TOKEN <file> lane-paths` when HEAD contains `lane-paths` and base does not.
- Exit 0 and print `neutral OK: <n> files` only when no line above was printed.

`measure.mjs [--rev <rev>] [--check] [--citations]`:
- Files: `tools/[a-h]*.ts` (not `.d.ts`) from `git ls-files`, or from `git ls-tree` at `--rev`; text from the working tree, or `git show <rev>:<file>`.
- Default output: one row per file (`file | 8-20 | >20 | longest`) then `TOTAL files=<n> with-long=<n> mid=<n> big=<n> longest=<n>`.
- `--check` (working tree only): read the keep table in `specs/e260a-tools-a-h-rationale.md` (rows whose first cell is `` `tools/<file>.ts:<line>` ``); print `OVER-20 <file>:<line> (<n>)` for any block over 20, `UNLISTED <file>:<line> (<n>)` for an 8–20 block not in the table, `STALE <file>:<line>` for a row with no matching 8–20 block. Exit 0 and print `measure check OK: <k> kept blocks` only when none is printed.
- `--citations`: for each comment line containing a ticket id (`E` or `T-` style), strip ids, parenthesised slug tokens, `AC` references and punctuation; print `CITATION <file>:<line>` when fewer than three words remain. Exit 0 and print `citations OK` only when none is printed.

## Rationale file shape (`specs/e260a-tools-a-h-rationale.md`, created by T-E260A-01)
- H1 title, one paragraph saying what the file holds.
- `## Kept blocks` — a table with header `block | counted | reason`; first cell is `` `tools/<file>.ts:<line at HEAD>` ``.
- `## Moved rationale` — one `###` heading per moved reason, named `tools/<file>.ts — <symbol>`, plain language, no history narrative.

## Task cut
| id | desc | depends_on | est. files | touches |
|---|---|---|---|---|
| T-E260A-01 | write `prove-neutral.mjs` and `measure.mjs` per Verification scripts; create the rationale file skeleton; prove AC1 and that both scripts pass on the untouched tree | none | 3 | `.current/e260a/*.mjs`, `specs/e260a-tools-a-h-rationale.md` |
| T-E260A-02 | trim `tools/handoff-orchestrator.ts` base lines 1–531 (8 blocks, 124 lines, incl. L1 28 and L216 22) | T-E260A-01 | 2 | `tools/handoff-orchestrator.ts`, rationale file |
| T-E260A-03 | trim `tools/handoff-orchestrator.ts` base lines 532–1015 (9 blocks, 142 lines, incl. L787 36) | T-E260A-02 | 2 | `tools/handoff-orchestrator.ts`, rationale file |
| T-E260A-04 | trim `tools/handoff-orchestrator.ts` base lines 1016–end (14 blocks, 181 lines, incl. L1247 38 and L1692 21; fix the `##` heading near L1051) | T-E260A-03 | 2 | `tools/handoff-orchestrator.ts`, rationale file |
| T-E260A-05 | trim `tools/handoff-write.ts` (18 blocks, 220 lines) | T-E260A-01 | 2 | `tools/handoff-write.ts`, rationale file |
| T-E260A-06 | trim `tools/handoff-types.ts` (12 blocks, 148) and `tools/handoff.ts` (1 block, 15; keep the AC-9 pinned substrings) | T-E260A-01 | 3 | `tools/handoff-types.ts`, `tools/handoff.ts`, rationale file |
| T-E260A-07 | trim `tools/handoff-parse.ts` (8, 87), `tools/drift.ts` (6, 74), `tools/evidence-file.ts` (3, 34) | T-E260A-01 | 4 | those three files, rationale file |
| T-E260A-08 | trim `tools/feature-rollup.ts` (4, 65; keep `SEAM FOR E132`), `tools/evidence-lookup.ts` (2, 66), `tools/exemptions.ts` (1, 47), `tools/hygiene-scan.ts` (1, 25) | T-E260A-01 | 5 | those four files, rationale file |
| T-E260A-09 | trim `tools/config.ts` (3, 48), `tools/fanout-manifest.ts` (3, 52; keep the PROMPT_TEMPLATE_3B doc-comment pins), `tools/gate-stats.ts` (2, 47), `tools/dispatch-log.ts` (1, 25; `//` only) | T-E260A-01 | 5 | those four files, rationale file |
| ~~T-E260A-10~~ | voided at integrator pre-review: 10 files is over the `task_size` budget; re-cut as T-E260A-11 and T-E260A-12 | — | — | — |
| T-E260A-11 | Generic-citation sweep of `tools/comment-lang-c.ts`, `comment-lang-hash.ts`, `comment-lang-js.ts`, `comment-lang-nested.ts`, `comment-langs.ts` | T-E260A-02..09 | ≤5 | those files (only those with a fix) |
| T-E260A-12 | Generic-citation sweep of `tools/comment-lex.ts`, `comment-python.ts`, `comment-scan.ts`, `comment-tags.ts`, `comment-types.ts`; rebuild `dist/`; run both scripts and `measure.mjs --check` / `--citations` over the full range | T-E260A-11 | ≤5 + dist | those files (only those with a fix), `dist/tools/[a-h]*` (generated by `npm run build`, not counted against `task_size`) |
