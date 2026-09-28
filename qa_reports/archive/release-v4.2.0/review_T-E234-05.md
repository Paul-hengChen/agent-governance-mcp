# QA Review — T-E234-05

covers: T-E234-01, T-E234-02, T-E234-03, T-E234-04, T-E234-05

Feature: e234-hygiene-scan. Spec: specs/e234-hygiene-scan.md (AC1-AC18). Code review: review_reports/review_T-E234-01.md (round 3 APPROVED at ff3071a).

## Expected-Red Diff

Manifest: qa_reports/expected-red_e234-hygiene-scan.txt (4 entries). Full `npm test` run BEFORE any re-baseline edit, at ff3071a plus the uncommitted lane state files only: 2926 tests, 2919 pass, 4 fail, exit 1. The 4 failing tests are exactly the 4 manifest entries:

- test/agc-adapters.test.mjs | AC-6 — red, on manifest (extra `hyg.kw.none` line on stderr)
- test/agc-adapters.test.mjs | AC-7 — red, on manifest (same cause)
- test/agc-adapters.test.mjs | E111(iv) — red, on manifest (same cause)
- test/e106-init-artifacts-flag.test.mjs | AC12 — red, on manifest (same cause)

Phase 0.5: clean (4/4 manifest entries confirmed red, 0 unexplained reds).

