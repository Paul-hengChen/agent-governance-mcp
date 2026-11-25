# e453-served-text-v5

Tickets: E453, E454, E456, E457 and E458 except item (8) (`docs/backlog.md` rows E453, E454, E456, E457, E458; each row's "Re-checked 2026-11-25" corrections and "Missed locations" override the text above them; the human ruling on E456 (1) sets the `review_round` cap at 4). Cut v1. Lane `e453`, plan `specs/fanout-pre-v5-w1.md` (human-approved 2026-11-25; the e453 Lanes row's owned / forbidden files and scope cut, 所有權重劃, 交給 lane 的 PM and the Decisions table are binding). E458 (8) belongs to lane e448. Line numbers are base `70d34c6`.

## Problem Statement

The v5 chain (qa-engineer writes the tests, sr-engineer builds, code-reviewer judges) shipped with served rule text and docs that still describe the old chain or disagree with the server. The code-reviewer rejection step starts with `tw_rollback_task`, which always fails on a task that only PASS would have marked; its step 1 sends a resumed review to STOP. The migration guide leaves an adopter failing `agc check`, offers a rejected transition, and misplaces the file-mode-only checks. The Limits table says the `review_round` cap is 3 (the server allows 4), states the `hop` cap per session (it is per feature) and the `sr_return` cap as locking the feature to pm (it closes one edge until pm re-enters, and SQLite/HTTP mode does not count it). Docs give the wrong pipeline length and gate count. Several served lines and tool descriptions still name the old build entry, a qa verdict, or a reviewer-visual dispatch that cannot happen. This feature rewrites that text; no server behaviour changes.

## User Stories

- As a code-reviewer subagent, I want the rejection step and the resume check to be executable on the v5 chain, so that a rejection or a crash-resume does not fail on its first action.
- As an adopter upgrading to v5, I want the migration guide to leave `agc check` at exit 0 and to name only accepted transitions, so that following it works.
- As any role reading the constitution, I want the Limits table to match the server's caps and their scope, so that I stop and escalate at the right time.
- As a contributor, I want the docs' pipeline and gate counts to be correct and kept correct by a test, so that I can trust them.
- As a coordinator or role, I want served text and tool descriptions to describe only the v5 chain, so that I never route to an entry or dispatch the server rejects.

## Acceptance Criteria

Terms. *Served content*: every file under `content/`. *Base*: commit `70d34c6`. Every `proof:` naming a test is a test qa-engineer writes: E453, E454, E456, E458 and the cross-cutting ACs in one new file matching `test/e453-*.test.mjs`, E457 in one new file matching `test/e457-*.test.mjs` (qa names each file; each test title starts with its AC id, e.g. `AC1:`). Text checks normalise runs of whitespace to one space before matching (the docs wrap paragraphs; wrapping is not part of a string). Base values a test compares against are frozen in the test (read at module load or written as literals), never read through `git show`.

### E453 — code-reviewer rejection and resume

- **AC1 (E453 (1), rejection row)** — Given `content/skill-code-reviewer.md`, then the *Rejection rows* bullet starts with the FAIL write (`cr.reject_head`), no longer contains `` `tw_rollback_task(<task-id>, <reason>)` per rejected id ``, and carries `cr.reject_rollback`, which limits the rollback to a rejected id the task list already shows `[x]`; the codes `QA_REVIEW_TARGET_REQUIRED` and `REVIEW_ROUND_EXCEEDED` stay on that bullet.
  proof: `node --test --test-name-pattern "AC1:" test/e453-*.test.mjs`
- **AC2 (E453 (2), corrections (a) (c), step 1)** — Given `content/skill-code-reviewer.md`, then step 1 is `cr.step1`: it accepts `(sr-engineer, In_Progress)`, a pm write whose `resume_of` names code-reviewer, `(code-reviewer, Blocked)`, and the reviewer's own `(code-reviewer, In_Progress)` claim (step 2) or checkpoint (step 6), and still STOPs on anything else.
  proof: `node --test --test-name-pattern "AC2:" test/e453-*.test.mjs`
- **AC3 (E453 missed location, reviewer-visual rows)** — Given `content/skill-reviewer-visual.md`, then it contains no `tw_rollback_task`; the widget-shape, material-drift and check-defect rows are `rv.row_widget`, `rv.row_drift`, `rv.row_check` (the FAIL write unchanged, rollback prefix removed); the code `VISUAL_WIDGETS_UNVERIFIED` stays on its row.
  proof: `node --test --test-name-pattern "AC3:" test/e453-*.test.mjs`
- **AC4 (E453, re-pin E433 AC5)** — Given `test/e433-test-first-rules.test.mjs`, then its AC5 test (the code-reviewer SOP `must` list, base line 347) pins `cr.reject_head` and `cr.reject_rollback` instead of the bare `` `tw_rollback_task(<task-id>, <reason>)` `` span, and asserts the "per rejected id, then" wording is gone; the file passes.
  proof: `node --test test/e433-test-first-rules.test.mjs`

### E454 — migration guide

- **AC5 (E454 (1), re-stamp)** — Given `docs/migration-v5.md`, then the *Re-stamp `agc-version`* section is `mig.restamp`: `agc init` updates the `CLAUDE.md` block only; an existing `AGENTS.md` / `.antigravityrules` is skipped; bump each by hand or delete and re-run; deleting and re-running loses local edits in that file; then `agc check` must exit 0. And following it works: in a temp workspace whose three adapters carry `agc-version` 4.0.0, `node bin/agc-init.mjs init` prints `Skipped (already exists): AGENTS.md, .antigravityrules` and `node bin/agc-init.mjs check` exits 1; after the hand bump of the two files' stamps to the installed version, `check` exits 0.
  proof: `node --test --test-name-pattern "AC5:" test/e453-*.test.mjs`
- **AC6 (E454 (2), sr-engineer row)** — Given the *A feature mid-flight* table, then the `sr-engineer:*` row is replaced by two rows: `sr-engineer:In_Progress` → `mig.row_sr_ip`, `sr-engineer:Blocked` → `mig.row_sr_blocked`; and the server agrees: `validateTransition` rejects `sr-engineer:Blocked → code-reviewer:In_Progress` and accepts `sr-engineer:Blocked → sr-engineer:In_Progress` and `sr-engineer:In_Progress → code-reviewer:In_Progress`.
  proof: `node --test --test-name-pattern "AC6:" test/e453-*.test.mjs`
