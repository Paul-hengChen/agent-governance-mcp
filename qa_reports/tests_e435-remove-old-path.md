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

## T-E435-44 (= T-E435-09b) — `test/e433-test-first-rules.test.mjs` (AC2, AC4, AC7)

Placement: existing file, edited in place (brief). Followed the T-09a *Remaining* plan. Re-titled tests carry `(E435)`. 90 changed lines (66+ / 24−).

### Scenario → Test Map (T-44)

| scenario | exact test name(s) |
|---|---|
| no marker / `qa_round` / `QA_ROUND_EXCEEDED` / `REVIEWER_COMPLETED_TASKS_REJECTED` in any served bundle (forbidden list) | AC1 (E435): composed `<role>` prompt carries chain.main, no forbidden old-judge or marker string, … ×5 |
| const-06 line 7 = Copy (T-36) | AC2 (E435): constitution fragments — … (a) |
| skill-qa-engineer line 13 tail / line 31 = Copy (T-32), no `qa_round` / `QA_ROUND_EXCEEDED` / `chain_path` | AC3 (E435): skill-qa-engineer.md alone makes qa the test author … |
| no "**The marker**" bullet, no `REVIEWER_COMPLETED_TASKS_REJECTED` (T-33) | AC5 (E435): skill-code-reviewer.md is the chain's judge … |
| skill-pm step 8 / Set-the-marker / bugfix clause gone; skill-architect Copy; coord-07 mini-chain without the marker (T-36) | AC6 (E435): pm routes architect or qa-engineer with no marker, … |
| live registry 33 (closed range unchanged) | AC9 (E435) · AC12 (E435) |
| `docs/release-cd.md` lines 63 / 69 / 95 = Copy (T-42), two-judge wording absent | AC10 (E435): README / architecture / release-cd — … one-judge release gate wording |

Left as is: AC4, AC7, AC8, AC13 (no old-path content). CLAUDE.md 250-line pin and `agc check` in AC12 left to T-E435-40.

### Open Interface Details (T-44)

1. Deletion-only texts with no Copy wording (skill-pm bugfix clause, coord-07 mini-chain) are pinned as absence of the old clause plus the unchanged surrounding fragments, never an invented joined sentence. skill-pm step 8 pins `next_role="architect" or "qa-engineer", pending_notes=[...])` (the Copy deletion of `, chain_path="test-first"` derives it exactly).
2. Line 95 is pinned as the `PRECONDITION_NOT_PASS` row's meaning cell equal to the Copy text, not by line number; lines 63 / 69 as whole lines of the file.
3. AC1's `qa_round` absence also covers the rendered handoff data block (schema 17 drops the field, OQ (a) ruling).

### Red Reasons (T-44)

12 red at base, all assertion failures: AC1 ×5 `chain_path` in the composed bundle; AC2 const-06 line 7 marker condition; AC3 qa SOP line 13 / 31; AC5 "The marker" bullet; AC6 pm step 8 marker argument; AC9 / AC12 registry 35; AC10 release-cd two-judge lines. Rows under `# T-E435-44` in the manifest. Run: `node --test test/e433-test-first-rules.test.mjs` → 16 tests, 4 pass, 12 fail = the 12 rows, name for name. T-E435-09 (a + b) is complete.

## T-E435-10 (part 1 of 2) — `test/reviewer-completed-tasks-gate.test.mjs`, `test/e181-pending-notes-roundtrip.test.mjs` (AC2, AC5)

Placement: existing files, edited in place (brief). Re-titled tests carry `(E435)`. Split at a file boundary: these two files are 226 changed lines (100+ / 126−); `e150-completed-tasks-carry-forward`, `e139-non-reviewer-verdict`, `e247-pass-tasks-incomplete` are part 2 (see *Remaining* below).

### Scenario → Test Map (T-10, part 1)

