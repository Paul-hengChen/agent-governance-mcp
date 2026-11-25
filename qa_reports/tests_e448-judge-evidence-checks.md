# Tests — e448-judge-evidence-checks (qa-engineer, T-E448-01 … T-E448-10)

Scenarios: `specs/e448-judge-evidence-checks.md` AC1–AC21 (no ticket file; the spec's Acceptance Criteria stand in).
Interfaces: `specs/e448-judge-evidence-checks-architecture.md` Interface Contracts, followed exactly.
Placement branch acted on: the dispatch brief's `Test-file placement` line (new `test/e448-*`, `test/e451-*`,
`test/e452-*`, `test/e459-*`, `test/e460-*` pre-authorized; re-pins only in the owned files the integrator listed).

## Scenario → Test Map

| AC | test file | test name (prefix) |
|---|---|---|
| AC1 | `test/e448-judge-evidence-checks.test.mjs` | `AC1: file-mode code-reviewer PASS with no review_reports/ file -> MISSING_REVIEW_EVIDENCE …` |
| AC2 | same | `AC2: the same PASS with review_reports/review_T1.md (any content) is accepted; …` ; `AC2: review scope is review_task_ids when non-empty, else completed_tasks` |
| AC3 | same | `AC3: SQLite judge PASS with no code-review rows is accepted; registry 33, pipeline 17 …` |
| AC4 | same | `AC4: MISSING_REVIEW_EVIDENCE registry entry carries hint.missing_review_evidence …` |
| AC5 | `test/e451-visual-header-anchor.test.mjs` | `AC5: a failed Region Diff row whose id contains 'surface' …` |
| AC6 | same | `AC6: a failed Structural Assertions row id assertionIdle …` |
| AC7 | `test/e452-allowed-differences.test.mjs` | `AC7: EVIDENCE_SCHEMA_CURRENT is 3; …` ; `AC7: pin 2 and an absent pin keep the v2 normalized-contains heading rule; pin 1 keeps the exact anchor` |
| AC8 | same | `AC8: pin 3, an accepted surface with ## Allowed Differences reading None. (or empty) …` |
| AC9 | same | `AC9: pin 3, the accepted surface id anywhere in ## Allowed Differences …` |
| AC10 | same | `AC10: the AC8 report on a feature pinned 2, or with no pin, is accepted …` |
| AC11 | `test/e434-reviewer-visual.test.mjs` | `AC7: one surface accepted in Region Diff … (evidence schema v3)` (rewritten) |
| AC12 | `test/e459-pass-evidence-rule.test.mjs` | `AC12: a judge PASS over an id whose report has standing FAIL …` ; `AC12: standing none …` |
| AC13 | same | `AC13: the same FAIL-standing report clears when the PASS write carries qa_review …` ; `AC13: a covers: T2 report …` ; `AC13: the rule covers every id … under every evidence_schema pin` ; `AC13: (deliberate, architecture OQ 2) …` |
| AC14 | same | `AC14: expected-red disposition heading follows the pin …` |
| AC15 | same | `AC15: lane-status — server FAIL then a hand-written PASS heading is claimedWithoutEvidence; …` |
| AC16 | same | `AC16: judgeReportStanding …` ; `AC16: on fixtures (a) … (d) …` ; `AC16: (kept trust class) …` ; `AC16: lane-status and drift read standing through the shared predicate …` |
| AC17 | `test/e431-test-first-server-path.test.mjs` | the two `AC14 (E435): …` tests (isError asserts added) |
| AC18 | `test/e460-tool-error-flag.test.mjs` | `AC18: … (file mode) …` ; `AC18: … (SQLite mode) …` |
| AC19 | `test/e448-judge-evidence-checks.test.mjs` | `AC19: the 18 E458 (8) hints equal their Copy / Strings text verbatim` |
| AC20 | same | `AC20: no hintStatic in GATE_REGISTRY names a workspace-relative repo path or a bare ticket id` |
| AC21 | — | `command` scenario (full suite, `dist/` scope, `CLAUDE.md` 250 lines, no forbidden-path change, import line unchanged, `npm audit`): no test; the judge runs it (T-E448-18 / T-E448-19). |

### Deliberate behaviour pinned (integrator notes)

- **Architecture OQ 2 / DR-2 is deliberate**: an id whose own `qa_reports/review_<id>.md` has standing FAIL but which a
  `covers:` report with standing PASS names **has** PASS evidence — any PASS-standing candidate qualifies, no cross-file
  timestamp comparison. Pinned by `AC13: (deliberate, architecture OQ 2) …` for the PASS gate, lane-status and drift alike.
