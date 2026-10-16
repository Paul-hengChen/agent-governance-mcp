# Review — T-E283-01 (batched: E316 + E283 + E322)

covers: T-E316-01, T-E283-01, T-E322-01

## Round 1 — APPROVED — by code-reviewer

Diff: `befadd7..HEAD` (ec2ab31 T-E316-01, 32ce9b0 T-E283-01, 4e1e9db T-E322-01, 8d04a22 handoff). Contract: `specs/e283-fanout-handoff-and-ref-check.md` (D1–D5). No architecture spec (none planned: single module).
Model note: the reviewer and sr-engineer both ran on an opus-tier model, so same-model bias is possible. Every claim below was checked again with independent probes (scratch scripts outside the worktree), not taken from the sr's sweep.

## Summary
- E316: `parseCutSection` now counts every `CUT_HEADING_RE` line plus every section read as `Cut` (a Set of line numbers) toward `CUT_SECTION_DUPLICATE`, and checks this before the absent check. The doc comment names the setext and homoglyph limits.
- E283: `validateManifest` adds the `## 接手步驟` checks only when `isManifestClosed` is true (status text starts with `已結案`). There are 7 new `HANDOFF_*` codes with scope `handoff`. `parseManifest` does not change, so render, check, check --cut and owners never see these errors.
- E322: new read-only `owners` subcommand (`--range` / `--paths`, `OWNERS_USAGE`), routed in `scripts/fanout.mjs`. The generic `USAGE` is unchanged.
- Hard conditions (a)–(c) were checked independently: 550 base-vs-HEAD calls with 0 differences, 99/99 targeted tests pass, the committed dist matches a fresh build byte for byte, and `test/` is unchanged since dac6069.
- Verdict: APPROVED. No required findings. Two recommended follow-ups (owners crashes when git diff fails; blind spots in the absolute-path detector), and one spec wording amendment for AC-E322-1 that pm should make before qa judges it literally.

