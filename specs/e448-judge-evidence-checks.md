# e448-judge-evidence-checks

Tickets: E448, E451, E452, E459, E460 and E458 item (8) (`docs/backlog.md` lines 571, 574, 575, 582, 583 and 581 item (8); each row's "Re-checked 2026-11-25" correction is authoritative over the original text). Lane `e448`, plan `specs/fanout-pre-v5-w1.md` (human-approved 2026-11-25; the lane row's owned / forbidden files and scope cut are binding). Human rulings recorded in that plan's Decisions table and not reopened here: E448 fix (a) (re-arm, counts unchanged, no `content/**` change); E452 option (a) (server-enforced, new `evidence_schema` value); E458 (8) split to this lane. Priority: E448, E451, E452 are P1; E459, E460, E458 are P2. Line numbers are base `70d34c6`.

## Problem Statement

The judge's PASS is the last line of defence on the test-first chain, and five of its evidence checks are weaker than the served text says. The code-review evidence check (`MISSING_REVIEW_EVIDENCE`) arms only on the code-reviewer → qa-engineer hand-off that v5 removed, so a code-reviewer PASS with no review report at all is accepted (E448). A failed visual surface or assertion whose id merely contains "surface" or "assertion id" is mistaken for the table header and rides to PASS (E451). An `accepted` visual difference passes whether or not it is listed under `## Allowed Differences`, and the E434 test for it reads back its own fixture (E452). The evidence readers disagree on what counts as PASS evidence: file-mode PASS accepts any report file, even one whose last verdict is FAIL; the expected-red check uses the exact-anchored heading match while its sibling uses the evidence-schema match; lane-status credits a hand-written PASS heading the server never wrote (E459). `tw_complete_task` and `tw_rollback_task` refusals come back without `isError: true`, so a client keyed on that flag reads them as success (E460). Eighteen gate hints point adopters at workspace-relative paths (`specs/…`, `docs/backlog.md`, `content/…`, `gates/…`) and bare ticket ids that do not exist in their workspace (E458 (8)).

## User Stories

- As a human relying on the gates, I want a code-reviewer PASS with no review report rejected, so that the served claim "approval needs a review report" is true.
- As a reviewer-visual judge, I want a failed surface or assertion rejected whatever its id, so that a naming accident never passes a broken screen.
- As a human reading a visual report, I want every accepted difference recorded under `## Allowed Differences`, so that no accepted difference goes unrecorded.
- As an integrator, I want file-mode PASS, drift and lane-status to agree on which ids have PASS evidence, so that a lane's claimed completions mean the same thing everywhere.
- As an MCP client author, I want every refusal from `tw_complete_task` / `tw_rollback_task` flagged `isError: true`, so that my client never treats a refusal as success.
- As an adopter, I want every gate hint to name things I can find in my own workspace, so that a rejection tells me what to do without this repo's history.

## Acceptance Criteria

Terms. *Judge PASS*: a `tw_update_state` write with `agent_id: "code-reviewer"`, `status: "PASS"`. *Server-recorded verdict section*: an H2 line of the exact shape the server's qa_review auto-record writes, `## <ISO-8601 UTC timestamp> — PASS|FAIL — by <signer>` (timestamp as `new Date().toISOString()` prints it). *Report standing* of a judge report: the verdict of its LAST server-recorded verdict section, or *none* when it has no such section; any other heading (for example `## Round 1 — PASS — by code-reviewer`) is not a verdict. *Pin*: the feature's persisted `evidence_schema`. Every new test name starts with its AC id; new tests live in `test/e448-*`, `test/e451-*`, `test/e452-*`, `test/e459-*`, `test/e460-*`.

### E448 — review evidence on the judge PASS

- **AC1** — Given a file-mode feature at `code-reviewer:In_Progress` whose judge report `qa_reports/review_T1.md` would otherwise clear every PASS gate, and no `review_reports/` directory, when code-reviewer writes PASS with `completed_tasks: ["T1"]`, `review_verdict: "APPROVED"` and `qa_review`, then it is rejected `MISSING_REVIEW_EVIDENCE` naming T1 and ending with the `hint.missing_review_evidence` text; no state is written and the auto-recorded `qa_reports/review_T1.md` section is undone.
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC1:"`
- **AC2** — Given AC1 plus `review_reports/review_T1.md` (any content), the same PASS is accepted. Given instead a single `review_reports/review_T1.md` with a `covers: T1, T2` line and a PASS over `["T1", "T2"]`, it is accepted. The review scope is `review_task_ids` when non-empty, else `completed_tasks`.
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC2:"`
- **AC3** — Given SQLite/HTTP storage, a judge PASS with no code-review rows is still accepted (nothing writes code-review rows in SQLite mode, so the check stays file-mode only); `GATE_REGISTRY.length` is 33 and `UPDATE_STATE_GATE_PIPELINE` keeps its 17 step names in the same order (`MISSING_REVIEW_EVIDENCE` stays step 17).
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC3:"`
- **AC4** — The `MISSING_REVIEW_EVIDENCE` registry entry's `hintStatic` equals `hint.missing_review_evidence`, its `triggerEdge` names the code-reviewer PASS write (not a qa-engineer hand-off), and the comment block of pipeline step `MISSING_REVIEW_EVIDENCE` in `tools/handoff-orchestrator.ts` (base lines 1117–1118) no longer names a code-reviewer → qa-engineer hand-off.
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC4:"`

### E451 — header detection anchored

- **AC5** — Given a design-armed file-mode feature whose visual report's `## Region Diff` table has a row `| card-surface | fail |` (all other rows pass), when the judge PASSes, then it is rejected `VISUAL_REPORT_INCOMPLETE` with `region-diff fail: card-surface`; the same for `| Surfaces.list | material |` (reports `Surfaces.list`). A header row `| surface | result |` or `| Surface ID | result |` is still skipped (no failure reported for it).
  proof: `node --test test/e451-*.test.mjs --test-name-pattern "AC5:"`
