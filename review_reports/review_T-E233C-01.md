# Review — T-E233C-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Comment-only pass over 57 of the 60 owned test files (831 insertions / 761 deletions in `test/`): comments that explained themselves only through a backlog, task or finding id are rewritten into plain words, and the id moves to the end as a pointer.
- Mechanical checks pass. AC1 comment-stripped comparison: 57 files, `bad=0`. AC2 scope: clean. AC5 hygiene: clean. AC7 coupling: comments only in `compose-equivalence.test.mjs`, and the e90 reader passes.
- Readability (AC3) is good across the whole diff. I read every hunk (57 files, well over 200 hunks) and checked the rewritten descriptions against the code beside them. Almost all are accurate and read without the backlog.
- Three required defects block approval: one duplicated comment line, 20 comment lines given the wrong indent in 5 files, and one rewrite that misstates what a fix covered.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — the spec's TypeScript `transpileModule` (`removeComments`) comparison over every changed `test/*.mjs` against 6c61864 printed `files=57 bad=0` and exited 0.
AC2 — implemented — the spec's `grep -vE` filter over `git diff --name-only 6c61864..HEAD` printed nothing. The paths outside `test/` are only `specs/e233c-test-comments-a.md`, `qa_reports/e233c-E233C-01-author-notes.md` and `.current/e233c/{dispatch.jsonl,handoff.md,tasks.md}`.
AC3 — partial — the rewrites read well and are accurate overall, but three required findings remain (see Correctness and Quality): test/e18-write-provenance.test.mjs:47-48, the misindented lines, and test/check-md-tables.test.mjs:434-436.
AC4 — implemented (advisory) — the heuristic flags about 40 added lines. I checked each one: all are the second or later line of a multi-line comment block (for example "stated convention", "on disk", "never by hand"), or a line holding only a path. None is a block whose only explanation is an id.
AC5 — implemented — added lines of the test diff were grepped for a home-directory absolute-path prefix (both macOS and Linux forms, pattern built at run time by a temp-dir script), the username, `~/`, http(s) URLs, `git show` and `git log`. No matches (grep exit 1).
AC6 — not judged here (verifier hop, post-commit full suite).
AC7 — implemented — only comment lines change in `test/compose-equivalence.test.mjs`. `test/e90-golden-capture-completeness.test.mjs` pulls filenames out of the `const BUILD_MODES = [...]` code literal, not out of comments. `grep -nE 'readFileSync\(.*test.*\.mjs' test/*.mjs` finds only the two expected reads of non-owned files. `node --test` on e90, compose-equivalence, e18, check-md-tables, dispatch-pins, e126 and e137-render-sanitise: 137/137 pass.

## Correctness
- **required** — test/e18-write-provenance.test.mjs:47-48. The rewritten amendment paragraph repeats the same phrase on two lines: line 47 ends "edge was byte-identical to the sanctioned write. QAEV-4a/b replace the old" and line 48 repeats "byte-identical to the sanctioned write. QAEV-4a/b replace the old" before "single QAEV-4 exemption test…". The original line 48 was never removed after its text was folded into line 47. Fix: delete line 48. An adjacent-line overlap scan of all 57 changed files found no other case.
- **required** — test/check-md-tables.test.mjs:434-436. The new text "Fix for three table shapes, (a) (b) (c), that the checker used to misdiagnose" misstates what the fix covered. (a), (b) and (c) are the three possible causes of a "no-delimiter" report: blank-split, missing-delimiter and mis-sized-delimiter (see MSG-A/B/C at :700ff). The fix stops (b) and (c) being wrongly reported as (a) when the two tables' header cell counts differ (E105-B/E105-C). Cause (a) was never misdiagnosed: E105-CONTINUATION at :501 is regression protection proving it still classifies as blank-split. The next sentence, "This shape occurs 0 times", now also has nothing singular to refer to. Suggested wording: "Fix for how the checker tells the three no-delimiter causes apart — (a) blank-split, (b) missing delimiter, (c) mis-sized delimiter: adjacent tables with different header cell counts used to be reported as (a) … (E105-* tests; …)". Keep the rewrap within the file's usual width.
- **recommended** — test/e115-join-precondition.test.mjs:2-3. The header now calls tools/join-precondition.ts "the check that a lane's declared identity matches its actual one at join time". The module has two checks, lane-branch ancestry (`checkLaneAncestry`, AC1/AC2) and declared-vs-actual identity (`checkDeclaredVsActualLaneIdentity`, AC3/AC4/AC9), and the header describes only the second. Suggest "the join-time precondition check: the lane branch is merged, and the lane's declared identity matches its actual one".
- Accuracy spot-checks that passed, with the code read beside each: the e116 AC5 233-char / ENAMETOOLONG description (:28, :298 vs :322-328); the compose-equivalence "literal concatenation, no normalization" (:15 vs :24, :99); the e126 header's "no ledger row, done-mark or sidecar record was lost" (vs tools/merge-invariants.ts AC1-AC3); the e177a-check-cli AC9-AC15 map (vs the exit codes and disclaimer regexes at :116-321); the e177a-manifest AC1-AC14 section headers (vs the assertions, including the AC14 absent/duplicate/unknown/empty codes); the e178b-cut-prereview AC10-AC14 map (vs the AC12 states n/a / not-checked / no-mailbox and the AC13 exit 0); the e178b-lane-watch AC4 "exit 3" and AC7 "no git" (vs :558 and the fake-git trap); the e178b-fanout AC16-AC19; e180 AC13 (vs the pointer fallback assertion); the e123b9 header's AC list; the e130 E198(b) "release-staging fix" (vs specs/e130-lane-default.md:3); the e16 and e128 headers; dispatch-log; e164; e166; e18's two gates (STAMP-* / QAEV-*).
- Expected-red sampling (SOP 4a): N/A. This is a comment-only diff, AC1 proves no behaviour change, and no intentionally red tests exist.

