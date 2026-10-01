# e260c-bin-scripts

Lane e260c of the E260 fan-out (backlog row E260; lane table in `specs/fanout-e260.md`). Base commit b37178a, branch `feat/e260c-bin-scripts`.

## Problem Statement
The JS files under `bin/` and `scripts/` (19 files, all `.mjs`, not compiled) carry long comment blocks that predate the Comment discipline rule (constitution section 6, enforced as an `agc check` advisory by E258/E259). Re-measured at base with `analyzeText` from `dist/tools/comment-scan.js` (same counting as `agc check`): 58 blocks of 8-20 counted lines and 17 blocks over 20, longest 81 lines, in 17 of the 19 files. This lane trims them. Comments only; program behaviour must not change.

Per-file baseline (`mid` = 8-20 lines, `large` = over 20, `max` = longest block):

| file | mid | large | max |
|---|---|---|---|
| bin/agc-init.mjs | 30 | 7 | 61 |
| bin/agent-governance-context.mjs | 5 | 0 | 16 |
| bin/agent-governance-usage-hook.mjs | 0 | 1 | 24 |
| scripts/capture-constitution-golden.mjs | 1 | 1 | 43 |
| scripts/check-md-tables.mjs | 6 | 3 | 61 |
| scripts/check-transitions-sync.mjs | 0 | 1 | 37 |
| scripts/check-version.mjs | 2 | 0 | 9 |
| scripts/fanout.mjs | 1 | 0 | 13 |
| scripts/feature-rollup.mjs | 1 | 0 | 16 |
| scripts/join-precondition.mjs | 1 | 0 | 16 |
| scripts/lane-status.mjs | 1 | 0 | 15 |
| scripts/mailbox-watch.mjs | 0 | 1 | 46 |
| scripts/measure-context-cost.mjs | 2 | 0 | 16 |
| scripts/merge-invariants.mjs | 1 | 0 | 13 |
| scripts/summarize-metrics.mjs | 1 | 0 | 14 |
| scripts/test-lock.mjs | 1 | 1 | 48 |
| scripts/verify-release.mjs | 5 | 2 | 81 |
| total | 58 | 17 | 81 |

(`scripts/smoke-qa-flow.mjs` and `scripts/smoke-rag.mjs` already have no block of 8 or more lines.) Sums match the fan-out measurement: 58 mid, 17 large, longest 81.

## User Stories
- As a contributor reading `bin/` or `scripts/`, I want comments that state what and why in a few lines, so that I can read the code instead of paragraphs of history.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large trim without reading every hunk for logic.

## Acceptance Criteria
- **AC1 (behaviour invariance)** — Given every JS file under `bin/` and `scripts/` changed by this lane, when each is transpiled with TypeScript `transpileModule` and `removeComments: true` at base b37178a and at HEAD, then the two outputs are byte-identical per file.
  proof: `node .current/e260c/check-invariance.mjs` prints `invariance OK: <n> files` and exits 0.
- **AC2 (threshold met)** — Given the common threshold, when `analyzeText` re-measures every in-scope file, then no block has more than 20 counted lines, and every block of 8-20 counted lines is either trimmed to 7 or fewer, or has a one-line keep reason in `review_reports/` for that block.
  proof: `node .current/e260c/measure.mjs` lists blocks of 8 or more counted lines; `node .current/e260c/measure.mjs --fail-over 20` exits 0; the review report enumerates each remaining 8-20 block with its reason.
- **AC3 (rationale preserved)** — Given a comment holds reasoning still worth keeping, when it is trimmed, then the reasoning is moved into the "Kept rationale" section of this spec first and the comment keeps at most a one-line pointer (`see specs/e260c-bin-scripts.md`).
  proof: `grep -c 'e260c-bin-scripts' <file>` is at least 1 for each file that has a "Kept rationale" entry (reviewer cross-checks entries against the diff).
- **AC4 (no non-comment text touched)** — Given strings, usage text, CLI output, error messages and identifiers are behaviour, when the diff is inspected, then every added or removed line is a comment line or a blank line adjacent to one.
  proof: AC1 passes, and `git diff -U0 b37178a -- bin scripts | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)'` prints nothing except trailing-comment tails, each listed and justified in the review.
