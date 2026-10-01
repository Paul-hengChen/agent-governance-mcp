# Review — T-E260F-22

covers: T-E260F-22

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Range `bdbffaf..16667ac` on `feat/e260f-test-e1-e2`. Inputs read: the diff, `specs/e260f-test-comment-trim.md`, `specs/e260f-comment-rationale.md`, `.current/e260f/proof.mjs`. I did not read the author record in `qa_reports/`, to keep the review independent (code-reviewer SOP, clean context).

## Summary
- 54 test files have comment-only edits (2487 lines deleted, about 420 added). A 203-line rationale spec, the lane spec and the proof script are added.
- Mechanical proof re-run: `node .current/e260f/proof.mjs --base bdbffaf --list-mid` prints PASS, with emit 54/0, tokens 54/0, directives 0, `>20` 0, 8-20 0, bare-id 0, form ok, paths 0. My own checks agree:
  - every removed or added line under `test/` lies wholly inside a comment or is blank, so no code line, trailing comment, string or test name changed;
  - the AC4 forbidden-path diff is 0 lines;
  - there are 53 pointers and 53 matching rationale sections (`e246` needs none), and `check-md-tables` exits 0;
  - `e258b` is untouched and its 24 tests pass.
- I sampled about 45 rewritten sentences against the code they describe. Almost all are accurate (details under Correctness).
- Two required findings:
  - **Q1**: the counted-line target was met by joining lines to 140-376 columns, not by trimming text.
  - **C1**: seven untracked paths are cited in comments this lane rewrote (AC8).
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — proof `emit: 54 files, 0 differ`. A negative control in a throwaway worktree (one string literal changed) was caught.
AC2 — implemented — proof `tokens: 54 files, 0 differ`. The same negative control was caught.
AC3 — implemented — 4 `eslint-disable-next-line` directives are unchanged (e117:31, e118:226, e120:26, e18:34). A negative control (a directive deleted against a synthetic base) was caught.
AC4 — implemented — `scope: ok`. The forbidden-list `git diff --stat` gives `0`, and the diff holds only 54 `M` lane files plus 8 owned `A` files.
AC5 — implemented (literally) — `>20: 0`. But see Q1: the result depends on very long lines.
AC6 — partial — `--list-mid` lists 0 blocks only because 56 blocks were joined into 140-376 column lines. Re-wrapped at 100 columns, every one of them is 8-15 lines, and none has a Retained-blocks reason (the table still says "none yet"). See Q1. **required**
AC7 — implemented — every file except `e246` has one pointer, each pointer names its own file, every pointer has a matching `## <path>` section, and `node scripts/check-md-tables.mjs` exits 0.
AC8 — partial — `bare-id: 0`, and no letter-suffixed id-only line exists at HEAD (independent grep). But seven untracked paths are cited in touched comments (C1). **required**
AC9 — implemented — `form: ok`. The `// Coded by` line and first line are unchanged in all 54 files (a negative control was caught), and JSDoc in e132 and e148-seed-stamp stays JSDoc. My "JSDoc count" drops in e115, e122 and e130 were false alarms: the `/**` matched was the text `content/**` inside removed prose.
AC10 — implemented — `test/e246-mailbox-teardown.test.mjs:57` reads `returns { repo, ticket, branch, lanePath, mailboxRoot, mailbox }`, which matches the `return` at :71. `grep -c 'returns { repo, lane,'` gives 0.
AC11 — deferred — the full suite is the fresh verifier's job (T-E260F-23). I ran only `test/e258b-comment-scan.test.mjs` (24/24 pass).
AC12 — implemented — `paths: 0`.

