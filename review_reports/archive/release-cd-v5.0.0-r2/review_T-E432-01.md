# Review — T-E432-01

covers: T-E432-01, T-E432-02, T-E432-03, T-E432-04

## Round 1 — APPROVED — by code-reviewer

Diff reviewed: `1fe0f42..042cea9` (sr commits 22590cd, 5b3dd20, d7b1d29, 042cea9); old-path comparisons against base `5f50af1`. Contracts: `specs/e432-judge-report-checks.md`, `specs/e432-judge-report-checks-architecture.md`, lane row e432 in `specs/fanout-v5-w3.md`. Later commit da8cc53 (spec table pipes + OQ approval line) sanity-checked: doc-only, no code effect.

## Summary
- One resolver, `resolveJudgeReport(workspacePath, chainPath?)` plus `JUDGE_IDENTITIES`, added to `tools/evidence-file.ts`; every predicate and reader named in AC13 now takes the judge-report directory from it (no per-predicate `"qa_reports"` literal left except the manifest/record directory in `gates/expected-red.ts`, as the architecture requires).
- Orchestrator: `QA_REVIEW_RECORD` and `QA_COMPLETION_EVIDENCE_MISSING` arm on the resolver's judge; `REPRO_MANIFEST_MISSING` widened in place with a test-first qa → sr arm (In_Progress or Blocked, OQ1) cleared by the manifest or `qa_reports/no-new-test_<feature>.txt`.
- Readers: archive-aware lookup and lane-status read through the resolver; lane-status accepts a `— PASS — by <qa-engineer|code-reviewer>` header; `scripts/release.mjs` accepts `(code-reviewer, PASS)` only with `chain_path: test-first`.
- Old path verified byte-identical by code reading and by replaying unmarked rejections against a base-commit `dist/` build; counts, `dist/` freshness and the file map all hold.
- Verdict: APPROVED (no required findings; recommended/optional notes below).