- **AC5 (markers and styles kept)** — Given the `// Coded by @<role>` line, shebang lines, `/*!` blocks and comment styles are conventions, when the files are edited, then each is preserved and no `//` comment becomes `/* */` (or the reverse).
  proof: `git diff b37178a -- bin scripts | grep -E '^-(#!|// Coded by|/\*!)'` prints nothing; `git diff b37178a -- bin scripts | grep -E '^\+\s*/\*' | wc -l` is no greater than the count of removed `/*` lines.
- **AC6 (generic citations)** — Given a comment in scope whose only text is a ticket id, when this pass finishes, then it states the behaviour in words with the id as a trailing pointer.
  proof: reviewer samples 20 retained or rewritten comments; none is a bare id.
- **AC7 (hygiene)** — Given tracked files must not carry local paths, when the diff is added, then no added line contains an absolute home path or a worktree path.
  proof: `git diff b37178a | grep -E '^\+' | grep -E '/U[s]ers/|/h[o]me/'` prints nothing.
- **AC8 (scope containment)** — Given the owned-file list, when the branch diff is listed, then every changed path is under `bin/`, `scripts/`, `specs/e260c-`, `qa_reports/*E260C*`, `review_reports/*E260C*` or `.current/e260c/`.
  proof: `git diff --name-only b37178a | grep -vE '^(bin/|scripts/|specs/e260c-|qa_reports/.*E260C|review_reports/.*E260C|\.current/e260c/)'` prints nothing.
- **AC9 (suite green)** — Given the change is comment-only, when the full suite runs after the final commit with a clean tree, then it passes.
  proof: `node scripts/test-lock.mjs -- npm test` reports 0 failures (run by qa).

## Verification approach
Scripts live under `.current/e260c/` (tracked with the lane) and are written in T-E260C-01:
- `check-invariance.mjs [--base b37178a]`: lists `git diff --name-only <base> -- bin scripts` filtered to JS; for each, reads the base text with `git show <base>:<path>` and the working text, runs `ts.transpileModule(text, { compilerOptions: { removeComments: true, target: "ES2022", module: "ESNext" }, fileName: <path> })` (TypeScript from `node_modules`), and compares `outputText` byte for byte. Prints `invariance OK: <n> files` or each differing path, exit 1.
- `measure.mjs [--fail-over N]`: imports `analyzeText` from `dist/tools/comment-scan.js`; prints, per in-scope file, the `start:counted` of each block of 8 or more and totals (mid, large, longest). With `--fail-over N` exits 1 if any block exceeds N.
Some tests pin comment text in a few in-scope files; those pins are listed in the sr-engineer brief and the review report, not here. The full suite is the judge.
A trailing note: `check-invariance.mjs` is scoped to the changed files, so unchanged files pass trivially.

## Slicing
Tasks are cut so one sr-engineer session handles at most about 15 blocks and at most 5 files (task_size budget), never splitting a block across tasks. The eight small `scripts/` files are two tasks of four files each: T-E260C-10 (`fanout`, `feature-rollup`, `join-precondition`, `lane-status`) and T-E260C-09 (`mailbox-watch`, `measure-context-cost`, `merge-invariants`, `summarize-metrics`). `bin/agc-init.mjs` (3735 lines, 37 blocks) is split by line range at base: A = lines 1-900 (14 blocks), B = lines 901-2200 (15 blocks), C = lines 2201-end (8 blocks).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature adds no user-facing strings (string literals, CLI output and usage text are out of scope and must not change) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- CLI output and usage text (strings), any logic change, non-JS files (E259), `tools/`, `dist/`, `test/` and every other directory listed as forbidden in the lane table.
- `docs/backlog.md`, release bookkeeping (release-engineer).

## Dependencies / Prerequisites
E258 (done). No design file (mode = no-design), so Visual Structural Assertions are omitted. No external references found in the supplied requirement documents beyond in-repo paths. Pinned comment strings: none found in `test/` for `bin/` or `scripts/` at the fan-out check; the full suite is the final judge.

## Kept rationale
Appended by sr-engineer as blocks are trimmed: one entry per moved rationale, headed with file and a short topic, written in plain words. Empty at cut time.
