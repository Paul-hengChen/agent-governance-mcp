# Review — T-E234-01

covers: T-E234-01, T-E234-02, T-E234-03, T-E234-04

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Adds `tools/hygiene-scan.ts` (a pure matcher layer plus an I/O layer) and its committed `dist/` build, wires `checkHygiene(cwd)` into `runCheck()` in `bin/agc-init.mjs` right after `checkArtifactsDrift`, documents the scan in `docs/install.md` and `docs/config.md`, and adds the expected-red manifest.
- The diff stays inside the lane's owned files (`specs/fanout-e234.md`). Nothing in `content/**`, `prompts/**`, `gates/**`, the goldens, other `tools/**`, other `dist/**` or other `test/**` changes.
- These properties were checked by running the code, not only by reading it: exit code is the same with and without hits (0 when adapters are current, 1 when they are stale); nothing is echoed and file names are masked; the keyword source resolves correctly from a subdirectory and from a linked worktree; a keyword file under `.current/` is refused whether reached lexically, through `..`, through a symlink, or by a case-variant spelling; AC16 holds on a hermetic `git archive HEAD` copy, which prints only `hyg.kw.none` and `skipped 16`. Also clean: `tsc --noEmit`, rebuilding `dist/` (no diff after the rebuild), and `test/error-code-contract.test.mjs`.
- One required finding: the `design-file-key` pattern takes quadratic time on long dotted runs. A single tracked or untracked file can make `agc check` hang, and `agc check` is a release gate.
- Verdict: CHANGES_REQUESTED, with a one-character fix.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs checkHygiene: every branch returns normally, and the adapter-stamp exit logic is untouched. Verified at runtime: exit 0 in a current workspace with and without hits, exit 1 with a stale stamp with and without hits.
AC2 — implemented — tools/hygiene-scan.ts:169-287 covers all seven shape categories. The line numbers are 1-based (`i + 1`, line 630).
AC3 — implemented — no layer prints matched text. Paths go through `maskText` (line 432). The kw.unreadable/refused/none lines are fixed text, and `hyg.error` is masked (line 663) or fixed (bin load failure).
AC4 — implemented — file-name hits use `line: null` and the path is masked (lines 617, 432). Verified: an untracked file whose name holds a synthetic keyword printed as `***` in the path.
AC5 — implemented — `git ls-files -z --cached --others --exclude-standard` (line 493).
AC6 — implemented — resolveKeywordSource (lines 548-590). A non-empty env var wins, and an empty one falls through to the default. The common dir is resolved against cwd. Verified from a subdirectory and from a linked worktree.
AC7 — implemented — formatReport (lines 426-427). Fixed text, no path.
AC8 — implemented — lines 555-563 check both the lexical path and the realpath against `.current` and its realpath.
AC9 — implemented — parseKeywordList (lines 325-339) and compileKeywordMatcher (lines 343-359). Verified: `Zorblax-app` matches; the `-ing` suffix, `_x` suffix and 1-char entries do not; metacharacter keywords (`c++`, `a.b`, `[x]`, `a/b`, a keyword containing `|`) match only literally.
AC10 — implemented — isPlaceholderSegment (lines 297-309) and the classifyLine skip unit (lines 365-375), per Resolved 1.
AC11 — implemented — the dev/ino self-exclusion (line 619) and isTrackedFile with the `:(literal)` pathspec (lines 524-535).
AC12 — implemented — formatReport cap, `more` and `summary` (lines 431-439).
AC13 — implemented — `lstat` plus `isFile`, the size cap, and the NUL sniff (lines 613-626). The name is checked before the content gate.
AC14 — implemented — walkWorkspace (lines 454-488) skips `.git` and `node_modules` and never follows symlinks. The env keyword source is still honoured outside git.
AC15 — implemented — silence when loaded, untracked and zero hits (formatReport emits nothing). Load failure prints fixed `hyg.error` text (bin). runHygieneScan never throws.
AC16 — implemented — verified on a hermetic archive copy with its own git dir: zero listed hits, only `hyg.kw.none` plus one `hyg.skipped` line. The module, specs and docs do not match themselves.
AC17 — implemented — docs/install.md (one new paragraph plus two bullets after the `agc check` artifacts advisory) and docs/config.md (one bullet next to the existing advisory drift-check bullet). Each names `AGC_HYGIENE_KEYWORDS`, the default location and format, the categories, the advisory nature, and never-echoed.

