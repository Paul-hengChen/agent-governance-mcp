# Tests — e435-remove-old-path

Author: qa-engineer. Contract: `specs/e435-remove-old-path.md` (ACs) + `specs/e435-remove-old-path-architecture.md` (Interface Contracts, Copy / Strings, Rulings (a) drop / (b) `NON_JUDGE_COMPLETED_TASKS_REJECTED`).

## T-E435-01

Placement: brief's `Test-file placement` line (new `test/e435-remove-old-path.test.mjs`, creation pre-authorized). Proof per AC: `node --test --test-name-pattern="^ACn" test/e435-remove-old-path.test.mjs`.

Environment probe: `better-sqlite3` binding loads in this worktree (SQLite storage constructs), so AC9 runs instead of skipping.

### Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| AC1 | test/e435-remove-old-path.test.mjs | AC1: pm:In_Progress -> sr-engineer:In_Progress is rejected on every dispatch_mode, even with a no-new-test record; the hint names qa-engineer |
| AC2 (qa PASS) | test/e435-remove-old-path.test.mjs | AC2: qa-engineer status=PASS is rejected and the message names code-reviewer as the judge |
| AC2 (qa tw_complete_task, qa completed_tasks) | test/e435-remove-old-path.test.mjs | AC2: qa-engineer cannot complete tasks: tw_complete_task and a non-empty completed_tasks are both rejected |
| AC2 (code-reviewer all three, no marker) | test/e435-remove-old-path.test.mjs | AC2: code-reviewer completes tasks, grows completed_tasks and writes PASS with no marker on the handoff |
| AC3 (removed steps get the hint) | test/e435-remove-old-path.test.mjs | AC3: on a schema 16 handoff (marker absent or present) the removed old-path steps are rejected with the docs/migration-v5.md hint |
| AC3 (legal step, no hint) | test/e435-remove-old-path.test.mjs | AC3: a legal new-chain step is accepted and gets no migration hint; the hint keys on the step only |
| AC4 (lazy migration) | test/e435-remove-old-path.test.mjs | AC4: a schema 16 handoff carrying chain_path lazily migrates to 17 with chain_path, qa_round, qa_rounds_total dropped |
| AC4 (input schema) | test/e435-remove-old-path.test.mjs | AC4: tw_update_state has no chain_path property, resume_of accepts only code-reviewer, an incoming chain_path is stripped |
| AC4 (source grep) | test/e435-remove-old-path.test.mjs | AC4: no source under tools/, gates/, schema/ (outside the migration step), scripts/release.mjs or content/ names chain_path |
| AC6 | test/e435-remove-old-path.test.mjs | AC6: status, completed_tasks and tw_complete_task descriptions name code-reviewer as the only judge, no marker conditional |
| AC7 | test/e435-remove-old-path.test.mjs | AC7: no composed prompt, hook output or shipped template describes qa-engineer as the closing role or names chain_path |
| AC8 | test/e435-remove-old-path.test.mjs | AC8: docs/migration-v5.md covers mid-flight handoffs, agent re-copy, skill-qa-visual override, the in-context wording, re-stamping and SQLite |
| AC9 | test/e435-remove-old-path.test.mjs | AC9: SQLite mode rejects pm -> sr, qa PASS, qa completed_tasks and qa tw_complete_task; code-reviewer PASS accepted; no SQLite version added |
| AC5, AC10, AC11 | — | own proof commands (re-pins in T-E435-11, snapshot T-E435-40, hygiene); not in this file |

### Open Interface Details

