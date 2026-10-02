# e260i-budget-render-comment-trim

Lane `e260i` of the E260 fan-out (wave 3, the last lane, see `specs/fanout-e260.md`), ticket E260. Task ids `T-E260I-01..12`.
Scope: the comments in exactly two files, `test/context-budget.test.mjs` and `test/render-structure.test.mjs`. Base commit `ab335b8` (recorded in `.current/e260i/base-sha`).

## Problem Statement
The two largest comment-heavy test files carry long blocks written before the Comment discipline rule (constitution section 6) existed. Measured at base with `analyzeText` from `dist/tools/comment-scan.js` (the counter `agc check` uses): `test/context-budget.test.mjs` (2433 lines) has 31 blocks over 7 counted lines, about 1490 counted lines, of which 20 blocks are 8–20 lines and 11 are over 20 (longest 250); `test/render-structure.test.mjs` (820 lines) has 9 such blocks, about 239 counted lines, 4 of 8–20 and 5 over 20 (longest 69). Together 24 blocks of 8–20 and 16 over 20, matching the fan-out row. Long rationale in a test comment hides what the test protects and drifts from the code. This lane trims those blocks to the threshold the human approved for E260. Rationale still worth keeping moves to a tracked spec and the comment keeps at most one pointer line. Only comments change: assertions, test names, assertion messages, strings, budget numbers and ceilings stay byte-for-byte the same.

## User Stories
- As a maintainer reading a test, I want a short comment saying what it protects and why, so that I can judge whether it is still needed without reading a page of history.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large comment-only diff without re-reading every assertion or budget number.
- As a future editor, I want cut rationale to stay findable from a one-line pointer, so that trimming does not lose it.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `ab335b8` (the proof script reads `.current/e260i/base-sha`, falling back to `--base`). The owned set is defined once in the proof script as the regex in AC3.

- **AC1 (emit unchanged, human-mandated)**: Given each owned file that differs from BASE, when the base blob and the working file are each transpiled with TypeScript `transpileModule` (`removeComments: true`, target and module ESNext, no source maps), then the two outputs are byte-identical for every file. This also proves no string, test name, assertion, budget number or ceiling changed.
  proof: `node .current/e260i/proof.mjs` prints `emit: <N> files, 0 differ` and exits 0.
- **AC2 (AST leaves unchanged)**: Given the same file set, when each version is parsed with `ts.createSourceFile` and its leaf nodes (kind and text, JSDoc nodes and comments excluded) are listed in source order, then the two lists are identical.
  proof: `node .current/e260i/proof.mjs` prints `leaves: <N> files, 0 differ` and exits 0.
- **AC3 (file scope, none added or removed, goldens untouched)**: Given the lane diff against BASE, when it is listed, then every changed `test/` path is one of the two owned files, matching `^test/(context-budget|render-structure)\.test\.mjs$`, none is added, deleted or renamed, and nothing else changed except `specs/e260i-*`, `qa_reports/*E260I*`, `review_reports/*E260I*` and `.current/e260i/**`. In particular `test/fixtures/**` (the goldens) shows zero diff, as do every other `test/**` file, every source directory, `dist/**`, `content/**` and the fan-out's shared-forbidden list.
  proof: `node .current/e260i/proof.mjs` prints `scope: ok`.
- **AC4 (no block over 20 lines)**: Given the owned files at HEAD, when each is measured with `analyzeText`, then no comment block counts more than 20 lines. No exception is sanctioned in this lane.
  proof: `node .current/e260i/proof.mjs` prints `>20: 0`.
- **AC5 (blocks of 8 to 20 lines are trimmed or justified)**: Given the 8–20-line blocks the script lists at HEAD, when the review report is read, then each listed block has a one-line reason to keep it in the review report of the task that owns its range. A block cut to 7 or fewer counted lines needs none.
  proof: `node .current/e260i/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each against the report and the "Retained blocks" table of `specs/e260i-comment-rationale.md` (no single command decides whether a reason is sound).
- **AC6 (rationale kept, comments point to it)**: Given a trimmed block whose rationale is not already in a tracked spec that the comment cites, when the trim lands, then that rationale is in `specs/e260i-comment-rationale.md` under a section named after the test file and the comment keeps at most one pointer line. Where the comment already cites a tracked spec that holds the rationale (read it, do not assume), the pointer to that spec is enough and nothing is copied. A pointer must name a tracked path.
  proof: `node scripts/check-md-tables.mjs` exits 0 after commit; the reviewer cross-checks the section list of `specs/e260i-comment-rationale.md` against the trimmed files.
- **AC7 (Generic citation)**: Given the comment lines of owned files at HEAD, when scanned, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may stay as a trailing pointer after plain words). The scan covers ids starting with E, AC, DR or T- and range forms such as `E1A-1..7`.
  proof: `node .current/e260i/proof.mjs` prints `bare-id: 0`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability and checks each rewritten sentence against the code it describes (transpile and AST cannot catch a wrong sentence).
- **AC8 (directive comments and form preserved)**: Given every changed file, when its comments are compared with BASE, then no directive comment is removed or altered (`@ts-*`, `eslint-*`, `istanbul`, `c8`, `prettier-ignore`, `__PURE__`, `@vite`/`@vitest`, a `#!` first line), the first line is unchanged (the `// Coded by @<role>` marker), `//` comments stay `//`, JSDoc stays JSDoc (the count of `/*` openers does not rise), no `/*!` or `/// <reference` line differs, and no comment contains a `##` heading.
  proof: `node .current/e260i/proof.mjs` prints `directives: ok` and `form: ok`.
