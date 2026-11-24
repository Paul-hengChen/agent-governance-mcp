# e435-remove-old-path

Ticket E435 (v5.0.0 milestone, wave 7, lane e435). Ticket text: `docs/backlog.md` row E435; the **Audit amendment** (`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` section 16.1 ruling 8) supersedes the earlier ticket text. Manifest: `specs/fanout-v5-w7.md` (Lanes row e435, 所有權重劃, 交給 lane 的 PM, 完成定義, Decisions). Rulings used: 16.1 rulings 8 and 18, 15.2 ruling 7, 17.1 ruling 4, and the human rulings of 2026-11-24 recorded in the manifest Decisions table. Line numbers below are re-located at base `a1a36b2` (the manifest's own numbers were taken at `244f2f4`; the ticket's `tools/registry.ts:692,712,883,901` are stale).

## Problem Statement

Since E431–E434 every ticket type can run on the test-first chain (pm → qa-engineer → sr-engineer → code-reviewer, code-reviewer judges and writes PASS), but the server still accepts the old order: pm hands straight to sr-engineer, sr-engineer → code-reviewer → qa-engineer closes, qa-engineer writes PASS, owns `tw_complete_task` and the `completed_tasks` ledger, and the qa round cap (`ROUND_CAP = 4`, `QA_ROUND_EXCEEDED`) still exists. The new path is opt-in through the `chain_path: "test-first"` marker (handoff schema 16). The old path is dead weight that lets a workspace silently run without the builder ≠ judge order the v5.0.0 milestone ships. E435 removes it: the marker goes (schema 16 → 17, lazy migration drops the field), `resume_of` loses `qa-engineer`, the old edges, qa's PASS and completion authority, the qa round cap and three error codes are removed or re-defined (content and registry together), and every composed prompt, tool description and shipped template stops describing qa-engineer as the closing role. A handoff left mid-flight on the old path gets a rejection hint that points at a new migration note, `docs/migration-v5.md`.

## User Stories

- As an adopter upgrading to v5.0.0, I want the server to refuse the old hand-off order, so that no feature closes without the code-reviewer judging the tests and the diff.
- As an adopter with a feature mid-flight on the old path, I want the first rejected write after upgrade to tell me where the migration note is, so that I can finish or restart the feature instead of reading a bare transition error.
- As a qa-engineer agent, I want every tool description and SOP to say that code-reviewer writes PASS and completes tasks, so that I never try to close a feature.
- As a maintainer, I want the marker, the qa round cap and the dead error codes gone from code, content and schema together, so that there is one chain and no conditional on a field nobody needs.
- As a SQLite/HTTP-mode adopter, I want the docs to say what changes for me, so that I know the `sr_return` cap is not enforced in my mode.

## Acceptance Criteria

The proof commands assume a built tree (`npm run build`). `test/e435-remove-old-path.test.mjs` is the new scenario file qa writes in T-E435-01; its test titles start with the AC id. Exact test names are back-filled by qa in `qa_reports/tests_e435-remove-old-path.md`.

- **AC1** — Given any feature (with or without a recorded "no new test" note, on any `dispatch_mode`), when a `pm:In_Progress` handoff is followed by a `sr-engineer:In_Progress` write, then the write is rejected and the hint names qa-engineer as the next step (the "no new test" record is written at the qa step, 15.2 ruling 7).
  proof: `node --test --test-name-pattern="^AC1" test/e435-remove-old-path.test.mjs` exits 0.
- **AC2** — Given any feature, when `agent_id: "qa-engineer"` writes `status: "PASS"`, then the write is rejected and the hint names `code-reviewer` as the judge; and when qa-engineer calls `tw_complete_task`, or passes a non-empty `completed_tasks` on `tw_update_state`, then it is rejected; code-reviewer can do all three (PASS, `completed_tasks`, `tw_complete_task`) with no marker on the handoff.
  proof: `node --test --test-name-pattern="^AC2" test/e435-remove-old-path.test.mjs` exits 0.
