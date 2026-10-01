# e260h-test-m-z-eval-comment-trim

Lane `e260h` of the E260 fan-out (wave 2, see `specs/fanout-e260.md`), ticket E260. Task ids `T-E260H-11..26` (ids 01..10 were voided in a re-cut after integrator pre-review).
Scope: the comments in the `test/` files whose names start with m–z (`render-structure` excluded) and the four `.mjs` under `test/eval/`. Base commit `bdbffaf`.

## Problem Statement
The test suite carries long comment blocks written before the Comment discipline rule (constitution section 6) existed. Measured at base with `analyzeText` from `dist/tools/comment-scan.js` (the counter `agc check` uses): 47 owned files, 38 with a long block, 117 blocks of 8–20 counted lines, 30 blocks over 20, the longest 134 lines (`test/verify-release.test.mjs`). Long rationale in a test comment hides what the test protects and drifts from the code. This lane trims those blocks to the threshold the human approved for E260. Rationale still worth keeping moves to a tracked spec and the comment keeps at most one pointer line. Only comments change: assertions, test names, assertion messages and strings stay byte-for-byte the same.

## User Stories
- As a maintainer reading a test, I want a short comment saying what it protects and why, so that I can judge whether it is still needed without reading a page of history.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large comment-only diff without re-reading every assertion.
- As a future editor, I want cut rationale to stay findable from a one-line pointer, so that trimming does not lose it.

## Acceptance Criteria
All commands run from the lane worktree root. `BASE` = `bdbffaf` (the proof script reads `.current/e260h/base-sha`, falling back to `--base`). The owned set is defined once in the proof script as the regex in AC3.

- **AC1 (emit unchanged, human-mandated)**: Given every owned file that differs from BASE, when the base blob and the working file are each transpiled with TypeScript `transpileModule` (`removeComments: true`, target and module ESNext, no source maps), then the two outputs are byte-identical for every file. This also proves no string, test name or assertion changed.
  proof: `node .current/e260h/proof.mjs` prints `emit: <N> files, 0 differ` and exits 0.
- **AC2 (AST leaves unchanged)**: Given the same file set, when each version is parsed with `ts.createSourceFile` and its leaf nodes (kind and text, JSDoc nodes and comments excluded) are listed in source order, then the two lists are identical.
  proof: `node .current/e260h/proof.mjs` prints `leaves: <N> files, 0 differ` and exits 0.
- **AC3 (file scope, none added or removed)**: Given the lane diff against BASE, when it is listed, then every changed `test/` path is an existing owned file, matching `^test/(([m-qs-z][^/]*\.test\.mjs)|((ra|rel|rep|res|rev)[^/]*\.test\.mjs)|(eval/(lib/)?[^/]+\.mjs))$`, none is added or deleted, and nothing else changed except `specs/e260h-*`, `qa_reports/*E260H*`, `review_reports/*E260H*` and `.current/e260h/**`. In particular `test/render-structure.test.mjs`, `test/eval/fixtures/**`, `test/fixtures/**`, `test/context-budget.test.mjs`, every source directory, `dist/**`, `content/**` and the fan-out's shared-forbidden list stay unchanged.
  proof: `node .current/e260h/proof.mjs` prints `scope: ok`.
- **AC4 (no block over 20 lines)**: Given the owned files at HEAD, when each is measured with `analyzeText`, then no comment block counts more than 20 lines. No exception is sanctioned in this lane.
  proof: `node .current/e260h/proof.mjs` prints `>20: 0`.
- **AC5 (blocks of 8 to 20 lines are trimmed or justified)**: Given the 8–20-line blocks the script lists at HEAD, when the review report is read, then each listed block has a one-line reason to keep it in the review report of the task that owns its file. A block cut to 7 or fewer counted lines needs none.
  proof: `node .current/e260h/proof.mjs --list-mid` lists the remaining blocks; the reviewer checks each against the report and the "Retained blocks" table of `specs/e260h-comment-rationale.md` (no single command decides whether a reason is sound).
- **AC6 (rationale kept, comments point to it)**: Given a trimmed block whose rationale is not already in a tracked spec that the comment cites, when the trim lands, then that rationale is in `specs/e260h-comment-rationale.md` under a section named after the test file and the comment keeps at most one pointer line. Where the comment already cites a tracked spec that holds the rationale, the pointer to that spec is enough and nothing is copied. A pointer must name a tracked path.
  proof: `node scripts/check-md-tables.mjs` exits 0 after commit; the reviewer cross-checks the section list of `specs/e260h-comment-rationale.md` against the trimmed files.