| scenario | exact test name(s) |
|---|---|
| Ruling (b): the judge is the ledger writer; its unevidenced id → `QA_COMPLETION_EVIDENCE_MISSING`, with its report the id lands | FM1 (E435): a code-reviewer write carrying completed_tasks is never NON_JUDGE_COMPLETED_TASKS_REJECTED; … |
| code-reviewer → qa-engineer is not an edge (S3 hint `hint.reviewer_to_qa`) | FM4 (E435): a qa-engineer write after code-reviewer:In_Progress is TRANSITION_REJECTED with the judge hint, … |
| the judge's APPROVED write keeps review scope out of the ledger | FM5 (E435): the judge's APPROVED write with review_task_ids and its report present is ACCEPTED, … |
| step 9 exact emit + Copy hintStatic for every non-judge `agent_id`, qa-engineer included (AC2) | FM6–FM12 (E435): agent_id="<role>" self-loop carrying non-empty completed_tasks is REJECTED with NON_JUDGE_COMPLETED_TASKS_REJECTED, … |
| bypass: non-judge prefill rejected at write 1; the judge's unevidenced write 2 still refused | BYPASS-FM (E435) |
| AC9 SQLite: judge write stored as given; qa / sr / pm ledger writes rejected | SQ1 (E435) · SQ3 (E435) · SQ4 (E435) · BYPASS-SQL (E435) |
| zod boundary precedes step 9 (removed codes never named) | AC5 (E435): the rejection is the zod layer, not a gate (pm + ledger id would otherwise hit NON_JUDGE_COMPLETED_TASKS_REJECTED) — green on both |

Left as is (green on both): FM2, FM3, SQ2.

### Open Interface Details (T-10, part 1)

1. Emit asserted verbatim with one id: `` ⛔ NON_JUDGE_COMPLETED_TASKS_REJECTED: completed_tasks=[<id>] on an agent_id=<role> write. `` + the architecture's hintStatic (one id makes the `${ids}` join separator irrelevant).
2. FM1 / FM5 judge report at `qa_reports/review_<id>.md` (the `QA_COMPLETION_EVIDENCE_MISSING` Copy hint names that path); old `review_reports/` evidence dropped (it backs nothing, T-09a).
3. FM4 / FM5 replace the qa-engineer APPROVED row: the edge it rode is gone, so FM4 pins the rejection and FM5 moves the APPROVED write to the judge's own self-loop. FM5 is green at base too (kept as the positive control).
4. SQ1: the judge's ledger write is accepted and stored as given in SQLite (`QA_COMPLETION_EVIDENCE_MISSING` is file-mode only); SQ3 swaps the qa APPROVED-row case for a qa-engineer ledger self-loop (AC9).

### Red Reasons (T-10, part 1)

14 red at base, all assertion failures (no syntax / link error): FM6–FM11, SQ4, BYPASS-FM, BYPASS-SQL emit `NON_QA_COMPLETED_TASKS_REJECTED` with the qa-engineer hint; FM1, SQ1 `REVIEWER_COMPLETED_TASKS_REJECTED` on the judge; FM12 / SQ3 qa-engineer is still the ledger writer; FM4 code-reviewer → qa-engineer still an edge (`MISSING_REVIEW_EVIDENCE`). Rows under `# T-E435-10` in the manifest. Run: `node --test test/reviewer-completed-tasks-gate.test.mjs test/e181-pending-notes-roundtrip.test.mjs` → 52 tests, 38 pass, 14 fail = the 14 rows, name for name.

### Remaining — part 2 (`e150-completed-tasks-carry-forward`, `e139-non-reviewer-verdict`, `e247-pass-tasks-incomplete`)

Planned re-pins: e150 — every ledger writer / FAIL-shrink / PASS seed and write moves from qa-engineer to code-reviewer (AC13–AC17), AC16 APPROVED-row case becomes the judge's self-loop, AC17 regex → `NON_JUDGE_COMPLETED_TASKS_REJECTED`, AC20 description = Copy `desc.completed_tasks`; e139 — AC-E139-2/3 APPROVED row (code-reviewer → qa-engineer edge gone; APPROVED ↔ PASS consistent), AC-E139-8 qa PASS → code-reviewer PASS (qa PASS now a zod refine); e247 — PASS writer `qa-engineer` → `code-reviewer` (`PASS_TASKS_INCOMPLETE` hint "A code-reviewer PASS").

