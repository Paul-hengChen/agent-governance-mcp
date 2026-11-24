# Review — E435 remove the old build path (T-E435-01 … T-E435-50)

covers: T-E435-01, T-E435-02, T-E435-03, T-E435-04, T-E435-05, T-E435-06, T-E435-07, T-E435-08, T-E435-09, T-E435-10, T-E435-11, T-E435-12, T-E435-13, T-E435-14, T-E435-15, T-E435-16, T-E435-17, T-E435-18, T-E435-19, T-E435-20, T-E435-21, T-E435-22, T-E435-23, T-E435-24, T-E435-25, T-E435-26, T-E435-27, T-E435-28, T-E435-29, T-E435-30, T-E435-31, T-E435-32, T-E435-33, T-E435-34, T-E435-35, T-E435-36, T-E435-37, T-E435-38, T-E435-39, T-E435-40, T-E435-41, T-E435-42, T-E435-43, T-E435-44, T-E435-45, T-E435-46, T-E435-47, T-E435-48, T-E435-49, T-E435-50

## Round 1 — APPROVED (pending the human ruling on AC11 `npm run eval`) — by code-reviewer

Base `a1a36b2`, head `01ddec4d`, branch `feat/e435-remove-old-path`. Reviewer model: opus (same tier as sr-engineer and qa-engineer per the dispatch pins; same-model bias possible, flagged).

## Summary
- One routing chain: `ALLOWED_TRANSITIONS` rewritten to the architecture's 22-key table (pm/architect → qa-engineer, qa → sr, sr → code-reviewer, code-reviewer → PASS), test-first overlay and the `chain_path` marker removed end to end (zod, JSON schema, types, parser, writer, orchestrator, release script, content).
- Handoff schema 16 → 17 with a pure v16 → v17 step dropping `chain_path`, `qa_round`, `qa_rounds_total`; SQLite DDL and version untouched, `qa_round` no longer read or written.
- `QA_ROUND_EXCEEDED`, `REVIEWER_COMPLETED_TASKS_REJECTED`, `NON_QA_COMPLETED_TASKS_REJECTED` removed; `NON_JUDGE_COMPLETED_TASKS_REJECTED` added at step 9; registry 33, pipeline 17; content and registry consistent.
- Removed old-path steps reject `TRANSITION_REJECTED` with the step-keyed hint naming `docs/migration-v5.md`; qa PASS rejected at the zod boundary naming code-reviewer; `docs/migration-v5.md` added.
- ~110 test files re-pinned, new `test/e435-remove-old-path.test.mjs`, 7 of 12 goldens changed with per-hunk attribution, budget caps measured. Verdict: APPROVED, every changed file inside the lane's owned set; AC11's `npm run eval` left to the human ruling.