- **AC7 (Generic citation)**: Given the comment lines of owned files at HEAD, when scanned, then no comment's only explanation is a bare ticket id, AC or DR reference (an id may stay as a trailing pointer after plain words).
  proof: `node .current/e260h/proof.mjs` prints `bare-id: 0`; the reviewer samples at least 10 trimmed blocks per task for plain-language readability.
- **AC8 (directive comments and form preserved)**: Given every changed file, when its comments are compared with BASE, then no directive comment is removed or altered (`@ts-*`, `eslint-*`, `istanbul`, `c8`, `prettier-ignore`, `__PURE__`, `@vite`/`@vitest`, a `#!` first line), the first line is unchanged (including a `// Coded by @<role>` marker where present), `//` comments stay `//`, JSDoc stays JSDoc (the count of `/*` openers does not rise), no `/*!` or `/// <reference` line differs, and no comment contains a `##` heading.
  proof: `node .current/e260h/proof.mjs` prints `directives: ok` and `form: ok`.
- **AC9 (no test added, removed or renamed)**: Given base and HEAD, when the full suite runs at HEAD, then the pass, skip and fail counts equal the base run recorded by qa (base total 3043 tests, 3040 pass, 0 fail, 3 skipped per the fan-out record).
  proof: `node scripts/test-lock.mjs -- npm test` prints the same counts as the base run.
- **AC10 (suite green on a clean committed tree)**: Given the final HEAD with no untracked files, when the full suite runs, then it exits 0. A red test is reported to the coordinator and integrator, never re-baselined.
  proof: `git status --porcelain | wc -l` prints `0`, then `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` ends with `exit=0`.
- **AC11 (new-text hygiene)**: Given the comment lines added by the lane, when scanned, then none contains an absolute local path, a username, an employer-internal URL, a pinned commit sha, or the text `git show <rev>:<path>` or `git log` (the history-fixture meta-test in `test/render-structure.test.mjs` flags those).
  proof: `node .current/e260h/proof.mjs` prints `hygiene: ok`.

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
- Assertions, test names, assertion messages, strings and template literals (comment-looking text inside a template is a string), filenames, any added or removed test.
- `test/render-structure.test.mjs` (lane e260i), `test/eval/fixtures/**`, `test/fixtures/**` (goldens), `test/context-budget.test.mjs`, every other `test/**` file, all source directories, `dist/**`, and the fan-out's shared-forbidden list.
- File-level comment ratio. Blocks are the E260 measure.
- Release bookkeeping (version, CHANGELOG, backlog done-mark) belongs to release-engineer and the integrator.

## Dependencies / Prerequisites

### Measurement at base (re-run, owned set)
Method: `analyzeText` over `git ls-files test` restricted to the AC3 regex, no fixtures. Result: **47 files, 38 with a long block, 117 blocks of 8–20 counted lines, 30 blocks over 20, longest 134.** The fan-out row says 53 files, 121 and 31; the gap (6 files, 4 blocks of 8–20, 1 over 20) is the 6 `test/_*` helper files, which belong to lane e260e and which the old letter-based count put under e260h. `test/render-structure.test.mjs` was never in e260h's row; it sits in e260i. The integrator measured the same 47 / 38 / 117 / 30 at base. No `test/m*` or `test/n*` file exists. The ACs are defined by the script and the regex, never by these counts. Counted lines in blocks over 7 (a size proxy), by file, largest first:

| file | counted lines in blocks over 7 |
|---|---|
| `test/release-staging.test.mjs` | 545 (35 blocks, 7 over 20) |
| `test/verify-release.test.mjs` | 468 (26 blocks, 3 over 20, longest 134) |
| `test/qa-flow.test.mjs` | 193 |
| `test/reviewer-completed-tasks-gate.test.mjs` | 126 |
| `test/prompt-state-footer.test.mjs` | 101 |
| `test/stale-dispatch-detection.test.mjs` | 78 |
| `test/skill-manifest.test.mjs` | 74 |
| `test/qa-visual-skill-split.test.mjs` | 72 |
| 30 further files | 8 to 48 each, 1,000 or fewer in all |

### Task batches (task_size: at most 5 files and about 300 counted comment lines each)
Counted lines are the sum of `analyzeText` counted sizes of blocks over 7 lines. "Closes" names the ACs a task delivers; a trim task closes AC1–AC8 and AC11 for its own files (checked by `proof.mjs --changed-only`). The base scan found no bare-id comment in any owned file, so no citation-only sweep files are needed; AC7 stays a guard.