## T-E435-45 (= T-E435-10 part 2) — `test/e150-completed-tasks-carry-forward.test.mjs`, `test/e139-non-reviewer-verdict.test.mjs`, `test/e247-pass-tasks-incomplete.test.mjs` (AC2, AC5)

Placement: existing files, edited in place (brief). Re-titled tests carry `(E435)`. 242 changed lines (135+ / 107-), under the 300-line cap; T-E435-10 is complete with this part.

### Scenario → Test Map (T-45)

| scenario | exact test name(s) |
|---|---|
| the judge (code-reviewer) is the ledger writer; its list merges | AC15 (E435): code-reviewer writing [B] … · AC15 (E435): a code-reviewer cumulative list … · AC15 (E435): a code-reviewer PASS carrying only the current ids … |
| the judge's FAIL shrinks by review_task_ids; nothing else does | AC16 (E435): code-reviewer FAIL with review_task_ids [B] … · the explicit completed_tasks: [] spelling … · AC16 (DR-3, E435) … · word boundary … · no review_task_ids … · FAIL + tw_rollback_task + tw_sync (both orders) |
| the judge's APPROVED write never shrinks; a non-judge (qa-engineer) never shrinks | AC16 (E435): only code-reviewer + FAIL … (green on both) · AC16 (E435): a non-judge agent (qa-engineer) … (green on both) |
| step 9 for qa-engineer (AC2) | AC17 (E435): a non-judge write (qa-engineer included) … NON_JUDGE_COMPLETED_TASKS_REJECTED … |
| evidence gate diffs the judge's list | AC17 (E435): the completion-evidence gate … · AC17 (E435): ids already on disk … |
| Copy desc.completed_tasks | AC20 (E435) |
| feature change after the judge's PASS | AC14 (E435) ×2 |
| review_verdict: code-reviewer -> qa-engineer gone (S3 hint), judge APPROVED PASS lands | AC-E139-2 (E435) |
| no qa write carries a verdict (removed edge TRANSITION_REJECTED + S3 hint; qa FAIL + S4/S5 hint; qa PASS judge-guarded) | AC-E139-3 (E435) |
| APPROVED ↔ {PASS, In_Progress}; CHANGES_REQUESTED + PASS mismatch | AC-E139-4 (E435) |
| rejected before QA_REVIEW_RECORD (qa PASS; judge PASS mismatch) | AC-E139-8 (E435) |
| PASS_TASKS_INCOMPLETE on the judge's PASS, hint "A code-reviewer PASS" | AC1–AC4, AC7 (E435) in e247 |

Left as is (green on both): e150 AC13 ×6, AC15 `[]` ×4 + bypass-zod, AC15 writer-level dedupe (lastAgent re-stamped only), AC18, AC19; e139 AC-E139-1, -5, -6, -7.

### Open Interface Details (T-45)

1. e139 `upd()` folds a thrown rejection (zod / judge guard reached through `handleUpdateState`) into the result shape, as `test/e396-covers-expected-red.test.mjs` does; qa PASS is asserted by `JUDGE_ONLY` = `requireJudge` text or the `PASS_IDENTITY_REFINE_MESSAGE` prefix, so either layer satisfies it.
2. AC-E139-3 (c): a qa-engineer FAIL is asserted as `TRANSITION_REJECTED` + `hint.qa_judge` (step 1 precedes step 8), no longer `NON_REVIEWER_VERDICT_REJECTED`.
3. AC-E139-8: the "forged verdict" second half moves to the judge's PASS carrying `CHANGES_REQUESTED` (step 8 `REVIEW_VERDICT_STATUS_MISMATCH` before step 10), since a code-reviewer APPROVED PASS is no longer forged.
4. e150 AC16 APPROVED-row case becomes the judge's In_Progress self-loop with `review_verdict: "APPROVED"`; the "non-qa" case becomes a qa-engineer self-loop (the newly non-judge role); AC17 rejection seeds a qa-engineer self-loop.
5. e150 AC16 "no review_task_ids" write gains `pending_notes` so the base run fails on the assertion, not a `pending_notes is not iterable` crash.

