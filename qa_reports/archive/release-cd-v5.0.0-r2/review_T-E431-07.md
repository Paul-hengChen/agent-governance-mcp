# QA review — T-E431-07 scenario tests (qa session 2 of 3)

Test file: `test/e431-test-first-server-path.test.mjs` (commit 2b8e43d). One new test file; no source, content, golden, budget or other test file touched. 33 tests: one or more per AC1-AC18 (titles start with the AC id) plus the overlay-doc mirror check (blueprint OQ9, title `OVERLAY:`).

## Spec-to-test map
| AC | tests | what it pins |
|---|---|---|
| AC1 | 1 | marked pm -> qa (marker on entry write, no resume_of) then qa -> sr accepted; marker persisted and carried |
| AC2 | 1 | architect -> qa accepted; pm/architect -> sr rejected TRANSITION_REJECTED, state untouched |
| AC3 | 2 | marked code-reviewer PASS: transition layer null (unmarked: TRANSITION_REJECTED); real handler write with ledger completed by code-reviewer via tw_complete_task, completed_tasks [] -> PASS persisted, last_agent code-reviewer |
| AC4 | 1 | qa-engineer PASS rejected from qa and from code-reviewer In_Progress; no state written |
| AC5 | 1 | code-reviewer FAIL (review_round 1) -> qa accepted; qa -> code-reviewer TRANSITION_REJECTED; qa -> sr -> code-reviewer accepted |
| AC6 | 1 | sr_return_count 1, 2 via real writes, review_round unchanged; third return SR_RETURN_CAP_EXCEEDED, allowed exactly [pm:In_Progress], hint Copy verbatim; pm resets; sr -> code-reviewer at count 2 not blocked |
| AC7 | 1 | four code-reviewer rejections (two routed to qa, two to sr) -> review_round 4; next qa/sr write REVIEW_ROUND_EXCEEDED; pm accepted |
| AC8 | 5 | CUT_APPROVAL_REQUIRED; resume_of does NOT exempt on a marked feature (OQ1 = a); EXTERNAL_REFS_UNRESOLVED; SCOPE_DECISION_REQUIRED; SOURCE_CREDIBILITY_UNVERIFIED; unmarked resume_of hand-back stays exempt |
| AC9 | 2 | hint names `resume_of: "qa-engineer"`, `chain_path: "test-first"` and the hint.pm_to_qa Copy verbatim; resume_of alone accepted; marked later pm -> qa needs no resume_of |
| AC10 | 2 | marker survives omitting writes, dropped on active_feature change; marker mid-old-path rejected TRANSITION_REJECTED, no state written |
| AC11 | 2 | all four code-reviewer:PASS exits accepted when marked; unmarked code-reviewer PASS rejected |
| AC12 | 4 | old chain, architect variant, qa FAIL -> sr loop, bugfix + Amend-Resume: outcomes/counters, no chain_path / sr_return_count; every new edge closed unmarked |
| AC13 | 1 | marked bugfix sr -> code-reviewer REPRO_MANIFEST_MISSING, accepted with manifest, later PASS passes the transition check |
| AC14 | 2 | tw_complete_task judge per marker, msg.complete_task_judge verbatim, unmarked today's text |
| AC15 | 2 | the four write-path checks marked vs unmarked (REVIEWER/NON_QA completed_tasks, APPROVED PASS, FAIL ledger removal) |
| AC16 | 1 | v15 file migrates, no fields seeded; next write stamps schema 16; CURRENT_VERSIONS handoff 16 / sqlite 2 |
| AC17 | 2 | 35 entries and SR_RETURN_CAP_EXCEEDED shape, `(none)` mapping row, pipeline 17 steps in order, HOP_CAP 14, comment fixed; hop cap outranks sr-return cap |
| AC18 | 1 | SQLite: marker ignored, pm -> qa and code-reviewer PASS rejected as today, marker not persisted (ran, not skipped) |
| overlay | 1 | `specs/qa-flow-enforcement-architecture.md` opened/closed tables equal exported TEST_FIRST_OVERLAY |

Not asserted against a base-commit server replay: AC12 compares old-path outcomes to the fixed old-chain semantics (accept/reject, codes, counters, absence of new fields), not to a checked-out base build.

## Observation for pm / integrator (not a FAIL, not in any AC)
A write opening a NEW feature from a marked feature sitting at `code-reviewer:PASS` (pm, different active_feature) is evaluated unmarked (prev_chain_path is dropped on feature change by design, architecture line 167) and `code-reviewer:PASS` has no matrix key, so it is rejected `TRANSITION_REJECTED` ("No edge code-reviewer:PASS -> pm:In_Progress"). Same-feature exits (AC11) and exits via release-engineer are fine. No AC requires the cross-feature case; recorded so E432/E433 wiring (coordinator opening the next feature straight from a judge PASS) knows to route via release-engineer or a same-feature pm write first. The AC10 feature-change assertion therefore uses pm -> pm.

## AC Execution Log
Command per AC: `node --test test/e431-*.test.mjs --test-name-pattern "ACn:"` (after the build in 68e7f0e / HEAD dist). Each exited 0, `# fail 0`.

| AC | exit | result |
|---|---|---|
| AC1 | 0 | pass |
| AC2 | 0 | pass |
| AC3 | 0 | pass |
| AC4 | 0 | pass |
| AC5 | 0 | pass |
| AC6 | 0 | pass |
| AC7 | 0 | pass |
| AC8 | 0 | pass |
| AC9 | 0 | pass |
| AC10 | 0 | pass |
| AC11 | 0 | pass |
| AC12 | 0 | pass |
| AC13 | 0 | pass |
| AC14 | 0 | pass |
| AC15 | 0 | pass |
| AC16 | 0 | pass |
| AC17 | 0 | pass |
| AC18 | 0 | pass |

AC19 / AC20 proofs run in T-E431-11 (final verification); not run here.

## Full suite
`node scripts/test-lock.mjs -- npm test`: 4424 tests, 4420 pass, 2 fail, 2 skipped. The two reds are the cross-lane tests named in the manifest and not touched: `test/e295-hop-cap-and-sop-halves.test.mjs` AC11 and `test/visual-evidence-gate.test.mjs` AC-4 (e423-owned). 0 unexplained reds; the new file adds 33 passing tests (4391 -> 4424).

Phase 0.5: expected-red diff recorded in review_T-E431-08.md and unchanged. Phase 1.5: skipped (no Visual Baselines declared). No PASS this session.
