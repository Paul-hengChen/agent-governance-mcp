# QA Review — pm-repair-resume-routing (C1-01..C1-09) — PASS

Covering report for the C1 ticket range in `tasks.md`. `qa_reports/review_C1-01.md`,
`review_C1-03.md`, `review_C1-04.md`, `review_C1-05.md`, `review_C1-06.md`,
`review_C1-07.md`, `review_C1-08.md`, `review_C1-09.md` are pointer stubs to this
file (per-id evidence-check precedent; see backlog C3, and `qa_reports/review_C2-01.md`
for the identical pattern used on the prior C2 feature). C1-10 (backlog mark-done)
stays open — coordinator's post-PASS action, not qa-owned.

## Scope

QA round for `specs/pm-repair-resume-routing.md` +
`specs/pm-repair-resume-routing-architecture.md` (backlog C1). Code review already
**APPROVED** (`review_reports/review_C1-02.md`, covering C1-02..C1-06,C1-08). My
tickets were C1-07 (regression tests, spec AC-8, §2 test-owned) and C1-09 (budget
cap re-baseline, §2 test-owned), plus final PASS verification of all spec ACs.

## C1-07 — regression tests (mine)

Test file discovery: `test/qa-flow.test.mjs` already covers `validateTransition`/
`ALLOWED_TRANSITIONS` end-to-end (it is the file the architecture doc's Test
Surface section names as the primary target — "test/qa-flow.test.mjs (+
siblings)"). Extended it in place rather than creating a new file, per §2
(existing relevant coverage found).

Added 34 new tests (qa-flow.test.mjs went from 74 to 108 passing) covering:

- **Accept** (AC-2): exact marker/exact role for both `code-reviewer` and
  `qa-engineer`; marker co-existing with other `pending_notes` entries.
- **Reject — no marker** (AC-3): empty array and `undefined` `pending_notes`;
  asserted the `allowed` list stays the unchanged static `pm:In_Progress` set
  (no `code-reviewer`/`qa-engineer` leak into it).
- **Reject — wrong-role marker** (AC-3): marker naming the other of the two
  valid roles, in both directions.