### Red Reasons (T-45)

25 red at base, no syntax / link error: e247 AC1–AC4/AC7 and the e150 code-reviewer PASS case fail on the ZodError thrown inside `handleUpdateState` (the stated behaviour, not a harness fault); every other row fails on an assertion. Causes:code-reviewer PASS throws the pre-pre-flight ZodError (T-E435-31); code-reviewer ledger writes emit `REVIEWER_COMPLETED_TASKS_REJECTED` (T-E435-33); code-reviewer FAIL does not shrink (T-E435-31); code-reviewer:PASS → pm and code-reviewer → qa-engineer edges as at base (T-E435-30); AC20 description (T-E435-35). Rows under `# T-E435-45` in the manifest. Run: `node --test test/e150-completed-tasks-carry-forward.test.mjs test/e139-non-reviewer-verdict.test.mjs test/e247-pass-tasks-incomplete.test.mjs` → 45 tests, 20 pass, 25 fail = the 25 rows, name for name.

## T-E435-11 — `error-code-contract`, `e26-gate-stats`, `e308-single-source-tier-enum`, `e35-pipeline-order`, `e434-reviewer-visual` (mapping-comment test only) (AC5)

Placement: existing files, edited in place (brief). Re-titled tests carry `(E435)`. 227 changed lines (155+ / 72-), under the 300-line cap. Contract: architecture *Error codes (OQ (b), (f)) and `GATE_REGISTRY` = 33*, *`UPDATE_STATE_GATE_PIPELINE` — 17 steps*, *Metrics sidecar and `tw_gate_stats`*, Rulings (a), (b).

### Scenario → Test Map (T-11)

| scenario | exact test name(s) |
|---|---|
| registry 33, three codes removed, NON_JUDGE in REVIEWER's slot (orchestrator, plain-text, documentedInProse) | error-code-contract AC-1/AC-5 (E435) · E308/AC3 (… registry has 33 codes (E435)) · e308 E303-AC12 (E435) · e26 R1, R2, U1, D1, D2, T3b (33) |
| ROUND_CAP / QA_ROUND_EXCEEDED gone | error-code-contract AC5 (E435) · AC2 (c12) cap literals (CAP_BY_CODE without QA_ROUND_EXCEEDED, green on both) |
| union 16 members, TRANSITION_GATE_CODES 6 | error-code-contract DR-8 (E435) · e35 E435: TRANSITION_GATE_CODES is the 6 transition codes … |
| pipeline 17 steps, step 9 `NON_JUDGE_COMPLETED_TASKS_REJECTED` with one code | e35 t-order-exact ×2 · E435: TRANSITION_GATE_CODES … step 9 … |
| mapping comment = quote sites, 33 rows, NON_JUDGE → const-08 after REVIEW_VERDICT_STATUS_MISMATCH, removed rows gone | error-code-contract doc-file mapping (c12) · e434 AC10 |
| registry comment texts (33-gate catalog, sections 1-6 / 7-12 / 13-32 / 33, 6 codes, 16-member, 10 handler-side; documentedInProse reason) | error-code-contract E435: gates/registry.ts count comments … · e434 AC10 |
| every code obeys the contract (allowlist closure: NON_JUDGE rows replace REVIEWER / NON_QA rows; stale rows now fail) | error-code-contract AC3 (c12) |
| tw_gate_stats drops mean_qa_rounds, historical qa_rounds ignored, removed codes surface as unregistered | e26 DE5 (E435) · U2 (E435) |

Left as is (green on both): e308 E303-AC11a/b/c (VISUAL_ROUND_EXCEEDED `(none)` row unchanged); e35 step-count, TRANSITION_VALIDATION reference, parity, E300 tests; error-code-contract parity (AC-5, doc ⊆ registry, registry ⊆ doc), SR_RETURN_CAP allowlist reasons re-worded only.

### Open Interface Details (T-11)