## AC Completeness
Behaviour proofs below come from the reviewer's in-process probes against the committed `dist/` (qa owns the resident tests).
- AC-E283-1 — implemented — tools/fanout-manifest.ts:811 `handoffSectionErrors` (absent branch). Probe: closed + no section → `HANDOFF_SECTION_ABSENT`.
- AC-E283-2 — implemented — `isNamedHeading` (`（`/`(` suffix), `STATUS_CLOSED_RE` `[：:]\s*`. Probe: `**狀態**: 已結案` with an ASCII colon and `## 接手步驟（換 session 用）` → no errors.
- AC-E283-3 — implemented — absent / duplicate / empty loop over `HANDOFF_SUBITEMS`. Messages match the Copy rows verbatim.
- AC-E283-4 — implemented — `readsNone` (tools/fanout-manifest.ts:872). Probe: `無`, `- 無`, `* 無`, `無。` pass; `監看 e283 信箱`, `無\n- 整合分支未刪`, `none` → `HANDOFF_BACKGROUND_NOT_NONE`.
- AC-E283-5 — implemented — `HANDOFF_ABSOLUTE_PATH_RE` (tools/fanout-manifest.ts:765). All 6 positive and 5 negative AC tokens behave as specified, and no message echoes the path.
- AC-E283-6 — implemented — unknown and optional `###` headings are never looked up.
- AC-E283-7 — implemented — duplicate-section branch, with a message that matches the Copy.
- AC-E283-8 — implemented — `validateManifest` returns `manifest.errors` unchanged when the manifest is not closed. Probe: status `結案 …` plus an empty `## 接手步驟` → no handoff code.
- AC-E283-9 — implemented — the handoff check is reachable only from `validateManifest`, and `runValidate` is its only caller (grep). runRender, runCheck, runCheckCut and runOwners call `parseManifest`.
- AC-E283-10 — implemented — `[...manifest.errors, ...handoffSectionErrors(text)]`.
- AC-E283-11 — implemented — independent sweep over all 22 `specs/fanout-*.md`, comparing base dist (dac6069, built under $TMPDIR) with HEAD dist. Exit codes, stdout and stderr are identical. Exit 0 everywhere except wave5.1 and wave6, which exit 2 with `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`. e296 and e235b pass unmodified.
- AC-E283-12 — implemented — render compared byte for byte on every dispatchable lane, every provisional lane and an unknown lane of all 22 manifests, with two argument sets each (one with `--summary/--reading/--primary/--base`, one bare to cover the error path). 0 differences.
- AC-E322-1 — implemented (with a spec-wording defect, see the sr's point 1) — tools/fanout-manifest.ts `ownersOf`. With lane ids `a`/`b` the probe gives exactly the AC's 3 HIT lines (with lowercase ids), the summary `4 path(s), 3 hit(s), 2 dispatchable lane(s)` and exit 1. With ids `A`/`B` it gives 2 hits, because the `.current/<lane>/` match is case-sensitive.
- AC-E322-2 — implemented — probe: `HIT  tools/a.ts  (a: tools/**; b: tools/a.ts)`, in table order.
- AC-E322-3 — implemented — probe: an empty list gives `0 path(s), 0 hit(s)` and exit 0.
- AC-E322-4 — implemented — probe through `scripts/fanout.mjs owners … --paths -` with stdin. The HIT lines, summary and exit equal the file form; only the source note differs (see the sr's point 2).
- AC-E322-5 — implemented — probe in a temp repo with a `git mv` rename plus `docs/x.md`. Both `tools/old.ts` and `tools/a.ts` are HITs, `docs/x.md` is not, the note names `lane...main`, and exit is 1.
- AC-E322-6 — implemented — `a..b`, `...b`, `-x...b`, `a...-b`, `a...b...c`, `a ...b` and `HEAD...--output=x` all give `RANGE_INVALID`. Also: `nope...HEAD` → `REF_NOT_FOUND`, a non-git dir or missing dir → `REPO_NOT_GIT`, a missing list → `PATHS_UNREADABLE`. All exit 2.
- AC-E322-7 — implemented — neither or both of `--range`/`--paths`, `--repo` with `--paths`, 0 or 2 positionals, and an unknown flag all exit 2 with `fanout: error: USAGE:` followed by the `OWNERS_USAGE` line.
- AC-E322-8 — implemented — a short Lanes row gives `ROW_CELL_COUNT` and exit 2. A Pins or Decisions format error still produces the normal report. The provisional note follows the Copy string.
- AC-E322-9 — implemented — `usageResult()` is byte-identical to base (sweep). The scripts/fanout.mjs header lists owners. The only git commands are `rev-parse` and `diff` (read-only), and nothing is written.
- AC-E316-1 — implemented — tools/fanout-manifest.ts:38 plus the union in `parseCutSection`. Probe: `##\tCut`, ` ## Cut`, `   ## Cut`, `## cut`, `## CUT` and `## Cut ##` each give `CUT_SECTION_DUPLICATE … (lines 3, 9)`.
- AC-E316-2 — implemented — probe: `    ## Cut`, `### Cut`, `## Cut Decisions` and `##Cut` are never counted as a Cut heading (each gives the same result as the spec without the extra line).
- AC-E316-3 — implemented — a lone `## cut` → `CUT_SECTION_ABSENT`.
- AC-E316-4 — implemented — the doc comment names setext and homoglyph; the e296 AC11 duplicate case passes unmodified.

## Correctness
- **recommended** — tools/fanout-manifest.ts:1778 `rangePaths`: the `git diff … a...b --` call has no guard. When git fails after both refs resolve (no merge base: unrelated histories, or a shallow clone that lacks the merge base), `execFileSync` throws out of `runOwners`. The CLI then prints a Node stack trace and **exits 1**, which the D4 contract defines as "at least one hit". Reproduced with an orphan-branch temp repo: `owners m --range main...other --repo <repo>` gives exit 1 and a stack trace. This does not block approval: (a) the failure is the conservative direction (it reads as "owned", which blocks a base fix and never lets a wrong one through), and it is loud; (b) `checkLane` (tools/fanout-manifest.ts:1274) has had the same unguarded diff since before this lane, and owners copies it; (c) no AC covers it. Suggested follow-up ticket: wrap both diff calls and map the failure to an input error (exit 2), for example a new `DIFF_FAILED` code.
- **recommended** — tools/fanout-manifest.ts:765 absolute-path detector. It follows D3 exactly as written, but the enumerated boundary set leaves real blind spots and one false positive:
  - False negatives (not hits): `**/Users/x/y**` (bold, and manifests use bold heavily), `primary:/Users/x/y` (ASCII colon), `a,/Users/x/y` (ASCII comma), `|/Users/x/y|`, `</Users/x/y>`, `『/Users/x/y』`, `file:///Users/x/y`, `$HOME/x/y`, and UNC paths `\\server\share`.
  - False positive: `預計 ~10/17 完成` is a hit, because `~10/` fits the spec's `~<user>/` form. A closing integrator who writes a tilde date has to reword it.
  - Not blocking, since it conforms to the spec. Suggested follow-up spec amendment: add `*`, `|`, `<`, ASCII `,`/`;`, `『`, `【` to the boundary set; require `~<user>` to start with a letter; and decide whether `file://` counts.
- **optional** — tools/fanout-manifest.ts:872-876 `readsNone` is slightly more lenient than D3's "remove one optional marker / one optional `。`": `-   無` and `無 。` pass (there is an extra `trim()` after each strip). This is harmless.
- **optional** — tools/fanout-manifest.ts:38: `## Cut#` (no space before `#`) is counted as a heading, although CommonMark renders it as the text "Cut#". The regex is D5's literal, and the error is in the safe direction (it refuses rather than hides).
- Verified with no finding:
  - The E316 union never double-counts: the `Set` is keyed by line number, and a `## Cut` line that both matches the regex and starts a section is counted once.
  - A trailing NBSP or U+3000 still counts, through the `splitSections` `trim()` arm.
  - The old `cut.length > 1` message is reproduced exactly when there are no variants. `parseCutSection` gives JSON-identical results to base for every `specs/*.md`.
  - The owners dedupe and sort are deterministic (Set, then code-unit compare).
  - Owners are taken in `m.dispatchable` table order, and the first matching token per lane wins over the bookkeeping match.

## Quality
- **optional** — `ownersOf` checks `ownersFatalErrors` again after `runOwners` already returned on it (tools/fanout-manifest.ts:1959 plus `ownersOf`). This is harmless, since `ownersOf` is exported as a pure API that must stand alone.
- **optional** — the RANGE_INVALID message lists four conditions, but `parseOwnersRange` also refuses `..` and a leading or trailing `.` inside a side. A user who passes `a....b` gets a reason the message does not state. Consider appending ", no `..` or edge `.` in a side".
- **optional** — the comment at tools/fanout-manifest.ts:1959 says "Before any git or file read", but the manifest file has already been read at that point. It means "before git or the path-list read".
- Comment check (SOP 4b), `agc check — comments` warnings touching the diff. Both are kept:
  - `scripts/fanout.mjs:2 long-block 10 lines`: kept. This header was already 8 lines (over the limit) at base. D4 / AC-E322-9 require the added usage line, and the second added line is a one-line "why" (owners is absent from the generic usage).
  - `tools/fanout-manifest.ts:1378 long-block 25 lines`: kept. This doc comment was already over the limit at base. AC-E316-4 requires the setext and homoglyph limit to be written in this comment.
- Naming: all new codes avoid the gate-suffix vocabulary of `test/error-code-contract.test.mjs` (`SUFFIX_RE` / `PREFIX_RE`), and the contract test passes.

## Architecture
No architecture spec exists (the spec records why no architect hop was needed). The layering is unchanged: all logic sits in `tools/fanout-manifest.ts`, `scripts/fanout.mjs` only routes, and the handoff check stays out of `parseManifest` as D3 requires.

## Security
- Git argument injection is closed off: no range side can start with `-`, so neither `rev-parse <ref>^{commit}` nor `diff <a>...<b>` can be read as an option. `--` ends the diff's revision list, `--repo` is used only as the `cwd`, and `execFileSync` is called without a shell. A probe with `HEAD...--output=x` → `RANGE_INVALID`.
- `--paths -` reads fd 0 once. An unreadable source → `PATHS_UNREADABLE` (exit 2).
- Information hygiene: `git diff befadd7..HEAD` has no machine-local absolute path (grep for `/Users`, `/home/`, `/private/` finds nothing). The HANDOFF_ABSOLUTE_PATH message never echoes the path (probe). The REF_NOT_FOUND and REPO_NOT_GIT messages echo the user-supplied `--repo` on stderr, which is the existing `check` convention.

## Performance
No regression. The owners matching cost is paths × lanes × tokens on CLI-scale inputs. Two git subprocesses run per side (rev-parse) plus one diff, the same as `check`. `isManifestClosed` stops at the first `## ` heading, and the handoff check runs only on closed manifests.

## Hard-condition evidence (independent)
- (a)/(b): base `dac6069` and HEAD were each extracted with `git archive` into $TMPDIR and built with `tsc`. One script imported both dists and compared 550 calls: 22 validate, every-lane render (×2 argument sets), check --cut on every lane-named spec, `parseCutSection` on every `specs/*.md`, and the generic usage. Exit code, stdout and stderr were compared byte for byte, and **0 differed**.
- (c): `git diff --stat dac6069 HEAD -- test/` is empty. `node --test test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs test/e177a-check-cli.test.mjs test/e178b-fanout-unmatched.test.mjs test/e235b-relative-worktree.test.mjs test/e248-relative-mailbox-header.test.mjs test/error-code-contract.test.mjs` → 99/99 pass.
- dist: a fresh `tsc` of HEAD gives a `dist/` with no difference from the committed tree (`diff -rq` empty, and all 4 `fanout-manifest.*` files compare identical with `cmp`).
- Full suite (`node --test test/*.test.mjs`, no rebuild): 3232 tests, 3228 pass, **1 fail**. The failure is `test/e234-hygiene-scan.test.mjs` AC16 ("an isolated copy of committed HEAD lists zero hits"), and it is caused by `specs/e283-fanout-handoff-and-ref-check.md:84`, which the hygiene scan flags as `home-path`. That is the AC-E283-5 fixture token list, a placeholder home-dir path written into the spec. **The cause is outside the reviewed diff**: the spec was added by the PM cut commit befadd7, which is the base of this review range, and no sr commit touches it. Pre-existing at befadd7. The sr code cannot fix it, because the spec belongs to pm. **pm must amend before qa** (full-suite red): rewrite line 84's home-dir example so the scanner skips it as a placeholder (the scanner already skips `/Users/x/repo`; the hit is the second-segment-username form), or describe it by class. This counts against the chain, not this diff, and is reported to the coordinator together with ruling 1 below.

## Rulings on the four sr-flagged points
1. **AC-E322-1 lane-id case**: the code needs no fix. D4 binds owners to `isImplicitBookkeeping`, so owners and `check` must agree on the bookkeeping set, and making owners case-insensitive would make them disagree. LANE_ID_RE does allow uppercase, so the AC's literal strings (`(A: …)` together with `.current/b/` → `(B: implicit bookkeeping)`) cannot all be produced at once. **This needs a spec wording amendment (pm)**: change the AC-E322-1 fixture text to lane ids `a`/`b` and the expected lines to `(a: …)` / `(b: implicit bookkeeping)`. The amendment does not block this code verdict, but pm should make it before qa judges the AC literally.
2. **`--paths -` note line prints `the list -`**: this is acceptable. It is the Copy `owners.note.paths` string with `<file>` = `-`, verbatim. AC-E322-4's "equals the file form" can only hold apart from the source note, because the file form names its own path in that note. qa compares the HIT lines, the summary and the exit code. No amendment is needed.
3. **Stricter RANGE_INVALID** (`..`, or a leading or trailing `.` inside a side): this is an acceptable deviation. Such a side is never a valid ref name (git check-ref-format), and `a....b` is ambiguous under D4's "exactly `<a>...<b>` (one `...`)", so refusing it is the faithful reading. It only changes REF_NOT_FOUND to RANGE_INVALID for inputs that cannot resolve. Optional: name the extra rule in the message (see Quality).
4. **Cut duplicate union rule**: this is acceptable and stricter than D5's literal in the safe direction. It adds only sections that `splitSections` already reads as `Cut`, which the base code already counted, and the Set is keyed by line, so nothing is double-counted. Every existing spec gives identical results (sweep).

## Verdict
APPROVED — every AC is implemented, the hard conditions (a)–(c) hold under an independent base-vs-HEAD sweep, and dist matches a fresh build. The two recommended findings (owners crashes on a git diff failure, which is pre-existing in `check`; the detector's boundary-set blind spots, which conform to D3) are follow-up tickets, not blockers. Before qa, pm must amend two things in the spec (outside this diff, owned by pm): the AC-E322-1 wording (lowercase lane ids), and the AC-E283-5 home-dir example at spec line 84, which turns the full suite red through e234 AC16.