| task | owned files (range at base) | files | est. counted lines | closes |
|---|---|---|---|---|
| T-E260H-11 | `.current/e260h/proof.mjs` (no `test/` edit) | 1 | 0 | tooling for AC1–AC5, AC7, AC8, AC11 |
| T-E260H-12 | `specs/e260h-comment-rationale.md` skeleton | 1 | 0 | AC6 (structure) |
| T-E260H-13 | `test/release-staging.test.mjs`, lines 1–1500 | 1 | 281 | AC1–AC8, AC11 |
| T-E260H-14 | `test/release-staging.test.mjs`, lines 1501–end | 1 | 264 | AC1–AC8, AC11 |
| T-E260H-15 | `test/verify-release.test.mjs`, lines 1–1200 (incl. the 134-line header) | 1 | 269 | AC1–AC8, AC11 |
| T-E260H-16 | `test/verify-release.test.mjs`, lines 1201–end | 1 | 199 | AC1–AC8, AC11 |
| T-E260H-17 | `qa-flow`, `prompt-state-footer` | 2 | 294 | AC1–AC8, AC11 |
| T-E260H-18 | `reviewer-completed-tasks-gate`, `stale-dispatch-detection`, `skill-manifest`, `rag` | 4 | 286 | AC1–AC8, AC11 |
| T-E260H-19 | `qa-visual-skill-split`, `source-credibility-gate`, `token-budget-config`, `skill-evolution-v3.11`, `telemetry` | 5 | 231 | AC1–AC8, AC11 |
| T-E260H-20 | `success-metrics`, `pixel-gate-attestation`, `subagent-templates`, `test/eval/scenarios.mjs`, `test/eval/run-eval.mjs` | 5 | 172 | AC1–AC8, AC11 |
| T-E260H-21 | `usage-accounting`, `pixel-perfect-visual-compare`, `schema-versions`, `watermark-check`, `writestate-options-object` | 5 | 146 | AC1–AC8, AC11 |
| T-E260H-22 | `qa-review-scoped-append`, `repro-first-gate`, `visual-gate-e2e`, `p0-onboarding-lite-default`, `test/eval/lib/assertions.mjs` | 5 | 114 | AC1–AC8, AC11 |
| T-E260H-23 | `pixel-perfect-design-coverage`, `researcher-deep-research`, `visual-evidence-gate`, `tasks-versioning`, `test/eval/lib/bundle.mjs` | 5 | 79 | AC1–AC8, AC11 |
| T-E260H-24 | `skill-frontmatter`, `rag-lifecycle`, `token-efficiency`, `visual-round-transitions`, `visual-report-schema-validation` | 5 | 45 | AC1–AC8, AC11 |
| T-E260H-25 | none (last authoring task): lane-wide `proof.mjs`, full suite on the clean committed HEAD, then `qa-engineer:Blocked` | 0 | 0 | AC9, AC10 (lane-wide AC1–AC8, AC11 confirmed) |
| T-E260H-26 | none: fresh Task-dispatched qa verifier, PASS | 0 | 0 | independent re-run of AC1–AC11 |

Unlisted `.test.mjs` files above are all under `test/`. Split tasks on one file (13/14 and 15/16) run in order; the line ranges are at base and the author cuts at block boundaries.

