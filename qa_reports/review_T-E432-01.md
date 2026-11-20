# QA review — E432 judge-report checks

covers: T-E432-01, T-E432-02, T-E432-03, T-E432-04, T-E432-05, T-E432-06, T-E432-07

Feature `e432-judge-report-checks`, lane e432. Judge of record: qa-engineer (old chain; code-reviewer APPROVED T-E432-01..04 in `review_reports/review_T-E432-01.md`, commit b018028). One report covers the whole round.

## Phase 1 — Review

- Copy audit (spec Copy / Strings): `msg.qa_to_sr_manifest` is verbatim in `tools/handoff-orchestrator.ts:650-654` (manifest path then no-new-test record path, no `hintStatic`); `file.no_new_test` = `qa_reports/no-new-test_<feature>.txt` (`gates/expected-red.ts:43`); `msg.release_judge` produced by `releaseJudge` in `scripts/release.mjs`. No user-facing string outside the spec.
- Visual Audit / Visual Baselines: N/A (spec Visual Tokens and Visual Widgets are N/A; no design file). Phase 1.5: skipped (no Visual Baselines declared).
- Scope: QA judged only tests, AC coverage and test infrastructure; no style or architecture finding raised.

## Phase 3 — Tests and AC to test map

Test-file placement: the dispatch brief's `Test-file placement` line pre-authorised `test/e432-judge-report-checks.test.mjs` and the e431 re-pin; both acted on.

New file `test/e432-judge-report-checks.test.mjs` (30 tests, commit fe8df15, T-E432-05). Every test hits the public surface (`TOOL_REGISTRY` entries `tw_update_state` / `tw_add_task`, `detectDrift`, `checkLaneEvidence`, `scripts/release.mjs main`, `commitMessage`) in temp workspaces under `os.tmpdir()`.

| AC | test(s) |
|---|---|
| AC1 | marked code-reviewer PASS accepted with both sections |
| AC2 | QA_COMPLETION_EVIDENCE_MISSING (path named, no state written) and MISSING_EVIDENCE |
| AC3 | EXPECTED_RED_DIFF_MISSING; AC_EXECUTION_LOG_MISSING with `Inspected:` naming the judge report; resolver one location for both paths; `review_reports/` note clears nothing |
| AC4 | In_Progress and FAIL judge writes need the report; with report accepted; unmarked REVIEWER_COMPLETED_TASKS_REJECTED byte-equal to base |
| AC5 | qa:In_Progress and qa:Blocked (OQ1) -> sr rejected REPRO_MANIFEST_MISSING naming both paths |
| AC6 | record alone, manifest alone, both also as empty files |
| AC7 | bugfix (a) qa-written manifest clears both hops; (b) record only: sr -> code-reviewer rejected with today's text until a manifest exists |
| AC8 | drift: PASS-last at root and archive backs the id; FAIL-last is drift; unmarked APPROVED / CHANGES_REQUESTED files identical to base |
| AC9 | lane-status counts code-reviewer PASS, not FAIL / APPROVED; unmarked identical to base with and without `review_reports/` |
| AC10 | release s1, `--state` pre-input, release-gate line, all three tuple cases |
| AC11 | 11 scenarios replayed on a base-commit (5f50af1) build and this branch: chain, architect + FAIL loop, bugfix, Amend-Resume, and each of the 7 rejection codes; normalised transcript, persisted handoff and evidence-file bytes compared |
| AC12 | SQLite MISSING_EVIDENCE, QA_REVIEW_TARGET_REQUIRED, qa PASS with qa_review: outcomes and `reports` rows equal to base; sqlite version 2; `storage-sqlite.ts` / `migrations-sqlite.ts` byte-identical to base |
| AC13 | resolver exported from one module; six consumers import and call it; no restated location literal in four of them |
| AC14 | 35 / 17 (names and order equal base) / evidence 2 / handoff 16 / sqlite 2 / CLAUDE.md 250 lines |

T-E432-06 (commit 4bc8548): the five manifest tests in `test/e431-test-first-server-path.test.mjs` (AC1, AC5, AC6, AC7, AC10) now record `qa_reports/no-new-test_<feature>.txt` in their fixture before the qa -> sr write; every assertion unchanged.