- **Reject — malformed marker**: no-space (`resume_of:code-reviewer`), trailing
  junk, out-of-set roles (`architect`, `sr-engineer`), and non-string/null/
  numeric entries mixed into `pending_notes` (defense-in-depth on
  `resumeMarkerNames`'s `typeof n === "string"` guard).
- **Status pinning**: `prev.status=Blocked` (not `In_Progress`) and
  `next.status` of `FAIL`/`Blocked` (not `In_Progress`) all fail to open the
  edge even with an otherwise-valid marker — pins the exact guard predicate,
  not just its net effect.
- **Pre-existing edges unaffected, marker-independent** (AC-8d): all six
  static `pm:In_Progress` targets (`architect`, `sr-engineer`, `researcher`,
  `design-auditor`, `pm:Blocked`, `pm:In_Progress`) still accept both with no
  marker and with an irrelevant marker present (12 tests, parameterized).
- **Round-cap precedence** (architecture Test Surface item 7): `review_round=4`
  and `qa_round=4` each still reject the resume edge — `REVIEW_ROUND_EXCEEDED`/
  `QA_ROUND_EXCEEDED` — despite a valid marker.
- **Gate isolation** (AC-1/AC-8e), integration via the real
  `handleUpdateState` orchestrator (not just `validateTransition`) on a
  design-armed, unattested workspace: `pm→code-reviewer` and `pm→qa-engineer`
  with a valid marker trip **neither** `SCOPE_DECISION_REQUIRED` nor
  `CUT_APPROVAL_REQUIRED`. Two positive controls on the identical armed/
  unattested precondition but the pre-existing `pm→sr-engineer` edge: one with
  neither gate cleared (still fires `SCOPE_DECISION_REQUIRED`), one with scope
  cleared but cut unapproved (still fires `CUT_APPROVAL_REQUIRED`) — proves the
  new edge did not weaken either gate.
- **Marker single-use** (architecture "Consumption" section): round-trips
  `writeHandoffState` to show `pending_notes` are replaced (not merged) on the
  next write, so the marker cannot leak past the edge-crossing write.

`node --test test/qa-flow.test.mjs` → 108/108 pass.

## C1-09 — budget cap re-baseline (mine)

Re-measured all four caps myself against the current working tree
(`composeConstitution` via `dist/prompts/build.js`, chars/4 estimator) before
touching anything — independently confirming sr-engineer's handoff figures
exactly:

| line (pre-edit) | assertion | old cap | measured (mine) | new cap |
|---|---|---|---|---|
| L387 | AC1/AC2 skill-pm stripped body | 2817 | 2918 | 2918 |
| L497 | AC8 design-arm rationale-stripped floor | 4957 | 5260 | 5260 |
| L547 | AC8 teamwork coordinator bundle floor | 8635 | 9050 | 9050 |
| L950 | AC8 non-design floor | 2872 | 3175 | 3175 |

Confirmed via `node --test test/context-budget.test.mjs` before the fix: exactly
4 failures (`not ok 19, 23, 24, 36`), matching this table 1:1 — no unexpected
failures. Each cap change is documented in `test/context-budget.test.mjs` with a
`pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11)` comment block
following the established "qa-owned bump" precedent (old → new figure, reason,
exact-measured-value-no-headroom convention). Companion "saving ≥ N" assertions
were re-checked against the new measured values and both still hold:
- L497/920 raw−stripped saving: 5533−5260 = 273 (≥ 240, was 273 margin at old
  values too — margin essentially unchanged since both sides grew by the same
  bullet).
- L950 design-only strip saving: 5260−3175 = 2085 (≥ 2080 — narrow but holds;
  documented in the comment).

No new test files created (§2 test-ownership on an existing file only).
`node --test test/context-budget.test.mjs` → 43/43 pass post-fix (was 39/43).

## Spec AC verification (all 14)

- **AC-1** (existing gates untouched) — proven three ways in the architecture
  doc and empirically re-verified by the new gate-isolation integration tests
  (C1-07, above): `git diff --stat -- tools/handoff-orchestrator.ts` is empty
  (zero diff), both gate predicates require `next.agent ∈ {architect,
  sr-engineer}` (disjoint from the new edges' `{code-reviewer, qa-engineer}`
  targets), and the two positive-control tests confirm the gates still fire on
  their own edge in the identical armed/unattested precondition. ✓
- **AC-2** (new guarded edges) — `tools/transitions.ts` step 3.5 accepts
  `pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress` iff
  `resumeMarkerNames` matches; additive (no existing `ALLOWED_TRANSITIONS`
  entry removed — `git diff` confirms the table's diff is zero, only new code
  added after it). ✓
- **AC-3** (narrow rejection) — verified: no-marker and wrong-role-marker cases
  fall through to the unchanged `TRANSITION_REJECTED` with the static
  `pm:In_Progress` allowed set (C1-07 tests). ✓
- **AC-4** (architect trust-boundary decision) — `specs/pm-repair-resume-routing-architecture.md`
  picks Option A (self-attested `resume_of:` token, trust class of
  `scope_decision_why`) with full rationale, exact marker grammar, persistence
  location (`pending_notes`, no schema field), file-mode/SQLite parity, and
  module placement (`transitions.ts`, pure). ✓
- **AC-5** (constitution bullet) — `content/const-08-chain-31-mid.md` new
  "Amend-Resume Edge" bullet present immediately after the Cut-Approval Gate
  bullet, before the code-reviewer-approval bullet; states trigger edges,
  mechanism, scoping rationale, and explicit non-interaction with the Scope/Cut
  gates — verbatim match to the architecture doc's Interface Contracts text
  (`grep` confirmed). ✓
- **AC-6** (`skill-coordinator.md` pointer) — Auto-Routing stop-condition 7
  states only the coordinator action (carry `resume_of:` onto the routing
  write) + points to Constitution §3.1; does not restate the mechanism. ✓
- **AC-7** (`skill-pm.md` pointer) — "Amend-Resume declaration" states only the
  PM action (record `resume_of:` on the `pm:In_Progress` write) + points to
  §3.1; does not restate the mechanism. ✓
- **AC-8** (regression tests) — see C1-07 above; all five sub-clauses (a-e)
  covered with 34 new tests. ✓
- **AC-9** (doc sync) — `specs/qa-flow-enforcement-architecture.md` documents
  the two new edges as a distinct conditional-precedence-rule paragraph
  immediately after the round-cap-override paragraph (same pattern), not
  folded into the static table. ✓
- **AC-10** (golden-fixture regen) — `git diff --stat test/fixtures/compose-golden/`
  shows exactly 6 files (`build-full-nondesign.txt`, `build-full-design.txt`,
  `build-full-nondesign-fd.txt`, `build-full-design-fd.txt`, `hook-full.txt`,
  `constitution-monolith.txt`), each `+1 insertion` (the new bullet only);
  `node --test test/compose-equivalence.test.mjs` → 14/14 pass. ✓
- **AC-11** (budget re-baseline, mine) — see C1-09 above. ✓
- **AC-12** (build/test/audit gate) — see Final gate run below. ✓
- **AC-13** (file-mode scope confirmed) — architecture doc states the mechanism
  is identical in both modes (pure in-memory inputs, no persisted field); the
  C1-07 gate-isolation tests exercise it through `FileHandoffStorage` and the
  pure `validateTransition` unit tests are storage-mode-independent by
  construction (no `fs` access in the code path at all). ✓
- **AC-14** (backlog updated) — left open for C1-10 (coordinator/pm,
  post-PASS), per the ticket's own dependency ordering. ✓

## Other verification

- **Zero server-code diff outside the one file**: `git diff --stat -- tools/
  index.ts prompts/ lib/ schema/ guards/` → `tools/transitions.ts | 31
  +++++++++++++++++++++++++++++` only. Confirms the architecture's "Net
  sr-engineer code surface: one file" claim and AC-1's isolation guarantee at
  the diff level, not just by predicate inspection.
- **Verbatim strings**: S01 marker grammar (`resume_of: ${target}`) present in
  `tools/transitions.ts`; S02 constitution bullet opener + full mechanism text
  present verbatim in `content/const-08-chain-31-mid.md`, and the
  `specs/qa-flow-enforcement-architecture.md` doc-sync paragraph independently
  restates the same contract in its own words (not a copy-paste — appropriate
  for a design-doc precedence-rule entry, not a Copy/Strings-gated UI string).
- **Task ids C1-01..C1-09** in `tasks.md` were unchecked `[ ]` at the start of
  this round even though the handoff's `completed_tasks` already listed
  C1-02..C1-08 (code-reviewer/sr-engineer approval landed in handoff state
  before the corresponding `tw_complete_task` calls) — this is the
  handoff-ahead-of-tasks drift `tw_detect_drift` flags; resolved via
  `tw_complete_task` for all nine ids, then a final `tw_detect_drift` →
  `tw_sync` pass to reconcile any residual gap.
- Pre-existing ~127-row tasks-ahead drift (T470...C2-07) is acknowledged
  baseline noise per backlog C4 — left untouched, not reconciled (per ticket
  instruction).

## Final gate run

`npm run build && npm audit --audit-level=high && npm test` — ran sequentially,
all three exit 0:
- `npm run build`: `tsc` clean, zero errors.
- `npm audit --audit-level=high`: 1 pre-existing low-severity esbuild advisory
  (dev-only, Windows-only file-read issue), below the `--audit-level=high`
  threshold — exit 0.
- `npm test`: **858/858 pass**, 0 fail, exit 0. (824 pre-existing + 34 new
  C1-07 tests = 858; the 4 previously-failing context-budget caps are now
  fixed by C1-09.) The known unrelated `test/handoff-write-arg-guard.test.mjs`
  stdio-spawn flake did **not** occur on this run.

## Verdict

**PASS** — all 14 spec ACs verified, C1-01..C1-09 complete, build/audit/test
gate green (858/858), zero server-code drift outside `tools/transitions.ts`,
gate isolation empirically proven via integration tests (not just predicate
inspection), fixture blast radius exactly the new bullet (6 files, +1 line
each). C1-10 (backlog mark-done) intentionally left open for the coordinator's
post-PASS action.
## 2026-07-07T07:44:16.852Z — PASS — by qa-engineer

PASS — all 14 spec ACs verified (specs/pm-repair-resume-routing.md + architecture doc). C1-07 (mine): extended test/qa-flow.test.mjs (existing transitions coverage, no new file per §2) with 34 tests — accept exact-marker/role, reject no-marker/wrong-role/malformed (no-space, trailing junk, out-of-set role, non-string entries), status-pinning (Blocked/FAIL/Blocked reject even with valid marker), all 6 pre-existing pm:In_Progress edges unaffected+marker-independent, round-cap precedence (review/qa round=4 outranks valid marker), gate isolation via real handleUpdateState integration (resume edge trips neither SCOPE_DECISION_REQUIRED nor CUT_APPROVAL_REQUIRED; two positive controls prove pm->sr-engineer still trips both gates on the identical armed/unattested state), marker single-use via writeHandoffState round-trip. 108/108 pass. C1-09 (mine): re-measured all 4 context-budget.test.mjs caps myself (matched sr-engineer's figures exactly) — skill-pm 2817->2918, design-arm constitution 4957->5260, teamwork design-arm bundle 8635->9050, non-design constitution 2872->3175 — each with a versioned "pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11)" comment; companion saving-margin assertions re-verified (273>=240, 2085>=2080), still hold. 43/43 pass post-fix (was 39/43, exactly the 4 caps failing pre-fix, no surprises). Verified zero server-code diff outside tools/transitions.ts (+31 lines only; git diff --stat -- tools/ index.ts prompts/ lib/ schema/ guards/ confirms). Verbatim S01/S02 strings present in const-08-chain-31-mid.md and transitions.ts. AC-9 doc sync in specs/qa-flow-enforcement-architecture.md documents the new edges as a distinct precedence-rule paragraph (not folded into the static table). AC-10 fixtures: exactly 6 compose-golden files, +1 line each; compose-equivalence 14/14 pass. Final gate: npm run build && npm audit --audit-level=high && npm test all exit 0 — 858/858 pass (824 pre-existing + 34 new), 1 pre-existing low-severity esbuild advisory (below --audit-level=high). Known handoff-write-arg-guard stdio flake did not occur. C1-10 (backlog mark-done) intentionally left open for coordinator/pm post-PASS. Evidence: qa_reports/review_C1-02.md (covering; C1-01,03-09 pointer stubs).