## AC Completeness
AC1 — implemented — tools/transitions.ts ALLOWED `pm:In_Progress` (no sr-engineer), `REMOVED_OLD_PATH_STEPS` S1/S2, `PM_TO_SR_HINT`; test e435 AC1
AC2 — implemented — tools/registry.ts superRefine (`QA_PASS_REFINE_MESSAGE`), tools/tasks.ts `requireJudge`, tools/handoff-orchestrator.ts step 9 `NON_JUDGE_COMPLETED_TASKS_REJECTED`; tests e435 AC2 ×3
AC3 — implemented — tools/transitions.ts `oldPathStepHint` in step 4 (step-keyed, no marker input exists), `MIGRATION_HINT`; tests e435 AC3 ×2
AC4 — implemented — schema/versions.ts handoff 17, schema/migrations-handoff.ts v16→v17, tools/registry.ts (no `chain_path`, `resume_of` enum `["code-reviewer"]` with `RESUME_OF_ENUM_MESSAGE`); grep clean outside the migration file; tests e435 AC4 ×3, handoff-migration / handoff-versioning
AC5 — implemented — gates/registry.ts (33 entries, mapping comment), tools/handoff-orchestrator.ts pipeline 17 steps (step 9 renamed), CLAUDE.md line 78; error-code-contract / e434 / e35 / e26 green (82/82)
AC6 — implemented — tools/registry.ts status / completed_tasks / tw_complete_task descriptions byte-equal the architecture Copy; test e435 AC6
AC7 — implemented — content/const-06, const-08, const-11, constitution-rationale, coord-03, coord-07, skill-pm, skill-architect, skill-qa-engineer, skill-code-reviewer, skill-integrator; templates/agent-adapters/claude.md; prompts/*.ts; test e435 AC7 (all 13 prompts, hook output, both template dirs)
AC8 — implemented — docs/migration-v5.md (all eight outline sections); test e435 AC8
AC9 — implemented — shared table + zod + step 9 run in SQLite; tools/storage-sqlite.ts upsert without `qa_round` (column DEFAULT 0 fills it); `CURRENT_VERSIONS.sqlite` 2; test e435 AC9 ran (not skipped)
AC10 — implemented — full suite 4579 / 4576 pass / 0 fail / 3 skipped (history- and git-version-dependent skips, unrelated); expected-red file 0 open rows; goldens + caps per qa report T-E435-40
AC11 — partial (by decision, not a finding) — CLAUDE.md Layout + Execution Profile in sync with templates/agent-adapters/claude.md; `agc check` exit 0; build leaves `dist/` clean; `npm audit --audit-level=high` exit 0; `npm run eval` NOT run and NOT judged here — pending the human ruling the integrator is obtaining (needs an API key). Not relaxed.

## Correctness
No required findings.
- Tests: every automatable AC has a test on the public interface (`TOOL_REGISTRY.run`, `PROMPT_REGISTRY`, the hook binary, files on disk). Assertions are exact where the architecture fixes text (`QA_PASS_REFINE_MESSAGE`, `RESUME_OF_ENUM_MESSAGE`, `MIGRATION_HINT`, the three descriptions) and would fail on a wrong result. AC3 checks both marker-present and marker-absent v16 fixtures, so the hint is proven step-keyed.
- recommended — test/e435-remove-old-path.test.mjs:150-153: AC3's S3 step (code-reviewer:In_Progress → qa-engineer:In_Progress) is driven without `review_verdict: "APPROVED"`, the exact shape the spec names; the table rejects either way (step 1 precedes the verdict gates), so the outcome is the same, but the literal scenario is not replayed.
- recommended — the AC1 end-to-end test drives only pm → sr; architect → sr (S2) is covered only by a pure `oldPathStepHint` assertion (AC3 test) and the hop/qa-flow re-pins, not by a tool-path write in the e435 file.
- Negative control: not run by me in a copy; the 454 expected-red rows qa recorded at base (cleared name-for-name by sr) are the red-at-base evidence.
- tools/handoff-orchestrator.ts:541: the PASS defence-in-depth now returns `isError: true` (was absent). Correct (it is a rejection) and unreachable through zod; noted as a behaviour change for direct callers.

## Quality
- recommended — gates/registry.ts:300-305: stale comment on `QA_COMPLETION_EVIDENCE_MISSING` still says "the feature's judge — code-reviewer on a test-first feature" and "A qa-engineer write that adds ids"; the entry's own triggerEdge/hintStatic are correct.
- optional — gates/registry.ts:67-68: the reworded `documentedInProse` comment reads awkwardly ("nothing emits it since E435: its counter ticks only on a qa-engineer FAIL; E420 owns …" spliced into the old sentence).
- 5d comment check: `agc check — comments` warnings on touched files (gates/registry.ts:75 mapping block, :353; tools/transitions.ts:501; tools/handoff-orchestrator.ts:530/736/1372; tools/lane-status.ts:265; high-ratio on handoff-types/parse/write, migrations-handoff, evidence-file) are all pre-existing blocks that E435 edited in place and net-shortened; the registry mapping block is read by test/error-code-contract.test.mjs. Kept.
- The `_qaRound` positional slot kept in writeHandoffState / HandoffStorage / SqliteHandoffStorage per the architecture (no argument shift) — correct.

## Architecture
Matches `specs/e435-remove-old-path-architecture.md` under Rulings (a) drop and (b) remove+add: 22 keys (postbuild `check:transitions-sync` OK, 22 keys), `TRANSITION_GATE_CODES` 6, union 16, registry 33, pipeline 17 with step 9 `NON_JUDGE_COMPLETED_TASKS_REJECTED`, `isBuildEntry` on `pm → {architect, qa-engineer}`, REPRO hand-off unconditional, verdict gate APPROVED ↔ {PASS, In_Progress}, `resolveJudgeReport(ws)` single-arg, `REPORT_SIGNERS` only in lane-status, `RELEASE_JUDGE` constant, legacy exit keys `qa-engineer:PASS` / `:FAIL` kept. Copy table texts verified byte-for-byte (refine messages, hints, descriptions, release-cd lines 63/69/95, Execution Profile sentence, skill-qa-engineer lines 13/31, const-06 line 7, const-08 label/code, const-11 / rationale). Out-of-scope findings (dormant `MISSING_REVIEW_EVIDENCE`, unreachable `visual_round` tick) are recorded by the architecture, not introduced defects.

## Security
No findings. No new input crosses a trust boundary; an unknown `chain_path` key is stripped by the non-strict zod object (OQ (e)); `resume_of` narrowed with an explicit error; no secrets; SQLite upsert stays parameterised.

## Performance
No findings. `oldPathStepHint` is a 5-element linear scan on the rejection path only; the overlay merge per lookup is gone (`allowedSuccessors` is now a Map get). No new I/O; `readPersistedChainPath` peeks before pre-flight removed (one fewer handoff parse per PASS / tw_complete_task).

## Per-task verdicts

| id | verdict | note |
|---|---|---|
| T-E435-01 | APPROVED | new scenario file AC1–AC4, AC6–AC9; exact Copy pins; AC9 not skipped |
| T-E435-02…05 | APPROVED | qa-flow re-pinned in 4 parts; pm→qa build-entry gate positive control present |
| T-E435-06 | APPROVED | hop/e38/e151/e128 re-pinned; visual-round part deferred to T-43 |
| T-E435-07, 08 | APPROVED | e431 re-pinned to no-marker semantics; gates-expected-red, e396 |
| T-E435-09 | APPROVED | e432 re-pinned; one base-vs-branch replay guard dropped with the replay itself (new AC11 asserts each rejection by regex, not vacuous) |
| T-E435-10 | APPROVED | reviewer-completed-tasks-gate → NON_JUDGE; rest split to T-45 |
| T-E435-11 | APPROVED | error-code-contract / e26 / e308 / e35 / e434 = 33 / 17 |
| T-E435-12 | APPROVED | schema 17 pins; see ruling 1 on the dropped stdio resume_of test |
| T-E435-13…20 | APPROVED | state fixtures without qa_round / qa_rounds_total; read-path / drift races at v17 |
| T-E435-21, 22 | APPROVED | visual tests: qa-closing parts only, no visual counter change (E420) |
| T-E435-23…27 | APPROVED | text pins track the Copy texts; adapters / CLAUDE.md / release docs |
| T-E435-28 | APPROVED | eval fixtures / assertions re-pinned (eval itself pending human, AC11) |
| T-E435-29 | APPROVED | v16→v17 step pure; parser / writer / types drop the fields; `_qaRound` slot kept |
| T-E435-30 | APPROVED | 371 lines, 238 of them deletions (overlay + marker); additions match the contract; see ruling 2 |
| T-E435-31 | APPROVED | 391 lines, 294 deletions (marker plumbing); see ruling 2 |
| T-E435-32 | APPROVED | QA_ROUND_EXCEEDED + ROUND_CAP out with content in one commit |
| T-E435-33 | APPROVED | ledger codes per ruling (b); content in same commit |
| T-E435-34 | APPROVED | metrics / gate-stats / storage / SQLite; see ruling 3 (dist incident, nothing lost) |
| T-E435-35 | APPROVED | descriptions, resume_of enum + message, superRefine |
| T-E435-36, 37, 41 | APPROVED | marker / closing-role wording gone; Execution Profile sentence identical in CLAUDE.md and the template |
| T-E435-38 | APPROVED | migration-v5.md covers the 8 outline items; schema-versions v17 row |
| T-E435-39 | APPROVED | specs/qa-flow-enforcement-architecture.md, dist rebuilt; eval not run (pending human) |
| T-E435-40 | APPROVED | 7 goldens changed, each hunk attributed; caps at measured values |
| T-E435-42 | APPROVED | release-cd lines, lane-status (REPORT_SIGNERS), smoke rewritten (12/12) |
| T-E435-43…49 | APPROVED | hand-back re-pins parse envelopes / issues[0].message, not raw text |
| T-E435-50 | APPROVED | voidRefusalMessage + role.ts comment name code-reviewer |

## Rulings requested by the coordinator
1. T-E435-12 stdio `resume_of: "qa-engineer"` test — confirmed covered. It was a planned test dropped at the 300-line cap, not a deletion of an existing test (static test-title counts did not fall in any of the five T-12 files). e435 AC4 drives the same `TOOL_REGISTRY` entry index.ts dispatches (`defineTool` → `zodSchema.parse`), asserts the exact `RESUME_OF_ENUM_MESSAGE` and the JSON enum; the stdio framing of zod errors stays pinned by handoff-write-arg-guard's PASS-refine regression.
2. T-E435-30 (133+/238-) and T-E435-31 (96+/294-) over budget — nothing hidden: the excess is the overlay / marker plumbing deletion the architecture names; every added line was read against the Interface Contracts and Copy.
3. §6 incident (`git checkout -- dist` in T-E435-34) — nothing tracked lost: a fresh `npm run build` on the clean head leaves `git status --porcelain` showing only my own `.current/e435` state write, i.e. committed `dist/` equals a build of committed source.
4. test/visual-evidence-gate.test.mjs scope-decision tests (in-test copy of the predicate) — pre-existing; E435 only moved the copy from sr-engineer to qa-engineer in step with the code, not worse. The real gate on pm → qa-engineer is driven end to end by qa-flow "C1-07/AC-1 positive control (E435)" and e431 "AC8 (E435)". optional: replace the copy with a tool-path test.
5. AC11 `npm run eval` — not judged, not relaxed; pending the human ruling.

## Verdict
APPROVED — every AC except AC11's `npm run eval` is implemented and proven; no required finding. `status: PASS` not written: it waits on the human ruling on `npm run eval`.