## Correctness
- **required** — tools/hygiene-scan.ts:216 (`design-file-key`): catastrophic (quadratic) backtracking. The lookbehind `(?<![A-Za-z0-9\-])` allows a match to start right after a `.`. The following `(?:[A-Za-z0-9\-]+\.)*` then consumes the rest of the dotted run before it fails on the host literal. On a run of "one character, dot" pairs, every position after a dot is a start and each start costs O(remaining run), so the total is O(n^2). Measured with `findShapeMatches` on one line: 10k chars took 92 ms, 40k took 1.4 s, and 160k took 23 s. A single 1 MiB line (the content cap) extrapolates to tens of minutes. Any committed or untracked file can therefore stall `agc check`, which the release flow requires to exit 0. That breaks D5's "never changes the exit code in any branch" in practice, because CI turns it into a timeout. **Fix**: add `.` to the lookbehind class, giving `(?<![A-Za-z0-9.\-])`. A match can then start only at the head of a dotted run. Measured on the same input: 1.4 s dropped to 1 ms, and the positive cases (a `www.`-prefixed host, a multi-label subdomain with a scheme, and a bare host) still match. The other patterns are fine: `work-item-link` and `internal-host` can start only at a scheme, and the home/temp patterns already exclude `.` in `leftBound`. qa should add a timing regression case (for example, a 100k-char dotted line must finish in well under 1 s).
- **recommended** — tools/hygiene-scan.ts:539: `readFileSync` on an env-named keyword path that is a FIFO (or another blocking special file) blocks forever. A `statSync(...).isFile()` guard before the read would route it to `unreadable`. This input is unlikely, and the fix is cheap.
- **optional** — tools/hygiene-scan.ts:619: comparing `dev`/`ino` as JS numbers can collide on filesystems whose inode numbers exceed 2^53 (`lstatSync(p, { bigint: true })` avoids this). A collision would only suppress a content scan, and it is very unlikely.
- **optional** — the `.current` refusal (line 556) is anchored at `cwd`. When `agc check` runs from a subdirectory, a keyword file under the repo root's `.current/` is not refused. This matches the spec's definition (workspace = cwd), so it is not a defect. It is noted only for the record.

## Quality
- No findings of substance. No `any`. The code uses `unknown` narrowing (line 642) and `satisfies ShapePattern[]` (line 287). The constant names avoid the UPPER_SNAKE gate-code suffixes, and `test/error-code-contract.test.mjs` passes. The Copy strings in `hygieneCopy` are verbatim with the spec's Copy table.
- **optional** — docs/config.md: the hygiene bullet sits inside the `artifacts` key's Semantics list. It is labelled "(not a config key)", which is within the owned "agc check rows", though a reader may not expect it there. The missing env-var table row is already captured as E234-NEW-1.

## Architecture
Matches `specs/e234-hygiene-scan-architecture.md`: the pure/I-O split, the exported surface, the imports (only `fs`, `path` and `execFileSync` with argv arrays), the bin wiring, the fixed load-failure text, the final patterns, and Resolved 1-7. There is one documented refinement: the `:(literal)` pathspec prefix on the tracked check. It is sound, because it stops glob expansion of the basename. Placeholder-only file-name skips count toward `hyg.skipped` under the same unit, which is consistent with the dedup unit. `dist/` matches a fresh build.

## Security
- The no-echo guarantee holds on every output path I traced: hit lines mask both layers in the path; the keyword-status lines are fixed text; `hyg.error` is masked with the loaded matcher, and an error thrown before the matcher exists comes only from code paths that already catch their own I/O errors; the bin load failure never prints the raw import error, which would contain the install's file URL. All output goes to stderr and nothing goes to stdout.
- No shell use: every `execFileSync` call takes an argv array, and `--` plus `:(literal)` guard the only user-influenced argument.
- **optional** — printed paths are masked but otherwise raw. A file name containing a newline or terminal control characters is written to the terminal verbatim, which can forge extra advisory lines. Consider escaping control characters in `formatReport`.
- **optional** — a keyword glued to an ASCII word character inside a file name (for example `<kw>_notes.md`) does not match, by the spec's word-boundary rule. So when that file has some other hit, its name is printed unmasked, keyword substring included. This conforms to the spec (D1 and D5 mask only matching spans), but it is a residual leak the integrator may want to rule on.

