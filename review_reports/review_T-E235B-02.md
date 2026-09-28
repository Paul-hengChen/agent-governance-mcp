# Review — T-E235B-02 (batched round 1)

covers: T-E235B-02, T-E235B-03, T-E235B-04, T-E235B-05, T-E235B-09, T-E235B-10, T-E235B-11, T-E235B-12, T-E235B-13, T-E235B-14

## Round 1 — APPROVED — by code-reviewer

Reviewer model: opus. The sr-engineer was pinned to fable, so the two roles ran on different models.
Diff reviewed: `git diff main...HEAD` on `feat/e235b-relative-manifest-worktree` (c9634b6, 0b089e6, b12188d, 6808b50).
Judged against `specs/e235b-relative-manifest-worktree.md` (AC1–13), `specs/e235b-relative-manifest-worktree-architecture.md`, and the e235b row of `specs/fanout-e235.md` plus the spec's E240 add-on scope.

## Summary
- `tools/fanout-manifest.ts` adds the pure `resolveWorktree` / `isAbsoluteWorktree` functions and the render-only `WORKTREE_EMPTY` / `WORKTREE_TILDE` row errors. `renderPrompt` now resolves `<worktree>` against `primary`. `runValidate` adds one non-fatal WARN line per absolute dispatchable cell and does not echo the value. `dist/` is in sync: rebuilding produced no diff, and `tsc --noEmit` is clean.
- `docs/lane-protocol.md` gets one bullet under §1 step 1, as the architecture specifies.
- In the specs, 9 `specs/fanout-*.md` worktree cells are rewritten to `../<lanes-dir>/<lane>`, and each file keeps its own lanes-dir name.
- The rest is a prose- and comment-only information-hygiene scrub across AC7 and AC9–11, including the rename of the research file.
- Full suite: 2891 tests, 2886 pass, 2 fail, 3 skipped. The 2 failures are exactly the two entries in the expected-red manifest.
- Verdict: APPROVED. There are no `required` findings.

## AC Completeness
- AC1 — implemented. The parser never checked the worktree column, and a relative cell validates with exit 0 and no WARN. All 7 parseable `specs/fanout-*.md` files validate with no WARN line. `fanout-wave5.1.md` and `fanout-wave6.md` are legacy-format files that fail validation the same way they did before this change, and their cells were checked directly instead.
- AC2 — implemented. See `tools/fanout-manifest.ts:760-773` and `:840-845`. An absolute cell is returned byte-verbatim, trailing slash included, and a relative cell becomes `path.resolve(primary, cell)`.
- AC3 — implemented (no change, as intended). `checkLane`, `tools/lane-status.ts` and `scripts/lane-status.mjs` are untouched, and `parseManifest` keeps the raw cell. The R7–R9 regression tests are qa-owned (T-07).
- AC4 — implemented. One bullet at `docs/lane-protocol.md:19`, and the module header is amended at `tools/fanout-manifest.ts:22-29`.
- AC5 — implemented (vacuous). `content/**` is untouched, so T-E235B-08 is N/A.
- AC6 — partial by design. The spec half is done: 9 files, cells only, plus the prose lines the architecture names. The fixtures and the golden are qa-owned T-06 work, and the two resulting reds are recorded in the expected-red manifest. Not a finding against this round.
- AC7 — implemented. All five files are scrubbed with class descriptions, and no heading, verdict or `covers:` line changed.
- AC8 — implemented for sr's self-scan. See the leak scan under Security. The final full-scope re-scan is qa's T-16.
- AC9 — implemented. `tools/transitions.ts` changed in comments only (3 comment lines) and dist was rebuilt. `CHANGELOG.md`, `NEW-TICKETS.md`, `docs/backlog.md` and `docs/v4.0.0-execution-plan.md` changed only at leaked-string words: a word-level diff shows no other token changed, and no done-mark or ticket number moved. The agc-feedback file's config-dir occurrences are gone.
- AC10 — implemented. The research file was renamed with one prose line scrubbed, so its cited line numbers still hold. References are updated in `tools/transitions.ts`, dist, `CHANGELOG.md`, `docs/backlog.md` and the three named archive and review locations, with the path token only in those three.
- AC11 — implemented. All 8 named specs plus `specs/fanout-wave7.md` are scrubbed. The evidence files carrying the class were scrubbed in prose lines only.
- AC12 — N/A this round (qa-owned T-15).
- AC13 — implemented. Every edit outside AC1–2 is a prose or comment token. A word-diff confirms that each changed token is a leaked string, a reference path, or its class-description replacement.

## Correctness
No required findings.