1. e434 AC10 field comment: the architecture quotes only the reason fragment, so the claim (`Every entry is true except VISUAL_ROUND_EXCEEDED`) and the reason (`nothing emits it since E435: its counter ticks only on a qa-engineer FAIL; E420 owns the visual family`) are pinned as two substrings; `COPY.registryFieldComment` (old-path wording) is asserted absent via "only the old path still emits".
2. The four section headers are pinned as substrings `---- transition-json (codes 1-6`, `---- orchestrator-json (codes 7-12`, `---- plain-text (codes 13-32`, `tool-boundary (code 33)` (no closing producer text pinned; the tool-boundary header may be bare or prefixed).
3. NON_JUDGE allowlist reasons copy the removed REVIEWER rows' two reasons (free-English triggerEdge, snake_case armCondition); if sr writes a camelCase predicate into its armCondition, AC3 reports BOTH and the row goes.
4. AC3 closure gains one check: an allowlist row naming an unregistered code fails (stale exemption).
5. e26 `metricRecord` emits `qa_rounds` only when passed, modelling a historical record; DE5 asserts no `qa_rounds` key anywhere in `report.metrics` (per_feature included).

### Red Reasons (T-11)

20 red at base, all assertion failures (no syntax / link error): registry still 35 entries / mapping 35 rows (T-E435-32, T-E435-33); step 9 name and codes, TRANSITION_GATE_CODES 7, union 17, `ROUND_CAP_EXPORTED` exported (T-E435-32, T-E435-33); registry count comments 35 / 7 / 17 and documentedInProse old-path reason (T-E435-32, T-E435-33); `mean_qa_rounds` present (T-E435-34). Rows under `# T-E435-11` in the manifest. Run: `node --test test/error-code-contract.test.mjs test/e26-gate-stats.test.mjs test/e308-single-source-tier-enum.test.mjs test/e35-pipeline-order.test.mjs test/e434-reviewer-visual.test.mjs` → 92 tests, 72 pass, 20 fail = the 20 rows, name for name.

## T-E435-12 — `handoff-migration`, `schema-versions`, `handoff-versioning`, `handoff-write-arg-guard`, `writestate-options-object` (AC4)

Placement: existing files, edited in place (brief). New / re-titled tests carry `E435`. 300 changed lines (213+ / 87-), at the cap. Contract: architecture *Handoff schema v17 (file mode)*, *`tools/registry.ts` (`UpdateStateArgs`)*, Decision Records (positional write overloads: keep the `qaRound` slot, ignored; `resume_of: "qa-engineer"` rejected), Rulings (a).

### Scenario → Test Map (T-12)

| scenario | exact test name(s) |
|---|---|
| v16 → v17 step drops `chain_path`, `qa_round`, `qa_rounds_total`, keeps every other field (sr_return_count, review/visual counters, dispatch_pins), applied `[17]` | handoff-migration `E435 AC4: the v16→v17 step drops chain_path, qa_round and qa_rounds_total and keeps every other field` |
| a schema 16 file (marker present) heals to 17 on disk with the three lines gone | handoff-versioning `E435 AC4: readHandoffState heals a schema 16 handoff to 17 on disk, …` (frozen `V16_MARKED` text) |
| stale `resume_of: "qa-engineer"` dropped at parse (no migration step) | handoff-migration `E435 AC4: a v17 handoff carrying a stale resume_of: "qa-engineer" parses with resume_of absent` |
| `CURRENT_VERSIONS.handoff` 17; tasks / sqlite / config 2 | schema-versions `CURRENT_VERSIONS exposes the four kinds at their E435 levels …` |
| writer stamps 17, writes none of the dropped fields; heals land at 17; refuse-loud says server max 17 | handoff-versioning AC-1 (stamp), AC-2 (×2), AC-4 (×2), AC-5; handoff-migration AC-7 round-trip (v17 stamp), AC-10(g) (v18 vs v17); schema-versions no-op (17), refuses-loud (17) |
| full chain from v0..v6 ends without `qa_round` / `qa_rounds_total` (was "preserved") | handoff-migration AC-12(e) ×2, AC-7/AC-10(f), AC-7/B8, AC-1/C9 ×2 (applied `[7..17]`), AC-9/C9 |
| positional `qaRound` slot kept (no argument shift) and ignored; options object has no `qaRound` | writestate-options-object AC-6 ×2, AC-10 ×2, E36 ×2 (byte-identical with options call that omits `qaRound`; no `qa_round:` line) |
| PASS refine names code-reviewer (`PASS_IDENTITY_REFINE_MESSAGE`) at the stdio boundary | handoff-write-arg-guard `regression (t-reg-pass-requires-code-reviewer, E435): …` |
| `resume_of` stays code-reviewer after the transient-field test | handoff-migration AC-3/c9 (resumeOf `code-reviewer`; green on both) |