## Performance
- **required** — the `design-file-key` quadratic backtracking described under Correctness. It is a complexity-class issue in new code that runs on every line of every scanned file.
- Otherwise: 16 pre-compiled patterns per line, and `matchAll` clones each regex, so there is no shared `lastIndex` state. The keyword regex is a literal alternation, with no ReDoS. Each file is read once, content reads are capped at 1 MiB, and the no-git walk is capped at 10k files. Nothing regresses in base code paths.

## Expected-red sampling (SOP 4a)
`qa_reports/expected-red_e234-hygiene-scan.txt` exists and has 4 entries, and all 4 were sampled. Each one is a real, locatable test: test/agc-adapters.test.mjs:224 (AC-6), :246 (AC-7) and :1178 (E111(iv)), and test/e106-init-artifacts-flag.test.mjs:336 (AC12). This agrees with the integrator's re-assignment of those four bodies to this lane's qa hop.

## Verdict
CHANGES_REQUESTED: the implementation meets AC1-AC17, but the `design-file-key` pattern backtracks quadratically, so one file can hang `agc check`. The fix is to add `.` to that pattern's lookbehind, plus a timing regression case.

### sr-engineer reply (round 1)
- **required — design-file-key backtracking**: fixed. The lookbehind is now `(?<![A-Za-z0-9.\-])`, so a match starts only at the head of a dotted run. Re-timed `findShapeMatches` on one dotted line: 40k chars 1.2 ms, 160k chars 2.2 ms, 1 MiB 15 ms. The `www.`-prefixed host, the multi-label host with a scheme, and the bare host still give `design-file-key`, and a short-key host stays silent. The timing regression case is for qa.
- **recommended — FIFO keyword path**: fixed. `loadKeywordFile` opens the file non-blocking, checks `isFile()` with `fstat` on the open descriptor (so there is no check-then-read race), and reads through that descriptor. A non-regular file takes the existing null path: `hyg.kw.unreadable` for the env source, `hyg.kw.none` for the default file. Verified: an env var naming a FIFO prints `hyg.kw.unreadable` and returns at once.
- **optional (security) — control characters in printed paths**: fixed. The new exported `escapeForDisplay` runs after masking, so masked spans are computed on the raw text. It escapes C0/C1 controls, DEL and the bidi mark/embedding/override/isolate controls as `\uXXXX`. It applies to hit paths and to the `hyg.error` message. Verified: a file name with an embedded newline prints on one line, with the newline shown as an escape.
- **optional — bigint dev/ino**: not taken. It would change the architecture's exported `KeywordSource` field types (`dev`/`ino: number`). A collision can only suppress one file's content scan, and it needs inode numbers above 2^53.
- **optional — keyword glued to an ASCII word character in a file name**: on hold, pending an integrator spec decision (coordinator instruction).
- Also: the BOM literal in `parseKeywordList` is now written as a `﻿` escape instead of an invisible character. Behaviour is unchanged.

## Round 2 — CHANGES_REQUESTED — by code-reviewer

Scope: `git diff a5b49a7..HEAD`, which is e8f5552 (the round-1 fixes) and ab39e62 (the D5/AC18 masking amendment). Judged against the amended spec, AC1–AC18.

## Summary
- All three round-1 fixes are correct and verified at runtime. A 160k-char dotted line now takes 2 ms. An env var that names a FIFO prints `hyg.kw.unreadable` straight away. A newline or bidi control in a printed path is escaped after masking. I accept declining the bigint dev/ino change.
- AC18 is implemented. `maskSpans` masks keyword occurrences that are glued to other characters (`aaaa_ZORBLAX_notes.md` prints as `***_***_notes.md`), and detection still uses the D1 word boundaries.
- One new required finding: `maskSpans` loops forever when a keyword starts with a non-BMP character, and `agc check` then crashes out of memory.
- Clean: `tsc --noEmit`, rebuilding `dist/` (no diff after the rebuild), `test/error-code-contract.test.mjs` (21/21), and AC16 on a hermetic `git archive HEAD` copy (only `hyg.kw.none` and `skipped 16`).

## AC Completeness
AC1–AC17 — implemented. They are unchanged from round 1 except for the fixes below.
AC1 — partial — exit-code invariance breaks when a keyword starts with a non-BMP character (see Correctness).
AC18 — implemented — tools/hygiene-scan.ts, `maskSpans` inside `compileKeywordMatcher` and the `maskText` call site. The one exception is the Correctness finding below.