### Per-block disposition (how the author decides each block)
1. Keep what a reader of the test needs now: the behaviour it protects, the non-obvious constraint, the reason in one or two sentences. Drop history ("relocated from", "previously"), restated spec text, AC and DR bookkeeping, narratives of review rounds.
2. If the block already cites a tracked spec that holds the rationale (read the spec, do not assume), keep a one-line pointer and move nothing. Otherwise move the text, lightly edited, to `specs/e260h-comment-rationale.md` under `## <test file>` and leave one pointer line.
3. Target 7 counted lines or fewer. A block may stay at 8–20 only when cutting it removes a contract with no better home (for example the documented shape of a helper's arguments); record a one-line reason in the "Retained blocks" table. Nothing stays above 20.
4. A long comment inside a test body becomes a short note at the test head, or is cut. No code moves, no reflow.
5. Never touch strings or template literals, `/*!`, `/// <reference`, a `#!` line, or a directive comment. Comment text that quotes a rule is not a rule; do not "improve" it by editing a string next to it.
6. Generic citation: any id left in a touched comment gets plain words on the same line.
7. Run `node .current/e260h/proof.mjs --changed-only` after each batch and commit the batch (`test(e260h): E260 T-E260H-NN — …`).

### Behaviour-neutral proof script (`.current/e260h/proof.mjs`, T-E260H-11)
Node ESM, no dependency beyond the repo's `typescript` and `dist/tools/comment-scan.js` (imported relative to `import.meta.url`), no absolute paths. It follows the wave-1 script `.current/history/2026-10/e260d/proof.mjs` (base from `--base` or `.current/e260h/base-sha`, `--changed-only`, `--list-mid`, one line per check, final `proof: PASS` or `proof: FAIL (<checks>)`, exit 1 on FAIL) with these differences:
- **File set**: owned = `git ls-files test` filtered by the AC3 regex; changed = `git diff --name-only <base> -- test` intersected with owned. `scope` fails on any non-owned `test/` path, any added, deleted or renamed file, any untracked file under `test/`, and any diff in the forbidden list (the shared list plus every source directory, `dist`, `test/fixtures`, `test/eval/fixtures`, `test/render-structure.test.mjs`, `test/context-budget.test.mjs`).
- **emit (AC1)**: `ts.transpileModule` with `{ removeComments: true, target: ESNext, module: ESNext }` and the file name kept (`.mjs`), on `git show <base>:<f>` and on the working file; outputs compared byte for byte.
- **leaves (AC2)**: leaf walk as in wave 1, JSDoc kinds skipped, comparing kind and text.
- **directives and form (AC8)**: collect comments through the scanner (leading and trailing trivia of every leaf), keep those matching `@ts-`, `eslint-`, `istanbul`, `c8 `, `prettier-ignore`, `__PURE__`, `@vite`, `@vitest`, and compare the base and HEAD lists exactly; compare the first line; `/*` opener count not higher; `/*!` and `/// <reference` lines equal; no `##` heading in a comment.
- **hygiene (AC11)**: added comment lines (`git diff -U0`) checked for a home-directory path prefix (pattern assembled at run time so the script never holds the literal), an http(s) URL, a 7–40 hex sha, `git show`, `git log`.
- **>20, 8–20, bare-id (AC4, AC5, AC7)**: `analyzeText` over the owned set; the E233 bare-id regex as in wave 1.

### Chain design (same handoff path as E233, PM decision)
Only qa-engineer may write `test/` (Constitution section 2) and builder must not judge (section 3.2), so two distinct qa-engineer contexts bracket an independent code-reviewer. No sr-engineer hop (no source or production-code change; the human's `sr-engineer=fable` pin is recorded and unused), no architect, researcher, design-auditor or qa-visual.
1. After cut approval (the coordinator sets `cut_approved`), author hops: a Task-dispatched qa-engineer writes `qa-engineer:In_Progress`, does T-E260H-11..25 in as many author dispatches as its context needs (each ends committed and with `proof.mjs --changed-only` green; T-E260H-25, the last, runs the full suite on the clean committed HEAD, AC10, before the Blocked write), recording the author evidence under `qa_reports/*E260H*author*`.
2. The last author hop writes `qa-engineer:Blocked`, `next_role: pm`, with the note "qa-engineer: authoring complete, not a failure — the approved cut requires independent review".
3. PM routes `pm:In_Progress` to `code-reviewer:In_Progress` with `resume_of: code-reviewer`. The reviewer judges AC1–AC8 and AC11 and writes APPROVED or CHANGES_REQUESTED (CHANGES_REQUESTED returns to a fresh author dispatch via PM; the review round cap applies).
4. On APPROVED, a FRESH qa-engineer Task dispatch (never an author context) runs T-E260H-26, re-runs AC1–AC11 at the final HEAD with a clean tree (full suite wrapped in `node scripts/test-lock.mjs --`), records evidence under `qa_reports/*E260H*verify*`, and writes PASS.
- Evidence and the rationale spec carry no local absolute path (e234 AC16 catches it); refer to the worktree as `../agent-governance-mcp-lanes/e260h`.
- External references: none (`docs/backlog.md` row E260 and the fan-out spec are tracked). No `external_refs` entry.
- Scope decision: single-feature (non-design, ungated). Batches are serial inside one lane because all of them feed one proof script and one review; no `.current/feature-split.md` is written.
- Tests that read other test files as text (the audit in the fan-out's second-wave premise check found none that read comments): `test/e122-state-render-injection.test.mjs` reads `test/render-structure.test.mjs` and `test/e178a-integrator-role.test.mjs` reads `test/skill-frontmatter.test.mjs`; both read code or assertions, not comments. `test/skill-frontmatter.test.mjs` is owned here, so its assertions must stay untouched. The full suite is the last word.
