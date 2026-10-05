# Review — T-E260E-12..22 (lane e260e, test comment trims a-d)

covers: T-E260E-12, T-E260E-13, T-E260E-14, T-E260E-15, T-E260E-16, T-E260E-17, T-E260E-18, T-E260E-19, T-E260E-20, T-E260E-21, T-E260E-22

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Range `bdbffaf..4c92b3f` (branch `feat/e260e-test-a-d`): 26 owned test files changed, all mode `M`. Every added or removed line in `test/` is a `//` comment line or blank. No JSDoc or `/* */` comment was touched. Plus the new `specs/e260e-comment-rationale.md` (26 H2 sections, one per changed file) and the lane bookkeeping under `.current/e260e/`.
- Comment-only is proven by machine and confirmed independently: I re-ran `proof.mjs` (PASS, exit 0), scanned the diff for any changed non-comment line myself (none found), and mutation-tested the script (see AC12).
- Two of the trimmed comments are false about the code they sit on. Both errors were already in the base text, but the trim restated them as plain present-tense facts (details under Correctness). Both are `required`. Everything else is accurate, and the rationale was moved, not lost.
- Verdict: CHANGES_REQUESTED, for two comment edits plus the matching lines in the rationale spec.
- Process note (recorded, not a code finding, history not rewritten): the author used `git commit --amend` twice on local unpushed commits: T-E260E-17 (`35f060f` -> `c438a55`, reflog 16:53:26) and the authoring-complete state commit (`91d83f3` -> `1dcdd24`, reflog 17:01:16). Constitution section 6 forbids amend. Commit `4c92b3f` records the deviation itself.
- Same-model bias: I don't know the author's model tier. This review ran on opus.

## AC Completeness
AC1 — implemented — `proof.mjs` prints `emit: 26 files, 0 differ`. I re-ran it on HEAD, and a string-literal mutation makes it report `1 differ`.
AC2 — implemented — `tokens: 26 files, 0 differ`. My own diff scan finds no changed non-comment line in `test/`.
AC3 — implemented — `directives: 26 files, 0 count change(s)`.
AC4 — implemented — `scope: ok`. Every `test/` change is `M` and owned. The only other paths are `specs/e260e-*` and `.current/e260e/**`. Mutating `test/context-budget.test.mjs` makes the script report 2 bad paths.
AC5 — implemented — `>20: 0 block(s)` across all 28 owned files.
AC6 — implemented — `--list-mid` prints `8-20: 0 block(s)`, so no block needs a keep-reason.
AC7 — implemented — all 26 changed files have a matching `## test/<file>` section in `specs/e260e-comment-rationale.md`. The pointer form `More: specs/e260e-comment-rationale.md (<file>)` resolves in all 25 files that carry one (`_e123b9-round2-migrate.mjs` carries none, see O1). `node scripts/check-md-tables.mjs` exits 0. Two rationale sentences repeat the false claims (see C1, C2).
AC8 — implemented — `bare-id: 0`. I also sampled every trimmed block in all 11 tasks (the whole diff, 223 added lines). No comment's only content is an id. Ids such as `(T-E74-02)`, `(e123b9 J2, AC1/AC14)` and `(e2)` always follow plain words. The touched comment in `constitution-deliverable-guard.test.mjs` now describes the retired single-file constitution in words. The only untracked paths in touched comments are qa/review report paths, which the Generic citation bullet exempts (see R3).
AC9 — implemented — `form: ok`. Line 1 is unchanged in all 26 files. Every comment stays `//`. There are no `/*!` or `/// <reference` lines and no `##` heading in any comment.
AC10 — implemented (author claim, re-run by me) — see the suite result under Performance.
AC11 — implemented — `node .current/e260e/proof.mjs; echo "exit=$?"` ends `proof: PASS` and `exit=0` at HEAD `4c92b3f`.
AC12 — implemented (this report) — I read `.current/e260e/proof.mjs` in full and mutation-tested it in a throwaway detached worktree at HEAD (since removed):
- **Inputs.** The base is the first line of `.current/e260e/base-sha`, or `--base`. That file is git-excluded (`.git/info/exclude: /.current/**/base-sha`), so a fresh checkout must pass `--base bdbffaf`. Without a base the script exits 2 with a clear message.
- **What it compares.** It diffs the base against the working tree (`git diff --name-status <base>`, plus the HEAD text read from disk), so on a clean tree that is HEAD.
- **Which files.** The `OWNED` regex matches exactly 28 tracked files, the measurement table's set. `changed` is the `M`-status owned `.mjs` files: 26.
- **scope.** Every path from the diff and from untracked files must be bookkeeping, or `M` and owned. Mutation result: an edit to `test/context-budget.test.mjs` gives FAIL.
- **emit.** `transpileModule` runs with the repo tsconfig plus `removeComments`, sourcemaps and declarations off, on both versions, and compares strings. Mutation results: a string-literal change gives FAIL. A `return /*<newline>*/ x` ASI change gives FAIL on emit only, while tokens stay equal. So emit and tokens complement each other.
- **tokens.** It compares the leaf `getChildren()` tokens (kind and text, with JSDoc nodes and EOF skipped). Mutation result: a string-literal change gives FAIL.
- **directives.** It counts `@ts-*`, `eslint-*`, `__PURE__` and `@vite-ignore` matches over the whole file text, strings included.
- **>20 and 8–20.** It uses `analyzeText` from the committed `dist/tools/comment-scan.js`, the same counter `agc check` uses.
- **bare-id.** See R1.
- **form.** It checks that line 1 is equal, that the `/* */` count does not grow, that no comment line has `##` straight after the marker, and that `/*!` and `/// <reference` lines are identical. Mutations of the first line, a `// ## Heading` line and an added JSDoc block each give FAIL. It does not detect JSDoc turned into `//`, but this diff touches no JSDoc.
- **Exit code.** 0 on PASS, 1 on FAIL (I confirmed both), 2 when there is no base. An uncaught throw also gives non-zero.
- **Weaknesses found.** R1 and R2, plus the latent extension hole O4.

