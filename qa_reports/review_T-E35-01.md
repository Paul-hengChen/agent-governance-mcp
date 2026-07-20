# QA review — T-E35-01

Feature: `e35-gate-pipeline-extraction` (backlog E35, docs/backlog.md
2026-07-20 revision). Spec = the backlog row itself (mini-chain:
sr-engineer → code-reviewer → qa-engineer, PM/architect skipped, per
scope_decision on the handoff). Implementation commit: `fffe3d9`. Code
review: **APPROVED**, zero blocking findings
(`review_reports/review_T-E35-01.md`) — byte-verbatim relocation of the
~848-line gate region mechanically verified (diff empty after
scaffolding-strip), 18-step order matches the frozen sequence, PASS-block
split scope-safe, async/await correct, `gates/registry.ts` comment-only,
zero test-file touches. The reviewer explicitly left one deliverable to QA
per §2: the order-pin test asserting `UPDATE_STATE_GATE_PIPELINE`'s step
names and each step's `codes[]` array — the per-step `codes` arrays were,
until this task, unasserted doc/data companions.

## Phase 1 — Deliverable: order-pin test

Read `tools/handoff-orchestrator.ts` directly (not the ticket's prose
summary, which uses shorthand step names) and transcribed the actual
`UPDATE_STATE_GATE_PIPELINE` array: 18 steps,
`TRANSITION_VALIDATION → STAMP_PROVENANCE_SUSPECT → FEATURE_LEASE →
BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE → SCOPE_DECISION_REQUIRED →
CUT_APPROVAL_REQUIRED → EXTERNAL_REFS_UNRESOLVED →
SOURCE_CREDIBILITY_UNVERIFIED → REPRO_MANIFEST_MISSING →
REVIEW_VERDICT_STATUS_MISMATCH → REVIEWER_COMPLETED_TASKS_REJECTED →
QA_REVIEW_RECORD → QA_COMPLETION_EVIDENCE_MISSING → PASS_MISSING_EVIDENCE →
PASS_VISUAL_SUBGATES → PASS_EXPECTED_RED_DIFF → PASS_AC_EXECUTION_LOG →
MISSING_REVIEW_EVIDENCE`. Note the code-authoritative names differ from the
ticket description's shorthand in several spots (e.g. `SCOPE_DECISION_
REQUIRED` not `SCOPE_DECISION`, `REPRO_MANIFEST_MISSING` not
`REPRO_MANIFEST`, `REVIEW_VERDICT_STATUS_MISMATCH` not
`REVIEW_VERDICT_MISMATCH`) — the pin uses the code's literal names, per the
task's own "code is authoritative" instruction.

Cross-checked every step's `codes[]` against `gates/registry.ts`
`GATE_REGISTRY`/`ALL_GATE_CODES` rather than hand-duplicating two
independent literal lists: flattening all 18 steps' `codes` arrays and
comparing (as a set) to `ALL_GATE_CODES` shows an exact match — 31 codes,
no duplicates, no gaps in either direction. `TRANSITION_VALIDATION`'s codes
are asserted to be the *same array reference* as the registry-exported
`TRANSITION_GATE_CODES` (not a re-typed literal), so the two can never
silently diverge.

Authored `test/e35-pipeline-order.test.mjs` (imports from
`dist/tools/handoff-orchestrator.js` + `dist/gates/registry.js`, matching
the established pin-suite convention in `test/hop-count-transitions.
test.mjs` / `test/error-code-contract.test.mjs`). 6 tests:

1. Pipeline exists and has exactly 18 steps.
2. `t-order-exact` — step NAME sequence matches the frozen order exactly
   (`assert.deepEqual` on the name array).
3. `t-order-exact` — each step's `codes[]` matches the frozen sequence,
   position-by-position.
4. `t-order-exact` — `TRANSITION_VALIDATION.codes` is the same object
   reference as `TRANSITION_GATE_CODES` (not a fork).
5. `t-codes-registry-parity` — the union of every step's `codes[]` equals
   `ALL_GATE_CODES` as a set (no duplicate code across steps, no registry
   code missing from the pipeline, no pipeline code absent from the
   registry).
6. `t-codes-registry-parity` — every step declares a non-empty `codes[]`
   and every code round-trips through `gate()` (i.e. is a real
   `GATE_REGISTRY` entry).

**Teeth check**: manually renamed one step (`STAMP_PROVENANCE_SUSPECT` →
`STAMP_PROVENANCE_SUSPECT_RENAMED`) in the built `dist/tools/handoff-
orchestrator.js` and re-ran the suite in isolation — 2 of 6 tests failed as
expected (the order/name pin and the registry-parity duplicate/set check),
confirming the pin actually fails on rename/reorder/code-drift rather than
passing vacuously. Restored the file from `git status` (dist/ was clean
against HEAD before and after — confirmed via `git status --short
dist/ tools/ gates/ test/`, only the new test file appeared as untracked).

## Phase 2 — Full verification

- `npx tsc --noEmit`: clean, zero errors.
- `npm test` (full suite, synchronous, headless): **1618/1618 pass, 0
  fail, 0 cancelled** (1612 pre-existing baseline + 6 new
  `test/e35-pipeline-order.test.mjs` pins). This run already re-exercises
  every per-gate suite the refactor is supposed to leave behavior-identical
  (cut-approval-gate, source-credibility-gate, repro-first-gate, e18/e23/
  e28/e32 suites, error-code-contract, hop-count-transitions, etc.) — no
  additional duplicate spot-checks were layered on top; the full green
  suite plus the isolated order-pin teeth-check above constitute the
  end-to-end verification for this refactor.
- Boot smoke: spawned `node dist/index.js` directly, confirmed
  `🛡️ Agent Governance MCP is online. (Tools + Prompts + Guards)` on
  stderr.
- No `specs/e35-*.md` file exists (backlog-row spec, mini-chain), so no
  `proof:`-annotated ACs exist to arm `AC_EXECUTION_LOG_MISSING` — the
  gate correctly stays unarmed for this ticket; no `## AC Execution Log`
  section required.

