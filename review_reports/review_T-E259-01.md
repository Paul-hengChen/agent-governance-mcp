# Review — T-E259-01

covers: T-E259-01, T-E259-02, T-E259-03, T-E259-04, T-E259-05, T-E259-06

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: `git diff 665c613..HEAD`, which is sr commits 566265c..e0ba7c8, expected-red manifest f2b0db3, handoff 5afffda and coordinator doc fix 53f65e2. It adds 9 new `tools/comment-*.ts` modules plus their `dist/tools/comment-*` output, a modified `tools/comment-scan.ts`, the install.md paragraph and the config.md row.
- The lane splits the comment scan into a language registry (`comment-langs.ts`) over two lexers. The E258 JS lexer was moved without changes into `comment-lang-js.ts`. Every other family uses one table-driven `lexTable` (`comment-lex.ts`), with a Python docstring tracker and the D6 tag rules.
- Integrator conditions (1)–(4) all hold (details below). The full suite has exactly the two manifest reds.
- Verdict: APPROVED. One `recommended` finding: an unlisted shell misread, filed as a follow-up.
- Same-model bias: this reviewer ran as opus and sr ran as fable, so the models differ.

## AC Completeness
Implementation-side ACs for T-01..T-06. The test-authoring ACs belong to qa in T-07..T-09. I checked each AC below by hand with probe scripts against `dist/` (in scratch, not committed).
- AC1 — implemented — `tools/comment-langs.ts:40-47`. Probe: `a.PY`, `x/dist/a.py`, `a.d.mts`, `a.d.cts`, `Makefile`, `.bashrc` and `node_modules/x.go` all return null. `src/a.tsx` and `a.b.rs` resolve.
- AC2 — implemented (code) — `tools/comment-scan.ts:57` uses `scannedExtensions().join("/")`, and `comment-langs.ts:49-51` provides the list. The printed list equals D8 byte for byte. Updating the e258b assertions is qa's job in T-07.
- AC3 — implemented — the E258 suite fails only the two reassigned assertions (see Correctness / Expected-Red).
- AC4 — implemented — the JS registry entry covers `.cjs/.mts/.cts` (`comment-langs.ts:15`). A probe with a regex holding `//` and a template holding `/*` gives code lines only.
- AC5 — implemented — the `//` families and the `#` families both get `line` handling in `comment-lex.ts:85-88,163-166`. An 8-line `#` block after a shebang is reported at line 2 with 8 counted lines.
- AC6 — implemented — `/* */` spans, trailing comments and blank-line splits use E258's kind rule (`comment-lex.ts:202-203`).
- AC7 — implemented — `comment-lang-nested.ts:14`. `r#"` and `r##"` spans holding `//` lines and a bare `"#` give no block.
- AC8 — implemented — the Rust char form accepts exactly one char (`comment-lang-nested.ts:16`). The lifetime, `'"'` and `'\''` probe lines are all code with the `// note` seen, and nothing is swallowed.
- AC9 — implemented — nesting depth is in `comment-lex.ts:132-141`. An unclosed inner level runs to end of file (probe: block [1,10]). `.java` closes on the first `*/`.
- AC10 — implemented — `comment-lang-c.ts:13`. `R"d(… )" …)d"`, `u8R"(`, `R"()"` and an identifier `R` followed by a normal string are all correct.
- AC11 — implemented — `comment-lang-c.ts:35-37`. `@"…""…"`, four-quote raw holding `"""`, `$@"` and `$"""` are all correct. The doubled-quote branch is at `comment-lex.ts:151`.
- AC12 — implemented — `comment-lang-c.ts:28`.
- AC13 — implemented — `comment-lang-nested.ts:24-25`, with `${ "}" }` inside `"""` correct.
- AC14 — implemented — `comment-lang-nested.ts:34-36`. `#"""…"""#`, `##"x"#y"##` and `\(f("x"))` are correct.
- AC15 — implemented — `comment-lang-c.ts:22`.
- AC16 — implemented — `comment-python.ts`. `x = """`, the `f(\n'''`, after-statement and `if ok:` layouts are all code.
- AC17 — implemented — module, class, `async def` and a multi-line signature with an `r"""` prefix and a string return annotation holding `:` are all detected. 7 text lines plus delimiters stays silent (counted 7), and a one-line `"""x"""` counts as one comment line.
- AC18 — implemented — `comment-lex.ts:116-119`. A `#!` on line 2 is a comment (probe: block [2,8]).
- AC19 — implemented — `comment-lex.ts:87` (word-start set). `$#`, `${#a}`, `a#b`, `"#x"` and `'#x'` are code, and `ls # note` is a comment.
- AC20 — implemented — `comment-lex.ts:120-125`. A 9-body-line span is counted 9, and indented or mid-line `=begin` is code. `"a #{b} # c"` and `'#'` are code.
- AC21 — implemented — `comment-tags.ts:23-25`. Java probe: prose, then `@param`/`@return` with continuations, then `@see`, counts 3.
- AC22 — implemented — `comment-tags.ts:27-39`. The Swift and C# XML probes behave per D6.
- AC23 — implemented — `comment-tags.ts:41-47`. Probe with `Args:`, `Returns:` and `Note:` counts 4 (prose, blank, `Note:`, body).
- AC24 — implemented — rust/go use `atTags`, which never matches `# Errors` or prose, and shell uses `noTags`. The ratio counts every comment line (`countBlock` affects block length only).
- AC25 — implemented — same resolver as AC1.
- AC26 — implemented by construction — `lexTable` is a single forward pass where every branch advances `i` or breaks. Unterminated multi-line forms run to end of file, and single-line forms recover at line end. Probe: an unterminated docstring and an unterminated `"` both stay total. qa owns the resident test.
- AC27 — implemented — both docs edits are confined to the scan paragraph (`docs/install.md:161`) and the row (`docs/config.md:49`). They list the extensions and the skip rule, the D6 rules, docstrings-as-comments and `agc check — comments`, and name all 9 architecture misreads in one sentence.
- AC28 — implemented — `analyzeText` on each `tools/comment-*.ts` gives: comment-lang-c 3/8.6%, comment-lang-hash 3/6.3%, comment-lang-js 3/3.3%, comment-lang-nested 3/9.1%, comment-langs 3/6.8%, comment-lex 3/1.5%, comment-python 3/9.1%, comment-scan 5/4.5%, comment-tags 3/7.9%, comment-types 3/15.0% (max block / ratio). None exceeds 7 lines or 30%.
- AC29 — implemented — see Architecture (lane boundary).

