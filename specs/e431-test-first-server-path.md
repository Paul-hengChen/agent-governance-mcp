# e431-test-first-server-path

Ticket: E431 (`docs/backlog.md`, incl. the 2026-11-19 audit amendment, which supersedes the earlier row text). Lane `e431`, plan `specs/fanout-v5-w2.md` (human-approved 2026-11-20). Rulings: `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` §14.2 rulings 1–7, 9, 14; §16.1 rulings 2, 3, 5, 6, 17, 18.

## Problem Statement

Today the server knows one build order, pm → (architect) → sr-engineer → code-reviewer → qa-engineer, and only qa-engineer may write PASS or complete a task. The ruled test-first chain is pm → (architect) → qa-engineer (writes the scenario tests) → sr-engineer → code-reviewer (judges tests and implementation, writes PASS). This ticket adds that path to the server beside the old one and removes nothing: a feature enters the new path only through an explicit, persisted path marker, every check that needs to tell the two paths apart reads that marker, and a feature without it behaves exactly as before. Between this ticket and E432 the new path cannot complete end to end, because the PASS-time evidence checks still look for qa-engineer's report (audit amendment (8)); this ticket makes the transition check, the judge-identity checks and the counters right, nothing more.

## User Stories

- As a coordinator running the test-first chain (from E433), I want pm → qa-engineer → sr-engineer → code-reviewer → PASS accepted by the server, so that the ruled chain runs without hand-edits.
- As a human approving cuts, I want the four build-entry checks to arm on the new entry edge, so that the new path cannot start building on an unapproved cut.
- As a maintainer of an in-use workspace, I want an unmarked feature to behave byte-for-byte as before, so that `main` keeps working while E432–E435 land.
- As an operator, I want sr-engineer's returns to qa-engineer capped at 2 with their own error code, so that a test/code collision loop stops at pm instead of burning hops.

## Acceptance Criteria

Terms. *Marked feature*: a file-mode feature whose persisted handoff state carries `chain_path: "test-first"`. *Unmarked feature*: no `chain_path` in state. *Transition check*: `validateTransition` plus the orchestrator steps that call it. All ACs are file mode unless stated. Every `proof:` is a test qa-engineer writes in a new `test/e431-*.test.mjs` file (qa names the file; the test title starts with the AC id); run as `node --test test/e431-*.test.mjs --test-name-pattern "<AC id>:"` from the worktree after `npm run build`.

