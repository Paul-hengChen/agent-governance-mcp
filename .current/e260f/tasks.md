<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E260F-01 [P0] qa-engineer: author .current/e260f/proof.mjs (scope, emit via removeComments transpile with allowJs, AST leaf compare excl. JSDoc, directives, >20, bare-id, form, paths; flags --base/--changed-only/--list-mid), adapted from the e260d proof script; spec AC1-AC9, AC12 | depends_on: none
- [-] T-E260F-02 [P1] qa-engineer: trim comments in test/e106..e120 (9 files, weight 449: e106 e108 e112 e114 e115 e116 e117 e118 e120) per spec disposition; append rationale/retained rows | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [-] T-E260F-03 [P1] qa-engineer: trim comments in test/e121..e125c (6 files, weight 436: e121 e122 e123b2 e123b9 e125a e125c) | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [-] T-E260F-04 [P1] qa-engineer: trim comments in test/e126..e137 (7 files, weight 425: e126 e128-blocked-self-loop-repro e128-orchestrator-blocked-repair e130 e132 e137-rag-render e137-render-sanitise) | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [-] T-E260F-05 [P1] qa-engineer: trim comments in test/e148..e177b (10 files, weight 411: e148-seed-stamp.mjs e148-stamp-provenance-seed e16 e164-e167 e166 e177a-check-cli e177a-manifest e177b-lane-status e177b-mailbox-watch e177b-test-lock) | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [-] T-E260F-06 [P1] qa-engineer: trim comments in test/e178a..e223 (10 files, weight 410: e178a e178b-cut-prereview e178b-fanout-unmatched e178b-lane-watch e18 e180 e20-e21 e213 e22 e223) | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [-] T-E260F-07 [P1] qa-engineer: trim comments in test/e23..e28 (18 files, weight 410: e23 e231 e234 e235a e235b e239 e24 e246 e248 e250 e258a e258b e259-brace e259-hash e259-limits e259-lib.mjs e26 e28) plus e24-exemptions.test.mjs:9 bare-id fix and e246 setupLane comment fix (AC10) | depends_on: T-E260F-01 (voided: Re-sliced to task_size per integrator pre-review; replaced by T-E260F-08..21)
- [ ] T-E260F-08 [P1] qa-engineer: trim test comments in e106 e108 e112 e114 e115 (5 files, 208 counted lines); closes AC5-AC9 for these files | depends_on: T-E260F-01
- [ ] T-E260F-09 [P1] qa-engineer: trim test comments in e116 e117 e118 e120 (4 files, 241 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-10 [P1] qa-engineer: trim test comments in e121-tasks-file-injection e122-state-render-injection (2 files, 240 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-11 [P1] qa-engineer: trim test comments in e123b2 e123b9 e125a e125c (4 files, 196 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-12 [P1] qa-engineer: trim test comments in e126 e128-blocked-self-loop-repro e128-orchestrator-blocked-repair e130 (4 files, 229 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-13 [P1] qa-engineer: trim test comments in e132-lane-registry e137-rag-render e137-render-sanitise (3 files, 196 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-14 [P1] qa-engineer: trim test comments in e148-seed-stamp.mjs e148-stamp-provenance-seed e16 e164-e167 e166 (5 files, 222 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-15 [P1] qa-engineer: trim test comments in e177a-check-cli e177a-manifest e177b-lane-status e177b-mailbox-watch e177b-test-lock (5 files, 189 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-16 [P1] qa-engineer: trim test comments in e178a e178b-cut-prereview e178b-fanout-unmatched e178b-lane-watch e18 (5 files, 202 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-17 [P1] qa-engineer: trim test comments in e180 e20-e21 e213 e22 e223 (5 files, 208 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-18 [P1] qa-engineer: trim test comments in e23 e231 e234 e235a e235b (5 files, 141 lines); closes AC5-AC9 | depends_on: T-E260F-01
- [ ] T-E260F-19 [P1] qa-engineer: trim test comments in e239 e24 e246 e248 e250 (5 files, 178 lines); also e24-exemptions:9 bare-id fix and e246 setupLane comment fix to { repo, ticket, branch, lanePath, mailboxRoot, mailbox }; closes AC5-AC10 for these files | depends_on: T-E260F-01
- [ ] T-E260F-20 [P1] qa-engineer: citation-only sweep of e258a e258b e259-brace e259-hash e259-limits (5 files, 0 long blocks; edit only on a bare-id miss; e258b AC14b pin: longest block <=7, ratio <=30%); closes AC8, AC9 for these files | depends_on: T-E260F-01
- [ ] T-E260F-21 [P1] qa-engineer LAST authoring task: trim e259-lib.mjs (citation sweep) e26-gate-stats e28-shrink-warning (3 files, 90 lines); then full proof run (AC1-AC9, AC12) and AC11 full suite via node scripts/test-lock.mjs -- npm test on the clean committed HEAD, before the qa-engineer:Blocked write | depends_on: T-E260F-08..T-E260F-20
- [ ] T-E260F-22 [P1] code-reviewer: review the E260 e260f comment-trim diff (base-sha..HEAD, 54 test files + specs/e260f-comment-rationale.md); review target id | depends_on: T-E260F-21
- [ ] T-E260F-23 [P1] qa-engineer (fresh verifier, not the author): independent verification record for e260f after review approval; completes tasks | depends_on: T-E260F-22
