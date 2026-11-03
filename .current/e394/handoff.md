---
schema_version: 15
active_feature: "e394-release-sop-rewrite"
status: "In_Progress"
last_updated: "2026-11-03T08:03:54.618Z"
last_agent: "sr-engineer"
prd_path: "docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "Human ruling 2026-11-03: E394 is one lane, one feature, tasks ordered script then SOP; full chain with architect for the script failure-class contract. Spec: specs/e394-release-sop-rewrite.md."
cut_approved: true
dispatch_pins:
  pm: "opus"
  architect: "opus"
  sr-engineer: "opus"
  code-reviewer: "opus"
  qa-engineer: "sonnet"
evidence_schema: 2
next_role: "code-reviewer"
dispatched_at: "2026-11-03T08:03:54.618Z"
dispatch_mechanism: "task"
dispatch_mechanism_tier: "opus"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 3
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- sr-engineer: T-E394-10 ready for code review (last sr task; whole feature diff T-02..T-10 to review). Commits: 1f302e7 (SOP rewrite), 9d90345 (error-code doc sites), 2d4b9a4 (advisory disposition bullets), 080765c (expected-red list). content/skill-release-engineer.md = 14,320 bytes (cap 15,000); frontmatter byte-unchanged; sections Persona, Output rule, Hard rules, Artifact, SOP (17 steps + Reading a stop + Host kill), Escalation Routes. Escalation: 31 exit rows, bijection with EXIT_CLASSES in order (code+id, checked by script) + 9 non-script rows; human handbacks write next_role cell '—' (omit), only BOOKKEEPING_CHECK and advisory -> pm, test regression -> qa-engineer. One history pointer line (last line). No sha, no vN.N.N, no gate count; GATE_REGISTRY literal once. Verified: build 0 + dist clean, check:md-tables/version/bookkeeping 0, npm audit high 0, glue-free on both render paths, e92-e86 corpus sweep + e391 + error-code-contract + subagent-templates + skill-manifest green.
- T-10 deviations (1/2) from the architecture SOP Outline: (1) step 3 = human decisions incl. npm audit disposition (before pre-flight CI, per 'decisions before running anything'), step 4 = pre-flight CI; audit re-run at step 9 after npm test; done-mark = step 10, message file = step 11; (2) Escalation table uses Constitution §3 columns situation|status|pending note|next_role (not exit|class|do|next_role); 'do' text folded into the situation cell; status 'fix, re-run' for USAGE, VERSION_INCOHERENT, DONE_MARK, CHANGELOG_CITATION, MERGE_WAIT_TIMEOUT, CLOSING_WRITE_ABSENT, CLOSE_OUT_AHEAD (Blocked at the fix_try cap).
- T-10 deviations (2/2): (3) class ids in table rows NOT backticked: error-code-contract 'doc subset-of registry' reads backticked *_INCOMPLETE/_REJECTED/_UNRESOLVED/_UNVERIFIED tokens as gate codes; (4) SOP backtick-quotes FEATURE_LEASE_HELD (step 14) and STAMP_PROVENANCE_SUSPECT (relay rule) because gates/registry.ts's doc-file mapping comment names this file as a site for both.
- Expected-red (qa_reports/expected-red_e394-release-sop-rewrite.txt, 65 entries): suite on 2d4b9a4 = 3779 pass / 65 fail / 2 skipped of 3846 (base 3859; e164-e167-content aborts at load on missing '8b. **CI gate**' marker, so its 14 tests count as 1 file-level failure). By file: release-staging 35 (T-12), feature-lease 13, verify-release 4 (VR-9, VR-9b, VR-9c, VR-10), e130-lane-default 3, e297-main-protected-sop 2, e18-write-provenance 1, e336-portable-pull 1 (T-13), render-structure 4 (T-E69-02 x2 anchors only, glue findings = 0; T-E8795-02 x2), e166-template-defers-staging 1, e164-e167-content 1 file-level (T-14). Out-of-map failures: NONE. feature-lease e392 example-suffix blocks: not failing.
- FLAG for code-reviewer/qa (map conflict, not an out-of-map file): release-staging 'E59: all 4 live §6 dependency-audit normative sites ...' is listed 'unedited' in the Test Re-pin Map, but its three skill anchors require the base step label '6a. **Dependency-audit disposition**', which the architecture's 1-17 step numbering drops. The SOP keeps the heading text and both outcome bullet leads ('- **Already recorded**', '- **Not recorded, or recorded but its re-review trigger has since fired**'), so a re-pin needs only the '6a\. ' prefix removed from the three anchors. E59 tree-wide 'waived' sweep stays green.
- T-09 done at 610bc69 (carried): specs/release-sop-history.md, provenance header + U01-U16 verbatim from 89e01c6, per-unit sha256 16/16. Observations: U05 first-line cell drops the 3-space indent (sha matches); 95,973 total = units 95,957 + 16 newlines.
- T-08 (9f21f01, carried): close-out 13a-13b; exports readClosingWrite, classifyCloseOut. Deviations: (1) with a bookkeeping PR present (resume) 13a-1/13a-2 skipped; (2) marker = first note ^Released vX.Y.Z as a whole token, trailing text allowed; (3) MAIN_DIVERGED checks main contains the merge commit (rev-list --count HEAD..oid = 0), not HEAD = oid; (4) index read before switch -c stops 13 on pre-staged foreign paths; (5) dry-run of a not-yet-created PR prints the merge via out, not in Runner.actions; (6) bookkeeping branch without PR stops 10 (on it) or 53 (on main); (7) PR body lists the staged paths.
- T-07 deviations (carried): (1) 8b-2 argv adds --sha <headRefOid>, ALLOWED admits only that form; (2) HEAD=merge-oid assert skipped when the tag is at the oid locally OR on origin; (3) gh release create --verify-tag, notes as --notes argv, gh release view --json tagName; (4) title/notes read from the working tree (OPEN before merge, MERGED after pull); (5) ls-remote failure -> INTERNAL, failed pr view mid-wait = not merged yet, poll floored at 1s, viewPr how='deferred'. Upstream T-E394-07 (1c87573): publish 8b-9a; exports classifyPr, buildReleaseNotes.
- T-06 deviations (carried): (1) classifySpecCheck optional prevTag (log wording only), specExists predicate on a feature name; (2) exact set membership, not substring; (3) M line = first /^Multi-feature release:/m over pending_notes joined; (4) push resume compares @{u} only when the commit pre-existed; (5) PR number from gh pr create URL, fallback gh pr view; MERGED PR on prepare re-run not special-cased (-> 35). Upstream T-E394-06 (d2bc6f8): 8a-3..8a-6; exports classifySpecCheck, deriveRangeSpecs, recordsMiniChain.
- Upstream T-E394-05 (a5e9e02, carried): 8a-1/8a-2; deviations: git argv adds -z and --no-renames; dry-run treats recorded fs paths as changed+existing; citation existence inside repo only; negated prose citations need (context, not changed) (now an SOP Record-integrity rule). Upstream T-E394-04 (eba71f3): 7b-7d; deviations: --tickets none keeps the backlog diff check with an empty id set (now SOP step 10); 7b validates completed_tasks -> USAGE; diff-check first/second cell equality.
- Upstream T-E394-03 (44b4388, carried): 7a archive; no git log --grep CODES fallback; preInputs rejects unsafe active_feature. Upstream T-E394-02 (b37377e): skeleton; STAGE_PATHS early, Runner.deferred returns the result, fetch failure -> STALE_BASE, CLOSED bookkeeping PR -> PR_CANNOT_MERGE.
- Next: code-reviewer reviews the whole lane diff (git merge-base HEAD main..HEAD) with the expected-red set above; then qa T-E394-11..16.

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
