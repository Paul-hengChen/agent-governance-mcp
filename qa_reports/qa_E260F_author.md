# qa_E260F_author

Author record for lane e260f (E260, comment-only trims of test/e1* and test/e2*). This is an author record, explicitly NOT a PASS: builder != judge, so an independent code review and a fresh qa verifier must judge it.

## Per-task commits
| task | commit | files |
|---|---|---|
| T-E260F-01 | 8195747 (proof script); d0971f5 (BARE_ID widened to (E\|AC\|DR\|T-) ids) | .current/e260f/proof.mjs |
| T-E260F-08 | aabb026, b30dc1e | batch 1 |
| T-E260F-09..11 | a25c968, cd64e77, bad65d1 | batch 1 |
| T-E260F-12..16 | 5ec2ffe, c88ad03, 06cd705, 5e44433, 8643475 | batch 2 |
| T-E260F-17 | 503b147 | e180, e20-e21, e213, e22, e223 |
| T-E260F-18 | f66afb5 | e23, e231, e234, e235a, e235b |
| T-E260F-19 | 46413b5 | e239, e24, e246, e248, e250 |
| T-E260F-20 | no commit | e258a, e258b, e259-brace, e259-hash, e259-limits: citation-only; the bare-id proof found no miss, so nothing was edited (the e258b AC14b pin is untouched) |
| T-E260F-21 | 0c5bddb; 60c6a5d (id-only divider lines in e22/e223/e24/e248 found by the widened check); 85bc25a (semantic fixes) | e26, e28, e259-lib (3-line header, nothing to trim) |

## Proof
`node .current/e260f/proof.mjs --base bdbffaf --list-mid` on clean committed HEAD (full, no --changed-only): scope ok; emit 54 files 0 differ; tokens 54 files 0 differ; directives 0 removed; >20: 0; 8-20: 0 block(s); bare-id: 0 (with the widened regex); form ok; paths 0; proof: PASS.

## Suite (AC11)
`node scripts/test-lock.mjs -- npm test` on clean committed HEAD 85bc25a, run twice (before and after the review fixes): tests 3043, pass 3040, fail 0, cancelled 0, skipped 3. No red test.

## Retained 8-20 blocks
None. The Retained blocks table in the rationale file stays "none yet".

## AC10
| item | before | after |
|---|---|---|
| test/e24-exemptions.test.mjs line 9 | bare-id comment line `// (E24)` | id trails plain words: "... (T-E24-03; its token budget is in test/context-budget.test.mjs). (E24)" |
| setupLane return comment in test/e246-mailbox-teardown.test.mjs | `{ repo, lane, lanePath, mailbox, ticket, branch, mailboxRoot }` (no `lane` key is returned) | `{ repo, ticket, branch, lanePath, mailboxRoot, mailbox }`, matching the helper's return statement |

## Coordinator-requested follow-ups
1. Semantic accuracy: four read-only reviewers checked every rewritten comment (all 54 changed files) and their rationale sections against the code. Fixed: e130/e164-e167 "t-ac<N>-*" case-name claim; e213 AC4/AC13 wording; e23 test-id list (AC6-2); e137-render-sanitise AC3 claim; e121 error-message overclaim; rationale corrections for e177b-mailbox-watch AC18, e148-seed-stamp helper name and importer list, e177b-lane-status AC6, e132 AC7, e118 AC5, e23 AC6, e213 AC4, e137-render-sanitise AC3. Left as is (low severity, original wording): e125a rationale shorthand labels such as AC4b-primary are not literal test names; e178a "one test per AC" (AC6 has two); e26 "AC1-AC5b" range (no AC4 test, same as the original).
2. BARE_ID widened in d0971f5; the full run found 14 id-only lines (AC/ticket section dividers in e22, e223, e24, e248), all fixed in 60c6a5d.

## Note for the verifier
Comment-only: the emit and token checks show every non-comment token unchanged against bdbffaf. Dispatch pin: sr-engineer=fable; this author ran as qa-engineer (sonnet).

## Review round 1 fixes
Review `review_reports/review_T-E260F-22.md` returned CHANGES_REQUESTED (Q1, C1 required; C2, C3 minor; P1-P3 proof gaps). Fix pass T-E260F-24..37. This section is an authoring record, not a PASS; a fresh verifier still owns the verdict.

| fix task | commit | scope |
|---|---|---|
| T-E260F-24 | 4f4dbdf | proof.mjs: P1 letter-suffixed bare ids, P2 cited-paths (every cited path must be tracked), P3 width (AC13) |
| T-E260F-25 | e00a4c3 | e106 e108 e112 e114 e115 |
| T-E260F-26 | 5fbb98d | e116 e117 e118 e120 |
| T-E260F-27 | 6e70f56 | e121 e122 |
| T-E260F-28 | 0b66710 | e123b2 e123b9 e125a e125c (C3) |
| T-E260F-29 | 89504d8 | e126 e128 x2 e130 (C2) |
| T-E260F-30 | ed50072 | e132 e137 x2 (C1) |
| T-E260F-31 | d2c9acf | e148 x2 e16 e164-e167 e166 (C1) |
| T-E260F-32 | 2a406b2 | e177a-check-cli e177a-manifest e177b x3 (C1) |
| T-E260F-33 | 4173c81 | e178a e178b x3 e18 (C1) |
| T-E260F-34 | 8e841ee | e180 e20-e21 e213 e22 e223 |
| T-E260F-35 | 25b2eb0 | e23 e231 e234 e235a e235b |
| T-E260F-36 | d64ebe6 | e239 e24 e246 e248 e250 (AC10 e246 setupLane line and the e24 line 9 fix kept) |
| T-E260F-37 | c63464c | e26 e28; e258*/e259* and e259-lib.mjs needed no edit (not wider than 100 columns; the e258b pin is untouched and 24/24 pass) |

Method: every touched comment was re-wrapped to about 90 columns (max 98), never re-joined. Headers that grew past 7 lines when re-wrapped were genuinely cut to Coded-by + at most 5 lines + the Rationale pointer; history and restated AC maps were dropped because the rationale file already holds them (a few sentences were appended there: e239, e24, e250).

Dispositions:
- Q1 (line joining defeated AC5/AC6): fixed. All 54 files re-wrapped; width max 98, median 88; the 56 formerly joined blocks were trimmed to 7 lines or fewer, none needs a Retained-blocks reason.
- C1 (seven untracked cited paths): fixed in T-29..33, each now points at a tracked archive path; the proof's cited-paths check reports 0 untracked.
- C2 (e126 wording): fixed in T-E260F-29.
- C3 (e125c "three ledgers"): fixed in T-E260F-28 ("two tasks files and a receipt").
- P1 (letter-suffixed ids), P2 (cited-paths), P3 (width): added to the proof in T-E260F-24 and now run over all files.

Final proof, `node .current/e260f/proof.mjs --base bdbffaf --list-mid` on clean committed HEAD c63464c (no --done, no --changed-only):
```
base: bdbffaf, changed: 54 file(s)
scope: ok
emit: 54 files, 0 differ
tokens: 54 files, 0 differ
directives: 0 removed
>20: 0
8-20: 0 block(s)
bare-id: 0
cited-paths: 0 untracked
width: 588 added comment lines, max 98 <=120, median 88 <=100
form: ok
paths: 0
proof: PASS
```

Suite (AC11): `node scripts/test-lock.mjs -- npm test` on clean committed HEAD c63464c: tests 3043, pass 3040, fail 0, cancelled 0, skipped 3 (exit 0). Only this record and `.current/e260f/` state were committed after that run (no test or source change). `check-md-tables` OK.

