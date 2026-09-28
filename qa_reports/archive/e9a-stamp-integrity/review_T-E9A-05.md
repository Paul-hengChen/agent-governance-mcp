# QA Review — e9a-stamp-integrity

covers: T-E9A-01, T-E9A-02, T-E9A-03, T-E9A-04, T-E9A-05

Reviewer: @qa-engineer
Code-reviewer verdict: APPROVED (`review_reports/review_T-E9A-04.md`)

## Phase 0 — Drift note

`tw_detect_drift` at claim-time surfaces 39 historical `[x]`-completed rows
in `tasks.md` not reflected in handoff state (`T-C5C18-09` .. `T-E7-DONE`),
plus the expected forward-drift of `T-E9A-01/02/03` (handoff says completed,
task list not yet checked — normal until this session's `tw_complete_task`
calls land). This is pre-existing accumulated drift from prior
sessions/features, unrelated to e9a-stamp-integrity. Noted, not reconciled,
per assignment.

## Phase 0.5 — Expected-Red Diff

No `qa_reports/expected-red_e9a-stamp-integrity.txt` manifest exists.
Phase 0.5: skipped (no expected-red manifest declared).

## Phase 1 — Review

Implementation read in full (re-confirming the code-reviewer's APPROVED
findings, plus scanning for anything a QA-scoped test-authoring pass should
flag): `content/skill-release-engineer.md` (new CRITICAL no-MCP-path relay
Hard rule + amended Output rule), `templates/claude-code-agents/release-
engineer.md` (matching CRITICAL paragraph), `tools/drift.ts`
(`stampAdvisory: string | null` on `DriftReport` + `computeStampAdvisory` +
threading through all return paths). Findings: none beyond what
`review_reports/review_T-E9A-04.md` already recorded (APPROVED, with the
sr-flagged unquoted-YAML-`Date` evasion judged acceptable/out-of-scope —
concur with that disposition; it is an explicitly advisory-only check per
the spec, and all 5 historical hand-edits were quoted).

### Copy Audit Gate / Visual Audit Gate

Spec Copy/Strings and Visual Tokens tables are both `N/A` (feature has no
new user-facing strings or visual literals — internal governance-tooling
fix, mirrors E10/E13). No gate applicable.

### Phase 1.5 — Visual Compare

`design/e9a-stamp-integrity.md` does not exist (no `## Visual Baselines`
declared). Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — Tests

Spec-to-test map (all `proof:`-annotated ACs in `specs/e9a-stamp-
integrity.md`):

