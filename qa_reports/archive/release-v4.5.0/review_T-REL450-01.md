covers: T-REL450-01, T-REL450-02, T-REL450-03, T-REL450-04

# QA review: release-v4.5.0 (HEAD 16b2718 vs v4.4.1 = 76b9c11)

Verdict: all AC1-AC8 hold. State write blocked (see bottom).

Phase 0.5: skipped (no expected-red manifest for release-v4.5.0). Phase 1.5: skipped (no Visual Baselines). Phase 3: skipped (evidence-only, no test files added).

## AC1
71 commits. Every path in `git diff --name-only v4.4.1..HEAD` falls in E275/E269/E264/E268/E267/bookkeeping groups. Empty diff for tsconfig*, .github, bin, scripts, gates, prompts, schema, guards, transport, lib, index.ts. package.json diff = sdk ^1.29.0->^1.32.1, sharp ^0.35.4->^0.35.5 only. Untracked human doc not in the diff.

## AC2
review_reports APPROVED: T-E275-01, T-E269-01 (R1 CHANGES_REQUESTED closed by R2 APPROVED), T-E269-06, T-E264-01, T-E268-01. qa_reports PASS for T-E275-01/02, T-E269-01..07, T-E264-01/02, T-E268-01..06. .current/history/2026-10/{e275,e269,e264,e268}/handoff.md: status "PASS", last_agent "qa-engineer".

## AC3
`node scripts/test-lock.mjs -- npm test`: exit 0; tests 3045, pass 3042, fail 0, cancelled 0, skipped 3. No flake reruns needed.

## AC4
`npm run build` exit 0; `git status --porcelain dist/` empty; `node scripts/check-version.mjs` exit 0 (4.4.1).

## AC5
`npm audit --audit-level=high` exit 0 (8 vulns: 2 low, 6 moderate). npm ls: sdk 1.32.1, proxy-addr 2.0.8, sharp 0.35.5 (overridden). docs/dependency-advisories.md: sections 4 Third round (GHSA-wq5f-xc86-pv6w), 6 (GHSA-6qxp-vccf-f47h), 7 (GHSA-jqcg-44mw-7w3h), each decision upgrade with re-review trigger. Non-blocking: code-reviewer Q1 doc-precision note on the residual paragraph left open.

## AC6
(a) const-15 adds `git stash drop` and `git stash clear` as FORBIDDEN, sanctioned-ops first sentence intact (e178a passes). (b) Built bundles: qa-engineer and code-reviewer contain "Negative control" and `git stash drop`; sr-engineer and pm contain `git stash drop`. (c) 11 goldens, 11 insertions / 11 deletions (one line each). (d) ceilings 5567/10076/20453/7978, pm 4401, sr 2852; context-budget + e269-title-sync + e178a + compose-equivalence: 88 tests, 87 pass, 1 skipped, 0 fail. (e) No line-number reference to the same file or verify-release.mjs; the single grep hit (line 220) is historical v3.104.2 CHANGELOG-quoting prose.

## AC7
TypeScript transpileModule removeComments:true, v4.4.1 vs HEAD: IDENTICAL for tools/{lane-migrate,lane-paths,merge-invariants,telemetry}.ts and test/{drift-skew,agc-adapters,e22-stale-notify,gates-expected-red,e92-e86-handoff-write-boundary,lane-ticket-allocation,pixel-gate-attestation,qa-flow}.test.mjs. subagent-templates diff reviewed: comment-only.

## AC8
e246, e178a, e259 brace/hash/limits, e258b: 87 tests, 86 pass, 1 skipped, 0 fail. `git rev-parse v4.4.1^{commit}` = 76b9c11. CHANGELOG.md line 19 `## [4.4.1] - 2026-10-05`. qa_reports/archive/release-v4.4.1 present.

## State-write note
Claim (pm:In_Progress -> qa-engineer:In_Progress) and direct PASS were both rejected TRANSITION_REJECTED: current state was written as pm:In_Progress and ALLOWED_TRANSITIONS has no pm -> qa edge. tw_complete_task not called.
## 2026-10-08T06:21:12.342Z — PASS — by qa-engineer

PASS AC1-AC8 on HEAD 16b2718 vs v4.4.1 (76b9c11). AC1: 71 commits; all paths in allowed E275/E269/E264/E268/E267/bookkeeping groups; tsconfig/.github/bin/scripts/gates/prompts/schema/guards/transport/lib/index.ts diff empty; package.json diff exactly sdk ^1.32.1 and sharp ^0.35.5. AC2: review_reports APPROVED for E275-01, E269-01 (R1 CHANGES_REQUESTED closed by R2 APPROVED), E269-06, E264-01, E268-01; qa_reports PASS for all 17 tasks; four lane history handoffs status PASS, last_agent qa-engineer. AC3: node scripts/test-lock.mjs -- npm test exit 0, tests 3045 pass 3042 fail 0 cancelled 0 skipped 3, no flake reruns needed. AC4: build exit 0, dist porcelain empty, check-version OK (4.4.1). AC5: npm audit --audit-level=high exit 0 (2 low, 6 moderate); sdk 1.32.1, proxy-addr 2.0.8, sharp 0.35.5; advisories doc has dispositions (upgrade, re-review trigger) for all three GHSAs. AC6: const-15 adds git stash drop/clear FORBIDDEN, pinned sentence intact; qa-engineer and code-reviewer bundles contain Negative control and git stash drop, sr-engineer and pm contain git stash drop; 11 goldens one line each; ceilings 5567/10076/20453/7978 plus 4401/2852; budget/title-sync/e178a/compose-equivalence 87 pass 1 skipped 0 fail; no line-number refs in skill-release-engineer (line 220 hit is historical CHANGELOG prose). AC7: removeComments transpile identical for 4 tools files and 8 E268 test files; subagent-templates diff comment-only. AC8: e246/e178a/e259x3/e258b 86 pass 1 skipped 0 fail; v4.4.1 = 76b9c11; CHANGELOG [4.4.1] present; archive/release-v4.4.1 intact. No git stash used; human untracked doc untouched. Non-blocking: code-reviewer Q1 doc-precision note on E275 residual paragraph left open.