Left as is (green on both): schema-versions overwrite test (gains a 16→17 registration, harmless at base), all other schema-versions runner tests; handoff-write-arg-guard AC-1..AC-4 and prd_path (fixture `schema_version: 5` with `qa_round: 0` still climbs the chain); handoff-versioning fast path / boundary / regression tests.

### Open Interface Details (T-12)

1. `qa_round` absence is asserted as `state.qa_round === undefined` on the parsed state, and as no `^qa_round:` line in written files; `qa_rounds_total` absence on a migration payload as `"qa_rounds_total" in payload === false`.
2. Schema 16 input is frozen text (`V16_MARKED` in handoff-versioning, a plain object in handoff-migration), never the writer, so it outlives T-E435-29.
3. The PASS refine is pinned by the substring `agent_id: status="PASS" requires agent_id="code-reviewer"` (zod path + `PASS_IDENTITY_REFINE_MESSAGE`), not the full `❌ Invalid arguments …` prefix.
4. Dropped for the 300-line cap: a stdio test of `resume_of: "qa-engineer"` → `RESUME_OF_ENUM_MESSAGE` (already covered by e435 AC4 input-schema test).

### Red Reasons (T-12)

28 red at base, all assertion failures (no syntax / link error): `CURRENT_VERSIONS.handoff` is 16 and no v16 → v17 step exists, so writes / heals stamp 16, the chain keeps `qa_round` / `qa_rounds_total`, and v17 files are refused (T-E435-29); the writer still emits `qa_round` from the positional slot (T-E435-29, T-E435-34 for `FileHandoffStorage`); the PASS refine still names qa-engineer (T-E435-35). Rows under `# T-E435-12` in the manifest. Run: `node --test test/handoff-migration.test.mjs test/schema-versions.test.mjs test/handoff-versioning.test.mjs test/handoff-write-arg-guard.test.mjs test/writestate-options-object.test.mjs` → 84 tests, 56 pass, 28 fail = the 28 rows, name for name.

## T-E435-13 — `e18-write-provenance`, `e20-e21-crash-resilience`, `drift-skew`, `e325-drift-version-peek-race`, `e312-read-path-race` (AC4, AC2)

Placement: existing files, edited in place (brief). New / re-titled tests carry `E435`. 177 changed lines (103+ / 74-), under the 300-line cap. Contract: architecture *Handoff schema v17 (file mode)*, *Error codes* (step 9 `NON_JUDGE_COMPLETED_TASKS_REJECTED`, `QA_COMPLETION_EVIDENCE_MISSING` judge-only), Rulings (a), (b); schema-17 conventions from T-E435-12 reused (frozen raw v16 text, absence asserted as `state[k] === undefined`).

### Scenario → Test Map (T-13)

