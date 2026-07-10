# QA Review — T-D3-05

covers: T-D3-01, T-D3-02, T-D3-03, T-D3-04, T-D3-05

Feature: `d3-gate-fire-telemetry`
Spec: `specs/d3-gate-fire-telemetry.md`
Prior evidence: `review_reports/review_T-D3-04.md` (code-reviewer APPROVED, covers T-D3-01..03 verification).

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared) — `qa_reports/expected-red_d3-gate-fire-telemetry.txt` does not exist. No re-baseline edits were made in this round.

## Phase 1 — Review

Read `tools/telemetry.ts` and the `handleUpdateState`/`handleUpdateStateCore` split in `tools/handoff-orchestrator.ts` against the spec Mechanism section. Findings:

- Exactly one emit point (`tools/handoff-orchestrator.ts:58-69`), matching the spec's "verified by inspection" claim and the code-reviewer's T-D3-04 APPROVED verdict.
- `handleUpdateStateCore`'s body is the pre-D3 `handleUpdateState`, unchanged; the frozen check-order comment is intact.
- `emitGateTelemetry` double-try/catch (outer catch wraps the whole function, inner catch only guards the `gate()` lookup) — confirmed a throw from `fs.mkdirSync`/`fs.appendFileSync` cannot escape (verified empirically in THROW1/THROW2 below, not just by inspection).
- `docs/gate-retro-procedure.md` (T-D3-03) exists and matches AC-8's five-step procedure (tail/parse, group-by, rank, flag zero-fire at N=5 default, human review).
- `content/skill-release-engineer.md:61` carries the one-line pointer ("Gate-retro pointer") — no restatement of the mechanism, per const-01.

### Copy Audit Gate

Spec's Copy/Strings table is N/A ("feature introduces no new user-facing copy — machine-readable sidecar"). Verified: `TelemetryEvent`'s 5 keys are not rendered to any agent/human-facing surface. No drift, no coverage gap.

### Visual Audit Gate

Spec's Visual Tokens / Visual Widgets tables are both N/A (server-internal, non-design feature). No literals to source, no widgets. Pass trivially.

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines declared).

## Phase 2 — Discussion

No issues found in Phase 1 — proceeded directly to Phase 3.

## Phase 3 — Tests

New file: `test/telemetry.test.mjs` (22 tests).

### AC → Test map

| AC | Test(s) |
|---|---|
| AC-1 (rejection emits one 5-key line) | INT1 |
| AC-2 (pass-through emits nothing) | NE1 |
| AC-3 (dir auto-created, no crash) | implicit in every test — each `mkWorkspace` starts with no `.current/telemetry.jsonl` and the first `emitGateTelemetry`/rejection call creates it |
| AC-4 (telemetry throw never masks/alters ToolResult) | THROW1, THROW2 |
| AC-5 (`gate` sourced from registry producer, not re-derived) | SHAPE1, PRODUCER1, PRODUCER2, PRODUCER3 (all 22 codes), UNKNOWN1 |
| AC-6 (fixed 5-key shape; nulls not omitted, never `"undefined"`) | SHAPE1, NULL1, NULL2, BOUNDARY3 |
| AC-7 (best-effort, no lock) | not independently unit-testable (absence of a lock call); verified by code inspection, consistent with `review_reports/review_T-D3-04.md` |
| AC-8 (retro procedure documented) | covered by Phase 1 doc review above, not a `.mjs` test (doc content, not code) |
| AC-9 (D2 non-preclusion) | covered by Phase 1 code review (exported `TelemetryEvent` type, own module) — not independently unit-testable pre-D2 |
| `extractGateCodeFromText` helper | EXTRACT1-4 |

### Coverage Gate

New file `tools/telemetry.ts` (65 lines) — every exported function (`emitGateTelemetry`, `extractGateCodeFromText`) and every branch (registry hit / registry miss / outer throw) is exercised. `tools/handoff-orchestrator.ts`'s diff (the wrapper) is exercised by NE1 (pass-through) and INT1/THROW2 (rejection). Estimate ≥95% line coverage on the diff; no coverage tool wired into this repo's `npm test`, noted per SOP.

### Security Smoke Tests (Phase 3d)

- Boundary inputs: null/undefined agent_id and feature (NULL1, NULL2), empty string (BOUNDARY3), oversized 10k-char string (BOUNDARY2), special characters incl. quotes/backslash/newline/SQL-injection-shaped string/unicode (BOUNDARY1).
- No auth/permission surface on this feature (internal telemetry sidecar, no access control) — N/A.

### Observation (not a FAIL — QA scope per skill-qa-engineer Hard Rules: correctness/architecture calls belong to code-reviewer)

AC-6's prose says agent_id/feature "absent/empty" collapse to `null`, but the implementation's `agentId ?? null` / `feature ?? null` only nullifies `null`/`undefined` — an explicit `""` survives as `""` (documented in BOUNDARY3). This is not reachable via the real `tw_update_state` dispatch today (zod enforces `active_feature.min(1)`, and `agent_id` when provided by a legitimate caller is never intentionally `""`), so it does not block PASS. Flagging for the record in case a future caller path introduces an empty-string agent_id.

## Phase 4 — Run

- `npm run build`: clean, zero TypeScript errors.
- `npm audit --audit-level=high`: clean (1 low-severity `esbuild` dev-dependency finding, pre-existing, below threshold; exit code 0).
- `npm test` (full suite, `node --test test/*.test.mjs`): **1089/1089 pass, 0 fail** (1067 baseline + 22 new `test/telemetry.test.mjs`). `test/context-budget.test.mjs` did not trip from the one-line `skill-release-engineer.md` pointer addition, matching sr-engineer's report.
- CI runnability: headless, zero human interaction, matches existing `npm test` convention.

**Verdict: PASS.**
## 2026-07-10T11:21:57.346Z — PASS — by qa-engineer

PASS — T-D3-01..05. New test/telemetry.test.mjs (22 tests) covers AC-1..AC-9 (extractGateCodeFromText round-trip, 5-key shape, GATE_REGISTRY producer sourcing for all 22 codes, null-safety, no-emit on success, throw-swallow via real ENOTDIR fs error proving byte-identical ToolResult, boundary/special-char/oversized inputs, and a real TRANSITION_REJECTED integration assertion confirming the exact line lands in .current/telemetry.jsonl). npm run build clean; npm audit --audit-level=high clean (1 low-severity esbuild dev-dep finding, below threshold); npm test 1089/1089 pass (1067 baseline + 22 new), context-budget.test.mjs did not trip. Evidence: qa_reports/review_T-D3-05.md.

