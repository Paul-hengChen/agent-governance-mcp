# Review — T-E424-01

covers: T-E424-01, T-E424-02, T-E424-03, T-E424-04, T-E424-05, T-E424-06

## Round 1 — APPROVED — by code-reviewer

## Summary
- Feature `e424-per-scenario-acceptance`, base `d239895`, diff `d239895...HEAD`. The existing `PASS_AC_EXECUTION_LOG` step gains an additive ticket path: when the spec cites a ticket file (`Ticket: <in-ticket-dir .md path>`), every `test` / `command` / `automated test` scenario (added-during-build included) needs a line ending in `— pass` in the last `## AC Execution Log` section of the chosen judge report; `device-or-person` ids are listed only, never block.
- Source: `gates/ac-execution.ts` (new exports, shared private traversal), `tools/handoff-orchestrator.ts` (ticket block appended after today's unchanged `proof:` block, inside the file-mode guard), `gates/registry.ts` (one comment line), `content/skill-code-reviewer.md` step 8; `dist/**` rebuilt. Tests: `test/e424-per-scenario-acceptance.test.mjs` (AC1-AC12, AC14 end to end), `test/e424-ac-execution-exports.test.mjs` (architecture contracts 1-6), `test/e118-reviewer-ac-completeness.test.mjs` cap re-pin 13190 -> 13760 (AC13).
- Scope: every changed file is in the e424 row's owned set of `specs/fanout-post-v5-w1.md` (+ `test/e118-*`, named in that row's possible-red list and the cut's `touches`). `tools/evidence-file.ts`, `tools/ticket-file.ts`, `tools/config.ts` untouched; no new `tools/*.ts`; `CLAUDE.md` untouched.
- Full suite on a clean tree: 4727 pass / 4730 (0 fail, 3 skipped), exit 0. `npm run build` leaves `dist/` unchanged; `npm audit --audit-level=high` exit 0 (1 low, 6 moderate).
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — gates/ac-execution.ts evaluateTicketAcceptance (blocking ids all passed -> rejected false); tools/handoff-orchestrator.ts PASS_AC_EXECUTION_LOG ticket block
AC2 — implemented — gates/ac-execution.ts missingIds + renderTicketAcceptanceRejection `No entry for scenario(s): …`
AC3 — implemented — gates/ac-execution.ts notPassedIds (any entry whose last field is not `pass`)
AC4 — implemented — parseTicketFile returns added-during-build scenarios in `scenarios`; no special-casing excludes them
AC5 — implemented — manualIds rendered after no_entry / not_pass; never counted as blocking
AC6 — implemented — (a) ticket check arms on citation alone; (b) orchestrator returns today's text before the ticket block runs
AC7 — implemented — `missing-file` / `parse` problems, fail closed (rejected true)
AC8 — implemented — no-citation result `armed: false`; today's block byte-unchanged in source; hintStatic unchanged; verified against base dist (see Correctness)
AC9 — implemented — gates/ac-execution.ts uses fs reads only; no child_process / exec / spawn
AC10 — implemented — ticket call sits inside `if (storage instanceof FileHandoffStorage)` of the step
AC11 — implemented — GATE_REGISTRY 33, pipeline 17 (names/order unchanged), no new code, tools/ticket-file.ts untouched
AC12 — implemented — content/skill-code-reviewer.md step 8 ends with Copy sop.step8 verbatim; E433 substrings kept; no repo-only path / bare ticket id outside the origin tag
AC13 — implemented — e118 AC7 cap 13760 (measured 13663 + 97) with a one-line re-baseline comment; compose goldens and context-budget caps unmoved and green; full suite exit 0
AC14 — implemented — additive ordering in the orchestrator; all-device-or-person ticket has zero blocking ids -> not rejected by the ticket block

## Correctness
Tests (step 4):
- Every AC has an end-to-end test through `handleUpdateState` in file mode with a code-reviewer PASS write; assertions are exact (Copy fragments quoted verbatim, `startsWith` on prefix+lead+no_entry for AC2 so a wrongly-named recorded id would fail; byte-equality between ticket-cited and ticket-free writes for AC6(b)/AC14(a); literal base text for AC8). AC10 is a source-structure pin (allowed by the AC's proof line); AC11/AC12 are registry/content pins as the spec's proof lines prescribe.
- Negative control (worktree copy in the scratchpad, never the worktree): stubbing `evaluateTicketAcceptance` to return not-armed in dist turned AC2-AC7 and AC9 red (7 fail) while AC1/AC8/AC14 stayed green — the rejection tests are not vacuous.
- Base comparison for AC8/AC14: in the same copy, `dist/gates/ac-execution.js`, `dist/gates/registry.js` and `dist/tools/handoff-orchestrator.js` restored from `d239895` (`git show`); AC8 and AC14 pass there too, so the literal "today's text" in the test equals base output and the new tree is byte-identical to it.
- Architecture contracts are unit-tested in `test/e424-ac-execution-exports.test.mjs` (citations incl. fenced / out-of-dir / `..` / absolute / configured ticketDir, last-section slicing, entry parsing incl. DR-6 fail-closed, `many` problem, render order and Inspected fallback).
- Coverage: no line-coverage tooling is wired into `npm test`; not measured. The unit + e2e tests exercise every branch of the new code by inspection (not-armed, many, missing-file, parse, missing, not-pass, manual, zero-blocking).

Implementation:
- No required findings. Probed edges with the built exports: `Ticket: docs/tickets/e9.md\r` accepted; uppercase `PASS` counts as not passed (OQ-3 exact `pass`); `S3—x—pass` without spaces is not an entry (missing, fail closed); `TICKET :` case-insensitive with space before the colon accepted (per contract regex).
- recommended — gates/ac-execution.ts sliceLastAcExecutionLog: the section ends at the first `\n##\s`, fenced or not. Raw output pasted below an entry inside a code fence that contains a `## ` line truncates the section, so later entries read as missing (fail-closed spurious rejection that names the ids). Matches architecture contract 3 and today's `sliceH2SectionAt` rule, so not a defect of this diff; worth a fence-aware end in a later ticket, or a sentence in step 8.
- optional — gates/ac-execution.ts findTicketCitations: `rel.startsWith("..")` also excludes an in-dir file whose name starts with `..` (e.g. `docs/tickets/..e9.md`), which then silently does not arm. Contract-conformant and implausible in practice.

## Quality
- No required findings. Naming follows the module; the traversal refactor (DR-3) keeps `hasAcExecutionLogDisposition` a thin wrapper with identical results (existing suites `test/ac-execution.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/e136-evidence-path-injective.test.mjs` green, no assertion edits).
- Comment check (5d): new comments in `gates/ac-execution.ts`, the orchestrator and the registry are one-to-four-line WHAT/WHY notes. `agc check — comments` reports two `long-block` warnings, both test-file headers: `test/e424-ac-execution-exports.test.mjs:1` (8 lines) and `test/e424-per-scenario-acceptance.test.mjs:1` (13 lines). Kept — recommended trim only: they document the test seam (qa_review-carried record, namespace import so each test reports alone), which is load-bearing for a reader; non-blocking advisory.
- Shipped text (`content/**` step 8, `AC_TICKET_HINT`) cites no repo-only path and no bare ticket id; `qa_reports/review_<id>.md` and `## AC Execution Log` are generic, as the spec allows.
- Copy audit (5a): `ac.ticket.lead`, `no_entry`, `not_pass`, `manual`, `missing_file`, `parse`, `many`, `hint`, `order`, `sop.step8`, `registry.comment` all match the spec Copy table verbatim (grep + tests pinning the literals); `hintStatic` unchanged. No unlisted user-facing string.
- Visual tokens (5b): N/A (spec lists none).

## Architecture
- Matches `specs/e424-per-scenario-acceptance-architecture.md`: six exports with the documented signatures; DR-1 additive ordering exactly as contract 7 (today's block unedited, ticket block appended, both inside the PASS + non-empty `completed_tasks` + FileHandoffStorage guards); DR-2 prefix built at the orchestrator, remainder in the gate module; DR-3 shared private locator; DR-4 local last-section slicer reusing the exported `normalizeHeadingText` read-only; DR-5 fences ignored; DR-6 and DR-7 fail closed.
- Source pins kept: `resolveJudgeReport` / `encodeEvidenceId` imported and called, no `taskId.replace(`, no `qa_reports` path literal; registry `triggerEdge` / `armCondition` / `clearingArtifact` / `hintStatic` and the errorCode → doc-file mapping row untouched; `armCondition` predicate names still present in the orchestrator (`test/error-code-contract.test.mjs` green).
- Strict TS: `npm run build` (tsc) clean.

## Security
- No findings. The cited path is lexically confined to the ticket directory (absolute, drive-letter and `..`-escaping paths rejected before any read); the server reads files only and executes nothing (AC9 marker test + source pin). Rejection text interpolates repo-relative ticket paths and scenario ids from workspace files the caller already controls; no new trust boundary.

## Performance
- No findings. One extra spec read and at most one ticket read per code-reviewer PASS write in file mode; the review-file traversal runs once more on the ticket path only when a citation exists. Entry matching is O(lines × ids) on tiny inputs. No regression vs base on the no-ticket path (one extra spec read + regex scan per PASS write).

## Verdict
APPROVED — every AC (1-14) is implemented and proven by tests that fail without the implementation; the no-ticket path is byte-identical to base, ordering is additive, and only recommended/optional findings remain.