## Quality
- **required** — the rewrites left 20 comment lines indented deeper than the code they describe. At base, none of these comments were over-indented. They follow a 2-space code line but now sit at 4 spaces (or 12 instead of 6):
  - test/dispatch-pins.test.mjs:778-779, 817-818
  - test/e106-init-artifacts-flag.test.mjs:153-155
  - test/e108-eject.test.mjs:229-230, 352, 396
  - test/e126-merge-invariants.test.mjs:366, 550-552
  - test/e137-render-sanitise.test.mjs:343-344, 366-368

  Fix: restore the indent to match the next code line. A per-file script comparing comment indent with the following code line, at HEAD and at base, found these 5 files and no others.
- **recommended** — unexplained design-decision codes were missed in one of three copies of the same comment block. test/e117-void-task.test.mjs:102 still reads "IS the D-D "index" shape" and :110 "spec D-F/AC9". The sibling copies of this block were rewritten ("the root "index" shape" in e120, "the workspace-"index" shape" in e121). The block's lead token is also handled inconsistently: e120 rewrote it to "Lane-local-ledger re-baseline (e125a, …)", but e117:99 and e121:95 still open with the slug "e125a-lane-local-ledgers re-baseline". Suggest making all three copies match.
- **recommended** — new comment lines longer than 120 columns, against wrapping near 80-100 elsewhere in these files: ac-execution:30 (122), compose-equivalence:15 (131), drift-skew:37 (135), e121-tasks-file-injection:32 (137), e122-state-render-injection:184 (139), e128-blocked-self-loop-repro:3 (121), e130-lane-default:40 (121, the author-flagged spot at :37-41), and e178b-cut-prereview:29 (133). Rewrap.
- **optional** — test/e16-judge-dispatch-charter.test.mjs:129 "The content/coord-03-core-fallback.md's … row" and the doubled ") (E16-06)." at :132. :2-3 says "charter broadening (…): broadening the …". Both read awkwardly.
- **optional** — test/e125c-index-compaction.test.mjs:13-14: "(E204:" followed by a capitalised "The prior live-disk read…" is a leftover from moving the id. Suggest "(the prior live-disk read … drifted red …; E204, T-E204-01)".
- **optional** — test/e121-tasks-file-injection.test.mjs:7-8 (author-flagged): the trailing "E121, docs/backlog.md order 0t." sentence is fine as a pointer and meets the trailing-id rule. No change needed.
- Unchanged id-bearing comments found by a case-insensitive scan of all 60 owned files (lead-token shapes such as `e123b9 J2 (spec AC5):`, `DR-3:`, `F1 —`, `T-E100-01 (a)`, `E57 AC1/AC2 (…)`) all still carry a plain-word explanation on the same line or in the same block. Examples: e116:430-440, cut-approval-gate:670-682, 806, 864, agc-adapters:468-472, dependency-overrides:10. The only miss is e117's "D-D" (above).

