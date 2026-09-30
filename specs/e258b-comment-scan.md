# e258b-comment-scan

## Problem Statement
E258 found that nothing limits how long a code comment may be: one adopter repo measured 61% comment lines in its source, single files at 61-69%, and doc comments up to 168 lines that are a spec pasted into code. The rule prose (constitution section 6, lane e258a) tells agents what a comment should say; nothing mechanical shows a maintainer or a reviewer where a change made comments too long. `agc check` already runs five advisory checks that warn without changing the exit code; it gets a sixth, a comment-length scan that looks only at what the current change adds. Numbers flag, the reviewer judges: the scan never blocks and never rewrites.

## User Stories
- As a maintainer about to commit, I want `agc check` to name the files and comment blocks my change made too long, so that I can trim them before review.
- As a code-reviewer, I want each warning to be a stable, greppable line starting with `agc check — comments`, so that I can keep it with a reason or send it back.
- As a maintainer of a repo that already has long comments, I want the scan to stay silent about code my change did not touch, so that every edit does not re-flag old debt.
- As a CI user, I want `agc check`'s exit code to be the same whatever the scan finds, so that an advisory never fails a build.

## Decisions (PM, binding on architect unless flagged "architect may refine")

### D1 — Thresholds (human ruling 2026-09-30, fixed constants, no config key)
- File ratio: comment lines / non-blank lines **> 30%** (strictly greater; exactly 30% is silent).
- Block length: a single comment block of **> 7 lines** (8 or more warns).
- The two numbers are exported constants of the scan module; there is no env var and no `.config.json` key.

### D2 — Diff scope and baseline
- The scan inspects only lines the current change adds. The change is the working tree compared with a **base commit**, so committed-on-branch work, staged edits, unstaged edits and untracked non-ignored files are all in scope. An untracked file counts as entirely added.
- **Base commit** = `git merge-base HEAD <ref>` for the first ref that exists of: the branch's upstream (`@{upstream}`), `origin/main`, `origin/master`, `main`, `master`. If no ref exists, or the merge-base cannot be computed, the base is `HEAD` (uncommitted and untracked work only).
- Comparison is `git diff` of the working tree against the base with zero context (`-U0`), quoting disabled (`core.quotePath=false`). Added-line numbers come from the new-side hunk ranges, so a file's added lines are exactly the lines that differ from the base. Deleted files are skipped. A renamed file is scanned only for the lines git reports as added.
- **Not a git repo, or no commit yet (no `HEAD`)**: the scan prints nothing and does nothing. This keeps every non-git or empty temp workspace used by existing tests silent.
- **Architect may refine** the exact git argv, rename handling and ref order, but not the observable rules above.

### D3 — Files in scope
- Extensions `.ts .tsx .js .jsx .mjs` only (the set E258 measured). Excluded: any path with a `dist/` or `node_modules/` segment, and `.d.ts` files.
- Test files and fixtures with those extensions are in scope (E258 measured tests too).
- A file is content-scanned only if it is a regular file (not a symlink), 1 MiB or less, with no NUL byte in its first 8 KiB; otherwise skipped silently.

### D4 — What counts as a comment line and a block
- Supported syntax: `//` line comments and `/* ... */` block comments (including `/** ... */`). No other language is scanned (`#` comments, HTML, CSS are out).
- A **comment line** is a physical line whose only non-whitespace content is comment text (or comment delimiters). A line with code followed by a trailing comment is a code line, not a comment line. Blank lines are not non-blank lines for the ratio.
- A **block** is a maximal run of consecutive comment lines (no blank line, no code line between): consecutive `//` lines form one block; one `/* */` span is one block. A `/* */` span directly followed or preceded by `//` lines on adjacent lines is one block.
- A `//` or `/*` inside a string literal (`'` `"`), a template literal, or a regex literal is not a comment. The lexer needs only enough state to get these right for ordinary TypeScript/JavaScript; it does not parse. **Architect may refine** the heuristic (for example regex-literal detection), and must list its known misreads in the architecture doc.
- **Block length** counts every physical line of the block except lines consisting only of the delimiters `/*`, `/**` or `*/`. So a `/** ... */` holding exactly 7 lines of text is silent.
- A shebang line is not a comment. A block containing `@ts-` or `eslint-` directives is an ordinary block (no special case).

### D5 — JSDoc tag exclusion (R1 c)
Inside a block, from a line whose text (after the comment leader and any `*`) begins with `@param`, `@returns`, `@return`, `@throws` or `@example`, every following line up to (not including) the next line that begins with any `@` tag, or to the end of the block, is **excluded from the block-length count** (tag line, continuation lines, and the whole `@example` body). Other tags (`@see`, `@deprecated`, `@internal`) count as prose. The exclusion applies to the block-length count **only**; the file ratio counts every comment line.

