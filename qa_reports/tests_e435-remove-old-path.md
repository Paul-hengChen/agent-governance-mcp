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

## T-E435-05 — `test/qa-flow.test.mjs` part 4 of 4

Sections: "release-engineer has a legal write path in and out (T-MATRIX-C13, v3.49.0)", "design-auditor may open the next feature after a PASS (T-E37-01, v3.94.0)", "qa-engineer:Blocked can escape to pm:In_Progress (T-E45-01, v3.95.0)", "release-engineer:Blocked is reachable … (T-E53-03, v3.98.0, E53)" incl. the exhaustive sweep and the E128 differential. 270 changed lines (142+ / 128−), no a/b split. Placement: existing file, edited in place (brief). All 5 remaining old-signature `computeNewRound` calls re-pinned to `(review, visual, next, prev)`; no old-signature call is left in the file.

### Scenario → Test Map (part 4)

| scenario | exact test name (all in `test/qa-flow.test.mjs`) |
|---|---|
| AC2: the judge's PASS opens the release / next feature (re-pins of the qa-engineer:PASS opening edges) | T-MATRIX-C13 (E435): code-reviewer:PASS → release-engineer:In_Progress accepted · T-MATRIX-C13 (E435): code-reviewer:PASS → pm:In_Progress accepted (the next feature opens from the judge's PASS) · T-MATRIX-C13 (E435): code-reviewer:PASS → researcher:In_Progress accepted · T-E37-01 (E435): code-reviewer:PASS → design-auditor:In_Progress accepted |
| new code-reviewer:PASS key + legacy qa-engineer:PASS exit key (DR-3) | T-MATRIX-C13/E37 (E435): code-reviewer:PASS and the legacy qa-engineer:PASS exit key both list exactly {pm, researcher, release-engineer, design-auditor} |
| computeNewRound new signature (5 calls in 3 tests) | T-MATRIX-C13 (E435): computeNewRound holds review_round/visual_round steady across code-reviewer:PASS → release-engineer:In_Progress · T-MATRIX-C13 (E435): computeNewRound re-zeros both counters on release-engineer:In_Progress → pm:In_Progress · T-E37-01 (E435): computeNewRound holds review_round/visual_round steady across code-reviewer:PASS → design-auditor:In_Progress |
| FAIL rows not widened (judge FAIL + legacy qa FAIL) | T-E37-01 (E435): code-reviewer:FAIL → design-auditor:In_Progress REJECTED; the legacy qa-engineer:FAIL exit key stays unwidened (E38 deferral pin) |
| AC2/AC3 S4/S5 + new qa row | T-E45-01 (regression pin, E435): qa-engineer:In_Progress row admits only qa-engineer:Blocked and the sr-engineer hand-off — no PASS/FAIL, no direct pm entry |
| OQ (a) qa cap gone | T-E45-01 (regression pin, E435): a stale prev_qa_round=4 no longer caps qa-engineer:Blocked → sr-engineer:In_Progress — the qa round cap is gone (OQ (a)) |
| whole-table pin (22 keys) | T-E53-03(h) (E435): exhaustive matrix sweep — accepted edge set is EXACTLY the 81 tuples … · T-QA-E128-01(f) (E435): differential — … the 7 Blocked self-loops plus the 10 E435 edges, and the only removals are the 5 E435 old-path edges |

Left as is (green on both): release-engineer closing edge, the two release-engineer rejection/no-wedge tests, the release-engineer:In_Progress row pin, qa-engineer:Blocked → pm accept and row pin, REVIEW/VISUAL cap pins, both E38 lookahead tests, T-E53-03(a)–(g). Stale `prev_qa_round: 0` dropped from every request in the part (incl. the sweep).

### Open Interface Details (part 4)