## Correctness
- **C1 (required, AC8 "a cited path must be tracked")**: these rewritten comments cite review or QA report paths that are no longer tracked; each file now lives under an `archive/` directory:
  - `test/e132-lane-registry.test.mjs:4`: `review_reports/review_T-E132-04.md`
  - `test/e164-e167-content.test.mjs:3`: `review_reports/review_T-E164-01.md`
  - `test/e164-e167-content.test.mjs:5`: `qa_reports/review_T-E164-02.md`
  - `test/e177a-check-cli.test.mjs:3`: `qa_reports/review_T-E177A-06.md`
  - `test/e178a-integrator-role.test.mjs:3`: `review_reports/review_T-E178A-01.md`
  - `test/e178b-fanout-unmatched.test.mjs:3`: `qa_reports/review_T-E178B-05.md`
  - `test/e178b-lane-watch.test.mjs:3`: `qa_reports/review_T-E178B-04.md`

  Each citation was already present at base, but the lane rewrote these lines, and AC8 covers every comment the lane touches. Fix: point each one at its tracked archive path (for example `qa_reports/archive/release-v4.0.0/review_T-E177A-06.md`; `git ls-files | grep review_T-E177A-06` finds it), or describe the report in words. The lane already did this correctly in e234 (`qa_reports/archive/release-v4.2.0/review_T-E234-05.md`). The same stale paths also appear in `specs/e260f-comment-rationale.md` (e126, e128, e130, e137, e164, e16, e177a, e178a/b sections). That file is not a comment, so fixing it is **recommended**, not required.
- **C2 (recommended)**: `test/e126-merge-invariants.test.mjs:4` says "the tool only reads via `git ls-tree` / `git cat-file`". At base the point was that `tools/merge-invariants.ts` never reads the working directory. The rewrite drops that point and claims something narrower that is not quite true: the tool also runs `merge-base` and `rev-parse`. Suggested wording: "reads committed objects only (`git ls-tree` / `git cat-file`), never the working directory".
- **C3 (optional)**: `test/e125c-index-compaction.test.mjs:4` says "frozen copies of the three ledgers". `test/fixtures/e125c-frozen/` holds two tasks files and a receipt JSON, and a receipt is not a ledger. Base said "tasks.md / _primary ledger / receipt".
- **Semantic sample, accurate**: I checked these against code or test names and found nothing wrong:
  - test-name claims ("Test names carry the AC number" / "Case names are prefixed AC<N>") in e106, e108, e114, e115 and e130;
  - e117's section list against its `Section 0`-`6` banners;
  - e116's claim that e114 calls `writeHandoffState` directly with `resetSession`/`markStateRead`;
  - e122's "sanitizeForRender is module-private";
  - e123b2's `telemetryPath`/`metricsPath` (`tools/telemetry.ts:23`, `tools/metrics.ts:30`);
  - e128-orchestrator's `T-QA-E128-01(a)` (`test/qa-flow.test.mjs:314`) and its negative-control placement;
  - e137's `renderDataBlock` (`lib/render-boundary.ts:55`) and `appendSpecContext`;
  - e148-seed-stamp's "only `test/e148-stamp-provenance-seed.test.mjs` imports SUSPECT_SEED_STAMP" (grep agrees);
  - e148's `backdateLastUpdated` reference;
  - e16's `E16-01..06`, `C1-07` and S1-S6 references;
  - e178a's duplicated-helper reason (base gave both reasons);
  - e22 I7-I9, e223, e246, e248 and e24, where the `(E24)` id-only line is now a trailing pointer after words.
- **Integrator's three known wording items**: all are acceptable as pre-existing.
  - e125a's `AC4b-primary` labels appear only in the rationale spec, as a shorthand map, not in a test comment.
  - e178a's "one test per AC" is base wording (base: "each spec acceptance criterion has one test named after it"). AC6 also has a second "(historical)" test.
  - e26's "AC1-AC5b": the premise that there is no AC4 test is wrong. `test/e26-gate-stats.test.mjs` has `test("AC4…` (AC1, AC2, AC3, AC4, AC5 and AC5b each have one), so the range is accurate.
- **Expected-red (step 4a)**: the diff touches test files, but no test is intentionally red (the change is comment-only and emit-identical). No `qa_reports/expected-red_e260f.txt` exists, and none is needed.