- **AC6** — Given the same feature whose `## Structural Assertions` table has a row `| assertionIdle | … | fail |`, when the judge PASSes, then it is rejected `VISUAL_REPORT_INCOMPLETE` with `structural fail: assertionIdle`; a header row whose first cell is `assertion id` / `Assertion ID` is still skipped. This test is red on the base tree (listed in the expected-red manifest).
  proof: `node --test test/e451-*.test.mjs --test-name-pattern "AC6:"`

### E452 — accepted differences must be listed

- **AC7** — A feature's first accepted write stamps `evidence_schema: 3` (`EVIDENCE_SCHEMA_CURRENT` is 3); rejection envelopes on such a feature cite `Evidence schema: v3`. Pin 2 and an absent pin keep every v2 rule (normalized-contains heading match) unchanged; pin 1 keeps the exact anchor.
  proof: `node --test test/e452-*.test.mjs --test-name-pattern "AC7:"`
- **AC8** — Given a design-armed feature pinned 3 whose visual report has Region Diff `| settings.language | accepted |` and `## Allowed Differences` reading `None.`, when the judge PASSes, then it is rejected `VISUAL_REPORT_INCOMPLETE`, the listing for the task carries `msg.allowed_differences_unlisted` naming `settings.language`, and the hint is `hint.visual_report_incomplete`. The same with an empty `## Allowed Differences` section.
  proof: `node --test test/e452-*.test.mjs --test-name-pattern "AC8:"`
- **AC9** — Given AC8 with `settings.language` appearing anywhere in the `## Allowed Differences` section text — a list item, a table cell, or a prose sentence — the PASS is accepted (lenient substring match; no table or list shape imposed). Two accepted surfaces with only one listed → rejected naming only the unlisted one.
  proof: `node --test test/e452-*.test.mjs --test-name-pattern "AC9:"`
- **AC10** — Given the AC8 report on a feature pinned 2, or with no pin, the PASS is accepted (reports judged under an older pin are not re-judged).
  proof: `node --test test/e452-*.test.mjs --test-name-pattern "AC10:"`
- **AC11** — `test/e434-reviewer-visual.test.mjs` AC7 no longer asserts on the fixture text it wrote (base lines 596–598); it asserts server behaviour instead: the listed accepted surface is accepted (state `PASS`) and the same report with the surface id removed from `## Allowed Differences` is rejected `VISUAL_REPORT_INCOMPLETE` naming it.
  proof: `node --test test/e434-reviewer-visual.test.mjs --test-name-pattern "AC7:"`

### E459 — one PASS-evidence rule

- **AC12** — Given a file-mode feature whose `qa_reports/review_T1.md` has standing FAIL (a server-recorded FAIL section last), when the judge PASSes with `completed_tasks: ["T1"]` and no `qa_review`, then it is rejected `MISSING_EVIDENCE` naming T1 with `msg.missing_evidence_file` and `hint.missing_evidence`. The same when the report has standing *none* (hand-written text only, including a hand-written `## Round 1 — PASS — by code-reviewer` heading).
  proof: `node --test test/e459-*.test.mjs --test-name-pattern "AC12:"`
- **AC13** — Given AC12's FAIL-standing report, when the judge PASSes with `qa_review` and `review_task_ids: ["T1"]`, then it is accepted (the same write's auto-record appends a PASS section, so the standing is PASS). Given a covering report (`covers: T2`) with standing PASS, a PASS over `["T2"]` without `qa_review` is accepted; with the covering report at standing FAIL or none, it is rejected `MISSING_EVIDENCE`. The rule applies to every id the PASS write lists in `completed_tasks`, in every pin.
  proof: `node --test test/e459-*.test.mjs --test-name-pattern "AC13:"`
- **AC14** — Given a feature pinned 2 (or no pin) with an expected-red manifest and a judge report whose disposition heading is `## Step 7 — Expected-Red Diff`, when the judge PASSes, then `EXPECTED_RED_DIFF_MISSING` does not fire; under pin 1 the same heading is rejected `EXPECTED_RED_DIFF_MISSING` (exact anchor kept). `## Expected-Red Diff` clears under every pin.
  proof: `node --test test/e459-*.test.mjs --test-name-pattern "AC14:"`
- **AC15** — Given a lane whose `qa_reports/review_T1.md` holds a server-recorded FAIL section followed by a hand-written `## Round 1 — PASS — by code-reviewer`, when the lane-status evidence comparison runs, then T1 is listed under `claimedWithoutEvidence`; a report whose last server-recorded section is PASS by code-reviewer (or by qa-engineer, pre-v5 report) is credited; a server PASS followed by a server FAIL is not credited.
  proof: `node --test test/e459-*.test.mjs --test-name-pattern "AC15:"`
- **AC16** — For each of four fixtures — (a) standing FAIL, (b) server FAIL then hand-written PASS heading, (c) server PASS then server FAIL, (d) standing PASS — the file-mode PASS gate (without `qa_review`), lane-status and drift agree: (a), (b), (c) are not PASS evidence, (d) is. All three read the standing through one exported predicate (the architecture names its module; no reader restates the verdict-heading regex).
  proof: `node --test test/e459-*.test.mjs --test-name-pattern "AC16:"`

### E460 — refusals carry `isError`

- **AC17** — In `test/e431-test-first-server-path.test.mjs` AC14, the `tw_complete_task` refusals for `qa-engineer` and `sr-engineer` keep their exact text and carry `isError: true`; the code-reviewer completion carries no `isError`.
  proof: `node --test test/e431-test-first-server-path.test.mjs --test-name-pattern "AC14"`
- **AC18** — Given a task that is not completed, `tw_rollback_task` returns its existing text (`Task <id> is not completed, cannot rollback.` inside the JSON `error` field) with `isError: true`, in file mode and in SQLite mode; a successful rollback carries no `isError`.
  proof: `node --test test/e460-*.test.mjs --test-name-pattern "AC18:"`

### E458 (8) — hints readable in an adopter workspace