## Correctness
- **Integrator condition (1), verbatim move: holds.** I diffed the lines removed from `tools/comment-scan.ts` in 566265c against the new `tools/comment-lang-js.ts`. Removed lines 26–132, the whole `lexLines` body and helpers, match js lines 19–124 exactly except `lexLines` → `lexJs`. The other differences are only the header, the type import, and the tag set moving from the inline `excludedTags` loop to `jsTags` (`comment-lang-js.ts:125-130`). `jsTags` returns `has(tag)` on an `@word` match and null otherwise, and `countBlock` sets `excluding` only when the value is non-null (`comment-scan.ts:69-78`). That matches E258's `if (tag) excluding = excludedTags.has(tag[1])` exactly. `analyzeText(text)` defaults to `jsLang`, and `lexLines` is re-exported, so JS/TS behaviour is unchanged.
- **Expected-Red Sampling (4a):** `qa_reports/expected-red_e259-comment-scan-languages.txt` has 2 entries, and I sampled both. `test/e258b-comment-scan.test.mjs:244` (AC8 isScannablePath…) and `:348` (AC11 60 blocks…) are real tests. `npm test` in the worktree at HEAD gave 2998 tests, 2993 pass, 2 fail, 3 skipped. The 2 failures are exactly those two entries. check-md-tables is green after 53f65e2.
- **`recommended` — unlisted shell misread (backslash-escaped quote in code).** `tools/comment-lex.ts:159-194`: code mode never skips the character after `\`. In shell, `echo don\'t` or `echo \"x` therefore opens a multi-line string (`comment-lang-hash.ts:40-41`, `multi(...)` / `dq(true)`), which runs to the next matching quote. Probe: `echo don\'t` + 8 `#` lines + `echo ok` gives all-code lines and no `long-block`. This under-flags only and cannot crash or hang, so D7's safety clause holds. It is not in the architecture's misread list or the docs sentence, which D7 says must name misreads ("never silent"). Fix for a follow-up: in `lexTable` code mode, when the table is shell (for example a `codeEscape` table flag), skip `\` plus the next char, or add the case to the misread list and the docs. Suggest the coordinator/integrator file it as a pending ticket; it is not blocking this lane.
- Other probes passed. These covered char literals holding `"` in C, Kotlin, Go and C#, Rust `'#'` and `r"a // b"`, Swift `#if`, shell `$'it\'s'`, `${y:-"a # b"}` and `"$(echo "#")"`, Python shebang with a coding line and a module docstring, a docstring after a leading comment, `f"{'#'}"`, Ruby `$'`/`$"` and `"#{h["k"]}"`, Kotlin `"${a + "}"}"`, Swift `"\(a + ")")"`, C# `"a\"b"`, Go `` "`" `` and a multi-line Rust string holding `//`.