1. The sweep keeps `E53_BASELINE_69` as the historical literal and adds `E435_REMOVED_5` (pm→sr, architect→sr, code-reviewer→qa, qa:IP→qa:PASS, qa:IP→qa:FAIL) and `E435_ADDED_10` (pm→qa, architect→qa, sr→qa, qa:IP→sr, code-reviewer:IP→code-reviewer:PASS, code-reviewer:FAIL→qa, code-reviewer:PASS→{pm, researcher, release-engineer, design-auditor}), derived from the architecture's 22-key table; 69 + 7 − 5 + 10 = 81. The sweep passes no `prev_sr_return_count`, so the sr-return cap does not fire on sr→qa.
2. `computeNewRound` with prev `code-reviewer:PASS` holds both counters (the reset branch keys on next = code-reviewer PASS, not prev).
3. The code-reviewer:FAIL envelope `allowed` order follows the architecture row: sr-engineer, pm, qa-engineer.

### Red Reasons (part 4)

13 red at base, all assertion failures (no syntax/link error): 6 on the missing code-reviewer:PASS key/edges, 3 on the old `computeNewRound` signature (qa_round keys / slot mis-assignment), 1 on the code-reviewer:FAIL row lacking qa-engineer, 1 on the old qa-engineer:In_Progress row, 1 on QA_ROUND_EXCEEDED from a stale prev_qa_round, 2 on the sweep (76 at base vs 81). Rows under `# T-E435-05` in the manifest. Spot-run: `node --test test/qa-flow.test.mjs` → 153 tests, 93 pass, 60 fail (= 26 T-02 + 9 T-03 + 12 T-04 + 13 T-05 rows, name-for-name).

Residual old-path grep over the whole file (`chain_path|test-first|qa_round`): no `chain_path` / `test-first`; every remaining `qa_round` mention is an absence assertion, a stale-input-ignored probe (`prev_qa_round: 4` → no cap), a comment, or one of part 1's two untouched pure-predicate AC-11 sentinel tests. No test asserts a qa-engineer PASS/FAIL write or completion as accepted; `qa-engineer:PASS` / `:FAIL` appear only as legacy exit keys (prev side).

## T-E435-06 — transition-table re-pins (hop-count, e38, e151, e128; visual-round deferred)

Placement: existing files, edited in place (brief). 294 changed lines (152+ / 142−) over 4 files. **`test/visual-round-transitions.test.mjs` deferred**: its re-pin (computeNewRound signature in 8 tests, `qa_round` asserts out, AC-11 return shape without `qa_round` / `qa_rounds_total`, stale `prev_qa_round` out of 4 requests; ≈ 56 lines, 9 reds) took the total to 350, over the 300 cap, so it stops at that file boundary; it needs a follow-up task (no other test in the five depends on it). The visual-round counting behaviour stays untouched there (E420).

### Scenario → Test Map (T-06)

| scenario | file | exact test name(s) |
|---|---|---|
| AC4 computeNewRound without the qa slot / qa_round (signature re-pins, behaviour unchanged) | hop-count-transitions | t-compute-role-transition-increments … (E435) · t-compute-first-write-counts … (E435) · t-compute-self-loop-holds … (DR-9, E435) · t-compute-same-agent-status-change-holds … (E435) (now code-reviewer IP → FAIL) · t-compute-feature-reset … (AC-3, E435) (prev code-reviewer:PASS) · t-compute-pm-no-reset … (DR-6, E435) (asserts no qa_round key) · t-compute-persists-across-many-non-role-writes … (E435) · t-gate-landing-from-reviewer-and-qa (E295 AC2, E41, E435) … |
| AC4 qa cap gone (OQ (a)) | hop-count-transitions | t-precedence-review-round-wins (E435) … (re-pin of t-precedence-qa-round-wins) · t-precedence-existing-round-caps-untouched (E435) … |
| AC1 old edges avoided in e2e set-ups (green on both) | hop-count-transitions | t-e2e-* climb bounces pm ↔ architect (was pm ↔ sr-engineer); t-crash-file seeds pm → architect → pm, post-crash write architect |
| judge FAIL/PASS rows (AC2 support), new qa row | e38-next-role-lookahead | L1 (E435) … · S-E37-lo (E435) … · S-E37-hi (ROUND-1 REGRESSION PIN, E435) … · R-QA-IP (ROUND-2 REGRESSION PIN, E435) … |
| review cap lookahead (re-pin of qa cap), self-loop, never-reject, E28 coexist — green on both | e38-next-role-lookahead | S-ROUNDCAP (E435) … · S-SELFLOOP (E435) … · N-NEVERREJECT (E435) … · C-E28COEXIST (E435) … |
| AC1 pm row + one conditional entry; AC3 S1/S4 hint on old steps, none on others | e151-resume-of-rejection-hint | AC9 (E435) … · AC11 (E435) … · AC12 (E435) … · AC13 (E435) … · AC14 (E435) … |
| TransitionRequest without prev_qa_round (green on both) | e128-blocked-self-loop-repro | E128 repro: release-engineer:Blocked -> release-engineer:Blocked is accepted (the incident case, fixed) (request now carries prev_review_round) |