1. **Schema 16 fixture**: AC1/AC3/AC4 seed a raw schema 16 `handoff.md` (text captured from the base `dist/` writer, frozen in `v16Handoff()`), not `writeHandoffState`, so the fixtures survive T-E435-29 dropping the `chainPath` / `qaRound` writer options. It carries `cut_approved: true` and `scope_decision: "single-feature"` so the legal `pm -> qa-engineer` step clears the build-entry gates.
2. **Namespace import of `dist/tools/transitions.js`** (`import * as T`): `MIGRATION_HINT`, `QA_PASS_REFINE_MESSAGE`, `oldPathStepHint` do not exist at base; a named import would fail module linking and turn every test into one link error.
3. **Exact texts asserted** (architecture Copy): `MIGRATION_HINT`, `QA_PASS_REFINE_MESSAGE`, `hint.pm_to_sr` (substring of the rejection text, and `oldPathStepHint(architect -> sr) === hint.pm_to_sr("architect") + MIGRATION_HINT`), `requireJudge` message prefix for `tw_complete_task`, `RESUME_OF_ENUM_MESSAGE`, and `desc.status` / `desc.completed_tasks` / `desc.tw_complete_task` (strict equality).
4. **AC2 code-reviewer PASS**: written with `review_verdict: "APPROVED"` (architecture: APPROVED consistent with PASS), `qa_review`, `review_task_ids` and `completed_tasks: ["T-1"]` after `tw_complete_task` by code-reviewer; asserts the persisted `[status, last_agent, completed_tasks]`.
5. **AC3 steps exercised end to end**: S1 (pm -> sr), S3 (code-reviewer:In_Progress -> qa-engineer:In_Progress), S4 (qa PASS, rejected at the zod refine), each with marker absent and present; S2 and S5 through `oldPathStepHint` directly.
6. **AC4 grep**: file extensions `.ts .mts .mjs .js .md` under `tools/`, `gates/`, `schema/`, `content/`, plus `scripts/release.mjs`; `schema/migrations-handoff.ts` exempt as a whole (architecture *Data Structures*).
7. **AC7 "closing role" detector** (regex list `OLD_PATH`): `chain_path`; `resume_of: qa-engineer`; the three removed codes `QA_ROUND_EXCEEDED` / `NON_QA_COMPLETED_TASKS_REJECTED` / `REVIEWER_COMPLETED_TASKS_REJECTED`; `(qa-engineer, PASS)`; `on the test-first chain \`status=PASS\``; the old Execution Profile shape `` `qa-engineer` MUST be dispatched via `Task` …): judging in-context``. Sources: every `PROMPT_REGISTRY` entry via `buildPromptForRole(skillFile, description, ws)` (default, non-fullDetail), the SessionStart hook output, every file in `templates/agent-adapters/` and `templates/claude-code-agents/`. At base the hits are the prompts (chain_path, old codes) and `templates/agent-adapters/claude.md`.
8. **AC8 coverage terms**: `mid-flight`, `finish`, `restart`, `~/.claude/agents/`, qa-engineer + opus on one line, `qa-visual.md`, `.current/skill-qa-visual.md`, `judging in-context`, `templates/agent-adapters/claude.md`, `agc-version`, `SQLite`, `sr_return`, and one line saying the `sr_return` cap is `not enforced` in SQLite. sr's T-E435-38 wording must keep "not enforced" and "SQLite" / "sr_return" on one line.
9. **AC9**: each SQLite write re-seeds via `storage.writeState` with the prev agent; asserts pm -> sr hint, qa PASS message, `NON_JUDGE_COMPLETED_TASKS_REJECTED`, `requireJudge` text for qa `tw_complete_task`, and that a code-reviewer `In_Progress -> PASS` (APPROVED, `qa_review`, `review_task_ids`) is accepted; `CURRENT_VERSIONS.sqlite === 2`.

### Red Reasons

All 13 tests red at base (13/13 fail, assertion failures, no syntax/link error):

- AC1: pm -> sr accepted at base (`{"success":true}`).
- AC2 qa PASS: `QA_PASS_REFINE_MESSAGE` undefined.
- AC2 qa cannot complete: qa-engineer `tw_complete_task` succeeds at base.
- AC2 code-reviewer: `tw_complete_task is reserved for qa-engineer` on an unmarked feature.
- AC3 removed steps: `MIGRATION_HINT` undefined.
- AC3 legal step: unmarked pm -> qa-engineer rejected `TRANSITION_REJECTED` (needs resume_of at base).
- AC4 migration: `CURRENT_VERSIONS.handoff` is 16.
- AC4 input schema: `chain_path` property present.
- AC4 grep: `chain_path` named in `scripts/release.mjs`, `tools/*.ts`, `content/*.md`.
- AC6: status description names qa-engineer with the test-first conditional.
- AC7: prompts name `chain_path` and the old codes; `templates/agent-adapters/claude.md` old sentence.
- AC8: `docs/migration-v5.md` missing.
- AC9: SQLite pm -> sr accepted.

Spot-run unaffected: `test/e431-test-first-server-path.test.mjs` + `test/e35-pipeline-order.test.mjs` 46/46 pass. CI runnability: headless, temp dirs only, no network.