- **AC1** → `test/feature-lease.test.mjs`: `E9A-S1` (CRITICAL Hard rule
  heading + no-MCP-tool-invocation-path condition + NEVER hand-edit +
  both file names), `E9A-S2` (exact-literal-payload requirement: bold
  "exact literal `tw_update_state` call", "every argument, verbatim
  values", the `RELAY REQUIRED:` prefix, both named writes — step 2
  opening / step 12 closing), `E9A-S3` (amended Output rule: gated on a
  confirmed state write, own step-13 read-back path, coordinator-relay-
  confirmation path, explicit NEVER-speculative clause, "does NOT claim
  Released"). Extends `test/feature-lease.test.mjs` per the S1-S7 / T-E7-05
  skill-text pinning convention named in the ticket (that file is the
  established release-engineer-skill-adjacent pinning home — it already
  carries the S1-S8 series for this exact skill file).
- **AC2** → `test/subagent-templates.test.mjs`: new case `e9a AC2:
  templates/claude-code-agents/release-engineer.md carries the no-MCP-path
  relay paragraph` (existing file, new case, per spec's explicit proof:
  instruction). Also cross-pinned from the release-engineer-skill-adjacent
  side in `test/feature-lease.test.mjs` (`E9A-S4`, matching paragraph) plus
  a regression guard (`E9A-S5`) that the pre-existing pinned blocks in that
  template — the v3.21.2 CRITICAL-watermark-first-line contract, the D10
  push-rejection CRITICAL paragraph, and the haiku example-reply-suffix
  block — all survive unshifted alongside the new paragraph.
- **AC3** → new file `test/drift-stamp-advisory.test.mjs`: fires on the
  AC3 fixture shape `2026-07-12T01:35:00.000Z` and on a round-hour stamp
  (`2026-07-08T12:00:00.000Z`, the v3.48.0 forensics hit); two "AC3 control"
  tests prove `driftDetected`/`details`/`tasksCompleted`/`tasksIncomplete`
  are byte-identical between a hand-authored-shaped fixture and an entropy-
  shaped fixture carrying the *same* underlying task state, both in the
  clean case and in a case with genuine task drift present.
- **AC4** → same file: null on an ms-entropy stamp
  (`2026-07-13T03:22:38.181Z`, the `tw_update_state` write-path shape).
- **AC5** → the three pre-existing drift suites (`test/drift-
  baseline.test.mjs`, `test/drift-archived-tasks.test.mjs`, `test/drift-
  skew.test.mjs`) run unmodified.
- Additionally (not a numbered AC, but explicitly required by the T-E9A-05
  ticket text and the spec's Architecture note): the three pre-`handoff`
  early returns (version-skew short-circuit, `!handoff && !tasks`,
  `!handoff`) each independently confirmed to yield `stampAdvisory: null` —
  including the version-skew case with a hand-authored-*shaped* stamp
  sitting on disk, proving the early return truly short-circuits before
  `computeStampAdvisory` ever runs.

Security/boundary coverage: the new tests exercise the two edge fixture
shapes the regex is defined against (round-minute-zero-ms boundary,
round-hour boundary) plus the negative control (ms-entropy), and the three
early-return "no handoff object yet" boundaries — matching the shape of
existing drift-suite boundary coverage (empty/absent config, absent
task list, absent handoff).

Coverage: all three touched/new source surfaces
(`content/skill-release-engineer.md`, `templates/claude-code-agents/
release-engineer.md`, `tools/drift.ts`'s `computeStampAdvisory` +
`stampAdvisory` threading) now have direct pinning/behavior tests; no
tooling-measured line-coverage percentage available for markdown content
files (noted per SOP 6c "if tooling can't measure, note explicitly").

## AC Execution Log

`specs/e9a-stamp-integrity.md` declares a `proof:` line on every one of
AC1–AC6. Each executed below, post-build:

| AC | proof | command | output (summary) | verdict |
|---|---|---|---|---|
| AC1 | `E9A-S1`/`E9A-S2`/`E9A-S3` in `test/feature-lease.test.mjs` | `node --test test/feature-lease.test.mjs` | 63/63 pass, including the three new E9A-S1..S3 cases | PASS |
| AC2 | `e9a AC2: ...` in `test/subagent-templates.test.mjs` | `node --test test/subagent-templates.test.mjs` | 18/18 pass, including the new e9a AC2 case | PASS |
| AC3 | `AC3: fires (non-null) on the AC3 fixture shape ...` + round-hour case + two "AC3 control" cases in `test/drift-stamp-advisory.test.mjs` | `node --test test/drift-stamp-advisory.test.mjs` | 8/8 pass — both fixtures fire non-null, both control tests show `driftDetected`/`details`/`tasksCompleted`/`tasksIncomplete` byte-identical across stamp shapes | PASS |
| AC4 | `AC4: null on an ms-entropy stamp ...` in same file | same run | `stampAdvisory === null` on `2026-07-13T03:22:38.181Z` | PASS |
| AC5 | full `test/drift-baseline.test.mjs` + `test/drift-archived-tasks.test.mjs` + `test/drift-skew.test.mjs` | `node --test test/drift-baseline.test.mjs test/drift-archived-tasks.test.mjs test/drift-skew.test.mjs` | 27/27 pass (baseline 10/10, archived-tasks 10/10, skew 7/7) — all pre-existing `driftDetected`/`details` exact-value assertions pass unmodified | PASS |
| AC6 | `npm run build && npm audit --audit-level=high && npm test`, this file | see Phase 4 below | build clean; audit 1 low (non-blocking); test 1408/1408 (isolation re-runs, see flake disposition) | PASS |

## Phase 4 — Run

- `npm run build`: **clean**, zero errors (`tsc` exit 0; `check:version`
  reports OK at 3.81.0, HEAD past the last tag — expected pre-release
  state, release-engineer's concern post-PASS).
- `npm audit --audit-level=high`: **1 low-severity finding** (`esbuild`
  0.27.3–0.28.0, arbitrary file read on the Windows dev server,
  GHSA-g7r4-m6w7-qqqr — transitive devDependency) — zero HIGH/CRITICAL.
  Exit code 0. Gate passes.
- `npm test`: run 3 times to characterize the reviewer-flagged flake.
  - Run 1: **1408 pass / 0 fail / 0 skipped**.
  - Run 2: **1408 pass / 0 fail / 0 skipped**.
  - Run 3: **1407 pass / 1 fail / 0 skipped** — the single failure was
    `test/handoff-write-arg-guard.test.mjs`, `AC-1 (t-ac1-valid-root-path-
    accepted): valid absolute workspace root + plain feature id is not
    rejected by Zod` (test #529 in this build's numbering; the reviewer's
    `review_T-E9A-04.md` cites `#516` from a prior build's numbering — same
    named test, confirmed by grep, the only match for
    `t-ac1-valid-root-path-accepted` in the repo).
  - **Isolation check**: `node --test test/handoff-write-arg-guard.test.mjs`
    run 3 times in isolation → **14/14 pass, 0 fail, all three runs**.
  - **Disposition**: confirmed **PRE-EXISTING environmental flake under
    full-suite concurrency**, exactly as the reviewer's note anticipated —
    not counted as an E9A red. Zero drift-suite or E9A-surface references
    in the failing test; it is a Zod path-validation assertion with no
    relationship to `content/skill-release-engineer.md`, `templates/
    claude-code-agents/release-engineer.md`, or `tools/drift.ts`. All
    E9A-relevant suites (the new `test/drift-stamp-advisory.test.mjs`,
    the extended `test/feature-lease.test.mjs` and `test/subagent-
    templates.test.mjs`, and the three pre-existing drift suites) passed
    deterministically across every run, isolated or full-suite.
  - CI-runnable headlessly, zero human interaction, in all cases.

## Verdict: PASS

All AC1–AC6 traceable to passing tests, executed and logged above. The
one full-suite flake encountered (`test/handoff-write-arg-guard.test.mjs`
#529/#516) was independently reproduced as a full-suite-only, isolation-
clean flake — disposed per the reviewer's advance note, not an E9A
regression. Zero other unexplained reds encountered across three full
`npm test` runs. Build clean, audit clean at the `high` threshold.

Task disposition:
- T-E9A-01: `content/skill-release-engineer.md` Hard rule + amended Output
  rule — reviewed (code-reviewer APPROVED), now pinned (`E9A-S1`/`S2`/`S3`).
- T-E9A-02: `templates/claude-code-agents/release-engineer.md` paragraph —
  reviewed (code-reviewer APPROVED), now pinned (`test/subagent-
  templates.test.mjs` e9a AC2 case; cross-pinned `E9A-S4`/`S5`).
- T-E9A-03: `tools/drift.ts` `stampAdvisory` field — reviewed (code-reviewer
  APPROVED, purely-additive claim verified), now behavior-tested
  (`test/drift-stamp-advisory.test.mjs`, 8 new tests) with the three
  existing drift suites confirmed green unmodified (AC5).
- T-E9A-04: code-review APPROVED (`review_reports/review_T-E9A-04.md`).
- T-E9A-05: this QA pass — tests authored, AC Execution Log recorded, full
  gates green, flake disposition recorded.

T-E9A-REL / T-E9A-DONE left unchecked (release-engineer scope, not QA's).
## 2026-07-13T05:56:16.223Z — PASS — by qa-engineer

PASS. T-E9A-01/02/03 (skill-release-engineer.md CRITICAL no-MCP-path relay Hard rule + amended Output rule; matching templates/claude-code-agents/release-engineer.md paragraph; tools/drift.ts purely-additive stampAdvisory field) reviewed and code-reviewer APPROVED (review_reports/review_T-E9A-04.md). QA authored: E9A-S1/S2/S3 pinning tests in test/feature-lease.test.mjs (AC1: Hard rule + never-hand-edit + RELAY REQUIRED: prefix + exact-literal-payload requirement; amended Output rule gate); new e9a AC2 case in test/subagent-templates.test.mjs plus cross-pinned E9A-S4/S5 in test/feature-lease.test.mjs (AC2, incl. regression guard that pre-existing pinned template blocks survive); new test/drift-stamp-advisory.test.mjs (8 tests, AC3/AC4: fires on hand-authored + round-hour stamps, null on ms-entropy stamp, null on all 3 pre-handoff early returns, driftDetected/details/tasksCompleted/tasksIncomplete byte-identical across stamp shapes). Full existing drift-baseline/drift-archived-tasks/drift-skew suites green unmodified (AC5: 27/27). AC Execution Log for AC1-AC6 recorded in qa_reports/review_T-E9A-05.md. Full verification: npm run build clean; npm audit --audit-level=high = 1 low (esbuild, transitive, non-blocking); npm test run 3x = 1408/1408, 1408/1408, 1407/1407 (1 flake). Flake = test/handoff-write-arg-guard.test.mjs AC-1 t-ac1-valid-root-path-accepted, reproduced as pre-existing full-suite-only concurrency flake, confirmed 3/3 pass in isolation, zero relation to E9A surfaces — disposed per reviewer's advance note, not an E9A regression. Evidence: qa_reports/review_T-E9A-05.md.