## Architecture
No architecture spec exists for this feature. No layering change: comments only, as AC1 proves.

## Security
No findings. The AC5 scan of added lines found no home-directory path, username, URL, design-tool key or history-reading git subcommand. The new text does not name any secret or internal codename.

## Performance
No findings. The change is comments only, with no runtime effect (AC1).

## Verdict
CHANGES_REQUESTED — the pass is accurate and readable almost everywhere, but a duplicated comment line (e18:48), 20 misindented comment lines in 5 files, and a rewrite that misstates the E105 fix's scope (check-md-tables:434-436) must be fixed first. Each is a small, mechanical fix.

## Round 2 — APPROVED — by code-reviewer

## Summary
- Fix round 5cc2bc2 (test comments, 18 files) plus 3f1dedd (state and author notes). I read every test hunk in 679d4a3..HEAD.
- All three required findings and all three recommended findings from round 1 are resolved. The two optional items (e16:129-132 grammar, e125c:13-14 capitalisation) were left as they are, which is acceptable.
- The fix round introduced no new defects. Re-scans for indentation against base, adjacent duplicated lines, and new comment lines over 120 columns all came back empty across every changed file.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — comment-stripped comparison over 6c61864..HEAD: `files=57 bad=0`, exit 0.
AC2 — implemented — the spec's scope filter over `git diff --name-only 6c61864..HEAD` prints nothing.
AC3 — implemented — the round-1 findings are resolved (see Correctness and Quality). The fix hunks are accurate to the code beside them.
AC4 — implemented (advisory) — no new bare-id comment blocks. The fix round only re-wraps, re-indents or rewords existing plain-word text.
AC5 — implemented — re-scan of the added lines over 6c61864..HEAD (same run-time-assembled pattern class as round 1) found no matches.
AC6 — not judged here (verifier hop).
AC7 — implemented — compose-equivalence changed only by re-wrapping comment line 15, which is covered by AC1 = 0.

## Correctness
- Round-1 required (e18 duplicate) — resolved. test/e18-write-provenance.test.mjs:47 is now followed directly by "single QAEV-4 exemption test…"; the duplicated line is gone.
- Round-1 required (check-md-tables:434-436 scope) — resolved. It now reads: "Fix for how the checker tells the three no-delimiter causes apart: (a) blank-split, (b) missing delimiter, (c) mis-sized delimiter. Adjacent tables whose header cell counts differ used to be reported as (a) even when the cause was (b) or (c)". This matches E105-B/E105-C, which require (b)/(c) to be reported, never blank-split, and E105-CONTINUATION, which keeps (a) as blank-split. The unclear "This shape" became "Two adjacent tables with different header cell counts occur 0 times in this repo", which reads on its own.
- Round-1 recommended (e115 header) — resolved. test/e115-join-precondition.test.mjs:2-4 now names both checks: branch merged (ancestry) and declared-vs-actual identity.
- No new accuracy issues in the fix hunks.

## Quality
- Round-1 required (indentation) — resolved. All 20 lines were re-indented to match the next code line: dispatch-pins:778-779/817-818, e106:153-155, e108:229-230/352/396, e126:366/550-552, e137-render-sanitise:343-344/366-368. The indent-vs-base scan now reports no file.
- Round-1 recommended ("D-D"/"D-F" and slug lead) — resolved. e117:99/102/110, e120:98 and e121:95/105 now say "Lane-local-ledger re-baseline (e125a, …)", "the root "index" shape" and "spec AC9". The three copies of the block now match.
- Round-1 recommended (lines over 120 columns) — resolved. All 8 lines were rewrapped (ac-execution:30-31, compose-equivalence:15-16, drift-skew:37-39, e121:32-34, e122:183-185, e128-blocked-self-loop-repro:3-4, e130:40-42, e178b-cut-prereview:29-30). The long-line scan now reports none.
- **optional**, cosmetic, non-blocking — a few rewrapped blocks have uneven line lengths (e.g. e121:34 and e130:42 are long compared with their neighbours, though still under 120). Not worth another hop.

## Architecture
No change. Comments only.

## Security
No findings. The AC5 re-scan is clean.

## Performance
No findings. Comments only.

## Verdict
APPROVED — every round-1 required and recommended finding is fixed, the mechanical checks (AC1 bad=0, AC2, AC5) pass, and the fix round added no new defects.