- **AC3** — Given a handoff left mid-flight on the old path (schema 16 file, marker absent or present), when the next write after upgrade is one of the removed old-path steps — pm straight to sr-engineer, code-reviewer `APPROVED` (`In_Progress`) to qa-engineer, or a qa-engineer PASS — then it is rejected and the hint names `docs/migration-v5.md`; the hint decision keys on the step, not on the marker (16.1 ruling 8). A write that is a legal new-chain step is not given the hint.
  proof: `node --test --test-name-pattern="^AC3" test/e435-remove-old-path.test.mjs` exits 0.
- **AC4** — Given a schema 16 handoff carrying `chain_path`, when it is read, then it lazily migrates to schema 17 with `chain_path` dropped (and the `qa_round` / `qa_rounds_total` fields handled per architect OQ (a)); `CURRENT_VERSIONS.handoff` is 17; the `tw_update_state` input schema has no `chain_path` property and `resume_of` accepts only `"code-reviewer"`; no source file under `tools/`, `gates/`, `schema/` (outside the migration step and its comment), `scripts/release.mjs` or `content/` reads or names `chain_path`.
  proof: `node --test --test-name-pattern="^AC4" test/e435-remove-old-path.test.mjs` exits 0.
- **AC5** — Given the gate registry and content, then the qa round cap (`ROUND_CAP`) and `QA_ROUND_EXCEEDED` are gone, and `REVIEWER_COMPLETED_TASKS_REJECTED` / `NON_QA_COMPLETED_TASKS_REJECTED` are removed or re-defined per architect OQ (b); every remaining or new code obeys the error-code contract and the `gates/registry.ts` mapping comment matches the content files that quote each code; `GATE_REGISTRY.length` and the `UPDATE_STATE_GATE_PIPELINE` step list equal the architecture's stated values, and `CLAUDE.md`'s "N-step" mentions match.
  proof: `node --test test/error-code-contract.test.mjs test/e434-reviewer-visual.test.mjs test/e35-pipeline-order.test.mjs test/e26-gate-stats.test.mjs` exits 0.
- **AC6** — Given `tools/registry.ts`, then the `status` description, the `completed_tasks` description and the `tw_complete_task` description name code-reviewer as the only role that writes PASS, grows the ledger and completes tasks, with no `chain_path` / "test-first feature" conditional.
  proof: `node --test --test-name-pattern="^AC6" test/e435-remove-old-path.test.mjs` exits 0.
- **AC7** — Given the composed prompts (every role prompt, `teamwork`, `teamwork-lite`, the SessionStart hook output) and the shipped templates (`templates/agent-adapters/**`, `templates/claude-code-agents/**`), then none describes qa-engineer as the closing role (writes PASS, completes tasks, owns the ledger, judges in-context, or sits after code-reviewer), and none names `chain_path` or `resume_of: qa-engineer`.
  proof: `node --test --test-name-pattern="^AC7" test/e435-remove-old-path.test.mjs` exits 0.
- **AC8** — Given `docs/migration-v5.md`, then it covers: how to finish or restart a handoff mid-flight on the old path; re-copying `~/.claude/agents/` (qa-engineer on opus, `qa-visual.md` gone); the `.current/skill-qa-visual.md` override; the "judging in-context" wording of `templates/agent-adapters/claude.md`; re-stamping the `agc-version` adapters; and the SQLite note of AC9.
  proof: `node --test --test-name-pattern="^AC8" test/e435-remove-old-path.test.mjs` exits 0.
- **AC9** (SQLite, human ruling 2026-11-24) — Given SQLite/HTTP mode, when the same hand-offs as AC1 and AC2 are written, then they are rejected the same way (the transition table is shared, no marker needed); the `sr_return` cap is not enforced in SQLite mode and `docs/migration-v5.md` says so; no SQLite column or SQLite schema version is added by this ticket.
  proof: `node --test --test-name-pattern="^AC9" test/e435-remove-old-path.test.mjs` exits 0.