## Quality
- **Q1 (required, convention drift, and it defeats the AC5/AC6 threshold)**: rewritten comment lines are much wider than the rest of the repo.

  | lines measured | median | p90 | max |
  |---|---:|---:|---:|
  | 421 lines added in this lane | 141 | 212 | 376 |
  | comment lines across `test/*.mjs` (15,861) | 76 | 87 | — |
  | E260 wave-1 merges (`045186e`, `5bb69bb`, `7b8f8d6`, `b8fd823`) | 75-77 | 78-84 | 159 |
  | sibling lane e260e | 94 | 105 | 157 |

  `analyzeText` counts lines, so joining lines lowers the counted size without cutting text. 56 blocks reach "≤7 counted" only this way. Re-wrapped at 100 columns they are 8-15 lines. Examples:
  - `test/e239-init-subdir-exclude.test.mjs:1`: 5 counted, 13 at 100 columns, longest line 376
  - `test/e213-shipped-ignored-shape.test.mjs:1`: 6 → 15, longest 334
  - `test/e250-eject-path-escape.test.mjs:1`: 6 → 14, longest 318
  - `test/e235a-relative-prd-path.test.mjs:1`: 5 → 12, longest 315

  Line width grows with batch order: the T-E260F-08 files are about 100-120 columns, the T-E260F-17..21 files 250-376. The human approved a line-count threshold, and the `agc check` counter that future readers rely on would understate these blocks. Fix: re-wrap every touched comment to the surrounding width (about 80-100 columns, nothing over 120), then re-run `--list-mid`. Trim any block that lands at 8-20 lines, or give it a one-line reason in the Retained-blocks table, which I copy into this report per AC6. The text itself is already much shorter than base (2487 lines removed), so this is mostly wrapping plus small further cuts. Separately, the 90 KB rationale spec is acceptable as a tracked spec.
- **Q2 (optional)**: `test/e117-void-task.test.mjs:256`. Section 3 lost its `// ====` banner, while Sections 0-2 and 4-6 keep theirs.
- **Proof script (focus 2), P1 (recommended)**: `BARE_ID_ID` matches `(?:E|AC|DR|T-)[\w-]*\d`, which requires the id to end in a digit. So `// E177b`, `// (AC4b)` and `// (E233e)` slip through. The negative control confirmed it: 3 lines appended, 1 flagged. Fix: `(?:E|AC|DR|T-)[\w-]*\d[\w-]*`. No such line exists at HEAD (independent grep over all 60 lane files), so this is not a live miss.
- **P2 (recommended)**: the proof does not check AC8's second half ("cited path must be tracked"). A `git ls-files --error-unmatch` pass over path-shaped tokens in added comment lines would have caught C1.
- **P3 (recommended)**: the proof has no line-width check. A limit such as "no added comment line over 120 columns" would have caught Q1.
- The other checks are not vacuous. emit, tokens, directives, form (the Coded by and first-line checks) and scope each caught a seeded fault in my throwaway-worktree control. `paths` builds its pattern at run time and scans the owned evidence files.

## Architecture
No architecture spec (comment-only lane, no architect hop). The rationale moves to a tracked spec with one pointer per file, as AC7 asks. No layering change.

## Security
No findings. No code, string or test name changed: every changed line is a whole comment line, and emit and token output are identical to base. No absolute local path was found (`paths: 0`). The added `HOME_PATH` regex is assembled from parts, as AC12 requires.

## Performance
No findings. Only comments changed, so runtime behaviour is unchanged. The proof script runs once per invocation and spawns one `git show` per file. That is fine for 60 files.

## Verdict
CHANGES_REQUESTED: two required findings remain. Q1: the 7-line target was met by joining lines to as much as 376 columns, so re-wrap to repo width and then trim or justify the resulting 8-20 line blocks (AC6). C1: seven untracked review or QA report paths are cited in rewritten comments (AC8). Everything else is behaviour-neutral and accurate in the sample. Recommended alongside: C2 wording, and proof fixes P1 (letter-suffixed bare ids), P2 (tracked-path check) and P3 (width check).

