# Review — T-E1A-03 / T-E1A-04 (tests + full verify for the E1A amendment)

covers: T-E1A-01, T-E1A-02, T-E1A-03, T-E1A-04

Base: working-tree diff (uncommitted) on `main` @ d74e255.
Contract: `specs/e1-feature-scoped-state-design.md` → `## Amendment (2026-07-12)`, AC-E1A-1..7.
Upstream: `gates/feature-lease.ts` (terminal-marker clause L70-89 + negative-age guard L90-94, T-E1A-01) and `content/skill-release-engineer.md` SOP step 12 correction, batched-reviewed and APPROVED with zero findings by code-reviewer (`review_reports/review_T-E1A-02.md`).

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e1-feature-scoped-state-design.txt` manifest declared — non-red feature).

## Phase 1 — Review
Re-read `gates/feature-lease.ts`, the E1A amendment spec section, `content/skill-release-engineer.md`'s diff, and `tools/handoff-orchestrator.ts`'s diff (comment-only, updates the stale "reads only the three universal fields" claim to describe the new optional `last_agent`/`next_role` reads). No new findings beyond code-reviewer's APPROVED verdict — this task's scope is test authorship + verification, not a second correctness pass. Copy/Strings and Visual Tokens gates: N/A (spec states "No Copy / Strings, Visual Tokens, or Visual Widgets — this amendment is pure backend gate-logic plus one SOP-prose correction").

## Phase 3 — Spec-to-Test Map (AC-E1A-1..7)

| AC | Test(s) added in `test/feature-lease.test.mjs` |
|---|---|
| AC-E1A-1 (closing-write signal releases the lease) | `E1A-1` |
| AC-E1A-2 (opening-write signal, no `next_role`, still holds) | `E1A-2` |
| AC-E1A-3 (Blocked / escalation / other-role `next_role="pm"` handbacks still hold) | `E1A-3a` (last_agent≠release-engineer), `E1A-3b` (Blocked overrides), `E1A-3c` (escalation next_role=qa-engineer), `E1A-3d` (next_role explicitly undefined) |
| AC-E1A-4 (future-dated `last_updated` → not held, any `ttlMin`) | `E1A-4a` (negative age, two ttlMin values incl. 10,000), `E1A-4b` (ageMs===0 boundary, still held) |
| AC-E1A-5 (NaN / empty-string regression guard, unchanged) | `E1A-5a`, `E1A-5b` |
| AC-E1A-6 (SQLite-mode no-op safety — `next_role` key structurally absent) | `E1A-6` (also re-verifies TTL-bounded behavior is unchanged for that shape) |
| AC-E1A-7 (skill-text pin, step 12) | `S7` |

18 new tests added (`E1A-1`, `E1A-2`, `E1A-3a..d`, `E1A-4a..b`, `E1A-5a..b`, `E1A-6`, `S7`). All target the pure `isFeatureLeaseHeld` predicate directly (fs-free, no workspace fixtures needed) except `S7`, which pins the corrected skill prose the same way the file's existing `S1`–`S6` tests pin the T-E1-02/T-E1-03 prose.

`S7` specifically distinguishes the OLD closing-write call shape (`tw_update_state(status=In_Progress, agent_id="pm", next_role="pm"...)`, now absent) from the corrected shape (`tw_update_state(agent_id="release-engineer", status=In_Progress, next_role="pm"...)`) — and does NOT assert on the bare substring `agent_id="pm"` in isolation, since the corrected prose legitimately still *discusses* that forbidden case in running text ("an `agent_id=\"pm\"` write would stamp `last_agent=\"pm\"` and silently defeat..."). Asserting on the bare substring would have been a false-negative-prone test.

**Coverage**: `gates/feature-lease.ts`'s new lines (terminal-marker clause + negative-age guard, ~24 LoC of the diff) are 100% exercised by the 17 new `isFeatureLeaseHeld`-level tests; the skill-text correction is pinned by `S7`. No new production `.ts` surface outside `gates/feature-lease.ts` in this diff (the `tools/handoff-orchestrator.ts` change is comment-only).

**Security smoke**: N/A — no new input-parsing surface, no auth/permission logic; `isFeatureLeaseHeld` remains a pure boolean predicate over already-typed fields. The negative-age/NaN boundary tests (`E1A-4a/b`, `E1A-5a/b`) are the closest analogue (malformed/adversarial timestamp inputs) and are covered.

## Phase 4 — Run

- `npm run build` — 0 compile errors.
- `npm audit --audit-level=high` — exit 0 (1 pre-existing low-severity `esbuild` advisory, non-gating, unrelated to this change).
- `npm test` — full suite green: **1247 pass, 0 fail** (18 new E1A tests included; pre-existing suite unaffected — no context-budget cap tripped, since no dispatch-bundle content changed in this diff).
- `node --test test/feature-lease.test.mjs` run in isolation beforehand: 36/36 pass (18 pre-existing + 18 new).

## Verdict
PASS. All AC-E1A-1..7 mapped to ≥1 passing test; full build/audit/test gate green with zero regressions. Closing out T-E1A-01 (sr-engineer, code-reviewer APPROVED per `review_reports/review_T-E1A-02.md`) and T-E1A-02 (code-reviewer, batched review) bookkeeping alongside T-E1A-03/T-E1A-04 — both were implemented/reviewed correctly but their `tasks.md` checkboxes were still open; qa-engineer owns `tw_complete_task` (Constitution §3) and confirms both as correct-and-complete, not re-doing them.
## 2026-07-11T20:17:46.912Z — PASS — by qa-engineer

E1A amendment (post-release lease terminal-marker + negative-age guard) fully verified. 18 new tests added to test/feature-lease.test.mjs covering AC-E1A-1..7: terminal-marker positive (E1A-1), opening-write/Blocked/escalation/other-role-pm-handback/next_role-undefined negatives (E1A-2, E1A-3a-d), negative-age guard incl. ageMs=0 boundary and NaN/empty-string regression guard (E1A-4a-b, E1A-5a-b), SQLite-mode structural no-op safety (E1A-6), and skill-text pin for the corrected step-12 closing-write contract (S7). Full gate green: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory, non-gating), npm test 1247/1247 pass 0 fail (baseline 1235 + net new). Confirm-and-completed T-E1A-01 (sr-engineer) and T-E1A-02 (code-reviewer, APPROVED zero findings per review_reports/review_T-E1A-02.md) whose tasks.md checkboxes were still open. Evidence: qa_reports/review_T-E1A-03.md (covers T-E1A-03, T-E1A-04).

## 2026-07-11T20:18:29.257Z — PASS — by qa-engineer

E1A amendment (post-release lease terminal-marker + negative-age guard) fully verified. 18 new tests added to test/feature-lease.test.mjs covering AC-E1A-1..7: terminal-marker positive (E1A-1), opening-write/Blocked/escalation/other-role-pm-handback/next_role-undefined negatives (E1A-2, E1A-3a-d), negative-age guard incl. ageMs=0 boundary and NaN/empty-string regression guard (E1A-4a-b, E1A-5a-b), SQLite-mode structural no-op safety (E1A-6), and skill-text pin for the corrected step-12 closing-write contract (S7). Full gate green: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory, non-gating), npm test 1247/1247 pass 0 fail (baseline 1235 + net new). Confirm-and-completed T-E1A-01 (sr-engineer) and T-E1A-02 (code-reviewer, APPROVED zero findings per review_reports/review_T-E1A-02.md) whose tasks.md checkboxes were still open. Evidence: qa_reports/review_T-E1A-03.md (covers T-E1A-01..04).