- **AC7 (E454 (3) as corrected, SQLite section)** — Given the *SQLite / HTTP mode* section, then it carries `mig.sqlite_checks`: `CUT_APPROVAL_REQUIRED` and `EXTERNAL_REFS_UNRESOLVED` are named file mode only, `SCOPE_DECISION_REQUIRED` and `SOURCE_CREDIBILITY_UNVERIFIED` as running in every mode, and the qa-engineer → sr-engineer manifest check (`REPRO_MANIFEST_MISSING`) as file mode only; the section does not mention the old/new server mix.
  proof: `node --test --test-name-pattern "AC7:" test/e453-*.test.mjs`
- **AC8 (E454 (3) correction + missed line 14)** — Given the *What changed* list, then the schema bullet is `mig.schema` (15 → 17, not 16 → 17) and a new bullet `mig.mixed_servers` states the file-mode `handoff.md` risk of an older server (v4.23.0 reads up to 15) refusing a schema 17 file; that bullet sits outside the *SQLite / HTTP mode* section.
  proof: `node --test --test-name-pattern "AC8:" test/e453-*.test.mjs`

### E456 — limits and their scope

- **AC9 (E456 (1), human ruling: cap 4)** — Given `content/const-01-core-head.md`, then the `review_round` cap row has value `4` and meaning `limits.review_round.meaning`, and the value equals `REVIEW_ROUND_CAP_EXPORTED` from `dist/tools/transitions.js`; `docs/architecture.md` round-counter row carries `arch.review_round_cap`; the `tools/transitions.ts` comment at base line 394 is `tr.comment394`. `content/const-08-chain-31-mid.md` line 10, `content/const-12-chain-r10-s4.md` line 17 and the `review_round` sentence on the code-reviewer *Rejection rows* bullet are unchanged (they name the cap, check only).
  proof: `node --test --test-name-pattern "AC9:" test/e453-*.test.mjs`
- **AC10 (E456 (2), hop cap scope)** — Given served content, then no file contains `` per `/teamwork` session ``; the `hop` cap row meaning is `limits.hop.meaning` (per feature, reset only by an `active_feature` change) and `content/const-15-core-tail.md` line 6 is `c15.hop`; `docs/architecture.md` base line 140 is `arch.autoroute` (no `hop counter ≥ 10`, no `pending_notes.next_role`).
  proof: `node --test --test-name-pattern "AC10:" test/e453-*.test.mjs`
- **AC11 (E456 (3), sr_return scope)** — Given served content and `docs/migration-v5.md`, then the `sr_return` cap is stated as closing only the sr-engineer → qa-engineer return until the next `(pm, In_Progress)` write resets the count: `limits.sr_return.meaning`, `c06.sr_return`, `c12.sr_return`, `sr.cap_tail`, `mig.sr_return`; none of those sites says `routing locks to pm` or that only pm may take the feature because of `sr_return`. The `review_round` sentence on `content/const-12-chain-r10-s4.md` line 17 keeps ``past the `review_round` cap only pm may take the feature``.
  proof: `node --test --test-name-pattern "AC11:" test/e453-*.test.mjs`
- **AC12 (E456 (4), SQLite does not count sr_return)** — Given served content, then the `sr_return` Limits row (`limits.sr_return.meaning`) and `content/skill-sr-engineer.md` step 4c (`sr.read_count`) say SQLite/HTTP mode counts no returns (so the cap is not enforced there).
  proof: `node --test --test-name-pattern "AC12:" test/e453-*.test.mjs`

### E457 — doc numbers

- **AC13 (E457 numbers + missed locations)** — Given the repo, then `CONTRIBUTING.md` base lines 38 and 140 say `17-step`, line 64 says `33 gate definitions`, lines 98 and 252 carry no test-file count (`contrib.layout_test`, `contrib.testing`); `docs/architecture.md` base line 112 says `33 entries`; `docs/config.md` base line 245 is `config.caveat_gates`.
  proof: `node --test --test-name-pattern "AC13:" test/e457-*.test.mjs`
- **AC14 (E457, step 1 override list)** — Given `docs/architecture.md`, then the step 1 box lists four overrides, the new line `arch.hop_override` naming `HOP_CAP_EXCEEDED` after the `SR_RETURN_CAP` line, under `arch.cap_overrides`; every line of the box keeps its width (67 characters).
  proof: `node --test --test-name-pattern "AC14:" test/e457-*.test.mjs`
- **AC15 (E457, doc-number test)** — Given `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/architecture.md` and `docs/config.md`, then every statement matching `<n>-step` or `<n> steps` equals `UPDATE_STATE_GATE_PIPELINE.length` and every `<n> entries`, `<n> gate definitions` or `<n> gates` equals `GATE_REGISTRY.length` (read from `dist/`); a number preceded by `§`, `.` or a digit (e.g. `§3.1 gates`) is not a statement. The checker is a function the test also runs on mutated text: `18-step`, `35 entries`, `35 gate definitions` and `18 gates` are each reported.
  proof: `node --test --test-name-pattern "AC15:" test/e457-*.test.mjs`

### E458 — leftover old-chain wording (item (8) excluded)

- **AC16 (E458 (1) + missed lines 22–23, routing table)** — Given `content/coord-01-core-head.md`, then the routing-table rows for implement / review / test carry `coord01.row_impl`, `coord01.row_review`, `coord01.row_test`: implement and test name the pm-stamped opening write (mini-chain); review names code-reviewer after sr-engineer or alone through the single-role judge dispatch.
  proof: `node --test --test-name-pattern "AC16:" test/e453-*.test.mjs`
- **AC17 (E458 (2) as corrected)** — Given `content/skill-integrator.md`, then the *a builder* item is `integ.builder` (no `` only qa-engineer touches `test/` ``; both §2 carve-outs covered by reference).
  proof: `node --test --test-name-pattern "AC17:" test/e453-*.test.mjs`