### The three questions the coordinator asked
1. **Do the 9 qa_review body lines that begin with PASS count as prose?** Yes. There are 9 minus-lines and 9 plus-lines, across `review_T-E34-01/02` (2 each) and `review_T-E180-01..05` (1 each). Each is the recorded qa_review body that sits under an unchanged `## <ts> — PASS — by qa-engineer` heading. The heading is the verdict line. The body is free text that happens to open with the same word. The leading `PASS — T-…` token is preserved byte-for-byte, and only the leaked substring changed. That matches the AC7 discipline and the E232 precedent.
2. **Are the `specs/fanout-wave7.md` status line and Decisions cell edits within AC11?** Yes. AC11 names `specs/fanout-wave7.md` explicitly as in scope for this leaked class. The architecture's "only those lines change" rule (Interface Contracts §5) limits the worktree-path rewrite, not the AC11 adopter-name scrub. The edit changes the content of one D3 cell and does not change the table structure: `validate` still reports 23 decisions, as it did before.
3. **Is the render golden's expected new value `worktree: /agm-lanes/e177a` (with `--primary /p`) correct?** Yes. `path.resolve("/p", "../agm-lanes/e177a")` returns `/agm-lanes/e177a`, which I confirmed by calling the built `resolveWorktree`. It also matches the architecture's Affected Files entry and its AC6 regex.

### resolveWorktree edge cases (run against dist)
- `..` traversal: `../../../../etc` resolves to `/etc`, and `x/../../y` resolves to `/y`. This is permitted: the architecture states there is no check that the result stays outside primary, the function is pure, and render only emits prompt text. — optional: none.
- Trailing slash: a relative cell's trailing slash is normalized away (`../lanes/e1/` becomes `/lanes/e1`). An absolute cell keeps it (`/tmp/e1/` stays as is), matching R2 and AC2.
- Windows-style: on POSIX, `C:\…` and `..\lanes\e1` are not absolute, so they resolve to nonsense such as `/p/C:\…` with no error or WARN. On Windows, platform `path` handles both correctly. **optional:** a later ticket could flag backslash-containing cells on POSIX. It is not in any AC.
- Empty and whitespace-only cells give `WORKTREE_EMPTY`. A cell of `~`, `~/x` or `~user/x` gives `WORKTREE_TILDE` and is never expanded. `./~x` resolves as a normal relative path, which is correct.
- Primary absent: resolution is skipped, so only `PRIMARY_NOT_FOUND` is reported (`:840-845`).
- **optional:** a relative `--primary` (for example `./p`) produces an absolute worktree resolved against the current directory, while the `primary:` line stays relative. This was never in the contract, and callers pass an absolute path or `resolvePrimary` output.

### Expected-red sampling (4a)
`qa_reports/expected-red_e235b-relative-manifest-worktree.txt` exists and has 2 entries, and I sampled both. `"AC15 CLI contract"` is at `test/e177a-check-cli.test.mjs:279`, and `"AC2 validate wave7 exit 0"` is at `test/e177a-manifest.test.mjs:128`. Both are real tests, and both are the only failures in the full-suite run.

## Quality
No required findings. The naming follows the architecture's interface contract exactly. The new codes avoid the gate-suffix vocabulary, so `error-code-contract` stays green. The comments cite the E235b ticket and the architecture blueprint.

## Architecture
Matches the blueprint on every decision:
- no new header line or CLI flag;
- the base is `primary`, never `manifestDir` or cwd;
- an absolute cell passes through byte-verbatim;
- the errors are render-only, so `check` and `validate` exit codes are unchanged;
- `validateManifest` is unchanged, and the WARN line is added only in the CLI presentation layer;
- `scripts/fanout.mjs` and the lane-status files are unchanged.

**Out-of-scope check:** every touched file is inside the e235b row or the spec's E240 add-on scope. AC11's blanket clause covers the evidence files under qa_reports and review_reports that carry the class but are not listed in AC7. **optional:** the expected-red manifest's lowercase name does not literally match the `qa_reports/*E235B*` glob. Its filename is fixed by the SOP, so this is not a scope violation.

**Research rename:** apart from the known qa-owned comment at `test/qa-flow.test.mjs:2186`, there are zero dangling references to the old filename. The new name is referenced from 7 files.

## Security
Leak scan of the added lines across the whole diff. Counts only, case-insensitive:
- Plain local absolute path: 1. This is the one allowed exception, the lane handoff `prd_path` line.
- Hyphen-encoded session-directory form: 0.
- Temp-directory form: 0.
- Adopter project full name: 0.
- Adopter project short form: 0.
- Personal config-directory name form: 0. One regex match turned out to be an uppercase harness environment-variable name, which is not this class.

Post-image scan of every touched file: 0 hits, apart from the handoff `prd_path`. The hits in the wider tree are either the known e235a-owned orchestrator comment and its dist mirror, or `CLAUDE_*` environment-variable names that are false positives.

The new WARN line deliberately does not echo the absolute value. `WORKTREE_TILDE` never expands a home directory. The new code has no shell, fs or child-process paths.

## Performance
No findings. The added work is one `path.resolve` per render and one linear filter over the dispatchable rows in validate.

## Verdict
APPROVED. All ten sr tasks meet their ACs and the architecture. The hygiene scrub is limited to prose and comments and leaves no leak in the diff. The only red tests are the two recorded expected reds, which the qa-owned T-06 fixture rewrite will fix.