- **AC19** — The `hintStatic` of each of the 18 codes in the Copy / Strings `hint.*` rows (the four named in the ticket, the thirteen in its re-check correction, and `CUT_APPROVAL_REQUIRED`, same defect) equals its Copy text verbatim.
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC19:"`
- **AC20** — No `hintStatic` in `GATE_REGISTRY` (all 33) contains a workspace-relative path under `specs/`, `docs/`, `content/`, `gates/`, `tools/`, `test/`, `research/` or `scripts/` (a placeholder path such as `specs/<feature>.md`, which the adopter's own pm writes, is allowed) or a bare ticket id (`/\bE\d{1,4}\b/`). Server behaviour is otherwise unchanged by the rewording.
  proof: `node --test test/e448-*.test.mjs --test-name-pattern "AC20:"`

### Whole lane

- **AC21** — The full suite passes except reds the lane does not own (each mailed to the integrator); `dist/` holds only artifacts of this lane's sources; `CLAUDE.md` is 250 lines; no `content/**`, `tools/registry.ts`, `tools/transitions.ts`, `schema/**` or compose-golden file changes; the `hasDesignModeRequiringVisual` import in `tools/handoff-orchestrator.ts` is unchanged; `npm audit --audit-level=high` exits 0.
  proof: `node scripts/test-lock.mjs -- npm test; npm audit --audit-level=high; echo "exit=$?"`

## Copy / Strings

Hint rows: the full new `hintStatic` value (leading space kept where the base value had one; the emit site's dynamic prefix is unchanged). Every row is `authored-here` — rewording of a base hint per E458 (8): the dropped sentence named a workspace-relative path or ticket id that does not exist in an adopter workspace; nothing else changes unless the row says so.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| hint.transition_rejected | `" in ALLOWED_TRANSITIONS; pick a next state from the allowed list in this rejection."` | authored-here — E458 (8); base cited `specs/qa-flow-enforcement-architecture.md`; the rejection JSON already carries the allowed list |
| hint.scope_decision_required | `"Scope decision missing. Either: (a) create .current/feature-split.md documenting the multi-feature split decision, or (b) set scope_decision: single-feature in this tw_update_state call with a why field explaining why this feature is appropriately scoped. Gate only fires when design/<feature>.md declares mode != no-design."` | authored-here — E458 (8); drops `See specs/server-scope-decision-gate.md.` |
| hint.cut_approval_required | `"Cut approval missing. PM must present the ticket cut inline in chat and obtain human approval before routing to build. Set cut_approved: true on the pm:In_Progress write after approval (pm SOP, Cut-Approval Gate)."` | authored-here — same defect found by this cut's probe (base cited `content/skill-pm.md §SOP step 7a`, a path and a step that do not exist in an adopter workspace) |
| hint.external_refs_unresolved | `" Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable before routing to build (pm SOP, Resource Audit Gate)."` | authored-here — E458 (8); drops `content/skill-pm.md` and `specs/b8-external-ref-ledger.md` |
| hint.source_credibility_unverified | `" Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry credibility: full-page-composite in the ## Source manifest before routing to build (design-auditor SOP, step 2b)."` | authored-here — E458 (8); drops `content/skill-design-auditor.md` and `specs/e4-design-source-credibility-gate.md` |
| hint.feature_lease_held | `"A second feature cannot take the workspace slot while the incumbent feature's lease is live (per-workspace mutual exclusion: at most one non-terminal feature per workspace_path). Wait for the incumbent to reach PASS or for its lease to expire, or run the new feature in a separate git worktree (distinct workspace_path)."` | authored-here — E458 (8); drops `See specs/e1-feature-scoped-state-design.md.` |
| hint.lease_override_audit_missing | `"A lease_override write must carry its human-attested audit line: prepend a \"lease-override: <reason>\" note as pending_notes[0]."` | authored-here — E458 (8); drops `(gates/lease-override.ts)` and `See specs/e10-lease-override.md AC2.` |
| hint.missing_evidence | `"Provide qa_review naming the id on this PASS write, or make the id's qa_reports/review_<id>.md (or the report whose covers: line names it) end with a server-recorded PASS verdict (file mode) / insert a PASS reports row (SQLite) before PASS."` | authored-here — E459 (1): base said writing the file is enough, which the new rule makes false |
| hint.qa_completion_evidence_missing | `"code-reviewer is the judge: write its report for each newly added id first (qa_review with review_task_ids on a PASS/FAIL write, or qa_reports/review_<id>.md or a covers: file), or drop the unevidenced ids from completed_tasks. No exemption for any edge, status, or review_verdict."` | authored-here — E458 (8); drops `See docs/backlog.md E18 incident (b) + E32.` |
| hint.missing_review_evidence | `"Code-reviewer evidence missing: write review_reports/review_<task-id>.md for each reviewed id (or one report whose covers: line names them) before the code-reviewer PASS write."` | authored-here — E448 ruling (a); base named the removed hand-off to qa-engineer |
| hint.repro_manifest_missing | `"Bugfix-mode fix cannot hand off to code-reviewer until qa_reports/expected-red_<feature>.txt records the failing reproduction test(s) proven red before the fix (skill-sr-engineer). If repro is infeasible, escalate status=Blocked to pm instead."` | authored-here — E458 (8); drops `See specs/e2-bugfix-repro-gate.md AC2/AC6.` |
| hint.visual_report_incomplete | `"qa_reports/visual_<id>.md must contain Canonical State Verification, Structural Assertions, Region Diff (per-surface pass/accepted), Allowed Differences, and a Verdict that normalizes to exactly PASS — every row cleared (skill-reviewer-visual §Report schema; headings may carry prefixes/suffixes but must contain the canonical names, evidence schema v2). From evidence schema v3, every surface whose Region Diff result is accepted must also be named in the Allowed Differences section. Resolve the failed/unverified rows — do NOT pre-accept them (visual verdict is reviewer-visual-owned, Constitution §3.2)."` | authored-here — E452 ruling (a) adds the v3 sentence; nothing else changes |
| hint.visual_provenance_missing | `"Each diffed surface in qa_reports/visual_<id>.md must carry a baseline: fingerprint and a diff-metric: value in its prose sub-section under ## Region Diff. Carry-forward surfaces (annotated \"pass (carried forward — git diff confirms source untouched)\") are exempt; \"B1 tool unavailable — LLM fallback\" satisfies the diff-metric requirement."` | authored-here — E458 (8); drops `See specs/qa-visual-baseline-provenance.md.` |
| hint.baseline_manifest_missing | `"⛔ BASELINE_MANIFEST_MISSING: design/<feature>.md declares mode != no-design but the Source manifest (## Source section) contains no audited baseline rows. The design-auditor must complete step 2c (Mechanical baseline selection) — run the deterministic structural filter, freeze the resulting node-id list with status: audited in the Source manifest, and record filter-conditions + exclusion-reasons in a ## Baseline Selection Provenance section (required for multi-surface selections)."` | authored-here — E458 (8); drops `See specs/figma-baseline-manifest-gate.md.` |
| hint.baseline_provenance_incomplete | `"⛔ BASELINE_PROVENANCE_INCOMPLETE: design/<feature>.md has a multi-surface Source manifest (>=2 audited rows) but the ## Baseline Selection Provenance section is absent or incomplete (requires both filter-conditions: and exclusion-reasons: lines). Record the filter criteria used to select the baseline set per design-auditor SOP step 2c."` | authored-here — E458 (8); drops `See specs/figma-baseline-manifest-gate.md.` |
| hint.pixel_gate_attestation_missing | `"Each non-carry-forward surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward surfaces are exempt."` | authored-here — E458 (8); drops `See specs/qa-visual-pixel-gate-attestation.md.` |
| hint.review_verdict_status_mismatch | `"A code-reviewer APPROVED verdict requires status=PASS or In_Progress; CHANGES_REQUESTED requires status=FAIL. Align review_verdict with status, or omit review_verdict."` | authored-here — E458 (8); drops `See specs/c9-protocol-fields.md AC-5.` |
| hint.non_judge_completed_tasks_rejected | `"completed_tasks on a write not stamped agent_id=code-reviewer is ledger pollution: only code-reviewer, the chain's judge, may grow completed_tasks (or complete tasks through tw_complete_task), backed by the QA_COMPLETION_EVIDENCE_MISSING evidence gate. Omit completed_tasks (or pass []) on this write."` | authored-here — E458 (8); drops `See docs/backlog.md E40.` |
| hint.non_reviewer_verdict_rejected | `"review_verdict is the code-reviewer's verdict field: only an agent_id=code-reviewer write may carry it. Omit review_verdict on this write."` | authored-here — E458 (8); drops `See docs/backlog.md E139.` |
| hint.ac_execution_log_missing | `"Run the AC Execution step (skill-code-reviewer) — execute each proof:-annotated AC in specs/<feature>.md and record command, raw output/exit code, and a per-AC pass/fail verdict under a ## AC Execution Log section in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count; the heading may carry a prefix/suffix but must contain the canonical name, evidence schema v2) before PASS. The server checks the section's presence only — the proofs' truthfulness stays with the judge."` | authored-here — E458 (8); drops `See specs/e3-outcome-shaped-acceptance.md AC3/AC4.` only; `specs/<feature>.md` kept (the adopter's own pm writes it); `evidence schema v2` kept (v3 keeps the v2 heading rule) |
| hint.pass_tasks_incomplete | `"A code-reviewer PASS must account for every open task in the feature's lane ledger: add each listed id to completed_tasks with its QA evidence (a covers: line counts), or void a dropped task with tw_void_task, then retry the PASS. Rows whose description starts with release-engineer or doc-writer (post-PASS work) are exempt."` | authored-here — E458 (8); drops `See docs/backlog.md E247.` |
| msg.missing_evidence_file | `⛔ MISSING_EVIDENCE: <ids>. The last server-recorded verdict for each listed id is not PASS (checked: <report path(s)>, plus any report whose covers: line names the id). ` followed by `hint.missing_evidence` | authored-here — E459 (1); file mode only; SQLite keeps `⛔ MISSING_EVIDENCE: <ids>. ` + hint |
| msg.allowed_differences_unlisted | `accepted but not in ## Allowed Differences: <id>/<id>` (one more `reasons` entry inside the existing `VISUAL_REPORT_INCOMPLETE` per-task `{…}` listing, joined like the others with `; `) | authored-here — E452 ruling (a) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-side checks only) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Removing `MISSING_REVIEW_EVIDENCE` (E448 fix (b), not ruled); any change to `GATE_REGISTRY` length (33) or pipeline step count / order (17).
- `content/**` (served text is already correct once the server enforces E448 and E452; a needed change is mailed to the integrator for lane e453). The errorCode → doc-file mapping comment in `gates/registry.ts` (base line 75 onward) is unchanged: no code is added to or removed from served prose.
- SQLite evidence semantics: SQLite's PASS check already needs a server-written PASS row (rows are written only by the server, so there is no hand-written or verdict-less class); `tools/storage-sqlite.ts` is not in the owned set and is unchanged. Arming `MISSING_REVIEW_EVIDENCE` in SQLite mode (no code path writes code-review rows there).
- Drift's existing trust class for a report with no server-recorded verdict at all (pinned as deliberate in `test/e112-drift-fanout-feature-scope.test.mjs`); this cut changes only how drift recognizes a verdict heading (the shared predicate), not that class. lane-status keeps not crediting such a report.
- `tools/transitions.ts` (including the line-158 migration hint, which names `docs/migration-v5.md`), `tools/registry.ts`, `tools/storage.ts`, `tools/storage-sqlite.ts`, `schema/**`: not owned. No new `tools/*.ts` file.
- The `hasDesignModeRequiringVisual` import in `tools/handoff-orchestrator.ts` (read by `test/context-budget.test.mjs`).
- E461, E462 (wave 2), including E462's comment / ternary work in the same files.
- Release bookkeeping (version, CHANGELOG, backlog done-marks): integrator 5c.

## Dependencies / Prerequisites

None blocking. Base `70d34c6`. No external references (Resource Audit: no URL, design source or outside ticket system in the six rows).

Route: test-first chain **with architect** (manifest: unify the evidence-reading rules, the new `evidence_schema` value's arming condition, and E448's arming point are architecture questions). Order: pm → architect → (architect Open Questions to the integrator mailbox, second pre-review) → qa-engineer → sr-engineer → code-reviewer. The `tw_update_state` input schema has no `chain_path` field; the plan's note to set `chain_path: "test-first"` on the pm write cannot be applied (every file-mode feature is test-first since E435).

Decisions this cut fixes for the architect (PM-owned behaviour, from the ticket rows and rulings; the architecture decides *how*):

- **D-A (E448 arming point)**: pipeline step 17 arms on the incoming `(code-reviewer, PASS)` write in file mode, whatever the previous state; the dead code-reviewer → qa-engineer arm is dropped (that edge is rejected by `ALLOWED_TRANSITIONS` since E435). Scope ids as today. A rejection undoes the same write's qa_review auto-record (existing pipeline behaviour).
- **D-B (evidence_schema 3)**: `EVIDENCE_SCHEMA_CURRENT` becomes 3; v3 = every v2 rule plus the E452 accepted-surface listing; pin 2 / absent / 1 unchanged. The E459 rules are defect fixes and apply under every pin (E459 (2) keeps pin 1's exact anchor by construction).
- **D-C (one PASS-evidence predicate)**: one exported function computes a judge report's standing from server-recorded verdict sections only; the file-mode PASS gate (as `MISSING_EVIDENCE`, after the qa_review auto-record), lane-status and drift's archive-aware lookup all call it. The PASS gate needs standing PASS for every listed id (direct report, else the covering report); lane-status credits standing PASS; drift keeps "standing is not FAIL" (its verdict-less class is out of scope). The architecture names the module (an existing owned file; `tools/storage.ts` is not owned, so the file-mode branch is reached from the orchestrator or an owned gate module).

Questions for the architect (design, not human rulings): where the predicate lives and how the orchestrator's file-mode branch reaches it; whether `hasEvidenceInFile`'s existence semantics stay for `QA_COMPLETION_EVIDENCE_MISSING` (expected: yes, non-PASS writes are unchanged) given `test/covering-evidence.test.mjs` pins its `fs.existsSync(evidencePath(...))` text; how `validateVisualReport` reports the unlisted accepted ids without changing the `VisualReportValidation` consumers outside the lane; the `gates/evidence-schema.ts` header comment for v3.

Schema classification (Cut-Approval Auto-Tier condition): **schema change**. `evidence_schema` is a versioned contract for what a valid judge / visual report is, persisted as a pin in every new feature's `handoff.md`; this cut adds value 3, which changes what a report must contain under it, and a pre-v5 server reading a handoff pinned 3 would silently apply v2 rules. No persisted shape changes (`CURRENT_VERSIONS` and `schema/**` untouched, no migration), but the auto-tier rule does not limit "schema change" to `schema_version`, and an unclassifiable case halts. With `allowSchemaChange` false the manifest tier does not apply: this cut halts for the human.

## Test placement and base reads

- New tests: `test/e448-judge-evidence-checks.test.mjs` (AC1–AC4, AC19, AC20), `test/e451-visual-header-anchor.test.mjs` (AC5, AC6), `test/e452-allowed-differences.test.mjs` (AC7–AC10), `test/e459-pass-evidence-rule.test.mjs` (AC12–AC16), `test/e460-tool-error-flag.test.mjs` (AC18); AC11 in `test/e434-reviewer-visual.test.mjs`, AC17 in `test/e431-test-first-server-path.test.mjs` (qa picks final names inside the owned globs).
- Server scenarios build a temp workspace and call the compiled handlers; a test comparing against base-tree text reads it into memory at capture time and never re-reads a temp directory later (Node 20 ENOENT); no `git show` of the base tree (T-E77-02 meta-test). CI runs Node 20 and 22.
- Hint assertions compare against the Copy table text frozen in the test file, never against `dist/` text the test itself just read.

## Probe — baseline at `70d34c6`

**Baseline** (PM, 2026-11-25, worktree untouched, `node scripts/test-lock.mjs -- npm test`): **4579 tests, 4577 pass, 0 fail, 2 skipped, exit 0.** No red file.

**Run-based probe** (a throwaway copy of the worktree under the PM scratchpad, never the worktree; same shared test lock): the sites were edited roughly as this spec describes — step 17 armed on the file-mode `(code-reviewer, PASS)` write; `EVIDENCE_SCHEMA_CURRENT` 3 with the accepted-surface listing under pin ≥ 3; a standing-PASS check for the PASS write's newly added ids (server-shape heading, direct or covering report); lane-status's PASS header anchored to the timestamp shape; both header patterns anchored; expected-red sliced under the pin; `isError` on both refusals; the 18 hints with their repo paths and ticket ids dropped. Result: **4579 tests, 4513 pass, 64 fail, 2 skipped** in 25 files. Not edited by the probe (their pins found by grep instead): `hint.missing_evidence`, `hint.visual_report_incomplete`, `msg.missing_evidence_file`, the `MISSING_REVIEW_EVIDENCE` `triggerEdge`, the drift predicate.

Red test files (*known* = a reader the plan or the lane row's owned list already names; *new* = found by this probe; *owned* = in the lane row's 擁有 cell):

| test file (failing tests, base line) | why | known / new | owned? |
|---|---|---|---|
| `test/e431-test-first-server-path.test.mjs` (:194, :458, :527 judge PASS without review report; :690, :715 `NON_JUDGE_*` hint; :765 AC15 hint) | E448, E458 (8); AC17 adds `isError` asserts | known | owned |
| `test/e432-judge-report-checks.test.mjs` (:166, :197 standing none; :229 completion hint; :561 chains, three cases; :664 AC14 `EVIDENCE_SCHEMA_CURRENT` 2) | E459 (1), E458 (8), E448, E452 | known | owned |
| `test/e434-reviewer-visual.test.mjs` (:572, :586, :603 judge PASS over a standing-none report) + grep: :90 `hint.visual_report_incomplete` copy | E459 (1), E452; AC11 rewrites AC7 | known | owned |
| `test/e23-evidence-schema.test.mjs` (:99, :110, :121 stamp value 2) | E452 (`EVIDENCE_SCHEMA_CURRENT` 3) | known | owned |
| `test/e32-e33-gate-hardening.test.mjs` (:211) | E448 | known | owned |
| `test/e154-multi-covers.test.mjs` (:61 covering report with standing none) | E459 (1) | known | owned |
| `test/qa-flow.test.mjs` (:1003 `MISSING_REVIEW_EVIDENCE` hint tail) | E448 | known | owned |
| `test/visual-evidence-gate.test.mjs` (:578 `SCOPE_DECISION_REQUIRED` hint equals the base spec's copy) | E458 (8) | known | owned |
| `test/gates-expected-red.test.mjs` (:206, :230, :263) | E448 | known | owned |
| `test/error-code-contract.test.mjs` (grep: :570 free-text allowlist reason quotes the old `MISSING_REVIEW_EVIDENCE` `triggerEdge`) | E448, only if the new `triggerEdge` wording becomes checkable (the architecture keeps it free English or moves the row) | known | owned |
| `test/ac-execution.test.mjs` (:262, :286, :313) | E448: judge PASS fixtures have no `review_reports/` file | **new** | **NOT owned** |
| `test/e139-non-reviewer-verdict.test.mjs` (:103, :182) | E448 | **new** | **NOT owned** |
| `test/e150-completed-tasks-carry-forward.test.mjs` (:214) | E448 | **new** | **NOT owned** |
| `test/e161-qa-suite-result.test.mjs` (:107, :169, :221, :250, :330) | E448 | **new** | **NOT owned** |
| `test/e236-rejected-write-evidence.test.mjs` (:178, :202) | E448 | **new** | **NOT owned** |
| `test/e247-pass-tasks-incomplete.test.mjs` (:90, :113, :146) | E448 | **new** | **NOT owned** |
| `test/e396-covers-expected-red.test.mjs` (:104) | E448 | **new** | **NOT owned** |
| `test/e435-remove-old-path.test.mjs` (:133) | E448 | **new** | **NOT owned** |
| `test/qa-review-scoped-append.test.mjs` (:155) | E448 | **new** | **NOT owned** |
| `test/baseline-manifest-gate.test.mjs` (:501, :589) | E458 (8): pins the dropped spec reference | **new** | **NOT owned** |
| `test/cut-approval-gate.test.mjs` (:595) | E458 (8): `CUT_APPROVAL_REQUIRED` hint (this cut's same-defect addition) | **new** | **NOT owned** |
| `test/e151-resume-of-rejection-hint.test.mjs` (:67, :72, :86, :110) | E458 (8): `TRANSITION_REJECTED` hint | **new** | **NOT owned** |
| `test/pixel-gate-attestation.test.mjs` (:674, :683) | E458 (8) | **new** | **NOT owned** |
| `test/reviewer-completed-tasks-gate.test.mjs` (:225 seven roles, :416) | E458 (8): `NON_JUDGE_COMPLETED_TASKS_REJECTED` hint | **new** | **NOT owned** |
| `test/source-credibility-gate.test.mjs` (:382) | E458 (8) | **new** | **NOT owned** |
| `test/e433-test-first-rules.test.mjs` (:462 AC9: the live `AC_EXECUTION_LOG_MISSING` hint must equal a frozen text) | E458 (8) names that hint | **new** | **owned by lane e453** — cross-lane, for the integrator: either e453 re-pins the live assertion to `hint.ac_execution_log_missing`, or that AC9 assertion is re-allocated |

Manifest-listed readers that stayed green: `test/e177b-lane-status.test.mjs` (its fixtures already use the server shape), `test/context-budget.test.mjs` (import untouched), the `test/error-code-contract.test.mjs` mapping-comment tests (no code added to or removed from served prose). Fifteen red files are outside the owned list and owned by no lane: the integrator confirms them at pre-review and the human adds them to the 擁有 cell in the integrator session before qa re-pins them (T-E448-07 … T-E448-10 wait for that). Over-approximation: the probe's text is close to, not equal to, the final text; the AC13 rule covers every listed id (the probe checked only newly added ones), so a few more same-feature fixtures may go red at qa time.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E448 | re-arm `MISSING_REVIEW_EVIDENCE` on the file-mode code-reviewer PASS write (step 17 stays last; registry hint / triggerEdge reworded; orchestrator comment no longer names the removed hand-off); SQLite unchanged; re-pin the judge-PASS fixtures that lack a `review_reports/` file | none | 2 source + `dist/` + 1 new test + 14 test re-pins | `tools/handoff-orchestrator.ts`、`gates/registry.ts`、`test/e448-*.test.mjs`、`test/e431-test-first-server-path.test.mjs`、`test/e32-e33-gate-hardening.test.mjs`、`test/qa-flow.test.mjs`、`test/gates-expected-red.test.mjs`、`test/error-code-contract.test.mjs`、`test/ac-execution.test.mjs`、`test/e139-non-reviewer-verdict.test.mjs`、`test/e150-completed-tasks-carry-forward.test.mjs`、`test/e161-qa-suite-result.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/e247-pass-tasks-incomplete.test.mjs`、`test/e396-covers-expected-red.test.mjs`、`test/e435-remove-old-path.test.mjs`、`test/qa-review-scoped-append.test.mjs` | — |
| E451 | anchor the Region Diff and Structural Assertions header patterns (`/^surface(\s*id)?$/i`, `/^assertion(\s*id)?$/i`); the assertion test uses `assertionIdle` and is red on the base tree | none | 1 source + 1 new test | `tools/evidence-file.ts`、`test/e451-*.test.mjs` | — |
| E452 | `EVIDENCE_SCHEMA_CURRENT` 3: under pin ≥ 3 every accepted Region Diff surface id must appear in the `## Allowed Differences` text (lenient), else `VISUAL_REPORT_INCOMPLETE`; older pins not re-judged; E434 AC7 asserts server behaviour | E451 | 4 source + 1 new test + 3 test re-pins | `gates/evidence-schema.ts`、`gates/visual.ts`、`tools/handoff-orchestrator.ts`、`gates/registry.ts`、`test/e452-*.test.mjs`、`test/e434-reviewer-visual.test.mjs`、`test/e23-evidence-schema.test.mjs`、`test/e432-judge-report-checks.test.mjs` | — |
| E459 | one PASS-evidence predicate (standing from server-recorded verdict sections only): file-mode judge PASS needs standing PASS per listed id (`MISSING_EVIDENCE`), lane-status credits standing PASS, drift reads verdicts through it; expected-red sliced with `sliceH2SectionAt` under the pin | E448 | 7 source + 1 new test + 3 test re-pins | `tools/evidence-file.ts`、`gates/qa-review.ts`、`gates/expected-red.ts`、`tools/handoff-orchestrator.ts`、`tools/lane-status.ts`、`tools/evidence-lookup.ts`、`gates/registry.ts`、`test/e459-*.test.mjs`、`test/e154-multi-covers.test.mjs`、`test/e432-judge-report-checks.test.mjs`、`test/e434-reviewer-visual.test.mjs` | — |
| E460 | `isError: true` on the `tw_complete_task` judge refusal and on every `tw_rollback_task` error result, file and SQLite mode; asserted in E431 AC14 | none | 1 source + 1 new test + 1 test edit | `tools/tasks.ts`、`test/e460-*.test.mjs`、`test/e431-test-first-server-path.test.mjs` | — |
| E458 | item (8) only: the 18 hints (4 named + 13 in the re-check correction + `CUT_APPROVAL_REQUIRED`, same defect) reworded per Copy / Strings; no workspace-relative repo path or bare ticket id in any hint | E448 | 1 source + 1 new test + 8 test re-pins | `gates/registry.ts`、`test/e448-*.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/e431-test-first-server-path.test.mjs`、`test/baseline-manifest-gate.test.mjs`、`test/cut-approval-gate.test.mjs`、`test/e151-resume-of-rejection-hint.test.mjs`、`test/pixel-gate-attestation.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`、`test/source-credibility-gate.test.mjs` | — |

## Tasks

Order (test-first chain with architect): architect hop (no ledger row) → qa T-01 … T-06, then T-07 … T-10 once the integrator / human add their files to the owned set → sr T-11 … T-17 in id order (they share `tools/handoff-orchestrator.ts` and `gates/registry.ts`), T-18 last → code-reviewer T-19. sr never edits a qa-written test; each sr task appends the reds it leaves to `qa_reports/expected-red_e448-judge-evidence-checks.txt` (`<test file> | <exact test name>`). qa writes `qa_reports/tests_e448-judge-evidence-checks.md` (scenario → test map, red reasons).

- [ ] T-E448-01 [P1] qa-engineer: new `test/e448-judge-evidence-checks.test.mjs` (AC1–AC4, AC19, AC20; Copy hint texts frozen in-test); test report; expected-red manifest | depends_on: none
- [ ] T-E448-02 [P1] qa-engineer: new `test/e451-visual-header-anchor.test.mjs` (AC5, AC6 — AC6 red on base) and `test/e452-allowed-differences.test.mjs` (AC7–AC10); rewrite E434 AC7 in `test/e434-reviewer-visual.test.mjs` (AC11) | depends_on: none
- [ ] T-E448-03 [P2] qa-engineer: new `test/e459-pass-evidence-rule.test.mjs` (AC12–AC16) | depends_on: none
- [ ] T-E448-04 [P2] qa-engineer: E431 AC14 `isError` asserts in `test/e431-test-first-server-path.test.mjs` (AC17); new `test/e460-tool-error-flag.test.mjs` (AC18, file + SQLite) | depends_on: none
- [ ] T-E448-05 [P1] qa-engineer: re-pin owned reds part 1 — `e431-test-first-server-path` (:194, :458, :527, :690, :715, :765), `e432-judge-report-checks`, `e32-e33-gate-hardening`, `e154-multi-covers`, `gates-expected-red` | depends_on: T-E448-04
- [ ] T-E448-06 [P1] qa-engineer: re-pin owned reds part 2 — `e23-evidence-schema`, `qa-flow` (:1003), `visual-evidence-gate` (:578), `e434-reviewer-visual` (:90, :572, :586, :603), `error-code-contract` (:570 only if the architecture's `triggerEdge` needs it) | depends_on: T-E448-02
- [ ] T-E448-07 [P1] qa-engineer: re-pin new reds (E448 fixtures gain a `review_reports/` file) — `ac-execution`, `e139-non-reviewer-verdict`, `e150-completed-tasks-carry-forward`, `e161-qa-suite-result`, `e236-rejected-write-evidence` (after the owned-set addition) | depends_on: T-E448-01
- [ ] T-E448-08 [P1] qa-engineer: re-pin new reds (E448) — `e247-pass-tasks-incomplete`, `e396-covers-expected-red`, `e435-remove-old-path`, `qa-review-scoped-append` (after the owned-set addition) | depends_on: T-E448-01
- [ ] T-E448-09 [P2] qa-engineer: re-pin new reds (E458 (8) hints) — `baseline-manifest-gate`, `cut-approval-gate`, `e151-resume-of-rejection-hint`, `pixel-gate-attestation`, `reviewer-completed-tasks-gate` (after the owned-set addition) | depends_on: T-E448-01
- [ ] T-E448-10 [P2] qa-engineer: re-pin new red `source-credibility-gate` (:382) (after the owned-set addition); `e433-test-first-rules` AC9 only if the integrator re-allocates it to this lane | depends_on: T-E448-01
- [ ] T-E448-11 [P1] sr-engineer: E448 — step 17 arms on the file-mode `(code-reviewer, PASS)` write, dead edge arm and comment removed; registry `MISSING_REVIEW_EVIDENCE` entry (`hintStatic`, `triggerEdge`, `armCondition`) | depends_on: T-E448-01, T-E448-05, T-E448-07, T-E448-08
- [ ] T-E448-12 [P1] sr-engineer: E451 — anchor both header patterns in `tools/evidence-file.ts` | depends_on: T-E448-02
- [ ] T-E448-13 [P1] sr-engineer: E452 — `EVIDENCE_SCHEMA_CURRENT` 3 + header comment, accepted-surface listing under pin ≥ 3 in `gates/visual.ts`, `msg.allowed_differences_unlisted` in the orchestrator listing, `hint.visual_report_incomplete` | depends_on: T-E448-02, T-E448-06, T-E448-12
- [ ] T-E448-14 [P2] sr-engineer: E459 (1) — the shared standing predicate (module per architecture), file-mode `MISSING_EVIDENCE` standing-PASS rule + `msg.missing_evidence_file`, `hint.missing_evidence` | depends_on: T-E448-03, T-E448-11, T-E448-13
- [ ] T-E448-15 [P2] sr-engineer: E459 (2)(3) — expected-red under the pin (`gates/expected-red.ts` + orchestrator call), lane-status and drift lookup through the predicate | depends_on: T-E448-14
- [ ] T-E448-16 [P2] sr-engineer: E460 — `isError: true` on both refusals in `tools/tasks.ts` | depends_on: T-E448-04
- [ ] T-E448-17 [P2] sr-engineer: E458 (8) — the remaining hints in `gates/registry.ts` per Copy / Strings (`MISSING_REVIEW_EVIDENCE`, `VISUAL_REPORT_INCOMPLETE`, `MISSING_EVIDENCE` already done by T-11 / T-13 / T-14) | depends_on: T-E448-01, T-E448-09, T-E448-10, T-E448-15
- [ ] T-E448-18 [P1] sr-engineer, last: `npm run build`, `dist/` scope check, full suite, final expected-red manifest, `CLAUDE.md` 250 lines, `npm audit --audit-level=high` (AC21) | depends_on: T-E448-11, T-E448-12, T-E448-13, T-E448-14, T-E448-15, T-E448-16, T-E448-17
- [ ] T-E448-19 [P1] code-reviewer: judge every task (AC Execution Log for AC1–AC21, Expected-Red Diff), `review_reports/review_T-E448-01.md` with a `covers:` line naming every id, PASS over T-E448-01 … T-E448-19 | depends_on: T-E448-18

### Task Budget Map

| id | role | P | files (count) | est. lines | AC |
|---|---|---|---|---|---|
| T-E448-01 | qa-engineer | P1 | `test/e448-judge-evidence-checks.test.mjs` + 2 reports (1) | ~250 | AC1–AC4, AC19, AC20 |
| T-E448-02 | qa-engineer | P1 | `test/e451-*`, `test/e452-*`, `test/e434-reviewer-visual.test.mjs` (3) | ~280 | AC5–AC11 |
| T-E448-03 | qa-engineer | P2 | `test/e459-*` (1) | ~250 | AC12–AC16 |
| T-E448-04 | qa-engineer | P2 | `test/e431-…`, `test/e460-*` (2) | ~120 | AC17, AC18 |
| T-E448-05 | qa-engineer | P1 | 5 owned tests | ~120 | AC1, AC7, AC12, AC14, AC19 |
| T-E448-06 | qa-engineer | P1 | 5 owned tests | ~100 | AC4, AC7, AC8, AC12, AC19 |
| T-E448-07 | qa-engineer | P1 | 5 tests (new reds) | ~60 | AC1 |
| T-E448-08 | qa-engineer | P1 | 4 tests (new reds) | ~50 | AC1 |
| T-E448-09 | qa-engineer | P2 | 5 tests (new reds) | ~60 | AC19 |
| T-E448-10 | qa-engineer | P2 | 1–2 tests (new reds) | ~15 | AC19 |
| T-E448-11 | sr-engineer | P1 | `tools/handoff-orchestrator.ts`, `gates/registry.ts` (2) | ~40 | AC1–AC4 |
| T-E448-12 | sr-engineer | P1 | `tools/evidence-file.ts` (1) | ~10 | AC5, AC6 |
| T-E448-13 | sr-engineer | P1 | `gates/evidence-schema.ts`, `gates/visual.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts` (4) | ~80 | AC7–AC11 |
| T-E448-14 | sr-engineer | P2 | `tools/evidence-file.ts`, `gates/qa-review.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts` (4) | ~120 | AC12, AC13, AC16 |
| T-E448-15 | sr-engineer | P2 | `gates/expected-red.ts`, `tools/handoff-orchestrator.ts`, `tools/lane-status.ts`, `tools/evidence-lookup.ts` (4) | ~80 | AC14–AC16 |
| T-E448-16 | sr-engineer | P2 | `tools/tasks.ts` (1) | ~15 | AC17, AC18 |
| T-E448-17 | sr-engineer | P2 | `gates/registry.ts` (1) | ~60 | AC19, AC20 |
| T-E448-18 | sr-engineer | P1 | `dist/` (build only) | — | AC21 |
| T-E448-19 | code-reviewer | P1 | `qa_reports/review_*.md`, `review_reports/review_T-E448-01.md` | — | all |

AC → implementation task: AC1–AC4 T-11; AC5, AC6 T-12; AC7–AC11 T-13; AC12, AC13 T-14; AC14, AC15 T-15; AC16 T-14, T-15; AC17, AC18 T-16; AC19, AC20 T-17 (+ T-11, T-13, T-14 for their own hints); AC21 T-18.
