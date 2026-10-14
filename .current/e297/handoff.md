---
schema_version: 15
active_feature: "e297-main-protected-sop"
status: "In_Progress"
last_updated: "2026-10-14T11:20:45.741Z"
last_agent: "sr-engineer"
prd_path: "docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "One SOP rewrite (integrator Stage 6, release-engineer 8a-8c/13a-13b, Constitution section 6 grant, coord-03 bookkeeping paragraph) plus the one enabling code change (MODEL_TIERS gains fable); splitting would leave the grant and the SOPs inconsistent across pull requests. Spec specs/e297-main-protected-sop.md; tasks T-E297-01..06."
cut_approved: true
dispatch_pins:
  sr-engineer: "fable"
evidence_schema: 2
next_role: "code-reviewer"
dispatched_at: "2026-10-14T11:20:45.741Z"
dispatch_mechanism: "task"
dispatch_mechanism_tier: "fable"
qa_round: 0
review_round: 1
visual_round: 0
hop_count: 4
qa_rounds_total: 0
review_rounds_total: 1
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- sr-engineer: addressed code-reviewer Round 1 (review_reports/review_T-E297-05.md); fix commit 3a38af6 on feat/e297-main-protected-sop; T-E297-01..04 ready for code review round 2
- Round 2 delta (3a38af6): F1 — content/skill-integrator.md Stage 6 step 4 now brings local main up to date before the merge ('first bring local `main` up to date — `git switch main`, `git pull --ff-only`, `git switch integ/<feature>` (or `git fetch` and merge `origin/main` instead) — then `git merge --no-ff main`'); F2 — same sentence adds 'because auto-merge is already armed, the push IS the merge trigger: when the resolution is substantive, push only after the 5b-5 code-reviewer verdict is APPROVED and its evidence file is committed on the integration branch; CHANGES_REQUESTED → stop and report' (consistent with 5b-5 'never open the pull request before that verdict is APPROVED'); O1 — step 1 now reads 'tears down the worktree and branch; its allocation and history-move commits ride the pull request'
- Round 2 delta cont.: R1 — content/skill-release-engineer.md 3b adds that a same-version re-baseline lands on the same name, so the coordinator/human closes the stale pull request and removes release/vX.Y.Z before re-entry at 3a (release-engineer never deletes it); the new Escalation Routes row's note now ends '(coordinator/human closes the stale pull request and removes release/vX.Y.Z, then re-baseline at step 3a)'; D10 row byte-identical. O2 — content/const-15-core-tail.md grant reads 'limited to `release/*`' / 'limited to `docs/*`' (+16 chars; growth vs main now 601 of 800). O3 skipped (coordinator relays via mailbox). coord-03 untouched (+585 of 700)
- Round 2 checks on 3a38af6: AC1 six patterns all hit inside Stage 6; AC2 grep prints nothing, label count 1; AC10 hit at Stage 6 step 4; AC3 four patterns hit, 'any time after step 8a completes' 0; AC7 hits on section 6 sub-bullets, pinned first sentence count 1; AC6 verify-release.mjs zero diff; test/e246-mailbox-teardown.test.mjs + test/e5-intake-tiering.test.mjs green; test/release-staging.test.mjs 79/80 (only the known 9 -> 10 row-count pin red). No full suite this round (only the three content files changed; integrator/release SOPs enter no ceiling). tw_detect_drift this hop: 'Handoff status is FAIL, but 6 tasks remain incomplete' — the normal CHANGES_REQUESTED shape, no reconcile
- for qa (carry forward): re-pin list = e178a :77/:78 fable, :309 'never open the pull request before that verdict is APPROVED.', :264 grant sentence 1 (+ sentence 2 assertion); skill-frontmatter :88 tiers; e164-e167 AC2/AC4 (8b tag clauses retired, 8c tag bullet 'on that HEAD -- local and reversible ... until the next bullet.'); release-staging :1249 rows 9->10 (order asserts hold); goldens: compose-equivalence x11 + skill-manifest; ceilings measured by sr 5713/10222/20745/8125 (qa re-measures after the F1/F2 fix -- integrator SOP is in no ceiling); re-check two non-expected test/e177b-test-lock.test.mjs timeouts (AC13a/AC13b) under test-lock on final HEAD
- for qa (carry forward, cont.): grant sentence 2 now reads '... `release-engineer` limited to `release/*` and the coordinator limited to `docs/*` each share ... when the owning SOP says; every other role stays on the base list.' (O2 applied in round 2 — re-pin against this wording, not the round-1 'on `release/*`'). Expected-red manifest qa_reports/expected-red_e297-main-protected-sop.txt: in bounds in substance (reviewer SOP 4a carve-out, feature-keyed lowercase name; misses owned glob *E297* by case only); keep until T-E297-06 greens the reds, then qa may fold it into its report and drop it
- review_report: review_reports/review_T-E297-05.md (commit ac52513; covers T-E297-01..05) — round 1 CHANGES_REQUESTED, F1/F2 required, R1 recommended, O1/O2 optional applied, O3 skipped
- coordinator: cut approved by the human in this lane session (2026-10-14) after integrator pre-review close (to-lane#3); human rulings — (a) option A: section 6 gains two namespaces beside the integrator, release-engineer limited to release/*, coordinator limited to docs/*, each sharing git switch -c / git switch main / git branch -d + gh pr create / gh pr merge --auto --merge (never --squash/--rebase/--admin); (b) four budget ceilings may rise, qa sets exact measured values; (c) single PR path, no non-PR fallback; (d) git merge --ff-only stays in the grant
- pm: spec specs/e297-main-protected-sop.md (commit c0377d8) governs; tasks T-E297-01..04 sr-engineer, T-E297-05 code-reviewer, T-E297-06 qa-engineer; external_refs: none; lane findings in .current/e297/pending-tickets.md (E297-NEW-1..3)

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