| scenario | exact test name(s) |
|---|---|
| the evidence gate diffs the judge's (code-reviewer's) list: unevidenced new id rejected, evidenced accepted, list-back not gated | e18 QAEV-1 (E435) · QAEV-2 (E435) · QAEV-3 (E435) |
| no APPROVED exemption: review_reports evidence alone does not back a judge ledger write | e18 QAEV-4a (E32 amendment, E435) |
| the judge's APPROVED self-loop keeps review scope out of the ledger | e18 QAEV-4b (E32 amendment, E435) — green on both (positive control) |
| E5 identity-swap replay: qa-engineer-stamped swap is not an edge (TRANSITION_REJECTED); the judge's zero-evidence pre-fill is refused | e18 QAEV-INCIDENT (E435) |
| AC9 SQLite: the judge's unevidenced ledger write is accepted (gate file-mode only) | e18 QAEV-SQL (E435) |
| `CURRENT_VERSIONS.handoff` 17 in the skew peek: text says `server max v17`; v17 is never skew, v18 is | drift-skew T32 AC-6 (future handoff), AC8 (flat), T32 AC-6 (E435) boundary |
| the skew peek under a flat/lane rename race never reports a v17 file as skew | e325 AC-E325-1 (E435) |
| the raced read path (both readers, every injection point) still runs v16 → v17: `chain_path`, `qa_round`, `qa_rounds_total` gone | e312 (i) R1 forward, (i) R1/R2 sweep, (ii) reverse, (iii) R2 both directions — × parseHandoff, readHandoffState |

Left as is (green on both): e18 CONTENT-2, CONTENT-3; all of `e20-e21-crash-resilience` (the E20/E21 SOP lines it pins are not touched by E435 — the T-32 skill-qa-engineer.md edits are line 13 tail and line 31, neither pinned here); drift-skew tasks / config / heal / empty / short-circuit; e325 other tests (v999 fixtures); e312 (iv).

### Open Interface Details (T-13)

1. e312 fixture moves from schema 15 to a frozen schema 16 text carrying `chain_path: "test-first"`, `qa_round`, `qa_rounds_total`, so the raced read still exercises a migration step after the build (v15 → v17 would too, but v16 is the step E435 adds). At base v16 is current, so no migration runs there; post-build race-plus-migration coverage is unchanged.
2. e325 `body()` drops its `qa_round: 0` line (a v17 file carries none); the v999 fixtures are unaffected.
3. QAEV-INCIDENT keeps both halves of the old replay: the qa-engineer stamp (now TRANSITION_REJECTED, step 1 precedes step 9) and the evidence gate on the same pre-fill, moved to the judge's stamp. A qa-engineer ledger self-loop (`NON_JUDGE_COMPLETED_TASKS_REJECTED`) is not re-pinned here: covered by `test/reviewer-completed-tasks-gate.test.mjs` FM12 and `test/e150-completed-tasks-carry-forward.test.mjs` AC17 (E435).
4. QAEV-4b drops its `review_reports/` evidence file (it backs nothing since `MISSING_REVIEW_EVIDENCE` is dormant; completed_tasks is empty so no gate arms).

### Red Reasons (T-13)

18 red at base, all assertion failures (no syntax / link error): e18 QAEV-1/2/3/4a/SQL, a code-reviewer ledger write is `REVIEWER_COMPLETED_TASKS_REJECTED` (T-E435-33); QAEV-INCIDENT, code-reviewer → qa-engineer still an edge (T-E435-30); drift-skew ×3, e325 ×1, skew text `server max v16` and v17 reported as skew (T-E435-29); e312 ×8, v16 is current so the dropped fields survive the read (T-E435-29). Rows under `# T-E435-13` in the manifest. Run: `node --test test/e18-write-provenance.test.mjs test/e20-e21-crash-resilience.test.mjs test/drift-skew.test.mjs test/e325-drift-version-peek-race.test.mjs test/e312-read-path-race.test.mjs` → 49 tests, 31 pass, 18 fail = the 18 rows, name for name.

## T-E435-14 — `qa-review-scoped-append`, `e23-evidence-schema`, `e161-qa-suite-result`, `e236-rejected-write-evidence`, `e366-sqlite-rejected-write-evidence` (AC2, AC9)

Placement: existing files, edited in place (brief). Re-titled tests carry `E435`. 152 changed lines (80+ / 72-), under the 300-line cap. Contract: architecture *`tools/handoff-orchestrator.ts`* (steps 10–11 judge = `JUDGE_ROLE`; PASS defence-in-depth = `requireJudge`), *`tools/registry.ts`* (PASS refine names code-reviewer), *Handoff schema v17*, Rulings (d) (SQLite runs the same one chain, no marker). Schema-17 conventions from T-E435-12 reused.

