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

## T-E435-02 — `test/qa-flow.test.mjs` part 1 of 4

### Split (binding for T-E435-03 / 04 / 05)

`test/qa-flow.test.mjs` has **zero `describe` blocks** (top-level `test()` calls only, 152 tests at base), so the 4-way split is by the file's top-level `// ====` banner sections, named by their banner title. Each part owns every test, comment and helper inside its sections; line numbers are as at `2cb994d7` (base for T-02).

| part | task | sections (banner title) | base lines |
|---|---|---|---|
| 1 | T-E435-02 | preamble + imports + the un-bannered sections before the first banner: requireQaEngineer, validateTransition (fresh / pm / sr-qa happy path), self-loop, Blocked→Blocked self-loop (E128 a–e), round-cap override, AGENT_ID_REQUIRED, rejection envelope, ALLOWED_TRANSITIONS map, computeNewRound, v3.15.0 Round 4 sentinel, evidence-file, handoff qa_round round-trip | 1–713 |
| 2 | T-E435-03 | "T67 / AC-12 — v3.9.0 code-reviewer chain coverage"; "release-engineer is a full member of the routing chain (T-MATRIX-A5, v3.28.0)" | 714–1125 |
| 3 | T-E435-04 | "Amend-Resume edge: pm may hand back to the role it interrupted (C1-07)"; "Closed enums and the review-verdict/status consistency check (T-C9-10)" | 1126–1831 |
| 4 | T-E435-05 | "release-engineer has a legal write path in and out (T-MATRIX-C13, v3.49.0)"; "design-auditor may open the next feature after a PASS (T-E37-01, v3.94.0)"; "qa-engineer:Blocked can escape to pm:In_Progress (T-E45-01, v3.95.0)"; "release-engineer:Blocked is reachable … (T-E53-03, v3.98.0, E53)" incl. the exhaustive matrix sweep and the E128 differential | 1832–2565 |

A part whose re-pin exceeds 300 changed lines splits into `a`/`b` halves at a section boundary, recorded in its own section here (spec *Order*). Part 1 came to 299 changed lines (164+ / 135−).

Cross-part notes for T-03..05:
- **Imports**: part 1 removed the named `requireQaEngineer` import and added `import * as T from "../dist/tools/transitions.js"` — use `T.<name>` for any export E435 adds or removes (`T.oldPathStepHint`, `T.MIGRATION_HINT`, `T.JUDGE_ROLE`, …); a named import of a missing export breaks the whole file at link time.
- **Frozen copy constants** (top of part 1, reuse them): `IN_FLIGHT_HINT` (= `hint.in_flight`), `PM_TO_SR_HINT(a)` (= `hint.pm_to_sr`), `QA_JUDGE_HINT` (= `hint.qa_judge`). Not yet defined: `hint.reviewer_to_qa` (S3) — part 2 adds it next to them if it needs it.
- **`computeNewRound` signature**: every remaining call in parts 2–4 (10 calls) uses the old 11-slot order `(qa, review, visual, next, prev, notes, hop, featureChanged, qaTot, reviewTot, visualTot)`; under the new signature `(review, visual, next, prev, notes, hop, featureChanged, reviewTot, visualTot)` they throw or mis-assign, so each part re-pins its own calls and drops `qa_round` / `qa_rounds_total` from expected objects.
- **`prev_qa_round` / `qa_round`**: 73 mentions remain in parts 2–4. A stale `prev_qa_round: 0` in a request is ignored by the new contract (harmless, removing it is optional churn); assertions on `qa_round`, `QA_ROUND_EXCEEDED` or `attempted.qa_round` must be re-pinned.

### Scenario → Test Map (part 1)