## Correctness
- **C1 — required** — `test/drift-skew.test.mjs:66-68`: the trimmed comment says the fixture is written "not at the flat path, which the skew precheck cannot see (AC13)". That is false. `tools/drift.ts:222-228` (`readArtifactVersion`, `handoff` branch) falls back from the lane path to the flat path, and the same file's AC8 block at `test/drift-skew.test.mjs:202-204` says so. The base text pointed out the old gap and said it was "covered separately below". The trim dropped that pointer and turned the gap into a present-tense fact, so the comment now contradicts both the code and the file itself. Fix: give the real reason, which is that this test covers the already-migrated lane-path case and the flat-path case is the AC8 test below. Also make `specs/e260e-comment-rationale.md:129` clearly past tense. Its "read only the lane path ... (the J2-NEW-9 gap, covered separately below)" reads as current behaviour.
- **C2 — required** — `test/constitution-deliverable-guard.test.mjs:27-28`: the rewritten comment says REQUIRED_VISUAL_SECTIONS "is read from the compiled output of tools/evidence-file.ts" and that "a failed import (dist not built) fails loudly". The code right below (`:36-44`) instead runs `fs.readFileSync(path.join(ROOT, "gates", "visual.ts"))` and regex-matches the TypeScript source. There is no dist import, and the array lives in `gates/visual.ts:251`, not `tools/evidence-file.ts`. The base text had the same error, but this lane rewrote the comment and kept it, and `specs/e260e-comment-rationale.md:56` repeats it ("compiled output of `tools/evidence-file.ts` (sync point near line 342)"). Fix: say it is parsed from the `gates/visual.ts` source so the test self-syncs, and correct the rationale line. Optional while there: the untouched inner comments at `:32-35` and `:40-41` carry the same stale location.
- Expected-red sampling (SOP 4a): N/A. The diff adds no intentionally red test and the suite has 0 failures, so no `qa_reports/expected-red_E260E.txt` is needed.

## Quality
- **R1 — recommended (proof weakness)** — `.current/e260e/proof.mjs` `BARE_ID` matches only lines made of an `E<n>` id. AC8 also bans a bare AC or DR reference standing alone. Mutation results: `// AC3`, `// DR-3` and `// T-E123A3-08` each pass with `bare-id: 0`, and only `// E57` fails. AC8 holds here only because I sampled every trimmed block by hand. Widen the regex to `(E|AC|DR|T-)[\w-]*\d` id-only lines if the script is reused for later lanes.
- **R2 — optional (proof weakness)** — the AC labels in `proof.mjs`'s own section comments are off by one against the spec: scope is marked `(AC3)` but is AC4; directives is marked `(AC)`; long blocks is marked `(AC4, AC5)` but is AC5/AC6; bare-id is marked `(AC7)` but is AC8; form is marked `(AC8)` but is AC9. This doesn't change behaviour, but it misleads whoever audits the script against the spec.
- **R3 — recommended** — touched comments keep governance-report paths that no longer exist at the cited location, because the files were moved under `*/archive/<feature>/`:
  - `test/agc-adapters.test.mjs:978` cites `review_reports/review_T-E111-01.md`
  - `test/check-md-tables.test.mjs:659` cites `review_reports/review_T-E145-01.md`
  - `test/check-md-tables.test.mjs:766` cites `qa_reports/review_T-E88E105-02.md`
  - eight more such paths appear in `specs/e260e-comment-rationale.md`

  Qa/review reports are exempt from the Generic citation bullet, so this does not block. Since the pointers dangle, consider giving the archive path or describing the report in words.