## AC Completeness
AC1 — implemented — `gates/expected-red.ts:84-85`, `gates/ac-execution.ts:34-36`, `gates/qa-review.ts:12-14` read the resolver dir; probe: marked code-reviewer PASS with both sections accepted, state `PASS / code-reviewer / [T1] / test-first`
AC2 — implemented — `tools/handoff-orchestrator.ts:875-913` (arm on judge; probe: `QA_COMPLETION_EVIDENCE_MISSING` naming `qa_reports/review_T1.md`); on-disk T1 with no report → `MISSING_EVIDENCE` (step 13 via `hasEvidenceInFile` → resolver)
AC3 — implemented — probe: missing `## Expected-Red Diff` → `EXPECTED_RED_DIFF_MISSING`; missing `## AC Execution Log` → `AC_EXECUTION_LOG_MISSING` with `Inspected: <ws>/qa_reports/review_T1.md`; old-location sentence vacuous (D1: one location, `resolveJudgeReport(ws).dir === resolveJudgeReport(ws, "test-first").dir`)
AC4 — implemented — probe: marked code-reviewer FAIL adding T2 without report → `QA_COMPLETION_EVIDENCE_MISSING` (marked suffix); unmarked → `REVIEWER_COMPLETED_TASKS_REJECTED`, text unchanged
AC5 — implemented — `tools/handoff-orchestrator.ts:630-658`; probe: marked qa:In_Progress and qa:Blocked → sr rejected with msg.qa_to_sr_manifest naming both paths
AC6 — implemented — probe: record only → accepted; manifest only → accepted; empty files clear (existence only, `gates/expected-red.ts:68-75`)
AC7 — implemented — probe (marked + bugfix): qa → sr accepted with record only; sr → code-reviewer rejected with today's bugfix text until the manifest exists, then accepted
AC8 — implemented — `tools/evidence-lookup.ts:47,101` take the resolver dir; `VERDICT_HEADING_RE` (`:58`) is author-agnostic, so a `— PASS — by code-reviewer` last header counts and FAIL-last does not; `review_reports/` never read
AC9 — implemented — `tools/lane-status.ts:214-217,297,344`; header regex built from `JUDGE_IDENTITIES`
AC10 — implemented — `scripts/release.mjs:305,308-311,1237,1245-1246,1529-1537`; unmarked strings default to `qa-engineer` (byte-identical); `chain_path` survives `parseHandoffCopy` (`tools/handoff-parse.ts:516,585`)
AC11 — implemented — unmarked branches compute today's values (architecture's Old-Path table holds line by line); replay of unmarked `REVIEWER_COMPLETED_TASKS_REJECTED`, `QA_COMPLETION_EVIDENCE_MISSING`, bugfix `REPRO_MANIFEST_MISSING` and unmarked qa:Blocked → sr against a `5f50af1` `dist/` produced identical output
AC12 — implemented — `tools/storage-sqlite.ts`, `schema/**` untouched since `5f50af1`; `resolveChainPath` is undefined in SQLite so the recorder passes `qa-engineer` as before; `CURRENT_VERSIONS.sqlite` = 2
AC13 — implemented — `resolveJudgeReport` imported by `gates/qa-review.ts`, `gates/expected-red.ts`, `gates/ac-execution.ts`, `tools/evidence-lookup.ts`, `tools/lane-status.ts`, `tools/handoff-orchestrator.ts` (regex from the architecture's Test Impact matches all six); `"qa_reports"` literal count: 0 in qa-review / ac-execution / evidence-lookup / lane-status, 1 in expected-red (`qaReportsDir`), present in evidence-file
AC14 — implemented — runtime: `GATE_REGISTRY` 35, pipeline 17, `CURRENT_VERSIONS` `{handoff:16,tasks:2,sqlite:2,config:2}`, `EVIDENCE_SCHEMA_CURRENT` 2; `CLAUDE.md` 250 lines, only line 80 changed vs `5f50af1`
AC15 — implemented — see Correctness (suite run); `npm run build` leaves the tree clean (dist matches sources); `dist/` diff limited to the architecture's list

## Correctness
No required findings.
- `tools/handoff-orchestrator.ts:630-635` — `testFirstHandOff` covers exactly the qa → sr edges reachable on a marked feature (`qa-engineer:In_Progress` via TEST_FIRST_OPENS, `qa-engineer:Blocked` via ALLOWED); `qa-engineer:FAIL` is unreachable on a marked feature because TEST_FIRST_CLOSES removes `qa-engineer:In_Progress → FAIL`. `bugfixHandOff` and `testFirstHandOff` are disjoint on `prevTuple.agent`, so the AC7 sequencing is correct.
- `tools/handoff-orchestrator.ts:819,875-876` — moving the arm from the literal `"qa-engineer"` to the judge stops a qa-engineer write on a marked feature from being completion-evidence checked, but the earlier `REVIEWER_COMPLETED_TASKS_REJECTED` step (`:753-770`) already rejects any non-code-reviewer `completed_tasks` on a marked feature with `NON_QA_COMPLETED_TASKS_REJECTED`, so the identity-swap gap does not reopen.
- Behaviour change worth noting (by design, architecture step 10): on a marked feature a qa-engineer `FAIL`/`PASS` carrying `qa_review` is no longer auto-recorded. Both tuples are closed on a marked feature by E431, so no reachable write loses evidence.
- `scripts/release.mjs:1237` — the "does not exist" / "cannot be parsed" stops keep the default `(qa-engineer, PASS)` text even on a marked lane; correct, the marker is unknowable there, and matches the architecture.
- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e432-judge-report-checks.txt` exists; all 5 entries located in `test/e431-test-first-server-path.test.mjs` (AC1 :107, AC5 :184, AC6 :209, AC7 :245, AC10 :359 per the architecture) and each hands a marked feature qa → sr with neither file, which AC5 now rejects — real, intended reds.
- Suite (reviewer's own run, `node scripts/test-lock.mjs -- npm test` at `da8cc53`): 4450 tests, 4443 pass, 5 fail, 2 skipped. The 5 fails are exactly the manifest's five `test/e431-test-first-server-path.test.mjs` entries (AC1, AC5, AC6, AC7, AC10); every source-text pin in the architecture's compliance table and the plan's 讀原始碼文字的測試 table (I5b expected-red / ac-execution, e136, covering-evidence, error-code-contract, e367, e177b, e178b, e235b, lane-paths, e150, e436/e395/e391, release pins) is green. The two md-table reds the sr run reported are gone after da8cc53.

## Quality
- optional — `gates/registry.ts:318-321`: the reflowed QA_COMPLETION_EVIDENCE_MISSING block comment leaves one 122-column line ("honored); ids already there are exempt, ... so a PASS") next to rewrapped short lines; cosmetic.
- optional — `tools/handoff-orchestrator.ts:819`: the new first statement of step 10 sits above the step's explanatory comment rather than below it (step 11 puts its two consts above the comment too, so it is at least consistent).
- Naming, sanitiser extraction (`safeFeatureName`, output identical) and the `judgeReportDir` rename in `gates/ac-execution.ts` match the surrounding style; no dead code.

## Architecture
Matches `specs/e432-judge-report-checks-architecture.md` in every listed contract: resolver shape and location (D1/D6), sanitiser reuse (D2), step 7 widened in place with the consts above the `if (` so I5b keeps exactly two `hasExpectedRedManifest(parsed.workspace_path` sites (D4/D5), step 10/11 judge arm and marked-only completion-evidence suffix, registry doc fields only (`hintStatic` untouched), `tools/registry.ts` descriptions per Copy desc.*, lane-status regex from `JUDGE_IDENTITIES` (D8, OQ2), local `releaseJudge` (OQ3). Files touched equal the architecture's Affected Files table; every file is inside the e432 lane row of `specs/fanout-v5-w3.md`; untouched list (`gates/code-review.ts`, `tools/storage.ts`, `tools/drift.ts`, `tools/storage-sqlite.ts`, `tools/transitions.ts`, `schema/**`, `gates/evidence-schema.ts`, `content/**`, `docs/**`) confirmed by `git diff 5f50af1..HEAD`. Import graph: `tools/evidence-file.ts` → `tools/transitions.ts` → `gates/registry.ts` (no imports) — acyclic as the new header comment says.

## Security
No findings. The no-new-test record path uses the manifest's sanitiser (`[^A-Za-z0-9._-]` → `_`, then `..` runs → `_`), so a hostile feature name cannot produce a traversal-shaped filename; content is never read. `JUDGE_PASS_HEADER_RE` is built from two fixed internal identity literals (no external input reaches the RegExp constructor). `release.mjs` trusts `--state`'s `chain_path` exactly as it already trusted `last_agent`. No absolute local paths or secrets in added lines.

## Performance
No findings. The only new I/O is one `existsSync` (`hasNoNewTestRecord`) on the marked qa → sr edge; `resolveJudgeReport` is a pure `path.join`. lane-status regex is a module-level constant.

## Comment check (SOP 4b)
`agc check` comment warnings that this diff adds or grows, each kept:
- `gates/registry.ts:315` (8 lines) and `:371` (9 lines) — gate-definition doc blocks; the added sentence is the architecture-prescribed E432 arm description and is the registry's WHY record.
- `tools/evidence-file.ts:1` (8 lines) — header text is verbatim the architecture's acyclic-import replacement sentence.
- `tools/evidence-lookup.ts:1` (8 lines) — one-line header extension naming the resolver, prescribed.
- `tools/handoff-orchestrator.ts:613` (11 lines) — the added paragraph cites rulings 10 and 4 (WHY), prescribed by the architecture.
- `tools/handoff-orchestrator.ts:877` (8 lines), `tools/lane-status.ts:267` (11 → 12) — one-line rewording to name the judge.
None is a HOW comment; none carries an absolute path or sensitive data.

## Verdict
APPROVED — all four tasks implement AC1–AC15 per the binding architecture, the unmarked path is byte-identical, and only optional cosmetic notes remain.
