# Review — T-E258B-01

covers: T-E258B-01, T-E258B-02, T-E258B-03, T-E258B-04

## Summary
- Diff `730ec20..HEAD` (ef37922, 4aeb0a9, 42f731e) adds `tools/comment-scan.ts` (a pure layer and an I/O layer), its four `dist/tools/comment-scan.*` build files, the `loadCommentScan`/`checkComments` wiring in `bin/agc-init.mjs`, and one paragraph in `docs/install.md` plus one bullet in `docs/config.md`.
- The lexer, block counting, D5 tag exclusion, hunk parser, base resolution, output assembly and never-throw wiring match the spec and the architecture blueprint. I checked this by reading the code and by probing the built module and temp git repos directly (see Correctness).
- Lane-diff evidence: `agc check` in the worktree prints exactly one comments warning, `bin/agc-init.mjs high-ratio 30.5%`. It is kept with a reason (see Lane-diff evidence).
- Verdict: APPROVED. No required findings; three optional notes.
- Model note: the sr-engineer was pinned to fable and this review ran on opus, so the models differ and there is no same-model bias concern.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs:1252. `checkComments` is awaited before the stamp check and never touches `process.exitCode`. Every temp-repo run below exited 0 whatever it found. The resident proof is qa's (T-E258B-05).
AC2 — implemented — tools/comment-scan.ts:236-243 (`counted > 7`). A 9-line block is reported as `long-block 9`; the 60×8-line case reports `long-block 8`.
AC3 — implemented — tools/comment-scan.ts:238-242. Temp repo: an unrelated edit was silent; an edit inside the block and an insertion into the block both reported; a deletion inside the block was silent.
AC4 — implemented — tools/comment-scan.ts:229-235. The integer comparison makes exactly 30% silent (`formatPct(30,100)`=`30`, and it does not fire). Adding a code line to an over-ratio file was silent; adding a comment line reported `33.9%`.
AC5 — implemented — tools/comment-scan.ts:230 (`nonBlank >= 50` gates only the ratio check; the block loop is ungated).
AC6 — implemented — tools/comment-scan.ts:191-200. Probe: 5 prose lines plus @param/@returns/@throws/@example lines gave counted=5. Six prose lines plus `@param` plus two `@see` lines gave counted=8. Delimiter-only lines are not counted.
AC7 — implemented — tools/comment-scan.ts:91-189. Probe results: strings, templates (including nested `${ {…} }` and `'}'` inside `${}`), regexes (`/\/\/ x/`, `/[/*]/g`, `return /\*/`), trailing comments and division all lex correctly. A blank line splits a run into two blocks, and `/* */` then `x();` on the closing line is a code line.
AC8 — implemented — tools/comment-scan.ts:303-306 (names), 382-393 (lstat/size/NUL).
AC9 — implemented — tools/comment-scan.ts:350-366, 368-380. Temp repo: a branch one commit ahead of main was reported, a deleted tracked file was silent, and an upstream took precedence (upstream = HEAD, silent).
AC10 — implemented — tools/comment-scan.ts:359. No git and no commit both printed nothing and exited 0.
AC11 — implemented — tools/comment-scan.ts:312-326. 60 blocks printed 50 hit lines, then `… 10 more warning(s) not listed`, then `60 warning(s) in 60 file(s)`, all on stderr.
AC12 — implemented — bin/agc-init.mjs:1222-1243, tools/comment-scan.ts:408-414. Running a copy of bin/ with no dist printed exactly `agc check — comments: scan skipped (cannot load dist/tools/comment-scan.js — run \`npm run build\`)`, which holds no absolute path.
AC13 — implemented — `node --test test/agc-adapters.test.mjs test/e106-init-artifacts-flag.test.mjs` (together with error-code-contract) gave 78/78 pass. Neither file is in the diff.
AC14 — implemented — base = HEAD in a fresh copy gives an empty diff, and the scan is silent. The proof test belongs to qa.
AC14b — implemented — `analyzeText(tools/comment-scan.ts)` gives 13/381 = 3.5%, longest block 5 counted lines.
AC15 — implemented — docs/install.md:161, docs/config.md:49. Both name advisory/exit-neutral, diff-only, 7 lines / 30%, the 50-line exemption, the JSDoc tags, the scanned extensions with the "silence is not clean" caveat, and `agc check — comments`. Each is a single insertion after the hygiene text; no other lines changed.
AC16 — implemented — `git diff --name-only 2484ede...HEAD` lists only `.current/e258b/*`, bin/agc-init.mjs, dist/tools/comment-scan.{d.ts,d.ts.map,js,js.map}, docs/config.md, docs/install.md, specs/e258b-*, tools/comment-scan.ts. No other dist file changed (`git diff --quiet` over the rest of dist/ exits 0), and nothing under content/ changed.
Lane-diff evidence — implemented — see the section below.

