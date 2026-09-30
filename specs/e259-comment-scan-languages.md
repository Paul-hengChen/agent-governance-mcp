# e259-comment-scan-languages

## Problem Statement
The E258 comment-length scan (`agc check — comments`) reads only `.ts .tsx .js .jsx .mjs`, through one lexer that knows only JavaScript syntax. Adopter repos are also Java, Kotlin, Swift, Go, Rust, C/C++, C#, Python, shell and Ruby, and in those a long comment block or a comment-heavy file goes unflagged. Widening the extension list alone would be wrong: every language writes strings differently (Rust `r#"…"#`, C++ `R"(…)"`, Go backticks, Python triple quotes), and a `//` or `#` inside one of them must not be read as a comment. The scan becomes a set of per-language syntax tables over one shared block/ratio engine. Thresholds, diff scope, output shape and the advisory, exit-code-neutral behaviour of E258 do not change.

## User Stories
- As a maintainer of a non-JS repo, I want `agc check` to flag the long comment blocks my change adds, so that I can trim them before review.
- As a code-reviewer, I want warnings only for real comments, so that a string full of `//` or `#` never sends me chasing a false hit.
- As a maintainer, I want the summary line to name the extensions actually scanned, so that silence on an unlisted language is not read as clean.

## Decisions (PM, binding on architect unless flagged "architect may refine")

### D1 — Unchanged from E258 (`specs/e258b-comment-scan.md` D1, D2, D6, D7)
Thresholds (ratio > 30%, >= 50 non-blank lines for the ratio, block > 7 counted lines), diff-only scope and baseline, the 50-line output cap, `more`/`summary` lines, stderr-only, silence when clean, the `comments.error` line, never a non-zero exit. The JS/TS lexing rules and the JS/TS tag set (`@param @returns @return @throws @example`) are byte-for-byte unchanged, including for `.cjs .mts .cts`.

### D2 — Language tables
One table per language family, keyed by file extension, carrying: comment syntax, string forms, doc-tag rule, and flags. Extension match is case-sensitive, on the last suffix only. `dist/` and `node_modules/` path segments stay excluded; declaration files `.d.ts`, `.d.mts`, `.d.cts` stay excluded. Any other extension is skipped, as today (YAML, TOML, JSON, Markdown, extensionless files).

| family | extensions | comments | notes |
|---|---|---|---|
| js | `.ts .tsx .js .jsx .mjs .cjs .mts .cts` | `//` `/* */` | today's lexer, unchanged |
| c-like | `.c .h .cc .cpp .cxx .hpp` | `//` `/* */` | `.h` uses the C++ table (raw strings) |
| java | `.java` | `//` `/* */` | text blocks |
| csharp | `.cs` | `//` `/* */` | `///` is an ordinary `//` line |
| go | `.go` | `//` `/* */` | |
| kotlin | `.kt .kts` | `//` `/* */` nested | |
| swift | `.swift` | `//` `/* */` nested | |
| rust | `.rs` | `//` `/* */` nested | |
| python | `.py` | `#` | docstrings are comments |
| shell | `.sh .bash .zsh` | `#` | |
| ruby | `.rb` | `#`, `=begin`/`=end` | |

### D3 — What each language must not read as a comment (each is a testable AC)
- Rust: `"…"` (multi-line allowed), `r"…"`, `r#"…"#` (any `#` count), `b"…"`; a lifetime `'a` is not a char literal.
- C/C++: `"…"`, `'…'`, `R"delim(…)delim"` with optional encoding prefix, any delimiter (including empty), body may hold `)"`.
- C#: `"…"`, `@"…"` (`""` is an escaped quote, may span lines), `"""…"""` raw strings of three or more quotes (closes on the same count), with `$` interpolation prefixes.
- Go: `"…"`, `'…'`, `` `…` `` raw (multi-line).
- Kotlin: `"…"`, `'…'`, `"""…"""` (multi-line).
- Swift: `"…"`, `"""…"""` (multi-line), and `#"…"#` / `#"""…"""#` extended delimiters.
- Java: `"…"`, `'…'`, `"""…"""` text blocks (not in the ticket's list; a text block is Java's multi-line string, so it is a correctness case, not a scope widening).
- Python: `'…'`, `"…"`, `'''…'''`, `"""…"""`, each with optional `r b u f` prefixes, when not in docstring position (D5).
- Shell: `'…'`, `"…"`, and `#` is a comment only at the start of a word (`$#`, `${#x}`, `a#b` are code).
- Ruby: `'…'`, `"…"`; `=begin` and `=end` count only at column 0.