## Verdict

PASS. Order-pin test authored and its teeth verified (fails on rename/
reorder/code-drift, passes on the unmodified build); every step's `codes[]`
cross-checked against `gates/registry.ts` as the single source of truth
(exact set-equality with `ALL_GATE_CODES`, no fork of `TRANSITION_GATE_
CODES`). Full suite 1618/1618 green (1612 pre-existing + 6 new), `tsc
--noEmit` clean, boot smoke confirms server online. No production code
touched by QA — `tools/handoff-orchestrator.ts` / `gates/registry.ts` /
`gates/pipeline.ts` were sr-engineer's diff, already code-reviewer
APPROVED. Files touched: `test/e35-pipeline-order.test.mjs` (new). dist/
unchanged (no src edits by QA).
## 2026-07-20T03:42:24.330Z — PASS — by qa-engineer

PASS — T-E35-01. Authored test/e35-pipeline-order.test.mjs (6 tests): pins UPDATE_STATE_GATE_PIPELINE's 18-step name sequence + each step's codes[] exactly, cross-checks the flattened codes union against gates/registry.ts ALL_GATE_CODES (exact set-equality, 31 codes, no dupes/gaps), and asserts TRANSITION_VALIDATION.codes is the same array reference as TRANSITION_GATE_CODES (no fork). Teeth-verified: a manual rename of one step in the built dist failed 2/6 tests as expected, then restored (dist/tools clean vs HEAD before and after). Full suite 1618/1618 pass (1612 pre-existing + 6 new), 0 fail; npx tsc --noEmit clean; boot smoke confirmed server online banner. No specs/e35-*.md proof:-annotated ACs exist so AC_EXECUTION_LOG_MISSING correctly stayed unarmed. Evidence: qa_reports/review_T-E35-01.md. Commit c542a28.