Base-commit replay: `git rev-parse --verify 5f50af1^{commit}` succeeded here, so AC4 / AC8 / AC9 / AC11 / AC12 replays ran (none skipped). If the commit is unreachable the replays `t.skip` with a loud warning.

Coverage: the modified source files (`gates/expected-red.ts`, `gates/qa-review.ts`, `gates/ac-execution.ts`, `tools/handoff-orchestrator.ts` steps 7/10/11, `tools/evidence-lookup.ts`, `tools/lane-status.ts`, `scripts/release.mjs`) are each exercised by the tests above, including every new branch (marked qa -> sr arm, Blocked arm, no-new-test clear, marked judge record and completion arms, judge PASS header regex, release judge). Line-coverage tooling was not run; stated explicitly.

Security smoke: empty-file manifest and record (zero bytes) clear the existence checks; an unmarked `code-reviewer` write cannot add completed ids; the manifest sanitiser is shared with the record path (no path traversal through the feature name, same `safeFeatureName`).

## Expected-Red Diff

Phase 0.5: manifest `qa_reports/expected-red_e432-judge-report-checks.txt` present (5 entries, all `test/e431-test-first-server-path.test.mjs`: AC1, AC5, AC6, AC7, AC10).

- Before any re-baseline edit I ran `node --test test/e431-test-first-server-path.test.mjs` at commit fe8df15: exactly 5 failures, equal to the 5 manifest entries (AC1, AC5, AC6, AC7, AC10), 34 pass. The code-reviewer's full-suite run at da8cc53 (4450 tests, 5 fail) recorded the same five and no other red.
- Phase 0.5: clean (5/5 manifest entries confirmed red, 0 unexplained reds). Each red is the intended behaviour change: the qa -> sr hand-off now needs the manifest or the no-new-test record.
- Disposition after T-E432-06: all 5 entries now green (re-pin, assertions unchanged); the final full suite below shows 0 failures, so no stray red exists.

## AC Execution Log

Run on commit 4bc8548 after `npm run build` (zero errors, clean tree, no `dist/` diff).

- AC1 `node --test test/e432-*.test.mjs --test-name-pattern "AC1:"` -> exit 0, all 30 e432 tests pass (this node version runs the whole file under any pattern), PASS.
- AC2 same command with `"AC2:"` -> exit 0, PASS.
- AC3 `"AC3:"` -> exit 0, PASS.
- AC4 `"AC4:"` -> exit 0, PASS.
- AC5 `"AC5:"` -> exit 0, PASS.
- AC6 `"AC6:"` -> exit 0, PASS.
- AC7 `"AC7:"` -> exit 0, PASS.
- AC8 `"AC8:"` -> exit 0, PASS.
- AC9 `"AC9:"` -> exit 0, PASS.
- AC10 `"AC10:"` -> exit 0, PASS.
- AC11 `"AC11:"` -> exit 0, PASS (11 scenario replays plus the non-vacuous check).
- AC12 `"AC12:"` -> exit 0, PASS (not skipped: better-sqlite3 installed).
- AC13 `"AC13:"` -> exit 0, PASS.
- AC14 `"AC14:"` -> exit 0, PASS; plus `node --test test/e436-stale-handoff-paths.test.mjs test/e395-claude-md-tail.test.mjs test/e391-prompt-audit-stale-facts.test.mjs` -> 27 pass, 0 fail, PASS.
- AC15 `npm audit --audit-level=high` -> exit 0 (7 vulnerabilities, 1 low and 6 moderate, none high; pre-existing, not in this lane's sources), PASS. `git diff --stat 5f50af1..HEAD -- dist/` -> 27 files, only `dist/gates/{expected-red,ac-execution,qa-review,registry}.*` and `dist/tools/{evidence-file,evidence-lookup,handoff-orchestrator,lane-status,registry}.*` (the architecture's expected set; artifacts of lane sources only), PASS. `node scripts/test-lock.mjs -- npm test` -> run once after the last commit with a clean tree; the result is the `suite-result:` line recorded at the head of the PASS section appended below.
