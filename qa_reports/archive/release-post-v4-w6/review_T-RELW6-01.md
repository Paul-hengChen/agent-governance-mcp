covers: T-RELW6-01, T-RELW6-02, T-RELW6-03, T-RELW6-04, T-RELW6-05

# QA review: release-post-v4-w6 (evidence-only gate, HEAD 4ac1b1c, version 4.8.0, Node v22.22.3)

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared)
Phase 3: skipped (evidence-only round, no test files created or edited, per dispatch brief; no new test judged warranted)
Copy Audit / Visual Audit: N/A (spec declares none)

## AC Execution Log

- AC1: `git diff --name-only v4.8.0..HEAD` classified (77 commits). Forbidden-path command: empty output. `-- bin content dist`: only bin/agc-init.mjs, content/skill-integrator.md, content/skill-qa-engineer.md, dist/tools/{config,fanout-handoff,fanout-manifest}.{d.ts,d.ts.map,js,js.map}. Unclassified-path filter (all spec classes as regex): empty. owners cross-check = AC8(d). PASS.
- AC2: review verdicts APPROVED for T-E284-01, T-E291-01, T-E329-01, T-E335-04. QA latest verdict PASS for every named id (E284-01/02, E330, E331, E332, E333 had round 1 FAIL then PASS; E291-01..03, E335-01..05, E327/E328/E329/E334 PASS). Lane handoffs e329/e284/e291: status "PASS", last_agent "qa-engineer". Lane ledgers: every row [x] (6 + 5 rows... all listed rows [x]). Backlog E284..E335 rows DONE naming d4855e4 / ec6697b / 047a652; E336-E340 rows present, not DONE. `git merge-base --is-ancestor` x3: exit=0. PASS.
- AC3: `node scripts/test-lock.mjs -- npm test` on HEAD 4ac1b1c, Node v22.22.3: tests 3409, pass 3407, fail 0, skipped 2, 0 `not ok` lines. No rerun needed. PASS.
- AC4: `npm run build` then `git status --porcelain dist/` empty. `check-version`: OK (4.8.0), exit 0. `check:bookkeeping` exit 0 (384 ticket rows). `check:md-tables` exit 0 (589 files, 0 malformed). PASS.
- AC5: `npm audit --audit-level=high` exit 0 (8 vulnerabilities: 2 low, 6 moderate, 0 high/critical). `git diff --stat v4.8.0..HEAD -- package.json package-lock.json` empty. PASS.
- AC6: `agc check` exit 0 "OK (4.8.0) — all adapters current". `check-transitions-sync` exit 0 (21 keys). PASS.
- AC7: HEAD = 4ac1b1cf2012f4e18d38bdbdc4a70e89dcfd6966. Run 39046516209: headSha 4ac1b1c..., success, test (20) success, test (22) success. Run 39045490708: headSha 047a652..., success, test (20) success, test (22) success. PASS.
- AC8: (a) validate sweep: only specs/fanout-wave5.1.md and specs/fanout-wave6.md exit 2 with DECISIONS_SECTION_ABSENT + PINS_SECTION_ABSENT, no HANDOFF_* ; w6 manifest `fanout: ok — 3 dispatchable lane(s), 0 provisional, 14 decision(s)`; truncated copy exit 2 HANDOFF_SECTION_ABSENT. (b) usage exit 2, 5 matching lines, owners and handoff [--check] forms present. (c) `handoff --closing` exit 0, four ### sub-items, 無 under last; `handoff --check` summary "5 fact(s) checked, 2 differ, 2 moved", exit 1; DIFF lines name only git status and lane-status, explained by this feature's uncommitted bookkeeping and new active_feature; git status before/after unchanged; no stack trace. (d) owners --range v4.8.0...HEAD exit 1, HIT lines tools/fanout-manifest.ts->e284, bin/agc-init.mjs->e291, content/skill-integrator.md->e329, summary "79 path(s), 59 hit(s), 3 dispatchable lane(s)", nothing written. (e) 16 listed test files: 200/200 pass. PASS.
- AC9: CURRENT_VERSIONS {"handoff":15,"tasks":2,"sqlite":2,"config":2}; schema/, dist/schema/, docs/schema-versions.md diff empty; docs/config.md documents nodeModulesLinks (line 108) and "config schema_version stays 2" (line 134); `agc feature` usage names nodeModulesLinks; 14 listed test files (incl. e246 unedited): 329/329 pass. Node 20 verdict = AC7 CI. PASS.
- AC10: build output five-way check `true true true true true`; qa SOP 18253 bytes (<= 18500); lane-protocol diff: 3 added lines (target_repo template line at 54, two lines at 61-62), zero removed, hunks after `## 4.` (line 45), §3 untouched; const/coord/fixtures/context-budget/qa-visual-skill-split diff empty; e286 diff exactly 2 removed + 2 added condition-2 lines; 12 listed test files: 171/171 pass. PASS.
- AC11: v4.8.0^{commit} = 3f0c2a858a88a21c1b991ea9c3663f4d9dcae332; CHANGELOG line 19 `## [4.8.0] - 2026-10-17`; `const HOP_CAP = 14` at tools/transitions.ts:326; GATE_REGISTRY = 34; 16 listed test files: 354/354 pass. PASS.

## Findings
- None blocking. No code, test or content edits made. Working tree changes limited to the feature's own uncommitted bookkeeping (.current/_primary/*, specs/release-post-v4-w6.md) plus this review file.
- Minor observation: AC2 proof grep for `verdict` matches heading lines too; verdicts read directly from each review's Verdict line.

## Verdict
PASS for T-RELW6-01..05 (AC1-AC11 all hold on HEAD 4ac1b1c).
## 2026-10-17T16:40:33.784Z — PASS — by qa-engineer

PASS AC1-AC11 on HEAD 4ac1b1c (4.8.0, Node 22.22.3). Full suite under test lock: 3409 tests, 3407 pass, 0 fail, 2 skipped. dist clean after build; check-version/bookkeeping/md-tables/agc check/transitions-sync exit 0; npm audit exit 0 (no high); package files unchanged. CI runs 39046516209 and 39045490708 success with test (20) and test (22) success. AC8 probes: validate sweep as expected, usage 5 lines, handoff --closing exit 0, --check 5 facts (2 DIFF git status/lane-status explained by own bookkeeping, 2 MOVED) exit 1, owners range HITs correct, read-only. AC9 no config schema bump, tests 329/329. AC10 bundle sentences true, qa SOP 18253 bytes, lane-protocol 3 added lines in section 4 only, goldens untouched, e286 2+2 re-pin; tests 171/171. AC11 tag 3f0c2a8, HOP_CAP 14, GATE_REGISTRY 34; tests 354/354. See qa_reports/review_T-RELW6-01.md (covers all five, AC Execution Log). No new test judged warranted. No code or test edits.