## Quality
- No required findings. Naming is camelCase/PascalCase only, with no UPPER_SNAKE identifiers (error-code-contract suite green). Tables are frozen data and there is no dead code.
- `optional`: `comment-lang-c.ts:7` and `comment-lang-hash.ts:17-22` each define a local `multi` helper with different arities. This is harmless duplication and could be one helper in `comment-lex.ts` next to `dq`.
- `optional`: the interpolation `Frame` (`comment-lex.ts:47-50`) does not save `asComment`. This is correct today because no table with holes has a docstring tracker. The architecture doc records it as a deviation from the frame shape.
- **Comment check (4b):** the diff adds only file-header blocks: 3 lines in each new module and a 4-line header in `comment-scan.ts`. Each says what the module is and points to the spec, with no rationale in code. The one in-body comment (`comment-lang-js.ts`, "Tokens after which a `/` starts a regex…") is E258's moved verbatim, and it is kept because condition (1) requires a byte-identical move. `node bin/agc-init.mjs check` in the lane worktree after commit exits 0, and its `agc check — comments` lines are: none. There are no warnings to keep or trim.

## Architecture
- The module split, import graph, `LangSpec`/`LexTable`/`Closer`/`StringForm`/`DocstringTracker` shapes and per-table string forms match `specs/e259-comment-scan-languages-architecture.md`. There are three small deviations, each justified. Go/Ruby backtick regexes are written as `\x60` to keep backticks out of regex literals (the self-dogfood rule). Frames carry no `asComment` (above). There is no separate `line` mode: `break` ends the line scan, which is equivalent to the spec'd `line` mode.
- **Integrator condition (2), AC28 limits: holds** (numbers in AC28 above; max block 5 in comment-scan.ts, max ratio 15.0% in comment-types.ts).
- **Integrator condition (3), docs: holds.** Only the comment-scan paragraph of `docs/install.md` and the comment-length row of `docs/config.md` changed. Both name misreads 1–9: heredocs; Ruby `%q`/`%w`/regex/`?#`/`__END__`; backslash-newline; digit separators; interpolation depth and C# `$"` holes; Kotlin `""""`; Swift regex; untagged keywords and sections; blank lines in docstrings and `=begin`. They also keep E258's two JS misreads.
- **Integrator condition (4), lane boundary: holds.** `git diff --name-only 015b44c..HEAD` lists only `tools/comment-*.ts`, `dist/tools/comment-*`, `docs/install.md`, `docs/config.md`, `specs/e259-*`, `.current/e259/**` and `qa_reports/expected-red_e259-comment-scan-languages.txt`. Nothing is under `content/**`, `bin/**`, `prompts/**`, `gates/**`, `schema/**`, `templates/**`, `scripts/**` or `test/**`. A fresh `npm run build` leaves `dist/` clean, so the committed build matches. `optional`: the fan-out owned glob `qa_reports/*E259*` is uppercase, while the SOP-mandated manifest name is lowercase (`expected-red_e259-…`). The integrator should read that glob case-insensitively or treat the manifest as covered by `specs/fanout` intent.

## Security
No findings. The code is a pure text lexer with no new I/O, process spawning or path handling. File reading still goes through E258's `readScannable` (symlink/size/NUL guards unchanged). All regexes are sticky and bounded (`{0,16}`, `{1,6}`) or linear, with no nested quantifiers that could backtrack catastrophically.

## Performance
No regressions. The JS path is identical to E258. `lexTable` is one pass, O(length × forms), and each form is a sticky match at the current index. `optional`: the C# raw opener `/\$*("{3,})/y` retried at each `$` of a long `$$$…` run with no quote is quadratic in that run's length. That only happens on pathological input, and the architecture already treats it as acceptable.

## Verdict
APPROVED. All implementation ACs are met and integrator conditions (1)–(4) hold. The suite fails only the 2 manifest-listed assertions, and the lane diff raises no `agc check — comments` warnings. The one `recommended` finding (unlisted shell `\'`/`\"` misread) is advisory-only and goes to a follow-up.