| scenario | exact test name (all in `test/qa-flow.test.mjs`) |
|---|---|
| AC2 judge gate (re-pin of the 3 `requireQaEngineer` tests) | requireJudge accepts agent_id='code-reviewer' with no marker argument; requireQaEngineer is no longer exported · requireJudge rejects qa-engineer, names code-reviewer as the judge, and adds the migration hint · requireJudge rejects sr-engineer and undefined with the judge named and no migration hint |
| AC1 pm → sr (S1) | validateTransition: pm→sr-engineer REJECTED — the build entry is qa-engineer, hint names it (E435 S1) |
| AC1 legal build entry | validateTransition: pm→qa-engineer accepted with no resume_of — qa-engineer is the build entry (E435) |
| sr return edge | validateTransition: sr-engineer→qa-engineer accepted — sr-engineer returns a test to its author (E435) |
| AC2 qa PASS / FAIL (S4/S5) | validateTransition: null→(qa-engineer, PASS) REJECTED with the qa-judge in-flight hint (E435 S4) · validateTransition: sr-engineer→qa-engineer:PASS REJECTED with the qa-judge in-flight hint (E435 S4) · validateTransition: qa-engineer In_Progress→PASS REJECTED — code-reviewer is the judge (E435 S4) · validateTransition: qa-engineer In_Progress→FAIL REJECTED — code-reviewer is the judge (E435 S5) |
| legacy exit keys (DR-3), green | validateTransition: qa-engineer FAIL→sr-engineer accepted (legacy exit key) · validateTransition: qa-engineer PASS→pm accepted (legacy exit key: next feature) |
| qa cap removed (OQ (a)) | validateTransition: the qa round cap is gone — a stale prev_qa_round=4 caps nothing (E435) · validateTransition: qa-engineer PASS with a stale prev_qa_round=4 is TRANSITION_REJECTED naming code-reviewer, not QA_ROUND_EXCEEDED (E435) · T-QA-E128-01(d): both round caps dominate the new Blocked→Blocked self-loop, for all 8 roles (green) |
| envelope / table | rejection envelope carries attempted + allowed + hint, and no attempted.qa_round (E435) · ALLOWED_TRANSITIONS map has the 22 known keys, code-reviewer:PASS among them (E435) |
| computeNewRound new signature | T-QA-E128-01(e) … · computeNewRound: no qa_round / qa_rounds_total … · computeNewRound: (code-reviewer, PASS) resets review_round … · computeNewRound: (pm, In_Progress) resets both counters (re-entry) · computeNewRound: other writes hold both counters unchanged · v3.15.0 AC-11 (E435) … · v3.15.0 AC-12: review_round Round 4 cap-cross predicate fires from prev=3 (normal) |
| qa sentinel removed | v3.15.0 AC-13: review sentinel wording unchanged; the qa_round sentinel is gone (E435) |
| AC4 schema 17 drops qa_round | writeHandoffState ignores the positional qaRound slot … · writeHandoffState with qaRound omitted writes no qa_round either (E435) · parseHandoff backward-compat: missing qa_round frontmatter → no qa_round field (E435) · parseHandoff drops a legacy on-disk qa_round (negative here) instead of sanitising it (E435 v16 -> v17) |

Left as is (green on both, no old-path content): fresh-workspace / design-auditor / pm→architect edges, self-loop, E128 (a)(b)(c) (only `prev_qa_round: 0` dropped), AGENT_ID_REQUIRED, the two pure-predicate AC-11/AC-12 sentinel tests, the evidence-file `recordReviewInFile` tests (file recorder, signer passed in; not a state-write path).

### Open Interface Details (part 1)

1. `requireJudge`'s `who` keeps the base format (`"<agent>"` quoted, or `unidentified agent (agent_id not set)`); the qa-engineer message is asserted verbatim, the others by substring.
2. S1/S4/S5 hints asserted with `hint.endsWith(<step hint> + IN_FLIGHT_HINT)` (architecture: `hint = base + oldPathStepHint(...)`), not the base text, which is free to change.
3. sr→qa return asserted with `prev_sr_return_count: 0`; the forward edge is pinned as the first entry of the `sr-engineer:In_Progress` row (`{agent: "code-reviewer", status: "In_Progress"}`).
4. `computeNewRound(…, {qa-engineer, PASS})` with a non-zero review round holds it (no qa reset to own); a `code-reviewer:In_Progress → qa-engineer:In_Progress` prev no longer resets `review_round`.
5. Schema 17 write asserted at `.current/_primary/handoff.md` (where `writeHandoffState` lands in a fresh temp workspace): no `qa_round*` line, `schema_version: 17`.

### Red Reasons (part 1)

26 red at base, all assertion failures except the 6 `computeNewRound` re-pins, which throw `TypeError: Cannot read properties of undefined (reading 'agent')` because the base signature reads `next` from slot 4 (the reason is the old signature, not a syntax/link error). One line per test is in `qa_reports/expected-red_e435-remove-old-path.txt` under `# T-E435-02`. The other 126 tests in the file pass at base. Spot-run: `node --test test/qa-flow.test.mjs` → 152 tests, 126 pass, 26 fail (= the 26 manifest rows, name-for-name).

## T-E435-03 — `test/qa-flow.test.mjs` part 2 of 4

Sections: "T67 / AC-12 — v3.9.0 code-reviewer chain coverage" and "release-engineer is a full member of the routing chain (T-MATRIX-A5, v3.28.0)". 153 changed lines (76+ / 77−), no a/b split. Placement: existing file, edited in place (brief).

### Scenario → Test Map (part 2)