### D4 — Nested block comments and shebang
- Rust, Swift, Kotlin: `/*` inside a block comment opens a level; the comment ends when every level has closed. All other `/* */` languages (js, c-like, java, csharp, go): the first `*/` closes.
- A shebang (`#!` on the first line of a file) is a code line in every language that has one of `#`-comment or JS handling (`.sh .bash .zsh .py .rb` and the existing JS rule). A `#!` anywhere else is an ordinary comment.

### D5 — Python docstrings count as comments
A triple-quoted string is a **docstring** when it is the first statement of a module (only blank lines, `#` comments and a shebang before it), or the first statement after a `def`, `async def` or `class` header (the header ends at its `:` at bracket depth 0, so multi-line signatures work). A docstring may carry an `r`/`R`/`u`/`U` prefix. Every physical line of a docstring is a comment line (ratio and blocks); a line holding only `"""` or `'''` is a delimiter line, not counted toward block length. A triple-quoted string anywhere else (assignment, argument, expression statement after other code) is ordinary code. A single-quoted `"doc"` is code. Architect may refine the detection, not the observable rule.

### D6 — Doc-comment tag exclusion (PM decision; the block-length count only, never the ratio)
Excluded lines are a tag's line plus its continuation lines, up to the next line that begins any tag of the same language.

| languages | excluded tag starts | ends at |
|---|---|---|
| js (incl. `.cjs .mts .cts`) | `@param @returns @return @throws @example` (unchanged) | next `@…` line |
| java, kotlin, c-like, csharp, go, rust, ruby | `@param @returns @return @throws @exception @example` (Javadoc, KDoc, Doxygen, YARD); c-like also the Doxygen `\param \returns \return \throws \exception \example` | next `@…` line (c-like: or `\word` line) |
| swift | `- Parameter`, `- Parameters`, `- Returns`, `- Throws` (Swift markup) | next line starting a `- <Keyword>` from Swift's known markup keywords; nested `- name:` parameter bullets do not end it |
| csharp (`///` XML) | lines opening `<param`, `<typeparam`, `<returns`, `<exception`, `<example` | next line whose text starts another `<element` |
| python (docstrings only) | Google sections `Args: Arguments: Returns: Return: Raises: Yields: Example: Examples:` and Sphinx fields `:param :type :returns :return :rtype :raises :raise :yields` | next section header or Sphinx field of any kind, or end of docstring |
| rust, go, shell, plain `#`/`//` prose | no exclusion: rustdoc `# Errors`/`# Examples` headings and Go doc prose count as prose | — |

Known gaps, stated in docs and the architecture doc rather than handled: NumPy-style docstring sections, rustdoc sections, Kotlin `@property`/`@constructor`, Swift keywords outside the listed four.

### D7 — Known misreads are allowed, listed, never silent
The lexer is a heuristic. The architecture doc lists misreads; at minimum: shell and Ruby heredoc bodies, Ruby `%q`/`%w`/`/regex/` literals and `?#` char literals, C/C++ backslash-newline line continuation, C++ digit separators (`1'000`), Python f-string nesting beyond one level, Kotlin/Swift string interpolation nesting beyond one level. A misread may over- or under-flag one region; it must never crash, hang, or make the scan emit a non-advisory result.

### D8 — Summary line
`comments.summary` lists the scanned extensions, derived from the table registry (not typed twice), sorted in ASCII order, joined by `/`. With this ticket: `.bash/.c/.cc/.cjs/.cpp/.cs/.cts/.cxx/.go/.h/.hpp/.java/.js/.jsx/.kt/.kts/.mjs/.mts/.py/.rb/.rs/.sh/.swift/.ts/.tsx/.zsh`. The rest of the line is unchanged.

