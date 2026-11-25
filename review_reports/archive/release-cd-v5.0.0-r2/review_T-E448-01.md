# Review — T-E448-01 (e448-judge-evidence-checks)

covers: T-E448-01, T-E448-02, T-E448-03, T-E448-04, T-E448-05, T-E448-06, T-E448-07, T-E448-08, T-E448-09, T-E448-10, T-E448-11, T-E448-12, T-E448-13, T-E448-14, T-E448-15, T-E448-16, T-E448-17, T-E448-18, T-E448-19

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Reviewed: `git diff 70d34c6...HEAD` (qa tests 37394af, sr implementation dbef27e..535ea08), `specs/e448-judge-evidence-checks.md`, `specs/e448-judge-evidence-checks-architecture.md`, `qa_reports/tests_e448-judge-evidence-checks.md`, `qa_reports/expected-red_e448-judge-evidence-checks.txt`. Judge report (Expected-Red Diff, AC Execution Log): `qa_reports/review_T-E448-01.md`.

## Summary
- Six fixes in ten owned sources: `MISSING_REVIEW_EVIDENCE` now arms on the file-mode judge PASS write; the Region Diff / Structural Assertions header checks are anchored; evidence schema 3 adds the Allowed Differences listing rule; one shared report-standing predicate (`judgeReportStanding`) used by the file-mode PASS gate, lane-status and drift; `isError` on `tw_complete_task` / `tw_rollback_task` refusals; 18 hints reworded.
- Scope is clean: only owned sources, tests, `dist/`, specs/e448-*, qa_reports/ and .current/e448/** change. `dist/` matches a fresh `npm run build`, `tsc --noEmit` is clean, registry 33 / pipeline 17 in the same order, `hasEvidenceInFile` byte-identical, `hasDesignModeRequiringVisual` import untouched, CLAUDE.md 250 lines.
- All 21 Copy / Strings hint rows match the registry exactly (checked by a script). The two `msg.*` strings match. No hint names a repo path or a bare ticket id.
- Every proof command exits 0. A negative control (base `70d34c6` sources with this branch's tests) turns every primary scenario test red.
- Verdict: CHANGES_REQUESTED. One required finding: the new standing-PASS rule refuses a legitimate judge PASS when the hand-written judge report has no trailing newline (R1).

## AC Completeness
AC1 — implemented — tools/handoff-orchestrator.ts:1124-1150 (step 17 armed on the file-mode judge PASS); test/e448-judge-evidence-checks.test.mjs AC1
AC2 — implemented — same step (scope = review_task_ids else completed_tasks); AC2 tests
AC3 — implemented — `storage instanceof FileHandoffStorage` guard; registry 33 / pipeline 17 asserted
AC4 — implemented — gates/registry.ts:326-340; orchestrator step comment no longer names a hand-off to qa-engineer
AC5 — implemented — tools/evidence-file.ts parseRegionDiffRows (`/^surface(\s*id)?$/i`)
AC6 — implemented — tools/evidence-file.ts parseAssertionFailures (`/^assertion(\s*id)?$/i`); test uses `assertionIdle`
AC7 — implemented — gates/evidence-schema.ts (`EVIDENCE_SCHEMA_CURRENT = 3`, `EVIDENCE_SCHEMA_ACCEPTED_LISTING = 3`)
AC8 — implemented — gates/visual.ts findUnlistedAcceptedDiffs + orchestrator step-14 reason
AC9 — implemented — case-insensitive substring match (DR-7)
AC10 — implemented — the rule runs only when pin >= 3
AC11 — implemented — test/e434-reviewer-visual.test.mjs AC7 now checks server accept and reject, not its own fixture text
AC12 — implemented — gates/qa-review.ts hasPassEvidenceInFile + orchestrator step 13 `msg.missing_evidence_file`
AC13 — partial — a PASS write with qa_review over a FAIL-standing (or verdict-less) report is refused when that report has no trailing newline. The auto-recorded heading then lands mid-line, so it is not a verdict section (R1)
AC14 — implemented — gates/expected-red.ts `sliceH2SectionAt(..., evidenceSchema)`; step 15 passes the pin
AC15 — implemented — tools/lane-status.ts passEvidenceIdsIn through isPassStanding(…, REPORT_SIGNERS)
AC16 — implemented — one exported predicate in tools/evidence-file.ts; lane-status and evidence-lookup keep no verdict regex of their own
AC17 — implemented — tools/tasks.ts:75 `isError: true` on the judge refusal
AC18 — implemented — tools/tasks.ts isErrorEnvelope + handleRollbackTask (file and SQLite)
AC19 — implemented — 18 hints equal their Copy text (script check, all 21 hint rows)
AC20 — implemented — no repo path or ticket id in any of the 33 hints
AC21 — implemented — full suite 4605/4607 pass, 0 fail, 2 history-dependent skips; dist matches a fresh build; CLAUDE.md 250 lines; no forbidden path touched; import line unchanged; audit exit 0 (see the judge report)

## Correctness
- **R1 — required (implementation defect, plus a missing test).** `gates/qa-review.ts:139-147` (`recordReviewInFileUndoable`, unchanged by this diff) appends `## <ts> — PASS — by code-reviewer` straight onto the existing judge report with no leading newline. The new `SERVER_VERDICT_HEADING_RE` (`tools/evidence-file.ts`, `^## …` with the `m` flag) needs that heading at the start of a line. When the judge's own hand-written `qa_reports/review_<id>.md` (Expected-Red Diff / AC Execution Log, written before the PASS) does not end with `\n`, the heading lands mid-line. The report's standing stays none, and step 13 refuses the PASS with `⛔ MISSING_EVIDENCE: T1. The last server-recorded verdict for each listed id is not PASS …`. The pipeline then undoes the append. So a retry fails the same way, and the message blames the server's own verdict.
  Reproduction (built lane dist, temp workspace at `code-reviewer:In_Progress`, `review_reports/review_T1.md` present, PASS with `completed_tasks: ["T1"]`, `review_task_ids: ["T1"]`, `qa_review`):
  - report `"# QA review — T1\n\nAll scenarios exercised.\n"` → accepted
  - same report without the final `\n` → `⛔ MISSING_EVIDENCE: T1. The last server-recorded verdict …` (rejected)
  This breaks AC13 ("the same write's auto-record appends a PASS section, so the standing is PASS"). On base the PASS was accepted because the file existed, so this diff introduced the regression. lane-status has the same problem, because it reads the same predicate.
  Suggested fix (owned file `gates/qa-review.ts`): when the target file exists and is non-empty and does not end with `\n`, prefix the appended text with `\n`. The undo already truncates to `preSize`, so it stays correct. Test needed first, so it can be shown red: an AC13 case in `test/e459-pass-evidence-rule.test.mjs` whose FAIL-standing or verdict-less report has no trailing newline, plus a lane-status credit check on the result.
- Tests: every automatable AC has a test on the public interface (the `tw_update_state` / `tw_complete_task` / `tw_rollback_task` tool entries, `checkLaneEvidence`, `hasEvidenceAnywhere`, the `GATE_REGISTRY` export). Assertions are exact: full rejection text for `msg.missing_evidence_file`, `{<reason>}` listing for the unlisted surface. The E451 test uses `assertionIdle`, `card-surface` and `Surfaces.list`. E434 AC7 now asserts server accept and reject. Negative control: with base sources, 24 of 40 new or rewritten tests and both AC17 tests go red. The ones that stay green are paired accept-path or regression controls (AC2 accept, AC3 SQLite / counts, AC7 pin-1 / pin-2 heading rule, AC10, AC13 qa_review accept and OQ-2).
- No other correctness findings. `hasPassEvidenceInFile` builds its covering set lazily, at most once per call, and uses a set rather than a first-seen map, so a PASS covering report is never hidden. `findUnlistedAcceptedDiffs` skips the rule when the section is absent (DR-6).

## Quality
- No required findings. Naming follows the architecture contract. `parseRegionDiffFailures` now builds on `parseRegionDiffRows`, so the header skip lives in one place. Dead code was removed (`JUDGE_PASS_HEADER_RE`, `VERDICT_HEADING_RE`, `lastVerdict`).
- optional: the re-pin comments in tests carry ticket ids ("E448 re-pin (E459)"). The test suite already uses this convention, and source comments added by this diff carry no ticket ids or new repo-only paths (the one `Spec:` line in gates/evidence-schema.ts was already there). Kept, no change asked.

## Architecture
Matches `specs/e448-judge-evidence-checks-architecture.md`: DR-1 (predicate in tools/evidence-file.ts; orchestrator calls `hasPassEvidenceInFile` in file mode), DR-2 (union across candidate reports), DR-3 (only lane-status filters by signer), DR-5 (`hasEvidenceInFile` byte-identical, new function above it), DR-6/7/8 (listing rule), DR-9 (triggerEdge free English; allowlist reason refreshed), DR-10 (expected-red text unchanged), DR-11 (rollback envelope check in the handler). No new tools/*.ts, no edits to storage, transitions, registry tool or schema. R1 is a gap the architecture missed: DR-4 fixed the heading shape but never checked how the appender places that heading.

## Security
No findings. `isErrorEnvelope` parses storage output in try/catch, and the result only affects a boolean flag. The new file reads go through existing path helpers (`evidencePath` / `resolveJudgeReport().dir`). No new input crosses a trust boundary, and no secrets are introduced. `npm audit --audit-level=high` exits 0 (1 low and 6 moderate advisories, none from this diff).

## Performance
No findings. On a direct miss, the PASS gate reads each listed id's report once plus one sorted scan of `qa_reports/*.md`, the same complexity as the existing `buildCoverageIndex` path. lane-status and drift replace one regex scan with another. No regression on any hot path.

## Verdict
CHANGES_REQUESTED — R1: the standing-PASS rule refuses a legitimate qa_review-bearing judge PASS when the judge report has no trailing newline (breaks AC13). Route to qa-engineer for the red test, then sr-engineer to make the appender start its heading on a new line. Everything else is clean.

## Round 2 — APPROVED — by code-reviewer

Reviewed: `git diff 568be67..HEAD` (qa red test 18f5bfa, sr fix 7ef0284, lane state 154f143), re-checked against `git diff 70d34c6...HEAD`, the spec and architecture, `qa_reports/tests_e448-judge-evidence-checks.md` (R1 section) and the expected-red manifest. Judge report (round-2 Expected-Red Diff and AC Execution Log): `qa_reports/review_T-E448-01.md`.

## Summary
- R1 is fixed. `recordReviewInFileUndoable` (`gates/qa-review.ts:168-174`) now writes one `\n` before the appended section when the existing report is non-empty and its last byte is not `\n`. The new private helper `lacksTrailingNewline` (`gates/qa-review.ts:70-92`) reads one byte and never throws.
- New test: `AC13 (review round 1, R1)` in `test/e459-pass-evidence-rule.test.mjs`. It runs FAIL-standing and verdict-less fixtures, each with no trailing newline, through the public `tw_update_state` entry. It asserts that the PASS is accepted, that the original text is a byte prefix of the result, that the PASS heading starts a line, that standing is PASS, and that lane-status credits the id. It fails on 568be67's `gates/qa-review.ts` (negative control: 12 pass, 1 fail, `⛔ MISSING_EVIDENCE: T1`) and passes at HEAD.
- Since round 1 only `gates/qa-review.ts`, its `dist/` outputs, one test, two qa_reports files and lane state changed. Scope is still the owned set. GATE_REGISTRY 33 / pipeline 17. `dist/` matches a fresh build. `hasEvidenceInFile` is byte-identical to base.
- Full suite 4606/4608 pass, 0 fail, 2 history-dependent e130 skips. `npm audit --audit-level=high` exit 0.
- Verdict: APPROVED.

## AC Completeness
AC1–AC12 — implemented — unchanged since round 1 (see Round 1 table above); proofs re-run green in round 2
AC13 — implemented — gates/qa-review.ts:168-174 (newline prefix) + `lacksTrailingNewline`; test/e459-pass-evidence-rule.test.mjs `AC13 (review round 1, R1)` green, red on 568be67 source
AC14–AC20 — implemented — unchanged since round 1; proofs re-run green
AC21 — implemented — suite 4606/4608, 0 fail; audit exit 0; dist matches a fresh build; registry 33 / pipeline 17; no forbidden path touched (judge report AC21 row)

## Correctness
- R1 is closed. The prefix byte is added to `text` before `record.appended` is updated, so `postSize = preSize + appended.length` still holds. The undo checks the tail and truncates to `preSize`, which removes the prefix too. Verified on the built dist: a report with no trailing newline gets `\n## …`, and undo restores the original 75 bytes exactly. A repeated id in one write appends twice, but only the first append is prefixed, because the second sees a trailing `\n`. A report that already ends in `\n` gets no extra byte. An empty existing file gets no prefix and undoes to size 0. A file absent before the write takes the header path (`existed` false), unchanged.
- The test is meaningful. It drives the public tool entry, not the helper. It pins the outcome the scenario names: accepted, heading at a line start, standing PASS, lane-status credit. It also checks that the hand-written text survives unchanged. It deliberately leaves the number of newlines before the heading unpinned (documented in tests_*.md), which is acceptable.
- `lacksTrailingNewline` treats an unreadable file as "no prefix". If that read fails, the append that follows would most likely fail as well, and the existing undo/rethrow path handles that. Not a finding.
- No regressions in the round-1 diff. `git diff 568be67..HEAD` touches no other source. The full suite has 0 fail.
- Live-write note, not a finding against this diff. The judge left its round-2 judge report without a trailing newline on purpose. The server that took the PASS write is the installed build, not this lane's dist, so it glued its PASS heading mid-line, exactly the pre-fix R1 behaviour, and accepted the write by file existence (the base rule). The judge inserted the one missing newline byte before that server heading (documented in the judge report's AC13 row). With that byte, this lane's `judgeReportStanding` reads PASS and `checkLaneEvidence` credits all 19 ids (claimedWithoutEvidence: []). This also shows R1 for real: until this lane ships, reports written by the installed server can carry a glued heading, and they read as not-PASS once the new standing rule is live.

## Quality
- recommended: before or at release, check the existing `qa_reports/*.md` in adopters' and this repo's history for a server verdict heading glued mid-line by a pre-fix server (a line containing `.## <ISO ts> — PASS — by`). The new standing rule reads such a report as not-PASS, so lane-status or drift could stop crediting an id the old server recorded. This repo has none: a grep of qa_reports/ finds only quoted mentions inside table cells of two archived release reports. Report-only.

No required findings. The helper is private, named for what it checks, and commented without ticket ids or repo-only paths. The doc comment on `recordReviewInFileUndoable` was updated to describe the new byte and its undo.
- optional: the updated doc comment line `// heading starts its own line; the undo truncates that byte away too. If an append throws` runs longer than its neighbours. Cosmetic, no change asked.

## Architecture
Fits DR-4/DR-5: the fix lives in the appender (`gates/qa-review.ts`), the predicate in `tools/evidence-file.ts` is unchanged, and `hasEvidenceInFile` is byte-identical to base. No new module, gate, pipeline step or storage change. SQLite mode is unaffected: there the record is a row, not a file append.

## Security
No findings. The single-byte read goes through the same `evidencePath` the append already uses. No new input crosses a trust boundary. The file descriptor is closed in `finally`. Audit exit 0 (1 low and 6 moderate advisories, none from this diff).

## Performance
No findings. One `stat` plus a one-byte read per existing target file, on the judge PASS/FAIL write path only.

## Verdict
APPROVED — R1 is fixed at its cause in the appender, covered by a test that fails without the fix, with no regression and clean scope, so every AC (AC1–AC21) now passes.
