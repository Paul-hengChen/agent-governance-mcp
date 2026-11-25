# e424-per-scenario-acceptance

Ticket: E424 (`docs/backlog.md` E424 row, 2026-11-19 audit amendment supersedes the older text). Fan-out lane `e424`, post-v5.0.0 wave 1 (`specs/fanout-post-v5-w1.md`), branch `feat/e424-per-scenario-acceptance`, base `d239895`. Route: full v5 chain with architect (gate behaviour change): pm → architect → qa-engineer → sr-engineer → code-reviewer. Cut approval: `human` (manifest row), after integrator pre-review by mailbox.

## Problem Statement

The `AC_EXECUTION_LOG_MISSING` check (`gates/ac-execution.ts`, pipeline step `PASS_AC_EXECUTION_LOG` in `tools/handoff-orchestrator.ts`) arms when `specs/<feature>.md` holds a line-leading `proof:` and is satisfied by the mere presence of a `## AC Execution Log` heading in a judge report for one of the PASS'd ids: an empty section passes, a skipped scenario passes, and `proof:` itself is optional. Since E422 a feature can have a ticket file whose `## Scenarios` (and `## Added during build`) list every expected behaviour with exactly one verification each. Ruling 6 step 1 of the 2026-11-13 discussion (§11.4) asks the machine to check, scenario by scenario, that the judge's acceptance record has a passing entry for every scenario on the ticket. This ticket makes the existing check do that when the spec cites a ticket file — reading files only, executing nothing, under the existing error code — and leaves every feature without a ticket file byte-for-byte unchanged.

## User Stories

