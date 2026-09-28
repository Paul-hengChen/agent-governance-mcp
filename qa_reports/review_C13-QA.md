# QA Review: c13-release-engineer-write-path

covers: C13-01, C13-02, C13-03, C13-04, C13-05, C13-06, C13-07

Reviewer: qa-engineer (sonnet). Base: uncommitted working tree vs HEAD, on top
of code-reviewer's APPROVED verdict (`review_reports/review_C13-REV.md`,
covers C13-01..C13-04). Inputs: `specs/c13-release-engineer-write-path.md`
(authoritative ACs), `specs/qa-flow-enforcement-architecture.md`, the four
production/content files code-reviewer verified, plus the T-MATRIX-A5
precedent block in `test/qa-flow.test.mjs` (~L868-967) and the existing
`test/release-staging.test.mjs` AC5 shim-literal precedent.

## Summary

- **Phase 0** — claimed the review (`tw_update_state agent_id="qa-engineer"`).
- **Phase 1 (re-review)** — read `tools/transitions.ts`, `content/skill-release-engineer.md`,
  `templates/claude-code-agents/release-engineer.md` against the spec's AC1/AC2/AC5/AC6.
  Confirms code-reviewer's APPROVED findings independently (spec/test-mapping
  pass only — correctness/architecture are code-reviewer's domain per SOP
  scope, not re-litigated here): the `qa-engineer:PASS` row is additive
  (`{pm, researcher, release-engineer}`, all `In_Progress`); the new
  `release-engineer:In_Progress` row is exactly `[{pm, In_Progress}]`; the
  CRITICAL STOP-on-⛔ rule and both template hints are present verbatim to
  the spec's Copy/Strings table (`c13.stop.rejection`, `c13.opening-write.notes`).
- **Copy Audit Gate (3a)** — the two Copy/Strings entries in the spec
  (`c13.stop.rejection`, `c13.opening-write.notes`) both render verbatim in
  `content/skill-release-engineer.md`: the CRITICAL rule text matches
  `c13.stop.rejection` exactly, and SOP step 2's `pending_notes` example
  matches `c13.opening-write.notes` exactly. No drift, no coverage gap.
- **Visual Audit Gate (3b) / Phase 1.5** — N/A. Spec Visual Tokens/Widgets are
  both `N/A` ("feature has no visual literals" / "no non-visual widgets");
  no `design/c13-release-engineer-write-path.md` exists. Skipped per SOP,
  logged here as required.
- **Phase 2** — no issues found in Phase 1 (code-reviewer already APPROVED
  C13-01..C13-04); proceeded directly to Phase 3.
- **Phase 3 (tests, §2 QA-owned)** — see AC→Test map below. New `T-MATRIX-C13`
  block (10 tests) appended to `test/qa-flow.test.mjs` (C13-05); five new
  `C13-AC5`/`C13-AC6`/`C13-AC7` tests appended to `test/release-staging.test.mjs`
  (C13-06, chosen over `test/subagent-templates.test.mjs` because
  `release-staging.test.mjs` already reads `SKILL`/`SHIM` and asserts
  release-engineer template literals — same file, same fixtures, no new
  read-file boilerplate).
- **Phase 4 (run, C13-07)** — `npm run build` zero errors; `npm audit --audit-level=high`
  exit 0 (one pre-existing low-severity `esbuild` dev-dependency advisory,
  unrelated to this feature, out of scope); `npm test` — **938/938 passing**,
  run twice back-to-back to flake-check the pre-existing
  handoff-write-arg-guard AC-1 timeout sr-engineer flagged — it did not fire
  in either run (0 failures, 0 skips, both runs ~28.1-28.4s), so no isolation
  investigation was needed this pass.

## AC → Test map