- **AC16 (b)** (server FAIL, then a hand-written `## Round 1 — PASS — by code-reviewer`) is not PASS evidence for the
  file-mode PASS gate, lane-status, or drift — `AC16: on fixtures (a) … (d) …` asserts all three on that exact fixture.
- **Drift keeps crediting verdict-less reports** (human ruling, `test/e112` pin unchanged): a report with only a
  hand-written heading and no server-recorded verdict is credited by drift and by neither lane-status nor the PASS gate —
  `AC16: (kept trust class) …`.

## Re-pins in owned files (T-E448-05 … T-E448-10)

Every re-pin moves a fixture or a frozen string to the new behaviour; none weakens what the test checks.

| file | change | why |
|---|---|---|
| `test/e431-test-first-server-path.test.mjs` | `recordCodeReview()` helper; review_reports file before the AC3, AC11 (b), AC12 (a), AC15 (c) judge PASS writes; `NON_JUDGE_HINT` → Copy; AC14 `isError` asserts (AC17) | E448, E458 (8), E460 |
| `test/e432-judge-report-checks.test.mjs` | `judgeReport()` ends with a server-recorded PASS section; `markedJudgeWs` writes review_reports; `QA_COMPLETION_HINT` → Copy; AC11 chain gets a review report; expectedRedMissing report gets a server PASS; AC14 `EVIDENCE_SCHEMA_CURRENT` 3 | E459, E448, E458 (8), E452 |
| `test/e32-e33-gate-hardening.test.mjs` | C3 writes review_reports/review_T-C3-01.md | E448 |
| `test/e154-multi-covers.test.mjs` | AC-E154-4 covering report ends with a server PASS section; review report for Y; stale "dormant" comment rewritten | E459, E448 |
| `test/gates-expected-red.test.mjs` | `seedQaInProgress` writes review reports for T01/T02 | E448 |
| `test/e23-evidence-schema.test.mjs` | AC1-1..AC1-3 stamp value 3 | E452 |
| `test/qa-flow.test.mjs` | AC-12 hint check reads the compiled registry's runtime value = `hint.missing_review_evidence` | E448 |
| `test/visual-evidence-gate.test.mjs` | AC-4 expected text drops the spec reference; asserts it is gone | E458 (8) |
| `test/e434-reviewer-visual.test.mjs` | `JUDGE_REPORT` ends with a server PASS section; `designJudgeWs` writes review_reports and takes `seedOpts`; AC7 rewritten (AC11, pin 3); AC10 hint adds the v3 sentence | E459, E448, E452 |
| `test/error-code-contract.test.mjs` | `MISSING_REVIEW_EVIDENCE` triggerEdge allowlist `reason` refreshed (DR-9; behaviour-neutral) | E448 |
| `test/ac-execution.test.mjs` | `seedJudgeInProgress` writes review_reports/review_T01.md | E448 |
| `test/e139-non-reviewer-verdict.test.mjs` | review reports before the AC-E139-2 and AC-E139-4 PASS writes | E448 |
| `test/e150-completed-tasks-carry-forward.test.mjs` | review report for T-C | E448 |
| `test/e161-qa-suite-result.test.mjs` | `seedFile` writes one `covers:` review report naming every PASS'd id | E448 |
| `test/e236-rejected-write-evidence.test.mjs` | `writeCodeReview()` for AC-E236-5/-6; **new AC4 case** `MISSING_REVIEW_EVIDENCE` (the step now rejects after QA_REVIEW_RECORD, so the evidence-undo invariant covers it too) | E448 |
| `test/e247-pass-tasks-incomplete.test.mjs` | `pass()` writes a review report per PASS'd id | E448 |
| `test/e396-covers-expected-red.test.mjs` | one `covers:` review report for the seven ids | E448 |
| `test/e435-remove-old-path.test.mjs` | review report before the AC2 judge PASS | E448 |
| `test/qa-review-scoped-append.test.mjs` | FM2 review reports for T-QRSA2-Y/Z | E448 |
| `test/baseline-manifest-gate.test.mjs` | E2 asserts the spec reference is gone; E6 compares runtime hints to the Copy texts | E458 (8) |
| `test/cut-approval-gate.test.mjs` | C2 compares the runtime hint to `hint.cut_approval_required` | E458 (8) |
| `test/e151-resume-of-rejection-hint.test.mjs` | `HINT_STATIC` → `hint.transition_rejected`; `s1()` uses it | E458 (8) |
| `test/pixel-gate-attestation.test.mjs` | E4 asserts the reference is gone + runtime hint verbatim; E5 last clause | E458 (8) |
| `test/reviewer-completed-tasks-gate.test.mjs` | `NON_JUDGE_HINT` → Copy | E458 (8) |
| `test/source-credibility-gate.test.mjs` | T13 static suffix and S02 → `hint.source_credibility_unverified` | E458 (8) |
| `test/e433-test-first-rules.test.mjs` | **AC9 only** (re-allocated by the integrator): the live-hint assertion pins `hint.ac_execution_log_missing`; the closed-range assertions untouched | E458 (8) |