- **AC1 (backlog acceptance 1)** — Given a feature at `pm:In_Progress` with `cut_approved: true` and the entry write carrying `chain_path: "test-first"`, when qa-engineer writes `In_Progress` (no `resume_of`) and then sr-engineer writes `In_Progress`, then both writes are accepted, and the persisted state after each carries `chain_path: test-first`.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC1:"`
- **AC2** — Given a marked feature at `architect:In_Progress`, when qa-engineer writes `In_Progress`, then it is accepted; given the same feature, when sr-engineer writes `In_Progress` straight from `architect:In_Progress` or from `pm:In_Progress`, then each is rejected `TRANSITION_REJECTED` (the new path cannot skip qa-engineer).
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC2:"`
- **AC3 (backlog acceptance 2)** — Given a marked feature at `code-reviewer:In_Progress`, when code-reviewer writes `status: "PASS"`, then neither the tool boundary nor the transition check rejects it (no `TRANSITION_REJECTED`, no PASS-identity rejection); with every ledger row completed by code-reviewer through `tw_complete_task` and `completed_tasks: []`, the write is accepted and persists `status: PASS`, `last_agent: code-reviewer`.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC3:"`
- **AC4 (backlog acceptance 3)** — Given a marked feature at `qa-engineer:In_Progress` (or at `code-reviewer:In_Progress`), when qa-engineer writes `status: "PASS"`, then it is rejected and no state is written.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC4:"`
- **AC5 (backlog acceptance 4)** — Given a marked feature where code-reviewer wrote `FAIL` (`review_round` +1) and qa-engineer then wrote `In_Progress` (accepted), when qa-engineer hands straight to `code-reviewer:In_Progress`, then it is rejected `TRANSITION_REJECTED`; when instead qa-engineer → sr-engineer → code-reviewer, each write is accepted.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC5:"`
- **AC6 (backlog acceptance 5)** — Given a marked feature with two accepted sr-engineer `In_Progress` → qa-engineer `In_Progress` returns (persisted `sr_return_count` 1 then 2; `review_round` unchanged by them), when a third sr-engineer → qa-engineer return is written, then it is rejected `SR_RETURN_CAP_EXCEEDED`, the envelope's `allowed` is exactly `[{new_agent: "pm", new_status: "In_Progress"}]` and the hint names pm; a following `pm:In_Progress` write is accepted and resets `sr_return_count` to 0. Other writes on the same feature while `sr_return_count` is 2 (e.g. sr-engineer → code-reviewer) are NOT blocked by this cap.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC6:"`
- **AC7** — Given a marked feature, when code-reviewer rejections routed to qa-engineer and to sr-engineer together reach `review_round` 4, then the next write other than `pm:In_Progress` is rejected `REVIEW_ROUND_EXCEEDED` (every code-reviewer rejection to either role counts).
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC7:"`
- **AC8 (audit-amendment acceptance)** — Given a feature at `pm:In_Progress` without `cut_approved`, when qa-engineer writes `In_Progress` with the marker on the entry, then it is rejected `CUT_APPROVAL_REQUIRED`; likewise `EXTERNAL_REFS_UNRESOLVED` with an `unresolved` external ref, `SCOPE_DECISION_REQUIRED` with an armed design and no scope decision, and `SOURCE_CREDIBILITY_UNVERIFIED` with an un-attested fetch-based design. Given the same unapproved state and an unmarked feature, when qa-engineer writes `In_Progress` with `resume_of: "qa-engineer"`, then it is accepted (the hand-back stays exempt).
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC8:"`
- **AC9** — Given an unmarked feature at `pm:In_Progress`, when qa-engineer writes `In_Progress` with neither `resume_of` nor `chain_path`, then it is rejected `TRANSITION_REJECTED` and the hint contains both `resume_of: "qa-engineer"` and `chain_path: "test-first"`; with `resume_of: "qa-engineer"` alone it is accepted as today. On a marked feature, a later pm → qa-engineer write needs no `resume_of`.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC9:"`
- **AC10** — Given a marked feature, when later same-feature writes omit `chain_path`, then the persisted state keeps `chain_path: test-first` (it cannot be cleared); when a write changes `active_feature`, then the new feature's state has no `chain_path`. Given an unmarked feature that has already left pm on the old path (e.g. at `sr-engineer:In_Progress`), when a write carries `chain_path: "test-first"`, then it is rejected under an existing error code (architect picks which; no new code) and no state is written.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC10:"`
- **AC11** — Given a marked feature at `code-reviewer:PASS`, when pm, researcher, release-engineer or design-auditor writes `In_Progress`, then each is accepted. Given an unmarked feature at `code-reviewer:In_Progress`, when code-reviewer writes `PASS`, then it is rejected as today.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC11:"`
- **AC12 (backlog acceptance 6)** — Given an unmarked feature run through the old chain to PASS (pm → sr → code-reviewer → qa → PASS; the pm → architect → sr variant; a qa FAIL → sr loop; a bugfix-mode run; an Amend-Resume hand-back), when each write is replayed, then every accept/reject outcome, error code and persisted counter (`qa_round`, `review_round`, `visual_round`, `hop_count`, `*_rounds_total`) is identical to the base-commit server, and the state carries no `chain_path` and no `sr_return_count`. The only intended old-path text change is the AC9 hint.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC12:"`
- **AC13 (bugfix, ruling 9)** — Given a marked feature with `dispatch_mode: "bugfix"` at `sr-engineer:In_Progress` and no `qa_reports/expected-red_<feature>.txt`, when sr-engineer hands to code-reviewer, then it is rejected `REPRO_MANIFEST_MISSING`; with the manifest it is accepted, and a later code-reviewer PASS passes the transition check.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC13:"`
- **AC14 (judge on the task tool)** — Given a marked feature, when code-reviewer calls `tw_complete_task`, then the task is completed; when qa-engineer calls it, then it is rejected with a message naming code-reviewer as this feature's judge. Given an unmarked feature, both outcomes are as today (qa-engineer completes, code-reviewer rejected with today's text).
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC14:"`
- **AC15 (judge on the write path)** — Given a marked feature: a code-reviewer write carrying non-empty `completed_tasks` is not rejected `REVIEWER_COMPLETED_TASKS_REJECTED`; a qa-engineer write carrying non-empty `completed_tasks` is rejected; a code-reviewer `PASS` with `review_verdict: "APPROVED"` is not rejected `REVIEW_VERDICT_STATUS_MISMATCH`; a code-reviewer `FAIL` with `review_task_ids` removes those ids from the persisted ledger. Given an unmarked feature, each of the four behaves as today.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC15:"`
- **AC16 (schema)** — Given a v15 `handoff.md`, when it is read, then it migrates to `schema_version: 16` with no `chain_path` and no `sr_return_count` seeded (absence = unmarked, count 0); `CURRENT_VERSIONS.handoff` is 16 and `CURRENT_VERSIONS.sqlite` stays 2.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC16:"`
- **AC17 (registry, pipeline, hop cap)** — `GATE_REGISTRY` has 35 entries, one of them `SR_RETURN_CAP_EXCEEDED` (producer `validateTransition`, envelope `transition-json`, `documentedInProse: false`, mapping-comment row `(none)`); `UPDATE_STATE_GATE_PIPELINE` still has 17 steps in the same order; `HOP_CAP_EXPORTED` is still 14; the `tools/transitions.ts` comment above `HOP_CAP` no longer claims the round caps always trip first.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC17:"`
- **AC18 (SQLite)** — Given SQLite/HTTP storage, when a write carries `chain_path: "test-first"`, then the marker is ignored (not persisted, not read by any check): pm → qa-engineer without `resume_of` is rejected as today and code-reviewer PASS is rejected as today.
  proof: `node --test test/e431-*.test.mjs --test-name-pattern "AC18:"`
