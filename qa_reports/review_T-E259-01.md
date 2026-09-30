# QA review — e259-comment-scan-languages (covers: T-E259-01, T-E259-02, T-E259-03, T-E259-04, T-E259-05, T-E259-06, T-E259-07, T-E259-08, T-E259-09)

Verdict: PASS. Code-review APPROVED (`review_reports/review_T-E259-01.md`, covers 01..06).

## Expected-Red Diff
Manifest: `qa_reports/expected-red_e259-comment-scan-languages.txt` (2 entries, both in `test/e258b-comment-scan.test.mjs`).
Run BEFORE the re-baseline edit: the pre-edit e258b file (`git show 053926c:test/e258b-comment-scan.test.mjs`, run as a throwaway copy) gave 22 pass / 2 fail.
- AC8: isScannablePath applies the D3 name rules case-sensitively — red, on manifest. Disposition: lists re-baselined in T-E259-07 (`.cjs .mts .cts .py` now scannable; `.d.mts .d.cts .yaml` added to the negatives).
- AC11: 60 blocks list 50 hits ... — red, on manifest. Disposition: summary regex re-baselined to the D8 extension list in T-E259-07.
Phase 0.5: clean (2/2 manifest entries confirmed red, 0 unexplained reds). Only those two assertions changed in `test/e258b-comment-scan.test.mjs` (3 insertions, 3 deletions); after the edit the file is 24/24.

## Phase 1 / 1.5 / Copy / Visual
Code review covers correctness. Copy audit: the only string that changes is `comments.summary` `{exts}`; asserted by AC2 (D8 literal, registry sorted both ways). Phase 1.5: skipped (no Visual Baselines declared). Visual Tokens: N/A.

## AC -> test map
| AC | test file / test name prefix | task |
|---|---|---|
| AC1, AC2, AC4 (x2: JS table reuse; frozen baseline), AC25 | `test/e259-comment-scan-brace.test.mjs` | 07 (impl 01) |
| AC3 | `test/e258b-comment-scan.test.mjs` (24/24, only AC8 lists + AC11 summary edited) | 07 |
| AC5 (`//`), AC6, AC9, AC12, AC15 | brace test | 07 (impl 02) |
| AC7, AC10, AC11, AC13, AC14 | brace test | 07 (impl 03) |
| AC8 (Rust lifetimes, char literals) | brace test; mapped to T-E259-03 per the architecture Decision Records row (Rust table lands in T-03), not a gap | 07 (impl 03) |
| AC5 (`#`), AC16-AC20 | `test/e259-comment-scan-hash.test.mjs` | 08 (impl 04) |
| AC21-AC24 | hash test | 08 (impl 05) |
| AC26 | hash test | 08 |
| AC27 | `test/e259-comment-scan-limits.test.mjs` (docs state contract) + diff proof | 09 (impl 06) |
| AC28 | limits test | 09 |
| AC29 | task evidence below | 09 |

Fixtures: `test/fixtures/e259/*.fixture.txt` (never scanned). JS identity proof: `js-baseline.fixture.txt` is per-line kind/delimiter/blocks output frozen from the base commit's `dist/tools/comment-scan.js` (generated once, no SHA lookup at test time) over `js-corpus`, the E258 `lexer-mix` and `jsdoc-tags` copies; asserted under `.ts .cjs .mts .cts .jsx` plus the default-argument path.
Sensitivity controls (run while authoring): the Rust, C++, C#, Swift, Kotlin, Java and Go string fixtures each produce long-block hits when lexed with a wrong table (e.g. rust under `.c`: blocks 8,8,8,8,1), so a misread would be caught. The Rust lifetime fixture is not sensitive to a char-literal misread alone (the following block survives either way); it still guards against a swallowing regression.

## Judgment calls
- Swift `#"..."#` is tested single-line (`#"one // line \#(x) "quoted""#`): Swift single-hash strings cannot span lines and the architecture makes only `"""` forms multi-line. AC14's "holding `//` lines" is exercised by the `"""` and `#"""` forms.
- AC26 "exit code unchanged" is asserted against a control repo run, not a fixed 0, since the temp repos carry no adapter stamps.
- Reported `long-block` line is the first line of the contiguous comment block (including excluded tag lines), as in E258.

## AC Execution Log
Each command: `node --test --test-name-pattern "ACn:" test/e259-*.test.mjs`, exit 0, 0 fail, at HEAD after the test commits.
AC1 pass; AC2 pass; AC4 pass (2 tests); AC5 pass; AC6 pass; AC7 pass; AC8 pass; AC9 pass; AC10 pass; AC11 pass; AC12 pass; AC13 pass; AC14 pass; AC15 pass; AC16 pass; AC17 pass (2 tests); AC18 pass; AC19 pass; AC20 pass; AC21 pass; AC22 pass; AC23 pass; AC24 pass; AC25 pass; AC26 pass; AC27 pass; AC28 pass.
AC2/AC3 second command: `node --test test/e258b-comment-scan.test.mjs` -> exit 0, 24 pass / 0 fail.
AC27 proof: `git diff 015b44c...HEAD -- docs/install.md docs/config.md` -> exactly one paragraph in install.md and one row in config.md changed (1 line each); both name the 9 known misreads in one sentence.
AC28: `analyzeText` on each `tools/comment-*.ts`: comment-lang-c max block 3 ratio 8.6%; comment-lang-hash 3 / 6.3%; comment-lang-js 3 / 3.3%; comment-lang-nested 3 / 9.1%; comment-langs 3 / 6.8%; comment-lex 3 / 1.5%; comment-python 3 / 9.1%; comment-scan 5 / 4.5%; comment-tags 3 / 7.9%; comment-types 3 / 15.0%. All within 7 / 30%.
AC29: `git diff --name-only 015b44c...HEAD` outside the owned set (dist/tools/comment-*, tools/comment-*, test/e259*, test/fixtures/e259, specs/e259*, qa_reports, review_reports, .current, tasks.md) lists only `docs/config.md`, `docs/install.md`, `test/e258b-comment-scan.test.mjs`; nothing under `content/ bin/ prompts/ gates/ schema/ templates/ scripts/` or goldens. PASS.
Lane-diff evidence: `node bin/agc-init.mjs check` in the lane worktree after commit -> exit 0; `agc check — comments` lines: none.

## Phase 4 run
`npm test` (prebuild + node --test test/*.test.mjs) at a clean, fully-committed tree: 3028 tests, 3025 pass, 0 fail, 3 skipped, exit 0; tree still clean after (dist rebuild is byte-identical). Headless, zero interaction.
Out of scope, not a FAIL: pending-ticket E259-NEW-1 (shell backslash-escaped quote under-flag).