## Round 2 — APPROVED — by code-reviewer

Range `bdbffaf..b97f73e` (round-1 fixes `4f4dbdf..c63464c`, T-E260F-24..37). Same clean-context inputs as round 1: the diff, `specs/e260f-test-comment-trim.md` (now with AC13 and the extended AC8), `specs/e260f-comment-rationale.md` and `.current/e260f/proof.mjs`. I did not read `qa_reports/`.

### Summary
- Proof re-run, `node .current/e260f/proof.mjs --base bdbffaf --list-mid`: PASS. emit 54/0, tokens 54/0, directives 0, `>20` 0, 8-20 0, bare-id 0, cited-paths 0 untracked, width 588 lines (max 98, median 88), form ok, paths 0.
- All four round-1 findings are resolved. I measured each one myself with scratch scripts, not with the proof script:
  - Q1: widths are now normal.
  - C1: all seven citations point at tracked archive paths.
  - C2 and C3: the wording is accurate.
- Proof fixes P1, P2 and P3 work. My negative control made all three checks fail.
- No regression in scope, the comment-only property, AC10, e24:9 or e258b AC14b.
- Two new findings, both recommended and neither blocking. Both are factual slips in the second rewrite (R2-1 and R2-2 below).
- Process deviation by me (see the last section): my negative control used `git stash drop`, which deleted my uncommitted entry write. Nothing in `test/` or in this report was lost.

### AC Completeness (changes since round 1)
AC1-AC4 — implemented — proof lines above. The forbidden-path `git diff --stat` count is 0. The name-status is 54 `M` lane files plus 9 owned `A` files.
AC5 — implemented — `>20: 0`. Over all 60 lane files, the `analyzeText` block-size counts are {1:339, 2:154, 3:400, 4:126, 5:97, 6:40, 7:74}. The largest block is 7 lines.
AC6 — implemented — `--list-mid` shows 0 blocks of 8-20 lines. The 7-line results now come from cut text, not joined lines (see Q1), so the empty Retained-blocks table needs no rows.
AC7 — implemented — 53 files carry a pointer, and there are 53 matching `## test/...` sections. `check-md-tables` exits 0. e121 has two pointers, one per trimmed block (:7 and :273). That was already true in round 1, and AC7 is per block, so it is fine. My round-1 note "one pointer per file" was slightly wrong.
AC8 — implemented — bare-id 0 and cited-paths 0. In a separate scan of every path-like token in added comment lines, the only untracked paths are runtime fixtures such as `.current/exemptions.json`, `.current/telemetry.jsonl` and `.current/archive/`, not citations.
AC9 — implemented — `form: ok`.
AC10 — implemented — `test/e246-mailbox-teardown.test.mjs:57` reads `returns { repo, ticket, branch, lanePath, mailboxRoot, mailbox }` and matches the `return` at :71. `grep -c 'returns { repo, lane,'` gives 0. The text is unchanged since round 1.
AC11 — deferred to the fresh verifier (T-E260F-23).
AC12 — implemented — `paths: 0`.
AC13 — implemented — see Q1.

