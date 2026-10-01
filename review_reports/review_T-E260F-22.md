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