### D9 — Architect hop: **yes**
The lexer design is the real question: a table-driven engine must express nested comments, hash-counted raw strings (`r##"`), counted-quote raw strings (C#), delimiter-carrying raw strings (C++), Python docstring position, and shell word-start `#`, while leaving the JS path behaviour-identical and each module inside the `task_size` budget and the scan's own 30% / 7-line limits. The brief alone (extend the extension list) does not decide any of that. Architect owns: table shape, module split (PM suggests `tools/comment-scan.ts` = engine, pure/I-O layers as today, plus new `tools/comment-lang*.ts` for tables and per-family lexers; names are the architect's and must keep UPPER_SNAKE constants out, per `test/error-code-contract.test.mjs`), the misread list, and how the JS path is proven unchanged. Architect open questions go to the integrator mailbox for a second pre-review.

## Acceptance Criteria
Tests are `test/e259-*.test.mjs` (qa-authored). Sample sources live in `test/fixtures/e259/*.fixture.txt` (an extension the scan never reads) and are written into temp git repos under their real names at run time, so no tracked `.rs/.py/.go/...` file added by this lane trips its own scan. "Reports" means one `long-block` line naming path, first line number and count; "silent" means no `agc check — comments` line for that file. Each string-form case uses a block of `//` or `#` text lines that would be an 8-line block if misread as comments, placed inside the string, plus one real 1-line comment, so a misread shows as a hit.

- **AC1 (extension set)** — Given the registry, when `isScannablePath` is asked about every extension in D2 (also under a subdirectory), then true; for `.d.ts .d.mts .d.cts`, any path under `dist/` or `node_modules/`, `A.PY`, `.yaml .yml .toml .json .md .txt`, and an extensionless name, then false.
  proof: `node --test --test-name-pattern "AC1" test/e259-*.test.mjs`
- **AC2 (summary line)** — Given any run with at least one hit, when the summary line prints, then its extension list equals D8 exactly and equals the sorted registry keys (asserted both ways); the pre-reassigned `test/e258b-comment-scan.test.mjs` AC8 lists and AC11 summary assertion are updated to match.
  proof: `node --test --test-name-pattern "AC2" test/e259-*.test.mjs` and `node --test test/e258b-comment-scan.test.mjs`
- **AC3 (E258 behaviour unchanged)** — Given the E258 suite with only the two reassigned assertions updated, when it runs, then every other assertion passes unchanged (thresholds, diff scope, baseline, JSDoc tags, output cap, resilience, exit code).
  proof: `node --test test/e258b-comment-scan.test.mjs`
- **AC4 (JS table reused for new JS extensions)** — Given `.cjs`, `.mts`, `.cts` files holding a regex literal containing `//`, a template literal containing `/*`, an 8-line `//` block and a 7-line one, when `agc check` runs, then only the 8-line block is reported.
  proof: `node --test --test-name-pattern "AC4" test/e259-*.test.mjs`
- **AC5 (line-comment block threshold in every language)** — Given one file per extension in the `//` families with 7 and 8 consecutive `//` lines, and per extension in the `#` families with 7 and 8 consecutive `#` lines (Ruby and Python included), when `agc check` runs, then only the 8-line block of each file is reported.
  proof: `node --test --test-name-pattern "AC5" test/e259-*.test.mjs`
- **AC6 (`/* */` and trailing comments)** — Given a `.java`, `.go` and `.cs` file with a 9-line `/* */` span, a trailing `// note` after code, and a blank line splitting two `//` runs, then the span is one reported block, the trailing comment is a code line, and the blank line splits the runs.
  proof: `node --test --test-name-pattern "AC6" test/e259-*.test.mjs`
- **AC7 (Rust raw strings)** — Given a `.rs` file with `r#"…"#` and `r##"…"##` strings spanning lines whose text holds `//` lines and a bare `"#`, and a `b"…"` string, then none of it is a comment and only the real comment is counted.
  proof: `node --test --test-name-pattern "AC7" test/e259-*.test.mjs`
- **AC8 (Rust lifetimes and char literals)** — Given `fn f<'a>(x: &'a str) -> &'a str { x } // note`, `let c = '"'; // note` and `'\''`, then each trailing `// note` is seen as a comment and no later line is swallowed.
  proof: `node --test --test-name-pattern "AC8" test/e259-*.test.mjs`
- **AC9 (nested block comments)** — Given `/* a /* b */ still comment */ code` layouts in `.rs`, `.swift`, `.kt`: the text between the inner `*/` and the outer `*/` is comment, code after the outer close is code, and an unclosed inner level keeps following lines as comment. Given `/* a /* b */ code` in `.java`, `.go`, `.c`, `.cs`, `.ts`: the first `*/` closes and the rest is code.
  proof: `node --test --test-name-pattern "AC9" test/e259-*.test.mjs`
- **AC10 (C++ raw strings)** — Given `.cpp`, `.h` and `.cc` files with `R"(…)"`, `R"x(… )" …)x"`, `u8R"(…)"` spanning lines whose text holds `//` and `/*` lines, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC10" test/e259-*.test.mjs`
- **AC11 (C# strings)** — Given a `.cs` file with `@"…"` spanning lines with `""` escapes and `//` text, `$@"…"`, `"""…"""` and a four-quote `""""…""""` raw string containing `"""`, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC11" test/e259-*.test.mjs`
- **AC12 (Go backticks)** — Given a `.go` file with a multi-line `` `…` `` string holding `//` lines and `/*`, then none of it is a comment; a `//` after the closing backtick is.
  proof: `node --test --test-name-pattern "AC12" test/e259-*.test.mjs`
- **AC13 (Kotlin multi-line strings)** — Given a `.kt` and a `.kts` file with `"""…"""` holding `//` lines and `${…}` templates, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC13" test/e259-*.test.mjs`
- **AC14 (Swift multi-line strings)** — Given a `.swift` file with `"""…"""`, `#"…"#` and `#"""…"""#` holding `//` lines and `\(…)` interpolation, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC14" test/e259-*.test.mjs`
- **AC15 (Java text blocks)** — Given a `.java` file with a `"""` text block holding `//` lines, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC15" test/e259-*.test.mjs`
- **AC16 (Python triple quotes in non-docstring position)** — Given a `.py` file where `x = """…"""`, `f(\n'''…'''\n)`, a triple-quoted string after a statement, and an `if ok:` followed by a triple-quoted string each hold `#` lines, then none of it is a comment.
  proof: `node --test --test-name-pattern "AC16" test/e259-*.test.mjs`
- **AC17 (Python docstrings are comments)** — Given module, class, `def`, `async def` and multi-line-signature docstrings (one with an `r` prefix), when 8 text lines are inside, then a `long-block` is reported; with 7 text lines plus `"""` delimiter lines, silent; docstring lines raise the file ratio; a one-line `"""x"""` is one comment line.
  proof: `node --test --test-name-pattern "AC17" test/e259-*.test.mjs`
- **AC18 (shebang)** — Given `.sh`, `.py`, `.rb` files opening with `#!` and 7 `#` lines, then silent; with 8 `#` lines after the shebang, reported at line 2; a `#!` on line 2 is an ordinary comment.
  proof: `node --test --test-name-pattern "AC18" test/e259-*.test.mjs`
- **AC19 (shell `#` placement)** — Given `.sh`/`.bash`/`.zsh` lines using `$#`, `${#a}`, `a#b`, `"#x"` and `'#x'`, then none is a comment; `ls # note` and a leading `# note` are.
  proof: `node --test --test-name-pattern "AC19" test/e259-*.test.mjs`
- **AC20 (Ruby `=begin`/`=end`)** — Given a `.rb` file with an `=begin`…`=end` span of 9 lines, then it is one reported block whose count excludes the two delimiter lines; an indented `=begin` and one mid-line are code; a `#` inside `"a #{b} # c"` and `'#'` is not a comment.
  proof: `node --test --test-name-pattern "AC20" test/e259-*.test.mjs`
- **AC21 (`@` and `\` doc tags)** — Given `.java`, `.kt`, `.cpp`, `.rb` doc blocks whose prose is 5 lines plus `@param`, `@return`, `@throws`, `@exception` and `@example` bodies totalling over 7 lines, then silent; 8 prose lines, then reported; a `@see` line counts as prose; `\param`, `\return`, `\throws` blocks in `.c` are excluded, in `.java` they are prose.
  proof: `node --test --test-name-pattern "AC21" test/e259-*.test.mjs`
- **AC22 (Swift markup and C# XML)** — Given a `.swift` block with 5 prose lines plus `- Parameters:` with nested `- name:` bullets, `- Returns:`, `- Throws:` totalling over 7 lines, then silent; a `- Note:` line counts as prose. Given a `.cs` `///` block with `<summary>` 5 lines plus `<param>`, `<returns>`, `<exception>` elements totalling over 7, then silent; 8 `<summary>` lines, reported.
  proof: `node --test --test-name-pattern "AC22" test/e259-*.test.mjs`
- **AC23 (Python docstring sections)** — Given a docstring with 5 prose lines plus `Args:`, `Returns:`, `Raises:` sections and a Sphinx `:param x:` / `:rtype:` group totalling over 7 lines, then silent; 8 prose lines, reported; `Note:` and `See Also:` headers count as prose.
  proof: `node --test --test-name-pattern "AC23" test/e259-*.test.mjs`
- **AC24 (no exclusion elsewhere; ratio counts everything)** — Given a `.rs` `///` block of 5 prose lines plus `# Errors` and `# Examples` sections over 7 lines, a `.go` doc block over 7 lines and a `.sh` block over 7 lines, then each is reported; for any language, tag and section lines still count toward the file ratio.
  proof: `node --test --test-name-pattern "AC24" test/e259-*.test.mjs`
- **AC25 (unknown extensions skipped)** — Given 8-line comment blocks in `a.yaml`, `b.toml`, `c.md`, `d.json`, `e.txt`, `Makefile`, `f.PY`, `g.d.mts` and `dist/h.py`, then no hit is printed for any.
  proof: `node --test --test-name-pattern "AC25" test/e259-*.test.mjs`
- **AC26 (robustness)** — Given a file per family ending inside an unterminated string, raw string, block comment or docstring, and one of 5000 lines, when `agc check` runs, then it completes, prints only advisory lines and leaves the exit code unchanged.
  proof: `node --test --test-name-pattern "AC26" test/e259-*.test.mjs`
- **AC27 (docs sync)** — Given the change, when a reader opens `docs/install.md`'s comment-length scan paragraph and `docs/config.md`'s comment-length scan row, then both list the scanned extensions, state that other files are skipped (so silence on them is not a clean result), state the doc-tag rules of D6 and Python docstrings as comments, name the known misreads of D7 in one sentence, and keep `agc check — comments`. No other section of either file changes.
  proof: `git diff 015b44c...HEAD -- docs/install.md docs/config.md` shows only that paragraph and that row changed; the base SHA is a reporting aid only, no resident test pins it.
- **AC28 (the new modules pass their own limits)** — Given `dist/tools/comment-scan.js` and each new `dist/tools/comment-*.js`, when the analysis function runs on the source of each `tools/comment-*.ts`, then no block exceeds 7 counted lines and the file ratio is 30% or less.
  proof: `node --test --test-name-pattern "AC28" test/e259-*.test.mjs`
- **AC29 (lane boundary)** — Given the lane's commits, when changed paths are listed, then each is in the owned set of the fan-out plan (plus the two reassigned assertions in `test/e258b-comment-scan.test.mjs`), and nothing under `content/**`, goldens, `bin/**`, `prompts/**`, `gates/**`, `schema/**`, `templates/**` or `scripts/**` changed.
  proof: `git diff --name-only 015b44c...HEAD`
- **Lane-diff evidence (task evidence, not a resident test)** — T-E259-09's handoff and the code-review report quote the real output of `node bin/agc-init.mjs check` in the lane worktree after commit (every `agc check — comments` line, or "none").

### AC -> task
| AC | task |
|---|---|
| AC1, AC2 (code), AC4, AC25 | T-E259-01 |
| AC5 (`//` families), AC6, AC8, AC9 (non-nested), AC12, AC15 | T-E259-02 |
| AC7, AC9 (nested), AC10, AC11, AC13, AC14 | T-E259-03 |
| AC5 (`#` families), AC16, AC17, AC18, AC19, AC20 | T-E259-04 |
| AC21, AC22, AC23, AC24 | T-E259-05 |
| AC27 | T-E259-06 |
| tests for T-01..T-03 ACs, AC2 assertion edits, AC3 | T-E259-07 |
| tests for T-04..T-05 ACs, AC26 | T-E259-08 |
| AC27 check, AC28, AC29, lane-diff evidence | T-E259-09 |

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| comments.summary | `agc check — comments: {n} warning(s) in {m} file(s) (only {exts} are scanned) — advisory; keep a comment to WHAT and WHY, move long rationale to a tracked spec or the commit message (see Comment discipline, constitution section 6)` where `{exts}` is the D8 list | `specs/e258b-comment-scan.md` comments.summary; only the extension list changes (authored-here: list derived from the registry) |
| comments.block, comments.ratio, comments.more, comments.error | unchanged from `specs/e258b-comment-scan.md` | `specs/e258b-comment-scan.md` Copy / Strings |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- YAML, TOML, JSON, Markdown and other config/markup files; PHP, Lua, SQL and any language not in D2.
- Blocking, auto-fix, whole-repo scan, rule prose, reviewer SOP, `bin/**`, thresholds, a config key for languages.
- NumPy docstring sections, rustdoc section exclusion, heredoc and Ruby `%`-literal handling (D7 known misreads).
- Re-baselining E260's existing-comment trim.

## Dependencies / Prerequisites
- E258 done (v4.3.0). Human rulings (`specs/fanout-e246-e259.md` Decisions): language list as cut, Python docstrings count as comments, YAML/TOML not scanned.
- Lane boundary per `specs/fanout-e246-e259.md` (e259 row and ownership re-assignments): `docs/install.md` and `docs/config.md` only in the scan paragraph/row; `test/e258b-comment-scan.test.mjs` only the AC8 scannable-path lists and the AC11 summary assertion.
- PM decisions to confirm at cut (not human-ruled): D6 tag-exclusion table; Java text blocks and Swift `#"…"#` included as string forms; `.d.mts`/`.d.cts` excluded like `.d.ts`; `.h` parsed as C++; Python docstring detection rule (D5); summary extension order (ASCII-sorted).
- Architect hop: yes (D9). Serial chain; tasks share `tools/comment-*.ts`, so no intra-lane fan-out.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.
