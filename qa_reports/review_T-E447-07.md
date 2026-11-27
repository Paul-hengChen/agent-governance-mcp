# Review — T-E447-07

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-27T02:16:50.130Z — FAIL — by code-reviewer

suite-result: 4815/4817 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

CHANGES_REQUESTED (round 1). AC1-AC12 are implemented and green. Full suite: 4815 pass / 0 fail / 2 skipped of 4817. All 39 expected-red entries are green and there are no reds off the manifest. Build: no dist diff. npm audit high: exit 0. AC12 docs diff is additions only, apart from the (iii) row, which carries the human-consented DOC-INST-5 period (2026-11-27) as an exact-prefix append. check --cut: APPROVAL_HUMAN plus 14 OUT tokens (12 dist/tools outputs, test/lane-paths, test/e410), as expected. Scope is clean; GATE_REGISTRY 33; pipeline 17.
Required: R1 (scenario, SOP 5a) — 12 user-facing strings that no Copy row lists: bin/agc-init.mjs:486, :615, :1322 (finish usage paragraph), :2056, :2091, :2103, :2274, :2314, :2326, :2328, :2378, :2438. pm sources each as a Copy row, adopting or rewording it, with the human's consent as for DOC-INST-5.
R2 (scenario, then test) — scenarios and tests for the sr-added behaviours: (a) finish with no seed record; (b) --shipped with a lane-changed backlog and findings to number; (c) finish refusals: malformed seed record, blocking ancestor, absent backlog with blocks, malformed pending blocks; (d) reseed refusals: tracked or not-ignored path, not a file in primary, unreadable record, no operand (exit 2), lane-absent unrecorded file seeded fresh; (e) init ticketDir unsafe refusal; (f) check --cut: malformed primary config = off, manifest outside the lane not compared.
R3 (sr) — docs/install.md:235 says specs/abandoned/; it should say specs/archive/<ticket-id>/.
R4 (sr, test by qa) — a lane-changed backlog plus numbering plus a late worktree-remove failure leaves the re-run refusing docs/backlog.md as both-changed (probed); the re-run must complete with nothing newly allocated.
Judgement item (2), D9 git call in a mode-off linked worktree: accepted; the observable output is unchanged.
Item (3): the T-E447-02 amend incident is noted once in the report.
Report: review_reports/review_T-E447-01.md (covers T-E447-01..07).

## 2026-11-27T03:04:44.481Z — PASS — by code-reviewer

suite-result: 4834/4836 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 2, T-E447-10; covers T-E447-01..10). R1 resolved: the 12 strings are Copy rows [A1], kept verbatim, and match the code. R2 resolved: AC13-AC19 with tests. R3 resolved: docs/install.md:235 now names specs/archive/<ticket-id>/. R4 resolved: D11 is built (final backlog composed in planning; lane copy first, then primary; no second primary write); AC15 is green, and two judge probes re-run to completion (primary write failed / lane write failed). AC1-AC20 (AC10 as amended) are implemented and green. Full suite at 4d706b4: 4834 pass / 0 fail / 2 skipped of 4836, exit 0. e447 files alone: 45/45. The 3 round-2 expected reds are now green, and there are no reds off the manifest; the check-md-tables reds are green after 4d3750f. Build: no dist diff. npm audit high: exit 0. AC12 docs diff: the only removal is the consented (iii) prefix-extension. check --cut: exit 1, APPROVAL_HUMAN plus the 14 expected OUT tokens. Scope is clean: no gates/prompts/templates/e446 files; GATE_REGISTRY 33; pipeline 17; content/** unchanged since round 1. The harvest-failed text on a lane-copy failure is acceptable: it is human-approved Copy, re-running is safe (probed), and (<error>) names the real path. Optional notes only. Report: review_reports/review_T-E447-10.md.