### Correctness
- **C1, resolved**: the citations now read as follows. Each path is tracked, and no untracked review or QA report path is left in an added comment line.
  - `test/e132-lane-registry.test.mjs:6`: `review_reports/archive/e115-join-precondition-check/review_T-E132-04.md`
  - `test/e164-e167-content.test.mjs:4`: `review_reports/archive/e164-e167-content-wave45/review_T-E164-01.md`
  - `test/e164-e167-content.test.mjs:6`: `qa_reports/archive/e164-e167-content-wave45/review_T-E164-02.md`
  - `test/e177a-check-cli.test.mjs:5`: `qa_reports/archive/release-v4.0.0/…T-E177A-06.md`
  - `test/e178a-integrator-role.test.mjs:4`: `review_reports/archive/release-v4.0.0/…T-E178A-01.md`
  - `test/e178b-fanout-unmatched.test.mjs:5`: `qa_reports/archive/release-v4.0.0/…T-E178B-05.md`
  - `test/e178b-lane-watch.test.mjs:5`: `qa_reports/archive/release-v4.0.0/…T-E178B-04.md`

  The stale report paths in the rationale spec were also re-pointed to archive paths. One stale path is left there, in the e125c section: `.current/e125c/compaction-procedure.md`. It is now `.current/history/2026-09/e125c/compaction-procedure.md`. This is optional, because the file is not a comment.
- **C2, resolved**: `test/e126-merge-invariants.test.mjs:4-5` now reads "reads committed objects only (never the working directory), via git ls-tree / cat-file / merge-base / rev-parse". That matches `tools/merge-invariants.ts:194,204,526,552`. Optional nit: the tool also runs `rev-list` (:538), so the list is not quite complete.
- **C3, resolved**: `test/e125c-index-compaction.test.mjs:4` reads "two tasks files and a receipt", which matches `test/fixtures/e125c-frozen/` (`primary-tasks.md`, `root-tasks.md`, `tasks-index-receipt.json`).
- **Semantic re-sample**: the second re-wrap rewrote 544 comment and rationale lines, so I checked about 22 of them against the code again.
  - **14 test-header blocks**:
    - e239: the e243 spec and T-E243-04 exist, and there are 18 AC15-AC20 hits.
    - e213: the helpers match e180's (`mkTmp`, `makePrimaryRepo`, `runAgc`).
    - e250: the win32 skip is at :134, and the `HOME` temp dir is at :85-90.
    - e235a: DR-2 and DR-3 say drop to absent, with no echo.
    - e22: `staleDispatchNotifyFile` is at `tools/config.ts:65`, and `notify.error` is at :423.
    - e180: `after(` is at :30.
    - e117: `SqliteHandoffStorage.voidTask`, and the e120 matrix exists.
    - e121: the forged-row discriminators.
    - e132: `tools/handoff-parse.ts` wiring and `test/feature-rollup.test.mjs`.
    - e177b-mailbox-watch: AC16/AC20 use a fake clock, and AC17 spawns real processes.
    - e18: the STAMP, QAEV and CONTENT ids, the backlog E18 section and the e32-e33 file.
    - e28: ids W, S/F, J and P1a/P1b match the test names.
    - e126 and e125c: as above.
  - **8 rationale lines**:
    - e121: the not-found `doesNotMatch` at :124/:142/:160.
    - e132: git shims, plus `mock.method` cannot reach ESM (:394).
    - e137: the hook marker (`bin/agent-governance-context.mjs:255`).
    - e137-rag: the persuasion residue matches the e137 spec at :149/:174.
    - e177b-lane-status: `git log` (:608) and `git status --porcelain` (:618).
    - e250: commit 8437af1 (base wording).
    - e24: wrong, see R2-1.
    - e126 and e130: archive paths.
- **R2-1 (recommended, new this round)**: `specs/e260f-comment-rationale.md:195` (e24 section) says "Never-throw and both envelope paths were confirmed in review T-E24-01 (the review report is no longer tracked at its old path)". That is false: `git ls-files --error-unmatch review_reports/review_T-E24-01.md` succeeds, and the file has been tracked since 48fb9fe. A second copy sits at `qa_reports/archive/e24-exemptions-manifest/review_T-E24-01.md`. Base cited the tracked path. Round 1 (16667ac) did not have this sentence, so the round-1 fixes added it. Fix: "...confirmed in `review_reports/review_T-E24-01.md`." This is not required: it is a spec line, not a test comment, and the e24 rationale itself is intact.
- **R2-2 (recommended, carried over from base)**: `test/e22-stale-notify.test.mjs:3` says `notifyStaleDispatch` is "wired by tools/handoff.ts". The call is in `tools/handoff-parse.ts:734`; `tools/handoff.ts` is the re-export file. Base had the same claim and the lane rewrote the line. Optional extra: the "Test ids" list on :6 leaves out E29a and E29b (:500, :523).