Left as is (green on both): hop t-const, t-gate-* (stale `prev_qa_round: 0` dropped), t-precedence-visual-round-wins (legacy qa-engineer:FAIL exit key as prev), the SQLite crash pair, writeHandoffState round-trips, the negative-hop sanitiser; e38 S-RESUME, R-PM-BLOCKED; e151 AC10.

### Open Interface Details (T-06)

1. Frozen copy constants copied into `e151` (same pattern as `qa-flow.test.mjs` top of file, not imported): `IN_FLIGHT_HINT`, `PM_TO_SR_HINT(a)`, `QA_JUDGE_HINT`. Old-step hints asserted as exact `No edge … ${HINT_STATIC}${stepHint}${IN_FLIGHT_HINT}` (architecture: `hint = base + oldPathStepHint`), so e151 pins the base text too, as it did before.
2. e151 AC11's wrong-role case keeps a direct `next_resume_of: "qa-engineer"` on pm → code-reviewer (pure call; the zod boundary rejects it on the tool path) and expects the code-reviewer Amend-Resume hint with `received resume_of: "qa-engineer"`.
3. e38 S-E37 writes `code-reviewer:PASS` with no `review_verdict` / `qa_review` (same bare shape the qa PASS had); if sr's PASS gates need more on a bare workspace, that is a test set-up question to raise, not a contract change.
4. e38 R-QA-IP seeds `sr-engineer:In_Progress` (the sr → qa test return, `sr_return_count` 0) rather than pm → qa, to keep build-entry gates out of the lookahead probe.
5. hop e2e climbs use pm ↔ architect (both legal on both tables, build-entry gates cleared by `cut_approved: true` on each pm write), so they stay green across the change instead of going red on the removed pm → sr edge.

### Red Reasons (T-06)

19 red at base, all assertion failures or the old-signature TypeError (no syntax/link error): hop 10 (8 old computeNewRound signature, 2 QA_ROUND_EXCEEDED on a stale prev_qa_round), e38 4 (code-reviewer:FAIL row lacks qa-engineer; code-reviewer PASS ZodError on an unmarked feature ×2; sr → qa rejected unmarked), e151 5 (old pm row / qa conditional entry / no old-step hint / pm → qa needs resume_of). Rows under `# T-E435-06` in the manifest. Spot-run of the five files: 59 tests, 40 pass, 19 fail (= the 19 T-06 rows, name-for-name; visual-round 15/15 and e128 1/1 green, unchanged).

## T-E435-43 — visual-round-transitions re-pin (deferred from T-E435-06)

Placement: existing file `test/visual-round-transitions.test.mjs`, edited in place (brief). The visual-round counting rules are not changed (E420): each test keeps its counter inputs and expectations, and only the call shape moves.

### Scenario → Test Map (T-43)

