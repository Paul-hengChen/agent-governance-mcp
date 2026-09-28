# Review — T-C16-04

covers: T-C16-04, T-C16-05, T-C16C10-06, T-C16-01, T-C16-02, T-C16-03, T-C10-01, T-C10-02, T-C10-03

## Summary
- Feature: c16-c10-role-boundary. code-reviewer APPROVED all six build tasks (review_reports/review_T-C16-01.md, covers: T-C16-01..03, T-C10-01..03) — correctness/architecture/security/performance all "No findings".
- QA scope (this doc): Phase 0.5 expected-red disposition, T-C16-04 (gate-count re-baseline), T-C16-05 (new REVIEWER_COMPLETED_TASKS_REJECTED gate test coverage, file + SQLite mode), T-C16C10-06 (full verification + context-budget cap re-baseline).
- Verdict: PASS.

## Expected-Red Diff

`qa_reports/expected-red_c16-c10-role-boundary.txt` present, 2 entries declared (both qa-owned re-baselines):
1. `test/error-code-contract.test.mjs` — `AC-1/AC-5: GATE_REGISTRY has exactly 21 entries...` (gate-count cap, 21→22).
2. `test/context-budget.test.mjs` — `AC1/AC2: skill-pm stripped token count meets ≤ 3196 cap` (skill-pm token cap, 3377→3473).

Full suite run BEFORE any re-baseline edit (`node --test test/*.test.mjs`, pre-edit tree):