- **AC18 (E458 (3))** — Given `content/coord-05-core-visual-drift.md`, then the dispatch parenthetical is `coord05.dispatch` (no `` (subagent-dispatch tool or `tw_switch_role`) ``) and base line 10 is `coord05.void` (no `the server will reject the resulting PASS`).
  proof: `node --test --test-name-pattern "AC18:" test/e453-*.test.mjs`
- **AC19 (E458 (4))** — Given `content/skill-sr-engineer.md` step 3b, then the infeasible-repro escape routes per *Escalation Routes: scenario cannot be built* (`sr.repro_escape`), not *awaiting clarification*.
  proof: `node --test --test-name-pattern "AC19:" test/e453-*.test.mjs`
- **AC20 (E458 (5) + missed lines 770, 786)** — Given `TOOL_REGISTRY` from `dist/tools/registry.js`, then the `tw_update_state` input-schema descriptions of `cut_approved`, `external_refs` and `dispatch_mode` carry `reg.cut_approved`, `reg.external_refs`, `reg.dispatch_mode`; no `tw_*` description contains `architect/sr-engineer`, `{architect,sr-engineer}` or `Phase 0.5`.
  proof: `node --test --test-name-pattern "AC20:" test/e453-*.test.mjs`
- **AC21 (E458 (6))** — Given `docs/config.md`, then base line 277 is `config.caveat_skill` (names the code-reviewer PASS evidence, no `evidence-of-PASS`).
  proof: `node --test --test-name-pattern "AC21:" test/e453-*.test.mjs`
- **AC22 (E458 (7) + missed line 123)** — Given `docs/lane-protocol.md`, then base line 52 carries `lp.hop_b` and line 123 `lp.report_tasks`; the file contains no `code-reviewer／qa-engineer` and no `qa verdict`.
  proof: `node --test --test-name-pattern "AC22:" test/e453-*.test.mjs`
- **AC23 (E458 (9) + missed line 158, re-pins)** — Given served content, then no file contains `qa verdict` or `awaiting independent QA`; the Builder ≠ judge bullet is `c05.builder_judge`, coord-03 row 39's note is `coord03.row39_note`, `content/constitution-rationale.md` base line 158 is `rat.builder_judge`. `test/e433-test-first-rules.test.mjs` AC2 (c) and `test/e393-builder-judge-core.test.mjs` (base line 24) pin `c05.builder_judge`; both files pass.
  proof: `node --test --test-name-pattern "AC23:" test/e453-*.test.mjs && node --test test/e433-test-first-rules.test.mjs test/e393-builder-judge-core.test.mjs`
- **AC24 (E458 missed location, design-auditor)** — Given `content/skill-design-auditor.md` base line 56, then the build-entry edge reads `pm:In_Progress → {architect,qa-engineer}:In_Progress` (`da.edge`); served content contains no `{architect,sr-engineer}`.
  proof: `node --test --test-name-pattern "AC24:" test/e453-*.test.mjs`

### Cross-cutting

- **AC25 (error codes in served text unchanged)** — Given each `content/*.md`, then the set of `GateErrorCode` names it quotes in backticks equals that file's set at base (sets frozen in the test); `test/error-code-contract.test.mjs` and `test/e434-reviewer-visual.test.mjs` (its mapping-comment check, base lines 689–695) pass unchanged.
  proof: `node --test --test-name-pattern "AC25:" test/e453-*.test.mjs && node --test test/error-code-contract.test.mjs`
- **AC26 (portable served text)** — Given the lines this feature changes in `content/**`, then none cites a path that exists only in this repo or a bare ticket id (`E\d+` with no plain-language explanation on the line); `test/e437-repo-only-paths.test.mjs` passes.
  proof: `node --test --test-name-pattern "AC26:" test/e453-*.test.mjs && node --test test/e437-repo-only-paths.test.mjs`
- **AC27 (no server behaviour change)** — Given the diff against base, then `tools/transitions.ts` changes only comment lines, `tools/registry.ts` changes only `description` string literals, and no file under `gates/`, `schema/`, `prompts/` or `bin/` changes.
  proof: `git diff 70d34c6 -- tools/transitions.ts | grep -E '^[-+][^-+]' | grep -vE '^[-+]\s*//'` prints nothing; `git diff --stat 70d34c6 -- gates schema prompts bin` prints nothing; the registry check is a test in `test/e453-*.test.mjs` (`AC27:`) that compares `TOOL_REGISTRY` names, input-schema property keys and enums with base literals.
- **AC28 (goldens and budgets)** — Given the finished text, then the 12 files under `test/fixtures/compose-golden/` are re-captured and every `test/context-budget.test.mjs` cap the text moved is set to the measured value with a one-line re-baseline note per cap and a per-hunk explanation in `qa_reports/tests_e453-served-text-v5.md`; the full suite (`node scripts/test-lock.mjs -- npm test`, run after commit on a clean tree) has zero failures.
  proof: `node scripts/test-lock.mjs -- npm test` reports `# fail 0`.

## Copy / Strings