- **AC10** — Given the full suite after the last implementation task and the snapshot return, then every test file re-pinned by the qa tasks is green, `qa_reports/expected-red_e435-remove-old-path.txt` has no open row, the 12 compose goldens are re-captured with a per-hunk explanation in the qa test report, and the six `test/context-budget.test.mjs` caps named in the manifest equal their measured values (zero headroom; the spec-workshop cap 1415 is unchanged).
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 with 0 failures.
- **AC11** — Given the finished branch, then `CLAUDE.md`'s Layout lines (the `transitions.ts` round-cap row, the two "N-step" pipeline mentions) and its Execution Profile sentence that is shared with `templates/agent-adapters/claude.md` are in sync with the code; `node bin/agc-init.mjs check` exits 0; `npm run build` leaves `git status --porcelain dist/` empty; `npm audit --audit-level=high` exits 0; `npm run eval` passes.
  proof: `npm run build && git status --porcelain dist/ && node bin/agc-init.mjs check && npm audit --audit-level=high && npm run eval` prints no `dist/` path and exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| hint.pm_to_sr | (wording set by the architect; must name `qa-engineer` as the next step) | authored-here — the ticket fixes the behaviour, not the words; architect OQ (c) |
| hint.qa_pass | (wording set by the architect; must name `code-reviewer` as the judge) | authored-here — ticket acceptance 2; architect OQ (c) |
| hint.in_flight | (wording set by the architect; must name `docs/migration-v5.md`) | authored-here — ticket acceptance 3; architect OQ (c) |
| desc.status / desc.completed_tasks / desc.tw_complete_task | (wording set by the architect) | authored-here — Audit amendment (3) |
| doc.migration_v5 | `docs/migration-v5.md` (file name) | manifest 派工前核對, "遷移說明（新檔，建議 `docs/migration-v5.md`）" |

New content wording must not use the "is REMOVED" / "is retired" sentence shapes (`test/e440-current-rule-wording.test.mjs`).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