| AC | Test(s) |
|---|---|
| AC1 (qa-engineer:PASS gains release-engineer edge, additive) | `T-MATRIX-C13: qa-engineer:PASS → release-engineer:In_Progress accepted`; `T-MATRIX-C13: qa-engineer:PASS → pm:In_Progress still accepted`; `T-MATRIX-C13: qa-engineer:PASS → researcher:In_Progress still accepted`; `T-MATRIX-C13: qa-engineer:PASS allowed-next contains all three successors` |
| AC2 (release-engineer:In_Progress row is exactly `[{pm, In_Progress}]`) | `T-MATRIX-C13: release-engineer:In_Progress → pm:In_Progress accepted`; `T-MATRIX-C13: release-engineer:In_Progress → sr-engineer:In_Progress REJECTED with non-empty allowed set`; `T-MATRIX-C13: release-engineer:In_Progress → qa-engineer:In_Progress REJECTED with non-empty allowed set`; `T-MATRIX-C13: release-engineer:In_Progress row is present in ALLOWED_TRANSITIONS and non-empty (wedge regression)` |
| AC3 (doc-sync, `specs/qa-flow-enforcement-architecture.md`) | verified by inline read in Phase 1 (code-reviewer's C13-02 finding independently confirmed); no dedicated test — the doc has no executable assertion surface in this repo's test suite (consistent with how prior doc-sync ACs, e.g. T-MATRIX-A5's, were handled) |
| AC4 (T-MATRIX-C13 block: accept/accept/reject+non-empty/wedge-guard/no-regression/round-counter pin) | all 10 tests above plus `computeNewRound holds ... steady across qa-engineer:PASS → release-engineer:In_Progress` and `computeNewRound re-zeros all three counters on release-engineer:In_Progress → pm:In_Progress` |
| AC5 (skill CRITICAL rule + opening-write step, verbatim) | `C13-AC5: skill-release-engineer.md contains the verbatim CRITICAL STOP-on-⛔ rule`; `C13-AC5: skill-release-engineer.md no longer contains the old stamp-as-upstream-caller workaround language` |
| AC6 (template's two ≤2-sentence hints, watermark/tw_get_state preserved) | `C13-AC6/AC7: release-engineer.md shim contains the verbatim STOP-on-⛔ reinforcement hint`; `C13-AC6/AC7: release-engineer.md shim contains the verbatim driftBaselineIds reinforcement hint`; `C13-AC6: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered by the new hints` |
| AC7 (npm test asserts AC6 hints + AC5 rule verbatim) | same five `C13-AC5`/`C13-AC6`/`C13-AC7` tests in `test/release-staging.test.mjs`, exercised by `npm test` |
| AC8 (build + full suite green, zero regressions incl. T-MATRIX-A5) | `npm run build` (zero errors) + `npm test` full run (938/938, T-MATRIX-A5's four tests unaffected — confirmed by inspecting the same run's output) |
| AC9 (backlog C13 done-mark) | out of scope for this task — explicitly deferred to pm/coordinator post-release per spec; tracked in `pending_notes` below (C13-08) |

## Coverage note

Coverage tooling is not wired into this repo's `npm test` (`node --test`, no
`c8`/`nyc` instrumentation configured) — noted per SOP 6c. Manual inspection:
every new line in `tools/transitions.ts`'s two additive map entries is
exercised by at least one `T-MATRIX-C13` test (both accept edges, the reject
edge, the static-map presence/shape check); every new/changed literal in
`content/skill-release-engineer.md` and `templates/claude-code-agents/release-engineer.md`
is exercised by at least one `C13-AC5`/`C13-AC6`/`C13-AC7` test.

## Security smoke

No new user input surface, no auth/permission surface change (the `isAgent`
whitelist and `requireQaEngineer`'s `status:"PASS"` reservation are both
untouched by this feature — confirmed by code-reviewer and re-confirmed by
inline read here). Boundary-input smoke tests are not applicable to a pure
routing-table change with no string/numeric parsing surface.

## Regressions

- `T-MATRIX-A5` (four tests, `release-engineer:PASS` row) — all pass unchanged
  in both full-suite runs; the dead `release-engineer:PASS` row remains
  present and untouched per spec Decision 4.
- Full suite: 938/938 both runs, 0 failures, 0 skips, 0 flakes observed for
  the handoff-write-arg-guard AC-1 timeout sr reported.

## Verdict

**PASS** — AC1-AC8 all covered by passing tests; build clean; audit clean at
`--audit-level=high`; full suite green across two consecutive runs with no
flake observed. AC9 (backlog done-mark) is explicitly out of scope for
qa-engineer per spec, carried forward as a post-release pending note.