Re-baseline (integrator re-draw, mailbox to-lane#4): in each of the 4 test() bodies only, the stderr is filtered to drop lines starting with `agc check — hygiene` immediately before the existing stderr assertion, and the assertion itself is unchanged byte for byte (`r.stderr = withoutHygieneLines(r.stderr);`). One helper `withoutHygieneLines` per file, placed directly above its first user (AC-6 in test/agc-adapters.test.mjs, AC12 in test/e106-init-artifacts-flag.test.mjs). No env var, no empty keyword file, no other test(), fixture, setup or import touched. After the edit both files pass 57/57; no fifth case went red.

Manifest retired: all 4 entries are now green, so qa_reports/expected-red_e234-hygiene-scan.txt is removed in the same commit as the re-baseline.

## Phase 1 — Review

Implementation read: tools/hygiene-scan.ts (pure layer: shape patterns, isPlaceholderSegment, parseKeywordList, compileKeywordMatcher with spans/maskSpans, classifyLine, maskText, escapeForDisplay, formatReport; I/O layer: listScanSet, walkWorkspace, resolveKeywordSource, loadKeywordFile, scanWorkspace, runHygieneScan) and bin/agc-init.mjs checkHygiene/loadHygieneScan plus the runCheck() call site (after checkArtifactsDrift, before the adapter-stamp loop). No correctness finding beyond what code review already closed. Nothing to escalate.

### 3a Copy Audit Gate
Every Copy / Strings entry was compared with `hygieneCopy`:
- hyg.hit, hyg.hit.name — verbatim format; parsed by the tests' hit parser in every AC.
- hyg.more, hyg.summary, hyg.skipped, hyg.kw.none, hyg.kw.unreadable, hyg.kw.refused, hyg.kw.tracked — verbatim; each asserted as an exact string in AC12, AC10, AC7, AC8, AC11 and AC16.
- hyg.walk.capped — verbatim (code read).
- hyg.error — `scan skipped ({message})` verbatim; the bin fills `{message}` with fixed text on load failure / unexpected throw, the module with the masked, escaped error message. AC15 asserts the shape.
No drift. No user-facing string outside the table (the bin's two `{message}` values fill the hyg.error template).

### 3b Visual Audit Gate
Spec Visual Tokens: N/A (no visual literals). Nothing to check.

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no Visual Baselines declared) — no design/e234-hygiene-scan.md.

## Phase 2
No issues found in Phase 1; no discussion round.

## Phase 3 — Tests

Placement: the dispatch brief's `Test-file placement` line — create test/e234-hygiene-scan.test.mjs (no existing coverage). No fixtures needed; every input is built at runtime.

Test rules followed:
- Every hit-bearing input is written at runtime into temp git repos (or a temp non-git dir for AC14) under os.tmpdir().
- Keywords are synthetic nonsense words.
- Hit-shaped strings are assembled by concatenation in a `shape` table. Checked: running the module's classifyLine over every line of the test file flags 0 lines, and AC16 covers it once committed.
- Hermetic env: every child run uses `baseEnv()`, which deletes AGC_HYGIENE_KEYWORDS and sets GIT_CONFIG_NOSYSTEM, GIT_CONFIG_GLOBAL (an empty temp file) and GIT_CEILING_DIRECTORIES. Each temp repo has its own git dir, so no default keyword file leaks in from the checkout.
- AC16 extracts `git archive HEAD` into a fresh temp repo with its own git dir; it never runs in the live checkout.

### Spec-to-Test Map
| AC | test |
|---|---|
| AC1 | "AC1: agc check exit code is the same with and without hits — 0 with current adapters, 1 with stale ones" |
| AC2 | "AC2: each of the seven shape categories reports a hit line with the correct 1-based line number" |
| AC3 | "AC3: neither stdout nor stderr ever contains a matched substring" |
| AC4 | "AC4: an untracked file whose name holds a keyword gets a masked (file name) keyword line" |
| AC5 | "AC5: tracked and untracked-non-ignored files are scanned; a gitignored file is not" |
| AC6 | "AC6: a non-empty AGC_HYGIENE_KEYWORDS wins; unset or empty falls back to the git-common-dir default, shared by linked worktrees" |
| AC7 | "AC7: with no keyword source shape hits still report plus exactly one hyg.kw.none; ..." |
| AC8 | "AC8: a keyword list under the workspace's .current/ is refused and no keyword hit is reported" (absolute and relative env values) |
| AC9 | "AC9: comments, blanks, whitespace and 1-char entries are ignored; matching is case-insensitive, ASCII-word-bounded and literal" |
| AC10 | "AC10: placeholder username segments are skipped and counted, ..." (home-path and encoded-home-path) |
| AC11 | "AC11: an in-workspace keyword list is never content-scanned; a tracked one prints hyg.kw.tracked once" |
| AC12 | "AC12: 60 hits list exactly 50 lines, then a more line naming 10 and a summary naming 60" |
| AC13 | "AC13: a NUL-bearing file, a >1 MiB file and a tracked symlink give no content hit; a hit in a name still reports" |
| AC14 | "AC14: outside git the walk reports shape and keyword hits, skips node_modules/, and keeps the exit code" |
| AC15 | "AC15: a clean workspace with a keyword list prints no hygiene line; a module that fails to load or throws ..." (load failure via a bin copy with no dist/, throwing stub module, in-module throw via runHygieneScan) |
| AC16 | "AC16: an isolated copy of committed HEAD lists zero hits — only hyg.kw.none and at most one hyg.skipped line" |
| AC17 | "AC17: docs/install.md and docs/config.md describe the hygiene scan ..." (content half) plus the spec's git-diff proof below (scope half) |
| AC18 | "AC18: a keyword glued to an underscore in a file name is masked in a content-hit path, and is not a keyword hit" |
| review r1 | "regression (review round 1): design-file-key stays linear on a long dotted line" (200k-char dotted line, bound 1 s) |
| review r2 | "regression (review round 2): maskText terminates and masks a keyword that starts with a non-BMP code point" (emoji pair, Extension-B + ASCII, case-insensitive, repeated, and a non-keyword leading astral char) |

### Coverage Gate
`node --test --experimental-test-coverage --test-coverage-include=dist/tools/hygiene-scan.js test/e234-hygiene-scan.test.mjs`: dist/tools/hygiene-scan.js 98.28% lines, 83.46% branches, 90.48% functions (child-process runs are included via inherited V8 coverage). Uncovered: small defensive catch branches. Above the 80% line gate. bin/agc-init.mjs checkHygiene is exercised by every child run and by the AC15 load/throw cases.

### Security smoke
Boundary inputs covered: empty env value (AC6), missing path (AC7), `.current/` path by absolute and relative value (AC8), regex metacharacters in keywords (AC9), NUL bytes and an oversized file (AC13), a symlink (AC13), non-BMP keywords (review r2), and a long pathological line (review r1). No auth surface.

## Phase 3.5 — AC Execution Log

Commands run in the lane worktree root.

| AC | command | result | verdict |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern "AC1" test/e234-hygiene-scan.test.mjs` | exit 0, pass 10 fail 0 (the pattern also selects AC10-AC18) | pass |
| AC2 | `node --test --test-name-pattern "AC2" test/e234-hygiene-scan.test.mjs` | exit 0, pass 1 fail 0 | pass |
| AC3 | `... "AC3" ...` | exit 0, pass 1 fail 0 | pass |
| AC4 | `... "AC4" ...` | exit 0, pass 1 fail 0 | pass |
| AC5 | `... "AC5" ...` | exit 0, pass 1 fail 0 | pass |
| AC6 | `... "AC6" ...` | exit 0, pass 1 fail 0 | pass |
| AC7 | `... "AC7" ...` | exit 0, pass 1 fail 0 | pass |
| AC8 | `... "AC8" ...` | exit 0, pass 1 fail 0 | pass |
| AC9 | `... "AC9" ...` | exit 0, pass 1 fail 0 | pass |
| AC10 | `... "AC10" ...` | exit 0, pass 1 fail 0 | pass |
| AC11 | `... "AC11" ...` | exit 0, pass 1 fail 0 | pass |
| AC12 | `... "AC12" ...` | exit 0, pass 1 fail 0 | pass |
| AC13 | `... "AC13" ...` | exit 0, pass 1 fail 0 | pass |
| AC14 | `... "AC14" ...` | exit 0, pass 1 fail 0 | pass |
| AC15 | `... "AC15" ...` | exit 0, pass 1 fail 0 | pass |
| AC16 | `... "AC16" ...` | exit 0, pass 1 fail 0 | pass |
| AC17 | `git diff main...HEAD -- docs/install.md docs/config.md` | 2 hunks only: docs/config.md `@@ -45,6 +45,7 @@ Semantics:` (1 line added next to the agc check advisory bullet) and docs/install.md `@@ -151,6 +151,13 @@` (7 lines added after the agc check artifacts advisory); both name AGC_HYGIENE_KEYWORDS; no other section changed | pass |
| AC18 | `... "AC18" ...` | exit 0, pass 1 fail 0 | pass |

## Phase 4 — Run
See the regression line in the PASS state write: full `npm test` run after the commit, with no untracked files in the tree (lane protocol §3).
## 2026-09-28T13:59:08.852Z — PASS — by qa-engineer

PASS T-E234-01..05. Phase 0.5 clean (4/4 manifest reds confirmed, 0 unexplained); 4 tests re-baselined per integrator re-draw (filter agc check — hygiene lines before the unchanged stderr assertion), manifest retired, no fifth red. Copy audit: all 11 Copy strings verbatim. Phase 1.5 skipped (no design). New test/e234-hygiene-scan.test.mjs: AC1-AC18 + 2 review regression cases, 20/20; hermetic env; AC16 on git-archive HEAD copy with own git dir: 0 listed hits. AC17 diff limited to the agc check paragraph/row. Coverage dist/tools/hygiene-scan.js 98.28% lines. Full npm test after commit 34f4554, no untracked files: 2946 tests, 2943 pass, 0 fail, 3 skipped. Details: qa_reports/review_T-E234-05.md.