- Both manifest entries confirmed red:
  - `error-code-contract.test.mjs:151` — `expected exactly 21 GateDefinition entries, got 22` (the new `REVIEWER_COMPLETED_TASKS_REJECTED` gate landed at registry position 22, exactly as sr-engineer's manifest describes).
  - `context-budget.test.mjs:487` — `skill-pm stripped body (3473 ~tok) must be ≤ 3377` (T-C10-03's cut-template rule addition, exactly as the manifest describes).
- **Unexplained red found on 1 of 5 full-suite runs** (not on the manifest): `test/handoff-write-arg-guard.test.mjs:180` — `AC-1 (t-ac1-valid-root-path-accepted): valid absolute workspace root + plain feature id is not rejected by Zod`. Disposition: **pre-existing timing flake, not a regression** —
  - Reproduces 0/3 when `test/handoff-write-arg-guard.test.mjs` is run in isolation (ran 3x standalone: 14/14 pass every time).
  - Only surfaces when the full suite (24+ files, many of which spawn `dist/index.js` as a child process) runs back-to-back under load; the test spawns its own stdio child process against a hardcoded `waitMs=2000` — classic contention-sensitive timing budget, not a logic bug.
  - `git diff --stat` against this feature's changeset touches only `content/skill-{code-reviewer,pm,qa-engineer,release-engineer}.md`, `gates/registry.ts`, `tools/handoff-orchestrator.ts`, and their `dist/` build outputs — zero overlap with `test/handoff-write-arg-guard.test.mjs` or the zod schema/handler path it exercises (`tools/registry.ts` UpdateStateArgs, unrelated to `completed_tasks`).
  - Re-ran the full suite 5 times total post-disposition (see Phase 4 below): flake did not recur once re-baselines were applied, consistent with a load-timing artifact rather than a real regression introduced by this diff.
  - Per SOP "expected-red diff regression" escalation route, this would only apply if the red were NOT innocently dispositionable — here it plausibly is (isolated-run stability + zero code overlap), so proceeding to re-baseline rather than escalating to sr-engineer.

Phase 0.5: **clean after disposition** (2/2 manifest entries confirmed red, 1 extra red explicitly dispositioned as a pre-existing unrelated timing flake — not a regression).

## Phase 1 — Review

No new correctness/architecture findings beyond code-reviewer's APPROVED verdict (review_reports/review_T-C16-01.md). Independently re-confirmed at the qa boundary:
- `tools/handoff-orchestrator.ts:279` — `parsed.agent_id === "code-reviewer" && parsed.completed_tasks.length > 0` fires only on code-reviewer-stamped writes; keys on `agent_id`, not the authoring role, so the APPROVED row (`agent_id="qa-engineer"`) is untouched — confirmed empirically (FM4/FM5/SQ3 below), not just by code reading.
- Copy Audit Gate / Visual Audit Gate: N/A — spec's Copy/Strings and Visual Tokens tables are both explicitly "N/A, feature has no user-facing strings/visual literals" (skill-text + server-gate change only). No drift, no coverage gap.
- Phase 1.5 Visual Compare: skipped (no `design/c16-c10-role-boundary.md`, no Visual Baselines H2 — matches `scope_decision_why`: mode=no-design).

## Phase 3 — Tests

### Spec-to-Test map (AC-4)

| AC | Requirement | Test(s) |
|---|---|---|
| AC-4a | code-reviewer write, non-empty `completed_tasks` → rejected w/ `REVIEWER_COMPLETED_TASKS_REJECTED`, file mode | `test/reviewer-completed-tasks-gate.test.mjs` FM1 |
| AC-4a | same, SQLite/HTTP mode | `test/reviewer-completed-tasks-gate.test.mjs` SQ1 |
| AC-4b | Phase-2 claim write (`agent_id=code-reviewer`, `completed_tasks=[]`) unaffected | FM2 (file), SQ2 (SQLite) |
| AC-4b (crash-safety) | `completed_tasks` omitted entirely at the real `tw_update_state` zod boundary defaults to `[]`, no crash | FM3 (full `TOOL_REGISTRY` dispatch path) |
| AC-4c | APPROVED row (`agent_id=qa-engineer`, non-empty `completed_tasks`) unaffected by new gate; `MISSING_REVIEW_EVIDENCE` still fires correctly | FM4 (evidence absent → rejected by `MISSING_REVIEW_EVIDENCE`, not the new gate), FM5 (evidence present → accepted, positive control), SQ3 (SQLite mirror of FM4) |
| AC-3 (registry) | 22nd entry registered, `documentedInProse: true`, byte-literal in producer file | Pre-existing generative parity tests in `test/error-code-contract.test.mjs` (AC-5 registry↔code↔doc parity, internal-consistency tests) — pass unmodified against the new entry, by construction. |
| AC-4 (gate count) | `GATE_REGISTRY` count re-baselined 21→22 | `test/error-code-contract.test.mjs:151` (re-baselined, T-C16-04) |

New test file: `test/reviewer-completed-tasks-gate.test.mjs` (8 tests: FM1-FM5 file mode, SQ1-SQ3 SQLite mode — the SQLite block self-skips gracefully if `better-sqlite3` isn't installed, matching the `test/dispatch-pins.test.mjs` / `test/visual-round-sqlite.test.mjs` precedent).

### Coverage Gate
100% of the new gate's branch conditions (fire / no-fire × file / SQLite backend) exercised; both legitimate pre-existing paths it must NOT disturb (claim write, APPROVED row + downstream `MISSING_REVIEW_EVIDENCE`) are pinned in both storage backends.

### Security Smoke Tests
- Boundary input: `completed_tasks` omitted entirely (FM3) — confirms the zod `.default([])` prevents an `undefined.length` crash at the orchestrator boundary (a client bypassing zod client-side validation, or a legacy caller, cannot crash the server).
- Auth/permission: the gate is itself an access-control boundary (rejects a role from writing ledger state it doesn't own) — covered by FM1/SQ1 (reject) and FM2/SQ2/FM4/FM5/SQ3 (correctly scoped non-interference with adjacent roles' legitimate writes).

## Phase 4 — Run

- `npm run build`: clean, zero errors.
- `npm audit --audit-level=high`: clean (exit 0; 1 pre-existing low-severity `esbuild` dev-dependency advisory, below threshold, unrelated to this feature).
- `npm test` (prebuild + full suite): **1024/1024 pass, 0 fail** (was 1003 tests pre-T-C16-05; +8 new + 13 from concurrent uncommitted work already in tree — net delta from this feature's authored tests is the 8 in `reviewer-completed-tasks-gate.test.mjs`).
- Re-ran the full suite 3 additional times post-re-baseline to confirm stability (no repeat of the FM-unrelated flake dispositioned above): 1024/1024 pass, 0 fail, all 3 runs.
- CI runnability: `node --test test/*.test.mjs` / `npm test` run headlessly, zero human interaction.

## Re-baselines applied

1. `test/error-code-contract.test.mjs` (T-C16-04): `GATE_REGISTRY` / `ALL_GATE_CODES` count 21→22; test title and inline history comment updated to name `REVIEWER_COMPLETED_TASKS_REJECTED` as the 22nd entry (c16-c10-role-boundary), preserving the c15/c9 precedent lineage in the comment.
2. `test/context-budget.test.mjs` (T-C16C10-06): skill-pm stripped-token cap 3377→3473, documented old→new comment following the C2-06/b8/c9 established convention (independently re-measured at exactly 3473 ~tok via `stripRationale(stripOriginTags(body))`; no headroom, per convention).

## Verdict
PASS — AC-1..AC-5 fully covered (AC-1/AC-2/AC-3/AC-5 by sr-engineer + code-reviewer APPROVED; AC-4 by this QA round). Build clean, audit clean, full suite green (1024/1024, verified stable across 3 consecutive runs). No release bookkeeping performed (version bump / CHANGELOG / `docs/backlog.md` done-marking are release-engineer's per this same feature's C10 rule) — deferred to T-C16C10-07.
## 2026-07-09T17:10:25.361Z — PASS — by qa-engineer

PASS. Phase 0.5 expected-red diff: both manifest entries (error-code-contract gate-count 21→22, context-budget skill-pm cap 3377→3473) confirmed red pre-edit; one unrelated pre-existing timing flake (handoff-write-arg-guard.test.mjs, stdio-spawn contention) surfaced on 1/5 full-suite runs, dispositioned as innocent (0/3 in isolation, zero diff overlap) — see qa_reports/review_T-C16-04.md Expected-Red Diff section. Re-baselined both manifest entries. Authored test/reviewer-completed-tasks-gate.test.mjs (8 tests: FM1-5 file mode, SQ1-3 SQLite mode) covering AC-4 reject/allow matrix for REVIEWER_COMPLETED_TASKS_REJECTED. npm run build clean; npm audit --audit-level=high clean (1 pre-existing low-sev esbuild advisory, below threshold); npm test 1024/1024 pass, verified stable across 3 additional consecutive full-suite runs. No release bookkeeping performed (version bump/CHANGELOG/backlog done-marking deferred to release-engineer per this feature's own C10 rule) — routing to release-engineer for T-C16C10-07.