| scenario | file | exact test name(s) |
|---|---|---|
| AC4 computeNewRound without the qa slot, no `qa_round` in the result | visual-round-transitions | AC-8: (qa-engineer, FAIL) + visual_fail: token → visual_round increments (E435) · AC-8: (qa-engineer, FAIL) without visual_fail: → visual_round held (E435) · AC-8: (qa-engineer, FAIL) + visual_fail: increments from prior count (E435) · AC-8: (qa-engineer, PASS) resets visual_round to 0 (E435) · AC-8: (pm, In_Progress) resets visual_round to 0 (PM re-entry) (E435) · AC-8: other writes hold visual_round unchanged (E435) · AC-11: visual_fail token detection is whitespace-robust (E435) · AC-11: visual_fail token NOT confused with substring matches (E435) |
| AC4 return shape without `qa_round` / `qa_rounds_total` (OQ (a) drop) | visual-round-transitions | AC-11: pre-v3.14 callers (no prev_visual_round) work unchanged (backwards compat) (E435): `{ review_round: 1, visual_round: 0, hop_count: 1, review_rounds_total: 0, visual_rounds_total: 0 }` |
| AC1 TransitionRequest without `prev_qa_round` (green on both) | visual-round-transitions | AC-8: visual_round >= cap → only (pm, In_Progress) is accepted · AC-8: visual_round at cap allows (pm, In_Progress) · AC-9: at visual_round=3, (sr-engineer → pm, In_Progress) is accepted · AC-9: split escalation also allowed at rounds 4 and 5 (Round 3-5 window): stale `prev_qa_round: 0` removed from the 4 requests |

Left as is (green on both): AC-8 VISUAL_ROUND_CAP exported as 6. The prev tuples `qa-engineer:FAIL` in the two cap tests stay: the cap check runs before the table lookup, and the visual family belongs to E420.

### Open Interface Details (T-43)

1. Brief said "8 tests" for the signature re-pin; the file has 9 computeNewRound callers (8 AC-8/AC-11 behaviour tests plus the AC-11 shape test), all moved to the new signature. Red count 9.
2. The two AC-8 FAIL tests that asserted `qa_round === 1` now assert `"qa_round" in result === false` (same pattern as hop t-compute-pm-no-reset).

### Red Reasons (T-43)

9 red at base, all with the old-signature TypeError `Cannot read properties of undefined (reading 'agent')` (the new call puts `next` in the old prev_visual_round slot, so the old `next` slot is undefined). No syntax or link errors. Rows under `# T-E435-43` in the manifest. File run: 14 tests, 5 pass, 9 fail = the 9 T-43 rows, name for name.

## T-E435-07 — `test/e431-test-first-server-path.test.mjs` half 1, `test/gates-expected-red.test.mjs`

### Split (binding for T-E435-08)

`e431-test-first-server-path.test.mjs` has no `describe` blocks; it splits at its `// ---- ACn` banners (line numbers at `5fdb7b45`, base for T-07):

| half | task | blocks | base lines |
|---|---|---|---|
| 1 | T-E435-07 | header comment, imports, helpers (`mkWs`, `seed`, `upd`, `state`, `handoffBytes`, `envelope`, `recordNoNewTest`, `w`), AC1 – AC11 (incl. `EXIT_ROLES` and the AC11 per-role loop) | 1–472 |
| 2 | T-E435-08 | AC12 (`NOTHING_NEW`, 4 tests), AC13, AC14 (`ledgerWs`), AC15, AC16, AC17 (×2), AC18 (SQLite), OVERLAY (`parseOverlayTable`) | 473–816 (now 518–861) |

Changed lines: e431 half 1 = 277 (161+ / 116−), gates-expected-red = 22 (16+ / 6−); 299 total. Half 2 is untouched.