- **O1 — optional** — `test/_e123b9-round2-migrate.mjs` has a rationale section but its comment has no pointer line. AC7 allows "at most one" pointer, so this complies, but it is the only one of the 26 files without one.
- **O2 — optional** — several new comment lines run to 126–157 columns, wider than the ~100-column wrap around them: `test/cut-approval-gate.test.mjs:113` and `:582`, `test/drift-baseline.test.mjs:5`, `test/drift-archived-tasks.test.mjs:5`, `test/check-md-tables.test.mjs:2` and `:373`, and `test/dispatch-pins.test.mjs:176`.
- **agc check — comments (SOP 4b)** — one warning: `test/constitution-deliverable-guard.test.mjs` high-ratio 30.2% (limit 30%). Kept, because the file-level ratio is out of scope by the spec ("reported, not gated") and the lane already lowered it. The C2 fix need not add lines.

## Architecture
No architecture spec exists for this lane. The changes are comment-only in owned test files plus one new tracked rationale spec, so layering is unchanged. The rationale spec follows the lane rule (one H2 per source file, one pointer line per comment).

## Security
No findings. No code, strings or dependencies changed. The proof script only runs `git` through `execFileSync` with fixed arguments and no shell, and reads repo files.

## Performance
No findings. There are no runtime changes, because emit is byte-identical for all 26 files. Full suite re-run by the reviewer on clean HEAD `4c92b3f` via `node scripts/test-lock.mjs -- npm test`: exit 0, tests 3043, pass 3040, fail 0, skipped 3, which matches the author's figures. The build step leaves no dist drift; `git status` afterwards shows only the lane bookkeeping.

- **O4 — optional (latent proof hole)** — `OWNED` accepts any `test/_*` extension, but `changed` keeps only `.mjs`. A modified non-`.mjs` `test/_*` file would therefore pass scope without any emit or tokens check. No such file exists today (all six helpers are `.mjs`).

## Verdict
CHANGES_REQUESTED: the lane is provably comment-only and otherwise clean, but two rewritten comments are false about the code they describe (C1 `test/drift-skew.test.mjs:66-68`, C2 `test/constitution-deliverable-guard.test.mjs:27-28`, plus the matching rationale lines 56 and 129). The fix is a comment-only edit by the qa author, re-proved with `proof.mjs`.

## Round 2 — APPROVED — by code-reviewer

## Summary
- Range `2706e4b..9aa9d7c`: fixes `ff98296` (C1), `1c0acdb` (C2), `e8ac81e` (R3) and `4f41d1c` (R1, R2, O4 in `.current/e260e/proof.mjs`), plus lane state commits `879ee18` and `9aa9d7c`. In `test/`, 4 files changed, all comment lines. The other changes are in `specs/e260e-comment-rationale.md`, `.current/e260e/proof.mjs` and lane state.
- All six in-scope findings (C1, C2, R1, R2, R3, O4) are resolved. Per the PM, O1 and O2 were accepted as-is and are not raised again.
- Comment-only still holds. I re-ran `node .current/e260e/proof.mjs` at HEAD `9aa9d7c` and it ends `proof: PASS` with `exit=0`: 26 files changed, 0 differ on emit, 0 on tokens, 0 directive count changes, `>20: 0`, `bare-id: 0`, `form: ok`. `--list-mid` is also clean.
- New comment text was checked against the code it describes. Each repointed report path exists in `git ls-files`.
- Verdict: APPROVED. Two Optional items are noted (N1, N2). Neither blocks.