Where a hint lives in a literal that `gates/registry.ts` may split across concatenated lines, the re-pinned test
compares the compiled registry's runtime `hintStatic` instead of searching `dist/` text (qa-flow AC-12,
baseline-manifest-gate E6, cut-approval-gate C2, pixel-gate-attestation E4).

## Open Interface Details

- Test task ids follow the spec text (`T1`, `T2`) in the e448/e459 files and the host file's convention elsewhere.
- AC1 "auto-recorded section undone": asserted as the pre-existing `qa_reports/review_T1.md` bytes restored exactly.
- AC12 / AC13: the whole rejection text is asserted equal to `msg.missing_evidence_file` (architecture: path per missing
  id from `qaEvidencePath`, joined `, `, in `ev.missing` order).
- AC8: the listing reason is asserted inside its task's `{…}` braces, i.e. `{accepted but not in ## Allowed Differences: settings.language}` when it is the only reason.
- AC9: the prose case uses a different letter case (`Settings.Language`) to pin DR-7's case-insensitive match.
- AC16: `judgeReportStanding` is read through a namespace import so the file links on the base tree; the CRLF case pins DR-4's trailing-`\r` tolerance; standing none includes a timestamp without milliseconds (DR-4 strict shape).
- AC16 source check: `tools/lane-status.ts`, `tools/evidence-lookup.ts`, `gates/qa-review.ts` import `judgeReportStanding`/`isPassStanding` from `evidence-file.js` and call `judgeReportStanding(`; lane-status and evidence-lookup contain none of `PASS|FAIL`, `— PASS — by`, `\sPASS\s`, `JUDGE_PASS_HEADER_RE`, `VERDICT_HEADING_RE` outside comments.
- AC18: "carries no isError" is asserted as `result.isError === undefined` (architecture: conditional spread).
- AC4: the orchestrator slice runs from `name: "MISSING_REVIEW_EVIDENCE"` to the closing `\n];` of the pipeline array and must not contain `qa-engineer`; the registry `triggerEdge` / `armCondition` / `clearingArtifact` are pinned to the architecture's exact strings.

## Discovery method (not delivered)

To find every existing test the change reddens, a throwaway copy of the worktree in the qa scratchpad was edited
roughly per the architecture and run under the shared test lock (4607 tests, 65 fail in 25 files — all in the owned
set). Every red was re-pinned; against that copy the 25 re-pinned files plus the 5 new files then ran 677/677 green.
The copy is not part of the hand-off and sr-engineer builds from the architecture, not from it.

## Red Reasons

See `qa_reports/expected-red_e448-judge-evidence-checks.txt` (one `#` reason per group). In short: every listed test
is red because the server change it describes is not built yet — step 17 does not arm on the judge PASS (E448), the
header patterns are unanchored (E451), `EVIDENCE_SCHEMA_CURRENT` is 2 and has no listing rule (E452), there is no
standing predicate and file-mode PASS accepts any report file (E459), refusals carry no `isError` (E460), and the 18
hints still name repo paths / ticket ids (E458 (8)). No compile errors anywhere (the suite builds; the new names are
reached through namespace imports or runtime lookups).

## Suite result (worktree, current dist, after this hop)

`node scripts/test-lock.mjs -- npm test` (build + full suite, Node 22): **4607 tests, 4560 pass, 45 fail, 2 skipped**
(baseline at `70d34c6`: 4579 tests, 0 fail). The 45 reds are exactly the 45 entries of
`qa_reports/expected-red_e448-judge-evidence-checks.txt` — 22 new-file tests (e448 5, e451 2, e452 3, e459 10,
e460 2) plus 23 tests in owned files (re-pinned, or with assertions added for AC11 / AC17 / the new e236 case); nothing else is red. `npm run build`: zero compile errors.
Re-pinned tests that stay green on the base tree (fixture additions such as a review_reports/ file or a server PASS
section, which the current server ignores) are listed in the re-pin table, not the manifest: they are green before
and after the build.
Already-green scenario tests (behaviour exists): AC2 (both halves of the first test), AC3, AC7 second test, AC10,
AC13 first test and OQ 2 test — they pin behaviour the change must keep.

## CI runnability

`npm test` is headless; SQLite cases skip loudly when better-sqlite3 is absent. Temp workspaces only under
`os.tmpdir()`; no base-tree reads, no `git show`, no historic SHA pinned.
