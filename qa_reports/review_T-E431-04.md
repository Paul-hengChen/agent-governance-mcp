# QA review — T-E431-04 (orchestrator wiring), AC11 feature-change defect

Owner choice: T-E431-04. The defect is in the orchestrator wiring that derives the marker passed to `validateTransition` and `effectiveAllowedSuccessors` (`tools/handoff-orchestrator.ts`: `prev_chain_path: fileMode && !feature_changed ? ... : undefined` at the validateTransition call, and `prev_chain_path: feature_changed ? undefined : chainPath` in the successor lookahead). The matrix in `tools/transitions.ts` (T-E431-03) is correct: it already accepts the exits when given the marker.

Spec and AC text: unchanged. Only a test was added.

## AC11 feature-change scenario
Approved AC11: `code-reviewer:PASS` on a marked feature exits to pm, researcher, release-engineer and design-auditor. The step after a PASS almost always changes `active_feature` (next ticket, release feature). Given a marked feature at `code-reviewer:PASS`, when pm/researcher/release-engineer/design-auditor writes `In_Progress` with a DIFFERENT `active_feature`, expected: accepted, new feature unmarked (no `chain_path`, no `sr_return_count`).

## Tests (test/e431-test-first-server-path.test.mjs)
- `AC11: validateTransition accepts all four exits from marked code-reviewer:PASS on a feature change` — GREEN (matrix is right when handed the previous marker).
- `AC11: feature change from marked code-reviewer:PASS accepted via handler for pm, new feature unmarked` — RED
- `... for researcher ...` — RED
- `... for release-engineer ...` — RED
- `... for design-auditor ...` — RED
- Existing `AC11: unmarked code-reviewer PASS rejected as today` — still GREEN (old path untouched).

## Observed vs expected
Observed: all four handler writes return `TRANSITION_REJECTED`; on a feature change the orchestrator passes `prev_chain_path: undefined`, so the exit is judged as unmarked `code-reviewer:PASS`, which has no successors. Expected: accepted, with the new feature persisted unmarked (D5).

Fix hint: on a feature change, judge the `code-reviewer:PASS` exits (transition check and successor lookahead) with the PREVIOUS feature's marker; the new feature still starts unmarked and persists no marker or counter. One site only.

Result: FAIL, routed to sr-engineer.
## 2026-11-20T07:13:35.250Z — FAIL — by qa-engineer

AC11 feature-change exit defect: on a marked feature at code-reviewer:PASS, pm/researcher/release-engineer/design-auditor writing In_Progress with a different active_feature is TRANSITION_REJECTED via the real handler (4 red tests, commit 83af982); validateTransition with the previous marker accepts. Orchestrator passes prev_chain_path undefined on feature_changed. Spec/AC text unchanged. Evidence: qa_reports/review_T-E431-04.md.

