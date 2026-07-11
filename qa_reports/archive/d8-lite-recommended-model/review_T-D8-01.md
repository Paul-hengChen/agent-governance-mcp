# QA review — T-D8-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-11T08:19:11.780Z — FAIL — by qa-engineer

FAIL — full test suite regression (1106/1107). AC1/AC2/AC3/AC4/AC6/AC7 all independently re-verified PASS (lean bundle re-measured at exactly 4027 ~tok, matches PM claim; out-of-scope files byte-identical). AC5 fails: test/subagent-templates.test.mjs:147 pre-existing tier-consistency guard now mismatches (lite template model=haiku, skill recommended_model=sonnet). Not a flake (reproduced in isolation). Routed to sr-engineer to reconcile the template/skill tier-consistency invariant with this spec's decision (may require spec amendment via PM). Details: qa_reports/review_T-D8-02.md.

## 2026-07-11T08:30:19.921Z — PASS — by qa-engineer

PASS — qa_reports/review_T-D8-03.md (covers T-D8-01, T-D8-02, T-D8-03). Round-1 Amend-Resume: PM amended spec (option b, AC8) to add a narrow, dated MIRROR_EXEMPT_ROLES exemption for `lite` in test/subagent-templates.test.mjs's tier-mirror test, reconciling the intentional divergence between skill-coordinator-lite.md's recommended_model=sonnet and templates/claude-code-agents/lite.md's model=haiku. Implemented as a purely-additive edit (23 ins/0 del) — map + skip-continue only, following the file's existing HAIKU_ROLES/FILE_PATH_DELEGATES convention; assertion still runs/fails for the other 11 roles (confirmed exemption is load-bearing, not dead code). AC1-AC8 all independently re-verified. npm run build clean, npm test 1107/1107 (0 fail, regression from Round 1 resolved), npm audit --audit-level=high clean (1 pre-existing low-severity esbuild advisory, unrelated). Ready for release-engineer (T-D8-REL) and pm/coordinator backlog done-mark (T-D8-DONE) — human decision on release timing, no release bookkeeping performed by QA.