Per the Lanes row 範圍切線 (don't):
- The release: `CHANGELOG.md` (its migration section is the release-engineer's), version bump (`package.json`, `package-lock.json`, the `index.ts` version literal), `agc-version` stamps (`CLAUDE.md`, `AGENTS.md`, `.antigravityrules`), git tag, GitHub release. v5.0.0 is cut later by a separate human instruction.
- `VISUAL_ROUND_EXCEEDED` and the visual gate family (E420).
- Any ticket from E424 on.
- Files in the user's home directory (the migration note tells adopters what to re-copy; the lane copies nothing).
- Adding SQLite support for `chain_path` or `sr_return_count` (human ruling 2026-11-24: no SQLite field).
- The manifest's forbidden list: `docs/lane-protocol-addendum.md`, `docs/ticket-format.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `docs/discussion-2026-11-10-gate-retro-and-full-auto.md`, `docs/retro-*.md`, `docs/prompt-audit-*`, `NEW-TICKETS.md`, `multi-agent-scripts/**`, `.current/_primary/**`, `index.ts`. The E435 done-mark is the integrator's (manifest 5c).
- The open question "write the snapshot rule into the sr / qa SOP" (manifest 待人類決定) — not in this ticket.

## Dependencies / Prerequisites

- E434 merged (base `a1a36b2` contains waves 1–6 and the wave 7 manifest). Ordering per 17.1 ruling 4: E445 shipped before E435.
- **Chain (manifest 交給 lane 的 PM)**: full new chain, through the architect (≈ 12 source files, a schema bump, error-code removal / re-definition, the in-flight hint decision): pm → architect → qa-engineer → sr-engineer → code-reviewer. `approval` = `human`: this cut and the architect's Open Questions are presented to the human in the lane session; the coordinator sends the cut (`re: cut e435`) and the Open Questions (`re: oq e435`) for integrator pre-review.
- **Architect Open Questions (at least)**:
  - (a) Drop `qa_round` / `qa_rounds_total` with the cap, in the same schema 16 → 17 bump (recommended: drop; no field that is always 0). Includes how the SQLite `qa_round` column is treated given "no SQLite field added" (recommended: leave the SQLite schema version and column alone, stop reading / writing it). The qa tasks T-E435-16 … T-E435-20 and the sr task T-E435-34 shrink or are voided if the field stays.
  - (b) `REVIEWER_COMPLETED_TASKS_REJECTED` / `NON_QA_COMPLETED_TASKS_REJECTED`: remove, or rename and re-define ("only the judge writes the ledger" still holds on the new chain, possibly as one new code). Decides whether the pipeline keeps 17 steps or loses one, and with it `test/e35-pipeline-order.test.mjs`, `GATE_REGISTRY.length` (35 today) and `CLAUDE.md` lines 48 / 62.
  - (c) The in-flight hint: where it is decided (transition rejection path vs a gate), which removed steps it recognises, and its exact text; plus the exact texts of `hint.pm_to_sr`, `hint.qa_pass` and the three tool descriptions.
  - (d) SQLite mode — **answered** (human ruling 2026-11-24): SQLite runs the new chain through the shared transition table; the `sr_return` cap is not enforced there and `docs/migration-v5.md` says so; no SQLite field is added.
  - (e) What `tw_update_state` does with an incoming `chain_path` argument after removal (schema-level rejection vs silently ignored), given old clients and this lane's own handoff still send it.
  - (f) Whether the removed old-path edges reject as `TRANSITION_REJECTED` with a hint or under a new error code (error-code contract implications).
- **Server-restart stance**: the lane does NOT restart its MCP server. The running server is the pre-E435 build (marker present); this pm write sets `chain_path: "test-first"` and the lane's handoff keeps it. sr's `dist/` changes are verified by the `dist/` tests in the suite, not by the lane's live server; the code-reviewer PASS is written on the old server (manifest recommendation). The schema 16 → 17 migration of a live handoff is first exercised by the integrator after merge, when the primary server is restarted (manifest 整合後).
- **Snapshots (human ruling R3 (b), 2026-11-24)**: after sr's last implementation task (T-E435-39) there is one planned sr → qa return (uses one return under the `sr_return` cap, Constitution Limits table); qa (T-E435-40) re-captures all 12 compose goldens with a per-hunk explanation and sets the six `test/context-budget.test.mjs` caps to measured values (zero headroom); then sr (confirms nothing to build, re-runs the suite) → code-reviewer. This leaves one `sr_return` for a real defect.
- **`review_round` risk**: one feature with ~100+ files under one judge, bounded by the `review_round` cap (Constitution Limits table). code-reviewer reads per task (in task order) within one `In_Progress`, and its report lists a verdict section per task id, so one bad task does not force a whole-feature re-read.
- **Expected-red file**: `qa_reports/expected-red_e435-remove-old-path.txt` (`<test file> | <exact test name> | <reason>`). T-E435-01 creates it; every other qa task (T-E435-02 … 28) depends on T-E435-01, so no parallel qa task races to create it. Each qa task appends the reds it leaves; each sr task clears the rows its change turns green; T-E435-39 appends the snapshot reds (goldens, caps) for T-E435-40. Not server-gated (`dispatch_mode` is `feature`), but code-reviewer's PASS requires it empty.
- **Test-writing rules**: tests that compare against base-tree text read it into memory at capture time and freeze the value in the test file; never re-read a temp directory later (Node 20 removes it → ENOENT) and never `git show` (the T-E77-02 meta-test rejects it). CI runs Node 20 and 22. Only qa-engineer edits `test/**` (Constitution §2); sr may do mechanical import-path edits only.
- **`npm run eval`** (`test/eval/`, not part of `npm test`): qa re-pins `test/eval/**` in T-E435-28; sr runs `npm run eval` in T-E435-39 after the last content / routing change and build; qa re-runs it in T-E435-40; code-reviewer runs it as AC11's proof.
- **Error-code contract**: every registry change and the content files that quote the code land in one commit (T-E435-32, T-E435-33).
- **Findings outside scope** go to `.current/e435/pending-tickets.md` only.
- Resource Audit: the requirement documents (manifest, backlog row, discussion sections) reference only repo paths; no `http(s)://`, Figma, tracker or ticket-system link → `external_refs` empty.

## Probe — baseline at `a1a36b2`

**Baseline** (PM, 2026-11-24, worktree at `a1a36b2`, untouched, `node scripts/test-lock.mjs -- npm test`, Node 22.23.0): **4536 tests, 4464 pass, 69 fail, 3 skipped, exit 1 — not all green.** All 69 failures are SQLite-mode tests, and all 69 carry the same environment error: `better-sqlite3` "Could not locate the bindings file". The worktree's `node_modules` is a link to the primary checkout's, whose `better-sqlite3` has no compiled `build/` directory. No non-SQLite test fails, so the code at base is green; the environment is not.

**Prerequisite before qa starts (environment, outside this lane's files):** the shared `node_modules` needs the native binding rebuilt (`npm rebuild better-sqlite3` in the primary checkout, which owns that directory), then the probe re-run must show 0 fail. Without it, AC9 and every SQLite re-pin cannot be proven in this worktree. The lane does not touch the primary checkout. **Owner: the integrator** runs the rebuild in the primary checkout (with human consent, coordinator message 2026-11-24); qa's first task re-runs the probe and records 0 fail before writing tests.

No red-file prediction: per the manifest, which tests turn red is qa's per-file judgement against the new contract (expected-red file), not a probe output. Literal re-count at `a1a36b2` (not run): 48 test files name `qa_round` / `qa_rounds_total`; 23 name `chain_path`, `resume_of` or one of the three codes; `test/eval/scenarios.mjs` names old-path identifiers 6 times.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E435 | Remove the old build path: `chain_path` marker removed (handoff schema 16 → 17, lazy migration drops it), `resume_of` loses `qa-engineer`, pm → sr always rejected, qa PASS / `tw_complete_task` / ledger rejected with the judge named, in-flight hint → `docs/migration-v5.md`, qa round cap + `QA_ROUND_EXCEEDED` + the two ledger codes removed or re-defined (registry and content in one commit), tool descriptions, content / templates / `CLAUDE.md` Layout + Execution Profile, SQLite runs the new chain (no new field), tests re-pinned, goldens + budget re-captured | E434 | ~25 source / content / docs + `dist/` + ~100–127 test files + 12 goldens | `tools/**`、`gates/**`、`schema/**`、`prompts/**`、`scripts/release.mjs`、`scripts/summarize-metrics.mjs`、`scripts/smoke-qa-flow.mjs`、`bin/agent-governance-context.mjs`、`content/**`、`templates/**`、`test/**`、`dist/**`、`CLAUDE.md`、`README.md`、`docs/architecture.md`、`docs/schema-versions.md`、`docs/release-cd.md`、`docs/lane-protocol.md`、`docs/migration-v5.md`、`specs/qa-flow-enforcement-architecture.md`、`specs/e435-*.md` | — |

## Tasks

Order (test-first chain): qa T-E435-01 … T-E435-28 (any order, each one qa subagent; T-E435-02 … 05 in sequence) → sr T-E435-29 first, then T-E435-30 … 38, 41, 42 per their `depends_on`, T-E435-39 last → R3 return to qa → qa T-E435-40 → sr re-runs the suite (no code change) → code-reviewer judges task by task and writes PASS. Each task ≤ 5 files and ≤ 300 changed lines (`task_size`); a qa task whose file needs more is split by qa into `a`/`b` halves recorded in its report. The qa task file lists are the manifest's suggested split, finalized here; the architecture may move a file between qa tasks or void a task (OQ (a)), recorded with `tw_void_task`. "Re-pin" = rewrite the test to the new contract (old-path edges now assert rejection and the in-flight hint), not delete it.

### qa-engineer (tests first)

| id | P | files (omit `test/`, `.test.mjs`) | AC | depends_on |
|---|---|---|---|---|
| T-E435-01 | P0 | new `e435-remove-old-path` (one test per AC1–AC4, AC6–AC9) + test report + expected-red file | AC1–AC4, AC6–AC9 | none |
| T-E435-02 | P0 | `qa-flow` part 1 of 4 (by `describe` block) | AC1, AC2 | T-E435-01 |
| T-E435-03 | P0 | `qa-flow` part 2 of 4 | AC1, AC2 | T-E435-02 |
| T-E435-04 | P0 | `qa-flow` part 3 of 4 | AC1–AC3 | T-E435-03 |
| T-E435-05 | P0 | `qa-flow` part 4 of 4 | AC1–AC3, AC5 | T-E435-04 |
| T-E435-06 | P0 | `hop-count-transitions`, `e38-next-role-lookahead`, `e151-resume-of-rejection-hint`, `visual-round-transitions`, `e128-blocked-self-loop-repro` | AC1, AC3, AC4 | T-E435-01 |
| T-E435-07 | P0 | `e431-test-first-server-path` (half 1), `gates-expected-red` | AC2, AC4 | T-E435-01 |
| T-E435-08 | P0 | `e431-test-first-server-path` (half 2), `e396-covers-expected-red` | AC2, AC4 | T-E435-07 |
| T-E435-09 | P0 | `e432-judge-report-checks`, `e433-test-first-rules` (its AC10 reads `docs/release-cd.md` release-gate lines naming both tuples → follows T-E435-42) | AC2, AC4 | T-E435-01 |
| T-E435-10 | P0 | `reviewer-completed-tasks-gate`, `e150-completed-tasks-carry-forward`, `e181-pending-notes-roundtrip`, `e139-non-reviewer-verdict`, `e247-pass-tasks-incomplete` | AC2, AC5 | T-E435-01 |
| T-E435-11 | P0 | `error-code-contract`, `e26-gate-stats`, `e308-single-source-tier-enum`, `e35-pipeline-order`, `e434-reviewer-visual` (mapping-comment test only) | AC5 | T-E435-01 |
| T-E435-12 | P0 | `handoff-migration`, `schema-versions`, `handoff-versioning`, `handoff-write-arg-guard`, `writestate-options-object` | AC4 | T-E435-01 |
| T-E435-13 | P0 | `e18-write-provenance`, `e20-e21-crash-resilience`, `drift-skew`, `e325-drift-version-peek-race`, `e312-read-path-race` | AC4 | T-E435-01 |
| T-E435-14 | P1 | `qa-review-scoped-append`, `e23-evidence-schema`, `e161-qa-suite-result`, `e236-rejected-write-evidence`, `e366-sqlite-rejected-write-evidence` | AC2, AC9 | T-E435-01 |
| T-E435-15 | P1 | `e154-multi-covers`, `e136-evidence-path-injective`, `e32-e33-gate-hardening`, `ac-execution`, `repro-first-gate` | AC2 | T-E435-01 |
| T-E435-16 | P1 | `cut-approval-gate`, `dispatch-pins`, `e114-cut-approval-inheritance`, `e116-archive-on-feature-change`, `e122-state-render-injection` | AC4 | T-E435-01 |
| T-E435-17 | P1 | `e123b9-lane-flip`, `e137-rag-render`, `e177b-lane-status`, `e178b-lane-watch`, `e178b-cut-prereview` | AC4 | T-E435-01 |
| T-E435-18 | P1 | `e183-summarize-metrics-lane`, `e223-watch-rearm-gone`, `e22-stale-notify`, `e235a-relative-prd-path` | AC4 | T-E435-01 |
| T-E435-19 | P1 | `e31-config-nonfatal`, `e92-e86-handoff-write-boundary`, `lane-migrate`, `prompt-state-footer` | AC4 | T-E435-01 |
| T-E435-20 | P1 | `rag-lifecycle`, `rag`, `success-metrics`, `stale-dispatch-detection` | AC4 | T-E435-01 |
| T-E435-21 | P1 | `visual-gate-e2e`, `visual-round-sqlite`, `visual-evidence-gate`, `pixel-gate-attestation`, `baseline-manifest-gate` (qa-PASS / qa-closing parts only; no visual counter change, E420) | AC2, AC9 | T-E435-01 |
| T-E435-22 | P1 | `pixel-perfect-design-coverage`, `pixel-perfect-visual-compare`, `qa-visual-skill-split`, `e412-qa-visual-template`, `e360-qa-visual-review-task-ids` (same limit) | AC7 | T-E435-01 |
| T-E435-23 | P1 | text pins: `e16-judge-dispatch-charter`, `e295-hop-cap-and-sop-halves`, `e393-builder-judge-core`, `e380-qa-suite-result-sop`, `skill-evolution-v3.11` | AC7 | T-E435-01 |
| T-E435-24 | P1 | text pins: `e5-intake-tiering`, `e407-restatement-citations`, `e391-prompt-audit-stale-facts`, `phase-0-5-sop`, `constitution-deliverable-guard` | AC7 | T-E435-01 |
| T-E435-25 | P1 | text pins: `token-efficiency`, `e440-current-rule-wording`, `e410-task-alias-content-tail`, `e408-core-task-alias-tail` (line-number pins only), `e438-origin-fenced-labels` | AC7 | T-E435-01 |
| T-E435-26 | P1 | adapter / `CLAUDE.md` pins: `agc-adapters`, `e395-claude-md-tail`, `e444-claude-local-adapter`, `e178a-integrator-role`, `e436-stale-handoff-paths` | AC7, AC11 | T-E435-01 |
| T-E435-27 | P1 | `subagent-templates`, `e394-release-script`, `e394-release-sop`, `e405-release-runner`, `e405-release-docs` (AC-D1 reads `docs/release-cd.md` and pins `` `(qa-engineer, PASS)` `` → re-pin to T-E435-42's wording; `e394-release-sop` and `release-staging` only name the doc as a pointer; `e405-release-workflow` names only the spec file — keep-green) | AC2, AC7 | T-E435-01 |
| T-E435-28 | P1 | `verify-release` (VR-20 is a known flake), `release-staging`, `test/eval/scenarios.mjs`, `eval-assertions`, `test/eval/lib/bundle.mjs` (as needed) | AC2, AC11 | T-E435-01 |
| T-E435-40 | P0 | snapshot (R3 (b)): 12 files under `test/fixtures/compose-golden/`, `context-budget` (six caps → measured, zero headroom, one re-baseline note each); per-hunk explanation in the test report; hygiene (`CLAUDE.md` line count, `agc check`, `dist/` scope, `npm audit`, `npm run eval`, full suite on a clean tree) | AC10, AC11 | T-E435-39 |

Keep-green constraints (no planned edit; a red here is qa's call in the nearest task): `render-structure`, `skill-frontmatter` (13 skill files, none added or removed), `e43-test-file-ask-at-dispatch`, `skill-manifest`, `compose-equivalence`, `e90-golden-capture-completeness` (these last three go green at T-E435-40).

### sr-engineer (build to the tests)

| id | P | files | AC | depends_on |
|---|---|---|---|---|
| T-E435-29 | P0 | schema 16 → 17: `schema/versions.ts`, `schema/migrations-handoff.ts`, `tools/handoff-types.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts` (drop `chain_path`, `qa_round` per OQ (a); `resume_of` type narrowed) | AC4 | T-E435-01 … 28 |
| T-E435-30 | P0 | transition table: `tools/transitions.ts` (old edges out, pm → sr rejected, qa PASS rejected naming the judge, in-flight hint, marker inputs gone), `tools/tasks.ts` (`tw_complete_task` judge unconditional) | AC1, AC2, AC3, AC9 | T-E435-29 |
| T-E435-31 | P0 | orchestrator and readers: `tools/handoff-orchestrator.ts` (marker plumbing, judge unconditional, hint wiring), `tools/evidence-file.ts`, `tools/lane-status.ts`, `scripts/release.mjs` (judge unconditional code-reviewer), `scripts/smoke-qa-flow.mjs` | AC2, AC3, AC4 | T-E435-30 |
| T-E435-32 | P0 | one commit: qa round cap and `QA_ROUND_EXCEEDED` — `gates/registry.ts`, `tools/transitions.ts`, `gates/pipeline.ts`, `content/skill-qa-engineer.md`, `content/coord-03-core-fallback.md` | AC5, AC7 | T-E435-30 |
| T-E435-33 | P0 | one commit: the two ledger codes per OQ (b) — `gates/registry.ts`, `tools/handoff-orchestrator.ts`, `content/skill-code-reviewer.md`, `content/const-08-chain-31-mid.md` | AC2, AC5, AC7 | T-E435-31, T-E435-32 |
| T-E435-34 | P1 | `qa_round` consumers per OQ (a): `tools/metrics.ts`, `tools/gate-stats.ts`, `tools/storage.ts`, `tools/storage-sqlite.ts` (no new column; AC9), `scripts/summarize-metrics.mjs` | AC4, AC9 | T-E435-29 |
| T-E435-35 | P0 | tool descriptions and prompts: `tools/registry.ts` (status, `completed_tasks`, `tw_complete_task`, `chain_path` property, `resume_of` enum), `prompts/code-reviewer.ts`, `prompts/qa-engineer.ts` / `prompts/build.ts` only if they carry old-path text | AC4, AC6, AC7 | T-E435-30 |
| T-E435-36 | P0 | content, marker and closing role: `content/const-05-core-standards.md`, `content/const-06-chain-31-head.md`, `content/coord-07-core-sop.md`, `content/skill-pm.md`, `content/skill-architect.md` | AC4, AC7 | T-E435-33 |
| T-E435-37 | P0 | templates and `CLAUDE.md`: `templates/agent-adapters/claude.md`, `templates/claude-code-agents/*` (only those with old-path text), `CLAUDE.md` (Layout rows, Execution Profile shared sentence; stamp untouched), `bin/agent-governance-context.mjs` (only if needed) | AC7, AC11 | T-E435-33 |
| T-E435-38 | P0 | docs: new `docs/migration-v5.md`, `docs/architecture.md`, `docs/schema-versions.md` (v17 row), `docs/lane-protocol.md` (only `qa_round` / qa-closing sentences), `README.md` | AC3, AC8, AC9 | T-E435-30 |
| T-E435-39 | P0 | last sr task: `specs/qa-flow-enforcement-architecture.md`; `npm run build` (`dist/**`); full suite; `npm run eval`; `node bin/agc-init.mjs check`; `npm audit --audit-level=high`; append snapshot reds to the expected-red file; then the planned R3 return to qa | AC10, AC11 | T-E435-31 … 38, T-E435-41, T-E435-42 |
| T-E435-41 | P0 | content, conditional PASS wording ("on the test-first chain `status=PASS` is server-restricted to …" → unconditional code-reviewer): `content/const-11-design-chain-32.md` (line 10), `content/constitution-rationale.md` (line 149). Split out of T-E435-36 (already 5 files); a `content/` grep for `test-first` / `chain_path` / `marker` / `unmarked` at `a1a36b2` found no other conditional site beyond T-E435-33 / 36 (the `skill-release-engineer.md:52` "terminal marker" hit is the lease marker, unrelated) | AC7 | T-E435-33 |
| T-E435-42 | P1 | `docs/release-cd.md` (lines 63, 69, 95): the release precondition names only `(code-reviewer, PASS)`; the `chain_path` / unmarked `(qa-engineer, PASS)` alternative goes. Readers: `e405-release-docs` (T-E435-27), `e433-test-first-rules` AC10 (T-E435-09) | AC7 | T-E435-31 |

Every AC has at least one sr task: AC1 → 30; AC2 → 30, 31, 33; AC3 → 30, 31, 38; AC4 → 29, 31, 34, 35, 36; AC5 → 32, 33; AC6 → 35; AC7 → 32, 33, 35, 36, 37, 41, 42; AC8 → 38; AC9 → 30, 34, 38; AC10 → 39 (with qa 40); AC11 → 37, 39.