Notes for T-08:
- **Imports**: half 1 replaced the named `transitions.js` import with `import * as T` and `const { validateTransition, HOP_CAP_EXPORTED, SR_RETURN_CAP_EXPORTED, TEST_FIRST_OVERLAY } = T;` so half 2 still links. `TEST_FIRST_OVERLAY` is `undefined` after the build (OVERLAY test re-pin is T-08's); use `T.<name>` for E435 exports.
- **Shared helpers half 1 added**: frozen `IN_FLIGHT_HINT`, `PM_TO_SR_HINT(a)`, `QA_JUDGE_HINT`, `REVIEWER_TO_QA_HINT`, `QA_PASS_TAIL`, `RESUME_OF_TAIL`; `noMarkerOnDisk(ws)`; `writeV16Marked(ws, agent, status)` (frozen schema 16 text with `chain_path: "test-first"`, `qa_round: 2`, `qa_rounds_total: 3`). `rejected()` also counts a `❌` prefix.
- `seed(..., { chainPath })`: the writer option goes in T-E435-29; for an on-disk marker use `writeV16Marked`.
- Half 2 at base still has `prev_qa_round` / `prev_chain_path` requests (AC12 closed-edge list, AC13, AC17), `qa_round` asserts (AC12), the old `tw_complete_task` texts (AC14), the two removed codes (AC15), `CURRENT_VERSIONS.handoff === 16` (AC16), registry 35 / step-9 name (AC17), the SQLite marker-ignored test (AC18).

### Scenario → Test Map (T-07)

| scenario | file | exact test name(s) |
|---|---|---|
| AC4 marker gone: stripped, never stored (was "set the marker") | e431 | AC1 (E435): pm -> qa-engineer (no resume_of, no marker) then qa-engineer -> sr-engineer both accepted; a chain_path carried on input is stripped, not stored · AC10 (E435): a chain_path carried on any write is stripped — never stored, never carried; a feature change stores none either · AC10 (E435): chain_path carried mid-chain is ignored: sr -> code-reviewer accepted and stores none; code-reviewer -> qa-engineer rejected with the S3 hint, no state written · AC11 (E435): feature-change write out of code-reviewer:PASS that carries chain_path is accepted for all four roles, the marker stripped |
| AC4 in-flight v16 marked feature (lazy migration on the chain) | e431 | AC9 (E435): an in-flight schema 16 marked feature at pm:In_Progress moves to qa-engineer with no resume_of; the write stores schema 17 with no marker |
| new chain unconditional (marked set-ups now seed no marker) | e431 | AC2 (E435): … S1/S2 hint · AC3: ledger completed by code-reviewer via tw_complete_task, … · AC5 · AC6 · AC7 (titles unchanged, marker dropped from the seeds) · AC8 (E435) EXTERNAL_REFS / SCOPE_DECISION / SOURCE_CREDIBILITY (no marker) · AC9 (E435): pm -> qa with neither marker nor resume_of is accepted; … · AC11 (E435) code-reviewer:PASS exits, validateTransition feature change, per-role handler loop (×4) |
| AC2 judge (qa PASS rejected naming code-reviewer) | e431 | AC3 (E435): code-reviewer:In_Progress -> code-reviewer:PASS passes the transition check with no marker; qa-engineer:PASS gets the S4 hint · AC4 (E435): qa-engineer PASS is rejected naming code-reviewer, no state written (from qa and from code-reviewer) |
| AC2 judge (old "unmarked keeps old behaviour" → rejection / legacy exits) | e431 | AC8 (E435): pm -> qa without cut_approved rejected CUT_APPROVAL_REQUIRED; a carried chain_path neither exempts nor is stored · AC8 (E435): unapproved pm -> qa carrying resume_of: qa-engineer is rejected at the tool boundary (the hand-back exemption is gone), no state written · AC11 (E435): code-reviewer PASS with no marker is accepted (was rejected unmarked); the legacy qa-engineer:PASS / qa-engineer:FAIL keys still exit (DR-3) |
| AC2 judge on the evidence gate | gates-expected-red | I1, I2, I4 (names unchanged; PASS now by code-reviewer from code-reviewer:In_Progress) · I3: … ; a qa-engineer PASS is rejected naming code-reviewer (E435) |

Left as is (green on both): gates-expected-red U1–U13, I5, I5b (predicates and source guards, no writer identity).

### Open Interface Details (T-07)

1. Tool-boundary messages (`QA_PASS_REFINE_MESSAGE`, `RESUME_OF_ENUM_MESSAGE`) asserted by their quote-free tails (`QA_PASS_TAIL`, `RESUME_OF_TAIL`) plus `docs/migration-v5.md`: the `upd()` helper surfaces a thrown ZodError's `err.message`, which is the JSON issue list, where `"` is escaped (seen at base: `status=\"PASS\" requires agent_id=\"qa-engineer\"`). Full-string equality is T-01's AC2.
2. Old-step hints asserted with `envelope(r).hint.endsWith(<step hint> + IN_FLIGHT_HINT)` (same as qa-flow part 1).
3. gates-expected-red I3's qa probe goes through `handleUpdateState` (no zod), so it hits the orchestrator's defence-in-depth `requireJudge(…, "tw_update_state(status=PASS)")`; asserted by the substring `reserved for code-reviewer, the chain's judge`.
4. AC11 legacy exits are pinned on `validateTransition` (qa-engineer:PASS → pm / release-engineer on a feature change, qa-engineer:FAIL → sr-engineer / pm); green at base too, they ride in the red AC11 test whose first half is the inverted code-reviewer PASS.

### Red Reasons (T-07)

29 red at base, all assertion failures (no syntax / link error): e431 25 (unmarked table lacks the new edges / code-reviewer:PASS key; carried `chain_path` stored; `resume_of: qa-engineer` valid; qa-engineer PASS and `tw_complete_task` accepted; schema 16), gates-expected-red 4 (code-reviewer PASS rejected by the orchestrator's ZodError `requires agent_id="qa-engineer"` on an unmarked feature). Rows under `# T-E435-07` in the manifest. Run: `node --test test/e431-test-first-server-path.test.mjs test/gates-expected-red.test.mjs` → 58 tests, 29 pass, 29 fail = the 29 rows, name for name (half 2: 14 tests, all green, untouched; gates U1–U13, I5, I5b green).

## T-E435-08 — `test/e431-test-first-server-path.test.mjs` half 2, `test/e396-covers-expected-red.test.mjs`

Placement: existing files, edited in place (brief). Half 2 per the T-07 split (AC12–AC18 + OVERLAY, L518–end); half 1 untouched. Changed lines: e431 254 (157+ / 97−), e396 37 (25+ / 12−); 291 total. Every test keeps its AC id; titles carry `(E435)`.

### Scenario → Test Map (T-08)

| scenario | file | exact test name(s) |
|---|---|---|
| one chain, counters (re-pin of "old chain … unchanged"); S1/S3 hints | e431 | AC12 (E435): the one chain pm -> qa -> sr -> code-reviewer -> code-reviewer PASS keeps its counters; … |
| architect variant + code-reviewer FAIL loop (re-pin of the qa FAIL loop); S5 | e431 | AC12 (E435): pm -> architect -> qa -> sr variant and the code-reviewer FAIL -> sr loop keep their counters; a qa-engineer FAIL is rejected with the S5 hint |
| bugfix + code-reviewer Amend-Resume; AC4 dropped fields | e431 | AC12 (E435): bugfix-mode run and the code-reviewer Amend-Resume behave as before, storing no dropped field |
| test-first edges open with no marker; S1–S5 closed with hints (re-pin of "new edges closed unmarked") | e431 | AC12 (E435): every test-first edge is open with no marker; the five removed old-path steps S1-S5 are closed with their hints |
| bugfix repro + code-reviewer PASS transition, no marker | e431 | AC13 (E435): … |
| AC2 tw_complete_task (Copy `requireJudge`, + in-flight hint for qa only) | e431 | AC14 (E435): code-reviewer completes the task; qa-engineer rejected … · AC14 (E435): another role (sr-engineer) is rejected … no migration hint … |
| AC2 completed_tasks, Ruling (b) `NON_JUDGE_COMPLETED_TASKS_REJECTED` | e431 | AC15 (E435): code-reviewer completed_tasks allowed, qa-engineer's rejected … · AC15 (E435): a non-empty completed_tasks from sr-engineer or pm is rejected … |
| AC4 schema 17, Ruling (a) drop | e431 | AC16 (E435): a v15 handoff migrates to schema 17: … |
| registry 33 / pipeline 17, step 9 renamed; sr-return cap unconditional | e431 | AC17 (E435): registry has 33 entries … · AC17 (E435): hop cap 14 outranks the sr-return cap, which applies with no marker |
| OQ (d) SQLite runs the one chain | e431 | AC18 (E435): SQLite/HTTP mode runs the one chain: … |
| one 22-key table (re-pin of the overlay mirror) | e431 | OVERLAY (E435): one 22-key ALLOWED_TRANSITIONS equals the frozen contract table in order, … |
| AC2 judge on the covers:/expected-red evidence path | e396 | E396 I: … (code-reviewer the judge; a qa-engineer PASS is rejected naming code-reviewer, E435) |

Left as is (green on both): e396 U1, U2 (predicate only, no writer identity).

### Open Interface Details (T-08)

1. OVERLAY freezes the architecture's 22-key table as `TABLE_22` and pins `T.ALLOWED_TRANSITIONS` to it entry for entry, in order; the doc mirror (`## ALLOWED_TRANSITIONS Matrix`) is compared per key as a sorted set (the `check-transitions-sync` semantics), plus the two `### Opened/Closed on a test-first feature` headings absent (T-39).
2. `NON_JUDGE_COMPLETED_TASKS_REJECTED` asserted by the emit prefix `⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks=` plus the full Copy `hintStatic` (frozen `NON_JUDGE_HINT`); AC17 pins the registry entry's `hintStatic` to the same constant.
3. `tw_complete_task` texts: `Called by "<agent>"` keeps today's quoted form; the in-flight hint is appended for `qa-engineer` only (Copy `requireJudge`).
4. e396 I: a shared `passFrom(agent)` seeds `<agent>:In_Progress` and writes the PASS; it now also asserts the code-reviewer PASS is accepted (at base the qa PASS was fully accepted, probed), so the test cannot pass vacuously on a rejection that merely lacks `EXPECTED_RED_DIFF_MISSING`.
5. AC12's one-chain run uses `recordNoNewTest` for the qa → sr hand-off and a code-reviewer PASS with `review_verdict: "APPROVED"`, `completed_tasks` and `qa_review` (evidence via `QA_REVIEW_RECORD`).

### Red Reasons (T-08)

15 red at base, all assertion failures (no syntax / link error): e431 half 2 all 14 (unmarked new edges rejected; `qa_round` stored; `tw_complete_task` / ledger texts name qa-engineer and the old codes; schema 16; registry 35; overlay still exported, 21-key table), e396 I (code-reviewer PASS rejected by the orchestrator's ZodError). Rows under `# T-E435-08` in the manifest. Run: `node --test test/e431-test-first-server-path.test.mjs test/e396-covers-expected-red.test.mjs` → 42 tests, 2 pass, 40 fail = the 40 rows for these two files (25 T-07 + 15 T-08), name for name.

## T-E435-09a — `test/e432-judge-report-checks.test.mjs` (half a; half b = `test/e433-test-first-rules.test.mjs`, not written)

Placement: existing file, edited in place (brief). Split at the file boundary: e432 alone is 300 changed lines (136+ / 164−), so e433 is half b (see *Remaining* below). Re-titled tests carry `(E435)`.

### Scenario → Test Map (T-09a)

| scenario | exact test name(s) |
|---|---|
| AC2 judge on the evidence gates, no marker (seeds drop `chainPath`) | AC1 (E435): code-reviewer PASS with no marker accepted … · AC2 (E435): code-reviewer PASS (no marker) with no judge report … · AC3: expected-red and AC execution sections are read from the judge report (title unchanged, seed unmarked) |
| AC2/AC4 resolver one-arg, judge code-reviewer | AC3 (E435): the resolver takes the workspace only and always names code-reviewer under qa_reports/; … |
| AC2 ledger, Ruling (b) | AC4 (E435): a judge write that adds completed ids needs the judge report (no marker); a qa-engineer ledger write is NON_JUDGE_COMPLETED_TASKS_REJECTED |
| qa → sr hand-off rule unconditional | AC5 (E435) · AC6 (E435) · AC7 (E435) |
| drift reads the judge report, no marker; review_reports/ backs nothing (was "drifts exactly as base") | AC8 (E435) ×2 |
| release judge `(code-reviewer, PASS)` only (precondition, `--state`, commit message) | AC10 (E435) ×3 |
| one chain (base replays → direct per-write outcomes; `MISSING_REVIEW_EVIDENCE` scenario → `reviewerToQaClosed`, S3 hint, gate dormant) | AC11 (E435): `<scenario>` runs on the one chain with code-reviewer the judge, no marker ×11 |
| AC9 SQLite, one judge, no SQLite schema change | AC12 (E435): SQLite runs the evidence gates with code-reviewer the judge; … |
| registry 33, step 9 renamed, handoff 17 | AC14 (E435): registry 33, pipeline 17 (base names and order, step 9 renamed), … |

Left as is (green on both): AC9 ×2 (lane-status; `REPORT_SIGNERS` keeps qa-engineer for pre-v5 reports, DR-6), AC13 (one resolver, consumers import it).

### Open Interface Details (T-09a)

1. Release texts keep today's format with the judge substituted: `is (<agent>, <status>), expected (code-reviewer, PASS) — commit the release gate's (code-reviewer, PASS) write to main first`, `--state must be a (code-reviewer, PASS) snapshot with an active_feature (got …)`, `Release gate: <feature> (code-reviewer PASS committed to main).` (architecture: `RELEASE_JUDGE` is the default of `notPass` / `commitMessage`). A stale `chain_path` in a schema 16 handoff or a `--state` snapshot changes nothing.
2. AC11 drops the base-commit byte replay (the old chain is rejected by design); each scenario asserts its own per-write outcome table (`EXPECT`) plus no `chain_path` / `qa_round` / `qa_rounds_total` line in the stored handoff. `QA_COMPLETION_EVIDENCE_MISSING` hint asserted verbatim (Copy) in AC4.
3. AC12: base replay → direct asserts; `tools/storage-sqlite.ts` byte-identity → its DDL (`CREATE TABLE … );` blocks and `addColumnIfMissing("…")` lines) equal to base (architecture: DDL untouched, upsert changes); `schema/migrations-sqlite.ts` stays byte-identical. Reports row `reviewer` = `code-reviewer`.
4. AC14: step names = base names with index 8 replaced by `NON_JUDGE_COMPLETED_TASKS_REJECTED`; CLAUDE.md 250-line pin left to T-E435-40.

### Red Reasons (T-09a)

24 red at base, all assertion failures (no syntax / link error): unmarked code-reviewer PASS rejected by the orchestrator ZodError; unmarked qa → sr and pm → qa `TRANSITION_REJECTED`; `REVIEWER_COMPLETED_TASKS_REJECTED` emitted; resolver / release judge qa-engineer unmarked; `qa_round` stored; registry 35 / handoff 16. Rows under `# T-E435-09a` in the manifest. Run: `node --test test/e432-judge-report-checks.test.mjs` → 29 tests, 5 pass, 24 fail = the 24 rows, name for name.

### Remaining — half b (`test/e433-test-first-rules.test.mjs`, AC10 follows T-E435-42)

Planned re-pins (≈ 60 changed lines): AC1 forbidden list + `chain_path`; AC2 (a) const-06 line 7 → Copy text `` - `status=PASS` and `tw_complete_task` require the chain's judge, `agent_id="code-reviewer"`. ``; AC3 skill-qa-engineer line 13 tail / line 31 Copy texts, no `qa_round` / `QA_ROUND_EXCEEDED` / `chain_path`; AC5 no "**The marker**" bullet / `REVIEWER_COMPLETED_TASKS_REJECTED`; AC6 skill-pm step 8 without `, chain_path="test-first"` and without the "Set the marker" sentence, bugfix without "(with the `chain_path` marker)", skill-architect `` (`architect → sr-engineer` is not an edge) ``, coord-07 mini-chain without the marker clause; AC9 / AC12 live `GATE_REGISTRY.length` 33 (closed-range parts unchanged); AC10 the three `docs/release-cd.md` lines (63, 69, 95) pinned to the architecture's exact texts, `COPY.releaseGate` absent. Open question for half b: none so far — every text is given verbatim by the architecture Copy table (deletions derive the remaining text).