- **AC9 (no test added, removed or renamed)**: Given base and HEAD, when the full suite runs at HEAD, then the pass, skip and fail counts equal the base run recorded by qa (base total 3043 tests, 3040 pass, 0 fail, 3 skipped per the fan-out record; qa re-confirms at base).
  proof: `node scripts/test-lock.mjs -- npm test` prints the same counts as the base run.
- **AC10 (suite green on a clean committed tree)**: Given the final HEAD with no untracked files, when the full suite runs, then it exits 0. A red test is reported to the coordinator and integrator, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` ends with `exit=0`.
- **AC11 (new-text hygiene)**: Given the comment lines added by the lane, when scanned, then none contains an absolute local path, a username, an employer-internal URL, a pinned commit sha, or the text `git show <rev>:<path>` or `git log` (the history-fixture meta-test in `test/render-structure.test.mjs` flags those).
  proof: `node .current/e260i/proof.mjs` prints `hygiene: ok`.
- **AC12 (pinned regex lines unchanged)**: Given `test/render-structure.test.mjs`, when HEAD is compared with BASE, then the two code lines `const NUMHEADER_RE = /…/;` and `const BULLET_RE = /…/;` (read as text by `test/e122-state-render-injection.test.mjs`) are byte-identical, each still appears exactly once as a line starting with `const `, and the e122 test stays green. A comment elsewhere in the file may quote either regex; the author checks that the e122 read still resolves to the code line.
  proof: `node .current/e260i/proof.mjs` prints `pinned: ok`; `node --test test/e122-state-render-injection.test.mjs` exits 0.
- **AC13 (new comment lines stay narrow, no reflow to cheat the count)**: Given the comment lines added by the lane, when scanned, then none is wider than 120 columns (the target is about 100), and no changed comment block is a whitespace-only reflow of a base block (same words with line breaks moved) that lowers its counted lines without dropping content.
  proof: `node .current/e260i/proof.mjs` prints `width: ok` and `reflow: ok`.

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
- Assertions, test names, assertion messages, strings and template literals (comment-looking text inside a template is a string), filenames, budget numbers and ceilings, any added or removed test.
- `test/fixtures/**` (goldens), `test/eval/**`, every other `test/**` file, all source directories, `dist/**`, `content/**`, and the fan-out's shared-forbidden list. The goldens must show zero diff: the lane changes comments in test files, not the assembled prompt.
- File-level comment ratio (74.3% and 41.4% at base). Blocks are the E260 measure.
- Release bookkeeping (version, CHANGELOG, backlog done-mark) belongs to release-engineer and the integrator.

## Dependencies / Prerequisites

### Measurement at base (re-run)
Method: `analyzeText` over the two owned files at `ab335b8`. Blocks over 7 counted lines, written `start:counted`.

`test/context-budget.test.mjs`: 31 blocks, 1490 counted lines. 1:29 54:9 127:9 202:8 227:121 353:39 428:20 475:10 495:8 558:10 665:10 682:12 703:8 721:94 826:54 889:8 943:188 1133:34 1175:250 1431:249 1697:10 1732:20 1801:13 1855:8 1941:8 1982:11 2032:183 2217:26 2274:8 2295:20 2354:13.

`test/render-structure.test.mjs`: 9 blocks, 239 counted lines. 1:69 85:9 139:8 157:49 270:22 356:24 439:9 498:41 776:8.

Read-by-other-tests audit: `test/e122-state-render-injection.test.mjs` reads two code lines of `test/render-structure.test.mjs` (AC12); no test reads either file's comments (the second-wave deletion check and the third-wave premise re-check in the fan-out record). The full suite stays the last word.

### Task batches (task_size: at most 5 files and about 300 counted comment lines each)
Counted lines are the sum of `analyzeText` counted sizes of blocks over 7 lines in the range. A single file over 300 counted lines is split into consecutive line ranges cut at block boundaries (ranges are at base; the author keeps each cut at a block boundary even after earlier tasks shift line numbers). "Closes" names the ACs a task delivers; a trim task closes AC1–AC8, AC11, AC12 (render file) and AC13 for its own range (checked by `proof.mjs --changed-only`). Tasks on one file run in order.

| task | owned range (at base) | blocks | est. counted lines | closes |
|---|---|---|---|---|
| T-E260I-01 | `.current/e260i/proof.mjs` (no `test/` edit; qa writes it per the proof section below) | 0 | 0 | tooling for AC1–AC5, AC7, AC8, AC11–AC13 |
| T-E260I-02 | `specs/e260i-comment-rationale.md` skeleton | 0 | 0 | AC6 (structure) |
| T-E260I-03 | `test/context-budget.test.mjs`, lines 1–720 | 13 | 293 | AC1–AC8, AC11, AC13 |
| T-E260I-04 | `test/context-budget.test.mjs`, lines 721–942 | 3 | 156 | AC1–AC8, AC11, AC13 |
| T-E260I-05 | `test/context-budget.test.mjs`, lines 943–1174 | 2 | 222 | AC1–AC8, AC11, AC13 |
| T-E260I-06 | `test/context-budget.test.mjs`, lines 1175–1430 | 1 | 250 | AC1–AC8, AC11, AC13 |
| T-E260I-07 | `test/context-budget.test.mjs`, lines 1431–1696 | 1 | 249 | AC1–AC8, AC11, AC13 |
| T-E260I-08 | `test/context-budget.test.mjs`, lines 1697–2216 | 7 | 253 | AC1–AC8, AC11, AC13 |
| T-E260I-09 | `test/context-budget.test.mjs`, lines 2217–end; `test/render-structure.test.mjs`, lines 1–269 | 4 + 4 | 67 + 135 = 202 | AC1–AC8, AC11–AC13 |
| T-E260I-10 | `test/render-structure.test.mjs`, lines 270–end | 5 | 104 | AC1–AC8, AC11–AC13 |
| T-E260I-11 | none (last authoring task): lane-wide `proof.mjs`, full suite on the clean committed HEAD, then `qa-engineer:Blocked` | 0 | 0 | AC9, AC10 (lane-wide AC1–AC8, AC11–AC13 confirmed) |
| T-E260I-12 | none: fresh Task-dispatched qa verifier, PASS | 0 | 0 | independent re-run of AC1–AC13 |

Block counts per task: T-03 holds 1:29 through 703:8 (13 blocks); T-04 holds 721, 826, 889; T-05 holds 943, 1133; T-06 holds 1175; T-07 holds 1431; T-08 holds 1697 through 2032 (7 blocks); T-09 holds 2217, 2274, 2295, 2354 plus render 1, 85, 139, 157; T-10 holds render 270, 356, 439, 498, 776. Tasks 06 and 07 are each one block of about 250 lines; they stay near the 300 budget and are not split further because a split would cut inside a block.

### Per-block disposition (how the author decides each block)
1. Keep what a reader of the test needs now: the behaviour it protects, the non-obvious constraint, the reason in one or two sentences. Drop history ("relocated from", "previously"), restated spec text, AC and DR bookkeeping, narratives of review rounds.
2. If the block already cites a tracked spec that holds the rationale (read the spec, do not assume), keep a one-line pointer and move nothing. Otherwise move the text, lightly edited, to `specs/e260i-comment-rationale.md` under `## <test file>` and leave one pointer line. The 250-line blocks are likely spec-to-test maps or budget derivations; the moved text keeps the numbers exactly as written in the comment (the test's assertions are the authority for the numbers, the comment is only prose).
3. Target 7 counted lines or fewer. A block may stay at 8–20 only when cutting it removes a contract with no better home; record a one-line reason in the "Retained blocks" table. Nothing stays above 20.
4. A long comment inside a test body becomes a short note at the test head, or is cut. No code moves, no reflow of code.
5. Never touch strings or template literals, `/*!`, `/// <reference`, a `#!` line, or a directive comment. Comment text that quotes a rule is not a rule; do not "improve" it by editing a string next to it. Budget numbers, ceilings and assertion lines are code and stay byte-identical.
6. Every rewritten sentence is checked against the code it describes (a number, a name, a condition). The proof cannot see a wrong sentence; the reviewer samples for it.
7. New comment lines stay within about 100 columns. Never merge lines to reach 7 counted lines: cut words, not line breaks.
8. Generic citation: any id left in a touched comment gets plain words on the same line.
9. Run `node .current/e260i/proof.mjs --changed-only` after each batch and commit the batch (`test(e260i): E260 T-E260I-NN — …`).
10. Negative controls (planting a comment edit or a code edit to prove the proof catches it) run on a copy of the file outside the worktree. Never `git stash` or `git stash drop` or `git stash clear`: the stash would sweep up the role's own uncommitted handoff write.

### Behaviour-neutral proof script (`.current/e260i/proof.mjs`, T-E260I-01)
Node ESM, no dependency beyond the repo's `typescript` and `dist/tools/comment-scan.js` (imported relative to `import.meta.url`), no absolute paths. It follows the wave-2 script `.current/history/2026-10/e260h/proof.mjs` (base from `--base` or `.current/e260i/base-sha`, `--changed-only`, `--list-mid`, one line per check, final `proof: PASS` or `proof: FAIL (<checks>)`, exit 1 on FAIL) with these differences:
- **File set**: owned = `git ls-files test` filtered by the AC3 regex (exactly two files); changed = `git diff --name-only <base> -- test` intersected with owned. `scope` fails on any non-owned `test/` path, any added, deleted or renamed file, any untracked file under `test/`, any diff under `test/fixtures`, and any diff in the forbidden list (the shared list plus every source directory and `dist`).
- **emit (AC1)** and **leaves (AC2)**: as in wave 2 (`transpileModule` with `{ removeComments: true, target: ESNext, module: ESNext }` on `git show <base>:<f>` and the working file, compared byte for byte; leaf walk with JSDoc kinds skipped, comparing kind and text).
- **directives and form (AC8)**: as in wave 2.
- **hygiene (AC11)**: as in wave 2 (home-directory prefix assembled at run time, http(s) URL, 7–40 hex sha, `git show`, `git log` in added comment lines).
- **>20, 8–20 (AC4, AC5)**: `analyzeText` over the owned set.
- **bare-id (AC7)**: widened over wave 2: a comment line whose only substantive content is an id of the form `E<digits+letters>`, `AC<n>`, `DR<n>`, `T-…`, including range forms such as `E1A-1..7` and lists of ids.
- **pinned (AC12)**: the two `const NUMHEADER_RE = …;` and `const BULLET_RE = …;` lines of `test/render-structure.test.mjs` read from BASE and HEAD, compared byte for byte, each present once as a code line.
- **width (AC13)**: any added comment line wider than 120 columns fails; lines over 100 are printed as a warning.
- **reflow (AC13)**: for each base comment block that is gone at HEAD, compare the multiset of words with the HEAD block that overlaps its position; a block whose counted lines fell but whose word multiset is unchanged (whitespace-only reflow) fails. Best effort where feasible: the reviewer's sampling is the backstop.

### Chain design (same handoff path as E233 and e260h, PM decision)
Only qa-engineer may write `test/` (Constitution section 2) and builder must not judge (section 3.2), so two distinct qa-engineer contexts bracket an independent code-reviewer. No sr-engineer hop (no source or production-code change; the human's `sr-engineer=fable` pin is recorded and unused), no architect, researcher, design-auditor or qa-visual.
1. After cut approval (the coordinator sets `cut_approved`), author hops: a Task-dispatched qa-engineer writes `qa-engineer:In_Progress`, does T-E260I-01..10 in as many author dispatches as its context needs (each ends committed and with `proof.mjs --changed-only` green), recording the author evidence under `qa_reports/*E260I*author*`. T-E260I-11, the last, runs the lane-wide proof and the full suite on the clean committed HEAD (AC9, AC10) before the Blocked write.
2. The last author hop writes `qa-engineer:Blocked`, `next_role: pm`, with the note "qa-engineer: authoring complete, not a failure — the approved cut requires independent review".
3. PM routes `pm:In_Progress` to `code-reviewer:In_Progress` with `resume_of: code-reviewer`. The reviewer judges AC1–AC8 and AC11–AC13 and writes APPROVED or CHANGES_REQUESTED (CHANGES_REQUESTED returns to a fresh author dispatch via PM; the review round cap applies).
4. On APPROVED, a FRESH qa-engineer Task dispatch (never an author context) runs T-E260I-12, re-runs AC1–AC13 at the final HEAD with a clean tree (full suite wrapped in `node scripts/test-lock.mjs --`), records evidence under `qa_reports/*E260I*verify*`, and writes PASS.
- Evidence and the rationale spec carry no local absolute path (e234 AC16 catches it); refer to the worktree as `../agent-governance-mcp-lanes/e260i`.
- External references: none (`docs/backlog.md` row E260 and the fan-out spec are tracked). No `external_refs` entry.
- Scope decision: single-feature (non-design, ungated). Tasks are serial inside one lane because all of them feed one proof script and one review; no `.current/feature-split.md` is written.
- Lessons carried from waves 1–2 (backlog rows E269, E271): reflowing lines to hit 7 is rejected; rewritten sentences are checked against code; the bare-id check covers range forms; negative controls run on a copy outside the worktree.