| scenario | exact test name (all in `test/qa-flow.test.mjs`) |
|---|---|
| S3 removed edge (re-pin of "cr→qa accepted (APPROVED handoff)") | AC-12 (E435 S3): code-reviewer:In_Progress → qa-engineer:In_Progress REJECTED — the judge closes with code-reviewer:PASS |
| sr cannot skip the review (re-pin of "removed sr→qa edge rejects") | AC-12 (E435): sr-engineer cannot skip code-reviewer — sr→code-reviewer:PASS rejected; allowed = review first, qa-engineer only as the test return |
| OQ (a) qa cap gone (re-pin of "review cap independent from qa cap") | AC-12 (E435): review_round and visual_round caps are independent; a stale prev_qa_round=4 caps nothing |
| computeNewRound new signature (4 re-pins) | AC-12 (E435): computeNewRound — (code-reviewer, FAIL) … · … a stale code-reviewer→qa-engineer prev no longer resets review_round (edge gone) · … (qa-engineer, In_Progress) from sr-engineer does NOT reset review_round · … (pm, In_Progress) resets review_round and visual_round (re-entry) |
| AC2 judge terminal step (re-pin of "qa PASS transition unaffected") | AC-12 (E435): the judge's terminal step code-reviewer:In_Progress → code-reviewer:PASS is accepted on every feature (regression guard) |
| code-reviewer:PASS row (extends "code-reviewer agent is in ALLOWED_TRANSITIONS keys") | AC-12 (E435): code-reviewer rows in ALLOWED_TRANSITIONS include the code-reviewer:PASS exit row |

Left as is (green on both): the 7 remaining AC-12(a) code-reviewer edges, REVIEW_ROUND_EXCEEDED pair, AC-12(d) review_reports evidence-file tests, the MISSING_REVIEW_EVIDENCE verbatim hint test (code unchanged, dormant per architecture), all 5 T-MATRIX-A5 tests (two comments now say `code-reviewer:PASS`). Stale `prev_qa_round: 0` dropped from all 16 requests in the part.

### Open Interface Details (part 2)

1. `REVIEWER_TO_QA_HINT` (= `hint.reviewer_to_qa`) added next to the part-1 frozen hints; S3 asserted with `hint.endsWith(REVIEWER_TO_QA_HINT + IN_FLIGHT_HINT)` and the envelope `allowed` = the new `code-reviewer:In_Progress` row in order (`FAIL`, `Blocked`, `PASS`; no Amend-Resume extra entry since next is qa-engineer).
2. The sr→qa forward-edge test now pins the full new `sr-engineer:In_Progress` row order (`code-reviewer:In_Progress`, `sr-engineer:Blocked`, `pm:In_Progress`, `qa-engineer:In_Progress`) via a `sr → code-reviewer:PASS` miss; acceptance of sr→qa itself is part 1's test.
3. `visual_round` holds on a code-reviewer FAIL (its branches key only on qa-engineer FAIL/PASS and pm re-entry — unchanged per architecture); VISUAL cap probed with `prev_visual_round: 6`.

### Red Reasons (part 2)

9 red at base: 3 assertion failures on the old table/caps (S3 edge accepted, sr row lacks qa-engineer, QA_ROUND_EXCEEDED on a stale prev_qa_round), 2 on the missing code-reviewer:PASS edge/key, 4 `computeNewRound` re-pins (2 TypeError reading 'agent', 2 deepEqual mismatch from slot mis-assignment — old signature, not a syntax/link error). Rows under `# T-E435-03` in the manifest. Spot-run: `node --test test/qa-flow.test.mjs` → 152 tests, 117 pass, 35 fail (= 26 T-02 rows + 9 T-03 rows, name-for-name).

Note for T-04/T-05: part 3 now starts 1 line earlier than the T-02 table (banner at L1154; net −1 from this task, incl. the +2-line `REVIEWER_TO_QA_HINT` const at file top). Remaining `computeNewRound` calls with the old signature: parts 3–4 only (5 calls).

## T-E435-04 — `test/qa-flow.test.mjs` part 3 of 4

Sections: "Amend-Resume edge: pm may hand back to the role it interrupted (C1-07)" and "Closed enums and the review-verdict/status consistency check (T-C9-10)". 181 changed lines (109+ / 72−), no a/b split. Placement: existing file, edited in place (brief). No `computeNewRound` calls in this part (all 5 remaining old-signature calls are in part 4).

### Scenario → Test Map (part 3)