## Correctness
- **required** — tools/hygiene-scan.ts `maskSpans` (in `compileKeywordMatcher`, around the `scan.lastIndex = m.index + 1` line): this loops forever on a match whose first character is a non-BMP code point, meaning a surrogate pair such as an emoji or a CJK Extension-B ideograph. D1 names CJK names explicitly. The regex has the `u` flag, and in `u` mode a `lastIndex` that points at the trailing half of a pair is moved back to the pair's start. So `exec` returns the same match at the same `m.index` again, `lastIndex` is reset to `m.index + 1`, and the loop never advances. Each pass pushes another span, so memory grows until V8 aborts. Reproduced in isolation: with `/(?:<two astral chars>)/giu`, `lastIndex = 1` on text that starts with that pair, `exec` returns index 0. Reproduced end to end: a keyword file holding one two-emoji keyword, plus a tracked file whose name contains that keyword and whose content has one home-path hit, made `agc check` exit **134** (heap OOM, with the native stack trace on stderr). That breaks exit-code invariance (D5/AC1), and `runHygieneScan`'s catch-all cannot recover from an OOM abort. **Fix**: advance by one full code point, for example `scan.lastIndex = m.index + (m[0].codePointAt(0)! > 0xffff ? 2 : 1)` (or use the length of `String.fromCodePoint(m[0].codePointAt(0)!)`). Also add a progress guard that stops the loop when `scan.lastIndex <= m.index`. qa should add a unit case: `maskText` over a path that contains a keyword starting with a non-BMP character must return, with `***` in place of the keyword.
- No other findings. `loadKeywordFile` now takes `dev`/`ino` from `fstat` on the open descriptor, which is the same inode as the realpath, so self-exclusion is unchanged. `O_NONBLOCK ?? 0` is safe where the constant does not exist.

## Quality
- **recommended** — specs/e234-hygiene-scan.md D5 amendment: the bullet still says "pending human ratification in the coordinator's chat". The coordinator reports the change is ratified, so update the wording, citing the ratification and mailbox to-lane#5, so the spec does not contradict the record.
- The `﻿` escape in place of the invisible literal is an improvement.

## Architecture
`maskSpans` is an additive member of the exported `KeywordMatcher` interface, and it is consistent with the amended D5. Putting `escapeForDisplay` after `maskText` is correct, because spans are computed on the raw text. No layering change.

## Security
- The no-echo property now also covers keywords glued to other characters in printed paths (AC18), and control and bidi characters can no longer forge lines or reorder output. The crash above has a side effect on output: the OOM abort prints V8's native stack, which includes the node install's absolute path. That is one more reason to fix it.

## Performance
- The design-file-key regression is fixed: 160k chars took 2 ms. `maskSpans` on a 700k-char path-like string took 23 ms. It is linear apart from the non-BMP infinite loop above.

## Verdict
CHANGES_REQUESTED: the round-1 fixes and AC18 are correct, but `maskSpans` never advances past a non-BMP first character, so `agc check` crashes with exit 134 when a keyword starts with an emoji or an Extension-B ideograph. The fix is to advance `lastIndex` by a whole code point.

### sr-engineer reply (round 2)
- **required — maskSpans non-BMP infinite loop**: fixed. After each match, `lastIndex` now advances one whole code point from the match start: 2 code units when the first code point is above U+FFFF, otherwise 1. A progress guard also stops the loop if a match ever starts at or before the previous start. Reproduced end to end with synthetic keywords, one of two emoji and one of two CJK Extension-B ideographs plus an ASCII letter, each glued into a tracked file name with one home-path hit in the content. `agc check` exits 0 and prints both hits with the keyword masked as `***`. No non-BMP character and no stack trace appear in the output.
- **Audit of the other global-regex loops**: the remaining loops are the `matchAll` calls in `findShapeMatches` and in the keyword `spans`, plus the `replace` calls with `g` flags. The engine advances these itself and is code-point aware under `u`, and none of the patterns can match empty (keywords are at least 2 code units, and every shape pattern consumes characters). The hand-written `exec` loop in `maskSpans` was the only one affected.
- **recommended — D5 wording**: the PM's working-tree edit, which changes "pending human ratification" to "ratified", is committed together with this fix.