## AC Execution Log
One log for the round; covers T-REL450-01..04.

| AC | command | raw result | verdict |
|---|---|---|---|
| AC1 | `git diff --name-only v4.4.1..HEAD`; `git log --oneline v4.4.1..HEAD \| wc -l`; `git diff --name-only v4.4.1..HEAD -- 'tsconfig*' .github bin scripts gates prompts schema guards transport lib index.ts`; `git diff v4.4.1..HEAD -- package.json` | 71 commits; all paths in allowed groups; forbidden-path diff empty; package.json +/- = sdk ^1.29.0->^1.32.1, sharp ^0.35.4->^0.35.5 | pass |
| AC2 | `grep -n -i -E 'verdict\|round' review_reports/*E{275,269,264,268}*`; `grep -n -i -E 'PASS\|FAIL' qa_reports/review_T-E{...}-*.md`; `grep -E '^(status\|last_agent):' .current/history/2026-10/e{275,269,264,268}/handoff.md` | APPROVED verdicts present; QA PASS for all 17 tasks; four handoffs status "PASS", last_agent "qa-engineer" | pass |
| AC3 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3045, pass 3042, fail 0, cancelled 0, skipped 3 | pass |
| AC4 | `npm run build`; `git status --porcelain dist/`; `node scripts/check-version.mjs` | build exit 0; porcelain empty; check-version OK (4.4.1), exit 0 | pass |
| AC5 | `npm audit --audit-level=high`; `npm ls @modelcontextprotocol/sdk proxy-addr sharp`; `git diff v4.4.1..HEAD -- docs/dependency-advisories.md` | audit exit 0 (2 low, 6 moderate); sdk 1.32.1, proxy-addr 2.0.8, sharp 0.35.5; sections 4 third round, 6, 7 with GHSA, decision upgrade, re-review trigger | pass |
| AC6 | `git diff v4.4.1..HEAD -- content`; built bundles for qa-engineer, code-reviewer, sr-engineer, pm grepped; `git diff --stat v4.4.1..HEAD -- test/fixtures`; `node --test test/context-budget.test.mjs test/e269-budget-title-sync.test.mjs test/e178a-integrator-role.test.mjs test/compose-equivalence.test.mjs`; line-number-ref grep on skill-release-engineer.md | stash drop/clear FORBIDDEN added; negctl in qa+reviewer bundles, stash drop in all four; 11 files 11+/11-; 88 tests 87 pass 1 skipped 0 fail; only grep hit line 220 historical prose | pass |
| AC7 | TypeScript transpileModule removeComments:true, v4.4.1 vs HEAD per file; `git diff v4.4.1..HEAD -- test/subagent-templates.test.mjs` | IDENTICAL x12 (4 tools, 8 E268 tests); subagent-templates diff comment-only | pass |
| AC8 | `node --test` e246, e178a, e259 brace/hash/limits, e258b; `git rev-parse v4.4.1^{commit}`; `grep -n '\[4.4.1\]' CHANGELOG.md` | 87 tests 86 pass 1 skipped 0 fail; 76b9c11...; CHANGELOG.md:19 | pass |
## 2026-10-08T06:21:32.759Z — PASS — by qa-engineer

PASS AC1-AC8 on HEAD 16b2718 vs v4.4.1 (76b9c11). AC1: 71 commits; all paths in allowed groups; forbidden-path diff empty; package.json diff exactly sdk ^1.32.1 and sharp ^0.35.5. AC2: reviews APPROVED (E269-01 R1 CHANGES_REQUESTED closed by R2), QA PASS for 17 tasks, four lane handoffs PASS/qa-engineer. AC3: test-lock suite exit 0, 3045 tests, 3042 pass, 0 fail, 3 skipped. AC4: build clean, dist porcelain empty, check-version OK. AC5: audit high exit 0 (2 low, 6 moderate); sdk 1.32.1, proxy-addr 2.0.8, sharp 0.35.5; advisory dispositions present. AC6: stash drop/clear FORBIDDEN composed into bundles, negative-control line in qa+reviewer bundles, 11 goldens one line each, ceilings 5567/10076/20453/7978, no line-number refs. AC7: removeComments transpile identical for 12 files; subagent-templates diff comment-only. AC8: regression set 86 pass 0 fail; v4.4.1=76b9c11; CHANGELOG [4.4.1] present. See ## AC Execution Log in qa_reports/review_T-REL450-01.md. Non-blocking: code-reviewer Q1 doc note open.