Every new or rewritten line, quoted verbatim. Table rows quote cell text only (no `|`). Where a paragraph in `docs/` wraps, the wrap points are free.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| cr.step1 | ``1. `tw_get_state` → `tw_detect_drift`. Confirm the previous tuple is `(sr-engineer, In_Progress)`, a pm write whose `resume_of` names you, `(code-reviewer, Blocked)`, or your own `(code-reviewer, In_Progress)` claim or checkpoint (a resumed review: re-read the inputs and continue from the step its note names). If not, STOP — coordinator routed wrong.`` | E453 (2) + corrections (a) (c) |
| cr.reject_head | ``- **Rejection rows**: `tw_update_state(status=FAIL, agent_id="code-reviewer", review_verdict="CHANGES_REQUESTED", review_task_ids=[<ids>], qa_review="<findings>", qa_suite_result, blocking_reason="<one line>")` with `next_role` by cause and no `completed_tasks`;`` | E453 (1) |
| cr.reject_rollback | ``A task is marked `[x]` only after PASS, so a rejected id normally has nothing to roll back; only for a rejected id the task list already shows `[x]`, run `tw_rollback_task(<task-id>, <reason>)` first.`` (inserted after the `QA_REVIEW_TARGET_REQUIRED` sentence, before `Each rejection counts once`) | E453 (1), correction (b), D1 |
| rv.row_widget | STOP-action cell: ``Implementation defect: `tw_update_state(status=FAIL, agent_id="code-reviewer", review_verdict="CHANGES_REQUESTED", review_task_ids=[<task-id>], qa_review=<missing widgets>, next_role="sr-engineer")`. STOP.`` | E453 missed location |
| rv.row_drift | STOP-action cell: ``Implementation defect: `tw_update_state(status=FAIL, agent_id="code-reviewer", review_verdict="CHANGES_REQUESTED", review_task_ids=[<task-id>], qa_review=<diff>, next_role="sr-engineer")`. STOP.`` | E453 missed location |
| rv.row_check | STOP-action cell: ``Check defect: `tw_update_state(status=FAIL, agent_id="code-reviewer", review_verdict="CHANGES_REQUESTED", review_task_ids=[<task-id>], qa_review=<check + defect>, next_role="qa-engineer")`. STOP.`` | E453 missed location |
| limits.review_round.value | `4` | E456 (1), human ruling 2026-11-25 |
| limits.review_round.meaning | `After the 4th code-reviewer CHANGES_REQUESTED, only pm may take the feature.` | E456 (1), human ruling 2026-11-25 |
| limits.sr_return.meaning | ``Max sr-engineer returns to qa-engineer between two `(pm, In_Progress)` writes; past it only that return is rejected. File mode only: SQLite/HTTP mode counts no returns.`` | E456 (3) (4) |
| limits.hop.meaning | ``Max auto-routing role transitions per feature; only an `active_feature` change resets the count (lite mode exempt).`` | E456 (2) |
| c15.hop | ``- **Auto-routing hop cap**: per feature, across `/teamwork` sessions, role transitions are capped at the `hop` cap. Stop conditions: `skill-coordinator` §Escalation Routes. Lite mode is exempt (no auto-routing).`` | E456 (2) |
| c06.sr_return | ``- Each code-reviewer rejection counts once in `review_round`, whichever role it routes to; each `(sr-engineer, In_Progress) → (qa-engineer, In_Progress)` return counts toward the `sr_return` cap, past which that return is rejected until the next `(pm, In_Progress)` write resets the count (file mode only).`` | E456 (3) |
| c12.sr_return | ``Each sr-engineer return to qa-engineer counts toward the `sr_return` cap, past which that return is rejected until pm re-enters (file mode only); a scenario that cannot be built stops to pm (Blocked), never to qa-engineer.`` | E456 (3) missed location |
| sr.read_count | ``DO first read `sr_return_count` from `tw_get_state` (absent means 0; SQLite/HTTP mode never counts returns, so there the cap is not enforced) and compare it with the `sr_return` cap`` | E456 (4) |
| sr.cap_tail | ``The server checks the cap on qa-engineer's claim of the return edge, not on your write: past it, that claim is rejected with `SR_RETURN_CAP_EXCEEDED` until a `(pm, In_Progress)` write resets the count.`` | E456 (3), D5 |
| sr.repro_escape | ``escalate `status=Blocked` to pm per *Escalation Routes: scenario cannot be built* (the Blocked edge is never gated)`` | E458 (4) |
| tr.comment394 | `// pm) — symmetric to REVIEW_ROUND_CAP=4 (4 fails, then only pm). Constitution` | E456 missed location |
| arch.review_round_cap | FAIL-cap cell: `4 (after the 4th FAIL only pm)` | E456 (1) |
| arch.autoroute | ``Auto-routing in full mode: after each role's handoff, the coordinator dispatches the role named in the `next_role` field (a subagent, or `tw_switch_role(<next_role>)` as the fallback). It yields to the human on `Blocked`, on `PASS`, when the `next_role` field is absent, and when `hop_count` reaches the `hop` cap (14 per feature). Opt-out via `AGC_AUTO_ROUTE=0`.`` | authored-here — base line 140 states the old cap (10) and the retired `pending_notes.next_role`; found at verification, same defect class as E456 (2) / E457, D4 |
| arch.cap_overrides | `│      the cap overrides:                                         │` | E457 |
| arch.hop_override | `│        hop_count ≥ 14 (HOP_CAP_EXCEEDED): role change → pm      │` | E457 |
| arch.gate_entries | `` Gate metadata (error code, owning role, exemptions) is declared once per gate in `gates/registry.ts` — 33 entries covering the pipeline gates plus the read-path and task-tool gates. `` (rest of the line unchanged) | E457 |
| contrib.orchestrator | `  handoff-orchestrator.ts #   tw_update_state / tw_get_state + the 17-step` | E457 |
| contrib.gate_defs | `  registry.ts             #   GATE_REGISTRY — 33 gate definitions` | E457 |
| contrib.layout_test | `test/                     # node --test suites + eval/ harness` | E457 missed location, D2 |
| contrib.guards | `` 3. **Guards + gates** — `guards/session.ts` (pre-flight check) and `guards/file-lock.ts` (O_EXCL lock + mtime freshness), then the 17-step `UPDATE_STATE_GATE_PIPELINE` in `tools/handoff-orchestrator.ts` with predicates under `gates/`. `` | E457 |
| contrib.testing | `` `test/` holds the `node --test` suites covering guards, transitions and round caps, every gate in `GATE_REGISTRY`, drift and sync, schema migrations, prompt composition and context budget, the agc adapters, and RAG. `` (rest of the paragraph unchanged) | E457 missed location, D2 |
| config.caveat_gates | `` The state machine in `tools/transitions.ts` and the 33 gates registered in `gates/registry.ts` are code, not text — drift between your custom constitution and the code yields confusing rejections. `` | E457 missed location |
| config.caveat_skill | `` e.g. removing the PASS-evidence step from `skill-code-reviewer.md` does NOT lift the gate — the server still rejects a code-reviewer PASS that carries no `qa_review` when no `qa_reports/review_<id>.md` exists. `` | E458 (6) |
| mig.schema | ``- **Handoff schema 15 → 17** (v4.23.0 writes 15), migrated lazily on first read: `qa_round` and `qa_rounds_total` (and a pre-release `chain_path`) are dropped, and the new `sr_return_count` counter starts absent (read as 0). A `chain_path` sent by an old client is ignored. Nothing else in the handoff changes.`` | E454 missed location |
| mig.mixed_servers | ``- **Upgrade every server that shares a workspace.** Once a v5 server has written a file-mode `handoff.md` at schema 17, an older server (v4.23.0 reads up to 15) refuses it as written by a newer server. Restart every MCP client on v5 before the first write.`` | E454 (3) correction |
| mig.sr_return | ``- The `sr_return` cap (2 sr-engineer → qa-engineer returns) applies to every file-mode feature. The count resets on every `pm:In_Progress` write, and the cap closes only that return edge: sr-engineer can still hand to code-reviewer or stop to pm.`` | E456 (3) |
| mig.row_sr_ip | cells: `` `sr-engineer:In_Progress` `` / `Continue to code-reviewer.` | E454 (2) |
| mig.row_sr_blocked | cells: `` `sr-engineer:Blocked` `` / ``Write `sr-engineer:In_Progress` first, then continue to code-reviewer (`sr-engineer:Blocked → code-reviewer:In_Progress` is rejected).`` | E454 (2) |
| mig.restamp | ``Run `agc init` (or `agc check` to see what is stale). It updates the agc block, and its `agc-version` stamp, in `CLAUDE.md` only. An existing `AGENTS.md` or `.antigravityrules` is left as it is (`agc init` prints `Skipped (already exists)`): bump the `agc-version:` line in each by hand to the installed version, or delete the file and re-run `agc init`. Deleting and re-running writes a fresh copy from the template, so any local edits in that file are lost. Then run `agc check`; it must exit 0.`` | E454 (1) + correction (overwrite warning) |
| mig.sqlite_checks | ``Two build-entry checks run in file mode only: `CUT_APPROVAL_REQUIRED` and `EXTERNAL_REFS_UNRESOLVED` (`SCOPE_DECISION_REQUIRED` and `SOURCE_CREDIBILITY_UNVERIFIED` run in every mode). The expected-red manifest check on the qa-engineer → sr-engineer hand-off (`REPRO_MANIFEST_MISSING`) is file mode only too.`` (new paragraph after base line 76) | E454 (3) as corrected |
| coord01.row_impl | role cell: ``` `sr-engineer`, reached through a pm-stamped opening write and `qa-engineer` (*Cheapest-Compliant-Path Intake* mini-chain) ``` | E458 (1) |
| coord01.row_review | role cell: ``` `code-reviewer`, after `sr-engineer` or alone through the single-role judge dispatch (Constitution §3.1) ``` | E458 missed location |
| coord01.row_test | role cell: ``` `qa-engineer`, reached through a pm-stamped opening write (*Cheapest-Compliant-Path Intake* mini-chain) ``` | E458 missed location |
| integ.builder | ``- **a builder** — no feature code, no tests (§2 *Test ownership*: test files belong to qa-engineer, apart from that rule's two narrow carve-outs).`` | E458 (2) as corrected |
| coord05.dispatch | ``When dispatching `reviewer-visual` (subagent-dispatch tool only; `tw_switch_role` has no `reviewer-visual` role, so that fallback switches to `code-reviewer`, whose SOP loads the visual rules) — picked over`` (rest of the line unchanged) | E458 (3) |
| coord05.void | ``  authored accept-policy is void: the judge ignores it, and no server check detects it (no prose inspection).`` | E458 (3) |
| reg.cut_approved | `…to clear the CUT_APPROVAL_REQUIRED gate before routing to architect/qa-engineer.…` (only `architect/sr-engineer` → `architect/qa-engineer` changes) | E458 missed location |
| reg.external_refs | `…blocks the pm:In_Progress → {architect,qa-engineer}:In_Progress build-entry hop (EXTERNAL_REFS_UNRESOLVED).…` (only the role set changes) | E458 missed location |
| reg.dispatch_mode | `…and code-reviewer's Expected-Red Diff becomes load-bearing for PASS (every manifest entry green, no red off the manifest).…` (replaces `and QA's Phase 0.5 expected-red disposition becomes load-bearing for PASS.`) | E458 (5) |
| lp.hop_b | `(b) 剩餘工作有界、且由最後一次 code-reviewer 的 verdict 點名；` | E458 (7) |
| lp.report_tasks | `- tasks: <每個 task id → code-reviewer verdict + 證據檔路徑>` | E458 missed location |
| c05.builder_judge | ``- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change MUST NOT author its code-review verdict (visual verdict included) or its PASS. With no independent judge context available, the work stops at `status=Blocked` ("awaiting an independent judge") — never a builder-signed verdict.`` | E458 (9) |
| coord03.row39_note | pending-note cell: `"awaiting an independent judge" — the builder of a surface MUST NOT author its visual verdict or PASS (builder ≠ judge, §3)` | E458 (9) |
| rat.builder_judge | `§3, generalized to every code-review verdict and every PASS, because the same collapse` | E458 missed location |
| da.edge | `` blocks the `pm:In_Progress → {architect,qa-engineer}:In_Progress` transition `` (only the role set changes) | E458 missed location |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E458 (8) — `gates/registry.ts` hint texts (lane e448).
- Any server behaviour: `tools/transitions.ts` code, its base line 158 `MIGRATION_HINT` string, `REVIEW_ROUND_CAP`, `SR_RETURN_CAP`, `HOP_CAP`, every gate predicate.
- E461 and E462 (wave 2).
- `docs/schema-versions.md`: E456 (4) correction notes it already documents the SQLite rule at line 49; no edit.
- The `visual_round` text (`docs/architecture.md` round-counter row 2, the `VISUAL_ROUND_CAP` comment wording beyond the `REVIEW_ROUND_CAP` half): visual-family scope, not this feature.
- Code comments carrying the old build entry outside the owned text range (`tools/registry.ts:358`, `tools/transitions.ts:93,106,113`, `tools/handoff-orchestrator.ts:1039`, `tools/handoff-types.ts:160`, `gates/expected-red.ts:13`): not served text, outside the e453 owned set; listed once here, not filed.
- `dist/`: rebuilt by `npm run build` (and `npm test`'s prebuild); the lane does not commit it — the integrator rebuilds and commits `dist/` after the merge (manifest *整合後*, completion row 5b).

## Dependencies / Prerequisites

- Human ruling 2026-11-25 (E456 (1)): `review_round` cap = 4, meaning "after the 4th CHANGES_REQUESTED, only pm may take the feature"; `REVIEW_ROUND_CAP` unchanged.
- Manifest constraint (所有權重劃): backtick-quoted error codes in `content/*.md` are neither added nor removed (AC25); every edited content line keeps its existing codes.
- Integrator pre-review: the *Red outside the owned set* rows of the Probe (see there) need a human-approved owned-set amendment in the integrator session before the cut can name those test files.
- No design source (`design/e453-served-text-v5.md` absent; mode no-design). No external references (Resource Audit: the tickets and manifest cite only repo paths).

## Decisions

PM decisions inside the integrator-decided scope (none is an option for the human):

- **D1 (E453 (1))** — the ticket allows "drop the rollback, or limit it to ids already `[x]`". Chosen: limit it. Correction (b) shows the judge can `tw_complete_task` before PASS, so a rejected id can be `[x]`; dropping the call would leave that case without a rollback step.
- **D2 (E457)** — the test-file count in `CONTRIBUTING.md` lines 98 and 252 is removed rather than updated (276 today): it changes with every ticket, and the doc-number test binds only the pipeline and gate counts.
- **D3** — E454's tests live in the `test/e453-*.test.mjs` file: the owned set has no `test/e454-*` glob.
- **D4** — `docs/architecture.md` base line 140 (hop counter ≥ 10, `pending_notes.next_role`, `next_role: human`) is fixed with E456 (2): found at verification in an owned file, same defect class.
- **D5** — `content/skill-sr-engineer.md` step 4c tail ("and only pm may take the feature") carries the same `sr_return` overstatement as `const-12` line 18; fixed with E456 (3) since the step is already edited for E456 (4).
- **D6** — check-only sites (correct once Limits says 4, per E456 corrections): `content/const-08-chain-31-mid.md:10`, `content/const-12-chain-r10-s4.md:17`, the `review_round` sentence of `content/skill-code-reviewer.md:104`.
- **D7 (E458 (3))** — the coord-05 parenthetical must lose `` or `tw_switch_role` `` to stop offering a dispatch that `tw_switch_role`'s role enum cannot do. Three tests pin the old parenthetical byte-for-byte (Probe); keeping the bytes would keep the false claim, so the cut re-pins them and flags the two unowned files and the e448-owned file for the integrator.

## Probe — baseline at `70d34c6`

**Baseline** (PM, 2026-11-25, worktree at `70d34c6`, untouched, `node scripts/test-lock.mjs -- npm test`): **4579 tests, 4577 pass, 0 fail, 2 skipped, exit 0.** No red file.

**Run-based probe** (a throwaway copy of the worktree under the PM scratchpad, without `.git`, never the worktree): every Copy / Strings edit of this spec applied by script (48 replacements, each old string found exactly once at base; two strings were shortened afterwards, `coord01.row_review` and `integ.builder`, with no effect on which tests read them), then `npm test`: **4579 tests, 4536 pass, 34 fail, 9 skipped.** The backtick error-code set of every `content/*.md` file was compared before and after: unchanged in all files (AC25 holds for this text). Eight of the 34 failures (`agc-adapters` E104(ii), `check-md-tables` AC7 + CQ-9, `e234-hygiene-scan` AC16, `e258b-comment-scan` AC14, `e295-hop-cap-and-sop-halves` AC12, `e299-check-bookkeeping` REAL-CORPUS, `release-staging` Partition) also fail in an unedited copy without `.git` — they need a git checkout and are green in the worktree baseline; not caused by this lane. The other 26 failures, by file:

| test file (failing tests) | why | known / new | owned? |
|---|---|---|---|
| `test/compose-equivalence.test.mjs` (11 golden tests) | any `content/**` change | known (manifest: 12 compose goldens) | owned — qa T-10 re-captures `test/fixtures/compose-golden/**` |
| `test/skill-manifest.test.mjs` (`t-golden-byte-identity`) | reads `test/fixtures/compose-golden/skill-coordinator-monolith.txt`; coord-01 / coord-03 / coord-05 change | new | test code unchanged; green once T-10 re-captures the owned fixture (no edit to the test file, not in `touches`) |
| `test/context-budget.test.mjs` (5 caps: lean always-on 5969 → 6003, skill-sr 3285 → 3308, design-arm constitution 9187 → 9236, teamwork bundle 19063 → 19225, non-design constitution 7275 → 7324 ~tok, probe text) | zero-headroom caps move with text | known | owned — qa T-10 sets the measured values (final values differ slightly from the probe) |
| `test/e433-test-first-rules.test.mjs` (AC2 (c) Builder ≠ judge, AC2 (d) sr_return meaning; AC4 sr SOP `only pm may take the feature`; AC6 routing-table rows) | pins the old text | known (manifest: AC5, AC2 (c)); AC2 (d), AC4, AC6 new | owned — qa T-03 |
| `test/e393-builder-judge-core.test.mjs` (AC-A1 bullet base line 24; AC-C `C08 sr_return cap named` base line 129) | pins the old text | known (line 24); line 129 new | owned — qa T-03 |
| `test/e408-core-task-alias-tail.test.mjs` (AC2, AC3: the coord-05 site ``(subagent-dispatch tool or `tw_switch_role`)``, base line 35) | pins the coord-05 parenthetical E458 (3) removes | **new** | **not owned** — flagged below |
| `test/e412-qa-visual-template.test.mjs` (AC3, base line 58) | same parenthetical | **new** | **not owned** — flagged below |
| `test/e434-reviewer-visual.test.mjs` (AC2, `COPY.coord05Dispatch` base line 61) | same parenthetical | **new** | **owned by lane e448** — flagged below |

Tests that read changed text and stay green (checked in the probe): `test/error-code-contract.test.mjs`, `test/e434-reviewer-visual.test.mjs` mapping check (base 689–695), `test/e437-repo-only-paths.test.mjs`, `test/e441-tool-description-contracts.test.mjs` (no re-pin needed, so not in `touches`), `test/e295-hop-cap-and-sop-halves.test.mjs` (its one red is the no-git noise above), every lane-protocol / integrator SOP test. `test/e433-test-first-rules.test.mjs` AC5 (base 347) stays green on the new text because `cr.reject_rollback` still contains the call span; T-03 re-pins it anyway (AC4).

### Red outside the owned set (for the integrator pre-review)

E458 (3) removes `` or `tw_switch_role` `` from the coord-05 dispatch parenthetical (D7). Three tests pin the old parenthetical byte-for-byte and turn red; none can stay green without keeping the false claim:

1. `test/e408-core-task-alias-tail.test.mjs` — base line 35 (`SITES` row for coord-05); not in any lane's owned set.
2. `test/e412-qa-visual-template.test.mjs` — base line 58; not in any lane's owned set.
3. `test/e434-reviewer-visual.test.mjs` — base line 61 (`COPY.coord05Dispatch`); owned by lane e448 (its E452 work edits the same file around base lines 689–695 and AC7, a separate hunk).

Requested: a human-approved owned-set amendment adding (1) and (2) to e453, and an e453 carve-out for base line 61 of (3) (e448 keeps the rest of the file), recorded as a `人類` Decisions row and merged into the lane. Until then the cut names these files OUT (`fanout.mjs check --cut` exit 1) and T-E453-04 waits.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E453 | code-reviewer rejection row drops the unconditional `tw_rollback_task` (only an id already `[x]`), step 1 accepts the reviewer's own claim / checkpoint, `(code-reviewer, Blocked)` and the pm `resume_of` write; reviewer-visual rejection rows lose the rollback; E433 AC5 re-pinned | — | 2 content + 2 tests | `content/skill-code-reviewer.md`、`content/skill-reviewer-visual.md`、`test/e433-test-first-rules.test.mjs`、`test/e453-*.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` | — |
| E454 | migration guide: re-stamp step (CLAUDE.md block only; hand bump or delete-and-re-run with the overwrite warning; `agc check` exit 0), `sr-engineer` row split, file-mode-only checks named correctly in the SQLite section, mixed old/new server risk outside it, schema 15 → 17 | — | 1 doc + 1 test | `docs/migration-v5.md`、`test/e453-*.test.mjs` | — |
| E456 | Limits: `review_round` cap 4 (human ruling), `hop` cap per feature, `sr_return` cap closes one edge until pm re-enters and is not counted in SQLite/HTTP mode; aligned in const-06, const-12, const-15, sr SOP, migration guide, architecture doc and the transitions comment | — | 5 content + 3 docs/comment + 3 tests | `content/const-01-core-head.md`、`content/const-06-chain-31-head.md`、`content/const-12-chain-r10-s4.md`、`content/const-15-core-tail.md`、`content/skill-sr-engineer.md`、`docs/migration-v5.md`、`docs/architecture.md`、`tools/transitions.ts`、`test/e433-test-first-rules.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/e453-*.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` | — |
| E457 | pipeline length 17 and gate count 33 in `CONTRIBUTING.md`, `docs/architecture.md`, `docs/config.md`; step 1 override list gains `HOP_CAP_EXCEEDED`; test-file count removed; new doc-number test bound to `UPDATE_STATE_GATE_PIPELINE.length` / `GATE_REGISTRY.length` | — | 3 docs + 1 test | `CONTRIBUTING.md`、`docs/architecture.md`、`docs/config.md`、`test/e457-*.test.mjs` | — |
| E458 | old-chain wording except item (8): routing table entry via pm, integrator §2 reference, coord-05 dispatch parenthetical and void sentence, sr repro escape row, three tool descriptions, config caveat, lane-protocol verdict lines, qa verdict / awaiting independent QA, design-auditor build-entry edge; E433 AC2 (c) and e393 re-pinned; three coord-05 pins outside the owned set re-pinned after the integrator's amendment | — | 9 content/tool/docs + 6 tests | `content/coord-01-core-head.md`、`content/coord-03-core-fallback.md`、`content/coord-05-core-visual-drift.md`、`content/const-05-core-standards.md`、`content/skill-integrator.md`、`content/skill-sr-engineer.md`、`content/skill-design-auditor.md`、`content/constitution-rationale.md`、`tools/registry.ts`、`docs/config.md`、`docs/lane-protocol.md`、`test/e433-test-first-rules.test.mjs`、`test/e393-builder-judge-core.test.mjs`、`test/e453-*.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/e412-qa-visual-template.test.mjs`、`test/e434-reviewer-visual.test.mjs` | — |

## Tasks


Cut notes: the last three `touches` paths of the E458 row (`test/e408-core-task-alias-tail.test.mjs`, `test/e412-qa-visual-template.test.mjs`, `test/e434-reviewer-visual.test.mjs` base line 61 only) are outside the e453 owned set and flagged for the integrator pre-review (Probe, *Red outside the owned set*); `fanout.mjs check --cut` reports them OUT until a `人類` Decisions row amends the set. `test/skill-manifest.test.mjs` turns red but goes green on the T-10 re-capture with no edit, so it is not in `touches`. `dist/` is rebuilt, never committed by the lane (Out of Scope). Shared generated files (`test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`) are written once, by qa T-10, for all three content-bearing tickets.

Order (single chain, R3 (b) planned return per the manifest's 交給 lane 的 PM): qa T-01, T-02, T-03 (and T-04 once the integrator's owned-set amendment is merged into the lane) → sr T-05, T-06, T-07, T-08 (any order), T-09 last → planned return sr → qa (uses 1 `sr_return`; only 1 is left for an unplanned return) → qa T-10 → sr T-11 (suite only, no code change) → code-reviewer judges every task and writes PASS. sr never edits a qa-written test; each sr task appends the reds it leaves to `qa_reports/expected-red_e453-served-text-v5.txt` (`<test file> | <exact test name>`). Every sr task keeps AC25 (no backtick error code added or removed in a content file) and AC26 (no repo-only path, no bare ticket id in served text). Line numbers are base `70d34c6`; verify before editing.

- [ ] T-E453-01 [P0] qa-engineer: new test file matching `test/e453-*.test.mjs`, one test per AC1–AC3, AC5–AC12, AC16–AC27 (titles start with the AC id; base values frozen in-test; the AC5 adapter check runs `bin/agc-init.mjs` in a temp workspace; AC6 calls `validateTransition`); test report `qa_reports/tests_e453-served-text-v5.md`; expected-red manifest `qa_reports/expected-red_e453-served-text-v5.txt` | AC1–AC3, AC5–AC12, AC16–AC27 | depends_on: none
- [ ] T-E453-02 [P0] qa-engineer: new test file matching `test/e457-*.test.mjs`: AC13, AC14 and the AC15 doc-number checker (scans `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/architecture.md`, `docs/config.md`; mutation cases in-test) | AC13–AC15 | depends_on: none
- [ ] T-E453-03 [P0] qa-engineer: re-pin owned tests to the Copy / Strings text — `test/e433-test-first-rules.test.mjs` (AC5 `must` list base 345–347 → `cr.reject_head` + `cr.reject_rollback` and a negative check on "per rejected id, then"; AC2 (c) `BUILDER_NE_JUDGE` base 86 → `c05.builder_judge`; (d) sr_return meaning base 223 → `limits.sr_return.meaning`; AC4 base 307 → `sr.cap_tail`; base 392–393 → `coord01.row_test`, `coord01.row_review`), `test/e393-builder-judge-core.test.mjs` (base 24 → `c05.builder_judge`; base 129 → `c12.sr_return`); list each re-pinned test as expected red | AC4, AC11, AC16, AC23 | depends_on: none
- [ ] T-E453-04 [P1] qa-engineer, only after the integrator's owned-set amendment is merged into the lane: re-pin the coord-05 parenthetical in the three tests outside the owned set (Probe, *Red outside the owned set*) to `coord05.dispatch` — `test/e408-core-task-alias-tail.test.mjs` base 35 (the `SITES` row), `test/e412-qa-visual-template.test.mjs` base 58, `test/e434-reviewer-visual.test.mjs` base 61 (`COPY.coord05Dispatch`); nothing else in those files | AC18 | depends_on: none
- [ ] T-E453-05 [P0] sr-engineer: E453 — `content/skill-code-reviewer.md` (`cr.step1` line 69, `cr.reject_head` + `cr.reject_rollback` line 104), `content/skill-reviewer-visual.md` (`rv.row_widget`, `rv.row_drift`, `rv.row_check`, lines 92, 93, 95) | AC1–AC4, AC25, AC26 | depends_on: T-E453-01, T-E453-03
- [ ] T-E453-06 [P0] sr-engineer: E456 served text — `content/const-01-core-head.md` rows 13–15, `content/const-06-chain-31-head.md:8`, `content/const-12-chain-r10-s4.md:18`, `content/const-15-core-tail.md:6`, `content/skill-sr-engineer.md` (`sr.repro_escape` line 29 for E458 (4); `sr.read_count`, `sr.cap_tail` line 33) | AC9 (Limits), AC10 (content), AC11 (content), AC12, AC19, AC25, AC26 | depends_on: T-E453-01, T-E453-03
- [ ] T-E453-07 [P0] sr-engineer: E458 coordinator / constitution text — `content/coord-01-core-head.md:21–23`, `content/coord-03-core-fallback.md:39`, `content/coord-05-core-visual-drift.md:5,10`, `content/const-05-core-standards.md:21`, `content/skill-integrator.md:49` | AC16, AC17, AC18, AC23, AC25, AC26 | depends_on: T-E453-01, T-E453-03, T-E453-04
- [ ] T-E453-08 [P1] sr-engineer: E458 rest + `docs/config.md` — `content/skill-design-auditor.md:56`, `content/constitution-rationale.md:158`, `tools/registry.ts:770,786,835` (description strings only), `docs/lane-protocol.md:52,123`, `docs/config.md:245,277` | AC13 (config), AC20, AC21, AC22, AC23 (rationale), AC24, AC25, AC26, AC27 (registry) | depends_on: T-E453-01, T-E453-02
- [ ] T-E453-09 [P0] sr-engineer, last implementation task: `docs/migration-v5.md` (`mig.*`), `docs/architecture.md` (lines 73, 76 + new line, 112, 140, 244), `CONTRIBUTING.md` (lines 38, 64, 98, 140, 252), `tools/transitions.ts:394` (comment only); `npm run build`; full suite; append the snapshot reds (goldens, moved `test/context-budget.test.mjs` caps) to the manifest; then the planned R3 (b) return `sr-engineer:In_Progress → qa-engineer:In_Progress` naming them | AC5–AC8, AC9 (docs, comment), AC10 (docs), AC11 (docs), AC13, AC14, AC15, AC27, AC28 | depends_on: T-E453-02, T-E453-05, T-E453-06, T-E453-07, T-E453-08
- [ ] T-E453-10 [P0] qa-engineer: re-capture the 12 compose goldens and set every moved `test/context-budget.test.mjs` cap (and any sentinel naming changed text) to the measured value, one re-baseline note per cap, per-hunk explanation and per-site token delta in the test report; commit, then the full suite on a clean tree | AC28 | depends_on: T-E453-09
- [ ] T-E453-11 [P0] sr-engineer: re-run the full suite after the re-capture (no code change), confirm every red is dispositioned in the manifest, hand off to code-reviewer | AC28 | depends_on: T-E453-10

### Task Budget Map

| task | role | files | est. changed lines |
|---|---|---|---|
| T-E453-05 | sr | 2 | ~8 |
| T-E453-06 | sr | 5 | ~10 |
| T-E453-07 | sr | 5 | ~8 |
| T-E453-08 | sr | 5 | ~10 |
| T-E453-09 | sr | 4 | ~45 |
| T-E453-11 | sr | 0 | 0 |

Every sr task is within the `task_size` budget (≤ 5 files / 300 lines).