### Scenario → Test Map (T-14)

| scenario | exact test name(s) |
|---|---|
| the judge's (code-reviewer's) qa_review is recorded only against the named ids, FAIL and PASS, file mode | qa-review-scoped-append FM1/AC1/AC4 (E435) · FM2/AC2 (E435) |
| a judge qa_review with no target is QA_REVIEW_TARGET_REQUIRED, handler and full dispatch | FM3/AC3 (E435) · FM4 (E435) |
| AC9: the same recording and target rule in SQLite, judge code-reviewer, no marker | SQ1/AC1/AC4 (E435) · SQ2/AC2 (E435) · SQ3/AC3 (E435) |
| `qa_suite_result` is recorded on the judge's PASS / FAIL (`— by code-reviewer`), file and SQLite; zod rejects malformed values; it changes no outcome where nothing records; it is undone with a rejected write | e161 AC-E161-2 … AC-E161-8 (E435) |
| a judge write rejected after QA_REVIEW_RECORD (or whose state write throws) leaves evidence byte-identical; an accepted judge PASS records the unchanged header / section | e236 AC-E236-1 … AC-E236-6 (E435) |
| AC9: the same undo for SQLite `reports` rows; an accepted judge PASS leaves rows signed `code-reviewer` | e366 AC-E366-1 … AC-E366-3 (E435) |
| visual / AC-execution envelopes name file path and evidence-schema version on the judge's PASS | e23 AC5-1 … AC5-3 (E435) |
| a v12 handoff migrates through v16 → v17 (CURRENT 17) inventing no `evidence_schema`; `qa_rounds_total` dropped | e23 AC2-1 (E435) · AC2-2 (E435) (green on both: `?? 17` sanity) |

Left as is (green on both): e161 AC-E161-9, source hygiene; e23 AC1-*, AC3-*, AC4-*, AC6-*; e236 AC-E236-7 and e366 AC-E366-4 (library-level undo, the signer string is data the server never checks; kept `qa-engineer`).

### Open Interface Details (T-14)

1. Pre-existing evidence seeded as data (`# QA review … PASS — by qa-engineer` files in qa-review-scoped-append, `T-OLD` / `T-U` SQLite rows, e236/e366 undo signers) keeps the qa-engineer signer: it models pre-v5 evidence and no gate reads the signer.
2. e161 AC-E161-6 case `"qa In_Progress"` renamed `"judge In_Progress"` (a code-reviewer self-loop carrying qa_review records nothing); the `sr-engineer` case is unchanged.
3. e23 AC2-1 registers a v16 → v17 step mirroring the architecture's (`chain_path`, `qa_round`, `qa_rounds_total` dropped), and its sibling-counter assertion moves from `qa_rounds_total` to `review_rounds_total`, plus `"qa_rounds_total" in payload === false`.
4. Raw schema 12/13 fixtures in e23 keep `qa_round` / `qa_rounds_total` lines (frozen historical text; post-build they migrate away).

### Red Reasons (T-14)

27 red at base, all for the stated reason (no syntax / link error): 21 are a `ZodError` `status="PASS" requires agent_id="qa-engineer"` — a code-reviewer PASS on an unmarked feature never reaches the record or later gates (T-E435-31, T-E435-35); FM1/FM3/FM4/SQ1/SQ3 are assertion failures — the judge at base is qa-engineer, so a code-reviewer FAIL records nothing and QA_REVIEW_TARGET_REQUIRED does not arm (T-E435-31); e23 AC2-1 stops at v16 (T-E435-29). No test dropped. Rows under `# T-E435-14` in the manifest. Run: `node --test test/qa-review-scoped-append.test.mjs test/e23-evidence-schema.test.mjs test/e161-qa-suite-result.test.mjs test/e236-rejected-write-evidence.test.mjs test/e366-sqlite-rejected-write-evidence.test.mjs` → 45 tests, 18 pass, 27 fail = the 27 rows, name for name.