- **AC19 (docs)** — `CONTRIBUTING.md` says 35 gate definitions; `docs/architecture.md` lists the sr-return cap beside the round caps and says 35 registry entries; `specs/qa-flow-enforcement-architecture.md` mirrors the marker-gated edges; `CLAUDE.md` is 250 lines and `test/e436-stale-handoff-paths.test.mjs` + `test/e395-claude-md-tail.test.mjs` pass.
  proof: `node --test test/e436-stale-handoff-paths.test.mjs test/e395-claude-md-tail.test.mjs test/error-code-contract.test.mjs`
- **AC20 (suite and hygiene)** — The full suite passes except reds the lane does not own (each mailed to the integrator); the branch's `dist/` diff holds only artifacts of this lane's sources (`dist/tools/registry.*` excepted, rebuilt after merge); `npm audit --audit-level=high` exits 0.
  proof: `node scripts/test-lock.mjs -- npm test; npm audit --audit-level=high; echo "exit=$?"`

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| field.chain_path | `chain_path` | §16.1 ruling 2 (example name) |
| field.chain_path.value | `test-first` | §16.1 ruling 2 (example value) |
| field.sr_return_count | `sr_return_count` | authored-here — persisted counter, named after its sibling `hop_count` |
| code.sr_return_cap | `SR_RETURN_CAP_EXCEEDED` | authored-here — named after its sibling `HOP_CAP_EXCEEDED` (a feature counter with a pm-only escape) |
| hint.sr_return_cap (static part) | ` — sr-engineer has returned this feature to qa-engineer the maximum 2 times. Route to pm (pm:In_Progress) for a human ruling on the scenario.` | authored-here — mirrors the `*_ROUND_EXCEEDED` hint shape (`sr_return_count=<n>` prefix interpolated at the emit site); architect may tighten wording, must keep "pm" |
| hint.pm_to_qa (appended to today's Amend-Resume hint) | ` Test-first entry: set chain_path: "test-first" on the entry write instead (needs an approved cut; no resume_of).` | authored-here — §16.1 ruling 2 "hint naming both forms" |
| msg.complete_task_judge | `⛔ BLOCKED: tw_complete_task is reserved for code-reviewer on a test-first feature (chain_path: test-first). Called by <who>. Hand off to code-reviewer and pass agent_id="code-reviewer".` | authored-here — mirrors today's `requireQaEngineer` text |
| msg.pass_judge | `⛔ BLOCKED: tw_update_state(status=PASS) is reserved for code-reviewer on a test-first feature (chain_path: test-first). Called by <who>. Hand off to code-reviewer and pass agent_id="code-reviewer".` | authored-here — same shape as above; unmarked features keep today's qa-engineer text byte-for-byte |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- PASS-time evidence checks reading the judge's report, the manifest check on qa → sr, `scripts/release.mjs`, `tools/lane-status.ts` (E432).
- Any `content/**` rule or SOP text, `tools/fanout-manifest.ts`, the new code's prose citation (E433). The new code ships `documentedInProse: false` like `DISPATCH_PIN_TIER_REJECTED` did.
- Visual judge / `reviewer-visual` (E434). Removing the old path, the marker or qa-engineer's PASS authority (E435).
- SQLite persistence of the marker and the new counter (decision D1, recommended file mode only).
- Constitution §3 text (unchanged; the server has no builder-is-not-judge check).
- Every E423-owned file (`content/**`, goldens, `test/context-budget.test.mjs`, `gates/visual.ts`, `prompts/**`, `docs/install.md`, `PROMPT_REGISTRY`, the E423 test surface).
- `README.md`: no change (the new path is not usable until E432 and not served until E433; the README describes the served chain).

## Dependencies / Prerequisites

- E422, E419 DONE (merged in wave 1, base `0efc203`).
- Architect hop is mandatory (intake: full chain with architect). Architect writes `specs/e431-test-first-server-path-architecture.md`; per `docs/lane-protocol.md` its Open Questions go to the mailbox for a second pre-review before sr-engineer starts.
- No visual surface; no `design/` file (mode = no-design; Visual Structural Assertions omitted).
- Resource audit: no external reference in the ticket, the plan row or the rulings → `external_refs` omitted.
- `test/skill-evolution-v3.11.test.mjs` lines 74–82 (the test pinning `handoff:\s*15,` at :80) are re-assigned to e431 by human ruling 1a (2026-11-20, recorded in the plan's Decisions); the rest of that file stays e423-owned. qa re-pins :80 to 16 directly.
- During E431–E433 no served rule points at the marker, so real features stay on the old path (ruling 2's reason).

## Decisions

| # | decision | recommendation | needs human ruling? |
|---|---|---|---|
| D1 | SQLite coverage | **File mode only.** `chain_path` and `sr_return_count` are ignored in SQLite/HTTP mode like `dispatch_mode`, `cut_approved` and `external_refs` (precedent: four file-only fields; `CURRENT_VERSIONS.sqlite` stays 2). In SQLite mode the marker can never be set, so the new path is closed and every outcome is the old one. Consequence: E435, which removes the old path, must then add SQLite support (or declare SQLite file-mode parity out of scope) — note for that ticket's cut. Alternative (b): persist both in SQLite via an idempotent `ALTER TABLE` like `hop_count` (no `schema_meta` bump), adding `tools/storage-sqlite.ts` + `schema/migrations-sqlite.ts` (+1 sr task, ~2 test files). | **Yes** — genuine option (a) file-only vs (b) SQLite now. |
| D2 | sr→qa return cap: code name and location | `SR_RETURN_CAP_EXCEEDED`, produced by `validateTransition` in `tools/transitions.ts` (transition-json envelope, sibling of `HOP_CAP_EXCEEDED`), one `GATE_REGISTRY` entry (34→35), `documentedInProse: false`, mapping-comment row `(none)`. Edge-specific: it rejects only the sr-engineer → qa-engineer write when `prev sr_return_count >= 2` (unlike the round caps it does not collapse the whole matrix, since 2 returns are legitimate and the feature must still reach code-reviewer). `TransitionRejection["error"]` grows 16→17 members (re-pin in `test/error-code-contract.test.mjs`). | No (naming/placement within the approved scope). |
| D3 | Pipeline step count | **Unchanged at 17.** The cap lives in `validateTransition` (step 1); the PASS-identity check moves from the zod refine into the orchestrator's pre-pipeline guard (where `requireQaEngineer` already runs), after `prevState` is read; the build-entry checks widen their edge predicate in place. So `README.md`, `CLAUDE.md:48,62` and the `docs/architecture.md` step counts are not touched. | No. |
| D4 | New `tools/*.ts` / `gates/*.ts` files | **None.** No new Layout row. `CLAUDE.md` changes one line in place: line 78 (`tools/transitions.ts` row) appends `, SR_RETURN_CAP=2` inside the parenthesis; net 0 lines, nothing merged, total stays 250, pinned lines 13/44/64/195/220/221 and the e395 block (lines 90–101) untouched. Fallback if architect adds a module anyway: its row goes directly after line 78 (outside the e395 block) and lines 104–107 (`gates/*.ts` list, 4 lines) are reflowed into 3 to offset; architect must name it and the second pre-review confirms. | No (fallback only if architect deviates). |
| D5 | Marker placement and immutability (architect confirms) | The marker may first be set by (i) a pm write, or (ii) the entry write itself (pm → qa-engineer, architect → qa-engineer); it is feature-scoped (carried across omitting writes, dropped on `active_feature` change, NOT re-armed on pm re-entry). Setting it on an unmarked feature anywhere else is rejected with an existing code (AC10). The enum has one value, so "cannot change" = cannot be cleared and cannot be added mid-old-path. | No. |
| D6 | Marker-closed edges (architect confirms the full table) | Marked feature closes: pm → sr-engineer, architect → sr-engineer (incl. bugfix mode, §15.2 ruling 7), `code-reviewer:In_Progress` → `qa-engineer:In_Progress`, `qa-engineer:In_Progress` → `qa-engineer:PASS`/`FAIL`. Unmarked feature closes every new edge: pm → qa without `resume_of`, architect → qa, qa → sr (`In_Progress`), sr → qa, `code-reviewer:In_Progress` → `code-reviewer:PASS`, `code-reviewer:FAIL` → qa, the `code-reviewer:PASS` exits. `effectiveAllowedSuccessors` passes the marker so advisory successor lists match. | No. |
| D7 | Counter resets | `sr_return_count` resets on `pm:In_Progress` and on `active_feature` change (as `review_round`); not a review round; counted in `hop_count` like any hand-off. `review_round` additionally resets on `code-reviewer:PASS` (mirrors `qa_round` on qa PASS). No `*_total` mirror for the new counter. | No. |

## Probe — baseline at `0efc203` and tests expected red

Probe result (PM, 2026-11-20, worktree at `0efc203`, `node scripts/test-lock.mjs -- npm test`): 4391 tests, 4389 pass, 0 fail, 2 skipped, exit 0. Baseline has **no red file**.

Expected to turn red only because of this ticket (literal + regex grep, not run; qa re-pins; owner per `specs/fanout-v5-w2.md`):

| group | test files | owner |
|---|---|---|
| transitions / PASS identity / hints / descriptions | `test/qa-flow.test.mjs` (:196, :1206, :1219, :1449), `test/e151-resume-of-rejection-hint.test.mjs` (:52, :64, :69 — AC9 hint), `test/handoff-write-arg-guard.test.mjs` (:477 — zod PASS refine), `test/e409-lite-write-tool-facts.test.mjs`, `test/e441-tool-description-contracts.test.mjs`; possibly `test/hop-count-transitions.test.mjs`, `test/visual-round-transitions.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs`, `test/e128-*.test.mjs` if they snapshot the matrix | e431 |
| registry count 34→35 / union 16→17 | `test/error-code-contract.test.mjs` (:121, :258, :505, :654), `test/e26-gate-stats.test.mjs` (:78), `test/e308-single-source-tier-enum.test.mjs` (:91), `test/e419-retired-write-mechanisms.test.mjs` (:76–77) | e431 |
| handoff schema 15→16 | `test/schema-versions.test.mjs`, `test/handoff-versioning.test.mjs`, `test/handoff-migration.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/dispatch-pins.test.mjs`, `test/e114-cut-approval-inheritance.test.mjs`, `test/e123b9-lane-flip.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/e235a-relative-prd-path.test.mjs`, `test/e312-read-path-race.test.mjs`, `test/e405-release-runner.test.mjs`, `test/lane-migrate.test.mjs`, `test/stale-dispatch-detection.test.mjs` (:469), `test/success-metrics.test.mjs` (:130–133), `test/drift-skew.test.mjs` (:89, :232 "server max v15"), `test/e22-stale-notify.test.mjs` (:487), `test/repro-first-gate.test.mjs` (:302) | e431 (the last three are outside the plan's listed surface; they fall under "other tests red only because of this ticket") |
| handoff schema 15→16 | `test/skill-evolution-v3.11.test.mjs` (:80 `handoff:\s*15,`) | **e431** — lines 74–82 only (human ruling 1a, 2026-11-20); rest of file e423 |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E431 | Test-first server path beside the old one: persisted `chain_path` marker (handoff schema 15→16, lazy migration, file mode only per D1), marker-gated transition matrix (pm→qa, architect→qa, qa→sr, sr→qa return, code-reviewer→PASS, code-reviewer rejection→qa, four `code-reviewer:PASS` exits; old-path edges closed on marked features and vice versa), four build-entry checks on marked pm→qa, judge identity per marker (PASS guard moved into the orchestrator, `tw_complete_task`, completed-tasks and verdict checks, ledger removal, RAG clear), `sr_return_count` + `SR_RETURN_CAP_EXCEEDED` (registry 34→35), hop cap 14 kept with its comment fixed, docs synced; old path byte-identical | E422, E419 | 15 source/docs + `dist/` + ~30 test files | `tools/transitions.ts`、`tools/handoff-orchestrator.ts`、`tools/tasks.ts`、`tools/handoff-types.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/registry.ts`、`gates/registry.ts`、`schema/versions.ts`、`schema/migrations-handoff.ts`、`specs/qa-flow-enforcement-architecture.md`、`docs/architecture.md`、`CONTRIBUTING.md`、`CLAUDE.md`、`dist/tools/{transitions,handoff-orchestrator,tasks,handoff-types,handoff-parse,handoff-write,storage-sqlite}.*`、`dist/tools/registry.*`、`dist/gates/registry.*`、`dist/schema/**`、`test/e431-*.test.mjs`、`specs/e431-*.md` | — |

## Tasks

Ledger: `.current/e431/tasks.md` (written with `tw_add_task`). Chain for this ticket itself (old path): pm → architect → sr-engineer (T-E431-01..06 in order, each within the 5-file / 300-line `task_size` budget; `dist/` is regenerated output and not counted) → code-reviewer → qa-engineer (T-E431-07..11). qa-engineer authors every test change. If D1 is ruled (b), add T-E431-12 (sr, `tools/storage-sqlite.ts` + `schema/migrations-sqlite.ts`) before T-E431-06.

| id | role | P | summary | files | depends_on |
|---|---|---|---|---|---|
| T-E431-01 | sr-engineer | P0 | Handoff fields `chain_path` + `sr_return_count`: type, parse, write (feature-scoped carry, dropped on feature change, never cleared), schema 15→16 with a stamp-only lazy migration | `tools/handoff-types.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts`, `schema/versions.ts`, `schema/migrations-handoff.ts` | none |
| T-E431-02 | sr-engineer | P0 | Tool boundary: `chain_path` enum `["test-first"]` on `tw_update_state` (zod + inputSchema); remove the zod PASS refine (moves to the orchestrator in T-E431-05); update the `tw_update_state`, `completed_tasks`, `tw_complete_task` descriptions | `tools/registry.ts` | none |
| T-E431-03 | sr-engineer | P0 | Matrix and counters: optional `chain_path` / `prev_sr_return_count` request fields, marker-gated edges (D6), `SR_RETURN_CAP_EXCEEDED` (D2), AC9 hint, `computeNewRound` `sr_return_count` + D7 resets, fix the comment at :325-330; registry entry 35 + union + mapping row `(none)` | `tools/transitions.ts`, `gates/registry.ts` | none |
| T-E431-04 | sr-engineer | P0 | Orchestrator wiring: derive the marker (prev state or entry write, D5), reject a mid-old-path marker (AC10), pass marker + counter to `validateTransition` and `effectiveAllowedSuccessors`, widen the four build-entry predicates to marked pm→qa, persist `chainPath` / `srReturnCount` (file mode only, D1) | `tools/handoff-orchestrator.ts` | T-E431-01, T-E431-02, T-E431-03 |
| T-E431-05 | sr-engineer | P0 | Judge identity per marker: PASS guard after `prevState` read (Copy msg.pass_judge), `REVIEWER_COMPLETED_TASKS_REJECTED` / `NON_QA_COMPLETED_TASKS_REJECTED`, `REVIEW_VERDICT_STATUS_MISMATCH`, ledger removal, RAG clear; `tw_complete_task` judge (Copy msg.complete_task_judge) | `tools/handoff-orchestrator.ts`, `tools/tasks.ts`, `tools/transitions.ts` | T-E431-04 |
| T-E431-06 | sr-engineer | P1 | Docs (AC19, D4): matrix mirror, sr-return cap row, 35 entries, `CLAUDE.md:78` in place; `npm run build`; write `qa_reports/expected-red_e431-test-first-server-path.txt` from the Probe table | `specs/qa-flow-enforcement-architecture.md`, `docs/architecture.md`, `CONTRIBUTING.md`, `CLAUDE.md` | T-E431-05 |
| T-E431-07 | qa-engineer | P0 | New `test/e431-*.test.mjs`: one test per AC1–AC18 (titles start with the AC id) | `test/e431-*.test.mjs` | T-E431-06 |
| T-E431-08 | qa-engineer | P1 | Re-pin transitions / PASS-identity / hint / description tests (Probe group 1) | ~5–9 test files | T-E431-06 |
| T-E431-09 | qa-engineer | P1 | Re-pin registry count 34→35 and union 16→17 (Probe group 2) | 4 test files | T-E431-06 |
| T-E431-10 | qa-engineer | P1 | Re-pin handoff schema 15→16 (Probe group 3), including `test/skill-evolution-v3.11.test.mjs:80` (lines 74–82 only, re-assigned to e431) | ~17 test files | T-E431-06 |
| T-E431-11 | qa-engineer | P0 | Review: run every AC `proof:`, full suite via `node scripts/test-lock.mjs -- npm test`, `dist/` scope, `npm audit --audit-level=high`; PASS | — | T-E431-07, T-E431-08, T-E431-09, T-E431-10 |