## Correctness
No required findings. What I verified:
- Lexer states and line marking: tools/comment-scan.ts:105-180. At the start of a line, only `block` marks comment and `tpl` (or an escaped-newline string) marks code. `line`, `regex` and `regexClass` reset at end of line, and sq/dq reset unless the line ends in `\`. The shebang is handled at :101-104. The regex-vs-division decision (:159-167) uses the last significant character plus the keyword set, and a closed literal sets lastSig to a value, so `/a/g / 2` reads as division. The keyword test does not fire on `returned / 2`.
- The known misread #2 (a regex after `)` holding a backtick hides the comments that follow) reproduces as documented, and the docs name it.
- Block grouping and counting (:191-218) and D5 reset on any `@` tag (:195-196) match the blueprint.
- `formatPct` (:220-223) is an integer ceil equal to the blueprint's `Math.ceil(c*1000/n)` for positive ints: 31/100→31, 22/70→31.5, 301/1000→30.1.
- Hunk parser (:275-301): a trailing tab is dropped and C-quoted names are decoded. Temp repo: committed `sp ace.ts` and `q"t.ts` were both reported by their decoded names. A header-state `+++` is honoured, a content `++++ c` line is ignored, and `+0,0` hunks add nothing.
- Base resolution (:358-366): the first ref that resolves wins, and a merge-base failure falls back to `HEAD` with no fall-through, as in the D2 Decision Record. Git ENOENT and a non-repo both return null (silent).
- Never-throw: `runCommentScan` wraps everything, including a writer that fails inside the catch (:408-414). `checkComments` guards both the load and the call.
- optional: a block can become longer than 7 lines by deleting the code or blank line that separated two blocks. That diff adds no line, so it is silent. This is the literal D6 trigger ("at least one line of the block is in the added set"), so it is not a defect; qa could pin it if wanted.
- optional: `unquoteGitPath` (:256-260) walks UTF-16 code units, so an astral character (for example an emoji) in a path that git also C-quotes would decode as U+FFFD. With `core.quotePath=false`, quoting only happens for `"`, `\` or control characters, so the combination is extremely rare. Iterating with `for…of` would fix it.

## Quality
No required findings. Naming is camelCase, and there is no UPPER_SNAKE token in `tools/comment-scan.ts`; test/error-code-contract.test.mjs passes. The fixed load-failure `{why}` text appears both in `commentCopy.whyLoad` and as a literal in bin/agc-init.mjs:1234. The blueprint prescribes this, mirroring hygiene.
- optional: `commentCopy.whyLoad` is exported but nothing reads it; bin keeps its own literal. It is harmless and documented in the blueprint.

## Architecture
The code matches the blueprint: the pure/I-O split, the exported surface, the git argv (step 4 is byte-for-byte), the untracked `"all"` override, the wiring position right after `checkHygiene`, and imports limited to fs/path/node:child_process with no other tools/ module. On the Self-dogfood rule: the module header is 5 lines and the file sits at 3.5%. The bin additions carry one head-of-function comment line and no trailing prose comments, and the 28-line header of bin/agc-init.mjs is untouched.

## Security
No findings. Every git call uses `execFileSync` with an argv array and no shell. Paths reach `fs` only after `path.join(cwd, rel)`, and rel comes from git's own output. Control characters in printed paths are escaped (`displayPath`, :308-310). Error lines are fixed text and never contain a raw error or an absolute path. `GIT_OPTIONAL_LOCKS=0` is passed only to the child process.

## Performance
No findings. `agc check` gains one diff call and one ls-files call. The lexer is linear per file, file reads are capped at 1 MiB, and the added-line lookup is a Set. `findingsForFile` is O(lines + block lines). The per-character regex tests (`isIdentChar`, `/\s/`) are fine at this scale.

## Lane-diff evidence (integrator condition)
The reviewer re-ran `node bin/agc-init.mjs check` in the worktree on 2026-09-30 at HEAD 42f731e (the only uncommitted files were `.current/e258b/*`). Exit code: 0.

stdout:
```
agc check — OK (4.2.1) — all adapters current
```
stderr:
```
agc check — hygiene: skipped 16 home-path hit(s) with a placeholder username
agc check — comments: bin/agc-init.mjs high-ratio 30.5% of 3452 non-blank lines are comments (limit 30%)
agc check — comments: 1 warning(s) in 1 file(s) (only .ts/.tsx/.js/.jsx/.mjs are scanned) — advisory; keep a comment to WHAT and WHY, move long rationale to a tracked spec or the commit message (see Comment discipline, constitution section 6)
```
`agc check — comments` lines: the two above (one warning plus its summary). No `long-block` hit on any lane file.

- **KEEP — `bin/agc-init.mjs high-ratio 30.5%`.** I measured with the lane's own lexer: 1050/3430 = 30.7% at base 730ec20 and 1051/3452 = 30.5% at HEAD. The file was already over the limit, and this lane lowered its ratio. The only added comment line is the single head-of-function WHAT line on `checkComments` (bin/agc-init.mjs:1230), which the Self-dogfood rule allows. No trailing prose comment was used to dodge the scan.

## Verdict
APPROVED — every AC is implemented and verified against the spec and blueprint, and the only lane-diff warning is the designed, pre-existing high-ratio on bin/agc-init.mjs, kept with a reason.