- As a human approving a ticket, I want the server to refuse the judge's PASS while any test- or command-verified scenario on the ticket lacks a passing entry in the acceptance record, so that a skipped or failed scenario cannot be waved through by an empty or partial log.
- As code-reviewer (the chain's judge), I want the rejection to name exactly which scenario ids are missing or not passed, so that I can fix the record or the verdict in one round.
- As a ticket author with a `device-or-person` scenario, I want that scenario to be listed as awaiting manual verification and never block the judge's PASS, so that the stop for it stays where the ticket level puts it (§14.2 ruling 15, amending §11.4 ruling 4).
- As an adopter whose features have no ticket file, I want the check to behave exactly as it does today, so that upgrading changes nothing for me.

## Acceptance Criteria

Terms. *Ticket path*: the check runs in its per-scenario form because the active feature's spec cites a ticket file (citation form: OQ-1). *Blocking scenario*: a scenario on the cited ticket — under `## Scenarios` or `## Added during build` — whose verification is `test <file> — <title>` or `command <command>` (and `automated test`, subject to OQ-2). *Acceptance record*: the `## AC Execution Log` section of the judge report (`resolveJudgeReport`, `tools/evidence-file.ts`) found for the PASS'd ids by today's traversal (direct report, then `covers:`); which section counts when there are several is OQ-6. *Passing entry*: per the record format in Copy `sop.step8` (OQ-3). Every AC below is exercised through `tw_update_state` in file mode by an `agent_id: "code-reviewer"`, `status: "PASS"` write with non-empty `completed_tasks`, on a fixture workspace whose other PASS gates are satisfied. Test file names are qa-engineer's choice (`test/e424-*.test.mjs`); `proof:` lines below name the behaviour, qa-engineer names the test.

- **AC1** — Given a spec citing a ticket file with three blocking scenarios and an acceptance record with a passing entry for each of the three ids, when code-reviewer writes PASS, then the write is accepted (the step returns no rejection).
  proof: the qa-engineer test for AC1 in `test/e424-*.test.mjs` — the PASS write's result is not an error and contains no `AC_EXECUTION_LOG_MISSING`.
- **AC2** — Given the same ticket and a record with passing entries for two of the three ids, when code-reviewer writes PASS, then it is rejected with `AC_EXECUTION_LOG_MISSING` and the text names the missing id (Copy `ac.ticket.no_entry`) and does not name the two recorded ids as missing.
  proof: the qa-engineer test for AC2 — result `isError: true`, text contains `AC_EXECUTION_LOG_MISSING` and the missing id inside the `ac.ticket.no_entry` sub-reason.
- **AC3** — Given the same ticket and a record where one of the three entries is marked `fail`, when code-reviewer writes PASS, then it is rejected with `AC_EXECUTION_LOG_MISSING` and the text names that id under Copy `ac.ticket.not_pass`.
  proof: the qa-engineer test for AC3.
- **AC4** — Given a ticket whose `## Added during build` section holds a blocking scenario, and a record with passing entries for every `## Scenarios` id but none for the added id, when code-reviewer writes PASS, then it is rejected and the text names the added id; with a passing entry for it added, the same write is accepted.
  proof: the qa-engineer test for AC4 (both halves).
- **AC5** — Given a ticket with one `device-or-person` scenario and blocking scenarios: (a) when every blocking scenario has a passing entry and the `device-or-person` scenario has none, then PASS is accepted; (b) when one blocking scenario is missing, then the rejection text lists the `device-or-person` id after Copy `ac.ticket.manual` and does not list it as missing or not passed.
  proof: the qa-engineer test for AC5 (a) and (b).
- **AC6** — Given a spec citing a ticket file and no `## AC Execution Log` section in any judge report for the PASS'd ids, when code-reviewer writes PASS, then it is rejected with `AC_EXECUTION_LOG_MISSING` and every blocking id is named under Copy `ac.ticket.no_entry` — whether or not the spec also has a `proof:` line (the ticket path arms on the citation; OQ-1).
  proof: the qa-engineer test for AC6, run once with and once without a `proof:` line in the spec.
- **AC7** — Given a spec citing a ticket file that does not exist, or whose text `parseTicketFile` reports problems for, when code-reviewer writes PASS, then the outcome follows the OQ-4 ruling (recommended: rejected with `AC_EXECUTION_LOG_MISSING` and Copy `ac.ticket.missing_file` / `ac.ticket.parse`).
  proof: the qa-engineer test for AC7 (missing file; unparsable file).
- **AC8** — Given a feature whose spec cites no ticket file and has a `proof:` line, when code-reviewer writes PASS (a) with the `## AC Execution Log` heading present and (b) without it, then the result text, `isError` flag, telemetry line and on-disk state are byte-identical to the same write on the base tree (`d239895`); `hintStatic` of `AC_EXECUTION_LOG_MISSING` is byte-identical to base. The same holds for a spec with no `proof:` line and no citation (step dormant), and for a spec whose only `Ticket:` line points outside the ticket directory (e.g. at a backlog file).
  proof: the qa-engineer test for AC8, plus the unchanged existing suites `test/ac-execution.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/e448-judge-evidence-checks.test.mjs` (hint pin) and `test/e433-test-first-rules.test.mjs` AC9 green without edits to their assertions.
- **AC9** — Given the ticket path, when the check runs, then the server only reads the spec, the ticket file and the judge reports: it spawns no process and runs no scenario command (a ticket whose `command` verification would create a marker file leaves no marker after the PASS write).
  proof: the qa-engineer test for AC9 (marker-file absence) and a source pin that `gates/ac-execution.ts` imports no `child_process`.
- **AC10** — Given SQLite (HTTP) mode, when code-reviewer writes PASS for a feature whose spec cites a ticket file, then the step is dormant exactly as today (file mode only).
  proof: the qa-engineer test for AC10, or a code-reviewer check that the ticket path sits inside the existing `storage instanceof FileHandoffStorage` branch.
- **AC11** — Given the change, then `GATE_REGISTRY.length` stays 33, `UPDATE_STATE_GATE_PIPELINE` stays 17 steps with the same names and order, no new error code exists, and no existing export of `tools/ticket-file.ts` changes signature.
  proof: `test/e35-pipeline-order.test.mjs`, `test/error-code-contract.test.mjs` and `test/e432-judge-report-checks.test.mjs` AC14 green.
- **AC12** — Given `content/skill-code-reviewer.md` step 8, then it states the record format and the ticket-path rule per Copy `sop.step8`, keeps the substrings `test/e433-test-first-rules.test.mjs` AC5 pins (`**AC Execution**`, `` `## AC Execution Log` ``, `one entry per ticket scenario (per spec AC when there is no ticket file`, `scenario id, command (or test), raw outcome / exit code, pass/fail`), and cites no repo-only path and no bare ticket id.
  proof: `test/e433-test-first-rules.test.mjs` AC5 green; the qa-engineer test for AC12 asserts the Copy `sop.step8` text is present verbatim.
- **AC13** — Given the SOP change, then the `content/skill-code-reviewer.md` size cap in `test/e118-reviewer-ac-completeness.test.mjs` moves to the measured size plus ~100 bytes of slack with a one-line re-baseline comment, the compose goldens (`test/fixtures/compose-golden/**`) and the caps in `test/context-budget.test.mjs` are re-checked against the final text (the PM probe predicts no change: the code-reviewer SOP is not in any compose bundle) and recaptured only if they move, each hunk explained (planned single sr → qa return), and the full suite is green.
  proof: `node scripts/test-lock.mjs -- npm test` exit 0 at the lane HEAD.

## Copy / Strings

All text is new except where noted. `{…}` = dynamic interpolation at the emit site. None of these strings may cite a repo-only path or a bare ticket id (`content/**` and hints ship to adopters); `qa_reports/review_<id>.md` and `## AC Execution Log` are generic workspace paths/headings and are allowed. Exact wording of the dynamic sentences may be adjusted by architect only to settle OQ-1..OQ-8; any change after the cut is a PM amendment.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| ac.ticket.lead | `Spec {specPath} cites ticket file {ticketPath}; the acceptance record must hold a passing entry for every scenario verified by a test or a command. ` | authored-here — opens the ticket-path rejection, replacing the no-ticket sentence `Spec … declares ≥1 proof:-annotated AC but no …` only on the ticket path |
| ac.ticket.no_entry | `No entry for scenario(s): {ids}. ` | authored-here — sub-reason listing missing ids (backlog E424 row: "the offending ids listed as a sub-reason") |
| ac.ticket.not_pass | `Entry not marked pass for scenario(s): {ids}. ` | authored-here — sub-reason for a recorded but non-pass id |
| ac.ticket.manual | `Awaiting manual verification (does not block PASS): {ids}. ` | backlog E424 row — the literal `awaiting manual verification` is the row's wording; sentence frame authored-here |
| ac.ticket.missing_file | `The cited ticket file could not be read: {ticketPath}. ` | authored-here — AC7, subject to OQ-4 |
| ac.ticket.parse | `The cited ticket file has {n} format problem(s); first: {problem}. ` | authored-here — AC7, subject to OQ-4 |
| ac.ticket.many | `The spec cites more than one ticket file ({paths}); cite exactly one. ` | authored-here — subject to OQ-5 |
| ac.ticket.hint | `Under ## AC Execution Log in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count), write one line per ticket scenario: "- <scenario id> — <command or test> — <outcome or exit code> — pass" (or "— fail"). Every scenario verified by a test or a command needs a line ending in "— pass"; device-or-person scenarios are listed for manual verification and never block. The server reads the record and the ticket file only and runs nothing; whether each outcome is true stays with the judge.` | authored-here — static tail of the ticket-path rejection; held in `gates/ac-execution.ts` (or as architect places it) so that `hintStatic` stays byte-identical (AC8) |
| ac.ticket.order | rejection text order: `⛔ AC_EXECUTION_LOG_MISSING: {completed_tasks}. ` + `ac.ticket.lead` + (`ac.ticket.missing_file` \| `ac.ticket.parse` \| `ac.ticket.many` \| `ac.ticket.no_entry`? `ac.ticket.not_pass`?) + `ac.ticket.manual`? + `Inspected: {paths}. ` + `Evidence schema: {label}. ` + `ac.ticket.hint` | authored-here — `Inspected:` and `Evidence schema:` fragments reused verbatim from today's emit site (E23) |
| sop.step8 | replace the last sentence of step 8 (`With a `proof:`-annotated AC and no such section, PASS is rejected `AC_EXECUTION_LOG_MISSING`; the server checks existence only.`) with: ``Write each entry as one line, `- <scenario id> — <command or test> — <outcome or exit code> — pass` (or `— fail`); raw output may follow below it. When the spec cites a ticket file on a line `Ticket: <path to the ticket file>`, the server reads the ticket and rejects PASS `AC_EXECUTION_LOG_MISSING` while any scenario verified by a test or a command (added-during-build ones included) has no line ending in `— pass`; device-or-person scenarios are listed for manual verification and never block. With no ticket file, a `proof:`-annotated AC and no such section, PASS is rejected `AC_EXECUTION_LOG_MISSING`; the server checks existence only. The server runs nothing.`` | authored-here — E424 row amendment (3): "the acceptance record format is the one E433 gives the code-reviewer SOP"; this states that format machine-readably; final citation token per OQ-1 |
| registry.comment | the `AC_EXECUTION_LOG_MISSING` entry's leading comment gains one sentence: `When the spec cites a ticket file, the same step checks each test/command scenario id for a passing acceptance-record entry (gates/ac-execution.ts).` | authored-here — comment only (lane row: "只限 `AC_EXECUTION_LOG_MISSING` 那一筆的 hint 與註解"); `triggerEdge` / `armCondition` / `clearingArtifact` per OQ-7 |
| hintStatic (unchanged) | `AC_EXECUTION_LOG_MISSING.hintStatic` stays byte-identical to base | AC8 — pinned by `test/e433-test-first-rules.test.mjs` AC9 and `test/e448-judge-evidence-checks.test.mjs` |

## References and external-refs audit

Resource Audit Gate grep over the E424 backlog row, the fan-out manifest e424 row and this spec (`http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, `JIRA`): zero external artifacts. Every reference is an in-repo, git-tracked file read at base `d239895`: `docs/backlog.md` (E424 row), `specs/fanout-post-v5-w1.md`, `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` (§11.4, §14.2, §16.1), `docs/ticket-format.md`, `docs/lane-protocol.md`, `docs/lane-protocol-addendum.md`, `gates/ac-execution.ts`, `gates/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/ticket-file.ts`, `tools/config.ts`, `tools/evidence-file.ts`, `content/skill-code-reviewer.md`. `external_refs` is therefore omitted on the PM write (absence = zero external refs, non-blocking).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any new error code; any change to `GATE_REGISTRY` length (33) or to the 17-step `UPDATE_STATE_GATE_PIPELINE`.
- E425's stopped-ticket state and batch summary; E426's PM-side rule for how a spec cites ticket scenarios (the PM SOP text telling a PM to write the citation line belongs to E426 — §16.1 ruling 11; this lane documents the citation only in the judge's step 8, because only the judge's PASS is checked).
- E427's CI check that named tests exist and pass, and its SOP text (qa back-fills test names; code-reviewer confirms the named test checks the scenario) — wave 2.
- Executing any scenario command or test from the server.
- SQLite / HTTP mode.
- Changing the signature of any existing `tools/ticket-file.ts` export. This cut names no new `tools/ticket-file.ts` export and no new `tools/*.ts` file (so `CLAUDE.md` is untouched); if architect needs one, it is an OQ answer that must name it, and the integrator re-checks ownership.
- Changing the no-ticket path in any observable way (AC8).
- Release bookkeeping (version, CHANGELOG, backlog done-mark) — integrator / release-engineer after merge.

## Dependencies / Prerequisites

- E422 (`parseTicketFile`, `TicketVerification`, `TicketScenario.addedDuringBuild` in `tools/ticket-file.ts`; `resolveTicketDir` in `tools/config.ts`), E432 (`resolveJudgeReport` in `tools/evidence-file.ts`), E433 (step 8 of `content/skill-code-reviewer.md`), E435 (code-reviewer is the only PASS writer) — all on `main` at base `d239895`.
- No ticket file exists in this repository today (`docs/tickets/` absent; `ticketDir` unset → default `docs/tickets`), so no existing feature here arms the ticket path; the new behaviour is exercised by fixture workspaces only.
- Source pins the implementation must keep (literal grep at base): `gates/ac-execution.ts` keeps importing and calling `resolveJudgeReport` and `encodeEvidenceId`, has no `taskId.replace(` and no `path.join(…"qa_reports"…)` literal outside comments (`test/e432-judge-report-checks.test.mjs`, `test/e136-evidence-path-injective.test.mjs`); every `armCondition` predicate name stays literally present in `tools/handoff-orchestrator.ts` (`test/error-code-contract.test.mjs`); the registry errorCode → doc-file mapping comment row `//   AC_EXECUTION_LOG_MISSING        skill-code-reviewer.md` stays (`test/e462-stale-comments-wording.test.mjs`).
- Existing exports of `gates/ac-execution.ts` (`hasProofAnnotatedAC`, `hasAcExecutionLogDisposition`, `specFilePath`, `AcArmResult`, `AcDispositionResult`) keep their signatures and results; the ticket path adds new exports only (`test/ac-execution.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/e136-evidence-path-injective.test.mjs` import them).
- Lane protocol: `docs/lane-protocol.md` + `docs/lane-protocol-addendum.md`; `dist/` is committed with the `.ts` change; golden / budget recapture happens after the last implementation task via one planned sr → qa return (manifest "只有實作完才擷取得到的快照", R3 (b)).
- Rulings cited: `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` §11.4 ruling 6 (step 1), §14.2 rulings 15 and 19, §16.1 ruling 11.

### Open Questions (for architect — each needs a written answer in the architecture doc before qa-engineer starts; items marked *needs human ruling* go to the human after the integrator's second pre-review)

- **OQ-1 — How a spec cites a ticket file** (*needs human ruling*; new behaviour). Recommended: a line whose first non-whitespace token is `Ticket:` (case-insensitive, mirroring the `proof:` anchor), followed by a path (bare or backtick-quoted) relative to the repository root, that ends in `.md` and resolves inside the configured ticket directory (`resolveTicketDir`). A `Ticket:` line naming any other path (this repo's specs already write ``Ticket: `docs/backlog.md` E109`` lines) is ignored, so every existing spec stays on the no-ticket path. The ticket path arms on the citation alone, with or without a `proof:` line (AC6). Alternatives: (b) any backtick-quoted path inside the ticket directory anywhere in the spec — rejected: a spec discussing a sibling ticket would arm; (c) map by feature name to a ticket file name — rejected: §16.1 ruling 11 says the spec cites the ticket file. Also settle: a path that normalises outside the ticket directory (`..`) is ignored, never read.
- **OQ-2 — Does `Verification: automated test` (no name yet) block?** Recommended: yes, it counts as a test scenario. Reason: the scope says "test or command"; it is an automated test whose name is not yet back-filled, and until wave 2's back-fill SOP lands most tickets will carry exactly this form, so excluding it would make the check nearly vacuous. A scenario whose verification is `null` (zero, several or unknown verification lines) is a parse problem → OQ-4.
- **OQ-3 — What "records a pass" means** (*needs human ruling*; defines the record format adopters must write). Recommended: inside the acceptance record, an entry is a line (optional `- ` / `* ` list marker) whose first ` — `-separated field is exactly a scenario id from the ticket (case-sensitive) and whose last field is exactly `pass` or `fail` (lower case, trailing whitespace ignored). Lines that do not start with a ticket scenario id are ignored (raw output, prose). An id passes when it has ≥ 1 entry and every entry for it ends in `pass`; an entry ending in anything else counts as not passed. Alternatives: a markdown table `| id | command | outcome | verdict |`; last entry wins (allows a re-run line under a failed one) — weigh against "any fail is a rejection" in step 8.
- **OQ-4 — Cited ticket file missing or not parseable.** Recommended: fail closed — the citation is an explicit opt-in, so a missing/unreadable file, or any `parseTicketFile` problem, rejects PASS under `AC_EXECUTION_LOG_MISSING` with `ac.ticket.missing_file` / `ac.ticket.parse` (first problem shown). Alternative: fall back to the no-ticket behaviour with an advisory — rejected because a typo in the citation would silently disable the check.
- **OQ-5 — More than one ticket citation.** Recommended: two or more distinct ticket-directory citations reject with `ac.ticket.many` (one spec ↔ one ticket; scenario ids such as `S1` collide across tickets, so the record format cannot tell them apart). The same path cited twice counts once. Alternative: check the union with ticket-qualified ids — needs a record-format extension; out of this cut.
- **OQ-6 — Which acceptance record counts.** Today's check accepts the first file in the traversal (direct `review_<id>.md`, then its `covers:` file) whose content holds the heading. Reports are append-only per round, so one file can hold several `## AC Execution Log` sections (one per round) and `sliceH2SectionAt` returns the first. Recommended: same file traversal as today; within the chosen file, read the LAST `## AC Execution Log` section (the current round's), so a round-1 `fail` line does not haunt a round-2 PASS and a stale round-1 `pass` cannot stand in for the current round. Architect states whether this needs a new helper in `tools/evidence-file.ts` (not in the owned set → integrator call) or stays inside `gates/ac-execution.ts`.
- **OQ-7 — Registry doc-facing fields.** `triggerEdge` / `armCondition` / `clearingArtifact` of the entry describe only the no-ticket path. The lane row allows "hint and comment" only. Recommended: leave all three and `hintStatic` byte-identical, put the ticket-path text in `gates/ac-execution.ts` as `ac.ticket.hint`, and add the one comment sentence (`registry.comment`). If architect wants `armCondition` to name a new predicate, it must also appear literally in `tools/handoff-orchestrator.ts` (`test/error-code-contract.test.mjs`) and the integrator must confirm the lane row covers it.
- **OQ-8 — Trigger edge** (settled by PM, architect to confirm). Unchanged: the step runs on `status: "PASS"` with non-empty `completed_tasks`, in file mode; since E435 only `agent_id: "code-reviewer"` can write PASS (tool boundary), so the check arms only on code-reviewer's PASS writes, as today. A ticket with zero blocking scenarios (all `device-or-person`) on the ticket path: recommended accepted with no section required (nothing blocks; the ticket level stops it before acceptance per §14.2 ruling 15). No advisory is added to an accepted PASS (scope: device-or-person ids appear "only in the hint").

## PM probe (2026-11-25, base `d239895`)

Baseline: `node scripts/test-lock.mjs -- npm test` → exit 0, **4704 pass / 4707 tests** (0 fail, 3 skipped, 0 cancelled).

SOP-text probe: step 8 temporarily replaced with Copy `sop.step8` (13115 → 13663 bytes), every test file that names `skill-code-reviewer`, `code-reviewer`, `compose-golden` or `context-budget` run with `node --test`, then reverted with `git checkout`: 1 red of 1914 — `test/e118-reviewer-ac-completeness.test.mjs` AC7 (size cap 13190). `test/context-budget.test.mjs`, `test/compose-equivalence.test.mjs`, `test/e90-golden-capture-completeness.test.mjs`, `test/skill-manifest.test.mjs`, `test/e433-test-first-rules.test.mjs` stayed green.

Code-change probe (literal grep; the code does not exist yet). The step name `PASS_AC_EXECUTION_LOG`, its code list, `hintStatic`, the no-ticket emit text and the existing `gates/ac-execution.ts` exports are all held byte-identical by this cut, so readers of those stay green:

| test file | reads | expected | manifest status |
|---|---|---|---|
| `test/e118-reviewer-ac-completeness.test.mjs` | `content/skill-code-reviewer.md` byte size ≤ 13190 | **red** (AC7) until T-E424-06 moves the cap | **newly found** — not in the e424 row's owned list; outside the owned set → integrator to assign under the standing unowned-red rule |
| `test/e424-*.test.mjs` (new) | new behaviour | red until T-E424-03/04/05 | owned (new) |
| `test/ac-execution.test.mjs` | `hasProofAnnotatedAC`, `hasAcExecutionLogDisposition`, `specFilePath`; no-ticket rejection; step-8 label `**AC Execution**` | green (signatures and no-ticket text unchanged) | listed (certain) — predicted green |
| `test/e23-evidence-schema.test.mjs` | ac-execution exports; `Expected heading` / `Inspected:` / `Evidence schema:` text | green | listed (certain) — predicted green |
| `test/e136-evidence-path-injective.test.mjs` | `gates/ac-execution.ts` uses `encodeEvidenceId`, no `taskId.replace(` | green if the source pin is kept | listed (certain) — predicted green |
| `test/e236-rejected-write-evidence.test.mjs` | rejected PASS writes record no evidence | green | listed (certain) — predicted green |
| `test/e35-pipeline-order.test.mjs` | 17 step names and codes | green (no step change) | listed (certain) — predicted green |
| `test/error-code-contract.test.mjs` | registry fields, `armCondition` predicate names in the orchestrator, hint parity | green under OQ-7's recommendation; red only if architect rewrites registry doc fields | listed (certain) — conditional |
| `test/e432-judge-report-checks.test.mjs` | `gates/ac-execution.ts` imports/calls `resolveJudgeReport`, no `qa_reports` literal; counts 33/17 | green if pins kept | listed (possible) — predicted green |
| `test/e433-test-first-rules.test.mjs` | step-8 substrings (AC5), `hintStatic` (AC9) | green (substrings kept, hint unchanged) | listed (possible) — predicted green |
| `test/e448-judge-evidence-checks.test.mjs` | `hintStatic` verbatim, step list | green | listed (possible) — predicted green |
| `test/e453-served-text-v5.test.mjs` | codes backtick-quoted in `skill-code-reviewer.md` | green (code still quoted) | listed (possible) — predicted green |
| `test/e462-stale-comments-wording.test.mjs` | registry mapping comment row | green (row kept) | listed (possible) — predicted green |
| `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | compose bundles | green (code-reviewer SOP is not in any compose bundle) | listed (possible) — predicted unchanged |
| `test/e431-test-first-server-path.test.mjs`, `test/e434-reviewer-visual.test.mjs`, `test/e452-allowed-differences.test.mjs`, `test/e459-pass-evidence-rule.test.mjs` | `## AC Execution Log` fixtures on the no-ticket path | green (no ticket citation in their fixtures) | not listed — predicted green |

Red outside the owned set: `test/e118-reviewer-ac-completeness.test.mjs` only (flagged for the integrator; added to this cut's `touches`).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E424 | per-scenario acceptance on the existing `AC_EXECUTION_LOG_MISSING` step: when the spec cites a ticket file, every test/command scenario id (added-during-build included) needs a passing entry in the judge's `## AC Execution Log`; missing / non-pass ids named in the sub-reason; `device-or-person` ids listed as awaiting manual verification, never blocking; reads files only; no-ticket path byte-identical; file mode only; step 8 states the record format; goldens and budgets recaptured | none | 4 source + `dist/` + 1 new test (+ fixtures) + goldens/budget + test re-pins per the PM probe | `gates/ac-execution.ts`、`gates/registry.ts`、`tools/handoff-orchestrator.ts`、`content/skill-code-reviewer.md`、`dist/**`、`test/e424-*.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e118-reviewer-ac-completeness.test.mjs`、`specs/e424-per-scenario-acceptance.md`、`specs/e424-per-scenario-acceptance-architecture.md` | — |

## Tasks

Ledger `.current/e424/tasks.md` (added with `tw_add_task`).

- T-E424-01 [P0] architect: `specs/e424-per-scenario-acceptance-architecture.md` — answer OQ-1..OQ-8, name the predicate(s) and result shape in `gates/ac-execution.ts`, the orchestrator emit-site change, and the test seams | depends_on: none
- T-E424-02 [P0] qa-engineer: write AC1–AC12 as tests in `test/e424-*.test.mjs` (fixtures under `test/fixtures/` if needed) through `tw_update_state`; record reds in `qa_reports/expected-red_e424-per-scenario-acceptance.txt` and interface details in `qa_reports/tests_e424-per-scenario-acceptance.md` | depends_on: T-E424-01
- T-E424-03 [P0] sr-engineer: `gates/ac-execution.ts` — ticket-citation reader (OQ-1/OQ-5), ticket read via `parseTicketFile` + `resolveTicketDir` (OQ-2/OQ-4), acceptance-record entry parser over the chosen section (OQ-3/OQ-6), per-scenario evaluation returning missing / not-passed / manual ids; `ac.ticket.hint` constant; reads files only (AC1–AC7, AC9) | depends_on: T-E424-02
- T-E424-04 [P0] sr-engineer: `tools/handoff-orchestrator.ts` `PASS_AC_EXECUTION_LOG` step — arm on citation or `proof:`; ticket path emits the Copy `ac.ticket.order` text; no-ticket path untouched byte-for-byte; stays inside the file-mode branch; `gates/registry.ts` comment sentence only (AC1–AC8, AC10, AC11); `npm run build` | depends_on: T-E424-03
- T-E424-05 [P1] sr-engineer: `content/skill-code-reviewer.md` step 8 per Copy `sop.step8` (AC12); `npm run build` | depends_on: T-E424-04
- T-E424-06 [P1] qa-engineer (planned single sr → qa return, uses 1 `sr_return`): recapture `test/fixtures/compose-golden/**`, move `test/context-budget.test.mjs` caps and the `test/e118-reviewer-ac-completeness.test.mjs` size cap to measured values with a per-hunk explanation; re-pin any other probe-listed test the change turns red; then back through sr-engineer to code-reviewer (AC13) | depends_on: T-E424-05