## AC Completeness
The round-1 lines still stand. Only the ACs the fixes touch are restated here.
AC7 — implemented — the rationale spec lines for C1 (`drift-skew` section, point (b)) and C2 (`constitution-deliverable-guard` section) are corrected and accurate. `node scripts/check-md-tables.mjs` exits 0.
AC8 — implemented — `bare-id: 0` on the widened regex (see AC12).
AC10 — implemented — no fix can change the suite, because emit is byte-identical for all 26 files. I did not repeat the full suite run. I ran the 4 touched files directly (`node --test` on drift-skew, constitution-deliverable-guard, check-md-tables and agc-adapters): 110 tests, 110 pass, 0 fail. The author's whole-suite figure (3043 / 3040 / 0 fail / 3 skipped) matches my round-1 run on byte-identical emit.
AC11 — implemented — `proof: PASS`, `exit=0` at `9aa9d7c`.
AC12 — implemented. I read the `proof.mjs` diff in full and mutation-tested it in a throwaway detached worktree, since removed:
- **Widened bare-id (R1).** The new pattern is `(?:E[0-9]+[a-z]?|AC-?[0-9]+|DR-?[0-9]+|T-[A-Za-z0-9-]*[0-9])`. I appended `// AC3`, `// DR-3`, `// T-E123A3-08`, `// E57`, `// AC3 — has words so not bare` and `// T-E260E-12: trims the drift tests`. The script reported `bare-id: 4` on exactly the first four lines, `proof: FAIL (bare-id)` and exit 1. So the four id-only lines are caught and the two id-plus-words lines are not false positives. A lone `// AC3` mutation alone also gives exit 1.
- **Unsupported extension (O4).** On a temporary base commit that adds `test/_fixture-r2.txt` and `test/_helper-r2.ts`, changing the `.txt` gives `scope: 1 bad path(s)` with the message `unsupported extension, emit/tokens not checkable: test/_fixture-r2.txt` and exit 1. It no longer passes silently.
- **New checkable extensions.** A code change in `test/_helper-r2.ts` fails emit and tokens. A comment-only `.ts` change passes emit and tokens. It fails only `form` (first line changed), which is the correct AC9 behaviour. So `.ts` is genuinely checkable through `transpileModule`, not just accepted.
- **Labels (R2).** The section comments now read scope (AC4), directives (AC3), long blocks (AC5, AC6), bare-id (AC8) and form (AC9), matching the spec as round 1 mapped it.

## Correctness
- **C1 — resolved** — `test/drift-skew.test.mjs:66-69` now says this test covers the lane-path case only, and that the flat-path case (precheck falls back lane-then-flat) is the AC8 test below. That matches `tools/drift.ts:222-228` (`fs.existsSync(lanePath) ? lanePath : resolveFlatLanePaths(abs).handoffPath`) and the AC8 test at `:208`. The rationale spec's point (b) is now explicitly past tense ("At the time it was written ... That gap has since been closed").
- **C2 — resolved** — `test/constitution-deliverable-guard.test.mjs:27-28` now says the array is parsed from the `gates/visual.ts` source with `fs.readFileSync` and no dist import. That matches `:36-44`, and `gates/visual.ts:251` is where the array is declared. The inner comments at `:31-39`, which round 1 marked optional, are also corrected and now cite `gates/visual.ts`. The rationale line is corrected, and the "rebuild" advice is gone, which is right because the test reads source. The agc comment-ratio warning recorded in round 1 (30.2%) is cleared: `findingsForFile` on HEAD reports no findings for this file.
- **N1 — optional (pre-existing, not lane-touched)** — `test/drift-skew.test.mjs:34-39` (the `writeRawHandoffAtLanePath` helper comment) and `:171-172` still say the skew precheck has "no lane-then-flat fallback" and "no flat fallback". That is the same stale claim as C1. Neither block is in the lane's diff against `bdbffaf`, so this is out of scope. It is worth a follow-up so the file stops contradicting its own AC8 block.

## Quality
- **R1, R2 — resolved** — see AC12.
- **R3 — resolved** — the three test comments now cite paths that are all tracked:
  - `review_reports/archive/e111-lane-worktree-evidence/review_T-E111-01.md`
  - `review_reports/archive/e145-md-tables-cited-donemark/review_T-E145-01.md`
  - `qa_reports/archive/wave1.5-content-catchup/review_T-E88E105-02.md`

  All eight repointed spec paths are also tracked (`git ls-files --error-unmatch`).
- **N2 — optional** — `specs/e260e-comment-rationale.md:50` still cites `qa_reports/expected-red_e73-agc-feature-lifecycle.txt`, which now lives at `qa_reports/archive/e73-agc-feature-lifecycle/expected-red_e73-agc-feature-lifecycle.txt`. It is the same class as R3 and was missed by the sweep, which targeted `review_*` paths. It is exempt under the Generic citation bullet and does not block.
- The fix lines `test/check-md-tables.test.mjs:659-661` rewrap into a 35-column middle line, and `:767` is 136 columns. This is cosmetic and covered by O2, which was accepted, so it is not raised again.
- **agc check — comments (SOP 4b)** — `findingsForFile` is clean at HEAD for all 4 touched files. `agc check` gives `OK (4.4.0)`.

## Architecture
No change since round 1. The fixes are comment-only, plus a self-contained edit to the lane-local proof script.

## Security
No findings. `proof.mjs` still calls `git` only through `execFileSync` with fixed arguments. The new `CHECKABLE` regex is anchored on the extension and is applied to tracked paths only.

## Performance
No findings. Runtime emit is unchanged for all 26 files. The `proof.mjs` change adds one extra filter pass over the changed list.

## Verdict
APPROVED — C1, C2, R1, R2, R3 and O4 are all resolved accurately, the lane is still provably comment-only (proof PASS, exit 0, re-run by me), and the two remaining items (N1, which is pre-existing, and N2, a missed archived path) are Optional.
