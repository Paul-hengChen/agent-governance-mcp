---
schema_version: 15
active_feature: "e297-main-protected-sop"
status: "In_Progress"
last_updated: "2026-10-14T11:10:34.495Z"
last_agent: "sr-engineer"
prd_path: "docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "One SOP rewrite (integrator Stage 6, release-engineer 8a-8c/13a-13b, Constitution section 6 grant, coord-03 bookkeeping paragraph) plus the one enabling code change (MODEL_TIERS gains fable); splitting would leave the grant and the SOPs inconsistent across pull requests. Spec specs/e297-main-protected-sop.md; tasks T-E297-01..06."
cut_approved: true
dispatch_pins:
  sr-engineer: "fable"
evidence_schema: 2
next_role: "code-reviewer"
dispatched_at: "2026-10-14T11:10:34.495Z"
dispatch_mechanism: "task"
dispatch_mechanism_tier: "fable"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 2
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- sr-engineer: T-E297-01..04 ready for code review (lane branch feat/e297-main-protected-sop; option A grant per the human's cut approval; single PR path; git merge --ff-only kept in the grant)
- T-E297-01 (4ada51f): tools/skill-frontmatter.ts MODEL_TIERS = [opus, sonnet, haiku, fable]; rebuilt dist/tools/skill-frontmatter.{js,d.ts,js.map,d.ts.map} committed, no other dist churn; AC9 proof prints ["opus","sonnet","haiku","fable"] fable; npm audit --audit-level=high after build: 0 high/critical (8 low/moderate, none new vs docs/dependency-advisories.md)
- T-E297-02 (cfadf43): content/skill-integrator.md +3202 chars. Frontmatter fable + Invocation sentence (advice to the human, opus fallback). Stage 6 rewritten per AC1: finish --shipped --base integ/<feature> per lane on integ, full suite, push -u, gh pr create, gh pr merge --auto --merge, wait via gh pr view <n> --json state,mergeCommit or git fetch; red = stop; BEHIND = merge --no-ff main into integ + merge-invariants + suite + push; switch main / pull --ff-only; branch -d; report merge sha + PR number. AC10 sentence (a red sha cannot reach `main`). Work overview row 6, Permissions, Lifecycle 6, 5b-1, 5b-5, 5c heading + 5c-1, Git operations, own-commits rewritten; mailbox sentences verbatim; AC2 grep prints nothing; label count 1
- T-E297-03 (f68ba17): content/skill-release-engineer.md +3976 chars. No-force-pushes rule gains never-push-main + pull --ff-only; 3a pulls main ff-only; new 3b git switch -c release/vX.Y.Z; 8a commits on the release branch, git push -u origin release/vX.Y.Z, gh pr create (base main); 8b strict ci-check against the PR head, local-tag clauses dropped, budget-sequencing sentences verbatim; 8c = gh pr merge <n> --auto --merge after CI-CHECK PASSED, wait MERGED, switch main, pull --ff-only, assert HEAD == mergeCommit.oid, tag, push tag, branch -d; 9a on main; 13a via a release/vX.Y.Z-bookkeeping PR (staging script verbatim); 13b remedies rewritten; new Escalation Routes row 'pull request cannot merge' after the D10 row (D10 row byte-identical); Output rule wording. scripts/verify-release.mjs untouched (AC6 diff --quiet exits 0)
- T-E297-04 (3b01c84): content/const-15-core-tail.md +585 chars (7376 -> 7963 bytes): new base-list sub-bullet for git pull --ff-only on main (read-plus-ff; a protected branch moves only by PR merge); grant sub-bullet keeps every op, adds gh pr create + gh pr merge --auto --merge (never --squash/--rebase/--admin) and the two namespaces (release-engineer release/*, coordinator docs/*: switch -c / switch main / branch -d own merged branches only + the two gh pr ops); pinned first sentence + FORBIDDEN list byte-identical; constitution-rationale.md untouched. content/coord-03-core-fallback.md +585 chars (20788 -> 21378 bytes): one paragraph 'Bookkeeping never lands on local main' between the lane-findings paragraph and Bounds; e5-intake-tiering pins green
- Full suite on e1eb3c0 (clean tree, test-lock): 3017/3045 pass, 24 fail, 3 skipped. Expected reds (22) are listed in qa_reports/expected-red_e297-main-protected-sop.txt: compose-equivalence x11 + skill-manifest golden (regenerate goldens); context-budget x4 measured 5713 / 10222 / 20745 / 8125 ~tok vs pins 5567 / 10076 / 20453 / 7978; e178a AC1/AC6/AC9; skill-frontmatter MODEL_TIERS; e164-e167 AC2/AC4; release-staging row count 9 -> 10. Two further reds were load timeouts in test/e177b-test-lock.test.mjs (AC13a 'test timed out after 20000ms', AC13b 'waitFor: timed out'); that file passes 19/19 standalone and this lane touches no lock code; qa please rerun under test-lock on final HEAD
- qa re-pin (1/3) test/e178a-integrator-role.test.mjs: :77 -> /^---\nrecommended_model: fable\n---\n/ and :78 MODEL_TIERS.includes('fable'); :309 -> '**never open the pull request before that verdict is APPROVED.**'; :264 grant clause -> first sentence of the rewritten sub-bullet: '**Integrator-only grant**: only the `integrator` role may also run `git merge --no-ff`, `git merge --ff-only`, `git switch -c`, `git switch <existing-branch>` (never `--force` / `--discard-changes`), `git worktree remove` (never `--force`), `git branch -d` (never `-D`), `git update-ref -d <ref> <expected-sha>` (compare-and-delete), `gh pr create` and `gh pr merge --auto --merge` (never `--squash` / `--rebase` / `--admin`), when `skill-integrator` says.' (the namespaces sentence follows it; 'every other role stays on the base list' closes that second sentence)
- qa re-pin (2/3): test/skill-frontmatter.test.mjs:88 -> ["opus","sonnet","haiku","fable"]. test/e164-e167-content.test.mjs AC2: the 8b clauses 'delete any local tag created ahead of this gate', 'deleting any unpushed local tag first, as above' and 'This never touches a published tag' no longer exist (8b now says no tag exists before the merge); AC4: the 8c tag-create bullet is now '`git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>"` on that HEAD — local and reversible (undo with `git tag -d vX.Y.Z`) until the next bullet.' ('any time after step 8a completes' / 'including before 8b' / '(see 8b).' retired); the tag-push bullet still carries 'the one irreversible act' and ends with 8b's `CI-CHECK PASSED`.
- qa re-pin (3/3): test/release-staging.test.mjs:1249 Escalation Routes data rows 9 -> 10; the new row 'pull request cannot merge (step 8c or 13a: ...)' sits right after the D10 row and before the gh-CLI row, so first-two / last-row order assertions hold. Goldens: every changed hunk should be the const-15 section 6 sub-bullets or the coord-03 paragraph.
- reviewer attention: (1) Stage 6 step 3 says 'then, on that pull request, `gh pr merge --auto --merge`' (literal per AC1's pattern, no <n>); the release SOP uses `gh pr merge <n> --auto --merge` per AC3; (2) Stage 6 step 4 adds `gh pr view <n> --json mergeStateStatus` for the BEHIND check (additive); (3) release 3b adds an inline STOP when release/vX.Y.Z already exists (authored-here, no new Escalation Routes row); (4) 13a's lead-in states why a second PR is needed (the closing write names the main merge commit), per the spec ruling; (5) section 6 grant is two sentences (grant list, then namespaces) for readability
- coordinator: cut approved by the human in this lane session (2026-10-14) after integrator pre-review close (to-lane#3); human rulings — (a) option A: section 6 gains two namespaces beside the integrator, release-engineer limited to release/*, coordinator limited to docs/*, each sharing git switch -c / git switch main / git branch -d + gh pr create / gh pr merge --auto --merge (never --squash/--rebase/--admin); (b) four budget ceilings may rise, qa sets exact measured values; (c) single PR path, no non-PR fallback; (d) git merge --ff-only stays in the grant
- pm: spec specs/e297-main-protected-sop.md (commit c0377d8) governs; tasks T-E297-01..04 sr-engineer, T-E297-05 code-reviewer, T-E297-06 qa-engineer; external_refs: none; lane findings in .current/e297/pending-tickets.md (E297-NEW-1..3)

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
