covers: T-E290-01, T-E290-02

# QA review: E290 (T-E290-01, T-E290-02) — verdict FAIL (spec hygiene defect, route to PM)

Reviewed commits: 7c01795 (T-E290-01 content), 880b99e (tests + re-pins), final HEAD recorded in the dispatch reply.
Code review: APPROVED round 1 (`review_reports/review_T-E290-01.md`, 0 required findings); AC-E290-4 relied on that review.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e290-lane-protocol-generic.txt` lists e286 AC5, e286 AC6, e329 AC-E327-2. Reds were observed by the code-reviewer round before any re-baseline edit (3 of 3 matching, per its note). Phase 0.5: clean (3/3 manifest entries confirmed red before re-pin, 0 unexplained reds); all three are now green after the AC-E290-11 re-pins.

## Phase 1 audits

- Copy Audit Gate: lane-protocol copy strings verified byte-exact by the code review (rebuild from base + spec Copy matched HEAD). No user-facing strings added by the tests.
- Visual Audit Gate: N/A (spec Visual Tokens = N/A). Phase 1.5: skipped (no Visual Baselines declared).

## Spec-to-test map

| AC | proof |
|---|---|
| AC-E290-2 | test `AC-E290-2` (eight `## ` headings, order) |
| AC-E290-3 | test `AC-E290-3` (14 absent from generic, 14 present in addendum) |
| AC-E290-5 | test `AC-E290-5` (loadConfig key, getConfigError null, schema_version 2) |
| AC-E290-7 | test `AC-E290-7` (render with this repo's config, two-layer line, no unset pointer) |
| AC-E290-8 | test `AC-E290-8` (no trimmed line >20 chars of either file in prompt) |
| AC-E290-9 | test `AC-E290-9` (no line equals a PROMPT_TEMPLATE_3B line) |
| AC-E290-11 | e286 AC5/AC6 and e329 AC-E327-2 re-pinned exactly as specified; SOP-side assertions untouched; e294 untouched and green |

New file: `test/e290-lane-protocol-generic.test.mjs` (6 tests). Phase 3 placement: creation pre-authorized by the dispatch brief. Coverage: the tests exercise docs/config only, no new source lines, so line coverage is not applicable.

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC-E290-1 | `test -f docs/lane-protocol.md && test -f docs/lane-protocol-addendum.md && echo docs/lane-protocol-addendum.md \| grep -c approval` | `0` | pass |
| AC-E290-2/3/5/7/8/9 | `node --test test/e290-lane-protocol-generic.test.mjs` | 6/6 pass | pass |
| AC-E290-4 | relied on code review (byte-exact rebuild) | APPROVED | pass |
| AC-E290-5 numstat | numstat of `.current/.config.json` vs dispatch base | `1	0	.current/.config.json` | pass |
| AC-E290-6 | `git log --diff-filter=A` on addendum, `git log -G laneProtocolAddendum` on config, both vs dispatch base | both print `7c01795` (same commit) | pass |
| AC-E290-7 CLI | `node scripts/fanout.mjs render test/fixtures/e177a/fanout-wave7.md e177a ... \| grep -c '和 docs/lane-protocol-addendum.md（本 repo 的補充規則）'` | `1` | pass |
| AC-E290-10 | `git diff --quiet <base>...HEAD -- <six files>; echo diff=$?` and `node --test` on the six files | `diff=0`; 111/111 pass (the six files plus e178a/e246/e295/e296/e177a/e289 globs) | pass |
| AC-E290-11 | `node --test` e286, e329, e294 | all green | pass |
| AC-E290-12 | diff --stat of `dist/` vs dispatch base | empty | pass |
| AC-E290-14 | `git diff <base>...HEAD \| grep -nE '^\+.*(<home>\|<home2>\|<tmp>)'` (three machine-path prefixes) | one hit: spec line 356 = the spec's own AC-E290-14 proof text quoting the pattern. No tracked test/doc/config line carries a real machine path | fail on the literal command; see defect |
| AC-E290-13 | `node scripts/test-lock.mjs -- npm test` on clean HEAD 6972e2e | 3457/3460 pass, 1 fail, 2 skipped | FAIL |

## Defect (the FAIL)

Full suite red: `test/e234-hygiene-scan.test.mjs` AC16 ("an isolated copy of committed HEAD lists zero hits"). The hygiene scan flags `specs/e290-lane-protocol-generic.md:49` (class home-path and class temp-path): the PM-authored AC-E290-14 proof line writes the three machine-path prefixes as literals inside its grep pattern, so the committed spec itself trips the scan it exists to guard. This is not a test defect and not caused by sr-engineer's docs/config work; it is a spec text defect. It is the only red; every manifest and AC-specific test is green.

Required fix (PM-owned, spec file; QA must not edit specs): rewrite the AC-E290-14 proof so the pattern does not spell a path prefix, for example by bracketing one character of each prefix inside the grep expression, and describe the three classes in prose by class name. Then re-run AC-E290-14 and the full suite on a clean HEAD (one hit on line 356 of the cumulative diff disappears with the same change).

## Escalation

Phase 4 FAIL; owner of the fix is pm (spec), not sr-engineer. Tests, re-pins and docs need no change.