| scenario | exact test name (all in `test/qa-flow.test.mjs`) |
|---|---|
| resume_of narrows to code-reviewer; pm→qa is ordinary (re-pin of "pm→qa accepted with resume_of: qa-engineer") | C1-07/AC-2 (E435): pm:In_Progress -> qa-engineer:In_Progress accepted with a stale resume_of: qa-engineer — the edge is ordinary, the field is irrelevant (green on both) |
| envelope `allowed` + Amend-Resume hint, code-reviewer only | C1-07/AC-3 (E435): pm:In_Progress -> code-reviewer:In_Progress REJECTED with next_resume_of absent; only the code-reviewer entry is conditional |
| AC1 legal build entry (re-pins of the two "pm→qa REJECTED" tests) | C1-07/AC-3 (E435): pm:In_Progress -> qa-engineer:In_Progress ACCEPTED with next_resume_of undefined … · C1-07/AC-3 (E435): … ACCEPTED with resume_of: code-reviewer … |
| inert legacy token (re-pin) | C1-07/c9 (E435): a legacy 'resume_of: qa-engineer' pending_notes token is inert — pm -> qa-engineer is accepted the same with or without it |
| AC-8(d) pre-existing pm targets (sr-engineer → qa-engineer) | C1-07/AC-8(d): pm:In_Progress -> qa-engineer:In_Progress still accepted WITHOUT / WITH … (2 generated tests) |
| AC1 / AC3 S1 | C1-07/AC-8(d) (E435 S1): pm:In_Progress -> sr-engineer:In_Progress REJECTED with or without a resume_of field; the hint names qa-engineer |
| OQ (a) qa cap gone (re-pin of "qa_round at cap rejects the resume edge") | C1-07 (E435): a stale prev_qa_round=4 does not cap pm -> qa-engineer — the qa round cap is gone (OQ (a)) |
| build-entry gates arm on pm→qa (re-pins of the qa resume gate-isolation test + both pm→sr positive controls) | C1-07/AC-1 positive control (E435): armed+unattested pm->qa-engineer (no resume_of) trips SCOPE_DECISION_REQUIRED … · C1-07/AC-1 (E435 S1): armed+unattested pm->sr-engineer (SAME state) is TRANSITION_REJECTED with the S1 hint, before any build-entry gate · C1-07/AC-1 positive control (E435): armed pm->qa-engineer with scope_decision set but NO cut_approved trips CUT_APPROVAL_REQUIRED |
| resume_of enum (AC4) at the zod boundary | T-C9-10/AC-2 (E435): tw_update_state rejects an out-of-enum resume_of (pm, and the pre-v5 qa-engineer) at the zod boundary |

Left as is (green on both): the code-reviewer resume accept / wrong-role / legacy-token / status-guard tests, review_round cap precedence, the code-reviewer resume gate-isolation test and the inert-token integration test, marker single-use, the next_role / review_verdict zod tests, the AC-5 verdict matrix. Re-pinned but green on both: "next status Blocked" probe moved to `code-reviewer:Blocked` with `resume_of: code-reviewer`; the T-C9-10 positive control passes `resume_of: "code-reviewer"` (the one enum value left). Stale `prev_qa_round: 0` dropped from every request in the part.

### Open Interface Details (part 3)

1. The Amend-Resume miss is asserted by the hint substring ` Amend-Resume edge: set resume_of: "code-reviewer" on this write itself` (Copy) and the absence of `IN_FLIGHT_HINT` (not an old-path step).
2. The pm→sr integration test asserts `TRANSITION_REJECTED` with no `SCOPE_DECISION_REQUIRED` (step 1 precedes step 3), plus `PM_TO_SR_HINT("pm").trim()` and `docs/migration-v5.md` in the reply text.
3. The resume_of zod rejection is read from the thrown ZodError's `issues[].message` (exact `RESUME_OF_ENUM_MESSAGE`), since the error's `.message` is JSON with escaped quotes.

### Red Reasons (part 3)

12 red at base, all assertion failures (no syntax/link error): 7 on the unmarked `pm → qa-engineer` edge still needing `resume_of: qa-engineer`, 2 on `pm → sr-engineer` still accepted (pure + integration), 1 on `QA_ROUND_EXCEEDED` from a stale prev_qa_round, 1 on the build-entry gates not arming on pm→qa (CUT_APPROVAL), 1 on the zod enum still accepting `qa-engineer`. Rows under `# T-E435-04` in the manifest. Spot-run: `node --test test/qa-flow.test.mjs` → 153 tests, 106 pass, 47 fail (= 26 T-02 + 9 T-03 + 12 T-04 rows, name-for-name).

Note for T-05: part 4 banner ("release-engineer has a legal write path in and out (T-MATRIX-C13, v3.49.0)") is now at L1897; all 5 remaining old-signature `computeNewRound` calls live there.