### D6 — When a warning fires (R1 a, b)
- **`long-block`**: a block whose counted length (D4, D5) is > 7 **and** at least one line of the block is in the diff's added set (covers "adds or lengthens"). Reported once per block, at the block's first line.
- **`high-ratio`**: the file's ratio (post-change file, D1) is > 30% **and** the file has at least 50 non-blank lines **and** the diff adds at least one comment line to the file. A diff that adds only code lines to an over-ratio file is silent. Files under 50 non-blank lines are exempt from the ratio check only; `long-block` still applies to them.

### D7 — Output
- Every line goes to **stderr** and starts with `agc check — comments`. Nothing goes to stdout.
- One line per hit, sorted by path then line; file-level `high-ratio` hits have no line number.
- **Cap**: at most 50 hit lines, then one `comments.more` line.
- **Summary**: when at least one hit is listed, one `comments.summary` line follows (this is the line e258a's reviewer check may also grep).
- **Silence**: no hits and no error means no output at all.
- **Errors**: an unexpected error inside the scan, or a scan module that cannot load, prints one fixed-text `comments.error` line (never the raw error, because import errors carry an absolute install path) and `agc check` carries on.
- The scan runs in `runCheck()` right after the hygiene scan and before the adapter-stamp check. It **never** changes the exit code in any branch.

### D8 — Module shape (architect decides; PM expectation)
Scan logic in a new `tools/comment-scan.ts` (compiled to `dist/tools/comment-scan.js`), a pure layer (source text + added-line set in, findings out) split from an I/O layer (git, fs). `bin/agc-init.mjs` adds `loadCommentScan()` and `checkComments(cwd)` mirroring `loadHygieneScan` / `checkHygiene`. Imports limited to `fs`, `path`, `node:child_process` (`execFileSync` with an argv array, never a shell); no other `tools/` module is imported. The module's own source must keep constant names clear of the UPPER_SNAKE gate-code pattern (`test/error-code-contract.test.mjs` harvests `tools/*.ts`). The architect makes the final call on names, the exported surface and whether the logic stays out of `bin/`.

## Acceptance Criteria
All proofs refer to `test/e258b-comment-scan.test.mjs` (qa-authored). Tests build every input at runtime inside temp git repos; committed long-comment sample text lives in `test/fixtures/e258b/*.fixture.txt` (an extension the scan never reads), so no tracked `.ts/.js/.mjs` file added by this lane trips its own scan. Every case deletes nothing from the environment (the scan has no env input) and runs `node bin/agc-init.mjs check` with the temp repo as cwd.

- **AC1 (exit-code invariance)** — Given a workspace with current adapters and a diff that produces warnings of both kinds, when `agc check` runs, then its exit code equals that of the same workspace with the warnings removed (0); the same holds with stale adapters (1).
  proof: `node --test --test-name-pattern "AC1" test/e258b-comment-scan.test.mjs`
- **AC2 (block threshold)** — Given new `.ts` files containing a 7-line and an 8-line `//` block, when `agc check` runs, then only the 8-line block is reported, as a `long-block` line naming the path and the block's first line number and the length 8.
  proof: `node --test --test-name-pattern "AC2" test/e258b-comment-scan.test.mjs`
- **AC3 (block only when the diff adds or lengthens it)** — Given a committed 10-line block, when an unrelated line elsewhere in the file changes, then nothing is reported; when one line is added inside the block, or a line of it is edited, then it is reported.
  proof: `node --test --test-name-pattern "AC3" test/e258b-comment-scan.test.mjs`
- **AC4 (ratio threshold and trigger)** — Given a file of at least 50 non-blank lines, when its comment ratio is 31% and the diff adds a comment line, then a `high-ratio` line names the file and the percentage; at exactly 30% nothing is reported; when the file is over 30% but the diff adds only code lines, nothing is reported.
  proof: `node --test --test-name-pattern "AC4" test/e258b-comment-scan.test.mjs`
- **AC5 (small-file exemption)** — Given a file with 49 non-blank lines at 60% comments in blocks of 7 or fewer lines, when `agc check` runs, then no `high-ratio` line is printed; given the same file with one 8-line block, then a `long-block` line is printed.
  proof: `node --test --test-name-pattern "AC5" test/e258b-comment-scan.test.mjs`
- **AC6 (JSDoc tag exclusion)** — Given a `/** */` block of 5 prose lines plus `@param`, `@returns`, `@throws` lines and an `@example` body totalling more than 7 lines, then nothing is reported; given 8 prose lines, then it is reported; given `@see` lines pushing the prose count past 7, then it is reported; the delimiter-only lines `/**` and `*/` are never counted.
  proof: `node --test --test-name-pattern "AC6" test/e258b-comment-scan.test.mjs`
- **AC7 (comment syntax)** — Given files where `//` and `/*` appear inside string, template and regex literals, a trailing comment after code, a blank line inside a run of `//` lines, and a `/* */` span, when `agc check` runs, then literals are not counted as comments, a trailing comment is not a comment line, a blank line splits one run into two blocks, and a `/* */` span is one block.
  proof: `node --test --test-name-pattern "AC7" test/e258b-comment-scan.test.mjs`
- **AC8 (file scope)** — Given hit-shaped long blocks in `a.ts`, `b.tsx`, `c.js`, `d.jsx`, `e.mjs`, `x.d.ts`, `dist/y.js`, `node_modules/z/i.js` and `w.py`, when `agc check` runs, then only the first five are reported; a symlink, a file over 1 MiB and a file with a NUL byte in its first 8 KiB are skipped silently.
  proof: `node --test --test-name-pattern "AC8" test/e258b-comment-scan.test.mjs`
- **AC9 (baseline)** — Given a repo on a branch one commit ahead of `main` (no upstream), when the branch's own commit adds a long block, then it is reported; given staged, unstaged and untracked additions, each is reported; given a tracked file deleted in the working tree, nothing is reported for it; given an upstream configured, the merge-base with the upstream is used instead; given no `main`, `master` or remote ref, only uncommitted and untracked work is reported.
  proof: `node --test --test-name-pattern "AC9" test/e258b-comment-scan.test.mjs`
- **AC10 (no git, no commit)** — Given a directory that is not a git repo, and given a git repo with no commit yet, each containing a long block, when `agc check` runs, then no `agc check — comments` line is printed and the exit code is unchanged.
  proof: `node --test --test-name-pattern "AC10" test/e258b-comment-scan.test.mjs`
- **AC11 (output shape, cap, silence)** — Given 60 over-threshold blocks, when `agc check` runs, then exactly 50 hit lines, one `comments.more` line naming 10, and one `comments.summary` line are printed, all on stderr and each starting with `agc check — comments`, none on stdout; given a clean diff, no such line is printed.
  proof: `node --test --test-name-pattern "AC11" test/e258b-comment-scan.test.mjs`
- **AC12 (resilience)** — Given the compiled scan module is absent or throws, when `agc check` runs, then exactly one `comments.error` line is printed, it contains no absolute path, and the exit code is unchanged.
  proof: `node --test --test-name-pattern "AC12" test/e258b-comment-scan.test.mjs`
- **AC13 (existing pinned-output tests stay green)** — Given the scan is wired in, when the existing tests that pin `agc check` output run, then they pass without the scan printing any line in their cases. If a case does print an `agc check — comments` line, qa adds that prefix to the existing hygiene-line filter helper in that test file (assertions otherwise unchanged); if none does, those two files are not touched.
  proof: `node --test test/agc-adapters.test.mjs test/e106-init-artifacts-flag.test.mjs`
- **AC14 (this repo reads clean at HEAD, hermetic)** — Given an isolated copy of this repo's committed HEAD tree in a fresh temp git repo (never the live checkout), when `node bin/agc-init.mjs check` runs there, then no `agc check — comments` line is printed.
  proof: `node --test --test-name-pattern "AC14" test/e258b-comment-scan.test.mjs`
  note: under D2 this copy's base is HEAD, so the diff is empty; AC14 is a smoke test (no crash, no output on committed state), not a content check. Content is covered by AC14b and by the lane-diff evidence below (architect OQ1, integrator to-lane#2).
- **AC14b (the scan module passes its own limits)** — Given `dist/tools/comment-scan.js`, when its pure analysis function runs on the source text of `tools/comment-scan.ts`, then no block has more than 7 counted lines and the file ratio is 30% or less. Independent of git history.
  proof: `node --test --test-name-pattern "AC14b" test/e258b-comment-scan.test.mjs`
- **Lane-diff evidence (task evidence, not a resident test)** — T-E258B-03's handoff and the code-review report each quote the actual output of `node bin/agc-init.mjs check` run in the lane worktree after commit, listing every `agc check — comments` line or stating there were none. A `high-ratio` line on `bin/agc-init.mjs` (already over 30% before this lane) is kept by code-reviewer with a one-line reason; trailing comments are never used to carry explanatory prose to avoid it.
- **AC15 (docs sync)** — Given the change, when a reader opens `docs/install.md`'s `agc check` advisory paragraph and `docs/config.md`'s `agc check` rows, then both describe the comment scan: advisory and exit-code-neutral, diff-only, the two thresholds, the 50-line exemption for the ratio, the JSDoc tag rule, the file types (stating that only `.ts/.tsx/.js/.jsx/.mjs` are scanned, so silence on other languages is not a clean result), the `agc check — comments` prefix. No other section of those files changes.
  proof: `git diff 2484ede...HEAD -- docs/install.md docs/config.md` shows only the `agc check` advisory paragraph and rows changed, and each contains the string `agc check — comments`.
- **AC16 (lane boundary, prompts unchanged)** — Given the lane's commits, when the changed paths are listed, then every path is within the owned set (`bin/agc-init.mjs`, `tools/comment-scan.ts`, `dist/tools/comment-scan.*`, the two docs sections, `test/e258b-*`, `test/fixtures/e258b/**`, `specs/e258b-*`, `qa_reports/*E258B*`, `review_reports/*E258B*`, `.current/e258b/**`, plus the two pre-reassigned helper test files only if AC13 required it), and nothing under `content/**` or the compose goldens changed.
  proof: `git diff --name-only 2484ede...HEAD`

### AC -> implementing task
| AC | implementing task(s) |
|---|---|
| AC2, AC3, AC4, AC5, AC6, AC7 | T-E258B-01 (pure layer), T-E258B-02 (added-line set wired) |
| AC8, AC9, AC10, AC11 | T-E258B-02 |
| AC1, AC12, AC13, AC14, lane-diff evidence | T-E258B-03 |
| AC14b | T-E258B-01 (module comments within limits), T-E258B-05 (test) |
| AC15 | T-E258B-04 |
| AC16 | T-E258B-03 (owned-set discipline), T-E258B-05 (verifies) |
| all (tests) | T-E258B-05 (qa authors `test/e258b-comment-scan.test.mjs`, fixtures, optional helper filters) |

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| comments.block | `agc check — comments: {path}:{line} long-block {n} lines (limit 7)` | authored-here — mirrors the E234 hit line; file:line is clickable |
| comments.ratio | `agc check — comments: {path} high-ratio {pct}% of {n} non-blank lines are comments (limit 30%)` | authored-here — a file-level hit has no line number |
| comments.more | `agc check — comments: … {n} more warning(s) not listed` | authored-here — the D7 cap |
| comments.summary | `agc check — comments: {n} warning(s) in {m} file(s) (only .ts/.tsx/.js/.jsx/.mjs are scanned) — advisory; keep a comment to WHAT and WHY, move long rationale to a tracked spec or the commit message (see Comment discipline, constitution section 6)` | authored-here — names the rule e258a adds by its bullet name (integrator pre-review to-lane#1 (1)); states the file-type coverage so silence on other languages is not read as clean (to-lane#1 (3a)); interface prefix fixed by specs/fanout-e258.md |
| comments.error | `agc check — comments: scan skipped ({why})` | authored-here — mirrors `hyg.error`; `{why}` is fixed text, never a raw error |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Blocking (any exit-code change), auto-fixing, rewriting existing comments.
- Whole-repo sweeps, history scanning, a pre-commit hook.
- In-function comment detection (needs an AST; a later ticket).
- Languages beyond `.ts .tsx .js .jsx .mjs`; `.cjs/.mts/.cts`, Python and shell comments. Follow-up filed as pending-ticket `E258B-NEW-1` (integrator pre-review to-lane#1 (3b)).
- Config keys, env vars or inline suppression markers for the thresholds.
- License-header or shebang special cases beyond D4 (a long license header added in a diff is reported like any block).
- Rule prose, reviewer SOP, compose goldens, context budget (lane e258a).

## Dependencies / Prerequisites
- E234 done (precedent shape), E231 done.
- Interface contract (`specs/fanout-e258.md`): every output line starts with `agc check — comments`; all other wording is this lane's.
- Human rulings binding (`specs/fanout-e258.md` Decisions, R1): thresholds 30% / 7 lines / diff-only; refinements (a), (b), (c) applied as D5/D6. Not relitigated.
- PM decisions to confirm at cut (not human-ruled): baseline = merge-base with upstream/origin-main/main, else HEAD (D2); no-git and no-commit are silent (D2); JSDoc exclusion applies to block length only, not the ratio (D5); delimiter-only lines are not counted (D4); trailing comments are code lines (D4).
- Lane boundary: `test/agc-adapters.test.mjs` and `test/e106-init-artifacts-flag.test.mjs` are touched only if AC13 shows the scan printing in those cases. Shared generated artifacts are not touched.
- Architect hop: **yes** (D4 lexer heuristic and its known misreads, D2 git argv and edge cases, D8 module surface, pure/I-O split). The architect's Open Questions go to the integrator mailbox for a second pre-review, per `docs/lane-protocol.md` section 5 rule 2.
- Visual Structural Assertions: omitted (no `design/<feature>.md`, mode = no-design).