### Quality
- **Q1, resolved**: I measured the width from `git diff -U0 bdbffaf HEAD -- test/` myself, without the proof script.

  | measure | value |
  |---|---|
  | added comment lines | 588 |
  | width median / p90 / max | 88 / 92 / 98 |
  | lines over 100 columns | 0 |
  | added blank lines | 0, so no block was split by inserting blank lines |
  | added non-comment lines | 0 |

  At HEAD, 31 comment lines in lane files are wider than 100 columns. All 31 are unchanged base lines; the longest is a 164-column JSDoc line in e177a, e235b and e248. AC13 covers only added or rewritten lines, so these are out of scope.

  The text was cut, not re-joined. Total trimmed comment text, counted in characters:

  | version | characters |
  |---|---|
  | base | 371,253 |
  | round 1 | 267,465 |
  | HEAD | 254,855 |

  So the round-1 fixes removed about 12.6K more characters, and at about 88 columns the lines can no longer hide length. Example: the e239 header was 5 counted lines with one 376-column line; it is now 6 lines, the longest 91 columns.
- **P1, works**: with `// (E177b)` and `// (AC4b)` planted, `bare-id: 2`, and both lines were flagged.
- **P2, works**: with a planted `review_reports/review_T-NOPE-99.md` citation, `cited-paths: 1 untracked`. Limitation (optional): `PATH_TOKEN` has no `.current/`, `bin/` or `schema/` prefix, so a stale `.current/...` citation in a comment would get past it.
- **P3, works**: with a planted 133-column comment line, `width: … max 133 >120`. Overall result: `proof: FAIL (bare-id, cited-paths, width)`. The checks read the working tree (`readFileSync` plus `git diff <base> -- f`), so an uncommitted edit is seen.
- Round-1 Q2 (the missing Section 3 banner in e117) is optional and was not revisited.

### Architecture
No change since round 1. No architecture spec exists. The rationale still lives in the tracked spec, with pointers back to it.

### Security
No findings. Only comment lines were added: 0 added code lines and 0 removed code lines. `paths: 0`.

### Performance
No findings. The proof script added one `git ls-files` call and one `git diff -U0` per changed file. It runs only on demand.

### Process deviation (reviewer, this round)
I ran a git operation that Constitution §6 does not sanction. For the P1-P3 negative control, I planted lines in `test/e126-merge-invariants.test.mjs`, ran the proof, then ran `git stash` followed by `git stash drop`. §6 sanctions only `git stash` and `git stash pop`. `git stash drop` throws away the stashed state for good. The stash also held my uncommitted entry write (code-reviewer In_Progress, hop 8) in `.current/e260f/handoff.md` and its `dispatch.jsonl` line, so the drop destroyed a governance write and put the on-disk state back to pm In_Progress, hop 7 (b97f73e). The dropped stash is unreachable commit `a0f1d0d`; it was not hand-applied. After the coordinator flagged it, I re-issued the entry write (pm In_Progress to code-reviewer In_Progress, `resume_of: code-reviewer`). Nothing in `test/` or in this report was lost, and the tree was clean after the drop: `git status --short` showed 0 lines, and the proof PASSed again. Future controls go in a scratch copy outside the worktree; never use stash with uncommitted governance state.

### Verdict
APPROVED: Q1, C1, C2 and C3 are resolved and independently measured. The new P1-P3 proof checks catch a planted fault. No regression in scope, behaviour neutrality, AC10, e24:9 or e258b. R2-1 (a false "no longer tracked" sentence in the e24 rationale section) and R2-2 (the e22 `handoff.ts` pointer) are recommended one-line fixes that do not block.
